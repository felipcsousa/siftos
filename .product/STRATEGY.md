# Product Strategy

## Current strategic objective

Land the first external users and validate adoption of SiftOS (DEC-0002). Success signals: GitHub stars, external issues, npm installs over the 90-day observation window ending 2026-11-16.

## Strategic context

v0.3.0 published to npm (2026-08-18); landing live with GitHub Pages workflow; three harness adapters (OpenCode, Codex, dsh). DEC-0001 validated the deterministic core locally. Launch post on LinkedIn (2026-08-18) reached 30 reactions, 6 comments, 2 shares; comments came from a PicPay Staff Engineer, an Inter Head of Product and senior AI PMs. GitHub remains at baseline: 2 stars, 0 issues, 0 forks. npm downloads: 246 in last 30 days (baseline includes this repo's own installs).

## Target customer

PMs and heads of product at AI-native teams already using coding agents (Codex, OpenCode, dsh). They decide to adopt; an engineer executes the install. [Confirmed in design session 2026-08-17]

## Strategic bets

- DEC-0002 — Launch SiftOS publicly and measure adoption (status: ready; validation contract defined; observation window running).

## Competitive advantages

- Product memory lives in the repository, not with the AI vendor.
- Deterministic core (IDs, validation, audit, Ship Gate) — 112 passing unit tests.
- Multi-harness by default: same memory works in OpenCode, Codex and dsh without migration.
- Structured protocol with predictions recorded before outcomes — reduces hindsight bias.
- Open source (MIT), free.

## Constraints

- Single maintainer; no outreach or sales motion; no landing analytics; no fabricated testimonials or usage claims.
- npm name `siftos` blocked; distributed as `@felipcsousa/siftos`.
- Validation contract: pass requires ≥ 5 new stars AND ≥ 2 external issues by 2026-11-16.

## Explicit non-priorities

- Monetization and paid tiers.
- Landing analytics.
- Outreach or sales motion.
- Features beyond the validation contract until it resolves (bet guardrail).

## Strategic questions

- Does attention convert to commitment? (30 reactions → 0 issues so far; funnel gap to watch)
- Is the wedge segment teams that already practice ADRs (Leo Cavalcante's comment), or general AI-native PMs?
- Single-channel risk: is LinkedIn the only effective distribution channel?
