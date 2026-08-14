# SiftOS for OpenCode

The repository-local plugin lives at `.opencode/plugins/siftos.js` and loads
the canonical implementation from `.agents/skills/siftos/adapters/`.

OpenCode supports SiftOS mutation gating/tracking, session lifecycle events and
compaction context through native plugin hooks. Codex-style `UserPromptSubmit`
context injection and forced `Stop` continuation do not currently have a
documented 1:1 OpenCode equivalent; SiftOS reports those paths as degraded
instead of claiming full hook parity.

Installing the adapter does **not** enable automatic hooks. Use
`siftos hooks set advisory|balanced|strict` to opt in.
