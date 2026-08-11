#!/usr/bin/env python3
"""Somali — which channels does the gabay CONSTRAIN, and which does an
orthography RECORD?  MISSING.md K-5.

Run:  python3 quality/som_channel_audit.py

WHY THIS EXISTS
---------------

K-5 asserted a universal — "Somali can never have a corpus" — resting on the
claim that the 1972 Latin script postdates the 1931 cutoff, so every readable
gabay is a modern transcription (doctrine 38).  A universal is falsified by one
instance, so it has to be tested rather than restated.

There are two independent ways K-5 could be true, and they need separating
because doctrine 44/92 says the remedy differs:

  (a) DATE — no admissible Somali verse text exists or is reachable.
  (b) DISJOINT (doctrine 92) — an admissible text exists but does not RECORD
      the information the form constrains, so it is unusable at any date.

Route (b) would be the stronger closure because it needs no date argument.
This runner tests route (b), and the answer is NO: it does not hold.  The
1972 orthography records exactly the two channels the gabay constrains.  So
K-5 cannot be closed date-independently and route (a) is the whole of it.

WHAT THE GABAY CONSTRAINS — two channels, and neither is prominence
------------------------------------------------------------------

  1. HIGAAD.  One consonant fixed for the whole poem, beginning at least one
     word in every half-line.  Reads WORD-INITIAL CONSONANT IDENTITY.
  2. QUANTITATIVE METRE.  Somali scansion is quantitative and its unit is the
     mora; a syllable is long iff its VOWEL is long.  Reads SYLLABLE WEIGHT.

Prominence is in neither.  Somali has pitch accent rather than stress, and
`som.prominences()` raises (doctrine 35).  That refusal has been read in this
repo as a cost.  MEASURED HERE, IT COSTS THE CONSTRAINT NOTHING: the form does
not read the channel that is refused.  A refusal is only a cost when the
relation needs the channel it refuses (doctrine 60), and this one does not.

WHAT THIS RUNNER MEASURES
-------------------------

  A. Weight is a total function of VOWEL LENGTH and is blind to the coda,
     over every (C)V(V)(C) shape the module's own declared inventory can
     build.  That is correct for Somali and would be WRONG for a tradition
     where a closed short syllable is heavy, and until now it existed only as
     an arithmetic side effect of `2 if len(nuc) == 2 else 1`.
  B. What a NON-1972 notation does to each channel, separately, by pushing
     the same shapes through the transforms that the candidate pre-1931
     witnesses actually apply.  Doctrine 52: check the specific channel, not
     the general legibility.

No Somali text is read, quoted or invented here.  Every string below is a
SHAPE assembled from `som.py`'s own declared consonant and vowel inventory,
so every claim is a claim about the module and the notation, never about a
poem.  That is deliberate: this repo holds no admissible Somali text, which
is the finding K-5 records.
"""

import collections
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from quality.phonology import get, Unsupported          # noqa: E402

SOM = get("som")

#: the module's own declared inventory, read off som.py rather than restated
CONSONANTS = ["b", "t", "j", "x", "d", "r", "s", "g", "f", "q", "k", "l",
              "m", "n", "w", "h", "y", "c", "kh", "sh", "dh"]
VOWELS = ["a", "e", "i", "o", "u"]

#: long vowels as a pre-1972 scholarly transcription writes them: a MACRON on
#: a single letter rather than the 1972 script's doubled letter.
MACRON = {"a": "ā", "e": "ē", "i": "ī",
          "o": "ō", "u": "ū"}

#: the pharyngeal/laryngeal consonants that the 1972 script writes with plain
#: ASCII letters and that every earlier notation writes with a diacritic or
#: an Arabic letter.  These are DISTINCT alliterating consonants, so each one
#: is a distinct higaad class.
PHARYNGEALS = {"c": "ʿ", "x": "ḥ", "q": "ḳ", "kh": "ḫ"}


def shapes():
    """Every (C)V(V)(C) the declared inventory builds -> list of (str, meta)."""
    out = []
    for c in CONSONANTS:
        for v in VOWELS:
            for nuc in (v, v + v):
                for coda in [""] + CONSONANTS:
                    out.append((c + nuc + coda,
                                {"onset": c, "nuc": nuc, "coda": coda}))
    return out


def _bar(title):
    print("\n" + title)
    print("-" * len(title))


# ---------------------------------------------------------------------------
# A. weight is vowel length, and nothing else
# ---------------------------------------------------------------------------

def measure_weight_rule():
    _bar("A. SYLLABLE WEIGHT — what is it a function of?")
    sh = shapes()
    by_nuc, by_coda, unreadable = collections.defaultdict(set), \
        collections.defaultdict(set), []
    monosyll = 0
    for w, meta in sh:
        syl = SOM.syllabify(w)
        if not syl:
            unreadable.append(w)
            continue
        if len(syl) != 1:
            continue
        monosyll += 1
        m = syl[0].moras
        by_nuc[len(meta["nuc"])].add(m)
        by_coda[bool(meta["coda"])].add(m)

    print(f"  shapes built from the declared inventory : {len(sh)}")
    print(f"  unreadable                               : {len(unreadable)}")
    print(f"  single-syllable shapes measured          : {monosyll}")
    print(f"  vowel length 1 -> moras {sorted(by_nuc[1])}")
    print(f"  vowel length 2 -> moras {sorted(by_nuc[2])}")
    print(f"  no coda        -> moras {sorted(by_coda[False])}")
    print(f"  has coda       -> moras {sorted(by_coda[True])}")
    ok = (by_nuc[1] == {1} and by_nuc[2] == {2}
          and by_coda[False] == {1, 2} and by_coda[True] == {1, 2})
    print()
    print("  VERDICT: weight is a TOTAL function of vowel length and is BLIND"
          if ok else "  VERDICT: the weight rule is not what som.py declares")
    print("  to the coda.  A closed short syllable is LIGHT.  That is the")
    print("  Somali rule and it is not the general one — in a tradition where")
    print("  a coda closes a heavy syllable the identical code is wrong and")
    print("  nothing in the numbers would say so (doctrine 35, one axis out).")
    return ok


# ---------------------------------------------------------------------------
# B. what a non-1972 notation does to each channel, separately
# ---------------------------------------------------------------------------

def _macronise(w):
    """1972 doubled long vowel -> single letter with a macron."""
    for v, m in MACRON.items():
        w = w.replace(v + v, m)
    return w


def _diacriticise(w):
    """1972 plain-ASCII pharyngeal -> the diacritic letter an earlier
    scholarly transcription uses for the same consonant."""
    for a, b in sorted(PHARYNGEALS.items(), key=lambda kv: -len(kv[0])):
        w = w.replace(a, b)
    return w


def _strip_short_vowels(w):
    """An abjad writes long vowels and leaves short ones unwritten.  Model
    that on the surface form: a doubled vowel survives, a single one does
    not."""
    out, i = [], 0
    while i < len(w):
        if i + 1 < len(w) and w[i] == w[i + 1] and w[i] in VOWELS:
            out.append(w[i] + w[i + 1])
            i += 2
        elif w[i] in VOWELS:
            i += 1                       # short vowel: not written
        else:
            out.append(w[i])
            i += 1
    return "".join(out)


def _recovery(base, xf):
    """How much of each channel SURVIVES the notation change `xf`?

    Not legibility.  Doctrine 52 and doctrine 90: the statistic has to be the
    recovery of the TRUE value, because a shape that stays readable can still
    read WRONG, and a count of readable shapes cannot tell the two apart.

      higaad  — is the recovered word-initial consonant still the one the
                1972 spelling names?  Measured over the shapes whose onset
                the notation touches at all.
      weight  — is the recovered mora total still the 1972 total?  Measured
                over the shapes that carry a LONG vowel, since those are the
                only ones where the weight channel says anything.
    """
    onset_pop = [(w, m) for w, m in base if m["onset"] in PHARYNGEALS]
    long_pop = [(w, m) for w, m in base if len(m["nuc"]) == 2]

    def _syl(w):
        return SOM.syllabify(w)

    head_ok = 0
    for w, _m in onset_pop:
        truth = SOM._head(w)
        got = SOM._head(xf(w))
        if got is not None and got == truth:
            head_ok += 1

    weight_ok = 0
    for w, _m in long_pop:
        t = _syl(w)
        g = _syl(xf(w))
        if g and sum(s.moras for s in g) == sum(s.moras for s in t):
            weight_ok += 1

    read = sum(1 for w, _m in base if _syl(xf(w)))
    return read, head_ok, len(onset_pop), weight_ok, len(long_pop)


def measure_notations():
    _bar("B. WHAT A NON-1972 NOTATION DOES TO EACH CHANNEL")
    base = shapes()
    n = len(base)

    rows = [
        ("1972 Latin (what som.py reads)", lambda w: w),
        ("macron for vowel length", _macronise),
        ("diacritic for the pharyngeals", _diacriticise),
        ("abjad: short vowels unwritten", _strip_short_vowels),
    ]
    print(f"  population: {n} shapes.  The higaad column is scored on the")
    print("  shapes whose ONSET is a pharyngeal/laryngeal; the weight column")
    print("  on the shapes carrying a LONG vowel.  Both score RECOVERY of the")
    print("  1972 value, not legibility — a shape can stay readable and read")
    print("  wrong, and a legibility count cannot tell those apart.")
    print()
    print(f"  {'notation':<34}{'readable':>10}{'higaad kept':>14}"
          f"{'weight kept':>14}")
    for name, xf in rows:
        read, hk, hn, wk, wn = _recovery(base, xf)
        print(f"  {name:<34}{100.0 * read / n:9.1f}%"
              f"{hk:>8}/{hn:<5}{wk:>8}/{wn:<5}")
    print()
    print("  THE ROWS FAIL FOR DIFFERENT REASONS AND IN DIFFERENT CHANNELS,")
    print("  which is the whole point (doctrine 53).  A macron witness keeps")
    print("  every higaad class and destroys the weight channel.  A witness")
    print("  that writes the pharyngeals with diacritics keeps weight and")
    print("  destroys four higaad classes — and those four are c, x, q and kh,")
    print("  which are four DISTINCT alliterating consonants in a language")
    print("  whose whole form is one fixed alliterating consonant.")
    print()
    print("  READ THE ABJAD ROW CAREFULLY — its 2310/2310 is not a pass.  An")
    print("  abjad preserves the weight of every syllable it WRITES, because")
    print("  the long vowels are the ones it writes; the short syllables are")
    print("  simply gone, which is the other half of the same 50% legibility.")
    print("  So per surviving syllable the channel is perfect and per LINE the")
    print("  mora total is destroyed — and the quantitative metre is a")
    print("  constraint on the line.  A channel score is a coordinate of the")
    print("  UNIT it is scored on (doctrine 58), and the unit here is the one")
    print("  the form constrains, not the one the table happens to iterate.")
    return rows


# ---------------------------------------------------------------------------
# C. the silent-drop defect: higaad does not refuse, it shrinks
# ---------------------------------------------------------------------------

def measure_silent_drop():
    _bar("C. higaad() ON AN UNREADABLE NOTATION — refusal or a quiet number?")
    # Six lines carrying a PERFECT higaad by construction: on every line
    # exactly one word begins with the fixed consonant, so share == 1.0.
    # That one word is also the only one carrying a LONG vowel — which is the
    # dangerous arrangement, because the macron transform then deletes
    # precisely the word the constraint is carried by.
    fixed = "g"
    pool = [c for c in CONSONANTS if c != fixed]
    lines = []
    for i in range(6):
        v = VOWELS[i % len(VOWELS)]
        carrier = fixed + v + v + pool[i % len(pool)]
        others = [pool[(i + k) % len(pool)] + VOWELS[(i + k) % len(VOWELS)]
                  + pool[(i + k + 3) % len(pool)] for k in range(1, 4)]
        lines.append(" ".join([carrier] + others))

    for name, xf in (("1972 Latin", lambda s: s),
                     ("macron for vowel length", _macronise),
                     ("diacritic for the pharyngeals", _diacriticise)):
        got = [xf(ln) for ln in lines]
        cons, share, _per = SOM.higaad(got)
        r = SOM.readability(got)
        print(f"  {name:<32} higaad={cons!r:>6} share={share:6.1%}"
              f"   words read {r['read']}/{r['tokens']}")
    print()
    print("  THE MIDDLE ROW IS THE FINDING, and it is worse than a lost")
    print("  number.  The macron notation deletes exactly the words that")
    print("  carry the higaad, so the share COLLAPSES and higaad() reports")
    print("  a different fixed consonant with total confidence — computed")
    print("  over whatever happened to stay inside the 1972 inventory.")
    print("  Nothing raises, nothing returns None, and the answer keeps the")
    print("  shape of a finding about the POEM. Doctrine 28: 'none' and")
    print("  'cannot tell' have to be separable MECHANICALLY, and here they")
    print("  were not.  `readability()` is the separation, and it is additive,")
    print("  so higaad()'s three return values are unchanged.")
    print("  Doctrine 79 in a phonology: the orthography's miss was being")
    print("  billed to the poet.")


def measure_readability_predicate():
    _bar("D. som.Somali.readability() — the separation, exercised")
    base = ["gaab gedi golo", "guur geel gooh"]
    for name, xf in (("1972 Latin", lambda s: s),
                     ("macron for vowel length", _macronise)):
        got = [xf(ln) for ln in base]
        r = SOM.readability(got)
        print(f"  {name:<32} {r}")
    print()
    print("  A caller can now tell a low higaad share caused by the POEM from")
    print("  one caused by the NOTATION, which is what K-5 turns on.")


def main():
    print(__doc__.split("\n\n")[0])
    print(f"\nmodule notation declared as: {SOM.notation}")
    print(f"grid unit declared as      : {SOM.grid_unit}")
    try:
        SOM.prominences("gabay")
        print("prominence                 : RETURNED — that is the doctrine 35 bug")
    except Unsupported:
        print("prominence                 : REFUSED (doctrine 35)")
    print(f"weight rule declared as    : {SOM.weight_rule}")

    ok = measure_weight_rule()
    measure_notations()
    measure_silent_drop()
    measure_readability_predicate()

    _bar("WHAT THIS CLOSES AND WHAT IT DOES NOT")
    print("  CLOSED: the doctrine 92 route to K-5.  The 1972 orthography")
    print("  records BOTH channels the gabay constrains — word-initial")
    print("  consonant identity and vowel length — so an admissible text in")
    print("  it would be usable.  K-5 is NOT a disjoint case, and it cannot")
    print("  be closed without a date argument.")
    print()
    print("  OPEN: whether any pre-1931 witness records both channels.  The")
    print("  B table is the test to run against one when it is reachable —")
    print("  a macron witness keeps higaad and loses weight, an abjad keeps")
    print("  higaad and loses weight harder, and a witness that writes the")
    print("  pharyngeals with diacritics loses four higaad classes.  That is")
    print("  doctrine 53: admissibility is per-RELATION, and a pre-1931")
    print("  Somali text may well be admissible for higaad and refused for")
    print("  the mora grid, out of the same file.")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
