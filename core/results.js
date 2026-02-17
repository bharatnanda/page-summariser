import { loadSummaryForView } from './utils/summaryStore.js';
import { findHistoryItemBySummaryId, loadSummaryForHistory } from './utils/historyStore.js';
import { showNotification } from './utils/notification.js';
import { platform } from './platform.js';

/**
 * Escape HTML to prevent rendering raw markup in the summary view.
 * @param {string} value
 * @returns {string}
 */
function escapeHtml(value) {
  return String(value ?? "")
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
  const articleProviderModel = document.getElementById("articleProviderModel");
  const summaryMetrics = document.getElementById("summaryMetrics");

  // Get summary text from URL query params
  const params = new URLSearchParams(window.location.search);
  const rawText = params.get("text");
  const summaryId = params.get("id");
  const historyId = params.get("historyId");
  const streamId = params.get("streamId");
  let decodedText = "No summary available.";
  let summaryMeta = { title: "", sourceUrl: "", provider: "", model: "" };

  const renderer = window.marked ? new marked.Renderer() : null;
  if (renderer) {
    renderer.html = (text) => escapeHtml(text);
    renderer.link = (href, title, text) => {
      const safeHref = isSafeLink(href) ? href : "";
      const safeText = escapeHtml(text);
      if (!safeHref) {
        return safeText;
      }
      const titleAttr = title ? ` title="${escapeHtml(title)}"` : "";
      return `<a href="${safeHref}"${titleAttr} target="_blank" rel="noopener noreferrer">${safeText}</a>`;
    };
  }

  /**
   * Render markdown or plain text summary.
   * @param {string} text
   */
  function renderSummary(text) {
    if (window.marked) {
      const mathProtected = protectMath(text);
      const html = marked.parse(mathProtected.text, {
        breaks: true,
        renderer,
        mangle: false,
        headerIds: false
      });
      const parsed = new DOMParser().parseFromString(html, "text/html");
      const fragment = document.createDocumentFragment();
      Array.from(parsed.body.childNodes).forEach((node) => {
        fragment.appendChild(node);
      });
      container.replaceChildren(fragment);
      restoreMathPlaceholders(container, mathProtected.placeholders);
      renderMath(container);
    } else {
      container.textContent = text;
    }
    updateWordCount(text);
  }

  try {
    if (streamId) {
      const indicator = document.createElement("span");
      indicator.className = "streaming-indicator";
      indicator.textContent = "Streaming summary";
      container.replaceChildren(indicator);
      decodedText = "";
    } else if (historyId) {
      const [historySummary, historyItem] = await Promise.all([
        loadSummaryForHistory(historyId),
        findHistoryItemBySummaryId(historyId)
      ]);
      if (historySummary) {
        decodedText = historySummary;
      } else if (historyItem?.summary) {
        decodedText = historyItem.summary;
      }
      if (historyItem) {
        summaryMeta = {
          title: historyItem.title || "",
          sourceUrl: historyItem.sourceUrl || historyItem.url || "",
          provider: historyItem.provider || "",
          model: historyItem.model || ""
        };
      }
    } else if (summaryId) {
      const stored = await loadSummaryForView(summaryId);
      if (stored?.summary) {
        decodedText = stored.summary;
        summaryMeta = {
          title: stored.title || "",
          sourceUrl: stored.sourceUrl || "",
          provider: stored.provider || "",
          model: stored.model || ""
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
          sourceUrl: message.sourceUrl || summaryMeta.sourceUrl,
          provider: summaryMeta.provider,
          model: summaryMeta.model
        };
        renderMeta(summaryMeta);
        if (message.summaryId) {
          const encoded = encodeURIComponent(message.summaryId);
          const url = platform.runtime.getURL(`results.html?id=${encoded}`);
          window.history.replaceState(null, "", url);
          loadMetaFromStore(message.summaryId);
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
      .then(() => showNotification(notification, "Summary copied to clipboard!", "success"))
      .catch(err => {
        console.error("Clipboard error:", err);
        showNotification(notification, "Failed to copy summary", "error");
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
    
    showNotification(notification, "Summary downloaded!", "success");
  });

  // History button functionality
  historyBtn?.addEventListener("click", () => {
    platform.tabs.create({ url: platform.runtime.getURL('history.html') });
  });

  /**
   * Render article metadata.
   * @param {{ title?: string, sourceUrl?: string, provider?: string, model?: string }} meta
   */
  function renderMeta(meta) {
    if (!articleMeta) return;
    const hasTitle = Boolean(meta?.title);
    const hasSource = Boolean(meta?.sourceUrl);
    const hasProviderModel = Boolean((meta?.provider || "").trim() || (meta?.model || "").trim());
    if (!hasTitle && !hasSource && !hasProviderModel) {
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
    if (articleProviderModel) {
      if (hasProviderModel) {
        articleProviderModel.textContent = [meta.provider, meta.model].filter(Boolean).join(" • ");
        articleProviderModel.hidden = false;
      } else {
        articleProviderModel.textContent = "";
        articleProviderModel.hidden = true;
      }
    }
    articleMeta.hidden = false;
  }

  async function loadMetaFromStore(id) {
    try {
      const stored = await loadSummaryForView(id);
      if (stored?.summary) {
        summaryMeta = {
          title: stored.title || summaryMeta.title,
          sourceUrl: stored.sourceUrl || summaryMeta.sourceUrl,
          provider: stored.provider || summaryMeta.provider,
          model: stored.model || summaryMeta.model
        };
        renderMeta(summaryMeta);
      }
    } catch (error) {
      // Ignore summary store errors.
    }
  }

  function updateWordCount(text) {
    if (!summaryMetrics) return;
    const words = (text || "").trim().match(/\S+/g);
    const count = words ? words.length : 0;
    summaryMetrics.textContent = `Word count: ${count}`;
  }

  function protectMath(input) {
    const placeholders = [];
    if (!input) return { text: "", placeholders };

    const fenceSplit = input.split("```");
    const processed = fenceSplit.map((segment, index) => {
      if (index % 2 === 1) {
        return segment;
      }
      return protectMathInSegment(segment, placeholders);
    });

    return { text: processed.join("```"), placeholders };
  }

  function protectMathInSegment(segment, placeholders) {
    let result = "";
    let i = 0;
    while (i < segment.length) {
      const char = segment[i];
      if (char === "`") {
        const end = segment.indexOf("`", i + 1);
        if (end !== -1) {
          result += segment.slice(i, end + 1);
          i = end + 1;
          continue;
        }
      }

      if (segment.startsWith("$$", i)) {
        const end = findMathEnd(segment, i + 2, "$$");
        if (end !== -1) {
          const math = segment.slice(i, end + 2);
          result += addMathPlaceholder(math, placeholders);
          i = end + 2;
          continue;
        }
      }

      if (char === "$" && !segment.startsWith("$$", i)) {
        const end = findMathEnd(segment, i + 1, "$");
        if (end !== -1) {
          const math = segment.slice(i, end + 1);
          result += addMathPlaceholder(math, placeholders);
          i = end + 1;
          continue;
        }
      }

      result += char;
      i += 1;
    }
    return result;
  }

  function findMathEnd(text, startIndex, delimiter) {
    let i = startIndex;
    while (i < text.length) {
      if (delimiter === "$$" && text.startsWith("$$", i)) {
        if (!isEscaped(text, i)) return i;
        i += 2;
        continue;
      }
      if (delimiter === "$" && text[i] === "$") {
        if (!isEscaped(text, i)) return i;
      }
      i += 1;
    }
    return -1;
  }

  function isEscaped(text, index) {
    let backslashes = 0;
    let i = index - 1;
    while (i >= 0 && text[i] === "\\") {
      backslashes += 1;
      i -= 1;
    }
    return backslashes % 2 === 1;
  }

  function addMathPlaceholder(math, placeholders) {
    const token = `@@MATH_${placeholders.length}@@`;
    placeholders.push(math);
    return token;
  }

  function restoreMathPlaceholders(container, placeholders) {
    if (!container || placeholders.length === 0) return;
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    const replacements = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (!node.nodeValue || !node.nodeValue.includes("@@MATH_")) continue;
      replacements.push(node);
    }

    replacements.forEach((textNode) => {
      const value = textNode.nodeValue || "";
      const fragment = document.createDocumentFragment();
      let cursor = 0;
      const regex = /@@MATH_(\d+)@@/g;
      let match;
      while ((match = regex.exec(value)) !== null) {
        if (match.index > cursor) {
          fragment.appendChild(document.createTextNode(value.slice(cursor, match.index)));
        }
        const index = Number(match[1]);
        const math = placeholders[index] ?? match[0];
        fragment.appendChild(document.createTextNode(math));
        cursor = match.index + match[0].length;
      }
      if (cursor < value.length) {
        fragment.appendChild(document.createTextNode(value.slice(cursor)));
      }
      textNode.parentNode?.replaceChild(fragment, textNode);
    });
  }

  function renderMath(target) {
    if (!target || typeof window.renderMathInElement !== "function") return;
    try {
      window.renderMathInElement(target, {
        delimiters: [
          { left: "$$", right: "$$", display: true },
          { left: "$", right: "$", display: false },
          { left: "\\(", right: "\\)", display: false },
          { left: "\\[", right: "\\]", display: true }
        ],
        throwOnError: false
      });
    } catch (err) {
      console.error("KaTeX render error:", err);
    }
  }
  
});

/**
 * Allow only http/https links in rendered markdown.
 * @param {string} href
 * @returns {boolean}
 */
function isSafeLink(href) {
  if (!href) return false;
  try {
    const url = new URL(href, "https://example.com");
    if (!url.protocol || url.protocol === "javascript:") return false;
    return url.protocol === "http:" || url.protocol === "https:";
  } catch (error) {
    return false;
  }
}
