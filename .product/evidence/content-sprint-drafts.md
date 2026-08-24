# Content Sprint Drafts — DEC-0003

Draft posts and reply templates for the LinkedIn content sprint.
User publishes; SiftOS does not auto-post.

---

## Post 2 — Dogfooding: What changed after2 weeks of using SiftOS

**Hook (first line):**
I've been using SiftOS with my coding agent for 2 weeks. Here's what changed.

**Body:**

Before: I'd ask my agent "should we build X?" and it would say yes, start coding, and I'd realize3 days later we built the wrong thing.

After: the agent asks me back. "What's the problem? What's the evidence? What's the cheapest test?" And when I decide, it records the decision — prediction, rationale, expected outcome — in the repo.

The shift is subtle but real:

→ Decisions are conscious, not inferred.
→ I know what we expected before we built.
→ When the outcome arrives, we can actually learn.

The meta part: I'm using SiftOS to decide how to evolve SiftOS. This post is a decision (DEC-0003: content sprint). The product memory lives in `.product/decisions/`. The agent reads it at the start of every session.

It's like having a product manager who never forgets.

**CTA:**
Try it: `npx @felipcsousa/siftos install` — takes 1 minute. Your agent starts making decisions with you, not for you.

**Tags:** #productmanagement #AIagents #decisionmaking #buildinpublic

---

## Post 3 — The silent decision your agent already made

**Hook (first line):**
Your AI agent already made a product decision today. You just didn't see it.

**Body:**

When you ask an agent "should we add feature X?", it doesn't say "I don't know, let's think about it." It infers. It picks the most likely answer based on your prompt, your codebase, and whatever the model thinks is "product-sound."

That inference is a decision. A silent one.

No record. No prediction. No way to compare what was expected vs what happened.

SiftOS makes the invisible visible:

1. The agent surfaces options, evidence, and tradeoffs — then asks you to choose.
2. You decide. The agent records: what you chose, why, what you expected.
3. Later, you review: were you right? What did you learn?

The protocol is structured but lightweight. No frameworks, no scores. Just judgment, recorded.

**CTA:**
If your agent is making product decisions silently, you're flying blind. Fix: `npx @felipcsousa/siftos install`

**Tags:** #AIagents #productmanagement #decisions #LLM #buildinpublic

---

## Reply Templates

### Reply to Nathan Verissimo (committed to test + feedback)

> Nathan — great to have you testing it. When you run `siftos init` and try a `prioritize` or `decide` workflow, I'd love to hear what felt right and what didn't. If anything blocks you, open an issue on GitHub: https://github.com/felipcsousa/siftos/issues — that's exactly the signal we need right now.

### Reply to Thiago Bello (saved for later)

> Thiago — whenever you're ready, the quickstart is60 seconds: `npx @felipcsousa/siftos install` + `siftos init`. The agent starts working with you immediately. No config, no setup beyond that.

### Reply to Aline Bindel (requested revisit routine)

> Aline — the revisit routine is on the candidates list (`.product/evidence/candidates.md`). The idea: a periodic prompt that asks the agent to review past decisions, check outcomes, and surface learnings. It's not built yet — but it's exactly the kind of thing SiftOS is designed to support. Want me to open an issue to track it?

### Reply to Leo Cavalcante (PicPay ADR platform)

> Leo — your ADR-based platform at PicPay is exactly the pattern SiftOS formalizes: decisions recorded in the repo, agents read them to hallucinate less. The difference is SiftOS adds the prediction-outcome loop — you record what you expect *before* you build, then compare later. Would love to hear if that loop adds value for your team. Open to contributions too: https://github.com/felipcsousa/siftos

---

## Publishing Checklist

- [ ] Post 2: publish on LinkedIn (target: 2026-08-25)
- [ ] Post 3: publish on LinkedIn (target: 2026-08-28)
- [ ] Reply to Nathan Verissimo
- [ ] Reply to Thiago Bello
- [ ] Reply to Aline Bindel
- [ ] Reply to Leo Cavalcante
- [ ] Measure: npm downloads, stars, issues at 2026-09-18
