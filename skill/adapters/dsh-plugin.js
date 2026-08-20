// DeepSeek Harness (dsh) Cordis plugin adapter for the documented plugin
// lifecycle. Native coverage: before/after tool execution, session events,
// compaction preservation (`agent/session-start` source `compact`),
// prompt-submit intent (`agent/pre-step`) and one closeout continuation
// (`agent/turn-stopping` + `agent.steer`).
//
// Contracts verified against deepseek-ai/deepseek-harness:
//   - `agent/session-start` emit      { agent, source }      (SessionStartSource: startup|resume|clear|compact)
//   - `agent/pre-step`     waterfall  ({ agent, messages, turn, step, signal }, next) -> PreStepDecision
//   - `tools/pre-execute`  waterfall  (exec, next)           -> PreToolDecision { allow } | { deny, reason } | { ask }
//   - `tools/result`       emit       (exec, result)
//   - `agent/turn-stopping` serial    ({ agent, turn, signal })
//   - `agent/disposed`     emit       ({ agent })
//   - `agent.inject(message)` / `agent.steer(message)` accept a UserMessage:
//     { id, role: 'user', content: [{ type: 'text', text }], source: { kind: 'plugin', plugin } }
import { randomUUID } from "node:crypto";
import {
  beforeMutation,
  buildCapsule,
  clearSession,
  clearTurn,
  closeout,
  effectiveHook,
  loadRuntime,
  observe,
  productRoot,
  recordMutation,
  startSession,
  startTurn,
} from "../scripts/hook-lib.mjs";

export const name = "siftos";
export const inject = ["tools"]; // wait until the tool pipeline exists

let ctxRef = null;

function log(level, message) {
  try {
    ctxRef?.logger?.[level]?.(`[siftos] ${message}`);
  } catch {
    // Logging is advisory; never fail a coding session because logging changed.
  }
}

/**
 * Product repo owning the agent/execution, or null outside a SiftOS product
 * repo. Prefers the live session's recorded cwd; falls back to process.cwd().
 */
export function rootOf(agentOrExec) {
  const cwd =
    agentOrExec?.session?.header?.cwd ??
    agentOrExec?.agent?.session?.header?.cwd ??
    process.cwd();
  return productRoot(cwd);
}

// dsh's own producers build UserMessages with `createUserMessage` from
// `@deepseek-ai/dsh-llm` (identity + freeze). The factory is available
// in-process when dsh loads this plugin; unit tests mock inject/steer and
// never load dsh packages, so fall back to the structurally identical plain
// object there.
//
// The factory import resolves asynchronously, but `agent/session-start` is a
// fire-and-forget emit that never awaits listeners: the capsule must be built
// synchronously or it can miss the first pre-step batch. toUserMessage is
// therefore sync — it uses the plain object until the branded factory has
// resolved, then upgrades (both shapes are valid UserMessages).
function plainUserMessage(text) {
  return {
    id: randomUUID(),
    role: "user",
    content: [{ type: "text", text }],
    source: { kind: "plugin", plugin: "siftos" },
  };
}
let userMessageFactory = null;
let factoryPromise = null;
function messageFactory() {
  if (userMessageFactory !== null) return userMessageFactory;
  if (factoryPromise === null) {
    factoryPromise = import("@deepseek-ai/dsh-llm")
      .then((llm) => {
        userMessageFactory = (text) => llm.createUserMessage({
          content: [{ type: "text", text }],
          source: { kind: "plugin", plugin: "siftos" },
        });
        return userMessageFactory;
      })
      .catch(() => {
        userMessageFactory = plainUserMessage;
        return userMessageFactory;
      });
  }
  return userMessageFactory ?? plainUserMessage;
}

/** Build a user-role message dsh accepts for inject/steer (synchronous). */
export function toUserMessage(text) {
  return messageFactory()(String(text ?? ""));
}

/** Extract the plain prompt text from the `agent/pre-step` message batch. */
export function extractPromptText(messages) {
  const parts = [];
  for (const message of Array.isArray(messages) ? messages : [messages]) {
    if (typeof message === "string") { parts.push(message); continue; }
    if (!message || typeof message !== "object") continue;
    const content = message.content;
    if (typeof content === "string") parts.push(content);
    else if (Array.isArray(content)) {
      for (const block of content) {
        if (typeof block === "string") parts.push(block);
        else if (block && typeof block === "object" && typeof block.text === "string") parts.push(block.text);
      }
    }
  }
  return parts.join("\n").trim();
}

export function onSessionStart({ agent, source } = {}) {
  try {
    const root = rootOf(agent);
    if (!root) return;
    if (source !== "compact") {
      // Fresh lifecycle (startup/resume/clear) gets a fresh runtime scope.
      // `compact` is mid-session: resetting would wipe the live Guard
      // resolution, mutation footprint and continuation cap (PreCompact
      // parity means PRESERVE state, like Codex).
      startSession(root, String(agent?.id ?? "unknown"));
    }
    const state = loadRuntime(root);
    if (effectiveHook(root, "session_start", state).enabled) {
      // Sync on purpose: emit never awaits listeners, so an async capsule
      // could miss the first pre-step batch.
      agent?.inject?.(toUserMessage(buildCapsule(root, loadRuntime(root))));
    }
    if (source === "compact" && effectiveHook(root, "context_compact", state).enabled) {
      observe(root, loadRuntime(root), "context_compact");
      agent?.inject?.(toUserMessage(buildCapsule(root, loadRuntime(root))));
    }
  } catch (error) {
    log("warn", `session_start handler failed: ${error?.message ?? error}`);
  }
}

export async function onPreStep({ agent, messages, turn } = {}, next) {
  try {
    const root = rootOf(agent);
    if (root) {
      startTurn(root, {
        turnId: `dsh-${String(agent?.id ?? "?")}-t${turn ?? 0}`,
        prompt: extractPromptText(messages),
      });
    }
  } catch (error) {
    log("warn", `prompt_submit handler failed: ${error?.message ?? error}`);
  }
  // Guard is tool-level only; never reject or rewrite a proposed step.
  if (typeof next === "function") return next();
  return { kind: "enter", messages: messages ?? [] };
}

export async function onPreExecute(exec = {}, next) {
  const root = rootOf(exec);
  if (!root) return typeof next === "function" ? next() : { kind: "allow" };
  try {
    const state = loadRuntime(root);
    if (!state.turn_id) {
      // No 1:1 prompt_submit observed yet (e.g. session resumed mid-turn).
      // Scope the unresolved intent to this concrete dsh session.
      state.turn_id = `dsh-${exec?.agent?.id ?? "session"}`;
      state.guard.intent_id = state.turn_id;
      if (state.guard.status === "idle") state.guard.status = "unresolved";
      observe(root, state, "before_mutation");
    }
    const result = beforeMutation(root, {
      toolName: exec?.name ?? "",
      toolInput: exec?.arguments ?? {},
    });
    if (!result.allowed) {
      return { kind: "deny", reason: result.message };
    }
    if (result.message) log("info", result.message);
    return typeof next === "function" ? next() : { kind: "allow" };
  } catch (error) {
    const message = error?.message ?? String(error);
    if (effectiveHook(root, "before_mutation", loadRuntime(root)).failure_policy === "fail_closed") {
      return { kind: "deny", reason: `SiftOS Product Guard failure: ${message}` };
    }
    log("warn", `before_mutation failed open: ${message}`);
    return typeof next === "function" ? next() : { kind: "allow" };
  }
}

export function onResult(exec = {}) {
  try {
    const root = rootOf(exec);
    if (!root) return;
    recordMutation(root, {
      toolName: exec?.name ?? "",
      toolInput: exec?.arguments ?? {},
    });
  } catch (error) {
    log("warn", `after_mutation handler failed: ${error?.message ?? error}`);
  }
}

export function onTurnStopping({ agent } = {}) {
  try {
    const root = rootOf(agent);
    if (!root) return;
    if (!effectiveHook(root, "turn_stop").enabled) return;
    const result = closeout(root);
    if (result.continue && result.message && typeof agent?.steer === "function") {
      try {
        agent.steer(toUserMessage(result.message));
        // Steered: the turn stays alive. Keep runtime state (continuation
        // cap + guard resolution) for the continuation step; the next stop
        // boundary of the same turn cannot request a second continuation.
        return;
      } catch (error) {
        log("warn", `closeout steer failed: ${error?.message ?? error}`);
      }
    }
    if (result.message) {
      // Advisory closeout feedback: inform without forcing a continuation.
      try { agent?.inject?.(toUserMessage(result.message)); } catch (error) { log("warn", `closeout inject failed: ${error?.message ?? error}`); }
    }
    clearTurn(root);
  } catch (error) {
    log("warn", `turn_stop handler failed: ${error?.message ?? error}`);
  }
}

export function onDisposed({ agent } = {}) {
  try {
    const root = rootOf(agent);
    if (!root) return;
    if (effectiveHook(root, "session_end").enabled) clearSession(root);
  } catch (error) {
    log("warn", `session_end handler failed: ${error?.message ?? error}`);
  }
}

export function apply(ctx) {
  ctxRef = ctx;
  messageFactory(); // start the branded-factory import early; sync fallback until it resolves
  ctx.on("agent/session-start", (payload) => onSessionStart(payload));
  ctx.on("agent/pre-step", (payload, next) => onPreStep(payload, next));
  ctx.on("tools/pre-execute", (exec, next) => onPreExecute(exec, next));
  ctx.on("tools/result", (exec, result) => onResult(exec, result));
  ctx.on("agent/turn-stopping", (payload) => onTurnStopping(payload));
  ctx.on("agent/disposed", (payload) => onDisposed(payload));
}
