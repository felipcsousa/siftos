# Contributing to SiftOS

Thanks for contributing. SiftOS is an open-source project (MIT) — every
PDR protocol, linter and workflow improvement compounds for everyone who
uses it.

## Ground rules

- **Determinism is a contract.** Parsing, serialization, IDs, schema
  validation, status transitions, linting, search, date checks and audit
  must stay deterministic: same files, same result, every harness, every
  run. Never move a deterministic operation into model judgment.
- **The human owns the decision.** Product logic must never bypass the
  explicit human decision in a PDR.
- **No silent fabrication.** Missing information is `Unknown.`, never
  invented.
- **CLI and skill scripts must agree.** Every deterministic check exists
  twice — in `src/` (CLI) and in `skill/scripts/` (standalone `.mjs`).
  If you change one, change both, or the eval suite will fail.
- **Attribution.** When adapting external ideas (frameworks, articles),
  paraphrase and cite the source URL in the references. Never copy
  wording or diagrams verbatim.

## Getting started

```bash
git clone https://github.com/felipcsousa/siftos.git
cd siftos
npm install
npm test
```

| Command | Purpose |
| --- | --- |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | vitest unit + integration suite |
| `npm run build` | compile `src/` to `dist/` and copy the skill |
| `node evals/run.mjs` | cross-platform eval suite (requires build) |

All four must pass before a PR is reviewable.

## Repository map

| Path | What lives there |
| --- | --- |
| `src/types.ts` | PDR types, canonical sections, lint contract |
| `src/schema.ts` | zod schema + one-shot repair (PRD §68) |
| `src/parser.ts` / `src/serializer.ts` | Markdown round-trip |
| `src/linters.ts` | the 18 deterministic rules |
| `src/audit.ts` | Decision Health report |
| `src/config.ts` | hook schema, presets, config resolution (PRD V2 §20) |
| `src/runtime.ts` | disposable session state (`.product/.runtime/`) |
| `src/hooks.ts` | hook envelope, scope drift, context capsule |
| `src/guard.ts` | Product Guard: tool effect, levels, deterministic gate |
| `src/shipgate.ts` | deterministic Ship Gate (shared manual/automatic) |
| `src/cli.ts` | `siftos` CLI |
| `skill/SKILL.md` | the canonical agent skill entry point |
| `skill/references/` | protocols (decide, challenge, review, shape, validate, ship, hooks, ...) |
| `skill/scripts/` | dependency-free `.mjs` mirror of the deterministic core |
| `skill/assets/` | init templates |
| `test/` | vitest suite |
| `evals/` | fixtures + `run.mjs` (manifest with expectations) |
| `evals/hooks/` | deterministic hook eval suite (`run.mjs`) |

## How to add a hook or guard rule

1. **`src/guard.ts`** — add keyword patterns to the deterministic level
   classifier (L0–L3) and keep `guardVerdict` pure (level × enforcement →
   verdict). The gate must never depend on the model.
2. **`src/hooks.ts`** — the envelope (`runHook`) applies failure policy;
   `detectScopeDrift` and `buildCapsule` are deterministic helpers.
3. **`skill/scripts/hook-codex.mjs`** — mirror the classifier for
   script-executed hooks (no LLM available).
4. **`skill/references/hooks.md`** — document the hook behavior for
   agent-executed hooks.
5. **`evals/hooks/run.mjs`** — add a deterministic case.

## How to add a linter

Linters are the most common contribution. A new rule touches five places:

1. **`src/linters.ts`** — add a rule function to the `LINTERS` array.
   Severity: `WARNING` for hygiene, `ERROR` for protocol violations that
   should block transitions (e.g. `no-human-decision`). Keep the check
   deterministic — if the real check needs judgment, implement the
   deterministic proxy and document the gap.
2. **`skill/scripts/validate.mjs`** — mirror the rule (same name,
   same severity semantics) so the standalone skill agrees with the CLI.
3. **`skill/references/linter-rules.md`** — document the rule, its
   check, severity and any deterministic proxy.
4. **`test/linters.test.ts`** — at minimum: a firing case, a silent
   case, and confirmation that `cleanDecision()` stays clean. Update the
   rule count test.
5. **`evals/manifest.json`** — if any fixture's expected findings change.

Run `npm test` and `node evals/run.mjs` before opening the PR.

## How to add an eval fixture

1. Create `evals/fixtures/<name>/decisions/DEC-XXXX-*.md` — a realistic
   PDR exercising the behavior you want pinned.
2. Add expectations to `evals/manifest.json` (next-id, validate exit,
   lint rules by severity, audit totals, search results).
3. Optionally add a metrics override in `evals/metrics/`.
4. Run `npm run build && node evals/run.mjs` — the fixture is asserted
   through both the CLI and the standalone skill scripts.

## How to change the PDR schema

Frontmatter fields and body sections are defined in five places that must
stay in sync:

- `src/types.ts` (types + `DECISION_SECTIONS`/`OUTCOME_SECTIONS`)
- `src/schema.ts` (zod + repair)
- `src/parser.ts` and `src/serializer.ts` (round-trip)
- `skill/references/decision-schema.md` and `skill/assets/DECISION.template.md`

Every schema change needs round-trip tests: `parse(serialize(d))`
must deep-equal `d`. `bet_class` and `Alternatives Rejected` are recent
examples of the full pattern.

## How to change the skill behavior

`SKILL.md` stays lean — protocols live in `skill/references/`. Behavior
changes must keep behavioral parity between harnesses (OpenCode and
Codex): same semantics, style differences allowed, structural differences
are bugs. Deterministic workflows stay script-driven; the model only
adds interpretation and analysis.

## Development workflow

1. Branch from `main`: `git checkout -b feat/your-change`.
2. Make focused commits — one logical change per commit, Conventional
   Commits prefixes: `feat:`, `fix:`, `chore:`, `refactor:`, `docs:`,
   `test:`. Imperative subject (`feat: add guardrail-without-baseline`).
3. Rebase onto `main` before requesting review.
4. Open a PR with:
   - the goal and the decision it serves;
   - how to test it (commands);
   - screenshots/evidence for visual or behavior changes;
   - a note on which DoD items it closes.

### PR checklist

- [ ] `npm run typecheck` passes
- [ ] `npm test` passes (new behavior has tests)
- [ ] `npm run build` passes
- [ ] `node evals/run.mjs` reports no failures
- [ ] CLI and `skill/scripts/` stay in parity
- [ ] References/README updated if behavior or docs changed
- [ ] No `console.log` leftovers, no unused imports

## Asking questions

Open an issue for bugs and design questions. For changes that alter the
decision protocol or the PDR schema, open a discussion first — protocol
changes are expensive to migrate and should be deliberate.

## License

By contributing you agree that your contributions are licensed under the
[MIT License](LICENSE).
