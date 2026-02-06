import { assert, assertEqual, resetGlobals, setupMockBrowser } from './testUtils.js';

async function run() {
  const store = setupMockBrowser();
  const { getSettings } = await import('../core/utils/settings.js');
  const { DEFAULT_BLACKLIST } = await import('../core/utils/defaultBlacklist.js');

  // Fresh install: default blacklist should be seeded
  const fresh = await getSettings();
  assertEqual(fresh.defaultBlacklistedUrls, DEFAULT_BLACKLIST, 'Default blacklist should be seeded on first run');
  assert(store.sync.defaultBlacklistedUrls, 'Default blacklist should be stored in sync');
  assertEqual(store.sync.defaultBlacklistInitialized, true, 'Default blacklist initialization flag should be set');

  // Existing custom default should be preserved
  store.sync.defaultBlacklistedUrls = 'example.com';
  store.sync.defaultBlacklistInitialized = true;
  const custom = await getSettings();
  assertEqual(custom.defaultBlacklistedUrls, 'example.com', 'Custom default blacklist should be preserved');

  // User cleared defaults after initialization should remain empty
  store.sync.defaultBlacklistedUrls = '';
  store.sync.defaultBlacklistInitialized = true;
  const cleared = await getSettings();
  assertEqual(cleared.defaultBlacklistedUrls, '', 'Cleared default blacklist should remain empty after initialization');

  resetGlobals();
  console.log('settings tests passed');
}

run();
