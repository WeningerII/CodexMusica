#!/usr/bin/env python3
"""Persian — the ghazal's **radif** and **qāfiya**. Two halves, and confusing
them would produce a corpus-wide result that looks clean and is fiction.

WHAT THE FORM MANDATES

A ghazal binds every rhyming hemistich with two stacked devices:

  radif   a word or phrase repeated VERBATIM at the end of every rhyming line
  qāfiya  the true rhyme, sitting immediately BEFORE the radif

The rhyming lines are both hemistichs of the maṭlaʿ and then the second
hemistich of every bayt — `ghazal_rhyme_lines()` applies that convention.

WHY THIS MODULE IS HALF CHEAP AND HALF IMPOSSIBLE

Unvocalised Perso-Arabic orthography **does not write the short vowels**
/a e o/. Everything else that matters is written: the consonants, and the long
vowels ā ī ū as the māters ا و ی. So:

  radif   SOUND. It is exact string identity over normalised orthography and
          needs no vowel at all. Implemented properly, thresholds and all.
  qāfiya  PARTLY RECOVERABLE. The consonant skeleton and the long vowels are
          on the page; the short vowels are not.
  rhyme   NOT DECIDABLE on short vowels. دل /del/ and گل /gol/ have identical
          written skeletons and do not rhyme. `rhymes()` returns **None**
          there — not False, and certainly not True.

`None` is the EXPECTED and FREQUENT answer from `rhymes()`, not an error path.
A module that silently supplied the short vowels — by a lexicon it does not
have, or by taking the commonest reading — would return True on دل/گل and
would report a corpus-wide qāfiya agreement that is an artefact of the guess
and not a fact about Hafez. That is the failure this module exists to refuse.
The unknown is propagated, never collapsed.

  WARNING, and it is a real trap: `Syllable.key()` is inherited from the
  interface and returns `(nucleus, coda)`. Two syllables with unknown nuclei
  both carry `nucleus is None`, so `key()` compares them EQUAL. `rhymes()`
  below therefore does not use `key()`. A caller that does will manufacture
  exactly the false positives this module refuses to make.

VOWEL KNOWLEDGE IS A SET, NOT A VALUE

Each nucleus is a set of phonemes the orthography permits, and the verdict
falls out of set algebra rather than from a guess:

  ا آ  {ā}         written, long, unambiguous
  و    {u, ow}     written, long/diphthong — ruz vs now, no orthographic signal
  ی    {i, ey}     written, long/diphthong — šir vs xeyr, likewise
  ه    {e}         word-final heh after a consonant: the ONE short vowel
                   Persian writes
  —    {a, e, o}   not written at all

  disjoint sets              -> False   (a long ā can never be a short vowel)
  equal singletons           -> True
  anything else (overlap)    -> None

So کار/یار is a confident **True** (both {ā} before the same rawī), کار/در is
a confident **False** ({ā} against {a,e,o}), and دل/گل is **None**. The module
can say a great deal; it just cannot say the one thing the text withholds.

PROMINENCE IS REFUSED. WEIGHT IS NOT.

Following `som.py`'s precedent, and for two independent reasons:

1. Classical Persian metre (ʿarūż) is **quantitative**. What the metre
   constrains is syllable WEIGHT — light CV (1 mora), heavy CVC/CVV (2),
   overlong CVCC/CVVC (3) — not stress. Modern Persian does have regular
   word-final stress (with the familiar exceptions: enclitics, the ezāfe,
   verbal prefixes مى/ب, vocatives, the negative نـ), but that stress is not
   the grid the form is written on, and a caller handed a stress pattern would
   index the wrong coordinate and never know.
2. Even if stress were the right grid, it could not be laid down here: stress
   is assigned per syllable, and the SYLLABLE COUNT of an unvocalised Persian
   word is frequently not recoverable. مشکل is four consonant letters with no
   written vowel and three phonotactically legal parses. You cannot number the
   positions of a grid whose length you do not know.

So `grid_unit = "mora"`, every `Syllable.prominence` stays None, and
`prominences()` raises `Unsupported`. Weight, by contrast, IS recoverable even
where vowel identity is not: the ABSENCE of a māter is itself the information
that the vowel is short. That asymmetry is the whole reason `moras` carries
the grid and `prominence` carries nothing.

Related, and declared rather than fixed: a function-word list is part of a
phonology (the enclitic conjunction و /o~va/, the ezāfe -e, را, the proclitic
prepositions). This module carries only the minimum needed to READ the text,
because it supplies no stress grid for such a list to correct. Anyone who
later supplies one must build the list first.

WHAT THE ORTHOGRAPHY DOES TO THE CONSTRAINT

Two costs, both named because they are silent:

- Removing the **shadda** removes gemination, which is phonemic in Persian and
  changes syllable weight (moʿallem). `normalise()` strips it, so `moras` can
  under-count where a source vocalises. The Hafez corpus carries zero ḥarakāt,
  so nothing is lost THERE — but a vocalised source would lose it silently.
- The corpus writes the same morphology sometimes joined and sometimes spaced
  (ناولها joined, مشکل ها spaced, in the SAME ghazal), and never with ZWNJ.
  A token-level radif therefore misses lines where the enclitic is joined.
  That is reported, not patched.

TWO LIMITS MEASURED AGAINST HAFEZ AND LEFT STANDING

Both surfaced from reading the `False` tail of the corpus run rather than its
summary, and both are consequences of declared decisions, so they are named
here instead of being tuned away.

- **Molammaʿ.** Nine of Hafez's macaronic Arabic-Persian ghazals rhyme an
  Arabic hemistich against a Persian one: بالعراق /bi-l-ʿirāqi/ against
  اشتیاقی, السلطان /as-sulṭāni/ against ایلخانی, قبس /qabasi/ against نفسی.
  They rhyme on the Arabic iʿrāb case vowel, which Arabic does not write and
  Persian does not have. Read as Persian — which is all this module can do,
  having refused on script rather than language — those words end in a
  consonant and `rhymes()` returns **False**. That accounts for essentially
  all of the 204 False verdicts the corpus produces, across 15 of 495 ghazals.
- **الله.** Written with no ا at all, its /ā/ carried by a dagger alef that
  this corpus does not print. `normalise()` folds U+0670 to ا where a source
  supplies it, but where the source omits it there is nothing to fold and
  الله/ماه comes back False. A missing long vowel is a worse loss than a
  missing short one, because a long vowel is the thing the module can normally
  be certain about.
"""

import unicodedata

from quality.phonology import Phonology, Syllable, Unsupported, register

# ---------------------------------------------------------------------------
# NORMALISATION — the single most load-bearing function in the module.
#
# Arabic-script Persian has several near-identical codepoints that silently
# break string equality, and radif detection IS string equality. This is the
# same class of defect as the U+2019 apostrophe bug that flipped two of this
# project's registered verdicts (doctrine 26), so every fold is spelled out
# codepoint by codepoint rather than left to a library.
# ---------------------------------------------------------------------------

#: Letter folds, applied after Unicode NFKC. Each maps a codepoint that LOOKS
#: like a Persian letter (or is its Arabic twin) onto the single Persian form.
FOLDS = {
    "ي": "ی",   # ARABIC YEH        ي -> FARSI YEH ی
    "ى": "ی",   # ALEF MAKSURA      ى -> FARSI YEH ی
    "ے": "ی",   # YEH BARREE (Urdu) ے -> FARSI YEH ی
    "ې": "ی",   # E (Kurdish/Urdu)  ې -> FARSI YEH ی
    "ئ": "ی",   # YEH WITH HAMZA    ئ -> FARSI YEH ی
    "ك": "ک",   # ARABIC KAF        ك -> KEHEH ک
    "ڪ": "ک",   # SWASH KAF         ڪ -> KEHEH ک
    "أ": "ا",   # ALEF WITH HAMZA ABOVE  أ -> ALEF ا
    "إ": "ا",   # ALEF WITH HAMZA BELOW  إ -> ALEF ا
    "ٱ": "ا",   # ALEF WASLA        ٱ -> ALEF ا
    "ؤ": "و",   # WAW WITH HAMZA    ؤ -> WAW و
    "ٰ": "ا",   # SUPERSCRIPT ALEF U+0670 -> ALEF ا. NOT a deletion: the dagger
                # alef is a LONG ā that no base letter records (الله, هٰذا), so
                # dropping it with the ḥarakāt would destroy a long vowel and
                # not merely a short one. See the الله note in `rhymes`.
    "ة": "ه",   # TEH MARBUTA       ة -> HEH ه   (Persian practice)
    "ۀ": "ه",   # HEH WITH YEH ABOVE ۀ -> HEH ه  (ezāfe clitic dropped)
    "ہ": "ه",   # HEH GOAL (Urdu)   ہ -> HEH ه
    "ۂ": "ه",   # HEH GOAL + HAMZA  ۂ -> HEH ه
    "ھ": "ه",   # HEH DOACHASHMEE   ھ -> HEH ه
    "٠": "0", "١": "1", "٢": "2", "٣": "3",
    "٤": "4", "٥": "5", "٦": "6", "٧": "7",
    "٨": "8", "٩": "9",                       # Arabic-Indic digits
    "۰": "0", "۱": "1", "۲": "2", "۳": "3",
    "۴": "4", "۵": "5", "۶": "6", "۷": "7",
    "۸": "8", "۹": "9",                       # Extended Arabic-Indic
}

#: Deleted outright. The ḥarakāt are optional and absent from most Persian
#: text; keeping them would make the same word compare unequal to itself.
#: SHADDA is in here and its removal has a named cost — see the docstring.
DELETE = (
    "".join(chr(c) for c in range(0x064B, 0x0660))   # ḥarakāt incl. shadda
    + "".join(chr(c) for c in range(0x06D6, 0x06EE))  # Quranic annotation
    + "ـ"      # TATWEEL / kashida — typographic stretch, not a letter
    + "ء"      # bare HAMZA ء — Persian normalisation drops it
    + "‍"      # ZERO WIDTH JOINER
    + "​‎‏⁠﻿­"   # zero-width / bidi / BOM / SHY
)

#: ZWNJ becomes a SPACE, not nothing. It is an orthographic word boundary with
#: morphological status (می‌رود, کتاب‌ها), and the Hafez corpus writes exactly
#: those junctures with a real space (می دارد, مشکل ها) and never with ZWNJ.
#: Mapping it to space makes ZWNJ text tokenise the way this corpus already
#: does. The alternative — deleting it, so می‌رود becomes میرود — would make
#: ZWNJ text disagree with the corpus instead of agreeing with it.
TO_SPACE = "‌         " \
           "     　\t\r\n"

#: Punctuation folded to a space so a trailing mark cannot split a radif.
PUNCT = "،؛؟۔٪٫٬٭«»" \
        "‹›‐‑‒–—―‘’" \
        "“”…" + r"""!"#$%&'()*+,-./:;<=>?@[\]^_`{|}~"""

#: The declared Persian letter inventory: 32 letters plus آ.
#:
#: ث ذ ض ظ (and ص ط ع ح ق) are ARABIC-ONLY IN ORIGIN and are kept. They are
#: attested in Hafez 153 / 306 / 272 / 757 times respectively, all in Arabic
#: loanwords, all pronounced as native Persian phonemes (ث -> /s/, ذ ض ظ ->
#: /z/). Refusing them would refuse Hafez. The consequence is declared rather
#: than hidden: THIS MODULE REFUSES ON SCRIPT, NOT ON LANGUAGE. Arabic written
#: in Arabic script passes the gate, because Persian uses every Arabic letter
#: and telling the two languages apart needs a lexicon this module does not
#: have. That is not a corner case here — ghazal 1 ends on a hemistich Hafez
#: wrote in Arabic (متی ما تلق من تهوی دع الدنیا و اهملها), so a module that
#: refused Arabic would refuse a line of Hafez.
CONSONANT_LETTERS = set("بپتثجچحخدذرزژسشصضطظعغفقکگلمن")
MATER_LETTERS = set("اآوی")
HEH = "ه"
INVENTORY = CONSONANT_LETTERS | MATER_LETTERS | {HEH}

#: What each written nucleus can be. The verdict in `rhymes()` is set algebra
#: over these, which is why an unknown propagates instead of collapsing.
VOWEL_SETS = {
    "ā": frozenset({"ā"}),
    "u|ow": frozenset({"u", "ow"}),
    "i|ey": frozenset({"i", "ey"}),
    "e": frozenset({"e"}),
    None: frozenset({"a", "e", "o"}),      # not written: identity unrecoverable
}
#: Nuclei that are phonologically short (one mora before the coda is counted).
SHORT_NUCLEI = (None, "e")

#: Word-initial ا آ ع are all read with a glottal onset, so they alliterate as
#: one class. Declared, not sniffed: ع is /ʔ/ in Persian (its classical
#: pharyngeal realisation is contested and is not modelled here).
GLOTTAL = "ʔ"

#: Single-letter clitic words, which the general rule cannot read because one
#: bare consonant is not a legal Persian word: the conjunction و /o ~ va/
#: (2,217 tokens in Hafez) and the reduced preposition ز /ze/ (753). Each is a
#: consonant plus a short vowel that the orthography does not write. Doctrine
#: 46: a function-word list is part of a phonology, not an optimisation —
#: without these two, 2,970 tokens of the corpus are silently unreadable.
CLITICS = {"و", "ز"}

_TRANSLATE = {ord(k): v for k, v in FOLDS.items()}
_TRANSLATE.update({ord(c): None for c in DELETE})
_TRANSLATE.update({ord(c): " " for c in TO_SPACE})
_TRANSLATE.update({ord(c): " " for c in PUNCT})


def normalise(text):
    """Fold Perso-Arabic text to one canonical form. Exported and documented
    because radif detection is exact string identity and every fold below is a
    pair of codepoints that would otherwise compare unequal while looking
    identical on screen.

    In order:

    1. Unicode **NFKC**. Folds the Arabic Presentation Forms (U+FB50–U+FEFF,
       the isolated/initial/medial/final shapes that leak out of PDF and OCR)
       back onto their base letters, and recomposes آ.
    2. **Letter folds** (see FOLDS): ARABIC YEH U+064A, ALEF MAKSURA U+0649,
       YEH BARREE U+06D2, E U+06D0 and YEH-WITH-HAMZA U+0626 all become FARSI
       YEH U+06CC; ARABIC KAF U+0643 and SWASH KAF U+06AA become KEHEH U+06A9;
       أ إ ٱ become ا; ؤ becomes و; ة ۀ ہ ۂ ھ become ه; SUPERSCRIPT (dagger)
       ALEF U+0670 becomes ا, because it is a LONG vowel and not a ḥaraka;
       both Arabic-Indic digit blocks become ASCII.
    3. **Deletions** (see DELETE): all ḥarakāt U+064B–U+065F — fatḥa, kasra,
       ḍamma, tanwīn, SHADDA, sukūn — plus Quranic marks U+06D6–U+06ED,
       tatwīl U+0640, bare hamza U+0621, ZWJ U+200D, and the zero-width /
       bidi / BOM / soft-hyphen family.
    4. **ZWNJ U+200C becomes a SPACE**, along with NBSP and the other Unicode
       spaces. See the TO_SPACE note for why space and not deletion.
    5. **Punctuation becomes a space**, so a trailing ، or . cannot make one
       radif token look like two different ones.
    6. Whitespace runs collapse to one U+0020, and the result is stripped.

    What it does NOT do: it does not add vowels, guess a reading, or decide
    what language the text is in.
    """
    if not isinstance(text, str):
        return ""
    out = unicodedata.normalize("NFKC", text).translate(_TRANSLATE)
    return " ".join(out.split())


def tokens(text):
    """-> list of whitespace-separated tokens of `normalise(text)`."""
    n = normalise(text)
    return n.split() if n else []


def in_inventory(token):
    """-> True when every character of the NORMALISED token is a declared
    Persian letter. This is a SCRIPT test, not a language test — see the
    INVENTORY note."""
    t = normalise(token)
    return bool(t) and all(c in INVENTORY for c in t)


def ghazal_rhyme_lines(hemistichs):
    """-> the hemistichs a ghazal rhymes on: both halves of the maṭlaʿ, then
    the second half of every bayt. A convention of the form, applied here so
    that callers do not each re-invent it."""
    h = list(hemistichs)
    if len(h) < 2:
        return []
    return [h[0]] + h[1::2]


# ---------------------------------------------------------------------------
# READING: letters -> roles. The vowel POSITIONS come from declared rules; the
# vowel IDENTITIES stay sets. Where the rules genuinely fork, both branches are
# returned rather than one being picked.
# ---------------------------------------------------------------------------

def readings(word):
    """-> list of role-sequences, or None if the word is out of inventory.

    A role is ``("C", letter)`` or ``("V", label, written)`` where `label`
    indexes VOWEL_SETS (None = identity unrecoverable) and `written` says
    whether the orthography fixes the vowel's POSITION (it may fix the
    position while withholding the identity — that is what a word-initial ا
    does).

    The declared rules, and they are rules rather than a lexicon:

      ا  word-initial or after another vowel -> glottal onset + a short vowel
         of unknown identity; before و/ی word-initially -> glottal onset only,
         because ای and او spell one long vowel; elsewhere -> long ā
      آ  glottal onset + long ā when initial or after a vowel; long ā elsewhere
      و  the consonant /v/ when word-initial, when the preceding role is a
         VOWEL, or when the NEXT letter is ا/آ  (all three are DEDUCTIONS)
      ی  the consonant /j/ under the same three conditions
      everything else -> its consonant

    The "next letter is ا/آ" clause is a deduction, not a preference: a long ā
    needs an onset and Persian has no onset cluster, so the māter in front of
    it can only be the glide. Without it بیا /biyā/, روان /ravān/ and خیال
    /xiyāl/ have no legal parse at all — 405 word types and 2,239 tokens of
    Hafez, silently unreadable.

    THREE DECLARED FORKS, kept as branches instead of being resolved. Each was
    a GUESS in the first draft of this module and each guess produced wrong
    answers on real Hafez rhyme pairs — not refusals, wrong answers:

      C و C   /u ~ ow/ or the consonant /v/. دور is /dur/ and پرور is
      C ی C   /parvar/; شیر is /šir/ and سیه is /siyah/. Reading the māter as
              a vowel made دلبر/هنرپرور and این/چین come back **False** when
              both pairs are Hafez's own rhymes.
      خو      the vāv-e maʿdule: خواب is /xāb/ with a silent و, خون is /xun/
              with a vocalic one, and nothing on the page separates them.
      C + ه   word-final heh: نامه is /nāme/ (the vowel) but کله is /kolah/
              and سیه is /siyah/ (the consonant), and the poetic contractions
              that take /h/ are common in Hafez. Reading it always as /e/ made
              کله/سیه come back **False**, and they rhyme.
    """
    w = normalise(word)
    if not w or " " in w or any(c not in INVENTORY for c in w):
        return None
    if w in CLITICS:            # و /o~va/, ز /ze/ — see the CLITICS note
        return [[("C", w), ("V", None, True)]]
    n = len(w)
    branches = [[]]
    for i, c in enumerate(w):
        prev_letter = w[i - 1] if i else ""
        nxt = w[i + 1] if i + 1 < n else ""
        grown = []
        for b in branches:
            sounded = [r for r in b if r[0] != "X"]
            prev_role = sounded[-1][0] if sounded else ""
            if c == "آ":
                add = [[("C", GLOTTAL), ("V", "ā", True)]] \
                    if (i == 0 or prev_role == "V") else [[("V", "ā", True)]]
            elif c == "ا":
                # Word-initial, or after another vowel: the alef fixes the
                # vowel's POSITION and says nothing about its identity, which
                # is the distinction the role's third field carries. The
                # after-a-vowel case is a HIATUS across a morpheme boundary —
                # ناامید /nā-omid/, باادب /bā-adab/ — and every syllable needs
                # an onset, so the break carries a glottal stop. Without this
                # clause those words have no legal parse at all and go
                # silently unreadable, which is the Finnish saa'ani defect
                # (doctrine 37) in Persian dress.
                if i == 0 and nxt in ("و", "ی"):
                    add = [[("C", GLOTTAL)]]       # ای /i~ey/, او /u~ow/
                elif i == 0 or prev_role == "V":
                    add = [[("C", GLOTTAL), ("V", None, True)]]
                else:
                    add = [[("V", "ā", True)]]
            elif c in ("و", "ی"):
                cons = [("C", c)]
                vowel = [("V", "u|ow" if c == "و" else "i|ey", True)]
                if i == 0 or prev_role == "V" or nxt in ("ا", "آ"):
                    add = [cons]                   # deduced, not preferred
                elif c == "و" and prev_letter == "خ":
                    add = [vowel, cons, [("X", "و")]]   # + vāv-e maʿdule
                else:
                    add = [vowel, cons]            # /u ~ ow/ or /v/; no signal
            elif c == HEH:
                if i == n - 1 and prev_role == "C":
                    add = [[("V", "e", True)], [("C", HEH)]]
                else:
                    add = [[("C", HEH)]]
            else:
                add = [[("C", GLOTTAL if (i == 0 and c == "ع") else c)]]
            grown.extend(b + a for a in add)
        branches = grown
    return [[r for r in b if r[0] != "X"] for b in branches]


# ---------------------------------------------------------------------------
# PARSING: roles -> syllables. Persian syllable shape is strictly
# (C) V (C) (C) with EXACTLY ONE onset consonant and never a cluster, which is
# what makes the split partly recoverable at all. Two further phonotactic
# facts do the pruning:
#   * every syllable needs an onset, so a written vowel may never directly
#     follow another one across a syllable boundary;
#   * a word does not end in an UNWRITTEN short vowel (Persian writes its
#     final vowels: ا و ی ه), so a parse that ends in one is illegal.
# ---------------------------------------------------------------------------

MAX_CODA = 2
#: Enumeration cap. A TRUNCATED parse list would be worse than no list at all:
#: `rhymes()` reads False off "every pair failed", and a pair that was dropped
#: for being the 129th cannot fail. So hitting the cap is a refusal — `tails()`
#: returns None and every verdict downstream becomes None — never a shortened
#: answer.
MAX_PARSES = 128


def _syll(onset, label, coda):
    """`text` writes an unwritten nucleus as `?` on purpose: the syllable's
    printed form must not look like a transcription it is not."""
    base = 1 if label in SHORT_NUCLEI else 2
    return Syllable(
        text=onset + ("?" if label is None else label) + "".join(coda),
        onset=(onset,), nucleus=label, coda=tuple(coda),
        prominence=None, moras=base + len(coda))


def _split(roles, i):
    """Enumerate legal syllabifications of roles[i:]."""
    if i >= len(roles):
        return
    if roles[i][0] != "C":
        return                              # a syllable must open on a consonant
    onset = roles[i][1]
    j = i + 1
    if j < len(roles) and roles[j][0] == "V":
        label, written, j = roles[j][1], True, j + 1
    else:
        label, written = None, False        # an unwritten short vowel
    for k in range(0, MAX_CODA + 1):
        end = j + k
        if end > len(roles):
            break
        coda = [r[1] for r in roles[j:end]]
        if any(r[0] != "C" for r in roles[j:end]):
            break
        head = _syll(onset, label, coda)
        if end == len(roles):
            if written or k:                # no word-final unwritten vowel
                yield [head]
            continue
        if roles[end][0] != "C":
            continue                        # next syllable would have no onset
        for tail in _split(roles, end):
            yield [head] + tail


def _enumerate(word):
    """-> (parses, capped). `capped` True means the enumeration was cut off and
    the list must not be treated as exhaustive."""
    rs = readings(word)
    if rs is None:
        return None, False
    seen, out = set(), []
    for roles in rs:
        for p in _split(roles, 0):
            key = tuple((s.onset, s.nucleus, s.coda) for s in p)
            if key in seen:
                continue
            seen.add(key)
            out.append(p)
            if len(out) > MAX_PARSES:
                return out, True
    return out, False


def parses(word):
    """-> list of candidate syllabifications (each a list of Syllable), or
    None when the word is out of inventory.

    An EMPTY list means the letters are Persian but no legal Persian syllable
    structure fits them — a single bare consonant, for instance. More than one
    entry means the split is genuinely indeterminate without the vowels, which
    is the ordinary case and is reported rather than resolved. The list may be
    truncated at MAX_PARSES; `tails()` refuses in that case rather than reading
    a verdict off a shortened list.
    """
    return _enumerate(word)[0]


def indeterminacy(word):
    """-> a one-line statement of what, if anything, this module cannot decide
    about `word`. The return of `syllabify()` is empty in four very different
    situations and this is what tells them apart."""
    ps, capped = _enumerate(word)
    if ps is None:
        return ("out of inventory: not Perso-Arabic script after normalisation "
                "(refusal is on script, never on language)")
    if capped:
        return (f"more than {MAX_PARSES} legal parses: the enumeration was cut "
                f"off, so nothing downstream may read a verdict off it")
    if not ps:
        return "no legal Persian syllable structure fits these letters"
    if len(ps) == 1:
        return "unique parse"
    shapes = {"·".join(f"{len(s.onset)}{'V' if s.nucleus else 'v'}"
                       f"{len(s.coda)}" for s in p) for p in ps}
    return (f"{len(ps)} legal parses, {len(shapes)} distinct shapes: the "
            f"syllable count is not recoverable without the short vowels")


def tails(word):
    """-> set of ``(nucleus_label, coda_tuple)`` rhyme tails, or None when the
    word is out of inventory OR the parse enumeration was capped.

    The tail is the classical qāfiya object: the last nucleus and everything
    written after it. One entry per distinct parse, so an indeterminate word
    contributes several and `rhymes()` sees all of them.
    """
    ps, capped = _enumerate(word)
    if ps is None or capped:
        return None
    return {(p[-1].nucleus, p[-1].coda) for p in ps if p}


def _tail_verdict(ta, tb):
    """Set algebra over VOWEL_SETS. Never a guess, in either direction."""
    if ta[1] != tb[1]:
        return False                        # the written consonants differ
    sa, sb = VOWEL_SETS[ta[0]], VOWEL_SETS[tb[0]]
    if not (sa & sb):
        return False                        # long against short, say
    if len(sa) == 1 and sa == sb:
        return True                         # both written and unambiguous
    return None                             # compatible, undecidable


# ---------------------------------------------------------------------------
# RADIF
# ---------------------------------------------------------------------------

#: Thresholds, named rather than magic (doctrine 16: an uncalibrated threshold
#: fails toward whoever guessed, so it is spelled out and reported at several
#: settings instead of being hidden in a literal).
#:
#: The form's own requirement is a radif on EVERY rhyming line, i.e. a fraction
#: of 1.0. The default is lower for one measured reason and one only: the
#: kavehbc/hafez text writes the same enclitic joined on some lines and spaced
#: on others (ناولها against مشکل ها inside ghazal 1), so a token-level rule
#: cannot reach 1.0 on a text that is orthographically inconsistent with
#: itself. RADIF_MIN_COUNT and RADIF_MIN_LINES exist because a shared trailing
#: run alone licenses anything (doctrine 18): a repetend needs BOTH a count
#: and a declared fraction, and a single pair is no evidence either way.
#:
#: CALIBRATION, measured over the 495 Hafez ghazals and reported rather than
#: fitted. The best single-token trailing fraction is sharply bimodal — 297
#: ghazals at exactly 1.0, 168 at 0.1–0.2, and 23 spread across everything
#: between — so the threshold sits in a trough and not on a slope. Detections
#: over the whole sweep: 318 at 0.40/0.50, 315 at 0.60, 311 at 0.70, 306 at
#: 0.80, 301 at 0.90, 297 at 1.00. min_count is NOT binding on this corpus
#: (every ghazal has at least six rhyming lines, so 0.60 already implies a
#: count of four); it is here for the short inputs this corpus does not
#: contain, which is exactly where doctrine 18's two-of-thirty-one case lived.
#: 0.60 was written down before the sweep was run and is kept: of the 18
#: ghazals it finds that 1.00 does not, 16 are mechanically explained by the
#: radif being written JOINED on the missing lines, and at 1.00 ghazal 422's
#: radif is reported WRONG — 'ای' instead of 'آمده ای' — because the strict
#: threshold forces a fallback to a shorter tail.
RADIF_MIN_COUNT = 3
RADIF_MIN_FRACTION = 0.60
RADIF_MIN_LINES = 4
RADIF_MAX_TOKENS = 6


def radif_detail(lines, min_count=RADIF_MIN_COUNT,
                 min_fraction=RADIF_MIN_FRACTION,
                 min_lines=RADIF_MIN_LINES, max_tokens=RADIF_MAX_TOKENS):
    """-> ``{"radif", "count", "fraction", "lines", "reason"}``.

    The radif is the longest verbatim shared trailing token sequence that
    RECURS across the given lines. Three gates, each a named parameter:

      min_lines     below this, one pair is the only evidence available and
                    the gate says so instead of deciding
      min_count     how many lines must carry the candidate
      min_fraction  what share of the lines must carry it

    A candidate that consumes a whole line is rejected: the qāfiya sits before
    the radif, so a radif with nothing in front of it on some line is the line
    itself and not a refrain.

    Refuses on script: if any line contains a token outside the declared
    Persian inventory, the return is None with a reason. That is a refusal
    about the writing system, not about the language.
    """
    def out(rad, count, frac, n, reason):
        return {"radif": rad, "count": count, "fraction": frac,
                "lines": n, "reason": reason}

    toks = []
    for ln in lines:
        t = tokens(ln)
        if not t:
            return out(None, 0, 0.0, 0, "an empty line after normalisation")
        if not all(in_inventory(x) for x in t):
            return out(None, 0, 0.0, 0,
                       "out of inventory: not Perso-Arabic script after "
                       "normalisation; refused on script, never on language")
        toks.append(t)
    n = len(toks)
    if n < min_lines:
        return out(None, 0, 0.0, n,
                   f"{n} lines is below min_lines={min_lines}: a single pair "
                   f"is no evidence either way, so this is a refusal and not "
                   f"a negative")
    best = None
    for k in range(1, max_tokens + 1):
        counts = {}
        for t in toks:
            if len(t) <= k:                 # would consume the whole line
                continue
            counts.setdefault(tuple(t[-k:]), 0)
            counts[tuple(t[-k:])] += 1
        if not counts:
            break
        tail = max(counts, key=lambda x: (counts[x], x))
        c = counts[tail]
        if c < min_count or c / n < min_fraction:
            break
        best = (" ".join(tail), c, c / n)
    if best is None:
        return out(None, 0, 0.0, n,
                   f"no trailing token sequence recurs on at least "
                   f"{min_count} lines and {min_fraction:.0%} of them")
    return out(best[0], best[1], best[2], n, "recurs")


def radif(lines, **kw):
    """-> the radif string, or None. See `radif_detail` for why."""
    return radif_detail(lines, **kw)["radif"]


class Persian(Phonology):
    language = "fas"
    name = "Persian"
    notation = (
        "Perso-Arabic orthography, UNVOCALISED — verified, not assumed: the "
        "kavehbc/hafez text carries zero ḥarakāt across 263,809 characters and "
        "36 distinct codepoints, and uses FARSI YEH U+06CC and KEHEH U+06A9 "
        "throughout with no ARABIC YEH U+064A, no ARABIC KAF U+0643 and no "
        "ZWNJ U+200C. normalise() folds NFKC, then ي ى ے ې ئ -> ی, ك ڪ -> ک, "
        "أ إ ٱ -> ا, ؤ -> و, ة ۀ ہ ۂ ھ -> ه, dagger alef U+0670 -> ا (a LONG "
        "vowel, so it is folded and not deleted), both Arabic-Indic digit "
        "blocks -> ASCII; deletes all ḥarakāt U+064B–U+065F (fatḥa kasra ḍamma "
        "tanwīn SHADDA sukūn), Quranic marks U+06D6–U+06ED, tatwīl U+0640, "
        "bare hamza U+0621, ZWJ and the zero-width/bidi/BOM family; maps ZWNJ "
        "U+200C and all Unicode spaces and punctuation to U+0020; collapses "
        "whitespace. Short vowels are NOT written and are NOT supplied.")
    grid_unit = "mora"
    prominence_rule = (
        "NONE — refused, for two independent reasons. (1) Classical Persian "
        "metre (ʿarūż) is QUANTITATIVE: what it constrains is syllable weight "
        "— light CV=1, heavy CVC/CVV=2, overlong CVCC/CVVC=3 — not stress. "
        "Modern Persian does have regular word-final stress, with the usual "
        "exceptions (enclitics, the ezāfe, verbal prefixes مى/ب, vocatives, "
        "the negative نـ), but that is not the grid the form is written on. "
        "(2) Stress is assigned per syllable and the SYLLABLE COUNT of an "
        "unvocalised Persian word is often unrecoverable, so the grid has no "
        "known length to index. prominence stays None; moras carries the grid, "
        "because the ABSENCE of a māter is itself evidence the vowel is short.")
    relation = (
        "ghazal: RADIF, a word or phrase repeated verbatim at the end of every "
        "rhyming line (exact string identity over normalised orthography — "
        "decidable); and QĀFIYA, the true rhyme immediately before it "
        "(consonant skeleton and long vowels written, SHORT VOWELS NOT, so "
        "rhyme identity is frequently not decidable and rhymes() returns None)")
    source = "rules only; no external resource, so nothing to licence"

    # -- syllables --------------------------------------------------------

    def syllabify(self, word):
        """-> the UNIQUE legal syllabification, or [] .

        `[]` is a refusal with three possible causes, and `indeterminacy()`
        names which: out of inventory, no legal structure, or — the ordinary
        Persian case — several legal parses, because the syllable count of an
        unvocalised word is not recoverable. Nothing is invented to fill the
        gap: مشکل has three legal parses and this returns none of them.

        Where a parse IS unique, every unwritten nucleus is marked
        `nucleus is None` and `moras` still carries the weight, because a
        missing māter is positive evidence that the vowel is short.
        """
        ps, capped = _enumerate(word)
        return ps[0] if ps and not capped and len(ps) == 1 else []

    def prominences(self, word):
        raise Unsupported(
            "Persian metre is quantitative (ʿarūż), so the grid is the mora "
            "and not the stress; this module will not return a stress "
            "pattern. Word-final stress is real in modern Persian but is not "
            "what the form constrains — and it could not be laid down here "
            "anyway, because the syllable count of an unvocalised word is "
            "often unrecoverable. Use grid_unit='mora' and Syllable.moras.")

    # -- sound relations --------------------------------------------------

    def _onset(self, word):
        rs = readings(word)
        if not rs or not rs[0]:
            return None
        first = rs[0][0]
        return first[1] if first[0] == "C" else None

    def alliterates(self, a, b):
        """-> True / False / None. Consonantal, and therefore mostly decidable:
        onsets are written even though nuclei are not. None means one of the
        words is out of inventory, never that the answer was hard.

        Word-initial ا آ ع are all read with a glottal onset and so form one
        alliterating class — declared, not sniffed.
        """
        oa, ob = self._onset(a), self._onset(b)
        if oa is None or ob is None:
            return None
        return oa == ob

    def rhymes(self, a, b):
        """-> True / False / None, where **None is expected and frequent**.

        The verdict is set algebra over VOWEL_SETS across every legal parse
        pair. True only if every pair rhymes, False only if every pair fails;
        anything mixed, or any pair whose nuclei merely OVERLAP, is None.

          کار / یار   True   both {ā} before the same rawī — written, long
          کار / در    False  {ā} against {a,e,o}: disjoint, so it cannot rhyme
          دل  / گل    None   identical skeletons, /del/ against /gol/, and the
                             orthography does not say which

        `Syllable.key()` is NOT used here and must not be: it would compare two
        unknown nuclei equal and turn the third case into the first.
        """
        na, nb = normalise(a), normalise(b)
        ta, tb = tails(na), tails(nb)
        if ta is None or tb is None or not ta or not tb:
            return None
        if na == nb:
            return True         # identity; the band types it as REPEAT/radif
        verdicts = {_tail_verdict(x, y) for x in ta for y in tb}
        if verdicts == {True}:
            return True
        if verdicts == {False}:
            return False
        return None

    # -- the form ---------------------------------------------------------

    def radif(self, lines, **kw):
        """-> the radif of these rhyming lines, or None. See `radif_detail`."""
        return radif_detail(lines, **kw)["radif"]

    def qafiya(self, lines, **kw):
        """-> ``(radif, [qāfiya word per line or None])``.

        The qāfiya is the token immediately before the radif. Where a line does
        not carry the radif — the joined/spaced inconsistency of the source
        text does this — that line's entry is None rather than a token picked
        from the wrong position.
        """
        d = radif_detail(lines, **kw)
        rad = d["radif"]
        rtoks = rad.split() if rad else []
        out = []
        for ln in lines:
            t = tokens(ln)
            if not t:
                out.append(None)
            elif not rtoks:
                out.append(t[-1])
            elif len(t) > len(rtoks) and t[-len(rtoks):] == rtoks:
                out.append(t[-len(rtoks) - 1])
            else:
                out.append(None)
        return rad, out

    def coverage(self, text):
        """-> (readable tokens, total tokens). A phonology is tested against
        its tradition, not against its own rules (doctrine 37), so this is how
        a caller checks that the module can actually read the corpus."""
        t = tokens(text)
        return sum(1 for x in t if in_inventory(x)), len(t)


PERSIAN = Persian()
register(PERSIAN)
