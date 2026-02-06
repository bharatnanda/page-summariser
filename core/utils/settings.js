import { platform } from '../platform.js';
import { DEFAULT_BLACKLIST } from './defaultBlacklist.js';

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
 * @property {"openai"|"azure"|"gemini"|"ollama"} provider
 * @property {string} apiKey
 * @property {string} baseUrl
 * @property {string} deployment
 * @property {string} apiVersion
 * @property {string} model
 * @property {string} language
 * @property {string} blacklistedUrls
 * @property {string} defaultBlacklistedUrls
 * @property {boolean} disableStreamingOnSafari
 */

/**
 * Load and normalize persisted settings.
 * @returns {Promise<Settings>}
 */

export async function getSettings() {
  const keys = ["provider", "providerSettings", "apiKey", "baseUrl", "deployment", "apiVersion", "model", "language", "blacklistedUrls", "defaultBlacklistedUrls", "defaultBlacklistInitialized"];
  let settings = {};
  try {
    settings = await platform.storage.get('sync', keys);
  } catch (error) {
    console.warn("Sync storage unavailable, falling back to local storage.", error);
    settings = await platform.storage.get('local', keys);
  }
  const disableStreamingOnSafari = platform.isSafari;

  const provider = (settings.provider || "openai").toLowerCase();
  const providerSettings = settings.providerSettings || {};
  const resolved = providerSettings[provider] || {
    apiKey: settings.apiKey || "",
    baseUrl: settings.baseUrl || "",
    deployment: settings.deployment || "",
    apiVersion: settings.apiVersion || "",
    model: settings.model || ""
  };

  return {
    provider,
    apiKey: (resolved.apiKey || "").trim(),
    baseUrl: (resolved.baseUrl || "").trim(),
    deployment: (resolved.deployment || "").trim(),
    apiVersion: (resolved.apiVersion || "").trim(),
    model: (resolved.model || "").trim(),
    language: (settings.language || "").trim(),
    blacklistedUrls: (settings.blacklistedUrls || "").trim(),
    defaultBlacklistedUrls: await resolveDefaultBlacklist(settings),
    disableStreamingOnSafari,
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
