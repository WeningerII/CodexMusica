# Results: length-conditioned floor thresholds over the WHOLE corpus — stage A (four checks) 2026-09-04; stage B (predictability) PENDING

> Pre-registration: `quality/LENGTH_CURVE_PREREGISTRATION.md` (2026-09-04,
> before any number below was read). Instrument:
> `python3 quality/length_curve_calibration.py compute --without-predictability --out rows.tsv`
> (85 CPU-s) then `… fit rows.tsv --seeds 200 --checks mattr,fwr,anaphora,cv`
> (about 25 min on a shared core). Every figure below is the instrument's
> own print over the corpus at `e8491bf4`: **8,667 items, 1,297 files,
> 4–3,245 tokens, median 154**. `MISSING.md` M-239 is the entry.

## 0. The verdict, before the tables

**Every one of the four cheap checks passes the held-out 5% rate test in
every one of the 22 length bins under a SMOOTH threshold that is a function
of ln N, fit on the whole corpus at once.** The picks by the declared rule
(fewest parameters passing every bin):

| check | tail | pick | threshold at length N, x = ln N | calibrated range | holes |
|---|---|---|---|---|---|
| `mattr` | 5th, lo | **C1** | `0.489163 + 0.0394413·x` | 4–3,245 | none |
| `fwr` | 95th, hi | **C2** | `0.692763 − 0.0688436·x + 0.0054502·x²` | 4–3,245 | none |
| anaphora | 95th, hi | **C2** | `1.13285 − 0.238372·x + 0.0157485·x²` | 4–3,245 | none |
| `cv` | 5th, lo | **C2** | `−0.0314058 + 0.0359349·x − 0.00181958·x²` | 4–3,245 | none |

The derived limits are the corpus's own ends, 4 and 3,245 tokens. There is
no length inside that range at which any of the four checks is refused.
The two shipped bands covered 5,964 of the 8,667 items (69%); the curves
cover 8,667 (100%) — with the caveat, stated in §2, that above 688 tokens
one bin of 267 items carries the whole top of the range.

**The current design, extended to every length, FAILS.** C0 is a single
constant per check — what a band is, applied everywhere — and it passes
18/22, 18/22, 20/22 and 19/22 bins. Where it fails is not random: at the
bottom of the corpus it over-flags (mattr 8–13% under 90 tokens; anaphora
18% under 45; `cv` 19% under 45) and at the top it goes silent (mattr
0.28% over 688 tokens, `cv` 0.00%, anaphora 0.00%). A fixed threshold
charges short human songs and cannot see long ones, which is the drift the
band rule was refusing to look past, now measured end to end.

## 1. Population and features

`population()`'s own rows, `--- TITLE:` items of `corpus/song/eng_*.txt`,
no sample, duplicates kept, the four features computed by the shipped
functions and defined on all 8,667 items. Predictability (stage B) is being
computed cold in four shards because the on-disk memo's fingerprint no
longer matches the shipped comparator; see §8.

## 2. The bins (§2 of the preregistration), and what sits in them

22 bins of 400 items sorted by N, the last of 267. The two diagnostic
columns were added to the print before the held-out run and select
nothing: they say how much of a bin is one FORM.

| k | n | N | median N | 14-line % | 4-line % | files |
|--:|--:|---|--:|--:|--:|--:|
| 0 | 400 | 4–45 | 35 | 0.0 | 36.8 | 86 |
| 1 | 400 | 45–61 | 52 | 0.5 | 0.5 | 122 |
| 2 | 400 | 61–76 | 69 | 2.5 | 0.0 | 138 |
| 3 | 400 | 76–88 | 83 | 8.0 | 0.0 | 126 |
| 4 | 400 | 88–98 | 94 | 6.5 | 0.0 | 158 |
| 5 | 400 | 98–107 | 102 | 9.0 | 0.0 | 163 |
| 6 | 400 | 107–115 | 111 | **27.2** | 0.0 | 162 |
| 7 | 400 | 115–125 | 119 | **18.5** | 0.0 | 161 |
| 8 | 400 | 125–136 | 131 | 3.5 | 0.0 | 175 |
| 9 | 400 | 136–146 | 141 | 0.0 | 0.0 | 166 |
| 10 | 400 | 146–156 | 150 | 0.2 | 0.0 | 179 |
| 11 | 400 | 156–169 | 163 | 0.2 | 0.0 | 186 |
| 12 | 400 | 169–187 | 178 | 0.0 | 0.0 | 189 |
| 13 | 400 | 187–204 | 195 | 0.0 | 0.0 | 213 |
| 14 | 400 | 204–225 | 214 | 0.0 | 0.0 | 193 |
| 15 | 400 | 225–251 | 237 | 0.0 | 0.0 | 211 |
| 16 | 400 | 251–280 | 264 | 0.0 | 0.0 | 209 |
| 17 | 400 | 280–319 | 298 | 0.0 | 0.0 | 191 |
| 18 | 400 | 319–372 | 341 | 0.0 | 0.0 | 189 |
| 19 | 400 | 372–463 | 409 | 0.0 | 0.0 | 180 |
| 20 | 400 | 463–686 | 550 | 0.0 | 0.0 | 176 |
| 21 | 267 | 688–3,245 | 902 | 0.0 | 0.0 | 107 |

Two facts a reader needs. **Bins 6–7 (107–125 tokens) are a quarter
sonnets**, and the reference curve (§3) shows it: `mattr`'s 5th percentile
jumps 0.649 → 0.704 between bins 5 and 6 and anaphora's 95th drops 0.375
→ 0.313, then both relax. That is a FORM sitting inside a length, not a
property of length, and it is why the 3-seed smoke run's holes clustered
there; at 200 seeds the smooth curves pass those bins anyway, because the
sonnet share is a quarter and the percentile is taken over the whole bin.
**Bin 0 (4–45 tokens) is 37% quatrains** and spans an order of magnitude
of N inside one bin; the curve is evaluated at each item's own N, so the
fit is not flat there, but the CHECK's resolution at the very bottom is
one bin wide. **Bin 21 is one bin from 688 to 3,245 tokens**: the curve
keeps moving with N above 688 (it is a formula), but the held-out check
above 688 is one number, so the calibrated claim up there is "the rate
over 688–3,245 is at nominal", not "at 2,000 tokens it is at nominal".

## 3. The reference curve — the drift, exact, over the whole corpus (§5.1)

Percentile per bin over all items (5th for `mattr`/`cv`, 95th for
`fwr`/anaphora). This is the number the band rule refused to look past 400
for, and it is why the bands stopped where they did.

| k | median N | `mattr` p05 | `fwr` p95 | anaphora p95 | `cv` p05 |
|--:|--:|--:|--:|--:|--:|
| 0 | 35 | 0.6429 | 0.5186 | 0.5000 | 0.0665 |
| 1 | 52 | 0.6348 | 0.5173 | 0.3777 | 0.0812 |
| 2 | 69 | 0.6674 | 0.5075 | 0.3750 | 0.0882 |
| 3 | 83 | 0.6490 | 0.5003 | 0.3848 | 0.1013 |
| 4 | 94 | 0.6651 | 0.4900 | 0.3750 | 0.1082 |
| 5 | 102 | 0.6493 | 0.4719 | 0.3750 | 0.1051 |
| 6 | 111 | 0.7037 | 0.4771 | 0.3125 | 0.0962 |
| 7 | 119 | 0.6666 | 0.4872 | 0.3571 | 0.0956 |
| 8 | 131 | 0.6821 | 0.4742 | 0.3504 | 0.0940 |
| 9 | 141 | 0.6946 | 0.4857 | 0.3342 | 0.1016 |
| 10 | 150 | 0.7007 | 0.4904 | 0.3000 | 0.1014 |
| 11 | 163 | 0.6937 | 0.4818 | 0.3333 | 0.1079 |
| 12 | 178 | 0.7059 | 0.4827 | 0.2812 | 0.1089 |
| 13 | 195 | 0.7095 | 0.4715 | 0.3044 | 0.1120 |
| 14 | 214 | 0.7240 | 0.4737 | 0.3129 | 0.1088 |
| 15 | 237 | 0.7136 | 0.4802 | 0.3333 | 0.1053 |
| 16 | 264 | 0.7222 | 0.4844 | 0.2813 | 0.1111 |
| 17 | 298 | 0.7074 | 0.4827 | 0.3126 | 0.1116 |
| 18 | 341 | 0.7249 | 0.4728 | 0.2779 | 0.1166 |
| 19 | 409 | 0.7370 | 0.4750 | 0.2669 | 0.1207 |
| 20 | 550 | 0.7345 | 0.4854 | 0.2638 | 0.1240 |
| 21 | 902 | 0.7575 | 0.4589 | 0.2290 | 0.1305 |

Read down: `mattr`'s floor climbs 0.64 → 0.76 (a 50-token moving window
over a 35-token text is plain TTR, and TTR is high on short texts only
because there is nothing to repeat); anaphora's ceiling halves, 0.50 →
0.23 (a fraction of LINES, and a 5-line item has coarse fractions); `cv`'s
floor doubles, 0.07 → 0.13; `fwr` drifts least, 0.52 → 0.46, and is the
one check C0 nearly holds. None of the four is flat, and the band rule's
sub-bin refusals were this table read one octave at a time.

## 4. The fits (§3), two starts, E3 and E4

| check | model | coefficients in x = ln N | pinball loss | iters | two-start \|Δloss\|/loss |
|---|---|---|--:|--:|--:|
| `mattr` | C0 | 0.689256 | 78.7028 | 0 | 0 |
| | C1 | 0.489163, 0.0394413 | 75.2342 | 95 | 7.4e-12 |
| | C2 | 0.367177, 0.0856208, −0.00426375 | 75.1774 | 53 | 9.6e-11 |
| `fwr` | C0 | 0.487179 | 50.8573 | 0 | 0 |
| | C1 | 0.55999, −0.0143187 | 49.9705 | 44 | 1.1e-11 |
| | C2 | 0.692763, −0.0688436, 0.0054502 | 49.7937 | 103 | 6.9e-08 |
| anaphora | C0 | 0.333333 | 111.9664 | 0 | 0 |
| | C1 | 0.717994, −0.0743198 | 101.9663 | 113 | 2.9e-13 |
| | C2 | 1.13285, −0.238372, 0.0157485 | 100.6610 | 105 | 2.5e-13 |
| `cv` | C0 | 0.101021 | 51.1894 | 0 | 0 |
| | C1 | 0.0112636, 0.0180247 | 48.7081 | 51 | 7.2e-08 |
| | C2 | −0.0314058, 0.0359349, −0.00181958 | 48.6608 | 61 | 2.4e-09 |

**E4 does not fire**: every two-start disagreement is under 1e-6 (the
largest, `fwr` C2, is 6.9e-08). **E3 is disclosed for two picks**: `fwr`
C2's parabola turns at N = 553 tokens and anaphora C2's at N = 1,935, both
inside the corpus range. Read against §3 they are the data's own shape and
not tail-fitting — `fwr`'s p95 genuinely falls to 0.47 in the 300s and
rises again at 550 before the top bin drops it; anaphora's p95 flattens
past 400 — but the rule is the rule and the adoption step may decline
either C2 for the knot curve, which also passes every bin (CK 22/22 on all
four). `mattr`'s and `cv`'s C2 turning points are outside the corpus
(22,938 and 19,428 tokens); `mattr` picked C1 anyway.

## 5. The held-out check (§4): 200 file-level 50/50 splits

Per check, bins passed of 22 (median held-out flag rate at or under the
bin's binomial upper bound U_k, about 8.0–8.6% at the ~200 held-out items
each bin carries; 9.2% in bin 21's 130):

| check | C0 | C1 | C2 | CK | pick |
|---|--:|--:|--:|--:|---|
| `mattr` | 18 | **22** | 22 | 22 | C1 |
| `fwr` | 18 | 21 | **22** | 22 | C2 |
| anaphora | 20 | 20 | **22** | 22 | C2 |
| `cv` | 19 | 21 | **22** | 22 | C2 |

Where each simpler model fails, in the instrument's own rows (median
held-out rate, [5th–95th of seeds]):

* C0 `mattr`: bins 0–3 at 8.23 [5.4–13.2], 12.50 [6.2–20.2], 9.22
  [4.2–15.9], 8.85 [4.3–13.6]; and under the lower bound at bins 16, 18,
  19, 21 (2.44, 1.75, 1.12, 0.28) — conservative there, which passes, but
  a 0.28% floor is a check that cannot see a long song.
* C0 anaphora: bin 0 at 18.28 [13.5–22.7], bin 1 at 12.09 [5.8–17.6];
  bin 21 at 0.00.
* C0 `cv`: bin 0 at 19.19 [13.7–23.3], bin 1 at 13.80, bin 7 at 8.57;
  bins 19–21 at 0.51, 0.00, 0.00.
* C0 `fwr`: bins 0–3 at 9.35, 12.22, 9.59, 8.36.
* C1 `fwr`: bin 20 (463–686) at 9.28 [5.5–14.9]; C1 anaphora: bin 0 at
  12.30 and bin 21 at 10.97 [4.9–17.5]; C1 `cv`: bin 0 at 8.31 [3.9–11.2].
  A straight line in ln N is not enough curvature for three of the four.

No bin is under-resolved for any check (no `u` mark anywhere: even at
4–45 tokens the 95th percentile of anaphora sits below the bin maximum).
The picks' per-bin medians run 2.3–7.6% with no bin over its bound; the
full rows are in the instrument's print and are not retyped here.

## 6. The shipped bands beside the picks (§5.4, E2)

Per bin inside each band, in-sample flag rate of the band's own constant
against the picked curve, all four checks (the instrument's §5.4 rows):
inside `song` the two agree within 2.1 points on every check in every bin
(the largest gap is anaphora at bin 18, 3.25 → 5.32); inside `short`
the largest is anaphora at bin 8, 3.25 → 5.54, and `cv` at bins 3–4 where
the curve is UNDER the band (3.00 → 1.87, 2.25 → 1.95).

**E2, in-sample, with the 200-seed picks declared to the rerun
(`--picks mattr=C1,fwr=C2,anaphora=C2,cv=C2`, disclosed in its print):**

| band | items (whole bins inside) | ANY, band thresholds | ANY, picked curves | difference |
|---|--:|--:|--:|--:|
| `song` 200–400 | 2,000 | 16.60% | 17.45% | +0.85 |
| `short` 50–150 | 3,200 | 14.03% | 15.78% | +1.75 |

E2 fires over +2 points; it does not fire in-sample, and `short` is close.

**E2 AS DECLARED — held-out against held-out, same 200 seeds** (the
band's thresholds re-read from each seed's calibration half INSIDE the
band, the curves from the whole calibration half, both evaluated on the
held-out items of the same whole bins; the rerun that printed it
reproduced every pick and every coefficient of the first run byte for
byte):

| band | bins | ANY, band thresholds, median [5th–95th] | ANY, picked curves | difference |
|---|---|--:|--:|--:|
| `song` 200–400 | 14–18 | 17.03% [13.57–21.80] | 17.60% [13.81–22.47] | **+0.57** |
| `short` 50–150 | 2–9 | 13.91% [9.84–20.84] | 15.42% [11.14–21.53] | **+1.51** |

E2 does not fire. The curve costs a writer inside the `song` band about
half a point of interruption rate and inside `short` a point and a half,
for coverage of the 31% of lengths the bands refuse; and the seed spread
of both columns overlaps almost entirely. (The banked band unions, 20.22%
and 16.18%, are the band cells' own held-out figures over their own item
sets and are not the rows above; `song`'s includes predictability.)

Overall held-out union of the four picked curves over the whole corpus:
**16.21% [13.09–21.25]**.

Union of the four picked curves over the whole corpus, in-sample: **16.43%
of 8,667 items** flagged by at least one check, per bin 12.0–20.5%
(lowest bin 13 at 187–204, highest bin 1 at 45–61). For scale, `short`'s
banked four-check held-out union is 16.18% and `song`'s five-check union
is 20.22%; a writer pays about the same interruption rate under the curve
as under the band, everywhere, instead of no rate at all on 31% of lengths.

## 7. What this does and does not license

* It licenses REPLACING the two lyric-sheet bands' fixed percentiles with
  the four formulas above, for `mattr`, `fwr`, anaphora and `cv`, over
  4–3,245 tokens, in a separate adoption change (preregistration §7).
  Which of C2 or CK to ship for `fwr` and anaphora is that change's call
  under E3; both pass.
* It does not touch `sonnet`, `quatrain` or `section` (out of scope, §0).
* It says nothing yet about predictability (§8).
* The rate inside a bin is at nominal; the rate at a single N inside bin
  0 or bin 21 is not separately measured, and the adoption should carry
  that in the finding text (the threshold AT THIS LENGTH beside the
  length, per §7 of the preregistration).

## 8. Stage B — predictability, PENDING

Four cold shards of `compute --shard i/4` are running at the time of this
banking; the memo's fingerprint (`ac265f6eeb09…`) matches the shipped
comparator and the 5,512-entry file on disk did not, so nothing was
reused. Measured cost on the first file: 9–15 CPU-s per item cold. The
stage B fit (five checks, 200 seeds, the same rule) is run on the merged
shard rows when they land, and its picks, E2 and union are banked here as
§9. Under E5 the four-check picks above stand with predictability ABSENT.

## 9. Stage B results and the held-out E2 — TO BE BANKED
