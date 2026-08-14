#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync, readFileSync, realpathSync } from "node:fs";
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
  hooksConfigSchema,
  materializeHooks,
  normalizeHookName,
  normalizePreset,
  presetEnforcement,
  resolveHooks,
  type HookName,
  type HookPreset,
  type ParsedHooksConfig,
} from "./config.js";
import { loadRuntime, saveRuntime } from "./runtime.js";
import { writeFileAtomic } from "./atomic.js";
import { formatShipGate, shipGate } from "./shipgate.js";
import {
  classifyLevelDeterministic,
  classifyToolEffect,
  guardMessage,
  guardVerdict,
  GUARD_RESOLUTIONS,
  type GuardLevel,
  type GuardResolution,
} from "./guard.js";
import { detectScopeDrift } from "./hooks.js";
import { ROADMAP_TEMPLATE } from "./templates.js";
import { searchDecisions } from "./search.js";
import { decisionSchema } from "./schema.js";
import type { LintFinding, SiftosConfig } from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const COMMANDS = [
  "install",
  "init",
  "validate",
  "audit",
  "search",
  "next-id",
  "show",
  "context",
  "doctor",
  "hooks",
  "hook",
  "ship",
  "roadmap",
  "guard",
  "scope",
  "version",
  "help",
] as const;

type Command = (typeof COMMANDS)[number];

interface Args {
  command: Command | null;
  positionals: string[];
  flags: Record<string, string | boolean>;
}
const VALUE_FLAGS: Record<string, true> = {
  dir: true,
  status: true,
  tag: true,
  owner: true,
  goal: true,
  decision: true,
  "max-related": true,
  level: true,
  resolution: true,
};

export function parseArgs(argv: string[]): Args {
  const positionals: string[] = [];
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] ?? "";
    if (arg.startsWith("--")) {
      const eq = arg.indexOf("=");
      if (eq !== -1) {
        flags[arg.slice(2, eq)] = arg.slice(eq + 1);
        continue;
      }
      const name = arg.slice(2);
      const next = argv[i + 1];
      if (VALUE_FLAGS[name] === true && next !== undefined && !next.startsWith("--")) {
        flags[name] = next;
        i += 1;
      } else {
        flags[name] = true;
      }
    } else {
      positionals.push(arg);
    }
  }
  const [rawCommand, ...rest] = positionals;
  const command = (rawCommand ?? null) as Command | null;
  return {
    command: command !== null && COMMANDS.includes(command) ? command : null,
    positionals: rest,
    flags,
  };
}

export function todayOrEnv(): string {
  const env = process.env["SIFTOS_TODAY"];
  if (env && /^\d{4}-\d{2}-\d{2}$/.test(env)) return env;
  return new Date().toISOString().slice(0, 10);
}

function cwdFor(flags: Record<string, string | boolean>): string {
  return typeof flags["dir"] === "string" ? flags["dir"] : process.cwd();
}

function openRepo(flags: Record<string, string | boolean>): ProductRepository {
  return ProductRepository.open(cwdFor(flags));
}

/** openRepo with a clean user-facing error instead of a stack trace. */
function tryOpenRepo(flags: Record<string, string | boolean>): ProductRepository | null {
  try {
    return openRepo(flags);
  } catch (err) {
    console.error(`error: ${(err as Error).message}`);
    return null;
  }
}

function packageVersion(): string {
  try {
    const pkg = JSON.parse(
      readFileSync(path.resolve(__dirname, "..", "package.json"), "utf8"),
    ) as { version?: string };
    return pkg.version ?? "unknown";
  } catch {
    return "unknown";
  }
}

function skillSourceDir(): string | null {
  const candidates = [path.resolve(__dirname, "skill"), path.resolve(__dirname, "..", "skill")];
  return candidates.find((c) => existsSync(c)) ?? null;
}

const CHECK = "\u2713";
const CROSS = "\u2717";

async function cmdInstall(flags: Record<string, string | boolean>): Promise<number> {
  const cwd = cwdFor(flags);
  const root = findRepoRoot(cwd) ?? cwd;
  const source = skillSourceDir();
  if (!source) {
    console.error("error: skill package not found next to this CLI (corrupted install)");
    return 1;
  }
  const target = path.join(root, ".agents", "skills", "siftos");
  mkdirSync(target, { recursive: true });
  cpSync(source, target, { recursive: true });

  // V2 hook adapters (PRD V2 §114, §158). Writing adapters is NOT
  // enabling them: hooks stay off until the user chooses a preset
  // (`siftos hooks set <preset>`), so upgrade never surprises (PRD V2 §45).
  const codexDir = path.join(root, ".codex");
  mkdirSync(codexDir, { recursive: true });
  const hookCommand = "node .agents/skills/siftos/scripts/hook-codex.mjs";
  const codexHooks = {
    hooks: {
      SessionStart: [
        { matcher: "*", hooks: [{ type: "command", command: `${hookCommand} session_start` }] },
      ],
      UserPromptSubmit: [
        { matcher: "*", hooks: [{ type: "command", command: `${hookCommand} prompt_submit` }] },
      ],
      PreToolUse: [
        {
          matcher: "Write|Edit|MultiEdit|Bash",
          hooks: [{ type: "command", command: `${hookCommand} before_mutation` }],
        },
      ],
      PostToolUse: [
        {
          matcher: "Write|Edit|MultiEdit",
          hooks: [{ type: "command", command: `${hookCommand} after_mutation` }],
        },
      ],
      Stop: [
        { matcher: "*", hooks: [{ type: "command", command: `${hookCommand} turn_stop` }] },
      ],
    },
  };
  writeFileAtomic(codexDir, "hooks.json", JSON.stringify(codexHooks, null, 2) + "\n");
  const opencodeDir = path.join(root, ".opencode");
  mkdirSync(opencodeDir, { recursive: true });
  writeFileAtomic(
    opencodeDir,
    "README.md",
    "SiftOS hook adapter (OpenCode). Logical events map to lifecycle " +
      "adapter points; the agent executes the configured hooks per " +
      "references/hooks.md. Adapters are inert until hooks are enabled in " +
      ".product/config.json.\n",
  );

  console.log(`${CHECK} SiftOS skill installed`);
  console.log("");
  console.log("Detected:");
  console.log("");
  console.log(`${CHECK} OpenCode compatible (SKILL.md standard)`);
  console.log(`${CHECK} Codex compatible (SKILL.md standard)`);
  console.log("");
  console.log("Installed:");
  console.log("");
  console.log(`${path.relative(cwd, target) || "."}/`);
  console.log("");
  console.log("Hook adapters installed (inert).");
  console.log("");
  console.log("Next:");
  console.log("Ask your agent to initialize SiftOS.");
  console.log("Automation stays OFF until you choose: `siftos hooks set advisory|balanced|strict`");
  return 0;
}

interface DoctorResult {
  repositoryDetected: boolean;
  skillInstalled: boolean;
  productDir: boolean;
  productValid: boolean;
  strategyValid: boolean;
  metricsValid: boolean;
  principlesValid: boolean;
  decisionSchemaValid: boolean;
  linterConfigValid: boolean;
  openCodeCompatible: boolean;
  codexCompatible: boolean;
  /** Effective automation preset: off|advisory|balanced|strict|custom|not-chosen */
  automationPreset: string;
  hooks: Array<{
    hook: HookName;
    label: string;
    installed: boolean;
    enabled: boolean;
    observed: boolean;
  }>;
}

function doctor(cwd: string): DoctorResult {
  const root = findRepoRoot(cwd);
  const result: DoctorResult = {
    repositoryDetected: root !== null,
    skillInstalled: false,
    productDir: false,
    productValid: false,
    strategyValid: false,
    metricsValid: false,
    principlesValid: false,
    decisionSchemaValid: false,
    linterConfigValid: false,
    openCodeCompatible: false,
    codexCompatible: false,
    automationPreset: "not-chosen",
    hooks: [],
  };
  if (root === null) return result;

  result.skillInstalled = existsSync(path.join(root, ".agents", "skills", "siftos", "SKILL.md"));
  result.openCodeCompatible = result.skillInstalled;
  result.codexCompatible = result.skillInstalled;

  const repo = new ProductRepository(root);
  result.productDir = repo.initialized;
  if (!repo.initialized) return result;

  const context = repo.loadProductContext();
  result.productValid = context.product.trim() !== "";
  result.strategyValid = context.strategy.trim() !== "";
  result.metricsValid = context.metrics.trim() !== "";
  result.principlesValid = context.principles.trim() !== "";

  try {
    repo.listDecisions();
    result.decisionSchemaValid = true;
  } catch {
    result.decisionSchemaValid = false;
  }

  result.linterConfigValid = repo.loadConfig() !== null;

  // V2: effective hook policy + installed/enabled/observed per hook.
  const config = repo.loadConfig();
  const rawHooks = parseHooksFile(config);
  const session = loadRuntime(root);
  const effective = resolveHooks({
    repository: rawHooks,
    globalPreset: loadGlobalPreset(),
    sessionOverrides: session.hook_overrides,
  });
  result.automationPreset = config?.hooks === undefined ? "not-chosen" : effective.preset;
  for (const name of HOOK_NAMES) {
    result.hooks.push({
      hook: name,
      label: HOOK_LABELS[name],
      installed: adapterPlatform(root) !== null,
      enabled: effective.hooks[name].enabled,
      observed: session.heartbeat[name] !== undefined,
    });
  }
  return result;
}

/** Adapter presence: Codex hooks.json or OpenCode plugin dir. */
function adapterPlatform(root: string): "codex" | "opencode" | null {
  if (existsSync(path.join(root, ".codex", "hooks.json"))) return "codex";
  if (existsSync(path.join(root, ".opencode"))) return "opencode";
  return null;
}

/** Parses the raw `hooks` block of a repository config, if present. */
function parseHooksFile(config: SiftosConfig | null): ParsedHooksConfig | null {
  if (config?.hooks === undefined) return null;
  const parsed = hooksConfigSchema.safeParse(config.hooks);
  return parsed.success ? parsed.data : null;
}

function globalConfigPath(): string {
  return path.join(os.homedir(), ".siftos", "config.json");
}

/** Optional personal default preset (`~/.siftos/config.json`). */
function loadGlobalPreset(): HookPreset | null {
  try {
    const parsed = JSON.parse(readFileSync(globalConfigPath(), "utf8")) as {
      default_hook_preset?: string;
    };
    const preset = normalizePreset(parsed.default_hook_preset ?? "");
    return preset === "custom" ? null : preset;
  } catch {
    return null;
  }
}

function fmtDoctor(result: DoctorResult): string {
  const lines: string[] = [];
  const flag = (ok: boolean) => (ok ? `${CHECK}` : `${CROSS}`);
  lines.push("SiftOS Doctor");
  lines.push("");
  lines.push(`Repository detected        ${flag(result.repositoryDetected)}`);
  lines.push(`Skill installed            ${flag(result.skillInstalled)}`);
  lines.push(`${PRODUCT_DIR} directory          ${flag(result.productDir)}`);
  lines.push(`PRODUCT.md valid           ${flag(result.productValid)}`);
  lines.push(`STRATEGY.md valid          ${flag(result.strategyValid)}`);
  lines.push(`METRICS.md valid           ${flag(result.metricsValid)}`);
  lines.push(`PRINCIPLES.md valid        ${flag(result.principlesValid)}`);
  lines.push("");
  lines.push(`OpenCode compatibility     ${flag(result.openCodeCompatible)}`);
  lines.push(`Codex compatibility        ${flag(result.codexCompatible)}`);
  lines.push("");
  lines.push(`Decision schema            ${flag(result.decisionSchemaValid)}`);
  lines.push(`Linter configuration       ${flag(result.linterConfigValid)}`);
  lines.push("");
  if (result.hooks.length > 0) {
    lines.push(`Automation: ${result.automationPreset.toUpperCase()}`);
    lines.push("");
    for (const h of result.hooks) {
      lines.push(
        `${h.label.padEnd(16)} Installed ${flag(h.installed)}  Enabled ${flag(h.enabled)}  Observed ${flag(h.observed)}`,
      );
    }
    if (result.automationPreset === "not-chosen") {
      lines.push("");
      lines.push("Hooks are not enabled. Choose a level: `siftos hooks set advisory|balanced|strict`");
    }
    lines.push("");
  }
  const healthy = [
    result.repositoryDetected,
    result.skillInstalled,
    result.productDir,
    result.productValid,
    result.strategyValid,
    result.metricsValid,
    result.principlesValid,
    result.decisionSchemaValid,
    result.linterConfigValid,
    result.openCodeCompatible,
    result.codexCompatible,
  ].every(Boolean);
  lines.push(`Status: ${healthy ? "healthy" : "unhealthy"}`);
  return lines.join("\n") + "\n";
}

async function cmdValidate(
  flags: Record<string, string | boolean>,
): Promise<number> {
  let repo: ProductRepository;
  try {
    repo = openRepo(flags);
  } catch (err) {
    console.error(`error: ${(err as Error).message}`);
    return 1;
  }
  if (!repo.initialized) {
    console.error("error: .product/ is not initialized (run `siftos init`)");
    return 1;
  }

  const now = todayOrEnv();
  const metrics = repo.loadProductContext().metrics;
  let failed = false;
  let count = 0;
  const seenIds = new Set<string>();

  for (const file of repo.decisionFileNames()) {
    const id = file.match(/^(DEC-\d{4})/)?.[1] ?? file;
    if (seenIds.has(id)) {
      failed = true;
      console.error(`${id}  ERROR  duplicate: more than one decision file uses id ${id}`);
      continue;
    }
    seenIds.add(id);
    count += 1;
    let decision;
    try {
      decision = parseDecision(readFileSync(path.join(repo.decisionsDir, file), "utf8"));
    } catch (err) {
      failed = true;
      const msg = err instanceof ParseError ? err.message : (err as Error).message;
      console.error(`${id}  ERROR  schema: ${msg}`);
      continue;
    }
    const schemaResult = validateDecisionObject(decision);
    if (!schemaResult.valid) {
      failed = true;
      for (const issue of schemaResult.issues) {
        console.error(`${id}  ERROR  schema: ${issue.path}: ${issue.message}`);
      }
      continue;
    }
    const findings = lintDecision({ decision, allDecisions: repo.listDecisions(), now, metrics });
    for (const f of findings) {
      if (f.severity === "ERROR") failed = true;
      console.log(`${id}  ${f.severity}  ${f.rule}: ${f.message}`);
    }
  }

  if (count === 0) console.log("no decisions to validate");
  console.log(failed ? `validate: ${count} decision(s) checked, errors found` : `validate: ${count} decision(s) OK`);
  return failed ? 1 : 0;
}

async function cmdAudit(flags: Record<string, string | boolean>): Promise<number> {
  const repo = openRepo(flags);
  if (!repo.initialized) {
    console.error("error: .product/ is not initialized (run `siftos init`)");
    return 1;
  }
  const now = todayOrEnv();
  const summary = auditDecisions(repo.listDecisions(), {
    now,
    metrics: repo.loadProductContext().metrics,
  });
  if (flags["json"]) {
    process.stdout.write(JSON.stringify(summary, null, 2) + "\n");
  } else {
    process.stdout.write(formatAudit(summary));
  }
  return 0;
}

async function cmdSearch(
  args: Args,
): Promise<number> {
  const repo = tryOpenRepo(args.flags);
  if (repo === null) return 1;
  if (!repo.initialized) {
    console.error("error: .product/ is not initialized (run `siftos init`)");
    return 1;
  }
  const query = args.positionals[0];
  const results = searchDecisions(repo.listDecisions(), query, {
    status: typeof args.flags["status"] === "string" ? args.flags["status"] : undefined,
    tag: typeof args.flags["tag"] === "string" ? args.flags["tag"] : undefined,
    owner: typeof args.flags["owner"] === "string" ? args.flags["owner"] : undefined,
    goal: typeof args.flags["goal"] === "string" ? args.flags["goal"] : undefined,
    pendingReview: Boolean(args.flags["pending-review"]),
    now: todayOrEnv(),
  });
  if (args.flags["json"]) {
    process.stdout.write(JSON.stringify(results.map((d) => ({ id: d.id, title: d.title, status: d.status })), null, 2) + "\n");
    return 0;
  }
  for (const d of results) {
    console.log(`${d.id}  ${d.status.padEnd(10)}  ${d.createdAt}  ${d.title}`);
  }
  console.log(`${results.length} result(s)`);
  return 0;
}

async function cmdShow(args: Args): Promise<number> {
  const repo = tryOpenRepo(args.flags);
  if (repo === null) return 1;
  const id = args.positionals[0];
  if (!id) {
    console.error("usage: siftos show <DEC-XXXX>");
    return 2;
  }
  let decision;
  try {
    decision = repo.readDecision(id);
  } catch (err) {
    console.error(`error: ${(err as Error).message}`);
    return 1;
  }
  const file = repo.decisionFileNames().find((f) => f.startsWith(id));
  console.log(`file: ${path.join(PRODUCT_DIR, "decisions", file ?? `${id}.md`)}`);
  console.log(`id: ${decision.id}`);
  console.log(`title: ${decision.title}`);
  console.log(`status: ${decision.status}`);
  console.log(`created_at: ${decision.createdAt}`);
  console.log(`updated_at: ${decision.updatedAt}`);
  if (decision.owner) console.log(`owner: ${decision.owner}`);
  if (decision.goal) console.log(`goal: ${decision.goal}`);
  if (decision.tags.length > 0) console.log(`tags: ${decision.tags.join(", ")}`);
  console.log("");
  for (const [section, items] of Object.entries(decision.body)) {
    console.log(`## ${section}`);
    for (const item of items.length > 0 ? items : ["Unknown."]) console.log(`- ${item}`);
  }
  return 0;
}

async function cmdContext(args: Args): Promise<number> {
  const repo = tryOpenRepo(args.flags);
  if (repo === null) return 1;
  if (!repo.initialized) {
    console.error("error: .product/ is not initialized (run `siftos init`)");
    return 1;
  }
  const compiled = compileContext({
    productContext: repo.loadProductContext(),
    decisions: repo.listDecisions(),
    query: args.positionals[0],
    decisionId: typeof args.flags["decision"] === "string" ? args.flags["decision"] : undefined,
    maxRelated: typeof args.flags["max-related"] === "string" ? Number(args.flags["max-related"]) : 5,
  });
  process.stdout.write(formatCompiledContext(compiled) + "\n");
  return 0;
}

const HOOK_USAGE = `SiftOS hooks control

Usage:
  siftos hooks                    Show the effective hook policy and per-hook state
  siftos hooks set <preset>       Set preset: off | advisory | balanced | strict
                                  (--session applies to the current session only)
  siftos hook enable <hook>       Enable one hook (converts preset to custom)
  siftos hook disable <hook>      Disable one hook (converts preset to custom)
                                  (--session applies to the current session only)

Hooks:
  session-start prompt-submit before-mutation after-mutation
  turn-stop context-compact subagent-start session-end

Session overrides expire at session end and never modify the repository config.
`;

function defaultConfigObject(): SiftosConfig {
  return {
    version: 2,
    name: "siftos",
    platforms: ["opencode", "codex"],
    linters: { enabled: true },
  };
}

async function cmdHooks(args: Args): Promise<number> {
  const repo = tryOpenRepo(args.flags);
  if (repo === null) return 1;
  if (!repo.initialized) {
    console.error("error: .product/ is not initialized (run `siftos init`)");
    return 1;
  }
  const sub = args.positionals[0];

  if (sub === undefined) {
    const config = repo.loadConfig();
    const rawHooks = parseHooksFile(config);
    const session = loadRuntime(repo.root);
    const effective = resolveHooks({
      repository: rawHooks,
      globalPreset: loadGlobalPreset(),
      sessionOverrides: session.hook_overrides,
    });
    const presetLabel = config?.hooks === undefined ? "not chosen (hooks off)" : effective.preset;
    console.log("SIFTOS HOOKS");
    console.log("");
    console.log(`Preset: ${presetLabel}`);
    if (config?.hooks === undefined) {
      console.log("");
      console.log("Hooks are not enabled yet. Choose a level:");
      console.log("  siftos hooks set advisory | balanced | strict");
    }
    console.log("");
    for (const name of HOOK_NAMES) {
      const h = effective.hooks[name];
      const state = h.enabled ? "ON" : "OFF";
      const mode = h.enforcement && h.enforcement !== "advisory" ? `  Mode: ${h.enforcement}` : "";
      console.log(`${HOOK_LABELS[name].padEnd(16)} ${state}${mode}`);
    }
    const sessionKeys = Object.keys(session.hook_overrides).length;
    if (sessionKeys > 0) {
      console.log("");
      console.log(`Session override active: ${sessionKeys} hook(s) — expires at session end.`);
    }
    return 0;
  }

  if (sub === "set") {
    const preset = normalizePreset(args.positionals[1] ?? "");
    if (!preset || preset === "custom") {
      console.error("error: preset must be one of: off | advisory | balanced | strict");
      return 1;
    }
    if (args.flags["session"]) {
      const session = loadRuntime(repo.root);
      // Materialize the full preset (enforcement included) so the session
      // policy fully replaces the repository one (PRD FR-SESSION-001..004).
      for (const name of HOOK_NAMES) {
        session.hook_overrides[name] = presetEnforcement(preset, name);
      }
      saveRuntime(repo.root, session);
      console.log(`Automatic hooks are ${preset === "off" ? "off" : preset} for this session.`);
      console.log("Repository default remains unchanged.");
      return 0;
    }
    const config = repo.loadConfig() ?? defaultConfigObject();
    repo.saveConfig({ ...config, version: 2, hooks: { preset } });
    console.log(`SiftOS hooks updated.`);
    console.log("");
    console.log(`Preset: ${preset}`);
    return 0;
  }

  console.error("error: usage: siftos hooks | siftos hooks set <preset> | siftos hook enable|disable <hook>");
  return 1;
}

async function cmdHook(args: Args): Promise<number> {
  const action = args.positionals[0];
  const name = normalizeHookName(args.positionals[1] ?? "");
  if ((action !== "enable" && action !== "disable") || name === null) {
    console.error("error: usage: siftos hook enable|disable <hook> [--session]");
    return 1;
  }
  const repo = tryOpenRepo(args.flags);
  if (repo === null) return 1;
  if (!repo.initialized) {
    console.error("error: .product/ is not initialized (run `siftos init`)");
    return 1;
  }
  const enabled = action === "enable";

  if (args.flags["session"]) {
    const session = loadRuntime(repo.root);
    session.hook_overrides[name] = { enabled };
    saveRuntime(repo.root, session);
    console.log(`${HOOK_LABELS[name]} ${enabled ? "enabled" : "disabled"} for this session.`);
    console.log("Repository config unchanged.");
    return 0;
  }

  const config = repo.loadConfig();
  const rawHooks = parseHooksFile(config);
  const effective = resolveHooks({
    repository: rawHooks,
    globalPreset: loadGlobalPreset(),
  });
  effective.hooks[name].enabled = enabled;
  if (!enabled) delete effective.hooks[name].enforcement;
  repo.saveConfig({
    ...(config ?? defaultConfigObject()),
    version: 2,
    hooks: materializeHooks(effective),
  });
  console.log("SiftOS hooks updated.");
  console.log("");
  console.log("Preset: custom");
  console.log("");
  console.log(`${HOOK_LABELS[name]}:`);
  console.log(enabled ? "ON" : "OFF");
  return 0;
}

async function cmdShip(args: Args): Promise<number> {
  const repo = tryOpenRepo(args.flags);
  if (repo === null) return 1;
  if (!repo.initialized) {
    console.error("error: .product/ is not initialized (run `siftos init`)");
    return 1;
  }
  const id = args.positionals[0];
  if (!id) {
    console.error("error: usage: siftos ship <DEC-XXXX>");
    return 1;
  }
  let decision;
  try {
    decision = repo.readDecision(id);
  } catch (err) {
    console.error(`error: ${(err as Error).message}`);
    return 1;
  }
  const metrics = repo.loadProductContext().metrics;
  const { result, findings } = shipGate(decision, { metrics });

  // Record the gate in disposable runtime state (PRD V2 §83) so the
  // Turn Stop hook and doctor can report it. NOT_REQUIRED records
  // required:false; PASS_WITH_WARNINGS counts as passed (shippable).
  const session = loadRuntime(repo.root);
  session.ship_gate = {
    required: result !== "NOT_REQUIRED",
    passed: result === "FAIL" ? false : result === "NOT_REQUIRED" ? null : true,
    result,
  };
  saveRuntime(repo.root, session);

  process.stdout.write(formatShipGate(result, findings));
  return result === "FAIL" ? 1 : 0;
}

async function cmdRoadmap(args: Args): Promise<number> {
  const repo = tryOpenRepo(args.flags);
  if (repo === null) return 1;
  if (!repo.initialized) {
    console.error("error: .product/ is not initialized (run `siftos init`)");
    return 1;
  }
  const now: string[] = [];
  const next: string[] = [];
  const later: string[] = [];
  const notNow: string[] = [];
  for (const d of repo.listDecisions()) {
    const line = `${d.id} — ${d.title}`;
    if (["building", "shipped", "measuring"].includes(d.status)) now.push(line);
    else if (["ready", "accepted"].includes(d.status)) next.push(line);
    else if (["shaping", "validating"].includes(d.status)) later.push(line);
    else if (["paused", "cancelled", "failed", "rejected"].includes(d.status)) notNow.push(line);
  }
  const groups: Array<[string, string[]]> = [
    ["NOW", now],
    ["NEXT", next],
    ["LATER", later],
    ["NOT NOW", notNow],
  ];
  const render = (name: string, items: string[]): string =>
    `## ${name}

${items.length > 0 ? items.map((i) => `- ${i}`).join("\n") : "Unknown."}`;

  const markdown = `# Product Roadmap

Only active bets belong on the roadmap (PRD V2 §92).\n\n${groups.map(([name, items]) => render(name, items)).join("\n\n")}\n`;
  if (args.flags["write"]) {
    writeFileAtomic(repo.productDir, "ROADMAP.md", markdown);
    console.log("ROADMAP.md regenerated.");
    return 0;
  }
  process.stdout.write(markdown);
  return 0;
}

async function cmdGuard(args: Args): Promise<number> {
  const repo = tryOpenRepo(args.flags);
  if (repo === null) return 1;
  if (!repo.initialized) {
    console.error("error: .product/ is not initialized (run `siftos init`)");
    return 1;
  }
  // Optional sugar: `siftos guard check <paths...>` == `siftos guard <paths...>`.
  const positionals = args.positionals[0] === "check" ? args.positionals.slice(1) : args.positionals;
  const files = positionals;
  const displayFiles = files.length > 0 ? files : ["(unknown mutation)"];
  // Agent-executed hooks pass the model-classified level explicitly;
  // script hooks use the deterministic fallback (empty scope -> UNKNOWN).
  const levelFlag = typeof args.flags["level"] === "string" ? args.flags["level"].toUpperCase() : null;
  const level: GuardLevel =
    levelFlag && ["L0", "L1", "L2", "L3", "UNKNOWN"].includes(levelFlag)
      ? (levelFlag as GuardLevel)
      : classifyLevelDeterministic(files);

  const config = repo.loadConfig();
  const rawHooks = parseHooksFile(config);
  const session = loadRuntime(repo.root);
  const effective = resolveHooks({
    repository: rawHooks,
    globalPreset: loadGlobalPreset(),
    sessionOverrides: session.hook_overrides,
  });
  const enforcement = effective.hooks.before_mutation.enforcement ?? "advisory";
  if (!effective.hooks.before_mutation.enabled) {
    process.stdout.write("SIFTOS GUARD: before_mutation is disabled (PRD V2 §31).\n");
    return 0;
  }

  const resolutionFlag = typeof args.flags["resolution"] === "string" ? args.flags["resolution"] : null;
  const hasResolution =
    resolutionFlag !== null && (GUARD_RESOLUTIONS as string[]).includes(resolutionFlag);
  // A user resolution (shape/validate/prototype/existing_bet/reconsider/
  // build_anyway) resolves the CURRENT mutation: verdict becomes ALLOW
  // and block-once is cleared for the next one (PRD V2 §52-§53, §63).
  let verdict = hasResolution ? "ALLOW" : guardVerdict(level, enforcement);
  if (verdict === "BLOCK_ONCE" && session.guard.block_issued) {
    verdict = "ALLOW"; // block-once rule (PRD V2 §63): one opportunity.
  }
  if (verdict === "BLOCK_ONCE") {
    session.guard.block_issued = true;
  }
  if (hasResolution) {
    session.guard.resolution = resolutionFlag as GuardResolution;
    session.guard.block_issued = false;
  }
  session.guard.level = level;
  saveRuntime(repo.root, session);

  process.stdout.write(guardMessage(level, verdict, displayFiles) + "\n");
  if (verdict === "BLOCK_ONCE" || verdict === "REQUIRE_RESOLUTION") return 1;
  return 0;
}

async function cmdScope(args: Args): Promise<number> {
  const repo = tryOpenRepo(args.flags);
  if (repo === null) return 1;
  if (!repo.initialized) {
    console.error("error: .product/ is not initialized (run `siftos init`)");
    return 1;
  }
  const id = args.positionals[0];
  const files = args.positionals.slice(1);
  if (!id || files.length === 0) {
    console.error("error: usage: siftos scope <DEC-XXXX> <path...>");
    return 1;
  }
  let decision;
  try {
    decision = repo.readDecision(id);
  } catch (err) {
    console.error(`error: ${(err as Error).message}`);
    return 1;
  }
  const drift = detectScopeDrift(decision, files);
  if (drift.length === 0) {
    process.stdout.write("SCOPE: no drift detected.\n");
    return 0;
  }
  process.stdout.write(`SCOPE DRIFT (PRD V2 §67)\n\n${drift.map((f) => `- ${f}`).join("\n")}\n`);
  return 1;
}

const USAGE = `SiftOS — Product Decision Intelligence

Usage:
  siftos install            Install the SiftOS agent skill (.agents/skills/siftos/)
  siftos init               Scaffold .product/ with persistent product context
  siftos validate           Parse, schema-validate and lint all PDRs (exit 1 on ERROR)
  siftos audit              Decision Health report (PRD §53)
  siftos search <query>     Textual search over decisions
                            Flags: --status= --tag= --owner= --goal= --pending-review
  siftos next-id            Print the next monotonic decision ID
  siftos show <DEC-XXXX>    Show one decision
  siftos context [<query>]  Compile the context package for an agent workflow
                            Flags: --decision=DEC-XXXX --max-related=N
  siftos hooks              Show and change the automatic hook policy
                            Subcommands: hooks set <preset>, hook enable|disable <hook>
                            Flags: --session
  siftos ship <DEC-XXXX>    Run the deterministic Ship Gate (PRD V2 §74)
  siftos roadmap            Render the roadmap from active bets (--write persists)
  siftos guard check <p>    Product Guard: classify and gate a mutation
                            Flags: --level=L0|L1|L2|L3 (LLM path), --resolution=<res>
  siftos scope <DEC> <p>    Detect scope drift: implementation vs bet scope
  siftos doctor             Verify repository and installation health
  siftos version            Print version

Global flags:
  --dir=<path>              Operate on another directory
  --json                    Machine-readable output where supported
  SIFTOS_TODAY=YYYY-MM-DD   Pin "today" for deterministic review/staleness checks
`;

export async function main(argv: string[]): Promise<number> {
  const args = parseArgs(argv);
  const command = args.command;

  if (args.flags["help"] || command === "help" || command === null) {
    process.stdout.write(USAGE);
    return command === null ? 2 : 0;
  }

  switch (command) {
    case "install":
      return cmdInstall(args.flags);
    case "init": {
      const cwd = cwdFor(args.flags);
      const root = findRepoRoot(cwd) ?? cwd;
      const repo = new ProductRepository(root);
      const created = repo.init(todayOrEnv());
      console.log("SiftOS initialized.");
      console.log("");
      console.log("Created:");
      for (const p of created) console.log(p);
      console.log("Ready for the first decision.");
      return 0;
    }
    case "validate":
      return cmdValidate(args.flags);
    case "audit":
      return cmdAudit(args.flags);
    case "search":
      return cmdSearch(args);
    case "show":
      return cmdShow(args);
    case "context":
      return cmdContext(args);
    case "next-id": {
      const repo = openRepo(args.flags);
      let next: string;
      try {
        next = repo.nextId();
      } catch (err) {
        console.error(`error: ${(err as Error).message}`);
        return 1;
      }
      process.stdout.write(next + "\n");
      return 0;
    }
    case "hooks":
      return cmdHooks(args);
    case "hook":
      return cmdHook(args);
    case "ship":
      return cmdShip(args);
    case "roadmap":
      return cmdRoadmap(args);
    case "guard":
      return cmdGuard(args);
    case "scope":
      return cmdScope(args);
    case "doctor": {
      const result = doctor(cwdFor(args.flags));
      if (args.flags["json"]) {
        process.stdout.write(JSON.stringify(result, null, 2) + "\n");
      } else {
        process.stdout.write(fmtDoctor(result));
      }
      return result.repositoryDetected && result.skillInstalled ? 0 : 1;
    }
    case "version":
      process.stdout.write(packageVersion() + "\n");
      return 0;
    default:
      process.stdout.write(USAGE);
      return 2;
  }
}
const isMain =
  process.argv[1] !== undefined &&
  realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const exitCode = await main(process.argv.slice(2));
  process.exit(exitCode);
}

