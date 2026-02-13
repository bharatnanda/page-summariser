import { createContentPreview } from './preview.js';
import { storageGetWithFallback, storageSetWithFallback } from './storage.js';

const MAX_HISTORY_SUMMARY_CHARS = 8000;
const MAX_HISTORY_CONTENT_CHARS = 12000;
const MAX_HISTORY_ITEMS = 50;
const DEDUPE_WINDOW_MS = 10 * 60 * 1000;

function trimSummaryForHistory(summary) {
  if (!summary) return '';
  if (summary.length <= MAX_HISTORY_SUMMARY_CHARS) return summary;
  return `${summary.slice(0, MAX_HISTORY_SUMMARY_CHARS)}...`;
}

function trimContentForHistory(content) {
  if (!content) return '';
  if (content.length <= MAX_HISTORY_CONTENT_CHARS) return content;
  return `${content.slice(0, MAX_HISTORY_CONTENT_CHARS)}...`;
}

function generateHistoryId() {
  return `history_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Create a normalized history item with preview and timestamp.
 * @param {string} url
 * @param {string} summary
 * @param {string} title
 * @param {{ provider?: string, model?: string, content?: string, thread?: Array<{ question: string, answer: string, timestamp: string }> }} meta
 * @returns {{ id: string, url: string, sourceUrl: string, title: string, summary: string, content?: string, thread?: Array<{ question: string, answer: string, timestamp: string }>, timestamp: string, contentPreview: string, provider?: string, model?: string }}
 */
export function createHistoryItem(url, summary, title = "", meta = {}) {
  const trimmedSummary = trimSummaryForHistory(summary);
  return {
    id: generateHistoryId(),
    url,
    sourceUrl: url,
    title: title || "",
    summary: trimmedSummary,
    content: trimContentForHistory(meta.content || ""),
    thread: Array.isArray(meta.thread) ? meta.thread : [],
    timestamp: new Date().toISOString(),
    contentPreview: createContentPreview(trimmedSummary),
    provider: meta.provider || "",
    model: meta.model || ""
  };
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
    return existing.summary === item.summary;
  });
}

function findDuplicateHistoryItem(history, item) {
  if (!item || !item.url) return null;
  const itemTime = Date.parse(item.timestamp || '');
  return history.find(existing => {
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
    return existing.summary === item.summary;
  }) || null;
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
 * @returns {Promise<{ status: "saved" | "duplicate" | "saved_trimmed", id?: string }>}
 */
export async function addHistoryItem(historyItem) {
  const result = await storageGet(['summaryHistory']);
  const history = result.summaryHistory || [];

  const duplicate = findDuplicateHistoryItem(history, historyItem);
  if (duplicate) {
    return { status: 'duplicate', id: duplicate.id };
  }

  history.unshift(historyItem);
  if (history.length > MAX_HISTORY_ITEMS) {
    history.splice(MAX_HISTORY_ITEMS);
  }

  try {
    await storageSet({ summaryHistory: history });
    return { status: 'saved', id: historyItem.id };
  } catch (error) {
    const message = String(error?.message || '');
    if (message.includes('QUOTA_BYTES') || message.includes('Quota')) {
      history.splice(Math.floor(MAX_HISTORY_ITEMS / 2));
      await storageSet({ summaryHistory: history });
      return { status: 'saved_trimmed', id: historyItem.id };
    }
    throw error;
  }
}

/**
 * Update the thread for a history item.
 * @param {string} historyId
 * @param {Array<{ question: string, answer: string, timestamp: string }>} thread
 * @returns {Promise<void>}
 */
export async function updateHistoryThread(historyId, thread) {
  if (!historyId) return;
  const result = await storageGet(['summaryHistory']);
  const history = result.summaryHistory || [];
  const index = history.findIndex(item => item.id === historyId);
  if (index === -1) return;
  history[index].thread = Array.isArray(thread) ? thread : [];
  await storageSet({ summaryHistory: history });
}
