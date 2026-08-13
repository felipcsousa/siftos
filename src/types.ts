export type DecisionStatus =
  | "draft"
  | "proposed"
  | "accepted"
  | "shipped"
  | "reviewed"
  | "rejected"
  | "cancelled"
  | "superseded";

export type Confidence = "low" | "medium" | "high";

export type Reversibility = "high" | "medium" | "low";

export type CostOfDelay = "low" | "medium" | "high" | "unknown";

/**
 * Strategic classification of a bet (adapted from Reforge's
 * offense/defense framing): offense moves the business forward,
 * defense preserves existing value, neither is not strategic.
 */
export type BetClass = "offense" | "defense" | "neither";

/** Canonical body sections of a PDR (see PRD §25). */
export const DECISION_SECTIONS = [
  "Context",
  "Goal",
  "Facts",
  "Evidence",
  "Inferences",
  "Assumptions",
  "Unknowns",
  "Options Considered",
  "Alternatives Rejected",
  "AI Recommendation",
  "Final Human Decision",
  "Rationale",
  "Strongest Argument Against",
  "Expected Outcome",
  "Primary Metric",
  "Guardrails",
  "Reversibility",
  "Cost of Delay",
  "What Would Change Our Mind",
  "Revisit Condition",
] as const;

export const OUTCOME_SECTIONS = [
  "Observed Result",
  "Prediction Accuracy",
  "Unexpected Effects",
  "Assumptions Confirmed",
  "Assumptions Invalidated",
  "Decision Assessment",
  "Learnings",
  "Follow-up Decisions",
] as const;

/**
 * Body of a PDR: section heading -> bullet items.
 * A section with no items serializes as "Unknown."
 * Unknown headings are preserved (forward compatibility).
 */
export type DecisionBody = Record<string, string[]>;

export interface Decision {
  id: string;
  title: string;
  status: DecisionStatus;
  /** YYYY-MM-DD */
  createdAt: string;
  /** YYYY-MM-DD */
  updatedAt: string;
  owner?: string;
  tags: string[];
  goal?: string;
  betClass?: BetClass;
  confidence?: Confidence;
  reversibility?: Reversibility;
  costOfDelay?: CostOfDelay;
  /** YYYY-MM-DD */
  reviewDate?: string | null;
  supersedes?: string | null;
  supersededBy?: string | null;
  agentWorkflowVersion?: string;
  body: DecisionBody;
}

export interface ProductContext {
  product: string;
  strategy: string;
  metrics: string;
  principles: string;
}

export interface SiftosConfig {
  version: number;
  name: "siftos";
  platforms: Array<"opencode" | "codex">;
  linters: { enabled: boolean };
}

export interface PlatformCapabilities {
  platform: "opencode" | "codex";
  canReadFiles: boolean;
  canWriteFiles: boolean;
  canRunScripts: boolean;
  canSearchRepository: boolean;
  canUseGit: boolean;
  supportsSkills: boolean;
}

export interface CompatibilityResult {
  platform: "opencode" | "codex";
  ok: boolean;
  notes: string[];
}

export type LintSeverity = "INFO" | "WARNING" | "ERROR";

export interface LintFinding {
  rule: string;
  severity: LintSeverity;
  message: string;
  /** Decision id the finding refers to, when applicable. */
  decisionId?: string;
}

export interface LintContext {
  decision: Decision;
  allDecisions: Decision[];
  /** YYYY-MM-DD — injectable for deterministic tests. */
  now: string;
  metrics: string;
}

export type LintRule = (ctx: LintContext) => LintFinding[];

export interface AuditSummary {
  total: number;
  byStatus: Record<DecisionStatus, number>;
  accepted: number;
  reviewed: number;
  waitingForReview: number;
  missingSuccessMetrics: number;
  missingAlternatives: number;
  lowConfidence: number;
  findings: LintFinding[];
}
