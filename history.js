document.addEventListener("DOMContentLoaded", async () => {
  const historyTableBody = document.getElementById("historyTableBody");
  const clearHistoryBtn = document.getElementById("clearHistoryBtn");
  const notification = document.getElementById("notification");

  // Clear history event
  clearHistoryBtn.addEventListener("click", async () => {
    if (confirm("Are you sure you want to clear all history? This action cannot be undone.")) {
      await clearHistory();
      await loadHistory();
    }
  });

  // Load history
  await loadHistory();
});

async function loadHistory() {
  const historyTableBody = document.getElementById("historyTableBody");
  
  try {
    const result = await chrome.storage.local.get(['summaryHistory']);
    const history = result.summaryHistory || [];
    
    if (history.length === 0) {
      historyTableBody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; padding: 40px;">
            <div class="empty-state" style="padding: 20px; margin: 0;">
              <h2>No Summary History Yet</h2>
              <p>Summarize some pages using the extension to see them appear here. Your summaries will be saved automatically.</p>
            </div>
          </td>
        </tr>
      `;
      return;
    }
    
    historyTableBody.innerHTML = history.map((item, index) => {
      // Extract title and source URL from the summary
      const sourceUrl = extractSource(item.summary);
      const preview = item.contentPreview || createSummaryPreview(item.summary);
      const formattedDate = formatDate(item.timestamp);
      const formattedTime = formatTime(item.timestamp);
      
      // Fallbacks
      const displaySource = sourceUrl || 'Unknown Source';
      
      return `
        <tr class="history-row" data-index="${index}">
          <td class="url-cell">${displaySource}</td>
          <td class="preview-cell">${preview}</td>
          <td class="date-cell">${formattedDate} ${formattedTime}</td>
          <td class="delete-cell">
            <button class="delete-btn" data-index="${index}" title="Delete summary">🗑️</button>
          </td>
        </tr>
      `;
    }).join('');
    
    // Add click event to history rows to view full summary
    document.querySelectorAll('.history-row').forEach(row => {
      row.addEventListener('click', (e) => {
        // Don't trigger if clicking on delete button
        if (e.target.classList.contains('delete-btn')) {
          return;
        }
        
        const index = parseInt(row.getAttribute('data-index'));
        viewFullSummary(index);
      });
    });
    
    // Add event listeners to delete buttons
    document.querySelectorAll('.delete-btn').forEach(button => {
      button.addEventListener('click', async (e) => {
        e.stopPropagation(); // Prevent triggering the row click
        const index = parseInt(e.target.getAttribute('data-index'));
        await deleteHistoryItem(index);
        await loadHistory();
      });
    });
  } catch (error) {
    console.error("Error loading history:", error);
    historyTableBody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; padding: 40px;">
          <div class="empty-state" style="padding: 20px; margin: 0;">
            <h2>Error Loading History</h2>
            <p>There was a problem loading your summary history. Please try again.</p>
          </div>
        </td>
      </tr>
    `;
  }
}

async function clearHistory() {
  try {
    await chrome.storage.local.set({ summaryHistory: [] });
    showNotification("History cleared successfully!", "success");
  } catch (error) {
    console.error("Error clearing history:", error);
    showNotification("Failed to clear history", "error");
  }
}

async function deleteHistoryItem(index) {
  try {
    const result = await chrome.storage.local.get(['summaryHistory']);
    const history = result.summaryHistory || [];
    
    if (index >= 0 && index < history.length) {
      history.splice(index, 1);
      await chrome.storage.local.set({ summaryHistory: history });
      showNotification("Summary deleted!", "success");
    }
  } catch (error) {
    console.error("Error deleting history item:", error);
    showNotification("Failed to delete summary", "error");
  }
}

function viewFullSummary(index) {
  chrome.storage.local.get(['summaryHistory'], (result) => {
    const history = result.summaryHistory || [];
    if (index >= 0 && index < history.length) {
      const item = history[index];
      const encoded = encodeURIComponent(item.summary);
      chrome.tabs.create({ url: chrome.runtime.getURL(`results.html?text=${encoded}`) });
    }
  });
}

function formatDate(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

function formatTime(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });
}

function extractSource(summary) {

  // Extract first full URL (http/https) — allow query params and fragments
  let sourceUrl = null;
  const urlMatch = summary.match(/https?:\/\/[^\s]+/i);
  if (urlMatch) {
    sourceUrl = urlMatch[0];
  }

  return sourceUrl;
}



// Create content preview from summary (fallback function)\nfunction createSummaryPreview(summary) {\n  // This function is kept for backward compatibility,\n  // but we now use the contentPreview field from the history item\n  // Remove markdown formatting and extract content\n  let content = summary\n    .replace(/^#\\s+.+$/m, '') // Remove title/headers\n    .replace(/\\*\\*Source:\\*\\*.*$/m, '') // Remove source line\n    .replace(/\\*\\*(.*?)\\*\\*/g, '$1') // Remove bold\n    .replace(/\\*(.*?)\\*/g, '$1') // Remove italic\n    .replace(/^- /gm, '• ') // Convert bullet points\n    .replace(/\\n/g, ' ') // Replace newlines with spaces\n    .replace(/\\s+/g, ' ') // Collapse multiple spaces\n    .trim();\n  \n  // Truncate to a reasonable length\n  if (content.length > 100) {\n    content = content.substring(0, 100) + '...';\n  }\n  \n  return content || 'No preview available';\n}

function showNotification(message, type) {
  const notification = document.getElementById("notification");
  if (!notification) return;
  
  notification.textContent = message;
  notification.className = `notification ${type} show`;
  
  setTimeout(() => {
    notification.classList.remove("show");
  }, 3000);
}