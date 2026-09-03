"""WAS THIS REVISION BRIEFED, OR GUESSED?

`quality/loop.py`'s deferred proposer issues a BRIEF per flagged line before
it will accept an answer: the mandate block, the forbidden-modal set, and an
OFFERED field of legal words read at `field_depth=complete pool` against the
grader's own band. That field is the search this project exists to do — it is
complete, it excludes both ban tiers by construction, and it costs the writer
nothing because it has already been computed.

**AND NOTHING REQUIRED A WRITER TO READ IT.** A writer may leave the loop,
hand-edit the draft, and re-run `finish`, which sees a NEW DRAFT and cannot
tell it from a first one. Measured on this module's own worked example
(2026-09-02, `MISSING.md` M-200): a brief for L5 offered 24 legal words and
named 23 forbidden ones; the writer read the answering RULES, abandoned the
loop, hand-guessed five replacement pairs across three `finish` runs, and
every one of the five came back BANNED — a search the harness had already
finished, re-run worse by hand, and then written up as a property of the
tool rather than of the writer.

**THIS MODULE DOES NOT CHOOSE THE WORD, AND MUST NOT.** The brief itself says
*"Offered, NOT required … a word that is not here and rhymes is accepted"*,
and that is correct: the field is built from CMUdict, so compelling it would
refuse coinages, dialect, proper nouns and multi-word mosaic rhymes, and
would turn a harness that REJECTS bad writing into one that CHOOSES the words
(doctrine 6/7 — enforce a floor, do not order the permitted region). The gate
is therefore on the PROCESS, never on the vocabulary: was a brief ISSUED for
the line this revision changed, against the draft it changed FROM?

THE FINGERPRINT IS WHAT MAKES IT A GATE RATHER THAN A CLAIM. Every deferred
record carries `quality.revise.draft_fingerprint` of the draft its brief was
issued against, so a brief earned on one draft cannot launder a hand-edit made
to another. A changed line whose brief was issued against a different
fingerprint is UNBRIEFED here, exactly as if no brief existed.

THREE COUNTS, NEVER SUMMED (doctrine 79): BRIEFED, UNBRIEFED, and
BRIEFED_UNCHANGED — a line the loop asked about and the writer left alone,
which is neither a defect nor a revision and must not be added to either.
"""
import hashlib
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def draft_fingerprint(lines):
    """-> 12 hex chars over the joined lines.

    Spelled here rather than imported from `quality.revise` ON PURPOSE: that
    module pulls the whole grader in, and this gate must be runnable against
    two text files and a state blob with no lexicon loaded. The equivalence is
    not asserted, it is CHECKED — `test_brief_provenance.py` requires this to
    agree with `revise.draft_fingerprint` on the shipped fixtures, so the two
    cannot drift (doctrine 1's own hazard, answered by a test rather than by a
    comment).
    """
    return hashlib.md5("\n".join(lines).encode("utf-8")).hexdigest()[:12]


def read_lines(path):
    with open(path, encoding="utf-8") as f:
        return f.read().splitlines()


def changed_lines(before, after):
    """-> sorted 1-based line numbers whose text differs.

    REFUSES a length change rather than aligning: this loop revises lines and
    does not restructure a draft, so a different line count is a different
    object and a diff over it would be an invention (doctrine 20).
    """
    if len(before) != len(after):
        raise ValueError(
            f"REFUSED — {len(before)} line(s) in, {len(after)} out. This gate "
            f"asks which LINES were revised; a changed line COUNT is a "
            f"restructure, and aligning it would be guessing at which line "
            f"became which.")
    return [i + 1 for i, (b, a) in enumerate(zip(before, after)) if b != a]


def absent_states(state_paths):
    """-> the state paths that cannot be read: missing, or not JSON.

    A STATE THAT IS GONE TESTIFIES TO NO BRIEF. The ledger carries every
    `--propose=defer:` path a draft was ever run under (`write_ledger`), and
    a writer who deletes one — to start the loop over, or by tidying a
    scratch directory — leaves the ledger naming a file that is not there.
    Until 2026-09-03 (`MISSING.md` M-211) `briefed()` opened it anyway, the
    `FileNotFoundError` escaped to the CLI's top-level `OSError` handler, and
    `finish` refused with *"<path> — No such file or directory / the path is
    read relative to the working directory"* — a refusal about a path the
    writer never typed on that command line, blaming its spelling, on a run
    that had not yet decided whether the revision was briefed at all
    (doctrine 20: a mis-stated refusal is an error, not a stricter gate).
    The honest reading is the one this returns: such a path holds no
    briefs, and `admit` says so beside the lines it therefore refuses.
    """
    gone = []
    for p in state_paths:
        try:
            with open(p, encoding="utf-8") as f:
                json.load(f)
        except (OSError, ValueError):
            gone.append(p)
    return gone


def briefed(state_paths):
    """-> {line: {fingerprints}} — every line a brief was ISSUED for.

    Reads `answered.propose` (folded answers) AND `pending` (the question
    standing when the run suspended), because a brief that was issued and not
    yet answered was still put in front of the writer.

    A path that cannot be read contributes NOTHING and does not raise
    (M-211, above): the caller that wants to name it asks `absent_states`.
    """
    out = {}
    for p in state_paths:
        try:
            with open(p, encoding="utf-8") as f:
                st = json.load(f)
        except (OSError, ValueError):
            continue
        records = []
        for entries in (st.get("answered") or {}).values():
            for e in entries or []:
                if isinstance(e, dict) and isinstance(e.get("record"), dict):
                    records.append(e["record"])
        pend = st.get("pending")
        if isinstance(pend, dict) and isinstance(pend.get("record"), dict):
            records.append(pend["record"])
        for r in records:
            line = r.get("line")
            if isinstance(line, int):
                out.setdefault(line, set()).add(r.get("draft") or "")
    return out


def classify(before, after, state_paths):
    """-> dict of the three counts and their line lists, never summed."""
    changed = changed_lines(before, after)
    seen = briefed(state_paths)
    fp = draft_fingerprint(before)
    briefed_ok, unbriefed = [], []
    for line in changed:
        if fp in seen.get(line, set()):
            briefed_ok.append(line)
        else:
            unbriefed.append(line)
    unchanged = sorted(l for l in seen if l not in set(changed))
    return {
        "before_fingerprint": fp,
        "after_fingerprint": draft_fingerprint(after),
        "briefed": briefed_ok,
        "unbriefed": unbriefed,
        "briefed_unchanged": unchanged,
    }


def report(res):
    out = [
        f"  BRIEF PROVENANCE: draft {res['before_fingerprint']} -> "
        f"{res['after_fingerprint']}",
        f"    BRIEFED           {len(res['briefed']):3d}   "
        f"a brief was issued for this line, against THIS draft"
        + (f" — {res['briefed']}" if res["briefed"] else ""),
        f"    UNBRIEFED         {len(res['unbriefed']):3d}   "
        f"the line was revised with no brief behind it — the offered field "
        f"was computed and not read"
        + (f" — {res['unbriefed']}" if res["unbriefed"] else ""),
        f"    BRIEFED_UNCHANGED {len(res['briefed_unchanged']):3d}   "
        f"asked about and left alone — neither a defect nor a revision"
        + (f" — {res['briefed_unchanged']}"
           if res["briefed_unchanged"] else ""),
        "    (three counts, never summed — doctrine 79)",
    ]
    return "\n".join(out)



# ── THE LEDGER: what makes the loop the ONLY front door ──────────────────
#
# The counts above CHARGE an unbriefed revision after the fact. They cannot
# REFUSE one, because `finish` sees a draft file and has no memory of what it
# graded last (M-200's residual, ruled by the owner 2026-09-02: *"make the
# deferred loop the only front door"*). The ledger is that memory: one sidecar
# per draft, holding the lines EXACTLY AS HANDED IN, so the next run can tell
# a revision from a first draft and say which lines moved.
#
# IT RECORDS THE INPUT, NEVER THE LOOP'S OUTPUT, and the distinction is the
# whole mechanism. `finish` does not write the draft file back, so what a
# writer edits next is the file they handed in; recording the emitted draft
# instead would diff against a text that was never on disk and would charge
# every line the loop itself repaired.
LEDGER_SUFFIX = ".briefed.json"


def ledger_path(draft_path):
    return draft_path + LEDGER_SUFFIX


def read_ledger(draft_path):
    try:
        with open(ledger_path(draft_path), encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return None


def write_ledger(draft_path, lines, state_paths=()):
    """Record the draft AS HANDED IN, plus the deferred states in play.

    The state paths are carried so a later run can find the briefs without
    the writer re-naming them: a gate a caller can evade by forgetting an
    argument is a gate that fails toward whoever forgot (doctrine 16).
    """
    prev = read_ledger(draft_path) or {}
    keep = list(dict.fromkeys(list(prev.get("states") or [])
                              + [p for p in state_paths if p]))
    blob = {"version": 1, "fingerprint": draft_fingerprint(lines),
            "n_lines": len(lines), "lines": list(lines), "states": keep}
    try:
        with open(ledger_path(draft_path), "w", encoding="utf-8") as f:
            json.dump(blob, f)
    except OSError:
        pass          # a read-only tree must not fail a grade (doctrine 20)
    return blob


def admit(draft_path, lines, state_paths=(), reason=""):
    """-> (ok, message). May this draft be graded as a revision?

    FOUR ANSWERS, and only one of them refuses:
      no ledger        -> a first draft; nothing to have been briefed about
      same fingerprint -> the identical draft re-graded; not a revision
      line count moved -> a RESTRUCTURE, a different object, not this gate's
                          question (`changed_lines` refuses to diff it)
      lines moved      -> every moved line must carry a brief issued against
                          the PREVIOUS draft's fingerprint, or this refuses
    `reason` is the declared way past, and it is deliberately not a bare
    switch: it takes the writer's own words and they are carried into the
    ledger and printed, on the `fit.AssumedMeter` precedent — reachable, and
    not reachable with nobody's name on it.
    """
    led = read_ledger(draft_path)
    if not led or not led.get("lines"):
        return True, ""
    prev = list(led["lines"])
    if draft_fingerprint(lines) == led.get("fingerprint"):
        return True, ""
    if len(prev) != len(lines):
        return True, (f"  BRIEFS: the draft changed LENGTH ({len(prev)} -> "
                      f"{len(lines)} lines), which is a restructure and not a "
                      f"revision — this gate asks which LINES moved and a "
                      f"changed count has no answer (doctrine 20).")
    moved = [i + 1 for i, (a, b) in enumerate(zip(prev, lines)) if a != b]
    if not moved:
        return True, ""
    paths = list(dict.fromkeys(list(led.get("states") or [])
                               + list(state_paths)))
    seen = briefed(paths)
    # NAMED, NOT SWALLOWED: a state the ledger carries and the disk no longer
    # holds is part of WHY a line reads unbriefed, and the writer who deleted
    # it is the one reading this (M-211). Its own count, never folded into
    # the line list (doctrine 79).
    gone = absent_states(paths)
    gone_say = (f" — and {len(gone)} of the ledger's deferred state(s) "
                f"cannot be read, so testify to no brief: {gone}"
                if gone else "")
    fp = led["fingerprint"]
    un = [n for n in moved if fp not in seen.get(n, set())]
    if not un:
        return True, (f"  BRIEFS: {len(moved)} revised line(s), every one "
                      f"briefed against draft {fp} — {moved}")
    if reason:
        return True, (f"  BRIEFS: {len(un)} line(s) revised with NO brief "
                      f"behind them — {un}. ADMITTED because the caller "
                      f"declared a reason, which is recorded and printed "
                      f"rather than assumed: {reason!r}{gone_say}")
    return False, (
        f"unbriefed revision — line(s) {un} moved since draft {fp} and no "
        f"brief was ever issued for them{gone_say}")


def main(argv):
    args = [a for a in argv if not a.startswith("--")]
    check = "--check" in argv
    if len(args) < 2:
        print("  REFUSED — usage: brief_provenance.py BEFORE AFTER "
              "[STATE.json ...] [--check]\n"
              "    BEFORE/AFTER are drafts; STATE is a `--propose=defer:` "
              "state file. --check exits 3 when any revised line was never "
              "briefed.")
        return 2
    try:
        before, after = read_lines(args[0]), read_lines(args[1])
        res = classify(before, after, args[2:])
    except ValueError as e:
        print(f"  {e}")
        return 2
    except OSError as e:
        print(f"  REFUSED — {e}")
        return 2
    print(report(res))
    if check and res["unbriefed"]:
        print("\n  FAIL — a revised line with no brief behind it. The loop had "
              "already searched the complete pool for that position and "
              "excluded both ban tiers; guessing past it re-runs that search "
              "worse. Answer from `--propose=defer:` instead.")
        return 3
    if check:
        print("\n  PASS — every revised line was briefed against this draft.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
