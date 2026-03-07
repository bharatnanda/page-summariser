/**
 * page-summariser eval pipeline.
 *
 * Stages:
 *   --stage fetch        Playwright scrape + content extraction → data.jsonl
 *   --stage generate     apiClient + prompt template → summaries in data.jsonl
 *   --stage score        LLM judge + rubric → scores in data.jsonl
 *   --stage report       Aggregate data.jsonl → print + report.csv
 *   --stage all          Runs fetch → generate → score → report
 *   --stage draft-facts  (Phase 2) Generate key_facts for user review
 *   --optimize           (Phase 3) Agentic prompt optimizer
 *
 * Provider config (env vars):
 *   PROVIDER, API_KEY, MODEL, BASE_URL, DEPLOYMENT, API_VERSION
 *   JUDGE_PROVIDER, JUDGE_API_KEY, JUDGE_MODEL  (defaults to above if not set)
 *
 * Options:
 *   --run <name>     Use a specific run dir inside runs/ (default: latest)
 *   --profile <p>    Prompt profile: default | compact  (generate stage only)
 *
 * Usage examples:
 *   node eval_runner.js --stage fetch
 *   node eval_runner.js --stage generate
 *   node eval_runner.js --stage score
 *   node eval_runner.js --stage report
 *   node eval_runner.js --stage all
 *   node eval_runner.js --stage report --run 2026-03-07T14-00-00
 */

import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { fetchSummary } from '../core/utils/apiClient.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const RUNS_DIR    = join(__dirname, 'runs');
const PROMPTS_DIR = join(__dirname, 'prompts');
const INPUT_CSV   = join(__dirname, 'input.csv');

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------
function parseArgs() {
  const args = process.argv.slice(2);
  const result = { stage: 'score', runDir: null, profile: 'default' };
  for (let i = 0; i < args.length; i++) {
    if      (args[i] === '--stage')   result.stage   = args[++i];
    else if (args[i] === '--run')     result.runDir  = args[++i];
    else if (args[i] === '--profile') result.profile = args[++i];
  }
  return result;
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------
function buildSettings(prefix = '') {
  const env = (key) => process.env[`${prefix}${key}`] || process.env[key] || '';
  const provider = (env('PROVIDER') || 'openai').toLowerCase();
  const apiKey   = env('API_KEY');

  if (!apiKey && provider !== 'ollama') {
    const varName = prefix ? `${prefix}API_KEY or API_KEY` : 'API_KEY';
    throw new Error(
      `${varName} is required for provider "${provider}".\n` +
      `Usage: PROVIDER=${provider} API_KEY=<key> MODEL=<model> node eval_runner.js --stage <stage>`
    );
  }

  return {
    provider,
    apiKey,
    model:      env('MODEL'),
    baseUrl:    env('BASE_URL'),
    deployment: env('DEPLOYMENT'),
    apiVersion: env('API_VERSION'),
    language:   'english',
    promptProfile: 'default',
    disableStreamingOnSafari: false,
  };
}

// ---------------------------------------------------------------------------
// JSONL helpers
// ---------------------------------------------------------------------------
async function readJsonl(filePath) {
  try {
    const text = await readFile(filePath, 'utf8');
    return text.trim().split('\n').filter(Boolean).map(l => JSON.parse(l));
  } catch {
    return [];
  }
}

async function writeJsonl(filePath, rows) {
  await writeFile(filePath, rows.map(r => JSON.stringify(r)).join('\n') + '\n', 'utf8');
}

// ---------------------------------------------------------------------------
// CSV parser — handles quoted fields with embedded commas and newlines
// ---------------------------------------------------------------------------
function parseCSV(text) {
  const rows = [];
  let headers = null;
  let i = 0;
  const n = text.length;

  while (i < n) {
    const fields = [];

    while (true) {
      let field = '';

      if (i < n && text[i] === '"') {
        i++;
        while (i < n) {
          if (text[i] === '"') {
            if (i + 1 < n && text[i + 1] === '"') {
              field += '"';
              i += 2;
            } else {
              i++;
              break;
            }
          } else {
            field += text[i++];
          }
        }
      } else {
        while (i < n && text[i] !== ',' && text[i] !== '\r' && text[i] !== '\n') {
          field += text[i++];
        }
      }

      fields.push(field);

      if (i < n && text[i] === ',') {
        i++;
      } else {
        if (i < n && text[i] === '\r') i++;
        if (i < n && text[i] === '\n') i++;
        break;
      }
    }

    if (headers === null) {
      headers = fields;
    } else if (fields.some(f => f !== '')) {
      const obj = {};
      headers.forEach((h, idx) => { obj[h] = fields[idx] ?? ''; });
      rows.push(obj);
    }
  }

  return rows;
}

function csvEscape(value) {
  const s = String(value ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function csvLine(fields) {
  return fields.map(csvEscape).join(',');
}

// ---------------------------------------------------------------------------
// Run directory helpers
// ---------------------------------------------------------------------------
async function createRunDir() {
  const ts  = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const dir = join(RUNS_DIR, ts);
  await mkdir(dir, { recursive: true });
  return dir;
}

async function resolveRunDir(specifiedDir) {
  if (specifiedDir) {
    return specifiedDir.startsWith('/') ? specifiedDir : join(RUNS_DIR, specifiedDir);
  }
  let entries;
  try {
    entries = await readdir(RUNS_DIR, { withFileTypes: true });
  } catch {
    throw new Error('No runs found. Run --stage fetch first.');
  }
  const dirs = entries.filter(e => e.isDirectory()).map(e => e.name).sort().reverse();
  if (!dirs.length) throw new Error('No runs found. Run --stage fetch first.');
  return join(RUNS_DIR, dirs[0]);
}

// ---------------------------------------------------------------------------
// Prompt helpers
// ---------------------------------------------------------------------------
async function findLatestPromptVersion(profile) {
  try {
    const entries   = await readdir(PROMPTS_DIR);
    const isCompact = profile === 'compact';
    const versions  = entries
      .filter(f => isCompact ? /^v\d+-compact\.txt$/.test(f) : /^v\d+\.txt$/.test(f))
      .map(f => parseInt(f.replace(/^v/, '').replace(/-compact\.txt$|\.txt$/, ''), 10))
      .filter(n => !isNaN(n))
      .sort((a, b) => b - a);
    return versions[0] || 1;
  } catch {
    return 1;
  }
}

async function loadPromptTemplate(version, profile) {
  const suffix = profile === 'compact' ? '-compact.txt' : '.txt';
  return readFile(join(PROMPTS_DIR, `v${version}${suffix}`), 'utf8');
}

function applyPromptTemplate(template, content, language = 'english') {
  return template.replace('{content}', content).replace('{language}', language);
}

// ---------------------------------------------------------------------------
// Content extractor script builder
//
// Reads extractPageData from contentExtractor.js and wraps it for
// page.evaluate() — the function runs inside Playwright's browser context
// where document/window/Element/etc. are available.
//
// ES module import lines are stripped (not valid in browser IIFE context).
// The `export` keyword is stripped from function declarations.
// Functions that reference `platform` (getPageContent, getPageUrl) are
// present but never called, so no ReferenceError occurs.
// ---------------------------------------------------------------------------
async function buildExtractorScript() {
  const src = await readFile(join(__dirname, '../core/utils/contentExtractor.js'), 'utf8');
  const cleaned = src
    .replace(/^import .*\n/gm, '')
    .replace(/^export /gm, '');
  return `(function() {\n${cleaned}\nreturn extractPageData(true);\n})()`;
}

// ---------------------------------------------------------------------------
// Judge prompt + scoring
// ---------------------------------------------------------------------------
const JUDGE_PROMPT = `You are evaluating the quality of an AI-generated webpage summary.
You are given the ground-truth key facts a good summary must cover, and the actual summary to evaluate.

## Ground-truth key facts
{key_facts}

## Summary to evaluate
{summary}

## Scoring rubric

accuracy (0-3): Are all statements in the summary factually correct based on the key facts?
  0 = multiple clear factual errors or hallucinations
  1 = some incorrect or misleading statements
  2 = mostly correct with only minor inaccuracies
  3 = fully accurate, nothing contradicts the key facts

coverage (0-3): Does the summary include the important facts from the key facts list?
  0 = misses most key facts
  1 = covers only some key facts
  2 = covers most key facts with minor omissions
  3 = covers all key facts

conciseness (0-2): Is the summary appropriately brief without padding or over-explanation?
  0 = noticeably bloated or repetitive
  1 = slightly too long or includes minor filler
  2 = well-sized and to the point

format (0-2): Does the summary follow output rules — bullet-only ('-'), no headings, no preamble, no nested bullets, no closing remarks?
  0 = multiple format violations (e.g., headings + preamble + nested bullets)
  1 = one minor format violation
  2 = fully compliant

## Output
Respond with JSON only. No markdown, no code fences, no other text.
{
  "accuracy": <int 0-3>,
  "coverage": <int 0-3>,
  "conciseness": <int 0-2>,
  "format": <int 0-2>,
  "notes": "<one concise sentence explaining the main strength and weakness>"
}`;

const DIMS      = ['accuracy', 'coverage', 'conciseness', 'format'];
const DIM_MAX   = { accuracy: 3, coverage: 3, conciseness: 2, format: 2 };
const TOTAL_MAX = 10;

function extractJSON(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  const start = text.indexOf('{');
  const end   = text.lastIndexOf('}');
  if (start !== -1 && end > start) return text.slice(start, end + 1);
  return text.trim();
}

async function scoreWithJudge(keyFacts, summary, settings) {
  const prompt = JUDGE_PROMPT
    .replace('{key_facts}', keyFacts)
    .replace('{summary}',   summary);
  const raw  = await fetchSummary(prompt, settings);
  const json = extractJSON(raw);
  return JSON.parse(json);
}

// ---------------------------------------------------------------------------
// Stage: fetch
// ---------------------------------------------------------------------------
async function stageFetch() {
  let chromium;
  try {
    ({ chromium } = await import('playwright'));
  } catch {
    throw new Error(
      'Playwright not installed.\n' +
      'From the evals/ directory run: npm install && npx playwright install chromium'
    );
  }

  const inputText = await readFile(INPUT_CSV, 'utf8');
  const inputRows = parseCSV(inputText).filter(r => r.url && r.url.trim());
  if (!inputRows.length) throw new Error('input.csv has no URL rows. Add URLs first.');

  const runDir   = await createRunDir();
  const dataPath = join(runDir, 'data.jsonl');
  console.log(`Run:    ${runDir}`);
  console.log(`URLs:   ${inputRows.length}`);

  const existing     = await readJsonl(dataPath);
  const existingUrls = new Set(existing.map(r => r.url));
  const rows         = [...existing];

  const extractorScript = await buildExtractorScript();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    for (const input of inputRows) {
      const url = input.url.trim();
      if (existingUrls.has(url)) {
        console.log(`  [skip]  ${url}`);
        continue;
      }
      process.stdout.write(`  [fetch] ${url} ... `);
      try {
        await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
        const pageData = await page.evaluate(extractorScript);
        rows.push({
          url,
          source_type:    input.source_type   || '',
          key_facts:      input.key_facts      || '',
          facts_reviewed: input.facts_reviewed === 'true',
          page_title:     pageData?.title      || '',
          content:        pageData?.text       || '',
        });
        console.log(`ok (${(pageData?.text?.length || 0).toLocaleString()} chars)`);
      } catch (err) {
        rows.push({ url, source_type: input.source_type || '', fetch_error: err.message });
        console.log(`ERROR: ${err.message}`);
      }
      await writeJsonl(dataPath, rows); // write after each URL for resumability
    }
  } finally {
    await browser.close();
  }

  const fetched = rows.filter(r => r.content).length;
  const failed  = rows.filter(r => r.fetch_error).length;
  console.log(`\nFetch done: ${fetched} ok, ${failed} errors → ${dataPath}`);
  return runDir;
}

// ---------------------------------------------------------------------------
// Stage: generate
// ---------------------------------------------------------------------------
async function stageGenerate(args) {
  const settings = buildSettings();
  const runDir   = await resolveRunDir(args.runDir);
  const dataPath = join(runDir, 'data.jsonl');
  const rows     = await readJsonl(dataPath);
  if (!rows.length) throw new Error(`No data in ${dataPath}. Run --stage fetch first.`);

  const version       = await findLatestPromptVersion(args.profile);
  const template      = await loadPromptTemplate(version, args.profile);
  const promptVersion = `v${version}${args.profile === 'compact' ? '-compact' : ''}`;

  const pending = rows.filter(r => !r.fetch_error && r.content && !r.summary);
  console.log(`Run:    ${runDir}`);
  console.log(`Prompt: ${promptVersion}  |  provider: ${settings.provider} ${settings.model || '(default)'}`);
  console.log(`Rows:   ${pending.length} pending`);

  for (const row of rows) {
    if (row.fetch_error || !row.content || row.summary) continue;
    process.stdout.write(`  [gen]   ${row.url} ... `);
    try {
      const prompt       = applyPromptTemplate(template, row.content);
      row.summary        = await fetchSummary(prompt, settings);
      row.prompt_version = promptVersion;
      await writeJsonl(dataPath, rows);
      console.log(`ok (${row.summary.length} chars)`);
    } catch (err) {
      row.generate_error = err.message;
      await writeJsonl(dataPath, rows);
      console.log(`ERROR: ${err.message}`);
    }
  }

  const done   = rows.filter(r => r.summary).length;
  const errors = rows.filter(r => r.generate_error).length;
  console.log(`\nGenerate done: ${done} ok, ${errors} errors → ${dataPath}`);
}

// ---------------------------------------------------------------------------
// Stage: score
// ---------------------------------------------------------------------------
async function stageScore(args) {
  let judgeSettings;
  try {
    judgeSettings = buildSettings('JUDGE_');
  } catch {
    judgeSettings = buildSettings();
  }

  const runDir   = await resolveRunDir(args.runDir);
  const dataPath = join(runDir, 'data.jsonl');
  const rows     = await readJsonl(dataPath);

  const noFacts = rows.filter(r => r.summary && !r.facts_reviewed).length;
  console.log(`Run:    ${runDir}`);
  console.log(`Judge:  ${judgeSettings.provider} ${judgeSettings.model || '(default)'}`);
  if (noFacts) console.log(`Note:   ${noFacts} rows skipped — set facts_reviewed=true in input.csv to score them`);

  for (const row of rows) {
    if (!row.summary || !row.facts_reviewed || row.scores) continue;
    process.stdout.write(`  [score] ${row.url} ... `);
    try {
      row.scores  = await scoreWithJudge(row.key_facts, row.summary, judgeSettings);
      const total = DIMS.reduce((s, d) => s + (row.scores[d] || 0), 0);
      await writeJsonl(dataPath, rows);
      console.log(`ok (${total}/${TOTAL_MAX})`);
    } catch (err) {
      console.log(`ERROR: ${err.message}`);
    }
  }

  const done = rows.filter(r => r.scores).length;
  console.log(`\nScore done: ${done} rows scored → ${dataPath}`);
}

// ---------------------------------------------------------------------------
// Stage: report
// ---------------------------------------------------------------------------
const SEP  = '='.repeat(64);
const SEP2 = '-'.repeat(64);

function avg(arr) {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

async function stageReport(args) {
  const runDir   = await resolveRunDir(args.runDir);
  const dataPath = join(runDir, 'data.jsonl');
  const rows     = await readJsonl(dataPath);
  const scored   = rows.filter(r => r.scores);

  console.log(`\n${SEP}`);
  console.log(`REPORT  run: ${runDir.split('/').pop()}`);
  console.log(SEP);

  if (!scored.length) {
    console.log('No scored rows. Run --stage score first.');
    console.log('(Ensure facts_reviewed=true in input.csv for rows you want scored.)');
    return;
  }

  // Overall averages
  console.log(`\nRows scored: ${scored.length} / ${rows.length}`);
  console.log(`\n${'Dimension'.padEnd(14)} ${'Avg'.padStart(6)} ${'/ Max'.padStart(6)}`);
  console.log(SEP2);
  for (const dim of DIMS) {
    const vals = scored.map(r => r.scores[dim] || 0);
    console.log(`${dim.padEnd(14)} ${avg(vals).toFixed(2).padStart(6)}    / ${DIM_MAX[dim]}`);
  }
  const totals = scored.map(r => DIMS.reduce((s, d) => s + (r.scores[d] || 0), 0));
  console.log(SEP2);
  console.log(`${'TOTAL'.padEnd(14)} ${avg(totals).toFixed(2).padStart(6)}    / ${TOTAL_MAX}`);

  // Breakdown by source_type
  const byType = {};
  for (const row of scored) {
    const t = row.source_type || 'unknown';
    (byType[t] = byType[t] || []).push(DIMS.reduce((s, d) => s + (row.scores[d] || 0), 0));
  }
  if (Object.keys(byType).length > 1) {
    console.log(`\nBy source_type:`);
    for (const [type, scores] of Object.entries(byType)) {
      console.log(`  ${type.padEnd(22)} avg ${avg(scores).toFixed(2)}  (n=${scores.length})`);
    }
  }

  // Breakdown by prompt_version
  const byPrompt = {};
  for (const row of scored) {
    const v = row.prompt_version || 'unknown';
    (byPrompt[v] = byPrompt[v] || []).push(DIMS.reduce((s, d) => s + (row.scores[d] || 0), 0));
  }
  if (Object.keys(byPrompt).length > 1) {
    console.log(`\nBy prompt version:`);
    for (const [v, scores] of Object.entries(byPrompt)) {
      console.log(`  ${v.padEnd(22)} avg ${avg(scores).toFixed(2)}  (n=${scores.length})`);
    }
  }

  // Per-row detail
  console.log(`\n${SEP}`);
  console.log('Per-row detail:');
  console.log(SEP2);
  for (const row of scored) {
    const total      = DIMS.reduce((s, d) => s + (row.scores[d] || 0), 0);
    const scoreStr   = DIMS.map(d => row.scores[d]).join('/');
    const label      = (row.page_title || row.url).slice(0, 52);
    console.log(`  ${String(total).padStart(2)}/${TOTAL_MAX}  [${scoreStr}]  ${label}`);
    if (row.scores.notes) {
      console.log(`         ${row.scores.notes.slice(0, 80)}`);
    }
  }

  // Unscored summary
  const noSummary  = rows.filter(r => !r.fetch_error && !r.summary).length;
  const noFacts    = rows.filter(r => r.summary && !r.facts_reviewed).length;
  const fetchFails = rows.filter(r => r.fetch_error).length;
  if (fetchFails || noSummary || noFacts) {
    console.log(`\nUnscored:`);
    if (fetchFails) console.log(`  ${fetchFails} fetch error(s)`);
    if (noSummary)  console.log(`  ${noSummary} missing summary — run --stage generate`);
    if (noFacts)    console.log(`  ${noFacts} pending fact review — set facts_reviewed=true in input.csv`);
  }

  console.log(`\n${SEP}`);

  // Write report.csv
  const reportPath  = join(runDir, 'report.csv');
  const csvHeaders  = ['url', 'source_type', 'page_title', 'prompt_version',
                       ...DIMS, 'total', 'notes', 'fetch_error', 'generate_error'];
  const csvDataRows = rows.map(row => {
    const total = row.scores ? DIMS.reduce((s, d) => s + (row.scores[d] || 0), 0) : '';
    return csvLine([
      row.url,
      row.source_type    || '',
      row.page_title     || '',
      row.prompt_version || '',
      ...DIMS.map(d => row.scores ? (row.scores[d] ?? '') : ''),
      total,
      row.scores?.notes  || '',
      row.fetch_error    || '',
      row.generate_error || '',
    ]);
  });
  await writeFile(reportPath, [csvLine(csvHeaders), ...csvDataRows].join('\n') + '\n', 'utf8');
  console.log(`report.csv → ${reportPath}`);
}

// ---------------------------------------------------------------------------
// Stage: all
// ---------------------------------------------------------------------------
async function stageAll(args) {
  const runDir = await stageFetch(args);
  args.runDir  = runDir;
  await stageGenerate(args);
  await stageScore(args);
  await stageReport(args);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const args = parseArgs();

  if (args.stage === 'draft-facts') {
    throw new Error('draft-facts stage is planned for Phase 2. See evals/plan.md.');
  }

  console.log(`\npage-summariser eval  |  stage: ${args.stage}${args.profile !== 'default' ? `  profile: ${args.profile}` : ''}`);
  console.log(SEP);

  switch (args.stage) {
    case 'fetch':    await stageFetch(args);    break;
    case 'generate': await stageGenerate(args); break;
    case 'score':    await stageScore(args);    break;
    case 'report':   await stageReport(args);   break;
    case 'all':      await stageAll(args);      break;
    default: throw new Error(`Unknown stage: "${args.stage}". Valid: fetch, generate, score, report, all`);
  }
}

main().catch(err => {
  console.error(`\nError: ${err.message}`);
  process.exit(1);
});
