---
name: SiftOS Landing
description: The decision ledger — a ruled folio where every product decision is a conscious, dated, measured entry.
colors:
  paper: "#f6f0e3"
  paper-deep: "#efe6d2"
  paper-raise: "#fbf7ee"
  ink: "#23262b"
  ink-soft: "#5d626b"
  ink-faint: "#666b74"
  rule: "#a9afbd"
  rule-strong: "#7f8698"
  vermilion: "#c73a2b"
  vermilion-deep: "#9e2f22"
typography:
  display:
    fontFamily: "Spectral, Georgia, serif"
    fontSize: "clamp(2.5rem, 5.5vw, 4.25rem)"
    fontWeight: 600
    lineHeight: 1.08
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Spectral, Georgia, serif"
    fontSize: "2.25rem"
    fontWeight: 600
    lineHeight: 1.08
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Spectral, Georgia, serif"
    fontSize: "1.625rem"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Spectral, Georgia, serif"
    fontSize: "1.0625rem"
    lineHeight: 1.65
  label:
    fontFamily: "Fragment Mono, monospace"
    fontSize: "0.75rem"
    letterSpacing: "0.07em"
    textTransform: "uppercase"
  command:
    fontFamily: "Fragment Mono, monospace"
    fontSize: "0.9375rem"
rounded:
  sm: "2px"
spacing:
  section-y: "clamp(3.5rem, 9vw, 6.5rem)"
  gap: "1.5rem"
  gap-lg: "2.5rem"
components:
  button-copy:
    backgroundColor: "{colors.vermilion-deep}"
    textColor: "{colors.paper}"
    rounded: "{rounded.sm}"
    padding: "0.55rem 0.9rem"
  button-copy-hover:
    backgroundColor: "{colors.vermilion}"
  entry:
    backgroundColor: "{colors.paper-raise}"
    borderColor: "{colors.rule}"
    rounded: "{rounded.sm}"
  stamp-active:
    color: "{colors.vermilion-deep}"
---

# Design System: SiftOS Landing

## Overview

**Creative North Star: "The Decision Ledger"**

The page is the book of record for product decisions: a ruled folio in warm ivory paper where every section is a posted, dated entry. The conceit is load-bearing, not decorative — the product's own loop (Decision → Prediction → Outcome → Learning) is literally the ledger cycle, and the visitor's job (copy the install command) is a posting slip. The world refuses the SaaS default of hero + feature cards + footer, and refuses the category's claim that the LLM decides for you: here, every decision is conscious, dated, and measured. The form is print grammar — hairlines, tabular figures, stamps, margin annotations — executed with editorial typography, not spreadsheet gray. One authored motion moment (the DECIDED stamp posting on load) carries the whole animation budget; the entry's measure-on-scroll state flip (Decided → Measured when the PDR file enters view) reuses the same stamp.

**Key Characteristics:**
- Ruled folio: thin blue-gray hairlines as the only separators; double rules under the folio header
- One accent: vermilion marks the active entry, the balance figure, and copy actions — nothing else
- Entries are append-only: dated, struck-through alternatives, outcomes that post later
- Prediction confidence is line weight
- Self-hosted Spectral (editorial serif) + Fragment Mono (commands, labels, figures)

## Colors

Warm ivory paper carrying near-black ink, blue-gray ruled hairlines, and a single vermilion accent — the palette of a printed ledger, not a screen.

### Primary
- **Vermilion Deep** (#9e2f22): The accent at action weight — copy buttons, links, the active stamp, the balance figure. Text on paper at 6.4:1.
- **Vermilion** (#c73a2b): Hover state of the accent; never used for small text on paper.

### Neutral
- **Paper** (#f6f0e3): Page ground. Body text on paper at 13.4:1.
- **Paper Deep** (#efe6d2): Inset bands and inline code backgrounds.
- **Paper Raise** (#fbf7ee): Card surfaces — entries, slips, loop, contrib cards. Tonal layering replaces shadows.
- **Ink** (#23262b): Body and display text, prediction weight bars.
- **Ink Soft** (#5d626b): Secondary prose and helper text (5.4:1 on paper).
- **Ink Faint** (#7d828c): Meta labels — folio lines, column headers, ghost entries.
- **Rule** (#a9afbd): Hairline separators and card borders.
- **Rule Strong** (#7f8698): Double rules, slip borders, struck lines.

### Named Rules
**The One Accent Rule.** Vermilion covers at most ~5% of any viewport: the active entry's stamp, the balance figure, and the copy buttons. If a new element needs emphasis, it earns ink weight, never a second color. Statuses (decided, measured) live in ink tones; only the *active* decision gets vermilion.

## Typography

**Display Font:** Spectral (600, self-hosted, latin subset)
**Body Font:** Spectral (400/400-italic)
**Label/Mono Font:** Fragment Mono (400, self-hosted)

**Character:** A book serif with real contrast for the editorial voice, paired with a neutral monospace for the ledger's machinery — IDs, dates, commands, column headers. The pairing reads as a printed form with a typewriter's annotations.

### Hierarchy
- **Display** (600, `clamp(2.5rem, 5.5vw, 4.25rem)`, 1.08, -0.02em): The single H1. Balanced, max 20ch.
- **Headline** (600, 2.25rem, 1.08, -0.02em): Section H2s, max 24ch.
- **Title** (600, 1.625rem / 1.25rem, 1.15, -0.01em): Entry titles and loop step names.
- **Body** (400, 1.0625rem, 1.65): Prose at 68ch max measure; lead paragraphs at 1.25rem / 1.55 in ink-soft.
- **Label** (Fragment Mono, 0.6875–0.8125rem, +0.07–0.12em, uppercase): Folio meta, column headers, stamps, buttons.
- **Command** (Fragment Mono, 0.9375rem, 1.6): Copyable commands in slips.

### Named Rules
**The Tabular Rule.** Every figure — balances, predictions, outcomes, folio dates — uses `font-variant-numeric: tabular-nums`. Numbers align in columns like a ledger, never like prose.
**The No-Eyebrow Rule.** Nothing sits above a heading as a label. The folio line is page furniture (top-right, tiny, mono), never a heading announcement.

## Layout

Single column, max 1080px, 1.5rem gutters. Two pages: the landing (Persuade) and How it works (Read), sharing the masthead, folio furniture, footer, and the ledger grammar. The How-it-works page uses a two-column layout — a sticky folio index (13rem) beside the phase sections — collapsing to a single column and a wrapping index below 860px. Sections stack as folio entries, each closed by a 1px rule; vertical rhythm is `clamp(3.5rem, 9vw, 6.5rem)` between sections, with more space above a heading than below it. Three-column entry grids and the four-column loop collapse to 1fr at 860px; slip and contrib grids collapse at 620px. The hero is folio header → headline → balance line → live entry → posting slips, in that order.

## Elevation & Depth

Flat paper. There are no ambient shadows, no blur, no elevation steps: depth is conveyed by tonal layering (paper-raise surfaces on paper ground) and by hairline edges (cards carry `0 1px 0` / `0 2px 0` in rule color — a printed edge, not a drop shadow). The one depth event in the system is the stamp-in motion.

## Shapes

Print corners: radius 2px everywhere (`--r`). No pills, no 12–16px card radii — the world is a printed form, and sharp corners are its native grammar. Borders are 1px hairlines; the active stamp doubles its border with an inset ring; the ghost entry uses a dashed rule and a struck line.

## Components

### Masthead / Site Nav
- **Character:** the ledger's letterhead — mark + wordmark + tagline, with a mono uppercase site nav (Home · How it works · GitHub)
- **Shape:** mark in a double-ruled frame with a vermilion stamp; wordmark in Spectral 600 1.5rem; nav links in Fragment Mono with a hairline underline on the current page; the brand lockup links home

### Copy Button
- **Shape:** 2px radius, mono uppercase 0.75rem, +0.1em tracking
- **Primary:** vermilion-deep background, paper text, inline SVG copy glyph (1.5 stroke)
- **Hover:** vermilion background; **Active:** translateY(1px)
- **Copied state:** ink background, label swaps to "Copied" for 2s (data-copied)

### Ledger Entry
- **Character:** the product's artifact — a dated, ruled record with prediction, metric, outcome
- **Shape:** paper-raise, 1px rule border, 2px radius; head row in mono faint with the DEC id and a date stamp
- **Body:** title, then three columns (Prediction / Metric / Outcome) divided by hairlines; prediction weight rendered as a 4px ink bar (thin variant: 1.5px rule-strong)
- **Status:** stamp in the foot — decided (ink/active vermilion double ring) or measured (filled vermilion); the hero entry carries both spans and flips via `data-measured` when the PDR file scrolls into view, replaying the stamp-in
- **Annotation:** italic ink-soft with a 2px rule border-left, read as a margin note

### PDR File Block
- **Character:** the protocol made tangible — a rendered `.product/decisions/*.md` record
- **Shape:** same card grammar as the entry; head row (file path + date) in mono; body in Fragment Mono 0.8125rem with markdown keys in ink-soft and `##` headings in medium weight
- **Usage:** section 4 shows the illustrative DEC-0042.md; section 5 shows the `.product/` scaffold tree as a second PDR-file block

### Posting Slip
- **Character:** the conversion device — a command ready to copy
- **Shape:** paper-raise, 1px rule-strong border, `0 2px 0` rule edge; head row (mono label + copy button) divided by a hairline
- **Body:** the command in Fragment Mono, pre-wrapped; a helper note in ink-soft below
- **Wide variant:** the section-5 slip is a direct child (full width, max 640px) — a single terminal slip, not a duplicated pair

### Stamp
- **Shape:** mono uppercase 0.6875rem, +0.12em, 1.5px border in currentColor, 2px radius
- **States:** decided = ink-soft; active = vermilion-deep with inset ring; filled = vermilion-deep background with paper text (unused on the landing, reserved)

### Outlined Action Link (contrib cards)
- **Character:** a secondary action that reads as a button without competing with the accent
- **Shape:** 1px ink border, 2px radius, mono uppercase 0.75rem, inline SVG arrow
- **States:** default ink-on-paper; hover inverts (ink background, paper text); active translateY(1px)

### Ghost Entry
- **Character:** the silent inference — what the product makes impossible
- **Shape:** dashed rule border, ink-faint text, a 1.5px struck line through the middle

### Loop
- **Character:** the protocol as four ruled columns joined by hairline arrows
- **Shape:** paper-raise band, 1px rule border; each step has a mono number (01–04), a title, and ink-soft copy; arrow SVGs sit in the gutters, hidden on collapse
### Stats Line
- **Character:** the proof in numbers — twelve workflows, five memory files, zero automatic interventions by default, one source of truth
- **Shape:** mono labels with serif display figures, ruled band top and bottom; the figures mirror the balance-line grammar (the same printed ledger look)

### Protocol Command Grid
- **Character:** the vocabulary — twelve commands that name one kind of intervention each
- **Shape:** 4×3 ruled grid (paper-raise, hairline borders) with a `<code>` label in vermilion-deep and ink-soft copy; collapses to 2×6 and 1×12 on smaller viewports

### Commitments
- **Character:** the five promises the repository itself enforces
- **Shape:** numbered hairline-separated rows (01–05) with a mono numeral column and a short editorial heading plus body; never a card, never an icon — the grid is the same printed-grid grammar as the protocol

### Before/After Proof Pair
- **Character:** the silent inference alongside the conscious record — same decision, two outcomes
- **Shape:** 3-column grid (1fr auto 1fr) with a hairline arrow centered between the columns; the "Before" side reuses the ghost entry (dashed border, struck line, ink-faint text); the "After" side reuses the LedgerEntry with the lifecycle state

## Do's and Don'ts

### Do:
- **Do** keep vermilion to the active entry, the balance figure, and copy actions — the One Accent Rule.
- **Do** set all figures in tabular numerals.
- **Do** separate with hairlines; a section without a rule is off-system.
- **Do** draw icons as inline SVG at 1.5 stroke in currentColor.
### Don't:
- **Don't** add a second accent, gradients, glass, or blur — the paper is flat.
- **Don't** use rounded cards or pills; radius stays 2px.
- **Don't** put an eyebrow or kicker above any heading.
- **Don't** use emoji or unicode glyphs for icons.
- **Don't** use a system display face, or monospace as costume — mono is for code, data, and measurement only.
- **Don't** strike or rewrite a posted entry: outcomes post later, entries are append-only.