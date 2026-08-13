// Shared deterministic helpers for SiftOS skill scripts.
// Zero dependencies — runs with plain `node <script>.mjs`.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

export const DEC_ID_RE = /^DEC-\d{4}$/;
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const STATUSES = [
  "draft", "proposed", "accepted", "shipped", "reviewed",
  "rejected", "cancelled", "superseded",
];

export function walkUp(start) {
  const dirs = [];
  let cur = path.resolve(start);
  for (;;) {
    dirs.push(cur);
    const parent = path.dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }
  return dirs;
}

/** Root of the repository that owns .product/, else null. */
export function findProductRoot(startDir) {
  for (const dir of walkUp(startDir)) {
    if (existsSync(path.join(dir, ".product"))) return dir;
  }
  return null;
}

export function today() {
  const env = process.env.SIFTOS_TODAY;
  if (env && DATE_RE.test(env)) return env;
  return new Date().toISOString().slice(0, 10);
}

export function decisionFiles(root) {
  const dir = path.join(root, ".product", "decisions");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => /^DEC-\d{4}.*\.md$/.test(f))
    .sort();
}

export function readMarkdown(file) {
  return readFileSync(file, "utf8");
}

export function splitFrontmatter(markdown) {
  const lines = markdown.replace(/^\uFEFF/, "").split(/\r?\n/);
  if (lines[0]?.trim() !== "---") return { fields: {}, body: markdown };
  let close = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i]?.trim() === "---") { close = i; break; }
  }
  if (close === -1) return { fields: {}, body: markdown };

  const fields = {};
  let listKey = null;
  for (let i = 1; i < close; i++) {
    const line = lines[i] ?? "";
    const t = line.trim();
    if (t === "") continue;
    if (t.startsWith("- ")) {
      if (listKey) (fields[listKey] ??= []).push(t.slice(2).trim());
      continue;
    }
    const colon = t.indexOf(":");
    if (colon === -1) continue;
    const key = t.slice(0, colon).trim();
    const value = t.slice(colon + 1).trim();
    listKey = null;
    if (value === "" && /^-\s+/.test(lines[i + 1] ?? "")) {
      listKey = key;
      fields[key] = [];
      continue;
    }
    fields[key] = value;
  }
  return { fields, body: lines.slice(close + 1).join("\n") };
}

export function parseBody(markdown) {
  const body = {};
  let section = null;
  for (const raw of markdown.split(/\r?\n/)) {
    const t = raw.trim();
    if (t === "") continue;
    if (t.startsWith("## ")) {
      section = t.slice(3).trim();
      body[section] = [];
      continue;
    }
    if (t.startsWith("# ")) continue;
    if (section === null) continue;
    if (t.startsWith("- ")) {
      const item = t.slice(2).trim();
      if (item !== "") body[section].push(item);
      continue;
    }
    if (body[section].length > 0) {
      body[section][body[section].length - 1] += ` ${t}`;
    } else {
      body[section].push(t);
    }
  }
  for (const key of Object.keys(body)) {
    if (body[key].length === 1 && body[key][0] === "Unknown.") body[key] = [];
  }
  return body;
}

/** Parses one decision file into a plain object. Throws on hard errors. */
export function parseDecisionFile(root, file) {
  const raw = readMarkdown(path.join(root, ".product", "decisions", file));
  const { fields, body: bodyMarkdown } = splitFrontmatter(raw);
  const body = parseBody(bodyMarkdown);
  const id = fields.id ?? (file.match(/^(DEC-\d{4})/) ?? [])[1];
  if (!id || !DEC_ID_RE.test(id)) throw new Error(`${file}: invalid or missing id`);
  const status = fields.status ?? "draft";
  if (!STATUSES.includes(status)) throw new Error(`${file}: invalid status "${status}"`);
  for (const k of ["created_at", "updated_at"]) {
    if (!DATE_RE.test(fields[k] ?? "")) throw new Error(`${file}: invalid ${k}`);
  }
  return {
    file, id, status,
    title: fields.title ?? "",
    createdAt: fields.created_at ?? "",
    updatedAt: fields.updated_at ?? "",
    owner: fields.owner,
    goal: fields.goal,
    tags: Array.isArray(fields.tags) ? fields.tags : [],
    confidence: fields.confidence,
    reviewDate: fields.review_date ?? null,
    supersededBy: fields.superseded_by ?? null,
    body,
  };
}

export function loadAll(root) {
  const decisions = [];
  const errors = [];
  for (const file of decisionFiles(root)) {
    try {
      decisions.push(parseDecisionFile(root, file));
    } catch (err) {
      errors.push(err.message);
    }
  }
  return { decisions, errors };
}

export function sectionItems(d, name) {
  return d.body[name] ?? [];
}

export function hasContent(items) {
  return items.length > 0;
}
