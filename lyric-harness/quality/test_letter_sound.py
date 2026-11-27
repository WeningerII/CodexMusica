#!/usr/bin/env python3
"""Regressions for `quality/letter_sound.py`: which letters spell which sounds.

Bug hunt finding 17 (2026-11-21): the same-spelled-ending ban took the wrong
stretch of a word because it counted groups of vowel letters where it needed
vowel sounds. Every worked word below is declared with the ending it must
give, so a new example is a row in a table and not a sentence in a comment.

Sections:
  1  the three ways the letter count went wrong, each with its control
  2  a vowel sound starts at the first letter of the group that spells it
  3  a word that does not line up says so, and the caller can fall back
  4  the whole dictionary: almost every word lines up, and every answer is
     a real ending of its own word

Run: python3 quality/test_letter_sound.py
"""

import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
sys.path.insert(0, os.path.join(HERE, "..", ".."))

from lyric_harness import Lexicon  # noqa: E402
from quality import letter_sound as LS  # noqa: E402

FAILURES = []


def check(name, cond, detail=""):
    print(f"  {'PASS' if cond else 'FAIL'}  {name}")
    if detail:
        print(f"          {detail}")
    if not cond:
        FAILURES.append(name)


def latest_stress_from_end(phones):
    """The rhyme judge's own anchor (`lyric_harness.anchor`): the latest
    vowel sound carrying primary or secondary stress, counted from the end;
    the last vowel sound when none is stressed."""
    vowels = [p for p in phones if LS.is_vowel_sound(p)]
    for idx in range(len(vowels) - 1, -1, -1):
        if vowels[idx][-1] in "12":
            return len(vowels) - idx
    return 1


def ending(lex, word):
    """The word's letters from its rhyming vowel on, or None."""
    phones, unread = lex.transcribe_word(word)
    if unread or not phones:
        return None
    return LS.spelled_from(word, phones, latest_stress_from_end(phones))


#: (word, the ending it must give, why the row is here)
ENDINGS = (
    # --- a silent e inside the word ----------------------------------------
    ("nicely", "icely", "three letter groups, two vowel sounds"),
    ("precisely", "isely", "the same, one syllable longer"),
    ("placement", "acement", "silent e before a consonant ending"),
    ("basement", "asement", "its partner in the handoff's example"),
    ("lately", "ately", "was `ely`, the same as `nicely`"),
    ("greatly", "eatly", "control: no silent e, already right"),
    ("completely", "etely", "silent e, stress one syllable in"),
    ("statement", "atement", "silent e, was `ement`"),
    ("lonely", "onely", "silent e, was `ely`"),
    # --- one letter group spelling two vowel sounds -------------------------
    ("create", "ate", "`ea` is two sounds here; was `eate`"),
    ("relate", "ate", "control: its rhyme partner, already right"),
    ("replying", "ying", "`yi` is two sounds; was `eplying`"),
    ("dying", "ying", "control: its rhyme partner"),
    ("idea", "ea", "`ea` is two sounds; was `idea`"),
    ("desire", "ire", "the last e is silent, so the count ran one over"),
    ("fire", "ire", "control: its rhyme partner"),
    # --- a vowel letter spelling a consonant sound ---------------------------
    ("queen", "een", "u is the w sound; was `ueen`"),
    ("green", "een", "control: its rhyme partner"),
    ("guide", "ide", "u is silent after g; was `uide`"),
    ("side", "ide", "control: its rhyme partner"),
    ("year", "ear", "y is a consonant here; was `year`"),
    ("near", "ear", "control: its rhyme partner"),
    ("yet", "et", "y is a consonant here; was `yet`"),
    ("yield", "ield", "y is a consonant here; was `yield`"),
    # --- a final e the old rule folded into the wrong group ------------------
    ("agree", "ee", "`ee` was taken for a silent e; was `agree`"),
    ("walked", "alked", "the e of -ed is silent; was `ed`"),
    ("tongue", "ongue", "the final `ue` is silent; was `ue`"),
    ("isles", "isles", "was `es`, the same as `smiles`"),
    ("smiles", "iles", "so this pair is no longer one spelled ending"),
    ("rhymes", "ymes", "was `es`"),
    ("times", "imes", "was `es`"),
    # --- the rhyme sits on a later, weaker stress ----------------------------
    ("sunlight", "ight", "the judge anchors on the latest stress"),
    ("tight", "ight", "control: its rhyme partner"),
    ("playground", "ound", "the same, with `ground`"),
    ("ground", "ound", "control"),
    ("evermore", "ore", "the same, with `shore`"),
    ("recall", "all", "the same, with `all`"),
    # --- plain words that were right and must stay right ---------------------
    ("hair", "air", ""), ("chair", "air", ""),
    ("light", "ight", ""), ("night", "ight", ""),
    ("away", "ay", ""), ("today", "ay", ""),
    ("silver", "ilver", "these two must stay apart"),
    ("deliver", "iver", ""),
    ("bone", "one", ""), ("sown", "own", ""),
    ("nation", "ation", ""), ("station", "ation", ""),
    ("singing", "inging", ""), ("ringing", "inging", ""),
    ("heart", "eart", ""), ("part", "art", ""),
    ("know", "ow", ""), ("go", "o", ""),
)

#: (word a, word b, same spelled ending?) -- read off the table above, so a
#: wrong row there fails here by name.
PAIRS = (
    ("nicely", "precisely", False),
    ("placement", "basement", False),
    ("lately", "greatly", False),
    ("isles", "smiles", False),
    ("rhymes", "times", False),
    ("silver", "deliver", False),
    ("bone", "sown", False),
    ("heart", "part", False),
    ("create", "relate", True),
    ("sunlight", "tight", True),
    ("playground", "ground", True),
    ("replying", "dying", True),
    ("desire", "fire", True),
    ("queen", "green", True),
    ("guide", "side", True),
    ("year", "near", True),
    ("hair", "chair", True),
    ("light", "night", True),
    ("away", "today", True),
    ("nation", "station", True),
    ("singing", "ringing", True),
)


def test_declared_endings(lex):
    print("\n1. the declared endings")
    for word, want, why in ENDINGS:
        got = ending(lex, word)
        check(f"{word} -> {want}" + (f"  ({why})" if why else ""),
              got == want, f"got {got!r}" if got != want else "")
    for a, b, same in PAIRS:
        ea, eb = ending(lex, a), ending(lex, b)
        check(f"{a}/{b}: {'one' if same else 'two different'} spelled "
              f"ending{'' if same else 's'}",
              ea is not None and eb is not None and (ea == eb) == same,
              f"{ea!r} against {eb!r}")


def test_earliest_letter():
    print("\n2. a vowel sound starts at the first letter of its group")
    rows = (
        ("queen", ["K", "W", "IY1", "N"], [2]),
        ("great", ["G", "R", "EY1", "T"], [2]),
        ("you", ["Y", "UW1"], [1]),
        ("beauty", ["B", "Y", "UW1", "T", "IY0"], [1, 5]),
        ("people", ["P", "IY1", "P", "AH0", "L"], [1, 4]),
        ("rhythm", ["R", "IH1", "DH", "AH0", "M"], [2, 5]),
        ("create", ["K", "R", "IY0", "EY1", "T"], [2, 3]),
        ("box", ["B", "AA1", "K", "S"], [1]),
        ("one", ["W", "AH1", "N"], [0]),
    )
    for word, phones, want in rows:
        got = LS.vowel_starts(word, phones)
        check(f"{word}: vowel sounds start at letters {want}", got == want,
              f"got {got}" if got != want else "")
    check("the same word and sounds always give the same answer",
          all(LS.align(w, p) == LS.align(w, p) for w, p, _ in rows))


def test_refusals():
    print("\n3. a word that does not line up says so")
    check("a spelled-out initialism returns None, not a guess",
          LS.spelled_from("tv", ["T", "IY1", "V", "IY1"], 1) is None)
    check("no letters returns None", LS.vowel_starts("'", ["AH0"]) is None)
    check("no sounds returns None", LS.vowel_starts("word", []) is None)
    check("a count past the first vowel sound gives the whole word from "
          "that vowel, never an error",
          LS.spelled_from("light", ["L", "AY1", "T"], 5) == "ight")
    check("marks around the word are ignored, as the ban ignores them",
          LS.spelled_from("light,", ["L", "AY1", "T"], 1) == "ight"
          and LS.letters_of("Don't!") == "dont")


def test_whole_dictionary(lex):
    print("\n4. the whole dictionary")
    total = bad = wrong = 0
    sample = []
    for word, prons in lex.entries.items():
        if not word.isalpha():
            continue
        total += 1
        phones = list(prons[0])
        starts = LS.vowel_starts(word, phones)
        if starts is None:
            bad += 1
            continue
        vowels = [p for p in phones if LS.is_vowel_sound(p)]
        if (len(starts) != len(vowels) or starts != sorted(starts)
                or any(not 0 <= s < len(word) for s in starts)):
            wrong += 1
            if len(sample) < 5:
                sample.append((word, phones, starts))
    share = bad / max(total, 1)
    check(f"at most 1% of the dictionary's words do not line up "
          f"({bad} of {total}, {share:.2%})", total > 50000 and share <= 0.01)
    check("every answer has one start per vowel sound, in order, inside "
          "the word", wrong == 0, str(sample) if wrong else "")


def test_the_ban_reads_these_endings(reviser):
    print("\n5. the same-spelled-ending ban reads these endings")
    # `latest_stress_from_end` above is this file's own copy of the anchor
    # rule. The ban's key is `Reviser._spelled_rime`; if the two ever parted,
    # sections 1 to 4 would go on passing about a function nothing calls.
    words = sorted({w for w, _want, _why in ENDINGS}
                   | {w for a, b, _same in PAIRS for w in (a, b)})
    apart = [(w, reviser._spelled_rime(w), ending(reviser.lex, w))
             for w in words
             if reviser._spelled_rime(w) != ending(reviser.lex, w)]
    check(f"`Reviser._spelled_rime` gives the declared ending for all "
          f"{len(words)} words of the two tables", not apart, str(apart[:5]))
    off = [(a, b) for a, b, same in PAIRS
           if (reviser._spelled_rime(a) == reviser._spelled_rime(b)) != same]
    check("...and the same one-ending / two-endings answer for every pair",
          not off, str(off))


def main():
    from quality.revise import Reviser
    lex = Lexicon()
    reviser = Reviser(lex=lex)
    test_declared_endings(lex)
    test_earliest_letter()
    test_refusals()
    test_whole_dictionary(lex)
    test_the_ban_reads_these_endings(reviser)
    print()
    if FAILURES:
        print(f"{len(FAILURES)} FAILED:")
        for name in FAILURES:
            print(f"  - {name}")
        return 1
    print("all checks passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
