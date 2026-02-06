import { getPageContent, getPageUrl } from './utils/contentExtractor.js';
import { saveSummaryForView } from './utils/summaryStore.js';
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
      
      const pageURL = await getPageUrl();

      const pageData = await getPageContent();
      if (!pageData?.content) {
        throw new Error("No content found on this page. Please try another page.");
      }

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
      showNotification(`${err.message}`, "error");
    } finally {
      // Restore button state
      summarizeBtn.innerHTML = originalBtnText;
      summarizeBtn.disabled = false;
    }
  });
});

/**
 * Open the results page with a stored summary.
 * @param {string} summaryText
 * @param {{ title?: string, sourceUrl?: string }} meta
 */
async function showSummary(summaryText, meta = {}) {
  try {
    const id = await saveSummaryForView(summaryText, meta);
    platform.tabs.create({ url: platform.runtime.getURL(`results.html?id=${encodeURIComponent(id)}`) });
  } catch (error) {
    const encoded = encodeURIComponent(summaryText);
    platform.tabs.create({ url: platform.runtime.getURL(`results.html?text=${encoded}`) });
  }
}

/**
 * Show a transient notification message.
 * @param {string} message
 * @param {"success"|"error"} type
 */
function showNotification(message, type = "info") {
  const notification = document.getElementById("notification");
  if (!notification) return;

  const colors = {
    error: '#b91c1c',
    warning: '#b45309',
    success: '#15803d',
    info: '#1f2937'
  };
  notification.textContent = message;
  notification.style.cssText = [
    'position:fixed',
    'top:20px',
    'right:20px',
    'z-index:2147483647',
    'max-width:360px',
    'color:#fff',
    'padding:12px 14px',
    'border-radius:8px',
    'font:12px/1.4 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Arial,sans-serif',
    'box-shadow:0 6px 18px rgba(0,0,0,0.2)',
    `background:${colors[type] || colors.info}`
  ].join(';');
  notification.className = `notification ${type} show`;

  if (window.__PAGE_SUMMARIZER_TOAST_TIMER) {
    window.clearTimeout(window.__PAGE_SUMMARIZER_TOAST_TIMER);
  }
  window.__PAGE_SUMMARIZER_TOAST_TIMER = window.setTimeout(() => {
    notification.classList.remove("show");
  }, 3000);
}

/**
 * Increment the "pages summarized" counter.
 * @returns {Promise<number>}
 */
async function incrementCounter() {
  const result = await platform.storage.get('sync', ['pageCount']);
  const currentCount = result.pageCount || 0;
  const newCount = currentCount + 1;
  await platform.storage.set('sync', { pageCount: newCount });
  console.log('Page count updated to', newCount);
  return newCount;
}

/**
 * Refresh the counter display from sync storage.
 * @returns {Promise<void>}
 */
async function updateCounterDisplay() {
  const result = await platform.storage.get('sync', ['pageCount']);
  const count = result.pageCount || 0;
  document.getElementById("pagesSummarized").textContent = count;
}
