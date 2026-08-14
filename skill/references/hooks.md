# Hooks — user-controlled automation

SiftOS can observe and, only when configured, gate parts of the coding
lifecycle. Every hook is independently **Installed** (real adapter capability),
**Enabled** (user config), and **Observed** (runtime saw it execute).

Installing or initializing SiftOS never enables automatic hooks. Missing
`hooks` configuration means automatic mode is off.

## Policy

- Repository: `.product/config.json`
- Session override: `.product/.runtime/session.json` (highest precedence)
- Global default: `~/.siftos/config.json`
- Presets: `off`, `advisory`, `balanced`, `strict`, `custom`

Read effective state with `siftos hooks`. Disabled means disabled.

Per-hook repository entries are strict: when a known hook entry is present it
must include `enabled: true|false`. A malformed hook block is **not** partially
merged. Both the CLI and standalone adapters disable automatic hooks and expose
a configuration error until `.product/config.json` is fixed. A malformed file
must never produce `OFF` in the CLI and active enforcement in a harness.

## Product Guard invariant

The Guard is scoped to the current user turn/product intent.

```text
blocked intent
    ↓ retry mutation
still blocked
    ↓ explicit authorization
prototype | accepted existing_bet | build_anyway
    ↓
ALLOW
```

`block_issued` only suppresses repetitive explanation. It never authorizes a
second mutation attempt. `shape`, `validate`, and `reconsider` are legitimate
next steps but leave production mutation unresolved.

Manual `siftos guard` calls are independent intents unless the caller supplies
the same explicit `--turn-id`. A prior manual `build_anyway` therefore does not
authorize unrelated later CLI calls.

## Guard classification

The deterministic fallback is intentionally conservative about false positives:

- tests, docs, examples and fixtures are non-product targets and resolve L0;
- generic words such as `team`, `trial`, `activation`, or `plan` are not enough
  by themselves to create an L2/L3 gate;
- explicit capabilities such as referrals, OAuth/login, onboarding,
  notifications, permissions and workspaces are L2;
- pricing, billing, subscriptions, payments, marketplace and business-model
  changes are L3.

The same policy data is consumed by the TypeScript core and the standalone
hook runtime. Evals assert parity.

Shell effects are separate from product level. `npm test` / typecheck are
verification. `npm run build` is treated as a mutation because it may write
artifacts. SiftOS is still product-judgment tooling, not a security sandbox.

## Codex adapter

Codex uses native lifecycle contracts:

| Logical behavior | Codex hook | Behavior |
| --- | --- | --- |
| Session context | `SessionStart` | returns Product Context Capsule through `additionalContext` |
| Prompt intake | `UserPromptSubmit` | starts a fresh turn/intent and returns advisory context |
| Mutation gate | `PreToolUse` | returns `permissionDecision: deny` for unresolved gated changes |
| Mutation tracking | `PostToolUse` | records only actual mutating tool effects |
| Compaction | `PreCompact` | preserves runtime state; the next SessionStart can reload repository context |
| Closeout | `Stop` | balanced/strict may return `{decision: "block", reason}` once when Ship Gate needs attention |
| Cleanup | `SessionEnd` | clears session-only state |

Never emulate Codex denial with a magic exit code when the harness provides a
permission-decision contract. Never create a Stop loop; honor
`stop_hook_active` and the one-continuation runtime limit.

## OpenCode adapter

OpenCode installs a real repository-local plugin:

```text
.opencode/plugins/siftos.js
```

with the implementation in:

```text
.agents/skills/siftos/adapters/opencode-plugin.js
```

Supported native lifecycle points:

| Logical behavior | OpenCode plugin surface |
| --- | --- |
| Before mutation | `tool.execute.before` (throws to block) |
| After mutation | `tool.execute.after`; read-only tools do not enter mutation footprint |
| Session observation | plugin `event` session lifecycle; each `session.created` gets fresh runtime scope |
| Compaction context | `experimental.session.compacting` |
| Closeout | `session.idle`, advisory only |

OpenCode does **not** currently expose documented 1:1 equivalents for Codex
`UserPromptSubmit` context injection or Stop-style forced continuation. Do not
claim those are implemented. Product Guard still protects mutations through
`tool.execute.before`; explicit SiftOS workflows remain fully available.

At idle, if no Bet was explicitly attached, closeout can derive an active Bet
only when there is exactly one `building` PDR. Otherwise it emits an advisory
that mutations occurred without a unique active Bet instead of silently
pretending a Ship Gate ran.

## Preset behavior

```text
             advisory       balanced                  strict
L0           ALLOW          ALLOW                     ALLOW
L1           ALLOW          ALLOW                     ADVISE
L2           ALLOW+advice   BLOCK until resolution    REQUIRE resolution
L3           ALLOW+advice   BLOCK until resolution    REQUIRE resolution
UNKNOWN      ALLOW          ALLOW                     REQUIRE resolution
```

Turn closeout behavior:

```text
advisory   report only
balanced   may request one Codex continuation when Ship Gate needs attention
strict     may request one Codex continuation when Ship Gate needs attention
```

A user bypass is always available by default because Product Guard is product
judgment tooling, not an organizational security boundary.

## Runtime state

`.product/.runtime/session.json` is disposable and may contain:

```text
session_id
turn_id
prompt/candidate
current guard intent + resolution
active_bet
mutation footprint
Ship Gate closeout state
hook heartbeat
session overrides
```

Canonical decisions/evidence/strategy never live only in runtime state. Legacy
runtime files without an intent-scoped guard status never carry historical
`build_anyway`, `prototype`, or `existing_bet` authorization forward.

## Ship Gate parity

Manual `siftos ship` and automatic closeout use the same status policy and the
same deterministic checks: target user, problem/goal, expected outcome/metric,
success threshold, baseline, instrumentation, guardrails, revisit condition
and scope. `reviewed` and `superseded` are historical/terminal states and do
not count as active build authorization.

## Installation safety

`siftos install` preserves non-SiftOS Codex hook entries and refuses to
silently overwrite an existing `.opencode/plugins/siftos.js` that is not
managed by SiftOS. Reinstalling the skill replaces its own skill directory so
removed package files do not survive as stale artifacts.

## Failure policy

- `advisory` / `balanced`: fail open by default, with visible diagnostic.
- `strict before_mutation`: may fail closed.
- A hook failure must never silently masquerade as successful enforcement.
- Invalid repository hook configuration disables automation visibly instead of
  being interpreted differently by the CLI and adapters.

## Capability honesty

`siftos doctor` distinguishes core health from automation health and reports:

```text
skill available
adapter installed
hook enabled
hook observed
automation off | healthy | degraded
```

A manual-only repository can be healthy without lifecycle adapters. A
directory called `.opencode/` is not evidence of an installed OpenCode adapter,
and a hooks JSON file is not proof that every logical hook is supported.
Doctor reports real artifacts and observed heartbeats, not intended
architecture.
