import { assert, assertEqual, resetGlobals, setupMockBrowser } from './testUtils.js';

async function run() {
  setupMockBrowser();
  const { storageGetWithFallback, storageSetWithFallback } = await import('../core/utils/storage.js');

  // Normal path: local storage works
  await storageSetWithFallback({ foo: 'bar' }, 'local', 'sync');
  const localResult = await storageGetWithFallback(['foo'], 'local', 'sync');
  assertEqual(localResult.foo, 'bar', 'Should read value from local storage');

  // Fallback path: local throws availability error → fall back to sync
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
  assertEqual(syncResult.baz, 'qux', 'Should fall back to sync storage on availability error');

  globalThis.browser.storage.local.get = originalGet;
  globalThis.browser.storage.local.set = originalSet;

  // Quota error path: should NOT fall back to sync — must re-throw
  // Writing large data (history) to sync (100KB limit) would corrupt it.
  globalThis.browser.storage.local.set = async () => {
    throw new Error('QUOTA_BYTES quota exceeded');
  };

  let quotaErrorThrown = false;
  try {
    await storageSetWithFallback({ largeData: 'x'.repeat(1000) }, 'local', 'sync');
  } catch (err) {
    quotaErrorThrown = true;
    assert(err.message.includes('QUOTA_BYTES'), 'Quota error should propagate unchanged');
  }
  assert(quotaErrorThrown, 'Quota error should be re-thrown, not swallowed or fallen back');

  // Verify nothing was written to sync (fallback must not have been attempted)
  const syncCheck = await globalThis.browser.storage.sync.get(['largeData']);
  assertEqual(syncCheck.largeData, undefined, 'Quota error must not write to sync storage');

  globalThis.browser.storage.local.set = originalSet;

  resetGlobals();
  console.log('storage tests passed');
}

run();
