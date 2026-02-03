import { loadSummaryForView } from './utils/summaryStore.js';
import { addHistoryItem, createHistoryItem } from './utils/historyStore.js';

function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

document.addEventListener("DOMContentLoaded", async () => {
  const container = document.getElementById("summary");
  const copyBtn = document.getElementById("copyBtn");
  const downloadBtn = document.getElementById("downloadBtn");
  const saveBtn = document.getElementById("saveBtn");
  const historyBtn = document.getElementById("historyBtn");
  const notification = document.getElementById("notification");

  // Get summary text from URL query params
  const params = new URLSearchParams(window.location.search);
  const rawText = params.get("text");
  const summaryId = params.get("id");
  let decodedText = "No summary available.";

  try {
    if (summaryId) {
      const stored = await loadSummaryForView(summaryId);
      if (stored) {
        decodedText = stored;
      }
    } else if (rawText) {
      decodedText = decodeURIComponent(rawText);
    }
  } catch (err) {
    console.error("Failed to decode URI component:", err);
    decodedText = rawText || decodedText;
  }

  // Render markdown if available
  if (window.marked) {
    const renderer = new marked.Renderer();
    renderer.html = (text) => escapeHtml(text);
    container.innerHTML = marked.parse(decodedText, {
      breaks: true,
      renderer,
      mangle: false,
      headerIds: false
    });
  } else {
    container.textContent = decodedText;
  }

  // Copy summary to clipboard
  copyBtn?.addEventListener("click", () => {
    navigator.clipboard.writeText(decodedText)
      .then(() => showNotification("Summary copied to clipboard!", "success"))
      .catch(err => {
        console.error("Clipboard error:", err);
        showNotification("Failed to copy summary", "error");
      });
  });

  // Download summary as .md file
  downloadBtn?.addEventListener("click", () => {
    const blob = new Blob([decodedText], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "summary.md";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    
    showNotification("Summary downloaded!", "success");
  });

  // Save summary to history
  saveBtn?.addEventListener("click", async () => {
    try {
      let sourceUrl = null;
      const sourceMatch = decodedText.match(/https?:\/\/[^\s]+/);
      if (sourceMatch) {
        const sourceText = sourceMatch[0].trim();
        // Remove angle brackets if present
        sourceUrl = sourceText.replace(/^<|>$/g, '');
      }

      // Use source URL from summary, or fall back to current tab URL
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const url = sourceUrl || tab?.url || "Unknown URL";
      
      // Create a history item
      const historyItem = createHistoryItem(url, decodedText);

      // Save to history
      const result = await addHistoryItem(historyItem);
      if (result.status === 'duplicate') {
        showNotification("Summary already in history.", "success");
        return;
      }
      if (result.status === 'saved_trimmed') {
        showNotification("History saved (trimmed to fit storage).", "success");
        return;
      }
      showNotification("Summary saved to history!", "success");
    } catch (error) {
      console.error("Error saving to history:", error);
      showNotification("Failed to save summary", "error");
    }
  });

  // History button functionality
  historyBtn?.addEventListener("click", () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('history.html') });
  });

  // Show notification function
  function showNotification(message, type) {
    notification.textContent = message;
    notification.className = `notification ${type} show`;
    
    setTimeout(() => {
      notification.classList.remove("show");
    }, 3000);
  }
  
});
