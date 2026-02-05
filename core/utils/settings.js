/**
 * Load and normalize persisted settings.
 * @returns {Promise<{
 *   provider: string,
 *   apiKey: string,
 *   baseUrl: string,
 *   deployment: string,
 *   apiVersion: string,
 *   model: string,
 *   language: string,
 *   blacklistedUrls: string,
 *   defaultBlacklistedUrls: string,
 *   disableStreamingOnSafari: boolean
 * }>}
 */
export async function getSettings() {
  const keys = ["provider", "providerSettings", "apiKey", "baseUrl", "deployment", "apiVersion", "model", "language", "blacklistedUrls", "defaultBlacklistedUrls", "disableStreamingOnSafari"];
  const settings = await new Promise(res => chrome.storage.sync.get(keys, res));
  const ua = globalThis?.navigator?.userAgent || "";
  const isSafari = /Safari/i.test(ua) && !/Chrome|Chromium|Edg|OPR/i.test(ua);
  const disableStreamingOnSafari = settings.disableStreamingOnSafari !== undefined
    ? Boolean(settings.disableStreamingOnSafari)
    : isSafari;

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
