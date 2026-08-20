import { describe, expect, it, afterAll } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  extractPromptText,
  onPreExecute,
  onPreStep,
  onSessionStart,
  onTurnStopping,
  rootOf,
  toUserMessage,
} from "../skill/adapters/dsh-plugin.js";
import { classifyToolEffect, loadRuntime, saveRuntime } from "../skill/scripts/hook-lib.mjs";

// The adapter must be drivable without a live Cordis/dsh runtime: handlers
// take plain payloads and optional `next` callbacks, and toUserMessage falls
// back to a plain UserMessage-shaped object when dsh packages are absent.
const repos: string[] = [];
function makeRepo(hooks: Record<string, unknown> | undefined = { preset: "balanced" }): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), "siftos-dsh-"));
  repos.push(dir);
  mkdirSync(path.join(dir, ".git"));
  mkdirSync(path.join(dir, ".product", "decisions"), { recursive: true });
  writeFileSync(
    path.join(dir, ".product", "config.json"),
    JSON.stringify(
      { version: 2, name: "siftos", platforms: ["opencode", "codex", "dsh"], linters: { enabled: true }, hooks },
      null,
      2,
    ) + "\n",
  );
  return dir;
}
function makeEmptyDir(): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), "siftos-dsh-empty-"));
  repos.push(dir);
  return dir;
}
function agentOf(cwd: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { id: "sess-1", session: { header: { cwd } }, ...extra };
}
const DECISION = `---
id: DEC-0007
title: Referral experiment
status: building
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

afterAll(() => {
  for (const repo of repos) rmSync(repo, { recursive: true, force: true });
});

describe("dsh adapter", () => {
  it("is a no-op outside a SiftOS product repo: next() is called and allow is returned", async () => {
    const cwd = makeEmptyDir();
    const exec = { name: "write", arguments: { path: "src/a.ts" }, agent: agentOf(cwd) };
    let nextCalled = false;
    const decision = await onPreExecute(exec, async () => {
      nextCalled = true;
      return { kind: "allow" };
    });
    expect(nextCalled).toBe(true);
    expect(decision).toEqual({ kind: "allow" });

    let stepNext = false;
    const step = await onPreStep({ agent: agentOf(cwd), messages: [{ content: [{ type: "text", text: "hi" }] }], turn: 1 }, async () => {
      stepNext = true;
      return { kind: "enter", messages: [] };
    });
    expect(stepNext).toBe(true);
    expect(step).toEqual({ kind: "enter", messages: [] });
    expect(rootOf({ session: { header: { cwd } } })).toBeNull();
  });

  it("denies an unresolved L2 mutation with the Guard reason and never calls next()", async () => {
    const cwd = makeRepo();
    const exec = {
      name: "str_replace_editor",
      arguments: { file_path: "src/referrals.ts", old_string: "a", new_string: "b" },
      agent: agentOf(cwd),
    };
    let nextCalled = false;
    const decision = await onPreExecute(exec, async () => {
      nextCalled = true;
      return { kind: "allow" };
    });
    expect(nextCalled).toBe(false);
    expect(decision?.kind).toBe("deny");
    expect(String(decision?.reason)).toContain("SiftOS Product Guard");
    expect(String(decision?.reason)).toContain("L2");
  });

  it("extracts prompt text from the pre-step batch and build_anyway authorizes the next mutation", async () => {
    const cwd = makeRepo();
    const agent = agentOf(cwd);
    const messages = [{ content: [{ type: "text", text: "Add referrals, build anyway" }] }];
    expect(extractPromptText(messages)).toBe("Add referrals, build anyway");
    let nextCalled = false;
    const step = await onPreStep({ agent, messages, turn: 3 }, async () => {
      nextCalled = true;
      return { kind: "enter", messages };
    });
    expect(nextCalled).toBe(true);
    expect(step).toEqual({ kind: "enter", messages });

    const exec = { name: "write", arguments: { file_path: "src/referrals.ts" }, agent };
    const decision = await onPreExecute(exec, async () => ({ kind: "allow" }));
    expect(decision).toEqual({ kind: "allow" });
  });

  it("steers exactly one closeout continuation and caps further closeouts", async () => {
    const cwd = makeRepo();
    writeFileSync(path.join(cwd, ".product", "decisions", "DEC-0007-referral.md"), DECISION);
    const steers: Array<{ content: Array<{ text?: string }> }> = [];
    const injects: Array<{ content: Array<{ text?: string }> }> = [];
    const agent = agentOf(cwd, {
      steer: (message: { content: Array<{ text?: string }> }) => steers.push(message),
      inject: (message: { content: Array<{ text?: string }> }) => injects.push(message),
    });

    // Attach the active bet and a mutation footprint so closeout has a gate to run.
    const state = loadRuntime(cwd);
    state.active_bet = "DEC-0007";
    state.mutation = { files: ["src/referrals.ts"], started: true };
    saveRuntime(cwd, state);

    await onTurnStopping({ agent });
    expect(steers.length).toBe(1);
    expect(steers[0]?.content?.[0]?.text).toContain("Ship Gate");

    // Re-arm the footprint: the continuation cap (not cleared state) must
    // prevent a second steer.
    const again = loadRuntime(cwd);
    again.mutation = { files: ["src/referrals.ts"], started: true };
    saveRuntime(cwd, again);
    await onTurnStopping({ agent });
    expect(steers.length).toBe(1);
  });

  it("injects the product capsule on session start and again on compact source", async () => {
    const cwd = makeRepo();
    const injected: Array<{ content: Array<{ text?: string }> }> = [];
    const agent = agentOf(cwd, { inject: (message: { content: Array<{ text?: string }> }) => injected.push(message) });
    await onSessionStart({ agent, source: "startup" });
    expect(injected.length).toBe(1);
    expect(injected[0]?.content?.[0]?.text).toContain("SIFTOS PRODUCT CONTEXT");

    await onSessionStart({ agent, source: "compact" });
    expect(injected.length).toBe(3); // session_start + compact context_compact re-inject
    expect(loadRuntime(cwd).heartbeat.context_compact).toBeDefined();
  });

  it("classifies dsh tool names like their harness equivalents", () => {
    expect(classifyToolEffect("str_replace_editor", { path: "src/a.ts", command: "str_replace", old_str: "a", new_str: "b" })).toBe("mutation");
    expect(classifyToolEffect("str_replace_editor", { path: ".product/config.json", command: "str_replace" })).toBe("siftos_internal");
    expect(classifyToolEffect("pwsh", { command: "npm test" })).toBe("verification");
    expect(classifyToolEffect("pwsh", { command: "rm src/a.ts" })).toBe("mutation");
  });

  it("treats str_replace_editor view as a read, never gated", async () => {
    expect(classifyToolEffect("str_replace_editor", { path: "src/referrals.ts", command: "view" })).toBe("read");
    // Under an unresolved L2 product intent a view must still be allowed.
    const cwd = makeRepo();
    const exec = { name: "str_replace_editor", arguments: { path: "src/referrals.ts", command: "view" }, agent: agentOf(cwd) };
    let nextCalled = false;
    const decision = await onPreExecute(exec, async () => {
      nextCalled = true;
      return { kind: "allow" };
    });
    expect(nextCalled).toBe(true);
    expect(decision).toEqual({ kind: "allow" });
  });

  it("keeps SiftOS-internal detection for apply_patch headers and nested multiedit paths", () => {
    expect(classifyToolEffect("apply_patch", { patch: "*** Begin Patch\n*** Update File: .product/config.json\n@@\n-x\n+y\n*** End Patch" })).toBe("siftos_internal");
    expect(classifyToolEffect("apply_patch", { patch: "*** Update File: src/a.ts\n@@\n-x\n+y" })).toBe("mutation");
    expect(classifyToolEffect("multiedit", { edits: [{ file_path: ".product/decisions/DEC-0001.md", edits: [{ old_string: "a", new_string: "b" }] }] })).toBe("siftos_internal");
    expect(classifyToolEffect("write", { file_path: ".PRODUCT/config.json" })).toBe("siftos_internal");
  });

  it("never treats old/new string bodies mentioning .product/ as SiftOS-internal", () => {
    // A production mutation whose diff text merely mentions .product/ must
    // stay gated (siftos_internal would bypass Product Guard).
    expect(classifyToolEffect("str_replace_editor", { path: "src/a.ts", command: "str_replace", old_str: "see .product/config.json", new_str: "x" })).toBe("mutation");
    expect(classifyToolEffect("write", { file_path: "src/a.ts", content: "loads .product/config.json" })).toBe("mutation");
  });

  it("compact session-start preserves live guard state (PreCompact parity)", async () => {
    const cwd = makeRepo();
    const state = loadRuntime(cwd);
    state.turn_id = "dsh-sess-1-t1";
    state.guard = { intent_id: "dsh-sess-1-t1", status: "bypassed", level: "L2", resolution: "build_anyway", block_issued: true };
    state.mutation = { files: ["src/referrals.ts"], started: true };
    saveRuntime(cwd, state);
    const injected: Array<{ content: Array<{ text?: string }> }> = [];
    const agent = agentOf(cwd, { inject: (message: { content: Array<{ text?: string }> }) => injected.push(message) });
    await onSessionStart({ agent, source: "compact" });
    const after = loadRuntime(cwd);
    expect(after.guard.resolution).toBe("build_anyway");
    expect(after.guard.status).toBe("bypassed");
    expect(after.mutation.started).toBe(true);
    expect(after.heartbeat.context_compact).toBeDefined();
    expect(injected.length).toBe(2); // session_start capsule + compact re-inject
  });

  it("toUserMessage builds a UserMessage-shaped object without dsh packages", async () => {
    const message = await toUserMessage("probe");
    expect(message.role).toBe("user");
    expect(message.content).toEqual([{ type: "text", text: "probe" }]);
    expect(message.source).toEqual({ kind: "plugin", plugin: "siftos" });
    expect(typeof message.id).toBe("string");
  });
});