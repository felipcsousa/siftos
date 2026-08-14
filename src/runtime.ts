import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { writeFileAtomic } from "./atomic.js";
import type { HookConfig, HookName } from "./config.js";

export const RUNTIME_DIR = ".runtime";
export const RUNTIME_SESSION_FILE = "session.json";

export type RuntimeCandidate = "technical" | "possible_product" | "obvious_product" | "unknown";
export type GuardLevel = "L0" | "L1" | "L2" | "L3" | "UNKNOWN";
export type GuardResolution = "shape" | "validate" | "prototype" | "existing_bet" | "reconsider" | "build_anyway";
export type GuardStatus = "idle" | "unresolved" | "resolved" | "bypassed";

export interface RuntimeGuardState {
  intent_id: string | null;
  status: GuardStatus;
  level: GuardLevel | null;
  resolution: GuardResolution | null;
  /** UX state only; never authorizes a mutation. */
  block_issued: boolean;
}

export interface RuntimeShipGate {
  required: boolean;
  passed: boolean | null;
  result: string | null;
  continuations?: number;
}

export interface RuntimeState {
  session_id: string;
  turn_id: string | null;
  prompt: string | null;
  hook_overrides: Partial<Record<HookName, Partial<HookConfig>>>;
  candidate: RuntimeCandidate | null;
  guard: RuntimeGuardState;
  active_bet: string | null;
  mutation: { files: string[]; started: boolean };
  ship_gate: RuntimeShipGate;
  heartbeat: Record<string, string>;
  metrics: Record<string, number>;
}

export function defaultRuntime(): RuntimeState {
  return {
    session_id: randomUUID(),
    turn_id: null,
    prompt: null,
    hook_overrides: {},
    candidate: null,
    guard: { intent_id: null, status: "idle", level: null, resolution: null, block_issued: false },
    active_bet: null,
    mutation: { files: [], started: false },
    ship_gate: { required: false, passed: null, result: null, continuations: 0 },
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
    const parsed = JSON.parse(readFileSync(file, "utf8")) as Partial<RuntimeState> & {
      guard?: Partial<RuntimeGuardState>;
      mutation?: { files?: string[]; started?: boolean };
    };
    const base = defaultRuntime();
    const rawGuard = parsed.guard ?? {};
    const guard: RuntimeGuardState = { ...base.guard, ...rawGuard };

    // Legacy runtime did not scope resolutions to an intent. Never promote a
    // historical `build_anyway` / `existing_bet` / `prototype` into current
    // authorization merely because it exists on disk.
    if (!rawGuard.intent_id || !rawGuard.status) {
      guard.intent_id = null;
      guard.status = rawGuard.level ? "unresolved" : "idle";
      guard.resolution = null;
      guard.block_issued = Boolean(rawGuard.block_issued);
    }

    return {
      ...base,
      ...parsed,
      turn_id: parsed.turn_id ?? base.turn_id,
      prompt: parsed.prompt ?? base.prompt,
      hook_overrides: { ...base.hook_overrides, ...(parsed.hook_overrides ?? {}) },
      guard,
      mutation: { ...base.mutation, ...(parsed.mutation ?? {}) },
      ship_gate: { ...base.ship_gate, ...(parsed.ship_gate ?? {}) },
      heartbeat: { ...(parsed.heartbeat ?? {}) },
      metrics: { ...(parsed.metrics ?? {}) },
    };
  } catch {
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

/** Single TypeScript implementation of turn reset used by CLI/runtime tests. */
export function startRuntimeTurn(root: string, turnId: string, prompt: string): RuntimeState {
  const state = loadRuntime(root);
  if (state.turn_id !== turnId) {
    state.turn_id = turnId;
    state.prompt = prompt;
    state.candidate = null;
    state.guard = { intent_id: turnId, status: "unresolved", level: null, resolution: null, block_issued: false };
    state.active_bet = null;
    state.mutation = { files: [], started: false };
    state.ship_gate = { required: false, passed: null, result: null, continuations: 0 };
  }
  saveRuntime(root, state);
  return state;
}

export function clearSessionOverrides(root: string): void {
  const state = loadRuntime(root);
  state.hook_overrides = {};
  saveRuntime(root, state);
}
