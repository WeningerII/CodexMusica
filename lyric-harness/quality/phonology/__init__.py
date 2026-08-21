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
3. **No defaulting to English.** No language falls back to English when its
   own rules run out. AMENDED 2026-08-10: `eng` is now a DECLARED module and
   it does consult CMUdict, which is the opposite of a default -- the registry
   returns it only when a caller asks for `eng` by name, and `get('cym')`
   cannot reach it. What the commitment forbids is a Middle Chinese character
   quietly scored as Mandarin, and that is still forbidden. MISSING F-1 was
   this gap, and the cost was not cosmetic: every module in `quality/` takes a
   `phon` argument, so with no `eng` the whole layer was unreachable from
   English and each test built its own CMUdict fixture instead.
4. **A homograph is UNDECIDED, never resolved.** ADDED 2026-08-11, defect P11's
   production half. A `Syllable` channel may hold a `Readings` — the set of
   readings the declared surface permits — and a predicate then answers True
   where they all agree, False where none can, and None where some do and some
   do not. This is commitment 2 arriving from inside a word rather than from
   outside the inventory: `wind` is /W IH1 N D/ and /W AY1 N D/, CMUdict lists
   the verb first, and taking `prons[0]` reported `wind`/`find` as a PERFECT
   RHYME while saying nothing about which reading it had read. The hook is
   `Phonology.parses()`; nine of nine modules override nothing and are
   byte-identical. See the KNOWLEDGE SETS section below and
   `quality/test_homograph.py`.

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

import itertools
import os
import sys
from dataclasses import dataclass, field

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", ".."))


# ---------------------------------------------------------------------------
# KNOWLEDGE SETS — DEFECT P11's PRODUCTION HALF
#
# `quality/relations.py` closed the COMPARISON half on 2026-08-11: a channel
# may hold a `frozenset` of readings and `Agree`/`Differ` return True when they
# all agree, False when none can, and **None when some do and some do not**.
# Its own comment says what it could not reach:
#
#     WHAT REMAINS OPEN IS NOT HERE.  `quality.phonology.Syllable.nucleus` is a
#     `str`, so no shipped phonology can PRODUCE a two-reading syllable.
#
# That is this file, and this is that half.  The live cost was a shipped
# fixture reporting `wind`/`find` as a PERFECT RHYME: CMUdict lists
# `W AY1 N D` first, which is correct for the verb, wrong for the noun, and
# nothing in the output said which one had been read.  A verdict on a reading
# nobody declared is worse than a refusal, because a refusal is visible.
#
# WHAT CHANGES AND WHAT DOES NOT
#
# `Syllable.onset`, `.nucleus`, `.coda`, `.prominence` and `.moras` may now
# each hold EITHER their old scalar/tuple value OR a `Readings` — a frozenset
# of the values the declared surface permits.  A `str` or a `tuple` is CERTAIN
# knowledge of itself, exactly as `relations._alts` already assumes, so a
# module that passes a `str` behaves identically and nine of nine do.  Nothing
# in `quality/phonology/` produces a `Readings` today; the capability is
# reached through `parses()`, which no shipped module overrides, so this
# commit moves no number anywhere (measured: see quality/test_homograph.py).
#
# WHY A TUPLE IS NOT A SET OF READINGS
#
# A coda `('N', 'D')` is ONE value that happens to be ordered — a cluster.
# `frozenset({('N',), ('N', 'D')})` is two readings of the coda.  The type is
# the marker and there is no flag to forget to set, which is the same rule
# `relations._alts` states from the other side.
# ---------------------------------------------------------------------------


class Readings(frozenset):
    """The set of readings a channel permits.  `|self| == 1` is certainty.

    A plain `frozenset` works everywhere this does — `relations._alts` keys on
    `isinstance(x, frozenset)` — and this subclass exists for ONE reason:
    ITERATION ORDER.  Doctrine 66 caught a result that did not reproduce
    because a tie was broken by iterating a set, and the seam below is full of
    consumers that call `tuple(...)` on a channel (`relations._rd_onset` and
    `_rd_coda` both do).  Those calls are wrong on a knowledge set whatever the
    order, but with a bare frozenset they are wrong DIFFERENTLY under different
    PYTHONHASHSEEDs, which is the failure mode that hides.  `__iter__` here is
    sorted by `repr`, which is arbitrary, FIXED and stated — the only three
    properties doctrine 66 asks of a tie-break.
    """

    __slots__ = ()

    def __iter__(self):
        return iter(sorted(frozenset.__iter__(self), key=repr))

    def sole(self):
        """The single reading, or `Unsupported` if there is more than one."""
        if len(self) != 1:
            raise Unsupported(
                f"{len(self)} readings held and no declaration resolves them; "
                f"the answer is UNDECIDED, not whichever reading sorts first")
        return next(frozenset.__iter__(self))

    def __repr__(self):
        return "Readings({%s})" % ", ".join(repr(v) for v in self)


def readings_of(x):
    """A channel value as the set of readings it permits.

    Mirrors `relations._alts` and must keep mirroring it: a scalar — or a
    TUPLE, since a cluster is one value and not a set of values — is certain
    knowledge of itself.
    """
    return x if isinstance(x, frozenset) else Readings((x,))


def is_uncertain(x):
    """True where the channel holds more than one reading."""
    return isinstance(x, frozenset) and len(x) > 1


def sole(x):
    """The single reading of a certain channel value.  Raises on an uncertain
    one rather than picking, which is the whole point of P11."""
    return readings_of(x).sole() if isinstance(x, frozenset) else x


#: The channels `merge_readings` folds.  `text` is excluded on purpose: it is
#: the printed form and a set of spellings is not a sound.  `moras` IS
#: included, and see `merge_readings` for the price of that.
CHANNELS = ("onset", "nucleus", "coda", "prominence", "moras")


@dataclass
class Syllable:
    """One syllable in a declared notation.

    `prominence` is None when the language has no binary prominence the grid
    can use. That is a refusal, not a zero.

    Every channel below may hold its ordinary value OR a `Readings` — see this
    module's KNOWLEDGE SETS section.  The annotations say `object` because two
    types are admissible and pretending otherwise is what `nucleus: str` did.
    """
    text: str
    onset: object = ()             # tuple, or Readings of tuples
    nucleus: object = ""           # str/None, or Readings of them
    coda: object = ()              # tuple, or Readings of tuples
    prominence: object = None      # 1 / 0 / None, or Readings of them
    moras: object = 1              # int, or Readings of ints

    def key(self):
        """The sound-identity key for rhyme within this notation.

        WARNING, and it is the same trap `fas` and `msa` already record about
        this method: on an UNCERTAIN syllable this is the key of the
        KNOWLEDGE, not of a sound.  Two homographs holding the same two
        readings compare equal here and their sounds may not be.  A caller
        that needs a verdict must go through the ternary predicates in
        `relations.py`, which is what `certain` exists to let it check.
        """
        return (self.nucleus, self.coda)

    @property
    def certain(self):
        """True where every channel holds exactly one reading."""
        return not self.uncertain_channels()

    def uncertain_channels(self):
        """-> the names of the channels holding more than one reading."""
        return tuple(c for c in CHANNELS if is_uncertain(getattr(self, c)))

    def readings(self):
        """-> every certain `Syllable` this one permits, in a FIXED order.

        The cartesian product over the uncertain channels.  Order is
        `Readings.__iter__`'s, so it is stated rather than hash-dependent.
        """
        cols = [list(readings_of(getattr(self, c))) for c in CHANNELS]
        return [Syllable(self.text, **dict(zip(CHANNELS, combo)))
                for combo in itertools.product(*cols)]

    def certain_view(self):
        """-> this syllable with every channel collapsed to its FIRST reading.

        The declared escape hatch for a consumer that cannot hold a set — and
        it is a LOSS, named as one.  Offered because the alternative a caller
        reaches for by reflex is `tuple(syl.coda)`, which silently turns two
        readings of a cluster into one cluster of two readings.
        """
        return self.readings()[0]


class Unsupported(Exception):
    """Raised when a caller asks a language for something it does not have."""


#: `merge_readings` status values.  THREE OUTCOMES, NOT TWO (doctrine 79, and
#: doctrine 88 one layer down: a refusal rate is uninterpretable until its
#: causes are separated).
CERTAIN = "certain"          # one reading, or every reading identical
MERGED = "merged"            # >1 reading, folded into knowledge sets
UNREADABLE = "unreadable"    # the phonology could not read the word at all
UNALIGNABLE = "unalignable"  # >1 reading and no shared index to hold a set on


def merge_readings(readings):
    """Fold alternative syllabifications of ONE word into knowledge sets.

    -> `(syllables, status, note)`.

    `readings` is a list of `[Syllable]`, one per reading the declaration
    permits.  Where the readings agree on a channel the merged syllable holds
    the plain value; where they disagree it holds a `Readings`, and every
    predicate downstream then returns None rather than a verdict on a reading
    nobody declared.

    THE REFUSALS, AND WHY THEY ARE REFUSALS

    * different SYLLABLE COUNTS -> `UNALIGNABLE`, and the list comes back
      EMPTY.  There is no shared index for the set to live on, and inventing
      an alignment is the `kukka`/`kalevala` error (doctrine 83) with extra
      steps.  Empty is this layer's declared refusal — `eng.syllabify`'s
      docstring says so and `fas.syllabify` already returns `[]` for exactly
      this case, several legal parses and no way to choose.  `status` is what
      separates that refusal from an unreadable word, which doctrine 88 says
      is the distinction nothing was drawing.
    * every reading empty -> `UNREADABLE`.  The word was refused upstream.

    THE ONE UNCOMFORTABLE CHANNEL

    `moras` is a MAGNITUDE and this repo reads it arithmetically —
    `san.moras()` is `sum(s.moras for s in sylls)`.  A `Readings` there makes
    that `TypeError`, which is LOUD and therefore acceptable; a silent wrong
    sum would not be.  It is merged rather than refused because a language
    whose readings differ in weight (Sanskrit sandhi, an unwritten Persian
    vowel) has a real indeterminacy on exactly that channel, and deleting the
    whole word to protect a `sum()` would be doctrine 24's error: a rule that
    deletes a category instead of naming it.
    """
    live = [r for r in readings if r]
    if not live:
        return [], UNREADABLE, "no reading is readable; the word is refused"
    n = len(live[0])
    if any(len(r) != n for r in live):
        shapes = sorted({len(r) for r in live})
        return [], UNALIGNABLE, (
            f"{len(live)} readings with syllable counts {shapes}: no shared "
            f"index to hold a knowledge set on, so the word is REFUSED rather "
            f"than aligned by guess")
    out, uncertain_at = [], []
    for i in range(n):
        fields, sets = {}, []
        for c in CHANNELS:
            vals = Readings(getattr(r[i], c) for r in live)
            if len(vals) == 1:
                fields[c] = next(iter(vals))
            else:
                fields[c] = vals
                sets.append(c)
        if sets:
            uncertain_at.append((i, tuple(sets)))
        out.append(Syllable(live[0][i].text, **fields))
    if not uncertain_at:
        return out, CERTAIN, f"{len(live)} readings and they agree everywhere"
    return out, MERGED, (
        "; ".join(f"syllable {i} undecided on {'/'.join(cs)}"
                  for i, cs in uncertain_at))


def reading_census(phon, words):
    """-> doctrine 79's three counts at the PRODUCTION layer, plus the split
    doctrine 88 asks for inside the refusals.

    `read` a single certain reading — the ordinary case
    `undecided` more than one reading; `merged` holds sets, `unalignable`
                could not even do that
    `refused`   the phonology could not read the word at all

    A rate whose denominator silently mixes these is not a rate.
    """
    c = {"read": 0, "undecided": 0, "refused": 0,
         "merged": 0, "unalignable": 0, "total": 0}
    for w in words:
        c["total"] += 1
        _, status, _ = merge_readings(phon.parses(w))
        if status == CERTAIN:
            c["read"] += 1
        elif status == UNREADABLE:
            c["refused"] += 1
        else:
            c["undecided"] += 1
            c[status] += 1
    return c


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

    # -- P11's production hook ---------------------------------------------
    #
    # A module that HAS homographs overrides `parses` and gets knowledge sets
    # for free; a module that does not overrides nothing and is byte-identical.
    # `syllabify` is left alone deliberately: making it return sets by default
    # would change what every existing caller reads without any caller asking,
    # and this repo's rule is that a new coordinate is REACHABLE before it is
    # the default (doctrine 84 — `consult=False` still reproduces the
    # documented wrong answer, `modal_exclusion=0` is still reachable).

    def parses(self, word):
        """-> `[[Syllable]]`, one entry per reading this declaration permits.

        The default is the single reading `syllabify` returns, so nine of nine
        shipped modules behave exactly as they did.  `fas` already has this
        shape as a module-level function and is the precedent: Persian's
        several legal parses were the first indeterminacy this layer had to
        represent, and it represented it by refusing.  Overriding here is how
        a module says "I hold more than one reading and I am not going to pick
        one" — `ltc`'s 多音字, `eng`'s wind/live/read/bow/tear.
        """
        return [self.syllabify(word)]

    def syllabify_uncertain(self, word):
        """-> `[Syllable]` with a `Readings` on every channel the readings
        disagree about.  Empty is a refusal; `reading_status` says which of the
        two kinds it is."""
        return merge_readings(self.parses(word))[0]

    def reading_status(self, word):
        """-> `(status, note)`.  Separates 'one reading', 'several readings
        merged', 'several readings and no alignment', and 'unreadable', which
        `syllabify_uncertain` alone cannot express (doctrines 79 and 88)."""
        _, status, note = merge_readings(self.parses(word))
        return status, note

    def prominences(self, word):
        return [s.prominence for s in self.syllabify(word)]

    def alliterates(self, a, b):
        """-> True / False / None. None means 'cannot tell', never a guess."""
        return None

    def rhymes(self, a, b):
        """-> True / False / None. None means 'cannot tell', never a guess.

        THE SAME SENTENCE `alliterates` CARRIES TWO LINES UP, and its absence
        here was the whole defect: two methods of identical shape, one saying
        what its None means and one silent, so a caller reading this one had
        no way to tell a refusal from a negative (doctrine 20) and had to
        pick a reading (doctrine 1). `eng` and `som` INHERIT this — English
        rhyme is the comparator's question and not this layer's, and som is
        pitch-accent — so the base's None is a live answer on 2 of the 9
        modules rather than an unreached default.
        """
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


from quality.phonology import (cym, eng, fas, fin, ltc, msa, non,  # noqa: E402,F401
                               san, som)  # noqa: F401
