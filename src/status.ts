import type { DecisionStatus } from "./types.js";

export const STATUS_ORDER: DecisionStatus[] = [
  "draft",
  "proposed",
  "accepted",
  "shipped",
  "reviewed",
  "rejected",
  "cancelled",
  "superseded",
];

/**
 * Lifecycle (PRD §§23–24). Main flow:
 *   draft → proposed → accepted → shipped → reviewed
 * Alternates:
 *   proposed → rejected
 *   accepted → cancelled | superseded
 *   shipped → superseded
 */
const TRANSITIONS: Record<DecisionStatus, DecisionStatus[]> = {
  draft: ["proposed"],
  proposed: ["accepted", "rejected"],
  accepted: ["shipped", "cancelled", "superseded"],
  shipped: ["reviewed", "superseded"],
  reviewed: [],
  rejected: [],
  cancelled: [],
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
