#!/usr/bin/env python3
"""ENTRY CLAIMS — the sentences in MISSING.md and BACKLOG.md, checked; plus
three shapes asked of prose documents, each over its own declared scope: every
backticked repo PATH in the three standing documents; every per-family
RHYME-CAPACITY FIGURE, re-derived from `data/rhyme_capacity_eng.tsv`; and every
shipped FLOOR THRESHOLD restated in a table, re-derived from
`quality/floor.py`. The last two reach one RESULTS document apiece.

    python3 quality/verify_entries.py                 # check; non-zero on a FALSE claim
    python3 quality/verify_entries.py --refusals      # + every refused claim, by kind
    python3 quality/verify_entries.py --shapes        # the declared shapes, and nothing else
    python3 quality/verify_entries.py --entry M-6     # one entry, every claim in it
    python3 quality/verify_entries.py --slow          # + audit_register's corpus derivations
    python3 quality/verify_entries.py --no-derivations  # skip the audit_register subprocess
    python3 quality/verify_entries.py --pins          # every pin the audit scripts commit to
    python3 quality/verify_entries.py --prose         # every path cited by the prose docs

WHY THIS FILE EXISTS.

`quality/counters.py` made the numeric table at the foot of BACKLOG.md an
OUTPUT. **The counters are fixed; the ENTRIES were not.** On 2026-08-11 a cell
was briefed off `MISSING.md` M-6 / `BACKLOG.md` §2.7 --

    No `rhymes()`. Nine of the ten staged Finnish files are rhymed strophic
    verse whose actual constraint the module cannot check.

-- and both sentences were false. `quality/phonology/fin.py` has defined
`rhymes()` since `f94383c`, and the corpus holds ELEVEN Finnish files. The cell
was sent to build something that already existed. `f94383c`'s own commit title
is "two of my own MISSING entries were false", so the register went stale in
the same round that was meant to be catching it.

Doctrine 48: a principle that lives only in prose gets followed exactly as
often as someone remembers it. This repo has made that move three times --
`verify_doctrines.py` turned "does every `doctrine N` citation resolve?" into a
command; the `wiring` verb turned "is this plugged in?" into a command;
`counters.py` turned the drift table into an output. This is the fourth, and
it is the one that would have saved a cell.

WHAT IT IS NOT. It is not a general claim-extractor. There cannot be one, and
faking one would be worse than not checking: a checker that GUESSES at
"the exchange rate between surprise and clarity is not derivable" (doctrine 6)
converts an unexamined sentence into a confirmed one. So this is a DECLARED,
GROWING SET OF CLAIM SHAPES. A segment that no shape recognises is REFUSED and
counted, never assumed true.

THE THREE COUNTS (doctrine 79). ASKED is every CLAIM drawn from every segment
of every entry -- the whole population, not the convenient part of it, and a
segment no shape recognises still contributes one asked claim rather than
vanishing from the denominator. A segment can carry more than one claim: §4.4
states a repo path and a line count in one sentence, and every shape is asked
about every segment for that reason. ANSWERED is the claims a declared shape
resolved against the repo. REFUSED is the rest, bucketed by kind. The refused count is LARGE and it is meant to be: it is the honest size
of the unchecked remainder, and shrinking it means declaring another shape, not
loosening one. Doctrine 28: "none" and "cannot tell" are different values,
mechanically, so a refusal is its own object here and never a verdict of TRUE.

WHAT THE REFUSAL KINDS DO AND DO NOT SEPARATE.

  NO_SHAPE          no declared shape recognises this segment. This is the
                    unchecked remainder and it deliberately does NOT try to
                    distinguish "unshaped because it is a judgement" from
                    "unshaped because nobody has written that shape yet".
                    Sorting those two apart requires reading the sentence, and
                    a regex that claimed to would be the guess this file exists
                    to refuse.
  AMBIGUOUS_SCOPE   a shape triggered and the coordinate it needs is not in the
                    text -- which module does a bare `rhymes()` belong to, which
                    corpus does "the files" mean. Doctrine 58: the entry
                    recorded a figure and not the rule that produced it. These
                    are the highest-value refusals: each one is a sentence that
                    WOULD be checkable if it named its own coordinate.
  HISTORICAL        the segment asserts about a past state -- a `**Was:**`
                    clause, or a `~~struck~~` figure the entry has already
                    corrected. The repo at HEAD cannot contradict it and an
                    instrument that reported FALSE here would be punishing the
                    register for keeping its own history.
  NO_INSTRUMENT     the shape triggered, the coordinate is stated, and the
                    thing it points at could not be read (an unimportable
                    module, an unparseable file). Never a fallback to a
                    remembered value.

STATUS AND CONTENT ARE DIFFERENT THINGS, AND BOTH DIRECTIONS ARE BUGS.
An entry marked OPEN whose absence-claim is FALSE is the bug that cost a cell:
the gap is filled and the register still advertises it. An entry marked CLOSED
whose absence-claim is still TRUE is the opposite bug. Both are reported;
the first FAILS the run, the second is reported as a NOTE because the direction
is not always the entry's headline (N-2 is CLOSED and carries a true residual
absence on purpose, and it says so).

The STATUS itself is read by `quality.counters.missing_entry_statuses()` --
CALLED, not re-parsed. A second status parser that disagreed with the first is
precisely the defect this file exists to prevent.

VOLATILE SHAPES. A corpus cell is live. Every shape that counts files, songs or
markers under `corpus/song/` or `data/` is marked VOLATILE: it is measured at
RUNTIME and its measurement is printed with the word MEASURED and the commit it
was taken at. Where the register must pin such a number, it pins to a COMMIT
and not to a date -- a commit re-derives forever, a date cannot be checked.

THE POSITIVE CONTROL, AND WHY A CLEAN RUN NEEDS ONE. "0 false claims" is a null
result. Doctrine 76: a null is only as good as the demonstration that the
instrument could have found something; doctrine 31: run the positive control
before believing the null. This cell struck M-6's two false sentences, and with
them the only live instance of the `SYMBOL_ABSENT` shape -- so the shape that
would have saved a cell now matches nothing and would rot in silence. Every
shape therefore declares a probe it must call TRUE and a probe it must call
FALSE, written against the real repository, and a misfiring probe FAILS the run
exactly as a false entry does. Shapes that matched no live segment are printed
as `[dead]` in the report, so the difference between "nothing is wrong" and
"nothing was looked at" stays visible (doctrine 28).

TWO CHECKS HERE ARE NOT ABOUT THE TWO REGISTERS, AND THEY SAY SO. A doctrine
census on 2026-08-13 found ninety-five doctrines and asked, of each, whether
anything in the repo could go red on it. Two came back ASSERTED -- a check
exists and cannot fail -- and both belong to this file, because both are
questions about a CITATION rather than about a measurement.

  DOCTRINE 17, "a check may be kept after its premise is falsified, but never
  quoted as if it were not". Cited 44 times, and it is the sentence five audit
  scripts print when they go red -- every one of those 44 is a comment or a
  failure-message STRING. Nothing checked that a superseded value stayed
  visible. `pin_supersession()` derives, from git history, which pins have
  ACTUALLY moved, and asks the documents each audit script names whether the
  old value is still on the page. Section 3c states what is and is not made
  mandatory, and why the obvious version of this check fires on correct work.

  DOCTRINE 77, "parallel cells share a scratchpad, so working files must be
  namespaced". `REPO_PATH_EXISTS` already read every cited path -- and asked
  whether it EXISTS, which is the one thing that can never be true of scratch.
  `SCRATCH_NAMESPACED` is shape 9 and asks the other question.

ONE SHAPE REACHES BEYOND THE TWO REGISTERS, AND ONLY ONE. `REPO_PATH_EXISTS`
asks a question that has nothing to do with the MISSING/BACKLOG entry format --
does a backticked path exist -- and for as long as it was pointed at the two
registers alone, a stale path anywhere else in the repo was checked by nothing.
`quality/verify_doctrines.py` reads CLAUDE.md for doctrine numbering and the
known-gaps list, and `quality/audit_register.py` reads it for the doctrine
extraction regex; NEITHER looks at a path. So `PROSE_DOCS` -- CLAUDE.md,
README.md and `quality/METHOD.md`, the three documents this repo tells a
session to read before it writes -- are swept for that ONE shape.

WHY ONLY THAT ONE, MEASURED RATHER THAN ARGUED. Every shape was run over the
three documents before the scope was widened, and the other eight are not
merely useless over prose, they are WRONG over it:

  SYMBOL_ABSENT       1 FALSE. CLAUDE.md's "reachable from the CLI by nothing
                      at all: `lex = Lexicon()` at the top of `main()`" is a
                      wiring narrative, not an absence claim; the shape reads
                      "nothing ... `main()`" and `_entry_modules` supplies
                      `quality/g2p.py` from the same paragraph. Separating the
                      two needs the sentence read, which is the guess this
                      file refuses to make.
  STAGED_FILE_COUNT   1 FALSE. "Seven Welsh files ... are on disk" is TRUE --
                      five under `corpus/song/cym_*` and two under `corpus/`
                      -- and the shape's denominator is `corpus/song/` alone.
                      Inside the register "staged" always means that
                      directory; in prose it does not, and the shape has no
                      way to know which sentence it is in.
  MODULE_LINE_COUNT   1 FALSE, 1 AMBIGUOUS_SCOPE. METHOD.md quotes
                      `quality/kalevala_rate.py` printing `82.5971%
                      (18828/22795 lines)` -- a CORPUS line count inside
                      program output, adjacent to the module name precisely
                      because that module is the thing being quoted. This is
                      the K-1 false positive its own docstring records, one
                      axis further out, and ADJACENCY cannot fix it.
  SCRATCH_NAMESPACED  1 TRUE and it is the wrong kind of true: METHOD.md's
                      only scratch citation is `scratchpad/raw/` inside
                      doctrine 77's own narrative of the defect. Reading a
                      doctrine's illustration as a citation of a working file
                      is not a check, and one hit does not pay for the shape.
  HASATTR             no instance. CORPUS_MARKER_ABSENT, CORPUS_TABLE_ROW: no
                      instance. STATUS_XREF: gated to a BACKLOG.md heading by
                      construction and meaningless anywhere else.

Widening is therefore per-SHAPE and never per-FILE, and `PROSE_SHAPES` is the
declared list. A shape earns a place in it by being run over the documents
first and shown not to misfire -- the same standard `POSITIVE_CONTROLS` holds
a shape to, applied to its SCOPE rather than to its logic.

WHAT THE PROSE SWEEP IS NOT COUNTED IN. Its verdicts are reported in their own
section with their own counts and are deliberately NOT folded into the
register's asked/answered/refused triple. CLAUDE.md alone is some three
thousand segments, of which one shape is asked; adding them to a denominator
that means "claims drawn from the two registers" would triple the refused
count with prose nobody proposed to check, and doctrine 79's numbers are only
honest while they answer one question each. A FALSE verdict there does move
the exit code, because a stale path is a stale path whichever file states it.

RELATION TO `quality/audit_register.py`. That instrument carries 26 HAND-WRITTEN
derivations (D1-D26), one per known quantitative claim, each with bespoke code.
This one carries no per-entry code at all: it sweeps every segment and asks
which declared SHAPE fits. The two are complements -- a hand-written derivation
reaches numbers no shape will ever generalise; a shape reaches claims nobody
thought to write a derivation for, which is how M-6 sat false for a week while
D1-D26 all passed. Neither subsumes the other and neither re-implements the
other's checks.
"""

from __future__ import annotations

import argparse
import ast
import collections
import glob
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from quality.counters import missing_entry_statuses  # noqa: E402  the ONE parser

MISSING_MD = os.path.join(ROOT, "MISSING.md")
BACKLOG_MD = os.path.join(ROOT, "BACKLOG.md")
SONG_DIR = os.path.join(ROOT, "corpus", "song")

#: The standing prose documents. This is `REPO_PATH_EXISTS`'s scope and the
#: DEFAULT one; `PROSE_SHAPES` below assigns each shape its own, and
#: `CAPACITY_FIGURE` reaches one RESULTS document past this tuple. These three
#: and not a glob over `*.md`: the RESULTS documents are a laboratory
#: notebook, and
#: a path in one of them is as often a URL, a path inside somebody else's
#: repository, or a scratch file that is uncommitted by construction as it is a
#: claim about this tree. MEASURED before it was declared, at b560014 and with
#: the predicate below already in place: over all 43 other `.md` files this
#: shape answers 430 TRUE and 29 FALSE, spread across twelve documents, and
#: most of those 29 are that category rather than staleness -- an
#: `archive.org/download/...` URL, `全唐诗/唐诗三百首.json` inside somebody
#: else's corpus, `latin-ocr/...txt` naming a file on GitHub,
#: `scratchpad/cellAJ/align_ocr.py` which doctrine 77 says can never be
#: committed. Over these three it is 117 TRUE and 0 FALSE, because these three
#: cite only this repository. A gate that opened at 29 red would be switched
#: off within the week (CI's own comment: a permanently-red gate is one people
#: learn to skip), so the RESULTS documents need a predicate that can tell a
#: repo path from a foreign one before they can join. `--prose` prints the
#: population this actually reads.
PROSE_DOCS = ("CLAUDE.md", "README.md", "quality/METHOD.md")

TRUE = "TRUE"
FALSE = "FALSE"
REFUSED = "REFUSED"

NO_SHAPE = "NO_SHAPE"
AMBIGUOUS_SCOPE = "AMBIGUOUS_SCOPE"
HISTORICAL = "HISTORICAL"
NO_INSTRUMENT = "NO_INSTRUMENT"
DISCHARGED = "DISCHARGED"
SHAPE_RAISED = "SHAPE_RAISED"

#: Statuses that assert the gap is still there, and statuses that assert it is
#: not. An absence-claim's verdict means opposite things under the two.
OPEN_ISH = ("OPEN", "PARTIAL", "BLOCKED")
SHUT_ISH = ("CLOSED", "WITHDRAWN")

#: Language name -> the `corpus/song/` filename prefix that stages it. Declared
#: rather than inferred: "Finnish" and `fin_` are related by a convention this
#: repo chose, and a checker that guessed the mapping from the first three
#: letters would read "Malay" as `mal_` and silently measure nothing.
LANG_PREFIX = {
    "english": "eng_", "persian": "fas_", "finnish": "fin_",
    "welsh": "cym_", "malay": "msa_", "sanskrit": "san_",
    "middle chinese": "ltc_", "chinese": "ltc_",
}

NUMWORD = {
    "one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6,
    "seven": 7, "eight": 8, "nine": 9, "ten": 10, "eleven": 11, "twelve": 12,
    "zero": 0, "no": 0,
}


_HEAD = None


def head_commit():
    """The commit every VOLATILE measurement below is pinned to.

    Pinned to a COMMIT and never to a date: the counters cell found that a
    commit-pinned number re-derives forever and a date-pinned one cannot be
    checked at all.
    """
    global _HEAD
    if _HEAD is not None:
        return _HEAD
    try:
        # STDERR IS CAPTURED, not left to leak (`MISSING.md` M-30). This is a
        # BEST-EFFORT probe -- the `except` below already answers "unknown" --
        # but it did not redirect stderr, so outside a checkout every run of
        # this module printed `fatal: not a git repository` to the process's
        # stderr while exiting perfectly normally. `mutate.run_test` reports
        # the tail of STDERR as a failing suite's cause, so that harmless line
        # became the stated reason for an unrelated failure and sent a reader
        # after a git problem that was not one.
        _HEAD = subprocess.run(["git", "-C", ROOT, "rev-parse", "--short", "HEAD"],
                               stdout=subprocess.PIPE,
                               stderr=subprocess.DEVNULL, text=True,
                               timeout=30).stdout.strip() or "unknown"
    except Exception:                                            # noqa: BLE001
        _HEAD = "unknown"
    return _HEAD


# ---------------------------------------------------------------------------
# 1. Reading the two registers into SEGMENTS
# ---------------------------------------------------------------------------


#: `~~old~~ **new**` is how both files correct themselves in place. The struck
#: run is the register's OWN record that a figure was wrong, so it is removed
#: before any shape sees the text: reporting `~~941~~` as a false claim would
#: fail an entry for having been fixed.
STRIKE = re.compile(r"~~.*?~~", re.S)


def _unstrike(text):
    """Remove struck runs WITHOUT moving any line.

    A multi-line `~~...~~` replaced by one space shortens the file, and every
    line number after it is then wrong -- which silently broke the join to
    `counters.missing_entry_statuses()`, so every MISSING.md entry came back
    with `status None`. The newlines inside a struck run are preserved.
    """
    return STRIKE.sub(lambda m: "\n" * m.group(0).count("\n"), text)

#: A `**Was:**` clause opens a statement about a past state. Same treatment as a
#: struck run, but it is kept and REFUSED rather than deleted, because unlike a
#: strikethrough it is not self-evidently superseded.
WAS = re.compile(r"^\*\*Was[:,]?\*\*|^\*\*Was\b", re.I)

MD_ID = re.compile(r"^#{3,4}\s+([A-Z]-\d+[a-z]?|\d+\.\d+)\s*[·.]?\s*(.*)$")


class Entry:
    """One `### ` block of MISSING.md or BACKLOG.md."""

    def __init__(self, source, ident, heading, status, lineno, body):
        self.source = source
        self.id = ident
        self.heading = heading
        self.status = status
        self.lineno = lineno
        self.body = body
        self.segments = []

    def __repr__(self):
        return "<%s %s %s>" % (self.source, self.id, self.status)


class Segment:
    """One sentence-sized unit of an entry, and the unit ASKED is counted in.

    `historical` is set when the segment sits under a `**Was:**` opener. The
    heading of an entry is itself a segment -- M-6's false symbol claim is in
    the body but §2.7's stale count is a heading away from being one, and a
    checker that skipped headings would have missed half the class.
    """

    def __init__(self, entry, text, lineno, historical=False, kind="prose",
                 table_header=""):
        self.entry = entry
        self.text = text
        self.lineno = lineno
        self.historical = historical
        self.kind = kind
        #: For a `kind="table"` segment, the header row of the table it sits
        #: in — "" when the table has none. A row alone cannot say WHICH
        #: quantity a cell holds, so a shape that compares cells to named
        #: constants has to see the header, and re-opening the file to find it
        #: would give this module a second idea of where a table starts
        #: (`_md_blocks`'s own note about exactly that).
        self.table_header = table_header


BLOCK_START = re.compile(r"^\s*(?:[-*+]\s|\d+\.\s|\||>|#)")

#: Both registers open every field of an entry with a bold run -- `**Now:**`,
#: `**Missing:**`, `**Was:**`, `**Verified ...**`. That is a block boundary, and
#: not treating it as one let `**Was:**`'s HISTORICAL flag leak forward onto the
#: `**Now:**` sentence that CORRECTS it, which is the one segment in the entry
#: that must be checked.
BOLD_OPENER = re.compile(r"^\*\*[A-Z]")


def _split_sentences(block):
    """-> the sentences of one block. A period followed by whitespace and an
    opener starts a new one; `3.57%` and `f94383c` survive because neither has
    whitespace after the dot."""
    parts = re.split(r"(?<=[.!?])\s+(?=[A-Z0-9*`~\[(—-])", block.strip())
    return [p.strip() for p in parts if p.strip()]


def _segments_of(entry):
    """-> [Segment]. Blocks split on blank lines and on markdown block openers;
    a table row is one segment and is never sentence-split."""
    out = [Segment(entry, entry.heading, entry.lineno, kind="heading")]
    buf, buf_line, historical = [], entry.lineno, False
    lines = entry.body

    def flush():
        if buf:
            for s in _split_sentences(" ".join(buf)):
                out.append(Segment(entry, s, buf_line, historical))
        buf.clear()

    quoted_before = False
    #: The header is the row BEFORE the `|---|` separator, so it is only known
    #: one row late — which is why it is remembered rather than looked ahead
    #: for. `header` is cleared when the table ends, so a row can never inherit
    #: the header of a table above it.
    header, prev_row = "", ""
    for off, raw in lines:
        ln = raw.strip()
        # A `>` blockquote is where both registers put their CORRECTIONS -- the
        # M-11 denominator table, §1.4's clique re-derivation, §4.5's 102.
        # Leaving the marker on made every quoted table row invisible to the
        # table shapes, so the marker is stripped and the quote boundary is
        # kept as a block boundary instead.
        quoted = ln.startswith(">")
        while ln.startswith(">"):
            ln = ln[1:].strip()
        if quoted != quoted_before:
            flush()
        quoted_before = quoted
        if not ln.startswith("|"):
            # Anything that is not a table row ENDS the table, blank lines
            # included, so a row can never inherit the header of a table
            # above it.
            header, prev_row = "", ""
        if not ln:
            flush()
            historical = False
            continue
        if ln.startswith("|"):
            flush()
            # A separator row is dashes, colons, pipes and spaces AND has at
            # least one dash: `| | |` is a blank DATA row and reading it as a
            # separator would hand the next rows the wrong header.
            if "-" in ln and set(ln) <= set("|-: "):
                header = prev_row          # the row above a separator
            else:
                out.append(Segment(entry, ln, off, kind="table",
                                   table_header=header))
            prev_row = ln
            continue
        if BLOCK_START.match(ln) or BOLD_OPENER.match(ln) or WAS.search(ln):
            flush()
            historical = bool(WAS.search(ln))
        if not buf:
            buf_line = off
        buf.append(ln)
    flush()
    return out


def read_entries():
    """-> [Entry] over both registers.

    MISSING.md's statuses come from `counters.missing_entry_statuses()`, keyed
    by line number so the two reads cannot drift. BACKLOG.md has no status
    vocabulary of its own -- its sections carry `DONE`/`CLOSED`/`OPEN` tokens
    ad hoc and a `M-n` cross-reference -- so its status is read here and its
    AGREEMENT with MISSING.md's is one of the declared shapes below.
    """
    entries = []
    status_by_line = {ln: st for _, ln, st in missing_entry_statuses()}

    for path, source in ((MISSING_MD, "MISSING.md"), (BACKLOG_MD, "BACKLOG.md")):
        raw = open(path, encoding="utf-8").read()
        clean = _unstrike(raw)
        lines = clean.split("\n")
        starts = [i for i, l in enumerate(lines) if l.startswith("### ")]
        # An entry ends at the next `### ` OR at the next `## ` section head,
        # whichever comes first. Without the second bound BACKLOG.md's whole
        # TIER 5 section and its counters table fell inside §4.5, so a table
        # `quality/counters.py` already owns was being read as §4.5's claims --
        # two instruments checking one table is the shape this cell exists to
        # remove, one level up.
        sections = [i for i, l in enumerate(lines) if l.startswith("## ")]
        for k, i in enumerate(starts):
            end = starts[k + 1] if k + 1 < len(starts) else len(lines)
            nxt = [s2 for s2 in sections if s2 > i]
            if nxt:
                end = min(end, nxt[0])
            heading = lines[i]
            m = MD_ID.match(heading)
            ident = m.group(1) if m else heading[4:24]
            status = (status_by_line.get(i + 1) if source == "MISSING.md"
                      else _backlog_status(heading))
            body = [(j + 1, lines[j]) for j in range(i + 1, end)]
            e = Entry(source, ident, heading, status, i + 1, body)
            e.segments = _segments_of(e)
            entries.append(e)
    return entries


BACKLOG_STATUS = re.compile(r"`(DONE|CLOSED|DECIDED|BUILT|OPEN|PARTIAL|BLOCKED|"
                            r"WITHDRAWN)\b[^`]*`")


def _backlog_status(heading):
    m = BACKLOG_STATUS.search(heading)
    return m.group(1) if m else None


def read_prose(docs=None):
    """-> ([Entry], [(rel, reason)]) over `docs`, one Entry per document.

    Defaults to `PROSE_SCOPE` — every document ANY shape is asked over, derived
    from the per-shape scopes rather than retyped beside them.

    THE SAME BLOCK RULE, REUSED AND NOT RE-INVENTED. A prose document has no
    `### ` entries -- CLAUDE.md and README.md have none at all -- so there is
    nothing here to key on but the block boundaries, and those are exactly
    what `_segments_of` already computes. It is called with a whole file as
    one Entry's body rather than given a second implementation, for the reason
    `_md_blocks` states about itself: this file gets one idea of what a block
    is, or the two drift and the drift is the defect the file exists to catch.

    `_unstrike` FIRST, and it is load-bearing here in a way it is not on the
    registers. All three documents correct themselves in place with `~~old~~`
    runs, and CLAUDE.md does it constantly -- a struck path is the record's
    OWN statement that a claim was withdrawn, and reporting one as stale would
    fail a document for having been fixed.

    A DOCUMENT THAT CANNOT BE READ IS RETURNED AS A REASON, NEVER SKIPPED.
    Dropping it would let this whole check go quiet by a typo in `PROSE_DOCS`
    or a renamed file, and print a clean result over documents it never
    opened -- doctrine 20, and the same refusal `pin_moves()` makes about a
    depth-1 checkout.
    """
    docs = PROSE_SCOPE if docs is None else docs
    entries, refused = [], []
    for rel in docs:
        try:
            raw = open(os.path.join(ROOT, rel), encoding="utf-8").read()
        except OSError as exc:
            refused.append((rel, "%s: %s" % (type(exc).__name__, exc)))
            continue
        entries.append(prose_entry(rel, raw))
    return entries, refused


def prose_entry(rel, raw):
    """-> one Entry carrying a whole document's segments. PURE: no disk.

    Kept free of I/O for the reason `pin_verdict` is: the positive control
    below drives this with a synthetic document and proves the reader can
    still produce a FALSE, and a control that needed a real document in the
    repository to be stale could only ever run once -- it would expire the
    moment somebody fixed the staleness, which is precisely when the control
    is most needed. The `HASATTR` repin note at `POSITIVE_CONTROLS` is the
    same lesson learned on a shape.
    """
    lines = _unstrike(raw).split("\n")
    e = Entry(rel, rel, "", None, 1,
              [(j + 1, lines[j]) for j in range(len(lines))])
    # The synthetic heading is empty, so `_segments_of`'s heading segment
    # carries no text and is dropped rather than counted as an asked claim.
    e.segments = [s for s in _segments_of(e) if s.text.strip()]
    return e


# ---------------------------------------------------------------------------
# 2. The instruments the shapes call
# ---------------------------------------------------------------------------


_PY_INDEX = None


def py_index():
    """-> {basename: [relpath, ...]} over every .py in the repo."""
    global _PY_INDEX
    if _PY_INDEX is None:
        idx = collections.defaultdict(list)
        for dp, dns, fns in os.walk(ROOT):
            dns[:] = [d for d in dns if d not in {".git", "__pycache__"}]
            for f in fns:
                if f.endswith(".py"):
                    idx[f].append(os.path.relpath(os.path.join(dp, f), ROOT))
        _PY_INDEX = dict(idx)
    return _PY_INDEX


_SYMS = {}


def symbols_of(relpath):
    """-> every name a module BINDS: top-level defs, classes, assignments, and
    every method of every class in it.

    AST rather than grep. `def rhymes(` would have found M-6's symbol too, but
    it would also find it inside a docstring or a comment saying there is no
    `rhymes()`, and an instrument that a sentence about itself can flip is not
    an instrument.
    """
    if relpath in _SYMS:
        return _SYMS[relpath]
    try:
        tree = ast.parse(open(os.path.join(ROOT, relpath), encoding="utf-8").read())
    except (OSError, SyntaxError):
        _SYMS[relpath] = None
        return None
    names = set()

    def bind(node, prefix=""):
        for n in node.body:
            if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef)):
                names.add(prefix + n.name)
            elif isinstance(n, ast.ClassDef):
                names.add(prefix + n.name)
                bind(n, "")            # methods land in the module's namespace
            elif isinstance(n, ast.Assign):
                for t in n.targets:
                    if isinstance(t, ast.Name):
                        names.add(prefix + t.id)
            elif isinstance(n, ast.AnnAssign) and isinstance(n.target, ast.Name):
                names.add(prefix + n.target.id)
    bind(tree)
    _SYMS[relpath] = names
    return names


def resolve_module(token):
    """-> relpath for `fin.py` / `fin` / `quality/phonology/fin.py`, or None."""
    token = token.strip().strip("`")
    if "/" in token:
        return token if os.path.exists(os.path.join(ROOT, token)) else None
    base = token if token.endswith(".py") else token + ".py"
    hits = py_index().get(base, [])
    if len(hits) == 1:
        return hits[0]
    if len(hits) > 1:                    # prefer quality/ over a fixture copy
        pref = [h for h in hits if not h.startswith("examples/")]
        return pref[0] if len(pref) == 1 else None
    return None


def song_files(prefix=""):
    return sorted(glob.glob(os.path.join(SONG_DIR, prefix + "*.txt")))


def count_marker(marker, prefix=""):
    n = 0
    for f in song_files(prefix):
        with open(f, encoding="utf-8", errors="replace") as fh:
            for line in fh:
                if line.startswith(marker):
                    n += 1
    return n


# ---------------------------------------------------------------------------
# 3. THE DECLARED SHAPES
#
# Each shape is (name, volatile, docstring, fn). `fn(segment)` returns None if
# the shape does not recognise the segment at all, else a `Verdict`. Adding a
# shape is how the refused count comes down; loosening one is not.
# ---------------------------------------------------------------------------


class Verdict:
    def __init__(self, shape, status, claim, measured, kind=None, note=""):
        self.shape = shape
        self.status = status          # TRUE / FALSE / REFUSED
        self.claim = claim            # what the entry asserts, in short
        self.measured = measured      # what the repo says
        self.kind = kind              # refusal kind, when REFUSED
        self.note = note


def _entry_modules(seg):
    """-> the distinct .py paths a segment names, else the ones its entry's
    HEADING names. Body-wide fallback is deliberately absent: M-6's body names
    `fin` and `F-1`, and widening the search until something matches is how a
    scope gets guessed."""
    here = re.findall(r"`([\w./-]+\.py)`", seg.text)
    if here:
        return sorted(set(here))
    return sorted(set(re.findall(r"`([\w./-]+\.py)`", seg.entry.heading)))


# --- shape 1: SYMBOL_ABSENT ------------------------------------------------

SYMBOL_ABSENT_RE = re.compile(
    r"\b(?:no|No|NO|nothing|Nothing|none|zero|ZERO|lacks?|without|"
    r"does not (?:have|define|expose)|has no|have no|carries no|exposes no)\b"
    r"[^.\n]{0,60}?`([A-Za-z_][\w.]*)\(\)`")


def shape_symbol_absent(seg):
    """`No \\`rhymes()\\`` -- an absence-of-callable claim.

    The `()` is REQUIRED. `no \\`__main__\\`` and `no \\`--- AIR:\\` field` are
    absence claims too and they are not callables; letting the shape take a
    bare backticked token would drag every marker, flag and filename in the
    register into a symbol lookup that cannot answer them.

    The module is the one the SEGMENT names, else the one its HEADING names.
    Exactly one, or the shape refuses for AMBIGUOUS_SCOPE -- a bare `rhymes()`
    is a claim about a namespace nobody wrote down (doctrine 58), and guessing
    which module was meant is how a checker manufactures a confirmation.
    """
    m = SYMBOL_ABSENT_RE.search(seg.text)
    if not m:
        return None
    sym = m.group(1)
    mods = _entry_modules(seg)
    if "." in sym:                       # `fas.rhymes()` names its own module
        head, sym = sym.rsplit(".", 1)
        mods = [head]
    if len(mods) != 1:
        return Verdict("SYMBOL_ABSENT", REFUSED, "no `%s()`" % sym,
                       "the segment names %d modules" % len(mods),
                       AMBIGUOUS_SCOPE,
                       "name the module in the same sentence as the symbol")
    rel = resolve_module(mods[0])
    if rel is None:
        return Verdict("SYMBOL_ABSENT", REFUSED, "no `%s()` in `%s`" % (sym, mods[0]),
                       "`%s` does not resolve to one file" % mods[0], NO_INSTRUMENT)
    names = symbols_of(rel)
    if names is None:
        return Verdict("SYMBOL_ABSENT", REFUSED, "no `%s()` in `%s`" % (sym, rel),
                       "%s did not parse" % rel, NO_INSTRUMENT)
    if sym in names:
        return Verdict("SYMBOL_ABSENT", FALSE, "no `%s()` in `%s`" % (sym, mods[0]),
                       "%s DEFINES %s" % (rel, sym))
    return Verdict("SYMBOL_ABSENT", TRUE, "no `%s()` in `%s`" % (sym, mods[0]),
                   "%s does not define %s" % (rel, sym))


# --- shape 2: HASATTR ------------------------------------------------------

HASATTR_RE = re.compile(r"`hasattr\((\w+),\s*[\"'](\w+)[\"']\)`\s*is\s*`?(True|False)`?")


def shape_hasattr(seg):
    """`` `hasattr(cym, "readability_census")` is False `` -- the register
    occasionally writes its own assertion in Python. Where it does, the check is
    exact and the polarity is stated rather than inferred, which is the whole
    reason this shape is separate from SYMBOL_ABSENT: everywhere else, negation
    has to be read out of English and this file will not do that.
    """
    m = HASATTR_RE.search(seg.text)
    if not m:
        return None
    mod, attr, claimed = m.group(1), m.group(2), m.group(3) == "True"
    rel = resolve_module(mod)
    if rel is None:
        return Verdict("HASATTR", REFUSED, "hasattr(%s, %s) is %s" % (mod, attr, claimed),
                       "`%s` does not resolve to one module" % mod, NO_INSTRUMENT)
    names = symbols_of(rel)
    if names is None:
        return Verdict("HASATTR", REFUSED, "hasattr(%s, %s)" % (mod, attr),
                       "%s did not parse" % rel, NO_INSTRUMENT)
    actual = attr in names
    return Verdict("HASATTR", TRUE if actual == claimed else FALSE,
                   "hasattr(%s, %r) is %s" % (mod, attr, claimed),
                   "%s: %s" % (rel, actual))


# --- shape 3: REPO_PATH_EXISTS --------------------------------------------

#: `yml` and `js` JOINED 2026-08-24 with the two-root resolution below. They
#: were absent for no recorded reason and their absence was silent: every
#: `.github/workflows/ci.yml` and `mcp/*.js` citation in this register went
#: UNCHECKED while looking exactly like a checked one (doctrine 20).
PATH_RE = re.compile(
    r"`([\w.-]+/[\w./-]+\.(?:py|md|tsv|txt|json|yml|yaml|js|mjs|sh))`")

#: The ONLY phrases that flip this shape's polarity. Declared as a closed list,
#: exactly like `HASATTR`'s stated `is True` / `is False`, because reading
#: negation out of English in general is the guess this file will not make. A
#: path followed by one of these within ABSENCE_WINDOW characters is being
#: asserted ABSENT and is checked that way; anything else is a claim of
#: presence. M-3 is the case that forced it: the entry now says, correctly,
#: that `scratch/src_msa/extract_pantun.py` is not in the repository, and a
#: presence-only rule called that true sentence FALSE.
PATH_ABSENT_PHRASES = (
    "is not in the repository", "are not in the repository",
    "is not in this repository", "which is NOT in this repository",
    "is not on disk", "does not exist", "was never in the repository",
    "never was", "no longer exists", "has been deleted", "was deleted",
)
ABSENCE_WINDOW = 120


def _absence_window(low, end):
    """-> the span after a path in which an absence phrase BINDS TO THAT PATH.

    TRUNCATED AT THE NEXT BACKTICK, and that clause is the whole of the rule.
    A window of N characters is subject-blind: it will read a phrase about
    whatever the sentence talks about NEXT as though it were about the path.
    CLAUDE.md is the case that forced it --

        `quality/RESULTS_NULL_SHAPES.md`, `quality/NULL_AUDIT.md` §1.1, and
        METHOD § The sonnet battery for why `verse.txt` was deleted.

    -- where "was deleted" is true of `verse.txt` and of nothing else in the
    sentence. Both `.md` files exist, both were read as asserted ABSENT, and
    the shape called a correct sentence FALSE twice. `verse.txt` is invisible
    to `PATH_RE` on purpose (no `/`, doctrine 34's deleted file, cited
    historically), so the phrase it belongs to had no owner and drifted to the
    nearest path that would take it.

    A backtick is the right boundary because it is where this repo changes
    subject: every path, symbol and marker in both registers and all three
    prose documents is written inside one. The rule is POSITIONAL and reads no
    English, which is the same standing `PATH_ABSENT_PHRASES` has -- a closed
    list rather than a negation parser.

    IT COSTS NOTHING ON THE LIVE REGISTERS, measured rather than assumed:
    across every segment of MISSING.md and BACKLOG.md exactly one absence
    claim is asserted at all (M-3's `scratch/src_msa/extract_pantun.py`, which
    states its phrase with no intervening backtick), and no segment's
    absent-set changes under this rule. It removes two false positives and
    moves no true one.
    """
    window = low[end:end + ABSENCE_WINDOW]
    cut = window.find("`")
    return window if cut < 0 else window[:cut]


def shape_repo_path(seg):
    """A backticked repo PATH -- `quality/phonology/fin.py` -- must exist,
    unless the sentence says in so many words that it does not.

    Only paths with a `/` in them. A bare `verse.txt` is a filename the register
    cites historically (it was deleted on purpose, doctrine 34) and demanding it
    exist would fail the entry that records its deletion; a stated repo path is
    a claim about the tree as it is now.

    This is the shape that catches an entry citing its own authority into thin
    air: M-3 named `scratch/src_msa/extract_pantun.py` as the implementation of
    its selection rule, and scratch is namespaced per cell and never committed
    (doctrine 77), so the rule's stated authority was unreachable by anyone.
    """
    hits = sorted(set(PATH_RE.findall(seg.text)))
    if not hits:
        return None
    if seg.historical:
        return Verdict("REPO_PATH_EXISTS", REFUSED, ", ".join(hits),
                       "a `**Was:**` clause", HISTORICAL)
    low = seg.text.lower()
    asserted_absent = set()
    for m in PATH_RE.finditer(seg.text):
        window = _absence_window(low, m.end())
        if any(ph.lower() in window for ph in PATH_ABSENT_PHRASES):
            asserted_absent.add(m.group(1))
    # TWO ROOTS, AND THE SECOND ONE IS NOT A LOOSENING. `ROOT` is the
    # harness; MISSING.md legitimately cites files in SIBLING directories of
    # it -- `.github/workflows/ci.yml`, `mcp/lyric_tools.js`,
    # `.claude/settings.json` -- because the register describes the whole
    # repository and not only this subtree. Resolving against the harness
    # alone made every such citation either INVISIBLE (PATH_RE's extension
    # list happens to omit .yml and .js, so those were never checked at all)
    # or FALSE (M-97's `.claude/settings.json` is the first .json outside the
    # harness, and it is on disk). Found 2026-08-24 by that entry going red
    # for existing in the wrong directory.
    #
    # A path present at NEITHER root is still FALSE, so this widens what can
    # be CHECKED without widening what can PASS.
    roots = [ROOT, os.path.dirname(ROOT)]
    present = [h for h in hits
               if any(os.path.exists(os.path.join(r, h)) for r in roots)]
    wrong = [h for h in hits
             if (h in present) is (h in asserted_absent)]
    if wrong:
        return Verdict("REPO_PATH_EXISTS", FALSE, ", ".join(wrong),
                       "; ".join("%s: on disk=%s, the entry asserts %s"
                                 % (h, h in present,
                                    "ABSENT" if h in asserted_absent
                                    else "present")
                                 for h in wrong)
                       + " (at %s)" % head_commit())
    return Verdict("REPO_PATH_EXISTS", TRUE, ", ".join(hits),
                   "%d present, %d asserted absent and absent"
                   % (len(present), len(asserted_absent)))


# --- shape 4: STAGED_FILE_COUNT (VOLATILE) --------------------------------

#: THE NUMBER MAY BE COMMA-GROUPED, AND UNTIL 2026-08-21 IT COULD NOT BE.
#: `\d+` after a `\b` reads "1,297 English files" as **297** -- the word
#: boundary sits inside the comma, so the thousands digit is silently dropped.
#: That was found when a repinned entry saying 1,297 was reported FALSE against
#: a measured 1,297, and it is the less dangerous half of the bug: the same
#: misread turns a TRUE verdict out of a stale "1,143 English files" the moment
#: the real count reaches 143. A shape that can pass for the wrong reason is
#: doctrine 48's subject, and this one could do it in both directions.
#: House style in this repo groups thousands, so every corpus claim written
#: after the load was invisible to this check.
_NUM = (r"\d{1,3}(?:,\d{3})+|\d+|one|two|three|four|five|six|seven|eight|"
        r"nine|ten|eleven|twelve")
_LANG = (r"English|Persian|Finnish|Welsh|Malay|Sanskrit|Middle Chinese|Chinese")
STAGED_RE = re.compile(
    r"\b(" + _NUM + r")\s+"
    r"(?:of\s+the\s+)?(?:staged\s+)?(" + _LANG + r")\s+(?:files|texts)\b",
    re.I)
STAGED_RE2 = re.compile(
    r"\bthe\s+(" + _NUM + r")\s+staged\s+(" + _LANG + r")\s+files\b", re.I)


def shape_staged_file_count(seg):
    """"the ten staged Finnish files" -- a count of `corpus/song/<prefix>_*`.

    VOLATILE. A corpus cell is live in `corpus/song/` right now, so this is
    MEASURED at run time and the measurement is printed with the commit it was
    taken at. The remedy for a FALSE verdict here is NOT to write the new
    number into the entry -- that is the same defect with a fresher integer
    (the `258` lesson in `counters.py`). It is to say what is measured and name
    the command, exactly as the volatile counters do.

    The word `staged` or the word `files` next to a language name is required.
    "all 30 files" in M-13 is a count of `data/sources.tsv` ROWS wearing the
    word "files", so it does not trigger, and it must not: a shape that
    stretched to reach it would answer a question the entry never asked.
    """
    m = STAGED_RE2.search(seg.text) or STAGED_RE.search(seg.text)
    if not m:
        return None
    tok, lang = m.group(1).lower(), m.group(2).lower()
    claimed = NUMWORD.get(tok, None)
    if claimed is None:
        claimed = int(tok.replace(",", ""))
    prefix = LANG_PREFIX[lang]
    actual = len(song_files(prefix))
    return Verdict("STAGED_FILE_COUNT", TRUE if claimed == actual else FALSE,
                   "%d staged %s files" % (claimed, m.group(2)),
                   "MEASURED %d `%s*` at %s" % (actual, prefix, head_commit()),
                   note="VOLATILE — corpus/song/ is being written by another cell")


# --- shape 5: MODULE_LINE_COUNT -------------------------------------------

LINES_RE = re.compile(r"\*{0,2}([\d,]{3,})\*{0,2}\s+(?:stranded\s+)?lines\b")


def shape_module_line_count(seg):
    """"`quality/g2p.py` -- 1,234 lines". Checked with `wc -l` semantics.

    The example is deliberately not the module §4.4 is about: `audit_register.py`
    D22 finds that module's callers by TEXT SEARCH, so naming it in a docstring
    here made this file report as one of them. That is `verify_doctrines.py`'s
    self-exclusion trap in a new costume -- an instrument placed inside the
    population it measures becomes part of it.

    ADJACENCY, not co-occurrence, and the difference is a false positive this
    shape actually produced. K-1 says "the corpus LOST 819 lines and the
    unreadable RATE went UP -- 5.2677% -> 5.2873% (`quality/test_readability.py`)".
    A rule of "one `.py` anywhere in the sentence" read that as a claim that the
    TEST FILE is 819 lines and called a true sentence false. So the module must
    sit within ADJACENCY characters of the count; §4.4 and M-16 both write them
    touching, and K-1 writes them sixty characters apart across a rate.

    Two modules inside the window is AMBIGUOUS_SCOPE, not a nearest-wins guess.
    """
    m = LINES_RE.search(seg.text)
    if not m:
        return None
    ADJACENCY = 40
    lo, hi = m.start(), m.end()
    here = sorted({p.group(1) for p in re.finditer(r"`([\w./-]+\.py)`", seg.text)
                   if p.start() < hi + ADJACENCY and p.end() > lo - ADJACENCY})
    if not here:
        return None          # "3,415 lines" of Malay verse is not a module
    if len(here) != 1:
        return Verdict("MODULE_LINE_COUNT", REFUSED, "%s lines" % m.group(1),
                       "%d modules within %d characters of the count"
                       % (len(here), ADJACENCY),
                       AMBIGUOUS_SCOPE,
                       "put the line count beside exactly one module name")
    rel = resolve_module(here[0])
    if rel is None:
        return Verdict("MODULE_LINE_COUNT", REFUSED, "%s lines" % m.group(1),
                       "`%s` does not resolve" % here[0], NO_INSTRUMENT)
    n = len(open(os.path.join(ROOT, rel), encoding="utf-8").read().splitlines())
    claimed = int(m.group(1).replace(",", ""))
    return Verdict("MODULE_LINE_COUNT", TRUE if claimed == n else FALSE,
                   "%s is %d lines" % (here[0], claimed),
                   "MEASURED %d lines in %s at %s" % (n, rel, head_commit()))


# --- shape 6: CORPUS_MARKER_ABSENT (VOLATILE) -----------------------------

MARKER_RE = re.compile(r"\b(?:no|No|zero|ZERO)\b[^.\n]{0,40}?"
                       r"`(--- [A-Z_]+:)`[^.\n]{0,60}?(?:marker|field)")


def shape_marker_absent(seg):
    """``no `--- AIR:` field`` -- a claim that a corpus HEADER MARKER is not in
    use anywhere under `corpus/song/`. VOLATILE, measured at run time.

    This is the shape behind M-11's headline: the `0` is the finding and it
    does not depend on the denominator, so it is checkable even while the
    denominator moves under the checker.
    """
    m = MARKER_RE.search(seg.text)
    if not m:
        return None
    marker = m.group(1)
    n = count_marker(marker)
    return Verdict("CORPUS_MARKER_ABSENT", TRUE if n == 0 else FALSE,
                   "no `%s` in corpus/song/" % marker,
                   "MEASURED %d occurrences at %s" % (n, head_commit()),
                   note="VOLATILE — corpus/song/ is being written by another cell")


# --- shape 7: CORPUS_TABLE_ROW (VOLATILE) ---------------------------------

TABLE_ROW_RE = re.compile(r"^\|\s*`(\w+_)`\s*\|\s*([\w ]+?)\s*\|\s*\**([\d,]+)\**\s*\|")

#: The header cell that names the column this shape is about. Read rather than
#: assumed, because the positional rule below is only correct for a two-column
#: table and cannot tell when it is not looking at one.
TABLE_SONGS_HEAD = re.compile(r"\bsongs?\b", re.I)


def _cells(row):
    """-> a markdown row's cells. Shared by `CORPUS_TABLE_ROW` and
    `FLOOR_THRESHOLD`, which each defined it identically until 2026-08-21 --
    the second definition silently shadowed the first."""
    return [c.strip() for c in row.strip().strip("|").split("|")]


def shape_corpus_table_row(seg):
    """A table row `| \\`fin_\\` | Finnish | 962 |` -- songs staged under one
    prefix, where a song is a `--- TITLE:` line (K-1's own stated rule, which
    `audit_register.py` D1 also uses).

    VOLATILE, and this is the shape most likely to fail on a corpus cell's
    commit rather than on a real error, which is why its verdict prints the
    commit it was measured at and the entry it belongs to is expected to pin
    the same way.

    THE COLUMN IS FOUND BY ITS HEADER, and that repair is from 2026-08-21.
    `TABLE_ROW_RE` reads the THIRD cell, on the assumption that the second one
    holds a language NAME -- and `[\\w ]+?` matches digits, so a table whose
    second column is a number shifted the whole read one cell right in silence.
    M-11's four-column airs table found it: `| \\`cym_\\` | 391 | 13 | 0 |` was
    reported as claiming 13 songs under `cym_`, and the entry was marked FALSE
    for a figure it never asserted. When the table carries a header naming a
    `songs` column, that column is used; a header with none means this row is
    not making the claim this shape checks, and it is passed over rather than
    guessed at.
    """
    m = TABLE_ROW_RE.match(seg.text.strip())
    if not m:
        return None
    prefix, claimed = m.group(1), int(m.group(3).replace(",", ""))
    head = getattr(seg, "table_header", "") or ""
    if head:
        hs = _cells(head)
        idx = [i for i, c in enumerate(hs) if TABLE_SONGS_HEAD.search(c)]
        if not idx:
            return None
        row = _cells(seg.text)
        if idx[0] >= len(row):
            return None
        got = re.search(r"([\d,]+)", row[idx[0]])
        if not got:
            return None
        claimed = int(got.group(1).replace(",", ""))
    if not song_files(prefix):
        return Verdict("CORPUS_TABLE_ROW", REFUSED, "%s = %d" % (prefix, claimed),
                       "no `corpus/song/%s*` files", NO_INSTRUMENT)
    n = count_marker("--- TITLE:", prefix)
    return Verdict("CORPUS_TABLE_ROW", TRUE if n == claimed else FALSE,
                   "`%s` = %s songs" % (prefix, "{:,}".format(claimed)),
                   "MEASURED %s `--- TITLE:` lines at %s"
                   % ("{:,}".format(n), head_commit()),
                   note="VOLATILE — corpus/song/ is being written by another cell")


# --- shape 9: SCRATCH_NAMESPACED (doctrine 77) ----------------------------

#: A scratch citation, whichever of the two roots this repo has used. Not
#: `PATH_RE`: that one requires a known extension, so it cannot see
#: `scratchpad/cellAJ/` (a directory) at all, and it asks a different question
#: anyway -- does the path EXIST. Scratch is uncommitted by construction, so
#: existence is the one thing that can never be checked about it.
SCRATCH_RE = re.compile(r"`(scratchpad|scratch)/([\w./-]*)`")


def shape_scratch_namespaced(seg):
    """``scratch/src_msa/extract_pantun.py`` -- a cited working file must sit
    under a per-cell subdirectory of the scratchpad, never directly in it.

    Doctrine 77, and it is the cheapest check in this file: the British
    sourcing cell lost ~30 fetches mid-run because a sibling overwrote its
    `fetch.sh` and clobbered `scratchpad/raw/`. Only uniquely named
    deliverables were safe.

    THE RULE IS POSITIONAL, and that is the whole of it: count the segments
    after the scratch root. Two or more -- `scratchpad/cellAJ/measure_ocr.py`
    -- and the file is inside somebody's namespace. Exactly one and the
    citation ends in `/` -- `scratchpad/cellAJ/` -- and it IS a namespace
    declaration. Exactly one with no slash -- `scratchpad/fetch.sh` -- and the
    citation names a file every parallel cell can write, which is the defect.

    It deliberately does NOT judge whether the namespace is a good one.
    `raw` and `cellAJ` are the same shape to a checker, and the difference
    between them is a convention no regex can read; guessing it is the move
    this file exists to refuse. What is mechanical is that there IS one.

    `REPO_PATH_EXISTS` runs on the same segment and is not made redundant:
    M-3 cites `scratch/src_msa/extract_pantun.py` as ABSENT and correctly, so
    that shape reads the sentence's absence phrase and this one reads the
    path's shape. Two questions, two verdicts, one segment (doctrine 79).
    """
    hits = SCRATCH_RE.findall(seg.text)
    if not hits:
        return None
    if seg.historical:
        return Verdict("SCRATCH_NAMESPACED", REFUSED,
                       ", ".join("%s/%s" % h for h in hits),
                       "a `**Was:**` clause", HISTORICAL)
    bare = []
    for root, rest in hits:
        parts = [p for p in rest.split("/") if p]
        if len(parts) >= 2:
            continue
        if len(parts) == 1 and rest.endswith("/"):
            continue                       # the namespace itself, declared
        bare.append("%s/%s" % (root, rest))
    if bare:
        return Verdict("SCRATCH_NAMESPACED", FALSE,
                       ", ".join("%s/%s" % h for h in hits),
                       "%s sits directly in the shared scratchpad; a sibling "
                       "cell writing the same name clobbers it (doctrine 77)"
                       % ", ".join("`%s`" % b for b in bare))
    return Verdict("SCRATCH_NAMESPACED", TRUE,
                   ", ".join("%s/%s" % h for h in hits),
                   "%d scratch citation(s), each under a cell namespace"
                   % len(hits))


# --- shape 8: STATUS_XREF -------------------------------------------------

XREF_RE = re.compile(r"`([A-Z]-\d+[a-z]?)(?:,\s*(OPEN|CLOSED|PARTIAL))?`")

#: A BACKLOG entry declaring that its TASK is finished while the MISSING half's
#: CAPABILITY is not. Anchored on the id so the declaration cannot cover a
#: citation it does not name -- an entry citing `K-1, K-3` must discharge each
#: separately or not at all.
DISCHARGED_RE = re.compile(
    r"TASK (?:IS )?DISCHARGED\b[^\n]{0,90}?`?\b([A-Z]-\d+[a-z]?)`?\s+STAYS\s+OPEN",
    re.I)

#: How much prose the entry must carry after the declaration for it to count.
#: A bare marker is a green light with no reason attached, and the whole value
#: of this refusal is that a reader can be handed the list of discharged-but-
#: undelivered tasks WITH the argument for each.
DISCHARGE_REASON_CHARS = 120


def shape_status_xref(seg):
    """A BACKLOG.md heading cites a MISSING.md entry: `M-6`, `K-1, K-3`, `L-5`.

    Two things are asserted by such a citation and both are checkable: the id
    EXISTS, and the two files agree about whether it is done. `DONE`, `CLOSED`,
    `DECIDED` and `BUILT` in a BACKLOG heading are shut; MISSING's `CLOSED` and
    `WITHDRAWN` are shut; everything else is open.

    AND THERE IS A THIRD THING, WHICH THIS CHECK USED TO CALL A LIE.
    A BACKLOG entry is a TASK; a MISSING entry is a CAPABILITY. They come
    apart, legitimately and often: the task `measure whether the levers move
    alpha` is discharged by measuring that none of them do, and the capability
    `a false-event rate controlled at alpha` stays exactly as missing as it
    was. Requiring the two statuses to match forces the register to lie in one
    direction or the other -- and it HAD. BACKLOG 4.1 was left reading OPEN
    with `TASK DISCHARGED -- L-1 STAYS OPEN` written across its own heading,
    because saying so in prose was the only way to say it at all; and 2.4, 2.5
    and 3.1 were marked CLOSED against still-PARTIAL MISSING halves and this
    shape reported all three FALSE.

    So the declaration the register already wrote once is now READ (doctrine
    48: a principle is only real once it is mechanical). `TASK DISCHARGED --
    `M-4` STAYS OPEN`, plus `DISCHARGE_REASON_CHARS` characters of reason after
    it, turns that one citation's mismatch into a REFUSED/DISCHARGED rather
    than a FALSE.

    WHAT THE REFUSAL IS NOT is an exemption, and three things keep it honest:

      * it is ONE-DIRECTIONAL. A closed MISSING half under an open BACKLOG
        entry is still FALSE -- that is a stale register, not a discharge.
      * a declaration naming an id whose MISSING half is ALREADY SHUT is
        FALSE, not a pass: the entry is describing a state that has moved on.
      * every refusal PRINTS, with its reason, under its own kind. The point
        of the escape hatch is that the register can be asked *what has been
        discharged and not delivered* and answer with a list, which is a
        question it could not previously be asked at all (doctrine 20: an
        empty population reads like a pass, and this one is never empty).
    """
    if seg.kind != "heading" or seg.entry.source != "BACKLOG.md":
        return None
    ids = [m.group(1) for m in XREF_RE.finditer(seg.text)]
    if not ids:
        return None
    known = {e.id: e for e in _ALL_ENTRIES if e.source == "MISSING.md"}
    unknown = [i for i in ids if i not in known]
    if unknown:
        return Verdict("STATUS_XREF", FALSE, "cites %s" % ", ".join(ids),
                       "%s has no entry in MISSING.md" % ", ".join(unknown))
    here_shut = seg.entry.status in ("DONE", "CLOSED", "DECIDED", "BUILT")
    # `Entry.body` is a list of `(lineno, text)`, not a string -- reading it as
    # one raised TypeError on every heading this shape had been answering, and
    # the sweep filed all twelve crashes as refusals and printed PASS. That is
    # what `SHAPE_RAISED` and the live control below exist for now.
    whole = "\n".join([seg.entry.heading]
                      + [t for _ln, t in seg.entry.body])
    declared = {}
    for m in DISCHARGED_RE.finditer(whole):
        declared[m.group(1)] = len(whole) - m.end()
    stale = [i for i in declared
             if i in known and known[i].status in SHUT_ISH]
    if stale:
        return Verdict("STATUS_XREF", FALSE, "cites %s" % ", ".join(ids),
                       "declares %s discharged-and-still-open, but MISSING "
                       "reads %s"
                       % (", ".join(sorted(stale)),
                          ", ".join("%s %s" % (i, known[i].status)
                                    for i in sorted(stale))))
    bad, refused = [], []
    for i in ids:
        there_shut = known[i].status in SHUT_ISH
        if here_shut == there_shut:
            continue
        if here_shut and i in declared:
            if declared[i] < DISCHARGE_REASON_CHARS:
                bad.append("%s: declared discharged with no reason after it "
                           "(%d chars, %d wanted)"
                           % (i, declared[i], DISCHARGE_REASON_CHARS))
            else:
                refused.append("%s: BACKLOG %s / MISSING %s"
                               % (i, seg.entry.status, known[i].status))
            continue
        bad.append("%s: BACKLOG %s / MISSING %s"
                   % (i, seg.entry.status or "open", known[i].status))
    if bad:
        return Verdict("STATUS_XREF", FALSE, "cites %s" % ", ".join(ids),
                       "; ".join(bad))
    if refused:
        return Verdict("STATUS_XREF", REFUSED, "cites %s" % ", ".join(ids),
                       "; ".join(refused) + " — the TASK is discharged and "
                       "the CAPABILITY is not, declared in the entry",
                       DISCHARGED)
    return Verdict("STATUS_XREF", TRUE, "cites %s" % ", ".join(ids),
                   "every id exists and the two files agree")


# --- the 26 derivations another instrument already owns ---------------------

# --- shape 10: CAPACITY_FIGURE --------------------------------------------
#
# WHY A TENTH SHAPE. On 2026-08-21 the two tables the tier-2 MODAL ban reads
# were rebuilt, every certified witness in `data/rhyme_capacity_eng.tsv` had to
# be re-derived, and three per-family figures quoted in prose moved: AY-ER
# 28 -> 27, IY 37 -> 34, EH-R 33 -> 31. `capacity.py --check` did not catch
# them and COULD NOT: it re-derives the six `ADOPTED` headline constants, and
# not one of those moved. What moved were the numbers written out in sentences.
#
# Repinning them by hand was the fourth retyped number found stale that day,
# and a fresher literal is the same defect with a later date (doctrine 58). So
# the sentences are read and re-derived against the artifact instead. Doctrine
# 1: the table is where a per-family figure is defined, and prose quoting one
# is a second copy or it is nothing.

_CAPACITY_ROWS = None


def capacity_rows():
    """-> {family: row} from `data/rhyme_capacity_eng.tsv`, read once.

    THE ARTIFACT, NOT `capacity.ADOPTED`. ADOPTED holds six headline constants
    and `capacity.py --check` already re-derives those; the table is the only
    place a PER-FAMILY figure exists, and per-family is what prose quotes.

    No lexicon, no grader, no CMUdict: `read_table` parses a committed TSV.
    That is what keeps this a cheap shape runnable in the 0.05 CPU-s suite
    step instead of a derivation behind `--slow`.
    """
    global _CAPACITY_ROWS
    if _CAPACITY_ROWS is None:
        from quality import capacity as C
        _CAPACITY_ROWS = {r["family"]: r for r in C.read_table()}
    return _CAPACITY_ROWS


#: DIGITS ONLY, and not the shared `_NUM`. `_NUM` alternates in the spelled
#: numbers `one|two|...` with no word boundary, so a backward scan for "the
#: last number before `held by`" would find the `one` inside "not one" and
#: read a tie depth of 1. The spelled form is handled separately below,
#: where it is anchored to the word `famil...` and cannot drift.
_CAP_DIGITS = r"\d{1,3}(?:,\d{3})*"

_WORDNUM = {"one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6,
            "seven": 7, "eight": 8, "nine": 9, "ten": 10, "eleven": 11,
            "twelve": 12}

#: A family key is uppercase ARPABET joined by hyphens -- `AY-ER`,
#: `EY-T-IH-NG`, and the bare vowels `EY`, `IY`. The pattern is loose ON
#: PURPOSE, because it is not the filter: MEMBERSHIP IN THE ARTIFACT is. A
#: token that looks like a family and names none is not this shape's business,
#: and guessing at one would produce exactly the noise doctrine 61 warns about.
#: (Checked 2026-08-21: of the 12,387 keys, none collides with a common
#: uppercase English word, and the shortest are the 14 ARPABET vowels.)
_CAP_FAM = r"`?([A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*)`?"

#: `AY-ER (fire's family): 34 classes, certified 27`. The COLON binds a family
#: to its figures and the clause stops at the next `.` or `;`, so the following
#: family's numbers can never be read as this one's -- which matters because
#: this repo writes them in a row: "AY-ER ...: 34 classes, certified 27. IY:
#: attempts 40, certified 34."
CAP_CLAUSE_RE = re.compile(
    _CAP_FAM + r"(?:\s*\([^)]{0,60}\))?\s*:\s*([^.;]{0,90})")

#: "`capacity fire` prints the 27-word clique."
CAP_CLIQUE_RE = re.compile(
    r"`capacity\s+([a-z']+)`[^.]{0,70}?(?:\*\*)?(" + _CAP_DIGITS +
    r")(?:\*\*)?-word\s+clique")

CAP_HELD_RE = re.compile(r"held by\b", re.I)
CAP_COUNTWORD_RE = re.compile(
    r"\b(" + "|".join(sorted(_WORDNUM)) + r")\s+famil", re.I)


def _cap_attempts(row):
    """-> what "attempts N" claims: the certifier's own bound on this family.

    `CERTIFY_ATTEMPT_CAP` is a DECLARED CONSTRUCTION BOUND, not a property of
    the language, so a family deeper than the cap is attempted at the cap. A
    sentence saying "IY: attempts 40" is quoting the bound, and reading it as
    IY's 228 classes would call a true sentence false.
    """
    from quality import capacity as C
    return min(row["chain_hi"], C.CERTIFY_ATTEMPT_CAP)


#: (the word in the clause, its pattern, the artifact's answer).
CAP_FIELDS = (
    ("classes", re.compile(r"(" + _CAP_DIGITS + r")\s*(?:\*\*)?\s*classes"),
     lambda r: r["chain_hi"]),
    ("attempts", re.compile(r"attempts\s+(?:\*\*)?(" + _CAP_DIGITS + r")"),
     _cap_attempts),
    ("certified", re.compile(r"certified\s+(?:\*\*)?(" + _CAP_DIGITS + r")"),
     lambda r: r["chain_lo"]),
)


def shape_capacity_figure(seg):
    """A per-family capacity figure quoted in prose, re-derived from the
    committed artifact. Three claim kinds, each one a sentence this repo has
    actually written:

      `AY-ER (fire's family): 34 classes, certified 27`   chain_hi, chain_lo
      `IY: attempts 40, certified 34`                     the attempt bound
      "40 ... held by NINE families ... `AE-K`, `AE-N`"   the tie at a depth

    The tie is checked as a SET when the families are named and as a COUNT when
    only the count is written out, and as BOTH when the sentence carries
    both -- CLAUDE.md's does. They are different claims about one fact, and a
    shape answering only the easier one would let the other rot.

    A segment carrying no recognised family figure returns None. This shape
    does NOT widen into "every number near a family name": the colon, the three
    keywords and membership in the artifact are all required, together.
    """
    rows = capacity_rows()
    claims, wrong, refused = [], [], []

    for m in CAP_CLAUSE_RE.finditer(seg.text):
        row = rows.get(m.group(1))
        if row is None:
            continue
        for word, pat, answer in CAP_FIELDS:
            mm = pat.search(m.group(2))
            if not mm:
                continue
            said = int(mm.group(1).replace(",", ""))
            got = answer(row)
            claims.append("%s %s %d" % (m.group(1), word, said))
            if got != said:
                wrong.append("%s %s: prose %d, artifact %s"
                             % (m.group(1), word, said, got))

    for m in CAP_CLIQUE_RE.finditer(seg.text):
        word, said = m.group(1), int(m.group(2).replace(",", ""))
        claims.append("`capacity %s` clique %d" % (word, said))
        #: AMBIGUITY REFUSES rather than taking the first match. `check_data_
        #: rows`'s struck-text guard was found passing by luck on exactly this
        #: move -- `.search` happened to reach the live value first in every
        #: current row -- so a shape that picks a winner out of several is a
        #: shape that will one day pick wrong and stay green.
        owners = [f for f, r in rows.items()
                  if word in str(r["examples"]).split()]
        if len(owners) != 1:
            refused.append("`capacity %s`: %d families list %r among their "
                           "examples, so the artifact cannot say which clique "
                           "the command prints" % (word, len(owners), word))
            continue
        got = len(str(rows[owners[0]]["witness"]).split())
        if got != said:
            wrong.append("`capacity %s` (%s): prose %d words, artifact %d"
                         % (word, owners[0], said, got))

    for m in CAP_HELD_RE.finditer(seg.text):
        #: The depth is the number NEAREST to "held by" going backwards, not
        #: the first in the sentence. CLAUDE.md writes "162 families sustain a
        #: 12-chain, 81 a 20-chain, the deepest certified chain is 40, held by
        #: NINE families" -- a lazy forward match reads 162 and calls a true
        #: sentence false.
        back = seg.text[max(0, m.start() - 90):m.start()]
        nums = re.findall(_CAP_DIGITS, back)
        if not nums:
            continue
        depth = int(nums[-1].replace(",", ""))
        want = sorted(f for f, r in rows.items()
                      if r["certified"] and (r["chain_lo"] or 0) == depth)
        after = seg.text[m.end():m.end() + 300]
        named = sorted(f for f in re.findall(r"`([A-Z][A-Z0-9-]*)`",
                                             re.split(r"[.—]", after)[0])
                       if f in rows)
        if named:
            claims.append("%d held by %s" % (depth, ", ".join(named)))
            if named != want:
                wrong.append("held-by-%d: prose names %s; artifact %s"
                             % (depth, ", ".join(named),
                                ", ".join(want) or "no certified family"))
        #: The count is read off a CLEANED window (2026-08-28): a repinned
        #: sentence writes `~~NINE~~ **TWELVE** families`, and the raw match
        #: failed on the bold's own asterisks — so the document's LIVE tie
        #: count was verified by nothing while the struck one stayed visible.
        #: Struck spans are removed FIRST (a superseded value is not a live
        #: claim — the same rule the historical guard already applies), then
        #: the emphasis marks, then the ordinary search.
        cleaned = re.sub(r"~~.*?~~", " ", after[:90]).replace("*", "")
        cw = CAP_COUNTWORD_RE.search(cleaned[:60])
        if cw:
            said = _WORDNUM[cw.group(1).lower()]
            claims.append("%d held by %s families" % (depth, cw.group(1)))
            if said != len(want):
                wrong.append("held-by-%d: prose says %s (%d) famil%s; "
                             "artifact has %d" % (depth, cw.group(1), said,
                                         "y" if said == 1 else "ies",
                                         len(want)))

    if not claims:
        return None
    short = "; ".join(claims[:4]) + ("; …" if len(claims) > 4 else "")
    if seg.historical:
        return Verdict("CAPACITY_FIGURE", REFUSED, short,
                       "a `**Was:**` clause", HISTORICAL)
    if wrong:
        return Verdict("CAPACITY_FIGURE", FALSE, short,
                       "; ".join(wrong) + " (artifact at %s)" % head_commit())
    if refused:
        return Verdict("CAPACITY_FIGURE", REFUSED, short,
                       "; ".join(refused), AMBIGUOUS_SCOPE)
    return Verdict("CAPACITY_FIGURE", TRUE, short,
                   "%d figure(s) re-derived from data/rhyme_capacity_eng.tsv"
                   % len(claims))


# --- shape 11: FLOOR_THRESHOLD --------------------------------------------
#
# THE SAME DEFECT ONE DOCUMENT OVER. `RESULTS_SONG_FLOOR.md` §2 is headed
# "Shipped, 150-400 tokens" and gave `mattr_min` 0.7226, `fwr` 0.4716 and
# `cv` 0.1123 — the values before the closing sitting re-adopted the profile
# over the loaded corpus on 2026-08-21. Three of five cells were wrong under
# the word SHIPPED, and everything that could have caught it was looking
# somewhere else: `floor.py --check` compares the constants to a fresh
# derivation, and `song_profile_calibration.py --check` reads the profile's
# own `note` docstring. Neither reads this table.
#
# A profile constant is DEFINED in `floor.py`. A table that restates one is a
# second copy (doctrine 1), and the second copy is the one that rots, because
# nothing runs it.

_FLOOR_PROFILES = None


def floor_profiles():
    """-> {name: profile} from `quality.floor`, imported once (0.07s, no
    corpus and no lexicon — cheap enough for the fast suite step)."""
    global _FLOOR_PROFILES
    if _FLOOR_PROFILES is None:
        from quality.floor import PROFILES
        _FLOOR_PROFILES = {p.name: p for p in PROFILES}
    return _FLOOR_PROFILES


#: A cell that says the profile has NO threshold for this feature. `section`
#: really does lack `predictable_pair_fraction_max`, so an em-dash is a claim
#: with a truth value and not a blank.
_FLOOR_ABSENT = {"—", "-", "–", "n/a", "none", ""}

#: How many named percentile keys a header must carry before its rows are read
#: as threshold claims. THREE, not one: §5's per-run tables head their columns
#: `mattr` / `fwr` / `cv`, which are the same quantities under working names,
#: and reading those as the shipped constants would fail this document for
#: recording the runs that produced them. Requiring the DECLARED KEYS, and
#: several of them, is what separates "the shipped profile" from "a run".
_FLOOR_MIN_KEYS = 3


def shape_floor_threshold(seg):
    """A markdown row restating a shipped `floor.py` profile, re-derived from
    the profile itself.

    Fires only on a table whose HEADER names at least three of the declared
    percentile keys and whose row label names a shipped profile — so `| cut |
    < 0.7226 | ...` in a worked example, and every per-run table, are left
    alone. `_unstrike` has already removed the superseded row, so a struck
    line is never read as a live claim (doctrine 17).
    """
    if seg.kind != "table" or not seg.table_header:
        return None
    profiles = floor_profiles()
    head = _cells(seg.table_header)
    keys = {i: c.strip("`") for i, c in enumerate(head)
            if c.strip("`") in {k for p in profiles.values()
                                for k in p.percentiles}}
    if len(keys) < _FLOOR_MIN_KEYS:
        return None
    row = _cells(seg.text)
    label = row[0].strip("`*_ ").lower() if row else ""
    hit = [n for n in profiles if re.search(r"\b%s\b" % re.escape(n), label)]
    #: One name or none. A label matching two profiles is not a row about
    #: either of them, and choosing between them would be the guess that
    #: `CAPACITY_FIGURE`'s clique lookup refuses to make.
    if len(hit) != 1:
        return None
    prof = profiles[hit[0]]

    claims, wrong = [], []
    for i, key in sorted(keys.items()):
        if i >= len(row):
            continue
        cell = row[i].strip("`*")
        said_absent = cell.lower() in _FLOOR_ABSENT
        got = prof.percentiles.get(key)
        claims.append("%s %s %s" % (prof.name, key,
                                    "—" if said_absent else cell))
        if said_absent:
            if got is not None:
                wrong.append("%s %s: the table says the profile has none, "
                             "floor.py ships %s" % (prof.name, key, got))
            continue
        try:
            said = float(cell)
        except ValueError:
            wrong.append("%s %s: %r is not a number and not an absence "
                         "marker" % (prof.name, key, cell))
            continue
        if got is None:
            wrong.append("%s %s: the table gives %s, floor.py's profile has "
                         "no such threshold" % (prof.name, key, cell))
        #: COMPARED AT THE CELL'S OWN PRECISION. The table writes 0.3000 for a
        #: constant floor.py holds as 0.3, and `float("0.3000") != 0.3` is
        #: false only because both are the same double — but 0.7128 written as
        #: 0.713 would be a real rounding claim, not a defect. The cell decides
        #: how many places it is asserting (doctrine 91).
        elif round(got, len(cell.split(".")[1]) if "." in cell else 0) != said:
            wrong.append("%s %s: the table says %s, floor.py ships %s"
                         % (prof.name, key, cell, got))

    if not claims:
        return None
    short = "; ".join(claims[:4]) + ("; …" if len(claims) > 4 else "")
    if seg.historical:
        return Verdict("FLOOR_THRESHOLD", REFUSED, short,
                       "a `**Was:**` clause", HISTORICAL)
    if wrong:
        return Verdict("FLOOR_THRESHOLD", FALSE, short,
                       "; ".join(wrong) + " (at %s)" % head_commit())
    return Verdict("FLOOR_THRESHOLD", TRUE, short,
                   "%d threshold(s) re-derived from quality/floor.py"
                   % len(claims))


DERIV_RE = re.compile(
    r"^  (CONFIRMED|MOVED|FALSE|UNVERIFIABLE|SKIPPED|ERROR)\s+(D\d+)\s+(\S+(?: / \S+)?)\s+(.*?)\n"
    r"\s+register:\s*(.*?)\n\s+measured:\s*(.*?)\n", re.M)


def register_derivations(slow=False):
    """-> [(ident, entry_ids, what, verdict, claimed, measured)] from
    `quality/audit_register.py`'s printed report.

    CALLED ACROSS A PROCESS BOUNDARY AND NEVER RE-DERIVED. Those 26 claims
    already have an instrument; growing a shape here that measured the Finnish
    `j. n. e.` count a second way would put two numbers for one quantity in one
    round, which is the defect this file exists to prevent one level up. The
    printed report is parsed rather than the objects imported, for the reason
    `counters.py` gives: it is the output a human sees, and `wiring` would stop
    naming `audit_register.py` as a runnable one-shot if anything imported it.

    THEIR VERDICTS DO NOT MOVE THIS FILE'S EXIT CODE, deliberately.
    `audit_register.py` owns the exit policy for its own derivations, and it
    fails on FALSE while letting MOVED pass on the stated argument that a
    register is allowed to age but not to contradict itself. Two of its FALSE
    verdicts (D8, D9) are a deliberate calibration pair. A second exit policy
    over one instrument's output would make "does the record hold?" depend on
    which runner you invoked, which is exactly the disagreement this cell was
    formed to remove. They are REPORTED here, keyed to the entry they belong
    to, because a session reading an entry's claims should see that one of them
    is already known not to reproduce.
    """
    args = [sys.executable, os.path.join(HERE, "audit_register.py")]
    if slow:
        args.append("--slow")
    try:
        out = subprocess.run(args, cwd=ROOT, stdout=subprocess.PIPE,
                             stderr=subprocess.STDOUT, text=True,
                             errors="replace", timeout=1800).stdout
    except Exception as e:                                       # noqa: BLE001
        return [("-", [], "audit_register.py did not run", "ERROR", "",
                 "%s: %s" % (type(e).__name__, e))]
    rows = []
    for m in DERIV_RE.finditer(out):
        verdict, ident, ent, what = m.group(1), m.group(2), m.group(3), m.group(4)
        ids = re.findall(r"\b([A-Z]-\d+[a-z]?)\b", ent)
        rows.append((ident, ids, what.strip(), verdict,
                     m.group(5).strip(), m.group(6).strip()))
    if not rows:
        rows = [("-", [], "audit_register.py printed no parseable derivation "
                 "block; its report shape changed and this parse must be "
                 "repaired, not guessed", "ERROR", "", "")]
    return rows


SHAPES = [
    ("SYMBOL_ABSENT", False, shape_symbol_absent),
    ("HASATTR", False, shape_hasattr),
    ("REPO_PATH_EXISTS", False, shape_repo_path),
    ("STAGED_FILE_COUNT", True, shape_staged_file_count),
    ("MODULE_LINE_COUNT", False, shape_module_line_count),
    ("CORPUS_MARKER_ABSENT", True, shape_marker_absent),
    ("CORPUS_TABLE_ROW", True, shape_corpus_table_row),
    ("STATUS_XREF", False, shape_status_xref),
    ("SCRATCH_NAMESPACED", False, shape_scratch_namespaced),
    ("CAPACITY_FIGURE", False, shape_capacity_figure),
    ("FLOOR_THRESHOLD", False, shape_floor_threshold),
]

#: The shapes whose verdict flips meaning with the entry's STATUS. An absence
#: that is TRUE under CLOSED, or FALSE under OPEN, is a status/content
#: disagreement even when the claim itself is judged correctly.
ABSENCE_SHAPES = {"SYMBOL_ABSENT", "CORPUS_MARKER_ABSENT"}

#: The shapes asked of prose documents. THREE, and the docstring at the head of
#: this file records what each of the other eight did when it was run over the
#: same three documents. This is a declared list and not "every shape that does
#: not crash": a shape reaches it by being measured over the documents first.
#: A DOCUMENT SET PER SHAPE, because scope is the thing being widened and the
#: shapes do not want the same one. `REPO_PATH_EXISTS` cannot be pointed at
#: a RESULTS document: those cite foreign paths, the note above measured 29 red
#: over them, and a gate that opens red is a gate people learn to skip.
#: `CAPACITY_FIGURE` and `FLOOR_THRESHOLD` have the opposite need — the
#: per-family figures and the shipped-threshold tables they exist to re-derive
#: are written in one RESULTS document each and almost nowhere else, so scoping
#: them to `PROSE_DOCS` would point them at the one place the claims are not.
#:
#: One tuple could not express both, and the earlier one silently expressed the
#: first. Widening stays per-SHAPE and never per-FILE — this makes the file's
#: own stated rule mechanical instead of a convention (doctrine 48). A shape
#: earns each document by being run over it and shown not to misfire.
PROSE_SHAPES = {
    "REPO_PATH_EXISTS": PROSE_DOCS,
    "CAPACITY_FIGURE": PROSE_DOCS + ("quality/RESULTS_RHYME_CAPACITY.md",),
    "FLOOR_THRESHOLD": PROSE_DOCS + ("quality/RESULTS_SONG_FLOOR.md",),
}

#: Every document any shape is asked over. Derived, so adding a scope above
#: cannot leave a document unread by the reader that opens them.
PROSE_SCOPE = tuple(sorted({r for d in PROSE_SHAPES.values() for r in d}))

_ALL_ENTRIES = []


# ---------------------------------------------------------------------------
# 3b. THE POSITIVE CONTROL
#
# Doctrine 76: a null is only as good as the demonstration that the instrument
# COULD have found something. "0 false claims" is a null result, and after this
# cell struck M-6's two false sentences the `SYMBOL_ABSENT` shape matched no
# live segment at all -- so the shape that would have saved a cell now proves
# nothing on a clean run and would rot silently. Doctrine 31: run the positive
# control before believing any null.
#
# Every shape declares one segment it MUST call TRUE and one it MUST call
# FALSE, written against the real repository, and the main run refuses to print
# PASS if any of them misfires. A shape with no live instance in the register is
# still demonstrably able to fire.
# ---------------------------------------------------------------------------


class _FakeEntry:
    def __init__(self, ident, status, heading, body=()):
        self.id, self.status, self.heading = ident, status, heading
        self.source = "SELFTEST"
        #: `(lineno, text)` pairs, the shape `Entry.body` really carries.
        #: Empty rather than absent because `STATUS_XREF` reads it, and a
        #: probe that raises AttributeError is a dead control (2026-08-21).
        self.body = list(body)


def _probe(text, ident="X-0", status="OPEN", heading="### X-0 · probe `OPEN`",
           kind="prose"):
    return Segment(_FakeEntry(ident, status, heading), text, 0, kind=kind)


def _floor_probe(delta):
    """-> a shipped-profile table row rendered from `floor.py`: TRUE at delta
    0, FALSE at delta 1. Rendered for the reason `_capacity_probe` is — a
    threshold written into this file would be the second copy the shape exists
    to abolish, and it would go stale at the next adoption.

    The profile is DERIVED (first in sort order) so the control does not break
    if a profile is renamed or retired, and the header is built from that
    profile's own key set, which is also what proves the header rule is read
    from the declaration rather than typed out here (doctrine 1).
    """
    # The first profile IN SORT ORDER THAT DECLARES FIXED PERCENTILES: since
    # M-239 the alphabetically-first row is `lyric`, whose thresholds are
    # curves and whose `percentiles` is empty, and a probe rendered from it
    # has no keys — TRUE and FALSE both fall to `None` and the control is
    # vacuous. A curve row's table cells are not this shape's business.
    _named = sorted(n for n, p in floor_profiles().items() if p.percentiles)
    prof = floor_profiles()[_named[0]]
    keys = sorted(prof.percentiles)
    head = "| | " + " | ".join("`%s`" % k for k in keys) + " |"
    row = "| %s profile | " % prof.name + " | ".join(
        "%s" % (prof.percentiles[k] + delta) for k in keys) + " |"
    return Segment(_FakeEntry("X-0", "OPEN", "### X-0 · probe"), row, 0,
                   kind="table", table_header=head)


def _capacity_probe(delta):
    """-> a probe sentence rendered from the artifact: TRUE at delta 0, FALSE
    at delta 1.

    The family is DERIVED — the first certified one in sort order — rather than
    named here, so a control does not break the day a family stops being
    certified. What it asserts is the artifact's own `certified` figure, which
    makes the TRUE side true by construction and the FALSE side false by
    construction, for any table this shape will ever be pointed at.
    """
    rows = capacity_rows()
    fam = sorted(f for f, r in rows.items() if r["certified"])[0]
    return _probe("%s: %d classes, certified %d"
                  % (fam, rows[fam]["chain_hi"],
                     (rows[fam]["chain_lo"] or 0) + delta))


#: (shape name, a segment it must call TRUE, a segment it must call FALSE).
#: Both sides are required: a shape that never says FALSE cannot catch drift,
#: and a shape that never says TRUE will condemn the whole register.
POSITIVE_CONTROLS = [
    ("SYMBOL_ABSENT",
     _probe("No `no_such_relation_here()`.",
            heading="### X-0 · `fin.py` probe `OPEN`"),
     _probe("No `rhymes()`.", heading="### X-0 · `fin.py` probe `OPEN`")),
    # REPOINTED 2026-08-11, and the reason is the shape working on itself.
    # The TRUE probe used to be `hasattr(cym, "readability_census") is False`,
    # copied from the live N-2 instance -- and when the Welsh cell ADDED that
    # census the probe started failing, because the gap it was pinned to had
    # been closed. A positive control pinned to a real defect expires the
    # moment someone fixes the defect, which is precisely when you least want
    # your control to go dark. Both sides point at synthetic or structural
    # targets now, the same idiom SYMBOL_ABSENT already uses with
    # `no_such_relation_here()`: `no_such_census_ever` can never exist, and
    # `Phonology` is the base class every phonology module re-exports.
    ("HASATTR",
     _probe('(`hasattr(cym, "no_such_census_ever")` is False)'),
     _probe('(`hasattr(fin, "Finnish")` is False)')),
    ("REPO_PATH_EXISTS",
     _probe("built by `quality/counters.py`"),
     _probe("built by `quality/no_such_file_at_all.py`")),
    ("STAGED_FILE_COUNT", None, _probe("the 10000 staged Finnish files")),
    ("MODULE_LINE_COUNT", None,
     _probe("`quality/counters.py` is 999999 lines")),
    ("CORPUS_MARKER_ABSENT",
     _probe("there is no `--- AIR:` marker anywhere"),
     _probe("there is no `--- TITLE:` marker anywhere")),
    ("CORPUS_TABLE_ROW", None, _probe("| `fin_` | Finnish | 999999 |",
                                      kind="table")),
    ("STATUS_XREF", None, None),      # needs the real entry list; see below
    # Both sides are STRUCTURAL, not pinned to a live citation, for the reason
    # the HASATTR repin gives above: a control pinned to a real defect expires
    # the moment somebody fixes the defect. `cellAJ` is the namespaced idiom
    # `RESULTS_NON_HATTATAL.md` and `data/sources.tsv` already use, and
    # `fetch.sh` is the file doctrine 77 is ABOUT -- the one a sibling cell
    # overwrote for ~30 fetches. Neither can be closed by anyone's later fix.
    ("SCRATCH_NAMESPACED",
     _probe("written to `scratchpad/cellAJ/measure_ocr.py`"),
     _probe("written to `scratchpad/fetch.sh`")),
    # RENDERED, NOT WRITTEN DOWN, and it is the one control in this list that
    # HAS to be. Every other probe is a fixed string because a control pinned
    # to a live defect expires the moment somebody fixes the defect. A FIGURE
    # control has the mirror-image problem: a hard-coded `certified 27` in the
    # checker IS the frozen number this shape exists to catch, one layer up,
    # and it would go stale on the next re-derivation — taking the control
    # dark exactly when the shape starts mattering. So both sides are rendered
    # from the artifact at call time: the TRUE side states what the table says
    # and is therefore always true, the FALSE side states that plus one and is
    # therefore always false. Neither can be closed by anyone's later fix and
    # neither can rot.
    ("CAPACITY_FIGURE",
     lambda: _capacity_probe(0), lambda: _capacity_probe(1)),
    ("FLOOR_THRESHOLD",
     lambda: _floor_probe(0), lambda: _floor_probe(1)),
]

_BY_NAME = {name: fn for name, _v, fn in SHAPES}


#: A synthetic prose document whose every reading is DECLARED, driven through
#: the real reader by `prose_self_test`. Doctrine 76 applies to the SCOPE as
#: much as to the shape: "no stale path in CLAUDE.md" is a null, and it is an
#: easy null to fake -- a typo in `PROSE_DOCS`, a reader that silently drops a
#: block, an `_unstrike` that eats the document, and this check goes green
#: forever while looking at nothing at all.
PROSE_CONTROL_DOC = (
    "# probe\n"
    "\n"
    "A live citation of `quality/counters.py`, which is on disk.\n"
    "\n"
    "A stale citation of `quality/no_such_file_at_all.py` and nothing that\n"
    "disclaims it.\n"
    "\n"
    "A disclaimed citation: `quality/also_not_here.py` does not exist.\n"
    "\n"
    "~~A struck citation of `quality/struck_and_gone.py`.~~\n"
    "\n"
    "See `quality/counters.py` for why `verse.txt` was deleted.\n"
)


def prose_self_test():
    """-> [(name, 'ok'|reason)]. Four declared readings of one document.

    STALE      an existing-looking path that is not on disk must be FALSE.
               This is the whole point of the widening and the probe that
               proves the scope can still fire.
    DISCLAIMED a path the sentence says is absent, and which is absent, must
               be TRUE -- M-3's case, moved into prose.
    STRUCK     a path inside a `~~...~~` run must not be reported at all. All
               three documents correct themselves that way.
    SUBJECT    the last line is CLAUDE.md:958's shape exactly: a path that
               EXISTS, followed by a different subject's "was deleted". It
               must be TRUE. Before `_absence_window` truncated at the next
               backtick this returned FALSE, and it is the regression this
               probe exists to hold.
    """
    e = prose_entry("PROBE.md", PROSE_CONTROL_DOC)
    seen = []
    for seg in e.segments:
        v = shape_repo_path(seg)
        if v is not None:
            seen.append((seg.text, v))

    out = []
    false = [(t, v) for t, v in seen if v.status == FALSE]
    if len(false) == 1 and false[0][1].claim == "quality/no_such_file_at_all.py":
        out.append(("prose STALE probe", "ok"))
    else:
        out.append(("prose STALE probe",
                    "expected exactly one FALSE naming the missing path, got %s"
                    % ([(v.status, v.claim) for _t, v in false] or "none")))

    dis = [v for t, v in seen if "also_not_here" in t]
    out.append(("prose DISCLAIMED probe",
                "ok" if len(dis) == 1 and dis[0].status == TRUE
                else "expected one TRUE, got %s"
                     % [v.status for v in dis]))

    struck = [v.claim for _t, v in seen if "struck_and_gone" in v.claim]
    out.append(("prose STRUCK probe",
                "ok" if not struck
                else "a struck path was reported: %s" % struck))

    subj = [v for t, v in seen if "was deleted" in t]
    out.append(("prose SUBJECT probe",
                "ok" if len(subj) == 1 and subj[0].status == TRUE
                else "expected one TRUE, got %s"
                     % [(v.status, v.measured[:60]) for v in subj]))
    return out


def self_test():
    """-> [(shape, 'ok'|reason)]. Never touches MISSING.md or BACKLOG.md.

    The two VOLATILE shapes and `MODULE_LINE_COUNT` carry only a FALSE probe:
    their TRUE side is whatever the corpus currently holds, so a hard-coded
    TRUE probe would be a frozen number in the checker -- the exact defect the
    checker exists to remove, one layer down.

    `STATUS_XREF` is exercised by the live sweep instead: it reads the entry
    list, so a synthetic probe would have to fake the register to test the
    thing that reads the register.
    """
    out = []
    for name, t_seg, f_seg in POSITIVE_CONTROLS:
        fn = _BY_NAME[name]
        problems = []
        for want, seg in ((TRUE, t_seg), (FALSE, f_seg)):
            if seg is None:
                continue
            if callable(seg):
                # A RENDERED control (see CAPACITY_FIGURE above). Built here
                # rather than at import so a missing artifact surfaces as a
                # named probe failure instead of an import error that takes
                # the whole register check down with it.
                try:
                    seg = seg()
                except Exception as exc:                        # noqa: BLE001
                    problems.append("%s probe could not be rendered — %s: %s"
                                    % (want, type(exc).__name__, exc))
                    continue
            try:
                v = fn(seg)
            except Exception as exc:                            # noqa: BLE001
                problems.append("%s probe raised %s: %s"
                                % (want, type(exc).__name__, exc))
                continue
            if v is None:
                problems.append("%s probe did not trigger the shape at all"
                                % want)
            elif v.status != want:
                problems.append("%s probe returned %s (%s)"
                                % (want, v.status, v.measured[:70]))
        out.append((name, "ok" if not problems else "; ".join(problems)))
    return out


# ---------------------------------------------------------------------------
# 3c. PIN SUPERSESSION — doctrine 17, over `quality/audit_*.py`
#
# "A check may be kept after its premise is falsified, but never quoted as if
# it were not." That sentence is cited 44 times in this repo (MEASURED
# 2026-08-13, `grep -ro "doctrine 17"`) and it is the line every audit prints
# when it goes red -- `audit_spans.py`,
# `audit_corpus.py`, `audit_tang_null.py`, `audit_kalevala_null.py` and
# `audit_joint_auc_null.py` all end their failure block with "keep the
# superseded value visible (doctrine 17)". EVERY ONE OF THOSE IS A STRING A
# HUMAN READS AFTER A FAILURE. Nothing checked that a superseded value
# actually stayed visible, so the most-cited doctrine in the layer was the
# least enforced one.
#
# WHAT IS AND IS NOT MADE MANDATORY, because the obvious rule is wrong. "Every
# PINNED constant must have a dated superseded line" fires on correct work: a
# pin set right the first time and never moved has nothing to supersede, and
# the overwhelming majority of this repo's pins are exactly that. A check that
# goes red on a correct pin is worse than no check -- CI's own comment in this
# repo says a permanently-red gate is one people learn to skip. (No count is
# written here on purpose: `--pins` prints the live one, and a comment that
# carried a figure about unmaintained figures would be the joke writing
# itself.)
#
# The invariant is CONDITIONAL and it derives its own population:
#
#     IF a pinned value has CHANGED in git history,
#     THEN the documents that audit names must still carry the OLD value,
#          and must mark it as superseded or date it.
#
# Nothing here is a list. The audit files come from a glob, the pins from the
# AST, the moves from `git log`/`git cat-file`, and the documents from the
# `.md` paths each audit file cites in its own text. A hard-coded list of
# "pins that moved" would be the same defect this file exists to remove, one
# layer up: a figure written down instead of derived.
#
# TWO DIRECTIONS, ONE FATAL. VANISHED -- the superseded value is in none of
# the cited documents -- FAILS: that is doctrine 17's sentence broken outright,
# a value overwritten rather than kept. UNMARKED -- the value is still there
# and nothing says it was superseded -- is reported as a NOTE, for the same
# reason `status_content`'s second direction is: the remedy is a human editing
# a RESULTS document, and "is this marker enough" is a judgement a regex is
# not entitled to fail a build on.
# ---------------------------------------------------------------------------


#: A pin-bearing name. `PINNED`/`PINNED_SHAPE`/`RECORDED` are what this layer
#: already calls them; the check follows the repo's own vocabulary rather than
#: inventing one.
PIN_NAME = re.compile(r"PINNED|RECORDED")

#: A string literal that is really a number -- `audit_joint_auc_null.py` pins
#: its four AUCs as `"0.717"` because they are compared at the 3 decimals the
#: record quotes them to, not as floats.
NUMERIC_TEXT = re.compile(r"^-?\d+(?:\.\d+)?$")

ISO_DATE = re.compile(r"20\d\d-\d\d-\d\d")

#: The ONLY phrases that count as marking a value superseded, declared as a
#: closed list for the same reason `PATH_ABSENT_PHRASES` is: reading
#: "this number is no longer current" out of English in general is the guess
#: this file will not make. Every entry is drawn from a sentence this repo
#: has actually written beside a retired figure.
PIN_SUPERSESSION_MARKS = (
    "repinned", "repin", "superseded", "supersedes", "struck", "void",
    "withdrawn", "no longer reproduce", "does not reproduce",
    "did not reproduce", "doctrine 17", "**was:**", "amended", "retired",
    "stale", "must not be quoted",
)


def _pin_scalar(node, lines):
    """-> (source text, value) for a pinnable literal, else None.

    The SOURCE TEXT is kept beside the value and it is the half that matters:
    `0.640` and `0.64` are one float and two different strings, and a document
    quotes the string. Searching a RESULTS file for `0.64` when the record
    says `0.640` is how a check reports a value missing that is on the page.

    Sliced off a source ALREADY SPLIT by the caller, not by
    `ast.get_source_segment`, which re-splits the whole module on every call
    -- 2.1 s of the 2.8 s this check first cost, on `audit_corpus.py`'s 2,125
    lines times its four revisions times its fifteen pins.
    """
    if not isinstance(node, ast.Constant):
        return None
    v = node.value
    if isinstance(v, bool):
        return None
    if isinstance(v, (int, float)):
        try:
            text = lines[node.lineno - 1][node.col_offset:node.end_col_offset]
        except IndexError:                                     # pragma: no cover
            text = ""
        return ((text or repr(v)).strip(), v)
    if isinstance(v, str) and NUMERIC_TEXT.match(v.strip()):
        return (v.strip(), v.strip())
    return None


def _pin_label(node):
    """-> a tuple's or list's own name: its first non-numeric string element.

    `("ABSOLUTE (original ten)", QualityFeatures, "0.717", "0.964")` names
    itself in its first slot, which is the idiom the audit files already use.
    """
    for e in node.elts:
        if (isinstance(e, ast.Constant) and isinstance(e.value, str)
                and not NUMERIC_TEXT.match(e.value)):
            return e.value
    return None


def _pin_walk(node, path, lines, out):
    """Flatten a literal container into {path: (text, value)}.

    The PATH is the pin's identity across commits, so it is built from names
    and labels and never from a line number: `audit_joint_auc_null.py`'s four
    AUCs live inside a `for` header that has moved 60 lines since it was
    written, and a positional key would have read that move as four repins.
    A tuple takes its first non-numeric string as its label -- the same idiom
    that file already uses, `("ABSOLUTE (original ten)", ..., "0.717")`.
    """
    if isinstance(node, ast.Dict):
        for k, v in zip(node.keys, node.values):
            key = k.value if isinstance(k, ast.Constant) else "?"
            _pin_walk(v, path + (str(key),), lines, out)
        return
    if isinstance(node, (ast.Tuple, ast.List)):
        label = _pin_label(node)
        base = path + ((label,) if label else ())
        for i, e in enumerate(node.elts):
            if isinstance(e, (ast.Dict, ast.Tuple, ast.List)):
                # A labelled child names itself; an unlabelled one still needs
                # an index or two sibling tuples would collide into one pin.
                inner = _pin_label(e) if isinstance(e, (ast.Tuple, ast.List)) \
                    else None
                _pin_walk(e, base if inner else base + ("[%d]" % i,), lines, out)
            else:
                _pin_walk(e, base + ("[%d]" % i,), lines, out)
        return
    hit = _pin_scalar(node, lines)
    if hit is not None:
        out[path] = hit


def pin_literals(src):
    """-> {path: (text, value)} over one audit module, or None if it will not
    parse.

    TWO DECLARED SHAPES, and a third would be declared the same way rather
    than guessed at:

      * a module-level assignment whose name carries `PINNED` or `RECORDED`,
        to any depth of a literal container. `PINNED_SHAPE`, `RECORDED`,
        `PINNED` itself.
      * a literal tuple or list in a `for` header. That is not decoration:
        `audit_joint_auc_null.py`'s own comment says the four observed AUCs
        are "NOT repeated" in `PINNED` and are "checked against the `RECORDED`
        strings already carried in `main()`" -- so the ONLY committed copy of
        the numbers that moved this session is a bare tuple in a loop header,
        and a checker that read named constants alone would have found nothing
        at all and called it clean.

    It over-reaches slightly by construction: `for i in (1, 2, 3)` would be
    read as three pins. That is harmless and it is the right direction of
    error -- a spurious pin can only ever be silent, because a pin is reported
    only when its VALUE MOVES, and a loop bound that moves is a thing worth
    looking at anyway.
    """
    try:
        tree = ast.parse(src)
    except (SyntaxError, ValueError):
        return None
    lines = src.split("\n")
    out = {}
    for n in tree.body:
        if isinstance(n, ast.Assign):
            for t in n.targets:
                if isinstance(t, ast.Name) and PIN_NAME.search(t.id):
                    _pin_walk(n.value, (t.id,), lines, out)
    for n in ast.walk(tree):
        if isinstance(n, ast.For) and isinstance(n.iter, (ast.Tuple, ast.List)):
            names = [x.id for x in ast.walk(n.target) if isinstance(x, ast.Name)]
            _pin_walk(n.iter, ("for(%s)" % ",".join(names),), lines, out)
    return out


MD_CITE = re.compile(r"([\w./-]*[A-Z][A-Z_0-9]*\.md)")


def cited_documents(src):
    """-> [relpath] the `.md` files this audit module names in its own text.

    DERIVED, not mapped. A table from `audit_spans.py` to `RESULTS_SPANS.md`
    would be a second place to keep a fact the module already states, and the
    two would drift -- which is the failure this whole file is about. A bare
    `RESULTS_SPANS.md` resolves under `quality/` the same way `resolve_module`
    resolves a bare module name.
    """
    out = []
    for cite in dict.fromkeys(MD_CITE.findall(src)):
        for cand in ((cite,) if "/" in cite else (cite, "quality/" + cite)):
            if os.path.exists(os.path.join(ROOT, cand)):
                if cand not in out:
                    out.append(cand)
                break
    return out


def _renderings(text, value):
    """-> the strings a document might spell this pin with.

    `1064` and `1,064` are one pin and two renderings, and this repo writes
    both -- `audit_spans.py` pins `1064`, `CLAUDE.md` quotes `1,064`.
    Doctrine 91: a count is a coordinate of the RENDERING.
    """
    out = [text]
    if isinstance(value, int) and abs(value) >= 1000:
        out.append("{:,}".format(value))
    return out


def _md_blocks(lines):
    """-> [(start, end)] over a markdown file, one entry per line.

    A block ends at a blank line or where a `>` blockquote starts or stops --
    the SAME boundary rule `_segments_of` uses on the two registers, reused
    rather than re-invented so the file has one idea of what a block is.

    A FIXED WINDOW OF N LINES WAS TRIED FIRST AND IT WAS WRONG, measurably.
    `RESULTS.md` line 251 ends a blockquote about the `rhyme_predictability`
    withdrawal with the words "doctrine 17"; line 261 states the joint AUC
    `0.659` in an unrelated bullet ten lines later. A window called the second
    one marked by the first -- a real supersession marker for a DIFFERENT
    figure, close enough to launder a stale one. Blocks separate them because
    one is quoted and the other is not.
    """
    bounds, start, quoted = [], 0, None
    for i, raw in enumerate(lines):
        s = raw.strip()
        q = s.startswith(">")
        if not s or (quoted is not None and q != quoted):
            if i > start:
                bounds.append((start, i))
            start = i + (0 if s else 1)
            quoted = q if s else None
            if not s:
                continue
        if quoted is None:
            quoted = q
    if start < len(lines):
        bounds.append((start, len(lines)))
    out = [(0, len(lines))] * len(lines)
    for lo, hi in bounds:
        for i in range(lo, hi):
            out[i] = (lo, hi)
    return out


def pin_verdict(text, value, doc_texts):
    """-> (status, [(doc, lineno, line)]). PURE: no disk, no git, no clock.

    VANISHED   the superseded value is in none of the documents.
    UNMARKED   it is there, and no block that states it carries a date or a
               supersession marker.
    ok         at least one block states it AND marks it.

    "At least one", not "every one": a figure quoted six times needs the
    record to say once that it was superseded, and demanding a marker beside
    every mention would fail the most carefully written documents in the repo
    for being thorough. That is the lenient direction on purpose -- this
    verdict is a NOTE, and a note that cries wolf is one people stop reading.

    Kept free of I/O so the positive control below can drive it with a
    synthetic document and prove all three verdicts, exactly the way every
    claim shape here declares a probe it must call TRUE and one it must call
    FALSE. A control that needed the real repository to be broken could only
    ever run once.
    """
    where, marked = [], False
    for name, txt in doc_texts.items():
        lines = txt.split("\n")
        blocks = _md_blocks(lines)
        for rend in _renderings(text, value):
            pat = re.compile(r"(?<![\w.])" + re.escape(rend) + r"(?![\w.])")
            for i, line in enumerate(lines):
                if not pat.search(line):
                    continue
                where.append((name, i + 1, line.strip()))
                lo, hi = blocks[i]
                block = "\n".join(lines[lo:hi])
                if ISO_DATE.search(block) or any(
                        m in block.lower() for m in PIN_SUPERSESSION_MARKS):
                    marked = True
    if not where:
        return "VANISHED", []
    return ("ok" if marked else "UNMARKED"), where


def pin_grade(text, value, docs_now, docs_then):
    """-> (status, where) over the record read TWICE. PURE, for the same
    reason `pin_verdict` is: this is the function that decides the exit code,
    so it is the one that most needs a control that does not depend on the
    repository being broken.

    `docs_then` is the record as it stood at the parent of the moving commit,
    or falsy when that could not be read at all -- which is REFUSED and not a
    pass, because a checkout with no history cannot answer this question and
    saying nothing found would be a null from an instrument that never fired.
    """
    status, where = pin_verdict(text, value, docs_now)
    if status != "VANISHED":
        return status, where
    if not docs_then:
        return "REFUSED", where
    was, _w = pin_verdict(text, value, docs_then)
    return ("NEVER_QUOTED" if was == "VANISHED" else "VANISHED"), where


class PinMove:
    """One pin whose value CHANGED, and what the record did about it."""

    def __init__(self, rel, key, old, new, sha, date, subject):
        self.rel, self.key = rel, key
        self.old_text, self.old_value = old
        self.new_text = new[0]
        self.sha, self.date, self.subject = sha, date, subject
        self.docs = []
        self.status = "REFUSED"
        self.where = []
        self.reason = ""


def _git(args, timeout=120, stdin=None, binary=False):
    """Run one read-only git command. `binary` returns bytes.

    `cat-file --batch` states its blob length in BYTES and this repo's audit
    modules are full of em-dashes, so decoding the stream before slicing it
    walks the offsets off the end of the first non-ASCII file. The batch read
    is done on bytes and each blob decoded on its own.
    """
    out = subprocess.run(
        ["git", "-C", ROOT] + args,
        input=(stdin.encode("utf-8") if (binary and stdin is not None)
               else stdin),
        stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
        text=not binary, errors=None if binary else "replace",
        timeout=timeout).stdout
    return out


def audit_modules():
    """-> [relpath] every `quality/audit_*.py`, from a glob and never a list."""
    return sorted(os.path.relpath(p, ROOT)
                  for p in glob.glob(os.path.join(HERE, "audit_*.py")))


def _cat_file_batch(specs):
    """-> {spec: text} for `<rev>:<path>` specs, in ONE git call, or None.

    A spec git cannot resolve is simply absent from the result -- an
    `unreadable` answer and an `absent from the record` answer are not the
    same thing (doctrine 28) and the caller separates them.
    """
    specs = list(dict.fromkeys(specs))
    if not specs:
        return {}
    try:
        raw = _git(["cat-file", "--batch"], stdin="\n".join(specs) + "\n",
                   binary=True)
    except Exception:                                            # noqa: BLE001
        return None
    out, pos = {}, 0
    for spec in specs:
        nl = raw.find(b"\n", pos)
        if nl < 0:
            break
        header = raw[pos:nl].split()
        if len(header) < 3:                  # "<spec> missing"
            pos = nl + 1
            continue
        size = int(header[2])
        out[spec] = raw[nl + 1:nl + 1 + size].decode("utf-8", "replace")
        pos = nl + 1 + size + 1              # +1 for git's trailing newline
    return out


def pin_moves():
    """-> (moves, pin_count, file_count, refusal, path prefix). READ-ONLY git.

    THREE git calls, whatever the history's size: one `rev-parse`, one
    `log --name-only` over the whole glob, one `cat-file --batch` fed every
    (commit, file) blob at once. The obvious shape -- `git show` per revision
    -- was 29 subprocesses, and with `ast.get_source_segment` re-splitting
    each blob it cost 2.8 s: most of a CI step, for a check that reads six
    files. It is 0.4 s now.

    THE REFUSAL IS THE POINT OF THE FUNCTION AS MUCH AS THE ANSWER IS.
    `actions/checkout@v5` clones at depth 1 unless told otherwise, and a
    depth-1 checkout has no history for anything -- so this check would find
    zero moved pins and print a clean result on a repository it never read.
    That is doctrine 20's own case: an instrument that cannot fire and an
    instrument that fired and found nothing are different results. When every
    audit file has exactly one revision the answer is REFUSED, loudly, with
    the coordinate that is missing named.
    """
    files = audit_modules()
    if not files:
        return [], 0, 0, "no quality/audit_*.py on disk", ""
    #: A module with no pin AT HEAD cannot contribute one: a move is a pin
    #: whose value differs between two revisions, so both revisions have to
    #: hold it, and the check is about the value the code stands behind NOW.
    #: Skipping them is not a shortcut, it is the population -- and it is what
    #: keeps `audit_register.py`'s 1,614 unpinned lines out of the parse.
    live_pins = {}
    for rel in files:
        live_pins[rel] = pin_literals(
            open(os.path.join(ROOT, rel), encoding="utf-8").read()) or {}
    pinned = {rel for rel, p in live_pins.items() if p}
    try:
        prefix = _git(["rev-parse", "--show-prefix"], timeout=30).strip()
        log = _git(["log", "--format=COMMIT %H %ad %s", "--date=short",
                    "--name-only", "--", "quality/audit_*.py"])
    except Exception as e:                                       # noqa: BLE001
        return [], 0, len(files), "git is unreadable here (%s: %s)" % (
            type(e).__name__, e), ""
    if not log.strip():
        return [], 0, len(files), "git reports no commits touching " \
                                  "quality/audit_*.py", ""

    revs, cur = [], None
    for line in log.split("\n"):
        if line.startswith("COMMIT "):
            sha, date, subject = line[7:].split(" ", 2)
            cur = (sha, date, subject, [])
            revs.append(cur)
        elif line.strip() and cur is not None:
            rel = line.strip()
            if prefix and rel.startswith(prefix):
                rel = rel[len(prefix):]
            if rel in pinned:
                cur[3].append(rel)

    per_file = collections.defaultdict(list)
    for sha, date, subject, touched in revs:
        for rel in touched:
            per_file[rel].append((sha, date, subject))
    if per_file and all(len(v) <= 1 for v in per_file.values()):
        return [], 0, len(files), (
            "every audit file has one revision — this is a truncated "
            "checkout, and a pin cannot be seen to move in it. "
            "`actions/checkout@v5` needs `fetch-depth: 0`"), ""

    wanted = ["%s:%s%s" % (sha, prefix, rel)
              for rel, hist in per_file.items() for sha, _d, _s in hist]
    blobs = _cat_file_batch(wanted)
    if blobs is None:
        return [], 0, len(files), "git cat-file failed", prefix

    moves = []
    for rel, hist in per_file.items():
        prev = None
        for sha, date, subject in reversed(hist):       # oldest first
            src = blobs.get("%s:%s%s" % (sha, prefix, rel))
            cur_pins = pin_literals(src) if src else None
            if cur_pins is None:
                continue                     # unparseable mid-write checkpoint
            if prev is not None:
                for key in sorted(set(prev) & set(cur_pins)):
                    if prev[key][1] != cur_pins[key][1]:
                        moves.append(PinMove(rel, "/".join(key), prev[key],
                                             cur_pins[key], sha, date, subject))
            prev = cur_pins

    return moves, sum(len(p) for p in live_pins.values()), len(files), \
        None, prefix


_DOC_CACHE = {}


def _doc_text(rel):
    if rel not in _DOC_CACHE:
        try:
            _DOC_CACHE[rel] = open(os.path.join(ROOT, rel),
                                   encoding="utf-8").read()
        except OSError:
            _DOC_CACHE[rel] = ""
    return _DOC_CACHE[rel]


def pin_supersession():
    """-> (moves, pin_count, file_count, refusal), each move graded.

    A MOVE IS NOT AUTOMATICALLY A SUPERSESSION, and the first version of this
    check did not know that. It read the pin history, found the old value in
    no document, and FAILED -- and the first thing it failed on was a pin
    another cell had introduced and corrected within the same hour, from
    18094 to 18095, before any document had ever quoted either number. There
    was nothing to supersede. Doctrine 17 governs a value the record CARRIED;
    a value the record never carried is a typo, and failing a typo fix is a
    check firing on correct work.

    So the record is read TWICE: as it stands now, and as it stood at the
    parent of the commit that moved the pin. Absent then AND absent now is
    NEVER_QUOTED and is not a defect. Present then and absent now is VANISHED
    -- the superseded value was taken off the page -- and that is the one
    verdict here that fails a run. Doctrine 28 again: "the record dropped it"
    and "the record never had it" are different values, mechanically.
    """
    moves, live, nfiles, refusal, prefix = pin_moves()
    for mv in moves:
        src = open(os.path.join(ROOT, mv.rel), encoding="utf-8").read()
        mv.docs = cited_documents(src)
    before = _cat_file_batch(["%s^:%s%s" % (mv.sha, prefix, d)
                              for mv in moves for d in mv.docs]) or {}
    for mv in moves:
        if not mv.docs:
            mv.status = "REFUSED"
            mv.reason = ("that module names no `.md` document, so there is "
                         "nothing to check it against")
            continue
        then = {d: before["%s^:%s%s" % (mv.sha, prefix, d)]
                for d in mv.docs
                if "%s^:%s%s" % (mv.sha, prefix, d) in before}
        mv.status, mv.where = pin_grade(
            mv.old_text, mv.old_value,
            {d: _doc_text(d) for d in mv.docs}, then)
        if mv.status == "REFUSED":
            mv.reason = ("the record could not be read at %s^, so whether the "
                         "value was ever on the page cannot be told"
                         % mv.sha[:8])
        elif mv.status == "NEVER_QUOTED":
            mv.reason = ("no document carried it before the move either, so "
                         "nothing was superseded — a correction, not a repin")
    return moves, live, nfiles, refusal


#: (what the verdict must be, pin text, pin value, a synthetic document set).
#: All three verdicts are exercised, and the fourth case pins the RENDERING
#: half: a document that writes `1,064` for a pin written `1064` has kept the
#: value, and a checker that only matched the digits would report it VANISHED
#: and fail a correct record.
PIN_CONTROLS = [
    ("VANISHED", "0.659", 0.659,
     {"P.md": "# probe\n\nthis document states no figure at all.\n"}),
    ("UNMARKED", "0.659", 0.659,
     {"P.md": "| joint held-out AUC | 0.709 | **0.659** |\n\nflat, current.\n"}),
    ("ok", "0.659", 0.659,
     {"P.md": "REPINNED 2026-08-13 from 0.659, which no longer reproduces.\n"}),
    ("ok", "1064", 1064,
     {"P.md": "superseded: the sweep read 1,064 mandated pairs.\n"}),
]

#: (verdict, pin text, value, the record NOW, the record BEFORE THE MOVE).
#: This is the pair that decides the exit code, and the two cases differ ONLY
#: in the second document set. Without the second read they are the same
#: input, which is how the first draft of this check failed a cell for fixing
#: a typo in a number nobody had ever quoted.
PIN_HISTORY_CONTROLS = [
    ("VANISHED", "18094", 18094,
     {"P.md": "the corpus holds 18095 alliterating lines.\n"},
     {"P.md": "the corpus holds 18094 alliterating lines.\n"}),
    ("NEVER_QUOTED", "18094", 18094,
     {"P.md": "the corpus holds 18095 alliterating lines.\n"},
     {"P.md": "this document said nothing about the count.\n"}),
    ("REFUSED", "18094", 18094,
     {"P.md": "the corpus holds 18095 alliterating lines.\n"}, {}),
]

#: A module the EXTRACTOR must read exactly this way. `NOT_A_PIN` is the case
#: that matters: a bare module constant is not a pin just because it is a
#: number, or every `SEED` and `WINDOW` in the layer would be one.
PIN_EXTRACT_PROBE = (
    'PINNED = {"a": 12, "b": {"c": 0.640}}\n'
    'RECORDED_X = 7\n'
    'NOT_A_PIN = 99\n'
    'for tag, rec in (("ARM", "0.717"), ("ARM2", "0.891")):\n'
    '    pass\n'
)
PIN_EXTRACT_WANT = {
    ("PINNED", "a"): ("12", 12),
    ("PINNED", "b", "c"): ("0.640", 0.640),
    ("RECORDED_X",): ("7", 7),
    ("for(tag,rec)", "ARM", "[1]"): ("0.717", "0.717"),
    ("for(tag,rec)", "ARM2", "[1]"): ("0.891", "0.891"),
}


def pin_self_test():
    """-> [(name, 'ok'|reason)]. Doctrine 76, for this check too.

    "0 pins moved without a record" is a null, and a null from this check is
    the easiest one in the file to fake: delete the extractor's `for` shape
    and it goes green forever. So the extractor is driven against a module
    whose reading is declared, and the verdict against documents whose three
    answers are declared, and a misfire FAILS the run.
    """
    out = []
    got = pin_literals(PIN_EXTRACT_PROBE)
    if got != PIN_EXTRACT_WANT:
        missing = sorted("/".join(k) for k in set(PIN_EXTRACT_WANT) - set(got or {}))
        extra = sorted("/".join(k) for k in set(got or {}) - set(PIN_EXTRACT_WANT))
        wrong = sorted("/".join(k) for k in set(got or {}) & set(PIN_EXTRACT_WANT)
                       if got[k] != PIN_EXTRACT_WANT[k])
        out.append(("pin extractor", "missing %s; unexpected %s; wrong %s"
                    % (missing or "-", extra or "-", wrong or "-")))
    else:
        out.append(("pin extractor", "ok"))
    for want, text, value, docs in PIN_CONTROLS:
        try:
            status, _w = pin_verdict(text, value, docs)
        except Exception as exc:                                # noqa: BLE001
            out.append(("pin %s probe" % want,
                        "raised %s: %s" % (type(exc).__name__, exc)))
            continue
        out.append(("pin %s probe" % want,
                    "ok" if status == want else "returned %s" % status))
    for want, text, value, now, then in PIN_HISTORY_CONTROLS:
        try:
            status, _w = pin_grade(text, value, now, then)
        except Exception as exc:                                # noqa: BLE001
            out.append(("pin history %s probe" % want,
                        "raised %s: %s" % (type(exc).__name__, exc)))
            continue
        out.append(("pin history %s probe" % want,
                    "ok" if status == want else "returned %s" % status))
    return out


# ---------------------------------------------------------------------------
# 4. The sweep
# ---------------------------------------------------------------------------


def sweep():
    global _ALL_ENTRIES
    _ALL_ENTRIES = read_entries()
    results = []
    for e in _ALL_ENTRIES:
        for seg in e.segments:
            # EVERY shape is asked, not the first that bites. One sentence can
            # carry two checkable claims -- §4.4 states a repo path AND a line
            # count -- and a first-match loop silently dropped the second, so
            # the line count sat unchecked while it drifted. A shape that does
            # not recognise the segment returns None and costs nothing.
            found = []
            for name, _vol, fn in SHAPES:
                try:
                    v = fn(seg)
                except Exception as exc:                        # noqa: BLE001
                    # A CRASH IS NOT A REFUSAL, and filing it as one is how
                    # this file went green over a dead shape on 2026-08-21:
                    # `STATUS_XREF` raised TypeError on every heading it had
                    # been answering, all 12 crashes landed in NO_INSTRUMENT
                    # beside the genuine "no coordinate to work from" ones,
                    # and the run printed PASS. `NO_INSTRUMENT` means the
                    # shape looked and found nothing to measure against;
                    # `SHAPE_RAISED` means the shape never looked. They are
                    # different facts and only one of them fails the run.
                    v = Verdict(name, REFUSED, seg.text[:70],
                                "%s: %s" % (type(exc).__name__, exc),
                                SHAPE_RAISED)
                if v is None:
                    continue
                if seg.historical and v.status == FALSE:
                    v = Verdict(v.shape, REFUSED, v.claim, v.measured,
                                HISTORICAL, "asserted under a `**Was:**` opener")
                found.append(v)
            if not found:
                found = [Verdict(None, REFUSED, seg.text[:110], "", NO_SHAPE)]
            for v in found:
                results.append((seg, v))
    return _ALL_ENTRIES, results


def sweep_prose():
    """-> (results, refusals) — each shape in `PROSE_SHAPES` over every segment
    of the documents ITS OWN scope names.

    Separate from `sweep()` and not a widening of it, which is the whole design
    and not a convenience. `sweep()`'s asked/answered/refused triple answers
    "of the claims drawn from the two registers, how many did a shape reach";
    CLAUDE.md is thousands of segments of which one shape is asked, so folding
    them in would bury that number under prose nobody proposed to check while
    leaving the triple's own sentence unchanged. Doctrine 79 is about counting
    the population you named, and these are two populations.

    A shape that raises is caught and reported as `NO_INSTRUMENT`, the same way
    `sweep()` does it: a prose document is not the population these shapes were
    written against, and an exception on one segment must not take the register
    check down with it.
    """
    entries, refusals = read_prose()
    fns = {n: fn for n, _v, fn in SHAPES if n in PROSE_SHAPES}
    # rel -> the shapes declared over it, so a document is read ONCE and each
    # shape still sees only the documents it earned.
    asked = {}
    for name, docs in PROSE_SHAPES.items():
        for rel in docs:
            asked.setdefault(rel, []).append(name)
    results = []
    for e in entries:
        for seg in e.segments:
            for name in sorted(asked.get(e.id, ())):
                fn = fns[name]
                try:
                    v = fn(seg)
                except Exception as exc:                        # noqa: BLE001
                    v = Verdict(name, REFUSED, seg.text[:70],
                                "%s: %s" % (type(exc).__name__, exc),
                                NO_INSTRUMENT)
                if v is not None:
                    results.append((seg, v))
    return results, refusals


def status_content(entries, results):
    """-> (open_but_filled, shut_but_open). The two directions of item 2.

    open_but_filled FAILS the run: the entry advertises a gap the repo has
    already closed, which is the exact way a cell gets briefed to build
    something that exists.

    shut_but_open is a NOTE. A CLOSED entry is allowed to carry a true residual
    absence and say so -- N-2 records `hasattr(cym, "readability_census")` is
    False inside a CLOSED entry deliberately -- so failing on it would punish
    the entries that are most careful. It is listed for a human instead.
    """
    by_entry = collections.defaultdict(list)
    for seg, v in results:
        if v.shape in ABSENCE_SHAPES and v.status in (TRUE, FALSE):
            by_entry[id(seg.entry)].append(v)
    filled, still_open = [], []
    for e in entries:
        vs = by_entry.get(id(e))
        if not vs:
            continue
        st = e.status or ""
        if st in OPEN_ISH and all(v.status == FALSE for v in vs):
            filled.append((e, vs))
        elif st in SHUT_ISH and all(v.status == TRUE for v in vs):
            still_open.append((e, vs))
    return filled, still_open


# ---------------------------------------------------------------------------


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--refusals", action="store_true",
                    help="list every refused segment, grouped by kind")
    ap.add_argument("--shapes", action="store_true",
                    help="print the declared shapes and exit 0")
    ap.add_argument("--entry", metavar="ID",
                    help="show every segment of one entry and its verdict")
    ap.add_argument("--slow", action="store_true",
                    help="pass --slow to quality/audit_register.py so its "
                         "corpus derivations are reported rather than SKIPPED")
    ap.add_argument("--no-derivations", action="store_true",
                    help="skip the audit_register.py subprocess entirely")
    ap.add_argument("--pins", action="store_true",
                    help="print every pin quality/audit_*.py commits to, and "
                         "exit 0 — the population the doctrine 17 check "
                         "derives its expectations from")
    ap.add_argument("--prose", action="store_true",
                    help="print every claim the prose documents make under "
                         "`PROSE_SHAPES` and the verdict on each, and exit "
                         "0 — the population those shapes read outside the "
                         "two registers")
    a = ap.parse_args(argv)

    if a.prose:
        results, refusals = sweep_prose()
        print("PROSE DOCUMENTS — %s" % ", ".join(PROSE_SCOPE))
        for _n, _d in sorted(PROSE_SHAPES.items()):
            print("shape asked: %-18s over %s" % (_n, ", ".join(_d)))
        for rel, why in refusals:
            print("  [REFUSED] %s could not be read — %s" % (rel, why))
        for seg, v in results:
            print("\n  [%-5s] %s:%d" % (v.status, seg.entry.source, seg.lineno))
            # `claim`, not `paths`: two shapes are asked here now and only
            # one of them is about paths.
            print("      claim : %s" % v.claim)
            print("      repo  : %s" % v.measured)
        print("\n%d citation(s) over %d document(s)."
              % (len(results), len(PROSE_SCOPE) - len(refusals)))
        return 0

    if a.pins:
        rels = audit_modules()
        total = 0
        for rel in rels:
            src = open(os.path.join(ROOT, rel), encoding="utf-8").read()
            pins = pin_literals(src) or {}
            total += len(pins)
            print("\n%s   %d pin(s)   documents: %s"
                  % (rel, len(pins), ", ".join(cited_documents(src)) or "none"))
            for k, (text, _v) in sorted(pins.items()):
                print("    %-64s %s" % ("/".join(k), text))
        moves, _live, _n, refusal = pin_supersession()
        print("\n%d pins in %d files; %d have MOVED in git history."
              % (total, len(rels), len(moves)))
        if refusal:
            print("REFUSED: %s" % refusal)
        return 0

    if a.shapes:
        print("DECLARED CLAIM SHAPES — %d" % len(SHAPES))
        for name, vol, fn in SHAPES:
            print("\n  %s%s" % (name, "   [VOLATILE]" if vol else ""))
            for line in (fn.__doc__ or "").strip().split("\n"):
                print("      %s" % line.strip())
        return 0

    entries, results = sweep()
    commit = head_commit()

    if a.entry:
        for seg, v in results:
            if seg.entry.id != a.entry:
                continue
            print("[%-8s] %-20s %s" % (v.status, v.shape or v.kind,
                                       seg.text[:100]))
            if v.status != REFUSED or v.kind != NO_SHAPE:
                print("            claim: %s\n            repo : %s"
                      % (v.claim, v.measured))
        return 0

    asked = len(results)
    answered = [(s, v) for s, v in results if v.status in (TRUE, FALSE)]
    refused = [(s, v) for s, v in results if v.status == REFUSED]
    false = [(s, v) for s, v in answered if v.status == FALSE]

    print("=" * 78)
    print("ENTRY CLAIMS — MISSING.md and BACKLOG.md, checked at %s" % commit)
    print("=" * 78)
    print("  %d entries: %s"
          % (len(entries), ", ".join("%d %s" % (n, s) for s, n in sorted(
              collections.Counter(e.source for e in entries).items()))))
    print()
    print("  asked %d, answered %d, refused %d"
          % (asked, len(answered), len(refused)))
    print("      asked    = every claim drawn from every segment, headings "
          "included;")
    print("                 a segment no shape recognises still counts as one "
          "asked claim")
    print("      answered = a declared shape resolved it against the repo")
    print("      refused  = no shape, or a shape with no coordinate to work "
          "from")
    print()

    print("  ANSWERED, by shape:")
    per = collections.defaultdict(lambda: [0, 0])
    for _s, v in answered:
        per[v.shape][0 if v.status == TRUE else 1] += 1
    #: A DISCHARGED cross-reference is resolved -- the shape read both files
    #: and both agreed with the entry's declaration -- so it counts toward
    #: STATUS_XREF's live control even though it lands in `refused`.
    xref_discharged = sum(1 for _s, v in refused
                          if v.shape == "STATUS_XREF" and v.kind == DISCHARGED)
    for name, vol, _fn in SHAPES:
        t, f = per.get(name, [0, 0])
        print("    %-22s %3d true  %3d FALSE%s"
              % (name, t, f, "   [VOLATILE, measured at %s]" % commit if vol else ""))

    print()
    dead = [n for n, _v, _f in SHAPES if not per.get(n)]
    if dead:
        print("    [dead] %s matched no segment in this run — a shape with no "
              "live instance\n           proves nothing about the register; "
              "see the positive control below."
              % ", ".join(dead))

    print()
    print("  REFUSED, by kind — the honest size of the unchecked remainder:")
    for kind, n in sorted(collections.Counter(v.kind for _s, v in refused).items(),
                          key=lambda kv: -kv[1]):
        print("    %-22s %4d" % (kind, n))

    print()
    print("=" * 78)
    if false:
        print("FALSE CLAIMS — %d" % len(false))
        print("=" * 78)
        for seg, v in false:
            print("\n  %s %s:%d  [%s]  status %s"
                  % (seg.entry.source, seg.entry.id, seg.lineno, v.shape,
                     seg.entry.status))
            print("    entry says : %s" % v.claim)
            print("    repo says  : %s" % v.measured)
            if v.note:
                print("    %s" % v.note)
            print("    text       : %s" % seg.text[:150])
    else:
        print("FALSE CLAIMS — none")
        print("=" * 78)

    filled, still_open = status_content(entries, results)
    print()
    print("STATUS vs CONTENT")
    print("-" * 78)
    if filled:
        for e, vs in filled:
            print("  [FAIL] %s %s is %s and every absence-claim in it is FALSE"
                  % (e.source, e.id, e.status))
            for v in vs:
                print("         %s -> %s" % (v.claim, v.measured))
    else:
        print("  [ok  ] no OPEN/PARTIAL/BLOCKED entry has all its absence-"
              "claims already filled")
    if still_open:
        for e, vs in still_open:
            print("  [note] %s %s is %s and its absence-claim is still TRUE "
                  "(allowed: a shut entry may record a residue, and N-2 does)"
                  % (e.source, e.id, e.status))
            for v in vs:
                print("         %s -> %s" % (v.claim, v.measured))

    prose_results, prose_refusals = sweep_prose()
    prose_false = [(s, v) for s, v in prose_results if v.status == FALSE]
    prose_true = [(s, v) for s, v in prose_results if v.status == TRUE]
    print()
    print("CLAIMS IN PROSE — %s, over %s"
          % (", ".join(sorted(PROSE_SHAPES)), ", ".join(PROSE_SCOPE)))
    print("-" * 78)
    print("  a backticked repo path must exist unless the sentence says it "
          "does not; a")
    print("  per-family capacity figure must re-derive from "
          "data/rhyme_capacity_eng.tsv; a")
    print("  shipped floor threshold must re-derive from quality/floor.py. "
          "Counted apart")
    print("  from the register's triple above: these are not claims drawn "
          "from an entry.")
    for rel, why in prose_refusals:
        print("  [REFUSED] %s could not be read — %s" % (rel, why))
        print("            doctrine 20 — this is not a pass. A document this "
              "check never")
        print("            opened cannot be reported clean.")
    # SEGMENTS and CITATIONS are different counts and the report gives both:
    # one sentence can cite four paths, so "94 checked" against 117 actual
    # citations would understate the population by a quarter (doctrine 91 — a
    # count is a coordinate of the rendering).
    #
    # PER SHAPE, NEVER POOLED (doctrine 79). Two shapes are asked here over two
    # different document sets, and one total would say nothing about either:
    # a capacity shape that stopped matching would vanish into the path count,
    # which is the silence this whole file exists to break. Each shape also
    # reports its own DEAD state, because "0 claims" reads exactly like "0
    # failures" (doctrine 20).
    for name in sorted(PROSE_SHAPES):
        mine = [(sg, v) for sg, v in prose_results if v.shape == name]
        cites = sum(len(set(PATH_RE.findall(sg.text))) for sg, _v in mine) \
            if name == "REPO_PATH_EXISTS" else len(mine)
        # (for the two derived shapes a verdict IS a segment; only
        # REPO_PATH_EXISTS can hold several citations in one sentence)
        print("  %-17s %d citation(s) in %d segment(s): %d true, %d FALSE, "
              "%d refused."
              % (name, cites, len(mine),
                 sum(1 for _s, v in mine if v.status == TRUE),
                 sum(1 for _s, v in mine if v.status == FALSE),
                 sum(1 for _s, v in mine if v.status == REFUSED)))
        if not mine and not prose_refusals:
            print("    [dead] %s matched NOTHING over %s — so nothing here "
                  "proves the" % (name, ", ".join(PROSE_SHAPES[name])))
            print("           scope reads them; see the probes below.")
    for seg, v in prose_false:
        print("\n  [FAIL] %s:%d" % (seg.entry.source, seg.lineno))
        print("         doc says : %s" % v.claim)
        print("         repo says: %s" % v.measured)
        print("         text     : %s" % seg.text[:150])

    moves, live_pins, pin_files, pin_refusal = pin_supersession()
    vanished = [m for m in moves if m.status == "VANISHED"]
    unmarked = [m for m in moves if m.status == "UNMARKED"]
    print()
    print("PIN SUPERSESSION — doctrine 17, over quality/audit_*.py")
    print("-" * 78)
    print("  a check may be kept after its premise is falsified, but never "
          "quoted as if")
    print("  it were not. IF a pin moved, its documents must still carry the "
          "old value.")
    if pin_refusal:
        print("  [REFUSED] %s" % pin_refusal)
        print("            doctrine 20 — this is not a pass. The check could "
              "not fire at all,")
        print("            and a clean line here would be a null from an "
              "instrument that")
        print("            never ran.")
    else:
        print("  %d pins in %d files; %d moved."
              % (live_pins, pin_files, len(moves)))
        if not moves:
            print("    [dead] no pin has ever changed value in this history — "
                  "so nothing here")
            print("           proves the record keeps what it supersedes; "
                  "see the probes below.")
        for mv in moves:
            tag = {"ok": "ok  ", "UNMARKED": "note", "VANISHED": "FAIL",
                   "NEVER_QUOTED": "----", "REFUSED": "----"}[mv.status]
            print("  [%s] %s  %s" % (tag, mv.rel.split("/")[-1], mv.key))
            print("         %s -> %s   at %s %s  (%s)"
                  % (mv.old_text, mv.new_text, mv.sha[:8], mv.date,
                     mv.subject[:44]))
            if mv.status == "VANISHED":
                print("         it WAS on the page at %s^ and is in NONE of "
                      "%s now" % (mv.sha[:8], ", ".join(mv.docs)))
                print("         doctrine 17: keep it visible, with the date "
                      "it was superseded.")
            elif mv.status in ("REFUSED", "NEVER_QUOTED"):
                print("         %s" % mv.reason)
            else:
                print("         kept at %s%s"
                      % ("; ".join("%s:%d" % (d, n) for d, n, _l in mv.where[:3]),
                         " and %d more" % (len(mv.where) - 3)
                         if len(mv.where) > 3 else ""))
                if mv.status == "UNMARKED":
                    print("         and NOT ONE of those %d block(s) carries "
                          "a date or a supersession" % len(mv.where))
                    print("         marker. The record states a value the "
                          "instrument no longer stands")
                    print("         behind, as if it were current — which is "
                          "doctrine 17's own sentence.")
    if unmarked:
        print()
        print("  The %d note(s) above do NOT move this file's exit code, the "
              "same way" % len(unmarked))
        print("  `status_content`'s second direction does not: the remedy is "
              "a human")
        print("  editing a RESULTS document, and whether a given marker is "
              "enough is a")
        print("  judgement. A VANISHED value is not a judgement and it FAILS.")

    if not a.no_derivations:
        rows = register_derivations(slow=a.slow)
        by_v = collections.Counter(r[3] for r in rows)
        print()
        print("DERIVATIONS — %d, owned by `quality/audit_register.py`, NOT "
              "re-derived here" % len(rows))
        print("-" * 78)
        print("  %s" % ", ".join("%s %d" % (k, v) for k, v in sorted(by_v.items())))
        print("  Their verdicts do NOT move this file's exit code: that "
              "instrument owns its own")
        print("  exit policy, and D8/D9 are a deliberate FALSE calibration "
              "pair. Two exit")
        print("  policies over one instrument's output is the disagreement "
              "this file removes.")
        for ident, ids, what, verdict, claimed, measured in rows:
            if verdict in ("CONFIRMED", "SKIPPED"):
                continue
            print("\n  [%s] %s  %s  (%s)"
                  % (verdict, ident, what, ", ".join(ids) or "no entry id"))
            print("      entry says : %s" % claimed[:200])
            print("      repo says  : %s" % measured[:200])
        if not a.slow and by_v.get("SKIPPED"):
            print("\n  %d derivations were SKIPPED for cost; "
                  "`--slow` pays for them." % by_v["SKIPPED"])

    if a.refusals:
        print()
        print("REFUSED SEGMENTS")
        print("-" * 78)
        for kind in (SHAPE_RAISED, AMBIGUOUS_SCOPE, NO_INSTRUMENT,
                 HISTORICAL, DISCHARGED, NO_SHAPE):
            group = [(s, v) for s, v in refused if v.kind == kind]
            if not group:
                continue
            print("\n  %s — %d" % (kind, len(group)))
            for seg, v in group:
                print("    %s %s:%d  %s" % (seg.entry.source, seg.entry.id,
                                            seg.lineno, seg.text[:96]))
                if v.measured:
                    print("        %s" % v.measured)

    # Doctrine 76/31: a null needs the demonstration that the instrument could
    # have found something, and it needs it BEFORE the null is believed.
    probes = self_test() + prose_self_test() + pin_self_test()
    broken = [(n, r) for n, r in probes if r != "ok"]
    print()
    print("POSITIVE CONTROL — can each shape still fire?")
    print("-" * 78)
    for n, r in probes:
        print("  [%s] %s%s" % ("ok  " if r == "ok" else "FAIL", n,
                               "" if r == "ok" else "   " + r))
    # STATUS_XREF's positive control IS this count, and a count is exactly the
    # control that reads like a pass when its population empties (doctrine 20).
    # It printed `0 live cross-references resolved.` beside a green RESULT for
    # one run on 2026-08-21 while the shape was raising on every heading. Zero
    # is now a FAILING control: the register always contains BACKLOG headings
    # citing MISSING ids, so none resolving means the reader broke, not that
    # the citations went away.
    xref_live = sum(per.get("STATUS_XREF", [0, 0])[:2]) + xref_discharged
    if xref_live:
        print("  (STATUS_XREF is exercised by the sweep itself: %d live "
              "cross-reference(s) resolved — %d true, %d FALSE, %d "
              "discharged.)"
              % (xref_live, per.get("STATUS_XREF", [0, 0])[0],
                 per.get("STATUS_XREF", [0, 0])[1], xref_discharged))
    else:
        probes = probes + [("STATUS_XREF live control",
                            "ZERO cross-references resolved — every BACKLOG "
                            "heading citing a MISSING id went unanswered, "
                            "which is a broken reader and not an empty "
                            "register")]
        broken = [(n, r) for n, r in probes if r != "ok"]
        print("  [FAIL] STATUS_XREF live control — ZERO cross-references "
              "resolved; the shape matched nothing.")

    # A prose REFUSAL counts too, and that is the point of returning it rather
    # than skipping the document: an unreadable CLAUDE.md must not read as a
    # clean CLAUDE.md (doctrine 20/28).
    bad = (len(false) + len(filled) + len(broken) + len(vanished)
           + len(prose_false) + len(prose_refusals))
    print()
    print("RESULT:", "PASS" if not bad else "FAIL (%d)" % bad)
    if bad:
        print("\nA FALSE entry is a failing check, not something a later "
              "session trips over.\nFix the ENTRY (or the code it describes); "
              "do not delete the shape.")
    return 0 if not bad else 1


if __name__ == "__main__":
    sys.exit(main())
