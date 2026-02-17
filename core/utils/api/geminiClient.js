import { extractTextFromResponse } from '../responseParser.js';
import { readSseStream } from '../streaming.js';

/**
 * Resolve a base URL to the Gemini REST endpoint.
 * Handles v1beta/v1 versioning automatically.
 * @param {string} baseUrl
 * @param {string} model
 * @param {boolean} stream
 * @returns {string}
 */
function resolveGeminiUrl(baseUrl, model, stream) {
  const endpoint = stream ? "streamGenerateContent" : "generateContent";
  // gemini-3 models currently use v1beta, but this may change to v1.
  const defaultVersion = "v1beta"; 

  if (!baseUrl) {
    return `https://generativelanguage.googleapis.com/${defaultVersion}/models/${encodeURIComponent(model)}:${endpoint}`;
  }

  try {
    const url = new URL(baseUrl);
    // Remove trailing slash for consistent handling
    let path = url.pathname.replace(/\/$/, "");

    // 1. If the user provided a fully qualified endpoint, trust it (just fix the method)
    if (path.endsWith(`:${endpoint}`)) return url.toString();
    
    // 2. Handle switching between generateContent and streamGenerateContent
    if (path.includes(":generateContent") || path.includes(":streamGenerateContent")) {
      path = path.replace(/:.*$/, `:${endpoint}`);
      url.pathname = path;
      return url.toString();
    }

    // 3. Robust reconstruction: If path contains model info, strip it to rebuild cleanly.
    if (path.includes("/models/")) {
      path = path.substring(0, path.indexOf("/models/"));
    }
    
    // 4. Ensure a valid API version exists in the path; default to v1beta if missing.
    // This adds compatibility for custom proxies that might omit the version.
    if (!path.match(/\/v1(beta|alpha)?$/)) {
       path = `${path}/${defaultVersion}`;
    }

    url.pathname = `${path}/models/${encodeURIComponent(model)}:${endpoint}`;
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
  // UPDATE: Default to Gemini 3 Flash (High speed, low cost, high reasoning)
  const geminiModel = model || "gemini-3-flash-preview";

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
      // Note: You can add { thinking_level: "high" } here for Gemini 3 hard tasks
    }),
    signal
  });

  const data = await res.json();
  
  if (!res.ok) {
    let errorMessage = data?.error?.message || res.statusText;
    
    if (res.status === 401) {
      errorMessage = "Invalid API key. Please check your Google Gemini API key settings.";
    } else if (res.status === 403) {
      errorMessage = "Access denied. Check your API key permissions (Vertex AI vs AI Studio).";
    } else if (res.status === 429) {
      errorMessage = "Rate limit exceeded. Wait a moment before trying again.";
    } else if (res.status >= 500) {
      errorMessage = "Google Gemini service is temporarily unavailable.";
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
  const geminiModel = model || "gemini-3-flash-preview";

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
      // Ignore JSON parse errors
    }
    
    // Simple error mapping
    if (res.status === 401) errorMessage = "Invalid API key.";
    else if (res.status === 429) errorMessage = "Rate limit exceeded.";

    throw new Error(`Google Gemini API error: ${errorMessage}`);
  }

  let fullText = "";
  
  await readSseStream(res, (event) => {
    // Gemini 3 Compatibility Fix:
    // Newer models send frames with 'usageMetadata' but NO 'candidates'.
    // Accessing event.candidates[0] blindly will crash.
    const parts = event?.candidates?.[0]?.content?.parts || [];
    
    // Filter parts: Gemini 3 may send "thought" parts or tool calls without text.
    // We strictly filter for parts that have a 'text' property.
    const delta = parts
      .filter(part => typeof part.text === 'string') 
      .map(part => part.text)
      .join("");
      
    if (delta) {
      fullText += delta;
      onDelta?.(delta, fullText);
    }
  });

  return fullText;
}