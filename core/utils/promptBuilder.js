/**
 * Clamp content length based on provider limits to reduce token usage.
 * @param {string} content
 * @param {import('./settings.js').Settings} settings
 * @returns {string}
 */
export function clampContentForProvider(content, settings) {
  if (!content) return "";

  const provider = (settings?.provider || "").toLowerCase();
  let maxChars = 60000;

  if (provider === "gemini" || provider === "ollama") {
    maxChars = 30000;
  } else if (provider === "openai" || provider === "azure") {
    maxChars = 50000;
  }

  return content.length > maxChars ? content.slice(0, maxChars) : content;
}

/**
 * Build the summarization prompt for the LLM.
 * @param {string} content
 * @param {string} language
 * @returns {string}
 */
function buildDefaultPrompt(content, language) {
  return `
You are a professional summarizer.  
Read the webpage content provided below and produce a clear, concise summary in ${language}.

## Hard Constraints
- Must keep the summary under **250 words**.
- Use **bullet points ('-') by default**; use short paragraphs only when needed or when bulleting harms clarity (especially in dense docs).
- Use a **table only** for comparative data or structured lists with **3+ similar items**.
- Use **bold** to emphasize the most important names, organizations, and key conclusions (avoid over-bolding).
- Wrap long URLs in angle brackets < > if included.

## Length Target (Adaptive)
Choose a target length based on page type and content length, while staying under 250 words:
- **Short pages or landing pages:** ~80-130 words.
- **Typical articles:** ~130-200 words.
- **Long docs or dense pages:** ~200-250 words.

## Page-Type Handling (Required)
First infer the page type and summarize accordingly:
- **Article/essay:** central thesis + key arguments + conclusion.
- **Homepage/feed/index:** digest the most important items; **do not force one narrative**.
- **Docs/reference:** purpose + key sections/concepts + how to use (if applicable).
- **Product/landing:** what it is, who it’s for, key features, pricing/CTA if present.
- **Mixed pages:** summarize the dominant content blocks.

## What to Include
- Main ideas/topics and key arguments (when applicable).
- Important facts, data points, outcomes, or conclusions.
- Overall purpose/intent (inform, persuade, critique, promote, document, etc.).
- Key entities: people, organizations, locations, events, products/tech/concepts.
- Author stance/tone **only if clearly expressed**.
- Calls to action/recommendations/proposed solutions (if present).
- Trends/comparisons/historical context **if relevant and present**.
- Implications/consequences **only if explicitly stated or clearly supported by the text** (no speculation).

### If the page includes code
- Summarize what the code does and any setup/config/dependencies.
- Include snippets only if they add clear value.
- Note warnings/best practices if mentioned.

### If the page includes mathematical expressions
- **Always convert** any mathematical notation to LaTeX — including formulas, equations, and expressions written with Unicode symbols (e.g. θ, α, ∇, ∑, subscripts, superscripts).
- Use $...$ for inline math and $$...$$ (on its own line) for block/display math.
- **Only use $ and $$ as delimiters.** Do NOT use ( ), \( \), [ ], or any other notation.
- Never write math as plain text or Unicode. Example: write $\theta_{new} = \theta_{old} - \alpha \nabla L(\theta)$ not θ_new = θ_old − α ∇L(θ).

## What to Exclude (Strict)
- Navigation menus, headers/footers, ads, pop-ups, cookie banners, scripts/analytics.
- Author bios, comments, social embeds, newsletter signups, unrelated promos.

## For Long or Complex Pages
- Extract only the most important insights; avoid exhaustive detail.
- Prioritize the primary purpose and the most impactful points.

## Output Rules (Strict)
- Use bullet points ('-') by default; only use a table when the rules above allow it.
- Do not include headings, section titles, or labels (e.g., “Summary”, “Key Entities”, “Overall”).
- Do not include any preamble or closing remarks.
- Do not include any follow-up questions, offers to help, or requests for more input.

Output only the summary.

---

**Page Content:**
${content}
`;
}

function buildCompactPrompt(content, language) {
  return `
Summarize the webpage content below in ${language}.

Rules:
- Max 180 words.
- Output only bullet points starting with '-'.
- No headings, labels, preambles, or closing remarks.
- No follow-up questions or offers to help.
- Focus on the core facts, intent, and any critical numbers or dates.
- If the page contains math, **always convert** all formulas and Unicode math symbols to LaTeX: $...$ for inline, $$...$$ for block. Use **only $ and $$** as delimiters — never ( ), \( \), [ ], or plain text.

Page Content:
${content}
`;
}

/**
 * Build the summarization prompt for the LLM.
 * @param {string} content
 * @param {string} language
 * @param {"default"|"compact"} promptProfile
 * @returns {string}
 */
export function buildSummarizationPrompt(content, language = "english", promptProfile = "default") {
  if (promptProfile === "compact") {
    return buildCompactPrompt(content, language);
  }
  return buildDefaultPrompt(content, language);
}
