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

AND THERE IS A THIRD KIND, WHICH IS NOT A KIND OF REFUSAL AT ALL. The two above
are ANSWERS: a counter looked at the question and said "no measurement exists"
or "this run declined to pay". `Counter.measure`'s `except` arm produces a third
object that wears the same class -- a traceback rendered as `REFUSED (cost) —
the instrument did not answer: ValueError: ...`. That is not a verdict, it is a
CRASH, and until 2026-08-14 it was written into BACKLOG.md as though it were
one. `Refused.broken` types it, and the whole of `--write`'s and `--check`'s
new behaviour rests on that one flag. See WHAT `--write` MAY NOT WRITE below.

WHAT `--write` MAY NOT WRITE, AND WHY THE REMEDY HAD A HOLE IN IT.
Found 2026-08-14 by an adversary pointed at the REMEDY rather than at the
check, and measured end to end in a `mutate.build_shadow` tree.

`quality/mutate.py` declares 57 mutations, each anchored on an EXACT text match
in a source file. A sibling lot's refactor moves the code, the anchor stops
matching, `mutations_declared()` raises, and `Counter.measure` turns the raise
into `Refused(COST, ...)`. `--check` goes correctly RED. But `--check`'s own
printed remedy for a moved value is `python3 quality/counters.py --write`, and
`--write` wrote the refusal INTO the table and exited 0 -- after which `--check`
read REFUSED against REFUSED and printed PASS, permanently, with two mutations
declared and inert and nothing anywhere still asking. Measured on a shadow tree
with M1 and QS3 both drifted: `--check` 1, `--write` 0, `--check` 0, while
`quality/mutate.py --dry-run` stayed at 55/57 and exit 1 throughout.

THAT PATH IS THE ORDINARY ONE. The `public symbols` row moves whenever any lot
adds a public `def`, `--write` is that row's correct remedy, and a lot clearing
it would have laundered a drifted anchor in the same keystroke. It nearly did:
`quality/mutate.py`'s own `--dry-run` comment records the 2026-08-13 QS3
near-miss, where a `--write` run is what HAPPENED to expose the drift.

THE PREDICATE, and it is not `volatile`, not `slow`, and not `kind`.
`committed_cell` already special-cases the first two and the obvious patch was
"any non-`slow` refusal is unwritable". MEASURED, that patch turns a healthy
tree permanently red: `adversaries built, of 8` refuses for JUDGEMENT on every
run by design, is neither volatile nor slow, and its refusal is exactly what
belongs in its cell -- so the patch produces a FAIL whose stated remedy is
"REPAIR IT" against a counter that has nothing wrong with it, and no `--write`
can ever clear it. A permanently red check is a muted one, which is the reason
`Counter.restated` is reported and not asserted three paragraphs up.

`kind` cannot separate them either, and that is the sharper half: COST holds
BOTH the declared cheap-path thrift (`mutations caught`, legitimate) and the
caught exception (`mutations declared`, broken). Two enum members, three
answers -- doctrine 28's own shape one level in.

What separates them is the PROVENANCE of the refusal, so it is marked where it
is made rather than inferred afterwards:

  DECLARED   the counter RETURNED a `Refused`. `adversaries_built` returns one
             because no measurement exists; `mutations_caught` returns one on
             the cheap path and another on `TimeoutExpired`, both anticipated
             and both carrying a reason its author wrote in advance. A working
             instrument answering "cannot tell" IS the measurement, and it
             stays writable.
  BROKEN     `Counter.measure` MANUFACTURED a `Refused` out of an exception the
             counter did not anticipate. The instrument did not answer. There
             is nothing to record, and `--write` records nothing: the row is
             left byte-identical to what it already said, `--write` exits 1
             naming the counter, and `--check` reports the counter BROKEN
             regardless of what the cell holds -- so no sequence of writes can
             turn that row green. Only repairing the counter can.

SO `slow` IS NOT THE CARVE-OUT, IN EITHER DIRECTION. A `slow` counter's
committed cell is a CONSTANT (`committed_cell`, below): it is the cheap-path
refusal on every run, `--slow` or not, so nothing measured can ever be
laundered into it and it needs no protection. And a `slow` counter whose
instrument CRASHES under `--slow` is a broken instrument like any other and is
reported like any other. Once the predicate is provenance, no carve-out is
needed at all -- which is the argument that it is the right one.

WHY THE ROW IS KEPT RATHER THAN THE WHOLE WRITE REFUSED. Refusing to write
anything would hold every OTHER row hostage to one broken counter, and the
`public symbols` row moves hourly under sibling lots. A remedy withdrawn from
the rows that legitimately have one is a remedy people route around by
retyping, which is the defect this file exists to end (doctrine 48). The
refusal is scoped to the finding: every healthy row is refreshed, the broken
row is untouched, and the exit code says so.

WHAT `--check` GUARANTEES, AND EXACTLY HOW WIDE THAT IS. `MISSING.md` leans on
this command: "`--check` FAILS if BACKLOG.md's counters table disagrees with the
measurement, so this figure cannot go stale again without a red test." On
2026-08-13 an adversary was pointed at the checker itself, asking only whether
it could report FRESH something that was STALE. It could, four ways, and all
four are closed in `read_table()` and `check()` below with the argument beside
each: a DUPLICATED ROW hid behind its twin because the parser was a dict; the
`measured by` column -- the REPRODUCTION INSTRUCTION, which is the half of a row
a human re-derives from -- was read and never compared; a FOURTH CELL was
dropped; and a VOLATILE counter whose instrument had died still passed, labelled
as a deliberate absence rather than a dead instrument.

The fifth could not be closed here, and it is the one that bounds the sentence
above: `--check` reads the TABLE, not the FILE. A counter's quantity written
into BACKLOG.md PROSE is not a row and is not checked -- and BACKLOG.md's own
preamble says "the live values are in the table and are deliberately not
repeated here, because a number restated in prose beside its own counter is the
next thing to drift", then restates two of them four paragraphs later, one of
which (the mutation count) had drifted to `33 declared` against a measured 57.
`Counter.restated` REPORTS the known restatements next to the measurement and
does not set the exit code, because rewriting a sentence is a BACKLOG.md
owner's job that `--write` cannot do. It worked: that sentence was rewritten
2026-08-13 into a dated COVERAGE statement, and this pattern was re-anchored to
the new shape in the same edit rather than left matching nothing -- see the
comment beside the `mutations declared` counter for why a silently unmatching
pattern is the worse failure. So the guarantee is: no number BETWEEN THE
MARKERS can go stale without a red test. Prose beside the table can, and does.

WHAT THIS FILE DOES NOT DO. It does not re-implement any instrument it reports.
The doctrine run comes from `verify_doctrines.definitions()`; the stranded count
from `lyric_harness.py wiring`; the battery from `battery.py`; the false-positive
rate from `quality/redteam_band.py`; the register findings from
`quality/audit_register.py`. Where an instrument prints rather than returns, this
parses its printed line of record -- deliberately, because that is the line a
human sees when they run the documented command, and a counter that agreed with
the code while disagreeing with the output would be the worse defect. If the
parse fails, the counter REFUSES; it never falls back to a remembered value.

THE ONE EXCEPTION, AND IT IS A FINDING RATHER THAN A LICENCE.
`public_symbols()` carries its own AST sweep, because there is no instrument to
call: `wiring` answers "does anything IMPORT or RUN this FILE", and nothing in
this repository has ever asked the same question one level down, of a SYMBOL.
That gap is the whole reason the counter exists -- `STRANDED none` is a true
answer to a question whose granularity this repo's own history has already
proved is too coarse -- so the sweep is written here rather than the number
being copied from a runner that does not exist. If `wiring` ever grows the
symbol-granularity verdict, this counter should parse ITS output and delete the
sweep, exactly the way `doctrines()` calls `verify_doctrines` instead of
carrying a second parser.
"""

import argparse
import ast
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

#: The header row `render()` writes. Named rather than inlined because `check`
#: also looks for it OUTSIDE the marker block: a second table in this shape is
#: a second record of the same quantities, and only the one between the markers
#: is ever read. The table this file replaced was headed
#: `## Counters, so drift is visible`, so a leftover copy of it is exactly the
#: artefact to expect.
TABLE_HEADER = "| counter | measured | measured by |"

#: What the table says instead of a number for a quantity that is moving.
RUNTIME_CELL = ("MEASURED AT RUNTIME — `python3 quality/counters.py`")

#: The cell a BROKEN counter gets when there is NO committed row to keep -- a
#: counter added in the same edit that broke it, or a row deleted by hand.
#: Reached only in that case: an existing row is preserved verbatim instead
#: (`committed_cell`). It is deliberately not a measurement and not a refusal
#: shape, so nothing reads it as either, and it cannot launder anything because
#: `check()` reports a broken counter on the flag and never on the cell.
BROKEN_CELL = "NOT MEASURED — the instrument is broken; repair the counter"

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
    broken = False


class Refused:
    """A counter's answer of "cannot tell", or the wreckage of one.

    `broken` is the difference and it is set at the SITE, never inferred later.
    A counter that RETURNS a `Refused` has answered: it looked at the question,
    found no measurement (JUDGEMENT) or declined to pay for one (COST), and
    wrote the reason in advance. `Counter.measure`'s `except` arm CONSTRUCTS one
    out of a traceback instead, and that is not an answer -- it is the absence
    of the instrument. Only the second kind is `broken`, and only the second
    kind is barred from the committed table. The module header states why no
    property of the COUNTER (`volatile`, `slow`) and no value of `kind`
    separates these two, and what each of those predicates gets wrong.
    """

    def __init__(self, kind, reason, remedy="", broken=False):
        self.kind = kind
        self.reason = reason
        self.remedy = remedy
        self.broken = broken
        self.evidence = reason
        self.cell = "REFUSED (%s) — %s" % (kind.lower(), reason)

    refused = True


class Counter:
    """One row. `fn` returns `Answered` or `Refused`, or raises.

    `volatile` marks a quantity that other cells are changing WHILE this runs.
    Its committed cell is the runtime marker and never a number, so there is
    nothing for a later session to find stale.

    `restated` is a regex for the shape in which THIS counter's quantity is
    known to be written out in BACKLOG.md PROSE, outside the marker block.
    `--check` reads the table and nothing else, so a figure quoted in a
    sentence beside the table is outside its reach entirely -- which is not a
    hypothetical: BACKLOG.md's own preamble says "the live values are in the
    table and are deliberately not repeated here, because a number restated in
    prose beside its own counter is the next thing to drift", and then restates
    two of them four paragraphs later. Matches are REPORTED and never asserted,
    for the reason `quality/test_mutation.py` states about its own blind-spot
    block: a failure another cell alone can clear makes this check permanently
    red, and a permanently red check is a muted one. The blind spot is that a
    reworded sentence stops matching and the report goes quiet; that is stated
    here rather than papered over with a looser pattern.
    """

    def __init__(self, key, command, fn, volatile=False, slow=False,
                 restated=None):
        self.key = key
        self.command = command
        self.fn = fn
        self.volatile = volatile
        self.slow = slow
        self.restated = restated

    def measure(self, slow=False):
        if self.slow and not slow:
            return Refused(COST, "not measured on the cheap path",
                           "python3 quality/counters.py --slow")
        try:
            return self.fn()
        except Exception as e:                                   # noqa: BLE001
            # `broken=True` is the whole of the anti-laundering fix and it is
            # set HERE because here is the only place that knows the counter
            # did not answer. Everything downstream reads the flag rather than
            # re-deriving it from the counter's other properties, which is what
            # the header argues no downstream predicate can do correctly.
            return Refused(COST, "the instrument did not answer: %s: %s"
                           % (type(e).__name__, e), self.command,
                           broken=True)


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


#: Directories that hold no source anybody wrote. Walked past, not read.
SYMBOL_SKIP_DIRS = ("__pycache__", ".git", ".mypy_cache", ".pytest_cache")

#: The five answers `symbol_reach()` gives, and they are five and not two.
#: PRODUCTION / TESTS / OWN / NOWHERE are verdicts; REFUSED is the absence of
#: one (doctrine 28), and the three reasons a symbol earns it are below.
SYMBOL_VERDICTS = ("PRODUCTION", "TESTS", "OWN", "NOWHERE", "REFUSED")


def _dotted(root, path):
    """-> the module name a file would be imported under, `__init__` folded."""
    rel = os.path.relpath(path, root)[:-3].replace(os.sep, ".")
    return rel[:-len(".__init__")] if rel.endswith(".__init__") else rel


def _attr_chain(node):
    """-> ['quality', 'grid', 'song_from_blueprint'] for that attribute
    expression, or None if the chain does not bottom out in a plain name."""
    parts = []
    while isinstance(node, ast.Attribute):
        parts.append(node.attr)
        node = node.value
    if not isinstance(node, ast.Name):
        return None
    parts.append(node.id)
    parts.reverse()
    return parts


class _Unit:
    """One .py file, read ONCE, as the six facts the sweep needs from it.

    Everything here is an AST fact, never a text match. That choice is what
    keeps a symbol named `weight` or `scan` from being declared "referenced"
    by the word appearing in a docstring or a comment three modules away --
    a comment is not a caller, and a text sweep cannot tell the difference.
    """

    def __init__(self, root, path):
        self.rel = os.path.relpath(path, root)
        self.mod = _dotted(root, path)
        self.is_test = os.path.basename(path).startswith("test_")
        head = self.rel.split(os.sep)[0]
        self.in_scope = (head == self.rel) or head == "quality"
        try:
            tree = ast.parse(open(path, encoding="utf-8",
                                  errors="replace").read(), filename=path)
        except SyntaxError as e:
            raise ValueError("%s does not parse (%s); this counter reads the "
                             "repo's own source and cannot measure a tree it "
                             "cannot build" % (self.rel, e))
        self.defs = {}          # public top-level name -> "def" | "class"
        self.span = {}          # that name -> (first line, line count)
        self.exported = None    # __all__, if the module declares one
        self.methods = 0        # public methods on those classes: OUT OF SCOPE
        self.self_used = set()  # public names used ELSEWHERE IN THIS FILE
        self.imports = set()    # every module name this file imports
        self.alias = {}         # local binding -> the module(s) it can name
        self.direct = set()     # (module, name) pulled in by `from M import n`
        self.star = set()       # modules pulled in by `from M import *`
        self.names = set()      # every bare identifier read or written
        self.binds = set()      # every identifier this file BINDS itself
        self.strings = set()    # every string constant, for the dynamic reach
        self.chains = []        # every attribute expression, as parts
        self._read_surface(tree)
        self._read_body(tree)

    def _read_surface(self, tree):
        """Top-level defs and classes, `__all__`, and the intra-module question.

        The intra-module question is asked HERE and not by a second walk: for
        each public top-level node, is its own name read by any OTHER
        top-level statement of the same file? That is what separates a CLI
        verb handler its own `main()` dispatches -- which runs on every
        invocation -- from a function nothing anywhere names. Its own body is
        excluded, so recursion does not count as use.
        """
        public = []
        for n in tree.body:
            if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef,
                              ast.ClassDef)):
                if n.name.startswith("_"):
                    continue
                self.defs[n.name] = ("class" if isinstance(n, ast.ClassDef)
                                     else "def")
                self.span[n.name] = (n.lineno,
                                     getattr(n, "end_lineno", n.lineno)
                                     - n.lineno + 1)
                public.append(n)
                if isinstance(n, ast.ClassDef):
                    self.methods += sum(
                        1 for b in n.body
                        if isinstance(b, (ast.FunctionDef,
                                          ast.AsyncFunctionDef))
                        and not b.name.startswith("_"))
            elif isinstance(n, ast.Assign):
                for t in n.targets:
                    if isinstance(t, ast.Name) and t.id == "__all__":
                        self.exported = [c.value
                                         for c in getattr(n.value, "elts", [])
                                         if isinstance(c, ast.Constant)
                                         and isinstance(c.value, str)]
        per = [(n, {x.id for x in ast.walk(n) if isinstance(x, ast.Name)})
               for n in tree.body]
        for node in public:
            if any(node.name in used for n, used in per if n is not node):
                self.self_used.add(node.name)

    def _read_body(self, tree):
        for n in ast.walk(tree):
            t = type(n)
            if t is ast.Import:
                for a in n.names:
                    self.imports.add(a.name)
                    if a.asname:
                        # ACCUMULATED, never overwritten. `relations.py` binds
                        # `CS` twice -- `from quality import canon_sources as
                        # CS`, and `import canon_sources as CS` in the
                        # ImportError arm -- and an assignment let the second
                        # erase the first, which lost every `CS.x` call in the
                        # file. A binding can name more than one module and
                        # both spellings have to stay reachable.
                        self.alias.setdefault(a.asname, set()).add(a.name)
            elif t is ast.ImportFrom:
                if n.level:                      # relative; not used here
                    continue
                base = n.module or ""
                self.imports.add(base)
                for a in n.names:
                    if a.name == "*":
                        self.star.add(base)
                        continue
                    self.direct.add((base, a.name))
                    self.imports.add(base + "." + a.name)
                    # `from quality import grid` binds a MODULE, not a symbol
                    self.alias.setdefault(a.asname or a.name,
                                          set()).add(base + "." + a.name)
            elif t is ast.Name:
                self.names.add(n.id)
                if type(n.ctx) is not ast.Load:
                    self.binds.add(n.id)
            elif t is ast.Attribute:
                c = _attr_chain(n)
                if c:
                    self.chains.append(c)
            elif t is ast.Constant and isinstance(n.value, str):
                self.strings.add(n.value)
            elif t in (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef):
                self.binds.add(n.name)
                args = getattr(n, "args", None)
                if args is not None:
                    for grp in (args.posonlyargs, args.args, args.kwonlyargs):
                        for x in grp:
                            self.binds.add(x.arg)
                    for x in (args.vararg, args.kwarg):
                        if x:
                            self.binds.add(x.arg)
            elif t is ast.ExceptHandler and n.name:
                self.binds.add(n.name)


def symbol_reach(root=None):
    """-> [(module, symbol, kind, lines, verdict, why), ...], sorted.

    THE SWEEP, exposed rather than inlined so a human can read the whole list
    instead of the ten the counter prints. `verify_doctrines.definitions()` is
    exposed for the same reason and this file calls it for the same reason.

    A REFERENCE to symbol `S` of module `M`, from some other file `F`, is one
    of four things, and only the first three are attributable on their own:

      DIRECT     `from M import S`. Names both ends. Unambiguous.
      QUALIFIED  an attribute chain whose longest resolvable prefix IS `M`
                 and whose next part is `S` -- `GR.song_from_blueprint`
                 after `from quality import grid as GR`, `quality.grid.X`
                 after `import quality.grid`. Unambiguous.
      STAR       `from M import *` and a bare `S` somewhere in `F`.
      BARE       `F` imports `M` in some form and reads a bare `S`. This is
                 attributable ONLY if nothing else could have produced that
                 identifier -- see the two refusals below.
    """
    root = root or ROOT
    paths = []
    for dp, dns, fns in os.walk(root):
        dns[:] = [d for d in dns if d not in SYMBOL_SKIP_DIRS]
        paths.extend(os.path.join(dp, f) for f in fns if f.endswith(".py"))
    units = [_Unit(root, p) for p in sorted(paths)]
    mods = {u.mod: u for u in units}

    #: A module imported under a name that is not its dotted path. Six sites
    #: in this repo import a sibling BARE (`import canon_sources`, `import
    #: mutate`, `import audit_spans`) inside an ImportError arm, so the
    #: written name never equals `quality.canon_sources` and a strict lookup
    #: silently loses every reference through it. Resolved by tail, and ONLY
    #: when the tail is unique -- two modules ending the same way make the
    #: import unattributable, and this returns nothing rather than pick.
    tails = collections.defaultdict(list)
    for m in mods:
        tails[m.rsplit(".", 1)[-1]].append(m)

    def resolve(name):
        if name in mods:
            return name
        hits = tails.get(name.rsplit(".", 1)[-1], ())
        return hits[0] if len(hits) == 1 and "." not in name else None

    for u in units:
        u.imports = {r for r in (resolve(m) for m in u.imports) if r}
        u.star = {r for r in (resolve(m) for m in u.star) if r}
        u.direct = {(resolve(b), n) for b, n in u.direct}
        u.alias = {k: {r for r in (resolve(m) for m in v) if r}
                   for k, v in u.alias.items()}
        qualified = set()
        for c in u.chains:
            for i in range(len(c) - 1, 0, -1):
                head = c[:i]
                cands = [".".join(head)]
                cands += [".".join([a] + head[1:])
                          for a in sorted(u.alias.get(head[0], ()))]
                hit = next((x for x in cands if x in mods), None)
                if hit:
                    qualified.add((hit, c[i]))
                    break
        u.qualified = qualified

    owners = collections.Counter()
    symbols = []
    for u in units:
        if u.is_test or not u.in_scope:
            continue
        declared = u.exported if u.exported is not None else sorted(u.defs)
        for s in declared:
            if s in u.defs:
                symbols.append((u.mod, s))
                owners[s] += 1

    rows = []
    for mod, s in symbols:
        home = mods[mod]
        ambiguous = owners[s] > 1
        prod_ref = prod_maybe = test_ref = test_maybe = string_reach = False
        why = set()
        for u in units:
            if u.mod == mod:
                continue
            hit = maybe = False
            if (mod, s) in u.direct or (mod, s) in u.qualified:
                hit = True
            elif mod in u.star and s in u.names:
                hit = True
            elif mod in u.imports and s in u.names:
                if ambiguous:
                    maybe, why = True, why | {"AMBIGUOUS"}
                elif s in u.binds:
                    maybe, why = True, why | {"SHADOWED"}
                else:
                    hit = True
            if not hit and not maybe and mod in u.imports and s in u.strings:
                string_reach = True
            if u.is_test:
                test_ref, test_maybe = test_ref or hit, test_maybe or maybe
            else:
                prod_ref, prod_maybe = prod_ref or hit, prod_maybe or maybe
        if prod_ref:
            verdict, reason = "PRODUCTION", ""
        elif prod_maybe:
            verdict, reason = "REFUSED", sorted(why)[0]
        elif string_reach:
            verdict, reason = "REFUSED", "DYNAMIC"
        elif test_ref:
            verdict, reason = "TESTS", ""
        elif test_maybe:
            verdict, reason = "REFUSED", sorted(why)[0]
        elif s in home.self_used:
            verdict, reason = "OWN", ""
        else:
            verdict, reason = "NOWHERE", ""
        rows.append((mod, s, home.defs[s], home.span[s][1], verdict, reason))
    rows.sort()
    return rows, units


def public_symbols():
    """Public symbols nothing outside their own module names — the
    FUNCTION-GRANULARITY question `wiring` does not ask.

    WHY THIS COUNTER EXISTS, AND IT IS NOT "more coverage".
    `python3 lyric_harness.py wiring` reports `STRANDED none`, and the
    counter above records it. That verdict is true and it answers "does
    anything IMPORT or RUN this FILE". This repo's own history proves that is
    the wrong question: `quality/grid.py` was imported the entire time the
    `song` verb raised `KeyError` on every real blueprint in the tree, and
    `wiring` called it wired throughout (CLAUDE.md, `song`'S OWN DEAD
    SCHEMA). IMPORT REACHABILITY IS NOT INVOCATION REACHABILITY. An
    execution-trace differential over five scenarios -- the CLI verb union,
    the API at defaults, the API with every opt-in declared, the test suite,
    and the one-shot runners -- found 181 functions that never execute, and
    every module holding one of them sits in a GOOD list of `wiring`'s
    output, several in its strongest tier. Nothing in this repo measured
    that, at any granularity below the file, which is why `STRANDED none` was
    a false all-clear rather than a wrong number.

    DERIVATION, AND IT IS STATIC. The trace is not re-run: it forks five
    scenarios over the whole suite, and a counter that costs a suite run is a
    counter CI drops. What is measured instead, in one AST pass over every
    .py file in the repo, is REFERENCE:

      THE UNIT is a public (no leading `_`) top-level `def` or `class` in a
      module under `quality/` or at the repo root, taken from `__all__` where
      the module declares one and from the module's own top level where it
      does not. Public METHODS on those classes are NOT counted -- see the
      last paragraph, because that omission is load-bearing.

      THE ANSWER is WHERE the symbol is named, never how often:
        PRODUCTION  named by a non-test module that is not its own.
        TESTS       named only by `test_*.py`.
        OWN         named nowhere outside its own module, but read by some
                    other top-level statement OF that module. A CLI verb
                    handler its own `main()` dispatches lands here, and it
                    runs on every invocation -- which is exactly why this is
                    a bucket of its own and not folded into the one below.
        NOWHERE     not named by anything, anywhere, including the file that
                    defines it. This is the sharp bucket.
        REFUSED     the analysis cannot tell. Three reasons, below.

    DOCTRINE 79, and it is the reason there is no total worth quoting: these
    are FIVE COUNTS and they are never summed into a "dead code" figure.
    PRODUCTION and TESTS answer different questions about the same symbol,
    OWN is not a defect at all, and adding a refusal to any of them charges
    the wrong layer. The five are asserted to reconcile with the symbol total
    -- a partition that does not partition is the one arithmetic error this
    counter could make on its own -- and that is the only sum taken.

    DOCTRINE 20, THE THREE REFUSALS. A guess here would be worse than a gap,
    because the guess is what "STRANDED none" already was:
      AMBIGUOUS  the same public name is defined at top level by more than
                 one module in scope (`main`, `Span`, `Placement`), so a bare
                 identifier in a file importing several of them cannot be
                 attributed to any one definition. A `from M import S` or an
                 `M.S` names both ends and is NOT ambiguous, so only the bare
                 form refuses; a name with NO reference anywhere refuses
                 nothing, because zero is zero for every definition of it.
      SHADOWED   the only evidence is a bare identifier in a file that BINDS
                 that same name itself -- `quality/grid.py` imports
                 `quality.schemes` AND assigns its own local `blocks`, so a
                 bare `blocks` there is not evidence of `schemes.blocks`.
      DYNAMIC    no identifier evidence at all, but a file that imports the
                 module holds that exact name as a STRING constant --
                 `rhyme_constraints.build` in `relations.py`. That is how
                 `getattr`, a dispatch table, or an argparse `dest` reaches a
                 symbol without ever spelling it as code, and it cannot be
                 told from a message that happens to read the same.

    WHAT THIS PROXY CAN SEE THAT THE TRACE CANNOT: every scenario at once and
    for free, in a couple of seconds, reproducibly, with no environment.

    WHAT IT CANNOT SEE, AND THIS IS NOT A CAVEAT, IT IS THE MEASUREMENT'S
    SHAPE -- REFERENCE IS NOT EXECUTION:
      * A symbol whose only caller is itself dead still counts PRODUCTION
        here. The trace follows the call graph; this counts one edge of it.
        `grid.song_from_blueprint` would have read PRODUCTION on the day the
        `song` verb could not reach it.
      * A dead METHOD on a live class is invisible: the class is referenced,
        so the class is referenced, and nothing below the top level is asked.
        The evidence line prints how many public methods that leaves
        unmeasured, so the size of the blind spot is on the record.
      * A branch that never runs is not a reference that never happened.
        Reachability under a flag nobody sets reads identical to reachability
        under the default.
      * The reverse error too: OWN and NOWHERE are claims about NAMING, not
        about running. A NOWHERE symbol may still be reached by a `getattr`
        this sweep refused, which is why the refusals are counted rather than
        resolved.
    So this UNDER-reports dead capability, deliberately and in the safe
    direction: it accuses only what nothing in the repository names.

    NOWHERE IS A QUEUE, NOT A VERDICT, and the cell says so on purpose. Every
    other row here reports a quantity the repo is not currently trying to
    change; this one reports a WORK ITEM, and the work is live -- several of
    the symbols in the bucket are under investigation by other cells as this
    is written, and each one closed moves the figure. The total moves for a
    second and independent reason: any lot that adds a public top-level `def`
    moves it, and two did between two runs twenty minutes apart on 2026-08-13
    (898 -> 900). So a `--check` FAIL on this row is the ordinary signal that
    the tree moved, cleared by `--write`; it is not evidence that anything
    regressed, and the cell must not be readable as "the repo contains N dead
    symbols" by a session that finds it six weeks from now. That is the same
    error as `corpus/song/ files | 258` -- a number true on the day it was
    written and read afterwards as a property -- except that this one cannot
    take the VOLATILE remedy, because deleting the number would delete the
    only check that notices a symbol falling out of reach.
    """
    rows, units = symbol_reach()
    by = collections.Counter(v for _, _, _, _, v, _ in rows)
    kinds = collections.Counter(r for _, _, _, _, v, r in rows
                                if v == "REFUSED")
    total = len(rows)
    parts = sum(by[v] for v in SYMBOL_VERDICTS)
    if parts != total:
        raise ValueError("the five buckets hold %d of %d symbols; a partition "
                         "that does not partition is not a measurement"
                         % (parts, total))
    if not total:
        raise ValueError("no public top-level symbols found under quality/ or "
                         "the root; the sweep read nothing and must be "
                         "repaired, not believed")
    methods = sum(u.methods for u in units if u.in_scope and not u.is_test)
    nowhere = sorted(((n, m, s, k) for m, s, k, n, v, _ in rows
                      if v == "NOWHERE"), reverse=True)
    cell = ("**%d** public top-level functions/classes under `quality/` and "
            "the root — **%d** named by another production module, **%d** by "
            "tests only, **%d** only inside their own module, **%d** by "
            "nothing anywhere, **%d** REFUSED (%s). Reference, NOT execution: "
            "a symbol whose only caller is itself dead still counts named. "
            "This row is a READING OF THE TREE AT RUN TIME and it moves: the "
            "NOWHERE bucket is a queue under active repair, not a settled "
            "property, and any lot adding a public `def` moves the total — so "
            "a FAIL here is that movement, cleared by `--write`, and the "
            "figures are quotable only with the run that produced them"
            % (total, by["PRODUCTION"], by["TESTS"], by["OWN"], by["NOWHERE"],
               by["REFUSED"],
               ", ".join("%d %s" % (n, k.lower())
                         for k, n in sorted(kinds.items())) or "none"))
    top = ["%s.%s (%s, %d lines)" % (m, s, k, n)
           for n, m, s, k in nowhere[:10]]
    ev = ["named by nothing, longest first: %s%s"
          % ("; ".join(top) or "none",
             "" if len(nowhere) <= 10 else "; +%d more" % (len(nowhere) - 10)),
          "that list is THIS run's, and cells are closing entries in it now — "
          "re-run rather than quoting it",
          "OUT OF SCOPE and unmeasured: %d public methods on those classes — "
          "a dead method on a live class is invisible to a top-level sweep"
          % methods]
    return Answered(cell, "\n      ".join(ev))


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
        # THE FIRST NUMBER IS THE COUNT THAT DRIFTED, and until 2026-08-14 it
        # was `applied` -- the count that still APPLIES -- interpolated into a
        # sentence about mutations that DO NOT. Two drifted anchors printed
        # `55 of 57 mutations no longer apply`, a figure that is both wrong and
        # wrong in the alarming direction, and that string reached BACKLOG.md
        # verbatim through the laundering path this file now closes.
        #
        # AND `n - applied` IS A COUNT OF MUTATIONS, NOT OF EDITS, which the
        # message now says on its face. Two of the 57 mutations share their
        # anchor with another (M3/M5 and M14/M15 both anchor on one exact line
        # of `lyric_harness.py`), so a single refactor at either site drifts
        # TWO mutations and this count moves by two. `2 of 57` must not be read
        # as two independent regressions: `quality/mutate.py --dry-run` names
        # the mutations AND the files, and one file with two names under it is
        # one repair.
        raise ValueError("%d of %d declared mutations no longer apply (%d still "
                         "do); a mutation that does not apply is declared and "
                         "inert. This counts MUTATIONS, and two anchors are "
                         "shared by two mutations each, so one drifted site can "
                         "move it by two — `python3 quality/mutate.py "
                         "--dry-run` names which"
                         % (n - applied, n, applied))
    a = len(ALLOWLIST)
    cell = ("**%d declared, %d allowlisted equivalent** (%s — and the "
            "allowlist entry's PREMISE is itself under test)"
            % (n, a, ", ".join(sorted(ALLOWLIST))))
    return Answered(cell, "all %d apply cleanly to the current source" % n)


#: What one sweep costs, and it is a MEASUREMENT rather than a margin. On
#: 2026-08-13 nineteen mutations against a ten-file inventory took 4,984s wall
#: at `--mutation-jobs 2` -- about 262s each, because each one forks the
#: baseline-green suite. The previous ceiling here was 3,000s, which could not
#: have completed that run, let alone the declared set: `--slow` would have
#: raised `TimeoutExpired`, `measure()` would have caught it, and the row would
#: have read "the instrument did not answer", billing a BUDGET the caller set
#: to the instrument it was pointed at. Doctrine 79's shape one layer over: a
#: refusal charged to the wrong layer. Six hours is not a claim that the sweep
#: fits in six hours -- it is a ceiling above the only rate anyone has measured,
#: and a run that hits it now refuses AS a timeout and says so.
MUTATION_SWEEP_TIMEOUT = 6 * 3600


def mutations_caught():
    """How many of the declared mutations the suite actually kills.

    DERIVATION. `python3 quality/test_mutation.py` runs the sweep, and
    `quality/mutate.report()` prints its line of record:
    `C/N caught, S SURVIVED, I INDETERMINATE, T stale   wall clock Xs`. It
    forks the test suite once per mutation, so this is REFUSED on the cheap
    path and reachable with `--slow`.

    WHY IT PARSES THAT LINE AND NOT THE OTHER ONE. Until 2026-08-13 this read
    `(\\d+) of (\\d+) mutations caught`, which is not `report()`'s output at
    all -- it is the DETAIL string on one of `test_mutation.py`'s `check()`
    assertions, and that assertion prints the caught count only in the branch
    where nothing unexpected survived. On any run WITH an unallowlisted
    survivor -- which is the only kind of run this counter exists to report --
    the pattern found nothing, `_grab` raised, and the row came back
    `REFUSED (cost) — the instrument did not answer`. A counter that can read
    its instrument exactly when the instrument has nothing to report is worse
    than no counter, because the failure is silent and looks like thrift.
    `report()`'s line prints unconditionally.

    FOUR COUNTS, NOT A RATIO (doctrine 79, and `mutate.report` already says so
    in its own comment). CAUGHT is a detection, SURVIVED is a hole,
    INDETERMINATE is a REFUSAL -- a test in scope never reached a verdict, so
    the run cannot say which of the other two it is -- and STALE is a finding
    about the LIST, not about the suite. Collapsing them into `C of N` puts
    two refusals in a numerator.

    AND THE TWO LINES DISAGREE, which is the sharper half of the same finding.
    `test_mutation.py`'s detail computes `len(results) - len(survivors) -
    len(stale)`; `mutate.report`'s `caught_n` subtracts `len(indeterminate)`
    as well. So on any run with an INDETERMINATE mutation the line this
    counter used to parse reported a strictly LARGER caught count than the
    instrument's own report, by counting each refusal as a kill -- doctrine 79
    in the counter for the adversary that exists to find defects, and reading
    the instrument's line of record rather than an assertion's detail string
    is what removes it. The 2026-08-13 sweep had 0 indeterminate, so nothing
    was mis-stated by it in practice; it was one loaded machine away.

    THE INVENTORY BOUND IS A COORDINATE, NOT A FOOTNOTE (doctrine 91).
    `mutate.py --tests` bounds the inventory, and `report()` prints
    `INVENTORY BOUNDED to K file(s)` above the table precisely because
    SURVIVED then means "nothing in THESE files caught it" and not "nothing in
    the suite caught it". The two render identically as `17/19 caught`. This
    reads the bound and carries it in the cell.

    ------------------------------------------------------------------------
    CAN THIS BE MADE CHEAP? NO, AND THE REFUSAL STANDS. Asked properly
    2026-08-13, because a refusal nobody has re-argued is just a habit.

    The proposal was the `eval_matrix.py --check` shape: let the slow path
    write a committed artifact and have a cheap counter read it, so the number
    is recorded once and checked cheaply thereafter. `quality/mutate.py --json`
    already emits exactly that artifact. Four reasons it does not transfer, in
    increasing order of how much they settle it.

    1. THE ANALOGY FAILS AT THE LOAD-BEARING POINT. `eval_matrix --check` does
       not make an expensive number cheap. It runs the WHOLE derivation on
       every check and compares the result to the committed artifact; the
       artifact catches drift in a derivation cheap enough to re-run in CI's
       ten-minute `record` job. The artifact is the COMPARATOR, never the
       source of the number. Take the fresh derivation away and what is left
       is a file being read aloud.

    2. SO THE CHEAP READ IS DOCTRINE 58 WITH A JSON EXTENSION. This module's
       own header commits to it: "If the parse fails, the counter REFUSES; it
       never falls back to a remembered value." A committed artifact IS a
       remembered value. Moving it out of a table cell and into a file changes
       where it is remembered and nothing else.

    3. NO CHEAP FRESHNESS TEST IS SOUND. A cached number is honest if some
       cheap fingerprint's invariance implies the number has not moved. Here
       "caught" means SOME test in the inventory went red under the mutant, so
       a verdict depends on every test and on everything the tests import --
       the sound fingerprint is the whole tree. In this repo the whole tree
       moves hourly: between two `--check` runs twenty minutes apart on
       2026-08-13 the public-symbol total went 898 -> 900 under sibling lots.
       A repo-wide fingerprint would therefore read STALE on essentially every
       run, which is this refusal with more machinery and a quotable number
       parked beside it. Narrowing the fingerprint to the mutated file is
       unsound in the direction that matters: it would report FRESH after an
       edit that deleted the only test that was doing the catching.

    4. AND THE NUMBER IS SELF-INVALIDATING, which is what actually settles it.
       The sweep exists to find survivors; the response to a survivor is to
       write the assertion that kills it; that response changes the number.
       The 2026-08-13 round is the proof in one step: 19 mutations against a
       ten-file inventory, 17 caught, 2 SURVIVED (QS2 in `schemes.py`, QG1 in
       `grid.py`), 0 indeterminate, 4,984s -- and both survivors have since
       been closed by new tests, so `17 of 19` was superseded by the work it
       triggered before it could ever be committed. The earlier partial run of
       QF1-QF5 says the same: 2 survived, both now closed. Of the 24
       quality-layer mutations run this round all 4 survivors are closed, and
       none of the four replacement verdicts has been measured. An artifact
       whose value is invalidated by the act of acting on it is not a cache.
       It is a dated log entry, and this repo already has the place for those.

    WHAT WOULD BE CACHED IS ALSO NOT THIS QUANTITY. No run in existence covers
    the declared set: this round ran 24 of the 57 declared, at two different
    inventory bounds, one of them partial, and the 33 pre-existing `M*`
    mutations were not re-run at all. The honest artifact would read "24 of 57
    have a verdict, from two runs at two bounds" -- a COVERAGE statement about
    the sweep, not a caught count about the suite -- and the cheap half of
    that, "do all 57 still apply to the current source", is already measured
    by `mutations_declared()` above at `--dry-run` cost.

    So: the number stays refused for COST, and the refusal now says what it is
    refusing rather than only that it is refusing.
    """
    try:
        out, _ = _sh(["quality/test_mutation.py"],
                     timeout=MUTATION_SWEEP_TIMEOUT)
    except subprocess.TimeoutExpired:
        return Refused(COST, "the sweep did not finish inside "
                             "MUTATION_SWEEP_TIMEOUT (%ds); a run that was cut "
                             "off has no verdict, and reporting the partial "
                             "table as a result would put a timeout in the "
                             "numerator" % MUTATION_SWEEP_TIMEOUT,
                       "raise MUTATION_SWEEP_TIMEOUT, or bound the inventory "
                       "with `quality/mutate.py --tests` and read the bound")
    m = _grab(r"^(\d+)/(\d+) caught, (\d+) SURVIVED, (\d+) INDETERMINATE, "
              r"(\d+) stale", out, "the mutation report's four counts")
    caught, total, surv_n, indet, stale_n = (int(m.group(i))
                                             for i in range(1, 6))
    if caught + surv_n + indet + stale_n != total:
        raise ValueError("the four counts %d + %d + %d + %d do not reconcile "
                         "with the %d mutations run; a partition that does not "
                         "partition is not a measurement"
                         % (caught, surv_n, indet, stale_n, total))
    bound = re.search(r"^INVENTORY BOUNDED to (\d+) file\(s\)", out, re.M)
    # `report()` writes the table as `name:5s layer:11s scope_run:22s who`,
    # and `scope_run` is a free-form string that can hold spaces -- so the
    # third field is matched loosely and the SURVIVED marker is the anchor.
    names = re.findall(r"^(\S+)\s+\S+\s+.*\*\*\* SURVIVED \*\*\*", out, re.M)
    cell = ("%d/%d caught, %d SURVIVED, %d INDETERMINATE, %d stale%s"
            % (caught, total, surv_n, indet, stale_n,
               " — INVENTORY BOUNDED to %s file(s), so SURVIVED means "
               "'survived those', NOT 'survived the suite'" % bound.group(1)
               if bound else ""))
    surv = re.search(r"SURVIVED and not allowlisted: (.+)", out)
    return Answered(cell, "survivors: %s; unallowlisted: %s"
                    % (", ".join(names) or "none",
                       surv.group(1) if surv else "none"))


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
    # REPAIRED 2026-08-14, and the break is worth recording because it is a
    # doctrine-79 fix arriving as a parse error. The runner used to end on
    # `consistency failures + FALSE derivations: N` — ONE integer over TWO
    # questions, which is precisely what doctrine 79 forbids. Splitting it into
    # `consistency failures: A   FALSE derivations: B   (total C)` was correct
    # and broke this parser, and `counters.py --check` reported the row
    # [BROKEN] rather than laundering the crash into the table.
    #
    # This counter keeps reading the TOTAL, on purpose: its committed cell is
    # one number and the row's question is "what does the record adversary
    # still find wrong". The two halves are named in the evidence beside it, so
    # nothing here sums what the runner took apart — it quotes a total the
    # runner itself computes and prints.
    m = _grab(r"consistency failures: (\d+)\s+FALSE derivations: (\d+)"
              r"\s+\(total (\d+)\)", out,
              "the register-audit finding count")
    n = int(m.group(3))
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
    Counter("public symbols by where they are referenced",
            "python3 quality/counters.py", public_symbols),
    # The two `restated` patterns are not a guess about where prose might
    # quote a counter: they are the two places BACKLOG.md's own preamble
    # quotes one, in the paragraph beginning "The two that were RIGHT and were
    # checked anyway", four paragraphs after the same blockquote writes down
    # the rule it breaks -- "a number restated in prose beside its own counter
    # is the next thing to drift". Both patterns anchor on that sentence's
    # phrasing and will fall silent if it is rewritten; that blind spot is
    # named in `Counter.__doc__` rather than hidden behind a looser regex.
    #
    # RE-ANCHORED 2026-08-13, and the reason is the blind spot firing exactly
    # as predicted. This pattern was
    # `\*\*\d+ declared, \d+ caught, \d+ allowlisted\*\*`, matching a sentence
    # that read `**33 declared, 32 caught, 1 allowlisted**` while the row four
    # lines below it measured 57. That prose is now a dated COVERAGE statement
    # -- `**24 of the 57 then declared**` -- because no run covers the declared
    # set and a caught/declared ratio would be doctrine 79's sum of four
    # different questions. Rewriting the sentence and leaving the old pattern
    # in place would have retired the report by accident: a regex matching
    # nothing reads exactly like a restatement that is no longer there. The
    # new pattern tracks the new shape, so a reader still gets the dated
    # denominator printed beside the live one and can see when history and
    # measurement have parted company.
    Counter("mutations declared", "python3 quality/counters.py",
            mutations_declared,
            restated=r"\*\*\d+ of the \d+ then declared\*\*"),
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
    Counter("sonnet battery", "python3 battery.py", battery,
            restated=r"`\d+/\d+` (?:as measured on \d{4}-\d{2}-\d{2}|today)"),
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
    dupes = sorted(k for k, n in collections.Counter(c.key for c in COUNTERS)
                   .items() if n > 1)
    if dupes:
        raise ValueError("two counters share a key: %s. The table is keyed on "
                         "it, so one row would silently be checked against the "
                         "other's measurement" % dupes)
    return [(c, c.measure(slow=slow)) for c in COUNTERS]


def committed_values():
    """-> {counter key: the FIRST committed value for it}, or {} if unreadable.

    FIRST and not last, matching `read_table`'s own rule that a reader sees the
    first of a duplicated pair. Unreadable is `{}` rather than a raise because
    the plain `python3 quality/counters.py` path prints a table without needing
    BACKLOG.md to be well formed at all, and a missing marker there is
    `read_table`'s finding to make, not this helper's.
    """
    try:
        rows, _ = read_table()
    except (OSError, ValueError):
        return {}
    out = {}
    for key, value, _cmd in rows:
        out.setdefault(key, value)
    return out


def committed_cell(counter, result, previous=None):
    """-> what belongs in BACKLOG.md for this counter, which is NOT always the
    measurement.

    Four cases, and getting them wrong is how a check cries wolf -- or, in the
    fourth, how it stops crying at all:

      volatile -> the runtime marker, never a number. There is nothing to go
                  stale because nothing is recorded.
      slow     -> ALWAYS the cheap-path refusal, even on a `--slow` run. If a
                  `--slow` run wrote `32 of 33 caught` into the table, the next
                  ordinary `--check` would call the table stale for saying
                  exactly what it should say. The recorded table describes the
                  DEFAULT path; `--slow` reports its extra measurement to
                  stdout and does not touch the file. NOTE that this makes a
                  slow counter's cell a CONSTANT, independent of what the run
                  measured -- which is why `slow` needs no protection below and
                  is the wrong carve-out for the fourth case.
      broken   -> `previous`, unchanged: whatever the row already said. The
                  counter CRASHED, so this run has nothing to record, and a
                  crash written into the table reads back as a settled result
                  that `--check` then matches against itself forever. That is
                  the laundering path the module header measures end to end.
                  `BROKEN_CELL` only when there is no row to keep.
      otherwise-> the measurement.

    `previous` is the committed text, supplied by the caller because the two
    callers have it already: `check` has parsed the table and `render` reads it
    once for the whole write. A DECLARED refusal is not broken and takes the
    last branch -- `adversaries built, of 8` records its own JUDGEMENT refusal
    here, correctly, and always has.
    """
    if counter.volatile:
        return RUNTIME_CELL
    if counter.slow:
        return Refused(COST, "not measured on the cheap path",
                       "python3 quality/counters.py --slow").cell
    if result.broken:
        return BROKEN_CELL if previous is None else previous
    return result.cell


def render(results, previous=None):
    """-> the markdown table, exactly as it belongs in BACKLOG.md.

    `previous` is the table as it stands, read ONCE here rather than per row,
    and it is what a BROKEN counter's row is rebuilt from -- see
    `committed_cell`. Every other row is rebuilt from the measurement, so one
    dead instrument costs exactly its own row and no other.

    A `|` IN ANY CELL IS REFUSED, and it is refused here rather than escaped.
    Markdown's cell separator is the same character, so a measurement holding
    one is written as a row of four cells and read back as a truncated value:
    `--write` would then emit a table that the very next `--check` calls
    stale, whose printed remedy is `--write`. That is a loop with no exit, and
    the file's whole promise is that the remedy terminates. No counter emits
    one today, but `stranded()` interpolates module names and
    `register_findings()` interpolates identifiers out of another runner's
    output, so this is one upstream change away rather than hypothetical.
    """
    if previous is None:
        previous = committed_values()
    rows = [TABLE_HEADER, "|---|---|---|"]
    for c, r in results:
        cell = committed_cell(c, r, previous.get(c.key))
        for part, what in ((c.key, "key"), (cell, "measured cell"),
                           (c.command, "command")):
            if "|" in part:
                raise ValueError(
                    "counter %r has a `|` in its %s (%r). Markdown cannot "
                    "carry it: the row would be written with an extra cell and "
                    "read back truncated, so `--write` would produce a table "
                    "`--check` immediately calls stale. Rephrase the cell."
                    % (c.key, what, part))
        rows.append("| %s | %s | `%s` |" % (c.key, cell, c.command))
    return "\n".join(rows)


def read_table():
    """-> ([(key, value, command), ...], [(key, found, expected), ...]).

    A LIST AND NOT A DICT, and the change is a DEFECT REPAIRED rather than a
    refactor. Until 2026-08-13 this built `out[key] = (value, command)` over
    the rows, and `check`'s orphan-row loop compared against a SET of keys.
    Both collapse duplicates, so a table carrying TWO rows for one counter --
    a stale one above the true one -- reported FRESH, while every human
    reading BACKLOG.md saw the stale number first. Found by pointing an
    adversary at this file's own `--check`; it is the defect this file exists
    to end, occurring in this file. Every row is now returned and every row is
    compared, so a twin fails on its own value.

    Three more structural claims are asserted here for the same reason -- each
    was a `PASS (says fresh)` in that adversary run, and none of them is a
    number, so none of them can be fixed by `--write`:

      EXACTLY THREE CELLS per row. A fourth was silently dropped, so a row
        could carry `| ... | STALE, DO NOT TRUST |`, or a second number, and
        pass.
      EXACTLY ONE marker block. `split(OPEN_MARK, 1)` reads the first and
        `write_table` writes the first; a second block is a second table that
        nothing reads and `--write` never touches.
      NO SECOND TABLE in the counters shape anywhere else in the file. The
        hand-maintained table this file replaced was headed
        `## Counters, so drift is visible`; a surviving copy of it would be
        stale by construction and invisible to every check here.

    What is still OUT OF REACH, stated because a scope nobody wrote down is
    doctrine 58's shape: this reads the TABLE. Figures written into BACKLOG.md
    PROSE are not rows and are not checked. `Counter.restated` reports the two
    that are known to exist; it does not pretend to find the rest.
    """
    text = open(BACKLOG, encoding="utf-8").read()
    if OPEN_MARK not in text or CLOSE_MARK not in text:
        raise ValueError("BACKLOG.md carries no %s ... %s markers; the "
                         "counters table is not machine-locatable"
                         % (OPEN_MARK, CLOSE_MARK))
    findings = []
    n_open, n_close = text.count(OPEN_MARK), text.count(CLOSE_MARK)
    if n_open > 1 or n_close > 1:
        findings.append(("(the marker block)",
                         "%d opening and %d closing markers" % (n_open,
                                                                n_close),
                         "exactly one of each — only the FIRST block is read "
                         "or written, so any later block is an unchecked "
                         "second record"))
    body = text.split(OPEN_MARK, 1)[1].split(CLOSE_MARK, 1)[0]
    outside = text.split(OPEN_MARK, 1)[0] + text.split(CLOSE_MARK, 1)[1]
    if TABLE_HEADER in outside:
        findings.append(("(a second counters table)",
                         "another `%s` table sits outside the markers"
                         % TABLE_HEADER,
                         "one counters table, between the markers, written by "
                         "`--write`"))
    rows, seen = [], {}
    for ln in body.split("\n"):
        ln = ln.strip()
        if not ln.startswith("|") or set(ln) <= set("|- "):
            continue
        cells = [c.strip() for c in ln.strip("|").split("|")]
        if len(cells) < 2 or cells[0] == "counter":
            continue
        key = cells[0]
        if len(cells) != 3:
            findings.append((key, "a row of %d cells" % len(cells),
                             "exactly 3 — `| counter | measured | measured "
                             "by |`; anything past the third is not read"))
        if key in seen:
            findings.append((key, "the row appears more than once; an earlier "
                                  "one says: %s" % seen[key],
                             "one row per counter — a reader sees the FIRST"))
        seen[key] = cells[1]
        rows.append((key, cells[1], cells[2] if len(cells) > 2 else ""))
    return rows, findings


def write_table(results):
    """Splice a freshly rendered table between the markers. NOTHING ELSE MOVES.

    The head and tail either side of the markers are carried across byte for
    byte, so `--write` cannot touch a line of BACKLOG.md's prose -- which is
    the guarantee that lets `Counter.restated` report a stale sentence without
    offering `--write` as its remedy.

    `previous` is read from the file BEFORE the splice, because a broken
    counter's row is rebuilt from what that row already said and the splice is
    what would destroy it.
    """
    text = open(BACKLOG, encoding="utf-8").read()
    if OPEN_MARK not in text:
        raise ValueError("BACKLOG.md carries no %s marker" % OPEN_MARK)
    previous = committed_values()
    head, rest = text.split(OPEN_MARK, 1)
    _, tail = rest.split(CLOSE_MARK, 1)
    new = "%s%s\n%s\n%s%s" % (head, OPEN_MARK, render(results, previous),
                              CLOSE_MARK, tail)
    open(BACKLOG, "w", encoding="utf-8").write(new)
    return new


def check(results):
    """-> (stale, unchecked, reported). FAILS LOUDLY; it does not report and
    continue.

    A volatile counter's committed cell must be the runtime marker and must
    NOT be a number: the whole point is that there is nothing there to go
    stale. A refused counter's committed cell must be its refusal, so that a
    session reading BACKLOG.md sees "cannot tell" rather than a value.

    WHAT AN ADVERSARY GOT PAST THIS ON 2026-08-13, because the question worth
    asking of a checker is not "does it catch a wrong number" -- it caught
    that on the first try -- but "can it call something FRESH that is STALE".
    Four could, and all four are closed here or in `read_table` above:

      THE COMMAND COLUMN WAS NEVER COMPARED. `read_table` returned it and the
        loop read `got[0]` only, so a row could name any command at all --
        including one that does not exist -- and pass. That is not a cosmetic
        half of the row: it is the REPRODUCTION INSTRUCTION, the half a human
        uses to re-derive the figure, and a figure whose stated command does
        not produce it is precisely the defect that put `band_fpr()` in this
        file (`3.57% (107/3,000)` against a runner that defaults to 4,000 --
        doctrine 58 sharpened by 91). Checking the value and not the command
        left the newer half of that lesson unenforced. Both cells now.
      A DUPLICATE ROW HID BEHIND ITS TWIN -- see `read_table`.
      A FOURTH CELL WAS DROPPED -- see `read_table`.
      A BROKEN INSTRUMENT OF ANY KIND, AND THIS ONE WAS FOUND A DAY LATER, ON
        2026-08-14, BY ASKING THE SAME QUESTION OF THE REMEDY. The volatile
        case below is a special case of it. For a NON-volatile counter the
        crash string went into the cell, so `--write` made `--check` compare
        REFUSED against REFUSED and print PASS forever. The condition is
        `r.broken` now -- provenance, not any property of the counter -- and it
        is checked BEFORE and INDEPENDENTLY of the value comparison, so no cell
        content can satisfy it. `--write` cannot clear it either: it keeps the
        row unchanged and exits 1. The module header carries the measurement
        and the argument for the predicate.
      A BROKEN VOLATILE INSTRUMENT PASSED AS THRIFT. A volatile row's cell is
        the runtime marker, so nothing about the row moves when its counter
        stops working -- and the marker is not a blank, it is a CLAIM that the
        named command yields a measurement. `english_corpus()` reads three
        derivations out of another runner's printed output; if that output
        changes shape the counter raises, `measure()` turns it into a
        `Refused`, `committed_cell` returns the marker anyway, and the check
        stayed green over a counter that had stopped counting. Worse, `main()`
        printed the row marked `[VOLATILE]`, so the refusal was displayed
        under the label for a deliberate absence -- doctrine 28's two kinds of
        "cannot tell" collapsed into the wrong one. A volatile counter that
        cannot answer is now STALE, and its remedy is to repair the counter,
        not to run `--write`.

    THE THIRD RETURN VALUE is REPORTED, NEVER ASSERTED, and the distinction is
    deliberate rather than soft. `--check` reads the table between the markers
    and nothing else, so a counter's quantity written out in BACKLOG.md PROSE
    is outside its reach; `Counter.restated` finds the ones known to be there.
    They are printed and they do not change the exit code, because the remedy
    is a sentence only a BACKLOG.md owner can rewrite, `--write` cannot touch
    it, and `quality/test_mutation.py` already states the rule for this exact
    situation: a check held permanently red by something another cell owns is
    a check people learn to skip past.
    """
    committed_rows, findings = read_table()
    stale, unchecked, reported = list(findings), [], []
    by_key = collections.defaultdict(list)
    for key, value, command in committed_rows:
        by_key[key].append((value, command))
    for c, r in results:
        got = by_key.get(c.key)
        # A BROKEN counter's row is KEPT rather than rewritten, so `want` is
        # computed against what the table already says -- which makes the value
        # comparison below silent for it and leaves exactly one finding, the
        # repair, instead of a spurious second one about a cell nobody wrote.
        want = committed_cell(c, r, got[0][0] if got else None)
        want_cmd = "`%s`" % c.command
        # Before the absent-row `continue`: prose restating a counter whose
        # ROW has gone missing is the worst version of this, not an exempt one.
        if c.restated:
            reported.extend((c.key, ln, txt, want)
                            for ln, txt in _restated(c.restated))
        if got is None:
            stale.append((c.key, "(absent from the table)", want))
            continue
        if r.broken:
            stale.append((c.key,
                          "the counter CRASHED, so this run measured nothing "
                          "for this row: %s" % r.cell,
                          "a working counter — REPAIR IT; `--write` cannot "
                          "fix this and will not write a crash into the "
                          "table: it leaves this row exactly as it stands and "
                          "exits 1. (If a sibling cell was mid-write, re-run "
                          "first.)"))
        elif c.volatile and r.refused:
            stale.append((c.key,
                          "the row says the command measures this at runtime, "
                          "and it did not: %s" % r.cell,
                          "a working counter — REPAIR IT; `--write` cannot "
                          "fix this, the cell is already correct. (If a "
                          "sibling cell was mid-write, re-run first.)"))
        if c.slow:
            unchecked.append("%s%s" % (c.key, "" if r.refused
                                       else " — measured %s, and the table "
                                            "deliberately does not record it"
                                            % r.cell))
        for value, command in got:
            if value != want:
                stale.append((c.key, value, want))
            if command != want_cmd:
                stale.append((c.key + "  (the `measured by` column — the "
                                      "reproduction instruction)",
                              command or "(no command cell)", want_cmd))
    for key in by_key:
        if key not in {c.key for c, _ in results}:
            stale.append((key, "(row in the table, no counter measures it)",
                          "—"))
    return stale, unchecked, reported


def _restated(pattern):
    """-> [(1-based line number, matched text), ...] for every match of
    `pattern` in BACKLOG.md OUTSIDE the marker block.

    Offsets are taken against the WHOLE file and matches inside the block are
    dropped, rather than searching a spliced copy of the outside: splicing
    makes the line numbers of everything after the table wrong, and a report
    that points at the wrong line is worse than no report.
    """
    text = open(BACKLOG, encoding="utf-8").read()
    lo = text.index(OPEN_MARK)
    hi = text.index(CLOSE_MARK) + len(CLOSE_MARK)
    out = []
    for m in re.finditer(pattern, text, re.M):
        if lo <= m.start() < hi:
            continue
        out.append((text.count("\n", 0, m.start()) + 1, m.group(0)))
    return out


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
        # A counter that CRASHED is not a deliberate absence, it is a dead
        # instrument, and printing both under one label is doctrine 28's two
        # kinds of "cannot tell" collapsed into the flattering one. `r.broken`
        # is the general case; the volatile clause is kept beside it because a
        # volatile row's cell carries no measurement at all, so a volatile
        # counter that refuses for ANY reason has stopped backing its own
        # runtime marker.
        mark = ("BROKEN" if r.broken or (c.volatile and r.refused) else
                "VOLATILE" if c.volatile else
                "REFUSED" if r.refused else "ok")
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
        # THE ONE THING `--write` WILL NOT DO. A crash is not a measurement, so
        # a broken counter's row is left exactly as it stands and this exits
        # non-zero. Without this, `--check`'s own printed remedy silenced the
        # check: `--write` committed the traceback, `--check` matched REFUSED
        # against REFUSED, and a drifted mutation anchor went green forever.
        broken = [(c, r) for c, r in results if r.broken]
        if broken:
            print()
            print("REFUSED to record %d counter(s): the instrument did not "
                  "answer, and a crash is not a measurement. Each row below is "
                  "byte-identical to what it already said." % len(broken))
            for c, r in broken:
                print("  %s" % c.key)
                print("      %s" % r.reason)
                print("      repair: %s" % (r.remedy or c.command))
            print("`--check` reports these on the CRASH, not on the cell, so "
                  "no further `--write` can turn them green. Repair the "
                  "counter.")
            return 1
        return 0

    if not a.check:
        print("\nThe table as it should read:\n")
        print(render(results))
        return 0

    stale, unchecked, reported = check(results)
    print()
    print("=" * 78)
    print("CHECK — BACKLOG.md's committed counters table against the "
          "measurement")
    print("=" * 78)
    # SCOPE, stated every run. `--check` is a check on the TABLE, not on the
    # file: MISSING.md's guarantee ("this figure cannot go stale again without
    # a red test") is exactly as wide as these two markers, and a reader is
    # owed the edge of it rather than left to assume it covers BACKLOG.md.
    print("  scope: the %d row(s) between %s and %s — value AND `measured by` "
          "cell. Prose elsewhere in BACKLOG.md is NOT a row and is not "
          "checked." % (len(read_table()[0]), OPEN_MARK, CLOSE_MARK))
    if unchecked:
        print("  [not checked] %s — refused for COST on this run; "
              "re-run with --slow" % ", ".join(unchecked))
    for key, lineno, txt, want in reported:
        print("  [reported, not asserted] BACKLOG.md:%d restates `%s` in "
              "prose" % (lineno, key))
        print("         prose    : %s" % txt)
        print("         measured : %s" % want)
        print("         Compare them by eye. This does NOT set the exit code: "
              "the remedy is to rewrite the sentence, which `--write` cannot "
              "do and no other cell should be held red for.")
    if not stale:
        print("  [ok  ] every committed counter equals its measurement")
        print("\nRESULT: PASS")
        return 0
    for key, got, want in stale:
        print("  [FAIL] %s" % key)
        print("         committed: %s" % got)
        print("         measured : %s" % want)
    print("\n%d finding(s) against BACKLOG.md's counters table. A stale VALUE "
          "or `measured by` cell is fixed with\n"
          "    python3 quality/counters.py --write\n"
          "and NOT by retyping it — that is the defect this file exists to end "
          "(doctrine 48). A finding about the table's SHAPE (a duplicated row, "
          "a row of the wrong width, a second marker block or a second "
          "counters table) is not a number and `--write` will not clear it: "
          "delete the extra row or block by hand. A BROKEN counter — volatile "
          "or not — is neither: `--write` leaves its row untouched and exits "
          "1, and this check reads the crash rather than the cell, so repairing "
          "the counter is the only thing that clears it." % len(stale))
    print("\nRESULT: FAIL")
    return 1


if __name__ == "__main__":
    sys.exit(main())
