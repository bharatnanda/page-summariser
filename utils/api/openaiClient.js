import { extractTextFromResponse } from '../responseParser.js';
import { readSseStream } from '../streaming.js';

function resolveOpenAIUrl(baseUrl, path) {
  if (!baseUrl) return `https://api.openai.com/v1/${path}`;
  try {
    const url = new URL(baseUrl);
    if (url.pathname.endsWith('/chat/completions')) {
      url.pathname = `/v1/${path}`;
      return url.toString();
    }
    if (url.pathname.endsWith('/v1')) {
      url.pathname = `${url.pathname}/${path}`;
      return url.toString();
    }
    if (url.pathname.includes('/v1/')) {
      url.pathname = url.pathname.replace(/\/v1\/.*$/, `/v1/${path}`);
      return url.toString();
    }
    url.pathname = `${url.pathname.replace(/\/$/, '')}/v1/${path}`;
    return url.toString();
  } catch (error) {
    return baseUrl;
  }
}

export async function callOpenAI(prompt, settings) {
  const { apiKey, baseUrl, model } = settings;
  const url = baseUrl || "https://api.openai.com/v1/chat/completions";
  const resolvedModel = model || "gpt-4o-mini";
  const requestBody = {
    model: resolvedModel,
    messages: [{ role: "user", content: prompt }]
  };

  if (!apiKey) {
    throw new Error("OpenAI API key is missing. Please add your API key in the extension settings.");
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify(requestBody)
  });

  const data = await res.json();
  if (!res.ok) {
    let errorMessage = data?.error?.message || res.statusText;
    
    // Provide more specific error messages
    if (res.status === 401) {
      errorMessage = "Invalid API key. Please check your OpenAI API key in the extension settings.";
    } else if (res.status === 403) {
      errorMessage = "Access denied. Please check your OpenAI API key permissions.";
    } else if (res.status === 429) {
      errorMessage = "Rate limit exceeded. Please wait a moment before trying again.";
    } else if (res.status >= 500) {
      errorMessage = "OpenAI service is temporarily unavailable. Please try again later.";
    }
    
    throw new Error(`OpenAI API error: ${errorMessage}`);
  }
  return extractTextFromResponse(data, "openai");
}

export async function callOpenAIStream(prompt, settings, onDelta) {
  const { apiKey, baseUrl, model } = settings;
  const url = resolveOpenAIUrl(baseUrl, "responses");
  const resolvedModel = model || "gpt-4o-mini";
  const requestBody = {
    model: resolvedModel,
    input: prompt,
    stream: true
  };

  if (!apiKey) {
    throw new Error("OpenAI API key is missing. Please add your API key in the extension settings.");
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify(requestBody)
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
      errorMessage = "Invalid API key. Please check your OpenAI API key in the extension settings.";
    } else if (res.status === 403) {
      errorMessage = "Access denied. Please check your OpenAI API key permissions.";
    } else if (res.status === 429) {
      errorMessage = "Rate limit exceeded. Please wait a moment before trying again.";
    } else if (res.status >= 500) {
      errorMessage = "OpenAI service is temporarily unavailable. Please try again later.";
    }

    throw new Error(`OpenAI API error: ${errorMessage}`);
  }

  if (!res.body) {
    throw new Error("OpenAI API error: empty response stream.");
  }

  let fullText = "";
  await readSseStream(res, (event) => {
    if (event?.type === "response.output_text.delta" && typeof event.delta === "string") {
      fullText += event.delta;
      onDelta?.(event.delta, fullText);
      return;
    }
    if (event?.type === "response.output_text.done" && typeof event.text === "string") {
      fullText = event.text;
    }
  });

  return fullText;
}
