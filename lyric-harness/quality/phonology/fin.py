#!/usr/bin/env python3
"""Finnish — Kalevala metre. Cheap because the orthography is near-phonemic.

WHAT THE FORM MANDATES

Kalevala metre is trochaic tetrameter with **alliteration** as its positional
sound-constraint: two or more words in a line begin with the same sound. Two
grades are traditionally distinguished and both are reported rather than
collapsed:

  strong  same initial consonant AND same following vowel  (kulta / kukka: no)
  weak    same initial consonant, any vowel

Vowel-initial words alliterate with one another as a single class -- a fact
about the tradition, not about the phonology, and it is exactly the kind of
rule that does not survive being ported from another language.

STRESS IS FREE HERE

Finnish stress is fixed: primary on the first syllable of every word, secondary
on odd-numbered syllables from the third, never on a word-final syllable. So
the stress grid needs no lexicon and no model -- the rule is the whole of it.
"""

import re

from quality.phonology import Phonology, Syllable, register

VOWELS = set("aeiouyäöAEIOUYÄÖ")
#: The eighteen native diphthongs. A pair not on this list is TWO syllables,
#: which is the single most common way to get Finnish syllabification wrong.
DIPHTHONGS = {
    "ai", "ei", "oi", "ui", "yi", "äi", "öi",
    "au", "eu", "iu", "ou", "äy", "öy", "ey", "iy",
    "ie", "uo", "yö",
}
CONSONANTS = set("bcdfghjklmnpqrstvwxzšžBCDFGHJKLMNPQRSTVWXZŠŽ")


def _tokens(text):
    return re.findall(r"[A-Za-zÀ-ÿŠšŽžÄäÖöÅå'\-]+", text)


class Finnish(Phonology):
    language = "fin"
    name = "Finnish"
    notation = "standard Finnish orthography, treated as phonemic"
    grid_unit = "syllable"
    prominence_rule = ("primary stress on syllable 1; secondary on odd "
                       "syllables from 3; never word-final")
    relation = "Kalevala alliteration (initial consonant, optionally + vowel)"
    source = "rules only; no external resource, so nothing to licence"

    def syllabify(self, word):
        w = word.strip("'-").lower()
        if not w:
            return []
        # The APOSTROPHE is a hiatus marker, not a phoneme. In `saa'ani` it
        # forbids the two a's from merging into one long nucleus across a
        # morpheme boundary -- so it forces a syllable break and is then
        # discarded. Treating it as out-of-inventory made the whole word
        # unreadable, which silently dropped a Kalevala line that alliterates.
        if "'" in w or "\u2019" in w:
            out = []
            for part in re.split(r"['\u2019]+", w):
                if part:
                    out.extend(self.syllabify(part))
            return out
        if any(c not in VOWELS and c not in CONSONANTS for c in w):
            return []
        # 1. split the string into V-runs and C-runs
        parts, cur, kind = [], "", None
        for c in w:
            k = "V" if c in VOWELS else "C"
            if k != kind and cur:
                parts.append((kind, cur))
                cur = ""
            kind, cur = k, cur + c
        if cur:
            parts.append((kind, cur))

        # 2. break vowel runs into nuclei: a long vowel or a listed diphthong
        #    is ONE nucleus, anything else is a hiatus and splits.
        nuclei = []
        for kind, s in parts:
            if kind != "V":
                nuclei.append(("C", s))
                continue
            i = 0
            while i < len(s):
                if i + 1 < len(s) and (s[i] == s[i + 1]
                                       or s[i:i + 2] in DIPHTHONGS):
                    nuclei.append(("V", s[i:i + 2]))
                    i += 2
                else:
                    nuclei.append(("V", s[i]))
                    i += 1

        # 3. assemble. A consonant run splits so that only its LAST consonant
        #    is the next onset; the rest close the previous syllable. Finnish
        #    native words allow no complex onsets.
        sylls, onset = [], ()
        for idx, (kind, s) in enumerate(nuclei):
            if kind == "C":
                if not sylls:
                    onset = tuple(s)          # word-initial: all of it
                else:
                    if len(s) == 1:
                        onset = (s,)
                    else:
                        sylls[-1] = Syllable(
                            sylls[-1].text + s[:-1], sylls[-1].onset,
                            sylls[-1].nucleus, tuple(s[:-1]),
                            sylls[-1].prominence, sylls[-1].moras)
                        onset = (s[-1],)
                continue
            sylls.append(Syllable("".join(onset) + s, onset, s, (), None,
                                  2 if len(s) == 2 else 1))
            onset = ()
        if onset and sylls:                    # trailing consonants -> coda
            sylls[-1] = Syllable(sylls[-1].text + "".join(onset),
                                 sylls[-1].onset, sylls[-1].nucleus,
                                 tuple(onset), sylls[-1].prominence,
                                 sylls[-1].moras)

        # 4. stress, by rule
        n = len(sylls)
        for i, s in enumerate(sylls):
            if i == 0:
                s.prominence = 1
            elif i % 2 == 0 and i != n - 1:
                s.prominence = 1               # secondary, still a grid slot
            else:
                s.prominence = 0
        return sylls

    def _head(self, word):
        s = self.syllabify(word)
        if not s:
            return None
        return (s[0].onset[0] if s[0].onset else "", s[0].nucleus)

    def alliterates(self, a, b, strong=False):
        ha, hb = self._head(a), self._head(b)
        if ha is None or hb is None:
            return None                        # unreadable: never a guess
        if ha[0] == "" and hb[0] == "":
            # vowel-initial words alliterate as one class, and in the STRONG
            # grade the vowels must match as well
            return ha[1][0] == hb[1][0] if strong else True
        if ha[0] != hb[0]:
            return False
        return ha[1][0] == hb[1][0] if strong else True

    def line_alliteration(self, line, strong=False):
        """-> (n_alliterating_words, n_words, the winning class).

        Kalevala metre wants at least two words sharing an initial. Reported
        as a count so a caller can apply the tradition's own threshold rather
        than one imposed here.
        """
        ws = _tokens(line)
        heads = []
        for w in ws:
            h = self._head(w)
            heads.append(None if h is None
                         else (h[0], h[1][0] if strong else ""))
        seen = [h for h in heads if h is not None]
        if not seen:
            return 0, len(ws), None
        best = max(set(seen), key=seen.count)
        return seen.count(best), len(ws), best


register(Finnish())
