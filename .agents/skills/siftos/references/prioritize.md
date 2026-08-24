# Prioritize — ranking bets (PRD V2 §91) — the default for "what should we build now"

## When to use

Any moment the user asks "what do we build / what's next / should we do X".
This is the cheapest enough tool: a ranking conversation, no record, no
status transition. Use it before reaching for `decide`/`shape`.

## Flow (5–10 minutes, in conversation)

1. Collect candidate bets from the user (ideas, issues, requests, debt).
2. Weigh them using the criteria below — in **plain language**, no scores.
3. Produce a ranked list, each line one verdict:

   ```text
   BUILD NOW     <bet> — <one-line reasoning + the SVT>
   DEFER         <bet> — <trigger to reopen>
   REJECT        <bet> — <reason>
   ```

4. If the user picks a BUILD NOW, that is a **conversation decision**; log
   it (one line in `.product/evidence/candidates.md` if worth remembering).
   Escalate to a full `decide` PDR only if irreversible/expensive/
   transversal — and state the ceremony cost (~30–60 min) first.

## Constraint first

Read STRATEGY.md and METRICS.md. If the current constraint is activation
(or traffic, retention...), a bet that relieves it beats an equal-upside
bet that does not — say so explicitly.

## Criteria

Weigh each candidate in plain language against:

```text
Strategic fit        Does it move the current strategic objective?
Current constraint   Does it relieve the current constraint?
Expected upside      Directional, not false precision.
Evidence strength    Existing evidence for the bet.
Cost                 Build and ongoing cost, directional.
Cost of delay        What is lost by waiting?
Reversibility        Cost of undoing it.
Learning value       What it teaches even on failure.
Dependencies         What blocks it / what it unblocks.
```

The **output is verdict + trigger, not a rank**: each line is BUILD NOW,
DEFER, or REJECT. Judgment over frameworks — no mandatory RICE/ICE score
(v0.2 §11.7). Do not rank by unweighted counts of criteria.

## Input

```text
/siftos prioritize
```

## Non-goals

Prioritize does not create a roadmap (see `roadmap.md`) and does not
decide for the human. It proposes; the human picks.
