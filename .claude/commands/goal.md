---
description: Autonomously complete the instrument catalogue — fill genuine gaps, never touch existing output
---

# /goal — Complete the instrument catalogue (unattended)

Work through this WITHOUT asking the user "yes / continue." The guardrails below are the
contract that lets you run unattended; only stop for the STOP conditions.

## Prime invariant (hard, mechanical)
Every change you ship MUST keep `npm run test:recipes` at **1198/1198** (existing recipes
byte-identical). If a task would change ANY existing recipe, DO NOT ship it — output-changing
work happens ONLY with the user's explicit go.

## What you are doing
Filling genuine, verifiable gaps in `references/02_instruments.js` so every family's standard
inventory is complete. The catalogue is already deeply built (~460 instruments, every one
decomposed into parts/variants/defaults). This is gap-filling, not a rebuild: audit a family
against an authoritative inventory, find instruments genuinely missing, research them, add
them. When a family is complete, it is done — do not pad with marginalia.

## Rules
1. **Research-grounded — no invention.** Every instrument/variant/descriptor from a verifiable
   source. Never promote a conversational phrase into data. Cite sources in the commit body.
2. **No duplicates/synonyms.** Grep id + name + short before adding; if it already exists under
   any name (e.g. `mbira` ≈ kalimba/sanza), skip it.
3. **Schema fidelity — an instrument is just an instrument:** `{ id, name, family, class, axes
   (9 integer axes, each in [-2,2]), short, parts:[{ id, name, surface?, variants:[{ id, name,
   default?, descriptors:[], match_tokens:[] }] }] }`. Exactly one `default:true` per part.
   Model the axis vector on the closest existing sibling. No new tables/types/concepts.
4. **Pure additions only** — no tradition references the new instruments (the regression at
   1198/1198 is your proof).
5. **Validate every batch before commit:** `node scripts/validate.js` (VALID),
   `npm run test:recipes` (1198/1198), `node scripts/check_docs.js` (counts/refs), then rebuild
   `node scripts/build_html.js --out=codex.html`. Update the count claims in `SKILL.md` +
   `README.md` (instrument total + top-5 family-count line).
6. **One coherent sub-batch per commit**, message naming each instrument + its source. Push to
   `claude/instrument-kit-atoms`. Never merge to main; never open a PR unless asked.

## STOP conditions (otherwise keep going)
- A task would change existing output (regression ≠ 1198/1198) → skip it, note it for the user.
- A genuine directional ambiguity sources can't resolve → skip it, note it for the user.
- No genuine gaps remain → summarize what was done and stop.

## Known gated items (output-changing — need the user's explicit go FIRST)
Do not do these autonomously. When the user greenlights one, produce a measured recipe delta
and wait for sign-off before shipping:
- `kit_configuration` part on `drum_kit` (3/4/5/7-piece) wired into genre traditions (~248 recipes).
- Split `violin_orchestral` → `violin`/`viola`/`cello` and `choir_ensemble` → SATB (~59/~67 traditions).
