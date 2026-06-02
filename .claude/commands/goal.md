---
description: Autonomously complete the instrument catalogue — fill genuine gaps, never touch existing output
---

# /goal — Complete the instrument catalogue (unattended)

You are resuming a long-running, autonomous build goal. **Work through it without asking
the user "yes / continue."** The guardrails below are the contract that lets you run
unattended; only stop for the explicit STOP conditions at the bottom.

## Prime invariant (hard, mechanical)
Every change you ship MUST keep the recipe regression byte-identical:
`npm run test:recipes` → **1198/1198**. This is the protection on the user's "perfect
output." If a task would change ANY existing recipe, **do not ship it** — log it under
`## Gated` in `GOAL.md` and move on. Output-changing work happens ONLY with explicit
user go.

## What you are doing
Filling **genuine, verifiable gaps** in `references/02_instruments.js` so every family's
standard instrument inventory is complete. The catalogue is already deeply built
(437 instruments, every one decomposed into parts/variants/defaults, ~4,000 variants) —
this is **gap-filling, not a rebuild**. For each family: audit it against an authoritative
inventory, find instruments genuinely missing, research them, add them. Nothing else.
When a family's standard inventory is complete, it is **done** — do not pad it with
marginalia to look busy. A small, real catalogue beats a big, invented one.

## The ledger
`GOAL.md` is the living checklist + progress log. On each cycle:
1. Read `GOAL.md`. Pick the next unchecked `[ ]` item in **Track 1** (top to bottom).
2. Execute it per the Rules below.
3. Validate → commit → push → check the item off `[x]` with its commit SHA → commit the ledger.
4. Repeat until all Track 1 items are `[x]` or you hit a STOP condition.

## Rules (the contract)
1. **Research-grounded — no invention.** Every instrument / variant / descriptor must come
   from a verifiable source (web research, authoritative organology). NEVER promote a
   conversational phrase into data — this is the "busker kick" error that must not recur.
   Cite the sources in the commit body.
2. **No duplicates, no synonyms.** Before adding, grep id + name + short. If the instrument
   already exists under any name (e.g. `mbira` ≈ kalimba/sanza), **skip it** and note why.
3. **Schema fidelity — an instrument is just an instrument.** New entries match the existing
   shape exactly: `{ id, name, family, class, axes (9 integer axes, each in [-2,2]), short,
   parts: [ { id, name, surface?, variants: [ { id, name, default?, descriptors:[],
   match_tokens:[] } ] } ] }`. Exactly one `default:true` per part. Model the 9-axis vector
   on the closest existing sibling instrument. **No new tables, types, or structural concepts.**
4. **Pure additions only (Track 1).** No tradition may reference the new instruments. The
   regression staying at 1198/1198 is your proof.
5. **Validate every batch before commit:** `node scripts/validate.js` (must say VALID),
   `npm run test:recipes` (1198/1198), `node scripts/check_docs.js` (counts/refs), then
   rebuild `node scripts/build_html.js --out=codex.html`. Update the count claims in
   `SKILL.md` + `README.md` (instrument total + family count) so check_docs stays green.
6. **Commit cadence.** One coherent sub-batch (a "Batch" line, or one family) per commit.
   Clear message naming each instrument + its source. Push with
   `git push -u origin claude/instrument-kit-atoms` (retry on network error). **Never merge
   to main. Never open a PR** unless explicitly asked.
7. **Keep the ledger live.** After each batch, check items off and append a dated line to
   `## Progress log`, so a fresh session can resume from the repo alone.

## STOP conditions (only these — otherwise keep going)
- A task would change existing output (regression ≠ 1198/1198) → move it to `## Gated`,
  continue with the next Track 1 item.
- A genuine directional ambiguity that sources can't resolve → log under `## Needs a call`
  with the specific question, continue with the next item.
- All Track 1 items are `[x]` → write a final summary in `## Progress log` and stop.

Do not stop merely because a batch finished, or to report progress, or to ask permission.
The branch is the user's review surface; they will read it when they return.

## Start
Read `GOAL.md` now and execute the next unchecked Track 1 item.
