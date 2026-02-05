/**
 * Build a compact, single-line preview string for history rows.
 * @param {string} summary
 * @returns {string}
 */
export function createContentPreview(summary) {
  if (!summary) return 'No preview available';

  let content = summary
    .replace(/^#\s+.+$/m, '') // Remove title/headers
    .replace(/\*\*Source:\*\*.*$/m, '') // Remove source line
    .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold
    .replace(/\*(.*?)\*/g, '$1') // Remove italic
    .replace(/^- /gm, '• ') // Convert bullet points
    .replace(/\n/g, ' ') // Replace newlines with spaces
    .replace(/\s+/g, ' ') // Collapse multiple spaces
    .trim();

  if (content.length > 100) {
    content = content.substring(0, 100) + '...';
  }

  return content || 'No preview available';
}
