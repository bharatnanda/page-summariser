/**
 * Clamp content length based on provider limits to reduce token usage.
 * @param {string} content
 * @param {{ provider?: string }} settings
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
export function buildSummarizationPrompt(content, language = "english") {
  return `
You are a professional summarizer.  
Read the webpage content provided below and produce a clear, concise summary in ${language}.

# Web Article Summarization Rules

## Length and Structure

- Important: Must keep the summary under 200 words.
- Ensure to use bullet points, short paragraphs, and tables as needed to improve clarity and readability.

## Output Formatting

- Use bullet points ('-') for list-style items.
- Use **bold** to emphasize names, organizations, or key conclusions.
- Use tables only for comparative data or clearly structured lists.
- Wrap long URLs in angle brackets < >' to prevent Markdown rendering issues.

## What to Include

- Main ideas and key arguments presented in the article.
- Important facts, data points, or conclusions.
- The overall purpose or intent of the article (e.g., inform, persuade, critique).
- Key entities, such as:
  - People (e.g., authors, speakers, subjects)
  - Organizations or institutions
  - Locations or regions
  - Events or incidents
  - Notable technologies, products, or abstract concepts
- Implications, consequences, or potential impact of the content.
- Author’s stance, tone, or perspective (if clearly expressed).
- Calls to action, recommendations, or proposed solutions (if applicable).
- Trends, comparisons, or significant historical context (if relevant).

### If the article includes code:

- Summarize the main purpose or functionality of the code.
- Include relevant code snippets only if they add value.
- Note key setup steps, configurations, or dependencies.
- Highlight any warnings, best practices, or tips provided by the author.

## What to Exclude

- Navigation menus, headers, footers, advertisements, or pop-ups.
- Author bios, user comments, and unrelated promotional content.
- Embedded social links, newsletter signups, or unrelated sidebars.

## For Long or Complex Articles

- Focus on extracting only the most important insights.
- Avoid exhaustive detail; aim to convey the essential message or value of the content.
- Prioritize the central thesis and any novel or high-impact points.

---

**Page Content:**
${content}
`;
}
