#!/usr/bin/env python3
"""Pins for `quality/audit_corpus.py` — the corpus auditor's own oracle.

Same shape and same standard as `quality/test_register_audit.py`, and for the
same reason. Doctrine 94: a positive-case suite cannot find a rule that is too
generous, and an auditor is exactly that shape of instrument. Its generous
failure mode is SILENCE — a check that stops firing because a regex drifted
looks identical to a corpus that got fixed. So the calibration set here is the
errors this repo ALREADY KNOWS ABOUT, and the test fails if the auditor stops
rediscovering them:

  1. the Háttatal consonant wipe        doctrine 52
  2. the byte-identical cltk pair       doctrine 51
  3. Malay extract-vs-source population doctrine 79 / 70

Each case runs twice — see `audit_corpus.calibrate`. The PLANTED half is a
fixture that carries the mechanism and travels with this file, so it runs with
no network and no scratch tree. The REAL half runs only when the tree is
reachable and checks the recorded FIGURE (3,474 Greek-block characters in 121
pages; md5 c221b376…; 705/330 blocks, `-uk` 0 against 2). A missing tree is
UNREACHABLE and does not fail — doctrine 49 — but it is never silent.

THE SECOND HALF OF THIS FILE IS THE OTHER DIRECTION, and it is the half a
calibration set usually forgets. An auditor that only ever reports findings is
not measuring anything, so there are also pins on the checks that must come
back CLEAN on this corpus and on the two false-positive classes this auditor
already produced and had removed:

  * a prose sentence is not a declared count (33 FAILs, 30 of them the
    auditor's own)
  * an extract's md5 is not its source's md5 (8 FAILs, all of them the
    auditor's own)

Both are pinned, because a fix that is not tested is a fix that comes back.

    python3 quality/test_corpus_audit.py

Deliberately cheap where it can be: the planted calibration and the
false-positive pins take about a second. The whole-corpus pins load 269 files
and take about twenty.
"""

import os
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from quality import audit_corpus as AC   # noqa: E402

FAILURES = []


def check(name, cond, detail=""):
    if cond:
        print("  ok    %s" % name)
    else:
        print("  FAIL  %s   %s" % (name, detail))
        FAILURES.append(name)


_CASES = None


def cases():
    global _CASES
    if _CASES is None:
        _CASES = AC.calibrate(verbose=False)
    return _CASES


def _case(prefix):
    for c in cases():
        if c["case"].startswith(prefix):
            return c
    return {"planted": {"verdict": "NOT REGISTERED", "detail": prefix},
            "real": {"verdict": "NOT REGISTERED", "detail": prefix}}


# ---------------------------------------------------------------------------
# 1. THE CALIBRATION SET — the errors we already know about
# ---------------------------------------------------------------------------


def test_calibration_hattatal():
    """Doctrine 52. The 1848 Arnamagnæan Háttatal OCR reads fine and contains
    ZERO occurrences of any of `þ ð æ ǫ ø œ` and the accented vowels, with
    3,474 Greek-block characters standing in their place across 121 pages.

    If the planted half stops firing, check F went blind. If the real half
    stops matching 3,474, either the OCR on disk is a different scan or the
    window search changed — both need a human, neither may pass silently.
    """
    c = _case("1")
    check("F re-finds the consonant wipe on the planted fixture",
          c["planted"]["verdict"] == "REDISCOVERED", c["planted"]["detail"])
    check("the real 1848 OCR reproduces 0 channel chars and 3,474 Greek",
          c["real"]["verdict"] != "MISSED", c["real"]["detail"])


def test_calibration_cltk_pair():
    """Doctrine 51. `cltk/non_texts` and `cltk/old_norse_texts_heimskringla`
    are byte-identical, md5 c221b3761633838018e24ccf4e43e7fd. Four sources,
    one edition, one editor's decisions, one rights status."""
    c = _case("2")
    check("E re-finds the byte-identical pair on the planted fixture",
          c["planted"]["verdict"] == "REDISCOVERED", c["planted"]["detail"])
    check("the real cltk pair still hashes to c221b376…",
          c["real"]["verdict"] != "MISSED", c["real"]["detail"])
    check("the recorded md5 has not been edited out of the module",
          AC.RECORDED["cltk_md5"] == "c221b3761633838018e24ccf4e43e7fd")


def test_calibration_malay_population():
    """Doctrine 79, and this session's instance of it. `-uk` is 0 on the
    513-line staged extract and 2 (`teluk`, `bertepuk`) on the 330 Malay
    blocks of PG47873 it was cut from.

    The auditor must do TWO things, not one: see that the extract is contained
    in its source (check E), and refuse to print the extract's zero without
    the population it is a zero of (check G). A zero with no population is how
    the error propagated in the first place.
    """
    c = _case("3")
    check("E+G re-find the extract-vs-source split on the planted fixture",
          c["planted"]["verdict"] == "REDISCOVERED", c["planted"]["detail"])
    check("the real PG47873 reproduces 705/330 blocks and -uk 0 vs 2",
          c["real"]["verdict"] != "MISSED", c["real"]["detail"])


def test_calibration_overall():
    """The gate `--calibrate` exits on."""
    check("calibration_failed() agrees with the three cases",
          AC.calibration_failed(cases()) is False,
          str([(c["case"], c["planted"]["verdict"], c["real"]["verdict"])
               for c in cases()]))


# ---------------------------------------------------------------------------
# 2. DOCTRINE 70's FIGURE, ON THE FILE IN THIS REPOSITORY
#
# The real half of case 3 needs a scratch tree. This one does not: the staged
# Malay file is committed, and doctrine 70's amended figure is measured over
# it. So this is the part of the Malay calibration that runs everywhere.
# ---------------------------------------------------------------------------


def test_doctrine_70_figure_on_the_staged_file():
    p = os.path.join(AC.ROOT, "corpus", "song", "msa_skeat_pantun.txt")
    if not os.path.exists(p):
        check("staged Malay file present", False, p)
        return
    cf = AC.CorpusFile(p)
    counts, ntok = AC._uk_ung(cf.verse_lines)
    check("513 verse lines", len(cf.verse_lines) == 513, len(cf.verse_lines))
    check("2,111 tokens under doctrine 70's stated rule", ntok == 2111, ntok)
    check("-ong 38 tokens / 26 types",
          counts["ong"][:2] == (38, 26), counts["ong"])
    check("-ok 28 tokens / 15 types",
          counts["ok"][:2] == (28, 15), counts["ok"])
    check("-ung 0 and -uk 0 ON THIS FILE",
          counts["ung"][0] == 0 and counts["uk"][0] == 0,
          (counts["ung"], counts["uk"]))
    # and check G must report the SAME numbers, on the SAME tokenisation.
    # It did not at first: the module's default token rule reads
    # `munchong-'kau` as `munchong` + `kau` and counts 39 `-ong` where
    # doctrine 70's rule counts 38. One token, and it is the difference
    # between reproducing the record and quietly disagreeing with it.
    fs = AC.check_orthography([(AC.display_path(p), cf)], AC.Sources())
    check("check G reports doctrine 70's 66 preserving over 2,111 tokens",
          any("66 preserving" in f.measured and "2111 tokens" in f.measured
              for f in fs),
          [f.measured for f in fs])


# ---------------------------------------------------------------------------
# 3. THE TWO FALSE-POSITIVE CLASSES THIS AUDITOR ALREADY PRODUCED
#
# Both were caught on the first full run and both are pinned, because an
# auditor that manufactures findings is worse than one that misses them: a
# reader cannot tell a manufactured finding from a real one, so every real
# finding it prints loses its warrant too.
# ---------------------------------------------------------------------------


def test_prose_is_not_a_declared_count():
    """`cym_song_alun.txt` says "(3 hymns + 3 songs; the free-metre half of
    Gwaith Alun" in prose and `# songs: 6` as a field. 6 is the count of the
    file; 3 is a description of the volume. The first version of check B read
    the prose and reported 33 FAILs, 30 of them its own."""
    tmp = tempfile.mkdtemp(prefix="audit_corpus_fp_")
    p = os.path.join(tmp, "cym_fixture.txt")
    open(p, "w", encoding="utf-8").write(
        "# lang: cym  |  half: SONG (3 hymns + 3 songs; the free-metre half)\n"
        "# songs: 2\n"
        "# note: 852 ghazals in the source; its 50 songs are present\n"
        "\n--- TITLE: one\n[VERSE 1]\nllawer o ddyddiau\n"
        "\n--- TITLE: two\n[VERSE 1]\nffordd y bydd hi\n")
    cf = AC.CorpusFile(p)
    fs = AC._check_declared_counts("cym_fixture.txt", cf, cf.header_fields())
    check("the `# songs: 2` field is checked and passes",
          cf.titles == 2 and not fs,
          "titles=%d findings=%s" % (cf.titles, [f.what for f in fs]))
    check("the prose `3 songs`, `852 ghazals` and `50 songs` are NOT read as "
          "claims about this file", not fs, [f.what for f in fs])


def test_an_extract_md5_is_not_its_source_md5():
    """A `local:` row records the md5 of the STAGED bytes; a header records
    the md5 of the UPSTREAM bytes. Comparing them is comparing an extract to
    its source and calling the difference a defect — doctrine 79's error,
    committed by the instrument built to find it. It produced 8 false FAILs."""
    src = AC.Sources()
    files = AC.load(only=["corpus/song/eng_hall_*.txt"])
    if not files:
        check("eng_hall_* files present", False, "none loaded")
        return
    fs = [f for f in AC.check_header(files, src) if f.severity == AC.FAIL]
    check("no eng_hall_* file FAILs check B on an upstream-md5 comparison",
          not fs, [(f.path, f.what) for f in fs])
    # and the check is not merely disabled: it must still be EXERCISED.
    exercised = 0
    for rel, cf in files:
        if cf.header_md5s() and src.parent_of(cf):
            exercised += 1
    check("the upstream-md5 comparison is still exercised on those files",
          exercised >= 5, exercised)


# ---------------------------------------------------------------------------
# 4. THE CHECKS MUST BE EXERCISED, NOT MERELY QUIET
#
# `battery.py` HAD no assert and returned 0 regardless; this file exists partly
# so this module never becomes that. A check with zero findings is only good
# news if it actually ran on something. (Past tense since `9396946`,
# 2026-08-11: battery.py gained `assert_pinned` and now exits 1 on drift.
# Corrected 2026-08-13 — the hazard this comment names is real and this file
# still guards it; battery.py is simply no longer the example of it.)
# ---------------------------------------------------------------------------

_FILES = None
_SRC = None


def corpus():
    global _FILES, _SRC
    if _FILES is None:
        _SRC = AC.Sources()
        _FILES = AC.load()
    return _FILES, _SRC


def test_the_walk_reports_what_it_did_not_walk():
    """Doctrine 34 can only be asked of a file the WALK HANDED OVER.

    `load()` reads two extensions. Anything else under `corpus/` reached no
    check at all — so for a `.csv` or `.tsv` the question was not answered NO,
    it was NOT ASKED, and the audit would report the tree clean without ever
    having looked. MEASURED 2026-08-16: all 269 files are `.txt`/`.json`, so
    the hole was LATENT — which is exactly why it survived a year of runs.

    THE PLANT IS THE POINT. A latent hole cannot be demonstrated by asserting
    zero: `unwalked() == []` is true of a working check and of a deleted one
    alike. So this section CREATES a file the walk skips, requires the audit
    to name it, and removes it — the same two-sided shape every other lane
    this week used, applied to a population that is empty today.
    """
    import tempfile
    base = tempfile.mkdtemp()
    sub = os.path.join(base, "corpus")
    os.makedirs(sub)
    for n in ("a.txt", "b.json", "c.csv", "d.tsv", "notes.md"):
        with open(os.path.join(sub, n), "w", encoding="utf-8") as fh:
            fh.write("x\n")
    walked = {os.path.basename(r) for r, _cf in AC.load(sub)}
    skipped = {os.path.basename(p) for p in AC.unwalked(sub)}
    check("the walk reads exactly the declared extensions",
          walked == {"a.txt", "b.json"}, sorted(walked))
    check("and everything else is REPORTED as unwalked rather than dropped "
          "in silence — the population doctrine 34 was never asked of",
          skipped == {"c.csv", "d.tsv", "notes.md"}, sorted(skipped))
    check("the two sets partition the tree: nothing is in both, nothing is "
          "in neither (doctrine 79 — two counts, and they must add up)",
          not (walked & skipped) and len(walked) + len(skipped) == 5,
          f"{len(walked)} walked + {len(skipped)} unwalked")
    check("the exclusion is a NAMED constant, not a literal inside the walk",
          AC.EXTS == (".txt", ".json"), str(AC.EXTS))
    # AND THE SHIPPED TREE, stated rather than assumed: today it is empty, and
    # a NOTE per skipped file means the committed shape moves the moment it is
    # not — `--verify-shape` is what turns this from a report into a gate.
    # THE WIRING, NOT THE HELPER — and this is the check the first draft
    # of this section did not have. Everything above tests `unwalked()`
    # and `load()` directly, so stubbing check A's call to `for p in []`
    # left all of it GREEN: the population was computed correctly and
    # reported to nobody, which is the exact shape this whole lane is
    # about. Drive the AUDIT and require the finding.
    _files, findings = AC.audit(sub)
    named = sorted(f.path for f in findings if "NOT WALKED" in f.what)
    check("the AUDIT reports every skipped file — not just the helper "
          "that can find them",
          {os.path.basename(p) for p in named}
          == {"c.csv", "d.tsv", "notes.md"}, named)
    check("...and it reports the tree it was HANDED, not the shipped one "
          "— the first implementation called `unwalked()` with no root",
          all(p.startswith(sub) or "/corpus/" in p for p in named)
          and not any("song/" in p for p in named), named[:3])
    check("the shipped corpus/ has NOTHING the walk skips today, so this "
          "check is latent by measurement and not by construction",
          AC.unwalked() == [], AC.unwalked()[:5])


def test_every_file_reaches_a_row():
    """Doctrine 34, the live assertion. A file with no row IS the defect."""
    files, src = corpus()
    none = [rel for rel, cf in files
            if src.route(cf, rel)[0] == AC.ROUTE_NONE]
    check("every corpus file reaches a data/sources.tsv row",
          not none, none[:6])
    check("the corpus is not empty (the check ran on something)",
          len(files) > 200, len(files))


#: A file that names TWO sources, one of which has a row and one of which does
#: not.  This is the shape three real corpus files had, and the shape check A
#: could not see: `Sources.route` stops at the first header id that resolves,
#: so the declared half answered for the undeclared one.
_TWO_SOURCES = """\
# author: PLANTED FIXTURE D
# source: GITenberg/The-Home-Book-of-Verse---Volume-1_2619 2619.txt md5 \
cc5e9f7b88436840e62b5ae53ca193e8
# licence: public domain - Project Gutenberg; edition published 1912
# source: GITenberg/There-Is-No-Such-Book_99999 99999.txt md5 \
00000000000000000000000000000000
# licence: public domain - Project Gutenberg; edition published 1899

--- TITLE: one
--- SOURCE: PG2619
[VERSE 1]
The listening earth had turned her face away,
And all the singing rivers held their breath.
"""


def _plant_two_sources(tmp, name, body):
    p = os.path.join(tmp, name)
    open(p, "w", encoding="utf-8").write(body)
    return AC.display_path(p), AC.CorpusFile(p)


def test_a_second_header_source_must_reach_a_row_too():
    """Doctrine 34, and the hole this test was written for.

    `check_row` used to ask `Sources.route`, which returns on the FIRST
    `# source:` id that matches a row. A file with two headers passed if
    EITHER resolved, so doctrine 34's real question — is everything in this
    file DECLARED — was being answered by a different question, is this file
    REACHABLE. Three shipped files were in exactly that state and the auditor
    reported 0 FAIL over all 269 of them:

        corpus/song/eng_american_ann_taylor.txt              42947, declared 2nd
        corpus/song/eng_american_jane_taylor.txt             42947, declared 3rd
        corpus/song/eng_american_margaret_junkin_preston.txt 16480, declared 1st

    BOTH ORDERS ARE PLANTED, because the bug is not about position: the
    Beechenbrook case declared the undeclared source FIRST and still passed,
    since `parent_ids` is scanned longest-first and not in header order. And
    the pin that makes this a demonstration rather than an assertion is the
    third check below: `route()` STILL answers ROUTE_HEADER on the planted
    file. The old check was not merely quiet on this fixture — it was
    affirmatively satisfied by it.

    The control is the other half, and it is the half a liveness test skips:
    withdraw the unresolved header and the check must go silent. A check that
    fires on the fixture and on its control is not detecting anything.
    """
    tmp = tempfile.mkdtemp(prefix="audit_corpus_a_")
    src = AC.Sources()

    def fails_for(rel, findings):
        return [f for f in findings
                if f.severity == AC.FAIL and f.path == rel]

    # 1 — good header first, undeclared second (the Taylor shape)
    rel, cf = _plant_two_sources(tmp, "eng_planted_two.txt", _TWO_SOURCES)
    fs = fails_for(rel, AC.check_row([(rel, cf)], src))
    check("A FAILs the second `# source:` id when the first one resolves",
          len(fs) == 1 and "There-Is-No-Such-Book_99999" in fs[0].what,
          [(f.severity, f.what[:90]) for f in fs])

    # 2 — undeclared FIRST, good second (the Beechenbrook shape)
    swapped = _TWO_SOURCES.split("\n")
    swapped = "\n".join(swapped[:1] + swapped[3:5] + swapped[1:3]
                        + swapped[5:])
    rel2, cf2 = _plant_two_sources(tmp, "eng_planted_swap.txt", swapped)
    check("...and the planted file really is the same two declarations in the "
          "other order",
          cf2.source_declarations() == list(reversed(cf.source_declarations())),
          (cf.source_declarations(), cf2.source_declarations()))
    fs = fails_for(rel2, AC.check_row([(rel2, cf2)], src))
    check("A FAILs the FIRST `# source:` id too — the defect is not positional",
          len(fs) == 1 and "There-Is-No-Such-Book_99999" in fs[0].what,
          [(f.severity, f.what[:90]) for f in fs])

    # 3 — the demonstration: the OLD answer passes this file outright
    check("`route()` still answers ROUTE_HEADER on it, which is exactly why "
          "the old check reported 0 FAIL on the three real files",
          src.route(cf, rel) == (AC.ROUTE_HEADER,
                                 "GITenberg/The-Home-Book-of-Verse---Volume-1_2619"),
          src.route(cf, rel))

    # 4 — the control: withdraw the unresolved header, the check goes silent
    only_good = "\n".join(l for l in _TWO_SOURCES.split("\n")
                          if "99999" not in l and "1899" not in l)
    rel3, cf3 = _plant_two_sources(tmp, "eng_planted_one.txt", only_good)
    check("...and the fixture with only its resolving header is SILENT",
          not fails_for(rel3, AC.check_row([(rel3, cf3)], src)),
          [(f.severity, f.what[:90])
           for f in fails_for(rel3, AC.check_row([(rel3, cf3)], src))])


def test_every_declared_source_reaches_a_row():
    """Doctrine 34 over the live corpus, at the DECLARATION and not the file.

    `test_every_file_reaches_a_row` is the file-level assertion and it passed
    for the whole time the two editions below were undeclared. This is the one
    that could not.

    EXERCISED, NOT MERELY QUIET — the zero below is only news if the check ran
    on something, and its silent failure mode is a regex that stops extracting
    ids at all. 1367 id-shaped `# source:` declarations across 1175 files
    (REPINNED 2026-08-20 Tier-1 load; 587/514 at the Minstrel load)
    (REPINNED 2026-08-20 from 336/269: the Minstrel mass load's 245 files
    each declare the parent GITenberg id), 62 of which declare two or more;
    the handful of remaining `# source:` lines are the prose form
    (`# source: GITenberg PG 12907 -- file raw_12907-8.txt`), name no id,
    and are deliberately not covered — see `CorpusFile.source_declarations`.

    THE FALSE-POSITIVE HALF IS PINNED WITH THE SAME WEIGHT, because this
    module's own history is that a check which manufactures findings costs
    more than one that misses them (33 FAILs, 30 of them its own). Two shipped
    headers write a LONGER repo slug than the table does for the same GITenberg
    repo, and a containment-only match reports both as undeclared. They are one
    source, and stage 3 of `resolve_declared` — same org, same Project
    Gutenberg ebook number — is what says so.
    """
    files, src = corpus()
    decls = {rel: cf.source_declarations() for rel, cf in files}
    total = sum(len(v) for v in decls.values())
    check("1367 id-shaped `# source:` declarations are checked, over 1175 "
          "files", total == 1367 and len(files) == 1175, (total, len(files)))
    # REPINNED 2026-08-20 (Tier-1): 62 -> 70 — eight of the 18 topped-up
    # files gained their first second source citation.
    # 70 -> 73 same sitting: three twin merges gave their keepers a second
    # book (Boker, Macarthy, Willson).
    # 73 -> 144 (Phase-1): Oxford/PAH items topped up 84 existing files
    # and 19 twin merges gave their keepers another book.
    check("144 files declare two or more sources — the case the file-level "
          "check cannot see",
          sum(1 for v in decls.values() if len(v) > 1) == 144,
          sum(1 for v in decls.values() if len(v) > 1))
    bad = [(rel, d) for rel, cf in files for d, _, _ in src.undeclared_sources(cf)]
    check("every declared `# source:` id reaches a data/sources.tsv row",
          not bad, bad[:6])

    # the two rows this fix added, by name: a zero above with these rows
    # deleted is the state the corpus shipped in.
    for sid in ("GITenberg/Little-Ann-and-Other-Poems_42947",
                "GITenberg/BeechenbrookA-Rhyme-of-the-War_16480"):
        check("data/sources.tsv declares %s" % sid, sid in src.by_id,
              sorted(k for k in src.by_id if "42947" in k or "16480" in k))

    # the abbreviated-slug pairs, which stage 3 exists for
    for declared, row in (
            ("GITenberg/Kanteletar--Suomen-kansan-wanhoja-lauluja-ja-wirsi-_7078",
             "GITenberg/Kanteletar_7078"),
            ("GITenberg/Malay-Magic-Being-an-introduction-to-the-folklore-and-"
             "popular-religion-of-the-Malay-Peninsula_47873",
             "GITenberg/Malay-Magic_47873")):
        got = src.resolve_declared(declared)
        check("the header's full slug resolves to the table's short one "
              "(%s)" % row.split("/")[-1],
              got is not None and _PG_NUM(got) == _PG_NUM(row), (declared, got))

    # ...and stage 3 must not become a wildcard: a different ebook number is
    # a different edition and must still be unresolved.
    check("a same-org id with an ebook number no row carries stays UNRESOLVED",
          src.resolve_declared("GITenberg/There-Is-No-Such-Book_99999") is None,
          src.resolve_declared("GITenberg/There-Is-No-Such-Book_99999"))


def _PG_NUM(sid):
    m = AC._PG_ID.match(sid.split("#")[0])
    return m.group(2) if m else None


def test_no_recorded_hash_has_drifted():
    files, src = corpus()
    fs = [f for f in AC.check_hash(files, src) if f.severity == AC.FAIL]
    check("no file has drifted from its recorded hash",
          not fs, [(f.path, f.measured) for f in fs][:4])
    # exercised: some rows DO record a hash, or the check is vacuous
    have = 0
    for rel, cf in files:
        route, sid = src.route(cf, rel)
        if route == AC.ROUTE_LOCAL and \
                ("md5 " in src.blobs.get(sid, "") or
                 "sha256 " in src.blobs.get(sid, "")):
            have += 1
    check("at least 40 files have a recorded hash to drift FROM",
          have >= 40, have)


def test_channel_check_is_exercised_and_finds_no_zero():
    """Check F must run on most of the corpus and find no Háttatal case in it.
    Both halves matter: a floor nobody reaches and a check nobody runs look
    identical from the summary line."""
    files, src = corpus()
    keyed = [rel for rel, cf in files
             if AC.declared_language(cf, rel)[0] in AC.CHANNEL]
    check("check F keys on a declared language for >90%% of the corpus",
          len(keyed) >= 0.90 * len(files), "%d of %d" % (len(keyed), len(files)))
    zeros = [f for f in AC.check_channel(files, src) if f.severity == AC.FAIL]
    check("no shipped corpus file has a ZERO channel",
          not zeros, [(f.path, f.what) for f in zeros][:4])


def test_distinct_bytes_finds_the_two_live_duplications():
    """Doctrine 51, live. This corpus HAD two item-level duplications and the
    auditor found both. Its own docstring said that when these stop firing,
    either they were fixed (check the corpus) or check E went blind (check the
    code). ANSWER, 2026-08-11: they were fixed.

    Coleridge/Wordsworth — the 1798 Lyrical Ballads is anonymous in its own
    bytes and was being split between the two files by a LINE-COUNT CAP
    (max_lines 200 vs 140) standing in for an author rule, so nine poems were
    staged twice. The 1800 second edition is signed `By W. WORDSWORTH.` and its
    Preface names a closed list of five poems by "a Friend"; that split is the
    source's own and it is what the corpus carries now.
    Tate/Brady — PG 16455 signs the shared hymn `Tate-Brady.`, a JOINT
    attribution, and the string "Brady" occurs nowhere else in the source. Both
    files claimed it solely, in opposite directions. It is one joint file now.

    THE ZEROS BELOW CANNOT DISTINGUISH A FIXED CORPUS FROM A BLIND CHECK, so
    they are not the evidence that E works — `test_check_E_can_actually_fire`
    is, and it plants a byte-identical pair and requires E to re-find it
    (doctrine 94).

    CORRECTION, 2026-08-11, cell AC: the sentence above was TRUE OF NOTHING
    when it was written. There was no `test_check_E_can_actually_fire` in this
    file — `grep '^def test_'` returned fifteen names and that was not one of
    them. The file-level half of E did have a liveness guard
    (`test_calibration_cltk_pair` plants two byte-identical FILES), but the
    ITEM-body half, which is the half that found both live duplications, had
    none. The named test now exists, immediately below, and it plants all three
    of E's units. A liveness guard cited in prose is doctrine 48's shape: a
    principle that lives only in prose gets followed as often as someone
    remembers it.

    E WAS ALSO TOO COARSE, and that half of the old note was right and is now
    closed. Its only unit was BYTE identity, so it saw none of the 94 pairs at
    >=60% line containment that a sweep over the 143 eng_* files found — 93
    distinct items, ~1,950 body lines counted twice, of which 3 were cross-file
    attribution errors of exactly the kind this test exists for. E has an item
    NEAR-duplicate unit now and `test_item_level_near_duplication_series` pins
    what it reports."""
    files, src = corpus()
    fs = [f for f in AC.check_distinct(files, src) if f.severity == AC.FAIL]
    check("E finds NO byte-identical item shared across two files",
          len(fs) == 0, [(f.path, f.what[:80]) for f in fs])
    ws = [f for f in fs if "wordsworth" in f.what or "coleridge" in f.what]
    check("...and specifically not the Lyrical Ballads pair, which was 9 "
          "item bodies staged under both authors",
          not ws, [f.what[:160] for f in ws])
    tb = [f for f in fs if "tate" in f.what or "brady" in f.what]
    check("...nor the Tate/Brady hymn, which was 1 item body claimed solely "
          "by each of two files",
          not tb, [f.what[:160] for f in tb])


_NEAR_A = """\
# author: PLANTED FIXTURE A
# licence: n/a

--- TITLE: The listening earth
[VERSE 1]
The listening earth had turned her face away,
And all the singing rivers held their breath,
While in the hollow of the failing day
The reapers bound their sheaves and spoke of death.
[VERSE 2]
No lamp was lit upon the western hill,
No shepherd called his flock across the fen,
The mill-wheel and the water both were still,
And nothing moved but shadows and the men.
[VERSE 3]
A hundred summers went the way they came,
And took the corn and left the empty ground,
And no one in the valley knew her name,
And no one in the valley heard the sound.
"""

#: The SAME poem, in the reading of a different printing.  Ten of the twelve
#: lines differ only in punctuation, capital and spacing — which is what an
#: editor is free to change — and two differ in a WORD, which is what a
#: recension does.  Byte identity sees two poems; so does an item-body md5.
_NEAR_B = """\
# author: PLANTED FIXTURE B
# licence: n/a

--- TITLE: Song
[VERSE 1]
The listening Earth had turned her face away;
And all the singing rivers held their breath--
While in the hollow of the failing day,
The reapers bound their sheaves, and spoke of death!
[VERSE 2]
No lamp was lit upon the Western hill;
No shepherd called his flock across the fen.
The mill-wheel and the water both were still;
And nothing moved but shadows, and the men.
[VERSE 3]
A hundred winters went the way they came;
And took the corn, and left the empty ground:
And no one in the valley knew her name,
And no one in the hamlet heard the sound.
"""

#: One item that is really two: the extractor swallowed the printed title of
#: the second poem, which stands here as a body line and is ALSO the title of
#: a separate item in the same file.
_RUNON = """\
# author: PLANTED FIXTURE C
# licence: n/a

--- TITLE: The reapers bound their sheaves
[VERSE 1]
The listening earth had turned her face away,
And all the singing rivers held their breath,
While in the hollow of the failing day
The reapers bound their sheaves and spoke of death.
[VERSE 2]
A CANDLE FOR THE DROWNED
Bring me a candle for the drowned, she said,
And set it burning where the currents part,
For all the water cannot warm the dead
Nor all the burning thaw a sailor's heart.
[VERSE 3]
So take the candle down and let it go,
And do not watch it further than the bend;
The river knows the way the drowned men row
And carries what it carries to the end.

--- TITLE: A candle for the drowned
[VERSE 1]
Bring me a candle for the drowned, she said,
And set it burning where the currents part,
For all the water cannot warm the dead
Nor all the burning thaw a sailor's heart.
[VERSE 2]
So take the candle down and let it go,
And do not watch it further than the bend;
The river knows the way the drowned men row
And carries what it carries to the end.
"""


def _plant_E(tmp, *names):
    """Write the requested fixtures and return them as `check_distinct` wants
    them.  Nothing here touches the real tree."""
    blobs = {"a": _NEAR_A, "b": _NEAR_B, "runon": _RUNON}
    out = []
    for n in names:
        p = os.path.join(tmp, "eng_planted_%s.txt" % n)
        open(p, "w", encoding="utf-8").write(blobs[n])
        out.append((AC.display_path(p), AC.CorpusFile(p)))
    return out


def test_check_E_can_actually_fire():
    """Doctrine 94, aimed at check E, and the test the file's own prose has
    been citing since before it was written.

    E has three units and each one's clean run on this corpus is a ZERO. A
    zero cannot tell a fixed corpus from a blind check, so every one of them
    gets a plant here and has to be re-found:

      1. two item bodies IDENTICAL across two files   (the Tate/Brady shape)
      2. two item bodies that are the same poem in TWO PRINTINGS, differing in
         punctuation, spelling and case, so no hash sees them  (the Watts /
         Otterbein shape, and the shape all three of this round's cross-file
         attribution errors had)
      3. one item that is really two, caught because the second poem's printed
         title survives as a body line and titles another item  (the run-on)

    And the other direction, which is the half a liveness test usually skips:
    each check must go SILENT when its plant is withdrawn. A check that fires
    on one fixture and also on its control is not detecting anything."""
    tmp = tempfile.mkdtemp(prefix="audit_corpus_e_")
    src = AC.Sources()

    # 1 — byte-identical item bodies across two files
    same = os.path.join(tmp, "eng_planted_same.txt")
    open(same, "w", encoding="utf-8").write(
        _NEAR_A.replace("PLANTED FIXTURE A", "PLANTED FIXTURE A2"))
    pair = _plant_E(tmp, "a") + [(AC.display_path(same), AC.CorpusFile(same))]
    fs = AC.check_distinct(pair, src)
    check("E re-finds two item bodies that are byte-identical across files",
          any(f.severity == AC.FAIL and "byte-identical across" in f.what
              for f in fs),
          [(f.severity, f.what[:90]) for f in fs])

    # 2 — the same poem in two printings.  NOT byte-identical: assert that
    #     first, or this fixture would be case 1 wearing a different name.
    two = _plant_E(tmp, "a", "b")
    bodies = [AC._items(cf)[0][1] for _, cf in two]
    check("...and the near-duplicate fixture is genuinely NOT byte-identical",
          "\n".join(bodies[0]) != "\n".join(bodies[1]),
          [bodies[0][0], bodies[1][0]])
    fs = AC.check_distinct(two, src)
    check("E re-finds one poem printed two ways across two files, which the "
          "item-body hash cannot see",
          any(f.severity == AC.FAIL and "line containment" in f.what
              for f in fs),
          [(f.severity, f.what[:90]) for f in fs])

    # 3 — the run-on
    ro = _plant_E(tmp, "runon")
    fs = AC.check_distinct(ro, src)
    check("E re-finds the RUN-ON: one item carrying another item's title as a "
          "body line",
          any("FALSE UNIT" in f.what and "RUN-ON" in f.measured for f in fs),
          [(f.severity, f.what[:90]) for f in fs])

    # the controls — withdraw the plant, the check must fall silent
    solo = _plant_E(tmp, "a")
    fs = AC.check_distinct(solo, src)
    check("E is SILENT on the fixture alone, with nothing to duplicate it",
          not fs, [(f.severity, f.what[:90]) for f in fs])
    clean = os.path.join(tmp, "eng_planted_clean.txt")
    open(clean, "w", encoding="utf-8").write(
        _RUNON.split("--- TITLE: A candle")[0]
        .replace("A CANDLE FOR THE DROWNED\n", ""))
    fs = AC.check_distinct(
        [(AC.display_path(clean), AC.CorpusFile(clean))], src)
    check("E is SILENT on the run-on fixture once the swallowed title and the "
          "item it pointed at are removed",
          not fs, [(f.severity, f.what[:90]) for f in fs])


def test_item_level_near_duplication_series():
    """E's new unit, on the live corpus, reported as a SERIES.

    Doctrine 16: 0.60 containment is an uncalibrated threshold and one of
    those fails toward whoever guessed. Doctrine 89: report the series, not
    the point, because a single count at a single cut cannot show whether the
    population is real or manufactured by the cut. Measured over the 388
    `eng_*` files at ITEM_SHARED_MIN 8 (REPINNED 2026-08-20; the 143-file
    column is the 2026-08-16 record):

        cut   pairs  within  cross    AT 616 FILES     AT 143 FILES
        0.30     53      45      8        46  39  7        39   39   0
        0.50     43      38      5        40  35  5        35   35   0
        0.60     31      31      0        31  31  0        31   31   0
        0.80     24      24      0        24  24  0        24   24   0
        1.00      5       5      0         5   5  0         5    5   0

    (REPINNED 2026-08-20, Phase-1. THE WITHIN-FILE COUNT ROSE 39 -> 45 AND
    THAT IS THE TWIN MERGE, NOT NEW DUPLICATION: merging a
    spelling-variant twin necessarily converts a CROSS-file variant pair
    into a WITHIN-file one, so the two columns trade rather than grow.)

    (REPINNED 2026-08-20, Tier-1 concurrent load; the 388-file column is
    the same day's Minstrel-load record, the 143-file column 2026-08-16.)

    THE CROSS-FILE ZERO HOLDS AT THE AUDIT'S OWN FLOOR (0.60) AND ABOVE.
    Below the floor the Minstrel mass load introduced four REAL cross-SOURCE
    variant printings — two printings of one song from two different books,
    textually far enough apart that neither is a copy of the other: Isobel
    Pagan's 'Ca' the Yowes' against Burns's rewrite (0.50 — both
    attributions are the tradition's own), James Home's Minstrel variant
    against James Hogg's 'O, Saw Ye This Sweet Bonny Lassie' (0.58), James
    Montgomery's Minstrel printing of 'Slavery That Was' against his own
    hymnal's 'Ages, ages have departed' (0.54), and Charles Mackay's
    'Cheer, Boys! Cheer!' against Henry Russell's parlour-song printing
    (0.38). The Tier-1 load added three more of the same kind: Lamar
    Fontaine's 'All Quiet Along the Potomac To-Night' (Southern War
    Songs' credit) against Ethel Lynn Beers's 'The Picket-Guard' at 0.55
    AND against her second printing at 0.50 — the Civil War's most
    famously CONTESTED attribution, and both credits are the editions'
    own, so the corpus records the dispute rather than adjudicating it —
    and Robert Jones's Elizabethan 'Love is a bable' against D'Urfey's
    Leveridge-set printing a century later (0.38). Each is a variant pair
    the dedup rail (floor 0.60) is CORRECT to keep; deleting either half
    would erase a real printing. The within-file series is UNCHANGED at
    every cut across both loads.

    The within-file count is NOT zero and is not claimed to be. 31 pairs
    remain, in the files where the source class does not decide which printing
    to keep — two of the poet's own volumes (Rossetti's Poems against her
    Goblin Market; Blake's Songs against the Poems of William Blake), or two
    anthologies (three printings of the Battle Hymn of the Republic). Deleting
    on a tiebreak there would be attribution by convenience; they are open and
    counted in data/sources.tsv.

    A pin, not a floor: if a later round closes more of them this test is
    what has to be edited, and editing it is where the reason gets written
    down."""
    files, src = corpus()
    eng = [(r, c) for r, c in files if r.startswith("corpus/song/eng_")]
    recs = AC._item_signatures(eng)
    check("1049 eng_* files and 7,258 items are big enough to judge",
          len({r for r, _ in eng}) == 1049 and len(recs) == 7258,
          (len({r for r, _ in eng}), len(recs)))
    series = {}
    for cut in (0.30, 0.50, 0.60, 0.80, 1.00):
        ps = AC.item_overlap_pairs(recs, cut, AC.ITEM_SHARED_MIN)
        within = sum(1 for _, _, s, b in ps if s[0] == b[0])
        series[cut] = (len(ps), within, len(ps) - within)
    check("NO cross-file item duplication survives at the audit's own 0.60 "
          "floor or above — below it sit exactly the 8 named cross-source "
          "variant printings (Pagan~Burns, Home~Hogg, Montgomery~Montgomery, "
          "Mackay~Russell, Fontaine~Beers x2, Jones~Durfey, and Durfey's "
          "_Pills_ reprinting the Earl of Dorset's song, which Oxford prints "
          "under Dorset)",
          series[0.60][2] == 0 and series[0.80][2] == 0
          and series[1.00][2] == 0 and series[0.30][2] == 8
          and series[0.50][2] == 5, series)
    check("the within-file series is 45 / 38 / 31 / 24 / 5",
          [series[c][1] for c in (0.30, 0.50, 0.60, 0.80, 1.00)]
          == [45, 38, 31, 24, 5], series)
    shapes = {}
    for _rel, _i, _t, _n, shape, _h in AC.false_unit_items(eng):
        shapes[shape.split(" ")[0]] = shapes.get(shape.split(" ")[0], 0) + 1
    # REPINNED 2026-08-20: +2 RUN-ONs and +2 TITLE echoes, all in
    # PRE-EXISTING files (Jean Ingelow, Watts) — the mass load's own titles
    # supply new cross-references, the same mechanism as the 2026-08-19
    # Watts finds. Recorded, not repaired, per CORPUS_LOADING_PROTOCOL.md.
    check("4 CONTENTS pages, 5 RUN-ONs and 5 TITLE echoes remain, all named",
          shapes == {"CONTENTS": 4, "RUN-ON": 5, "TITLE": 5}, shapes)


def test_check_C_can_actually_fire():
    """Doctrine 94 again, aimed at check C. Every hash on this corpus matches,
    so the only evidence that C works is a file that has drifted — and there
    isn't one. Plant one: a `local:` row whose recorded md5 is a hex string
    that is not the file's."""
    tmp = tempfile.mkdtemp(prefix="audit_corpus_c_")
    p = os.path.join(tmp, "cym_drifted.txt")
    open(p, "w", encoding="utf-8").write(
        "# lang: cym\n# licence: n/a\n\nllawer o ddyddiau ffordd\n")
    cf = AC.CorpusFile(p)
    src = AC.Sources()
    sid = "local:" + AC.display_path(p)
    src.by_id[sid] = {"source_id": sid, "licence": "n/a", "note": ""}
    src.blobs[sid] = "staged; md5 %s" % ("0" * 32)
    fs = AC.check_hash([(AC.display_path(p), cf)], src)
    check("C reports md5 drift when the recorded value is not the file's",
          any(f.severity == AC.FAIL and "drift" in f.what for f in fs),
          [(f.severity, f.what) for f in fs])
    src.blobs[sid] = "staged; md5 %s" % cf.md5
    fs = AC.check_hash([(AC.display_path(p), cf)], src)
    check("C is silent when the recorded value IS the file's",
          not fs, [(f.severity, f.what) for f in fs])


def test_check_D_can_actually_fire():
    """A file declared `cym` whose bytes are mojibake reads at ~0% under the
    Welsh phonology. This is the case check D exists for, and it is the ONLY
    thing check D is entitled to claim — see the cross-language baseline
    below."""
    tmp = tempfile.mkdtemp(prefix="audit_corpus_d_")
    p = os.path.join(tmp, "cym_mojibake.txt")
    body = "Ð¿ÑÐ¸Ð²ÐµÑ ÐºÐ°Ðº Ð´ÐµÐ»Ð° ÑÑÐ¾ ÑÑÐ¾ " * 40
    open(p, "w", encoding="utf-8").write(
        "# lang: cym\n# licence: n/a\n\n"
        + "\n".join([body] * 4) + "\n")
    cf = AC.CorpusFile(p)
    fs = AC.check_language([(AC.display_path(p), cf)], AC.Sources())
    check("D reports a cym-declared file that does not read as Welsh",
          any(f.severity == AC.FAIL for f in fs),
          [(f.severity, f.measured) for f in fs])


def test_cross_language_baseline_is_what_makes_check_D_weak():
    """The number the module docstring rests on. English reads at 95.8% under
    Welsh, so a high readability rate is NOT evidence that a label is right.
    Pinned so nobody quotes check D as a language test."""
    b = AC.cross_language_baseline()
    r = b["rates"]
    check("English reads >90%% as Welsh under cym.syllabify",
          r["cym"] > 0.90, r)
    check("English reads >95%% as Finnish under fin.syllabify",
          r["fin"] > 0.95, r)
    check("the pinned CROSS_LANGUAGE_BASELINE still reproduces",
          all(abs(AC.CROSS_LANGUAGE_BASELINE[k] - v) < 0.02
              for k, v in r.items()),
          (AC.CROSS_LANGUAGE_BASELINE, r))


# ---------------------------------------------------------------------------
# 5. __main__
# ---------------------------------------------------------------------------


def main():
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    for t in tests:
        print("\n%s" % t.__name__)
        doc = (t.__doc__ or "").strip().split("\n")[0]
        if doc:
            print("  %s" % doc)
        t()
    print("\n" + "-" * 74)
    if FAILURES:
        print("FAILED: %d" % len(FAILURES))
        for f in FAILURES:
            print("   %s" % f)
        return 1
    print("all pins hold")
    return 0


if __name__ == "__main__":
    sys.exit(main())
