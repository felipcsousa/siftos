import type { Decision } from "./types.js";

export interface SearchFilters {
  status?: string;
  tag?: string;
  owner?: string;
  goal?: string;
  /** Decisions with an expired review date that are still open. */
  pendingReview?: boolean;
  now?: string;
}

/** Searchable text of a decision: metadata + full body (PRD §60). */
export function searchableText(d: Decision): string {
  const parts = [
    d.id,
    d.title,
    d.status,
    d.goal ?? "",
    d.owner ?? "",
    d.tags.join(" "),
    ...Object.values(d.body).flat(),
  ];
  return parts.join("\n").toLowerCase();
}

export function matchesQuery(d: Decision, query: string): boolean {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  const haystack = searchableText(d);
  return tokens.every((t) => haystack.includes(t));
}

export function matchesFilters(d: Decision, f: SearchFilters): boolean {
  if (f.status && d.status !== f.status) return false;
  if (f.tag && !d.tags.includes(f.tag)) return false;
  if (f.owner && d.owner !== f.owner) return false;
  if (f.goal && d.goal !== f.goal) return false;
  if (f.pendingReview) {
    const now = f.now ?? today();
    const open = ["accepted", "building", "shipped", "measuring"].includes(d.status);
    if (!open) return false;
    if (!d.reviewDate || d.reviewDate >= now) return false;
  }
  return true;
}

export function searchDecisions(
  decisions: Decision[],
  query: string | undefined,
  filters: SearchFilters,
): Decision[] {
  const withQuery = query && query.trim() !== "" ? matchesQuery : () => true;
  return decisions
    .filter((d) => withQuery(d, query ?? ""))
    .filter((d) => matchesFilters(d, filters))
    .sort((a, b) => a.id.localeCompare(b.id));
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}
