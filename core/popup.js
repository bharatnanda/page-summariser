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
    const labelNode = summarizeBtn.querySelector("span");
    const originalBtnText = labelNode?.textContent || summarizeBtn.textContent;
    
    try {
      // Show loading state
      if (labelNode) {
        labelNode.textContent = "Loading...";
      } else {
        summarizeBtn.textContent = "Loading...";
      }
      summarizeBtn.disabled = true;

      const response = await platform.runtime.sendMessage({
        action: "summarize",
        incrementCounter: true
      });
      if (response?.status === "error") {
        throw new Error(response.message || "Failed to start summarization.");
      }

    } catch (err) {
      console.error("Summarize error:", err);
      showNotification(notification, `${err.message}`, "error");
    } finally {
      // Restore button state
      if (labelNode) {
        labelNode.textContent = originalBtnText;
      } else {
        summarizeBtn.textContent = originalBtnText;
      }
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
