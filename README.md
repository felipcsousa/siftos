# SiftOS

**Product Decision Intelligence for AI-native teams.**

SiftOS is a repository-native agent skill for OpenCode and Codex that gives
agents persistent product context and a structured decision protocol — shape,
decide, validate, challenge, build, review and learn.

> **Your product memory belongs to your repository, not your AI vendor.**

![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18-339933?logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
[![CI](https://github.com/felipcsousa/siftos/actions/workflows/ci.yml/badge.svg)](https://github.com/felipcsousa/siftos/actions/workflows/ci.yml)

## The problem

Teams make hundreds of product decisions but rarely preserve the reasoning,
evidence, assumptions and expectations behind them. Coding agents make this
more acute: an idea can become code before anyone notices that a product
choice was made.

SiftOS closes the loop:

```text
Decision → Prediction → Outcome → Learning ↺
```

## What SiftOS is

- **A canonical agent skill** in `.agents/skills/siftos/`. Product memory and
  explicit workflows are shared across OpenCode and Codex without migration.
- **Product Decision Records (PDRs)** — versioned, human-readable and
  agent-readable Markdown.
- **Product workflows** — `init`, `decide`, `shape`, `validate`, `challenge`,
  `prioritize`, `diagnose`, `ship`, `review`, `show`, `audit`, `hooks`.
- **A deterministic core** for IDs, schemas, lifecycle validation, linting,
  search, guard policy and Ship Gate checks.
- **Optional lifecycle adapters**. Installing SiftOS never enables automatic
  intervention; the user explicitly chooses `advisory`, `balanced`, `strict`
  or a custom policy.
- **Local-first, Git-native** — `.product/` is the source of truth. No remote
  database is required.

SiftOS does not replace human judgment. The human owns every decision.

## Quickstart

```bash
npx siftos install
siftos init
```

Then ask your agent:

```text
Initialize SiftOS for this product.
Should we remove the credit card requirement from trial?
```

`init` creates a scaffold. Placeholder-only files such as `PRODUCT.md` full
of `Unknown.` are intentionally reported by `siftos doctor` as **not ready**
until useful context has been established.

Automatic hooks remain **OFF** after install/init. Opt in explicitly:

```bash
siftos hooks set advisory
siftos hooks set balanced
siftos hooks set strict
```

## Memory layout

```text
.product/
├── PRODUCT.md
├── STRATEGY.md
├── METRICS.md
├── PRINCIPLES.md
├── ROADMAP.md
├── config.json
├── decisions/
├── evidence/
├── .runtime/          disposable, gitignored
└── .index/            derived, gitignored
```

The skill definition and product memory are never mixed.

## Product Decision Record

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

A PDR separates facts, evidence, inferences, assumptions, unknowns,
alternatives, AI recommendation, final human decision, expected outcome,
metrics, guardrails, dissent and revisit conditions. Predictions are written
before outcomes and preserved through review.

Lifecycle:

```text
draft → shaping → validating → ready → accepted → building → shipped → measuring → reviewed
```

with `proposed`, `rejected`, `cancelled`, `paused`, `failed` and
`superseded` retained where applicable.

## Workflows

| Workflow | Purpose |
| --- | --- |
| `init` | Build persistent product context progressively. |
| `decide` | Structure a product choice with evidence, alternatives, dissent and prediction. |
| `shape` | Turn an idea into a falsifiable Bet with scope and an SVT. |
| `validate` | Define a Validation Contract before results exist. |
| `challenge` | Adversarially review an idea/PDR without modifying it. |
| `prioritize` | Compare Bets using strategy, constraint, evidence, cost and learning value. |
| `diagnose` | Surface the highest-leverage product health issues. |
| `ship` | Run the deterministic product Ship Gate. |
| `review` | Compare prediction with outcome and extract learning. |
| `show` | Retrieve decision history. |
| `audit` | Decision Health + deterministic linter findings. |
| `hooks` | Inspect/change automatic lifecycle policy. |

## Automatic hooks

SiftOS separates three states:

```text
Installed ≠ Enabled ≠ Observed
```

Installing an adapter never enables it. A hook is only active when the user
has enabled it and the runtime has actually observed it fire.

Presets:

| Preset | Behavior |
| --- | --- |
| `off` | Manual SiftOS only. |
| `advisory` | Observe/recommend, never block. |
| `balanced` | Gate unresolved L2/L3 mutations; Codex closeout may request one continuation. |
| `strict` | Stronger gating, including unknown mutations where applicable. |
| `custom` | Any per-hook combination. |

Config precedence is session override → repository config → global default →
preset. `Build anyway` remains available because the human owns the decision.

Known per-hook entries are schema-validated and must include `enabled`. A
malformed hook block is never partially interpreted. `siftos hooks` / `doctor`
report the configuration error, and the `before_mutation` boundary fails closed
until the policy is unambiguous; non-critical lifecycle hooks remain inert.

### Product Guard semantics

Product Guard classifies work as L0 technical, L1 minor, L2 material or L3
strategic. In `balanced`, an unresolved L2/L3 remains blocked **until an
authorizing resolution exists**. Retrying a tool call is never authorization.

Authorizing resolutions:

- `prototype`
- `existing_bet` pointing to an active `accepted`, `building`, `shipped` or
  `measuring` PDR/Bet
- `build_anyway`

`shape`, `validate` and `reconsider` are valid next steps and may update
`.product/`, but they do **not** silently authorize production mutation.
Manual Guard calls are independent intents unless the caller intentionally
reuses an explicit `--turn-id`, so one manual bypass is not sticky.

The deterministic fallback also distinguishes mutation effect from product
level: tests/docs/examples/fixtures are non-product targets, `npm test` and
typecheck are verification, while `npm run build` is a mutation because it can
write artifacts. The TypeScript core and standalone hook runtime consume the
same policy data and are covered by parity evals.

### Harness capability matrix

Product memory and explicit skills are shared across both harnesses. Automatic
lifecycle integration is intentionally reported by actual capability rather
than claimed as perfect parity.

| Capability | Codex | OpenCode |
| --- | --- | --- |
| Shared `.agents/skills/siftos` workflows | Yes | Yes |
| Before/after mutation guard | Native hook adapter | Native plugin hook |
| Session lifecycle observation | Yes | Yes |
| Compaction preservation | `PreCompact` + session context | compaction plugin hook |
| Prompt-submit context injection | Native `UserPromptSubmit` | No documented 1:1 equivalent; degraded |
| Stop-style forced closeout continuation | Native `Stop` | No documented 1:1 equivalent; advisory at idle |

Codex uses the harness JSON contracts for context injection,
`PreToolUse.permissionDecision`, and `Stop` continuation. OpenCode installs a
real repository plugin under `.opencode/plugins/siftos.js` using documented
before/after tool hooks, session events and compaction context. OpenCode starts
a fresh runtime scope on each observed `session.created`; at idle, SiftOS can
use a unique `building` Bet when one exists or explicitly report that mutations
occurred without a uniquely attachable Bet. When exact parity is unavailable,
`siftos doctor` reports the real installed/observed state instead of inventing
capability.

`siftos install` preserves non-SiftOS entries already present in
`.codex/hooks.json`, refuses to overwrite an unrelated
`.opencode/plugins/siftos.js`, and replaces its own skill directory on reinstall
so removed package files do not survive as stale artifacts.

## Ship Gate

`siftos ship <DEC-XXXX>` and automatic closeout share the same deterministic
status policy and checks. The gate applies to active `accepted`, `building`,
`shipped` and `measuring` Bets; `reviewed` and `superseded` are historical/
terminal states and return `NOT_REQUIRED`.

Checks include target user, problem/goal, expected outcome/metric, success
threshold, baseline, instrumentation, guardrails, revisit condition and scope.
It controls SiftOS lifecycle state; it is **not** deployment authorization or a
security boundary.

## Deterministic linters

The current linter set catches structural product-decision problems including
missing goals/alternatives/metrics/review conditions, assumptions duplicated as
facts, missing dissent, missing SVTs/scope, missing human decisions, stale
reviews/evidence, missing guardrails and conflicting status combinations.

These linters are deterministic. Semantic product judgment still belongs to
the agent workflows; SiftOS does not pretend that string rules alone constitute
complete product judgment.

## CLI

```bash
siftos install
siftos init
siftos validate
siftos audit
siftos search <query>
siftos next-id
siftos show <DEC-XXXX>
siftos context [<query>]
siftos hooks
siftos hook enable|disable <hook>
siftos ship <DEC-XXXX>
siftos roadmap
siftos guard check <path>
siftos scope <DEC-XXXX> <path...>
siftos doctor
siftos version
```

Set `SIFTOS_TODAY=YYYY-MM-DD` to pin time-dependent checks in deterministic
tests.

## `siftos doctor`

Doctor is deliberately adversarial. It distinguishes:

- core/manual health from lifecycle-automation health;
- skill compatibility from lifecycle-adapter installation;
- installed hooks from enabled hooks;
- enabled hooks from observed hooks;
- scaffold files from useful product context;
- valid hook configuration from ambiguous/malformed policy.

A directory full of `Unknown.` is a valid scaffold but not a healthy product
context. Conversely, a deliberately manual-only repository can be healthy even
without Codex/OpenCode lifecycle adapters; automation is reported separately as
`off`, `healthy` or `degraded`.

## Security

- No remote SiftOS database is required.
- Canonical memory lives in the repository.
- SiftOS never commits automatically.
- Product Guard is not a security/sandbox boundary.
- Content read by a coding agent may be processed by that agent's model
  provider even though SiftOS persistence itself is local.

## Repository layout

```text
src/        deterministic core + shipped CLI entrypoint
skill/      canonical agent skill, references, scripts and harness adapters
evals/      deterministic and lifecycle eval suites
test/       unit/integration tests
```

## Development

```bash
npm install
npm run typecheck
npm test
npm run build
node evals/run.mjs
node evals/hooks/run.mjs
```

CI runs both deterministic workflow evals and lifecycle-hook evals. The latter
exercise the shipped entrypoint and native adapter contracts so a regression in
automatic Product Guard cannot be hidden by unit tests of the policy table.

LLM-dependent judgment quality (`decide`, `challenge`, `review`, etc.) still
requires a separate live behavioral eval harness; deterministic passing tests
do not claim to prove product-judgment superiority.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE) © SiftOS contributors.
