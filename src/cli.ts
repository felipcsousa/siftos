#!/usr/bin/env node
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, realpathSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { auditDecisions, formatAudit } from "./audit.js";
import { formatCompiledContext, compileContext } from "./context.js";
import { lintDecision } from "./linters.js";
import { parseDecision, ParseError } from "./parser.js";
import { ProductRepository, findRepoRoot, PRODUCT_DIR } from "./repo.js";
import { validateDecisionObject } from "./validator.js";
import {
  HOOK_LABELS,
  HOOK_NAMES,
  hooksConfigValid,
  materializeHooks,
  normalizeHookName,
  normalizePreset,
  parseHooksConfig,
  presetEnforcement,
  resolveHooks,
  type HookName,
  type HookPreset,
} from "./config.js";
import { loadRuntime, saveRuntime, startRuntimeTurn } from "./runtime.js";
import { writeFileAtomic } from "./atomic.js";
import { formatShipGate, shipGate } from "./shipgate.js";
import {
  BUILD_AUTHORIZING_STATUSES,
  classifyLevelDeterministic,
  guardMessage,
  guardVerdict,
  GUARD_RESOLUTIONS,
  POLICY_OK,
  type GuardLevel,
  type GuardResolution,
} from "./guard.js";
import { detectScopeDrift } from "./hooks.js";
import { searchDecisions } from "./search.js";
import type { SiftosConfig } from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHECK = "✓";
const CROSS = "✗";

const COMMANDS = [
  "install", "init", "validate", "audit", "search", "next-id", "show", "context",
  "doctor", "hooks", "hook", "ship", "roadmap", "guard", "scope", "version", "help",
] as const;
type Command = (typeof COMMANDS)[number];

export interface Args {
  command: Command | null;
  positionals: string[];
  flags: Record<string, string | boolean>;
}

const VALUE_FLAGS: Record<string, true> = {
  dir: true, status: true, tag: true, owner: true, goal: true, decision: true,
  "max-related": true, level: true, resolution: true, prompt: true, "turn-id": true,
};
const BOOLEAN_FLAGS = new Set([
  "help", "json", "pending-review", "session", "write",
]);
const KNOWN_FLAGS = new Set([...Object.keys(VALUE_FLAGS), ...BOOLEAN_FLAGS]);

export function parseArgs(argv: string[]): Args {
  const positionals: string[] = [];
  const flags: Record<string, string | boolean> = {};
  let positionalOnly = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i] ?? "";
    if (positionalOnly || !arg.startsWith("--")) {
      positionals.push(arg);
      continue;
    }
    if (arg === "--") {
      // Everything after `--` is positional (e.g. a path that starts with -).
      positionalOnly = true;
      continue;
    }
    const eq = arg.indexOf("=");
    if (eq !== -1) {
      const name = arg.slice(2, eq);
      if (!KNOWN_FLAGS.has(name)) console.warn("warning: unknown flag --" + name);
      flags[name] = arg.slice(eq + 1);
      continue;
    }
    const name = arg.slice(2);
    if (!KNOWN_FLAGS.has(name)) console.warn("warning: unknown flag --" + name);
    const next = argv[i + 1];
    if (VALUE_FLAGS[name] && next !== undefined && !next.startsWith("--")) {
      flags[name] = next;
      i += 1;
    } else flags[name] = true;
  }
  const [rawCommand, ...rest] = positionals;
  const command = (rawCommand ?? null) as Command | null;
  return { command: command !== null && COMMANDS.includes(command) ? command : null, positionals: rest, flags };
}

export function todayOrEnv(): string {
  const env = process.env["SIFTOS_TODAY"];
  return env && /^\d{4}-\d{2}-\d{2}$/.test(env) ? env : new Date().toISOString().slice(0, 10);
}

function cwdFor(flags: Record<string, string | boolean>): string {
  return typeof flags["dir"] === "string" ? flags["dir"] : process.cwd();
}
function tryOpenRepo(flags: Record<string, string | boolean>): ProductRepository | null {
  try { return ProductRepository.open(cwdFor(flags)); }
  catch (error) { console.error(`error: ${(error as Error).message}`); return null; }
}
function packageVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(path.resolve(__dirname, "..", "package.json"), "utf8")) as { version?: string };
    return pkg.version ?? "unknown";
  } catch { return "unknown"; }
}
function skillSourceDir(): string | null {
  const candidates = [path.resolve(__dirname, "skill"), path.resolve(__dirname, "..", "skill")];
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}
function defaultConfigObject(): SiftosConfig {
  return { version: 2, name: "siftos", platforms: ["opencode", "codex", "dsh"], linters: { enabled: true } };
}
function loadGlobalPreset(): HookPreset | null {
  try {
    const parsed = JSON.parse(readFileSync(path.join(os.homedir(), ".siftos", "config.json"), "utf8")) as { default_hook_preset?: string };
    const preset = normalizePreset(parsed.default_hook_preset ?? "");
    return preset === "custom" ? null : preset;
  } catch { return null; }
}
function effectiveConfig(repo: ProductRepository) {
  const config = repo.loadConfig();
  const hooksValid = hooksConfigValid(config?.hooks);
  const parsed = hooksValid ? parseHooksConfig(config?.hooks) : null;
  const session = loadRuntime(repo.root);
  return {
    config,
    hooksValid,
    session,
    effective: resolveHooks({ repository: parsed, globalPreset: loadGlobalPreset(), sessionOverrides: session.hook_overrides }),
  };
}

const SIFTOS_CODEX_EVENTS = new Set([
  "session_start", "prompt_submit", "before_mutation", "after_mutation",
  "context_compact", "turn_stop", "session_end",
]);

/**
 * True when the entry (or entry array) contains a SiftOS Codex command.
 * Matches the exact command shape `hook-codex.mjs <event>` rather than a raw
 * substring, so a user hook that merely mentions the path is not mistaken for
 * a SiftOS adapter and a SiftOS entry is not duplicated on reinstall.
 */
function isSiftosCodexEntry(value: unknown): boolean {
  try {
    const entries = Array.isArray(value) ? value : [value];
    return entries.some((entry) => {
      const hooks = (entry as { hooks?: Array<{ command?: unknown }> })?.hooks;
      if (!Array.isArray(hooks)) return false;
      return hooks.some((hook) => {
        const command = (hook as { command?: unknown })?.command;
        if (typeof command !== "string") return false;
        const match = command.match(/hook-codex\.mjs\s+([a-z_]+)\s*$/);
        if (match === null) return false;
        const event = match[1];
        return event !== undefined && SIFTOS_CODEX_EVENTS.has(event);
      });
    });
  } catch { return false; }
}
function mergeCodexHooks(existing: Record<string, unknown>, siftos: Record<string, unknown>): Record<string, unknown> {
  const existingHooks = existing["hooks"] && typeof existing["hooks"] === "object" ? existing["hooks"] as Record<string, unknown> : {};
  const siftosHooks = siftos["hooks"] as Record<string, unknown>;
  const mergedHooks: Record<string, unknown> = { ...existingHooks };
  for (const [event, configured] of Object.entries(siftosHooks)) {
    const prior = Array.isArray(existingHooks[event]) ? (existingHooks[event] as unknown[]).filter((entry) => !isSiftosCodexEntry(entry)) : [];
    mergedHooks[event] = [...prior, ...(configured as unknown[])];
  }
  return { ...existing, hooks: mergedHooks };
}

async function cmdInstall(flags: Record<string, string | boolean>): Promise<number> {
  const cwd = cwdFor(flags);
  const root = findRepoRoot(cwd) ?? cwd;
  const source = skillSourceDir();
  if (!source) { console.error("error: skill package not found next to this CLI (corrupted install)"); return 1; }

  const target = path.join(root, ".agents", "skills", "siftos");
  if (existsSync(target)) {
    // Provenance check mirroring the OpenCode plugin guard: never destroy a
    // directory at this path that SiftOS does not own (user fork, another
    // tool's skill).
    let managed = false;
    try {
      const marker = readFileSync(path.join(target, "SKILL.md"), "utf8").slice(0, 500);
      managed = /name:\s*siftos/i.test(marker);
    } catch {
      managed = false;
    }
    if (!managed) {
      console.error("error: .agents/skills/siftos already exists and is not managed by SiftOS; refusing to replace it");
      return 1;
    }
  }
  rmSync(target, { recursive: true, force: true });
  mkdirSync(path.dirname(target), { recursive: true });
  cpSync(source, target, { recursive: true });

  const hookCommand = "node .agents/skills/siftos/scripts/hook-codex.mjs";
  const siftosCodex = {
    hooks: {
      SessionStart: [{ matcher: "startup|resume|clear|compact", hooks: [{ type: "command", command: `${hookCommand} session_start`, additionalContextLimit: 5000 }] }],
      UserPromptSubmit: [{ hooks: [{ type: "command", command: `${hookCommand} prompt_submit`, additionalContextLimit: 1500 }] }],
      PreToolUse: [{ matcher: "Bash|apply_patch|Edit|Write", hooks: [{ type: "command", command: `${hookCommand} before_mutation` }] }],
      PostToolUse: [{ matcher: "Bash|apply_patch|Edit|Write", hooks: [{ type: "command", command: `${hookCommand} after_mutation` }] }],
      PreCompact: [{ matcher: "manual|auto", hooks: [{ type: "command", command: `${hookCommand} context_compact` }] }],
      Stop: [{ hooks: [{ type: "command", command: `${hookCommand} turn_stop` }] }],
      SessionEnd: [{ hooks: [{ type: "command", command: `${hookCommand} session_end` }] }],
    },
  };
  const codexDir = path.join(root, ".codex");
  mkdirSync(codexDir, { recursive: true });
  const codexPath = path.join(codexDir, "hooks.json");
  let existingCodex: Record<string, unknown> = {};
  if (existsSync(codexPath)) {
    try { existingCodex = JSON.parse(readFileSync(codexPath, "utf8")) as Record<string, unknown>; }
    catch { console.error("error: existing .codex/hooks.json is invalid JSON; refusing to overwrite user configuration"); return 1; }
  }
  writeFileAtomic(codexDir, "hooks.json", JSON.stringify(mergeCodexHooks(existingCodex, siftosCodex), null, 2) + "\n");

  const openCodePlugins = path.join(root, ".opencode", "plugins");
  mkdirSync(openCodePlugins, { recursive: true });
  const openCodePath = path.join(openCodePlugins, "siftos.js");
  if (existsSync(openCodePath)) {
    const current = readFileSync(openCodePath, "utf8");
    if (!current.includes("Installed by SiftOS") && !current.includes(".agents/skills/siftos/adapters/opencode-plugin.js")) {
      console.error("error: .opencode/plugins/siftos.js already exists and is not managed by SiftOS; refusing to overwrite it");
      return 1;
    }
  }
  writeFileAtomic(openCodePlugins, "siftos.js", `// Installed by SiftOS. Canonical implementation lives with the agent skill.\nexport { SiftOSPlugin, default } from "../../.agents/skills/siftos/adapters/opencode-plugin.js";\n`);

  const dshHome = dshHomeDir();
  const dshPluginDir = path.join(dshHome, "plugins", "siftos");
  const dshScriptsDir = path.join(dshPluginDir, "scripts");
  mkdirSync(dshScriptsDir, { recursive: true });
  // Cordis loads plugins/siftos/index.js; rewrite the repo-relative import so
  // the deployed entry resolves hook-lib next to itself.
  const dshEntry = readFileSync(path.join(source, "adapters", "dsh-plugin.js"), "utf8")
    .replace('"../scripts/hook-lib.mjs"', '"./scripts/hook-lib.mjs"');
  writeFileAtomic(dshPluginDir, "index.js", dshEntry);
  for (const file of ["hook-lib.mjs", "lib.mjs", "policy.json"]) {
    copyFileSync(path.join(source, "scripts", file), path.join(dshScriptsDir, file));
  }
  const patchPath = path.join(dshHome, "cordis.patch.yml");
  const siftosBlock = dshSiftosBlock();
  let patch = "";
  if (existsSync(patchPath)) patch = readFileSync(patchPath, "utf8");
  const begin = patch.indexOf(DSH_BEGIN);
  const end = patch.indexOf(DSH_END);
  let changed = true;
  if (begin !== -1 && end !== -1 && end >= begin) {
    // Marker-managed SiftOS blocks are always replaceable.
    patch = patch.slice(0, begin) + siftosBlock + patch.slice(end + DSH_END.length);
  } else if (begin !== -1 || end !== -1) {
    console.error(`error: ${patchPath} contains an unbalanced SiftOS marker; refusing to modify it`);
    return 1;
  } else {
    // Row-level check, not a substring scan: a comment or config value that
    // merely mentions `id: siftos` must not be mistaken for a plugin row.
    const rowExists = patch.split(/\r?\n/).some((line) => /^[ \t]*-?[ \t]*id:[ \t]*siftos[ \t]*$/.test(line));
    if (!rowExists) {
      patch = patch.replace(/\s+$/, "") + (patch ? "\n\n" : "") + siftosBlock;
    } else if (!dshManagedRow(patch)) {
      console.error(`error: ${patchPath} already defines id: ${DSH_INSERT_ID} with a different plugin path; refusing to overwrite user configuration`);
      return 1;
    } else {
      // A manual SiftOS row already exists without markers: leave the file
      // untouched instead of appending a duplicate row (doctor accepts
      // id: siftos + the SiftOS path without markers).
      changed = false;
    }
  }
  if (changed) writeFileAtomic(dshHome, "cordis.patch.yml", patch);

  console.log(`${CHECK} SiftOS skill installed`);
  console.log(`${CHECK} Codex lifecycle adapter installed (existing non-SiftOS hooks preserved)`);
  console.log(`${CHECK} OpenCode plugin adapter installed`);
  console.log(`${CHECK} DeepSeek Harness (dsh) lifecycle adapter installed`);
  console.log("");
  console.log("Automation remains OFF until explicitly enabled with:");
  console.log("  siftos hooks set advisory | balanced | strict");
  return 0;
}

function meaningfulContext(markdown: string): boolean {
  const placeholders = /^(unknown\.?|tbd\.?|n\/a\.?|none\.?|unspecified\.?)$/i;
  const structural = /^(metric|definition|baseline|target|source|date|access):?$/i;
  return markdown.split(/\r?\n/)
    .map((line) => line.trim().replace(/^[-*]\s+/, ""))
    .filter((line) => line && !line.startsWith("#"))
    .some((line) => {
      const normalized = line.replace(/^[A-Za-z][A-Za-z ]*:\s*/, "").trim();
      return !structural.test(line) && normalized !== "" && !placeholders.test(normalized);
    });
}
function codexAdapterInstalled(root: string): boolean {
  const file = path.join(root, ".codex", "hooks.json");
  if (!existsSync(file)) return false;
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8")) as { hooks?: Record<string, unknown> };
    const required = ["SessionStart", "UserPromptSubmit", "PreToolUse", "PostToolUse", "PreCompact", "Stop", "SessionEnd"];
    return required.every((event) => Array.isArray(parsed.hooks?.[event]) && isSiftosCodexEntry(parsed.hooks?.[event]));
  } catch { return false; }
}
function openCodeAdapterInstalled(root: string): boolean {
  const plugin = path.join(root, ".opencode", "plugins", "siftos.js");
  const impl = path.join(root, ".agents", "skills", "siftos", "adapters", "opencode-plugin.js");
  return existsSync(plugin) && existsSync(impl) && readFileSync(plugin, "utf8").includes("opencode-plugin.js");
}
const CODEX_HOOKS = new Set<HookName>(["session_start", "prompt_submit", "before_mutation", "after_mutation", "turn_stop", "context_compact", "session_end"]);
const OPENCODE_HOOKS = new Set<HookName>(["session_start", "before_mutation", "after_mutation", "turn_stop", "context_compact", "session_end"]);

const DSH_HOME_ENV = "DSH_HOME";
const DSH_HOME_DIR_NAME = ".dsh";
const DSH_BEGIN = "# BEGIN Siftos";
const DSH_END = "# END Siftos";
const DSH_INSERT_ID = "siftos";
const DSH_INSERT_NAME = "./plugins/siftos/index.js";
const DSH_HOOKS = new Set<HookName>(["session_start", "prompt_submit", "before_mutation", "after_mutation", "turn_stop", "context_compact", "session_end"]);

/** dsh's home rule: $DSH_HOME, else ~/.dsh (same precedence as resolveDshHome). */
function dshHomeDir(): string {
  return process.env[DSH_HOME_ENV]?.trim() || path.join(os.homedir(), DSH_HOME_DIR_NAME);
}
function dshSiftosBlock(): string {
  return `${DSH_BEGIN}\n- insert:\n    - id: ${DSH_INSERT_ID}\n      name: '${DSH_INSERT_NAME}'\n${DSH_END}\n`;
}
/**
 * True when the patch contains a real plugin row `id: siftos` whose name is
 * the SiftOS path. Row-level, so comments or config values that merely
 * mention the id, markers, or path never count as an installed adapter.
 */
function dshManagedRow(content: string): boolean {
  const lines = content.split(/\r?\n/);
  const rowIndex = lines.findIndex((line) => /^[ \t]*-?[ \t]*id:[ \t]*siftos[ \t]*$/.test(line));
  if (rowIndex === -1) return false;
  const nextLine = lines[rowIndex + 1] ?? "";
  return /^[ \t]*name:[ \t]*['"]?\.\/plugins\/siftos\/index\.js['"]?/.test(nextLine);
}
function dshAdapterInstalled(dshHome: string): boolean {
  const entry = path.join(dshHome, "plugins", "siftos", "index.js");
  const patch = path.join(dshHome, "cordis.patch.yml");
  if (!existsSync(entry) || !existsSync(patch)) return false;
  try {
    return dshManagedRow(readFileSync(patch, "utf8"));
  } catch { return false; }
}

function doctor(cwd: string) {
  const root = findRepoRoot(cwd);
  const result = {
    repositoryDetected: root !== null, skillInstalled: false, productDir: false,
    productReady: false, strategyReady: false, metricsReady: false, principlesReady: false,
    decisionSchemaValid: false, configValid: false,
    openCodeSkillCompatible: false, openCodeAdapterInstalled: false,
    codexSkillCompatible: false, codexAdapterInstalled: false,
    dshSkillCompatible: false, dshAdapterInstalled: false,
    automationPreset: "not-chosen", automationHealth: "off",
    hooks: [] as Array<{ hook: HookName; label: string; installed: boolean; enabled: boolean; observed: boolean }>,
    healthy: false,
  };
  if (!root) return result;
  result.skillInstalled = existsSync(path.join(root, ".agents", "skills", "siftos", "SKILL.md"));
  result.openCodeSkillCompatible = result.skillInstalled;
  result.codexSkillCompatible = result.skillInstalled;
  result.openCodeAdapterInstalled = openCodeAdapterInstalled(root);
  result.codexAdapterInstalled = codexAdapterInstalled(root);
  result.dshSkillCompatible = result.skillInstalled;
  result.dshAdapterInstalled = dshAdapterInstalled(dshHomeDir());

  const repo = new ProductRepository(root);
  result.productDir = repo.initialized;
  if (!repo.initialized) return result;
  const context = repo.loadProductContext();
  result.productReady = meaningfulContext(context.product);
  result.strategyReady = meaningfulContext(context.strategy);
  result.metricsReady = meaningfulContext(context.metrics);
  result.principlesReady = meaningfulContext(context.principles);
  try { repo.listDecisions(); result.decisionSchemaValid = true; } catch { result.decisionSchemaValid = false; }
  const resolved = effectiveConfig(repo);
  result.configValid = resolved.config !== null && resolved.hooksValid;
  result.automationPreset = resolved.config?.hooks === undefined ? "not-chosen" : resolved.effective.preset;
  for (const name of HOOK_NAMES) {
    const installed = (result.codexAdapterInstalled && CODEX_HOOKS.has(name)) || (result.openCodeAdapterInstalled && OPENCODE_HOOKS.has(name)) || (result.dshAdapterInstalled && DSH_HOOKS.has(name));
    result.hooks.push({ hook: name, label: HOOK_LABELS[name], installed, enabled: resolved.effective.hooks[name].enabled, observed: resolved.session.heartbeat[name] !== undefined });
  }
  const anyEnabled = result.hooks.some((hook) => hook.enabled);
  result.automationHealth = !anyEnabled ? "off" : result.hooks.filter((hook) => hook.enabled).every((hook) => hook.installed) ? "healthy" : "degraded";
  result.healthy = [result.repositoryDetected, result.skillInstalled, result.productDir, result.productReady, result.strategyReady, result.metricsReady, result.principlesReady, result.decisionSchemaValid, result.configValid].every(Boolean);
  return result;
}

function formatDoctor(result: ReturnType<typeof doctor>): string {
  const flag = (ok: boolean) => ok ? CHECK : CROSS;
  const lines = [
    "SiftOS Doctor", "",
    `Repository detected        ${flag(result.repositoryDetected)}`,
    `Skill installed            ${flag(result.skillInstalled)}`,
    `.product directory          ${flag(result.productDir)}`, "",
    `PRODUCT.md ready           ${flag(result.productReady)}`,
    `STRATEGY.md ready          ${flag(result.strategyReady)}`,
    `METRICS.md ready           ${flag(result.metricsReady)}`,
    `PRINCIPLES.md ready        ${flag(result.principlesReady)}`, "",
    `OpenCode skill             ${flag(result.openCodeSkillCompatible)}`,
    `OpenCode hook plugin       ${flag(result.openCodeAdapterInstalled)}`,
    `Codex skill                ${flag(result.codexSkillCompatible)}`,
    `Codex hook adapter         ${flag(result.codexAdapterInstalled)}`,
    `DeepSeek Harness skill     ${flag(result.dshSkillCompatible)}`,
    `DeepSeek Harness hook plugin ${flag(result.dshAdapterInstalled)}`, "",
    `Decision schema            ${flag(result.decisionSchemaValid)}`,
    `Configuration              ${flag(result.configValid)}`, "",
    `Automation: ${result.automationPreset.toUpperCase()} (${result.automationHealth})`, "",
  ];
  for (const hook of result.hooks) lines.push(`${hook.label.padEnd(16)} Installed ${flag(hook.installed)}  Enabled ${flag(hook.enabled)}  Observed ${flag(hook.observed)}`);
  if (!result.configValid) lines.push("", "Invalid hook configuration disables automatic hooks; fix .product/config.json before relying on automation.");
  if (!result.productReady || !result.strategyReady || !result.metricsReady || !result.principlesReady) lines.push("", "Context files containing only placeholders such as `Unknown.` are scaffolds, not healthy product context.");
  if (result.automationHealth === "degraded") lines.push("", "Core/manual SiftOS is healthy independently; automatic hooks are degraded for at least one enabled capability.");
  lines.push("", `Status: ${result.healthy ? "healthy" : "unhealthy"}`);
  return lines.join("\n") + "\n";
}

async function cmdValidate(flags: Record<string, string | boolean>): Promise<number> {
  const repo = tryOpenRepo(flags);
  if (!repo?.initialized) { if (repo) console.error("error: .product/ is not initialized (run `siftos init`)"); return 1; }
  const now = todayOrEnv();
  const metrics = repo.loadProductContext().metrics;
  let failed = false;
  let count = 0;
  const seen = new Set<string>();
  for (const file of repo.decisionFileNames()) {
    const id = file.match(/^(DEC-\d{4})/)?.[1] ?? file;
    if (seen.has(id)) { failed = true; console.error(`${id}  ERROR  duplicate: more than one decision file uses id ${id}`); continue; }
    seen.add(id); count += 1;
    let decision;
    try { decision = parseDecision(readFileSync(path.join(repo.decisionsDir, file), "utf8")); }
    catch (error) { failed = true; console.error(`${id}  ERROR  schema: ${error instanceof ParseError ? error.message : (error as Error).message}`); continue; }
    const validation = validateDecisionObject(decision);
    if (!validation.valid) {
      failed = true;
      for (const issue of validation.issues) console.error(`${id}  ERROR  schema: ${issue.path}: ${issue.message}`);
      continue;
    }
    for (const finding of lintDecision({ decision, allDecisions: repo.listDecisions(), now, metrics })) {
      if (finding.severity === "ERROR") failed = true;
      console.log(`${id}  ${finding.severity}  ${finding.rule}: ${finding.message}`);
    }
  }
  if (count === 0) console.log("no decisions to validate");
  console.log(failed ? `validate: ${count} decision(s) checked, errors found` : `validate: ${count} decision(s) OK`);
  return failed ? 1 : 0;
}

async function cmdAudit(flags: Record<string, string | boolean>): Promise<number> {
  const repo = tryOpenRepo(flags);
  if (!repo?.initialized) return 1;
  const summary = auditDecisions(repo.listDecisions(), { now: todayOrEnv(), metrics: repo.loadProductContext().metrics });
  process.stdout.write(flags["json"] ? JSON.stringify(summary, null, 2) + "\n" : formatAudit(summary));
  return 0;
}

async function cmdSearch(args: Args): Promise<number> {
  const repo = tryOpenRepo(args.flags);
  if (!repo?.initialized) return 1;
  const results = searchDecisions(repo.listDecisions(), args.positionals[0], {
    status: typeof args.flags["status"] === "string" ? args.flags["status"] : undefined,
    tag: typeof args.flags["tag"] === "string" ? args.flags["tag"] : undefined,
    owner: typeof args.flags["owner"] === "string" ? args.flags["owner"] : undefined,
    goal: typeof args.flags["goal"] === "string" ? args.flags["goal"] : undefined,
    pendingReview: Boolean(args.flags["pending-review"]), now: todayOrEnv(),
  });
  if (args.flags["json"]) process.stdout.write(JSON.stringify(results.map((decision) => ({ id: decision.id, title: decision.title, status: decision.status })), null, 2) + "\n");
  else {
    for (const decision of results) console.log(`${decision.id}  ${decision.status.padEnd(10)}  ${decision.createdAt}  ${decision.title}`);
    console.log(`${results.length} result(s)`);
  }
  return 0;
}

async function cmdShow(args: Args): Promise<number> {
  const repo = tryOpenRepo(args.flags);
  if (!repo) return 1;
  const id = args.positionals[0];
  if (!id) { console.error("usage: siftos show <DEC-XXXX>"); return 2; }
  try {
    const decision = repo.readDecision(id);
    const file = repo.decisionFileNames().find((name) => name.startsWith(id));
    console.log(`file: ${path.join(PRODUCT_DIR, "decisions", file ?? `${id}.md`)}`);
    console.log(`id: ${decision.id}`); console.log(`title: ${decision.title}`); console.log(`status: ${decision.status}`);
    console.log(`created_at: ${decision.createdAt}`); console.log(`updated_at: ${decision.updatedAt}`);
    if (decision.owner) console.log(`owner: ${decision.owner}`);
    if (decision.goal) console.log(`goal: ${decision.goal}`);
    if (decision.tags.length) console.log(`tags: ${decision.tags.join(", ")}`);
    console.log("");
    for (const [section, items] of Object.entries(decision.body)) {
      console.log(`## ${section}`);
      for (const item of items.length ? items : ["Unknown."]) console.log(`- ${item}`);
    }
    return 0;
  } catch (error) { console.error(`error: ${(error as Error).message}`); return 1; }
}

async function cmdContext(args: Args): Promise<number> {
  const repo = tryOpenRepo(args.flags);
  if (!repo?.initialized) return 1;
  const compiled = compileContext({
    productContext: repo.loadProductContext(), decisions: repo.listDecisions(), query: args.positionals[0],
    decisionId: typeof args.flags["decision"] === "string" ? args.flags["decision"] : undefined,
    maxRelated: typeof args.flags["max-related"] === "string" ? Number(args.flags["max-related"]) : 5,
  });
  process.stdout.write(formatCompiledContext(compiled) + "\n");
  return 0;
}

async function cmdHooks(args: Args): Promise<number> {
  const repo = tryOpenRepo(args.flags);
  if (!repo?.initialized) return 1;
  const sub = args.positionals[0];
  if (sub === undefined) {
    const resolved = effectiveConfig(repo);
    if (!resolved.hooksValid) { console.error("error: invalid hooks config; automatic hooks are disabled until .product/config.json is fixed"); return 1; }
    console.log("SIFTOS HOOKS\n");
    console.log(`Preset: ${resolved.config?.hooks === undefined ? "not chosen (hooks off)" : resolved.effective.preset}\n`);
    for (const name of HOOK_NAMES) {
      const hook = resolved.effective.hooks[name];
      console.log(`${HOOK_LABELS[name].padEnd(16)} ${hook.enabled ? "ON" : "OFF"}${hook.enforcement && hook.enforcement !== "advisory" ? `  Mode: ${hook.enforcement}` : ""}`);
    }
    if (Object.keys(resolved.session.hook_overrides).length) console.log(`\nSession override active: ${Object.keys(resolved.session.hook_overrides).length} hook(s) — expires at session end.`);
    return 0;
  }
  if (sub !== "set") { console.error("error: usage: siftos hooks | siftos hooks set <preset>"); return 1; }
  const preset = normalizePreset(args.positionals[1] ?? "");
  if (!preset || preset === "custom") { console.error("error: preset must be one of: off | advisory | balanced | strict"); return 1; }
  if (args.flags["session"]) {
    const state = loadRuntime(repo.root);
    for (const name of HOOK_NAMES) state.hook_overrides[name] = presetEnforcement(preset, name);
    saveRuntime(repo.root, state);
    console.log(`Automatic hooks are ${preset} for this session.\nRepository default remains unchanged.`);
    return 0;
  }
  const config = repo.loadConfig() ?? defaultConfigObject();
  repo.saveConfig({ ...config, version: 2, hooks: { preset } });
  console.log(`SiftOS hooks updated.\n\nPreset: ${preset}`);
  return 0;
}

async function cmdHook(args: Args): Promise<number> {
  const action = args.positionals[0];
  const name = normalizeHookName(args.positionals[1] ?? "");
  if ((action !== "enable" && action !== "disable") || !name) { console.error("error: usage: siftos hook enable|disable <hook> [--session]"); return 1; }
  const repo = tryOpenRepo(args.flags);
  if (!repo?.initialized) return 1;
  const enabled = action === "enable";
  if (args.flags["session"]) {
    const state = loadRuntime(repo.root); state.hook_overrides[name] = { enabled }; saveRuntime(repo.root, state);
    console.log(`${HOOK_LABELS[name]} ${enabled ? "enabled" : "disabled"} for this session.\nRepository config unchanged.`); return 0;
  }
  const resolved = effectiveConfig(repo);
  if (!resolved.hooksValid) { console.error("error: invalid hooks config; fix it before editing individual hooks"); return 1; }
  resolved.effective.hooks[name].enabled = enabled;
  if (!enabled) delete resolved.effective.hooks[name].enforcement;
  repo.saveConfig({ ...(resolved.config ?? defaultConfigObject()), version: 2, hooks: materializeHooks(resolved.effective) });
  console.log(`SiftOS hooks updated.\n\nPreset: custom\n\n${HOOK_LABELS[name]}:\n${enabled ? "ON" : "OFF"}`);
  return 0;
}

async function cmdShip(args: Args): Promise<number> {
  const repo = tryOpenRepo(args.flags);
  if (!repo?.initialized) return 1;
  const id = args.positionals[0];
  if (!id) { console.error("error: usage: siftos ship <DEC-XXXX>"); return 1; }
  try {
    const decision = repo.readDecision(id);
    const { result, findings } = shipGate(decision, { metrics: repo.loadProductContext().metrics });
    const state = loadRuntime(repo.root);
    state.ship_gate = { required: result !== "NOT_REQUIRED", passed: result === "FAIL" ? false : result === "NOT_REQUIRED" ? null : true, result, continuations: state.ship_gate.continuations ?? 0 };
    saveRuntime(repo.root, state);
    process.stdout.write(formatShipGate(result, findings));
    return result === "FAIL" ? 1 : 0;
  } catch (error) { console.error(`error: ${(error as Error).message}`); return 1; }
}

async function cmdRoadmap(args: Args): Promise<number> {
  const repo = tryOpenRepo(args.flags);
  if (!repo?.initialized) return 1;
  const groups: Record<string, string[]> = { NOW: [], NEXT: [], LATER: [], "NOT NOW": [] };
  for (const decision of repo.listDecisions()) {
    const line = `${decision.id} — ${decision.title}`;
    if (["building", "shipped", "measuring"].includes(decision.status)) groups.NOW?.push(line);
    else if (["ready", "accepted"].includes(decision.status)) groups.NEXT?.push(line);
    else if (["shaping", "validating"].includes(decision.status)) groups.LATER?.push(line);
    else if (["paused", "cancelled", "failed", "rejected"].includes(decision.status)) groups["NOT NOW"]?.push(line);
  }
  const markdown = `# Product Roadmap\n\nOnly active bets belong on the roadmap.\n\n${Object.entries(groups).map(([name, items]) => `## ${name}\n\n${items.length ? items.map((item) => `- ${item}`).join("\n") : "Unknown."}`).join("\n\n")}\n`;
  if (args.flags["write"]) { writeFileAtomic(repo.productDir, "ROADMAP.md", markdown); console.log("ROADMAP.md regenerated."); }
  else process.stdout.write(markdown);
  return 0;
}

async function cmdGuard(args: Args): Promise<number> {
  const repo = tryOpenRepo(args.flags);
  if (!repo?.initialized) return 1;
  if (!POLICY_OK) {
    console.error("error: SiftOS policy data is unreadable/corrupt; refusing to run Product Guard until the skill policy is fixed");
    return 1;
  }
  const resolved = effectiveConfig(repo);
  if (!resolved.hooksValid) {
    console.error("error: invalid hooks config; automatic Product Guard is disabled until .product/config.json is fixed");
    return 1;
  }
  const hook = resolved.effective.hooks.before_mutation;
  if (!hook.enabled) { process.stdout.write("SIFTOS GUARD: before_mutation is disabled.\n"); return 0; }

  const files = args.positionals[0] === "check" ? args.positionals.slice(1) : args.positionals;
  const prompt = typeof args.flags["prompt"] === "string" ? args.flags["prompt"] : "";
  const levelFlag = typeof args.flags["level"] === "string" ? args.flags["level"].toUpperCase() : null;
  const level: GuardLevel = levelFlag && ["L0", "L1", "L2", "L3", "UNKNOWN"].includes(levelFlag)
    ? levelFlag as GuardLevel
    : classifyLevelDeterministic(files, prompt || undefined);

  let state = loadRuntime(repo.root);
  const explicitTurn = typeof args.flags["turn-id"] === "string" ? args.flags["turn-id"] : null;
  // Manual Guard calls are always independent intents unless --turn-id is
  // explicitly provided; they never join or authorize a live harness turn.
  if (explicitTurn) state = startRuntimeTurn(repo.root, explicitTurn, prompt);
  else state = startRuntimeTurn(repo.root, `manual-${Date.now()}-${process.pid}`, prompt);
  state.guard.level = level;

  const rawResolution = typeof args.flags["resolution"] === "string" ? args.flags["resolution"] : null;
  const resolution = rawResolution && (GUARD_RESOLUTIONS as string[]).includes(rawResolution) ? rawResolution as GuardResolution : null;
  if (resolution) {
    state.guard.resolution = resolution;
    if (resolution === "existing_bet") {
      const id = typeof args.flags["decision"] === "string" ? args.flags["decision"] : null;
      if (!id) { console.error("error: existing_bet requires --decision=DEC-XXXX"); return 1; }
      try {
        const decision = repo.readDecision(id);
        if (!BUILD_AUTHORIZING_STATUSES.has(decision.status)) { console.error(`error: ${id} is ${decision.status}; existing_bet requires an active accepted/building/shipped/measuring Bet`); return 1; }
        state.active_bet = id; state.guard.status = "resolved";
      } catch (error) { console.error(`error: ${(error as Error).message}`); return 1; }
    } else if (resolution === "prototype") { state.active_bet = null; state.guard.status = "resolved"; }
    else if (resolution === "build_anyway") { state.active_bet = null; state.guard.status = "bypassed"; }
    else state.guard.status = "unresolved";
  }

  const authorized = state.guard.intent_id === state.turn_id && ["resolved", "bypassed"].includes(state.guard.status);
  const verdict = authorized ? "ALLOW" : guardVerdict(level, hook.enforcement ?? "advisory");
  const wasBlocked = state.guard.block_issued;
  if (verdict === "BLOCK_ONCE") { state.guard.block_issued = true; state.guard.status = "unresolved"; }
  saveRuntime(repo.root, state);

  if (authorized) { process.stdout.write(`SIFTOS GUARD\n\nLevel: ${level}\nVerdict: ALLOW\nResolution: ${state.guard.resolution}\n`); return 0; }
  if (verdict === "BLOCK_ONCE" && wasBlocked) {
    process.stdout.write(`SIFTOS GUARD — BLOCKED\n\nLevel: ${level}\nVerdict: BLOCK_ONCE\n\nThis product intent is still unresolved. Retrying the mutation does not bypass Product Guard.\n`);
    return 1;
  }
  process.stdout.write(guardMessage(level, verdict, files.length ? files : ["(unknown mutation)"]) + "\n");
  if (resolution && ["shape", "validate", "reconsider"].includes(resolution)) process.stdout.write(`\n${resolution} selected: production mutation remains gated until prototype, existing_bet, or build_anyway is recorded.\n`);
  return verdict === "BLOCK_ONCE" || verdict === "REQUIRE_RESOLUTION" ? 1 : 0;
}

async function cmdScope(args: Args): Promise<number> {
  const repo = tryOpenRepo(args.flags);
  if (!repo?.initialized) return 1;
  const id = args.positionals[0]; const files = args.positionals.slice(1);
  if (!id || !files.length) { console.error("error: usage: siftos scope <DEC-XXXX> <path...>"); return 1; }
  try {
    const drift = detectScopeDrift(repo.readDecision(id), files);
    if (!drift.length) { process.stdout.write("SCOPE: no drift detected.\n"); return 0; }
    process.stdout.write(`SCOPE DRIFT\n\n${drift.map((file) => `- ${file}`).join("\n")}\n`); return 1;
  } catch (error) { console.error(`error: ${(error as Error).message}`); return 1; }
}

const USAGE = `SiftOS — Product Decision Intelligence

Usage:
  siftos install
  siftos init
  siftos validate
  siftos audit
  siftos search <query>
  siftos next-id
  siftos show <DEC-XXXX>
  siftos context [<query>]
  siftos hooks
  siftos hook enable|disable <hook>
  siftos ship <DEC-XXXX>
  siftos roadmap [--write]
  siftos guard check <path...> [--level=L0|L1|L2|L3] [--prompt=<text>] [--resolution=<resolution>] [--turn-id=<id>]
  siftos scope <DEC-XXXX> <path...>
  siftos doctor
  siftos version
`;

export async function main(argv: string[]): Promise<number> {
  const args = parseArgs(argv);
  if (args.flags["help"] || args.command === "help" || args.command === null) { process.stdout.write(USAGE); return args.command === null ? 2 : 0; }
  switch (args.command) {
    case "install": return cmdInstall(args.flags);
    case "init": {
      const root = findRepoRoot(cwdFor(args.flags)) ?? cwdFor(args.flags);
      const repo = new ProductRepository(root);
      const created = repo.init(todayOrEnv());
      console.log("SiftOS initialized.\n\nCreated:"); for (const item of created) console.log(item); console.log("Ready for the first decision."); return 0;
    }
    case "validate": return cmdValidate(args.flags);
    case "audit": return cmdAudit(args.flags);
    case "search": return cmdSearch(args);
    case "next-id": {
      const repo = tryOpenRepo(args.flags); if (!repo) return 1;
      try { process.stdout.write(repo.nextId() + "\n"); return 0; } catch (error) { console.error(`error: ${(error as Error).message}`); return 1; }
    }
    case "show": return cmdShow(args);
    case "context": return cmdContext(args);
    case "doctor": {
      const result = doctor(cwdFor(args.flags));
      process.stdout.write(args.flags["json"] ? JSON.stringify(result, null, 2) + "\n" : formatDoctor(result));
      return result.healthy ? 0 : 1;
    }
    case "hooks": return cmdHooks(args);
    case "hook": return cmdHook(args);
    case "ship": return cmdShip(args);
    case "roadmap": return cmdRoadmap(args);
    case "guard": return cmdGuard(args);
    case "scope": return cmdScope(args);
    case "version": process.stdout.write(packageVersion() + "\n"); return 0;
    default: process.stdout.write(USAGE); return 2;
  }
}

const isMain = process.argv[1] !== undefined && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) process.exit(await main(process.argv.slice(2)));
