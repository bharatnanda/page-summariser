import { buildContentFromText, extractPageText } from './utils/contentExtractor.js';
import { getSettings } from './utils/settings.js';
import { buildSummarizationPrompt, clampContentForProvider } from './utils/promptBuilder.js';
import { fetchSummary } from './utils/apiClient.js';
import { combineBlacklists, isDomainBlacklisted } from './utils/domainBlacklist.js';
import { saveSummaryForView } from './utils/summaryStore.js';
import { addHistoryItem, createHistoryItem } from './utils/historyStore.js';
import { clearExpiredCache } from './utils/cache.js';

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
      func: extractPageText
    }).then(async (results) => {
      const result = results?.[0]?.result;
      const pageURL = tab.url || '';
      if (!result || !result.trim()) {
        throw new Error("No content found on this page. Please try another page.");
      }

      const content = buildContentFromText(pageURL, result);
      const summary = await summarizePage(content, pageURL);
      try {
        const id = await saveSummaryForView(summary);
        chrome.tabs.create({ url: chrome.runtime.getURL(`results.html?id=${encodeURIComponent(id)}`) });
      } catch (error) {
        const encoded = encodeURIComponent(summary);
        chrome.tabs.create({ url: chrome.runtime.getURL(`results.html?text=${encoded}`) });
      }
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

// Periodically clear expired cache entries (every 6 hours)
chrome.alarms.create("clearExpiredCache", {
  periodInMinutes: 360
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "clearExpiredCache") {
    clearExpiredCache();
  }
});

async function summarizePage(content, pageURL) {
  try {
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
    const summary = await fetchSummary(prompt, settings);

    if (!summary || summary.trim().length === 0) {
      throw new Error("The AI model failed to generate a summary. Please try again later.");
    }

    // Save to history
    await saveToHistory(pageURL, summary);
    
    return summary;
  } catch (err) {
    console.error("Summarize error:", err);
    throw err;
  }
}

async function saveToHistory(url, summary) {
  return new Promise((resolve, reject) => {
    const historyItem = createHistoryItem(url, summary);
    addHistoryItem(historyItem)
      .then(() => resolve())
      .catch(reject);
  });
}
