# SiftOS

**Product Decision Intelligence for AI-native teams.**

SiftOS is a repository-native agent skill (OpenCode + Codex) that gives
agents persistent product context and introduces a structured decision
protocol — decide, challenge, record, review, learn.

> **Your product memory belongs to your repository, not your AI vendor.**

![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18-339933?logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
[![CI](https://github.com/felipcsousa/siftos/actions/workflows/ci.yml/badge.svg)](https://github.com/felipcsousa/siftos/actions/workflows/ci.yml)
![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)

## The problem

Teams make hundreds of product decisions but rarely preserve the reasoning,
evidence, assumptions and expectations behind them. Consequences: repeated
discussions, forgotten rationales, opinion confused with evidence,
retrospectively rewritten predictions, decisions that outlive their
assumptions.

SiftOS closes the loop:

```text
Decision
  ↓
Prediction
  ↓
Outcome
  ↓
Learning
  ↺
```

## What SiftOS is

- **A canonical agent skill** — one installation in
  `.agents/skills/siftos/` works in OpenCode and Codex with identical
  semantics.
- **Product Decision Records (PDRs)** — every relevant decision becomes a
  versioned, human-readable, agent-readable, searchable Markdown file.
- **Six workflows** — `init`, `decide`, `challenge`, `review`, `show`,
  `audit`.
- **Fifteen deterministic linters** — the "Product Slop Detector" —
  that never depend on the model.
- **Local-first, Git-native** — persistence is Markdown, history is Git,
  source of truth is `.product/`. No database, no vendor lock-in.

SiftOS does not replace human judgment. It makes judgment explicit,
structured, contestable, verifiable, measurable and historically
preserved. The human owns every decision.

## Quickstart

```bash
npx siftos install     # installs the skill into .agents/skills/siftos/
```

Then ask your agent (in OpenCode or Codex):

```text
Initialize SiftOS for this product.
Should we remove the credit card requirement from trial?
```

The agent runs the `init` workflow (builds persistent product context in
5–10 minutes; missing information stays `Unknown.`) and the `decide`
workflow (structured analysis, recommendation, dissent, expected
outcome — ending in your explicit human decision, persisted as a PDR).

## How it works

### Memory layout

```text
.product/
├── PRODUCT.md        durable product context
├── STRATEGY.md       current strategic objective and bets
├── METRICS.md        metrics, baselines, targets
├── PRINCIPLES.md     persistent organizational opinions
├── decisions/        DEC-XXXX-slug.md
├── evidence/         supporting material
└── config.json
```

The skill definition (`.agents/skills/siftos/`) and the product memory
(`.product/`) are never mixed: intelligence code and product memory stay
separate.

### Product Decision Record

```yaml
---
id: DEC-0042
title: Remove mandatory credit card from trial
status: accepted
created_at: 2026-08-13
updated_at: 2026-08-13
goal: improve-activation
bet_class: offense
confidence: medium
reversibility: high
cost_of_delay: medium
review_date: 2026-09-13
agent_workflow_version: decide-v1
---
```

The body separates `Context`, `Goal`, `Facts`, `Evidence`, `Inferences`,
`Assumptions`, `Unknowns`, `Options Considered`, `Alternatives Rejected`,
`AI Recommendation`, `Final Human Decision`, `Rationale`, `Strongest
Argument Against`, `Expected Outcome`, `Primary Metric`, `Guardrails`,
`Reversibility`, `Cost of Delay`, `What Would Change Our Mind`, `Revisit
Condition` — plus an `# Outcome` part (`Observed Result`, `Prediction
Accuracy`, `Decision Assessment`, `Learnings`, ...).

Status lifecycle:

```text
draft → proposed → accepted → shipped → reviewed
proposed → rejected
accepted → cancelled | superseded
shipped → superseded
```

A PDR reaches `accepted` only after an explicit human decision. Original
predictions are preserved verbatim through review — hindsight rewriting
is a bug.

### Workflows

| Workflow    | Purpose |
| ----------- | ------- |
| `init`      | Build persistent product context (progressive, 5–10 min). |
| `decide`    | Structure a decision: facts, evidence, assumptions, unknowns, alternatives, recommendation, dissent, expected outcome, revisit condition. |
| `challenge` | Adversarial review of an idea or an existing PDR. Never modifies the PDR. |
| `review`    | Close the loop: compare prediction with outcome, extract structured learnings. |
| `show`      | Retrieve decisions by ID, text, tags, status, owner, goal, pending review. |
| `audit`     | Decision Health: counts, waiting reviews, deterministic linter findings. |

### Linters

| Rule | Check | Severity |
| --- | --- | --- |
| `missing-goal` | no goal associated | WARNING |
| `missing-alternative` | fewer than 2 options considered | WARNING |
| `missing-success-metric` | no verifiable outcome | WARNING; ERROR when accepted+ |
| `missing-review-condition` | no explicit revisit condition | WARNING |
| `metric-without-baseline` | relative prediction without a real baseline | WARNING |
| `assumption-as-fact` | same statement in Facts and Assumptions | ERROR |
| `no-dissent` | no strongest argument against | WARNING |
| `no-human-decision` | accepted+ without explicit human decision | ERROR |
| `orphan-decision` | accepted+ without goal/strategy link | ERROR |
| `stale-review` | review date passed, decision not reviewed | WARNING |
| `missing-guardrail` | primary metric without guardrail | WARNING |
| `guardrail-without-baseline` | guardrail without a quantified threshold | WARNING |
| `stale-evidence` | evidence older than 90/365 days | INFO/WARNING |
| `gated-evidence` | evidence cites paywalled content | WARNING |
| `conflicting-status` | invalid field/status combinations | ERROR/WARNING |

`ERROR` findings can block state transitions.

### Deterministic core vs. model

IDs, parsing, serialization, schema validation, status transitions,
linting, search, date checks, audit and discovery are deterministic code —
the same result in every harness. The model is used only for
interpretation, analysis, inference, alternatives, adversarial reasoning,
recommendation and learning extraction. Missing information is `Unknown.`,
never invented.

## CLI

```bash
siftos install            # install the agent skill
siftos init               # scaffold .product/
siftos validate           # parse + schema-validate + lint all PDRs (exit 1 on ERROR)
siftos audit              # Decision Health report
siftos search <query>     # --status= --tag= --owner= --goal= --pending-review
siftos next-id            # next monotonic DEC-XXXX
siftos show <DEC-XXXX>    # show one decision
siftos context [<query>]  # compiled context package for agent workflows
siftos doctor             # installation and repository health
siftos version
```

Global flags: `--dir=<path>`, `--json` where supported. Set
`SIFTOS_TODAY=YYYY-MM-DD` to pin "today" for deterministic review and
staleness checks. The skill also ships dependency-free `scripts/` so
agents can run `init`, `next-decision-id`, `validate`, `audit`, `search`
and `status` without the npm package.

## Security

- No remote database. Memory lives in the repository.
- SiftOS writes only inside `.product/` and its own installation.
- It never commits automatically; it shows `git diff` for the user.
- Local persistence is not the same as model processing: content read by
  the agent may be processed by the agent's model provider.

## Repository layout

```text
src/        deterministic core (schema, parser, serializer, linters, CLI)
skill/      the canonical agent skill (SKILL.md, references, scripts, assets)
evals/      cross-platform eval fixtures and runner
test/       unit and integration tests (vitest)
```

## Development

```bash
npm install
npm run typecheck   # tsc --noEmit
npm test            # vitest: 112 tests
npm run build       # tsc + copy skill into dist/
node evals/run.mjs  # cross-platform eval suite (deterministic workflows)
```

The eval runner executes the deterministic workflows against five
realistic decision fixtures and asserts lint findings, exit codes, search
and audit counts — comparing the CLI against the standalone skill
scripts. The LLM-dependent workflows (`decide`, `challenge`, `review`)
require a live harness and are reported as `MANUAL` until exercised in
OpenCode and Codex.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) — how to add a linter, an eval
fixture, a schema field, and the parity contract between the CLI and the
skill scripts.

## License

[MIT](LICENSE) © SiftOS contributors.
