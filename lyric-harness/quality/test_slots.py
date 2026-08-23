#!/usr/bin/env python3
"""Regressions for the SLOT coordinate — WHERE in a line a mandate binds.

Every enforcement layer here was built on one projection, the line's last
word, while doctrine 2's own first sentence says the pairwise matrix is the
primary object and letter schemes are lossy views of it. `quality/slots.py`
is the coordinate that makes the declaration layer able to say `L3.head` and
`L1.T4`, and `grade()` is the first consumer.

Sections:
  1  the DEFAULT slot IS `line_anchors` — byte-identical, structurally
  2  the spelling round-trips, over the WHOLE named table
  3  an anchor that names nothing is a SKIP, never a guess
  4  what REFUSES, and that each refusal names its remedy
  5  the mandate carries placement, and does not collapse two placements
  6  a WITHIN-LINE binding refuses and names the route that answers it
  7  `grade()` judges a declared slot with the SAME comparator
  8  the untouched path: an end-rhyme mandate is byte-identical
  9  `span_provenance` guards every key it reads (the crash this found)
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                ".."))

import lyric_harness as LH                                      # noqa: E402
from quality import relations as REL                            # noqa: E402
from quality import schemes as SC                               # noqa: E402
from quality import slots as SL                                 # noqa: E402
from quality.revise import Reviser                              # noqa: E402

FAILURES = []
LEX = LH.Lexicon()

#: One line with a content word at the head, a polysyllable mid-line and a
#: readable end, so every locus this path resolves has a referent in it. A
#: fixture that could not exercise a locus would let that locus's check pass
#: by examining nothing.
LINE = "Silver rivers carry morning light"

DRAFT = ["Silver rivers carry morning light",
         "A distant bell was warning",
         "The quiet water holds a silver",
         "Nothing here is calm or clever"]


def check(name, cond, detail=""):
    print(f"  {'PASS' if cond else 'FAIL'}  {name}")
    if detail:
        print(f"          {detail}")
    if not cond:
        FAILURES.append(name)


def test_default_is_line_anchors():
    print("\n1. the DEFAULT slot IS `line_anchors`, called and not copied")
    for text in DRAFT + [LINE, "", "zzzqx"]:
        want = LH.line_anchors(LEX, text)
        got = SL.resolve(LEX, text, 1)
        if want != got:
            check(f"default slot reproduces line_anchors on {text!r}", False,
                  f"{want!r} != {got!r}")
            return
    check("the default slot returns EXACTLY what `line_anchors` returns, on "
          "every fixture line plus an empty line and an unreadable one — the "
          "byte-identity that lets every stored mandate keep its reading",
          True, f"{len(DRAFT) + 2} lines, all identical")
    check("and with promote= carried through, since the promoted bare-final "
          "variant is part of what the default path means",
          LH.line_anchors(LEX, LINE, promote=True)
          == SL.resolve(LEX, LINE, 1, promote=True))
    check("`is_default` is true of a bare int, which is what makes an "
          "untouched mandate take the untouched path",
          SL.is_default(3) and SL.is_default(SL.Slot(3))
          and not SL.is_default(SL.parse_slot("3.head")))


def test_spelling_round_trips():
    print("\n2. the spelling round-trips over the WHOLE named table")
    bad = []
    for nm in SL.NAMED_SLOTS:
        spelled = SL.spell_slot(SL.parse_slot(f"7.{nm}"))
        want = "7" if nm == "end" else f"7.{nm}"
        if spelled != want:
            bad.append((nm, spelled, want))
    check("every name in NAMED_SLOTS parses and spells back to itself, so a "
          "name added without a spelling is a FAILING TEST rather than a "
          "slot that renders as `<locus/anchor>`",
          not bad, f"{len(SL.NAMED_SLOTS)} names; mismatches {bad}")
    check("a bare line number spells back bare — the default is invisible in "
          "the notation, as it is in the object",
          SL.spell_slot(SL.parse_slot("7")) == "7")
    check("a token index round-trips 1-BASED, and the 0-based `relations` "
          "index is converted in exactly one place",
          SL.spell_slot(SL.parse_slot("7.T3")) == "7.T3"
          and SL._declared_token(SL.parse_slot("7.T3").rule) == 2)
    check("the vocabulary is IMPORTED, not respelled: the default rule is "
          "`relations.END_ANCHOR` itself, so a change there moves this layer",
          SL.DEFAULT_RULE is REL.END_ANCHOR)


def test_anchor_with_no_referent():
    print("\n3. an anchor that names nothing is a SKIP, never a guess")
    # `The` is a function word: WEAK_ALWAYS zeroes its stress, so a
    # last-stressed anchor inside it has no referent at all.
    anc, lab, _ = SL.resolve(LEX, "The falcon rode above the windy plain",
                             SL.parse_slot("1.headrime"))
    check("a last-stressed anchor inside an unstressed function word returns "
          "NO anchor rather than falling back to the next word — the same "
          "answer `relations._anchor_pos` gives by raising NoReferent",
          anc == [] and lab == "",
          "line-initial `The` carries no stress")
    anc2, lab2, _ = SL.resolve(LEX, LINE, SL.parse_slot("1.headrime"))
    check("and it DOES resolve when the head word carries a stress, so the "
          "check above is about the referent and not about the locus",
          anc2 and lab2 == "Silver", f"label {lab2!r}")
    anc3, _, _ = SL.resolve(LEX, LINE, SL.parse_slot("1.T40"))
    check("a token index past the end of the line returns no anchor rather "
          "than the nearest word", anc3 == [])


def test_refusals():
    print("\n4. what REFUSES, and each refusal names its remedy")
    for spelling in ("1.nope", "1.T0", "x.head", "1."):
        try:
            SL.parse_slot(spelling)
            check(f"{spelling!r} refuses", False, "parsed instead")
        except SL.SlotUnsupported:
            pass
    check("four unspellable slots all refuse at PARSE time, so a writer is "
          "told while they still hold the sentence they got wrong", True)
    frame = []
    for locus, need in SL.FRAME_LOCI.items():
        rule = REL.SpanRule(locus, "word_start")
        try:
            SL.check(SL.Slot(1, rule))
            frame.append(locus)
        except SL.SlotUnsupported as e:
            if need.split()[0].strip("(") not in str(e) and need not in str(e):
                frame.append(f"{locus}:message-does-not-name-the-frame")
    check("every frame-blocked locus refuses AND names the frame it would "
          "need — a refusal that names a remedy is what stops the set being "
          "a list of things that mysteriously do not work",
          not frame, f"{len(SL.FRAME_LOCI)} frame loci; offenders {frame}")
    try:
        SL.check(SL.Slot(1, REL.SpanRule("line_final_token", "searched",
                                         1, (2, 5))))
        searched_refused = False
    except SL.SlotUnsupported as e:
        searched_refused = "multiplicity" in str(e) or "doctrine 56" in str(e)
    check("a SEARCHED anchor refuses, citing the multiplicity correction a "
          "mandated pair has nowhere to carry (doctrine 56) — the reason is "
          "the check, since refusing it for being unimplemented would be a "
          "different and weaker claim", searched_refused)
    try:
        SL.check(SL.Slot(1, REL.SpanRule("any_token", "word_start")))
        unindexed = False
    except SL.SlotUnsupported:
        unindexed = True
    check("an `any_token` locus with no declared index refuses: unindexed, "
          "it is a search over the line", unindexed)
    check("and the two vocabularies do not overlap, so no locus is both "
          "gradeable and frame-blocked",
          not (set(SL.GRADEABLE_LOCI) & set(SL.FRAME_LOCI)))


def test_mandate_carries_placement():
    print("\n5. the mandate carries placement, and keeps two placements apart")
    m = SC.mandate([[1, "2.head"], [3, 4]], n_lines=4)
    check("a group member spelling a place is accepted and the LINES are "
          "unchanged, so every site that does arithmetic on a group is "
          "untouched", m.groups == ((1, 2), (3, 4)))
    check("`slots_declared` is the one question a caller asks to decide "
          "whether to take the slot path at all",
          m.slots_declared() and not SC.mandate("ABAB", n_lines=4)
          .slots_declared())
    check("`slot_of` resolves a declared member and an undeclared one, so no "
          "caller repeats the absence rule (doctrine 1)",
          str(m.slot_of(0, 2)) == "2.head" and str(m.slot_of(0, 1)) == "1"
          and str(m.slot_of(1, 3)) == "3")
    try:
        m.slot_of(0, 4)
        member_guard = False
    except SC.NoMandate:
        member_guard = True
    check("asking for a NON-member's slot raises instead of answering with "
          "the default — 'binds at the end' and 'is not in this group' are "
          "different facts (doctrine 20)", member_guard)
    two = SC.mandate([[1, 2], ["1.head", "2.head"]], n_lines=4)
    check("END and HEAD over the SAME pair of lines are TWO groups: a song "
          "can ask for both, and a dedup key of line numbers alone would "
          "have collapsed the second into the first",
          len(two.groups) == 2 and two.groups[0] == two.groups[1]
          and str(two.slot_of(1, 1)) == "1.head")
    plain = SC.mandate("ABAB", n_lines=4)
    check("a mandate that declares no placement carries `loci` entries that "
          "are all empty — absence keeps ONE meaning",
          plain.loci == ("", "") and not plain.slots_declared())


def test_within_line_refusal():
    print("\n6. a WITHIN-LINE binding refuses and names the route")
    try:
        SC.mandate([["1.head", "1.end"]], n_lines=4)
        msg = ""
    except SC.NoMandate as e:
        msg = str(e)
    check("a group naming one line twice REFUSES rather than silently "
          "deduplicating to a singleton, which is what the set semantics "
          "would otherwise do", bool(msg))
    check("and the refusal names the route that DOES answer it — "
          "`relations.realise` reports same-line instances and "
          "`quality/figures.py` reads them — so the boundary is a pointer "
          "rather than a wall (doctrine 20)",
          "figures" in msg and "schema" in msg, msg[:120])


def test_grade_reads_the_slot():
    print("\n7. `grade()` judges a declared slot with the SAME comparator")
    rv = Reviser()
    m = SC.mandate([["1.T4", 2], [3, 4]], n_lines=4)
    g = rv.grade(DRAFT, m)
    v = [x for x in g["verdicts"] if x["lines"] == (1, 2)]
    check("the mid-line binding is GRADED: L1's 4th word against L2's end",
          len(v) == 1, f"{len(v)} verdict(s) for (1, 2)")
    if v:
        check("and it names the words the resolved span covers, not the "
              "line's end word — `morning` is L1's 4th token and `light` is "
              "its end",
              v[0]["endwords"] == ("morning", "warning"),
              f"{v[0]['endwords']}")
        check("scored by `best_score`, the comparator every threshold here "
              "was calibrated on — the placement moves, the judge does not",
              v[0]["relation"] == "RHYME" and v[0]["score"] >= 0.99
              and not v[0]["why"], f"{v[0]['score']:.3f} {v[0]['relation']}")
    # the same pair WITHOUT the slot is a different verdict, which is the
    # only shape that proves the coordinate was read rather than tolerated
    g2 = rv.grade(DRAFT, SC.mandate([[1, 2], [3, 4]], n_lines=4))
    v2 = [x for x in g2["verdicts"] if x["lines"] == (1, 2)]
    check("the IDENTICAL pair with no slot declared reaches a DIFFERENT "
          "verdict — byte-identical output would mean the flag was dropped, "
          "which is the check every declared coordinate in this repo needs",
          v and v2 and v2[0]["endwords"] != v[0]["endwords"],
          f"no slot: {v2[0]['endwords'] if v2 else None}")
    check("and the position handed to the named judge comes from the "
          "DECLARATION now: a head slot asks 'head', a default asks 'end'",
          SL.position_of(SL.parse_slot("3.head")) == "head"
          and SL.position_of(3) == "end")


def test_untouched_path():
    print("\n8. the untouched path: an end-rhyme mandate is byte-identical")
    rv = Reviser()
    g = rv.grade(DRAFT, SC.mandate("ABAB", n_lines=4))
    check("a plain letter mandate still grades its two pairs off the cached "
          "n x n matrix", len(g["verdicts"]) == 2)
    check("and its slot cache is never touched, so the ordinary run pays "
          "nothing for the coordinate existing",
          rv._slot_cache == {}, f"{len(rv._slot_cache)} entries")


def test_provenance_guard():
    print("\n9. `span_provenance` guards every key it reads")
    smap = LH.word_syllable_map(LEX, LINE)
    missing = [k for k in LH._PROVENANCE_KEYS if k not in smap[0]]
    check("`word_syllable_map` now emits the whole provenance tag set, so a "
          "span built from it can be attributed — it emitted `word`/`widx` "
          "only, and `span_provenance` GUARDED on `widx` while READING six",
          not missing, f"missing {missing}")
    anc, _, _ = SL.resolve(LEX, LINE, SL.parse_slot("1.T4"))
    prov = LH.span_provenance(anc[0])
    check("and a slot span actually answers: the crash this found was "
          "`KeyError: 'syl_in_word'` three frames down inside `best_score`",
          prov is not None and prov["words"] == ["morning"], f"{prov}")
    check("a span from a reader that tags NEITHER gets the documented None "
          "— 'cannot say' is this function's answer and a traceback is not "
          "a way of saying it",
          LH.span_provenance([{"nucleus": "AE", "coda": [], "onset": [],
                               "stress": 1}]) is None)
    check("`syl_in_word` is 1-BASED, matching `_tag_span_words`' own counter "
          "— 0-based here would make `partial_word` true of every span",
          smap[0]["syl_in_word"] == 1 and not prov["partial_word"])


def main():
    for fn in (test_default_is_line_anchors, test_spelling_round_trips,
               test_anchor_with_no_referent, test_refusals,
               test_mandate_carries_placement, test_within_line_refusal,
               test_grade_reads_the_slot, test_untouched_path,
               test_provenance_guard):
        fn()
    print(f"\n{'ALL PASS' if not FAILURES else 'FAILURES: ' + str(FAILURES)}")
    return 1 if FAILURES else 0


if __name__ == "__main__":
    sys.exit(main())
