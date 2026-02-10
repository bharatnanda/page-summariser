/**
 * Extract plain text from provider-specific response payloads.
 * @param {any} data
 * @param {"openai"|"azure"|"gemini"|"ollama"} provider
 * @returns {string|null}
 */
export function extractTextFromResponse(data, provider) {
  if (!data) return null;

  if (["openai", "azure"].includes(provider)) {
    if (provider === "openai" && Array.isArray(data.output)) {
      const parts = [];
      for (const item of data.output) {
        if (item?.type !== "message") continue;
        for (const content of item.content || []) {
          if (content?.type === "output_text" && typeof content.text === "string") {
            parts.push(content.text);
          }
        }
      }
      if (parts.length) return parts.join("");
    }
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
