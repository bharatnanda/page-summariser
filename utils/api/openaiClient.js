import { extractTextFromResponse } from '../responseParser.js';

export async function callOpenAI(prompt, settings) {
  const { apiKey, baseUrl, model, temperature } = settings;
  const url = baseUrl || "https://api.openai.com/v1/chat/completions";

  if (!apiKey) {
    throw new Error("OpenAI API key is missing. Please add your API key in the extension settings.");
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model || "gpt-4o-mini",
      temperature,
      messages: [{ role: "user", content: prompt }]
    })
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
