const MAX_CHARS = 60000;

/**
 * Extract visible text and title from the current page.
 * Prioritizes user selection when available.
 * @returns {{ text: string, title: string }}
 */
export function extractPageData() {
  const selection = window.getSelection()?.toString() || "";
  const text = selection.trim().length > 0
    ? selection.trim()
    : document.body?.innerText?.trim() || "";

  const ogTitle = document.querySelector('meta[property="og:title"]')?.content || "";
  const title = (ogTitle || document.title || "").trim();

  return { text, title };
}

/**
 * Normalize and clamp raw page text to a safe maximum length.
 * @param {string} pageText
 * @returns {string}
 */
export function buildContentFromText(pageText) {
  const text = (pageText || "").trim();
  if (!text) return "";

  const fullContent = text.trim();
  return fullContent.length > MAX_CHARS
    ? fullContent.slice(0, MAX_CHARS)
    : fullContent;
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) throw new Error("No active tab found. Please try again.");
  return tab;
}

async function executeContentScript(tabId) {
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId },
    func: extractPageData,
  });
  return result;
}

/**
 * Fetch page content from the active tab using a content script.
 * @returns {Promise<{ content: string, title: string, sourceUrl: string }>}
 */
export async function getPageContent() {
  try {
    const tab = await getActiveTab();
    const tabUrl = await getPageUrl();
    const pageData = await executeContentScript(tab.id);
    return {
      content: buildContentFromText(pageData?.text),
      title: pageData?.title || "",
      sourceUrl: tabUrl || ""
    };
  } catch (err) {
    console.error("Failed to get page content:", err);
    throw new Error("No relevant content found to summarize on this page.");
  }
}

/**
 * Get the active tab URL.
 * @returns {Promise<string>}
 */
export async function getPageUrl() {
  try {
    const tab = await getActiveTab();
    if (!tab.url) throw new Error("No URL found for the current page.");
    return tab.url;
  } catch (err) {
    console.error("Failed to get page URL:", err);
    throw new Error("Unable to access the current page URL. Please try refreshing the page.");
  }
}
