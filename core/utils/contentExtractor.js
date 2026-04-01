import { platform } from '../platform.js';
import { getSettings } from './settings.js';

const MAX_CHARS = 60000;

/**
 * Extract selected text or page body text and title from the current page.
 * Prioritizes user selection when available.
 * @returns {{ text: string, title: string }}
 */
export function extractPageData(useExtractionEngine = true) {
  function extractWithEngine() {
    const MAX_CHARS = 90000;
    const MIN_GOOD_CHARS = 900;
    const SHADOW_SCAN_CAP = 3500;
    const SHADOW_DEPTH_CAP = 18;
    const JUNK_SEL =
      'nav, footer, header, aside, [role="navigation"], [role="banner"], [role="contentinfo"],' +
      ' [role="dialog"], [aria-modal="true"],' +
      ' .ad, .ads, .advert, .advertisement, .promo, .sponsored,' +
      ' .cookie, .consent, .subscribe, .newsletter, .paywall, .modal, .popup,' +
      ' .share, .social, .toolbar';

    const norm = (s) => (s || "").replace(/\s+/g, " ").trim();
    const clamp = (s) => (s.length > MAX_CHARS ? s.slice(0, MAX_CHARS) + "\n\n[TRUNCATED]" : s);
    const looksJunkText = (t) => {
      const x = norm(t).toLowerCase();
      if (!x) return true;
      if (x.length < 8) return true;
      return /more for you|subscribe|sign in|log in|cookie|privacy|terms|advertis|sponsored|newsletter|recommended|related|continue reading/.test(
        x
      );
    };
    const isNonContentish = (el) => {
      const tag = (el?.tagName || "").toLowerCase();
      const cls = (el?.className || "").toString().toLowerCase();
      const id = (el?.id || "").toLowerCase();
      const combined = `${tag} ${cls} ${id}`;
      if (tag === "iframe" || tag === "script") return true;
      return /(ad|ads|advert|sponsor|promo|tracking|consent|cookie|paywall|newsletter|subscribe|share|social|embed|video|player|twitter)/i.test(
        combined
      );
    };
    const formatBlock = (tag, text) => {
      const t = norm(text);
      if (!t) return "";
      if (tag === "h1") return `\n# ${t}`;
      if (tag === "h2") return `\n## ${t}`;
      if (tag === "h3") return `\n### ${t}`;
      if (tag === "h4") return `\n#### ${t}`;
      if (tag === "li") return `- ${t}`;
      if (tag === "blockquote") return `> ${t}`;
      return t;
    };
    const serializeTable = (tableEl) => {
      const rows = [...(tableEl?.querySelectorAll?.("tr") || [])].slice(0, 25);
      const lines = rows
        .map((r) =>
          [...(r.children || [])]
            .slice(0, 12)
            .map((c) => norm(c.innerText))
            .join(" | ")
        )
        .filter((line) => line.replace(/\|/g, "").trim().length > 0);
      return lines.length ? `TABLE:\n${lines.join("\n")}` : "";
    };
    const stripHtml = (s) => {
      if (!s) return "";
      if (/<[a-z][\s\S]*>/i.test(s)) {
        const doc = new DOMParser().parseFromString(String(s), "text/html");
        return norm(doc.body?.textContent || "");
      }
      return norm(s);
    };
    const extractJsonLdBody = (doc, minChars) => {
      const scripts = [...doc.querySelectorAll('script[type="application/ld+json"]')];
      for (const s of scripts) {
        const txt = s.textContent?.trim();
        if (!txt) continue;
        try {
          const data = JSON.parse(txt);
          const items = Array.isArray(data) ? data : [data];
          const flatten = (it) => {
            if (!it) return [];
            if (Array.isArray(it)) return it.flatMap(flatten);
            if (it["@graph"]) return flatten(it["@graph"]);
            return [it];
          };

          for (const it of flatten(items)) {
            const body = it?.articleBody || it?.mainEntityOfPage?.articleBody || it?.text;
            const cleaned = stripHtml(body);
            if (cleaned && cleaned.length > minChars) return cleaned;
          }
        } catch (_) {}
      }
      return "";
    };
    const extractBlocksFromRoot = (root) => {
      if (!root) return "";
      let workRoot = root;
      if (root instanceof Element) {
        const clone = root.cloneNode(true);
        clone.querySelectorAll?.(JUNK_SEL)?.forEach((n) => n.remove());

        // Replace MathJax/KaTeX rendered elements with their original LaTeX source.
        // Guard with a cheap querySelector first — 4 querySelectorAll scans are skipped on
        // the ~95% of pages that have no math elements.
        if (clone.querySelector?.('mjx-container, .katex, script[type="math/tex"]')) {
          const getLatex = (el) =>
            el.querySelector?.('annotation[encoding="application/x-tex"]')?.textContent?.trim() || '';
          // MathJax v3 (<mjx-container>)
          clone.querySelectorAll?.('mjx-container').forEach((el) => {
            const latex = getLatex(el);
            const display = el.getAttribute('display') === 'true';
            el.replaceWith(latex ? (display ? `$$${latex}$$` : `$${latex}$`) : '');
          });
          // KaTeX (<span class="katex">)
          clone.querySelectorAll?.('.katex').forEach((el) => {
            const latex = getLatex(el);
            el.replaceWith(latex ? `$${latex}$` : '');
          });
          // MathJax v2 (<script type="math/tex">)
          clone.querySelectorAll?.('script[type="math/tex"]').forEach((el) => {
            el.replaceWith(`$${el.textContent.trim()}$`);
          });
          clone.querySelectorAll?.('script[type="math/tex; mode=display"]').forEach((el) => {
            el.replaceWith(`$$${el.textContent.trim()}$$`);
          });
        }

        workRoot = clone;
      }
      const blocks = [];
      const seen = new Set();
      const push = (t) => {
        const x = norm(t);
        if (!x || looksJunkText(x) || seen.has(x)) return;
        seen.add(x);
        blocks.push(x);
      };
      const nodes = [...(workRoot.querySelectorAll?.("h1,h2,h3,h4,p,li,blockquote,pre,code,table") || [])];
      for (const el of nodes) {
        if (isNonContentish(el)) continue;
        if (el.closest?.("iframe")) continue;
        const tag = (el.tagName || "").toLowerCase();
        if (tag === "table") {
          const t = serializeTable(el);
          if (t) push(t);
          continue;
        }
        const t = formatBlock(tag, el.innerText);
        if (t) push(t);
        if (blocks.join("\n\n").length > MAX_CHARS) break;
      }
      let out = blocks.join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
      if (out.length < 200 && root instanceof Element) {
        // Use the junk-stripped clone (workRoot) with textContent instead of root.innerText
        // to avoid a layout reflow on the live DOM element.
        const t = norm(workRoot.textContent || "");
        if (!looksJunkText(t)) out = t;
      }
      return out;
    };
    const scoreElement = (el) => {
      if (!el || !(el instanceof Element)) return -Infinity;
      if (el.matches?.(JUNK_SEL) || el.closest?.(JUNK_SEL)) return -Infinity;
      const cls = `${el.className || ""} ${el.id || ""}`.toLowerCase();
      if (/(comment|disqus|reply|sidebar|rail|right-rail|left-rail|promo|editorial)/i.test(cls)) return -Infinity;
      const text = norm(el.textContent);
      const textLen = text.length;
      if (textLen < 250) return -Infinity;
      const r = el.getBoundingClientRect?.();
      if (!r || r.width < 240 || r.height < 240) return -Infinity;
      const vw = globalThis.innerWidth || 1200;
      const centerX = r.left + r.width / 2;
      const distToCenter = Math.abs(centerX - vw / 2);
      const centerBoost = Math.max(0, 1200 - distToCenter) * 0.6;
      const top = Math.max(0, r.top || 0);
      const topBoost = Math.max(0, 1400 - top) * 0.7;
      const widthBoost = Math.min(r.width, 1200) * 2.0;
      const p = el.querySelectorAll("p").length;
      const h = el.querySelectorAll("h1,h2,h3,h4").length;
      const li = el.querySelectorAll("li").length;
      const dataIdLike = el.querySelectorAll("[data-id],[data-pos],[data-now-id]").length;
      const timeLike = el.querySelectorAll("time,[class*='timestamp' i],[class*='author' i]").length;
      const anchors = el.querySelectorAll("a");
      const aCount = anchors.length;
      let linkTextLen = 0;
      for (const a of anchors) linkTextLen += norm(a.textContent).length;
      const linkDensity = textLen ? linkTextLen / textLen : 1;
      const formCount = el.querySelectorAll("input,button,select,textarea,form").length;
      const articleCount = el.querySelectorAll("article").length;
      const structureReward = p * 450 + h * 260 + li * 110 + dataIdLike * 60 + timeLike * 90;
      const linkPenalty = Math.min(linkDensity, 0.9) * 3200 + Math.min(aCount, 350) * 4;
      const uiPenalty = Math.min(formCount, 100) * 160;
      const multiArticlePenalty = Math.max(0, articleCount - 1) * 2000;
      const elTag = (el.tagName || "").toLowerCase();
      const tagBoost = elTag === "article" ? 1200 : (elTag === "main" || el.getAttribute?.("role") === "main") ? 900 : 0;
      return (textLen + structureReward + centerBoost + topBoost + widthBoost + tagBoost) - (linkPenalty + uiPenalty + multiArticlePenalty);
    };
    const pickFirstArticle = () => {
      const candidates = [
        ...(document.querySelector("main")?.querySelectorAll?.("article") || []),
        ...document.querySelectorAll("article")
      ];
      for (const el of candidates) {
        if (!el || !(el instanceof Element)) continue;
        if (isNonContentish(el) || el.matches?.(JUNK_SEL) || el.closest?.(JUNK_SEL)) continue;
        const text = norm(el.textContent);
        if (text.length >= MIN_GOOD_CHARS) {
          return el;
        }
      }
      return null;
    };
    const pickBestDomRoot = () => {
      const firstArticle = pickFirstArticle();
      if (firstArticle) return firstArticle;
      // Single-pass scoring. querySelectorAll deduplicates elements that match multiple
      // selectors, so each element is scored exactly once. Semantic elements (article, main)
      // rank naturally via tagBoost in scoreElement without needing a separate preferred pass.
      const all = [...document.querySelectorAll("article, main, [role='main'], section, div")];
      let best = null;
      let bestScore = -Infinity;
      for (const el of all) {
        const s = scoreElement(el);
        if (s > bestScore) {
          bestScore = s;
          best = el;
        }
      }
      return best;
    };
    const extractBestShadowContent = () => {
      const els = [...document.querySelectorAll("*")].slice(0, SHADOW_SCAN_CAP);
      const hosts = els.filter((e) => e.shadowRoot);
      if (hosts.length === 0) return "";
      const scoreShadowRoot = (root) => {
        if (!root || !root.querySelectorAll) return -Infinity;
        const iframeCount = root.querySelectorAll("iframe").length;
        const scriptCount = root.querySelectorAll("script").length;
        if (iframeCount + scriptCount > 3) return -Infinity;
        const ps = [...root.querySelectorAll("p")]
          .map((p) => norm(p.innerText))
          .filter((t) => !looksJunkText(t))
          .filter((t) => t.length > 60);
        if (ps.length < 2) return -Infinity;
        const whole = norm(root.textContent || "").toLowerCase();
        const adPenalty = /sponsored|advertis|adchoices|promoted|tracking/.test(whole) ? 800 : 0;
        return ps.join(" ").length + ps.length * 300 - adPenalty;
      };
      let bestRoot = null;
      let bestScore = -Infinity;
      for (const h of hosts) {
        if (isNonContentish(h)) continue;
        const s = scoreShadowRoot(h.shadowRoot);
        if (s > bestScore) {
          bestScore = s;
          bestRoot = h.shadowRoot;
        }
      }
      const walk = (root, depth = 0) => {
        if (!root || depth > SHADOW_DEPTH_CAP) return;
        root.querySelectorAll?.("*")?.forEach((node) => {
          if (node.shadowRoot && !isNonContentish(node)) {
            const s = scoreShadowRoot(node.shadowRoot);
            if (s > bestScore) {
              bestScore = s;
              bestRoot = node.shadowRoot;
            }
            walk(node.shadowRoot, depth + 1);
          }
        });
      };
      if (bestScore < 2000) walk(document.documentElement, 0);
      return bestRoot ? extractBlocksFromRoot(bestRoot) : "";
    };

    let content = extractJsonLdBody(document, MIN_GOOD_CHARS);
    if (!content) {
      const domBest = pickBestDomRoot();
      content = domBest ? extractBlocksFromRoot(domBest) : "";
    }
    if (!content || content.length < MIN_GOOD_CHARS) {
      content =
        extractBlocksFromRoot(document.querySelector("article")) ||
        extractBlocksFromRoot(document.querySelector("main")) ||
        extractBlocksFromRoot(document.querySelector("[role='main']")) ||
        content;
    }
    if (!content || content.length < MIN_GOOD_CHARS) {
      const sh = extractBestShadowContent();
      if (sh && sh.length > content.length) content = sh;
    }
    if (!content || content.length < 200) {
      content = norm(document.body?.innerText || "");
    }

    const title = norm(document.title) || "(no title)";
    return `TITLE:\n${title}\n\nCONTENT:\n${clamp(content)}`;
  }

  function getReadableText() {
    const debug = Boolean(window.__PAGE_SUMMARIZER_DEBUG);
    const text = extractWithEngine();
    if (debug) {
      console.log('[Page Summarizer] using extraction engine, length:', text.length);
    }
    return text;
  }

  const selection = window.getSelection()?.toString() || "";
  let text = "";
  if (selection.trim().length > 0) {
    text = selection.trim();
  } else if (useExtractionEngine) {
    text = getReadableText();
  } else {
    text =
      document.body?.innerText?.trim() ||
      document.documentElement?.innerText?.trim() ||
      document.body?.textContent?.trim() ||
      document.documentElement?.textContent?.trim() ||
      "";
  }

  const ogTitle = document.querySelector('meta[property="og:title"]')?.content || "";
  const title = (ogTitle || document.title || "").trim();

  return { text, title };
}

/**
 * Normalize and clamp raw page text to a safe maximum length.
 * @param {string} pageText
 * @returns {string}
 */
export function buildContentFromText(pageText) {
  const text = (pageText || "").trim();
  if (!text) return "";

  const fullContent = text.trim();
  return fullContent.length > MAX_CHARS
    ? fullContent.slice(0, MAX_CHARS)
    : fullContent;
}

async function getActiveTab() {
  const [tab] = await platform.tabs.query({ active: true, currentWindow: true });
  if (!tab) throw new Error("No active tab found. Please try again.");
  return tab;
}

async function executeContentScript(tabId, useExtractionEngine) {
  const [{ result }] = await platform.scripting.executeScript({
    target: { tabId },
    func: extractPageData,
    args: [useExtractionEngine],
  });
  return result;
}

/**
 * Fetch page content from the active tab using a content script.
 * @returns {Promise<{ content: string, title: string, sourceUrl: string }>}
 */
export async function getPageContent() {
  try {
    const tab = await getActiveTab();
    const tabUrl = await getPageUrl();
    const settings = await getSettings();
    const pageData = await executeContentScript(tab.id, Boolean(settings.useExtractionEngine));
    return {
      content: buildContentFromText(pageData?.text),
      title: pageData?.title || "",
      sourceUrl: tabUrl || ""
    };
  } catch (err) {
    console.error("Failed to get page content:", err);
    throw new Error("No relevant content found to summarize on this page.");
  }
}

/**
 * Get the active tab URL.
 * @returns {Promise<string>}
 */
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
