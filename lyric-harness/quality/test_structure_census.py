#!/usr/bin/env python3
"""Regressions for the structure census instrument
(quality/structure_census.py; protocol in
quality/STRUCTURE_CENSUS_PREREGISTRATION.md).

Sections:
  1  the censused rows — 57, comparator out, every row judgeable by name
  2  the three item readers are the EXISTING ones — the 4,930-item
     cross-check, the 152x14 oracle read, the 150-line control slice
  3  cell accounting — F1 on a real file, three counts never summed,
     dedup arm byte-identical to the live arm
  4  the constrained tag — declared cells only, whitman never
  5  the TSV round-trips

Run: python3 quality/test_structure_census.py
"""

import ast
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
sys.path.insert(0, os.path.join(HERE, "..", ".."))

from quality import structure_census as CEN  # noqa: E402
from quality import structures as ST         # noqa: E402
from quality import phonology as PH          # noqa: E402

FAILURES = []


def check(name, cond, detail=""):
    print(f"  {'PASS' if cond else 'FAIL'}  {name}")
    if detail:
        print(f"          {detail}")
    if not cond:
        FAILURES.append(name)


SMALL = os.path.join(HERE, "..", "corpus", "song", "eng_hymn_cennick.txt")

#: The smallest eng file whose SUNG lines distinguish `line_tokens` (which
#: erases `(...)`) from `English._tokens` (which does not).  Section 7's
#: byte-identical control is worthless without it -- see the note there.
PARENS = os.path.join(HERE, "..", "corpus", "song",
                      "eng_british_john_ward.txt")

#: A real Finnish file, for proving `pair_counters` tokenises with the
#: language's reader rather than merely resolving one.
FIN_FILE = os.path.join(HERE, "..", "corpus", "song", "fin_kanteletar.txt")


def ascii_tokens(text, strip_parens=True):
    """Section 7's WRONG-ANSWER CONTROL: an ASCII-only reader, frozen here.

    The section's claim is that a language read with the wrong reader loses
    its own words, so it needs a reader that genuinely shreds `paa`-with-
    umlauts and `adyapi`-with-macrons.  It used `lyric_harness.line_tokens`
    for that, and that was true until 2026-08-21, when `line_tokens` moved
    onto the declared `LATIN_SCRIPT` repertoire (`MISSING.md` M-22) and
    began reading those words whole.  The argument survived the fix; the
    CONTROL did not, and three checks here went red -- the only failure in
    a 60-suite sweep, which is the shape a live function used as a control
    always eventually takes.

    A CONTROL MAY NOT BE A FUNCTION THAT IS ALLOWED TO IMPROVE.  This is
    the pre-M-22 body verbatim (`git show 1580d11^:./lyric_harness.py`,
    `line_tokens`), copied rather than imported: it IS the defect, so
    nothing may repair it, and the `re` module is the only thing it shares
    with the live path.
    """
    norm = text.replace("\u2019", "'").replace("\u2018", "'")
    if strip_parens:
        norm = re.sub(r"\([^)]*\)", " ", norm)
    return [t for t in re.findall(r"[A-Za-z'\-]+", norm)
            if re.search(r"[A-Za-z]", t)]


def test_rows():
    print("\n1. the censused rows")
    check("57 rows — every catalog row except the comparator sentinel, "
          "whose judge refuses by design",
          len(CEN.ROWS) == 57 and ST.DEFAULT not in CEN.ROWS
          and len(ST.STRUCTURES) == 58)
    check("every censused row resolves and is not a comparator",
          all(ST.get(r).kind != "comparator" for r in CEN.ROWS))


def test_item_readers():
    print("\n2. the item readers are the existing ones, never respelled")
    files = CEN.corpus_files()
    # REPINNED 2026-08-20: 143 -> 388 eng files — the owner-directed mass
    # load staged 245 eng_celtic_msm_* files from the Modern Scottish
    # Minstrel (PG22515). The run-1 CENSUS ARTIFACT itself still describes
    # the 143-file corpus (data/structure_census_eng.tsv is a snapshot,
    # dated); this check is about the READERS agreeing on the live tree.
    # REPINNED 2026-08-20 (Tier-1 concurrent load): 388 -> 622 eng files
    # — 234 new per-author files from the five Tier-1 anthologies.
    # REPINNED same sitting: 622 -> 616 (six twin files merged).
    # REPINNED 2026-08-20 (Phase-1): 616 -> 1049 eng files (452 staged, 19 twins merged away).
    # REPINNED 2026-08-20 (Montgomery twin): 1049 -> 1048.
    # REPINNED 2026-08-20 (HBV safe subset + 23 twin merges): 1048 -> 1297.
    check("the population: 1297 eng_ files + 2 controls",
          len(files) == 1299
          and sum(1 for f in files
                  if os.path.basename(f).startswith("eng_")) == 1297)
    n_items = sum(len(CEN.items_of(f)) for f in files
                  if os.path.basename(f).startswith("eng_"))
    # REPINNED 2026-08-19: 4,930 -> 4,979 -> 4,985 — Pass-1 batch 1's 49
    # new eng_hymn_ hymns, then batch 2's 6 new eng_american_ items.
    # REPINNED 2026-08-20: 4,985 -> 5,792 — the Minstrel mass load (+812
    # staged by the rev-2 restage, and 5 items moved from
    # eng_celtic_walter_scott to the new Rob Donn file after the edition's
    # own section heading proved the original staging had mis-bounded
    # Scott's section). Real growth the two readers still agree on.
    # REPINNED 2026-08-20 (Tier-1 concurrent load): 5,792 -> 6,352 —
    # +560 songs (514 in new files, 46 top-ups) after the containment
    # dedup dropped 114 cross-source reprints.
    # REPINNED 2026-08-20 (Phase-1): 6,352 -> 7,618 items.
    check("the --- TITLE: split reproduces build_song_frequency's own "
          "item count EXACTLY — 8,667 over the 1297 files",
          n_items == 8667, n_items)
    son = CEN.items_of(os.path.join(HERE, "..", "corpus", "sonnets.txt"))
    check("sonnets.txt reads through battery.parse_sonnets: 152 items "
          "of 14 lines, Gutenberg matter excluded by the oracle's reader",
          len(son) == 152 and all(len(x) == 14 for x in son))
    whi = CEN.items_of(os.path.join(HERE, "..", "corpus", "whitman.txt"))
    check("whitman.txt reads through battery.whitman_verse: ONE item of "
          "the 150-line negative-control slice",
          len(whi) == 1 and len(whi[0]) == 150
          and whi[0][0].startswith("I celebrate myself"))


def test_cell_accounting():
    print("\n3. cell accounting on a real file")
    phon = PH.get("eng")
    cells = CEN.census_file(SMALL, CEN.Memo(phon), dedup=True)
    check("114 cells: 57 rows x 2 populations",
          len(cells) == 114)
    check("F1 — the three verdict counts sum to n_pairs in EVERY cell "
          "(also asserted at build time; this is the artifact-side read)",
          all(n == t + f + r for n, t, f, r in cells.values()))
    ec = cells[("masculine-rhyme", "endword-cross")]
    check("the endword population is non-empty and the canary row judges "
          "most of it (not 100% refused — falsifier F2's canary)",
          ec[0] > 0 and ec[3] < ec[0], ec)
    cells2 = CEN.census_file(SMALL, CEN.Memo(phon), dedup=False)
    check("the dedup arm is BYTE-IDENTICAL to the live arm — the "
          "registration's declared verification of the dedup rule",
          cells == cells2)


def test_constrained_tag():
    """4. THE TAG HAS THREE STATES (`MISSING.md` M-23, doctrine 20).

    It had two, and `False` is a CLAIM — *this corpus's end words are not
    rhyme-constrained*. True of `whitman`, which was chosen for it. False of
    a ghazal, whose radif IS the constraint, and of a cywydd's cynghanedd.
    Run 1 could not see it because run 1 is English.

    EVERY ASSERTION BELOW COMPARES THE STRING. The function returned a bool
    and returns `"yes"`/`"no"`/`"undeclared"` now, and `"no"` is TRUTHY — so
    the old `not CEN.constrained_tag(...)` spelling would have gone silently
    false under the change while reading exactly as it always did.
    """
    print("\n4. the constrained tag has three states, and `no` is a claim")
    check("end-rhyme family x endword-cross x rhyme-constrained corpora "
          "-> yes",
          CEN.constrained_tag("eng_song", "masculine-rhyme",
                              "endword-cross") == "yes"
          and CEN.constrained_tag("sonnets", "feminine-rhyme",
                                  "endword-cross") == "yes")
    check("whitman is incidental on EVERY row — the declared negative "
          "control; within-line and non-family rows are incidental "
          "everywhere",
          CEN.constrained_tag("whitman", "masculine-rhyme",
                              "endword-cross") == "no"
          and CEN.constrained_tag("eng_song", "masculine-rhyme",
                                  "word-within-line") == "no"
          and CEN.constrained_tag("eng_song", "kalevala-alliteration",
                                  "endword-cross") == "no")

    # THE THIRD STATE, AND IT IS UNREACHABLE FROM THE SHIPPED ARTIFACT — which
    # is exactly why it has to be constructed here. Every family in
    # `data/structure_census_eng.tsv` is one of the three declared ones, so a
    # section that only read real rows would pass identically before and after
    # (doctrine 20, one layer up, inside the check written about doctrine 20).
    for fam in ("fas_hafez_ganjoor", "cym_song_alun", "san_bilhana_"
                "caurapancasika", "ltc_huajianji"):
        check("an undeclared corpus reads `undeclared`, not `no` (%s)" % fam,
              CEN.constrained_tag(fam, "masculine-rhyme",
                                  "endword-cross") == "undeclared")

    # WHITMAN'S `no` IS A DECLARATION AND A GHAZAL'S IS NOT — the whole point
    # of the split, asserted at the table rather than only at the function.
    check("whitman's False carries a written reason, so it is a measurement "
          "and not a default",
          CEN.RHYME_CONSTRAINED["whitman"][0] is False
          and len(CEN.RHYME_CONSTRAINED["whitman"][1]) > 60)
    check("every declared family carries a reason, not a bare verdict",
          all(len(r) > 40 for _v, r in CEN.RHYME_CONSTRAINED.values()),
          str([f for f, (_v, r) in CEN.RHYME_CONSTRAINED.items()
               if len(r) <= 40]))
    check("the membership set is DERIVED from the table, not typed beside it",
          CEN.RHYME_CONSTRAINED_FAMILIES == frozenset(
              f for f, (v, _r) in CEN.RHYME_CONSTRAINED.items() if v))

    # AND THE TRUTHINESS TRAP, ON THE AST. `"no"` is truthy; one surviving
    # `if constrained_tag(...)` would tag every non-family cell `yes` and no
    # example-based check would catch it, because the function's own answers
    # are all correct.
    src = ast.parse(open(CEN.__file__, encoding="utf-8").read())

    def _calls_it(node):
        return any(isinstance(n, ast.Call) and isinstance(n.func, ast.Name)
                   and n.func.id == "constrained_tag" for n in ast.walk(node))

    boolean_uses = []
    for n in ast.walk(src):
        tests = []
        if isinstance(n, (ast.If, ast.While, ast.IfExp)):
            tests = [n.test]
        elif isinstance(n, ast.BoolOp):
            tests = list(n.values)
        elif isinstance(n, ast.UnaryOp) and isinstance(n.op, ast.Not):
            tests = [n.operand]
        elif isinstance(n, ast.comprehension):
            tests = list(n.ifs)
        for t in tests:
            if _calls_it(t):
                boolean_uses.append(getattr(t, "lineno", "?"))
    check("no caller reads `constrained_tag` in a boolean context — `no` is "
          "truthy and would tag every cell `yes`",
          not boolean_uses, "lines %s" % boolean_uses)
    check("...and the guard is not vacuous: the module does call it",
          _calls_it(src))


def test_the_struck_tag_says_so():
    """4b. A REGISTERED AMENDMENT VOIDED 144 SHIPPED CELLS AND ONLY PROSE
    SAID SO (`MISSING.md` M-23).

    `RESULTS_STRUCTURE_CENSUS.md` records E1 failing on `dactylic-rhyme` and
    states *"the artifact's `constrained=yes` tag on dactylic-rhyme cells is
    VOID for consumers"*. The shipped table still carries those cells with
    `yes` in the column, and nothing a consumer RUNS said they were struck.
    Doctrine 48, and doctrine 17 on not quoting a falsified check as live.

    THE TAG IS DELIBERATELY NOT REWRITTEN: the artifact is a dated snapshot,
    the amendment's own text defers the drop to run 2's registration, and
    rewriting it here would make the code stop describing the table it
    produced. What is asserted is that the strike is REACHABLE.
    """
    print("\n4b. the tag E1 struck says so mechanically, not only in prose")
    check("`dactylic-rhyme`'s tag is struck, and the reason names the "
          "amendment",
          "amendment" in CEN.void_reason("dactylic-rhyme").lower(),
          CEN.void_reason("dactylic-rhyme")[:60])
    check("the five rows E1 re-read over are NOT struck",
          not any(CEN.void_reason(r) for r in
                  ("masculine-rhyme", "feminine-rhyme", "perfect-rhyme",
                   "perfect-rhyme-(last-stressed-syllable)",
                   "rime-riche-(last-stressed-syllable)")))
    # THE DEFERRAL IS ASSERTED AS A DEFERRAL. A later lot that "tidies" the
    # row out of CONSTRAINED_FAMILY would silently move 144 shipped cells
    # from `yes` to `no` and make this module stop describing its own
    # artifact — so the membership is pinned WITH the strike, not against it.
    check("the struck row is still IN the constrained family, because the "
          "artifact it describes still tags it",
          "dactylic-rhyme" in CEN.CONSTRAINED_FAMILY)

    art = os.path.join(HERE, "..", "data", "structure_census_eng.tsv")
    rows = CEN.read_tsv(art)
    col = {c: i for i, c in enumerate(CEN.COLUMNS)}
    struck = [r for r in rows if CEN.void_reason(r[col["structure"]])
              and r[col["constrained"]] == "yes"]
    check("the shipped artifact carries exactly the 144 struck `yes` cells "
          "the amendment describes",
          len(struck) == 144, "%d struck of %d rows" % (len(struck),
                                                        len(rows)))
    # THE CONTROL, and it is what makes the three-state change safe to ship:
    # recomputing every shipped row's tag with the new function must return
    # the artifact's own value, or this commit moved a dated snapshot.
    moved = [r for r in rows
             if CEN.constrained_tag(r[col["family"]], r[col["structure"]],
                                    r[col["population"]])
             != r[col["constrained"]]]
    check("the three-state tag reproduces EVERY shipped row — a coordinate "
          "was added and no recorded value moved",
          not moved, "%d row(s) moved: %s" % (len(moved), moved[:1]))


def test_tsv_roundtrip():
    print("\n5. the TSV round-trips")
    import tempfile
    phon = PH.get("eng")
    cells = CEN.census_file(SMALL, CEN.Memo(phon), dedup=True)
    rows = CEN.rows_for(SMALL, cells)
    with tempfile.NamedTemporaryFile("w", suffix=".tsv",
                                     delete=False) as fh:
        tmp = fh.name
    try:
        CEN.write_tsv(tmp, rows)
        back = CEN.read_tsv(tmp)
        check("write -> read is identity (sorted rows, declared columns)",
              back == sorted(rows) and len(back) == 114)
        check("a rate cell is judged-base or EMPTY, never 0.0-for-nothing "
              "(doctrine 20)",
              all((r[12] == "" ) == (int(r[9]) + int(r[10]) == 0)
                  for r in back))
    finally:
        os.unlink(tmp)


def test_checkpointing():
    print("\n6. per-file checkpointing — an interruption costs one file")
    import shutil
    import tempfile
    d = tempfile.mkdtemp()
    try:
        out1 = os.path.join(d, "a.tsv")
        parts = os.path.join(d, "parts")
        CEN.run([SMALL], out1, "test", parts_dir=parts)
        base = os.path.basename(SMALL)
        part = os.path.join(parts, base + ".part.tsv")
        check("a finished file's cells land in an atomic part file",
              os.path.exists(part)
              and not os.path.exists(part + ".tmp")
              and len(CEN.read_tsv(part)) == 114)
        # plant a SENTINEL part: a resumed run must REUSE it verbatim,
        # proving no recompute happens for a checkpointed file.
        sentinel = [tuple(["eng", "eng", base, "eng_song", "masculine-rhyme",
                           "cell", "endword-cross", "no",
                           "1", "1", "0", "0", "1.000000"])]
        CEN.write_tsv(part, sentinel)
        out2 = os.path.join(d, "b.tsv")
        CEN.run([SMALL], out2, "test", parts_dir=parts)
        check("a restart reuses the part instead of recomputing — the "
              "planted sentinel comes back verbatim",
              CEN.read_tsv(out2) == sentinel)
    finally:
        shutil.rmtree(d, ignore_errors=True)


def test_tokeniser_is_declared():
    """7. THE TOKENISER IS THE LANGUAGE'S OWN, OR THE LANGUAGE IS REFUSED.

    `pair_counters` called `lyric_harness.line_tokens` for every language
    until 2026-08-21 (`MISSING.md` M-22).  That is the substitution that
    VOIDED Kalevala alliteration run 1, and it was invisible here because
    `corpus_files()` globs `eng_*` and English is the one language it read
    correctly.  `line_tokens` WAS ASCII-only when this section was written
    and is not any more -- it moved onto `LATIN_SCRIPT` the same day -- so
    the wrong-answer reader every check below measures against is
    `ascii_tokens`, frozen at the top of this file.  Reading it out of the
    live module is what broke this section once already.

    The section drives `pair_counters` rather than `tokeniser_for` alone,
    because a table that resolves correctly and is consulted by nobody is
    the defect this repo has filed four times (`M-22` is itself one).
    """
    import lyric_harness as LH
    print("\n7. the tokeniser is a declared coordinate (M-22)")

    # (0) EVERY DECLARED SITE RESOLVES, AND THIS RUNS FIRST.  A table of
    # import paths can rot silently.  Written LAST in the section at first,
    # where it was unreachable: every other block calls `tokeniser_for`
    # without a guard, so a rotted site raised out of block (b) and the one
    # check that names the failure never ran.  A check that a crash can skip
    # is a check that reports nothing on the day it matters.
    bad = []
    for lang in CEN.TOKENISER_SITE:
        try:
            if not callable(CEN.tokeniser_for(lang)):
                bad.append(lang)
        except Exception as exc:                       # noqa: BLE001
            bad.append(f"{lang}: {str(exc)[:60]}")
    check("every declared tokeniser site resolves to a callable",
          not bad, str(bad))
    if bad:
        print("     (section 7 stops here — the rest reads a rotted table)")
        return

    # (a) THE CONTROL, and it is the one that matters: the run-1 population
    # must be BYTE-IDENTICAL through the new path.  eng resolves to
    # `line_tokens` BY DECLARATION, not by accident -- `English._tokens` is
    # a DIFFERENT function (it does not strip `(...)`) and the two disagree
    # on ~~1,061 of 283,515~~ 1,059 of 283,501 eng sung lines (REPINNED
    # 2026-08-26 with the module comment it mirrors -- a figure pinned in two
    # media with no instrument between them is `MISSING.md` M-21's own
    # subject), so "ask the phonology" would have
    # moved the committed artifact while looking like a refactor.
    #
    # THE FIXTURE IS `PARENS`, NOT `SMALL`, AND THAT IS THE WHOLE CHECK.
    # Written first against `SMALL` and it passed against BOTH readings:
    # `SMALL`'s only two `(...)` lines are `# author:` and `# source:`,
    # which `is_apparatus_line` drops before any tokeniser sees them, so
    # the control was comparing two readings on a population where they
    # cannot differ -- doctrine 20's "an empty population reads like a
    # pass", inside the check written to stop exactly that.  `PARENS` is
    # the smallest eng file whose SUNG lines distinguish them.
    from quality.phonology.eng import English
    strip_ec, strip_wl = CEN.pair_counters(PARENS)
    keep_ec, keep_wl = CEN.pair_counters(PARENS, tokens=English._tokens)
    # The two readings differ on WORD-WITHIN-LINE and NOT on endword-cross
    # here, and that is a fact about where a parenthetical sits: erasing
    # `(...)` removes interior words while a line's LAST word is usually
    # outside the parens. Asserting on endword-cross alone would have been
    # the vacuous check a second time, one population over.
    check("the control fixture can TELL THE TWO READINGS APART",
          (strip_ec, strip_wl) != (keep_ec, keep_wl) and strip_wl != keep_wl,
          f"word-within-line {len(strip_wl)} vs {len(keep_wl)} distinct pairs; "
          f"endword-cross identical ({len(strip_ec)}), as expected")
    check("eng is byte-identical through the declared path",
          (strip_ec, strip_wl) == CEN.pair_counters(
              PARENS, tokens=LH.line_tokens)
          and CEN.pair_counters(SMALL) == CEN.pair_counters(
              SMALL, tokens=LH.line_tokens),
          f"{sum(strip_ec.values())} endword-cross pairs, unmoved")
    check("eng resolves to line_tokens, not English._tokens",
          CEN.tokeniser_for("eng") is LH.line_tokens)

    # (b) THE CONTROL IS ALIVE, ASKED FIRST.  `ascii_tokens` is the
    # wrong-answer reader every positive below is measured against, and a
    # control that has quietly stopped being wrong turns each of them into
    # doctrine 20's empty population.  M-22's own headline word proves both
    # directions in one line: the frozen control shreds it, the live reader
    # reads it whole.
    check("the ASCII control still shreds what the live reader now reads",
          ascii_tokens("tân") == ["t", "n"] and LH.line_tokens("tân") == ["tân"]
          and CEN.tokeniser_for("eng") is not ascii_tokens,
          f"control {ascii_tokens('tân')} vs live {LH.line_tokens('tân')}")

    # (b) THE POSITIVE: a language with a declared tokeniser reads its own
    # words.  `pää` -> ['p'] under the ASCII reader and stays whole here.
    fin = CEN.tokeniser_for("fin")
    check("fin reads its own words (ASCII shreds them)",
          fin("pää") == ["pää"] and ascii_tokens("pää") == ["p"],
          f"fin._tokens {fin('pää')} vs ASCII {ascii_tokens('pää')}")
    san = CEN.tokeniser_for("san")
    check("san reads its own words",
          len(san("adyāpi tāṃ kanakacampakadāmagaurīṃ")) == 3
          and len(ascii_tokens("adyāpi tāṃ kanakacampakadāmagaurīṃ")) == 5,
          "3 words vs 5 ASCII fragments")

    # AND `pair_counters` MUST ACTUALLY USE IT.  The two checks above prove
    # the TABLE resolves; they say nothing about the loop that tokenises,
    # and the first draft of this section proved it: restoring
    # `toks = LH.line_tokens(line)` inside `pair_counters` left every check
    # here GREEN, because the refusals fire in the resolver and the positives
    # called the resolver directly.  A resolver consulted by nobody is the
    # defect this repo has filed four times.  Driven end to end now, on real
    # Finnish: under the language's own reader the endwords are whole words
    # carrying ä/ö; under the ASCII reader they are fragments that carry none.
    fin_ec, _fin_wl = CEN.pair_counters(FIN_FILE, language="fin")
    ascii_ec, _ascii_wl = CEN.pair_counters(FIN_FILE, tokens=ascii_tokens)
    fin_words = {w for pair in fin_ec for w in pair}
    ascii_words = {w for pair in ascii_ec for w in pair}
    non_ascii = {w for w in fin_words if any(ord(c) > 127 for c in w)}
    check("pair_counters TOKENISES with the language's own reader",
          fin_ec != ascii_ec and non_ascii
          and not {w for w in ascii_words if any(ord(c) > 127 for c in w)},
          f"{len(non_ascii)} endwords carry ä/ö under fin, 0 under ASCII")

    # (c) THE REFUSAL, driven through `pair_counters` itself: a language
    # with no declared tokeniser REFUSES BY NAME and never falls back.
    for lang, want in (("ltc", "PERMANENT"), ("cym", "BUILDABLE"),
                       ("msa", "BUILDABLE")):
        try:
            CEN.pair_counters(SMALL, language=lang)
            check(f"{lang} refuses rather than shredding", False,
                  "it returned counters — the ASCII fallback is back")
        except CEN.NoTokeniser as exc:
            check(f"{lang} refuses rather than shredding, and says why",
                  want in str(exc) and len(str(exc)) > 120, str(exc)[:72])
    try:
        CEN.tokeniser_for("zz")
        check("an UNDECLARED language refuses too", False)
    except CEN.NoTokeniser as exc:
        check("an undeclared language refuses and says nobody has looked",
              "nobody has looked" in str(exc))

    check("no language is both declared and refused",
          not (set(CEN.TOKENISER_SITE) & set(CEN.NO_TOKENISER)))


def _every_section_runs(listed):
    """A RUNNER LIST IS A POPULATION NOBODY WROTE DOWN, and its failure mode
    is silent: a section written, correct, and simply absent from the tuple
    below prints nothing and the suite still says every check passed.
    MEASURED ON THIS REPO, 2026-08-21: `test_readability.py` §10 was written,
    was right, never ran, and the file reported `111 PASS, all pass`.

    Asked FIRST, so a missing section is named before any section runs.
    """
    have = {k for k, v in globals().items()
            if k.startswith("test_") and callable(v)}
    missing = sorted(have - {f.__name__ for f in listed})
    print("\n0. every test_* function in this file is in the runner list")
    check("no section is defined and executed by nothing", not missing,
          str(missing))


def test_the_population_is_a_language_parameter():
    """M-22's RENAMES (2026-08-28), the last of the entry's counted sites:
    `corpus_files` globbed `eng_*` and `OUT_DEFAULT` spelled `_eng` as
    literals, so run 2 would have started by editing the instrument — the
    exact thing the registration's world-shape promise forbids. Both are a
    language parameter now, with the eng DEFAULTS byte-identical to the
    declared run-1 population so no recorded figure moves.

    The one design decision worth a check of its own: a NON-eng call gets
    NO controls appended. `sonnets.txt` and `whitman.txt` are the ENGLISH
    run's declared positive and negative arms; carrying them into a Welsh
    census would be an English control laundered into another language's
    figures (doctrine 13/14). Run 2 declares its own controls per
    tradition.
    """
    print("\n8. the population is a language parameter (M-22's renames)")
    import glob
    eng = CEN.corpus_files()
    old = sorted(glob.glob(os.path.join(CEN.ROOT, "corpus", "song",
                                        "eng_*.txt")))
    old += [os.path.join(CEN.ROOT, "corpus", "sonnets.txt"),
            os.path.join(CEN.ROOT, "corpus", "whitman.txt")]
    check("the eng default reproduces the declared run-1 population "
          "byte-identically — no recorded figure moves under a rename",
          eng == old, f"{len(eng)} vs {len(old)}")
    cym = CEN.corpus_files(language="cym")
    check("another language globs its own prefix and gets NO English "
          "controls (doctrine 13/14)",
          cym and all("/song/" in f.replace(os.sep, "/") for f in cym)
          and all(os.path.basename(f).startswith("cym_") for f in cym),
          [os.path.basename(f) for f in cym[:3]])
    check("its song files key their own family, which has NO "
          "RHYME_CONSTRAINED row — M-23's three-state table reports that "
          "as `undeclared` rather than a measured negative",
          bool(cym) and CEN.family_of(cym[0]) == "cym_song"
          and "cym_song" not in CEN.RHYME_CONSTRAINED,
          CEN.family_of(cym[0]) if cym else "no cym files")
    check("the artifact path derives per language and the eng spelling IS "
          "the committed table",
          CEN.OUT_DEFAULT == CEN.out_path("eng")
          and CEN.out_path("cym").endswith("structure_census_cym.tsv")
          and CEN.OUT_DEFAULT.endswith("structure_census_eng.tsv"))
    check("the two controls keep their own families either way",
          CEN.family_of(eng[-2]) == "sonnets"
          and CEN.family_of(eng[-1]) == "whitman")


if __name__ == "__main__":
    SECTIONS = (test_rows, test_item_readers, test_cell_accounting,
                test_constrained_tag, test_the_struck_tag_says_so,
                test_tsv_roundtrip, test_checkpointing,
                test_tokeniser_is_declared,
                test_the_population_is_a_language_parameter)
    _every_section_runs(SECTIONS)
    for fn in SECTIONS:
        fn()
    print("=" * 62)
    if FAILURES:
        print(f"{len(FAILURES)} FAILING: {', '.join(FAILURES)}")
        sys.exit(1)
    print("the census instrument: one judge, three counts, declared "
          "populations, and its readers are the repo's own")
