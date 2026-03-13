import { extractTextFromResponse } from '../responseParser.js';
import { readSseStream } from '../streaming.js';

/**
 * Validate required Azure AI Foundry settings.
 * @param {{ apiKey: string, baseUrl: string, apiVersion: string }} settings
 */
function validateAzureSettings(settings) {
  if (!settings.apiKey) throw new Error("Azure API key is missing. Please add your API key in the extension settings.");
  if (!settings.baseUrl) throw new Error("Azure base URL is missing. Please add your base URL in the extension settings.");
  if (!settings.apiVersion) throw new Error("Azure API version is missing. Please add your API version in the extension settings.");
}

function handleHttpError(res) {
  if (res.status === 401) return "Invalid API key. Please check your Azure API key in the extension settings.";
  if (res.status === 403) return "Access denied. Please check your Azure API key permissions.";
  if (res.status === 404) return "Model not found. Please check your Azure AI Foundry model name and endpoint in the extension settings.";
  if (res.status === 429) return "Rate limit exceeded. Please wait a moment before trying again.";
  if (res.status >= 500) return "Azure AI Foundry service is temporarily unavailable. Please try again later.";
  return res.statusText;
}

/**
 * Call Azure AI Foundry chat completions (non-streaming).
 *
 * Supports any model deployed on Azure AI Foundry / Azure AI Services,
 * including OpenAI models (GPT-4o, GPT-4.1, etc.) and third-party models
 * (Anthropic Claude, Meta Llama, Mistral, etc.).
 *
 * @param {string} prompt
 * @param {{ apiKey: string, baseUrl: string, apiVersion: string, model?: string }} settings
 * @param {AbortSignal} [signal]
 * @returns {Promise<string>}
 */
export async function callAzure(prompt, settings, signal) {
  validateAzureSettings(settings);

  const { apiKey, baseUrl, apiVersion, model } = settings;
  const url = `${baseUrl.replace(/\/$/, "")}/models/chat/completions?api-version=${encodeURIComponent(apiVersion)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "api-key": apiKey },
    body: JSON.stringify({
      messages: [{ role: "user", content: prompt }],
      model: model || undefined
    }),
    signal
  });

  const data = await res.json();
  if (!res.ok) {
    const errorMessage = data?.error?.message || handleHttpError(res);
    throw new Error(`Azure AI Foundry error: ${errorMessage}`);
  }
  return extractTextFromResponse(data, "azure");
}

/**
 * Call Azure AI Foundry chat completions with SSE streaming.
 *
 * Supports any model deployed on Azure AI Foundry / Azure AI Services,
 * including OpenAI models (GPT-4o, GPT-4.1, etc.) and third-party models
 * (Anthropic Claude, Meta Llama, Mistral, etc.).
 *
 * @param {string} prompt
 * @param {{ apiKey: string, baseUrl: string, apiVersion: string, model?: string }} settings
 * @param {(delta: string, fullText: string) => void} onDelta
 * @param {AbortSignal} [signal]
 * @returns {Promise<string>}
 */
export async function callAzureStream(prompt, settings, onDelta, signal) {
  validateAzureSettings(settings);

  const { apiKey, baseUrl, apiVersion, model } = settings;
  const url = `${baseUrl.replace(/\/$/, "")}/models/chat/completions?api-version=${encodeURIComponent(apiVersion)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "api-key": apiKey },
    body: JSON.stringify({
      messages: [{ role: "user", content: prompt }],
      model: model || undefined,
      stream: true
    }),
    signal
  });

  if (!res.ok) {
    let errorMessage = handleHttpError(res);
    try {
      const data = await res.json();
      errorMessage = data?.error?.message || errorMessage;
    } catch (_) {
      // ignore JSON parse errors
    }
    throw new Error(`Azure AI Foundry error: ${errorMessage}`);
  }

  let fullText = "";
  await readSseStream(res, (event) => {
    const delta = event?.choices?.[0]?.delta?.content;
    if (typeof delta === "string" && delta.length) {
      fullText += delta;
      onDelta?.(delta, fullText);
    }
  });

  return fullText;
}
