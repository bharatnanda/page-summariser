import { callOpenAI, callOpenAIStream } from './api/openaiClient.js';
import { callAzure, callAzureStream } from './api/azureClient.js';
import { callGemini, callGeminiStream } from './api/geminiClient.js';
import { callOllama, callOllamaStream } from './api/ollamaClient.js';

function isSafariRuntime() {
  const ua = globalThis?.navigator?.userAgent || "";
  return /Safari/i.test(ua) && !/Chrome|Chromium|Edg|OPR/i.test(ua);
}

function shouldDisableStreaming(settings) {
  return isSafariRuntime() && settings?.disableStreamingOnSafari;
}

/**
 * Fetch a full summary response (non-streaming).
 * @param {string} prompt
 * @param {{ provider: string }} settings
 * @returns {Promise<string>}
 */
export async function fetchSummary(prompt, settings) {
  try {
    switch (settings.provider) {
      case "openai":
        return await callOpenAI(prompt, settings);
      case "azure":
        return await callAzure(prompt, settings);
      case "gemini":
        return await callGemini(prompt, settings);
      case "ollama":
        return await callOllama(prompt, settings);
      default:
        throw new Error(`Unsupported provider: ${settings.provider}. Please select a valid provider in the extension settings.`);
    }
  } catch (error) {
    console.error(`Error fetching summary from ${settings.provider}:`, error);
    // Re-throw with a more user-friendly message
    throw new Error(`Failed to generate summary using ${settings.provider}: ${error.message}`);
  }
}

/**
 * Stream a summary response when supported by the provider.
 * @param {string} prompt
 * @param {{ provider: string }} settings
 * @param {(delta: string, fullText: string) => void} onDelta
 * @returns {Promise<string>}
 */
export async function fetchSummaryStream(prompt, settings, onDelta) {
  try {
    if (shouldDisableStreaming(settings)) {
      const summary = await fetchSummary(prompt, settings);
      if (onDelta && summary) {
        onDelta(summary, summary);
      }
      return summary;
    }
    switch (settings.provider) {
      case "openai":
        return await callOpenAIStream(prompt, settings, onDelta);
      case "azure":
        return await callAzureStream(prompt, settings, onDelta);
      case "gemini":
        return await callGeminiStream(prompt, settings, onDelta);
      case "ollama":
        return await callOllamaStream(prompt, settings, onDelta);
      default: {
        const summary = await fetchSummary(prompt, settings);
        if (onDelta && summary) {
          onDelta(summary, summary);
        }
        return summary;
      }
    }
  } catch (error) {
    console.error(`Error streaming summary from ${settings.provider}:`, error);
    throw new Error(`Failed to generate summary using ${settings.provider}: ${error.message}`);
  }
}
