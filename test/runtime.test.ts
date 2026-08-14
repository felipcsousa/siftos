import { describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  bumpMetric,
  clearSessionOverrides,
  defaultRuntime,
  loadRuntime,
  saveRuntime,
  startRuntimeTurn,
  touchHeartbeat,
} from "../src/runtime.js";

let tmp: string;

function fresh() {
  tmp = mkdtempSync(path.join(os.tmpdir(), "siftos-runtime-"));
  mkdirSync(path.join(tmp, ".product", ".runtime"), { recursive: true });
  return tmp;
}

describe("runtime state", () => {
  it("round-trips turn-scoped guard state without clobbering defaults", () => {
    const root = fresh();
    const state = loadRuntime(root);
    state.turn_id = "turn-1";
    state.guard = {
      intent_id: "turn-1",
      status: "resolved",
      level: "L2",
      resolution: "existing_bet",
      block_issued: true,
    };
    state.mutation = { files: ["src/a.ts"], started: true };
    state.hook_overrides = { before_mutation: { enabled: false } };
    saveRuntime(root, state);

    const loaded = loadRuntime(root);
    expect(loaded.guard).toEqual({
      intent_id: "turn-1",
      status: "resolved",
      level: "L2",
      resolution: "existing_bet",
      block_issued: true,
    });
    expect(loaded.mutation).toEqual({ files: ["src/a.ts"], started: true });
    expect(loaded.hook_overrides.before_mutation).toEqual({ enabled: false });
    expect(loaded.ship_gate).toEqual({ required: false, passed: null, result: null, continuations: 0 });
    expect(typeof loaded.session_id).toBe("string");
    rmSync(tmp, { recursive: true, force: true });
  });

  it("migrates old runtime files without treating block_issued as authorization", () => {
    const root = fresh();
    writeFileSync(
      path.join(root, ".product", ".runtime", "session.json"),
      JSON.stringify({ guard: { level: "L2", resolution: null, block_issued: true } }),
    );
    const loaded = loadRuntime(root);
    expect(loaded.guard.status).toBe("unresolved");
    expect(loaded.guard.block_issued).toBe(true);
    expect(loaded.guard.intent_id).toBeNull();
    rmSync(tmp, { recursive: true, force: true });
  });

  it("startRuntimeTurn resets authorization when the harness turn changes", () => {
    const root = fresh();
    const first = startRuntimeTurn(root, "turn-1", "build anyway");
    first.guard.status = "bypassed";
    first.guard.resolution = "build_anyway";
    saveRuntime(root, first);

    const second = startRuntimeTurn(root, "turn-2", "add referrals");
    expect(second.turn_id).toBe("turn-2");
    expect(second.guard.intent_id).toBe("turn-2");
    expect(second.guard.status).toBe("unresolved");
    expect(second.guard.resolution).toBeNull();
    expect(second.guard.block_issued).toBe(false);
    rmSync(tmp, { recursive: true, force: true });
  });

  it("corrupted disposable state falls back to a fresh runtime", () => {
    const root = fresh();
    writeFileSync(path.join(root, ".product", ".runtime", "session.json"), "{not json");
    const loaded = loadRuntime(root);
    expect(loaded.session_id).toBeTruthy();
    expect(loaded.guard.status).toBe("idle");
    expect(loaded.guard.block_issued).toBe(false);
    rmSync(tmp, { recursive: true, force: true });
  });

  it("bumpMetric and touchHeartbeat persist", () => {
    const root = fresh();
    bumpMetric(root, "guard_blocked");
    bumpMetric(root, "guard_blocked");
    touchHeartbeat(root, "before_mutation");
    const loaded = loadRuntime(root);
    expect(loaded.metrics.guard_blocked).toBe(2);
    expect(loaded.heartbeat.before_mutation).toBeTruthy();
    rmSync(tmp, { recursive: true, force: true });
  });

  it("clearSessionOverrides keeps product-intent state", () => {
    const root = fresh();
    const state = defaultRuntime();
    state.hook_overrides = { before_mutation: { enabled: false } };
    state.active_bet = "DEC-0001";
    state.turn_id = "turn-1";
    saveRuntime(root, state);
    clearSessionOverrides(root);
    const loaded = loadRuntime(root);
    expect(loaded.hook_overrides).toEqual({});
    expect(loaded.active_bet).toBe("DEC-0001");
    expect(loaded.turn_id).toBe("turn-1");
    rmSync(tmp, { recursive: true, force: true });
  });
});
