# Linter Rules — deterministic Product Slop Detector

Combines LLM judgment with deterministic rules. Deterministic checks must
return the same result for the same files in every harness (AC-AUDIT-002).

## Severity

- `INFO` — informational.
- `WARNING` — does not block state transitions.
- `ERROR` — can block state transitions.

## Rules

| Rule | Check | Severity |
| --- | --- | --- |
| `missing-goal` | no goal associated | WARNING |
| `missing-alternative` | fewer than 2 options considered | WARNING |
| `missing-success-metric` | no verifiable outcome (metric or expected outcome) | WARNING; ERROR when accepted+ |
| `missing-review-condition` | no explicit revisit condition | WARNING |
| `metric-without-baseline` | prediction uses relative change but METRICS.md baseline is `unknown`/absent | WARNING |
| `assumption-as-fact` | same statement appears under Facts and Assumptions | ERROR |
| `no-dissent` | no strongest argument against | WARNING |
| `no-human-decision` | accepted+ without explicit human decision | ERROR |
| `orphan-decision` | accepted+ without goal/strategy link | ERROR |
| `stale-review` | review_date passed, decision not reviewed | WARNING |
| `missing-guardrail` | primary metric without guardrail | WARNING |
| `guardrail-without-baseline` | guardrail without a quantified threshold | WARNING |
| `stale-evidence` | evidence date older than 90/365 days | INFO/WARNING |
| `gated-evidence` | evidence cites content marked `Access: gated` | WARNING |
| `conflicting-status` | reviewed without observed result; superseded without `superseded_by`; proposed with human decision | ERROR/WARNING |

`guardrail-without-baseline` (adapted from Reforge —
https://www.reforge.com/blog/good-experiment-bad-experiment): a guardrail
must be measurable to be a guardrail. Deterministic proxy: guardrail
lines (from the `Guardrails` section or `Guardrail:` lines in
`Expected Outcome`) containing no digit are flagged.

`gated-evidence`: external claims must be publicly verifiable. Evidence
lines carrying `Access: gated` are flagged; `Access: public` or absent
is accepted.

## Decision Quality Score (optional)

Internal completeness score — never a scientific measure, never used for
ranking people:

```text
Problem/goal defined    15
Evidence present        15
Alternatives            15
Assumptions explicit    10
Dissent                 10
Outcome                 15
Guardrail                5
Revisit condition       10
Human decision           5
Total                  100
```

## Product Slop Detector

Warnings the combined checks surface:

```text
⚠ Solution presented without problem evidence
⚠ Success metric has no baseline
⚠ Assumption presented as fact
⚠ No counterfactual
⚠ No alternative considered
⚠ No revisit condition
⚠ Feature conflicts with current product principle
⚠ Evidence is potentially stale
⚠ Guardrail has no quantified threshold
⚠ Evidence cites gated content
```

## Execution

In a harness without the CLI, run `scripts/validate.mjs` and
`scripts/audit.mjs` (dependency-free Node). With the CLI:
`siftos validate` / `siftos audit`. Exit code 1 means ERROR-level
findings or schema failures.

## Attribution

Several rules adapt public Reforge blog ideas (paraphrased, never
verbatim). Sources are cited inline in the rule descriptions.
