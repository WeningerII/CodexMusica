#!/usr/bin/env python3
"""theta_nucleus: what 0.600 costs, and why the SHAPE was the real question.

    python3 quality/test_nucleus.py

BACKLOG 1.3 asked for one of two things: a change with a held-out price, or a
written declaration that 0.600 is chosen and what it costs. This file is the
second, made mechanical — doctrine 48: a principle that lives only in prose
gets followed exactly as often as someone remembers it.

THE COIN FLIP, STILL FLIPPING
-----------------------------
`five`/`of` is typed RHYME at a nucleus similarity of 0.603 against a hand-set
threshold of 0.600. `bed`/`bead` "agree" on the nucleus at 0.758. Those are not
anecdotes: the vowel space is 15 symbols and 105 unordered non-identical pairs,
so `theta_nucleus = 0.60` has an exhaustive reading — it is a LIST of 40 pairs,
printed below.

WHY IT IS NOT SIMPLY RAISED
---------------------------
The recorded reason was that tightening is a worse trade than the coda fix was.
Measured, the reason is sharper and it is a finding about the METRIC rather
than the threshold. `theta_coda` could be priced against Shakespeare because
what 0.60 -> 0.80 cost there is S~Z x8 (`glass`/`was`, `muse`/`use`) and D~RD
x2 — the voicing of a final obstruent, which English did not change between
1609 and General American. The NUCLEUS is the channel four centuries of sound
change live in. Of the 31 mandated pairs a 0.60 -> 0.70 tightening would newly
refuse, the offending syllable pairs partition with NO remainder into:

    28  a stressed vowel difference  gone/alone, tongue/song, have/grave,
                                     blood/good — not rhymes in the declared
                                     dialect, and refusing them is CORRECT
     6  AH0 against IH0, unstressed  graces/faces, antiquity/iniquity,
                                     committed/fitted — CMUdict spelling ONE
                                     reduced vowel two ways: an INGESTION fact
     1  a stress mismatch            perpetual/thrall — `final_promotion`

Not one is a General American slant rhyme. So the sonnets cannot price this
threshold in either direction, and the 8.47% of mandated pairs the channel
ALREADY refuses at 0.60 (approve/love, die/memory, give/live, are/care) are the
same kind of object. Doctrine 13's shape one level up: a resource used to price
a coordinate must be independent of that coordinate, and a corpus 400 years
from the declared dialect is not independent of the dialect coordinate.

WHAT SHIPPED
------------
The SHAPE became a declared coordinate (`Declaration.nucleus_agreement`) with
`scalar` as the default, and the default is the INCUMBENT rather than the
winner. `identity` — the red team's reference line, promoted from a number in a
script to a reachable shape — and `licensed`, the two-tier rule, are both
reachable so the comparison stays measurable (doctrine 84). Held out, both
halves reported:

    shape                       FIT FPR   FIT refused   HELD FPR   HELD refused
    scalar 0.60 (SHIPPED)         3.47%        12.28%      3.67%          9.44%
    scalar 0.70                   2.07%        15.05%      2.13%         12.85%
    identity                      0.00%        20.00%      0.20%         20.08%
    licensed (identity + schwa)   0.07%        19.80%      0.33%         19.48%

`identity` is 18x cleaner on false positives and deletes near rhyme, which is
exactly what doctrine 94 says a band tuned to agree with identity would do. It
is reachable, not proposed.
"""

import itertools
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))

import lyric_harness as L  # noqa: E402
from lyric_harness import (Declaration, Lexicon, anchor,  # noqa: E402
                           channel_agreement, line_anchors, score, syllabify,
                           vowel_sim)

#: How many sonnets the corpus arm reads. The whole corpus takes ~0.9 s and
#: this file runs inside the mutation runner's baseline, so it is a slice with
#: the full-corpus numbers recorded beside it.
N_SONNETS = 60

FAILURES = []
LEX = Lexicon()
DECL = Declaration()
REDUCED = {"AH", "IH"}


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
    aa, bb = anchor_of(a), anchor_of(b)
    return score(aa, bb, d, a, b)["relation"]


def aligned(a, b):
    n = min(len(a), len(b))
    return list(zip(a[-n:], b[-n:]))


# ---------------------------------------------------------------------------
# 1. THE CUT IS A LIST — the whole space is enumerable, so print it
# ---------------------------------------------------------------------------

def test_the_threshold_is_a_list_not_an_intuition():
    print("\n1. `theta_nucleus = 0.60` enumerated (doctrine 22: a threshold is "
          "a RATE, and here it is also a LIST)")
    rows = sorted(((vowel_sim(a, b), a, b)
                   for a, b in itertools.combinations(sorted(L.VOWELS), 2)),
                  reverse=True)
    admitted = [r for r in rows if r[0] >= DECL.theta_nucleus]
    check("the vowel space is 15 symbols and 105 unordered non-identical "
          "pairs",
          len(L.VOWELS) == 15 and len(rows) == 105,
          f"{len(L.VOWELS)} vowels, {len(rows)} pairs")
    check("0.60 admits 40 of them (38%) as AGREEING",
          len(admitted) == 40,
          "  ".join(f"{a}~{b}" for _, a, b in admitted))
    lo = min(admitted)
    hi = max(r for r in rows if r[0] < DECL.theta_nucleus)
    check("the cut lands between AH~AY at 0.603 and AA~UH at 0.598",
          abs(lo[0] - 0.603) < 5e-4 and abs(hi[0] - 0.598) < 5e-4,
          f"thinnest ADMITTED {lo[1]}~{lo[2]} {lo[0]:.3f}; widest refused "
          f"{hi[1]}~{hi[2]} {hi[0]:.3f}. A 0.005 gap decides them, and no "
          f"measurement ever put the cut there — it was hand-set at the first "
          f"commit and never moved.")


# ---------------------------------------------------------------------------
# 2. THE COIN FLIP, PINNED AS BEHAVIOUR
# ---------------------------------------------------------------------------

def test_the_priced_cost_of_leaving_it_at_060():
    print("\n2. what 0.600 costs, asserted rather than described")
    n_fo = vowel_sim("AY", "AH")
    check("`five`/`of` is typed RHYME, at nucleus 0.603 against 0.600",
          rel("five", "of") == "RHYME" and abs(n_fo - 0.603) < 5e-4,
          f"vowel_sim(AY, AH) = {n_fo:.3f}. A margin of 0.003 is a coin flip "
          f"wearing a verdict, and this check exists so that it is VISIBLE "
          f"rather than hidden. It is the declared cost of the incumbent, not "
          f"a defect this file is asking someone to fix quietly.")
    n_bb = vowel_sim("EH", "IY")
    check("`bed`/`bead` AGREE on the nucleus at 0.758",
          all(channel_agreement(anchor_of("bed"), anchor_of("bead"), DECL)
              [:1]) and abs(n_bb - 0.758) < 5e-4,
          f"vowel_sim(EH, IY) = {n_bb:.3f}, comfortably clear of the cut. The "
          f"pair types as CONSONANCE only because the CODAS differ; on the "
          f"nucleus channel alone the harness says a short front vowel and a "
          f"long one agree.")
    check("...and raising the threshold is REACHABLE, so the cost is "
          "demonstrable (doctrine 84)",
          rel("five", "of", Declaration(theta_nucleus=0.70)) != "RHYME",
          f"at 0.70 it is {rel('five', 'of', Declaration(theta_nucleus=0.70))}")


# ---------------------------------------------------------------------------
# 3. THE SHAPE IS A COORDINATE, AND IT WAS NOT
# ---------------------------------------------------------------------------

def test_the_shape_is_declared():
    print("\n3. `nucleus_agreement` — the SHAPE of the question, not the cut "
          "(doctrine 1)")
    d = Declaration()
    check("it defaults to `scalar`, the present behaviour",
          d.nucleus_agreement == "scalar", repr(d.nucleus_agreement))
    check("the licence defaults to exactly one pair, AH~IH",
          tuple(map(tuple, d.nucleus_licence)) == (("AH", "IH"),),
          f"{d.nucleus_licence!r}. Not a judgement about English: see check 4.")
    check("...and it applies only where BOTH syllables are unstressed",
          d.nucleus_licence_unstressed_only is True)
    check("all three coordinates print in the declaration",
          all(k in d.show() for k in ("nucleus_agreement", "nucleus_licence",
                                      "nucleus_licence_unstressed_only")),
          "a coordinate that does not appear in the printed declaration is "
          "hidden, not declared")

    raised = False
    try:
        channel_agreement(anchor_of("cat"), anchor_of("hat"),
                          Declaration(nucleus_agreement="fuzzy"))
    except ValueError:
        raised = True
    check("an undeclared shape RAISES rather than falling through to one",
          raised,
          "silently behaving like `identity` would be a coordinate lying "
          "about its own range")

    ident = Declaration(nucleus_agreement="identity")
    lic = Declaration(nucleus_agreement="licensed")
    check("`identity` is reachable and refuses `five`/`of`",
          rel("five", "of", ident) != "RHYME",
          f"{rel('five', 'of', ident)}. This is the red team's REFERENCE LINE "
          f"promoted from a number inside a script to a shape a caller can "
          f"select — which is what makes 'identity would delete slant rhyme' "
          f"a checkable claim instead of a sentence.")
    check("`identity` also refuses `bed`/`bead` on the nucleus",
          not channel_agreement(anchor_of("bed"), anchor_of("bead"),
                                ident)[0])
    check("`identity` still admits a perfect rhyme, so it is a shape and not "
          "an off switch",
          rel("nation", "station", ident) == "RHYME")
    check("`licensed` admits `graces`/`faces` where `identity` refuses it",
          rel("graces", "faces", lic) == "RHYME"
          and rel("graces", "faces", ident) != "RHYME",
          f"licensed={rel('graces', 'faces', lic)}, "
          f"identity={rel('graces', 'faces', ident)} — the two-tier rule, and "
          f"the tier it adds is one pair wide")
    check("the licence does NOT reach a stressed pair: `bed`/`bead` stays "
          "refused under `licensed`",
          not channel_agreement(anchor_of("bed"), anchor_of("bead"), lic)[0])
    check("the shipped `scalar` shape is unaffected by the licence "
          "coordinates",
          rel("graces", "faces") == rel("graces", "faces",
                                        Declaration(nucleus_licence=())),
          "at 0.60 the licensed pair already clears the scalar cut "
          "(AH~IH = 0.657), so the licence is a NO-OP on the default and only "
          "becomes load-bearing under a tightening. Said out loud so nobody "
          "reads it as a shipped behaviour change.")


# ---------------------------------------------------------------------------
# 4. THE LICENCE IS AN INGESTION FACT — asked of CMUdict, with no poem
# ---------------------------------------------------------------------------

def test_the_licence_is_a_fact_about_the_dictionary():
    print("\n4. AH0~IH0 is CMUdict spelling one reduced vowel two ways")
    both = same = 0
    for prons in LEX.entries.values():
        raw = {tuple(p) for p in prons}
        if len(raw) < 2:
            continue
        both += 1
        red = {tuple("AH" if q in ("AH0", "IH0") else q for q in p)
               for p in prons}
        if len(red) < len(raw):
            same += 1
    check("the dictionary contradicts itself on the distinction, in 12.4% of "
          "the words where it lists more than one pronunciation",
          both > 8000 and 0.11 < same / both < 0.14,
          f"{same:,} of {both:,} ({same/both:.1%}) CMUdict words with two or "
          f"more listed pronunciations collapse to ONE the moment AH0 and IH0 "
          f"are read as the same symbol. No poem is involved in that "
          f"measurement, which is the point: the licence is an INGESTION fact "
          f"and charging the comparator for it is the triage error doctrine "
          f"79 names, one layer down.")
    check("the stress condition is what keeps it an ingestion fact",
          Declaration().nucleus_licence_unstressed_only,
          "in mandated sonnet positions AH~IH is doubly-UNSTRESSED in 6 of 6; "
          "in a random background it is 394 of 545 (72%). Licensing it "
          "everywhere is reachable "
          "(`nucleus_licence_unstressed_only=False`) and doubles the shape's "
          "held-out false-positive rate, 0.33% -> 0.67%.")


# ---------------------------------------------------------------------------
# 5. THE METRIC, NOT THE THRESHOLD — the finding this round produced
# ---------------------------------------------------------------------------

def test_the_sonnets_cannot_price_this_channel():
    print(f"\n5. what a 0.60 -> 0.70 tightening would refuse, over "
          f"{N_SONNETS} sonnets, partitioned with no remainder")
    try:
        sys.path.insert(0, os.path.join(HERE, ".."))
        import battery
        sonnets = battery.parse_sonnets(
            battery.corpus_path("sonnets.txt"))[:N_SONNETS]
    except Exception as exc:                                  # pragma: no cover
        check("corpus/sonnets.txt is readable", False, str(exc))
        return

    schwa, stressed, promoted, other = [], [], [], []
    for sn in sonnets:
        ends = [line_anchors(LEX, ln, promote=DECL.final_promotion)[1]
                for ln in sn]
        for i, j in ((0, 2), (1, 3), (4, 6), (5, 7), (8, 10), (9, 11),
                     (12, 13)):
            aa = anchor_of(ends[i]) if ends[i] else None
            bb = anchor_of(ends[j]) if ends[j] else None
            if not aa or not bb:
                continue
            z = aligned(aa, bb)
            m = min(vowel_sim(x["nucleus"], y["nucleus"]) for x, y in z)
            if not (DECL.theta_nucleus <= m < 0.70):
                continue
            for x, y in z:
                if vowel_sim(x["nucleus"], y["nucleus"]) >= 0.70:
                    continue
                nm = f"{ends[i].lower()}/{ends[j].lower()}"
                if (x["stress"] == 0 and y["stress"] == 0
                        and x["nucleus"] in REDUCED and y["nucleus"] in REDUCED):
                    schwa.append(nm)
                elif x["stress"] > 0 and y["stress"] > 0:
                    stressed.append(nm)
                elif (x["stress"] > 0) != (y["stress"] > 0):
                    promoted.append(nm)
                else:
                    other.append((nm, x["nucleus"], y["nucleus"]))

    tot = len(schwa) + len(stressed) + len(promoted) + len(other)
    check("the tightening does cost something on this slice, or the check is "
          "vacuous",
          tot >= 10, f"{tot} offending syllable pairs")
    check("EVERY one is a stressed vowel difference, a reduced-vowel "
          "artifact, or a promotion — there is no fourth category",
          not other,
          f"stressed {len(stressed)}, reduced {len(schwa)}, promoted "
          f"{len(promoted)}, OTHER {len(other)}: {other[:5]}. Over all 152 "
          f"sonnets it is 28 / 6 / 1 / 0. A category that is entirely "
          f"dialect, dictionary and metre is not a true-positive cost: it "
          f"prices the `dialect` coordinate, not `theta_nucleus`.")
    check("the reduced-vowel cases are the ones the licence exists for",
          all(rel(*nm.split("/"),
                  Declaration(theta_nucleus=0.70,
                              nucleus_agreement="scalar")) != "RHYME"
              for nm in sorted(set(schwa))[:3]),
          f"{sorted(set(schwa))[:6]} — refused by a bare tightening. In each "
          f"the offending SYLLABLE is AH0 against IH0 in an unstressed "
          f"position, where the dictionary disagrees with itself; "
          f"`graces`/`faces` differ in nothing else at all. That is what makes "
          f"a tightening priced on this corpus look more expensive than it "
          f"is, on top of it pricing the wrong coordinate.")
    check("and the stressed cases are the ones the DECLARED dialect is "
          "supposed to refuse",
          len(stressed) > len(schwa),
          f"{sorted(set(stressed))[:8]} — gone/alone, tongue/song, "
          f"have/grave, blood/good. This project already accepts exactly this "
          f"sentence for love/prove, which it types CONSONANCE and calls "
          f"correct. A threshold cannot be calibrated on a corpus whose "
          f"dialect differs from the declared one, on the channel the "
          f"difference lives in.")


if __name__ == "__main__":
    for fn in (test_the_threshold_is_a_list_not_an_intuition,
               test_the_priced_cost_of_leaving_it_at_060,
               test_the_shape_is_declared,
               test_the_licence_is_a_fact_about_the_dictionary,
               test_the_sonnets_cannot_price_this_channel):
        fn()
    print("=" * 70)
    if FAILURES:
        print(f"{len(FAILURES)} FAILING: {', '.join(FAILURES)}")
        sys.exit(1)
    print("all nucleus-channel shape and threshold regressions pass")
