import { createContentPreview } from './preview.js';
import { platform } from '../platform.js';

const MAX_HISTORY_SUMMARY_CHARS = 8000;
const MAX_HISTORY_ITEMS = 50;
const DEDUPE_WINDOW_MS = 10 * 60 * 1000;

function trimSummaryForHistory(summary) {
  if (!summary) return '';
  if (summary.length <= MAX_HISTORY_SUMMARY_CHARS) return summary;
  return `${summary.slice(0, MAX_HISTORY_SUMMARY_CHARS)}...`;
}

/**
 * Create a normalized history item with preview and timestamp.
 * @param {string} url
 * @param {string} summary
 * @param {string} title
 * @returns {{ url: string, sourceUrl: string, title: string, summary: string, timestamp: string, contentPreview: string }}
 */
export function createHistoryItem(url, summary, title = "") {
  const trimmedSummary = trimSummaryForHistory(summary);
  return {
    url,
    sourceUrl: url,
    title: title || "",
    summary: trimmedSummary,
    timestamp: new Date().toISOString(),
    contentPreview: createContentPreview(trimmedSummary)
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

function storageGet(keys) {
  return platform.storage.get('local', keys);
}

function storageSet(value) {
  return platform.storage.set('local', value);
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
    return { status: 'saved' };
  } catch (error) {
    const message = String(error?.message || '');
    if (message.includes('QUOTA_BYTES') || message.includes('Quota')) {
      history.splice(Math.floor(MAX_HISTORY_ITEMS / 2));
      await storageSet({ summaryHistory: history });
      return { status: 'saved_trimmed' };
    }
    throw error;
  }
}
