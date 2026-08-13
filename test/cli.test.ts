import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tsxLoader = createRequire(import.meta.url).resolve("tsx");

function runCli(args: string[], cwd: string): { code: number; stdout: string; stderr: string } {
  const env = { ...process.env, SIFTOS_TODAY: "2026-08-13" };
  try {
    const stdout = execFileSync(
      process.execPath,
      ["--import", tsxLoader, path.join(root, "src", "cli.ts"), ...args],
      { cwd, env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
    return { code: 0, stdout: stdout.trim(), stderr: "" };
  } catch (err) {
    return {
      code: typeof err.status === "number" ? err.status : 1,
      stdout: (err.stdout ?? "").toString().trim(),
      stderr: (err.stderr ?? "").toString().trim(),
    };
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

beforeAll(() => {
  tmp = mkdtempSync(path.join(os.tmpdir(), "siftos-cli-"));
  mkdirSync(path.join(tmp, ".git"));
});

afterAll(() => {
  rmSync(tmp, { recursive: true, force: true });
});

describe("siftos CLI", () => {
  it("version prints the package version", () => {
    const r = runCli(["version"], tmp);
    expect(r.code).toBe(0);
    expect(r.stdout).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("unknown command prints usage and exits 2", () => {
    const r = runCli(["frobnicate"], tmp);
    expect(r.code).toBe(2);
    expect(r.stdout).toContain("Usage:");
  });

  it("init scaffolds .product/ and doctor reports the pieces", () => {
    const init = runCli(["init"], tmp);
    expect(init.code).toBe(0);
    expect(init.stdout).toContain("SiftOS initialized.");
    expect(existsSync(path.join(tmp, ".product", "PRODUCT.md"))).toBe(true);

    const doctor = runCli(["doctor"], tmp);
    expect(doctor.stdout).toContain(".product directory          ✓");
    expect(doctor.stdout).toContain("PRODUCT.md valid           ✓");
    expect(doctor.stdout).toContain("Status: unhealthy"); // skill not installed yet
  });

  it("doctor reports unhealthy for an empty directory", () => {
    const empty = mkdtempSync(path.join(os.tmpdir(), "siftos-empty-"));
    const r = runCli(["doctor"], empty);
    expect(r.stdout).toContain("Status: unhealthy");
    rmSync(empty, { recursive: true, force: true });
  });

  it("next-id starts at DEC-0001 and advances", () => {
    expect(runCli(["next-id"], tmp).stdout).toBe("DEC-0001");
    writeFileSync(
      path.join(tmp, ".product", "decisions", "DEC-0001-x.md"),
      "---\nid: DEC-0001\ntitle: X\ncreated_at: 2026-01-01\nupdated_at: 2026-01-01\n---\n# Decision\n",
    );
    expect(runCli(["next-id"], tmp).stdout).toBe("DEC-0002");
  });

  it("validate passes a clean decision and fails on schema errors", () => {
    writeFileSync(
      path.join(tmp, ".product", "decisions", "DEC-0042-credit-card.md"),
      FIXTURE_DECISION,
    );
    const ok = runCli(["validate"], tmp);
    expect(ok.code).toBe(0);
    expect(ok.stdout).toContain("decision(s) OK");

    // Broken decision lives in its own repo so it cannot poison later tests.
    const broken = mkdtempSync(path.join(os.tmpdir(), "siftos-broken-"));
    mkdirSync(path.join(broken, ".git"));
    runCli(["init"], broken);
    writeFileSync(
      path.join(broken, ".product", "decisions", "DEC-0009-broken.md"),
      "---\nid: DEC-0009\ntitle: Broken\ncreated_at: 2026/01/01\nupdated_at: 2026-01-01\n---\n# Decision\n",
    );
    const bad = runCli(["validate"], broken);
    expect(bad.code).toBe(1);
    expect(`${bad.stdout}\n${bad.stderr}`).toContain("DEC-0009");
    rmSync(broken, { recursive: true, force: true });
  });

  it("audit renders Decision Health", () => {
    const r = runCli(["audit"], tmp);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("Decision Health");
    expect(r.stdout).toContain("total decisions");
  });

  it("search finds by query and tag filter", () => {
    const byQuery = runCli(["search", "credit card"], tmp);
    expect(byQuery.stdout).toContain("DEC-0042");

    const byTag = runCli(["search", "--tag=onboarding"], tmp);
    expect(byTag.stdout).toContain("DEC-0042");

    const noMatch = runCli(["search", "quantum"], tmp);
    expect(noMatch.stdout).toContain("0 result(s)");
  });

  it("show prints a decision summary", () => {
    const r = runCli(["show", "DEC-0042"], tmp);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("id: DEC-0042");
    expect(r.stdout).toContain("title: Remove mandatory credit card from trial");
    expect(r.stdout).toContain("## Context");
  });

  it("context compiles a package with product files and related decisions", () => {
    const r = runCli(["context", "credit card"], tmp);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('<context source="PRODUCT.md">');
    expect(r.stdout).toContain("Related decision: DEC-0042");
  });

  it("install copies the skill into .agents/skills/siftos/", () => {
    const r = runCli(["install"], tmp);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("SiftOS skill installed");
    expect(existsSync(path.join(tmp, ".agents", "skills", "siftos", "SKILL.md"))).toBe(true);
    expect(
      existsSync(path.join(tmp, ".agents", "skills", "siftos", "references", "linter-rules.md")),
    ).toBe(true);
    expect(
      existsSync(path.join(tmp, ".agents", "skills", "siftos", "scripts", "validate.mjs")),
    ).toBe(true);
    const doctor = runCli(["doctor"], tmp);
    expect(doctor.stdout).toContain("Skill installed            ✓");
    expect(doctor.stdout).toContain("Status: healthy");
  });
});
