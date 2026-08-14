# Ship — Ship Gate (PRD V2 §74–§76, §94)

Deterministic readiness check before a bet ships. Automatic (Turn Stop
hook) and manual (`siftos ship <DEC-XXXX>`) paths share identical logic
(PRD FR-SHIP-004).

## Invocation

```text
/siftos ship DEC-XXXX
```

or, when the Turn Stop hook is on, the agent runs it automatically at
closeout (at most one continuation in `balanced`; hard requirement in
`strict`). Turning the automatic hook off never removes the manual
command — Ship Gate is always available.

## What it checks

```text
Target user
Problem/goal
Expected outcome
Primary metric
Baseline
Success threshold
Instrumentation
Guardrails
Review condition
Scope
```

## Results

```text
PASS                ready to ship (ProductOS lifecycle)
PASS_WITH_WARNINGS  shippable; warnings are listed
FAIL                missing ERROR-level requirements
NOT_REQUIRED        record not in accepted+ lifecycle yet
```

## What Ship Gate is NOT

Ship Gate controls the ProductOS Bet lifecycle. It is **not**:

- production deployment authorization;
- a security/permission mechanism;
- a substitute for the human decision.

ProductOS state ≠ deployment.

## Recording

`ship` updates `.product/.runtime/session.json` (`ship_gate.required /
passed / result`) so the Turn Stop hook and doctor can report it. On
PASS_WITH_WARNINGS or FAIL, present the findings verbatim; on FAIL, do
not mark the record `shipped` — resolve the ERROR findings first.
