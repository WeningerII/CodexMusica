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
     the two mandate spellings a letter string cannot express work
  7. every dispatched verb runs without a traceback — including `song`, which
     raised `KeyError` on this repo's own `blueprint.json` for as long as that
     file has been in the bar-grid shape, while `wiring` called it wired
     because import reachability is not invocation reachability

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

EXAMPLE_BP = os.path.join(ROOT, "examples",
                          "never_been_to_a_scene.blueprint.json")
EXAMPLE_TXT = os.path.join(ROOT, "examples", "never_been_to_a_scene.txt")
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


def test_fit_answers_whether_the_words_fit_the_bars():
    print("\n2. `fit` — the chorus overflows and the 7/8 verses do not")
    rc, out, err = run("fit", EXAMPLE_BP, "--subdivision", "2")
    check("`fit` runs and says which module answered",
          rc == 0 and "module: quality/fit.py" in out, err.strip()[-200:])
    check("the declared subdivision is echoed as a DECLARED coordinate",
          "2 slot(s) per pulse, DECLARED" in out)

    rows = {}
    for line in out.splitlines():
        f = line.split()
        if len(f) >= 12 and f[0] in ("verse1", "verse2", "pre", "chorus",
                                     "bridge", "chorus2", "outro"):
            rows[f[0]] = f
    # column order: section meter group bars lines units per_bar UNSAT ...
    unsat = {k: int(v[7].rstrip("*")) for k, v in rows.items()}
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
    check("the SAME blueprint reports 0 UNSAT with nothing declared — the "
          "overflow is a fact about the DECLARATION, not about the words",
          " 0 " in out.split("TOTAL")[0].splitlines()[3])


def test_function_is_not_section_name():
    print("\n4. `function` — a name is not a function")
    # A copy with every declaration STRIPPED, rather than the shipped file:
    # the point under test is that an UNDECLARED function refuses, and if a
    # later cell declares functions in `examples/` this assertion must keep
    # testing the refusal instead of quietly starting to test something else.
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
        "--title=Never been to a scene", "--hook=I don't get to go",
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

    rc, out, err = run("function", EXAMPLE_BP, "--function=chorus:middle8")
    check("a function outside the vocabulary RAISES rather than falling "
          "back to verse",
          "UnknownFunction" in err and "not inferred from" in err.lower()
          or "is not a declared section function" in err,
          err.strip().splitlines()[-1][:120] if err else "")


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

    # REPOINTED 2026-08-11 after cell BA's coda-identity fix. EXAMPLE_TXT's
    # own graph was the witness for overlap here (L27 "ones", 1 pivot at
    # theta_coda=0.80/scalar) -- under the shipped identity coordinate that
    # graph is now FULLY DISJOINT: `python3 lyric_harness.py graph
    # examples/never_been_to_a_scene.txt` reports 6 maximal cliques and ZERO
    # overlapping nodes; `mandate_from_graph` (promote=True) gives 7 groups,
    # also disjoint. "ones" (L27) no longer clears theta=0.75 with either of
    # its former clique partners at all, so it is not in the graph. Real
    # exemplars are preferred (house style), but the exemplar is gone, so
    # this is a constructed fixture (doctrine 94) built on a vowel-similarity
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
        "song": ["song", "blueprint.json", "lyric.txt"],
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
    check("none of the 27 verbs raises",
          not bad, f"raised: {bad or 'none'}")
    # The specific one that did, and for how long: `blueprint.json` was
    # rewritten to the bar-grid shape and `check_song` reads a per-section
    # `lines` count that shape deliberately does not have. `wiring` called
    # `song` wired the whole time, because it checks IMPORT reachability and
    # a KeyError is not an import.
    rc, out, err = run("song", "blueprint.json", "lyric.txt")
    check("`song` on this repo's own blueprint.json REFUSES by name instead "
          "of raising KeyError",
          "Traceback" not in err and "no declared line count" in out)


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
          rc == 0 and "sections 7  bars 83  lines 41" in out)
    check("`grid` reads the same uniformity and stanza-lock layer as before",
          "uniformity:" in out and "phrase profile:" in out)


if __name__ == "__main__":
    test_the_map_is_not_stale()
    test_fit_answers_whether_the_words_fit_the_bars()
    test_fit_refuses_the_undeclared_subdivision()
    test_function_is_not_section_name()
    test_refrain_writes_the_villanelle()
    test_brief_refuses_instead_of_tracebacking()
    test_every_verb_runs()
    test_the_fifteen_original_verbs_are_untouched()
    print("=" * 62)
    if FAILURES:
        print(f"{len(FAILURES)} FAILING: {', '.join(FAILURES)}")
        sys.exit(1)
    print("every shipped capability has a verb, and the map says so")
