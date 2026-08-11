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
> all. It is not wildly off: on `lyric.txt` the best attainable p is 3.45e-3
> against a loosest cut of 1.90e-3, a factor of 1.82.
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
| `quality/audit_fwer_fpr.py` | the "9.6% at n=20" in `NULL_AUDIT.md`, `MISSING.md` L-1 and doctrine 72 |
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
4. **The instrument is not far off.** Best attainable p / loosest cut is
   1.7–1.8× on real items, not 100×. Raising `null_samples` past the 2.5e-4 cut
   and shrinking the window are both live routes, and either is cheaper than
   another corpus.

**Does NOT establish** anything at all about rhyme placement in Shakespeare,
in the deleted rap verse, or in any English text. Every sentence in this
document that said otherwise is struck above. `MISSING.md` L-2 said the event
set could not tell real sonnets from scrambled text; the correct reading is now
one step stronger and one step simpler — **at 20 items per arm the two score
identically (29.1% vs 29.0% at `m` = scored, 0.0% vs 0.0% at `m` = candidate)
because an item's smallest attainable p is set by how many chance re-pairings of
its OWN spans are perfect rhymes, and a word scramble preserves the span
multiset exactly.** The scramble was never a null for this statistic.

**The honest next step is not a second rap corpus and not a fourth instrument.**
It is `null_samples` and `window` — the two coordinates that decide whether an
event is attainable at all — measured against the candidate family before any
corpus is chosen. `quality/fwer_family.py` is the runner that re-measures both
constants after any future change to the band, so neither is ever again a number
somebody remembers.
