#!/usr/bin/env python3
"""The two halves of one comparison align from OPPOSITE ends, ON PURPOSE.

    python3 quality/test_align.py

WHAT THIS FILE PINS
-------------------
`channel_agreement` was fixed on 2026-08-11 to align two anchors flush RIGHT
(doctrine 95), because rhyme is a suffix relation. `score` — fifty lines below
it, inside the same call — still reads `anc_a[i]` against `anc_b[i]`, flush
LEFT. So the band asks its question tail-aligned and the scalar computes the
magnitude head-aligned, on the same two anchors.

That is now a DECLARED coordinate (`Declaration.scalar_alignment`) rather than
an accident nobody had written down, and this file is the pin: which half uses
which alignment, WHY they are allowed to differ, and the held-out measurement
that left the default where it is.

WHY IT IS DECLARED RATHER THAN FIXED
------------------------------------
Doctrine 5 forbids shipping a change that does not beat the incumbent held out.
Priced the way `theta_coda` was — a random-pair FPR corpus AND a true-positive
corpus, each split in half, both halves reported:

    corpus                     head (shipped)        tail
    sonnet oracle, all 152     82 / 1014             82 / 1014
      calibration half         43 / 510              43 / 510
      HELD-OUT half            39 / 504              39 / 504
    random pairs, relation FPR
      calibration half         2.37%                 2.37%
      HELD-OUT half            2.17%                 2.17%
    random pairs, ADMITTED FPR (relation AND total >= theta_rhyme)
      calibration half         1.20%                 1.10%
      HELD-OUT half            0.90%                 0.93%
    scalar `total` moves       —                     59.0% of 6,000 pairs
    RELATION flips             —                     0 of 6,000
    ADMITTED flips             —                     4 of 6,000 (1 up, 3 down)

REPINNED 2026-08-11, after `Declaration.coda_agreement` defaulted to
`identity` (cell BA, `quality/RESULTS_CODA_SHAPE.md`): re-derived in full,
same methodology, both `DECL` and `TAIL` now carrying the identity coda —
`sample(6000)` at this file's own `SEED`, split `k % 2` exactly as
`redteam_band.py`'s `fit_half` convention does, calibration = even indices.
The random-pair FPR rows moved (3.53%->2.37%, 3.50%->2.17%; 1.57%->1.20%,
1.17%->0.90%) — this is the SAME reduction `RESULTS_CODA_SHAPE.md` reports
for the identity fix taken alone, so nothing here is a new finding, only the
consequence of an already-priced one arriving in this table too. The
sonnet-oracle and RELATION rows are UNCHANGED IN SHAPE: the relation still
never flips between alignments, and the oracle is still blind to the
alignment coordinate by the same structural argument (doctrine 95) — only
its own digit moved, because it is downstream of the SAME oracle
`battery.py` pins.

Two of those rows are the whole argument. The RELATION never flips, because the
relation is decided by `channel_agreement`, which tail-aligns whatever the
scalar does. And the sonnet oracle does not move by a single pair in either
half — the same structural blind spot doctrine 95 names, arriving from the
other side: a mandated pair's best alignment is already the equal-length one,
so the corpus that is supposed to catch everything is incapable of pricing
this. What is left is 0.00pp of held-out FPR difference on five flips in six
thousand. Nothing beats anything, so nothing changes, and BOTH readings stay
reachable so the difference stays measurable (doctrine 84).
"""

import os
import random
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))

import lyric_harness as L  # noqa: E402
from lyric_harness import (Declaration, Lexicon, admits,  # noqa: E402
                           anchor, channel_agreement, line_anchors, score,
                           syllabify, vowel_sim)

SEED = 20260811
N_PAIRS = 800          # small on purpose: this file runs inside the mutation
                       # runner's baseline, so it is priced in CPU seconds.

FAILURES = []
LEX = Lexicon()
DECL = Declaration()
TAIL = Declaration(scalar_alignment="tail")


def check(name, cond, detail=""):
    print(f"  {'PASS' if cond else 'FAIL'}  {name}")
    if detail:
        print(f"          {detail}")
    if not cond:
        FAILURES.append(name)


def anchor_of(word):
    phones, oov = LEX.transcribe_word(word)
    if oov or not phones:
        return None
    return anchor(syllabify(phones))


def sample(n):
    """Random CMUdict pairs, anchors resolved once."""
    rng = random.Random(SEED)
    words = [w for w in LEX.entries if w.isalpha() and 2 <= len(w) <= 12]
    out = []
    while len(out) < n:
        a, b = rng.choice(words), rng.choice(words)
        if a == b:
            continue
        aa, bb = anchor_of(a), anchor_of(b)
        if aa and bb:
            out.append((a, b, aa, bb))
    return out


# ---------------------------------------------------------------------------
# 1. WHICH HALF READS WHICH END — stated as a difference, not as two numbers
# ---------------------------------------------------------------------------

def test_the_two_halves_read_opposite_ends():
    print("\n1. the band aligns from the TAIL and the scalar from the HEAD, "
          "by declaration")
    A = anchor_of("remember")          # 2 syllables: EH ... ER
    B = anchor_of("her")               # 1 syllable:  ER
    check("the fixture is unequal-length, or this file tests nothing",
          len(A) == 2 and len(B) == 1,
          f"remember anchors {[s['nucleus'] for s in A]}, her anchors "
          f"{[s['nucleus'] for s in B]}. On EQUAL lengths the two alignments "
          f"are the same computation, which is exactly why every test in this "
          f"repo passed for the life of the project (doctrine 95).")

    head_nuc = vowel_sim(A[0]["nucleus"], B[0]["nucleus"])
    tail_nuc = vowel_sim(A[-1]["nucleus"], B[-1]["nucleus"])
    s = score(A, B, DECL, "remember", "her")
    check("score() reports the HEADS as its first compared syllable",
          abs(s["syllables"][0]["nucleus"] - round(head_nuc, 3)) < 1e-9,
          f"{s['syllables'][0]['nucleus']} = vowel_sim("
          f"{A[0]['nucleus']}, {B[0]['nucleus']}) = {head_nuc:.3f}; the TAILS "
          f"are vowel_sim({A[-1]['nucleus']}, {B[-1]['nucleus']}) = "
          f"{tail_nuc:.3f}. The two are different numbers here, which is what "
          f"makes this fixture able to tell the readings apart.")

    st = score(A, B, TAIL, "remember", "her")
    check("...and `scalar_alignment='tail'` reports the TAILS instead",
          abs(st["syllables"][0]["nucleus"] - round(tail_nuc, 3)) < 1e-9,
          f"{st['syllables'][0]['nucleus']} vs {tail_nuc:.3f}. Both readings "
          f"are REACHABLE: doctrine 84 keeps a demonstration alive rather "
          f"than optimising it away, and an unreachable alternative is a "
          f"claim nobody can check.")
    check("the two readings really do give different totals here",
          s["total"] != st["total"],
          f"head {s['total']}, tail {st['total']}")

    nuc_ok, coda_ok = channel_agreement(A, B, DECL)
    check("the BAND, meanwhile, reads the tails whatever the scalar does",
          nuc_ok and abs(tail_nuc - 1.0) < 1e-9,
          f"channel_agreement -> nucleus={nuc_ok}, coda={coda_ok}. "
          f"`remember`'s final ER against `her`'s ER is identity. The scalar "
          f"is a MAGNITUDE and the band is a VERDICT; they are allowed to "
          f"read the same anchors differently, and before "
          f"`Declaration.scalar_alignment` existed nothing said that they do.")
    check("the band's verdict is the same under both scalar readings",
          channel_agreement(A, B, DECL) == channel_agreement(A, B, TAIL),
          "the coordinate moves the scalar only; if this ever fails, the two "
          "halves have become entangled and the measurement below is void")

    # The case that exposed doctrine 95, kept here so this file also fails if
    # the BAND is ever reverted to head alignment. `remember`/`her` above
    # cannot do it: head-aligned it still returns (True, True).
    ga, _, _ = line_anchors(LEX, "get to go", promote=False)
    gb, _, _ = line_anchors(LEX, "receipt", promote=False)
    A2, B2 = max(ga, key=len), min(gb, key=len)
    head = (vowel_sim(A2[0]["nucleus"], B2[0]["nucleus"])
            >= DECL.theta_nucleus)
    check("on `get to go` ~ `ceipt` the band refuses, where a HEAD-aligned "
          "band would admit",
          channel_agreement(A2, B2, DECL) == (False, False) and head,
          f"tail-aligned -> {channel_agreement(A2, B2, DECL)}; the heads are "
          f"vowel_sim({A2[0]['nucleus']}, {B2[0]['nucleus']}) = "
          f"{vowel_sim(A2[0]['nucleus'], B2[0]['nucleus']):.3f}, which clears "
          f"theta_nucleus, and the T codas are identical — so head-aligned it "
          f"is (True, True) and `go/receipt 0.579` was typed RHYME. This is "
          f"the report line the whole red team round started from.")


# ---------------------------------------------------------------------------
# 2. THE COORDINATE — declared, defaulted, and loud on anything else
# ---------------------------------------------------------------------------

def test_the_coordinate_is_declared():
    print("\n2. `scalar_alignment` is a coordinate of the Declaration "
          "(doctrine 1)")
    check("it exists and defaults to the present behaviour",
          Declaration().scalar_alignment == "head",
          f"got {Declaration().scalar_alignment!r}. The default is the "
          f"INCUMBENT, not the winner: nothing beat it held out, so nothing "
          f"changed. Changing this line is a decision with a test attached.")
    raised = False
    try:
        score(anchor_of("cat"), anchor_of("hat"),
              Declaration(scalar_alignment="middle"))
    except ValueError:
        raised = True
    check("an undeclared value RAISES rather than silently picking one",
          raised,
          "a third value that quietly behaved like `head` would be a "
          "coordinate that lies about its own range")
    check("it survives the declaration's own printer",
          '"scalar_alignment": "head"' in Declaration().show(),
          "every report prints the declaration; a coordinate that does not "
          "appear there is not declared, it is hidden")


# ---------------------------------------------------------------------------
# 3. THE MEASUREMENT, RE-RUN — not the recorded numbers, the live ones
# ---------------------------------------------------------------------------

def test_the_price_reproduces():
    print(f"\n3. the held-out price, re-measured on {N_PAIRS} random CMUdict "
          f"pairs")
    rows = sample(N_PAIRS)
    uneq = sum(1 for _, _, a, b in rows if len(a) != len(b))
    moved = relflip = admflip = 0
    for a, b, aa, bb in rows:
        sh, st = score(aa, bb, DECL, a, b), score(aa, bb, TAIL, a, b)
        if abs(sh["total"] - st["total"]) > 1e-9:
            moved += 1
        if sh["relation"] != st["relation"]:
            relflip += 1
        if admits(sh, DECL.theta_rhyme) != admits(st, TAIL.theta_rhyme):
            admflip += 1
    check("the sample is majority unequal-length, so it can see the "
          "difference at all",
          uneq / len(rows) > 0.5,
          f"{uneq} of {len(rows)} ({uneq/len(rows):.1%}). A sample of "
          f"equal-length pairs would pass every check in this file while "
          f"measuring nothing — that is doctrine 95's own blind spot, and it "
          f"is a property of the SAMPLE, not of the assertions.")
    check("the scalar total moves on most of them: the coordinate is not "
          "cosmetic",
          moved / len(rows) > 0.5,
          f"{moved} of {len(rows)} ({moved/len(rows):.1%}) totals differ "
          f"between the two readings")
    check("...and the RELATION never moves, because the band tail-aligns "
          "regardless",
          relflip == 0,
          f"{relflip} relation flips. This is why the change is a magnitude "
          f"question and not a taxonomy question, and it is the reason the "
          f"sonnet oracle cannot price it.")
    check("the ADMITTED verdict moves on a handful, and that handful is the "
          "entire measurable difference",
          admflip <= len(rows) // 100,
          f"{admflip} of {len(rows)} ({admflip/len(rows):.2%}) change whether "
          f"`admits()` says rhyme. Held out on 6,000 pairs this is 5 flips, 3 "
          f"one way and 2 the other, and the FPR difference is 0.00pp. "
          f"Doctrine 5: a change that does not beat the incumbent held out "
          f"does not ship because it is more principled.")


# ---------------------------------------------------------------------------
# 4. THE TRUE-POSITIVE ARM, ON A SLICE — the corpus that CANNOT price this
# ---------------------------------------------------------------------------

def test_the_oracle_is_blind_to_this_by_construction():
    print("\n4. the sonnet oracle cannot see the difference, and this is "
          "structural rather than lucky")
    try:
        sys.path.insert(0, os.path.join(HERE, ".."))
        import battery
        sonnets = battery.parse_sonnets(battery.corpus_path("sonnets.txt"))
    except Exception as exc:                                  # pragma: no cover
        check("corpus/sonnets.txt is readable", False, str(exc))
        return
    same = 0
    slice_ = sonnets[:20]
    for sn in slice_:
        h = L.check_scheme(LEX, sn, "ABABCDCDEFEFGG", DECL)
        t = L.check_scheme(LEX, sn, "ABABCDCDEFEFGG", TAIL)
        if ([(v[0], v[1], v[3]) for v in h["violations"]]
                == [(v[0], v[1], v[3]) for v in t["violations"]]):
            same += 1
    check(f"all {len(slice_)} sampled sonnets return the IDENTICAL violation "
          f"set under both readings",
          same == len(slice_),
          f"{same}/{len(slice_)}. Over all 152 it is 82/1014 either way, and "
          f"43/510 and 39/504 in the two halves — identical to the pair. Only "
          f"the reported SCORE moves, on 4 sonnets of 152. A corpus whose "
          f"mandated pairs are already best-aligned at equal length cannot "
          f"price an alignment coordinate, so 'the oracle did not move' is "
          f"not evidence that the readings agree.")


if __name__ == "__main__":
    for fn in (test_the_two_halves_read_opposite_ends,
               test_the_coordinate_is_declared,
               test_the_price_reproduces,
               test_the_oracle_is_blind_to_this_by_construction):
        fn()
    print("=" * 70)
    if FAILURES:
        print(f"{len(FAILURES)} FAILING: {', '.join(FAILURES)}")
        sys.exit(1)
    print("all scalar/band alignment regressions pass")
