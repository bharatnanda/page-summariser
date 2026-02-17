/**
 * Clamp content length to a configured maximum to reduce token usage.
 * @param {string} content
 * @param {import('./settings.js').Settings} settings
 * @returns {string}
 */
export function clampContentForProvider(content, settings) {
  if (!content) return "";
  const overrideMax = Number(settings?.maxContentChars);
  if (Number.isFinite(overrideMax) && overrideMax > 0) {
    return content.length > overrideMax ? content.slice(0, overrideMax) : content;
  }

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
- Use **bullet points ('-') by default**; use short paragraphs only if the page is a single cohesive narrative and bulleting harms clarity (common in essays).
- Use a **table only** for comparative data or structured lists with **3+ similar items**.
- Use **bold** to emphasize the most important names, organizations, and key conclusions (avoid over-bolding).
- Wrap long URLs in angle brackets < > if included.

## Stability Requirements (Strict)
- Summarize **only what is present in the provided page content**. Do not add outside knowledge.
- Do **not** generalize to what the organization/website “typically provides” unless the page explicitly states it.
- Base importance strictly on: **(1) visible prominence**, **(2) repetition/emphasis**, **(3) explicit conclusions/purpose**.
- Match the source’s specificity: if the page lists items, keep key items; if the page is conceptual, summarize conceptually.
- Do not “force” a single narrative when the page is a feed/index with multiple unrelated items.

## Length Target (Adaptive)
Choose a target length based on page type and content length, while staying under 250 words:
- **Short pages or landing pages:** ~80-130 words.
- **Typical articles:** ~130-200 words.
- **Long docs or dense pages:** ~200-250 words.

## Page-Type Handling (Required)
First classify the page into **exactly one** of these types (do not invent new categories) and summarize accordingly:
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
- Preserve mathematical expressions in LaTeX. Use $...$ for inline math and $$...$$ for display math.

### If the page includes code
- Summarize what the code does and any setup/config/dependencies.
- Include snippets only if they add clear value.
- Note warnings/best practices if mentioned.

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

Rules (Strict):
- Max 250 words.
- Output only bullet points starting with '-'.
- No headings, labels, preambles, or closing remarks.
- No follow-up questions or offers to help.
- Summarize only what is present in the provided content (no outside knowledge).
- Do not generalize what the site/organization “typically provides” unless explicitly stated in the content.
- Focus on prominently displayed content, repeated/emphasized points, and explicit conclusions.
- Preserve mathematical expressions in LaTeX using $...$ or $$...$$.

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
