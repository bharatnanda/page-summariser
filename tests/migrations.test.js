import { assert, assertEqual, resetGlobals, setupMockBrowser } from './testUtils.js';

async function run() {
  // setupMockBrowser() must run before any import that transitively loads platform.js,
  // because platform.js captures `api = globalThis.browser` at module evaluation time.
  const store = setupMockBrowser();

  const { detectAzureMigration, runMigrations } = await import('../core/utils/migrations.js');

  // No settings → no migration needed
  assert(!detectAzureMigration(null).needed, 'null azure settings should not need migration');
  assert(!detectAzureMigration({}).needed, 'empty azure settings should not need migration');

  // Already using Foundry endpoint → no migration needed
  assert(
    !detectAzureMigration({
      baseUrl: 'https://my-resource.services.ai.azure.com',
      model: 'gpt-4o-mini',
      apiVersion: '2024-05-01-preview'
    }).needed,
    'Foundry endpoint should not need migration'
  );

  // Old deployment field → needs migration
  {
    const { needed, reasons } = detectAzureMigration({ deployment: 'my-deployment' });
    assert(needed, 'deployment field should trigger migration');
    assert(reasons.some(r => r.includes('Deployment name')), 'should mention deployment in reason');
  }

  // Old *.openai.azure.com base URL → needs migration
  {
    const { needed, reasons } = detectAzureMigration({
      baseUrl: 'https://my-resource.openai.azure.com'
    });
    assert(needed, 'openai.azure.com URL should trigger migration');
    assert(reasons.some(r => r.includes('openai.azure.com')), 'should mention old URL in reason');
  }

  // Both issues → two reasons
  {
    const { needed, reasons } = detectAzureMigration({
      deployment: 'my-dep',
      baseUrl: 'https://res.openai.azure.com'
    });
    assert(needed, 'both issues should trigger migration');
    assertEqual(reasons.length, 2, 'should report both reasons');
  }

  // Legacy API version → auto-fix flagged
  {
    const { needed, autoFix, reasons } = detectAzureMigration({ apiVersion: '2024-02-01' });
    assert(needed, 'legacy API version should trigger migration');
    assertEqual(autoFix.apiVersion, '2024-05-01-preview', 'should auto-fix API version');
    assert(reasons.some(r => r.includes('2024-02-01')), 'should mention old version in reason');
  }

  // Current Foundry API version → no migration
  {
    const { needed } = detectAzureMigration({ apiVersion: '2024-05-01-preview' });
    assert(!needed, 'current API version should not trigger migration');
  }

  // All three issues together → three reasons, two auto-fixes
  {
    const { needed, autoFix, reasons } = detectAzureMigration({
      deployment: 'dep',
      baseUrl: 'https://res.openai.azure.com',
      apiVersion: '2024-02-01'
    });
    assert(needed, 'all three issues should trigger migration');
    assertEqual(reasons.length, 3, 'should report all three reasons');
    assert(autoFix.deployment === null, 'deployment should be flagged for removal');
    assertEqual(autoFix.apiVersion, '2024-05-01-preview', 'API version should be auto-fixed');
  }

  // --- runMigrations integration tests ---
  // (store already set up at the top of run())

  // Empty storage → no warning
  {
    const { azureMigrationWarning } = await runMigrations();
    assertEqual(azureMigrationWarning, null, 'no azure settings → no warning');
  }

  // Seed old Azure OpenAI config directly into the store
  store.sync.providerSettings = {
    azure: {
      deployment: 'my-old-deployment',
      baseUrl: 'https://res.openai.azure.com',
      apiVersion: '2024-02-01',
      model: 'gpt-4o-mini'
    }
  };

  // Should return a migration warning
  {
    const { azureMigrationWarning } = await runMigrations();
    assert(azureMigrationWarning !== null, 'old config should return a migration warning');
    assert(azureMigrationWarning.includes('Deployment'), 'warning should mention deployment');
  }

  // deployment should be stripped, apiVersion rewritten, baseUrl preserved for manual fix
  {
    const azureAfter = store.sync.providerSettings?.azure;
    assert(!azureAfter?.deployment, 'deployment should be stripped from storage after migration');
    assert(azureAfter?.baseUrl === 'https://res.openai.azure.com', 'baseUrl should be preserved for manual fix');
    assertEqual(azureAfter?.apiVersion, '2024-05-01-preview', 'API version should be auto-updated to Foundry version');
    assertEqual(azureAfter?.model, 'gpt-4o-mini', 'model should be preserved');
  }

  // Second run on already-migrated config (only stale baseUrl remains) → still warns about URL
  {
    const { azureMigrationWarning } = await runMigrations();
    assert(azureMigrationWarning !== null, 'stale openai.azure.com URL should still warn');
    assert(azureMigrationWarning.includes('openai.azure.com'), 'warning should mention the stale URL');
  }

  // Clean config → no warning
  store.sync.providerSettings = {
    azure: {
      baseUrl: 'https://res.services.ai.azure.com',
      model: 'gpt-4o-mini',
      apiVersion: '2024-05-01-preview'
    }
  };
  {
    const { azureMigrationWarning } = await runMigrations();
    assertEqual(azureMigrationWarning, null, 'clean Foundry config should not warn');
  }

  resetGlobals();
  console.log('migrations tests passed');
}

run();
