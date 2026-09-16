# Comparator repin — the lyric row's fifth curve, 2026-09-16

`comparator_fingerprint()` moved. That discards the predictability memo by
construction, so `quality/length_curve_calibration.py check` re-derived the
fifth check from scratch and REFUSED:

    RESULT: MOVED — predictability. Argue it and repin as a SET; do not tune (doctrine 58).

This file is the argument, and the repin. The verdict was reached twice: once
by `Production qualification` run 35129802591 at `06df1c1b` (component
`curves`, `exit_code 1`, `elapsed_s 8005.6` against a `budget_s` of 14400 —
it refused on the merits, it did not time out), and once locally against
re-computed rows before anything was changed.

## 0. The verdict, before the tables

FOUR OF THE FIVE CHECKS DID NOT MOVE AT ALL. Over the same 8,536 items,
`mattr`, `fwr`, `anaphora` and `cv` re-derive BIT-FOR-BIT — identical to 16
significant figures, curve coefficients and held-out rates alike. `n_human`,
`lo`/`hi` and the MATTR/TTR population are unchanged. The entire drift is in
`predictable_pair_fraction_max`, which is exactly what the fingerprint
guards: it hashes the two comparator modules whole, and nothing about
tokenisation.

## 1. Population — unchanged, and checked rather than assumed

| quantity | shipped | re-computed |
|---|--:|--:|
| items | 8,536 | 8,536 |
| files | 1,296 | 1,296 |
| token range | 10–3,244 | 10–3,244 |
| MATTR/TTR degenerate at window 50 | 532 | 532 |

Computed in four shards (2,105 + 2,830 + 1,453 + 2,148 = 8,536) and merged
under the fingerprint rule; every shard carried `14821a50f63e` or it would
have been refused by name. The corpus is byte-identical, so the knot
ABSCISSAE are unchanged too — the bins are a function of token counts.

## 2. What moved

Five of predictability's 21 knots, all at N >= 182 tokens. The twelve knots
through N=165 stay at 1.0, the region where a one- or two-pair song makes the
fraction 0/1-valued and the check cannot fire.

| knot | N | shipped | repinned | delta |
|--:|--:|--:|--:|--:|
| 12 | 182 | 0.9375 | 0.9406249999999972 | +0.0031 |
| 16 | 270 | 0.9415032679738561 | 0.9378676470588234 | −0.0036 |
| 18 | 357 | 0.9169871794871791 | 0.9049783549783548 | −0.0120 |
| 19 | 436 | 0.8801176470588234 | 0.8858730158730157 | +0.0058 |
| 20 | 683 | 0.8579734219269103 | 0.8615196078431373 | +0.0035 |

THE MOVES RUN IN BOTH DIRECTIONS. Two thresholds tightened and three
loosened, which is what a comparator change that alters individual items'
predictability looks like, and is not what tuning to clear a gate looks like
(doctrine 58). No threshold was chosen; all 21 were re-derived as a SET and
adopted together.

Held-out false-positive rate, 200 author-held-out file-level 50/50 splits:

| check | shipped | repinned |
|---|--:|--:|
| `mattr` | 4.8622% [2.9214–7.8620] | unchanged, bit-for-bit |
| `fwr` | 5.1278% [3.1919–7.7374] | unchanged, bit-for-bit |
| anaphora | 5.0735% [3.3986–7.1950] | unchanged, bit-for-bit |
| `cv` | 5.3878% [4.3351–6.7120] | unchanged, bit-for-bit |
| predictability | 2.7698% [1.3676–4.4808] | **2.8491% [1.4089–4.5092]** |
| ANY | 18.6385% [14.7665–23.7276] | **18.6640% [14.7736–23.8020]** |

Predictability's rate is POOLED over every length, including the lengths
where the threshold is 1.0 and cannot fire, so it reads under nominal for the
reason `held_out_scope` already records (doctrine 20/79). `ANY` moves only
because predictability is one of its disjuncts.

## 3. A RECORDED DEVIATION: the pick is declared, not automatic

Run under its own rule, the instrument picks **C0 = 1.0** for predictability
and prints `PICK predictability: C0 passes every bin`. That is a threshold at
the statistic's own ceiling: it never fires at any length, while looking
calibrated. Shipping it would be a check that could not fail (doctrine 48).

This is NOT new, and it is NOT the drift. The rule picked C0 when the row was
first banked too; the shipped knot table has always been a DECLARED override,
`--picks predictability=CK`, disclosed in the instrument's own print
(RESULTS_LENGTH_CURVE.md §9). This repin uses the same declared pick, so the
comparison is like-for-like. Both runs are banked:
`curve-adoption.json` is the CK adoption, and
`curve-adoption-rule-pick-C0.json` is the unforced run that picks C0, kept so
the deviation is auditable rather than asserted.

## 4. The proof

The same command that refused, after the repin, against the same rows:

    RESULT: HOLDS — the lyric row's 5 curves re-derive from the corpus   (exit 0)

Full output in `results/comparator_repin_2026-09-16/curve-check.txt`; full
precision and input provenance in that directory's `curve-adoption.json`; the
rows themselves are banked beside them, so the fit reproduces without paying
the ~4.5 CPU-hours the sharded recomputation cost.

## 5. What this does and does not license

It licenses nothing beyond the fifth curve of the `lyric` row. It is not a
finding about songwriting, it does not touch the `song` or `short` bands, and
it does not widen the no-extrapolation rule outside 10–3,244 tokens. The four
unchanged checks are evidence that the comparator move was confined to
`predictability_frac`; they are not independent confirmation of anything
else.
