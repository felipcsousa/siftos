import type { DecisionStatus } from "./types.js";

export const STATUS_ORDER: DecisionStatus[] = [
  "draft",
  "shaping",
  "validating",
  "ready",
  "proposed",
  "accepted",
  "building",
  "shipped",
  "measuring",
  "reviewed",
  "rejected",
  "cancelled",
  "paused",
  "failed",
  "superseded",
];

/**
 * Lifecycle (PRD §23–§24 + PRD V2 §87, unified). A "Bet" is a record in
 * the pre-acceptance stretch of the same lifecycle — the graph
 * Bet → Decision → Build → Outcome → Learning is status transitions, not
 * artifact types. v0.2 transitions are preserved verbatim.
 */
const TRANSITIONS: Record<DecisionStatus, DecisionStatus[]> = {
  draft: ["proposed", "shaping", "rejected"],
  shaping: ["validating", "draft", "rejected"],
  validating: ["ready", "shaping", "rejected"],
  ready: ["accepted", "validating", "rejected"],
  proposed: ["accepted", "validating", "rejected"],
  accepted: ["shipped", "building", "cancelled", "superseded"],
  building: ["shipped", "paused", "cancelled", "failed", "superseded"],
  shipped: ["reviewed", "measuring", "superseded"],
  measuring: ["reviewed", "paused", "failed", "superseded", "cancelled"],
  reviewed: [],
  rejected: [],
  cancelled: [],
  paused: ["building", "measuring", "cancelled", "failed"],
  failed: [],
  superseded: [],
};

export interface TransitionResult {
  ok: boolean;
  reason?: string;
}

export function validateTransition(
  from: DecisionStatus,
  to: DecisionStatus,
): TransitionResult {
  if (from === to) return { ok: true };
  const allowed = TRANSITIONS[from] ?? [];
  if (allowed.includes(to)) return { ok: true };
  return {
    ok: false,
    reason: `invalid transition ${from} → ${to}; allowed: ${allowed.join(", ") || "none (terminal)"}`,
  };
}
