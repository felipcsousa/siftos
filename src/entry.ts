#!/usr/bin/env node
import { realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { main } from "./cli.js";

export { main, parseArgs } from "./cli.js";

// npm/npx invoke bins through the .bin symlink; path.resolve does not follow
// symlinks, so compare against the real path of argv[1].
const isMain =
  process.argv[1] !== undefined &&
  realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) process.exit(await main(process.argv.slice(2)));
