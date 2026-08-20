import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tsxLoader = createRequire(import.meta.url).resolve("tsx");

function runCli(args: string[], cwd: string): { code: number; stdout: string; stderr: string } {
  const env = { ...process.env, HOME: cwd, DSH_HOME: path.join(cwd, ".dsh"), SIFTOS_TODAY: "2026-08-13" };
  try {
    const stdout = execFileSync(process.execPath, ["--import", tsxLoader, path.join(root, "src", "cli.ts"), ...args], {
      cwd, env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
    });
    return { code: 0, stdout: stdout.trim(), stderr: "" };
  } catch (err) {
    return { code: typeof err.status === "number" ? err.status : 1, stdout: (err.stdout ?? "").toString().trim(), stderr: (err.stderr ?? "").toString().trim() };
  }
}

const FIXTURE_DECISION = `---
id: DEC-0042
title: Remove mandatory credit card from trial
status: accepted
created_at: 2026-08-13
updated_at: 2026-08-13
tags:
  - onboarding
goal: improve-activation
confidence: medium
review_date: 2026-09-13
---

# Decision

## Context

Signup requires a credit card.

## Options Considered

- A. Keep mandatory card.
- B. Make card optional.
- C. Controlled experiment.

## Facts

- 38% of users abandon at the payment step.

## Evidence

- Claim: 38% abandonment | Source: Amplitude | Date: 2026-08-10

## Assumptions

- Abuse remains manageable.

## Primary Metric

- Activation rate.

## Expected Outcome

- Activation: 24% → 30–34%.
- Guardrail: trial-to-paid decline < 3pp.

## Strongest Argument Against

- Lower trial quality.

## Final Human Decision

- Run a 50/50 experiment.

## Revisit Condition

- After 500 trials or 30 days.
`;

let tmp: string;
let fixtureTmp: string;
beforeAll(() => {
  tmp = mkdtempSync(path.join(os.tmpdir(), "siftos-cli-")); mkdirSync(path.join(tmp, ".git"));
  // Independent fixture repo for search/show/context: those tests must not
  // depend on the validate test having written DEC-0042 into tmp first.
  fixtureTmp = mkdtempSync(path.join(os.tmpdir(), "siftos-cli-fixture-")); mkdirSync(path.join(fixtureTmp, ".git"));
  runCli(["init"], fixtureTmp);
  writeFileSync(path.join(fixtureTmp, ".product", "decisions", "DEC-0042-credit-card.md"), FIXTURE_DECISION);
});
afterAll(() => { rmSync(tmp, { recursive: true, force: true }); rmSync(fixtureTmp, { recursive: true, force: true }); });

describe("siftos CLI", () => {
  it("version prints the package version", () => {
    const result = runCli(["version"], tmp);
    expect(result.code).toBe(0); expect(result.stdout).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("unknown command prints usage and exits 2", () => {
    const result = runCli(["frobnicate"], tmp);
    expect(result.code).toBe(2); expect(result.stdout).toContain("Usage:");
  });

  it("init scaffolds .product/ and doctor rejects placeholder-only context", () => {
    const init = runCli(["init"], tmp);
    expect(init.code).toBe(0); expect(init.stdout).toContain("SiftOS initialized.");
    expect(existsSync(path.join(tmp, ".product", "PRODUCT.md"))).toBe(true);
    const doctor = runCli(["doctor"], tmp);
    expect(doctor.stdout).toContain(".product directory          ✓");
    expect(doctor.stdout).toContain("PRODUCT.md ready           ✗");
    expect(doctor.stdout).toContain("Status: unhealthy");
  });

  it("doctor reports unhealthy for an empty directory", () => {
    const empty = mkdtempSync(path.join(os.tmpdir(), "siftos-empty-"));
    expect(runCli(["doctor"], empty).stdout).toContain("Status: unhealthy");
    rmSync(empty, { recursive: true, force: true });
  });

  it("next-id starts at DEC-0001 and advances", () => {
    // Isolated repo: next-id must not depend on decisions written by other
    // tests into the shared tmp dir.
    const fresh = mkdtempSync(path.join(os.tmpdir(), "siftos-nextid-")); mkdirSync(path.join(fresh, ".git")); runCli(["init"], fresh);
    expect(runCli(["next-id"], fresh).stdout).toBe("DEC-0001");
    writeFileSync(path.join(fresh, ".product", "decisions", "DEC-0001-x.md"), "---\nid: DEC-0001\ntitle: X\ncreated_at: 2026-01-01\nupdated_at: 2026-01-01\n---\n# Decision\n");
    expect(runCli(["next-id"], fresh).stdout).toBe("DEC-0002");
    rmSync(fresh, { recursive: true, force: true });
  });

  it("validate passes a clean decision and fails on schema errors", () => {
    writeFileSync(path.join(tmp, ".product", "decisions", "DEC-0042-credit-card.md"), FIXTURE_DECISION);
    const ok = runCli(["validate"], tmp);
    expect(ok.code).toBe(0); expect(ok.stdout).toContain("decision(s) OK");
    const broken = mkdtempSync(path.join(os.tmpdir(), "siftos-broken-")); mkdirSync(path.join(broken, ".git")); runCli(["init"], broken);
    writeFileSync(path.join(broken, ".product", "decisions", "DEC-0009-broken.md"), "---\nid: DEC-0009\ntitle: Broken\ncreated_at: 2026/01/01\nupdated_at: 2026-01-01\n---\n# Decision\n");
    const bad = runCli(["validate"], broken);
    expect(bad.code).toBe(1); expect(`${bad.stdout}\n${bad.stderr}`).toContain("DEC-0009");
    rmSync(broken, { recursive: true, force: true });
  });

  it("validate fails on duplicate decision ids", () => {
    const dup = mkdtempSync(path.join(os.tmpdir(), "siftos-dup-")); mkdirSync(path.join(dup, ".git")); runCli(["init"], dup);
    const body = "---\nid: DEC-0001\ntitle: A\ncreated_at: 2026-01-01\nupdated_at: 2026-01-01\n---\n# Decision\n";
    writeFileSync(path.join(dup, ".product", "decisions", "DEC-0001-a.md"), body);
    writeFileSync(path.join(dup, ".product", "decisions", "DEC-0001-b.md"), body);
    const result = runCli(["validate"], dup);
    expect(result.code).toBe(1); expect(`${result.stdout}\n${result.stderr}`).toContain("duplicate");
    rmSync(dup, { recursive: true, force: true });
  });

  it("audit renders Decision Health", () => {
    const result = runCli(["audit"], tmp);
    expect(result.code).toBe(0); expect(result.stdout).toContain("Decision Health"); expect(result.stdout).toContain("total decisions");
  });

  it("search finds by query and tag filter", () => {
    expect(runCli(["search", "credit card"], fixtureTmp).stdout).toContain("DEC-0042");
    expect(runCli(["search", "--tag=onboarding"], fixtureTmp).stdout).toContain("DEC-0042");
    expect(runCli(["search", "quantum"], fixtureTmp).stdout).toContain("0 result(s)");
  });

  it("show prints a decision summary", () => {
    const result = runCli(["show", "DEC-0042"], fixtureTmp);
    expect(result.code).toBe(0); expect(result.stdout).toContain("id: DEC-0042"); expect(result.stdout).toContain("## Context");
  });

  it("context compiles a package with product files and related decisions", () => {
    const result = runCli(["context", "credit card"], fixtureTmp);
    expect(result.code).toBe(0); expect(result.stdout).toContain('<context source="PRODUCT.md">'); expect(result.stdout).toContain("Related decision: DEC-0042");
  });

  it("install copies the skill and real adapters without pretending context is healthy", () => {
    const result = runCli(["install"], tmp);
    expect(result.code).toBe(0); expect(result.stdout).toContain("SiftOS skill installed");
    expect(existsSync(path.join(tmp, ".agents", "skills", "siftos", "SKILL.md"))).toBe(true);
    expect(existsSync(path.join(tmp, ".agents", "skills", "siftos", "references", "linter-rules.md"))).toBe(true);
    expect(existsSync(path.join(tmp, ".agents", "skills", "siftos", "scripts", "validate.mjs"))).toBe(true);
    expect(existsSync(path.join(tmp, ".opencode", "plugins", "siftos.js"))).toBe(true);
    expect(existsSync(path.join(tmp, ".dsh", "plugins", "siftos", "index.js"))).toBe(true);
    expect(existsSync(path.join(tmp, ".dsh", "plugins", "siftos", "scripts", "hook-lib.mjs"))).toBe(true);
    expect(existsSync(path.join(tmp, ".dsh", "plugins", "siftos", "scripts", "lib.mjs"))).toBe(true);
    expect(existsSync(path.join(tmp, ".dsh", "plugins", "siftos", "scripts", "policy.json"))).toBe(true);
    const patch = readFileSync(path.join(tmp, ".dsh", "cordis.patch.yml"), "utf8");
    expect(patch).toContain("BEGIN Siftos");
    expect(patch).toContain("./plugins/siftos/index.js");
    const deployed = readFileSync(path.join(tmp, ".dsh", "plugins", "siftos", "index.js"), "utf8");
    expect(deployed).toContain('"./scripts/hook-lib.mjs"');
    expect(deployed).not.toContain('"../scripts/hook-lib.mjs"');
    const doctor = runCli(["doctor"], tmp);
    expect(doctor.stdout).toContain("Skill installed            ✓");
    expect(doctor.stdout).toContain("DeepSeek Harness skill     ✓");
    expect(doctor.stdout).toContain("DeepSeek Harness hook plugin ✓");
    expect(doctor.stdout).toContain("Status: unhealthy");
  });

  it("install preserves unrelated cordis.patch.yml rows and never duplicates the SiftOS block", () => {
    const fresh = mkdtempSync(path.join(os.tmpdir(), "siftos-dsh-patch-")); mkdirSync(path.join(fresh, ".git"));
    const dshHome = path.join(fresh, ".dsh"); mkdirSync(dshHome, { recursive: true });
    writeFileSync(path.join(dshHome, "cordis.patch.yml"), "- insert:\n    - id: timer\n      name: '@deepseek-ai/cordis-plugin-timer'\n");
    expect(runCli(["install"], fresh).code).toBe(0);
    const first = readFileSync(path.join(dshHome, "cordis.patch.yml"), "utf8");
    expect(first).toContain("id: timer");
    expect(first).toContain("BEGIN Siftos");
    expect(runCli(["install"], fresh).code).toBe(0);
    const second = readFileSync(path.join(dshHome, "cordis.patch.yml"), "utf8");
    expect(second).toContain("id: timer");
    expect(second.match(/BEGIN Siftos/g)?.length).toBe(1);
    expect(second.match(/id: siftos/g)?.length).toBe(1);
    rmSync(fresh, { recursive: true, force: true });
  });

  it("install leaves a manual SiftOS row without markers untouched (no duplicate)", () => {
    const fresh = mkdtempSync(path.join(os.tmpdir(), "siftos-dsh-manual-")); mkdirSync(path.join(fresh, ".git"));
    const dshHome = path.join(fresh, ".dsh"); mkdirSync(dshHome, { recursive: true });
    const original = "- insert:\n    - id: siftos\n      name: './plugins/siftos/index.js'\n";
    writeFileSync(path.join(dshHome, "cordis.patch.yml"), original);
    expect(runCli(["install"], fresh).code).toBe(0);
    expect(readFileSync(path.join(dshHome, "cordis.patch.yml"), "utf8")).toBe(original);
    rmSync(fresh, { recursive: true, force: true });
  });

  it("doctor does not report the dsh adapter from comments or marker shells", () => {
    const fresh = mkdtempSync(path.join(os.tmpdir(), "siftos-dsh-shell-")); mkdirSync(path.join(fresh, ".git"));
    const dshHome = path.join(fresh, ".dsh");
    mkdirSync(path.join(dshHome, "plugins", "siftos"), { recursive: true });
    writeFileSync(path.join(dshHome, "plugins", "siftos", "index.js"), "// placeholder\n");
    writeFileSync(path.join(dshHome, "cordis.patch.yml"), "# BEGIN Siftos\n# - insert:\n#     - id: siftos\n#       name: './plugins/siftos/index.js'\n# END Siftos\n");
    const doctor = runCli(["doctor"], fresh);
    expect(doctor.stdout).toContain("DeepSeek Harness hook plugin ✗");
    rmSync(fresh, { recursive: true, force: true });
  });

  it("install refuses an unmanaged id: siftos in cordis.patch.yml and leaves the file intact", () => {
    const fresh = mkdtempSync(path.join(os.tmpdir(), "siftos-dsh-unmanaged-")); mkdirSync(path.join(fresh, ".git"));
    const dshHome = path.join(fresh, ".dsh"); mkdirSync(dshHome, { recursive: true });
    const original = "- insert:\n    - id: siftos\n      name: './elsewhere/plugin.js'\n";
    writeFileSync(path.join(dshHome, "cordis.patch.yml"), original);
    const result = runCli(["install"], fresh);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("refusing to overwrite user configuration");
    expect(readFileSync(path.join(dshHome, "cordis.patch.yml"), "utf8")).toBe(original);
    rmSync(fresh, { recursive: true, force: true });
  });
});
