import type { Decision, DecisionBody } from "./types.js";
import { DATE_RE, DEC_ID_RE } from "./schema.js";

export class ParseError extends Error {
  constructor(message: string, public readonly line: number) {
    super(`${message} (line ${line})`);
    this.name = "ParseError";
  }
}

export interface ParsedFrontmatter {
  fields: Record<string, string | string[] | null>;
  bodyMarkdown: string;
}

/** Splits `---`-delimited frontmatter from the markdown body. */
export function splitFrontmatter(markdown: string): ParsedFrontmatter {
  const lines = markdown.replace(/^\uFEFF/, "").split(/\r?\n/);
  if (lines[0]?.trim() !== "---") {
    throw new ParseError("missing frontmatter delimiter", 1);
  }

  let close = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i]?.trim() === "---") {
      close = i;
      break;
    }
  }
  if (close === -1) throw new ParseError("unterminated frontmatter", 1);

  const fields: Record<string, string | string[] | null> = {};
  let currentListKey: string | null = null;

  for (let i = 1; i < close; i++) {
    const line = lines[i] ?? "";
    if (line.trim() === "") continue;

    if (/^\s*-\s+/.test(line)) {
      if (currentListKey === null) {
        throw new ParseError("list item outside of a key", i + 1);
      }
      const existing = fields[currentListKey];
      if (Array.isArray(existing)) {
        existing.push(line.replace(/^\s*-\s+/, "").trim());
      } else {
        fields[currentListKey] = [line.replace(/^\s*-\s+/, "").trim()];
      }
      continue;
    }

    const colon = line.indexOf(":");
    if (colon === -1) throw new ParseError(`malformed frontmatter line: ${line}`, i + 1);
    const key = line.slice(0, colon).trim();
    let value = line.slice(colon + 1).trim();
    currentListKey = null;
    if (value === "") {
      // Key with list items below, or explicit empty value.
      const next = lines[i + 1] ?? "";
      if (/^\s*-\s+/.test(next)) {
        currentListKey = key;
        fields[key] = [];
        continue;
      }
      fields[key] = null;
      continue;
    }
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (value === "null" || value === "~") {
      fields[key] = null;
      continue;
    }
    fields[key] = value;
  }

  return {
    fields,
    bodyMarkdown: lines.slice(close + 1).join("\n"),
  };
}

/** Parses the body: `# Decision`/`# Outcome` parts with `## Section` blocks. */
export function parseBody(markdown: string): DecisionBody {
  const body: DecisionBody = {};
  let currentSection: string | null = null;
  const lines = markdown.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const trimmed = line.trim();

    if (trimmed === "") continue;
    if (trimmed.startsWith("## ")) {
      const section = trimmed.slice(3).trim();
      if (section === "") throw new ParseError("empty section heading", i + 1);
      currentSection = section;
      body[section] = [];
      continue;
    }
    if (trimmed.startsWith("# ")) continue; // top-level part headings (# Decision / # Outcome)

    if (currentSection === null) {
      // Content before any section heading: ignore only decorative lines.
      continue;
    }
    if (trimmed.startsWith("- ")) {
      const item = trimmed.slice(2).trim();
      if (item !== "") (body[currentSection] ??= []).push(item);
      continue;
    }
    // Plain prose line inside a section is appended to the last item
    // (supports the multi-line evidence blocks in the PRD examples).
    const items = body[currentSection];
    if (items && items.length > 0) {
      items[items.length - 1] = `${items[items.length - 1]} ${trimmed}`.trim();
    } else {
      items?.push(trimmed);
    }
  }

  // Canonical empty marker "Unknown." normalizes to an empty section so
  // linters and consumers treat it as "no information" (PRD §34).
  for (const key of Object.keys(body)) {
    const items = body[key] ?? [];
    if (items.length === 1 && items[0] === "Unknown.") body[key] = [];
  }

  return body;
}

/**
 * Markdown → Decision. The canonical serializer output is guaranteed to
 * parse back into the identical structure (with "Unknown." normalization).
 */
export function parseDecision(markdown: string): Decision {
  const { fields, bodyMarkdown } = splitFrontmatter(markdown);

  const scalar = (key: string): string | undefined => {
    const v = fields[key];
    if (v === null || Array.isArray(v)) return undefined;
    return v === "" ? undefined : v;
  };
  const nullable = (key: string): string | null | undefined => {
    const v = fields[key];
    if (v === null) return null;
    if (Array.isArray(v)) return undefined;
    return v === "" ? undefined : v;
  };
  const list = (key: string): string[] => {
    const v = fields[key];
    if (Array.isArray(v)) return v;
    return [];
  };

  const id = scalar("id");
  const title = scalar("title");
  const status = scalar("status") ?? "draft";
  const createdAt = scalar("created_at");
  const updatedAt = scalar("updated_at");

  if (!id) throw new ParseError("missing required field: id", 1);
  if (!DEC_ID_RE.test(id)) throw new ParseError(`invalid id: ${id}`, 1);
  if (!title) throw new ParseError("missing required field: title", 1);
  if (!createdAt || !DATE_RE.test(createdAt)) {
    throw new ParseError("missing or invalid created_at", 1);
  }
  if (!updatedAt || !DATE_RE.test(updatedAt)) {
    throw new ParseError("missing or invalid updated_at", 1);
  }

  const reviewDate = nullable("review_date");
  const supersedes = nullable("supersedes");
  const supersededBy = nullable("superseded_by");

  const decision: Decision = {
    id,
    title,
    status: status as Decision["status"],
    createdAt,
    updatedAt,
    tags: list("tags"),
    body: parseBody(bodyMarkdown),
  };

  const owner = scalar("owner");
  if (owner) decision.owner = owner;
  const goal = scalar("goal");
  if (goal) decision.goal = goal;
  const betClass = scalar("bet_class");
  if (betClass) decision.betClass = betClass as Decision["betClass"];
  const confidence = scalar("confidence");
  if (confidence) decision.confidence = confidence as Decision["confidence"];
  const reversibility = scalar("reversibility");
  if (reversibility) decision.reversibility = reversibility as Decision["reversibility"];
  const costOfDelay = scalar("cost_of_delay");
  if (costOfDelay) decision.costOfDelay = costOfDelay as Decision["costOfDelay"];
  if (reviewDate !== undefined) decision.reviewDate = reviewDate;
  if (supersedes !== undefined) decision.supersedes = supersedes;
  if (supersededBy !== undefined) decision.supersededBy = supersededBy;
  const awv = scalar("agent_workflow_version");
  if (awv) decision.agentWorkflowVersion = awv;

  return decision;
}
