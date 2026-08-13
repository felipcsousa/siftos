import { decisionSchema, validateWithRepair } from "./schema.js";
import type { Decision } from "./types.js";

export interface ValidationIssue {
  path: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  /** PDR is valid but was repaired before validation. */
  repaired: boolean;
  issues: ValidationIssue[];
}

function zodToIssues(err: {
  issues: Array<{ path: (string | number)[]; message: string }>;
}): ValidationIssue[] {
  return err.issues.map((issue) => ({
    path: issue.path.join(".") || "(root)",
    message: issue.message,
  }));
}

/**
 * Schema validation (PRD §22, §68): validate → repair once → revalidate →
 * fail explicitly. A repaired document is flagged so callers can persist
 * the repaired form instead of a corrupted one.
 */
export function validateDecision(input: unknown): ValidationResult {
  const direct = decisionSchema.safeParse(input);
  if (direct.success) return { valid: true, repaired: false, issues: [] };

  const repaired = validateWithRepair(input);
  if ("decision" in repaired) {
    return { valid: true, repaired: true, issues: [] };
  }

  return {
    valid: false,
    repaired: true,
    issues: zodToIssues(repaired.error),
  };
}

/** Convenience: validate a parsed Decision object (already typed). */
export function validateDecisionObject(d: Decision): ValidationResult {
  return validateDecision(d);
}

export { decisionSchema };
