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

function runEntry(args: string[], cwd: string) {
  const env = { ...process.env, HOME: cwd, SIFTOS_TODAY: "2026-08-13" };
  try {
    const stdout = execFileSync(process.execPath, ["--import", tsxLoader, path.join(repoRoot, "src", "entry.ts"), ...args], {
      cwd, env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
    });
    return { code: 0, stdout: stdout.trim(), stderr: "" };
  } catch (err) {
    return { code: typeof err.status === "number" ? err.status : 1, stdout: (err.stdout ?? "").toString().trim(), stderr: (err.stderr ?? "").toString().trim() };
  }
}

function populateContext(dir: string) {
  writeFileSync(path.join(dir, ".product", "PRODUCT.md"), "# Product\n\nSiftOS gives coding agents product judgment.\n");
  writeFileSync(path.join(dir, ".product", "STRATEGY.md"), "# Strategy\n\nShip truthful, reliable lifecycle integration first.\n");
  writeFileSync(path.join(dir, ".product", "METRICS.md"), "# Metrics\n\nPrimary: useful product interventions per guarded build.\n");
  writeFileSync(path.join(dir, ".product", "PRINCIPLES.md"), "# Principles\n\nNever claim a capability the runtime cannot execute.\n");
}

describe("canonical SiftOS entrypoint", () => {
  it("treats placeholder-only product context as unhealthy", () => {
    const dir = freshRepo(); runEntry(["init"], dir);
    const doctor = runEntry(["doctor"], dir);
    expect(doctor.code).toBe(1);
    expect(doctor.stdout).toContain("PRODUCT.md ready           ✗");
    rmSync(dir, { recursive: true, force: true });
  });

  it("manual-only repositories can be healthy without lifecycle adapters", () => {
    const dir = freshRepo(); runEntry(["init"], dir); runEntry(["install"], dir);
    populateContext(dir);
    rmSync(path.join(dir, ".codex"), { recursive: true, force: true });
    rmSync(path.join(dir, ".opencode"), { recursive: true, force: true });
    const doctor = runEntry(["doctor"], dir);
    expect(doctor.code).toBe(0);
    expect(doctor.stdout).toContain("Automation: NOT-CHOSEN (off)");
    expect(doctor.stdout).toContain("Status: healthy");
    rmSync(dir, { recursive: true, force: true });
  });

  it("installs real adapters without enabling hooks and preserves existing Codex hooks", () => {
    const dir = freshRepo(); runEntry(["init"], dir);
    mkdirSync(path.join(dir, ".codex"), { recursive: true });
    writeFileSync(path.join(dir, ".codex", "hooks.json"), JSON.stringify({ hooks: { PreToolUse: [{ matcher: "Read", hooks: [{ type: "command", command: "echo user-hook" }] }] }, custom: true }, null, 2));
    const install = runEntry(["install"], dir);
    expect(install.code).toBe(0);
    const codex = JSON.parse(readFileSync(path.join(dir, ".codex", "hooks.json"), "utf8"));
    expect(codex.custom).toBe(true);
    expect(JSON.stringify(codex.hooks.PreToolUse)).toContain("echo user-hook");
    expect(JSON.stringify(codex.hooks.PreToolUse)).toContain("hook-codex.mjs");
    expect(existsSync(path.join(dir, ".opencode", "plugins", "siftos.js"))).toBe(true);
    expect(JSON.parse(readFileSync(path.join(dir, ".product", "config.json"), "utf8")).hooks).toBeUndefined();
    rmSync(dir, { recursive: true, force: true });
  });

  it("balanced guard stays blocked for the same intent until an authorizing resolution exists", () => {
    const dir = freshRepo(); runEntry(["init"], dir); runEntry(["hooks", "set", "balanced"], dir);
    const turn = "--turn-id=manual-guard-test";
    const first = runEntry(["guard", "check", turn, "--level=L2", "app/referrals.ts"], dir);
    expect(first.code).toBe(1);
    const retry = runEntry(["guard", "check", turn, "--level=L2", "app/referrals.ts"], dir);
    expect(retry.code).toBe(1);
    expect(retry.stdout).toContain("still unresolved");
    const shape = runEntry(["guard", "check", turn, "--level=L2", "--resolution=shape", "app/referrals.ts"], dir);
    expect(shape.code).toBe(1);
    const bypass = runEntry(["guard", "check", turn, "--level=L2", "--resolution=build_anyway", "app/referrals.ts"], dir);
    expect(bypass.code).toBe(0);
    expect(bypass.stdout).toContain("Resolution: build_anyway");
    rmSync(dir, { recursive: true, force: true });
  });

  it("manual build_anyway is not sticky across independent CLI intents", () => {
    const dir = freshRepo(); runEntry(["init"], dir); runEntry(["hooks", "set", "balanced"], dir);
    expect(runEntry(["guard", "check", "--level=L2", "--resolution=build_anyway", "app/referrals.ts"], dir).code).toBe(0);
    expect(runEntry(["guard", "check", "--level=L2", "app/referrals.ts"], dir).code).toBe(1);
    rmSync(dir, { recursive: true, force: true });
  });

  it("existing_bet requires a real build-authorizing decision", () => {
    const dir = freshRepo(); runEntry(["init"], dir); runEntry(["hooks", "set", "balanced"], dir);
    const result = runEntry(["guard", "check", "--level=L2", "--resolution=existing_bet", "app/login.ts"], dir);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("existing_bet requires --decision");
    rmSync(dir, { recursive: true, force: true });
  });

  it("Codex UserPromptSubmit starts a fresh intent so a prior bypass cannot leak", () => {
    const dir = freshRepo(); runEntry(["init"], dir); runEntry(["install"], dir); runEntry(["hooks", "set", "balanced"], dir);
    expect(runEntry(["guard", "check", "--level=L2", "--resolution=build_anyway", "app/referrals.ts"], dir).code).toBe(0);
    const hook = path.join(dir, ".agents", "skills", "siftos", "scripts", "hook-codex.mjs");
    const env = { ...process.env, HOME: dir };
    execFileSync(process.execPath, [hook, "prompt_submit"], { cwd: dir, env, encoding: "utf8", input: JSON.stringify({ turn_id: "turn-2", prompt: "Add referrals" }) });
    const preOut = execFileSync(process.execPath, [hook, "before_mutation"], { cwd: dir, env, encoding: "utf8", input: JSON.stringify({ turn_id: "turn-2", tool_name: "Write", tool_input: { file_path: "app/referrals.ts" } }) });
    expect(JSON.parse(preOut).hookSpecificOutput.permissionDecision).toBe("deny");
    rmSync(dir, { recursive: true, force: true });
  });
});
