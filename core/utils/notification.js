const COLORS = {
  error: '#b91c1c',
  warning: '#b45309',
  success: '#15803d',
  info: '#1f2937'
};

export function buildToastStyle(type = "info") {
  return [
    'position:fixed',
    'top:20px',
    'right:20px',
    'z-index:2147483647',
    'max-width:360px',
    'color:#fff',
    'padding:12px 14px',
    'border-radius:8px',
    'font:12px/1.4 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Arial,sans-serif',
    'box-shadow:0 6px 18px rgba(0,0,0,0.2)',
    `background:${COLORS[type] || COLORS.info}`
  ].join(';');
}

/**
 * Show a transient notification.
 * @param {HTMLElement|null} el
 * @param {string} message
 * @param {"success"|"error"|"warning"|"info"} type
 * @param {number} durationMs
 */
export function showNotification(el, message, type = "info", durationMs = 3000) {
  if (!el) return;

  el.textContent = message;
  el.style.cssText = buildToastStyle(type);
  el.className = `notification ${type} show`;

  if (window.__PAGE_SUMMARIZER_TOAST_TIMER) {
    window.clearTimeout(window.__PAGE_SUMMARIZER_TOAST_TIMER);
  }
  window.__PAGE_SUMMARIZER_TOAST_TIMER = window.setTimeout(() => {
    el.classList.remove("show");
  }, durationMs);
}
