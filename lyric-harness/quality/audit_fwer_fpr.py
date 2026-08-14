#!/usr/bin/env python3
"""AUDIT: the time layer's "false-event rate measured at 5.4% against a
declared 5.0%", and whether its events beat a matched null at all.

THE CLAIMS UNDER AUDIT
  quality/RESULTS_FWER.md, P2:
      scrambled sonnet 1   5.2%      4   3.0%
      scrambled sonnet 2  11.7%      5   1.5%
      scrambled sonnet 3   9.7%      6   1.4%
                                    MEAN 5.4%   against a declared alpha of 5.0%
      "The within-item null delivers the rate it advertises."
  CLAUDE.md doctrine 4 carries it forward: "false-event rate measured at 5.4%
  against a declared 5.0%".
  RESULTS_FWER.md P1 table, the same instrument on REAL text at theta 0.80 /
  window 32: sonnet 1 8%, sonnet 2 11%, lyric sheet 8%, rap 13%.

  BOTH FIGURES WERE STRUCK `VOID` IN RESULTS_FWER.md ON 2026-08-11 (its P1 and
  P2 rows). They are quoted above as the claims this audit was pointed at, and
  they are NOT live comparators for anything this script prints; where they
  used to be printed beside a measured rate they are now printed marked VOID,
  because a script that prints a struck figure as current is doctrine 17 broken
  at the point of output. Read RESULTS_FWER.md's own row for this script before
  attributing any number to it.

  Two things are unchecked in the record:
   (a) the printed mean. 5.2 + 11.7 + 9.7 over 3 is 8.9%, and 3.0 + 1.5 + 1.4
       over 3 is 2.0%. Neither is 5.4%. The document says the mean is over six
       sonnets while showing three; quality/test_fwer.py runs THREE and asserts
       only `mean < 0.20`, so nothing in the repo checks the 5.4%.
   (b) the comparison that matters is not scrambled-vs-alpha, it is
       REAL-vs-SCRAMBLED on the same sonnets. If a real sonnet flags 8% of its
       slots and its own word-scramble flags 9%, the event detector has no
       discrimination and every downstream placement statistic is being
       computed on a set that is mostly noise.

CHOOSING THE RANDOMISATION
  The events are LINE-INTERNAL syllable-span matches inside a 32-syllable
  window, so the audit brief's line-internal rule applies -- but the window
  crosses line boundaries, so a within-LINE shuffle is too weak: it leaves
  every cross-line pair intact. Two nulls, bracketing the choice:

  NULL S -- WHOLE-ITEM WORD SCRAMBLE (the one RESULTS_FWER.md used).
     PRESERVES: the item's exact word multiset, hence its phonology, its
     lexicon, its OOV rate, the syllable count, and roughly the slot count.
     DESTROYS: all word order, within and across lines -- and also the line
     lengths, since test_fwer.py re-chunks into 14 equal lines.

  NULL L -- LINE PERMUTATION (tighter).
     PRESERVES: every line verbatim, hence line lengths, the stress layout
     inside each line, and every within-line span pair.
     DESTROYS: only which lines fall inside a 32-syllable window together.
  NULL L destroys strictly less than NULL S. A real effect should clear both;
  an effect that clears only S is an effect on line length.

THE ARM THIS SCRIPT RUNS, AND THE TWO COORDINATES IT DOES NOT SWEEP
  **This script is `family="candidate"`, Sidak-only.** Neither coordinate is a
  flag, neither is swept, and every call site below runs the one declaration
  built by `_tdecl()`. That declaration object is also what the header line
  PRINTS -- theta, window, correction and family are rendered off the same
  object the run uses, never off a hand-written string, so the printed
  declaration cannot drift from the arm executed (doctrine 1). Before that, the
  header named theta/window/Sidak and never named the family, which is how this
  script changed arms without changing a line.

  `--family=scored` was considered here and DECLINED, for three reasons:
   1. The scored-family arm already has a named runner --
      `python3 quality/fwer_family.py --arms` sweeps family={scored, candidate}
      over real and scrambled text and is what the record names as the source
      of those figures. A second script able to print the same struck number
      would give this repo two producers for one recorded row, which is the
      exact condition under which a record row goes wrong unnoticed.
   2. The defect stays reachable without it (doctrine 84): `family="scored"` is
      a live value of `TimeDeclaration` and the runner above exercises it, so
      declining the flag here optimises no demonstration away.
   3. This script's construction is one comparison -- real against its own
      scramble -- and a family flag changes WHICH question each invocation
      answers. The silent version of that is the failure already on the record.
  `correction=` survives as a parameter of `saturation()` because
  `TimeDeclaration` takes one, but no call site varies it and nothing on the
  command line reaches it: it is pinned at "sidak", stated here rather than
  left as an unswept knob a reader mistakes for a swept one.

Run: python3 quality/audit_fwer_fpr.py [n_sonnets] [n_replicates]
     python3 quality/audit_fwer_fpr.py --check   (0 pass / 1 moved / 2 refused)
"""

import os
import random
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))

from lyric_harness import Declaration, Lexicon                    # noqa: E402
from quality.corpus import load_sonnets                           # noqa: E402
from quality.time_layer import (TimeDeclaration, grid_index,      # noqa: E402
                                rhyme_events, syllable_stream)

SEED = 20260810
LEX = Lexicon()
DECL = Declaration()

REAL, NULL_S, NULL_L = "REAL", "NULL S", "NULL L"
ARMS = (REAL, NULL_S, NULL_L)

#: THREE COUNTS PER ARM, NEVER SUMMED AND NEVER MERGED (doctrine 79).
#: `cannot_tell` is the instrument saying no event was ATTAINABLE at this
#: family size; `refused` is doctrine 28's tripwire saying the item's own
#: inventory makes rhyme unsurprising; `answered` is an item that cleared both
#: and returned a measured rate. They are different questions with different
#: remedies -- one names the instrument, one names the item, one names neither
#: -- so a single "mute" counter that adds the first two together cannot be
#: read back into any of them. The counts are kept PER ARM because REAL,
#: NULL S and NULL L are three different populations and one pooled total
#: hides which of them was mute: on 2026-08-13 at defaults the REAL arm was
#: 18 cannot_tell / 0 refused / 2 answered, and those 2 honest zeros are
#: invisible in any total that mixes them with 800 null replicates.
#: `n` is the item count and is a check on the other three, not a fourth
#: category: an item is counted in `answered` only if neither refusal fired,
#: so the three sum to `n` unless a future branch sets both keys at once.
COUNTS = {a: {"n": 0, "cannot_tell": 0, "refused": 0, "answered": 0}
          for a in ARMS}

#: PER-ITEM DIAGNOSTICS, kept per arm, so `--check` can ask WHY an item was
#: mute and not merely THAT it was. Everything here is already computed inside
#: `rhyme_events` and handed back through its `detail` dict; until 2026-08-14
#: this script read two keys out of that dict (`cannot_tell`, `refused`) and
#: dropped the other seventeen on the floor, which is why the only thing a
#: reader could check was a rate -- and the rate is 0.0% whichever way the layer
#: is mute. See `MUTE_FOR_THE_STATED_REASON` for what is done with them.
DETAIL = {a: [] for a in ARMS}

#: The fields `rhyme_events` reports on the ATTAINABILITY path. A `refused`
#: item returns before any of them exists, which is itself a distinguishing
#: fact and is why they are read with `.get` and allowed to be None.
_DETAIL_KEYS = ("n_candidate_pairs", "n_scored", "median_family_size",
                "family_population", "min_attainable_p", "loosest_cut",
                "m_needed", "share_firable", "best_score",
                "null_strictly_above_best", "null_band_pass_rate",
                "attainable")


def _tdecl(correction="sidak"):
    """The ONE declaration this script runs, built in one place so the header
    printed by `main()` and the arm executed by `saturation()` cannot drift.

    `family` is left at `TimeDeclaration`'s own default and is PRINTED rather
    than assumed; see the module docstring for why it is not a flag.
    """
    return TimeDeclaration(theta=0.80, window=32, correction=correction)


def saturation(lines, arm, correction="sidak"):
    """test_fwer.run() verbatim: share of eligible slots flagged as events at
    theta 0.80, window 32, the ORIGINAL registered parameters.

    `arm` is bookkeeping only -- it selects which of `COUNTS`'s three ledgers
    this item's verdict is filed under and changes nothing computed.
    `correction` is pinned by every caller; it is not swept and no flag reaches
    it (module docstring, "THE ARM THIS SCRIPT RUNS").
    """
    st = syllable_stream(LEX, lines)
    gi = grid_index(st, "stress")
    slots = [i for i in range(len(st))
             if gi[i] is not None and not st[i]["line_final"]]
    t = _tdecl(correction)
    det = {}
    ev = rhyme_events(LEX, st, DECL, t, None, det)
    c = COUNTS[arm]
    c["n"] += 1
    # Counted independently, then "answered" only if NEITHER fired. Nothing
    # here adds the two refusals together.
    if det.get("cannot_tell"):
        c["cannot_tell"] += 1
    if det.get("refused"):
        c["refused"] += 1
    if not det.get("cannot_tell") and not det.get("refused"):
        c["answered"] += 1
    hits = [i for i in slots if i in ev]
    rec = {k: det.get(k) for k in _DETAIL_KEYS}
    rec.update(cannot_tell=bool(det.get("cannot_tell")),
               refused=bool(det.get("refused")),
               n_events=len(ev), n_slots=len(slots), n_syllables=len(st))
    DETAIL[arm].append(rec)
    return len(hits) / max(1, len(slots))


def scramble(lines, rng):
    """RESULTS_FWER.md's own null, from quality/test_fwer.py."""
    words = [w for l in lines for w in l.split()]
    rng.shuffle(words)
    n = max(1, len(words) // 14)
    return [" ".join(words[i * n:(i + 1) * n]) for i in range(14)]


def permute_lines(lines, rng):
    s = list(lines)
    rng.shuffle(s)
    return s


def _print_arm_counts(arm, indent="    "):
    """Doctrine 79's three counts for one arm, on one line, never summed."""
    c = COUNTS[arm]
    n = c["n"]
    share = (c["answered"] / n) if n else 0.0
    print(f"{indent}counted {n} items: cannot_tell {c['cannot_tell']}, "
          f"refused {c['refused']}, ANSWERED {c['answered']} "
          f"({share:.1%} of the arm)")


def main(n_son=20, reps=20):
    # The two ledgers are module-level and ACCUMULATE, so a second call in one
    # process would double every count. Nothing called `main` twice while it
    # returned None; `--check` reads what it returns, and a caller comparing
    # two runs is now an obvious thing to write.
    for a in ARMS:
        COUNTS[a].update(n=0, cannot_tell=0, refused=0, answered=0)
        DETAIL[a].clear()

    son = load_sonnets()
    keys = sorted(son)[:n_son]
    rng = random.Random(SEED)
    t = _tdecl()

    # Every coordinate rendered off the declaration object that is about to be
    # run, including the family -- the one this script never used to name.
    print(f"theta {t.theta:.2f}, window {t.window}, correction "
          f"'{t.correction}', family '{t.family}' -- the ORIGINAL registered "
          f"parameters RESULTS_FWER.md's P1/P2 tables use.\n")

    measured = {"n_items": len(keys), "reps": reps, "keys": list(keys),
                "theta": t.theta, "window": t.window,
                "correction": t.correction, "family": t.family,
                "alpha": t.alpha, "arms": {}}

    real = [saturation(son[k], REAL) for k in keys]
    real_mean = sum(real) / len(real)
    measured["real_mean"] = real_mean
    measured["real_max"] = max(real)
    print(f"REAL sonnets, n={len(keys)}")
    print(f"    mean event rate   {real_mean:.1%}")
    print(f"    median            {sorted(real)[len(real) // 2]:.1%}"
          f"   range {min(real):.1%}-{max(real):.1%}")
    _print_arm_counts(REAL)
    print(f"    [VOID 2026-08-11] RECORDED (P1 table): sonnet 1 8%, "
          f"sonnet 2 11%")
    print(f"    ^ struck at RESULTS_FWER.md's own P1 row. NOT a comparator "
          f"for the rate above.\n")

    for name, fn in ((f"{NULL_S}  whole-item word scramble", scramble),
                     (f"{NULL_L}  line permutation", permute_lines)):
        arm = NULL_S if fn is scramble else NULL_L
        per_item = []
        for k in keys:
            per_item.append([saturation(fn(son[k], rng), arm)
                             for _ in range(reps)])
        means = [sum(col) / len(col)
                 for col in zip(*per_item)]        # a mean per replicate
        means.sort()
        mid = means[len(means) // 2]
        beat = sum(1 for x in means if x >= real_mean)
        p = (beat + 1) / (len(means) + 1)
        floor = 1 / (len(means) + 1)
        ceiling = 1.0
        # Doctrine 68: before trusting a null, check what fraction of
        # replicates DIFFER from the observation at all.
        ties = sum(1 for x in means if abs(x - real_mean) < 1e-12)
        above = sum(1 for x in means if x > real_mean + 1e-12)
        flat = sorted(x for row in per_item for x in row)
        at_floor = abs(p - floor) < 1e-12
        at_ceiling = abs(p - ceiling) < 1e-12
        print(f"  {name}")
        print(f"    observed R_obs (real)     {real_mean:.1%}")
        print(f"    null: N={len(means)} replicates of the whole arm, "
              f"median {mid:.1%}, min {means[0]:.1%}, max {means[-1]:.1%}")
        print(f"    excess over null MEDIAN   {100 * (real_mean - mid):+.1f} pp")
        print(f"    excess over null MAX      "
              f"{100 * (real_mean - means[-1]):+.1f} pp")
        mark = ("   <- AT THE FLOOR" if at_floor else
                "   <- AT THE CEILING" if at_ceiling else "")
        print(f"    empirical p = {p:.4f}  (floor 1/(N+1) = {floor:.4f}, "
              f"ceiling = 1.0000){mark}")
        if at_floor:
            print(f"      Doctrine 57: the floor reports the RESOLUTION, not "
                  f"the effect. No replicate")
            print(f"      reached the observation; how far above it sat is "
                  f"the excess-over-MAX line")
            print(f"      and not this p. Raise N to move p off the floor.")
        if at_ceiling:
            # DOCTRINE 57'S MIRROR. A floor p reports the resolution; a
            # ceiling p reports that no replicate fell below the observation,
            # and when every replicate TIES it the randomisation returned the
            # observation itself and there was nothing to compare.
            print(f"      Doctrine 57's MIRROR: the ceiling is degenerate for "
                  f"the same reason the floor")
            print(f"      is. All {len(means)} replicate arm means are >= the "
                  f"observation, so p is pinned at 1")
            print(f"      and carries nothing about the gap -- read the "
                  f"excess-over-MEDIAN/MAX lines.")
            print(f"      Of {len(means)} replicates, {ties} TIE the "
                  f"observation exactly and {above} are strictly above it.")
            if ties == len(means):
                print(f"      EVERY REPLICATE TIED at {real_mean:.1%}. The "
                      f"null returned the observation")
                print(f"      itself, so THE COMPARISON DID NOT HAPPEN. This "
                      f"is not evidence that real")
                print(f"      text matches its own scramble; it is the "
                      f"identity-map check (doctrine 63,")
                print(f"      68) coming back positive, and p = 1.0000 must "
                      f"not be read as a null result.")
        print(f"    per-ITEM null rate: median {flat[len(flat) // 2]:.1%}, "
              f"range {flat[0]:.1%}-{flat[-1]:.1%}")
        _print_arm_counts(arm)
        print(f"    -> the declared per-position alpha is {t.alpha:.1%}.")
        print(f"       [VOID 2026-08-11] RESULTS_FWER.md's 5.4% -- struck at "
              f"its own P2 row, so there is")
        print(f"       no recorded measurement to compare this arm against.\n")
        measured["arms"][arm] = {
            "n_replicates": len(means), "ties": ties, "above": above,
            "at_ceiling": at_ceiling, "at_floor": at_floor, "p": p,
            "max": means[-1], "min": means[0],
            # The degeneracy at ITEM resolution rather than replicate
            # resolution. `ties` counts replicate MEANS, which is `reps`
            # numbers; this is every item-by-replicate rate in the arm, and it
            # is what makes a small `CHECK_REPS` honest.
            "n_item_rates": len(flat),
            "item_min": flat[0], "item_max": flat[-1]}

    # A ZERO HERE IS NOT AUTOMATICALLY AN ALPHA, AND IT IS NOT AUTOMATICALLY A
    # REFUSAL EITHER. Print the three counts beside every rate and let the
    # reader see which items had a verdict.
    tot = {k: sum(COUNTS[a][k] for a in ARMS)
           for k in ("n", "cannot_tell", "refused", "answered")}
    print(f"  COUNTS BY ARM (doctrine 79 -- three counts, reported "
          f"separately, always):")
    print(f"    {'arm':<8}{'items':>8}{'cannot_tell':>14}{'refused':>10}"
          f"{'answered':>11}")
    for a in ARMS:
        c = COUNTS[a]
        print(f"    {a:<8}{c['n']:>8}{c['cannot_tell']:>14}{c['refused']:>10}"
              f"{c['answered']:>11}")
    print(f"    {'ALL':<8}{tot['n']:>8}{tot['cannot_tell']:>14}"
          f"{tot['refused']:>10}{tot['answered']:>11}")
    if tot["n"]:
        mute = tot["cannot_tell"] + tot["refused"]
        share = tot["answered"] / tot["n"]
        print(f"    NO VERDICT: {mute} of {tot['n']} "
              f"({tot['cannot_tell']} cannot_tell + {tot['refused']} refused, "
              f"never added together -- cannot_tell")
        print(f"    names the instrument, refused names the item, and they "
              f"have different remedies).")
        print(f"    ANSWERED: {tot['answered']} of {tot['n']} ({share:.1%}) "
              f"cleared both refusals and returned a")
        print(f"    measured rate, which is a genuine measurement of the arm "
              f"it sits in.")
        # THE READING OF A 0.0% RATE DEPENDS ON THESE COUNTS AND IS PRINTED
        # ONLY IN THE BRANCH THE COUNTS SUPPORT. The line this replaced said
        # "every rate above that reads 0.0% is a REFUSAL and not an alpha"
        # unconditionally, which its own counter two lines above contradicted
        # whenever anything answered.
        if not tot["answered"]:
            print(f"    NOTHING ANSWERED ON ANY ARM, so on THIS run every "
                  f"0.0% above is a refusal end to")
            print(f"    end and none of it is an alpha (doctrine 20/28). That "
                  f"holds for this run's counts")
            print(f"    only, and is re-decided from the table above on every "
                  f"run.")
        elif not mute:
            print(f"    NOTHING WAS MUTE, so every rate above is a "
                  f"measurement end to end and a 0.0% there")
            print(f"    is an observed zero, not a refusal.")
        else:
            print(f"    So a rate above is a MIXTURE and cannot be read as "
                  f"one thing: the "
                  f"{tot['answered']} answered")
            print(f"    items and the {mute} that never had a verdict are "
                  f"averaged together, the latter")
            print(f"    entering as zeros by construction -- a refusal in the "
                  f"denominator of a rate,")
            print(f"    which is doctrine 79's own error. It is neither "
                  f"'alpha was met' nor 'every")
            print(f"    zero here is a refusal'; the split is the table "
                  f"above, per arm.")
        if mute:
            print(f"    Why the mute items are mute, and what each lever "
                  f"buys: `python3 quality/time_attainable.py`.")

    measured["counts"] = {a: dict(COUNTS[a]) for a in ARMS}
    measured["detail"] = {a: list(DETAIL[a]) for a in ARMS}
    return measured


#: `--check` RUNS THE WHOLE REPORT, at fewer replicates. Declared here rather
#: than inherited from `main`'s default, the same way `audit_time_pooled_null.py`
#: declares `CHECK_REPS`: the check reads no null MEDIAN, so replicates past the
#: point where the arm's DEGENERACY is visible buy nothing and cost 40 items
#: each. See `PINNED["null_arms"]` for what the arms are graded on.
CHECK_REPS = 2
CHECK_ITEMS = 20


# ---------------------------------------------------------------------------
# WHAT `--check` PINS, AND WHY IT CANNOT BE THE RATE
#
# THE RATE IS 0.0% AND PINNING 0.0% WOULD BE THE FAILURE THIS ARM EXISTS TO
# NAME. Doctrine 20: "inconclusive by construction" is not "null", and
# collapsing the two is a false negative dressed as a finding. A mean event
# rate of 0.0% is printed identically by
#
#     (a) an instrument that fired and measured no events            -- a NULL
#     (b) an instrument that could not fire at all                   -- MUTE
#     (c) an item whose own inventory makes rhyme unsurprising       -- REFUSED
#     (d) a band that stopped finding any rhyme relation anywhere
#     (e) a corpus that shrank to nothing
#
# and this layer is in state (b) on 18 of 20 sonnets and state (a) on the other
# 2. A `--check` that asserted `mean == 0.0%` would go green on ALL FIVE, which
# is why the pin below is on the STATE and the MECHANISM, with the rate graded
# only as a consequence of them.
#
# THE PREDICATE THAT SEPARATES (b) FROM EVERYTHING ELSE is `why_mute` and it is
# an INEQUALITY BETWEEN TWO MEASURED NUMBERS, not a remembered figure:
#
#     m_needed >= 1   and   share_firable == 0.0
#
# `m_needed` is the largest family at which the item's OWN BEST PAIR would
# still clear a Sidak cut -- `ln(1-alpha)/ln(1-min_p)` -- so `m_needed >= 1`
# says the best pair IS significant before correction, i.e. the correction is
# what silenced it. `share_firable` is the share of the item's positions whose
# family is small enough for that pair to fire, so `== 0.0` says the SMALLEST
# family in the item is still larger than `m_needed`. Together they say exactly
# "mute because the family is too large" and nothing else, and each of the
# other four states above breaks one of them:
#
#     (a) never reaches the predicate -- it is `answered`, counted separately
#     (c) `refused` fires instead, and the attainability fields do not exist
#     (d) `best_score` falls below theta, and `m_needed` goes to 0 because
#         `min_p` goes to 1.0
#     (e) `n_candidate_pairs` collapses, which makes the families SMALL --
#         muteness from the opposite end, and `share_firable` stops being 0
#
# WHAT IS DELIBERATELY NOT PINNED: `min_attainable_p`, `m_needed`'s VALUE, the
# null medians, and the empirical p. Those are Monte Carlo estimates over the
# within-item null (`null_scores`, 20,000 draws) and pinning one to three
# decimals pins a sample -- doctrine 57, and the same call
# `audit_tang_null.py`, `audit_kalevala_null.py` and `audit_time_pooled_null.py`
# all make. What IS pinned about them is a DIRECTION with a declared tolerance.
#
# MEASURED 2026-08-14 at `n_sonnets=20`, and every figure below reproduces what
# `RESULTS_FWER.md`'s own headline table records for `family="candidate"`:
# 18/20 `cannot tell`, the other 2 returning 0 events, mean saturation 0.0%.
# So there is no repin here -- the pin IS the finding, in the sense
# `audit_hafez_radif.py` means it: the layer's muteness was true by nobody
# checking, on the one arm in this repository whose headline is a NEGATIVE.
#
# Doctrine 17: if a lever ever moves these, repin with the superseded value
# visible and dated. Do NOT widen a tolerance to make a red check green -- on
# this arm a green check bought that way would be a claim that the time layer
# works.
# ---------------------------------------------------------------------------

PINNED = {
    # -- the declaration this script runs (doctrine 1). The header prints
    #    these off the same object `saturation()` runs; pinning them here is
    #    what stops the arm changing without a line changing, which is the
    #    defect RESULTS_FWER.md records against this file on 2026-08-13.
    "theta": 0.80, "window": 32, "correction": "sidak",
    "family": "candidate", "alpha": 0.05,

    # -- EXACT over a fixed corpus. `n_candidate_pairs` and
    #    `median_family_size` are pure functions of the syllable stream: no
    #    draw enters either, so they are pinnable to the integer.
    "n_items": CHECK_ITEMS,
    #    (min, max) of the candidate-pair count over the 20 items. The record's
    #    own row for sonnets 1-8 is 6.2k-9.8k, which this straddles.
    "candidate_pairs": (5519, 9778),
    #    (min, median, max) of each item's MEDIAN family size. The min and max
    #    are RESULTS_FWER.md's own published "156-282 across 24 sonnets", to
    #    the integer, and doctrine 4 in CLAUDE.md carries the same pair. The
    #    203 both documents also quote is SONNET 1's median family, which is
    #    item 0 here; 198 is the median OVER the twenty per-item medians and is
    #    a different statistic of the same measurement (doctrine 91).
    "median_family": (156, 198, 282),

    # -- DOCTRINE 28, MECHANICALLY. Three states on the REAL arm, pinned as
    #    THREE NUMBERS. They are never summed and no pin below reads their
    #    total: an 18/0/2 that becomes 20/0/0 leaves every "mute" total and
    #    every printed rate untouched and IS a different finding.
    "real_cannot_tell": 18,
    "real_refused": 0,
    "real_answered": 2,
    #    ... and what the 2 answered items are: an OBSERVED ZERO, which is the
    #    "none" half of doctrine 28. `attainable` True, `n_events` 0.
    "real_answered_events": 0,

    # -- the null arms. Counts scale with `reps`, so these are SHARES with
    #    declared floors, not pins. `ties` is the degeneracy, and it is pinned
    #    HARD: see `check`.
    "null_arms": (NULL_S, NULL_L),
}

#: DECLARED TOLERANCES for the three Monte-Carlo-fed clauses. Set to pass at
#: every value measured on 2026-08-14 with room to spare, and to fail on a
#: change of KIND rather than a change of draw. They are not tuned: each is a
#: round number an order of magnitude away from the measurement it guards.
MIN_CANDIDATE_PAIRS = 3000   #: measured 5,519-9,778 over the twenty items
MIN_M_NEEDED = 1             #: measured 11-37. 0 means "no evidence at all"
MIN_FAMILY_GAP = 3.0         #: median_family / m_needed; measured 5.5x-21.3x
MIN_NULL_CANNOT_TELL = 0.50  #: share of a null arm's items; measured 82%-85%


def why_mute(rec, theta):
    """-> None if this item is mute FOR THE RECORDED REASON, else a string
    naming the clause that failed -- which names a DIFFERENT muteness.

    An item that is not mute at all also returns None; `check` grades those
    through the `answered` counters instead, so this function never has to
    decide whether speaking is good news.
    """
    if rec["refused"]:
        return ("INVENTORY -- doctrine 28's band-pass tripwire fired, so the "
                "item's own inventory makes rhyme unsurprising. That is a fact "
                "about the ITEM; the recorded muteness is a fact about the "
                "INSTRUMENT, and they have different remedies")
    if not rec["cannot_tell"]:
        return None
    if rec["family_population"] != PINNED["family"]:
        return (f"FAMILY POPULATION -- m was counted over "
                f"{rec['family_population']!r}, not "
                f"{PINNED['family']!r}. The scored family is the shipped "
                f"defect and its muteness would be a different one")
    if (rec["n_candidate_pairs"] or 0) < MIN_CANDIDATE_PAIRS:
        return (f"NO COMPARISONS -- {rec['n_candidate_pairs']} candidate pairs, "
                f"under {MIN_CANDIDATE_PAIRS}. A family cannot be too large "
                f"when barely anything was compared; this is muteness from the "
                f"opposite end")
    if rec["best_score"] is None or rec["best_score"] < theta:
        return (f"BAND DEAD -- the best pair in this item scores "
                f"{rec['best_score']}, under theta {theta}. The item contains "
                f"no band-passing rhyme at all, so 'no event was attainable' "
                f"is a statement about the BAND and not about the family")
    if (rec["m_needed"] or 0) < MIN_M_NEEDED:
        return (f"NO EVIDENCE PRE-CORRECTION -- m_needed {rec['m_needed']}, so "
                f"the item's best pair does not reach alpha even UNCORRECTED. "
                f"The correction is then not what silenced it")
    if rec["share_firable"] != 0.0:
        return (f"A POSITION COULD FIRE -- share_firable "
                f"{rec['share_firable']}, so the smallest family in this item "
                f"is NOT larger than m_needed and 'the family is too large' is "
                f"not what happened here")
    if rec["median_family_size"] < MIN_FAMILY_GAP * rec["m_needed"]:
        return (f"GAP COLLAPSED -- median family {rec['median_family_size']} "
                f"against m_needed {rec['m_needed']}, a factor of "
                f"{rec['median_family_size'] / max(1, rec['m_needed']):.1f} "
                f"and under the declared {MIN_FAMILY_GAP}. The two numbers "
                f"have converged, so the recorded ~10x gap is not the "
                f"mechanism any more")
    return None


def _corpus_refusal(n_son):
    """-> a refusal string, or None. Doctrine 20 applied to the checker itself:
    a check that could not be run is neither a pass nor a failure, so it exits
    2 rather than picking one."""
    path = os.path.join(HERE, "..", "corpus", "sonnets.txt")
    if not os.path.exists(path):
        return (f"corpus/sonnets.txt is absent ({os.path.relpath(path, HERE)}). "
                f"Every count below is exact over that file and over nothing "
                f"else")
    try:
        son = load_sonnets(path)
    except Exception as exc:                                 # noqa: BLE001
        return f"corpus/sonnets.txt does not parse: {exc!r}"
    if len(son) < n_son:
        return (f"corpus/sonnets.txt parses {len(son)} sonnets and this check "
                f"grades the first {n_son}. The pins are about a corpus that "
                f"is not the one on disk; repin rather than grade a mixture")
    return None


def check(m):
    """-> exit code. 0 pass, 1 moved, 2 REFUSED. FAILS LOUDLY either way."""
    print()
    print("=" * 74)
    print("CHECK -- the time layer is still MUTE, and still for the recorded "
          "reason")
    print("=" * 74)
    bad = 0

    # -- the declaration (doctrine 1) ---------------------------------------
    print("  the arm, off the declaration the run executed:")
    for k in ("theta", "window", "correction", "family", "alpha"):
        ok = m[k] == PINNED[k]
        bad += not ok
        print(f"  [{'ok  ' if ok else 'FAIL'}] {k:22s} committed "
              f"{PINNED[k]!r}" + ("" if ok else f", measured {m[k]!r}"))

    # -- the comparisons made, EXACT over a fixed corpus ---------------------
    real = m["detail"][REAL]
    ok = m["n_items"] == PINNED["n_items"]
    bad += not ok
    print(f"  [{'ok  ' if ok else 'FAIL'}] {'n_items':22s} committed "
          f"{PINNED['n_items']}" + ("" if ok else f", measured {m['n_items']}"))
    cp = sorted(r["n_candidate_pairs"] for r in real
                if r["n_candidate_pairs"] is not None)
    mf = sorted(r["median_family_size"] for r in real
                if r["median_family_size"] is not None)
    print()
    print("  the family, MEASURED not recalled (doctrine 58) -- exact over a "
          "fixed corpus,")
    print("  no draw enters either number:")
    for label, got, want in (("candidate pairs",
                              (cp[0], cp[-1]) if cp else None,
                              PINNED["candidate_pairs"]),
                             ("median family size",
                              (mf[0], mf[len(mf) // 2], mf[-1]) if mf else None,
                              PINNED["median_family"])):
        ok = got == want
        bad += not ok
        print(f"  [{'ok  ' if ok else 'FAIL'}] {label:22s} committed {want}"
              + ("" if ok else f", measured {got}"))

    # -- DOCTRINE 28, three states, never summed ----------------------------
    c = m["counts"][REAL]
    print()
    print("  doctrine 28 -- 'none' and 'cannot tell' are two states, counted "
          "apart and")
    print("  NEVER summed. No pin here reads their total:")
    for key, pin in (("cannot_tell", "real_cannot_tell"),
                     ("refused", "real_refused"),
                     ("answered", "real_answered")):
        ok = c[key] == PINNED[pin]
        bad += not ok
        print(f"  [{'ok  ' if ok else 'FAIL'}] REAL {key:17s} committed "
              f"{PINNED[pin]}" + ("" if ok else f", measured {c[key]}"))
    # The `answered` items are the "none" half and have to BE a none: a
    # measured zero, from an item where an event was attainable.
    ans = [r for r in real if not r["cannot_tell"] and not r["refused"]]
    ev = sum(r["n_events"] for r in ans)
    # `len(ans)` is re-asserted here and not left to the `answered` row above:
    # without it `all(...)` and `sum(...)` are both VACUOUSLY true over an
    # empty list, so this row printed `ok` on a run where nothing answered at
    # all -- a green line saying "an observed zero, not a refusal" underneath
    # a table reporting 20 refusals. Found 2026-08-14 by reading the output of
    # the muteness mutation rather than its exit code.
    ok = (len(ans) == PINNED["real_answered"]
          and ev == PINNED["real_answered_events"]
          and all(r["attainable"] for r in ans))
    bad += not ok
    print(f"  [{'ok  ' if ok else 'FAIL'}] {'answered = OBSERVED':22s} "
          f"{len(ans)} item(s) (committed {PINNED['real_answered']}), "
          f"{sum(1 for r in ans if r['attainable'])} attainable, {ev} events "
          f"-- an observed zero, not a refusal")

    # -- THE MUTENESS PREDICATE ---------------------------------------------
    print()
    print("  THE PREDICATE -- every `cannot tell` item mute because ITS FAMILY "
          "IS TOO LARGE:")
    print("    m_needed >= 1 (the best pair IS significant uncorrected)  AND")
    print("    share_firable == 0.0 (no position's family is small enough for "
          "it to fire)")
    reasons = {}
    for r in real:
        why = why_mute(r, m["theta"])
        if why:
            reasons.setdefault(why.split(" -- ")[0], []).append(r)
    mute_items = [r for r in real if r["cannot_tell"] or r["refused"]]
    ok = not reasons
    bad += not ok
    good = len(mute_items) - sum(len(v) for v in reasons.values())
    print(f"  [{'ok  ' if ok else 'FAIL'}] {good} of {len(mute_items)} mute "
          f"items are mute FOR THE RECORDED REASON")
    for head, rows in sorted(reasons.items()):
        print(f"         {len(rows)} item(s): "
              f"{why_mute(rows[0], m['theta'])}")
    gaps = [r["median_family_size"] / r["m_needed"] for r in real
            if r["cannot_tell"] and r.get("m_needed")]
    if gaps:
        gaps.sort()
        print(f"         the gap itself, NOT pinned to a value (doctrine 57 -- "
              f"m_needed is fed")
        print(f"         by a Monte Carlo null): median family / m_needed = "
              f"{gaps[0]:.1f}x-{gaps[-1]:.1f}x, "
              f"floor {MIN_FAMILY_GAP:.0f}x")

    # -- the null arms -------------------------------------------------------
    print()
    print("  the two null arms. The COMPARISON is degenerate and that is the "
          "thing pinned:")
    for a in PINNED["null_arms"]:
        arm, ca = m["arms"][a], m["counts"][a]
        okd = arm["ties"] == arm["n_replicates"] and arm["at_ceiling"]
        bad += not okd
        print(f"  [{'ok  ' if okd else 'FAIL'}] {a:8s} all "
              f"{arm['n_replicates']} replicate arm means TIE the observation "
              f"({arm['ties']} tie, {arm['above']} above)")
        oki = arm["item_max"] == m["real_max"] == 0.0
        bad += not oki
        print(f"  [{'ok  ' if oki else 'FAIL'}] {a:8s} and so does every one "
              f"of its {arm['n_item_rates']} item rates "
              f"(range {arm['item_min']:.1%}-{arm['item_max']:.1%})")
        share = ca["cannot_tell"] / ca["n"] if ca["n"] else 0.0
        oks = share >= MIN_NULL_CANNOT_TELL
        bad += not oks
        print(f"  [{'ok  ' if oks else 'FAIL'}] {a:8s} cannot_tell "
              f"{ca['cannot_tell']}/{ca['n']} = {share:.1%} "
              f"(floor {MIN_NULL_CANNOT_TELL:.0%}), refused {ca['refused']}, "
              f"answered {ca['answered']}")
    print("         p = 1.0000 at the ceiling is NOT read as a null here: "
          "every replicate")
    print("         returned the observation itself, so the comparison did not "
          "happen")
    print("         (doctrine 63/68's identity-map check, coming back "
          "positive).")

    if bad:
        print()
        print(f"  {bad} figure(s) moved. Read WHICH before repinning -- on "
              f"this arm the")
        print("  headline is a NEGATIVE, so a check that goes green after a "
              "widened")
        print("  tolerance is a claim that the time layer works. If the "
              "PREDICATE line")
        print("  failed, the layer is still mute and is mute for a DIFFERENT "
              "reason: that")
        print("  is a new finding and needs a new row in RESULTS_FWER.md, not "
              "a repin.")
        print("  Doctrine 17: keep the superseded value visible and dated.")
    print()
    print("RESULT:", "PASS" if not bad else "FAIL")
    return 0 if not bad else 1


if __name__ == "__main__":
    argv = [a for a in sys.argv[1:] if a != "--check"]
    if "--check" in sys.argv:
        if argv:
            raise SystemExit(f"unknown arguments: {argv}\n"
                             f"usage: audit_fwer_fpr.py --check")
        _refusal = _corpus_refusal(CHECK_ITEMS)
        if _refusal:
            print()
            print("=" * 74)
            print("CHECK -- the time layer is still MUTE, and still for the "
                  "recorded reason")
            print("=" * 74)
            print(f"  REFUSED -- {_refusal}.")
            print()
            print("RESULT: REFUSED (not a pass, not a failure -- doctrine 20)")
            sys.exit(2)
        sys.exit(check(main(CHECK_ITEMS, CHECK_REPS)))
    a = int(sys.argv[1]) if len(sys.argv) > 1 else 20
    b = int(sys.argv[2]) if len(sys.argv) > 2 else 20
    main(a, b)
