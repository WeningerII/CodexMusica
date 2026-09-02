# Results: the SHORT-SONG floor profile — ADOPTED 2026-09-01, four checks

> Pre-registration: `quality/SHORT_SONG_FLOOR_PREREGISTRATION.md`. Instrument:
> `python3 quality/song_profile_calibration.py --profile short` (stage B,
> with predictability) and `--profile short --check --without-predictability`
> (stage A, the four-check drift check, ~135 CPU-s cold). Every figure below
> is the stage A run's own print, 2026-09-01, corpus at `580499a`+ (8,667
> `--- TITLE:` items over 1,297 files). `MISSING.md` M-193 is the entry.

## 1. The band, from the rule declared before the answer was read

The rule is the `song` profile's, unchanged (`band_ok` / `pick_band`), over
edges 50..200. It returns **50–150 tokens: 3,703 items, 690 authors**. The
candidates, each refused by a NAMED sub-bin:

| candidate | n | verdict |
|---|---:|---|
| 50–100 | 1601 | OK |
| **50–150** | **3703** | **OK — widest** |
| 50–200 | 5002 | no — sub-bin 50–100 `mattr` 0.6485 vs band 0.6747, \|d\| 0.0262 > 0.02 |
| 100–150 | 2145 | OK |
| 100–200 | 3444 | no — sub-bin 150–200 anaphora 0.3000 vs band 0.3333, \|d\| 0.0333 > 0.03 |
| 150–200 | 1336 | OK — clears ALONE, excluded by clause (iii) |

**150–200 is a fact worth its own line.** It clears the rule by itself and
is excluded only because 50–150 is wider. It is not covered by this profile
and not by `song` (200–400): a 150–199-token sheet is served INEXACT by
whichever band's edge is nearer (`declaration_for`'s rule), as it was
before. A third lyric-sheet profile at 150–200 under the same rule is the
follow-up this leaves open, and the band rule's clause (iii) — widest wins
— is the reason it is not adopted here.

The drift the rule is refusing, 5th/95th by token bin (n, `mattr` p05,
`fwr` p95, anaphora p95, `cv` p05): 50–80 (798) 0.6442 / 0.5088 / 0.3869 /
0.0841; 80–110 (1212) 0.6538 / 0.4902 / 0.3750 / 0.1051; 110–150 (1656)
0.6867 / 0.4854 / 0.3333 / 0.0971; 150–200 (1314) 0.6994 / 0.4766 / 0.3000
/ 0.1072. The `mattr` low tail climbs 0.055 across 50–200 tokens — the
same doctrine-15 drift the `song` band was cut against, one octave down.

## 2. The thresholds and their held-out false-positive rate (doctrine 22)

Band 50–150, 3,703 items, 690 authors. Shipped (5th/95th percentile of the
whole band): **mattr 0.6682 · fwr 0.4940 · anaphora 0.3750 · cv 0.0960**.

AUTHOR-held out, 200 seeds, 50% held out (the honest split):

| check | median | 5th–95th of seeds | min–max |
|---|---:|---|---|
| mattr | 5.30% | 2.06–9.87% | 0.87–13.22% |
| fwr | 5.06% | 2.77–8.44% | 2.02–10.67% |
| anaphora | 3.71% | 3.02–7.43% | 2.70–8.27% |
| cv | 4.99% | 3.36–7.27% | 2.43–8.48% |
| **ANY** | **16.18%** | **11.09–22.23%** | 9.35–28.17% |
| cliche (not in ANY) | 4.02% | 3.37–4.72% | 2.96–5.34% |

Item-held out (the wrong split, priced): ANY 15.43% [13.91–17.64]. The
splits agree on the median and disagree on the spread by about two, which
is doctrine 13's price stated as before. `CLICHE_PAIR`'s point estimate is
148/3703 = **4.00%** — lower than the `song` band's 7.70%, for the reason
that entry gives in reverse: shorter sheets carry fewer pairs.

Author concentration: median items per author 1; top five 35.4% of the band
(Watts 421, Herrick 348, Burns 262, Durfey 171, Hemans). Leave-one-author-out
moves the thresholds by at most 0.0115 (mattr), 0.0026 (fwr), 0.0000
(anaphora), 0.0020 (cv). Author-weighted alternative (one median per author,
n=690): 0.6893 / 0.4882 / 0.3559 / 0.1011. Item-weighted ships because the
rate the gate delivers is an item rate.

**E2 (union > 30%) did not fire**: 16.18% is BELOW the `song` profile's
20.22%.

## 3. The tolerance — and it runs the OTHER way here

| factor | applied | mattr | fwr | anaphora | cv | ANY |
|---|---|---:|---:|---:|---:|---:|
| 1.00 | 50–150 | 5.30% | 5.06% | 3.71% | 4.99% | 16.18% |
| 1.10 | 45–165 | 5.36% | 4.92% | 3.63% | 4.76% | 15.76% |
| 1.25 | 40–187 | 5.20% | 4.55% | 3.48% | 4.73% | 15.19% |
| 1.50 | 33–225 | 4.64% | 4.27% | 3.32% | 4.55% | 14.22% |
| 2.00 | 25–300 | 4.15% | 4.10% | 3.40% | 4.47% | 13.62% |
| 3.00 | 16–450 | 3.72% | 3.92% | 3.26% | 4.11% | 12.69% |

The union FALLS monotonically with the factor: a floor calibrated on short
sheets fires less on the longer items a wider reach admits, because its
`mattr` floor is the lowest of the three lyric-sheet profiles. So the
preregistration's tolerance rule (§3: "the multiplier at which the union
first rises more than one point") has no answer, and the row DECLARES 1.25
to match the `song` profile's, so the two reaches meet (40–187 against
160–500) and the nearest-measured-edge rule decides between them. **The
runner's own sentence was wrong for this band** — it printed *"every check
gets worse monotonically"* as a literal — and it reads the table now.

## 4. Period (doctrine 11), inside the provenance gate

381 of 690 authors carry printed dates; 309 are UNDATED and dropped from
this check alone. 4a, author-level Spearman against birth year, Bonferroni
over four checks at 0.0125: **mattr rho −0.226 (p_perm 0.0001), fwr +0.143
(0.0052), anaphora +0.164 (0.0022) SURVIVE; cv +0.107 (0.0394) does not.**
4b, cross-cohort transfer at median birth year 1800 (EARLY 191 authors /
2,269 items, LATE 190 / 747): EARLY→LATE union **26.10%** against a null
median 16.15% [11.67–23.37], p 0.0075, anaphora surviving at p 0.0005;
LATE→EARLY 10.84% against 15.37%, p 0.9090. Thresholds fitted on
earlier-born authors over-flag later-born ones and the reverse runs at or
below the null.

This is a STRONGER period reading than the `song` band's (where only
`mattr` survives), on a subsample of the same character (45% undated, not
missing at random), and it is recorded and NOT adopted as a caution, for the
reason `RESULTS_SONG_FLOOR.md` §4·R gives (doctrine 20). The row's note
says which way the band leans.

## 5. What ships, and what the drift check judges

`quality/floor.py` `PROFILES` gains `short` (n_lines 0, n_human 3703,
n_generated 0, tolerance 1.25, four percentiles, six FPR tuples, the period
constants +0.164 / 0.0022 pinned in the runner's `PROFILE_PERIOD`).
`song_profile_calibration.py --profile short --check
--without-predictability` re-derives every one of them EXACTLY: asked 20,
answered 15, refused 5 — the five predictability constants, by name. The
`--profile song` path is byte-identical to the runner before the flag
existed (its `--check --without-predictability` run in the same sitting is
the control).

Three runner sites were song-only literals and are per-profile now: the
period pins, the struck-rho gate (`song` must keep +0.275 legible; `short`
has struck nothing), and the MATTR-window admissibility, repinned from `>`
to `>=` because a text of exactly `window` tokens is ONE window and its
moving average IS its TTR — asserted numerically in the check, not argued.

## 6. What the profile changes downstream

* **The tie-break** (preregistration §4): `declaration_for(n_tokens,
  n_lines)` prefers a profile whose calibrated `n_lines` is the text's,
  then a lyric sheet, then list order; the gate passes `len(lines)`. A
  14-line 118-token text is a sonnet; a 20-line one is a lyric sheet;
  a caller passing no count gets list order byte for byte. `test_floor.py`
  §26.
* **Coverage**: over 1–699 tokens the floor can FLAG at **44.5%** of
  lengths (~~32.8%~~) and reaches no profile at **30.3%, unmoved** — the
  band's reach sits inside what the section and song bands already
  reached, so lengths moved from "note" to "flag" and none from "nothing".
* **The planner's envelope**: `plan.song_line_counts()` unions every
  `n_lines == 0` profile by construction, so the gradeable set is
  `{6..20} | {22..55}` (one hole at 21, the seam between the bands). What
  the planner VOLUNTEERS is `fillable_line_counts()` — that set restricted
  to totals whose stanza-sized cell ceiling holds the form's own minimum
  section count (verse once, chorus twice: 3, derived from
  `FORM_REQUIRES` and `FORM_RECURS`) — so `ENVELOPE["total_lines"]` is
  **(12, 55)**, 43 values, and a total the pattern draw would reject on
  every attempt is never drawn. `test_plan.py` §14.
* **What did NOT move**: no threshold of any other profile, no recorded
  verdict on a text the `song` or `section` band covers.

## 7. Stage B

`--profile short` with predictability (items ≤ 200 tokens only) was
launched in the adopting sitting; the fifth threshold joins the row when it
completes and re-derives, and the band is re-picked on five checks then. If
five-check homogeneity fails at 50–150, the four-check adoption stands with
the refusal recorded beside it, per the preregistration §2.
