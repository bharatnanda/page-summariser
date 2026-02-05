import { platform } from '../platform.js';

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
  const keys = ["provider", "providerSettings", "apiKey", "baseUrl", "deployment", "apiVersion", "model", "language", "blacklistedUrls", "defaultBlacklistedUrls"];
  const settings = await platform.storage.get('sync', keys);
  const ua = globalThis?.navigator?.userAgent || "";
  const isSafari = /Safari/i.test(ua) && !/Chrome|Chromium|Edg|OPR/i.test(ua);
  const disableStreamingOnSafari = isSafari;

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
    defaultBlacklistedUrls: (settings.defaultBlacklistedUrls || "").trim(),
    disableStreamingOnSafari,
  };
}
