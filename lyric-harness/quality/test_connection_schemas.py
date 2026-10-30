#!/usr/bin/env python3
"""The interior sound schemas, the BOTH-PRESENT guard, and real-consonant
alliteration (2026-10-30, `MISSING.md` M-323).

    python3 quality/test_connection_schemas.py

THE CONTRACT is the "Interior schema contract" of
docs/design/connection-views/spec.md: `internal assonance` and `internal
consonance` take `internal rhyme`'s shape (last stress to the word end, any
token, anchor-aligned, the overhang excluded, at least one member not
line-final). Consonance carries BOTH-PRESENT on the coda at the LAST ALIGNED
PAIR, so two open syllables (the~today) stop agreeing on nothing.
`alliteration` carries the same guard on the onset (the owner's ruling,
"Require a real consonant"): are~I stops counting.

INVENTORY: every fixture runs on this branch's English inventory, where NEAR
is its own vowel (M-322). The assonance positive uses AE, which no split on
that branch touches; his~queer is pinned as a NEGATIVE here.
"""

import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))

import lyric_harness  # noqa: E402,F401
from quality import phonology as PH  # noqa: E402
from quality import relations as R  # noqa: E402
from quality.phonology import Readings  # noqa: E402

FAILURES = []
PHON = PH.get("eng")
IA = R.REGISTRY["internal assonance"]
IC = R.REGISTRY["internal consonance"]
AL = R.REGISTRY["alliteration"]


def check(name, cond, detail=""):
    print(f"  {'PASS' if cond else 'FAIL'}  {name}")
    if detail:
        print(f"          {detail}")
    if not cond:
        FAILURES.append(name)


def stream(lines):
    return R.build_stream(lines, PHON, declaration={"language": "eng"})


def word(st, sp):
    return st.units[sp.idx[0]].token_text


def spans_of(schema, st, text):
    return [sp for sp in R.enumerate_spans(schema.spans[0], st)
            if word(st, sp) == text]


def judge(schema, lines, wa, wb):
    """The one pair, evaluated directly: no bucket stands between it and the
    judge. -> the Instance, or None when placement excludes the pair."""
    st = stream(lines)
    a, b = spans_of(schema, st, wa)[0], spans_of(schema, st, wb)[-1]
    return R.evaluate(schema, a, b, st)


def verdict(schema, lines, wa, wb):
    inst = judge(schema, lines, wa, wb)
    return "excluded" if inst is None else inst.verdict


def held(schema, lines):
    st = stream(lines)
    return {(word(st, i.a), word(st, i.b)) for i in R.realise(schema, st)
            if i.verdict is True}


def test_both_present():
    print("\n-- 1. BOTH-PRESENT --")
    bp = R.BOTH_PRESENT
    check("named BOTH-PRESENT and exported", bp.name == "BOTH-PRESENT"
          and "BothPresent" in R.__all__ and "BOTH_PRESENT" in R.__all__)
    r = bp(("T",), ("D", "Z"))
    check("two certain non-empty values -> True, informative",
          r.value is True and r.informative, r)
    for x, y in (((), ("T",)), (("T",), ()), ((), ())):
        r = bp(x, y)
        check(f"a certainly empty side {x!r}~{y!r} -> False, informative",
              r.value is False and r.informative, r)
    r = bp(None, ("T",))
    check("an unreadable side -> None, not informative, 'unreadable'",
          r.value is None and not r.informative and r.note == "unreadable", r)
    r = bp(Readings({("R",), ()}), ("T",))
    check("a set whose readings disagree on presence -> None: unknown is "
          "never read as empty", r.value is None and not r.informative
          and "uncertain" in r.note, r)
    r = bp(Readings({("R",), ("R", "T")}), ("T",))
    check("a set every reading of which is present -> True",
          r.value is True, r)
    r = bp(Readings({("R",), ()}), ())
    check("one side certainly empty decides even when the other is "
          "uncertain -> False", r.value is False and r.informative, r)
    r = bp(frozenset({("R",), None}), ("T",))
    check("an unreadable reading inside a set -> None", r.value is None, r)
    check("a predicate, never an Agree: `_bucket_key` keys only on Agree, so "
          "the guard cannot narrow a bucket",
          not isinstance(bp, R.Agree))


def test_declarations():
    print("\n-- 2. the declarations follow the contract --")
    rule = R.SpanRule("any_token", "last_stressed", 1, "to_word_end")
    for s in (IA, IC):
        check(f"{s.name}: spans, align, unmatched, placement, identity are "
              f"internal rhyme's",
              s.spans == (rule, rule) and s.align == "anchor"
              and s.unmatched == "exclude"
              and s.placement == (R.Placement("both_line_final",
                                              polarity=False),)
              and s.identity == (R.IdentityRule("token", R.DIFFER),))
    check("internal assonance: nucleus AGREE each, nothing else",
          IA.channels == (R.ChannelRule("nucleus", R.AGREE, "each"),))
    check("internal consonance: coda AGREE each + coda BOTH-PRESENT last",
          IC.channels == (R.ChannelRule("coda", R.AGREE, "each"),
                          R.ChannelRule("coda", R.BOTH_PRESENT, "last")))
    check("alliteration: onset AGREE first + onset BOTH-PRESENT first",
          AL.channels == (R.ChannelRule("onset", R.AGREE, "first"),
                          R.ChannelRule("onset", R.BOTH_PRESENT, "first")))
    check("only `alliteration` carries the guard among the alliteration "
          "family",
          not any(type(c.predicate).__name__ == "BothPresent"
                  for n, s in R.REGISTRY.items()
                  if n not in ("alliteration", "internal consonance")
                  for c in s.channels))
    check("line-final consonance is untouched: coda AGREE each alone (E-5 "
          "keeps empty/empty agreement)",
          R.REGISTRY["consonance"].channels
          == (R.ChannelRule("coda", R.AGREE, "each"),))
    check("each new schema is sourced (R5 / R9, English)",
          R.REGISTRY["internal assonance"].traditions
          and R.REGISTRY["internal consonance"].traditions)


def test_assonance():
    print("\n-- 3. internal assonance --")
    v = verdict(IA, ["the cat ran home"], "cat", "ran")
    check("positive: cat~ran share AE inside a line (not a NEAR/KIT pair)",
          v is True, v)
    lines = ["we walked out in the sun", "it never felt like much"]
    v = verdict(IA, lines, "sun", "much")
    check("negative: sun~much both END their lines -> excluded, which is "
          "line-final assonance's pair", v == "excluded", v)
    check("...and line-final `assonance` still holds it",
          verdict(R.REGISTRY["assonance"], lines, "sun", "much") is True)
    check("...and it is absent from the interior run",
          ("sun", "much") not in held(IA, lines), held(IA, lines))
    v = verdict(IA, ["the cat saw the cat run"], "cat", "cat")
    check("negative: the same spelling twice (cat~cat) -> False on identity",
          v is False, v)
    v = verdict(IA, ["his queer old hat"], "his", "queer")
    check("negative, pinned on this inventory: his~queer (KIT against NEAR, "
          "its own vowel here)", v is False, v)
    v = verdict(IA, ["is it his"], "is", "his")
    check("function words are kept (owner: 'keep function words, option 1'): "
          "is~his holds", v is True, v)


def test_consonance():
    print("\n-- 4. internal consonance --")
    v = verdict(IC, ["the cat sat down"], "cat", "sat")
    check("positive: cat~sat, two closed final codas that agree",
          v is True, v)
    inst = judge(IC, ["the today was blue"], "the", "today")
    check("negative: the~today, both codas OPEN -> False on the guard while "
          "coda AGREE alone is True",
          inst.verdict is False
          and [r.value for c, q, r in inst.reads] == [True, False],
          [(c, q, r.value) for c, q, r in inst.reads])
    v = verdict(IC, ["go home now"], "go", "home")
    check("negative: go~home, one open and one closed", v is False, v)
    inst = judge(IC, ["the candy window shone"], "candy", "window")
    check("negative: candy~window, medial codas agree (N~N) and the word "
          "ends are open -> the guard at the last pair fails",
          inst.verdict is False
          and [(q, r.value) for c, q, r in inst.reads]
          == [(0, True), (1, True), (1, False)],
          [(c, q, r.value) for c, q, r in inst.reads])
    inst = judge(IC, ["her village fill"], "village", "fill")
    check("negative: village~fill does not hold — the shorter suffix has one "
          "syllable, so the compared pair is the anchors, and village's "
          "anchor coda is empty against fill's L (coda AGREE fails there)",
          inst.verdict is False and inst.reads[0][2].value is False,
          [(c, q, r.value) for c, q, r in inst.reads])
    inst = judge(IC, ["fifty if"], "fifty", "if")
    check("unequal suffix lengths: fifty~if holds on the anchors, and the "
          "overhang (fifty's T IY) is never read",
          inst.verdict is True
          and {q for c, q, r in inst.reads} == {0}
          and inst.alignment.unmatched_a == (1,),
          [(c, q, r.value) for c, q, r in inst.reads])
    inst = judge(IC, ["washing washington"], "washing", "washington")
    pos = [(q, r.value) for c, q, r in inst.reads]
    check("3-syllable against 2-syllable: the last aligned pair is tail "
          "index min(len) - 1 = 1, NOT the anchor; the guard reads index 1 "
          "and the third syllable is overhang",
          inst.verdict is True and pos[-1] == (1, True)
          and inst.alignment.pairs == ((0, 0), (1, 1))
          and inst.alignment.unmatched_b == (2,), pos)
    check("...and it holds BECAUSE it reads index 1: the anchors are both "
          "open, so a guard at the anchor would refuse it",
          R.BOTH_PRESENT((), ()).value is False)
    st = stream(["the star was far away"])
    a, b = spans_of(IC, st, "star")[0], spans_of(IC, st, "far")[0]
    inst = R.evaluate(IC, a, b, st)
    check("undecided: star~far, a merged reading whose coda varies "
          "(rhotic R or none) -> None with coda in unknown_channels",
          inst.verdict is None
          and ("coda", 0) in inst.unknown_channels,
          (inst.verdict, inst.unknown_channels))
    lines = ["the cat was there", "and then it sat"]
    check("negative both-final placement: there~sat is excluded",
          verdict(IC, lines, "there", "sat") == "excluded")


def test_alliteration():
    print("\n-- 5. alliteration needs a real consonant --")
    for wa, wb in (("are", "I"), ("is", "in"), ("ask", "if")):
        v = verdict(AL, [f"{wa} {wb}"], wa, wb)
        check(f"vowel-initial {wa}~{wb} no longer holds", v is False, v)
    v = verdict(AL, ["whose woods these are I think I know"], "whose",
                "woods")
    check("control: whose~woods? (HH ~ W) does not hold", v is False, v)
    v = verdict(AL, ["to watch his woods fill up with snow"], "watch",
                "woods")
    check("watch~woods holds on W", v is True, v)
    got = held(AL, ["whose woods these are I think I know"])
    check("Frost line 1: are~I no longer holds; nothing vowel-initial does",
          not any(a[0].lower() in "aeiou" or b[0].lower() in "aeiou"
                  for a, b in got), sorted(got))


def test_pruning_is_sound():
    print("\n-- 6. pruned and unpruned evaluation agree --")
    lines = ["the cat sat down beside the candy window",
             "his queer old hat was far from home today",
             "and fifty washing lines are fill and village",
             "to watch his woods fill up with snow"]
    st = stream(lines)
    real = R._bucket_key
    for sch in (IA, IC, AL):
        pruned = sorted((i.a.idx, i.b.idx, i.verdict)
                        for i in R.realise(sch, st))
        R._bucket_key = lambda *a, **k: None
        try:
            whole = sorted((i.a.idx, i.b.idx, i.verdict)
                           for i in R.realise(sch, st))
        finally:
            R._bucket_key = real
        check(f"{sch.name}: every True/None instance is the same with every "
              f"span a wildcard ({len(pruned)} instances)",
              pruned == whole, f"{len(pruned)} vs {len(whole)}")


def test_planner():
    print("\n-- 7. the planner and the new rules --")
    traits = R.planning_traits()
    check("the interior schemas are neither line-final nor line-initial, so "
          "planning_traits emits no claims for them",
          traits["internal assonance"]["claims"] == ()
          and traits["internal consonance"]["claims"] == ())
    from quality import plan as PLN
    ok, refused = PLN.type_eligibility("eng")
    check("internal consonance is REFUSED loudly by name of its rule "
          "(BOTH-PRESENT), never planned without it",
          "internal consonance" not in ok
          and "BOTH-PRESENT" in refused.get("internal consonance", ""),
          refused.get("internal consonance"))
    check("internal assonance is refused with the reason its row states "
          "(registered for the views; the draw is not decided), so the "
          "eligible set and every seed's drawn types do not move",
          "internal assonance" not in ok and "internal rhyme" in ok
          and refused.get("internal assonance")
          == IA.unplanned and IA.unplanned, refused.get("internal assonance"))
    check("...and the eligible set is still the 31 it was",
          len(ok) == 31, len(ok))
    check("`unplanned` is neither compared nor printed, so no other row's "
          "repr moves", "unplanned" not in repr(IA))
    check("alliteration keeps its placement refusal (same line)",
          "inside one line" in refused.get("alliteration", ""),
          refused.get("alliteration"))
    words = PLN._channel_clause(IC.channels[1])
    check("the rule wording names the guard", "present in both P and Q"
          in words, words)


if __name__ == "__main__":
    for fn in (test_both_present, test_declarations, test_assonance,
               test_consonance, test_alliteration, test_pruning_is_sound,
               test_planner):
        fn()
    print("=" * 70)
    if FAILURES:
        print(f"{len(FAILURES)} FAILING: {', '.join(FAILURES)}")
        sys.exit(1)
    print("all connection-schema checks pass")
