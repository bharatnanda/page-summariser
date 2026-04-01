import { platform } from '../platform.js';

const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes in milliseconds

/**
 * Get cached summary for a URL if it exists and is not expired.
 * @param {string} url - The page URL
 * @returns {Promise<{ summary: string, title: string, sourceUrl: string, provider?: string, model?: string, timestamp: number } | null>}
 */
export async function getCachedSummary(url) {
  try {
    const result = await platform.storage.get('local', ['summaryCache']);
    const cache = result.summaryCache || {};
    
    const cachedItem = cache[url];
    if (!cachedItem) return null;

    const now = Date.now();
    if (now - cachedItem.timestamp > CACHE_DURATION) {
      // Expired — skip without writing; clearExpiredCache() handles periodic cleanup.
      return null;
    }
    
    return cachedItem;
  } catch (error) {
    console.error("Error retrieving cached summary:", error);
    return null;
  }
}

/**
 * Save a summary to cache.
 * @param {string} url - The page URL
 * @param {string} summary - The summary text
 * @param {{ title?: string, sourceUrl?: string, provider?: string, model?: string }} meta - Optional metadata
 * @returns {Promise<void>}
 */
export async function cacheSummary(url, summary, meta = {}) {
  try {
    const result = await platform.storage.get('local', ['summaryCache']);
    const cache = result.summaryCache || {};
    
    const now = Date.now();
    cache[url] = {
      summary,
      title: meta.title || "",
      sourceUrl: meta.sourceUrl || "",
      provider: meta.provider || "",
      model: meta.model || "",
      timestamp: now
    };

    // Evict expired entries first, then trim by count if still over limit.
    for (const key of Object.keys(cache)) {
      if (now - cache[key].timestamp > CACHE_DURATION) delete cache[key];
    }
    const remaining = Object.keys(cache);
    if (remaining.length > 100) {
      const sorted = remaining.sort((a, b) => cache[a].timestamp - cache[b].timestamp);
      for (let i = 0; i < sorted.length - 100; i++) delete cache[sorted[i]];
    }

    await platform.storage.set('local', { summaryCache: cache });
  } catch (error) {
    const msg = String(error?.message || '');
    if (msg.includes('QUOTA_BYTES') || msg.includes('Quota')) {
      console.warn('[Page Summarizer] Cache quota exceeded, clearing cache.');
      try { await platform.storage.set('local', { summaryCache: {} }); } catch (_) {}
    } else {
      console.error("Error caching summary:", error);
    }
  }
}

/**
 * Clear expired cache entries.
 * @returns {Promise<void>}
 */
export async function clearExpiredCache() {
  try {
    const result = await platform.storage.get('local', ['summaryCache']);
    const cache = result.summaryCache || {};
    
    const now = Date.now();
    let modified = false;
    
    for (const url in cache) {
      if (now - cache[url].timestamp > CACHE_DURATION) {
        delete cache[url];
        modified = true;
      }
    }
    
    if (modified) {
      await platform.storage.set('local', { summaryCache: cache });
    }
  } catch (error) {
    console.error("Error clearing expired cache:", error);
  }
}
