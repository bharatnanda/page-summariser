import { getPageContent } from './utils/contentExtractor.js';
import { saveSummaryForView } from './utils/summaryStore.js';
import { showNotification } from './utils/notification.js';
import { platform } from './platform.js';

document.addEventListener("DOMContentLoaded", async () => {
  const notification = document.getElementById("notification");
  await updateCounterDisplay();

  document.getElementById("settingsBtn").addEventListener("click", () => {
    platform.runtime.openOptionsPage();
  });

  document.getElementById("historyBtn").addEventListener("click", () => {
    platform.tabs.create({ url: platform.runtime.getURL('history.html') });
  });

  document.getElementById("summarizeBtn").addEventListener("click", async () => {
    const summarizeBtn = document.getElementById("summarizeBtn");
    const originalBtnText = summarizeBtn.innerHTML;
    
    try {
      // Show loading state
      summarizeBtn.innerHTML = '<span>Loading...</span>';
      summarizeBtn.disabled = true;
      
      const pageData = await getPageContent();
      if (!pageData?.content) {
        throw new Error("No content found on this page. Please try another page.");
      }
      const pageURL = pageData.sourceUrl || "";

      const response = await platform.runtime.sendMessage({
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
      showNotification(notification, `${err.message}`, "error");
    } finally {
      // Restore button state
      summarizeBtn.innerHTML = originalBtnText;
      summarizeBtn.disabled = false;
    }
  });
});

/**
 * Refresh the counter display from sync storage.
 * @returns {Promise<void>}
 */
async function updateCounterDisplay() {
  const result = await platform.storage.get('sync', ['pageCount']);
  const count = result.pageCount || 0;
  document.getElementById("pagesSummarized").textContent = count;
}
