// OpenCode adapter for the documented plugin lifecycle.
// Native coverage: before/after tool execution, session events and compaction.
// Prompt-submit/forced Stop parity with Codex remains explicitly degraded.
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
} from "../scripts/hook-lib.mjs";

async function log(client, level, message) {
  try {
    await client?.app?.log?.({ body: { service: "siftos", level, message } });
  } catch {
    // Logging is advisory; never fail a coding session because logging changed.
  }
}

function eventSessionId(event) {
  return event?.properties?.info?.id
    ?? event?.properties?.sessionID
    ?? event?.sessionID
    ?? event?.id
    ?? `opencode-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export const SiftOSPlugin = async ({ client, directory }) => {
  const root = productRoot(directory ?? process.cwd());
  if (!root) return {};

  return {
    "tool.execute.before": async (input, output) => {
      const state = loadRuntime(root);
      if (!state.turn_id) {
        state.turn_id = `opencode-${state.session_id}`;
        state.guard.intent_id = state.turn_id;
        if (state.guard.status === "idle") state.guard.status = "unresolved";
        observe(root, state, "before_mutation");
      }
      const result = beforeMutation(root, {
        toolName: input?.tool ?? input?.toolName ?? "",
        toolInput: output?.args ?? input?.args ?? {},
      });
      if (!result.allowed) throw new Error(result.message);
      if (result.message) await log(client, "info", result.message);
    },

    "tool.execute.after": async (input, output) => {
      recordMutation(root, {
        toolName: input?.tool ?? input?.toolName ?? "",
        toolInput: input?.args ?? output?.args ?? {},
      });
    },

    "experimental.session.compacting": async (_input, output) => {
      const state = loadRuntime(root);
      if (!effectiveHook(root, "context_compact", state).enabled) return;
      observe(root, state, "context_compact");
      output.context = output.context ?? [];
      output.context.push(buildCapsule(root, loadRuntime(root)));
    },

    event: async ({ event }) => {
      const state = loadRuntime(root);
      switch (event?.type) {
        case "session.created": {
          const fresh = startSession(root, eventSessionId(event));
          if (effectiveHook(root, "session_start", fresh).enabled) {
            await log(client, "info", "SiftOS session started. Product context remains repository-native; OpenCode lifecycle coverage differs from Codex and is reported as such by siftos doctor.");
          }
          break;
        }

        case "session.idle": {
          if (!effectiveHook(root, "turn_stop", state).enabled) break;
          const result = closeout(root);
          if (result.message) {
            await log(client, result.continue ? "warn" : "info", `${result.message} OpenCode idle closeout is advisory; this adapter does not claim Codex-style forced Stop continuation.`);
          }
          clearTurn(root);
          break;
        }

        case "session.deleted":
          if (effectiveHook(root, "session_end", state).enabled) clearSession(root);
          break;

        default:
          break;
      }
    },
  };
};

export default SiftOSPlugin;
