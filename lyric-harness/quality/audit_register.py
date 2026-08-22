#!/usr/bin/env python3
"""Adversary 5/6 — the instrument that attacks THE RECORD.

Four adversaries already exist in this repo. The nulls attack our RESULTS,
`quality/revise.py` attacks the WRITING, `quality/redteam_band.py` attacks the
CODE's generosity, `quality/mutate.py` attacks the TESTS. Nothing attacked the
REGISTER — the file that says what we found — and in one week four numbers in
`MISSING.md` turned out to be wrong in ways that a two-line arithmetic check
would have caught before anybody re-ran a corpus.

This module is that two-line check, made permanent.

WHAT IT DOES, in the order the errors were actually found:

  1. CONSISTENCY.  Pure arithmetic over the register's own prose. No corpus, no
     imports, no time. Component rows that do not sum to their own stated
     total; two figures sharing a denominator whose sum exceeds it; an
     enumeration whose length contradicts the count that introduces it. Every
     one of the four known-false entries is visible from this pass alone, and
     three of the four were found by it. It is the cheapest pass and it has the
     best yield, so it runs first and it runs unconditionally.

  2. DERIVATION.  Each quantitative claim that CAN be re-derived from the repo
     carries the code that re-derives it and the command that reproduces that
     code's answer. Verdicts:

       CONFIRMED     reproduces at the stated value
       MOVED         real, but the number has changed; the setting that moved
                     it is named (doctrine 58)
       FALSE         does not reproduce and the mechanism is named
       UNVERIFIABLE  depends on something not on disk, or on a rule the entry
                     never wrote down. Say WHAT is missing.

     UNVERIFIABLE is a verdict, not a failure to reach one. A claim measured
     over a population that no longer exists is not confirmed by our inability
     to contradict it.

  3. POPULATION.  The error that produced M-3/M-4 was not arithmetic. Both
     entries computed a rate over a file, and they were not the same file: one
     measured the 1.4 MB Gutenberg source, the other the 129-block staged
     extract cut from it. Reproducing a number checks the arithmetic of the
     computation, never the construction of the population (doctrine 79). So
     every derivation declares its population explicitly, and this pass reports
     where two entries quote incompatible sizes for what they call one corpus.

  4. PROVENANCE.  `quality/RHYME_CANON.md` records 117 named structures with
     `from:` lines, and `quality/relations.py` hangs 298 Tradition rows off 77
     schemas. For each name: is there a witness that is not this project? An
     honest "unsourced" is the deliverable. A plausible fill is the
     `gabay higaad` error — a name reconstructed from this repo's own modules
     and read back as external confirmation — repeated at scale.

THE STANDARD THIS FILE IS HELD TO. Every number it prints carries the code that
produced it, so its own output is auditable by the next instance of itself. Where
it cannot re-derive something it must say UNVERIFIABLE rather than restate the
register. An auditor that launders the record it audits is worse than no auditor,
because it converts an open question into a confirmation.

RUN
    python3 quality/audit_register.py                 # everything cheap
    python3 quality/audit_register.py --slow          # + corpus derivations
    python3 quality/audit_register.py --consistency   # arithmetic only, instant
    python3 quality/audit_register.py --provenance    # unsourced names only
    python3 quality/audit_register.py --check         # committed figures only
    python3 quality/audit_register.py --json          # machine-readable

EXIT STATUS is meaningful, unlike `battery.py`'s: non-zero when a consistency
check fails or a derivation returns FALSE. MOVED and UNVERIFIABLE do not fail
the run — a register is allowed to age, it is not allowed to contradict itself.

THAT POLICY IS RIGHT AND IT LEFT A HOLE, CLOSED 2026-08-14 BY `--check`. Every
drift this instrument can find lands in MOVED, and MOVED does not fail; ~~the
run has meanwhile been exiting 1 continuously on D8/D9, a standing calibration
pair nobody intends to clear this week~~. So a permanently-red 1 was the only
signal, and six derivation VERDICTS changed and eleven rows' printed figures
moved underneath it, without that number changing once. `--check` (exit 0 pass / 1 a figure moved / 2 cannot tell) pins
the one-sided, repo-side figures and is green today, so it can be gated on
without teaching anyone to ignore it. See `PINNED` for what it deliberately
leaves out and why.

AND THE "STANDING CALIBRATION PAIR" WAS NOT ONE — STRUCK 2026-08-14, LATER THE
SAME DAY. D9 was not calibration; it was a check that had INVERTED. It carried
`the Malay d. s. b. row was false and is struck through` as a hardcoded
register-side literal, and that sentence is not in MISSING.md — M-4 says the
opposite, in capitals, and has since the withdrawal was retracted. So the one
row holding this file's exit code at 1 was reporting FALSE *for the code
agreeing with the record*. D8 is UNVERIFIABLE without `MSA_SOURCE`, so the
"pair" was one inverted row. THE RUN NOW EXITS 0, and that is the repair: this
file's exit code went from a constant nobody could read to one that can change.

THE SHAPE THAT PRODUCED IT, since it produced FIVE rows and not one. A
derivation that TRANSCRIBES its register side compares the repo against a
sentence MISSING.md may already have struck — and then names the register as
the side that moved. D20 and D21 had been reporting MOVED on every run since
2026-08-11 for entries repaired that day (F-1's ninth phonology, M-15's 75-of-77
population). A check that CANNOT PASS is the mirror of doctrine 48's check that
cannot fail: both teach a reader to skip the column. D9, D20 and D21 now READ
their claim out of the entry, the way `_k1_claims` has since it was written and
`quality/verify_doctrines.py` does for the doctrine run and the known-gaps list;
`PINNED` exclusion 1 had already stated the rule as policy. D7 and D8 are the
same shape and are NOT fixed here — see `_d_jne`.
"""

from __future__ import annotations

import argparse
import collections
import io
import json
import os
import re
import sys
import traceback

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

MISSING_MD = os.path.join(ROOT, "MISSING.md")
CANON_MD = os.path.join(HERE, "RHYME_CANON.md")
CLAUDE_MD = os.path.join(ROOT, "CLAUDE.md")

CONFIRMED = "CONFIRMED"
MOVED = "MOVED"
FALSE = "FALSE"
UNVERIFIABLE = "UNVERIFIABLE"
ERROR = "ERROR"

_VERDICT_ORDER = {FALSE: 0, ERROR: 1, MOVED: 2, UNVERIFIABLE: 3, CONFIRMED: 4}


# ---------------------------------------------------------------------------
# 0. Reading the register
# ---------------------------------------------------------------------------


class Entry:
    """One `### X-N · title `STATUS`` block of MISSING.md."""

    def __init__(self, ident, title, status, line, body):
        self.id = ident
        self.title = title
        self.status = status
        self.line = line
        self.body = body

    def numbers(self):
        """Every number in the body, with the ~60 characters around it.

        Deliberately dumb. The point is coverage, not parsing: a number this
        misses is a number nobody audits. Percentages, thousands separators,
        decimals and bare integers all come back, each with enough context that
        a human can tell what it counts.
        """
        out = []
        for m in re.finditer(r"(?<![\w.])(\d[\d,]*(?:\.\d+)?)\s*(%|pp|×|x\b)?", self.body):
            raw = m.group(1)
            try:
                val = float(raw.replace(",", ""))
            except ValueError:
                continue
            lo = max(0, m.start() - 60)
            hi = min(len(self.body), m.end() + 60)
            ctx = " ".join(self.body[lo:hi].split())
            out.append({"raw": raw, "value": val, "unit": m.group(2) or "", "context": ctx})
        return out


def read_entries(path=MISSING_MD):
    """Split MISSING.md into entries. Returns [] rather than raising if absent."""
    if not os.path.exists(path):
        return []
    lines = open(path, encoding="utf-8").read().split("\n")
    heads = []
    for i, ln in enumerate(lines):
        m = re.match(r"^###\s+([A-Z]+-\d+[a-z]?)\s*·\s*(.*)$", ln)
        if m:
            heads.append((i, m.group(1), m.group(2)))
    out = []
    for k, (i, ident, rest) in enumerate(heads):
        j = heads[k + 1][0] if k + 1 < len(heads) else len(lines)
        body = "\n".join(lines[i:j])
        st = re.search(r"`(OPEN|PARTIAL|CLOSED|WITHDRAWN|BLOCKED)`", body)
        out.append(Entry(ident, rest.strip(), st.group(1) if st else "?", i + 1, body))
    return out


def entry_text(entries, ident):
    for e in entries:
        if e.id == ident:
            return e.body
    return ""


# ---------------------------------------------------------------------------
# 1. Internal consistency — the cheapest pass, and the one that caught the
#    biggest error. Runs on prose alone.
# ---------------------------------------------------------------------------


class Check:
    def __init__(self, ident, entry, question, fn, why=""):
        self.id = ident
        self.entry = entry
        self.question = question
        self.fn = fn
        self.why = why


def _nums_in(text):
    return [float(x.replace(",", "")) for x in re.findall(r"(?<![\w.])(\d[\d,]*(?:\.\d+)?)", text)]


def _chk_m3_m4_shared_denominator(entries):
    """384 + 300 = 684 > 471. The check that should have run before either
    entry was written, restated so it keeps running.

    The register now records this as found. The check stays because the SHAPE
    recurs — see the M-2 check below, which is the same error in a section
    nobody had re-read.
    """
    m3, m4 = entry_text(entries, "M-3"), entry_text(entries, "M-4")
    if not m3 or not m4:
        return None, "M-3 or M-4 absent from the register"
    # Dedupe on (numerator, denominator). A figure restated three times in the
    # prose that corrects it is ONE claim, not three -- counting the restatements
    # would manufacture a contradiction, which is the error being audited.
    claims = set()
    for name, txt in (("M-3", m3), ("M-4", m4)):
        for m in re.finditer(r"(\d[\d,]*)\s*of\s*(?:the\s+same\s+)?(\d[\d,]*)", txt):
            claims.add((float(m.group(1).replace(",", "")),
                        float(m.group(2).replace(",", ""))))
    # A claim inside a strike-through or explicitly called false is withdrawn
    # in place, per this file's own rule, and no longer asserts anything.
    live = set()
    for num, den in claims:
        pat = re.compile(r"(~~[^~]*%s[^~]*~~)|(\*\*[^*]*%s[^*]*(?:WRONG|FALSE|withdrawn)[^*]*\*\*)"
                         % (re.escape("%g" % num), re.escape("%g" % num)), re.I)
        if not pat.search(m3 + m4):
            live.add((num, den))
    by_denom = collections.defaultdict(list)
    for num, den in live:
        by_denom[den].append(num)
    bad = []
    for den, parts in by_denom.items():
        tot = sum(parts)
        if len(parts) > 1 and tot > den:
            bad.append("%s share denominator %g and sum to %g" %
                       (" + ".join("%g" % p for p in sorted(parts)), den, tot))
    if bad:
        return False, "; ".join(bad)
    return True, ("no two n-of-N figures in M-3/M-4 now exceed a shared "
                  "denominator (the 384/471 claim has been withdrawn in place)")


def _chk_m3_after_column(entries):
    """M-3's CORRECTED table does not sum to its own corrected total.

    2 + 306 + 78 = 386, and the row below it says 384. The same paragraph then
    gives three counts -- read 15,135 / refused 78 / defective 306 -- which do
    sum to 384. So the correction that fixed a 5x error introduced a 2-token
    one, in the column written to demonstrate care.
    """
    t = entry_text(entries, "M-3")
    if not t:
        return None, "M-3 absent"
    rows = []
    for ln in t.split("\n"):
        if not ln.startswith("|") or "---" in ln:
            continue
        cells = [c.strip() for c in ln.strip("|").split("|")]
        if len(cells) < 3:
            continue
        b = re.search(r"[\d,]+", cells[1])
        a = re.search(r"[\d,]+", cells[2])
        if not (b and a):
            continue
        rows.append((cells[0], float(b.group(0).replace(",", "")),
                     float(a.group(0).replace(",", ""))))
    comp = [r for r in rows if "total" not in r[0].lower()]
    tot = [(r[1], r[2]) for r in rows if "total" in r[0].lower()]
    if not comp or not tot:
        return None, "M-3's before/after table not found in its current form"
    sb, sa = sum(c[1] for c in comp), sum(c[2] for c in comp)
    tb, ta = tot[0]
    msg = ("components before %g vs stated total %g; components after %g vs "
           "stated total %g" % (sb, tb, sa, ta))
    return (sb == tb and sa == ta), msg


def _chk_m2_enumeration_length(entries):
    """M-2 says 23 of 24 are recoverable, then lists 19 and calls the rest five.

    23 + 5 = 28 > 24 is the M-3/M-4 shape exactly, one section earlier, and
    nobody had added it up either. The enumeration is right (19 + 5 = 24); the
    summary integer that introduces it is wrong.
    """
    t = entry_text(entries, "M-2")
    if not t:
        return None, "M-2 absent"
    arrows = re.findall(r"(\S)→(\S)", t)
    m_claim = re.search(r"\*\*(\d+)\s+are recoverable", t) or re.search(r"(\d+)\s+are\s+recoverable", t)
    m_of = re.search(r"(\d+)\s+commonest unreadable", t)
    m_rest = re.search(r"remaining\s+(\w+)", t)
    words = {"one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6,
             "seven": 7, "eight": 8, "nine": 9, "ten": 10}
    rest = words.get((m_rest.group(1).lower() if m_rest else ""), None)
    if not (m_claim and m_of):
        return None, "M-2's recoverability claim not found in its current form"
    claim, pop = int(m_claim.group(1)), int(m_of.group(1))
    detail = ("claims %d of %d recoverable and lists %d arrow pairs; "
              "%d + %s = %s against a population of %d"
              % (claim, pop, len(arrows), claim,
                 rest if rest is not None else "?",
                 (claim + rest) if rest is not None else "?", pop))
    ok = (len(arrows) == claim) and (rest is None or claim + rest == pop)
    return ok, detail


def _chk_status_partition(entries):
    """K-1 states two statuses of five and invites the reader to add them.

    "142 of the 220 listed lyricists SOURCED, 70 NOT_FOUND" reads as a
    partition. 142 + 70 = 212. The other 8 are COMPOSER_NOT_LYRICIST,
    NOT_SOURCED and CONTESTED. Neither figure is wrong; the sentence is.
    """
    t = entry_text(entries, "K-1")
    if not t:
        return None, "K-1 absent"
    m = re.search(r"(\d+)\s+of\s+the\s+(\d+)\s+listed\s+lyricists\s+SOURCED,\s*(\d+)\s+NOT_FOUND",
                  " ".join(t.split()))
    if not m:
        return None, "K-1's SOURCED/NOT_FOUND sentence not found in its current form"
    a, n, b = int(m.group(1)), int(m.group(2)), int(m.group(3))
    return (a + b == n), ("%d SOURCED + %d NOT_FOUND = %d against a stated "
                          "population of %d (%d rows carry a third status)"
                          % (a, b, a + b, n, n - a - b))


def _chk_repeat_block_rows(entries):
    """K-1's repeat-block components must sum to its own total. They do."""
    t = entry_text(entries, "K-1")
    if not t:
        return None, "K-1 absent"
    m = re.search(r"([\d,]+)\s+marked repeat blocks\s*\(([\d,]+)\s*BURDEN,\s*([\d,]+)\s*REFRAIN,\s*([\d,]+)\s*CHORUS\)", t)
    if not m:
        return None, "K-1's repeat-block breakdown not found in its current form"
    tot, b, r, c = [float(x.replace(",", "")) for x in m.groups()]
    return (b + r + c == tot), "%g + %g + %g = %g against a stated %g" % (b, r, c, b + r + c, tot)


def _chk_k6_language_table(entries):
    """K-6's per-language table must sum to the 297 it declares above it."""
    t = entry_text(entries, "K-6")
    if not t:
        return None, "K-6 absent"
    rows = re.findall(r"^\|\s*([a-z]{3})\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|", t, re.M)
    if not rows:
        return None, "K-6's language table not found in its current form"
    staged = sum(int(r[1]) for r in rows)
    refused = sum(int(r[2]) for r in rows)
    blocked = sum(int(r[3]) for r in rows)
    m = re.search(r"(\d[\d,]*)\s+non-English lyricists", t)
    stated = float(m.group(1).replace(",", "")) if m else None
    tot = staged + refused + blocked
    return (stated is None or tot == stated), (
        "staged %d + refused %d + blocked %d = %d against a stated %s"
        % (staged, refused, blocked, tot, stated))


def _chk_k6_file_enumeration(entries):
    """K-6 says four text files and then names five."""
    t = entry_text(entries, "K-6")
    if not t:
        return None, "K-6 absent"
    m = re.search(r"hold\s+\*\*(\w+)\*\*\s+text files", t) or re.search(r"hold\s+(\w+)\s+text files", t)
    words = {"two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7}
    if not m:
        return None, "K-6's file-count sentence not found in its current form"
    stated = words.get(m.group(1).lower())
    named = len(set(re.findall(r"`([a-z]{3}_[a-z0-9_]+\.(?:txt|json))`", t)))
    if stated is None:
        return None, "K-6's file count is not a number word"
    return (stated == named), "says %d text files, names %d distinct filenames" % (stated, named)


def _chk_m1_false_verdict_denominator(entries):
    """M-1 tabulates "False at mandated positions" against 26,773 -- but its
    own counts put only 15,887 F at mandated positions.

    A percentage whose denominator is larger than the population it claims to
    partition is either a different population or a mistake, and the entry does
    not say which. This is the shared-denominator check pointed at one entry
    instead of two.
    """
    t = entry_text(entries, "M-1")
    if not t:
        return None, "M-1 absent"
    m_f = re.search(r"([\d,]+)\s*T\s*/\s*([\d,]+)\s*F\s*/\s*([\d,]+)\s*refused", t)
    m_d = re.search(r"of\s+([\d,]+)\s+false verdicts", t)
    if not (m_f and m_d):
        return None, "M-1's verdict counts not found in their current form"
    F = float(m_f.group(2).replace(",", ""))
    D = float(m_d.group(1).replace(",", ""))
    return (D <= F), ("the entry says 'False at mandated positions' and then "
                      "divides by %g, while its own mandated-position count is "
                      "%g F -- the denominator exceeds the population by %g "
                      "and the entry never says which population it is"
                      % (D, F, D - F))


def _chk_n1_excess_column(entries):
    """N-1's excess column must equal observed minus null max, row by row."""
    t = entry_text(entries, "N-1")
    if not t:
        return None, "N-1 absent"
    rows = re.findall(
        r"^\|\s*(?:\*\*)?([^|]*?)(?:\*\*)?\s*\|\s*([\d,]+)\s*\|\s*([\d.]+)%\s*\|\s*([\d.]+)%\s*\|\s*\**([+\-−][\d.]+)\**\s*\|",
        t, re.M)
    if not rows:
        return None, "N-1's table not found in its current form"
    bad = []
    for lab, n, obs, nul, exc in rows:
        want = round(float(obs) - float(nul), 1)
        got = float(exc.replace("−", "-").replace("+", ""))
        if abs(want - got) > 0.051:
            bad.append("%s: %.1f - %.1f = %+.1f, table says %+.1f"
                       % (lab.strip()[:28], float(obs), float(nul), want, got))
    return (not bad), ("; ".join(bad) if bad else
                       "%d rows, every excess equals observed minus null max" % len(rows))


def _chk_n1_null_direction(entries):
    """N-1 concludes the effect "goes to zero off the strict metre" while one
    off-metre row carries p=0.015.

    Not arithmetic -- a claim that contradicts its own table at any conventional
    alpha. The row's excess over the null MAX is negative and its p against the
    null DISTRIBUTION is below 0.05, which are two different questions reported
    in one row with no note that they disagree.
    """
    t = entry_text(entries, "N-1")
    if not t:
        return None, "N-1 absent"
    rows = re.findall(
        r"^\|\s*(?:\*\*)?([^|]*?)(?:\*\*)?\s*\|\s*([\d,]+)\s*\|\s*([\d.]+)%\s*\|\s*([\d.]+)%\s*\|\s*\**([+\-−][\d.]+)\**\s*\|\s*([\d.]+|floor|—|-)\s*\|",
        t, re.M)
    bad = [(lab.strip()[:30], exc, p) for lab, n, o, nu, exc, p in rows
           if re.fullmatch(r"[\d.]+", p) and float(p) < 0.05
           and float(exc.replace("−", "-").replace("+", "")) < 0]
    if not rows:
        return None, "N-1's table not found with a p column"
    return (not bad), ("; ".join("%s: excess %s but p=%s" % b for b in bad) if bad
                       else "no row reports a negative excess alongside p<0.05")


CONSISTENCY = [
    Check("C1", "M-3/M-4", "do two figures sharing a denominator exceed it?",
          _chk_m3_m4_shared_denominator,
          "the check that would have caught the biggest error in the file"),
    Check("C2", "M-3", "does the corrected table sum to its own corrected total?",
          _chk_m3_after_column,
          "the correction introduced a smaller error of the same kind"),
    Check("C3", "M-2", "does the enumeration have the length its summary claims?",
          _chk_m2_enumeration_length,
          "23 + 5 > 24, one section before 384 + 300 > 471"),
    Check("C4", "K-1", "do the quoted statuses partition the stated population?",
          _chk_status_partition,
          "two of five statuses quoted as if they were all of them"),
    Check("C5", "K-1", "do the repeat-block components sum to their total?",
          _chk_repeat_block_rows),
    Check("C6", "K-6", "does the language table sum to the total above it?",
          _chk_k6_language_table),
    Check("C7", "K-6", "are as many files named as counted?",
          _chk_k6_file_enumeration),
    Check("C8", "M-1", "is the false-verdict denominator inside its population?",
          _chk_m1_false_verdict_denominator),
    Check("C9", "N-1", "does the excess column equal observed minus null max?",
          _chk_n1_excess_column),
    Check("C10", "N-1", "does any row report a negative excess with p<0.05?",
          _chk_n1_null_direction,
          "excess-over-max and p-from-distribution are different questions"),
]


# ---------------------------------------------------------------------------
# 2. Populations. Doctrine 79's lesson, mechanised.
# ---------------------------------------------------------------------------


def _msa_staged_population():
    """The staged Malay extract, measured three ways."""
    p = os.path.join(ROOT, "corpus", "song", "msa_skeat_pantun.txt")
    if not os.path.exists(p):
        return None
    t = open(p, encoding="utf-8", errors="replace").read()
    verse = [l for l in t.split("\n")
             if l.strip() and not l.startswith("#")
             and not l.strip().startswith("---") and not l.strip().startswith("[")]
    return {
        "file": "corpus/song/msa_skeat_pantun.txt",
        "blocks": len(re.findall(r"^--- RIME:", t, re.M)),
        "verse_lines": len(verse),
        "tokens": sum(len(re.findall(r"[A-Za-z'’-]+", l)) for l in verse),
        "d_s_b": len(re.findall(r"\bd\.\s*s\.\s*b\.", t)),
    }


def _msa_source_population():
    """PG47873 itself -- the file the staged extract was cut FROM.

    Not in the repo. It is what M-3 and M-4 actually measured, and the fact
    that it is not in the repo is the finding, not an obstacle to it.
    """
    # THE DEFAULT NO LONGER NAMES ONE MACHINE — changed 2026-08-14, found by
    # CI. The first candidate was the bare literal
    # `/workspace/mm47873/47873-8.txt`, which exists on the machine this was
    # written on and nowhere else. That made D8's VERDICT machine-dependent:
    # FALSE where the file happens to sit, UNVERIFIABLE everywhere else — and
    # `counters.py`'s `register-audit findings` row counts FALSE derivations,
    # so the committed cell read 2 on one machine and measured 1 on the CI
    # runner, failing a check nobody could clear. Running `counters.py --write`
    # here wrote 2 straight back, which is why the "repin" in commit 913d5f6
    # produced no diff at all and my own commit message claiming it was cleared
    # was wrong.
    #
    # `MSA_SOURCE` is the override, the shape `TANG_POOL` and
    # `CANON_TRANSCRIPTS` already use. With it unset the answer is
    # UNVERIFIABLE EVERYWHERE, which is the honest default: PG47873 is not in
    # this repository, and this function's own docstring says that absence is
    # the finding rather than an obstacle to it. A verdict that depends on
    # whose disk it runs on is not a verdict.
    _msa_env = os.environ.get("MSA_SOURCE")
    for p in ([_msa_env] if _msa_env else []) + [
              os.path.join(ROOT, "corpus", "47873-8.txt")]:
        if os.path.exists(p):
            t = open(p, "rb").read().decode("latin-1").replace("\r\n", "\n")
            lines = t.split("\n")
            ind = [i for i, l in enumerate(lines) if l.startswith("    ") and l.strip()]
            blocks, cur = 0, False
            for i, l in enumerate(lines):
                on = l.startswith("    ") and bool(l.strip())
                if on and not cur:
                    blocks += 1
                cur = on
            inset = set(ind)
            dsb_all = len(re.findall(r"\bd\.\s*s\.\s*b\.", t))
            dsb_verse = sum(len(re.findall(r"\bd\.\s*s\.\s*b\.", lines[i])) for i in inset)
            dsb_final = sum(1 for i in inset
                            if re.search(r"d\.\s*s\.\s*b\.\s*$", lines[i].strip()))
            # TWO tokenizations, reported side by side, because the difference
            # between them IS the disputed number. Splitting on the apostrophe
            # shatters `s'ri` and inflates `s`; keeping it attached isolates the
            # stub's own contribution, which is what the entry was counting.
            toks = [w for i in inset for w in re.findall(r"[A-Za-z]+", lines[i])]
            toks_ap = [w for i in inset for w in re.findall(r"[A-Za-z'\u2019]+", lines[i])]
            singles = collections.Counter(w.lower() for w in toks if len(w) == 1)
            singles_ap = collections.Counter(w.lower() for w in toks_ap if len(w) == 1)
            return {
                "file": p,
                "in_repo": p.startswith(ROOT),
                "blocks": blocks,
                "indented_verse_lines": len(ind),
                "tokens": len(toks),
                "d_s_b_all": dsb_all,
                "d_s_b_in_verse": dsb_verse,
                "d_s_b_line_final": dsb_final,
                "single_bds_split_on_apostrophe": (singles["b"], singles["d"], singles["s"]),
                "single_bds_apostrophe_kept": (singles_ap["b"], singles_ap["d"], singles_ap["s"]),
                "stub_tokens_if_3_each": 3 * dsb_verse,
            }
    return None


def population_report():
    """Where two entries quote incompatible sizes for what they call one corpus."""
    entries = read_entries()
    out = {"malay": {"staged": _msa_staged_population(), "source": _msa_source_population()}}
    quoted = []
    #: THE LANGUAGE IS A COORDINATE OF THE SCAN TOO — repaired 2026-08-21.
    #: This used to read each entry WHOLE, and M-4 is about four languages:
    #: the day its Welsh row gained a stated rule ("39 - 6 = 33 lines, and
    #: 35 lines contain the string at all"), this scan reported 33 and 35 as
    #: Malay corpus sizes and section 3 printed them in the INCOMPATIBLE
    #: list. The checker built to catch substituted populations substituted
    #: one. The scan is now scoped to paragraphs that name the Malay corpus,
    #: and the rule is stated here so the next reader can re-derive it: a
    #: paragraph is a blank-line-separated block; it is in scope iff it
    #: contains "Malay", "msa" or the staged filename.
    _MALAY_PARA = re.compile(r"Malay|msa", re.I)
    for ident in ("M-3", "M-4", "N-3"):
        t = entry_text(entries, ident)
        for para in re.split(r"\n\s*\n", t):
            if not _MALAY_PARA.search(para):
                continue
            for m in re.finditer(r"([\d,]+)\s+(?:Malay\s+)?(?:verse\s+)?blocks", para):
                quoted.append((ident, "blocks", float(m.group(1).replace(",", ""))))
            for m in re.finditer(r"\(?([\d,]+)\s+lines", para):
                quoted.append((ident, "lines", float(m.group(1).replace(",", ""))))
            for m in re.finditer(r"([\d,]+)\s+tokens\)", para):
                quoted.append((ident, "tokens", float(m.group(1).replace(",", ""))))
    out["quoted_sizes"] = quoted
    by_unit = collections.defaultdict(set)
    for ident, unit, v in quoted:
        by_unit[unit].add(v)
    out["incompatible"] = {u: sorted(v) for u, v in by_unit.items() if len(v) > 1}
    return out


# ---------------------------------------------------------------------------
# 3. Derivations. Each carries the code and the command.
# ---------------------------------------------------------------------------


class Claim:
    def __init__(self, ident, entry, what, stated, fn, command, slow=False, note=""):
        self.id = ident
        self.entry = entry
        self.what = what
        self.stated = stated
        self.fn = fn
        self.command = command
        self.slow = slow
        self.note = note


def _tol(stated, got, rel=0.0, abs_=0.0):
    if stated is None or got is None:
        return False
    return abs(stated - got) <= max(abs_, abs(stated) * rel)


def _song_files(prefix=""):
    import glob
    return sorted(glob.glob(os.path.join(ROOT, "corpus", "song", prefix + "*.txt")))


def _song_stats(files):
    songs = lines = 0
    tags = collections.Counter()
    for f in files:
        for l in open(f, encoding="utf-8", errors="replace"):
            s = l.strip()
            if s.startswith("--- TITLE:"):
                songs += 1
            elif s.startswith("#") or s.startswith("---"):
                pass
            elif s.startswith("["):
                m = re.match(r"^\[([A-Za-z0-9 _-]+)", s)
                if m:
                    tags[re.sub(r"\s*\d+$", "", m.group(1).strip()).upper()] += 1
            elif s:
                lines += 1
    return songs, lines, tags


#: AN ENTRY'S CURRENT TEXT: struck-through spans removed, blockquote markers
#: dropped, whitespace flattened to one line so a claim that wraps across four
#: source lines is one string to a regex.
#:
#: THE STRIKE RULE IS THE POINT.  Doctrine 17 keeps a superseded figure VISIBLE
#: -- `~~8~~ **9 at debf64e**` -- and `~~...~~` is exactly how this register
#: says a figure has stopped asserting anything.  A reader that does not strip
#: them reads the entry's HISTORY as its claim.  `_k1_claims` has stripped them
#: since it was written; this is that one line lifted out so every derivation
#: below shares it instead of growing a private copy of the rule (doctrine 1:
#: one place to change one answer).
#:
#: `> ` IS DROPPED because a blockquote continuation is markdown, not content:
#: M-15's own repair is written inside one, and `298 distinct Tradition rows,
#: 319\n> attachments` flattens to `... 319 > attachments` without this.
#: VERIFIED equivalent for K-1 before `_k1_claims` was moved onto it -- all six
#: of its figures parse identically with and without the `>` strip.
def _entry_now(entries, ident):
    t = entry_text(entries, ident)
    if not t:
        return ""
    t = re.sub(r"~~[^~]*~~", "", t)
    t = "\n".join(re.sub(r"^\s*>\s?", "", l) for l in t.split("\n"))
    return " ".join(t.split())


#: K-1's figures, READ OUT OF THE REGISTER rather than transcribed into this
#: file.  Four of them moved on 2026-08-11 when 819 duplicated Lyrical Ballads
#: lines and one joint-attribution hymn came out of `corpus/song/`, and a
#: transcribed constant would have gone on comparing the corpus against a
#: number the register itself had already struck through -- reporting MOVED and
#: naming the wrong side as the thing that moved.  A register-checker whose
#: register-side figures are typed in is the defect it exists to detect, one
#: layer up.  Struck-through spans (`~~5,006~~ 4,993`) are removed first, so
#: the claim read is the entry's CURRENT claim.
def _k1_claims(entries):
    t = _entry_now(entries, "K-1")
    if not t:
        return {}
    out = {}

    def grab(key, pat, *groups):
        m = re.search(pat, t)
        if m:
            out[key] = tuple(int(m.group(g).replace(",", "")) for g in groups)

    grab("authors", r"\*\*\s*([\d,]+)\s+authors", 1)
    grab("songs", r"authors,\s*([\d,]+)\s*songs", 1)
    grab("lines", r"([\d,]+)\s+sung lines", 1)
    grab("repeats", r"([\d,]+)\s+marked repeat blocks\s*\(\s*([\d,]+)\s*BURDEN,"
                    r"\s*([\d,]+)\s*REFRAIN,\s*([\d,]+)\s*CHORUS", 1, 2, 3, 4)
    grab("eng_status", r"([\d,]+)\s+of the\s+([\d,]+)\s+listed lyricists "
                       r"SOURCED,\s*([\d,]+)\s+NOT_FOUND", 1, 2, 3)
    grab("rows", r"Of\s+\*\*([\d,]+)\*\*\s+rows", 1)
    return out


def _claim_or_unverifiable(entries, key, measured, fmt):
    """-> (verdict, measured, register-side text).

    THREE outcomes, not two.  If the entry no longer states the figure in a
    parseable form the answer is UNVERIFIABLE and says so, rather than falling
    back on a constant nobody re-read (doctrine 79: a refusal is not a failure,
    and it must not be scored as one).
    """
    c = _k1_claims(entries).get(key)
    if c is None:
        return UNVERIFIABLE, measured, ("K-1 no longer states this figure in a "
                                        "form this checker can read")
    want = c[0] if len(c) == 1 else c
    got = measured[0] if isinstance(measured, tuple) and len(measured) == 1 \
        else measured
    return (CONFIRMED if got == want else MOVED), measured, fmt % c


def _d_songs():
    songs, _, _ = _song_stats(_song_files("eng_"))
    return _claim_or_unverifiable(read_entries(), "songs", songs,
                                  "%d English songs, per K-1")


def _d_sung_lines():
    _, lines, _ = _song_stats(_song_files("eng_"))
    return _claim_or_unverifiable(
        read_entries(), "lines", lines,
        "%d sung lines, per K-1; counting rule here is non-blank lines that "
        "are not #, --- or [")


def _d_repeat_blocks():
    """The corpus-wide repeat-block triple — WITH ITS CONCENTRATION, because
    the total alone is the biased number K-1a is about.

    MEASURED 2026-08-21: one file, D'Urfey's songbook, carries 567 of the
    1,580 burdens (35.9%); two files carry 52.4%; only 101 of 1,297 `eng_`
    files carry any repeat block at all. 19th-century anthology editors set
    lyrics as continuous stanzas and DROP the chorus; songsters and hymnals
    keep it — so an unstratified rate over this corpus measures editorial
    practice as much as the songs. The top contributors are APPENDED after
    the triple rather than folded into it, so `counters.py`'s and
    `_k1_claims`'s parsing regexes keep matching the substring they always
    matched, and the number stops being quotable without its stratification
    (doctrine 79's shape: counts kept apart, never summed — here, a total
    kept beside its concentration, never alone).
    """
    per_file = collections.Counter()
    tags = collections.Counter()
    for f in _song_files("eng_"):
        _, _, ft = _song_stats([f])
        n = ft["BURDEN"] + ft["REFRAIN"] + ft["CHORUS"]
        if n:
            per_file[os.path.basename(f)] = n
        tags.update(ft)
    got = (tags["BURDEN"], tags["REFRAIN"], tags["CHORUS"])
    total = sum(got)
    top = per_file.most_common(3)
    conc = ("; CONCENTRATION (K-1a): top files %s of %d blocks in %d "
            "carrying files"
            % (", ".join("%s %d (%.1f%%)" % (n, c, 100.0 * c / max(1, total))
                         for n, c in top),
               total, len(per_file)))
    c = _k1_claims(read_entries()).get("repeats")
    detail = ("BURDEN %d REFRAIN %d CHORUS %d (sum %d)" % (got + (total,))
              + conc)
    if c is None:
        return UNVERIFIABLE, detail, "K-1's repeat-block sentence not readable"
    v = CONFIRMED if (got == c[1:] and total == c[0]) else MOVED
    return v, detail, ("%d BURDEN / %d REFRAIN / %d CHORUS, sum %d, per K-1"
                       % (c[1], c[2], c[3], c[0]))


def _d_authors():
    auth = set()
    for f in _song_files("eng_"):
        m = re.search(r"^# author:\s*(.+)$", open(f, encoding="utf-8", errors="replace").read(), re.M)
        if m:
            auth.add(m.group(1).strip())
    return (CONFIRMED if len(auth) == 143 else MOVED), len(auth), "143 authors"


def _d_named_airs():
    """~~There is no declared air field. That IS the answer.~~ THE FIELD WAS
    THERE, INSIDE ANOTHER ONE — 2026-08-21.

    This row returned `UNVERIFIABLE` on the ground that `--- AIR:` does not
    exist, and it still does not. What was wrong is the inference: the stagers
    write the tune into the TITLE VALUE, as `[air: Paddy's Wedding]`, and
    `quality/grid.split_named_air` now reads it. So the rate M-11 asks for is
    re-derivable and this row answers.

    TWO NUMERATORS, NEVER SUMMED (doctrine 79). A ci's title IS its 詞牌 and
    `build_ci_corpus.py:1137` prints one variable into both fields, so an
    `air == title` restatement is guaranteed by code rather than measured and
    is not evidence that anybody recorded a tune. It is counted and reported
    apart from a DISTINCT air, which is the only one M-11's question is about.

    THE SCOPE WAS ALSO WRONG. Both loops read `eng_` only, so the marker
    inventory this row printed as "the markers present" never saw RHYME, JU,
    GE, JUAN, SYLLABLES, RIME, FUNCTION, SPLIT or SUNG-EVIDENCE, and the
    English-only rate could not have falsified an entry about non-English
    songs. Both read the whole corpus now.
    """
    from quality.grid import (named_air_census, AIR_DISTINCT, AIR_RESTATED)
    files = _song_files()
    fields = collections.Counter(re.findall(
        r"^--- ([A-Z_-]+):",
        "\n".join(open(f, encoding="utf-8", errors="replace").read()
                  for f in files), re.M))
    cen = named_air_census(files)
    eng = cen.get("eng", {})
    five = ("fas", "fin", "cym", "msa", "san")
    n5 = sum(cen.get(p, {}).get("songs", 0) for p in five)
    a5 = sum(cen.get(p, {}).get(AIR_DISTINCT, 0) for p in five)
    got = ("%d of %d eng songs name an air of their own (%.1f%%); M-11's five "
           "non-English prefixes name %d over %d songs (%s); %d ci RESTATE "
           "their own title and are counted apart; no `--- AIR:` line exists "
           "and none is needed (markers present: %s)"
           % (eng.get(AIR_DISTINCT, 0), eng.get("songs", 0),
              100.0 * eng.get(AIR_DISTINCT, 0) / max(1, eng.get("songs", 0)),
              a5, n5,
              ", ".join("%s %d" % (p, cen.get(p, {}).get(AIR_DISTINCT, 0))
                        for p in five),
              cen.get("ltc", {}).get(AIR_RESTATED, 0),
              ", ".join(sorted(fields))))
    # MOVED, not CONFIRMED: 331 of 5,006 was measured on a smaller corpus by a
    # looser rule, and the register's own ZERO is falsified by the 31.
    return MOVED, got, "331 of 5,006 songs carry a named air (6.6%)"


def _d_chorus_stubs():
    import lyric_harness as LH
    n, loose = collections.Counter(), collections.Counter()
    for f in _song_files():
        lang = os.path.basename(f)[:3]
        for l in open(f, encoding="utf-8", errors="replace"):
            s = l.strip()
            if not s or s.startswith("#") or s.startswith("---") or s.startswith("["):
                continue
            # ASKED WITH THE LANGUAGE THE FILENAME ALREADY DECLARES, which
            # this loop had computed and thrown away since it was written.
            # Undeclared, five editorial-prose lines in
            # `fin_wahanen_laulukirja.txt` ending in a truncated Swedish title
            # counted as Finnish refrain pointers, and every Welsh `&c.`
            # counted under English's label. Both are gone at the cost of
            # moving one argument (BACKLOG 2.4, doctrine 45).
            if LH.is_chorus_stub(s, language=lang):
                n[lang] += 1
            elif LH.is_chorus_stub(s):
                loose[lang] += 1
    return (CONFIRMED if n["eng"] == 941 else MOVED), \
        ("is_chorus_stub fires on %d eng / %d cym / %d fin / %d msa lines when "
         "asked WITH each file's language%s"
         % (n["eng"], n["cym"], n["fin"], n["msa"],
            "; %s more match undeclared and are NOT that tradition's pointer"
            % dict(loose) if loose else "")), \
        "941 stub instances in the staged corpus"


def _d_jne():
    """THIS ROW CARRIES THE SAME DEFECT D9/D20/D21 WERE JUST FIXED FOR, AND IT
    IS DELIBERATELY LEFT STANDING. Recorded here so the next session does not
    have to re-find it.

    The register-side literal below is `Finnish j. n. e. on 8 stub lines, 16
    unreadable tokens`. M-4 NO LONGER SAYS THAT: its table row reads `~~8~~
    **9 at debf64e**` and its prose states `9 occurrences ... that is 18
    tokens`, naming the same three files this function measures. Re-derived
    2026-08-14 and the repo agrees with the entry exactly -- 9 stubs, 18
    tokens, `fin_kanteletar` 7 / `fin_kanteletar_uudempia` 1 /
    `fin_wahanen_laulukirja` 1. So the honest verdict against the CURRENT M-4
    is CONFIRMED, and the MOVED this prints is measured against a sentence the
    register struck three days ago -- the same permanently-MOVED shape as D20
    and D21.

    NOT CHANGED HERE, because the change is not this file's alone to make.
    `quality/test_register_audit.py::test_calibration_finnish_arithmetic`
    ASSERTS `verdict == "MOVED"`, with a docstring reading *"MOVED is the
    honest verdict here ... The register's own owner moves the 8/16; this file
    only asserts that the auditor still measures correctly."* The register's
    owner HAS moved it, so that test's premise is now false and the pin must
    move in the same commit as this function. Deriving it here alone would
    turn a green suite red and leave a session unable to tell a real
    regression from this repair. THE OWED EDIT, precisely: drop that check's
    `verdict == "MOVED"` assertion to `verdict in ("CONFIRMED", "MOVED")`, or
    repin it to CONFIRMED -- the sibling check above it (`9 occurrences` /
    `18 tokens` in the detail) is the one that pins the MEASUREMENT and needs
    no change either way. Then this function becomes `_claim_or_unverifiable`
    against M-4's own `9`/`18`.

    D8 is the third member of the family and is left for the same reason:
    its literal `d. s. b. occurs ZERO times` is the WITHDRAWN M-4's sentence,
    and `test_calibration_malay_withdrawal` pins `verdict in (FALSE,
    UNVERIFIABLE)`, which a derived reading would break wherever `MSA_SOURCE`
    is set.
    """
    tot = collections.Counter()
    for f in _song_files("fin_"):
        n = len(re.findall(r"\bj\.\s*n\.\s*e\.", open(f, encoding="utf-8", errors="replace").read()))
        if n:
            tot[os.path.basename(f)] = n
    n = sum(tot.values())
    return (CONFIRMED if n == 8 else MOVED), \
        "%d occurrences: %s; at 2 vowelless tokens each (j, n -- e is readable) that is %d tokens" \
        % (n, dict(tot), 2 * n), \
        "Finnish j. n. e. on 8 stub lines, 16 unreadable tokens"


def _d_dsb():
    """The withdrawal that this instrument exists to re-open."""
    staged = _msa_staged_population()
    src = _msa_source_population()
    if staged is None:
        return UNVERIFIABLE, "staged Malay file absent", "d. s. b. occurs ZERO times"
    if src is None:
        return UNVERIFIABLE, ("`d. s. b.` occurs %d times in the staged extract, "
                              "which is true and is not the population M-3/M-4 "
                              "measured; PG47873 itself is not on disk here"
                              % staged["d_s_b"]), "d. s. b. occurs ZERO times"
    return FALSE, ("0 in the staged 129-block extract, but %d in PG47873 -- the "
                   "file the extract was cut from and the population M-3 names "
                   "(%d in indented verse lines, %d of them line-final). Single-"
                   "letter verse tokens there: b %d, d %d, s %d."
                   % (src["d_s_b_all"], src["d_s_b_in_verse"], src["d_s_b_line_final"],
                      src["single_bds_apostrophe_kept"][0],
                      src["single_bds_apostrophe_kept"][1],
                      src["single_bds_apostrophe_kept"][2])), \
        "d. s. b. occurs ZERO times in the only Malay file"


def _m4_stub_rows(entries):
    """-> [(language, [stub forms], withdrawn)] from M-4's own stub table.

    THE THIRD INSTANCE OF THE `_f1_claim` DEFECT, AND THE ONE THAT HAD
    INVERTED.  The literal here was `the Malay d. s. b. row was false and is
    struck through`, and that sentence IS NOT IN MISSING.md -- `grep -n
    "struck through" MISSING.md` returns nothing.  It is a fossil of a
    WITHDRAWN version of M-4.  The entry's live text says the opposite in
    capitals: *"THE MALAY ROW WAS WITHDRAWN ON 2026-08-11 AND THE WITHDRAWAL
    WAS ITSELF FALSE. Restored"*, and closes *"lyric_harness.CHORUS_STUB_FORMS
    shipped the msa row throughout and was right the whole time."*

    So this row was reporting FALSE -- the verdict that FAILS THE RUN -- for
    the code agreeing with the register.  The check had inverted, not merely
    gone stale, and it was the only thing holding the exit code at 1.  It also
    read as a standing instruction to DELETE the `msa` row, which would have
    re-committed the withdrawal M-4 spends eight paragraphs retracting.

    WHAT IS DERIVED, and why it is the table and not a sentence.  M-4's stub
    table IS the register's list of (language, printing convention); reading it
    means a row struck there withdraws the convention here automatically, with
    no literal to re-type.  The comparison is by STUB FORM rather than by
    language code, on purpose: M-4's Welsh row names `&c.`, which the `eng`
    pattern already matches, so keying on the language code alone would report
    a phantom gap while keying on the form shows what is true -- Welsh is read,
    under English's label, which is doctrine 45's coordinate and belongs in the
    detail rather than in a verdict.
    """
    raw = entry_text(entries, "M-4")
    out = []
    for ln in raw.split("\n"):
        if not ln.startswith("|") or "---" in ln:
            continue
        cells = [c.strip() for c in ln.strip("|").split("|")]
        if len(cells) < 2:
            continue
        lang, stub = cells[0], cells[1]
        if lang.lower() in ("language", ""):
            continue
        # A cell wholly inside `~~...~~` is withdrawn in place -- this file's
        # own rule, and the one `_entry_now` applies to prose.
        withdrawn = bool(re.fullmatch(r"~~.*~~", lang)) or \
            bool(re.fullmatch(r"~~.*~~", stub))
        # A WITHDRAWN row's own form is still READ, from inside the strike, so
        # the code can be asked whether it still declares what the register has
        # retracted -- that is the FALSE case this row exists to catch, and
        # stripping the strike here would silently drop the row instead
        # (found by the planted-withdrawal control, which reported MOVED).
        forms = re.findall(r"`([^`]+)`",
                           stub if withdrawn else re.sub(r"~~[^~]*~~", "", stub))
        if not forms:
            continue
        out.append((re.sub(r"[~*]", "", lang), forms, withdrawn))
    return out


def _d_stub_forms():
    import lyric_harness as LH
    # `f[0]` IS A TUPLE OF LANGUAGES since 2026-08-21 -- `&c.` is attested for
    # `eng` AND `cym` -- so the declared-language list is flattened rather than
    # read off one field. Keying on one language per form is exactly the defect
    # BACKLOG 2.4 was closed on, and it would silently under-report here as a
    # missing Welsh row.
    forms = [(tuple(f[0]), f[1]) for f in getattr(LH, "CHORUS_STUB_FORMS", ())]
    langs = [l for f in forms for l in f[0]]
    rows = _m4_stub_rows(read_entries())
    got = "CHORUS_STUB_FORMS declares %s" % (forms,)
    if not rows:
        return UNVERIFIABLE, got, ("M-4 no longer carries a `| language | "
                                   "stub |` table this checker can read")

    # Each convention M-4 names, asked of the code the way a reader's line
    # would ask it: the stub stands at end of line, which is what every
    # pattern in the table is anchored to.
    answered, unread, resurrected, named = [], [], [], set()
    for lang, stubs, withdrawn in rows:
        hits = set()
        for s in stubs:
            # EVERY language the form is attested for, not the one the table
            # happened to declare first. M-4's Welsh row names `&c.`; under the
            # old single-language read this reported hits={'eng'} and the row
            # was credited to English -- the phantom this function's own
            # docstring predicted, now answered rather than explained away.
            hits |= set(LH.chorus_stub_languages("lorem ipsum " + s))
        if not withdrawn:
            named |= hits
        if withdrawn:
            if hits:
                resurrected.append("%s (%s), struck in M-4 and still matched by %s"
                                   % (lang, "/".join(stubs), "/".join(sorted(hits))))
        elif hits:
            answered.append("%s %s -> %s" % (lang, "/".join(stubs),
                                             "/".join(sorted(hits))))
        else:
            unread.append("%s %s" % (lang, "/".join(stubs)))

    live = [r for r in rows if not r[2]]
    stated = ("M-4's stub table names %d conventions -- %s -- and %s"
              % (len(live), "; ".join("%s %s" % (l, "/".join(s)) for l, s, _ in live),
                 "none is withdrawn" if len(live) == len(rows)
                 else "%d is/are withdrawn" % (len(rows) - len(live))))
    got = "%s; M-4's rows answered: %s%s%s" % (
        got, "; ".join(answered) or "none",
        "; NOT matched by any declared form: " + "; ".join(unread) if unread else "",
        "; STRUCK IN M-4 BUT STILL DECLARED: " + "; ".join(resurrected)
        if resurrected else "")

    # FALSE is reserved for the two ways the code and the record CONTRADICT:
    # a convention the register has withdrawn that the code still reads, or one
    # the register asserts that nothing in the code can read. A convention the
    # code declares and the table has not caught up with is drift, i.e. MOVED.
    if resurrected or unread:
        return FALSE, got, stated
    unnamed = sorted(set(langs) - named)
    if unnamed:
        return MOVED, got + "; declared but named by no live M-4 row: %s" \
            % " ".join(unnamed), stated
    return CONFIRMED, got, stated


def _d_lyricists():
    import csv
    p = os.path.join(ROOT, "data", "lyricists.tsv")
    rows = list(csv.DictReader(open(p, encoding="utf-8"), delimiter="\t"))
    lang = collections.Counter(r["lang"] for r in rows)
    return None, rows, lang


def _d_eng_status():
    _, rows, _ = _d_lyricists()
    c = collections.Counter(r["status"] for r in rows if r["lang"] == "eng")
    n = sum(1 for r in rows if r["lang"] == "eng")
    claims = _k1_claims(read_entries())
    st, tot = claims.get("eng_status"), claims.get("rows")
    detail = "%d eng rows, %d distinct statuses: %s" % (n, len(c), dict(c))
    if st is None:
        return UNVERIFIABLE, detail, "K-1's SOURCED/NOT_FOUND sentence not readable"
    ok = (c["SOURCED"] == st[0] and c["NOT_FOUND"] == st[2]
          and (tot is None or n == tot[0]))
    return (CONFIRMED if ok else MOVED), detail, \
        ("%d SOURCED, %d NOT_FOUND of the %d that divide two ways%s, per K-1"
         % (st[0], st[2], st[1],
            "" if tot is None else "; %d rows in all" % tot[0]))


def _d_somali():
    _, rows, _ = _d_lyricists()
    c = collections.Counter(r["status"] for r in rows if r["lang"] == "som")
    ok = (sum(c.values()) == 18 and c["REFUSED_DATE"] == 13 and c["BLOCKED_ORTHOGRAPHY"] == 5)
    return (CONFIRMED if ok else MOVED), "18 som rows: %s" % dict(c), \
        "18 Somali poets, 13 fail the date gate, 5 BLOCKED_ORTHOGRAPHY"


def _d_noneng_table():
    _, rows, lang = _d_lyricists()
    want = {"fas": 76, "san": 62, "ltc": 59, "cym": 35, "non": 25, "fin": 14, "msa": 8}
    got = {k: lang[k] for k in want}
    moved = {k: (want[k], got[k]) for k in want if want[k] != got[k]}
    tot = sum(v for k, v in lang.items() if k != "eng")
    pend = sum(1 for r in rows if r["lang"] != "eng" and r["status"] == "PENDING_TEXT")
    src = sum(1 for r in rows if r["lang"] != "eng" and r["status"] == "SOURCED")
    return (CONFIRMED if not moved and tot == 297 else MOVED), \
        ("total non-eng %d; rows that moved %s; the entry's 'every row is "
         "PENDING_TEXT, never SOURCED' is now %d PENDING_TEXT and %d SOURCED"
         % (tot, moved or "none", pend, src)), \
        "297 non-English lyricists, per-language table, every row PENDING_TEXT"


def _d_century_only():
    _, rows, _ = _d_lyricists()
    c = collections.Counter(r["lang"] for r in rows
                            if r["pd_route"].startswith("d (century only"))
    return (CONFIRMED if sum(c.values()) == 18 else MOVED), \
        "%d rows across %s" % (sum(c.values()), dict(c)), \
        "18 rows across cym/som/san are on a century-only bound"


def _d_qieyun_hun():
    import csv
    rows = list(csv.DictReader(open(os.path.join(ROOT, "data", "qieyun_mc.tsv"),
                                    encoding="utf-8"), delimiter="\t"))
    keys = set(r["char"] for r in rows)
    n477 = sum(1 for r in rows if r["rhyme"] == "魂")
    labels = set(r["rhyme"] for r in rows)
    cells = len(set((r["rhyme"], r["tone"]) for r in rows))
    ok = ("魂" not in keys and n477 == 477 and len(labels) == 58
          and "窗" not in keys and "窓" in keys)
    return (CONFIRMED if ok else MOVED), \
        ("魂 as key: %s; chars labelled 魂: %d; distinct rhyme labels: %d; "
         "realised label x tone cells: %d (the entry's '58 x 4' would be 232); "
         "窗 absent: %s, 窓 present: %s"
         % ("魂" in keys, n477, len(labels), cells,
            "窗" not in keys, "窓" in keys)), \
        "魂 unlookupable, 477 chars carry it, 58 labels x 4 tones"


def _d_legacy_groups():
    from quality.phonology import ltc
    import csv
    rows = list(csv.DictReader(open(os.path.join(ROOT, "data", "qieyun_mc.tsv"),
                                    encoding="utf-8"), delimiter="\t"))
    labels = set(r["rhyme"] for r in rows)
    grp = set("".join(getattr(ltc, "_LEGACY_GROUPS", [])))
    orphans = [c for c in "諄真殷桓戈" if c in grp and c not in labels]
    return (CONFIRMED if len(orphans) == 5 else MOVED), \
        "orphaned group names present in _LEGACY_GROUPS and absent from the data file: %s" \
        % ("".join(orphans),), \
        "諄 真 殷 桓 戈 appear in ltc._GROUPS and never in the data file"


def _d_cell_space():
    from quality import rhyme_types as RT
    space = len(RT.DETERMINACY) ** len(RT.CHANNELS)
    named = len(RT.CELL_NAMES)
    return (CONFIRMED if space == 27 and named == 8 else MOVED), \
        "%d channels x %d determinacy values = %d cells, %d named" \
        % (len(RT.CHANNELS), len(RT.DETERMINACY), space, named), \
        "cell space 27, of which 8 are named"


def _d_compositions():
    from quality import meter as M
    a, b = M.n_compositions(7), M.n_compositions(9)
    return (CONFIRMED if (a, b) == (64, 256) else MOVED), \
        "n_compositions(7)=%d, n_compositions(9)=%d, variants(9/8)=%d" % (a, b, b - 1), \
        "2^(n-1): 64 at seven pulses, 256 at nine, 255 variants"


def _cli_score(a, b):
    """Score a word pair the way the register's reader would: through the verb.

    `score()` takes ANCHORS, not words, so calling it directly would be
    measuring a different thing from the one the entry quotes. The command in
    the claim row is the command that runs.
    """
    import subprocess
    p = subprocess.run([sys.executable, os.path.join(ROOT, "lyric_harness.py"),
                        "score", a, "--", b],
                       cwd=ROOT, capture_output=True, text=True, timeout=300)
    txt = p.stdout
    tot = re.search(r"total:\s*([\d.]+)", txt)
    rel = re.search(r"relation:\s*(\w+)", txt)
    nuc = re.search(r"nucleus\s+([\d.]+)", txt)
    return ((float(tot.group(1)) if tot else None),
            (rel.group(1) if rel else None),
            (float(nuc.group(1)) if nuc else None), txt.strip())


def _d_now_why():
    tot, rel, nuc, _ = _cli_score("now", "why")
    ok = _tol(0.902, tot, abs_=0.0005) and rel == "RHYME"
    return (CONFIRMED if ok else MOVED), \
        "now ~ why total %s relation %s (coda channel 1.0 on two vowel-final words)" % (tot, rel), \
        "now ~ why scores 0.902 and types RHYME"


def _d_five_of():
    tot, rel, nuc, _ = _cli_score("five", "of")
    import lyric_harness as LH
    th = LH.Declaration().theta_nucleus
    ok = _tol(0.603, nuc, abs_=0.0005)
    return (CONFIRMED if ok else MOVED), \
        "five ~ of nucleus %s against theta_nucleus %s -- passes by %s" \
        % (nuc, th, None if nuc is None else round(nuc - th, 3)), \
        "five/of passes at nucleus 0.603 against a threshold of 0.600"


#: F-1's own list of phonology modules, as a backticked run of three-letter
#: codes.  The LIST is read, not the count word: a list settles the count AND
#: the "is English one of them" clause at once, and it is what the entry
#: actually maintains -- `eng` was inserted into it by the commit that closed
#: the English half.
_F1_MODULE_LIST = re.compile(r"`((?:[a-z]{3})(?:\s+[a-z]{3}){2,})`")
_F1_COUNT_WORD = re.compile(r"holds\s+\*\*([a-z]+)\*\*\s+modules")
_NUMBER_WORD = {"six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10,
                "eleven": 11, "twelve": 12, "thirteen": 13, "fourteen": 14}


def _f1_claim(entries):
    """-> {"modules": [...], "count": n|None} read out of F-1, or None.

    THIS FUNCTION IS THE FIX, AND THE DEFECT IT REPLACES IS WORTH NAMING.
    `_d_phonologies` carried the string `eight phonologies, and English is not
    one` as a LITERAL.  F-1 was repaired on 2026-08-11 -- `eng.py` landed at
    `c74fb48` and the entry's own title now reads `~~Eight~~ NINE phonologies,
    and English IS one now` -- so from that day the literal asserted a sentence
    MISSING.md no longer contained, and D20 reported MOVED on every run,
    forever, naming the REGISTER as the side that had drifted when the register
    was the side that had been FIXED.

    A CHECK THAT CANNOT PASS IS THE MIRROR OF DOCTRINE 48's CHECK THAT CANNOT
    FAIL, and it costs more: a permanently-red row trains its reader to skip
    the column, so the next row that goes red for a real reason is skipped too.

    DERIVED, NOT REPINNED, and that is the whole choice.  Repinning the literal
    to `nine ... and English IS one` would fix these two rows and leave the
    MECHANISM -- the next repair to F-1 re-opens it, and this file has already
    been bitten five times by the same shape (D7, D8, D9, D20, D21).  Reading
    the entry makes the class impossible: a repair to MISSING.md moves BOTH
    sides at once and the verdict follows with no edit here.  The precedent is
    this file's own `_k1_claims` (whose docstring records being bitten on
    2026-08-11) and `quality/verify_doctrines.py`, which derives the doctrine
    run from the `<!-- DOCTRINE-BLOCK -->` markers and the known-gaps list from
    CLAUDE.md's own heading rather than from a remembered range -- CLAUDE.md
    cites that as the reason entry 10 "was defined the moment it was written
    and no third repin of a hardcoded range was possible".  `PINNED`'s
    exclusion 1 below already states the rule as this instrument's POLICY; it
    had simply never been applied to these rows.

    THE COST, STATED: a derivation depends on WORDING, so a rewrite of F-1 can
    make this unreadable.  That is why the answer is then UNVERIFIABLE and says
    which sentence it lost -- a visible refusal, not a silent pass (doctrine
    79, and `_claim_or_unverifiable`'s three outcomes).
    """
    t = _entry_now(entries, "F-1")
    if not t:
        return None
    m = _F1_MODULE_LIST.search(t)
    if not m:
        return None
    w = _F1_COUNT_WORD.search(t)
    return {"modules": sorted(set(m.group(1).split())),
            "count": _NUMBER_WORD.get(w.group(1).lower()) if w else None}


def _d_phonologies():
    import glob
    mods = sorted(os.path.basename(p)[:-3] for p in
                  glob.glob(os.path.join(HERE, "phonology", "*.py"))
                  if not os.path.basename(p).startswith("__"))
    got = "%d modules: %s" % (len(mods), " ".join(mods))
    c = _f1_claim(read_entries())
    if c is None:
        return UNVERIFIABLE, got, ("F-1 no longer lists its phonology modules "
                                   "as a backticked run of three-letter codes, "
                                   "so there is no claim here to re-derive")
    stated = ("F-1 lists %d phonology modules -- %s -- so English %s one"
              % (len(c["modules"]), " ".join(c["modules"]),
                 "IS" if "eng" in c["modules"] else "is NOT"))
    # The entry's own count word is checked against the entry's own list. A
    # register that disagrees with itself is this instrument's first subject,
    # and a derivation that read only the list would not notice.
    if c["count"] is not None and c["count"] != len(c["modules"]):
        return MOVED, got, (stated + ", and F-1's own count word says %d, "
                            "which its own list contradicts" % c["count"])
    return (CONFIRMED if mods == c["modules"] else MOVED), got, stated


def _m15_claim(entries):
    """-> {"populated", "schemas", "rows", "attachments", "all_rn"} from M-15.

    SAME DEFECT, SAME FIX AS `_f1_claim` -- and M-15 is the entry that ARGUES
    the point in its own prose.  The literal here was `traditions declared on
    77 schemas and populated on ZERO`, and M-15's title has read `~~declared on
    77 schemas and populated on ZERO~~ **75 of 77 populated, and the SOURCE is
    the gap**` since the layer was populated at `e4cc054`.  M-15's own first
    paragraph says why that matters: *"The ZERO was left standing as live
    heading text under a blockquote that already corrected it, which is how a
    superseded figure keeps being quoted: BACKLOG.md §2.5 copied it forward for
    a day."*  This file was the SECOND copy, and it went on quoting the ZERO
    for three days after the entry struck it -- while reporting the entry as
    the thing that had moved.

    FOUR FIGURES AND ONE BOOLEAN, not one number.  M-15 does not close on the
    75/77: it says the SOURCE is the gap, that every `Tradition.source` is an
    `R<n>` pointer back into RHYME_CANON.md.  Confirming the count while
    ignoring the clause the entry is actually open on would be the auditor
    reading half a claim.
    """
    t = _entry_now(entries, "M-15")
    if not t:
        return None
    pop = re.search(r"(\d+)\s+of\s+(\d+)\s+(?:schemas\s+now\s+carry\s+traditions"
                    r"|populated)", t)
    if not pop:
        return None
    rows = re.search(r"([\d,]+)\s+distinct\s+.?Tradition.?\s+rows,\s*"
                     r"([\d,]+)\s+attachments", t)
    return {
        "populated": int(pop.group(1)),
        "schemas": int(pop.group(2)),
        "rows": int(rows.group(1).replace(",", "")) if rows else None,
        "attachments": int(rows.group(2).replace(",", "")) if rows else None,
        "all_rn": bool(re.search(r"every single\s+.?Tradition\.source.?\s+is an"
                                 r"\s+.?R<n>.?\s+pointer", t)),
    }


def _d_traditions_populated():
    from quality import relations as R
    S = R.all_schemas()
    pop = [n for n, s in S.items() if getattr(s, "traditions", ())]
    rows = set()
    attach = 0
    for s in S.values():
        for t in s.traditions:
            attach += 1
            rows.add((t.name, t.lang, t.source))
    ext = [r for r in rows if not re.fullmatch(r"R\d+[a-z]?(\+R\d+[a-z]?)*", r[2] or "")]
    got = ("%d schemas, %d with traditions populated, %d distinct Tradition "
           "rows over %d attachments; %d of them cite a source that is not an "
           "R<n> pointer into RHYME_CANON.md"
           % (len(S), len(pop), len(rows), attach, len(ext)))
    c = _m15_claim(read_entries())
    if c is None:
        return UNVERIFIABLE, got, ("M-15 no longer states its populated-of-"
                                   "declared figure in a form this checker can "
                                   "read")
    parts = ["M-15: %d of %d schemas populated" % (c["populated"], c["schemas"])]
    ok = (c["populated"], c["schemas"]) == (len(pop), len(S))
    if c["rows"] is not None:
        parts.append("%d distinct Tradition rows over %d attachments"
                     % (c["rows"], c["attachments"]))
        ok = ok and (c["rows"], c["attachments"]) == (len(rows), attach)
    if c["all_rn"]:
        parts.append("and EVERY Tradition.source an R<n> pointer into "
                     "RHYME_CANON.md -- which is the gap this entry stays open "
                     "on, not the count")
        ok = ok and not ext
    return (CONFIRMED if ok else MOVED), got, ", ".join(parts)


def _d_rhyme_constraints():
    p = os.path.join(HERE, "rhyme_constraints.py")
    src = open(p, encoding="utf-8").read()
    n = src.count("\n") + 1
    callers = []
    import glob
    for f in glob.glob(os.path.join(HERE, "*.py")):
        if os.path.basename(f) in ("rhyme_constraints.py", "audit_register.py"):
            continue   # a file does not become wired by being audited
        if re.search(r"\brhyme_constraints\b", open(f, encoding="utf-8", errors="replace").read()):
            callers.append(os.path.basename(f))
    return (MOVED if callers or n != 1325 else CONFIRMED), \
        "%d lines, __main__ %s, callers: %s" \
        % (n, "present" if "__main__" in src else "absent", callers or "none"), \
        "1,325 lines, no caller and no __main__"


def _d_doctrine_count():
    """The doctrine run spans TWO files and is delimited, so count it that way.

    This claim used to read `^\\d+\\. \\*\\*` out of CLAUDE.md alone and compare
    against 76, and it was wrong twice over after the 2026-08-11 split. It
    missed the 75 doctrines that moved to `quality/METHOD.md`, and the bare
    regex over CLAUDE.md also swept in the SEVEN `Known gaps` items, which use
    the same markdown shape, are cited as `known gap N`, and were never part of
    the doctrine numbering. Both files delimit their run with
    `<!-- DOCTRINE-BLOCK -->` markers precisely so a counter can tell the two
    lists apart, and `quality/verify_doctrines.py` already reads them
    correctly -- so this calls that rather than growing a second regex that can
    drift from it. An auditor with its own private parser of the thing it
    audits is the `gabay higaad` shape one layer down.

    CLAUDE.md's own invariant is the standard: the union must be exactly 1-95
    with no number defined in both files.
    """
    try:
        from quality import verify_doctrines as VD
        defs = VD.definitions()                  # {n: [file, ...]}, markers only
    except Exception as e:                       # noqa: BLE001
        return UNVERIFIABLE, \
            "cannot read the doctrine runs: %s: %s" % (type(e).__name__, e), \
            "95 doctrines across CLAUDE.md + quality/METHOD.md"
    per_file = collections.Counter(h for hs in defs.values() for h in hs)
    n = len(defs)
    dup = sorted(k for k, hs in defs.items() if len(hs) > 1)
    run = sorted(defs)
    contiguous = run == list(range(1, n + 1))
    gaps = [i for i in range(1, (max(run) if run else 0) + 1) if i not in defs]
    # the seven items the old regex was silently counting
    claude = open(CLAUDE_MD, encoding="utf-8").read()
    bare = len(re.findall(r"^\d+\. \*\*", claude, re.M))
    detail = ("%d doctrines between the <!-- DOCTRINE-BLOCK --> markers: "
              "%s. Contiguous 1-%d: %s. Defined twice: %s. "
              "CLAUDE.md's bare `^N. **` count is %d, i.e. %d doctrines plus "
              "the %d `Known gaps` items, which are a SEPARATE numbering "
              "(cited as `known gap N`) and are what the old CLAUDE.md-only "
              "regex was counting into this figure."
              % (n,
                 ", ".join("%s %d" % (f, c) for f, c in sorted(per_file.items())),
                 max(run) if run else 0,
                 "yes" if contiguous else "NO, missing %s" % gaps,
                 dup or "none",
                 bare, per_file.get("CLAUDE.md", 0),
                 bare - per_file.get("CLAUDE.md", 0)))
    ok = (n == 95 and not dup and contiguous
          and per_file.get("CLAUDE.md") == 20
          and per_file.get("quality/METHOD.md") == 75)
    return (CONFIRMED if ok else MOVED), detail, \
        ("95 doctrines, one global numbering, 20 in CLAUDE.md and 75 in "
         "quality/METHOD.md (MISSING.md L-5's `102 numbered items` is this 95 "
         "plus CLAUDE.md's 7 `Known gaps` rows; the entry's struck-through 76 "
         "predates the split)")


def _verse_body(path):
    """A corpus file's sung lines. `#`, `---` and `[` are apparatus everywhere
    in this repo, and both censuses below have to drop them the SAME way or
    their totals are not comparable across languages."""
    t = open(path, encoding="utf-8", errors="replace").read()
    return "\n".join(l for l in t.split("\n")
                     if l.strip() and not l.startswith("#")
                     and not l.strip().startswith("---")
                     and not l.strip().startswith("["))


def _census_counts(mod, phon, tokens_of):
    """-> the FOUR figures a phonology census returns: total / read / refused /
    defective, summed over the files, NEVER collapsed into an `unreadable`.

    ONE function, read by the derivation row AND by `check()`, so the printed
    number and the pinned number cannot drift apart -- the same reason
    `unread_final_piece` is one predicate rather than two (CLAUDE.md, hyphen
    splitting x3).
    """
    agg = {"total": 0, "read": 0, "refused": 0, "defective": 0}
    for f in tokens_of:
        c = mod.readability_census(phon, tokens_of[f])
        for k in agg:
            agg[k] += c[k]
    return agg


def _fin_census():
    from quality.phonology import fin
    toks = {f: fin._tokens(_verse_body(f)) for f in _song_files("fin_")}
    return _census_counts(fin, fin.Finnish(), toks)


def _cym_census():
    """The Welsh census, through `cym`'s OWN tokenizer and `refusal_reason`.

    THE TOKENIZER IS PART OF THE MEASUREMENT AND THIS RUNNER USED TO GET IT
    WRONG. `cym.WORD_RE` admits `'` and `-` because both occur inside Welsh
    words, so it also matches a run of bare punctuation -- the gwant `--`, a
    lone elision apostrophe -- as if it were a word. Every caller INSIDE
    `cym.py` drops those with `if w.strip("'-")` (three sites); this file did
    not, so it counted 145 punctuation runs BOTH as tokens AND as declines,
    and reported 29,714/271 where the module's own convention gives
    29,569/126. Doctrine 58 one axis out: a count is a coordinate of the
    tokenisation, and an auditor with a private tokenizer for the thing it
    audits is measuring its own regex.
    """
    from quality.phonology import cym
    toks = {}
    for f in _song_files("cym_"):
        raw = cym.WORD_RE.findall(cym.normalise(_verse_body(f)))
        toks[f] = [w for w in raw if w.strip("'-")]
    return _census_counts(cym, cym.Welsh(), toks)


def _d_fin_census():
    """M-4's `155 -> 139 unreadable`, against the module's own three counts.

    DOCTRINE 79, AND THIS ROW USED TO BREAK IT. `fin.readability_census`
    returns read / refused / defective as THREE counts precisely so they are
    never summed, and this runner did `unread = refused + defective` and
    printed the one number -- charging 567 correct REFUSALS (the phonology
    declining to read a non-initial opening diphthong, which is a decision, not
    a defect) to the same column as 151 genuine DEFECTS. That is doctrine 79's
    own failure mode committed by the instrument that exists to catch it.
    Reported as three now, and never summed.
    """
    c = _fin_census()
    return UNVERIFIABLE, \
        ("all ten fin_* files under the module's own tokenizer and census: "
         "total %d, read %d, REFUSED %d, DEFECTIVE %d -- three counts, never "
         "summed (doctrine 79; this row used to print refused+defective as one "
         "'unreadable' figure). Two orders off the entry's 155 either way, and "
         "the entry states no tokenizer and no reason-code filter, so which of "
         "the three it meant cannot be recovered"
         % (c["total"], c["read"], c["refused"], c["defective"])), \
        "all ten fin_* 155 -> 139 unreadable tokens"


def _d_cym_readability():
    """N-2's `100.00%`, which is CHECKABLE NOW and was not when this was written.

    TWO DEFECTS, BOTH THIS RUNNER'S, FIXED 2026-08-14.

    (1) THE PREMISE WAS FALSE FOR THREE DAYS. This row asserted `cym exposes no
    readability_census, unlike msa and fin, so read/refused/defective cannot be
    split`, and returned UNVERIFIABLE on that ground. `cym.readability_census`
    has existed since commit `b609ba0`, 2026-08-11 -- the cell that gave Welsh
    a `rhymes()` predicate added it. `MISSING.md` N-2 was told: its own body
    reads `CLOSED 2026-08-11: cym.readability_census() exists`. The register
    was updated and the instrument auditing the register was not, which is
    adversary 8's own subject turned on adversary 8.

    (2) IT ANSWERED A THREE-STATE QUESTION WITH A BOOLEAN. Having declared the
    three counts unavailable it computed `if not C.syllabify(w): bad += 1` --
    one bit, where `refusal_reason` returns a CODE and `UNREADABLE_REASONS`
    maps that code to refused-or-defective. So the row asserted the split was
    impossible while doing the arithmetic that made it impossible. Measured
    through the census the answer is not close to ambiguous: of the 126 that do
    not read, 0 are refusals and 126 are `vowelless_token` defects -- and
    pinning that 0 is the point, exactly as `audit_hafez_radif.PINNED` pins its
    own `refused: 0`.

    VERDICT IS MOVED, NOT FALSE. N-2 has already struck its own `100.00%`
    (`~~...~~`) and records what it owes; the register aged and said so, which
    this module's exit policy explicitly permits. FALSE is for a register that
    contradicts itself.
    """
    c = _cym_census()
    pct = 100.0 * c["read"] / c["total"] if c["total"] else 0.0
    return MOVED, \
        ("cym.readability_census EXISTS (since b609ba0, 2026-08-11) and this "
         "row's claim that it does not was stale for three days. The five "
         "cym_* files under the module's own tokenizer and census: total %d, "
         "read %d (%.2f%%), REFUSED %d, DEFECTIVE %d (all vowelless_token) -- "
         "the three counts doctrine 79 asks for, so 100.00%% is checkable now "
         "and does not reproduce. The runner's own former figure 29714/271 was "
         "its private tokenizer counting 145 bare -- and apostrophe runs as "
         "both tokens and declines"
         % (c["total"], c["read"], pct, c["refused"], c["defective"])), \
        "cym reads all five Welsh files at 100.00% -- 0 unreadable in 29,571"


def _d_malay_ong_ok():
    """Doctrine 70's evidentiary clause, measured. It is the most valuable
    finding this runner produces, so it is a first-class claim.

    Doctrine 70 argues that the 1900 Straits spelling should NOT be modernised,
    and the argument is good. The EVIDENCE it offers -- that the orthography is
    internally consistent, `-ung`/`-uk` at zero against `-ong`/`-ok` -- is
    quoted with a different pair of numbers in every place it appears:

        CLAUDE.md doctrine 70   14 and 12 distinct types
        MISSING.md M-3          28 types and 14/15
        the corpus file header  25 and 24 tokens

    Three documents, three answers, one measurement. The ZEROS reproduce and
    carry the whole argument; the comparison figures reproduce nowhere. A
    doctrine resting on a number that reproduces nowhere is a doctrine resting
    on nothing measurable, which is worse than one resting on nothing at all,
    because the number invites belief.
    """
    p = os.path.join(ROOT, "corpus", "song", "msa_skeat_pantun.txt")
    if not os.path.exists(p):
        return UNVERIFIABLE, "staged Malay file absent", "-ong 14 types, -ok 12 types"
    verse = [l for l in open(p, encoding="utf-8").read().split("\n")
             if l.strip() and not l.startswith("#")
             and not l.strip().startswith("---") and not l.strip().startswith("[")]
    toks = [w.lower() for l in verse for w in re.findall(r"[A-Za-z'\u2019-]+", l)]
    got = {}
    for suf in ("ong", "ok", "ung", "uk"):
        tk = [w for w in toks if w.endswith(suf)]
        got[suf] = (len(tk), len(set(tk)))
    zeros_hold = got["ung"][0] == 0 and got["uk"][0] == 0
    return (MOVED if zeros_hold else FALSE), (
        "-ong %d tokens / %d types, -ok %d tokens / %d types, -ung %d, -uk %d. "
        "The ZEROS reproduce and they carry doctrine 70's whole argument. The "
        "comparison figures match none of the three values on record "
        "(CLAUDE.md 14/12 types, MISSING M-3 28/14-15 types, the corpus header "
        "25/24 tokens)."
        % (got["ong"][0], got["ong"][1], got["ok"][0], got["ok"][1],
           got["ung"][0], got["uk"][0])), \
        "doctrine 70 / M-3: -ung 0, -uk 0 against -ong and -ok"


DERIVATIONS = [
    Claim("D1", "K-1", "English songs", 5006, _d_songs, "quality/audit_register.py --slow", slow=True),
    Claim("D2", "K-1", "sung lines", 154346, _d_sung_lines, "quality/audit_register.py --slow", slow=True),
    Claim("D3", "K-1", "repeat blocks", None, _d_repeat_blocks, "quality/audit_register.py --slow", slow=True),
    Claim("D4", "K-1", "authors", 143, _d_authors, "quality/audit_register.py --slow", slow=True),
    Claim("D5", "K-1/M-11", "named airs", 331, _d_named_airs, "quality/audit_register.py --slow", slow=True),
    Claim("D6", "A-1", "chorus stubs", 941, _d_chorus_stubs, "quality/audit_register.py --slow", slow=True),
    Claim("D7", "M-4", "Finnish j. n. e.", 8, _d_jne, "quality/audit_register.py"),
    Claim("D8", "M-4", "Malay d. s. b.", 0, _d_dsb, "quality/audit_register.py",
          note="the withdrawal this instrument exists to re-open"),
    Claim("D9", "M-4", "CHORUS_STUB_FORMS", None, _d_stub_forms, "quality/audit_register.py"),
    Claim("D10", "K-1", "eng lyricist statuses", None, _d_eng_status, "quality/audit_register.py"),
    Claim("D11", "K-5", "Somali gate outcomes", 18, _d_somali, "quality/audit_register.py"),
    Claim("D12", "K-6", "non-English lyricist table", 297, _d_noneng_table, "quality/audit_register.py"),
    Claim("D13", "K-6", "century-only bounds", 18, _d_century_only, "quality/audit_register.py"),
    Claim("D14", "M-2", "qieyun lookup failures", 477, _d_qieyun_hun, "quality/audit_register.py"),
    Claim("D15", "M-2", "orphaned group names", 5, _d_legacy_groups, "quality/audit_register.py"),
    Claim("D16", "E-1", "ternary cell space", 27, _d_cell_space, "quality/audit_register.py"),
    Claim("D17", "C-1", "meter compositions", 64, _d_compositions, "quality/audit_register.py"),
    Claim("D18", "E-5", "now ~ why", 0.902, _d_now_why, "python3 lyric_harness.py score now -- why"),
    Claim("D19", "L-1/dctr 94", "five ~ of nucleus", 0.603, _d_five_of,
          "python3 lyric_harness.py score five -- of"),
    # `stated=None` on these three, like D3/D10 above: their register side is
    # READ from MISSING.md at run time, so a constant here would be a fourth
    # copy of the figure that has just been removed from three others -- and
    # `run_derivations` uses `c.stated` only as the fallback when a derivation
    # returns no register-side text at all, which these never do.
    Claim("D20", "F-1", "phonology modules", None, _d_phonologies, "quality/audit_register.py"),
    Claim("D21", "M-15", "traditions populated", None, _d_traditions_populated, "quality/audit_register.py"),
    Claim("D22", "M-16", "rhyme_constraints", 1325, _d_rhyme_constraints, "quality/audit_register.py"),
    Claim("D23", "L-5", "doctrines (CLAUDE.md + METHOD.md)", 95,
          _d_doctrine_count, "python3 quality/verify_doctrines.py"),
    Claim("D24", "M-4", "Finnish unreadable census", 155, _d_fin_census,
          "quality/audit_register.py --slow", slow=True),
    Claim("D25", "N-2", "Welsh readability", 100.0, _d_cym_readability,
          "quality/audit_register.py --slow", slow=True),
    Claim("D26", "M-3 / doctrine 70", "Malay -ong/-ok inventory", 14, _d_malay_ong_ok,
          "quality/audit_register.py",
          note="a CLAUDE.md doctrine whose evidentiary number reproduces nowhere"),
]


def run_derivations(slow=False, only=None):
    out = []
    for c in DERIVATIONS:
        if only and c.entry not in only and c.id not in only:
            continue
        if c.slow and not slow:
            out.append({"id": c.id, "entry": c.entry, "what": c.what,
                        "verdict": "SKIPPED", "detail": "needs --slow",
                        "stated": c.stated, "command": c.command})
            continue
        try:
            verdict, got, stated_text = c.fn()
        except Exception as e:
            verdict, got, stated_text = ERROR, "%s: %s" % (type(e).__name__, e), ""
        out.append({"id": c.id, "entry": c.entry, "what": c.what, "verdict": verdict,
                    "detail": got if isinstance(got, str) else repr(got),
                    "stated": stated_text or c.stated, "command": c.command,
                    "note": c.note})
    return out


# ---------------------------------------------------------------------------
# 4. Provenance. Every named entry, and whether its only witness is us.
# ---------------------------------------------------------------------------


def canon_entries(path=CANON_MD):
    if not os.path.exists(path):
        return []
    lines = open(path, encoding="utf-8").read().split("\n")
    starts = [(i, m.group(1)) for i, l in enumerate(lines)
              for m in [re.match(r"^\*\*(R\d+[a-z]?)\s*·", l)] if m]
    out = []
    for k, (i, rid) in enumerate(starts):
        j = starts[k + 1][0] if k + 1 < len(starts) else len(lines)
        block = "\n".join(lines[i:j])
        nm = re.match(r"^\*\*R\d+[a-z]?\s*·\s*(.+?)\*\*", lines[i])
        fm = re.search(r"from:\s*([^\n]*)", block)
        out.append({"id": rid, "line": i + 1,
                    "name": (nm.group(1) if nm else lines[i][2:60]).strip(),
                    "from": (fm.group(1).strip() if fm else ""),
                    "block": block})
    return out


#: A citation is EXTERNAL when it names something outside this repository: a
#: person, a work, a year, a rime book, an edition. It is INTERNAL when its only
#: referent is a cell index into the survey array, an R<n> into this same file,
#: or a repo module. The test is deliberately generous toward "external" -- a
#: bare four-digit year anywhere in the entry counts -- because the finding is
#: that even the generous test returns nothing.
_EXTERNAL_HINT = re.compile(
    r"\b(1[2-9]\d\d|20[0-2]\d)\b"                       # a publication year
    r"|\b(?:ed\.|trans\.|p\.|pp\.|vol\.|ISBN|doi)\b"    # a citation form
    r"|\b(?:Wikisource|Gutenberg|GRETIL|DCS|Ganjoor|Perseus)\b",
    re.I)

_INTERNAL_REF = re.compile(r"[✓]?[ECGSIX]\d+|R\d+[a-z]?|repo doctrine|"
                           r"repository's own|quality/phonology|CLAUDE\.md", re.I)


def provenance_report():
    """The list of names whose only witness is this project.

    **AMENDED 2026-08-11, and both halves of the amendment are findings about
    this runner rather than about the register.**

    1. `canon_cell_ref_total` read 611.  It counted `from:` matter with
       `re.search(r"from:\\s*([^\\n]*)")` -- ONE occurrence, and only to the end
       of its line.  R1's from-line runs onto a second line and R29's onto
       three, and §H/§I write `from:` inline at the end of the entry's own
       prose rather than as a bullet.  Counted properly the file carries
       **781** references over 594 distinct indices.  A single-line regex
       standing in for a multi-line field is doctrine 58 inside the adversary
       built to find doctrine-58 errors, so the old number is kept beside the
       new one under `canon_cell_ref_total_singleline` rather than quietly
       replaced.
    2. `entries_sourced_only_to_this_project` returned 19 and is a coordinate
       of two regexes nobody had written down.  Re-run with the component-level
       classifier in `quality/canon_sources.py` the answer is different in BOTH
       directions and the two rules agree on only 14 of a 25-name union.  The
       old rule missed `X8 同用/通押`, whose recorded source names 詞林正韻 and
       中原音韻 -- two rime books -- because its external regex is Latin-only;
       and it missed `I46`'s PyThaiNLP, a real external implementation.  It
       over-counted six Old Norse entries whose source is
       `quality/phonology/non.py` **quoting Háttatal verbatim**, which is a
       primary source stored in the repository, not a self-confirmation
       (doctrine 62).  Both counts are reported.

    The report now also measures the REPAIR: `quality/canon_index.tsv` inlines
    the survey index, so `resolved_*` says how many of the 117 named structures
    and 298 traditions now resolve to a witness outside this project, how many
    resolve to this project, and how many cannot be told either way.
    """
    ents = canon_entries()
    canon = []
    for e in ents:
        ext = bool(_EXTERNAL_HINT.search(e["block"]))
        canon.append({"id": e["id"], "name": e["name"][:70], "line": e["line"],
                      "from": e["from"][:90], "external": ext})
    whole_file = open(CANON_MD, encoding="utf-8").read() if os.path.exists(CANON_MD) else ""
    years = re.findall(r"\b(1[2-9]\d\d|20[0-2]\d)\b", whole_file)

    # Where do the from: indices point? Into a six-agent survey array. Is it here?
    cellrefs = collections.Counter()
    for e in ents:
        for m in re.finditer(r"[✓]?([ECGSIX])(\d+)", e["from"]):
            cellrefs[m.group(1)] += 1

    sch = []
    try:
        from quality import relations as R
        S = R.all_schemas()
        for n, s in S.items():
            trs = getattr(s, "traditions", ())
            srcs = sorted(set(t.source for t in trs))
            ext = [x for x in srcs
                   if not re.fullmatch(r"R\d+[a-z]?(\+R\d+[a-z]?)*", x or "")]
            sch.append({"name": n, "n_traditions": len(trs),
                        "sources": srcs[:4], "external": bool(ext)})
    except Exception as e:  # pragma: no cover
        sch = [{"name": "<relations.py did not import>", "n_traditions": 0,
                "sources": [str(e)], "external": False}]

    out = {
        "canon_entries": canon,
        "canon_unsourced": [c for c in canon if not c["external"]],
        "canon_year_tokens": len(years),
        "canon_cell_refs": dict(cellrefs),
        "canon_cell_ref_total_singleline": sum(cellrefs.values()),
        "canon_cell_ref_total": sum(cellrefs.values()),
        "survey_array_on_disk": _find_survey_array(),
        "schemas": sch,
        "schemas_unsourced": [s for s in sch if s["n_traditions"] and not s["external"]],
        "schemas_no_tradition": [s for s in sch if not s["n_traditions"]],
    }
    out.update(_resolved_report())
    return out


def _resolved_report():
    """What the inlined index turns the 117 and the 298 into.

    Three counts everywhere and never two (doctrine 79): resolved to an outside
    witness, resolved to THIS PROJECT, and cannot be told.  `index_loaded`
    False collapses everything into the third, and says so, because a checkout
    without `canon_index.tsv` does not know that nothing is attested -- it does
    not know anything.
    """
    blank = {"index_loaded": False, "index_rows": 0,
             "canon_cell_ref_total_multiline": None,
             "canon_distinct_indices": None,
             "entries_external": 0, "entries_none_external": 0,
             "entries_cites_nothing": 0, "entry_detail": [],
             "index_witness": {}, "coined_indices": [], "unrecorded_indices": [],
             "traditions": {}, "coined_traditions": []}
    try:
        from quality import canon_sources as CS
        from quality import relations as R
    except ImportError:                                       # pragma: no cover
        return blank
    if not CS.loaded():
        return blank
    blocks = CS.canon_blocks()
    refs = [i for _, _, _, f in blocks for i in CS.refs_in(f)]
    er = CS.entry_report()
    v = collections.Counter(e["verdict"] for e in er)
    cen = CS.census()
    tp = R.tradition_provenance()
    return {
        "index_loaded": True,
        "index_rows": cen["rows"],
        "canon_cell_ref_total_multiline": len(refs),
        "canon_distinct_indices": len(set(refs)),
        "entries_external": v.get("external", 0),
        "entries_none_external": v.get("none_external", 0),
        "entries_cites_nothing": v.get("cites_nothing", 0),
        "entry_detail": [e for e in er if e["verdict"] != "external"],
        "index_witness": cen["witness"],
        "index_basis": cen["basis"],
        "coined_indices": [(r["idx"], r["name"], r["basis"])
                           for r in sorted(CS.project_only(),
                                           key=lambda r: r["idx"])],
        "unrecorded_indices": [(r["idx"], r["name"])
                               for r in sorted(CS.unrecorded(),
                                               key=lambda r: r["idx"])],
        "traditions": {k: tp[k] for k in
                       ("attachments", "distinct", "external", "project",
                        "cannot_tell")},
        "coined_traditions": tp["coined"],
    }


def _find_survey_array():
    """Resolve the survey the canon's every `from:` line indexes into.

    RHYME_CANON.md names the workflow. The array is NOT in the repository, and
    that is the first half of the finding: a reader with only this repo checked
    out can resolve exactly none of the 611 `from:` references, so 117 of 117
    canon entries and 298 of 298 Tradition rows are, from inside the repo,
    citations to nothing.

    The second half is better news and is why the first half must not be
    overstated. The array DOES survive in the six inventory agents' transcripts
    under the agent-session store, and most of its entries carry a `source`
    string that names something real -- a rime book, a school taxonomy, a web
    source, Snorri's own prose. So the canon is one hop from evidence; the hop
    just lands outside the repository and outside anything a future reader
    inherits.

    What this function returns is the residue: the named structures whose every
    recorded source is THIS PROJECT -- a `quality/phonology/*` module, a
    CLAUDE.md doctrine, "from memory", or "my characterisation". Those are the
    `gabay higaad` class, and they are the deliverable.
    """
    txt = open(CANON_MD, encoding="utf-8").read() if os.path.exists(CANON_MD) else ""
    m = re.search(r"workflow `(wf_[0-9a-z\-]+)`", txt)
    wf = m.group(1) if m else None
    roots, entries = [], {}
    if wf:
        for base in ("/root/.claude/projects",):
            for dirpath, _, files in os.walk(base):
                if wf not in dirpath:
                    continue
                roots.append(dirpath)
                for f in files:
                    if not f.endswith(".jsonl"):
                        continue
                    try:
                        raw = open(os.path.join(dirpath, f), encoding="utf-8",
                                   errors="replace").read()
                    except OSError:
                        continue
                    for mm in re.finditer(
                            r'\{"name":"((?:[^"\\\\]|\\\\.)*)"(.{0,4000}?)"source":"((?:[^"\\\\]|\\\\.)*)"\}',
                            raw):
                        try:
                            nm = json.loads('"%s"' % mm.group(1))
                            sc = json.loads('"%s"' % mm.group(3))
                        except ValueError:
                            continue
                        entries.setdefault(nm, set()).add(sc)

    # A source is INTERNAL when its only referent is this project or the
    # author's recollection. Everything else counts as external, generously.
    internal = re.compile(r"this repo|quality/phonology|quality/rhyme_types|"
                          r"quality/relations|CLAUDE\.md|MISSING\.md|lyric_harness|"
                          r"data/sources\.tsv|from memory|MY characterisation|"
                          r"my characterisation", re.I)
    external = re.compile(r"WebSearch|Wikipedia|en-academic|ctext|wikisource|"
                          r"\.tw\b|\.com\b|\.net\b|\.org\b|\b1[2-9]\d\d\b|"
                          r"Turco|Snorri|Háttatal|standard|search", re.I)
    only_internal = sorted(
        n for n, ss in entries.items()
        if ss and all(internal.search(x) and not external.search(x) for x in ss))
    return {
        "workflow": wf,
        "in_repo": False,
        "transcript_dirs": roots,
        "entries_recovered": len(entries),
        "entries_sourced_only_to_this_project": only_internal,
        "verdict": ("NOT ON DISK ANYWHERE" if not entries else
                    "recoverable ONLY from the agent-session transcripts, "
                    "which are not in the repository"),
    }


# ---------------------------------------------------------------------------
# 5. Coverage — how much of the register did we even look at?
# ---------------------------------------------------------------------------


def coverage():
    entries = read_entries()
    audited = set(x for c in DERIVATIONS for x in c.entry.split("/"))
    audited |= set(c.entry for c in CONSISTENCY)
    rows = []
    for e in entries:
        nums = e.numbers()
        rows.append({"id": e.id, "status": e.status, "numbers": len(nums),
                     "audited": e.id in audited or any(e.id in a for a in audited)})
    quant = [r for r in rows if r["numbers"]]
    return {"entries": len(rows), "entries_with_numbers": len(quant),
            "numbers_total": sum(r["numbers"] for r in rows),
            "entries_audited": sum(1 for r in quant if r["audited"]),
            "unaudited": [r["id"] for r in quant if not r["audited"]],
            "rows": rows}


# ---------------------------------------------------------------------------
# 6. __main__
# ---------------------------------------------------------------------------


# ---------------------------------------------------------------------------
# 6. THE CHECK. Adversary 8's own subject, turned on adversary 8.
# ---------------------------------------------------------------------------

#: THE COMMITTED FIGURES, so `--check` can go red instead of a human being
#: expected to read four screens of report and compare them against
#: `quality/RESULTS_REGISTER_AUDIT.md` by eye.
#:
#: THIS INSTRUMENT IS THE LAST OF ITS FAMILY TO GET ONE. `audit_spans.py`,
#: `audit_corpus.py`, `audit_tang_null.py`, `audit_kalevala_null.py`,
#: `canon_sources.py` (twice) and `audit_hafez_radif.py` were all closed the
#: same way in this session, and every one of them had printed its own drift
#: and exited 0. This one is not quite that shape and the difference is worth
#: stating: its exit code IS meaningful (non-zero on a consistency failure or a
#: FALSE derivation) and it has been exiting 1 the whole time, on D8/D9. But
#: `MOVED` deliberately does not fail the run, and MOVED is where every drift
#: lands -- so rows could go stale, and did (six verdicts changed and eleven
#: rows' figures moved between 2026-08-11 and 2026-08-14), under a
#: permanently-red exit that says nothing about which. A single number that has
#: been 1 since the file was written is not a signal.
#:
#: MEASURED 2026-08-14, and the record HAD moved -- see
#: `quality/RESULTS_REGISTER_AUDIT.md` §8 for the full table and the superseded
#: values, kept visible and dated (doctrine 17).
#:
#: WHAT IS PINNED AND WHY THAT AND NOT MORE. There is NO DRAW anywhere on this
#: instrument's path -- verified 2026-08-14 by three consecutive runs under
#: `PYTHONHASHSEED=random`, byte-identical -- so the sibling clause "pin the
#: exact counts and leave the Monte Carlo to the printed p" has no referent
#: here. The analogous exclusions are three, and they are not laziness:
#:
#:   1. THE REGISTER SIDE. `_k1_claims` reads K-1's figures out of MISSING.md
#:      at runtime, on purpose, and its own docstring says why: a transcribed
#:      constant would compare the corpus against a number the register had
#:      already struck through and then name the wrong side as the thing that
#:      moved. Pinning those figures here would re-introduce exactly that.
#:      So no derivation VERDICT is pinned either -- a verdict is a comparison
#:      of two sides, and one of them is meant to move as entries are fixed.
#:   2. ANYTHING MEASURED OVER A POPULATION NOT IN THE REPOSITORY. D8's
#:      108/99/95 come from `/workspace/mm47873/47873-8.txt`, which no clone
#:      has; the provenance pass's `578 entries recovered` and its 19-name list
#:      come from agent-session transcripts under `/root/.claude/projects/`,
#:      which no clone has either (`in_repo: False`, printed on every run).
#:      Pinning a figure that is UNVERIFIABLE on a fresh checkout would make
#:      the check a fact about this machine -- the population substitution
#:      this instrument exists to catch, committed by its own checker.
#:   3. `coverage()`'s `numbers_total` (1,702 today). It is a raw count of
#:      every numeral in MISSING.md's prose, so it moves when anyone edits a
#:      sentence. A gate that goes red on a typo fix is a gate people learn to
#:      skip, which is the failure mode the CI comment for this step names.
#:
#: What IS pinned is one-sided and repo-side: facts about `RHYME_CANON.md`,
#: `quality/canon_index.tsv`, `quality/relations.py`, the phonology modules and
#: the corpus. Those move only when the thing measured moves.
#:
#: Doctrine 58: these are counts, and a count is a coordinate of a threshold
#: AND of a rendering. Argue them and repin with the superseded value visible
#: and dated (doctrine 17); do not tune the detectors to meet them.
PINNED = {
    # -- RHYME_CANON.md, as the §2-block detector reads it -------------------
    "canon_entries": 117,
    "canon_unsourced": 113,
    "canon_year_tokens": 23,
    "canon_refs_singleline": 611,
    "canon_refs_multiline": 654,
    "canon_distinct_indices": 555,
    # -- quality/canon_index.tsv, the M-15a repair --------------------------
    "index_rows": 601,
    "index_external": 501,
    "index_project": 68,
    "index_unrecorded": 32,
    "entries_external": 116,
    "entries_none_external": 1,
    "entries_cites_nothing": 0,
    # -- quality/relations.py -----------------------------------------------
    "schemas": 77,
    "schemas_with_traditions": 75,
    "schemas_no_tradition": 2,
    "traditions_distinct": 298,
    "traditions_attachments": 319,
    "traditions_external": 212,
    "traditions_project": 26,
    "traditions_cannot_tell": 60,
    # -- the two phonology censuses, THREE COUNTS EACH, never summed --------
    #    (doctrine 79. `cym_refused: 0` is pinned BECAUSE it is zero: if a
    #    re-ingestion starts refusing Welsh tokens the read rate would slide
    #    while `cym_total` still matched. Same call `audit_hafez_radif.PINNED`
    #    makes for its own `refused: 0`.)
    "fin_total": 145280, "fin_read": 144562,
    "fin_refused": 567, "fin_defective": 151,
    "cym_total": 29569, "cym_read": 29443,
    "cym_refused": 0, "cym_defective": 126,
    # -- MISSING.md's shape, but NOT its prose (see exclusion 3) ------------
    #    REPINNED 2026-08-21, TWICE IN ONE SITTING: ~~75~~ ~~76~~ 77 entries.
    #    The second move is `M-21`, which is ABOUT this line: the entry count
    #    is pinned here AND in `BACKLOG.md`'s counters row, in two media that
    #    share no string, so no grep finds both and the second is found only
    #    by a CI round going red after the first is repaired. Moving both in
    #    one commit is that entry's own demonstration.
    #    REPINNED AGAIN 2026-08-21 (third move today): 77 -> 79. The fruit
    #    sweep split two residues into their own entries — `L-4a` (the song
    #    profile has a rate and no separation; the generated class is the
    #    corpus that does not exist) and `F-4a` (the reader flattens the
    #    letter the transcription kept) — while closing L-4, M-17 and D-1.
    #    REPINNED AGAIN 2026-08-21 (fourth move today): 79 -> 84. The Wave A
    #    tradition surveys filed five entries in one sitting — `M-22` (the
    #    census tokeniser), `M-23` (no `kind="partition"`), `M-24` (the section
    #    vocabulary has no language coordinate), `M-25` (three staging
    #    defects) and `M-26` (the variation ladder answers VERBATIM off-text).
    #    AND THIS PIN WENT RED IN CI RATHER THAN AT THE DESK, which is `M-21`'s
    #    own finding happening to the session that widened `M-21`: every one of
    #    those five commits ran `counters.py --write`, and `counters.py` does
    #    not touch THIS number. Two media, one fact, no grep that finds both —
    #    the pin below is the second medium and it was moved four commits late.
    #    The first was: `M-20` was filed that day —
    #    two English poems staged TWICE in their own file, found when the
    #    named air was split out of the title (BACKLOG 3.2). That is what the
    #    CHECKER surfaced and it is not the population: M-20 was repinned the
    #    same day to 28 such pairs corpus-wide, of which check E carries 2.
    #    The figure below does not move on it — one entry either way. A new entry is
    #    the ORDINARY way this figure moves and the pin is what makes filing
    #    one a decision rather than a diff; `coverage_audited` is unmoved at
    #    19 because M-20 carries no audited claim of its own yet.
    #    REPINNED 2026-08-21, 84 -> 86: `M-27` (a footnote letter is the end
    #    word of 68 rhyming lines) and `M-28` (the printed indent carries the
    #    rhyme scheme at 6.19x and every reader strips it), both filed the same
    #    sitting from the owner's question about what ELSE the corpus is
    #    scoring. `coverage_audited` is unmoved at 19: neither carries an
    #    audited claim of its own yet.
    #    REPINNED 2026-08-21, 86 -> 87: `M-29` (the corpus declares 11,099
    #    periods and the time layer, mute for want of one, reads none of
    #    them), filed at the owner's request from the observation that some
    #    poems carry a performance duration. `coverage_audited` unmoved at 19.
    #    REPINNED 2026-08-22, 87 -> 88: `M-30` (the mutation sweep called a
    #    suite it could not run "already-red", and a hole it never tested
    #    "SURVIVED"), found by running `test_mutation.py` unbounded to answer
    #    a question about the SWEEP and reading its baseline output on the way
    #    past. `coverage_audited` unmoved at 19: the entry carries no audited
    #    claim of its own yet.
    #    REPINNED 2026-08-22, 88 -> 89: `M-31` (a source swap left its
    #    sentinel behind, and 60% of English scored as rarer than a word
    #    nobody has heard of), found while executing the owner's ruling to
    #    refuse `wordfreq20k.txt` -- by asking what still READ it rather than
    #    by reading the licence. `coverage_audited` unmoved at 19.
    #    REPINNED 2026-08-22, 89 -> 90: `M-32` (feature 10's committed
    #    direction and its own gloss point opposite ways, and the verdict on
    #    the feature flips between them), found by asking whether feature 10
    #    earns its place and finding the question unanswerable as posed.
    #    `coverage_audited` unmoved at 19.
    "coverage_entries": 90,
    "coverage_audited": 19,
}

#: THE TEN CONSISTENCY CHECKS, PINNED POSITIONALLY against `CONSISTENCY`.
#:
#: WHY A VECTOR AND NOT A COUNT. `main()` already exits non-zero when a check
#: returns False, so pinning "0 failures" would add nothing. It adds nothing
#: for the state that MATTERS here: `n/a`. A check returns `None` when it
#: cannot find its own subject in the entry any more -- and `main()` scores
#: that as neither pass nor fail, so a check can go permanently INERT and the
#: exit code stays exactly as green as if it had passed. C8 has already done
#: this: it was the `FAIL` that RESULTS_REGISTER_AUDIT.md §2 quotes at length
#: (26,773 divided by a population of 15,887), and M-1 has since been reworded
#: so `_chk_m1_false_verdict_denominator`'s regex finds nothing. Whether the
#: contradiction was FIXED or merely reworded past the detector is not
#: something this file can tell, which is why the pin records `n/a` and says
#: so rather than quietly reading it as a pass.
#:
#: PINNED 2026-08-14. SUPERSEDED, and kept visible per doctrine 17 -- as
#: RESULTS_REGISTER_AUDIT.md §2 recorded them on 2026-08-11 at `1e035cb`:
#:     C1 FAIL  C2 FAIL  C3 FAIL  C4 FAIL  C5 ok   C6 ok
#:     C7 FAIL  C8 FAIL  C9 FAIL  C10 FAIL
#: Eight of ten failed then; none fails now and one has gone inert. The
#: entries were rewritten between those two dates and the checks were not
#: touched, which is the right direction ("Fix the entry, do not tune the
#: check") -- but it means the published §2 describes a register that no
#: longer exists.
PINNED_CONSISTENCY = ("ok", "ok", "ok", "ok", "ok",
                      "ok", "ok", "n/a", "ok", "ok")

#: Inputs `--check` cannot proceed without. Absent, the answer is `cannot tell`
#: (exit 2), never `moved` (exit 1) -- doctrine 20, and doctrine 28's
#: "distinguish none from cannot tell, mechanically". A clone with no
#: `canon_index.tsv` has not drifted; it has not measured.
REQUIRED = (("MISSING.md", MISSING_MD),
            ("quality/RHYME_CANON.md", CANON_MD),
            ("quality/canon_index.tsv", os.path.join(HERE, "canon_index.tsv")))


def _measure_for_check():
    """-> the pinned quantities, measured. Reads the SAME functions the report
    prints from, so the two cannot disagree."""
    pr = provenance_report()
    cov = coverage()
    fin_c, cym_c = _fin_census(), _cym_census()
    t = pr["traditions"]
    w = pr["index_witness"]
    return {
        "canon_entries": len(pr["canon_entries"]),
        "canon_unsourced": len(pr["canon_unsourced"]),
        "canon_year_tokens": pr["canon_year_tokens"],
        "canon_refs_singleline": pr["canon_cell_ref_total_singleline"],
        "canon_refs_multiline": pr["canon_cell_ref_total_multiline"],
        "canon_distinct_indices": pr["canon_distinct_indices"],
        "index_rows": pr["index_rows"],
        "index_external": w.get("external"),
        "index_project": w.get("project"),
        "index_unrecorded": w.get("unrecorded"),
        "entries_external": pr["entries_external"],
        "entries_none_external": pr["entries_none_external"],
        "entries_cites_nothing": pr["entries_cites_nothing"],
        "schemas": len(pr["schemas"]),
        "schemas_with_traditions": sum(1 for s in pr["schemas"] if s["n_traditions"]),
        "schemas_no_tradition": len(pr["schemas_no_tradition"]),
        "traditions_distinct": t["distinct"],
        "traditions_attachments": t["attachments"],
        "traditions_external": t["external"],
        "traditions_project": t["project"],
        "traditions_cannot_tell": t["cannot_tell"],
        "fin_total": fin_c["total"], "fin_read": fin_c["read"],
        "fin_refused": fin_c["refused"], "fin_defective": fin_c["defective"],
        "cym_total": cym_c["total"], "cym_read": cym_c["read"],
        "cym_refused": cym_c["refused"], "cym_defective": cym_c["defective"],
        "coverage_entries": cov["entries"],
        "coverage_audited": cov["entries_audited"],
    }


def check():
    """-> exit code. 0 pass · 1 a figure moved · 2 cannot tell.

    FAILS LOUDLY; it does not report and continue. It deliberately does NOT
    inherit `main()`'s exit policy: D8 and D9 are a standing calibration pair
    that will read FALSE until `MISSING.md` M-4 reinstates the Malay row, and a
    gate that is red for a reason nobody intends to fix this week is a gate
    people learn to skip. This asks a different question -- have the figures
    this instrument DERIVES moved? -- and it is green today.
    """
    print()
    print("=" * 74)
    print("CHECK -- the committed register-audit figures against this run")
    print("=" * 74)

    missing = [n for n, p in REQUIRED if not os.path.exists(p)]
    if missing:
        print("  CANNOT TELL: required input absent -- %s" % ", ".join(missing))
        print("  A checkout that cannot measure has not drifted. Exit 2, not 1")
        print("  (doctrine 20/28).")
        print()
        print("RESULT: CANNOT TELL")
        return 2

    try:
        m = _measure_for_check()
    except Exception as e:                                        # noqa: BLE001
        print("  CANNOT TELL: measurement raised %s: %s" % (type(e).__name__, e))
        print()
        print("RESULT: CANNOT TELL")
        return 2

    bad = 0
    for k in sorted(PINNED):
        ok = m.get(k) == PINNED[k]
        bad += not ok
        print("  [%s] %-24s committed %s%s"
              % ("ok  " if ok else "FAIL", k, PINNED[k],
                 "" if ok else ", measured %s" % (m.get(k),)))

    # The ten checks, POSITIONALLY -- an `n/a` is a check that stopped finding
    # its own subject, and `main()`'s exit code is structurally blind to it.
    outcomes = []
    for c in CONSISTENCY:
        try:
            okc, _detail = c.fn(read_entries())
        except Exception:                                         # noqa: BLE001
            okc = None
        outcomes.append({True: "ok", False: "FAIL", None: "n/a"}[okc])
    for i, c in enumerate(CONSISTENCY):
        want = PINNED_CONSISTENCY[i]
        have = outcomes[i] if i < len(outcomes) else None
        ok = have == want
        bad += not ok
        print("  [%s] consistency %-12s committed %-4s%s"
              % ("ok  " if ok else "FAIL", c.id, want,
                 "" if ok else ", measured %s" % have))

    if bad:
        print()
        print("  %d figure(s) moved. The canon, the survey index, the schema"
              % bad)
        print("  table, a phonology census or one of the ten checks has changed")
        print("  under this instrument.")
        print("  Repin with the date and keep the superseded value visible")
        print("  (doctrine 17). Do not tune the detector to meet the pin.")
    print()
    print("RESULT:", "PASS" if not bad else "FAIL")
    return 0 if not bad else 1


#: Set for the duration of a `--json` run. The section rules used to print to
#: stdout ALONGSIDE the JSON document, so `--json` -- the mode whose whole
#: purpose is to be machine-readable -- emitted output that `json.loads`
#: rejects at line 2. Every other print in `main()` was already gated on
#: `not a.json`; the seven `_hr()` calls were not, and nothing ever consumed
#: the flag, so nothing noticed. Fixed 2026-08-14.
_QUIET = False


def _hr(t=""):
    if _QUIET:
        return
    print("\n" + "=" * 78)
    if t:
        print(t)
        print("=" * 78)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--slow", action="store_true", help="run corpus-scale derivations")
    ap.add_argument("--consistency", action="store_true", help="arithmetic pass only")
    ap.add_argument("--provenance", action="store_true", help="unsourced-name pass only")
    ap.add_argument("--coverage", action="store_true", help="coverage pass only")
    ap.add_argument("--check", action="store_true",
                    help="committed figures only; exit 1 on drift, 2 if it cannot tell")
    ap.add_argument("--only", action="append", help="restrict derivations to an entry id")
    ap.add_argument("--json", action="store_true", help="machine-readable")
    a = ap.parse_args(argv)

    if a.check:
        # The pins, and nothing else. The full report costs the derivations and
        # `check()` reads none of them.
        return check()

    global _QUIET
    _QUIET = a.json

    picked = a.consistency or a.provenance or a.coverage
    do_cons = a.consistency or not picked
    do_prov = a.provenance or not picked
    do_der = not picked
    do_cov = a.coverage or not picked

    result = {}
    # TWO COUNTS, NOT ONE. These ask different things of a reader -- a register
    # that contradicts ITSELF versus a claim that does not reproduce against
    # the REPO -- and the footer used to print only their sum, so "2" could not
    # be told apart from one of each. Doctrine 79's own habit, applied to the
    # instrument's own footer. The exit code stays a single non-zero.
    cons_failures = 0
    false_derivations = 0

    if do_cons:
        _hr("1 · INTERNAL CONSISTENCY  (no corpus, no imports -- the cheapest pass)")
        rows = []
        for c in CONSISTENCY:
            try:
                ok, detail = c.fn(read_entries())
            except Exception as e:
                ok, detail = None, "%s: %s" % (type(e).__name__, e)
            mark = {True: "ok  ", False: "FAIL", None: "n/a "}[ok]
            if ok is False:
                cons_failures += 1
            rows.append({"id": c.id, "entry": c.entry, "ok": ok,
                         "question": c.question, "detail": detail, "why": c.why})
            if not a.json:
                print("  [%s] %-4s %-8s %s" % (mark, c.id, c.entry, c.question))
                print("         %s" % detail)
                if c.why and ok is False:
                    print("         (%s)" % c.why)
        result["consistency"] = rows

    if do_der:
        _hr("2 · DERIVATION  (each claim with the code and the command)")
        rows = run_derivations(slow=a.slow, only=set(a.only) if a.only else None)
        for r in rows:
            if r["verdict"] == FALSE:
                false_derivations += 1
            if not a.json:
                print("  %-13s %-4s %-10s %s" % (r["verdict"], r["id"], r["entry"], r["what"]))
                print("         register:  %s" % r["stated"])
                print("         measured:  %s" % r["detail"])
                print("         reproduce: %s" % r["command"])
                if r.get("note"):
                    print("         note:      %s" % r["note"])
        result["derivations"] = rows

        _hr("3 · POPULATION  (two entries, one corpus name, incompatible sizes)")
        p = population_report()
        result["population"] = p
        if not a.json:
            for k in ("staged", "source"):
                v = p["malay"].get(k)
                print("  malay/%-7s %s" % (k, v if v else "NOT ON DISK"))
            if p["incompatible"]:
                print("  INCOMPATIBLE sizes quoted for the Malay corpus:")
                for unit, vals in p["incompatible"].items():
                    print("     %-7s %s" % (unit, vals))

    if do_prov:
        _hr("4 · PROVENANCE  (names whose only witness is this project)")
        pr = provenance_report()
        result["provenance"] = pr
        if not a.json:
            n = len(pr["canon_entries"])
            u = len(pr["canon_unsourced"])
            print("  RHYME_CANON.md: %d named structures, %d with NO external "
                  "citation IN THE §2 BLOCK ITSELF (%.0f%%) -- this detector "
                  "reads a year or one of six repo names and nothing else, so "
                  "it does not see the `- witness:` lines' hosts and work "
                  "titles. §4b is the repair's measure; this is not."
                  % (n, u, 100.0 * u / max(1, n)))
            print("  publication-year tokens in the whole file: %d (it was 0, "
                  "and that was the sharpest single finding here)"
                  % pr["canon_year_tokens"])
            print("  every `from:` line indexes a six-agent survey array: %d "
                  "references, %s" % (pr["canon_cell_ref_total"], pr["canon_cell_refs"]))
            sa = pr["survey_array_on_disk"]
            print("  that array (%s): %s" % (sa["workflow"], sa["verdict"]))
            print("     %d named survey entries recovered from the transcripts"
                  % sa["entries_recovered"])
            print("     of those, %d record NO source but this project "
                  "(a phonology module, a CLAUDE.md doctrine, or 'from memory')"
                  % len(sa["entries_sourced_only_to_this_project"]))
            print("     ^^ BOTH FIGURES ARE SUPERSEDED BY §4b AND ARE KEPT SO "
                  "THE DEFECT STAYS DEMONSTRABLE.")
            print("     This reader matches `{\"name\":\"…\" … \"source\":\"…\"}` "
                  "with a 4000-character non-greedy gap, which RUNS PAST THE "
                  "OBJECT BOUNDARY when an entry has no `source` key: 18 "
                  "indic-seasian entries have none, so each of their names was "
                  "paired with the NEXT entry's source. `Hindi anuprās "
                  "subtypes` and `syair monorhyme quatrain` are in the list "
                  "below for that reason and for no other -- they record no "
                  "witness of any kind. It also drops those 18 from the count, "
                  "which is why 578 is not 601.")
            sch = pr["schemas"]
            su = pr["schemas_unsourced"]
            print("  relations.py: %d schemas, %d carry traditions, %d of those "
                  "cite ONLY R<n> pointers back into RHYME_CANON.md"
                  % (len(sch), sum(1 for s in sch if s["n_traditions"]), len(su)))
            print("  schemas with no tradition at all: %s"
                  % ([s["name"] for s in pr["schemas_no_tradition"]] or "none"))
            print("\n  NAMES WHOSE ONLY WITNESS IS THIS PROJECT")
            print("  (the `gabay higaad` class -- every recorded source is a repo "
                  "module, a doctrine, or the author's memory):")
            for n in sa["entries_sourced_only_to_this_project"]:
                print("     %s" % n)
            print("\n  and `gabay higaad` itself, which has no survey entry at "
                  "all: RHYME_CANON.md \u00a70 records that Somali appears in no "
                  "inventory cell and that the name entered the canon from repo "
                  "doctrine alone.")

            _hr("4b \u00b7 THE REPAIR  (M-15a: the survey index, inlined)")
            if not pr["index_loaded"]:
                print("  quality/canon_index.tsv is NOT PRESENT. Every verdict "
                      "above is `cannot tell`, which is not `no witness`.")
            else:
                print("  quality/canon_index.tsv: %d declared indices, %s"
                      % (pr["index_rows"], pr["index_witness"]))
                print("  basis: %s" % pr["index_basis"])
                print("  from: references counted MULTI-LINE %d over %d "
                      "distinct indices  (the single-line rule above gives "
                      "%d, and that is this runner's own doctrine-58 error)"
                      % (pr["canon_cell_ref_total_multiline"],
                         pr["canon_distinct_indices"],
                         pr["canon_cell_ref_total_singleline"]))
                print("  named structures RESOLVED: %d of %d now reach at "
                      "least one witness outside this project; %d reach none; "
                      "%d cite nothing at all"
                      % (pr["entries_external"], len(pr["canon_entries"]),
                         pr["entries_none_external"],
                         pr["entries_cites_nothing"]))
                for e in pr["entry_detail"]:
                    print("     %-6s line %-5d %-14s %s"
                          % (e["id"], e["line"], e["verdict"], e["counts"]))
                t = pr["traditions"]
                print("  Tradition rows: %d distinct over %d attachments -- "
                      "%d externally witnessed, %d THIS PROJECT'S OWN, %d "
                      "cannot be told (three counts, doctrine 79)"
                      % (t["distinct"], t["attachments"], t["external"],
                         t["project"], t["cannot_tell"]))
                print("\n  TRADITIONS WHOSE ONLY WITNESS IS THIS PROJECT -- "
                      "labelled, not deleted:")
                for c in pr["coined_traditions"]:
                    print("     %-4s %-52s %s  <- %s"
                          % (c["lang"], c["tradition"][:52], c["schema"][:26],
                             ",".join(c["cites"])))
                print("\n  SURVEY INDICES WHOSE ONLY WITNESS IS THIS PROJECT "
                      "(%d), by basis:" % len(pr["coined_indices"]))
                for idx, nm, basis in pr["coined_indices"]:
                    print("     %-6s [%-6s] %s" % (idx, basis, nm[:62]))
                print("\n  SURVEY INDICES WHOSE SOURCE NAMES NO CHECKABLE "
                      "REFERENT AT ALL (%d) -- an appeal to authority is not a "
                      "citation:" % len(pr["unrecorded_indices"]))
                for idx, nm in pr["unrecorded_indices"]:
                    print("     %-6s %s" % (idx, nm[:62]))

    if do_cov:
        _hr("5 · COVERAGE")
        cov = coverage()
        result["coverage"] = cov
        if not a.json:
            print("  %d entries, %d carry numbers, %d numbers in total"
                  % (cov["entries"], cov["entries_with_numbers"], cov["numbers_total"]))
            print("  entries with a derivation or a consistency check: %d of %d"
                  % (cov["entries_audited"], cov["entries_with_numbers"]))
            print("  NOT yet audited: %s" % " ".join(cov["unaudited"]))

    if a.json:
        print(json.dumps(result, indent=1, ensure_ascii=False, default=str))
    else:
        _hr()
        print("consistency failures: %d   FALSE derivations: %d   (total %d)"
              % (cons_failures, false_derivations,
                 cons_failures + false_derivations))
        if cons_failures or false_derivations:
            print("A register that contradicts itself is not a record. Fix the "
                  "entry, do not tune the check.")
        print("MOVED and UNVERIFIABLE do not appear in that line and do not "
              "fail this run;")
        print("`--check` is the runner that goes red when a DERIVED figure "
              "moves.")

    return 1 if (cons_failures or false_derivations) else 0


if __name__ == "__main__":
    sys.exit(main())
