// Shared zero-dependency runtime for Codex/OpenCode lifecycle adapters.
// Product judgment stays in the skill; this module owns deterministic policy.
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { findProductRoot, loadAll, sectionItems } from "./lib.mjs";

export const HOOK_NAMES = [
  "session_start", "prompt_submit", "before_mutation", "after_mutation",
  "turn_stop", "context_compact", "subagent_start", "session_end",
];
const ENFORCEMENTS = new Set(["off", "advisory", "balanced", "strict"]);
const FAILURE_POLICIES = new Set(["fail_open", "fail_closed"]);
const PRESETS = new Set(["off", "advisory", "balanced", "strict", "custom"]);
const AUTHORIZING_RESOLUTIONS = new Set(["prototype", "existing_bet", "build_anyway"]);
const POLICY = JSON.parse(readFileSync(new URL("./policy.json", import.meta.url), "utf8"));
const BUILD_AUTHORIZING_STATUSES = new Set(POLICY.build_authorizing_statuses);
const SHIP_GATE_STATUSES = new Set(POLICY.ship_gate_statuses);
const L3_PATTERNS = POLICY.guard.l3.map((value) => new RegExp(value, "i"));
const L2_PATTERNS = POLICY.guard.l2.map((value) => new RegExp(value, "i"));
const L1_PATTERNS = POLICY.guard.l1.map((value) => new RegExp(value, "i"));
const NON_PRODUCT_PATHS = POLICY.guard.non_product_paths.map((value) => new RegExp(value, "i"));
const CANDIDATE_PATTERNS = {
  obvious_product: POLICY.guard.candidate.obvious_product.map((value) => new RegExp(value, "i")),
  technical: POLICY.guard.candidate.technical.map((value) => new RegExp(value, "i")),
  possible_product: POLICY.guard.candidate.possible_product.map((value) => new RegExp(value, "i")),
};

function now() { return new Date().toISOString(); }
function runtimeFile(root) { return path.join(root, ".product", ".runtime", "session.json"); }

export function defaultRuntime() {
  return {
    session_id: randomUUID(), turn_id: null, prompt: null, hook_overrides: {}, candidate: null,
    guard: { intent_id: null, status: "idle", level: null, resolution: null, block_issued: false },
    active_bet: null, mutation: { files: [], started: false },
    ship_gate: { required: false, passed: null, result: null, continuations: 0 },
    heartbeat: {}, metrics: {},
  };
}

export function loadRuntime(root) {
  const file = runtimeFile(root);
  if (!existsSync(file)) return defaultRuntime();
  try {
    const raw = JSON.parse(readFileSync(file, "utf8"));
    const base = defaultRuntime();
    const rawGuard = raw.guard ?? {};
    const guard = { ...base.guard, ...rawGuard };
    if (!rawGuard.intent_id || !rawGuard.status) {
      guard.intent_id = null;
      guard.status = rawGuard.level ? "unresolved" : "idle";
      guard.resolution = null;
      guard.block_issued = Boolean(rawGuard.block_issued);
    }
    return {
      ...base, ...raw,
      hook_overrides: { ...base.hook_overrides, ...(raw.hook_overrides ?? {}) }, guard,
      mutation: { ...base.mutation, ...(raw.mutation ?? {}) },
      ship_gate: { ...base.ship_gate, ...(raw.ship_gate ?? {}) },
      heartbeat: { ...(raw.heartbeat ?? {}) }, metrics: { ...(raw.metrics ?? {}) },
    };
  } catch { return defaultRuntime(); }
}

export function saveRuntime(root, state) {
  const dir = path.dirname(runtimeFile(root)); mkdirSync(dir, { recursive: true });
  const file = runtimeFile(root); const tmp = `${file}.tmp-${process.pid}-${Date.now()}`;
  writeFileSync(tmp, JSON.stringify(state, null, 2) + "\n");
  try { renameSync(tmp, file); } catch (error) { rmSync(tmp, { force: true }); throw error; }
}

function loadJson(file) { try { return JSON.parse(readFileSync(file, "utf8")); } catch { return null; } }
function validHookEntry(value) {
  if (!value || typeof value !== "object" || Array.isArray(value) || typeof value.enabled !== "boolean") return false;
  if (value.enforcement !== undefined && !ENFORCEMENTS.has(value.enforcement)) return false;
  if (value.failure_policy !== undefined && !FAILURE_POLICIES.has(value.failure_policy)) return false;
  return true;
}
export function validateHooksBlock(raw) {
  if (raw === null || raw === undefined) return { valid: true, value: null };
  if (typeof raw !== "object" || Array.isArray(raw)) return { valid: false, value: null };
  if (raw.preset !== undefined && !PRESETS.has(raw.preset)) return { valid: false, value: null };
  for (const name of HOOK_NAMES) if (raw[name] !== undefined && !validHookEntry(raw[name])) return { valid: false, value: null };
  return { valid: true, value: raw };
}
function normalizePreset(value) { return PRESETS.has(value) ? value : null; }
function presetHook(preset, name) {
  if (preset === "off") return { enabled: false };
  if (name === "before_mutation") return { enabled: true, enforcement: preset, failure_policy: preset === "strict" ? "fail_closed" : "fail_open" };
  if (name === "turn_stop") return { enabled: true, enforcement: preset, failure_policy: "fail_open" };
  if (name === "prompt_submit") return { enabled: true, enforcement: "advisory", failure_policy: "fail_open" };
  return { enabled: true, failure_policy: "fail_open" };
}

export function effectiveHook(root, name, state = loadRuntime(root)) {
  const repo = loadJson(path.join(root, ".product", "config.json"));
  const global = loadJson(path.join(os.homedir(), ".siftos", "config.json"));
  const validation = validateHooksBlock(repo?.hooks ?? null);
  if (!validation.valid) {
    const config_error = "invalid repository hooks config";
    return name === "before_mutation"
      ? { enabled: true, enforcement: "strict", failure_policy: "fail_closed", config_error }
      : { enabled: false, enforcement: "off", failure_policy: "fail_open", config_error };
  }
  const raw = validation.value;
  const repoPreset = normalizePreset(raw?.preset); const globalPreset = normalizePreset(global?.default_hook_preset);
  const explicitEntries = HOOK_NAMES.some((hookName) => raw?.[hookName] !== undefined);
  let base;
  if (repoPreset === "custom" || (!repoPreset && explicitEntries)) base = raw?.[name] ? { ...raw[name] } : { enabled: false };
  else if (repoPreset) base = presetHook(repoPreset, name);
  else if (globalPreset && globalPreset !== "custom") base = presetHook(globalPreset, name);
  else base = { enabled: false };
  if (repoPreset && repoPreset !== "custom" && raw?.[name]) base = { ...base, ...raw[name] };
  if (state.hook_overrides?.[name]) base = { ...base, ...state.hook_overrides[name] };
  return base;
}

export function observe(root, state, hookName) { state.heartbeat[hookName] = now(); saveRuntime(root, state); }
function resolutionFromPrompt(prompt) {
  const text = String(prompt ?? "").toLowerCase();
  if (/\b(build anyway|just (build|implement)|skip (the )?(product )?(check|guard)|proceed anyway)\b/.test(text)) return "build_anyway";
  if (/\bprototype\b/.test(text)) return "prototype";
  if (/\b(existing bet|use (the )?bet|attach .*bet)\b/.test(text) || /\bDEC-\d{4}\b/i.test(String(prompt ?? ""))) return "existing_bet";
  if (/\bshape\b/.test(text)) return "shape"; if (/\bvalidate\b/.test(text)) return "validate"; if (/\breconsider\b/.test(text)) return "reconsider";
  return null;
}
function decisionIdFromPrompt(prompt) { return String(prompt ?? "").match(/\bDEC-\d{4}\b/i)?.[0]?.toUpperCase() ?? null; }
export function classifyCandidate(prompt) {
  const text = String(prompt ?? "").toLowerCase().trim();
  if (!text) return "unknown";
  if (CANDIDATE_PATTERNS.obvious_product.some((pattern) => pattern.test(text))) return "obvious_product";
  if (CANDIDATE_PATTERNS.technical.some((pattern) => pattern.test(text))) return "technical";
  if (CANDIDATE_PATTERNS.possible_product.some((pattern) => pattern.test(text))) return "possible_product";
  return "unknown";
}
export function startTurn(root, { turnId, prompt }) {
  const state = loadRuntime(root); const id = String(turnId || `turn-${Date.now()}`);
  if (state.turn_id !== id) {
    state.turn_id = id; state.prompt = String(prompt ?? ""); state.candidate = classifyCandidate(prompt);
    state.guard = { intent_id: id, status: "unresolved", level: null, resolution: null, block_issued: false };
    state.active_bet = null; state.mutation = { files: [], started: false };
    state.ship_gate = { required: false, passed: null, result: null, continuations: 0 };
  }
  const resolution = resolutionFromPrompt(prompt);
  if (resolution) {
    state.guard.resolution = resolution;
    if (resolution === "build_anyway") state.guard.status = "bypassed";
    else if (resolution === "prototype") state.guard.status = "resolved";
    else if (resolution === "existing_bet") {
      const decisionId = decisionIdFromPrompt(prompt); const { decisions } = loadAll(root);
      const decision = decisionId ? decisions.find((item) => item.id === decisionId) : null;
      if (decision && BUILD_AUTHORIZING_STATUSES.has(decision.status)) { state.active_bet = decision.id; state.guard.status = "resolved"; }
    }
  }
  state.heartbeat.prompt_submit = now(); saveRuntime(root, state); return state;
}
export function startSession(root, sessionId) {
  const state = defaultRuntime(); state.session_id = String(sessionId || state.session_id); state.heartbeat.session_start = now(); saveRuntime(root, state); return state;
}
function strings(value, out = []) {
  if (typeof value === "string") out.push(value); else if (Array.isArray(value)) for (const item of value) strings(item, out);
  else if (value && typeof value === "object") for (const item of Object.values(value)) strings(item, out); return out;
}
export function toolStrings(toolInput) { return strings(toolInput ?? {}); }
function shellEffect(command) {
  const cmd = String(command ?? "").trim(); if (!cmd) return "read";
  if (/^(?:npm|pnpm|yarn)\s+(?:test|run\s+(?:test|typecheck))(?:\s|$)/i.test(cmd)) return "verification";
  if (/^(?:pwd|ls|find|cat|head|tail|rg|grep)(?:\s|$)/i.test(cmd) || /^git\s+(?:status|diff|log|show)(?:\s|$)/i.test(cmd)) return "read";
  if (/^(?:node|npm|pnpm|yarn)\s+--version(?:\s|$)/i.test(cmd)) return "read";
  if (/\b(?:npm|pnpm|yarn)\s+(?:install|i|add|run\s+build|build)\b/i.test(cmd) || /[>|;&]/.test(cmd)) return "mutation";
  if (/\b(?:rm|mv|cp|mkdir|touch)\b|\bsed\s+-i\b|\bgit\s+(?:checkout|reset|clean|commit|add|restore)\b/i.test(cmd)) return "mutation";
  return "unknown";
}
export function classifyToolEffect(toolName, toolInput) {
  const tool = String(toolName ?? "").toLowerCase(); const values = toolStrings(toolInput); const joined = values.join(" ").toLowerCase();
  if (["read", "grep", "glob", "search", "show", "view", "cat", "ls", "list", "status", "audit", "context"].includes(tool)) return "read";
  if (["write", "edit", "apply_patch", "apply", "patch", "multiedit", "rename", "insert", "delete"].includes(tool)) {
    const internal = joined.includes(".product/") || joined.includes(".agents/skills/siftos/") || joined.includes(".siftos"); return internal ? "siftos_internal" : "mutation";
  }
  if (["bash", "shell", "exec"].includes(tool)) return shellEffect(values[0] ?? joined); return "unknown";
}
function pathLike(value) { return /[\\/]|\.[A-Za-z0-9]{1,8}(?:\s|$)/.test(value); }
function nonProductTarget(value) { const normalized = String(value).replace(/\\/g, "/").toLowerCase(); return NON_PRODUCT_PATHS.some((pattern) => pattern.test(normalized)); }
export function classifyLevel(state, toolName, toolInput) {
  const values = toolStrings(toolInput); const targets = values.filter(pathLike);
  if (targets.length > 0 && targets.every(nonProductTarget)) return "L0";
  const text = `${state.prompt ?? ""}\n${String(toolName ?? "")}\n${values.join(" ")}`.toLowerCase();
  if (L3_PATTERNS.some((pattern) => pattern.test(text))) return "L3"; if (L2_PATTERNS.some((pattern) => pattern.test(text))) return "L2"; if (L1_PATTERNS.some((pattern) => pattern.test(text))) return "L1";
  if (state.candidate === "technical") return "L0"; return state.candidate === "obvious_product" || state.candidate === "possible_product" ? "L2" : "L0";
}
function verdict(level, enforcement) {
  if (enforcement === "off" || enforcement === "advisory" || !enforcement) return "ALLOW";
  if (enforcement === "strict") { if (level === "L0") return "ALLOW"; if (level === "L1") return "ADVISE"; return "REQUIRE_RESOLUTION"; }
  return level === "L2" || level === "L3" ? "BLOCK_UNTIL_RESOLVED" : "ALLOW";
}
export function beforeMutation(root, { toolName, toolInput }) {
  const state = loadRuntime(root); const hook = effectiveHook(root, "before_mutation", state);
  if (hook.config_error) return { allowed: false, disabled: false, level: null, verdict: "CONFIG_ERROR", message: `SiftOS Product Guard configuration error: ${hook.config_error}. Fix .product/config.json; mutation is denied until policy is unambiguous.` };
  if (!hook.enabled) return { allowed: true, disabled: true, level: null, verdict: "ALLOW", message: "" };
  state.heartbeat.before_mutation = now(); const effect = classifyToolEffect(toolName, toolInput);
  if (effect === "read" || effect === "verification" || effect === "siftos_internal") { saveRuntime(root, state); return { allowed: true, level: "L0", verdict: "ALLOW", message: "" }; }
  const level = classifyLevel(state, toolName, toolInput); state.guard.intent_id = state.turn_id ?? state.guard.intent_id ?? "unknown-turn"; state.guard.level = level;
  const authorized = state.guard.intent_id === (state.turn_id ?? state.guard.intent_id) && AUTHORIZING_RESOLUTIONS.has(state.guard.resolution) && (state.guard.status === "resolved" || state.guard.status === "bypassed");
  if (authorized) { state.mutation.started = true; saveRuntime(root, state); return { allowed: true, level, verdict: "ALLOW", message: `SiftOS Product Guard resolved via ${state.guard.resolution}.` }; }
  const gate = verdict(level, hook.enforcement ?? "advisory");
  if (gate === "ALLOW" || gate === "ADVISE") {
    state.mutation.started = effect === "mutation" || effect === "unknown"; saveRuntime(root, state);
    return { allowed: true, level, verdict: gate, message: gate === "ADVISE" || hook.enforcement === "advisory" ? `SiftOS advisory: ${level} product change detected; no accepted Bet is attached.` : "" };
  }
  const firstBlock = !state.guard.block_issued; state.guard.block_issued = true; state.guard.status = "unresolved"; state.metrics.guard_blocked = (state.metrics.guard_blocked ?? 0) + 1; saveRuntime(root, state);
  return { allowed: false, level, verdict: gate, message: firstBlock ? `SiftOS Product Guard: ${level} material product change is unresolved. Resolve with prototype, existing_bet (accepted+), or build_anyway. shape/validate/reconsider do not authorize production mutation.` : `SiftOS Product Guard: this product intent is still unresolved. Retrying the mutation does not bypass the gate.` };
}
function mutationPaths(toolName, toolInput) {
  const tool = String(toolName ?? "").toLowerCase();
  const values = toolStrings(toolInput);
  const tokens = ["bash", "shell", "exec"].includes(tool)
    ? values.flatMap((value) => String(value).split(/\s+/))
    : values;
  return tokens.filter((value) => /[\\/]|\.[A-Za-z0-9]{1,8}$/.test(value));
}
export function recordMutation(root, { toolName, toolInput }) {
  const state = loadRuntime(root); if (!effectiveHook(root, "after_mutation", state).enabled) return state;
  if (classifyToolEffect(toolName, toolInput) !== "mutation") return state;
  const files = mutationPaths(toolName, toolInput); for (const file of files) if (!state.mutation.files.includes(file)) state.mutation.files.push(file);
  state.mutation.started = true; state.heartbeat.after_mutation = now(); saveRuntime(root, state); return state;
}
function readContext(root, name) { try { return readFileSync(path.join(root, ".product", name), "utf8").trim(); } catch { return ""; } }
function trimContext(text, max = 700) { return text.length <= max ? text : `${text.slice(0, max)}…`; }
export function buildCapsule(root, state = loadRuntime(root)) {
  const lines = ["SIFTOS PRODUCT CONTEXT"];
  for (const [label, file] of [["Product", "PRODUCT.md"], ["Strategy", "STRATEGY.md"], ["Metrics", "METRICS.md"], ["Principles", "PRINCIPLES.md"]]) { const value = readContext(root, file); if (value) lines.push("", `${label}:`, trimContext(value)); }
  if (state.active_bet) { const { decisions } = loadAll(root); const bet = decisions.find((item) => item.id === state.active_bet); if (bet) { lines.push("", `Active Bet: ${bet.id} — ${bet.title} (${bet.status})`); const scope = sectionItems(bet, "Scope"); const nonGoals = sectionItems(bet, "Non-Goals"); if (scope.length) lines.push(`Scope: ${scope.join("; ")}`); if (nonGoals.length) lines.push(`Non-goals: ${nonGoals.join("; ")}`); } }
  return lines.join("\n");
}
function hasContent(items) { return Array.isArray(items) && items.length > 0; }
function bodyText(decision) { return Object.values(decision.body ?? {}).flat().join("\n").toLowerCase(); }
export function deterministicShipGate(root, decision) {
  if (!SHIP_GATE_STATUSES.has(decision.status)) return { result: "NOT_REQUIRED", findings: [] };
  const findings = []; const error = (rule, message) => findings.push({ severity: "ERROR", rule, message }); const warn = (rule, message) => findings.push({ severity: "WARNING", rule, message });
  if (!hasContent(sectionItems(decision, "Target User"))) warn("missing-target-user", "No target user defined.");
  if (!decision.goal && !hasContent(sectionItems(decision, "Goal")) && !hasContent(sectionItems(decision, "Context"))) error("missing-problem", "No problem/goal defined — a bet ships against a problem.");
  const hasExpected = hasContent(sectionItems(decision, "Expected Outcome")); const hasMetric = hasContent(sectionItems(decision, "Primary Metric"));
  if (!hasExpected && !hasMetric) { error("missing-expected-outcome", "No expected outcome or primary metric recorded."); error("missing-metric", "No primary metric or expected outcome to measure."); } else if (!hasExpected) warn("missing-expected-outcome", "No quantified expected outcome — only a primary metric.");
  const expectedText = sectionItems(decision, "Expected Outcome").join(" "); if (!/\d/.test(expectedText)) warn("missing-success-threshold", "Success threshold is not quantified.");
  const metrics = readContext(root, "METRICS.md"); const hasBaseline = /baseline:\s*(?!unknown\b)[^\n]*\S/i.test(metrics); if (!hasBaseline && !/\d/.test(expectedText)) warn("missing-baseline", "No baseline — relative success cannot be evaluated.");
  if (!/\b(instrument|analytics|event|track)\b/i.test(bodyText(decision))) warn("missing-instrumentation", "No instrumentation/measurement plan detected.");
  if (!hasContent(sectionItems(decision, "Guardrails"))) warn("missing-guardrail", "No guardrails defined."); if (!hasContent(sectionItems(decision, "Revisit Condition"))) warn("missing-review-condition", "No revisit condition defined."); if (!hasContent(sectionItems(decision, "Scope"))) warn("missing-scope", "No scope defined — scope drift cannot be checked.");
  if (findings.some((finding) => finding.severity === "ERROR")) return { result: "FAIL", findings }; return { result: findings.length ? "PASS_WITH_WARNINGS" : "PASS", findings };
}
function deriveActiveBet(decisions) {
  const active = decisions.filter((decision) => decision.status === "building" || decision.status === "accepted");
  return active.length === 1 ? active[0] : null;
}
export function closeout(root) {
  const state = loadRuntime(root); const hook = effectiveHook(root, "turn_stop", state); state.heartbeat.turn_stop = now();
  if (!hook.enabled || !state.mutation.started) { saveRuntime(root, state); return { continue: false, message: "" }; }
  const { decisions } = loadAll(root); let bet = state.active_bet ? decisions.find((item) => item.id === state.active_bet) : null; if (!bet) { bet = deriveActiveBet(decisions); if (bet) state.active_bet = bet.id; }
  if (!bet) { saveRuntime(root, state); return { continue: false, message: "SiftOS closeout advisory: implementation mutations occurred but no unique active Bet (building/accepted) is attached. Run /siftos ship manually when a Bet is known." }; }
  const gate = deterministicShipGate(root, bet); state.ship_gate = { required: gate.result !== "NOT_REQUIRED", passed: gate.result === "FAIL" ? false : gate.result === "NOT_REQUIRED" ? null : true, result: gate.result, continuations: state.ship_gate.continuations ?? 0 };
  const needsAttention = gate.result === "FAIL" || gate.result === "PASS_WITH_WARNINGS"; const mayContinue = hook.enforcement !== "advisory" && hook.enforcement !== "off" && needsAttention && (state.ship_gate.continuations ?? 0) < 1; if (mayContinue) state.ship_gate.continuations = (state.ship_gate.continuations ?? 0) + 1; saveRuntime(root, state);
  const details = gate.findings.map((finding) => `${finding.severity} ${finding.rule}: ${finding.message}`).join("; "); return { continue: mayContinue, message: needsAttention ? `SiftOS Ship Gate ${gate.result} for ${bet.id}. ${details}` : "" };
}
export function clearTurn(root) { const state = loadRuntime(root); state.turn_id = null; state.prompt = null; state.candidate = null; state.guard = { intent_id: null, status: "idle", level: null, resolution: null, block_issued: false }; state.active_bet = null; state.mutation = { files: [], started: false }; state.ship_gate = { required: false, passed: null, result: null, continuations: 0 }; saveRuntime(root, state); }
export function clearSession(root) { const state = defaultRuntime(); state.heartbeat.session_end = now(); saveRuntime(root, state); }
export function productRoot(cwd = process.cwd()) { return findProductRoot(cwd); }
