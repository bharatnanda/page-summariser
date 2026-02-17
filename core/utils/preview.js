/**
 * Build a compact, single-line preview string for history rows.
 * @param {string} summary
 * @returns {string}
 */
export function createContentPreview(summary) {
  if (!summary) return 'No preview available';

  const protectedMath = protectMath(summary);
  let content = protectedMath.text
    .replace(/^#\s+.+$/m, '') // Remove title/headers
    .replace(/\*\*Source:\*\*.*$/m, '') // Remove source line
    .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold
    .replace(/\*(.*?)\*/g, '$1') // Remove italic
    .replace(/^- /gm, '• ') // Convert bullet points
    .replace(/\n/g, ' ') // Replace newlines with spaces
    .replace(/\s+/g, ' ') // Collapse multiple spaces
    .trim();

  content = restoreMath(content, protectedMath.placeholders);

  if (content.length > 100) {
    content = content.substring(0, 100) + '...';
  }

  return content || 'No preview available';
}

function protectMath(input) {
  const placeholders = [];
  if (!input) return { text: "", placeholders };
  let result = "";
  let i = 0;
  while (i < input.length) {
    if (input.startsWith("$$", i)) {
      const end = findMathEnd(input, i + 2, "$$");
      if (end !== -1) {
        const math = input.slice(i, end + 2);
        result += addPlaceholder(math, placeholders);
        i = end + 2;
        continue;
      }
    }
    if (input[i] === "$" && !input.startsWith("$$", i) && !isEscaped(input, i)) {
      const end = findMathEnd(input, i + 1, "$");
      if (end !== -1) {
        const math = input.slice(i, end + 1);
        result += addPlaceholder(math, placeholders);
        i = end + 1;
        continue;
      }
    }
    result += input[i];
    i += 1;
  }
  return { text: result, placeholders };
}

function findMathEnd(text, startIndex, delimiter) {
  let i = startIndex;
  while (i < text.length) {
    if (delimiter === "$$" && text.startsWith("$$", i)) {
      if (!isEscaped(text, i)) return i;
      i += 2;
      continue;
    }
    if (delimiter === "$" && text[i] === "$") {
      if (!isEscaped(text, i)) return i;
    }
    i += 1;
  }
  return -1;
}

function isEscaped(text, index) {
  let backslashes = 0;
  let i = index - 1;
  while (i >= 0 && text[i] === "\\") {
    backslashes += 1;
    i -= 1;
  }
  return backslashes % 2 === 1;
}

function addPlaceholder(math, placeholders) {
  const token = `@@MATH_${placeholders.length}@@`;
  placeholders.push(math);
  return token;
}

function restoreMath(text, placeholders) {
  if (!text || placeholders.length === 0) return text;
  return text.replace(/@@MATH_(\d+)@@/g, (match, index) => {
    const math = placeholders[Number(index)];
    return math ?? match;
  });
}
