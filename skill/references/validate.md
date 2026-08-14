# Validate — Validation Contract (PRD V2 §90)

Turns the critical uncertainty of a bet into a falsifiable test.
Thresholds are defined **before** results exist — this is the point.

## Input

```text
/siftos validate DEC-XXXX
```

against a record in `validating` (or `ready`).

## Contract structure

For the critical assumption of the bet:

```text
Critical assumption
Test
Population
Signal
Pass
Strong pass
Fail
Inconclusive
Sample
If pass
If fail
```

Rules:

- One contract per critical assumption. If the bet has several, pick the
  most important uncertainty — the SVT (see `shape.md`).
- `Pass` / `Strong pass` / `Fail` / `Inconclusive` must be defined before
  the result exists, with numbers where possible:
  - `Pass`: activation ≥ 30% on the tested population.
  - `Fail`: activation < 25%.
- `Sample`: when the contract is sample-based, the size is defined up
  front (`after_users: 500`).
- `If pass` / `If fail`: the concrete next move for each branch.

## Recording

Update the record:

```text
SVT            the test itself
Expected Outcome   pass/fail thresholds and if-then branches
Revisit Condition  when the outcome will be known
```

Then transition `validating → ready` when the contract is complete, or
keep validating. The human confirms the transition.

## Anti-patterns

- Defining thresholds after seeing the result (hindsight).
- `Inconclusive` as a hedge for everything — it must name what signal
  would be conclusive.
- A test that cannot change the plan (no `If fail` branch) is not a test.
