import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
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
    const repo = new ProductRepository(tmp);
    const ids = repo.listDecisions().map((d) => d.id);
    expect(ids).toEqual(["DEC-0001", "DEC-0002"]);
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
