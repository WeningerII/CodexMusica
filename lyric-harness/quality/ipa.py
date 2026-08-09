#!/usr/bin/env python3
"""IPA-aware phoneme layer.

WHY THIS EXISTS

The engine could not read a single non-English phoneme. `split_phone` in
lyric_harness.py parses with `([A-Z]+)(\\d)?$`, which is ARPABET and only
ARPABET, so every IPA lexicon died before reaching a similarity function.
Verified against the real code:

    split_phone('yː')      -> AttributeError   (regex did not match)
    split_phone('ç')       -> AttributeError
    cons_sim('N', 'ˀ')     -> KeyError: 'ˀ'    (Danish stod)
    vowel_sim('yː', 'uː')  -> KeyError: 'yː'
    vowel_sim('yː', 'yː')  -> 1.0              (early a==b short-circuit,
                                                never touches the table)

That last line is the dangerous one: identical unknown symbols score a
confident 1.0 while different ones crash. A corpus of unknown phonemes would
therefore not fail loudly — it would report perfect rhyme everywhere the
symbols happened to match as strings. That is the same shape as the bug where
an out-of-vocabulary word was scored as maximally rare and read as authorial
unpredictability.

DESIGN

1. Notation is DECLARED, not sniffed. Guessing whether a string is ARPABET or
   IPA is exactly the sort of silent inference that has already cost this
   project three artifacts.
2. Unknown symbols produce UNKNOWN, never a number. Any comparison touching an
   unknown returns None, and callers must decide — they cannot accidentally
   average it.
3. Inventories are per language. A feature table is a claim about a specific
   language's phonology and does not transfer.
"""

import re
import unicodedata

ARPABET = "arpabet"
IPA = "ipa"

#: length, syllabicity and stress marks that attach to a base symbol
_IPA_MODIFIERS = "ːˑ̆ˈˌ̩̯͜͡"
_STRESS_PRIMARY = "ˈ"
_STRESS_SECONDARY = "ˌ"


class Unknown:
    """A phoneme the declared inventory does not contain.

    Deliberately not falsy-equal to anything and deliberately not a float:
    arithmetic on it raises rather than silently producing a score.
    """

    __slots__ = ("symbol", "reason")

    def __init__(self, symbol, reason=""):
        self.symbol = symbol
        self.reason = reason

    def __repr__(self):
        return f"Unknown({self.symbol!r})"

    def __eq__(self, other):
        return isinstance(other, Unknown) and other.symbol == self.symbol

    def __hash__(self):
        return hash(("Unknown", self.symbol))


class Phone:
    """One parsed segment: base symbol, stress, length, syllabicity."""

    __slots__ = ("base", "stress", "long", "syllabic", "raw")

    def __init__(self, base, stress=0, long=False, syllabic=None, raw=""):
        self.base = base
        self.stress = stress
        self.long = long
        self.syllabic = syllabic
        self.raw = raw

    def __repr__(self):
        bits = [repr(self.base)]
        if self.stress:
            bits.append(f"stress={self.stress}")
        if self.long:
            bits.append("long")
        return f"Phone({', '.join(bits)})"

    def __eq__(self, other):
        return (isinstance(other, Phone) and other.base == self.base
                and other.stress == self.stress and other.long == self.long)

    def __hash__(self):
        return hash((self.base, self.stress, self.long))


def parse_phone(symbol, notation):
    """Parse one segment under a DECLARED notation.

    Raises ValueError on an unrecognised notation rather than guessing.
    """
    if notation == ARPABET:
        m = re.match(r"([A-Z]+)([0-2])?$", symbol)
        if not m:
            return Unknown(symbol, "not ARPABET")
        return Phone(m.group(1), int(m.group(2) or 0), raw=symbol)

    if notation == IPA:
        s = unicodedata.normalize("NFD", symbol)
        stress = 0
        if _STRESS_PRIMARY in s:
            stress = 1
        elif _STRESS_SECONDARY in s:
            stress = 2
        long = "ː" in s or "ˑ" in s
        syllabic = "̩" in s or None
        base = "".join(ch for ch in s if ch not in _IPA_MODIFIERS)
        base = unicodedata.normalize("NFC", base).strip()
        if not base:
            return Unknown(symbol, "no base segment after stripping modifiers")
        return Phone(base, stress, long, syllabic, raw=symbol)

    raise ValueError(f"undeclared notation {notation!r}; "
                     f"expected {ARPABET!r} or {IPA!r}")


class Inventory:
    """A declared phoneme inventory for ONE language.

    `vowels` and `consonants` map a base symbol to a feature tuple. Symbols
    outside them are Unknown — never coerced, never defaulted.
    """

    def __init__(self, language, notation, vowels=None, consonants=None,
                 source=""):
        self.language = language
        self.notation = notation
        self.vowels = dict(vowels or {})
        self.consonants = dict(consonants or {})
        self.source = source

    def classify(self, phone):
        if isinstance(phone, Unknown):
            return "unknown"
        if phone.base in self.vowels:
            return "vowel"
        if phone.base in self.consonants:
            return "consonant"
        return "unknown"

    def parse(self, symbols):
        return [parse_phone(s, self.notation) for s in symbols]

    def coverage(self, symbols):
        """-> (known, total, [unknown symbols]). Run this BEFORE scoring a
        corpus: a low ratio means the inventory is wrong for the data, and
        that is worth failing on rather than discovering in the results."""
        parsed = self.parse(symbols)
        unknown = [p.raw if isinstance(p, Phone) else p.symbol
                   for p in parsed if self.classify(p) == "unknown"]
        return len(parsed) - len(unknown), len(parsed), unknown

    def similarity(self, a, b, weights=None):
        """Feature-space similarity in [0,1], or None if either side is
        unknown. None is contagious on purpose: a caller cannot average it
        into a score without noticing."""
        pa = a if isinstance(a, (Phone, Unknown)) else parse_phone(a, self.notation)
        pb = b if isinstance(b, (Phone, Unknown)) else parse_phone(b, self.notation)
        ca, cb = self.classify(pa), self.classify(pb)
        if ca == "unknown" or cb == "unknown":
            return None
        if ca != cb:
            return 0.0
        table = self.vowels if ca == "vowel" else self.consonants
        fa, fb = table[pa.base], table[pb.base]
        n = min(len(fa), len(fb))
        if not n:
            return 1.0 if pa.base == pb.base else 0.0
        w = weights or [1.0] * n
        num = sum(w[i] * (1.0 - _featdist(fa[i], fb[i])) for i in range(n))
        den = sum(w[:n]) or 1.0
        sim = num / den
        if pa.long != pb.long:          # length is a real contrast, not noise
            sim *= 0.9
        return max(0.0, min(1.0, sim))


def _featdist(x, y):
    """Distance between two feature values, numeric or categorical."""
    if isinstance(x, (int, float)) and isinstance(y, (int, float)):
        return min(1.0, abs(x - y))
    return 0.0 if x == y else 1.0


# ---------------------------------------------------------------------------
# Registry
# ---------------------------------------------------------------------------

_REGISTRY = {}


def register(inv):
    _REGISTRY[inv.language] = inv
    return inv


def get(language):
    if language not in _REGISTRY:
        raise KeyError(
            f"no phoneme inventory declared for {language!r}. "
            f"Declared: {sorted(_REGISTRY)}. Scoring a language without a "
            f"declared inventory is refused rather than defaulted to English.")
    return _REGISTRY[language]


def declared():
    return sorted(_REGISTRY)


if __name__ == "__main__":
    print("parse under a declared notation")
    for sym, notation in (("AA1", ARPABET), ("yː", IPA), ("ˈbyː", IPA),
                          ("ç", IPA), ("ˀ", IPA), ("yː", ARPABET)):
        print(f"   {sym!r:8} as {notation:8} -> {parse_phone(sym, notation)!r}")
