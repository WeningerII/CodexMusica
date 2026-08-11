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
# `battery.py` has no assert and returns 0 regardless; this file exists partly
# so this module never becomes that. A check with zero findings is only good
# news if it actually ran on something.
# ---------------------------------------------------------------------------

_FILES = None
_SRC = None


def corpus():
    global _FILES, _SRC
    if _FILES is None:
        _SRC = AC.Sources()
        _FILES = AC.load()
    return _FILES, _SRC


def test_every_file_reaches_a_row():
    """Doctrine 34, the live assertion. A file with no row IS the defect."""
    files, src = corpus()
    none = [rel for rel, cf in files
            if src.route(cf, rel)[0] == AC.ROUTE_NONE]
    check("every corpus file reaches a data/sources.tsv row",
          not none, none[:6])
    check("the corpus is not empty (the check ran on something)",
          len(files) > 200, len(files))


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
    """Doctrine 51, live. This corpus has TWO item-level duplications and the
    auditor found both; if it stops finding them, either they were fixed
    (check the corpus) or check E went blind (check the code)."""
    files, src = corpus()
    fs = [f for f in AC.check_distinct(files, src) if f.severity == AC.FAIL]
    names = " ".join(f.what for f in fs)
    check("E finds Coleridge/Wordsworth sharing 9 item bodies",
          "wordsworth" in names and any("9 item bodies" in f.what for f in fs),
          names[:160])
    check("E finds Tate/Brady sharing 1 item body",
          "tate" in names and any("1 item bodies" in f.what for f in fs),
          names[:160])
    check("E finds no OTHER cross-file duplication",
          len(fs) == 2, [f.path for f in fs])


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
