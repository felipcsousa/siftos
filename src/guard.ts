import type { HookEnforcement } from "./config.js";

/**
 * Product Guard (PRD V2 §47–§63).
 *
 * D3 decision: on agent-executed hooks the model classifies the level
 * (L0–L3) with product context; on script-executed hooks (no LLM) the
 * deterministic keyword table classifies. The gate — level ×
 * enforcement → verdict — is ALWAYS deterministic, so blocking never
 * depends on model availability (PRD V2 NFR-003).
 */

export type ToolEffect = "read" | "siftos_internal" | "mutation" | "unknown";
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

/** Tool effect classifier (PRD V2 §64–§65). Reads are never gated. */
const READ_TOOLS = new Set([
  "read",
  "grep",
  "glob",
  "search",
  "show",
  "view",
  "cat",
  "ls",
  "list",
  "status",
  "audit",
  "context",
]);
const MUTATING_TOOLS = new Set([
  "write",
  "edit",
  "patch",
  "apply",
  "rm",
  "mkdir",
  "mv",
  "cp",
  "exec",
  "bash",
  "shell",
  "rename",
  "insert",
  "delete",
]);
const INTERNAL_PATTERNS = [".product/", ".agents/skills/siftos/", ".siftos"];

export function classifyToolEffect(tool: string, args: string[]): ToolEffect {
  const t = tool.toLowerCase();
  if (READ_TOOLS.has(t)) return "read";
  const joined = args.join(" ").toLowerCase();
  // The internal exemption covers SiftOS's own writes (.product/,
  // skill install). It applies ONLY to direct write tools: a shell
  // command that merely mentions .product/ has unknown side effects
  // and must stay gated (PRD V2 §65).
  if (t === "write" || t === "edit" || t === "patch") {
    if (INTERNAL_PATTERNS.some((p) => joined.includes(p))) return "siftos_internal";
  }
  if (MUTATING_TOOLS.has(t)) return "mutation";
  if (/^(write|edit|patch|rm|mkdir|mv|cp|apply)\b/.test(joined)) return "mutation";
  return "unknown";
}

/**
 * Deterministic fallback classifier (script hooks, offline). Path/keyword
 * rules mirror the PRD examples (§48–§51). Agent-executed hooks may
 * override the level with model judgment + rationale.
 */
const L3_PATTERNS: RegExp[] = [
  /pricing/,
  /billing/,
  /subscription/,
  /\bplans?\b/,
  /paywall/,
  /\bicp\b/,
  /account model/,
  /marketplace/,
  /payment/,
  /stripe/,
];
const L2_PATTERNS: RegExp[] = [
  /referral/,
  /invite/,
  /export/,
  /notification/,
  /oauth/,
  /login/,
  /integration/,
  /onboard/,
  /permission/,
];
const L1_PATTERNS: RegExp[] = [
  /\bcopy\b/,
  /\bcta\b/,
  /label/,
  /tooltip/,
  /\.css/,
  /spacing/,
  /button text/,
];

export function classifyLevelDeterministic(files: string[]): GuardLevel {
  const joined = files.join(" ").toLowerCase();
  if (L3_PATTERNS.some((re) => re.test(joined))) return "L3";
  if (L2_PATTERNS.some((re) => re.test(joined))) return "L2";
  if (L1_PATTERNS.some((re) => re.test(joined))) return "L1";
  if (files.length === 0) return "UNKNOWN";
  return "L0";
}

/**
 * Deterministic policy gate (PRD V2 §60–§61). `advisory` never blocks;
 * `balanced` blocks L2/L3 once; `strict` hard-gates L2/L3 and unknown
 * mutations.
 */
export function guardVerdict(level: GuardLevel, enforcement: HookEnforcement): GuardVerdict {
  switch (enforcement) {
    case "off":
    case "advisory":
      return "ALLOW";
    case "balanced":
      switch (level) {
        case "L0":
        case "L1":
        case "UNKNOWN":
          return "ALLOW";
        case "L2":
        case "L3":
          return "BLOCK_ONCE";
      }
      break;
    case "strict":
      switch (level) {
        case "L0":
          return "ALLOW";
        case "L1":
          return "ADVISE";
        case "L2":
        case "L3":
        case "UNKNOWN":
          return "REQUIRE_RESOLUTION";
      }
      break;
  }
  return "ALLOW";
}

export function guardMessage(
  level: GuardLevel,
  verdict: GuardVerdict,
  files: string[],
): string {
  const head =
    verdict === "BLOCK_ONCE" || verdict === "REQUIRE_RESOLUTION"
      ? "SIFTOS GUARD — BLOCKED"
      : "SIFTOS GUARD";
  const scope = files.length > 0 ? files.slice(0, 5).join(", ") : "unknown scope";
  const lines: string[] = [head, "", `Scope: ${scope}`, `Level: ${level}`, `Verdict: ${verdict}`];
  if (level === "L2" || level === "L3") {
    lines.push(
      "",
      "This looks like a material product change with no supporting bet.",
      "Resolve: shape / validate / prototype / existing_bet / reconsider / build_anyway",
    );
  }
  return lines.join("\n");
}
