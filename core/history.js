import { createContentPreview } from './utils/preview.js';
import { saveSummaryForView } from './utils/summaryStore.js';
import { showNotification } from './utils/notification.js';
import { storageGetWithFallback, storageSetWithFallback } from './utils/storage.js';
import { platform } from './platform.js';

document.addEventListener("DOMContentLoaded", async () => {
  const historyList = document.getElementById("historyList");
  const clearHistoryBtn = document.getElementById("clearHistoryBtn");
  const searchInput = document.getElementById("historySearch");

  clearHistoryBtn.addEventListener("click", async () => {
    if (confirm("Are you sure you want to clear all history? This action cannot be undone.")) {
      await clearHistory();
      await loadHistory();
    }
  });

  searchInput?.addEventListener("input", () => {
    const query = searchInput.value.trim().toLowerCase();
    const cards = [...document.querySelectorAll('.history-card')];
    let visibleCount = 0;
    cards.forEach(card => {
      const text = card.dataset.searchText || "";
      const show = !query || text.includes(query);
      card.style.display = show ? "" : "none";
      if (show) visibleCount++;
    });

    // Show/hide empty search state
    const existing = document.getElementById("historyEmptySearch");
    if (visibleCount === 0 && query) {
      if (!existing) {
        historyList.appendChild(buildEmptyState(
          "No matches",
          "Try a different search term.",
          searchIcon()
        ));
        historyList.lastElementChild.id = "historyEmptySearch";
      }
    } else if (existing) {
      existing.remove();
    }
  });

  await loadHistory();
});

function storageGet(keys) {
  return storageGetWithFallback(keys, 'local', 'sync');
}

function storageSet(value) {
  return storageSetWithFallback(value, 'local', 'sync');
}

/**
 * Load summary history and render cards.
 */
async function loadHistory() {
  const historyList = document.getElementById("historyList");

  try {
    const result = await storageGet(['summaryHistory']);
    const history = result.summaryHistory || [];

    historyList.textContent = "";

    if (history.length === 0) {
      historyList.appendChild(buildEmptyState(
        "No summaries yet",
        "Summarize some pages using the extension to see them appear here.",
        clockIcon()
      ));
      return;
    }

    const fragment = document.createDocumentFragment();
    history.forEach((item, index) => {
      fragment.appendChild(buildHistoryCard(item, index));
    });
    historyList.appendChild(fragment);

  } catch (error) {
    console.error("Error loading history:", error);
    historyList.textContent = "";
    historyList.appendChild(buildEmptyState(
      "Error loading history",
      "There was a problem loading your summary history. Please try again.",
      null
    ));
  }
}

/**
 * Build a single history card element.
 * @param {object} item
 * @param {number} index
 * @returns {HTMLElement}
 */
function buildHistoryCard(item, index) {
  const sourceUrl = item.sourceUrl || item.url || extractSource(item.summary) || "";
  const title = item.title || "Untitled";
  const provider = item.provider || "";
  const model = item.model || "";
  const preview = item.contentPreview || createContentPreview(item.summary);
  const domain = extractDomain(sourceUrl);
  const relativeDate = formatRelativeDate(item.timestamp);
  const providerModel = [provider, model].filter(Boolean).join(" · ");

  const searchText = [title, domain, preview, providerModel].join(" ").toLowerCase();

  // Card wrapper
  const card = document.createElement("article");
  card.className = "history-card";
  card.dataset.index = String(index);
  card.dataset.searchText = searchText;
  card.setAttribute("role", "button");
  card.setAttribute("tabindex", "0");
  card.setAttribute("aria-label", `View summary: ${title}`);

  // Card body
  const body = document.createElement("div");
  body.className = "history-card-body";

  // Header row: title + date badge
  const header = document.createElement("div");
  header.className = "history-card-header";

  const titleEl = document.createElement("span");
  titleEl.className = "history-card-title";
  titleEl.textContent = title;

  const dateBadge = document.createElement("span");
  dateBadge.className = "badge badge-default history-card-date";
  dateBadge.textContent = relativeDate;

  header.appendChild(titleEl);
  header.appendChild(dateBadge);

  // Meta row: domain + provider/model badges
  const meta = document.createElement("div");
  meta.className = "history-card-meta";

  if (domain) {
    const domainBadge = document.createElement("span");
    domainBadge.className = "badge badge-accent";
    domainBadge.textContent = domain;
    meta.appendChild(domainBadge);
  }

  if (providerModel) {
    const modelBadge = document.createElement("span");
    modelBadge.className = "badge badge-default";
    modelBadge.textContent = providerModel;
    meta.appendChild(modelBadge);
  }

  // Preview
  const previewEl = document.createElement("p");
  previewEl.className = "history-card-preview";
  previewEl.textContent = preview;

  body.appendChild(header);
  if (meta.children.length > 0) body.appendChild(meta);
  body.appendChild(previewEl);

  // Actions: delete button + chevron
  const actions = document.createElement("div");
  actions.className = "history-card-actions";

  const deleteBtn = document.createElement("button");
  deleteBtn.className = "btn btn-icon btn-danger";
  deleteBtn.dataset.index = String(index);
  deleteBtn.setAttribute("aria-label", "Delete this summary");
  deleteBtn.innerHTML = trashIcon();

  const chevron = document.createElement("span");
  chevron.className = "history-card-chevron";
  chevron.setAttribute("aria-hidden", "true");
  chevron.innerHTML = chevronRightIcon();

  actions.appendChild(deleteBtn);
  actions.appendChild(chevron);

  // Inline confirm overlay (hidden by default)
  const confirm = document.createElement("div");
  confirm.className = "history-card-confirm";
  confirm.hidden = true;
  confirm.setAttribute("role", "group");
  confirm.setAttribute("aria-label", "Confirm delete");

  const confirmText = document.createElement("span");
  confirmText.className = "history-card-confirm-text";
  confirmText.textContent = "Delete this summary?";

  const cancelBtn = document.createElement("button");
  cancelBtn.className = "btn btn-secondary btn-sm";
  cancelBtn.textContent = "Cancel";

  const confirmDeleteBtn = document.createElement("button");
  confirmDeleteBtn.className = "btn btn-danger-solid btn-sm";
  confirmDeleteBtn.textContent = "Delete";
  confirmDeleteBtn.dataset.index = String(index);

  confirm.appendChild(confirmText);
  confirm.appendChild(cancelBtn);
  confirm.appendChild(confirmDeleteBtn);

  card.appendChild(body);
  card.appendChild(actions);
  card.appendChild(confirm);

  // --- Event listeners ---

  // Click card body → view summary (not on action buttons)
  card.addEventListener("click", (e) => {
    if (e.target.closest(".history-card-actions") || e.target.closest(".history-card-confirm")) {
      return;
    }
    viewFullSummary(index);
  });

  card.addEventListener("keydown", (e) => {
    if ((e.key === "Enter" || e.key === " ") && !e.target.closest("button")) {
      e.preventDefault();
      viewFullSummary(index);
    }
  });

  // Delete → show confirm (card-scoped timer prevents accumulation on rapid clicks)
  let dismissTimer = null;
  deleteBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    clearTimeout(dismissTimer);
    actions.hidden = true;
    confirm.hidden = false;

    // Auto-dismiss after 5s
    dismissTimer = setTimeout(() => {
      confirm.hidden = true;
      actions.hidden = false;
    }, 5000);

    cancelBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      clearTimeout(dismissTimer);
      confirm.hidden = true;
      actions.hidden = false;
    }, { once: true });

    confirmDeleteBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      clearTimeout(dismissTimer);
      await deleteHistoryItem(index);
      await loadHistory();
    }, { once: true });
  });

  return card;
}

/**
 * Build an empty / error state element.
 */
function buildEmptyState(title, message, iconHtml) {
  const el = document.createElement("div");
  el.className = "history-empty";

  if (iconHtml) {
    const iconWrap = document.createElement("div");
    iconWrap.className = "history-empty-icon";
    iconWrap.setAttribute("aria-hidden", "true");
    iconWrap.innerHTML = iconHtml;
    el.appendChild(iconWrap);
  }

  const h = document.createElement("p");
  h.className = "history-empty-title";
  h.textContent = title;

  const p = document.createElement("p");
  p.className = "history-empty-text";
  p.textContent = message;

  el.appendChild(h);
  el.appendChild(p);
  return el;
}

/**
 * Clear all saved history.
 */
async function clearHistory() {
  try {
    await storageSet({ summaryHistory: [] });
    await clearCachedSummaries();
    await clearSummaryViewStore();
    showNotification(document.getElementById("notification"), "History cleared.", "success");
  } catch (error) {
    console.error("Error clearing history:", error);
    showNotification(document.getElementById("notification"), "Failed to clear history.", "error");
  }
}

async function clearCachedSummaries() {
  try {
    await platform.storage.set('local', { summaryCache: {} });
  } catch (error) {
    console.warn("Failed to clear summary cache:", error);
  }
}

async function clearSummaryViewStore() {
  try {
    const sessionStorage = platform.storage.area('session');
    if (sessionStorage?.set) {
      await sessionStorage.set({ summaryView: {} });
    }
  } catch (error) {
    console.warn("Failed to clear session summary view store:", error);
  }
  try {
    await platform.storage.set('local', { summaryView: {} });
  } catch (error) {
    console.warn("Failed to clear local summary view store:", error);
  }
}

/**
 * Delete a history item by index.
 */
async function deleteHistoryItem(index) {
  try {
    const result = await storageGet(['summaryHistory']);
    const history = result.summaryHistory || [];
    if (index >= 0 && index < history.length) {
      history.splice(index, 1);
      await storageSet({ summaryHistory: history });
      showNotification(document.getElementById("notification"), "Summary deleted.", "success");
    }
  } catch (error) {
    console.error("Error deleting history item:", error);
    showNotification(document.getElementById("notification"), "Failed to delete summary.", "error");
  }
}

/**
 * Open a stored summary in the results view.
 */
function viewFullSummary(index) {
  storageGet(['summaryHistory']).then((result) => {
    const history = result.summaryHistory || [];
    if (index >= 0 && index < history.length) {
      const item = history[index];
      saveSummaryForView(item.summary, {
        title: item.title || "",
        sourceUrl: item.sourceUrl || item.url || "",
        provider: item.provider || "",
        model: item.model || ""
      })
        .then((id) => {
          const encoded = encodeURIComponent(id);
          platform.tabs.create({ url: platform.runtime.getURL(`results.html?id=${encoded}`) });
        })
        .catch(() => {
          const encoded = encodeURIComponent(item.summary);
          platform.tabs.create({ url: platform.runtime.getURL(`results.html?text=${encoded}`) });
        });
    }
  });
}

// --- Helpers ---

function formatRelativeDate(timestamp) {
  if (!timestamp) return "";
  const now = Date.now();
  const diff = now - new Date(timestamp).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function extractDomain(url) {
  if (!url) return "";
  try {
    const { hostname } = new URL(url);
    return hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function extractSource(summary) {
  if (!summary) return null;
  const match = summary.match(/https?:\/\/[^\s]+/i);
  return match ? match[0] : null;
}

// --- SVG icons ---
function trashIcon() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`;
}

function chevronRightIcon() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>`;
}

function clockIcon() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
}

function searchIcon() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`;
}
