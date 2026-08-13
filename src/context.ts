import type { Decision, ProductContext } from "./types.js";
import { searchableText } from "./search.js";

export interface CompiledContext {
  sections: Array<{ name: string; content: string }>;
  relatedDecisions: Array<{ id: string; title: string; score: number }>;
}

/**
 * Context Compiler (PRD §59): builds a bounded, provenance-carrying
 * package instead of dumping every file into the model context.
 *
 * Priority: current request → explicit referenced decision → PRODUCT.md →
 * STRATEGY.md → PRINCIPLES.md → METRICS.md → relevant historical
 * decisions → additional evidence.
 */
export function compileContext(opts: {
  productContext: ProductContext;
  decisions: Decision[];
  /** Free-text request (e.g. the decision being analyzed). */
  query?: string;
  /** Explicitly referenced decision id. */
  decisionId?: string;
  /** Max related decisions to include. */
  maxRelated?: number;
}): CompiledContext {
  const maxRelated = opts.maxRelated ?? 5;
  const sections: CompiledContext["sections"] = [];
  const related: CompiledContext["relatedDecisions"] = [];

  const referenced = opts.decisionId
    ? opts.decisions.find((d) => d.id === opts.decisionId)
    : undefined;
  if (referenced) {
    sections.push({
      name: `Referenced decision: ${referenced.id} — ${referenced.title} (${referenced.status})`,
      content: renderDecision(referenced),
    });
  }

  const pushIfNonEmpty = (name: string, content: string) => {
    if (content.trim() !== "") sections.push({ name, content });
  };

  pushIfNonEmpty("PRODUCT.md", opts.productContext.product);
  pushIfNonEmpty("STRATEGY.md", opts.productContext.strategy);
  pushIfNonEmpty("PRINCIPLES.md", opts.productContext.principles);
  pushIfNonEmpty("METRICS.md", opts.productContext.metrics);

  const query = opts.query ?? "";
  const candidates = opts.decisions.filter((d) => d.id !== referenced?.id);
  const scored = candidates.map((d) => ({ d, score: relevanceScore(d, query) }));
  scored.sort((a, b) => b.score - a.score || a.d.id.localeCompare(b.d.id));

  const top = scored.filter((s) => s.score > 0).slice(0, maxRelated);
  for (const { d, score } of top) {
    sections.push({
      name: `Related decision: ${d.id} — ${d.title} (${d.status})`,
      content: renderDecision(d),
    });
    related.push({ id: d.id, title: d.title, score });
  }

  return { sections, relatedDecisions: related };
}

/** Deterministic scoring: token overlap + metadata hits (PRD §60 retrieval). */
function relevanceScore(d: Decision, query: string): number {
  if (query.trim() === "") return 0;
  const tokens = query.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
  if (tokens.length === 0) return 0;
  const text = searchableText(d);
  let score = 0;
  for (const t of tokens) {
    if (text.includes(t)) score += 1;
    if (d.tags.some((tag) => tag.toLowerCase().includes(t))) score += 2;
    if (d.goal?.toLowerCase().includes(t)) score += 2;
  }
  return score;
}

function renderDecision(d: Decision): string {
  const lines: string[] = [];
  lines.push(`id: ${d.id}`);
  lines.push(`status: ${d.status}`);
  lines.push(`goal: ${d.goal ?? "unknown"}`);
  lines.push(`tags: ${d.tags.join(", ") || "none"}`);
  for (const [sectionName, items] of Object.entries(d.body)) {
    lines.push("");
    lines.push(`## ${sectionName}`);
    if (items.length === 0) {
      lines.push("Unknown.");
    } else {
      for (const item of items) lines.push(`- ${item}`);
    }
  }
  return lines.join("\n");
}

export function formatCompiledContext(compiled: CompiledContext): string {
  const out: string[] = [];
  for (const s of compiled.sections) {
    out.push(`<context source="${s.name}">`);
    out.push(s.content);
    out.push("</context>");
    out.push("");
  }
  return out.join("\n").replace(/\n+$/, "");
}
