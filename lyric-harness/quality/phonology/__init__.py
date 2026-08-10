#!/usr/bin/env python3
"""Per-language phonology — known gap 6, for the three cheapest cells.

Known gap 6 has said since the first commit that Welsh, Indic and Old Norse are
"blocked on transcription". `quality/POSITIVE_CONTROL.md` named Finnish, Somali
and Chinese as the three cheapest to unblock, and they are cheap for three
DIFFERENT reasons, which is why they get three different implementations rather
than one G2P with three tables:

  cym  a near-phonemic orthography whose EIGHT DIGRAPHS are single
       consonants -- and the consonant skeleton is the whole of cynghanedd
  fin  a near-phonemic orthography and fully regular syllabification rules
  som  a phonemic 1972 Latin orthography with a very restrictive syllable shape
  ltc  one character = one syllable, and the sound classes are LEXICALISED in a
       rime dictionary, so it is a lookup and not a G2P problem at all

THE COMMITMENTS, INHERITED FROM quality/ipa.py

1. **Notation is declared, never sniffed.** Each module states what it reads.
2. **Unknown never produces an answer.** Out-of-inventory input returns None,
   not a guess and not a fallback to another language. `ipa.py` established
   this and it matters more here: a Middle Chinese character absent from the
   rime book must NOT quietly fall back to modern Mandarin, which is a
   different language for rhyme purposes.
3. **No defaulting to English.** Nothing here consults CMUdict.

WHAT THE TIME LAYER NEEDS, AND WHY PROMINENCE IS NOT ALWAYS STRESS

The layer indexes positions on a grid. English is stress-timed, so its grid is
the stress. That does not generalise, and pretending it does is the monoculture
error in miniature:

  fin  fixed initial stress -- the grid IS the stress, and it is free
  som  PITCH ACCENT, not stress. Somali metre is quantitative, so the grid is
       the MORA. `prominence` is left None and a stress grid is refused.
  ltc  no stress. The relevant binary is tone class 平 vs 仄, which is what the
       regulated-verse template constrains, so that is what `prominence` carries

So `Phonology.grid_unit` is a declared coordinate per language, and a caller
that assumes "stress" gets an explicit refusal rather than a wrong number.
"""

import os
import sys
from dataclasses import dataclass, field

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", ".."))


@dataclass
class Syllable:
    """One syllable in a declared notation.

    `prominence` is None when the language has no binary prominence the grid
    can use. That is a refusal, not a zero.
    """
    text: str
    onset: tuple = ()
    nucleus: str = ""
    coda: tuple = ()
    prominence: object = None      # 1 / 0 / None
    moras: int = 1

    def key(self):
        """The sound-identity key for rhyme within this notation."""
        return (self.nucleus, self.coda)


class Unsupported(Exception):
    """Raised when a caller asks a language for something it does not have."""


class Phonology:
    """Interface. Every field is declared; none is inferred."""

    language = "unset"
    name = "unset"
    notation = "unset"
    grid_unit = "syllable"
    prominence_rule = "none"
    relation = "none"
    source = "rules only; no external resource"

    def syllabify(self, word):
        raise NotImplementedError

    def prominences(self, word):
        return [s.prominence for s in self.syllabify(word)]

    def alliterates(self, a, b):
        """-> True / False / None. None means 'cannot tell', never a guess."""
        return None

    def rhymes(self, a, b):
        return None

    def declaration(self):
        return {
            "language": self.language, "name": self.name,
            "notation": self.notation, "grid_unit": self.grid_unit,
            "prominence_rule": self.prominence_rule,
            "relation": self.relation, "source": self.source,
        }


_REGISTRY = {}


def register(p):
    _REGISTRY[p.language] = p
    return p


def get(language):
    if language not in _REGISTRY:
        raise Unsupported(
            f"no phonology declared for {language!r}. Declared: "
            f"{sorted(_REGISTRY)}. A language without a declared phonology is "
            f"refused rather than scored with another language's rules.")
    return _REGISTRY[language]


def declared():
    return sorted(_REGISTRY)


from quality.phonology import cym, fas, fin, ltc, non, san, som  # noqa: E402,F401
