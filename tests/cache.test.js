import { assertEqual, assert, resetGlobals, setupMockBrowser } from './testUtils.js';

async function run() {
  const store = setupMockBrowser();
  const { cacheSummary, clearExpiredCache, getCachedSummary } = await import('../core/utils/cache.js');

  const url = 'https://example.com/article';
  await cacheSummary(url, 'Hello world', { title: 'Title', sourceUrl: url });
  const cached = await getCachedSummary(url);
  assert(cached, 'Cache entry should exist');
  assertEqual(cached.summary, 'Hello world', 'Cached summary should match');
  assertEqual(cached.title, 'Title', 'Cached title should match');

  // Expired entry: getCachedSummary returns null but does NOT write back to storage.
  // Cleanup is deferred to the periodic clearExpiredCache alarm — saves a write per miss.
  const oldTimestamp = Date.now() - (31 * 60 * 1000);
  store.local.summaryCache[url].timestamp = oldTimestamp;
  const expired = await getCachedSummary(url);
  assertEqual(expired, null, 'Expired cache entry should return null');
  assert(
    store.local.summaryCache[url] !== undefined,
    'Expired entry must remain in store until clearExpiredCache runs (deferred cleanup)'
  );

  // clearExpiredCache actually removes expired entries
  await clearExpiredCache();
  assertEqual(
    store.local.summaryCache[url],
    undefined,
    'clearExpiredCache should remove expired entries from store'
  );

  // cacheSummary TTL eviction: expired entries are purged during writes, not just on alarm.
  // Seed a fresh entry and an already-expired one, then write a new entry.
  store.local.summaryCache = {
    'https://example.com/fresh': { summary: 'fresh', timestamp: Date.now() },
    'https://example.com/stale': { summary: 'stale', timestamp: Date.now() - (31 * 60 * 1000) }
  };
  await cacheSummary('https://example.com/new', 'new summary', {});
  assert(store.local.summaryCache['https://example.com/fresh'], 'Fresh entry should be kept');
  assert(!store.local.summaryCache['https://example.com/stale'], 'Stale entry should be evicted during write');
  assert(store.local.summaryCache['https://example.com/new'], 'New entry should be stored');

  // Count-based trim: after TTL eviction, if still over 100 entries, oldest are removed.
  store.local.summaryCache = {};
  for (let i = 0; i < 120; i += 1) {
    await cacheSummary(`https://example.com/${i}`, `summary ${i}`, {});
  }
  const keys = Object.keys(store.local.summaryCache || {});
  assert(keys.length <= 100, 'Cache should trim to 100 entries after count-based eviction');

  // Quota error recovery: cacheSummary should clear the cache and not throw.
  const originalSet = globalThis.browser.storage.local.set;
  globalThis.browser.storage.local.set = async () => {
    throw new Error('QUOTA_BYTES quota exceeded');
  };
  let quotaThrew = false;
  try {
    await cacheSummary('https://example.com/quota-test', 'test', {});
  } catch (_) {
    quotaThrew = true;
  }
  assert(!quotaThrew, 'cacheSummary should not throw on quota error');
  globalThis.browser.storage.local.set = originalSet;
  // After quota recovery the set is restored — cache cleared to {} then this empty write succeeds.
  store.local.summaryCache = {};

  await clearExpiredCache();

  resetGlobals();
  console.log('cache tests passed');
}

run();
