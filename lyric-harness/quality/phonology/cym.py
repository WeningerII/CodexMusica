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
BELOW its own null under either reading. What its apparent croes lift was made
of is visible in one line: `A'i gorn teg i | gern y twr` scores identically to
the legal `A'i gorn teg | i gern y twr` because the proclitic `i` carries no
consonant, so every real cytbwys acennog line with a consonant-free proclitic
at the seam grew a duplicate placement one word over.

WHAT IT COSTS, WHICH IS THE ONLY QUESTION (doctrine 61)
`quality/cynghanedd_rate.py`, caesura='search', 200 within-line shuffles:

                    observed         null max          gap
    Alun          54.1% -> 57.1%   27.8% -> 21.8%   +26.3 -> +35.3
    Twm o'r Nant  51.3% -> 46.2%   36.5% -> 26.9%   +14.7 -> +19.2

The second row is the one to read: the class rule fires LESS often on Twm o'r
Nant and is still the better rule, because the null falls further than the
observation does. A rate is not evidence; the excess over a matched control is.

DECLARED AMBIGUITIES, rather than resolved ones

- **ng** is /ŋ/ in `llong`, but /ŋg/ in `Bangor` and across some morpheme
  boundaries. There is no orthographic signal. This module reads it as the
  single unit /ŋ/ and reports it, because guessing per word would be a lexicon
  and this is a rules-only module.
- **y** is "clear" in final syllables and monosyllables, "obscure" elsewhere.
  It is recorded on the syllable so a caller can see it, and it does not affect
  the consonant skeleton, which is what cynghanedd is built on.
- **i** and **w** are consonantal before a vowel in some environments and
  vocalic in others; the vocalic reading is taken and flagged. `syllabify` is
  UNCHANGED and still takes it -- see `glide=` below, which is where the
  end-rhyme relation stops taking it and holds both readings instead.

THE SECOND RELATION: END-RHYME (*odl*), ADDED 2026-08-11

Until this was written the module implemented cynghanedd and nothing else, so
`quality/negative_control.py --langs` recorded Welsh at **mandated 108, judged
0, refused 108** -- a 100% refusal, and the only one of the seven staged
language prefixes with no other route to a verdict. English refuses through the
same path and is not thereby unmeasured, because `lyric_harness.best_score` and
the whole comparator stack answer for it. Welsh had nothing. Doctrine 44: the
blocker was the MODULE, the cheap kind.

FIVE COORDINATES, EVERY ONE DECLARED AND EVERY ONE MEASURED. See
`rhyme_declaration()` for the machine-readable tuple and
`quality/RESULTS_CYM_RHYME.md` for the table that chose each one.

1. **The anchor is counted FROM THE WORD END** (`rule="depth"`,
   `RIME_DEPTH=1`), never from the last prominent syllable. Welsh stress is
   PENULTIMATE, so the rhyme-bearing final syllable of a polysyllable is
   UNSTRESSED and the English predicate -- "from the last stressed vowel to the
   end of the word" -- reads a two-syllable span there and a one-syllable span
   on a monosyllable. The *cywydd deuair hirion* pairs exactly those two: one
   line of the couplet ends accented, the other unaccented. Measured on the
   staged cywydd, 54 attested couplets: the shipped rule answers TRUE on 51 and
   the English port on 2. It is not rejected, it is FALSIFIED, and
   `rule="prominent"` keeps the falsification a function call (doctrine 84).
2. **The circumflex is FOLDED** (`diacritics="fold"`). It is a LENGTH mark, and
   the staged corpus writes the same language both ways: `cym_song_alun.txt`
   and `cym_song_mynyddog.txt` are ISO-646-US transcriptions with the
   circumflexes FLATTENED (0 in 92,519 and 6,243 characters of verse), while
   `cym_song_hwiangerddi.txt`, `cym_song_twm_or_nant.txt` and the cywydd carry
   real ones. That is `fin.py`'s w/v case (MISSING M-5) in a second language --
   one distinction, two transcriptions, MIXED ACROSS the corpus -- and it is
   settled by the tradition rather than by taste: unfolded, 12 of 78 couplets
   of `corpus/cym_twm_or_nant_cywydd.txt` come back False on nothing but a
   circumflex (`gân : ddatgan`, `sôn : gofion`, `uchel : chêl`). A form whose
   end-rhyme is obligatory does not miss one couplet in six. `diacritics="keep"`
   is reachable and it is what produces that 12.
3. **A word-initial `w`/`i` glide is UNDECIDED, not decided** (`glide=
   "undecided"`). `wych` is `w`+`ych` or the diphthong `wy`+`ch` and no rule in
   this orthography tells them apart; the module's own docstring has flagged
   the ambiguity since it was written and `syllabify` still takes the vocalic
   reading. In the RIME the two readings are held together and `rhymes` returns
   True where both agree, False where neither can and **None where they
   disagree** -- which is `relations.py`'s ternary and doctrine 53's rule, a
   verdict that depends on a distinction the orthography has collapsed is
   refused rather than guessed. It fires on 32 of 5,246 staged line-ends.
   `glide="vocalic"` reproduces the pre-existing reading and `glide=
   "consonantal"` the other, so the choice is measurable and not settled by
   fiat.
4. **Initial consonant mutation (treiglad) DOES NOT PARTICIPATE, and cannot.**
   See `MUTATION`. Surface only, never lemmatise -- the parallel decision to
   `fin.GRADATION`, reached by a different route: in Finnish the gradating
   consonant sits INSIDE the rime and the decision is a judgement, here the
   mutating consonant is provably outside it and the decision is a derivation.
5. **A shared grammatical ending is NOT typed**, and that is a refusal to
   invent rather than a silence. See `rhyme_declaration()['shared_ending']`:
   no dated source stating the Welsh odl rule or listing the productive endings
   was reachable from this cell, and the search is recorded rather than
   remembered (doctrine 39). `shared_tail()` reports the raw diagnostic so a
   caller with such a list can apply it.
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
#: `"yb"` is UNREACHABLE and is left in place rather than quietly deleted: the
#: merge in `syllabify` fires only where BOTH members are classed `V`, and `b`
#: is in CONSONANTS, so no input can ever match it. Removing it is provably a
#: no-op and so is keeping it; it is recorded here because an inventory with a
#: dead entry is a small claim nobody checked, and `aw` is listed twice for the
#: same reason (a set, so the duplicate collapses).

# ---------------------------------------------------------------------------
# THE END-RHYME RELATION (*odl*).  Its five coordinates, as constants, so
# `rhyme_declaration()` is built FROM them and cannot drift away from them --
# `fin.py` shipped a `relation` string naming RIME_DEPTH=2 while the constant
# was 1 for the whole life of that relation, and a dict built from the constant
# is the fix that a hand-maintained sentence is not.
# ---------------------------------------------------------------------------

#: Syllables of the rime, COUNTED FROM THE WORD END, clamped by `rhymes` to the
#: shorter of the two words.  1 is the shipped grade.  Welsh stress is
#: penultimate, so this is deliberately NOT the last-prominent-syllable rule
#: that `eng` uses; see RHYME_RULE.
RIME_DEPTH = 1

#: "depth"      the shipped reading: RIME_DEPTH syllables from the END.
#: "prominent"  the English predicate ported -- from the last PROMINENT nucleus
#:              to the end of the word.  Kept reachable so its falsification is
#:              a call rather than a claim (doctrine 84).  Under penultimate
#:              stress it reads TWO syllables of a polysyllable and ONE of a
#:              monosyllable, so it cannot answer a cywydd couplet, which pairs
#:              exactly those two; and it REFUSES outright on a line ending in
#:              a proclitic, because a proclitic has no prominent syllable at
#:              all (doctrine 46 -- the function-word list is part of the
#:              phonology, and here it decides whether the port can answer).
RHYME_RULE = "depth"

#: "fold"  strip the combining marks before the rime is built.  Welsh writes
#:         the circumflex on a vowel to mark LENGTH; the staged corpus contains
#:         both a transcription that keeps it and two that flattened it to
#:         ASCII, so the SAME distinction is present in one file and absent in
#:         the next.  Folding makes the corpus one corpus.  It is applied ONLY
#:         in the rime path -- `syllabify`, `skeleton` and every cynghanedd
#:         number are untouched, which is checked rather than trusted.
#: "keep"  do not fold.  Reachable, and it is the reading that calls 12 of the
#:         78 attested couplets of `corpus/cym_twm_or_nant_cywydd.txt` False.
DIACRITICS = "fold"

#: What to do when the rime's anchor begins with a word-initial `w`/`i` that
#: could be a consonant (a glide) or the first element of a diphthong.  There
#: is no orthographic signal, so:
#: "undecided"    hold BOTH readings; True where they agree True, False where
#:                they agree False, None where they disagree.  Shipped.
#: "vocalic"      the diphthong reading -- what `syllabify` has always taken.
#: "consonantal"  the glide reading.
#: The last two exist so the shipped refusal can be measured against both
#: decided readings instead of being asserted better than them.
GLIDE = "undecided"

#: TREIGLAD IS DECLARED NOT TO PARTICIPATE, and unlike `fin.GRADATION` this is
#: a DERIVATION rather than a judgement, which is why it needs no setting.
#:
#: Welsh initial consonant mutation replaces or deletes the WORD-INITIAL
#: consonant, and nothing else: `tân` / `dân` / `thân`, `brân` / `frân`,
#: `môr` / `fôr`, `cân` / `gân` / `chân` are all in the staged corpus.  A rime
#: begins at a NUCLEUS.  The only onset it could ever reach is that of its own
#: first covered syllable, and it excludes that one by construction -- that
#: exclusion is what makes it a rhyme rather than an identity.  So a change
#: confined to the word-initial consonant run is INVISIBLE to every rime this
#: module can build, at any depth and under either anchor rule, and there is
#: nothing for a mutation-aware setting to do.  Surface only, never lemmatise:
#: `quality/test_phonology.py` §10g pins the corpus-attested triples.
MUTATION = ("does not participate, and CANNOT: treiglad changes only the "
            "word-INITIAL consonant, which is the onset of syllable 0, and a "
            "rime never reads the onset of its first covered syllable. "
            "Surface only -- never lemmatise. There is no mutation-aware "
            "setting to reach for because there is nothing for one to do.")


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


def fold_diacritics(text):
    """Strip the combining marks. -> str.

    Welsh writes the circumflex on a vowel to mark LENGTH (`tân`, `dŵr`,
    `gŵr`), and over the seven staged Welsh files this is 191 combining
    circumflexes against 2 combining diaereses -- so the mark that folds here
    is overwhelmingly the length mark. Two of the five files in
    `corpus/song/cym_*` are ISO-646-US transcriptions in which it has been
    flattened away already, which is the reason folding is the default: the
    alternative is a comparator whose answer depends on which volume a line
    came out of.

    NOT applied by `syllabify` and NOT applied anywhere in the cynghanedd path.
    Folding CAN change a syllable count -- `â'u` normalises to `âu`, two nuclei,
    and folds to `au`, which is a listed diphthong and one -- so applying it
    globally would move numbers in a relation that never asked for it
    (doctrine 58: write the setting next to the number, do not silently move
    the number).

    **ONLY OVER A VOWEL.** A blanket "strip every combining mark" would turn
    `ñ` into `n` and quietly admit a foreign proper name that `units()`
    correctly refuses -- the monoculture error arriving through the back door
    of a normaliser. The mark is dropped only where the base letter is one of
    the seven Welsh vowels, which is where Welsh writes one, so an
    out-of-inventory character stays out of inventory.
    """
    out, base = [], ""
    for c in unicodedata.normalize("NFD", text):
        if unicodedata.combining(c):
            if base in "aeiouwyAEIOUWY":
                continue          # a Welsh length/hiatus mark: drop it
            out.append(c)
            continue
        base = c
        out.append(c)
    return unicodedata.normalize("NFC", "".join(out))


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
    relation = ("TWO, declared separately: (1) cynghanedd -- consonant "
                "skeleton answered across the caesura (croes/traws), or "
                "rhyme-then-alliteration (sain), or lusg; (2) end-rhyme "
                "(odl) -- the last RIME_DEPTH=1 syllable(s) agree from the "
                "first covered NUCLEUS, counted FROM THE WORD END and NOT "
                "anchored on prominence, because Welsh stress is penultimate "
                "and a rhyme-bearing final syllable is therefore normally "
                "UNSTRESSED. Every coordinate of (2) is in "
                "`rhyme_declaration()`; the anchor is the one a reader of the "
                "English engine will assume wrong, and the cywydd is the form "
                "that proves it, because it pairs an accented end with an "
                "unaccented one on purpose.")
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

        -> {"type", "detail", "positions_tried", "caesura", "class"}

        `class` is the ACCENTUATION CLASS of the placement it reported, and it
        is None for sain, llusg and for no result -- the class is a property of
        the two ends either side of a caesura, so a reading that does not put
        one there does not have one. `dyrchafedig` is passed through to
        `answer()`.

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
                    "positions_tried": 0, "caesura": None, "class": None}
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
                        "positions_tried": tried, "caesura": (i, j),
                        "class": None}
        ok, why = self.llusg(line)
        if ok:
            return {"type": "llusg", "detail": why,
                    "positions_tried": tried, "caesura": None, "class": None}
        return {"type": None,
                "detail": f"no cynghanedd at any of {tried} caesura "
                          f"placements; llusg: {why}",
                "positions_tried": tried, "caesura": None, "class": None}

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

    def cynghanedd(self, line, caesura="marked", dyrchafedig="refuse"):
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

        `dyrchafedig` is the other declared coordinate and it is passed to
        `answer()`: whether a line whose first end is unaccented and whose
        second is accented is read as a consonantal cynghanedd at all.

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
            hit = self.cynghanedd_scan(line, dyrchafedig=dyrchafedig)
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
        ans = self.answer(parts[0], parts[1], dyrchafedig=dyrchafedig)
        sa, sb = ans["first"], ans["second"]
        if sa is None or sb is None:
            ok, why = self.llusg(line)
            if ok:
                return "llusg", why
            return None, f"{ans['why']}; llusg: {why}"
        if not sa:
            return None, "no consonants before the caesura"
        if sa == sb:
            return "croes", f"{ans['class']}: skeleton {sa} answered exactly"
        if len(sb) > len(sa) and sb[-len(sa):] == sa:
            return "traws", (f"{ans['class']}: skeleton {sa} answered after "
                             f"unanswered bridge {sb[:-len(sa)]}")
        ok, why = self.llusg(line)
        if ok:
            return "llusg", why
        return None, (f"{ans['class']}: {sa} not answered by {sb}; "
                      f"llusg: {why}")

    # -- the SECOND relation: end-rhyme (odl) -----------------------------

    def rhyme_declaration(self):
        """-> the end-rhyme relation's coordinate tuple (doctrine 1).

        Built FROM the module constants, never beside them. `fin.py` records
        why: its `relation` string named a depth it did not ship, for the
        whole life of the relation, and a sentence a human maintains beside a
        constant drifts while a dict built from the constant cannot.
        """
        return {
            "anchor": (
                f"COUNTED FROM THE WORD END: the last RIME_DEPTH="
                f"{RIME_DEPTH} syllable(s), measured from the first covered "
                f"syllable's NUCLEUS, clamped to the SHORTER of the two "
                f"words. NOT the last prominent syllable. Welsh stress is "
                f"PENULTIMATE, so the syllable that carries the rhyme is "
                f"normally UNSTRESSED, and a prominence anchor reads two "
                f"syllables of a polysyllable against one of a monosyllable "
                f"-- which is exactly the pair a cywydd couplet is built "
                f"from. Reachable as rule='prominent' and FALSIFIED there, "
                f"not merely rejected."),
            "anchor_rule": RHYME_RULE,
            "depth": RIME_DEPTH,
            "nucleus": (
                "the syllable's vowel: one of a e i o u w y, or one of the "
                "listed diphthongs. `w` and `y` ARE vowels in Welsh and the "
                "inventory says so. `y` is clear in a final syllable and "
                "obscure elsewhere; that alternation is NOT written and is "
                "NOT read here, so two `y` nuclei compare equal whatever "
                "their position -- a declared loss, and the one place this "
                "module's nucleus is coarser than the language."),
            "coda": (
                "every consonant unit after the nucleus in that syllable, "
                "with the EIGHT DIGRAPHS (ch dd ff ng ll ph rh th, plus the "
                "nasal-mutation ngh mh nh) kept WHOLE. `mynydd` has coda "
                "('dd',) and not ('d','d'); splitting them is the one error "
                "that makes every Welsh skeleton wrong while still looking "
                "plausible."),
            "onset_of_the_anchor": (
                "FREE, and comparing it is what relation_type() calls "
                "RIME_RICHE. It is also the whole of why treiglad cannot "
                "participate -- see `mutation`."),
            "diacritics": (
                f"{DIACRITICS!r} -- the circumflex is a LENGTH mark and it is "
                f"FOLDED. Not a taste: the staged corpus mixes an ASCII "
                f"transcription that flattened it with a UTF-8 one that kept "
                f"it, so the distinction is present in one volume and absent "
                f"in the next. diacritics='keep' is reachable and it is the "
                f"reading under which one attested cywydd couplet in six "
                f"fails on nothing but a circumflex."),
            "glide": (
                f"{GLIDE!r} -- a word-initial `w`/`i` before a vowel may be a "
                f"consonant or the first element of a diphthong and the "
                f"orthography does not say which. Both readings are held; the "
                f"verdict is True where they agree, False where they agree, "
                f"and None where they DISAGREE. That is the only refusal here "
                f"that is a property of the PAIR rather than of a word, so it "
                f"is an AIMED refusal in doctrine 67's sense -- it falls on "
                f"the pairs where the collapsed distinction decides the "
                f"answer, and nowhere else."),
            "mutation": MUTATION,
            "shared_ending": (
                "NOT TYPED, and that is a refusal to invent rather than a "
                "silence. `fin.relation_type` returns SUFFIX_RHYME because it "
                "has a declared list of Finnish endings; no comparable Welsh "
                "list was reachable from this cell and writing a plausible "
                "one from memory is the thing this repo forbids. What is "
                "reachable is recorded: `shared_tail(a, b)` returns the "
                "longest common written tail so a caller holding such a list "
                "can apply it, and RESULTS_CYM_RHYME.md tables the tail "
                "distribution so the size of the unanswered question is "
                "visible rather than assumed away. The unblock route is a "
                "SOURCE, not a build (doctrine 44)."),
            "refusals": (
                "three, each derived from what the RELATION needs (doctrine "
                "60): an out-of-inventory character, a token with no vowel, "
                "and a glide the two readings disagree about. See "
                "UNREADABLE_REASONS; the third is the only one that needs a "
                "pair to detect."),
            "notation": self.notation,
        }

    def _rime_start(self, sylls, rule, depth):
        """-> index of the first syllable the rime covers, or None.

        `depth` is clamped by the CALLER to the shorter of the two words.
        `prominent` is per-MEMBER (doctrine 83): each word declares its own
        anchor off its own prominence grid, and under a PENULTIMATE rule that
        is a different span on each side of a cywydd couplet, which is why it
        cannot answer one. It returns None on a word with no prominent
        syllable at all -- a proclitic -- rather than falling back.
        """
        if rule == "prominent":
            p = [k for k, s in enumerate(sylls) if s.prominence == 1]
            return max(p) if p else None
        if rule != "depth":
            raise ValueError(f"unknown rhyme rule {rule!r}; "
                             f"declared: 'depth', 'prominent'")
        return len(sylls) - depth

    @staticmethod
    def _glide_split(syl):
        """-> the CONSONANTAL reading of a word-initial glide syllable, or None.

        The ambiguity is `wych`: `w` + `ych`, or the diphthong `wy` + `ch`.
        It exists only where the syllable has NO onset (so the `w`/`i` is the
        first thing in the word) and a multi-letter nucleus starting `w` or
        `i`. The alternative reading moves that letter into the onset -- where
        the rime does not read it -- so the two readings differ in exactly one
        place, the NUCLEUS, which is what makes them worth holding rather than
        collapsing.
        """
        if syl.onset or not isinstance(syl.nucleus, str):
            return None
        if len(syl.nucleus) < 2 or syl.nucleus[0] not in "wi":
            return None
        return Syllable(syl.text, (syl.nucleus[0],), syl.nucleus[1:],
                        syl.coda, syl.prominence, syl.moras)

    def _sylls_for_rime(self, word, diacritics):
        if diacritics not in ("fold", "keep"):
            raise ValueError(
                f"diacritics={diacritics!r}; declared values are 'fold' (the "
                f"circumflex is a length mark and the corpus mixes two "
                f"transcriptions of it) and 'keep'.")
        return self.syllabify(
            fold_diacritics(word) if diacritics == "fold" else word)

    def rimes(self, word, depth=RIME_DEPTH, rule=RHYME_RULE,
              diacritics=DIACRITICS, glide=GLIDE):
        """-> a TUPLE of the rime readings this word permits. () is a refusal.

        One entry under a decided `glide`; one or two under `glide=
        "undecided"`. Each reading runs from the first covered syllable's
        NUCLEUS to the end of the word: (nucleus, coda, onset, nucleus, coda,
        ...). The first syllable's ONSET is deliberately absent -- that is what
        makes this a rhyme rather than an identity, and it is also why
        treiglad cannot reach it.
        """
        if glide not in ("undecided", "vocalic", "consonantal"):
            raise ValueError(
                f"glide={glide!r}; declared values are 'undecided' (hold both "
                f"readings and refuse where they disagree), 'vocalic' (the "
                f"diphthong reading, which is what syllabify takes) and "
                f"'consonantal' (the glide reading).")
        s = self._sylls_for_rime(word, diacritics)
        if not s:
            return ()
        d = max(1, min(depth, len(s)))
        i = self._rime_start(s, rule, d)
        if i is None:
            return ()
        readings = [s]
        alt = self._glide_split(s[i]) if i == 0 else None
        if alt is not None:
            if glide == "vocalic":
                pass
            elif glide == "consonantal":
                readings = [[alt] + s[1:]]
            else:
                readings = [s, [alt] + s[1:]]
        out = []
        for r in readings:
            t = [r[i].nucleus, "".join(r[i].coda)]
            for x in r[i + 1:]:
                t += ["".join(x.onset), x.nucleus, "".join(x.coda)]
            t = tuple(t)
            if t not in out:
                out.append(t)
        return tuple(out)

    def rime(self, word, depth=RIME_DEPTH, rule=RHYME_RULE,
             diacritics=DIACRITICS, glide=GLIDE):
        """-> the single rime tuple, or None.

        None where the word is unreadable AND where it holds more than one
        reading: a caller that wants one value must say which reading it
        means, via `glide='vocalic'` or `glide='consonantal'`. Returning the
        first of two would be `prons[0]` -- the defect the whole knowledge-set
        machinery in `quality/phonology/__init__.py` exists to prevent.
        """
        r = self.rimes(word, depth, rule, diacritics, glide)
        return r[0] if len(r) == 1 else None

    def rhymes(self, a, b, depth=RIME_DEPTH, rule=RHYME_RULE,
               diacritics=DIACRITICS, glide=GLIDE):
        """-> True / False / None. None means 'cannot tell', never a guess.

        The depth is clamped to the SHORTER word, so a monosyllabic rhyme word
        drags the comparison to one syllable rather than failing on length --
        which is not an accommodation but the form's own rule: a cywydd
        couplet pairs an *acennog* end with a *diacen* one, so the two sides
        are of different lengths BY CONSTRUCTION.

        Three ways to get None, and they are different (doctrine 88): either
        word unreadable; `rule='prominent'` on a word with no prominent
        syllable; or the two glide readings disagreeing, which is the only one
        that needs both words to detect.
        """
        ra = self.rimes(a, depth, rule, diacritics, glide)
        rb = self.rimes(b, depth, rule, diacritics, glide)
        if not ra or not rb:
            return None
        sa = self._sylls_for_rime(a, diacritics)
        sb = self._sylls_for_rime(b, diacritics)
        if rule == "depth":
            d = max(1, min(depth, len(sa), len(sb)))
            if d != depth:
                ra = self.rimes(a, d, rule, diacritics, glide)
                rb = self.rimes(b, d, rule, diacritics, glide)
        verdicts = {x == y for x in ra for y in rb}
        return verdicts.pop() if len(verdicts) == 1 else None

    def shared_tail(self, a, b, diacritics=DIACRITICS):
        """-> the longest common WRITTEN tail of two words.

        A diagnostic, never a verdict. It is what a caller holding a list of
        Welsh grammatical endings would test against; this module holds no
        such list and says so in `rhyme_declaration()['shared_ending']`
        rather than inventing one.
        """
        x = normalise(a).replace("'", "").replace("-", "").lower()
        y = normalise(b).replace("'", "").replace("-", "").lower()
        if diacritics == "fold":
            x, y = fold_diacritics(x), fold_diacritics(y)
        k = 0
        while k < min(len(x), len(y)) and x[-1 - k] == y[-1 - k]:
            k += 1
        return x[len(x) - k:]

    def relation_type(self, a, b, depth=RIME_DEPTH, rule=RHYME_RULE,
                      diacritics=DIACRITICS, glide=GLIDE):
        """-> REPEAT / RIME_RICHE / RHYME / NONE / None.

        Doctrine 3: identity is not rhyme, and this repo has already been bitten
        by not typing it -- half of `corpus/whitman.txt`'s detected chain links
        are REPEAT on an identical token, which is why that file was never an
        eligible negative control. A Welsh song corpus is full of refrains, so
        the same trap is live here and the same answer applies: TYPE it, do not
        delete it (doctrine 24).

        SUFFIX_RHYME is deliberately absent. `fin` can return it because it has
        a declared list of Finnish endings; this module has no sourced Welsh
        equivalent, and a type nobody can compute is worse than a type nobody
        offers -- `length='apocopated'` (doctrine 83) is this repo's precedent
        for that. `shared_tail()` is what a caller uses instead.
        """
        v = self.rhymes(a, b, depth, rule, diacritics, glide)
        if v is None:
            return None
        if not v:
            return "NONE"
        sa = self._sylls_for_rime(a, diacritics)
        sb = self._sylls_for_rime(b, diacritics)
        if [s.text for s in sa] == [s.text for s in sb]:
            return "REPEAT"
        d = max(1, min(depth, len(sa), len(sb))) if rule == "depth" else depth
        i, j = self._rime_start(sa, rule, d), self._rime_start(sb, rule, d)
        if [s.text for s in sa[i:]] == [s.text for s in sb[j:]]:
            return "RIME_RICHE"
        return "RHYME"

    def refusal_reason(self, word, depth=RIME_DEPTH, rule=RHYME_RULE,
                       diacritics=DIACRITICS, glide=GLIDE):
        """-> None if the word supplies a rime, else a code naming WHY.

        Doctrine 88 one layer down: a refusal rate is uninterpretable until an
        ingestion miss and a designed refusal are told apart, and that has to
        be a function call rather than a paragraph. The codes are in
        UNREADABLE_REASONS.

        `undecided_glide` is NOT reported here, and that is the point of this
        docstring: it is a property of a PAIR, so a word-level census cannot
        see it. `glide_ambiguous()` reports the word-level marker; only
        `rhymes` can report the refusal.
        """
        src = fold_diacritics(word) if diacritics == "fold" else word
        if units(src) is None:
            return "out_of_inventory"
        if not self._sylls_for_rime(word, diacritics):
            return "vowelless_token"
        if not self.rimes(word, depth, rule, diacritics, glide):
            return "no_prominent_syllable"
        return None

    def glide_ambiguous(self, word, diacritics=DIACRITICS):
        """-> True where this word's FIRST syllable carries the undecided
        word-initial `w`/`i`. A marker, not a refusal: it only becomes one when
        the ambiguous syllable is inside the rime AND the two readings give
        different answers against the other word."""
        s = self._sylls_for_rime(word, diacritics)
        return bool(s) and self._glide_split(s[0]) is not None


#: code -> (layer that OWNS it, is it a defect at all, one-line reason).
#: The same table `fin.py` and `msa.py` carry, for the same reason: doctrine 88
#: says a refusal rate is uninterpretable until an ingestion miss and a designed
#: refusal are told apart, and doctrine 79 says report the counts separately.
UNREADABLE_REASONS = {
    "vowelless_token": (
        "ingestion", True,
        "no vowel, so no nucleus and no word: in this corpus these are "
        "footnote and plate markers left behind by the extraction (`c`, `v`, "
        "`jpg`) and bare elision fragments. Owned by the tokenizer, not by "
        "this module."),
    "out_of_inventory": (
        "notation", False,
        "a character outside the declared Welsh alphabet. Notation is "
        "declared, never sniffed: a correct refusal."),
    "no_prominent_syllable": (
        "phonology", False,
        "rule='prominent' only: the word has no prominent syllable, which "
        "under the Welsh rule means it is a PROCLITIC (doctrine 46). The "
        "shipped anchor does not ask the question and so never hits this."),
    "undecided_glide": (
        "phonology", False,
        "DESIGNED refusal, and the only one that is a property of the PAIR: a "
        "word-initial `w`/`i` is a glide or a diphthong member, the "
        "orthography does not say which, and the two readings disagree about "
        "THIS pair. Refused rather than guessed -- doctrine 53, a verdict "
        "that turns on a distinction the orthography has collapsed."),
}


def readability_census(phon, tokens, **kw):
    """-> the THREE counts doctrine 79 demands, never two.

    `read` + `refused` + `defective` == `total`. Same shape as
    `fin.readability_census`, so the two languages' rows are comparable.
    `undecided_glide` cannot appear here: it needs a pair. See
    `pair_census` for the count that can see it.
    """
    out = {"total": 0, "read": 0, "refused": 0, "defective": 0, "by_code": {},
           "by_layer": {}}
    for t in tokens:
        out["total"] += 1
        code = phon.refusal_reason(t, **kw)
        if code is None:
            out["read"] += 1
            continue
        layer, defect, _why = UNREADABLE_REASONS[code]
        out["by_code"][code] = out["by_code"].get(code, 0) + 1
        out["by_layer"][layer] = out["by_layer"].get(layer, 0) + 1
        if defect:
            out["defective"] += 1
        else:
            out["refused"] += 1
    return out


def pair_census(phon, pairs, **kw):
    """-> mandated / judged / refused over PAIRS, with the refusals split by
    cause (doctrines 79 and 88).

    The word-level census above cannot see `undecided_glide`, because it takes
    two words to disagree. Reporting one without the other would understate
    the refusal and mis-attribute it, which is doctrine 79's error moved one
    layer out: a refusal in the numerator charges the comparator for something
    the notation did.
    """
    out = {"mandated": 0, "judged": 0, "refused": 0, "true": 0, "false": 0,
           "by_code": {}}
    for a, b in pairs:
        out["mandated"] += 1
        v = phon.rhymes(a, b, **kw)
        if v is None:
            out["refused"] += 1
            ca = phon.refusal_reason(a, **kw)
            cb = phon.refusal_reason(b, **kw)
            code = ca or cb or "undecided_glide"
            out["by_code"][code] = out["by_code"].get(code, 0) + 1
            continue
        out["judged"] += 1
        out["true" if v else "false"] += 1
    return out


register(Welsh())
