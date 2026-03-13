# Page Summarizer Extension — UI/UX Specification v2

---

## Current UX Audit & Rating

### Score: 5.5 / 10

| Dimension | Score | Notes |
|---|---|---|
| Visual hierarchy | 5/10 | Three equal-weight buttons in popup create no clear primary action. All three result-page action buttons share the same `.btn-primary` style — no hierarchy. |
| Simplicity | 5/10 | Settings page is overwhelming: 10+ fields visible at once with mixed visibility rules via JS. Reset and Save buttons look identical — dangerous. |
| Dark mode | 0/10 | No dark mode at all. Several hardcoded hex values (`#1f2937`, `#e8eaed`) bypass the CSS variable system. |
| Responsive / mobile | 4/10 | Mobile is an afterthought — small adjustments at 768px rather than a mobile-first layout. History uses a `<table>` which breaks badly on narrow screens. |
| Consistency | 5/10 | Emojis and inline SVGs mixed as icons. Section headers use `ALL CAPS` in settings but title-case elsewhere. `--muted-text` token is referenced but never defined in `:root`. |
| Accessibility | 7/10 | Good ARIA usage in popup. Focus rings present. But form labels in settings use implicit association (text inside `<label>`) rather than explicit `for`/`id`, which can confuse screen readers with dynamic show/hide. |
| Motion & feedback | 6/10 | Spinner and notification slide-in are good. Streaming dot animation is creative. But no skeleton loading, no micro-interactions on cards, no pressed state on buttons. |
| Spacing system | 4/10 | Ad-hoc spacing values throughout. No consistent grid. Values like `25px`, `30px`, `16px`, `20px` appear without a common base unit. |

### Key Problems to Solve
1. No dark mode — must be automatic via `prefers-color-scheme`
2. History table is unusable on mobile — replace with card list
3. No clear primary action hierarchy in popup or results
4. Settings cognitive overload — group into visual sections, use segmented controls for provider selection
5. Hardcoded colors mixed with CSS variables break theming
6. No consistent spacing/type scale
7. Emoji icons are OS-dependent and visually inconsistent — replace with SVG icons

---

## Design Principles for v2

1. **One clear action per screen** — every view has an obvious primary CTA
2. **Mobile-first** — base styles target mobile (~360px), progressively enhanced for desktop
3. **System-native theming** — automatic light/dark via `prefers-color-scheme`, zero JS needed
4. **8px spacing grid** — all spacing is a multiple of 4px, preferred values are multiples of 8px
5. **Modular type scale** — 6-step scale at 1.25 ratio anchored at 16px base
6. **SVG-only icons** — consistent, scalable, color-inheriting; no emoji in UI chrome
7. **Minimal borders, maximum whitespace** — use spacing and subtle backgrounds to separate regions, not heavy borders
8. **Destructive actions require intent** — Reset/Delete are visually differentiated and require confirmation

---

## Design System

### Color Tokens

All tokens are defined on `:root` for light mode. The `@media (prefers-color-scheme: dark)` block overrides all tokens — no component-level dark mode logic needed.

```css
:root {
  color-scheme: light dark;

  /* Backgrounds */
  --color-bg:            #F9FAFB;
  --color-surface:       #FFFFFF;
  --color-surface-raised:#F3F4F6;
  --color-surface-overlay:#FFFFFF;

  /* Borders */
  --color-border:        #E5E7EB;
  --color-border-subtle: #F3F4F6;

  /* Text */
  --color-text-primary:  #111827;
  --color-text-secondary:#6B7280;
  --color-text-tertiary: #9CA3AF;
  --color-text-inverse:  #FFFFFF;

  /* Accent (interactive) */
  --color-accent:        #2563EB;
  --color-accent-hover:  #1D4ED8;
  --color-accent-active: #1E40AF;
  --color-accent-subtle: #EFF6FF;
  --color-accent-text:   #1D4ED8;  /* accent text on light bg */

  /* Semantic */
  --color-success:       #059669;
  --color-success-subtle:#ECFDF5;
  --color-warning:       #D97706;
  --color-warning-subtle:#FFFBEB;
  --color-danger:        #DC2626;
  --color-danger-hover:  #B91C1C;
  --color-danger-subtle: #FEF2F2;

  /* Elevation */
  --shadow-xs: 0 1px 2px rgba(0,0,0,0.05);
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04);
  --shadow-md: 0 4px 6px -1px rgba(0,0,0,0.08), 0 2px 4px -2px rgba(0,0,0,0.04);
  --shadow-lg: 0 10px 15px -3px rgba(0,0,0,0.08), 0 4px 6px -4px rgba(0,0,0,0.04);

  /* Focus ring */
  --focus-ring: 0 0 0 3px rgba(37,99,235,0.30);
}

@media (prefers-color-scheme: dark) {
  :root {
    --color-bg:             #0F172A;
    --color-surface:        #1E293B;
    --color-surface-raised: #334155;
    --color-surface-overlay:#1E293B;

    --color-border:         #334155;
    --color-border-subtle:  #1E293B;

    --color-text-primary:   #F1F5F9;
    --color-text-secondary: #94A3B8;
    --color-text-tertiary:  #64748B;
    --color-text-inverse:   #0F172A;

    --color-accent:         #3B82F6;
    --color-accent-hover:   #2563EB;
    --color-accent-active:  #1D4ED8;
    --color-accent-subtle:  rgba(59,130,246,0.12);
    --color-accent-text:    #60A5FA;

    --color-success:        #10B981;
    --color-success-subtle: rgba(16,185,129,0.12);
    --color-warning:        #FBBF24;
    --color-warning-subtle: rgba(251,191,36,0.12);
    --color-danger:         #EF4444;
    --color-danger-hover:   #DC2626;
    --color-danger-subtle:  rgba(239,68,68,0.12);

    --shadow-xs: 0 1px 2px rgba(0,0,0,0.30);
    --shadow-sm: 0 1px 3px rgba(0,0,0,0.40), 0 1px 2px rgba(0,0,0,0.20);
    --shadow-md: 0 4px 6px -1px rgba(0,0,0,0.40), 0 2px 4px -2px rgba(0,0,0,0.20);
    --shadow-lg: 0 10px 15px -3px rgba(0,0,0,0.50), 0 4px 6px -4px rgba(0,0,0,0.30);

    --focus-ring: 0 0 0 3px rgba(59,130,246,0.40);
  }
}
```

---

### Typography

**Font stack:** `'Inter', 'Segoe UI', system-ui, -apple-system, 'Helvetica Neue', Arial, sans-serif`

Load Inter from Google Fonts (300, 400, 500, 600 weights) or fall back gracefully to system fonts — no web font is required for the spec to work.

**Monospace stack:** `'JetBrains Mono', 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace`

**Type scale (1.25 modular scale, base = 16px):**

| Token | Value | rem | Usage |
|---|---|---|---|
| `--text-xs` | 12px | 0.75rem | Help text, metadata, timestamps |
| `--text-sm` | 14px | 0.875rem | Labels, secondary content, table cells |
| `--text-base` | 16px | 1rem | Body text, form inputs |
| `--text-lg` | 18px | 1.125rem | Card titles, section headings |
| `--text-xl` | 20px | 1.25rem | Page subtitles |
| `--text-2xl` | 24px | 1.5rem | Page titles |
| `--text-3xl` | 30px | 1.875rem | Stat numbers |

**Font weights:**
- Regular: `400`
- Medium: `500`
- Semibold: `600`

**Line heights:**
- Tight (headings): `1.25`
- Normal (body): `1.6`
- Relaxed (reading content): `1.75`

---

### Spacing Scale (8px grid)

| Token | Value | Usage |
|---|---|---|
| `--space-1` | 4px | Icon padding, tight gaps |
| `--space-2` | 8px | Inner element gaps, chip padding |
| `--space-3` | 12px | Button padding (vertical), input padding |
| `--space-4` | 16px | Card inner padding, standard gaps |
| `--space-5` | 20px | Section gaps |
| `--space-6` | 24px | Card padding |
| `--space-8` | 32px | Section separation |
| `--space-10` | 40px | Page-level padding |
| `--space-12` | 48px | Hero spacing |

---

### Shape & Motion

**Border radius:**
```css
--radius-sm:  6px;   /* small inputs, chips, badges */
--radius-md:  10px;  /* buttons, cards, modals */
--radius-lg:  14px;  /* large panels */
--radius-full: 9999px; /* pills, avatars, toggles */
```

**Transitions:**
```css
--transition-fast:   100ms ease;
--transition-base:   200ms ease;
--transition-slow:   300ms ease;
```

All interactive elements: `transition: background-color var(--transition-base), box-shadow var(--transition-base), border-color var(--transition-base), opacity var(--transition-base)`

---

### SVG Icon System

All icons are inline SVG, `width="16" height="16"` (or `20`/`24` for larger contexts), `fill="none"`, `stroke="currentColor"`, `stroke-width="1.75"`, `stroke-linecap="round"`, `stroke-linejoin="round"`. This gives them a consistent outlined style that works at all sizes and in both themes.

**Required icons (use Lucide or Heroicons outline style):**

| Icon | Usage |
|---|---|
| `sparkles` or `zap` | Summarize action |
| `clock` or `history` | History navigation |
| `settings` (gear) | Settings navigation |
| `copy` | Copy to clipboard |
| `download` | Download summary |
| `trash-2` | Delete item |
| `search` | History search |
| `chevron-right` | Row click affordance |
| `chevron-down` | Collapsible open |
| `check` | Success confirmation |
| `x` | Close / dismiss |
| `alert-circle` | Error state |
| `info` | Help tooltip |
| `arrow-left` | Back navigation |
| `eye-off` | Password visibility |
| `external-link` | Source URL link |

---

## Global CSS Base

```css
/* Reset */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { -webkit-text-size-adjust: 100%; }
img, svg { display: block; }
button, input, select, textarea { font: inherit; }

/* Base */
body {
  font-family: 'Inter', 'Segoe UI', system-ui, -apple-system, 'Helvetica Neue', Arial, sans-serif;
  font-size: var(--text-base);
  line-height: 1.6;
  color: var(--color-text-primary);
  background: var(--color-bg);
  min-height: 100vh;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* Focus management */
:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}
```

---

## Component Library

### Button

Base class `.btn` — all buttons use this.

```
Structure: <button class="btn btn-[variant] btn-[size]">
           [optional icon] Label text
           </button>
```

**Base styles:**
```css
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);      /* 12px 16px */
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: 500;
  line-height: 1;
  cursor: pointer;
  text-decoration: none;
  white-space: nowrap;
  transition: background-color var(--transition-base),
              box-shadow var(--transition-base),
              border-color var(--transition-base),
              opacity var(--transition-base);
  -webkit-user-select: none;
  user-select: none;
}

.btn:active { opacity: 0.88; transform: scale(0.98); }
.btn:disabled { opacity: 0.45; cursor: not-allowed; pointer-events: none; }
```

**Variants:**

| Class | Background | Text | Border | Hover bg |
|---|---|---|---|---|
| `.btn-primary` | `--color-accent` | `--color-text-inverse` | transparent | `--color-accent-hover` |
| `.btn-secondary` | `--color-surface-raised` | `--color-text-primary` | `--color-border` | `--color-border` (darker) |
| `.btn-ghost` | transparent | `--color-accent-text` | transparent | `--color-accent-subtle` |
| `.btn-danger` | `--color-danger-subtle` | `--color-danger` | transparent | `--color-danger` + white text |
| `.btn-danger-solid` | `--color-danger` | white | transparent | `--color-danger-hover` |

**Sizes:**

| Class | Padding | Font size | Icon size |
|---|---|---|---|
| `.btn-sm` | `8px 12px` | `--text-xs` | 14px |
| `.btn-md` (default) | `12px 16px` | `--text-sm` | 16px |
| `.btn-lg` | `14px 20px` | `--text-base` | 18px |
| `.btn-xl` | `16px 24px` | `--text-lg` | 20px |
| `.btn-full` | adds `width: 100%` | — | — |
| `.btn-icon` | `10px` all sides, `border-radius: --radius-full`, `40×40px` | — | 18px |

**Loading state (`.btn.is-loading`):**
- Button content replaced by spinner + "Loading…" text
- Spinner: `16px` circle, `border: 2px solid currentColor`, `border-top-color: transparent`, `border-radius: 50%`, `animation: spin 0.7s linear infinite`
- Pointer events disabled during loading

---

### Form Controls

**Text input / select / textarea:**

```css
.form-input, .form-select, .form-textarea {
  width: 100%;
  padding: var(--space-3) var(--space-4);   /* 12px 16px */
  background: var(--color-surface);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  line-height: 1.5;
  transition: border-color var(--transition-base), box-shadow var(--transition-base);
  -webkit-appearance: none;
  appearance: none;
}

.form-input:hover, .form-select:hover, .form-textarea:hover {
  border-color: var(--color-text-tertiary);
}

.form-input:focus, .form-select:focus, .form-textarea:focus {
  border-color: var(--color-accent);
  box-shadow: var(--focus-ring);
  outline: none;
}
```

**Password input:** Wrap in `.input-group` with a visibility toggle icon button absolutely positioned right.

**Form label:**
```css
.form-label {
  display: block;
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--color-text-secondary);
  margin-bottom: var(--space-2);
}
```

**Help text:**
```css
.form-help {
  font-size: var(--text-xs);
  color: var(--color-text-tertiary);
  margin-top: var(--space-1);
  line-height: 1.4;
}
```

**Form group** (`.form-group`): `margin-bottom: var(--space-5)`

**Select custom arrow:** Use `background-image` SVG data-URI chevron-down in `--color-text-tertiary`, `background-repeat: no-repeat`, `background-position: right 12px center`, `padding-right: 36px`.

---

### Toggle Switch

Replace all `<input type="checkbox">` for boolean options with a custom toggle:

```html
<label class="toggle">
  <input type="checkbox" class="toggle-input" role="switch" />
  <span class="toggle-track">
    <span class="toggle-thumb"></span>
  </span>
  <span class="toggle-label">Label text</span>
</label>
```

```css
.toggle { display: flex; align-items: center; gap: var(--space-3); cursor: pointer; }
.toggle-input { position: absolute; opacity: 0; width: 0; height: 0; }
.toggle-track {
  width: 36px; height: 20px;
  border-radius: var(--radius-full);
  background: var(--color-border);
  transition: background var(--transition-base);
  position: relative; flex-shrink: 0;
}
.toggle-thumb {
  position: absolute;
  top: 2px; left: 2px;
  width: 16px; height: 16px;
  border-radius: 50%;
  background: white;
  box-shadow: var(--shadow-xs);
  transition: transform var(--transition-base);
}
.toggle-input:checked + .toggle-track { background: var(--color-accent); }
.toggle-input:checked + .toggle-track .toggle-thumb { transform: translateX(16px); }
.toggle-input:focus-visible + .toggle-track { box-shadow: var(--focus-ring); }
.toggle-label { font-size: var(--text-sm); color: var(--color-text-primary); }
```

---

### Segmented Control (Provider Selector)

Replace the `<select>` for provider with a pill-button group:

```html
<div class="segment-group" role="group" aria-label="AI Provider">
  <button class="segment-btn is-active" data-value="gemini">Gemini</button>
  <button class="segment-btn" data-value="openai">OpenAI</button>
  <button class="segment-btn" data-value="azure">Azure</button>
  <button class="segment-btn" data-value="ollama">Ollama</button>
</div>
```

```css
.segment-group {
  display: flex;
  gap: var(--space-1);
  background: var(--color-surface-raised);
  border-radius: var(--radius-md);
  padding: var(--space-1);
}
.segment-btn {
  flex: 1;
  padding: var(--space-2) var(--space-3);
  border: none;
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--color-text-secondary);
  background: transparent;
  cursor: pointer;
  transition: background var(--transition-base), color var(--transition-base), box-shadow var(--transition-base);
}
.segment-btn.is-active {
  background: var(--color-surface);
  color: var(--color-text-primary);
  box-shadow: var(--shadow-sm);
}
.segment-btn:hover:not(.is-active) { color: var(--color-text-primary); }
```

On mobile (≤480px): wrap to two rows with `flex-wrap: wrap`, each button at `calc(50% - 2px)`.

---

### Card

```css
.card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
}
.card-body { padding: var(--space-6); }
.card-footer {
  padding: var(--space-4) var(--space-6);
  border-top: 1px solid var(--color-border-subtle);
  background: var(--color-surface-raised);
}
```

Elevated variant `.card-elevated`: adds `box-shadow: var(--shadow-sm)`, removes border.

Interactive variant `.card-interactive`:
```css
.card-interactive {
  cursor: pointer;
  transition: box-shadow var(--transition-base), border-color var(--transition-base);
}
.card-interactive:hover {
  border-color: var(--color-accent);
  box-shadow: var(--shadow-md);
}
.card-interactive:active { transform: scale(0.995); }
```

---

### Badge / Chip

```css
.badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
  font-weight: 500;
  white-space: nowrap;
}
.badge-default  { background: var(--color-surface-raised); color: var(--color-text-secondary); }
.badge-accent   { background: var(--color-accent-subtle);  color: var(--color-accent-text); }
.badge-success  { background: var(--color-success-subtle); color: var(--color-success); }
.badge-warning  { background: var(--color-warning-subtle); color: var(--color-warning); }
.badge-danger   { background: var(--color-danger-subtle);  color: var(--color-danger); }
```

---

### Notification / Toast

```css
.toast {
  position: fixed;
  top: var(--space-5);
  right: var(--space-5);
  min-width: 240px;
  max-width: 360px;
  padding: var(--space-4) var(--space-5);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-lg);
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  z-index: 9999;
  transform: translateX(calc(100% + var(--space-5)));
  transition: transform var(--transition-slow) cubic-bezier(0.34, 1.56, 0.64, 1);
}
.toast.is-visible { transform: translateX(0); }
.toast-icon { flex-shrink: 0; margin-top: 1px; }
.toast-title { font-size: var(--text-sm); font-weight: 600; color: var(--color-text-primary); }
.toast-message { font-size: var(--text-xs); color: var(--color-text-secondary); margin-top: 2px; }
.toast-close { margin-left: auto; flex-shrink: 0; }

/* Semantic tints */
.toast-success .toast-icon { color: var(--color-success); }
.toast-error   .toast-icon { color: var(--color-danger); }
.toast-warning .toast-icon { color: var(--color-warning); }
```

On mobile (≤480px): `left: var(--space-4)`, `right: var(--space-4)`, `top: auto`, `bottom: var(--space-4)`, slides up from bottom (`translateY(calc(100% + var(--space-4)))`).

---

### Skeleton Loader

Show while content is loading instead of a spinner-only approach:

```css
.skeleton {
  background: linear-gradient(
    90deg,
    var(--color-surface-raised) 25%,
    var(--color-border) 50%,
    var(--color-surface-raised) 75%
  );
  background-size: 200% 100%;
  border-radius: var(--radius-sm);
  animation: skeleton-shimmer 1.5s ease-in-out infinite;
}
@keyframes skeleton-shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

Usage: `<div class="skeleton" style="height: 16px; width: 80%; margin-bottom: 8px;"></div>`

---

### Section Divider

```html
<div class="section-label">Section Name</div>
```

```css
.section-label {
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--color-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: var(--space-3);
  margin-top: var(--space-6);
}
.section-label:first-child { margin-top: 0; }
```

---

## Views

---

### 1. Popup (`popup.html`)

**Role:** Extension entry point. Single clear action: Summarize. Secondary navigation below.

**Dimensions:** Fixed `360 × 400px` (width × height). Body: `overflow: hidden`.

**Layout:** Flex column, `background: var(--color-bg)`, padding `var(--space-4)`.

**Visual wireframe:**
```
┌────────────────────────────┐  360px
│ ● Page Summarizer        ⚙ │  top bar: icon + name + settings icon button
├────────────────────────────┤  1px border --color-border
│                             │
│  ┌──────────────────────┐  │  hero CTA card
│  │  ✦  Summarize        │  │  .btn-primary .btn-full .btn-xl
│  │     this page        │  │  large, visually dominant
│  └──────────────────────┘  │
│                             │
│  [🕐 History] [↗ Share  ]  │  two equal ghost/secondary buttons, side by side
│                             │
│  ─────────────────────────  │  divider
│                             │
│  ┌──────────────────────┐  │  stats card
│  │   42                 │  │  .badge or small chip row
│  │   Pages summarized   │  │
│  └──────────────────────┘  │
└────────────────────────────┘  400px
```

**Top bar (`.popup-header`):**
- `display: flex`, `align-items: center`, `padding: var(--space-4)`, `border-bottom: 1px solid var(--color-border-subtle)`
- Logo: 20px SVG icon (document/sparkle) in `--color-accent`
- App name: `font-size: var(--text-sm)`, `font-weight: 600`, `margin-left: var(--space-2)`, `color: var(--color-text-primary)`
- Settings button: `.btn-icon` (gear SVG), `margin-left: auto`, `color: var(--color-text-tertiary)`, hover → `color: var(--color-text-primary)`

**Main area (`.popup-body`):**
- `padding: var(--space-5) var(--space-4)`
- `display: flex`, `flex-direction: column`, `gap: var(--space-3)`

**Primary CTA (Summarize button):**
- Class: `.btn .btn-primary .btn-xl .btn-full`
- Height: `52px`
- Icon: `sparkles` or `zap` SVG, `20px`
- Label: `"Summarize this page"`
- Font: `var(--text-base)`, `font-weight: 600`
- `border-radius: var(--radius-md)`
- Loading state: replace icon with spinner (same size), text → `"Summarizing…"`, button disabled

**Secondary actions row:**
- `display: grid`, `grid-template-columns: 1fr 1fr`, `gap: var(--space-2)`
- `[History]` button: `.btn .btn-secondary .btn-full` + clock SVG icon
- `[Share]` button (optional, show only if last summary exists): `.btn .btn-secondary .btn-full` + share SVG icon
- Height: `40px` each

**Divider:** `<hr>` — `border: none`, `border-top: 1px solid var(--color-border-subtle)`, `margin: var(--space-1) 0`

**Stats card (`.popup-stats`):**
- `background: var(--color-accent-subtle)`, `border-radius: var(--radius-md)`, `padding: var(--space-4)`
- `display: flex`, `align-items: center`, `gap: var(--space-3)`
- Stat number: `font-size: var(--text-2xl)`, `font-weight: 600`, `color: var(--color-accent)`, `line-height: 1`
- Stat label: `font-size: var(--text-xs)`, `color: var(--color-accent-text)`, `line-height: 1.3`
- `aria-live="polite"` on the number element

**Accessibility:** `<main>` wrapper with `aria-label="Page Summarizer"`. Summarize button has `aria-label="Summarize current page"`.

---

### 2. History (`history.html`)

**Role:** Browse and revisit previously generated summaries.

**Layout:** Full-page, mobile-first. `background: var(--color-bg)`.

**Mobile layout (< 640px):** Single column, full-bleed cards, sticky header.
**Desktop layout (≥ 640px):** Centered container, `max-width: 720px`, `padding: var(--space-8) var(--space-5)`.

**Visual wireframe (mobile):**
```
┌──────────────────────────────┐
│ ← History            [Clear] │  sticky header, bg --color-surface, border-bottom
├──────────────────────────────┤
│ [ 🔍 Search summaries...   ] │  search input, full-width, --space-4 padding
├──────────────────────────────┤
│                               │
│  ┌────────────────────────┐  │
│  │ How to Build React Apps│  │  .card .card-interactive
│  │ github.com             │  │  domain badge + date chip (right-aligned)
│  │ · 2h ago  · GPT-4      │  │  metadata row
│  │ This tutorial covers...│  │  preview text, 2 lines max
│  │                     >  │  │  chevron-right icon
│  └────────────────────────┘  │
│                               │
│  ┌────────────────────────┐  │
│  │ ...                    │  │
│  └────────────────────────┘  │
│                               │
└──────────────────────────────┘
```

**Sticky header (`.history-header`):**
- `position: sticky`, `top: 0`, `z-index: 100`
- `background: var(--color-surface)`, `border-bottom: 1px solid var(--color-border)`
- `padding: var(--space-4) var(--space-5)`
- `display: flex`, `align-items: center`, `gap: var(--space-3)`
- Back/close button: `.btn-icon` with `arrow-left` SVG (links back to popup or closes tab)
- Title: `"History"`, `font-size: var(--text-lg)`, `font-weight: 600`, `flex: 1`
- Clear button: `.btn .btn-danger .btn-sm` with `trash-2` icon; requires a confirmation dialog before acting (see below)

**Search bar (`.history-search`):**
- `padding: var(--space-3) var(--space-5)`
- `background: var(--color-bg)`, `border-bottom: 1px solid var(--color-border-subtle)`
- Input wraps in `.input-icon-left` — search SVG icon at `left: 12px`, input `padding-left: 36px`
- Placeholder: `"Search summaries…"`
- Filters results live (JS handles this, no submit needed)

**Cards list (`.history-list`):**
- `padding: var(--space-3) var(--space-4)`, `display: flex`, `flex-direction: column`, `gap: var(--space-3)`
- Desktop: `padding: var(--space-4) 0`

**History card (`.history-card`):**
- HTML structure:
  ```html
  <article class="card card-interactive history-card" role="button" tabindex="0">
    <div class="history-card-body">
      <div class="history-card-header">
        <span class="history-card-title">Article Title Here</span>
        <span class="badge badge-default history-card-date">2h ago</span>
      </div>
      <div class="history-card-meta">
        <span class="badge badge-accent">github.com</span>
        <span class="badge badge-default">GPT-4</span>
      </div>
      <p class="history-card-preview">Preview of the summary text truncated to two lines...</p>
    </div>
    <div class="history-card-actions">
      <button class="btn btn-icon btn-danger" aria-label="Delete this summary">
        [trash-2 SVG]
      </button>
      <span class="history-card-chevron">[chevron-right SVG]</span>
    </div>
  </article>
  ```

- `.history-card-body`: `flex: 1`, `min-width: 0`
- `.history-card-header`: `display: flex`, `align-items: flex-start`, `gap: var(--space-2)`, `margin-bottom: var(--space-2)`
- `.history-card-title`: `font-size: var(--text-sm)`, `font-weight: 600`, `color: var(--color-text-primary)`, `flex: 1`, `overflow: hidden`, `display: -webkit-box`, `-webkit-line-clamp: 2`, `-webkit-box-orient: vertical`
- `.history-card-meta`: `display: flex`, `gap: var(--space-2)`, `margin-bottom: var(--space-2)`, `flex-wrap: wrap`
- `.history-card-preview`: `font-size: var(--text-xs)`, `color: var(--color-text-secondary)`, `line-height: 1.5`, `overflow: hidden`, `display: -webkit-box`, `-webkit-line-clamp: 2`, `-webkit-box-orient: vertical`
- `.history-card-actions`: `display: flex`, `align-items: center`, `gap: var(--space-2)`, `padding-left: var(--space-3)`, `flex-shrink: 0`
- `.history-card-chevron`: `color: var(--color-text-tertiary)`, `16px`
- Card outer: `display: flex`, `align-items: center`, `padding: var(--space-4)`, `gap: var(--space-2)`

**Delete confirmation:** On delete icon click, show an inline confirmation that replaces the card's action area:
```
[ Cancel ] [ Yes, delete ]
```
Auto-dismiss after 5 seconds back to normal. This prevents accidental deletion.

**Clear History confirmation dialog:** A modal overlay (`.modal`) with warning icon, "Clear all history?" text, cancel + confirm buttons. Do NOT clear on first click.

**Empty state (`.history-empty`):**
- Centered, `padding: var(--space-12) var(--space-5)`
- Large faded icon (`48px`, `color: var(--color-text-tertiary)`)
- `"No summaries yet"` heading, `font-size: var(--text-lg)`, `font-weight: 600`, `margin-bottom: var(--space-2)`
- Subtext: `"Summarize a page to see it appear here."`, `color: var(--color-text-secondary)`

**No search results state:** Same structure, icon `search-x`, heading `"No matches"`, subtext `"Try a different search term."`

---

### 3. Settings (`options.html`)

**Role:** Configure AI provider, model, output language, and advanced options.

**Layout:** Full-page. Mobile: single column, `padding: var(--space-4)`. Desktop (≥640px): centered, `max-width: 520px`, `padding: var(--space-8) var(--space-5)`.

**Visual wireframe:**
```
┌─────────────────────────────┐
│ ← Settings                  │  sticky header
├─────────────────────────────┤
│                               │
│  AI Provider                  │  .section-label
│  ┌─────────────────────────┐ │
│  │ [Gemini][OpenAI][Azure] │ │  .segment-group (segmented control)
│  │ [Ollama]                │ │
│  └─────────────────────────┘ │
│                               │
│  API Key                      │  .section-label
│  ┌──────────────────────[👁]┐ │
│  │ ••••••••••••••••         │ │  password input + show toggle
│  └──────────────────────────┘ │
│  (Azure/Ollama: Base URL)     │  conditional
│  (Azure: Deployment, Version) │  conditional
│                               │
│  Model                        │  .section-label
│  ┌────────────────────────▾┐  │  .form-select (presets)
│  │ gemini-2.0-flash-exp    │  │
│  └─────────────────────────┘  │
│  ┌─────────────────────────┐  │  custom model input, hidden unless "Custom"
│  │ Custom model name       │  │
│  └─────────────────────────┘  │
│                               │
│  Output                       │  .section-label
│  ┌───────────────────────▾┐   │  language select
│  │ 🇺🇸 English             │   │
│  └────────────────────────┘   │
│  ┌───────────────────────▾┐   │  prompt style select
│  │ Default (Detailed)      │   │
│  └────────────────────────┘   │
│                               │
│  ▸ Advanced                   │  collapsible, closed by default
│                               │
│  ┌─────────────────────────┐  │  sticky footer
│  │   [  Save Settings  ]   │  │  .btn-primary .btn-full .btn-lg
│  └─────────────────────────┘  │
└─────────────────────────────┘
```

**Sticky header (`.settings-header`):**
- Same structure as history header
- Back button: closes/navigates back to popup
- Title: `"Settings"`
- No action button on right (save is in sticky footer)

**Section grouping:** Each logical group is separated by a `.section-label` heading and `var(--space-2)` gap. No card wrappers around each section — whitespace alone provides separation. This is lighter and more modern than the current bordered card approach.

**Provider selector:** `.segment-group` (see component spec above). On mobile wraps to 2×2 grid.

**API Key input:**
- `.input-group`: `position: relative`
- Password input fills width with `padding-right: 44px`
- Toggle button `.btn-icon` positioned `right: 4px`, `top: 50%`, `transform: translateY(-50%)`
- Icon toggles between `eye` and `eye-off`

**Conditional fields (JS-controlled):** Hide/show via `hidden` attribute + CSS `[hidden] { display: none !important; }`. Fields to show per provider:

| Provider | Show fields |
|---|---|
| Gemini | Model preset select, custom model input |
| OpenAI | Model preset select, custom model input |
| Azure | Base URL, Deployment preset, Deployment name, API Version |
| Ollama | Base URL, custom model input |

**Model select:** When a preset is selected, the custom model input is hidden. When "Custom" is selected, the custom model input appears with a subtle slide-down transition: `max-height: 0 → 60px`, `overflow: hidden`, `transition: max-height 200ms ease`.

**Advanced collapsible (`<details>`):**
- Same custom arrow pattern as existing, but styled using the new token system
- Contains:
  - **Sync API keys** toggle (`.toggle` component)
  - **Extraction Mode** select (`.form-select`)
  - **Blocked Sites** text input + "Include defaults" toggle + "Show defaults" ghost button

**Sticky save footer (`.settings-footer`):**
- `position: sticky`, `bottom: 0`
- `background: var(--color-surface)`, `border-top: 1px solid var(--color-border-subtle)`
- `padding: var(--space-4) var(--space-5)`
- Contains: `.btn-primary .btn-full .btn-lg` "Save Settings"
- Reset is a `.btn-ghost .btn-sm` link above the footer, styled in `--color-text-tertiary`, labeled "Reset to defaults"

**Why separate Reset from Save:** Destructive action (reset) should not share the same visual weight as the primary action (save). Placing reset as a ghost link reduces accidental activation.

**Save feedback:** On save, the Save button shows a checkmark icon + "Saved!" for 2 seconds, then reverts. Uses the button's loading/success state pattern, not a separate notification.

---

### 4. Results (`results.html`)

**Role:** Display the AI-generated summary. Optimized for reading. Shows live streaming state.

**Layout:** Full-page. Mobile: `padding: var(--space-4)`. Desktop: centered, `max-width: 740px`, `padding: var(--space-8) var(--space-5)`.

**Visual wireframe:**
```
┌──────────────────────────────────────┐
│ ←         Page Summary   [⎘] [↓]    │  sticky header
├──────────────────────────────────────┤
│                                       │
│  ┌──────────────────────────────────┐ │  source card
│  │  How to Build React Apps         │ │  article title
│  │  ↗ github.com/react/tutorial     │ │  source link with external-link icon
│  │  GPT-4  ·  342 words             │ │  metadata chips
│  └──────────────────────────────────┘ │
│                                       │
│  [Streaming…]                         │  visible during streaming only
│                                       │
│  Summary body text rendered here...  │  #summary, reading typography
│  · max-width 680px                   │
│  · line-height 1.75                  │
│  · font-size var(--text-base)        │
│                                       │
└──────────────────────────────────────┘
```

**Sticky header (`.results-header`):**
- `position: sticky`, `top: 0`, `z-index: 100`
- `background: var(--color-surface)`, `border-bottom: 1px solid var(--color-border)`
- `padding: var(--space-3) var(--space-5)`
- `display: flex`, `align-items: center`, `gap: var(--space-3)`
- Back button: `.btn-icon` with `arrow-left` SVG, `color: var(--color-text-secondary)`
- Title: `"Page Summary"`, `font-size: var(--text-base)`, `font-weight: 600`, `flex: 1`, `text-align: center`
- Action group: `display: flex`, `gap: var(--space-2)`
  - `[Copy]` → `.btn-icon` with `copy` SVG; on success show `check` icon for 1.5s
  - `[Download]` → `.btn-icon` with `download` SVG
- On mobile: title is omitted from header to save space; back button and actions remain

**Source card (`.source-card`):**
- `background: var(--color-surface)`, `border: 1px solid var(--color-border)`, `border-radius: var(--radius-lg)`
- `padding: var(--space-4) var(--space-5)`, `margin-bottom: var(--space-6)`
- `.source-title`: `font-size: var(--text-base)`, `font-weight: 600`, `color: var(--color-text-primary)`, `margin-bottom: var(--space-2)`, `line-height: 1.4`
- `.source-link`: `<a>` with `external-link` SVG icon inline, `font-size: var(--text-sm)`, `color: var(--color-accent-text)`, `margin-bottom: var(--space-3)`, `display: inline-flex`, `align-items: center`, `gap: 4px`; hover → underline
- `.source-meta`: `display: flex`, `gap: var(--space-2)`, `flex-wrap: wrap` — renders `.badge` chips for provider/model and word count
- Hidden by default (`hidden` attribute), revealed by JS when data arrives

**Streaming indicator (`.streaming-status`):**
- `display: flex`, `align-items: center`, `gap: var(--space-2)`, `margin-bottom: var(--space-4)`
- Animated dot: `8px` circle, `background: var(--color-accent)`, `border-radius: 50%`, `animation: pulse 1.2s ease-in-out infinite`
  ```css
  @keyframes pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50%       { opacity: 0.4; transform: scale(0.75); }
  }
  ```
- Label: `"Generating summary…"`, `font-size: var(--text-sm)`, `color: var(--color-text-secondary)`, `font-weight: 500`
- Hidden once streaming completes (JS removes `.is-streaming` class from wrapper)

**Summary body (`#summary`):**
- `font-size: var(--text-base)`, `line-height: 1.75`, `color: var(--color-text-primary)`
- No background — content sits directly on page background for cleaner reading
- `max-width: 680px` (readable line length, ~75ch) — centered within the container

**Loading skeleton (shown before streaming starts):**
```html
<div class="summary-skeleton">
  <div class="skeleton" style="height:18px; width:90%; margin-bottom:10px;"></div>
  <div class="skeleton" style="height:18px; width:75%; margin-bottom:10px;"></div>
  <div class="skeleton" style="height:18px; width:85%; margin-bottom:10px;"></div>
  <div class="skeleton" style="height:18px; width:60%; margin-bottom:24px;"></div>
  <div class="skeleton" style="height:18px; width:88%; margin-bottom:10px;"></div>
  <div class="skeleton" style="height:18px; width:70%;"></div>
</div>
```

**Markdown styles inside `#summary`** (all tokens used, no hardcoded colors):

| Element | CSS |
|---|---|
| `h1` | `font-size: var(--text-2xl); font-weight: 600; color: var(--color-text-primary); margin: 1.8em 0 0.6em; line-height: 1.25;` |
| `h2` | `font-size: var(--text-xl); same weight/color; margin: 1.5em 0 0.5em;` |
| `h3` | `font-size: var(--text-lg); same; margin: 1.3em 0 0.4em;` |
| `p` | `margin: 0.9em 0;` |
| `ul`, `ol` | `margin: 0.9em 0; padding-left: 1.5em;` |
| `li` | `margin-bottom: 0.4em;` |
| `strong` | `font-weight: 600; color: var(--color-text-primary);` |
| `em` | `color: var(--color-text-secondary);` |
| `code` (inline) | `background: var(--color-surface-raised); color: var(--color-accent-text); padding: 2px 6px; border-radius: var(--radius-sm); font-family: monospace; font-size: 0.875em;` |
| `pre` | `background: var(--color-surface-raised); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: var(--space-4); overflow-x: auto; margin: 1.5em 0;` |
| `pre code` | `background: none; color: var(--color-text-primary); font-size: 0.875em; line-height: 1.6;` |
| `blockquote` | `border-left: 3px solid var(--color-accent); padding: var(--space-3) var(--space-4); margin: 1.5em 0; background: var(--color-accent-subtle); border-radius: 0 var(--radius-sm) var(--radius-sm) 0;` |
| `table` | `width: 100%; border-collapse: collapse; margin: 1.5em 0; font-size: var(--text-sm);` |
| `th` | `background: var(--color-surface-raised); font-weight: 600; padding: var(--space-3) var(--space-4); text-align: left; border-bottom: 2px solid var(--color-border);` |
| `td` | `padding: var(--space-3) var(--space-4); border-bottom: 1px solid var(--color-border-subtle);` |
| `a` | `color: var(--color-accent-text); text-underline-offset: 3px;` hover → underline |
| `hr` | `border: none; border-top: 1px solid var(--color-border); margin: 2em 0;` |

**Footer:** Removed. Attribution is implicit; a footer adds unnecessary scroll distance to a reading-focused view.

---

## Navigation Flow (v2)

```
Browser Toolbar Click
         │
         ▼
     [Popup]
         │  ⚙ icon button (top-right)
         ├──────────────────────────────► [Settings] (new tab)
         │
         │  "Summarize this page" (primary CTA)
         ├──────────────────────────────► [Results] (new tab, streaming)
         │                                    │
         │  "History" button                  │  "← Back" or "History" icon
         └──────────────────────────────► [History]
                                              │
                                   Card click │
                                              └──► [Results] (from history)
```

**Navigation principles:**
- Every full-page view (Results, History, Settings) has a "← Back" button in the sticky header
- Settings opens in a new tab (browser extension constraint) — Back navigates to `chrome://newtab` or closes tab
- Results opened from History shows a subtle "From History" badge in the source card

---

## Responsive Breakpoints

```css
/* Mobile-first base styles: 0px+ */
/* Small phones to standard mobile */

@media (min-width: 480px) {
  /* Wider mobile / small tablet: relaxed padding, wider popup if applicable */
}

@media (min-width: 640px) {
  /* Tablet / desktop: centered containers, max-widths applied */
  /* History and Settings container: max-width enforced */
}

@media (min-width: 1024px) {
  /* Wide desktop: results max-width 740px, settings 520px */
}
```

**Key responsive behaviors per view:**

| View | Mobile | Desktop |
|---|---|---|
| Popup | Fixed 360×400px (always) | Same — popup is browser-constrained |
| History | Full-bleed cards, toast at bottom | Centered 720px container, toast top-right |
| Settings | Full-width form, full-width save button | 520px centered card, same save button |
| Results | Full-width, 16px padding | 740px centered, 40px padding, reading max-width |

---

## Accessibility Checklist

- [ ] All interactive elements reachable by keyboard in logical tab order
- [ ] `role="main"` on primary content of each view
- [ ] Buttons have descriptive `aria-label` when icon-only
- [ ] Live regions: `aria-live="polite"` on stats counter and streaming status
- [ ] Form controls use explicit `<label for="id">` association (not implicit wrapping) for screen reader compatibility with dynamically shown/hidden fields
- [ ] Color contrast: all text meets WCAG AA (4.5:1 for body, 3:1 for large text) in both light and dark modes
- [ ] Focus ring visible in both light and dark modes
- [ ] Toggle switches use `role="switch"` and `aria-checked`
- [ ] Segmented control group uses `role="group"` + `aria-label`
- [ ] Delete confirmation prevents accidental data loss
- [ ] History cards use `role="button"` + `tabindex="0"` + `keydown Enter/Space` handler
- [ ] Skeleton loaders include `aria-busy="true"` on their container, `aria-label="Loading summary"`
- [ ] `prefers-reduced-motion`: wrap all animations in `@media (prefers-reduced-motion: no-preference)` to disable them by default for users who request reduced motion

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## Implementation Notes

### File structure
```
core/assets/
  styles.css        ← global tokens, reset, base, shared components
  popup.css         ← popup-specific overrides (minimal)
  (all other views use styles.css + inline <style> for view-specific rules)
```

### CSS variable naming convention
- All tokens prefixed `--color-`, `--space-`, `--text-`, `--radius-`, `--shadow-`, `--transition-`
- No raw hex values in component CSS — always use tokens
- Dark mode handled exclusively in `@media (prefers-color-scheme: dark)` in `styles.css`

### Provider-conditional fields
Use `data-providers="gemini openai"` attribute on each field group. JS reads the active provider and toggles `hidden` attribute. CSS: `[hidden] { display: none !important; }`.

### Copy button feedback pattern
```javascript
// On copy success:
btn.querySelector('svg').replaceWith(checkIcon);
btn.setAttribute('aria-label', 'Copied!');
setTimeout(() => {
  btn.querySelector('svg').replaceWith(copyIcon);
  btn.setAttribute('aria-label', 'Copy to clipboard');
}, 1500);
```

### Streaming state management
Add `.is-streaming` class to `<body>` during active streaming. CSS targets `.is-streaming .streaming-status` to show the indicator and `.is-streaming #summary` to apply a subtle right-edge fade. Remove class on stream end.
