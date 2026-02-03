import { createContentPreview } from './preview.js';

const MAX_HISTORY_SUMMARY_CHARS = 8000;
const MAX_HISTORY_ITEMS = 50;
const DEDUPE_WINDOW_MS = 10 * 60 * 1000;

function trimSummaryForHistory(summary) {
  if (!summary) return '';
  if (summary.length <= MAX_HISTORY_SUMMARY_CHARS) return summary;
  return `${summary.slice(0, MAX_HISTORY_SUMMARY_CHARS)}...`;
}

export function createHistoryItem(url, summary) {
  const trimmedSummary = trimSummaryForHistory(summary);
  return {
    url,
    summary: trimmedSummary,
    timestamp: new Date().toISOString(),
    contentPreview: createContentPreview(trimmedSummary)
  };
}

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
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(keys, (result) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }
      resolve(result);
    });
  });
}

function storageSet(value) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set(value, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }
      resolve();
    });
  });
}

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
