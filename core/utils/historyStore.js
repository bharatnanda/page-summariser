import { createContentPreview } from './preview.js';
import { storageGetWithFallback, storageSetWithFallback } from './storage.js';
import { platform } from '../platform.js';

const MAX_HISTORY_SUMMARY_CHARS = 20000;
const MAX_HISTORY_ITEMS = 50;
const DEDUPE_WINDOW_MS = 10 * 60 * 1000;
const HISTORY_CONTENT_KEY = 'summaryHistoryContent';

function trimSummaryForHistory(summary) {
  if (!summary) return '';
  if (summary.length <= MAX_HISTORY_SUMMARY_CHARS) return summary;
  const trimmed = summary.slice(0, MAX_HISTORY_SUMMARY_CHARS);
  return `${stripDanglingMath(trimmed)}...`;
}

function stripDanglingMath(text) {
  if (!text) return text;
  let inDisplay = false;
  let inInline = false;
  let lastDisplayStart = -1;
  let lastInlineStart = -1;

  for (let i = 0; i < text.length; i += 1) {
    if (text.startsWith("$$", i) && !isEscaped(text, i)) {
      if (!inDisplay) {
        inDisplay = true;
        lastDisplayStart = i;
      } else {
        inDisplay = false;
        lastDisplayStart = -1;
      }
      i += 1;
      continue;
    }
    if (text[i] === "$" && !text.startsWith("$$", i) && !isEscaped(text, i)) {
      if (!inInline) {
        inInline = true;
        lastInlineStart = i;
      } else {
        inInline = false;
        lastInlineStart = -1;
      }
    }
  }

  if (inDisplay && lastDisplayStart >= 0) {
    return text.slice(0, lastDisplayStart);
  }
  if (inInline && lastInlineStart >= 0) {
    return text.slice(0, lastInlineStart);
  }
  return text;
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

/**
 * Create a normalized history item with preview and timestamp.
 * @param {string} url
 * @param {string} summary
 * @param {string} title
 * @param {{ provider?: string, model?: string }} meta
 * @param {string | null} summaryId
 * @returns {{ url: string, sourceUrl: string, title: string, summaryId: string | null, summaryHash: string, summary?: string, timestamp: string, contentPreview: string, provider?: string, model?: string }}
 */
export function createHistoryItem(url, summary, title = "", meta = {}, summaryId = null) {
  const trimmedSummary = trimSummaryForHistory(summary);
  const item = {
    url,
    sourceUrl: url,
    title: title || "",
    summaryId: summaryId || null,
    summaryHash: hashSummary(summary),
    timestamp: new Date().toISOString(),
    contentPreview: createContentPreview(trimmedSummary),
    provider: meta.provider || "",
    model: meta.model || ""
  };
  item.summary = trimmedSummary;
  return item;
}

/**
 * Check for duplicates within a time window or identical content.
 * @param {Array<any>} history
 * @param {any} item
 * @returns {boolean}
 */
export function isDuplicateHistoryItem(history, item) {
  if (!item || !item.url) return false;
  const itemTime = Date.parse(item.timestamp || '');
  return history.some(existing => {
    if (existing.url !== item.url) return false;
    const existingTime = Date.parse(existing.timestamp || '');
    if (!Number.isNaN(existingTime) && !Number.isNaN(itemTime)) {
      if (Math.abs(existingTime - itemTime) <= DEDUPE_WINDOW_MS) {
        return true;
      }
    }
    if (existing.timestamp && item.timestamp && existing.timestamp === item.timestamp) {
      return true;
    }
    if (existing.summaryHash && item.summaryHash) {
      return existing.summaryHash === item.summaryHash;
    }
    return existing.summary === item.summary;
  });
}

function storageGet(keys) {
  return storageGetWithFallback(keys, 'local', 'sync');
}

function storageSet(value) {
  return storageSetWithFallback(value, 'local', 'sync');
}

/**
 * Save a history item, trimming if storage quota is exceeded.
 * @param {ReturnType<typeof createHistoryItem>} historyItem
 * @returns {Promise<{ status: "saved" | "duplicate" | "saved_trimmed" }>}
 */
export async function addHistoryItem(historyItem) {
  const result = await storageGet(['summaryHistory']);
  const history = result.summaryHistory || [];

  if (isDuplicateHistoryItem(history, historyItem)) {
    return { status: 'duplicate' };
  }

  history.unshift(historyItem);
  if (history.length > MAX_HISTORY_ITEMS) {
    history.splice(MAX_HISTORY_ITEMS);
  }

  try {
    await storageSet({ summaryHistory: history });
    await pruneHistorySummaries(history);
    return { status: 'saved' };
  } catch (error) {
    const message = String(error?.message || '');
    if (message.includes('QUOTA_BYTES') || message.includes('Quota')) {
      history.splice(Math.floor(MAX_HISTORY_ITEMS / 2));
      await storageSet({ summaryHistory: history });
      await pruneHistorySummaries(history);
      return { status: 'saved_trimmed' };
    }
    throw error;
  }
}

function hashSummary(summary) {
  if (!summary) return "";
  let hash = 5381;
  for (let i = 0; i < summary.length; i += 1) {
    hash = ((hash << 5) + hash) ^ summary.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
}

function generateSummaryContentId() {
  return `history_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

async function getHistoryContentStore() {
  const result = await platform.storage.get('local', [HISTORY_CONTENT_KEY]);
  return result[HISTORY_CONTENT_KEY] || {};
}

async function setHistoryContentStore(store) {
  await platform.storage.set('local', { [HISTORY_CONTENT_KEY]: store });
}

/**
 * Save the full summary content for history and return its ID.
 * @param {string} summary
 * @returns {Promise<string>}
 */
export async function saveSummaryForHistory(summary) {
  const store = await getHistoryContentStore();
  const id = generateSummaryContentId();
  store[id] = { summary, timestamp: Date.now() };
  pruneHistoryContentStore(store);
  await setHistoryContentStore(store);
  return id;
}

/**
 * Load a full summary by history summary ID.
 * @param {string} id
 * @returns {Promise<string | null>}
 */
export async function loadSummaryForHistory(id) {
  if (!id) return null;
  const store = await getHistoryContentStore();
  return store[id]?.summary || null;
}

/**
 * Delete a stored history summary by ID.
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function deleteSummaryForHistory(id) {
  if (!id) return;
  const store = await getHistoryContentStore();
  if (store[id]) {
    delete store[id];
    await setHistoryContentStore(store);
  }
}

/**
 * Clear all stored history summaries.
 * @returns {Promise<void>}
 */
export async function clearHistorySummaries() {
  await setHistoryContentStore({});
}

/**
 * Remove any stored history summaries that no longer exist in history.
 * @param {Array<{ summaryId?: string | null }>} history
 * @returns {Promise<void>}
 */
export async function pruneHistorySummaries(history) {
  const store = await getHistoryContentStore();
  const validIds = new Set(
    (history || [])
      .map((item) => item?.summaryId)
      .filter(Boolean)
  );
  let modified = false;
  Object.keys(store).forEach((id) => {
    if (!validIds.has(id)) {
      delete store[id];
      modified = true;
    }
  });
  if (modified) {
    await setHistoryContentStore(store);
  }
}

/**
 * Find a history item by summary ID.
 * @param {string} id
 * @returns {Promise<ReturnType<typeof createHistoryItem> | null>}
 */
export async function findHistoryItemBySummaryId(id) {
  if (!id) return null;
  const result = await storageGet(['summaryHistory']);
  const history = result.summaryHistory || [];
  return history.find((item) => item?.summaryId === id) || null;
}

function pruneHistoryContentStore(store) {
  const ids = Object.keys(store);
  if (ids.length <= MAX_HISTORY_ITEMS) return;
  const sorted = ids.sort((a, b) => store[b].timestamp - store[a].timestamp);
  for (let i = MAX_HISTORY_ITEMS; i < sorted.length; i += 1) {
    delete store[sorted[i]];
  }
}
