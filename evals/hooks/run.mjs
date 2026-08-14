#!/usr/bin/env node
// SiftOS V2 hook eval suite (PRD V2 §140–§148).
//
// Deterministic-only: configuration, presets, disabled hooks, session
// overrides, Product Guard verdicts, Ship Gate, and scope drift run
// against the built CLI. Cross-platform parity is by construction: the
// deterministic core is single-implementation and both harnesses consume
// the same config semantics (PRD V2 §148).
//
// Usage: node evals/hooks/run.mjs   (after `npm run build`)
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const dist = path.join(root, "dist", "cli.js");
const CLI = existsSync(dist)
  ? { cmd: process.execPath, args: [dist] }
  : { cmd: "npx", args: ["tsx", "src/cli.ts"] };

function run(cmd, args, opts = {}) {
  const env = { ...process.env, SIFTOS_TODAY: "2026-08-13", ...(opts.env ?? {}) };
  try {
    const stdout = execFileSync(cmd, args, {
      cwd: opts.cwd,
      env,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
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

function siftos(dir, args) {
  return run(CLI.cmd, [...CLI.args, ...args], { cwd: dir });
}

function freshRepo() {
  const tmp = mkdtempSync(path.join(os.tmpdir(), "siftos-hooks-"));
  run("git", ["init", "-q"], { cwd: tmp });
  siftos(tmp, ["init"]);
  return tmp;
}

const REPORT = [];
let failures = 0;

function check(name, ok, detail) {
  REPORT.push({ name, ok, detail });
  if (!ok) failures += 1;
}

function assertEq(actual, expected, label) {
  const ok = actual === expected;
  check(label, ok, `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  return ok;
}

function assert(cond, label, detail = "") {
  check(label, Boolean(cond), detail);
  return Boolean(cond);
}

const SCOPE_FIXTURE = `---
id: DEC-0001
title: Referrals
status: building
created_at: 2026-08-13
updated_at: 2026-08-13
---
# Decision

## Scope

- referral link
- invite flow
`;

const GUARD_DISABLED = "SIFTOS GUARD: before_mutation is disabled (PRD V2 §31).";

// ─── Cases ────────────────────────────────────────────────────────────────

function presetOff() {
  const tmp = freshRepo();
  siftos(tmp, ["hooks", "set", "off"]);
  const g = siftos(tmp, ["guard", "check", "app/referrals.ts"]);
  assertEq(g.stdout, GUARD_DISABLED, "preset-off: guard disabled");
  const v = siftos(tmp, ["validate"]);
  assertEq(v.code, 0, "preset-off: manual validate still works");
  rmSync(tmp, { recursive: true, force: true });
}

function balancedGatesL2() {
  const tmp = freshRepo();
  siftos(tmp, ["hooks", "set", "balanced"]);
  const g = siftos(tmp, ["guard", "check", "--level=L2", "app/referrals.ts"]);
  assertEq(g.code, 1, "balanced: L2 blocked");
  assert(g.stdout.includes("BLOCK_ONCE"), "balanced: BLOCK_ONCE verdict");
  const again = siftos(tmp, ["guard", "check", "--level=L2", "app/referrals.ts"]);
  assertEq(again.code, 0, "balanced: block-once lets the second call through");
  const l0 = siftos(tmp, ["guard", "check", "--level=L0", "test/foo.test.ts"]);
  assertEq(l0.code, 0, "balanced: L0 technical work uninterrupted");
  rmSync(tmp, { recursive: true, force: true });
}

function strictHardGates() {
  const tmp = freshRepo();
  siftos(tmp, ["hooks", "set", "strict"]);
  const g = siftos(tmp, ["guard", "check", "--level=L3", "src/pricing.ts"]);
  assertEq(g.code, 1, "strict: L3 blocked");
  assert(g.stdout.includes("REQUIRE_RESOLUTION"), "strict: REQUIRE_RESOLUTION");
  const again = siftos(tmp, ["guard", "check", "--level=L3", "src/pricing.ts"]);
  assertEq(again.code, 1, "strict: re-blocks (no block-once)");
  const unk = siftos(tmp, ["guard", "check"]);
  assertEq(unk.code, 1, "strict: unknown mutation requires resolution");
  rmSync(tmp, { recursive: true, force: true });
}

function advisoryNeverBlocks() {
  const tmp = freshRepo();
  siftos(tmp, ["hooks", "set", "advisory"]);
  const g = siftos(tmp, ["guard", "check", "--level=L3", "src/pricing.ts"]);
  assertEq(g.code, 0, "advisory: L3 allowed");
  assert(g.stdout.includes("ALLOW"), "advisory: ALLOW verdict");
  rmSync(tmp, { recursive: true, force: true });
}

function disabledHookNeverEnforces() {
  const tmp = freshRepo();
  siftos(tmp, ["hooks", "set", "balanced"]);
  siftos(tmp, ["hook", "disable", "before-mutation"]);
  const g = siftos(tmp, ["guard", "check", "--level=L3", "src/pricing.ts"]);
  assertEq(g.stdout, GUARD_DISABLED, "disabled hook: no gate, no latency beyond config");
  const h = siftos(tmp, ["hooks"]);
  assert(h.stdout.includes("Preset: custom"), "disabled hook: preset converts to custom");
  rmSync(tmp, { recursive: true, force: true });
}

function resolutionAllowsCurrentCall() {
  const tmp = freshRepo();
  siftos(tmp, ["hooks", "set", "strict"]);
  const blocked = siftos(tmp, ["guard", "check", "--level=L3", "src/pricing.ts"]);
  assertEq(blocked.code, 1, "resolution: initial L3 blocked");
  const resolved = siftos(tmp, [
    "guard",
    "check",
    "--level=L3",
    "--resolution=build_anyway",
    "src/pricing.ts",
  ]);
  assertEq(resolved.code, 0, "resolution: --resolution allows the current call");
  assert(resolved.stdout.includes("ALLOW"), "resolution: verdict ALLOW");
  const next = siftos(tmp, ["guard", "check", "--level=L3", "src/pricing.ts"]);
  assertEq(next.code, 1, "resolution: next mutation re-gates (block cleared)");
  rmSync(tmp, { recursive: true, force: true });
}

function sessionEnforcementReplaces() {
  const tmp = freshRepo();
  siftos(tmp, ["hooks", "set", "balanced"]);
  siftos(tmp, ["hooks", "set", "strict", "--session"]);
  const g = siftos(tmp, ["guard", "check", "--level=L3", "src/pricing.ts"]);
  assertEq(g.code, 1, "session strict: L3 blocked");
  assert(g.stdout.includes("REQUIRE_RESOLUTION"), "session strict: enforcement replaced");
  siftos(tmp, ["hooks", "set", "off", "--session"]);
  const off = siftos(tmp, ["guard", "check", "--level=L3", "src/pricing.ts"]);
  assertEq(off.stdout, GUARD_DISABLED, "session off: guard disabled under strict repo");
  rmSync(tmp, { recursive: true, force: true });
}

function sessionOverride() {
  const tmp = freshRepo();
  siftos(tmp, ["hooks", "set", "balanced"]);
  siftos(tmp, ["hooks", "set", "off", "--session"]);
  const g = siftos(tmp, ["guard", "check", "--level=L2", "app/referrals.ts"]);
  assertEq(g.stdout, GUARD_DISABLED, "session override: hooks off for this session");
  const config = JSON.parse(
    readFileSync(path.join(tmp, ".product", "config.json"), "utf8"),
  );
  assertEq(config.hooks.preset, "balanced", "session override: repository config unchanged");
  const h = siftos(tmp, ["hooks"]);
  assert(h.stdout.includes("Session override active"), "session override: visible in hooks");
  rmSync(tmp, { recursive: true, force: true });
}

function shipGate() {
  const tmp = freshRepo();
  const fixture = path.join(
    root,
    "evals",
    "fixtures",
    "remove-credit-card-trial",
    "decisions",
    "DEC-0042-remove-credit-card.md",
  );
  writeFileSync(
    path.join(tmp, ".product", "decisions", "DEC-0042-credit.md"),
    readFileSync(fixture, "utf8"),
  );
  const ship = siftos(tmp, ["ship", "DEC-0042"]);
  assert(ship.stdout.includes("SHIP GATE:"), "ship: gate runs on accepted+");
  assert(ship.stdout.includes("PASS_WITH_WARNINGS"), "ship: fixture is PASS_WITH_WARNINGS");
  writeFileSync(
    path.join(tmp, ".product", "decisions", "DEC-0001-draft.md"),
    "---\nid: DEC-0001\ntitle: Idea\nstatus: draft\ncreated_at: 2026-08-13\nupdated_at: 2026-08-13\n---\n# Decision\n",
  );
  const draft = siftos(tmp, ["ship", "DEC-0001"]);
  assert(draft.stdout.includes("NOT_REQUIRED"), "ship: pre-accepted is NOT_REQUIRED");
  rmSync(tmp, { recursive: true, force: true });
}

function scopeDrift() {
  const tmp = freshRepo();
  writeFileSync(path.join(tmp, ".product", "decisions", "DEC-0001-ref.md"), SCOPE_FIXTURE);
  const drift = siftos(tmp, ["scope", "DEC-0001", "app/export.ts"]);
  assertEq(drift.code, 1, "scope: drift exits 1");
  assert(drift.stdout.includes("SCOPE DRIFT"), "scope: drift detected");
  const ok = siftos(tmp, ["scope", "DEC-0001", "src/invite.ts"]);
  assertEq(ok.code, 0, "scope: in-scope file clean");
  rmSync(tmp, { recursive: true, force: true });
}

function manualFirstClass() {
  const tmp = freshRepo();
  siftos(tmp, ["hooks", "set", "off"]);
  const next = siftos(tmp, ["next-id"]);
  assertEq(next.stdout, "DEC-0001", "manual: next-id works with hooks off");
  const audit = siftos(tmp, ["audit"]);
  assertEq(audit.code, 0, "manual: audit works with hooks off");
  rmSync(tmp, { recursive: true, force: true });
}

// ─── Runner ───────────────────────────────────────────────────────────────

const CASES = [
  ["preset-off", presetOff],
  ["balanced-gates-L2", balancedGatesL2],
  ["strict-hard-gates", strictHardGates],
  ["advisory-never-blocks", advisoryNeverBlocks],
  ["disabled-hook", disabledHookNeverEnforces],
  ["resolution", resolutionAllowsCurrentCall],
  ["session-enforcement", sessionEnforcementReplaces],
  ["session-override", sessionOverride],
  ["ship-gate", shipGate],
  ["scope-drift", scopeDrift],
  ["manual-first-class", manualFirstClass],
];

for (const [name, fn] of CASES) {
  try {
    fn();
  } catch (err) {
    check(`${name}:runner`, false, err.message);
  }
}

console.log("SiftOS V2 hook eval report");
console.log("");
for (const r of REPORT) {
  console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.ok ? "" : `  (${r.detail})`}`);
}
console.log("");
console.log(
  failures === 0
    ? "Status: all deterministic hook checks passed"
    : `Status: ${failures} check(s) failed`,
);
process.exit(failures === 0 ? 0 : 1);
