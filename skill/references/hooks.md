# Hooks — user-controlled automation

SiftOS can observe and, only when configured, gate parts of the coding lifecycle.
Every hook has distinct **Installed**, **Enabled**, and **Observed** state.
Installing or initializing SiftOS never enables automatic hooks.

## Policy

Configuration precedence:

```text
session override
↓
.product/config.json
↓
~/.siftos/config.json
↓
preset defaults
```

Presets: `off`, `advisory`, `balanced`, `strict`, `custom`.

Known per-hook entries are strict. If an entry exists it must contain
`enabled: true|false`; optional `enforcement` and `failure_policy` must also be
valid enum values. A malformed hook block is never partially interpreted.

**Policy ambiguity is fail-closed at the mutation boundary:**

- `siftos hooks`, `siftos guard`, and `siftos doctor` report the invalid config;
- Codex/OpenCode `before_mutation` denies mutation with an explicit
  configuration-error reason;
- non-critical lifecycle hooks remain inert until `.product/config.json` is
  repaired.

This prevents the CLI from reporting OFF while a harness independently infers
an active policy, or vice versa.

## Product Guard invariant

The Guard is scoped to the current product intent.

```text
unresolved intent
  ↓ mutation
BLOCK
  ↓ retry
BLOCK
  ↓ explicit authorization
prototype | active existing_bet | build_anyway
  ↓
ALLOW
```

`block_issued` is UX state only. It never authorizes a retry.

`existing_bet` is build-authorizing only for an active Bet in one of:

```text
accepted
building
shipped
measuring
```

`shape`, `validate`, and `reconsider` are valid reasoning steps but do not
silently authorize production mutation.

Manual `siftos guard` invocations are separate intents by default. Reuse an
explicit `--turn-id` only when intentionally continuing the same intent. This
keeps a manual `build_anyway` from becoming sticky across unrelated commands.

## Deterministic classification

The TypeScript CLI and standalone hook runtime consume the same policy data.
The fallback classifier is deliberately conservative about false positives:

- tests, docs, examples, fixtures, Markdown and snapshots are non-product
  targets and resolve L0;
- generic words such as `team`, `trial`, `activation`, or `plan` are not enough
  by themselves to create L2/L3;
- referrals, user invitations, OAuth/login, onboarding, notifications,
  permissions, workspaces and explicit integrations are L2 examples;
- pricing, billing, subscriptions, payments, marketplace and business-model
  changes are L3 examples.

Tool effect and product level are separate. `npm test` and typecheck are
verification; `npm run build` is a mutation because it may write artifacts.
SiftOS is still product-judgment tooling, not a security sandbox.

## Codex

Codex uses native lifecycle contracts:

| SiftOS behavior | Codex hook | Behavior |
| --- | --- | --- |
| Session context | `SessionStart` | Product Context Capsule via `additionalContext` |
| Prompt intake | `UserPromptSubmit` | starts a fresh intent and injects advisory context |
| Mutation gate | `PreToolUse` | `permissionDecision: deny` while unresolved |
| Mutation tracking | `PostToolUse` | records actual mutation effects only |
| Compaction | `PreCompact` | preserves runtime state for reload |
| Closeout | `Stop` | balanced/strict may request one continuation |
| Cleanup | `SessionEnd` | clears session-only state |

Never use retry as authorization. Never create a Stop loop: the runtime caps
closeout continuation at one and honors the harness Stop-active signal.

## OpenCode

SiftOS installs a repository-local plugin at:

```text
.opencode/plugins/siftos.js
```

with canonical implementation under the installed skill.

Native coverage includes:

- `tool.execute.before` for mutation gating;
- `tool.execute.after` for mutation tracking (read-only tools are ignored);
- session lifecycle events, with a fresh runtime scope on each observed
  `session.created`;
- compaction context;
- `session.idle` advisory closeout.

OpenCode does not currently have a documented 1:1 equivalent to the Codex
`UserPromptSubmit` + forced `Stop` continuation contracts used here. Do not
claim parity. At idle, SiftOS uses an attached Bet when present; otherwise it
may derive a Bet only when exactly one PDR is `building`. If no unique Bet can
be attached, it reports that implementation mutations occurred without a
unique active Bet instead of pretending a Ship Gate ran.

## DeepSeek Harness (dsh)

`siftos install` writes a Cordis plugin into the harness home:

```text
$DSH_HOME/plugins/siftos/index.js        (plus scripts/ runtime)
$DSH_HOME/cordis.patch.yml               marked SiftOS insert row
```

Home default is `$DSH_HOME` or `~/.dsh`. The patch inserts the plugin row
`id: siftos` → `./plugins/siftos/index.js`; marker-managed SiftOS blocks are
replaced on reinstall, unrelated YAML is preserved, and an unmanaged
`id: siftos` pointing elsewhere is refused.

| SiftOS behavior | dsh event | Behavior |
| --- | --- | --- |
| Session context | `agent/session-start` (emit) | `startSession`; capsule injected while `session_start` is enabled; `source: "compact"` observes `context_compact` and injects the capsule again |
| Prompt intake | `agent/pre-step` (waterfall) | starts a fresh intent from the message batch; always `next()` — Guard never rejects steps |
| Mutation gate | `tools/pre-execute` (waterfall) | `{ kind: "deny", reason }` while unresolved; `fail_closed` on errors |
| Mutation tracking | `tools/result` (emit) | records actual mutation effects only |
| Closeout | `agent/turn-stopping` (serial) | balanced/strict may `agent.steer` exactly one continuation; otherwise advisory `inject` |
| Cleanup | `agent/disposed` (emit) | clears session-only state |

dsh is a developer-preview harness; plugin event contracts may change without
notice. Doctor reports the installed artifacts (plugin file + patch row), not
assumed runtime fire — `Observed` still requires a real hook firing.

## Presets

Guard behavior:

```text
             advisory       balanced                  strict
L0           ALLOW          ALLOW                     ALLOW
L1           ALLOW          ALLOW                     ADVISE
L2           ALLOW+advice   BLOCK until resolution    REQUIRE resolution
L3           ALLOW+advice   BLOCK until resolution    REQUIRE resolution
UNKNOWN      ALLOW          ALLOW                     REQUIRE resolution
```

Closeout:

```text
advisory   report only
balanced   Codex may request one continuation when Ship Gate needs attention
strict     Codex may request one continuation when Ship Gate needs attention
```

## Ship Gate parity

Manual `siftos ship` and automatic closeout share the same active status set and
the same deterministic checks:

- target user;
- problem/goal;
- expected outcome / primary metric;
- success threshold;
- baseline;
- instrumentation;
- guardrails;
- revisit condition;
- scope.

`reviewed` and `superseded` are history/terminal states, not active build
authorization, and therefore return `NOT_REQUIRED` from the Ship Gate.

## Installation safety

`siftos install`:

- preserves non-SiftOS entries in existing `.codex/hooks.json`;
- replaces prior SiftOS Codex entries instead of duplicating them;
- refuses to overwrite `.opencode/plugins/siftos.js` if that file is not
  SiftOS-managed;
- replaces its own skill directory on reinstall so removed package files do
  not remain as stale artifacts.

Installing still does **not** enable automation.

## Runtime

`.product/.runtime/session.json` is disposable state, never canonical product
memory. There is **one runtime file per repository**, shared by every coding
session: concurrent sessions in the same repository (for example parallel
OpenCode sessions) are not isolated from each other — the most recent hook
event wins, so turn/guard state must not be assumed to be per-session.
Canonical product memory and repository config are unaffected.

Legacy runtimes without intent-scoped guard state do not carry old
`build_anyway`, `prototype`, or `existing_bet` authorization forward.

Writes are atomic to avoid partial/corrupt JSON. The current V2 runtime does
not claim transactional multi-process semantics for concurrent independent
read-modify-write operations; coding-agent hook execution is expected to be
serialized by the harness. If a future harness runs these hooks concurrently,
add an explicit runtime transaction/lock rather than claiming atomic rename
solves lost updates.

## Doctor / capability honesty

`siftos doctor` separates core health from automation health. A manual-only
repository can be healthy without either lifecycle adapter. Automation is
reported independently as `off`, `healthy`, or `degraded`, and each hook reports
Installed / Enabled / Observed state.

A directory named `.opencode/` is not proof of an OpenCode adapter, and an
arbitrary hooks JSON is not proof of Codex coverage. Doctor inspects the real
SiftOS adapter artifacts and configuration instead of confirming intended
architecture.
