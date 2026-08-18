# Pre-registration — the meter density and prominence bands

Committed **with the runner and before the corpus-wide numbers exist**.
`git log` proves the order: this file and `quality/meter_bands.py` land in one
commit; `RESULTS_METER_BANDS.md` lands in a later one, and no percentile over
the population appears anywhere until it does.

## Why bands, and why they cannot be directions

The live run of the full chain (plan → blind writer → grade → revise,
2026-08-17, seed 42) ended at 0 FLAGs and 0 modal notes — and a residue of
meter NOTEs (CROWDED, prominence arithmetic) that the operator is free to
ignore. That is the same defect shape the modal-rhyme fix just killed: a
principle that lives only in prose. The owner's standard is on record: findings
the system knows about are pursued to resolution, not narrated.

But density and prominence have **no correct direction**. Pushing syllable
counts DOWN until CROWDED goes quiet converges on empty lines; pushing
prominence UP until every head is filled converges on stress-cram. Worse, a
directional pursuit would fight the uniformity checks (`DOWNBEAT_LOCKED`,
`PHRASE_LENGTH_LOCKED`) that want lines to AGREE with each other, not race to
an extreme. The only refusable shape for these quantities is a **band**: too
much and too little both refused, with the edges **measured, not guessed**
(doctrine 16: an uncalibrated threshold fails loud, and it fails toward
whoever guessed it; doctrine 58: a declared threshold is one somebody can
re-derive, not one somebody remembers).

## What is measured

Per lyric line, two quantities, both read by the **exact machinery the grader
cites** — `quality.fit.read_line` on the `eng` path, which routes through
`lyric_harness.word_syllable_map` and therefore applies the
WEAK_ALWAYS/WEAK_NONFINAL phrase-level demotion (doctrine 46):

1. **syllables per line** — `LineUnits.syllables`. The demand side of
   CROWDED / SPARSE / SLOTS_EXCEEDED.
2. **prominent syllables per line** — `len(LineUnits.prominent)`. The demand
   side of PROMINENCE_EXCEEDS_HEADS and the head-alignment arithmetic.

## What is NOT measured, and why

**Stress-on-head agreement rates are not calibratable from text.** Which
prominent syllable lands on which head depends on a placement and a setting
the corpus does not carry; computing an "agreement rate" would require
assuming isochrony, which is precisely the assumption `fit.py` refuses with
NO_SETTING. Only the setting-free pigeonhole quantities above are honest, so
only they are measured. (Doctrine 35: prominence is not always stress, and
faking the missing coordinate is invisible in the numbers.)

## Declared coordinates

| coordinate | value |
|---|---|
| population | every lyric line of `corpus/song/eng_*.txt` |
| lyric line | stripped line that is non-empty and does not start with `#`, `---`, or `[` |
| reader | `quality.fit.read_line(text)` with the default `eng` phonology — the grading path, no private re-implementation |
| exclusion | any line whose `LineUnits.refused` is non-empty (NUMERAL, OUT_OF_LEXICON), whose units are zero, or whose prominence is undecided on any unit — excluded from percentiles, tallied by cause, fraction disclosed |
| why exclusion | a refused token makes the count a LOWER BOUND (doctrine 79); a lower bound inside a percentile is a lie wearing a decimal |
| percentile method | nearest-rank: `k = ceil(p/100 · N)`, value = k-th smallest, 1-indexed; no interpolation is invented |
| percentile points | 1, 5, 25, 50, 75, 95, 99 |
| band derivation | DENSITY band = [p5, p95] of syllables/line; PROMINENCE band = [p5, p95] of prominent/line — derived by `quality/meter_bands.py`, never copied by hand |
| sensitivity check | the same percentiles recomputed with the single largest-contributing file removed |
| weighting | pooled per line; the top-5 files' share of the measured population is disclosed |

The band is a **population envelope over sung English lines**, deliberately
unconditioned on meter — the corpus does not declare its meters, and
pretending it does would be a hidden coordinate. Meter-relative checks
(CROWDED against a declared cycle) already exist; the band's job is to catch
the line that no sung English population would produce, in either direction.

**Enforcement is out of scope here.** Which finding codes the bands emit,
NOTE vs FLAG, and membership in the mandatory-pursuit regime are the second
sitting's decisions and are not preregistered by this document.

## Already looked at, disclosed

Before this registration: the file/line survey (143 `eng_*` files, 152,313
lyric lines by the filter above); a cost probe that read the 18 lyric lines of
`eng_american_alice_cary.txt` (17 certain, 1 excluded; first line 7 syllables,
4 prominent) and timed 2,000 lines of `eng_hymn_watts.txt` **without
aggregating them**. No percentile over any population has been computed.

## Predictions

**P1 — sanity anchor.** Median syllables/line lands in 6–9. The corpus is
heavy with hymnody and ballad meter (8.6.8.6 and 8.8.8.8 alternations), so a
median outside 4–12 means the pipeline is misreading lines, not that the
corpus is exotic.

**P2 — conservation, must hold everywhere.** On every measured line,
0 ≤ prominent ≤ syllables, and measured + excluded = lyric total, exactly.
These are arithmetic facts about the reader; a single violation is a reader
bug, not a corpus fact.

**P3 — exclusion stays representative.** Under 10% of lyric lines are
excluded. Archaic orthography ('twas, o'er) and numerals exist in a
19th-century corpus but are not its bulk.

**P4 — the pool is not one book.** Removing the largest contributor moves
p5/p50/p95 of both quantities by at most ±1 syllable. The largest file
(`eng_hymn_watts.txt`, 693 songs) is known to be a large share before
measuring; the claim is that the envelope survives its removal.

**P5 — the planner-facing one.** The planner's v1 supply per line under
4/4 (2,2) × 2 bars — 8 pulses, 4 heads at subdivision 2 — sits INSIDE the
measured p5–p95 envelope on both axes: p5(syllables) ≤ 8 ≤ p95(syllables)
and p5(prominent) ≤ 4 ≤ p95(prominent). If it does not, the live run's meter
notes were the corpus NORM, and band enforcement as designed would refuse
typical sung lines.

## What would falsify the calibration

- P2 fails anywhere. The reader is broken and every number above it is void.
- Exclusion exceeds 25%. The measured population is no longer the corpus, and
  no band is proposed from it.
- P4 fails: the named percentiles move by more than ±1 without Watts. Then the
  pooled numbers are an artifact of one book, and per-file weighting must be
  designed and preregistered before any band is proposed.
- P5 fails. Then the second sitting does not proceed as designed — the fix
  shape is wrong, and saying so is the result.

A prediction that misses is REPORTED in RESULTS_METER_BANDS.md next to the
number that missed it. Nothing in this file is edited after the run.
