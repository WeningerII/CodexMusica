#!/usr/bin/env python3
"""Every verb the CLI dispatches, RUN — and the wiring map checked against it.

WHY THIS FILE EXISTS

On 2026-08-10 this project found that 11,540 lines of tested production code
could not be run by any user-facing path, and closed it with the `wiring` verb
and a set of CLI verbs. On 2026-08-11 the same gap had reopened underneath
eight cells of new work: `quality/fit.py` answered the only question anyone
has ever asked about this song that the harness could not — do the words fit
the bars — and had no verb; `grid.Section.function` and everything on top of
it (the hook, `bridge_contrast`, `compare_returns`, `RETURN_SLOT_DRIFT`,
`TITLE_NOT_IN_HOOK`) had no verb; `schemes.parse_refrain` made the villanelle
writable and no verb could write it. `wiring` reported eleven rows and none of
them was wrong, which is the worst state for a map to be in: it answered.

Doctrine 48 says a principle that lives only in prose gets followed exactly as
often as someone remembers it. This round it had to be remembered eight times
and was remembered zero. So the map is DATA now (`lyric_harness.VERB_LAYERS`),
the usage text is data (`lyric_harness.USAGE`), the dispatch is read out of the
AST (`_dispatched_verbs`), and the three are cross-checked here and by `wiring`
itself. A verb added without a row and a `--help` line is a FAILING TEST rather
than a thing somebody notices in two days.

WHAT IS ASSERTED, AND IN WHAT ORDER

  1. the three sets agree: dispatched == mapped, and every dispatched verb has
     a `--help` line
  2. `fit` — the chorus overflows at Subdivision(2) and the 7/8 verses do not,
     which is the first thing this harness has ever said about whether a song
     is singable
  3. `fit` with no subdivision REFUSES the slot questions rather than assuming
     a sixteenth-note grid
  4. `function` — an undeclared function refuses, three counts and not one; a
     declared one answers; a function outside the vocabulary RAISES rather
     than falling back to verse
  5. `refrain` — the A-1 notation, the twelve REPEAT pairs a villanelle
     requires, and a drifted refrain caught by a NAMED kind
  6. `brief` with no mandate REFUSES with exit 2 instead of a traceback, and
     the three mandate spellings a letter string cannot express work --
     including `--returns=`, which a verbatim chorus needed and had no way
     to reach before 2026-08-12
  7. every dispatched verb runs without a traceback — including `song`, which
     raised `KeyError` on this repo's own `blueprint.json` for as long as that
     file has been in the bar-grid shape, while `wiring` called it wired
     because import reachability is not invocation reachability. `song` was
     REBUILT 2026-08-12 off the dead schema `KeyError` came from, onto the
     same bar-grid/Reviser pipeline `brief` runs, and is tested here against
     a real blueprint instead of the root fixture pair that caused it
 10. `candidates` REFUSES an unreadable query instead of raising
     `KeyError: 'anchor_syllables'`. §7 above ran this verb the whole time
     and could not have found it: §7's case is `candidates desire 5`, and
     `desire` is in CMUdict. The word the verb actually died on is
     `hypotenuse` — the canary this repo's own known gap 1 names
 11. `relations` actually RUNS the doctrine 56 search-burden disclosure its
     own output paragraph promises. It called `search_burden(st)` — ONE
     argument to a two-argument function — inside `except Exception`, so the
     TypeError rendered as the clause simply not being printed, on every
     input, since the line was written. §7 ran `relations` too, and a
     swallowed TypeError is not a traceback
 12. the MECHANISM behind 11: broad `except Exception` handlers in the spine
     are counted, so adding one is a visible decision rather than a thing a
     later session discovers three fixes downstream
 13. a blueprint whose line count does not match the draft REFUSES on ALL
     FOUR verbs that can be handed one. `song` had a private copy of the
     handler and refused; `brief --blueprint=`, `verify` and `revise` reach
     the identical `Reviser._meter_findings` and printed a raw traceback at
     exit 1 — one user mistake, two answers, decided by which verb was
     typed. §7 could not find it: every blueprint case there hands a verb a
     blueprint that already matches its draft. The refusal now names WHICH
     FILE declared what (doctrine 79), which is the half only the command
     line knows — `quality/revise.py` carries both counts and neither path
 15. the REPORT is rendered, not summarised. A real 16-line run printed 91
     findings over 208 lines of which 48 were three codes each firing on all
     sixteen — one fact (the declared grid is too tight) stated three ways,
     sixteen times, with the run's three actual craft flags buried at output
     lines 45, 61 and 177. What is pinned is that the rollup LOSES NOTHING:
     the per-code counts are re-derived from the RENDERED output and must
     match, `rollup_findings`/`line_range` are exercised directly on both
     sides of their declared threshold, and the flag inventory leads
 16. `song` EXITS 3 with a flag standing. It exited 0 with nineteen, so no
     pipeline could gate on the whole-song verb. 2 was unavailable (every
     verb here already uses it for exactly one thing — the harness did not
     answer) and 1 was unavailable (an uncaught exception is Python's own
     1). NOTES never move it, which is the case that PROVES doctrine 6
     rather than asserting it
 17. `revise --propose=stub|replay:PATH|call:MODULE:FACTORY` — WHO WRITES
     THE LINE. `revise_loop` has taken `propose=` since it was written and
     nothing on the command line could hand it one, so the only reachable
     proposer was a single-word splice. `stub` stays the DEFAULT because
     THIS FILE runs `revise` in CI and a default that reaches out of the
     process is not a default. `replay:PATH` drives the same loop over
     recorded text. `call:MODULE:FACTORY` is a CALLER-DECLARED seam with no
     default and no fallback module: this repo's first page says the model
     proposes and these tools grade, so the proposing half is not this
     repo's to ship and this file may not pick one by omission. What is
     pinned is the CONTRACT and every way of failing it — each a printed
     refusal at exit 2 — exercised against an "adapter" this suite writes
     into a temp dir, so the whole section runs inside the process

 18. two sections MAY SHARE A NAME, and verse/chorus/bridge/chorus is the
     commonest song form there is. `song`'s STRUCTURE cross-check counted
     `l.section == s.name`, so each chorus was charged with BOTH choruses'
     lines and `chorus: 4 lyric line(s), blueprint places 8` printed TWICE;
     `quality/fit.py`'s `overlap_findings` bucketed on the same name while
     `Placement.start` is section-RELATIVE, so all EIGHT chorus lines were
     reported as intersecting their own return. Ten findings, one cause, on a
     song with no defect in it. §7 cannot find this either: nothing raises,
     nothing exits non-zero — the verb answers, fluently, about a defect that
     is not there

Run: python3 quality/test_verbs.py
"""

import ast
import glob
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
sys.path.insert(0, ROOT)

import lyric_harness as lh  # noqa: E402

EXAMPLE_BP = os.path.join(HERE, "fixtures", "song.blueprint.json")
EXAMPLE_TXT = os.path.join(HERE, "fixtures", "song.txt")
FAILURES = []


def check(name, cond, detail=""):
    print(f"  {'PASS' if cond else 'FAIL'}  {name}")
    if detail:
        print(f"          {detail}")
    if not cond:
        FAILURES.append(name)


def run(*args, expect_rc=None, env=None):
    """The verb, as a user runs it. -> (rc, stdout, stderr).

    A subprocess and not an import, deliberately: what is under test is
    REACHABILITY FROM THE COMMAND LINE, and calling the module's function
    directly would pass in exactly the state this file exists to detect.

    `env` overlays the caller's environment (it does not replace it — a bare
    environment would lose PATH and the interpreter would not start). §17
    uses it for exactly one thing: a `PYTHONPATH` pointing at a temp dir, so
    the module `--propose=call:MODULE:FACTORY` names is one this suite WROTE
    and whose factory returns a pure function. Nothing in this file reaches
    outside the process, and nothing in it may ever set a credential.
    """
    e = None
    if env:
        e = dict(os.environ)
        e.update(env)
    p = subprocess.run([sys.executable, "lyric_harness.py", *args],
                       cwd=ROOT, capture_output=True, text=True, timeout=900,
                       env=e)
    if expect_rc is not None and p.returncode != expect_rc:
        print(f"          (rc {p.returncode}, expected {expect_rc})")
    return p.returncode, p.stdout, p.stderr


# ---------------------------------------------------------------------------

def test_the_map_is_not_stale():
    print("\n1. the map, the dispatch and --help are the same set")
    disp = lh._dispatched_verbs()
    mapped = lh._mapped_verbs()
    check("every dispatched verb is on the VERB_LAYERS map",
          disp <= mapped,
          f"unmapped: {sorted(disp - mapped) or 'none'}")
    check("every mapped verb is actually dispatched",
          mapped <= disp,
          f"phantom rows: {sorted(mapped - disp) or 'none'}")
    import re
    undoc = sorted(v for v in disp
                   if not re.search(rf"^\s*{re.escape(v)}\b", lh.USAGE, re.M))
    check("every dispatched verb has a --help line",
          not undoc, f"undiscoverable: {undoc or 'none'}")

    # The four layers this round shipped. Named individually rather than
    # counted, because a count passes when the wrong row is added.
    rows = {v: (mod, what) for v, mod, what in lh.VERB_LAYERS}
    for verb, mod in (("fit", "quality/fit.py"),
                      ("function", "quality/grid.py"),
                      ("refrain", "quality/schemes.py")):
        check(f"{verb!r} is on the map, answered by {mod}",
              rows.get(verb, ("", ""))[0] == mod, str(rows.get(verb)))

    rc, out, _ = run("wiring")
    check("`wiring` prints the coverage cross-check and it is clean",
          rc == 0 and "TABLE COVERAGE" in out
          and "every dispatched verb is on the map and in --help" in out)
    check("`wiring` reports no STRANDED module",
          "STRANDED  none" in out)
    check("the four new layers appear in `wiring`'s own output",
          all(m in out for m in ("quality/fit.py", "quality/grid.py",
                                 "quality/schemes.py")))

    # The mechanism has to be able to FAIL, or it is decoration. A row that
    # names a verb nobody dispatches is exactly the stale-map shape, and the
    # checker must see it.
    saved = lh.VERB_LAYERS
    try:
        lh.VERB_LAYERS = saved + (("middle8", "quality/grid.py", "invented"),)
        check("a phantom row is DETECTED, so the check can fail",
              "middle8" in lh._mapped_verbs() - lh._dispatched_verbs())
    finally:
        lh.VERB_LAYERS = saved


def _fit_unsat_column(out):
    """-> {section: UNSAT count} off a `fit` report, by COLUMN not by line.

    Extracted from §2 so §3 can stop indexing `splitlines()[3]`; see the note
    at that call site for what a positional assertion into a report costs the
    first time a disclosure line is added above the table.
    """
    rows = {}
    for line in out.splitlines():
        f = line.split()
        if len(f) >= 12 and f[0] in ("verse1", "verse2", "pre", "chorus",
                                     "bridge", "chorus2", "outro"):
            rows[f[0]] = f
    # column order: section meter group bars lines units per_bar UNSAT ...
    return {k: int(v[7].rstrip("*")) for k, v in rows.items()}


def test_fit_answers_whether_the_words_fit_the_bars():
    print("\n2. `fit` — the chorus overflows and the 7/8 verses do not")
    rc, out, err = run("fit", EXAMPLE_BP, "--subdivision", "2")
    check("`fit` runs and says which module answered",
          rc == 0 and "module: quality/fit.py" in out, err.strip()[-200:])
    check("the declared subdivision is echoed as a DECLARED coordinate",
          "2 slot(s) per pulse, DECLARED" in out)

    unsat = _fit_unsat_column(out)
    check("the 4/4 choruses report UNSATISFIABLE lines at Subdivision(2)",
          unsat.get("chorus", 0) > 0 and unsat.get("chorus2", 0) > 0,
          f"chorus {unsat.get('chorus')}, chorus2 {unsat.get('chorus2')}")
    check("the 7/8 verses report NONE — the eighth-note pulse is finer",
          unsat.get("verse1") == 0 and unsat.get("verse2") == 0,
          f"verse1 {unsat.get('verse1')}, verse2 {unsat.get('verse2')}")
    check("the overflow is named SLOTS_EXCEEDED and marked UNSATISFIABLE",
          "SLOTS_EXCEEDED" in run("fit", EXAMPLE_BP, "--subdivision", "2",
                                  "-v")[1])
    check("a lower-bound count is flagged rather than reported flat "
          "(doctrine 79)",
          "LOWER BOUND" in out and "COUNT_IS_A_LOWER_BOUND" in out)
    check("the boundary is printed with the answer, not filed elsewhere",
          "WHAT THIS LAYER CANNOT BE ASKED" in out
          and "there is no tempo" in out)


def test_fit_refuses_the_undeclared_subdivision():
    print("\n3. `fit` with no subdivision refuses rather than assuming one")
    rc, out, _ = run("fit", EXAMPLE_BP)
    check("it says NONE DECLARED instead of picking a grid",
          rc == 0 and "NONE DECLARED" in out)
    check("the slot questions are refused by name",
          "NO_SUBDIVISION" in out,
          "the refusal causes line carries it")
    # READ THE COLUMN, NOT A LINE NUMBER. This was
    # `out.split("TOTAL")[0].splitlines()[3]` — the fourth line of the
    # report, which happened to be `verse1`'s row on the day it was written
    # and became the COLUMN HEADER the moment a disclosure line was added
    # above the table (the `isochrony:` line, 2026-08-14). A positional index
    # into a human report is an assertion about the layout, not about the
    # measurement, and it fails in the one direction that teaches nothing.
    unsat = _fit_unsat_column(out)
    check("the SAME blueprint reports 0 UNSAT with nothing declared — the "
          "overflow is a fact about the DECLARATION, not about the words",
          unsat and set(unsat.values()) == {0}, f"UNSAT by section: {unsat}")


def test_function_is_not_section_name():
    print("\n4. `function` — a name is not a function")
    # A copy with every declaration STRIPPED, rather than the shipped file:
    # the point under test is that an UNDECLARED function refuses, and if a
    # later cell declares functions on the shipped fixture this assertion
    # must keep testing the refusal instead of quietly starting to test
    # something else.
    bp = json.load(open(EXAMPLE_BP))
    bp.pop("title", None)
    bp.pop("hooks", None)
    for s in bp["sections"]:
        s.pop("function", None)
    with tempfile.NamedTemporaryFile("w", suffix=".json",
                                     delete=False) as fh:
        json.dump(bp, fh)
        bare = fh.name
    try:
        rc, out, _ = run("function", bare)
        check("with nothing declared, every check REFUSES and none is "
              "answered",
              rc == 0 and "asked 3  answered 0  refused 3" in out,
              [l for l in out.splitlines() if "asked" in l][:1])
        check("it refuses on 'chorus' even though a section is CALLED chorus",
              "FUNCTION_UNDECLARED" in out
              and "a name is not a function" in out)
        check("three counts, never one (doctrine 79)",
              "asked" in out and "answered" in out and "refused" in out)
    finally:
        os.unlink(bare)

    rc, out, _ = run(
        "function", EXAMPLE_BP,
        "--function=verse1:verse,pre:prechorus,chorus:chorus,verse2:verse,"
        "bridge:bridge,chorus2:chorus,outro:outro",
        "--title=Ledger",
        "--hook=we counted every reason we were given to keep counting",
        "--rhyme-key=cmudict")
    check("declared at the CLI, the form is readable",
          "verse -> prechorus -> chorus -> verse -> bridge -> chorus -> outro"
          in out)
    check("the CLI declaration is LABELLED as one, not passed off as the "
          "blueprint's",
          "DECLARED AT THE CLI" in out)
    # THE BLOCK ITSELF, NOT A WORD THAT APPEARS IN PROSE ABOUT IT —
    # 2026-08-15. This read `"RHYME_PRESERVING_REWRITE" in out or "VERBATIM"
    # in out`, and the first disjunct is satisfied by a STATIC explanatory
    # sentence belonging to a different finding, about the VERSE. Measured:
    # rendering no comparison at all (`for fn, rets in {}.items()`) left all
    # twelve checks of this section green. Import reachability is not
    # invocation reachability, one more time, in the only CLI-rendering
    # assertion this comparison has.
    check("the two chorus returns are compared and get a NAMED kind",
          "-- chorus: chorus -> chorus2" in out
          and "return: VERBATIM" in out
          and "invariant lines" in out,
          "the comparison must be RENDERED, not merely mentioned in prose")
    check("the title/hook question is asked and answered",
          "TITLE_NOT_IN_HOOK" in out)
    check("a single prechorus is CANNOT TELL, not clean (doctrine 28)",
          "SINGLE_INSTANCE" in out)
    check("the rhyme key is declared with the flag it produced",
          "IDENTITY key" in out)

    # TWO WAYS TO DECLARE A FUNCTION, AND THEY ARE NOT THE SAME KIND OF
    # MISTAKE — REPINNED 2026-08-14. This case used to assert an
    # `UnknownFunction` TRACEBACK on stderr at exit 1, and it was asserting
    # the wrong half of a real distinction: the value here was typed on THIS
    # COMMAND LINE, which makes it a flag refusal exactly like
    # `--fallback=bogus`, and `--fallback` has printed a named refusal at
    # exit 2 since 2026-08-12. The claim the check exists to make — that it
    # does NOT fall back to verse, and that the vocabulary is named — is
    # unchanged and is asserted below; what changed is that a caller in a
    # pipeline can now tell this refusal from a crash.
    # RESTATED 2026-08-18: this case's "outside the vocabulary" example was
    # `middle8`, and the vocabulary MOVED under it on purpose — the bridge
    # row's gloss had argued "a middle-8 is a bridge" since it was written,
    # and `FunctionSpec.aliases` made the claim resolvable. So `middle8` is
    # the POSITIVE control now (pinning the alias), and the refusal case
    # uses a name no tradition claims.
    # RESTATED AGAIN 2026-08-28 (M-57): `middle8` stopped being an alias and
    # became a SPECIALISATION with a differentia (`bars == 8`), so declaring
    # it on this fixture's 2-bar chorus now REFUSES quoting the claim —
    # which is the repaired door, not a regression: this check's rc==0 pass
    # was the measured defect (the door accepting the specialisation and
    # storing the genus). The resolves-control the check exists for moves to
    # `departure-section`, a TRUE synonym with no differentia to fail.
    rc, out, err = run("function", EXAMPLE_BP, "--function=chorus:middle8")
    check("`middle8` on a 2-bar section REFUSES quoting its differentia — "
          "the door keeps the claim now (M-57), where this check's old "
          "rc==0 was the measured defect",
          rc == 2 and "bars == 8" in out and "middle-eight" in out
          and "Traceback" not in err,
          (out.strip().splitlines() or [""])[0][:120])
    rc, out, err = run("function", EXAMPLE_BP,
                       "--function=chorus:departure-section")
    check("a TRUE synonym still RESOLVES — the bridge row's own alias, the "
          "claim this check has pinned since 2026-08-18",
          rc == 0 and "Traceback" not in err,
          (out.strip().splitlines() or [""])[0][:120])
    rc, out, err = run("function", EXAMPLE_BP, "--function=chorus:vibes")
    check("a CLI-declared function outside the vocabulary REFUSES at exit 2, "
          "naming the flag and the vocabulary, rather than tracebacking",
          rc == 2 and "REFUSED" in out and "--function=chorus:vibes" in out
          and "is not a declared section function" in out
          and "Traceback" not in err,
          (out.strip().splitlines() or [""])[0][:140])
    check("and it still does NOT fall back to verse",
          "does NOT fall back to `verse`" in out)

    # THE OTHER HALF, AND IT MUST NOT MOVE. `_blueprint_or_refuse`'s own
    # docstring says `grid.UnknownFunction` is deliberately NOT caught: a
    # blueprint whose own section declares "middle8" has a defect in a
    # DECLARED coordinate of the FILE, which is a different thing from a
    # file this reader could not read, and the two must not reach the
    # operator wearing the same word. Converting the CLI flag above is only
    # correct if this stays a raise, so it is pinned here rather than
    # assumed.
    bad = json.load(open(EXAMPLE_BP))
    bad["sections"][0]["function"] = "vibes"
    with tempfile.NamedTemporaryFile("w", suffix=".json",
                                     delete=False) as fh:
        json.dump(bad, fh)
        badpath = fh.name
    try:
        rc, out, err = run("function", badpath)
        check("a BLUEPRINT-declared function outside the vocabulary still "
              "RAISES — it is a defect in the file's own coordinate, not a "
              "flag the command line got wrong",
              rc == 1 and "UnknownFunction" in err,
              (err.strip().splitlines() or [""])[-1][:120])
    finally:
        os.unlink(badpath)


def test_refrain_writes_the_villanelle():
    print("\n5. `refrain` — capital means VERBATIM")
    rc, out, _ = run("refrain", "villanelle")
    check("the named form parses to 19 lines",
          rc == 0 and "(19 lines)" in out, out.splitlines()[2:3])
    check("both refrains are found, at the lines the form requires",
          "'A1': [1, 6, 12, 18]" in out and "'A2': [3, 9, 15, 19]" in out)
    check("the identity requirement is 12 REPEAT pairs",
          "REPEAT pairs the notation REQUIRES: 12" in out)
    check("the verb says why REPEAT is the requirement here and a violation "
          "elsewhere (doctrine 3)",
          "doctrine 3" in out)

    # A refrain that drifted by one word: the commonest way the form fails,
    # and the one a rhyme checker cannot see because the rhyme still holds.
    A1 = "Do not go gentle into that good night"
    A2 = "Rage, rage against the dying of the light"
    body = [f"filler line {i}" for i in range(1, 20)]
    for i in (1, 12, 18):                    # A1 returns, verbatim
        body[i - 1] = A1
    for i in (3, 9, 15, 19):                 # A2 returns, verbatim
        body[i - 1] = A2
    body[6 - 1] = "Do not go GENTLY into that good night"   # L6 drifted
    with tempfile.NamedTemporaryFile("w", suffix=".txt", delete=False) as fh:
        fh.write("\n".join(body) + "\n")
        path = fh.name
    try:
        rc, out, _ = run("refrain", "villanelle", path)
        check("the drifted refrain is caught",
              "L1" in out and "L6" in out and "must return VERBATIM" in out,
              out.strip().splitlines()[-1][:120] if out.strip() else "")
        check("and it is a NAMED kind of variation, not a boolean "
              "(doctrine 24)",
              any(k in out for k in ("LEXICAL", "REWRITE", "SUBSTITUTION",
                                     "RESTATEMENT", "VARIED", "RETURN")))
        check("the refrains that DID return verbatim are not flagged",
              "L1 == L12" not in out.split("checked against")[-1])
    finally:
        os.unlink(path)


def test_brief_refuses_instead_of_tracebacking():
    print("\n6. `brief` / `verify` — the refusal, and the two spellings a "
          "letter string cannot express")
    rc, out, err = run("brief", EXAMPLE_TXT)
    # The refusal TEXT quotes the string it replaces, so the assertion is on
    # the first line rather than on the absence of the phrase.
    check("no mandate REFUSES rather than reporting nothing flagged "
          "(doctrine 20)",
          out.strip().startswith("REFUSED — this verb was given nothing"),
          out.strip().splitlines()[0][:100] if out.strip() else "(empty)")
    check("the refusal exits 2 — a pipeline must tell it from a pass",
          rc == 2, f"rc={rc}")
    check("and it is a printed refusal, not six frames of traceback",
          "Traceback" not in err)

    rc, out, _ = run("brief", EXAMPLE_TXT, "--groups=2,4")
    # AND THE EVIDENCE REPOINTED — 2026-08-22, the SECOND time this pair of
    # checks was found passing on the wrong thing. After the parenthesising
    # below, `"group A" in out` was still satisfied by exactly one string in
    # the whole report: the SCHEME_VIOLATION message about group A. So the
    # check proved the group had been mandated by showing it had FAILED, and
    # when the default admit set widened to all four relations (that pair is
    # ASSONANCE at 0.974 and now satisfies) the violation went away and took
    # the only mention of the group with it. Both checks went red on a draft
    # that had got BETTER. The defect was never in the checks' intent — it
    # was that `brief` had no disclosure of its own mandate, so a clean
    # graded group and an unasked question printed identically. `_say_derived`
    # now prints `MANDATE:` for a declared cover as well as a derived one,
    # which is what these two assertions were always trying to observe.
    #
    # PARENTHESISED, AND THE DEAD CLAUSE DROPPED — 2026-08-15. This read
    # `rc == 0 and "group B" in out or "group A" in out`, which Python groups
    # as `(rc == 0 and ...) or ("group A" in out)`, so the exit code was
    # enforced by nothing: measured True at rc 0, 1, 2, 3 and 4 alike. And
    # `--groups=2,4` declares ONE group, so `group B` can never appear —
    # the conjunct carrying the exit code was permanently false and the
    # check passed entirely on the `or` fallback.
    check("--groups= mandates a group the song has no letter for",
          rc == 0 and "group A" in out, out[:200])
    rc, out2, _ = run("brief", EXAMPLE_TXT, "--groups=2,4;1,3")
    check("and a SECOND declared group is labelled and graded too",
          rc == 0 and "group A" in out2 and "group B" in out2,
          "one group cannot demonstrate that the labels track the "
          "declaration")

    # ONE COVER, TWO BRANCHES, ONE DISCLOSURE — `MISSING.md` M-108,
    # 2026-08-25, found by BANKING a song whose mandate carries no returns.
    # `--groups=` ALONE hands a bare list of line-lists down `_say_derived`
    # and anything else (`--returns=`, `--structures=`, `--relations=`)
    # grows a real `Mandate` first, so the two branches were two spellings
    # of one header: the decorated one stated `N group(s) over L lines, P
    # mandated pair(s)` and the plain one — the spelling a writer actually
    # types — stated the group count and stopped. The withheld number is the
    # numerator of doctrine 79's own triple and the only one of the three a
    # report can state BEFORE grading, and `quality/song_log.py`'s declared
    # `song` parser reads all four of its mandate facts off that line, so a
    # groups-only song banked ZERO of them and the row was not refused for
    # it (18 other facts carried it) — a fact not asked, filed as a fact not
    # emitted.
    #
    # THE FIXTURE IS THE SAME COVER BOTH TIMES, which is what makes this an
    # invariant rather than two measurements: `--structures=` annotates the
    # groups it is handed and adds none, so the cover under both branches is
    # byte-identical and only the ROUTE differs. Comparing `--groups=` with
    # `--groups= --returns=` would compare two different covers that happen
    # to agree.
    _mline = lambda t: next((l.strip() for l in t.splitlines()
                             if l.strip().startswith("MANDATE:")), "")
    _rcA, _bare, _ = run("brief", EXAMPLE_TXT, "--groups=2,4;1,3")
    _rcB, _deco, _ = run("brief", EXAMPLE_TXT, "--groups=2,4;1,3",
                         "--structures=A:kalevala-alliteration")
    _a, _b = _mline(_bare), _mline(_deco)
    check("the premise — both routes print a MANDATE line at all, so this "
          "check cannot pass by comparing two empty strings",
          _rcA == 0 and _rcB == 0 and bool(_a) and bool(_b),
          f"bare={_a!r} decorated={_b!r}")
    # `source=` is the one field that MUST differ: it names the route, and
    # the two routes are genuinely different origins. Everything to its left
    # is a fact about the COVER and cannot depend on which branch read it.
    check("`--groups=` ALONE discloses its own mandated PAIR COUNT — the "
          "plainest call is not the silent one (doctrine 20/79, M-108)",
          "mandated pair(s)" in _a, _a or "(no MANDATE line)")
    check("and the cover's counts are BRANCH-INVARIANT: one cover read two "
          "ways states the same groups, lines and pairs, differing only in "
          "the `source=` that names the route",
          _a.split(", source=")[0] == _b.split(", source=")[0],
          f"bare      {_a}\n          decorated {_b}")

    rc, out, _ = run("brief", EXAMPLE_TXT, "--cliques")
    check("--cliques grades the song's OWN structure",
          rc == 0 and "source=derived" in out)
    check("and says out loud that it is NOT INDEPENDENT of the grader "
          "(doctrine 14)",
          "NOT INDEPENDENT" in out)

    # REPOINTED 2026-08-11 after cell BA's coda-identity fix: the real
    # exemplar that used to witness overlap here went FULLY DISJOINT under
    # the shipped identity coordinate, and real exemplars are preferred
    # (house style) but a graph that no longer shows the property is not
    # one. This is a constructed fixture (doctrine 94) built on a vowel-similarity
    # CHAIN rather than identity: nucleus AY~EY = 0.62 and EY~IH = 0.775
    # both clear theta_nucleus 0.60, but AY~IH = 0.44 does not, so a word
    # with nucleus EY (here, a coda-identical "-s" plural, so the coda
    # channel plays no part) rhymes with BOTH neighbours and they do not
    # rhyme with each other -- the exact non-transitive shape that makes a
    # single letter impossible.
    pivot_body = ("I saw a thousand tiny lights\n"
                  "I opened up the rusted gates\n"
                  "I missed it by a couple bits\n")
    with tempfile.NamedTemporaryFile("w", suffix=".txt",
                                     delete=False) as fh:
        fh.write(pivot_body)
        pivot_path = fh.name
    try:
        rc2, out2, _ = run("brief", pivot_path, "--cliques")
        check("the overlap is reported as having no letter scheme "
              "(doctrine 2)",
              rc2 == 0 and "NO LETTER SCHEME EXISTS" in out2, out2[:300])
        check("a pivot is briefed on EVERY group it is in, which is the "
              "thing a letter scheme cannot say",
              "is a PIVOT" in out2 and "must answer group" in out2,
              out2[:300])
    finally:
        os.unlink(pivot_path)

    check("the old `must rhyme with L(5, 'mailboxes')` tuple-print is gone",
          "must rhyme with L(" not in out)
    # REPOINTED 2026-08-22 from the `--cliques` output to a DECLARED cover.
    # `mandate_from_graph` reads its edges through `admits()`, so widening the
    # default admit set to all four relations widened the DERIVED cover too —
    # MEASURED on this fixture: 3 groups / 3 mandated pairs -> 8 groups / 35.
    # That is the correct consequence and not a defect (doctrine 1: one
    # definition per question — if a near relation satisfies a mandate then
    # two lines standing in one ARE related, and the song's own structure
    # should say so), but it means the derived brief no longer happens to
    # contain a candidate the modal table forbids. The exclusion itself is
    # untouched, which is what this check is about, so it is asked of a cover
    # that does not move when the door does.
    # REPOINTED AGAIN 2026-09-02 — the FLOOR PROFILE moved it this time.
    # `fixtures/song.txt` is 16 lines and ~130 tokens; until M-193 it was
    # graded by the SONNET profile (list order), whose `predictability_max`
    # put a PREDICTABLE_RHYME note on L1~L3 and so earned the line a field.
    # M-193's line-count tie-break hands a 16-line sheet to the `short`
    # profile, which carries no predictability threshold until stage B
    # adopts one, so the note is gone and with it the field — and a line
    # with no field has no exclusion to print (MEASURED: forcing the sonnet
    # profile back brings both the note and the FORBIDDEN block back). The
    # exclusion is asked of a DECLARED VIOLATION now — dawn/silt under ABAB,
    # no scalar rhyme and no schema rescues it — a shape that no door,
    # profile or table moves.
    with tempfile.NamedTemporaryFile("w", suffix=".txt",
                                     delete=False) as fh:
        fh.write("The river took the bridge at dawn\n"
                 "and no one saw the water again\n"
                 "our cattle waded knee deep in silt\n"
                 "past every fence the county rebuilt\n")
        mod_path = fh.name
    try:
        _, mod_out, _ = run("brief", mod_path, "ABAB")
    finally:
        os.unlink(mod_path)
    check("the modal exclusion is still printed (doctrine 9)",
          "FORBIDDEN (modal" in mod_out and "SCHEME_VIOLATION" in mod_out,
          mod_out[:200])

    # `--returns=` -- FIXED 2026-08-12, found by using the harness on a real
    # draft rather than by reading the code. `--groups=` builds a bare
    # Cover, which defaults every pair to
    # REQUIRE_RHYME: identity FORBIDDEN, REPEAT a violation. A song with a
    # verbatim chorus, declared that way, had its own returning hook charged
    # SCHEME_VIOLATION for being exactly identical -- the one thing it was
    # SUPPOSED to be. `quality.schemes.mandate`'s own `returns=` parameter
    # has held REQUIRE_RETURN correctly (identity REQUIRED, REPEAT is the
    # requirement, doctrine 3's second half) since it was written; nothing
    # on this command line could ever reach it, on ANY of `brief`/`verify`/
    # `revise`/`song` -- `Reviser.mandate()` is `SC.mandate(spec,
    # n_lines=...)` and forwards no `returns=` of its own.
    refrain_body = ("The wire hums low before the dawn\n"
                    "A second line with nothing shared\n"
                    "We are the static on the line\n"
                    "A third and different line entirely\n"
                    "We are the static on the line\n")
    with tempfile.NamedTemporaryFile("w", suffix=".txt",
                                     delete=False) as fh:
        fh.write(refrain_body)
        refrain_path = fh.name
    try:
        rc3, out3, _ = run("brief", refrain_path, "--groups=3,5")
        check("--groups= on an IDENTICAL pair charges it a violation -- "
              "identity is FORBIDDEN under the default REQUIRE_RHYME",
              rc3 == 0 and "SCHEME_VIOLATION" in out3, out3[:200])
        rc4, out4, _ = run("brief", refrain_path, "--returns=3,5")
        check("--returns= on the SAME pair does not -- identity is the "
              "requirement, and the pair is briefed as a satisfied "
              "REFRAIN_REPEAT instead",
              rc4 == 0 and "SCHEME_VIOLATION" not in out4
              and "REFRAIN_REPEAT" in out4, out4[:200])
    finally:
        os.unlink(refrain_path)

    rc, out, err = run("verify", EXAMPLE_TXT, EXAMPLE_TXT)
    check("`verify` takes the same refusal, and the same exit code",
          rc == 2 and "REFUSED" in out and "Traceback" not in err)


def _every_verb_fixture():
    """-> (cases, quat, bp): one argv per dispatched verb, over a fresh tmpdir.

    ONE ROSTER, READ BY TWO SECTIONS (2026-09-01, M-188). §7 runs it with
    the staged resources present and §47 runs it with them hidden, and the
    "covers every verb main() dispatches" check in §7 is what keeps the list
    complete -- §47 inherits that completeness by reading the same dict
    rather than carrying a second copy that would go stale on its own.
    """
    d = tempfile.mkdtemp()
    quat = os.path.join(d, "q.txt")
    with open(quat, "w") as fh:
        fh.write("The river took the bridge at dawn\n"
                 "and no one saw the water again\n"
                 "the cattle waded through the silt\n"
                 "past every fence the county rebuilt\n")
    bp = os.path.join(d, "bp.json")
    with open(bp, "w") as fh:
        json.dump({
            "title": "The river", "hooks": ["the river"],
            "sections": [
                {"name": "a", "bars": 4, "start_bar": 1, "function": "verse",
                 "meter": {"beats": 4, "unit": 4, "groups": [2, 2]}},
                {"name": "b", "bars": 4, "start_bar": 5, "function": "verse",
                 "meter": {"beats": 4, "unit": 4, "groups": [2, 2]}}],
            "lines": [
                {"text": "The river took the bridge at dawn", "bar": 1,
                 "beat": 1, "duration": 4, "section": "a"},
                {"text": "and no one saw the water again", "bar": 2,
                 "beat": 1, "duration": 4, "section": "a"},
                {"text": "the cattle waded through the silt", "bar": 5,
                 "beat": 1, "duration": 4, "section": "b"},
                {"text": "past every fence the county rebuilt", "bar": 6,
                 "beat": 1, "duration": 4, "section": "b"}]}, fh)

    cases = {
        "declaration": ["declaration"],
        "score": ["score", "fire", "--", "desire"],
        "candidates": ["candidates", "desire", "5"],
        "meter": ["meter", "./" * 4, "The river took the bridge at dawn"],
        "scheme": ["scheme", "ABAB", "dawn", "again", "silt", "rebuilt"],
        "song": ["song", EXAMPLE_BP, EXAMPLE_TXT],
        "chains": ["chains", quat],
        "graph": ["graph", quat],
        "internal": ["internal", "the cattle waded through the silt"],
        "density": ["density", quat],
        "weight": ["weight", "the cattle waded"],
        "qafiya": ["qafiya", quat],
        "cynghanedd": ["cynghanedd", "--lang=eng", "the cattle waded"],
        "prasa": ["prasa", "2", "the cattle waded", "the battle faded"],
        "demo": ["demo"],
        "wiring": ["wiring"],
        "types": ["types", "fire", "--", "desire"],
        # Pair ban screening (2026-08-18, the no-private-instruments
        # rule). Behavioural coverage lives in quality/test_screen.py —
        # this row is the dispatch-reachability claim only.
        "screen": ["screen", "fire", "desire"],
        # Derived rhyme capacity (2026-08-18, density stage 1). Behavioural
        # coverage lives in quality/test_capacity.py — dispatch only here.
        "capacity": ["capacity", "--top=3"],
        "partition": ["partition", quat],
        "cycle": ["cycle", "7/8", "3+2+2"],
        "relations": ["relations", quat],
        "grid": ["grid", bp],
        "fit": ["fit", bp, "--subdivision", "2"],
        "function": ["function", bp],
        "refrain": ["refrain", "villanelle"],
        "brief": ["brief", quat, "ABAB"],
        "verify": ["verify", quat, quat, "ABAB"],
        "revise": ["revise", quat, "ABAB"],
        "readability": ["readability", quat],
        # The planning phase (2026-08-17). Behavioural coverage lives in
        # quality/test_plan.py — this row is the dispatch-reachability claim
        # only, same as every other verb's.
        "plan": ["plan", "--seed=7", "--lines=22"],
        # The seam (2026-08-28, M-154). Behavioural coverage is §44 below —
        # this row reaches the dispatch through the verb's own cheapest
        # honest answer, the no-seed refusal, because a full run here would
        # double §44's loop cost for a claim about reachability alone.
        "finish": ["finish", quat],
        # The human door (2026-09-01, M-195). Behavioural coverage is §49 —
        # this row is the dispatch-reachability claim on a bare quatrain,
        # which REFUSES its sectioning (no mark, no blank block: the M-72
        # rule) and exits 3, a work order rather than a failure.
        "recover": ["recover", quat],
    }
    return cases, quat, bp


def test_every_verb_runs():
    print("\n7. every dispatched verb runs, and none of them tracebacks")
    cases, quat, bp = _every_verb_fixture()
    missing = sorted(lh._dispatched_verbs() - set(cases))
    check("this test covers every verb main() dispatches",
          not missing, f"uncovered: {missing or 'none'}")
    bad = []
    # 3 JOINED (0, 2) HERE 2026-08-14 and it is `song`'s alone: 0 answered
    # clean, 2 REFUSED, 3 answered with a FLAG standing (§16 below argues the
    # code and pins all three). This set is "did not raise", so it has to
    # carry every code the dispatch can deliberately return -- and it must
    # NOT carry 1, because an uncaught exception is Python's own 1 and that
    # is the whole thing this line is checking for.
    for verb, argv in sorted(cases.items()):
        rc, out, err = run(*argv)
        if "Traceback" in err or rc not in (0, 2, 3):
            bad.append(f"{verb} (rc {rc})")
    check(f"none of the {len(cases)} verbs raises",
          not bad, f"raised: {bad or 'none'}")
    # The specific one that did, and for how long: `blueprint.json` was
    # rewritten to the bar-grid shape and the OLD `check_song` read a
    # per-section `lines` count that shape deliberately does not have.
    # `wiring` called `song` wired the whole time, because it checks IMPORT
    # reachability and a KeyError is not an import. `song` was REBUILT
    # 2026-08-12 onto the same bar-grid/Reviser pipeline `brief` uses (see
    # `lyric_harness._print_brief_report`), so it no longer touches the old
    # schema at all.
    #
    # THE ROOT `blueprint.json` IS GONE -- DELETED 2026-08-14, and this
    # comment used to justify keeping it: "a THIRD, never-migrated schema ...
    # left alone here since migrating a dead schema nothing reads teaches
    # nothing a fresh fixture wouldn't". That argument rested on the file
    # being INERT and the file was not inert. `README.md` named it as the
    # documented FIRST command to run against the song layer, so the one
    # blueprint a new reader was told to open was the one blueprint no reader
    # in this repo can read -- and it crashed with an `AttributeError` naming
    # neither the file nor the field. Migrating it in place would have made a
    # SECOND demonstration blueprint that no suite exercises, which is how it
    # drifted through three schemas in the first place; the README now names
    # the fixture pair THIS function already runs, so the documented command
    # and the tested command are one command. The specimen survives as
    # `quality/fixtures/string_meter.blueprint.json`, where it is a defect
    # under test rather than a trap under a canonical name (§7b below,
    # `quality/test_grid.py` §11b, `quality/test_fit.py`).
    rc, out, err = run("song", EXAMPLE_BP, EXAMPLE_TXT)
    check("`song` on a real bar-grid blueprint runs the brief-report "
          "pipeline without a traceback, and REFUSES for want of a mandate "
          "rather than passing vacuously",
          "Traceback" not in err and "no mandate was declared" in out)


def test_the_four_blueprint_verbs_cannot_answer_differently():
    print("\n7b. one unreadable `meter`, four verbs, ONE answer — FIXED "
          "2026-08-14")
    # THE MEASUREMENT THIS REPLACES, taken at head before the fix, on the file
    # that was then this repo's root `blueprint.json`:
    #
    #   song     -> AttributeError: 'str' object has no attribute 'get'   rc 1
    #                 (quality/grid.py:480, via GR.song_from_blueprint)
    #   fit      -> AttributeError: 'str' object has no attribute 'get'   rc 1
    #                 (quality/fit.py:1404, via _cycle_of)
    #   grid     -> AttributeError: 'str' object has no attribute 'get'   rc 1
    #                 (lyric_harness.py:3423, via _grid_song)
    #   function -> AttributeError: 'str' object has no attribute 'get'   rc 1
    #                 (lyric_harness.py:3423, via _grid_song)
    #
    # Three separate frames raising the same opaque sentence, none of which
    # names the file, the section, or the field. `AttributeError` is outside
    # the `ValueError` family `main()` routes to `REFUSED — ...`/exit 2, so
    # every one of them was a traceback at exit 1: indistinguishable, to a
    # caller in a pipeline, from the harness being broken.
    #
    # WHAT IS PINNED HERE IS AGREEMENT, not just non-crashing. A refusal that
    # says one thing under `song` and another under `grid` is a worse defect
    # than a shared crash, because the operator then has to decide which verb
    # to believe about one file.
    bad = os.path.join(HERE, "fixtures", "string_meter.blueprint.json")
    seen = {}
    for verb, argv in (("grid", ["grid", bad]),
                       ("fit", ["fit", bad, "--subdivision", "2"]),
                       ("function", ["function", bad]),
                       ("song", ["song", bad, EXAMPLE_TXT, "ABAB"])):
        rc, out, err = run(*argv)
        first = next((l for l in out.splitlines() if "REFUSED" in l), "")
        seen[verb] = (rc, "Traceback" in err, first.strip())
    check("all four REFUSE at exit 2 — a refusal is not a pass and not a "
          "crash, and a caller in a pipeline has to be able to tell all "
          "three apart",
          all(v[0] == 2 and not v[1] and v[2] for v in seen.values()),
          {k: (v[0], v[1]) for k, v in seen.items()})
    check("and all four print the IDENTICAL refusal line — the property the "
          "shared `meter.section_meter` predicate exists to establish",
          len({v[2] for v in seen.values()}) == 1,
          sorted({v[2][:90] for v in seen.values()}))
    line = seen["song"][2]
    check("the refusal names the section, quotes the value it found, names "
          "its type, and shows the shape wanted",
          "'intro'" in line and '"4/4"' in line and "a string" in line
          and '"beats": 4' in line, line[:200])
    check("it does NOT claim the section declares no time signature — the "
          "section declares one on that very line, and a refusal that "
          "states a falsehood sends a writer to add a key that is already "
          "there",
          "no time signature" not in line, line[:200])
    check("the advice it gives is reachable: it asks for an edit to the "
          "file, and names no flag — `grep -n 'assume_meter\\|AssumedMeter' "
          "lyric_harness.py` returns nothing, so a message naming one would "
          "be a refusal with no exit",
          "assume_meter" not in line and "AssumedMeter" not in line
          and "rewrite that one field" in line)
    # The other half of the same property: a VALID blueprint is unchanged.
    rc, out, err = run("grid", EXAMPLE_BP)
    check("a blueprint whose meter IS an object still runs — the type check "
          "is a new refusal on a new input, not a new refusal on old ones",
          rc == 0 and "REFUSED" not in out and "Traceback" not in err)


def test_fallback_reaches_every_verb_ahead_of_the_verb_name():
    print("\n9. --fallback=high|low — a GLOBAL coordinate, reachable ahead of "
          "any verb, FIXED 2026-08-12")
    # Before this, quality.g2p.Fallback existed, was wired into
    # Lexicon.transcribe_word, and was tested at the Python API -- and there
    # was no way to reach it from the command line at all: `lex = Lexicon()`
    # at the top of main() never passed fallback=, for any verb.
    rc, out, _ = run("score", "viewest", "--", "biggest")
    check("without --fallback, a dictionary-derivable word still refuses",
          "WARNING out-of-vocabulary" in out and "NO_ANCHOR" in out,
          out.strip().splitlines()[0][:80])

    rc, out, _ = run("--fallback=high", "score", "viewest", "--", "biggest")
    check("with --fallback=high, ahead of the verb name, it reads",
          rc == 0 and "WARNING out-of-vocabulary" not in out
          and "NO_ANCHOR" not in out, out.strip()[:200])

    rc, out, _ = run("--fallback=bogus", "score", "cat", "--", "hat")
    check("an undeclared value REFUSES with exit 2, not a KeyError traceback",
          rc == 2 and "'high' or 'low'" in out, out.strip()[:120])

    rc, out, err = run("--fallback=high", "brief", EXAMPLE_TXT, "--cliques",
                       f"--blueprint={EXAMPLE_BP}")
    check("the global flag and a verb-specific flag coexist on one line",
          rc == 0 and "Traceback" not in err, err.strip()[-200:] if err else "")


def test_readability_prints_what_the_fallback_invented():
    print("\n14. `readability` — WITH `--fallback`, what the falling refusal "
          "rate COST; WITHOUT it, nothing at all")
    # §9 above proves `--fallback` REACHES every verb. It does not ask what
    # the verb then SAYS about it, and on `readability` the answer was
    # nothing: the verb printed two counts (read / REFUSED over line ends)
    # and the flag's whole visible effect was the REFUSED count going down.
    # A reader watching a refusal rate fall from 16.74% to 3.47% on
    # corpus/song/eng_hall_william_barnes.txt is watching 8,784 LETTER-layer
    # readings arrive — phones no dictionary entry supplied, measured in
    # quality/test_g2p.py §10 as answering Shakespeare's own real refusals
    # wrong 50.0% of the time against 5.1% for the derived layers. Doctrine
    # 79's three counts are the only rendering in which the fall and its
    # price are both visible, and `quality/g2p.py` has had
    # `lexicon_three_counts`/`format_three_counts` to produce them.
    #
    # BOTH DIRECTIONS ARE PINNED, and the second is the one that matters as
    # much: this is an ADDITIVE fix, so with no `--fallback` the verb must
    # print exactly what it printed before — proved byte-identical against
    # HEAD on two corpus files, and pinned here as the strings simply not
    # being there. A gate that ever fired unconditionally would put a
    # `fallback 0` column and a word-token rate under every run of a verb
    # that was asked no such question (doctrine 20: a layer that was not
    # asked must not report as though it had been).
    import re
    d = tempfile.mkdtemp()
    txt = os.path.join(d, "fallback.txt")
    # One word per layer the counts itemise, so the middle column is
    # non-empty and the LETTER row specifically has something in it:
    # `viewest` is morphology, `o'er` is elision, `hypotenuse` is known gap
    # 1's own canary and reads at NO layer but `letter`. `to-night` is the
    # population case — `line_readability` calls that line end READABLE
    # because its LAST PIECE `night` reads, while `transcribe_word` refuses
    # the token whole, which is why the counts below the line-end pair are
    # not subtractable from it.
    with open(txt, "w") as fh:
        fh.write("the angle of the hypotenuse\n"
                 "that thou viewest o'er the hill\n"
                 "we walked the stubble field to-night\n"
                 "and every gate was still\n")

    def refused_line_ends(out):
        for l in out.splitlines():
            if "countable line ends" in l and "REFUSED" in l:
                return int(l.split("REFUSED")[1].split()[0])
        return None

    rc, off, _ = run("readability", txt)
    check("WITHOUT --fallback the verb is unchanged — no three counts, no "
          "word-token population, nothing about a layer nobody declared",
          rc == 0 and "three counts" not in off
          and "word tokens" not in off and "DO NOT SUBTRACT" not in off,
          (off.strip().splitlines() or ["(nothing)"])[-1][:110])
    check("and it still prints the two line-end counts it always printed",
          "countable line ends" in off and "by cause:" in off,
          (off.strip().splitlines() or ["(nothing)"])[-1][:110])

    rc, on, err = run("--fallback=low", "readability", txt)
    check("WITH --fallback=low the three counts appear, labelled WORD "
          "TOKENS and never summed (doctrine 79)",
          rc == 0 and "Traceback" not in err
          and "three counts (word tokens" in on
          and re.search(r"dictionary \d+\s+fallback \d+\s+REFUSED \d+", on),
          (on.strip().splitlines() or ["(nothing)"])[-1][:110])
    check("the middle column is ITEMISED BY LAYER and the letter layer is "
          "in it — the reading whose phones nothing attested",
          re.search(r"fallback=low, by layer:.*letter \d+", on)
          and "LETTER layer" in on
          and "no dictionary entry supplied" in on,
          (on.strip().splitlines() or ["(nothing)"])[-1][:110])
    check("the two populations are declared INCOMPATIBLE, in the output and "
          "not only in a comment, so a reader cannot subtract one from the "
          "other",
          "DO NOT SUBTRACT" in on and "LINE ENDS" in on
          and "WORD TOKEN" in on and "LAST PIECE" in on,
          (on.strip().splitlines() or ["(nothing)"])[-1][:110])

    # THE FINDING IN MINIATURE, on four lines: the flag lowers the printed
    # refusal count, and the block underneath names what bought the drop.
    # Asserted together rather than separately — either alone is a fact
    # about a string, and it is the PAIRING that is the reason this block
    # exists.
    a, b = refused_line_ends(off), refused_line_ends(on)
    letter = re.search(r"by layer:.*?letter (\d+)", on)
    check("the flag lowers the REFUSED line-end count AND the three counts "
          "name the letter-layer readings that paid for it",
          a is not None and b is not None and b < a
          and letter and int(letter.group(1)) > 0,
          f"line ends REFUSED {a} -> {b}; letter layer "
          f"{letter.group(1) if letter else 'ABSENT'}")


def test_the_fifteen_original_verbs_are_untouched():
    print("\n8. the additive claim — the spine still answers as it did")
    rc, out, _ = run("score", "fire", "--", "desire")
    check("`score` still reports fire/desire at 1.0",
          "1.0" in out, out.strip().splitlines()[0][:80])
    rc, out, _ = run("cycle", "7/8", "3+2+2")
    check("`cycle` still reads exact rationals",
          "7/8" in out and "pulse groups" in out)
    rc, out, _ = run("grid", EXAMPLE_BP)
    check("`grid` still runs after the loader was factored out from under it",
          rc == 0 and "sections 7  bars 16  lines 16" in out)
    check("`grid` reads the same uniformity and stanza-lock layer as before",
          "uniformity:" in out and "phrase profile:" in out)


def test_candidates_refuses_an_unreadable_query():
    print("\n10. `candidates` REFUSES an unreadable query instead of "
          "raising KeyError — FIXED 2026-08-13")
    # `CandidateEngine.candidates` returned TWO dict shapes: the success one
    # carrying `anchor_syllables`/`candidates`, and a no-anchor one carrying
    # only `error`/`oov`. The verb read `res['anchor_syllables']`
    # unconditionally, so EVERY out-of-vocabulary query -- the ones a writer
    # reaches a rhyme-candidate verb with in the first place -- died with
    # `KeyError: 'anchor_syllables'` six frames down. It was shipped, listed
    # in CLAUDE.md's command list, and covered by §7 above only because §7's
    # own case (`candidates desire 5`) happens to be a CMUdict word.
    #
    # The canary is not arbitrary: `hypotenuse` is the word this repo's OWN
    # known gap 1 names, so the verb crashed on the single example the
    # documentation tells a reader to try.
    for word in ("hypotenuse", "shiesty", ""):
        rc, out, err = run("candidates", word, "5", expect_rc=2)
        check(f"`candidates {word!r}` refuses and does not raise",
              rc == 2 and "Traceback" not in err and "KeyError" not in err
              and "REFUSED" in out,
              (err.strip().splitlines() or [""])[-1][:100])

    rc, out, err = run("candidates", "hypotenuse", "5")
    check("the refusal is charged to the DIALECT and says the field was "
          "never searched (doctrine 79/28 — not 'this word has no rhymes')",
          "not readable in the declared dialect" in out
          and "no rhymes" in out and "out-of-vocabulary" in out,
          out.strip()[:160])

    # Doctrine 48: the route out of the refusal is MECHANICAL, not prose.
    # The message names --fallback, so --fallback has to actually answer.
    rc, out, err = run("--fallback=low", "candidates", "hypotenuse", "3")
    check("the `--fallback` route the refusal names really reaches a field",
          rc == 0 and "candidates for 'hypotenuse'" in out
          and "anchor 2 syllable(s)" in out, out.strip()[:120])

    # ...and a readable query is untouched: this is a refusal added, not a
    # capability removed.
    rc, out, _ = run("candidates", "fire", "5")
    check("a readable query still returns its field at exit 0",
          rc == 0 and "candidates for 'fire'" in out and "desire" in out,
          out.strip().splitlines()[0][:80])

    # The engine's return is now ONE shape, so no consumer can KeyError on
    # it — `quality/revise.py`'s `_field` escaped only by defensive `.get`.
    eng = lh.CandidateEngine(lh.Lexicon(), lh.Declaration())
    res = eng.candidates("hypotenuse", 5)
    check("the no-anchor return carries every key the success return does",
          set(res) >= {"query", "anchor_syllables", "oov", "candidates"}
          and res["candidates"] == [] and res["anchor_syllables"] == 0
          and res["error"] == "no anchor", str(sorted(res)))


def test_relations_prints_the_search_burden_it_promises():
    print("\n11. `relations` actually RUNS its doctrine 56 disclosure — "
          "FIXED 2026-08-13")
    # `RL.search_burden(schema, stream)` takes two arguments. The verb called
    # `RL.search_burden(st)` with one, inside `except Exception: burden =
    # None`, and `None` renders as the clause simply not being printed. So
    # the paragraph claimed "`search_k` is now consumed" while the code that
    # consumes it had never executed, on any input, and the bare handler is
    # exactly why nothing said so: a TypeError from a programming error and a
    # legitimate capability gap were being treated as the same event.
    d = tempfile.mkdtemp()
    quat = os.path.join(d, "q.txt")
    with open(quat, "w") as fh:
        fh.write("The river took the bridge at dawn\n"
                 "and no one saw the water again\n"
                 "the cattle waded through the silt\n"
                 "past every fence the county rebuilt\n")

    rc, out, err = run("relations", quat)
    check("`relations` runs clean", rc == 0 and "Traceback" not in err,
          err.strip()[-160:] if err else "")
    check("the burden clause is PRESENT, not silently dropped",
          "member span(s) over" in out and "mean_k" in out,
          [l for l in out.splitlines() if "EVIDENCE" in l][:1])

    import re
    m = re.search(r"here (\d+) member span\(s\) over (\d+) firing "
                  r"schema\(s\), (\d+) of them reached by a search over "
                  r"more than one hypothesis; heaviest '([^']+)' at "
                  r"mean_k ([\d.]+), max_k (\d+)", out)
    check("the clause carries real numbers, not a formatting change",
          m is not None and int(m.group(1)) > 0 and int(m.group(2)) > 0,
          m.group(0)[:140] if m else "clause did not parse")
    if m:
        check("doctrine 56 is answered rather than asserted: this text's "
              "counts ARE search-obtained, and the heaviest schema is NAMED",
              int(m.group(3)) > 0 and float(m.group(5)) > 1.0,
              f"{m.group(4)} mean_k {m.group(5)} max_k {m.group(6)}, "
              f"{m.group(3)}/{m.group(1)} spans searched")

    # A schema filter that fires NOTHING has no burden to report, and the
    # sentence degrades to its pre-clause form rather than printing a zero
    # that would read as "the search was free" (doctrine 28).
    #
    # THE FIXTURE VALUE MOVED, and the reason is the distinction this case
    # was accidentally collapsing. It was `--schema=zzz-no-such-schema`,
    # which is a filter that matches NO SCHEMA AT ALL — a different event
    # from a filter that selects real schemas none of which fire, and since
    # 2026-08-14 it REFUSES at exit 2 rather than printing `schemas finding
    # something: 0` in a genuine null's shape (§15). `prasa` is the case this
    # check has always meant: it selects real schemas, they run, and nothing
    # in an English quatrain answers them.
    rc, out2, _ = run("relations", quat, "--schema=prasa")
    check("with nothing firing, the clause is absent rather than faked",
          rc == 0 and "member span(s) over" not in out2
          and "reports the hypotheses per locus" in out2,
          [l for l in out2.splitlines() if "schemas finding" in l][:1])

    # The call site and the callee are pinned to each other. An arity that
    # drifts again fails HERE rather than reappearing as a missing clause.
    import inspect
    from quality import relations as RL
    check("`search_burden` still takes (schema, stream) — the call site is "
          "pinned to the signature, not to a bare except",
          list(inspect.signature(RL.search_burden).parameters) ==
          ["schema", "stream"],
          str(inspect.signature(RL.search_burden)))


def test_blueprint_mismatch_refuses_on_every_verb():
    print("\n13. a blueprint that does not match the draft REFUSES on all "
          "four verbs, not one — FIXED 2026-08-13")
    # `Reviser._meter_findings` correlates blueprint placements to draft
    # lines BY POSITION, and raises on a length mismatch rather than
    # silently misaligning every line after the first difference. That
    # raise is right and its wording is deliberate. What was wrong is where
    # it CAME OUT: `song` wrapped the call in a private `except ValueError`
    # and printed `REFUSED — {e}` at exit 2, and `brief`, `verify` and
    # `revise` — which reach the identical method through the identical
    # `_print_brief_report` — printed six frames of traceback and exited 1.
    # One user mistake, two answers, decided by which verb was typed.
    #
    # Same family as §10's `candidates` KeyError: a user-facing verb
    # tracebacking where its sibling refuses cleanly. Louder, and therefore
    # NOT findable by §7 above — §7 asserts `rc in (0, 2)` and no traceback,
    # and every one of its blueprint cases hands the verb a blueprint whose
    # line count already matches its draft, which is the one input on which
    # this defect cannot fire.
    d = tempfile.mkdtemp()
    quat = os.path.join(d, "q.txt")
    with open(quat, "w") as fh:
        fh.write("The river took the bridge at dawn\n"
                 "and no one saw the water again\n"
                 "the cattle waded through the silt\n"
                 "past every fence the county rebuilt\n")
    # EXAMPLE_BP declares 16 lines; the draft above is 4. Nothing about the
    # draft is wrong — it is a perfectly good quatrain — so the refusal has
    # to be about the PAIR, which is what makes naming both sides the whole
    # of the fix (doctrine 79).
    n_bp = len(json.load(open(EXAMPLE_BP))["lines"])
    check("the fixture blueprint really does declare a different count "
          "than the draft, or this section tests nothing",
          n_bp == 16, f"blueprint lines {n_bp}, draft lines 4")

    cases = {
        "brief": ["brief", quat, "ABAB", f"--blueprint={EXAMPLE_BP}"],
        "verify": ["verify", quat, quat, "ABAB", f"--blueprint={EXAMPLE_BP}"],
        "revise": ["revise", quat, "ABAB", f"--blueprint={EXAMPLE_BP}"],
        "song": ["song", EXAMPLE_BP, quat, "ABAB"],
    }
    heads = {}
    for verb, argv in cases.items():
        rc, out, err = run(*argv, expect_rc=2)
        first = next((l.strip() for l in out.splitlines()
                      if "REFUSED" in l), "")
        heads[verb] = first
        check(f"`{verb}` REFUSES the mismatch instead of raising",
              rc == 2 and "Traceback" not in err
              and first.startswith("REFUSED — blueprint declares 16 line(s), "
                                   "4 were handed to the loop"),
              (err.strip().splitlines() or [first or "(nothing)"])[-1][:110])

    # ONE SHAPE, NOT FOUR. `song` already refused; the defect was that the
    # other three did something else. Asserting each verb's message against
    # a literal separately would still pass if a later change gave one of
    # them its own wording, so the identity across verbs is asserted
    # directly — that is the property "do not invent a second refusal
    # shape" actually names.
    check("all four print the IDENTICAL refusal line — one shape, reached "
          "from four verbs",
          len(set(heads.values())) == 1 and heads["song"],
          f"{len(set(heads.values()))} distinct: "
          f"{sorted(set(v[:60] for v in heads.values()))}")

    # DOCTRINE 79: the refusal names WHICH SIDE DECLARED WHAT. The library's
    # own message carries both counts and neither path, correctly — it never
    # saw a command line. Without the paths a caller holding "16 vs 4" has
    # two files open and no way to tell which one to edit, which is the
    # difference between a refusal and a complaint.
    def refusal_block(out):
        """Everything the verb printed AFTER the REFUSED line.

        Scoped deliberately: `_say_blueprint()` prints `NO SUBDIVISION
        DECLARED` and the blueprint path on the line ABOVE, so a bare
        `"DECLARED" in out and EXAMPLE_BP in out` passes on the UNFIXED
        harness against a disclosure about an entirely different coordinate.
        Caught by running this section against the pre-fix harness and
        reading which checks passed, which is the only way that class of
        false pass ever shows up.
        """
        ls = out.splitlines()
        i = next((n for n, l in enumerate(ls) if "REFUSED" in l), None)
        return "\n".join(ls[i + 1:]) if i is not None else ""

    rc, out, _ = run("brief", quat, "ABAB", f"--blueprint={EXAMPLE_BP}")
    blk = refusal_block(out)
    check("the refusal names the file that DECLARED 16 and labels it the "
          "declaration (doctrine 79)",
          "DECLARED" in blk and EXAMPLE_BP in blk, blk[:200] or "(no block)")
    check("and the file that was HANDED IN, so the caller can fix it "
          "without reading source",
          "HANDED IN" in blk and quat in blk, blk[:200] or "(no block)")
    rc, out, _ = run("verify", quat, quat, "ABAB",
                     f"--blueprint={EXAMPLE_BP}")
    blk = refusal_block(out)
    check("`verify` names BOTH of its drafts — it was handed two, and "
          "either could be the wrong length",
          blk.count("HANDED IN") == 2 and "BEFORE" in blk and "AFTER" in blk,
          blk[:200] or "(no block)")

    # THE SWEEP'S OTHER HALF. `song`'s private handler started AFTER its own
    # `grid.song_from_blueprint` call, so it was strictly narrower than it
    # looked: a blueprint `song` could not PARSE escaped the very verb that
    # was supposed to be the one that refused. Moving the handler onto the
    # shared `try` covers the loader too. These are the same user mistake
    # one step earlier — a wrong or malformed file named as the blueprint.
    bad = {}
    b = json.load(open(EXAMPLE_BP))
    b["lines"] = b["lines"][:4]
    import copy
    v = copy.deepcopy(b)
    v["lines"][0]["duration"] = "x"
    bad["Invalid literal for Fraction"] = v
    v = copy.deepcopy(b)
    v["sections"][0]["meter"] = {"beats": 4, "unit": 4, "groups": [3, 3]}
    bad["groups (3, 3) sum to 6"] = v
    for phrase, obj in bad.items():
        with tempfile.NamedTemporaryFile("w", suffix=".json",
                                         delete=False) as fh:
            json.dump(obj, fh)
            p = fh.name
        try:
            for verb, argv in (("brief", ["brief", quat, "ABAB",
                                          f"--blueprint={p}"]),
                               ("song", ["song", p, quat, "ABAB"])):
                rc, out, err = run(*argv, expect_rc=2)
                check(f"`{verb}` refuses a blueprint it cannot read "
                      f"({phrase!r})",
                      rc == 2 and "Traceback" not in err and phrase in out,
                      (err.strip().splitlines() or ["-"])[-1][:100])
        finally:
            os.unlink(p)

    # THE BOUNDARY OF THE FIX, PINNED SO WIDENING IT IS A DECISION. The
    # handler catches `ValueError` and deliberately not `KeyError`: a
    # section missing `bars` raises `KeyError: 'bars'`, which at this frame
    # is indistinguishable from `KeyError: 'anchor_syllables'` — a REAL
    # defect in this spine (§10) that was found precisely because it
    # escaped. So this does NOT assert that the KeyError case tracebacks
    # (a later session may give it a proper refusal, and should); it
    # asserts that nobody closes it by widening the handler, which would
    # hand a caller a "refusal" whose entire content is a quoted dict key
    # and name neither what is wrong nor which file it is in.
    b2 = json.loads(json.dumps(b))
    b2["sections"][0].pop("bars", None)
    with tempfile.NamedTemporaryFile("w", suffix=".json",
                                     delete=False) as fh:
        json.dump(b2, fh)
        keyless = fh.name
    try:
        rc, out, err = run("brief", quat, "ABAB", f"--blueprint={keyless}")
        check("a missing blueprint field is never answered with a bare "
              "`REFUSED — 'bars'` that names nothing (doctrine 79)",
              "REFUSED — 'bars'" not in out,
              out.strip().splitlines()[-1][:100] if out.strip() else "-")
    finally:
        os.unlink(keyless)

    # A REFUSAL ADDED, NOT A CAPABILITY REMOVED — the control on the fix.
    # A blueprint whose count MATCHES still runs the meter layer to exit 0,
    # so the handler cannot be passing by swallowing the working case.
    bp = os.path.join(d, "bp.json")
    with open(bp, "w") as fh:
        json.dump({
            "title": "The river", "hooks": ["the river"],
            "sections": [
                {"name": "a", "bars": 4, "start_bar": 1, "function": "verse",
                 "meter": {"beats": 4, "unit": 4, "groups": [2, 2]}},
                {"name": "b", "bars": 4, "start_bar": 5, "function": "verse",
                 "meter": {"beats": 4, "unit": 4, "groups": [2, 2]}}],
            "lines": [
                {"text": "The river took the bridge at dawn", "bar": 1,
                 "beat": 1, "duration": 4, "section": "a"},
                {"text": "and no one saw the water again", "bar": 2,
                 "beat": 1, "duration": 4, "section": "a"},
                {"text": "the cattle waded through the silt", "bar": 5,
                 "beat": 1, "duration": 4, "section": "b"},
                {"text": "past every fence the county rebuilt", "bar": 6,
                 "beat": 1, "duration": 4, "section": "b"}]}, fh)
    rc, out, err = run("brief", quat, "ABAB", f"--blueprint={bp}")
    check("a MATCHING blueprint still runs the meter layer at exit 0",
          rc == 0 and "REFUSED" not in out and "BLUEPRINT:" in out,
          out.strip().splitlines()[0][:100] if out.strip() else "-")


def test_qafiya_reads_a_file_the_way_every_other_verb_does():
    print("\n14. `qafiya FILE` reads sung text, and a tie is disclosed")
    # THE `open()` BRANCH OF THIS VERB HAD NO TEST AT ALL, which is why four
    # sweeps missed it: §7 runs `qafiya` on a LIST of lines, and
    # `quality/test_readability.py` calls `check_qafiya` with a two-element
    # list. Neither touches the path the verb takes when handed a filename,
    # and that path was the last reader in lyric_harness.py that scored
    # APPARATUS AS SUNG TEXT -- blank-filtered only, no `is_apparatus_line`,
    # no `encoding="utf-8"`.
    with tempfile.TemporaryDirectory() as d:
        appar = os.path.join(d, "appar.txt")
        with open(appar, "w", encoding="utf-8") as fh:
            fh.write("# author: A. Nonymous (1725-1807)\n"
                     "# source: GITenberg/Some-Book_33180 33180.n.txt "
                     "md5 5243a8d61b256db494f8315502b18819\n"
                     "# songs: 10\n"
                     "\n"
                     "--- TITLE: The river\n"
                     "[VERSE 1]\n"
                     "the cattle waded through the silt\n"
                     "past every fence the county rebuilt\n"
                     "the summer left the garden wilt\n"
                     "and slept beneath the wall he built\n")
        rc, out, err = run("qafiya", appar)
        endwords = re.findall(r"^  L\d+ \(([^)]*)\):", out, re.M)
        check("`qafiya FILE` judges the four SUNG lines, not the apparatus",
              rc == 0 and "Traceback" not in err and len(endwords) == 4,
              f"judged {len(endwords)}: {endwords}")
        check("no provenance header, title or section marker is scored as "
              "a rhyme word",
              endwords == ["silt", "rebuilt", "wilt", "built"],
              f"got {endwords} -- the bare reader reported 'Nonymous', "
              f"'b' (a fragment of the md5), 'songs', 'river' and 'VERSE', "
              f"and charged an `ita` repeat against the checksum")
        # NOT a source grep: run the verb with the locale that breaks it.
        # 169 of the `corpus/song/*.txt` files carry non-ASCII bytes, and a
        # bare `open()` decodes by locale -- so under `LC_ALL=C` this verb
        # raised UnicodeDecodeError on every one of them. Every verb that
        # reads lyric text is checked, because `qafiya` was not the only one.
        nonascii = os.path.join(d, "utf8.txt")
        with open(nonascii, "w", encoding="utf-8") as fh:
            fh.write("the cattle waded through the silt\n"
                     "past every fence the county’s rebuilt\n")
        cenv = dict(os.environ, LC_ALL="C", LANG="C",
                    PYTHONCOERCECLOCALE="0", PYTHONUTF8="0")
        for verb in ("qafiya", "relations"):
            p = subprocess.run([sys.executable, "lyric_harness.py",
                                verb, nonascii], cwd=ROOT, env=cenv,
                               capture_output=True, text=True, timeout=900)
            check(f"`{verb}` reads UTF-8 under a C locale, not by locale",
                  "UnicodeDecodeError" not in p.stderr,
                  p.stderr.strip().splitlines()[-1][:90]
                  if p.stderr.strip() else "-")

        # The guard `partition` uses, for the reason `partition` uses it: the
        # documented usage is `qafiya FILE|L...`, so ONE argument that is not
        # a path is a LINE. It used to be `open()`ed and raise FileNotFound.
        rc, out, err = run("qafiya", "the cattle waded through the silt")
        check("a single bare LINE is a line, not a missing filename",
              rc == 0 and "FileNotFoundError" not in err
              and "(silt)" in out,
              f"rc {rc} -- {err.strip().splitlines()[-1][:80] if err.strip() else out[:80]}")

    # Doctrine 66. `max(set(vals), key=vals.count)` broke a tie by SET
    # ITERATION ORDER, which PYTHONHASHSEED salts: the same command on
    # `corpus/song/eng_hymn_newton.txt` returned rawi D, R, R, D, D under
    # seeds 0-4. 23 of the 143 `corpus/song/eng_*.txt` files leave some
    # profile slot tied once the reader above is fixed.
    with tempfile.TemporaryDirectory() as d:
        tie = os.path.join(d, "tie.txt")
        with open(tie, "w", encoding="utf-8") as fh:
            fh.write("The river took the bridge at dawn\n"
                     "and no one saw the water again\n"
                     "the cattle waded through the silt\n"
                     "past every fence the county rebuilt\n")
        seen = set()
        for seed in ("0", "1", "2", "3", "4"):
            env = dict(os.environ, PYTHONHASHSEED=seed)
            p = subprocess.run([sys.executable, "lyric_harness.py",
                                "qafiya", tie], cwd=ROOT, env=env,
                               capture_output=True, text=True, timeout=900)
            seen.add(p.stdout)
        check("five PYTHONHASHSEEDs give ONE answer, byte for byte",
              len(seen) == 1,
              f"{len(seen)} distinct outputs -- a tie broken by iterating a "
              f"set is a result that does not reproduce")
        out = seen.pop()
        check("and the tie is DISCLOSED, not silently broken",
              "TIED:" in out and "does not establish rawi" in out
              and "'N'" in out and "'T'" in out,
              "doctrines 20/28: 'the text does not determine a single rawi' "
              "is a real answer and must not be collapsed into a coin flip")


def test_no_broad_exception_handler_hides_a_call():
    print("\n12. the mechanism that hid it: broad handlers in the spine")
    # Doctrine 48. `except Exception` around a call is how an arity bug
    # survives: the TypeError and the legitimate failure the handler was
    # written for are indistinguishable at runtime, so the feature silently
    # never runs and NOTHING reports it. This counts them so a new one is a
    # visible decision rather than a thing a later session discovers.
    import ast
    src = open(os.path.join(ROOT, "lyric_harness.py")).read()
    broad = []
    for node in ast.walk(ast.parse(src)):
        if isinstance(node, ast.ExceptHandler):
            if node.type is None or (isinstance(node.type, ast.Name)
                                     and node.type.id in ("Exception",
                                                          "BaseException")):
                broad.append(node.lineno)
    bare = [n.lineno for n in ast.walk(ast.parse(src))
            if isinstance(n, ast.ExceptHandler) and n.type is None]
    check("no BARE `except:` anywhere in the spine",
          not bare, f"bare handlers at {bare or 'none'}")
    # ONE remains, and it is declared: `_print_brief_report`'s span lookup
    # reads `Reviser._matrix`, a PRIVATE, and is documented to degrade to
    # silence if `quality/revise.py` is refactored underneath it. It was
    # probed across `brief` (letter scheme, --cliques, --groups=,
    # --returns=), `song`, `verify` and `revise` on 2026-08-13 and fired on
    # none of them, so there is no proof it hides anything — it is pinned
    # here rather than removed on suspicion.
    check("broad `except Exception` handlers in lyric_harness.py: exactly "
          "the one declared span-lookup fallback",
          len(broad) == 1, f"at lines {broad}")


def _md5(s):
    import hashlib
    return hashlib.md5(s.encode()).hexdigest()


def test_no_flag_silently_changes_a_measurement():
    """15. A FLAG VALUE THE HARNESS DOES NOT HAVE MUST NOT CHANGE A NUMBER.

    Three flags did, all three at exit 0, and each was found the same way:
    by running the verb with a value that is not in its vocabulary and
    DIFFING the output against the run with no flag at all.

      * `scheme --profile bogus` — `PROFILES.get()` returned the default
        weights, so the run was BYTE-IDENTICAL to no flag while `--profile
        assonance` moved the violation count on the same four words.
        `PROFILES["full"]` was ALSO `None`, so an unrecognised name was not
        even distinguishable from the legitimate `full` inside `score()`.
      * `fit --isochronous=true` (and the typo `--isochronus`) — a bare
        presence flag standing between two flags that take values, so the
        `=` spelling is the natural guess and was silently NOT the flag: 16
        `NO_SETTING` refusals came back and the report named isochrony
        nowhere at all.
      * `relations --schema=bogus` — a substring filter that matched nothing
        printed `schemas finding something: 0   refusing...: 0`, the same
        shape as a genuine null, between the two paragraphs telling a reader
        how to interpret exactly those counts.

    What each check asserts is the pair doctrine 20 keeps apart: the bad
    value REFUSES (exit 2, vocabulary named), and the coordinate is STATED in
    the report whether it was declared or not — because a run whose
    comparator is non-default and does not say so is doctrine 1 broken in the
    rendering, and no exit code fixes that half.
    """
    print("\n15. no flag silently changes a measurement — the three Tier-1 "
          "silent degradations, FIXED 2026-08-14")

    # ---- 1. scheme --profile ------------------------------------------
    quatrain = ["dawn", "again", "silt", "rebuilt"]
    rc_none, none_out, _ = run("scheme", "ABAB", *quatrain)
    rc_ass, ass_out, _ = run("scheme", "ABAB", "--profile", "assonance",
                             *quatrain)
    check("the profile is a REAL comparator on this input — the two runs "
          "disagree, which is what makes silence about it a defect",
          rc_none == 0 and rc_ass == 0
          and _md5(none_out) != _md5(ass_out)
          and none_out.count("VIOLATION") != ass_out.count("VIOLATION"),
          f"violations {none_out.count('VIOLATION')} vs "
          f"{ass_out.count('VIOLATION')}")

    rc, out, err = run("scheme", "ABAB", "--profile", "bogus", *quatrain)
    check("an undeclared profile REFUSES at exit 2 and NAMES the vocabulary "
          "— it used to be byte-identical to no flag at all",
          rc == 2 and "REFUSED" in out and "assonance" in out
          and "full" in out and "rawi" in out and "Traceback" not in err,
          (out.strip().splitlines() or [""])[0][:120])

    check("the profile is PRINTED on every run, declared or not (doctrine "
          "1 in the rendering) — nothing in this report named it before",
          "profile: NONE DECLARED" in none_out
          and "profile: assonance" in ass_out)

    # `full` is a DECLARED name whose value is the Declaration's own weights.
    # It must be accepted, must be named in the report, and must NOT be the
    # value an unknown name lands on — which is what `PROFILES["full"] is
    # None` made it.
    rc_full, full_out, _ = run("scheme", "ABAB", "--profile", "full",
                               *quatrain)
    check("`full` is accepted and NAMED, and its numbers match the "
          "undeclared run because it IS the Declaration's own weights",
          rc_full == 0 and "profile: full" in full_out
          and _md5(_strip_profile_line(full_out))
          == _md5(_strip_profile_line(none_out)))

    for spelling in (("--profile=assonance",), ("--profile", "assonance")):
        rc, out, err = run("scheme", "ABAB", *quatrain, *spelling)
        check(f"{' '.join(spelling)} is read AFTER the lines too — it used "
              f"to fall into the line list and die on an AssertionError",
              rc == 0 and "profile: assonance" in out
              and "Traceback" not in err,
              (err.strip().splitlines() or [""])[-1][:100])
    rc, out, err = run("scheme", "ABAB", "--profile=assonance", *quatrain)
    check("and the `=` spelling every sibling flag accepts is the flag here "
          "too, in first position",
          rc == 0 and "profile: assonance" in out
          and "Traceback" not in err)

    # ---- 2. fit --isochronous -----------------------------------------
    rc_off, off, _ = run("fit", EXAMPLE_BP, "--subdivision", "2")
    rc_on, on, _ = run("fit", EXAMPLE_BP, "--subdivision", "2",
                       "--isochronous")
    check("isochrony is a REAL coordinate on this fixture — declaring it "
          "clears 16 NO_SETTING refusals",
          rc_off == 0 and rc_on == 0 and "NO_SETTING" in off
          and "NO_SETTING" not in on,
          [l for l in off.splitlines() if "REFUSED, by cause" in l][:1])
    check("the coordinate is PRINTED either way, in the same house style as "
          "the `subdivision:` line beside it — isochrony was named NOWHERE "
          "in this report",
          "isochrony: NONE DECLARED" in off
          and "isochrony: ASSUMED, DECLARED" in on)

    rc, out, err = run("fit", EXAMPLE_BP, "--subdivision", "2",
                       "--isochronous=true")
    check("`--isochronous=true` REFUSES at exit 2 — it used to be silently "
          "not the flag, restoring all 16 refusals",
          rc == 2 and "REFUSED" in out and "takes NO value" in out
          and "Traceback" not in err,
          (out.strip().splitlines() or [""])[0][:120])

    rc, out, err = run("fit", EXAMPLE_BP, "--subdivision", "2",
                       "--isochronus")
    check("and the one-letter typo `--isochronus` REFUSES too, naming the "
          "flags this verb has — an unknown flag is not an ignorable one",
          rc == 2 and "REFUSED" in out and "--isochronous" in out
          and "--subdivision" in out,
          (out.strip().splitlines() or [""])[0][:120])

    # ---- 3. relations --schema= ---------------------------------------
    rc_all, allout, _ = run("relations", EXAMPLE_TXT)
    check("the unfiltered run states that NO filter was declared, and over "
          "how many schemas the two counts below it were taken",
          rc_all == 0 and "schema filter: NONE DECLARED" in allout
          and "77 schemas asked" in allout)

    rc, out, _ = run("relations", EXAMPLE_TXT, "--schema=rhyme")
    check("a filter that matches states HOW MANY of the registry it "
          "selected — `found`/`refused` are counts over a POPULATION and "
          "the flag silently changed the denominator",
          rc == 0 and "schema filter: 'rhyme'" in out
          and "of 77 schemas asked" in out,
          [l for l in out.splitlines() if "schema filter" in l][:1])

    rc, out, err = run("relations", EXAMPLE_TXT, "--schema=bogus")
    # The count line and the two interpretation paragraphs around it are the
    # thing that must not be printed — a `0   0` between two paragraphs about
    # how to read these counts is exactly what a genuine null looks like.
    # (The refusal QUOTES the count line to say what it is refusing to print,
    # so the assertion is on the report body, not on the substring.)
    check("a filter matching NOTHING REFUSES at exit 2 instead of printing "
          "`schemas finding something: 0`, which is a null's shape",
          rc == 2 and out.lstrip().startswith("REFUSED")
          and "matched 0 of 77" in out
          and "TWO THINGS THESE COUNTS ARE NOT" not in out
          and "refusing on a capability" not in out
          and "Traceback" not in err,
          (out.strip().splitlines() or [""])[0][:120])
    check("and the refusal NAMES the vocabulary it would have accepted",
          "perfect rhyme" in out and "alliteration" in out)


def _strip_profile_line(out):
    """The `scheme` report minus its own `profile:` disclosure line.

    Needed by exactly one check: `--profile full` and no flag at all must
    produce the same MEASUREMENT (that is what `full` means) and must NOT
    produce the same REPORT (that is the fix). Comparing them requires
    removing the one line that is allowed to differ.
    """
    return "\n".join(l for l in out.splitlines()
                     if not l.strip().startswith("profile:"))


def test_every_flag_value_refuses_in_one_shape():
    """16. THE REFUSAL SHAPE IS ONE SHAPE, ON EVERY FLAG.

    `--fallback=high|low` validated and exited 2 with a named message from
    the day it was written. Seven other flag values refused correctly and did
    it as an UNCAUGHT EXCEPTION — traceback, exit 1 — so one user mistake had
    two answers depending on which flag was typed, and a pipeline could not
    tell either of them from a crash in the spine. The MESSAGES were never
    the problem; every one of these already named its own vocabulary. The
    shape and the exit code were.
    """
    print("\n16. one refusal shape for every flag value — `REFUSED …`, exit "
          "2, vocabulary named")
    cases = [
        ("--fallback (the model the rest copy)",
         ("--fallback=bogus", "score", "cat", "--", "hat"), "'high' or 'low'"),
        ("types --lang=",
         ("types", "cat", "--", "hat", "--lang=bogus"), "no phonology"),
        ("types --preset=",
         ("types", "cat", "--", "hat", "--preset=bogus"), "wants one of"),
        ("relations --lang=",
         ("relations", EXAMPLE_TXT, "--lang=bogus"), "no phonology"),
        ("fit --subdivision (not a number)",
         ("fit", EXAMPLE_BP, "--subdivision", "x"), "positive whole number"),
        ("fit --subdivision (out of range)",
         ("fit", EXAMPLE_BP, "--subdivision", "0"), "positive whole number"),
        ("cynghanedd --lang=",
         ("cynghanedd", "--lang=bogus", "y cwch"), "wants one of"),
    ]
    for name, argv, needle in cases:
        rc, out, err = run(*argv)
        check(f"{name} refuses at exit 2, not a traceback at exit 1",
              rc == 2 and out.lstrip().startswith("REFUSED")
              and needle in out and "Traceback" not in err,
              f"rc={rc} {(out.strip().splitlines() or [''])[0][:90]}")

    # `cynghanedd --lang=` HAD THE SAME FIRST-POSITION-ONLY PARSE `--profile`
    # did, found while fixing that one: read as `rest[0].startswith(...)`, so
    # a trailing `--lang=eng` was not the flag AND the literal token
    # `--lang=eng` was joined into the line being scored. Doctrine 45 — every
    # result declares which phonology produced it — held in the printed
    # header and not in the parse.
    rc, out, _ = run("cynghanedd", "the cattle waded", "--lang=eng")
    check("cynghanedd reads `--lang=` after the line too — it used to score "
          "the flag itself as a word, under the default Welsh phonology",
          rc == 0 and "phonology: eng" in out,
          (out.strip().splitlines() or [""])[0][:100])

    # THE TWO GLOBAL FLAGS AND THE VERB NAME ITSELF, same family one level
    # out: `--voices=true` was neither the flag nor a verb, so it fell to the
    # `unknown command` branch — which PRINTED AND RETURNED 0. A typo'd verb
    # and a clean run of a real one were the same exit code.
    rc, out, _ = run("--voices=true", "score", "cat", "--", "hat")
    check("`--voices=true` REFUSES at exit 2 — the same `=`-on-a-bare-flag "
          "hole `--isochronous` had, on the other global flag",
          rc == 2 and "takes NO value" in out,
          (out.strip().splitlines() or [""])[0][:110])
    rc, out, _ = run("--voices", "score", "cat", "--", "hat")
    check("and the flag itself still works, unchanged",
          rc == 0 and "RHYME" in out)
    rc, out, _ = run("schme", "ABAB")
    check("an unknown VERB refuses at exit 2 too — it used to print one "
          "line and return success",
          rc == 2 and "unknown command" in out,
          (out.strip().splitlines() or [""])[0][:110])


def test_the_profile_lookup_raises_at_the_library_too():
    """17. THE CLI WAS ONE SURFACE OF THE PROFILE HOLE; THIS IS THE HOLE.

    `PROFILES["full"] is None` and `PROFILES.get(profile)` meant ANY caller
    reaching `score`/`best_score`/`check_scheme`/`rhyme_graph` with a
    `profile=` string the table does not have got the DEFAULT channel weights
    and no signal of any kind — `quality/revise.py`, `quality/loop.py` and
    `quality/test_band.py` all thread that parameter through. Fixing the flag
    without fixing the lookup would leave the identical defect one import
    away.
    """
    print("\n17. the profile lookup RAISES, and the default is a named "
          "sentinel rather than None")
    check("the default is an explicit sentinel, not None — that is what "
          "made `full` and an unknown name the same value",
          lh.PROFILES["full"] is lh.DECLARATION_CHANNELS
          and lh.PROFILES["full"] is not None,
          repr(lh.PROFILES["full"]))
    check("and it is FALSY and answers .get like an empty mapping, so every "
          "`if prof:` guard in score() reads as it did under None",
          not lh.PROFILES["full"]
          and lh.PROFILES["full"].get("require_final_consonant") is None
          and lh.PROFILES["full"].get("weights", {}) == {})
    check("an undeclared name RAISES UnknownProfile, naming the vocabulary",
          _raises_unknown_profile(lambda: lh.channel_profile("bogus")))
    check("UnknownProfile is a ValueError, so the CLI's one refusal handler "
          "already catches it rather than needing a second",
          issubclass(lh.UnknownProfile, ValueError))
    check("None and 'full' both mean the Declaration's own weights, and "
          "neither is the same as a name nobody declared",
          lh.channel_profile(None) is lh.DECLARATION_CHANNELS
          and lh.channel_profile("full") is lh.DECLARATION_CHANNELS)

    decl, lex = lh.Declaration(), lh.Lexicon()
    check("check_scheme raises on it BEFORE reading an anchor",
          _raises_unknown_profile(
              lambda: lh.check_scheme(lex, ["dawn", "again"], "AA", decl,
                                      profile="bogus")))
    check("rhyme_graph raises on it too — the graph is the primary object, "
          "so which comparator built it is not substitutable (doctrine 2)",
          _raises_unknown_profile(
              lambda: lh.rhyme_graph(lex, ["dawn", "again"], decl,
                                     profile="bogus")))
    check("a declared profile still reaches the weights — the fix refuses "
          "the unknown name and changes nothing about the known ones",
          lh.check_scheme(lex, ["dawn", "silt"], "AA", decl,
                          profile="assonance")["pair_scores"][0]["score"]
          != lh.check_scheme(lex, ["dawn", "silt"], "AA", decl,
                             profile="full")["pair_scores"][0]["score"])


def _raises_unknown_profile(fn):
    try:
        fn()
    except lh.UnknownProfile:
        return True
    return False


_M44 = {"beats": 4, "unit": 4, "groups": [2, 2]}
_VERSE = ("the door was numbered plainly on the frame",
          "the window carried nothing but the cold",
          "a stairwell climbed to nowhere anyone could name",
          "the hallway kept a story never told")
_CHORUS = ("we kept the ledger open every day",
           "we checked the sum again into the night",
           "and every debt was counted once again",
           "we held the number up against the light")
_BRIDGE = ("a bicycle leaned rusting by the gate",
           "a kettle whistled somewhere out of sight")


def _vcbc_blueprint(second="chorus", lopsided=False):
    """verse / chorus / bridge / chorus, with BOTH choruses called `chorus`.

    `lopsided` MOVES one line from the second chorus into the first rather
    than deleting it: the draft's total stays 14, so `_meter_findings`'
    correlate-by-position length check still passes and what is left is a
    genuine PER-SECTION disagreement for the STRUCTURE cross-check to find.
    """
    def sec(n, bars, start, fn):
        return {"name": n, "bars": bars, "start_bar": start,
                "meter": dict(_M44), "function": fn}

    def lines(texts, start, owner):
        return [{"text": t, "bar": start + 2 * k, "beat": 1, "duration": 8,
                 "section": owner} for k, t in enumerate(texts)]

    ls = (lines(_VERSE, 1, "verse1") + lines(_CHORUS, 9, "chorus")
          + lines(_BRIDGE, 17, "bridge") + lines(_CHORUS, 23, second))
    if lopsided:
        ls[13] = dict(ls[13], bar=16, section="chorus")
    return {"title": "Ledger", "hooks": [_CHORUS[0]],
            "sections": [sec("verse1", 8, 1, "verse"),
                         sec("chorus", 8, 9, "chorus"),
                         sec("bridge", 6, 17, "bridge"),
                         sec(second, 8, 23, "chorus")],
            "lines": ls}


def _vcbc_lyric(second="chorus"):
    out = []
    for hdr, ls in (("verse1", _VERSE), ("chorus", _CHORUS),
                    ("bridge", _BRIDGE), (second, _CHORUS)):
        out.append(f"[{hdr}]")
        out.extend(ls)
        out.append("")
    return "\n".join(out) + "\n"


def _no_apparatus(text):
    """The report with the run's own echo of its arguments removed."""
    drop = ("BLUEPRINT:", "DECLARED", "HANDED IN", "STRUCTURE:")
    return "\n".join(l for l in text.splitlines()
                     if not any(w in l for w in drop))


def test_song_does_not_invent_a_structure_defect_on_a_repeated_name():
    print("\n18. `song` — two sections may share a name, and "
          "verse/chorus/bridge/chorus is the commonest form there is")
    # ONE CAUSE, TWO REPORTED DEFECTS, TEN FINDINGS, on a real song. `song`'s
    # own STRUCTURE cross-check counted `[l for l in song.lines if l.section
    # == s.name]`, so with two sections called `chorus` EACH entry counted
    # BOTH choruses' lines and `chorus: 4 lyric line(s), blueprint places 8`
    # printed TWICE -- a cross-check inventing a defect in a blueprint that
    # was right. `quality/fit.py`'s `overlap_findings` bucketed on the same
    # name while `Placement.start` is section-RELATIVE, so all EIGHT chorus
    # lines were reported as sharing pulses with their own return fourteen
    # bars later -- against that function's own docstring, which says lines
    # are compared WITHIN a section and never across one. Renaming the second
    # section cleared all ten and changed nothing else, which is what proved
    # this was the KEY and not the model.
    #
    # NOT FINDABLE BY §7 ABOVE, which runs every verb without a traceback:
    # nothing here raises, exits non-zero, or looks wrong to a rc check. The
    # verb answers, fluently, about a song that has no such defect.
    d = tempfile.mkdtemp()
    paths = {}
    for tag, second in (("dup", "chorus"), ("uniq", "chorus 2")):
        bp = os.path.join(d, f"{tag}.blueprint.json")
        tx = os.path.join(d, f"{tag}.txt")
        with open(bp, "w") as fh:
            json.dump(_vcbc_blueprint(second), fh)
        with open(tx, "w") as fh:
            fh.write(_vcbc_lyric(second))
        paths[tag] = (bp, tx)

    mand = "ABABCDCDEFCDCD"
    # `song` ANSWERED is 0 OR 3 since §16 landed — 3 when a flag stands,
    # which this fixture's mandate deliberately makes it do (12 per-line
    # FLAGs: 5 SCHEME_VIOLATION and a 4-line REPEAT_IN_VERSE). This
    # section's subject is the STRUCTURE cross-check, and its `rc == 0` was
    # standing in for "did not crash or refuse". That meaning is `in (0, 3)`
    # now, and it is NOT weaker where it matters: 1 (a traceback) and 2 (a
    # refusal) still fail, which is the whole discrimination the line was
    # making. Widened rather than pinned to 3 so the assertion keeps holding
    # if the fixture's mandate is ever made to hold.
    ANSWERED = (0, 3)
    rc, out, err = run("song", *paths["dup"], mand, "--subdivision", "4")
    struct = [l.strip() for l in out.splitlines() if "STRUCTURE:" in l]
    over = [l for l in out.splitlines() if "OVERLAPPING_SPANS" in l]
    check("`song` runs on a blueprint with two sections named `chorus`",
          rc in ANSWERED and "Traceback" not in err,
          (err.strip().splitlines() or [f"(clean, rc {rc})"])[-1][:110])
    check("the STRUCTURE cross-check reports NOTHING — the lyric and the "
          "blueprint agree, and they did before too",
          not struct, f"{len(struct)}: {struct}")
    check("...and specifically not the doubled count, which it printed TWICE",
          not [l for l in struct if "blueprint places 8" in l])
    check("no chorus line overlaps its own return — EIGHT OVERLAPPING_SPANS "
          "came out of this file, one per chorus line",
          not over, f"{len(over)} OVERLAPPING_SPANS")

    # THE CONTROL. The identical song with the second chorus renamed was
    # always clean; the two runs must now be one run.
    rc2, out2, _e = run("song", *paths["uniq"], mand, "--subdivision", "4")
    check("renaming the second section changes NOTHING in the report — the "
          "control that turns this from an argument into a measurement",
          rc2 == rc and _no_apparatus(out) == _no_apparatus(out2),
          f"rc {rc} vs {rc2}")

    # AND THE CROSS-CHECK IS NOT SILENCED, which is how a fix like this goes
    # wrong: a counter that reports nothing is not a counter that is right.
    # One line MOVED from the second chorus into the first, in the blueprint
    # only -- 5 and 3 against the lyric's 4 and 4.
    bp3 = os.path.join(d, "lopsided.blueprint.json")
    with open(bp3, "w") as fh:
        json.dump(_vcbc_blueprint("chorus", lopsided=True), fh)
    rc3, out3, _e3 = run("song", bp3, paths["dup"][1], mand,
                         "--subdivision", "4")
    hit = [l.strip() for l in out3.splitlines()
           if "STRUCTURE:" in l and "lyric line(s)" in l]
    check("a REAL per-instance mismatch is still reported, and the two "
          "same-named choruses are told apart — 5 against one and 3 against "
          "the other, where a name-keyed count says 8 for both",
          rc3 in ANSWERED
          and hit == ["STRUCTURE: chorus: 4 lyric line(s), blueprint places 5",
                      "STRUCTURE: chorus: 4 lyric line(s), blueprint places 3"],
          f"rc {rc3}: {hit}")


#: 16 lines, 4/4 throughout, and a grid so tight that EVERY line overflows
#: it. Constructed (doctrine 94): the point is the saturated case, which no
#: shipped fixture produces, and a rollup rule can only be tested on a draft
#: that actually saturates. The words are ordinary enough to also carry three
#: A FAILING MANDATE is declared over it at the call site (`--groups=1,3;2,4`
#: — store/own and four/gone), so the draft carries BOTH kinds of flag at
#: once: a saturated one that rolls up and two that do not. That contrast is
#: the whole subject of §15, and it has to be built in rather than hoped for.
#: It used to lean on `REPEAT_IN_VERSE` from a verbatim chorus, which
#: `d362b9e` correctly recalibrated into a licensed radif NOTE — the fixture
#: had been resting on a threshold, not on a fact.
NOISY_LINES = [
    "The bank foreclosed and boarded up the store",
    "the freight train left the siding after four",
    "we packed the truck with everything we own",
    "and drove until the radio was gone",
    "the well is running dry and so am I",
    "the well is running dry and so am I",
    "The neighbors moved to Houston in the fall",
    "they left a mattress leaning on the wall",
    "we watched the county auction off the fire",
    "and every bidder set the price on fire",
    "nobody here is waiting for a sign",
    "nobody here is standing in a line",
    "the water table dropped below the town",
    "the water table dropped and let us down",
    "the well is running dry and so am I",
    "the well is running dry and so am I",
]
NOISY_SECTIONS = [("verse1", 4), ("chorus", 2), ("verse2", 4),
                  ("bridge", 4), ("chorus2", 2)]

#: four/own and gone/fire — two mandated pairs that stand in NO schema, so
#: the draft carries two SCHEME_VIOLATION flags on named lines beside the
#: saturated SLOTS_EXCEEDED. One rolls up, the others must not.
#: REPINNED 2026-08-25 (M-116) from ~~1,3;2,4~~ (store/own and four/gone):
#: under the whole-vocabulary default store~own is SATISFIED by 'chain rhyme
#: (rap)' and four~gone by 'assonance', so the old mandate stopped failing
#: at all. These two pairs are MEASURED unsatisfied over the full 16-line
#: fixture (relations.whole_vocabulary_pairs), so the mandate fails for the
#: same reason it always did — the pairs do not stand in any relation the
#: vocabulary names — rather than by grace of a narrower door.
MANDATE_THAT_FAILS = "--groups=2,3;4,9"


def _noisy_song(d):
    """-> (blueprint path, lyric path) for the saturated 16-line case."""
    lyric, i = [], 0
    sections, bar = [], 1
    for name, n in NOISY_SECTIONS:
        lyric.append(f"[{name}]")
        lyric.extend(NOISY_LINES[i:i + n])
        lyric.append("")
        sections.append({"name": name, "bars": n, "start_bar": bar,
                         "function": ("chorus" if name.startswith("chorus")
                                      else name.rstrip("12")),
                         "meter": {"beats": 4, "unit": 4, "groups": [2, 2]}})
        i += n
        bar += n
    bp = {"title": "The well is running dry",
          "hooks": ["the well is running dry"], "sections": sections,
          "lines": [{"text": t, "bar": n + 1, "beat": 1, "duration": 4,
                     "section": [s["name"] for s in sections
                                 if s["start_bar"] <= n + 1
                                 < s["start_bar"] + s["bars"]][0]}
                    for n, t in enumerate(NOISY_LINES)]}
    bpp = os.path.join(d, "noisy.blueprint.json")
    txt = os.path.join(d, "noisy.txt")
    with open(bpp, "w") as fh:
        json.dump(bp, fh)
    with open(txt, "w") as fh:
        fh.write("\n".join(lyric) + "\n")
    return bpp, txt


def test_the_report_rolls_up_without_dropping_anything():
    print("\n15. the report — 48 findings that were ONE FACT, rolled up, and "
          "the count unmoved (FIXED 2026-08-14)")
    # MEASURED BOTH WAYS on this fixture at `--subdivision 1`, same command,
    # against the branch point: 226 lines of output and 96 printed finding
    # blocks before, 132 and 39 after. 48 of those findings were ONE FACT
    # (the declared grid is too tight) stated three ways on every line --
    # SLOTS_EXCEEDED x16, CROWDED x16, PROMINENCE_EXCEEDS_HEADS x16. The
    # per-code counts are IDENTICAL on both sides, all 18 codes of them,
    # which is the invariant this section exists to hold: 18 FLAG + 78 NOTE
    # before, 18 FLAG + 78 NOTE after. What moved is the reading order --
    # 18 flag decisions scattered from output line 7 became 3 in one block
    # at line 16.
    #
    # WHAT IS PINNED IS THE INVARIANT, NOT THE PRETTINESS: a rollup that
    # loses a finding is worse than the noise it replaces, so the per-code
    # counts before and after must be IDENTICAL, and they are checked by
    # re-deriving them from the rendered output rather than from the object
    # the renderer was handed.
    #
    # THE ARITHMETIC IS ALSO TESTED DIRECTLY. `rollup_findings` and
    # `line_range` are module-level and pure for this reason: a rendering
    # rule that can only be checked by parsing stdout is a rule nobody
    # checks, and the threshold it keys on is a declared constant rather
    # than a number nobody wrote down (doctrine 58).
    class _F:
        def __init__(self, code, severity, message="m", evidence="e",
                     locations=()):
            self.code, self.severity = code, severity
            self.message, self.evidence = message, evidence
            self.locations = list(locations)

        def __str__(self):
            # `quality/floor.py`'s own `Finding.__str__`, which is what
            # `rollup_findings` compares -- message, LOCATIONS and EVIDENCE.
            # A stub that dropped the evidence would make every per-pair
            # finding look identical and this section would pass on a rule
            # it never tested.
            loc = (f" (lines {', '.join(map(str, self.locations))})"
                   if self.locations else "")
            return (f"[{self.severity.upper():4}] {self.code}: "
                    f"{self.message}{loc}\n         {self.evidence}")

    class _B:
        def __init__(self, line_no, findings):
            self.line_no, self.findings = line_no, findings

    every = [_B(i, [_F("WIDE", "flag", evidence=f"{i} of 4")])
             for i in range(1, 17)]
    groups, rolled = lh.rollup_findings(every)
    check("a code on every briefed line is SATURATED",
          rolled.get(("WIDE", "flag")) == "saturated", str(rolled))
    check("and it carries its own count, not a summed one",
          len(groups[("WIDE", "flag")]) == 16)

    # 80%, and the boundary is checked on both sides rather than asserted.
    part = [_B(i, [_F("WIDE", "flag")]) for i in range(1, 14)] + \
           [_B(i, [_F("OTHER", "note")]) for i in range(14, 17)]
    _g, r2 = lh.rollup_findings(part)
    check("13 of 16 (81%) still saturates; the threshold is a declared "
          "constant, not a guess",
          r2.get(("WIDE", "flag")) == "saturated"
          and lh.ROLLUP_SATURATION == 0.80, str(r2))
    half = [_B(i, [_F("HALF", "note", evidence=f"pair {i}")])
            for i in range(1, 9)] + \
           [_B(i, [_F("X", "note")]) for i in range(9, 17)]
    _g, r3 = lh.rollup_findings(half)
    check("8 of 16 (50%) with DIFFERENT text on each line does NOT roll up "
          "— a per-pair code names different words every time",
          ("HALF", "note") not in r3, str(r3))
    same = [_B(i, [_F("SAME", "note", evidence="one rate")])
            for i in range(1, 9)] + \
           [_B(i, [_F("X", "note")]) for i in range(9, 17)]
    _g, r4 = lh.rollup_findings(same)
    check("8 of 16 with BYTE-IDENTICAL text DOES — that is one measurement "
          "fanned out (ANAPHORA_OVERLOAD's shape), not eight",
          r4.get(("SAME", "note")) == "identical", str(r4))
    small = [_B(i, [_F("TINY", "flag")]) for i in range(1, 4)]
    _g, r5 = lh.rollup_findings(small)
    check(f"below ROLLUP_MIN_LINES ({lh.ROLLUP_MIN_LINES}) nothing rolls up "
          "— a quatrain renders exactly as it did before this existed",
          not r5, str(r5))
    check("the line range is contiguous where it can be and NEVER elided",
          lh.line_range([1, 2, 3, 4]) == "L1-L4"
          and lh.line_range([1, 3, 7]) == "L1, L3, L7",
          f"{lh.line_range([1, 2, 3, 4])} / {lh.line_range([1, 3, 7])}")

    # AND THE SAME THING END TO END, through the verb.
    d = tempfile.mkdtemp()
    bpp, txt = _noisy_song(d)
    rc, out, err = run("song", bpp, txt, MANDATE_THAT_FAILS,
                       "--subdivision", "1")
    check("the fixture really does saturate, or this section tests nothing",
          "SLOTS_EXCEEDED  x16" in out and "CROWDED  x16" in out
          and "PROMINENCE_EXCEEDS_HEADS  x16" in out,
          out[:200] if "Traceback" not in err else err[-300:])
    per_code = {}
    for m in re.finditer(r"FINDING \[(FLAG|NOTE)\s*\] ([A-Z_]+)", out):
        per_code[m.group(1, 2)] = per_code.get(m.group(1, 2), 0) + 1
    for m in re.finditer(r"^\s*\[(FLAG|NOTE)\s*\] ([A-Z_]+)\s+x(\d+) on ",
                         out, re.M):
        per_code[m.group(1, 2)] = per_code.get(m.group(1, 2), 0) \
            + int(m.group(3))
    check("NOTHING IS DROPPED: the rendered report still accounts for all "
          "three saturated codes at x16 apiece",
          per_code.get(("FLAG", "SLOTS_EXCEEDED")) == 16
          and per_code.get(("NOTE", "CROWDED")) == 16
          and per_code.get(("NOTE", "PROMINENCE_EXCEEDS_HEADS")) == 16,
          str(sorted(per_code.items())))
    # ~~two~~ ~~ONE, REPINNED 2026-08-22~~ TWO AGAIN, REPINNED 2026-08-25.
    # The 2026-08-22 repin recorded the widened admit set (M-59) retiring
    # one of the fixture's two violations; the M-116 whole-vocabulary
    # default then retired the OTHER, and the mandate above was repinned
    # onto two pairs that stand in no schema at all — so the fixture
    # carries two violations once more, for the original reason. What this
    # check is about is unchanged: whether an UNSATURATED code survives the
    # collapse of 48 findings into 3 rows. Pinned at >= 1 rather than at
    # the count so the next movement in the comparator does not re-break a
    # check whose subject is the ROLLUP.
    check("the SCHEME_VIOLATION flag survives the rollup — it is the craft "
          "criticism the 48 were burying, and it is NOT saturated, so the "
          "rule had to leave it alone",
          (per_code.get(("FLAG", "SCHEME_VIOLATION")) or 0) >= 1,
          str(per_code.get(("FLAG", "SCHEME_VIOLATION"))))
    check("the counts are printed as TWO, by kind, and never summed "
          "(doctrine 79/91)",
          re.search(r"REPORT: 16 line\(s\) briefed — \d+ FLAG, \d+ NOTE",
                    out) is not None,
          [l for l in out.splitlines() if "REPORT:" in l][:1])
    check("the rollup declares the threshold it keyed on rather than "
          "applying a number nobody wrote down (doctrine 58)",
          "ROLLUP RULE (declared: lyric_harness.ROLLUP_SATURATION" in out)
    # THE LEAD. The whole complaint was that the actionable findings were
    # buried under correct, long evidence paragraphs.
    idx = [i for i, l in enumerate(out.splitlines())
           if l.startswith("  WHAT TO CHANGE")]
    ev = [i for i, l in enumerate(out.splitlines())
          if l.startswith("  THE EVIDENCE")]
    check("the flag inventory leads and the evidence follows it",
          idx and ev and idx[0] < ev[0], f"WHAT TO CHANGE {idx}, EVIDENCE {ev}")
    check("a saturated flag is ONE decision in that inventory, not sixteen "
          "— a grid too tight for every line is one thing to change",
          re.search(r"\d+\. SLOTS_EXCEEDED — L1-L16 \(x16, rolled up above\)",
                    out) is not None,
          "\n".join(out.splitlines()[idx[0]:ev[0]]) if idx and ev else "")
    check("`brief` shares the identical report — one format, not two that "
          "drift (this is the same `_print_brief_report`)",
          "WHAT TO CHANGE" in run("brief", txt, MANDATE_THAT_FAILS,
                                  f"--blueprint={bpp}",
                                  "--subdivision", "1")[1])


def test_song_exits_on_a_flag():
    print("\n16. `song` — a FLAG is not a refusal and it is not a pass "
          "(FIXED 2026-08-14)")
    # THE DEFECT: `song` printed 18 FLAG findings on 16 lines and exited 0,
    # so nothing in a pipeline could gate on it. THE ARGUMENT for a third
    # code rather than reusing 2: every verb in this file already exits 2 for
    # exactly one thing -- THE HARNESS DID NOT ANSWER (`NoMandate` §6, a
    # blueprint/draft mismatch §13, `candidates` on an unreadable word §10,
    # `--fallback=bogus` §9). A flag is the harness ANSWERING. Charging it to
    # 2 would make "sixteen lines overflow their bars" indistinguishable from
    # "no mandate was declared", which is doctrine 20's own collapse run
    # backwards. 1 is unavailable because an uncaught exception is Python's
    # own 1 and a gate reading 1 as "flags found" would pass a crash.
    d = tempfile.mkdtemp()
    bpp, txt = _noisy_song(d)
    rc, out, err = run("song", bpp, txt, MANDATE_THAT_FAILS,
                       "--subdivision", "1", expect_rc=3)
    check("flags present -> exit 3, so a pipeline can gate on the "
          "whole-song verb", rc == 3, f"rc={rc}")
    check("and it SAYS which code it took and why, rather than leaving a "
          "caller to look 3 up",
          "EXIT 3 —" in out and "Not a refusal" in out,
          [l for l in out.splitlines() if "EXIT 3" in l][:1])
    check("no traceback — the exit is a decision, not an escape",
          "Traceback" not in err)

    # NOTES NEVER MOVE IT, and this is the case that proves it rather than
    # asserting it: 8 NOTE findings, 0 FLAG, exit 0. Doctrine 6 -- a
    # convention a writer is free to depart from cannot be the thing that
    # fails a check.
    # THE HOOK NOW RECURS, AND THAT IS A RULING RATHER THAN A REPAIR. This
    # fixture was ONE `verse` section declaring a hook, so the hook occurred
    # once — and `HOOK_DOES_NOT_RECUR` became a FLAG on 2026-08-23 by the
    # owner's ruling (`MISSING.md` M-84). The draft therefore exited 3 on a
    # WHOLE-DRAFT flag and this section's subject — notes alone never move
    # the code — could not be stated on it. Two `chorus` sections carrying
    # the hook is the smallest shape that declares a hook AND satisfies the
    # ruling, so the layer is still exercised rather than switched off by
    # dropping the declaration. 0 FLAG, 8 NOTE, exit 0.
    quat = os.path.join(d, "q.txt")
    with open(quat, "w") as fh:
        fh.write("The river took the bridge at dawn\n"
                 "and no one saw the water again\n"
                 "the river rose above the silt\n"
                 "past every fence the county rebuilt\n")
    qbp = os.path.join(d, "q.blueprint.json")
    with open(qbp, "w") as fh:
        json.dump({"title": "The river", "hooks": ["the river"],
                   "sections": [{"name": "a", "bars": 2, "start_bar": 1,
                                 "function": "chorus",
                                 "meter": {"beats": 4, "unit": 4,
                                           "groups": [2, 2]}},
                                {"name": "b", "bars": 2, "start_bar": 3,
                                 "function": "chorus",
                                 "meter": {"beats": 4, "unit": 4,
                                           "groups": [2, 2]}}],
                   "lines": [{"text": t, "bar": i + 1, "beat": 1,
                              "duration": 4,
                              "section": "a" if i < 2 else "b"}
                             for i, t in enumerate(open(quat).read()
                                                   .splitlines())]}, fh)
    rc0, out0, _ = run("song", qbp, quat, "--groups=3,4", expect_rc=0)
    check("a draft with NOTES and no flag exits 0 — a note is a measurement "
          "handed back, never a defect (doctrine 6/79)",
          rc0 == 0 and "0 FLAG" in out0 and " NOTE" in out0,
          [l for l in out0.splitlines() if "REPORT:" in l][:1])
    check("the refusal code is untouched: no mandate is still 2, and it is "
          "still the FIRST thing printed",
          run("song", qbp, quat)[0] == 2)

    # THE RENDERING MAY NOT MOVE THE VERDICT. The rollup collapses 48 of the
    # findings into 3 rows on the run above, so 18 FLAGS reach the reader as
    # 3 decisions; the exit code is computed from the finding SET before any
    # of that runs, so it is the same 3 either way (doctrine 91).
    # ~~18~~ 17 FLAG, REPINNED 2026-08-22, same cause as the rollup check
    # above: one ASSONANCE pair stopped being a violation when the default
    # admit set widened. THE FLAG COUNT IS NOT WHAT THIS CHECKS — the subject
    # is that the EXIT CODE is computed from the finding set and not from the
    # rendered blocks, so it is read out of the report line rather than
    # written into the assertion, and the invariant asserted is the one that
    # matters: many flags, few printed decisions, still exit 3.
    # AND THE DECISION COUNT IS READ TOO, 2026-08-23. The flag count was
    # already read out of the report — for exactly the reason given above —
    # while `"3 decision(s)" in out` stayed a literal beside it, so half of
    # this check was door-proof and half was not. It is 2 now: the check
    # immediately above this one was repinned ~~two~~ -> ONE on 2026-08-22
    # for the same widened admit set, and the pair of literals moved
    # together in the report and separately in the file.
    #
    # NEITHER NUMBER IS THE SUBJECT. The claim is the INEQUALITY plus the
    # exit code: many findings, few printed decisions, and an exit computed
    # from the finding SET before any rendering runs (doctrine 91). Both
    # sides are read, so a door change moves the numbers and cannot move
    # the claim.
    _flags = re.search(r"REPORT:.*?— (\d+) FLAG", out)
    _dec = re.search(r"WHAT TO CHANGE — (\d+) decision\(s\)", out)
    check("the exit code counts FINDINGS, not printed blocks — "
          f"{_flags.group(1) if _flags else '?'} flags over "
          f"{_dec.group(1) if _dec else '?'} printed decisions is still "
          "exit 3",
          _flags is not None and _dec is not None
          and int(_flags.group(1)) > int(_dec.group(1)) > 0
          and rc == 3,
          [l for l in out.splitlines()
           if "REPORT:" in l or "WHAT TO CHANGE" in l][:2])

    # SCOPED TO `song`, DELIBERATELY. `brief` is the interactive "what do I
    # fix next" verb; every useful run of it has flags, and four cases in
    # this file assert its exit 0. A gate wants the whole-song verb.
    check("`brief` on the SAME flagged draft still exits 0 — the change is "
          "scoped to the verb a pipeline gates on",
          run("brief", txt, MANDATE_THAT_FAILS, f"--blueprint={bpp}",
              "--subdivision", "1")[0] == 0)


def test_propose_selects_who_writes_the_line():
    print("\n17. `revise --propose=stub|replay:PATH|call:MODULE:FACTORY` — "
          "who writes the line, declared (BUILT 2026-08-14)")
    # `revise_loop` has taken `propose=`/`propose_group=` since it was
    # written and nothing on this command line could hand it one, so the only
    # reachable proposer was `default_propose` -- a single-word splice that
    # produces "waded through the on". Same built-and-tested-was-not-the-
    # reachable shape as `--blueprint` and `--fallback`, one layer further in.
    #
    # AND THE THIRD SPELLING NAMES NOTHING. `call:MODULE:FACTORY` is a
    # CALLER-DECLARED coordinate with no default and no fallback module, the
    # same shape `--subdivision` is: this repo's first page says the model
    # proposes and these tools grade, so the proposing half is not this
    # repo's to ship and this file may not pick one by omission. What is
    # tested here is therefore the CONTRACT and the REFUSALS -- every way the
    # declared seam can fail to be met, each one printed and exit 2.
    d = tempfile.mkdtemp()
    quat = os.path.join(d, "q.txt")
    # L3 REPINNED 2026-08-25 (M-116): it read "the cattle waded through the
    # silt", and under the whole-vocabulary default that pair with L1 is
    # SATISFIED — 'anaphora' (both heads are "the") and 'chain rhyme (rap)'
    # ("the bridge" ~ "the silt", a shared AH-IH nucleus run) — so the loop
    # never asked about L3 and every proposer check below went vacuous. This
    # spelling is MEASURED to stand in no schema against L1
    # (relations.whole_vocabulary_pairs), so the pair is refused on the
    # scalar and L3 is asked, which is the premise of the whole section.
    with open(quat, "w") as fh:
        fh.write("The river took the bridge at dawn\n"
                 "and no one saw the water again\n"
                 "our cattle waded knee deep in silt\n"
                 "past every fence the county rebuilt\n")

    # THE DEFAULT IS THE STUB AND IT MUST STAY THE STUB. A default that
    # reaches out of the process is not a default: THIS FILE runs `revise`
    # (§7), in CI.
    # rc 3 SINCE 2026-08-17: mandatory pursuit holds this fixture's modal
    # residue open past what the stub can clear, and a loop that gives up
    # with a pursued line standing exits 3 — success below 100% became
    # unreportable (loop.MANDATORY_PURSUE). The subject here is the PROPOSER
    # DISCLOSURE, which is unchanged.
    # rc 0 SINCE 2026-09-01 (M-185): the offered words are screened from
    # THEIR side, so the stub's splice no longer takes a word that files
    # MODAL_RHYME back at the call, and the loop converges — `SUCCESS after
    # 1 round(s), fixed L3, L4` (repinned 2026-09-02). The subject is still
    # the disclosure; the exit is pinned so the next move is seen.
    rc, out, err = run("revise", quat, "ABAB", expect_rc=0)
    check("with no --propose at all, the stub runs and SAYS it is the stub",
          rc == 0 and "PROPOSER: stub (the default)" in out,
          [l for l in out.splitlines() if "PROPOSER" in l][:1])
    check("and says out loud that nothing outside the process was reached",
          "Nothing outside this process was reached" in out)
    check("--propose=stub is the same run, spelled",
          "PROPOSER: stub (the default)" in run("revise", quat, "ABAB",
                                                "--propose=stub")[1])

    # THE REFUSALS, all of them `--fallback=bogus`'s shape: printed, named,
    # exit 2, no traceback, no silent downgrade.
    rc, out, err = run("revise", quat, "ABAB", "--propose=bogus", expect_rc=2)
    check("an undeclared value REFUSES with exit 2 and names the vocabulary",
          # EVERY spelling, not a prefix of them: this assertion caught the
          # `defer:PATH` build growing the vocabulary and leaving the refusal
          # naming three of four, which is the shape a reader trusts and
          # cannot check.
          rc == 2 and ("'stub', 'replay:PATH', 'defer:PATH' or "
                       "'call:MODULE:FACTORY'") in out
          and "Traceback" not in err, out.strip().splitlines()[-2:][:1])
    rc, out, _ = run("revise", quat, "ABAB", "--propose", "stub", expect_rc=2)
    check("the space-separated spelling REFUSES rather than swallowing the "
          "value and leaving the default running (`--fallback`'s reason)",
          rc == 2 and "wants the `=` spelling" in out,
          out.strip().splitlines()[:1])
    for verb, argv in (("brief", ["brief", quat, "ABAB"]),
                       ("verify", ["verify", quat, quat, "ABAB"]),
                       ("song", ["song", EXAMPLE_BP, EXAMPLE_TXT, "ABAB"])):
        rc, out, _ = run(*argv, "--propose=call:x:y", expect_rc=2)
        check(f"--propose on `{verb}` REFUSES instead of being a silent "
              f"no-op on a flag about who wrote the words",
              # "revise and finish" since 2026-08-28 (M-154): `finish` runs
              # the same loop, so the refusal names both loop verbs now.
              rc == 2 and "only `revise` and `finish` run a proposer" in out,
              out.strip().splitlines()[:1])

    # `replay:PATH` -- the loop driven over REAL proposed text, reaching
    # nothing outside the process, which is the only way a non-stub proposer
    # can be exercised here at all.
    rp = os.path.join(d, "replay.json")
    with open(rp, "w") as fh:
        json.dump({"propose": [
            {"line": 3, "attempt": 0,
             "text": "the cattle waded past the muddy lawn"},
            {"line": 4, "attempt": 0,
             "text": "past every fence the county left to rot"}],
            "propose_group": []}, fh)
    # rc 3 since 2026-08-17 — same fixture, same mandatory-pursuit residue.
    rc, out, err = run("revise", quat, "ABAB", f"--propose=replay:{rp}",
                       expect_rc=3)
    check("replay: drives the loop and the recorded text reaches it",
          rc == 3 and "left to rot" in out and "Traceback" not in err,
          [l for l in out.splitlines() if "L4" in l][-1:])
    check("it discloses how much of its record was CONSULTED and how much "
          "was asked for and missing — a miss is a give-up, never the stub",
          "consulted and answered" in out and "NOT recorded" in out,
          [l for l in out.splitlines() if "PROPOSER: replay" in l][-1:])
    check("doctrine 9 still holds over replayed text: the modal candidate "
          "is rejected even when a proposer proposed it",
          "modal candidate 'lawn'" in out,
          [l for l in out.splitlines() if "modal candidate" in l][:1])

    bad = os.path.join(d, "bad.json")
    with open(bad, "w") as fh:
        fh.write("{not json")
    rc, out, err = run("revise", quat, "ABAB", f"--propose=replay:{bad}",
                       expect_rc=2)
    check("an unreadable replay file REFUSES with the expected shape "
          "printed, not a JSONDecodeError traceback",
          rc == 2 and "not readable as JSON" in out
          and "Traceback" not in err, out.strip().splitlines()[:1])
    empty = os.path.join(d, "empty.json")
    with open(empty, "w") as fh:
        json.dump({"propose": [], "propose_group": []}, fh)
    rc, out, _ = run("revise", quat, "ABAB", f"--propose=replay:{empty}",
                     expect_rc=2)
    check("a replay recording NOTHING refuses rather than reporting the "
          "loop's verdict on a draft no proposal touched (doctrine 20)",
          rc == 2 and "the file parses and records" in out,
          [l for l in out.splitlines() if "REFUSED" in l][:1])
    rc, out, _ = run("revise", quat, "ABAB",
                     f"--propose=replay:{os.path.join(d, 'nope.json')}",
                     expect_rc=2)
    check("a missing replay file refuses by name",
          rc == 2 and "No such file" in out, out.strip().splitlines()[:1])

    # `call:MODULE:FACTORY` — THE DECLARED SEAM. Every case below runs
    # entirely inside this process: the "adapter" is a module this test
    # WRITES, whose factory returns a pure function. That is the point of the
    # spelling — the harness imports what it is told, so what it is told can
    # be something with no outside world in it at all.
    rc, out, _ = run("revise", quat, "ABAB", "--propose=call:", expect_rc=2)
    check("a half-declared seam REFUSES rather than being completed with a "
          "default module — this file may not pick a proposer by omission",
          rc == 2 and "MODULE and FACTORY are both required" in out,
          [l for l in out.splitlines() if "REFUSED" in l][:1])
    rc, out, _ = run("revise", quat, "ABAB", "--propose=call:only_a_module",
                     expect_rc=2)
    check("and so does a MODULE with no FACTORY",
          rc == 2 and "MODULE and FACTORY are both required" in out,
          [l for l in out.splitlines() if "REFUSED" in l][:1])
    rc, out, err = run("revise", quat, "ABAB",
                       "--propose=call:no_such_module_anywhere:make",
                       expect_rc=2)
    check("an unimportable declared MODULE refuses BY THE NAME THE CALLER "
          "TYPED, and nothing is substituted for it",
          rc == 2 and "no_such_module_anywhere" in out
          and "not importable" in out and "Traceback" not in err,
          [l for l in out.splitlines() if "REFUSED" in l][:1])

    # A module this test writes, with four attributes: a good factory, one
    # that is not callable, one that needs an argument, and one whose result
    # is not callable. `PYTHONPATH` puts it on the path -- the harness itself
    # adds nothing and searches nowhere.
    adapter = os.path.join(d, "scratch_adapter.py")
    with open(adapter, "w") as fh:
        fh.write("def make_call():\n"
                 "    def call(prompt):\n"
                 "        return 'the cattle waded past the muddy lawn'\n"
                 "    return call\n"
                 "not_callable = 3\n"
                 "def needs_an_arg(x):\n"
                 "    return x\n"
                 "def returns_a_string():\n"
                 "    return 'not a callable'\n"
                 "class Nested:\n"
                 "    @staticmethod\n"
                 "    def make():\n"
                 "        return lambda prompt: 'x'\n")
    envp = {"PYTHONPATH": d}
    for attr, why, phrase in (
            ("no_such_attr", "a FACTORY the module does not have",
             "has no"),
            ("not_callable", "a FACTORY that is not callable at all",
             "not callable"),
            ("needs_an_arg", "a FACTORY that will not take a no-argument "
                             "call", "no-argument call"),
            ("returns_a_string", "a FACTORY whose RESULT is not the "
                                 "callable(prompt) -> str", "not a callable")):
        rc, out, err = run("revise", quat, "ABAB",
                           f"--propose=call:scratch_adapter:{attr}",
                           expect_rc=2, env=envp)
        check(f"{why} REFUSES by name at exit 2",
              rc == 2 and phrase in out and "Traceback" not in err,
              [l for l in out.splitlines() if "REFUSED" in l][:1])

    # THE FULLY SATISFIED CALLER HALF. With `quality/propose.py` absent this
    # lands on the LAST refusal in the chain, which is the proof the ordering
    # is what it claims: the caller's module was imported, its factory found,
    # invoked, and its result checked, all BEFORE this repo's own module was
    # asked for. Once that module lands, the same command runs the loop.
    landed = os.path.exists(os.path.join(ROOT, "quality", "propose.py"))
    rc, out, err = run("revise", quat, "ABAB",
                       "--propose=call:scratch_adapter:make_call",
                       env=envp)
    check("a fully-resolved declared seam neither raises nor invents an "
          "UNDECLARED exit code — 0, 2 and (since 2026-08-17) 3 are the "
          "declared vocabulary, and 3 is this fixture's honest verdict",
          "Traceback" not in err and rc in (0, 2, 3),
          err.strip()[-200:] if err.strip() else f"rc={rc}")
    if not landed:
        check("with quality/propose.py absent, a fully-resolved caller seam "
              "refuses on THIS repo's half — and says the caller's half was "
              "fine, which is the ordering claim",
              rc == 2 and "quality/propose.py is not importable" in out
              and "the declared FACTORY resolved" in out,
              [l for l in out.splitlines() if "REFUSED" in l][:1])
        check("and it states that nothing on the caller's side was CALLED "
              "before refusing — the factory ran, the callable did not",
              "the callable it returned was not" in out)
    else:
        check("quality/propose.py has landed: the declared seam drives the "
              "loop end to end with a proposer written outside this repo",
              rc == 3 and "PROPOSER: call:scratch_adapter:make_call" in out,
              [l for l in out.splitlines() if "PROPOSER" in l][:1])
    rc2, out2, _ = run("revise", quat, "ABAB",
                       "--propose=call:scratch_adapter:Nested.make",
                       env=envp)
    check("a DOTTED factory path is walked rather than rejected",
          rc2 == rc and "Nested.make" in out2,
          [l for l in out2.splitlines() if "REFUSED" in l or "PROPOSER" in l][:1])

    # THE LAZY IMPORT. `quality/propose.py` is another cell's and may not
    # have landed; `stub` and `replay:` must keep working meanwhile, and a
    # top-level import would make the WHOLE CLI un-runnable until it exists.
    src = open(os.path.join(ROOT, "lyric_harness.py")).read()
    top = [n for n in ast.walk(ast.parse(src))
           if isinstance(n, (ast.Import, ast.ImportFrom)) and n.col_offset == 0]
    named = {getattr(n, "module", "") or "" for n in top} | \
            {a.name for n in top for a in n.names}
    check("the sibling module is not imported at module scope — the CLI "
          "runs with it absent, which is how it runs right now",
          not any("propose" in m for m in named),
          str(sorted(m for m in named if m)))
    check("the contract is DECLARED rather than guessed at the call site — "
          "a sibling reads PROPOSE_CONTRACT and satisfies it",
          "ModelProposer" in lh.PROPOSE_CONTRACT["quality.propose"]
          and len(lh.PROPOSE_CONTRACT) == 2,
          str(lh.PROPOSE_CONTRACT))
    # AND THIS FILE NAMES NO PROVIDER. The proposing half is the caller's;
    # a module name, an environment variable or a product name hardcoded
    # here would be this repo choosing one, which is the thing the `call:`
    # spelling exists to stop. Checked mechanically so it cannot creep back.
    check("neither lyric_harness.py nor this file hardcodes a proposer "
          "module, endpoint or credential name for --propose",
          not re.search(r"(?i)api[_-]?key|_API_KEY|endpoint\s*=",
                        src.split("def _resolve_proposer")[1]
                        .split("def _grid_song")[0]),
          "the --propose block is clean")


def test_both_mandate_spellings_are_read():
    print("\n19. a SECOND mandate spelling is READ, not dropped in silence "
          "(FIXED 2026-08-15)")
    # THE DEFECT, found by writing a song through the loop rather than by
    # reading the code. The mandate came out of ONE positional slot, so a
    # second spelling on the same command line was never looked at -- and a
    # song with rhyming verses AND a verbatim chorus needs both at once,
    # because `--groups=` cannot say "identity required" and `--returns=`
    # cannot say "these merely rhyme". That is the ordinary shape of a
    # popular song, not a corner case.
    #
    # IT FAILED TWO WAYS AND THE QUIET ONE IS WHY THIS TEST EXISTS. `song`
    # dropped the unread flag with no message at all, so a declared chorus
    # went ungraded and the report said nothing was wrong -- the reason the
    # first assertion below is a DIFFERENCE between two runs and not a
    # string match: the old code's two outputs were BYTE-IDENTICAL, which is
    # the only shape that proves a silent drop. `verify` has a trailing
    # line-number positional, so the same unread flag reached `int()` and
    # refused in the wrong layer's words (`invalid literal for int() with
    # base 10: '--returns=1'`), which is doctrine 20's "a refusal must name
    # its own cause" broken by a parser.
    d = tempfile.mkdtemp()
    bpp, txt = _noisy_song(d)
    # lines 5/6 and 15/16 of the fixture are byte-identical choruses, so
    # this is a TRUE return declaration and not a constructed one.
    rets = "--returns=5,15;6,16"

    rc_g, out_g, _ = run("song", bpp, txt, MANDATE_THAT_FAILS,
                         "--subdivision", "1")
    rc_b, out_b, _ = run("song", bpp, txt, MANDATE_THAT_FAILS, rets,
                         "--subdivision", "1")
    check("`song` with --groups= AND --returns= is not the --groups= run",
          out_g != out_b,
          "byte-identical is exactly what the defect looked like")
    check("the declared return is GRADED, not dropped",
          "REFRAIN_REPEAT" in out_b and "REFRAIN_REPEAT" not in out_g,
          f"REFRAIN_REPEAT present={'REFRAIN_REPEAT' in out_b}, "
          f"absent without the flag={'REFRAIN_REPEAT' not in out_g}")
    check("the rhyme half still fails on the same run (both kinds held at "
          "once)", rc_b == 3 and "SCHEME_VIOLATION" in out_b,
          f"rc {rc_b}")

    rc_v, out_v, _ = run("verify", txt, txt, MANDATE_THAT_FAILS, rets)
    check("`verify` takes both spellings instead of meeting one at int()",
          "invalid literal for int()" not in out_v and rc_v != 1,
          f"rc {rc_v}")
    rc_t, out_t, _ = run("verify", txt, txt, MANDATE_THAT_FAILS, rets, "1,3")
    check("verify's TARGETED line list still parses behind two flags",
          "invalid literal for int()" not in out_t and rc_t != 1,
          "pulling a flag moves every positional behind it")

    # PARSES IS NOT READ, and until 2026-08-15 that was the whole of what
    # this section asserted about the trailing list. Every `verify` call in
    # this file handed the SAME path in as BEFORE and AFTER, so nothing
    # changed, so `targeted` -- which gates ONLY the "you touched a line
    # nobody asked you to" rejection -- could not fire whatever it held.
    # MEASURED: replacing the parse with `targeted = None` in
    # `lyric_harness.py` left this file at rc 0 with 0 failures. The repo's
    # signature failure one layer over, in a test: the value is parsed, and
    # nothing asserts it is used.
    #
    # A REAL REVISION, and the line it moves is deliberately OUTSIDE the
    # targeted set. Two runs of the same diff, differing only in the
    # trailing list, must reach OPPOSITE verdicts.
    after = os.path.join(d, "after.txt")
    with open(txt) as fh:
        moved = fh.read().replace("and drove until the radio was gone",
                                  "and drove until the radio was blown")
    with open(after, "w") as fh:
        fh.write(moved)
    check("the fixture for it really is a one-line difference",
          moved != open(txt).read(),
          "a no-op diff is how this assertion was vacuous in the first place")
    rc_free, out_free, _ = run("verify", txt, after, MANDATE_THAT_FAILS, rets)
    rc_tgt, out_tgt, _ = run("verify", txt, after, MANDATE_THAT_FAILS, rets,
                             "1,3")
    # RESTATED 2026-08-23, AND ONLY THE INCIDENTAL MOVED. This asserted
    # `"VERDICT: ACCEPTED" in out_free`, which was never the subject: the
    # subject is that the UNTARGETED rejection cannot fire when no list was
    # declared. The untargeted run is REJECTED now, for `nothing was fixed`
    # — the one-line change repaired a SCHEME_VIOLATION that the widened
    # admit set (M-59) had already retired, so there was nothing left for it
    # to fix. A different rule, firing correctly.
    #
    # ASSERTED AS THE DIFFERENCE, so it cannot be satisfied vacuously. A
    # bare `"not targeted" not in out_free` is true of empty output and of a
    # crash; what is checked is that BOTH runs reach a real verdict, that
    # ONLY the declared-list run names the untargeted rule, and (the check
    # below) that the two are not byte-identical — which together are the
    # whole claim that the trailing list is READ.
    check("with NO targeted list the untargeted rejection cannot fire — "
          "both runs reach a verdict, and only the one declaring `1,3` "
          "names the untargeted rule",
          "VERDICT:" in out_free and "VERDICT:" in out_tgt
          and "not targeted" not in out_free
          and "not targeted" in out_tgt,
          [l.strip() for l in out_free.splitlines() if "VERDICT" in l][:1]
          + [l.strip() for l in out_free.splitlines()
             if "nothing was fixed" in l][:1])
    check("declaring `1,3` REJECTS the same diff and NAMES the line it "
          "touched — the trailing list is READ, not merely parsed",
          "VERDICT: REJECTED" in out_tgt and "[4] were changed but not "
          "targeted" in out_tgt,
          out_tgt.strip().splitlines()[-1:])
    check("and the two runs are not byte-identical",
          out_free != out_tgt,
          "identical output is what `targeted = None` produces")

    # The combinations that CANNOT be expressed refuse by name rather than
    # picking a winner -- the same reflex the drop failed to have.
    # The letter string is 16 chars for a 16-line fixture ON PURPOSE. `ABAB`
    # also refuses here, but on LENGTH -- it would pass this assertion against
    # the unfixed reader and prove nothing (measured: it did). A scheme the
    # old code accepted is the only one whose refusal is about the
    # COMBINATION.
    for args, why in (
            (("--cliques", MANDATE_THAT_FAILS), "--cliques with another"),
            (("ABABCCDDEEFFGGHH", rets), "a letter string with a flag"),
            ((MANDATE_THAT_FAILS, "--groups=5,7"), "the same spelling twice")):
        rc, out, _ = run("brief", txt, *args, expect_rc=2)
        check(f"REFUSES {why}", rc == 2 and "REFUSED" in out,
              f"rc {rc}")


def test_the_loop_suspends_instead_of_guessing():
    print("\n20. `--propose=defer:PATH` — the loop SUSPENDS and cannot be "
          "walked past (BUILT 2026-08-15)")
    # WHAT THIS IS FOR, and it is not convenience. A proposer is
    # `callable(prompt) -> str` and anything can be one -- but a CHILD PROCESS
    # cannot re-enter the agent that spawned it, because that agent is blocked
    # waiting for the child to return. `call:` answers that by reaching a
    # service, which needs a credential. `defer:` answers it by reaching
    # NOTHING: the loop stops at the first request it has no answer for,
    # writes down what it asked, and exits 4. The same command run again
    # replays every answer in order and continues.
    #
    # THE ENFORCEMENT IS THE POINT. The failure this closes was never that the
    # loop was wrong -- it is that a writer disciplined enough to drive it by
    # hand is a writer who can also decide not to, and skip straight to a
    # final draft. There is no path here from "flags outstanding" to a draft
    # except through the gates, and assertion 2 is the one that proves it.
    d = tempfile.mkdtemp()
    draft = os.path.join(d, "draft.txt")
    state = os.path.join(d, "state.json")
    with open(draft, "w") as fh:
        fh.write("\n".join(NOISY_LINES[:4]) + "\n")
    # REPINNED 2026-08-25 (M-116) from ~~--groups=1,3;2,4~~: under the
    # whole-vocabulary default BOTH old pairs are satisfied — store~own by
    # 'chain rhyme (rap)' and four~gone by 'assonance' — so the loop had no
    # question to ask and the whole section went vacuous (the first run
    # completed at rc 0 instead of suspending at 4). Group A below,
    # four~own, is MEASURED to stand in no schema over this draft
    # (relations.whole_vocabulary_pairs), so it is refused and asked; group
    # B, store~gone, is the door's satisfied pair, kept so the one-question
    # pin still has its contrast.
    mand = "--groups=2,3;1,4"

    rc, out, _ = run("revise", draft, mand, f"--propose=defer:{state}",
                     expect_rc=4)
    check("the first run SUSPENDS at exit 4 rather than guessing a line",
          rc == 4 and "SUSPENDED" in out, f"rc {rc}")
    check("exit 4 is its own code, not reused",
          rc not in (0, 2, 3), "0 clean / 2 refused / 3 flag standing")
    st = json.load(open(state))
    check("the state names what it asked for and leaves a slot for it",
          st["pending"]["answer"] is None
          and st["pending"]["record"]["line"] == 3
          and len(st["pending"]["prompt"].splitlines()) > 20,
          f"pending={st['pending']['record']}")

    # THE GATE. Running again without answering must not advance, must not
    # fall back to the stub, and must not emit a draft.
    rc2, out2, _ = run("revise", draft, mand, f"--propose=defer:{state}",
                       expect_rc=4)
    check("re-running WITHOUT an answer does not advance the loop",
          rc2 == 4 and "SUSPENDED" in out2 and "FINAL DRAFT" not in out2,
          f"rc {rc2}")

    # A malformed answer is refused, not written into the draft: a mis-parsed
    # line is just a changed line, and verify() cannot tell those apart.
    st["pending"]["answer"] = "line one\nline two"
    json.dump(st, open(state, "w"))
    rc3, out3, _ = run("revise", draft, mand, f"--propose=defer:{state}",
                       expect_rc=2)
    check("an answer that is not unambiguously ONE line REFUSES",
          rc3 == 2 and "REFUSED" in out3, f"rc {rc3}")

    # RESTATED 2026-08-18: the first scripted answer ended 'wore' against
    # L1's 'store' — the -ore spelling family, HOMEOTELEUTON under the
    # two-tier ban, so the loop rightly refused to stop on it and the whole
    # defer flow cascaded red. 'pour' is measured clean against 'store'
    # both ways ('our' vs 'ore' — same sound, different spelling, below the
    # frequency tier), which is exactly the reach the ban exists to force.
    # RESTATED 2026-08-23: THE LOOP ASKS ONE QUESTION HERE NOW, NOT TWO, and
    # the second one disappeared at the DOOR rather than in the loop. This
    # scripted two answers and walked them unconditionally, so when the loop
    # converged after the first it CRASHED on `st["pending"]["answer"]` with
    # `pending` already None — a test that assumed its own subject's shape
    # instead of reading it.
    # RESTATED 2026-08-25 (M-116): the question's PARTNER moved with the
    # mandate repin above — L3 answers L2's 'four' now, not L1's 'store'.
    # 'pour' against 'four' is the -our spelling family, HOMEOTELEUTON, and
    # the first replacement attempt ('...swept the kitchen floor') was
    # REJECTED for introducing LEXICAL_MONOTONY, which is the floor doing
    # its job. 'floor' is measured clean against 'four' (screen: RHYME
    # 1.000 CLEAN; not in the field's 14-word modal head), and the line
    # below carries enough new types to keep the draft's MATTR above the
    # calibrated floor.
    #
    # The walk is driven by the STATE now rather than by the answer list, so
    # it cannot crash on a loop that converges early; the count of questions
    # is then asserted separately, with the reason, because a walk that
    # silently tolerates any number would stop pinning this at all.
    answers = ["we stacked our boxes on the hardwood floor",
               "and drove until the county line was far"]
    asked = []
    for want in answers:
        st = json.load(open(state))
        if st.get("pending") is None:
            break
        asked.append(st["pending"]["record"]["line"])
        st["pending"]["answer"] = want
        json.dump(st, open(state, "w"))
        rc, out, _ = run("revise", draft, mand, f"--propose=defer:{state}")
    check("answering drives the loop to a stop condition",
          rc == 0 and "SUCCESS" in out, f"rc {rc}")
    check("EXACTLY ONE line was ever asked about — L3, whose pair (four~own) "
          "stands in NO schema. L1/L4 stands in 'assonance' and 'chain "
          "rhyme (rap)' and the whole-vocabulary default (M-116) admits it, "
          "so it is not a question (doctrine 17: this asked TWO until "
          "2026-08-22, and the pairs moved 2026-08-25)",
          asked == [3], f"lines asked: {asked}")
    check("only the answered line changed",
          "* L3: " + answers[0] in out
          and "* L1:" not in out and "* L2:" not in out
          and "* L4:" not in out,
          "L4 is untouched because nothing was ever wrong with it")

    # THE FINISHED STATE IS A RECORDED RUN. Asserted rather than claimed in a
    # docstring: a deferred session is only reproducible if someone with no
    # writer and no credential can re-run it (doctrine 14).
    st = json.load(open(state))
    check("a converged run leaves no pending request", st["pending"] is None)
    # AND IT SAYS IT IS FINISHED (M-183, 2026-09-01). The verb writes a
    # `complete` marker with the stop, the code and the INPUT draft's
    # fingerprint; the same command run again on the same draft replays to
    # the same stop and says so BEFORE the loop starts — a re-run used to
    # produce the identical output with nothing in it saying that no
    # question could ever be asked again. The answered records carry the
    # draft they were asked against, which is the other half of the entry.
    check("the state carries a COMPLETE marker naming the stop and the "
          "input draft",
          st.get("complete", {}).get("stop") == "success"
          and st["complete"].get("exit") == 0
          and len(st["complete"].get("draft", "")) == 12,
          st.get("complete"))
    check("every answered record names the draft it was asked against",
          st["answered"]["propose"]
          and all(len(r.get("draft", "")) == 12
                  for r in st["answered"]["propose"]),
          st["answered"]["propose"])
    rc6, out6, _ = run("revise", draft, mand, f"--propose=defer:{state}")
    check("re-running the finished state on the same draft is told so up "
          "front and stops where it stopped, at the same code",
          rc6 == 0 and "THIS STATE IS COMPLETE" in out6
          and "SUCCESS" in out6 and "SUSPENDED" not in out6,
          f"rc {rc6}")
    rep = os.path.join(d, "replay.json")
    json.dump(st["answered"], open(rep, "w"))
    rc4, out4, _ = run("revise", draft, mand, f"--propose=replay:{rep}")
    check("the `answered` block IS a valid --propose=replay: file",
          rc4 == 0 and "* L3: " + answers[0] in out4
          and "* L4:" not in out4,
          "same draft, no writer present; ONE answer, because one question "
          "was asked")

    rc5, out5, _ = run("revise", draft, mand, "--propose=defer", expect_rc=2)
    check("`defer` without a PATH refuses like every other flag value",
          rc5 == 2 and "REFUSED" in out5, f"rc {rc5}")


#: Two mandated pairs that RHYME cleanly and are both MODAL — so the draft
#: carries no flag at all and the loop has always stopped on it.
MODAL_DRAFT = ["the bank foreclosed and boarded up the town",
               "the freight train left the siding after four",
               "we packed the truck and never once looked down",
               "and drove until the county line was more"]


def test_the_loop_pursues_a_note_it_can_brief():
    print("\n21. `--pursue=` — the loop no longer stops on a note it has a "
          "candidate field for (FIXED 2026-08-15)")
    # THE DEFECT, found by writing a song through the loop. `MODAL_RHYME` is
    # in `RHYME_FINDINGS`, so `brief()` hands a line carrying one a COMPLETE
    # field with the modal words marked FORBIDDEN -- the machinery to fix it
    # is built and reachable. And it is a NOTE, while every stop condition in
    # quality/loop.py read `severity == "flag"`, so the loop reported SUCCESS
    # and stopped before asking. Doctrine 9 is this project's central claim
    # and its own loop could not enforce it.
    d = tempfile.mkdtemp()
    draft = os.path.join(d, "modal.txt")
    with open(draft, "w") as fh:
        fh.write("\n".join(MODAL_DRAFT) + "\n")
    mand = "--groups=1,3;2,4"

    rc0, out0, _ = run("brief", draft, mand)
    check("the fixture carries MODAL_RHYME and NO flag at all",
          "MODAL_RHYME" in out0 and "[FLAG]" not in out0,
          "so nothing but `pursue` can make the loop look at it")

    # ~~WITHOUT --pursue the loop stops and changes nothing~~ RESTATED
    # 2026-08-17: that check pinned the OPT-IN behaviour, and the opt-in
    # behaviour was the defect — the operator ran without the flag and an
    # all-modal draft was reported SUCCESS. `quality/loop.py` now carries
    # `MANDATORY_PURSUE` (owner's standing order, recorded on the constant):
    # the union is below every invocation, so a bare `revise` pursues too.
    rc1, base, _ = run("revise", draft, mand)
    check("WITHOUT --pursue the loop pursues ANYWAY — mandatory, unskippable",
          rc1 == 0 and "FINAL DRAFT" in base,
          "the flagless-but-modal draft is revised on a bare invocation")

    rc2, out2, _ = run("revise", draft, mand, "--pursue=MODAL_RHYME")
    check("naming the code explicitly is a no-op — `pursue` is ADDITIVE over "
          "a mandatory floor, not the switch that turns enforcement on",
          rc2 == 0 and "FINAL DRAFT" in out2 and "PURSUING" in out2,
          "same draft, same proposer, same outcome either way")
    changed = [l for l in out2.splitlines() if l.strip().startswith("* L")]
    check("and the lines it changed are the ones carrying the note",
          len(changed) == 2 and "L3" in changed[0] and "L4" in changed[1],
          f"{len(changed)} line(s) changed")
    # EXIT 3 WHEN THE LOOP GIVES UP WITH A PURSUED LINE STANDING — the other
    # half of the order: "the loop gave up" must be distinguishable from
    # "the draft is clean" by a caller reading only the exit code. The
    # proposer is a declared `call:` adapter that DECLINES every ask, so the
    # pursued lines survive to the stop and the exit says so.
    decl_mod = os.path.join(d, "declining_adapter.py")
    with open(decl_mod, "w") as fh:
        fh.write("def make():\n"
                 "    return lambda prompt: 'no.'\n")
    rc3, out3, _ = run("revise", draft, mand,
                       "--propose=call:declining_adapter:make",
                       expect_rc=3, env={"PYTHONPATH": d})
    check("a run ending with pursued lines UNRESOLVED exits 3, not 0 — "
          "success below 100% is unreportable",
          rc3 == 3 and "unresolved" in out3.lower(),
          f"rc {rc3}")

    # THE SEPARATION THAT MAKES THIS LEGAL. Pursuing changes what the loop
    # ASKS for; it must never change what verify() REJECTS, or a note would
    # start failing revisions and doctrine 6/7 would be broken by the fix.
    # STATED AS AN EQUALITY, AT THE LAYER THE COORDINATE LIVES IN. Two
    # earlier versions of this assertion were wrong in different ways and both
    # are worth recording. The first demanded ACCEPTED and failed -- the TEST
    # was wrong, not the code: verify() rejects a revision that fixes nothing,
    # which a draft against itself is, with or without pursuit. The second
    # compared two CLI runs, and the refusal added above made them
    # incomparable, because `verify --pursue` now exits 2 by design. The
    # INVARIANT never moved: `pursue` changes what the LOOP asks for and must
    # never change what verify() decides. So it is asserted through the API,
    # where `pursue` is actually read, instead of through a CLI that refuses
    # to carry it.
    import quality.revise as RV
    lex, dec = lh.Lexicon(), lh.Declaration()
    before = list(MODAL_DRAFT)
    after = list(MODAL_DRAFT)
    after[2] = "we packed the truck and never once looked on"
    groups = [[1, 3], [2, 4]]
    plain = RV.Reviser(lex=lex, decl=dec).verify(before, after, groups)
    pursued = RV.Reviser(lex=lex, decl=dec,
                         rdecl=RV.ReviseDeclaration(
                             pursue=frozenset({"MODAL_RHYME"}))
                         ).verify(before, after, groups)
    check("`verify()` is UNTOUCHED — same accept/fixed/broken/new with the "
          "note pursued",
          all(plain.get(k) == pursued.get(k)
              for k in ("accepted", "fixed", "broken", "new", "new_flags")),
          f"accepted {plain.get('accepted')} vs {pursued.get('accepted')}; "
          f"pursuing changes what the loop ASKS for and never what verify "
          f"REJECTS (doctrine 6/7)")

    # ONLY `revise` RUNS A LOOP, and this flag was added to the block SHARED by
    # brief/verify/revise/song, so on three of the four it changed no output --
    # and PRINTED ITS DISCLOSURE ANYWAY, telling a caller "the loop keeps asking
    # on a line carrying one" on verbs that run no loop at all. A silent no-op
    # is doctrine 1; a no-op that ANNOUNCES ITSELF AS WORKING is that plus a
    # false sentence in the report a writer reads to decide whether the draft is
    # finished. `--propose` has carried this same refusal one flag over since it
    # landed, so the shape was already in this file when the gap was made.
    #
    # THESE THREE WERE WRITTEN ONCE, DELETED BY MY OWN NEXT EDIT, AND RESTORED.
    # The rewrite of the assertion just above spliced the file between two
    # anchors and these sat between them. The suite went green because a
    # deleted assertion cannot fail -- which is this file's whole subject,
    # committed by the commit that fixed it.
    for verb, extra in (("brief", []), ("song", []), ("verify", [draft])):
        rcx, outx, _ = run(verb, draft, *extra, mand, "--pursue=MODAL_RHYME",
                           expect_rc=2)
        check(f"`--pursue` on `{verb}` REFUSES rather than announcing a loop "
              f"it does not run",
              rcx == 2 and "REFUSED" in outx and "PURSUING" not in outx,
              f"rc {rcx}")

    rc3, out3, _ = run("brief", draft, mand, "--pursue=HOOK_ABSENT",
                       expect_rc=2)
    # THE MESSAGE, not just the code. `_no_unknown_flags_or_refuse` already
    # exits 2 on any flag it does not know, so `rc == 2` alone passes against
    # a build that never heard of `--pursue` -- measured, then tightened.
    check("a code `brief()` cannot offer a field for REFUSES BY NAME",
          rc3 == 2 and "cannot offer a candidate field" in out3
          and "RHYME_FINDINGS" in out3,
          "an inert coordinate would let a writer believe the loop was "
          "looking when it never was")


def test_the_candidate_field_says_which_ordering_it_is():
    print("\n22. `candidates --modal` — two orderings, one question, and the "
          "verb now says which it answered (FIXED 2026-08-15)")
    # THE DEFECT: this verb ranks by RHYME SCORE; the loop's modal exclusion
    # ranks by FREQUENCY over the grader-accepted pool. Two answers to "is
    # this rhyme too predictable", and the one reachable from the command
    # line is not the one the grader enforces. Found by using the verb to
    # pre-screen a rhyme and having the loop reject the result anyway.
    rc, out, _ = run("candidates", "lines", "7")
    check("the default output NAMES its ordering and points at the other",
          rc == 0 and "ORDERED BY RHYME SCORE" in out and "--modal" in out,
          "silence here is what made the two lists look like one list")

    rc2, out2, _ = run("candidates", "lines", "7", "--modal")
    check("--modal prints the FORBIDDEN set with its exclusion count",
          rc2 == 0 and "FORBIDDEN (modal" in out2
          and "modal_exclusion=" in out2)

    score_rank = [c["word"] for c in
                  lh.CandidateEngine(lh.Lexicon(), lh.Declaration())
                  .candidates("lines", 7)["candidates"]]
    score_top = set(score_rank)
    forb_order = [w.strip() for w in
                  out2.split("modal_exclusion=")[1].split(":\n")[1]
                  .splitlines()[0].split(",") if w.strip()]
    forb = set(forb_order)
    # LIKE WITH LIKE — 2026-08-15. This compared a 7-word score list against
    # a 6-word FORBIDDEN set (`candidates lines 7` vs `modal_exclusion=6`),
    # so `!=` held on CARDINALITY whatever the content: measured, a mutant
    # making `--modal` a pure truncation of the score list — the literal
    # relabelling this check is named after — passed it, and its own detail
    # line printed the modal set as a strict subset while calling the two
    # "genuinely DIFFER". Cut the score list to the same length first, and
    # assert the ORDERING as well as the membership, since two rankings over
    # the same words are still two different answers.
    check("the two sets genuinely DIFFER — this is not a relabelling",
          set(score_rank[:len(forb_order)]) != forb
          and score_rank[:len(forb_order)] != forb_order,
          f"score-ranked {score_rank[:len(forb_order)]} vs "
          f"modal {forb_order}")
    check("and they overlap rather than being disjoint — the same question "
          "asked two ways, not two unrelated lists",
          score_top & forb,
          f"{len(score_top & forb)} word(s) in common")

    # ONE DEFINITION, and this is the assertion that keeps it that way: the
    # verb calls `Reviser.modal_field`, the same method the loop calls, so
    # what is printed here and what `brief()` forbids cannot drift apart.
    d = tempfile.mkdtemp()
    draft = os.path.join(d, "modal.txt")
    with open(draft, "w") as fh:
        fh.write("\n".join(MODAL_DRAFT) + "\n")
    _, bout, _ = run("brief", draft, "--groups=1,3;2,4")
    bline = [l for l in bout.splitlines() if "FORBIDDEN (modal" in l]
    bforb = {w.strip() for w in bline[0].split(":", 1)[1].split(",")
             } if bline else set()
    _, cout, _ = run("candidates", "town", "7", "--modal")
    cforb = {w.strip() for w in
             cout.split("modal_exclusion=")[1].split(":\n")[1]
             .splitlines()[0].split(",") if w.strip()}
    check("what the verb forbids is what brief() forbids, same word",
          bforb and bforb == cforb,
          f"brief {sorted(bforb)} vs candidates {sorted(cforb)}")
    # THIS EQUALITY PASSED FOR AN UNSTATED REASON UNTIL 2026-08-16, and the
    # reason was a property of THIS FIXTURE rather than of the code. `brief()`
    # used to APPEND the incumbent to the same list the verb prints, so the
    # two sets could only be equal when nothing was appended — and nothing was
    # appended here because BOTH briefed lines of MODAL_DRAFT sit on an end
    # word that is already inside its own modal head ('down' is head[0] for
    # the call 'town', 'more' is head[1] for 'four'). Change one end word to a
    # non-modal rhyme and this section went red against code that had not
    # moved. The two rules are two fields now, so the equality holds BY
    # CONSTRUCTION; the two checks below pin that rather than the luck.
    _, iline, _ = run("brief", draft, "--groups=1,3;2,4")
    incumbents = [l for l in iline.splitlines() if "ALREADY THERE" in l]
    check("the incumbent rule is printed on its OWN line, under its own "
          "name — so it is neither lost from the report nor scraped into "
          "`bforb` by the filter above",
          len(incumbents) == len(bline)
          and not any("FORBIDDEN (modal" in l for l in incumbents),
          f"{len(bline)} modal line(s), {len(incumbents)} incumbent line(s)")
    _rv_src = open(os.path.join(HERE, "revise.py")).read()
    check("...and the equality above is now STRUCTURAL rather than a "
          "property of this fixture: the incumbent is on a different field, "
          "so no end word can ever be appended to the modal list",
          "forbidden_incumbent" in _rv_src
          and "forbidden_modal.append(cur)" not in _rv_src,
          "the append that made this equality coincidental is gone")


def test_the_last_two_traceback_shapes_refuse():
    print("\n23. a missing ARGUMENT and a missing FILE refuse instead of "
          "tracebacking (FIXED 2026-08-15)")
    # Every verb here was given ONE refusal shape a piece at a time -- an OOV
    # `candidates` query, `--fallback=bogus`, a blueprint/draft mismatch,
    # `song`'s private handler, `--propose`'s vocabulary. TWO CLASSES were
    # covered on no verb at all, because no single verb owned them: a missing
    # positional (IndexError) and a named file that is not there
    # (FileNotFoundError). Both exited 1 -- Python's own uncaught-exception
    # code -- so a caller reading 1 as "the harness crashed" was right and had
    # no way to tell it from "my arguments were wrong" (doctrine 20).
    d = tempfile.mkdtemp()
    good = os.path.join(d, "q.txt")
    with open(good, "w") as fh:
        fh.write("the cat sat on the mat\na dog ran through the fog\n"
                 "he wore a battered hat\nit vanished in the bog\n")
    gone = os.path.join(d, "not-here.txt")

    rc, out, err = run("brief", expect_rc=2)
    check("a missing required argument REFUSES at 2, not 1",
          rc == 2 and "REFUSED" in out and "Traceback" not in err,
          f"rc {rc}")
    check("and it names the verb and the count it actually received",
          "brief" in out or "(no verb)" in out, out.strip().splitlines()[:1])
    # NOT COLLAPSED (doctrine 20): an IndexError four frames inside a grader is
    # a DEFECT in this file, not the caller's mistake, and the refusal has to
    # say so rather than blame whoever typed the command.
    check("and it says a complete command line reaching it is a DEFECT",
          "DEFECT" in out and "IndexError" in out,
          "the two readings are stated, not merged into one message")

    rc2, out2, err2 = run("brief", gone, "ABAB", expect_rc=2)
    check("a named file that is not there REFUSES at 2, not 1",
          rc2 == 2 and "REFUSED" in out2 and "Traceback" not in err2,
          f"rc {rc2}")
    check("and it names the path and the OS's own reason",
          "not-here.txt" in out2 and "No such file" in out2)

    rc3, out3, _ = run("brief", good, "ABAB")
    check("a REAL run is untouched — this catches errors, not results",
          rc3 == 0 and "REFUSED" not in out3, f"rc {rc3}")


def test_every_test_file_is_accounted_for_by_ci():
    print("\n24. every quality/test_*.py is RUN, REFUSED BY NAME, or the "
          "census fails (FIXED 2026-08-15)")
    # THE DEFECT THIS CLOSES, found by this repo's own CI audit: 48 test files
    # existed and 46 were accounted for. `test_propose.py` and
    # `test_verify_entries.py` were in no step, no npm script, and had no
    # caller -- written, green, and executed by no automated thing. The
    # expensive one was `test_propose.py`, whose §7c/§7d are the ONLY
    # assertions that cross the tier-1/tier-2 proposer seam for real: the very
    # check written because the two flanking suites could not see the defect
    # was itself reachable by no runner. Import reachability is not invocation
    # reachability, one level up, at the test file.
    #
    # A NAMED LIST IS RIGHT AND HAS A MIRROR-IMAGE DEFECT. Globbing is how a
    # 53-CPU-minute sweep arrives in CI without anybody deciding it should, so
    # ci.yml names its suites on purpose. But a hand-kept list does not notice
    # a file added later, because A LIST THAT IS SHORT LOOKS EXACTLY LIKE A
    # LIST THAT IS COMPLETE. ci.yml's own comment states the arithmetic and
    # then says it "is a check a human has to run" -- which is doctrine 48
    # written down beside the thing it condemns. This is that check, run.
    ci = os.path.join(ROOT, "..", ".github", "workflows", "ci.yml")
    src = open(ci, encoding="utf-8").read()
    on_disk = {os.path.basename(p)[len("test_"):-len(".py")]
               for p in glob.glob(os.path.join(ROOT, "quality", "test_*.py"))}
    # Every name this file mentions in a runnable position: the cheap loop, the
    # revision step, and anything refused BY NAME with a reason.
    named = set()
    for m in re.finditer(r"for f in ([\s\S]*?); do", src):
        named |= {w for w in m.group(1).replace("\\", "").split() if w}
    for m in re.finditer(r"quality/test_([a-z0-9_]+)\.py", src):
        named.add(m.group(1))
    orphans = sorted(on_disk - named)
    check("no test file is executed and named by NOTHING in ci.yml",
          not orphans,
          f"{len(on_disk)} on disk, {len(on_disk & named)} accounted for; "
          f"ORPHANS: {orphans or 'none'}")
    ghosts = sorted(n for n in named
                    if not os.path.exists(
                        os.path.join(ROOT, "quality", f"test_{n}.py")))
    check("and ci.yml names no suite that does not exist on disk",
          not ghosts, f"named-but-missing: {ghosts or 'none'}")
    # The label a reader trusts must equal the list it labels. The struck
    # (`~~...~~`) line is history under doctrine 17 and is deliberately skipped.
    live = [l for l in src.splitlines()
            if "cheap suites" in l and l.lstrip().startswith("- name:")]
    if live:
        want = int(re.search(r"The (\d+) cheap suites", live[0]).group(1))
        got = len({w for w in re.search(r"for f in ([\s\S]*?); do", src)
                   .group(1).replace("\\", "").split() if w})
        check("the cheap step's LABEL equals the length of its own list",
              want == got, f"label {want}, list {got}")


def test_a_near_miss_flag_refuses_on_the_reviser_verbs():
    print("\n25. a MISSPELLED flag refuses on brief/verify/revise/song "
          "instead of producing the same bytes as omitting it (FIXED "
          "2026-08-15)")
    # `_no_unknown_flags_or_refuse` was written when `--isochronus` was caught
    # in `fit`, and `fit` was its ONLY caller -- one verb of 28. The guard
    # existed, was documented, was tested, and every other verb swallowed
    # unrecognised flags. Import reachability is not invocation reachability,
    # at the guard written for exactly this.
    #
    # WHAT IT COST, and it is the worst available shape: a near-miss spelling
    # produced BYTE-IDENTICAL output to omitting the flag, at exit 0. There
    # was nothing to notice. `revise --propse=defer:PATH` ran the STUB -- a
    # word-splicer -- where the caller had asked for the deferred loop that
    # refuses to advance without a writer, and the report did not say which
    # had run. `brief --blueprnt=BP` dropped meter AND song-function while
    # printing "BLUEPRINT: none declared".
    d = tempfile.mkdtemp()
    q = os.path.join(d, "q.txt")
    with open(q, "w") as fh:
        fh.write("the cat sat on the mat\na dog ran through the fog\n"
                 "he wore a battered hat\nit vanished in the bog\n")
    bp = os.path.join(ROOT, "quality", "fixtures", "song.blueprint.json")

    # THE NEAR MISSES, one per flag these verbs actually declare.
    for typo in ("--nope", "--blueprnt=" + bp, "--isochronus",
                 "--propse=stub", "--pursu=MODAL_RHYME", "--subdivison=2"):
        rc, out, err = run("brief", q, "ABAB", typo, expect_rc=2)
        check(f"`brief` refuses {typo.split('=')[0]}",
              rc == 2 and "REFUSED" in out and "Traceback" not in err,
              f"rc {rc}")
    check("and the refusal NAMES the flag and the whole vocabulary",
          all(s in run("brief", q, "ABAB", "--propse=stub")[1]
              for s in ("'--propse'", "--propose=", "--groups=", "--cliques")),
          "a refusal that does not name the alternatives is a shrug")

    for verb, extra in (("verify", [q]), ("revise", []), ("song", [])):
        if verb == "song":
            rc, out, _ = run("song", bp,
                             os.path.join(ROOT, "quality", "fixtures",
                                          "song.txt"),
                             "--cliques", "--isochronus", expect_rc=2)
        else:
            rc, out, _ = run(verb, q, *extra, "ABAB", "--nope", expect_rc=2)
        check(f"`{verb}` refuses an unrecognised flag too", rc == 2
              and "REFUSED" in out, f"rc {rc}")

    # THE OTHER HALF, and it is the half a guard like this gets wrong: every
    # flag these verbs DO declare must still run.
    for good in ("--groups=1,3;2,4", "--cliques", "--returns=1,3"):
        rc, out, _ = run("brief", q, good)
        check(f"`{good.split('=')[0]}` still runs", rc == 0
              and "REFUSED" not in out, f"rc {rc}")
    rc, out, _ = run("revise", q, "ABAB", "--propose=stub")
    check("`--propose=stub` still runs", rc == 0 and "REFUSED" not in out,
          f"rc {rc}")


def test_a_file_the_harness_cannot_read_refuses_on_every_verb():
    print("\n26. an UNDECODABLE file and a MISTYPED path refuse on every verb "
          "that reads a lyric (FIXED 2026-08-15)")
    # §23 closed a MISSING file and this closes the two shapes it did not
    # reach, both found by sweeping the verbs rather than by reading the code.
    #
    #   UNDECODABLE. `open(path, encoding="utf-8")` raises
    #   `UnicodeDecodeError`, which is a `ValueError` -- so §23's `except
    #   OSError` never saw it and seven verbs exited 1 with a traceback.
    #   MEASURED at 6d204a7 on one eight-byte binary: chains graph density
    #   relations qafiya partition refrain -> 1.
    #
    #   AND `readability` -> 0, WHICH IS THE ONE WORTH THE COMMIT. That verb
    #   exists to answer "how much of this text could not be read", its
    #   reader carried `errors="replace"`, and it printed `countable line
    #   ends 1   read 1   REFUSED 0   (0.00%)` on a file it could not decode
    #   at all. A refusal counter answering 0.00% about its own failure to
    #   ingest, at the success exit code (doctrine 48, in the report's
    #   headline).
    #
    #   MISTYPED PATH. `qafiya`/`partition` are `FILE|L...` and decided with
    #   `os.path.exists`, so an absent path fell through to the LINE reading
    #   and was GRADED: `qafiya nope.txt` printed `L1 (txt)` -- the file
    #   extension scored as the rhyme word -- at exit 0.
    d = tempfile.mkdtemp()
    good = os.path.join(d, "q.txt")
    with open(good, "w") as fh:
        fh.write("the cat sat on the mat\na dog ran through the fog\n"
                 "he wore a battered hat\nit vanished in the bog\n")
    binary = os.path.join(d, "bad.bin")
    with open(binary, "wb") as fh:
        fh.write(b"\xff\xfe\x00\x80bad\xc3\x28")
    gone = os.path.join(d, "nope.txt")

    # ONE SHAPE ON EVERY VERB, which is the point of a sweep rather than a
    # case: these were fixed one at a time before and that is how two whole
    # classes went uncovered.
    reading = (("chains", [binary]), ("graph", [binary]),
               ("density", [binary]), ("relations", [binary]),
               ("readability", [binary]), ("qafiya", [binary]),
               ("partition", [binary]), ("refrain", ["villanelle", binary]),
               ("brief", [binary, "ABAB"]), ("revise", [binary, "ABAB"]),
               ("verify", [binary, binary, "ABAB"]))
    for verb, argv in reading:
        rc, out, err = run(verb, *argv, expect_rc=2)
        check(f"`{verb}` REFUSES an undecodable file at 2, not 1",
              rc == 2 and "REFUSED" in out and "Traceback" not in err,
              f"rc {rc}")
    rc, out, _ = run("chains", binary, expect_rc=2)
    check("and the refusal names the PATH, the BYTE and the OFFSET",
          "bad.bin" in out and "0xff" in out and "offset 0" in out,
          "a refusal that does not locate the byte is a shrug (doctrine 20)")

    # THE VERB HOLDING TWO FILES, which is why the exception is a class that
    # carries the path rather than one more clause on `__main__`'s handler.
    # The four Reviser verbs did NOT traceback at 6d204a7 -- they refused at
    # 2, and refused in the wrong layer's words: `UnicodeDecodeError` is a
    # `ValueError`, and their `except ValueError` is the BLUEPRINT/DRAFT
    # LENGTH MISMATCH handler, so a decode failure was reported under it as
    # `REFUSED — 'utf-8' codec can't decode byte 0xff in position 0` with no
    # filename anywhere in it. Correct exit code, correct shape, and on a verb
    # holding a BEFORE and an AFTER it named neither of them (doctrine 20 --
    # a refusal that cannot say what it is about is inconclusive dressed as an
    # answer). Asserted in BOTH argument positions so the check cannot pass by
    # naming whichever file happens to be read first.
    for pos, argv in (("second", [good, binary]), ("first", [binary, good])):
        rc, out, _ = run("verify", *argv, "ABAB", expect_rc=2)
        check(f"`verify` names WHICH of its two files failed to decode "
              f"({pos} position)",
              rc == 2 and "bad.bin" in out and "q.txt" not in out,
              out.strip().splitlines()[:1])

    # THE INGESTION-REFUSAL VERB, ASKED ITS OWN QUESTION. Kept separate from
    # the sweep above because the failure was not a traceback -- it was a
    # NUMBER, and the number was 0.00%.
    rc, out, _ = run("readability", binary, expect_rc=2)
    check("`readability` does not report 0.00% REFUSED on a file it could "
          "not decode", rc == 2 and "0.00%" not in out and "read 1" not in out,
          out.strip().splitlines()[:1])

    # ONE HANDLER SERVED BOTH, WHICH IS HOW THE MODULE-IDENTITY BUG SHOWS.
    # `readability` reaches the reader through `quality/readability.py`,
    # which imports `lyric_harness` under its own name -- a SECOND execution
    # of the same file, binding a second, unrelated `UndecodableLyricFile`.
    # While that was true this verb alone kept exiting 1, with a traceback
    # whose last line held the right message about the wrong class. Equal
    # refusal text across the two paths is the evidence they are one class.
    direct = run("chains", binary, expect_rc=2)[1]
    through = run("readability", binary, expect_rc=2)[1]
    check("a verb reaching the reader THROUGH quality/ refuses identically "
          "to one reaching it directly",
          direct.strip() == through.strip(),
          "two module objects would make these two different classes")

    # THE MISTYPED PATH, and BOTH readings of the argument it is ambiguous
    # with, because a guard like this is wrong exactly when it eats a line.
    for verb in ("qafiya", "partition"):
        rc, out, err = run(verb, gone, expect_rc=2)
        check(f"`{verb}` REFUSES a path-shaped token that is not a file",
              rc == 2 and "REFUSED" in out and "Traceback" not in err,
              f"rc {rc}")
        check(f"and `{verb}`'s refusal states BOTH readings",
              "FILE" in out and "LINE" in out,
              "the caller cannot fix it without being told which it picked")
    rc, out, _ = run("qafiya", "the cattle waded through the silt")
    check("a real LINE is still read as a line", rc == 0
          and "REFUSED" not in out, f"rc {rc}")
    rc, out, _ = run("qafiya", "silt")
    check("and so is a bare word — no separator, no extension, no refusal",
          rc == 0 and "REFUSED" not in out, f"rc {rc}")
    rc, out, _ = run("partition", "the silt", "rebuilt")
    check("two LINE arguments are untouched", rc == 0
          and "REFUSED" not in out, f"rc {rc}")

    # AND EVERY REAL RUN IS UNTOUCHED. This catches errors, not results.
    #
    # `REFUSED —` AND NOT `REFUSED`, and the difference is not pedantry: this
    # loop covers `readability`, whose ORDINARY report contains the word as a
    # column label — `countable line ends 4   read 4   REFUSED 0   (0.00%)`.
    # Spelled `"REFUSED" not in out` the check fails on a clean run of the one
    # verb in the list most worth covering, which is a test that cannot pass
    # rather than one that cannot fail, and the same mistake in the mirror.
    # `_refuse` prints one shape and it carries the em dash.
    for verb, argv in (("chains", [good]), ("density", [good]),
                       ("readability", [good]), ("qafiya", [good]),
                       ("partition", [good]), ("brief", [good, "ABAB"])):
        rc, out, _ = run(verb, *argv)
        check(f"`{verb}` on a real lyric still runs", rc == 0
              and "REFUSED —" not in out, f"rc {rc}")


def test_the_named_pair_disclosure_survives_the_module_boundary():
    print("\n27. the NAMED PAIR IS NOT THE EVIDENCE banner reaches the verbs "
          "that score through quality/ (FIXED 2026-08-15)")
    # FOUND WHILE MEASURING §26's `sys.modules` alias -- by byte-diffing all
    # 28 verb invocations with and without it, rather than by reasoning about
    # what one line could touch. 27 of 28 came back identical. `song` did not:
    # it GAINED four lines, and they are the loudest lines this report has.
    #
    # `report_pair` exists because "the defect was never that the provenance
    # was unavailable after `best_score` recorded it -- it was that a consumer
    # holding both printed only one". Its gate is
    #
    #     claimed = sp.claims(a, b) if isinstance(sp, Attribution) else True
    #
    # and `sp` arrives from `Reviser.inspect`, built by the copy of this file
    # that `quality/` imported. `isinstance` against `__main__`'s `Attribution`
    # is then FALSE for a real `Attribution`, `claimed` defaults to True, and
    # the entire disclosure block is skipped. So the defect `report_pair` was
    # written to end came back one level up, wearing module identity.
    #
    # AND THE REPORT CONTRADICTED ITSELF IN ADJACENT LINES, which is how it is
    # checkable without trusting either half: `spans_note` is a plain string
    # and never crossed the boundary, so `MOSAIC (both sides): the winning
    # span reaches back past the end word` printed on all four pairs the whole
    # time -- directly beneath the missing banner that says the same fact
    # loudly. One is the invariant on the other.
    fix = os.path.join(ROOT, "quality", "fixtures")
    rc, out, _ = run("song", os.path.join(fix, "song.blueprint.json"),
                     os.path.join(fix, "song.txt"), "--cliques", expect_rc=3)
    lines = out.splitlines()
    mosaic = [i for i, ln in enumerate(lines) if "MOSAIC (" in ln]
    check("the fixture still carries a mosaic span to disclose", mosaic,
          "a check with nothing to examine passes for the wrong reason "
          "(doctrine 48) — this one names its own population")
    # THE BANNER MAY SIT ON THE SAME LINE OR THE ONE ABOVE — widened
    # 2026-08-17, when `BACKLOG.md` §1.2's writer-facing half landed. A
    # `Finding.evidence` is ONE string, so `Reviser._attribution` appends the
    # provenance inline and the banner arrives on the mosaic line itself.
    # This check used to read `lines[i - 1]` alone, which encoded a LAYOUT
    # rather than the invariant it is about: no mosaic disclosure appears
    # without the banner accompanying it. Two new disclosures appeared on
    # this fixture the day the rule was widened, both correct.
    def _banner(i):
        return ("NAMED PAIR IS NOT THE EVIDENCE" in lines[i]
                or (i > 0
                    and "NAMED PAIR IS NOT THE EVIDENCE" in lines[i - 1]))
    orphans = [lines[i].strip()[:70] for i in mosaic if not _banner(i)]
    check(f"every one of the {len(mosaic)} mosaic spans carries the banner, "
          f"on its own line or the one above it",
          not orphans, orphans)

    # THE SAME PAIR THROUGH `brief`, which reaches `Reviser` by a different
    # route and was equally blind. Two verbs, one boundary.
    rc, out, _ = run("brief", os.path.join(fix, "song.txt"), "--cliques")
    check("`brief` discloses it too", rc == 0
          and "NAMED PAIR IS NOT THE EVIDENCE" in out, f"rc {rc}")

    # AND THE NUMBER DID NOT MOVE. This is a RENDERING fix (doctrine 91):
    # `report_pair`'s own docstring says it RELABELS rather than suppressing
    # the number, so a verdict that changed here would mean the alias had
    # done something else as well.
    check("the verdict beside it is unchanged — 1.0 REPEAT on the named pair",
          "(counting/counting): 1.0  REPEAT" in out,
          "the alias fixed a report, and a verdict moving would say otherwise")


def test_every_verb_reads_its_own_arguments():
    print("\n28. a mistyped ARGUMENT refuses in the verb's own words, on "
          "every verb that reads one (FIXED 2026-08-15)")
    # §23 and §26 closed the argument shapes that no single verb owned — a
    # missing positional, a named file that is not there, an undecodable one.
    # This closes the shapes each verb owns ITSELF: a number that is not a
    # number, a separator that is not there, an arity its own library asserts
    # on. Every one was exit 1 with a bare traceback, which a caller reads as
    # "the harness crashed" when the harness was handed 'two' for an integer
    # (doctrine 20), while `_subdivision_or_refuse` sat one screen away doing
    # it correctly for ONE flag.
    #
    # RE-MEASURED BEFORE IT WAS FIXED, and the audit that raised these nine
    # was 3 of 9 out of date at HEAD: `grid`/`fit`/`song` on a MISSING
    # blueprint, `function` on one, and `verify --nope` all already refused,
    # closed by the `except OSError` of 6873e20 and the flag guard of
    # 6d204a7. What was live is what is asserted here.
    d = tempfile.mkdtemp()
    small = os.path.join(d, "small.txt")
    with open(small, "w") as fh:
        fh.write("the cat sat on the mat\na dog ran through the fog\n"
                 "he wore a battered hat\nit vanished in the bog\n")
    notjson = os.path.join(d, "notjson.txt")
    with open(notjson, "w") as fh:
        fh.write("not json at all\n")

    # ONE SHAPE, EVERY SITE. A sweep and not a case, because these were fixed
    # one verb at a time before and that is how nine of them accumulated.
    for label, argv in (
            ("candidates N", ["candidates", "lines", "two"]),
            ("chains THETA", ["chains", small, "x"]),
            ("graph THETA", ["graph", small, "x"]),
            ("prasa K", ["prasa", "x", "dawn again", "silt rebuilt"]),
            ("cycle N/D", ["cycle", "x"]),
            ("cycle N/D (no slash)", ["cycle", "4"]),
            ("score, no --", ["score", "dawn", "again"]),
            ("types, no --", ["types", "dawn", "again"]),
            ("score, third field", ["score", "dawn", "--", "again", "--no"]),
            ("scheme arity", ["scheme", "ABAB", "dawn", "again"]),
            ("scheme + stray flag",
             ["scheme", "AABB", "a", "b", "c", "d", "--nope"]),
            ("refrain, unknown FORM", ["refrain", "zzznotaform"]),
            ("meter, no lines", ["meter", "./"]),
            ("meter + stray flag", ["meter", "./", "the cat", "--nope"]),
            ("function, malformed blueprint",
             ["function", notjson, "--function=verse1:verse"]),
    ):
        rc, out, err = run(*argv, expect_rc=2)
        check(f"{label} REFUSES at 2, not 1",
              rc == 2 and "REFUSED" in out and "Traceback" not in err,
              f"rc {rc}")

    # THE TWO SILENT ONES, which are worse than the tracebacks and need their
    # own assertions: both answered at exit 0, one with the WRONG LIST and
    # one with a partition of the typo itself.
    plain = run("candidates", "lines", "5")[1]
    eq = run("candidates", "lines", "5", "--modal=yes", expect_rc=2)
    check("`--modal=yes` is no longer BYTE-IDENTICAL to passing no flag",
          eq[0] == 2 and eq[1] != plain,
          "identical output is what handed the RHYME-SCORE list to a caller "
          "who asked for the FREQUENCY one — the substitution §22 exists for")
    rc, out, _ = run("refrain", "zzznotaform", expect_rc=2)
    check("and a mistyped FORM names the declared vocabulary",
          "villanelle" in out and "triolet" in out,
          "`.get(name, name)` printed an 11-line partition of the typo")

    # SIBLING VERBS MUST AGREE ON ONE FILE. `function` read its blueprint
    # with a bare `json.load(open(...))` while `grid` refused the identical
    # bytes through `_blueprint_or_refuse`.
    g = run("grid", notjson, expect_rc=2)
    f = run("function", notjson, "--function=verse1:verse", expect_rc=2)
    check("`function` and `grid` answer the same malformed blueprint the "
          "same way", g[0] == f[0] == 2 and "REFUSED" in f[1],
          f"grid rc {g[0]}, function rc {f[0]}")

    # THE OTHER HALF, and for `refrain` it is the half the new rule could
    # break: the notation test refuses a token whose letters are not the
    # alphabet's first few, and the rondeau's `R` rentrement is exactly such
    # a token. Every shipped form must still resolve, by name.
    from quality import schemes as SC
    for form in sorted(SC.REFRAIN_FORMS):
        rc, out, _ = run("refrain", form)
        check(f"the shipped form {form!r} still resolves", rc == 0
              and "READ AS: named form" in out, f"rc {rc}")
    for label, argv in (
            ("meter", ["meter", "./", "the-cat", "the-dog"]),
            ("scheme", ["scheme", "AABB", "dawn", "again", "silt",
                        "rebuilt"]),
            ("score", ["score", "dawn", "--", "again"]),
            ("types", ["types", "dawn", "--", "again"]),
            ("candidates --modal", ["candidates", "lines", "5", "--modal"]),
            ("chains theta", ["chains", small, "0.8"]),
            ("cycle", ["cycle", "7/8", "3+2+2"]),
            ("refrain, raw notation", ["refrain", "ABaAabAB"]),
    ):
        rc, out, _ = run(*argv)
        check(f"a real `{label}` run is untouched", rc == 0
              and "REFUSED" not in out, f"rc {rc}")


def test_the_comparator_and_the_meter_flags_reach_the_graders():
    print("\n29. `--profile` reaches the four verbs that grade a draft, and "
          "a coordinate with nothing to bind to REFUSES (FIXED 2026-08-15)")
    # `--profile` REBINDS THE CHANNEL WEIGHTS EVERY SCORE IS READ UNDER, and
    # it was reachable on `scheme` and on nothing else. `Reviser.brief`,
    # `.verify`, `.inspect` and `revise_loop` have ALL taken `profile=` since
    # they were written -- `_matrix` forwards it to `best_score`, the same
    # parameter `scheme --profile` rebinds -- and no CLI spelling reached any
    # of the four verbs that grade a draft. `revise` printed the coordinate
    # anyway: `COMPARATOR: profile=declared default`, a report naming a
    # setting its own caller could not set. Built, tested, unreachable --
    # the shape `--blueprint` had before 2026-08-11.
    d = tempfile.mkdtemp()
    q = os.path.join(d, "q.txt")
    with open(q, "w") as fh:
        fh.write("the cattle waded through the silt\n"
                 "past every fence the county rebuilt\n"
                 "the dawn came up again\n"
                 "and found us where we had been\n")
    bp = os.path.join(ROOT, "quality", "fixtures", "song.blueprint.json")
    ly = os.path.join(ROOT, "quality", "fixtures", "song.txt")
    M = "--groups=1,2;3,4"

    rc_base, base, _ = run("brief", q, M)
    rc_prof, prof, _ = run("brief", q, M, "--profile=assonance")
    # BOTH RUNS MUST SUCCEED, and that clause is the whole assertion. Against
    # the unfixed tree `--profile` REFUSED, so `base != prof` held on a
    # refusal and this check passed for the wrong reason -- measured, then
    # tightened. A comparator that is reachable produces a REPORT that
    # differs, not an error that differs.
    check("`--profile` REACHES `brief` — both runs report, and the report "
          "is not the one produced without it",
          rc_base == 0 and rc_prof == 0 and "REFUSED" not in prof
          and base != prof,
          f"rc {rc_base}/{rc_prof}; byte-identical is what an unreachable "
          f"comparator looks like")
    check("and an unrecognised profile REFUSES by name rather than falling "
          "through to the default weights",
          run("brief", q, M, "--profile=bogus", expect_rc=2)[0] == 2
          and "assonance" in run("brief", q, M, "--profile=bogus",
                                 expect_rc=2)[1],
          "a silent comparator substitution is doctrine 1's own case")
    rc, out, _ = run("revise", q, M, "--profile=assonance")
    check("`revise` now REPORTS the profile it was handed, not a default it "
          "could not be given", rc == 0 and "profile='assonance'" in out,
          [ln for ln in out.splitlines() if "COMPARATOR" in ln][:1])
    for verb, argv in (("verify", ["verify", q, q, M]),
                       ("song", ["song", bp, ly, "--cliques"])):
        rc, out, _ = run(*argv, "--profile=assonance",
                         expect_rc=None)
        check(f"`{verb}` takes it too", "REFUSED" not in out, f"rc {rc}")

    # A COORDINATE WITH NOTHING TO BIND TO. `--subdivision`/`--isochronous`
    # are coordinates OF THE METER LAYER and meter rides `--blueprint`; given
    # without one they were accepted, consumed and dropped -- MEASURED
    # byte-identical, md5 202b23ce64 with each and without.
    for flag in ("--subdivision", "--isochronous"):
        argv = ["brief", q, M, flag] + (["2"] if flag == "--subdivision"
                                        else [])
        rc, out, err = run(*argv, expect_rc=2)
        check(f"`{flag}` with no --blueprint REFUSES instead of being "
              f"dropped", rc == 2 and "REFUSED" in out
              and "Traceback" not in err, f"rc {rc}")
    rc, out, _ = run("brief", q, M, "--subdivision", "2",
                     f"--blueprint={bp}", expect_rc=2)
    # THE OTHER SIDE OF THE SAME RULE: declared WITH a blueprint, the flag is
    # read and the run reaches the grader. It refuses here on the blueprint/
    # draft LENGTH mismatch (16 lines against 4), which is a different layer
    # and the right one -- the assertion is that it is not refused for
    # carrying `--subdivision` at all.
    check("and WITH a blueprint the same flag is read, not refused for "
          "itself",
          rc == 2 and "was declared and no --blueprint was" not in out
          and "REFUSED" in out,
          out.strip().splitlines()[:1])

    # `song`'s BLUEPRINT IS ITS FIRST POSITIONAL, so `--blueprint=` had
    # nothing to bind to: parsed, stripped, never opened. MEASURED with a
    # path that does not exist -- byte-identical to omitting it, exit 3.
    plain = run("song", bp, ly, "--cliques", expect_rc=3)
    ghost = run("song", bp, ly, "--cliques",
                "--blueprint=/nonexistent/nope.json", expect_rc=2)
    check("`song --blueprint=` REFUSES rather than being silently ignored",
          ghost[0] == 2 and "FIRST POSITIONAL" in ghost[1],
          f"rc {ghost[0]}")
    check("and it names BOTH spellings, so the caller can see which lost",
          "/nonexistent/nope.json" in ghost[1] and bp in ghost[1],
          "a coordinate declared twice and read once is doctrine 1's case")
    check("the plain positional run is untouched",
          ghost[1] != plain[1] and plain[0] == 3, f"rc {plain[0]}")

    # AND THE GUARD ABOVE MUST NOT FIRE ON THE ONE VERB THAT ALWAYS HAS A
    # BLUEPRINT. `song`'s is `args[1]`, so `bp_path is None` is true on every
    # legitimate `song` run -- asking that question refused
    # `song BP LYRIC --subdivision N`, a command whose blueprint is sitting in
    # the argument list, on all seven of this file's `song --subdivision`
    # invocations. THAT IS WHAT THE FIRST VERSION OF THIS SECTION MISSED: it
    # tested `song --blueprint=` and `brief --subdivision`, the two halves
    # separately, and never the pair -- a check that could not fail on the
    # combination the guard actually broke. The battery caught it; this
    # section did not, and that is the reason these four lines exist.
    sub1 = run("song", bp, ly, "--cliques", "--subdivision", "1",
               expect_rc=3)
    sub2 = run("song", bp, ly, "--cliques", "--subdivision", "2",
               expect_rc=3)
    iso = run("song", bp, ly, "--cliques", "--isochronous", expect_rc=3)
    check("`song --subdivision N` is NOT refused for carrying the flag — its "
          "blueprint is the FIRST POSITIONAL and the guard asks about the "
          "meter layer, not about a spelling `song` does not use",
          sub1[0] == 3 and "REFUSED" not in sub1[1],
          sub1[1].strip().splitlines()[:1])
    check("and `--isochronous` likewise", iso[0] == 3
          and "REFUSED" not in iso[1], iso[1].strip().splitlines()[:1])
    check("and all three are READ, not merely tolerated: 1, 2 and isochronous "
          "each produce a report the plain run does not",
          len({plain[1], sub1[1], sub2[1], iso[1]}) == 4,
          "identical output under different declared subdivisions is the "
          "'accepted and dropped' shape this whole section is about")


def test_the_collision_cut_is_one_constant_and_cannot_drift():
    print("\n31. the unintended-rhyme cut is ONE constant, not two spellings "
          "of one number (FIXED 2026-08-16)")
    # `quality/revise.py`'s own `COLLISION_CUT_IS_SCALAR_ONLY` finding says the
    # two halves of this repo report THE SAME SET and that "the two constants
    # must not drift". Until 2026-08-16 nothing stopped them: `revise.py`
    # declared `THETA_COLLISION` and `lyric_harness.check_scheme` spelled a
    # bare `0.9`, so a lot moving either moved exactly one. A promise in a
    # comment is not a mechanism (doctrine 1).
    import importlib
    LH = importlib.import_module("lyric_harness")
    RV = importlib.import_module("quality.revise")
    check("`quality.revise.THETA_COLLISION` IS `lyric_harness`'s — the same "
          "object, not a second literal that happens to be equal",
          RV.THETA_COLLISION is LH.THETA_COLLISION,
          f"revise {RV.THETA_COLLISION!r} / harness {LH.THETA_COLLISION!r}")
    # AND THE SOURCE CARRIES ONE DEFINITION, which is the half an identity
    # check cannot see: two modules could each hold `= 0.9` and `is` would
    # still be True, because CPython caches small float constants per code
    # object only when they are equal by value — the assertion above would
    # pass against exactly the defect this closes if the two literals happened
    # to be folded. Counted in the TEXT instead.
    import re
    root = os.path.join(ROOT)
    decls = []
    for rel in ("lyric_harness.py", os.path.join("quality", "revise.py")):
        src = open(os.path.join(root, rel), encoding="utf-8").read()
        n = len(re.findall(r"^THETA_COLLISION\s*=", src, re.M))
        decls.append((rel, n))
    check("exactly ONE module declares it",
          sum(n for _r, n in decls) == 1, str(decls))
    # THE THIRD `0.9` IN THIS FILE IS A DIFFERENT QUESTION AND MUST STAY ONE.
    # `check_cynghanedd`'s llusg test — does a final penult rhyme an earlier
    # syllable — was given the same number and binding it to this name would
    # make a Welsh-imitation rule move whenever the English collision report
    # was retuned. Asserted so a later lot "tidying the constants" has to read
    # this rather than discover it.
    src = open(os.path.join(root, "lyric_harness.py"), encoding="utf-8").read()
    check("and the llusg threshold is still a SEPARATE literal, deliberately "
          "not bound to it",
          len(re.findall(r'if s\["total"\] >= 0\.9:', src)) == 1,
          "one question, one coordinate — the collision cut and a Welsh "
          "imitation's rhyme test are not the same setting")


def test_both_meter_coordinates_are_disclosed_and_collisions_are_typed():
    print("\n32. the report states BOTH meter coordinates, and `collisions` "
          "is not one number for three kinds (FIXED 2026-08-16)")
    # TWO COSMETIC FINDINGS, ONE SHAPE: a report naming some of what it did.
    #
    # (a) `--isochronous` was the only coordinate on these verbs that could be
    #     READ, CHANGE THE ANALYSIS, and leave no trace in the output. It is
    #     read -- `inspect()` drops the `NO_SETTING` refusal when it is given
    #     -- but `verify` prints a SET DIFFERENCE (fixed/broken/untargeted/
    #     modal_taken) and the flag moves BEFORE and AFTER identically, so
    #     every finding it adds or removes cancels. Measured byte-identical on
    #     a real pair where `--subdivision 2` DOES move the verdict body. That
    #     is not "inert" and not "read": it is a coordinate with no reading,
    #     which doctrine 1 does not allow. The banner named `subdivision` in
    #     both states and isochrony in neither.
    import io
    import importlib
    FT = importlib.import_module("quality.fit")
    RV = importlib.import_module("quality.revise")

    # THE UNDERLYING FACT FIRST, at the API, because it is what makes the
    # disclosure load-bearing rather than decorative: if `assume` changed
    # nothing, printing it would be noise.
    lines = [ln for ln in
             open(os.path.join(ROOT, "quality", "fixtures", "song.txt"),
                  encoding="utf-8").read().splitlines()
             if ln.strip() and not ln.startswith("[")]
    bp = os.path.join(ROOT, "quality", "fixtures", "song.blueprint.json")
    sub = FT.Subdivision(2, source="test 32")
    r = RV.Reviser()
    off = r.inspect(lines, "A" * len(lines), blueprint=bp, subdivision=sub)
    on = r.inspect(lines, "A" * len(lines), blueprint=bp, subdivision=sub,
                   assume=FT.Isochrony(source="test 32"))
    off_w = sorted(f.code for f in off["whole"])
    on_w = sorted(f.code for f in on["whole"])
    check("`assume` CHANGES the finding set — the disclosure below is about "
          "something real",
          off_w != on_w, f"without {off_w}\n           with    {on_w}")
    check("...specifically it retires the `NO_SETTING` refusal, which is the "
          "whole point of declaring isochrony",
          "NO_SETTING" in off_w and "NO_SETTING" not in on_w,
          f"without {off_w}\n           with    {on_w}")

    # AND NOW THE DISCLOSURE, END TO END THROUGH THE CLI. A REFUSING
    # invocation is used ON PURPOSE and it is not a shortcut: the banner is
    # printed BEFORE any refusal (doctrine 20 -- the refusal must be first
    # among the FINDINGS, but the coordinates it ran under come first of all),
    # and a non-refusing `verify` on the only blueprint fixture with a
    # matching line count costs ~90s per invocation. What is asserted is that
    # the two runs are DISTINGUISHABLE, which is exactly what was false.
    two = os.path.join(ROOT, "quality", "fixtures", "song.txt")
    a = run("verify", two, two, "A" * len(lines), f"--blueprint={bp}",
            "--subdivision", "2")[1]
    b = run("verify", two, two, "A" * len(lines), f"--blueprint={bp}",
            "--subdivision", "2", "--isochronous")[1]
    check("`verify` with and without `--isochronous` is DISTINGUISHABLE on "
          "its printed surface",
          a != b, "byte-identical output for two different analyses")
    check("...and the difference is in the BLUEPRINT banner, not somewhere "
          "incidental",
          a.splitlines()[0] != b.splitlines()[0],
          f"{a.splitlines()[0][:80]!r}\n           {b.splitlines()[0][:80]!r}")
    check("the banner names the assumption when it IS made",
          "ISOCHRONY ASSUMED" in b, b.splitlines()[0][:160])
    check("...and names its ABSENCE when it is not — a coordinate is "
          "declared in both states or it is not declared (doctrine 1)",
          "no isochrony assumed" in a, a.splitlines()[0][:160])

    # (b) `collisions N` sat at the end of the row that keeps mandated/judged/
    #     refused apart for doctrine 79, summing a set this class splits into
    #     three codes on purpose. A writer does something different about an
    #     unasked rhyme, a pair that is not a rhyme at all, and the same word
    #     twice.
    refrain = ["we walked into the night", "the lamp was burning light",
               "we walked into the night", "the lamp was burning light"]
    # `_collisions_line` and NOT `next(... startswith("collisions"))`: against
    # the pre-fix tree the count lived at the END of the `mandated ...` row, so
    # a `next()` over lines STARTING with the word raised `StopIteration` and
    # killed the section after the isochrony checks -- turning a clean
    # two-sided FAIL into a crash that skipped the four checks below it. A
    # regression that ERRORS instead of FAILING on the defect it names cannot
    # be read as a verdict (doctrine 79: a crash is not a failure).
    def _collisions_line(text):
        for ln in text.splitlines():
            if "collisions" in ln:
                return ln
        return ""

    s = io.StringIO()
    r.report(refrain, [[1, 2], [3, 4]], stream=s)
    line = _collisions_line(s.getvalue())
    check("the `collisions` count is on its OWN line, not appended to the "
          "mandated/judged/refused row it shares no denominator with",
          line.strip().startswith("collisions"), line.strip() or "(no line)")
    check("the `collisions` count is BROKEN OUT by kind",
          "—" in line, line.strip() or "(no line)")
    check("...and a REFRAIN's returning lines are typed `same-word`, not "
          "folded in with the rhymes",
          "same-word 2" in line and "unasked-rhyme 2" in line, line.strip())
    # TWO-SIDED: the same report on a draft with no repeated end word must NOT
    # claim a `same-word` collision. A breakdown that always prints every
    # label is the same defect as a single number wearing more words.
    s2 = io.StringIO()
    r.report(refrain, [[1, 3], [2, 4]], stream=s2)
    line2 = _collisions_line(s2.getvalue())
    check("...and the labels are DERIVED, not decoration: the same lines "
          "under a mandate that makes the repeats intra-group report no "
          "`same-word` collision at all",
          "same-word" not in line2, line2.strip())
    # THE KINDS MUST ACCOUNT FOR THE TOTAL. Without this, a code added to
    # `_collision_code` and not to the header's label map would vanish from
    # the breakdown while the total still counted it -- a report whose parts
    # do not sum to its own whole, which is the defect one level in.
    import re as _re
    _m = _re.search(r"collisions (\d+)", line)
    total = int(_m.group(1)) if _m else -1
    parts = (sum(int(x) for x in _re.findall(r"\b(\d+)\b", line.split("—")[1]))
             if "—" in line else -2)
    check("the kinds SUM to the total — no collision falls outside every "
          "label",
          total == parts, f"total {total}, kinds sum {parts}: "
                          f"{line.strip() or '(no line)'}")


def test_every_report_names_the_draft_it_read():
    print("\n33. a report names WHAT it graded — line count and fingerprint, "
          "on every surface a figure gets quoted from (BUILT 2026-08-16)")
    # THE DEFECT THIS PINS WAS COMMITTED, NOT HYPOTHESISED: a 41-line fixture
    # was graded in place of the 41-line song a RESULTS document is about,
    # the 41-character mandate bound cleanly to the wrong draft, and the
    # complete, plausible report that came back was recorded as a drift in a
    # figure that had never moved. A length that matches is not an identity
    # that matches — and `report()` printed nothing else about its input, so
    # nothing on the page could have shown the difference. The fingerprint
    # is that missing coordinate (doctrine 1: an analysis states what it was
    # run under, and the INPUT is the first such coordinate).
    import hashlib
    import importlib
    import io
    RV = importlib.import_module("quality.revise")
    r = RV.Reviser()
    A = ["we walked into the night", "the lamp was burning light",
         "we walked into the night", "the lamp was burning light"]
    # SAME LINE COUNT, different words — the exact shape that slipped
    # through: every structural check (mandate arity, line count) is
    # satisfied by both, and only content tells them apart.
    B = ["a shadow crossed the empty wall", "and nothing here can hold",
         "we sank right through the floor", "the tide came back again"]

    def _draft_line(text):
        for ln in text.splitlines():
            if ln.strip().startswith("draft:"):
                return ln.strip()
        return ""

    def _rep(lines):
        s = io.StringIO()
        r.report(lines, [[1, 3], [2, 4]], stream=s)
        return s.getvalue()

    da, da2, db = _draft_line(_rep(A)), _draft_line(_rep(A)), \
        _draft_line(_rep(B))
    check("`Reviser.report()` prints a `draft:` line carrying the count of "
          "lines it graded",
          da.startswith("draft: 4 line(s)"), da or "(no draft line)")
    # RECOMPUTABLE BY A READER, or it is a decoration: the printed hex must
    # be re-derivable from the draft by the stated rule (md5 over the joined
    # lines, first 12), so a figure pinned in a document can be CHECKED
    # against a candidate text later, which is the entire use.
    want = hashlib.md5("\n".join(A).encode("utf-8")).hexdigest()[:12]
    check("...and the fingerprint is RECOMPUTABLE from the draft by the "
          "stated rule, not an opaque token",
          want in da, f"expected md5 {want} in: {da or '(no draft line)'}")
    check("two SAME-LENGTH drafts get DIFFERENT fingerprints — the 41=41 "
          "case that produced the false collisions-69 repin",
          bool(da) and bool(db) and da != db,
          f"{da or '(none)'}\n           {db or '(none)'}")
    check("...and the fingerprint is DETERMINISTIC: the same draft twice "
          "prints the same non-empty line",
          bool(da) and da == da2, f"{da!r} vs {da2!r}")

    # END TO END THROUGH THE CLI, on both report surfaces. `brief` (which
    # `song` shares) and `verify` — the verb least able to show its inputs,
    # because its whole output is a set difference and everything the wrong
    # draft changes on both sides cancels.
    d = tempfile.mkdtemp()
    fb, fa = os.path.join(d, "b.txt"), os.path.join(d, "a.txt")
    with open(fb, "w") as fh:
        fh.write("we walked into the night\nthe lamp was burning bright\n")
    with open(fa, "w") as fh:
        fh.write("we walked into the night\nthe lamp was burning light\n")
    # GROUND TRUTH FOR THE CLI HALF, not just shape. This test WROTE these
    # files, so it can recompute what every surface must print — and it has
    # to, because without this an implementation that fingerprints the wrong
    # thing consistently (verify's AFTER computed off a different draft; the
    # raw file bytes instead of the graded lines) passes every shape and
    # agreement check below while committing exactly the wrong-identity
    # defect this section exists to close. Found by a hostile mutation
    # during review: `draft_fingerprint(after + ['x'])` at the AFTER print
    # went 13/13 green against the first draft of this section.
    fp_b = hashlib.md5(b"we walked into the night\n"
                       b"the lamp was burning bright").hexdigest()[:12]
    fp_a = hashlib.md5(b"we walked into the night\n"
                       b"the lamp was burning light").hexdigest()[:12]
    bout = run("brief", fb, "AA")[1]
    check("`brief` prints the draft line — and the md5 is THIS file's, "
          "recomputed by the test that wrote it",
          _draft_line(bout) == f"draft: 2 line(s), md5 {fp_b}",
          f"{_draft_line(bout) or '(no draft line)'} vs expected md5 {fp_b}")
    vout = run("verify", fb, fa, "AA")[1]
    bef = next((ln.strip() for ln in vout.splitlines()
                if ln.strip().startswith("BEFORE:")), "")
    aft = next((ln.strip() for ln in vout.splitlines()
                if ln.strip().startswith("AFTER")), "")
    check("`verify` prints BOTH sides' fingerprints",
          "md5" in bef and "md5" in aft,
          f"{bef or '(no BEFORE)'} / {aft or '(no AFTER)'}")
    check("...BEFORE is the before FILE's fingerprint, recomputed — not any "
          "12 hex chars in the right place",
          bef.endswith(f"md5 {fp_b}"), f"{bef} vs expected md5 {fp_b}")
    check("...and AFTER is the after FILE's — each side hashed from its OWN "
          "draft, which is the half a shape check cannot see",
          aft.endswith(f"md5 {fp_a}"), f"{aft} vs expected md5 {fp_a}")
    check("...and the two sides DIFFER when the drafts differ — a verdict "
          "block that names neither input is the surface the wrong-draft "
          "error lived on",
          "md5" in bef and "md5" in aft
          and bef.split("md5")[-1] != aft.split("md5")[-1],
          f"{bef} / {aft}")
    check("...printed BEFORE the verdict, so a recorded verdict sits under "
          "the inputs it compared",
          "VERDICT" in vout and bool(bef)
          and vout.find("BEFORE:") < vout.find("VERDICT"),
          "the identity of the inputs is a precondition of the verdict, "
          "not a footnote to it")
    # ONE IDENTITY, TWO SURFACES: `verify`'s BEFORE fingerprint and
    # `brief`'s draft fingerprint on the same file must agree — two verbs
    # disagreeing about what one file's content IS would be the fingerprint
    # reproducing the defect it exists to close.
    bmd5 = _draft_line(bout).split("md5")[-1].strip()
    vmd5 = bef.split("md5")[-1].strip()
    check("`brief` and `verify` agree on the same file's fingerprint — one "
          "identity, not one per verb",
          bool(bmd5) and bmd5 == vmd5,
          f"brief {bmd5 or '(none)'} vs verify {vmd5 or '(none)'}")

    # AND THE LOOP — the one caller that CHANGES the draft, so `lines` on
    # its result identifies only what came OUT. Its disclosure must carry
    # BOTH ends or no reader can say what a run was asked to revise. Two
    # runs, one per direction of the (UNCHANGED) marker, because a marker
    # that always prints is a marker (doctrine 48).
    LP = importlib.import_module("quality.loop")
    # `night`/`bright` STOOD HERE UNTIL 2026-08-18 as the untouched draft —
    # then the two-tier ban made 'ight'/'ight' HOMEOTELEUTON, mandatorily
    # pursued, and the loop rightly started revising the very fixture whose
    # job is to NOT change. `bone`/`sown` is measured clean under the full
    # regime: a true rhyme, differently spelled ('one'/'own'), below the
    # frequency tier in both directions, both lines inside the meter bands.
    same = ["your laugh still shakes me to the bone",
            "the fields behind the house are sown"]
    kept = LP.revise_loop(r, same, "AA")
    kd = next((ln for ln in kept.disclosure() if "DRAFT" in ln), "")
    check("`revise_loop`'s result discloses the draft at BOTH ends — handed "
          "in and emitted",
          "handed in 2 line(s)" in kd and "emitted 2 line(s)" in kd,
          kd or "(no DRAFT line)")
    check("...the recorded input fingerprint IS the entry draft's — "
          "recomputable, like every other surface's",
          getattr(kept, "input_fingerprint", "")
          == hashlib.md5("\n".join(same).encode("utf-8")).hexdigest()[:12],
          f"recorded {getattr(kept, 'input_fingerprint', '(no field)')!r}")
    check("...a run that emitted its input verbatim SAYS SO at a glance — "
          "comparing two hex strings by eye is the step that gets skipped",
          "(UNCHANGED)" in kd, kd or "(no DRAFT line)")
    moved = LP.revise_loop(r, ["we walked into the night",
                               "the day was warm and slow"], "AA")
    md = next((ln for ln in moved.disclosure() if "DRAFT" in ln), "")
    in_fp = getattr(moved, "input_fingerprint", "")
    out_fp = RV.draft_fingerprint(moved.lines) \
        if hasattr(RV, "draft_fingerprint") else ""
    check("...and a run that CHANGED the draft shows two different "
          "fingerprints with no (UNCHANGED) claim — the marker is derived, "
          "not decoration",
          bool(in_fp) and bool(out_fp) and in_fp != out_fp
          and "(UNCHANGED)" not in md, md or "(no DRAFT line)")
    # THE ABSENT-INPUT BRANCH, exercised — a hand-built `LoopResult` (the
    # dataclass docstring licenses them; tests build them) recorded no input,
    # and its disclosure must print that absence AS an absence. An absent
    # identity rendered as nothing would read exactly like the pre-fix
    # reports; an absent identity rendered as some default hash would be an
    # INVENTED identity, which is worse. Doctrine 20's shape, one branch in.
    hand = LP.LoopResult("success", same, [], [])
    hd = next((ln for ln in hand.disclosure() if "DRAFT" in ln), "")
    check("a result built WITHOUT an input names that absence — never an "
          "invented identity, never silence",
          "NOT RECORDED" in hd and "emitted 2 line(s)" in hd
          and "handed in" not in hd, hd or "(no DRAFT line)")


def test_the_title_a_lyric_declares_reaches_the_check_or_refuses():
    print("\n30. a `--- TITLE:` line in the LYRIC is not dropped in silence "
          "(FIXED 2026-08-15)")
    # `--- TITLE:` IS THIS REPO'S OWN ITEM CONVENTION: `grid.read_marked_songs`
    # parses it into `MarkedSong.title`, `audit_corpus` counts `--- TITLE:`
    # blocks as the unit every staged file writes, and `verify_entries` reads
    # it as the rule for what a song IS. On `song` it is apparatus, so
    # `load_lyric_lines` drops it — correctly, it is not sung — AND NOTHING
    # ELSE LOOKED AT IT. The title `hook_findings` grades comes from the
    # blueprint's `"title"` key alone, so a writer who named their song the way
    # the corpus does was graded against a title they never gave.
    d = tempfile.mkdtemp()
    bp = os.path.join(ROOT, "quality", "fixtures", "song.blueprint.json")
    ly = os.path.join(ROOT, "quality", "fixtures", "song.txt")
    titled = os.path.join(d, "titled.txt")
    with open(ly, encoding="utf-8") as fh:
        body = fh.read()
    with open(titled, "w", encoding="utf-8") as fh:
        fh.write("--- TITLE: The Whole Of My Wattage\n" + body)

    # THE CONTROL FIRST, and it is what makes the rest mean anything: with no
    # TITLE line the run is untouched.
    plain = run("song", bp, ly, "--cliques", expect_rc=3)
    check("a lyric with no `--- TITLE:` line grades exactly as before",
          plain[0] == 3 and "REFUSED" not in plain[1], f"rc {plain[0]}")

    rc, out, err = run("song", bp, titled, "--cliques", expect_rc=2)
    check("a title the lyric declares and the blueprint does not REFUSES "
          "rather than being dropped — MEASURED byte-identical before this "
          "(md5 d3ca7fb536), which is what a silent drop looks like",
          rc == 2 and "REFUSED" in out and "Traceback" not in err,
          out.strip().splitlines()[:1])
    check("and it names BOTH spellings, so the caller can see which one the "
          "grader actually reads",
          "The Whole Of My Wattage" in out and "blueprint" in out
          and "(absent)" in out,
          "a coordinate declared twice and read once is doctrine 1's case")

    # THE OTHER SIDE: declared in BOTH and agreeing, the run proceeds. Without
    # this the section would pass against a build that refused every lyric
    # carrying a title, which is a different defect wearing the same rc.
    import json
    with open(bp, encoding="utf-8") as fh:
        obj = json.load(fh)
    obj["title"] = "The Whole Of My Wattage"
    match = os.path.join(d, "match.blueprint.json")
    with open(match, "w", encoding="utf-8") as fh:
        json.dump(obj, fh)
    rc2, out2, _ = run("song", match, titled, "--cliques", expect_rc=3)
    check("and a lyric title that AGREES with the blueprint's grades normally",
          rc2 == 3 and "REFUSED" not in out2, f"rc {rc2}")
    # The comparison is case-insensitive on purpose: a title is a NAME, and
    # `The Whole Of My Wattage` against `The whole of my wattage` is not two
    # declarations disagreeing.
    with open(titled, "w", encoding="utf-8") as fh:
        fh.write("--- TITLE: the whole of my wattage\n" + body)
    rc3, out3, _ = run("song", match, titled, "--cliques", expect_rc=3)
    check("case alone is not a disagreement — a title is a name, not a token",
          rc3 == 3 and "REFUSED" not in out3, f"rc {rc3}")




def test_the_structures_spelling_reaches_the_verbs():
    """`--structures=` — SHIPPED BY THE KALEVALA ADOPTION (2026-08-18).

    The structures registration deferred the CLI spelling to the first
    calibration on purpose; that calibration adopted, so the spelling
    ships. The binding assertion is a DIFFERENCE between two runs (the
    §19 lesson: byte-identical output is the only shape that proves a
    silent drop): the same draft under the same groups grades sun/silver
    a VIOLATION without the declaration and NOT one with it.
    """
    print("\n39. `--structures=` reaches the verbs — the Kalevala "
          "adoption's own spelling")
    import tempfile
    lines = ["the night was cold and bright", "we held each other tight",
             "we walked beneath the sun", "and rivers ran with silver"]
    with tempfile.NamedTemporaryFile("w", suffix=".txt",
                                     delete=False) as fh:
        fh.write("\n".join(lines) + "\n")
        path = fh.name
    try:
        rc1, out1, _ = run("brief", path, "--groups=1,2;3,4",
                           "--structures=B:kalevala-alliteration")
        rc0, out0, _ = run("brief", path, "--groups=1,2;3,4")
        check("the declaration CHANGES the grade — sun/silver is a "
              "violation under the default question and NOT under the "
              "declared alliteration",
              rc1 == 0 and "SCHEME_VIOLATION" not in out1
              and "SCHEME_VIOLATION" in out0)
        check("...and the run that declared it carries the language-aware "
              "disclosure: fin-calibrated, this draft is eng, laziness is "
              "NOT graded",
              "STRUCTURE_UNCALIBRATED" in out1
              and "FOR THIS DRAFT'S LANGUAGE (eng)" in out1)
        rc2, out2, _ = run("brief", path, "--groups=1,2",
                           "--structures=A:vibes")
        check("an unknown structure name REFUSES through the catalog's "
              "own message, never defaulted",
              rc2 == 2 and "not a declared structure" in out2
              and "58 structures" in out2)
        rc3, out3, _ = run("brief", path, "--structures=A:qafiya")
        check("--structures= with no groups to annotate REFUSES and says "
              "what to declare",
              rc3 == 2 and "no groups to annotate" in out3)
        rc4, out4, _ = run("brief", path, "AABB",
                           "--structures=B:kalevala-alliteration")
        check("a letter scheme WITH --structures= is expressible — the "
              "letter determines the cover, structures annotate it",
              rc4 == 0 and "STRUCTURE_UNCALIBRATED" in out4)
    finally:
        os.unlink(path)




def test_the_seed_sweep_is_reachable_from_the_command_line():
    print("\n40. THE SEED SWEEP is a VERB, not a scratch script "
          "(`MISSING.md` M-82)")
    # THE POINT OF THIS SECTION IS REACHABILITY. `quality/test_plan.py` §10
    # exercises `sweep()` at the API; what CLAUDE.md's standing rule 3 is
    # about is whether a person can RUN it — "any measurement or step used in
    # producing a delivered song goes through a verb, and an improvised
    # script used twice is a defect report, not a convenience."
    WANT = ("--want=sections<=6;lines_per_section>=2;group<=4;"
            "uses=verse,chorus;before=verse,chorus;pins_per_line<=5")
    # ~~`--sweep=0-120` and `" 108" in out`.~~ **REPINNED 2026-08-24
    # (`MISSING.md` M-106), the CLI mirror of `test_plan.py` §10's repin and
    # for the same reason.** The seed that satisfies a six-way conjunction is
    # a property of the PLANS, and the plans were re-derived when the length
    # envelope stopped being the union of three kinds of text; the VERB is
    # untouched and every predicate is still individually satisfiable. The
    # range is widened rather than the predicates loosened — loosening them
    # to keep a number would be tuning the question to preserve the answer.
    # ~~`--sweep=0-400`~~ **WIDENED AGAIN 2026-08-28, same rule, third rung
    # of the same ladder: M-52's patter row remapped all 60 measured seed
    # patterns, and 0..400 now holds NO seed satisfying the conjunction —
    # the sweep's own empty-set refusal (exit 2 with the rate) fired,
    # which is the verb working. Measured: 0..1600 accepts 2 (1105, 1540,
    # 0.1% of the planned), so the range is 0-1600 and the acceptance
    # stays read off the run, never remembered.**
    # WHAT THIS SECTION IS ABOUT IS REACHABILITY, so what it asserts is that
    # a person running the command GETS AN ANSWER: a non-empty accepted list
    # that agrees with the header's own count, which is a stronger property
    # than one remembered integer and cannot go stale when the planner moves.
    rc, out, _ = run("plan", "--sweep=0-1600", WANT, expect_rc=0)
    _acc = [l for l in out.splitlines() if "accepted" in l and "swept" in l]
    _n = int(re.search(r"accepted (\d+)", _acc[0]).group(1)) if _acc else 0
    check("the sweep RUNS from the command line and comes back with seeds — "
          "and the header's count agrees with the list it printed",
          rc == 0 and _n > 0 and "ACCEPTED (in seed order" in out
          and len([x for x in out.split("ACCEPTED (in seed order")[1]
                   .splitlines()[1].split(",") if x.strip()]) == _n,
          f"{_n} accepted :: {_acc[:1]}")
    check("...and it ECHOES every predicate with the coordinate's own gloss, "
          "so a caller can see which declaration was applied rather than "
          "inferring it from the answer",
          out.count("WANT ") == 6 and "the SMALLEST sung section" in out,
          f"{out.count('WANT ')} predicates echoed")
    check("...and prints THREE COUNTS, never summed (doctrine 79)",
          "swept 1600" in out and "planned" in out
          and "REFUSED by the planner" in out and "accepted" in out,
          [l for l in out.splitlines() if "swept" in l][:1])
    check("...and says OUT LOUD that it does not rank, which is the whole "
          "refusal: doctrine 7 enforces a floor and does not order the "
          "permitted region",
          "does NOT rank" in out and "doctrine 19" in out)
    # THE FIRST ACCEPTED SEED, READ OFF THE OUTPUT — not the remembered 108
    # (M-106). What is under test is that the handover names a seed the sweep
    # ACTUALLY accepted, which is checkable against the list the same run
    # printed and is what a literal could never assert.
    _first = out.split("ACCEPTED (in seed order")[1].splitlines()[1].split(
        ",")[0].strip()
    check("...and hands over the NEXT command rather than a plan, naming the "
          "FIRST accepted seed, because a plan is a pure function of its seed "
          "and nothing should carry over from the search",
          f"NEXT: python3 lyric_harness.py plan --seed={_first}" in out,
          f"first accepted {_first!r} :: "
          f"{[l for l in out.splitlines() if 'NEXT:' in l][:1]}")
    # NO DEFAULT PREDICATE — and the verb says so instead of quietly
    # accepting everything as though that had been asked for.
    rc, out, _ = run("plan", "--sweep=0-8", expect_rc=0)
    check("a sweep with NO predicate accepts everything and SAYS it is "
          "deciding nothing — a default here would be the instrument "
          "choosing what the caller wants",
          rc == 0 and "no predicate declared" in out
          and "there is no default" in out)
    # THE REFUSALS. Each is a way of putting a declaration wrong, and each
    # must be refused BY NAME rather than read as a filter that matched
    # nothing (doctrine 20).
    for args, needle in (
            (("plan", "--sweep=0-20", "--want=sections<=1"),
             "no seed in 0..19"),
            (("plan", "--sweep=0-20", "--seed=3"),
             "--seed OR --sweep"),
            (("plan", "--sweep=0-20", "--want=vibes<=3"),
             "not a coordinate"),
            (("plan", "--sweep=0-20", "--want=sections<3"),
             "carries none of"),
            (("plan", "--sweep=0-20", "--fill=x.txt"),
             "does not take --fill"),
            (("plan", "--sweep=nope"),
             "is not a range")):
        rc, out, err = run(*args, expect_rc=2)
        check(f"`{' '.join(args[1:])}` REFUSES at exit 2, naming the cause",
              rc == 2 and needle in (out + err), needle)
    # AND THE UNREACHABLE CASE CARRIES ITS RATE, because "no seed satisfies
    # this" and "this range was too small" are different answers and the
    # acceptance rate is what separates them.
    rc, out, _ = run("plan", "--sweep=0-20", "--want=sections<=1",
                     expect_rc=2)
    check("...and the empty accepted set REFUSES with the acceptance rate "
          "beside it, so unreachable and merely rare stay distinguishable",
          "accepted 0" in out and "unreachable in this range" in out,
          [l for l in out.splitlines() if "accepted 0" in l][:1])


def test_fill_reads_a_draft_the_way_every_other_verb_does():
    print("\n41. `plan --fill` USES THE ONE DEFINITION OF SUNG TEXT — the "
          "SIXTH holdout from it (`MISSING.md` M-83)")
    # FOUND BY WRITING A SONG, not by reading the code. The planner's own
    # `writer_brief` prints a `[INTRO — 3 lines — ...]` header per section and
    # says "Write a song: N lines, M sections". `--fill` then read the draft
    # with a bare `open()` + `if l.strip()`, so those headers counted as
    # LYRIC and the draft was refused BY LINE COUNT — the refusal naming the
    # draft for a miscount the reader made (doctrine 20).
    #
    # WHY THE STANDING GREPS MISS IT. CLAUDE.md ends the apparatus paragraph
    # on `grep -rn 'startswith("--- ")'` and `grep -rn 'startswith("\[")'`.
    # Neither finds this site, because it tests no prefix at all. So the
    # check that the centralization is finished has to be a RUN, not a grep.
    # The declared line count comes from the verb's OWN artifact, never from
    # a literal — seed 108's shape is a property of the planner and a number
    # written here would go stale the next time a space is re-derived, which
    # is the defect `mcp/test.mjs` was repaired for (doctrine 58).
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as ph:
        plan_path = ph.name
    try:
        run("plan", "--seed=108", f"--out={plan_path}", expect_rc=0)
        with open(plan_path, encoding="utf-8") as fh:
            n = json.load(fh)["total_lines"]
    finally:
        os.unlink(plan_path)
    body = [f"line {i} holds its place in the count" for i in range(1, n + 1)]
    # ALL THREE APPARATUS SPELLINGS AT ONCE, which is the population the one
    # definition covers and the inline reader covered none of.
    marked = ["--- TITLE: the sixth holdout", "# a stage direction"]
    for i, text in enumerate(body):
        if i % 4 == 0:
            marked.append(f"[SECTION{i // 4}]")
        marked.append(text)
    with tempfile.NamedTemporaryFile("w", suffix=".txt", delete=False,
                                     encoding="utf-8") as fh:
        fh.write("\n".join(marked) + "\n")
        path = fh.name
    try:
        rc, out, err = run("plan", "--seed=108", f"--fill={path}",
                           expect_rc=0)
        check("a draft carrying `[SECTION]`, `#` and `--- TITLE:` FILLS — "
              "the apparatus the plan's own brief tells a writer to put "
              "there is not counted as sung text",
              rc == 0 and "REFUSED" not in (out + err),
              [l for l in (out + err).splitlines() if "REFUSED" in l][:1]
              or f"rc={rc}")
        # THE MUTATION IS THE POINT: the pre-fix reader is re-created here and
        # must produce the refusal this section exists to end. Without this
        # the check above passes on any tree that happens to accept the file.
        raw = [l.rstrip("\n") for l in open(path, encoding="utf-8")
               if l.strip()]
        check("...and the pre-fix reader, re-created, MISCOUNTS it — so the "
              "check above is not passing on a draft that had nothing to "
              "drop", len(raw) > n and len(lh.load_lyric_lines(path)) == n,
              f"inline {len(raw)} vs one-definition "
              f"{len(lh.load_lyric_lines(path))}, plan declares {n}")
        # THE CONTROL, and it must hold on BOTH trees: a draft with no
        # apparatus is byte-identical either side of the repair. The fix adds
        # a drop rule; it changes nothing for a file with nothing to drop.
        with tempfile.NamedTemporaryFile("w", suffix=".txt", delete=False,
                                         encoding="utf-8") as fh2:
            fh2.write("\n".join(body) + "\n")
            bare = fh2.name
        try:
            rc2, out2, _ = run("plan", "--seed=108", f"--fill={bare}",
                               expect_rc=0)
            check("CONTROL — a headerless draft fills exactly as before, so "
                  "the repair moved only the apparatus case",
                  rc2 == 0 and all(b in out2 for b in body[:3]),
                  f"rc={rc2}")
        finally:
            os.unlink(bare)
    finally:
        os.unlink(path)


def test_the_ban_is_unskippable_at_the_grading_verb_too():
    print("\n42. THE TWO-TIER BAN GATES `song`, not only `revise` "
          "(`MISSING.md` M-88)")
    # FOUND BY BEING ASKED WHY A SONG HAD NOT GONE THROUGH `revise`. The
    # honest answer was that the session skipped it — and the sharper one is
    # that NOTHING STOPPED IT. `loop.MANDATORY_PURSUE` holds a line open
    # inside the loop; the grading verb read the same finding as a note and
    # exited 0. CLAUDE.md's own sentence — "the ban is unskippable at any
    # exit code" — was true of the loop and false of the verb.
    #
    # `hair`/`chair` is the canonical tier-1 pair: CLAUDE.md records it as one
    # of the three that beat the single top-N cliff and forced the two tiers.
    banned = "I ran my fingers through her hair\nand set the bottle on the chair\n"
    # THE CONTROL PAIR MUST RHYME AND BE CLEAN, which is a real constraint
    # and not a detail: the first draft of this check used `hair`/`floor`,
    # which do not rhyme, so it exited 3 on `SCHEME_VIOLATION` and would have
    # "passed" the section for entirely the wrong reason. `stair`/`spare` is
    # a screened-clean perfect rhyme (different spelled rime, neither in the
    # other's modal head), so the only thing separating the two fixtures is
    # the ban itself.
    clean = "She met me halfway up the stair\nand had no second breath to spare\n"
    bp = {"sections": [{"name": "V1", "function": "verse", "bars": 2,
                        "start_bar": 1,
                        "meter": {"beats": 4, "unit": 4, "groups": [2, 2]}}],
          "lines": [{"text": "x", "bar": 1, "beat": 1.0, "duration": 4.0},
                    {"text": "x", "bar": 2, "beat": 1.0, "duration": 4.0}]}
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False,
                                     encoding="utf-8") as fh:
        json.dump(bp, fh)
        bpath = fh.name
    paths = [bpath]

    def _draft(text):
        with tempfile.NamedTemporaryFile("w", suffix=".txt", delete=False,
                                         encoding="utf-8") as f2:
            f2.write(text)
            paths.append(f2.name)
            return f2.name
    try:
        rc, out, err = run("song", bpath, _draft(banned), "--groups=1,2",
                           expect_rc=3)
        blob = out + err
        check("a draft carrying a TIER-1 banned pair may not exit 0 from the "
              "GRADING verb — until now the ban was enforced only inside "
              "`revise`, so choosing the other verb skipped it",
              rc == 3 and "HOMEOTELEUTON" in blob, f"rc={rc}")
        check("...and the refusal NAMES the code and the line rather than "
              "saying a count, so a writer knows which pair to screen",
              "the two-tier ban STANDS" in blob and "L2" in blob,
              [l for l in blob.splitlines() if "ban STANDS" in l][:1])
        check("...and it says out loud that the SEVERITY did not move — the "
              "note stays a note and `verify()` is untouched, because a pair "
              "that RHYMES sits inside the region doctrine 7 forbids a floor "
              "to re-order. Re-typing it as a flag is the `MODAL_RHYME` "
              "error this repo already paid for",
              "stay notes" in blob and "verify()" in blob)
        # THE CONTROL, and it must pass on BOTH trees: an unbanned pair on the
        # identical fixture still exits 0. Without it this section would pass
        # on a build that refused every draft.
        rc2, _o2, _e2 = run("song", bpath, _draft(clean), "--groups=1,2",
                            expect_rc=0)
        check("CONTROL — the same two lines with an UNBANNED partner exit 0, "
              "so the gate fires on the ban and not on the fixture",
              rc2 == 0, f"rc={rc2}")
    finally:
        for q in paths:
            os.unlink(q)


def test_a_song_wide_relation_may_not_stand_beside_a_structure():
    """44. DECLARED, DISCLOSED, BAN-SKIPPED AND NEVER JUDGED.

    `_normalise_relations` refuses a GROUP that declares both a structure
    and a relation, on the argument that two judges over one set of pairs
    would let `grade()`'s branch order decide the mandate's meaning. That
    check reads the per-group tuple and cannot see `default_relation` —
    the coordinate `--relation=NAME` sets — while `relation_of` falls back
    to it for every group that declares none of its own. So the identical
    collision reappeared one coordinate over and nothing refused it.

    The binding assertion is the MEASUREMENT that named it: the same draft
    under the same groups grades 0 SCHEME_VIOLATION with the structure
    alone and 4 with a song-wide relation beside it — the structure never
    judged — while STRUCTURE_UNCALIBRATED fires in BOTH, so the disclosure
    vouched for a coordinate that graded nothing.
    """
    print("\n44. a song-wide relation beside a declared structure REFUSES")
    import tempfile
    lines = ["the night was cold and bright", "we held each other tight",
             "we walked beneath the sun", "and rivers ran with silver"]
    with tempfile.NamedTemporaryFile("w", suffix=".txt",
                                     delete=False) as fh:
        fh.write("\n".join(lines) + "\n")
        path = fh.name
    try:
        rc_s, out_s, _ = run("brief", path, "--groups=1,2;3,4",
                             "--structures=B:kalevala-alliteration")
        check("the structure ALONE still grades — this section cannot pass "
              "by refusing everything",
              rc_s == 0 and "SCHEME_VIOLATION" not in out_s
              and "STRUCTURE_UNCALIBRATED" in out_s)
        rc, out, _ = run("brief", path, "--groups=1,2;3,4",
                         "--structures=B:kalevala-alliteration",
                         "--relation=type:pararhyme")
        check("...and declaring a SONG-WIDE relation beside it REFUSES at "
              "exit 2 rather than letting the relation win in silence",
              rc == 2 and "song-wide relation" in out)
        check("...naming both coordinates, so the caller can see which two "
              "collided", "'type:pararhyme'" in out
              and "'kalevala-alliteration'" in out)
        check("...and naming the spelling that DOES express the mixed "
              "intent, so the refusal costs no capability",
              "--relations=" in out)
        # THE HEADLINE IS THE OTHER HALF. `NoMandate` covers two different
        # answers and one headline over both said the wrong one.
        check("the refusal does NOT claim the caller declared nothing — "
              "they declared groups, a structure and a relation "
              "(doctrine 20)",
              "given nothing to check against" not in out)
        rc_e, out_e, _ = run("brief", path)
        check("...while a genuinely empty mandate DOES still say exactly "
              "that, which is the control that keeps the split honest",
              rc_e == 2
              and "given nothing to check against" in out_e)
        # A PER-GROUP relation beside a structure on ANOTHER group is the
        # intent the refusal points at, and it must still be reachable.
        rc_p, out_p, _ = run("brief", path, "--groups=1,2;3,4",
                             "--structures=B:kalevala-alliteration",
                             "--relations=A:type:pararhyme")
        check("...and the per-group spelling the refusal recommends is "
              "ACCEPTED, so the advice is not a dead end",
              rc_p == 0 and "STRUCTURE_UNCALIBRATED" in out_p)
    finally:
        os.unlink(path)


def test_a_row_name_with_a_comma_is_still_reachable():
    """45. TWO OF 58 ROWS COULD NOT BE SPELLED THROUGH THE ONLY FLAG THAT
    REACHES THEM (`MISSING.md` M-103).

    `--structures=` split on EVERY comma, and two catalog rows carry one
    inside the name. The flag refused them naming the FRAGMENT --
    `--structures entry '-closed-syllable)' has no ':'` -- so the report
    blamed the caller's syntax for a name the catalog itself declares.

    The invariant is asserted over the WHOLE catalog rather than the two
    known rows: a later row whose name happens to contain `,LABEL:` would
    re-open this silently, and a test that names only today's two would
    not see it.
    """
    print("\n45. a catalog row whose name contains a comma is reachable")
    import re as _re
    import tempfile
    from quality import structures as _ST
    rows = sorted(_ST.STRUCTURES)
    check("the catalog is non-empty, so this section cannot pass by "
          "examining nothing", len(rows) > 1, f"{len(rows)} rows")
    commad = [n for n in rows if "," in n]
    check("...and at least one row name DOES contain a comma — the case the "
          "split used to tear in half", bool(commad), f"{commad}")
    # THE SPLIT RULE, ASSERTED OVER THE WHOLE VOCABULARY. A comma that
    # begins an entry is one followed by LABEL: — no row name may contain
    # that pattern, or the rule quietly starts tearing a different name.
    collide = [n for n in rows if _re.search(r",(?=[A-Za-z0-9]{1,3}:)", n)]
    check("...and NO row name contains the pattern the splitter treats as "
          "an entry boundary, so the rule is safe for every row and not "
          "only for today's two", not collide, f"collide: {collide or 'none'}")
    lines = ["the night was cold and bright", "we held each other tight",
             "we walked beneath the sun", "and rivers ran with silver"]
    with tempfile.NamedTemporaryFile("w", suffix=".txt",
                                     delete=False) as fh:
        fh.write("\n".join(lines) + "\n")
        path = fh.name
    try:
        rc, out, _ = run("brief", path, "--groups=1,2;3,4",
                         f"--structures=A:{commad[0]}")
        check("...and the comma-bearing row is ACCEPTED by the flag rather "
              "than refused as a broken entry",
              rc == 0 and "has no ':'" not in out, f"rc {rc}")
        # THE CONTROL, because a splitter that stopped splitting would
        # also pass the check above.
        rc2, out2, _ = run("brief", path, "--groups=1,2;3,4",
                           "--structures=A:pararhyme,B:kalevala-alliteration")
        check("...while TWO entries still separate, so the fix did not buy "
              "the comma back by refusing to split at all",
              rc2 == 0 and "STRUCTURE_UNCALIBRATED" in out2, f"rc {rc2}")
        rc3, out3, _ = run("brief", path, "--groups=1,2",
                           "--structures=A:vibes")
        check("...and an unknown name still REFUSES through the catalog's "
              "own message", rc3 == 2 and "not a declared structure" in out3)
    finally:
        os.unlink(path)


def test_the_cynghanedd_verb_reaches_caesura_and_marks():
    """M-151 (2026-08-28). `check_cynghanedd` has implemented both caesura
    readings since 2026-08-15 and M-7 made the MARK SET declarable — and
    the verb passed only `language=`, so every CLI run was marked-mode by
    a default the caller could not see, and `positions_tried` (the k
    doctrine 19/56's correction needs) reached the command line through
    nothing. Both entrances now, `--lang`-shaped, with the coordinate and
    its k PRINTED on every cym run.

    The binding assertions are M-7's own measured contrasts driven through
    the verb: the same dash-printed line answers SAIN at k=15 under
    `--caesura=search` and NOTHING at k=1 under the marked default —
    a type that exists only because the boundary was swept — and the
    marked reading with the edition's dash DECLARED (`--marks=--`) reads
    the printed gwant where the default marks cannot.
    """
    print("\n46. the cynghanedd verb reaches --caesura and --marks (M-151)")
    ust = "Ust! y ffrwd,--pa sibrwd sydd?"
    rc_s, out_s, _ = run("cynghanedd", "--caesura=search", ust)
    check("`--caesura=search` is read, PRINTED, and reports its k — the "
          "doctrine 19/56 coordinate reaches the page",
          rc_s == 0 and "caesura: search" in out_s
          and "15 position(s) tried" in out_s and "SAIN" in out_s,
          [l for l in out_s.splitlines() if "caesura" in l][:1])
    rc_m, out_m, _ = run("cynghanedd", ust)
    check("the DEFAULT is marked-mode at k=1 and says so — the same line, "
          "no sain, because the type exists only under the sweep (M-7's "
          "own contrast, at the verb)",
          rc_m == 0 and "caesura: marked" in out_m
          and "1 position(s) tried" in out_m and "SAIN" not in out_m
          and "marks: / |" in out_m,
          [l for l in out_m.splitlines() if "caesura" in l][:1])
    och = "Och o'u swn!--yn gasach sydd;"
    rc_d, out_d, _ = run("cynghanedd", "--marks=--", och)
    check("`--marks=--` declares a dash-printed edition's own convention "
          "and the marked reading answers on the printed gwant",
          rc_d == 0 and "marks: --" in out_d
          and any(k in out_d for k in ("TRAWS", "CROES", "SAIN", "LLUSG")),
          [l for l in out_d.splitlines()][-2:])
    rc_b, out_b, _ = run("cynghanedd", "--caesura=bogus", "x")
    check("an undeclared caesura value REFUSES by vocabulary at exit 2",
          rc_b == 2 and "marked, search" in out_b)
    rc_e, out_e, _ = run("cynghanedd", "--marks=", "x")
    check("an EMPTY mark set REFUSES rather than matching nothing",
          rc_e == 2 and "EMPTY" in out_e)
    rc_c, out_c, _ = run("cynghanedd", "--lang=eng", "--marks=--", "a, b")
    check("`--lang=eng` with `--marks` REFUSES naming the conjunction — "
          "the imitation splits on commas and the coordinate would be "
          "consumed and ignored (doctrine 20)",
          rc_c == 2 and "--lang=eng" in out_c and "cym" in out_c)
    rc_ok, out_ok, _ = run("cynghanedd", "--lang=eng",
                           "the cattle waded, the kettle boiled")
    check("...and plain `--lang=eng` still runs — the refusal is the "
          "conjunction, never the language",
          rc_ok == 0 and "IMITATION" in out_ok)
    rc_h, out_h, _ = run("--help")
    check("the usage row names both flags — the three-sets-equal gate's "
          "own subject",
          "--caesura=marked|search" in out_h and "--marks=M,M" in out_h)


def test_every_workflow_file_is_parseable_yaml():
    print("\n43. THE CI WORKFLOW PARSES — checked HERE because a broken one "
          "cannot run the check that catches it (`MISSING.md` M-89)")
    # FOUND BY BEING TOLD TO GET CI GREEN. `.github/workflows/ci.yml` had been
    # INVALID YAML since `18835a4` — a `- name:` whose unquoted value contained
    # `": "`, which YAML reads as a nested mapping. GitHub could not parse the
    # workflow, so every run since started with ZERO JOBS and reported
    # `failure`. The repository had no CI signal at all for that stretch, and
    # the failure looked identical to a real one, so it trained everybody to
    # ignore the light.
    #
    # THE CHECK CANNOT LIVE IN CI, which is the whole point and the reason it
    # is in a local suite. A workflow that does not parse runs nothing —
    # including a step that would have validated it. The only place this can
    # fail usefully is before the push.
    #
    # AND THE FIRST SHIPPING OF THIS CHECK COULD NOT RUN IN CI — a bare
    # `import yaml` at the top of the body, on a runner with no PyYAML. It went
    # green on a developer machine that happened to carry the package, and in
    # CI it raised `ModuleNotFoundError` at MODULE level, so shard 1 died HERE
    # and every section after this one never ran. A check that takes out the
    # rest of the suite when its instrument is missing is worse than the defect
    # it names. The parser is installed by the job now (`verbs`, beside nltk),
    # and its ABSENCE is a FAILING CHECK that names the install rather than a
    # traceback that names a check nobody wrote: CANNOT RUN is never PASS
    # (doctrine 20), and it may not be silent either.
    import glob
    try:
        import yaml                                    # noqa: PLC0415
    except ImportError as exc:                         # noqa: BLE001
        yaml = None
        _why = f"{type(exc).__name__}: {exc}"
    check("the YAML parser this section grades with is REACHABLE — without it "
          "the question is not answered NO, it is NOT ASKED, and this suite "
          "must say so rather than skip (`python3 -m pip install PyYAML`)",
          yaml is not None, "PyYAML present" if yaml else _why)
    if yaml is None:
        return
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    files = sorted(glob.glob(os.path.join(root, "..", ".github", "workflows",
                                          "*.yml"))
                   + glob.glob(os.path.join(root, "..", ".github", "workflows",
                                            "*.yaml")))
    check("there are workflow files to check, so this section cannot pass by "
          "examining nothing", bool(files),
          [os.path.basename(f) for f in files])
    for f in files:
        name = os.path.basename(f)
        try:
            doc = yaml.safe_load(open(f, encoding="utf-8"))
            err = ""
        except Exception as exc:                        # noqa: BLE001
            doc, err = None, f"{type(exc).__name__}: {exc}"
        check(f"`{name}` is parseable YAML — GitHub starts ZERO jobs on one "
              f"that is not, and reports `failure`, which is "
              f"indistinguishable from a real red",
              not err, err or "parses")
        check(f"...and `{name}` declares at least one job, so a file that "
              f"parses to something structurally empty is not read as green",
              isinstance(doc, dict) and bool(doc.get("jobs")),
              f"{len((doc or {}).get('jobs', {}))} job(s)")


def test_finish_is_the_one_door_from_draft_to_rendered_song():
    print("\n44. `finish` — THE SEAM: no rendered song without a stop "
          "condition (`MISSING.md` M-154, owner's directive 2026-08-28)")
    # THE FAILURE THIS VERB CLOSES was never that a layer graded wrong — it
    # is that the revise loop was a step a writer COULD run, and every
    # enforcement downstream of "could" was disclosure. `finish` reads the
    # mandate, blueprint and subdivision off the PLAN the seed names, runs
    # the loop to a STOP CONDITION, and the render call sits AFTER the
    # loop's return — so a suspended run emits the writer's question and no
    # song, structurally. The checks here are the seam's own claims, and
    # the two load-bearing ones are 5 (a suspended run leaks NO render) and
    # 6 (the render exists exactly past a stop condition, stamped with the
    # exit code the process actually returns).
    #
    # COST DISCIPLINE: seed 16 is the smallest shape in 1..80 (23 lines —
    # found by `plan --sweep=1-80 --want=lines<=23`, re-derivable), the
    # suspension run stops at the loop's FIRST question, and the
    # convergence run declares a zero budget (`--attempts=0 --backtrack=0`)
    # so it reaches NO_PROGRESS at roughly ONE grade's price — an honest
    # stop condition (the round asked nothing and fixed nothing), never a
    # shortcut through the gate.
    d = tempfile.mkdtemp()
    draft = os.path.join(d, "draft.txt")
    state = os.path.join(d, "state.json")

    # The draft is built from the PLAN'S OWN declared line count, never a
    # remembered one — the same rule the connector's two-block check
    # follows, and the reason this section survives a planner re-derivation.
    rc, out, _ = run("plan", "--seed=16", expect_rc=0)
    m = re.search(r"-> (\d+) line\(s\)", out)
    check("the plan declares its own line count for the fixture to honor",
          rc == 0 and m is not None, f"rc {rc}")
    n = int(m.group(1))
    bank = ("stone rain door light road name glass train hill salt wire "
            "bell coat dust song tide map north paper").split()
    with open(draft, "w") as fh:
        for i in range(n):
            fh.write(f"we carry the morning to the {bank[i % len(bank)]}\n")

    # 1-4: THE REFUSALS, each pre-loop and each naming its own cause.
    rc, out, _ = run("finish", draft, expect_rc=2)
    check("no --seed REFUSES naming the flag — the plan is the mandate's "
          "one statement", rc == 2 and "--seed" in out, f"rc {rc}")
    rc, out, _ = run("finish", draft, "--seed=16", "--blueprint=x.json",
                     expect_rc=2)
    check("--blueprint on finish REFUSES — a second statement of the meter "
          "layer beside the plan's own",
          rc == 2 and "--blueprint" in out, f"rc {rc}")
    rc, out, _ = run("finish", draft, "AABB", "--seed=16", expect_rc=2)
    check("a positional mandate REFUSES — two statements of one cover",
          rc == 2 and "mandate" in out, f"rc {rc}")
    short = os.path.join(d, "short.txt")
    with open(short, "w") as fh:
        fh.write("one line\ntwo line\n")
    rc, out, _ = run("finish", short, "--seed=16", expect_rc=2)
    check("a draft of the wrong length REFUSES with the plan's own count",
          rc == 2 and str(n) in out, f"rc {rc}")

    # 5: THE SEAM ITSELF. A deferred run with no answers suspends at the
    # loop's first question, and NO render reaches the output — not the
    # frame, not a header, not the stamp. This is the check that the render
    # call sits after the loop's return rather than beside it.
    rc, out, _ = run("finish", draft, "--seed=16",
                     f"--propose=defer:{state}", expect_rc=4)
    check("a deferred run with no answers SUSPENDS at exit 4",
          rc == 4 and "SUSPENDED" in out, f"rc {rc}")
    check("...and NO render reaches a suspended run — the seam holds",
          "[FINISHED" not in out and "THE SONG, PERFORMANCE ORDER" not in out,
          "the render exists only past a stop condition")
    check("...and the state file holds the question, so the run is resumable",
          os.path.exists(state)
          and json.load(open(state)).get("pending") is not None, state)
    # `MISSING.md` M-203, 2026-09-03 — FOUND BY READING `finish`'s OWN OUTPUT
    # on the first brief of a from-scratch song. The BLUEPRINT banner read
    # `sub_arg`, the `--subdivision` FLAG, and `finish` DOES NOT TAKE that
    # flag: it builds the coordinate from the plan artifact. So every
    # `finish` run printed "NO SUBDIVISION DECLARED — the slot questions
    # refuse rather than assume one" while the loop graded under the plan's
    # own subdivision and those questions were ANSWERED — the same output
    # carrying both halves of a contradiction one line apart, since the
    # MANDATE line directly above already says the subdivision is the plan's.
    # Two checks, because the defect was BOTH a false sentence and a pair of
    # sentences that disagreed.
    check("the BLUEPRINT banner names the subdivision the run is GRADED "
          "under — the plan's own — not the flag this verb does not take",
          "NO SUBDIVISION DECLARED" not in out
          and re.search(r"subdivision=\d+ \(the plan's own declared "
                        r"subdivision \(seed 16\)", out) is not None,
          next((l for l in out.splitlines() if "BLUEPRINT:" in l), "(none)"))
    check("...and it AGREES with the MANDATE line above it — one fact, one "
          "statement (doctrine 1), where the two used to contradict",
          "the subdivision is the plan's own" in out
          and "NO SUBDIVISION DECLARED" not in out,
          next((l for l in out.splitlines() if "MANDATE: read from" in l),
               "(none)")[:120])

    # 6: PAST A STOP CONDITION THE RENDER EXISTS, stamped with the exit the
    # process actually returns. The zero budget reaches NO_PROGRESS
    # honestly; whatever the stop, the stamp and the process must agree.
    rc, out, _ = run("finish", draft, "--seed=16", "--attempts=0",
                     "--backtrack=0")
    stamp = re.search(r"\[FINISHED — seed 16 — exit (\d) — (\w+) after "
                      r"(\d+) round\(s\) — ([^\]]+)\]", out)
    check("a stop condition renders the song under its stamp",
          rc in (0, 3) and "THE SONG, PERFORMANCE ORDER" in out
          and stamp is not None, f"rc {rc}")
    check("...the stamp's exit code IS the process's — it cannot say "
          "finished about a run that is not",
          stamp is not None and int(stamp.group(1)) == rc,
          stamp.group(0) if stamp else "(no stamp)")
    # WIDENED 2026-09-01 (`MISSING.md` M-186): a 3 can now also be a
    # WHOLE-DRAFT FLAG with no open line, and the stamp names it as its own
    # clause — so "3 iff UNRESOLVED" became "3 iff UNRESOLVED or a
    # whole-draft flag", two counts never summed (doctrine 79).
    check("...and the stamp names the stop reason and the open lines (or "
          "the whole-draft flag), so a parked song cannot read as a clean "
          "one",
          stamp is not None
          and stamp.group(2) in ("SUCCESS", "NO_PROGRESS", "ROUND_LIMIT")
          and ((("UNRESOLVED" in stamp.group(4))
                or ("WHOLE-DRAFT FLAG" in stamp.group(4))) == (rc == 3)),
          stamp.group(0) if stamp else "(no stamp)")
    check("...and the render carries the plan's own bracket headers",
          re.search(r"\[[A-Z_]+ — \d+ lines? — ", out) is not None,
          "the section header format is the measurement carrier (M-97)")

    # 7: the budget flags are the loop's own and refuse elsewhere.
    rc, out, _ = run("brief", draft, "--groups=1,2", "--max-rounds=2",
                     expect_rc=2)
    check("--max-rounds on `brief` REFUSES — only the loop verbs own a "
          "budget", rc == 2 and "--max-rounds" in out, f"rc {rc}")


def test_a_missing_staged_resource_refuses_instead_of_crashing():
    print("\n47. a missing STAGED RESOURCE refuses at exit 2 on the verbs "
          "that need it, and the rest still answer (M-188)")
    # THE DEFECT, MEASURED 2026-09-01 at 54650e5 (before the fix) with the
    # same three hides used below, on `brief q.txt ABAB`: norms absent --
    # exit 1, zero stdout, one stderr line `run quality/fetch_data.py first`;
    # nltk unimportable -- exit 1, an ImportError traceback out of
    # `features._tagger`; tagger model absent -- exit 1, a LookupError
    # traceback AFTER the report's first line had printed. `score fire --
    # desire` exited 0 in the same tree. Exit 1 is outside the 0/2/3/4
    # contract, and `mcp/lyric_tools.js` reads it as a crashed subprocess
    # (CI run #555, 2026-08-18, is the precedent ci.yml cites).
    #
    # THE HIDES NEVER TOUCH THE SHARED TREE. `data/concreteness.txt` and
    # `data/nltk` are symlinks every worktree on the box reads, so the norms
    # are hidden by `LYRIC_STAGED_DATA` (read in ONE place,
    # `quality/features.py`, and named in the refusal), the model by nltk's
    # own `NLTK_DATA`, and the package by a stub on `PYTHONPATH` whose
    # `__init__` refuses to import -- the same `env=` overlay §17 uses.
    from quality.features import STAGED_RESOURCES, STAGING_COMMANDS
    cases, quat, bp = _every_verb_fixture()
    d = tempfile.mkdtemp()
    empty = os.path.join(d, "empty")
    os.makedirs(empty)
    stub = os.path.join(d, "stub")
    os.makedirs(os.path.join(stub, "nltk"))
    with open(os.path.join(stub, "nltk", "__init__.py"), "w") as fh:
        fh.write('raise ImportError("nltk hidden by test_verbs.py section 47")\n')
    real_nltk = os.path.abspath(os.path.join(ROOT, "data", "nltk"))
    HEAD = (f"REFUSED — the slop floor needs {len(STAGED_RESOURCES)} staged "
            f"resources")
    norms, package, model = STAGED_RESOURCES

    def refused(rc, out, err):
        # exit 2, the ONE refusal shape, no traceback -- and nothing on
        # stderr at all: the refusal is an ANSWER and goes where answers go.
        return rc == 2 and HEAD in out and "Traceback" not in err

    def first(out):
        return (out.strip().splitlines() or ["(no stdout)"])[0][:110]

    # -- the three faces, one at a time -----------------------------------
    rc, out, err = run("brief", quat, "ABAB",
                       env={"LYRIC_STAGED_DATA": empty, "NLTK_DATA": real_nltk})
    check("norms absent: `brief` REFUSES at exit 2, names the file as the "
          "one MISSING resource, and prints BOTH staging commands",
          refused(rc, out, err) and "1 of them is missing" in out
          and f"MISSING     {norms}" in out
          and f"PRESENT     {package}" in out and f"PRESENT     {model}" in out
          and STAGING_COMMANDS in out and "pip install nltk" in out
          and "quality/fetch_data.py" in out
          and "LYRIC_STAGED_DATA" in out,
          f"rc {rc}; {first(out)}")
    rc, out, err = run("brief", quat, "ABAB", env={"PYTHONPATH": stub})
    check("package absent: REFUSES naming `nltk`, and reports the model NOT "
          "PROBED rather than missing — doctrine 28, none is not cannot-tell",
          refused(rc, out, err) and "1 of them is missing" in out
          and f"MISSING     {package}" in out
          and f"NOT PROBED  {model}" in out
          and f"PRESENT     {norms}" in out,
          f"rc {rc}; {first(out)}")
    rc, out, err = run("brief", quat, "ABAB", env={"NLTK_DATA": empty})
    check("model absent: REFUSES before a line of the report prints — the "
          "lazy first-tag LookupError no longer arrives mid-report",
          refused(rc, out, err) and "1 of them is missing" in out
          and f"MISSING     {model}" in out
          and out.lstrip().startswith("REFUSED") and "BLUEPRINT:" not in out
          and err == "",
          f"rc {rc}; {first(out)}; stderr {len(err)} byte(s)")
    rc, out, err = run("brief", quat, "ABAB",
                       env={"LYRIC_STAGED_DATA": empty, "PYTHONPATH": stub})
    check("norms and package absent together: 2 MISSING, 1 NOT PROBED, 0 "
          "PRESENT — three counts, printed apart, never summed (doctrine 79)",
          refused(rc, out, err) and "2 of them are missing" in out
          and out.count("MISSING     ") == 2
          and out.count("NOT PROBED  ") == 1
          and out.count("PRESENT     ") == 0,
          f"rc {rc}; {first(out)}")
    rc, out, err = run("brief", quat, "ABAB")
    check("CONTROL: the same command with the resources present answers "
          "(rc 0 or 3) and prints no refusal — the hides are what refused",
          rc in (0, 3) and HEAD not in out and "Traceback" not in err,
          f"rc {rc}; {first(out)}")

    # -- the partition, MEASURED: every verb, everything hidden ----------
    # `python3 quality/test_verbs.py` runs this; the roster is §7's own.
    hidden = {"LYRIC_STAGED_DATA": empty, "NLTK_DATA": empty}
    refusing, answering, bad = [], {}, []
    for verb, argv in sorted(cases.items()):
        rc, out, err = run(*argv, env=hidden)
        if "Traceback" in err or rc not in (0, 2, 3):
            bad.append(f"{verb} (rc {rc})")
        if HEAD in out:
            refusing.append(verb)
            if rc != 2 or STAGING_COMMANDS not in out:
                bad.append(f"{verb} refused for resources without exit 2 "
                           f"and the commands (rc {rc})")
        else:
            answering[verb] = rc
    check(f"every one of the {len(cases)} dispatched verbs stays inside the "
          f"0/2/3 contract with all three resources hidden — no exit 1, no "
          f"traceback",
          not bad and len(refusing) + len(answering) == len(cases),
          f"outside the contract: {bad or 'none'}")
    # EMPIRICALLY VERIFIED 2026-09-01 -- this is the partition the run
    # above produced, pinned, and it corrected a guess: `readability` was
    # expected on the grading side and answers at 0 without the floor.
    # `finish` is on the answering side HERE only because §7's row is the
    # no-seed refusal, which comes before the floor; the seeded row below
    # is where it reaches it. Moving a verb across this line is a real
    # change to what a fresh checkout can run, so it should fail here.
    NEED = ["brief", "revise", "screen", "song", "verify"]
    check(f"exactly these {len(NEED)} verbs reach the floor and refuse for "
          f"resources: {' '.join(NEED)}",
          refusing == NEED,
          f"refusing: {refusing}")
    check("the verbs the ruling names -- score, candidates, plan -- and "
          "readability answer CLEAN (rc 0) without any of the three",
          all(answering.get(v) == 0
              for v in ("score", "candidates", "plan", "readability")),
          f"answering: {sorted(answering.items())}")
    # `recover` joined §7's roster 2026-09-02 (M-195) and answers WITHOUT
    # the floor at its OWN exit 3: the bare quatrain has no mark and no
    # blank block, so its sectioning is REFUSED — a work order, never a
    # failure, and never a resource refusal. Its 3 is declared here beside
    # `finish`'s 2 (CI's verbs (4) at 551e8e8 caught the omission).
    OWN = {"finish": 2, "recover": 3}
    check(f"the other {len(cases) - len(NEED)} answer, and every one but "
          f"`finish` (its own --seed refusal, rc 2) and `recover` (its own "
          f"REFUSED-coordinate work order, rc 3) at rc 0",
          len(answering) == len(cases) - len(NEED)
          and all(answering.get(v) == rc for v, rc in OWN.items())
          and all(rc == 0 for v, rc in answering.items() if v not in OWN),
          f"non-zero: {sorted((v, rc) for v, rc in answering.items() if rc)}")
    rc, out, err = run("plan", "--sweep=1-4", env=hidden)
    check("`plan --sweep=` answers without the floor",
          rc == 0 and HEAD not in out and "Traceback" not in err
          and "SWEEP:" in out, f"rc {rc}; {first(out)}")
    rc, out, err = run("finish", quat, "--seed=16", env=hidden)
    check("`finish --seed=` reaches the floor and REFUSES for resources -- "
          "past its own no-seed refusal, it is the sixth grading verb",
          refused(rc, out, err) and STAGING_COMMANDS in out,
          f"rc {rc}; {first(out)}")
    rc, out, err = run("song", bp, quat, "ABAB", env=hidden)
    check("`song` with a mandate REFUSES for resources too -- the floor is "
          "built before the mandate is read, so the resource refusal is "
          "the first thing a fresh checkout hears from it",
          refused(rc, out, err) and STAGING_COMMANDS in out,
          f"rc {rc}; {first(out)}")


def test_the_loop_verbs_exit_on_what_stands_at_the_stop():
    print("\n48. `revise`/`finish` exit 3 on a WHOLE-DRAFT flag and print the "
          "findings standing at the stop (`MISSING.md` M-186)")
    # THE DEFECT, probed by the 2026-09-01 audit: `song` exits 3 on a
    # whole-draft FLAG (TITLE_NOT_IN_HOOK, STACKED_DRAFT, HOOK_ABSENT name no
    # line), and the shared revise/finish exit block read `result.unresolved`
    # alone — so `revise` on the same draft under the same blueprint returned
    # 0 with the flag disclosed in prose under "NO STOP CONDITION ABOVE CAN
    # SEE", and `finish` stamped `exit 0 — no flag stands`. CLAUDE.md
    # promised the 3 for `song`/`revise` alike. The second half: the loop's
    # own text names the open LINES and the RULE holding each, never the
    # findings, so the connector's `extractBannedPairs` read [] off every
    # `lyric_revise` result and the chat surface could not count the ban on
    # the finishing verb (M-168's drift into night/light/sight/might).
    #
    # THE WHOLE-FLAG HALF, on the bank's own song: `keep_the_light.txt` under
    # its committed blueprint retitled to a phrase its hook does not carry.
    # The mandate is the README's, verbatim (doctrine 1: one statement).
    bp = json.load(open(os.path.join(HERE, "..", "songs",
                                     "keep_the_light.blueprint.json"),
                        encoding="utf-8"))
    bp["title"] = "zebra confetti"
    d = tempfile.mkdtemp()
    bpath = os.path.join(d, "retitled.blueprint.json")
    with open(bpath, "w", encoding="utf-8") as fh:
        json.dump(bp, fh)
    song = os.path.join(HERE, "..", "songs", "keep_the_light.txt")
    mand = ("--groups=1.T3,3.T7,4.T7;2.headrime,3;1.T7,2;11.T5,12.T2;"
            "10.T6,12.endword;16.head,17.T1;15.T7,16,17.T3;"
            "15.headrime,16.T3,17")
    rc, out, _ = run("revise", song, mand, "--returns=6,9;6,14",
                     f"--blueprint={bpath}", "--subdivision", "2",
                     "--max-rounds=1", "--attempts=0", "--backtrack=0")
    check("`revise` exits 3 when a WHOLE-DRAFT flag stands and no line is "
          "open — the same 3 `song` gives the same draft",
          rc == 3, f"rc {rc}")
    check("...and prints that flag at the stop in the report's own "
          "FINDING spelling, marked as the whole draft's",
          "WHOLE-DRAFT: FINDING [FLAG] TITLE_NOT_IN_HOOK" in out,
          out[out.find("STANDING AT THE STOP"):][:300])
    # THE PRINTED STAMP CLAUSE, END TO END (added 2026-09-02 — the tier-A
    # verification found no pin discriminated it: §44's fixture always has
    # lines open, and this section read the STANDING block, not the stamp).
    # Under `defer:` the same run renders and stamps; the clause must name
    # the flag, and the committed title must stamp exit 0 with no clause.
    st = os.path.join(d, "state.json")
    rc3, out3, _ = run("revise", song, mand, "--returns=6,9;6,14",
                       f"--blueprint={bpath}", "--subdivision", "2",
                       "--max-rounds=1", "--attempts=0", "--backtrack=0",
                       f"--propose=defer:{st}")
    m3 = re.search(r"\[FINISHED — declared mandate — exit (\d) — (\w+) after "
                   r"(\d+) round\(s\) — no flag stands — WHOLE-DRAFT FLAG: "
                   r"([^\]]+)\]", out3)
    check("under defer: the stamp carries `— WHOLE-DRAFT FLAG: "
          "TITLE_NOT_IN_HOOK` beside `no flag stands`, and its exit is the "
          "process's 3",
          rc3 == 3 and m3 is not None and m3.group(1) == "3"
          and m3.group(4).strip() == "TITLE_NOT_IN_HOOK",
          m3.group(0) if m3 else out3[-300:])
    st0 = os.path.join(d, "state0.json")
    bp0 = os.path.join(HERE, "..", "songs", "keep_the_light.blueprint.json")
    rc4, out4, _ = run("revise", song, mand, "--returns=6,9;6,14",
                       f"--blueprint={bp0}", "--subdivision", "2",
                       "--max-rounds=1", "--attempts=0", "--backtrack=0",
                       f"--propose=defer:{st0}")
    m4 = re.search(r"\[FINISHED — declared mandate — exit (\d) — [^\]]*\]",
                   out4)
    check("CONTROL: the committed title stamps exit 0 with no WHOLE-DRAFT "
          "clause — the clause is the flag's, not the stamp's",
          rc4 == 0 and m4 is not None and m4.group(1) == "0"
          and "WHOLE-DRAFT FLAG" not in m4.group(0),
          m4.group(0) if m4 else out4[-300:])
    # THE PURSUED HALF: the canonical tier-1 pair (§42's fixture), the loop
    # given no attempts so the note stands at the stop.
    banned = os.path.join(d, "banned.txt")
    with open(banned, "w", encoding="utf-8") as fh:
        fh.write("I ran my fingers through her hair\n"
                 "and set the bottle on the chair\n")
    rc2, out2, _ = run("revise", banned, "--groups=1,2", "--attempts=0",
                       "--backtrack=0")
    m2 = re.search(r"FINDING \[NOTE\] HOMEOTELEUTON: L1/L2", out2)
    check("a pursued note standing at the stop is printed as "
          "`FINDING [NOTE] HOMEOTELEUTON: L1/L2 …` — the spelling the "
          "connector's `extractBannedPairs` reads — and the exit is 3",
          rc2 == 3 and m2 is not None and "STANDING AT THE STOP" in out2,
          f"rc {rc2}; " + out2[out2.find("STANDING"):][:200])


def test_finish_exits_3_on_a_whole_draft_flag_alone():
    """M-186's owed pin (paid 2026-09-02): `finish` with NO line open and a
    WHOLE-DRAFT FLAG standing exits 3 and stamps the clause, and the same
    draft with the flag cleared exits 0 with no clause.

    §44's stamp pin was widened for M-186 but its fixture always has lines
    open, so the `or` in it is satisfied either way and a `finish` that
    ignored whole flags would still pass it (the tier-A verification's
    reading, confirmed by the completeness critic). This fixture is the
    isolated case: seed 176 under a declared plain rhyme (`--relation=RHYME`
    silences the schema draw, so every group is judged as rhyme), the
    sparsest plan a 1..300 sweep offers (`lines<=14;binding_cap<=1`), and a
    hand-written draft whose seven groups all pass the band, the two-tier
    ban and the modal screen (`screen` said CLEAN on each pair). The title
    "zebra confetti" is not in the hook line (L3), so TITLE_NOT_IN_HOOK — a
    whole-draft FLAG — is the only finding standing.

    THE DRAFT IS THE SEED'S: the plan is a pure function of the seed and
    the declarations, so if the planner's envelope is ever re-derived and
    seed 176 re-dealt, the first check below reads the refusal and the
    fixture is re-cut, never the assertion.
    """
    print("\n53. `finish` exits 3 on a WHOLE-DRAFT flag ALONE, and stamps it "
          "— the isolated case M-186 owed")
    d = tempfile.mkdtemp()
    draft = os.path.join(d, "whole176.txt")
    with open(draft, "w", encoding="utf-8") as fh:
        fh.write("the kettle hums before the light\n"
                 "and every window learns my name\n"
                 "I keep the door unlocked for you\n"
                 "I keep the door unlocked for you\n"
                 "the river carries every stone downhill\n"
                 "and until dawn the cattle sleep\n"
                 "I found a coin beneath the pier again\n"
                 "a career of swallows nesting in Cayenne\n"
                 "one candle burns beside the open door\n"
                 "the town made every scandal into folklore\n"
                 "she wrote a letter I could never read\n"
                 "a sweater keeps the promise like a creed\n"
                 "the kettle hums, the light comes on\n")
    common = ["--seed=176", "--relation=RHYME", "--attempts=0",
              "--backtrack=0", "--max-rounds=1"]
    rc, out, _ = run("finish", draft, "--title=zebra confetti", *common)
    st = re.search(r"\[FINISHED — seed 176 — exit (\d) — (\w+) after (\d+) "
                   r"round\(s\) — ([^\]]+)\]", out)
    check("the plan is the seed's and the draft fills it: the run reaches "
          "a stop and stamps (a rc 2 here means seed 176 was re-dealt — "
          "re-cut the fixture)",
          rc in (0, 3) and st is not None,
          f"rc {rc}; " + (st.group(0) if st else out[-300:]))
    check("with NO line open and TITLE_NOT_IN_HOOK standing, `finish` exits "
          "3 — the whole-draft flag alone drives the exit",
          rc == 3 and st is not None and st.group(1) == "3"
          and st.group(2) == "SUCCESS",
          st.group(0) if st else "")
    check("...and the stamp says why: `no flag stands` beside `WHOLE-DRAFT "
          "FLAG: TITLE_NOT_IN_HOOK`",
          st is not None and st.group(4) ==
          "no flag stands — WHOLE-DRAFT FLAG: TITLE_NOT_IN_HOOK",
          st.group(4) if st else "")
    check("...and the STANDING block prints the flag in the report's own "
          "spelling",
          "WHOLE-DRAFT: FINDING [FLAG] TITLE_NOT_IN_HOOK" in out)
    rc0, out0, _ = run("finish", draft, "--title=the door unlocked", *common)
    st0 = re.search(r"\[FINISHED — seed 176 — exit (\d) — [^\]]*\]", out0)
    check("CONTROL: a title the hook carries clears the flag — exit 0, and "
          "the stamp has no WHOLE-DRAFT clause",
          rc0 == 0 and st0 is not None and st0.group(1) == "0"
          and "WHOLE-DRAFT" not in st0.group(0),
          st0.group(0) if st0 else out0[-200:])
    shutil.rmtree(d, ignore_errors=True)


def test_the_pasted_song_has_the_same_door_as_a_planned_one():
    print("\n49. `recover` is a verb, and `revise` under defer: renders and "
          "stamps a pasted song's stop (`MISSING.md` M-195)")
    # THE OWNER'S RULING (2026-08-23, quality/recover.py's docstring): a
    # pasted song goes through every step a planned one does, and the first
    # step is to STRUCTURE it. `quality/recover.py` did that and had no verb
    # and no tool — `python3 quality/recover.py` was the only door, and it
    # printed no mandate spelling a caller could hand on. And a pasted song
    # could be LOOPED (`revise --propose=defer:`) but never FINISHED: only
    # `finish` rendered and stamped, and `finish` needs a seed.
    d = tempfile.mkdtemp()
    song = os.path.join(HERE, "..", "songs", "keep_the_light.txt")
    rc, out, _ = run("recover", song)
    check("`recover` on a banked song exits 3 — the meter is REFUSED, a "
          "work order and not a failure — and prints the two CLI flags",
          rc == 3 and "MANDATE SPELLING" in out
          and re.search(r"^\s*--groups=\S+", out, re.M)
          and re.search(r"^\s*--returns=6,9;6,14", out, re.M)
          and "EXIT 3" in out and "meter" in out,
          f"rc {rc}; " + out[out.find("MANDATE SPELLING"):][:160])
    rc, out, _ = run("recover", song, "--bogus", expect_rc=2)
    check("an unknown flag refuses at exit 2, like every verb",
          rc == 2 and "REFUSED" in out, f"rc {rc}")
    rc, out, _ = run("recover", expect_rc=2)
    check("no file refuses with the usage", rc == 2 and "recover LYRIC.txt" in out,
          f"rc {rc}")
    # THE STAMP ON A PASTED SONG'S LOOP: no seed, a declared mandate, the
    # same [FINISHED — …] shape `finish` prints, with `declared mandate`
    # where a seed would stand, so the connector reads both.
    draft = os.path.join(d, "draft.txt")
    with open(draft, "w", encoding="utf-8") as fh:
        fh.write("\n".join(NOISY_LINES[:4]) + "\n")
    state = os.path.join(d, "state.json")
    rc, out, _ = run("revise", draft, "--groups=2,3;1,4", "--attempts=0",
                     "--backtrack=0", f"--propose=defer:{state}")
    m = re.search(r"\[FINISHED — declared mandate — exit (\d) — (\w+) after "
                  r"(\d+) round\(s\) — ([^\]]+)\]", out)
    check("`revise --propose=defer:` renders the lines in order under a "
          "[FINISHED — declared mandate — …] stamp at a stop condition",
          rc in (0, 3) and "THE SONG, PERFORMANCE ORDER" in out
          and m is not None and int(m.group(1)) == rc,
          f"rc {rc}; " + (m.group(0) if m else "(no stamp)"))
    rc2, out2, _ = run("revise", draft, "--groups=2,3;1,4", "--attempts=0",
                       "--backtrack=0")
    check("...and the STUB proposer's `revise` (no defer) prints no render "
          "and no stamp — the door is the deferred, resumable one",
          "[FINISHED" not in out2 and "THE SONG, PERFORMANCE ORDER" not in out2,
          f"rc {rc2}")


def test_the_plan_report_discloses_density_and_audibility():
    print("\n50. the `plan` report says what DENSITY it drew and how much of "
          "its end-web is HEARD as rhyme (`MISSING.md` M-191, M-192)")
    # Two coordinates the planner discloses in `choices` and the CLI had to
    # PRINT, because the connector returns this report and nothing else:
    # the density cap (M-191) and the audible / bare / inaudible partition
    # of the end-bound groups (M-192). Both are records — the report of a
    # draw, never a gate — and both are asserted against the plan's own
    # numbers rather than a remembered figure.
    import json as _json
    d = tempfile.mkdtemp()
    bp = os.path.join(d, "bp.json")
    rc, out, _ = run("plan", "--seed=16", f"--out={bp}", expect_rc=0)
    with open(bp, encoding="utf-8") as fh:
        plan = _json.load(fh)
    dn = plan["choices"]["density"]
    au = plan["choices"]["audible"]
    m = re.search(r"^\s*DENSITY: binding cap (\d+) — (.+)$", out, re.M)
    check("the report prints the density cap the plan drew, with how it "
          "was chosen, and the number is the plan's own",
          rc == 0 and m is not None and int(m.group(1)) == dn["binding_cap"]
          and "uniform over 1.." in m.group(2),
          f"rc {rc}; {m.group(0)[:90] if m else 'no DENSITY line'}")
    m2 = re.search(r"^\s*AUDIBLE: (\d+) of (\d+) end-bound group\(s\) draw a "
                   r"relation a listener hears as END RHYME", out, re.M)
    check("...and the AUDIBLE line partitions the end-bound groups with the "
          "plan's own counts — audible of end-bound, then the bare default "
          "and the inaudible apart (doctrine 79)",
          m2 is not None and int(m2.group(1)) == au["audible"]
          and int(m2.group(2)) == au["end_bound"]
          and f"{au['bare']} on the bare default" in out
          and f"{len(au['inaudible'])} on a relation heard as something else"
          in out,
          f"{m2.group(0)[:90] if m2 else 'no AUDIBLE line'}")
    check("...and says it is a record, not a gate — the dice are untouched",
          "A record, not a gate" in out)
    brief = plan.get("writer_brief", "")
    check("the writer brief carried in the blueprint has the legend and the "
          "capacity line the writer reads (M-192)",
          "Where a binding sits" in brief
          and "What each named relation asks" in brief
          and re.search(r"^\s+up to \d+ syllables a line after the pickup; "
                        r"the calibrated band asks at least \d+$", brief, re.M)
          is not None)


if __name__ == "__main__":
    _SECTIONS = (
        test_the_map_is_not_stale,
        test_fit_answers_whether_the_words_fit_the_bars,
        test_fit_refuses_the_undeclared_subdivision,
        test_function_is_not_section_name,
        test_refrain_writes_the_villanelle,
        test_brief_refuses_instead_of_tracebacking,
        test_every_verb_runs,
        test_the_four_blueprint_verbs_cannot_answer_differently,
        test_the_fifteen_original_verbs_are_untouched,
        test_fallback_reaches_every_verb_ahead_of_the_verb_name,
        test_readability_prints_what_the_fallback_invented,
        test_candidates_refuses_an_unreadable_query,
        test_relations_prints_the_search_burden_it_promises,
        test_no_broad_exception_handler_hides_a_call,
        test_blueprint_mismatch_refuses_on_every_verb,
        test_song_does_not_invent_a_structure_defect_on_a_repeated_name,
        test_no_flag_silently_changes_a_measurement,
        test_every_flag_value_refuses_in_one_shape,
        test_the_profile_lookup_raises_at_the_library_too,
        test_qafiya_reads_a_file_the_way_every_other_verb_does,
        test_the_report_rolls_up_without_dropping_anything,
        test_song_exits_on_a_flag,
        test_propose_selects_who_writes_the_line,
        test_both_mandate_spellings_are_read,
        test_the_loop_suspends_instead_of_guessing,
        test_the_loop_pursues_a_note_it_can_brief,
        test_the_candidate_field_says_which_ordering_it_is,
        test_the_last_two_traceback_shapes_refuse,
        test_every_test_file_is_accounted_for_by_ci,
        test_a_near_miss_flag_refuses_on_the_reviser_verbs,
        test_a_file_the_harness_cannot_read_refuses_on_every_verb,
        test_the_named_pair_disclosure_survives_the_module_boundary,
        test_every_verb_reads_its_own_arguments,
        test_the_comparator_and_the_meter_flags_reach_the_graders,
        test_the_title_a_lyric_declares_reaches_the_check_or_refuses,
        test_the_collision_cut_is_one_constant_and_cannot_drift,
        test_both_meter_coordinates_are_disclosed_and_collisions_are_typed,
        test_every_report_names_the_draft_it_read,
        test_the_structures_spelling_reaches_the_verbs,
        test_the_seed_sweep_is_reachable_from_the_command_line,
        test_fill_reads_a_draft_the_way_every_other_verb_does,
        test_the_ban_is_unskippable_at_the_grading_verb_too,
        test_a_song_wide_relation_may_not_stand_beside_a_structure,
        test_a_row_name_with_a_comma_is_still_reachable,
        test_every_workflow_file_is_parseable_yaml,
        test_finish_is_the_one_door_from_draft_to_rendered_song,
        test_the_cynghanedd_verb_reaches_caesura_and_marks,
        test_a_missing_staged_resource_refuses_instead_of_crashing,
        test_the_loop_verbs_exit_on_what_stands_at_the_stop,
        test_the_pasted_song_has_the_same_door_as_a_planned_one,
        test_the_plan_report_discloses_density_and_audibility,
        test_finish_exits_3_on_a_whole_draft_flag_alone,
    )
    # SHARDING, 2026-08-18. This file is the longest suite in the repo —
    # measured 21-22 minutes on CI run #524, and after the pool went
    # four-wide it WAS the pool's wall (parallel width cannot beat the
    # longest member). The sections are independent by construction (each
    # builds its own tmpdirs and fixtures; the shared state is FAILURES,
    # which only accumulates), so TEST_VERBS_SHARD=k/n runs the sections
    # whose index ≡ k-1 (mod n) — interleaved, so the heavy sections
    # spread across shards instead of stacking in one. Unset runs
    # everything, byte-identical to the pre-shard file: the env var is a
    # CI-shape coordinate, not a semantics one, and every section still
    # runs EXACTLY ONCE across a full k=1..n matrix by the arithmetic of
    # the residue classes — a section skipped by every shard is impossible
    # by construction, not by review.
    _shard = os.environ.get("TEST_VERBS_SHARD", "").strip()
    if _shard:
        k, n = (int(x) for x in _shard.split("/"))
        if not (1 <= k <= n):
            raise SystemExit(f"TEST_VERBS_SHARD={_shard!r} refuses: "
                             f"k must be in 1..n")
        run_sections = [f for i, f in enumerate(_SECTIONS)
                        if i % n == k - 1]
        print(f"SHARD {k}/{n}: {len(run_sections)} of {len(_SECTIONS)} "
              f"sections (interleaved by index residue)")
    else:
        run_sections = list(_SECTIONS)
    # PER-SECTION COST, PRINTED EVERY RUN — 2026-09-01. Sharding this file
    # by index residue is exactly-once by arithmetic, but it balances by
    # ACCIDENT: the residue classes are drawn over the order the sections
    # happen to be written in, which is chronological, and cost is not.
    # Measured on run #1197 the two shards came out 948s and 1265s — a 33%
    # imbalance, and a job's wall is its WORST shard, so a third of that
    # runner's time bought nothing. Raising the shard count cannot fix an
    # imbalance and cannot beat the LONGEST SINGLE SECTION either, and
    # which section that is had never been measured (M-182's first open
    # item said exactly this). So the suite now times each section and
    # prints them slowest-first: the top line IS the floor any shard count
    # stalls at, and the ordering is what a cost-ordered `_SECTIONS` would
    # be built from. Printed by every shard, so the union of a matrix run
    # is the whole file's profile, and printed on a green run too — a cost
    # that is only visible when something fails is a cost nobody sees.
    _times = []
    for _fn in run_sections:
        _t0 = time.time()
        _fn()
        _times.append((time.time() - _t0, _fn.__name__))
    print("=" * 62)
    print("SECTION COST, slowest first — the top line is the floor a shard "
          "count cannot beat:")
    for _sec, _nm in sorted(_times, reverse=True):
        print(f"  {_sec:8.1f}s  {_nm}")
    print(f"  {sum(_s for _s, _ in _times):8.1f}s  TOTAL, this shard "
          f"({len(_times)} of {len(_SECTIONS)} sections)")
    print("=" * 62)
    if FAILURES:
        print(f"{len(FAILURES)} FAILING: {', '.join(FAILURES)}")
        sys.exit(1)
    print("every shipped capability has a verb, and the map says so")
