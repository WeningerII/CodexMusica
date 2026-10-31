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
    boundaries (`RIME-TAIL-AGREE` over `rime_phones`), vowels under the
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
    check("a sequence over a merged syllable refuses rather than mix readings",
          got is None, f"got {got}")
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


def test_predicate():
    bound = R.replace(R.RIME_TAIL_AGREE, partition=Q.reduced_vowel)
    v = bound(("P", "OW:1", "AH:0", "T"), ("N", "OW:1", "IH:0", "T"))
    check("reduced AH and IH agree, the onset before the first vowel dropped",
          v.value is True, str(v))
    v = bound(("P", "OW:1", "AH:1", "T"), ("N", "OW:1", "IH:1", "T"))
    check("prominent AH and IH stay distinct", v.value is False, str(v))
    v = bound(("T", "EH:1", "N", "D", "ER:0"), ("S", "EH:1", "N", "D", "HH", "ER:0"))
    check("the /h/ of `her` is compared (the weak form is a reading, held)",
          v.value is False, str(v))
    v = R.RIME_TAIL_AGREE(("OW:1",), ("OW:1",))
    check("no reduced-vowel quotient declared: a refusal, not a verdict",
          v.value is None, str(v))
    check("English declares the quotient on its phonology",
          getattr(PHON, "quotients", {}).get("reduced_vowel") is Q.reduced_vowel)


if __name__ == "__main__":
    for fn in (test_predicate, test_coherent_readings, test_after_set,
               test_unreadable_member_refuses):
        fn()
    print("=" * 70)
    if FAILURES:
        print(f"{len(FAILURES)} FAILING: {', '.join(FAILURES)}")
        sys.exit(1)
    print("all mosaic-rhyme checks pass")
