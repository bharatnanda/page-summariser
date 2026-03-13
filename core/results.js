import { loadSummaryForView } from './utils/summaryStore.js';
import { showNotification } from './utils/notification.js';
import { platform } from './platform.js';
import { TTSPlayer, formatTime } from './utils/tts.js';

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

  // TTS elements
  const ttsListenBtn = document.getElementById("ttsListenBtn");
  const ttsPlayer = document.getElementById("ttsPlayer");
  const ttsPlayPause = document.getElementById("ttsPlayPause");
  const ttsPlayIcon = document.getElementById("ttsPlayIcon");
  const ttsPauseIcon = document.getElementById("ttsPauseIcon");
  const ttsTime = document.getElementById("ttsTime");
  const ttsProgressFill = document.getElementById("ttsProgressFill");
  const ttsProgressBar = document.getElementById("ttsProgressBar");
  const ttsSpeed = document.getElementById("ttsSpeed");
  const ttsClose = document.getElementById("ttsClose");

  // Read TTS setting directly from storage (avoids pulling in full settings/migrations machinery).
  const ttsStorageResult = await platform.storage.get('sync', ['ttsSpeakOnStream']);
  const ttsSpeakOnStream = Boolean(ttsStorageResult?.ttsSpeakOnStream);

  const tts = new TTSPlayer();

  /** Show/hide the player bar and sync play/pause icon. */
  function showPlayer() {
    if (ttsPlayer) ttsPlayer.hidden = false;
  }

  function syncPlayPauseIcon(state) {
    if (!ttsPlayIcon || !ttsPauseIcon) return;
    ttsPlayIcon.hidden = state === "playing";
    ttsPauseIcon.hidden = state !== "playing";
    if (ttsPlayPause) {
      ttsPlayPause.setAttribute("aria-label", state === "playing" ? "Pause" : "Play");
    }
  }

  tts.onStateChange = (state) => {
    syncPlayPauseIcon(state);
    if (state === "idle") {
      if (ttsProgressFill) ttsProgressFill.style.width = "100%";
    }
  };

  tts.onTick = (elapsed, fraction) => {
    if (ttsTime) ttsTime.textContent = formatTime(elapsed);
    if (ttsProgressFill) ttsProgressFill.style.width = `${Math.round(fraction * 100)}%`;
    if (ttsProgressBar) ttsProgressBar.setAttribute("aria-valuenow", Math.round(fraction * 100));
  };

  tts.onEnd = () => {
    if (ttsTime) ttsTime.textContent = "0:00";
    if (ttsProgressFill) ttsProgressFill.style.width = "0%";
    syncPlayPauseIcon("idle");
  };

  if (ttsListenBtn) {
    // Hide the button entirely if Web Speech API is not available.
    if (!tts.supported) {
      ttsListenBtn.hidden = true;
    } else {
      ttsListenBtn.addEventListener("click", () => {
        if (ttsPlayer && !ttsPlayer.hidden) {
          // Player already visible — just focus it.
          ttsPlayPause?.focus();
          return;
        }
        showPlayer();
        tts.speakAll(decodedText);
      });
    }
  }

  if (ttsPlayPause) {
    ttsPlayPause.addEventListener("click", () => {
      if (tts.state === "playing") {
        tts.pause();
      } else if (tts.state === "paused") {
        tts.resume();
      } else {
        // Restarted after end
        tts.speakAll(decodedText);
      }
    });
  }

  if (ttsSpeed) {
    ttsSpeed.addEventListener("change", () => {
      tts.setRate(Number(ttsSpeed.value));
    });
  }

  if (ttsClose) {
    ttsClose.addEventListener("click", () => {
      tts.stop();
      if (ttsPlayer) ttsPlayer.hidden = true;
      if (ttsProgressFill) ttsProgressFill.style.width = "0%";
      if (ttsTime) ttsTime.textContent = "0:00";
    });
  }

  // Get summary text from URL query params
  const params = new URLSearchParams(window.location.search);
  const rawText = params.get("text");
  const summaryId = params.get("id");
  const streamId = params.get("streamId");
  let decodedText = "No summary available.";
  let summaryMeta = { title: "", sourceUrl: "", provider: "", model: "" };

  const renderer = window.marked ? new marked.Renderer() : null;
  if (renderer) {
    // marked v15 passes a token object instead of individual arguments
    renderer.html = ({ text }) => escapeHtml(text);
    renderer.link = ({ href, title, tokens }) => {
      const text = tokens.reduce((acc, t) => acc + (t.text || t.raw || ""), "");
      const safeHref = isSafeLink(href) ? href : "";
      const safeText = escapeHtml(text);
      if (!safeHref) {
        return safeText;
      }
      const titleAttr = title ? ` title="${escapeHtml(title)}"` : "";
      return `<a href="${safeHref}"${titleAttr} target="_blank" rel="noopener noreferrer">${safeText}</a>`;
    };
  }

  // Register marked extensions to render math before markdown processes underscores/asterisks.
  // This must run once; guard against repeated DOMContentLoaded re-registration.
  if (window.marked && window.katex && !marked._mathExtensionRegistered) {
    marked._mathExtensionRegistered = true;
    marked.use({
      extensions: [
        {
          name: 'blockMath',
          level: 'block',
          start(src) { return src.indexOf('$$'); },
          tokenizer(src) {
            const match = src.match(/^\$\$([\s\S]+?)\$\$/);
            if (match) {
              return { type: 'blockMath', raw: match[0], text: match[1] };
            }
          },
          renderer(token) {
            try {
              return katex.renderToString(token.text, { displayMode: true, throwOnError: false });
            } catch (e) {
              return `<pre>$$${token.text}$$</pre>`;
            }
          }
        },
        {
          name: 'inlineMath',
          level: 'inline',
          start(src) { return src.indexOf('$'); },
          tokenizer(src) {
            const match = src.match(/^\$([^$\n]+?)\$/);
            if (match) {
              return { type: 'inlineMath', raw: match[0], text: match[1] };
            }
          },
          renderer(token) {
            try {
              return katex.renderToString(token.text, { displayMode: false, throwOnError: false });
            } catch (e) {
              return `<code>$${token.text}$</code>`;
            }
          }
        }
      ]
    });
  }

  // Hide skeleton loader on first render
  let skeletonHidden = false;
  function hideSkeleton() {
    if (!skeletonHidden) {
      const skeleton = document.getElementById("summarySkeletonLoader");
      if (skeleton) skeleton.hidden = true;
      skeletonHidden = true;
    }
  }

  /**
   * Render markdown or plain text summary.
   * @param {string} text
   */
  function renderSummary(text) {
    // Normalize alternate math delimiters to $...$ / $$...$$ so the marked
    // extension handles them before markdown processes underscores/asterisks.
    // \[...\] → $$...$$, \(...\) → $...$
    text = text
      .replace(/\\\[([\s\S]+?)\\\]/g, (_, m) => `$$${m}$$`)
      .replace(/\\\(([^)]+?)\\\)/g, (_, m) => `$${m}$`);
    if (window.marked) {
      const html = marked.parse(text, {
        breaks: true,
        renderer
      });
      const parsed = new DOMParser().parseFromString(html, "text/html");
      const fragment = document.createDocumentFragment();
      Array.from(parsed.body.childNodes).forEach((node) => {
        fragment.appendChild(node);
      });
      container.replaceChildren(fragment);
    } else {
      container.textContent = text;
    }
    // Handle \(...\) and \[...\] delimiters not covered by the marked extension.
    if (window.renderMathInElement) {
      renderMathInElement(container, {
        delimiters: [
          { left: "\\(", right: "\\)", display: false },
          { left: "\\[", right: "\\]", display: true }
        ],
        throwOnError: false
      });
    }
    hideSkeleton();
    updateWordCount(text);
  }

  try {
    if (streamId) {
      hideSkeleton();
      const indicator = document.createElement("div");
      indicator.className = "streaming-indicator";
      const dot = document.createElement("span");
      dot.className = "streaming-dot";
      const label = document.createElement("span");
      label.textContent = "Generating summary\u2026";
      indicator.appendChild(dot);
      indicator.appendChild(label);
      container.replaceChildren(indicator);
      decodedText = "";
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
    // Summary already complete — enable Listen button immediately.
    if (ttsListenBtn && tts.supported) ttsListenBtn.disabled = false;
  }

  if (streamId) {
    // In streaming mode: Listen button is disabled until the stream is done
    // (unless ttsSpeakOnStream is on, in which case TTS auto-starts on first delta).
    const port = platform.runtime.connect({ name: `summaryStream:${streamId}` });
    port.onMessage.addListener((message) => {
      if (!message) return;
      if (message.type === "delta") {
        decodedText = `${decodedText}${message.delta}`;
        renderSummary(decodedText);
        if (ttsSpeakOnStream && tts.supported) {
          // Show player and feed growing text; TTSPlayer queues complete sentences.
          showPlayer();
          tts.appendText(decodedText);
        }
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
        // Streaming done: flush any remaining unpunctuated text, then enable Listen button.
        if (ttsSpeakOnStream && tts.supported) {
          tts.flushRemaining();
        }
        if (ttsListenBtn && tts.supported) ttsListenBtn.disabled = false;
        return;
      }
      if (message.type === "error") {
        decodedText = message.message || "Failed to generate summary.";
        renderSummary(decodedText);
        if (ttsListenBtn && tts.supported) ttsListenBtn.disabled = false;
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
