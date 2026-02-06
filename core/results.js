import { loadSummaryForView } from './utils/summaryStore.js';
import { platform } from './platform.js';

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
  const historyBtn = document.getElementById("historyBtn");
  const notification = document.getElementById("notification");
  const articleMeta = document.getElementById("articleMeta");
  const articleTitle = document.getElementById("articleTitle");
  const articleSource = document.getElementById("articleSource");
  const summaryMetrics = document.getElementById("summaryMetrics");

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
    updateWordCount(text);
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
    const port = platform.runtime.connect({ name: `summaryStream:${streamId}` });
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
          const url = platform.runtime.getURL(`results.html?id=${encoded}`);
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

  // History button functionality
  historyBtn?.addEventListener("click", () => {
    platform.tabs.create({ url: platform.runtime.getURL('history.html') });
  });

  // Show notification function
  /**
   * Show a transient notification.
   * @param {string} message
   * @param {"success"|"error"} type
   */
  function showNotification(message, type = "info") {
    const colors = {
      error: '#b91c1c',
      warning: '#b45309',
      success: '#15803d',
      info: '#1f2937'
    };
    if (!notification) return;
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

  function updateWordCount(text) {
    if (!summaryMetrics) return;
    const words = (text || "").trim().match(/\S+/g);
    const count = words ? words.length : 0;
    summaryMetrics.textContent = `Word count: ${count}`;
  }
  
});
