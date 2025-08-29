const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes in milliseconds

/**
 * Get cached summary for a URL if it exists and is not expired
 * @param {string} url - The page URL
 * @returns {Promise<string|null>} - The cached summary or null if not found/expired
 */
export async function getCachedSummary(url) {
  try {
    const result = await chrome.storage.local.get(['summaryCache']);
    const cache = result.summaryCache || {};
    
    const cachedItem = cache[url];
    if (!cachedItem) return null;
    
    const now = Date.now();
    if (now - cachedItem.timestamp > CACHE_DURATION) {
      // Expired, remove from cache
      delete cache[url];
      await chrome.storage.local.set({ summaryCache: cache });
      return null;
    }
    
    return cachedItem.summary;
  } catch (error) {
    console.error("Error retrieving cached summary:", error);
    return null;
  }
}

/**
 * Save a summary to cache
 * @param {string} url - The page URL
 * @param {string} summary - The summary text
 * @returns {Promise<void>}
 */
export async function cacheSummary(url, summary) {
  try {
    const result = await chrome.storage.local.get(['summaryCache']);
    const cache = result.summaryCache || {};
    
    cache[url] = {
      summary,
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
    
    await chrome.storage.local.set({ summaryCache: cache });
  } catch (error) {
    console.error("Error caching summary:", error);
  }
}

/**
 * Clear expired cache entries
 * @returns {Promise<void>}
 */
export async function clearExpiredCache() {
  try {
    const result = await chrome.storage.local.get(['summaryCache']);
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
      await chrome.storage.local.set({ summaryCache: cache });
    }
  } catch (error) {
    console.error("Error clearing expired cache:", error);
  }
}