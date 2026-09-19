"""The declared join from the `type` namespace to the 601-entry canon.

M-35's INTERIM GATE. The ruling of 2026-09-18 settled that a cross-tradition
name firing on an English pair must be LABELLED with the tradition it comes
from, "instead of being either silently fired or silently dropped", and said
the grader should read `relations.tradition_scope` "rather than growing a
second vocabulary".

**MEASURED, THAT ROUTE DOES NOT REACH THE FIRING PATH, AND THE TWO ROUTES THAT
LOOK LIKE IT BOTH FLATTEN THE ANSWER.** `tradition_scope` takes a
`relations.RelationSchema`. The names a mandate fires in the `type` namespace
live in `rhyme_types.NAMED`, which is a DIFFERENT table:

    type namespace                        76 names
    with a `relations.REGISTRY` row       26
    reachable through a schema's `aka=`    2  (`antya-prasa`, `higaad`)
    with neither                          48

So `tradition_scope` cannot be asked about 48 of 76, and of the 18 distinct
names measured FIRING on the three probe pairs `night`/`light`,
`mother`/`brother` and `love`/`move`, 15 are in that 48.

**AND THE TWO INHERITANCE ROUTES ARE WORSE THAN NO ANSWER.** Both were tried
and both are refused here, for ONE argument:

  - BY CELL. `NAMED`'s value is a SYNONYM TUPLE at one coordinate, so
    inheriting the cell's canon entries covers 66 of 76 names. It is wrong.
    `masculine rhyme`, `single rhyme`, `qafiya` and `antya-prasa` are the same
    cell -- English, English, Persian and Sanskrit -- so a cell is
    multi-tradition BY CONSTRUCTION, which is M-35's own thesis. Inheriting the
    union would report `qafiya` as `in_tradition` on an English draft, which is
    precisely the cross-tradition firing this gate exists to label.

  - BY `aka=`. `higaad` reaches the `alliteration` schema, whose sourced
    traditions are Old English, Japanese and Korean. A Somali name would come
    back attested in three languages that are not Somali.

Both routes answer a question about a RELATION where the gate asks a question
about a NAME. So the join is per NAME, and it is declared.

**WHAT IS DECLARED AND WHAT IS DERIVED.** A row declares only the canon entry
ids and the language codes. The tradition PROSE is read from
`quality/canon_index.tsv` at call time and is never retyped here, because a
citation typed by hand into a table is the defect the canon machinery exists to
close (doctrine 1). The language CODE is this file's mapping of the canon's
free-text tradition column onto a code a declaration can be compared against;
the canon does not carry codes, exactly as `relations._SOURCED` records of its
own rows.

**TOTALITY IS THE GATE.** Every name in the `type` namespace is in `SOURCED` or
in `UNSOURCED` with a written reason. There is no third state that silently
ships empty, and `check()` fails when the union stops being total -- so a name
added to `rhyme_types.NAMED` without a canon ruling is a failing check rather
than a silent blank.

**THIS MOVES NO VERDICT.** Nothing here is consulted by `satisfies_relation`,
by `grade()` or by any gate: it answers "which tradition does this name come
from", never "does this pair satisfy it". That is what the ruling meant by the
label being additive.
"""

from __future__ import annotations

import sys


#: THE INVENTORY CELL OF A CANON ENTRY IS ITS ID'S FIRST LETTER -- E C G S I X
#: -- which is the same partition `relations.cited_cells` reads out of the
#: canon's own rows. Named here rather than respelled as a literal at the two
#: sites below.
CELLS = "ECGSIX"


#: name -> (canon entry ids, language codes attested for THIS NAME).
#:
#: The ids are the canon's own; the codes are declared. A name whose canon
#: entries span several cells keeps them all -- `qafiya` is S1 (Arabic), S74
#: (Persian) and I29 (Persian/Urdu/Hindi ghazal), and collapsing those to one
#: would be the flattening this module refuses one paragraph up.
SOURCED = {
    # -- English and Scots literary, the E cell ---------------------------
    "additive rhyme": (("E12",), ("eng",)),
    "apocopated rhyme": (("E15", "X94"), ("eng", "spa")),
    "apocopated rhyme (penultimate stressed syllable)":
        (("E15", "X94"), ("eng", "spa")),
    "assonance": (("E4",), ("eng", "sco")),
    "broken rhyme": (("E32",), ("eng",)),
    "burden": (("E54",), ("eng",)),
    # E43 AND NOT E44, and the cell decides it rather than the name. The
    # engine's `chain rhyme` sits at a four-syllable full-identity PAIR cell
    # beside `multisyllabic rhyme`; E44 is the interlocking-SCHEME sense, a
    # property of a stanza's arrangement, which two words cannot be.
    "chain rhyme": (("E43",), ("eng",)),
    "compound rhyme": (("E31",), ("eng",)),
    "consonance": (("E5",), ("eng", "sco")),
    "cross rhyme": (("E38",), ("eng",)),
    "dactylic rhyme": (("E28",), ("eng", "sco")),
    "eye rhyme": (("E20",), ("eng", "sco")),
    "feminine rhyme": (("E27",), ("eng", "sco")),
    "forced-stress rhyme": (("E25",), ("eng",)),
    "head rhyme": (("E41",), ("eng",)),
    "historical rhyme": (("E21",), ("eng", "sco")),
    "holorhyme": (("E34", "X131"), ("eng", "fra")),
    "interlaced rhyme": (("E39",), ("eng",)),
    "internal rhyme": (("E36",), ("eng", "sco")),
    "leonine rhyme": (("E37",), ("eng",)),
    "masculine rhyme": (("E26",), ("eng", "sco")),
    "mosaic rhyme": (("E30",), ("eng", "sco")),
    "multisyllabic rhyme": (("E29",), ("eng",)),
    "pararhyme": (("E7",), ("eng",)),
    "perfect rhyme (last stressed syllable)": (("E1",), ("eng", "sco")),
    "phrasal rhyme": (("E31",), ("eng",)),
    "refrain rhyme": (("E54",), ("eng",)),
    "repetition": (("E3",), ("eng", "sco")),
    # TWO ENTRIES AND TWO TRADITIONS, not an ambiguity to resolve away: E2 is
    # the English naturalisation and X131 is the French. A normaliser picking
    # one of them would be picking a tradition (doctrine 45).
    "rime riche": (("E2", "X131"), ("eng", "fra")),
    "rime riche (last stressed syllable)": (("E2", "X131"), ("eng", "fra")),
    "semirhyme": (("E14",), ("eng",)),
    "slant rhyme (consonant)": (("E10",), ("eng", "sco")),
    "slant rhyme (vowel)": (("E10",), ("eng", "sco")),
    "subtractive rhyme": (("E13",), ("eng",)),
    "syllabic rhyme": (("E18",), ("eng",)),
    "syllabic rhyme (final unstressed syllable)": (("E18",), ("eng",)),
    "wrenched rhyme": (("E17",), ("eng",)),
    # `alliteration` is the widest of them: onset agreement is attested as a
    # constitutive device in three unrelated cells, and the E entry is not
    # privileged by being first.
    "alliteration": (("E9", "X36", "X54"), ("ang", "eng", "jpn", "kor")),
    "initial alliteration": (("E9",), ("ang", "eng")),

    # -- Celtic, the C cell ------------------------------------------------
    "cynghanedd lusg": (("C13",), ("cym",)),
    "cynghanedd lusg (identical onsets)": (("C13",), ("cym",)),
    # C1 IS THE CONSONANT SKELETON ITSELF -- `cyfatebiaeth gytsain` -- which is
    # what "the consonant answer" names, rather than any one of croes/traws.
    "cynghanedd (consonant answer)": (("C1",), ("cym",)),

    # -- Germanic, the G cell ----------------------------------------------
    "adalhending": (("G2",), ("non",)),
    "adalhending (identical onsets)": (("G2",), ("non",)),
    "skothending": (("G1",), ("non",)),
    # THE ENGINE NAME IS A SLASHED PAIR and maps to the canon's two entries,
    # one per member, rather than to either alone.
    "studlar/hofudstafr": (("G6", "G7"), ("non",)),
    "Kalevala alliteration (strong)": (("G83",), ("fin",)),
    "Kalevala alliteration (weak)": (("G82",), ("fin",)),

    # -- Indic, the I cell -------------------------------------------------
    "antya-prasa": (("I6",), ("san", "kan")),
    "anuprasa": (("I1",), ("san", "hin")),
    "anuprasa (second-aksara)": (("I1",), ("san", "hin")),
    "dvitiyakshara-prasa": (("I8",), ("kan", "tel", "san")),

    # -- Semitic and Persian, the S cell -----------------------------------
    "qafiya": (("S1", "S74", "I29"), ("ara", "fas", "hin")),
    "radif": (("S72", "I28"), ("fas", "tur", "hin")),
}


#: name -> why the 601 records no entry under THIS NAME.
#:
#: THREE ARGUED CLASSES, and every member of each carries the same argument
#: because it IS the same argument. A reason is written per name so that a
#: later sitting reads the ruling rather than rediscovering it.
UNSOURCED = {}

_SYNONYM_REASON = (
    "the 601 attests the RELATION -- {} -- and records no entry under this "
    "spelling; `quality/RHYME_CANON.md` does not contain the string either. "
    "The tradition is NOT inherited from the cell's other members: a NAMED "
    "cell is a synonym tuple across traditions (`masculine rhyme` sits with "
    "`qafiya` and `antya-prasa`), so inheriting the union would attest an "
    "English spelling in Persian and Sanskrit. That is the flattening M-35's "
    "gate exists to prevent, so it refuses here too (doctrine 20: a refusal "
    "is not an absence).")

for _n, _rel in (
        ("single rhyme", "E26 masculine rhyme"),
        ("double rhyme", "E27 feminine rhyme"),
        ("triple rhyme", "E28 dactylic rhyme"),
        ("rich rhyme", "E2 rime riche"),
        ("identical rhyme", "E3 repetition (same-word rhyme)"),
        ("homophone rhyme", "E3 repetition (same-word rhyme)"),
        ("sight rhyme", "E20 eye rhyme"),
        ("weak rhyme", "E18 syllabic rhyme"),
        ("unaccented rhyme", "E18 syllabic rhyme"),
        ("split rhyme", "E31 compound / phrasal rhyme"),
        ("internal alliteration", "E9 alliteration (onset agreement)"),
        ("head alliteration", "E9 alliteration (onset agreement)"),
):
    UNSOURCED[_n] = _SYNONYM_REASON.format(_rel)

_NARROWING_REASON = (
    "an ENGINE-INTERNAL narrowing of {}, which the 601 does attest. The canon "
    "records no entry for the narrowing, and declaring the parent's entry here "
    "would claim the tradition attests a distinction the engine drew. Doctrine "
    "20: the source cannot say, which is not the same as no tradition.")

for _n, _parent in (
        ("Kalevala alliteration (strong, closed syllable)",
         "G83 Kalevala strong alliteration"),
        ("Kalevala alliteration (weak, framed)",
         "G82 Kalevala weak alliteration"),
        ("adalhending-adjacent", "G2 aðalhending"),
        ("skothending-adjacent", "G1 skothending"),
        ("radif-adjacent", "S72 / I28 radīf"),
        ("dvitiyakshara-prasa (consonant only)",
         "I8 dvitīyākṣara-prāsa"),
        ("dvitiyakshara-prasa (full aksara)",
         "I8 dvitīyākṣara-prāsa"),
        ("apocopated rime riche", "E15 apocopated rhyme and E2 rime riche"),
        ("syllabic rime riche", "E18 syllabic rhyme and E2 rime riche"),
):
    UNSOURCED[_n] = _NARROWING_REASON.format(_parent)

UNSOURCED["higaad"] = (
    "no entry in the 601 records it, and the index carries NO Somali row at "
    "all -- measured, `tradition` matches /somali/ zero times. The `aka=` "
    "route reaches the `alliteration` schema, whose sourced traditions are "
    "Old English, Japanese and Korean, so taking them would attest a Somali "
    "name in three languages that are not Somali. `quality/relations.py` "
    "already names this shape `the gabay higaad error`; this row is that "
    "error refused rather than repeated.")

del _n, _rel, _parent


def _canon_rows():
    """-> {idx: row} for the 601-entry inventory, or None.

    Read through `quality/canon_sources.py`, which is the ONE reader of
    `quality/canon_index.tsv` in this tree, rather than re-parsing the file
    (doctrine 1).  `None` means the index could not be loaded, which makes
    every verdict below CANNOT TELL -- a checkout that knows it does not know,
    rather than an absence it never looked for (doctrine 28).

    NOT `relations.CANON`, which is a different table: that is the 61 RELATION
    records, each LISTING inventory indices, while these rows ARE the indices.
    The first draft of this module read it and reported all 67 of its own
    citations as bad ids, which is the two-tables defect this module exists to
    record, reproduced inside it.
    """
    try:
        from quality import canon_sources as _CS
    except ImportError:                                  # run as a script
        try:
            import canon_sources as _CS                  # type: ignore
        except ImportError:
            return None
    return _CS.index() if _CS.loaded() else None


def entries(name):
    """-> the canon entry ids declared for `name`, or () if unsourced."""
    row = SOURCED.get(name)
    return row[0] if row else ()


def languages(name):
    """-> the language codes declared for `name`, or ()."""
    row = SOURCED.get(name)
    return row[1] if row else ()


def cited_cells(name):
    """-> the inventory cells this name's canon entries sit in."""
    return {e[0] for e in entries(name) if e and e[0] in CELLS}


def scope(name, language):
    """Is this NAME being fired inside its own tradition?

    -> one of `relations.SCOPES`, so there is one scope vocabulary in the
    tree and not a second one for the `type` namespace:

      'in_tradition'  the declaration's language is among the languages the
                      canon attests THIS NAME in.
      'cell_cited'    this name's canon entries include this language's own
                      inventory cell, but no entry in it attests the name, so
                      the SOURCE cannot say either way.  Not evidence of
                      absence.
      'rule_shape'    the name IS sourced and this language's cell is not
                      cited at all.  The rule shape matched; the tradition did
                      not (doctrine 43).  This is the verdict M-44's open item
                      asks for: `adalhending` on an English pair.
      'unsourced'     nothing could be sourced for this name; `UNSOURCED[name]`
                      is the reason.

    An unknown name RAISES rather than answering, because a name this table has
    never ruled on is not a name with no tradition.
    """
    if name in UNSOURCED:
        return "unsourced"
    if name not in SOURCED:
        raise KeyError(
            f"{name!r} is in neither SOURCED nor UNSOURCED, so this module has "
            f"no ruling for it. Add a row with its canon entry, or a written "
            f"reason why the 601 records none; there is no third state.")
    if language in languages(name):
        return "in_tradition"
    from quality.relations import LANG_CELL
    cell = LANG_CELL.get(language)
    if cell and cell in cited_cells(name):
        return "cell_cited"
    return "rule_shape"


def label(name, language):
    """-> a one-line label for a name fired under `language`, or None.

    `None` where there is nothing to say -- the name is being fired inside its
    own tradition -- so a caller prints a line exactly when the ordinary
    reading would be wrong.  This is the whole of the interim gate.
    """
    sc = scope(name, language)
    if sc == "in_tradition":
        return None
    if sc == "unsourced":
        # ONE LINE HERE, THE ARGUMENT IN THE TABLE. The reasons run to a
        # paragraph each and several names share one verbatim, so printing
        # them inline buried the labels that name a tradition under repeated
        # prose. `UNSOURCED[name]` is the reason and is where a reader looks.
        return (f"{name!r} is UNSOURCED: the 601 records no entry under this "
                f"spelling, so no tradition is attached to it — see "
                f"`quality/type_canon.py` UNSOURCED for why (doctrine 20: a "
                f"refusal is not an absence).")
    rows = _canon_rows()
    if rows is None:
        return (f"{name!r} is sourced to {', '.join(entries(name))} but the "
                f"canon index could not be loaded, so the tradition CANNOT BE "
                f"TOLD here (doctrine 28).")
    where = "; ".join(f"{e}" for e in entries(name))
    langs = ", ".join(languages(name))
    if sc == "cell_cited":
        return (f"{name!r} is attested in {langs} ({where}) and the "
                f"{language!r} inventory cell is cited but names no tradition "
                f"for it, so the SOURCE CANNOT SAY whether it belongs to "
                f"{language!r}.")
    return (f"{name!r} comes from {langs} ({where}) and is being fired on a "
            f"{language!r} draft: the RULE SHAPE matched, the tradition did "
            f"not (doctrine 43).")


def check(argv=()):
    """Totality, resolution and disjointness.  -> exit code.

    SPELLED `--check` AT THE COMMAND LINE so `quality/pin_sweep.py` discovers
    it by its own rule -- that sweep finds an instrument by the flag it spells,
    and a module holding a pin nothing sweeps is the built-and-unreachable
    defect this tree names most often (M-21 measured 30 pin-holding files
    against 23 named in CI). Running it bare does the same thing; an
    unrecognised flag is refused rather than ignored (doctrine 20).

    THREE COUNTS, never summed (doctrine 79): names ruled sourced, names ruled
    unsourced, and names with no ruling at all.  The third is the only failure
    of totality, and it is what makes adding a name to `rhyme_types.NAMED`
    without a canon ruling a red check rather than a silent blank.
    """
    from quality import rhyme_types as _RT
    vocab = set(_RT.namespaced_vocabulary()["type"])
    both = sorted(set(SOURCED) & set(UNSOURCED))
    unruled = sorted(vocab - set(SOURCED) - set(UNSOURCED))
    stray = sorted((set(SOURCED) | set(UNSOURCED)) - vocab)
    rows = _canon_rows()
    bad = []
    if rows is not None:
        for n in sorted(SOURCED):
            for e in entries(n):
                if e not in rows:
                    bad.append((n, e))
    print(f"type namespace   {len(vocab)}")
    print(f"  SOURCED        {len(set(SOURCED) & vocab)}")
    print(f"  UNSOURCED      {len(set(UNSOURCED) & vocab)}")
    print(f"  UNRULED        {len(unruled)}")
    print(f"canon index      {'loaded' if rows else 'NOT LOADED (cannot tell)'}")
    fail = False
    for n in unruled:
        print(f"UNRULED  {n!r} is in neither table"); fail = True
    for n in both:
        print(f"IN BOTH  {n!r}"); fail = True
    for n in stray:
        print(f"STRAY    {n!r} is ruled here and is not a type name"); fail = True
    for n, e in bad:
        print(f"BAD ID   {n!r} cites {e!r}, which is not a canon entry"); fail = True
    print("DRIFT" if fail else "OK")
    return 3 if fail else 0


if __name__ == "__main__":                               # pragma: no cover
    _argv = tuple(sys.argv[1:])
    _bad = [a for a in _argv if a != "--check"]
    if _bad:
        print(f"REFUSED — type_canon takes only `--check`, not {_bad[0]!r}")
        sys.exit(2)
    sys.exit(check(_argv))
