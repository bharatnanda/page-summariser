import { platform } from '../platform.js';
import { DEFAULT_BLACKLIST } from './defaultBlacklist.js';
import { runMigrations } from './migrations.js';

/**
 * @typedef {Object} ProviderSettings
 * @property {string} apiKey
 * @property {string} baseUrl
 * @property {string} deployment
 * @property {string} apiVersion
 * @property {string} model
 */

/**
 * @typedef {Object} Settings
 * @property {"openai"|"azure"|"gemini"|"ollama"|"anthropic"} provider
 * @property {string} apiKey
 * @property {string} baseUrl
 * @property {string} apiVersion
 * @property {string} model
 * @property {string} language
 * @property {"default"|"compact"} promptProfile
 * @property {boolean} useExtractionEngine
 * @property {string} blacklistedUrls
 * @property {string} defaultBlacklistedUrls
 * @property {boolean} disableStreamingOnSafari
 * @property {string|null} migrationWarning  Non-null when provider config needs manual update
 */

/**
 * Load and normalize persisted settings.
 * @returns {Promise<Settings>}
 */

export async function getSettings() {
  const keys = ["provider", "providerSettings", "providerApiKeys", "apiKey", "baseUrl", "apiVersion", "model", "language", "promptProfile", "useExtractionEngine", "blacklistedUrls", "defaultBlacklistedUrls", "defaultBlacklistInitialized", "syncApiKeys"];
  let settings = {};
  let localSettings = {};
  try {
    const [syncValues, localValues] = await Promise.all([
      platform.storage.get('sync', keys),
      platform.storage.get('local', ['providerApiKeys', 'apiKey'])
    ]);
    settings = syncValues || {};
    localSettings = localValues || {};
  } catch (error) {
    console.warn("Sync storage unavailable, falling back to local storage.", error);
    settings = await platform.storage.get('local', keys);
    localSettings = settings;
  }
  const disableStreamingOnSafari = platform.isSafari;

  const provider = (settings.provider || "openai").toLowerCase();
  const providerSettings = settings.providerSettings || {};
  const providerApiKeysLocal = localSettings.providerApiKeys || {};
  const providerApiKeysSync = settings.providerApiKeys || {};
  const syncApiKeys = Boolean(settings.syncApiKeys);
  const resolved = providerSettings[provider] || {
    apiKey: settings.apiKey || "",
    baseUrl: settings.baseUrl || "",
    apiVersion: settings.apiVersion || "",
    model: settings.model || ""
  };

  const { azureMigrationWarning } = await runMigrations();
  const migrationWarning = (provider === "azure" && azureMigrationWarning) ? azureMigrationWarning : null;

  return {
    provider,
    apiKey: (providerApiKeysLocal[provider] || (syncApiKeys ? (providerApiKeysSync[provider] || resolved.apiKey || "") : "") || "").trim(),
    baseUrl: (resolved.baseUrl || "").trim(),
    apiVersion: (resolved.apiVersion || "").trim(),
    model: (resolved.model || "").trim(),
    language: (settings.language || "").trim(),
    promptProfile: settings.promptProfile === "compact" ? "compact" : "default",
    useExtractionEngine: Boolean(settings.useExtractionEngine),
    blacklistedUrls: (settings.blacklistedUrls || "").trim(),
    defaultBlacklistedUrls: await resolveDefaultBlacklist(settings),
    disableStreamingOnSafari,
    migrationWarning,
  };
}

async function resolveDefaultBlacklist(settings) {
  const current = (settings.defaultBlacklistedUrls || "").trim();
  if (current) return current;
  if (settings.defaultBlacklistInitialized) return "";

  const seeded = DEFAULT_BLACKLIST;
  const value = { defaultBlacklistedUrls: seeded, defaultBlacklistInitialized: true };

  try {
    await platform.storage.set('sync', value);
  } catch (error) {
    await platform.storage.set('local', value);
  }

  return seeded;
}
