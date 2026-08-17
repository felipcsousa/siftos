#!/usr/bin/env node
// SiftOS cross-platform eval runner (PRD §75).
//
// Deterministic workflows (init, show, audit, search, validate, next-id)
// are executed against every fixture and asserted against manifest
// expectations. LLM-dependent workflows (decide, challenge, review) are
// harness-invocable but cannot run offline; the runner reports them as
// MANUAL with the canonical invocation and acceptance checklist.
//
// Usage: node evals/run.mjs   (after `npm run build`; falls back to tsx)
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(readFileSync(path.join(root, "evals", "manifest.json"), "utf8"));
const TODAY = "2026-08-13";

function cliCommand() {
  const dist = path.join(root, "dist", "cli.js");
  if (existsSync(dist)) {
    return { cmd: process.execPath, args: [dist] };
  }
  return { cmd: "npx", args: ["tsx", "src/cli.ts"] };
}

const CLI = cliCommand();

function run(cmd, args, opts = {}) {
  const env = { ...process.env, SIFTOS_TODAY: TODAY, ...(opts.env ?? {}) };
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

function siftos(repoDir, args) {
  return run(CLI.cmd, [...CLI.args, ...args], { cwd: repoDir });
}

function setupFixture(name) {
  const tmp = mkdtempSync(path.join(os.tmpdir(), `siftos-eval-${name}-`));
  run("git", ["init", "-q"], { cwd: tmp });
  const init = siftos(tmp, ["init", "--dir", tmp]);
  if (init.code !== 0) {
    throw new Error(`eval fixture "${name}": siftos init failed: ${init.stderr || init.stdout}`);
  }
  const fixtureDir = path.join(root, "evals", "fixtures", name);
  const decisionsSrc = path.join(fixtureDir, "decisions");
  const decisionsDest = path.join(tmp, ".product", "decisions");
  if (existsSync(decisionsSrc)) {
    for (const f of readdirSync(decisionsSrc).filter((f) => f.endsWith(".md"))) {
      writeFileSync(
        path.join(decisionsDest, f),
        readFileSync(path.join(decisionsSrc, f), "utf8"),
      );
    }
  }
  const m = manifest.fixtures.find((f) => f.name === name);
  if (m?.metricsOverride) {
    writeFileSync(
      path.join(tmp, ".product", "METRICS.md"),
      readFileSync(path.join(root, "evals", "metrics", `${m.metricsOverride}.md`), "utf8"),
    );
  }
  return tmp;
}

function assert(name, actual, expected, report) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  report.push({ name, ok, actual, expected });
  return ok;
}

function collectFindings(stdout) {
  const findings = [];
  for (const line of stdout.split("\n")) {
    const m = line.match(/^DEC-\d{4}\s+(ERROR|WARNING)\s+([a-z-]+):/);
    if (m) findings.push({ severity: m[1], rule: m[2] });
  }
  return findings;
}

/** Counts `DEC-XXXX` decision lines inside a severity block of the audit report. */
function countBlock(stdout, header) {
  const lines = stdout.split("\n");
  let inBlock = false;
  let count = 0;
  for (const line of lines) {
    if (line.trim() === header) {
      inBlock = true;
      continue;
    }
    if (inBlock && line.trim() === "" && count > 0) {
      inBlock = false;
      continue;
    }
    if (inBlock && /^DEC-\d{4}/.test(line.trim())) count += 1;
  }
  return count;
}

function idsFrom(stdout) {
  return stdout
    .split("\n")
    .map((l) => l.split("  ")[0])
    .filter((x) => x.startsWith("DEC-"));
}

function runFixture(f, report) {
  const tmp = setupFixture(f.name);
  const exp = f.expectations;
  const results = [];

  const next = siftos(tmp, ["next-id", "--dir", tmp]);
  results.push(assert(`${f.name}:next-id`, next.stdout, exp.nextId, report));

  const val = siftos(tmp, ["validate", "--dir", tmp]);
  results.push(assert(`${f.name}:validate-exit`, val.code, exp.validateExit, report));
  const findings = collectFindings(val.stdout);
  results.push(
    assert(
      `${f.name}:lint-error-rules`,
      findings.filter((x) => x.severity === "ERROR").map((x) => x.rule).sort(),
      [...exp.lintErrorRules].sort(),
      report,
    ),
  );
  results.push(
    assert(
      `${f.name}:lint-warning-rules`,
      findings.filter((x) => x.severity === "WARNING").map((x) => x.rule).sort(),
      [...exp.lintWarningRules].sort(),
      report,
    ),
  );

  // Skill scripts are standalone (no CLI): results must agree.
  const scriptVal = run(process.execPath, [path.join(root, "skill", "scripts", "validate.mjs")], {
    cwd: tmp,
  });
  results.push(assert(`${f.name}:skill-validate-exit`, scriptVal.code, exp.validateExit, report));

  const audit = siftos(tmp, ["audit", "--dir", tmp]);
  const total = Number((audit.stdout.match(/(\d+) total decisions/) ?? [])[1]);
  results.push(assert(`${f.name}:audit-total`, total, exp.auditTotal, report));
  results.push(assert(`${f.name}:audit-errors`, countBlock(audit.stdout, "CRITICAL"), exp.auditErrors, report));
  if (exp.auditReviewed !== undefined) {
    const reviewed = Number((audit.stdout.match(/(\d+) reviewed/) ?? [])[1]);
    results.push(assert(`${f.name}:audit-reviewed`, reviewed, exp.auditReviewed, report));
  }

  if (exp.searchOnboarding) {
    const s = siftos(tmp, ["search", "onboarding", "--dir", tmp]);
    results.push(assert(`${f.name}:search-onboarding`, idsFrom(s.stdout), exp.searchOnboarding, report));
  }
  if (exp.searchGoal) {
    const s = siftos(tmp, ["search", "--goal=improve-activation", "--dir", tmp]);
    results.push(assert(`${f.name}:search-goal`, idsFrom(s.stdout), exp.searchGoal, report));
  }
  if (exp.searchTag) {
    const s = siftos(tmp, ["search", "--tag=enterprise", "--dir", tmp]);
    results.push(assert(`${f.name}:search-tag`, idsFrom(s.stdout), exp.searchTag, report));
  }
  if (exp.showId) {
    const s = siftos(tmp, ["show", exp.showId, "--dir", tmp]);
    results.push(assert(`${f.name}:show`, s.stdout.includes(`id: ${exp.showId}`), true, report));
  }

  rmSync(tmp, { recursive: true, force: true });
  return results.every(Boolean);
}

const REPORT = [];
let failures = 0;

for (const f of manifest.fixtures) {
  const ok = runFixture(f, REPORT);
  if (!ok) failures += 1;
}

console.log("SiftOS cross-platform eval report");
console.log("");
console.log("Deterministic workflows (single canonical implementation, both harnesses):");
console.log("");
for (const r of REPORT) {
  console.log(
    `${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.ok ? "" : `  (expected ${JSON.stringify(r.expected)}, got ${JSON.stringify(r.actual)})`}`,
  );
}
console.log("");
console.log("                       OpenCode      Codex");
const workflows = ["init", "decide", "challenge", "review", "show", "audit"];
const deterministic = ["init", "show", "audit"];
for (const w of workflows) {
  const status = deterministic.includes(w) ? (failures === 0 ? "PASS" : "CHECK") : "MANUAL";
  console.log(`${w.padEnd(22)} ${status.padEnd(14)} ${status}`);
}
console.log("");
console.log("decide / challenge / review require a live harness + model:");
console.log('  OpenCode:  ask the agent: "/siftos decide <prompt>" (or challenge/review)');
console.log("  Codex:     ask the agent to run the SiftOS decide/challenge/review workflow");
console.log("");
console.log(
  failures === 0
    ? "Status: all deterministic checks passed"
    : `Status: ${failures} fixture(s) failed`,
);

process.exit(failures === 0 ? 0 : 1);
