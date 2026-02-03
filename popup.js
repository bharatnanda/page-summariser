import { getPageContent, getPageUrl } from './utils/contentExtractor.js';
import { getSettings } from './utils/settings.js';
import { combineBlacklists, isDomainBlacklisted } from './utils/domainBlacklist.js';
import { getCachedSummary } from './utils/cache.js';
import { saveSummaryForView } from './utils/summaryStore.js';

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

      const combinedBlacklist = combineBlacklists(
        settings.defaultBlacklistedUrls,
        settings.blacklistedUrls
      );

      if (isDomainBlacklisted(combinedBlacklist, pageURL)) {
        throw new Error("This is a restricted domain. Summarization is not allowed on this site.");
      }

      const pageData = await getPageContent();
      if (!pageData?.content) {
        throw new Error("No content found on this page. Please try another page.");
      }

      if (!settings.apiKey && settings.provider !== "ollama") {
        throw new Error("API key is missing. Please set your API key in the extension settings.");
      }

      const response = await chrome.runtime.sendMessage({
        action: "streamSummary",
        content: pageData.content,
        pageURL,
        title: pageData.title,
        incrementCounter: true,
        cacheKey: pageURL
      });
      if (response?.status === "error") {
        throw new Error(response.message || "Failed to start streaming summary.");
      }

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

async function showSummary(summaryText) {
  try {
    const id = await saveSummaryForView(summaryText);
    chrome.tabs.create({ url: chrome.runtime.getURL(`results.html?id=${encodeURIComponent(id)}`) });
  } catch (error) {
    const encoded = encodeURIComponent(summaryText);
    chrome.tabs.create({ url: chrome.runtime.getURL(`results.html?text=${encoded}`) });
  }
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
