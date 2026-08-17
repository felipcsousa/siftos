import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
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
  ROADMAP_TEMPLATE,
  STRATEGY_TEMPLATE,
} from "./templates.js";

export const PRODUCT_DIR = ".product";
export const DECISIONS_DIR = "decisions";
export const EVIDENCE_DIR = "evidence";

/**
 * Gitignore markers scoped to `.product/` itself: runtime and derived
 * indexes are disposable (PRD V2 §83–§84, §98) and stay out of git.
 * A nested .gitignore keeps the write boundary: SiftOS never edits the
 * repository root.
 */
export const PRODUCT_GITIGNORE = `# siftos-ignore-start
# Disposable runtime + derived indexes (regenerable).
.runtime/
.index/
# siftos-ignore-end
`;

/** Advisory lock file for decision-ID allocation (PRD §26). */
export const LOCK_FILE_NAME = ".siftos.lock";
const LOCK_RETRY_MS = 25;
const DEFAULT_LOCK_TIMEOUT_MS = 2000;
const DEFAULT_LOCK_STALE_MS = 10_000;

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
  constructor(
    public readonly root: string,
    private readonly lockOpts: { timeoutMs?: number; staleMs?: number } = {},
  ) {}

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

  /** Atomically persists repository config (PRD V2 §13, §108). */
  saveConfig(config: SiftosConfig): string {
    return path.relative(
      this.root,
      writeFileAtomic(this.productDir, "config.json", JSON.stringify(config, null, 2) + "\n"),
    );
  }

  get runtimeDir(): string {
    return path.join(this.productDir, ".runtime");
  }

  get indexDir(): string {
    return path.join(this.productDir, ".index");
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
      .filter((f) => /^DEC-\d{4}(?:-|\.md$)/.test(f) && f.endsWith(".md"))
      .sort();
  }

  decisionIds(): string[] {
    return this.decisionFileNames()
      .map((f) => f.match(/^(DEC-\d{4})(?:-|\.md$)/)?.[1])
      .filter((id): id is string => id !== undefined)
      .sort();
  }

  private lockPath(): string {
    return path.join(this.productDir, LOCK_FILE_NAME);
  }

  /**
   * Advisory lock serializing decision-ID allocation (PRD §26). A stale
   * lock (holder crashed) is stolen after `staleMs`; otherwise the caller
   * waits up to `timeoutMs` and fails explicitly. Skipped when `.product/`
   * does not exist yet (nothing to protect).
   */
  private withLock<T>(fn: () => T): T {
    if (!this.initialized) return fn();
    const timeoutMs = this.lockOpts.timeoutMs ?? DEFAULT_LOCK_TIMEOUT_MS;
    const staleMs = this.lockOpts.staleMs ?? DEFAULT_LOCK_STALE_MS;
    const lock = this.lockPath();
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      try {
        const fd = openSync(lock, "wx", 0o644);
        try {
          writeFileSync(fd, `${process.pid}\n`, "utf8");
        } finally {
          closeSync(fd);
        }
        break; // acquired
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
        let stale = false;
        try {
          stale = Date.now() - statSync(lock).mtimeMs > staleMs;
        } catch {
          // Lock vanished between EEXIST and stat: retry acquisition.
        }
        if (stale) {
          rmSync(lock, { force: true });
          continue;
        }
        if (Date.now() >= deadline) {
          throw new Error(
            `could not acquire decision id lock (${lock}): another SiftOS process may be running`,
          );
        }
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, LOCK_RETRY_MS);
      }
    }
    try {
      return fn();
    } finally {
      rmSync(lock, { force: true });
    }
  }

  nextId(): string {
    return this.withLock(() => nextDecisionId(this.decisionIds()));
  }

  readDecision(id: string): Decision {
    // Exact-id match: DEC-0001 must not bind to a malformed DEC-00010-*.md.
    const file = this.decisionFileNames().find((f) => f === `${id}.md` || f.startsWith(`${id}-`));
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
        const id = file.match(/^(DEC-\d{4})(?:-|\.md$)/)?.[1] ?? file;
        throw new Error(`failed to parse ${file}: ${(err as Error).message}`);
      }
    }
    return out;
  }

  /**
   * Serializes and atomically persists a decision. Returns the created
   * file path (relative to the repository root).
   */
  saveDecision(
    decision: Decision,
    { now, overwrite = false }: { now: string; overwrite?: boolean },
  ): string {
    return this.withLock(() => {
      const existing = this.decisionFileNames().find((f) => f === `${decision.id}.md` || f.startsWith(`${decision.id}-`));
      if (existing !== undefined && !overwrite) {
        throw new Error(
          `decision id conflict: ${decision.id} already exists — decision IDs are permanent and never reused (PRD §26); pass overwrite: true to update it in place`,
        );
      }
      const updated: Decision = { ...decision, updatedAt: now };
      const markdown = serializeDecision(updated);
      // Updates keep the original filename (same id -> same slug file),
      // so an update never creates a duplicate record.
      const fileName = existing ?? `${decision.id}-${slugify(decision.title)}.md`;
      return path.relative(this.root, writeFileAtomic(this.decisionsDir, fileName, markdown));
    });
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
    writeIfAbsent(this.productDir, ".gitignore", PRODUCT_GITIGNORE);
    writeIfAbsent(this.productDir, "ROADMAP.md", ROADMAP_TEMPLATE);
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
