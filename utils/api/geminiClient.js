import { extractTextFromResponse } from '../responseParser.js';

export async function callGemini(prompt, settings) {
  const { apiKey, baseUrl, model, temperature } = settings;
  const geminiModel = model || "gemini-2.5-flash-lite-preview-06-17";

  if (!apiKey) {
    throw new Error("Google Gemini API key is missing. Please add your API key in the extension settings.");
  }

  const url = baseUrl
    ? `${baseUrl.replace(/\/$/, "")}/v1beta/models/${encodeURIComponent(geminiModel)}:generateContent`
    : `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(geminiModel)}:generateContent`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-goog-api-key": apiKey
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature }
    })
  });

  const data = await res.json();
  if (!res.ok) {
    let errorMessage = data?.error?.message || res.statusText;
    
    // Provide more specific error messages
    if (res.status === 401) {
      errorMessage = "Invalid API key. Please check your Google Gemini API key in the extension settings.";
    } else if (res.status === 403) {
      errorMessage = "Access denied. Please check your Google Gemini API key permissions.";
    } else if (res.status === 429) {
      errorMessage = "Rate limit exceeded. Please wait a moment before trying again.";
    } else if (res.status >= 500) {
      errorMessage = "Google Gemini service is temporarily unavailable. Please try again later.";
    }
    
    throw new Error(`Google Gemini API error: ${errorMessage}`);
  }
  return extractTextFromResponse(data, "gemini");
}
