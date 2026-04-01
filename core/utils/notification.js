/**
 * Build a legacy inline toast style string (kept for backwards compatibility).
 * @param {string} type
 * @returns {string}
 */
export function buildToastStyle(type = "info") {
  const colors = {
    error: '#b91c1c',
    warning: '#b45309',
    success: '#15803d',
    info: '#1f2937'
  };
  return [
    'position:fixed', 'top:20px', 'right:20px', 'z-index:2147483647',
    'max-width:320px', 'color:#fff', 'padding:12px 16px',
    'border-radius:10px', 'font-size:14px', 'font-weight:500',
    'box-shadow:0 10px 15px -3px rgba(0,0,0,0.15)',
    `background:${colors[type] || colors.info}`
  ].join(';');
}

/**
 * Show a transient notification using CSS classes (supports light/dark mode).
 * @param {HTMLElement|null} el
 * @param {string} message
 * @param {"success"|"error"|"warning"|"info"} type
 * @param {number} durationMs
 */
export function showNotification(el, message, type = "info", durationMs = 3000) {
  if (!el) return;

  el.textContent = message;
  // Remove any inline styles that would override CSS variables
  el.removeAttribute('style');
  el.className = `toast toast-${type} is-visible`;

  if (window.__PAGE_SUMMARIZER_TOAST_TIMER) {
    window.clearTimeout(window.__PAGE_SUMMARIZER_TOAST_TIMER);
  }
  window.__PAGE_SUMMARIZER_TOAST_TIMER = window.setTimeout(() => {
    el.classList.remove('is-visible');
  }, durationMs);
}
