# The slop floor — calibration and its failures

`quality/floor.py`. A rejection gate that returns named, measured defects and
never a score. Run it with `python3 quality/floor.py FILE`; regressions are
`python3 quality/test_floor.py`.

Two project rules force the shape. **No weighted quality score, ever**
(doctrine 6) — the exchange rate between surprise and clarity is a genre's
answer, so it belongs in a declaration. **Rejection, not selection**
(doctrine 7) — detecting bad writing held out at AUC **0.964**, ranking good
writing at **0.717**. A caller who wants one number has to invent its weighting
in the open and own it.

> **REPINNED 2026-08-13 from ~~0.971~~ and ~~0.709~~, which are superseded
> TWICE.** Say what they are coordinates of (doctrine 58): both are the
> **ABSOLUTE ten-feature joint held-out AUC** — 0.971/0.964 is Experiment 2
> (Shakespeare vs model-generated, "detecting bad writing"), 0.709/0.717 is
> Experiment 1 (anthologized vs not, "ranking good writing"). The pair quoted
> here was the **PRE-OOV-FIX reading of 2026-08-09**, not the warm post-fix one
> — that intermediate reading is 0.659 (Exp 1) and 0.975 (Exp 2), and it is
> superseded too. Cold, recomputed against a fingerprinted cache, they are
> **0.717 and 0.964**. Pinned as `abs_exp1`/`abs_exp2` `joint_all` in
> `quality/test_discriminate.py`, RECORDED in
> `quality/audit_joint_auc_null.py`, tabulated in `quality/RESULTS.md`
> § "The joint held-out AUCs, cold".
>
> **Doctrine 7's argument is unchanged.** The gap is 0.247 cold against 0.262
> pre-fix: a floor is enforceable and a ceiling is not, by the same margin to
> within 0.015. `CLAUDE.md`'s own statement of doctrine 7 still carries the
> pre-fix pair and this file does not own it, so that repin is somebody
> else's.

## What the thresholds are

Percentiles of the **human** class, so a finding means "outside the range human
verse occupied here", not "bad". Positive class 152 Shakespeare sonnets;
negative class 40 sonnets by one model in the same form and register.

| | section profile | sonnet profile |
|---|---|---|
| unit | 4-line quatrain (lines 1–4, 5–8, 9–12 of each sonnet) | whole 14-line sonnet |
| token domain (human p05–p95) | 29–37 | 108–126 |
| n | 456 human / 120 generated | 152 / 40 |
| `mattr_min` | 0.7568 | 0.7557 |
| `function_word_ratio_max` | 0.5161 | 0.4788 |
| `anaphora_max` | 0.5000 | 0.2857 |
| `line_length_cv_min` | 0.0525 | 0.0939 |
| `predictable_pair_fraction_max` | *not measured* | 0.8333 |

Measured separation, as AUC in the direction *human scores higher*:

| check | section | sonnet |
|---|---|---|
| MATTR | 0.776 | 0.870 |
| function-word ratio | 0.207 | 0.135 |
| anaphora | 0.245 | 0.147 |
| line-length CV | 0.424 | 0.350 |
| rhyme predictability | — | 0.440 |

Quatrains from one sonnet are **not independent**, so 456/120 overstates the
evidence; the effective sample is 152 vs 40. Averaged to poem level the section
AUCs come to 0.872 / 0.119 / 0.091 / 0.358 — the separation is real at poem
level and weaker at the unit the gate actually judges.

## Three checks that did not do what they were built to do

**UNIFORM_LINE_LENGTH came out backwards.** It was built on the assumption that
metronomic line length is a generated-text tell. Measured, Shakespeare is
*more* uniform than the model (0.350 sonnet, 0.424 section). In a fixed form,
uniformity is the form. It is retained as a calibrated "outside the human
range" note, is explicitly not slop evidence, and says so in every finding it
emits.

**ANAPHORA_OVERLOAD was never pre-registered.** It separates at |0.853| on the
sonnet profile, third-best of the set — which is exactly the situation where a
post-hoc feature is most tempting to promote. It is labelled post-hoc in its
own evidence string and owes its own replication.

**PREDICTABLE_RHYME reproduced its own withdrawal.** This project's former
candidate universal came out at 0.560 — chance — matching the number that
withdrew it after the out-of-vocabulary artifact was fixed (RESULTS.md,
post-fix rerun). It is a note, may not carry a rejection, and does not run at
all under the section profile because its threshold was never measured at that
length.

> **THE 0.560 IS WARM AND IS SUPERSEDED 2026-08-13; the note's SEVERITY is
> not.** 0.560 is the **predictability-only joint held-out AUC, Experiment 2,
> absolute feature set** (doctrine 58 — not the same statistic as the
> ten-feature 0.964 in this file's header, and not a per-feature AUC either).
> Cold the
> comparator gives **0.648**, and `rhyme_predictability_mean` clears
> Benjamini–Hochberg FDR at q = 0.10 in BOTH designs with the predicted sign
> (Exp 1 AUC 0.262 at p = 0.0018, Exp 2 AUC 0.340 at p = 0.0015). So "it
> reproduced its own withdrawal" is arithmetic on a number nothing produces,
> and `quality/RESULTS.md` § "`rhyme_predictability` is REINSTATED, narrowly"
> is the standing record. **What does NOT change: it stays a note and may
> still not carry a rejection** — 0.648 is not a separation this gate can
> reject on, the threshold is still unmeasured at section length, and doctrine
> 8 says a replication across two overlapping label contrasts in one corpus is
> not a replication across traditions.
>
> ~~**The shipped code still emits 0.560** — `quality/floor.py` carries it in
> the `PREDICTABLE_RHYME` finding's own evidence string, in
> `CALIBRATION["failed_expectations"]`, and in its module docstring, and
> `quality/test_floor.py` §11 pins that the evidence contains it. Neither file
> is owned here; the repin is theirs to make, and until they make it a caller
> reads a superseded number out of a live finding rather than out of a
> document.~~
>
> **CLOSED 2026-08-14.** The repin is made: all three sites now carry the cold
> **0.648**, and `quality/test_floor.py` §11 pins that the evidence contains
> `0.648` and does **NOT** contain `0.560`, so the string and its test can no
> longer move apart.
>
> **AND §11's OLD PINS WERE VACUOUS**, which is the finding this paragraph did
> not anticipate. `PREDICTABLE_RHYME` does not fire on that fixture at all — 4
> lines take the `section` profile, which declares no
> `predictable_pair_fraction_max` — so `all("0.560" in f.evidence for f in fs)`
> was asserting over an EMPTY LIST and passed no matter what the string said.
> The pin guarding the stale number could never have caught the stale number.
> Doctrine 48 one layer in: not a check that lives only in prose, but a check
> that runs, passes, and quantifies over nothing. §11 now pins the silence
> explicitly FIRST, then re-runs the same lines under a declared threshold so
> the finding actually fires, and pins severity, presence and absence there.
> 86 -> 90 checks, exit 0 both.

`report()` prints all three on every run, beside the checks that worked. A gate
that only shows its working results is advertising.

## What calibration changed

Three thresholds had been hand-estimated in this file. All three moved, every
one in the direction that had made the gate agree with whoever guessed:

```
mattr_min                      0.80 guessed -> 0.7557 measured
predictable_pair_fraction_max  0.40 guessed -> 0.8333 measured
line_length_cv_min             0.12 guessed -> 0.0939 measured
```

The guessed values would have flagged roughly half of Shakespeare for lexical
monotony and about 60% of him for predictable rhyme. An uncalibrated floor does
not fail safe; it fails loud.

## Length is a coordinate, not a detail

MATTR is a moving average over a **50-token window**, and below that the
implementation falls back to plain type-token ratio — the length-confounded
statistic MATTR exists to avoid. Song sections in `lyric.txt` run 30–36 tokens.
So the first calibrated run compared one statistic against another statistic's
percentile and returned confident numbers for a measurement that was never
made.

On the same six-section lyric sheet:

| | flags | notes |
|---|---|---|
| sonnet thresholds applied to 4-line sections | **15** | 12 |
| correct section profile | **4** | 3 |

Eleven of the fifteen were false accusations produced by a length mismatch, not
by anything in the text. Every threshold now carries the length it was measured
at. Text inside a profile's tolerance band but outside its measured range gets
every finding **downgraded to a note** — an extrapolation may not reject — and
text no profile reaches gets no length-sensitive finding at all, only the
relation-level checks, which do not depend on length.

## Out-of-domain behaviour, on material already in the repo

`verse.txt` (a 62-line rap verse at 632 tokens, since DELETED as in-copyright --
see data/sources.tsv) was outside every profile. The
gate declines the length-sensitive checks, says so, and reports only what it
can actually measure: one cliché pair (baby/crazy) and four self-rhymes.

That run also found the last defect. Two of its thirty-one pairs happen to end
in "it", which cleared a bare recurrence count of two and was licensed as a
*radif* — coincidence read as form. A repetend now needs both a count and a
declared fraction of the item's pairs (`radif_min_pair_fraction`, definitional
at 0.50, because this project has no corpus of radif verse to calibrate it
against and guessing a number and calling it measured is the error this whole
document is about).

## What this gate is not

Well evidenced as *"does this look like the model's sonnets rather than
Shakespeare's."* **Unvalidated as a general slop detector.** One form, one
language, one generator, a 400-year register gap; five of the ten
pre-registered features separated with the wrong sign, and a within-item
respecification that removes level effects dropped joint AUC from **0.964** to
**0.891**. Two of the checks presume English on their face —
`function_word_ratio` assumes a clean function/content split that agglutinative
and polysynthetic languages do not have, and predictability is computed against
an English frequency list.

> **REPINNED 2026-08-13 from ~~"0.971 to 0.877"~~, which was not one
> comparison.** That pair CROSSED TWO DIFFERENT READINGS: 0.971 is the
> ABSOLUTE ten-feature Experiment 2 AUC on the **pre-OOV-fix run of
> 2026-08-09**, and 0.877 is the WITHIN-ITEM eight-feature Experiment 2 AUC on
> the **warm post-fix** run. Subtracting one from the other charges the
> respecification with a drop that the out-of-vocabulary fix and a stale cache
> also contributed to — doctrine 58, one axis out: a number is a coordinate of
> its CACHE STATE as well as its design. Measured cold in a single run, the
> comparison is **0.964 → 0.891**, both Experiment 2, both at the one
> hard-coded CV seed, differing only in feature set. Pinned as
> `abs_exp2`/`wi_exp2` `joint_all` in `quality/test_discriminate.py`;
> `quality/RESULTS_WITHIN_ITEM.md` P1 carries the error-ratio arithmetic and
> the 200-seed medians (0.967 → 0.900) that check it does not rest on one
> draw.
>
> **The paragraph's claim is unchanged.** Removing level effects still costs
> most of what the joint AUC was made of, and what remains is still not
> demonstrated to be quality rather than style. `quality/floor.py` still
> carries the superseded pair in its module docstring and in
> `CALIBRATION["known_limits"]`, which is a string the gate reports out; that
> file is not owned here.
