import { existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { writeFileAtomic } from "./atomic.js";
import { nextDecisionId } from "./id.js";
import { parseDecision } from "./parser.js";
import { serializeDecision } from "./serializer.js";
import type { Decision, ProductContext, SiftosConfig } from "./types.js";
import {
  CONFIG_TEMPLATE,
  DECISIONS_README,
  EVIDENCE_README,
  METRICS_TEMPLATE,
  PRINCIPLES_TEMPLATE,
  PRODUCT_TEMPLATE,
  STRATEGY_TEMPLATE,
} from "./templates.js";

export const PRODUCT_DIR = ".product";
export const DECISIONS_DIR = "decisions";
export const EVIDENCE_DIR = "evidence";

function walkUp(start: string): string[] {
  const dirs: string[] = [];
  let cur = path.resolve(start);
  for (;;) {
    dirs.push(cur);
    const parent = path.dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }
  return dirs;
}

/** Repository root: nearest ancestor with .product/, else nearest with .git/. */
export function findRepoRoot(startDir: string): string | null {
  for (const dir of walkUp(startDir)) {
    if (existsSync(path.join(dir, PRODUCT_DIR))) return dir;
  }
  for (const dir of walkUp(startDir)) {
    if (existsSync(path.join(dir, ".git"))) return dir;
  }
  return null;
}

export class ProductRepository {
  constructor(public readonly root: string) {}

  get productDir(): string {
    return path.join(this.root, PRODUCT_DIR);
  }

  get decisionsDir(): string {
    return path.join(this.productDir, DECISIONS_DIR);
  }

  get evidenceDir(): string {
    return path.join(this.productDir, EVIDENCE_DIR);
  }

  get initialized(): boolean {
    return existsSync(this.productDir);
  }

  static open(cwd: string): ProductRepository {
    const root = findRepoRoot(cwd);
    if (root === null) {
      throw new Error(
        "no repository found: run `siftos init` inside a Git repository or a directory with .product/",
      );
    }
    return new ProductRepository(root);
  }

  configPath(): string {
    return path.join(this.productDir, "config.json");
  }

  loadConfig(): SiftosConfig | null {
    const p = this.configPath();
    if (!existsSync(p)) return null;
    try {
      const parsed = JSON.parse(readFileSync(p, "utf8")) as SiftosConfig;
      return parsed.name === "siftos" ? parsed : null;
    } catch {
      return null;
    }
  }

  loadProductContext(): ProductContext {
    const read = (name: string): string => {
      const p = path.join(this.productDir, name);
      return existsSync(p) ? readFileSync(p, "utf8") : "";
    };
    return {
      product: read("PRODUCT.md"),
      strategy: read("STRATEGY.md"),
      metrics: read("METRICS.md"),
      principles: read("PRINCIPLES.md"),
    };
  }

  decisionFileNames(): string[] {
    if (!existsSync(this.decisionsDir)) return [];
    return readdirSync(this.decisionsDir)
      .filter((f) => /^DEC-\d{4}.*\.md$/.test(f) && f.endsWith(".md"))
      .sort();
  }

  decisionIds(): string[] {
    return this.decisionFileNames()
      .map((f) => f.match(/^(DEC-\d{4})/)?.[1])
      .filter((id): id is string => id !== undefined)
      .sort();
  }

  nextId(): string {
    return nextDecisionId(this.decisionIds());
  }

  readDecision(id: string): Decision {
    const file = this.decisionFileNames().find((f) => f.startsWith(id));
    if (!file) throw new Error(`decision not found: ${id}`);
    const markdown = readFileSync(path.join(this.decisionsDir, file), "utf8");
    return parseDecision(markdown);
  }

  listDecisions(): Decision[] {
    const out: Decision[] = [];
    for (const file of this.decisionFileNames()) {
      try {
        out.push(parseDecision(readFileSync(path.join(this.decisionsDir, file), "utf8")));
      } catch (err) {
        const id = file.match(/^(DEC-\d{4})/)?.[1] ?? file;
        throw new Error(`failed to parse ${file}: ${(err as Error).message}`);
      }
    }
    return out;
  }

  /**
   * Serializes and atomically persists a decision. Returns the created
   * file path (relative to the repository root).
   */
  saveDecision(decision: Decision, { now }: { now: string }): string {
    const updated: Decision = { ...decision, updatedAt: now };
    const markdown = serializeDecision(updated);
    const slug = slugify(decision.title);
    const fileName = `${decision.id}-${slug}.md`;
    return path.relative(this.root, writeFileAtomic(this.decisionsDir, fileName, markdown));
  }

  /**
   * Scaffolds .product/ (PRD §30, deterministic half). Never overwrites
   * existing content and is idempotent. Returns created paths relative
   * to the root.
   */
  init(now: string): string[] {
    void now;
    const created: string[] = [];
    const ensure = (dir: string) => {
      if (existsSync(dir)) return;
      mkdirSync(dir, { recursive: true });
      created.push(path.relative(this.root, dir) || ".");
    };
    const writeIfAbsent = (dir: string, name: string, content: string) => {
      const target = path.join(dir, name);
      if (existsSync(target)) return;
      writeFileAtomic(dir, name, content);
      created.push(path.relative(this.root, target));
    };

    ensure(this.productDir);
    ensure(this.decisionsDir);
    ensure(this.evidenceDir);

    writeIfAbsent(this.productDir, "PRODUCT.md", PRODUCT_TEMPLATE);
    writeIfAbsent(this.productDir, "STRATEGY.md", STRATEGY_TEMPLATE);
    writeIfAbsent(this.productDir, "METRICS.md", METRICS_TEMPLATE);
    writeIfAbsent(this.productDir, "PRINCIPLES.md", PRINCIPLES_TEMPLATE);
    writeIfAbsent(this.productDir, "config.json", CONFIG_TEMPLATE);
    writeIfAbsent(this.decisionsDir, "README.md", DECISIONS_README);
    writeIfAbsent(this.evidenceDir, "README.md", EVIDENCE_README);

    return created;
  }
}

function slugify(title: string): string {
  const slug = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || "decision";
}
