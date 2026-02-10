import { extractTextFromResponse } from '../responseParser.js';
import { readSseStream } from '../streaming.js';

/**
 * Resolve a base URL to the Gemini REST endpoint.
 * @param {string} baseUrl
 * @param {string} model
 * @param {boolean} stream
 * @returns {string}
 */
function resolveGeminiUrl(baseUrl, model, stream) {
  const endpoint = stream ? "streamGenerateContent" : "generateContent";
  if (!baseUrl) {
    return `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:${endpoint}`;
  }

  try {
    const url = new URL(baseUrl);
    const path = url.pathname.replace(/\/$/, "");
    if (path.endsWith(`:${endpoint}`) || path.endsWith(":generateContent") || path.endsWith(":streamGenerateContent")) {
      return url.toString();
    }
    if (path.includes("/v1beta/models/") && path.includes(":")) {
      return url.toString();
    }
    if (path.endsWith("/v1beta")) {
      url.pathname = `${path}/models/${encodeURIComponent(model)}:${endpoint}`;
      return url.toString();
    }
    if (path.includes("/v1beta/")) {
      url.pathname = path.replace(/\/v1beta\/.*$/, `/v1beta/models/${encodeURIComponent(model)}:${endpoint}`);
      return url.toString();
    }
    url.pathname = `${path}/v1beta/models/${encodeURIComponent(model)}:${endpoint}`;
    return url.toString();
  } catch (error) {
    return baseUrl;
  }
}

/**
 * Call Gemini generateContent (non-streaming).
 * @param {string} prompt
 * @param {{ apiKey: string, baseUrl?: string, model?: string }} settings
 * @param {AbortSignal} [signal]
 * @returns {Promise<string>}
 */
export async function callGemini(prompt, settings, signal) {
  const { apiKey, baseUrl, model } = settings;
  const geminiModel = model || "gemini-2.5-flash";

  if (!apiKey) {
    throw new Error("Google Gemini API key is missing. Please add your API key in the extension settings.");
  }

  const url = resolveGeminiUrl(baseUrl, geminiModel, false);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-goog-api-key": apiKey
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }]
    }),
    signal
  });

  const data = await res.json();
  if (!res.ok) {
    let errorMessage = data?.error?.message || res.statusText;
    
    // Provide more specific error messages
    if (res.status === 401) {
      errorMessage = "Invalid API key. Please check your Google Gemini API key in the extension settings.";
    } else if (res.status === 403) {
      errorMessage = "Access denied. Please check your Google Gemini API key permissions.";
    } else if (res.status === 429) {
      errorMessage = "Rate limit exceeded. Please wait a moment before trying again.";
    } else if (res.status >= 500) {
      errorMessage = "Google Gemini service is temporarily unavailable. Please try again later.";
    }
    
    throw new Error(`Google Gemini API error: ${errorMessage}`);
  }
  return extractTextFromResponse(data, "gemini");
}

/**
 * Call Gemini streamGenerateContent with SSE streaming.
 * @param {string} prompt
 * @param {{ apiKey: string, baseUrl?: string, model?: string }} settings
 * @param {(delta: string, fullText: string) => void} onDelta
 * @param {AbortSignal} [signal]
 * @returns {Promise<string>}
 */
export async function callGeminiStream(prompt, settings, onDelta, signal) {
  const { apiKey, baseUrl, model } = settings;
  const geminiModel = model || "gemini-2.5-flash";

  if (!apiKey) {
    throw new Error("Google Gemini API key is missing. Please add your API key in the extension settings.");
  }

  const streamUrl = resolveGeminiUrl(baseUrl, geminiModel, true);
  const urlObject = new URL(streamUrl);
  urlObject.searchParams.set("alt", "sse");
  const url = urlObject.toString();

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-goog-api-key": apiKey
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }]
    }),
    signal
  });

  if (!res.ok) {
    let errorMessage = res.statusText;
    try {
      const data = await res.json();
      errorMessage = data?.error?.message || errorMessage;
    } catch (error) {
      // Ignore JSON parse errors and use statusText instead.
    }

    if (res.status === 401) {
      errorMessage = "Invalid API key. Please check your Google Gemini API key in the extension settings.";
    } else if (res.status === 403) {
      errorMessage = "Access denied. Please check your Google Gemini API key permissions.";
    } else if (res.status === 429) {
      errorMessage = "Rate limit exceeded. Please wait a moment before trying again.";
    } else if (res.status >= 500) {
      errorMessage = "Google Gemini service is temporarily unavailable. Please try again later.";
    }

    throw new Error(`Google Gemini API error: ${errorMessage}`);
  }

  let fullText = "";
  await readSseStream(res, (event) => {
    const parts = event?.candidates?.[0]?.content?.parts || [];
    const delta = parts.map(part => part?.text || "").join("");
    if (delta) {
      fullText += delta;
      onDelta?.(delta, fullText);
    }
  });

  return fullText;
}
