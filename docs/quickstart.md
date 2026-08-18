# First bet in 10 minutes

SiftOS turns product decisions into records you can revisit and learn from.
This guide walks you from zero to a validated bet — the same path used for
`DEC-0001` in this repository.

## 1. Install (1 min)

```bash
npx @felipcsousa/siftos install
```

Installs the canonical skill into `.agents/skills/siftos/` (shared by OpenCode
and Codex). Automatic hooks stay **OFF** — SiftOS never intervenes until you
opt in:

```bash
siftos hooks set balanced   # advisory | balanced | strict | off
```

## 2. Init (2 min)

```bash
siftos init
```

Creates `.product/` with `PRODUCT.md`, `STRATEGY.md`, `METRICS.md`,
`PRINCIPLES.md`, `ROADMAP.md`, `config.json`, `decisions/` and `evidence/`.

Fill the four context files with your agent:

```text
Initialize SiftOS for this product.
```

Rules of the road:

- **Unknown is a valid answer.** Never invent data, baselines or sources.
- **Facts ≠ hypotheses.** Keep Facts, Evidence, Inferences, Assumptions and
  Unknowns in their own sections.
- Verify with `siftos doctor` — a scaffold full of `Unknown.` is a valid
  scaffold but not yet healthy product context.

## 3. Shape a bet (3 min)

Ask your agent:

```text
/siftos shape we want to launch in our communities and prove the loop
```

The agent structures: Context, Goal, Target User, Hypothesis, Facts, Evidence,
Assumptions, Unknowns, Options, Alternatives Rejected, **SVT** (the smallest
credible test), Scope, Non-Goals, Expected Outcome, Guardrails, Revisit
Condition. Missing information stays `Unknown.`

A bet without an SVT cannot leave `shaping` — the SVT is the smallest credible
intervention that materially reduces the most important uncertainty.

## 4. Validate it (2 min)

```text
/siftos validate DEC-XXXX
```

Creates the Validation Contract **before results exist**: Critical assumption,
Test, Population, Signal, Pass, Strong pass, Fail, Inconclusive, Sample,
If pass, If fail. Thresholds are defined up front — defining them after seeing
the result is the anti-pattern.

## 5. Challenge it (2 min)

```text
/siftos challenge DEC-XXXX
```

Adversarial review. Challenge never modifies the record; it surfaces the
strongest case against, the cheapest next step, and the evidence most likely
to reduce uncertainty. Apply what survives.

## 6. Run the loop

- Ship Gate when the bet is accepted: `siftos ship DEC-XXXX`
- Compare prediction with outcome: `/siftos review DEC-XXXX`
- Health checks anytime: `siftos audit`, `siftos doctor`

```text
Decision → Prediction → Outcome → Learning ↺
```

The human owns every decision. AI analyzes, recommends and contests — it never
decides for you.
