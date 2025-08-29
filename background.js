import { getSettings } from './utils/settings.js';
import { buildSummarizationPrompt } from './utils/promptBuilder.js';
import { fetchSummary } from './utils/apiClient.js';
import { isDomainBlacklisted } from './utils/domainBlacklist.js';
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

// When menu item is clicked, run content.js to extract text
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "summarizePage") {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content.js"]
      }).catch(err => {
        console.error("Failed to execute content script:", err);
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icon.png',
          title: 'Summarization Error',
          message: 'Failed to extract page content. Please try again or use the popup instead.'
        });
      });
  }
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "summarize") {
    summarizePage(message.content, sender.tab.url)
      .then(summary => {
        // Show summary in new tab
        const encoded = encodeURIComponent(summary);
        chrome.tabs.create({ url: chrome.runtime.getURL(`results.html?text=${encoded}`) });
      })
      .catch(error => {
        console.error("Summarization error:", error);
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icon.png',
          title: 'Summarization Error',
          message: error.message || 'An unexpected error occurred. Please check your settings and try again.'
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

    if (isDomainBlacklisted(settings.blacklistedUrls, pageURL)) {
      throw new Error("This is a restricted domain. Summarization is not allowed on this site.");
    }

    if (!content) {
      throw new Error("No content found on this page. Please try another page.");
    }

    if (!settings.apiKey && settings.provider !== "ollama") {
      throw new Error("API key is missing. Please set your API key in the extension settings.");
    }

    const prompt = buildSummarizationPrompt(content, settings.language);
    const summary = await fetchSummary(prompt, settings);

    if (!summary || summary.trim().length === 0) {
      throw new Error("The AI model failed to generate a summary. Please try again later.");
    }

    // Save to history
    await saveToHistory(pageURL, content, summary);
    
    return summary;
  } catch (err) {
    console.error("Summarize error:", err);
    throw err;
  }
}

async function saveToHistory(url, content, summary) {
  return new Promise((resolve, reject) => {
    const timestamp = new Date().toISOString();
    const historyItem = {
      url,
      summary,
      timestamp,
      contentPreview: createContentPreview(summary)
    };

    chrome.storage.local.get(['summaryHistory'], (result) => {
      if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
      
      const history = result.summaryHistory || [];
      history.unshift(historyItem); // Add to beginning
      
      // Keep only the last 50 summaries
      if (history.length > 50) {
        history.splice(50);
      }
      
      chrome.storage.local.set({ summaryHistory: history }, () => {
        if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
        resolve();
      });
    });
  });
}

// Create content preview from summary
function createContentPreview(summary) {
  // Remove markdown formatting and extract content
  let content = summary
    .replace(/^#\s+.+$/m, '') // Remove title/headers
    .replace(/\*\*Source:\*\*.*$/m, '') // Remove source line
    .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold
    .replace(/\*(.*?)\*/g, '$1') // Remove italic
    .replace(/^- /gm, '• ') // Convert bullet points
    .replace(/\n/g, ' ') // Replace newlines with spaces
    .replace(/\s+/g, ' ') // Collapse multiple spaces
    .trim();
  
  // Truncate to a reasonable length
  if (content.length > 100) {
    content = content.substring(0, 100) + '...';
  }
  
  return content || 'No preview available';
}
