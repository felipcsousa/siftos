import type { Decision } from "./types.js";
import type { EffectiveHooks, HookConfig, HookName } from "./config.js";

/**
 * Hook core (PRD V2 §11–§12, §64–§65, §83, §98). Platform-neutral logical
 * events; platform differences live in adapters. Every hook consumes the
 * effective config — never the raw file — and disabled means disabled.
 */

export type ProductHook =
  | "session.start"
  | "prompt.submit"
  | "mutation.before"
  | "mutation.after"
  | "turn.stop"
  | "context.compact"
  | "subagent.start"
  | "session.end";

export const LOGICAL_TO_CONFIG: Record<ProductHook, HookName> = {
  "session.start": "session_start",
  "prompt.submit": "prompt_submit",
  "mutation.before": "before_mutation",
  "mutation.after": "after_mutation",
  "turn.stop": "turn_stop",
  "context.compact": "context_compact",
  "subagent.start": "subagent_start",
  "session.end": "session_end",
};

export interface HookOutcome {
  ran: boolean;
  ok: boolean;
  skipped: boolean;
  error?: string;
}

/**
 * Deterministic execution envelope: enabled check → handler → failure
 * policy on error (PRD V2 §102–§104). No silent failure: fail_open
 * reports the error, fail_closed surfaces it as a hard failure.
 * Handlers are synchronous in the deterministic core.
 */
export function runHook(opts: {
  name: ProductHook;
  effective: EffectiveHooks;
  handler: (config: HookConfig) => HookOutcome | void;
}): HookOutcome {
  const name = LOGICAL_TO_CONFIG[opts.name];
  const config = opts.effective.hooks[name];
  if (!config.enabled) return { ran: false, ok: true, skipped: true };
  try {
    const result = opts.handler(config);
    if (result) return result;
    return { ran: true, ok: true, skipped: false };
  } catch (err) {
    const policy = config.failure_policy ?? "fail_open";
    const message = `SiftOS ${name} hook error: ${(err as Error).message}`;
    if (policy === "fail_closed") {
      return { ran: true, ok: false, skipped: false, error: message };
    }
    return { ran: true, ok: true, skipped: false, error: message };
  }
}

/**
 * Scope drift (PRD V2 §66–§68): implementation footprint vs the bet's
 * `Scope` section. Deterministic: files whose paths mention nothing in
 * the scope are drift candidates; `.product/` files are never drift.
 */
export function detectScopeDrift(
  decision: Decision,
  changedFiles: string[],
): string[] {
  const scopeLines = (decision.body["Scope"] ?? []).map((s) => s.toLowerCase());
  const scopeTokens = scopeLines
    .flatMap((line) => line.replace(/^[-•]\s*/, "").split(/[^a-z0-9]+/))
    .filter((t) => t.length > 2);
  if (scopeTokens.length === 0) {
    // No scope defined: nothing to compare against (missing-scope linter
    // already flags this). Report nothing as drift.
    return [];
  }
  const drift: string[] = [];
  for (const file of changedFiles) {
    const lower = file.toLowerCase();
    if (lower.includes(".product")) continue;
    // Token-boundary match against path segments: a scope token like
    // "link" must not match "hyperlink-utils".
    const segments = lower.split(/[^a-z0-9]+/).filter((s) => s.length > 0);
    const matches = scopeTokens.some((token) => segments.includes(token));
    if (!matches) drift.push(file);
  }
  return drift;
}

/**
 * Context capsule (PRD V2 §54, §77, §79): the compact state injected at
 * session start, compaction restore, and subagent start.
 */
export function buildCapsule(opts: {
  product: string;
  strategy: string;
  metrics: string;
  principles: string;
  activeBet: Decision | null;
  guardPreset: string;
}): string {
  const lines: string[] = [];
  const section = (title: string, content: string) => {
    const trimmed = content.trim();
    if (trimmed === "") return;
    lines.push(title);
    lines.push(trimmed.slice(0, 600));
    lines.push("");
  };
  section("Product", opts.product);
  section("Strategic objective", opts.strategy);
  section("Metrics", opts.metrics);
  section("Principles", opts.principles);
  if (opts.activeBet) {
    lines.push(`Active bet: ${opts.activeBet.id} — ${opts.activeBet.title} (${opts.activeBet.status})`);
    const scope = opts.activeBet.body["Scope"] ?? [];
    if (scope.length > 0) {
      lines.push("Scope:");
      for (const s of scope) lines.push(`- ${s}`);
    }
    const nonGoals = opts.activeBet.body["Non-Goals"] ?? [];
    if (nonGoals.length > 0) {
      lines.push("Non-goals:");
      for (const s of nonGoals) lines.push(`- ${s}`);
    }
    lines.push("");
  }
  lines.push(`Guard preset: ${opts.guardPreset}`);
  return lines.join("\n").trim();
}
