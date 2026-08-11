# Results — the conjunctive coda band

Run against `BAND_PREREGISTRATION.md`, committed before the rule existed.
Regressions: `python3 quality/test_band.py`.

## Headline

**The leak closes by naming, the taxonomy grows rather than shrinks, and the
negative control tightens — which is what the fitted matrix could not do.**

| prediction | verdict |
|---|---|
| P1 — `sun`/`much` stops being admitted as rhyme | **CONFIRMED** — types as ASSONANCE |
| P2 — no flattening | **CONFIRMED** — vocabulary 3 names → 5 |
| P3 — the residue decomposes, violations rise | **CONFIRMED** — 3.5% → 7.2%, and 8.0% once the coda threshold was calibrated (recorded here as 8.0% → 11.6%; see below) |
| P4 — the negative control tightens | **CONFIRMED** — Whitman 26.0% → **20.0%** |
| P5 — TRIPWIRE: open-syllable rhymes survive | **did not fire** |

## The rule

| nucleus agrees | coda agrees | relation |
|---|---|---|
| yes | yes | RHYME |
| yes | no | **ASSONANCE** |
| no | yes | **CONSONANCE** |
| no | no | NO_RELATION |

Agreement is conjunctive across **channels** and across **syllables** — the
weakest aligned syllable decides, so a strong first syllable cannot buy a weak
second, which is the same compensation defect one level down.

`admits()` now requires two things: the scalar clears theta **and** the
relation is a rhyme relation. That second clause is the whole fix, and it lives
in the band rather than the comparator because compensation is a property of
any additive combination rule.

## P5 — the tripwire that would have made this worthless

`see`/`free`, `day`/`way`, `low`/`snow`, `die`/`eye`, `me`/`be`, `true`/`you`
all remain RHYME. **A quarter of the sonnets' mandated pairs (251 of 986) have
two empty codas**, so reading both-empty as disagreement would have deleted
them all while `sun`/`much` still looked fixed.

The distinction that saves it: **agreement is not evidence.** The fitted matrix
scored empty-vs-empty at **0.000 bits**, entirely correctly — two absent codas
tell you nothing. But they plainly *agree*, and agreement is the predicate the
band asks. Two different questions about the same channel.

## P1 and P3 — what the typing actually says

| pair | scalar | relation |
|---|---|---|
| `sun`/`much` | 0.772 | **ASSONANCE** |
| `dawn`/`again` | 0.729 | **CONSONANCE** |
| `love`/`prove` | 0.784 | **CONSONANCE** |
| `night`/`light` | 1.000 | RHYME |
| `bad`/`bat` | 0.895 | RHYME |

`sun`/`much` still scores 0.772 against a 0.75 band — the scalar is unchanged,
because the comparator is unchanged. It is no longer *admitted*, because the
relation is not a rhyme relation. The leak was never in the number.

**`love`/`prove` typing as CONSONANCE is the result worth keeping.** The
declaration says CMUdict General American, and in General American `love` and
`prove` do not rhyme — they share a coda and differ in nucleus, which is
exactly consonance. The battery's documented residue, described for the whole
life of the project as an undifferentiated "Early Modern -y class, archaic -st
morphology, rhotic ER/AOR class", now carries names, and the names say
*dialect mismatch* rather than *failure*.

Sonnet battery, **as recorded at the time**: 85/1064 (8.0%) → 123/1064 (11.6%).
The rise of 38 pairs is predicted — a conjunctive rule is strictly stricter than
a scalar one.

**CORRECTED 2026-08-10, and the correction makes P3 stronger, not weaker.**
Both denominators counted the 50 mandated pairs the harness REFUSED, where the
end word is absent from CMUdict and there was never a verdict to be right or
wrong about — Shakespeare was being recorded as failing to rhyme
`viewest`/`renewest`, `gazeth`/`amazeth`, `receivest`/`deceivest`. Both
numerators counted them too. Re-measured band-off and band-on over the identical
152 sonnets:

| | mandated | refused | judged | violations | rate |
|---|---:|---:|---:|---:|---:|
| band off | 1064 | 50 | 1014 | 35 | **3.5%** |
| band on | 1064 | 50 | 1014 | 73 | **7.2%** |
| band on, theta_coda calibrated 0.60 -> 0.80 (2026-08-10) | 1064 | 50 | 1014 | 81 | **8.0%** |

85 − 50 = 35 and 123 − 50 = 73, so **no count moved**: the 50 simply stopped
being called violations. The rise of 38 pairs is the same 38. What changes is
the size of the claim — the band **more than doubles** the violation rate on
pairs the harness could actually read, where 8.0% → 11.6% read as a 45% rise.
92.8% of the JUDGED pairs still type as RHYME, still well short of the
registered falsification threshold ("large enough that the `full` profile
rejects most genuine sonnet rhymes"). Charging the comparator for the ingestion
layer's misses is the triage rule in CLAUDE.md broken in the headline number.

## P4 — the negative control, which is the real test

Whitman, 150 lines of free verse, at the documented theta 0.82:

| | lines captured in chains | chains ≥3 |
|---|---|---|
| before | 26.0% | 15 |
| **with the conjunctive band** | **20.0%** | **13** |

This is the number the fitted matrix went the wrong way on, and it is why the
band is shipped as the default while the matrix is not. Free verse produces
plenty of accidental nucleus agreement; requiring the coda to agree as well
removes six percentage points of it without touching a single genuine rhyme in
the sonnet battery beyond the dialect residue.

## P2 — no flattening

The `assonance` profile still admits `sun`/`much` at 1.000 as RHYME. That
profile exists to score nucleus-only agreement, so it declares `coda: 0.0` and
the band switches itself off there — applying a coda requirement to the
assonance profile would be incoherent.

`Declaration.conjunctive_band` turns the rule off globally, so a disagreement
about it lands in a coordinate (doctrine 1) rather than in an argument. And the
relation vocabulary went from three names to five: the harness can now say more
than it could before, which was the condition this rule had to meet.

## A side effect on the time layer

Applying the band to `rhyme_events` drops event saturation from 92–97% to
**86–93%**. Real, and not enough: the ceiling is 75%, and the dominant cause is
still the multiple-comparisons problem quantified in `RESULTS_MATRIX.md` —
~135 comparisons per stressed syllable, so even a 2.4% per-pair false-positive
rate saturates. The band removes assonance-only events; it does not remove the
comparison count. Post-hoc, and reported as post-hoc.

> **CHECKED AGAINST THE 2026-08-11 TIME-LAYER RETRACTION, and this paragraph
> SURVIVES — the only figure in the project's time-layer chain that does.**
> `RESULTS_FWER.md`'s headline is void because the family-wise correction
> measured `m` over band survivors. Both numbers here are UNCORRECTED
> saturation — positions where any candidate pair clears theta — which never
> touches `m`, so neither moves. Re-measured today the uncorrected column is
> unchanged; only the Šidák and Bonferroni columns of `RESULTS_FWER.md` are
> void.
>
> **And the "~135 comparisons per stressed syllable" estimate is vindicated.**
> `RESULTS_FWER.md` argued it down to "14–21" on the ground that the band's
> filters remove most candidates before scoring — which read a filter's output
> as a comparison count. Measured, the CANDIDATE family is **89 on a quatrain
> and 176–265 on a sonnet**, straddling 135. The estimate this document
> inherited was right; the document that corrected it was not.

## What this does not fix

- **`bad`/`bat` stays RHYME** at 0.895, because D and T agree above
  `theta_coda`. That is a slant rhyme and arguably correct, but it means the
  rule types by *graded* coda agreement, not identity, and where the line sits
  is `theta_coda`.
  **THIS ENTRY SAID 0.60 WAS "the one number here that is not read off a
  distribution", AND THAT WAS TRUE AND IS NO LONGER.** `quality/redteam_band.py`
  read it off one. At 0.60 the band admitted **11.10% of random CMUdict word
  pairs as RHYME** while failing only 7.2% of Shakespeare's mandated pairs — a
  NEGATIVE separation, i.e. the harness was likelier to marry two random
  dictionary words than to fail one of his. `independents`/`powersoft` passed,
  because AH~AA scores 0.730 and NTS~FT scores exactly 0.600. Held out on an
  untouched half of the sonnets and an untouched half of the random pairs,
  **0.80** cuts the false-positive rate 11.93% → 4.67% for 0.6pp of
  true-positive cost, and the separation goes −5.5pp → +2.4pp. Shipped, because
  doctrine 5 requires a fit to beat the hand-set value HELD OUT and this one
  does, in both halves, in the same direction. The old argument — that the coda
  background is atomic at 1.0 so a percentile could not discriminate — was
  about calibrating against the coda distribution alone; it never occurred to
  anyone to calibrate the whole band against a random-pair false-positive rate,
  which is doctrine 22 and was sitting there the whole time.
- **Multi-syllable anchors** are compared syllable-by-syllable from the
  stressed one. Mosaic and broken rhyme reach across word boundaries in ways
  this alignment does not model.
- **Nothing here is validated outside English.** The rule is stated in terms of
  nucleus and coda, which is not how every tradition's rhyme unit is defined —
  qafiya and rawi are consonant-anchored, and the `rawi` profile's existing
  `require_final_consonant` is a stricter special case of this rule for exactly
  that reason.
