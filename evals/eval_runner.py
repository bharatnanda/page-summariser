"""
LLM-as-Judge eval runner for page-summariser.

Reads eval_set.csv, scores each summary using an OpenAI judge model,
and compares results against human scores.

Usage:
    pip install openai
    OPENAI_API_KEY=sk-... python eval_runner.py
"""

import csv
import json
import os
from openai import OpenAI

client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

# ---------------------------------------------------------------------------
# Original summarisation prompt (from core/utils/promptBuilder.js)
# ---------------------------------------------------------------------------
SUMMARISATION_PROMPT = """You are a professional summarizer.
Read the webpage content provided below and produce a clear, concise summary in English.

## Hard Constraints
- Must keep the summary under 250 words.
- Use bullet points ('-') by default; use short paragraphs only when needed or when bulleting harms clarity.
- Use a table only for comparative data or structured lists with 3+ similar items.
- Use bold to emphasize the most important names, organizations, and key conclusions (avoid over-bolding).
- Wrap long URLs in angle brackets < > if included.

## Length Target (Adaptive)
Choose a target length based on page type and content length, while staying under 250 words:
- Short pages or landing pages: ~80-130 words.
- Typical articles: ~130-200 words.
- Long docs or dense pages: ~200-250 words.

## Page-Type Handling (Required)
First infer the page type and summarize accordingly:
- Article/essay: central thesis + key arguments + conclusion.
- Homepage/feed/index: digest the most important items; do not force one narrative.
- Docs/reference: purpose + key sections/concepts + how to use (if applicable).
- Product/landing: what it is, who it's for, key features, pricing/CTA if present.
- Mixed pages: summarize the dominant content blocks.

## What to Include
- Main ideas/topics and key arguments (when applicable).
- Important facts, data points, outcomes, or conclusions.
- Overall purpose/intent (inform, persuade, critique, promote, document, etc.).
- Key entities: people, organizations, locations, events, products/tech/concepts.
- Author stance/tone only if clearly expressed.
- Calls to action/recommendations/proposed solutions (if present).

## What to Exclude (Strict)
- Navigation menus, headers/footers, ads, pop-ups, cookie banners, scripts/analytics.
- Author bios, comments, social embeds, newsletter signups, unrelated promos.

## Output Rules (Strict)
- Use bullet points ('-') by default.
- Do not include headings, section titles, or labels (e.g., "Summary", "Key Entities").
- Do not include any preamble or closing remarks.
- Do not include any follow-up questions, offers to help, or requests for more input.

Output only the summary.

---

Page Content:
{content}
"""

# ---------------------------------------------------------------------------
# Judge prompt
# ---------------------------------------------------------------------------
JUDGE_PROMPT = """You are evaluating the quality of an AI-generated webpage summary.
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
Respond with JSON only. No other text before or after.
{{
  "accuracy": <int 0-3>,
  "coverage": <int 0-3>,
  "conciseness": <int 0-2>,
  "format": <int 0-2>,
  "notes": "<one concise sentence explaining the main strength and weakness>"
}}
"""

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def score_summary(key_facts: str, summary: str) -> dict:
    """Call the judge model and return parsed scores."""
    prompt = JUDGE_PROMPT.format(key_facts=key_facts, summary=summary)
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        temperature=0,
        response_format={"type": "json_object"},
    )
    return json.loads(response.choices[0].message.content)


def summarise_page(content: str) -> str:
    """Generate a summary for raw page content using the original prompt."""
    prompt = SUMMARISATION_PROMPT.format(content=content)
    response = client.chat.completions.create(
        model="gpt-o3",
        messages=[{"role": "user", "content": prompt}],
        temperature=0,
    )
    return response.choices[0].message.content.strip()


def print_row_result(row: dict, llm_scores: dict):
    human_total = float(row["total"])
    llm_total = llm_scores["accuracy"] + llm_scores["coverage"] + llm_scores["conciseness"] + llm_scores["format"]
    delta = llm_total - human_total

    print(f"\n{'='*60}")
    print(f"Row {row['id']}: {row['page_title'][:50]}")
    print(f"  Model: {row['model']}  |  Type: {row['source_type']}")
    print(f"  {'Dim':<12} {'Human':>6} {'LLM':>6}")
    print(f"  {'-'*26}")
    for dim in ("accuracy", "coverage", "conciseness", "format"):
        print(f"  {dim:<12} {float(row[dim]):>6.1f} {llm_scores[dim]:>6}")
    print(f"  {'TOTAL':<12} {human_total:>6.1f} {llm_total:>6}  (Δ {delta:+.1f})")
    print(f"  Human notes : {row['notes'][:80]}")
    print(f"  LLM notes   : {llm_scores['notes'][:80]}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    csv_path = os.path.join(os.path.dirname(__file__), "eval_set.csv")

    with open(csv_path, newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))

    totals = {"human": 0.0, "llm": 0.0, "rows": 0}

    for row in rows:
        print(f"\nScoring row {row['id']}...", end=" ", flush=True)
        try:
            llm_scores = score_summary(row["key_facts"], row["summary"])
            print("done")
            print_row_result(row, llm_scores)

            llm_total = sum(llm_scores[d] for d in ("accuracy", "coverage", "conciseness", "format"))
            totals["human"] += float(row["total"])
            totals["llm"] += llm_total
            totals["rows"] += 1
        except Exception as e:
            print(f"ERROR: {e}")

    if totals["rows"]:
        avg_human = totals["human"] / totals["rows"]
        avg_llm = totals["llm"] / totals["rows"]
        print(f"\n{'='*60}")
        print(f"SUMMARY  ({totals['rows']} rows)")
        print(f"  Avg human score : {avg_human:.2f} / 10")
        print(f"  Avg LLM score   : {avg_llm:.2f} / 10")
        print(f"  Avg delta       : {avg_llm - avg_human:+.2f}")


if __name__ == "__main__":
    main()
