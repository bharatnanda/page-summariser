import { readSseStream } from '../streaming.js';

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

function buildHeaders(apiKey) {
  return {
    "Content-Type": "application/json",
    "x-api-key": apiKey,
    "anthropic-version": ANTHROPIC_VERSION
  };
}

function buildBody(prompt, model, extra = {}) {
  return {
    model: model || "claude-haiku-4-5-20251001",
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
    ...extra
  };
}

function handleHttpError(res) {
  if (res.status === 401) {
    return "Invalid API key. Please check your Anthropic API key in the extension settings.";
  }
  if (res.status === 403) {
    return "Access denied. Please check your Anthropic API key permissions.";
  }
  if (res.status === 429) {
    return "Rate limit exceeded. Please wait a moment before trying again.";
  }
  if (res.status >= 500) {
    return "Anthropic service is temporarily unavailable. Please try again later.";
  }
  return res.statusText;
}

/**
 * Call Anthropic Messages API (non-streaming).
 * @param {string} prompt
 * @param {{ apiKey: string, model?: string }} settings
 * @param {AbortSignal} [signal]
 * @returns {Promise<string>}
 */
export async function callAnthropic(prompt, settings, signal) {
  const { apiKey, model } = settings;

  if (!apiKey) {
    throw new Error("Anthropic API key is missing. Please add your API key in the extension settings.");
  }

  const res = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: buildHeaders(apiKey),
    body: JSON.stringify(buildBody(prompt, model)),
    signal
  });

  const data = await res.json();
  if (!res.ok) {
    const errorMessage = data?.error?.message || handleHttpError(res);
    throw new Error(`Anthropic API error: ${errorMessage}`);
  }

  return data.content?.[0]?.text || "";
}

/**
 * Call Anthropic Messages API with SSE streaming.
 * @param {string} prompt
 * @param {{ apiKey: string, model?: string }} settings
 * @param {(delta: string, fullText: string) => void} onDelta
 * @param {AbortSignal} [signal]
 * @returns {Promise<string>}
 */
export async function callAnthropicStream(prompt, settings, onDelta, signal) {
  const { apiKey, model } = settings;

  if (!apiKey) {
    throw new Error("Anthropic API key is missing. Please add your API key in the extension settings.");
  }

  const res = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: buildHeaders(apiKey),
    body: JSON.stringify(buildBody(prompt, model, { stream: true })),
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
    throw new Error(`Anthropic API error: ${errorMessage}`);
  }

  if (!res.body) {
    throw new Error("Anthropic API error: empty response stream.");
  }

  let fullText = "";
  await readSseStream(res, (event) => {
    if (event?.type === "content_block_delta" && event?.delta?.type === "text_delta") {
      const delta = event.delta.text || "";
      if (delta) {
        fullText += delta;
        onDelta?.(delta, fullText);
      }
    }
  });

  return fullText;
}
