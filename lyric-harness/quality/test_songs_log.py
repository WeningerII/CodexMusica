#!/usr/bin/env python3
"""The process log, and the checks aimed at what it CANNOT say.

`quality/song_log.py` banks what a verb printed while a song was being
written. The danger it carries is the danger every record carries: a row that
looks like evidence and is a memory. So these sections are mostly about
REFUSAL — a command with no declared parser, a declared verb whose output the
parser could not read, a README sentence with no row behind it — because a
log that quietly banks an empty row reads exactly like a log of a clean run.
"""
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
from quality import song_log as L                 # noqa: E402
from quality import song_record as R              # noqa: E402

FAILURES = []


def check(msg, ok, detail=""):
    print(f"  {'PASS' if ok else 'FAIL'}  {msg}")
    if detail:
        print(f"          {detail}")
    if not ok:
        FAILURES.append(msg)


def run(argv):
    p = subprocess.run([sys.executable] + argv, cwd=ROOT,
                       capture_output=True, text=True)
    return p.returncode, p.stdout + p.stderr


def test_every_song_has_a_log_and_the_shape_holds():
    print("\n1. the logs — populated, and shaped so a row cannot be half a row")
    songs = sorted(os.path.basename(p) for p in R.songs())
    check("there are songs to log at all, so this file cannot pass by "
          "examining nothing", bool(songs), f"{len(songs)}: {songs}")
    missing = [s for s in songs if not L.read_log(s)]
    check("every delivered song carries a process log — a song whose making "
          "nothing recorded is the hole this instrument exists to close",
          not missing, f"unlogged: {missing or 'none'}")
    bad = []
    for s in songs:
        rows = L.read_log(s)
        if any(set(r) != set(L.HEADER) or "" in (r["fact"], r["value"])
               for r in rows):
            bad.append(s)
    check("...and every row carries every declared column with no empty cell "
          "— an empty cell reads as a measurement that came back zero",
          not bad, f"malformed: {bad or 'none'}")
    gaps = []
    for s in songs:
        steps = sorted({int(r["step"]) for r in L.read_log(s)})
        if steps != list(range(1, len(steps) + 1)):
            gaps.append((s, steps))
    check("...and the step ordinals run 1..n with no gap, so the SEQUENCE of "
          "questions a session asked is what the log preserves",
          not gaps, f"gapped: {gaps or 'none'}")


def test_an_unparseable_command_is_refused_not_banked():
    """2. THE CENTRAL REFUSAL, AND IT IS TWO REFUSALS.

    A command this file has no parser for, and a command it HAS a parser for
    whose output the parser reads nothing from. Both must refuse at exit 2
    and bank no row — doctrine 20: an invocation whose output nothing read
    looks exactly like an invocation that went well.
    """
    print("\n2. two refusals — no parser, and a parser that read nothing")
    check("an undeclared verb has no parser key", L.verb_of(
        ["python3", "lyric_harness.py", "density", "x.txt"]) is None)
    rc, out = run(["quality/song_log.py", "--record", "__probe__.txt", "--allow-dirty", "--",
                   "python3", "lyric_harness.py", "density", "songs/one_more.txt"])
    check("...and `--record` REFUSES it at exit 2 rather than banking an "
          "invocation nothing read", rc == 2 and "REFUSED" in out,
          out.strip().splitlines()[0] if out.strip() else f"rc={rc}")
    check("...naming the declared vocabulary, so the refusal is actionable",
          "screen" in out and "revise" in out)
    rc2, out2 = run(["quality/song_log.py", "--record", "__probe__.txt", "--allow-dirty", "--",
                     "python3", "lyric_harness.py", "screen"])
    check("a DECLARED verb whose output the parser reads nothing from is "
          "refused too — the verb's output moved, and a silent empty row "
          "would hide that", rc2 == 2 and "read NOTHING" in out2,
          f"rc={rc2}")
    check("...and neither refusal left a log behind",
          not os.path.exists(L.log_path("__probe__.txt")))


def test_the_row_is_what_the_verb_printed():
    """3. THE LOG IS A RECORD, NOT A SECOND GRADER.

    The banked verdict for a pair must equal the verdict `screen` itself
    printed. If this file ever re-derived a verdict it would be a second
    grader, and two graders is doctrine 1's own failure.
    """
    print("\n3. what is banked equals what the verb said")
    rc, out = run(["lyric_harness.py", "screen", "hair", "chair"])
    printed = re.search(r"hair ~ chair\s+\S+\s+[\d.]+\s+(.+)", out)
    check("`screen` printed a verdict for the control pair", bool(printed),
          printed.group(1).strip() if printed else out[:120])
    facts = dict(L._p_screen(out))
    check("...and the parser reads that verdict VERBATIM off the stdout",
          facts.get("pair:hair~chair") == printed.group(1).strip(),
          f"{facts.get('pair:hair~chair')!r}")
    check("...and it is the BANNED answer, so this section cannot pass on a "
          "pair the ban never looks at",
          "HOMEOTELEUTON" in facts.get("pair:hair~chair", ""))
    check("...and the summary counts come off the verb's own tail line, "
          "never re-counted here (doctrine 1) — M-113 split the clean "
          "bucket, so the two halves are two facts",
          facts.get("banned") == "1" and facts.get("clean_rhyming") == "0"
          and facts.get("clean_non_rhyme") == "0",
          f"banned={facts.get('banned')} rhyming={facts.get('clean_rhyming')} "
          f"non={facts.get('clean_non_rhyme')}")


def test_the_claim_gate_is_two_sided():
    """4. A GATE THAT ONLY EVER PASSES IS A GATE NOBODY WROTE.

    `--verdicts` charges the README's process prose against the rows. It must
    PASS on the committed README and FAIL when a claim is moved off the log.
    """
    print("\n4. the claim gate — passes clean, fails on a moved claim")
    rc, out = run(["quality/song_log.py", "--verdicts"])
    check("`--verdicts` PASSES on the committed README", rc == 0,
          out.strip().splitlines()[-1] if out.strip() else f"rc={rc}")
    m = re.search(r"(\d+) claim\(s\) RESOLVED \((\d+) of them by an "
                  r"explicit \[LOG:\] citation\), (\d+) MISMATCHED, "
                  r"(\d+) REFUSED", out)
    check("...and it resolved claims rather than finding none to charge — a "
          "gate examining nothing prints the same PASS as a clean one",
          bool(m) and int(m.group(1)) > 0,
          m.group(0) if m else "no count line")
    check("...and the [LOG:] citations are counted APART from the prose "
          "claims, because a cited number and a matched sentence are two "
          "different strengths of evidence (doctrine 79)",
          bool(m) and int(m.group(2)) > 0,
          f"{m.group(2)} cited" if m else "no count line")
    e = re.search(r"(\d+) \[LOG:\] occurrence\(s\) read as NOTATION", out)
    check("...and prose TEACHING the citation form is counted as notation "
          "rather than silently skipped — an un-charged citation nobody can "
          "see is how a claim smuggles itself past wearing a code span",
          bool(e), e.group(0) if e else "no notation line")
    with open(L.README, encoding="utf-8") as f:
        original = f.read()
    mutant = original.replace("`song` exit 0", "`song` exit 3", 1)
    check("the mutation actually changes the README", mutant != original)
    try:
        with open(L.README, "w", encoding="utf-8") as f:
            f.write(mutant)
        rc2, out2 = run(["quality/song_log.py", "--verdicts"])
    finally:
        with open(L.README, "w", encoding="utf-8") as f:
            f.write(original)
    check("...and a claim the log contradicts FAILS at exit 3",
          rc2 == 3 and "MISMATCH" in out2,
          out2.strip().splitlines()[-1] if out2.strip() else f"rc={rc2}")
    rc3, out3 = run(["quality/song_log.py", "--verdicts"])
    check("...and the README is restored, so this section leaves no residue",
          rc3 == 0)


def test_it_records_and_does_not_grade():
    """5. BY ABSENCE — the one property a record must never lose.

    `song_log.py` must reach every verdict by RUNNING a verb and reading its
    stdout. The moment it imports a grader it becomes a second opinion about
    the draft, and a record that grades is not a record.
    """
    print("\n5. the instrument grades nothing — checked by absence")
    src = open(os.path.join(ROOT, "quality", "song_log.py"),
               encoding="utf-8").read()
    for banned in ("discriminate", "from quality import floor",
                   "import floor", "Reviser", "QualityFeatures"):
        check(f"`song_log.py` does not reach for {banned!r}",
              banned not in src)
    check("...and every verdict it holds comes through subprocess, which is "
          "the only route that cannot become a second grader",
          "subprocess.run" in src)
    check("...and the commit column is BORROWED from song_record rather than "
          "respelled, so two registers cannot disagree about which tree a "
          "row was taken on (doctrine 1)",
          "from quality.song_record import harness_commit" in src)


def test_the_citation_is_word_keyed_and_refuses_ambiguity():
    """6. A CITATION INTO AN APPEND-ONLY LOG MUST NOT BE AN OFFSET.

    `[LOG: fact song word]` names a screen run by a word it screened. Keyed on
    the step ORDINAL it would be an offset from a moving origin — the defect
    this repository already found in its own `data/sources.tsv` line-number
    citations, where an unrelated insertion made a true sentence false without
    one character of it changing. So: a word screened once RESOLVES, a word
    screened by nobody REFUSES, and a word screened TWICE refuses as
    ambiguous rather than picking whichever run came first.
    """
    print("\n6. the [LOG:] citation — word-keyed, and ambiguity is a refusal")
    got, why = L.resolve_cite("carry_it_over.txt", "clean_or_non_rhyme",
                              "bell")
    check("a word screened exactly once RESOLVES to its run's count",
          got is not None and why is None, f"{got!r}")
    got2, why2 = L.resolve_cite("carry_it_over.txt", "clean_or_non_rhyme",
                                "zzznotaword")
    check("...a word no run screened REFUSES, naming the word",
          got2 is None and why2 and "zzznotaword" in why2, why2 or "")
    probe = "__cite_probe__.txt"
    path = L.log_path(probe)
    try:
        with open(path, "w", encoding="utf-8") as f:
            f.write("\t".join(L.HEADER) + "\n")
            for step in (1, 2):
                for fact, val in (("pair:bell~knell", "CLEAN"),
                                  ("clean_or_non_rhyme", str(step))):
                    f.write("\t".join([probe, str(step), "2026-01-01", "x",
                                       "screen", "0", fact, val]) + "\n")
        got3, why3 = L.resolve_cite(probe, "clean_or_non_rhyme", "bell")
        check("...and a word screened by TWO runs REFUSES as ambiguous "
              "rather than resolving to the first",
              got3 is None and why3 and "2 runs" in why3, why3 or f"{got3!r}")
    finally:
        if os.path.exists(path):
            os.remove(path)
    check("...and the probe log is removed, so this section leaves no residue",
          not os.path.exists(path))
    with open(L.README, encoding="utf-8") as f:
        original = f.read()
    m = re.search(r"(\d+) (\[LOG: banned carry_it_over\.txt cold\])",
                  original)
    check("the README carries a cited count to move", bool(m),
          m.group(0) if m else "no citation found")
    if m:
        mutant = original.replace(m.group(0),
                                  str(int(m.group(1)) + 1) + " " + m.group(2),
                                  1)
        try:
            with open(L.README, "w", encoding="utf-8") as f:
                f.write(mutant)
            rc, out = run(["quality/song_log.py", "--verdicts"])
        finally:
            with open(L.README, "w", encoding="utf-8") as f:
                f.write(original)
        check("...and moving it off the log FAILS at exit 3 — the citation "
              "gates the NUMBER, not merely the existence of a row",
              rc == 3 and "MISMATCH" in out,
              out.strip().splitlines()[-1] if out.strip() else f"rc={rc}")


def test_the_finish_stamp_has_a_parser():
    print("\n7. `finish` — the working order's LAST verb — has a declared "
          "parser, and it reads the stop stamp in both spellings "
          "(`MISSING.md` M-196)")
    from quality import song_log as SL
    check("`finish` is a declared parser, beside `revise`",
          "finish" in SL.PARSERS and "revise" in SL.PARSERS,
          f"{sorted(SL.PARSERS)}")
    seeded = ("revise_loop: no_progress after 2 round(s)\n"
              "PAIRS: mandated 6, judged 6, refused 0\n\n"
              "  [FINISHED — seed 22 — exit 3 — NO_PROGRESS after 2 round(s) "
              "— UNRESOLVED: L2, L4 — WHOLE-DRAFT FLAG: TITLE_NOT_IN_HOOK]\n")
    facts = dict(SL.PARSERS["finish"](seeded))
    check("a seeded stamp yields the seed, the exit, the stop, the round "
          "count, the open-line count and the whole-draft count — the same "
          "six the connector's extractor reads",
          facts.get("stamp_seed") == "22" and facts.get("stamp_exit") == "3"
          and facts.get("stop_reason") == "NO_PROGRESS"
          and facts.get("rounds") == "2" and facts.get("unresolved") == "2"
          and facts.get("whole_flags") == "1" and facts.get("mandated") == "6",
          f"{facts}")
    unseeded = ("  [FINISHED — declared mandate — exit 0 — SUCCESS after "
                "1 round(s) — no flag stands]\n")
    f2 = dict(SL.PARSERS["revise"](unseeded))
    check("a pasted song's stamp (M-195) reads with `declared mandate` in "
          "the seed's place, through the `revise` parser that verb prints "
          "it from",
          f2.get("stamp_seed") == "declared mandate"
          and f2.get("stamp_exit") == "0" and f2.get("unresolved") == "0"
          and f2.get("whole_flags") == "0", f"{f2}")
    check("no stamp, no stamp facts — absent is not zero (doctrine 79)",
          not any(k.startswith("stamp_") for k, _ in
                  SL.PARSERS["revise"]("revise_loop: success after 1 round(s)\n")))
    check("the README claim gate can resolve a `finish` sentence",
          any(verb == "finish" for _rx, verb, _keys in SL.CLAIMS))


DRAFT_PROBE = "__draft_probe__.txt"
PROBE_LINES = ["The kettle keeps a rumour of the rain",
               "I hold the door a beat behind the sound",
               "You said the word and left it on the drain",
               "The kitchen took the weather and stayed round"]


def _clean_probe():
    import glob as _g
    for p in [L.log_path(DRAFT_PROBE)] + _g.glob(
            L.draft_path(DRAFT_PROBE, "*")):
        if os.path.exists(p):
            os.remove(p)


def test_the_bytes_behind_the_md5_are_banked():
    """8. THE VERB THAT GRADES A DRAFT BANKS WHAT IT GRADED.

    `MISSING.md` M-196's 2026-09-02 addendum, and M-168's "THE BAN AGAINST
    THE BANK" that found it: the log banked an md5 of what was graded and not
    the bytes, so crooked_waltz step 19 `29697fccfe8d` is PROVABLE and
    unreadable, and two songs' graded mandates were recoverable from nowhere.

    The danger in the repair is the danger in every rule written after the
    history it judges. Sixteen songs are already banked with no drafts behind
    them; a rule that goes red on them is unshippable, and a rule that passes
    everything silently is worse than none. So the gate reports FOUR counts
    and is red on ONE: what was banked, what is RECOVERABLE from the
    committed lyric, what is LOST before the mechanism existed (kept visible,
    doctrine 17), and what was recorded after it and is missing anyway.
    """
    print("\n8. the drafts behind the md5s — banked, recoverable, lost and "
          "failing, and only the last is red (`MISSING.md` M-196)")
    src = open(os.path.join(ROOT, "quality", "song_log.py"),
               encoding="utf-8").read()
    check("the discriminator is a DECLARED date, not a list of "
          "grandfathered rows — a list would need editing every time a row "
          "joined it, and an exception list nobody maintains is no gate",
          re.search(r'DRAFT_BANKING_SINCE = "\d{4}-\d{2}-\d{2}"', src) is not
          None, L.DRAFT_BANKING_SINCE)
    all_md5 = [(s, r) for s in sorted(os.path.basename(p) for p in R.songs())
               for r in L.read_log(s)
               if r["fact"] in ("md5", "md5_in", "md5_out")]
    check("...and it actually separates the bank in two — every md5 row the "
          "sixteen songs carry was measured BEFORE it, so no banked row sits "
          "on the boundary where the rule cannot decide",
          all_md5 and all(r["measured"] < L.DRAFT_BANKING_SINCE
                          for _s, r in all_md5),
          f"{len(all_md5)} md5 row(s), latest "
          f"{max(r['measured'] for _s, r in all_md5)}")
    rc, out = run(["quality/song_log.py", "--drafts"])
    m = re.search(r"(\d+) BANKED, (\d+) RECOVERABLE.*?, (\d+) LOST.*?, "
                  r"(\d+) FAILING", out)
    check("`--drafts` PASSES on the committed tree — history is not made red "
          "by a check written after it", rc == 0 and bool(m),
          out.strip().splitlines()[-1] if out.strip() else f"rc={rc}")
    check("...and it examined the whole census rather than nothing: the four "
          "buckets PARTITION the md5 rows, so a row cannot fall out unseen "
          "(the counts are never summed as a RATE — this is bookkeeping "
          "that every row landed somewhere)",
          bool(m) and sum(int(m.group(i)) for i in (1, 2, 3, 4)) == len(all_md5),
          f"{m.group(0) if m else 'no count line'} vs {len(all_md5)} md5 rows")
    # THE FINDING, AS A NUMBER. M-168 named these three md5s in prose; the
    # gate names them as a bucket, which is the difference between a sentence
    # and a measurement.
    lost = set(re.findall(r"^  LOST\s+(\S+) (\w+)", out, re.M))
    check("...and the LOST bucket is exactly the drafts M-168 named LESS "
          "the one §9 recovered — crooked_waltz 19, matinee 54/55; "
          "the_long_way_back 2 is BANKED since 2026-09-06 — no more and no "
          "fewer",
          lost == {("crooked_waltz.txt", "29697fccfe8d"),
                   ("matinee.txt", "707c48614794"),
                   ("matinee.txt", "04065bbbcdd9")},
          f"{sorted(lost)}")
    check("...and the recovered draft reads BANKED, from the committed file "
          "and not from anything this suite wrote",
          re.search(r"^  BANKED\s+the_long_way_back\.txt 687eaa34c949", out,
                    re.M) is not None
          and os.path.exists(L.draft_path("the_long_way_back.txt",
                                          "687eaa34c949")))
    check("the fingerprint is BORROWED from the grader's own definition and "
          "never respelled here, so a draft file's name cannot come to mean "
          "something the report does not (doctrine 1)",
          "from quality.revise import draft_fingerprint" in src
          and "hashlib" not in src)

    # ---- end to end: a real grading verb, recorded, on a scratch draft
    import tempfile
    _clean_probe()
    tmpd = tempfile.mkdtemp()
    lyric = os.path.join(tmpd, "probe.txt")
    with open(lyric, "w", encoding="utf-8") as f:
        f.write("[Verse]\n" + "\n".join(PROBE_LINES) + "\n")
    try:
        rc, out = run(["quality/song_log.py", "--record", DRAFT_PROBE,
                       "--allow-dirty", "--", "python3", "lyric_harness.py",
                       "brief", lyric, "--groups=1,3;2,4", "--returns=2,4",
                       "--relations=A:class:RHYME"])
        facts = {r["fact"]: r["value"] for r in L.read_log(DRAFT_PROBE)}
        check("a real grading verb recorded through `--record` banks its "
              "input's bytes", rc == 0 and "draft_file" in facts,
              facts.get("draft_file", out.strip()[-200:]))
        printed = facts.get("md5")
        want = L.draft_path(DRAFT_PROBE, printed or "none")
        check("...at the name the verb's OWN printed fingerprint gives, so "
              "the file and the log fact agree BY CONSTRUCTION",
              printed and os.path.exists(want)
              and facts["draft_file"] == os.path.relpath(want, ROOT),
              f"md5 {printed} -> {facts.get('draft_file')}")
        from quality.revise import draft_fingerprint
        import lyric_harness as LH
        back = LH.load_lyric_lines(want) if os.path.exists(want) else []
        check("...and a later reader who loads that file gets the same "
              "population back, so the same bytes can be graded again — "
              "which is the entire point of banking them",
              back == PROBE_LINES and draft_fingerprint(back) == printed,
              f"{len(back)} line(s), {draft_fingerprint(back) if back else '-'}")
        check("...with the section marker DROPPED, because what is banked is "
              "what was GRADED and the grader never saw it",
              "[Verse]" not in open(want, encoding="utf-8").read()
              if os.path.exists(want) else False)
        check("the MANDATE it ran under is banked too, VERBATIM off the argv "
              "— the fact whose absence made `oar_lair.txt`'s graded mandate "
              "unrecoverable",
              facts.get("mandate_groups_text") == "1,3;2,4"
              and facts.get("mandate_returns_text") == "2,4"
              and facts.get("mandate_relations_text") == "A:class:RHYME",
              f"{facts.get('mandate_groups_text')!r} / "
              f"{facts.get('mandate_returns_text')!r} / "
              f"{facts.get('mandate_relations_text')!r}")
        check("...beside the whole command, so a coordinate this file has "
              "not learned the name of is still on record",
              "lyric_harness.py brief" in facts.get("command", ""),
              facts.get("command", "")[:80])
        check("...and `mandate_groups_text` is NOT `mandate_groups`, which "
              "the same row banks as an integer COUNT — one register, two "
              "quantities, two names (doctrine 1)",
              facts.get("mandate_groups") == "2"
              and facts.get("mandate_groups_text") == "1,3;2,4")
        rc, out = run(["quality/song_log.py", "--drafts"])
        check("...and the gate reads the new row as BANKED",
              rc == 0 and re.search(r"^  BANKED\s+" + re.escape(DRAFT_PROBE),
                                    out, re.M) is not None,
              out.strip().splitlines()[-1] if out.strip() else f"rc={rc}")
        # ---- THE MUTATION: the bytes go away, the gate goes red
        held = open(want, encoding="utf-8").read()
        os.remove(want)
        rc2, out2 = run(["quality/song_log.py", "--drafts"])
        check("DELETING the banked draft turns the gate RED at exit 3 and "
              "names the row — a check that cannot fail is not a check",
              rc2 == 3 and "FAILING" in out2 and DRAFT_PROBE in out2,
              out2.strip().splitlines()[-1] if out2.strip() else f"rc={rc2}")
        check("...and it fails as FAILING rather than as LOST, because the "
              "row was recorded on or after the mechanism's own date — "
              "which is the whole discriminator working",
              re.search(r"^  FAILING\s+" + re.escape(DRAFT_PROBE), out2, re.M)
              is not None
              and "3 LOST" in out2,
              [l for l in out2.splitlines() if DRAFT_PROBE in l][:1])
        with open(want, "w", encoding="utf-8") as f:
            f.write(held)
        rc3, _ = run(["quality/song_log.py", "--drafts"])
        check("...and restoring the bytes restores the PASS", rc3 == 0)
        # ---- the refusals, which write nothing rather than guess
        got, why = L.lyric_arg(["python3", "lyric_harness.py", "verify",
                                "songs/one_more.txt", "songs/stay_awake.txt"])
        check("two positional drafts REFUSE rather than pick one — a wrong "
              "file banked under a right-looking name is the one outcome "
              "this mechanism exists to prevent",
              got is None and why and "not guessed" in why, why or f"{got!r}")
        rel, why2 = L.bank_draft(DRAFT_PROBE, "song",
                                 ["python3", "lyric_harness.py", "song",
                                  "bp.json", lyric], [("lines", "4")])
        check("a verb that printed NO fingerprint gets NO file, and the "
              "reason is said rather than an md5 invented for it",
              rel is None and why2 and "no draft fingerprint" in why2,
              why2 or f"{rel!r}")
    finally:
        _clean_probe()
        import shutil
        shutil.rmtree(tmpd, ignore_errors=True)
    check("...and the probe leaves no residue — no log, no draft file",
          not os.path.exists(L.log_path(DRAFT_PROBE)))
    rc4, _ = run(["quality/song_log.py", "--drafts"])
    check("...and the committed tree is back to PASS", rc4 == 0)


def test_the_recovery_verb_banks_only_what_the_log_names():
    """9. `--bank-draft SONG MD5 FILE` — THE DECLARED ROUTE FOR A LOST DRAFT.

    `MISSING.md` M-196 recorded that one of the four LOST drafts,
    the_long_way_back `687eaa34c949`, is readable from git history
    (`8d7b3f18`) and refused to write it into `songs/drafts/` by hand,
    because a file written today from a re-hash looks banked-by-construction
    and was not. The route it named is a verb that REFUSES unless the song's
    log already holds the md5 and the file fingerprints to it. Three refusals
    and one acceptance, each on a probe log this section writes and removes.
    """
    print("\n9. `--bank-draft` banks bytes a log already names, and refuses "
          "everything else (`MISSING.md` M-196)")
    import tempfile
    import shutil
    from quality.revise import draft_fingerprint
    import lyric_harness as LH
    tmpd = tempfile.mkdtemp()
    probe = "zz_bank_probe.txt"
    lines = ["the lamp is out and the road is long",
             "we count the mile by the turning song"]
    fp = draft_fingerprint(lines)
    draft = os.path.join(tmpd, "draft.txt")
    with open(draft, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    other = os.path.join(tmpd, "other.txt")
    with open(other, "w", encoding="utf-8") as f:
        f.write("a different line entirely\nand its partner\n")
    try:
        # a log that holds NO md5: the verb refuses whatever the file is
        rel, why = L.bank_draft_file(probe, fp, draft)
        check("a log with no md5 row for it REFUSES, naming the song and "
              "the md5 — a fingerprint the log never printed is not a draft "
              "of this song", rel is None and why and "no row" in why,
              why or f"{rel!r}")
        # write a probe log that names fp on an md5 row
        with open(L.log_path(probe), "w", encoding="utf-8") as f:
            f.write("\t".join(L.HEADER) + "\n")
            row = {k: "" for k in L.HEADER}
            row.update({"step": "1", "verb": "song", "fact": "md5",
                        "value": fp, "measured": "2026-08-30"})
            f.write("\t".join(row[k] for k in L.HEADER) + "\n")
        rel, why = L.bank_draft_file(probe, fp, other)
        check("a file whose bytes do NOT carry the md5 REFUSES and says what "
              "they do carry — nothing is banked under a name its contents "
              "lack", rel is None and why and "fingerprints" in why
              and draft_fingerprint(LH.load_lyric_lines(other)) in why,
              why or f"{rel!r}")
        rel, why = L.bank_draft_file(probe, fp, draft)
        want = L.draft_path(probe, fp)
        check("the matching file is BANKED at the one draft path, byte for "
              "byte", rel is not None and os.path.exists(want)
              and open(want, encoding="utf-8").read() == "\n".join(lines) + "\n",
              why or rel)
        rel2, why2 = L.bank_draft_file(probe, fp, draft)
        check("...and banking it again is a no-op that answers the same path "
              "(idempotent, nothing overwritten)", rel2 == rel and why2 is None,
              why2 or rel2)
        with open(want, "w", encoding="utf-8") as f:
            f.write("tampered\n")
        rel3, why3 = L.bank_draft_file(probe, fp, draft)
        check("...and a destination holding DIFFERENT bytes under that name "
              "REFUSES rather than overwriting", rel3 is None and why3
              and "DIFFERENT" in why3, why3 or f"{rel3!r}")
        rc, out = run(["quality/song_log.py", "--bank-draft", probe, fp, draft])
        check("the CLI spelling refuses at exit 2 with REFUSED in front, the "
              "same shape as every other refusal here",
              rc == 2 and out.lstrip().startswith("REFUSED"), out.strip()[:90])
        os.remove(want)
        rc, out = run(["quality/song_log.py", "--bank-draft", probe, fp, draft])
        check("...and banks at exit 0 when the three conditions hold",
              rc == 0 and "BANKED" in out and os.path.exists(want),
              out.strip()[:90])
    finally:
        for pth in (L.log_path(probe), L.draft_path(probe, fp)):
            if os.path.exists(pth):
                os.remove(pth)
        shutil.rmtree(tmpd, ignore_errors=True)
    check("...and the probe leaves no residue",
          not os.path.exists(L.log_path(probe))
          and not os.path.exists(L.draft_path(probe, fp)))
    # THE RECOVERY ITSELF, AS A FACT ABOUT THE COMMITTED TREE: the bytes at
    # `8d7b3f18:lyric-harness/songs/the_long_way_back.txt` were banked through
    # this verb on 2026-09-06 and the file is committed. Re-derive, do not
    # assume: the file must fingerprint to the md5 in its own name.
    got = L.draft_path("the_long_way_back.txt", "687eaa34c949")
    check("the_long_way_back's once-LOST draft is a committed file whose "
          "bytes fingerprint to the md5 in its name",
          os.path.exists(got)
          and draft_fingerprint(LH.load_lyric_lines(got)) == "687eaa34c949")


if __name__ == "__main__":
    for t in (test_every_song_has_a_log_and_the_shape_holds,
              test_an_unparseable_command_is_refused_not_banked,
              test_the_row_is_what_the_verb_printed,
              test_the_claim_gate_is_two_sided,
              test_it_records_and_does_not_grade,
              test_the_citation_is_word_keyed_and_refuses_ambiguity,
              test_the_finish_stamp_has_a_parser,
              test_the_bytes_behind_the_md5_are_banked,
              test_the_recovery_verb_banks_only_what_the_log_names):
        t()
    print("\n" + "=" * 62)
    if FAILURES:
        print(f"{len(FAILURES)} FAILING:")
        for f in FAILURES:
            print(f"  - {f}")
        sys.exit(1)
    print("all pass")
