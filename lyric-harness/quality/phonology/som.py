#!/usr/bin/env python3
"""Somali — gabay. Cheap because the 1972 Latin orthography is phonemic and the
syllable shape is very restrictive.

WHAT THE FORM MANDATES

Gabay is bound by **higaad**: one consonant is fixed for the WHOLE poem and
must begin at least one word in every half-line, for hundreds of lines. That is
the strongest positional sound-constraint in the corpus specification -- far
stricter than a rhyme scheme, because the constraint is global rather than
local. Vowel-initial words alliterate with one another as a single class.

PROMINENCE IS NOT STRESS HERE, AND THE GRID IS NOT THE STRESS

Somali has **pitch accent**, not stress, and its metre is **quantitative** --
built on mora counts, not on a beat falling on stressed syllables. So this
module leaves `prominence` at None and declares `grid_unit = "mora"`. A caller
that asks for a stress grid gets a refusal.

That refusal is the point. Carrying English's stress grid into a pitch-accent
language and reading the output as if it meant something is exactly the
monoculture error the corpus specification exists to avoid, and it would be
invisible in the numbers.

AND THE REFUSAL IS FREE, WHICH IS NOT WHAT THIS REPO ASSUMED
------------------------------------------------------------

Doctrine 59 says refusing on SCRIPT has a measurable cost that should be paid
in the open, and K-5 read this module's stress refusal as one. Measured
(`quality/som_channel_audit.py`), it is not. The gabay constrains exactly two
channels — word-initial consonant identity (higaad) and syllable weight — and
prominence is in NEITHER. A refusal only costs something when the relation
needs the channel refused (doctrine 60). This one refuses a channel the form
never reads, so it buys the doctrine 35 protection at zero cost to the
constraint. `MISSING.md` K-5 and `quality/RESULTS_SOM_BLOCKER.md`.

WEIGHT IS VOWEL LENGTH, AND NOTHING ELSE — DECLARED, NOT INFERRED
------------------------------------------------------------------

Somali scansion is quantitative and a syllable is long iff its VOWEL is long.
A CLOSED SHORT SYLLABLE IS LIGHT: `shan` is one mora, `buur` is two, and the
coda contributes nothing either way. Measured over all 4,620 (C)V(V)(C)
shapes the inventory below can build, `moras` is a total function of vowel
length and is invariant under the coda.

That rule lived here only as the arithmetic `2 if len(nuc) == 2 else 1`, which
is the shape doctrine 35 warns about one axis further out: it is RIGHT for
Somali and WRONG for most quantitative traditions — Greek, Latin, Sanskrit and
Arabic all close a heavy syllable with a consonant — and the identical two
lines of code would have produced plausible mora counts in any of them with
nothing in the numbers to catch it. So it is declared as `weight_rule` and a
reader no longer has to derive a modelling decision from an expression.
"""

import re

from quality.phonology import Phonology, Syllable, Unsupported, register

VOWELS = set("aeiouAEIOU")
#: Digraphs first -- kh/sh/dh are single consonants and splitting them would
#: manufacture onset clusters in a language that has none.
DIGRAPHS = ("kh", "sh", "dh", "KH", "SH", "DH", "Kh", "Sh", "Dh")
CONSONANTS = set("btjxdrsgfqklmnwhyc'`ʼBTJXDRSGFQKLMNWHYC")


def _tokens(text):
    return re.findall(r"[A-Za-z'ʼ`\-]+", text)


def _units(word):
    """-> list of phoneme units, digraphs kept whole. None if out of
    inventory."""
    out, i = [], 0
    w = word.strip("-").lower()
    while i < len(w):
        if w[i:i + 2] in ("kh", "sh", "dh"):
            out.append(w[i:i + 2])
            i += 2
            continue
        c = w[i]
        if c in VOWELS or c in CONSONANTS:
            out.append("'" if c in "`ʼ" else c)
            i += 1
            continue
        return None
    return out


class Somali(Phonology):
    language = "som"
    name = "Somali"
    notation = "1972 Latin orthography, treated as phonemic (ATR harmony unmarked)"
    grid_unit = "mora"
    prominence_rule = ("NONE — Somali has pitch accent, not stress. Prominence "
                       "is left None rather than faked, and a stress grid is "
                       "refused. The gabay constrains higaad and weight and "
                       "reads no prominence channel, so the refusal costs the "
                       "constraint nothing.")
    weight_rule = ("VOWEL LENGTH ONLY — a syllable is heavy iff its vowel is "
                   "long. A closed short syllable is LIGHT and the coda never "
                   "contributes a mora. Correct for Somali; wrong for Greek, "
                   "Latin, Sanskrit and Arabic, which is why it is declared "
                   "rather than left as arithmetic.")
    relation = "gabay higaad: one fixed alliterating consonant for the whole poem"
    source = "rules only; no external resource, so nothing to licence"

    def syllabify(self, word):
        u = _units(word)
        if not u:
            return []
        sylls, i = [], 0
        while i < len(u):
            onset = ()
            if u[i] not in VOWELS:
                onset = (u[i],)
                i += 1
                if i >= len(u):
                    if sylls:            # stray final consonant -> coda
                        s = sylls[-1]
                        sylls[-1] = Syllable(s.text + onset[0], s.onset,
                                             s.nucleus, s.coda + onset,
                                             None, s.moras)
                        return sylls
                    return []
            if u[i] not in VOWELS:
                return []                # Somali allows no onset cluster
            nuc = u[i]
            i += 1
            if i < len(u) and u[i] == nuc:      # long vowel, two moras
                nuc += u[i]
                i += 1
            coda = ()
            # a coda only if the next consonant is NOT the onset of a
            # following vowel -- (C)V(V)(C) allows exactly one
            if i < len(u) and u[i] not in VOWELS:
                if i + 1 >= len(u) or u[i + 1] not in VOWELS:
                    coda = (u[i],)
                    i += 1
            sylls.append(Syllable("".join(onset) + nuc + "".join(coda),
                                  onset, nuc, coda, None,
                                  2 if len(nuc) == 2 else 1))
        return sylls

    def prominences(self, word):
        raise Unsupported(
            "Somali has pitch accent, not stress; this module will not return "
            "a stress pattern. Use grid_unit='mora' and Syllable.moras. "
            "Carrying English's stress grid into a pitch-accent language and "
            "reading the result as meaningful is the error the corpus "
            "specification exists to avoid.")

    def _head(self, word):
        s = self.syllabify(word)
        if not s:
            return None
        return s[0].onset[0] if s[0].onset else ""

    def alliterates(self, a, b):
        ha, hb = self._head(a), self._head(b)
        if ha is None or hb is None:
            return None
        if ha == "" and hb == "":
            return True                  # all vowel-initial words are one class
        return ha == hb

    def readability(self, lines):
        """-> dict of token counts: how much of `lines` this module could read.

        DOCTRINE 28, AND IT IS THE PREDICATE K-5 TURNS ON. `higaad` below
        silently DROPS a word it cannot read: `_head` returns None and the
        word never joins a line's head set, so the share is computed over
        whatever stayed inside the 1972 inventory. Nothing raises and nothing
        returns None, so a text in a pre-1972 or non-Latin notation comes back
        as a plausible-looking LOW SHARE rather than as a refusal — the poem
        gets blamed for the orthography, which is doctrine 79's error moved
        into a phonology.

        Call this beside `higaad` and the two causes separate: a low share
        with `read == total` is a fact about the POEM, a low share with
        `read < total` is a fact about the NOTATION. Additive on purpose —
        `higaad`'s three return values are unchanged.
        """
        total = read = 0
        unread = []
        for ln in lines:
            for w in _tokens(ln):
                total += 1
                if self.syllabify(w):
                    read += 1
                else:
                    unread.append(w)
        return {"tokens": total, "read": read,
                "unread": total - read,
                "read_share": (read / total) if total else 0.0,
                "notation": self.notation,
                "sample_unread": unread[:8]}

    def higaad(self, lines):
        """-> (fixed consonant, share of lines carrying it, per-line hits).

        The gabay constraint is GLOBAL: one consonant across the whole poem.
        So the measure is the share of lines that contain it, not a per-line
        yes/no, and a real gabay approaches 1.0.

        THIS DOES NOT REFUSE ON AN UNREADABLE TEXT — it shrinks. Read
        `readability()` above before believing a low share.
        """
        per, counts = [], {}
        for ln in lines:
            heads = set()
            for w in _tokens(ln):
                h = self._head(w)
                if h is not None:
                    heads.add(h)
            per.append(heads)
            for h in heads:
                counts[h] = counts.get(h, 0) + 1
        if not counts:
            return None, 0.0, per
        best = max(counts, key=counts.get)
        return best, counts[best] / len(lines), per


register(Somali())
