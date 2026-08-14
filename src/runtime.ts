import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { writeFileAtomic } from "./atomic.js";
import type { HookConfig, HookName } from "./config.js";

/**
 * SiftOS V2 runtime state.
 *
 * `.product/.runtime/session.json` is disposable and reconstructable. The
 * important invariant is that Product Guard authorization is scoped to one
 * user turn/product intent: retrying a blocked mutation never authorizes it.
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
export type GuardStatus = "idle" | "unresolved" | "resolved" | "bypassed";

export interface RuntimeGuardState {
  /** User turn / product-intent identifier this authorization belongs to. */
  intent_id: string | null;
  status: GuardStatus;
  level: GuardLevel | null;
  resolution: GuardResolution | null;
  /** UX state only: suppresses duplicate explanations, never authorizes. */
  block_issued: boolean;
}

export interface RuntimeShipGate {
  required: boolean;
  passed: boolean | null;
  result: string | null;
  /** Prevent Stop hooks from creating continuation loops. */
  continuations?: number;
}

export interface RuntimeState {
  session_id: string;
  /** Current harness turn id. Changes on every user prompt. */
  turn_id: string | null;
  /** Current prompt, used only as disposable runtime context for guard triage. */
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
    guard: {
      intent_id: null,
      status: "idle",
      level: null,
      resolution: null,
      block_issued: false,
    },
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
    const guard: RuntimeGuardState = {
      ...base.guard,
      ...(parsed.guard ?? {}),
    };
    // v0.2/V2 migration: old state only had level/resolution/block_issued.
    // A previous `block_issued` is never treated as authorization.
    if (!guard.intent_id) {
      guard.status = guard.resolution === "build_anyway"
        ? "bypassed"
        : guard.resolution === "prototype" || guard.resolution === "existing_bet"
          ? "resolved"
          : guard.level
            ? "unresolved"
            : "idle";
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

/** Start a fresh product-intent scope for a new user turn. */
export function startRuntimeTurn(root: string, turnId: string, prompt: string): RuntimeState {
  const state = loadRuntime(root);
  if (state.turn_id !== turnId) {
    state.turn_id = turnId;
    state.prompt = prompt;
    state.candidate = null;
    state.guard = {
      intent_id: turnId,
      status: "unresolved",
      level: null,
      resolution: null,
      block_issued: false,
    };
    state.active_bet = null;
    state.mutation = { files: [], started: false };
    state.ship_gate = { required: false, passed: null, result: null, continuations: 0 };
  }
  saveRuntime(root, state);
  return state;
}

/** Session end: session overrides expire; canonical product memory is untouched. */
export function clearSessionOverrides(root: string): void {
  const state = loadRuntime(root);
  state.hook_overrides = {};
  saveRuntime(root, state);
}
