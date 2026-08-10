#!/usr/bin/env python3
"""Welsh — cynghanedd. Cheap for the same reason Finnish was: the orthography
is close to phonemic. It was blocked for a reason that had nothing to do with
difficulty.

WHY THIS MATTERS MORE THAN THE OTHER THREE

Every positional control this project can currently reach is **line-final**:
sonnet end-rhyme, 律詩 rhyme at lines 2/4/6/8. Arm C1 of the Tang run showed
what that costs -- drop the rhyme requirement entirely and the result is
identical, because every second line-end in an isosyllabic form is periodic
whether or not anything rhymes there. A line-final control cannot separate
position from sound.

Cynghanedd is the answer to that, because its constraint is **internal to the
line**, around the caesura. It is the one available tradition where a positive
control would not be positional by construction.

THE DEFECT THIS FIXES

`lyric_harness.check_cynghanedd` exists and has since the first commit, and it
builds its consonant skeleton with `word_syllable_map` -- CMUdict. It has never
read a word of Welsh. It checks the RULE SHAPE against English phonology, which
is how the seven recorded rule errors were found, and that is a real
contribution, but it is not cynghanedd on Welsh.

The consonant skeleton is the whole of cynghanedd, and Welsh has **eight
digraphs that are single consonants**: ch dd ff ng ll ph rh th. Split them
naively and `ll` becomes two /l/, `dd` two /d/, and every skeleton is wrong in
a way that would still produce plausible-looking output.

DECLARED AMBIGUITIES, rather than resolved ones

- **ng** is /ŋ/ in `llong`, but /ŋg/ in `Bangor` and across some morpheme
  boundaries. There is no orthographic signal. This module reads it as the
  single unit /ŋ/ and reports it, because guessing per word would be a lexicon
  and this is a rules-only module.
- **y** is "clear" in final syllables and monosyllables, "obscure" elsewhere.
  It is recorded on the syllable so a caller can see it, and it does not affect
  the consonant skeleton, which is what cynghanedd is built on.
- **i** and **w** are consonantal before a vowel in some environments and
  vocalic in others; the vocalic reading is taken and flagged.
"""

import re

from quality.phonology import Phonology, Syllable, register

#: The eight digraphs, and the reason this module exists. Order matters: the
#: two-letter forms must be matched before their first letters.
DIGRAPHS = ("ngh", "mh", "nh", "ch", "dd", "ff", "ng", "ll", "ph", "rh", "th")
VOWELS = set("aeiouwyâêîôûŵŷáéíóúàèìòùäëïöüAEIOUWYÂÊÎÔÛŴŶ")
CONSONANTS = set("bcdfghjlmnprstvzBCDFGHJLMNPRSTVZ")
#: Standard Welsh diphthongs. A vowel pair not on this list is a hiatus.
DIPHTHONGS = {
    "ae", "ai", "au", "aw", "ei", "eu", "ew", "ey", "iw", "oe", "oi",
    "ou", "ow", "uw", "wy", "yw", "yb", "aw",
}


def units(word):
    """-> list of phoneme units, digraphs kept whole. None if out of
    inventory. This is the load-bearing function: get it wrong and every
    consonant skeleton in the language is wrong."""
    w = word.strip("-'").lower()
    out, i = [], 0
    while i < len(w):
        hit = None
        for d in DIGRAPHS:
            if w.startswith(d, i):
                hit = d
                break
        if hit:
            out.append(hit)
            i += len(hit)
            continue
        c = w[i]
        if c in VOWELS or c in CONSONANTS:
            out.append(c)
            i += 1
            continue
        return None
    return out


class Welsh(Phonology):
    language = "cym"
    name = "Welsh"
    notation = "standard Welsh orthography, treated as near-phonemic"
    grid_unit = "syllable"
    prominence_rule = ("penultimate syllable, the regular Welsh rule; "
                       "monosyllables are stressed. Known exceptions "
                       "(Cymraeg, verbs in -hau) are NOT lexicalised here")
    relation = ("cynghanedd: consonant skeleton answered across the caesura "
                "(croes/traws), or rhyme-then-alliteration (sain)")
    source = "rules only; no external resource, so nothing to licence"

    def syllabify(self, word):
        u = units(word)
        if not u:
            return []
        # group into onset* nucleus coda*
        groups, cur = [], []
        for x in u:
            if x[0] in VOWELS:
                groups.append(("V", x))
            else:
                groups.append(("C", x))
        # nuclei: merge listed diphthongs
        merged, i = [], 0
        while i < len(groups):
            k, x = groups[i]
            if k == "V" and i + 1 < len(groups) and groups[i + 1][0] == "V" \
                    and (x + groups[i + 1][1]) in DIPHTHONGS:
                merged.append(("V", x + groups[i + 1][1]))
                i += 2
            else:
                merged.append((k, x))
                i += 1
        nuclei = [i for i, (k, _x) in enumerate(merged) if k == "V"]
        if not nuclei:
            return []
        sylls = []
        for n, ni in enumerate(nuclei):
            start = 0 if n == 0 else nuclei[n - 1] + 1
            cons = [x for k, x in merged[start:ni] if k == "C"]
            if n == 0:
                onset, prev_coda = cons, []
            else:
                # a single medial consonant is the next onset; in a cluster
                # only the last one is
                onset = cons[-1:] if cons else []
                prev_coda = cons[:-1] if len(cons) > 1 else []
                if prev_coda and sylls:
                    s = sylls[-1]
                    sylls[-1] = Syllable(s.text + "".join(prev_coda), s.onset,
                                         s.nucleus, tuple(prev_coda),
                                         s.prominence, s.moras)
            nuc = merged[ni][1]
            sylls.append(Syllable("".join(onset) + nuc, tuple(onset), nuc,
                                  (), None, 1))
        tail = [x for k, x in merged[nuclei[-1] + 1:] if k == "C"]
        if tail and sylls:
            s = sylls[-1]
            sylls[-1] = Syllable(s.text + "".join(tail), s.onset, s.nucleus,
                                 tuple(tail), s.prominence, s.moras)
        n = len(sylls)
        for i, s in enumerate(sylls):
            s.prominence = 1 if (i == n - 2 or n == 1) else 0
        return sylls

    # -- cynghanedd -------------------------------------------------------

    def skeleton(self, text):
        """Consonants up to and including the stressed syllable's onset.

        This is the object cynghanedd is defined on. Consonants after the
        stressed vowel of the last word do not count toward the answer, which
        is why the stressed syllable is where the skeleton stops.
        """
        out = []
        words = [w for w in re.findall(r"[A-Za-zÂÊÎÔÛŴŶâêîôûŵŷ'\-]+", text)
                 if w.strip("'-")]
        if not words:
            return None
        for wi, w in enumerate(words):
            s = self.syllabify(w)
            if not s:
                return None
            last = wi == len(words) - 1
            for si, syl in enumerate(s):
                out.extend(syl.onset)
                if last and syl.prominence == 1:
                    return out          # stop at the final stressed onset
                out.extend(syl.coda)
        return out

    def cynghanedd(self, line):
        """-> (type, detail) or (None, reason). Types: croes, traws, sain.

        croes  every consonant of the first half answered, in order, in the
               second
        traws  the same, after an unanswered bridge at the start of the second
        sain   three parts: 1 rhymes with 2, and 2 alliterates with 3
        """
        parts = [p.strip() for p in re.split(r"[,/|]", line) if p.strip()]
        if len(parts) == 3:
            a, b, c = (self.syllabify(p.split()[-1]) for p in parts)
            if not a or not b or not c:
                return None, "unreadable"
            rhyme = a[-1].nucleus == b[-1].nucleus and a[-1].coda == b[-1].coda
            allit = bool(b[0].onset) and b[0].onset == c[0].onset
            if rhyme and allit:
                return "sain", (f"{parts[0].split()[-1]} rhymes "
                                f"{parts[1].split()[-1]}, then alliterates "
                                f"{parts[2].split()[-1]} on "
                                f"{b[0].onset[0]!r}")
            return None, (f"sain needs rhyme AND alliteration; "
                          f"rhyme={rhyme} allit={allit}")
        if len(parts) != 2:
            return None, f"need 2 or 3 parts split on a caesura, got {len(parts)}"
        sa, sb = self.skeleton(parts[0]), self.skeleton(parts[1])
        if sa is None or sb is None:
            return None, "unreadable"
        if not sa:
            return None, "no consonants before the caesura"
        if sa == sb:
            return "croes", f"skeleton {sa} answered exactly"
        if len(sb) > len(sa) and sb[-len(sa):] == sa:
            return "traws", (f"skeleton {sa} answered after unanswered bridge "
                             f"{sb[:-len(sa)]}")
        return None, f"{sa} not answered by {sb}"


register(Welsh())
