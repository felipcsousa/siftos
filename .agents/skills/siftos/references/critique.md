# Critique — quantitative product health score (DEC-0005, validated 2026-08-24)

Scores the product setup + recent decisions, persists snapshots for trend,
and maps top improvements to executable SiftOS commands. The chat response
is the deliverable; the snapshot is the backlog for later runs.

**Status: design validated (SVT PASS 2026-08-24), not built.** The command
is not yet in the CLI or the SKILL.md workflow table (non-negotiable rule 13:
capability claims must be executable). Build is deferred until the DEC-0003
guardrail lifts (2026-11-16) or DEC-0002 resolves.

## Invocation

```text
/siftos critique
```

Runs against the whole product setup: memory files (PRODUCT, STRATEGY,
METRICS, PRINCIPLES, ROADMAP) + decision records (`decisions/`).

## Dimensions

Each dimension scores 0-100. Scores are directional, not objective truth —
the output must display the label "directional, not objective truth" within
the first 10 lines of the score block.

```text
Memory completeness   memory files present, filled, and current
Decision quality      weighted Decision Quality Score per record, aggregated
Validation rigor      active bets with quantified contracts, metrics baselines, guardrails
Learning capture      outcomes recorded, learnings extracted, review discipline
Strategy alignment    decisions linked to goal/strategy, bets on the roadmap
```

Sources (deterministic where possible, judgment where required):

- `scripts/audit.mjs` — reviewed rate, missing metrics, missing
  alternatives, low-confidence decisions.
- `scripts/status.mjs` — lifecycle distribution, stale bets
  (review_date passed, not reviewed).
- `validate.mjs` — schema/linter findings per record.
- The Decision Quality Score weights in `references/linter-rules.md`
  (Problem/goal 15, Evidence 15, Alternatives 15, Assumptions 10,
  Dissent 10, Outcome 15, Guardrail 5, Revisit condition 10,
  Human decision 5) — aggregated across records for the Decision
  quality dimension.
- Judgment over memory files: currency (ROADMAP derived state vs real
  state), metric targets defined vs `Unknown.`, principle conflicts.
- Learning capture from records: count of `# Outcome` sections with
  content vs `Unknown.`; review_date discipline (stale vs reviewed).

## Output

```text
SiftOS Critique — YYYY-MM-DD

  Memory completeness     ███████░░░  70
  Decision quality        █████████░  85
  Validation rigor        ██████░░░░  65
  Learning capture        █████░░░░░  35
  Strategy alignment      █████████░  85

  Total                   ███████░░░  68 / 100  (Acceptable→Good)
  Directional, not objective truth — judgment over frameworks.

Top 3 improvements:
1. Learning capture (35) — evidence: DEC-0002/0003/0004 outcomes Unknown,
   0 waiting for review
   → Run `review DEC-0003` (revisit 2026-09-18), `review DEC-0004` (2026-09-21)
   → Expected: dimension to ~60 when outcomes are recorded
2. Validation rigor (65) — evidence: METRICS.md Target Unknown
   → Define primary-metric targets and activation baselines in METRICS.md
   → Expected: ~80
3. Memory completeness (70) — evidence: ROADMAP.md lists a reviewed record
   → Run `siftos roadmap --write`
   → Expected: ~85
```

Rules:

- At most 3 improvements. More than that is noise (same rule as diagnose).
- Every improvement cites evidence from this repo and names a specific
  command plus the expected score effect. If an improvement cannot name
  all three, it is not a top improvement.
- The score is read-only: no state transitions, no Ship Gate coupling in
  v1. Critique is a dashboard, not a gate.
- `Unknown.` is a legitimate finding; never invent baselines or outcomes.
- A total ≥ 85 while 2+ records lack recorded outcomes (learning capture
  ≤ 40) is a weight-model alert: recompute the total with evidence, never
  ship a misleading high score.

## Snapshot + trend

Persist each run to `.product/evidence/critique/YYYY-MM-DD.md` (frontmatter
with dimension scores + total; body with the full report). Trend = last 5
snapshots, printed after the report:

```text
Trend for product setup (last 5 runs): 68 → ...
```

## Close

The run ends with a question: which dimension to attack first, offering the
2-3 lowest-scoring dimensions as options. Never end on the report alone.
