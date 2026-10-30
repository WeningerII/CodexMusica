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
    if detail is not None and not isinstance(detail, R.Refusal) and detail:
        print(f"          {detail}")
    elif isinstance(detail, R.Refusal):
        print(f"          {detail.detail}")
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
    # ONE TRUTH TABLE (3PO's review, #637 6532626626): None is unknown
    # whether it arrives bare or inside a set.
    U = Readings({("R",), ()})
    table = (
        ("None ~ empty", None, (), False),
        ("empty ~ None", (), None, False),
        ("None ~ present", None, ("T",), None),
        ("present ~ None", ("T",), None, None),
        ("{None} ~ empty", frozenset({None}), (), False),
        ("empty ~ {None}", (), frozenset({None}), False),
        ("{None} ~ present", frozenset({None}), ("T",), None),
        ("uncertain set ~ empty", U, (), False),
        ("uncertain set ~ present", U, ("T",), None),
        ("None ~ None", None, None, None),
    )
    for label, x, y, want in table:
        r = bp(x, y)
        check(f"truth table: {label} -> {want}", r.value is want
              and r.informative is (want is not None), r)
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



def test_pair_channel_reads():
    print("\n-- 8. the shared channel read --")
    lines = ["the star was far from washing washington",
             "to watch the water in the woods"]
    st = stream(lines)

    def sp(rule, text):
        return [s for s in R.enumerate_spans(rule, st)
                if word(st, s) == text][0]
    LS = R.CHANNEL_READ_FAMILIES["last_stressed"][0]
    WS = R.CHANNEL_READ_FAMILIES["word_start"][0]
    a, b = sp(LS, "washing"), sp(LS, "washington")
    rec = R.pair_channel_reads(st, a, b, "last_stressed")
    check("the record names its family, alignment, anchors, occurrences, "
          "reading context and versions",
          rec["family"] == "last_stressed"
          and rec["align"] == ((0, 0), (1, 1))
          and rec["anchors"] == (a.anchor_pos, b.anchor_pos)
          and rec["occurrences"][0]["idx"] == a.idx
          and rec["occurrences"][1]["origin"] == b.origin
          and rec["reading_context"]["type"] == "merged"
          and rec["versions"]["channel_reads"] == R.CHANNEL_READ_VERSION,
          {k: v for k, v in rec.items() if k not in ("reads", "syllables")})
    check("overhang absent: washington's third syllable is in no read and "
          "no syllable record",
          all(qb in (0, 1) for vals in rec["reads"].values()
              for _qa, qb, _va, _vb in vals)
          and len(rec["syllables"]) == 2)
    inst = R.evaluate(R.REGISTRY["internal consonance"], a, b, st)
    judge_coda = [(q, r) for c, q, r in inst.reads][:2]
    check("values are exactly what the judge reads: coda AGREE over the "
          "record's coda pairs gives the instance's reads",
          [R.AGREE(va, vb).value for _qa, _qb, va, vb in rec["reads"]["coda"]]
          == [r.value for _q, r in judge_coda])
    check("each syllable record carries onset, nucleus, coda and prominence, "
          "equal to the channel reads",
          all(set(sa) == set(sb) == set(R.CHANNEL_READ_CHANNELS)
              for sa, sb in rec["syllables"])
          and rec["syllables"][1][0]["coda"] == rec["reads"]["coda"][1][2])

    # SUBSET ORDER: asking nucleus first and coda later tells the coda
    # caller exactly what a fresh coda request on a fresh stream does.
    st2 = stream(lines)
    a2, b2 = [s for s in R.enumerate_spans(LS, st2)
              if word(st2, s) in ("washing", "washington")]
    first = R.pair_channel_reads(st2, a2, b2, "last_stressed",
                                 channels=("nucleus",))
    later = R.pair_channel_reads(st2, a2, b2, "last_stressed",
                                 channels=("coda",))
    st3 = stream(lines)
    a3, b3 = [s for s in R.enumerate_spans(LS, st3)
              if word(st3, s) in ("washing", "washington")]
    fresh = R.pair_channel_reads(st3, a3, b3, "last_stressed",
                                 channels=("coda",))
    check("subset order: coda asked after nucleus equals a fresh coda, and "
          "each caller sees only what it asked for",
          later["reads"] == fresh["reads"] and set(first["reads"])
          == {"nucleus"} and set(later["reads"]) == {"coda"})
    check("...and the cache holds one COMPLETE record for the pair, not one "
          "per caller", len(st2._channel_read_cache) == 1)

    # FAMILY SEPARATION.
    wl, wt = sp(LS, "water"), sp(LS, "watch")
    ref = R.pair_channel_reads(st, wl, wt, "word_start")
    check("a last-stressed span of a polysyllable is refused by the "
          "word_start family, naming the family's rule",
          isinstance(ref, R.Refusal) and "word_start" in ref.detail, ref)
    hw, ht = sp(WS, "water"), sp(WS, "washington")
    ref2 = R.pair_channel_reads(st, hw, ht, "last_stressed")
    check("...and a word_start span is refused by last_stressed",
          isinstance(ref2, R.Refusal), ref2)
    check("an unknown family is refused",
          isinstance(R.pair_channel_reads(st, a, b, "rime"), R.Refusal))
    ma, mb = sp(LS, "watch"), sp(LS, "woods")
    na, nb = sp(WS, "watch"), sp(WS, "woods")
    before = len(st._channel_read_cache)
    one = R.pair_channel_reads(st, ma, mb, "last_stressed")
    two = R.pair_channel_reads(st, na, nb, "word_start")
    check("family separation: the same two monosyllables under the two "
          "families are two records under two keys",
          len(st._channel_read_cache) == before + 2
          and one["family"] == "last_stressed"
          and two["family"] == "word_start", len(st._channel_read_cache))

    # UNCERTAIN STAYS A SET.
    sa_, sf = sp(LS, "star"), sp(LS, "far")
    cod = R.pair_channel_reads(st, sa_, sf, "last_stressed")["reads"]["coda"]
    check("uncertain preserved: star ~ far's rhotic coda comes back as the "
          "set of its readings, not one value",
          R.uncertain(cod[0][2]) and R.uncertain(cod[0][3])
          and cod[0][2] == frozenset({("R",), ()}), cod)

    # A PINNED WHOLE READING: the record says which readings it was read
    # under, and the uncertain coda becomes the one that reading has.
    # READING CONTEXT, PER MEMBER (3PO's review, #637 6532644831): "pinned"
    # only when both members are read under a pinned whole reading.
    def ctx_under(tokens):
        combos, _complete = R.reading_combos(st, set(tokens))
        pick = [c for c in combos
                if all(c[t][2][-1] == "R" for t in tokens)][0]
        pst = R.build_stream(lines, R.pinned_phonology(st, pick),
                             declaration={"language": "eng"})
        pa = [x for x in R.enumerate_spans(LS, pst)
              if word(pst, x) == "star"][0]
        pf = [x for x in R.enumerate_spans(LS, pst)
              if word(pst, x) == "far"][0]
        return R.pair_channel_reads(pst, pa, pf, "last_stressed")
    both = ctx_under([(0, 1), (0, 3)])
    one = ctx_under([(0, 1)])
    none = R.pair_channel_reads(st, sa_, sf, "last_stressed")
    bc, oc, nc = (r["reading_context"] for r in (both, one, none))
    check("both members pinned -> 'pinned', each member naming its witness, "
          "and neither coda is a set any more",
          bc["type"] == "pinned"
          and [m["pinned"] for m in bc["members"]] == [True, True]
          and bc["members"][0]["witness"] == "star = S T AA1 R"
          and bc["members"][1]["witness"] == "far = F AA1 R"
          and not R.uncertain(both["reads"]["coda"][0][2])
          and not R.uncertain(both["reads"]["coda"][0][3]), bc)
    check("one member pinned -> 'partial': star names its witness, far is "
          "unpinned and keeps its residual reading set",
          oc["type"] == "partial"
          and [m["pinned"] for m in oc["members"]] == [True, False]
          and "witness" not in oc["members"][1]
          and not R.uncertain(one["reads"]["coda"][0][2])
          and R.uncertain(one["reads"]["coda"][0][3]), oc)
    check("no member pinned -> 'merged'",
          nc["type"] == "merged"
          and [m["pinned"] for m in nc["members"]] == [False, False], nc)

    # VERSIONS name the family's span rule and alignment, the ChannelSet,
    # the resource and the reading policy.
    v = rec["versions"]
    check("versions name the span rule, the aligner, the ChannelSet, the "
          "declaration digest and the reading policy",
          v["span_rule"]["locus"] == "any_token"
          and v["span_rule"]["anchor"] == "last_stressed"
          and v["span_rule"]["magnitude"] == "to_word_end"
          and v["align"] == "anchor" and v["channel_set"]
          and v["declaration"] and "readings" in v["policy"]
          and R.pair_channel_reads(st, na, nb, "word_start")["versions"][
              "align"] == "flush_left", dict(v))

    # IMMUTABLE: a caller cannot corrupt what the cache tells the next one.
    got = R.pair_channel_reads(st, a, b, "last_stressed")
    snapshot = (got["syllables"], tuple(got["reads"].items()))
    blocked = 0
    import operator
    for poke in (lambda: operator.setitem(got["syllables"][0][0], "coda", 1),
                 lambda: operator.setitem(got["reads"], "coda", ()),
                 lambda: operator.setitem(got["occurrences"][0], "line", 9),
                 lambda: operator.setitem(got["versions"], "align", "x")):
        try:
            poke()
        except TypeError:
            blocked += 1
    got["family"] = "mutated"
    again = R.pair_channel_reads(st, a, b, "last_stressed")
    check("a returned record is read-only below the top level, and mutating "
          "the top level does not change a later call",
          blocked == 4 and again["family"] == "last_stressed"
          and (again["syllables"], tuple(again["reads"].items()))
          == snapshot, blocked)


if __name__ == "__main__":
    for fn in (test_both_present, test_declarations, test_assonance,
               test_consonance, test_alliteration, test_pruning_is_sound,
               test_planner, test_pair_channel_reads):
        fn()
    print("=" * 70)
    if FAILURES:
        print(f"{len(FAILURES)} FAILING: {', '.join(FAILURES)}")
        sys.exit(1)
    print("all connection-schema checks pass")
