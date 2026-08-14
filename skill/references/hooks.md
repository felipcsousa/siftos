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

## Codex adapter

Codex uses native lifecycle contracts:

| Logical behavior | Codex hook | Behavior |
| --- | --- | --- |
| Session context | `SessionStart` | returns Product Context Capsule through `additionalContext` |
| Prompt intake | `UserPromptSubmit` | starts a fresh turn/intent and returns advisory context |
| Mutation gate | `PreToolUse` | returns `permissionDecision: deny` for unresolved gated changes |
| Mutation tracking | `PostToolUse` | records disposable changed-file footprint |
| Compaction | `PreCompact` | persists runtime state; the next SessionStart can reload repository context |
| Closeout | `Stop` | may return `{decision: "block", reason}` once when Ship Gate needs attention |
| Cleanup | `SessionEnd` | clears session-only overrides/state as appropriate |

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
| After mutation | `tool.execute.after` |
| Session observation | plugin `event` session lifecycle |
| Compaction context | `experimental.session.compacting` |
| Closeout | `session.idle`, advisory only |

OpenCode does **not** currently expose documented 1:1 equivalents for Codex
`UserPromptSubmit` context injection or Stop-style forced continuation. Do not
claim those are implemented. Product Guard still protects mutations through
`tool.execute.before`; explicit SiftOS workflows remain fully available.

## Preset behavior

```text
             advisory       balanced                  strict
L0           ALLOW          ALLOW                     ALLOW
L1           ALLOW          ALLOW                     ADVISE
L2           ALLOW+advice   BLOCK until resolution    REQUIRE resolution
L3           ALLOW+advice   BLOCK until resolution    REQUIRE resolution
UNKNOWN      ALLOW          ALLOW                     REQUIRE resolution
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

Canonical decisions/evidence/strategy never live only in runtime state.

## Failure policy

- `advisory` / `balanced`: fail open by default, with visible diagnostic.
- `strict before_mutation`: may fail closed.
- A hook failure must never silently masquerade as successful enforcement.

## Capability honesty

`siftos doctor` must distinguish:

```text
skill available
adapter installed
hook enabled
hook observed
```

A directory called `.opencode/` is not evidence of an installed OpenCode
adapter. A hooks JSON file is not proof that every logical hook is supported.
Doctor reports real artifacts and observed heartbeats, not intended
architecture.
