#!/usr/bin/env python3
"""ENTRY CLAIMS — the sentences in MISSING.md and BACKLOG.md, checked.

    python3 quality/verify_entries.py                 # check; non-zero on a FALSE claim
    python3 quality/verify_entries.py --refusals      # + every refused claim, by kind
    python3 quality/verify_entries.py --shapes        # the declared shapes, and nothing else
    python3 quality/verify_entries.py --entry M-6     # one entry, every claim in it
    python3 quality/verify_entries.py --slow          # + audit_register's corpus derivations
    python3 quality/verify_entries.py --no-derivations  # skip the audit_register subprocess

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

TRUE = "TRUE"
FALSE = "FALSE"
REFUSED = "REFUSED"

NO_SHAPE = "NO_SHAPE"
AMBIGUOUS_SCOPE = "AMBIGUOUS_SCOPE"
HISTORICAL = "HISTORICAL"
NO_INSTRUMENT = "NO_INSTRUMENT"

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
        _HEAD = subprocess.run(["git", "-C", ROOT, "rev-parse", "--short", "HEAD"],
                               stdout=subprocess.PIPE, text=True,
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

    def __init__(self, entry, text, lineno, historical=False, kind="prose"):
        self.entry = entry
        self.text = text
        self.lineno = lineno
        self.historical = historical
        self.kind = kind


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
        if not ln:
            flush()
            historical = False
            continue
        if ln.startswith("|"):
            flush()
            out.append(Segment(entry, ln, off, kind="table"))
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

PATH_RE = re.compile(r"`([\w.-]+/[\w./-]+\.(?:py|md|tsv|txt|json))`")

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
        window = low[m.end():m.end() + ABSENCE_WINDOW]
        if any(ph.lower() in window for ph in PATH_ABSENT_PHRASES):
            asserted_absent.add(m.group(1))
    present = [h for h in hits
               if os.path.exists(os.path.join(ROOT, h))]
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

STAGED_RE = re.compile(
    r"\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+"
    r"(?:of\s+the\s+)?(?:staged\s+)?(English|Persian|Finnish|Welsh|Malay|"
    r"Sanskrit|Middle Chinese|Chinese)\s+(?:files|texts)\b", re.I)
STAGED_RE2 = re.compile(
    r"\bthe\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+"
    r"staged\s+(English|Persian|Finnish|Welsh|Malay|Sanskrit|Middle Chinese|"
    r"Chinese)\s+files\b", re.I)


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
        claimed = int(tok)
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


def shape_corpus_table_row(seg):
    """A table row `| \\`fin_\\` | Finnish | 962 |` -- songs staged under one
    prefix, where a song is a `--- TITLE:` line (K-1's own stated rule, which
    `audit_register.py` D1 also uses).

    VOLATILE, and this is the shape most likely to fail on a corpus cell's
    commit rather than on a real error, which is why its verdict prints the
    commit it was measured at and the entry it belongs to is expected to pin
    the same way.
    """
    m = TABLE_ROW_RE.match(seg.text.strip())
    if not m:
        return None
    prefix, claimed = m.group(1), int(m.group(3).replace(",", ""))
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


def shape_status_xref(seg):
    """A BACKLOG.md heading cites a MISSING.md entry: `M-6`, `K-1, K-3`, `L-5`.

    Two things are asserted by such a citation and both are checkable: the id
    EXISTS, and the two files agree about whether it is done. `DONE`, `CLOSED`,
    `DECIDED` and `BUILT` in a BACKLOG heading are shut; MISSING's `CLOSED` and
    `WITHDRAWN` are shut; everything else is open.
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
    bad = []
    for i in ids:
        there_shut = known[i].status in SHUT_ISH
        if here_shut != there_shut:
            bad.append("%s: BACKLOG %s / MISSING %s"
                       % (i, seg.entry.status or "open", known[i].status))
    if bad:
        return Verdict("STATUS_XREF", FALSE, "cites %s" % ", ".join(ids),
                       "; ".join(bad))
    return Verdict("STATUS_XREF", TRUE, "cites %s" % ", ".join(ids),
                   "every id exists and the two files agree")


# --- the 26 derivations another instrument already owns ---------------------

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
]

#: The shapes whose verdict flips meaning with the entry's STATUS. An absence
#: that is TRUE under CLOSED, or FALSE under OPEN, is a status/content
#: disagreement even when the claim itself is judged correctly.
ABSENCE_SHAPES = {"SYMBOL_ABSENT", "CORPUS_MARKER_ABSENT"}

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
    def __init__(self, ident, status, heading):
        self.id, self.status, self.heading = ident, status, heading
        self.source = "SELFTEST"


def _probe(text, ident="X-0", status="OPEN", heading="### X-0 · probe `OPEN`",
           kind="prose"):
    return Segment(_FakeEntry(ident, status, heading), text, 0, kind=kind)


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
]

_BY_NAME = {name: fn for name, _v, fn in SHAPES}


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
                    v = Verdict(name, REFUSED, seg.text[:70],
                                "%s: %s" % (type(exc).__name__, exc),
                                NO_INSTRUMENT)
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
    a = ap.parse_args(argv)

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
        for kind in (AMBIGUOUS_SCOPE, NO_INSTRUMENT, HISTORICAL, NO_SHAPE):
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
    probes = self_test()
    broken = [(n, r) for n, r in probes if r != "ok"]
    print()
    print("POSITIVE CONTROL — can each shape still fire?")
    print("-" * 78)
    for n, r in probes:
        print("  [%s] %s%s" % ("ok  " if r == "ok" else "FAIL", n,
                               "" if r == "ok" else "   " + r))
    print("  (STATUS_XREF is exercised by the sweep itself: %d live "
          "cross-references resolved.)" % per.get("STATUS_XREF", [0, 0])[0])

    bad = len(false) + len(filled) + len(broken)
    print()
    print("RESULT:", "PASS" if not bad else "FAIL (%d)" % bad)
    if bad:
        print("\nA FALSE entry is a failing check, not something a later "
              "session trips over.\nFix the ENTRY (or the code it describes); "
              "do not delete the shape.")
    return 0 if not bad else 1


if __name__ == "__main__":
    sys.exit(main())
