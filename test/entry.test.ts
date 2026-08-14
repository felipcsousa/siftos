import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tsxLoader = createRequire(import.meta.url).resolve("tsx");

function freshRepo(): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), "siftos-entry-"));
  mkdirSync(path.join(dir, ".git"));
  return dir;
}

function runEntry(args: string[], cwd: string, stdin?: string) {
  const env = { ...process.env, HOME: cwd, SIFTOS_TODAY: "2026-08-13" };
  try {
    const stdout = execFileSync(
      process.execPath,
      ["--import", tsxLoader, path.join(repoRoot, "src", "entry.ts"), ...args],
      { cwd, env, encoding: "utf8", input: stdin, stdio: [stdin === undefined ? "ignore" : "pipe", "pipe", "pipe"] },
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

function populateContext(dir: string) {
  writeFileSync(path.join(dir, ".product", "PRODUCT.md"), "# Product\n\nSiftOS gives coding agents product judgment.\n");
  writeFileSync(path.join(dir, ".product", "STRATEGY.md"), "# Strategy\n\nShip truthful, reliable lifecycle integration first.\n");
  writeFileSync(path.join(dir, ".product", "METRICS.md"), "# Metrics\n\nPrimary: useful product interventions per guarded build.\n");
  writeFileSync(path.join(dir, ".product", "PRINCIPLES.md"), "# Principles\n\nNever claim a capability that the runtime cannot execute.\n");
}

describe("hardened SiftOS entrypoint", () => {
  it("treats placeholder-only product context as unhealthy", () => {
    const dir = freshRepo();
    expect(runEntry(["init"], dir).code).toBe(0);
    const doctor = runEntry(["doctor"], dir);
    expect(doctor.code).toBe(1);
    expect(doctor.stdout).toContain("PRODUCT.md ready           ✗");
    expect(doctor.stdout).toContain("Context files that contain only placeholders");
    rmSync(dir, { recursive: true, force: true });
  });

  it("installs real Codex/OpenCode adapters without enabling hooks", () => {
    const dir = freshRepo();
    expect(runEntry(["init"], dir).code).toBe(0);
    const config = JSON.parse(readFileSync(path.join(dir, ".product", "config.json"), "utf8"));
    expect(config.hooks).toBeUndefined();

    const install = runEntry(["install"], dir);
    expect(install.code).toBe(0);
    expect(existsSync(path.join(dir, ".codex", "hooks.json"))).toBe(true);
    expect(existsSync(path.join(dir, ".opencode", "plugins", "siftos.js"))).toBe(true);
    expect(existsSync(path.join(dir, ".agents", "skills", "siftos", "adapters", "opencode-plugin.js"))).toBe(true);
    expect(install.stdout).toContain("Automation remains OFF");

    populateContext(dir);
    const doctor = runEntry(["doctor"], dir);
    expect(doctor.code).toBe(0);
    expect(doctor.stdout).toContain("OpenCode hook plugin       ✓");
    expect(doctor.stdout).toContain("Codex hook adapter         ✓");
    expect(doctor.stdout).toContain("Automation: NOT-CHOSEN");
    expect(doctor.stdout).toContain("Status: healthy");
    rmSync(dir, { recursive: true, force: true });
  });

  it("balanced guard stays blocked until an authorizing resolution exists", () => {
    const dir = freshRepo();
    runEntry(["init"], dir);
    runEntry(["hooks", "set", "balanced"], dir);

    const first = runEntry(["guard", "check", "--level=L2", "app/referrals.ts"], dir);
    expect(first.code).toBe(1);
    expect(first.stdout).toContain("BLOCK");

    const retry = runEntry(["guard", "check", "--level=L2", "app/referrals.ts"], dir);
    expect(retry.code).toBe(1);
    expect(retry.stdout).toContain("still unresolved");

    const shape = runEntry(["guard", "check", "--level=L2", "--resolution=shape", "app/referrals.ts"], dir);
    expect(shape.code).toBe(1);
    expect(shape.stdout).toContain("still unresolved");

    const bypass = runEntry(["guard", "check", "--level=L2", "--resolution=build_anyway", "app/referrals.ts"], dir);
    expect(bypass.code).toBe(0);
    expect(bypass.stdout).toContain("Resolution: build_anyway");
    rmSync(dir, { recursive: true, force: true });
  });

  it("existing_bet requires a real accepted+ decision", () => {
    const dir = freshRepo();
    runEntry(["init"], dir);
    runEntry(["hooks", "set", "balanced"], dir);
    const result = runEntry(["guard", "check", "--level=L2", "--resolution=existing_bet", "app/login.ts"], dir);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("existing_bet requires --decision");
    rmSync(dir, { recursive: true, force: true });
  });

  it("Codex UserPromptSubmit starts a fresh intent so a prior bypass cannot leak", () => {
    const dir = freshRepo();
    runEntry(["init"], dir);
    runEntry(["install"], dir);
    runEntry(["hooks", "set", "balanced"], dir);

    expect(runEntry(["guard", "check", "--level=L2", "--resolution=build_anyway", "app/referrals.ts"], dir).code).toBe(0);

    const hook = path.join(dir, ".agents", "skills", "siftos", "scripts", "hook-codex.mjs");
    const env = { ...process.env, HOME: dir };
    const promptOut = execFileSync(process.execPath, [hook, "prompt_submit"], {
      cwd: dir,
      env,
      encoding: "utf8",
      input: JSON.stringify({ turn_id: "turn-2", prompt: "Add referrals" }),
    });
    expect(JSON.parse(promptOut).hookSpecificOutput.hookEventName).toBe("UserPromptSubmit");

    const preOut = execFileSync(process.execPath, [hook, "before_mutation"], {
      cwd: dir,
      env,
      encoding: "utf8",
      input: JSON.stringify({ turn_id: "turn-2", tool_name: "Write", tool_input: { file_path: "app/referrals.ts" } }),
    });
    const parsed = JSON.parse(preOut);
    expect(parsed.hookSpecificOutput.permissionDecision).toBe("deny");
    expect(parsed.hookSpecificOutput.permissionDecisionReason).toContain("unresolved");
    rmSync(dir, { recursive: true, force: true });
  });
});
