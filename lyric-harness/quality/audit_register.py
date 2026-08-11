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
    python3 quality/audit_register.py --json          # machine-readable

EXIT STATUS is meaningful, unlike `battery.py`'s: non-zero when a consistency
check fails or a derivation returns FALSE. MOVED and UNVERIFIABLE do not fail
the run — a register is allowed to age, it is not allowed to contradict itself.
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
    for p in ("/workspace/mm47873/47873-8.txt",
              os.path.join(ROOT, "corpus", "47873-8.txt")):
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
    for ident in ("M-3", "M-4", "N-3"):
        t = entry_text(entries, ident)
        for m in re.finditer(r"([\d,]+)\s+(?:Malay\s+)?(?:verse\s+)?blocks", t):
            quoted.append((ident, "blocks", float(m.group(1).replace(",", ""))))
        for m in re.finditer(r"\(?([\d,]+)\s+lines", t):
            quoted.append((ident, "lines", float(m.group(1).replace(",", ""))))
        for m in re.finditer(r"([\d,]+)\s+tokens\)", t):
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


def _d_songs():
    songs, _, _ = _song_stats(_song_files("eng_"))
    return CONFIRMED if songs == 5006 else MOVED, songs, "5,006 English songs"


def _d_sung_lines():
    _, lines, _ = _song_stats(_song_files("eng_"))
    v = CONFIRMED if lines == 154346 else MOVED
    return v, lines, ("154,346 sung lines; counting rule here is non-blank lines "
                      "that are not #, --- or [ -- the entry states no rule")


def _d_repeat_blocks():
    _, _, tags = _song_stats(_song_files("eng_"))
    got = (tags["BURDEN"], tags["REFRAIN"], tags["CHORUS"])
    v = CONFIRMED if got == (1603, 604, 247) else MOVED
    return v, "BURDEN %d REFRAIN %d CHORUS %d (sum %d)" % (got + (sum(got),)), \
        "1,603 BURDEN / 604 REFRAIN / 247 CHORUS, sum 2,454"


def _d_authors():
    auth = set()
    for f in _song_files("eng_"):
        m = re.search(r"^# author:\s*(.+)$", open(f, encoding="utf-8", errors="replace").read(), re.M)
        if m:
            auth.add(m.group(1).strip())
    return (CONFIRMED if len(auth) == 143 else MOVED), len(auth), "143 authors"


def _d_named_airs():
    """There is no declared air field. That IS the answer."""
    fields = collections.Counter(re.findall(r"^--- ([A-Z_]+):",
                                            "\n".join(open(f, encoding="utf-8", errors="replace").read()
                                                      for f in _song_files("eng_")), re.M))
    strict = 0
    for f in _song_files("eng_"):
        for l in open(f, encoding="utf-8", errors="replace"):
            if l.startswith("--- TITLE:") and re.search(r"\[[Aa]ir|\([Aa]ir|AIR *[-—:]|Air *[-—:]", l):
                strict += 1
    return UNVERIFIABLE, ("no --- AIR: field exists (markers present: %s); the "
                          "nearest mechanical rule over TITLE strings gives %d"
                          % (", ".join(sorted(fields)), strict)), \
        "331 of 5,006 songs carry a named air (6.6%)"


def _d_chorus_stubs():
    import lyric_harness as LH
    n = collections.Counter()
    for f in _song_files():
        lang = os.path.basename(f)[:3]
        for l in open(f, encoding="utf-8", errors="replace"):
            s = l.strip()
            if not s or s.startswith("#") or s.startswith("---") or s.startswith("["):
                continue
            if LH.is_chorus_stub(s):
                n[lang] += 1
    return (CONFIRMED if n["eng"] == 941 else MOVED), \
        "is_chorus_stub fires on %d eng / %d cym / %d fin lines" % (n["eng"], n["cym"], n["fin"]), \
        "941 stub instances in the staged corpus"


def _d_jne():
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


def _d_stub_forms():
    import lyric_harness as LH
    forms = [(f[0], f[1]) for f in getattr(LH, "CHORUS_STUB_FORMS", ())]
    langs = [f[0] for f in forms]
    return (FALSE if "msa" in langs else CONFIRMED), \
        "CHORUS_STUB_FORMS declares %s" % (forms,), \
        "the Malay d. s. b. row was false and is struck through"


def _d_lyricists():
    import csv
    p = os.path.join(ROOT, "data", "lyricists.tsv")
    rows = list(csv.DictReader(open(p, encoding="utf-8"), delimiter="\t"))
    lang = collections.Counter(r["lang"] for r in rows)
    return None, rows, lang


def _d_eng_status():
    _, rows, _ = _d_lyricists()
    c = collections.Counter(r["status"] for r in rows if r["lang"] == "eng")
    ok = (c["SOURCED"] == 142 and c["NOT_FOUND"] == 70
          and sum(1 for r in rows if r["lang"] == "eng") == 220)
    return (CONFIRMED if ok else MOVED), \
        "220 eng rows: %s" % dict(c), "142 SOURCED, 70 NOT_FOUND, of 220"


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


def _d_phonologies():
    import glob
    mods = sorted(os.path.basename(p)[:-3] for p in
                  glob.glob(os.path.join(HERE, "phonology", "*.py"))
                  if not os.path.basename(p).startswith("__"))
    return (CONFIRMED if "eng" not in mods and len(mods) == 8 else MOVED), \
        "%d modules: %s" % (len(mods), " ".join(mods)), \
        "eight phonologies, and English is not one"


def _d_traditions_populated():
    from quality import relations as R
    S = R.all_schemas()
    pop = [n for n, s in S.items() if getattr(s, "traditions", ())]
    rows = set()
    for s in S.values():
        for t in s.traditions:
            rows.add((t.name, t.lang, t.source))
    ext = [r for r in rows if not re.fullmatch(r"R\d+[a-z]?(\+R\d+[a-z]?)*", r[2] or "")]
    return (CONFIRMED if not pop else MOVED), \
        ("%d schemas, %d with traditions populated, %d distinct Tradition rows; "
         "%d of them cite a source that is not an R<n> pointer into RHYME_CANON.md"
         % (len(S), len(pop), len(rows), len(ext))), \
        "traditions declared on 77 schemas and populated on ZERO"


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


def _d_fin_census():
    from quality.phonology import fin
    F = fin.Finnish()
    tot = unread = 0
    for f in _song_files("fin_"):
        t = open(f, encoding="utf-8", errors="replace").read()
        body = "\n".join(l for l in t.split("\n")
                         if l.strip() and not l.startswith("#")
                         and not l.strip().startswith("---") and not l.strip().startswith("["))
        c = fin.readability_census(F, fin._tokens(body))
        tot += c["total"]
        unread += c.get("refused", 0) + c.get("defective", 0)
    return UNVERIFIABLE, \
        ("the module's own tokenizer and census over all ten fin_* files give "
         "%d tokens and %d unreadable, two orders off the entry's 155; the entry "
         "states no tokenizer and no reason-code filter" % (tot, unread)), \
        "all ten fin_* 155 -> 139 unreadable tokens"


def _d_cym_readability():
    from quality.phonology import cym
    C = cym.Welsh()
    tot = bad = 0
    for f in _song_files("cym_"):
        t = open(f, encoding="utf-8", errors="replace").read()
        body = "\n".join(l for l in t.split("\n")
                         if l.strip() and not l.startswith("#")
                         and not l.strip().startswith("---") and not l.strip().startswith("["))
        toks = cym.WORD_RE.findall(cym.normalise(body) if hasattr(cym, "normalise") else body)
        tot += len(toks)
        for w in toks:
            try:
                if not C.syllabify(w):
                    bad += 1
            except Exception:
                bad += 1
    return UNVERIFIABLE, \
        ("cym exposes no readability_census, unlike msa and fin, so 'read / "
         "refused / defective' cannot be split. Under the module's own WORD_RE "
         "the five files give %d tokens and %d that syllabify() will not take "
         "(bare -- runs and proclitic fragments like F' and 'N). A bare "
         "'100.00%%' is not checkable without the three counts doctrine 79 asks for."
         % (tot, bad)), \
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
    Claim("D20", "F-1", "phonology modules", 8, _d_phonologies, "quality/audit_register.py"),
    Claim("D21", "M-15", "traditions populated", 0, _d_traditions_populated, "quality/audit_register.py"),
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
    """The list of names whose only witness is this project."""
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

    return {
        "canon_entries": canon,
        "canon_unsourced": [c for c in canon if not c["external"]],
        "canon_year_tokens": len(years),
        "canon_cell_refs": dict(cellrefs),
        "canon_cell_ref_total": sum(cellrefs.values()),
        "survey_array_on_disk": _find_survey_array(),
        "schemas": sch,
        "schemas_unsourced": [s for s in sch if s["n_traditions"] and not s["external"]],
        "schemas_no_tradition": [s for s in sch if not s["n_traditions"]],
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


def _hr(t=""):
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
    ap.add_argument("--only", action="append", help="restrict derivations to an entry id")
    ap.add_argument("--json", action="store_true", help="machine-readable")
    a = ap.parse_args(argv)

    picked = a.consistency or a.provenance or a.coverage
    do_cons = a.consistency or not picked
    do_prov = a.provenance or not picked
    do_der = not picked
    do_cov = a.coverage or not picked

    result = {}
    failures = 0

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
                failures += 1
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
                failures += 1
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
                  "citation (%.0f%%)" % (n, u, 100.0 * u / max(1, n)))
            print("  publication-year tokens in the whole 94 KB file: %d"
                  % pr["canon_year_tokens"])
            print("  every `from:` line indexes a six-agent survey array: %d "
                  "references, %s" % (pr["canon_cell_ref_total"], pr["canon_cell_refs"]))
            sa = pr["survey_array_on_disk"]
            print("  that array (%s): %s" % (sa["workflow"], sa["verdict"]))
            print("     %d named survey entries recovered from the transcripts; "
                  "the repository contains none of them"
                  % sa["entries_recovered"])
            print("     of those, %d record NO source but this project "
                  "(a phonology module, a CLAUDE.md doctrine, or 'from memory')"
                  % len(sa["entries_sourced_only_to_this_project"]))
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
        print("consistency failures + FALSE derivations: %d" % failures)
        if failures:
            print("A register that contradicts itself is not a record. Fix the "
                  "entry, do not tune the check.")

    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
