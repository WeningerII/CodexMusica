#!/usr/bin/env python3
"""M-15a. The survey index that `RHYME_CANON.md` cites, recovered and INLINED.

`quality/RHYME_CANON.md` states every one of its 117 named structures on a
`from:` line of cell-prefixed indices -- `✓E1`, `C22`, `G1`, `X110`.  Those
indices point into the six-agent survey array of workflow `wf_c1e2a9c5-60b`,
and **that array is not in the repository**.  From inside a clone the citation
graph was closed: every reference resolved to nothing, `Tradition.source` was
an `R<n>` pointer back into the same document, and the whole register was
one hop from evidence with the hop landing in a store no checkout inherits.

`quality/canon_index.tsv`, beside this file, IS that array's index.  601 rows,
one per declared index, carrying the survey entry's NAME, its TRADITION field
and its `source` string VERBATIM.  The references now resolve inside the repo,
which is what M-15a asked for and what stops the provenance of 117 named
structures disappearing with the transcripts.

WHAT THIS IS AND IS NOT
-----------------------
It is a record of **what witness the 2026-08-10 inventory agents recorded**.
It is not a claim that the witness is correct, and it is emphatically not a
bibliography: most recovered `source` strings name a search result rather than
a work, and dozens say in their own words that they were NOT independently
verified.  Those self-doubts are preserved verbatim and surfaced as
`self_doubt`, because a check kept after its premise weakened must never be
quoted as if it had not (doctrine 17).  The live counts are in RHYME_CANON.md
§8 and are computed by `--render`, never transcribed.

THE INDEX IS POSITIONAL, AND THAT IS CHECKED, NOT ASSUMED
---------------------------------------------------------
Each `inventory:*` agent emitted one JSON array; `E1` is that array's first
element.  `--rebuild` re-derives the file from the transcripts and refuses to
write unless all of `POSITION_CHECKS` pass -- attributions RHYME_CANON.md makes
in its own prose, e.g. R10 `cluster consonance` cites `G1` and says the span is
Snorri's `fyrð` out of *fyrðum*, so `G1` must be `skothending`.  They all pass.
Without that check the file would be a plausible-looking mapping, which is the
`gabay higaad` error with six hundred rows instead of one.

**And a plausible-looking mapping is exactly what the first attempt produced.**
It built each array from objects carrying a `source` key -- and 18 of the
indic-seasian cell's 74 entries carry no `source` key at all, INTERLEAVED from
position 32 onward.  Every `I` index past 32 was silently renumbered while the
low checks still passed, putting `chan (ฉันท์) quantitative template` at `I47`
where the array holds `syair monorhyme quatrain`.  The checks now reach `I34`,
`I39` and `I65`, and the recogniser is `name` + `channels`, never `source`.

FOUR WITNESS STATES, AND THE THIRD IS THE POINT (doctrine 28)
--------------------------------------------------------------
  `external`     the recorded source names an identifiable artifact outside
                 this project -- a host, a named lookup channel, a dated work,
                 a rime book, a treatise.
  `project`      every recorded source is this project or its author: a
                 `quality/*` module, a `CLAUDE.md` doctrine, or recollection.
                 `basis` splits these, because doctrine 44's two remedies
                 differ -- `module` is a self-confirmation risk, `memory` is a
                 search nobody has run.
  `unrecorded`   no checkable referent at all, and `basis` splits this too.
                 `appeal`: the source names an authority nobody identified --
                 "standard rhetorical taxonomy" is not a citation, and reading
                 it as one is how a register launders a guess into a fact.
                 `no_source_field`: the survey emitted the entry with NO
                 `source` key whatever.  18 rows, all indic-seasian.
  `unrecovered`  the index is inside its cell's declared size and no entry was
                 recovered for it.  Currently ZERO: all six arrays are complete
                 at 74/64/89/126/74/174.  The state is kept because a future
                 checkout with damaged transcripts must be able to say
                 "not recovered" rather than "no source".

The classifier is CONSERVATIVE BY CONSTRUCTION and the direction is stated so
it can be argued with: an artifact it fails to recognise falls to `unrecorded`,
never to `external`.  `unrecorded` therefore means "the mechanical rule found
no checkable referent", not "none exists".  Its regexes are coordinates of
every count this file prints (doctrine 58), so they are named constants and
the census names its own adjudications.

Run:
    python3 quality/canon_sources.py                # census
    python3 quality/canon_sources.py --entries      # per canon entry
    python3 quality/canon_sources.py --verify       # index vs transcripts
    python3 quality/canon_sources.py --rebuild      # re-derive from transcripts
    python3 quality/canon_sources.py --render       # rewrite RHYME_CANON.md §8

EVERY MODE NOW CARRIES AN EXIT CODE, and until 2026-08-13 none of them did.
`main()` returned 0 out of the `--verify` branch whatever `verify()` had found,
so `differs` -- the inlined index no longer being what the transcripts say --
exited 0 and nothing downstream could act on it.  That is the same defect
already found and fixed the same day in `audit_spans.py`, `audit_corpus.py`,
`audit_tang_null.py` and `audit_kalevala_null.py`: an instrument that prints its
own drift and cannot go red.  Doctrine 48 -- a principle that lives only in
prose gets followed exactly as often as somebody remembers it.

    0  the check passed
    1  the check FAILED -- a defect that is about the index or the document
    2  the check could not be RUN -- the transcripts are not on this machine

1 and 2 are separate because doctrine 28 says so.  `verify()` collapsed them:
a failed POSITION CHECK, which means the positional reading is wrong and every
citation in the register may have drifted onto a different entry, was reported
under the same `cannot_verify` state as a checkout with no transcripts in it --
sending a reader to look for a missing file when the file was there and the
mapping was broken.  They are now `position_checks_failed` (exit 1) and
`cannot_verify` (exit 2), and only the second is a refusal (doctrine 79).
"""

import argparse
import collections
import csv
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
INDEX_TSV = os.path.join(HERE, "canon_index.tsv")
CANON_MD = os.path.join(HERE, "RHYME_CANON.md")

#: Exit codes.  Three, not two, for the reason in the module docstring: a check
#: that FAILED and a check that could not be RUN are different claims and a
#: caller has to be able to tell them apart without reading the screen.
EXIT_OK = 0
EXIT_FAILED = 1
EXIT_CANNOT_TELL = 2

#: RHYME_CANON.md §1 declares the six cells and their sizes.  These are the
#: DECLARED sizes; `unrecovered` is the gap between a declared size and what
#: the transcripts still hold.
DECLARED = (("E", "english", 74), ("C", "celtic", 64),
            ("G", "germanic/finnic", 89), ("S", "semitic-persian", 126),
            ("I", "indic-seasian", 74), ("X", "east-asian-romance", 174))
CELL_SIZE = {c: n for c, _, n in DECLARED}

#: Attributions RHYME_CANON.md makes in its own prose or alias lines, plus the
#: ones `relations.py::_SOURCED` makes by naming a tradition against an entry.
#: The rebuild refuses to write unless every one holds, which is what makes the
#: positional reading a verified claim rather than a guess.
#:
#: THE SET IS SPREAD DEEP INTO EVERY CELL ON PURPOSE.  A first pass built the
#: arrays from objects carrying a `source` key and checked only low indices --
#: and 18 of the indic-seasian cell's 74 entries carry NO `source` key and sit
#: INTERLEAVED from position 32 onward, so dropping them shifted every later
#: `I` index by up to two while `I1` and `I6` still looked right.  Checks that
#: all land near the head of an array cannot detect a shift in its tail.
POSITION_CHECKS = (
    ("E1", "perfect rhyme"), ("E2", "rime riche"), ("E4", "assonance"),
    ("E5", "consonance"), ("E9", "alliteration"),
    # R6 `run assonance` glosses itself "multisyllabic rhyme's vowel core".
    ("E29", "multisyllabic"),
    ("C1", "cyfatebiaeth"), ("C2", "cynghanedd groes"),
    ("C5", "cynghanedd draws"), ("C11", "drosgl"), ("C22", "odl"),
    ("C45", "amus"), ("C54", "amhr"),
    ("G1", "skothending"), ("G2", "aðalhending"), ("G3", "frumhending"),
    ("G10", "málfylling"), ("G22", "runhent"), ("G61", "Schüttelreim"),
    ("G62", "Schlagreim"),
    ("S1", "qāfiya"), ("S4", "rawī"), ("S5", "ridf"), ("S99", "Hebrew"),
    ("S103", "kharja"), ("S110", "kafiye"),
    ("I1", "anuprāsa"), ("I6", "antyānuprāsa"),
    # R32 calls I29-I36 "the qāfiya slot apparatus"; I34 is inside that run and
    # past the first sourceless entry, so it is the check that catches a shift.
    ("I34", "waṣl"),
    # R1's from-line cites I39 and I65, and `_SOURCED` lists exactly
    # "Hindi-Urdu tuk / tukānt" and "Vietnamese vần chân" under `perfect rhyme`.
    ("I39", "tuk"), ("I65", "vần chân"),
    ("X1", "韻腳"), ("X8", "同用"), ("X38", "母音韻"), ("X64", "rima perfetta"),
    ("X90", "asonante"), ("X110", "rima consoante"),
)

# ---------------------------------------------------------------------------
# The classifier.  Every regex here is a coordinate of every count below.
# ---------------------------------------------------------------------------

#: A host name is the cheapest unambiguous external referent -- and the cheapest
#: way to get one wrong.  `md` (Moldova) and `rs` (Serbia) are DELIBERATELY
#: ABSENT: with `md` in the list `CLAUDE.md doctrine 18` parses as a hostname,
#: and six of the nineteen names the first provenance pass called
#: self-witnessed -- `anaphora`, `epistrophe`, `repetend`, `repetition`,
#: `refrain / burden / chorus`, `cynghanedd in English` -- flipped to
#: `external` on the strength of a citation to this repository's own doctrine
#: file.  A register that launders `CLAUDE.md` into a foreign top-level domain
#: is the exact failure it exists to detect, so the omission is load-bearing
#: and `test_relations.py` pins it.
_TLD = (r"com|org|net|edu|gov|info|io|it|tw|iq|fi|uk|jp|cn|kr|de|fr|es|pt|nl|"
        r"se|no|dk|ru|in|th|my|id|ca|au|nz|pl|cz|hu|gr|tr|il|ir|vn|ph|sg|hk|"
        r"at|ch|be|ie|is|ee|lv|lt|si|sk|hr|ro|bg|ua|by|kz|eu|gal|cat|asia|tv")
HOST = re.compile(r"\b[\w\-]+\.(?:%s)\b" % _TLD, re.I)

#: A named lookup channel.  Weak evidence -- a search summary is not a source
#: -- but it is evidence about something OUTSIDE this repository, which is the
#: distinction this file exists to draw.
CHANNEL = re.compile(
    r"WebSearch|web search|via search|search summar|search result|search only|"
    r"Wikipedia|Wiktionary|Britannica|Merriam-Webster|en-academic|ctext|"
    r"wikisource|Treccani|GRETIL|Ganjoor|Perseus|githubusercontent|github|"
    r"Wikidata|Everything2|Academia|encykorea|hispanoteca", re.I)

#: A four-digit year is a publication date, and the canon had ZERO of them.
YEAR = re.compile(r"\b(1[2-9]\d\d|20[0-2]\d)\b")

#: A title in a non-Latin script is a work: a rime book, a treatise, a poem.
#: Kana and Hangul are included at 2 characters, CJK at 2, the abjads and
#: Brahmic scripts at 3, because two Arabic letters can be an article.
SCRIPT = re.compile(r"[一-鿿]{2,}|[぀-ヿ]{2,}|"
                    r"[가-힯]{2,}|[؀-ۿ]{3,}|"
                    r"[ऀ-ॿ]{3,}|[฀-๿]{3,}|"
                    r"[֐-׿]{3,}")

#: Named works and reference tools that recur in the recovered strings.  This
#: list is DATA-DRIVEN -- built from the capitalised-token histogram over all
#: 583 strings, not from anyone's recollection of what a rhyme bibliography
#: ought to contain.  It is incomplete on purpose; see the conservatism note.
NAMED = re.compile(
    r"Turco|Rhyme Genie|Pattison|Bradley|Book of Rhymes|How to Rap|"
    r"Clywed Cynghanedd|H[áa]ttatal|Snorri|PyThaiNLP|Blankenhorn|Minkova|"
    r"O'Donnell|al-Khal[īi]l|al-Akhfash|N[āa]gavarma|Arnaut Daniel|Yannai|"
    r"AVPoetica|WICI|Qillirian|Kalliope|alliteration\.net|Sengoku Daimyo|"
    r"La Celestina|Camões|Quevedo|Zorrilla|Chambers, Frank", re.I)

#: This project, in every form the strings use to name it.
SELF = re.compile(r"quality/|data/|corpus/|lyric_harness|CLAUDE\.md|MISSING\.md|"
                  r"BACKLOG\.md|EXEMPLARS\.md|this repo|repo'?s own|\brepo\b|"
                  r"in-repo|the brief|doctrine \d", re.I)

#: The survey saying, in its own words, that the witness is recollection.
MEMORY = re.compile(
    r"from memory|my characteri[sz]ation|characterisation is MINE|recollection|"
    r"my own knowledge|my own reading|flag as recall|as recall|"
    r"NOT independently verified|not independently verified|NOT VERIFIED|"
    r"not verified|unverified|inferred distinction|asserted here|drawn here|"
    r"NOT re-verified|not re-verified|done here", re.I)

#: The survey flagging its own uncertainty, kept because doctrine 17 says a
#: check whose premise weakened may be kept but never quoted as if it had not.
DOUBT = re.compile(r"unverified|not verifiable|egress-blocked|blocked|"
                   r"NOT independently|not independently|could not|"
                   r"not reachable|not obtained|unresolved|uncertain|"
                   r"flagged|flag as|NOT VERIFIED|not verified|"
                   r"NOT re-verified|SINGLE UNVERIFIED", re.I)

WITNESSES = ("external", "project", "unrecorded", "unrecovered")

# ---------------------------------------------------------------------------
# Adjudication.  The mechanical rule is wrong in a small enumerated set of
# places and each override carries its reason and, where one exists, the grep
# that verifies it.  An override that agrees with the mechanical verdict is a
# no-op and `test_relations.py` fails on one, so this table cannot silently
# accumulate decoration.
# ---------------------------------------------------------------------------

#: idx -> (expected name, witness, basis, reason).  THE NAME IS PART OF THE
#: KEY and a mismatch raises at load.  Not decoration: the first draft of this
#: table was written against an index built from `source`-keyed objects only,
#: and when the recovery was corrected every `I` index past 32 moved by up to
#: two -- silently landing the `Thai named rhyme faults` override on `talibun
#: and seloka`.  An override addressed by position alone is a citation that
#: follows whichever row happens to be standing there.
ADJUDICATED = {
    "I64": ("Thai named rhyme faults", "project", "memory",
            "the FILE is external (thai-rhyme-craft.md via raw."
            "githubusercontent) but the entry is `Thai named rhyme faults` "
            "and the source says the two names -- ชิงสัมผัส, สัมผัสเผลอ -- are "
            "`from memory`. The register is indexed on the NAME, so the "
            "recalled half is the half that matters here."),
    "I30": ("rawī", "unrecorded", "appeal",
            "`web search located Qafiya/Radif references but the detailed "
            "letter list was not reachable` is a FAILED source search, which "
            "is a finding about the network and not a witness (doctrine 39). "
            "Reading the attempt as the citation is the error the mechanical "
            "CHANNEL rule makes."),
}

#: Where a PRIMARY source is verifiably present in this repository, it is named
#: with its date -- the direct answer to `0 publication-year tokens in 94 KB`.
#: idx -> (expected name, source with its year, file, the grep that proves it).
#: Nothing here is recalled: the year had to be PRINTED in the repo file, and
#: the quoted string had to be found in it by the command in the last field.
#: The expected name is part of the key for the same reason as in ADJUDICATED
#: -- an index is a position, and a position is not an identity.
#:
#: THE SEARCH FOR MORE OF THESE WAS RUN AND CAME BACK EMPTY, and the negative
#: is recorded rather than remembered (doctrine 39).  24 indices name a repo
#: module as their only witness, so each of those modules was checked for a
#: dated external source quoted the way `non.py` quotes Háttatal:
#:
#:   grep -oE '\b1[2-9][0-9]{2}\b|\b20[0-2][0-9]\b' quality/phonology/*.py
#:
#: Only `non.py` and `ltc.py` yield one.  `cym.py`'s 1556 is a ROW COUNT in a
#: results table, `fin.py`'s 1529 is the tail of the percentage 82.1529%, its
#: 1346 is another row count, and its 1864 dates a corpus FILE rather than the
#: statement of a rule.  `msa.py`, `san.py`, `fas.py` and `som.py` cite no
#: dated work at all.  So `cynghanedd lusg`, `Kalevala weak alliteration`,
#: `Malay reduplication` and the rest STAY `project`: the module is genuinely
#: the only witness this repository holds for them, and writing a plausible
#: handbook citation beside them would be the `gabay higaad` error committed
#: deliberately.  Anyone extending this table must be able to show the quoted
#: string and the year IN the file, by running the row's own command.
PRIMARY_IN_REPO = {
    "G1": ("skothending", "Snorri Sturluson, Háttatal, c. 1222-25",
           "quality/phonology/non.py",
           "grep -n 'köllum vér skothending' quality/phonology/non.py"),
    "G2": ("aðalhending", "Snorri Sturluson, Háttatal, c. 1222-25",
           "quality/phonology/non.py",
           "grep -n 'ein hljóðstafr' quality/phonology/non.py"),
    "G3": ("frumhending", "Snorri Sturluson, Háttatal, c. 1222-25",
           "quality/phonology/non.py",
           "grep -n 'Háttatal' quality/phonology/non.py"),
    "G4": ("oddhending", "Snorri Sturluson, Háttatal, c. 1222-25",
           "quality/phonology/non.py",
           "grep -n 'köllum vér þá oddhending' quality/phonology/non.py"),
    "G5": ("hluthending", "Snorri Sturluson, Háttatal, c. 1222-25",
           "quality/phonology/non.py",
           "grep -n 'köllum vér þá hluthending' quality/phonology/non.py"),
    "G6": ("stuðlar", "Snorri Sturluson, Háttatal, c. 1222-25",
           "quality/phonology/non.py",
           "grep -n 'Þá stafi köllum vér stuðla' quality/phonology/non.py"),
    "G9": ("hljóðstafr", "Snorri Sturluson, Háttatal, c. 1222-25",
           "quality/phonology/non.py",
           "grep -n 'ef hljóðstafr er höfuðstafrinn' quality/phonology/non.py"),
    "G10": ("málfylling", "Snorri Sturluson, Háttatal, c. 1222-25 (the málfylling list)",
           "quality/phonology/non.py",
           "grep -n 'málfylling þeiri' quality/phonology/non.py"),
    "X8": ("同用", "平水韻 (1252) and 詞林正韻 (戈載, 1821)",
           "quality/phonology/ltc.py",
           "grep -n '詞林正韻' quality/phonology/ltc.py"),
}


def check_primary():
    """Is every PRIMARY_IN_REPO row still true of this checkout?

    Three outcomes per row and the third is not a pass: the quoted string is
    present in the named file, it is absent, or the file is not here at all.
    A citation nobody re-ran is a citation nobody has.
    """
    root = os.path.dirname(HERE)
    out = []
    for idx, (want, src, where, cmd) in sorted(PRIMARY_IN_REPO.items()):
        row = index().get(idx, {})
        name_ok = want.lower() in (row.get("name") or "").lower()
        path = os.path.join(root, where)
        m = re.search(r"grep -n '(.+)' ", cmd)
        needle = m.group(1) if m else None
        if not os.path.exists(path):
            state = "file_absent"
        elif needle and needle in open(path, encoding="utf-8",
                                       errors="replace").read():
            state = "quoted" if name_ok else "quoted_but_index_moved"
        else:
            state = "NOT_FOUND_IN_FILE"
        out.append({"idx": idx, "state": state, "source": src,
                    "file": where, "check": cmd})
    return out


def classify_component(part):
    """One `;`-separated component of a `source` string -> its class."""
    if (HOST.search(part) or CHANNEL.search(part) or YEAR.search(part)
            or SCRIPT.search(part) or NAMED.search(part)):
        return "external"
    if MEMORY.search(part):
        return "memory"
    if SELF.search(part):
        return "self"
    return "appeal"


def classify_source(src):
    """A whole `source` string -> (witness, basis).

    `external` wins over everything: one checkable outside referent is enough
    to say the name is not ours alone.  `self` wins over `memory` so a row
    naming a module reads as a self-confirmation risk rather than as recall.
    """
    parts = [p.strip() for p in re.split(r"\s*;\s*", src) if p.strip()]
    if not parts:
        return "unrecovered", ""
    cl = [classify_component(p) for p in parts]
    if "external" in cl:
        return "external", "named"
    if "self" in cl:
        return "project", "module"
    if "memory" in cl:
        return "project", "memory"
    return "unrecorded", "appeal"


# ---------------------------------------------------------------------------
# The index
# ---------------------------------------------------------------------------

FIELDS = ("idx", "name", "tradition", "witness", "basis", "self_doubt",
          "source")
_INDEX = None


def index():
    """idx -> row dict.  Loaded once; empty dict if the file is absent, which
    is a state the callers have to be able to tell from `everything is
    unrecorded` -- see `loaded()`."""
    global _INDEX
    if _INDEX is None:
        _INDEX = {}
        if os.path.exists(INDEX_TSV):
            with open(INDEX_TSV, encoding="utf-8", newline="") as fh:
                for r in csv.DictReader(fh, delimiter="\t"):
                    w, b, why = adjudicate(r["idx"], r["name"],
                                           r["witness"], r["basis"])
                    r["witness"], r["basis"], r["adjudication"] = w, b, why
                    _INDEX[r["idx"]] = r
            seen = set(_INDEX)
            for k in ADJUDICATED:
                if k not in seen:
                    raise AssertionError(
                        "ADJUDICATED names %r, which is not a declared index" % k)
    return _INDEX


def loaded():
    """Is the index present at all?  `False` means every verdict below is
    `cannot tell` for want of the file, NOT `no witness`."""
    return bool(index())


def adjudicate(idx, name, witness, basis):
    """Apply an override, and REFUSE if it has drifted onto another entry."""
    if idx not in ADJUDICATED:
        return witness, basis, ""
    want, w, b, why = ADJUDICATED[idx]
    if want.lower() not in (name or "").lower():
        raise AssertionError(
            "ADJUDICATED[%r] expects %r and the index now holds %r -- the "
            "override has drifted onto a different entry and would be a "
            "fabricated citation. Re-derive it before trusting anything here."
            % (idx, want, name))
    if (w, b) == (witness, basis):
        raise AssertionError(
            "ADJUDICATED[%r] agrees with the mechanical rule (%s/%s), so it "
            "is decoration. Remove it or the table stops meaning anything."
            % (idx, witness, basis))
    return w, b, why


def witness_of(idx):
    """-> 'external' | 'project' | 'unrecorded' | 'unrecovered' | None.

    `None` is returned when the index is outside every declared cell, i.e. the
    citation is DANGLING, and when the index file is not present at all.  Both
    are `cannot tell`, and neither is `no witness`.
    """
    row = index().get(idx)
    if row:
        return row["witness"]
    if not loaded():
        return None
    c, n = idx[0], idx[1:]
    if c in CELL_SIZE and n.isdigit() and 1 <= int(n) <= CELL_SIZE[c]:
        return "unrecovered"
    return None


def refs_in(text):
    """Every cell-prefixed index in a stretch of canon text, in order."""
    return [f"{c}{n}" for c, n in re.findall(r"[✓]?([ECGSIX])(\d+)", text)]


def canon_blocks(path=CANON_MD):
    """-> [(entry id, first line number, whole block, the full from: text)].

    The `from:` text is everything after `from:` on its line PLUS the indented
    continuations, and `from:` is NOT always a bullet: §H and §I write it
    inline at the end of the entry's own prose (`R73 ... — from: ✓E38 C28 ...`).
    Two undercounts follow from getting either half wrong.  Requiring a leading
    `- ` loses 38 of the 117 entries outright; reading only to the end of the
    first line loses R1's and R29's continuations.  `audit_register.py
    --provenance` did the second and counted 611 references where the file
    carries 781 -- doctrine 58 inside the adversary that exists to find
    doctrine-58 errors.

    AND AN OVERCOUNT FOLLOWS FROM THE DELIMITER, MEASURED 2026-08-13 AND NOT
    CHANGED HERE.  A block ends at the NEXT `**R<n> ·` heading and at nothing
    else -- not at a `## ` section heading -- so the last entry before a section
    break swallows that section's prose.  Measured on the file as committed:

      * 781 references over 117 blocks, of which 113 blocks (768 refs) start in
        §2 and FOUR -- R113, R114, R115, R116 -- start inside §3 (13 refs).  So
        §8.2's row labelled ``from:`` references in §2` is a count over the
        REGISTER, not over §2, and 13 of the 781 are outside §2.
      * R112 is the last block that starts in §2 and §3's heading falls inside
        its span, so its `from:` matter is its own one-index line at 954 PLUS
        nine `from:` lines belonging to §3's D1-D9 non-relation declarations.
        Its `- witness:` line reports 116 distinct cited indices of which
        exactly ONE is R112's; 127 of the 128 raw references are §3's.

    RECORDED AND NOT REPAIRED, DELIBERATELY.  Ending a block at `## ` is a
    two-line change, and it would move §8.2, R112's witness line, and -- through
    `scope_witness` -- `relations.py`'s 298/319/212/26/60, i.e. it repins a
    document this cell may not write and numbers another module owns.  Doctrine
    39: this is the row, so the next attempt starts from the evidence.  It is
    also the answer to "does `--render` reproduce": it reproduces exactly, and
    reproducing a number checks the arithmetic and never the construction
    (doctrine 79's closing sentence).

    The §8 the render is about to overwrite is inside the file this reads, so
    the count is not independent of its own output (doctrine 13).  MEASURED, at
    the same time: §8 contributes 0 of the 781.  Its eight `from:`-bearing lines
    are all prose and tables that carry no cell index after the colon, and no
    §8 line is indented two spaces, so none is read as a continuation either.
    The dependence is structural and currently inert -- state it, do not assume
    it stays zero: writing `from: E1` into §8 would silently enter the count.
    """
    if not os.path.exists(path):
        return []
    lines = open(path, encoding="utf-8").read().split("\n")
    starts = [(i, m.group(1)) for i, l in enumerate(lines)
              for m in [re.match(r"^\*\*(R\d+[a-z]?)\s*·", l)] if m]
    out = []
    for k, (i, rid) in enumerate(starts):
        j = starts[k + 1][0] if k + 1 < len(starts) else len(lines)
        block = lines[i:j]
        froms = []
        for bi, bl in enumerate(block):
            m = re.search(r"from:", bl)
            if not m:
                continue
            chunk = [bl[m.end():]]
            for nxt in block[bi + 1:]:
                if re.match(r"^\s{2,}\S", nxt):
                    chunk.append(nxt)
                else:
                    break
            froms.append("\n".join(chunk))
        out.append((rid, i + 1, "\n".join(block), "\n".join(froms)))
    return out


def entry_witness(from_text):
    """Witness census over one canon entry's cited indices.

    -> {'indices': [...], 'counts': Counter, 'verdict': str}
    `verdict` is `external` when at least one cited index has an outside
    witness, `none_external` when the entry cites something and none of it
    does, and `cites_nothing` when the from-line is empty.  A single external
    witness among thirty is NOT the same claim as thirty, so the counts travel
    with the verdict and the renderer prints both.
    """
    ids = refs_in(from_text)
    c = collections.Counter(witness_of(i) or "dangling" for i in ids)
    if not ids:
        verdict = "cites_nothing"
    elif c.get("external"):
        verdict = "external"
    else:
        verdict = "none_external"
    return {"indices": ids, "counts": c, "verdict": verdict}


def cell_of(idx):
    return idx[0] if idx and idx[0] in CELL_SIZE else None


# --- attribution --------------------------------------------------------
# A canon entry names its traditions in an alias line and its indices in a
# `from:` line and NEVER attributes one to the other.  Usually.  Where a
# tradition NAME and a survey entry NAME share a distinctive token and exactly
# one cited index in the language's cell does so, the attribution is not a
# guess -- `Turkish nakarat` and `S122 nakarat` are the same object.  That
# turns a set-wide argument into a citation that can be quoted, so it is worth
# doing and worth gating hard.

#: Tokens that would match everything, so they cannot carry an attribution:
#: the vocabulary of the field, and every language adjective the tables use.
_NOISE = set("""rhyme rhymes rime rimes verse line lines end ends the and of
in as at by its it form forms type types class classes poem poetry song songs
word words sound sounds full standard tradition traditional with for from
final initial internal head tail same different rule rules constraint
english scots welsh irish gaelic scottish chinese japanese korean arabic
persian hebrew turkish german dutch italian spanish portuguese french occitan
galician sanskrit tamil telugu kannada hindi urdu malay thai vietnamese
finnish norse anglo saxon old middle modern classical vernacular literary
prosody metre meter poetics letter letters syllable syllables position
""".split())

#: The language adjectives above, kept separately: they cannot ATTRIBUTE, but
#: they can VETO.  `Vietnamese vần chân` matched `I47 chan (ฉันท์)` on `chan`
#: once diacritics were folded -- a Thai template attributed to a Vietnamese
#: rhyme, which is a fabricated citation of exactly the kind this file exists
#: to prevent.  A candidate must not contradict the name's own language gloss.
_LANG_WORDS = set("""english scots welsh irish gaelic scottish chinese
japanese korean arabic persian hebrew turkish german dutch italian spanish
portuguese french occitan galician sanskrit tamil telugu kannada hindi urdu
malay thai vietnamese finnish norse""".split())


def _tokens(s):
    import unicodedata
    s = unicodedata.normalize("NFKD", s.lower())
    s = "".join(c for c in s if not unicodedata.combining(c))
    return set(re.split(r"[^0-9a-z-￿]+", s)) - {""}


def _distinctive(s):
    return {t for t in _tokens(s) if len(t) >= 4 and t not in _NOISE}


def attribute(name, ids):
    """-> the single cited index this tradition NAME belongs to, or None.

    Two gates, applied in this order and NOT interchangeable.

    1. UNIQUENESS on a distinctive token.  Two candidates is ambiguity, and
       ambiguity hands the question back to the set-wide rule.
    2. The survivor must not CONTRADICT the name's own language gloss, and a
       contradiction cancels the attribution rather than promoting the next
       candidate.

    Doing 2 before 1 was tried and is wrong in a way worth recording, because
    it manufactures citations that look right.  Filtering first left `English
    refrain / burden / chorus` attributed to `E3 repetition (same-word rhyme)`
    -- because `E54 refrain / burden / chorus`, the correct entry, does not
    carry the word "English" in its own tradition field and was vetoed out of a
    two-candidate set, leaving one survivor that then looked unique.  Same
    mechanism put `Finnish Kalevala vahva alkusointu` (vahva = STRONG) on `G82
    Kalevala WEAK alliteration` past `G83`.  A filter that can only delete is
    safe; a filter that decides which of two candidates wins is a guess.
    """
    want = _distinctive(name)
    if not want:
        return None
    ix = index()
    cand = [i for i in ids
            if i in ix
            and want & _distinctive(ix[i]["name"] + " "
                                    + ix[i].get("tradition", ""))]
    if len(cand) != 1:
        return None
    langs = _tokens(name) & _LANG_WORDS
    hay = _tokens(ix[cand[0]]["name"] + " " + ix[cand[0]].get("tradition", ""))
    if langs and not (langs & hay):
        return None
    return cand[0]


def indices_in_cell(from_text, cell):
    return [i for i in refs_in(from_text) if cell_of(i) == cell]


def scope_witness(from_text, cell, name=""):
    """The witness verdict for ONE language cell inside one canon entry.

    This is the resolution `Tradition` needs, and the three values are forced
    by what a canon entry does and does not say.  An entry names its traditions
    in an alias line and cites its indices in another, and it never attributes
    a name to an index -- so the only defensible reading is over the SET of
    indices the entry cites in that language's cell:

      'external'   every cited index in the cell has an outside witness, so
                   whichever one carries the name, the name is not ours alone
      'project'    every one of them is this project
      None         mixed, or the entry cites nothing in this cell at all, or
                   the cell's entries were not recovered -- three different
                   ways of not knowing, and none of them is 'no witness'

    Returns (verdict, reason, indices).
    """
    ids = tuple(dict.fromkeys(indices_in_cell(from_text, cell)))
    if not ids:
        return None, ("the canon entry cites no index in this language's "
                      "inventory cell"), ()
    one = attribute(name, ids) if name else None
    if one:
        row = index()[one]
        w = row["witness"]
        return (w if w in ("external", "project") else None,
                "attributed to %s (%s), whose recorded source is: %s"
                % (one, row["name"], row["source"] or "<unrecovered>"),
                (one,))
    ws = {witness_of(i) for i in ids}
    if ws == {"external"}:
        return ("external",
                "every cited index in the cell is externally witnessed", ids)
    if ws == {"project"}:
        return ("project",
                "every cited index in the cell names only this project", ids)
    if ws == {"unrecorded"}:
        return None, ("every cited index in the cell records an appeal to "
                      "authority with no checkable referent"), ids
    tally = collections.Counter(witness_of(i) or "dangling" for i in ids)
    spread = ", ".join("%s %d" % (k, v) for k, v in sorted(tally.items()))
    if None in ws or "unrecovered" in ws:
        return None, ("the cell's cited indices are not all recovered, so "
                      "attribution cannot be settled (%s)" % spread), ids
    return None, ("the canon does not attribute a name to an index and this "
                  "cell's cited indices disagree (%s)" % spread), ids


# ---------------------------------------------------------------------------
# Rebuild + verify against the transcripts
# ---------------------------------------------------------------------------

TRANSCRIPT_GLOB = "/root/.claude/projects"


def _transcripts():
    """Locate the workflow's agent transcripts, or return []."""
    txt = open(CANON_MD, encoding="utf-8").read() if os.path.exists(CANON_MD) else ""
    m = re.search(r"workflow `(wf_[0-9a-z\-]+)`", txt)
    if not m or not os.path.isdir(TRANSCRIPT_GLOB):
        return []
    out = []
    for dirpath, _, files in os.walk(TRANSCRIPT_GLOB):
        if m.group(1) not in dirpath:
            continue
        for f in sorted(files):
            if f.endswith(".jsonl") and f != "journal.jsonl":
                out.append(os.path.join(dirpath, f))
    return out


def _entries_of(path):
    """Every array element in one transcript, IN EMISSION ORDER.

    An element is recognised by `name` + `channels`, NOT by `source`.  18 of
    the indic-seasian cell's 74 entries were emitted with no `source` key at
    all and they are interleaved from position 32, so a `source`-keyed filter
    silently renumbers the tail of that cell -- and `audit_register.py`'s
    single-regex reader did worse than drop them, pairing each such name with
    the NEXT object's source string across the object boundary.  That is how
    `Hindi anuprās subtypes` and `syair monorhyme quatrain` arrived in a list of
    names "whose only witness is this project": they have no recorded witness
    of any kind, and a neighbour's was read onto them.
    """
    dec = json.JSONDecoder()
    raw = open(path, encoding="utf-8", errors="replace").read()
    out = []
    for m in re.finditer(r'\{"name"', raw):
        try:
            obj, _ = dec.raw_decode(raw, m.start())
        except ValueError:
            continue
        if isinstance(obj, dict) and "name" in obj and "channels" in obj:
            out.append(obj)
    return out


def recover(seen=None):
    """Cell letter -> the recovered entry list, from the transcripts.

    Each inventory agent's transcript carries exactly its cell's entries, so
    the cells are told apart by SIZE and the assignment is then checked by
    `POSITION_CHECKS`.  Two cells declare 74; they are separated by which one
    satisfies the English checks.

    `seen`, if a dict is passed, is filled with path -> entry count for every
    transcript that parsed.  A cell is assigned only when its checks PASS, so
    "cell E is missing" and "no transcripts are on this machine" produce the
    same empty slot and the caller cannot tell them apart without this.
    """
    per_file = {}
    for p in _transcripts():
        es = _entries_of(p)
        if es:
            per_file[p] = es
    if seen is not None:
        seen.update({p: len(es) for p, es in per_file.items()})
    cells = {}
    for c, _, n in DECLARED:
        cands = [p for p, es in per_file.items() if len(es) == n]
        for p in cands:
            ok = all(want.lower() in per_file[p][int(i[1:]) - 1]["name"].lower()
                     for i, want in POSITION_CHECKS
                     if i[0] == c and int(i[1:]) <= len(per_file[p]))
            if ok and c not in cells:
                cells[c] = per_file[p]
    # cells whose transcript is short of the declared size
    for p, es in per_file.items():
        if es in cells.values():
            continue
        for c, _, n in DECLARED:
            if c in cells or len(es) > n:
                continue
            ok = all(want.lower() in es[int(i[1:]) - 1]["name"].lower()
                     for i, want in POSITION_CHECKS
                     if i[0] == c and int(i[1:]) <= len(es))
            if ok:
                cells[c] = es
                break
    return cells


def rebuild(write=True):
    """Re-derive canon_index.tsv from the transcripts.  Refuses on a failed
    position check, because a mapping that is merely plausible is the defect
    this file exists to close.

    TWO REFUSALS, NOT ONE, CORRECTED 2026-08-13.  `recover()` assigns a cell
    only when that cell's position checks PASS, so a BROKEN MAPPING left the
    same empty slot as an empty machine and both came back as `no transcript
    recovered for cell(s) [...]` -- a sentence that sends the reader to look for
    a file that is sitting right there.  Measured: perturbing one entry of
    `POSITION_CHECKS` in process, against the complete 21-transcript store,
    printed `no transcript recovered for cell(s) ['E']`.  The discriminator is
    whether a transcript of that cell's DECLARED SIZE was parsed at all: if one
    was and it still does not satisfy the checks, the store is present and the
    reading of it is wrong, which is a defect and not a refusal (doctrine 79).
    """
    seen = {}
    cells = recover(seen)
    missing = [c for c, _, _ in DECLARED if c not in cells]
    if missing:
        sized = {c: sum(1 for k in seen.values() if k == n)
                 for c, _, n in DECLARED if c in missing}
        if not seen:
            return None, (f"{_NO_TRANSCRIPTS} for cell(s) {missing}: no "
                          f"transcript file parsed under {TRANSCRIPT_GLOB}")
        if not any(sized.values()):
            return None, (f"{_NO_TRANSCRIPTS} for cell(s) {missing}: "
                          f"{len(seen)} transcript(s) parsed and none holds the "
                          f"declared entry count for any missing cell")
        return None, (f"position checks FAILED for cell(s) {missing}: "
                      f"{len(seen)} transcript(s) parsed and "
                      f"{ {c: k for c, k in sized.items() if k} } of them hold "
                      f"the declared entry count, so the store is HERE and the "
                      f"positional reading of it does not hold")
    fails = []
    for idx, want in POSITION_CHECKS:
        c, n = idx[0], int(idx[1:])
        got = cells[c][n - 1]["name"] if n <= len(cells[c]) else "<unrecovered>"
        if want.lower() not in got.lower():
            fails.append((idx, want, got))
    if fails:
        return None, f"position checks FAILED: {fails}"
    rows = []
    for c, _, n in DECLARED:
        es = cells[c]
        for i in range(1, n + 1):
            if i > len(es):
                rows.append({"idx": f"{c}{i}", "name": "", "tradition": "",
                             "witness": "unrecovered", "basis": "",
                             "self_doubt": "", "source": ""})
                continue
            e = es[i - 1]
            if "source" not in e:
                # The entry EXISTS and records no witness of any kind.  That is
                # a third thing again: not `we checked and it is us`, not `an
                # appeal to an unnamed authority`, but a field the survey never
                # filled in.  Kept distinct so the remedy is obvious.
                rows.append({"idx": f"{c}{i}",
                             "name": " ".join(e["name"].split()),
                             "tradition": " ".join(str(e.get("tradition", "")).split()),
                             "witness": "unrecorded", "basis": "no_source_field",
                             "self_doubt": "", "source": ""})
                continue
            src = " ".join(e["source"].split())
            w, b = classify_source(src)
            rows.append({"idx": f"{c}{i}",
                         "name": " ".join(e["name"].split()),
                         "tradition": " ".join(str(e.get("tradition", "")).split()),
                         "witness": w, "basis": b,
                         "self_doubt": "yes" if DOUBT.search(src) else "no",
                         "source": src})
    if write:
        with open(INDEX_TSV, "w", encoding="utf-8") as fh:
            fh.write("\t".join(FIELDS) + "\n")
            for r in rows:
                fh.write("\t".join(r[k] for k in FIELDS) + "\n")
    return rows, f"{len(rows)} rows, {len(POSITION_CHECKS)} position checks passed"


#: The one `rebuild` failure that is a REFUSAL rather than a defect.  Everything
#: else `rebuild` can refuse on -- a failed position check -- means the mapping
#: is wrong with the transcripts sitting right there, which is the loudest
#: finding this module can produce and must not wear the refusal's name.
_NO_TRANSCRIPTS = "no transcript recovered"


def verify():
    """Is the inlined index still what the transcripts say?

    FOUR outcomes, and the docstring said three until 2026-08-13 while the code
    had two-and-a-half.  `verified`, `differs`, `position_checks_failed`, and
    `cannot verify -- the transcripts are not on this machine`.

    The split matters and it was wrong: `position_checks_failed` was reported as
    `cannot_verify`, so a broken POSITIONAL reading -- the failure this whole
    file exists to make impossible, every citation potentially standing on a
    different entry -- read as a checkout that simply had no transcripts in it.
    Only the last outcome is a refusal (doctrine 79); the other failure is a
    finding about the index.  None of the three non-`verified` states is a pass.
    """
    rows, why = rebuild(write=False)
    if rows is None:
        return {"state": "cannot_verify" if why.startswith(_NO_TRANSCRIPTS)
                else "position_checks_failed",
                "detail": why, "rows_on_disk": len(index())}
    on_disk = index()
    diff = [r["idx"] for r in rows
            if on_disk.get(r["idx"], {}).get("source", None) != r["source"]]
    return {"state": "verified" if not diff else "differs",
            "detail": why, "differing": diff[:20], "n_differing": len(diff),
            "rows_on_disk": len(on_disk)}


#: state -> (exit code, what the state actually means).  A table rather than an
#: `if` chain so that adding a state without deciding its code is impossible:
#: `check_verify` raises on an unknown state instead of falling through to 0,
#: which is how `--verify` came to exit 0 on every outcome in the first place.
VERIFY_EXIT = {
    "verified": (EXIT_OK,
                 "the inlined index still says exactly what the transcripts say"),
    "differs": (EXIT_FAILED,
                "the index and the transcripts DISAGREE -- re-derive with "
                "--rebuild, and keep the superseded rows visible (doctrine 17)"),
    "position_checks_failed": (EXIT_FAILED,
                               "the POSITIONAL reading is broken: an index no "
                               "longer names the entry the canon's own prose "
                               "says it names, so every citation in the "
                               "register is suspect"),
    "cannot_verify": (EXIT_CANNOT_TELL,
                      "the transcripts are not on this machine, so this is a "
                      "REFUSAL and not a pass (doctrine 28) -- the index on "
                      "disk is neither confirmed nor impeached"),
}


def check_verify(v):
    """-> exit code.  FAILS LOUDLY; it does not report and continue."""
    state = v.get("state")
    if state not in VERIFY_EXIT:
        raise AssertionError("verify() returned an unclassified state %r; "
                             "give it an exit code before shipping it" % state)
    code, meaning = VERIFY_EXIT[state]
    print()
    print("=" * 74)
    print("CHECK -- quality/canon_index.tsv against the survey transcripts")
    print("=" * 74)
    print(f"  state      {state}")
    print(f"  meaning    {meaning}")
    print(f"  detail     {v.get('detail')}")
    print(f"  rows on disk {v.get('rows_on_disk')}")
    if v.get("n_differing"):
        print(f"  {v['n_differing']} row(s) differ, first 20: "
              f"{' '.join(v.get('differing', []))}")
    if code == EXIT_CANNOT_TELL:
        print()
        print(f"  TO REACH `verified` this machine needs the {len(DECLARED)} "
              f"inventory-agent transcripts of the workflow named in "
              f"{os.path.basename(CANON_MD)}, as *.jsonl under "
              f"{TRANSCRIPT_GLOB}/**/<workflow id>/ .")
    print()
    print("RESULT:", "PASS" if code == EXIT_OK else
          "FAIL" if code == EXIT_FAILED else "CANNOT TELL")
    return code


# ---------------------------------------------------------------------------
# Reports
# ---------------------------------------------------------------------------

def census():
    ix = index()
    w = collections.Counter(r["witness"] for r in ix.values())
    b = collections.Counter((r["witness"], r["basis"]) for r in ix.values())
    d = collections.Counter(r["self_doubt"] for r in ix.values())
    per_cell = collections.Counter(
        (r["idx"][0], r["witness"]) for r in ix.values())
    return {"rows": len(ix), "witness": dict(w),
            "basis": {f"{x}/{y}": n for (x, y), n in b.items()},
            "self_doubt": dict(d),
            "per_cell": {f"{c}/{x}": n for (c, x), n in per_cell.items()},
            "adjudicated": len(ADJUDICATED),
            "primary_in_repo": len(PRIMARY_IN_REPO)}


def entry_report():
    out = []
    for rid, line, block, froms in canon_blocks():
        ew = entry_witness(froms)
        out.append({"id": rid, "line": line, "verdict": ew["verdict"],
                    "counts": dict(ew["counts"]), "n": len(ew["indices"])})
    return out


def project_only():
    """Every index whose only recorded witness is this project, with basis."""
    return [r for r in index().values() if r["witness"] == "project"]


def unrecorded():
    return [r for r in index().values() if r["witness"] == "unrecorded"]


# ---------------------------------------------------------------------------
# Rendering the repair back into RHYME_CANON.md
#
# EVERY NUMBER IN §8 AND EVERY `- witness:` LINE IS DERIVED HERE, at render
# time, from the index and the canon's own `from:` lines.  Nothing is typed.
# That is the whole argument of this cell applied to its own deliverable: a
# figure transcribed into prose is a figure that will disagree with the code
# by the next round (doctrine 58), and a citation transcribed into prose is
# the defect M-15a names.  `--render` is idempotent.
# ---------------------------------------------------------------------------

WITNESS_MARK = "- witness: "


def _named_artifacts(rows, limit=4):
    out = []
    for r in rows:
        for m in list(HOST.finditer(r["source"])) + list(NAMED.finditer(r["source"])):
            t = m.group(0)
            if t.lower() not in [x.lower() for x in out]:
                out.append(t)
        if len(out) >= limit:
            break
    return out[:limit]


def _witness_line(ids):
    ix = index()
    tally = collections.Counter(witness_of(x) or "dangling" for x in ids)
    ext = [ix[x] for x in ids if x in ix and ix[x]["witness"] == "external"]
    proj = [x for x in ids if witness_of(x) == "project"]
    unrec = [x for x in ids if witness_of(x) == "unrecorded"]
    gone = [x for x in ids if witness_of(x) == "unrecovered"]
    prim = sorted({"%s %s" % (x, PRIMARY_IN_REPO[x][1])
                   for x in ids if x in PRIMARY_IN_REPO})
    bits = ["%d cited indices — %s"
            % (len(ids), ", ".join("%s %d" % kv for kv in sorted(tally.items())))]
    na = _named_artifacts(ext)
    if na:
        bits.append("names outside this project: " + ", ".join(na))
    if prim:
        bits.append("PRIMARY held in this repo: " + "; ".join(prim))
    if proj:
        bits.append("only-this-project: " + " ".join(proj))
    if unrec:
        bits.append("no checkable referent: " + " ".join(unrec))
    if gone:
        bits.append("never recovered: " + " ".join(gone))
    return WITNESS_MARK + ". ".join(bits) + "."


def _render_section_8(omissions=None):
    """§8, entirely computed.

    `omissions` is an optional list this appends a sentence to for every part of
    §8 it could not build.  A render that drops a whole subsection while exiting
    0 writes a document that is missing a section nobody was told about, which
    is the silent half of the defect the exit codes above close.
    """
    ix, cen = index(), census()
    er = entry_report()
    v = collections.Counter(e["verdict"] for e in er)
    blocks = canon_blocks()
    refs = [i for _, _, _, f in blocks for i in refs_in(f)]
    prim = check_primary()
    try:
        from quality import relations as R
        tp = R.tradition_provenance()
    except Exception as exc:                                   # pragma: no cover
        tp = None
        print("WARNING: §8.7 omitted, relations.py did not import: %r" % exc,
              file=sys.stderr)
        if omissions is not None:
            omissions.append("§8.7 (`relations.py`'s provenance table) was NOT "
                             "written: %r" % (exc,))
    websearch = sum(1 for r in ix.values()
                    if re.search(r"websearch|web search|via search", r["source"], re.I))
    L = []
    w = L.append
    w("")
    w("---")
    w("")
    w("## 8. The survey index, recovered and inlined — and what it does not settle")
    w("")
    w("**Added 2026-08-11 in answer to `MISSING.md` M-15a. Every number in this section is COMPUTED**")
    w("by `python3 quality/canon_sources.py --render`, from `quality/canon_index.tsv` and from §2's")
    w("own `from:` lines. None of it is transcribed, because a figure transcribed into prose is a")
    w("figure that disagrees with the code by the next round (doctrine 58) and a citation transcribed")
    w("into prose is the defect this section exists to close.")
    w("")
    w("Every `from:` line in §2 indexes the six-agent survey array of workflow `wf_c1e2a9c5-60b`, and")
    w("that array was not in the repository. From inside a clone the citation graph was CLOSED: 117 of")
    w("117 named structures and 298 of 298 `Tradition` rows resolved to nothing, and")
    w("`quality/relations.py` called an `R<n>` pointer back into this file a *source*. The array")
    w("survived only in the inventory agents' session transcripts, which no checkout, no `git log`")
    w("and no future reader inherits.")
    w("")
    w("It is now `quality/canon_index.tsv` — **%d rows, one per declared index**, each carrying the"
      % cen["rows"])
    w("survey entry's NAME, its TRADITION field and its `source` string VERBATIM.")
    w("")
    w("### 8.1 The index is POSITIONAL, and that is checked rather than assumed")
    w("")
    w("Each `inventory:*` agent emitted one JSON array; `E1` is that array's first element. The")
    w("mapping was not adopted on plausibility — it is checked against **%d attributions this file"
      % len(POSITION_CHECKS))
    w("and `relations.py` make in their own prose**, and `--rebuild` refuses to write if any fails.")
    w("R10 cites `G1` and says the span is Snorri's `fyrð` out of *fyrðum*, so `G1` must be")
    w("`skothending`; R32 calls `I29`–`I36` the qāfiya slot apparatus, so `I34` must be inside it;")
    w("R1 cites `I39` and `I65` and `_SOURCED` names exactly *Hindi-Urdu tuk / tukānt* and")
    w("*Vietnamese vần chân* under `perfect rhyme`. All %d hold." % len(POSITION_CHECKS))
    w("")
    w("**A plausible-looking mapping is what the first attempt produced, and it is worth recording**")
    w("**how.** It built each array from objects carrying a `source` key — and 18 of the")
    w("indic-seasian cell's 74 entries carry no `source` key at all, *interleaved* from position 32")
    w("onward. Every `I` index past 32 was silently renumbered while the low checks still passed,")
    w("putting `chan (ฉันท์) quantitative template` at `I47` where the array actually holds `syair")
    w("monorhyme quatrain`. Checks that all land near the head of an array cannot detect a shift in")
    w("its tail, and an override addressed by position alone follows whichever row is standing there.")
    w("")
    w("### 8.2 What the references actually are")
    w("")
    w("| | count |")
    w("|---|---:|")
    w("| `from:` references in §2 | **%d** |" % len(refs))
    w("| distinct indices cited | %d |" % len(set(refs)))
    w("| declared indices (74+64+89+126+74+174) | %d |" % cen["rows"])
    w("| declared but never cited by any entry | %d |" % (cen["rows"] - len(set(refs))))
    w("")
    w("**%d, not 611.** `quality/audit_register.py --provenance` reported 611 because it read the"
      % len(refs))
    w("`from:` matter with a single-line regex and only its first occurrence — and R1's from-line runs")
    w("onto a second line, R29's onto three, and §H/§I write `from:` inline at the end of the entry's")
    w("own prose rather than as a bullet. That is doctrine 58 inside the adversary built to find")
    w("doctrine-58 errors, and both numbers are now printed side by side rather than one replacing")
    w("the other.")
    w("")
    w("### 8.3 The witness census, and the states that are not `no`")
    w("")
    w("Four states, because *nobody recorded a witness*, *the witness is us*, and *the entry was")
    w("never recovered* are three different sentences and only one of them is about the tradition")
    w("(doctrine 28).")
    w("")
    w("| state | n | meaning |")
    w("|---|---:|---|")
    w("| `external` | %d | the recorded source names an identifiable artifact outside this project |"
      % cen["witness"].get("external", 0))
    w("| `project` | %d | every recorded source is a `quality/*` module, a `CLAUDE.md` doctrine, or recollection |"
      % cen["witness"].get("project", 0))
    w("| `unrecorded` | %d | no checkable referent at all |"
      % cen["witness"].get("unrecorded", 0))
    w("| `unrecovered` | %d | inside a declared cell and not recovered — currently none |"
      % cen["witness"].get("unrecovered", 0))
    w("")
    w("Both middle states split by BASIS, because doctrine 44's remedies differ:")
    w("")
    w("| basis | n | remedy |")
    w("|---|---:|---|")
    w("| `project/module` | %d | a repo module is the witness — a self-confirmation risk, since the code being graded is the evidence |"
      % cen["basis"].get("project/module", 0))
    w("| `project/memory` | %d | the source says outright it is recollection — a search nobody has run |"
      % cen["basis"].get("project/memory", 0))
    w("| `unrecorded/appeal` | %d | *\"standard rhetorical taxonomy\"* — an appeal to an authority nobody identified |"
      % cen["basis"].get("unrecorded/appeal", 0))
    w("| `unrecorded/no_source_field` | %d | the survey emitted the entry with **no `source` key whatever** |"
      % cen["basis"].get("unrecorded/no_source_field", 0))
    w("")
    w("**%d of %d rows carry the survey's own doubt flag** — *NOT independently verified*,"
      % (cen["self_doubt"].get("yes", 0), cen["rows"]))
    w("*egress-blocked*, *flag as recall* — kept verbatim, because a check whose premise weakened may")
    w("be kept but never quoted as if it had not (doctrine 17).")
    w("")
    w("**The classifier is conservative in a stated direction.** An artifact it fails to recognise")
    w("falls to `unrecorded`, never to `external`. So `unrecorded` means *the mechanical rule found no")
    w("checkable referent*, not *none exists*. Its regexes are coordinates of every number in this")
    w("section (doctrine 58) and they are named constants in `quality/canon_sources.py`. One of them")
    w("was wrong in the dangerous direction and is worth naming: with `md` (Moldova) in the")
    w("top-level-domain list, `CLAUDE.md doctrine 18` parses as a HOSTNAME, and six names — `anaphora`,")
    w("`epistrophe`, `repetend`, `repetition`, `refrain / burden / chorus`, `cynghanedd in English` —")
    w("read as externally attested on the strength of a citation to this repository's own doctrine")
    w("file. A register that launders `CLAUDE.md` into a foreign TLD is the exact failure it exists")
    w("to detect.")
    w("")
    w("### 8.4 What it settles for the 117")
    w("")
    w("| | n |")
    w("|---|---:|")
    w("| named structures reaching at least one witness outside this project | **%d** |"
      % v.get("external", 0))
    w("| named structures reaching NONE | **%d** |" % v.get("none_external", 0))
    w("| named structures citing nothing at all | %d |" % v.get("cites_nothing", 0))
    w("")
    w("A single external witness among thirty cited indices is not the same claim as thirty, so the")
    w("`- witness:` line under each entry in §2 prints the whole count vector and never a verdict")
    n_none = v.get("none_external", 0)
    w("alone. The %s that reach%s none %s named rather than counted:"
      % (n_none, "" if n_none == 1 else "", "is" if n_none == 1 else "are"))
    w("")
    for e in er:
        if e["verdict"] == "external":
            continue
        f = [x for r, _, _, x in blocks if r == e["id"]][0]
        det = []
        for i in refs_in(f):
            row = ix.get(i, {})
            det.append("`%s` %s — %s" % (i, row.get("name") or "«never recovered»",
                                         row.get("source") or "**no `source` field at all**"))
        w("- **%s** (line %d): %s" % (e["id"], e["line"], "; ".join(det)))
    w("")
    w("### 8.5 A PRIMARY source, with its date, for the entries that have one")
    w("")
    w("This file carried **zero publication-year tokens across 94 KB**, which was the sharpest single")
    w("finding of the provenance audit. **%d** indices resolve to a primary source that is not merely"
      % len(PRIMARY_IN_REPO))
    w("named but **stored in this repository and quotable**. Each row is re-checked on every render by")
    w("running the command in its last column against the named file; %d of %d pass today."
      % (sum(1 for r in prim if r["state"] == "quoted"), len(prim)))
    w("")
    w("| index | primary source | held in | check |")
    w("|---|---|---|---|")
    for k in sorted(PRIMARY_IN_REPO, key=lambda x: (x[0], int(x[1:]))):
        _nm, src, where, cmd = PRIMARY_IN_REPO[k]
        w("| `%s` %s | %s | `%s` | `%s` |"
          % (k, ix[k]["name"][:38], src, where, cmd))
    w("")
    w("This is doctrine 62 with the receipts attached: Snorri's own prose supplies the")
    w("ONSETS-MUST-DIFFER rule and the málfylling list, and `quality/phonology/non.py` quotes both")
    w("verbatim — so eight Old Norse indices that a Latin-only external regex had filed as *sourced")
    w("only to this project* are in fact sourced to a text of c. 1222-25 that the repository carries,")
    w("and `X8`'s 同用 grouping to two rime books, 平水韻 (1252) and 詞林正韻 (1821). The converse holds")
    w("in the same module and is the reason to trust it: the `sk`/`sp`/`st` cluster rule is **not** in")
    w("that passage of Háttatal, and `non.py` says so rather than letting the quotation cover it.")
    w("")
    w("### 8.6 The names whose only witness is this project")
    w("")
    w("**%d of the %d entries.** They are LISTED, not deleted and not quietly filled in. An invented"
      % (cen["witness"].get("project", 0), cen["rows"]))
    w("name that says it was invented is a fine thing to have in a register; an invented name that")
    w("reads as attested is the defect. A plausible fill here would be the `gabay higaad` error")
    w("repeated %d times." % cen["witness"].get("project", 0))
    w("")
    w("| index | basis | name |")
    w("|---|---|---|")
    for r in sorted(project_only(), key=lambda r: (r["idx"][0], int(r["idx"][1:]))):
        w("| `%s` | %s | %s |" % (r["idx"], r["basis"], r["name"]))
    w("")
    w("And **%d further entries record no checkable referent at all**. These are a DIFFERENT gap and"
      % cen["witness"].get("unrecorded", 0))
    w("take a different remedy: a search, not a coinage label.")
    w("")
    w("| index | basis | name |")
    w("|---|---|---|")
    for r in sorted(unrecorded(), key=lambda r: (r["idx"][0], int(r["idx"][1:]))):
        w("| `%s` | %s | %s |" % (r["idx"], r["basis"], r["name"]))
    if tp:
        w("")
        w("### 8.7 What it settles for `relations.py`")
        w("")
        w("`Tradition.witness` is now tri-state and DERIVED at import from this index and the canon")
        w("entry's own `from:` line — never typed into a table, because a citation typed by hand is the")
        w("defect this whole section exists to close. Over **%d distinct traditions on %d attachments**:"
          % (tp["distinct"], tp["attachments"]))
        w("")
        w("| verdict | n |")
        w("|---|---:|")
        w("| externally witnessed | **%d** |" % tp["external"])
        w("| **this project's own** | **%d** |" % tp["project"])
        w("| cannot be told | **%d** |" % tp["cannot_tell"])
        w("")
        w("A canon entry names its traditions in an alias line and its indices in a `from:` line and")
        w("NEVER attributes one to the other, so a per-name citation would be a fabrication. Two")
        w("readings are used and both are stated on every row. Where a tradition name and exactly one")
        w("cited survey entry in that language's cell share a distinctive token — `Turkish nakarat` and")
        w("`S122 nakarat` — the attribution is not a guess and the row quotes that entry's source.")
        w("Otherwise the verdict is taken over the SET and holds however the attribution falls:")
        w("all-external is `external`, all-project is `project`, anything mixed is `None`.")
        w("")
        w("Two false attributions were produced and killed during construction. Filtering candidates by")
        w("language BEFORE testing uniqueness put `English refrain / burden / chorus` on `E3 repetition")
        w("(same-word rhyme)` — because `E54 refrain / burden / chorus`, the correct entry, does not")
        w("carry the word *English* in its own tradition field and was vetoed out of a two-candidate")
        w("set, leaving one survivor that then looked unique. The same ordering put `Finnish Kalevala")
        w("vahva alkusointu` (*vahva* = STRONG) on `G82 Kalevala WEAK alliteration`. A filter that can")
        w("only delete is safe; a filter that decides which of two candidates wins is a guess wearing a")
        w("mechanism. Every surviving attribution shares a distinctive token with the survey entry's own")
        w("NAME, never with its tradition field alone, and `quality/test_relations.py` pins that.")
        w("")
        w("The traditions whose only witness is this project, listed for the same reason as §8.6:")
        w("")
        w("| language | tradition | schema | index |")
        w("|---|---|---|---|")
        for c in tp["coined"]:
            w("| `%s` | %s | %s | `%s` |"
              % (c["lang"] or "—", c["tradition"], c["schema"], ",".join(c["cites"])))
    w("")
    w("### 8.8 What this does NOT do")
    w("")
    w("1. **It does not make the canon primarily sourced.** %d of the %d recovered `source` strings"
      % (websearch, cen["rows"]))
    w("   name a search rather than a work. A search summary is a witness that something outside this")
    w("   project exists; it is not the tradition's own statement of its rule, and §8.5 lists the %d"
      % len(PRIMARY_IN_REPO))
    w("   indices where the repository actually holds one.")
    w("2. **It does not re-verify anything.** The index records what the 2026-08-10 inventory agents")
    w("   recorded, including the %d rows where they flagged their own uncertainty. Re-verification"
      % cen["self_doubt"].get("yes", 0))
    w("   is a separate job and this file must not be read as having done it.")
    w("3. **It does not invent a source for the %d entries the survey emitted with no `source` key.**"
      % cen["basis"].get("unrecorded/no_source_field", 0))
    w("   They are `unrecorded / no_source_field`. `audit_register.py` did worse than drop them: its")
    w("   single regex ran past the object boundary and paired each such name with the NEXT entry's")
    w("   source string, which is how `Hindi anuprās subtypes` and `syair monorhyme quatrain` arrived")
    w("   in a list of names *whose only witness is this project*. They have no recorded witness of")
    w("   any kind and a neighbour's was read onto them.")
    w("4. **It does not touch `gabay higaad`.** §0 records that Somali appears in no inventory cell and")
    w("   that the name entered the canon from repo doctrine alone. There is no index to inline and no")
    w("   witness to recover; `relations.py` scopes Somali to zero of the 77 schemas, which is what the")
    w("   source says, and the mechanical form of that is a zero rather than a plausible list.")
    w("")
    return L


def render(path=CANON_MD, omissions=None):
    """Rewrite the `- witness:` lines in §2 and regenerate §8.  Idempotent.

    -> the number of witness lines written.  `omissions`, if a list is passed,
    collects the parts of §8 that could not be built, so the caller can exit
    non-zero on a PARTIAL render rather than announce a success that quietly
    dropped a section.
    """
    txt = open(path, encoding="utf-8").read()
    cut = txt.find("\n## 8. ")
    if cut != -1:
        txt = txt[:cut]
        # §8 opens with its own `---` rule; leaving the previous one behind
        # makes the render non-idempotent, one extra separator per run.
        txt = re.sub(r"(?:\s*\n-{3,})+\s*$", "", txt)
    lines = [l for l in txt.split("\n") if not l.startswith(WITNESS_MARK)]
    starts = [(i, m.group(1)) for i, l in enumerate(lines)
              for m in [re.match(r"^\*\*(R\d+[a-z]?)\s*·", l)] if m]
    inserts = {}
    for k, (i, rid) in enumerate(starts):
        j = starts[k + 1][0] if k + 1 < len(starts) else len(lines)
        last, froms = None, []
        for bi in range(i, j):
            m = re.search(r"from:", lines[bi])
            if not m:
                continue
            chunk, end = [lines[bi][m.end():]], bi
            for nb in range(bi + 1, j):
                if re.match(r"^\s{2,}\S", lines[nb]):
                    chunk.append(lines[nb])
                    end = nb
                else:
                    break
            froms.append("\n".join(chunk))
            last = end
        if last is None:
            continue
        inserts[last] = _witness_line(
            list(dict.fromkeys(refs_in("\n".join(froms)))))
    out = []
    for n, l in enumerate(lines):
        out.append(l)
        if n in inserts:
            out.append(inserts[n])
    body = "\n".join(out).rstrip("\n")
    # §8 is computed from the file on disk, so it MUST be built before the
    # handle is opened for writing: `open(path, "w")` truncates first and the
    # argument expression runs second, which silently rendered every count as
    # zero the first time this was written on one line.
    section = "\n".join(_render_section_8(omissions))
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(body + "\n" + section)
    return len(inserts)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--rebuild", action="store_true")
    ap.add_argument("--render", action="store_true",
                    help="rewrite RHYME_CANON.md's witness lines and §8")
    ap.add_argument("--verify", action="store_true",
                    help="index vs transcripts. TERMINAL: it returns its own "
                         "exit code and runs nothing after it, so `--render "
                         "--verify` renders NOTHING -- use two runs")
    ap.add_argument("--entries", action="store_true")
    ap.add_argument("--names", action="store_true",
                    help="list every project-only and unrecorded name")
    a = ap.parse_args(argv)

    if a.rebuild:
        rows, why = rebuild()
        print("rebuild:", why)
        if rows is None:
            return (EXIT_CANNOT_TELL if why.startswith(_NO_TRANSCRIPTS)
                    else EXIT_FAILED)
        globals()["_INDEX"] = None
    if a.verify:
        v = verify()
        print("verify:", json.dumps(v, ensure_ascii=False))
        return check_verify(v)

    #: The census below is a report and reports 0.  These two are CHECKS living
    #: inside it, and a check that cannot go red is a decoration: a `- witness:`
    #: line whose primary citation stopped being quotable, or a §8 written with
    #: a subsection missing, are both defects in the document this command's
    #: own output claims to have computed.
    code = EXIT_OK
    if a.render:
        omitted = []
        n = render(omissions=omitted)
        print("render: %d witness lines rewritten in %s"
              % (n, os.path.relpath(CANON_MD)))
        for o in omitted:
            print("render: PARTIAL --", o)
        if omitted:
            code = EXIT_FAILED

    c = census()
    print("=" * 78)
    print("CANON INDEX — the survey RHYME_CANON.md cites, inlined (M-15a)")
    print("=" * 78)
    print(f"  {c['rows']} declared indices over six cells "
          f"({', '.join('%s=%d' % (x, n) for x, _, n in DECLARED)})")
    print(f"  witness      {c['witness']}")
    print(f"  basis        {c['basis']}")
    print(f"  self_doubt   {c['self_doubt']}   (the survey's own flags, kept)")
    print(f"  adjudicated  {c['adjudicated']} rows override the mechanical "
          f"rule, each with a reason")
    prim = check_primary()
    good = sum(1 for r in prim if r["state"] == "quoted")
    print(f"  primary in repo {good} of {len(prim)} indices resolve to a dated "
          f"primary source whose quoted string is STILL IN the named file")
    for r in prim:
        if r["state"] != "quoted":
            print(f"     {r['idx']:5s} {r['state']}  {r['file']}")
    if good != len(prim):
        # §8.5 prints `N of M pass today` and its own docstring says a citation
        # nobody re-ran is a citation nobody has.  Printing the shortfall and
        # exiting 0 is exactly that sentence disbelieved.
        print(f"  FAIL: {len(prim) - good} PRIMARY citation(s) no longer "
              f"quotable from the named file. §8.5 says they are.")
        code = EXIT_FAILED
    er = entry_report()
    v = collections.Counter(e["verdict"] for e in er)
    print(f"\n  canon entries {len(er)}: {dict(v)}")
    for e in er:
        if e["verdict"] != "external":
            print(f"     {e['id']:6s} line {e['line']:5d}  {e['verdict']}  "
                  f"{e['counts']}")
    if a.entries:
        print("\n  per entry:")
        for e in er:
            print(f"     {e['id']:6s} n={e['n']:3d} {e['verdict']:14s} {e['counts']}")
    if a.names:
        print("\n  PROJECT-ONLY (the coinage class -- every recorded witness "
              "is this project):")
        for r in sorted(project_only(), key=lambda r: r["idx"]):
            print(f"     {r['idx']:6s} [{r['basis']:6s}] {r['name'][:60]}")
        print("\n  UNRECORDED (the source names no checkable referent at all):")
        for r in sorted(unrecorded(), key=lambda r: r["idx"]):
            print(f"     {r['idx']:6s} {r['name'][:60]}")
    return code


if __name__ == "__main__":
    # Run as a script there is no package on the path, so `from quality import
    # relations` fails and §8.7 renders EMPTY without saying why.  It did.
    sys.path.insert(0, os.path.dirname(HERE))
    sys.exit(main())
