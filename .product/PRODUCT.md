# Product

## Name

SiftOS

## Description

Product Decision Intelligence for AI-native teams. A repository-native agent skill for OpenCode, Codex and DeepSeek Harness (dsh), plus a deterministic CLI, that gives agents persistent product context and a structured decision protocol — shape, decide, validate, challenge, build, review and learn. Product memory lives in the repository (`.product/`), not with the AI vendor.

## Primary customer

Product managers and heads of product at AI-native teams already using coding agents (Codex, OpenCode, dsh). They decide to adopt; the installation is executed by an engineer via copy-paste (`npx @felipcsousa/siftos install` or an agent prompt). [Confirmed in design session 2026-08-17]

## Primary jobs to be done

- Make product decisions conscious and explicit — between the human and the agent — instead of silently inferred by the LLM.
- Define what to measure before building, so teams build knowing how the outcome will be evaluated.
- Preserve the reasoning, evidence and expected outcome of every product decision, versioned in the repo.

## Business model

Open source (MIT). Distributed via npm (`@felipcsousa/siftos`, published 2026-08-18). No pricing, no sales motion, no paid tiers.

## Product stage

Early. v0.3.0. Published to npm as `@felipcsousa/siftos` (2026-08-18); landing built in `site/` with GitHub Pages workflow configured. Product memory was placeholder ("Unknown.") until this session.

## Positioning

"Better product decisions — not inferred by the LLM, but consciously made between you and your agent. Build knowing what to measure." [User's own formulation, confirmed in design session 2026-08-17]

## Current constraints

- Published to npm as `@felipcsousa/siftos` (name `siftos` blocked by registry anti-squatting vs `sift`); install via `npx @felipcsousa/siftos install`.
- No testimonials, customers, benchmarks, pricing or usage claims — must not be fabricated.
- No analytics on the landing (v1 decision); success signals are GitHub stars and issues opened.
- Landing copy must be written in English; all repo content (README, docs, quickstart) is English.
- Landing must not duplicate README/docs content — link to it instead.

## Non-goals

- No automatic intervention: lifecycle adapters (advisory/balanced/strict) are explicitly user-chosen, never default-on.
- No remote database; local-first, Git-native. `.product/` is the source of truth.
- SiftOS does not replace human judgment; the human owns every decision.

## Relevant systems

- OpenCode, Codex and DeepSeek Harness (dsh) adapters (`.agents/skills/siftos/adapters/`)
- npm registry (target distribution channel)
- GitHub: felipcsousa/siftos repo; GitHub Pages project site (`felipcsousa.github.io/siftos`, base `/siftos/`) via Astro static export
- `.product/` memory layout (PRODUCT/STRATEGY/METRICS/PRINCIPLES/ROADMAP, decisions/, evidence/)

## Additional context

- Landing scope (confirmed in design session 2026-08-17): hero with copy-paste CTAs, problem section, how-it-works, example PDR, copy CTA block, contributing + request-improvements (link to issues), footer.
- Primary visitor persona: PM/head of product; conversion action is copying the terminal command or the agent install prompt.
- Site lives in `site/` subfolder of the repo; CI via GitHub Actions pages workflow.
- Success criteria: stars and issues moving after launch; re-evaluate in ~3 months.
