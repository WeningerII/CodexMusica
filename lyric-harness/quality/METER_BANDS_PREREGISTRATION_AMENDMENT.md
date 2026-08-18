# Pre-registration amendment — is the certain-line envelope stable?

Registered AFTER the first run fired the original falsifier (31.09%
exclusion against a 25% ceiling — `RESULTS_METER_BANDS.md`) and BEFORE the
analysis this file declares has been run. Disclosure of what has already
been seen: the first run's aggregate tables — the full-pool envelope, the
exclusion tally by cause, the top-five measured-line contributors. What has
NOT been computed anywhere: per-file exclusion rates, and any envelope over
any subset of files. Those are this amendment's subjects, and they are
still predictions.

## Why the original falsifier fired, and what question survives it

The 25% ceiling defended against one failure: percentiles over a population
that is "no longer the corpus". It fired because the reader — CMUdict-backed
General American, the grader's own instrument — cannot read Scots and
17th-century orthography, and the corpus contains books of both. The
registered consequence stands: no band was adopted from run one.

But the ceiling was aimed at the wrong reference class. **Enforcement can
only ever band-check a line the reader reads with certainty**: a draft line
with an OOV token gets COUNT_IS_A_LOWER_BOUND — a refusal, not a band
verdict — before any band could see it. So the population a band will
actually govern is *certain lines by construction*, and the question that
decides adoption is not "how much of the corpus was excluded" but **"is the
certain subset's envelope an artifact of WHICH lines drop out?"** That is
an empirical claim, and this amendment declares its test rather than
arguing it in prose.

## Declared analysis

Added to `quality/meter_bands.py`, reusing run one's sweep unchanged — same
population, same reader, same exclusion rule; nothing about the MEASUREMENT
moves, only the aggregation:

1. **Per-file exclusion rates** — for every file, excluded / lyric lines.
2. **The split** — LOW files have exclusion ≤ 15%; HIGH files exceed it.
   15% is a declared round number well under the blown aggregate: the claim
   is not that 15% is optimal but that it is DECLARED (doctrine 58), and
   that files above it are the ones whose orthography the reader
   demonstrably cannot hold.
3. **The subset envelope** — nearest-rank percentiles over certain lines
   from LOW files only, same points as the original registration.
4. **The meaningfulness floor** — if LOW files hold under 40% of run one's
   104,952 measured lines, the test is REFUSED as too thin to license
   anything, and the outcome is the same as failure.

## Adoption rule, declared before the numbers

Adopt the bands **iff** the LOW-subset envelope agrees with the full
certain-pool envelope within ±1 at p5, p50 and p95, on both quantities
(syllables/line and prominent/line), with the meaningfulness floor met.

What is adopted on success is the ORIGINAL registered derivation over the
FULL certain pool — DENSITY [4, 11], PROMINENCE [2, 7] — with the subset
agreement as its robustness licence. The subset numbers do not replace the
pool; they either license it or kill it.

## Predictions

**A1 — the gap has an address.** Per-file exclusion is strongly uneven, and
the HIGH side is nameable in advance on linguistic grounds:
`eng_hall_thomas_durfey.txt` (17th-century orthography) and
`eng_celtic_robert_burns.txt` (Scots) land HIGH; `eng_hymn_watts.txt`
(18th-century standardized hymn English, the corpus's largest book) lands
LOW.

**A2 — the envelope is not the casualties'.** The LOW-subset envelope
agrees within ±1 at p5/p50/p95 on both quantities. Syllable and prominence
counts per sung line are properties of sung English lines, not of which
century's spelling the lexicon can parse.

## What would falsify the amendment

- A2 fails at any registered point. Then the certain-line envelope IS
  warped by what drops out, no band is adopted, and the next step is a
  registered population redesign (or a registered reader amendment — the
  declared G2P fallback — with its own instrument-match argument), not a
  third try at aggregation.
- The meaningfulness floor fails. Same consequence: too little of the
  corpus reads cleanly for a subset check to license anything.

One prediction missing is reported as a miss; the adoption rule runs on the
registered points alone. Nothing in this file is edited after the run.
