const MAX_CHARS = 60000;

export function extractPageText() {
  const selection = window.getSelection()?.toString() || "";
  return selection.trim().length > 0
    ? selection.trim()
    : document.body?.innerText?.trim() || "";
}

export function buildContentFromText(pageUrl, pageText) {
  const text = (pageText || "").trim();
  if (!text) return "";

  const sourceUrl = pageUrl || "";
  const fullContent = `Source: ${sourceUrl}\n${text}`.trim();
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
    func: extractPageText,
  });
  return result;
}

export async function getPageContent() {
  try {
    const tab = await getActiveTab();
    const tabUrl = await getPageUrl();
    const pageText = await executeContentScript(tab.id);
    return buildContentFromText(tabUrl, pageText);
  } catch (err) {
    console.error("Failed to get page content:", err);
    throw new Error("No relevant content found to summarize on this page.");
  }
}

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
