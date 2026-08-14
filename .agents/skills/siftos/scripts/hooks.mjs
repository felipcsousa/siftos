#!/usr/bin/env node
// SiftOS hooks — print the effective hook policy (PRD V2 §26, §111).
// Dependency-free, mirrors `siftos hooks` for agents without the CLI.
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { findProductRoot } from "./lib.mjs";

const HOOK_NAMES = [
  ["session_start", "Session Start"],
  ["prompt_submit", "Prompt Submit"],
  ["before_mutation", "Before Mutation"],
  ["after_mutation", "After Mutation"],
  ["turn_stop", "Turn Stop"],
  ["context_compact", "Context Compact"],
  ["subagent_start", "Subagent Start"],
  ["session_end", "Session End"],
];

const PRESETS = {
  off: { all: false },
  advisory: { all: true, advisory: ["before_mutation", "turn_stop", "prompt_submit"] },
  balanced: { all: true, balanced: ["before_mutation"], advisory: ["turn_stop", "prompt_submit"] },
  strict: { all: true, strict: ["before_mutation", "turn_stop"], advisory: ["prompt_submit"] },
};

function expandPreset(preset) {
  const spec = PRESETS[preset] ?? PRESETS.off;
  const out = {};
  for (const [name] of HOOK_NAMES) {
    const cfg = { enabled: spec.all };
    if (spec.balanced?.includes(name)) cfg.enforcement = "balanced";
    if (spec.strict?.includes(name)) cfg.enforcement = "strict";
    if (spec.advisory?.includes(name)) cfg.enforcement = "advisory";
    if (name === "before_mutation" && preset === "strict") cfg.failure_policy = "fail_closed";
    out[name] = cfg;
  }
  return out;
}

function main() {
  const root = findProductRoot(process.cwd());
  if (!root) {
    console.error("error: no .product/ found in this directory tree");
    process.exit(1);
  }
  let config = {};
  try {
    config = JSON.parse(readFileSync(path.join(root, ".product", "config.json"), "utf8"));
  } catch {
    /* no config: hooks off */
  }
  const rawHooks = config.hooks ?? null;
  const preset = rawHooks?.preset ?? null;

  let hooks;
  if (!preset) {
    hooks = Object.fromEntries(HOOK_NAMES.map(([name]) => [name, { enabled: false }]));
  } else if (preset === "custom") {
    hooks = {};
    for (const [name] of HOOK_NAMES) {
      const raw = rawHooks[name];
      hooks[name] = raw && typeof raw === "object" && "enabled" in raw ? raw : { enabled: false };
    }
  } else {
    hooks = expandPreset(preset);
    for (const [name] of HOOK_NAMES) {
      const raw = rawHooks[name];
      if (raw && typeof raw === "object" && "enabled" in raw) {
        hooks[name] = { ...hooks[name], ...raw };
      }
    }
  }

  // Session overrides (highest precedence).
  const sessionFile = path.join(root, ".product", ".runtime", "session.json");
  let session = null;
  try {
    session = JSON.parse(readFileSync(sessionFile, "utf8"));
  } catch {
    /* none */
  }
  const overrides = session?.hook_overrides ?? {};
  let sessionActive = 0;
  for (const [name] of HOOK_NAMES) {
    if (overrides[name]) {
      hooks[name] = { ...hooks[name], ...overrides[name] };
      sessionActive += 1;
    }
  }

  console.log("SIFTOS HOOKS");
  console.log("");
  console.log(`Preset: ${preset ?? "not chosen (hooks off)"}`);
  if (!preset) {
    console.log("");
    console.log("Hooks are not enabled yet. Choose a level:");
    console.log("  siftos hooks set advisory | balanced | strict");
  }
  console.log("");
  for (const [name, label] of HOOK_NAMES) {
    const h = hooks[name];
    const mode = h.enforcement && h.enforcement !== "advisory" ? `  Mode: ${h.enforcement}` : "";
    console.log(`${label.padEnd(16)} ${h.enabled ? "ON" : "OFF"}${mode}`);
  }
  if (sessionActive > 0) {
    console.log("");
    console.log(`Session override active: ${sessionActive} hook(s) — expires at session end.`);
  }
}

main();
