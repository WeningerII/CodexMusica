#!/usr/bin/env python3
"""Sanskrit — prāsa. Cheap for a fourth reason, different again from the others.

Finnish was cheap because its orthography is near-phonemic; Welsh because its
eight digraphs are the only trap; Middle Chinese because it is a lookup and not
a G2P problem. Sanskrit is cheap because **IAST is already a phonemic
transcription** -- one grapheme, one phoneme, no allophony to model, no lexicon
to consult -- and because the binary its metre constrains is computable from
the string with no reference to a word's identity at all.

PROMINENCE IS NOT STRESS, AND HERE IT IS NOT PITCH EITHER

Classical Sanskrit metre is **quantitative**. What the templates constrain is
the **guru (heavy) / laghu (light)** binary, and that is what
`Syllable.prominence` carries -- 1 for guru, 0 for laghu. `grid_unit` is the
**mora**, and `Syllable.moras` is 2 for guru and 1 for laghu.

Vedic Sanskrit had a pitch accent (udātta / anudātta / svarita) and the
classical language is usually reconstructed with a weight-sensitive stress, but
NEITHER is what a metrical template indexes, and neither is recoverable from an
unaccented IAST text. `stresses()` therefore raises rather than returning a
plausible-looking pattern, exactly as the Somali module does. A stress grid
here would be a number nobody could have caught.

GURU IS A PROPERTY OF A SYLLABLE'S NEIGHBOURHOOD, NOT OF THE SYLLABLE

A syllable is guru if ANY of:

  - its nucleus is long: ā ī ū ṝ ḹ, and e ai o au, which are ALWAYS long in
    Sanskrit because they are historical diphthongs;
  - it carries anusvāra (ṃ) or visarga (ḥ);
  - it is followed by a consonant CLUSTER (guru by position); or
  - it is the last syllable before a pause and closed by a consonant.

otherwise laghu. Three consequences the implementation is built around:

  1. **The cluster is counted in PHONEMES, not characters.** The aspirates
     `kh gh ch jh ṭh ḍh th dh ph bh` are single consonants, as are
     `ś ṣ ṅ ñ ṇ ṭ ḍ`. A per-character loop reads `yudhiṣṭhiraṃ` as `yu` before
     *d+h* and calls it guru; it is laghu, and the line then fails its own
     metre while looking well-formed.
  2. **Position reaches ACROSS the word boundary.** `yam ayuṅkta` scans
     ya-ma-yuṅk-ta: the `m` is the onset of the following vowel and `ya` is
     LIGHT, where `yam` scanned alone would be heavy. So `scan_pada()` and not
     `syllabify()` is the authoritative entry point, and `syllabify()` refuses
     whitespace rather than letting a caller concatenate word-by-word results.
  3. Syllable division is **maximal onset** -- the whole intervocalic cluster
     is the onset of the following akṣara. That is not a convenience: it is
     what the Devanāgarī writing system does, since a conjunct is written
     attached to the vowel that follows it. Guru-by-position is therefore
     computed by looking at the NEXT syllable's onset, which is why prominence
     cannot be assigned by inspecting one syllable alone.

SANDHI: THIS MODULE EXPECTS SEGMENTED INPUT AND WILL NOT SEGMENT

Sanskrit verse is written in saṃhitā, with word boundaries dissolved. Undoing
that is a parsing problem with a large lexicon behind it, and nothing here
attempts it: input must arrive already split into words. That is a large part
of why the Digital Corpus of Sanskrit is the right corpus -- it ships the split.

Segmented is not the same as syllabic. Four DCS tokens across the 10,993 in the
two validated texts have NO VOWEL at all -- `'py` (api after o-sandhi), `hy`,
`nv`, `tv` -- because sandhi has eaten the vowel that carried them.
`syllabify()` returns [] for such a token, which is the right answer and not a
refusal: a token with no nucleus has no syllable. `scan_pada()` absorbs its
consonants into the following word's onset, which is what sandhi means, and
the pāda scans exactly. A caller who scanned word by word would drop the token
and shift every metrical position after it.

The mirror-image hazard is doctrine 50, and it is REAL in this corpus rather
than hypothetical. The DCS `# text =` line is word-segmented, and its degree of
sandhi retention varies by text: 17.2% of Kirātārjunīya tokens differ from
their unsandhied form against 4.4% of Gītagovinda's. Where sandhi has been
undone, the line is no longer the metrical surface. Gītagovinda 1.1 is the
clean demonstration: the transmitted `bhīrur ayaṃ` scans ⏑ ⏑, the DCS's
restored `bhīruḥ ayam` scans — ⏑, and the pāda then misses
śārdūlavikrīḍita at exactly one position. The module is right and the
orthographic layer is what broke. `quality/test_phon_san.py` pins both readings.

NOTATION IS DECLARED, AND FOUR OTHERS ARE REFUSED RATHER THAN CONVERTED

This module reads **IAST**, Unicode **NFC**, lowercase. Input is normalised to
NFC explicitly rather than hoped to arrive that way: in NFD, `ṣ` is `s` + U+0323
and `ā` is `a` + U+0304, so a naive membership test sees a bare `s` followed by
something it does not know, and every retroflex and every long vowel in the
text silently changes class. (The DCS is NFC throughout -- 38 distinct
characters, zero combining marks -- but that is a fact about one corpus, not a
guarantee about an argument.)

Devanāgarī, Harvard-Kyoto, SLP1, ITRANS and ISO 15919 are REFUSED. Sniffing
which one arrived is exactly what this project forbids, and here the failure
mode is silent rather than loud: Harvard-Kyoto `kRSNa` case-folds to `krsna`,
which is a legal IAST string, so a module that helpfully lowercased its input
would read कृष्ण as a single syllable with a four-consonant onset and never
say so. Two consequences, both deliberate:

  - **Any uppercase character is a refusal.** In Harvard-Kyoto and SLP1 case is
    phonemic (`A`=ā, `R`=ṛ, `S`=ṣ, `M`=ṃ); in IAST it is not, it is only
    sentence and proper-name capitalisation and carries no sound. So refusing
    capitals costs this module nothing it needs and closes the one path by
    which another notation could be read as this one. A caller holding
    capitalised IAST must lowercase it themselves, which makes the notation
    THEIR declaration rather than this module's guess.
  - **A doubled identical vowel is a refusal.** `aa ii uu` cannot occur inside
    a Sanskrit word -- sandhi contracts them -- so rejecting them is a
    phonotactic fact about the declared notation, not a sniff of another. It
    happens to catch ITRANS `raama`, which is the one remaining all-lowercase
    transliteration that would otherwise parse.

ISO 15919 is refused wholesale rather than half-accepted. It differs from IAST
in more than the anusvāra (`ṁ` for `ṃ`): it writes syllabic r as `r̥`, and it
distinguishes `ē ō` from `e o`. Accepting its anusvāra alone would read the
rest of an ISO 15919 string as IAST and get the vowels wrong.

CORPUS

Validated against the Digital Corpus of Sanskrit (Oliver Hellwig, DCS,
2010-2021, CC BY 4.0), sparse-checked-out so that the NC-licensed sibling tree
`corpus/GRETIL/` is never fetched. See the row for
`OliverHellwig/sanskrit#dcs-conllu` in `data/sources.tsv`. Nothing here loads
that corpus at runtime; the module is rules only.
"""

import re
import unicodedata

from quality.phonology import Phonology, Syllable, Unsupported, register

#: Short vowel nuclei. `ṛ ḷ` are NUCLEI, not consonants -- reading them as
#: consonants turns every `kṛ-` into a two-consonant onset and manufactures a
#: guru out of a laghu.
SHORT = ("a", "i", "u", "ṛ", "ḷ")
#: Long vowel nuclei. `e o ai au` are here because they are historically
#: diphthongs and are ALWAYS long in Sanskrit -- there is no short `e`.
LONG = ("ā", "ī", "ū", "ṝ", "ḹ", "e", "ai", "o", "au")
VOWELS = frozenset(SHORT) | frozenset(LONG)

#: The stops that take aspiration. `h` after one of these is the SECOND half of
#: a single consonant, never a cluster.
ASPIRABLE = frozenset("kgcjṭḍtdpb")
#: One grapheme, one consonant. Note ś ṣ ṅ ñ ṇ ṭ ḍ are single characters in
#: NFC and single phonemes; the aspirates below are two characters and one
#: phoneme, which is the distinction a naive loop loses.
CONSONANTS = frozenset([
    "k", "kh", "g", "gh", "ṅ",
    "c", "ch", "j", "jh", "ñ",
    "ṭ", "ṭh", "ḍ", "ḍh", "ṇ",
    "t", "th", "d", "dh", "n",
    "p", "ph", "b", "bh", "m",
    "y", "r", "l", "v",
    "ś", "ṣ", "s", "h",
])
#: Anusvāra and visarga. They are never onsets -- they can only close a
#: syllable -- and either one makes that syllable guru on its own.
MARKERS = frozenset(("ṃ", "ḥ"))

#: Separators a caller may leave in: daṇḍa, double daṇḍa, pipe.
_SEPARATORS = "|‖।॥"


def _prepare(word):
    """-> a normalised IAST string, or None if the input is refused.

    Normalisation is explicit and one-directional: NFC, U+2019 folded to the
    ASCII apostrophe (doctrine 26 -- normalise the curly quote anywhere a word
    is extracted), avagraha and hyphen dropped. Uppercase and doubled vowels
    are refusals and are documented in the module docstring.
    """
    if not isinstance(word, str):
        return None
    w = unicodedata.normalize("NFC", word)
    w = w.replace("’", "'").replace("ʼ", "'").replace("ʾ", "'")
    # The avagraha marks an initial `a` elided by sandhi. It is not pronounced
    # and contributes no mora, so it is dropped rather than parsed.
    w = w.replace("'", "").replace("-", "").replace("–", "")
    w = w.strip()
    if not w:
        return None
    if any(c.isupper() for c in w):
        return None                      # Harvard-Kyoto / SLP1 guard
    for v in ("aa", "ii", "uu", "ee", "oo"):
        if v in w:
            return None                  # phonotactically impossible; ITRANS
    return w


def units(word):
    """-> list of phoneme units, aspirates and diphthongs kept whole; None if
    any character is out of the declared IAST inventory.

    This is the load-bearing function. `bh` is ONE consonant, so `bha` is
    laghu; split it and every cluster count in the language inflates and every
    open short syllable before an aspirate becomes spuriously heavy.
    """
    w = _prepare(word)
    if w is None:
        return None
    out, i = [], 0
    while i < len(w):
        c = w[i]
        nxt = w[i + 1:i + 2]
        if c == "a" and nxt in ("i", "u"):
            out.append(c + nxt)          # ai / au, a single long nucleus
            i += 2
            continue
        if c in ASPIRABLE and nxt == "h":
            out.append(c + nxt)          # the aspirate, a single consonant
            i += 2
            continue
        if c in VOWELS or c in CONSONANTS or c in MARKERS:
            out.append(c)
            i += 1
            continue
        return None                      # out of inventory: never a guess
    return out


def _tokens(text):
    if not isinstance(text, str):
        return []
    for s in _SEPARATORS:
        text = text.replace(s, " ")
    return [t for t in re.split(r"\s+", text.strip()) if t]


def _stream(text):
    """-> flat unit list for a whole pāda, or None if any word is refused.

    Words are parsed SEPARATELY and then flattened. Parsing per word is what
    stops a diphthong forming across a space: the DCS's de-sandhied text can
    put `...a` next to `i...`, and a single pass over the joined string would
    read `kalā iva` style junctures as `ai`. Flattening afterwards is what lets
    the position rule reach across the boundary, which it must.
    """
    toks = _tokens(text)
    if not toks:
        return None
    out = []
    for t in toks:
        u = units(t)
        if u is None:
            return None
        out.extend(u)
    return out


def _syllables(stream):
    """-> list of Syllable with prominence and moras filled in.

    Maximal onset: every intervocalic consonant is the onset of the FOLLOWING
    akṣara, except ṃ / ḥ which can only close the preceding one, and except a
    trailing run with no vowel after it, which is a coda.
    """
    idx = [i for i, u in enumerate(stream) if u in VOWELS]
    if not idx:
        return []
    sylls = []
    for n, ni in enumerate(idx):
        start = 0 if n == 0 else idx[n - 1] + 1
        run = stream[start:ni]
        marks = []
        while run and run[0] in MARKERS:
            marks.append(run[0])
            run = run[1:]
        if marks and sylls:
            p = sylls[-1]
            sylls[-1] = Syllable(p.text + "".join(marks), p.onset, p.nucleus,
                                 p.coda + tuple(marks), p.prominence, p.moras)
        onset = tuple(run)
        nuc = stream[ni]
        sylls.append(Syllable("".join(onset) + nuc, onset, nuc, (), None, 1))
    tail = tuple(stream[idx[-1] + 1:])
    if tail:
        p = sylls[-1]
        sylls[-1] = Syllable(p.text + "".join(tail), p.onset, p.nucleus,
                             p.coda + tail, p.prominence, p.moras)
    # weight. A syllable's weight depends on what FOLLOWS it, so this cannot be
    # done inside the loop above.
    n = len(sylls)
    for i, s in enumerate(sylls):
        heavy = s.nucleus in LONG
        if any(c in MARKERS for c in s.coda):
            heavy = True
        coda_cons = [c for c in s.coda if c not in MARKERS]
        if i + 1 < n:
            if len(coda_cons) + len(sylls[i + 1].onset) >= 2:
                heavy = True             # guru by position
        elif coda_cons:
            heavy = True                 # closed before a pause
        s.prominence = 1 if heavy else 0
        s.moras = 2 if heavy else 1
    return sylls


class Sanskrit(Phonology):
    language = "san"
    name = "Sanskrit"
    notation = ("IAST (ā ī ū ṛ ṝ ḷ ḹ ṃ ḥ ṅ ñ ṭ ḍ ṇ ś ṣ), Unicode NFC, "
                "lowercase; input is normalised to NFC explicitly. "
                "Devanāgarī, Harvard-Kyoto, SLP1, ITRANS and ISO 15919 are "
                "REFUSED, not converted and not sniffed")
    grid_unit = "mora"
    prominence_rule = (
        "guru (1) / laghu (0) -- the QUANTITATIVE binary Sanskrit metre "
        "constrains, NOT stress. Guru: a long nucleus (ā ī ū ṝ ḹ e ai o au), "
        "or anusvāra/visarga, or a following consonant cluster (by position), "
        "or a consonant-closed syllable before a pause. A pāda-final laghu is "
        "ANCEPS and carries None from scan_pada(). Vedic pitch accent and "
        "classical stress are not recoverable from unaccented IAST and are "
        "refused by stresses()")
    relation = ("prāsa -- anuprāsa (consonantal alliteration, classically "
                "anchored on the second akṣara of the pāda, "
                "dvitīyākṣara-prāsa) and antya-prāsa (end-rhyme)")
    source = ("rules only; no external resource, so nothing to licence. "
              "Validated against the Digital Corpus of Sanskrit (Oliver "
              "Hellwig, DCS, 2010-2021, CC BY 4.0)")

    # -- syllabification --------------------------------------------------

    def syllabify(self, word):
        """-> list of Syllable for ONE word, scanned as if in pause.

        Refuses whitespace. A pāda is not the concatenation of its words'
        scansions: `yam` alone is guru and `yam ayuṅkta` scans ya-ma-yuṅk-ta
        with `ya` LAGHU, so a caller who syllabified word by word and joined
        the lists would get a metrically wrong line that still looked like a
        line. Use scan_pada() for anything longer than a word.
        """
        if not isinstance(word, str) or re.search(r"\s", word.strip()):
            return []
        u = units(word)
        if u is None:
            return []
        return _syllables(u)

    def scan_pada(self, text, anceps=True):
        """-> list of Syllable for a whole pāda, scanned in saṃhitā.

        The authoritative entry point. Consonants resyllabify across word
        boundaries, which is where guru-by-position actually lives.

        ANCEPS. The last syllable of a pāda is traditionally ⏓: the metre
        licenses a light syllable there as heavy. That indeterminacy is a fact
        about the METRE, not about the phonology, so it is reported rather than
        resolved -- a pāda-final syllable that is laghu by the rule gets
        `prominence = None` and keeps `moras = 1`, and a pāda-final syllable
        that is guru by the rule stays guru, because anceps promotes light to
        heavy and never the reverse. Pass anceps=False for the strict weight.

        Returns [] if any word is out of inventory. It refuses the whole pāda
        rather than scanning the readable part, because a scansion with a hole
        in it has the wrong positions after the hole.

        ONE pāda. Hand it a half-verse of two pādas and only the last position
        is treated as anceps, because that is the only pāda end it can see.
        Where the internal boundary falls is a property of the metre and the
        DCS does not record it, so splitting is the caller's declaration.
        """
        st = _stream(text)
        if st is None:
            return []
        sylls = _syllables(st)
        if anceps and sylls and sylls[-1].prominence == 0:
            sylls[-1].prominence = None
        return sylls

    def pattern(self, text, anceps=True):
        """-> 'g'/'l'/'?' per syllable, or None if the pāda is unreadable.

        '?' is the anceps position and means 'the metre may take this either
        way', not 'unknown weight'.
        """
        sylls = self.scan_pada(text, anceps=anceps)
        if not sylls:
            return None
        return "".join("?" if s.prominence is None
                       else ("g" if s.prominence else "l") for s in sylls)

    def scans_as(self, text, template):
        """-> True / False / None against a metrical template.

        Template alphabet: 'g' guru, 'l' laghu, 'x' either (use it for an
        anceps position). None means the pāda could not be read at all; a
        readable pāda of the wrong length or the wrong shape is False, which
        is an answer.
        """
        got = self.pattern(text)
        if got is None:
            return None
        if len(got) != len(template):
            return False
        for a, b in zip(got, template):
            if b == "x" or a == "?":
                continue                 # anceps: licensed either way
            if a != b:
                return False
        return True

    def moras(self, text):
        """-> total mora count of a pāda, or None if unreadable. An anceps
        final counts its strict weight; the metre's licence is the caller's
        to apply, and silently adding a mora would hide it."""
        sylls = self.scan_pada(text)
        if not sylls:
            return None
        return sum(s.moras for s in sylls)

    def stresses(self, word):
        raise Unsupported(
            "Sanskrit metre is quantitative; this module will not return a "
            "stress pattern. Vedic Sanskrit had a PITCH accent (udātta / "
            "anudātta / svarita) and classical Sanskrit a weight-sensitive "
            "stress, and neither is what a metrical template indexes nor "
            "recoverable from unaccented IAST. Use grid_unit='mora', "
            "Syllable.moras, and the guru/laghu binary in prominence.")

    # -- prāsa ------------------------------------------------------------

    def _initial(self, word):
        """-> the first consonant of a word, '' if vowel-initial, None if the
        word is out of inventory."""
        s = self.syllabify(word)
        if not s:
            return None
        return s[0].onset[0] if s[0].onset else ""

    def alliterates(self, a, b, strict=False):
        """-> True / False / None. anuprāsa on the initial consonant.

        `strict` requires the WHOLE onset to match (pra ~ pra), not just its
        first consonant (pra ~ pa). The loose reading is the default because
        anuprāsa is the repetition of a consonant, and Jayadeva's
        `pralayapayodhijale` is the standard example of it.

        Two vowel-initial words return False, NOT True. Finnish and Somali
        treat all vowel-initial words as one alliterating class, and that is a
        fact about those traditions; anuprāsa is defined on a repeated
        CONSONANT, and there is no consonant here to repeat. Importing the
        convention would have been doctrine 8 in miniature.
        """
        ha, hb = self._initial(a), self._initial(b)
        if ha is None or hb is None:
            return None                  # unreadable: never a guess
        if ha == "" or hb == "":
            return False
        if not strict:
            return ha == hb
        sa, sb = self.syllabify(a), self.syllabify(b)
        return sa[0].onset == sb[0].onset

    def rhymes(self, a, b, depth=1):
        """-> True / False / None. antya-prāsa: the last `depth` akṣaras are
        identical IN FULL -- onset, nucleus and coda.

        Including the final akṣara's ONSET is where this departs from the
        English notion of rhyme and from `Syllable.key()`, and it is not a
        stylistic choice. Sanskrit prāsa is consonant-anchored, and Sanskrit
        inflection makes a nucleus-and-coda key nearly vacuous: every
        accusative singular neuter ends `-am`, so `vedam` would 'rhyme'
        `prabandham`. With the onset in, it does not -- an aspirate is not its
        plain stop.

        The reverse case is Jayadeva's `tiṣṭhati pṛṣṭhe / ...gariṣṭhe`, which
        rhymes on `-ṣṭhe` while the vowels before it (ṛ against i) do not
        agree at all. That pair is True at depth 1 and False at depth 2, and
        both answers are right: the shared run is three phonemes, which is
        more than one akṣara and less than two. Where the question is how far
        back the agreement actually runs, `prasa_depth()` measures it in
        phonemes instead of rounding it to akṣaras.

        None when either word is unreadable, or when either has fewer than
        `depth` syllables -- that is 'cannot be compared at the declared
        depth', which is not the same as 'does not rhyme'.
        """
        sa, sb = self.syllabify(a), self.syllabify(b)
        if not sa or not sb:
            return None
        if len(sa) < depth or len(sb) < depth:
            return None
        ka = [(s.onset, s.nucleus, s.coda) for s in sa[-depth:]]
        kb = [(s.onset, s.nucleus, s.coda) for s in sb[-depth:]]
        return ka == kb

    def prasa_depth(self, a, b):
        """-> how many trailing PHONEMES two words share, or None.

        A prāsa is a run of identical sound at the end of the pāda, and its
        length is not a whole number of akṣaras: `vedam` / `akhedam` share
        four units (e d a m) and `pṛṣṭhe` / `gariṣṭhe` share three (ṣ ṭh e).
        Reported rather than thresholded, so a caller applies the tradition's
        own standard instead of one imposed here. Counted in PHONEMES, so an
        aspirate contributes 1 and not 2.
        """
        ua, ub = units(a), units(b)
        if ua is None or ub is None:
            return None
        n = 0
        while n < len(ua) and n < len(ub) and ua[-1 - n] == ub[-1 - n]:
            n += 1
        return n

    def prasa_anchor(self, pada):
        """-> the SECOND akṣara of a pāda, or None.

        dvitīyākṣara-prāsa fixes the consonant of the second syllable of every
        pāda. Returns None -- never the first syllable, never a crash -- when
        the pāda has fewer than two syllables or cannot be read, because a
        pāda with one akṣara has no second one and saying so is the answer.

        Accepts a string or a list of words. It does NOT split a half-verse
        into its pādas: where the pāda boundary falls inside a DCS `# text =`
        line is a property of the metre, and the corpus does not record it.
        """
        if not isinstance(pada, str):
            try:
                pada = " ".join(pada)
            except TypeError:
                return None
        sylls = self.scan_pada(pada)
        if len(sylls) < 2:
            return None
        return sylls[1]

    def prasa(self, padas):
        """-> (consonant, share of pādas carrying it, per-pāda anchors).

        dvitīyākṣara-prāsa is a per-STANZA constraint: the same consonant on
        the second akṣara of every pāda. Reported as a share so a caller
        applies the tradition's own threshold. A pāda that cannot be read, or
        that is too short to have a second akṣara, contributes None to the
        per-pāda list and counts in the DENOMINATOR -- doctrine 27, a draw
        that fails the filter belongs in the denominator, not dropped.
        """
        anchors, counts = [], {}
        for p in padas:
            a = self.prasa_anchor(p)
            if a is None or not a.onset:
                anchors.append(None)
                continue
            anchors.append(a)
            c = a.onset[0]
            counts[c] = counts.get(c, 0) + 1
        if not counts or not padas:
            return None, 0.0, anchors
        best = max(counts, key=counts.get)
        return best, counts[best] / len(padas), anchors

    def antya_prasa(self, padas, depth=1):
        """-> (rhyme key, share of pādas carrying it, per-pāda keys).

        End-rhyme across a set of pādas. The key is the last `depth` akṣaras
        in full, the same object `rhymes()` compares. Unreadable pādas
        contribute None and stay in the denominator.
        """
        keys, counts = [], {}
        for p in padas:
            toks = _tokens(p)
            s = self.syllabify(toks[-1]) if toks else []
            if len(s) < depth:
                keys.append(None)
                continue
            k = tuple((x.onset, x.nucleus, x.coda) for x in s[-depth:])
            keys.append(k)
            counts[k] = counts.get(k, 0) + 1
        if not counts or not padas:
            return None, 0.0, keys
        best = max(counts, key=counts.get)
        return best, counts[best] / len(padas), keys


register(Sanskrit())
