import { platform } from '../platform.js';

const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes in milliseconds

/**
 * Get cached summary for a URL if it exists and is not expired.
 * @param {string} url - The page URL
 * @returns {Promise<{ summary: string, title: string, sourceUrl: string, timestamp: number } | null>}
 */
export async function getCachedSummary(url) {
  try {
    const result = await platform.storage.get('local', ['summaryCache']);
    const cache = result.summaryCache || {};
    
    const cachedItem = cache[url];
    if (!cachedItem) return null;
    
    const now = Date.now();
    if (now - cachedItem.timestamp > CACHE_DURATION) {
      // Expired, remove from cache
      delete cache[url];
      await platform.storage.set('local', { summaryCache: cache });
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
 * @param {{ title?: string, sourceUrl?: string }} meta - Optional metadata
 * @returns {Promise<void>}
 */
export async function cacheSummary(url, summary, meta = {}) {
  try {
    const result = await platform.storage.get('local', ['summaryCache']);
    const cache = result.summaryCache || {};
    
    cache[url] = {
      summary,
      title: meta.title || "",
      sourceUrl: meta.sourceUrl || "",
      timestamp: Date.now()
    };
    
    // Keep cache size manageable
    const urls = Object.keys(cache);
    if (urls.length > 100) {
      // Remove oldest entries
      const sortedUrls = urls.sort((a, b) => cache[b].timestamp - cache[a].timestamp);
      for (let i = 100; i < sortedUrls.length; i++) {
        delete cache[sortedUrls[i]];
      }
    }
    
    await platform.storage.set('local', { summaryCache: cache });
  } catch (error) {
    console.error("Error caching summary:", error);
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
