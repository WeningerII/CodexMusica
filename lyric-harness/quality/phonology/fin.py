#!/usr/bin/env python3
"""Finnish — Kalevala alliteration AND literary end-rhyme (loppusointu).

TWO RELATIONS, AND THE SECOND ONE IS WHY MISSING M-6 WAS OPEN

This module shipped with `alliterates` and nothing else, and MISSING F-1 listed
`fin` as a present phonology. It was present *for the Kalevala metre only*, and
NINE OF THE TEN staged Finnish files are rhymed strophic verse whose actual
constraint it could not check. `rhymes()` closes that. The two relations are
declared separately in `relations` because a caller asking "does this Kanteletar
line alliterate" and a caller asking "does this Kramsu stanza rhyme" are asking
about different centuries and different forms.

WHAT FINNISH RHYME IS, DERIVED FROM FINNISH AND NOT PORTED FROM ENGLISH

The English predicate is "from the last stressed vowel to the end of the word".
Ported to Finnish it is not merely wrong, it is measurably wrong, and the
reason is the single most important fact about Finnish prosody:

  **Stress is FIXED on the first syllable and NEVER falls word-finally.**

So "from the last stressed vowel" means, for a two- or three-syllable Finnish
word, FROM THE START OF THE WORD. `maa : vapaa` would be False, because
`vapaa`'s only stress is on `va`. Finnish poets rhyme `maa : vapaa` constantly.
The ported predicate is kept reachable as `rule="prominent"` precisely so the
falsification is a function call rather than an assertion (doctrine 84), and
the table under RULE SELECTION below is its obituary.

What Finnish literary rhyme actually is — the 19th-century *loppusointu*,
taken from Swedish and German models — is counted in SYLLABLES FROM THE END,
one (`yksitavuinen`) or two (`kaksitavuinen`), and the domain runs from the
NUCLEUS of the first syllable it covers. What Finnish phonology contributes is
not the anchor but the CONTENTS:

  QUANTITY IS PHONEMIC AND IS WRITTEN. `tuli` / `tuuli` / `tulli` are three
    words. Long vowels are written double and geminates are written double, so
    unlike Persian short vowels this module never has to guess — but it does
    have to READ them, and it did not: see THE CODA BUG below.
  VOWEL HARMONY DOES NOT LICENSE A VARIANT, IT FORBIDS ONE. `-ssa`/`-ssä`,
    `-kaan`/`-kään` are one morpheme in two harmonic shapes, so it is tempting
    to call them equivalent in the rime. /ɑ/ and /æ/ are separate phonemes and
    the corpus agrees: `harmony="paired"` raises the observed 2&4 rate by 0.27
    points and its null MAX by 0.81, so lift falls 2.77x -> 2.65x. Doctrine 61,
    exactly: the rule that fires more often is the worse rule. `strict` ships.
  CONSONANT GRADATION (katto/katon, lukea/luen) alternates the consonant in
    the syllable the rime reaches. That is a reason NEVER to lemmatise before
    comparing — rhyme is a fact about the surface form, and the gradated and
    ungradated shapes of one stem genuinely do not rhyme.
  AGGLUTINATION makes the last syllable an inflectional ending far more often
    than in English, so a one-syllable rhyme is very often no more than two
    words in the same case. That is not refused; it is TYPED as
    `SUFFIX_RHYME` (doctrine 24 — relabel, never delete), and it is the main
    reason the shipped depth is 2 rather than 1.

TWO GRADES, NOT TWO RIVAL RULES, AND THE DIFFERENCE DECIDED THE DEFAULT

Nine rhymed volumes, 1,132 four-line stanzas, the 2&4 slot (this corpus is
overwhelmingly ABCB, not ABAB — see below). Null: permute each stanza's own
four end words among its own four line slots, 200 replicates, seed 20260811.
It PRESERVES each stanza's exact end-word inventory — its rime classes, word
lengths and suffix mix — and DESTROYS only WHICH TWO the form pairs. Every
replicate differs from the observation (doctrine 68).

    reading                observed  null med  null max   excess   lift
    depth 1  (DEFAULT)       62.28%    23.64%    26.92%   +35.35   2.31x
    depth 2  (rich grade)    43.62%    13.23%    15.75%   +27.87   2.77x
    depth 3                  37.87%    11.16%    13.94%   +23.94   2.72x
    prominent (the PORT)     31.61%     8.77%    10.90%   +20.71   2.90x
    depth 2, harmony paired  43.89%    13.76%    16.56%   +27.33   2.65x

Doctrine 61 says pick by lift and never by yield, and read naively that table
ships `prominent`. It is the wrong reading of the table, and the corpus says
so twice. Depth 1 and depth 2 are not RIVAL RULES; they are the tradition's
own two GRADES — *yksitavuinen* and *kaksitavuinen loppusointu* — exactly as
weak and strong alliteration are two grades above, and this module's answer to
that situation was already written into its first docstring: both are
reported rather than collapsed. Lift adjudicates between rival readings of one
rule. It does not adjudicate between a rule and a stricter version of itself,
because the stricter version buys its lower chance rate by REFUSING REAL
INSTANCES, and doctrine 37 says test against the tradition:

    Kramsu, *Haihtumaton muisto*, refrain, an unambiguous ABCB quatrain:
        Muut muistot haihtuu, katoaa, / Yks säilyy yksinään:
        Onk' iloinen vai suruinen,   / En tiedä itsekään.
    `yksinään : itsekään` is the rhyme. depth 1 = True. depth 2 = FALSE, and
    `prominent` = False, because the penultimate syllables are `si` and `se`.

So the default is depth 1 — what the form MANDATES — and depth 2 is the rich
grade a caller asks for by name. Both are reported with their own nulls,
because depth 1's chance rate of 27% is enormous: more than a quarter of a
stanza's own re-pairings rhyme at depth 1 before any poet is involved. That is
doctrine 64 in a second language — "62% of these stanzas rhyme lines 2 and 4"
was never wrong and is not usable without the +35.35 beside it.

`prominent` is the ENGLISH PREDICATE PORTED and it is falsified twice over: it
calls `maa : vapaa` False and `yksinään : itsekään` False. It is kept reachable
(doctrine 84) so that is a function call rather than a claim.

Read as a false-positive rate on 20,000 random end-word pairs from the same
corpus (doctrine 22, which asks for a rate and not a point on a scale): depth 1
admits 5.09%, depth 2 admits 0.81%, `prominent` 0.18%. That is the price list
for the grades, and it is why a caller certifying a single pair should ask for
depth 2 while a caller separating rhymed verse from unrhymed should use depth 1
— the same split the alliteration variants table reaches for Kalevala metre.

THE SCHEME IS ABCB, NOT ABAB, AND ONLY THE NULL SAYS SO

Pooled over the nine volumes, with the same null: the 2&4 slot is 43.62%
against a null max of 15.75%; the 1&3 slot and the 1&2 / 3&4 slots are AT OR
BELOW their own nulls (12+34: 10.58% observed, 15.20% null max, p=1.0000).
So this corpus rhymes the second and fourth lines of a quatrain and leaves the
first and third free — the ballad quatrain, not the pantun's ABAB.

AND THE KANTELETAR IS A NEGATIVE CONTROL THAT CLEARS ITS OWN NULL (doctrine 71)

The Kalevala-metre Kanteletar is unrhymed by construction, and it is in the
same corpus, in the same language, with the same instrument:

    slot           observed   null max   excess   verdict
    2&4              7.43%     14.24%    -6.81    BELOW chance, p=0.985
    1&2 and 3&4     18.55%     13.45%    +5.10    ABOVE chance, p=0.005

The second row is the trap. `18.55% of adjacent Kanteletar lines rhyme` is
true and is not rhyme: Kalevala-metre parallelism repeats a syntactic frame
across adjacent lines, so the two lines end in the SAME INFLECTIONAL ENDING.
Without the null it reads as a discovery. With it, the rhymed volumes and the
epic separate on the 2&4 slot by 43.62% vs 7.43% while agreeing that adjacent
lines share an ending. Doctrine 64: report the excess, never the rate.

THE CODA BUG, FOUND BY BUILDING THE SECOND RELATION

`syllabify` assembled a word-final consonant RUN by giving all but the last
consonant to the coda in step 3 and then OVERWRITING that coda with the last
consonant in step 4. `kyll'` (< kyllä) recorded coda `('l',)` instead of
`('l','l')`; `onk'` recorded `('k',)` instead of `('n','k')`. `Syllable.text`
was right, so nothing printed looked wrong, and alliteration never reads a
coda, so no recorded alliteration rate moved — the defect was invisible until
something asked for the RIME. It matters here more than it would in English
because Finnish consonant length is phonemic: the truncation gave `all'` and a
hypothetical `al` the same key. 251 line-final tokens in the staged corpus
carry a final cluster (`kaks`, `laps`, `all`, `maall`, `kans`, `vaikeammiks`),
every one a poetic apocope and every one a rhyme word. Fixed by APPENDING.
Doctrine 95: when a defect is found in one layer, check the others — this is
that check run in the opposite direction, from the new relation back into the
shared syllabifier.

WHERE `rhymes` RETURNS None, AND WHAT THAT COSTS

Two triggers, both derived from what the RELATION needs (doctrine 60):

  1. the word is unreadable — the ingestion layer, not this one.
  2. the rhyme domain contains `ie`, `uo` or `yö` in a NON-INITIAL syllable.
     These three opening diphthongs occur only in the FIRST syllable of a
     native Finnish word, so a later occurrence is either a genuine diphthong
     starting a later element of a compound (`koti+lies`, `viha+mies`,
     `-niekka`) or a HIATUS across a morpheme seam (`neitosien` is
     nei.to.si.en, four syllables, and `-sien` is not a rime). This module's
     diphthong list is a first-syllable rule and applying it further out is
     the same error doctrine 65 records for punctuation, one layer down — a
     rule that is right in one position ported to another. Without a lexicon
     the two cases are indistinguishable, so the nucleus of that syllable is
     undetermined and the verdict is None rather than a guess.

MEASURED WITH A MATCHED CONTROL, BECAUSE A REFUSAL RATE ALONE MEANS NOTHING
(doctrine 67). At depth 2, over the nine rhymed volumes:

    population                                       pairs   refused   True|decided
    MANDATED (the 2&4 pairs)                          1132     2.39%      43.62%
    RANDOM end-word pairs from the same corpus       20000     2.04%       0.81%
    CANDIDATE (already agree on the final nucleus)   20000     1.20%       6.55%

**The Finnish refusal is BLUNT, not aimed, and that is the honest answer.**
`fas.py` refuses 60.2% of real Ḥāfiẓ rhyme pairs and ~5% of random ones, so
its refusal is aimed at exactly the hard cases. This one is a flat ~2% tax
that falls almost equally on all three populations, because the trigger is a
property of a WORD rather than of a PAIR. Doctrine 67 says only a matched
control tells you which of the two you have; this cell ran the control and got
the other answer, and the number is small enough that the instrument is still
worth having. Reporting it as "aimed" by analogy with Persian would have been
the assertion doctrine 67 was written about.

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

#: The three OPENING diphthongs. They occur only in the FIRST syllable of a
#: native Finnish word, so the DIPHTHONGS list above is a first-syllable rule
#: and a later occurrence is ambiguous between a compound element's own
#: diphthong and a morpheme-seam hiatus. `rhymes` refuses where one lands in
#: the rime; see the module docstring.
OPENING_DIPHTHONGS = {"ie", "uo", "yö"}

# ------------------------------------------------------- declared parameters
# Doctrine 58: every number this module thresholds on is named here with what
# it means and where it came from. None was fitted; RIME_DEPTH was CHOSEN by
# lift over a matched null and the whole sweep is in the module docstring.

#: How many trailing syllables the rime covers, counted from the word end and
#: measured from the first covered syllable's NUCLEUS. 1 = the tradition's
#: `yksitavuinen loppusointu`, which is what the form MANDATES and what the
#: default reports; 2 = `kaksitavuinen`, the rich grade, asked for by name.
#: These are GRADES, like weak/strong alliteration, not rival rules — see the
#: module docstring for why lift does not choose between them. Clamped per
#: pair to the shorter word, so `maa : vapaa` is judged at depth 1.
RIME_DEPTH = 1

#: "strict"  a and ä (o/ö, u/y) are different phonemes and do not rhyme.
#: "paired"  the harmonic counterparts count as one. Measured and REJECTED:
#:           +0.27pp observed against +0.81pp of null max, lift 2.77x -> 2.65x.
HARMONY = "strict"

#: "depth"      the shipped reading: RIME_DEPTH syllables from the end.
#: "prominent"  the English predicate ported — from the last PROMINENT nucleus
#:              to the end. Kept reachable so its falsification is checkable
#:              (doctrine 84); it calls `maa : vapaa` False.
RHYME_RULE = "depth"

#: <w> and <v> are ALLOGRAPHS OF ONE PHONEME in 19th-century Finnish printing,
#: and the Kanteletar MIXES them inside one book (Väinämöisen / Wäinämöinen).
#: MISSING M-5. Folding w->v is notational — it changes no phoneme — so it is
#: applied in `rhymes`, where an unfolded reading would simply be wrong.
#: It is NOT applied by default in `alliterates` / `line_alliteration`, because
#: the recorded rates (Kanteletar weak 81.8342%, strong 60.2134%) are
#: coordinates of the UNFOLDED reading and M-5 records the folded ones
#: (82.1529% / 60.4297%). Both are reachable via `fold_w=`; doctrine 58 says
#: write the setting next to the number rather than silently move the number.
FOLD_W_TO_V = True

#: Finnish inflectional and derivational endings, for TYPING a rhyme rather
#: than for judging one. Doctrine 46: a function-word list is part of a
#: phonology. Agglutination means two words in the same case agree on their
#: last syllable by grammar, which is the Finnish form of the radif question —
#: it is a REPEAT-like relation wearing a rhyme's clothes, and doctrine 24 says
#: relabel it rather than delete it. Not exhaustive, and not tuned: these are
#: the productive case, possessive, person and participle endings.
SUFFIXES = (
    "ssa", "ssä", "sta", "stä", "lla", "llä", "lta", "ltä", "lle",
    "ksi", "tta", "ttä", "han", "hän", "hin", "seen", "na", "nä",
    "ni", "si", "nsa", "nsä", "mme", "nne", "kin", "kaan", "kään",
    "vat", "vät", "nut", "nyt", "neet", "maan", "mään", "massa", "mässä",
    "nen", "inen", "sti", "uus", "yys", "minen", "ja", "jä", "ta", "tä",
    "an", "än", "en", "in", "on", "un", "yn", "ön",
)


def _tokens(text):
    """Words. A run of bare punctuation is NOT one.

    The character class admits `'` and `-` because they occur inside words, and
    it therefore also matched a lone `'` (60 times in the Kalevala) and a lone
    `-` (46 times) as if they were words. They were never classified, so no
    alliteration RATE was wrong -- but they were counted in the word total that
    `line_alliteration` returns, so `- veessä on väkeä paljo -` reported six
    words where there are four. Any caller dividing by that denominator was
    dividing by an inflated one.
    """
    return [t for t in re.findall(r"[A-Za-zÀ-ÿŠšŽžÄäÖöÅå'\-]+", text)
            if t.strip("'-’")]


class Finnish(Phonology):
    language = "fin"
    name = "Finnish"
    notation = "standard Finnish orthography, treated as phonemic"
    grid_unit = "syllable"
    prominence_rule = ("primary stress on syllable 1; secondary on odd "
                       "syllables from 3; never word-final")
    relation = ("TWO, declared separately: (1) Kalevala alliteration — two or "
                "more words in a line share an initial consonant, optionally "
                "+ the following vowel, with vowel-initial words as one class; "
                "(2) literary end-rhyme (loppusointu) — the last RIME_DEPTH=2 "
                "syllables agree from the first covered NUCLEUS, quantity and "
                "vowel-harmony class included, NOT anchored on stress because "
                "Finnish stress is initial and never word-final")
    source = "rules only; no external resource, so nothing to licence"

    def syllabify(self, word):
        w = word.strip("'-").lower()
        if not w:
            return []
        # The HYPHEN is a compound seam, and it carries information the
        # apostrophe does not: it BLOCKS RESYLLABIFICATION across the join.
        # `iän-ikuinen` is iän + ikuinen, not i.ä.ni.kui.nen -- the `n` belongs
        # to the first element and does not become the onset of the second.
        # Removing the hyphen (which is what cym.py correctly does for Welsh,
        # where it joins) would get the syllable boundary wrong here, so each
        # element is syllabified independently and the results concatenated.
        # Before this the hyphen was simply out of inventory, so the whole word
        # returned [] and dropped out of every alliteration class: 223 tokens
        # and 88 types in the Kalevala, `iän-ikuinen` alone 50 times.
        if "-" in w:
            out = []
            for part in w.split("-"):
                if part:
                    out.extend(self.syllabify(part))
            return out
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
            # APPEND, do not replace. A word-final consonant RUN had already
            # given its first members to this syllable's coda in step 3; the
            # old code overwrote that coda with the last consonant alone, so
            # `kyll'` recorded coda ('l',) instead of ('l','l') and `onk'`
            # recorded ('k',) instead of ('n','k'). The text was right and the
            # KEY was wrong, which is the worst shape for a defect: nothing
            # printed looked broken. It matters here more than it would in
            # English because Finnish CONSONANT LENGTH IS PHONEMIC (tuli /
            # tulli), so the truncation deleted exactly the contrast the rime
            # is built on -- `all'` (< alla) and a hypothetical `al` had the
            # same key. 251 line-final tokens in the staged corpus carry a
            # final cluster (kaks, laps, all, maall, kans, vaikeammiks): every
            # one is a poetic apocope, they are pronounced as written, and
            # they are rhyme words. Alliteration never read a coda, which is
            # why no recorded alliteration rate moves.
            sylls[-1] = Syllable(sylls[-1].text + "".join(onset),
                                 sylls[-1].onset, sylls[-1].nucleus,
                                 sylls[-1].coda + tuple(onset),
                                 sylls[-1].prominence, sylls[-1].moras)

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

    def _head(self, word, fold_w=False):
        s = self.syllabify(_fold(word) if fold_w else word)
        if not s:
            return None
        return (s[0].onset[0] if s[0].onset else "", s[0].nucleus)

    def alliterates(self, a, b, strong=False, fold_w=False):
        ha, hb = self._head(a, fold_w), self._head(b, fold_w)
        if ha is None or hb is None:
            return None                        # unreadable: never a guess
        if ha[0] == "" and hb[0] == "":
            # vowel-initial words alliterate as one class, and in the STRONG
            # grade the vowels must match as well
            return ha[1][0] == hb[1][0] if strong else True
        if ha[0] != hb[0]:
            return False
        return ha[1][0] == hb[1][0] if strong else True

    def line_alliteration(self, line, strong=False, fold_w=False):
        """-> (n_alliterating_words, n_words, the winning class).

        Kalevala metre wants at least two words sharing an initial. Reported
        as a count so a caller can apply the tradition's own threshold rather
        than one imposed here.

        `fold_w` defaults FALSE and must stay that way: every rate this
        project has recorded (Kalevala weak 82.60%, Kanteletar weak 81.8342%,
        strong 60.2134%) is a coordinate of the unfolded reading. MISSING M-5
        measured the folded ones (81.8363% -> 82.1529% weak, 60.2126% ->
        60.4297% strong) and the shape of that finding matters more than its
        size: a printing that used <w> THROUGHOUT would cost nothing, and it
        is the MIXING that costs. Doctrine 58 — both settings reachable, the
        setting written next to the number.
        """
        ws = _tokens(line)
        heads = []
        for w in ws:
            h = self._head(w, fold_w)
            heads.append(None if h is None
                         else (h[0], h[1][0] if strong else ""))
        seen = [h for h in heads if h is not None]
        if not seen:
            return 0, len(ws), None
        # `max(set(seen), key=seen.count)` iterated a SET, so which of two
        # equally-common classes won depended on PYTHONHASHSEED --
        # `kala kukka mies meri` returned ('k','') under one seed and ('m','')
        # under another. The COUNT was stable, so no rate this project has
        # reported is affected, but a tally of WHICH SOUND carries the
        # alliteration would not reproduce across runs. The tie-break below is
        # arbitrary; what matters is that it is fixed and stated.
        best = max(sorted(set(seen)), key=seen.count)
        return seen.count(best), len(ws), best

    # ------------------------------------------------- the SECOND relation:
    # literary end-rhyme (loppusointu). MISSING M-6.

    def _rime_start(self, sylls, rule, depth):
        """-> the index of the first syllable the rime covers, or None.

        `depth` is clamped by the CALLER to the shorter of the two words, so
        `maa : vapaa` is judged at depth 1. `prominent` is per-MEMBER
        (doctrine 83): each word declares its own anchor from its own stress
        grid, which is exactly why it fails on unequal-length words.
        """
        if rule == "prominent":
            return max(k for k, s in enumerate(sylls) if s.prominence == 1)
        if rule != "depth":
            raise ValueError(f"unknown rhyme rule {rule!r}; "
                             f"declared: 'depth', 'prominent'")
        return len(sylls) - depth

    def rime(self, word, depth=RIME_DEPTH, rule=RHYME_RULE,
             fold_w=FOLD_W_TO_V):
        """-> the rime tuple, or None if the word cannot supply one.

        The tuple runs from the first covered syllable's NUCLEUS to the end of
        the word: (nucleus, coda, onset, nucleus, coda, ...). The first
        syllable's ONSET is deliberately absent — that is what makes this a
        rhyme rather than an identity, and comparing it is what
        `relation_type` calls RIME_RICHE.
        """
        s = self.syllabify(_fold(word) if fold_w else word)
        if not s:
            return None
        d = max(1, min(depth, len(s)))
        i = self._rime_start(s, rule, d)
        if any(k > 0 and s[k].nucleus in OPENING_DIPHTHONGS
               for k in range(i, len(s))):
            return None            # undetermined nucleus; see the docstring
        out = [s[i].nucleus, "".join(s[i].coda)]
        for x in s[i + 1:]:
            out += ["".join(x.onset), x.nucleus, "".join(x.coda)]
        return tuple(out)

    def refusal_reason(self, word, depth=RIME_DEPTH, rule=RHYME_RULE,
                       fold_w=FOLD_W_TO_V):
        """-> None if `rime` succeeds, else a code naming WHY.

        Doctrine 88 / 79 one layer down: a refusal rate is uninterpretable
        until an ingestion miss and a designed refusal are told apart, and
        that has to be a function call rather than a paragraph.

          `vowelless_token`  no vowel anywhere, so no nucleus and no word.
                        INGESTION, and OWNED ELSEWHERE: in this corpus these
                        are the `j. n. e.` (*ja niin edelleen*) refrain stub
                        and roman numerals left as bare letters — MISSING M-4,
                        which notes that the `e` IS readable and joins the
                        vowel-initial alliteration class as a spurious word.
          `out_of_inventory`  a character outside the declared Finnish
                        alphabet — `Klára`, `Felicián`, `Långström`, `Chénier`,
                        foreign proper names in translation volumes. A CORRECT
                        refusal: notation is declared, never sniffed, and
                        guessing a Finnish reading of a Hungarian name would
                        be the monoculture error in miniature.
          `non_initial_opening_diphthong`  DESIGNED refusal: ie/uo/yö outside
                        the first syllable is a compound element's diphthong
                        or a morpheme-seam hiatus and nothing here can tell.
        """
        s = self.syllabify(_fold(word) if fold_w else word)
        if not s:
            w = (_fold(word) if fold_w else word).strip("'-").lower()
            w = re.sub(r"['’-]+", "", w)
            if any(c not in VOWELS and c not in CONSONANTS for c in w):
                return "out_of_inventory"
            return "vowelless_token"
        d = max(1, min(depth, len(s)))
        i = self._rime_start(s, rule, d)
        if any(k > 0 and s[k].nucleus in OPENING_DIPHTHONGS
               for k in range(i, len(s))):
            return "non_initial_opening_diphthong"
        return None

    def rhymes(self, a, b, depth=RIME_DEPTH, rule=RHYME_RULE,
               harmony=HARMONY, fold_w=FOLD_W_TO_V):
        """-> True / False / None. None means 'cannot tell', never a guess.

        The depth is clamped to the SHORTER word, so a one-syllable rhyme word
        drags the comparison down to one syllable rather than failing on
        length — `maa : vapaa` is True, which is what Finnish poets do.
        """
        if harmony not in ("strict", "paired"):
            # validated FIRST, not after the easy answer: an identical pair
            # would otherwise return True and never reach the check, so a
            # caller's typo would be silently honoured on exactly the pairs
            # where it made no difference and silently ignored elsewhere.
            raise ValueError(f"unknown harmony setting {harmony!r}; "
                             f"declared: 'strict', 'paired'")
        sa, sb = self.syllabify(_fold(a) if fold_w else a), \
            self.syllabify(_fold(b) if fold_w else b)
        if not sa or not sb:
            return None
        d = max(1, min(depth, len(sa), len(sb)))
        ra = self.rime(a, d, rule, fold_w)
        rb = self.rime(b, d, rule, fold_w)
        if ra is None or rb is None:
            return None
        if ra == rb:
            return True
        if harmony == "paired":
            return _harmonic_equal(ra, rb)
        return False

    def relation_type(self, a, b, depth=RIME_DEPTH, rule=RHYME_RULE,
                      harmony=HARMONY, fold_w=FOLD_W_TO_V):
        """-> REPEAT / RIME_RICHE / SUFFIX_RHYME / RHYME / NONE / None.

        Doctrine 3 says identity is not rhyme, and Finnish adds a fourth type
        the English taxonomy has no name for. Agglutination means two words in
        the same case share their ending BY GRAMMAR, so a rhyme carried
        entirely by an inflectional ending is the Finnish form of the radif
        question: real repetition, doing a different job. It is TYPED rather
        than rejected (doctrine 24) — the harness can say more afterwards, not
        less, and a caller measuring craft and a caller measuring form need
        different answers.
        """
        r = self.rhymes(a, b, depth, rule, harmony, fold_w)
        if r is None:
            return None
        if not r:
            return "NONE"
        sa = self.syllabify(_fold(a) if fold_w else a)
        sb = self.syllabify(_fold(b) if fold_w else b)
        if [s.text for s in sa] == [s.text for s in sb]:
            return "REPEAT"
        d = max(1, min(depth, len(sa), len(sb)))
        i, j = self._rime_start(sa, rule, d), self._rime_start(sb, rule, d)
        # SUFFIX_RHYME is checked BEFORE rime riche, because it is the more
        # specific claim: it says WHY the sounds agree. The test is exact
        # membership of the two words' longest common written tail, never
        # "ends with an ending" — `kulta : tulta` shares `ulta`, which ends
        # with the partitive `ta`, and a loose test would mistype a real
        # rhyme as grammar.
        ta = "".join(s.text for s in sa)
        tb = "".join(s.text for s in sb)
        k = 0
        while k < min(len(ta), len(tb)) and ta[-1 - k] == tb[-1 - k]:
            k += 1
        if ta[len(ta) - k:] in SUFFIXES:
            return "SUFFIX_RHYME"
        # RIME_RICHE: the covered stretch agrees INCLUDING the onset the rime
        # never looks at — the supporting consonant is identical too, so the
        # two words sound the same from there on and differ only earlier.
        if [s.text for s in sa[i:]] == [s.text for s in sb[j:]]:
            return "RIME_RICHE"
        return "RHYME"


#: code -> (layer that OWNS it, is it a defect at all, one-line reason).
#: The same table `msa.py` carries, for the same reason: doctrine 88 says a
#: refusal rate is uninterpretable until an ingestion miss and a designed
#: refusal are told apart, and doctrine 79 says report the counts separately.
#: Measured on the staged Finnish song corpus (138,974 tokens): 155 unreadable
#: (0.112%) — 118 `vowelless_token` (the `j. n. e.` stub and roman numerals,
#: someone else's layer) and 37 `out_of_inventory` (foreign proper names,
#: correctly refused). The Kalevala itself has ZERO.
UNREADABLE_REASONS = {
    "vowelless_token": (
        "ingestion", True,
        "no vowel, so no nucleus and no word: the `j. n. e.` refrain stub and "
        "roman numerals. Owned by the tokenizer, not by this module."),
    "out_of_inventory": (
        "notation", False,
        "a character outside the declared Finnish alphabet — a foreign proper "
        "name. Notation is declared, never sniffed: a correct refusal."),
    "non_initial_opening_diphthong": (
        "phonology", False,
        "ie/uo/yö outside the first syllable is a compound element's own "
        "diphthong or a morpheme-seam hiatus, and without a lexicon the two "
        "are indistinguishable. Designed refusal, and the nucleus it would "
        "have to guess is IN THE RIME."),
}


def readability_census(phon, tokens, depth=RIME_DEPTH):
    """-> the THREE counts doctrine 79 demands, never two.

    `read` + `refused` + `defective` == `total`. Same shape as
    `msa.readability_census`, so the two languages' rows are comparable.
    """
    out = {"total": 0, "read": 0, "refused": 0, "defective": 0, "by_code": {},
           "by_layer": {}}
    for t in tokens:
        out["total"] += 1
        code = phon.refusal_reason(t, depth=depth)
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


def _fold(word):
    """<w> -> <v>. One phoneme, two glyphs, MIXED inside one book (M-5)."""
    return word.replace("w", "v").replace("W", "V")


_HARMONIC = {"a": "ä", "ä": "a", "o": "ö", "ö": "o", "u": "y", "y": "u"}


def _harmonic_equal(ra, rb):
    """Are two rimes equal once harmonic counterparts are merged?

    REJECTED as the default and kept reachable, because the measurement is the
    argument: it buys +0.27pp of observation for +0.81pp of null max and drops
    lift from 2.77x to 2.65x. Doctrine 61.
    """
    if len(ra) != len(rb):
        return False
    for x, y in zip(ra, rb):
        if x == y:
            continue
        if len(x) != len(y):
            return False
        if any(not (p == q or _HARMONIC.get(p) == q) for p, q in zip(x, y)):
            return False
    return True


register(Finnish())
