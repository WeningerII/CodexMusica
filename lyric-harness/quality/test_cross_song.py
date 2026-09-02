#!/usr/bin/env python3
"""Regressions for `quality/cross_song.py` and `screen --bank` (M-111,
triage C08, 2026-09-02).

THE RULING THIS SUITE HOLDS. A check MAY read `songs/` to DISCLOSE
cross-song word reuse and MAY NOT read it to grade. Both halves of that
sentence are mechanical here, because M-111 sat open for eight days on an
ARGUMENT and an argument is what a later session talks itself out of.

Sections:
  1  the population — `song_record.songs()` and no second copy of it, and
     the content partition is `narrative_bands.content_types`, the one
     spelling panel run 5 caught drifting
  2  the depth measurement — derived live from the committed bytes, never
     cached into `data/` (which would make the bank a corpus file under
     doctrine 34), and the cheap pins re-derive
  3  THE MECHANICAL REFUSAL — handing `songs/` to the NULL population
     raises `BankIsNotCorpus`. The bank may be OBSERVED and may not be
     SAMPLED (doctrine 13/14), and this is that rule as an exception
     rather than as a paragraph
  4  no threshold, no verdict — the disclosure carries no boolean, no
     finding code, and the module defines no comparison anything gates on
  5  THE PREFIX PIN, and it is the section that matters — the un-flagged
     `screen` output must be a byte PREFIX of `screen --bank`. A flag that
     can only APPEND cannot introduce a code, move a count or change an
     exit status, so the gate M-111 refused is refused by the shape of the
     wiring rather than by good intentions. MUTATION: append the depth to
     the row's `codes` and this section reds.
  6  the declared coordinate — omitting `--bank` imports nothing from this
     module and changes not one byte; `--bank=value` refuses by name

Run: python3 quality/test_cross_song.py
"""

import ast
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, ROOT)

from quality import cross_song as CS  # noqa: E402

FAILURES = []


def check(name, cond, detail=""):
    print(f"  {'PASS' if cond else 'FAIL'}  {name}")
    if detail:
        print(f"          {detail}")
    if not cond:
        FAILURES.append(name)


def _run(args):
    r = subprocess.run([sys.executable, "lyric_harness.py"] + args,
                       cwd=ROOT, capture_output=True, text=True, timeout=600)
    return r.returncode, r.stdout


def test_population():
    print("\n1. one definition of the population, one spelling of the "
          "content partition")
    from quality.song_record import songs as _songs
    check("the population IS song_record's (a lyric with a blueprint) — "
          "the same reach `ban_convergence.songs()` takes, never a second "
          "copy (doctrine 1)",
          CS.songs() == _songs(), len(CS.songs()))
    check("sixteen songs banked at the pin",
          len(CS.songs()) == CS.PINNED["bank_songs"], len(CS.songs()))
    src = ast.parse(open(os.path.join(HERE, "cross_song.py"),
                         encoding="utf-8").read())
    globs = [n for n in ast.walk(src)
             if isinstance(n, ast.Call)
             and isinstance(n.func, ast.Attribute) and n.func.attr == "glob"]
    check("this module globs the HUMAN corpus and nothing else — it never "
          "enumerates songs/ itself",
          len(globs) == 1, f"{len(globs)} glob call(s)")
    names = {n.name for n in ast.walk(src) if isinstance(n, ast.FunctionDef)}
    check("and it defines no content-partition of its own: the partition "
          "is imported from narrative_bands (panel run 5 measured two hand "
          "spellings of it disagreeing by one type)",
          "content_types" not in names
          and "from quality.narrative_bands import content_types"
          in open(os.path.join(HERE, "cross_song.py"),
                  encoding="utf-8").read())


def test_depth():
    print("\n2. the depth measurement, derived live from the committed bytes")
    types_by_song, refused = CS.bank()
    check("every banked song read; refusals counted apart (doctrine 79)",
          len(types_by_song) == CS.PINNED["bank_songs"] and refused == [],
          (len(types_by_song), refused))
    d = CS.depth(types_by_song)
    check("the distinct-type pin re-derives",
          len(d) == CS.PINNED["bank_types"], len(d))
    spec = CS.spectrum(list(types_by_song.values()))
    want = {k: v[0] for k, v in CS.PINNED["spectrum"].items()}
    check("the OBSERVED half of the pinned spectrum re-derives exactly "
          "(the null half costs ~60s and is `--check`'s business)",
          spec == want,
          {k: spec[k] for k in sorted(spec) if spec[k] != want[k]}
          or "all 15 depths agree")
    check("`light` is the deepest single word the register names, and its "
          "depth is a MEASUREMENT rather than a verdict",
          d["light"] == 7, d["light"])
    # THE REGISTER'S TWO SUB-READINGS ARE A FILTER OVER ONE POPULATION,
    # never a second copy of it — `panel6` is the six RESULTS_PANEL.md
    # measured and `after_panel` its complement, so the claim "the
    # concentration is confined to the six" is re-derivable by command
    # instead of by a scratch script (standing rule 3).
    all_names = sorted(types_by_song)
    six = CS.subset("panel6", all_names)
    ten = CS.subset("after_panel", all_names)
    check("panel6 and after_panel PARTITION the bank — six and ten, "
          "disjoint, together the whole population",
          len(six) == 6 and len(ten) == 10
          and sorted(six + ten) == all_names, (len(six), len(ten)))
    bad = None
    try:
        CS.subset("bogus", all_names)
    except ValueError as e:
        bad = str(e)
    check("an undeclared subset REFUSES naming its closed vocabulary, "
          "rather than quietly measuring everything",
          bad is not None and "all / panel6 / after_panel" in bad, bad)
    # THE MEASURED ZERO THE MODULE CLAIMS: no banked song carries a
    # parenthetical, so the bank read not consulting the caller's
    # `--voices` costs nothing today. The day one does, this reds and the
    # docstring's own sentence is the defect report.
    import glob as _g
    paren = [p for p in _g.glob(os.path.join(ROOT, "songs", "*.txt"))
             for l in open(p, encoding="utf-8").read().splitlines()
             if "(" in l and not l.strip().startswith(("[", "#", "---"))]
    check("0 sung lines in the bank carry a parenthetical, which is what "
          "makes the bank read's `strip_parens` default a knob with "
          "nothing to turn rather than an undeclared coordinate",
          paren == [], sorted(set(os.path.basename(p) for p in paren)))
    # NOT CACHED, AND THAT IS DOCTRINE 34's COROLLARY: a derived table of
    # bank frequencies under data/ would be a corpus file needing a
    # sources.tsv row — the back door the ruling denies. It must not exist.
    stale = [p for p in os.listdir(os.path.join(ROOT, "data"))
             if "cross_song" in p or "bank_depth" in p]
    check("no derived bank table under data/ — the frequencies are read "
          "live, so the bank never becomes a corpus file (doctrine 34)",
          stale == [], stale)


def test_the_refusal_is_mechanical():
    print("\n3. THE MECHANICAL REFUSAL — the bank may be OBSERVED and may "
          "not be SAMPLED")
    raised = None
    try:
        CS.human_population(root=os.path.join(ROOT, "songs"), pattern="*.txt")
    except CS.BankIsNotCorpus as e:
        raised = str(e)
    check("pointing the NULL population at songs/ raises BankIsNotCorpus "
          "rather than returning a number somebody would go on to quote",
          raised is not None, raised and raised[:70])
    check("and the refusal names both doctrines and the corpus that DOES "
          "carry sources.tsv rows",
          raised is not None and "doctrine 13" in raised
          and "doctrine 14" in raised and "corpus/song/" in raised)
    check("giving the bank a sources.tsv row to silence it is named IN the "
          "refusal as the back door, not the fix",
          raised is not None and "back door" in raised)
    # The guard is on the PATH every null population takes, not on a
    # caller's good manners: `human_population` calls it before it reads a
    # single file.
    src = ast.parse(open(os.path.join(HERE, "cross_song.py"),
                         encoding="utf-8").read())
    fn = next(n for n in ast.walk(src)
              if isinstance(n, ast.FunctionDef)
              and n.name == "human_population")
    calls = [n.func.id for n in ast.walk(fn)
             if isinstance(n, ast.Call) and isinstance(n.func, ast.Name)]
    check("the guard sits INSIDE human_population, so no caller can reach "
          "the null population around it",
          "_refuse_bank_as_population" in calls, calls)


def test_no_threshold():
    print("\n4. no threshold, no verdict — a disclosure and not a gate")
    rows = CS.disclose(["light", "shore"])
    keys = set(rows[0])
    check("the disclosure row carries a DEPTH and no boolean verdict, no "
          "severity and no finding code",
          not (keys & {"code", "severity", "flag", "flags", "verdict",
                       "banned", "over", "exceeds"}), sorted(keys))
    check("a word absent from the bank reads 0 — an ordinary answer, not a "
          "good one",
          rows[1]["depth"] == 0 and rows[1]["word"] == "shore")
    # A DEPTH THE PIN CANNOT READ SAYS SO (doctrine 20). When the bank
    # grows past the 2026-09-02 spectrum, a silent bracket would render
    # "no null available" exactly like "the null calls this ordinary".
    grown = CS.disclosure_lines([
        {"word": "light", "depth": 19, "songs": [], "bank_songs": 20,
         "pinned_at_depth": None, "pinned_null_median": None,
         "refused": []}])
    check("a depth past the pinned spectrum is disclosed as UNAVAILABLE "
          "and names the command that re-derives it, never left blank",
          "no pinned null at depth 19" in grown[1]
          and "--check" in grown[1], grown[1][-90:])
    check("`light` at depth 7 is disclosed BESIDE the null's own reading of "
          "depth 7, so the reader is not invited to read depth as defect",
          rows[0]["depth"] == 7
          and rows[0]["pinned_null_median"] == CS.PINNED["spectrum"][7][1],
          (rows[0]["pinned_at_depth"], rows[0]["pinned_null_median"]))
    text = open(os.path.join(HERE, "cross_song.py"), encoding="utf-8").read()
    check("the module names no ceiling, floor or max of its own — a "
          "threshold on a statistic that is not scale-invariant would ask "
          "a different question at every bank size (doctrine 15/72)",
          not any(t in text for t in ("DEPTH_MAX", "_CEILING = ",
                                      "ADOPTED", "predictability_max")))
    # THE MATCHING IS A DECLARED COORDINATE WITH A PRICE, not a default
    # nobody can question: `--unmatched` runs the panel's own construction
    # and the docstring records what it costs (k=4 on sixteen: matched
    # p<=0.0033, unmatched p=0.1063 — the matching decides the answer).
    # Checked on a synthetic population so this section stays cheap; the
    # real 8,666-song comparison is the sweep's.
    fake = [(i, 10 + (i % 40), {f"w{i}"}) for i in range(400)]
    m_pools = CS._pools(fake, [12, 45], matched=True)
    u_pools = CS._pools(fake, [12, 45], matched=False)
    check("matched draws give each banked song its OWN length-matched "
          "pool; unmatched gives every one the whole population, and both "
          "are reachable so the case for matching stays a measurement",
          m_pools[0] != m_pools[1]
          and u_pools[0] == u_pools[1] == list(range(len(fake))),
          (len(m_pools[0]), len(m_pools[1]), len(u_pools[0])))
    check("a matched pool never drops below the declared floor, so a long "
          "banked song still gets a draw rather than a silently narrowed "
          "null",
          all(len(p) >= CS.MATCH_POOL_MIN for p in m_pools),
          [len(p) for p in m_pools])
    # Doctrine 61: the same k fires 11 times at six songs and 53 at sixteen.
    # Yield is not evidence, and the module reports the proportion beside
    # every count so a reader cannot mistake one for the other.
    check("every spectrum row carries its own SHARE of the bank, because "
          "`>= 4` is two-thirds of six and a quarter of sixteen",
          "k / n" in text and "share" in text)


def test_the_prefix_pin():
    print("\n5. THE PREFIX PIN — `--bank` may only APPEND, so it cannot "
          "become a gate")
    rc0, base = _run(["screen", "light", "shore"])
    rc1, with_bank = _run(["screen", "light", "shore", "--bank"])
    check("both runs exit 0 — a disclosure changes no exit status",
          rc0 == 0 and rc1 == 0, (rc0, rc1))
    check("THE UN-FLAGGED OUTPUT IS A BYTE PREFIX OF THE FLAGGED ONE. A "
          "finding, a code or a moved count would have to change an "
          "EARLIER line, and this check is what makes that impossible "
          "(doctrine 79: a report is not a control)",
          with_bank.startswith(base),
          f"base {len(base)}B, flagged {len(with_bank)}B, "
          f"appended {len(with_bank) - len(base)}B"
          if with_bank.startswith(base) else "NOT A PREFIX")
    tail = with_bank[len(base):] if with_bank.startswith(base) else with_bank
    check("what is appended is the BANK block and only the bank block",
          tail.strip().startswith("BANK   :"), tail.strip()[:60])
    check("the appended block says out loud that it moves nothing above it",
          "moves no verdict" in tail and "no threshold" in tail)
    check("and it discloses the depth with the null beside it",
          "7 of 16" in tail and "matched-null median" in tail, tail[:200])
    # The summary counts are the line a gate would have to move, and the
    # prefix property already forbids that; this states the consequence in
    # the counts' own words so a reader does not have to derive it.
    summary = "0 banned, 0 refused, 0 clean and rhyming"
    check("the banned/clean summary line is present, unchanged, and "
          "appears in neither the appended block nor a second time",
          summary in base and with_bank.count(summary) == 1
          and summary not in tail,
          (base.count(summary), with_bank.count(summary), summary in tail))


def test_the_declared_coordinate():
    print("\n6. the declared coordinate — omit it and pay nothing")
    rc, out = _run(["screen", "light", "shore", "--bank=7"])
    check("`--bank=VALUE` refuses by name at exit 2, the shape "
          "`--voices`/`--isochronous` already hold for a bare flag",
          rc == 2 and "--bank takes NO value" in out, (rc, out[:120]))
    rc, out = _run(["screen", "light", "shore", "--bnak"])
    check("a near-miss spelling still refuses rather than silently "
          "disclosing nothing",
          rc == 2 and "--bnak" in out, (rc, out[:100]))
    # A caller who does not ask pays nothing, and this is measured on a
    # REAL run of the verb rather than read off the indentation. What is
    # NOT claimed: that the tagger is unloaded — the slop floor loads it
    # on every screen either way, so the honest saving is this module and
    # the sixteen files it would read (doctrine 20 on the scope of a
    # claim).
    probe = (
        "import runpy, sys, io\n"
        "sys.argv = ['lyric_harness.py', 'screen', 'light', 'shore']\n"
        "sys.stdout = io.StringIO()\n"
        "try:\n"
        "    runpy.run_path('lyric_harness.py', run_name='__main__')\n"
        "except SystemExit:\n"
        "    pass\n"
        "sys.stdout = sys.__stdout__\n"
        "print('quality.cross_song' in sys.modules,\n"
        "      'quality.narrative_bands' in sys.modules)\n")
    r = subprocess.run([sys.executable, "-c", probe], cwd=ROOT,
                       capture_output=True, text=True, timeout=600)
    check("a screen with no `--bank` imports NEITHER quality.cross_song "
          "nor the content partition it reads the bank with, so no banked "
          "song is opened",
          r.stdout.strip().endswith("False False"), r.stdout.strip()[-60:])
    check("the verb's own usage names the flag, so it is reachable by "
          "reading rather than by knowing (standing rule 3)",
          "--bank" in _run(["--help"])[1])


if __name__ == "__main__":
    test_population()
    test_depth()
    test_the_refusal_is_mechanical()
    test_no_threshold()
    test_the_prefix_pin()
    test_the_declared_coordinate()
    print("=" * 62)
    if FAILURES:
        print(f"{len(FAILURES)} FAILING: {', '.join(FAILURES)}")
        sys.exit(1)
    print("cross-song reuse is DISCLOSED, and the gate is refused by the "
          "shape of the wiring")
