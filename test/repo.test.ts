import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, openSync, closeSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { ProductRepository, findRepoRoot } from "../src/repo.js";
import { serializeDecision } from "../src/serializer.js";
import { parseDecision } from "../src/parser.js";
import { makeDecision, withSections, NOW } from "./helpers.js";

let tmp: string;

beforeAll(() => {
  tmp = mkdtempSync(path.join(os.tmpdir(), "siftos-repo-"));
  mkdirSync(path.join(tmp, ".git"));
});

afterAll(() => {
  rmSync(tmp, { recursive: true, force: true });
});

describe("findRepoRoot", () => {
  it("prefers an ancestor with .product/ over .git", () => {
    const inner = path.join(tmp, "nested");
    mkdirSync(inner, { recursive: true });
    expect(findRepoRoot(inner)).toBe(tmp);
  });
});

describe("ProductRepository", () => {
  it("init scaffolds .product/ with all files", () => {
    const repo = new ProductRepository(tmp);
    const created = repo.init(NOW);
    expect(repo.initialized).toBe(true);
    for (const name of [
      "PRODUCT.md",
      "STRATEGY.md",
      "METRICS.md",
      "PRINCIPLES.md",
      "config.json",
    ]) {
      expect(created).toContain(path.join(".product", name));
    }
    expect(repo.loadConfig()?.name).toBe("siftos");
  });

  it("init is idempotent and never overwrites", () => {
    const fresh = path.join(tmp, "idempotent");
    mkdirSync(fresh, { recursive: true });
    mkdirSync(path.join(fresh, ".git"));
    const repo = new ProductRepository(fresh);
    const first = repo.init(NOW);
    const second = repo.init(NOW);
    expect(first.length).toBeGreaterThan(0);
    expect(second).toEqual([]);
  });

  it("nextId advances from existing files", () => {
    const repo = new ProductRepository(tmp);
    expect(repo.nextId()).toBe("DEC-0001");
    repo.saveDecision(makeDecision({ id: "DEC-0001", title: "First" }), { now: NOW });
    expect(repo.nextId()).toBe("DEC-0002");
  });

  it("nextId serializes allocation through the advisory lock", () => {
    const fresh = path.join(tmp, "lock-serial");
    mkdirSync(fresh, { recursive: true });
    mkdirSync(path.join(fresh, ".git"));
    const repo = new ProductRepository(fresh);
    repo.init(NOW);
    expect(repo.nextId()).toBe("DEC-0001");
    repo.saveDecision(makeDecision({ id: "DEC-0001", title: "First" }), { now: NOW });
    expect(repo.nextId()).toBe("DEC-0002");
  });

  it("nextId fails explicitly while another process holds the lock", () => {
    const repo = new ProductRepository(tmp, { timeoutMs: 50 });
    const lock = path.join(tmp, ".product", ".siftos.lock");
    const fd = openSync(lock, "wx");
    writeFileSync(fd, "99999\n");
    closeSync(fd);
    try {
      expect(() => repo.nextId()).toThrow(/lock/);
    } finally {
      rmSync(lock, { force: true });
    }
  });

  it("nextId steals a stale lock left by a crashed holder", () => {
    const repo = new ProductRepository(tmp, { staleMs: 0 });
    writeFileSync(path.join(tmp, ".product", ".siftos.lock"), "99999\n");
    try {
      expect(typeof repo.nextId()).toBe("string");
    } finally {
      rmSync(path.join(tmp, ".product", ".siftos.lock"), { force: true });
    }
  });

  it("saveDecision refuses a reused id unless overwrite is explicit", () => {
    const fresh = path.join(tmp, "lock-conflict");
    mkdirSync(fresh, { recursive: true });
    mkdirSync(path.join(fresh, ".git"));
    const repo = new ProductRepository(fresh);
    repo.init(NOW);
    const d = makeDecision({ id: "DEC-0100", title: "Conflict test" });
    repo.saveDecision(d, { now: NOW });
    expect(() =>
      repo.saveDecision(makeDecision({ id: "DEC-0100", title: "Again" }), { now: NOW }),
    ).toThrow(/DEC-0100/);
  });

  it("saveDecision overwrite updates in place without duplicating the id", () => {
    const fresh = path.join(tmp, "lock-update");
    mkdirSync(fresh, { recursive: true });
    mkdirSync(path.join(fresh, ".git"));
    const repo = new ProductRepository(fresh);
    repo.init(NOW);
    repo.saveDecision(makeDecision({ id: "DEC-0101", title: "Original title" }), { now: NOW });
    const rel = repo.saveDecision(
      makeDecision({ id: "DEC-0101", title: "Updated title", status: "shipped" }),
      { now: NOW, overwrite: true },
    );
    // Same file (same id), updated content, exactly one DEC-0101 file.
    expect(rel).toMatch(/^\.product\/decisions\/DEC-0101-original-title\.md$/);
    expect(repo.decisionFileNames().filter((f) => f.startsWith("DEC-0101"))).toHaveLength(1);
    expect(repo.readDecision("DEC-0101").title).toBe("Updated title");
    expect(repo.readDecision("DEC-0101").status).toBe("shipped");
  });

  it("saveDecision writes an atomically persisted, parseable file", () => {
    const repo = new ProductRepository(tmp);
    const d = withSections(
      makeDecision({ id: "DEC-0002", title: "Atomic write test" }),
      { Facts: ["x"] },
    );
    const rel = repo.saveDecision(d, { now: NOW });
    expect(rel).toMatch(/^\.product\/decisions\/DEC-0002-atomic-write-test\.md$/);

    const read = repo.readDecision("DEC-0002");
    expect(read.title).toBe("Atomic write test");
    expect(read.body["Facts"]).toEqual(["x"]);
    expect(read.updatedAt).toBe(NOW);
  });

  it("readDecision throws for unknown ids", () => {
    const repo = new ProductRepository(tmp);
    expect(() => repo.readDecision("DEC-0999")).toThrow(/not found/);
  });

  it("listDecisions parses all files sorted by id", () => {
    // Isolated repo: the expected id set must not depend on which earlier
    // tests happened to save into the shared tmp.
    const fresh = mkdtempSync(path.join(os.tmpdir(), "siftos-list-")); mkdirSync(path.join(fresh, ".git"));
    const repo = new ProductRepository(fresh);
    repo.saveDecision(makeDecision({ id: "DEC-0001", title: "First" }), { now: NOW });
    repo.saveDecision(makeDecision({ id: "DEC-0002", title: "Second" }), { now: NOW });
    const ids = repo.listDecisions().map((d) => d.id);
    expect(ids).toEqual(["DEC-0001", "DEC-0002"]);
    rmSync(fresh, { recursive: true, force: true });
  });

  it("serializes decision with slugified title file name", () => {
    const repo = new ProductRepository(tmp);
    const rel = repo.saveDecision(
      makeDecision({ id: "DEC-0003", title: "Café: remove ção!" }),
      { now: NOW },
    );
    expect(rel).toMatch(/DEC-0003-cafe-remove-cao\.md$/);
  });

  it("round-trips via filesystem", () => {
    const repo = new ProductRepository(tmp);
    const d = withSections(
      makeDecision({ id: "DEC-0004", title: "Round trip", goal: "g", tags: ["t"] }),
      { "Revisit Condition": ["30 days"] },
    );
    repo.saveDecision(d, { now: NOW });
    const read = repo.readDecision("DEC-0004");
    expect(parseDecision(serializeDecision(read))).toEqual(read);
  });

  it("open finds the repo from a nested cwd", () => {
    const nested = path.join(tmp, "deep", "deeper");
    mkdirSync(nested, { recursive: true });
    const repo = ProductRepository.open(nested);
    expect(repo.root).toBe(tmp);
  });

  it("open throws outside a repository", () => {
    const outside = mkdtempSync(path.join(os.tmpdir(), "siftos-norepo-"));
    expect(() => ProductRepository.open(outside)).toThrow(/no repository found/);
    rmSync(outside, { recursive: true, force: true });
  });
});
