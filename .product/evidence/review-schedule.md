# Review Schedule

Tracked reviews derived from each record's Revisit Condition. Purpose:
learning capture discipline — every decision gets an outcome recorded and
a learning extracted. Created 2026-08-24 after the critique SVT scored
learning capture 35/100 (4 of 5 decisions without recorded outcome).

## Scheduled

| Review date | Record | Trigger | Action |
|---|---|---|---|
| 2026-09-18 | DEC-0003 (content sprint) | Revisit Condition: measure funnel delta | Run `review DEC-0003`: record npm downloads, stars, issues; decide continue/switch/diversify |
| 2026-09-21 | DEC-0004 (skill reorientation) | Revisit Condition: check session-pattern change | Run `review DEC-0004`: felt-friction proxy before/after; fold into DEC-0002 review |
| 2026-11-18 | DEC-0002 (launch + adoption) | Revisit Condition: window end 2026-11-16 | Run `review DEC-0002`: stars/issues/downloads vs contract; verdict pass/inconclusive/fail |
| 2026-11-18 | DEC-0005 (critique command) | Revisit Condition: DEC-0002 resolved | Decide build vs cancel; SVT already passed |

## Standing rules

- A review is due when its date passes — run it before starting other work
  that day. `siftos status` flags stale bets as backstop.
- Outcome sections are append-only: record what happened, never rewrite the
  original prediction.
- After review, update this schedule with the outcome and any follow-up
  decisions.

## Completed

| Reviewed date | Record | Outcome | Learning |
|---|---|---|---|
| 2026-08-21 | DEC-0001 (deterministic core first) | Reviewed: core produced zero defects across publish/adapter/landing | Sequencing determinism first makes failures attributable to workflow, not storage |
