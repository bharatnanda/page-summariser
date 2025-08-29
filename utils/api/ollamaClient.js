import { extractTextFromResponse } from '../responseParser.js';

/**
 * Calls Ollama's /api/chat endpoint for summarization.
 * @param {string} prompt - The text prompt to summarize.
 * @param {object} settings - User's model settings.
 * @returns {Promise<string>} - Summary response.
 */
export async function callOllama(prompt, settings) {
  const { apiKey, baseUrl, model, temperature } = settings;

  const resolvedBaseUrl = baseUrl?.trim() || "http://localhost:11434";
  const url = `${resolvedBaseUrl.replace(/\/$/, "")}/api/chat`;

  const headers = {
    "Content-Type": "application/json"
  };

  // Optional API key support (disabled for local Ollama)
  // if (apiKey) {
  //   headers["Authorization"] = `Bearer ${apiKey}`;
  // }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: model || "gemma3n",
        messages: [{ role: "user", content: prompt.trim() }],
        options: {
          temperature: temperature ?? 0.7
        },
        stream: false
      })
    });

    const responseText = await res.text();
    console.log("Raw Ollama Response Text:", responseText);

    if (!responseText.trim()) {
      throw new Error("Ollama returned an empty response. Please check if Ollama is running and the model is available.");
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (jsonError) {
      console.error("Error parsing JSON response:", jsonError);
      throw new Error(`Failed to parse JSON from Ollama. This may indicate an issue with your Ollama setup. Response: ${responseText.substring(0, 200)}...`);
    }

    if (!res.ok) {
      const errorMessage = data?.error || res.statusText || 'Unknown error';
      
      // Provide more specific error messages
      if (res.status === 404) {
        throw new Error(`Model not found. Please check if the model "${model || "gemma3n"}" is available in Ollama.`);
      } else if (res.status >= 500) {
        throw new Error("Ollama service is temporarily unavailable. Please check if Ollama is running properly.");
      }
      
      throw new Error(`Ollama API Error (${res.status}): ${errorMessage}`);
    }

    return extractTextFromResponse(data, "ollama");
  } catch (error) {
    console.error("Error calling Ollama API:", error);
    
    // Provide more user-friendly error messages for common issues
    if (error.message.includes("fetch")) {
      throw new Error("Unable to connect to Ollama. Please ensure Ollama is installed and running on your system.");
    }
    
    throw error;
  }
}
