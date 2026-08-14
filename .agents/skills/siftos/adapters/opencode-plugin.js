// OpenCode adapter for the documented plugin lifecycle.
// OpenCode currently provides native before/after tool hooks, session events,
// and compaction context injection. It does not expose documented 1:1
// equivalents for Codex UserPromptSubmit or Stop continuation, so those
// capabilities degrade explicitly instead of being advertised as parity.
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
} from "../scripts/hook-lib.mjs";

async function log(client, level, message) {
  try {
    await client?.app?.log?.({
      body: { service: "siftos", level, message },
    });
  } catch {
    // Logging is advisory; never fail a coding session because the log API changed.
  }
}

export const SiftOSPlugin = async ({ client, directory }) => {
  const root = productRoot(directory ?? process.cwd());
  if (!root) return {};

  return {
    "tool.execute.before": async (input, output) => {
      const state = loadRuntime(root);
      if (!state.turn_id) {
        // OpenCode does not currently expose a documented UserPromptSubmit
        // hook. Scope authorization to the current session/idle cycle rather
        // than pretending prompt parity exists.
        state.turn_id = `opencode-${state.session_id}`;
        state.guard.intent_id = state.turn_id;
        state.guard.status = state.guard.status === "idle" ? "unresolved" : state.guard.status;
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
      recordMutation(root, { toolInput: input?.args ?? output?.args ?? {} });
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
        case "session.created":
          if (effectiveHook(root, "session_start", state).enabled) {
            observe(root, state, "session_start");
            await log(client, "info", "SiftOS session context is available through the repository skill; OpenCode has no documented SessionStart context-return contract equivalent to Codex.");
          }
          break;

        case "session.idle": {
          if (!effectiveHook(root, "turn_stop", state).enabled) break;
          const result = closeout(root);
          if (result.message) {
            await log(client, result.continue ? "warn" : "info", `${result.message} OpenCode has no documented Stop-style continuation contract, so this closeout is advisory.`);
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
