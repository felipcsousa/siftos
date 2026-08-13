#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { auditDecisions, formatAudit } from "./audit.js";
import { formatCompiledContext, compileContext } from "./context.js";
import { lintDecision } from "./linters.js";
import { parseDecision, ParseError } from "./parser.js";
import { ProductRepository, findRepoRoot, PRODUCT_DIR } from "./repo.js";
import { validateDecisionObject } from "./validator.js";
import { searchDecisions } from "./search.js";
import { decisionSchema } from "./schema.js";
import type { LintFinding } from "./types.js";

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
  console.log("Next:");
  console.log("Ask your agent to initialize SiftOS.");
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
  return result;
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
  const healthy = Object.values(result).every(Boolean);
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

  for (const file of repo.decisionFileNames()) {
    const id = file.match(/^(DEC-\d{4})/)?.[1] ?? file;
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
  const repo = openRepo(args.flags);
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
  const repo = openRepo(args.flags);
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
  const repo = openRepo(args.flags);
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
      process.stdout.write(repo.nextId() + "\n");
      return 0;
    }
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
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const exitCode = await main(process.argv.slice(2));
  process.exit(exitCode);
}

// TEMP PROBE
console.log("probe dirname:", path.dirname(fileURLToPath(import.meta.url)));
console.log("probe isMain:", process.argv[1], path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url));
