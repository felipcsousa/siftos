# Hooks — user-controlled automation (PRD V2)

SiftOS can observe and, only when configured, gate the coding lifecycle.
Every hook is independently: **Installed** (adapter exists) · **Enabled**
(configuration) · **Observed** (runtime saw it fire). Installed does not
mean enabled; enabled does not mean active.

## Policy

- Repository: `.product/config.json` → `hooks` (preset or per-hook).
- Presets: `off`, `advisory` (never blocks), `balanced` (default for new
  repos; gates L2/L3 once), `strict` (hard gates), `custom`.
- Session override: `.product/.runtime/session.json` — highest
  precedence, expires at session end, never touches repository config.
- Global default: `~/.siftos/config.json` → `default_hook_preset`.

Read the effective policy with `siftos hooks` (or
`scripts/hooks.mjs`). Disabled means disabled — never run a disabled hook.

## Hook behaviors (agent-executed)

| Hook | When | Behavior |
| --- | --- | --- |
| `session_start` | session start | Inject the Product Context Capsule: product, current objective, constraint, active bet, guard preset. |
| `prompt_submit` | user prompt | Cheap intent triage: `technical` / `possible_product` / `obvious_product` / `unknown`. Never blocks. |
| `before_mutation` | before write/edit/patch/mutating shell | Product Guard: classify L0–L3, apply the gate (see below). Reads are never gated. |
| `after_mutation` | after a mutation | Record the changed-file footprint in runtime state. No LLM per mutation. Drift detection runs deterministically via `siftos scope <DEC> <files...>`. |
| `turn_stop` | agent tries to finish | Closeout: run Ship Gate when material work is done (at most one continuation in balanced). |
| `context_compact` | compaction | Persist/restore the capsule: active bet, guard resolution, scope, ship state. |
| `subagent_start` | implementation subagent | Pass the bet capsule: active bet, goal, scope, non-goals, measurement requirements. |
| `session_end` | session end | Lightweight flush: clear session overrides, bump local metrics. No critical enforcement. |

## Product Guard gate (deterministic)

```text
Level        balanced                  strict
L0 technical ALLOW                     ALLOW
L1 minor     ALLOW                     ADVISE (inspect)
L2 material  BLOCK ONCE → resolution   REQUIRE RESOLUTION
L3 strategic BLOCK ONCE → resolution   REQUIRE RESOLUTION
UNKNOWN      ALLOW                     REQUIRE RESOLUTION
```

Advisory: recommend, always ALLOW. Block-once: one guard block per
mutation; after the user resolves, proceed.

Resolutions: `shape` · `validate` · `prototype` · `existing_bet` ·
`reconsider` · `build_anyway`. `build_anyway` is always available — the
human owns the decision.

## Script-executed hooks (Codex/OpenCode adapters)

`scripts/hook-codex.mjs` maps logical events to platform hooks
(PreToolUse → before_mutation, UserPromptSubmit → prompt_submit,
SessionStart → session_start, PostToolUse → after_mutation, Stop →
turn_stop). Script hooks have no LLM: classification uses the
deterministic fallback; the gate is always deterministic. On error apply
the hook's `failure_policy` (`fail_open` default, `fail_closed` in
strict before_mutation) and never fail silently.

## Configuration safety

Changing hook settings never mutates decisions, bets, evidence, strategy,
or roadmap (PRD §107). Hooks affect automation, not canonical truth.
