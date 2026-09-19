#!/usr/bin/env python3
"""DO THE QUEUE AND THE REGISTER AGREE ABOUT WHAT IS STILL OPEN?

    python3 quality/backlog_status.py          # the census, disagreements named
    python3 quality/backlog_status.py --check  # exit 3 when the census drifts

`BACKLOG.md`'s sitting tables are the WORK QUEUE — what a session should pick
up next — and each row carries its own `status` cell. `MISSING.md`'s `###`
headings carry the REGISTER's status for the same entry ids. Two documents
stating one coordinate is doctrine 1's own case, and nothing compared them:
`quality/audit_register.py` is adversary 8, *"do the documents agree with each
other and with the code?"*, and it reads `BACKLOG.md` in prose comments only —
it never parses that table. So the queue could list an entry as OPEN for weeks
after the register closed it, and every gate in the tree stayed green.

THE COST IS A SESSION'S SITTING, NOT A WRONG NUMBER. A reader picking work off
the queue picks an entry the register says is done, and finds that out after
reading it. That is why this is a census and not a flag on anybody's writing.

TWO KINDS OF DISAGREEMENT AND THEY ARE NEVER SUMMED (doctrine 79).

  SELF-FLAGGED — the row says so itself, in its `kind` cell (`STALE · S`) or in
  its own text (*"LIKELY STALE"*). The queue already knows and the row IS the
  reconciliation task. That is the system working, not a defect.

  SILENT — nothing in the row says the register disagrees. This is the whole
  finding: a queue entry indistinguishable from a live one.

NOTHING HERE RULES ON WHICH DOCUMENT IS RIGHT, and that is deliberate. A
disagreement can mean the queue is stale OR that the register closed an entry
whose residue is real — `BACKLOG.md` itself carries a paragraph naming six
entries with *"a stale HEADLINE over a live residue"*. So this prints the LIST
and a person rules on each, the way `quality/gate_census.py` hands over its
roster rather than deciding it.

THE STATUS IS THE LAST ONE STATED, in both documents, by one rule. Both use
`~~OPEN~~ CLOSED` to supersede in place (doctrine 17), so reading the first
token would report the struck value on every reconciled row.
"""

from __future__ import annotations

import os
import re
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                ".."))

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

#: An entry id as both documents spell it: `M-74`, `M-15a`, `K-6`, `H-3`.
_EID = r"[A-Z]+-\d+[a-z]?"

#: A register heading: `### M-74 · prose … \`CLOSED\` …`
_HEADING = re.compile(rf"^### ({_EID}) · (.*)$")

#: A queue row: `| M-74 | OPEN | BUILD · M | … |`
_ROW = re.compile(rf"^\|\s*({_EID})\s*\|([^|]*)\|([^|]*)\|")

#: A status word. Both documents draw from this closed set; anything else in a
#: status cell is prose and is not read as a status.
STATUSES = ("OPEN", "PARTIAL", "BLOCKED", "CLOSED", "RESOLVED")

#: How a row declares it already knows the register has moved.
_SELF_FLAG = re.compile(r"\bSTALE\b")


def _last_status(text):
    """-> the LAST status word in `text`, or None.

    LAST, not first: both documents supersede in place with `~~OPEN~~ CLOSED`
    (doctrine 17), so the first token is the struck one on every row that has
    been reconciled.
    """
    found = [w for w in re.findall(r"[A-Z]+", text) if w in STATUSES]
    return found[-1] if found else None


def register_status(path=None):
    """-> {entry id: status} from `MISSING.md`'s headings."""
    path = path or os.path.join(ROOT, "MISSING.md")
    out = {}
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            m = _HEADING.match(line)
            if m:
                st = _last_status(m.group(2))
                if st:
                    out[m.group(1)] = st
    return out


def queue_rows(path=None):
    """-> {entry id: (status, kind cell, whole row)} from `BACKLOG.md`."""
    path = path or os.path.join(ROOT, "BACKLOG.md")
    out = {}
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            m = _ROW.match(line)
            if not m:
                continue
            st = _last_status(m.group(2))
            if st:
                out[m.group(1)] = (st, m.group(3).strip(), line.rstrip("\n"))
    return out


def census():
    """-> how the queue and the register compare, per entry."""
    reg, rows = register_status(), queue_rows()
    agree, self_flagged, silent, unregistered = [], [], [], []
    for eid in sorted(rows):
        qst, kind, line = rows[eid]
        rst = reg.get(eid)
        if rst is None:
            # A queue row naming no register entry. Reported, never summed with
            # a disagreement: "the register says otherwise" and "the register
            # has never heard of this" are different answers (doctrine 20).
            unregistered.append(eid)
            continue
        if qst == rst:
            agree.append(eid)
        elif _SELF_FLAG.search(kind) or _SELF_FLAG.search(line):
            self_flagged.append((eid, qst, rst, kind))
        else:
            silent.append((eid, qst, rst, kind))
    return {"rows": len(rows), "register": len(reg),
            "compared": len(agree) + len(self_flagged) + len(silent),
            "agree": len(agree),
            "self_flagged": self_flagged, "silent": silent,
            "unregistered": unregistered,
            "self_flagged_n": len(self_flagged), "silent_n": len(silent),
            "unregistered_n": len(unregistered)}


#: MEASURED 2026-09-19. Counts, never a threshold — `--check` reports that the
#: two documents moved apart or together, which is an answer. `silent_n` is
#: pinned at what it measures rather than at 0 BECAUSE NOTHING HERE RULES on
#: which document is right: driving it to 0 means ruling on sixteen entries,
#: which is a person's job and a sitting of its own. The pin is what makes the
#: queue's drift visible while that happens.
PINNED = {"agree": 79, "self_flagged_n": 5, "silent_n": 16,
          "unregistered_n": 0}


def report(c=None):
    c = c or census()
    out = [f"queue rows {c['rows']}   register entries {c['register']}   "
           f"compared {c['compared']}   agreeing {c['agree']}"]
    out.append("")
    out.append(f"SELF-FLAGGED ({c['self_flagged_n']}) — the row says so itself; "
               f"it IS the reconciliation task:")
    for eid, q, r, kind in c["self_flagged"]:
        out.append(f"  {eid:8s} queue {q:8s} register {r:9s}  [{kind}]")
    out.append("")
    out.append(f"SILENT ({c['silent_n']}) — nothing in the row says the "
               f"register disagrees:")
    for eid, q, r, kind in c["silent"]:
        out.append(f"  {eid:8s} queue {q:8s} register {r:9s}  [{kind}]")
    if c["unregistered"]:
        out.append("")
        out.append(f"NO REGISTER ENTRY ({c['unregistered_n']}) — not a "
                   f"disagreement, a different answer (doctrine 20): "
                   f"{', '.join(c['unregistered'])}")
    out.append("")
    out.append("Nothing here rules on which document is right. A stale "
               "HEADLINE over a live residue is a real shape and "
               "`BACKLOG.md` names six of them, so each row is a question "
               "for a person.")
    return "\n".join(out)


def check():
    """-> exit code. 3 when the census drifts from PINNED."""
    c = census()
    print(report(c))
    print()
    moved = {k: (PINNED[k], c[k]) for k in PINNED if PINNED[k] != c[k]}
    for k, (was, now) in sorted(moved.items()):
        print(f"MOVED  {k}: pinned {was}, measured {now}")
    if moved:
        print("DRIFT — the queue and the register moved apart or together. "
              "That is an answer: read the rows, rule on them, then repin.")
        return 3
    print("OK — the census reads as pinned.")
    return 0


def main(argv=None):
    argv = list(sys.argv[1:] if argv is None else argv)
    bad = [a for a in argv if a != "--check"]
    if bad:
        print(f"REFUSED — backlog_status takes only `--check`, "
              f"not {bad[0]!r}")
        return 2
    if "--check" in argv:
        return check()
    print(report())
    return 0


if __name__ == "__main__":                               # pragma: no cover
    sys.exit(main())
