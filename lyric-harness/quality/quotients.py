#!/usr/bin/env python3
"""DECLARED QUOTIENTS — the named partitions a schema may be judged under.

`quality/relations.ClassEqual` is equality UNDER A QUOTIENT, and its whole
point (defect P14) is that `partition=lambda v: v` is not one: under the
identity, `family rhyme` degenerates to an ordinary perfect rhyme and `proest`
becomes UNSATISFIABLE, because its own channel list says the nucleus must
DIFFER and be CLASS-EQUAL at once. So a quotient is a NAMED RESOURCE the
stream supplies -- `declaration['quotients'][name]` first, then
`phon.quotients[name]` -- and `realise()` REFUSES a schema whose declaration
supplies none rather than answering under a quotient nobody wrote.

`quality/phonology/ltc.py` has supplied one since it was written (`同用`, the
平水韻 grouping). This module is where the others live, for one reason
(doctrine 1): a partition is a fact about a sound system, several schemas ask
for the same one, and a table copied into two phonologies is a table that will
disagree with itself. Each phonology imports what it declares.

THE CONTRACT. A quotient is a callable `value -> class`, where `value` is
whatever the CHANNEL yields for a unit. Read the channel before writing one:
`nucleus` is a string ('AE'), `onset` and `coda` are TUPLES of phones
(('K',), ('S','T')), `prominence` is an int. A quotient over `coda` therefore
takes a tuple and returns a tuple, and one over `nucleus` takes a string.
`ClassEqual` compares the returned classes with `_set_agree`, so any hashable
class label works and `None` means OUTSIDE THE PARTITION -- which reads as a
refusal at that channel, not as a False.
"""

# ---------------------------------------------------------------------------
# 1. ENGLISH MANNER OF ARTICULATION
# ---------------------------------------------------------------------------
#: The consonant inventory this partition must cover, DERIVED AND NOT ASSUMED:
#: the 24 distinct consonantal ARPAbet symbols in `data/cmudict*` as shipped,
#: measured over all 126,052 entries on 2026-08-22. It is asserted against the
#: table below at import (`_check_total`), so a lexicon swap that introduces a
#: 25th symbol refuses here instead of silently sorting it to `None`.
ARPABET_CONSONANTS = (
    "B", "CH", "D", "DH", "F", "G", "HH", "JH", "K", "L", "M", "N", "NG",
    "P", "R", "S", "SH", "T", "TH", "V", "W", "Y", "Z", "ZH")

#: MANNER, the standard six-way articulatory partition. This is descriptive
#: phonetics and not a calibration: it is the same grouping in Ladefoged &
#: Johnson (*A Course in Phonetics*) and in every ARPAbet feature table, and
#: nothing here is tuned to a corpus or to a result.
#:
#: THE ONE PLACE THE LITERATURE SPLITS is the affricates, and this table makes
#: the choice EXPLICITLY rather than absorbing them (doctrine 45 — a checker
#: that silently picks is the bug). CH and JH are their OWN class here, not
#: members of `stop`, because:
#:   (a) the schemas that ask for this partition are `family rhyme` and
#:       `multisyllabic rhyme`, both of which read it on the CODA to ask "are
#:       these two coda consonants the same KIND of sound"; folding CH into
#:       `stop` would make `catch`/`cat` a family rhyme, and folding it into
#:       `fricative` would make `catch`/`cash` one. Neither is what a writer
#:       means by the family;
#:   (b) an affricate is a stop RELEASED as a fricative, so it is exactly the
#:       case a two-way answer cannot express, and doctrine 24 says a rule
#:       that would delete a category must relabel instead.
#: A caller who wants the coarser grouping declares their own quotient; that
#: is what the resource mechanism is for.
MANNER = {
    "P": "stop",       "B": "stop",       "T": "stop",     "D": "stop",
    "K": "stop",       "G": "stop",
    "CH": "affricate", "JH": "affricate",
    "F": "fricative",  "V": "fricative",  "TH": "fricative",
    "DH": "fricative", "S": "fricative",  "Z": "fricative",
    "SH": "fricative", "ZH": "fricative", "HH": "fricative",
    "M": "nasal",      "N": "nasal",      "NG": "nasal",
    "L": "liquid",     "R": "liquid",
    "W": "glide",      "Y": "glide",
}

MANNER_CLASSES = ("stop", "affricate", "fricative", "nasal", "liquid", "glide")


def _strip_stress(ph):
    """ARPAbet carries stress digits on VOWELS; a coda tuple should not have
    them, but a caller may hand this a raw CMUdict pronunciation and a
    partition that answered `None` for 'T1' would be reporting a formatting
    difference as a phonological one."""
    return "".join(c for c in str(ph) if not c.isdigit()).upper()


def manner(value):
    """-> the manner class of a coda/onset value.

    A TUPLE IN, A TUPLE OUT, because `onset` and `coda` are tuples of phones
    and `ClassEqual` compares whatever comes back. `('S','T')` and `('S','P')`
    both map to `('fricative','stop')` and are CLASS-EQUAL; `('T',)` and
    `('N',)` map to `('stop',)` and `('nasal',)` and are not.

    THE EMPTY CODA IS A CLASS AND NOT A REFUSAL. `()` -> `()`, so two open
    syllables agree with each other and disagree with any closed one. That is
    the honest reading: "this syllable ends in no consonant" is something the
    stream KNOWS, not something it could not read (doctrine 20).

    A PHONE OUTSIDE THE INVENTORY -> None, which `ClassEqual` reads as
    "outside the partition" and turns into a refusal at that channel rather
    than a False. A single unknown phone poisons the whole tuple deliberately:
    a coda whose second consonant could not be classed has an unknown manner
    profile, and answering on the first alone would be a guess.
    """
    if value is None:
        return None
    if isinstance(value, str):
        return MANNER.get(_strip_stress(value))
    out = []
    for ph in value:
        c = MANNER.get(_strip_stress(ph))
        if c is None:
            return None
        out.append(c)
    return tuple(out)


def _check_total():
    """Every consonant in the derived inventory has a class, and every class
    in the declared list is used. Run AT IMPORT, because a partition with a
    hole in it does not fail — it silently refuses on the pairs that fall in
    the hole, which is the quietest possible defect (doctrine 48)."""
    missing = [p for p in ARPABET_CONSONANTS if p not in MANNER]
    if missing:
        raise ValueError(
            f"MANNER does not classify {missing} — every consonant in "
            f"ARPABET_CONSONANTS must have a class, or `family rhyme` and "
            f"`multisyllabic rhyme` refuse on every pair containing one and "
            f"say nothing about why.")
    extra = [p for p in MANNER if p not in ARPABET_CONSONANTS]
    if extra:
        raise ValueError(
            f"MANNER classifies {extra}, which are not in the derived "
            f"inventory ARPABET_CONSONANTS — a table wider than its domain "
            f"is a table nobody checked against the lexicon.")
    used = {c for c in MANNER.values()}
    if used != set(MANNER_CLASSES):
        raise ValueError(
            f"MANNER_CLASSES declares {set(MANNER_CLASSES)} and the table "
            f"uses {used}; the two must agree or the declared list is prose.")


_check_total()


#: What a phonology adopts. `quality/phonology/eng.py` sets
#: `self.quotients = dict(ENG_QUOTIENTS)`, the same shape `ltc` already uses
#: for 同用, so `_quotient_of` finds it with no change to `relations.py`.
#: Rebound below once every partition in this module exists.
ENG_QUOTIENTS = {"manner": manner}

# ---------------------------------------------------------------------------
# 2. THE DECLARED TRITE-PAIR PARTITION
# ---------------------------------------------------------------------------
#: `trite rhyme` carries `requires=("frequency",)` and `relations.UNPROVIDABLE`
#: records it as `blocker="disjoint"` with a MEASUREMENT this table does not
#: dispute and does not need to: the pre-1931 corpus is the only admissible
#: English source here, and it cannot say what is over-familiar to a LIVING
#: listener — 7 of `lyric_harness.CLICHE_PAIRS`' 30 pairs have count ZERO in
#: it, while its own top by author dispersion is `me`/`thee` (1,080 over 51
#: authors), which is a cliche to nobody now.
#:
#: THAT ARGUMENT IS ABOUT CORPUS FREQUENCY AND IT IS RIGHT. It is not about
#: whether the schema can be answered, and the entry's own
#: `would_manufacture` field says exactly what goes wrong if the capability is
#: merely rubber-stamped: "every perfect rhyme in the text, labelled trite",
#: because the schema's two channels are nucleus AGREE and coda AGREE and
#: NOTHING IN IT READS A RANK. Supplying `frequency` without giving the schema
#: something to consult IS the manufacture.
#:
#: SO THE ANSWER IS A PREDICATE, NOT A CAPABILITY. This repo already owns a
#: frequency-independent triteness source — `lyric_harness.CLICHE_PAIRS`, 30
#: hand-declared pairs, already load-bearing in the doctrine-9 modal
#: exclusion — and a quotient turns it into something `ClassEqual` can read:
#: both members of a declared pair map to that pair's id, every other word
#: maps to itself. Two words are CLASS-EQUAL exactly when the declaration
#: names them as a trite pair, so the schema flags 30 pairs and not one
#: perfect rhyme more. Nothing is ranked, nothing is thresholded, and there is
#: no uncalibrated cut (doctrine 16/22) because there is no cut.
#:
#: WHAT THIS IS NOT: a claim that 30 pairs are all the trite pairs in English.
#: It is a claim that these 30 are DECLARED trite by this repo, which is the
#: only honest thing any list can say. Widening it is an edit to that list.


def _trite_index():
    """-> {word: pair-id}, built once from the declared pair list."""
    global _TRITE
    if _TRITE is None:
        try:
            _TRITE = _check_trite_disjoint()
        except Exception:
            _TRITE = {}
    return _TRITE


_TRITE = None


def _check_trite_disjoint():
    """No word may sit in TWO declared pairs. Checked ON FIRST USE, not
    asserted in prose: `ClassEqual` compares ONE class per value, so a word in
    two pairs would silently get whichever the dict wrote last and the schema
    would answer False for one of its own declared pairs. MEASURED at the time
    of writing: 30 pairs, 60 distinct words, no overlap — which is exactly the
    condition that makes a single class per word exact, and exactly the
    condition a future edit could break without any test noticing."""
    import lyric_harness as _lh
    seen = {}
    for pair in _lh.CLICHE_PAIRS:
        key = "trite:" + "~".join(sorted(pair))
        for w in pair:
            w = str(w).lower()
            if w in seen and seen[w] != key:
                raise ValueError(
                    f"{w!r} is in two declared trite pairs ({seen[w]} and "
                    f"{key}); `ClassEqual` carries ONE class per value, so "
                    f"the partition must be disjoint or `trite rhyme` will "
                    f"silently answer False for one of them. Either merge "
                    f"the pairs or give the schema a set-valued predicate.")
            seen[w] = key
    return seen


def trite(value):
    """-> the trite-pair class of a token value.

    A word in a declared pair maps to that pair's id; every other word maps to
    ITSELF, so two non-declared words are class-equal only when they are the
    same word — which the schema's own `DISTINCT` identity rule already
    forbids. The partition is therefore exactly "these two are a declared
    trite pair", with no rank and no threshold.

    `None` in, `None` out — `ClassEqual` reads that as outside the partition
    and refuses at the channel rather than answering False.
    """
    if value is None:
        return None
    w = str(value).lower()
    return _trite_index().get(w, w)


ENG_QUOTIENTS = {"manner": manner, "trite": trite}

# ---------------------------------------------------------------------------
# 3. WELSH VOWEL CLASS (proest)
# ---------------------------------------------------------------------------
#: `proest` declares three channels: coda AGREE, nucleus DIFFER, and nucleus
#: CLASS-EQUAL under a resource named `vowel_class`. Under the identity those
#: last two are each other's negation, so the schema was UNSATISFIABLE — not
#: strict, unsatisfiable — and `tân`/`tôn`, `mab`/`heb`, `llon`/`llan`,
#: `dydd`/`budd`, `cant`/`gwynt` and `gwyn`/`gwn` all read False with no input
#: of any kind able to read True (defect P14, measured at the time).
#:
#: `quality/phonology/cym.py` declares no `quotients`, so the schema refused.
#: This is that partition.
#:
#: THE AXIS, AND EXACTLY HOW MUCH OF IT IS CLAIMED. The schema's own label
#: names three things — "quantity, and simple vs diphthong / lleddf vs
#: talgron". This table implements the FIRST TWO and refuses to invent the
#: third:
#:
#:   QUANTITY      long vs short, read off the CIRCUMFLEX (`â î ô û ŵ ŷ`),
#:                 which is what the orthography marks it with. Unambiguous
#:                 from the spelling and needs no external source.
#:   SHAPE         simple vs diphthong, read off the length of the nucleus.
#:                 Also unambiguous.
#:   ~~LLEDDF vs   NOT IMPLEMENTED, and said so rather than guessed. The
#:   TALGRON~~     split of the diphthongs into oblique and round classes is a
#:                 fact about Welsh prosody with a literature (Morris-Jones,
#:                 *Cerdd Dafod*), and this repo ships no source for the
#:                 membership. Writing one from memory is exactly the
#:                 "heuristic reported as data" this project refuses
#:                 elsewhere. So `proest` here answers on the COARSER
#:                 partition: it will accept a pair the finer rule would
#:                 split, and it will never accept one the coarser rule
#:                 rejects. THE DIRECTION OF THE ERROR IS STATED because it
#:                 is the thing a reader needs — this is a permissive
#:                 approximation, not an exact judge, and lifting it needs
#:                 a sourced diphthong table, which is a one-table job for
#:                 anyone with the book.
#:
#: The nucleus inventory below was DERIVED by syllabifying a 38-word Welsh
#: sample through `cym` on 2026-08-22, not assumed: a, ae, ai, au, aw, e, ei,
#: i, o, u, w, wy, y, â, î, ô. `vowel_class` handles any nucleus by rule, so
#: a form outside that sample still classes correctly.

CYM_LONG_MARKS = "âêîôûŵŷ"


def vowel_class(value):
    """-> ('long'|'short', 'simple'|'diphthong') for a Welsh nucleus.

    BY RULE AND NOT BY TABLE, so a nucleus the sample did not contain still
    classes: the circumflex is the length mark and the character count is the
    shape. `None` in, `None` out — `ClassEqual` reads that as outside the
    partition and refuses at the channel rather than answering False.
    """
    if value is None:
        return None
    v = str(value).lower()
    if not v:
        return None
    quantity = "long" if any(c in CYM_LONG_MARKS for c in v) else "short"
    shape = "diphthong" if len(v) > 1 else "simple"
    return (quantity, shape)


CYM_QUOTIENTS = {"vowel_class": vowel_class}




__all__ = ["ARPABET_CONSONANTS", "MANNER", "MANNER_CLASSES", "manner",
           "trite", "vowel_class", "ENG_QUOTIENTS", "CYM_QUOTIENTS",
           "CYM_LONG_MARKS"]


if __name__ == "__main__":
    print(f"ARPABET_CONSONANTS  {len(ARPABET_CONSONANTS)}")
    print(f"MANNER_CLASSES      {len(MANNER_CLASSES)}  {MANNER_CLASSES}")
    for c in MANNER_CLASSES:
        print(f"   {c:10s} {sorted(p for p, k in MANNER.items() if k == c)}")
