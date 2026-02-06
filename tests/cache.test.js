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

  // Simulate expired cache item
  const oldTimestamp = Date.now() - (31 * 60 * 1000);
  store.local.summaryCache[url].timestamp = oldTimestamp;
  const expired = await getCachedSummary(url);
  assertEqual(expired, null, 'Expired cache should be cleared');

  // Simulate cache trimming
  store.local.summaryCache = {};
  for (let i = 0; i < 120; i += 1) {
    await cacheSummary(`https://example.com/${i}`, `summary ${i}`, {});
  }
  const keys = Object.keys(store.local.summaryCache || {});
  assert(keys.length <= 100, 'Cache should trim to 100 entries');

  await clearExpiredCache();

  resetGlobals();
  console.log('cache tests passed');
}

run();
