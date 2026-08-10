#!/usr/bin/env python3
"""Old Norse — dróttkvætt. Not cheap for any of the reasons the other four were:
the orthography is fine, and what is broken is the only text that exists.

WHAT THE FORM MANDATES

Dróttkvætt fixes sound-repetition at metrical positions twice over, and Snorri
Sturluson wrote the specification down in the prose of *Háttatal* (c. 1222-25),
which makes this the one cell in the corpus with a 13th-century ground truth
rather than a modern reconstruction. His words, and what this module does with
them:

  "Hverju vísuorði fylgja sex samstöfur."
      Six syllables to a line. `scan()` counts them and does NOT force six --
      see THE ENCLISIS RESIDUE below.

  "jörð, fyrð ... sinn hljóðstafr fylgir hvárri, ok svá upphafsstafir, en
   einir stafir eru eftir hljóðstaf í báðum orðum ... köllum vér skothending."
      SKOTHENDING: each has its own vowel, and its own INITIAL letter, but the
      same letters follow the vowel in both.

  "rofs, ofs. Þat er ein hljóðstafr ok svá allir þeir, er eftir fara í báðum
   orðum, en upphafstafir greina orðin. Þetta heita aðalhendingar."
      AÐALHENDING: one vowel and likewise everything following it, but the
      initial letters DISTINGUISH the words.

  "in síðari hending í hverju vísuorði, er heitir viðrhending, hon skal standa
   í þeiri samstöfu, er ein er síðar, en sú hending, er frumhending heitir,
   stendr stundum í upphafi orðs, köllum vér þá oddhending, stundum í miðju
   orði, köllum vér þá hluthending."
      The later element (viðrhending) stands on the PENULTIMATE syllable; the
      earlier one (frumhending) is an oddhending at the head of a word and a
      hluthending inside one. `line_hending()` searches oddhendingar first and
      reports which kind it found, because a hluthending needs a compound this
      module cannot see (see DECLARED APPROXIMATIONS).

Two consequences that a checker built from a modern summary would miss, and
both are load-bearing:

1. **A hending requires the ONSETS TO DIFFER.** "upphafstafir greina orðin".
   Identity is not rhyme, in Snorri's own words seven hundred years before this
   project wrote the same sentence in its doctrine. `hann : hann` is not an
   aðalhending; `hann : bannat` is.
2. **The hending consonants are not the syllable coda.** Snorri cites the
   second element of `jörð : fyrðum` as "fyrð" -- the whole post-vocalic
   cluster, across the syllable boundary -- and of `friðrofs : ofsa` as "ofs".
   A checker keyed on the coda of a maximal-onset syllabification reads those
   as "fyr" and "of" and finds neither. See `_hending_consonants`, where the
   rule is chosen by measurement against three alternatives rather than
   asserted.

ALLITERATION, in the Germanic way

  "Í öðru vísuorði eru settr sá stafr fyrst í vísuorðinu, er vér köllum
   höfuðstaf ... En í fyrsta vísuorði mun sá stafr finnast tysvar standa fyrir
   samstöfur. Þá stafi köllum vér stuðla."

Two stuðlar in the odd line, the höfuðstafr first in the even line. Any vowel
alliterates with any vowel -- "ef hljóðstafr er höfuðstafrinn, þá skulu stuðlar
vera ok hljóðstafir" -- and Snorri adds that it is *fegra* if each is a
DIFFERENT vowel, which `couplet_alliteration()` reports rather than enforces.

**sk-, sp-, st- alliterate only with themselves, never with plain s-.** That
rule is NOT in this passage of Háttatal; it is the standard description of
Germanic alliteration and it is declared here as such rather than smuggled in
as if Snorri had said it. It is also not decoration: without it the module
reports alliteration on every s-word in a line and no skald ever heard that.
It is validated in `quality/test_phon_non.py` against Háttatal couplets whose
höfuðstafr is `st-`.

THE ORTHOGRAPHY, WHICH IS THE ACTUAL BLOCKER (doctrine 50, 53)

The only complete Háttatal on the reachable network is Guðni Jónsson's
normalisation, and an exhaustive byte inventory of it returns:

    ð 1224 · á 592 · í 564 · ö 478 · þ 426 · ó 357 · æ 340 · é 200 · ú 115 · ý 110
    ǫ 0 · ø 0 · œ 0

So that text writes **ö for BOTH etymological ǫ and ø**, and **æ for œ**. It
prints `jörð` where a classical normalisation prints `jǫrð`.

This module ACCEPTS that spelling -- refusing it would refuse the only corpus
that exists -- and it does not pretend to have recovered anything. `ö` is read
as a MERGED vowel standing for either `ǫ` or `ø`, and where a text is in that
orthography `æ` likewise stands for either `æ` or `œ`. The consequence is
asymmetric across the two predicates, which is the whole reason the tri-state
is here:

  skothending  a CONSONANT relation over two vowels that must merely DIFFER.
               A merged spelling is harmless wherever the two vowels are
               written differently, which is nearly always. `jörð : fyrðum` is
               definite. Only two identically-merged graphemes (`ö : ö`) leave
               it unable to say whether the vowels differ at all, and there it
               returns None.
  aðalhending  needs vowel AND consonant IDENTITY, so the merger MANUFACTURES
               matches no skald heard: two words that were `ǫ` and `ø` now
               compare equal. Wherever a True verdict would rest on a merged
               grapheme this returns **None**, never True.

An unmerged text is unaffected: `ǫ`, `ø`, `œ` are read exactly when they
appear, and give True/False. "This edition cannot tell me" and "these vowels
differ" are different answers and the module says which it means.

WHAT IS REFUSED, AND WHAT CANNOT BE

`d` for `ð`, `th`/`dh` for `þ`/`ð`, and accent-stripped text are NOT accepted
-- and mostly cannot be DETECTED. `jord` is four legal letters; this module
reads it as a different word and has no way to know. That is the doctrine-50
failure in its pure form and the only honest response is to say so in the
declaration and hand the caller `notation_report()`, which flags the tells it
can see (`th`/`dh` sequences, modernised `-ur` epenthesis, an absence of
accents) and states plainly that a clean report proves nothing.

PROMINENCE IS STRESS HERE, AND WEIGHT IS SOMETHING ELSE (doctrine 35)

Old Norse has fixed word-initial stress, so unlike Somali there is a real
stress and `prominence` carries it: 1 on the first syllable of a word, 0
elsewhere. That is the right field for it because stress is what the FORM
indexes -- stuðlar fall on stressed onsets, and both hending elements fall on
stressed syllables.

Dróttkvætt is ALSO quantity-sensitive, and syllable weight is a different
property that is not derivable from stress: `so-` in `sonar` is stressed and
LIGHT, `-nar` is unstressed and HEAVY. Putting both in one field would erase
exactly that contrast, so weight goes on `Syllable.moras` -- 2 for heavy (long
vowel, diphthong, or a closed syllable), 1 for light. Overlong syllables are
not distinguished from heavy ones; the metre's cadence works on the binary.

DECLARED APPROXIMATIONS, rather than hidden ones

- **Compounds are invisible.** The module has no morphology, so `friðrofs` is
  one word whose second element `rofs` is marked unstressed, and `Gandvíkr`
  syllabifies `Gan.dvíkr` because `dv-` is a legal onset. Neither hurts the
  hending, because `_hending_consonants` reads across the boundary -- but a
  hluthending is found in a second pass and LABELLED as one, and a hyphen in
  the input is honoured as an explicit compound boundary (`Gand-víkr`).
- **`x` is read as `k`+`s` and `z` as `t`+`s`.** Not cosmetic: Snorri's second
  demonstration stanza rhymes `braks : axla`, which is an aðalhending only if
  `x` is two consonants.
- **A trailing glide is not part of the hending.** `Lætr : heitir`, `Sjalfr :
  Elfar`, `gramr : fremri`, `hylr : skylja` are all Snorri's own and none of
  them matches with the desinential `-r` or the palatal `j` kept. Declared as
  a rule, measured against three alternatives, not discovered per word: see
  `_hending_consonants`.
- **The hending consonants are truncated to two.** A longer run in this
  orthography signals a morpheme boundary rather than a tautosyllabic cluster
  (`gunn|seið` gives `nns`). This can only make the checker looser, never
  stricter, and it is the one approximation here with no attestation behind it.
- **Homographs are not disambiguated.** `á` is both the preposition and 'owns';
  it is listed as málfylling, which is right in the usual case and wrong when
  it is the verb. Same shape as the Welsh PROCLITICS problem (doctrine 46).

THE ENCLISIS RESIDUE, which is reported rather than smoothed away

Snorri's line is six syllables and his own printed first line is seven:

    Lætr sá, er Hákun heitir,          lætr.sá.er.há.kun.hei.tir

`sá er` is one metrical syllable (`sás`), and `þar er` in stanza 2 is `þars`.
Resolving that needs morphology this module does not have, so `scan()` returns
SEVEN and says so. Forcing six by dropping a syllable somewhere would move
every position after it, and the position of the viðrhending is the whole
measurement -- a silently renumbered line is worse than a line that reports an
honest seven. The hending is unaffected: it is anchored to the penultimate
syllable, which enclisis does not move.

WHAT THIS RECOVERS, AND WHAT IT DOES NOT

On Snorri's two demonstration stanzas of plain dróttkvætt: **16 of 16
hendingar, and 8 of 8 couplets with exactly two stuðlar.** Across the 51
stanzas of the whole clavis whose every line scans to six syllables: 67.6% of
skothendingar and 63.7% of aðalhendingar, against a shuffled-line control of
11.4% and 2.4%. The shortfall is not separated here into metrical variation
(Háttatal is a clavis metrica -- most of its hundred stanzas are demonstrating
a DIFFERENT metre, and several vary the hending deliberately) and this
module's declared approximations. Do not read 67.6% as an error rate; read it
as an unseparated upper bound on both at once.
"""

import re
import unicodedata

from quality.phonology import Phonology, Syllable, register

ACUTE = "́"

#: Long and short are distinct PHONEMES in Old Norse, which is why they are
#: two sets and not one set with a diacritic stripped. The distinction is the
#: whole of the aðalhending/skothending contrast.
SHORT_VOWELS = {"a", "e", "i", "o", "u", "y", "ø", "ǫ"}
#: ǫ́ and ǿ have no precomposed codepoint, so a combining acute is accepted
#: after a vowel and only there; every other long vowel is a single character
#: after NFC.
LONG_VOWELS = {"á", "é", "í", "ó", "ú", "ý", "æ", "œ", "ǽ", "ǿ",
               "ǫ" + ACUTE, "ø" + ACUTE}
#: The three diphthongs. Each is ONE nucleus; splitting them adds a syllable to
#: a line whose whole constraint is that it has six.
DIPHTHONGS = {"au", "ei", "ey"}

CONSONANTS = {"b", "d", "ð", "f", "g", "h", "j", "k", "l", "m", "n", "p",
              "r", "s", "t", "v", "þ"}
#: ð never begins a word in Old Norse (word-initially it is always þ), so it is
#: not a legal onset -- which is what makes `fyrðum` syllabify `fyrð.um`.
ONSET_CONS = CONSONANTS - {"ð"}
_SONORANTS = {"l", "m", "n", "r", "j"}
_GLIDES = {"r", "l", "v", "j", "n"}

#: SNORRI'S OWN MÁLFYLLING LIST, from the Háttatal prose immediately after
#: stanza 1: "...at hljóðstafr standi fyrir oftar í fjórðungi í fornöfnum eða í
#: málfylling þeiri, er svá kveðr at: ek, - eða svá: en, er, at, í, á, of, af,
#: um, ok er þat leyfi, en eigi rétt setning."
#:
#: These words may carry a vowel initial WITHOUT counting as a stuðill; that is
#: a leyfi (licence), not correct setting. Without them a checker reads three
#: vowel-initial words in `Sjalfr ræðr allt ok Elfar` and reports Snorri's own
#: demonstration stanza as malformed -- the Welsh proclitic problem exactly
#: (doctrine 46), and here the tradition supplies its own list.
SNORRI_MALFYLLING = ("ek", "en", "er", "at", "í", "á", "of", "af", "um")
#: `ok` sits on a comma in the manuscript sentence and can be read either as
#: the last item of that list or as the conjunction opening the next clause.
#: It is included, because line 5 of the stanza the sentence is explaining
#: requires the licence it has just described. Declared, not assumed.
MALFYLLING = set(SNORRI_MALFYLLING) | {"ok"}
#: Added beyond the attested list: the commonest unstressed particles and
#: prepositions, which behave identically. Kept separate so the attested part
#: stays attested. Pronouns other than `ek` are NOT here -- they bear stress.
PARTICLES = MALFYLLING | {
    "es", "né", "ne", "ef", "til", "við", "frá", "með", "sem", "ór", "or",
    "und", "yfir", "fyrir", "eptir", "eftir", "inn", "in", "it", "hinn",
    "hin", "hit",
}

#: The 19th/20th-c. normalisation's substitutions, ACCEPTED AND MARKED, never
#: silently resolved. `ö` is not a grapheme of classical normalised Old Norse,
#: so its presence identifies the whole text as this orthography -- and in
#: every such edition `œ` has gone to `æ` as well.
MERGED_READINGS = {"ö": ("ǫ", "ø"), "æ": ("æ", "œ")}

#: Everything that is not whitespace, punctuation or a digit. `\s` covers
#: U+00A0, which this edition uses. A hyphen is KEPT -- it is the explicit
#: compound boundary this module honours.
_WORD_RE = re.compile("[^\\s,.;:!?()\\[\\]{}\u00ab\u00bb\"\u201c\u201d\u201e'\u2019\u00b7\u2014\u2013\u20260-9]+")


def _tokens(text):
    return [w for w in _WORD_RE.findall(text) if w.strip("-")]


def _norm(word):
    """NFC, lowercase, and the one substitution that is a pure typography
    change: `ǭ` -> long `ǫ`. `ö` is deliberately NOT rewritten to `ǫ` -- it is
    kept as itself so the merger stays visible to the predicates."""
    w = unicodedata.normalize("NFC", word).strip("-").lower()
    return w.replace("ǭ", "ǫ" + ACUTE)


def _is_vowel(u):
    return u in SHORT_VOWELS or u in LONG_VOWELS or u in DIPHTHONGS \
        or u in MERGED_READINGS


def _is_long(u):
    return u in LONG_VOWELS or u in DIPHTHONGS


def units(word):
    """-> flat list of phoneme units, or None if out of the declared
    inventory. `x` becomes k+s and `z` becomes t+s; a combining acute attaches
    to the vowel before it."""
    w = _norm(word)
    out, i = [], 0
    while i < len(w):
        c = w[i]
        if c == "-":
            out.append("-")
            i += 1
            continue
        if c == "x":
            out.extend(("k", "s"))
            i += 1
            continue
        if c == "z":
            out.extend(("t", "s"))
            i += 1
            continue
        if c in SHORT_VOWELS or c in LONG_VOWELS or c in CONSONANTS \
                or c in MERGED_READINGS:
            u = c
            i += 1
            if i < len(w) and w[i] == ACUTE:
                u += ACUTE
                i += 1
                if u not in LONG_VOWELS:
                    return None
            out.append(u)
            continue
        return None                      # unknown never produces an answer
    return out or None


def _merge_diphthongs(u):
    m, i = [], 0
    while i < len(u):
        if i + 1 < len(u) and u[i] in SHORT_VOWELS and u[i + 1] in SHORT_VOWELS \
                and u[i] + u[i + 1] in DIPHTHONGS:
            m.append(u[i] + u[i + 1])
            i += 2
        else:
            m.append(u[i])
            i += 1
    return m


def _legal_onset(u):
    """Is this consonant sequence a possible Old Norse syllable onset?

    Used only to decide where a MEDIAL cluster splits. A word-initial cluster
    is taken as written -- refusing one would refuse the text, not fix it.
    """
    if not u:
        return True
    if len(u) > 3 or any(c not in ONSET_CONS for c in u):
        return False
    if len(u) >= 2 and u[0] == u[1]:
        return False                     # a geminate always splits
    if len(u) == 1:
        return True
    if u[0] == "s" and _legal_onset(u[1:]):
        return True                      # sk- sp- st- sl- sm- sn- sv- sj- skr-
    if u[0] in _SONORANTS:
        return len(u) == 2 and u[1] == "j"        # lj- mj- nj- rj-, not rl- rn-
    if len(u) == 2:
        return u[1] in _GLIDES
    return u[1] in _GLIDES and u[1] != "j" and u[2] == "j"   # hlj- brj- flj-


def _hending_consonants(coda, next_onset):
    """The consonants a hending is measured on -- NOT the syllable coda.

    Snorri cites the second element of `jörð : fyrðum` as **fyrð** and of
    `friðrofs : ofsa` as **ofs**, so the hending run crosses the syllable
    boundary: it is EVERY consonant between this nucleus and the next, which
    is the coda plus the whole following onset. A checker keyed on the coda of
    a maximal-onset syllabification reads those two as `fyr` and `of` and
    finds neither.

    Then two declared normalisations, in this order:
      - a trailing GLIDE, `r` or `j`, is dropped while anything remains. That
        is the desinential and suffixal `-r` (`Lætr : heitir`, `Sjalfr :
        Elfar`, `gramr : fremri`) and the palatal `j` (`hylr : skylja`) --
        six of Snorri's own hendingar, none of which matches with them kept;
      - the result is truncated to two consonants, because a longer run in
        this orthography signals a morpheme boundary the module cannot see
        (`gunn|seið` -> `nns`). This is the one step here with no attestation
        behind it, and it can only loosen the checker.

    MEASURED, rather than asserted. Three readings were run over the 51
    Háttatal stanzas whose every line scans to six syllables, each against a
    negative control that keeps the viðrhending and draws the candidate
    syllables from a DIFFERENT line (doctrine 41 -- a positive control with no
    same-positions-no-signal arm proves nothing):

      reading                          Snorri st.1-2   skot real/chance   aðal real/chance
      coda + first onset consonant        16/16        63.2% / 12.3%      61.8% / 2.8%
      whole run, only `r` dropped         15/16        66.2% / 10.8%      63.2% / 2.2%
      whole run, `r` and `j` dropped      16/16        67.6% / 11.4%      63.7% / 2.4%   <-- this
      first post-vocalic consonant only   16/16        75.0% / 31.9%      73.0% / 6.3%

    The last row is the cautionary one: it "finds" the most and is the worst
    skothending detector in the corpus, because its chance rate nearly
    triples. Recovery is not the figure to maximise.
    """
    r = list(coda) + list(next_onset)
    while len(r) > 1 and r[-1] in ("r", "j"):
        r.pop()
    return tuple(r[:2])


class OldNorse(Phonology):
    language = "non"
    name = "Old Norse (dróttkvætt)"
    notation = (
        "normalised Old Norse: a á e é i í o ó u ú y ý, æ œ ø ǫ (combining "
        "acute accepted for ǫ́/ǿ), þ ð; x read as k+s and z as t+s. ALSO "
        "ACCEPTED, AND MARKED AS MERGED, the 19th/20th-c. normalisation in "
        "which ö stands for BOTH ǫ and ø and æ stands for BOTH æ and œ -- the "
        "only complete Háttatal text reachable is in it (ǫ, ø, œ occur zero "
        "times in 51 KB). Merged vowels are never resolved: aðalhending "
        "returns None instead of True wherever identity would rest on one, "
        "skothending stays definite except between two identical merged "
        "graphemes. REFUSED: d for ð, th/dh for þ/ð, accent-stripped text -- "
        "and NOT DETECTABLE: 'jord' is four legal letters and reads as a "
        "different word. See notation_report(), which flags the tells it can "
        "see and proves nothing when it is empty."
    )
    grid_unit = "syllable (six to a dróttkvætt line)"
    prominence_rule = (
        "STRESS, fixed on the first syllable of every word (Germanic initial "
        "stress) and on the first syllable of each hyphen-marked compound "
        "element; 1 stressed, 0 not. Syllable WEIGHT is a different property "
        "and is carried on Syllable.moras (2 heavy = long vowel, diphthong or "
        "closed; 1 light), because a stressed syllable can be light -- 'so-' "
        "in sonar -- and one field cannot hold both."
    )
    relation = (
        "hending: skothending (same consonants after DIFFERENT vowels) in odd "
        "lines, aðalhending (same vowel and same consonants) in even, the "
        "later element on the penultimate syllable; onsets must differ in "
        "both. Plus stuðlar/höfuðstafr alliteration, sk/sp/st only with "
        "themselves."
    )
    source = (
        "rules only; no external resource, so nothing to licence. The rules "
        "are Snorri Sturluson's own, quoted in the module docstring from the "
        "Háttatal prose (c. 1222-25, public domain by age). NO TEXT IS "
        "VENDORED: the Guðni Jónsson edition the orthography was measured "
        "against is CONTESTED in data/sources.tsv and is not a corpus here."
    )

    # -- reading ----------------------------------------------------------

    def _analyse(self, word):
        """-> (syllables, part index per syllable) or None. A hyphen is an
        explicit compound boundary; the hending run does not cross it."""
        w = _norm(word)
        if not w:
            return None
        parts = [p for p in w.split("-") if p]
        if not parts:
            return None
        out, owner = [], []
        for pi, p in enumerate(parts):
            u = units(p)
            if u is None:
                return None
            m = _merge_diphthongs(u)
            ns = [i for i, x in enumerate(m) if _is_vowel(x)]
            if not ns:
                return None              # a part with no nucleus is unreadable
            sylls = []
            for j, ni in enumerate(ns):
                start = 0 if j == 0 else ns[j - 1] + 1
                cluster = tuple(m[start:ni])
                if j == 0:
                    onset, prev_coda = cluster, ()
                else:
                    k = 0
                    for kk in range(len(cluster), 0, -1):
                        if _legal_onset(cluster[-kk:]):
                            k = kk
                            break
                    onset = cluster[len(cluster) - k:] if k else ()
                    prev_coda = cluster[:len(cluster) - k]
                if prev_coda:
                    s = sylls[-1]
                    sylls[-1] = Syllable(s.text + "".join(prev_coda), s.onset,
                                         s.nucleus, s.coda + prev_coda,
                                         s.prominence, s.moras)
                sylls.append(Syllable("".join(onset) + m[ni], onset, m[ni],
                                      (), 0, 1))
            tail = tuple(m[ns[-1] + 1:])
            if tail:
                s = sylls[-1]
                sylls[-1] = Syllable(s.text + "".join(tail), s.onset,
                                     s.nucleus, s.coda + tail, s.prominence,
                                     s.moras)
            for si, s in enumerate(sylls):
                s.prominence = 1 if si == 0 else 0
                s.moras = 2 if (_is_long(s.nucleus) or s.coda) else 1
            out.extend(sylls)
            owner.extend([pi] * len(sylls))
        return out, owner

    def syllabify(self, word):
        a = self._analyse(word)
        return a[0] if a else []

    def rimes(self, word):
        """-> list of (nucleus, consonants), one per syllable, or None.

        The hending identity, in the shape of `Syllable.key()` -- a
        (nucleus, coda) pair -- but with the coda replaced by the hending run,
        which is a different object and the reason this is not `key()` itself.
        """
        a = self._analyse(word)
        if a is None:
            return None
        sylls, owner = a
        out = []
        for i, s in enumerate(sylls):
            nxt = ()
            if i + 1 < len(sylls) and owner[i + 1] == owner[i]:
                nxt = sylls[i + 1].onset
            out.append((s.nucleus, _hending_consonants(s.coda, nxt)))
        return out

    def hending_rime(self, word, index=0):
        r = self.rimes(word)
        if r is None or not -len(r) <= index < len(r):
            return None
        return r[index]

    def onset(self, word, index=0):
        s = self.syllabify(word)
        if not s or not -len(s) <= index < len(s):
            return None
        return s[index].onset

    # -- the merger (doctrine 53) ------------------------------------------

    def merged_orthography(self, text):
        """Is this text in the ǫ/ø -> ö normalisation?

        `ö` is not a grapheme of classical normalised Old Norse, so one
        occurrence identifies the edition -- and in that edition `œ` has gone
        to `æ` too, which is why this is what `stanza()` uses to set
        `ae_merged`.
        """
        return "ö" in unicodedata.normalize("NFC", text).lower()

    def _ambiguous(self, nucleus, ae_merged):
        if nucleus == "ö":
            return True
        return ae_merged and nucleus == "æ"

    def _readings(self, nucleus, ae_merged):
        if self._ambiguous(nucleus, ae_merged):
            return set(MERGED_READINGS[nucleus])
        return {nucleus}

    def _vowel_verdict(self, a, b, ae_merged):
        """-> True same / False different / None cannot tell."""
        ra, rb = self._readings(a, ae_merged), self._readings(b, ae_merged)
        if not (ra & rb):
            return False                 # no reading of either makes them one
        if len(ra) == 1 and len(rb) == 1:
            return True
        return None                      # the edition collapsed the contrast

    # -- the two hendings ---------------------------------------------------

    def _pair(self, ra, rb, oa, ob, kind, ae_merged):
        if ra is None or rb is None or oa is None or ob is None:
            return None
        if not ra[1] or not rb[1]:
            return False                 # "stafir eru eftir hljóðstaf": a
        if ra[1] != rb[1]:               # hending needs consonants after the
            return False                 # vowel, so an open syllable has none
        if oa == ob:
            return False                 # "upphafstafir greina orðin"
        same = self._vowel_verdict(ra[0], rb[0], ae_merged)
        if kind == "adal":
            return same                  # None here is the doctrine-53 refusal
        if same is None:
            return None                  # ö : ö -- cannot tell if they differ
        return not same

    def adalhending(self, a, b, ia=0, ib=0, ae_merged=False):
        """Full rhyme: one vowel, the same consonants after it, different
        onsets. -> True / False / None.

        None means the verdict is unavailable, not that it is negative. It is
        returned when a word is outside the declared orthography, and -- the
        load-bearing case -- when a True verdict would rest on a vowel the
        edition has merged. Pass `ae_merged=True` for a text in which `æ`
        also stands for `œ`; `stanza()` sets it from the text itself.
        """
        return self._pair(self.hending_rime(a, ia), self.hending_rime(b, ib),
                          self.onset(a, ia), self.onset(b, ib), "adal",
                          ae_merged)

    def skothending(self, a, b, ia=0, ib=0, ae_merged=False):
        """Half rhyme: the same consonants after DIFFERENT vowels, different
        onsets. -> True / False / None.

        ON VOWEL LENGTH, which is a real editorial question: vowel length is
        phonemic in Old Norse, so `a` and `á` are two different vowels and a
        pair differing only in quantity SATISFIES "different vowels" -- this
        returns True for `fara : sára` (and False for `fara : fára`, whose
        onsets are the same). The alternative view, that a hending is heard
        as a change of vowel colour and a bare length contrast is too weak to
        count, is a defensible reading and is NOT taken; a caller who wants it
        must compare qualities itself. Nothing in Snorri's prose settles it,
        and all four skothendingar in his demonstration stanza differ in
        quality anyway (æ:ei, ǫ:y, a:e, a:e), so the corpus does not settle it
        either.

        A merged spelling leaves this predicate definite wherever the two
        vowels are written differently, which is nearly always. Two identical
        merged graphemes (`ö : ö`) could be ǫ:ǫ or ǫ:ø, so it returns None --
        the merger is harmless for skothending but not weightless, and this is
        the narrow residue.
        """
        return self._pair(self.hending_rime(a, ia), self.hending_rime(b, ib),
                          self.onset(a, ia), self.onset(b, ib), "skot",
                          ae_merged)

    def rhymes(self, a, b):
        """Aðalhending on the stressed syllable of each word.

        Dróttkvætt has NO end-rhyme -- the rhyme of this tradition is the
        internal hending, which is the whole reason the cell is worth having:
        every other positive control this project can reach is line-final and
        therefore periodic whether or not anything rhymes.
        """
        return self.adalhending(a, b)

    # -- alliteration -------------------------------------------------------

    def alliterating_unit(self, word):
        """-> the stave: "" for any vowel, "sk"/"sp"/"st" for those three, else
        the first consonant. None if unreadable."""
        s = self.syllabify(word)
        if not s:
            return None
        on = s[0].onset
        if not on:
            return ""
        if len(on) >= 2 and on[0] == "s" and on[1] in ("k", "p", "t"):
            return on[0] + on[1]
        return on[0]

    def alliterates(self, a, b):
        ua, ub = self.alliterating_unit(a), self.alliterating_unit(b)
        if ua is None or ub is None:
            return None                  # unreadable: never a guess
        return ua == ub

    # -- lines and stanzas --------------------------------------------------

    def scan(self, line):
        """-> list of per-syllable records, or None if any word is unreadable.

        Each record carries the word, its index within the word, the Syllable,
        the hending rime, and whether the word is málfylling.
        """
        out = []
        for w in _tokens(line):
            a = self._analyse(w)
            r = self.rimes(w)
            if a is None or r is None:
                return None
            for i, (syl, rim) in enumerate(zip(a[0], r)):
                out.append({"word": w, "i": i, "syllable": syl, "rime": rim,
                            "particle": _norm(w) in PARTICLES})
        return out or None

    def line_hending(self, line, kind, ae_merged=False):
        """-> (True / False / None, detail).

        The viðrhending is the penultimate syllable of the LINE. The
        frumhending is looked for among the earlier syllables, oddhendingar
        (word-initial, stressed) first and hluthendingar (word-internal)
        second, and the detail says which was found -- a hluthending is
        Snorri's own category and it is also where this module is guessing,
        because it cannot see the compound that licenses it.
        """
        sc = self.scan(line)
        if sc is None:
            return None, "not readable in the declared orthography"
        if len(sc) < 2:
            return False, f"{len(sc)} syllables: no penultimate to carry it"
        tgt = sc[-2]
        pools = (("oddhending", [x for x in sc[:-2]
                                 if x["syllable"].prominence == 1]),
                 ("hluthending", [x for x in sc[:-2]
                                  if x["syllable"].prominence != 1]))
        unknown = None
        for label, pool in pools:
            for c in pool:
                v = self._pair(c["rime"], tgt["rime"],
                               c["syllable"].onset, tgt["syllable"].onset,
                               kind, ae_merged)
                if v is True:
                    return True, (f"{label} {c['syllable'].text!r} in "
                                  f"{c['word']!r} answers viðrhending "
                                  f"{tgt['syllable'].text!r} in "
                                  f"{tgt['word']!r} on "
                                  f"{''.join(tgt['rime'][1])!r}")
                if v is None and unknown is None:
                    unknown = (label, c, tgt)
        if unknown is not None:
            label, c, tgt = unknown
            return None, (f"{label} {c['syllable'].text!r} would answer "
                          f"{tgt['syllable'].text!r}, but the vowel is merged "
                          f"in this orthography and the verdict would be "
                          f"manufactured")
        return False, (f"nothing answers viðrhending {tgt['syllable'].text!r} "
                       f"in {tgt['word']!r} ({len(sc)} syllables)")

    def couplet_alliteration(self, odd, even):
        """-> (n_studlar, stave, detail) or (None, None, reason).

        The höfuðstafr is the stave of the first non-málfylling word of the
        EVEN line; the stuðlar are the non-málfylling words of the ODD line
        carrying it. Dróttkvætt wants exactly two, and this REPORTS the count
        rather than a verdict so a caller applies the tradition's threshold.
        """
        wo, we = _tokens(odd), _tokens(even)
        if not wo or not we:
            return None, None, "empty line"
        head, head_word = None, None
        for w in we:
            if _norm(w) in PARTICLES:
                continue
            head = self.alliterating_unit(w)
            if head is None:
                return None, None, f"{w!r} not readable"
            head_word = w
            break
        if head is None:
            return None, None, "the even line is all málfylling"
        hits = []
        for w in wo:
            if _norm(w) in PARTICLES:
                continue
            u = self.alliterating_unit(w)
            if u is None:
                return None, None, f"{w!r} not readable"
            if u == head:
                hits.append(w)
        detail = (f"höfuðstafr {head or 'vowel'!r} on {head_word!r}; stuðlar "
                  f"{hits}")
        if head == "":
            vowels = {self.syllabify(w)[0].nucleus for w in hits}
            detail += (f"; distinct vowels {sorted(vowels)} — Snorri: it is "
                       f"'fegra' if each stuðill has its own vowel")
        return len(hits), head, detail

    def stanza(self, lines):
        """-> list of (kind, verdict, detail), odd lines skothending and even
        aðalhending, with `ae_merged` inferred ONCE from the whole stanza."""
        ae = self.merged_orthography("\n".join(lines))
        out = []
        for i, ln in enumerate(lines):
            kind = "skot" if i % 2 == 0 else "adal"
            v, d = self.line_hending(ln, kind, ae_merged=ae)
            out.append((kind, v, d))
        return out

    # -- notation (doctrine 50) --------------------------------------------

    def notation_report(self, text):
        """-> list of declared suspicions about the orthography.

        AN EMPTY REPORT PROVES NOTHING. The destructive substitutions are
        mostly invisible: `jord` for `jǫrð` is four legal letters and this
        module reads it as a different word. What can be seen is listed; what
        cannot is named in `notation`.
        """
        out = []
        t = unicodedata.normalize("NFC", text)
        ws = _tokens(t)
        bad = [w for w in ws if units(w) is None]
        if bad:
            out.append(f"{len(bad)} words outside the inventory, e.g. "
                       f"{bad[:5]} — these are REFUSED, not guessed")
        if self.merged_orthography(t):
            out.append("ö present: this is the ǫ/ø -> ö normalisation, so æ "
                       "also stands for œ. Skothending is unaffected; "
                       "aðalhending returns None where identity rests on a "
                       "merged vowel")
        low = t.lower()
        if "th" in low or "dh" in low:
            out.append("'th'/'dh' present: probable þ/ð substitution, which "
                       "this module cannot read as þ/ð and will not guess")
        ur = [w for w in ws if _norm(w).endswith("ur") and len(_norm(w)) > 3]
        if ur:
            out.append(f"{len(ur)} words end in -ur, e.g. {ur[:5]}: probable "
                       f"modernised Icelandic epenthesis (Lætr -> Lætur), "
                       f"which adds a syllable to a six-syllable line and "
                       f"makes hending positions unrecoverable")
        if len(ws) >= 8 and not any(any(c in LONG_VOWELS for c in _norm(w))
                                    for w in ws):
            out.append("no long vowel anywhere in >=8 words: probable "
                       "accent-stripped text, in which length — a phoneme "
                       "here — is gone and every hending verdict is wrong")
        return out


register(OldNorse())
