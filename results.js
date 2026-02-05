import { loadSummaryForView } from './utils/summaryStore.js';
import { addHistoryItem, createHistoryItem } from './utils/historyStore.js';

/**
 * Escape HTML to prevent rendering raw markup in the summary view.
 * @param {string} value
 * @returns {string}
 */
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
  const articleMeta = document.getElementById("articleMeta");
  const articleTitle = document.getElementById("articleTitle");
  const articleSource = document.getElementById("articleSource");

  // Get summary text from URL query params
  const params = new URLSearchParams(window.location.search);
  const rawText = params.get("text");
  const summaryId = params.get("id");
  const streamId = params.get("streamId");
  let decodedText = "No summary available.";
  let summaryMeta = { title: "", sourceUrl: "" };

  const renderer = window.marked ? new marked.Renderer() : null;
  if (renderer) {
    renderer.html = (text) => escapeHtml(text);
  }

  /**
   * Render markdown or plain text summary.
   * @param {string} text
   */
  function renderSummary(text) {
    if (window.marked) {
      container.innerHTML = marked.parse(text, {
        breaks: true,
        renderer,
        mangle: false,
        headerIds: false
      });
    } else {
      container.textContent = text;
    }
  }

  try {
    if (streamId) {
      container.innerHTML = '<span class="streaming-indicator">Streaming summary</span>';
      decodedText = "";
    } else if (summaryId) {
      const stored = await loadSummaryForView(summaryId);
      if (stored?.summary) {
        decodedText = stored.summary;
        summaryMeta = {
          title: stored.title || "",
          sourceUrl: stored.sourceUrl || ""
        };
      } else if (typeof stored === "string") {
        decodedText = stored;
      }
    } else if (rawText) {
      decodedText = decodeURIComponent(rawText);
      renderMeta(summaryMeta);
    }
  } catch (err) {
    console.error("Failed to decode URI component:", err);
    decodedText = rawText || decodedText;
  }

  if (!streamId) {
    renderSummary(decodedText);
    renderMeta(summaryMeta);
  }

  if (streamId) {
    const port = chrome.runtime.connect({ name: `summaryStream:${streamId}` });
    port.onMessage.addListener((message) => {
      if (!message) return;
      if (message.type === "delta") {
        decodedText = `${decodedText}${message.delta}`;
        renderSummary(decodedText);
        return;
      }
      if (message.type === "done") {
        if (message.summary) {
          decodedText = message.summary;
          renderSummary(decodedText);
        }
        summaryMeta = {
          title: message.title || summaryMeta.title,
          sourceUrl: message.sourceUrl || summaryMeta.sourceUrl
        };
        renderMeta(summaryMeta);
        if (message.summaryId) {
          const encoded = encodeURIComponent(message.summaryId);
          const url = chrome.runtime.getURL(`results.html?id=${encoded}`);
          window.history.replaceState(null, "", url);
        }
        return;
      }
      if (message.type === "error") {
        decodedText = message.message || "Failed to generate summary.";
        renderSummary(decodedText);
      }
    });
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
      let sourceUrl = summaryMeta.sourceUrl || null;
      const title = summaryMeta.title || "";

      // Use source URL from meta, or fall back to current tab URL
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const url = sourceUrl || tab?.url || "Unknown URL";
      
      // Create a history item
      const historyItem = createHistoryItem(url, decodedText, title);

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
  /**
   * Show a transient notification.
   * @param {string} message
   * @param {"success"|"error"} type
   */
  function showNotification(message, type) {
    notification.textContent = message;
    notification.className = `notification ${type} show`;
    
    setTimeout(() => {
      notification.classList.remove("show");
    }, 3000);
  }

  /**
   * Render article metadata.
   * @param {{ title?: string, sourceUrl?: string }} meta
   */
  function renderMeta(meta) {
    if (!articleMeta) return;
    const hasTitle = Boolean(meta?.title);
    const hasSource = Boolean(meta?.sourceUrl);
    if (!hasTitle && !hasSource) {
      articleMeta.hidden = true;
      return;
    }
    if (articleTitle) {
      articleTitle.textContent = meta.title || "Untitled";
    }
    if (articleSource) {
      if (meta.sourceUrl) {
        articleSource.textContent = meta.sourceUrl;
        articleSource.href = meta.sourceUrl;
      } else {
        articleSource.textContent = "Unknown source";
        articleSource.removeAttribute("href");
      }
    }
    articleMeta.hidden = false;
  }
  
});
