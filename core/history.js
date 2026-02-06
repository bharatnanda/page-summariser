import { createContentPreview } from './utils/preview.js';
import { saveSummaryForView } from './utils/summaryStore.js';
import { showNotification } from './utils/notification.js';
import { storageGetWithFallback, storageSetWithFallback } from './utils/storage.js';
import { platform } from './platform.js';

document.addEventListener("DOMContentLoaded", async () => {
  const historyTableBody = document.getElementById("historyTableBody");
  const clearHistoryBtn = document.getElementById("clearHistoryBtn");

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

function storageGet(keys) {
  return storageGetWithFallback(keys, 'local', 'sync');
}

function storageSet(value) {
  return storageSetWithFallback(value, 'local', 'sync');
}

/**
 * Load summary history and render the table.
 * @returns {Promise<void>}
 */
async function loadHistory() {
  const historyTableBody = document.getElementById("historyTableBody");
  
  try {
    const result = await storageGet(['summaryHistory']);
    const history = result.summaryHistory || [];

    historyTableBody.textContent = "";

    if (history.length === 0) {
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.colSpan = 5;
      cell.style.textAlign = "center";
      cell.style.padding = "40px";

      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.style.padding = "20px";
      empty.style.margin = "0";

      const title = document.createElement("h2");
      title.textContent = "No Summary History Yet";
      const message = document.createElement("p");
      message.textContent = "Summarize some pages using the extension to see them appear here. Your summaries will be saved automatically.";

      empty.appendChild(title);
      empty.appendChild(message);
      cell.appendChild(empty);
      row.appendChild(cell);
      historyTableBody.appendChild(row);
      return;
    }

    const fragment = document.createDocumentFragment();
    history.forEach((item, index) => {
      const sourceUrl = item.sourceUrl || item.url || extractSource(item.summary);
      const title = item.title || "";
      const provider = item.provider || "";
      const model = item.model || "";
      const preview = item.contentPreview || createContentPreview(item.summary);
      const formattedDate = formatDate(item.timestamp);
      const formattedTime = formatTime(item.timestamp);

      const displaySource = sourceUrl || 'Unknown Source';
      const displayTitle = title || 'Untitled';

      const row = document.createElement("tr");
      row.className = "history-row";
      row.dataset.index = String(index);

      const urlCell = document.createElement("td");
      urlCell.className = "url-cell";

      const titleDiv = document.createElement("div");
      titleDiv.textContent = displayTitle;
      const sourceDiv = document.createElement("div");
      sourceDiv.className = "source-url";
      sourceDiv.textContent = displaySource;

      urlCell.appendChild(titleDiv);
      urlCell.appendChild(sourceDiv);

      if (provider || model) {
        const modelDiv = document.createElement("div");
        modelDiv.className = "provider-model";
        modelDiv.textContent = [provider, model].filter(Boolean).join(" • ");
        urlCell.appendChild(modelDiv);
      }

      const previewCell = document.createElement("td");
      previewCell.className = "preview-cell";
      previewCell.textContent = preview;

      const dateCell = document.createElement("td");
      dateCell.className = "date-cell";
      dateCell.textContent = `${formattedDate} ${formattedTime}`;

      const deleteCell = document.createElement("td");
      deleteCell.className = "delete-cell";
      const deleteBtn = document.createElement("button");
      deleteBtn.className = "delete-btn";
      deleteBtn.dataset.index = String(index);
      deleteBtn.title = "Delete summary";
      deleteBtn.textContent = "🗑️";
      deleteCell.appendChild(deleteBtn);

      row.appendChild(urlCell);
      row.appendChild(previewCell);
      row.appendChild(dateCell);
      row.appendChild(deleteCell);

      fragment.appendChild(row);
    });

    historyTableBody.appendChild(fragment);
    
    // Add click event to history rows to view full summary
    document.querySelectorAll('.history-row').forEach(row => {
      row.addEventListener('click', (e) => {
        // Don't trigger if clicking on delete button
        if (e.target.closest && e.target.closest('.delete-btn')) {
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
        const target = e.currentTarget;
        const index = parseInt(target.getAttribute('data-index'));
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

/**
 * Clear all saved history.
 * @returns {Promise<void>}
 */
async function clearHistory() {
  try {
    await storageSet({ summaryHistory: [] });
    showNotification(document.getElementById("notification"), "History cleared successfully!", "success");
  } catch (error) {
    console.error("Error clearing history:", error);
    showNotification(document.getElementById("notification"), "Failed to clear history", "error");
  }
}

/**
 * Delete a history item by index.
 * @param {number} index
 * @returns {Promise<void>}
 */
async function deleteHistoryItem(index) {
  try {
    const result = await storageGet(['summaryHistory']);
    const history = result.summaryHistory || [];
    
    if (index >= 0 && index < history.length) {
      history.splice(index, 1);
      await storageSet({ summaryHistory: history });
      showNotification(document.getElementById("notification"), "Summary deleted!", "success");
    }
  } catch (error) {
    console.error("Error deleting history item:", error);
    showNotification(document.getElementById("notification"), "Failed to delete summary", "error");
  }
}

/**
 * Open a stored summary in the results view.
 * @param {number} index
 */
function viewFullSummary(index) {
  storageGet(['summaryHistory']).then((result) => {
    const history = result.summaryHistory || [];
    if (index >= 0 && index < history.length) {
      const item = history[index];
      saveSummaryForView(item.summary, {
        title: item.title || "",
        sourceUrl: item.sourceUrl || item.url || "",
        provider: item.provider || "",
        model: item.model || ""
      })
        .then((id) => {
          const encoded = encodeURIComponent(id);
          platform.tabs.create({ url: platform.runtime.getURL(`results.html?id=${encoded}`) });
        })
        .catch(() => {
          const encoded = encodeURIComponent(item.summary);
          platform.tabs.create({ url: platform.runtime.getURL(`results.html?text=${encoded}`) });
        });
    }
  });
}

/**
 * Format a timestamp to a readable date.
 * @param {string} timestamp
 * @returns {string}
 */
function formatDate(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

/**
 * Format a timestamp to a readable time.
 * @param {string} timestamp
 * @returns {string}
 */
function formatTime(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Extract the first URL from a summary as a fallback source.
 * @param {string} summary
 * @returns {string|null}
 */
function extractSource(summary) {

  // Extract first full URL (http/https) — allow query params and fragments
  let sourceUrl = null;
  const urlMatch = summary.match(/https?:\/\/[^\s]+/i);
  if (urlMatch) {
    sourceUrl = urlMatch[0];
  }

  return sourceUrl;
}



/**
 * Show a transient notification.
 * @param {string} message
 * @param {"success"|"error"} type
 */
