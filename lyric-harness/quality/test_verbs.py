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
import json
import os
import re
import subprocess
import sys
import tempfile

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
    check("the two chorus returns are compared and get a NAMED kind",
          "RHYME_PRESERVING_REWRITE" in out or "VERBATIM" in out)
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
    rc, out, err = run("function", EXAMPLE_BP, "--function=chorus:middle8")
    check("a CLI-declared function outside the vocabulary REFUSES at exit 2, "
          "naming the flag and the vocabulary, rather than tracebacking",
          rc == 2 and "REFUSED" in out and "--function=chorus:middle8" in out
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
    bad["sections"][0]["function"] = "middle8"
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
    check("--groups= mandates a group the song has no letter for",
          rc == 0 and "group B" in out or "group A" in out, out[:200])

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
    check("the modal exclusion is still printed (doctrine 9)",
          "FORBIDDEN (modal" in out)

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


def test_every_verb_runs():
    print("\n7. every dispatched verb runs, and none of them tracebacks")
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
    }
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

#: store/own and four/gone — two mandated pairs that do NOT rhyme, so the
#: draft carries two SCHEME_VIOLATION flags on named lines beside the
#: saturated SLOTS_EXCEEDED. One rolls up, the others must not.
MANDATE_THAT_FAILS = "--groups=1,3;2,4"


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
    check("the two SCHEME_VIOLATION flags survive the rollup — they are "
          "the craft criticism the 48 were burying, and they are NOT "
          "saturated, so the rule had to leave them alone",
          per_code.get(("FLAG", "SCHEME_VIOLATION")) == 2,
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
    quat = os.path.join(d, "q.txt")
    with open(quat, "w") as fh:
        fh.write("The river took the bridge at dawn\n"
                 "and no one saw the water again\n"
                 "the cattle waded through the silt\n"
                 "past every fence the county rebuilt\n")
    qbp = os.path.join(d, "q.blueprint.json")
    with open(qbp, "w") as fh:
        json.dump({"title": "The river", "hooks": ["the river"],
                   "sections": [{"name": "a", "bars": 4, "start_bar": 1,
                                 "function": "verse",
                                 "meter": {"beats": 4, "unit": 4,
                                           "groups": [2, 2]}}],
                   "lines": [{"text": t, "bar": i + 1, "beat": 1,
                              "duration": 4, "section": "a"}
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
    check("the exit code counts FINDINGS, not printed blocks — 18 flags "
          "over 3 printed decisions is still exit 3",
          "18 FLAG" in out and "3 decision(s)" in out and rc == 3,
          [l for l in out.splitlines() if "REPORT:" in l][:1])

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
    # `revise_loop` has taken `propose=`/`propose_pair=` since it was
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
    with open(quat, "w") as fh:
        fh.write("The river took the bridge at dawn\n"
                 "and no one saw the water again\n"
                 "the cattle waded through the silt\n"
                 "past every fence the county rebuilt\n")

    # THE DEFAULT IS THE STUB AND IT MUST STAY THE STUB. A default that
    # reaches out of the process is not a default: THIS FILE runs `revise`
    # (§7), in CI.
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
          rc == 2 and "'stub', 'replay:PATH' or 'call:MODULE:FACTORY'" in out
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
              rc == 2 and "only `revise` runs a proposer" in out,
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
            "propose_pair": []}, fh)
    rc, out, err = run("revise", quat, "ABAB", f"--propose=replay:{rp}",
                       expect_rc=0)
    check("replay: drives the loop and the recorded text reaches it",
          rc == 0 and "left to rot" in out and "Traceback" not in err,
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
        json.dump({"propose": [], "propose_pair": []}, fh)
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
    check("a fully-resolved declared seam neither raises nor invents a "
          "third exit code",
          "Traceback" not in err and rc in (0, 2),
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
              rc == 0 and "PROPOSER: call:scratch_adapter:make_call" in out,
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


if __name__ == "__main__":
    test_the_map_is_not_stale()
    test_fit_answers_whether_the_words_fit_the_bars()
    test_fit_refuses_the_undeclared_subdivision()
    test_function_is_not_section_name()
    test_refrain_writes_the_villanelle()
    test_brief_refuses_instead_of_tracebacking()
    test_every_verb_runs()
    test_the_four_blueprint_verbs_cannot_answer_differently()
    test_the_fifteen_original_verbs_are_untouched()
    test_fallback_reaches_every_verb_ahead_of_the_verb_name()
    test_readability_prints_what_the_fallback_invented()
    test_candidates_refuses_an_unreadable_query()
    test_relations_prints_the_search_burden_it_promises()
    test_no_broad_exception_handler_hides_a_call()
    test_blueprint_mismatch_refuses_on_every_verb()
    test_song_does_not_invent_a_structure_defect_on_a_repeated_name()
    test_no_flag_silently_changes_a_measurement()
    test_every_flag_value_refuses_in_one_shape()
    test_the_profile_lookup_raises_at_the_library_too()
    test_qafiya_reads_a_file_the_way_every_other_verb_does()
    test_the_report_rolls_up_without_dropping_anything()
    test_song_exits_on_a_flag()
    test_propose_selects_who_writes_the_line()
    test_both_mandate_spellings_are_read()
    print("=" * 62)
    if FAILURES:
        print(f"{len(FAILURES)} FAILING: {', '.join(FAILURES)}")
        sys.exit(1)
    print("every shipped capability has a verb, and the map says so")
