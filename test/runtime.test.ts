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
  touchHeartbeat,
} from "../src/runtime.js";

let tmp: string;

function fresh() {
  tmp = mkdtempSync(path.join(os.tmpdir(), "siftos-runtime-"));
  mkdirSync(path.join(tmp, ".product", ".runtime"), { recursive: true });
  return tmp;
}

describe("runtime state (PRD V2 §83–§84)", () => {
  it("round-trips nested state without clobbering defaults", () => {
    const root = fresh();
    const state = loadRuntime(root);
    state.guard = { level: "L2", resolution: "existing_bet", block_issued: true };
    state.mutation = { files: ["src/a.ts"] };
    state.hook_overrides = { before_mutation: { enabled: false } };
    saveRuntime(root, state);

    const loaded = loadRuntime(root);
    expect(loaded.guard).toEqual({ level: "L2", resolution: "existing_bet", block_issued: true });
    expect(loaded.mutation.files).toEqual(["src/a.ts"]);
    expect(loaded.hook_overrides.before_mutation).toEqual({ enabled: false });
    // untouched nested keys keep defaults
    expect(loaded.ship_gate).toEqual({ required: false, passed: null, result: null });
    expect(typeof loaded.session_id).toBe("string");
    rmSync(tmp, { recursive: true, force: true });
  });

  it("a partial runtime file merges with defaults instead of clobbering", () => {
    const root = fresh();
    saveRuntime(root, { ...defaultRuntime(), guard: { level: "L3", resolution: null, block_issued: false } });
    const loaded = loadRuntime(root);
    expect(loaded.guard.level).toBe("L3");
    expect(loaded.mutation).toEqual({ files: [] });
    expect(loaded.metrics).toEqual({});
    rmSync(tmp, { recursive: true, force: true });
  });

  it("corrupted disposable state falls back to a fresh runtime", () => {
    const root = fresh();
    writeFileSync(path.join(root, ".product", ".runtime", "session.json"), "{not json");
    const loaded = loadRuntime(root);
    expect(loaded.session_id).toBeTruthy();
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

  it("clearSessionOverrides keeps the rest of the session state", () => {
    const root = fresh();
    const state = loadRuntime(root);
    state.hook_overrides = { before_mutation: { enabled: false } };
    state.active_bet = "DEC-0001";
    saveRuntime(root, state);
    clearSessionOverrides(root);
    const loaded = loadRuntime(root);
    expect(loaded.hook_overrides).toEqual({});
    expect(loaded.active_bet).toBe("DEC-0001");
    rmSync(tmp, { recursive: true, force: true });
  });
});
