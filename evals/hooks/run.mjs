#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  classifyLevel,
  classifyToolEffect,
  closeout,
  deterministicShipGate,
  loadRuntime,
  recordMutation,
  saveRuntime,
  startSession,
  startTurn,
} from "../../skill/scripts/hook-lib.mjs";
import { loadAll } from "../../skill/scripts/lib.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const entry = path.join(root, "dist", "entry.js");
if (!existsSync(entry)) { console.error("error: build first (`npm run build`)"); process.exit(2); }

const REPORT = [];
let failures = 0;
function check(name, ok, detail = "") { REPORT.push({ name, ok, detail }); if (!ok) failures += 1; }
function assert(cond, name, detail = "") { check(name, Boolean(cond), detail); }
function assertEq(actual, expected, name) { check(name, actual === expected, `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`); }

function run(args, cwd) {
  const env = { ...process.env, HOME: cwd, SIFTOS_TODAY: "2026-08-13" };
  try {
    const stdout = execFileSync(process.execPath, [entry, ...args], { cwd, env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return { code: 0, stdout: stdout.trim(), stderr: "" };
  } catch (err) {
    return { code: typeof err.status === "number" ? err.status : 1, stdout: (err.stdout ?? "").toString().trim(), stderr: (err.stderr ?? "").toString().trim() };
  }
}

function freshRepo() {
  const dir = mkdtempSync(path.join(os.tmpdir(), "siftos-hooks-"));
  mkdirSync(path.join(dir, ".git"));
  assertEq(run(["init"], dir).code, 0, "fixture: init succeeds");
  return dir;
}
function withRepo(fn) { const dir = freshRepo(); try { fn(dir); } finally { rmSync(dir, { recursive: true, force: true }); } }

function decisionMarkdown(status = "building") {
  return `---
id: DEC-0007
title: Referral experiment
status: ${status}
created_at: 2026-08-13
updated_at: 2026-08-13
goal: improve-activation
---
# Decision
## Context
Users need a referral path.
## Target User
Self-service SMB.
## Expected Outcome
Activation increases materially.
## Primary Metric
Activation rate.
## Guardrails
Paid conversion must not decline.
## Revisit Condition
After 500 users.
## Scope
Referral link only.
## Instrumentation
Track referral_created and activation_completed.
`;
}

withRepo((dir) => {
  const config = JSON.parse(readFileSync(path.join(dir, ".product", "config.json"), "utf8"));
  assert(config.hooks === undefined, "opt-in: init does not enable hooks");
  assertEq(run(["guard", "check", "--level=L3", "src/pricing.ts"], dir).code, 0, "opt-in: manual mode does not gate");
});

withRepo((dir) => {
  const install = run(["install"], dir);
  assertEq(install.code, 0, "install: succeeds");
  assert(existsSync(path.join(dir, ".opencode", "plugins", "siftos.js")), "install: OpenCode plugin exists");
  const codex = JSON.parse(readFileSync(path.join(dir, ".codex", "hooks.json"), "utf8"));
  assert(Boolean(codex.hooks?.UserPromptSubmit), "install: Codex Prompt hook configured");
  assert(Boolean(codex.hooks?.PreCompact), "install: Codex compaction hook configured");
  assert(Boolean(codex.hooks?.Stop), "install: Codex Stop hook configured");
});

withRepo((dir) => {
  run(["hooks", "set", "balanced"], dir);
  const turn = "--turn-id=eval-intent";
  assertEq(run(["guard", "check", turn, "--level=L2", "app/referrals.ts"], dir).code, 1, "guard: first L2 mutation blocked");
  const retry = run(["guard", "check", turn, "--level=L2", "app/referrals.ts"], dir);
  assertEq(retry.code, 1, "guard: retry remains blocked without resolution");
  assert(retry.stdout.includes("still unresolved"), "guard: retry explains unresolved intent");
  assertEq(run(["guard", "check", turn, "--level=L2", "--resolution=shape", "app/referrals.ts"], dir).code, 1, "guard: shape does not authorize production mutation");
  assertEq(run(["guard", "check", turn, "--level=L2", "--resolution=build_anyway", "app/referrals.ts"], dir).code, 0, "guard: explicit build_anyway authorizes");
});

withRepo((dir) => {
  const configPath = path.join(dir, ".product", "config.json");
  const config = JSON.parse(readFileSync(configPath, "utf8"));
  config.hooks = { preset: "balanced", before_mutation: { enforcement: "strict" } };
  writeFileSync(configPath, JSON.stringify(config, null, 2));
  assertEq(run(["hooks"], dir).code, 1, "config parity: CLI rejects malformed per-hook override");
  run(["install"], dir);
  const hook = path.join(dir, ".agents", "skills", "siftos", "scripts", "hook-codex.mjs");
  const out = JSON.parse(execFileSync(process.execPath, [hook, "before_mutation"], {
    cwd: dir, env: { ...process.env, HOME: dir }, encoding: "utf8",
    input: JSON.stringify({ tool_name: "Write", tool_input: { file_path: "src/pricing.ts" } }),
  }));
  assertEq(out.hookSpecificOutput?.permissionDecision, "deny", "config parity: malformed guard config fails closed in Codex");
  assert(String(out.hookSpecificOutput?.permissionDecisionReason ?? "").includes("configuration error"), "config parity: malformed config denial is explicit");
});

withRepo((dir) => {
  let state = startTurn(dir, { turnId: "t1", prompt: "Create an implementation plan" });
  assertEq(classifyLevel(state, "Write", { file_path: "docs/implementation-plan.md" }), "L0", "classifier: implementation plan docs are not L3");
  state = startTurn(dir, { turnId: "t2", prompt: "Fix the team settings page" });
  assertEq(classifyLevel(state, "Write", { file_path: "src/settings.ts" }), "L0", "classifier: routine team settings fix stays technical");
  state = startTurn(dir, { turnId: "t3", prompt: "Add referrals" });
  assertEq(classifyLevel(state, "Write", { file_path: "src/referrals.ts" }), "L2", "classifier: explicit referral capability is L2");
  assertEq(classifyToolEffect("Bash", { command: "npm run build" }), "mutation", "shell: npm run build is a mutation");
  assertEq(classifyToolEffect("Bash", { command: "npm test" }), "verification", "shell: npm test is verification");
});

withRepo((dir) => {
  run(["hooks", "set", "advisory"], dir);
  recordMutation(dir, { toolName: "Read", toolInput: { file_path: "src/a.ts" } });
  assertEq(loadRuntime(dir).mutation.started, false, "after mutation: reads do not pollute footprint");
  recordMutation(dir, { toolName: "Write", toolInput: { file_path: "src/a.ts" } });
  assertEq(loadRuntime(dir).mutation.started, true, "after mutation: writes are recorded");
  const result = closeout(dir);
  assert(result.message.includes("no unique active building Bet"), "OpenCode-style idle closeout reports unattached mutations");
});

withRepo((dir) => {
  run(["hooks", "set", "balanced"], dir);
  writeFileSync(path.join(dir, ".product", "decisions", "DEC-0007-referral.md"), decisionMarkdown("building"));
  const { decisions } = loadAll(dir);
  const decision = decisions.find((item) => item.id === "DEC-0007");
  const automatic = deterministicShipGate(dir, decision);
  const manual = run(["ship", "DEC-0007"], dir);
  assert(manual.stdout.includes(`SHIP GATE: ${automatic.result}`), "ship gate: CLI and standalone runtime agree on result");
  assertEq(automatic.result, "PASS_WITH_WARNINGS", "ship gate fixture: warnings exercise closeout continuation");
  const state = loadRuntime(dir); state.active_bet = "DEC-0007"; state.mutation.started = true; saveRuntime(dir, state);
  const first = closeout(dir);
  assertEq(first.continue, true, "balanced closeout: first warning requests one continuation");
  const second = closeout(dir);
  assertEq(second.continue, false, "balanced closeout: continuation is capped at one");
});

withRepo((dir) => {
  const old = loadRuntime(dir); old.guard = { intent_id: "old", status: "bypassed", level: "L2", resolution: "build_anyway", block_issued: true }; old.turn_id = "old"; saveRuntime(dir, old);
  const fresh = startSession(dir, "session-new");
  assertEq(fresh.session_id, "session-new", "session: harness session id becomes runtime id");
  assertEq(fresh.guard.status, "idle", "session: prior bypass does not cross sessions");
  assertEq(fresh.guard.resolution, null, "session: prior resolution cleared");
});

console.log("SiftOS lifecycle hook eval report\n");
for (const item of REPORT) console.log(`${item.ok ? "PASS" : "FAIL"}  ${item.name}${item.ok || !item.detail ? "" : `  (${item.detail})`}`);
console.log("");
console.log(failures === 0 ? "Status: all lifecycle hook checks passed" : `Status: ${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
