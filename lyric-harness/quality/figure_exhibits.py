#!/usr/bin/env python3
"""ONE-LINE WITNESSES FOR THE INTRA-LINE FIGURES — the census's second evidence route.

WHY THIS FILE EXISTS. `quality/schema_census.py` gives a schema semantic
evidence only through `relations.DRAWABLE_EXHIBITS`, graded by `Reviser.grade`
over a declared mandate. That route is a PAIR route: a mandate group is a set
of lines, and `slots.mandate` REFUSES a within-line binding by name (it points
at `quality/figures.py`). So the schemas whose every placement is
intra-line (`figures.intra_line_schemas()`, 20 today) could never earn
evidence there, and all but `paroemion` sat `unvalidated` for a reason that
was not about them at all. (21 when this file was written: `broken rhyme`
left the roster 2026-09-25, when `a_is_split_token` stopped counting as an
intra-line placement — its partner is on the next line, so it is graded on
the pair route now.)

THE ROUTE IS THE ONE THAT READS THEM. Each exhibit is graded by
`figures.line_figures` — the per-line reader over `relations.realise` +
`relations.assemble`, which is the only code in the harness that reports a
same-line figure. NOTHING HERE RE-IMPLEMENTS A SCHEMA (doctrine 1), and
NOTHING HERE SUPPLIES A COORDINATE THE ROUTE DOES NOT SUPPLY ITSELF. Until
2026-09-25 `lifts` was the one exception — `figures.line_figures` called
`search_caesura` and not `search_lifts`, so the two lift schemas refused and
the Old Norse exhibit declared `supply=("lifts",)`. The route supplies both
frames now, so no exhibit declares a supply; `grade`'s `supply` hook is kept
for the next coordinate the route lacks, and adding one needs a finding.

PRODUCTION DOES NOT CALL THIS ROUTE. `Reviser.grade` / `revise.py` never import
`figures`; the `recover.py` and `schemes.py` sites only NAME it in a refusal.
So a `witness_and_contrast` here certifies the figures reader, and says
nothing about a revision loop honouring the figure. Recorded, not fixed.

WHAT EARNS `witness_and_contrast`. The witness line is found to carry the
figure AND the contrast line is found not to, both on the route, both
definite (a refusal is `None`, never `False` — doctrine 20). Anything else is
`unvalidated` with the exact verdicts in the blocker.

THE WITNESS IS CHOSEN BY THE TRADITION'S DEFINITION, NEVER BY THE GRADER.
Every witness below was picked from a cited public-domain text on the strength
of the figure's own description (RHYME_CANON / the cited index) and only then
graded. A witness the grader misses STAYS: swapping it for one the grader
happens to find would be tuning the exhibit to the gate, which is doctrine
58's trade in a different coordinate. A miss is a FINDING and is written into
FINDINGS with the verdicts it was measured at, so `test_figure_exhibits.py`
fails the day the grader moves and the prose goes stale (doctrine 17).

A CONTRAST IS A NEGATIVE CONTROL, NOT EVIDENCE OF A TRADITION. Where a
contrast is a constructed minimal edit of the witness it is labelled
`constructed` (doctrine 94); where a real line serves, it is cited. Doctrine
94's other half is why a contrast exists at all: a positive-case suite cannot
find a rule that is too generous.

PHONOLOGY IS THE TRADITION'S. Each exhibit names the registry `Tradition`
row it grades, and the exhibit's language must be that row's `lang` —
enforced by the test. Where no declared tradition has a phonology in
`quality/phonology/` the schema gets NO exhibit and a NO_EXHIBIT reason;
English is never substituted.

Run: python3 quality/figure_exhibits.py        # per-schema verdict table
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from quality import figures as F                            # noqa: E402
from quality import relations as R                          # noqa: E402
from quality.phonology import get as get_phonology          # noqa: E402

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

EVIDENCE = ("FIGURE_EXHIBITS through quality/figures.line_figures "
            "(relations.realise + assemble, the intra-line reader)")

_CYWYDD = "corpus/song/cym_cynghanedd_llywelyn_goch_cywydd.txt"
_CYWYDD_CITE = ("Llywelyn Goch ap Meurig Hen, 'Marwnad Lleucu Llwyd' "
                "(14th c.), 1862 Llanidloes printing of Evans's Specimens")
_WELSH_BASIS = ("classified by this session against the cited index's own "
                "description, not quoted from a handbook's worked example "
                "(project basis, stated so it is not read as external)")

#: name -> exhibit. `witness` / `contrast` are (lines, cite). `cite` is either
#: ("file", (line_no, ...)) — and the test checks the text is VERBATIM those
#: lines of that repo file — or ("constructed", how). `tradition` is the
#: registry Tradition row whose language grades it.
FIGURE_EXHIBITS = {
    "alliteration": {
        "lang": "eng", "tradition": "English alliteration",
        "witness": (["Full fathom five thy father lies;"],
                    ("corpus/song/eng_oxford_william_shakespeare.txt", (186,)),
                    "Shakespeare, The Tempest I.ii (Ariel's song), Oxford Book "
                    "of English Verse printing: f- on four words"),
        "contrast": (["Deep in the sea my parent rests"],
                     ("constructed", "same sense, no two words sharing an "
                      "onset"), ""),
    },
    "epanalepsis": {
        "lang": "eng", "tradition": "English epanalepsis",
        "witness": (["Dead is the Man whose Cause is dead,"],
                    ("corpus/song/eng_american_herman_melville.txt", (115,)),
                    "Melville, 'Stonewall Jackson': the line opens and closes "
                    "on one word"),
        "contrast": (["Dead is the Man whose Cause is lost,"],
                     ("constructed", "the witness with its last word "
                      "replaced"), ""),
    },
    "exact reduplication": {
        "lang": "eng", "tradition": "English exact reduplication",
        "witness": (["“It’s dull,” she wept, “and so-so!”"],
                    ("corpus/song/eng_british_lewis_carroll.txt", (2478,)),
                    "Carroll, 'Melancholetta': so-so, both halves identical"),
        # A REAL reduplication that is not EXACT: the onsets differ. The two
        # reduplication exhibits are each other's contrast on purpose — the
        # pair isolates the one channel (onset) that separates the schemas.
        "contrast": (["Helter-skelter,"],
                     ("corpus/song/eng_pah_robert_southey.txt", (299,)),
                     "Southey, 'The Cataract of Lodore': onsets differ"),
    },
    "rhyming reduplication": {
        "lang": "eng", "tradition": "English rhyming reduplication",
        "witness": (["Helter-skelter,"],
                    ("corpus/song/eng_pah_robert_southey.txt", (299,)),
                    "Southey, 'The Cataract of Lodore': helter / skelter"),
        "contrast": (["“It’s dull,” she wept, “and so-so!”"],
                     ("corpus/song/eng_british_lewis_carroll.txt", (2478,)),
                     "Carroll: exact, so the onsets AGREE and it is not "
                     "rhyming reduplication"),
    },
    "ablaut reduplication": {
        "lang": "eng", "tradition": "English ablaut reduplication",
        "witness": (["            Ding-dong, bell!"],
                    ("corpus/song/eng_oxford_william_shakespeare.txt", (195,)),
                    "Shakespeare, The Tempest I.ii (Ariel's song): the I-before-"
                    "O order R13 names (ding-dang-dong)"),
        "contrast": (["“It’s dull,” she wept, “and so-so!”"],
                     ("corpus/song/eng_british_lewis_carroll.txt", (2478,)),
                     "Carroll: a reduplication with NO vowel change (OW ~ "
                     "OW), so no I>A>O step. The forbidden REVERSED order "
                     "cannot be the contrast on this route: `Dong-ding` and "
                     "`Tock-tick` are unreadable whole tokens to the eng "
                     "reader, so they grade None, not False"),
    },
    "leonine rhyme": {
        "lang": "eng", "tradition": "English leonine rhyme",
        "witness": (["Once upon a midnight dreary, while I pondered, weak and weary,"],
                    ("corpus/song/eng_american_edgar_allan_poe.txt", (16,)),
                    "Poe, 'The Raven' l.1: dreary at the caesura, weary at "
                    "the line end"),
        "contrast": (["Once upon a midnight dreary, while I pondered, weak and tired,"],
                     ("constructed", "the witness with the line-end word "
                      "replaced"), ""),
    },
    "Kalevala alliteration (strong)": {
        "lang": "fin", "tradition": "Finnish Kalevala vahva alkusointu",
        "witness": (["vaka vanha Väinämöinen"],
                    ("corpus/fin_kalevala.txt", (696,)),
                    "Kalevala (Lönnrot 1849): va-/va- — consonant AND vowel "
                    "agree, the strong grade (R14)"),
        "contrast": (["lähteäni laulamahan,"],
                     ("corpus/fin_kalevala.txt", (3,)),
                     "Kalevala I: lä-/lau- — consonant agrees, vowel does "
                     "not: weak only"),
    },
    "Kalevala alliteration (weak)": {
        "lang": "fin", "tradition": "Finnish Kalevala heikko alkusointu",
        "witness": (["lähteäni laulamahan,"],
                    ("corpus/fin_kalevala.txt", (3,)),
                    "Kalevala I: l-/l- with differing vowels (R29)"),
        "contrast": (["lauloaksemme hyviä,"],
                     ("corpus/fin_kalevala.txt", (23,)),
                     "Kalevala I: l-/h-, no alliteration, no compound"),
    },
    "alliterative long line": {
        "lang": "non", "tradition": "Old Norse stuðlar / höfuðstafr",
        "witness": (["Vestr fórk of ver, en ek Viðris ber"],
                    ("joined", ("corpus/song/non_egils_saga_hofudlausn.txt",
                                (38, 39))),
                    "Egill, Höfuðlausn st.1 ll.1-2 (sagadb): the two printed "
                    "half-lines joined into the long line they form — the "
                    "join is this exhibit's, disclosed; V- stuðlar + "
                    "höfuðstafr"),
        "contrast": (["Heim fórk of sæ, en ek Þundar ber"],
                     ("constructed", "the witness with the three v- staves "
                      "replaced (h-, s-, þ-): no two STAVES agree"), ""),
    },
    "cynghanedd groes": {
        "lang": "cym", "tradition": "Welsh cynghanedd groes / cyfatebiaeth gytsain",
        "witness": (["A llyma fyd llwm i fardd!"],
                    (_CYWYDD, (43,)),
                    _CYWYDD_CITE + " l.2: A llyma fyd | llwm i fardd, "
                    "ll-m-f answered by ll-m-f before the accented vowels; "
                    + _WELSH_BASIS),
        "contrast": (["A llyma fyd trwm i fardd!"],
                     ("constructed", "llwm -> trwm: the answering ll broken"),
                     ""),
    },
    "cynghanedd sain": {
        "lang": "cym", "tradition": "Welsh cynghanedd sain",
        "witness": (["Llewelyn Goch, gloch dy glod;"],
                    (_CYWYDD, (59,)),
                    _CYWYDD_CITE + ": Goch ~ gloch odl, gloch ~ glod "
                    "gl- cytseinedd (C8); " + _WELSH_BASIS),
        "contrast": (["Llewelyn Goch, gloch dy fri;"],
                     ("constructed", "glod -> fri: the odl kept, the "
                      "alliterating third member removed"), ""),
    },
    "cynghanedd sain drosgl": {
        "lang": "cym", "tradition": "Welsh cynghanedd sain drosgl",
        "witness": (["Y marchog dyledog daid"],
                    ("quoted", "Guto'r Glyn, 'Moliant i Syr Rhisiart Gethin' "
                     "l.11, ed. Barry J. Lewis, Gwaith Guto'r Glyn (CAWCS, "
                     "gutorglyn.net), poem 1; read from the TEI source "
                     "mirrored at github.com/casglur/django-gutorglyn-2 "
                     "(SDPublisher/gutorglyn/texts/guto001.xml @cae45bdf). "
                     "Not a staged file: the edition's text is editorial "
                     "copyright, so ONE line is quoted, never staged"),
                    "THE EDITOR'S classification, not this session's: the "
                    "note to l.11 says both manuscript readings (`dyledog "
                    "daid` / `blodeuog blaid`) are acceptable 'o ran y mesur "
                    "a'r gynghanedd' and give 'sain drosgl'. marchog ~ "
                    "dyledog odl; dyledog, stressed on -le-, answered on its "
                    "word-initial d- by daid"),
        "contrast": (["Llewelyn Goch, gloch dy glod;"],
                     (_CYWYDD, (59,)),
                     _CYWYDD_CITE + ": plain sain (this file's own sain "
                     "witness) — the middle word `gloch` is a monosyllable, "
                     "so word start and stress coincide and nothing is "
                     "relocated. The route finds drosgl on 9 of the "
                     "cywydd's 108 lines (CYWYDD_COUNTS); none is claimed, "
                     "because the grader found them"),
    },
    "cynghanedd sain gadwynog": {
        "lang": "cym", "tradition": "Welsh cynghanedd sain gadwynog",
        "witness": (["Uwch dy fedd, hoew annedd haul,"],
                    (_CYWYDD, (57,)),
                    _CYWYDD_CITE + ": fedd ~ annedd odl (1st,3rd), hoew ~ haul "
                    "h- (2nd,4th) — the interleaved chain of C9; "
                    + _WELSH_BASIS),
        # A REAL sain line that is not chained: the plain-sain witness above.
        "contrast": (["Llewelyn Goch, gloch dy glod;"],
                     (_CYWYDD, (59,)),
                     "plain sain, no interleaving"),
    },
    "cynghanedd lusg": {
        "lang": "cym", "tradition": "Welsh cynghanedd lusg",
        "witness": (["Gwae fi, ferch wen o Bennal,"],
                    (_CYWYDD, (142,)),
                    _CYWYDD_CITE + ": wen ~ Benn-(al), the accented penult "
                    "of the final word (C13); " + _WELSH_BASIS),
        "contrast": (["Gwae fi, ferch deg o Bennal,"],
                     ("constructed", "wen -> deg: the rhyme on the penult "
                      "removed"), ""),
    },
    "平仄 tonal template": {
        "lang": "ltc", "tradition": "Chinese 平仄",
        "witness": (["白日依山盡"],
                    ("quoted", "王之渙 登鸛雀樓 l.1 (Tang, public domain); "
                     "not a staged file, so not checked verbatim"),
                    "graded against a SOURCED template only — none is on "
                    "main, so nothing is declared and the route refuses"),
        "contrast": (["白日依山盡"],
                     ("quoted", "the same line"),
                     "to be graded against a sourced template it breaks, "
                     "once one exists"),
    },
}


#: Schemas with NO exhibit, and why. Each reason names what would lift it.
NO_EXHIBIT = {
    "fourth lift must not alliterate":
        "no honest phonology for any declared tradition: Old English (ang) "
        "has no module in quality/phonology/; Welsh bai rhy debyg (C36) is a "
        "vowel-DIFFERENCE fault this lift/onset shape does not encode; the "
        "Chinese 撞韻 row is a rhyme-class rule, not a lift rule. Grading it "
        "under non or eng would be substituting a tradition the registry "
        "does not declare",
    "cynghanedd draws":
        "no witness this session can classify: draws needs the unanswered "
        "bridge located, and the cywydd's candidates were not separable from "
        "groes/o gyswllt without a handbook's worked example (none staged)",
    "cynghanedd groes o gyswllt":
        "no witness: C3 is `self_doubt=yes` and cites a WebSearch summary "
        "only; no staged handbook example of a split inside a cluster",
    "cynghanedd sain lafarog":
        "no witness this session can classify with confidence: C10's zero-"
        "onset pivot versus a vowel-initial word whose consonants are still "
        "answered (cywydd l.43 `uthrydd athrist`, th-r | th-r) is exactly "
        "the distinction a handbook example would settle, and none is staged",
}

#: FINDINGS — the grader, not the exhibit, is wrong (or cannot see). Keyed by
#: schema; `verdicts` is what was MEASURED (witness, contrast) when the text
#: was written. If the live verdicts differ, the census blocker says the
#: finding is STALE instead of quoting it (doctrine 17).
FINDINGS = {
    "平仄 tonal template": {
        "verdicts": (None, None),
        "text": "not a grader finding: the route REFUSES (tonal_template "
                "absent) because no sourced 平仄 template is on main, and "
                "this file will not declare one (the census's all-中 "
                "template is a fixture, doctrine 94). Lifts when a sourced "
                "table lands: declare it in `grade` for this exhibit.",
    },
}


def grade(name, lines, lang, supply=()):
    """-> (verdict, detail). True/False on the figures route; None = refused.

    One stream per exhibit, built under the exhibit's own phonology, and the
    ONLY extra call is a declared `supply` the route does not make itself.
    """
    st = R.build_stream(list(lines), get_phonology(lang),
                        declaration={"language": lang})
    for cap in supply:
        if cap == "lifts":
            R.search_lifts(st)
        else:
            raise ValueError(f"no supplier for {cap!r} — add one only with a "
                             f"finding that says the route lacks it")
    rep = F.line_figures(st, names=[name])
    detail = {"unreadable": [t for _, _, t in st.unreadable]}
    if rep["refused"]:
        detail["refused"] = rep["refused"]
        return None, detail
    hits = [f for fs in rep["lines"].values() for f in fs if f["schema"] == name]
    detail["instances"] = [(f["a"], f["b"]) for f in hits]
    if not hits and detail["unreadable"]:
        # No instance on a line with an UNREAD token is not an observed
        # absence: the figure may sit on the word nobody read. Doctrine 20 —
        # this was a False until 2026-09-25, and the ablaut contrast
        # `Dong-ding` (unreadable whole) was passing as a negative on it.
        return None, detail
    return bool(hits), detail


def grade_exhibit(name):
    ex = FIGURE_EXHIBITS[name]
    sup = ex.get("supply", ())
    w, wd = grade(name, ex["witness"][0], ex["lang"], sup)
    c, cd = grade(name, ex["contrast"][0], ex["lang"], sup)
    return [w, c], {"witness": wd, "contrast": cd}


def semantic_row(name):
    """The census row for an intra-line schema this file covers."""
    if name in NO_EXHIBIT:
        return {"status": "unvalidated", "evidence": EVIDENCE,
                "blocker": "no exhibit: " + NO_EXHIBIT[name]}
    verdicts, _ = grade_exhibit(name)
    ok = verdicts == [True, False]
    row = {"status": "witness_and_contrast" if ok else "unvalidated",
           "verdicts": verdicts, "evidence": EVIDENCE,
           "phonology": FIGURE_EXHIBITS[name]["lang"], "blocker": None}
    if ok:
        return row
    f = FINDINGS.get(name)
    if f and list(f["verdicts"]) == verdicts:
        row["blocker"] = f"FINDING (verdicts {verdicts}): {f['text']}"
    elif f:
        row["blocker"] = (f"recorded finding is STALE — measured "
                          f"{list(f['verdicts'])}, live {verdicts}; "
                          f"re-examine before quoting it (doctrine 17)")
    else:
        row["blocker"] = (f"witness/contrast graded {verdicts}, expected "
                          f"[True, False], and no finding is recorded")
    return row


#: The two cywydd-wide counts the prose above quotes, as (schema, lines with
#: the figure, lines read). Re-derived by `cywydd_counts()` and compared in
#: `test_figure_exhibits.py`, so the sentences cannot outlive the grader
#: (doctrine 48/58: the setting is the whole 108-line cywydd, one stream,
#: `figures.line_figures`, cym).
CYWYDD_COUNTS = {"cynghanedd sain drosgl": (9, 108),
                 "cynghanedd groes": (12, 108)}
#: What those counts were before the 2026-09-25 repairs, kept so the move is
#: visible (doctrine 17): sain drosgl 103 (the bare onset edge, no sain
#: figure), then 1 the same day with the relocation tested on the LAST word
#: — which the sourced witness (Gwaith Guto'r Glyn 1.11n) showed to be the
#: wrong word — and groes 0 (the whole skeleton compared, no stress stop). Against
#: the cym module's own `cynghanedd_scan` over the same 108 lines, the route's
#: groes 12 is the scanner's 11 plus l.86 `I Dduw Dad—addewid iawn;`, which
#: the scanner rejects at all six caesura placements — a disagreement between
#: two readers, recorded rather than settled here.


def cywydd_counts():
    lines = [ln.strip() for ln in open(os.path.join(HERE, _CYWYDD),
                                       encoding="utf-8")
             if ln.strip() and not ln.startswith(("#", "---", "["))]
    st = R.build_stream(lines, get_phonology("cym"),
                        declaration={"language": "cym"})
    rep = F.line_figures(st, names=list(CYWYDD_COUNTS))
    return {n: (len({ln for ln, fs in rep["lines"].items()
                     if any(f["schema"] == n for f in fs)}), len(lines))
            for n in CYWYDD_COUNTS}


def covered():
    return set(FIGURE_EXHIBITS) | set(NO_EXHIBIT)


def main():
    for name in sorted(covered()):
        row = semantic_row(name)
        print(f"{row['status']:22s} {name:34s} {row.get('verdicts', '')}")
        if row["blocker"]:
            print(f"{'':22s}   {row['blocker'][:160]}")


if __name__ == "__main__":
    main()
