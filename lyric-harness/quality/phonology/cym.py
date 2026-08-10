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

THE SECOND DEFECT THIS FIXES: THE SPAN STOPPED IN ONE PLACE FOR EVERY LINE

Welsh strict metre classes a line by its two DIWEDDEBAU -- the accentuation of
the end of each half -- and the class decides where the answered span STOPS.
`skeleton()` used to stop at the onset of the last accented syllable, in every
half of every line. That is the *cytbwys acennog* rule and it is correct only
there; applied to the other classes it reads too little of the line. Measured
on the staged corpus, per candidate caesura placement, against the same
within-line-shuffle null the rest of the Welsh work uses (Alun, 1,558 lines,
20 shuffles; obs / null):

    class                    n     croes acennog-rule   croes class-rule
    cytbwys acennog        943      5.1% / 0.5%          5.1% / 0.5%   (same)
    cytbwys ddiacen       1556      6.4% / 1.6%          8.2% / 2.1%
    anghytbwys ddisgyn.   1135      1.3% / 0.3%          1.5% / 0.2%
      -- and its traws                6.3% / 4.9%          5.6% / 2.3%
    anghytbwys ddyrchaf.  1178      1.5% / 0.2%          0.3% / 0.1%
      -- and its traws                3.5% / 4.0%          0.9% / 1.5%

Two readings were tested and rejected by the same table, so the rule is not an
assumption: running a *ddiacen* span to the END of the half (final coda
included) collapses it to 0.3% observed against 0.0% null, and running an
*acennog* span to the end collapses that class from 5.1% to 0.0%. The terminus
is the half's FINAL VOWEL in the balanced classes -- which for an accented end
is the accented vowel, so the old rule was right there and only there.

*Anghytbwys ddyrchafedig* -- first end unaccented, second accented -- is not a
class of the consonantal cynghanedd; the tradition works three. It is REFUSED
by default rather than given a span (`dyrchafedig="rising"` reaches the other
reading), and the table above is why: at those placements the traws rate sits
BELOW its own null under either reading.

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

import itertools
import re
import unicodedata

from quality.phonology import Phonology, Syllable, register

#: The eight digraphs, and the reason this module exists. Order matters: the
#: two-letter forms must be matched before their first letters.
DIGRAPHS = ("ngh", "mh", "nh", "ch", "dd", "ff", "ng", "ll", "ph", "rh", "th")
VOWELS = set("aeiouwyâêîôûŵŷáéíóúàèìòùäëïöüAEIOUWYÂÊÎÔÛŴŶ")
CONSONANTS = set("bcdfghjlmnprstvzBCDFGHJLMNPRSTVZ")
#: Standard Welsh diphthongs. A vowel pair not on this list is a hiatus.
#: PROCLITICS — unstressed monosyllabic function words. Welsh stress is
#: penultimate, which makes every monosyllable stressed by the bare rule, and
#: that is wrong for function words: the article `y`, the conjunction `a` and
#: the prepositions carry no stress and cannot answer a cynghanedd. Without
#: this, cynghanedd lusg "finds" the penult of the final word rhyming the
#: article, which is spurious in the same way the English harness's
#: WEAK_ALWAYS set exists to prevent. Personal pronouns are deliberately NOT
#: here -- they can bear stress.
PROCLITICS = {
    "y", "yr", "r", "a", "ac", "na", "nac", "neu", "ond", "os", "pe",
    "i", "o", "yn", "ar", "at", "am", "gan", "heb", "dan", "dros", "drwy",
    "trwy", "wrth", "hyd", "er", "rhwng", "tan", "fy", "dy", "ei", "ein",
    "eich", "eu", "w", "mi", "fe", "ni", "nid", "mai", "taw", "yn", "yr",
}

DIPHTHONGS = {
    "ae", "ai", "au", "aw", "ei", "eu", "ew", "ey", "iw", "oe", "oi",
    "ou", "ow", "uw", "wy", "yw", "yb", "aw",
}


#: Letters that may occur inside a word, derived from the inventories above so
#: the tokeniser cannot drift away from what `units` accepts. The earlier
#: hand-written class omitted the acute-accented vowels that VOWELS contains,
#: so an accented word tokenised as two fragments and silently changed its own
#: skeleton. Deriving it removes the possibility.
_LETTERS = "".join(sorted(VOWELS | CONSONANTS))
WORD_RE = re.compile("[" + re.escape(_LETTERS) + "'’ʼ\\-]+")


def normalise(text):
    """Fold the typographic variants that are not phonological distinctions.

    Doctrine 26 says normalise U+2019 anywhere a word is extracted, and it was
    written after a curly apostrophe put the token `d` into an English rhyme
    table 75 times. Welsh needs it more, not less: the language elides
    constantly, so the apostrophe is INSIDE words rather than at their edges,
    and one printing house's choice of glyph decides whether `mae'r` is one
    token or two.

    The dashes fold because the gwant -- the caesura of a cywydd line -- is
    printed as `--`, an en dash or an em dash depending on the edition, and it
    is the same mark in all three.
    """
    t = unicodedata.normalize("NFC", text)
    for bad in "’‘ʼ`´":
        t = t.replace(bad, "'")
    for dash in ("—", "–", "‒"):
        t = t.replace(dash, "--")
    return t


def units(word):
    """-> list of phoneme units, digraphs kept whole. None if out of
    inventory. This is the load-bearing function: get it wrong and every
    consonant skeleton in the language is wrong.

    THE APOSTROPHE IS AN ELISION MARK AND IT JOINS. `a'i`, `i'r`, `sy'n`,
    `mae'r` are each ONE syllable; the apostrophe records that two have become
    one, which is the opposite of what the same glyph does in `fin.py`, where
    it marks a hiatus and forces a syllable BREAK. Same character, opposite
    rule, because they are different languages -- so it is removed here and
    the letters either side read as contiguous. Before this, an internal
    apostrophe fell through to the out-of-inventory return and took the whole
    line with it: `units("a'i")` was None while `units("ai")` was ['a','i'],
    and Welsh elides often enough that this alone made 31% of a real corpus
    unreadable before any cynghanedd rule ran.

    The internal hyphen goes the same way, for the same reason: `di-baid` is
    one phonological word that happens to be printed with a joint.
    """
    w = normalise(word).replace("'", "").replace("-", "").lower()
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
        w = normalise(word).replace("'", "").replace("-", "").lower()
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
        proclitic = w in PROCLITICS
        for i, s in enumerate(sylls):
            if proclitic:
                s.prominence = 0
            else:
                s.prominence = 1 if (i == n - 2 or n == 1) else 0
        return sylls

    # -- cynghanedd -------------------------------------------------------

    def _syllables(self, text):
        """The half-line as one flat syllable sequence. None if unreadable.

        Flat, because a diweddeb is a property of the HALF-LINE and not of its
        last word: `dwr dan` ends on a proclitic, so its accent is in the word
        before, and a rule that keyed on the final word would call that end
        accented when it is not.
        """
        words = [w for w in WORD_RE.findall(normalise(text))
                 if w.strip("'-")]
        if not words:
            return None
        out = []
        for w in words:
            syls = self.syllabify(w)
            if not syls:
                return None
            out.extend(syls)
        return out

    #: The three places a span can stop. Which one applies is decided by the
    #: line's accentuation class, never by the caller's convenience.
    EXTENTS = ("acen", "llafariad", "llawn")

    def skeleton(self, text, extent):
        """The answered consonants of ONE HALF-LINE, stopping where `extent`
        says. -> list of units, or None when the half cannot be read.

          "acen"       consonants before the ACCENTED vowel. The *cytbwys
                       acennog* span: what follows the last accent is free.
          "llafariad"  consonants before the half's FINAL vowel. In an
                       accented end that is the same thing; in an unaccented
                       end it takes in the consonants between the accented
                       vowel and the final one, which the balanced-unaccented
                       class requires to be answered.
          "llawn"      every consonant in the half, final coda included. The
                       accented half of an *anghytbwys ddisgynedig* line: its
                       final consonant is answered by the one that opens the
                       last syllable of the other half -- `Darn fal haul |
                       dyrnfol heli`, where haul's `l` is answered by heli's.

        THERE IS NO DEFAULT. This argument used to be absent, which is the same
        thing as defaulting it to "acen", and that silently applied the
        accented-ending rule to lines of the other three classes. A caller who
        does not know the class cannot know the span, and should be calling
        `answer()`, which works the class out.
        """
        if extent not in self.EXTENTS:
            raise ValueError(
                f"extent={extent!r}; the declared spans are {self.EXTENTS}, "
                f"and which one applies is decided by the line's accentuation "
                f"class -- see answer().")
        syls = self._syllables(text)
        if syls is None:
            return None
        if extent == "acen":
            stop = None
            for i, s in enumerate(syls):
                if s.prominence == 1:
                    stop = i
            if stop is None:
                return None          # no accent, so no accented span
        elif extent == "llafariad":
            stop = len(syls) - 1
        else:
            stop = None              # run to the end of the half
        out = []
        for i, syl in enumerate(syls):
            out.extend(syl.onset)
            if i == stop:
                return out
            out.extend(syl.coda)
        return out

    # -- the diweddebau, and the class they make --------------------------

    def diwedd(self, half):
        """The DIWEDDEB of one half: how its end is accented.

        -> ("acennog"|"diacen", reason="") or (None, reason).

        Welsh stress is penultimate, so an end is `acennog` when the accent
        falls on the half's LAST syllable and `diacen` when it falls on the
        penult. Anything else -- two or more unaccented syllables trailing the
        accent, or no accent at all because the half is nothing but proclitics
        -- is not a diweddeb the strict metre recognises, and it is refused.
        Refused, specifically, rather than read as `acennog`, which is what
        the missing argument on `skeleton()` amounted to.
        """
        syls = self._syllables(half)
        if syls is None:
            return None, "unreadable"
        acc = None
        for i, s in enumerate(syls):
            if s.prominence == 1:
                acc = i
        if acc is None:
            return None, ("no accented syllable in this half, so it has no "
                          "diweddeb")
        tail = len(syls) - 1 - acc
        if tail == 0:
            return "acennog", ""
        if tail == 1:
            return "diacen", ""
        return None, (f"the accent falls {tail} syllables from the end of "
                      f"this half; a diweddeb is accented or penultimate")

    #: The accentuation classes, keyed by the two diweddebau, with the span
    #: each half contributes. This table IS the fix: the class decides where
    #: each side stops, and three of the four stop somewhere other than the
    #: accent. `None` is a refusal -- see `answer`.
    DOSBARTH = {
        ("acennog", "acennog"): ("cytbwys acennog",
                                 ("llafariad", "llafariad")),
        ("diacen", "diacen"): ("cytbwys ddiacen",
                               ("llafariad", "llafariad")),
        ("acennog", "diacen"): ("anghytbwys ddisgynedig",
                                ("llawn", "llafariad")),
        # first end unaccented, second accented. "llafariad" on the second
        # half is the same span as "acen" there, by definition of an accented
        # end; it is written this way so the row reads as what it is -- the
        # first half's post-accent consonants answered BEFORE the second
        # half's accent. Reachable only with dyrchafedig="rising".
        ("diacen", "acennog"): ("anghytbwys ddyrchafedig",
                                ("llafariad", "llafariad")),
    }

    def answer(self, first, second, dyrchafedig="refuse"):
        """The two spans this line's CLASS requires, worked out from the
        phonology of its two halves.

        -> {"class", "first", "second", "why"}; `first`/`second` are None when
        the line is refused and `why` says which end refused it.

        `dyrchafedig` is a declared coordinate, not a silent choice:

          "refuse"  an *anghytbwys ddyrchafedig* line -- unaccented end then
                    accented -- is not read as a consonantal cynghanedd at
                    all. The tradition works three classes, and the corpus
                    agrees: at those placements the traws rate sits below its
                    own within-line-shuffle null. This is the default.
          "rising"  read it anyway, first half to its final vowel and second
                    to its accent, so the alternative is measurable rather
                    than merely asserted.
        """
        if dyrchafedig not in ("refuse", "rising"):
            raise ValueError(
                f"dyrchafedig={dyrchafedig!r}; declared values are 'refuse' "
                f"(the tradition's three classes) and 'rising' (read the "
                f"fourth anyway, so the choice can be measured).")
        da, wa = self.diwedd(first)
        if da is None:
            return {"class": None, "first": None, "second": None,
                    "why": f"first half: {wa}"}
        db, wb = self.diwedd(second)
        if db is None:
            return {"class": None, "first": None, "second": None,
                    "why": f"second half: {wb}"}
        name, (ea, eb) = self.DOSBARTH[(da, db)]
        if name == "anghytbwys ddyrchafedig" and dyrchafedig == "refuse":
            return {"class": name, "first": None, "second": None,
                    "why": (f"{name}: the consonantal cynghanedd is not "
                            f"written with an unaccented end answered by an "
                            f"accented one")}
        return {"class": name, "first": self.skeleton(first, ea),
                "second": self.skeleton(second, eb), "why": ""}

    def llusg(self, line):
        """Cynghanedd lusg: the final word is polysyllabic and stressed on its
        penult, and that penult rhymes with a stressed syllable EARLIER in the
        line.

        It is the one traditional type built on vowel rhyme rather than on the
        consonant skeleton, and it is internal by definition -- the answer is
        inside the line, not at its end. Returns (True, detail) or
        (False, reason).
        """
        words = [w for w in WORD_RE.findall(normalise(line))
                 if w.strip("'-")]
        if len(words) < 2:
            return False, "need at least two words"
        final = self.syllabify(words[-1])
        if len(final) < 2:
            return False, "the final word is a monosyllable, so it has no penult"
        pen = final[-2]
        if pen.prominence != 1:
            return False, "the final word's penult is not the stressed syllable"
        for w in words[:-1]:
            for syl in self.syllabify(w):
                if syl.prominence == 1 and syl.nucleus == pen.nucleus \
                        and syl.coda == pen.coda:
                    return True, (f"penult {pen.text!r} of {words[-1]!r} "
                                  f"rhymes {syl.text!r} in {w!r}")
        return False, f"nothing earlier rhymes the penult {pen.text!r}"

    #: Marks an edition actually prints for the caesura. The gwant of a cywydd
    #: line is set as `--`; `/` and `|` are the teaching and editorial marks.
    #: A comma is NOT here, and see `cynghanedd` for why that mattered.
    CAESURA_RE = re.compile(r"\s*(?:--+|/|\|)\s*")

    def _marked_parts(self, line):
        """Split on a PRINTED caesura. None when the line has none.

        A fragment with no letters in it is not a part. `Bryd a chorff yn
        ddiorffwys,--` used to split into a real half and a bare `--`, which
        reached `skeleton()`, found no words, returned None, and reported the
        whole line `unreadable` -- 14.6% of a real corpus lost to a trailing
        dash.
        """
        raw = self.CAESURA_RE.split(normalise(line))
        parts = [p.strip() for p in raw if WORD_RE.findall(p or "")]
        return parts if len(parts) >= 2 else None

    def cynghanedd_scan(self, line, caesura="search", dyrchafedig="refuse"):
        """Search every word boundary for a caesura that makes the line work.

        -> {"type", "detail", "positions_tried", "caesura"}

        `positions_tried` is the point of this method. Taking the best of k
        placements is k hypotheses, and doctrine 19 says an argmax over a swept
        parameter is biased -- so the sweep reports its own width and the
        caller corrects for it. `quality/time_layer.py` already holds the
        Sidak/Bonferroni machinery this feeds.

        The order below is deliberate: croes before traws before sain, strict
        before loose, so a line is reported as the tightest type it satisfies
        rather than the first one tried.
        """
        words = [w for w in WORD_RE.findall(normalise(line)) if w.strip("'-")]
        n = len(words)
        if n < 2:
            return {"type": None, "detail": "fewer than two words",
                    "positions_tried": 0, "caesura": None}
        two = [(i,) for i in range(1, n)]
        three = list(itertools.combinations(range(1, n), 2))
        tried = len(two) + len(three)
        best = None
        for cut in two:
            a = " ".join(words[:cut[0]])
            b = " ".join(words[cut[0]:])
            ans = self.answer(a, b, dyrchafedig=dyrchafedig)
            sa, sb = ans["first"], ans["second"]
            if sa is None or sb is None or not sa:
                continue
            if sa == sb:
                return {"type": "croes",
                        "detail": f"{ans['class']}: skeleton {sa} answered "
                                  f"exactly across {a!r} | {b!r} "
                                  f"(1 of {tried} placements)",
                        "positions_tried": tried, "caesura": cut,
                        "class": ans["class"]}
            if best is None and len(sb) > len(sa) and sb[-len(sa):] == sa:
                best = {"type": "traws",
                        "detail": f"{ans['class']}: skeleton {sa} answered "
                                  f"after bridge {sb[:-len(sa)]} across "
                                  f"{a!r} | {b!r} (1 of {tried} placements)",
                        "positions_tried": tried, "caesura": cut,
                        "class": ans["class"]}
        if best:
            return best
        for i, j in three:
            trio = (" ".join(words[:i]), " ".join(words[i:j]),
                    " ".join(words[j:]))
            kind, why = self._sain(trio)
            if kind:
                return {"type": "sain",
                        "detail": f"{why} (1 of {tried} placements)",
                        "positions_tried": tried, "caesura": (i, j)}
        ok, why = self.llusg(line)
        if ok:
            return {"type": "llusg", "detail": why,
                    "positions_tried": tried, "caesura": None}
        return {"type": None,
                "detail": f"no cynghanedd at any of {tried} caesura "
                          f"placements; llusg: {why}",
                "positions_tried": tried, "caesura": None}

    def _sain(self, parts):
        """Three parts: 1 rhymes 2, and 2 alliterates 3. -> (kind, why)."""
        try:
            a, b, c = (self.syllabify(p.split()[-1]) for p in parts)
        except IndexError:
            return None, "a part with no words"
        if not a or not b or not c:
            return None, "unreadable"
        rhyme = a[-1].nucleus == b[-1].nucleus and a[-1].coda == b[-1].coda
        allit = bool(b[0].onset) and b[0].onset == c[0].onset
        if rhyme and allit:
            return "sain", (f"{parts[0].split()[-1]} rhymes "
                            f"{parts[1].split()[-1]}, then alliterates "
                            f"{parts[2].split()[-1]} on {b[0].onset[0]!r}")
        return None, f"sain needs rhyme AND alliteration; rhyme={rhyme} allit={allit}"

    def cynghanedd(self, line, caesura="marked"):
        """-> (type, detail) or (None, reason). Types: croes, traws, sain,
        llusg.

        croes  every consonant of the first half answered, in order, in the
               second
        traws  the same, after an unanswered bridge at the start of the second
        sain   three parts: 1 rhymes with 2, and 2 alliterates with 3
        llusg  the final word's stressed penult rhymes something earlier

        NO GRADED VARIANT. The English path offers a "chime" reading -- a
        graded consonant-skeleton similarity -- which needs a Welsh consonant
        FEATURE table that does not exist. Rather than borrow the English one,
        this returns exact types only. Unknown never produces a number.

        `caesura` is a declared coordinate, not a default nobody chose:

          "marked"  the caesura must be PRINTED (`/`, `|`, or the gwant `--`).
                    A line without one is refused, because its caesura is not
                    in the text. This is the honest reading of an ordinary
                    edition and it is the default.
          "search"  try every word boundary and report the best. This is a
                    SEARCH OVER k HYPOTHESES and it inflates: see
                    `cynghanedd_scan`, which returns the k so the inflation can
                    be corrected rather than absorbed. Never compare a searched
                    rate against an unsearched one.

        A PRINTED COMMA IS NOT A CAESURA. It used to be treated as one, which
        is worse than it sounds: a line with two commas was forced down the
        three-part `sain` path and could not be read as croes or traws at all,
        so ordinary punctuation silently selected which rule a line was tested
        against.
        """
        if caesura not in ("marked", "search"):
            raise ValueError(
                f"caesura={caesura!r}; declared values are 'marked' (the "
                f"caesura must be printed) and 'search' (try every boundary "
                f"and report how many were tried).")
        if caesura == "search":
            hit = self.cynghanedd_scan(line)
            return hit["type"], hit["detail"]
        parts = self._marked_parts(line)
        if parts is None:
            ok, why = self.llusg(line)
            if ok:
                return "llusg", why
            return None, ("no caesura is printed in this line, so its "
                          "position is not in the text; pass caesura='search' "
                          f"to try every boundary. llusg: {why}")
        if len(parts) == 3:
            kind, why = self._sain(parts)
            if kind:
                return kind, why
            return None, why
        if len(parts) != 2:
            ok, why = self.llusg(line)
            if ok:
                return "llusg", why
            return None, (f"need 2 or 3 parts split on a caesura, got "
                          f"{len(parts)}; llusg: {why}")
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
        ok, why = self.llusg(line)
        if ok:
            return "llusg", why
        return None, f"{sa} not answered by {sb}; llusg: {why}"


register(Welsh())
