import { assert, assertEqual, resetGlobals, setupMockBrowser } from './testUtils.js';

async function run() {
  setupMockBrowser();
  let opened = false;
  globalThis.browser.tabs = {
    create: async () => {
      opened = true;
      return null;
    },
    query: async () => []
  };
  globalThis.browser.runtime = {
    getURL: (path) => path
  };
  const { summarySession } = await import('../core/utils/summarySession.js');

  const key = summarySession.buildCacheKey('https://example.com', {
    provider: 'openai',
    model: 'gpt',
    language: 'english',
    promptProfile: 'default',
    maxContentChars: 60000
  });
  assertEqual(
    key,
    'https://example.com|openai|gpt||english|default|60000',
    'Cache key should include url, provider, model/deployment, apiVersion (if azure), language, promptProfile, maxContentChars'
  );

  // Check cache handling with preloaded cache
  const store = globalThis.browser.storage.local;
  await store.set({
    summaryCache: {
      [key]: {
        summary: 'Cached summary',
        title: 'Title',
        sourceUrl: 'https://example.com',
        timestamp: Date.now()
      }
    }
  });

  const cached = await summarySession.checkCache({ cacheKey: key, incrementCounter: false });
  assert(cached.handled, 'Cache should be handled');
  assert(opened, 'Results page should open for cached summary');
  resetGlobals();
  console.log('summarySession tests passed');
}

run();
