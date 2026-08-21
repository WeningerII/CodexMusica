# Results — family-wise error control in the time layer

> # THE HEADLINE OF THIS DOCUMENT IS `VOID`, 2026-08-11.
>
> **"Saturation 6–16%" and "5.4% against a declared 5.0%" were both products of
> a family size `m` measured over the wrong population**, and neither figure
> means what this document says it means. `rhyme_events` built each position's
> family from `scored` — the pairs that PASSED the rhyme band, median **6–8**
> per position — when the family of comparisons actually MADE is **89 on a
> quatrain and 176–265 on a sonnet** (measured below). That is doctrine 27's
> error one layer up, committed INSIDE the function written to fix it:
> `_pvalue` already divides by `n_valid`, every valid chance draw including the
> band failures, and then the correction counted only the survivors. An
> unconditional p with a conditional family gives a per-position error of about
> `α / band_pass` — roughly 10α at a 10% band-pass rate — and it gets **worse as
> the band improves**, because a better band shrinks `m`, which LOOSENS
> `1 − (1−α)^(1/m)`. That is why `theta_coda` 0.60 → 0.80 blew the false-event
> rate up ~3× in both alignments (`MISSING.md` M-4a).
>
> **At the honest family size the event set is MUTE on every item measured.**
> Re-run today, `python3 quality/fwer_family.py --arms`, 20 real sonnets against
> their own word-scramble:
>
> | family | arm | mute | mean saturation | items with any event | median min-p / cut |
> |---|---|---:|---:|---:|---:|
> | scored (what this document reported) | real | 0/20 | 29.1% | 20 | 0.0× |
> | scored | scramble | 0/20 | 29.0% | 20 | 0.1× |
> | **candidate (the honest family)** | **real** | **18/20** | **0.0%** | **0** | **1.7×** |
> | **candidate** | **scramble** | **16/20** | **0.0%** | **0** | **1.7×** |
>
> 18 of 20 real sonnets and 16 of 20 scrambles return `cannot tell`; the rest
> return **0 events**. A median ratio of 1.7× means the smallest p an item could
> attain sits 1.7 times ABOVE its own loosest cut — no event was reachable at
> all. ~~It is not wildly off: on `lyric.txt` the best attainable p is 3.45e-3
> against a loosest cut of 1.90e-3, a factor of 1.82.~~
>
> > **THE LAST SENTENCE IS `VOID`, same day.** "Not wildly off" was the reading
> > that made `null_samples` and `window` look like routes, and it comes from
> > comparing `min_p` with the **loosest** cut — the cut at the item's smallest
> > family, which is an upper bound on attainability rather than an estimate of
> > it. Against the family a typical position actually has, the gap is **9.4×**
> > and **0.0% of positions** are small enough to fire. The instrument is
> > wildly off, and the levers are measured in **"THE LEVERS, MEASURED"** at
> > the foot of this document. The outcome is that the layer **cannot** speak
> > here — not that it has not yet been tuned to.
>
> **Every arm whose events come from `rhyme_events` is affected, and that
> includes the sonnet arm behind Fisher p = 0.950, k = 23.** That figure now
> reads **"cannot tell"**, not "null". So does §P4's whole table, §P2's 5.4%,
> and the 6–16% in §Headline. See "THE RETRACTION'S BOUNDARY" below for what is
> NOT affected and how that was checked.
>
> Nothing below is deleted. Doctrine 17: a check may be kept after its premise
> is falsified, but never quoted as if it were not. Every voided figure is
> struck or annotated where it stands, so the next reader sees the claim, the
> refutation and the mechanism together.

> **RAP ARM WITHDRAWN.** Every rap figure in this document came from
> `verse.txt`, an in-copyright commercial transcription that predated the
> provenance gate, was never declared in `data/sources.tsv`, and was never run
> through it. It is deleted. Under `ProvenanceDeclaration(term_years=95,
> current_year=2026)` the cutoff is **1931** and rap begins in **1979**, so no
> rap corpus is admissible here before roughly 2075 — the arm cannot be
> replicated, only replaced. The aggregate statistics are kept as an audit
> trail; the text is gone. H1's positive half is **untestable under the
> provenance policy** rather than refuted, and its replacement is a
> cross-family corpus defined by structural property rather than genre
> (`quality/POSITIVE_CONTROL.md`).

> **AND THE NULLS ARE WEAKER THAN THEY READ.** `quality/POSITIVE_CONTROL.md`
> measured the layer's minimum detectable effect for the first time. At the
> 5-8 events a corrected item actually carries, the statistic needs ~75% of an
> item's internal rhymes on ONE phase to reach 0.80 power; at 60% concentration
> it has 0.13. So a single item could never have answered the question, and the
> withdrawn rap arm's p = 0.132 / 0.626 / 0.087 did not mean "no effect", they
> meant **no power**. H1's positive half was never once tested. ~~The sonnet arm
> IS genuinely null and now has pooled power behind it: Fisher across items
> gives p = 0.950 (stress, k=23) and p = 0.617 (syllable, k=26).~~
>
> **THAT LAST SENTENCE IS VOID TWICE OVER, 2026-08-11.** First, doctrine 74:
> under 200 H0 replicates at the real item sizes the per-item p has median
> 0.559, not 0.500, and pooled Fisher reaches ≥0.950 in 8.5% of H0 arms rather
> than 5% — so 0.950 was ~1-in-12, not 1-in-20. Second, and larger: **the 23
> items that were pooled had their events built at `m` = scored.** At the
> candidate family 18 of 20 return `cannot tell` and the rest return 0 events,
> so there are no per-item p-values to pool. "The sonnet arm IS genuinely null"
> is now **"the sonnet arm cannot tell"** — which is precisely the distinction
> doctrine 28 exists to make, applied to the arm that was quoting it.


Run against `FWER_PREREGISTRATION.md`, committed before the code.
Regressions: `python3 quality/test_fwer.py`.

## Headline

~~**The layer is measurable for the first time, and it still finds nothing —
which is now a result rather than an absence of one.**~~

**`VOID` 2026-08-11. The layer is not measurable; it is MUTE.** The verdicts
below are kept exactly as written, with what each one turns out to be:

| prediction | verdict AS RECORDED | verdict at the honest family size |
|---|---|---|
| P1 — saturation falls below the ceiling | ~~**CONFIRMED** — 90–93% → **6–16%**~~ | **VOID.** 6–16% is `m` = 6–8. At `m` = 89–265 saturation is **0%** and the item refuses: `cannot tell`, not "below the ceiling" |
| P2 — false-event rate controlled at α | ~~**CONFIRMED** — measured 5.4% against α 5.0%~~ | **VOID.** 5.4% is n=6 (doctrine 72) AND `m` = scored. At the candidate family the H0 rate is 0.0%, and that 0.0% is a **REFUSAL**, not an α |
| P3 — TRIPWIRE: the correction must not delete everything | ~~fired once, on a degenerate item; clear on real verse~~ | **FALSIFIED as registered.** "A milder planted rhyme survives the correction at 3 events" held at `m` = 6–8 and is **0 events** at `m` = 89. The tripwire's own condition is what the fix violates |
| P4 — the registered hypotheses get a powered test | ~~**CONFIRMED**, and H1's positive half fails again~~ | **VOID.** Not powered — mute. Every per-item p in the P4 table is drawn from an event set that could not fire |

Before this, every null result from the time layer was uninterpretable: at
87–97% saturation the test had no power, so "found nothing" and "could not have
found anything" were the same output. ~~Now the false-event rate is calibrated
at 5%, saturation is in range, and the layer still reports no periodic
structure. That is a negative result with power behind it.~~ **The correction
did not move the layer out of that condition; it moved it to the OTHER end of
it.** At 87–97% saturation the event and slot distributions coincided by
construction; at the honest family size no position clears the cut on any item
in this repository. Doctrine 30 read in the other direction — and doctrine 20's
own sentence, arriving on the instrument that was built to satisfy it:
*"inconclusive by construction" is not "null".*

### The family size, measured rather than recalled

`python3 quality/fwer_family.py` — the runner exists so this is never a number
somebody remembers (doctrine 58).

| item | slots | candidate pairs | `m` scored | `m` candidate | per-pair FPR `r` | best attainable p | loosest cut | verdict |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| REAL quatrain (one planted rhyme) | 20 | 1,226 | 6 | **89** | 0.021 | 4.95e-3 | 1.90e-3 | `cannot tell` |
| SATURATED quatrain (doctrine 28's fixture) | 21 | 1,316 | 20 | **95** | 0.104 | 2.85e-2 | 2.44e-3 | `cannot tell` |
| sonnet 1 | 65 | 7,303 | 8 | **203** | 0.014 | 4.20e-3 | 1.71e-3 | `cannot tell` |
| sonnets 1–8 (range) | 58–74 | 6.2k–9.8k | 7–13 | **176–265** | 0.012–0.019 | 2.05e-3–4.30e-3 | 0.95e-3–2.23e-3 | `cannot tell` ×8 |
| `lyric.txt` | — | — | 6 | **184** | — | 3.45e-3 | 1.90e-3 | `cannot tell` |

The two `m` columns are the whole finding. The gap is a factor of 15–30, and it
is not noise: it is the band-pass rate, which is exactly the quantity the
correction was supposed to be independent of.

## THE RETRACTION'S BOUNDARY, verified rather than asserted

The boundary decides how much comes down, so it was checked by execution and
not by reading. **Method:** replace `quality.time_layer.rhyme_events` with a
function that raises, then run each candidate arm to completion and count the
calls.

**INSIDE the retraction — every one of these draws its events from
`rhyme_events`:**

| caller | what it feeds |
|---|---|
| `time_layer.analyse()` (line 582, `if events is None`) | this document's P1/P2/P4 tables, `RESULTS_TIME.md`'s entire arm table, the Fisher pooling in `POSITIVE_CONTROL.md` Part A |
| `time_layer.internal_control()` (line 693) | the H3 line-final tripwire in `RESULTS_TIME.md` |
| `quality/test_fwer.py` | all four guarding assertions |
| `quality/audit_fwer_fpr.py` | ~~the "9.6% at n=20" in `NULL_AUDIT.md`, `MISSING.md` L-1 and doctrine 72~~ **CORRECTED 2026-08-13: THIS SCRIPT CANNOT PRODUCE THAT FIGURE, AND HAS NOT SINCE 2026-08-11.** 9.6% is `family="scored"`. This script takes no `family=` argument at any invocation — it runs `TimeDeclaration`'s default, which became `"candidate"` on 2026-08-11 (`quality/time_layer.py:118`), so it changed arms without changing a line. Re-run at its own defaults on 2026-08-13 it prints **0.0% in both arms, p = 1.0000, MUTE 732 of 820 items**. The 9.6% is `quality/fwer_family.py --arms`'s to reproduce, not this one's. **AND THE SCRIPT NAMED `_fpr` COMPUTES NO FPR** — it computes SATURATIONS; the per-pair false-positive rate doctrine 22 asks for is at `fwer_family.py:147`, whose comment calls it "doctrine 22's currency". `grep -i fpr` over this file matches exactly one line: the `Run:` line quoting its own filename. This row is the one place the repo records which script feeds which claim, which is why it is the one that had to be wrong for two days without anyone noticing. **AND IT NOW HAS A `--check`, ADDED 2026-08-14** — every figure in this sentence reproduced on that date and is pinned, together with the REASON the layer is mute, because a 0.0% is printed identically by five different states and only one of them is this one. See "`--check` — the muteness is pinned, and pinned to its REASON" below |
| `quality/fwer_family.py` | the measurements in this section, which is the instrument and not a claim |

**OUTSIDE it — 0 calls, proved by execution:**

```
positive_control.py imports from time_layer: ['phase_statistic']
  part A ran, power at ceiling 1.00, rhyme_events calls: 0
run_positive_control.py imports: ['TimeDeclaration', 'analyse', 'phase_statistic']
  A mandated  n=19 ... Fisher_p=3.77e-24     B internal  n=20 ... Fisher_p=0.656
  C1 positions-only n=20 ... Fisher_p=2.64e-25   C2 shuffled n=19 ... Fisher_p=0.965
  part B ran all four arms, rhyme_events calls: 0
BOUNDARY VERDICT: UNAFFECTED (0 calls)
```

`positive_control.py` imports **only** `phase_statistic` and plants its events
directly into a synthetic slot stream, so its power table is a property of the
statistic and survives untouched. `run_positive_control.py` imports `analyse`
but calls it **once**, always as `analyse(..., events=ev, stream=stream)` with
`ev` built by its own `mandated_rhyme_events` / `internal_rhyme_events` /
`positions_only` / `shuffled_positions` from `ltc.rhymes` and `ltc.rhyme_keys`,
behind a `if ev is None or len(ev) < 4: continue` guard — and `analyse` reaches
`rhyme_events` only on the `events is None` branch. So **the four 律詩 arms
survive**, including doctrine 41's arm-A-vs-arm-C1 finding and doctrine 42's
Tang half (Fisher p = 0.883, n = 300). Doctrine 42's SONNET half does not.

**One thing on the boundary that must not be read as safe.** Part A's framing
sentence — *"the corrected sonnets carry 5–8 events (RESULTS_FWER.md), which is
the top row"* — takes its event count FROM the voided figure. The power curve is
unaffected; the row it points at is a claim about real items that no longer
holds, because at the honest family size a real sonnet carries **0** events or
refuses. See `POSITIVE_CONTROL.md`.

## `--check` — the muteness is pinned, and pinned to its REASON

`python3 quality/audit_fwer_fpr.py --check`. Added **2026-08-14**. Exit **0**
pass / **1** moved / **2** refused — the three codes `audit_joint_auc_null.py`
already uses; `audit_hafez_radif.py`'s `check()` is the 0/1 half of the same
shape. Until this, the script named in the boundary table above **printed the
muteness and exited 0 whatever it found**, which is the shape
`audit_hafez_radif.py`'s own `PINNED` comment counts off across `audit_spans.py`,
`audit_corpus.py`, `audit_tang_null.py`, `audit_kalevala_null.py` and
`canon_sources.py`. The refusal path is proved as well as the other two: with
the corpus shorter than the graded item count it prints `REFUSED — corpus/
sonnets.txt parses 152 sonnets and this check grades the first N` and exits 2
without running anything.

**IT REPRODUCES.** Re-run at its own defaults on 2026-08-14, `python3
quality/audit_fwer_fpr.py` prints exactly what the boundary-table row records
for 2026-08-13: **0.0% in both arms, p = 1.0000 at the ceiling, MUTE 732 of 820
items** — REAL 18 `cannot_tell` / 0 `refused` / 2 `answered`, NULL S 356/0/44,
NULL L 358/0/42. 11 m 40 s wall, **666.6 CPU-s** at 820 items, threads pinned.
Nothing has drifted, so there is no repin here: the pin **is** the finding, in
the sense `audit_hafez_radif.py` means it. This layer's muteness was true by
nobody checking, on the one arm in this repository whose headline is a
NEGATIVE.

### Why the pin cannot be the rate

Doctrine 20, on the instrument built to satisfy it. **The rate is 0.0% and a
`--check` asserting `mean == 0.0%` would go green on five different states:**

| state | what 0.0% means there |
|---|---|
| an instrument that fired and measured no events | a NULL |
| an instrument that could not fire at all | **MUTE — this layer, 18/20** |
| an item whose own inventory makes rhyme unsurprising | REFUSED (doctrine 28's tripwire) |
| a band that stopped finding any rhyme relation anywhere | the comparator died |
| a corpus that shrank to nothing | the ingestion died |

So the pin is on the STATE and the MECHANISM, and the rate is graded only as a
consequence. **The predicate that separates row 2 from every other row is an
inequality between two measured numbers, not a remembered figure:**

> `m_needed >= 1` **and** `share_firable == 0.0`

`m_needed = ln(1−α)/ln(1−min_p)` is the largest family at which the item's OWN
BEST PAIR would still clear a Šidák cut, so `>= 1` says that pair **is**
significant before correction — the correction is what silenced it, which is the
recorded claim. `share_firable` is the share of the item's positions whose
family is small enough for that pair to fire, so `== 0.0` says the **smallest**
family in the item still exceeds `m_needed`. Together they say *mute because the
family is too large* and nothing else, and each of the other four rows breaks
one of them: a `refused` item never reaches the predicate and has no
attainability fields at all; a dead band drives `best_score` under θ and
`min_p` to 1.0, so `m_needed` goes to **0**; a collapsed candidate pool makes
the families SMALL, which is muteness from the opposite end and shows up as
`share_firable > 0`.

### Doctrine 28, mechanically: 18 and 2 never sum to 20

The REAL arm's three states are pinned as **three numbers** and no pin reads
their total. The 2 `answered` items are additionally pinned as an **observed
zero** — `attainable = True`, 0 events — which is the "none" half. An 18/0/2
that became 20/0/0 would leave the printed rate, the empirical p and every
"mute" total untouched and **is a different finding**.

### What is measured, and what is only bounded

| pinned EXACTLY (no draw enters) | measured 2026-08-14, n = 20 sonnets |
|---|---|
| θ, window, correction, family, α | 0.80 / 32 / Šidák / **candidate** / 0.05 |
| candidate pairs per item (min, max) | **5,519 – 9,778** |
| each item's median family (min, med, max) | **156 – 198 – 282** |
| REAL `cannot_tell` / `refused` / `answered` | **18 / 0 / 2** |

The family row is this document's own published **156–282 across 24 sonnets**,
reproduced to the integer over the first 20. The **203** this document and
`CLAUDE.md` doctrine 4 both quote is *sonnet 1's* median family and is item 0
here; **198** is the median over the twenty per-item medians — the same
measurement rendered differently (doctrine 91), and both appear so neither can
be mistaken for the other.

**NOT pinned, on doctrine 57:** `min_p`, `m_needed`'s value, the null medians,
and the empirical p. Those ride the 20,000-draw within-item null. What is pinned
about them is a DIRECTION with a declared tolerance — `m_needed >= 1` (measured
11–37), median family / `m_needed` `>= 3×` (measured **5.5× – 21.3×**, and the
record's own 9.4× sits inside it), candidate pairs `>= 3,000` (measured ≥ 5,519).
Each floor is a round number set an order of magnitude off the measurement it
guards, and set to fail on a change of KIND rather than a change of draw.

The two null arms are graded on their **degeneracy**, which is the honest thing
to pin about a comparison that did not happen: every replicate arm mean and
every one of the 40 item rates ties the observation exactly, so p = 1.0000 is
the identity-map check (doctrine 63/68) coming back positive and is not read as
a null.

### Proved red in both directions, before it was believed

**MUTE FOR A DIFFERENT REASON — the case doctrine 20 names.** `_tdecl()` given
`max_null_band_pass=0.02` (the shipped value is 0.152, and the 20 sonnets
measure 0.025–0.065), so doctrine 28's inventory tripwire fires on every item.
**The report is unchanged where a reader looks**: `mean event rate 0.0%`,
`median 0.0% range 0.0%-0.0%`, `p = 1.0000 AT THE CEILING`, every replicate
tying. The layer is still mute and still 0.0%. `--check` exits **1** on 8
figures and names it:

```
[FAIL] REAL cannot_tell       committed 18, measured 0
[FAIL] REAL refused           committed 0, measured 20
[FAIL] 0 of 20 mute items are mute FOR THE RECORDED REASON
       20 item(s): INVENTORY -- doctrine 28's band-pass tripwire fired ...
```

**A MEASURED FIGURE MOVES WHILE EVERY PRINTED COORDINATE STAYS IDENTICAL.**
`_tdecl()` given `max_span=2` — a coordinate the header line does not print.
The header is byte-identical, the rate is still 0.0%, and the family collapses:

```
[FAIL] candidate pairs        committed (5519, 9778), measured (2841, 4990)
[FAIL] median family size     committed (156, 198, 282), measured (65, 94, 122)
```

That 94 is **Lever 3's own `p50 m_med` at `max_span=2`**, re-derived by a
mutation rather than read off the table — the two agree, which is worth more
than either alone.

Both mutations were reverted and `--check` returns to exit **0**.

### Cost, and where it belongs

**CHECK_ITEMS = 20, CHECK_REPS = 2** — declared here, not inherited from
`main`'s defaults, because the check reads no null MEDIAN and every replicate
past the point where the arm's degeneracy is visible costs 40 items. 100 items,
**81.6 / 83.4 / 83.7 CPU-s** over three runs (wall 85 s / 101 s / 100 s — it
moves with load where the CPU figure does not; threads pinned) against the full
run's 666.6.
That is affordable in `.github/workflows/ci.yml`'s `record` job — the repo-root
workflow, not `lyric-harness/`'s — whose 10-minute timeout is a runaway guard
rather than a budget. It needs nothing that job does not already have:
`corpus/sonnets.txt` is tracked, `cmudict.dict` is staged by the job's own
`Stage the lexicon` step, and there is no network and no third-party package.
It would become that job's most expensive single step — `audit_spans.py
--check` at ~60 s and `song_profile_calibration.py --check
--without-predictability` at 64 CPU-s are the current ceiling across its 19
steps — and its natural neighbour is `audit_time_pooled_null.py --check`, the
job's other time-layer drift detector. Two of that job's neighbours pin threads
via `env:` and the rest do not; this one should, since its cost was measured
pinned. It is **NOT WIRED**: nothing in CI runs it today, and
`.github/workflows/ci.yml` is not this cell's file to edit.

## What the correction does

A position is declared an event if **any** of its candidate pairs hits, so a
per-pair threshold cannot control the per-position error. The fix converts the
score into a currency that composes:

1. **A p-value per candidate pair**, against a null built by shuffling *which
   spans are paired* while preserving the span multiset — the `shuffle_twin`
   construction from `controls.py`. The null is the item's own spans, drawn
   from exactly the population being scored, which is the domain mismatch that
   broke the matrix's line-final thresholds.
2. **Šidák across each position's family**: per-pair cut `1 − (1−α)^(1/m)`.
   Bonferroni (`α/m`) agrees to within a position or two and is valid without
   the independence Šidák assumes — the comparisons overlap, so it is the safer
   of the two and both are reported.

Measured effect, at theta 0.80 and window 32 — the *original* registered
parameters, which the amendment had to abandon:

| item | uncorrected | ~~Šidák~~ | ~~Bonferroni~~ |
|---|---|---|---|
| sonnet 1 | 91% | ~~**8%**~~ | ~~8%~~ |
| sonnet 2 | 93% | ~~**11%**~~ | ~~11%~~ |
| lyric sheet | 90% | ~~**8%**~~ | ~~7%~~ |
| rap, 20 lines | 91% | ~~**13%**~~ | ~~12%~~ |

> **`VOID` 2026-08-11 — the corrected columns only.** The `uncorrected` column
> stands: it is a count of positions where any pair clears theta and it never
> touches `m`. Both corrected columns are `m` = scored. Recomputed at the
> candidate family, every cell is **0% and a refusal**.

~~Median family size is 14–21 comparisons per position, not the ~135 estimated
from the window alone — the overlap and word-sharing filters remove most
candidates before they are ever scored. The correction is correspondingly
milder than predicted and still moves saturation by an order of magnitude.~~

> **This paragraph is the defect, stated in the document that shipped it.** The
> ~135 estimate was **right in order of magnitude and was argued away.** "The
> overlap and word-sharing filters remove most candidates before they are ever
> scored" describes the BAND, and the band's survivors are not the family — the
> comparisons that were MADE are 89 on a quatrain and 176–265 on a sonnet, which
> straddles the 135 the window implies. The sentence read a filter's output as a
> comparison count and then congratulated the correction for being mild.

## P2 — the null is calibrated, not assumed

~~Word-scrambled sonnets, which destroy rhyme structure while preserving
vocabulary and phonology:~~

```
scrambled sonnet 1   5.2%      4   3.0%
scrambled sonnet 2  11.7%      5   1.5%
scrambled sonnet 3   9.7%      6   1.4%
                              MEAN 5.4%   against a declared alpha of 5.0%
```

~~The within-item null delivers the rate it advertises.~~ This is the check the
matrix's thresholds never had, and it is why those were wrong: they were
calibrated on line-final *word* pairs and applied to arbitrary *syllable
spans*.

> **`VOID` 2026-08-11, on two independent grounds, and the second was invisible
> until the first was fixed.**
>
> 1. **n = 6.** Doctrine 72: an α claim is a claim about a long-run rate. The
>    identical construction at n = 20 gives 9.6%, roughly 2α. Three numbers
>    averaged to a fourth is not a calibration. (`quality/audit_fwer_fpr.py`.)
> 2. **`m` = scored.** The 5.4% was never a false-EVENT rate at the declared
>    family. Rebuilt at the candidate family, the H0 rate over 20 word-scrambled
>    sonnets is **0.0% with 16 of 20 items MUTE** — and a 0.0% that comes from
>    refusal is not "α met", it is "nothing could have fired". Reporting the two
>    as one number is doctrine 20's error wearing the specific mask this
>    document was built to remove.
>
> **The cell that found this explicitly declined to pick an `m` between 6 and 89
> that lands the scramble rate on 5%**, and that refusal is the point: an α
> recovered by choosing a family size is a threshold tuned to its own result
> (doctrine 5). What the layer owes is a family size derived from the
> comparisons made, and the honest consequence of that is muteness.

## P3 — the tripwire fired, and the diagnosis is worth more than the pass

The first corrected run returned **0% saturation on every corpus**, which is a
layer with no power from the opposite direction. Two distinct causes, both
found by the registered tripwire:

**Cause 1 — the null was conditioned on the very filter it was calibrating.**
Chance pairs that failed the conjunctive band were *dropped* from the null
rather than counted. So the null consisted only of pairs that had already
passed the band, and nothing real could beat it. A chance pair that is not a
rhyme relation scores effectively −∞ and belongs in the denominator. Fixed;
`null_scores` now returns the valid-draw count separately and `_pvalue` divides
by it.

**Cause 2 — a genuinely degenerate item, which is not a bug.** A constructed
quatrain whose entire inventory is one rhyme class
(rattle/cattle/saddle/battle/gravel/travel) still returns zero, because **43%
of random re-pairings in that text already pass the band** against ~10% for
real verse. When almost half of all chance pairings rhyme, "this pair rhymes"
carries nearly no information *relative to that text*. That is a true property
of a within-item null, not something to tune away.

The layer now measures the null band-pass rate and **refuses above 25%**,
reporting "cannot tell" rather than "no rhyme". ~~A milder planted rhyme — one
internal rhyme among otherwise unrelated words — survives at 15% saturation
with 3 events, which is what the tripwire was registered to check.~~

> **P3 AS REGISTERED IS `FALSIFIED`, 2026-08-11 — and it is kept, not deleted,
> because the falsified premise is the finding.** "A milder planted rhyme
> survives the correction" held at `m` = 6–8 and is **0 events at `m` = 89**:
> the `REAL` fixture returns `cannot tell`, best attainable p 4.95e-3 against a
> loosest cut of 1.90e-3. The tripwire was registered precisely to catch a
> correction that deletes everything, it did not fire because it was reading a
> family size that made the cut too loose, and the thing it was watching for is
> what happened. Doctrine 17.
>
> **The 0.25 guard moved with it, and for a stated reason.** 0.25 was the null
> band-pass rate measured flush-LEFT at `theta_coda` 0.60, where real verse read
> ~0.10 and the degenerate fixture 0.43 — both halves of that sentence moved
> when the band moved and nothing said so. It is now **2× the measured maximum
> over 30 real sonnets** (0.042–0.076), so a fixture that clears it is a result
> rather than an input.
>
> Causes 1 and 2 above are unaffected and both still hold. Cause 1 in particular
> is worth re-reading beside this retraction: it is the SAME error — a
> denominator conditioned on the band — caught one layer down and then committed
> again one layer up, in the same function, on the same day.

## BH is unusable at this resolution, and says so

Benjamini-Hochberg's threshold for the top-ranked p-value is `q/n`, and n here
is ~7000 candidate pairs, so it needs a tail resolved to ~1.4e-5. A 20000-draw
null resolves to 5e-5. Whether anything is discovered then depends on how many
pairs happen to pile up on the resolution floor rather than on the evidence —
measured before the guard: **63% saturation on one sonnet and 0% on the next
three.**

~~FWER needs no such resolution, because its cut is `α/m` with m ≈ 15, not `q/n`
with n ≈ 10⁴.~~ BH now refuses with the number of draws it would need.

> **THE FREE PASS IS `WITHDRAWN`; THE ORDERING SURVIVES.** `m ≈ 15` WAS the
> scored family. At the candidate family the cut is `1 − 0.95^(1/203)` ≈
> **2.5e-4**, and at `null_samples = 2000` the p-value floor is **5e-4** — so
> **FWER cannot resolve its own threshold either.** It needs a tail ~13× finer
> than this document claimed it needed. BH is still far worse (it would need
> ~73,000 draws to the same standard), so the comparison's CONCLUSION holds and
> its stated reason does not. Doctrine 29 needs the amendment; the patch is in
> `<scratch>/CLAUDE.patch.md`.

## P4 — the powered re-run of H1 and H2

~~Third instrument on the same hypothesis~~, at theta 0.80 / window 32 / Šidák
α=0.05, 2000 permutations:

| arm | n | ran | refused | median saturation | median p | sig at .05 | BH q=.10 |
|---|---|---|---|---|---|---|---|
| ~~sonnets (stress)~~ | ~~30~~ | ~~23~~ | ~~7~~ | ~~10.4%~~ | ~~0.701~~ | ~~1/23~~ | ~~**0**~~ |
| ~~rap, whole verse (stress)~~ | ~~1~~ | ~~1~~ | ~~0~~ | ~~15.6%~~ | ~~**0.132**~~ | ~~0~~ | ~~**0**~~ |
| ~~rap, 20-line blocks (stress)~~ | ~~3~~ | ~~3~~ | ~~0~~ | ~~12.6%~~ | ~~0.374~~ | ~~0~~ | ~~**0**~~ |
| ~~sonnets (syllable)~~ | ~~30~~ | ~~26~~ | ~~4~~ | ~~6.3%~~ | ~~0.554~~ | ~~1/26~~ | ~~**0**~~ |
| ~~rap, whole verse (syllable)~~ | ~~1~~ | ~~1~~ | ~~0~~ | ~~9.1%~~ | ~~0.279~~ | ~~0~~ | ~~**0**~~ |

> **THE WHOLE TABLE IS `VOID` 2026-08-11.** Every `ran` count, every median
> saturation and every median p in it is an event set built at `m` = scored. At
> the candidate family the `ran` column is **2 of 20 on real sonnets and 4 of
> 20 on scrambles, all of them with 0 events**; there is no median p because
> there are no p-values. The rap rows were already withdrawn on provenance and
> are now void on the instrument as well, which is two independent reasons and
> neither rescues the other.

~~**H1's sonnet half holds for the third time.** Predicted null, and null under
every instrument the project has built.~~ **`VOID`.** It is not null under this
instrument; it is mute. Three instruments have now returned three different
kinds of nothing — 87–97% saturation (no power), an unresolvable BH tail, and a
family size at which no position can clear its cut — and none of them has been
a measurement of Shakespeare.

**H1's rap half fails for the third time.** ~~p = 0.132 on the registered
whole-verse unit~~ — withdrawn on provenance (above) and void on the instrument.

**H2 remains unevaluable.** No arm is significant, so the recovered period is
withheld; reading an argmax off a null result is what `RESULTS_TIME.md`
established as tea leaves. This survives the retraction unchanged: an
unevaluable H2 is unevaluable for a stronger reason now.

The registered honesty condition applies and costs nothing here, since there is
no positive result to discount: this was the third instrument, and a
significant rap arm would have been treated as provisional pending a second rap
corpus.

## The cost of the correction

~~**7 of 30 sonnets now refuse for too few events** (fewer than 4 surviving),
and the syllable grid refuses 4. That is the correction being strict enough that
short items lose their event set entirely. It is a real power cost, reported
rather than hidden, and it is the direction the tripwire warned about — just
not far enough to void the layer.~~

> **`VOID`, and the last clause is exactly backwards.** At the honest family
> size the refusal rate is not 7 of 30 — it is **18 of 20 mute plus 2 with zero
> events**, on real Shakespeare. The direction the tripwire warned about is the
> direction the layer went, and it went far enough to void the layer. The
> quantity that was reported as "a real power cost, reported rather than
> hidden" was a power cost computed at a family size that understated it by a
> factor of 15–30.

## What this establishes, and what it does not

~~**Establishes:** rhyme placement in this material carries no detectable
periodic structure in syllable or stress coordinates, under a declared
isochrony assumption, with a false-event rate calibrated at 5% and saturation
inside the ceiling. Three of the four registered predictions confirmed; the
fourth confirmed the instrument and refuted the hypothesis.~~

**Does not establish** that rap is unmetrical. The limits are unchanged and
structural: there is no audio, so isochrony is assumed and is false for
stress-timed English; the rap arm is **n=1**; and this is the third instrument,
so the hypothesis has had three chances and the corpus has had one.

~~The honest next step is a second rap corpus, not a fourth instrument.~~

## WHAT THIS DOCUMENT ESTABLISHES AS OF 2026-08-11

**Establishes, and it is about the instrument rather than about verse:**

1. **`m` is a measurement and it was read off the wrong set.** The family of a
   family-wise correction is the comparisons MADE, not the comparisons that
   survived a filter. Counting survivors makes the per-position error
   `≈ α / band_pass` and — the part nobody would guess — makes it **worse as the
   band gets better**. `theta_coda` 0.60 → 0.80 was a genuine improvement to the
   band that tripled the corrected false-event rate, in both alignments, because
   it shrank `m` from 8 to 6.
2. **At the honest `m`, this event set has no power on any item in this
   repository.** Not "finds nothing" — *cannot* find anything. 18/20 real
   sonnets and 16/20 word-scrambles refuse; the other 6 return zero events.
3. **FWER cannot resolve its own cut here either**, at `null_samples = 2000`.
   It is still far better placed than BH, and that ordering is all the
   comparison ever established.
4. ~~**The instrument is not far off.** Best attainable p / loosest cut is
   1.7–1.8× on real items, not 100×. Raising `null_samples` past the 2.5e-4 cut
   and shrinking the window are both live routes, and either is cheaper than
   another corpus.~~

   > **`VOID` 2026-08-11, later the same day, and this paragraph is the reason
   > the next section exists.** Both halves are wrong and they are wrong
   > together. **1.7–1.8× is the gap against the LOOSEST cut** — the cut at the
   > item's *smallest* family, a position at the edge of the item where the best
   > pair is not. `attainable` was written as an upper bound on attainability
   > and then read as an estimate of it. The gap at a typical position is
   > **m_med / M_NEEDED = 9.4×** on real sonnets, and the share of positions
   > whose family is small enough to fire at all is **0.0%**. And **neither
   > named lever is live**: `null_samples` runs *backwards* (a 100× more
   > expensive null raises min_p from 4.200e-3 to 4.415e-3), and the window
   > only reaches the range at `window ≤ max_span`, where the two anchors are
   > adjacent and the layer is no longer measuring rhyme at a distance.
   > Measured in "THE LEVERS, MEASURED" below.

**Does NOT establish** anything at all about rhyme placement in Shakespeare,
in the deleted rap verse, or in any English text. Every sentence in this
document that said otherwise is struck above. `MISSING.md` L-2 said the event
set could not tell real sonnets from scrambled text; the correct reading is now
one step stronger and one step simpler — **at 20 items per arm the two score
identically (29.1% vs 29.0% at `m` = scored, 0.0% vs 0.0% at `m` = candidate)
because an item's smallest attainable p is set by how many chance re-pairings of
its OWN spans are perfect rhymes, and a word scramble preserves the span
multiset exactly.** The scramble was never a null for this statistic.

~~**The honest next step is not a second rap corpus and not a fourth
instrument.** It is `null_samples` and `window` — the two coordinates that
decide whether an event is attainable at all — measured against the candidate
family before any corpus is chosen.~~ `quality/fwer_family.py` is the runner
that re-measures both constants after any future change to the band, so neither
is ever again a number somebody remembers.

> **The struck sentence was the right instruction and it named the wrong two
> coordinates.** They were measured, in the section below, and neither is a
> route. The runner is `quality/time_attainable.py`.

---

# THE LEVERS, MEASURED — and the layer cannot speak

**Added 2026-08-11.** This section answers the one question the retraction left
open: *can an event be made attainable at all, under an honest family size?*

**The answer is no, and it is arithmetic rather than a judgement.** The
measurements are `python3 quality/time_attainable.py`, which checks itself
against the shipped `rhyme_events` pair by pair (`--verify`) before it sweeps
anything, because every sweep below runs through a memoised comparator.

## The number that decides, and it was never reported

An item produces an event only if some pair's p-value clears that position's
corrected cut, so two quantities settle everything:

| | |
|---|---|
| `min_p` | the smallest p-value any candidate pair in the item attains |
| `cut(m)` | `1 − (1−α)^(1/m)`, the Šidák cut at family size `m` |

and they meet at

> **`M_NEEDED = ln(1−α) / ln(1−min_p)`** — the largest family at which the
> item's own best pair still clears its own cut.

`rhyme_events` now reports it, beside `share_firable`, the share of the item's
positions whose family is that small. At the registered declaration:

| arm | n | p50 `min_p` | p50 `ge` | p50 **M_NEEDED** | p50 `m_min` | p50 `m_med` | **m_med / M_NEEDED** | **% positions firable** | mute |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| real sonnets | 20 | 2.50e-3 | 49 | **21** | 36 | 198 | **9.4×** | **0.0%** | 18/20 |
| word-scramble | 20 | 2.75e-3 | 54 | **19** | 32 | 217 | **11.4×** | **0.0%** | 16/20 |

| item | `min_p` | `ge` | M_NEEDED | `m_min` | `m_med` | loosest cut | ratio-to-loosest |
|---|---:|---:|---:|---:|---:|---:|---:|
| `lyric.txt` | 3.45e-3 | 68 | 14 | 27 | 184 | 1.90e-3 | 1.82× |
| `REAL` fixture | 4.95e-3 | 98 | 10 | 27 | 89 | 1.90e-3 | 2.61× |
| `SATURATED` fixture | 2.85e-2 | 570 | 1 | 21 | 95 | 2.44e-3 | 11.70× |

**Read the last two columns of the first table against `ratio-to-loosest` in the
second.** The 1.7–1.8× this document has been quoting is `min_p` against the cut
at the item's *smallest* family. That is an upper bound on attainability, and it
was read as an estimate of it. The gap at a position that actually carries the
item's best pair is ~10×, and **not one position in either arm has a family
small enough to fire.**

## Why `min_p` has a floor: it is a TIE COUNT, not a resolution

`_pvalue` returns `(ge+1)/(n_valid+1)` where `ge` counts chance draws scoring at
or above the observed pair. For the best pair in a real sonnet:

| item | best score | `n_valid` | `ge` (≥ best) | **strictly above** | `min_p` | M_NEEDED |
|---|---:|---:|---:|---:|---:|---:|
| sonnet 1 | 1.000 | 20,000 | 83 | **0** | 4.20e-3 | 12 |
| sonnet 2 | 1.000 | 20,000 | 40 | **0** | 2.05e-3 | 24 |
| sonnet 3 | 1.000 | 20,000 | 49 | **0** | 2.50e-3 | 20 |
| sonnet 4 | 1.000 | 20,000 | 71 | **0** | 3.60e-3 | 14 |
| sonnet 5 | 1.000 | 20,000 | 50 | **0** | 2.55e-3 | 20 |
| sonnet 6 | 1.000 | 20,000 | 43 | **0** | 2.20e-3 | 23 |

**Not one chance draw is strictly above any item's best pair.** The comparator
saturates at 1.000 for a perfect rhyme; the item's best pair is a perfect rhyme,
and so is every one of the 40–83 chance re-pairings that tie it. There is no
headroom above "perfect" for a p-value to live in, so

> `min_p` → the density of perfect rhymes among re-pairings of the item's own
> spans. **A rate. Not a resolution.**

This is doctrine 57 read from the other side. Doctrine 57 says an empirical p
sitting *at* `1/(n+1)` is reporting the resolution; the complementary trap is a
p sitting far *above* `1/(n+1)` — 84× above it here — which is reporting a rate
that no resolution buys down.

## The five levers, with wall-clock

### Lever 1 — `null_samples`. Dead, and it runs backwards.

| `null_samples` | p-value floor | p50 `min_p` | p50 `ge` | p50 `ge` rate | p50 M_NEEDED | p50 m_med/M_NEEDED | secs (10 items, memoised) |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 500 | 2.00e-3 | 3.99e-3 | 1 | 0.00200 | 25 | 8.5× | 1.8 |
| 2,000 | 5.00e-4 | 3.50e-3 | 6 | 0.00300 | 20 | 10.7× | 2.4 |
| **20,000** (default) | 5.00e-5 | 2.80e-3 | 55 | 0.00275 | 19 | 11.2× | 5.4 |
| 200,000 | 5.00e-6 | 2.64e-3 | 527 | 0.00264 | 19 | 11.2× | 14.0 |

**The floor falls 400× and `min_p` falls 1.5×**, to the rate it was always
estimating. On the *shipped, uncached* path, one sonnet costs **0.21 s at 2,000
draws, 0.60 s at 20,000, 4.69 s at 200,000** — and its `min_p` comes out
**3.998e-3 → 4.200e-3 → 4.415e-3**, i.e. *higher*, because more draws estimate
the tie rate more accurately and it was being under-estimated. Paying 100× more
makes the gap worse.

**This settles doctrine 29's amendment.** "At `null_samples=2000` the Šidák cut
is 2.53e-4 and the p-value floor is 5.00e-4, so FWER cannot resolve its own
threshold" is TRUE, and it is not the binding constraint. At the default the cut
*is* resolved with 5× of headroom — and `min_p` is 4.20e-3, **84× above the
resolution**. The tail was never the problem. `null_samples` is load-bearing for
BH exactly as the amendment says and is a dead lever for FWER.

### Lever 2 — `window`. It moves `m` and leaves `min_p` alone.

| window | p50 pairs | p50 `m_min` | p50 `m_med` | p50 `min_p` | p50 M_NEEDED | m_med/M_NEEDED | % pos firable | items ev>0 | items ev≥4 |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 2 | 380 | 1 | 8 | 4.85e-3 | 11 | **0.7×** | 70.8% | 6/10 | 0/10 |
| 3 | 683 | 2 | 17 | 4.50e-3 | 16 | 1.1× | 43.3% | 3/10 | 0/10 |
| 4 | 1,109 | 4 | 30 | 2.95e-3 | 17 | 1.8× | 26.2% | 1/10 | 0/10 |
| 6 | 1,811 | 9 | 51 | 2.80e-3 | 18 | 2.8× | 9.3% | 0/10 | 0/10 |
| 8 | 2,363 | 13 | 66 | 3.05e-3 | 17 | 3.9× | 6.2% | 0/10 | 0/10 |
| 16 | 4,230 | 26 | 119 | 2.70e-3 | 19 | 6.3× | **0.0%** | 0/10 | 0/10 |
| **32** (registered) | 7,757 | 45 | 213 | 2.80e-3 | 19 | **11.2×** | **0.0%** | 0/10 | 0/10 |
| 64 | 13,543 | 71 | 385 | 3.00e-3 | 17 | 22.6× | 0.0% | 0/10 | 0/10 |

`m_med ≈ 6.7 × window`. **`min_p` is invariant** — 2.7e-3 to 4.9e-3 with no
trend — because `null_scores` re-pairs the item's spans at *any* distance while
the observed pairs are window-bounded. That mismatch is not a defect: a
window-matched null would draw from exactly the scored population and every p
would be uniform by construction, which is doctrine 68's identity map. The
mismatch is the only thing giving the p-value content, and the price is that
the window buys `m` and nothing else.

**So the crossing is at `window = 2`, and `max_span = 3`.** The layer first
reaches its own range at a window *no wider than the anchor span it is looking
for* — a setting that admits only pairs whose two anchors are adjacent. That is
an adjacent-syllable echo, not internal rhyme at a distance. It is not a
parameter choice; it is the layer's subject matter being defined away.

### Lever 3 — `max_span`. Self-cancelling.

| `max_span` | window | p50 `m_med` | p50 `min_p` | p50 M_NEEDED | m_med/M_NEEDED |
|---:|---:|---:|---:|---:|---:|
| 3 | 32 | 213 | 2.80e-3 | 19 | 11.2× |
| 2 | 32 | 94 | 4.75e-3 | 10 | 9.4× |
| 1 | 32 | 31 | 1.64e-2 | 3 | 10.3× |

3 → 1 cuts `m_med` **6.9×** and raises `min_p` **5.9×**, which cuts M_NEEDED
6.3×. The gap does not move: 11.2× → 10.3×. A one-syllable span is a
monosyllable and monosyllables collide by chance far more often, so **every
lever that shrinks the family by shrinking the span pool shrinks the null's
headroom by the same act.** Only a lever that shrinks the family without
touching the span pool can move this ratio.

### Lever 4 — more text. It plateaus, above 1.

| sonnets concatenated | lines | pairs | `ge` | `ge` rate | `min_p` | M_NEEDED | `m_med` | m_med/M_NEEDED |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 14 | 7,303 | 83 | 0.00415 | 4.20e-3 | 12 | 203 | 16.9× |
| 2 | 28 | 18,257 | 68 | 0.00340 | 3.45e-3 | 14 | 263 | 18.8× |
| 4 | 56 | 36,139 | 60 | 0.00300 | 3.05e-3 | 16 | 267 | 16.7× |
| 8 | 112 | 72,911 | 52 | 0.00260 | 2.65e-3 | 19 | 265 | 13.9× |
| 16 | 224 | 137,999 | 51 | 0.00255 | 2.60e-3 | 19 | 247 | 13.9× |

**`m` is bounded by the WINDOW, not by the item**, so it stops at ~250 while the
text grows 16×. The perfect-pair density falls 0.00415 → 0.00255 and stops,
because it is converging on the rate at which two random stressed spans of
English verse are a perfect rhyme. **That rate is a fact about the language, not
about the poem**, and it caps M_NEEDED at ~20–30 however much text is supplied.
More items is not a route.

### Lever 5 — a cross-item null. `MISSING` L-2's ask, delivered, and it is not enough.

L-2 records: *"Owed: a null that destroys the span multiset — across items
rather than within one."* Built (`quality/time_attainable.py` has the
construction; the arm version is in the cell's scratch): null spans drawn from
all 20 items rather than from one, observed pairs unchanged.

| window | arm | pooled `ge` rate | p50 `min_p` | p50 M_NEEDED | p50 `m_med` | items ev>0 | items ev≥4 | mean saturation |
|---:|---|---:|---:|---:|---:|---:|---:|---:|
| 32 | real | 0.00175 | 1.80e-3 | 28 | 198 | 0/20 | 0/20 | 0.00% |
| 32 | scramble | 0.00175 | 2.50e-3 | 20 | 217 | 0/20 | 0/20 | 0.00% |
| 8 | real | 0.00165 | 1.70e-3 | 30 | 62 | 0/20 | 0/20 | 0.00% |
| 4 | real | 0.00175 | 1.90e-3 | 26 | 30 | 7/20 | 0/20 | 0.90% |
| 2 | real | 0.00190 | 5.05e-3 | 16 | 8 | 15/20 | 4/20 | 2.68% |
| 2 | scramble | 0.00195 | 2.30e-3 | 22 | 9 | 15/20 | 2/20 | **3.15%** |

It does what L-2 asked — the perfect-pair rate drops from 0.0028 within-item to
0.00175 pooled, and M_NEEDED rises from 21 to 28. **It is a 1.3× improvement
against a 9.4× gap.** And the last row is the sharper finding: at the only
window where the arm produces enough events to run at all, **the word-scramble
saturates HIGHER than the real verse** (3.15% against 2.68%). The sign flips.

### Lever 6 — a declared beat. The only lever that reaches the range, and it is circular.

Anchors restricted to every k-th grid position — the cheapest honest proxy for
"a declared tempo", which `CLAUDE.md` known gap 3 names as the layer's blocker.

> **THE 1,859 IN THIS TABLE IS NOT THE SONG PROFILE'S BAND.** Noted
> 2026-08-21, when the closing sitting repinned `floor.py`'s `song` profile
> from 1,859 items to 3,571 and a sweep for the old figure landed here. This
> 1,859 is the **p50 candidate-pair count at beat-2 anchoring** — a median
> number of pairs per item in the time layer's family-size analysis. It shares
> an integer with the floor's old band population and nothing else: different
> quantity, different unit, different corpus question. It must NOT be repinned
> when a floor constant moves. (Doctrine 91 from the other side: a count is a
> coordinate of its rendering, so two counts can agree by accident and a
> global replace is how that accident becomes a defect.)

| beat | p50 pairs | p50 `m_med` | p50 `min_p` | p50 M_NEEDED | m_med/M_NEEDED | ev>0 | ev≥4 | **event phases mod 4** |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| none | 7,392 | 198 | 2.50e-3 | 21 | 9.4× | 0/20 | 0/20 | — |
| 2 | 1,859 | 62 | 2.40e-3 | 21 | 3.0× | 2/20 | 0/20 | {0: 2, 2: 1} |
| 3 | 790 | 38 | 2.20e-3 | 25 | 1.5× | 2/20 | 0/20 | {1: 1, 3: 1} |
| **4** | 450 | 28 | 2.35e-3 | 21 | **1.3×** | 3/20 | 0/20 | **{0: 4}** |
| 6 | 164 | 12 | 5.85e-3 | 9 | 1.3× | 2/20 | 0/20 | {0: 2} |
| 8 | 111 | 12 | 9.15e-3 | 5 | 2.4× | 5/20 | 0/20 | {0: 4, 1: 1} |

A beat of 4 cuts the median family 198 → 28 **without touching the span pool**,
which is exactly the property lever 3 lacked, and it is the first setting to
land within 1.3× of M_NEEDED. It still produces four or more events on **0 of 20
sonnets** — and read the last column. Every event it produces is on phase 0,
*because the anchors were restricted to phase 0*. **The one lever that reaches
the range answers the layer's own question by construction.** That is doctrine
41 arriving at the time layer: arm A without arm C1. A declared tempo does not
rescue this layer for free; it buys attainability and hands back a positive
control that passes for the wrong reason.

## The α claim is finally measurable, and only where the layer is dead

`analyse()` refuses below 4 events, so `ev≥4` is the column that decides whether
the time layer exists at a setting.

| window | arm | mute | ev>0 | **ev≥4** | max ev | pooled event rate | p50 m_med/M_NEEDED |
|---:|---|---:|---:|---:|---:|---:|---:|
| 2 | real | 0/20 | 14 | **2** | 5 | 2.44% | 0.6× |
| 2 | scramble | 0/20 | 12 | **2** | 4 | **1.82%** | 0.7× |
| 3 | real | 0/20 | 9 | 2 | 4 | 1.68% | 1.0× |
| 3 | scramble | 0/20 | 8 | 1 | 4 | 1.21% | 1.1× |
| 4 | real | 0/20 | 5 | 1 | 4 | 0.84% | 1.4× |
| 4 | scramble | 0/20 | 6 | 0 | 2 | 0.61% | 1.5× |
| 8 | real | 2/20 | 1 | 0 | 1 | 0.09% | 3.1× |
| 16 | real | 10/20 | 0 | 0 | 0 | 0.00% | 5.2× |
| **32** | real | **18/20** | 0 | 0 | 0 | **0.00%** | 9.4× |
| **32** | scramble | **16/20** | 0 | 0 | 0 | **0.00%** | 11.4× |

**At windows 2–4 no item is mute, so the scramble rate is a RATE and not a
refusal** — and it is **1.82%, 1.21%, 0.61% against a declared α of 5.0%**.
Conservative, which is Šidák behaving correctly over positively dependent
overlapping comparisons. That is the first honest false-event measurement this
layer has produced: P2's 5.4% was n=6 at `m` = scored, doctrine 72's 9.6% was
n=20 at `m` = scored, and the retraction's 0.0% was a refusal. **This one is a
rate, at n=20, at the honest family.**

It is also worthless. Real and scramble are indistinguishable at every window
where either fires, and under the cross-item null the scramble is *higher*. By
doctrine 76 a null computed on an event set that cannot tell verse from a bag of
its own words is not a null about verse.

## Pooling: there is nothing to pool, and the H0 gets worse if there were

Doctrine 33 asks the right question — if no single item can carry an event, can
the arm? — and the answer is arithmetic. Fisher across items needs per-item
p-values, `analyse()` produces one only at ≥4 events, and the count of items
reaching 4 events is **0 of 20 at the registered window and 2 of 20 at window
2.** There is no k to pool over.

And doctrine 74 forbids the rescue in the same breath. Its measured cause is
that *"rhymes arrive in PAIRS inside a window while `analyse()` draws
independent positions"*, which put the pooled H0 at median p 0.559 and 8.5%
above 0.950. **At window 2 that mechanism is total**: every admitted pair has
adjacent anchors, so *every* event arrives as an adjacent pair of slots. The
only window at which the layer can fire is the window at which its permutation
null is most wrong. The two constraints close on each other.

## Doctrine 76: the detection floor, stated beside the null

`python3 quality/positive_control.py`, re-run at the declared seed `20260810`
and reproducing cell for cell — it is outside the *time-layer retraction* and
this cell did not touch it:

| events | slots | c=0.40 | c=0.50 | c=0.60 | c=0.75 | c=0.90 |
|---:|---:|---:|---:|---:|---:|---:|
| 8 | 65 | 0.02 | 0.06 | 0.13 | 0.82 † | 1.00 |
| 20 | 120 | 0.04 | 0.24 | 0.88 | 1.00 | 1.00 |
| 40 | 240 | 0.24 | 0.94 ‡ | 1.00 | 1.00 | 1.00 |

> † **NOT A CELL VALUE — ONE SEED'S DRAW, MARKED 2026-08-13.** This table is the
> FOURTH copy of `positive_control.py`'s power sweep in this repo, and it is the
> copy the 2026-08-13 power repin did not reach: the sentence above said
> *"re-run today and unchanged"*, and being outside the **time-layer**
> retraction was read as being outside that repin too. It is not — the two are
> different events, and *unchanged* here is REPRODUCIBILITY at a fixed seed, not
> stability across seeds. ~~0.82~~ is superseded as a point value and kept
> visible (doctrine 17).
>
> **The spread, the median, the seed list and the full argument are NOT restated
> here** — they live once, under this table's own copy in
> `quality/POSITIVE_CONTROL.md` (the `†` note beneath its version of these same
> rows, and the box below it). Read them there. A fourth transcription of a
> ten-seed sweep is a fourth thing to go stale, which is the defect this note
> exists to stop rather than to repeat. What has to be carried HERE, because it
> changes how the row may be read: `python3 quality/positive_control.py --check`
> pins this case as a **BAND, not a cell**, because a cell pin on it would be
> red nine seeds in ten — so no reader may plan a cell around `0.82`, and the
> sentence below must not rest on it.
>
> ‡ **NOT RE-RUN — stated so it is not mistaken for a checked cell.** The
> "40 events at 50%" sentence directly below rests on this cell, and `0.50` at
> 40 events is not among the cells `POSITIVE_CONTROL.md`'s box records as
> seed-swept (that list is the ceiling, the floor, and `c=0.60` at 8 and 40
> events). It reproduces at the declared seed; its spread across seeds is
> UNMEASURED here, and this note claims nothing about it either way
> (doctrine 20/28 — "not checked" is not "checked and stable").

The statistic needs roughly **40 events at 50% phase concentration** for 0.80
power — a threshold crossing read off `‡` above, so read it as the order of
magnitude it is and not as a boundary anyone has pinned. Its framing sentence —
*"the corrected sonnets carry 5–8 events"* — is
the voided figure; at the honest family they carry **0**. So the detection floor
is not merely unmet. **It is unreachable by a factor of ∞ at the registered
window and by 10× at the only window that fires**, and the gap between "what
this instrument needs to see anything" and "what this instrument can produce" is
the whole result.

## THE DECLARATION

**Outcome 2. The layer cannot produce an event on this material under an honest
family size, and the reason is not tuning.**

Three quantities pin it, and each is measured rather than argued:

1. **`min_p` has a floor of ~2.5e-3 that is a tie count**, set by the density of
   perfect rhymes among chance re-pairings — 0.00255 asymptotically, a property
   of English rather than of the poem. No resolution, no corpus size and no null
   construction moves it below ~1.75e-3.
2. **That floor caps M_NEEDED at 20–30 comparisons per position**, by
   `ln(1−α)/ln(1−min_p)`. It is a ceiling, not an estimate.
3. **The layer's median family is 198–217**, and the only levers that reach 20–30
   are `window ≤ max_span` (which redefines internal rhyme as adjacency) and a
   declared beat (which makes the phase test answer its own premise).

**What this layer would need — the boundary, stated so it can be checked:**

- **A comparator with headroom above "perfect rhyme."** The binding defect is
  that `best_score = 1.000` and 40–83 of 20,000 chance re-pairings tie it
  exactly. Any statistic that cannot separate this item's perfect rhyme from an
  available perfect re-pairing of its own words has a p-value floor at the
  perfect-pair density, whatever else is fixed. The only coordinate available
  that would break those ties is DISTANCE — and using it makes the null the
  identity map, so the information has to come from outside the text.
- **Or a hypothesis space ~10× smaller, declared in advance and not derived from
  the result.** m must fall from ~200 to ~20 at a position while the window
  stays wide enough for rhyme to mean rhyme. A declared tempo does this (198 →
  28 at beat 4) and must ship with a same-positions-no-signal arm, because
  without one it is doctrine 41's failure exactly.
- **Audio, or a tempo declared from outside the text.** This is the same
  requirement as the previous bullet, and it is the one `CLAUDE.md` known gap 3
  has named from the start. What is new is the number: it is worth **9.4× of the
  10× that is missing**, and it is the only lever measured that is worth more
  than 1.5×.

**Not owed:** a second corpus, a fourth instrument, more `null_samples`, a
narrower window, a shorter `max_span`, or more text. All six were measured here
and none of them is a route.

**Runner:** `python3 quality/time_attainable.py`
(`--verify --corpus --floor --levers --beat --arms`). It agrees with the shipped
`rhyme_events` pair by pair before it sweeps anything, and it re-measures every
number in this section, so none of them is ever a number somebody remembers
(doctrine 58). Regression: `quality/test_fwer.py` test 10.
