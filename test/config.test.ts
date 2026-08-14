import { describe, expect, it } from "vitest";
import {
  HOOK_NAMES,
  materializeHooks,
  normalizeHookName,
  normalizePreset,
  resolveHooks,
  type ParsedHooksConfig,
} from "../src/config.js";

describe("resolveHooks: default and upgrade behavior", () => {
  it("no hooks config at all -> everything disabled (manual first-class)", () => {
    const e = resolveHooks({});
    expect(e.preset).toBe("off");
    for (const n of HOOK_NAMES) expect(e.hooks[n].enabled).toBe(false);
  });

  it("v0.2 config (no hooks block) resolves to off", () => {
    const e = resolveHooks({ repository: null });
    expect(e.preset).toBe("off");
    expect(e.hooks.before_mutation.enabled).toBe(false);
  });

  it("global preset applies when the repository has no explicit config", () => {
    const e = resolveHooks({ globalPreset: "advisory" });
    expect(e.preset).toBe("advisory");
    expect(e.hooks.before_mutation.enabled).toBe(true);
    expect(e.hooks.before_mutation.enforcement).toBe("advisory");
  });
});

describe("resolveHooks: presets", () => {
  it("balanced enables everything, gates before_mutation, advises turn_stop", () => {
    const e = resolveHooks({ repository: { preset: "balanced" } });
    expect(e.preset).toBe("balanced");
    for (const n of HOOK_NAMES) expect(e.hooks[n].enabled).toBe(true);
    expect(e.hooks.before_mutation.enforcement).toBe("balanced");
    expect(e.hooks.turn_stop.enforcement).toBe("advisory");
  });

  it("strict hard-gates before_mutation with fail_closed", () => {
    const e = resolveHooks({ repository: { preset: "strict" } });
    expect(e.hooks.before_mutation.enforcement).toBe("strict");
    expect(e.hooks.before_mutation.failure_policy).toBe("fail_closed");
    expect(e.hooks.turn_stop.enforcement).toBe("strict");
  });

  it("advisory never blocks: before_mutation enforcement is advisory", () => {
    const e = resolveHooks({ repository: { preset: "advisory" } });
    expect(e.hooks.before_mutation.enforcement).toBe("advisory");
  });

  it("repository per-hook override layers on top of the preset", () => {
    const repo: ParsedHooksConfig = {
      preset: "balanced",
      before_mutation: { enabled: false },
    };
    const e = resolveHooks({ repository: repo });
    expect(e.preset).toBe("balanced");
    expect(e.hooks.before_mutation.enabled).toBe(false);
    expect(e.hooks.session_start.enabled).toBe(true);
  });

  it("per-hook entries without a preset are treated as custom, not dropped", () => {
    const repo: ParsedHooksConfig = {
      before_mutation: { enabled: true, enforcement: "balanced" },
    };
    const e = resolveHooks({ repository: repo });
    expect(e.preset).toBe("custom");
    expect(e.hooks.before_mutation.enabled).toBe(true);
    expect(e.hooks.before_mutation.enforcement).toBe("balanced");
    expect(e.hooks.session_start.enabled).toBe(false);
  });

  it("custom preset uses the materialized entries; missing ones stay off", () => {
    const repo: ParsedHooksConfig = {
      preset: "custom",
      before_mutation: { enabled: true, enforcement: "balanced" },
    };
    const e = resolveHooks({ repository: repo });
    expect(e.preset).toBe("custom");
    expect(e.hooks.before_mutation.enabled).toBe(true);
    expect(e.hooks.session_start.enabled).toBe(false);
  });
});

describe("resolveHooks: session override precedence", () => {
  it("session override wins over repository preset", () => {
    const e = resolveHooks({
      repository: { preset: "balanced" },
      sessionOverrides: { before_mutation: { enabled: false } },
    });
    expect(e.hooks.before_mutation.enabled).toBe(false);
    expect(e.hooks.session_start.enabled).toBe(true);
  });

  it("session hooks-off disables everything while repository stays balanced", () => {
    const sessionOverrides = Object.fromEntries(HOOK_NAMES.map((n) => [n, { enabled: false }]));
    const e = resolveHooks({ repository: { preset: "balanced" }, sessionOverrides });
    for (const n of HOOK_NAMES) expect(e.hooks[n].enabled).toBe(false);
    expect(e.preset).toBe("balanced");
  });
});

describe("materializeHooks", () => {
  it("produces a full custom config preserving each hook", () => {
    const e = resolveHooks({ repository: { preset: "balanced" } });
    const m = materializeHooks(e);
    expect(m.preset).toBe("custom");
    expect(m.before_mutation.enabled).toBe(true);
    expect(m.before_mutation.enforcement).toBe("balanced");
    expect(m.turn_stop.enforcement).toBe("advisory");
  });
});

describe("normalization", () => {
  it("normalizes hook names from user input", () => {
    expect(normalizeHookName("before-mutation")).toBe("before_mutation");
    expect(normalizeHookName("before_mutation")).toBe("before_mutation");
    expect(normalizeHookName("prompt-submit")).toBe("prompt_submit");
    expect(normalizeHookName("session_start")).toBe("session_start");
    expect(normalizeHookName("nope")).toBeNull();
  });

  it("normalizes presets", () => {
    expect(normalizePreset("BALANCED")).toBe("balanced");
    expect(normalizePreset("off")).toBe("off");
    expect(normalizePreset("custom")).toBe("custom");
    expect(normalizePreset("loud")).toBeNull();
  });
});
