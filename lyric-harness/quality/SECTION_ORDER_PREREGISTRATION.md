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

## RESULT — the pointer half is EARNED, and BUILT 2026-08-22

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
1. ~~`M-25(a)` — stage the movement headings as marks rather than as verse
   lyrics.~~ **DONE 2026-08-21.** `[URLAR]`, `[SIUBHAL 2]`,
   `[CRUNLUATH] (FINALE)` across the three `eng_celtic_msm_*` files, declared
   in `grid.MARK_REFUSED` with the reason.
2. ~~THEN `elaborates` has 14 sections in 3 songs to point at.~~ **DONE.**
3. ~~A reader that says something.~~ **DONE:** `grid.elaboration_findings`,
   read by `quality/mark_coverage.py`'s report.

## WHAT WAS BUILT, AND ONE DEPARTURE FROM WHAT WAS REGISTERED

`grid.MARK_ELABORATES` + `grid.elaboration_findings(song)`.

**IT IS ON THE MARK AND THIS REGISTRATION SAID `FunctionSpec`.** Recorded
rather than retargeted in silence (doctrine 17). The registration was written
while all 14 headings were still `[VERSE n]` blocks whose whole lyric was the
heading; staging them as marks is what gave the field a population, and it put
that population on the MARK. Declaring three new SECTION FUNCTIONS instead
would mean folding a pìobaireachd movement into a vocabulary this very survey
found straining — the exact move `MARK_REFUSED` exists to decline.

**THE MEASUREMENT, over the whole population — 9 elaborating sections in 3
songs.** THREE COUNTS, NEVER SUMMED (doctrine 79):

| | count |
|---|---:|
| `grounded_before` — the mark it elaborates appears earlier | **8** |
| `grounded_after` — the target appears, but only later | **1** |
| `ungrounded` — the target never appears at all | **0** |

**ONLY `ungrounded` IS A FINDING.** Ordering is a DISCLOSURE and not a charge:
an editor who opens on a variation has departed from nothing (doctrine 6). The
single `grounded_after` is `THE PRAISE OF MORAG`, and reading the page is what
explains it — the first movement is printed with **NO HEADING AT ALL**, because
the compositor sets a heading only where the movement CHANGES. That is also
the sharper reason `rank` was refused: the ladder's own head is unmarked in
this corpus.

**`ungrounded` IS 0 OF 9, SO THE DEFECT IS PLANTED.** `quality/test_grid.py`
constructs a siubhal with no ùrlar anywhere in the song and requires the
finding, with the ground restored as the control. A measured zero over a named
population is a fact about this corpus and is not evidence the rule works
(doctrine 94: a positive-case suite cannot find a rule that is too generous).

**AND `rank` IS PINNED AS REFUSED**, not merely absent: the same section
asserts that no section function carries a `rank` field and that the ladder's
top two rungs are declared in `MARK_ELABORATES` while attested nowhere — the
measurement that refused it. A falsified proposal that leaves no trace is one
a later session re-proposes.

## What is NOT proposed, and why

The canon also asked for a **tempo/metre** coordinate (Chinese banshi and
Korean sanjo movements both collapse to `medial`) and a **delivery-mode**
coordinate (pansori aniri vs chang). Both have **0 staged attestation** in any
language. They are recorded in `STRUCTURE_CANON.md` §2 and are not registered
here: a coordinate whose population is empty cannot have a falsifier, and a
registration without one is a plan, not a preregistration.
