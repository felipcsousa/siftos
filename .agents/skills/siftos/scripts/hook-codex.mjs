#!/usr/bin/env node
// SiftOS Codex hook adapter (PRD V2 §29, draft). Maps logical hooks to
// Codex hook events; reads the tool event from stdin (JSON per the Codex
// hook contract), runs the deterministic classifier, and applies the
// deterministic gate. No LLM here — script hooks use the deterministic
// fallback (PRD V2 §106 NFR-003, D3 decision).
//
// Blocking surface: PreToolUse events print a BLOCK-style decision when
// the gate requires resolution. Fail-open is the default; strict
// before_mutation is fail-closed. Never fails silently (PRD V2 §104).
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync, renameSync } from "node:fs";
import path from "node:path";
import { findProductRoot } from "./lib.mjs";

const HOOK_ARG = process.argv[2] ?? "";
const LOGICAL = {
  session_start: "session_start",
  prompt_submit: "prompt_submit",
  before_mutation: "before_mutation",
  after_mutation: "after_mutation",
  turn_stop: "turn_stop",
};

const L3 = /pricing|billing|subscription|\bplans?\b|paywall|\bicp\b|account model|marketplace|payment|stripe/i;
const L2 = /referral|invite|export|notification|oauth|login|integration|onboard|permission/i;
const L1 = /\bcopy\b|\bcta\b|label|tooltip|\.css|spacing|button text/i;

function classify(files) {
  const joined = files.join(" ").toLowerCase();
  if (L3.test(joined)) return "L3";
  if (L2.test(joined)) return "L2";
  if (L1.test(joined)) return "L1";
  return files.length === 0 ? "UNKNOWN" : "L0";
}

function verdict(level, enforcement) {
  if (enforcement === "off" || enforcement === "advisory") return "ALLOW";
  if (enforcement === "strict") {
    if (level === "L0") return "ALLOW";
    if (level === "L1") return "ADVISE";
    return "REQUIRE_RESOLUTION";
  }
  // balanced
  if (level === "L2" || level === "L3") return "BLOCK_ONCE";
  return "ALLOW";
}

function loadConfig(root) {
  try {
    return JSON.parse(readFileSync(path.join(root, ".product", "config.json"), "utf8"));
  } catch {
    return {};
  }
}

function runtime(root) {
  const file = path.join(root, ".product", ".runtime", "session.json");
  if (!existsSync(file)) return { hook_overrides: {}, guard: { block_issued: false } };
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return { hook_overrides: {}, guard: { block_issued: false } };
  }
}

function saveRuntime(root, state) {
  const dir = path.join(root, ".product", ".runtime");
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "session.json");
  const tmp = path.join(dir, `.session.json.tmp-${process.pid}`);
  writeFileSync(tmp, JSON.stringify(state, null, 2) + "\n");
  try {
    renameSync(tmp, file);
  } catch (err) {
    rmSync(tmp, { force: true });
    throw err;
  }
}

function main() {
  const root = findProductRoot(process.cwd());
  if (!root) {
    console.error("error: no .product/ found in this directory tree");
    process.exit(1);
  }
  const config = loadConfig(root);
  const rawHooks = config.hooks ?? null;
  if (!rawHooks || rawHooks.preset === "off") {
    console.log("SiftOS hook: disabled");
    process.exit(0);
  }
  const hookName = LOGICAL[HOOK_ARG];
  if (!hookName) {
    console.error(`error: unknown hook event "${HOOK_ARG}"`);
    process.exit(1);
  }
  const state = runtime(root);

  // Effective enabled flag (preset + per-hook + session override).
  const presets = {
    advisory: { before_mutation: "advisory", turn_stop: "advisory" },
    balanced: { before_mutation: "balanced", turn_stop: "advisory" },
    strict: { before_mutation: "strict", turn_stop: "strict" },
  };
  const spec = presets[rawHooks.preset] ?? {};
  const raw = rawHooks[hookName] ?? {};
  const sessionOv = state.hook_overrides?.[hookName] ?? {};
  const enabled = sessionOv.enabled ?? raw.enabled ?? (rawHooks.preset === "custom" ? false : rawHooks.preset !== "off");
  if (!enabled) {
    console.log(`SiftOS hook ${hookName}: disabled`);
    process.exit(0);
  }
  const enforcement = sessionOv.enforcement ?? raw.enforcement ?? spec[hookName] ?? "advisory";
  const failurePolicy = raw.failure_policy ?? (rawHooks.preset === "strict" && hookName === "before_mutation" ? "fail_closed" : "fail_open");

  if (hookName !== "before_mutation" && hookName !== "after_mutation") {
    state.heartbeat = state.heartbeat ?? {};
    state.heartbeat[hookName] = new Date().toISOString();
    saveRuntime(root, state);
    console.log(`SiftOS hook ${hookName}: observed`);
    process.exit(0);
  }

  // Read the tool event from stdin (Codex hook contract: tool_name,
  // tool_input) or fall back to argv paths.
  let event = {};
  try {
    event = JSON.parse(readFileSync(0, "utf8") || "{}");
  } catch {
    event = {};
  }
  const input = event.tool_input ?? {};
  const files = Object.values(input).flatMap((v) =>
    typeof v === "string" ? [v] : Array.isArray(v) ? v : [],
  );

  if (hookName === "after_mutation") {
    state.mutation = state.mutation ?? { files: [] };
    state.mutation.files = files;
    state.heartbeat = state.heartbeat ?? {};
    state.heartbeat[hookName] = new Date().toISOString();
    saveRuntime(root, state);
    console.log(`SiftOS hook after_mutation: footprint ${files.length} file(s)`);
    process.exit(0);
  }

  // before_mutation
  try {
    const level = classify(files);
    let v = verdict(level, enforcement);
    if (v === "BLOCK_ONCE" && state.guard?.block_issued) v = "ALLOW";
    if (v === "BLOCK_ONCE") {
      state.guard = state.guard ?? {};
      state.guard.block_issued = true;
    }
    state.guard = state.guard ?? {};
    state.guard.level = level;
    state.heartbeat = state.heartbeat ?? {};
    state.heartbeat[hookName] = new Date().toISOString();
    saveRuntime(root, state);
    console.log(`SiftOS Guard: level ${level}, verdict ${v}`);
    if (v === "BLOCK_ONCE" || v === "REQUIRE_RESOLUTION") {
      console.log("Resolve: shape / validate / prototype / existing_bet / reconsider / build_anyway");
      process.exit(2);
    }
    process.exit(0);
  } catch (err) {
    if (failurePolicy === "fail_closed") {
      console.error(`SiftOS Guard error (fail_closed): ${err.message}`);
      process.exit(2);
    }
    console.log(`SiftOS Guard error (fail_open): ${err.message}`);
    process.exit(0);
  }
}

main();
