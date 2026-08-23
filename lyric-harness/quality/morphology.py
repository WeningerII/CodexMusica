#!/usr/bin/env python3
"""THE DECLARED ENGLISH MORPHOLOGY RESOURCE — root and affix, for the two
schemas that are defined by them.

`quality/relations.py` reads `declaration['resources']` for the `morphology`
capability, at two levels: `morpheme_root` and `morpheme_affix`. Two schemas
ask for it and BOTH refuse without it —

    homoioteleuton   affix AGREE, token DIFFER  (the same ending, different
                     words: `-ation` against `-ation`)
    polyptoton       root AGREE, affix DIFFER, token DIFFER (the same word in
                     two grammatical forms: `love` / `loving`)

-- so between them the missing resource costs both, and `relations_null`
recorded it as `Blocker: build`, with the reason: *"a lemmatiser/segmenter …
a suffix-strip written here would decide both verdicts by its own heuristic
and report it as morphology."*

THAT REASON IS ABOUT DISCLOSURE AND IT IS ANSWERABLE, WHICH IS WHY THIS FILE
EXISTS (owner ruling 2026-08-22, "all 77, no exceptions"). A heuristic that
names its rules, cites its vocabulary, reports its coverage and REFUSES where
it has no rule is not laundering — it is a declared instrument. What would be
laundering is a silent one.

AND THE VOCABULARY IS NOT NEW. `quality/g2p.SUFFIXES` is a CLOSED suffix set
fixed before any accuracy was measured (see that cell's pre-registration), and
this module imports it rather than writing a second list — doctrine 1, because
two suffix tables in one repository are two tables that will disagree.

WHAT IS NEW IS THE TIE-BREAK, AND THE DIFFERENCE IS THE WHOLE POINT.
`g2p._suffix` breaks ties by `(-stem length, suffix index, stem-form order,
frequency rank)` and it is RIGHT to: it is predicting PHONES, so it wants the
parse whose stem it can pronounce, and a stem that is a real CMUdict headword
is better evidence than a longer suffix. MEASURED, that yields:

    hopeless  ->  `-s` on `hopeless`      (both are CMUdict headwords)
    singing   ->  `-ing` on `singe`       (`singe` is a headword; `sing` is
                                           reached by the same residue)

Both are the correct answer to "what does this sound like" and the wrong
answer to "what is the root". So this module breaks ties by LONGEST AFFIX
first and does not require the stem to be a dictionary headword, because an
affix is an ORTHOGRAPHIC fact and dictionary membership is evidence about
pronunciation. Same vocabulary, different question, declared difference —
and `report()` prints every word the two disagree on rather than leaving the
divergence to be discovered.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from quality.g2p import SUFFIXES, stem_candidates          # noqa: E402

#: The affix inventory, as NAMES, derived from the shipped table. A schema
#: comparing affixes compares these, not the raw orthographic string, so
#: `-ed` and `-'d` are ONE affix (they are the same morpheme, elided) and
#: `sings`/`singes` land on `-s` together. That is a linguistic claim and it
#: is made here, once, rather than in each caller.
AFFIX_NAMES = ()   # filled below, once `_TABLE` exists

#: MINIMUM RESIDUE. `g2p` uses 2 and so does this: a one-letter root is not a
#: root, and allowing one turns `as` into `a` + `-s`. Declared rather than
#: inlined so the two files can be compared at a glance.
MIN_ROOT = 2

#: DERIVATIONAL SUFFIXES `g2p.SUFFIXES` DOES NOT CARRY, AND WHY THAT IS NOT A
#: SECOND TABLE. `g2p`'s set is closed for a stated purpose: predicting the
#: PHONES of a word CMUdict does not list. `-ation` never needed to be in it,
#: because `nation`, `relation`, `creation` and their thousands of siblings
#: are all CMUdict headwords — there was nothing to predict. Morphology asks a
#: different question of the same words, and `homoioteleuton` is DEFINED on
#: exactly these endings: `-ation` against `-ation` is the textbook case.
#:
#: So this list is ADDITIVE and never edits `g2p`'s. Changing the shared table
#: would move a pronunciation layer to serve a morphology one, which is the
#: coupling doctrine 1 is about pointed the wrong way. Each row is
#: (orthographic suffix, affix name), and they are tried in the same
#: longest-first order as the inherited rows.
#:
#: WHAT IS IN HERE IS THE PRODUCTIVE DERIVATIONAL SET a rhyme judge needs:
#: endings that (a) attach to a free or bound root, (b) are spelled the same
#: across many words, and (c) therefore make an END-RHYME that is a
#: MORPHOLOGICAL identity rather than a sonic one — which is the whole reason
#: `homoioteleuton` is in the registry beside the homeoteleuton class ban.
#: ~~`-ation`, `-tion`, `-ition`, `-ission`, `-sion`~~ ARE DELIBERATELY ABSENT
#: and the superseded list stays visible (doctrine 17). They are not suffixes
#: that attach to a free root — `-ation` is `-ate` + `-ion`, and treating it as
#: one atom made longest-first cut in the wrong place on every word in the
#: family: MEASURED, `creation` -> `cree` + `-ation` (because `cree` IS a
#: CMUdict headword), `devotion` -> `devoe` + `-tion`, `motion` -> `mo`.
#: With `-ion` alone the same words reach `create`, `devote` and `emote`,
#: which are their actual roots, and — the point — they all reach the SAME
#: AFFIX, which is what `homoioteleuton` compares.
DERIVATIONAL = (
    ("ilities", "-ility"), ("ility", "-ility"),
    ("ically", "-ically"),
    ("ities", "-ity"), ("ity", "-ity"),
    ("ously", "-ously"), ("ous", "-ous"),
    ("ically", "-ically"), ("ical", "-ical"),
    ("ments", "-ment"), ("ment", "-ment"),
    ("nesses", "-ness"),
    ("ances", "-ance"), ("ance", "-ance"),
    ("ences", "-ence"), ("ence", "-ence"),
    ("ships", "-ship"), ("ship", "-ship"),
    ("hoods", "-hood"), ("hood", "-hood"),
    ("wards", "-ward"), ("ward", "-ward"),
    ("ists", "-ist"), ("ist", "-ist"),
    ("isms", "-ism"), ("ism", "-ism"),
    ("ives", "-ive"), ("ive", "-ive"),
    ("ables", "-able"), ("able", "-able"),
    ("ibles", "-ible"), ("ible", "-ible"),
    ("ings", "-ing"),
    ("ions", "-ion"), ("ion", "-ion"),
    ("iest", "-est"), ("ier", "-er"),
    ("ies", "-s"),
)

#: ~~`-tion`/`-sion`~~ ARE GONE FOR THE SAME REASON AS `-ation` and the
#: measurement is recorded rather than the conclusion: with them in the table,
#: `nation` -> `na` + `-tion`, `motion` -> `mo`, `emotion` -> `emo`,
#: `devotion` -> `devo`, `station` -> `sta`. Every one of those residues is a
#: COMMON subtitle token (`na` rank 3,429, `mo` rank 4,179), so no frequency
#: cutoff can reject them — the table row is the defect, not the threshold.
#: `-ion` alone reaches `relate`, `create`, `confuse` and `devote`.
#:
#: WHAT THE PRODUCTIVITY TEST CANNOT DO, STATED SO IT IS NOT DISCOVERED.
#: The frequency cutoff separates fragments (`lov`, `happ`) from roots, and it
#: CANNOT separate a real short word from a wrong short root: MEASURED,
#: `nat` sits at rank 8,167 and `stat` at 12,387, while `relate` is 7,860 and
#: `devote` is 12,858 — `devote` and `stat` are ADJACENT, so no cutoff admits
#: one and rejects the other. `nation` therefore segments as `nat` + `-ion`
#: and `station` as `stat` + `-ion`, which are wrong ROOTS.
#:
#: WHY THAT IS TOLERABLE AND WHERE IT IS NOT, per schema, rather than as a
#: blanket reassurance: `homoioteleuton` reads the AFFIX (`morpheme_affix`
#: AGREE), and the affix is right in every case above — `nation`, `relation`
#: and `station` all reach `-ion` and all agree, which is the schema's own
#: textbook case. `polyptoton` reads the ROOT, so an over-segmented root can
#: cost it a pair: `nation`/`nat` would read as one root if both stood at line
#: ends. That is a FALSE POSITIVE on a rare configuration, and it is named
#: here rather than left for a writer to hit.
#:
#: THE PRODUCTIVITY TEST, AND WHY ONLY THE DERIVATIONAL ROWS TAKE IT.
#: A derivational suffix is stripped ONLY when what is left is a real word.
#: Without this, longest-first over-segments the monomorphemic: MEASURED,
#: `nation` came back `na` + `-tion` and `relation` came back `rel` +
#: `-ation` — DIFFERENT affixes on two words whose shared ending is the entire
#: textbook example of homoioteleuton, so the schema missed its own case while
#: appearing to answer. With the test: `nation` has no free root (`na` is not
#: a word) and takes NO affix, which is correct — `nation` is monomorphemic in
#: modern English; `relation` reaches `relate` + `-ion`, which is correct too.
#:
#: The INFLECTIONAL rows do not take it, deliberately. `deceivest` rests on
#: `deceive` and `grow'st` on `grow`, but an archaic or dialect stem may not
#: be in any word list this repo ships, and refusing an inflection because its
#: stem is unattested would silently delete exactly the historical material
#: `-eth`/`-'st`/`-'d` were put in `g2p.SUFFIXES` to read. An inflection is
#: recognisable from its ending alone; a derivation is not.
_DERIV_NAMES = frozenset(name for _sfx, name in DERIVATIONAL)

#: HOW COMMON A ROOT MUST BE to license a derivational strip, and the number
#: is DECLARED WITH ITS REASON rather than left as a threshold nobody wrote
#: down (doctrine 58). ~~50,000~~, the full size of the shipped list, was the
#: first value and it admitted everything: `data/opensubtitles_en_50k.tsv` is
#: a SUBTITLE frequency list and its tail is fragments and typos — MEASURED,
#: `lov` sits at rank 47,998, `happ` at 46,296 and `cree` at 45,754, so "in
#: the list at all" answered YES for exactly the non-roots the test exists to
#: reject. 20,000 keeps `love` (122), `happy` (295) and every ordinary English
#: root while cutting the fragment tail. It is a coordinate, not a discovery:
#: a caller may declare their own, and `report()` prints the segmentation this
#: value produces so a change can be argued from a figure.
KNOWN_RANK_CUTOFF = 20_000

#: The two sources, merged into ONE ordered table at import so `segment()`
#: reads a single list. `g2p`'s rows keep their own indices first, so tie-break
#: 2 (table order) is unchanged for every word `g2p` already parsed; the
#: derivational rows follow. Merged HERE and not in either source, so neither
#: file's own table gains a row it did not declare.
#: ROWS OF `g2p.SUFFIXES` THAT ARE PRONUNCIATION CONVENIENCES AND NOT
#: MORPHEMES, excluded here and left untouched there. `-iness` is the only
#: one: it is `-y` + `-ness` merged orthographically, and it exists in `g2p`
#: because that spelling predicts the phones `IH0 N AH0 S` in one step. As a
#: MORPHEME it cuts in the wrong place — MEASURED, `happiness` came back
#: `hap` + `-iness` (residue `happ`, undoubled to the real word `hap`) where
#: the answer is `happy` + `-ness`, which `-ness` reaches on its own through
#: the `i`->`y` stem-form rule.
_EXCLUDED_SUFFIXES = frozenset({"iness"})

_TABLE = ([(sfx, name) for sfx, _allo, name in SUFFIXES
           if sfx not in _EXCLUDED_SUFFIXES]
          + list(DERIVATIONAL))


def segment(word):
    """-> (root, affix_name) or (word, "") when no declared affix applies.

    NO-AFFIX IS AN ANSWER, NOT A REFUSAL. `cat` -> `('cat', '')`, and two
    unaffixed words therefore AGREE on the affix channel. That is right:
    "this word carries no suffix from the declared set" is something this
    table knows. What it cannot know is an affix outside the set, and the
    honest reading of that limit is the COVERAGE FIGURE in `report()`, not a
    None on every ordinary word.

    THE TIE-BREAK, DECLARED:
      1. LONGEST ORTHOGRAPHIC SUFFIX. `-ness` beats `-s` on `kindness`,
         `-less` beats `-s` on `hopeless`, `-ings` beats `-s` on `singings`.
         This is the one that differs from `g2p` and it is the one that makes
         the answer morphological.
      2. SUFFIX-TABLE ORDER, inherited unchanged: among equal-length suffixes
         the earlier row wins, which is `g2p`'s own linguistic ordering
         (`-est` before `-st` because the first is the ending and the second
         its post-vocalic reduction).
      3. STEM-FORM ORDER from `stem_candidates`, inherited unchanged: the
         identity, then undoubling (`runn`->`run`), then doubling, then a
         restored `e` (`gaz`->`gaze`), then `i`->`y`.
    """
    w = (word or "").lower()
    if not w:
        return ("", "")
    known = _known_words()
    best = None
    for sfx_i, (sfx, name) in enumerate(_TABLE):
        if not w.endswith(sfx) or len(w) - len(sfx) < MIN_ROOT:
            continue
        residue = w[:-len(sfx)]
        cands = stem_candidates(residue)
        if not cands:
            continue
        # AMONG STEM FORMS OF ONE RESIDUE, PREFER A REAL WORD — and this is
        # tie-break 4, strictly INSIDE a fixed (suffix, suffix-index) choice,
        # so it can never reach up and change WHICH SUFFIX was stripped. That
        # containment is the difference from `g2p`, whose stem length is the
        # FIRST key and therefore does pick the suffix.
        #
        # It is what makes polyptoton work at all. `stem_candidates('lov')`
        # offers `lov` (identity, order 0) and `love` (restored -e, order 3);
        # declared order alone takes `lov`, so `love` and `loving` land on
        # DIFFERENT roots and the schema whose whole definition is "same root,
        # different form" answers False on its own textbook example.
        # `running` -> `runn` is the same failure through undoubling.
        # MEASURED before this clause existed: love/loving False,
        # sing/singing True (no restoration needed), run/running False.
        stem, order = min(
            cands, key=lambda c: (0 if c[0] in known else 1, c[1]))
        # THE PRODUCTIVITY TEST — derivational rows only; see `_DERIV_NAMES`.
        if name in _DERIV_NAMES and known and stem not in known:
            continue
        key = (-len(sfx), sfx_i, order)
        if best is None or key < best[0]:
            best = (key, stem, name)
    if best is None:
        return (w, "")
    return (best[1], best[2])


#: The word list the stem-form preference consults, loaded ONCE and lazily.
#: A module-level `Lexicon()` would make `import morphology` cost a
#: 126,052-entry read for a caller that never segments anything.
_KNOWN = None


def _known_words(words=None):
    """-> a set of known lowercase headwords.

    INJECTABLE, because the word list is a COORDINATE and not a fact
    (doctrine 45): a caller judging Scots or a period text has a different
    inventory, and a checker that silently picks the shipped one is the bug.
    Pass `words=` to declare your own; pass `words=()` for none, which makes
    the stem-form choice fall back to the declared order alone and is exactly
    the behaviour this function was added to fix — available on purpose, so
    the difference it makes can be measured rather than asserted.
    """
    global _KNOWN
    if words is not None:
        _KNOWN = frozenset(w.lower() for w in words)
        return _KNOWN
    if _KNOWN is None:
        try:
            import lyric_harness as _lh
            _lex = _lh.Lexicon()
            # THE FREQUENCY LIST, NOT THE PRONOUNCING DICTIONARY, and the
            # difference is the whole productivity test. CMUdict lists 126,052
            # headwords including every proper noun and interjection, so
            # "is this a word" answers YES for `na`, `cree`, `mo` and `devoe`
            # — MEASURED, and it is why `creation` came back `cree` + `-ation`
            # and `devotion` came back `devoe` + `-tion` when the test read
            # CMUdict. `freq_rank` is a SPOKEN-REGISTER list
            # (data/opensubtitles_en_50k.tsv) and a root that is genuinely a
            # free word in English is in it.
            _KNOWN = frozenset(
                str(w).lower() for w, r in _lex.freq_rank.items()
                if r <= KNOWN_RANK_CUTOFF)
        except Exception:
            _KNOWN = frozenset()
    return _KNOWN


def root(word):
    """-> the root alone. `polyptoton` reads this."""
    return segment(word)[0]


def affix(word):
    """-> the affix NAME alone, "" for none. `homoioteleuton` reads this."""
    return segment(word)[1]


# ---------------------------------------------------------------------------
# THE RESOURCE, in the shape `relations.py` reads
# ---------------------------------------------------------------------------
# `_read_identity` calls `fn(unit)` and a `Unit` carries `token_text`, so the
# resource is a unit-level callable and not a word-level one. Keyed by LEVEL
# (`morpheme_root` / `morpheme_affix`) rather than by the capability name,
# because the two levels need DIFFERENT answers and one `morphology` key
# cannot carry both -- `_read_identity` looks up the level first and falls
# back to the capability, so a level-keyed dict satisfies both the lookup and
# `Stream.supply`'s capability check.

def _root_of_unit(u):
    return root(getattr(u, "token_text", "") or "")


def _affix_of_unit(u):
    return affix(getattr(u, "token_text", "") or "")


def _lexeme_of_unit(u):
    """THE LEXEME, for the `lexicon` capability — a word's dictionary form.

    `holorhyme` compares LEXEME SEQUENCES across a whole line and
    `rhyming slang` a declared slang lexicon; `relations_null` calls the
    capability `Blocker: obtain` on the ground that keying either on
    lowercased token text "makes `lexeme` an alias of `token` and collapses a
    declared coordinate". THAT OBJECTION IS EXACTLY RIGHT ABOUT THE TOKEN AND
    IS ANSWERED BY THE ROOT: a lexeme is not the surface string, it is the
    form the surface inflects from, and `segment()` is what computes it. So
    `lexeme` here is the ROOT, which is a strictly coarser and genuinely
    different partition from `token` -- `loves`, `loving` and `loved` are one
    lexeme and three tokens.

    WHAT THIS IS NOT: a sense-disambiguated lexeme. `bank` (river) and `bank`
    (money) are one lexeme here and two in a lexicon that carries senses. The
    `sense` capability is a SEPARATE resource for exactly that reason, and
    conflating them would be the collapse this docstring is about, one level
    up.
    """
    return root(getattr(u, "token_text", "") or "")


ENG_RESOURCES = {
    "morpheme_root": _root_of_unit,
    "morpheme_affix": _affix_of_unit,
    "lexeme": _lexeme_of_unit,
    "lexeme_sequence": _lexeme_of_unit,
    "lexeme_family": _root_of_unit,
}


def report(limit=25):
    """Coverage and the DISAGREEMENT WITH `g2p`, measured over the shipped
    lexicon. A resource that does not print where it differs from the module
    it borrowed its vocabulary from is asking to be trusted on assertion."""
    import lyric_harness as lh
    from quality import g2p as _g
    lex = lh.Lexicon()
    fb = _g.Fallback(lex)
    words = sorted(lex.entries)
    affixed = agree = differ = 0
    diffs = []
    for w in words:
        r, a = segment(w)
        if not a:
            continue
        affixed += 1
        gr = fb._suffix(w)
        gstem = gr.basis[0] if gr and gr.basis else None
        if gstem == r:
            agree += 1
        else:
            differ += 1
            if len(diffs) < limit:
                diffs.append((w, r, a, gstem))
    print(f"lexicon entries              {len(words)}")
    print(f"carrying a declared affix    {affixed} "
          f"({100.0 * affixed / max(1, len(words)):.1f}%)")
    print(f"  root AGREES with g2p       {agree}")
    print(f"  root DIFFERS from g2p      {differ}")
    print(f"\nfirst {len(diffs)} disagreements "
          f"(word -> this root + affix | g2p stem):")
    for w, r, a, gs in diffs:
        print(f"   {w:18s} -> {r:14s} {a:32s} | {gs}")


AFFIX_NAMES = tuple(sorted({name for _sfx, name in _TABLE}))

__all__ = ["AFFIX_NAMES", "MIN_ROOT", "DERIVATIONAL", "segment", "root",
           "affix", "ENG_RESOURCES", "report", "_known_words"]


if __name__ == "__main__":
    if "--report" in sys.argv:
        report()
    else:
        for w in ("singing", "sings", "sing", "loving", "loved", "love",
                  "hopeless", "kindness", "running", "cat", "deceivest",
                  "nation", "relation"):
            print(f"  {w:12s} -> {segment(w)}")
