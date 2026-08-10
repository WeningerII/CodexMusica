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
                       "refused.")
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

    def higaad(self, lines):
        """-> (fixed consonant, share of lines carrying it, per-line hits).

        The gabay constraint is GLOBAL: one consonant across the whole poem.
        So the measure is the share of lines that contain it, not a per-line
        yes/no, and a real gabay approaches 1.0.
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
