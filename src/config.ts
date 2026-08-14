import { z } from "zod";

/** SiftOS V2 hook configuration. Disabled means disabled. */
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

/** Invalid repository hook config must never silently become active. */
export function parseHooksConfig(raw: unknown): ParsedHooksConfig | null {
  if (raw === undefined || raw === null) return null;
  const parsed = hooksConfigSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export function hooksConfigValid(raw: unknown): boolean {
  return raw === undefined || hooksConfigSchema.safeParse(raw).success;
}

function hook(enabled: boolean, enforcement?: HookEnforcement, failure_policy?: FailurePolicy): HookConfig {
  const value: HookConfig = { enabled };
  if (enforcement !== undefined) value.enforcement = enforcement;
  if (failure_policy !== undefined) value.failure_policy = failure_policy;
  return value;
}

/** Preset semantics. Balanced includes one Stop closeout continuation. */
export function presetEnforcement(
  preset: Exclude<HookPreset, "custom">,
  name: HookName,
): HookConfig {
  if (preset === "off") return hook(false);
  switch (name) {
    case "before_mutation":
      return hook(true, preset, preset === "strict" ? "fail_closed" : "fail_open");
    case "turn_stop":
      return hook(true, preset, "fail_open");
    case "prompt_submit":
      return hook(true, "advisory", "fail_open");
    default:
      return hook(true, undefined, "fail_open");
  }
}

export function resolveHooks(opts: {
  repository?: ParsedHooksConfig | null;
  globalPreset?: HookPreset | null;
  sessionOverrides?: Partial<Record<HookName, Partial<HookConfig>>> | null;
}): EffectiveHooks {
  const repo = opts.repository ?? null;
  const repoPreset = repo?.preset ?? null;
  const explicitEntries = HOOK_NAMES.some((name) => repo?.[name] !== undefined);
  const chosenPreset = repoPreset ?? opts.globalPreset ?? null;

  let preset: HookPreset;
  let hooks: Record<HookName, HookConfig>;

  if (repoPreset && repoPreset !== "custom") {
    preset = repoPreset;
    hooks = Object.fromEntries(
      HOOK_NAMES.map((name) => [name, presetEnforcement(repoPreset, name)]),
    ) as Record<HookName, HookConfig>;
  } else if (repoPreset === "custom" || (!repoPreset && explicitEntries)) {
    preset = "custom";
    hooks = Object.fromEntries(
      HOOK_NAMES.map((name) => [name, repo?.[name] ? { ...(repo[name] as HookConfig) } : hook(false)]),
    ) as Record<HookName, HookConfig>;
  } else if (chosenPreset && chosenPreset !== "custom") {
    preset = chosenPreset;
    hooks = Object.fromEntries(
      HOOK_NAMES.map((name) => [name, presetEnforcement(chosenPreset, name)]),
    ) as Record<HookName, HookConfig>;
  } else {
    preset = "off";
    hooks = Object.fromEntries(HOOK_NAMES.map((name) => [name, hook(false)])) as Record<HookName, HookConfig>;
  }

  if (repo && repoPreset && repoPreset !== "custom") {
    for (const name of HOOK_NAMES) {
      const override = repo[name];
      if (override) hooks[name] = { ...hooks[name], ...(override as HookConfig) };
    }
  }

  if (opts.sessionOverrides) {
    for (const name of HOOK_NAMES) {
      const override = opts.sessionOverrides[name];
      if (override) hooks[name] = { ...hooks[name], ...override };
    }
  }

  return { preset, hooks };
}

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

export function normalizeHookName(input: string): HookName | null {
  const normalized = input.trim().toLowerCase().replace(/[-\s]+/g, "_");
  return HOOK_NAMES.find((name) => name === normalized) ?? null;
}

export function normalizePreset(input: string): HookPreset | null {
  const normalized = input.trim().toLowerCase();
  return ["off", "advisory", "balanced", "strict", "custom"].includes(normalized)
    ? (normalized as HookPreset)
    : null;
}
