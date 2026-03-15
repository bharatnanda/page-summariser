import { extractTextFromResponse } from '../responseParser.js';
import { readSseStream } from '../streaming.js';

/**
 * Resolve the chat completions path for a given Azure AI Foundry base URL.
 *
 * Azure AI Foundry has two distinct endpoint types:
 *
 *   1. AI Services multi-model endpoint  (*.services.ai.azure.com)
 *      → uses /models/chat/completions   (model name goes in the request body)
 *
 *   2. Serverless API / managed-compute  (*.models.ai.azure.com,
 *      *.inference.ml.azure.com, or any custom FQDN)
 *      → uses /chat/completions          (single-model endpoint)
 *
 * If the user already includes a path that ends with "chat/completions" we
 * leave it untouched so manually entered full URLs work as-is.
 *
 * @param {string} baseUrl
 * @returns {string}  Full URL including path (without api-version query param)
 */
function resolveAzureUrl(baseUrl) {
  const base = baseUrl.replace(/\/$/, "");

  // Already a full endpoint URL — use as-is
  if (/\/chat\/completions$/.test(base)) {
    console.debug("[Azure] url (passthrough):", base);
    return base;
  }

  try {
    const { hostname } = new URL(base);

    // AI Services multi-model endpoints — model name goes in the request body
    //   *.services.ai.azure.com       (new AI Services endpoint)
    //   *.cognitiveservices.azure.com (AI Services / legacy Cognitive Services)
    //   Note: cognitiveservices.azure.com is also used by Azure OpenAI resources;
    //   for those the old /openai/deployments/{name}/... path is needed, but that
    //   requires a deployment name which this provider no longer uses.
    if (
      hostname.endsWith(".services.ai.azure.com") ||
      hostname.endsWith(".cognitiveservices.azure.com")
    ) {
      const resolved = `${base}/models/chat/completions`;
      console.debug("[Azure] url (AI Services multi-model):", resolved);
      return resolved;
    }

    // Serverless / managed-compute single-model endpoints
    //   *.models.ai.azure.com        (Azure AI Foundry serverless deployment)
    //   *.inference.ml.azure.com     (Azure ML managed online endpoint)
    //   *.inference.ai.azure.com     (Azure AI inference)
    if (
      hostname.endsWith(".models.ai.azure.com") ||
      hostname.endsWith(".inference.ml.azure.com") ||
      hostname.endsWith(".inference.ai.azure.com")
    ) {
      const resolved = `${base}/chat/completions`;
      console.debug("[Azure] url (serverless single-model):", resolved);
      return resolved;
    }
  } catch (_) {
    // fall through to default
  }

  // Unknown endpoint pattern — default to single-model path
  const resolved = `${base}/chat/completions`;
  console.debug("[Azure] url (unknown endpoint, defaulting to single-model):", resolved);
  return resolved;
}

/**
 * Returns true when baseUrl resolves to a multi-model path (/models/chat/completions),
 * meaning the model name must be supplied in the request body.
 * Delegates to resolveAzureUrl so endpoint-type logic lives in one place.
 * @param {string} baseUrl
 * @returns {boolean}
 */
function isMultiModelEndpoint(baseUrl) {
  try {
    return resolveAzureUrl(baseUrl).includes("/models/chat/completions");
  } catch (_) {
    return false;
  }
}

function validateAzureSettings(settings) {
  if (!settings.apiKey) throw new Error("Azure API key is missing. Please add your API key in the extension settings.");
  if (!settings.baseUrl) throw new Error("Azure base URL is missing. Please add your base URL in the extension settings.");
  if (!settings.apiVersion) throw new Error("Azure API version is missing. Please add your API version in the extension settings.");
  if (!settings.model && isMultiModelEndpoint(settings.baseUrl)) {
    throw new Error("Model name is required for Azure AI Services endpoints. Please set a model name in Settings (e.g. gpt-4o-mini).");
  }
}

function handleHttpError(res, url) {
  if (res.status === 401) return "Invalid API key. Please check your Azure API key in the extension settings.";
  if (res.status === 403) return "Access denied. Please check your Azure API key permissions.";
  if (res.status === 404) return `Endpoint not found (${url}). Common fixes: (1) API Version should be 2024-05-01-preview for Azure AI Services; (2) verify the model name matches your deployment exactly; (3) for cognitiveservices.azure.com the path must be /models/chat/completions — check the [Azure] log line in the Service Worker console.`;
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
  const url = `${resolveAzureUrl(baseUrl)}?api-version=${encodeURIComponent(apiVersion)}`;
  console.debug("[Azure] calling:", url, "| model:", model || "(none)");

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
    const errorMessage = data?.error?.message || handleHttpError(res, url);
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
  const url = `${resolveAzureUrl(baseUrl)}?api-version=${encodeURIComponent(apiVersion)}`;
  console.debug("[Azure] calling:", url, "| model:", model || "(none)");

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
    let errorMessage = handleHttpError(res, url);
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
