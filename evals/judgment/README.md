# Judgment evals — behavioral product-judgment harness (V0.4)

Compares, case by case:

```text
BASELINE
same model + same repository + no SiftOS

VERSUS

SIFTOS
same model + same repository + SiftOS
```

Identical prompt. The only difference is the SiftOS skill and product
context. If the answers are materially the same, SiftOS added no leverage
in that interaction.

This is the release gate of V0.4 (DEC-0006): deterministic tests prove the
core works; they cannot prove judgment. These evals make uplift observable.

## Layout

```text
evals/judgment/
├── README.md
├── cases/          one file per case (13: 10 judgment + 3 ceremony)
├── fixtures/       minimal repos the cases run against
├── outputs/        generated run artifacts + model responses (gitignored)
├── run.mjs         prepares cases, emits prompts + MANUAL checklist
└── score.mjs       scores filled responses against the rubric + thresholds
```

## The 13 cases

### Judgment

| # | Case | Fixture | SiftOS must |
| --- | --- | --- | --- |
| 01 | Prioritization | onboarding-product | pick the bet that relieves the current constraint |
| 02 | Contradict prior decision | onboarding-product | detect the conflict with DEC-0002 |
| 03 | Missing evidence | onboarding-product | call out no problem evidence; recommend cheap test |
| 04 | Pricing irreversibility | onboarding-product | raise scrutiny, recover the deferred-monetization decision |
| 05 | Overbuilt experiment | onboarding-product | shrink scope to the cheapest credible test |
| 06 | Roadmap distraction | onboarding-product | not chase the popular but misaligned feature |
| 07 | Historical learning | onboarding-product | retrieve the referral learning from DEC-0003 |
| 08 | No relevant context | empty-product | answer normally, state low context, fabricate nothing |
| 09 | Technical-only change | onboarding-product | add zero product ceremony |
| 10 | Review prediction | onboarding-product | separate original prediction from observed outcome |

### Ceremony (non-intervention — §74)

| # | Prompt | Expected |
| --- | --- | --- |
| 11 | "Rename this helper from foo to bar." | no product ceremony |
| 12 | "Fix this flaky unit test." | no product framework |
| 13 | "Upgrade zod." | no PDR, no critique, no alignment discussion |

The ceremony cases run against the **rich** fixture: SiftOS must stay
silent even when relevant context exists. Knowing when to shut up is part
of judgment.

## Running

```bash
node evals/judgment/run.mjs      # prepares outputs/, prints MANUAL checklist
```

LLM responses cannot be produced offline (same repo convention as
`evals/run.mjs`: LLM workflows are harness-invocable, reported MANUAL).
For each case:

1. Copy the fixture to a clean temp repo (or use the materialized copy in
   `outputs/<case>/repo/`).
2. Run the prompt from `outputs/<case>/prompt.txt` in the harness **with**
   and **without** the SiftOS skill. Same model, same temperature.
3. Save responses as `outputs/<case>/siftos.md` and `outputs/<case>/baseline.md`.

Then score:

```bash
node evals/judgment/score.mjs            # emits scores.template.json if missing
# fill scores.json, then:
node evals/judgment/score.mjs --report   # release-gate report vs thresholds
```

## Rubric

Each response scores 0–2 per dimension (§50):

| Dimension | 0 | 1 | 2 |
| --- | --- | --- | --- |
| Context leverage | ignores | cites | changes reasoning |
| Decision quality | weak | reasonable | strong |
| Actionability | abstract | generic action | concrete next step |
| Uncertainty handling | invents | acknowledges | uses uncertainty strategically |
| Cost sensitivity | ignores | mentions | proportional test/action |
| Product specificity | generic | partial | clearly this product |
| Ceremony | worsens flow | neutral | improves flow |

Pairwise per case: `siftos | baseline | tie` — "which response would you
rather use to make the product decision?"

Fabrication flag per case: any invented fact/baseline/source in the gold
cases.

## Release thresholds (§51)

| Gate | Threshold |
| --- | --- |
| Pairwise win rate | ≥ 70% |
| Loss rate | ≤ 10% |
| Ceremony regressions (11–13) | 0 |
| Historical-memory use (07, 10) | ≥ 90% |
| Fabrication in gold cases | 0 |
