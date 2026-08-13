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
    son = load_sonnets()
    keys = sorted(son)[:n_son]
    rng = random.Random(SEED)
    t = _tdecl()

    # Every coordinate rendered off the declaration object that is about to be
    # run, including the family -- the one this script never used to name.
    print(f"theta {t.theta:.2f}, window {t.window}, correction "
          f"'{t.correction}', family '{t.family}' -- the ORIGINAL registered "
          f"parameters RESULTS_FWER.md's P1/P2 tables use.\n")

    real = [saturation(son[k], REAL) for k in keys]
    real_mean = sum(real) / len(real)
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


if __name__ == "__main__":
    a = int(sys.argv[1]) if len(sys.argv) > 1 else 20
    b = int(sys.argv[2]) if len(sys.argv) > 2 else 20
    main(a, b)
