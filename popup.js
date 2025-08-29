import { getPageContent, getPageUrl } from './utils/contentExtractor.js';
import { getSettings } from './utils/settings.js';
import { buildSummarizationPrompt } from './utils/promptBuilder.js';
import { fetchSummary } from './utils/apiClient.js';
import { isDomainBlacklisted } from './utils/domainBlacklist.js';

document.addEventListener("DOMContentLoaded", async () => {
  const notification = document.getElementById("notification");
  await updateCounterDisplay();

  document.getElementById("settingsBtn").addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });

  document.getElementById("historyBtn").addEventListener("click", () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('history.html') });
  });

  document.getElementById("summarizeBtn").addEventListener("click", async () => {
    const summarizeBtn = document.getElementById("summarizeBtn");
    const originalBtnText = summarizeBtn.innerHTML;
    
    try {
      // Show loading state
      summarizeBtn.innerHTML = '<span>Loading...</span>';
      summarizeBtn.disabled = true;
      
      const settings = await getSettings();
      const pageURL = await getPageUrl();

      // Check cache first
      const cachedSummary = await getCachedSummary(pageURL);
      if (cachedSummary) {
        await incrementCounter();
        return showSummary(cachedSummary);
      }

      const combinedBlacklist = [settings.defaultBlacklistedUrls, settings.blacklistedUrls].join(';');

      if (isDomainBlacklisted(combinedBlacklist, pageURL)) {
        throw new Error("This is a restricted domain. Summarization is not allowed on this site.");
      }

      const content = await getPageContent();
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

      // Cache the summary
      await cacheSummary(pageURL, summary);
      
      await incrementCounter();
      showSummary(summary);

    } catch (err) {
      console.error("Summarize error:", err);
      showNotification(`${err.message}`, "error");
    } finally {
      // Restore button state
      summarizeBtn.innerHTML = originalBtnText;
      summarizeBtn.disabled = false;
    }
  });
});

function showSummary(summaryText) {
  const encoded = encodeURIComponent(summaryText);
  chrome.tabs.create({ url: chrome.runtime.getURL(`results.html?text=${encoded}`) });
}

// Show notification function
function showNotification(message, type) {
  const notification = document.getElementById("notification");
  if (!notification) return;
  
  notification.textContent = message;
  notification.className = `notification ${type} show`;
  
  setTimeout(() => {
    notification.classList.remove("show");
  }, 3000);
}

async function incrementCounter() {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.get(['pageCount'], (result) => {
      if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
      const currentCount = result.pageCount || 0;
      const newCount = currentCount + 1;
      chrome.storage.sync.set({ pageCount: newCount }, () => {
        if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
        console.log('Page count updated to', newCount);
        resolve(newCount);
      });
    });
  });
}

async function updateCounterDisplay() {
  const result = await new Promise(resolve => chrome.storage.sync.get(['pageCount'], resolve));
  const count = result.pageCount || 0;
  document.getElementById("pagesSummarized").textContent = count;
}

// Cache functions
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes in milliseconds

async function getCachedSummary(url) {
  try {
    const result = await chrome.storage.local.get(['summaryCache']);
    const cache = result.summaryCache || {};
    
    const cachedItem = cache[url];
    if (!cachedItem) return null;
    
    const now = Date.now();
    if (now - cachedItem.timestamp > CACHE_DURATION) {
      // Expired, remove from cache
      delete cache[url];
      await chrome.storage.local.set({ summaryCache: cache });
      return null;
    }
    
    return cachedItem.summary;
  } catch (error) {
    console.error("Error retrieving cached summary:", error);
    return null;
  }
}

async function cacheSummary(url, summary) {
  try {
    const result = await chrome.storage.local.get(['summaryCache']);
    const cache = result.summaryCache || {};
    
    cache[url] = {
      summary,
      timestamp: Date.now()
    };
    
    // Keep cache size manageable
    const urls = Object.keys(cache);
    if (urls.length > 100) {
      // Remove oldest entries
      const sortedUrls = urls.sort((a, b) => cache[b].timestamp - cache[a].timestamp);
      for (let i = 100; i < sortedUrls.length; i++) {
        delete cache[sortedUrls[i]];
      }
    }
    
    await chrome.storage.local.set({ summaryCache: cache });
  } catch (error) {
    console.error("Error caching summary:", error);
  }
}
