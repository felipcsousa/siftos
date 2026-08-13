import type { Decision } from "./types.js";
import { DECISION_SECTIONS, OUTCOME_SECTIONS } from "./types.js";

const FRONTMATTER_KEYS: Array<[keyof Decision, string]> = [
  ["id", "id"],
  ["title", "title"],
  ["status", "status"],
  ["createdAt", "created_at"],
  ["updatedAt", "updated_at"],
  ["owner", "owner"],
  ["tags", "tags"],
  ["goal", "goal"],
  ["betClass", "bet_class"],
  ["confidence", "confidence"],
  ["reversibility", "reversibility"],
  ["costOfDelay", "cost_of_delay"],
  ["reviewDate", "review_date"],
  ["supersedes", "supersedes"],
  ["supersededBy", "superseded_by"],
  ["agentWorkflowVersion", "agent_workflow_version"],
];

function serializeScalar(value: unknown): string {
  if (typeof value !== "string") return "";
  return value;
}

/** Typed Decision → canonical Markdown PDR (round-trips through parseDecision). */
export function serializeDecision(d: Decision): string {
  const out: string[] = [];
  out.push("---");

  for (const [key, yamlKey] of FRONTMATTER_KEYS) {
    const value = d[key];
    if (value === undefined) continue;
    if (value === null) {
      out.push(`${yamlKey}: null`);
      continue;
    }
    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      out.push(`${yamlKey}:`);
      for (const item of value) out.push(`  - ${item}`);
      continue;
    }
    out.push(`${yamlKey}: ${serializeScalar(value)}`);
  }

  out.push("---");
  out.push("");
  out.push("# Decision");
  out.push("");

  const canonical: string[] = [...DECISION_SECTIONS, ...OUTCOME_SECTIONS];
  const extra = Object.keys(d.body).filter((s) => !canonical.includes(s));

  for (const section of canonical) {
    const items = d.body[section] ?? [];
    out.push(`## ${section}`);
    out.push("");
    if (items.length === 0) {
      out.push("Unknown.");
    } else {
      for (const item of items) out.push(`- ${item}`);
    }
    out.push("");
  }

  for (const section of extra) {
    const items = d.body[section] ?? [];
    out.push(`## ${section}`);
    out.push("");
    if (items.length === 0) {
      out.push("Unknown.");
    } else {
      for (const item of items) out.push(`- ${item}`);
    }
    out.push("");
  }

  return out.join("\n").replace(/\n+$/, "") + "\n";
}
