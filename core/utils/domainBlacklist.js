/**
 * Convert semicolon-separated blacklist string into an array of trimmed patterns.
 */
const parseBlockedDomains = (str) =>
  str.split(';').map((s) => s.trim()).filter(Boolean);

/**
 * Extract hostname from a URL or return as-is if plain domain
 */
const getHostname = (url) => {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return (url || "").toLowerCase();
  }
};

/**
 * Convert wildcard pattern to regex (escape regex chars, then expand '*').
 */
const patternToRegex = (pattern) => {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp('^' + escaped.replace(/\*/g, '.*') + '$', 'i');
};

/**
 * Compile a blacklist string into fast lookup structures.
 * @param {string} blacklistString
 * @returns {{ exactSet: Set<string>, suffixes: string[], regexList: RegExp[] }}
 */
function compileBlacklist(blacklistString) {
  const patterns = parseBlockedDomains(blacklistString || '');
  const exactSet = new Set();
  const suffixes = [];
  const regexList = [];

  for (const pattern of patterns) {
    if (!pattern) continue;

    if (pattern.includes('*')) {
      // Fast path for "*.example.com"
      if (/^\*\.[^*]+$/.test(pattern)) {
        const suffix = pattern.slice(1).toLowerCase(); // ".example.com"
        suffixes.push(suffix);
        // Also block the apex domain explicitly (example.com)
        exactSet.add(suffix.slice(1));
        continue;
      }

      // Fallback to regex for complex patterns (e.g., "*.gov.*")
      regexList.push(patternToRegex(pattern));
      continue;
    }

    exactSet.add(pattern.toLowerCase());
  }

  return { exactSet, suffixes, regexList };
}

// Cache for combined blacklists
const blacklistCache = new Map();

/**
 * Check if a hostname or URL matches the blacklist.
 * @param {string} blacklistString
 * @param {string} domainOrUrl
 * @returns {boolean}
 */
export function isDomainBlacklisted(blacklistString, domainOrUrl) {
  const hostname = getHostname(domainOrUrl);
  if (!hostname) return false;
  const key = (blacklistString || '').trim();

  if (!blacklistCache.has(key)) {
    blacklistCache.set(key, compileBlacklist(key));
  }

  const compiled = blacklistCache.get(key);

  if (compiled.exactSet.has(hostname)) return true;

  for (const suffix of compiled.suffixes) {
    if (hostname.length > suffix.length && hostname.endsWith(suffix)) {
      return true;
    }
  }

  return compiled.regexList.some((r) => r.test(hostname));
}

/**
 * Combine default and custom blacklist strings into one semicolon-separated string.
 * @param {string} defaultList
 * @param {string} customList
 * @returns {string}
 */
export function combineBlacklists(defaultList, customList) {
  return [defaultList, customList]
    .map(value => (value || '').trim())
    .filter(Boolean)
    .join(';');
}
