#!/usr/bin/env python3
"""Malay — the **pantun** and its ABAB end-rhyme, read in 1900 Straits Rumi.

WHAT THE FORM MANDATES

A pantun is a quatrain rhyming **ABAB** on the line-final word, in lines of
roughly 8-12 syllables. It is the one form in this corpus whose two halves are
phonologically bound and semantically NOT:

  pembayang  lines 1-2, the "shadow" — an image, usually from nature
  maksud     lines 3-4, the "meaning" — the actual point

Skeat says so himself in the 1900 source this module serves, footnote [431]:
*"They are in the pantun form, and accordingly there is little connection
discernible between the first and the second half of the quatrain; the latter
always contains the actual point, the former at most something analogous or
remotely parallel."* No other corpus here carries rhyme across a deliberate
meaning discontinuity. `abab()` exposes the pairing (lines 1&3, 2&4) and the
pembayang/maksud split so a later cell can measure it. **This module makes no
semantic measurement and must not be extended to make one** — that needs
resources it does not have and would be a different claim entirely.

THE ORTHOGRAPHY IS THE WHOLE DESIGN PROBLEM, AND THE OBVIOUS FIX IS THE BUG

Skeat prints pre-1972 British-Malayan (Straits/Wilkinson) Rumi:

    ch = modern c        chinchang, pechah, kuching
    -o-/-e- in a final CLOSED syllable where modern writes -u-/-i-
                         burong=burung, tumboh=tumbuh, dudok=duduk, adek=adik
    ei  = modern ai      gulei=gulai, selesei=selesai, sampei=sampai
    ka-/sa- = ke-/se-    kapada, ka-tiga, sa-mata-mata
    hyphenated di- -nya  di-jeput, maka-nya
    angkau = engkau
    ' and ` for hamzah/`ayn      do'a, pinta', ta'tabek, `adat
    sh  = modern sy      Shurga = syurga
    bh, chh                      Bharu, Chhari-chhari — Skeat's aspirates
  and ZERO oe / dj / tj — this is the Wilkinson/Swettenham line, NOT van
  Ophuijsen's Dutch spelling. See `detect_orthography`.

**DECISION: this module reads 1900 Straits Rumi NATIVELY. It does not
modernise the rime.** The tempting fold — `burong` -> `burung` — is the
doctrine-50 error wearing a helpful face, and it runs the OPPOSITE way from
the way it first looks:

  Malay /u/ and /i/ are LOWERED to [o] and [e] in a final closed syllable.
  Straits Rumi writes that surface form; modern Ejaan Rumi Baharu restored the
  underlying phoneme. For RHYME, which is a fact about surface sound, the 1900
  spelling is the BETTER guide and the modern one is the lossy transcription.

Measured on the 82 ABAB quatrains: word-final `-ung` occurs **0 times** and
word-final `-uk` **0 times**, against 14 distinct `-ong` and 12 distinct `-ok`
types. The orthography is internally consistent — and it is consistently
MERGED. `-ong` writes both /oŋ/ (tolong) and /uŋ/ (burong), and no lexicon-free
rule can separate them.

WHAT THAT COSTS, STATED RATHER THAN ASSUMED

Reading natively costs the /o/~/u/ and /i/~/e/ contrast in final closed
syllables: `burong` and `tolong` are one rime here, and in modern orthography
they are two. Within the declared notation that is not an error — Skeat wrote
one spelling because he heard one sound — but a caller comparing this text to
a modern-spelling text is comparing two systems, and where that difference
lands IN THE RIME the module **refuses**:

    rhymes("burong", "burung")  ->  None      o~u under a shared coda
    rhymes("adek",   "adik")    ->  None      e~i under a shared coda
    rhymes("dato'",  "dudok")   ->  None      final ' and final k are both /ʔ/
                                              and Skeat writes both

Not False (they may well be the same word in two orthographies) and not True
(they may be two different words). Doctrine 2: the unknown propagates. The
refusal is keyed to the FEATURE, never to a guess about which orthography a
token came from — sniffing that per word would be a lexicon this module does
not have. `merger_refusal_rate()` measures what it costs on real pairs, so the
price is paid in the open the way `fas.py` pays its 60.2%.

Folds that ARE applied are notational only — they change no phoneme:
`ch`/`chh` and modern `c` all become one unit /tʃ/, `sh` and modern `sy` one
unit /ʃ/, `bh` -> `b`. So `pechah` and `pecah` are the SAME WORD here. The
pepet swap `ka-`/`ke-` is NOT folded: it sits in a non-final syllable, and /ə/
never occurs in a final syllable in Malay, so it cannot reach a rime.
`syllabify` therefore reports different nuclei for `katiga` and `ketiga` while
`rhymes` returns True for them, and that is the declared behaviour rather than
an inconsistency.

THE APOSTROPHE, AND IT IS TWO MARKS WEARING ONE GLYPH

`fin.py` treats its apostrophe as a hiatus mark that forces a syllable BREAK
and is then discarded; `cym.py` treats its apostrophe as an elision that JOINS.
Malay is neither, and the choice here is made knowingly:

  word-final `'`      = HAMZAH, a glottal stop /ʔ/, and a real CODA
                        pinta' ta' de' dato' tengko'  — modern spells this `k`
  medial `'` after a
  vowel               = the same /ʔ/: coda before a consonant (ta'tabek,
                        Do'ding), onset of the next syllable before a vowel
                        (do'a, mala'ikat, sa'ekor)
  word-initial `'`    = APHERESIS, a deleted leading syllable ('ku < aku,
                        'nak < hendak, 'Che < Inche, 'laman < halaman).
                        Nothing is pronounced; it is dropped.
  medial `'` after a
  consonant           = SYNCOPE, a deleted vowel (anak'nda < anakanda).
  after a HYPHEN      = the apheresis case again, and it is a FIFTH position,
                        not one of the four doctrine 65 names (darah-'kau,
                        munchong-'kau, hati-'ku, mata-'kau). `_split_word`
                        cuts the hyphen first, so this module has ALWAYS read
                        them correctly — the defect is in the DESCRIPTION, and
                        an audit checking only the four named positions reports
                        unclassified marks in a module that gets them all
                        right. `apostrophe_positions()` enumerates all five so
                        the claim is a function call rather than a paragraph.

The load-bearing half is the first: a word-final apostrophe is a SEGMENT and it
enters the rime. The medial-before-a-vowel case is safe either way — glottal
onset or bare hiatus, both force the same break and differ only in an onset,
which no rime sees. Skeat's backtick (`adat, `Ijrail) is `ayn; it is folded to
the same glyph and, being word-initial in every instance, dropped. That fold
loses the hamzah/`ayn distinction, which Malay does not use contrastively.

THE SYNCOPE MARK DOES NOT ALWAYS MARK A BOUNDARY — MISSING M-3

This file used to say the syncope apostrophe "marks a boundary, so the word
splits there", full stop. That is right for `anak'nda` — anak + -nda, and both
halves are well-formed Malay words. It is FATAL for `s'ri` (< seri, 29 tokens
in the 330 Malay verse blocks; 75 in the whole file), `t'ada` (8), `b'ras` (3),
`k'ladi` (2), `t'rap` (2), `g'lombang` (2), `k'ris`, `k'luar`, `b'lakang`,
`b'layer`, `b'rita`, `d'ras`, `p'leherakan`, `p'rut`, `sa-g'lap`: the
split leaves a VOWELLESS fragment, a fragment with no nucleus cannot be
syllabified, and one unreadable part refuses the whole word. Every one of them
was dropped from every class this module reports, silently.

And the module ALREADY ACCEPTED THE IDENTICAL PROCESS SPELLED WITHOUT THE
APOSTROPHE. Four sections down: "word-initial cluster ACCEPTED ... It is a
pepet syncope of Straits printing (prang=perang, Brapa=berapa, 'Plam=Pelam)".
The same deletion of the same /ə/, two printing habits, opposite verdicts —
doctrine 65's lesson arriving INSIDE one language, between two spellings of
one process, rather than between two languages.

The rule that separates the two cases needs no lexicon and no list. Skeat's
apostrophe stands WHERE THE VOWEL WAS, so the consonant before it was the
ONSET of the syllable that lost its nucleus, and it re-attaches to what
FOLLOWS:

    s'ri   ->  s + ri   ->  sri     one syllable, rime `i`    (seri)
    b'ras  ->  b + ras  ->  bras    one syllable, rime `as`   (beras)
    p'rut  ->  p + rut  ->  prut    one syllable, rime `ut`   (perut)

whereas `anak'nda` keeps its split, because `anak` is a well-formed Malay word
on its own. Mechanically: **a part with no vowel is not a word, so it merges
into the part that FOLLOWS** (`_merge_vowelless`). That is the whole fix, and
it is deliberately narrower than "merge anything unsyllabifiable": `ters'lit`
(< terselit) still refuses, because merging would give a medial /rsl/ and a
medial cluster is a refusal this module makes on purpose. `indra`, `anggrek`,
`chandrawasi`, `mentri` are untouched — those are `ndr`/`nggr` loans and the
complex-coda rule is right about them.

The same rule reads the Arabic proclitic article in Skeat's invocations:
`bismillahi-'l-rahmani` has `'l` as a whole hyphen element with no vowel, so
it merges forward into `lrahmani` and the article lands in the ONSET, which no
rime sees. `bi-smi-llahi-r-rahmani-r-rahim` shows the assimilated spelling of
the same article in the same text and now reads the same way.

The cost, declared rather than discovered later: the merged form is one
syllable SHORT of the unsyncopated word (`glombang` reads glom.bang where
gelombang is ge.lom.bang), so `line_syllables` under-counts such a line by
one. That cost was already being paid for `prang` and `Brapa`, which this
module has accepted since it was written; the fix makes the two spellings
agree rather than introducing a new error. The RIME is unaffected in every
case, which is the coordinate this module exists to report.

WHAT THE UNREADABLE TOKENS ACTUALLY ARE, MACHINE-READABLY

Doctrine 88: nothing told an ingestion defect from a correct refusal, and a
refusal rate is uninterpretable until its two causes are separated.
`unreadable_reason()` returns a code from a FIXED vocabulary and
`UNREADABLE_REASONS` maps each code to the layer that owns it, so the split is
a function call. Measured over the 330 Malay verse blocks of PG47873 (3,415
lines, 15,519 tokens, 458 unreadable) BEFORE this fix:

    vowelless_token                            305   66.6%   ingestion, ELSEWHERE
    complex_medial + complex_coda               77   16.8%   CORRECT REFUSAL
    vowelless part left by the apostrophe rule  76   16.6%   THIS MODULE'S DEFECT

and the 305 are `b` (101), `d` (100), `s` (99): the `d. s. b.` refrain stub,
which belongs to `lyric_harness`'s tokenizer and not here. MISSING M-3 records
rows two and three POOLED — "384 of 471 Malay token failures are the syncope
split leaving a vowelless fragment" — while M-4 separately bills 300 of the
same 471 to `d. s. b.`. Both cannot be true of one token. The pooling is the
error: the earlier classifier keyed on "this part has no vowel" instead of on
"an apostrophe split produced it", and so charged this module for 305 tokens
it never touched. M-3's headline, that 82% of msa.py's unreadability is its
own apostrophe rule, is **16.6%** — doctrine 79 one layer down, inside a
document written to record doctrine 79.

THE HYPHEN IS A SEAM, NOT A JOINER

Welsh deletes the hyphen and lets the letters resyllabify; Finnish keeps it as
a compound seam that BLOCKS resyllabification. Malay is Finnish's case, and
this corpus decides it rather than an analogy: `arak-arak` is a reduplication
of two whole words and reads a.rak.a.rak, whereas deleting the seam moves the
/k/ across it and gives a.ra.ka.rak. So each hyphenated element is syllabified
independently and the results are concatenated. The Straits clitic hyphen
(`di-jeput`, `mata-nya`, `datang-lah`, `hati-'ku`) is the other use of the
mark; there the seam happens to change nothing, which is exactly why it had to
be checked rather than assumed. Either way the LAST element carries the rime,
because the enclitic is part of the phonological word: `mata-nya` rhymes
`bila-nya` on -a.

DIGRAPHS ARE SINGLE CONSONANTS

`ng ny sy sh kh gh ch chh bh` are one consonant each. A per-character loop
splits `ng` into n+g and corrupts every coda in the language — and /ŋ/ is the
single most common rhyme coda in this corpus (`-ang` 248 occurrences, `-ing`
31, `-ong` 18). Longest match wins, so `ngg` in `tanggong` reads ng+g and
syllabifies tang.gong, which is correct.

Declared ambiguities, not resolved: `ng` is /ŋ/ here always, though across some
morpheme boundaries it is n+g; `ny` is /ɲ/ before a vowel; `nj` is n+dʒ
(menjadi = men.ja.di), which is exactly where a van Ophuijsen text would mean
/ɲ/ — so this module misreads Dutch-orthography Malay silently, and
`detect_orthography()` exists for a caller to check FIRST rather than for this
module to sniff.

SYLLABLE SHAPE IS (C)V(C), AND THE REFUSAL FOLLOWS THE RELATION

Native Malay allows no consonant cluster in either position. Two departures
appear in this text and they are treated differently, on doctrine 60 grounds —
derive the refusal from what the RELATION needs:

  word-initial cluster  ACCEPTED, kept whole as one onset. It is a pepet
                        syncope of Straits printing (prang=perang,
                        Brapa=berapa, 'Plam=Pelam, 'nda) or a loan
                        (Kremasena). An onset never enters a rime, so nothing
                        the module measures is put at risk.
  complex CODA          REFUSED, the whole word returns []. The coda IS the
                        rime. A guess there would corrupt the one thing this
                        module exists to report.

Diphthongs: `ai au oi` are diphthongs **word-finally only** (pulai, kerbau) and
are hiatus elsewhere (na.ik, la.ut, da.un, ij.ra.il) — the standard Malay rule.
Known cost: a suffixed diphthong stem (`sampaikan`) is counted one syllable
long, because the rule cannot see the morpheme boundary. That touches syllable
COUNT only, never a rime.

PROMINENCE IS REFUSED, FOLLOWING som.py

Malay stress is contested: commonly described as penultimate, and argued by
many analyses to be absent as a lexical property altogether. Malay is
syllable-timed, and the pantun is **not a stress metre** — it is counted in
syllables per line, conventionally 8-12. So `prominence` stays None on every
syllable, `prominences()` raises `Unsupported`, and `grid_unit` is
`"syllable"`, which is the coordinate the form constrains. Doctrine 35:
a module that returned a plausible penultimate pattern would have produced
numbers nobody could have caught, on a binary the form never asked about.

For the same reason this module carries **no proclitic list**. Doctrine 46 says
a function-word list is part of a phonology — it is, and it is part of a
phonology that supplies a stress grid. There is no grid here for such a list to
correct, so building one would be decoration. Whoever later supplies prominence
must build the list first.

  WARNING: `Syllable.key()` returns `(nucleus, coda)` and is the right rime key
  here — nuclei are always known, unlike `fas.py`. But key-equality alone
  UNDER-refuses: it cannot see the o~u / e~i / '~k mergers above. Use
  `rhymes()`, which adds them.
"""

import re
import unicodedata

from quality.phonology import Phonology, Syllable, Unsupported, register

# ---------------------------------------------------------------- inventory

VOWELS = set("aeiou")

#: Digraphs, longest first, each mapped to its canonical single unit. The
#: mapping is where "accepts both orthographies" happens for CONSONANTS, and
#: every entry here is notational: no phoneme changes, so it cannot touch a
#: rime's identity. `chh` and `bh` are Skeat's aspirate spellings.
DIGRAPHS = (
    ("chh", "c"),      # Chhari-chhari  = cari
    ("ch", "c"),       # chinchang      = cincang
    ("ng", "ng"),      # /ŋ/  -- the most frequent rhyme coda in the corpus
    ("ny", "ny"),      # /ɲ/
    ("sy", "sy"),      # modern /ʃ/
    ("sh", "sy"),      # Straits /ʃ/    Shurga = syurga
    ("kh", "kh"),
    ("gh", "gh"),
    ("bh", "b"),       # Bharu          = baru
)

#: The apostrophe is IN here: word-finally and after a vowel it is a glottal
#: stop, a segment of the language, not a diacritic.
CONSONANTS = set("bcdfghjklmnpqrstvwxyz'")

#: /ai/ /au/ /oi/ are diphthongs word-finally and hiatus elsewhere.
DIPHTHONGS = {"ai", "au", "oi"}

#: Markers of van Ophuijsen (Dutch) Malay. This module CANNOT read it -- `nj`
#: would be /ɲ/ there and n+dʒ here -- so their presence is reported rather
#: than silently absorbed. Notation is declared, never sniffed (commitment 1);
#: this is a tool for the caller, not a switch inside `syllabify`.
VAN_OPHUIJSEN = ("oe", "dj", "tj")

# ------------------------------------------------------- declared parameters
# Doctrine 58: a bare n-of-N is a coordinate of some setting. Every number the
# module thresholds on is named here, with what it means and where it came
# from. None of them was fitted to the corpus.

#: How many trailing syllables must agree for `rhymes()` to say True. 1 is the
#: traditional description of pantun end-rhyme -- the final syllable's rime.
#: The pantun ALSO shows whole-word and near-whole-word echo very often; that
#: is reported as a distribution by `echo_depth()` rather than folded into a
#: threshold here, because picking the number from the corpus would be tuning.
RIME_DEPTH = 1

#: What to do with Skeat's editorial parentheses -- "nyiris (nyirih)" is an
#: alternative reading, "sambar (ini)" a gloss, "berpauh (?) padi" a query.
#: "drop" treats them as the editor's, "keep" as the line's. This is NOT
#: cosmetic: it decides the end word of 2 of the 82 quatrains, so it changes
#: the reported ABAB rate. Default is the conservative reading; report both.
EDITORIAL_PARENTHESES = "drop"

#: The conventional pantun line length, in syllables. Declared for a caller to
#: apply; nothing in this module gates on it.
PANTUN_SYLLABLES = (8, 12)

# ------------------------------------------------------------- normalisation

_FOOTNOTE = re.compile(r"\[\s*\d+\s*\]")
_PARENTHETICAL = re.compile(r"\([^)]*\)")
_WORD = re.compile(r"[a-z'][a-z'-]*")


def normalise(text):
    """Fold the typographic variants that are not phonological distinctions.

    Fold by fold, and what each costs:

    1. **NFC.** Skeat's text is plain ASCII, but a caller's is not guaranteed
       to be, and a decomposed acute would otherwise fall out of inventory.
       Costs nothing.

    2. **U+2019 and its relatives -> ASCII "'".** Doctrine 26, and Malay needs
       it more than English did: the apostrophe here is a PHONEME (the hamzah
       in `pinta'`, `do'a`) and a morphological mark, and it sits inside words,
       so one printing house's glyph decides whether the word is readable at
       all. Folded: U+2019, U+2018, U+02BC, acute and BACKTICK. The backtick
       fold merges Skeat's `ayn (`adat, `Ijrail) into the hamzah glyph. Cost:
       the hamzah/`ayn distinction is lost. Malay does not use it
       contrastively, and every `ayn in this corpus is word-initial, where the
       mark is dropped anyway.

    3. **En/em/figure dash -> ASCII hyphen.** The hyphen is load-bearing in
       Malay orthography: it marks clitics (`mata-nya`, `di-jeput`) and
       reduplication (`arak-arak`), and a compositor's en dash is the same
       mark. Unlike `cym.py` there is no caesura in this form, so a dash is
       never structure — doctrine 55 in the easy direction.

    NOT folded here, deliberately, each with its reason:

    4. **`ei` -> `ai`** is positional (word-final only) so it belongs in
       `syllabify`, not in a text-wide replace that would rewrite `aleikum`.

    5. **The Straits final-closed-syllable `-o-`/`-e-`** is NOT modernised at
       any level. See the module docstring: modernising it would replace the
       surface form the rhyme is built on with an underlying form the language
       neutralises, which is doctrine 50 exactly.

    6. **`ka-`/`sa-` -> `ke-`/`se-`** is not folded. The pepet never occurs in
       a final syllable in Malay, so it cannot reach a rime; folding it would
       buy nothing and would assert a vowel this module cannot verify.

    7. **`oe`/`dj`/`tj`** are not folded. They are van Ophuijsen, a different
       orthography this module does not read. See `detect_orthography`.
    """
    t = unicodedata.normalize("NFC", str(text))
    for bad in "’‘ʼ´`′":
        t = t.replace(bad, "'")
    for dash in ("—", "–", "‒", "−"):
        t = t.replace(dash, "-")
    return t


#: Markers, chosen so that neither pattern can fire on the other's text.
#: `ch` is Straits and cannot be modern; a bare `c` BEFORE A VOWEL is modern
#: and cannot be Straits, because Straits always writes the digraph.
_STRAITS = "|".join((r"ch", r"\bangkau\b", r"\bka-", r"\bsa-", r"\bdi-",
                     r"\bbh", r"sh[aeiou]", r"[aeiou]'(?![a-z])"))
_MODERN = "|".join((r"\bc[aeiou]", r"sy[aeiou]", r"\bengkau\b"))


def detect_orthography(text):
    """-> a set of the orthographic systems whose MARKERS are present.

    Not a classifier and not a switch: a report. `{"straits"}` and
    `{"modern"}` are both readable by this module; anything containing
    `"van_ophuijsen"` is NOT, and a caller that proceeds anyway will get
    silently wrong syllables (`nj` read as n+dʒ where the text means /ɲ/).
    An empty set means the text carries no marker either way, which is common
    for short input and is not evidence of anything.
    """
    t = normalise(text).lower()
    seen = set()
    if any(m in t for m in VAN_OPHUIJSEN):
        seen.add("van_ophuijsen")
    if re.search(_STRAITS, t):
        seen.add("straits")
    if re.search(_MODERN, t):
        seen.add("modern")
    return seen


# ------------------------------------------------------------ word -> units

def _merge_vowelless(parts):
    """A part with NO VOWEL is not a word; merge it into the part that FOLLOWS.

    This is the M-3 fix and its whole argument is in the module docstring. A
    Malay syllable needs a nucleus, so a vowelless fragment is never a
    phonological word — it is the ONSET the syncope stranded (`s'ri` -> s + ri)
    or a proclitic (`-'l-` in the Arabic invocations). Both attach rightwards,
    so the merge is forward.

    Two cases are deliberately NOT merged, and each is a refusal that stands:

    * a vowelless part with nothing after it stays as its own part and refuses
      as `vowelless_token`. `hi-r-rahm` is a macron-truncated fragment of the
      basmala, not a word, and inventing a syllable for it would be a guess.
    * a whole token with no vowel (`b`, `d`, `s` — the `d. s. b.` refrain stub)
      has no following part to merge into and refuses the same way. That is the
      correct verdict here: the fix belongs in the tokenizer that produced the
      letter, and `unreadable_reason` says so by code.
    """
    if len(parts) < 2:
        return parts
    out, carry = [], ""
    for p in parts:
        if not any(c in VOWELS for c in p):
            carry += p
            continue
        out.append(carry + p)
        carry = ""
    if carry:
        out.append(carry)                 # trailing: left to refuse, not merged
    return out


def _split_word(w):
    """Split a written word on the marks that record DELETED material.

    The hyphen (clitic or reduplication), a word-initial apostrophe (apheresis)
    and a word-medial apostrophe after a CONSONANT (syncope) all mark something
    that is not there. An apostrophe after a VOWEL is left in place: that one
    is a glottal stop and belongs to the phonology.

    The hyphen is cut FIRST, which is why the fifth apostrophe position —
    after a hyphen, `darah-'kau`, `hati-'ku` — has always been read correctly
    even though doctrine 65 names only four. See `apostrophe_positions`.

    The syncope split is then repaired by `_merge_vowelless`: it is a boundary
    only where the left half is a word, and `s'ri` is not `s` + `ri`.
    """
    parts = []
    for chunk in w.split("-"):
        chunk = chunk.strip().lstrip("'")     # apheresis: 'ku < aku
        if not chunk:
            continue
        cur, out = "", []
        for ch in chunk:
            if ch == "'" and cur and cur[-1] not in VOWELS:
                out.append(cur)               # syncope: anak'nda < anakanda
                cur = ""
            else:
                cur += ch
        out.append(cur)
        parts.extend(p for p in out if p)
    return _merge_vowelless(parts)


def units(word):
    """-> list of phoneme units for ONE hyphen-free part, digraphs kept whole.
    None if any character is out of inventory. Public because a caller
    checking the digraph claim should be able to see it directly."""
    out, i = [], 0
    w = word.lower()
    while i < len(w):
        for src, unit in DIGRAPHS:
            if w.startswith(src, i):
                out.append(unit)
                i += len(src)
                break
        else:
            c = w[i]
            if c in VOWELS or c in CONSONANTS:
                out.append(c)
                i += 1
            else:
                return None
    return out


def _with_coda(s, coda):
    return Syllable(s.text + "".join(coda), s.onset, s.nucleus, coda,
                    None, s.moras)


def _syllabify_part(p):
    """-> list of Syllable, or None if out of inventory or out of shape."""
    return _parse_part(p)[0]


def _parse_part(p):
    """-> (list of Syllable, None) or (None, reason code).

    The reason is the whole point: doctrine 88 says a refusal rate is
    uninterpretable until an ingestion defect and a correct refusal are told
    apart, and this is where the two are distinguished. Codes are the keys of
    `UNREADABLE_REASONS`.
    """
    # Straits `ei` is /ai/ word-finally (bunglei=bunglai, selesei=selesai).
    # Positional, so it is applied here and not in normalise(): `aleikum` must
    # not be rewritten.
    if p.endswith("ei"):
        p = p[:-2] + "ai"
    u = units(p)
    if u is None:
        return None, "out_of_inventory"
    if not u:
        return None, "empty"

    # 1. runs of vowels and runs of consonants; a vowel run becomes nuclei,
    #    and only the last two vowels of a WORD-FINAL run may be a diphthong.
    seq, i = [], 0
    while i < len(u):
        if u[i] in VOWELS:
            run = []
            while i < len(u) and u[i] in VOWELS:
                run.append(u[i])
                i += 1
            final = (i == len(u))
            j = 0
            while j < len(run):
                if (final and j == len(run) - 2
                        and run[j] + run[j + 1] in DIPHTHONGS):
                    seq.append(("V", run[j] + run[j + 1]))
                    j += 2
                else:
                    seq.append(("V", run[j]))
                    j += 1
        else:
            run = []
            while i < len(u) and u[i] not in VOWELS:
                run.append(u[i])
                i += 1
            seq.append(("C", run))

    # 2. assemble. A medial consonant run gives its LAST unit to the next
    #    onset and the rest to the previous coda; Malay allows exactly one
    #    coda, so anything more is out of shape and refuses.
    sylls, onset, last = [], (), len(seq) - 1
    for k, (kind, val) in enumerate(seq):
        if kind == "V":
            sylls.append(Syllable("".join(onset) + val, onset, val, (),
                                  None, 1))
            onset = ()
            continue
        if not sylls:
            onset = tuple(val)          # word-initial cluster: kept whole
        elif k == last:
            if len(val) > 1:
                return None, "complex_coda"     # the rime is at risk
            sylls[-1] = _with_coda(sylls[-1], tuple(val))
        elif len(val) == 1:
            onset = (val[0],)
        elif len(val) == 2:
            sylls[-1] = _with_coda(sylls[-1], (val[0],))
            onset = (val[1],)
        else:
            # three or more medial consonants: one coda + a complex onset is
            # not a Malay shape. `indra`, `anggrek`, `chandrawasi`, `mentri`
            # are ndr/nggr loans and refusing them is BY DESIGN.
            return None, "complex_medial"
    if not sylls:
        return None, "vowelless_token"
    return sylls, None


# --------------------------------------- WHY a token is unreadable, by code
# Doctrine 88: "nothing currently tells an ingestion defect from a correct
# refusal, which is doctrine 79's error in a second layer -- a refusal rate is
# uninterpretable until its two causes are separated." This is that separation,
# as a table rather than as prose, so a caller can compute the split.

#: code -> (layer that OWNS the defect, is it a defect at all, one-line reason)
UNREADABLE_REASONS = {
    "out_of_inventory": (
        "notation", False,
        "a character outside the declared Straits-Rumi alphabet. Notation is "
        "declared, never sniffed (phonology commitment 1), so this is a "
        "correct refusal and not a miss."),
    "empty": (
        "ingestion", True,
        "nothing left after print punctuation was stripped. The token was "
        "never a word; whatever produced it is upstream."),
    "vowelless_token": (
        "ingestion", True,
        "no vowel anywhere in the token, so it has no nucleus and is not a "
        "Malay word. In this corpus these are `b`/`d`/`s` from the `d. s. b.` "
        "refrain stub and macron-truncated fragments of the Arabic basmala. "
        "Owned by the tokenizer, NOT by this module."),
    "complex_coda": (
        "phonology", False,
        "a word-final consonant run of more than one unit. Native Malay has "
        "no complex coda and THE CODA IS THE RIME, so a guess here would "
        "corrupt the one thing this module reports. Correct refusal."),
    "complex_medial": (
        "phonology", False,
        "three or more medial consonants, which cannot be split into one coda "
        "plus one onset. `indra`, `anggrek`, `chandrawasi`, `mentri` are "
        "ndr/nggr loans. Correct refusal."),
}


def unreadable_reason(word):
    """-> None if the word is readable, else a dict naming WHY.

    Keys: `code` (a key of UNREADABLE_REASONS), `part` (the offending piece
    after `_split_word`), `layer`, `is_defect`, `explanation`. The first
    offending part wins, because one unreadable part refuses the whole word.
    """
    w = normalise(word).lower().strip()
    w = w.strip('".,;:!?()[]«»“”').strip("-")
    parts = _split_word(w)
    if not parts:
        layer, defect, why = UNREADABLE_REASONS["empty"]
        return {"code": "empty", "part": "", "layer": layer,
                "is_defect": defect, "explanation": why}
    for p in parts:
        sylls, code = _parse_part(p)
        if sylls is None:
            layer, defect, why = UNREADABLE_REASONS[code]
            return {"code": code, "part": p, "layer": layer,
                    "is_defect": defect, "explanation": why}
    return None


def readability_census(tokens):
    """-> the THREE counts doctrine 79 demands, never two, plus the split.

    `read` + `refused` + `defective` = `total`. `refused` is the module
    declining on its declared shape or notation, which is a result; `defective`
    is an ingestion miss, which is a bug in some layer and is named by layer.
    Collapsing the two is exactly what charged this module for the `d. s. b.`
    refrain stub (see the module docstring).
    """
    out = {"total": 0, "read": 0, "refused": 0, "defective": 0,
           "by_code": {}, "by_layer": {}}
    for t in tokens:
        out["total"] += 1
        r = unreadable_reason(t)
        if r is None:
            out["read"] += 1
            continue
        out["by_code"][r["code"]] = out["by_code"].get(r["code"], 0) + 1
        out["by_layer"][r["layer"]] = out["by_layer"].get(r["layer"], 0) + 1
        if r["is_defect"]:
            out["defective"] += 1
        else:
            out["refused"] += 1
    return out


# ------------------------------------------- the apostrophe's FIVE positions
# Doctrine 65 names four. There are five: the fifth is AFTER A HYPHEN, and this
# module reads it correctly because `_split_word` cuts the hyphen first. The
# defect was in the description, so the remedy is an enumeration a caller can
# run rather than a sentence a caller has to trust.

APOSTROPHE_POSITIONS = (
    ("final", "word-final: HAMZAH /ʔ/, a real coda that ENTERS THE RIME "
              "(pinta', ta', dato'). Modern orthography writes it `k`."),
    ("after_vowel", "medial after a vowel: the same /ʔ/ — coda before a "
                    "consonant (ta'tabek), onset before a vowel (do'a)."),
    ("initial", "word-initial: APHERESIS, a deleted leading syllable "
                "('ku < aku, 'nak < hendak). Nothing is pronounced."),
    ("after_consonant", "medial after a consonant: SYNCOPE of a deleted vowel "
                        "(anak'nda, s'ri). A boundary only where the left "
                        "half is itself a word — see _merge_vowelless."),
    ("after_hyphen", "immediately after a hyphen: apheresis again, at a "
                     "compound/clitic seam (darah-'kau, munchong-'kau, "
                     "hati-'ku, mata-'kau). THE FIFTH POSITION, missing from "
                     "doctrine 65 and handled correctly here since day one."),
)


def apostrophe_positions(word):
    """-> [(index, position_name), ...] for every apostrophe in the word.

    Classification is on the RAW written form, before any split, so it can be
    checked against the printing. Every mark gets a name; there is no
    `unclassified` bucket, which is the point.
    """
    w = normalise(word).lower()
    out = []
    for i, ch in enumerate(w):
        if ch != "'":
            continue
        prev = w[i - 1] if i else ""
        if i == len(w) - 1 or not w[i + 1].isalpha():
            out.append((i, "final"))
        elif not prev:
            out.append((i, "initial"))
        elif prev == "-":
            out.append((i, "after_hyphen"))
        elif prev in VOWELS:
            out.append((i, "after_vowel"))
        else:
            out.append((i, "after_consonant"))
    return out


# ------------------------------------------------------------- the phonology

class Malay(Phonology):
    language = "msa"
    name = "Malay"
    notation = ("pre-1972 British-Malayan (Straits/Wilkinson) Rumi as printed "
                "by Skeat 1900, read NATIVELY: the final-closed-syllable "
                "-o-/-e- is the surface allophone of /u/,/i/ and is NOT "
                "modernised. Modern Ejaan Rumi Baharu is accepted through "
                "notational consonant folds only (c/ch/chh, sy/sh, b/bh); "
                "where the two orthographies differ INSIDE the rime "
                "(burong~burung, adek~adik, dato'~dudok) rhymes() returns "
                "None. van Ophuijsen (oe/dj/tj) is NOT read -- see "
                "detect_orthography")
    grid_unit = "syllable"
    prominence_rule = ("NONE — Malay stress is contested (penultimate on the "
                       "usual description, absent as a lexical property on "
                       "many analyses) and the pantun is a SYLLABLE-COUNT "
                       "form, not a stress metre. prominence is left None "
                       "rather than faked and prominences() refuses.")
    relation = ("pantun ABAB end-rhyme: lines 1&3 and 2&4 agree on the final "
                "syllable's rime (nucleus+coda), across the deliberate "
                "pembayang/maksud meaning discontinuity")
    source = "rules only; no external resource, so nothing to licence"

    # -------------------------------------------------------------- segments

    def syllabify(self, word):
        # Strip surrounding print punctuation but NEVER the apostrophe: a
        # trailing `'` is the hamzah (`pinta'`, `ta'`), a segment of the word,
        # and stripping it would silently delete a coda from the rime.
        w = normalise(word).lower().strip()
        w = w.strip('".,;:!?()[]«»“”').strip("-")
        parts = _split_word(w)
        if not parts:
            return []
        out = []
        for p in parts:
            s = _syllabify_part(p)
            if s is None:
                return []          # one unreadable part refuses the whole word
            out.extend(s)
        return out

    def prominences(self, word):
        raise Unsupported(
            "Malay has no stress binary this grid can use: stress is "
            "contested (penultimate at best, absent as a lexical property on "
            "many analyses), the language is syllable-timed, and the pantun "
            "counts SYLLABLES per line rather than beats. Use "
            "grid_unit='syllable' and len(syllabify(w)). Returning a "
            "plausible penultimate pattern would be a number nobody could "
            "have caught.")

    # ----------------------------------------------------------- the relation

    def _rime_verdict(self, sa, sb):
        """-> True / False / None for one aligned pair of syllables."""
        ka, kb = (sa.nucleus, sa.coda), (sb.nucleus, sb.coda)
        if ka == kb:
            return True
        na, ca = ka
        nb, cb = kb
        # The two orthographies write one sound two ways, IN THE RIME. Cannot
        # tell whether this is one word twice or two words once.
        if ca == cb and ca:
            if {na, nb} in ({"o", "u"}, {"e", "i"}):
                return None
        if na == nb and {ca, cb} == {("'",), ("k",)}:
            # Straits writes the final glottal stop both ways: dato' / dudok.
            return None
        return False

    def rhymes(self, a, b, depth=RIME_DEPTH):
        """-> True / False / None over the final `depth` syllables' rimes."""
        sa, sb = self.syllabify(a), self.syllabify(b)
        if len(sa) < depth or len(sb) < depth:
            return None
        verdicts = [self._rime_verdict(sa[-i], sb[-i])
                    for i in range(1, depth + 1)]
        if False in verdicts:
            return False           # one definite mismatch settles it
        if None in verdicts:
            return None
        return True

    def echo_depth(self, a, b):
        """-> how many trailing syllables match WHOLE (onset included).

        The pantun's end-rhyme is often a whole-word or near-whole-word echo.
        That is reported as a count so a caller can see the distribution and
        set its own threshold, rather than being folded into a number picked
        here. None if either word is unreadable.
        """
        sa, sb = self.syllabify(a), self.syllabify(b)
        if not sa or not sb:
            return None
        n = 0
        for i in range(1, min(len(sa), len(sb)) + 1):
            x, y = sa[-i], sb[-i]
            if (x.onset, x.nucleus, x.coda) != (y.onset, y.nucleus, y.coda):
                break
            n += 1
        return n

    def relation_type(self, a, b):
        """-> REPEAT / RIME_RICHE / RHYME / NONE / None.

        Doctrine 3: identity is not rhyme, and in this corpus the distinction
        is not academic — pantun lines 1 and 3 are frequently the same line.
        A caller measuring "does the ABAB hold" and a caller measuring "is
        there rhyme here" need different answers.
        """
        r = self.rhymes(a, b)
        if r is None:
            return None
        if not r:
            return "NONE"
        sa, sb = self.syllabify(a), self.syllabify(b)
        # Compare the CANONICAL syllables, not the raw strings: `pechah` and
        # `pecah` are one word in two spellings and must not be reported as
        # two words that happen to sound alike.
        if [s.text for s in sa] == [s.text for s in sb]:
            return "REPEAT"
        x, y = sa[-1], sb[-1]
        if (x.onset, x.nucleus, x.coda) == (y.onset, y.nucleus, y.coda):
            return "RIME_RICHE"
        return "RHYME"

    def alliterates(self, a, b):
        """-> True / False / None on the first phoneme unit.

        DECLARED: the pantun mandates NO alliteration. This is implemented
        because the interface asks for it and it is well defined, not because
        a verdict here is evidence about the form. The unit compared is the
        first of the word AS WRITTEN, prefix included (`di-jeput` alliterates
        on d, not j).
        """
        sa, sb = self.syllabify(a), self.syllabify(b)
        if not sa or not sb:
            return None
        ha = sa[0].onset[0] if sa[0].onset else ""
        hb = sb[0].onset[0] if sb[0].onset else ""
        return ha == hb

    # ------------------------------------------------------------- the form

    def end_word(self, line, editorial_parentheses=EDITORIAL_PARENTHESES):
        """-> the rhyme-bearing last word of a printed line, or None.

        Three editorial layers in Skeat's printing, each handled explicitly
        rather than by one blanket strip:

        * `[813]` — a FOOTNOTE MARKER. Dropped. Leaving it in makes the end
          word a number and the line unreadable, which would silently delete
          quatrains.
        * `[kampong]`, `[Si Anu]`, `[Di-]tampi` — the editor's BRACKETS around
          the poet's words, including the rhyme word itself. Kept.
        * `(nyirih)`, `(ini)`, `(?)` — editorial glosses and queries.
          Controlled by `editorial_parentheses`, which is a declared parameter
          because it changes the answer. See EDITORIAL_PARENTHESES.
        """
        t = normalise(line)
        t = _FOOTNOTE.sub(" ", t)
        if editorial_parentheses == "drop":
            t = _PARENTHETICAL.sub(" ", t)
        else:
            t = t.replace("(", " ").replace(")", " ")
        t = t.replace("[", " ").replace("]", " ")
        toks = [w for w in _WORD.findall(t.lower())
                if any(c.isalpha() for c in w)]
        if not toks:
            return None
        return toks[-1].strip("-")

    def line_syllables(self, line,
                       editorial_parentheses=EDITORIAL_PARENTHESES):
        """-> syllable count for a printed line, or None if any word is
        unreadable. The pantun's grid is this number; PANTUN_SYLLABLES
        declares the conventional band and nothing here gates on it."""
        t = normalise(line)
        t = _FOOTNOTE.sub(" ", t)
        if editorial_parentheses == "drop":
            t = _PARENTHETICAL.sub(" ", t)
        t = t.replace("[", " ").replace("]", " ").replace("(", " ")
        t = t.replace(")", " ")
        total = 0
        for w in _WORD.findall(t.lower()):
            if not any(c.isalpha() for c in w):
                continue
            s = self.syllabify(w)
            if not s:
                return None
            total += len(s)
        return total or None

    def abab(self, lines, editorial_parentheses=EDITORIAL_PARENTHESES):
        """-> the ABAB pairing of a pantun quatrain, and the halves.

        The pairing is (line 1, line 3) and (line 2, line 4) — 0-indexed
        (0, 2) and (1, 3). `pembayang` and `maksud` are exposed because this
        corpus is the only one here that carries rhyme across a deliberate
        MEANING discontinuity (Skeat fn.[431]), and a later cell may want to
        measure that.

        **No semantic measurement is made or attempted here.** The split is
        handed over as text; anything more needs resources this module does
        not have, and inventing one would be a claim about meaning dressed as
        a phonology result.

        `confirmed` is True only if BOTH pairs rhyme, False if either pair
        definitely does not, and None if neither is False and at least one is
        undecidable — the tri-state propagates rather than collapsing.
        """
        if len(lines) != 4:
            return None
        ends = [self.end_word(ln, editorial_parentheses) for ln in lines]
        pairs = []
        for i, j, tag in ((0, 2, "A"), (1, 3, "B")):
            wa, wb = ends[i], ends[j]
            v = None if (wa is None or wb is None) else self.rhymes(wa, wb)
            pairs.append({"tag": tag, "lines": (i, j), "words": (wa, wb),
                          "rhymes": v,
                          "relation": None if (wa is None or wb is None)
                          else self.relation_type(wa, wb),
                          "echo": None if (wa is None or wb is None)
                          else self.echo_depth(wa, wb)})
        vs = [p["rhymes"] for p in pairs]
        confirmed = False if False in vs else (None if None in vs else True)
        return {"pembayang": list(lines[:2]), "maksud": list(lines[2:]),
                "pairs": pairs, "confirmed": confirmed,
                "syllables": [self.line_syllables(ln, editorial_parentheses)
                              for ln in lines]}

    def merger_refusal_rate(self, pairs):
        """-> (n_refused, n_total). What reading two orthographies costs.

        `fas.py` reports that it refuses 60.2% of real Hafez pairs on script
        and leaves the number standing. The same accounting belongs here: the
        o~u / e~i / '~k refusals are the designed outcome of reading a merged
        orthography honestly, and their rate is the price. Pairs whose words
        are simply unreadable are counted in the denominator, not the
        numerator — doctrine 27, a draw that fails the filter belongs there.
        """
        refused = 0
        for a, b in pairs:
            sa, sb = self.syllabify(a), self.syllabify(b)
            if sa and sb and self.rhymes(a, b) is None:
                refused += 1
        return refused, len(pairs)


register(Malay())
