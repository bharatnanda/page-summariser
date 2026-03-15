## [1.2.0]

* Added full streaming support for Claude models (Haiku, Sonnet, and Opus) using the Messages API
* Re-written the Azure provider to support any model (OpenAI, Claude, etc.)
* New built-in Text-to-Speech player with speed controls and a "stream-along" mode that reads sentences as they generate
* Introduced auto light/dark mode and a new card-based History page with live search and smoother animations
* Fixed storage realted bugs
---

## [1.1.1]

- Fix model name not saved in history for Azure (stale deployment field reference)
- Auto-detect Azure endpoint type from base URL to resolve "Resource not found" 404s
- Auto-migrate legacy Azure OpenAI API versions to `2024-05-01-preview` on startup
- Validate model name is set for multi-model Azure endpoints before making requests
- Fix in-page toast crash when results page (`chrome-extension://`) is active tab
- Pre-fill Azure API version default to `2024-05-01-preview` for new users
- **Math Rendering**: Renders LaTeX formulas in summaries using KaTeX — supports inline (`$...$`, `\(...\)`) and block (`$$...$$`, `\[...\]`) expressions
- Bug fixes for formula rendering edge cases and improved LaTeX prompt handling

---

## [1.1.0]

- Added streaming summaries for OpenAI, Azure, Gemini, and Ollama with shared stream parsing helpers
- Results page shows page title, source URL, and summary word count; summaries open via stored IDs
- Provider settings are stored per-provider for smoother switching
- Prompt building clamps content size per provider
- Unified blacklist merging and safer markdown rendering
- Removed temperature controls; providers use their defaults
- Added a cross-browser platform wrapper to normalize storage, tabs, runtime, scripting, alarms, and notifications APIs
- Unified summarization flow into a SummarySession (cache, blacklist, provider call, history save, results opening)
- Added cache key scoping by provider, model, and language to avoid mismatched summaries
- Added build tooling and scripts for multi-platform targets (`build:*`, `clean`)
- Firefox manifest now uses `background.scripts` for MV3 compatibility
- Results page no longer shows a Save button (summaries are auto-saved)
- Content extraction now uses body text with safe fallbacks (selection still takes priority)
- Prompt guidelines updated with adaptive length targeting and a 250-word cap
- Toast-based error handling and notifications added for consistent UX
- Updated README with multi-platform build and install instructions
- Reorganized settings UI and separated advanced settings for clarity
- Added heuristic-based content extraction to better capture main page content
- Added default model presets per provider and introduced compact/default prompt profiles

---

## [1.0.0]

- Initial release
- OpenAI, Google Gemini, and Ollama provider support
- Streaming summaries via SSE
- Summary history with 50-item limit
- 30-minute summary cache
- Domain blacklisting with default list
- Multi-language support (12 languages)
- Chrome, Firefox, and Safari builds
- Math rendering via KaTeX
- Context menu integration
