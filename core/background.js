import { buildContentFromText, extractPageData } from './utils/contentExtractor.js';
import { getSettings } from './utils/settings.js';
import { clearExpiredCache } from './utils/cache.js';
import { platform } from './platform.js';
import { summarySession } from './utils/summarySession.js';
import { DEFAULT_BLACKLIST } from './utils/defaultBlacklist.js';
import { buildToastStyle } from './utils/notification.js';
import { combineBlacklists, isDomainBlacklisted } from './utils/domainBlacklist.js';

const activeStreams = new Map();

/**
 * Generate a unique stream identifier for UI streaming.
 * @returns {string}
 */
function createStreamId() {
  return `stream_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
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

/**
 * Orchestrate a full summarization for a tab:
 *   domain check → cache check → content extraction → stream.
 * Throws for fast-fail errors (domain blocked, no content) so callers can surface them.
 * Streaming is fired without awaiting — streaming errors are shown as in-page toasts.
 * @param {any} tab
 * @param {{ incrementCounter: boolean }} options
 * @returns {Promise<void>}
 */
async function handleSummarizeTab(tab, { incrementCounter }) {
  if (!tab?.id) throw new Error("No active tab found. Please try again.");

  const settings = await getSettings();

  // 0. Migration check — surface config issues before touching the network
  if (settings.migrationWarning) {
    throw new Error(`Your settings need to be updated: ${settings.migrationWarning} Please open Settings to fix this.`);
  }

  const pageURL = tab.url || '';

  // 1. Domain check — no network or script injection needed
  const combinedBlacklist = combineBlacklists(
    settings.defaultBlacklistedUrls,
    settings.blacklistedUrls
  );
  if (isDomainBlacklisted(combinedBlacklist, pageURL)) {
    throw new Error("This is a restricted domain. Summarization is not allowed on this site.");
  }

  // 2. Cache check — storage lookup only, no script injection
  const resolvedCacheKey = summarySession.buildCacheKey(pageURL, settings);
  const cached = await summarySession.checkCache({ cacheKey: resolvedCacheKey, incrementCounter });
  if (cached.handled) return;

  // 3. Content extraction — only now inject script into the page
  const results = await platform.scripting.executeScript({
    target: { tabId: tab.id },
    func: extractPageData,
    args: [Boolean(settings.useExtractionEngine)]
  });
  const result = results?.[0]?.result;
  const pageText = result?.text || '';
  const pageTitle = result?.title || '';
  if (!pageText || !pageText.trim()) {
    throw new Error("No content found on this page. Please try another page.");
  }

  // 4. Start streaming — fire and forget; errors handled internally.
  startSummaryStream({
    content: buildContentFromText(pageText),
    pageURL,
    title: pageTitle,
    incrementCounter,
    resolvedCacheKey,
    settings
  });
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
  if (!port.name.startsWith("summaryStream:")) return;
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

// When menu item is clicked, summarize the active tab
platform.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "summarizePage") {
    handleSummarizeTab(tab, { incrementCounter: false }).catch((err) => {
      console.error("Failed to summarize page:", err);
      showInPageToast(err.message || 'Failed to summarize this page. Please try again or use the popup instead.', 'error');
    });
  }
});

platform.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.action !== "summarize") return;
  (async () => {
    try {
      const [tab] = await platform.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) throw new Error("No active tab found. Please try again.");
      await handleSummarizeTab(tab, { incrementCounter: Boolean(message.incrementCounter) });
      sendResponse({ status: "started" });
    } catch (err) {
      sendResponse({ status: "error", message: err.message });
    }
  })();
  return true;
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
 * @param {{ content: string, pageURL: string, title: string, incrementCounter: boolean, resolvedCacheKey: string | null, settings: object }} args
 * @returns {Promise<string>}
 */
async function startSummaryStream({ content, pageURL, title, incrementCounter, resolvedCacheKey, settings }) {
  const disableStreaming = Boolean(settings.disableStreamingOnSafari);

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
