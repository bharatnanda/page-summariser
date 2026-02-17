# **Changelog 1.1.1**

- Added KaTeX rendering on results page with LaTeX preservation for inline and display math.
- History now stores full summaries separately with IDs, enabling full-text viewing and cleanup on delete/clear.
- Content previews and history trimming now protect LaTeX math.
- Increased history summary limit and improved duplicate detection with summary hashing.
- Updated prompts to preserve LaTeX in model outputs.
- Updated README with math support and history enhancements.

# **Changelog 1.1.0**

- Added streaming summaries for OpenAI, Azure, Gemini, and Ollama with shared stream parsing helpers.  
- Results page shows page title, source URL, and summary word count; summaries open via stored IDs.  
- Provider settings are stored per‑provider for smoother switching.  
- Prompt building clamps content size per provider.  
- Unified blacklist merging and safer markdown rendering.  
- Removed temperature controls; providers use their defaults.  
- Added a cross‑browser platform wrapper to normalize storage, tabs, runtime, scripting, alarms, and notifications APIs.  
- Unified summarization flow into a SummarySession (cache, blacklist, provider call, history save, results opening).  
- Added cache key scoping by provider, model, and language to avoid mismatched summaries.  
- Added build tooling and scripts for multi‑platform targets (`build:*`, `clean`).  
- Firefox manifest now uses `background.scripts` for MV3 compatibility.  
- Results page no longer shows a Save button (summaries are auto‑saved).  
- Content extraction now uses body text with safe fallbacks (selection still takes priority).  
- Prompt guidelines updated with adaptive length targeting and a 250‑word cap.  
- Toast‑based error handling and notifications added for consistent UX.  
- Updated README with multi‑platform build and install instructions.
- Reorganized settings UI and separated advanced settings for clarity.
- Added heuristic-based content extraction to better capture main page content.
- Added default model presets per provider and introduced compact/default prompt profiles.
- Updated the evaluation dataset (eval_set.csv).
