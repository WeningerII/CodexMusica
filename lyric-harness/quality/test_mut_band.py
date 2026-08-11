#!/usr/bin/env python3
"""Regressions written to KILL surviving mutations — signal, anchor, band.

    python3 quality/test_mut_band.py

Every check here exists because `quality/mutate.py` planted a defect and no
existing test noticed. The file is named after the instrument that found the
holes rather than after a feature, because that is what it is: the record of
what a positive control on the test suite turned up.

TWO KINDS OF CHECK, AND THE FIRST KIND IS THE POINT
---------------------------------------------------
Most of this repo's comparator tests are POSITIVE CASES: someone writes
`nation`/`station` and checks that it passes. Doctrine 94 is the finding that a
positive-case suite cannot detect a rule that is too GENEROUS, because a
generous rule passes every positive case by construction — and doctrine 95 is
the finding that an EQUAL-LENGTH positive case cannot detect an ALIGNMENT
defect, because the two alignments compute the same thing on equal lengths.
Both of those are properties of the example, not of the assertion, so no amount
of care in writing `check(...)` lines fixes them.

So the load-bearing checks below are not examples at all. They are:

  * a REFERENCE IMPLEMENTATION of the band predicate, stated independently in
    this file and asserted to agree with the shipped one over ~1,500 real
    CMUdict anchor pairs, together with a NON-VACUITY count proving that a
    head-aligned reading would disagree on hundreds of them; and
  * a FALSE-POSITIVE RATE against a reference line that needs no judgement,
    with a declared ceiling, and a TRUE-POSITIVE floor beside it so that the
    ceiling cannot be met by making the rule useless.

The examples that follow are there to name the failure in words a reader can
check, not to do the detecting.
"""

import os
import random
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
sys.path.insert(0, os.path.join(HERE, "..", ".."))

import lyric_harness as L  # noqa: E402
from lyric_harness import (Declaration, Lexicon, admits,  # noqa: E402
                           anchor, best_score, channel_agreement, cluster_sim,
                           line_anchors, score, syllabify, vowel_sim)

#: Doctrine 66. The pair sample below is drawn with this and nothing else.
SEED = 20260811

#: How many random CMUdict pairs the rate checks are measured on. Fixed, so
#: that the rates below are reproducible numbers rather than a mood.
N_PAIRS = 1200

#: Doctrine 22: a threshold is stated as a RATE. Measured at the shipped
#: settings on the sample below: 3.33% of random dictionary pairs are TYPED as
#: rhyme where strict identity says otherwise, and 0.67% are actually ADMITTED
#: (scalar and relation both). The nearest mutant reading is theta_coda
#: reverted to 0.60, which gives 10.50% and 2.58%. The ceilings sit between,
#: nearer the observation than the mutant, and they are pre-registered here so
#: that a change which moves them has to argue rather than merely pass.
TYPED_FPR_CEILING = 0.060
ADMITTED_FPR_CEILING = 0.012

#: The other side of the same coin. A ceiling alone can always be met by making
#: the rule refuse everything, so the canonical list below has to stay at 20/20.
CANONICAL_RHYMES = [
    ("night", "light"), ("hand", "land"), ("state", "gate"), ("see", "free"),
    ("day", "way"), ("low", "snow"), ("die", "eye"), ("me", "be"),
    ("true", "you"), ("moon", "june"), ("heart", "art"), ("rain", "pain"),
    ("time", "rhyme"), ("song", "long"), ("tree", "free"),
    ("station", "nation"), ("mother", "brother"), ("fire", "desire"),
    ("mind", "find"), ("care", "bear"),
]

FAILURES = []
LEX = Lexicon()
DECL = Declaration()


def check(name, cond, detail=""):
    print(f"  {'PASS' if cond else 'FAIL'}  {name}")
    if detail:
        print(f"          {detail}")
    if not cond:
        FAILURES.append(name)


def anchor_of(word):
    """The rhyme anchor of one word, or None where CMUdict refuses it."""
    phones, oov = LEX.transcribe_word(word)
    if oov or not phones:
        return None
    return anchor(syllabify(phones))


def rel(a, b, decl=None, profile=None):
    d = decl or DECL
    aa, _, _ = line_anchors(LEX, a, promote=d.final_promotion)
    bb, _, _ = line_anchors(LEX, b, promote=d.final_promotion)
    s = best_score(aa, bb, d, a, b, profile=profile)
    return s["relation"], s["total"]


# ---------------------------------------------------------------------------
# The reference implementations. These are the whole point of the file.
# ---------------------------------------------------------------------------

def band_reference(anc_a, anc_b, decl, align="tail"):
    """An INDEPENDENT statement of the conjunctive band. -> (nucleus, coda).

    Written out here rather than imported so that a mutation of the shipped
    function has something to disagree WITH. It is a twin, and a twin is the
    price of an oracle; the alternative — asserting on examples — is what let
    the head-alignment defect ship from the first commit.

    Three properties are stated separately because each one was a separate
    finding:
      tail alignment      rhyme aligns flush RIGHT (doctrine 95).
      minimum, not mean   the weakest ALIGNED SYLLABLE decides, so a strong
                          first syllable cannot buy a weak second (doctrine 21
                          one layer up).
      absent == absent    two ABSENT codas carry no EVIDENCE and plainly AGREE;
                          `see`/`free` is a perfect rhyme and a quarter of the
                          sonnets' mandated pairs are open-syllable
                          (doctrine 25).

    `align='head'` reproduces the SHIPPED-UNTIL-2026-08-11 reading and exists
    only so the non-vacuity check below can count how often it differs. Keeping
    the wrong reading reachable is doctrine 84's rule: a doctrine whose
    demonstration has been optimised away is a sentence nobody can check.
    """
    n = min(len(anc_a), len(anc_b))
    if not n:
        return False, False
    if align == "tail":
        ta = anc_a[len(anc_a) - n:]
        tb = anc_b[len(anc_b) - n:]
    else:
        ta, tb = anc_a[0:n], anc_b[0:n]
    nucs, cods = [], []
    for i in range(n):
        nucs.append(vowel_sim(ta[i]["nucleus"], tb[i]["nucleus"]))
        ca, cb = ta[i]["coda"], tb[i]["coda"]
        cods.append(1.0 if (not ca and not cb) else cluster_sim(ca, cb))
    return (min(nucs) >= decl.theta_nucleus,
            min(cods) >= decl.theta_coda)


def identity_label(a, b):
    """The band's verdict under STRICT IDENTITY, tail-aligned. No judgement.

    NOT ground truth for rhyme — the graded band exists on purpose and a rule
    tuned to agree with identity would delete slant rhyme, which is the point
    of having a band (doctrine 3/24). It is a REFERENCE LINE that needs no
    human, so the rate below is computable forever and by anyone.
    """
    n = min(len(a), len(b))
    if not n:
        return None
    ta, tb = a[len(a) - n:], b[len(b) - n:]
    nuc = all(ta[i]["nucleus"] == tb[i]["nucleus"] for i in range(n))
    cod = all(tuple(ta[i]["coda"]) == tuple(tb[i]["coda"]) for i in range(n))
    return {(True, True): "RHYME", (True, False): "ASSONANCE",
            (False, True): "CONSONANCE", (False, False): "NO_RELATION"}[
                (nuc, cod)]


def sample_anchor_pairs(n, rng):
    """Random CMUdict pairs with both anchors readable. The marginals are the
    dictionary's own; there is no label here to leak (doctrine 13)."""
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


PAIRS = sample_anchor_pairs(N_PAIRS, random.Random(SEED))


# ---------------------------------------------------------------------------
# 1. ALIGNMENT — the mutation the whole suite missed
# ---------------------------------------------------------------------------

def test_band_is_tail_aligned():
    print("\n1. THE BAND ALIGNS FLUSH RIGHT (mutation M1 — survived the whole "
          "suite on 2026-08-11)")
    # (a) the shipped function agrees with the reference on every sampled pair.
    disagree = [(a, b) for a, b, aa, bb in PAIRS
                if channel_agreement(aa, bb, DECL)
                != band_reference(aa, bb, DECL)]
    check("channel_agreement matches the tail-aligned reference on every "
          f"one of {len(PAIRS)} random CMUdict anchor pairs",
          not disagree,
          "first disagreements: " + str(disagree[:4]) if disagree
          else "the reference states tail alignment, a minimum over aligned "
               "syllables, and absent==absent, independently of the shipped "
               "code")

    # (b) NON-VACUITY. Without this the check above passes for a suite made of
    #     equal-length pairs, which is exactly how the defect survived.
    unequal = [(aa, bb) for _, _, aa, bb in PAIRS if len(aa) != len(bb)]
    witnesses = [1 for aa, bb in unequal
                 if band_reference(aa, bb, DECL)
                 != band_reference(aa, bb, DECL, align="head")]
    check("the sample is NOT degenerate: hundreds of pairs distinguish head "
          "from tail alignment",
          len(witnesses) >= 200,
          f"{len(unequal)} of {len(PAIRS)} pairs are unequal-length "
          f"({len(unequal)/len(PAIRS):.1%}); head and tail alignment disagree "
          f"on {len(witnesses)} of them. On the 152 sonnets the same two "
          f"figures are 67.8% and 79.9%. If this number ever reaches 0 the "
          f"check above has gone vacuous and proves nothing.")

    # (c) the exposing case, in words, so a reader can check the machine.
    r, t = rel("get to go", "receipt")
    check("`get to go` / `receipt` is NOT a rhyme",
          r not in ("RHYME", "RIME_RICHE"),
          f"{r} at {t:.3f}. Head-aligned this compared get(EH,T) with "
          f"ceipt(IY,T), found the T codas identical and the front vowels "
          f"close, and typed a 0.579 pair as RHYME. Tail-aligned the nucleus "
          f"similarity is 0.245. This is the report line the whole red-team "
          f"round started from.")


# ---------------------------------------------------------------------------
# 2. THE REDUCTION IS A MINIMUM, AND ABSENCE AGREES
# ---------------------------------------------------------------------------

def test_reduction_and_absence():
    print("\n2. the conjunctive reduction (mutations M2, M3, M4)")
    # min -> max anywhere in the reduction shows up as a disagreement with the
    # reference on multisyllabic anchors, so build the witness explicitly.
    multi = [(a, b, aa, bb) for a, b, aa, bb in PAIRS
             if min(len(aa), len(bb)) >= 2]
    check("the sample contains multisyllabic anchors, so a max-instead-of-min "
          "reduction has somewhere to show",
          len(multi) >= 50, f"{len(multi)} pairs with >=2 aligned syllables")
    maxlike = sum(1 for _, _, aa, bb in multi
                  if channel_agreement(aa, bb, DECL) != band_reference(
                      aa, bb, DECL))
    check("no pair reads as a maximum over syllables", maxlike == 0,
          "a mean or a max lets a strong first syllable BUY a weak second, "
          "which is the compensation defect the band exists to close")

    # doctrine 25's tripwire, at corpus scale rather than on one pair. The
    # filter is "EVERY aligned syllable has both codas absent", because the
    # predicate is a minimum: one syllable with a real coda disagreement would
    # decide the pair and the check would be testing something else.
    def all_open(aa, bb):
        n = min(len(aa), len(bb))
        ta, tb = aa[len(aa) - n:], bb[len(bb) - n:]
        return all(not ta[i]["coda"] and not tb[i]["coda"] for i in range(n))

    openpairs = [(a, b, aa, bb) for a, b, aa, bb in PAIRS if all_open(aa, bb)]
    check("open-syllable pairs exist in the sample", len(openpairs) >= 20,
          f"{len(openpairs)} pairs whose final codas are BOTH absent")
    agreed = sum(1 for _, _, aa, bb in openpairs
                 if channel_agreement(aa, bb, DECL)[1])
    check("every both-absent coda AGREES", agreed == len(openpairs),
          f"{agreed}/{len(openpairs)}. Two ABSENT codas carry 0.000 bits of "
          f"EVIDENCE and the fitted matrix was right to score them so — but "
          f"the band asks whether they AGREE, and see/free is a perfect "
          f"rhyme. Reading them as disagreement deletes every open-syllable "
          f"rhyme in English while sun/much still looks fixed.")

    # WHERE THE TRIPWIRE ACTUALLY LIVES. Mutation M4 deletes the
    # `1.0 if (not ca and not cb)` clause from `channel_agreement` and NOTHING
    # in this repo can tell the difference -- because `cluster_sim` opens with
    # its own `if not a and not b: return 1.0`, so the band's clause RESTATES
    # a guarantee the comparator already gives. Measured: 0 differences in
    # `channel_agreement` and 0 in the resulting relation over 4,000 random
    # pairs, 1,206 of which have a both-absent aligned coda.
    #
    # CLAUDE.md doctrine 25 says the both-empty case was "registered as the
    # tripwire and checked first", which reads as though the BAND implements
    # it. The line that implements it is one layer down. That line is pinned
    # below, and mutating it (M11) IS caught -- so the property has exactly
    # one detector and it is in the right place.
    check("the clause the band duplicates is the one that carries the rule",
          cluster_sim([], []) == 1.0,
          "if this ever stops being 1.0, `channel_agreement`'s own "
          "both-absent clause becomes load-bearing rather than documentary, "
          "and the ALLOWLIST entry for M4 in test_mutation.py stops being "
          "true. The two are linked on purpose.")


# ---------------------------------------------------------------------------
# 3. RATES — doctrine 22 and doctrine 94, both directions
# ---------------------------------------------------------------------------

def _rates(decl, admits_fn=admits):
    typed = adm = 0
    for a, b, aa, bb in PAIRS:
        s = score(aa, bb, decl, a, b)
        if identity_label(aa, bb) == "RHYME":
            continue                    # identity agrees; not a false positive
        if s["relation"] in ("RHYME", "RIME_RICHE"):
            typed += 1
        if admits_fn(s, decl.theta_rhyme):
            adm += 1
    return typed / len(PAIRS), adm / len(PAIRS)


def test_false_positive_rate_has_a_ceiling():
    print("\n3. THE BAND'S FALSE-POSITIVE RATE, against a reference line that "
          "needs no judgement (mutations M5-M10)")
    typed, adm = _rates(DECL)
    check(f"typed-as-rhyme rate on random pairs stays under "
          f"{TYPED_FPR_CEILING:.1%}",
          typed <= TYPED_FPR_CEILING,
          f"{typed:.2%} of {len(PAIRS)} random CMUdict pairs are TYPED as "
          f"rhyme where strict tail-aligned identity says otherwise. "
          f"theta_coda reverted to 0.60 reads 10.50% here; the band switched "
          f"off reads 99.67%. Identity is a REFERENCE, not truth — a rule "
          f"tuned to agree with it would delete slant rhyme.")
    check(f"ADMITTED rate (scalar AND relation) stays under "
          f"{ADMITTED_FPR_CEILING:.1%}",
          adm <= ADMITTED_FPR_CEILING,
          f"{adm:.2%}. theta_rhyme at 0.50 reads 1.58% here, theta_coda at "
          f"0.60 reads 2.58%, and `admits` without its relation clause reads "
          f"8.33% — the sun/much leak in its original form.")

    # The ceiling is meetable by refusing everything, so pin the other side.
    missed = [(a, b) for a, b in CANONICAL_RHYMES
              if score(anchor_of(a), anchor_of(b), DECL, a, b)["relation"]
              not in ("RHYME", "RIME_RICHE")]
    check("the TRUE-POSITIVE floor holds: 20 canonical rhymes all still type "
          "as rhyme", not missed,
          f"missed {missed}" if missed else
          "a false-positive ceiling with no true-positive floor is met "
          "perfectly by a rule that admits nothing")


# ---------------------------------------------------------------------------
# 4. DECLARED COORDINATES — doctrine 1, with the price attached
# ---------------------------------------------------------------------------

def test_declaration_defaults_are_pinned():
    print("\n4. every threshold is a DECLARED coordinate and moves only on "
          "purpose (mutations M7-M10, M13)")
    d = Declaration()
    for field, want, why in [
        ("theta_rhyme", 0.75,
         "the match band's lower edge; 0.50 reads 1.58% admitted-FPR here"),
        ("theta_coda", 0.80,
         "CALIBRATED, was 0.60. Held out: FPR 11.93% -> 4.67% for 0.6pp of "
         "true-positive cost, same direction in both halves (doctrine 5). "
         "The priced cost is that bad/bat is ASSONANCE."),
        ("theta_nucleus", 0.60,
         "NOT calibrated and known to be a coin flip: five/of passes at "
         "0.603. BACKLOG 1.3 is open on it. Undecided is not unpinned."),
        ("trailing_syllable_penalty", 0.15, "the semirhyme discount"),
        ("conjunctive_band", True, "doctrine 3: the band is TYPED"),
        ("final_promotion", True, "verse promotes unstressed finals"),
        ("fitted", False,
         "doctrine 5 / known gap 2: the fitted matrix is built and not "
         "shipped, on a held-out gain of +0.003"),
    ]:
        got = getattr(d, field)
        check(f"Declaration.{field} == {want!r}", got == want,
              f"got {got!r}. {why}")

    # Behavioural, not just a value: the priced consequences of theta_coda.
    r, t = rel("independents", "powersoft")
    check("independents/powersoft is NOT typed as rhyme at the shipped "
          "theta_coda", r not in ("RHYME", "RIME_RICHE"),
          f"{r} at {t:.3f}. NTS~FT scores exactly 0.600, so this pair passed "
          f"at theta_coda 0.60 and is the case that priced the change.")
    r60, _ = rel("independents", "powersoft",
                 decl=Declaration(theta_coda=0.60))
    check("...and it IS admitted again at 0.60, so the coordinate is "
          "reachable and the defect is demonstrable (doctrine 84)",
          r60 in ("RHYME", "RIME_RICHE"), f"at theta_coda 0.60 it is {r60}")

    # The semirhyme discount, stated as a difference rather than as a number
    # buried in a total, so it cannot be silently zeroed.
    aa, bb = anchor_of("remember"), anchor_of("her")
    on = score(aa, bb, Declaration(), "remember", "her")
    off = score(aa, bb, Declaration(trailing_syllable_penalty=0.0),
                "remember", "her")
    extra = abs(len(aa) - len(bb))
    check("the extra unmatched syllable costs exactly 0.15 per syllable",
          extra >= 1 and abs((off["total"] - on["total"]) - 0.15 * extra) < 1e-6,
          f"{off['total']} without the penalty, {on['total']} with it, "
          f"{extra} extra syllable(s)")
    check("and it is flagged, not merely subtracted",
          "semirhyme" in on["flags"], str(on["flags"]))


# ---------------------------------------------------------------------------
# 5. THE ANCHOR RULE — a declared coordinate that lives in code
# ---------------------------------------------------------------------------

def test_anchor_rule():
    print("\n5. the anchor is the LAST stressed syllable to the end "
          "(mutations M14, M15, M16)")
    a = anchor_of("applesauce")
    check("applesauce anchors on its final SECONDARY stress, one syllable",
          len(a) == 1 and a[0]["nucleus"] == "AO",
          f"got {[s['nucleus'] for s in a]}. The declaration says 'last "
          f"primary stress to end of unit' and the docstring says rap anchors "
          f"on late secondaries. An off-by-one in the reverse scan, or a scan "
          f"that only accepts primary stress, both anchor this on AE1 and "
          f"silently redefine the declared coordinate.")
    for w, n in (("receipt", 1), ("nation", 2), ("cat", 1),
                 ("imagination", 2)):
        got = len(anchor_of(w))
        check(f"{w} anchors {n} syllable(s)", got == n, f"got {got}")

    # The mosaic reach: line_anchors offers the SECOND-to-last stress too, and
    # it is the generator of exactly the unequal-length spans M1 mis-aligned.
    ancs, _, _ = line_anchors(LEX, "imagination", promote=DECL.final_promotion)
    lens = sorted(len(x) for x in ancs)
    check("line_anchors offers a span reaching back past the last stress",
          max(lens) >= 3, f"span lengths {lens}. Dropping the second-to-last "
          f"stress removes the multisyllabic and mosaic reach that "
          f"line_anchors exists to produce — and removes the material that "
          f"makes alignment matter at all.")


# ---------------------------------------------------------------------------
# 6. COMPARATOR AND PROJECTION
# ---------------------------------------------------------------------------

def test_comparator_and_projection():
    print("\n6. comparator and projection (mutations M11, M12, M25)")
    check("cluster_sim on two EMPTY clusters is 1.0",
          cluster_sim([], []) == 1.0,
          "the fitted matrix scored empty/empty at 0.000 BITS, correctly — "
          "that is evidence. This is similarity, and two absent codas are "
          "identical. Conflating the two deletes open-syllable rhyme "
          "(doctrine 25, one layer below the band).")
    check("cluster_sim empty against non-empty is 0.0",
          cluster_sim([], ["T"]) == 0.0)

    t = score(anchor_of("night"), anchor_of("light"), DECL,
              "night", "light")["total"]
    check("two words differing ONLY in their first onset score exactly 1.0",
          t == 1.0,
          f"got {t}. The first onset is the rhyme-defining EXCLUSION: it is "
          f"shown and not scored. Scoring it penalises a pair for differing "
          f"exactly where rhyme requires it to.")

    sy = syllabify(LEX.transcribe_word("nation")[0])
    check("syllabify maximises the legal ONSET: nation is N-EY / SH-AH-N",
          len(sy) == 2 and sy[0]["coda"] == [] and sy[1]["onset"] == ["SH"],
          f"got {[(s['onset'], s['nucleus'], s['coda']) for s in sy]}. "
          f"Interior onset and interior coda are separate channels with "
          f"separate weights, so a cut in the wrong place moves material "
          f"between channels while the phoneme string stays identical.")


# ---------------------------------------------------------------------------
# 7. THE SCALAR'S ALIGNMENT IS NOT THE BAND'S — an OPEN finding, pinned
# ---------------------------------------------------------------------------

def test_scalar_and_band_alignments_currently_differ():
    print("\n7. [OPEN, doctrine 95 unfinished] score() still aligns from the "
          "HEAD while channel_agreement aligns from the TAIL")
    aa, _, _ = line_anchors(LEX, "get to go", promote=False)
    bb, _, _ = line_anchors(LEX, "receipt", promote=False)
    A = max(aa, key=len)
    B = min(bb, key=len)
    s = score(A, B, DECL, "get to go", "receipt")
    head_nuc = vowel_sim(A[0]["nucleus"], B[0]["nucleus"])
    tail_nuc = vowel_sim(A[-1]["nucleus"], B[-1]["nucleus"])
    check("the two halves of one comparison read the same anchor differently",
          len(A) != len(B) and abs(head_nuc - tail_nuc) > 1e-9
          and abs(s["syllables"][0]["nucleus"] - round(head_nuc, 3)) < 1e-9,
          f"anchors of length {len(A)} and {len(B)}. score() reports its "
          f"first compared syllable at nucleus {s['syllables'][0]['nucleus']} "
          f"= vowel_sim({A[0]['nucleus']}, {B[0]['nucleus']}) — the HEADS. "
          f"channel_agreement reads the TAILS, "
          f"vowel_sim({A[-1]['nucleus']}, {B[-1]['nucleus']}) = "
          f"{tail_nuc:.3f}. "
          f"`score` reads `anc_a[i]` against `anc_b[i]` — flush LEFT — 50 "
          f"lines below the function that was fixed to align flush RIGHT. "
          f"Doctrine 95 says to grep the other layers for the same shape "
          f"before closing a defect; this is the shape, still open, and the "
          f"docstring calls it deliberate ('left-align at the stressed "
          f"syllable'). THIS CHECK ASSERTS THE PRESENT BEHAVIOUR so that "
          f"changing it is a decision with a test attached, not a drift. If "
          f"it is changed on purpose, this check is what must be rewritten.")


if __name__ == "__main__":
    for fn in (test_band_is_tail_aligned,
               test_reduction_and_absence,
               test_false_positive_rate_has_a_ceiling,
               test_declaration_defaults_are_pinned,
               test_anchor_rule,
               test_comparator_and_projection,
               test_scalar_and_band_alignments_currently_differ):
        fn()
    print("=" * 70)
    if FAILURES:
        print(f"{len(FAILURES)} FAILING: {', '.join(FAILURES)}")
        sys.exit(1)
    print("all mutation-derived signal/anchor/band regressions pass")
