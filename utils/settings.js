export async function getSettings() {
  const keys = ["provider", "apiKey", "baseUrl", "deployment", "apiVersion", "model", "language", "temperature", "blacklistedUrls", "defaultBlacklistedUrls"];
  const settings = await new Promise(res => chrome.storage.sync.get(keys, res));

  return {
    provider: (settings.provider || "openai").toLowerCase(),
    apiKey: (settings.apiKey || "").trim(),
    baseUrl: (settings.baseUrl || "").trim(),
    deployment: (settings.deployment || "").trim(),
    apiVersion: (settings.apiVersion || "").trim(),
    model: (settings.model || "").trim(),
    language: (settings.language || "").trim(),
    temperature: typeof settings.temperature === "number" ? settings.temperature : 0.7,
    blacklistedUrls: (settings.blacklistedUrls || "").trim(),
    defaultBlacklistedUrls: (settings.defaultBlacklistedUrls || "").trim(),
  };
}
