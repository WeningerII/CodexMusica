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

import json
import os
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


def run(*args, expect_rc=None):
    """The verb, as a user runs it. -> (rc, stdout, stderr).

    A subprocess and not an import, deliberately: what is under test is
    REACHABILITY FROM THE COMMAND LINE, and calling the module's function
    directly would pass in exactly the state this file exists to detect.
    """
    p = subprocess.run([sys.executable, "lyric_harness.py", *args],
                       cwd=ROOT, capture_output=True, text=True, timeout=900)
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
    for verb, argv in sorted(cases.items()):
        rc, out, err = run(*argv)
        if "Traceback" in err or rc not in (0, 2):
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
    # schema at all -- this repo's own root `blueprint.json` is a THIRD,
    # never-migrated schema (no `lines` array, a single top-level `scheme`
    # string) that neither the old nor the new `song` can read, and is left
    # alone here since migrating a dead schema nothing reads teaches nothing
    # a fresh fixture wouldn't.
    rc, out, err = run("song", EXAMPLE_BP, EXAMPLE_TXT)
    check("`song` on a real bar-grid blueprint runs the brief-report "
          "pipeline without a traceback, and REFUSES for want of a mandate "
          "rather than passing vacuously",
          "Traceback" not in err and "no mandate was declared" in out)


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
    rc, out, err = run("song", *paths["dup"], mand, "--subdivision", "4",
                       expect_rc=0)
    struct = [l.strip() for l in out.splitlines() if "STRUCTURE:" in l]
    over = [l for l in out.splitlines() if "OVERLAPPING_SPANS" in l]
    check("`song` runs on a blueprint with two sections named `chorus`",
          rc == 0 and "Traceback" not in err,
          (err.strip().splitlines() or ["(clean)"])[-1][:110])
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
    rc2, out2, _e = run("song", *paths["uniq"], mand, "--subdivision", "4",
                        expect_rc=0)
    check("renaming the second section changes NOTHING in the report — the "
          "control that turns this from an argument into a measurement",
          rc2 == 0 and _no_apparatus(out) == _no_apparatus(out2))

    # AND THE CROSS-CHECK IS NOT SILENCED, which is how a fix like this goes
    # wrong: a counter that reports nothing is not a counter that is right.
    # One line MOVED from the second chorus into the first, in the blueprint
    # only -- 5 and 3 against the lyric's 4 and 4.
    bp3 = os.path.join(d, "lopsided.blueprint.json")
    with open(bp3, "w") as fh:
        json.dump(_vcbc_blueprint("chorus", lopsided=True), fh)
    rc3, out3, _e3 = run("song", bp3, paths["dup"][1], mand,
                         "--subdivision", "4", expect_rc=0)
    hit = [l.strip() for l in out3.splitlines()
           if "STRUCTURE:" in l and "lyric line(s)" in l]
    check("a REAL per-instance mismatch is still reported, and the two "
          "same-named choruses are told apart — 5 against one and 3 against "
          "the other, where a name-keyed count says 8 for both",
          rc3 == 0
          and hit == ["STRUCTURE: chorus: 4 lyric line(s), blueprint places 5",
                      "STRUCTURE: chorus: 4 lyric line(s), blueprint places 3"],
          f"{hit}")


if __name__ == "__main__":
    test_the_map_is_not_stale()
    test_fit_answers_whether_the_words_fit_the_bars()
    test_fit_refuses_the_undeclared_subdivision()
    test_function_is_not_section_name()
    test_refrain_writes_the_villanelle()
    test_brief_refuses_instead_of_tracebacking()
    test_every_verb_runs()
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
    print("=" * 62)
    if FAILURES:
        print(f"{len(FAILURES)} FAILING: {', '.join(FAILURES)}")
        sys.exit(1)
    print("every shipped capability has a verb, and the map says so")
