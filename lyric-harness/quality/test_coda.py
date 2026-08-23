#!/usr/bin/env python3
"""The CODA channel's shape: why no `theta_coda` could ever have fixed it.

    python3 quality/test_coda.py

WHAT THIS PINS
--------------
`wall`/`floor` scored 0.996 RHYME with coda 0.988 in the declared General
American dialect, where a lateral coda faces a rhotic one. Two cells found it
on the same day from different directions — `ear`/`will` from the revision
loop, `wall`/`floor`/`call`/`more`/`call`/`floor` from a song written to a
mandate. The revision-loop cell's conclusion was that NO VALUE of `theta_coda`
reaches it. That is correct, and this file makes it mechanical rather than
remembered (doctrine 48).

THE REASON IS THE CONSTRUCTION, NOT THE CUT
-------------------------------------------
    cons_sim = 1 - [0.30*(voicing differs) + 0.25*|place difference|
                    + 0.45*MANNER_DIST]

Manner IDENTITY is worth 0.45 of a 1.0 budget while the entire place axis can
only take away 0.25. So every same-manner same-voicing pair scores >= 0.75 no
matter how far apart its places are, and `R`~`L` — same manner (liquid), same
voicing, 0.05 apart on the place axis — comes out at 0.9875, the ARGMAX of the
whole 276-pair matrix. A cut that refuses it refuses every non-identical
consonant pair in English, so the leak was never reachable from the threshold.

IT WAS NEVER ONE DEFECT. At `theta_coda` 0.80 the scalar admits 36 of 276
unordered pairs as agreeing codas: `S`~`TH` (miss/myth), `P`~`T` (cap/cat),
`M`~`N`, `B`~`D` (rob/rod), `K`~`T` (back/bat). The generosity is not specific
to liquids and not specific to sonorants — it is general to the construction,
and the manner class is the axis that buys it.

AND THE ADMITTED SET IS NOT THE ATTESTED SET
--------------------------------------------
Over the 1003 readable mandated sonnet pairs, 4 distinct non-identical coda
pairs clear 0.80 while the ones the corpus actually attests — S~Z x8, D~RD x4,
RT~T x3, RTH~TH x3 — are all REFUSED by it. Spearman(cluster_sim, lift) is
+0.156 and +0.122 across the two halves: the same "carries no ordering
information" verdict `vowel_sim` got at +0.02/-0.03, and read the same way
(doctrine 57) — what reproduces is that it is small, not the digit.

WHAT SHIPPED
------------
`Declaration.coda_agreement`, the coda's version of the coordinate the nucleus
channel already had, defaulting to `identity`. Priced held-out first
(`quality/redteam_band.py` section 9):

    shape                FIT FPR   FIT refused   HELD FPR   HELD refused
    scalar 0.80            3.55%        12.28%      3.65%          9.44%
    scalar 0.90            2.55%        12.28%      2.60%          9.44%
    scalar 0.95            2.25%        12.48%      2.30%          9.44%
    identity (SHIPPED)     2.05%        12.48%      2.15%          9.44%

Note the row that decides it is `scalar 0.95`: it pays the FULL true-positive
cost and still admits `wall`/`floor`. There is no cut that buys the fix.

`licensed` and `coda_licence` are reachable and the licence is EMPTY, which is
a measured result rather than an oversight — see `Declaration.coda_licence`.
Doctrine 24 governs the consequence: `wall`/`floor` is ASSONANCE, a named
member of the taxonomy, not a rejected non-relation.
"""

import itertools
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))

import lyric_harness as L  # noqa: E402
from lyric_harness import (Declaration, Lexicon, anchor,  # noqa: E402
                           channel_agreement, cluster_sim, cons_sim,
                           plural_s_tail, score, syllabify)

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
    phones, oov = LEX.transcribe_word(word)
    if oov or not phones:
        return None
    return anchor(syllabify(phones))


def rel(a, b, decl=None):
    d = decl or DECL
    return score(anchor_of(a), anchor_of(b), d, a, b)["relation"]


def total(a, b, decl=None):
    d = decl or DECL
    return score(anchor_of(a), anchor_of(b), d, a, b)["total"]


# ---------------------------------------------------------------------------
# 1. THE FOUR PAIRS THAT STARTED IT
# ---------------------------------------------------------------------------

def test_the_reported_rhymes_that_were_not_rhymes():
    print("\n1. the pairs two cells found on 2026-08-11, and what they are now")
    for a, b in (("wall", "floor"), ("call", "floor"), ("wall", "more"),
                 ("call", "more"), ("ear", "will")):
        r = rel(a, b)
        check(f"{a}/{b} is not RHYME", r != "RHYME",
              f"{total(a, b):.3f} {r} — identical nucleus, coda L against R")
    check("and each is RELABELLED, not rejected (doctrine 24)",
          all(rel(a, b) == "ASSONANCE" for a, b in
              (("wall", "floor"), ("call", "more"), ("ear", "will"))),
          "ASSONANCE is a named member of the taxonomy: the graph keeps the "
          "edge and the name. A rule that deleted the category would be a "
          "worse defect than the leak.")
    check("`will`/`gun` was ALREADY ASSONANCE and is unchanged",
          rel("will", "gun") == "ASSONANCE",
          "the brief that opened this cell called it 'the same generosity on "
          "L against N'. It is not: cons_sim(L,N) is 0.730, BELOW theta_coda "
          "0.80, so the band always typed it ASSONANCE. What made it look "
          "admitted is `check_scheme`'s collision list, which prints pairs on "
          "`total >= 0.9` and never consults the relation — a REPORT-layer "
          "defect, not a comparator one.")


# ---------------------------------------------------------------------------
# 2. NO theta_coda REACHES IT — the claim, made mechanical
# ---------------------------------------------------------------------------

def test_no_threshold_could_have_fixed_this():
    print("\n2. no value of `theta_coda` separates R~L from identity")
    rows = sorted(((cons_sim(a, b), a, b)
                   for a, b in itertools.combinations(sorted(L.CONSONANTS), 2)),
                  reverse=True)
    check("the consonant space is 24 symbols and 276 unordered non-identical "
          "pairs", len(L.CONSONANTS) == 24 and len(rows) == 276,
          f"{len(L.CONSONANTS)} consonants, {len(rows)} pairs")
    check("R~L is the ARGMAX of the entire matrix",
          rows[0][1:] == ("L", "R"),
          f"{rows[0][1]}~{rows[0][2]} at {rows[0][0]:.4f}; runner-up "
          f"{rows[1][1]}~{rows[1][2]} at {rows[1][0]:.4f}")
    rl = cons_sim("R", "L")
    sweep = [(t, sum(1 for s, _, _ in rows if s >= t))
             for t in (0.80, 0.90, 0.95, 0.98, 0.99)]
    admits_rl = [t for t, _ in sweep if rl >= t]
    check("every cut that admits any non-identical pair also admits R~L",
          all(rl >= t for t, k in sweep if k >= 1)
          and max(admits_rl) == 0.98,
          f"R~L = {rl:.4f}; theta_coda "
          + ", ".join(f"{t}->{k}" for t, k in sweep)
          + ". The first cut that refuses R~L is 0.99, which admits 0 of "
            "276 — i.e. identity, reached by the back door and stated as a "
            "point on a scale rather than a rate (doctrine 22).")
    d95 = Declaration(coda_agreement="scalar", theta_coda=0.95)
    check("`scalar 0.95` pays the full true-positive cost and STILL admits "
          "wall/floor",
          rel("wall", "floor", d95) == "RHYME",
          "which is why this was a SHAPE change and not a calibration")


# ---------------------------------------------------------------------------
# 3. IT IS A CLASS, NOT A PAIR — and the manner axis is why
# ---------------------------------------------------------------------------

def test_the_generosity_is_general_to_the_construction():
    print("\n3. is the generosity specific to liquids, to sonorants, or "
          "general?")
    d80 = Declaration(coda_agreement="scalar")
    rows = [(cons_sim(a, b), a, b)
            for a, b in itertools.combinations(sorted(L.CONSONANTS), 2)]
    adm = [r for r in rows if r[0] >= d80.theta_coda]
    check("36 of 276 pairs (13%) agree as a singleton coda at 0.80",
          len(adm) == 36, f"{len(adm)} pairs")
    manners = {}
    for s, a, b in adm:
        ma, mb = L.CONSONANTS[a][2], L.CONSONANTS[b][2]
        manners[tuple(sorted((ma, mb)))] = manners.get(
            tuple(sorted((ma, mb))), 0) + 1
    check("the admitted set spans SIX manner classes, not just the liquids",
          len(manners) >= 6,
          ", ".join(f"{k[0]}/{k[1]}:{v}" for k, v in sorted(manners.items())))
    same = [(s, a, b) for s, a, b in rows
            if L.CONSONANTS[a][2] == L.CONSONANTS[b][2]
            and L.CONSONANTS[a][0] == L.CONSONANTS[b][0]]
    check("EVERY same-manner same-voicing pair scores >= 0.75, whatever its "
          "place distance",
          min(s for s, _, _ in same) >= 0.75,
          f"floor {min(same)[0]:.4f} ({min(same)[1]}~{min(same)[2]}) over "
          f"{len(same)} pairs — manner identity is worth 0.45 of the budget "
          f"and the whole place axis can only take away 0.25, so the answer "
          f"is GENERAL TO THE CONSTRUCTION, not a liquid quirk")
    for a, b in (("miss", "myth"), ("cap", "cat"), ("rob", "rod"),
                 ("back", "bat")):
        check(f"{a}/{b} was admitted by the scalar and is not now",
              rel(a, b, d80) == "RHYME" and rel(a, b) != "RHYME",
              f"scalar {total(a, b, d80):.3f} {rel(a, b, d80)} -> "
              f"identity {rel(a, b)}")


# ---------------------------------------------------------------------------
# 4. THE SHAPE IS A DECLARED COORDINATE, and all three are reachable
# ---------------------------------------------------------------------------

def test_the_shape_is_declared():
    print("\n4. `coda_agreement` is a coordinate, and an undeclared value is "
          "loud")
    check("the default is `identity`", DECL.coda_agreement == "identity")
    check("the licence is EMPTY, and that is the measured result",
          DECL.coda_licence == (),
          "S~Z was the candidate and every one of its 8 mandated observations "
          "is another layer's defect: wights/knights was our own OOV plural "
          "fallback, muse/use is a homograph, and glass/was, pass/was, "
          "is/amiss, this/is are Early Modern English")
    for shape in ("scalar", "identity", "licensed"):
        d = Declaration(coda_agreement=shape)
        try:
            channel_agreement(anchor_of("wall"), anchor_of("floor"), d)
            ok = True
        except Exception:
            ok = False
        check(f"`{shape}` is reachable", ok)
    bad = Declaration(coda_agreement="nearly")
    try:
        channel_agreement(anchor_of("wall"), anchor_of("floor"), bad)
        loud = False
    except ValueError:
        loud = True
    check("an undeclared shape RAISES rather than falling through to one",
          loud, "a coordinate that silently picks a value is doctrine 1 "
                "broken inside the tuple")
    lic = Declaration(coda_agreement="licensed", coda_licence=(("S", "Z"),))
    check("a declared licence works, and is word-final only by default",
          rel("miss", "fizz", lic) == "RHYME"
          and rel("miss", "fizz") != "RHYME",
          "reachable so a later cell with real evidence can fill it "
          "(doctrine 84); not shipped, for the same reason the fitted matrix "
          "is not (known gap 2) — nothing showed it helped")


# ---------------------------------------------------------------------------
# 5. WHAT MUST STILL PASS — a fix that refuses everything is not a fix
# ---------------------------------------------------------------------------

def test_the_true_positives_that_must_survive():
    print("\n5. doctrine 94: a fix that lowers the FPR by refusing everything "
          "is not a fix")
    for a, b in (("nation", "station"), ("see", "free"), ("day", "way"),
                 ("light", "night"), ("wights", "knights"),
                 ("graces", "faces")):
        check(f"{a}/{b} is still RHYME", rel(a, b) == "RHYME",
              f"{total(a, b):.3f}")
    check("two ABSENT codas still agree (doctrine 25)",
          channel_agreement(anchor_of("see"), anchor_of("free"), DECL)[1],
          "reading empty-vs-empty as disagreement would delete every "
          "open-syllable rhyme in English")
    check("`sun`/`much` is still ASSONANCE — the case the band was built for",
          rel("sun", "much") == "ASSONANCE")
    check("`bad`/`bat` is still ASSONANCE, not promoted back to RHYME",
          rel("bad", "bat") == "ASSONANCE",
          "doctrine 94 priced this cost out loud when theta_coda moved "
          "0.60 -> 0.80; a T~D licence would have undone it and is refused")
    # quality/mutate.py M3 (`min(codas)` -> `max(codas)`) reported SURVIVED on
    # 2026-08-11 having run 34 checks with none failing, and it is a hole in
    # the suite rather than an equivalent mutant: it lets ONE agreeing
    # syllable carry a whole multi-syllable anchor, which is doctrine 21's
    # compensation defect moved from the comparator into the band. Verified
    # pre-existing rather than introduced -- the battery reports 81/81 under
    # the old comparator with and without M3, and 82/82 under the new one, so
    # nothing in the oracle was ever going to see it. It needs an anchor whose
    # syllables DISAGREE about the coda, and every comparator example in this
    # repo is a monosyllable or a pair that agrees throughout.
    check("a two-syllable anchor may not have one agreeing coda carry the "
          "other (mutate.py M3)",
          rel("nation", "nasal") == "ASSONANCE",
          "`nation` EY-SH-AH-N against `nasal` EY-Z-AH-L: the first aligned "
          "syllable has two ABSENT codas and agrees, the second is N against "
          "L and does not. Under `max(codas)` this reads RHYME. The band is "
          "conjunctive ACROSS SYLLABLES as well as across channels, and this "
          "is the check that says so.")


# ---------------------------------------------------------------------------
# 6. THE INGESTION HALF — the defect that made the licence look earned
# ---------------------------------------------------------------------------

def test_the_plural_s_is_an_ingestion_fact():
    print("\n6. the OOV -s fallback, and doctrine 79's triage arriving from "
          "the comparator end")
    check("`wights` is NOT in CMUdict — it reaches the comparator through the "
          "fallback",
          "wights" not in LEX.entries and "wight" in LEX.entries)
    check("the fallback no longer produces the impossible /tz/ coda",
          LEX.transcribe_word("wights")[0][-1] == "S",
          f"wights -> {' '.join(LEX.transcribe_word('wights')[0])}; the old "
          f"rule appended a hard-coded Z and gave W AY1 T Z")
    check("`wights`/`knights` now agrees by IDENTITY rather than by "
          "comparator generosity",
          tuple(anchor_of("wights")[-1]["coda"])
          == tuple(anchor_of("knights")[-1]["coda"]),
          "this is the pair that made a coda licence for S~Z look earned. It "
          "was never a coda fact.")
    check("the rule is voicing-aware in all three classes",
          plural_s_tail(["T"]) == ["S"] and plural_s_tail(["D"]) == ["Z"]
          and plural_s_tail(["S"]) == ["IH0", "Z"],
          "voiceless -> S, voiced -> Z, sibilant -> a syllable IH0 Z")
    # Doctrine 37: test a phonology against its tradition, not its own rules.
    sib = {"S", "Z", "SH", "ZH", "CH", "JH"}
    n = ok = old = 0
    for w, prons in LEX.entries.items():
        if not w.endswith("s") or len(w) < 3:
            continue
        base = w[:-1]
        if base not in LEX.entries:
            continue
        got, b = list(prons[0]), list(LEX.entries[base][0])
        if got[:len(b)] != b:
            continue
        n += 1
        tail = got[len(b):]
        if tail == plural_s_tail(b):
            ok += 1
        if tail == ["Z"]:
            old += 1
    check("and it is validated against CMUdict itself, not against its own "
          "rules (doctrine 37)",
          n > 10000 and ok / n > 0.95 and ok / n > old / n,
          f"n={n} dictionary -s words whose base is a true phonetic prefix: "
          f"voicing-aware rule {ok/n:.2%}, the old append-Z fallback "
          f"{old/n:.2%}. By class the voiceless arm goes 0.2% -> 99.8%.")
    # AND IT MOVES THE SONNET ORACLE BY EXACTLY NOTHING, so the two changes
    # price separately: battery A(ingestion OLD, coda scalar) = 81 violations,
    # B(ingestion NEW, coda scalar) = 81, C(ingestion NEW, coda identity) = 82.
    # Its effect is on the 515 distinct corpus words that had an impossible
    # coda, and on making C cost one pair instead of two.
    #
    # THIS WAS A `check(..., True)` UNTIL 2026-08-23 (doctrine 17). Nothing in
    # this file recomputes 81/81/82 -- they are a measurement from the sitting
    # that made the change, and a PASS line asserting a number no run produces
    # is a record dressed as a result. The record is worth keeping; the PASS
    # was not. Re-running it means re-running the three batteries, not reading
    # this comment.


if __name__ == "__main__":
    for fn in (test_the_reported_rhymes_that_were_not_rhymes,
               test_no_threshold_could_have_fixed_this,
               test_the_generosity_is_general_to_the_construction,
               test_the_shape_is_declared,
               test_the_true_positives_that_must_survive,
               test_the_plural_s_is_an_ingestion_fact):
        fn()
    print("=" * 70)
    if FAILURES:
        print(f"{len(FAILURES)} FAILING: {', '.join(FAILURES)}")
        sys.exit(1)
    print("all coda-channel shape and threshold regressions pass")
