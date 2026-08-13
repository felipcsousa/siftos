// Copies the canonical skill package into dist/ so the installed CLI can
// serve it from a stable location (dist/skill) at runtime.
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(root, "skill");
const dest = path.join(root, "dist", "skill");

rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });
cpSync(src, dest, { recursive: true });
console.log(`skill copied to ${path.relative(root, dest)}/`);
