# Preregistration — a POINTER and a RANK on section functions

**Registered 2026-08-21, after `STRUCTURE_CANON.md` found the closed
eight-function set straining in exactly one shape from two unrelated
traditions. The falsifier below FIRED on the rank half, on the only population
that could test it, and that half is REFUSED rather than adopted.**

## The proposal

`quality/grid.py`'s `FunctionSpec` declares `contrasts_with` — the functions a
section is expected to CONTRAST with. Eight canon rows say the model is missing
the opposite relation and its ordering:

| row | family | assigned | complaint |
|---|---|---|---|
| Siubhal · Taorluath · Crunluath · Crunluath a-mach | pìobaireachd | `medial — STRAINS` | they ELABORATE the ùrlar; `contrasts_with` points the wrong way |
| Jo · Ha · Kyū | Japanese | three functions, all **lossy** | phases of one accelerating process, not independent spans |

Two fields were proposed:

- **`elaborates: str`** — the function this one is a variation OF. The pointer
  `contrasts_with` cannot express because it means the opposite.
- **`rank: int`** — position in a monotone series. Pìobaireachd's canonical
  ladder is **ùrlar < siubhal < taorluath < crunluath < crunluath a-mach**,
  each variation more elaborate than the last.

## The falsifier, declared

**RANK is adopted only if the staged corpus shows the ladder RUNNING.** If the
sections carrying these names do not appear in monotone rank order, a `rank`
field would report correctly-printed songs as broken, and the field is refused.

**ELABORATES is adopted only if the pointer is true independent of order** —
i.e. if a variation elaborates the ùrlar whether or not the ladder is monotone.

## The population, and it is the whole of it

`corpus/song/*.txt` carries pìobaireachd movement names in **3 songs, 3 files,
14 headings** — `URLAR` ×5, `SIUBHAL` ×6, `CRUNLUATH` ×3. There is no other
staged text in any tradition using either proposed field: Japanese attestation
is **0 files**.

## RESULT — the rank half is REFUSED

| song | sequence | monotone? | complete? |
|---|---|---|---|
| `THE PRAISE OF MORAG` | SIUBHAL → URLAR → SIUBHAL → URLAR → SIUBHAL → CRUNLUATH | **no** | no |
| `BENDOURAIN, THE OTTER MOUNT` | URLAR → SIUBHAL → URLAR → SIUBHAL → CRUNLUATH | **no** | no |
| `ISABEL MACKAY—THE MAID ALONE` | URLAR → SIUBHAL → CRUNLUATH | yes | no |

**TWO OF THREE ARE NOT MONOTONE, AND NONE IS COMPLETE.** No `TAORLUATH` and no
`CRUNLUATH A-MACH` occur anywhere in the corpus, so the ladder's top two rungs
have zero attestation. What the literary imitation actually does is
**ALTERNATE** — ground, variation, ground, variation, close — which is a
rondo-ish return shape and not a monotone ascent.

**A `rank` field would therefore have flagged two of the three staged
pìobaireachd songs as out of order, and they are not out of order — they are
printed as their editor set them.** Doctrine 6: a convention a writer may
depart from cannot be the thing that fails a check, and here the "departure" is
the majority of the evidence. **`rank` is REFUSED.**

**This is the third strain the survey named and did not resolve**: the ùrlar's
function is POSITIONAL — initiating on its first appearance, rear-framing on
its return — *and the position differs between piping and its literary
imitation*. The corpus is the imitation. A rank measured on piping practice and
applied to this corpus would be a claim about a tradition the staged text does
not witness (doctrine 45).

## RESULT — the pointer half is EARNED and NOT YET BUILT

`elaborates` survives its falsifier: siubhal and crunluath elaborate the ùrlar
in all three songs regardless of sequence, and the relation is what makes the
alternation READABLE rather than random. It is not built here, for a reason the
repo has paid for repeatedly:

> **ITS POPULATION IS CURRENTLY MIS-STAGED.** All 14 movement headings are
> typed `[VERSE n]` with the heading as the block's entire lyric —
> `MISSING.md` `M-25(a)`, which counts 940 such blocks corpus-wide. Building a
> reader for `elaborates` today gives it **zero sections to read**, which is
> the declared-but-unread defect this repo has filed four times over.

**ORDER OF OPERATIONS, and it is the deliverable of this registration:**
1. `M-25(a)` — stage the movement headings as marks rather than as verse lyrics.
2. THEN `elaborates` has 14 sections in 3 songs to point at.
3. A reader that says something (`ELABORATION_UNGROUNDED` when a section
   declares `elaborates` and its target never appears) — with a population.

## What is NOT proposed, and why

The canon also asked for a **tempo/metre** coordinate (Chinese banshi and
Korean sanjo movements both collapse to `medial`) and a **delivery-mode**
coordinate (pansori aniri vs chang). Both have **0 staged attestation** in any
language. They are recorded in `STRUCTURE_CANON.md` §2 and are not registered
here: a coordinate whose population is empty cannot have a falsifier, and a
registration without one is a plan, not a preregistration.
