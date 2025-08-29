const MAX_CHARS = 60000;

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) throw new Error("No active tab found. Please try again.");
  return tab;
}

function extractPageContent() {
  const sel = window.getSelection()?.toString() || "";
  return sel.trim().length > 0 ? sel.trim() : document.body?.innerText?.trim() || "";
}

async function executeContentScript(tabId) {
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId },
    func: extractPageContent,
  });
  return result;
}

export async function getPageContent() {
  try {
    const tab = await getActiveTab();
    const tabUrl = await getPageUrl();
    const content = `Source: ${tabUrl}
` + await executeContentScript(tab.id);
    return content.length > MAX_CHARS ? content.slice(0, MAX_CHARS) : content;
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
