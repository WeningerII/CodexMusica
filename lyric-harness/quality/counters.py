#!/usr/bin/env python3
"""COUNTERS — every row of BACKLOG.md's counters table, MEASURED.

    python3 quality/counters.py            # measure and print
    python3 quality/counters.py --check    # FAIL if BACKLOG.md's table is stale
    python3 quality/counters.py --write    # rewrite BACKLOG.md's table
    python3 quality/counters.py --slow     # also run the counters that cost

WHY THIS FILE EXISTS, WHICH IS NOT "TO TIDY A TABLE".

`BACKLOG.md` ended with a table headed "Counters, so drift is visible". It was
hand-maintained, and it had drifted -- which is doctrine 48 in the plainest
possible form: a principle that lives only in prose gets followed exactly as
often as someone remembers it. Re-typing the current values is not a fix. It is
the same defect with fresher numbers, and it would have drifted again inside a
week, because nothing about a table of integers tells a later session that one
of them stopped being true.

Two moves in this repo already made exactly this trade and both worked.
`quality/verify_doctrines.py` turned "does every `doctrine N` citation resolve?"
from an audit into a command, across 2,090 citation sites. The `wiring` verb
turned "is this module plugged in?" into a command. This is the third: the
counters table becomes OUTPUT, and the committed table becomes a FAILING TEST.

WHAT DRIFTED, AND WHY -- because the reason is the part that stops it recurring:

  * `doctrines | 102 (27 in CLAUDE.md, 75 in quality/METHOD.md)`.
    There are two numbering systems in `CLAUDE.md` and they do not collide: the
    doctrine run (1-95) and the `Known gaps` list (1-7, cited as `known gap N`).
    Both are written `^\\d+\\. \\*\\*`, so a bare regex over the file counted
    20 + 7 = 27 and called them all doctrines. 27 + 75 = 102. The union is 95.
    The fix is not a better regex: it is to read ONLY between the
    `<!-- DOCTRINE-BLOCK -->` markers, which is what `verify_doctrines.py`
    already does, so this file CALLS it rather than growing a second parser
    that can drift from the first.

  * `MISSING entries ... | 53 / 10 / 2 / 7 (73 entries)`.
    53 + 10 + 2 + 7 = 72, against a stated total of 73. The row contradicted
    itself in its own cell and nobody had added it up. PARTIAL is 11. The
    renderer below prints the parts as a SUM for that reason, and `_missing()`
    raises if they do not reconcile: a total that disagrees with its parts is
    the one arithmetic error a counters table can make on its own.

  * `band FPR on random pairs | 3.57% (107/3,000 at seed 20260810)`.
    Not wrong -- unreproducible from its own stated command. `redteam_band.py`
    defaults to n=4,000 and prints 3.60%; 3.57% needs the explicit argument
    `3000`, which the row does not give. Doctrine 58: a recorded COUNT is a
    threshold nobody wrote down, and doctrine 91: it is a coordinate of the
    RENDERING too. So this counter measures BOTH n and prints them together.

  * `corpus/song/ files`, `data/sources.tsv rows`, `data/lyricists.tsv rows`.
    Transcriptions as-of-a-date of quantities that move whenever a corpus cell
    runs. They were stale by construction. They are marked VOLATILE below,
    which means the committed table carries no number for them at all -- only
    the command. A number you know is moving does not belong in a file that is
    read as a record. `--check` enforces the absence.

THE THREE COUNTS, AND THE TWO KINDS OF "CANNOT TELL".

Doctrine 79: a refusal is not a failure, and putting it in the numerator charges
the wrong layer -- so this reports ASKED, ANSWERED and REFUSED separately, the
same way the sonnet battery reports mandated / judged / refused and the `function`
verb reports asked / answered / refused. Doctrine 28: "none" and "cannot tell"
are different values, mechanically -- and so are the two REASONS a counter
refuses, which is why `Refused` carries a typed `kind`:

  JUDGEMENT -- no measurement exists. "Which adversaries are BUILT" is a status
               a person sets; `built` / `partial` / `ad hoc` / `missing` are
               editorial verdicts in BACKLOG.md's own table. A runner that
               printed a number here would be inventing one.
  COST      -- a measurement exists and this run declined to pay for it. The
               mutation sweep forks the whole suite once per mutation. It is
               reachable with `--slow`, and until it is paid for, the answer is
               UNKNOWN rather than the last value somebody typed.

A counter that cannot be re-derived is doctrine 58 wearing a table cell, so
every counter below states its derivation in the docstring beside it and names
the command a human runs to see the same number.

WHAT THIS FILE DOES NOT DO. It does not re-implement any instrument it reports.
The doctrine run comes from `verify_doctrines.definitions()`; the stranded count
from `lyric_harness.py wiring`; the battery from `battery.py`; the false-positive
rate from `quality/redteam_band.py`; the register findings from
`quality/audit_register.py`. Where an instrument prints rather than returns, this
parses its printed line of record -- deliberately, because that is the line a
human sees when they run the documented command, and a counter that agreed with
the code while disagreeing with the output would be the worse defect. If the
parse fails, the counter REFUSES; it never falls back to a remembered value.
"""

import argparse
import collections
import csv
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, ROOT)

BACKLOG = os.path.join(ROOT, "BACKLOG.md")
MISSING = os.path.join(ROOT, "MISSING.md")

#: The counters table in BACKLOG.md is delimited, the same way the doctrine runs
#: in CLAUDE.md and quality/METHOD.md are. A heading regex would have to survive
#: every future edit to the prose around it; a marker pair does not.
OPEN_MARK = "<!-- COUNTERS -->"
CLOSE_MARK = "<!-- /COUNTERS -->"

#: What the table says instead of a number for a quantity that is moving.
RUNTIME_CELL = ("MEASURED AT RUNTIME — `python3 quality/counters.py`")

JUDGEMENT = "JUDGEMENT"
COST = "COST"


# ---------------------------------------------------------------------------
# Result types. A measurement and a refusal are different objects, not the same
# object with a sentinel value in it (doctrine 28).
# ---------------------------------------------------------------------------


class Answered:
    def __init__(self, cell, evidence=""):
        self.cell = cell
        self.evidence = evidence

    kind = None
    refused = False


class Refused:
    def __init__(self, kind, reason, remedy=""):
        self.kind = kind
        self.reason = reason
        self.remedy = remedy
        self.evidence = reason
        self.cell = "REFUSED (%s) — %s" % (kind.lower(), reason)

    refused = True


class Counter:
    """One row. `fn` returns `Answered` or `Refused`, or raises.

    `volatile` marks a quantity that other cells are changing WHILE this runs.
    Its committed cell is the runtime marker and never a number, so there is
    nothing for a later session to find stale.
    """

    def __init__(self, key, command, fn, volatile=False, slow=False):
        self.key = key
        self.command = command
        self.fn = fn
        self.volatile = volatile
        self.slow = slow

    def measure(self, slow=False):
        if self.slow and not slow:
            return Refused(COST, "not measured on the cheap path",
                           "python3 quality/counters.py --slow")
        try:
            return self.fn()
        except Exception as e:                                   # noqa: BLE001
            return Refused(COST, "the instrument did not answer: %s: %s"
                           % (type(e).__name__, e), self.command)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _sh(args, timeout=900):
    """Run one of this repo's own runners and hand back its stdout.

    Returns (stdout, returncode). A non-zero return is NOT swallowed -- several
    of these runners exit non-zero precisely when they have something to say,
    so the caller decides.
    """
    p = subprocess.run([sys.executable] + args, cwd=ROOT, timeout=timeout,
                       stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                       text=True, errors="replace")
    return p.stdout, p.returncode


def _grab(pattern, text, what):
    """Pull one figure out of a runner's printed output, or RAISE.

    MULTILINE always: every pattern here anchors on a line of a multi-line
    report. There is deliberately no fallback value -- a counter that cannot
    read its instrument REFUSES (doctrine 28), because the alternative is
    printing the last number somebody typed, which is the whole defect.
    """
    m = re.search(pattern, text, re.M)
    if not m:
        raise ValueError("could not read %s out of the runner's output; the "
                         "line this counter parses has changed shape and the "
                         "counter must be repaired, not guessed" % what)
    return m


def _int(s):
    return int(s.replace(",", ""))


_CACHE = {}


def _once(key, args, timeout=900):
    """Run a runner at most once per process and hand every caller its stdout.

    Three counters below read the register audit. Running it three times would
    be slow AND would let two counters disagree about a number produced by one
    instrument, which is the defect this file exists to remove.
    """
    if key not in _CACHE:
        _CACHE[key] = _sh(args, timeout=timeout)
    return _CACHE[key]


def _derivation(out, ident):
    """-> the `measured:` text of one lettered derivation in an audit_register
    run. The block shape is `  VERDICT  Dn  entry  what` then indented
    `register:` / `measured:` / `reproduce:` lines."""
    m = _grab(r"^ +\S+ +%s +\S.*?\n(?:.*\n)*?\s+measured:\s+(.+)$" % ident,
              out, "derivation %s" % ident)
    return m.group(1).strip()


# WHY THESE ARE SUBPROCESSES AND NOT IMPORTS.
#
# The first version of this file did `from quality import audit_register` and
# `from quality.mutate import MUTATIONS`, which is the obvious way to call an
# instrument rather than duplicate it. Measured, it cost something real:
# `lyric_harness.py wiring` reports "one-shot runners, standalone by design" by
# listing the modules NOTHING imports, and importing those two made them stop
# being orphans -- so the runner list fell from 29 to 28 and
# `python3 quality/audit_register.py` and `python3 quality/mutate.py` stopped
# being NAMED. Nothing broke: STRANDED stayed none and every test passed. What
# was lost was discoverability, which is the exact thing CLAUDE.md says a count
# of runners is not, and the exact way `audit_corpus.py`, `relations_null.py`
# and `ltc_overlap.py` were unfindable for a week.
#
# `audit_register.py` already states the convention this violates -- "a file
# does not become wired by being audited" -- and applies it to itself. `wiring`
# does not yet apply it to the auditor's TARGETS, so an auditor that imports
# what it audits silently deletes those modules from the map. That is a defect
# in `wiring`, written up for its owner rather than worked around by hiding the
# import from the AST walk; hiding an edge from an auditor would be worse than
# the edge.
#
# Until then this file calls the two runners across a process boundary, which
# creates no import edge and has the independent virtue of reading the same
# output a human reads. Test files are exempt: `wiring` never treats a `test_*`
# module as an orphan, so importing `test_mutation.ALLOWLIST` costs nothing.


# ---------------------------------------------------------------------------
# THE COUNTERS
# ---------------------------------------------------------------------------


MISSING_STATUSES = ("OPEN", "PARTIAL", "BLOCKED", "CLOSED", "WITHDRAWN")


def missing_entry_statuses():
    """-> [(heading_line, 1-based line number, status or None), ...].

    THE ONE PARSER, and it is exposed rather than inlined for a reason. This
    file's `missing_entries()` counts these into BACKLOG.md's table;
    `quality/verify_entries.py` judges each entry's CLAIMS against the same
    status. Two parsers that disagreed about whether M-6 is OPEN would make the
    two instruments contradict each other over one file, which is the defect
    both of them exist to catch. The rule -- first status token over the
    heading line PLUS its continuation -- is stated and defended in
    `missing_entries()` below, including why both neighbouring rules are wrong.
    """
    lines = open(MISSING, encoding="utf-8").read().split("\n")
    out = []
    for i, ln in enumerate(lines):
        if not ln.startswith("### "):
            continue
        blob, j = ln, i + 1
        while j < len(lines) and lines[j].strip() \
                and not lines[j].startswith("#") \
                and not lines[j].startswith("**"):
            blob += " " + lines[j]
            j += 1
        found = [t for t in re.findall(r"`([A-Z]+)`", blob)
                 if t in MISSING_STATUSES]
        out.append((ln, i + 1, found[0] if found else None))
    return out


def missing_entries():
    """MISSING.md entries by status.

    DERIVATION. Every `^### ` line in MISSING.md is one entry -- that is the
    file's own convention, and `audit_register.read_entries` reads it the same
    way, so its printed entry total is used below as an independent check on
    this one. The STATUS is the first backticked all-caps word drawn from the five
    MISSING.md declares in its own header, searched over the heading line AND
    the lines that continue it. A continuation stops at a blank line, a new `#`
    heading, or a `**` bold run, which is where every entry's body starts.

    THE RULE IS THE FIRST TOKEN OVER HEADING-PLUS-CONTINUATION, and both
    neighbouring rules are wrong, in opposite directions -- which is the whole
    reason to write it down:

      heading line only  -> `L-3`'s heading wraps and its `PARTIAL` sits on the
                            next line, so the entry falls out of every bucket.
                            This is EXACTLY the committed row: it reproduces
                            `53 / 10 / 2 / 7`, total 72, while a separate count
                            of `^### ` correctly said 73. The parts and the
                            total had been produced by two different rules.
      last token         -> `C-2`'s continuation ends "catalogues do not
                            `OPEN`", so C-2 flips PARTIAL -> OPEN.

    Two things are ASSERTED rather than reported, because both are errors the
    table can make with no outside help:
      - the parts must sum to the total. `53 / 10 / 2 / 7 (73 entries)` sums to
        72 and stood in the file unremarked.
      - every entry must carry a status. An entry with none is not a zero.

    Cross-checked against `quality/audit_register.py`, which counts the same
    entries with an independent parser; the two totals must agree.

    The per-entry read is `missing_entry_statuses()` below; this function only
    tallies it. `quality/verify_entries.py` reads the same list, so the status
    a claim is judged against and the status this row counts cannot diverge.
    """
    counts = collections.Counter()
    unstated = []
    rows = missing_entry_statuses()
    total = len(rows)
    for heading, _lineno, status in rows:
        if status is None:
            unstated.append(heading[:60])
        else:
            counts[status] += 1
    if unstated:
        raise ValueError("entries with no status: %s" % unstated)
    if sum(counts.values()) != total:
        raise ValueError("parts %d do not sum to the total %d"
                         % (sum(counts.values()), total))

    out, _ = _once("register", ["quality/audit_register.py", "--slow"])
    n = int(_grab(r"^  (\d+) entries, \d+ carry numbers", out,
                  "audit_register's entry count").group(1))
    cross = "audit_register's independent parser agrees: %d entries" % n
    if n != total:
        raise ValueError("DISAGREEMENT: audit_register reads %d entries, "
                         "this reads %d" % (n, total))

    order = [s for s in MISSING_STATUSES if counts.get(s)]
    cell = "%s = %d entries" % (
        " / ".join("%d %s" % (counts[s], s) for s in order), total)
    return Answered(cell, cross)


def doctrines():
    """The doctrine run, and the SECOND numbering that is not part of it.

    DERIVATION. `quality/verify_doctrines.py` already extracts every
    `^\\d+\\. \\*\\*` from between the `<!-- DOCTRINE-BLOCK -->` markers of
    CLAUDE.md and quality/METHOD.md, which is exactly CLAUDE.md's own stated
    invariant, so this CALLS `definitions()` rather than growing a second
    parser. An auditor with a private copy of the thing it audits is the
    `gabay higaad` shape one layer down.

    The bug this replaces: `CLAUDE.md`'s `Known gaps` list (1-7, cited as
    `known gap N`) is written in the same markdown shape as a doctrine, so a
    bare `^\\d+\\. \\*\\*` over the whole file returns 27 where the doctrine
    block holds 20. 27 + 75 = 102, and that is the entire provenance of the
    committed figure. The two runs are printed side by side below so the
    distinction is visible rather than assumed, and CLAUDE.md's invariant --
    exactly 1..N contiguous, nothing defined twice -- is asserted here.
    """
    from quality import verify_doctrines as VD
    defs = VD.definitions()
    per = collections.Counter(h for hs in defs.values() for h in hs)
    n = len(defs)
    dup = sorted(k for k, hs in defs.items() if len(hs) > 1)
    run = sorted(defs)
    if dup:
        raise ValueError("defined in both files: %s" % dup)
    if run != list(range(1, n + 1)):
        raise ValueError("not a contiguous run 1..%d: missing %s"
                         % (n, [i for i in range(1, max(run) + 1)
                                if i not in defs]))
    gap_defined, _ = VD.gap_check()
    claude = open(os.path.join(ROOT, "CLAUDE.md"), encoding="utf-8").read()
    bare = len(re.findall(r"^\d+\. \*\*", claude, re.M))
    cell = ("**%d**, a contiguous run 1–%d with no number in both files "
            "(%d in `CLAUDE.md`, %d in `quality/METHOD.md`)"
            % (n, n, per.get("CLAUDE.md", 0), per.get("quality/METHOD.md", 0)))
    ev = ("`known gap N` is a SEPARATE numbering, 1–%d, %d items — not part of "
          "the run. CLAUDE.md's bare `^N. **` count is %d = %d doctrines + %d "
          "known gaps, which is where the recorded 27 (and so 102) came from."
          % (max(gap_defined), len(gap_defined), bare,
             per.get("CLAUDE.md", 0), bare - per.get("CLAUDE.md", 0)))
    return Answered(cell, ev)


def stranded():
    """Production modules with no caller and no way to run them.

    DERIVATION. `python3 lyric_harness.py wiring` walks the AST of every .py in
    the repo, collects every imported name, and reports what is left over,
    splitting it into one-shot runners (a `__main__` block: the author saying
    this is meant to be RUN) and genuinely stranded libraries. This parses that
    runner's own printed verdict rather than re-walking the tree, for the same
    reason `doctrines()` calls `verify_doctrines`.

    `rhyme_constraints.py` is measured alongside because it is the module the
    row has always been about (M-16). Its caller count follows `wiring`'s and
    `audit_register`'s convention: a file does not become wired by being
    audited, so auditors are excluded from the list, and tests are counted
    separately -- `wiring`'s question is whether a NON-TEST caller exists.
    """
    out, _ = _sh(["lyric_harness.py", "wiring"])
    if "STRANDED  none" in out:
        n, tail = 0, "every production module is imported or has a `__main__`"
    else:
        m = _grab(r"stranded total: ([\d,]+) lines", out, "the stranded total")
        n = len(re.findall(r"^  STRANDED  ", out, re.M))
        tail = "%s stranded lines" % m.group(1)
    runners = _grab(r"one-shot runners, standalone by design \(`__main__`\): "
                    r"(\d+)", out, "the runner count").group(1)

    rc = os.path.join(HERE, "rhyme_constraints.py")
    rc_lines = len(open(rc, encoding="utf-8").read().splitlines())
    nontest, tests = [], []
    for dp, dns, fns in os.walk(ROOT):
        dns[:] = [d for d in dns if d not in {".git", "__pycache__"}]
        for f in sorted(fns):
            if not f.endswith(".py") or f in ("rhyme_constraints.py",
                                              "audit_register.py",
                                              "counters.py"):
                continue
            p = os.path.join(dp, f)
            if re.search(r"\brhyme_constraints\b",
                         open(p, encoding="utf-8", errors="replace").read()):
                (tests if f.startswith("test_") else nontest).append(f)
    cell = ("**%d** — %s; `rhyme_constraints.py` is %s lines with a `__main__` "
            "and %d non-test caller%s (%s), so it is kept on an argument and "
            "the DECISION is still owed (M-16)"
            % (n, tail, "{:,}".format(rc_lines), len(nontest),
               "" if len(nontest) == 1 else "s",
               ", ".join("`%s`" % c for c in nontest) or "none"))
    return Answered(cell, "%s one-shot runners have a `__main__`; "
                          "rhyme_constraints test callers: %s"
                    % (runners, ", ".join(tests) or "none"))


def mutations_declared():
    """How many mutations the adversary declares, and how many are excused.

    DERIVATION. `python3 quality/mutate.py --dry-run` applies every declared
    mutation to a shadow tree and prints `N/M mutations apply cleanly`; M is the
    declared count and it is checked, not assumed, because a mutation whose
    anchor has drifted out of the source is declared and INERT. The allowlist
    comes from `quality.test_mutation.ALLOWLIST`, imported directly -- `wiring`
    never treats a `test_*` module as an orphan, so that import hides nothing.

    CAUGHT is a separate counter below, because it is not free, and a number
    that costs money to check is exactly the number that gets copied forward
    instead of re-derived.
    """
    from quality.test_mutation import ALLOWLIST
    out, _ = _sh(["quality/mutate.py", "--dry-run"])
    m = _grab(r"(\d+)/(\d+) mutations apply cleanly", out,
              "the declared mutation count")
    applied, n = int(m.group(1)), int(m.group(2))
    if applied != n:
        raise ValueError("%d of %d mutations no longer apply; a mutation that "
                         "does not apply is declared and inert" % (applied, n))
    a = len(ALLOWLIST)
    cell = ("**%d declared, %d allowlisted equivalent** (%s — and the "
            "allowlist entry's PREMISE is itself under test)"
            % (n, a, ", ".join(sorted(ALLOWLIST))))
    return Answered(cell, "all %d apply cleanly to the current source" % n)


def mutations_caught():
    """How many of the declared mutations the suite actually kills.

    DERIVATION. `python3 quality/test_mutation.py` runs the sweep and prints
    `N of M mutations caught`. It forks the test suite once per mutation, so it
    is REFUSED on the cheap path and reachable with `--slow`. Refusing is the
    point: the alternative is printing the last value a human typed, and a
    number nobody re-derives is doctrine 58 with a nicer font.
    """
    out, _ = _sh(["quality/test_mutation.py"], timeout=3000)
    m = _grab(r"(\d+) of (\d+) mutations caught", out, "the caught count")
    caught, total = int(m.group(1)), int(m.group(2))
    surv = re.search(r"SURVIVED and not allowlisted: (.+)", out)
    return Answered("%d of %d caught" % (caught, total),
                    "unallowlisted survivors: %s"
                    % (surv.group(1) if surv else "none"))


def corpus_song_files():
    """Files staged under corpus/song/.

    DERIVATION. `len(os.listdir("corpus/song"))`. VOLATILE: a corpus cell adds
    and deletes files here while this runs, so the measurement is printed and
    NEVER written into the table. Freezing it is how `258` got into the record.
    """
    d = os.path.join(ROOT, "corpus", "song")
    return Answered("%d files" % len(os.listdir(d)),
                    "counted in %s at run time" % d)


def english_corpus():
    """MISSING.md K-1's own quantities: English songs, sung lines, repeat blocks.

    DERIVATION. `python3 quality/audit_register.py --slow` derivations D1, D2
    and D3, which are the repo's existing instrument for these and STATE THEIR
    RULE: a song is a `--- TITLE:` line; a SUNG LINE is a non-blank line that
    does not begin `#`, `---` or `[`; a repeat block is a `[TAG` line with any
    trailing index stripped. This reads that runner's output rather than
    re-deriving, so K-1 and the register audit cannot disagree.

    WHY THIS COUNTER EXISTS AT ALL. K-1 recorded `154,346 sung lines` and that
    number reproduced under NO phrasing anybody tried -- five sweeps returned
    154,351 / 154,339 / 154,191 / 154,179 / 154,339 and none of them was it.
    The entry recorded a figure and not the RULE that produced it, which is
    doctrine 58 in its purest form: nobody could tell whether it had drifted or
    had never been re-derivable. VOLATILE, and for a reason the corpus proved
    on 2026-08-11: an attribution cell removed 819 lines that were staged twice
    (nine poems of the 1798 Lyrical Ballads under both Coleridge and Wordsworth,
    plus one hymn), and the corpus SHRANK. Any bound written `>=` because a
    corpus only grows is not a bound.
    """
    out, _ = _once("register", ["quality/audit_register.py", "--slow"])
    songs = int(_derivation(out, "D1"))
    lines = int(_derivation(out, "D2"))
    rb = _grab(r"BURDEN (\d+) REFRAIN (\d+) CHORUS (\d+) \(sum (\d+)\)",
               _derivation(out, "D3"), "the repeat-block breakdown")
    b, r, c, tot = (int(rb.group(i)) for i in (1, 2, 3, 4))
    if b + r + c != tot:
        raise ValueError("repeat blocks %d + %d + %d != %d" % (b, r, c, tot))
    nfiles = len(
        [f for f in os.listdir(os.path.join(ROOT, "corpus", "song"))
         if f.startswith("eng_") and f.endswith(".txt")])
    cell = ("%d files, %s songs, %s sung lines; %s repeat blocks "
            "(%s BURDEN / %s REFRAIN / %s CHORUS)"
            % (nfiles, "{:,}".format(songs), "{:,}".format(lines),
               "{:,}".format(tot), "{:,}".format(b),
               "{:,}".format(r), "{:,}".format(c)))
    return Answered(cell,
                    "rule: a song is a `--- TITLE:` line; a sung line is "
                    "non-blank and does not begin `#`, `---` or `[`; a repeat "
                    "block is a `[TAG` line with its trailing index stripped")


def _tsv_rows(rel):
    """Data rows in a TSV, header excluded, read with the csv module.

    Read as CSV rather than counted with `wc -l` on purpose: a quoted field
    holding a newline would make the two disagree, and a row count that depends
    on which tool you used is doctrine 91 waiting to happen. The two are
    compared and the comparison is reported.
    """
    p = os.path.join(ROOT, rel)
    with open(p, encoding="utf-8", newline="") as fh:
        rows = list(csv.reader(fh, delimiter="\t"))
    physical = sum(1 for _ in open(p, encoding="utf-8"))
    n = len(rows) - 1
    note = ("%d data rows + 1 header; physical lines %d%s"
            % (n, physical,
               "" if physical == len(rows) else " — a field spans a newline"))
    return Answered("%d rows" % n, note)


def sources_rows():
    """Rows in data/sources.tsv. VOLATILE — a corpus cell is writing it now."""
    return _tsv_rows("data/sources.tsv")


def lyricists_rows():
    """Rows in data/lyricists.tsv. VOLATILE — a corpus cell is writing it now."""
    return _tsv_rows("data/lyricists.tsv")


def battery():
    """The sonnet oracle, as three counts and a rate.

    DERIVATION. `python3 battery.py` prints
    `mandated pairs 1064, judged 1014, refused 50` and
    `violations N (N% of JUDGED pairs)`; this parses those two lines. N was 81
    at scalar coda_agreement and is 82 as of cell BA's identity-coda fix
    (2026-08-11) -- the illustration above is deliberately the LIVE value
    rather than a frozen digit, so quoting a number here would itself be the
    stale-pin defect this file exists to end. CLAUDE.md already says this
    number is MEASURED, not recalled, and names the same command -- so the
    counter reads the same output a human would.

    The three counts stay three counts (doctrine 79). 50 of the 1,064 mandated
    pairs are REFUSALS, end words absent from CMUdict, and dividing by the
    mandated total charges an ingestion miss to the comparator.
    """
    out, _ = _sh(["battery.py"])
    a = _grab(r"mandated pairs (\d+), judged (\d+), refused (\d+)", out,
              "the three battery counts")
    b = _grab(r"violations (\d+) \(([\d.]+)% of JUDGED pairs\)", out,
              "the violation count")
    mand, judged, ref = (int(a.group(i)) for i in (1, 2, 3))
    viol, rate = int(b.group(1)), b.group(2)
    if judged + ref != mand:
        raise ValueError("judged %d + refused %d != mandated %d"
                         % (judged, ref, mand))
    cell = ("%d/%d = %s%% violations (`mandated %d, judged %d, refused %d`)"
            % (viol, judged, rate, mand, judged, ref))
    return Answered(cell, "judged + refused = mandated, so no refusal is in "
                          "the numerator")


def band_fpr():
    """The conjunctive band's false-positive rate on random CMUdict pairs.

    DERIVATION. `python3 quality/redteam_band.py [n]` draws n pairs at the
    fixed seed 20260810 and prints
    `ADMITTED AS RHYME WHERE IDENTITY SAYS OTHERWISE: k of n (r%)`, against a
    reference line of STRICT IDENTITY of the tail-aligned nucleus and coda --
    declared as a REFERENCE, not as truth.

    MEASURED AT TWO n, deliberately. The committed row read `3.57% (107/3,000
    at seed 20260810)`, which is real and does not reproduce from the runner's
    own default: `redteam_band.py` defaults to n=4,000 and prints 3.60%. The
    seed was written down and the POPULATION SIZE was not, which is doctrine 58
    (a recorded count is a threshold nobody wrote down) sharpened by doctrine 91
    (a count is a coordinate of the rendering, not only of the threshold). Both
    are re-derived here so neither can be quoted without the other.
    """
    vals = []
    for n in (4000, 3000):
        out, _ = _sh(["quality/redteam_band.py", str(n)])
        m = _grab(r"ADMITTED AS RHYME WHERE IDENTITY SAYS OTHERWISE: "
                  r"([\d,]+) of ([\d,]+) \(([\d.]+)%\)", out,
                  "the FPR at n=%d" % n)
        drawn = _grab(r"pairs drawn (\d+)\s+judged (\d+)", out,
                      "the draw counts at n=%d" % n)
        vals.append((_int(m.group(1)), _int(m.group(2)), m.group(3),
                     int(drawn.group(2))))
    (k4, n4, r4, j4), (k3, n3, r3, _) = vals
    cell = ("**%s%%** (%d of %s at seed 20260810, the runner's own default n; "
            "%s%% = %d of %s at n=3,000 — the population size is a coordinate)"
            % (r4, k4, "{:,}".format(n4), r3, k3, "{:,}".format(n3)))
    return Answered(cell, "n=4,000: %d judged, 0 refused by CMUdict" % j4)


def register_findings():
    """What the record adversary still finds wrong with the record.

    DERIVATION. `python3 quality/audit_register.py --slow` prints
    `consistency failures + FALSE derivations: N` as its last line and marks
    each derivation CONFIRMED / MOVED / FALSE / UNVERIFIABLE / SKIPPED. This
    parses that line and names which derivations carry the FALSE verdict, so
    the number is never quotable without the entries behind it.

    `--slow` on purpose: without it D24 and D25 come back SKIPPED, and a
    finding count taken over a run that declined to make two of its checks is
    a different quantity from one taken over all of them. Same run, one
    process, shared with the two counters above.
    """
    out, rc = _once("register", ["quality/audit_register.py", "--slow"])
    m = _grab(r"consistency failures \+ FALSE derivations: (\d+)", out,
              "the register-audit finding count")
    n = int(m.group(1))
    false = re.findall(r"^  FALSE\s+(\S+)\s+(\S+)", out, re.M)
    ids = ", ".join("%s (%s)" % (i, e) for i, e in false) or "none"
    cell = ("**%d** — %s; both are the deliberate M-4 calibration pair"
            % (n, ids)) if n == 2 and len(false) == 2 else \
           ("**%d** — FALSE derivations: %s" % (n, ids))
    return Answered(cell, "audit_register exit code %d" % rc)


def adversaries_built():
    """How many of the EIGHT adversaries are BUILT.

    The denominator was `7` in this row's key, in §0's prose ("adversaries 1-7
    all attack the WORK") and nowhere else -- while §0's own table has carried
    EIGHT rows since the eighth was added. One roster, two denominators, in one
    file. Corrected 2026-08-11 by the entry-claims cell; `python3
    quality/verify_entries.py` now checks the INSTRUMENT column of that table
    (`quality/audit_corpus.py` and `quality/audit_spans.py` either exist or they
    do not), which is the checkable half of a row whose STATUS column this
    counter still refuses.

    DERIVATION: THERE IS NONE, and that is the finding. §0's table assigns each
    adversary one of `built` / `partial` / `ad hoc` / `missing`, and those are
    editorial verdicts a person sets after looking at an instrument and judging
    whether it covers its target. Adversary 3 is `partial` because
    `redteam_band.py` attacks the band only; adversary 5 is `ad hoc` because
    doctrines 50/52/53 were each found by hand. No file states either fact in a
    form a program can read, and inventing a rule here ("has a `__main__`",
    "has a RESULTS_ file") would be a threshold nobody wrote down (doctrine 58)
    dressed as a measurement.

    So it REFUSES. Doctrine 28: "none" and "cannot tell" are different values,
    and the header of §0 says four-to-six of seven, which is itself the shape of
    a judgement rather than a count.
    """
    return Refused(JUDGEMENT,
                   "`built` / `partial` / `ad hoc` / `missing` in §0 are "
                   "statuses a person sets; no measurement distinguishes them "
                   "(the INSTRUMENT column is checkable and "
                   "`quality/verify_entries.py` checks it)",
                   "read §0 and decide; do not let this file guess")


COUNTERS = [
    Counter("MISSING entries by status", "python3 quality/counters.py",
            missing_entries),
    Counter("doctrines", "python3 quality/verify_doctrines.py", doctrines),
    Counter("stranded modules", "python3 lyric_harness.py wiring", stranded),
    Counter("mutations declared", "python3 quality/counters.py",
            mutations_declared),
    Counter("mutations caught", "python3 quality/test_mutation.py",
            mutations_caught, slow=True),
    Counter("`corpus/song/` files", "python3 quality/counters.py",
            corpus_song_files, volatile=True),
    Counter("`corpus/song/eng_*` — K-1's own quantities",
            "python3 quality/counters.py", english_corpus, volatile=True),
    Counter("`data/sources.tsv` rows", "python3 quality/counters.py",
            sources_rows, volatile=True),
    Counter("`data/lyricists.tsv` rows", "python3 quality/counters.py",
            lyricists_rows, volatile=True),
    Counter("sonnet battery", "python3 battery.py", battery),
    Counter("band FPR on random pairs", "python3 quality/redteam_band.py",
            band_fpr),
    Counter("register-audit findings", "python3 quality/audit_register.py",
            register_findings),
    Counter("adversaries built, of 8", "read BACKLOG.md §0", adversaries_built),
]


# ---------------------------------------------------------------------------
# The table: read, render, compare
# ---------------------------------------------------------------------------


def measure(slow=False):
    return [(c, c.measure(slow=slow)) for c in COUNTERS]


def committed_cell(counter, result):
    """-> what belongs in BACKLOG.md for this counter, which is NOT always the
    measurement.

    Three cases, and getting them wrong is how a check cries wolf:

      volatile -> the runtime marker, never a number. There is nothing to go
                  stale because nothing is recorded.
      slow     -> ALWAYS the cheap-path refusal, even on a `--slow` run. If a
                  `--slow` run wrote `32 of 33 caught` into the table, the next
                  ordinary `--check` would call the table stale for saying
                  exactly what it should say. The recorded table describes the
                  DEFAULT path; `--slow` reports its extra measurement to
                  stdout and does not touch the file.
      otherwise-> the measurement.
    """
    if counter.volatile:
        return RUNTIME_CELL
    if counter.slow:
        return Refused(COST, "not measured on the cheap path",
                       "python3 quality/counters.py --slow").cell
    return result.cell


def render(results):
    """-> the markdown table, exactly as it belongs in BACKLOG.md."""
    rows = ["| counter | measured | measured by |", "|---|---|---|"]
    for c, r in results:
        rows.append("| %s | %s | `%s` |"
                    % (c.key, committed_cell(c, r), c.command))
    return "\n".join(rows)


def read_table():
    """-> {key: (value_cell, command_cell)} from the committed BACKLOG.md."""
    text = open(BACKLOG, encoding="utf-8").read()
    if OPEN_MARK not in text or CLOSE_MARK not in text:
        raise ValueError("BACKLOG.md carries no %s ... %s markers; the "
                         "counters table is not machine-locatable"
                         % (OPEN_MARK, CLOSE_MARK))
    body = text.split(OPEN_MARK, 1)[1].split(CLOSE_MARK, 1)[0]
    out = {}
    for ln in body.split("\n"):
        ln = ln.strip()
        if not ln.startswith("|") or set(ln) <= set("|- "):
            continue
        cells = [c.strip() for c in ln.strip("|").split("|")]
        if len(cells) < 2 or cells[0] == "counter":
            continue
        out[cells[0]] = (cells[1], cells[2] if len(cells) > 2 else "")
    return out


def write_table(results):
    text = open(BACKLOG, encoding="utf-8").read()
    if OPEN_MARK not in text:
        raise ValueError("BACKLOG.md carries no %s marker" % OPEN_MARK)
    head, rest = text.split(OPEN_MARK, 1)
    _, tail = rest.split(CLOSE_MARK, 1)
    new = "%s%s\n%s\n%s%s" % (head, OPEN_MARK, render(results),
                              CLOSE_MARK, tail)
    open(BACKLOG, "w", encoding="utf-8").write(new)
    return new


def check(results):
    """-> (stale, unchecked). FAILS LOUDLY; it does not report and continue.

    A volatile counter's committed cell must be the runtime marker and must
    NOT be a number: the whole point is that there is nothing there to go
    stale. A refused counter's committed cell must be its refusal, so that a
    session reading BACKLOG.md sees "cannot tell" rather than a value.
    """
    committed = read_table()
    stale, unchecked = [], []
    for c, r in results:
        want = committed_cell(c, r)
        got = committed.get(c.key)
        if got is None:
            stale.append((c.key, "(absent from the table)", want))
            continue
        if c.slow:
            unchecked.append("%s%s" % (c.key, "" if r.refused
                                       else " — measured %s, and the table "
                                            "deliberately does not record it"
                                            % r.cell))
        if got[0] != want:
            stale.append((c.key, got[0], want))
    for key in committed:
        if key not in {c.key for c, _ in results}:
            stale.append((key, "(row in the table, no counter measures it)",
                          "—"))
    return stale, unchecked


# ---------------------------------------------------------------------------


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--check", action="store_true",
                    help="FAIL if BACKLOG.md's committed table is stale")
    ap.add_argument("--write", action="store_true",
                    help="rewrite BACKLOG.md's counters table in place")
    ap.add_argument("--slow", action="store_true",
                    help="also pay for the counters that cost")
    a = ap.parse_args(argv)

    results = measure(slow=a.slow)

    print("=" * 78)
    print("COUNTERS — measured %s" % ("with --slow" if a.slow
                                      else "on the cheap path"))
    print("=" * 78)
    asked = answered = refused = 0
    for c, r in results:
        asked += 1
        mark = "VOLATILE" if c.volatile else ("REFUSED" if r.refused else "ok")
        print("  [%-8s] %s" % (mark, c.key))
        print("      %s" % (r.cell if not c.volatile
                            else "%s   (not written to the table)" % r.cell))
        if r.evidence:
            print("      %s" % r.evidence)
        if r.refused:
            refused += 1
            if r.remedy:
                print("      remedy: %s" % r.remedy)
        else:
            answered += 1
        print("      derived by: %s" % c.command)

    # Doctrine 79: three counts, never a rate over the wrong denominator.
    print()
    print("  asked %d, answered %d, refused %d  "
          "(refusals by kind: %s)"
          % (asked, answered, refused,
             ", ".join("%s %d" % (k, v) for k, v in sorted(
                 collections.Counter(r.kind for _, r in results
                                     if r.refused).items())) or "none"))

    if a.write:
        write_table(results)
        print("\nBACKLOG.md's counters table rewritten between the %s markers."
              % OPEN_MARK)
        return 0

    if not a.check:
        print("\nThe table as it should read:\n")
        print(render(results))
        return 0

    stale, unchecked = check(results)
    print()
    print("=" * 78)
    print("CHECK — BACKLOG.md's committed counters table against the "
          "measurement")
    print("=" * 78)
    if unchecked:
        print("  [not checked] %s — refused for COST on this run; "
              "re-run with --slow" % ", ".join(unchecked))
    if not stale:
        print("  [ok  ] every committed counter equals its measurement")
        print("\nRESULT: PASS")
        return 0
    for key, got, want in stale:
        print("  [FAIL] %s" % key)
        print("         committed: %s" % got)
        print("         measured : %s" % want)
    print("\n%d counter(s) in BACKLOG.md are STALE. Fix them with\n"
          "    python3 quality/counters.py --write\n"
          "and do NOT retype them by hand — that is the defect this file "
          "exists to end (doctrine 48)." % len(stale))
    print("\nRESULT: FAIL")
    return 1


if __name__ == "__main__":
    sys.exit(main())
