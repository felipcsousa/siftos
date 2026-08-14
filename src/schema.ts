import { z } from "zod";
import { DECISION_SECTIONS, OUTCOME_SECTIONS } from "./types.js";

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const DEC_ID_RE = /^DEC-\d{4}$/;

export const decisionStatusSchema = z.enum([
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
]);

export const confidenceSchema = z.enum(["low", "medium", "high"]);
export const reversibilitySchema = z.enum(["high", "medium", "low"]);
export const costOfDelaySchema = z.enum(["low", "medium", "high", "unknown"]);
export const betClassSchema = z.enum(["offense", "defense", "neither"]);

export const canonicalSections = z.union([
  z.enum([...DECISION_SECTIONS, ...OUTCOME_SECTIONS]),
  z.string(),
]);

export const decisionSchema = z
  .object({
    id: z.string().regex(DEC_ID_RE, "id must match DEC-XXXX"),
    title: z.string().min(1, "title is required"),
    status: decisionStatusSchema,
    createdAt: z.string().regex(DATE_RE, "created_at must be YYYY-MM-DD"),
    updatedAt: z.string().regex(DATE_RE, "updated_at must be YYYY-MM-DD"),
    owner: z.string().min(1).optional(),
    tags: z.array(z.string().min(1)).default([]),
    goal: z.string().min(1).optional(),
    betClass: betClassSchema.optional(),
    confidence: confidenceSchema.optional(),
    reversibility: reversibilitySchema.optional(),
    costOfDelay: costOfDelaySchema.optional(),
    reviewDate: z.string().regex(DATE_RE).nullable().optional(),
    supersedes: z.string().regex(DEC_ID_RE).nullable().optional(),
    supersededBy: z.string().regex(DEC_ID_RE).nullable().optional(),
    agentWorkflowVersion: z.string().min(1).optional(),
    body: z.record(canonicalSections, z.array(z.string())).default({}),
  })
  .strict();

export type ValidatedDecision = z.infer<typeof decisionSchema>;

export interface RepairOutcome {
  ok: boolean;
  repaired: boolean;
  error?: z.ZodError;
}

/**
 * Schema failure protocol (PRD §68): validate, attempt one repair,
 * revalidate, and fail explicitly if still invalid. No partially
 * corrupted document is persisted by callers.
 */
export function validateWithRepair(
  input: unknown,
): { decision: ValidatedDecision } | { error: z.ZodError; repair: RepairOutcome } {
  const direct = decisionSchema.safeParse(input);
  if (direct.success) {
    return { decision: direct.data };
  }

  const repaired = attemptRepair(input);
  if (repaired.success) {
    return { decision: repaired.data };
  }

  return {
    error: direct.error,
    repair: { ok: false, repaired: true, error: repaired.error },
  };
}

function attemptRepair(input: unknown): z.SafeParseReturnType<unknown, ValidatedDecision> {
  if (typeof input !== "object" || input === null) return decisionSchema.safeParse(input);

  const raw = input as Record<string, unknown>;
  const out: Record<string, unknown> = { ...raw };

  const str = (k: string) => (typeof raw[k] === "string" ? (raw[k] as string) : raw[k]);

  // Trim all scalar strings.
  for (const key of Object.keys(raw)) {
    if (typeof raw[key] === "string") out[key] = (raw[key] as string).trim();
  }

  // Coerce enum case/format.
  const status = str("status");
  if (typeof status === "string") out["status"] = status.toLowerCase().replace(/[ _-]/g, "");

  const confidence = str("confidence");
  if (typeof confidence === "string") out["confidence"] = confidence.toLowerCase().trim();

  const reversibility = str("reversibility");
  if (typeof reversibility === "string") out["reversibility"] = reversibility.toLowerCase().trim();

  const costOfDelay = str("cost_of_delay");
  if (typeof costOfDelay === "string") {
    out["cost_of_delay"] = costOfDelay.toLowerCase().replace(/[ _-]/g, "");
  }

  const betClass = str("bet_class");
  if (typeof betClass === "string") out["bet_class"] = betClass.toLowerCase().trim();

  // Accept the YAML-style key `bet_class` when the camelCase key is absent.
  if (raw["bet_class"] !== undefined && out["betClass"] === undefined) {
    out["betClass"] = out["bet_class"];
  }
  delete out["bet_class"];

  // Empty strings -> undefined (optional fields).
  for (const key of [
    "owner",
    "goal",
    "bet_class",
    "review_date",
    "supersedes",
    "superseded_by",
    "agent_workflow_version",
  ]) {
    if (typeof out[key] === "string" && (out[key] as string).length === 0) {
      out[key] = undefined;
    }
  }

  // Tags may arrive as a single comma/space separated string.
  if (typeof out["tags"] === "string") {
    out["tags"] = (out["tags"] as string)
      .split(/[,\s]+/)
      .map((t) => t.trim())
      .filter(Boolean);
  }
  if (!Array.isArray(out["tags"])) out["tags"] = [];

  return decisionSchema.safeParse(out);
}
