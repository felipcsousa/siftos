# Decision Schema — Product Decision Record (PDR)

A PDR is one file: `.product/decisions/DEC-XXXX-slug.md`. The ID is
permanent and monotonic (never reuse a removed ID). Files are Markdown
with YAML-style frontmatter and a structured body.

## Frontmatter

```yaml
---
id: DEC-0042
title: Remove mandatory credit card from trial
status: accepted

created_at: 2026-08-13
updated_at: 2026-08-13

owner: joao

tags:
  - onboarding
  - activation
  - trial

goal: improve-activation

bet_class: offense

confidence: medium

reversibility: high
cost_of_delay: medium

review_date: 2026-09-13

supersedes: null
superseded_by: null

agent_workflow_version: decide-v1
---
```

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `DEC-\d{4}` | permanent, monotonic |
| `title` | string | required |
| `status` | enum | see lifecycle |
| `created_at` / `updated_at` | `YYYY-MM-DD` | required; updated_at refreshed on every save |
| `owner` | string | optional |
| `tags` | list | optional |
| `goal` | string | link to strategy/goal; required for accepted+ |
| `bet_class` | `offense`/`defense`/`neither` | strategic classification of the bet (adapted from Reforge — https://www.reforge.com/blog/product-strategy-framework-offense-vs-defense) |
| `confidence` | `low`/`medium`/`high` | optional |
| `reversibility` | `high`/`medium`/`low` | optional |
| `cost_of_delay` | `low`/`medium`/`high`/`unknown` | optional |
| `review_date` | `YYYY-MM-DD` | optional, date-based revisit |
| `supersedes` / `superseded_by` | `DEC-\d{4}` or `null` | supersession links |
| `agent_workflow_version` | string | e.g. `decide-v1`, enables historical evals |

## Body

```text
# Decision
## Context
## Goal
## Facts
## Evidence
## Inferences
## Assumptions
## Unknowns
## Options Considered
## Alternatives Rejected
## AI Recommendation
## Final Human Decision
## Rationale
## Strongest Argument Against
## Expected Outcome
## Primary Metric
## Guardrails
## Reversibility
## Cost of Delay
## What Would Change Our Mind
## Revisit Condition

# Outcome
## Observed Result
## Prediction Accuracy
## Unexpected Effects
## Assumptions Confirmed
## Assumptions Invalidated
## Decision Assessment
## Learnings
## Follow-up Decisions
```

Canonical serialization rules:

- Each section is a `##` heading with `- ` bullet items.
- A section without content serializes as `Unknown.` (and parses back as
  empty — linters treat it as "no information").
- Unknown extra sections are preserved (forward compatibility).
- Facts/Evidence/Inferences/Assumptions/Unknowns hold one statement per
  bullet. Facts and Assumptions must never duplicate the same statement.
- `Alternatives Rejected` records options considered and rejected, with
  the reason for each (adapted from Reforge's Decision FAQ —
  https://www.reforge.com/blog/how-to-write-product-specs):

```text
- B. Make card optional — rejected: adds complexity without testing the core question.
```
- Evidence uses the provenance format:

```text
- Claim: 38% abandonment on payment step | Source: Amplitude dashboard | Date: 2026-08-10
- Claim: cardless trials keep conversion | Source: Reforge blog | Source URL: https://www.reforge.com/blog/... | Date: 2026-07 | Access: public
```

`Source: unspecified` is valid; `Source URL` is recommended for external
claims; `Access: public|gated` marks whether the source is publicly
verifiable. Never invent a source or a date. Never cite gated content
(`Access: gated` triggers the `gated-evidence` linter).

## Status lifecycle

```text
draft → proposed → accepted → shipped → reviewed
proposed → rejected
accepted → cancelled | superseded
shipped → superseded
```

| Status | Meaning |
| --- | --- |
| `draft` | incomplete record |
| `proposed` | analysis ready, human decision pending |
| `accepted` | human decision confirmed |
| `shipped` | decision operationalized |
| `reviewed` | outcome analyzed |
| `rejected` | proposal deliberately rejected |
| `cancelled` | accepted decision no longer executed |
| `superseded` | replaced by another decision |

A superseded decision keeps its original rationale — never rewrite the
record to match the replacement (adapted from Reforge —
https://www.reforge.com/blog/evolving-product-requirement-documents).

## Validation protocol

1. Validate the structured object.
2. Repair once (trim strings, coerce enum casing, split tag strings).
3. Revalidate.
4. On continued failure, fail explicitly. Never persist a partially
   corrupted document.

Deterministic checks (IDs, parsing, serialization, schema validation,
status transitions, linting, search, date checks, audit, discovery) must
never depend on the model. The model handles interpretation, analysis,
inference, alternatives, adversarial reasoning, recommendation and
learning extraction.
