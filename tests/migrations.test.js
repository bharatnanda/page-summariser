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
      model: ''
    }
  };

  // Should return a migration warning
  {
    const { azureMigrationWarning } = await runMigrations();
    assert(azureMigrationWarning !== null, 'old config should return a migration warning');
    assert(azureMigrationWarning.includes('Deployment'), 'warning should mention deployment');
  }

  // deployment should have been stripped from storage; baseUrl preserved for manual fix
  {
    const azureAfter = store.sync.providerSettings?.azure;
    assert(!azureAfter?.deployment, 'deployment should be stripped from storage after migration');
    assert(azureAfter?.baseUrl === 'https://res.openai.azure.com', 'baseUrl should be preserved for manual fix');
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
