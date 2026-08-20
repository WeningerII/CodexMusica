#!/usr/bin/env python3
"""Regressions for the corpus taxonomy (quality/corpus_taxonomy.py) and the
calibration manifest (quality/corpus_manifest.py).

THE TWO CLAIMS THAT MATTER: (1) the taxonomy is INVISIBLE to every
grading reader — a tagged file and its untagged twin read identically,
because a coordinate that moved a measurement would make every adopted
constant a function of bookkeeping; (2) the vocabulary is a CLOSED SET —
an unknown value refuses by name, so a filename can never invent a
category again (the Taylor-sisters defect, mechanical form).

Sections:
  1  the vocabularies load, are non-empty, and hold the declared rows
  2  resolution precedence — per-song beats header beats blank; blank IS
     the honest undeclared, never a guess
  3  the closed set — unknown region/function refuses naming file, song
     and value; a doubled region refuses (contested stays blank)
  3b THE SHAPE GATE — prose on a `# region:`/`# function:` key is not a
     declaration at all, never reaches report()'s counts, and is
     reported once per LINE; with controls proving it did not swallow
     the table gate (a shaped-but-unknown value still refuses by name)
     nor the `-basis:` convention prose is supposed to use
  4  APPARATUS INVISIBILITY — the load-bearing control: tagged vs
     untagged twins through load_lyric_lines, read_marked_songs and
     readability.read_lines, byte-identical
  5  the backfilled corpus — every eng file carries a legal region, the
     Taylor pin (english despite the american filename), the hymn seed,
     Addison's honest blank, and the report's counts kept apart
  6  the manifest — round-trips clean at HEAD; a planted change is named
     as CHANGED (an answer, exit 3, not a refusal)

Run: python3 quality/test_corpus_taxonomy.py
"""

import os
import shutil
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, ".."))
sys.path.insert(0, ROOT)

from quality import corpus_taxonomy as TX  # noqa: E402

FAILURES = []


def check(name, cond, detail=""):
    print(f"  {'PASS' if cond else 'FAIL'}  {name}")
    if detail and not cond:
        print(f"          {detail}")
    if not cond:
        FAILURES.append(name)


def test_tables():
    print("\n1. the vocabularies")
    regions = TX.load_regions()
    functions = TX.load_functions()
    check("regions table holds exactly the four active traditions",
          sorted(regions) == ["american", "english", "irish", "scottish"])
    check("functions table holds exactly the nine active rows",
          sorted(functions) == ["ballad", "carol", "convivial", "hymn",
                                "nursery", "parlour", "patriotic",
                                "political", "stage"])
    check("every row carries a definition and an evidence rule — a value "
          "without an evidence rule cannot be assigned honestly",
          all(r.get("definition") and r.get("evidence_rule")
              for r in list(regions.values()) + list(functions.values())))


def _tmpfile(text):
    d = tempfile.mkdtemp(prefix="tax-")
    p = os.path.join(d, "eng_probe_author.txt")
    with open(p, "w", encoding="utf-8") as f:
        f.write(text)
    return d, p


def test_resolution():
    print("\n2. resolution precedence")
    d, p = _tmpfile(
        "# author: Probe (1800-1880)\n"
        "# region: english\n"
        "# function: hymn\n\n"
        "--- TITLE: Inherits Both\n"
        "[VERSE 1]\nline one\n\n"
        "--- TITLE: Overrides Both\n"
        "--- REGION: scottish\n"
        "--- FUNCTION: patriotic, ballad\n"
        "[VERSE 1]\nline two\n")
    try:
        songs = TX.resolve_songs(p)
        check("a song with no lines of its own inherits the file header",
              songs[0] == ("Inherits Both", "english", ("hymn",)))
        check("a song's own lines beat the header, and function carries "
              "MULTIPLE attested values as a tuple",
              songs[1] == ("Overrides Both", "scottish",
                           ("patriotic", "ballad")))
    finally:
        shutil.rmtree(d)
    d, p = _tmpfile("--- TITLE: Nothing Declared\n[VERSE 1]\nbare\n")
    try:
        songs = TX.resolve_songs(p)
        check("no header and no song lines resolve to BLANK — undeclared "
              "is the honest state, never a guess",
              songs[0] == ("Nothing Declared", "", ()))
    finally:
        shutil.rmtree(d)


def test_closed_set():
    print("\n3. the closed set")
    regions = TX.load_regions()
    functions = TX.load_functions()
    d, p = _tmpfile(
        "# author: Probe\n"
        "--- TITLE: Bad Region\n--- REGION: atlantean\n[VERSE 1]\nx\n"
        "--- TITLE: Bad Function\n--- FUNCTION: dirge\n[VERSE 1]\ny\n"
        "--- TITLE: Doubled Region\n--- REGION: english, scottish\n"
        "[VERSE 1]\nz\n")
    try:
        bad = TX.check_file(p, regions, functions)
        check("an unknown region refuses naming the value",
              any("atlantean" in b for b in bad))
        check("an unknown function refuses naming the value",
              any("dirge" in b for b in bad))
        check("a DOUBLED region refuses — contested stays blank, recorded, "
              "never split between two cells",
              any("SINGLE-VALUED" in b for b in bad))
        check("the three violations are three findings, each naming its "
              "song's line", len(bad) >= 3)
    finally:
        shutil.rmtree(d)


def test_prose_on_a_value_key_is_not_a_declaration():
    """3b. THE SHAPE GATE — prose on `# region:`/`# function:` is not data.

    FOUND DURING THE MONTGOMERY MERGE, by writing an explanatory note on
    a `# function:` key: the reader comma-split the sentence and
    `check_file` reported SEVEN violations, each a fragment of English
    dressed as a bogus vocabulary word.  That was the visible half.  The
    invisible half is what this section exists for -- `report()` never
    calls `check_file`, so on a probe file whose header read
    `# region: CONTESTED, therefore blank -- see the note below` it
    invented a by_region CELL named after the sentence, split the
    `# function:` prose into two more, built a two-cell coverage grid
    from one song, counted it in the MULTI-TAG histogram (the tag
    inflation metric this taxonomy exists to watch), and reported
    `undeclared_region: 0` for a file that says the word "blank" in its
    own header.

    Two gates, and the controls below are what keep them separate: a
    well-shaped value outside the table (`atlantean`) must STILL refuse
    by name, because that is a typo of a value and not prose."""
    print("\n3b. the shape gate — prose on a value key is not a declaration")
    regions, functions = TX.load_regions(), TX.load_functions()
    prose_region = "CONTESTED, therefore blank -- see the note below"
    d, p = _tmpfile(
        "# author: Probe\n"
        f"# region: {prose_region}\n"
        "# function: none, really; this file is mixed\n\n"
        "--- TITLE: A Song\n[VERSE 1]\nline one that is long enough\n")
    try:
        r = TX.report(root=os.path.dirname(p))
        check("prose on `# region:` never becomes a region — no by_region "
              "cell, no coverage cell, nothing named after a sentence",
              r["by_region"] == {} and r["cells"] == {},
              f"{r['by_region']} / {r['cells']}")
        check("...and it does not leak through `# function:` either, NOT "
              "EVEN the well-shaped first word: a line that fails the "
              "shape is prose entire, and harvesting 'none' out of a "
              "sentence is the same defect in miniature",
              r["by_function"] == {} and r["multi_tag"] == {},
              f"{r['by_function']} / {r['multi_tag']}")
        check("the song is counted UNDECLARED on both axes — nobody "
              "successfully declared anything for it",
              r["undeclared_region"] == 1 and r["undeclared_function"] == 1,
              f"{r['undeclared_region']} / {r['undeclared_function']}")
        check("and the collapse is NOT silent (doctrine 20): the unreadable "
              "lines are carried apart, at the LINE where the defect is",
              r["malformed_files"] == 1 and len(r["malformed"]) == 2,
              f"{r['malformed_files']} file(s), {len(r['malformed'])} line(s)")
        bad = TX.check_file(p, regions, functions)
        check("check_file reports ONE violation per LINE, not one per "
              "comma-separated fragment — the Montgomery note produced "
              "seven, and two lines of prose must produce two",
              len(bad) == 2, f"{len(bad)}: {bad}")
        check("...and each names the key and quotes the raw text, so the "
              "reader is told what to fix rather than handed a word salad",
              all("is not a declaration" in b for b in bad)
              and any(prose_region[:20] in b for b in bad), bad)
    finally:
        shutil.rmtree(d)

    # THE CONTROLS. The shape gate must not swallow the table gate: an
    # unknown value that IS shaped like a value is a typo, and a typo has
    # to refuse BY NAME or the closed set stops being enforceable.
    d, p = _tmpfile(
        "# author: Probe\n"
        "--- TITLE: Shaped But Unknown\n--- REGION: atlantean\n"
        "--- FUNCTION: dirge\n[VERSE 1]\nx\n")
    try:
        bad = TX.check_file(p, regions, functions)
        check("CONTROL — a well-shaped unknown value still refuses BY NAME, "
              "so the shape gate has not swallowed the table gate",
              any("atlantean" in b and "not in the table" in b for b in bad)
              and any("dirge" in b for b in bad), bad)
        check("CONTROL — and it is NOT diverted to malformed: it is a typo "
              "of a value, which is a different finding from prose",
              not any("is not a declaration" in b for b in bad), bad)
    finally:
        shutil.rmtree(d)

    # THE `-basis:` CONVENTION is what prose is supposed to use, and it
    # works by the header pattern requiring the colon immediately after
    # the key word. Pinned so a later regex loosening cannot re-open this.
    d, p = _tmpfile(
        "# author: Probe\n"
        "# region: english\n"
        "# region-basis: a long prose sentence, with commas, that would "
        "be four bogus values if this key were parsed as a value key\n"
        "# function-basis: likewise, prose, here\n\n"
        "--- TITLE: A Song\n[VERSE 1]\nline one that is long enough\n")
    try:
        h, _songs = TX.read_file_taxonomy(p)
        check("CONTROL — a `-basis:` key is invisible to the value reader: "
              "the region is still english and nothing is malformed",
              h["region"] == "english" and h["malformed"] == [],
              f"{h['region']!r} / {h['malformed']}")
        check("CONTROL — and a legal declaration beside it is untouched",
              not TX.check_file(p, regions, functions))
    finally:
        shutil.rmtree(d)


def test_apparatus_invisibility():
    print("\n4. APPARATUS INVISIBILITY — tags move no reader")
    body = ("--- TITLE: Twin\n[VERSE 1]\n"
            "we carry the evening to the stone\n"
            "and no one had to tell us alone\n")
    tagged = ("# region: english\n# function: hymn\n" +
              body.replace("[VERSE 1]",
                           "--- REGION: scottish\n"
                           "--- FUNCTION: hymn, patriotic\n[VERSE 1]"))
    da, pa = _tmpfile(body)
    db, pb = _tmpfile(tagged)
    try:
        import lyric_harness as LH
        check("load_lyric_lines: tagged and untagged twins are identical",
              LH.load_lyric_lines(pa) == LH.load_lyric_lines(pb))
        from quality import grid as GR
        sa, sb = GR.read_marked_songs(pa), GR.read_marked_songs(pb)
        check("read_marked_songs: same songs, same titles, same lines",
              len(sa) == len(sb) == 1 and sa[0].title == sb[0].title
              and [l for blk in sa[0].blocks for l in blk.lines]
              == [l for blk in sb[0].blocks for l in blk.lines])
        from quality import readability as RD
        check("readability.read_lines: identical",
              RD.read_lines(pa) == RD.read_lines(pb))
    finally:
        shutil.rmtree(da)
        shutil.rmtree(db)


def test_backfilled_corpus():
    print("\n5. the backfilled corpus")
    regions = TX.load_regions()
    functions = TX.load_functions()
    files = TX.eng_files()
    # REPINNED 2026-08-20: 143 -> 388 — the owner-directed mass load staged
    # 245 new eng_celtic_msm_* files (812 songs) from the already-ADMITted
    # Modern Scottish Minstrel (PG22515), one file per author (the load's
    # first cut, 238 files, was restaged the same sitting by the rev-2
    # parser — RESULTS_CORPUS_AUDIT.md's 2026-08-20 repin has the account).
    # REPINNED 2026-08-20 (Tier-1 concurrent load): 388 -> 622 — 234 new
    # per-author files from five already-ADMITted song anthologies
    # (Southern War Songs, American War Ballads v2, Golden Treasury of
    # American Songs, Elizabethan song-books, Victorian Songs),
    # extracted by four parallel agents — each reconciled against its
    # edition's own contents/index — and landed by a single writer
    # behind the containment dedup.
    # REPINNED same sitting: 622 -> 616 -- six spelling-variant twin files
    # merged (the editions' own indexes identify each pair).
    # REPINNED 2026-08-20 (Phase-1): 616 -> 1049 — Oxford (PG66619)
    # and Poems of American History (PG47476) landed 452 new
    # per-author files. The Home Book of Verse is HELD.
    # (452 new files landed; 19 were then merged away as
    # spelling-variant twins of authors already staged.)
    # REPINNED 2026-08-20 (Montgomery twin): 1049 -> 1048 — the last
    # known cross-source twin is merged. NOTE THAT `songs` DOES NOT MOVE
    # (7,618 both sides): a twin merge changes which FILE holds an item,
    # never whether the item is held, and pinning the two together would
    # hide that distinction the first time a merge did drop something.
    check("all 1048 eng files are seen", len(files) == 1048)
    bad = []
    for p in files:
        bad.extend(TX.check_file(p, regions, functions))
    check("every assignment in the corpus names a declared value",
          not bad, bad[:3])
    headers = {os.path.basename(p): TX.read_file_taxonomy(p)[0]
               for p in files}
    # THE REGION AXIS IS NO LONGER TOTAL, BY RULING AND ON PURPOSE
    # (2026-08-20). It was total while every staged source carried a
    # region in its own framing. The Phase-1 anthologies do not: all six
    # extraction agents report independently that Oxford and Poems of
    # American History print NO nationality for any author, and
    # data/song_regions.tsv's rule is "author's tradition; edition origin
    # as tiebreak only" — so a region taken from the edition's origin
    # would be the TAYLOR-SISTERS DEFECT rebuilt at scale, which is the
    # exact error this taxonomy was created to fix. 427 files therefore
    # carry a BLANK region, each with its own `# region-basis:` line, and
    # blank is what the taxonomy has always called the honest undeclared
    # state. What is still TOTAL, and is the property worth pinning, is
    # that every file DECLARES ITSELF one way or the other: a region from
    # the closed set, or a blank with a stated basis. A file with neither
    # is the defect this check now names.
    declared = [b for b, h in headers.items() if h["region"]]
    basis = {os.path.basename(p) for p in files
             if "# region-basis:" in open(p, encoding="utf-8").read(4000)}
    # REPINNED 2026-08-20 (Montgomery twin): 622/427 -> 620/428. The
    # merged file's region went to BLANK (contested: born Irvine, lived
    # and died Sheffield, schooled in Antrim — and the table makes region
    # single-valued), so one 'english' and one 'scottish' declaration
    # left and one stated blank arrived.
    check("620 files declare a region and 428 declare a stated blank — "
          "every file answers the axis, none is silently empty",
          len(declared) == 620
          and all(b in basis for b in headers if b not in set(declared)),
          f"{len(declared)} declared, {len(headers) - len(declared)} blank, "
          f"{len(basis)} carrying a region-basis line")
    check("THE TAYLOR PIN: eng_american_ann_taylor resolves english — the "
          "filename is the acquisition batch, not an analytic claim",
          headers["eng_american_ann_taylor.txt"]["region"] == "english"
          and headers["eng_american_jane_taylor.txt"]["region"] == "english")
    check("the hymn seed: Watts carries function hymn (hymnal-attested), "
          "and Addison carries NONE — his staged source is a Poetical "
          "Works, and evidence-or-blank means blank",
          headers["eng_hymn_watts.txt"]["function"] == ("hymn",)
          and headers["eng_hymn_addison.txt"]["function"] == ())
    check("the hymn group crosses regions — Crosby american, Borthwick "
          "scottish, Alexander irish — which is the axis split working",
          headers["eng_hymn_crosby.txt"]["region"] == "american"
          and headers["eng_hymn_borthwick.txt"]["region"] == "scottish"
          and headers["eng_hymn_cf_alexander.txt"]["region"] == "irish")
    r = TX.report()
    # REPINNED 2026-08-19: 4,930 -> 4,979 -> 4,985 songs (Pass-1 batches 1-2).
    # REPINNED 2026-08-20: 4,985 -> 5,792 — the Modern Scottish Minstrel
    # mass load (+812 staged by the rev-2 restage, and 5 items MOVED from
    # eng_celtic_walter_scott to the new Rob Donn file after the edition's
    # own 'ROBERT MACKAY (ROB DONN).' section heading proved the original
    # staging had mis-bounded Scott's section).
    # REPINNED 2026-08-20 (Tier-1 concurrent load): 5,792 -> 6,352 —
    # +560 songs (514 in new files, 46 topped up into 18 existing
    # files) after the dedup dropped 114 cross-source reprints.
    # REPINNED 2026-08-20 (Phase-1): 6,352 -> 7,618 songs, and
    # undeclared_region 0 -> 896 by the ruling above. The two counts are
    # kept APART and never summed (doctrine 79): a song whose region is
    # undeclared is not a song in some region, and by_region + undeclared
    # == songs is the invariant that says so.
    # REPINNED 2026-08-20 (Montgomery twin): undeclared_region
    # 896 -> 947 (+51, the merged file's whole holding), songs UNCHANGED
    # at 7,618 — the merge moved items between files and dropped none.
    check("the report counts the corpus: 7,618 songs, 947 honestly "
          "undeclared regions, undeclared functions counted APART "
          "(evidence-or-blank leaves most songs untagged)",
          r["songs"] == 7618 and r["undeclared_region"] == 947
          and r["undeclared_function"] > 3000
          and r["undeclared_function"] + sum(r["multi_tag"].values())
          == r["songs"])
    check("region totals plus the undeclared partition the corpus — the "
          "axis is single-valued, and a blank is counted, never dropped",
          sum(r["by_region"].values()) + r["undeclared_region"] == 7618
          and sum(r["by_region"].values()) == 6671)


def test_manifest():
    print("\n6. the calibration manifest")
    p = subprocess.run([sys.executable, "quality/corpus_manifest.py",
                        "--check"], capture_output=True, text=True,
                       cwd=ROOT)
    check("at HEAD the live corpus IS the declared calibration set "
          "(exit 0)", p.returncode == 0, p.stdout[-200:])
    from quality import corpus_manifest as CM
    rec = CM.read_manifest()
    check("the manifest covers the audit's own population (269 files)",
          len(rec) == 269)
    live = {rel for rel, _md5, _n in CM.scan()}
    check("manifest files and live files are the same set",
          set(rec) == live)


if __name__ == "__main__":
    for fn in (test_tables, test_resolution, test_closed_set,
               test_prose_on_a_value_key_is_not_a_declaration,
               test_apparatus_invisibility, test_backfilled_corpus,
               test_manifest):
        fn()
    print("=" * 62)
    if FAILURES:
        print(f"{len(FAILURES)} FAILING: {', '.join(FAILURES)}")
        sys.exit(1)
    print("the taxonomy is a closed, declared, invisible coordinate — "
          "and the calibration set is a snapshot, not an implication")
