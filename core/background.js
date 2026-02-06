import { buildContentFromText, extractPageData } from './utils/contentExtractor.js';
import { getSettings } from './utils/settings.js';
import { clearExpiredCache } from './utils/cache.js';
import { platform } from './platform.js';
import { summarySession } from './utils/summarySession.js';

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
  let readyResolve;
  const ready = new Promise((resolve) => {
    readyResolve = resolve;
  });
  activeStreams.set(streamId, { port: null, buffer: [], ready, readyResolve });
}

/**
 * Cleanup stream state and close any open port.
 * @param {string} streamId
 */
function cleanupStream(streamId) {
  const stream = activeStreams.get(streamId);
  if (!stream) return;
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
 * Wait for a stream port to connect or timeout.
 * @param {string} streamId
 * @param {number} timeoutMs
 * @returns {Promise<void>}
 */
function waitForStreamReady(streamId, timeoutMs = 2000) {
  const stream = activeStreams.get(streamId);
  if (!stream?.ready) return Promise.resolve();
  return Promise.race([
    stream.ready,
    new Promise(resolve => setTimeout(resolve, timeoutMs))
  ]);
}

async function showInPageToast(message, type = "info") {
  try {
    const [tab] = await platform.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;
    await platform.scripting.executeScript({
      target: { tabId: tab.id },
      func: (msg, variant) => {
        const id = 'page-summarizer-toast';
        let el = document.getElementById(id);
        if (!el) {
          el = document.createElement('div');
          el.id = id;
          el.style.cssText = [
            'position:fixed',
            'top:20px',
            'right:20px',
            'z-index:2147483647',
            'max-width:360px',
            'color:#fff',
            'padding:12px 14px',
            'border-radius:8px',
            'font:12px/1.4 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Arial,sans-serif',
            'box-shadow:0 6px 18px rgba(0,0,0,0.2)'
          ].join(';');
          document.documentElement.appendChild(el);
        }
        const colors = {
          error: '#b91c1c',
          warning: '#b45309',
          success: '#15803d',
          info: '#1f2937'
        };
        el.style.background = colors[variant] || colors.info;
        el.textContent = msg;
        el.style.display = 'block';
        if (window.__PAGE_SUMMARIZER_TOAST_TIMER) {
          window.clearTimeout(window.__PAGE_SUMMARIZER_TOAST_TIMER);
        }
        window.__PAGE_SUMMARIZER_TOAST_TIMER = window.setTimeout(() => {
          el.style.display = 'none';
        }, 4000);
      },
      args: [message, type]
    });
  } catch (error) {
    console.error("Failed to show in-page toast:", error);
  }
}

async function notifyToast(message, type = "info") {
  await showInPageToast(message, type);
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
  if (stream.readyResolve) {
    stream.readyResolve();
    stream.readyResolve = null;
  }
  if (stream.buffer.length) {
    for (const message of stream.buffer) {
      port.postMessage(message);
    }
    stream.buffer = [];
  }
  port.onDisconnect.addListener(() => {
    if (stream.port === port) {
      stream.port = null;
    }
  });
});

// Create context menu item when extension is installed
platform.runtime.onInstalled.addListener(() => {
  if (!platform.isSafari) {
    platform.contextMenus.create({
      id: "summarizePage",
      title: "Summarize this page",
      contexts: ["page"]
    });
  }
  
  // Clear expired cache on installation
  clearExpiredCache();
});

// When menu item is clicked, extract text from the active tab
platform.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "summarizePage") {
    platform.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractPageData
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
      notifyToast(err.message || 'Failed to summarize this page. Please try again or use the popup instead.', 'error');
    });
  }
});

platform.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.action !== "streamSummary") return;
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
      await notifyToast(err.message || 'Failed to summarize this page. Please try again.', 'error');
    }
    return null;
  }

  const streamId = createStreamId();
  registerStream(streamId);

  try {
    await waitForStreamReady(streamId);
    const result = await summarySession.runStreaming({
      content,
      pageURL,
      title,
      incrementCounter,
      cacheKey: resolvedCacheKey,
      streamId,
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
    console.error("Summarize error:", err);
    sendStreamMessage(streamId, {
      type: "error",
      message: err.message || "Failed to summarize this page."
    });
    await notifyToast(err.message || 'Failed to summarize this page. Please try again.', 'error');
  } finally {
    setTimeout(() => cleanupStream(streamId), 30000);
  }

  return streamId;
}
