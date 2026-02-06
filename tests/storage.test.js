import { assertEqual, resetGlobals, setupMockBrowser } from './testUtils.js';

async function run() {
  setupMockBrowser();
  const { storageGetWithFallback, storageSetWithFallback } = await import('../core/utils/storage.js');

  // Normal path: local storage works
  await storageSetWithFallback({ foo: 'bar' }, 'local', 'sync');
  const localResult = await storageGetWithFallback(['foo'], 'local', 'sync');
  assertEqual(localResult.foo, 'bar', 'Should read value from local storage');

  // Fallback path: local throws, use sync
  const originalGet = globalThis.browser.storage.local.get;
  const originalSet = globalThis.browser.storage.local.set;
  globalThis.browser.storage.local.get = async () => {
    throw new Error('local unavailable');
  };
  globalThis.browser.storage.local.set = async () => {
    throw new Error('local unavailable');
  };

  await storageSetWithFallback({ baz: 'qux' }, 'local', 'sync');
  const syncResult = await storageGetWithFallback(['baz'], 'local', 'sync');
  assertEqual(syncResult.baz, 'qux', 'Should fall back to sync storage');

  globalThis.browser.storage.local.get = originalGet;
  globalThis.browser.storage.local.set = originalSet;

  resetGlobals();
  console.log('storage tests passed');
}

run();
