# Eval System Plan

## Evaluation of the Proposed Approach

### What works well
- URL-based input is a major improvement over pre-copied text — it's reproducible and mirrors real user sessions
- Playwright + content extraction = same pipeline the plugin uses, so eval quality matches production
- Separating fetch / generate / score as distinct stages allows re-running individual stages without redoing everything
- Agentic prompt optimizer is a well-motivated idea for a single-developer project with limited labeled data

### Issues and improvements

| Issue | Problem | Fix |
|---|---|---|
| CSV for intermediate data | Extracted content and summaries can be multi-KB with quotes, commas, newlines — CSV breaks or requires heavy quoting | Use JSONL for pipeline data; CSV only for input config and final report |
| `extractPageData` in Node.js | Deeply DOM-coupled (`document`, `window`, `getBoundingClientRect`, shadow DOM) — cannot import in Node.js | Run it inside `page.evaluate()` in Playwright's browser context where those APIs exist |
| No key_facts in URL-only input | Accuracy and coverage rubric scores are meaningless without ground-truth key facts | Add `draft-facts` stage: LLM generates candidate key_facts from extracted content; user reviews and marks `facts_reviewed=true` before scoring runs |
| Vague agentic loop | "Optimize based on results" doesn't specify what to change or by how much | Target the *weakest dimension* specifically, generate 3 focused mutations, test on a subset, pick winner by score delta |
| No resumability | If run fails at URL 15 of 20, everything re-runs | JSONL append pattern: each stage checks if a row already has its output and skips it |
| No prompt versioning | Can't compare runs after optimizer changes the prompt | Store prompt snapshots as `prompts/v{N}.txt`; each row in data.jsonl records `prompt_version` |
| Single judge = same provider bias | Judge and generator using same model introduces correlated errors | Support separate `JUDGE_PROVIDER`/`JUDGE_API_KEY`/`JUDGE_MODEL` env vars; use a strong model (gpt-4o, claude) as judge regardless of generator |

---

## Final System Design

### Directory structure

```
evals/
  package.json           own package — Playwright and future deps live here, not in plugin root
  .gitignore             ignores node_modules/, runs/
  plan.md                this file
  input.csv              source of truth: one row per URL to evaluate
  prompts/
    v1.txt               current plugin system prompt (snapshot)
    v2.txt               ...after first optimizer run
  runs/
    {timestamp}/
      data.jsonl         pipeline output — one JSON object per row, written incrementally
      report.csv         aggregated scores per row (human-readable, shareable)
      summary.txt        CLI output captured to file
```

### `input.csv` schema

```
url, source_type, key_facts, facts_reviewed
```

| Column | Description |
|---|---|
| `url` | Page URL to fetch and summarize |
| `source_type` | Label for reporting: `article`, `review`, `homepage`, `docs`, `news-listing`, etc. |
| `key_facts` | Newline-separated ground-truth facts a good summary must cover. Empty until `draft-facts` fills it in. |
| `facts_reviewed` | `true` once you've reviewed and approved `key_facts`. Rows where this is not `true` are skipped in `score` stage. |

### `data.jsonl` schema (one JSON object per line, one line per URL)

```jsonc
{
  "url": "https://...",
  "source_type": "article",
  "key_facts": "- Fact 1\n- Fact 2",
  "content": "TITLE:\n...\n\nCONTENT:\n...",   // written by fetch stage
  "summary": "- Point 1\n- Point 2",             // written by generate stage
  "prompt_version": "v1",                         // written by generate stage
  "scores": {                                      // written by score stage
    "accuracy": 3,
    "coverage": 2,
    "conciseness": 2,
    "format": 2,
    "total": 9,
    "notes": "..."
  }
}
```

---

## Pipeline Stages

### CLI interface

```bash
# Run from evals/ directory
node eval_runner.js --stage <stage> [options]

# Or from repo root via npm
npm run eval -- --stage fetch
```

| Stage | Description |
|---|---|
| `draft-facts` | For each URL without `facts_reviewed=true` in input.csv, fetches content, asks LLM to generate candidate key_facts, writes them back to input.csv. You review and set `facts_reviewed=true`. |
| `fetch` | Playwright headless browser loads each URL, runs `extractPageData()` inside `page.evaluate()`, writes content to data.jsonl |
| `generate` | Reads content from data.jsonl, calls apiClient with current prompt version, writes summary to data.jsonl |
| `score` | For rows with a summary and `facts_reviewed=true`, calls judge LLM with rubric prompt, writes scores to data.jsonl |
| `report` | Aggregates data.jsonl, prints per-dimension breakdown to CLI, writes report.csv |
| `all` | Runs fetch → generate → score → report in sequence |
| `--optimize` | Agentic optimizer — see below |

### Resumability

Every stage reads data.jsonl first. If a row already has the output for that stage (e.g., `content` for fetch, `summary` for generate), it is skipped. This means you can re-run any stage after a partial failure without re-doing completed rows.

### Stage: `fetch`

1. Install Playwright Chromium: `npm install playwright` (in `evals/`)
2. Load `input.csv` and the existing `data.jsonl` for this run (or start a new run dir)
3. For each URL not yet fetched: launch headless Chromium, navigate, wait for networkidle
4. Inject and call `extractPageData()` via `page.evaluate()` — this runs inside the browser context where `document`/`window` exist
5. Append result to `data.jsonl`

**Note**: `extractPageData` function body is copied/inlined into the `page.evaluate()` call, not imported. This is Playwright's model for injecting code.

### Stage: `generate`

1. Reads current prompt from `prompts/v{latest}.txt`
2. Builds the full prompt: `{system_prompt}\n\n{content}`
3. Calls `fetchSummary(prompt, settings)` from `../core/utils/apiClient.js`
4. Writes `summary` and `prompt_version` fields to the row in data.jsonl

### Stage: `score`

1. Skips rows where `facts_reviewed !== true`
2. Uses separate judge settings (`JUDGE_PROVIDER`, `JUDGE_API_KEY`, `JUDGE_MODEL`) — defaults to generator settings if not set
3. Posts judge prompt with `key_facts` + `summary`
4. Writes `scores` object to the row in data.jsonl

### Scoring rubric

```
accuracy  (0–3): Factual correctness vs key_facts. 0=hallucinations, 3=fully accurate
coverage  (0–3): Key facts present in summary. 0=most missing, 3=all covered
conciseness (0–2): Appropriate length. 0=bloated, 2=tight
format    (0–2): Bullet-only, no headings, no preamble, no nested bullets, no closing remarks
────────────────
Total:   max 10
```

### Stage: `report`

Prints per-dimension averages broken down by `source_type` and `prompt_version`. Writes `report.csv`.

```
============================================================
REPORT  run: 2026-03-07T14:00:00  prompt: v1  rows: 12
============================================================
  Dim           Avg    Min    Max
  accuracy      2.6    1.5    3.0
  coverage      2.4    1.5    3.0
  conciseness   1.7    1.0    2.0
  format        1.9    1.5    2.0
  TOTAL         8.6    6.5    10.0
------------------------------------------------------------
  By source_type:
  article       9.1   (n=4)
  homepage      6.8   (n=3)
  news-listing  8.9   (n=3)
  docs          8.2   (n=2)
```

---

## Agentic Optimizer

### When to use

Run after a score + report cycle when you want to improve the prompt. The optimizer targets the weakest dimension and proposes focused mutations rather than rewriting the whole prompt.

### CLI

```bash
node eval_runner.js --optimize [--iters 3] [--run runs/2026-03-07T14:00:00]
```

### Loop (per iteration)

```
1. Load data.jsonl from the latest scored run
2. Compute per-dimension averages → identify weakest dimension (lowest avg / max)
3. Collect the 3 lowest-scoring rows for that dimension as examples
4. POST to judge LLM:
     "Current prompt: {prompt}
      Weakest dimension: {dim} (avg {score}/{max})
      Low-scoring examples: {examples with summaries and scores}
      Propose 3 targeted edits to the system prompt to improve {dim}.
      Return JSON: [{change: "...", reason: "...", new_prompt: "..."}]"
5. For each of the 3 mutations:
   a. Run generate stage on all rows using the mutated prompt
   b. Run score stage
   c. Record avg total score
6. Select mutation with highest avg score (must beat current by >0.2 to be accepted)
7. If accepted:
   a. Save as prompts/v{N+1}.txt
   b. Print diff of changes to CLI
   c. Ask: "Accept this prompt and run another iteration? [y/n]"
8. If rejected (no mutation beats current): report and exit
```

### Design principles

- **Target one dimension at a time** — scattershot prompt changes create confounding. If format is the weakest, only fix format.
- **Score delta threshold** — require improvement > 0.2 points to avoid noise-driven changes
- **Full run on accepted prompts** — after optimizer picks a winner, run a full `all` stage with the new prompt to get a clean baseline for the next iteration
- **Human in the loop** — optimizer always pauses before saving `v{N+1}.txt`. You review the diff and decide.
- **Prompt versioning** — every row in data.jsonl records `prompt_version`. You can always compare run A (v1) vs run B (v2) side by side.

---

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `PROVIDER` | `openai` | Provider for summary generation: `openai`, `azure`, `gemini`, `ollama` |
| `API_KEY` | — | API key for generator |
| `MODEL` | provider default | Model for generation |
| `BASE_URL` | — | Azure / Ollama base URL |
| `DEPLOYMENT` | — | Azure deployment name |
| `API_VERSION` | — | Azure API version |
| `JUDGE_PROVIDER` | = `PROVIDER` | Override provider for the judge |
| `JUDGE_API_KEY` | = `API_KEY` | Override API key for the judge |
| `JUDGE_MODEL` | = `MODEL` | Override model for the judge |

Recommended: use a strong judge (gpt-4o, claude-opus-4-6) even when testing a cheaper generator.

---

## Implementation phases

### Phase 0 — Structure (now)
- [x] `evals/package.json` (own package, own scripts)
- [x] `evals/.gitignore`
- [x] `evals/plan.md` (this file)
- [ ] `evals/prompts/v1.txt` — snapshot current plugin system prompt
- [ ] `evals/input.csv` — seed with URLs from existing `eval_set.csv`

### Phase 1 — Pipeline stages
- [ ] `fetch` stage: Playwright + `page.evaluate(extractPageData)`
- [ ] `generate` stage: apiClient + prompt version tracking
- [ ] `score` stage: judge LLM + separate judge settings
- [ ] `report` stage: aggregated output + `report.csv`
- [ ] `all` shortcut

### Phase 2 — draft-facts + migration
- [ ] `draft-facts` stage: auto-generate key_facts from content for user review
- [ ] Migrate `eval_set.csv` data into `input.csv` (existing rows become seed data)
- [ ] Resumability: skip already-completed rows in each stage

### Phase 3 — Agentic optimizer
- [ ] `--optimize` flag with dimension-targeted mutation loop
- [ ] Prompt diff display + user confirmation
- [ ] `--iters N` for multi-iteration runs

---

## Open questions

1. **Playwright version**: Use `playwright` (full) or `playwright-chromium` (smaller install)?  Recommend `@playwright/test` only if you want test runner integration, otherwise plain `playwright`.

2. **Run directory naming**: `runs/{ISO-timestamp}` is clear but long. Alternative: `runs/{N}` with a `runs/latest` symlink.

3. **input.csv multi-line key_facts**: Key_facts are newline-separated inside a quoted CSV field (same as `eval_set.csv`). The custom CSV parser already handles this.

4. **Judge for `draft-facts`**: Use the same judge settings, or allow `DRAFT_MODEL` override? Leaning toward same judge for simplicity.

5. **eval_runner.py**: Dead code — delete once Phase 1 is working and confirmed.
