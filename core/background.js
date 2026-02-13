import { buildContentFromText, extractPageData } from './utils/contentExtractor.js';
import { getSettings } from './utils/settings.js';
import { clearExpiredCache } from './utils/cache.js';
import { platform } from './platform.js';
import { summarySession } from './utils/summarySession.js';
import { DEFAULT_BLACKLIST } from './utils/defaultBlacklist.js';
import { buildToastStyle } from './utils/notification.js';
import { loadSummaryForView } from './utils/summaryStore.js';
import { buildFollowUpPrompt, buildFollowupSuggestionsPrompt, clampContentForProvider } from './utils/promptBuilder.js';
import { fetchSummary, fetchSummaryStream } from './utils/apiClient.js';

const activeStreams = new Map();
const followupStreams = new Map();

/**
 * Generate a unique stream identifier for UI streaming.
 * @returns {string}
 */
function createStreamId(prefix = "stream") {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Register a stream and its pending buffer.
 * @param {string} streamId
 */
function registerStream(streamId) {
  const controller = new AbortController();
  activeStreams.set(streamId, { port: null, buffer: [], controller });
}

/**
 * Cleanup stream state and close any open port.
 * @param {string} streamId
 */
function cleanupStream(streamId) {
  const stream = activeStreams.get(streamId);
  if (!stream) return;
  if (stream.controller && !stream.controller.signal.aborted) {
    stream.controller.abort();
  }
  if (stream.port) {
    try {
      stream.port.disconnect();
    } catch (error) {
      // Ignore disconnect errors.
    }
  }
  activeStreams.delete(streamId);
}

/**
 * Send a message to a stream port or buffer it until ready.
 * @param {string} streamId
 * @param {any} message
 */
function sendStreamMessage(streamId, message) {
  const stream = activeStreams.get(streamId);
  if (!stream) return;
  if (stream.port) {
    stream.port.postMessage(message);
  } else {
    stream.buffer.push(message);
  }
}

function registerFollowupStream(streamId) {
  const controller = new AbortController();
  followupStreams.set(streamId, { port: null, buffer: [], controller });
}

function cleanupFollowupStream(streamId) {
  const stream = followupStreams.get(streamId);
  if (!stream) return;
  if (stream.controller && !stream.controller.signal.aborted) {
    stream.controller.abort();
  }
  if (stream.port) {
    try {
      stream.port.disconnect();
    } catch (error) {
      // Ignore disconnect errors.
    }
  }
  followupStreams.delete(streamId);
}

function sendFollowupMessage(streamId, message) {
  const stream = followupStreams.get(streamId);
  if (!stream) return;
  if (stream.port) {
    stream.port.postMessage(message);
  } else {
    stream.buffer.push(message);
  }
}

async function showInPageToast(message, type = "info") {
  try {
    const [tab] = await platform.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;
    await platform.scripting.executeScript({
      target: { tabId: tab.id },
      func: (msg, variant, cssText) => {
        const id = 'page-summarizer-toast';
        let el = document.getElementById(id);
        if (!el) {
          el = document.createElement('div');
          el.id = id;
          document.documentElement.appendChild(el);
        }
        el.style.cssText = cssText;
        el.textContent = msg;
        el.style.display = 'block';
        if (window.__PAGE_SUMMARIZER_TOAST_TIMER) {
          window.clearTimeout(window.__PAGE_SUMMARIZER_TOAST_TIMER);
        }
        window.__PAGE_SUMMARIZER_TOAST_TIMER = window.setTimeout(() => {
          el.style.display = 'none';
        }, 4000);
      },
      args: [message, type, buildToastStyle(type)]
    });
  } catch (error) {
    console.error("Failed to show in-page toast:", error);
  }
}

platform.runtime.onConnect.addListener((port) => {
  if (port.name.startsWith("summaryStream:")) {
    const streamId = port.name.slice("summaryStream:".length);
    const stream = activeStreams.get(streamId);
    if (!stream) {
      port.postMessage({ type: "error", message: "Stream not found or expired." });
      port.disconnect();
      return;
    }
    stream.port = port;
    if (stream.buffer.length) {
      for (const message of stream.buffer) {
        port.postMessage(message);
      }
      stream.buffer = [];
    }
    port.onDisconnect.addListener(() => {
      if (stream.port === port) {
        stream.port = null;
        if (stream.controller && !stream.controller.signal.aborted) {
          stream.controller.abort();
        }
      }
    });
    return;
  }

  if (port.name.startsWith("followupStream:")) {
    const streamId = port.name.slice("followupStream:".length);
    const stream = followupStreams.get(streamId);
    if (!stream) {
      port.postMessage({ type: "error", message: "Stream not found or expired." });
      port.disconnect();
      return;
    }
    stream.port = port;
    if (stream.buffer.length) {
      for (const message of stream.buffer) {
        port.postMessage(message);
      }
      stream.buffer = [];
    }
    port.onDisconnect.addListener(() => {
      if (stream.port === port) {
        stream.port = null;
        if (stream.controller && !stream.controller.signal.aborted) {
          stream.controller.abort();
        }
      }
    });
  }
});

// Create context menu item when extension is installed
platform.runtime.onInstalled.addListener(async () => {
  if (!platform.isSafari) {
    platform.contextMenus.create({
      id: "summarizePage",
      title: "Summarize this page",
      contexts: ["page"]
    });
  }

  try {
    const result = await platform.storage.get('sync', ['defaultBlacklistedUrls', 'defaultBlacklistInitialized']);
    const hasDefault = Boolean((result.defaultBlacklistedUrls || "").trim());
    if (!hasDefault && !result.defaultBlacklistInitialized) {
      await platform.storage.set('sync', {
        defaultBlacklistedUrls: DEFAULT_BLACKLIST,
        defaultBlacklistInitialized: true
      });
    }
  } catch (error) {
    // Ignore storage errors on install.
  }
  
  // Clear expired cache on installation
  clearExpiredCache();
});

// When menu item is clicked, extract text from the active tab
platform.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "summarizePage") {
    const settings = await getSettings();
    platform.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractPageData,
      args: [Boolean(settings.useExtractionEngine)]
    }).then(async (results) => {
      const result = results?.[0]?.result;
      const pageURL = tab.url || '';
      const pageText = result?.text || '';
      const pageTitle = result?.title || '';
      if (!pageText || !pageText.trim()) {
        throw new Error("No content found on this page. Please try another page.");
      }

      const content = buildContentFromText(pageText);
      await startSummaryStream({
        content,
        pageURL,
        title: pageTitle,
        incrementCounter: false,
        cacheKey: null
      });
    }).catch(err => {
      console.error("Failed to summarize page:", err);
      showInPageToast(err.message || 'Failed to summarize this page. Please try again or use the popup instead.', 'error');
    });
  }
});

platform.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.action === "streamSummary") {
    startSummaryStream({
      content: message.content,
      pageURL: message.pageURL,
      title: message.title || "",
      incrementCounter: Boolean(message.incrementCounter),
      cacheKey: message.cacheKey || null
    })
      .then((streamId) => sendResponse({ status: "started", streamId }))
      .catch((error) => sendResponse({ status: "error", message: error.message }));
    return true;
  }

  if (message?.action === "followupQuestion") {
    const summaryId = message.summaryId || "";
    const question = (message.question || "").trim();
    const streamId = createStreamId("followup");
    registerFollowupStream(streamId);
    const stream = followupStreams.get(streamId);

    (async () => {
      if (!summaryId) {
        throw new Error("Missing summary reference. Please re-open the summary and try again.");
      }
      if (!question) {
        throw new Error("Please enter a question.");
      }
      const stored = await loadSummaryForView(summaryId);
      const content = stored?.content || "";
      if (!content) {
        throw new Error("This summary doesn't include cached content for follow-up questions.");
      }
      const settings = await getSettings();
      if (!settings.apiKey && settings.provider !== "ollama") {
        throw new Error("API key is missing. Please set your API key in the extension settings.");
      }
      const adjustedContent = clampContentForProvider(content, settings);
      const prompt = buildFollowUpPrompt(adjustedContent, question, settings.language);
      const answer = await fetchSummaryStream(prompt, settings, (delta, fullText) => {
        sendFollowupMessage(streamId, { type: "delta", delta, fullText });
      }, stream?.controller?.signal);
      if (!answer || answer.trim().length === 0) {
        throw new Error("The AI model failed to answer the question. Please try again.");
      }
      return answer;
    })()
      .then((answer) => {
        sendFollowupMessage(streamId, { type: "done", answer });
      })
      .catch((error) => {
        sendFollowupMessage(streamId, { type: "error", message: error.message });
      })
      .finally(() => {
        setTimeout(() => cleanupFollowupStream(streamId), 30000);
      });

    sendResponse({ status: "started", streamId });
    return true;
  }

  if (message?.action === "suggestQuestions") {
    const summaryId = message.summaryId || "";
    (async () => {
      if (!summaryId) {
        throw new Error("Missing summary reference.");
      }
      const stored = await loadSummaryForView(summaryId);
      const content = stored?.content || "";
      const summary = stored?.summary || "";
      if (!content || !summary) {
        throw new Error("Summary content not available for suggestions.");
      }
      const settings = await getSettings();
      if (!settings.apiKey && settings.provider !== "ollama") {
        throw new Error("API key is missing. Please set your API key in the extension settings.");
      }
      const adjustedContent = clampContentForProvider(content, settings);
      const prompt = buildFollowupSuggestionsPrompt(adjustedContent, summary, settings.language);
      const response = await fetchSummary(prompt, settings);
      let text = String(response || "").trim();
      text = text.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
      let suggestions = [];
      try {
        if (text.startsWith("[") && text.endsWith("]")) {
          const parsed = JSON.parse(text);
          if (Array.isArray(parsed)) {
            suggestions = parsed.map(item => String(item || "").trim()).filter(Boolean);
          }
        } else {
          const parsed = JSON.parse(text);
          if (Array.isArray(parsed)) {
            suggestions = parsed.map(item => String(item || "").trim()).filter(Boolean);
          }
        }
      } catch {
        suggestions = text
          .replace(/^\s*\[/, "")
          .replace(/\]\s*$/, "")
          .split(/\n+/)
          .map(line => line.replace(/^[-*]\s+/, "").trim())
          .filter(Boolean);
      }
      suggestions = suggestions.slice(0, 5);
      if (!suggestions.length) {
        throw new Error("No suggestions available.");
      }
      return suggestions;
    })()
      .then((suggestions) => sendResponse({ status: "ok", suggestions }))
      .catch((error) => sendResponse({ status: "error", message: error.message }));
    return true;
  }
});

// Periodically clear expired cache entries (every 6 hours)
platform.alarms.create("clearExpiredCache", {
  periodInMinutes: 360
});

platform.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "clearExpiredCache") {
    clearExpiredCache();
  }
});

/**
 * Start a summary stream and open the results page.
 * @param {{ content: string, pageURL: string, title: string, incrementCounter: boolean, cacheKey: string | null }} args
 * @returns {Promise<string>}
 */
async function startSummaryStream({ content, pageURL, title, incrementCounter, cacheKey }) {
  const settings = await getSettings();
  const disableStreaming = Boolean(settings.disableStreamingOnSafari);
  const resolvedCacheKey = cacheKey
    ? summarySession.buildCacheKey(cacheKey, settings)
    : null;

  const cached = await summarySession.checkCache({ cacheKey: resolvedCacheKey, incrementCounter });
  if (cached.handled) {
    return null;
  }

  if (disableStreaming) {
    try {
      await summarySession.runNonStreaming({
        content,
        pageURL,
        title,
        incrementCounter,
        cacheKey: resolvedCacheKey
      });
    } catch (err) {
      console.error("Summarize error:", err);
      await showInPageToast(err.message || 'Failed to summarize this page. Please try again.', 'error');
    }
    return null;
  }

  const streamId = createStreamId();
  registerStream(streamId);
  const stream = activeStreams.get(streamId);

  try {
    const result = await summarySession.runStreaming({
      content,
      pageURL,
      title,
      incrementCounter,
      cacheKey: resolvedCacheKey,
      streamId,
      signal: stream?.controller?.signal,
      onDelta: (delta) => {
        sendStreamMessage(streamId, { type: "delta", delta });
      }
    });

    sendStreamMessage(streamId, {
      type: "done",
      summary: result.summary,
      summaryId: result.summaryId,
      title,
      sourceUrl: pageURL
    });
  } catch (err) {
    if (err?.name === "AbortError" || /aborted/i.test(err?.message || "")) {
      return null;
    }
    console.error("Summarize error:", err);
    sendStreamMessage(streamId, {
      type: "error",
      message: err.message || "Failed to summarize this page."
    });
    await showInPageToast(err.message || 'Failed to summarize this page. Please try again.', 'error');
  } finally {
    setTimeout(() => cleanupStream(streamId), 30000);
  }

  return streamId;
}
