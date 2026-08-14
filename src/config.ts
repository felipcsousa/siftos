import { z } from "zod";

/**
 * SiftOS V2 hook configuration (PRD V2 §13–§45).
 *
 * Four states are never conflated:
 *   - Installed: adapter code exists on the platform.
 *   - Enabled:   configuration says the hook may execute.
 *   - Observed:  the runtime actually saw the hook fire (heartbeat).
 *   - Active:    installed + enabled + observed.
 *
 * Config precedence (PRD §20): session override > repository config >
 * global config > preset defaults > SiftOS defaults.
 */

export const HOOK_NAMES = [
  "session_start",
  "prompt_submit",
  "before_mutation",
  "after_mutation",
  "turn_stop",
  "context_compact",
  "subagent_start",
  "session_end",
] as const;

export type HookName = (typeof HOOK_NAMES)[number];

export type HookPreset = "off" | "advisory" | "balanced" | "strict" | "custom";
export type HookEnforcement = "off" | "advisory" | "balanced" | "strict";
export type FailurePolicy = "fail_open" | "fail_closed";

export interface HookConfig {
  enabled: boolean;
  enforcement?: HookEnforcement;
  failure_policy?: FailurePolicy;
}

/** Raw `hooks` block as it appears in `.product/config.json`. */
export interface RawHooksConfig {
  preset?: HookPreset;
  [key: string]: unknown;
}

export interface HooksConfig {
  preset: HookPreset;
  session_start: HookConfig;
  prompt_submit: HookConfig;
  before_mutation: HookConfig;
  after_mutation: HookConfig;
  turn_stop: HookConfig;
  context_compact: HookConfig;
  subagent_start: HookConfig;
  session_end: HookConfig;
}

export interface EffectiveHooks {
  /** How the effective set was derived: preset name, or custom. */
  preset: HookPreset;
  hooks: Record<HookName, HookConfig>;
}

export const HOOK_LABELS: Record<HookName, string> = {
  session_start: "Session Start",
  prompt_submit: "Prompt Submit",
  before_mutation: "Before Mutation",
  after_mutation: "After Mutation",
  turn_stop: "Turn Stop",
  context_compact: "Context Compact",
  subagent_start: "Subagent Start",
  session_end: "Session End",
};

const hookConfigSchema = z.object({
  enabled: z.boolean(),
  enforcement: z.enum(["off", "advisory", "balanced", "strict"]).optional(),
  failure_policy: z.enum(["fail_open", "fail_closed"]).optional(),
});

export const hooksConfigSchema = z
  .object({
    preset: z.enum(["off", "advisory", "balanced", "strict", "custom"]).optional(),
    session_start: hookConfigSchema.optional(),
    prompt_submit: hookConfigSchema.optional(),
    before_mutation: hookConfigSchema.optional(),
    after_mutation: hookConfigSchema.optional(),
    turn_stop: hookConfigSchema.optional(),
    context_compact: hookConfigSchema.optional(),
    subagent_start: hookConfigSchema.optional(),
    session_end: hookConfigSchema.optional(),
  })
  .passthrough();

export type ParsedHooksConfig = z.infer<typeof hooksConfigSchema>;

const DEFAULT_ENFORCEMENT: HookEnforcement = "advisory";

function hook(
  enabled: boolean,
  enforcement?: HookEnforcement,
  failure_policy?: FailurePolicy,
): HookConfig {
  const cfg: HookConfig = { enabled };
  if (enforcement !== undefined) cfg.enforcement = enforcement;
  if (failure_policy !== undefined) cfg.failure_policy = failure_policy;
  return cfg;
}

/** Enforcement per hook for each preset (PRD §17–18, §57). */
export function presetEnforcement(
  preset: Exclude<HookPreset, "custom">,
  name: HookName,
): HookConfig {
  const base = hook(true);
  if (preset === "off") return hook(false);
  switch (name) {
    case "before_mutation":
      return hook(true, preset, preset === "strict" ? "fail_closed" : undefined);
    case "turn_stop":
      return hook(true, preset === "strict" ? "strict" : "advisory");
    case "prompt_submit":
      return hook(true, "advisory");
    default:
      return base;
  }
}

/**
 * Resolves the effective hook policy (PRD §20, §159). All hooks consume
 * the effective config, never the raw file.
 */
export function resolveHooks(opts: {
  /** Raw `hooks` block from `.product/config.json`, if present. */
  repository?: ParsedHooksConfig | null;
  /** Global default preset (e.g. `~/.siftos/config.json`). */
  globalPreset?: HookPreset | null;
  /** Session overrides (`.runtime/session.json`), highest precedence. */
  sessionOverrides?: Partial<Record<HookName, Partial<HookConfig>>> | null;
}): EffectiveHooks {
  const repo = opts.repository ?? null;
  const repoPreset = repo?.preset ?? null;
  const explicitEntries = HOOK_NAMES.some(
    (n) => repo?.[n] !== undefined && typeof repo?.[n] === "object",
  );
  const chosenPreset = repoPreset ?? opts.globalPreset ?? null;

  let preset: HookPreset;
  let hooks: Record<HookName, HookConfig>;

  if (repoPreset && repoPreset !== "custom") {
    preset = repoPreset;
    hooks = Object.fromEntries(
      HOOK_NAMES.map((n) => [n, presetEnforcement(repoPreset, n)]),
    ) as Record<HookName, HookConfig>;
  } else if (repoPreset === "custom" || ((repoPreset === undefined || repoPreset === null) && explicitEntries)) {
    // Custom means the file is materialized; explicit entries win.
    // A hooks block with per-hook entries but no preset is treated as
    // custom rather than silently dropped.
    preset = "custom";
    hooks = Object.fromEntries(
      HOOK_NAMES.map((n) => {
        const raw = repo?.[n];
        if (raw && typeof raw === "object" && "enabled" in raw) {
          const h = raw as HookConfig;
          return [n, h];
        }
        return [n, hook(false)];
      }),
    ) as Record<HookName, HookConfig>;
  } else if (chosenPreset && chosenPreset !== "custom") {
    preset = chosenPreset;
    hooks = Object.fromEntries(
      HOOK_NAMES.map((n) => [n, presetEnforcement(chosenPreset, n)]),
    ) as Record<HookName, HookConfig>;
  } else {
    // No hooks configured at all (v0.2 upgrade, or hooks absent):
    // nothing is enabled until the user chooses. Manual mode is first-class.
    preset = "off";
    hooks = Object.fromEntries(HOOK_NAMES.map((n) => [n, hook(false)])) as Record<
      HookName,
      HookConfig
    >;
  }

  // Repository per-hook overrides (only meaningful for preset != custom).
  if (repo && repoPreset && repoPreset !== "custom") {
    for (const n of HOOK_NAMES) {
      const raw = repo[n];
      if (raw && typeof raw === "object" && "enabled" in raw) {
        const h = raw as HookConfig;
        hooks[n] = { ...hooks[n], ...h };
      }
    }
  }

  // Session overrides are highest precedence.
  if (opts.sessionOverrides) {
    for (const n of HOOK_NAMES) {
      const ov = opts.sessionOverrides[n];
      if (ov) hooks[n] = { ...hooks[n], ...ov };
    }
  }

  return { preset, hooks };
}

/**
 * Materializes an effective policy into a full, inspectable config file
 * body with `preset: "custom"` (PRD FR-PRESET-005: any manual hook edit
 * converts the preset to custom).
 */
export function materializeHooks(effective: EffectiveHooks): HooksConfig {
  return {
    preset: "custom",
    session_start: { ...effective.hooks.session_start },
    prompt_submit: { ...effective.hooks.prompt_submit },
    before_mutation: { ...effective.hooks.before_mutation },
    after_mutation: { ...effective.hooks.after_mutation },
    turn_stop: { ...effective.hooks.turn_stop },
    context_compact: { ...effective.hooks.context_compact },
    subagent_start: { ...effective.hooks.subagent_start },
    session_end: { ...effective.hooks.session_end },
  };
}

/** Normalizes a user-supplied hook name ("before-mutation", "before_mutation", ...). */
export function normalizeHookName(input: string): HookName | null {
  const norm = input.trim().toLowerCase().replace(/[-\s]+/g, "_");
  for (const n of HOOK_NAMES) {
    if (n === norm) return n;
  }
  return null;
}

/** Normalizes a user-supplied preset name. */
export function normalizePreset(input: string): HookPreset | null {
  const norm = input.trim().toLowerCase();
  if (norm === "off" || norm === "advisory" || norm === "balanced" || norm === "strict" || norm === "custom") {
    return norm;
  }
  return null;
}
