# Results — Kalevala alliteration: the first structure calibration, ADOPTED

Protocol: `quality/KALEVALA_ALLITERATION_PREREGISTRATION.md` (committed
before any number; its two in-flight corrections — the incidental-arm
count and the tokenizer row — are recorded in place, each before the
number it governs was quoted). Instrument:
`quality/kalevala_calibration.py`; `--check` re-derives the adopted
counts exactly. Artifact: `data/kalevala_alliteration_pairs.tsv`,
37,587 rows, md5 `11920dcf120d3b686f272a886af4e415`. Measured 2026-08-18.

**Run 1 is VOID and the voiding is the sitting's first finding.** The
instrument respelled tokenization with the ASCII tokenizer, whose
character class splits ä/ö — on Finnish. The tier-2 table's own head
convicted it (`inen`, `isen`, `in` at the top are suffix fragments, not
words), and the fix was one import: the fin phonology's own `_tokens`,
the definition `kalevala_rate.py` had used all along (doctrine 1). The
tokenizer's fingerprint is in the refusals: 82,712 constrained refusals
(33.7%) through the shredder, **82 (0.03%)** through the real reader.

## The arms (three counts, never summed — doctrine 79)

| arm | pairs | true | false | refused | judged-base rate |
|---|---|---|---|---|---|
| CONSTRAINED (Kalevala + both Kanteletar volumes) | 152,917 | 49,649 | 103,186 | 82 | **0.3249** |
| INCIDENTAL (nine later-Finnish files, null B) | 135,292 | 19,426 | 114,899 | 967 | 0.1446 |
| NULL A (within-item random pairing, 200 resamples, seed 20260818) | — | — | — | — | median 0.1203, max 0.1225 |

## E1 — the constraint is visible: PASS

32.5% of within-line word pairs alliterate under the constraint, against
12.0% for the same vocabulary randomly re-paired (2.7x, empirical p at
the 0.0050 floor — no resample of 200 came within 20 points) and 14.5%
for the same language under no constraint (2.2x). The 2.3-point gap
between the two nulls is itself informative: later Finnish verse
alliterates slightly above its own vocabulary's chance — a stylistic
residue — and the Kalevala corpus sits far above both.

## E3 — tier 1 (the same-stem free ride) is REFUSED, and the refusal is
## the finding

The shared-prefix distribution over 49,649 TRUE pairs decays smoothly:
k>=3 is 8.50%, k>=4 is 2.18%, k>=5 under 1%. There is NO separable
high-k mass — Kalevala singers did not alliterate by inflecting one stem
twice. The free-ride class that HOMEOTELEUTON is for end-rhyme simply
does not exist for this structure in this tradition, so no tier-1 ban is
adopted, exactly as the registration required ("a free-ride class that
is not there cannot be banned into existence"). The end-rhyme rule's
SHAPE transposed; its content did not — which is why calibration is
per-structure measurement and not analogy.

## E2 — the conditional: adopted as a BACKOFF-REQUIRING table

Split-half (derive 339 items, hold 339, seed 20260818): the held half's
alliterating pairs are blocked at **20.3% of token mass (4,891/24,116)**
by the derive half's top-6 per call word. Coverage is type-sparse and
token-dense — the same shape `data/song_rhymepair_en.tsv`'s row records
for English end-rhyme: 27,413 table call types with median **1** distinct
partner and only 1,651 k=6-fillable, yet **71.4% token-weighted
coverage** on the held half. The table's head is the tradition itself —
`vanha`/`väinämöinen` 303, with `vaka` 116 (the epic's opening formula),
`ei`/`ole` 89. ADOPTED with the same caveat as its English sibling:
**this supports a backoff and does not support being used alone**, and
any enforcement k must follow the per-call support rather than assume 6.

## What adoption changed, and the amendment it forced

`Structure.calibrated` is a **language tuple** now, not a bool. The
registration promised "the planner pool grows to two" AND declared the
regime binds Finnish only — a conflict its own binding-scope clause
decides (doctrine 8: a table fitted on one tradition is not quietly
applied to another). So: the sentinel is `("eng",)`, the
`kalevala-alliteration` preset row is `("fin",)`, the ENGLISH planner
pool is UNCHANGED (test_structures §7 pins that this is doctrine 8
holding, not an omission), and the grader's disclosure is language-aware
— a fin-calibrated row declared on an English draft still says "laziness
is NOT graded FOR THIS DRAFT'S LANGUAGE (eng)".

The `--structures=LABEL:NAME` CLI spelling ships with this adoption, as
registered: the same draft under the same groups grades sun/silver a
violation without the declaration and correct alliteration with it
(`quality/test_verbs.py` §39, a difference between two runs). The
adopted counts re-derive via `kalevala_calibration.py --check` (exact
counts, all three verdict columns, both arms, the true-pair total and
the held-out blocked mass) in the nightly lane — the check is a full
remeasurement (~12 minutes) and does not belong in the per-push pool.

## What this does NOT license, restated from the registration

No English enforcement cites these numbers. No planner samples this row
for English plans. The weak/strong axis cells stay uncalibrated until
separately measured. And the English census's alliteration cells
(chance ~9% within-line) were not used as this measurement's null —
Finnish chance was measured on Finnish, twice.
