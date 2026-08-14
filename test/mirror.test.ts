import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function walk(dir: string, base: string, out: string[]): string[] {
  for (const entry of readdirSync(dir).sort()) {
    const full = path.join(dir, entry);
    const rel = base ? path.join(base, entry) : entry;
    if (statSync(full).isDirectory()) walk(full, rel, out);
    else out.push(rel);
  }
  return out;
}

describe("installed skill mirror", () => {
  it("keeps .agents/skills/siftos byte-identical to skill/", () => {
    const canonical = path.join(repoRoot, "skill");
    const installed = path.join(repoRoot, ".agents", "skills", "siftos");
    const canonicalFiles = walk(canonical, "", []);
    const installedFiles = walk(installed, "", []);
    expect(installedFiles, "file set differs between skill/ and .agents/skills/siftos/").toEqual(canonicalFiles);
    for (const file of canonicalFiles) {
      expect(
        readFileSync(path.join(installed, file), "utf8"),
        `mirror drift: ${file} differs between skill/ and .agents/skills/siftos/`,
      ).toBe(readFileSync(path.join(canonical, file), "utf8"));
    }
  });
});
