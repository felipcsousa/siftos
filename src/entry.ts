#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { main as coreMain, parseArgs } from "./cli.js";
import { hooksConfigSchema, normalizePreset, resolveHooks, HOOK_LABELS, HOOK_NAMES, type HookName, type HookPreset, type ParsedHooksConfig } from "./config.js";
import { classifyLevelDeterministic, guardMessage, guardVerdict, GUARD_RESOLUTIONS, type GuardLevel, type GuardResolution } from "./guard.js";
import { ProductRepository, findRepoRoot } from "./repo.js";
import { loadRuntime, saveRuntime } from "./runtime.js";
import { writeFileAtomic } from "./atomic.js";
import type { SiftosConfig } from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHECK = "✓";
const CROSS = "✗";

function cwdFor(flags: Record<string, string | boolean>): string {
  return typeof flags.dir === "string" ? flags.dir : process.cwd();
}

function skillSourceDir(): string | null {
  const candidates = [path.resolve(__dirname, "skill"), path.resolve(__dirname, "..", "skill")];
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

function defaultConfigObject(): SiftosConfig {
  return { version: 2, name: "siftos", platforms: ["opencode", "codex"], linters: { enabled: true } };
}

function parseHooksFile(config: SiftosConfig | null): ParsedHooksConfig | null {
  if (config?.hooks === undefined) return null;
  const parsed = hooksConfigSchema.safeParse(config.hooks);
  return parsed.success ? parsed.data : null;
}

function loadGlobalPreset(): HookPreset | null {
  try {
    const parsed = JSON.parse(readFileSync(path.join(os.homedir(), ".siftos", "config.json"), "utf8")) as { default_hook_preset?: string };
    const preset = normalizePreset(parsed.default_hook_preset ?? "");
    return preset === "custom" ? null : preset;
  } catch {
    return null;
  }
}

async function install(flags: Record<string, string | boolean>): Promise<number> {
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

  const hookCommand = "node .agents/skills/siftos/scripts/hook-codex.mjs";
  const codexHooks = {
    description: "Optional SiftOS product-decision lifecycle hooks.",
    hooks: {
      SessionStart: [{
        matcher: "startup|resume|clear|compact",
        hooks: [{ type: "command", command: `${hookCommand} session_start`, additionalContextLimit: 5000 }],
      }],
      UserPromptSubmit: [{
        hooks: [{ type: "command", command: `${hookCommand} prompt_submit`, additionalContextLimit: 1500 }],
      }],
      PreToolUse: [{
        matcher: "Bash|apply_patch|Edit|Write",
        hooks: [{ type: "command", command: `${hookCommand} before_mutation` }],
      }],
      PostToolUse: [{
        matcher: "Bash|apply_patch|Edit|Write",
        hooks: [{ type: "command", command: `${hookCommand} after_mutation` }],
      }],
      PreCompact: [{
        matcher: "manual|auto",
        hooks: [{ type: "command", command: `${hookCommand} context_compact` }],
      }],
      Stop: [{ hooks: [{ type: "command", command: `${hookCommand} turn_stop` }] }],
      SessionEnd: [{ hooks: [{ type: "command", command: `${hookCommand} session_end` }] }],
    },
  };
  const codexDir = path.join(root, ".codex");
  mkdirSync(codexDir, { recursive: true });
  writeFileAtomic(codexDir, "hooks.json", JSON.stringify(codexHooks, null, 2) + "\n");

  const openCodePlugins = path.join(root, ".opencode", "plugins");
  mkdirSync(openCodePlugins, { recursive: true });
  writeFileAtomic(
    openCodePlugins,
    "siftos.js",
    `// Installed by SiftOS. Canonical implementation lives with the agent skill.\nexport { SiftOSPlugin } from "../../.agents/skills/siftos/adapters/opencode-plugin.js";\n`,
  );

  console.log(`${CHECK} SiftOS skill installed`);
  console.log(`${CHECK} Codex lifecycle adapter installed`);
  console.log(`${CHECK} OpenCode plugin adapter installed`);
  console.log("");
  console.log("Automation remains OFF until explicitly enabled with:");
  console.log("  siftos hooks set advisory | balanced | strict");
  console.log("");
  console.log("OpenCode note: mutation gating/tracking and compaction are native plugin hooks; prompt-submit and Stop-style continuation do not currently have documented 1:1 parity with Codex, so those paths degrade explicitly instead of being reported as equivalent.");
  return 0;
}

function meaningfulContext(markdown: string): boolean {
  const placeholders = /^(unknown\.?|tbd\.?|n\/a\.?|none\.?|unspecified\.?)$/i;
  const structural = /^(metric|definition|baseline|target|source|date|access):?$/i;
  return markdown
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^[-*]\s+/, ""))
    .filter((line) => line !== "" && !line.startsWith("#"))
    .some((line) => {
      const normalized = line.replace(/^[A-Za-z][A-Za-z ]*:\s*/, "").trim();
      return !structural.test(line) && normalized !== "" && !placeholders.test(normalized);
    });
}

function codexAdapterInstalled(root: string): boolean {
  const hooks = path.join(root, ".codex", "hooks.json");
  if (!existsSync(hooks)) return false;
  try {
    const text = readFileSync(hooks, "utf8");
    return text.includes("hook-codex.mjs") && text.includes("PreToolUse") && text.includes("UserPromptSubmit") && text.includes("Stop");
  } catch {
    return false;
  }
}

function openCodeAdapterInstalled(root: string): boolean {
  const plugin = path.join(root, ".opencode", "plugins", "siftos.js");
  const implementation = path.join(root, ".agents", "skills", "siftos", "adapters", "opencode-plugin.js");
  return existsSync(plugin) && existsSync(implementation);
}

const CODEX_HOOKS = new Set<HookName>(["session_start", "prompt_submit", "before_mutation", "after_mutation", "turn_stop", "context_compact", "session_end"]);
const OPENCODE_HOOKS = new Set<HookName>(["session_start", "before_mutation", "after_mutation", "turn_stop", "context_compact", "session_end"]);

function doctor(cwd: string) {
  const root = findRepoRoot(cwd);
  const result = {
    repositoryDetected: root !== null,
    skillInstalled: false,
    productDir: false,
    productReady: false,
    strategyReady: false,
    metricsReady: false,
    principlesReady: false,
    decisionSchemaValid: false,
    linterConfigValid: false,
    openCodeSkillCompatible: false,
    openCodeAdapterInstalled: false,
    codexSkillCompatible: false,
    codexAdapterInstalled: false,
    automationPreset: "not-chosen",
    hooks: [] as Array<{ hook: HookName; label: string; installed: boolean; enabled: boolean; observed: boolean }>,
    healthy: false,
  };
  if (!root) return result;

  result.skillInstalled = existsSync(path.join(root, ".agents", "skills", "siftos", "SKILL.md"));
  result.openCodeSkillCompatible = result.skillInstalled;
  result.codexSkillCompatible = result.skillInstalled;
  result.openCodeAdapterInstalled = openCodeAdapterInstalled(root);
  result.codexAdapterInstalled = codexAdapterInstalled(root);

  const repo = new ProductRepository(root);
  result.productDir = repo.initialized;
  if (!repo.initialized) return result;
  const context = repo.loadProductContext();
  result.productReady = meaningfulContext(context.product);
  result.strategyReady = meaningfulContext(context.strategy);
  result.metricsReady = meaningfulContext(context.metrics);
  result.principlesReady = meaningfulContext(context.principles);

  try {
    repo.listDecisions();
    result.decisionSchemaValid = true;
  } catch {
    result.decisionSchemaValid = false;
  }
  const config = repo.loadConfig();
  result.linterConfigValid = config !== null;
  const session = loadRuntime(root);
  const effective = resolveHooks({ repository: parseHooksFile(config), globalPreset: loadGlobalPreset(), sessionOverrides: session.hook_overrides });
  result.automationPreset = config?.hooks === undefined ? "not-chosen" : effective.preset;
  for (const name of HOOK_NAMES) {
    const installed = (result.codexAdapterInstalled && CODEX_HOOKS.has(name)) || (result.openCodeAdapterInstalled && OPENCODE_HOOKS.has(name));
    result.hooks.push({ hook: name, label: HOOK_LABELS[name], installed, enabled: effective.hooks[name].enabled, observed: session.heartbeat[name] !== undefined });
  }
  result.healthy = [
    result.repositoryDetected,
    result.skillInstalled,
    result.productDir,
    result.productReady,
    result.strategyReady,
    result.metricsReady,
    result.principlesReady,
    result.decisionSchemaValid,
    result.linterConfigValid,
    result.openCodeAdapterInstalled,
    result.codexAdapterInstalled,
  ].every(Boolean);
  return result;
}

function formatDoctor(result: ReturnType<typeof doctor>): string {
  const flag = (ok: boolean) => ok ? CHECK : CROSS;
  const lines = [
    "SiftOS Doctor",
    "",
    `Repository detected        ${flag(result.repositoryDetected)}`,
    `Skill installed            ${flag(result.skillInstalled)}`,
    `.product directory          ${flag(result.productDir)}`,
    "",
    `PRODUCT.md ready           ${flag(result.productReady)}`,
    `STRATEGY.md ready          ${flag(result.strategyReady)}`,
    `METRICS.md ready           ${flag(result.metricsReady)}`,
    `PRINCIPLES.md ready        ${flag(result.principlesReady)}`,
    "",
    `OpenCode skill             ${flag(result.openCodeSkillCompatible)}`,
    `OpenCode hook plugin       ${flag(result.openCodeAdapterInstalled)}`,
    `Codex skill                ${flag(result.codexSkillCompatible)}`,
    `Codex hook adapter         ${flag(result.codexAdapterInstalled)}`,
    "",
    `Decision schema            ${flag(result.decisionSchemaValid)}`,
    `Linter configuration       ${flag(result.linterConfigValid)}`,
    "",
    `Automation: ${result.automationPreset.toUpperCase()}`,
    "",
  ];
  for (const hook of result.hooks) {
    lines.push(`${hook.label.padEnd(16)} Installed ${flag(hook.installed)}  Enabled ${flag(hook.enabled)}  Observed ${flag(hook.observed)}`);
  }
  if (!result.productReady || !result.strategyReady || !result.metricsReady || !result.principlesReady) {
    lines.push("", "Context files that contain only placeholders such as `Unknown.` are scaffolds, not healthy product context.");
  }
  lines.push("", `Status: ${result.healthy ? "healthy" : "unhealthy"}`);
  return lines.join("\n") + "\n";
}

async function guard(argv: string[]): Promise<number> {
  const args = parseArgs(argv);
  const cwd = cwdFor(args.flags);
  let repo: ProductRepository;
  try { repo = ProductRepository.open(cwd); }
  catch (err) { console.error(`error: ${(err as Error).message}`); return 1; }
  if (!repo.initialized) { console.error("error: .product/ is not initialized (run `siftos init`)"); return 1; }

  const files = args.positionals[0] === "check" ? args.positionals.slice(1) : args.positionals;
  const levelFlag = typeof args.flags.level === "string" ? args.flags.level.toUpperCase() : null;
  const level: GuardLevel = levelFlag && ["L0", "L1", "L2", "L3", "UNKNOWN"].includes(levelFlag)
    ? levelFlag as GuardLevel
    : classifyLevelDeterministic(files);

  const config = repo.loadConfig();
  const session = loadRuntime(repo.root);
  const effective = resolveHooks({ repository: parseHooksFile(config), globalPreset: loadGlobalPreset(), sessionOverrides: session.hook_overrides });
  const hook = effective.hooks.before_mutation;
  if (!hook.enabled) {
    process.stdout.write("SIFTOS GUARD: before_mutation is disabled.\n");
    return 0;
  }

  if (!session.turn_id) session.turn_id = "manual";
  if (session.guard.intent_id !== session.turn_id) {
    session.guard = { intent_id: session.turn_id, status: "unresolved", level: null, resolution: null, block_issued: false };
  }
  session.guard.level = level;

  const resolutionRaw = typeof args.flags.resolution === "string" ? args.flags.resolution : null;
  const resolution = resolutionRaw && (GUARD_RESOLUTIONS as string[]).includes(resolutionRaw) ? resolutionRaw as GuardResolution : null;
  if (resolution) {
    session.guard.resolution = resolution;
    if (resolution === "existing_bet") {
      const decisionId = typeof args.flags.decision === "string" ? args.flags.decision : null;
      if (!decisionId) {
        console.error("error: existing_bet requires --decision=DEC-XXXX");
        saveRuntime(repo.root, session);
        return 1;
      }
      let decision;
      try { decision = repo.readDecision(decisionId); }
      catch (err) { console.error(`error: ${(err as Error).message}`); return 1; }
      if (!["accepted", "building", "shipped", "measuring"].includes(decision.status)) {
        console.error(`error: ${decisionId} is ${decision.status}; existing_bet requires an accepted+ build authorization`);
        return 1;
      }
      session.active_bet = decisionId;
      session.guard.status = "resolved";
    } else if (resolution === "prototype") {
      session.active_bet = null;
      session.guard.status = "resolved";
    } else if (resolution === "build_anyway") {
      session.active_bet = null;
      session.guard.status = "bypassed";
    } else {
      session.guard.status = "unresolved";
    }
  }

  const authorized = session.guard.intent_id === session.turn_id && ["resolved", "bypassed"].includes(session.guard.status);
  const verdict = authorized ? "ALLOW" : guardVerdict(level, hook.enforcement ?? "advisory");
  const wasBlocked = session.guard.block_issued;
  if (verdict === "BLOCK_ONCE") {
    session.guard.block_issued = true;
    session.guard.status = "unresolved";
  }
  saveRuntime(repo.root, session);

  if (authorized) {
    process.stdout.write(`SIFTOS GUARD\n\nLevel: ${level}\nVerdict: ALLOW\nResolution: ${session.guard.resolution}\n`);
    return 0;
  }
  if (verdict === "BLOCK_ONCE" && wasBlocked) {
    process.stdout.write(`SIFTOS GUARD — BLOCKED\n\nLevel: ${level}\nVerdict: BLOCK_ONCE\n\nThis product intent is still unresolved. Retrying the mutation does not bypass Product Guard.\n`);
    return 1;
  }
  process.stdout.write(guardMessage(level, verdict, files.length ? files : ["(unknown mutation)"]) + "\n");
  if (resolution && ["shape", "validate", "reconsider"].includes(resolution)) {
    process.stdout.write(`\n${resolution} selected: SiftOS-internal work may proceed, but production mutation remains gated until prototype, existing_bet, or build_anyway is recorded.\n`);
  }
  return verdict === "BLOCK_ONCE" || verdict === "REQUIRE_RESOLUTION" ? 1 : 0;
}

export async function main(argv: string[]): Promise<number> {
  const args = parseArgs(argv);
  if (args.command === "install") return install(args.flags);
  if (args.command === "doctor") {
    const result = doctor(cwdFor(args.flags));
    if (args.flags.json) process.stdout.write(JSON.stringify(result, null, 2) + "\n");
    else process.stdout.write(formatDoctor(result));
    return result.healthy ? 0 : 1;
  }
  if (args.command === "guard") return guard(argv);
  return coreMain(argv);
}

const isMain = process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) process.exit(await main(process.argv.slice(2)));
