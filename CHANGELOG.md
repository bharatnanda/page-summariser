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
