#!/usr/bin/env python3
"""Mosaic rhyme as R2 ruled it (2026-10-31, `MISSING.md` M-311 F1).

    python3 quality/test_mosaic_rhyme.py

THE DEFECT: with the overhang EXCLUDED and `word_count_differs`, any end
rhyme passed when the other line had a word before its rhyme (cold ~ story
told, light ~ morning bright, and M-325's own witness about ~ went out), and
a syllable-by-syllable coda read failed real mosaics on where the dictionary
splits syllables (TEN|DER coda N against SEND|HER coda ND). BB8's findings,
#637 6545528961; independently reproduced by Jony Ives, 6545629461.

THE RULE (R2, #637 6545559338 as corrected by 6545666653):
  * ANCHOR: align the two members syllable by syllable from their line ends;
    the members start at the first aligned pair, counting back, whose
    syllables are BOTH prominent, and on at least one side nothing after that
    start is prominent. The phonology's prominence already reads an enclitic
    (`it`, `a`) as weak; no word list lives in `relations.py` (P10).
  * SPAN: anchor to line end on each side, equal syllable counts
    (`unmatched='forbid'`).
  * MOSAIC iff at least one member crosses a word boundary.
  * COMPARE: one phone string from the first vowel, across word and syllable
    boundaries (`TAIL-PHONES-AGREE` over `rime_phones`), vowels under the
    phonology's `reduced_vowel` quotient (unprominent AH and IH are one
    vowel).
  * OVER READINGS: a member holds under SOME whole reading of its words,
    searched by `resolve_line_pair` word by word (`reading_combos`), never
    syllable by syllable (3PO, 6545699967); a word that cannot be varied no
    longer sinks the search, and only a True is kept from one that skips it.

HELD FOR JOHN (canon, not built): the weak-form `her` without /h/ as an
alternate reading, so `tender ~ send her` is pinned FALSE here until it lands.
"""

import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))

import lyric_harness  # noqa: E402,F401
from quality import phonology as PH  # noqa: E402
from quality import relations as R  # noqa: E402
from quality import quotients as Q  # noqa: E402

FAILURES = []
PHON = PH.get("eng")
MO = R.REGISTRY["mosaic rhyme"]


def check(name, cond, detail=""):
    print(f"  {'PASS' if cond else 'FAIL'}  {name}")
    if detail:
        print(f"          {detail}")
    if not cond:
        FAILURES.append(name)


def stream(lines):
    return R.build_stream(lines, PHON, declaration={"language": "eng"})


def grade(a, b):
    """The census's grade route: one group, the schema as default relation."""
    from quality.revise import Reviser
    from quality.schemes import mandate
    got = Reviser().grade([a, b], mandate([["1", "2"]], n_lines=2,
                                          default_relation="schema:mosaic rhyme"))
    if got["refusals"]:
        return None
    return not got["violations"]


#: R2's after-set (6545666653) and Jony Ives's acceptance rows (6545649887).
AFTER_SET = (
    # -- must be False: an end rhyme with a word before it is not a mosaic --
    (False, "the night was cold", "the story told"),
    (False, "I saw the light", "the morning bright"),
    (False, "we walked along the shore", "I loved her more"),
    (False, "I never had a chance to be a hero",
     "the counter on the wall went down to zero"),
    # M-325's witness: its INDEXING fix stands, the pair was never a mosaic.
    (False, "what is it about", "my lights went out"),
    # both members multi-word, the anchor inside the final words
    (False, "I felt the cold", "the story the told"),
    (False, "the cold", "the told"),
    # one word each side: no boundary anywhere
    (False, "whatever you're after", "the laughter"),
    # -- must be True ------------------------------------------------------
    (True, "she was a gentle poet", "and surely you know it"),
    (True, "and surely you know it", "she was a gentle poet"),
    # both members multi-word, both crossing (R2's ambiguity 2)
    (True, "I know it", "you show it"),
    # Gilbert, "The Pirates of Penzance" (1879): `a` is AH0 or EY1, and the
    # mosaic holds under the first (rule 5, over readings)
    (True, "In short, when I've a smattering of elemental strategy,",
     "You'll say a better Major-General has never sat a gee."),
    # content words only, one reading each, the syllable split differing
    # (P IH1 | L OW0 against S T IH1 L | OW1; W IH1 N | D OW0 against
    # TH IH1 N | D OW1): the juncture case the coda read used to fail
    (True, "my pillow", "be still owe"),
    (True, "my window", "fresh thin dough"),
    # -- HELD: needs the weak-form `her` reading (John) ---------------------
    (False, "her heart was always tender", "the letter I will send her"),
)


def test_after_set():
    for want, a, b in AFTER_SET:
        got = grade(a, b)
        check(f"{a!r} / {b!r} -> {want}", got is want, f"graded {got}")


def test_unreadable_member_refuses():
    # Telfer, eng_celtic_msm_james_telfer.txt:58-59, the census's old
    # contrast: `cauld` is not in the dictionary, so a span through it cannot
    # be ruled out and the pair REFUSES -- doctrine 79, never a False.
    got = grade('"Sweet summer now is by,', "And cauld winter is nigh,")
    check("an unreadable word in reach refuses (Telfer's by / cauld ... nigh)",
          got is None, f"graded {got}")


def test_coherent_readings():
    # The merged stream keeps each channel's readings as separate sets: `a`
    # is nucleus {AH, EE, EY} and prominence {0, 1}, with no record of which
    # go together. So the sequence over it REFUSES (no syllable-by-syllable
    # mixing, 3PO 6545699967), and the any-reading route rebuilds the line
    # under each whole reading of the word (`reading_combos`, accent-agreeing)
    # and judges again: the witness names the reading that held.
    st = stream(["sat a gee"])
    toks = [st.tokens[k] for k in sorted(st.tokens)]
    span = R.Span(tuple(i for t in toks for i in t), 0)
    got = R._seq(span, st, "rime_phones", R.DEFAULT_CHANNELS, "phonemic")
    check("a sequence over a merged syllable is not one reading: it lists the "
          "per-syllable mixes, for refutation only",
          isinstance(got, R.PhoneMixes), f"got {got}")
    bound = R.replace(R.TAIL_PHONES_AGREE, partition=Q.reduced_vowel)
    v = bound(got, got)
    check("a mix that agrees never answers True: only a whole reading can",
          v.value is None, str(v))
    lines = ["In short, when I've a smattering of elemental strategy,",
             "You'll say a better Major-General has never sat a gee."]
    st = stream(lines)
    verdict, witness = R.resolve_line_pair(
        MO, st, (1, 2), lambda p: R.build_stream(lines, p, declaration={"language": "eng"}))
    check("Gilbert holds under a whole reading of `a`, named in the witness",
          verdict is True and witness is not None, f"{verdict} {witness}")
    # `Major-General` cannot be varied (no locatable reading), so the search
    # varies the words that can be and keeps only a True from it.
    combos, _ = R.reading_combos(st, {(1, 4)})
    check("the hyphenated compound in reach has no varied reading", combos is None)


def test_anchor_is_exact_over_prominence():
    # 3PO's reproduction (#637 6548737712): five syllables a side, every
    # prominence uncertain, so 2**10 combinations. The only fitting one is
    # index 528, pa = pb = (1, 0, 0, 0, 0), after the 257 the anchor used to
    # sample, so it answered False. Every combination is tried now: readings
    # that disagree leave the anchor undecided, and the fitting reading,
    # pinned, places it.
    from dataclasses import replace
    st = stream(["the yellow pillow of a fellow", "the mellow willow of a cello"])
    both = type(st.units[0].syl.prominence)({0, 1})
    lines = {}
    for i, u in enumerate(st.units):
        lines.setdefault(u.line, []).append(i)
    a_idx, b_idx = tuple(lines[0][-5:]), tuple(lines[1][-5:])

    def pin(values):
        for i, v in zip(a_idx + b_idx, values):
            st.units[i] = replace(st.units[i], syl=replace(st.units[i].syl, prominence=v))
    anchor = R.Placement("mosaic_anchor")
    a, b = R.Span(a_idx, 0), R.Span(b_idx, 0)
    pin([both] * 10)
    got = anchor.holds(a, b, st)
    check("every prominence uncertain: the anchor is undecided, never False",
          got is None, f"got {got}")
    pin([1, 0, 0, 0, 0] * 2)
    got = anchor.holds(a, b, st)
    check("index 528 pinned (pa = pb = (1, 0, 0, 0, 0)): the anchor holds",
          got is True, f"got {got}")
    pin([0, 0, 0, 0, 0] * 2)
    got = anchor.holds(a, b, st)
    check("no prominence on either side: no anchor", got is False, f"got {got}")


def test_refuted_over_every_mix():
    # #657 (test_schema_report): `to` and `the` carry two prominences and
    # `record` two stress patterns, so the whole-reading search needs 486
    # combinations against a cap of 64 and stopped undecided -- a refusal in
    # the writer's grade. No per-syllable mix of either member's readings
    # spells a tail the other's can, so no whole reading does: False.
    lines = ["we carry the evening to the record", "we carry the evening to the night"]
    got = R.line_pairs_for(MO, stream(lines), keep_refusal=True, requested_pairs={(1, 2)})
    check("record / night: refuted over every mix of readings, without the search",
          got.verdict((1, 2)) is False, f"{got.verdict((1, 2))}")


def test_predicate():
    bound = R.replace(R.TAIL_PHONES_AGREE, partition=Q.reduced_vowel)
    v = bound(("P", "OW:1", "AH:0", "T"), ("N", "OW:1", "IH:0", "T"))
    check("reduced AH and IH agree, the onset before the first vowel dropped",
          v.value is True, str(v))
    v = bound(("P", "OW:1", "AH:1", "T"), ("N", "OW:1", "IH:1", "T"))
    check("prominent AH and IH stay distinct", v.value is False, str(v))
    v = bound(("T", "EH:1", "N", "D", "ER:0"), ("S", "EH:1", "N", "D", "HH", "ER:0"))
    check("the /h/ of `her` is compared (the weak form is a reading, held)",
          v.value is False, str(v))
    v = R.TAIL_PHONES_AGREE(("OW:1",), ("OW:1",))
    check("no reduced-vowel quotient declared: a refusal, not a verdict",
          v.value is None, str(v))
    check("English declares the quotient on its phonology",
          getattr(PHON, "quotients", {}).get("reduced_vowel") is Q.reduced_vowel)


if __name__ == "__main__":
    for fn in (test_predicate, test_anchor_is_exact_over_prominence, test_refuted_over_every_mix,
               test_coherent_readings,
               test_after_set, test_unreadable_member_refuses):
        fn()
    print("=" * 70)
    if FAILURES:
        print(f"{len(FAILURES)} FAILING: {', '.join(FAILURES)}")
        sys.exit(1)
    print("all mosaic-rhyme checks pass")
