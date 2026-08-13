# Evidence Rules

## Fact / Evidence / Inference / Assumption

- **Fact** — information treated as directly observed or established in
  the available context.
- **Evidence** — an observation that supports or contradicts a
  hypothesis.
- **Inference** — a conclusion derived from evidence.
- **Assumption** — a proposition the reasoning requires that has not yet
  been established.

```text
FACT
38% dos usuários abandonaram o onboarding
na etapa de pagamento.

INFERENCE
A etapa de pagamento provavelmente representa
fricção relevante.

ASSUMPTION
Remover cartão aumentará activation sem reduzir
substancialmente qualidade dos trials.
```

These categories are never semantically equivalent (PRD §11.2). An
assumption filed as a Fact is a category error (`assumption-as-fact`,
ERROR).

## Provenance

Evidence records claim, source and date:

```text
- Claim: 38% abandonment on payment step | Source: Amplitude dashboard | Date: 2026-08-10
- Claim: 17/24 interviewed users mentioned concerns about automatic charging | Source: July onboarding research | Date: 2026-07
```

External claims (articles, frameworks, benchmarks) add a URL and access
level:

```text
- Claim: cardless trials keep conversion | Source: Reforge blog | Source URL: https://www.reforge.com/blog/good-experiment-bad-experiment | Date: 2026-07 | Access: public
```

Rules:

- `Source: unspecified` is valid; inventing a source is prohibited.
- `Source URL` is required for any external claim; the linter
  `gated-evidence` flags `Access: gated` — never cite content behind a
  paywall.
- Ideas and frameworks may be adopted, but always paraphrased and
  attributed by URL; never copy wording or diagrams verbatim.
- Absence of a date is allowed.

## Recency (default heuristic)

```text
< 90 days        recent
90–365 days      potentially stale
> 365 days       stale
```

Defaults only — context can justify older evidence. Stale evidence is
surfaced by the `stale-evidence` linter.

## Unknowns

`Unknown.` is a valid answer (PRD §11.1). Absence of evidence is never
converted into narrative confidence. Never fill gaps by inventing data —
baselines, metrics, sources or outcomes.
