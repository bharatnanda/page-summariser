import { extractTextFromResponse } from '../responseParser.js';
import { readSseStream } from '../streaming.js';

/**
 * Call Azure OpenAI chat completions (non-streaming).
 * @param {string} prompt
 * @param {{ apiKey: string, baseUrl: string, deployment: string, apiVersion: string, model?: string }} settings
 * @returns {Promise<string>}
 */
export async function callAzure(prompt, settings) {
  const { apiKey, baseUrl, deployment, apiVersion, model } = settings;

  if (!apiKey) {
    throw new Error("Azure OpenAI API key is missing. Please add your API key in the extension settings.");
  }

  if (!baseUrl) {
    throw new Error("Azure OpenAI base URL is missing. Please add your base URL in the extension settings.");
  }

  if (!deployment) {
    throw new Error("Azure OpenAI deployment name is missing. Please add your deployment name in the extension settings.");
  }

  if (!apiVersion) {
    throw new Error("Azure OpenAI API version is missing. Please add your API version in the extension settings.");
  }

  const url = `${baseUrl.replace(/\/$/, "")}/openai/deployments/${encodeURIComponent(deployment)}/chat/completions?api-version=${encodeURIComponent(apiVersion)}`;

  const requestBody = {
    messages: [{ role: "user", content: prompt }],
    model: model || undefined
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": apiKey
    },
    body: JSON.stringify(requestBody)
  });

  const data = await res.json();
  if (!res.ok) {
    let errorMessage = data?.error?.message || res.statusText;
    
    // Provide more specific error messages
    if (res.status === 401) {
      errorMessage = "Invalid API key. Please check your Azure OpenAI API key in the extension settings.";
    } else if (res.status === 403) {
      errorMessage = "Access denied. Please check your Azure OpenAI API key permissions.";
    } else if (res.status === 404) {
      errorMessage = "Deployment not found. Please check your Azure OpenAI deployment name in the extension settings.";
    } else if (res.status === 429) {
      errorMessage = "Rate limit exceeded. Please wait a moment before trying again.";
    } else if (res.status >= 500) {
      errorMessage = "Azure OpenAI service is temporarily unavailable. Please try again later.";
    }
    
    throw new Error(`Azure OpenAI API error: ${errorMessage}`);
  }
  return extractTextFromResponse(data, "azure");
}

/**
 * Call Azure OpenAI chat completions with SSE streaming.
 * @param {string} prompt
 * @param {{ apiKey: string, baseUrl: string, deployment: string, apiVersion: string, model?: string }} settings
 * @param {(delta: string, fullText: string) => void} onDelta
 * @returns {Promise<string>}
 */
export async function callAzureStream(prompt, settings, onDelta) {
  const { apiKey, baseUrl, deployment, apiVersion, model } = settings;

  if (!apiKey) {
    throw new Error("Azure OpenAI API key is missing. Please add your API key in the extension settings.");
  }

  if (!baseUrl) {
    throw new Error("Azure OpenAI base URL is missing. Please add your base URL in the extension settings.");
  }

  if (!deployment) {
    throw new Error("Azure OpenAI deployment name is missing. Please add your deployment name in the extension settings.");
  }

  if (!apiVersion) {
    throw new Error("Azure OpenAI API version is missing. Please add your API version in the extension settings.");
  }

  const url = `${baseUrl.replace(/\/$/, "")}/openai/deployments/${encodeURIComponent(deployment)}/chat/completions?api-version=${encodeURIComponent(apiVersion)}`;

  const requestBody = {
    messages: [{ role: "user", content: prompt }],
    model: model || undefined,
    stream: true
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": apiKey
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
      errorMessage = "Invalid API key. Please check your Azure OpenAI API key in the extension settings.";
    } else if (res.status === 403) {
      errorMessage = "Access denied. Please check your Azure OpenAI API key permissions.";
    } else if (res.status === 404) {
      errorMessage = "Deployment not found. Please check your Azure OpenAI deployment name in the extension settings.";
    } else if (res.status === 429) {
      errorMessage = "Rate limit exceeded. Please wait a moment before trying again.";
    } else if (res.status >= 500) {
      errorMessage = "Azure OpenAI service is temporarily unavailable. Please try again later.";
    }

    throw new Error(`Azure OpenAI API error: ${errorMessage}`);
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
