import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { writeFileAtomic } from "./atomic.js";
import type { HookConfig, HookName } from "./config.js";

/**
 * SiftOS V2 runtime state (PRD V2 §83–§84, §118).
 *
 * `.product/.runtime/session.json` is disposable, non-canonical, normally
 * gitignored, reconstructable, and session-specific. Canonical product
 * memory never lives here; hooks and ship/guard state do.
 */

export const RUNTIME_DIR = ".runtime";
export const RUNTIME_SESSION_FILE = "session.json";

export type RuntimeCandidate = "technical" | "possible_product" | "obvious_product" | "unknown";
export type GuardLevel = "L0" | "L1" | "L2" | "L3" | "UNKNOWN";
export type GuardResolution =
  | "shape"
  | "validate"
  | "prototype"
  | "existing_bet"
  | "reconsider"
  | "build_anyway";

export interface RuntimeGuardState {
  level: GuardLevel | null;
  resolution: GuardResolution | null;
  block_issued: boolean;
}

export interface RuntimeShipGate {
  required: boolean;
  passed: boolean | null;
  result: string | null;
}

export interface RuntimeState {
  session_id: string;
  /** Per-session hook overrides; expire at session end, survive compaction. */
  hook_overrides: Partial<Record<HookName, Partial<HookConfig>>>;
  candidate: RuntimeCandidate | null;
  guard: RuntimeGuardState;
  /** Id of the record currently being built (accepted+/building/shipped). */
  active_bet: string | null;
  mutation: { files: string[] };
  ship_gate: RuntimeShipGate;
  /** Last observed time per logical hook (Installed vs Active evidence). */
  heartbeat: Record<string, string>;
  /** Local, disposable counters (PRD §128). Disabled hooks never count. */
  metrics: Record<string, number>;
}

export function defaultRuntime(): RuntimeState {
  return {
    session_id: randomUUID(),
    hook_overrides: {},
    candidate: null,
    guard: { level: null, resolution: null, block_issued: false },
    active_bet: null,
    mutation: { files: [] },
    ship_gate: { required: false, passed: null, result: null },
    heartbeat: {},
    metrics: {},
  };
}

function runtimeDir(root: string): string {
  return path.join(root, ".product", RUNTIME_DIR);
}

function runtimeFile(root: string): string {
  return path.join(runtimeDir(root), RUNTIME_SESSION_FILE);
}

export function loadRuntime(root: string): RuntimeState {
  const file = runtimeFile(root);
  if (!existsSync(file)) return defaultRuntime();
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8")) as Partial<RuntimeState>;
    const base = defaultRuntime();
    return {
      ...base,
      ...parsed,
      hook_overrides: { ...base.hook_overrides, ...(parsed.hook_overrides ?? {}) },
      guard: { ...base.guard, ...(parsed.guard ?? {}) },
      mutation: { ...base.mutation, ...(parsed.mutation ?? {}) },
      ship_gate: { ...base.ship_gate, ...(parsed.ship_gate ?? {}) },
      heartbeat: { ...(parsed.heartbeat ?? {}) },
      metrics: { ...(parsed.metrics ?? {}) },
    };
  } catch {
    // Corrupted disposable state: start fresh rather than fail.
    return defaultRuntime();
  }
}

export function saveRuntime(root: string, state: RuntimeState): void {
  mkdirSync(runtimeDir(root), { recursive: true });
  writeFileAtomic(runtimeDir(root), RUNTIME_SESSION_FILE, JSON.stringify(state, null, 2) + "\n");
}

export function bumpMetric(root: string, key: string, by = 1): void {
  const state = loadRuntime(root);
  state.metrics[key] = (state.metrics[key] ?? 0) + by;
  saveRuntime(root, state);
}

export function touchHeartbeat(root: string, hook: string): void {
  const state = loadRuntime(root);
  state.heartbeat[hook] = new Date().toISOString();
  saveRuntime(root, state);
}

/** Session end (PRD V2 §81): overrides expire, heartbeat stays. */
export function clearSessionOverrides(root: string): void {
  const state = loadRuntime(root);
  state.hook_overrides = {};
  saveRuntime(root, state);
}
