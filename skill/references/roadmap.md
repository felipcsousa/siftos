# Roadmap (PRD V2 §92)

`.product/ROADMAP.md` — NOW / NEXT / LATER / NOT NOW. Only active bets
belong on the roadmap. The file is derived from records; regenerate it
with `siftos roadmap --write`.

## Mapping

```text
NOW        building | shipped | measuring
NEXT       ready | accepted
LATER      shaping | validating
NOT NOW    paused | cancelled | failed | rejected
```

`reviewed` records are done — they leave the roadmap and their learning
lives in the record.

## Rules

- Never hand-edit the roadmap into a different shape than the mapping;
  regenerate instead.
- The roadmap is a derived view, not a planning authority. `prioritize`
  proposes; the human decides what enters NOW.
- A record without an `Expected Outcome` or `Revisit Condition` is a
  warning sign on the roadmap — surface it, do not silently include it.
