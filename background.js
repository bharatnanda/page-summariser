import { buildContentFromText, extractPageData } from './utils/contentExtractor.js';
import { getSettings } from './utils/settings.js';
import { buildSummarizationPrompt, clampContentForProvider } from './utils/promptBuilder.js';
import { fetchSummary, fetchSummaryStream } from './utils/apiClient.js';
import { combineBlacklists, isDomainBlacklisted } from './utils/domainBlacklist.js';
import { saveSummaryForView } from './utils/summaryStore.js';
import { addHistoryItem, createHistoryItem } from './utils/historyStore.js';
import { cacheSummary, clearExpiredCache } from './utils/cache.js';

const activeStreams = new Map();

function createStreamId() {
  return `stream_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function registerStream(streamId) {
  let readyResolve;
  const ready = new Promise((resolve) => {
    readyResolve = resolve;
  });
  activeStreams.set(streamId, { port: null, buffer: [], ready, readyResolve });
}

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

function sendStreamMessage(streamId, message) {
  const stream = activeStreams.get(streamId);
  if (!stream) return;
  if (stream.port) {
    stream.port.postMessage(message);
  } else {
    stream.buffer.push(message);
  }
}

function waitForStreamReady(streamId, timeoutMs = 2000) {
  const stream = activeStreams.get(streamId);
  if (!stream?.ready) return Promise.resolve();
  return Promise.race([
    stream.ready,
    new Promise(resolve => setTimeout(resolve, timeoutMs))
  ]);
}

chrome.runtime.onConnect.addListener((port) => {
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
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "summarizePage",
    title: "Summarize this page",
    contexts: ["page"]
  });
  
  // Clear expired cache on installation
  clearExpiredCache();
});

// When menu item is clicked, extract text from the active tab
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "summarizePage") {
    chrome.scripting.executeScript({
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
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon.png',
        title: 'Summarization Error',
        message: err.message || 'Failed to summarize this page. Please try again or use the popup instead.'
      });
    });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
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
chrome.alarms.create("clearExpiredCache", {
  periodInMinutes: 360
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "clearExpiredCache") {
    clearExpiredCache();
  }
});

async function summarizePage(content, pageURL, options = {}) {
  try {
    const { onDelta } = options;
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
    const prompt = buildSummarizationPrompt(adjustedContent, settings.language);
    const summary = onDelta
      ? await fetchSummaryStream(prompt, settings, onDelta)
      : await fetchSummary(prompt, settings);

    if (!summary || summary.trim().length === 0) {
      throw new Error("The AI model failed to generate a summary. Please try again later.");
    }

    // Save to history
    await saveToHistory(pageURL, summary, options.title || "");
    
    return summary;
  } catch (err) {
    console.error("Summarize error:", err);
    throw err;
  }
}

async function saveToHistory(url, summary, title) {
  return new Promise((resolve, reject) => {
    const historyItem = createHistoryItem(url, summary, title);
    addHistoryItem(historyItem)
      .then(() => resolve())
      .catch(reject);
  });
}

async function incrementPageCount() {
  const result = await new Promise(resolve => chrome.storage.sync.get(['pageCount'], resolve));
  const currentCount = result.pageCount || 0;
  const newCount = currentCount + 1;
  await new Promise((resolve, reject) => {
    chrome.storage.sync.set({ pageCount: newCount }, () => {
      if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
      resolve();
    });
  });
}

async function startSummaryStream({ content, pageURL, title, incrementCounter, cacheKey }) {
  const streamId = createStreamId();
  registerStream(streamId);

  chrome.tabs.create({
    url: chrome.runtime.getURL(`results.html?streamId=${encodeURIComponent(streamId)}`)
  });

  try {
    await waitForStreamReady(streamId);
    const summary = await summarizePage(content, pageURL, {
      title,
      onDelta: (delta) => {
        sendStreamMessage(streamId, { type: "delta", delta });
      }
    });

    if (cacheKey) {
      await cacheSummary(cacheKey, summary);
    }

    if (incrementCounter) {
      await incrementPageCount();
    }

    let summaryId = null;
    try {
      summaryId = await saveSummaryForView(summary, { title, sourceUrl: pageURL });
    } catch (error) {
      // Ignore summary store errors; the stream already delivered the content.
    }

    sendStreamMessage(streamId, { type: "done", summary, summaryId, title, sourceUrl: pageURL });
  } catch (err) {
    console.error("Summarize error:", err);
    sendStreamMessage(streamId, {
      type: "error",
      message: err.message || "Failed to summarize this page."
    });
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icon.png',
      title: 'Summarization Error',
      message: err.message || 'Failed to summarize this page. Please try again.'
    });
  } finally {
    setTimeout(() => cleanupStream(streamId), 30000);
  }

  return streamId;
}
