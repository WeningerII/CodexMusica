# The blind panel runs of 2026-08-25, and what they forced into code

**WHAT THIS DOCUMENT IS.** The dated record of two blind judge-panel runs
over the six banked songs, the mechanical measurements they triggered, and
the planning protocol adopted for any future run. **A PANEL VERDICT IS MODEL
OUTPUT AT NONZERO TEMPERATURE: it does not re-derive byte-identical, so
NOTHING IN CI GATES ON ANYTHING IN THIS FILE** (the same rule that keeps
graphify's semantic pass out of the shipped invocation — a non-deterministic
derivation is recorded beside deterministic ones only with its provenance on
it). What DID become enforceable was re-derived mechanically and lives in
`quality/sentencehood.py`, whose `--check` is deterministic and does gate.

The runs were reached through a failure worth recording: the owner heard
`songs/long_bridge.txt` as a bad song while every gate in this tree said
exit 0, and the first analysis (M-106-era instincts, song-level statistics)
exonerated the plan without locating the defect. The panels located it.

---

## 1 · The planning protocol (adopted before run 2, owner's instruction)

A panel run refuses to launch without: **(1)** a declared one-sentence
question; **(2)** the mechanical-first test — a question a deterministic
check can answer spends no judge; **(3)** lenses derived from named
hypotheses, one REJECT criterion each; **(4)** the SECTION as the unit of
judgment, every ballot quoting from its own section — a verdict with no
quote is DISCARDED, which makes full reading verifiable instead of hoped;
**(5)** at least one SET lens whenever the panel sees more than one artifact
— per-item questions structurally cannot see between-item failures;
**(6)** ground truth declared up front, typing the run as CONTROL (pass
condition fixed before launch) or MEASUREMENT (verdicts only, nothing
"confirmed"); **(7)** aggregation fixed in advance: independent ballots,
zero cross-talk, shuffled blind labels with the key recorded before launch,
suspect items never first or last, majority per unit, disagreement kept as
data; deliberation-to-consensus is REFUSED — debate selects the persuasive
judge, not the true reading.

## 2 · Run 1 — the control: can blind readers hear what the owner heard

Question: does a context-free reader detect the song the owner condemned?
Five judges (sonnet-class), one lens each — sentences, imagery, coherence,
freshness, prosody — six songs, labels shuffled (key recorded first:
A=one_more B=turn_the_wheel C=long_bridge D=stay_awake E=carry_it_over
F=keep_the_light; the suspect at position 3). Pass condition, fixed before
any verdict returned: the panel converges on C.

**Result: 5/5 REJECT C, 5/5 name C weakest, and 24 of the 25 other verdicts
are PASS** — the panel is not a hair-trigger. Each lens named the same cause
in its own vocabulary: "comma-spliced noun lists ... almost no verbs" /
"imagery-as-noise, not picture" / "sections could shuffle freely without
loss" / "nothing here is predictable OR memorable" / "no phrase a melody
could carry". Five complaints, one defect: **lines without verbs.** The 25th
verdict was the imagery judge rejecting A (`one_more`) for its coda —
"unearned dockyard imagery" — which run 2 was partly designed to test.

## 3 · Run 2 — the measurement: sections and tics in the five that passed

Two lenses. **Section lens** (3 judges, 63 ballots each, every ballot
quoting its own section): unanimous — exactly three sections REJECTED 3/3,
zero disagreement across 189 ballots: `one_more`/POSTCHORUS1,
`one_more`/CODA1 (run 1's disclosed prior, confirmed),
`turn_the_wheel`/PRECHORUS1. **Set lens** (3 judges, every claimed tic
needing quotes from >= 2 songs): 3/3 STRONG — a blind listener would clock
one author. The independently-converging tics: verbatim no-variation
choruses; the "almost/Nearly" false-ending echo in two songs; "nothing to
spare" in three; doubled-word emphasis; `thread/brake/nigh/ache/spare/
crossed/quay` — one judge's words: **"a rhyme-word bank reused like one
glossary."**

## 4 · The mechanical half — what the panels turned into numbers

Everything below is deterministic and re-derivable; the load-bearing figures
are re-derived nightly by `python3 quality/sentencehood.py --check`.

- **Cross-song repetition is real and extreme.** Content types shared by
  >= 4 of the six songs: **10** (`light` in 5/6 at 11 tokens; ache, crossed,
  dark, groan, hold, stair, stone ...). Matched null — 300 draws of six
  human songs from six different files — median **1**, max **8**, so ours
  sits outside the null's entire range. At >= 3 of 6: ours 28, null median
  7, max 22. Whole phrases recur: "ache in the wrist" in two songs, "say
  it" in three.
- **The funnel has receipts.** 16 of the 50 words screened during
  `carry_it_over`'s session are SUNG in `long_bridge` — a different song,
  including three of the four members of the `-ay` clean list (weigh, grey,
  sleigh) and both of `spark/arc`. The ban tables and lexicon are fixed, so
  every session shopping a family gets the same short clean list: doctrine
  9's push away from the modal candidate manufactures a SECOND mode one rank
  out — M-88's finding operating across songs. Open as **M-111**.
- **Local binding density is the pressure, at the right grain.** The three
  rejected sections rank **1st, 6th and 10th of 62** lyric sections by
  rhyme-group members per line (from each song's own banked mandate) — while
  song-MEAN density had exonerated the planner (this plan looser than 90% of
  120 draws). Both readings are true; the grain was the error. Density is
  not sufficient: ranks 2-5 are equally dense and passed.
- **The sentencehood calibration** (all figures re-derived by `--check`):
  the STACKED predicate (verbless & function-share <= 0.15 & commas/token
  >= 0.15 & >= 4 tokens) reads 1.17% of a flat 3,000-line human sample and
  0.80% of 1,500 sonnet lines; per-song stacked fraction over the fixed
  500-song protocol has p99 = **0.125**, adopted as the `STACKED_DRAFT`
  ceiling (1.4% of the canon at or over it); `long_bridge` reads **0.16**
  and now grades **exit 3**. The five passing songs read 0.0.
- **The subtle mode's gate was REFUSED by measurement, on the record**:
  human songs carry verbless lines at 33% and 2-runs in 32% of sections,
  and the seven lines of the three rejected sections are statistically
  identical to human verbless lines on every surface feature measured
  (function share 0.40 vs 0.38, commas/token 0.143 vs 0.143). Only reading
  detects that mode; the panel stays its instrument.

## 5 · Honest limits

Run 1 was the weak form of a control — the five "good" songs were only ever
un-condemned, and five judges share model priors, so unanimity can in
principle be a shared blind spot. The strong-form control (a true same-plan
matched pair) remains unbuilt. Judges' single-line POS intuitions and the
tagger disagree at the margins (the tagger reads two of `long_bridge`'s
five INTRO lines as verbed via embedded VBDs inside lists); the adopted
gate therefore catches the FLAGRANT mode only, and says so in its module
docstring. The blinding was enforced by instruction (read exactly one
file), not by sandbox.
