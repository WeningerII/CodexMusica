#!/usr/bin/env python3
"""THE PROCESS BESIDE THE PRODUCT — what the verbs said while a song was written.

    python3 quality/song_log.py --record SONG -- CMD...   # run a verb, bank what it emitted
    python3 quality/song_log.py --show SONG               # render one song's log
    python3 quality/song_log.py --verdicts                # README process claims vs the logs

WHY THIS EXISTS, AND WHY IT IS NOT `RESULTS.tsv`
------------------------------------------------
`quality/song_record.py` banks what a song IS: ten features over the committed
bytes, re-derivable forever. It says nothing about how the song got there —
which pairs were screened and refused, which seed the sweep accepted, what the
grader said on the first pass, how many rounds the loop took. That history was
living in `songs/README.md` as PROSE, written from a session's memory, and a
sentence nobody can check is a story (standing rule 3: an improvised step used
twice is a defect report, not a convenience).

WHAT IS RECORDED: WHAT A VERB PRINTED. NOTHING ELSE.
----------------------------------------------------
`--record` RUNS the command, keeps its exit code, and parses its stdout with a
parser DECLARED for that verb. A verb with no declared parser REFUSES at exit 2
rather than banking a row with no facts in it — an invocation whose output
nothing read looks exactly like an invocation that went well (doctrine 20).

So this file cannot record an intention, a plan, a reason or a regret. It
records emitted text. Everything a session BELIEVES about a song stays in the
README, where `--verdicts` can charge it against these rows.

THE SHAPE IS LONG, NOT WIDE
---------------------------
One row per (invocation, fact). `screen` emits a verdict per pair and `revise`
emits a stop reason; a wide table would have to invent an empty cell for every
fact the other verb does not answer, and an empty cell reads as a measurement
that came back zero. A fact a verb does not emit has NO ROW, which is the only
spelling of "not asked" that cannot be misread as "asked and clean".

`step` is the ordinal within one song's log, so the SEQUENCE survives — the
order in which a writing session asked its questions is itself the record.

A CITATION IS KEYED ON A WORD, NEVER ON THAT ORDINAL
----------------------------------------------------
`[LOG: clean_or_non_rhyme carry_it_over.txt bell]` in `songs/README.md` names
the screen run that screened `bell`, and the value written immediately before
it must EQUAL the banked one. Keyed on the step instead, a citation would be
an offset from a moving origin — the defect this repository already found in
its own `data/sources.tsv` line-number citations, where an unrelated insertion
made a true sentence false without one character of it changing. A word
screened by two runs REFUSES as ambiguous rather than resolving to the first.

WHAT A ROW DOES NOT CLAIM
-------------------------
The commit and date stamp when the row was RECORDED, not the hour of the
original writing session — a re-recording of the same command against the same
committed bytes produces the same facts, which is the property that makes this
a log rather than a memoir. The genuinely unrepeatable half — a superseded
draft nobody committed — has no rows and cannot get any, so `--verdicts`
REFUSES those claims rather than passing them.
"""
import argparse
import datetime
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SONGS = os.path.join(ROOT, "songs")
README = os.path.join(SONGS, "README.md")
sys.path.insert(0, ROOT)

HEADER = ["song", "step", "measured", "harness_commit", "verb", "exit",
          "fact", "value"]


def log_path(song):
    return os.path.join(SONGS, song.replace(".txt", "") + ".log.tsv")


def harness_commit():
    """One definition, borrowed rather than respelled — a second copy of the
    commit rule is how two registers start disagreeing about which tree a
    measurement was taken on (doctrine 1)."""
    from quality.song_record import harness_commit as hc
    return hc()


# ---------------------------------------------------------------- parsers
# DECLARED per verb. Each returns [(fact, value), ...] read from the verb's
# OWN printed text. A parser that finds nothing returns [] and `--record`
# refuses the row: a verb that printed something this file could not read is
# a defect report, not a silent success.

def _p_screen(out):
    """A REFUSAL IS A ROW. The first draft matched only the scored shape
    (`a ~ b  RHYME 1.000  CLEAN`), so a pair the grader could not read —
    which prints `a ~ b  REFUSED — CMUdict has no pronunciation ...` and
    carries no relation and no number — produced NO ROW while the summary
    still counted it. The family whose members are unreadable and the family
    whose members are all banned then looked identical pair by pair, which is
    doctrine 79 in the one register built to keep the two apart."""
    facts = []
    for m in re.finditer(r"^\s{2}(\S+) ~ (\S+)\s\s+(.+)$", out, re.M):
        tail = m.group(3).strip()
        scored = re.match(r"\S+\s+[\d.]+\s+(.+)$", tail)
        if scored:
            verdict = scored.group(1).strip()
        elif tail.startswith("REFUSED"):
            # Keep the CAUSE, drop the standing paragraph the verb prints
            # after it — a row records what could not be read, not the
            # sentence explaining why refusing beats guessing.
            cause = tail.split("\u2014", 1)[-1].split(";")[0].strip()
            verdict = "REFUSED — " + cause
        else:
            verdict = tail
        facts.append(("pair:%s~%s" % (m.group(1), m.group(2)), verdict))
    m = re.search(r"^\s*(\d+) banned, (\d+) refused, (\d+) clean", out, re.M)
    if m:
        facts += [("banned", m.group(1)), ("refused", m.group(2)),
                  ("clean_or_non_rhyme", m.group(3))]
    return facts


def _p_plan(out):
    facts = []
    m = re.search(r"PLAN: form=(\S+) seed=(\d+) -> (\d+) line\(s\), "
                  r"(\d+) section\(s\): (\S+)", out)
    if m:
        facts += [("form", m.group(1)), ("seed", m.group(2)),
                  ("lines", m.group(3)), ("sections", m.group(4)),
                  ("pattern", m.group(5))]
    m = re.search(r"METER: (\S+) as (\([^)]*\))", out)
    if m:
        facts.append(("meter", m.group(1) + " as " + m.group(2)))
    m = re.search(r"subdivision (\d+)", out)
    if m:
        facts.append(("subdivision", m.group(1)))
    m = re.search(r"^\s*GROUPS\s*: (.+)$", out, re.M)
    if m:
        facts.append(("groups", m.group(1).strip()))
    m = re.search(r"^\s*RETURNS: (.+)$", out, re.M)
    if m:
        facts.append(("returns", m.group(1).strip()))
    return facts


def _p_sweep(out):
    facts = []
    m = re.search(r"SWEEP: seeds (\S+) \((\d+)\), form=(\S+)", out)
    if m:
        facts += [("sweep_range", m.group(1)), ("swept", m.group(2)),
                  ("form", m.group(3))]
    # ONE ROW, NOT ONE PER PREDICATE. The verb prints a WANT line per
    # predicate; banking each as its own `want` fact puts five values under
    # one name in one invocation, and every reader of the log then has to
    # pick. The declaration was `--want=a;b;c` — one coordinate — so the row
    # is the coordinate, spelled the way it was declared.
    wants = [m.group(1).strip()
             for m in re.finditer(r"^\s*WANT (.+?) — ", out, re.M)]
    if wants:
        facts.append(("want", ";".join(wants)))
    m = re.search(r"swept (\d+)\s+planned (\d+)\s+REFUSED by the planner "
                  r"(\d+)\s+accepted (\d+) \(([\d.]+)%", out)
    if m:
        facts += [("planned", m.group(2)), ("planner_refused", m.group(3)),
                  ("accepted", m.group(4)), ("accepted_rate", m.group(5))]
    m = re.search(r"ACCEPTED[^\n]*\n\s*([\d, ]+)$", out, re.M)
    if m:
        facts.append(("accepted_seeds", re.sub(r"\s+", "", m.group(1))))
    return facts


def _p_song(out):
    facts = []
    m = re.search(r"MANDATE: (\d+) group\(s\) over (\d+) lines, "
                  r"(\d+) mandated pair\(s\), source=(\S+)", out)
    if m:
        # `mandate_groups` and NOT `groups`: `plan` already banks a `groups`
        # fact and it is the mandate STRING (`1.T4,2.endword;...`), where
        # this one is an integer COUNT. One name over two quantities inside
        # one register is doctrine 1's own case, and a reader comparing them
        # would be comparing a spelling with a cardinality.
        facts += [("mandate_groups", m.group(1)), ("lines", m.group(2)),
                  ("mandated_pairs", m.group(3)), ("mandate_source",
                                                   m.group(4))]
    m = re.search(r"draft: (\d+) line\(s\), md5 (\w+)", out)
    if m:
        facts.append(("md5", m.group(2)))
    m = re.search(r"REPORT: (\d+) line\(s\) briefed — (\d+) FLAG, (\d+) NOTE"
                  r"[^\n]*?(\d+) WHOLE-DRAFT finding\(s\), (\d+) of them",
                  out)
    if m:
        facts += [("briefed", m.group(1)), ("per_line_flag", m.group(2)),
                  ("per_line_note", m.group(3)),
                  ("whole_draft", m.group(4)),
                  ("whole_draft_flag", m.group(5))]
    # Every finding CODE the report named, with the count it named itself.
    # Counted from the report rather than re-derived: this file records what
    # was printed, and re-deriving would make it a second grader.
    codes = {}
    for m in re.finditer(r"\[(FLAG|NOTE)\] ([A-Z][A-Z0-9_]+)\s*(?:x(\d+))?",
                         out):
        codes.setdefault((m.group(1), m.group(2)), 0)
        codes[(m.group(1), m.group(2))] += int(m.group(3) or 1)
    for (sev, code) in sorted(codes):
        facts.append(("finding:%s" % code, "%s x%d" % (sev, codes[(sev, code)])))
    return facts


def _p_revise(out):
    facts = []
    m = re.search(r"revise_loop: (\S+) after (\d+) round\(s\)", out)
    if m:
        facts += [("stop_reason", m.group(1)), ("rounds", m.group(2))]
    m = re.search(r"DRAFT: handed in (\d+) line\(s\), md5 (\w+) — emitted "
                  r"(\d+) line\(s\), md5 (\w+)(.*)$", out, re.M)
    if m:
        facts += [("md5_in", m.group(2)), ("md5_out", m.group(4)),
                  ("unchanged", "yes" if "UNCHANGED" in m.group(5) else "no")]
    m = re.search(r"PAIRS: mandated (\d+), judged (\d+), refused (\d+)", out)
    if m:
        facts += [("mandated", m.group(1)), ("judged", m.group(2)),
                  ("pairs_refused", m.group(3))]
    return facts


PARSERS = {
    "screen": _p_screen,
    "plan": _p_plan,
    "plan --sweep": _p_sweep,
    "song": _p_song,
    "revise": _p_revise,
    "brief": _p_song,
}


def verb_of(argv):
    """-> the declared parser key, or None. `plan --sweep` is its OWN verb
    here and not a flag on `plan`: it emits an acceptance RATE and no plan,
    so a parser reading it as a plan would find nothing and report that the
    command said nothing."""
    rest = [a for a in argv if not a.startswith("-")]
    head = None
    for a in argv:
        if a.endswith(".py") or a in ("python3", "python"):
            continue
        if not a.startswith("-"):
            head = a
            break
    if head == "plan" and any(a.startswith("--sweep") for a in argv):
        return "plan --sweep"
    if head in PARSERS:
        return head
    # `python3 quality/plan.py --sweep=...` reaches the same instrument
    # without naming a verb; read the module.
    if any(a.endswith("plan.py") for a in argv):
        return "plan --sweep" if any(a.startswith("--sweep")
                                     for a in argv) else "plan"
    del rest
    return None


# ---------------------------------------------------------------- the log

def read_log(song):
    p = log_path(song)
    if not os.path.exists(p):
        return []
    with open(p, encoding="utf-8") as f:
        rows = [ln.rstrip("\n").split("\t") for ln in f if ln.strip()]
    return [dict(zip(HEADER, r)) for r in rows[1:]]


def append(song, rows):
    p = log_path(song)
    new = not os.path.exists(p)
    with open(p, "a", encoding="utf-8") as f:
        if new:
            f.write("\t".join(HEADER) + "\n")
        for r in rows:
            f.write("\t".join(str(r[k]) for k in HEADER) + "\n")


def record(song, argv):
    verb = verb_of(argv)
    if verb is None:
        print("  REFUSED — no declared parser for this command.")
        print("    declared: " + ", ".join(sorted(PARSERS)))
        print("    A row banked from output nothing read is a row that looks")
        print("    like a record and is a memory (doctrine 20).")
        return 2
    proc = subprocess.run(argv, cwd=ROOT, capture_output=True, text=True)
    out = proc.stdout + proc.stderr
    facts = PARSERS[verb](out)
    if not facts:
        print("  REFUSED — `%s` ran (exit %d) and this parser read NOTHING "
              "from it." % (verb, proc.returncode))
        print("    The verb's output moved, or the command did not do what "
              "its name says. Either way the row is not banked: an empty")
        print("    record of a real run is worse than no record.")
        sys.stdout.write(out[-1200:])
        return 2
    step = 1 + max([int(r["step"]) for r in read_log(song)] or [0])
    stamp = datetime.date.today().isoformat()
    sha = harness_commit()
    append(song, [{"song": song, "step": step, "measured": stamp,
                   "harness_commit": sha, "verb": verb,
                   "exit": proc.returncode, "fact": f, "value": v}
                  for f, v in facts])
    print("  RECORDED step %d — `%s` exit %d, %d fact(s) -> %s"
          % (step, verb, proc.returncode, len(facts),
             os.path.relpath(log_path(song), ROOT)))
    for f, v in facts:
        print("    %-28s %s" % (f, v))
    return 0


def show(song):
    rows = read_log(song)
    if not rows:
        print("  no log for %s" % song)
        return 2
    print("  %s — %d fact(s) over %d invocation(s)"
          % (song, len(rows), len(set(r["step"] for r in rows))))
    last = None
    for r in rows:
        if r["step"] != last:
            last = r["step"]
            print("  [%s] %s  exit %s  (%s @ %s)"
                  % (r["step"], r["verb"], r["exit"], r["measured"],
                     r["harness_commit"]))
        print("      %-28s %s" % (r["fact"], r["value"]))
    return 0


# ------------------------------------------------------- the claim gate
# The README states process outcomes in prose. Each of these patterns names
# a fact the LOG holds, so a sentence and a row can be put beside each other.
# Anything not matched here is not charged — this gate is about the claims
# it can resolve, and says how many it could not (doctrine 79).

CLAIMS = [
    (re.compile(r"`song` exit (\d+)"), "song", ["exit"]),
    (re.compile(r"(\d+) FLAG\b"), "song", ["per_line_flag"]),
    (re.compile(r"`revise` (\w+) in (\d+) rounds?"), "revise",
     ["stop_reason", "rounds"]),
    (re.compile(r"md5 `(\w+)`"), "revise", ["md5_out"]),
    (re.compile(r"(\d+) pairs mandated / (\d+) judged / (\d+) refused"),
     "revise", ["mandated", "judged", "pairs_refused"]),
    (re.compile(r"plans all (\d+) seeds"), "plan --sweep", ["swept"]),
    (re.compile(r"refused by the planner on (\d+) of them"), "plan --sweep",
     ["planner_refused"]),
    (re.compile(r"accepts \**(\d+)\**\s*\(([\d.]+)%\)"), "plan --sweep",
     ["accepted", "accepted_rate"]),
    (re.compile(r"\*\*(\d+) lines, (\d+) sections"), "plan",
     ["lines", "sections"]),
]
# EVERY GROUP IS CHARGED TO ITS OWN FACT, INDEX-ALIGNED. The first draft
# tested "does any captured number equal the one fact we looked up", which
# passes a triple whose three numbers are the right SET in the wrong ORDER —
# a mandated/judged/refused claim that swaps refused and judged is exactly the
# doctrine 79 error this repository spells out, and a gate that admits it is
# reporting the multiset rather than the counts.
for _pat, _verb, _facts_ in CLAIMS:
    assert _pat.groups == len(_facts_), (_pat.pattern, _facts_)


def _sections():
    """-> [(song, text)] — the README's per-song sections, keyed by the lyric
    file each heading names."""
    with open(README, encoding="utf-8") as f:
        text = f.read()
    out, cur, buf = [], None, []
    for ln in text.splitlines():
        m = re.match(r"^## `([a-z_0-9]+\.txt)`", ln)
        if m:
            if cur:
                out.append((cur, "\n".join(buf)))
            cur, buf = m.group(1), []
        elif ln.startswith("## "):
            # ANY heading closes the section, not only the next SONG heading.
            # Read the other way, the file's general prose — which talks about
            # exit codes and round counts in the abstract — would be charged to
            # whichever song happened to be written about last, and would pass
            # or fail against a log it is not about.
            if cur:
                out.append((cur, "\n".join(buf)))
            cur, buf = None, []
        elif cur is not None:
            buf.append(ln)
    if cur:
        out.append((cur, "\n".join(buf)))
    return out


LOG_CITE = re.compile(
    r"(\S+?)(\s*)\[LOG:\s*([a-z_0-9:~']+)\s+([a-z_0-9]+\.txt)"
    r"(?:\s+([a-z']+))?\s*\]", re.I)
# AN EXAMPLE IS A CITATION INSIDE A CODE SPAN, AND THE DISCRIMINATOR IS
# ADJACENCY. Prose that TEACHES the notation has to be able to spell it —
# `[LOG: clean_or_non_rhyme carry_it_over.txt bell]` — and a real citation is
# always `VALUE [LOG: ...]` with the value and a space in front of it. So a
# `[LOG:` with a backtick FLUSH against it is notation and a `[LOG:` with
# whitespace in front of its value is a claim. The escape is COUNTED and
# printed rather than silently skipped: an un-charged citation nobody can see
# is a way to smuggle a claim past the gate wearing a code span.


def _steps(song):
    """-> {step: {fact: value}} — the log grouped back into invocations."""
    out = {}
    for r in read_log(song):
        out.setdefault(int(r["step"]), {})[r["fact"]] = r["value"]
        out[int(r["step"])]["exit"] = r["exit"]
        out[int(r["step"])]["_verb"] = r["verb"]
    return out


def resolve_cite(song, fact, word=None):
    """-> (value, None) or (None, why-it-is-REFUSED).

    THE KEY IS A WORD, NOT A STEP ORDINAL, and that is the whole design. A
    citation into an append-only log keyed on position is an offset from a
    moving origin — the same defect this repository already found in its own
    `data/sources.tsv:NNN` citations, where an unrelated insertion made a true
    sentence false without one character of it changing. A screen run is named
    by any word it screened, which survives reordering, re-recording and
    insertion; a word screened by two runs REFUSES as ambiguous rather than
    resolving to whichever came first.
    """
    steps = _steps(song)
    if not steps:
        return None, "no log for %s" % song
    if word:
        hits = [n for n, d in steps.items()
                if any(k.startswith("pair:") and
                       word.lower() in k[5:].split("~") for k in d)]
        if not hits:
            return None, "no screen run in %s includes %r" % (song, word)
        if len(hits) > 1:
            return None, ("%r names %d runs in %s; a citation must name one"
                          % (word, len(hits), song))
        d = steps[hits[0]]
        if fact not in d:
            return None, ("the run naming %r holds no %r" % (word, fact))
        return d[fact], None
    hits = [n for n in sorted(steps) if fact in steps[n]]
    if not hits:
        return None, "the log for %s holds no %r" % (song, fact)
    return steps[hits[-1]][fact], None


def _facts(song):
    """-> {verb: {fact: value}} for the LAST invocation of each verb.

    A song's prose describes the state it SHIPPED in, so a verb run more than
    once is answered by its final run. Earlier runs are not discarded — they
    are rows in the log, and `--show` prints every one in order; what this
    view does is refuse to let an earlier answer stand in for the shipped one.
    """
    steps = {}
    for r in read_log(song):
        steps.setdefault((r["verb"], int(r["step"])), {})[r["fact"]] = r["value"]
        steps[(r["verb"], int(r["step"]))]["exit"] = r["exit"]
    d = {}
    for (verb, step) in sorted(steps, key=lambda k: k[1]):
        d[verb] = steps[(verb, step)]
    return d


def verdicts():
    ok = bad = refused = 0
    for song, text in _sections():
        f = _facts(song)
        if not f:
            print("  REFUSED  %s — no log; nothing to charge its prose "
                  "against" % song)
            refused += 1
            continue
        for pat, verb, facts in CLAIMS:
            for m in pat.finditer(text):
                claim = m.group(0)
                for i, fact in enumerate(facts):
                    said = m.group(i + 1)
                    if verb not in f or fact not in f[verb]:
                        print("  REFUSED  %s: %r — the log holds no %s/%s"
                              % (song, claim, verb, fact))
                        refused += 1
                        continue
                    got = str(f[verb][fact])
                    if got == said:
                        ok += 1
                    else:
                        print("  MISMATCH %s: %r — the log says %s = %s, the "
                              "README says %s" % (song, claim, fact, got, said))
                        bad += 1
    with open(README, encoding="utf-8") as fh:
        whole = fh.read()
    cited = examples = 0
    for m in LOG_CITE.finditer(whole):
        said, gap, fact, song, word = m.groups()
        if not gap and said.endswith("`"):
            examples += 1
            continue
        said = said.strip("`*_ ")
        got, why = resolve_cite(song, fact, word)
        if got is None:
            print("  REFUSED  %s: %r — %s" % (song, m.group(0), why))
            refused += 1
        elif str(got) == said:
            ok += 1
            cited += 1
        else:
            print("  MISMATCH %s: %r — the log says %s, the README says %s"
                  % (song, m.group(0), got, said))
            bad += 1
    print()
    print("  %d claim(s) RESOLVED (%d of them by an explicit [LOG:] "
          "citation), %d MISMATCHED, %d REFUSED — three counts, never summed "
          "(doctrine 79)" % (ok, cited, bad, refused))
    print("  %d [LOG:] occurrence(s) read as NOTATION rather than as a claim "
          "— prose teaching the citation form, marked by a code span flush "
          "against the bracket" % examples)
    print()
    print("RESULT: %s" % ("PASS" if bad == 0 else "FAIL"))
    return 0 if bad == 0 else 3


def main():
    ap = argparse.ArgumentParser(add_help=True)
    ap.add_argument("--record", metavar="SONG")
    ap.add_argument("--show", metavar="SONG")
    ap.add_argument("--verdicts", action="store_true")
    ap.add_argument("cmd", nargs="*")
    a = ap.parse_args()
    if a.record:
        argv = list(a.cmd)
        if argv and argv[0] == "--":
            argv = argv[1:]
        if not argv:
            print("  REFUSED — --record needs a command: "
                  "--record SONG -- python3 lyric_harness.py song ...")
            return 2
        return record(a.record, argv)
    if a.show:
        return show(a.show)
    if a.verdicts:
        return verdicts()
    ap.print_help()
    return 2


if __name__ == "__main__":
    sys.exit(main())
