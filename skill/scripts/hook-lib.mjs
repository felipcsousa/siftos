// Shared zero-dependency runtime for Codex/OpenCode lifecycle adapters.
// Hooks orchestrate; product judgment stays in the SiftOS skill. The core
// invariant here is authorization: a blocked product intent stays blocked
// until the user explicitly resolves it.
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { findProductRoot, loadAll, sectionItems } from "./lib.mjs";

export const HOOK_NAMES = [
  "session_start", "prompt_submit", "before_mutation", "after_mutation",
  "turn_stop", "context_compact", "subagent_start", "session_end",
];
const AUTHORIZING_RESOLUTIONS = new Set(["prototype", "existing_bet", "build_anyway"]);
const ACCEPTED_PLUS = new Set(["accepted", "building", "shipped", "measuring", "reviewed"]);

function now() { return new Date().toISOString(); }
function runtimeFile(root) { return path.join(root, ".product", ".runtime", "session.json"); }

export function defaultRuntime() {
  return {
    session_id: `hook-${process.pid}`,
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

export function loadRuntime(root) {
  const file = runtimeFile(root);
  if (!existsSync(file)) return defaultRuntime();
  try {
    const raw = JSON.parse(readFileSync(file, "utf8"));
    const base = defaultRuntime();
    const guard = { ...base.guard, ...(raw.guard ?? {}) };
    if (!guard.status) {
      guard.status = guard.resolution === "build_anyway" ? "bypassed"
        : guard.resolution === "prototype" || guard.resolution === "existing_bet" ? "resolved"
        : guard.level ? "unresolved" : "idle";
    }
    return {
      ...base, ...raw,
      hook_overrides: { ...base.hook_overrides, ...(raw.hook_overrides ?? {}) },
      guard,
      mutation: { ...base.mutation, ...(raw.mutation ?? {}) },
      ship_gate: { ...base.ship_gate, ...(raw.ship_gate ?? {}) },
      heartbeat: { ...(raw.heartbeat ?? {}) },
      metrics: { ...(raw.metrics ?? {}) },
    };
  } catch { return defaultRuntime(); }
}

export function saveRuntime(root, state) {
  const dir = path.dirname(runtimeFile(root));
  mkdirSync(dir, { recursive: true });
  const file = runtimeFile(root);
  const tmp = `${file}.tmp-${process.pid}`;
  writeFileSync(tmp, JSON.stringify(state, null, 2) + "\n");
  try { renameSync(tmp, file); }
  catch (err) { rmSync(tmp, { force: true }); throw err; }
}

function loadJson(file) {
  try { return JSON.parse(readFileSync(file, "utf8")); }
  catch { return null; }
}

function normalizePreset(value) {
  return ["off", "advisory", "balanced", "strict", "custom"].includes(value) ? value : null;
}

function presetHook(preset, name) {
  if (preset === "off") return { enabled: false };
  if (name === "before_mutation") return { enabled: true, enforcement: preset, failure_policy: preset === "strict" ? "fail_closed" : "fail_open" };
  if (name === "turn_stop") return { enabled: true, enforcement: preset === "strict" ? "strict" : "advisory", failure_policy: "fail_open" };
  if (name === "prompt_submit") return { enabled: true, enforcement: "advisory", failure_policy: "fail_open" };
  return { enabled: true, failure_policy: "fail_open" };
}

export function effectiveHook(root, name, state = loadRuntime(root)) {
  const repo = loadJson(path.join(root, ".product", "config.json"));
  const global = loadJson(path.join(os.homedir(), ".siftos", "config.json"));
  const raw = repo?.hooks ?? null;
  const repoPreset = normalizePreset(raw?.preset);
  const globalPreset = normalizePreset(global?.default_hook_preset);
  let base;
  if (repoPreset === "custom") base = { enabled: false };
  else if (repoPreset) base = presetHook(repoPreset, name);
  else if (globalPreset && globalPreset !== "custom") base = presetHook(globalPreset, name);
  else base = { enabled: false };
  if (raw?.[name] && typeof raw[name] === "object") base = { ...base, ...raw[name] };
  if (state.hook_overrides?.[name]) base = { ...base, ...state.hook_overrides[name] };
  return base;
}

export function observe(root, state, hookName) {
  state.heartbeat[hookName] = now();
  saveRuntime(root, state);
}

function resolutionFromPrompt(prompt) {
  const text = String(prompt ?? "").toLowerCase();
  if (/\b(build anyway|just (build|implement)|skip (the )?(product )?(check|guard)|proceed anyway)\b/.test(text)) return "build_anyway";
  if (/\bprototype\b/.test(text)) return "prototype";
  if (/\b(existing bet|use (the )?bet|attach .*bet)\b/.test(text) || /\bDEC-\d{4}\b/i.test(String(prompt ?? ""))) return "existing_bet";
  if (/\bshape\b/.test(text)) return "shape";
  if (/\bvalidate\b/.test(text)) return "validate";
  if (/\breconsider\b/.test(text)) return "reconsider";
  return null;
}

function decisionIdFromPrompt(prompt) {
  return String(prompt ?? "").match(/\bDEC-\d{4}\b/i)?.[0]?.toUpperCase() ?? null;
}

export function classifyCandidate(prompt) {
  const text = String(prompt ?? "").toLowerCase();
  if (!text.trim()) return "unknown";
  if (/\b(add|introduce|launch|remove|change|redesign|enable|disable|monetiz|pricing|subscription|referral|onboard|login|oauth|notification|export|workspace|team|permission|marketplace|paywall)\b/.test(text)) return "obvious_product";
  if (/\b(fix|refactor|rename variable|failing test|lint|format|dependency upgrade|type error)\b/.test(text)) return "technical";
  if (/\b(user|customer|flow|screen|cta|copy|behavior|experience|feature)\b/.test(text)) return "possible_product";
  return "unknown";
}

export function startTurn(root, { turnId, prompt }) {
  const state = loadRuntime(root);
  const id = String(turnId || `turn-${Date.now()}`);
  if (state.turn_id !== id) {
    state.turn_id = id;
    state.prompt = String(prompt ?? "");
    state.candidate = classifyCandidate(prompt);
    state.guard = { intent_id: id, status: "unresolved", level: null, resolution: null, block_issued: false };
    state.active_bet = null;
    state.mutation = { files: [], started: false };
    state.ship_gate = { required: false, passed: null, result: null, continuations: 0 };
  }
  const resolution = resolutionFromPrompt(prompt);
  if (resolution) {
    state.guard.resolution = resolution;
    if (resolution === "build_anyway") state.guard.status = "bypassed";
    else if (resolution === "prototype") state.guard.status = "resolved";
    else if (resolution === "existing_bet") {
      const idFromPrompt = decisionIdFromPrompt(prompt);
      const { decisions } = loadAll(root);
      const decision = idFromPrompt ? decisions.find((d) => d.id === idFromPrompt) : null;
      if (decision && ACCEPTED_PLUS.has(decision.status)) {
        state.active_bet = decision.id;
        state.guard.status = "resolved";
      }
    }
    // shape/validate/reconsider intentionally remain unresolved for
    // production mutation. SiftOS-internal `.product/` writes are exempt.
  }
  state.heartbeat.prompt_submit = now();
  saveRuntime(root, state);
  return state;
}

function strings(value, out = []) {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) for (const item of value) strings(item, out);
  else if (value && typeof value === "object") for (const item of Object.values(value)) strings(item, out);
  return out;
}

export function toolStrings(toolInput) { return strings(toolInput ?? {}); }

function readOnlyShell(command) {
  const cmd = String(command ?? "").trim();
  if (!cmd) return true;
  if (/[>|;&]|\brm\b|\bmv\b|\bcp\b|\bmkdir\b|\btouch\b|\bsed\s+-i\b|\bnpm\s+(install|i)\b|\bpnpm\s+add\b|\byarn\s+add\b|\bgit\s+(checkout|reset|clean|commit|add|restore)\b/.test(cmd)) return false;
  return /^(pwd|ls|find|cat|head|tail|rg|grep|git\s+(status|diff|log|show)|node\s+--version|npm\s+test|npm\s+run\s+(test|typecheck|build))\b/.test(cmd);
}

export function classifyToolEffect(toolName, toolInput) {
  const tool = String(toolName ?? "").toLowerCase();
  const values = toolStrings(toolInput);
  const joined = values.join(" ").toLowerCase();
  const internal = joined.includes(".product/") || joined.includes(".agents/skills/siftos/") || joined.includes(".siftos");
  if (["read", "grep", "glob", "search", "view", "list"].includes(tool)) return "read";
  if (["write", "edit", "apply_patch", "apply", "patch", "multiedit"].includes(tool)) return internal ? "siftos_internal" : "mutation";
  if (["bash", "shell", "exec"].includes(tool)) return readOnlyShell(values[0]) ? "read" : "mutation";
  return "unknown";
}

export function classifyLevel(state, toolName, toolInput) {
  const text = `${state.prompt ?? ""}\n${String(toolName ?? "")}\n${toolStrings(toolInput).join(" ")}`.toLowerCase();
  if (/pricing|billing|subscription|\bplans?\b|paywall|\bicp\b|account model|marketplace|payment|stripe|business model/.test(text)) return "L3";
  if (/referral|invite|export|notification|oauth|login|integration|onboard|permission|workspace|team|trial|activation/.test(text)) return "L2";
  if (/\bcopy\b|\bcta\b|label|tooltip|\.css|spacing|button text/.test(text)) return "L1";
  if (state.candidate === "technical") return "L0";
  return state.candidate === "obvious_product" || state.candidate === "possible_product" ? "L2" : "L0";
}

function verdict(level, enforcement) {
  if (enforcement === "off" || enforcement === "advisory" || !enforcement) return "ALLOW";
  if (enforcement === "strict") {
    if (level === "L0") return "ALLOW";
    if (level === "L1") return "ADVISE";
    return "REQUIRE_RESOLUTION";
  }
  return level === "L2" || level === "L3" ? "BLOCK_UNTIL_RESOLVED" : "ALLOW";
}

export function beforeMutation(root, { toolName, toolInput }) {
  const state = loadRuntime(root);
  const hook = effectiveHook(root, "before_mutation", state);
  if (!hook.enabled) return { allowed: true, disabled: true, level: null, verdict: "ALLOW", message: "SiftOS Product Guard is disabled." };
  state.heartbeat.before_mutation = now();
  const effect = classifyToolEffect(toolName, toolInput);
  if (effect === "read" || effect === "siftos_internal") {
    saveRuntime(root, state);
    return { allowed: true, level: "L0", verdict: "ALLOW", message: "" };
  }
  const level = classifyLevel(state, toolName, toolInput);
  state.guard.intent_id = state.turn_id ?? state.guard.intent_id ?? "unknown-turn";
  state.guard.level = level;
  const authorized = state.guard.intent_id === (state.turn_id ?? state.guard.intent_id)
    && AUTHORIZING_RESOLUTIONS.has(state.guard.resolution)
    && (state.guard.status === "resolved" || state.guard.status === "bypassed");
  if (authorized) {
    state.mutation.started = true;
    saveRuntime(root, state);
    return { allowed: true, level, verdict: "ALLOW", message: `SiftOS Product Guard resolved via ${state.guard.resolution}.` };
  }
  const gate = verdict(level, hook.enforcement ?? "advisory");
  if (gate === "ALLOW" || gate === "ADVISE") {
    state.mutation.started = true;
    saveRuntime(root, state);
    const message = gate === "ADVISE" || hook.enforcement === "advisory"
      ? `SiftOS advisory: ${level} product change detected; no accepted Bet is attached.` : "";
    return { allowed: true, level, verdict: gate, message };
  }
  const firstBlock = !state.guard.block_issued;
  state.guard.block_issued = true;
  state.guard.status = "unresolved";
  state.metrics.guard_blocked = (state.metrics.guard_blocked ?? 0) + 1;
  saveRuntime(root, state);
  const message = firstBlock
    ? `SiftOS Product Guard: ${level} material product change is unresolved. Before modifying product code, resolve with prototype, existing_bet (accepted+), or build_anyway. shape/validate/reconsider may run inside .product/ but do not authorize production mutation.`
    : `SiftOS Product Guard: this product intent is still unresolved. Retrying the mutation does not bypass the gate; choose prototype, an accepted existing Bet, or build_anyway.`;
  return { allowed: false, level, verdict: gate, message };
}

export function recordMutation(root, { toolInput }) {
  const state = loadRuntime(root);
  if (!effectiveHook(root, "after_mutation", state).enabled) return state;
  const files = toolStrings(toolInput).filter((value) => /[\\/]|\.[A-Za-z0-9]{1,8}$/.test(value));
  for (const file of files) if (!state.mutation.files.includes(file)) state.mutation.files.push(file);
  state.mutation.started = true;
  state.heartbeat.after_mutation = now();
  saveRuntime(root, state);
  return state;
}

function readContext(root, name) {
  try { return readFileSync(path.join(root, ".product", name), "utf8").trim(); }
  catch { return ""; }
}

function trimContext(text, max = 700) { return text.length <= max ? text : `${text.slice(0, max)}…`; }

export function buildCapsule(root, state = loadRuntime(root)) {
  const lines = ["SIFTOS PRODUCT CONTEXT"];
  for (const [label, file] of [["Product", "PRODUCT.md"], ["Strategy", "STRATEGY.md"], ["Metrics", "METRICS.md"], ["Principles", "PRINCIPLES.md"]]) {
    const value = readContext(root, file);
    if (value) lines.push("", `${label}:`, trimContext(value));
  }
  if (state.active_bet) {
    const { decisions } = loadAll(root);
    const bet = decisions.find((d) => d.id === state.active_bet);
    if (bet) {
      lines.push("", `Active Bet: ${bet.id} — ${bet.title} (${bet.status})`);
      const scope = sectionItems(bet, "Scope");
      const nonGoals = sectionItems(bet, "Non-Goals");
      if (scope.length) lines.push(`Scope: ${scope.join("; ")}`);
      if (nonGoals.length) lines.push(`Non-goals: ${nonGoals.join("; ")}`);
    }
  }
  return lines.join("\n");
}

function hasContent(items) { return Array.isArray(items) && items.length > 0; }

export function deterministicShipGate(root, decision) {
  if (!ACCEPTED_PLUS.has(decision.status)) return { result: "NOT_REQUIRED", findings: [] };
  const findings = [];
  const error = (rule, message) => findings.push({ severity: "ERROR", rule, message });
  const warn = (rule, message) => findings.push({ severity: "WARNING", rule, message });
  if (!hasContent(sectionItems(decision, "Target User"))) warn("missing-target-user", "No target user defined.");
  if (!decision.goal && !hasContent(sectionItems(decision, "Goal")) && !hasContent(sectionItems(decision, "Context"))) error("missing-problem", "No problem/goal defined.");
  if (!hasContent(sectionItems(decision, "Expected Outcome")) && !hasContent(sectionItems(decision, "Primary Metric"))) error("missing-outcome", "No expected outcome/metric defined.");
  if (!hasContent(sectionItems(decision, "Revisit Condition"))) warn("missing-review-condition", "No revisit condition defined.");
  if (!hasContent(sectionItems(decision, "Scope"))) warn("missing-scope", "No scope defined.");
  if (!hasContent(sectionItems(decision, "Guardrails"))) warn("missing-guardrail", "No guardrails defined.");
  if (findings.some((f) => f.severity === "ERROR")) return { result: "FAIL", findings };
  return { result: findings.length ? "PASS_WITH_WARNINGS" : "PASS", findings };
}

export function closeout(root) {
  const state = loadRuntime(root);
  const hook = effectiveHook(root, "turn_stop", state);
  state.heartbeat.turn_stop = now();
  if (!hook.enabled || !state.mutation.started || !state.active_bet) {
    saveRuntime(root, state);
    return { continue: false, message: "" };
  }
  const { decisions } = loadAll(root);
  const bet = decisions.find((d) => d.id === state.active_bet);
  if (!bet) {
    saveRuntime(root, state);
    return { continue: false, message: `SiftOS closeout: active Bet ${state.active_bet} was not found.` };
  }
  const gate = deterministicShipGate(root, bet);
  state.ship_gate = {
    required: gate.result !== "NOT_REQUIRED",
    passed: gate.result === "FAIL" ? false : gate.result === "NOT_REQUIRED" ? null : true,
    result: gate.result,
    continuations: state.ship_gate.continuations ?? 0,
  };
  const needsAttention = gate.result === "FAIL" || gate.result === "PASS_WITH_WARNINGS";
  const mayContinue = hook.enforcement !== "advisory" && needsAttention && (state.ship_gate.continuations ?? 0) < 1;
  if (mayContinue) state.ship_gate.continuations = (state.ship_gate.continuations ?? 0) + 1;
  saveRuntime(root, state);
  const details = gate.findings.map((f) => `${f.severity} ${f.rule}: ${f.message}`).join("; ");
  return {
    continue: mayContinue,
    message: needsAttention ? `SiftOS Ship Gate ${gate.result} for ${bet.id}. ${details}` : "",
  };
}

export function clearTurn(root) {
  const state = loadRuntime(root);
  state.turn_id = null;
  state.prompt = null;
  state.candidate = null;
  state.guard = { intent_id: null, status: "idle", level: null, resolution: null, block_issued: false };
  state.active_bet = null;
  state.mutation = { files: [], started: false };
  state.ship_gate = { required: false, passed: null, result: null, continuations: 0 };
  saveRuntime(root, state);
}

export function clearSession(root) {
  const state = loadRuntime(root);
  state.hook_overrides = {};
  state.heartbeat.session_end = now();
  saveRuntime(root, state);
}

export function productRoot(cwd = process.cwd()) { return findProductRoot(cwd); }
