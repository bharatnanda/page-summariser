import { platform } from '../platform.js';

// Azure OpenAI API versions that predate the Azure AI Foundry inference API.
// These versions only work with /openai/deployments/{name}/chat/completions and
// will 404 against the /models/chat/completions endpoint.
const LEGACY_AZURE_API_VERSIONS = new Set([
  "2022-12-01",
  "2023-03-15-preview",
  "2023-05-15",
  "2023-06-01-preview",
  "2023-07-01-preview",
  "2023-08-01-preview",
  "2023-09-01-preview",
  "2023-12-01-preview",
  "2024-02-01",
  "2024-02-15-preview",
  "2024-03-01-preview",
  "2024-04-01-preview",
  "2024-06-01",
  "2024-07-01-preview",
  "2024-08-01-preview",
  "2024-09-01-preview",
  "2024-10-01-preview",
  "2024-10-21",
  "2024-12-01-preview",
]);

const FOUNDRY_API_VERSION = "2024-05-01-preview";

/**
 * Detect whether stored Azure settings look like the old Azure OpenAI format
 * (deployment-based, *.openai.azure.com endpoint, or legacy API version)
 * that is no longer supported.
 *
 * Azure provider now exclusively uses Azure AI Foundry:
 *   {baseUrl}/models/chat/completions?api-version=2024-05-01-preview
 *
 * @param {Record<string, any>} azureSettings  providerSettings.azure from storage
 * @returns {{ needed: boolean, autoFix: Record<string,any>, reasons: string[] }}
 */
export function detectAzureMigration(azureSettings) {
  if (!azureSettings) return { needed: false, autoFix: {}, reasons: [] };

  const reasons = [];
  const autoFix = {};

  if (azureSettings.deployment) {
    reasons.push(
      "Deployment name is no longer used. Azure now uses Azure AI Foundry — set a Model name instead."
    );
    autoFix.deployment = null; // signals removal
  }

  const baseUrl = (azureSettings.baseUrl || "").toLowerCase();
  if (baseUrl && baseUrl.includes(".openai.azure.com")) {
    reasons.push(
      "Base URL looks like an Azure OpenAI endpoint (*.openai.azure.com). " +
      "Please update it to your Azure AI Foundry endpoint (*.services.ai.azure.com)."
    );
    // Cannot auto-fix — the Foundry endpoint is a different resource
  }

  const apiVersion = (azureSettings.apiVersion || "").trim();
  if (apiVersion && LEGACY_AZURE_API_VERSIONS.has(apiVersion)) {
    reasons.push(
      `API Version "${apiVersion}" is an Azure OpenAI version that does not work with Azure AI Foundry. ` +
      `It has been automatically updated to ${FOUNDRY_API_VERSION}.`
    );
    autoFix.apiVersion = FOUNDRY_API_VERSION;
  }

  return { needed: reasons.length > 0, autoFix, reasons };
}

/**
 * Run all storage migrations. Safe to call on every startup — each migration
 * is idempotent and only writes when it actually changes something.
 *
 * Current migrations:
 *   1. Azure: strip the `deployment` field (no longer used in Foundry mode)
 *   2. Azure: rewrite legacy Azure OpenAI API versions to 2024-05-01-preview
 *   3. Azure: flag stale *.openai.azure.com base URLs for manual update
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

  const { needed, autoFix, reasons } = detectAzureMigration(azureSettings);

  if (!needed) return { azureMigrationWarning: null };

  // Apply all auto-fixes in a single storage write
  const hasAutoFix = Object.keys(autoFix).length > 0;
  if (hasAutoFix) {
    const azurePatched = { ...azureSettings };
    if ('deployment' in autoFix) delete azurePatched.deployment;
    if (autoFix.apiVersion) azurePatched.apiVersion = autoFix.apiVersion;

    try {
      await platform.storage.set('sync', {
        providerSettings: { ...providerSettings, azure: azurePatched }
      });
    } catch (_) {
      // Non-fatal — migration will re-run next time
    }
  }

  // Only surface reasons that require manual action (auto-fixed ones are informational)
  const manualReasons = reasons.filter(r =>
    !r.includes("automatically updated")
  );

  return {
    azureMigrationWarning: manualReasons.length > 0 ? manualReasons.join(" ") : null
  };
}
