export function createMarkdownRenderer(renderer) {
  function normalizeMarkdown(text) {
    return String(text || "")
      .replace(/\r\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/^\s*>\s*$/gm, "")
      .replace(/^(?:\s*>\s*\n){2,}/gm, "\n")
      .trim();
  }

  function replaceLatexWithUnicode(text) {
    const greekMap = {
      alpha: "α",
      beta: "β",
      gamma: "γ",
      delta: "δ",
      epsilon: "ε",
      zeta: "ζ",
      eta: "η",
      theta: "θ",
      iota: "ι",
      kappa: "κ",
      lambda: "λ",
      mu: "μ",
      nu: "ν",
      xi: "ξ",
      pi: "π",
      rho: "ρ",
      sigma: "σ",
      tau: "τ",
      upsilon: "υ",
      phi: "φ",
      chi: "χ",
      psi: "ψ",
      omega: "ω"
    };
    const subMap = {
      0: "₀", 1: "₁", 2: "₂", 3: "₃", 4: "₄", 5: "₅", 6: "₆", 7: "₇", 8: "₈", 9: "₉",
      a: "ₐ", e: "ₑ", h: "ₕ", i: "ᵢ", j: "ⱼ", k: "ₖ", l: "ₗ", m: "ₘ", n: "ₙ", o: "ₒ", p: "ₚ",
      r: "ᵣ", s: "ₛ", t: "ₜ", u: "ᵤ", v: "ᵥ", x: "ₓ"
    };
    const supMap = {
      0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹",
      a: "ᵃ", b: "ᵇ", c: "ᶜ", d: "ᵈ", e: "ᵉ", f: "ᶠ", g: "ᵍ", h: "ʰ", i: "ᶦ", j: "ʲ",
      k: "ᵏ", l: "ˡ", m: "ᵐ", n: "ⁿ", o: "ᵒ", p: "ᵖ", r: "ʳ", s: "ˢ", t: "ᵗ",
      u: "ᵘ", v: "ᵛ", w: "ʷ", x: "ˣ", y: "ʸ", z: "ᶻ"
    };
    const mathbbMap = { R: "ℝ", N: "ℕ", Z: "ℤ", Q: "ℚ", C: "ℂ" };
    const mathcalMap = { L: "ℒ", H: "ℋ", B: "ℬ", F: "ℱ" };
    const combining = {
      hat: "\u0302",
      bar: "\u0304",
      tilde: "\u0303"
    };

    let output = text;
    output = output.replace(/\\\\(alpha|beta|gamma|delta|epsilon|zeta|eta|theta|iota|kappa|lambda|mu|nu|xi|pi|rho|sigma|tau|upsilon|phi|chi|psi|omega)\b/g, (_, key) => greekMap[key] || _);
    output = output.replace(/\\(alpha|beta|gamma|delta|epsilon|zeta|eta|theta|iota|kappa|lambda|mu|nu|xi|pi|rho|sigma|tau|upsilon|phi|chi|psi|omega)\b/g, (_, key) => greekMap[key] || _);
    output = output.replace(/\\\\(partial|nabla|infty|times|cdot|leq|le|geq|ge|neq|ne|approx|propto|pm|sum|prod)\b/g, (_, key) => `\\${key}`);
    output = output.replace(/\\partial\b/g, "∂");
    output = output.replace(/\\nabla\b/g, "∇");
    output = output.replace(/\\infty\b/g, "∞");
    output = output.replace(/\\times\b/g, "×");
    output = output.replace(/\\cdot\b/g, "·");
    output = output.replace(/\\leq\b|\\le\b/g, "≤");
    output = output.replace(/\\geq\b|\\ge\b/g, "≥");
    output = output.replace(/\\neq\b|\\ne\b/g, "≠");
    output = output.replace(/\\approx\b/g, "≈");
    output = output.replace(/\\propto\b/g, "∝");
    output = output.replace(/\\pm\b/g, "±");
    output = output.replace(/\\sum\b/g, "∑");
    output = output.replace(/\\prod\b/g, "∏");
    output = output.replace(/\\\\text\{([^}]+)\}/g, "$1");
    output = output.replace(/\\text\{([^}]+)\}/g, "$1");
    output = output.replace(/\\\\mathrm\{([^}]+)\}/g, "$1");
    output = output.replace(/\\mathrm\{([^}]+)\}/g, "$1");
    output = output.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, "($1)/($2)");
    output = output.replace(/\\\\frac\{([^}]+)\}\{([^}]+)\}/g, "($1)/($2)");
    output = output.replace(/\\sqrt\{([^}]+)\}/g, "√($1)");
    output = output.replace(/\\\\sqrt\{([^}]+)\}/g, "√($1)");
    output = output.replace(/\\mathbb\{([A-Za-z])\}/g, (_, ch) => mathbbMap[ch] || ch);
    output = output.replace(/\\\\mathbb\{([A-Za-z])\}/g, (_, ch) => mathbbMap[ch] || ch);
    output = output.replace(/\\mathcal\{([A-Za-z])\}/g, (_, ch) => mathcalMap[ch] || ch);
    output = output.replace(/\\\\mathcal\{([A-Za-z])\}/g, (_, ch) => mathcalMap[ch] || ch);
    output = output.replace(/\\(hat|bar|tilde)\{([^}]+)\}/g, (_, accent, body) => {
      const mark = combining[accent] || "";
      if (!mark) return body;
      return body.split("").map(ch => ch + mark).join("");
    });
    output = output.replace(/\\\\(hat|bar|tilde)\{([^}]+)\}/g, (_, accent, body) => {
      const mark = combining[accent] || "";
      if (!mark) return body;
      return body.split("").map(ch => ch + mark).join("");
    });
    output = output.replace(/_\{([A-Za-z0-9]+)\}/g, (_, chars) => chars.split("").map(c => subMap[c] || c).join(""));
    output = output.replace(/\^\{([A-Za-z0-9]+)\}/g, (_, chars) => chars.split("").map(c => supMap[c] || c).join(""));
    output = output.replace(/_([A-Za-z0-9])/g, (_, c) => subMap[c] || c);
    output = output.replace(/\^([A-Za-z0-9])/g, (_, c) => supMap[c] || c);
    output = output.replace(/([α-ω])\s*([0-9]+)/g, (_, greek, digits) => `${greek}${digits.split("").map(d => subMap[d] || d).join("")}`);
    output = output.replace(/\\left\s*([\(\[\{])|\\right\s*([\)\]\}])/g, (_, left, right) => left || right || "");
    output = output.replace(/\\\(|\\\)|\\\[|\\\]/g, "");
    output = output.replace(/\\([α-ω])/g, "$1");
    output = output.replace(/\\([₀-₉])/g, "$1");
    return output;
  }

  function normalizeMath(text) {
    const parts = [];
    const regex = /```[\s\S]*?```/g;
    let lastIndex = 0;
    let match;
    while ((match = regex.exec(text)) !== null) {
      parts.push(replaceLatexWithUnicode(text.slice(lastIndex, match.index)));
      parts.push(match[0]);
      lastIndex = match.index + match[0].length;
    }
    parts.push(replaceLatexWithUnicode(text.slice(lastIndex)));
    return parts.join("");
  }

  function renderMarkdownToElement(element, text) {
    if (!element) return;
    if (window.marked) {
      const base = normalizeMarkdown(text || "");
      const normalized = window.renderMathInElement ? base : normalizeMath(base);
      const html = marked.parse(normalized, {
        breaks: true,
        renderer,
        mangle: false,
        headerIds: false
      });
      const parsed = new DOMParser().parseFromString(html, "text/html");
      const fragment = document.createDocumentFragment();
      Array.from(parsed.body.childNodes).forEach((node) => {
        fragment.appendChild(node);
      });
      element.replaceChildren(fragment);
      if (window.renderMathInElement) {
        window.renderMathInElement(element, {
          delimiters: [
            { left: "$$", right: "$$", display: true },
            { left: "\\[", right: "\\]", display: true },
            { left: "$", right: "$", display: false },
            { left: "\\(", right: "\\)", display: false }
          ],
          throwOnError: false
        });
      }
      return;
    }
    element.textContent = normalizeMarkdown(text || "");
  }

  function renderMarkdownToContainer(container, text, updateWordCount) {
    if (window.marked) {
      const base = normalizeMarkdown(text || "");
      const normalized = window.renderMathInElement ? base : normalizeMath(base);
      const html = marked.parse(normalized, {
        breaks: true,
        renderer,
        mangle: false,
        headerIds: false
      });
      const parsed = new DOMParser().parseFromString(html, "text/html");
      const fragment = document.createDocumentFragment();
      Array.from(parsed.body.childNodes).forEach((node) => {
        fragment.appendChild(node);
      });
      container.replaceChildren(fragment);
      if (window.renderMathInElement) {
        window.renderMathInElement(container, {
          delimiters: [
            { left: "$$", right: "$$", display: true },
            { left: "\\[", right: "\\]", display: true },
            { left: "$", right: "$", display: false },
            { left: "\\(", right: "\\)", display: false }
          ],
          throwOnError: false
        });
      }
    } else {
      container.textContent = normalizeMarkdown(text || "");
    }
    if (updateWordCount) {
      updateWordCount(text);
    }
  }

  return { renderMarkdownToElement, renderMarkdownToContainer };
}
