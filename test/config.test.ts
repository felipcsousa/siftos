import { describe, expect, it } from "vitest";
import {
  HOOK_NAMES,
  hooksConfigValid,
  materializeHooks,
  normalizeHookName,
  normalizePreset,
  parseHooksConfig,
  resolveHooks,
  type ParsedHooksConfig,
} from "../src/config.js";

describe("resolveHooks: default and upgrade behavior", () => {
  it("no hooks config at all -> everything disabled", () => {
    const effective = resolveHooks({});
    expect(effective.preset).toBe("off");
    for (const name of HOOK_NAMES) expect(effective.hooks[name].enabled).toBe(false);
  });

  it("global preset applies when repository has no explicit config", () => {
    const effective = resolveHooks({ globalPreset: "advisory" });
    expect(effective.preset).toBe("advisory");
    expect(effective.hooks.before_mutation.enforcement).toBe("advisory");
  });
});

describe("hook config validation", () => {
  it("rejects per-hook entries that omit enabled", () => {
    const raw = { preset: "balanced", before_mutation: { enforcement: "strict" } };
    expect(hooksConfigValid(raw)).toBe(false);
    expect(parseHooksConfig(raw)).toBeNull();
  });

  it("accepts explicit per-hook entries with enabled", () => {
    const raw = { preset: "balanced", before_mutation: { enabled: true, enforcement: "strict" } };
    expect(hooksConfigValid(raw)).toBe(true);
    expect(parseHooksConfig(raw)?.before_mutation?.enforcement).toBe("strict");
  });
});

describe("resolveHooks: presets", () => {
  it("balanced enables everything and gives turn_stop one-continuation enforcement", () => {
    const effective = resolveHooks({ repository: { preset: "balanced" } });
    for (const name of HOOK_NAMES) expect(effective.hooks[name].enabled).toBe(true);
    expect(effective.hooks.before_mutation.enforcement).toBe("balanced");
    expect(effective.hooks.turn_stop.enforcement).toBe("balanced");
  });

  it("strict hard-gates before_mutation with fail_closed", () => {
    const effective = resolveHooks({ repository: { preset: "strict" } });
    expect(effective.hooks.before_mutation.enforcement).toBe("strict");
    expect(effective.hooks.before_mutation.failure_policy).toBe("fail_closed");
    expect(effective.hooks.turn_stop.enforcement).toBe("strict");
  });

  it("advisory never blocks", () => {
    const effective = resolveHooks({ repository: { preset: "advisory" } });
    expect(effective.hooks.before_mutation.enforcement).toBe("advisory");
    expect(effective.hooks.turn_stop.enforcement).toBe("advisory");
  });

  it("repository per-hook override layers on top of preset", () => {
    const repo: ParsedHooksConfig = { preset: "balanced", before_mutation: { enabled: false } };
    const effective = resolveHooks({ repository: repo });
    expect(effective.hooks.before_mutation.enabled).toBe(false);
    expect(effective.hooks.session_start.enabled).toBe(true);
  });

  it("per-hook entries without preset are custom", () => {
    const repo: ParsedHooksConfig = { before_mutation: { enabled: true, enforcement: "balanced" } };
    const effective = resolveHooks({ repository: repo });
    expect(effective.preset).toBe("custom");
    expect(effective.hooks.before_mutation.enabled).toBe(true);
    expect(effective.hooks.session_start.enabled).toBe(false);
  });

  it("custom missing entries stay off", () => {
    const repo: ParsedHooksConfig = { preset: "custom", before_mutation: { enabled: true, enforcement: "balanced" } };
    const effective = resolveHooks({ repository: repo });
    expect(effective.hooks.before_mutation.enabled).toBe(true);
    expect(effective.hooks.session_start.enabled).toBe(false);
  });
});

describe("session override precedence", () => {
  it("session override wins over repository preset", () => {
    const effective = resolveHooks({ repository: { preset: "balanced" }, sessionOverrides: { before_mutation: { enabled: false } } });
    expect(effective.hooks.before_mutation.enabled).toBe(false);
    expect(effective.hooks.session_start.enabled).toBe(true);
  });
});

describe("materializeHooks", () => {
  it("produces full custom config preserving each hook", () => {
    const materialized = materializeHooks(resolveHooks({ repository: { preset: "balanced" } }));
    expect(materialized.preset).toBe("custom");
    expect(materialized.before_mutation.enforcement).toBe("balanced");
    expect(materialized.turn_stop.enforcement).toBe("balanced");
  });
});

describe("normalization", () => {
  it("normalizes hook names", () => {
    expect(normalizeHookName("before-mutation")).toBe("before_mutation");
    expect(normalizeHookName("prompt-submit")).toBe("prompt_submit");
    expect(normalizeHookName("nope")).toBeNull();
  });

  it("normalizes presets", () => {
    expect(normalizePreset("BALANCED")).toBe("balanced");
    expect(normalizePreset("custom")).toBe("custom");
    expect(normalizePreset("loud")).toBeNull();
  });
});
