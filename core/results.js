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
  const closeBtn = document.getElementById("closeBtn");
  const copyBtn = document.getElementById("copyBtn");
  const downloadBtn = document.getElementById("downloadBtn");
  const historyBtn = document.getElementById("historyBtn");
  const notification = document.getElementById("notification");
  const articleMeta = document.getElementById("articleMeta");
  const articleTitle = document.getElementById("articleTitle");
  const articleSource = document.getElementById("articleSource");
  const articleProviderModel = document.getElementById("articleProviderModel");
  const summaryMetrics = document.getElementById("summaryMetrics");

  // TTS elements — inline strip
  const ttsStrip = document.getElementById("ttsStrip");
  const ttsStripLabel = document.getElementById("ttsStripLabel");
  const ttsTrack = document.getElementById("ttsTrack");
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

  /** Switch strip to active (playing) state: show track, hide idle label, show stop button. */
  function enterActiveState() {
    if (ttsStripLabel) ttsStripLabel.hidden = true;
    if (ttsTrack) ttsTrack.hidden = false;
    if (ttsClose) ttsClose.hidden = false;
  }

  /** Switch strip back to idle state: hide track, show idle label, hide stop button. */
  function enterIdleState() {
    if (ttsStripLabel) ttsStripLabel.hidden = false;
    if (ttsTrack) ttsTrack.hidden = true;
    if (ttsClose) ttsClose.hidden = true;
    if (ttsProgressFill) ttsProgressFill.style.width = "0%";
    if (ttsTime) ttsTime.textContent = "0:00";
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
    if (state === "playing") enterActiveState();
  };

  tts.onTick = (elapsed, fraction) => {
    if (ttsTime) ttsTime.textContent = formatTime(elapsed);
    if (ttsProgressFill) ttsProgressFill.style.width = `${Math.round(fraction * 100)}%`;
    if (ttsProgressBar) ttsProgressBar.setAttribute("aria-valuenow", Math.round(fraction * 100));
  };

  tts.onEnd = () => {
    enterIdleState();
    syncPlayPauseIcon("idle");
  };

  if (ttsStrip) {
    if (!tts.supported) {
      // Keep strip hidden on browsers without Web Speech API.
      ttsStrip.hidden = true;
    }
    // Strip is revealed by JS after summary is ready (see below).
  }

  if (ttsPlayPause) {
    ttsPlayPause.addEventListener("click", () => {
      if (tts.state === "playing") {
        tts.pause();
        syncPlayPauseIcon("paused");
      } else if (tts.state === "paused") {
        tts.resume();
      } else {
        // Start or restart
        enterActiveState();
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
      enterIdleState();
      syncPlayPauseIcon("idle");
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
    // Summary already complete — reveal the TTS strip.
    if (ttsStrip && tts.supported) ttsStrip.hidden = false;
  }

  if (streamId) {
    // Show strip immediately in streaming mode with disabled play button and "loading" label.
    if (ttsStrip && tts.supported) {
      ttsStrip.hidden = false;
      if (ttsPlayPause) ttsPlayPause.disabled = true;
      if (ttsStripLabel) ttsStripLabel.textContent = "Available when ready\u2026";
    }

    const port = platform.runtime.connect({ name: `summaryStream:${streamId}` });
    port.onMessage.addListener((message) => {
      if (!message) return;
      if (message.type === "delta") {
        decodedText = `${decodedText}${message.delta}`;
        renderSummary(decodedText);
        if (ttsSpeakOnStream && tts.supported) {
          // Feed growing text; TTSPlayer queues complete sentences.
          enterActiveState();
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
        // Streaming done — unlock the strip.
        if (ttsPlayPause) ttsPlayPause.disabled = false;
        if (ttsStripLabel) ttsStripLabel.textContent = "Listen to summary";
        if (ttsSpeakOnStream && tts.supported) {
          tts.flushRemaining();
        }
        return;
      }
      if (message.type === "error") {
        decodedText = message.message || "Failed to generate summary.";
        renderSummary(decodedText);
        // Unlock strip even on error so user can attempt to listen.
        if (ttsPlayPause) ttsPlayPause.disabled = false;
        if (ttsStripLabel) ttsStripLabel.textContent = "Listen to summary";
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

  // Close button — go back if navigated from history, otherwise close this tab
  closeBtn?.addEventListener("click", () => {
    if (history.length > 1) {
      window.history.back();
      return;
    }
    // window.close() is blocked for extension tabs not opened via window.open().
    // Use the extension tabs API to close the current tab instead.
    const api = platform.api;
    if (api?.tabs?.getCurrent) {
      api.tabs.getCurrent((tab) => {
        if (tab?.id) api.tabs.remove(tab.id);
      });
    } else {
      window.close(); // fallback for environments where tabs API is unavailable
    }
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
        let displayUrl = meta.sourceUrl;
        try { displayUrl = new URL(meta.sourceUrl).hostname.replace(/^www\./, ""); } catch (_) {}
        articleSource.textContent = displayUrl;
        articleSource.href = meta.sourceUrl;
        articleSource.title = meta.sourceUrl;
      } else {
        articleSource.textContent = "Unknown source";
        articleSource.removeAttribute("href");
        articleSource.removeAttribute("title");
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
