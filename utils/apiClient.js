import { callOpenAI } from './api/openaiClient.js';
import { callAzure } from './api/azureClient.js';
import { callGemini } from './api/geminiClient.js';
import { callOllama } from './api/ollamaClient.js';

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
