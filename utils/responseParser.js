/**
 * Extract plain text from provider-specific response payloads.
 * @param {any} data
 * @param {"openai"|"azure"|"gemini"|"ollama"} provider
 * @returns {string|null}
 */
export function extractTextFromResponse(data, provider) {
  if (!data) return null;

  if (["openai", "azure"].includes(provider)) {
    return data.choices?.[0]?.message?.content || data.choices?.[0]?.text || null;
  }

  if (provider === "gemini") {
    return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
  }

  if (provider === "ollama") {
    return data.message?.content || data.response || null;
  }

  return null;
}
