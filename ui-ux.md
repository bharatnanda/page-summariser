# Page Summarizer Extension — UI/UX Specification

## Design System

### Color Palette (CSS Custom Properties)

| Token | Value | Usage |
|---|---|---|
| `--primary` | `#0b57d0` | Headings, links, primary buttons, accents |
| `--primary-dark` | `#0a4ab5` | Button hover state |
| `--primary-light` | `#e8f0fe` | Light accent backgrounds |
| `--secondary` | `#5f6368` | Secondary text, muted labels, date cells |
| `--light-bg` | `#f8f9fa` | Hover backgrounds for secondary buttons |
| `--dark-text` | `#1f2937` | Primary body text |
| `--light-text` | `#6b7280` | Preview text, footer text, helper text |
| `--muted-text` | (inherited) | Section labels, summary details |
| `--border` | `#dadce0` | All borders |
| `--success` | `#188038` | Success notification background, status text |
| `--warning` | `#b86e00` | Warning states |
| `--danger` | `#c5221f` | Error notifications, delete button color |
| `--surface` | `#ffffff` | Card/container backgrounds |
| `--surface-subtle` | `#f1f3f4` | Inner content block backgrounds (summary body) |
| `--app-bg` | `#f3f4f6` | Page background |
| `--table-header-bg` | `#f1f3f4` | Table `<thead>` background |
| `--card-shadow` | `0 1px 2px rgba(0,0,0,0.04), 0 2px 6px rgba(0,0,0,0.08)` | Default card elevation |
| `--hover-shadow` | `0 2px 8px rgba(0,0,0,0.12)` | Hover / notification shadow |
| `--card-gradient` | `linear-gradient(to right, #f8f9fb, #f1f3f4)` | Stats section background |
| `--focus-ring` | `0 0 0 3px rgba(11, 87, 208, 0.25)` | Keyboard focus ring |

### Typography

- **Font stack:** `"Segoe UI", "Roboto", "Noto Sans", "Helvetica Neue", Arial, sans-serif`
- **Base line-height:** `1.6`
- **Code font:** `'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace`
- **Base color:** `--dark-text` (`#1f2937`)

### Spacing & Shape

- Border radius: `8px` (inputs, buttons), `10px` (cards/containers), `12px` (`.card` utility), `50%` (icon buttons)
- Global `box-sizing: border-box`, zero margin/padding reset on `*`
- Responsive breakpoint: `768px` (mobile vs desktop layout)

---

## Component Library

### Buttons

All buttons share base class `.btn`:
- `padding: 10px 18px`, `border-radius: 8px`, `font-weight: 600`
- `display: inline-flex`, `align-items: center`, `gap: 8px`
- `font-size: 0.95rem`, `transition: background-color 0.2s, box-shadow 0.2s, border-color 0.2s`

| Variant | Class | Background | Text | Border |
|---|---|---|---|---|
| Primary | `.btn-primary` | `--primary` | white | none |
| Secondary | `.btn-secondary` | `--surface` | `--dark-text` | `1px solid --border` |
| Success | `.btn-success` | `--success` | white | none |
| Danger | `.btn-danger` | `--danger` | white | none |
| Icon | `.btn-icon` | (inherits) | (inherits) | none; `border-radius: 50%`, `40×40px` |
| Ghost | `.ghost-btn` | `transparent` | `--primary` | `1px solid --border` |

Hover states darken by one shade (e.g. primary → `--primary-dark`, success → `#43a047`, danger → `#d32f2f`). Ghost hover: `rgba(0,0,0,0.03)` background.

Disabled state (popup primary btn): `background: #9ab6e5`, `cursor: not-allowed`.

Focus (keyboard): `outline: none` + `box-shadow: --focus-ring` on all interactive elements.

### Notifications

- **Position:** Fixed, `top: 20px`, `right: 20px`
- **Style:** `padding: 15px 20px`, `border-radius: 6px`, white text, `font-weight: 500`, `box-shadow: --hover-shadow`, `z-index: 1000`
- **Animation:** Starts off-screen (`transform: translateX(200%)`), slides in to `translateX(0)` on `.show` class addition; `transition: transform 0.3s ease`
- **Types:** `.success` → green (`--success`), `.error` → red (`--danger`)
- Element is present in all four views as `<div id="notification" class="notification">`

### Form Inputs

Applies to `input`, `select`, `textarea` in options:
- `width: 100%`, `padding: 10px`, `border: 1px solid --border`, `border-radius: 8px`
- `font-size: 14px`, `background: --surface`, `color: --dark-text`
- `transition: border 0.3s, box-shadow 0.3s`
- Focus: `border-color: --primary`, `box-shadow: --focus-ring`, `outline: none`

Textarea specific: `resize: vertical` only, `min-height: 120px`.

### Collapsible Section (`<details>`/`<summary>`)

- Container: `border: 1px solid --border`, `border-radius: 10px`, `padding: 10px 12px`, `background: --surface`
- Summary: `font-weight: 600`, `color: --dark-text`, `cursor: pointer`, no default marker
- Custom arrow via `summary::after { content: "▾" }`, `float: right`, `color: --muted-text`
- Open state rotates arrow: `details[open] summary::after { transform: rotate(180deg) }`, `transition: 0.2s ease`

---

## Views

---

### 1. Popup (`popup.html`)

**Role:** Extension entry point, launched from browser toolbar click.

**Dimensions:** Fixed `360×380px`

**Layout:** Centered flex column, `background: --app-bg`

**Structure:**

```
┌─────────────────────────────┐  360px wide
│  📄 Page Summarizer          │  h3, color: --primary, 1.5rem, font-weight: 700
│                              │  letter-spacing: 0.03em, margin-bottom: 20px
│  [  Summarize This Page  ]   │  .btn (primary), 12px 16px padding, full-width
│  [  📚 View History      ]   │  .btn .btn-secondary, full-width
│  [  ⚙ Settings          ]   │  .btn .btn-secondary, full-width
│                              │
│  ┌──────────────────────┐    │  .stats — pushed to bottom via margin-top: auto
│  │   42                 │    │  background: --card-gradient, border-radius: 10px
│  │  Pages summarized    │    │  padding: 16px 20px, text-align: center
│  └──────────────────────┘    │
└─────────────────────────────┘  380px tall
```

**Stats section details:**
- `.number`: `font-size: 2.4rem`, `color: --primary`, `font-weight: 700`, `line-height: 1`, `margin-bottom: 6px`
- `.label`: `font-size: 1rem`, `letter-spacing: 0.05em`, `color: --secondary`
- Has `aria-live="polite"` and `aria-atomic="true"` for screen readers

**Loading state (Summarize button):**
- Shows spinner inside button via `.loading` + `.spinner`
- Spinner: `20×20px` circle, `border: 3px solid rgba(255,255,255,0.3)`, top border white, `animation: spin 1s ease-in-out infinite`
- Button becomes `disabled` (blue-grey background, not-allowed cursor)

**Accessibility:** Container has `role="main"` and `aria-label="Page Summarizer"`. Each button has `aria-label`.

---

### 2. History (`history.html`)

**Role:** Full-page view showing all previously generated summaries in a table.

**Layout:** Full-page, `background: --app-bg`, `padding: 20px`, container `max-width: 1200px`

**Structure:**

```
┌────────────────────────────────────────────────────┐
│  📜 Summary History          [ 🗑️ Clear History ]   │  header
├────────────────────────────────────────────────────┤
│  URL  │  Preview  │  Date  │  Actions               │  table header
│───────────────────────────────────────────────────│
│  ...  │  ...      │  ...   │  🗑                    │  rows (clickable)
│  ...  │  ...      │  ...   │  🗑                    │
└────────────────────────────────────────────────────┘
                  Page Summarizer Extension • History…   footer
```

**Header:**
- `background: --surface`, `padding: 25px 30px`, `border-radius: 10px`
- `box-shadow: --card-shadow`, `border: 1px solid --border`, `margin-bottom: 30px`
- `display: flex`, `justify-content: space-between`, `align-items: center`, `flex-wrap: wrap`
- `h1`: `1.8rem`, `font-weight: 600`, `color: --primary`

**Controls area:**
- `display: flex`, `gap: 15px`, `margin-top: 15px`, `width: 100%`
- On `≥768px`: `width: auto`, `margin-top: 0` (inline with title)

**Table:**
- Container: `background: --surface`, `border-radius: 10px`, `box-shadow: --card-shadow`, `overflow: hidden`, `border: 1px solid --border`
- `border-collapse: collapse`, `font-size: 0.95rem`, full-width
- `th`: `background: --table-header-bg`, `padding: 15px 20px`, `font-weight: 600`, `color: --dark-text`, `border-bottom: 1px solid --border`
- `td`: `padding: 15px 20px`, `border-bottom: 1px solid --border`; last row has no bottom border
- Row hover: `background-color: --light-bg`, `transition: 0.2s`; `cursor: pointer` (entire row is clickable, opens results)

**Column cell styles:**

| Column | Class | Style |
|---|---|---|
| URL (title) | `.title-cell` | `font-weight: 600`, `color: --primary`, `max-width: 300px`, ellipsis truncation |
| URL (source) | `.url-cell` | `color: --secondary`, `0.9rem`, `max-width: 200px`, ellipsis |
| Source URL sub-line | `.source-url` | `color: --secondary`, `0.85rem`, ellipsis |
| Provider/model | `.provider-model` | `color: --light-text`, `0.8rem`, ellipsis |
| Preview text | `.preview-cell` | `color: --light-text`, `0.9rem`, `max-width: 300px`, ellipsis |
| Date | `.date-cell` | `color: --secondary`, `0.9rem`, `white-space: nowrap` |
| Delete | `.delete-cell` | `text-align: center`, `width: 80px` |

**Delete button (`.delete-btn`):**
- No background/border, `color: --danger`, `font-size: 1.2rem`, `padding: 5px`, `border-radius: 4px`
- Hover: `background-color: rgba(244, 67, 54, 0.1)`

**Empty state (`.empty-state`):**
- `text-align: center`, `padding: 60px 20px`, `background: --surface`, `border-radius: 10px`, `border: 1px solid --border`
- `h2`: `color: --secondary`, max-width body paragraph: `500px`

**Footer:** `text-align: center`, `padding: 30px 0`, `color: --light-text`, `0.9rem`, `margin-top: 30px`

**Mobile (`<768px`):** Header padding → `20px`, h1 → `1.5rem`, cell padding → `10px 15px`, title max-width → `150px`, url max-width → `120px`, preview max-width → `150px`

---

### 3. Settings (`options.html`)

**Role:** Configuration page for AI provider, model, language, and advanced options.

**Layout:** Centered page, `background: --app-bg`, `padding: 40px`

**Container:** `width: 460px`, `max-width: 94vw`, `background: --surface`, `padding: 30px 25px`, `border-radius: 10px`, `box-shadow: --card-shadow`, `border: 1px solid --border`

**Section headings (`h3`):** `font-size: 14px`, `text-transform: uppercase`, `letter-spacing: 0.04em`, `color: --muted-text`, `margin: 24px 0 8px`

**Page title (`h2`):** Centered, `color: --primary`, `margin-bottom: 20px`

**Form structure (top to bottom):**

1. **Provider section** (`h3` label)
   - `Provider:` → `<select>` with options: Gemini, OpenAI, Azure OpenAI, Ollama
   - `API Key:` → `<input type="password">` placeholder "Enter API key"

2. **Model section** (`h3` label)
   - `Model Preset:` → `<select id="modelPreset">` — shown for `openai`, `gemini` only (`.provider-specific[data-show-for]`)
   - Help text: "Choose a preset or pick Custom to enter a model."
   - `Deployment Preset:` → `<select>` — shown for `azure` only
   - Help text: "Optional preset for your Azure deployment name."
   - `Model:` → `<input type="text">` — shown for `openai`, `gemini`, `ollama`; with hidden preset hint div
   - `Base URL:` → `<input type="text">` — shown for `azure`, `ollama`
   - `Deployment Name:` → `<input type="text">` — shown for `azure` only; with hidden preset hint div
   - `API Version:` → `<input type="text">` — shown for `azure` only

3. **Summary Output section** (`h3` label)
   - `Summary Language:` → `<select>` with 12 flag-emoji options (English, Mandarin, Hindi, Spanish, French, Arabic, Russian, Portuguese, Bengali, Japanese, German, Swedish)
   - `Prompt Style:` → `<select>` with "Default (Detailed)" and "Compact (Small Models)"
   - Help text: "Use Compact for smaller or cheaper models that struggle with complex rules."

4. **Advanced settings** (`<details>` collapsible)
   - Toggle: "Sync API keys across devices" (checkbox inline) — help text about security
   - **Extraction subsection:** `<select>` for Smart Extraction (Beta) vs Basic innerText
   - **Content Access subsection:**
     - `Blocked Sites:` → `<input>` for semicolon-separated URL patterns
     - "Include recommended defaults" (checkbox inline)
     - "Show defaults" ghost button → reveals hidden `<textarea>` (readonly, 8 rows)

5. **Button group** (`.button-group`):
   - `display: flex`, `gap: 10px`
   - `[Save Settings]` (primary) + `[Reset]` (primary) — each `flex: 1`

6. **Status/notification area:** `<div id="notification">` at bottom

**Help text (`.help`):** `font-size: 12px`, `color: --muted-text`, `margin: 6px 0 0`

**Inline toggle (`.inline-toggle`):** `display: flex`, `align-items: center`, `gap: 8px`, `margin-top: 12px`; checkbox `width: auto`, `margin-top: 0`

**Preset hint (`.preset-hint`):** `font-size: 12px`, `color: --muted-text`, `margin-top: 4px`; hidden by default, shown when a preset is selected

**Section divider (`.section-divider`):** `height: 1px`, `background: --border`, `margin: 18px 0 6px`

---

### 4. Results (`results.html`)

**Role:** Full-page view displaying the AI-generated summary with metadata and export actions. Also renders while streaming.

**Layout:** `background: --app-bg`, `padding: 20px`, `color: --dark-text`, `line-height: 1.6`

**Container:** `max-width: 900px`, centered, `background: --surface`, `border-radius: 10px`, `box-shadow: --card-shadow`, `overflow: hidden`

**Header:**
- `background: --surface`, `padding: 25px 30px`
- `display: flex`, `justify-content: space-between`, `align-items: center`, `flex-wrap: wrap`
- `border-bottom: 1px solid --border`
- Left: `h1` "📄 Page Summary" — `1.8rem`, `font-weight: 600`, `color: --primary`
- Right: `.action-buttons` — `display: flex`, `gap: 12px`, `flex-wrap: wrap`
  - `[Copy]` — `.btn .btn-primary` with clipboard SVG icon
  - `[Download]` — `.btn .btn-primary` with download SVG icon
  - `[History]` — `.btn .btn-primary` with clock/history SVG icon

**Content area (`.content`):** `padding: 30px`

**Article metadata block (`#articleMeta`, `.article-meta`):**
- `display: flex`, `flex-direction: column`, `gap: 6px`, `margin-bottom: 16px`
- `padding: 14px 16px`, `border-radius: 10px`, `border: 1px solid --border`, `background: --surface`
- Hidden by default (`hidden` attribute), shown once data loads
- `.article-title`: `font-weight: 600`, `color: --dark-text`, `1.05rem`
- `.article-source` (link): `color: --primary`, `text-decoration: none`, `word-break: break-all`; hover → underline
- `.article-provider`: `color: --light-text`, `0.85rem`; hidden by default
- `.summary-metrics`: `color: --light-text`, `0.85rem` — shows word count

**Summary body (`#summary`):**
- `background: --surface-subtle` (`#f1f3f4`), `padding: 25px`, `border-radius: 10px`, `line-height: 1.7`, `font-size: 1.05rem`
- Default content: `<p>Loading summary...</p>`
- Supports full Markdown rendering (via `markdown.js`) and KaTeX math (via bundled KaTeX)

**Markdown rendering styles inside `#summary`:**

| Element | Style |
|---|---|
| `h1` | `1.8rem`, `color: --primary`, `font-weight: 600`, `margin-top: 1.5em` |
| `h2` | `1.5rem`, same |
| `h3` | `1.3rem`, same |
| `p` | `margin: 1em 0` |
| `ul`, `ol` | `margin: 1em 0 1em 1.5em`, `padding-left: 1.2em` |
| `li` | `margin-bottom: 0.5em` |
| `strong` | `font-weight: 600`, `color: --dark-text` |
| `em` | `color: --secondary` |
| `code` (inline) | `background: #e8eaed`, `padding: 2px 6px`, `border-radius: 4px`, monospace `0.9em` |
| `pre` (code block) | Dark theme: `background: #1f2937`, `color: #f8f9fa`, `padding: 16px`, `border-radius: 6px`, `overflow-x: auto` |
| `blockquote` | `border-left: 4px solid --primary`, `padding: 10px 20px`, `background: rgba(11,87,208,0.08)` |
| `table th` | `background: --table-header-bg`, `font-weight: 600` |
| `table td/th` | `padding: 12px 15px`, `border-bottom: 1px solid --border` |
| `a` | `color: --primary`, no underline; hover → underline |

**Streaming indicator (`.streaming-indicator`):**
- `display: inline-flex`, `align-items: center`, `gap: 6px`, `font-weight: 600`, `color: --secondary`
- Animated trailing dots via `::after` pseudo-element cycling through `···`, `··`, `·` at 1.2s interval using `@keyframes dots` + `steps(1, end)` timing

**Footer:** `text-align: center`, `padding: 20px`, `color: --light-text`, `0.9rem`, `border-top: 1px solid --border`

**Mobile (`<768px`):** Container border-radius → `8px`, header padding → `20px`, h1 → `1.5rem`, `.content` padding → `20px`, `#summary` padding → `20px`

---

## Navigation Flow

```
Browser Toolbar Click
        │
        ▼
   [Popup] ─────────────────────────────────────────────────┐
        │                                                    │
   "Summarize"                                         "View History"
        │                                                    │
        ▼                                                    ▼
  [Results page]  ──── "History" button ──────►  [History page]
                                                      │
                                        Row click → [Results page]
```

Settings page is opened via `⚙ Settings` button in Popup (opens as a new browser tab/options page).

---

## Shared Patterns

1. **Page background:** All views use `background: --app-bg` (`#f3f4f6`)
2. **Card surfaces:** All primary content areas use `background: --surface` (`#ffffff`) with `--card-shadow`
3. **Borders:** `1px solid --border` (`#dadce0`) on all cards and form elements
4. **Notification component:** Present in every view — same markup `<div id="notification" class="notification">`, same slide-in animation
5. **Primary color dominance:** Headings, links, active buttons, and stat numbers all use `--primary` (#0b57d0) — a Google-blue shade
6. **Emoji usage:** Used decoratively in headings (📄, 📜, ⚙) and navigation buttons (📚, 🗑️) to aid visual scanning
7. **SVG icons:** Used in results page action buttons (Copy, Download, History) — inline SVG, `16×16px`, `fill="currentColor"`
8. **Accessibility:** ARIA roles, labels, and live regions used in popup; focus-visible ring on all interactive elements
