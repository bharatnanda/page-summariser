const STORAGE_KEY = 'summaryView';
const MAX_ITEMS = 20;
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

function getStorageArea() {
  return chrome.storage.session || chrome.storage.local;
}

function generateId() {
  return `summary_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function pruneStore(store) {
  const now = Date.now();
  const ids = Object.keys(store);
  let modified = false;

  for (const id of ids) {
    if (now - store[id].timestamp > MAX_AGE_MS) {
      delete store[id];
      modified = true;
    }
  }

  const remainingIds = Object.keys(store);
  if (remainingIds.length > MAX_ITEMS) {
    const sortedIds = remainingIds.sort((a, b) => store[b].timestamp - store[a].timestamp);
    for (let i = MAX_ITEMS; i < sortedIds.length; i++) {
      delete store[sortedIds[i]];
      modified = true;
    }
  }

  return modified;
}

/**
 * Save a summary for short-term viewing and return its ID.
 * @param {string} summary
 * @param {{ title?: string, sourceUrl?: string }} meta
 * @returns {Promise<string>}
 */
export async function saveSummaryForView(summary, meta = {}) {
  const storage = getStorageArea();
  const result = await storage.get([STORAGE_KEY]);
  const store = result[STORAGE_KEY] || {};
  const id = generateId();

  store[id] = {
    summary,
    title: meta.title || "",
    sourceUrl: meta.sourceUrl || "",
    timestamp: Date.now()
  };

  pruneStore(store);
  await storage.set({ [STORAGE_KEY]: store });
  return id;
}

/**
 * Load a saved summary by ID.
 * @param {string} id
 * @returns {Promise<{ summary: string, title: string, sourceUrl: string, timestamp: number } | null>}
 */
export async function loadSummaryForView(id) {
  if (!id) return null;
  const storage = getStorageArea();
  const result = await storage.get([STORAGE_KEY]);
  const store = result[STORAGE_KEY] || {};
  if (pruneStore(store)) {
    await storage.set({ [STORAGE_KEY]: store });
  }
  return store[id] || null;
}
