import { getSettings } from './settings.js';
import { buildSummarizationPrompt, clampContentForProvider } from './promptBuilder.js';
import { fetchSummary, fetchSummaryStream } from './apiClient.js';
import { combineBlacklists, isDomainBlacklisted } from './domainBlacklist.js';
import { saveSummaryForView } from './summaryStore.js';
import { addHistoryItem, createHistoryItem, deleteSummaryForHistory, saveSummaryForHistory } from './historyStore.js';
import { cacheSummary, getCachedSummary } from './cache.js';
import { platform } from '../platform.js';

/**
 * @typedef {Object} SummaryMeta
 * @property {string} [title]
 * @property {string} [sourceUrl]
 * @property {string} [provider]
 * @property {string} [model]
 */

/**
 * @typedef {Object} SummarySessionResult
 * @property {string} summary
 * @property {string|null} summaryId
 */

/**
 * Open the results page, either streaming or non-streaming.
 * @param {{ streamId?: string, summaryId?: string, summary?: string }} payload
 */
function openResultsPage(payload) {
  if (payload?.streamId) {
    platform.tabs.create({
      url: platform.runtime.getURL(`results.html?streamId=${encodeURIComponent(payload.streamId)}`)
    });
    return;
  }

  const target = payload?.summaryId
    ? `results.html?id=${encodeURIComponent(payload.summaryId)}`
    : `results.html?text=${encodeURIComponent(payload.summary || "")}`;

  platform.tabs.create({
    url: platform.runtime.getURL(target)
  });
}

/**
 * Build a stable cache key for a summary request.
 * @param {string} pageURL
 * @param {import('./settings.js').Settings} settings
 * @returns {string}
 */
function buildCacheKey(pageURL, settings) {
  const provider = settings?.provider || "";
  const model = settings?.model || "";
  const language = settings?.language || "";
  return [pageURL || "", provider, model, language].join("|");
}

/**
 * Increment the count of summarized pages.
 * @returns {Promise<void>}
 */
async function incrementPageCount() {
  const result = await platform.storage.get('sync', ['pageCount']);
  const currentCount = result.pageCount || 0;
  const newCount = currentCount + 1;
  await platform.storage.set('sync', { pageCount: newCount });
}

/**
 * Save a summary to history.
 * @param {string} url
 * @param {string} summary
 * @param {string} title
 * @param {{ provider?: string, model?: string }} meta
 * @returns {Promise<void>}
 */
async function saveToHistory(url, summary, title, meta = {}) {
  let summaryId = null;
  try {
    summaryId = await saveSummaryForHistory(summary);
  } catch (error) {
    summaryId = null;
  }

  const historyItem = createHistoryItem(url, summary, title, meta, summaryId);
  const result = await addHistoryItem(historyItem);
  if (summaryId && result.status === 'duplicate') {
    await deleteSummaryForHistory(summaryId);
  }
}

/**
 * Generate a summary from content with provider settings.
 * @param {string} content
 * @param {string} pageURL
 * @param {{ onDelta?: (delta: string) => void, title?: string, signal?: AbortSignal }} options
 * @returns {Promise<{ summary: string, settings: import('./settings.js').Settings }>}
 */
async function generateSummary(content, pageURL, options = {}) {
  const { onDelta, signal } = options;
  const settings = await getSettings();

  const combinedBlacklist = combineBlacklists(
    settings.defaultBlacklistedUrls,
    settings.blacklistedUrls
  );

  if (isDomainBlacklisted(combinedBlacklist, pageURL)) {
    throw new Error("This is a restricted domain. Summarization is not allowed on this site.");
  }

  if (!content) {
    throw new Error("No content found on this page. Please try another page.");
  }

  if (!settings.apiKey && settings.provider !== "ollama") {
    throw new Error("API key is missing. Please set your API key in the extension settings.");
  }

  const adjustedContent = clampContentForProvider(content, settings);
  const prompt = buildSummarizationPrompt(adjustedContent, settings.language, settings.promptProfile);
  const summary = onDelta
    ? await fetchSummaryStream(prompt, settings, onDelta, signal)
    : await fetchSummary(prompt, settings, signal);

  if (!summary || summary.trim().length === 0) {
    throw new Error("The AI model failed to generate a summary. Please try again later.");
  }

  await saveToHistory(pageURL, summary, options.title || "", {
    provider: settings.provider,
    model: settings.provider === "azure" ? settings.deployment : settings.model
  });
  return { summary, settings };
}

/**
 * Persist a summary for the results page and open it.
 * @param {string} summary
 * @param {SummaryMeta} meta
 * @returns {Promise<string|null>}
 */
async function saveAndOpen(summary, meta) {
  let summaryId = null;
  try {
    summaryId = await saveSummaryForView(summary, meta);
  } catch (error) {
    // Ignore summary store errors.
  }
  openResultsPage({ summary, summaryId });
  return summaryId;
}

export const summarySession = {
  openResultsPage,
  buildCacheKey,
  /**
   * Check cache and open cached result if present.
   * @param {{ cacheKey: string | null, incrementCounter: boolean }} args
   * @returns {Promise<{ handled: boolean, summary?: string, summaryId?: string|null }>}
   */
  async checkCache({ cacheKey, incrementCounter }) {
    if (!cacheKey) return { handled: false };

    const cachedSummary = await getCachedSummary(cacheKey);
    if (!cachedSummary?.summary) return { handled: false };

    if (incrementCounter) {
      await incrementPageCount();
    }

    const summaryId = await saveAndOpen(cachedSummary.summary, {
      title: cachedSummary.title || "",
      sourceUrl: cachedSummary.sourceUrl || "",
      provider: cachedSummary.provider || "",
      model: cachedSummary.model || ""
    });

    return { handled: true, summary: cachedSummary.summary, summaryId };
  },

  /**
   * Run a full non-streaming summary session.
   * @param {{ content: string, pageURL: string, title: string, incrementCounter: boolean, cacheKey: string | null }} args
   * @returns {Promise<SummarySessionResult>}
   */
  async runNonStreaming({ content, pageURL, title, incrementCounter, cacheKey }) {
    const { summary, settings } = await generateSummary(content, pageURL, { title });

    if (cacheKey) {
      await cacheSummary(cacheKey, summary, {
        title,
        sourceUrl: pageURL,
        provider: settings.provider,
        model: settings.provider === "azure" ? settings.deployment : settings.model
      });
    }

    if (incrementCounter) {
      await incrementPageCount();
    }

    const summaryId = await saveAndOpen(summary, {
      title,
      sourceUrl: pageURL,
      provider: settings.provider,
      model: settings.provider === "azure" ? settings.deployment : settings.model
    });
    return { summary, summaryId };
  },

  /**
   * Run a streaming summary session and open a streaming results page.
   * @param {{ content: string, pageURL: string, title: string, incrementCounter: boolean, cacheKey: string | null, streamId: string, onDelta: (delta: string) => void, signal?: AbortSignal }} args
   * @returns {Promise<SummarySessionResult>}
   */
  async runStreaming({ content, pageURL, title, incrementCounter, cacheKey, streamId, onDelta, signal }) {
    openResultsPage({ streamId });

    const { summary, settings } = await generateSummary(content, pageURL, { title, onDelta, signal });

    if (cacheKey) {
      await cacheSummary(cacheKey, summary, {
        title,
        sourceUrl: pageURL,
        provider: settings.provider,
        model: settings.provider === "azure" ? settings.deployment : settings.model
      });
    }

    if (incrementCounter) {
      await incrementPageCount();
    }

    let summaryId = null;
    try {
      summaryId = await saveSummaryForView(summary, {
        title,
        sourceUrl: pageURL,
        provider: settings.provider,
        model: settings.provider === "azure" ? settings.deployment : settings.model
      });
    } catch (error) {
      // Ignore summary store errors.
    }

    return { summary, summaryId };
  }
};
