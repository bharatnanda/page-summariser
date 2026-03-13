import { platform } from '../platform.js';

/**
 * Detect whether stored Azure settings look like the old Azure OpenAI format
 * (deployment-based, *.openai.azure.com endpoint) that is no longer supported.
 *
 * Azure provider now exclusively uses Azure AI Foundry:
 *   {baseUrl}/models/chat/completions?api-version={apiVersion}
 *
 * @param {Record<string, any>} azureSettings  providerSettings.azure from storage
 * @returns {{ needed: boolean, reasons: string[] }}
 */
export function detectAzureMigration(azureSettings) {
  if (!azureSettings) return { needed: false, reasons: [] };

  const reasons = [];

  if (azureSettings.deployment) {
    reasons.push(
      "Deployment name is no longer used. Azure now uses Azure AI Foundry — set a Model name instead."
    );
  }

  const baseUrl = (azureSettings.baseUrl || "").toLowerCase();
  if (baseUrl && baseUrl.includes(".openai.azure.com")) {
    reasons.push(
      "Base URL looks like an Azure OpenAI endpoint (*.openai.azure.com). " +
      "Please update it to your Azure AI Foundry endpoint (*.services.ai.azure.com)."
    );
  }

  return { needed: reasons.length > 0, reasons };
}

/**
 * Run all storage migrations. Safe to call on every startup — each migration
 * is idempotent and only writes when it actually changes something.
 *
 * Current migrations:
 *   1. Azure: clear the `deployment` field from providerSettings.azure so the
 *      new Foundry-only client doesn't receive it. Flags stale base URLs for
 *      manual review (cannot be auto-migrated — the endpoint is different).
 *
 * @returns {Promise<{ azureMigrationWarning: string | null }>}
 */
export async function runMigrations() {
  let syncItems = {};
  try {
    syncItems = await platform.storage.get('sync', ['providerSettings', 'provider']) || {};
  } catch (_) {
    return { azureMigrationWarning: null };
  }

  const providerSettings = syncItems.providerSettings || {};
  const azureSettings = providerSettings.azure;

  const { needed, reasons } = detectAzureMigration(azureSettings);

  if (!needed) return { azureMigrationWarning: null };

  // Auto-migrate: strip `deployment` — it has no meaning in Foundry mode and
  // leaving it in storage would just be confusing. Base URL cannot be changed
  // automatically since the Foundry endpoint is completely different.
  if (azureSettings?.deployment) {
    const { deployment, ...azureWithoutDeployment } = azureSettings;
    const updatedProviderSettings = {
      ...providerSettings,
      azure: azureWithoutDeployment
    };
    try {
      await platform.storage.set('sync', { providerSettings: updatedProviderSettings });
    } catch (_) {
      // Non-fatal — migration will re-run next time
    }
  }

  return {
    azureMigrationWarning: reasons.join(" ")
  };
}
