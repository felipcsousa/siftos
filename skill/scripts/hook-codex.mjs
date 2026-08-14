#!/usr/bin/env node
// Codex lifecycle adapter. Emits the documented JSON contracts for
// additional context, PreToolUse permission decisions, and Stop continuation.
import { readFileSync } from "node:fs";
import {
  beforeMutation,
  buildCapsule,
  clearSession,
  closeout,
  effectiveHook,
  loadRuntime,
  observe,
  productRoot,
  recordMutation,
  startTurn,
} from "./hook-lib.mjs";

const eventName = process.argv[2] ?? "";

function input() {
  try { return JSON.parse(readFileSync(0, "utf8") || "{}"); }
  catch { return {}; }
}

function output(value) {
  process.stdout.write(JSON.stringify(value) + "\n");
}

const root = productRoot();
if (!root) {
  // Hooks must not make unrelated repositories unusable.
  output({});
  process.exit(0);
}

const event = input();
const state = loadRuntime(root);
const config = effectiveHook(root, eventName, state);
if (!config?.enabled) {
  output({});
  process.exit(0);
}

try {
  switch (eventName) {
    case "session_start": {
      observe(root, state, "session_start");
      output({
        hookSpecificOutput: {
          hookEventName: "SessionStart",
          additionalContext: buildCapsule(root, loadRuntime(root)),
        },
      });
      break;
    }

    case "prompt_submit": {
      const next = startTurn(root, {
        turnId: event.turn_id ?? event.turnId ?? `turn-${Date.now()}`,
        prompt: event.prompt ?? "",
      });
      const advisory = next.candidate === "technical"
        ? ""
        : "This turn may contain a product decision. Before the first product-changing mutation, resolve SiftOS Product Guard; do not treat a retry as authorization.";
      output({
        hookSpecificOutput: {
          hookEventName: "UserPromptSubmit",
          additionalContext: advisory,
        },
      });
      break;
    }

    case "before_mutation": {
      const result = beforeMutation(root, {
        toolName: event.tool_name ?? event.toolName ?? "",
        toolInput: event.tool_input ?? event.toolInput ?? {},
      });
      if (!result.allowed) {
        output({
          hookSpecificOutput: {
            hookEventName: "PreToolUse",
            permissionDecision: "deny",
            permissionDecisionReason: result.message,
          },
        });
      } else if (result.message) {
        output({
          hookSpecificOutput: {
            hookEventName: "PreToolUse",
            additionalContext: result.message,
          },
        });
      } else {
        output({});
      }
      break;
    }

    case "after_mutation": {
      recordMutation(root, { toolInput: event.tool_input ?? event.toolInput ?? {} });
      output({});
      break;
    }

    case "turn_stop": {
      // Codex marks re-entry with stop_hook_active. Never create a Stop loop.
      if (event.stop_hook_active === true) {
        output({});
        break;
      }
      const result = closeout(root);
      if (result.continue) output({ decision: "block", reason: result.message });
      else if (result.message) output({ systemMessage: result.message });
      else output({});
      break;
    }

    case "context_compact": {
      observe(root, state, "context_compact");
      output({});
      break;
    }

    case "session_end": {
      clearSession(root);
      output({});
      break;
    }

    default:
      output({});
  }
} catch (err) {
  const failurePolicy = config.failure_policy ?? "fail_open";
  if (eventName === "before_mutation" && failurePolicy === "fail_closed") {
    output({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: `SiftOS Product Guard error (fail_closed): ${err.message}`,
      },
    });
  } else {
    // A hook failure must be visible but must not corrupt the harness protocol.
    output({ systemMessage: `SiftOS ${eventName} hook error (fail_open): ${err.message}` });
  }
}
