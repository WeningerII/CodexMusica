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
| P3 — the residue decomposes, violations rise | **CONFIRMED** — 8.0% → 11.6% |
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

Sonnet battery: **85/1064 (8.0%) → 123/1064 (11.6%)**. The rise of 38 pairs is
predicted — a conjunctive rule is strictly stricter than a scalar one — and
88.4% of Shakespeare's mandated pairs still type as RHYME, well short of the
registered falsification threshold ("large enough that the `full` profile
rejects most genuine sonnet rhymes").

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

## What this does not fix

- **`bad`/`bat` stays RHYME** at 0.895, because D and T agree above
  `theta_coda`. That is a slant rhyme and arguably correct, but it means the
  rule types by *graded* coda agreement, not identity, and where the line sits
  is `theta_coda = 0.60` — a declared coordinate, and the one number here that
  is not read off a distribution. The background coda distribution is atomic at
  1.0 (8.6% of random pairs have two empty codas, and common final consonants
  repeat), so a percentile could not discriminate and a judgement was required.
  It is declared rather than hidden.
- **Multi-syllable anchors** are compared syllable-by-syllable from the
  stressed one. Mosaic and broken rhyme reach across word boundaries in ways
  this alignment does not model.
- **Nothing here is validated outside English.** The rule is stated in terms of
  nucleus and coda, which is not how every tradition's rhyme unit is defined —
  qafiya and rawi are consonant-anchored, and the `rawi` profile's existing
  `require_final_consonant` is a stricter special case of this rule for exactly
  that reason.
