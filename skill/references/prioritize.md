# Prioritize — ranking bets (V0.4) — the default for "what should we do"

The cheapest enough tool: a ranking conversation, no score, no record, no
state transition. The default for any moment the user asks "what do we
build / what's next / should we do X".

## Flow (5–10 minutes, in conversation)

1. Collect candidate bets from the user (ideas, issues, requests, debt).
2. Weigh them in plain language against the current constraint.
3. Produce a ranked list, each entry one verdict:

   ```text
   BUILD NOW
   <bet> — <reasoning + cheapest useful move>

   DEFER
   <bet> — <trigger to reopen>

   REJECT
   <bet> — <reason>
   ```

4. The human picks. Only an **effective human choice** can become memory —
   never auto-log candidates during exploration.

Escalate to a full `decide` PDR only if the picked bet is
irreversible/expensive/transversal — and state the ceremony cost
(~30–60 min) before proposing it. Compact product memory is the default
home for durable choices when it exists.

## BUILD NOW always answers "why not the obvious alternative?"

For every BUILD NOW, name the strongest candidate you rejected and why the
chosen bet beats it. If the alternative is close, say so:

```text
BUILD NOW
Improve activation instrumentation
— Current constraint is activation and we cannot reliably evaluate the
onboarding bets without a baseline.
— Cheapest useful move: instrument trial_started → activated.

DEFER
Referral loop
— Reopen when activation baseline is stable.

REJECT
Dashboard redesign
— No evidence it relieves the current constraint.
```

## Zero BUILD NOW is a valid answer

If no candidate has enough evidence or leverage:

```text
BUILD NOW
Nothing yet.

TEST FIRST
<cheapest credible test that would create a BUILD NOW>
```

This prevents feature-factory bias: not every list needs a winner.

## Constraint first

Read STRATEGY.md and METRICS.md. If the current constraint is activation
(or traffic, retention...), a bet that relieves it beats an equal-upside
bet that does not — say so explicitly. If no context exists, state the
assumption and the confidence level instead of blocking.

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

**The output is verdict + trigger, not a rank.** Judgment over frameworks —
no mandatory RICE/ICE score. Do not rank by unweighted counts of criteria.

## Input

Natural language: "what should we do this week?", "prioritize my backlog."


## Non-goals

Prioritize does not create a roadmap and does not decide for the human. It
proposes; the human picks. It never records candidates automatically.
