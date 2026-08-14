#!/usr/bin/env node
// SiftOS init — deterministic scaffold of .product/ from assets templates.
// Never overwrites existing content. The agent drives context-building; this
// script only creates the canonical files. Automatic hooks remain OFF until
// the user explicitly chooses a preset.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { findProductRoot, walkUp } from "./lib.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const assets = path.join(scriptDir, "..", "assets");

function main() {
  const cwd = process.cwd();
  const root = findProductRoot(cwd);
  if (root) {
    console.error(`error: .product/ already exists at ${path.join(root, ".product")}`);
    process.exit(1);
  }

  let repoRoot = cwd;
  for (const dir of walkUp(cwd)) {
    if (existsSync(path.join(dir, ".git"))) { repoRoot = dir; break; }
  }

  const productDir = path.join(repoRoot, ".product");
  const decisionsDir = path.join(productDir, "decisions");
  const evidenceDir = path.join(productDir, "evidence");
  mkdirSync(decisionsDir, { recursive: true });
  mkdirSync(evidenceDir, { recursive: true });

  const files = [
    ["PRODUCT.md", "PRODUCT.template.md"],
    ["STRATEGY.md", "STRATEGY.template.md"],
    ["METRICS.md", "METRICS.template.md"],
    ["PRINCIPLES.md", "PRINCIPLES.template.md"],
  ];

  const created = [];
  for (const [target, template] of files) {
    const dest = path.join(productDir, target);
    if (existsSync(dest)) continue;
    writeFileSync(dest, readFileSync(path.join(assets, template), "utf8"));
    created.push(path.relative(repoRoot, dest));
  }

  const config = path.join(productDir, "config.json");
  if (!existsSync(config)) {
    writeFileSync(
      config,
      JSON.stringify(
        {
          version: 2,
          name: "siftos",
          platforms: ["opencode", "codex"],
          linters: { enabled: true },
        },
        null,
        2,
      ) + "\n",
    );
    created.push(path.relative(repoRoot, config));
  }

  const roadmap = path.join(productDir, "ROADMAP.md");
  if (!existsSync(roadmap)) {
    writeFileSync(
      roadmap,
      `# Product Roadmap

Only active bets belong on the roadmap.

## NOW

Unknown.

## NEXT

Unknown.

## LATER

Unknown.

## NOT NOW

Unknown.
`,
    );
    created.push(path.relative(repoRoot, roadmap));
  }

  const gitignore = path.join(productDir, ".gitignore");
  if (!existsSync(gitignore)) {
    writeFileSync(gitignore, `# siftos-ignore-start\n.runtime/\n.index/\n# siftos-ignore-end\n`);
    created.push(path.relative(repoRoot, gitignore));
  }

  const readmes = [
    [decisionsDir, "README.md", "# Decisions\n\nProduct Decision Records (PDRs) live here as `DEC-XXXX-slug.md`.\n"],
    [evidenceDir, "README.md", "# Evidence\n\nSupporting material for decisions may live in this directory.\n"],
  ];
  for (const [dir, name, content] of readmes) {
    const dest = path.join(dir, name);
    if (existsSync(dest)) continue;
    writeFileSync(dest, content);
    created.push(path.relative(repoRoot, dest));
  }

  console.log("Created:");
  for (const p of created) console.log(p);
  console.log("");
  console.log("Ready for the first decision.");
  console.log("Automatic hooks are OFF until you explicitly choose: advisory | balanced | strict.");
}

main();
