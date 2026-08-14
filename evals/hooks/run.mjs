#!/usr/bin/env node
// SiftOS V2 lifecycle evals. Unlike the previous suite, these assertions
// exercise the shipped entrypoint and adapters, not only the policy helpers.
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const entry = path.join(root, "dist", "entry.js");
if (!existsSync(entry)) {
  console.error("error: build first (`npm run build`)");
  process.exit(2);
}

const REPORT = [];
let failures = 0;
function check(name, ok, detail = "") {
  REPORT.push({ name, ok, detail });
  if (!ok) failures += 1;
}
function assert(cond, name, detail = "") { check(name, Boolean(cond), detail); }
function assertEq(actual, expected, name) { check(name, actual === expected, `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`); }

function run(args, cwd, stdin) {
  const env = { ...process.env, HOME: cwd, SIFTOS_TODAY: "2026-08-13" };
  try {
    const stdout = execFileSync(process.execPath, [entry, ...args], {
      cwd,
      env,
      encoding: "utf8",
      input: stdin,
      stdio: [stdin === undefined ? "ignore" : "pipe", "pipe", "pipe"],
    });
    return { code: 0, stdout: stdout.trim(), stderr: "" };
  } catch (err) {
    return {
      code: typeof err.status === "number" ? err.status : 1,
      stdout: (err.stdout ?? "").toString().trim(),
      stderr: (err.stderr ?? "").toString().trim(),
    };
  }
}

function freshRepo() {
  const dir = mkdtempSync(path.join(os.tmpdir(), "siftos-hooks-"));
  mkdirSync(path.join(dir, ".git"));
  const init = run(["init"], dir);
  assertEq(init.code, 0, "fixture: init succeeds");
  return dir;
}

function withRepo(fn) {
  const dir = freshRepo();
  try { fn(dir); }
  finally { rmSync(dir, { recursive: true, force: true }); }
}

withRepo((dir) => {
  const config = JSON.parse(readFileSync(path.join(dir, ".product", "config.json"), "utf8"));
  assert(config.hooks === undefined, "opt-in: init does not enable hooks");
  const guard = run(["guard", "check", "--level=L3", "src/pricing.ts"], dir);
  assertEq(guard.code, 0, "opt-in: manual mode does not gate");
});

withRepo((dir) => {
  const install = run(["install"], dir);
  assertEq(install.code, 0, "install: succeeds");
  assert(existsSync(path.join(dir, ".opencode", "plugins", "siftos.js")), "install: OpenCode plugin exists");
  assert(existsSync(path.join(dir, ".agents", "skills", "siftos", "adapters", "opencode-plugin.js")), "install: OpenCode implementation exists");
  const codex = JSON.parse(readFileSync(path.join(dir, ".codex", "hooks.json"), "utf8"));
  assert(Boolean(codex.hooks?.UserPromptSubmit), "install: Codex Prompt hook configured");
  assert(Boolean(codex.hooks?.PreCompact), "install: Codex compaction hook configured");
  assert(Boolean(codex.hooks?.Stop), "install: Codex Stop hook configured");
});

withRepo((dir) => {
  run(["hooks", "set", "balanced"], dir);
  const first = run(["guard", "check", "--level=L2", "app/referrals.ts"], dir);
  assertEq(first.code, 1, "guard: first L2 mutation blocked");
  const retry = run(["guard", "check", "--level=L2", "app/referrals.ts"], dir);
  assertEq(retry.code, 1, "guard: retry remains blocked without resolution");
  assert(retry.stdout.includes("still unresolved"), "guard: retry explains unresolved intent");
  const shape = run(["guard", "check", "--level=L2", "--resolution=shape", "app/referrals.ts"], dir);
  assertEq(shape.code, 1, "guard: shape does not authorize production mutation");
  const bypass = run(["guard", "check", "--level=L2", "--resolution=build_anyway", "app/referrals.ts"], dir);
  assertEq(bypass.code, 0, "guard: explicit build_anyway authorizes");
});

withRepo((dir) => {
  const doctor = run(["doctor"], dir);
  assertEq(doctor.code, 1, "doctor: scaffold-only context is unhealthy");
  assert(doctor.stdout.includes("PRODUCT.md ready           ✗"), "doctor: Unknown-only product is not ready");
  assert(doctor.stdout.includes("OpenCode hook plugin       ✗"), "doctor: missing OpenCode plugin is not called installed");
});

withRepo((dir) => {
  run(["install"], dir);
  run(["hooks", "set", "balanced"], dir);
  const hook = path.join(dir, ".agents", "skills", "siftos", "scripts", "hook-codex.mjs");
  const env = { ...process.env, HOME: dir };
  const prompt = JSON.parse(execFileSync(process.execPath, [hook, "prompt_submit"], {
    cwd: dir,
    env,
    encoding: "utf8",
    input: JSON.stringify({ turn_id: "turn-referrals", prompt: "Add referrals" }),
  }));
  assertEq(prompt.hookSpecificOutput?.hookEventName, "UserPromptSubmit", "codex: Prompt hook emits native contract");

  const pre = JSON.parse(execFileSync(process.execPath, [hook, "before_mutation"], {
    cwd: dir,
    env,
    encoding: "utf8",
    input: JSON.stringify({ turn_id: "turn-referrals", tool_name: "Write", tool_input: { file_path: "app/referrals.ts" } }),
  }));
  assertEq(pre.hookSpecificOutput?.permissionDecision, "deny", "codex: PreToolUse denies unresolved L2");
  assert(pre.hookSpecificOutput?.permissionDecisionReason?.includes("unresolved"), "codex: denial includes product reason");
});

console.log("SiftOS lifecycle hook eval report\n");
for (const item of REPORT) {
  console.log(`${item.ok ? "PASS" : "FAIL"}  ${item.name}${item.ok || !item.detail ? "" : `  (${item.detail})`}`);
}
console.log("");
console.log(failures === 0 ? "Status: all lifecycle hook checks passed" : `Status: ${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
