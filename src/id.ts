import { DEC_ID_RE } from "./schema.js";

export const MAX_DECISION_ID = 9999;

/**
 * Monotonic ID generation (PRD §26): find the highest existing ID,
 * increment, never reuse a removed ID, pad to 4 digits.
 * Collision is impossible by construction when callers pass the full
 * set of existing IDs; a lock is layered in ProductRepository.
 */
export function nextDecisionId(existing: string[]): string {
  let max = 0;
  for (const id of existing) {
    if (!DEC_ID_RE.test(id)) continue;
    const n = Number(id.slice(4));
    if (n > max) max = n;
  }
  if (max >= MAX_DECISION_ID) {
    throw new Error(`decision id space exhausted at ${DEC_ID_RE.source}`);
  }
  const next = max + 1;
  return `DEC-${String(next).padStart(4, "0")}`;
}

export function decisionIdRank(id: string): number {
  if (!DEC_ID_RE.test(id)) return -1;
  return Number(id.slice(4));
}
