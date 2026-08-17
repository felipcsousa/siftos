import { readFileSync } from "node:fs";
import type { HookEnforcement } from "./config.js";

/**
 * Product Guard (PRD V2 §47–§65).
 * Policy data is shared with the standalone hook runtime through
 * skill/scripts/policy.json so CLI and adapters classify the same terms.
 */

export type ToolEffect = "read" | "verification" | "siftos_internal" | "mutation" | "unknown";
export type GuardLevel = "L0" | "L1" | "L2" | "L3" | "UNKNOWN";
export type GuardVerdict = "ALLOW" | "ADVISE" | "BLOCK_ONCE" | "REQUIRE_RESOLUTION";
export type GuardResolution =
  | "shape"
  | "validate"
  | "prototype"
  | "existing_bet"
  | "reconsider"
  | "build_anyway";

export const GUARD_RESOLUTIONS: GuardResolution[] = [
  "shape",
  "validate",
  "prototype",
  "existing_bet",
  "reconsider",
  "build_anyway",
];

export type GuardCandidate = "technical" | "possible_product" | "obvious_product" | "unknown";

interface SharedPolicy {
  build_authorizing_statuses: string[];
  ship_gate_statuses: string[];
  guard: {
    l3: string[];
    l2: string[];
    l1: string[];
    non_product_paths: string[];
    candidate: {
      obvious_product: string[];
      technical: string[];
      possible_product: string[];
    };
  };
}

let POLICY: SharedPolicy;
let POLICY_LOAD_FAILED = false;
try {
  POLICY = JSON.parse(
    readFileSync(new URL("../skill/scripts/policy.json", import.meta.url), "utf8"),
  ) as SharedPolicy;
} catch {
  POLICY_LOAD_FAILED = true;
  POLICY = {
    build_authorizing_statuses: [],
    ship_gate_statuses: [],
    guard: {
      l3: [], l2: [], l1: [], non_product_paths: [],
      candidate: { obvious_product: [], technical: [], possible_product: [] },
    },
  };
}
/** False when the shipped policy data is unreadable/corrupt (fail closed). */
export const POLICY_OK = !POLICY_LOAD_FAILED;

export const BUILD_AUTHORIZING_STATUSES = new Set(POLICY.build_authorizing_statuses);
export const SHIP_GATE_STATUSES = new Set(POLICY.ship_gate_statuses);

const L3_PATTERNS = POLICY.guard.l3.map((value) => new RegExp(value, "i"));
const L2_PATTERNS = POLICY.guard.l2.map((value) => new RegExp(value, "i"));
const L1_PATTERNS = POLICY.guard.l1.map((value) => new RegExp(value, "i"));
const NON_PRODUCT_PATHS = POLICY.guard.non_product_paths.map((value) => new RegExp(value, "i"));
const CANDIDATE_PATTERNS = {
  obvious_product: POLICY.guard.candidate.obvious_product.map((value) => new RegExp(value, "i")),
  technical: POLICY.guard.candidate.technical.map((value) => new RegExp(value, "i")),
  possible_product: POLICY.guard.candidate.possible_product.map((value) => new RegExp(value, "i")),
};

/**
 * Prompt-intent triage shared with the hook runtime. The candidate decides
 * whether a prompt with no explicit policy keyword is still product-flavored
 * (possible/obvious product => L2) so the CLI guard and the automatic hooks
 * gate the same intents.
 */
export function classifyCandidate(input: string): GuardCandidate {
  const text = String(input ?? "").toLowerCase().trim();
  if (!text) return "unknown";
  if (CANDIDATE_PATTERNS.obvious_product.some((pattern) => pattern.test(text))) return "obvious_product";
  if (CANDIDATE_PATTERNS.technical.some((pattern) => pattern.test(text))) return "technical";
  if (CANDIDATE_PATTERNS.possible_product.some((pattern) => pattern.test(text))) return "possible_product";
  return "unknown";
}

const READ_TOOLS = new Set([
  "read", "grep", "glob", "search", "show", "view", "cat", "ls", "list", "status", "audit", "context",
]);
const DIRECT_MUTATING_TOOLS = new Set([
  "write", "edit", "patch", "apply_patch", "apply", "multiedit", "rename", "insert", "delete",
]);
const SHELL_TOOLS = new Set(["bash", "shell", "exec"]);
const INTERNAL_PATTERNS = [".product/", ".agents/skills/siftos/", ".siftos"];

function shellEffect(command: string): ToolEffect {
  const cmd = command.trim();
  if (!cmd) return "read";
  // Compound shell commands may write files — never classify by prefix alone.
  if (/[>|;&]/.test(cmd)) return "mutation";
  // Build/package commands may write artifacts.
  if (/\b(?:npm|pnpm|yarn)\s+(?:install|i|add|run\s+build|build)\b/i.test(cmd)) return "mutation";
  if (/\b(?:rm|mv|cp|mkdir|touch)\b|\bsed\s+-i\b|\bgit\s+(?:checkout|reset|clean|commit|add|restore)\b/i.test(cmd)) {
    return "mutation";
  }
  if (/^(?:npm|pnpm|yarn)\s+(?:test|run\s+(?:test|typecheck))(?:\s|$)/i.test(cmd)) return "verification";
  if (/^(?:pwd|ls|find|cat|head|tail|rg|grep)(?:\s|$)/i.test(cmd)) return "read";
  if (/^git\s+(?:status|diff|log|show)(?:\s|$)/i.test(cmd)) return "read";
  if (/^(?:node|npm|pnpm|yarn)\s+--version(?:\s|$)/i.test(cmd)) return "read";
  return "unknown";
}

/** Tool effect classifier. Read/verification operations are never product-gated. */
export function classifyToolEffect(tool: string, args: string[]): ToolEffect {
  const normalized = tool.toLowerCase();
  if (READ_TOOLS.has(normalized)) return "read";
  const joined = args.join(" ");
  const lower = joined.toLowerCase();
  if (DIRECT_MUTATING_TOOLS.has(normalized)) {
    if (INTERNAL_PATTERNS.some((pattern) => lower.includes(pattern))) return "siftos_internal";
    return "mutation";
  }
  if (SHELL_TOOLS.has(normalized)) return shellEffect(args[0] ?? joined);
  if (/^(?:write|edit|patch|rm|mkdir|mv|cp|apply)\b/i.test(joined)) return "mutation";
  return "unknown";
}

export function isNonProductTarget(value: string): boolean {
  const normalized = value.replace(/\\/g, "/").toLowerCase();
  return NON_PRODUCT_PATHS.some((pattern) => pattern.test(normalized));
}

function pathLike(value: string): boolean {
  return /[\\/]|\.[A-Za-z0-9]{1,8}(?:\s|$)/.test(value);
}

/**
 * Deterministic fallback classifier shared semantically by CLI + hook runtime.
 * Non-product targets (tests/docs/examples/fixtures) are L0 even when the
 * surrounding prompt mentions product terms; this keeps balanced mode from
 * blocking routine verification/documentation edits.
 *
 * When a user prompt is supplied, the same prompt-intent triage as the hook
 * runtime applies: a product-flavored prompt with no explicit policy keyword
 * classifies the mutation as L2, so the manual CLI and the automatic hooks
 * gate the same intents.
 */
export function classifyLevelDeterministic(inputs: string[], prompt?: string): GuardLevel {
  const pathTargets = inputs.filter(pathLike);
  if (pathTargets.length > 0 && pathTargets.every(isNonProductTarget)) return "L0";
  const joined = [...(prompt ? [prompt] : []), ...inputs].join(" ").toLowerCase();
  if (L3_PATTERNS.some((pattern) => pattern.test(joined))) return "L3";
  if (L2_PATTERNS.some((pattern) => pattern.test(joined))) return "L2";
  if (L1_PATTERNS.some((pattern) => pattern.test(joined))) return "L1";
  if (inputs.length === 0 && !prompt) return "UNKNOWN";
  const candidate = prompt ? classifyCandidate(prompt) : "unknown";
  if (candidate === "obvious_product" || candidate === "possible_product") return "L2";
  return "L0";
}

/** Deterministic policy gate. Advisory never blocks; balanced gates L2/L3. */
export function guardVerdict(level: GuardLevel, enforcement: HookEnforcement): GuardVerdict {
  switch (enforcement) {
    case "off":
    case "advisory":
      return "ALLOW";
    case "balanced":
      return level === "L2" || level === "L3" ? "BLOCK_ONCE" : "ALLOW";
    case "strict":
      if (level === "L0") return "ALLOW";
      if (level === "L1") return "ADVISE";
      return "REQUIRE_RESOLUTION";
    default:
      // Missing/unknown enforcement never blocks (advisory semantics).
      return "ALLOW";
  }
}

export function guardMessage(level: GuardLevel, verdict: GuardVerdict, files: string[]): string {
  const head = verdict === "BLOCK_ONCE" || verdict === "REQUIRE_RESOLUTION"
    ? "SIFTOS GUARD — BLOCKED"
    : "SIFTOS GUARD";
  const scope = files.length > 0 ? files.slice(0, 5).join(", ") : "unknown scope";
  const lines = [head, "", `Scope: ${scope}`, `Level: ${level}`, `Verdict: ${verdict}`];
  if (level === "L2" || level === "L3") {
    lines.push(
      "",
      "This looks like a material product change with no supporting bet.",
      "Resolve: shape / validate / prototype / existing_bet / reconsider / build_anyway",
    );
  }
  return lines.join("\n");
}
