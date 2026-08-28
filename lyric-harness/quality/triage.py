#!/usr/bin/env python3
"""WHAT IS ACTUALLY NEXT — the registers' declared status, crossed against the
evidence in the tree.

    python3 quality/triage.py              # the four buckets, and the queue
    python3 quality/triage.py --next       # only the answer to "what's next"
    python3 quality/triage.py --check      # exit 1 if any entry is CONTESTED
    python3 quality/triage.py --entry M-2  # one entry, all its evidence

WHY THIS FILE EXISTS, AND IT IS A MEASUREMENT AND NOT A HUNCH.

On 2026-08-21 the top three open items on `BACKLOG.md` were picked off in
order, to do them. All three were already done:

  1.5  duplicate findings in the brief -- fixed in THREE places, and its own
       regression could not have failed (no finding on its fixture repeats a
       line at all, so it asked a question of an empty population)
  2.1  the 詩 standard on 詞 -- `standard=` shipped as a declared coordinate,
       78.4% -> 94.0% against the 1715 spec, and `MISSING.md M-1` still read
       `OPEN`
  2.4  the refrain stub -- THREE of its four languages shipped; Welsh did not

Three for three. A register that cannot be believed about its own top item
cannot answer "what is next", which is the only question it is for.

WHAT MAKES THIS CHECKABLE WHEN 1,164 OF THE REGISTER'S 1,299 CLAIMS ARE NOT.
`verify_entries.py` answers a claim by RE-DERIVING it, which needs a declared
shape per claim shape, and its own docstring is right that there cannot be a
general one. This file does not read the claims at all. It reads a much
narrower and much cheaper fact:

    DOES ANYTHING IN THE TREE NAME THIS ENTRY?

That is a property of the repository, not of the sentence, so it needs no
shape. It is weaker than re-derivation and it is not offered as a substitute:
an entry nothing names may still be closed, and an entry a test names may
still be open. What it does is SORT, and the sort is what was missing.

THE SIGNAL WAS VALIDATED BACKWARDS BEFORE IT WAS BUILT (doctrine 31). Of the
three stale entries above, `1.5` is named by `test_revise.py` and
`test_spans.py`, `M-1` by `test_ltc.py`, `2.4` by `test_spans.py`. All three
would have been in the CONTESTED bucket on the day they went stale. A queue
built after the fact that does not contain the cases that motivated it is a
queue fitted to nothing.

THE FOUR BUCKETS, COUNTED APART AND NEVER SUMMED (doctrine 79):

  CONTESTED       open, and a TEST names it, and the entry does not say why.
                  A passing regression named for an open gap is a
                  contradiction: either the gap is closed, or the test does
                  not test what its name says. Both are worth a minute. THIS
                  IS THE ONLY BUCKET THAT FAILS.

  DECLARED        open, a test names it, and the entry SAYS WHY -- because
                  the test pins the gap rather than guarding a fix, which is
                  a real and common thing to do. `G-1`'s test asserts that a
                  REFUSAL names G-1; `F-2`'s pins an absent field. Those are
                  correct tests of an open entry and they are declared, not
                  silenced.

                  **A DECLARATION IS A CLAIM THAT SOMEBODY READ THE ENTRY,
                  and the first sitting to use this bucket got that wrong.**
                  Nine entries were contested on 2026-08-21 and M-2 was
                  declared with the words "the entry as a whole stands"
                  WITHOUT the entry being read. It did not stand: every
                  clause of it had shipped -- the 異體字 map, the refusal
                  taxonomy, the group-name authority -- and it closed two
                  hours later. Declaring is CHEAPER than checking and looks
                  identical afterwards, which is the whole hazard. If the
                  entry has not been read, it is still CONTESTED; leave it
                  red.

  GUARDED         closed, and a test names it. The healthy shape, and it is
                  printed rather than dropped: a bucket that only ever
                  reports problems cannot be told from one that is broken.

  CITED           open, PRODUCTION code names it, and no test does. A
                  weaker signal than CONTESTED and a real one: something was
                  built near enough to this entry to cite it, and nothing
                  guards the result. ADDED AFTER THE FACT, and D-1 is why —
                  at the time, its own `Now (verified)` clause was false at
                  head, `grid.Section` had carried `function` for days, and
                  no TEST appeared to name it, so the first draft of this
                  file put it at the head of the queue while `grid.py` cited
                  it. The blind spot was found by a human reading the queue.
                  D-1 CLOSED 2026-08-21, and the second half of its story
                  closed the same day: a test HAD named it all along, in a
                  multi-key header the citation scanner read one key of
                  (see `m_win` below). The bucket stays; its founding case
                  is historical, which is what founding cases become.

  UNGUARDED       open, and NOTHING in the tree names it — not a test, not a
                  module. **This is the answer to "what is next."** Nothing
                  has been built, nothing guards it, and no test will go red
                  when somebody starts.

WHY THE ESCAPE HATCH IS ON THE ENTRY AND NOT IN THIS FILE. A safelist here
would let an entry rot while a reader of the register never saw it. The
declaration travels WITH the entry, so the person deciding what to work on is
the one who is told, and silencing this costs an edit to the register that
says what is going on.
"""

import argparse
import collections
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

MISSING_MD = os.path.join(ROOT, "MISSING.md")
BACKLOG_MD = os.path.join(ROOT, "BACKLOG.md")

#: The document-side escape hatch, shouted for the same reason
#: `check_doc_paths.js`'s is: it is meant to be conspicuous to a READER of the
#: entry, not merely parseable. Written anywhere in the entry's body.
DECLARED_RE = re.compile(r"TESTED WHILE OPEN")

#: A status that means the gap is still there. `PARTIAL` counts as open on
#: purpose -- half-built is exactly the state this file exists to surface, and
#: 2.4 (three languages of four) is the worked case.
OPEN_STATUSES = ("OPEN", "PARTIAL", "BLOCKED")

#: BACKLOG headings carry their status as a backticked marker rather than a
#: field. MEASURED off the file rather than guessed: the live vocabulary is
#: `CLOSED <date>` (7 bare, plus 2 `FOUND AND CLOSED` and 1 `ALL FIVE
#: CLOSED`), `BUILT <date>` (3), `DONE <date>` (2), `DECIDED <date>` (1) and
#: one bare `OPEN`. `MET` is the acceptance-language spelling of DONE and is
#: accepted too. The compound spellings need no clause of their own — they
#: contain CLOSED. Missing `BUILT` off this list read `3.6 Corpus
#: adversary` — which its own heading says was BUILT on 2026-08-11 —
#: as an open item at the head of the queue, i.e. the exact failure
#: this file exists to stop.
BACKLOG_CLOSED_RE = re.compile(
    r"\bCLOSED\b|\bDONE\b|\bMET\b|\bBUILT\b|\bDECIDED\b")

#: A trailing backticked marker: a status, or a cross-reference to a MISSING
#: entry. Stripped from the TITLE one at a time from the right, which is the
#: only way to keep `ltc.rhymes` in "`ltc.rhymes` uses the 詩 standard on 詞"
#: while dropping the `M-1` and `CLOSED 2026-08-21` after it. Stripping from
#: the first backtick instead — the first draft — turned that title into the
#: single word "The" on 2.4 and into nothing at all on 2.2 and 2.6.
TITLE_TAIL_RE = re.compile(
    r"\s*(?:—|-)?\s*`(?:[A-Z]-\d+[a-z]?|(?:CLOSED|DONE|MET|BUILT|OPEN|"
    r"PARTIAL|BLOCKED)\b[^`]*)`"
    # a date, an aside or a doctrine cite may follow the status (the reader
    # repair above lists the shapes); the title should not carry them either
    r"(?:\s*\d{4}-\d{2}-\d{2})?(?:\s*[—(-][^`]*)?\s*$")


def clean_title(head):
    """-> the heading with its trailing status/cross-ref markers removed and
    its own code spans intact."""
    prev = None
    while prev != head:
        prev = head
        head = TITLE_TAIL_RE.sub("", head)
    return head.strip(" —-")

#: THIS INSTRUMENT AND ITS OWN SUITE ARE NOT EVIDENCE ABOUT ANY ENTRY. Both
#: name entry ids constantly — as worked examples in prose, and as FIXTURES in
#: the tests — and counting that as a citation makes the queue self-confirming.
#: `triage.py` was excluded from the first draft; `test_triage.py` was NOT, and
#: within a day it had credited itself with guarding `BACKLOG 2.1`, which it
#: mentions only to assert that NOTHING names 2.1. A test that discusses an
#: entry is not a regression for it.
SELF = ("triage.py", "test_triage.py")

#: A MISSING id cited in code must have the word MISSING near it. MEASURED:
#: without that requirement `A-1` matches the `[A-1]` REFRAIN NOTATION in
#: `schemes.py` eleven times over, which is a section-mark convention and not
#: a citation of the entry at all -- the classic doctrine 61 over-fire, caught
#: before this file shipped rather than after.
MISSING_NEAR = 40


class Entry:
    def __init__(self, key, source, title, status, lineno, body):
        self.key = key
        self.source = source
        self.title = title
        self.status = status
        self.lineno = lineno
        self.body = body
        self.tests = []
        self.code = []

    @property
    def is_open(self):
        return self.status in OPEN_STATUSES

    @property
    def declared(self):
        return bool(DECLARED_RE.search(self.body))

    @property
    def tier(self):
        """-> sort key. BACKLOG tiers first and in order, then MISSING."""
        m = re.match(r"^(\d+)\.(\d+)$", self.key)
        if m:
            return (0, int(m.group(1)), int(m.group(2)), self.key)
        return (1, 0, 0, self.key)


def _blocks(path, header_re):
    """-> [(match, lineno, body)] for every `### ` heading the regex accepts.

    The body runs to the next `### ` OR the next `## ` -- a tier boundary ends
    an entry just as surely as the next entry does, and without the second
    stop `1.5`'s body swallowed the whole of TIER 2.
    """
    lines = open(path, encoding="utf-8").read().split("\n")
    starts = []
    for i, line in enumerate(lines):
        m = header_re.match(line)
        if m:
            starts.append((i, m))
    out = []
    for n, (i, m) in enumerate(starts):
        end = len(lines)
        for j in range(i + 1, len(lines)):
            if lines[j].startswith("### ") or lines[j].startswith("## "):
                end = j
                break
        out.append((m, i + 1, "\n".join(lines[i:end])))
    return out


#: THE OPENER AND THE STATUS ARE TWO READS, NOT ONE — repaired 2026-08-21.
#: The first draft demanded `\`STATUS\`` at END OF LINE, and the register's
#: real headings put things after it: a date (`\`CLOSED\` 2026-08-11`, eleven
#: entries), an aside (`\`PARTIAL\` — the container exists, ...`), a doctrine
#: cite (`\`BLOCKED\` (doctrine 44: cannot obtain)`). Eighteen of 77 entries
#: silently fell out of the population — among them K-7, L-1 and L-2, all
#: OPEN, which therefore appeared in NO bucket for the whole first day of
#: this instrument's life. The reader that raises on an EMPTY population had
#: quietly lost a quarter of a full one, which is doctrine 20 one grain
#: finer, and it was found only because a heading edited that day stopped
#: parsing and its entry went missing from a check. The opener is now the
#: only gate; the status is searched for INSIDE the heading, and a heading
#: with no status token at all (L-3, at the time of repair) is read as OPEN —
#: an entry that has not said it is finished must surface, not vanish.
MISSING_HEAD = re.compile(r"^### ([A-Z]-\d+[a-z]?) · (.*)$")
#: DERIVED FROM `counters.MISSING_STATUSES` SINCE 2026-08-28, found by the
#: M-21 sitting's test run: the register's closes had adopted `RESOLVED`
#: (11 headings by the day it was caught) and the two copies of this
#: vocabulary had diverged in two directions at once — this regex knew
#: CLOSED and not WITHDRAWN, counters' tuple knew WITHDRAWN and not
#: RESOLVED — so a `RESOLVED` heading parsed here as NO STATUS, was read
#: as OPEN by the fallback (which is right: an entry that has not said it
#: is finished must surface), and M-149 — resolved, and named by
#: `test_revise.py` — was filed CONTESTED with `triage --check` red at
#: HEAD, while `counters.py`'s status row CRASHED on the same headings.
#: One fact, two media — M-21's own subject, in the instrument row nobody
#: suspected. One definition now; `RESOLVED` and `WITHDRAWN` are
#: closed-family because `OPEN_STATUSES` above does not name them.
try:
    from quality.counters import MISSING_STATUSES as _STATUS_VOCAB
except ImportError:                                   # pragma: no cover
    from counters import MISSING_STATUSES as _STATUS_VOCAB
MISSING_STATUS = re.compile(r"`(%s)[^`]*`" % "|".join(_STATUS_VOCAB))
BACKLOG_HEAD = re.compile(r"^### (\d+\.\d+) · (.*)$")


def read_entries():
    """-> [Entry] over both registers.

    A register that cannot be read is an ERROR, never an empty list: the whole
    report would then read as 'nothing is contested' (doctrine 20).
    """
    out = []
    for m, ln, body in _blocks(MISSING_MD, MISSING_HEAD):
        head = m.group(2)
        st = MISSING_STATUS.search(head)
        out.append(Entry(m.group(1), "MISSING.md",
                         clean_title(head), st.group(1) if st else "OPEN",
                         ln, body))
    for m, ln, body in _blocks(BACKLOG_MD, BACKLOG_HEAD):
        head = m.group(2)
        status = "CLOSED" if BACKLOG_CLOSED_RE.search(head) else "OPEN"
        out.append(Entry(m.group(1), "BACKLOG.md", clean_title(head),
                         status, ln, body))
    if not out:
        raise RuntimeError(
            "no entries parsed from either register — the heading patterns "
            "have stopped matching, and an empty population here reads "
            "exactly like a clean one (doctrine 20)")
    return out


class NotAGitCheckout(Exception):
    """`git ls-files` cannot name this module's population.

    NOT an empty population — that is the thing this exception exists to stop
    being confused with (`MISSING.md` M-30). `_tracked` returned `[]` when git
    could not answer, so every entry's `tests` and `code` came back empty and
    `bucket()` reported the whole register UNGUARDED: a wrong answer, at exit
    0, three lines below a comment in this same file warning that *"an empty
    population here reads exactly like a clean one (doctrine 20)"*.

    MEASURED 2026-08-22 in a real shadow tree built by `quality/mutate.py`
    (`shutil.copytree`, no `.git`): `quality/test_triage.py` came back ERROR
    with an `IndexError`, because §5's own non-empty guard fired correctly and
    the next line indexed `[0]` anyway. So the ONE suite that grades the
    register was reported to the mutation baseline as "could not run" rather
    than as the legible failure it had already written.
    """


def _tracked(*globs):
    """-> [path, ...] tracked files matching `globs`. REFUSES if it cannot ask.

    The two cases are told apart before the listing: outside a git work tree
    the question is unanswerable and this raises, while INSIDE one an empty
    listing is a real finding and is returned as the empty list it is.
    """
    probe = subprocess.run(["git", "rev-parse", "--is-inside-work-tree"],
                           cwd=ROOT, capture_output=True, text=True)
    if probe.returncode != 0 or probe.stdout.strip() != "true":
        raise NotAGitCheckout(
            "%s is not a git work tree, so `git ls-files` cannot name the "
            "population this module scans. That is INCONCLUSIVE, not an "
            "empty register (doctrine 20) — every entry would come back with "
            "no test and no code, and the whole register would read "
            "UNGUARDED." % ROOT)
    p = subprocess.run(["git", "ls-files", *globs], cwd=ROOT,
                       capture_output=True, text=True)
    return [f for f in p.stdout.split("\n") if f.strip()]


def is_test(path):
    return os.path.basename(path).startswith("test_")


def scan(entries):
    """Fill each entry's `tests` and `code` lists. Reads every tracked .py/.js
    ONCE and asks all entries of it, rather than grepping per entry."""
    by_key = {e.key: e for e in entries}
    #: `BACKLOG 2.6` AND `BACKLOG §2.6`. The section sign was missed by the
    #: first draft and it is not a rare spelling: MEASURED 2026-08-21, NINE
    #: citations across four entries use it, including ALL THREE for 2.6 —
    #: whose answer, `relations_null.py`, names the entry in its own first
    #: line. So 2.6 sat at the head of "what is next" while being fully
    #: built, and the miss was found the same way the CITED bucket was: a
    #: human read the head of the queue and checked it. A citation scanner
    #: is only as good as its spellings, and the spellings are a property of
    #: the repo rather than of the scanner (doctrine 58).
    b_re = re.compile(r"BACKLOG(?:\s+|\s*§\s*)(\d+\.\d+)")
    #: EVERY key in the window, not the first. The old pattern was non-greedy
    #: up to ONE capture, so "`MISSING.md` A-1, A-2, D-1, D-2, D-3" — the
    #: header of `test_song_function.py`, and a completely ordinary way to
    #: cite five entries — was read as citing A-1 alone. D-1 sat in UNGUARDED
    #: for the whole life of this file while a test named it, and this file's
    #: own docstring cited D-1 as the proof the CITED bucket was needed.
    #: MEASURED 2026-08-21: the fix moves D-1, D-2 and D-3 into the named
    #: population; the lookalike guards below are unchanged because the window
    #: is the same 40 characters (test_triage.py §3 pins both directions).
    m_win = re.compile(r"MISSING(?:\.md)?`?([^\n]{0,%d})" % MISSING_NEAR)
    key_re = re.compile(r"\b([A-Z]-\d+[a-z]?)\b")
    for rel in _tracked("*.py", "*.js", "*.mjs"):
        if os.path.basename(rel) in SELF:
            continue
        try:
            text = open(os.path.join(ROOT, rel), encoding="utf-8",
                        errors="replace").read()
        except OSError:
            continue
        keys = set(b_re.findall(text)) | {
            k for w in m_win.findall(text) for k in key_re.findall(w)}
        for k in keys:
            e = by_key.get(k)
            if e is None:
                continue
            (e.tests if is_test(rel) else e.code).append(rel)
    return entries


def bucket(e):
    if not e.is_open:
        return "GUARDED" if e.tests else "CLOSED-QUIET"
    if e.tests:
        return "DECLARED" if e.declared else "CONTESTED"
    #: A TEST is what makes an entry guarded; a module MENTIONING it is not.
    #: Kept apart rather than merged into either neighbour, because "somebody
    #: built near this and left no regression" and "nobody has touched this"
    #: are different next actions (doctrine 79).
    return "CITED" if e.code else "UNGUARDED"


def main(argv=None):
    ap = argparse.ArgumentParser(
        description="What is actually next: declared status vs the tree.")
    ap.add_argument("--check", action="store_true",
                    help="exit 1 if any entry is CONTESTED")
    ap.add_argument("--next", action="store_true",
                    help="print only the UNGUARDED queue")
    ap.add_argument("--entry", metavar="ID",
                    help="one entry, and every file that names it")
    a = ap.parse_args(argv)

    # THE REFUSAL IS NAMED, NOT TRACEBACKED (`MISSING.md` M-30). Run from a
    # copied tree this module cannot read its own population, and answering
    # anyway would report the whole register UNGUARDED at exit 0.
    try:
        entries = scan(read_entries())
    except NotAGitCheckout as exc:
        print("REFUSED — %s" % exc)
        print("RESULT: REFUSED (not a pass, not a failure -- doctrine 20)")
        return 2
    buckets = collections.defaultdict(list)
    for e in entries:
        buckets[bucket(e)].append(e)

    if a.entry:
        hit = [e for e in entries if e.key == a.entry]
        if not hit:
            print("no entry %r in either register" % a.entry)
            return 2
        e = hit[0]
        print("%s  %s:%d  %s" % (e.key, e.source, e.lineno, e.status))
        print("  %s" % e.title)
        print("  bucket   : %s" % bucket(e))
        print("  declared : %s" % ("yes" if e.declared else "no"))
        print("  tests    : %s" % (", ".join(e.tests) or "none"))
        print("  code     : %s" % (", ".join(e.code) or "none"))
        return 0

    nxt = sorted(buckets["UNGUARDED"], key=lambda x: x.tier)
    if a.next:
        for e in nxt:
            print("%-6s %-9s %s" % (e.key, e.status, e.title[:64]))
        return 0

    print("=" * 78)
    print("WHAT IS NEXT — %d entries, declared status against the tree"
          % len(entries))
    print("=" * 78)
    print("  CONTESTED %d   DECLARED %d   GUARDED %d   CITED %d   "
          "UNGUARDED %d"
          % (len(buckets["CONTESTED"]), len(buckets["DECLARED"]),
             len(buckets["GUARDED"]), len(buckets["CITED"]),
             len(buckets["UNGUARDED"])))
    print("  (five counts, never summed — doctrine 79; %d closed entry that "
          "no test names is\n   a sixth state and not a problem)"
          % len(buckets["CLOSED-QUIET"]))

    if buckets["CONTESTED"]:
        print("\nCONTESTED — open, but a REGRESSION names it. Either the gap "
              "is closed or the")
        print("test does not test what its name says.")
        for e in sorted(buckets["CONTESTED"], key=lambda x: x.tier):
            print("  %-6s %-9s %s:%d" % (e.key, e.status, e.source, e.lineno))
            print("         %s" % e.title[:66])
            print("         named by %s" % ", ".join(e.tests))
        print("\n  Close the entry, or say in its body why a test names it "
              "while it stays")
        print('  open, in these words: "TESTED WHILE OPEN".')

    if buckets["DECLARED"]:
        print("\nDECLARED — open, a test names it, and the entry says why.")
        for e in sorted(buckets["DECLARED"], key=lambda x: x.tier):
            print("  %-6s %-9s %s" % (e.key, e.status, e.title[:58]))

    if buckets["CITED"]:
        print("\nCITED — open, a MODULE names it, no test guards it. Worth a "
              "read before")
        print("starting: something was built near enough to cite the entry. "
              "The founding")
        print("case was D-1 — cited by `grid.py`, stale at head, CLOSED "
              "2026-08-21.")
        for e in sorted(buckets["CITED"], key=lambda x: x.tier)[:12]:
            print("  %-6s %-9s %-42s %s"
                  % (e.key, e.status, e.title[:42], ", ".join(e.code[:2])))
        if len(buckets["CITED"]) > 12:
            print("  ... and %d more" % (len(buckets["CITED"]) - 12))

    print("\nUNGUARDED — open, and NOTHING in the tree names it. "
          "THIS IS THE QUEUE.")
    if not nxt:
        print("  [dead] every open entry is named by something, which after "
              "the 2026-08-21")
        print("         sweep is more likely a broken scan than an empty "
              "backlog (doctrine 20).")
    for e in nxt[:25]:
        print("  %-6s %-9s %s" % (e.key, e.status, e.title[:64]))
    if len(nxt) > 25:
        print("  ... and %d more; `--next` prints them all" % (len(nxt) - 25))

    if a.check and buckets["CONTESTED"]:
        print("\nFAIL — %d entry/entries contested."
              % len(buckets["CONTESTED"]))
        return 1
    if a.check:
        print("\nPASS — no open entry is named by a regression without "
              "saying why.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
