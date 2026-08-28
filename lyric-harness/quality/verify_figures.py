"""verify_figures — the prose that quotes a pinned figure answers to the pin.

`MISSING.md` M-33, 2026-08-28. One joint AUC pair was written in TWELVE
places in `quality/RESULTS.md`, and a careful repin left seven of them stale
— one of them a table row whose own third column read "COLD, current".
`quality/test_discriminate.py` pins the MEASUREMENT to 5e-4 and would go red
the instant it drifted; nothing related that pin to the prose, so a repin
was a manual grep and a manual grep is a thing that gets tired. Doctrine 1
at document scale: one quantity, eleven copies, one of them mechanical.

WHAT THIS INSTRUMENT DOES.  For each TRACKED quantity it derives the
CURRENT prose spelling from the pin itself (`test_discriminate.PINNED`,
rounded to the precision the prose quotes), so this file holds no second
copy of the number — if the measurement repins, this check goes red until
the prose and the superseded ladder move with it, which is exactly the
relation M-33 found missing.  It then scans the document for every
occurrence of the current AND superseded spellings and classifies each by
the DECLARED live/history form.

THE DECLARED FORM, and why it is exactly two markers.  A figure is quoted
as HISTORY iff (a) it sits inside a `~~struck~~` span on its own line, or
(b) its line is a blockquote (leading `>`).  Nothing else is history: not
the word SUPERSEDED nearby, not a paragraph about supersession — M-33's own
seven stale sites include two sitting BESIDE the word "SUPERSEDED" in a
sentence about a different figure's supersession, so keyword marking is
measured too weak, not merely unaesthetic.  A superseded spelling in a live
context is a VIOLATION whatever the surrounding prose says.

SCOPE IS DECLARED PER DOCUMENT, and `CLAUDE.md` is OUT of it, named
(doctrine 20): doctrine 7's ladder sentence quotes the whole supersession
chain in running prose ("0.709/0.971, warm post-fix 0.659/0.975, cold
0.717/0.964, and cold with the sentinel corrected 0.723/0.960") — a
legitimate doctrine-17 form the two-marker rule cannot admit, and admitting
it by keyword would re-open the hole the rule exists to close.  A document
enters scope when its history quoting uses the two declared forms.

FOUR COUNTS, NEVER SUMMED (doctrine 79): occurrences quoting the CURRENT
value (anywhere — a live figure may appear in history blocks recording the
moment it arrived), SUPERSEDED values in history form (doctrine 17
working), RETIRED values (older generations, quoted freely in labelled
narrative — listed for the record, policed by nothing; see TRACKED for
the lifecycle and the measured line between the two), and VIOLATIONS —
superseded values in live form.

`--check`: exit 0 when violations == 0 and every derived spelling matches
the declaration, exit 3 otherwise (the pin-drift/record-drift family).
"""
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _pinned():
    try:
        from quality.test_discriminate import PINNED
    except ImportError:
        sys.path.insert(0, ROOT)
        from quality.test_discriminate import PINNED
    return PINNED


#: THE TRACKED QUANTITIES, and the lifecycle a repin walks them through.
#: `derive` computes the current value from the pin; `precision` is the
#: decimal precision THE PROSE quotes (3 — "0.723", never the pin's own 16
#: digits).  `superseded` is the IMMEDIATELY-PRIOR reading, the one a tired
#: repin leaves standing (M-33's seven stale sites were all this
#: generation), and it is POLICED: it may appear only in the two declared
#: history forms.  `retired` is everything older — readings the document
#: quotes freely in labelled narrative ("pre-fix 0.971 against 0.709",
#: "warm post-fix 0.659/0.975"), which IS the doctrine-17 record and must
#: not be forced into strikethrough; retired spellings are listed for the
#: record and checked by nothing.  The line between the two is drawn from
#: M-33's own measurement: every stale site the entry adjudicated quoted
#: the prior generation, none quoted a retired one, because the danger is
#: the value that was current when the sentence was written.
#:
#: ON THE NEXT REPIN, the sitting that moves the pin moves this table in
#: the same commit: current -> superseded (now policed), superseded ->
#: retired, the new spelling in.  The derivation check below goes red until
#: it does, which is the relation M-33 found missing.
TRACKED = (
    {"name": "joint held-out AUC, Exp 1 (selection)",
     "derive": lambda p: p["abs_exp1"]["joint_all"],
     "precision": 3, "current_spelling": "0.723",
     "superseded": ("0.717",),
     "retired": ("0.716809", "0.659", "0.709")},
    {"name": "joint held-out AUC, Exp 2 (rejection)",
     "derive": lambda p: p["abs_exp2"]["joint_all"],
     "precision": 3, "current_spelling": "0.960",
     "superseded": ("0.964",),
     "retired": ("0.975", "0.971")},
    {"name": "the gap, rejection minus selection",
     "derive": lambda p: (p["abs_exp2"]["joint_all"]
                          - p["abs_exp1"]["joint_all"]),
     "precision": 3, "current_spelling": "0.237",
     "superseded": ("0.247",),
     "retired": ("0.262", "0.015", "0.025")},
)

#: The documents in scope.  Per-document, declared, extendable.
DOCUMENTS = ("quality/RESULTS.md",)

_STRUCK = re.compile(r"~~.*?~~")


def is_history(line, start, end):
    """Is the occurrence at [start:end) of `line` quoted as HISTORY?

    The DECLARED form, exactly two markers: inside a ~~struck~~ span, or on
    a blockquote line.  This is the whole rule on purpose — see the module
    docstring for the measurement that refuses keyword marking.
    """
    if line.lstrip().startswith(">"):
        return True
    for m in _STRUCK.finditer(line):
        if m.start() <= start and end <= m.end():
            return True
    return False


def _occurrences(text, spelling):
    """Yield (line_no, line, start, end) for each occurrence of `spelling`
    as a standalone decimal (not a prefix of a longer number)."""
    pat = re.compile(re.escape(spelling) + r"(?!\d)")
    for i, line in enumerate(text.splitlines(), 1):
        for m in pat.finditer(line):
            yield i, line, m.start(), m.end()


def survey(root=ROOT, pinned=None, docs=None):
    """-> (rows, derivation_complaints).

    Each row: (doc, quantity name, spelling, line_no, class) with class in
    {"current", "history", "VIOLATION"}.  A derivation complaint names a
    TRACKED row whose declared current_spelling does not match the pin —
    the state this instrument exists to make loud.
    """
    p = _pinned() if pinned is None else pinned
    derivation = []
    for t in TRACKED:
        got = f"{t['derive'](p):.{t['precision']}f}"
        if got != t["current_spelling"]:
            derivation.append(
                f"{t['name']}: the pin derives {got!r} and the declaration "
                f"says {t['current_spelling']!r} — the measurement moved and "
                f"this table (and the prose it guards) did not, which is the "
                f"drift M-33 exists to make loud. Repin the prose, the "
                f"superseded ladder, and this spelling in one sitting.")
    rows = []
    for doc in (DOCUMENTS if docs is None else docs):
        path = os.path.join(root, doc)
        with open(path, encoding="utf-8") as f:
            text = f.read()
        for t in TRACKED:
            for ln, line, s, e in _occurrences(text, t["current_spelling"]):
                rows.append((doc, t["name"], t["current_spelling"], ln,
                             "current"))
            for sp in t["superseded"]:
                for ln, line, s, e in _occurrences(text, sp):
                    cls = ("history" if is_history(line, s, e)
                           else "VIOLATION")
                    rows.append((doc, t["name"], sp, ln, cls))
            for sp in t.get("retired", ()):
                for ln, line, s, e in _occurrences(text, sp):
                    rows.append((doc, t["name"], sp, ln, "retired"))
    return rows, derivation


def report(rows, derivation):
    cur = [r for r in rows if r[4] == "current"]
    hist = [r for r in rows if r[4] == "history"]
    ret = [r for r in rows if r[4] == "retired"]
    bad = [r for r in rows if r[4] == "VIOLATION"]
    print("verify_figures — the prose answers to the pin (M-33)")
    print(f"  documents in scope: {', '.join(DOCUMENTS)}")
    print(f"  occurrences quoting the CURRENT value: {len(cur)}")
    print(f"  superseded values in HISTORY form (struck or blockquote — "
          f"doctrine 17 working): {len(hist)}")
    print(f"  RETIRED values, listed and policed by nothing (labelled "
          f"narrative is the record): {len(ret)}")
    print(f"  VIOLATIONS — a superseded value quoted live: {len(bad)}")
    for doc, name, sp, ln, _c in bad:
        print(f"    {doc}:{ln}  {sp}  ({name})")
    for d in derivation:
        print(f"  DERIVATION: {d}")
    return bad, derivation


def main(argv):
    rows, derivation = survey()
    bad, derivation = report(rows, derivation)
    if "--check" in argv:
        return 3 if (bad or derivation) else 0
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
