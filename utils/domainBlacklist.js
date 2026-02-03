/**
 * Convert semicolon-separated blacklist string into an array of trimmed patterns
 */
const parseBlockedDomains = str =>
  str.split(';').map(s => s.trim()).filter(Boolean);

/**
 * Extract hostname from a URL or return as-is if plain domain
 */
const getHostname = url => {
  try { return new URL(url).hostname.toLowerCase(); }
  catch { return url.toLowerCase(); }
};

/**
 * Convert wildcard pattern to regex
 */
const patternToRegex = pattern =>
  new RegExp('^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$', 'i');

// Cache for combined blacklists
const blacklistCache = new Map();

/**
 * Check if domain/URL is blacklisted
 * @param {string} blacklistString - semicolon-separated patterns (can include defaults)
 * @param {string} domainOrUrl
 * @returns {boolean}
 */
export function isDomainBlacklisted(blacklistString, domainOrUrl) {
  const hostname = getHostname(domainOrUrl);
  const key = (blacklistString || '').trim();

  if (!blacklistCache.has(key)) {
    const patterns = parseBlockedDomains(key);
    const regexList = patterns.map(p =>
      p.includes('*') ? patternToRegex(p) : { test: h => h === p.toLowerCase() }
    );
    blacklistCache.set(key, regexList);
  }

  return blacklistCache.get(key).some(r => r.test(hostname));
}

/**
 * Combine default and custom blacklist strings into one semicolon-separated string.
 * Trims and skips empty entries.
 */
export function combineBlacklists(defaultList, customList) {
  return [defaultList, customList]
    .map(value => (value || '').trim())
    .filter(Boolean)
    .join(';');
}
