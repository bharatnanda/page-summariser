document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("summary");
  const copyBtn = document.getElementById("copyBtn");
  const downloadBtn = document.getElementById("downloadBtn");
  const saveBtn = document.getElementById("saveBtn");
  const historyBtn = document.getElementById("historyBtn");
  const notification = document.getElementById("notification");

  // Get summary text from URL query params
  const params = new URLSearchParams(window.location.search);
  const rawText = params.get("text");
  let decodedText = "No summary available.";

  try {
    if (rawText) decodedText = decodeURIComponent(rawText);
  } catch (err) {
    console.error("Failed to decode URI component:", err);
    decodedText = rawText;
  }

  // Render markdown if available
  if (window.marked) {
    container.innerHTML = marked.parse(decodedText, { breaks: true });
  } else {
    container.textContent = decodedText;
  }

  // Copy summary to clipboard
  copyBtn?.addEventListener("click", () => {
    navigator.clipboard.writeText(decodedText)
      .then(() => showNotification("Summary copied to clipboard!", "success"))
      .catch(err => {
        console.error("Clipboard error:", err);
        showNotification("Failed to copy summary", "error");
      });
  });

  // Download summary as .md file
  downloadBtn?.addEventListener("click", () => {
    const blob = new Blob([decodedText], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "summary.md";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    
    showNotification("Summary downloaded!", "success");
  });

  // Save summary to history
  saveBtn?.addEventListener("click", async () => {
    try {
      let sourceUrl = null;
      const sourceMatch = decodedText.match(/https?:\/\/[^\s]+/);
      if (sourceMatch) {
        const sourceText = sourceMatch[0].trim();
        // Remove angle brackets if present
        sourceUrl = sourceText.replace(/^<|>$/g, '');
      }

      // Use source URL from summary, or fall back to current tab URL
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const url = sourceUrl || tab?.url || "Unknown URL";
      
      // Create a history item
      const timestamp = new Date().toISOString();
      const historyItem = {
        url,
        summary: decodedText,
        timestamp,
        contentPreview: createContentPreview(decodedText)
      };

      // Save to history
      chrome.storage.local.get(['summaryHistory'], (result) => {
        const history = result.summaryHistory || [];
        history.unshift(historyItem); // Add to beginning
        
        // Keep only the last 50 summaries
        if (history.length > 50) {
          history.splice(50);
        }
        
        chrome.storage.local.set({ summaryHistory: history }, () => {
          showNotification("Summary saved to history!", "success");
        });
      });
    } catch (error) {
      console.error("Error saving to history:", error);
      showNotification("Failed to save summary", "error");
    }
  });

  // History button functionality
  historyBtn?.addEventListener("click", () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('history.html') });
  });

  // Show notification function
  function showNotification(message, type) {
    notification.textContent = message;
    notification.className = `notification ${type} show`;
    
    setTimeout(() => {
      notification.classList.remove("show");
    }, 3000);
  }
  
  // Create content preview from summary
  function createContentPreview(summary) {
    // Remove markdown formatting and extract content
    let content = summary
      .replace(/^#\s+.+$/m, '') // Remove title/headers
      .replace(/\*\*Source:\*\*.*$/m, '') // Remove source line
      .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold
      .replace(/\*(.*?)\*/g, '$1') // Remove italic
      .replace(/^- /gm, '• ') // Convert bullet points
      .replace(/\n/g, ' ') // Replace newlines with spaces
      .replace(/\s+/g, ' ') // Collapse multiple spaces
      .trim();
    
    // Truncate to a reasonable length
    if (content.length > 100) {
      content = content.substring(0, 100) + '...';
    }
    
    return content || 'No preview available';
  }
});
