import { loadSummaryForView, updateSummaryThread } from './utils/summaryStore.js';
import { showNotification } from './utils/notification.js';
import { platform } from './platform.js';
import { updateHistoryThread } from './utils/historyStore.js';
import { loadThemeAndApply } from './utils/theme.js';
import { createMarkdownRenderer } from './utils/markedown.js';

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

function normalizeStreamingText(text) {
  return String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n");
}

document.addEventListener("DOMContentLoaded", async () => {
  await loadThemeAndApply();
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
  const followupInput = document.getElementById("followupInput");
  const followupBtn = document.getElementById("followupBtn");
  const followupStatus = document.getElementById("followupStatus");
  const followupThread = document.getElementById("followupThread");
  const suggestionsEl = document.getElementById("suggestions");

  // Get summary text from URL query params
  const params = new URLSearchParams(window.location.search);
  const rawText = params.get("text");
  const summaryId = params.get("id");
  const streamId = params.get("streamId");
  let decodedText = "No summary available.";
  let summaryMeta = { title: "", sourceUrl: "", provider: "", model: "" };
  let currentSummaryId = summaryId || null;
  let hasFollowupContent = false;
  let currentHistoryId = null;
  let currentThread = [];
  let suggestionsRequested = false;
  let suggestionsLoaded = false;

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

  const markdownRenderer = createMarkdownRenderer(renderer);

  /**
   * Render markdown or plain text summary.
   * @param {string} text
   */
  function renderSummary(text) {
    markdownRenderer.renderMarkdownToContainer(container, text, updateWordCount);
  }

  try {
    if (streamId) {
      const indicator = document.createElement("span");
      indicator.className = "streaming-indicator";
      indicator.textContent = "Streaming summary";
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
        hasFollowupContent = Boolean(stored.content);
        currentHistoryId = stored.historyId || null;
        currentThread = Array.isArray(stored.thread) ? stored.thread : [];
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

  function renderThread() {
    if (!followupThread) return;
    followupThread.textContent = "";
    if (!currentThread.length) {
      if (suggestionsLoaded) {
        suggestionsEl.hidden = false;
      }
      return;
    }
    hideSuggestions();
    const fragment = document.createDocumentFragment();
    currentThread.forEach((item) => {
      const wrapper = document.createElement("div");
      wrapper.className = "followup-item";

      const questionMeta = document.createElement("div");
      questionMeta.className = "followup-meta";
      const questionAvatar = document.createElement("div");
      questionAvatar.className = "followup-avatar";
      questionAvatar.textContent = "👤";
      const questionRole = document.createElement("div");
      questionRole.className = "followup-role";
      questionRole.textContent = "You";
      questionMeta.appendChild(questionAvatar);
      questionMeta.appendChild(questionRole);

      const questionEl = document.createElement("div");
      questionEl.className = "followup-question";
      questionEl.textContent = item.question || "";

      const answerMeta = document.createElement("div");
      answerMeta.className = "followup-meta";
      const answerAvatar = document.createElement("img");
      answerAvatar.className = "followup-avatar";
      answerAvatar.src = "icon16.png";
      answerAvatar.alt = "Sumzy";
      const answerRole = document.createElement("div");
      answerRole.className = "followup-role";
      answerRole.textContent = "Sumzy";
      answerMeta.appendChild(answerAvatar);
      answerMeta.appendChild(answerRole);

      const answerEl = document.createElement("div");
      answerEl.className = "followup-answer";
      markdownRenderer.renderMarkdownToElement(answerEl, item.answer || "");

      wrapper.appendChild(questionMeta);
      wrapper.appendChild(questionEl);
      wrapper.appendChild(answerMeta);
      wrapper.appendChild(answerEl);
      fragment.appendChild(wrapper);
    });
    followupThread.appendChild(fragment);
  }

  renderThread();

  function hideSuggestions() {
    if (!suggestionsEl) return;
    suggestionsEl.hidden = true;
    suggestionsEl.textContent = "";
  }

  function renderSuggestions(suggestions) {
    if (!suggestionsEl) return;
    suggestionsEl.textContent = "";
    if (!Array.isArray(suggestions) || suggestions.length === 0) {
      suggestionsEl.hidden = true;
      return;
    }
    const fragment = document.createDocumentFragment();
    suggestions.forEach((suggestion) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "suggestion-chip";
      chip.textContent = suggestion;
      chip.addEventListener("click", () => {
        askFollowup(suggestion);
      });
      fragment.appendChild(chip);
    });
    suggestionsEl.appendChild(fragment);
    suggestionsEl.hidden = false;
  }

  async function requestSuggestions() {
    if (!currentSummaryId || !hasFollowupContent || suggestionsRequested || currentThread.length > 0) {
      return;
    }
    suggestionsRequested = true;
    try {
      const response = await platform.runtime.sendMessage({
        action: "suggestQuestions",
        summaryId: currentSummaryId
      });
      if (response?.status !== "ok") {
        return;
      }
      suggestionsLoaded = true;
      renderSuggestions(response.suggestions || []);
    } catch (error) {
      // Ignore suggestion errors.
    }
  }

  function setFollowupAvailability() {
    if (!followupBtn) return;
    const disabled = !currentSummaryId || !hasFollowupContent;
    followupBtn.disabled = disabled;
    if (followupInput) {
      followupInput.disabled = disabled;
    }
    if (followupStatus) {
      followupStatus.textContent = disabled
        ? "Follow-up questions are available after a summary is saved."
        : "";
      followupStatus.classList.remove("loading");
    }
  }

  setFollowupAvailability();
  requestSuggestions();

  if (streamId) {
    const port = platform.runtime.connect({ name: `summaryStream:${streamId}` });
    port.onMessage.addListener((message) => {
      if (!message) return;
      if (message.type === "delta") {
        decodedText = normalizeStreamingText(`${decodedText}${message.delta}`);
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
          if (currentSummaryId !== message.summaryId) {
            suggestionsRequested = false;
            suggestionsLoaded = false;
            hideSuggestions();
          }
          currentSummaryId = message.summaryId;
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

  async function persistThread() {
    if (!currentSummaryId) return;
    try {
      await updateSummaryThread(currentSummaryId, currentThread);
    } catch (error) {
      // Ignore summary store update errors.
    }
    if (currentHistoryId) {
      try {
        await updateHistoryThread(currentHistoryId, currentThread);
      } catch (error) {
        // Ignore history update errors.
      }
    }
  }

  async function askFollowup(overrideQuestion) {
    const question = (overrideQuestion || followupInput?.value || "").trim();
    if (!question) {
      showNotification(notification, "Please enter a question.", "error");
      return;
    }
    if (!currentSummaryId || !hasFollowupContent) {
      showNotification(notification, "Follow-up questions require a saved summary.", "error");
      return;
    }
    hideSuggestions();
    followupBtn.disabled = true;
    if (followupStatus) {
      followupStatus.textContent = "Sent. Waiting for answer";
      followupStatus.classList.add("loading");
    }
    const threadItem = {
      question,
      answer: "",
      timestamp: new Date().toISOString()
    };
    currentThread.push(threadItem);
    renderThread();
    if (followupInput) {
      followupInput.value = "";
    }
    try {
      const response = await platform.runtime.sendMessage({
        action: "followupQuestion",
        summaryId: currentSummaryId,
        question
      });
      if (response?.status !== "started" || !response.streamId) {
        throw new Error(response?.message || "Failed to start the follow-up answer.");
      }
      const port = platform.runtime.connect({ name: `followupStream:${response.streamId}` });
      port.onMessage.addListener(async (message) => {
        if (!message) return;
        if (message.type === "delta") {
          const nextText = message.fullText || `${threadItem.answer}${message.delta || ""}`;
          threadItem.answer = normalizeStreamingText(nextText);
          renderThread();
          return;
        }
        if (message.type === "done") {
          threadItem.answer = message.answer || threadItem.answer;
          renderThread();
          await persistThread();
          if (followupStatus) {
            followupStatus.textContent = "";
            followupStatus.classList.remove("loading");
          }
          setFollowupAvailability();
          port.disconnect();
          return;
        }
        if (message.type === "error") {
          threadItem.answer = message.message || "Failed to answer the question.";
          renderThread();
          await persistThread();
          showNotification(notification, message.message || "Failed to answer the question.", "error");
          if (followupStatus) {
            followupStatus.textContent = "";
            followupStatus.classList.remove("loading");
          }
          setFollowupAvailability();
          port.disconnect();
        }
      });
    } catch (error) {
      showNotification(notification, error.message || "Failed to answer the question.", "error");
      if (followupStatus) {
        followupStatus.textContent = "";
        followupStatus.classList.remove("loading");
      }
    } finally {
      setFollowupAvailability();
    }
  }

  followupBtn?.addEventListener("click", askFollowup);

  followupInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      askFollowup();
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
        hasFollowupContent = Boolean(stored.content);
        currentHistoryId = stored.historyId || currentHistoryId;
        currentThread = Array.isArray(stored.thread) ? stored.thread : currentThread;
        renderMeta(summaryMeta);
        renderThread();
        setFollowupAvailability();
        if (currentSummaryId !== id) {
          suggestionsRequested = false;
          suggestionsLoaded = false;
          hideSuggestions();
          currentSummaryId = id;
        }
        requestSuggestions();
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
