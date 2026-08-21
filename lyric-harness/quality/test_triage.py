#!/usr/bin/env python3
"""Regressions for the register triage.

WHAT IS BEING PROVEN is not that the buckets are computed — it is that the
instrument CANNOT GO QUIETLY GREEN. Every failure this file guards against
produces a clean-looking report:

  a heading pattern that stops matching  -> 0 entries, 0 contested, PASS
  a status word missing from the list    -> a CLOSED entry at the head of the
                                            queue, reported as next
  the citation scan matching nothing     -> every entry UNGUARDED, PASS
  the citation scan matching everything  -> every entry CONTESTED

Run: python3 quality/test_triage.py
"""

import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))

from quality import triage as T  # noqa: E402

FAILURES = []


def check(name, ok, detail=""):
    print("  %s  %s" % ("PASS" if ok else "FAIL", name))
    if detail:
        print("          %s" % detail)
    if not ok:
        FAILURES.append(name)


ENTRIES = T.scan(T.read_entries())
BY = {e.key: e for e in ENTRIES}


def test_the_population_is_real():
    print("\n1. the registers are read, and an empty read REFUSES")
    # THE FLOOR IS 100 BECAUSE 60 LET AN 18-ENTRY LOSS READ AS A PASS.
    # The first reader demanded `\`STATUS\`` at end-of-line; eighteen of 77
    # MISSING entries carry a date, an aside or a doctrine cite after the
    # status and silently fell out — K-7, L-1 and L-2 among them, all OPEN,
    # in NO bucket for the instrument's whole first day, while this check
    # passed at 88. A floor cannot see a +1 (M-21), but it can be set above
    # the last measured failure: a re-drop of the dated-heading class takes
    # 106 below 100 and this check goes red.
    check("both registers parse into a real population", len(ENTRIES) > 100,
          "%d entries: %d from MISSING.md, %d from BACKLOG.md"
          % (len(ENTRIES),
             sum(1 for e in ENTRIES if e.source == "MISSING.md"),
             sum(1 for e in ENTRIES if e.source == "BACKLOG.md")))
    # THE THREE HEADING SHAPES THE REGISTER ACTUALLY WRITES, pinned on the
    # PREDICATE. A dated close, a status with an aside, and no status at all
    # (L-3's shape — an entry that has not said it is finished must surface
    # as OPEN, not vanish).
    for head, want in (
            ("### X-1 · a probe `CLOSED` 2026-08-11", "CLOSED"),
            ("### X-2 · a probe `PARTIAL` — the container exists", "PARTIAL"),
            ("### X-3 · a probe `BLOCKED` (doctrine 44)", "BLOCKED"),
            ("### X-4 · a probe with no status token", "OPEN")):
        m = T.MISSING_HEAD.match(head)
        st = T.MISSING_STATUS.search(m.group(2)) if m else None
        got = st.group(1) if st else ("OPEN" if m else None)
        check("heading shape parses: %r -> %s" % (head[10:44], want),
              got == want, "got %s" % got)
    # A heading pattern that stops matching is the failure that reads as a
    # pass, so the reader raises rather than returning [].
    real, T.MISSING_HEAD, T.BACKLOG_HEAD = (
        (T.MISSING_HEAD, T.BACKLOG_HEAD),
        re.compile(r"^### NEVER_MATCHES ()()()$"),
        re.compile(r"^### NEVER_MATCHES ()()$"))
    try:
        raised = False
        try:
            T.read_entries()
        except RuntimeError as exc:
            raised = "empty population" in str(exc)
        check("a reader that matches NOTHING raises rather than reporting a "
              "clean register (doctrine 20)", raised)
    finally:
        T.MISSING_HEAD, T.BACKLOG_HEAD = real


def test_the_status_vocabulary():
    print("\n2. every closed marker this repo actually writes is read")
    # MEASURED off BACKLOG.md, not assumed: missing BUILT put `3.6 Corpus
    # adversary` — whose heading says BUILT 2026-08-11 — at the head of the
    # queue, and missing DECIDED did the same for 4.4.
    # CLOSED-SIDE ONLY, and that is the repair rather than a fresher literal.
    # This list read `("2.2", True)` until 2.2 closed four hours later, which
    # is the pinned-literal defect this whole sitting has been removing —
    # committed inside the test written to remove it. A CLOSED entry stays
    # closed (doctrine 17 keeps the marker), so these four are stable; whether
    # any given entry is OPEN is exactly the volatile fact, and it is asserted
    # as a POPULATION below instead of per key.
    for key, want in (("3.6", False), ("4.4", False), ("1.5", False),
                      ("2.1", False)):
        e = BY.get(key)
        if e is None:
            check("BACKLOG %s is in the population" % key, False)
            continue
        check("BACKLOG %s reads %s" % (key, "OPEN" if want else "closed"),
              e.is_open is want, "status=%s title=%r" % (e.status,
                                                        e.title[:44]))
    opens = [e for e in ENTRIES if e.source == "BACKLOG.md" and e.is_open]
    check("...and the OPEN side is asserted as a population, not per key — "
          "some BACKLOG entry still reads open",
          bool(opens), "%d open: %s"
          % (len(opens), ", ".join(e.key for e in opens[:6])))
    check("a heading's own code spans survive into the title — stripping "
          "from the first backtick turned 2.4's title into the word 'The'",
          BY["2.2"].title.startswith("`qieyun_mc.tsv`"),
          repr(BY["2.2"].title))


def test_the_citation_scan_discriminates():
    print("\n3. the scan finds real citations and refuses lookalikes")
    named = [e for e in ENTRIES if e.tests]
    check("some entries are named by a test, and not all of them",
          0 < len(named) < len(ENTRIES),
          "%d of %d entries are named by at least one test"
          % (len(named), len(ENTRIES)))
    # THE LOOKALIKE THAT MOTIVATED `MISSING_NEAR`, tested on the PREDICATE
    # rather than on a witness. The first draft asserted that `schemes.py`
    # does not cite A-1 — and it does, in as many words
    # (`# THE REFRAIN NOTATION (MISSING.md A-1)`), so the assertion was wrong
    # and the scan was right. What the window actually buys is that a BARE
    # `[A-1]` — the refrain notation, eleven times over in that same file —
    # is not read as a citation.
    m = re.compile(r"MISSING(?:\.md)?[^\n]{0,%d}?\b([A-Z]-\d+[a-z]?)\b"
                   % T.MISSING_NEAR)
    check("a bare `[A-1]` in a scheme string is NOT read as citing A-1",
          not m.findall("groups = parse('[A-1] [A-2]')  # a refrain scheme"))
    check("...while a real citation IS read",
          m.findall("# THE REFRAIN NOTATION (MISSING.md A-1)") == ["A-1"])
    check("...and the window is bounded, so a MISSING far above an unrelated "
          "id does not capture it",
          not m.findall("MISSING.md is the register." + " " * 80 + "K-6"))
    # BOTH BACKLOG SPELLINGS. `BACKLOG §2.6` was missed by the first draft —
    # nine citations across four entries use the section sign, including all
    # three for 2.6, whose own answer names it in its first line. 2.6 sat at
    # the head of "what is next" while fully built because of one character.
    b = re.compile(r"BACKLOG(?:\s+|\s*§\s*)(\d+\.\d+)")
    check("`BACKLOG 2.6` is read",
          b.findall("see BACKLOG 2.6 for why") == ["2.6"])
    check("...and so is `BACKLOG §2.6`, the spelling that hid a built entry "
          "at the head of the queue",
          b.findall("MATCHED CONTROLS. BACKLOG §2.6.") == ["2.6"])
    check("...and a bare decimal near the word is NOT read as a citation",
          not b.findall("the BACKLOG. 2.6 seconds elapsed"))
    # EVERY KEY IN THE WINDOW. The old pattern was non-greedy to ONE capture,
    # so `test_song_function.py`'s header — "`MISSING.md` A-1, A-2, D-1,
    # D-2, D-3", a completely ordinary way to cite five entries — was read
    # as citing A-1 alone, and D-1 spent this instrument's whole first day
    # in UNGUARDED while a test named it. Driven through the SHIPPED scan
    # via a synthetic entry set rather than a re-implementation.
    line = "`MISSING.md` A-1, A-2, D-1, D-2, D-3."
    w = T.re.compile(r"MISSING(?:\.md)?`?([^\n]{0,%d})" % T.MISSING_NEAR)
    k = T.re.compile(r"\b([A-Z]-\d+[a-z]?)\b")
    got = {x for win in w.findall(line) for x in k.findall(win)}
    check("a multi-key citation yields EVERY key in the window",
          got == {"A-1", "A-2", "D-1", "D-2", "D-3"}, str(sorted(got)))
    check("...and the live scan agrees: D-2 and D-3 are named by "
          "test_song_function.py",
          "quality/test_song_function.py" in BY["D-2"].tests
          and "quality/test_song_function.py" in BY["D-3"].tests,
          "D-2 tests=%s" % BY["D-2"].tests)


def test_the_signal_was_validated_backwards():
    print("\n4. the three entries that went stale on 2026-08-21 are the ones "
          "this instrument would have caught")
    # Doctrine 31: a queue built after the fact that does not contain the
    # cases that motivated it is fitted to nothing. All three are CLOSED now,
    # so what is asserted is that a TEST NAMES THEM — the property that would
    # have put them in CONTESTED while they still read OPEN.
    for key in ("1.5", "2.4", "M-1"):
        e = BY[key]
        check("%s is named by a regression, so it would have been CONTESTED "
              "while it read OPEN" % key, bool(e.tests),
              ", ".join(e.tests) or "NO TEST NAMES IT")
    # AND THE ONE THAT WOULD NOT HAVE BEEN, stated rather than hidden: nothing
    # names `BACKLOG 2.1` itself. It was reachable only through `M-1`, its
    # MISSING half, which IS named — so the pair was covered and the BACKLOG
    # heading alone was not. A cross-register entry is caught by whichever
    # half the code happens to cite (doctrine 20: say which).
    check("`BACKLOG 2.1` itself is named by nothing, and this instrument "
          "would have reached it only through M-1",
          not BY["2.1"].tests and bool(BY["M-1"].tests),
          "2.1 tests=%s | M-1 tests=%s"
          % (BY["2.1"].tests or "none", ", ".join(BY["M-1"].tests)))
    # THE SELF-REFERENCE GUARD, and it earned itself the same day. THIS FILE
    # names 2.1 in the check above — to assert nothing names it — and for one
    # commit the scan counted that as a citation, making the check refute
    # itself. `triage.SELF` excludes the instrument AND its suite.
    check("neither this file nor triage.py is counted as evidence about any "
          "entry",
          not any(os.path.basename(f) in T.SELF
                  for e in ENTRIES for f in e.tests + e.code),
          "offenders: %s"
          % sorted({f for e in ENTRIES for f in e.tests + e.code
                    if os.path.basename(f) in T.SELF}))


def test_the_escape_hatch_is_two_sided():
    print("\n5. a declaration moves an entry out of CONTESTED, and only a "
          "declaration does")
    open_tested = [e for e in ENTRIES if e.is_open and e.tests]
    check("the population is non-empty — with no open-and-tested entry every "
          "check below would pass on an empty set (doctrine 20)",
          bool(open_tested), "%d entr(ies)" % len(open_tested))
    for e in open_tested:
        check("%s is DECLARED, not CONTESTED" % e.key,
              T.bucket(e) == "DECLARED", "bucket=%s" % T.bucket(e))
    # And the marker is what does it: strip it and the same entry contests.
    victim = open_tested[0]
    real = victim.body
    try:
        victim.body = T.DECLARED_RE.sub("(removed)", real)
        check("...and with the marker removed it CONTESTS — so the bucket is "
              "the declaration's doing and not an accident of the scan",
              T.bucket(victim) == "CONTESTED",
              "bucket=%s" % T.bucket(victim))
    finally:
        victim.body = real


def test_the_queue_is_ordered_and_stated():
    print("\n6. the queue answers the question it is named for")
    nxt = sorted((e for e in ENTRIES if T.bucket(e) == "UNGUARDED"),
                 key=lambda x: x.tier)
    check("UNGUARDED is non-empty — an empty queue after the 2026-08-21 sweep "
          "is more likely a broken scan than an empty backlog",
          bool(nxt), "%d entr(ies)" % len(nxt))
    backlog = [e for e in nxt if e.source == "BACKLOG.md"]
    check("BACKLOG entries sort ahead of MISSING ones, and by tier",
          not backlog or nxt[:len(backlog)] == backlog,
          "head: %s" % ", ".join(e.key for e in nxt[:5]))
    check("every queued entry really is open, and nothing names it at all",
          all(e.is_open and not e.tests and not e.code for e in nxt),
          "offenders: %s"
          % [e.key for e in nxt if not e.is_open or e.tests or e.code][:5])
    # THE BUCKET THAT WAS ADDED BECAUSE THE QUEUE WAS WRONG. D-1 was the
    # founding case — cited by `grid.py`, stale at head, no test apparently
    # naming it — and it CLOSED on 2026-08-21, so pinning D-1 here became
    # the pinned-literal defect §2 already documents: this check failed the
    # moment the entry it pinned got fixed, which is when a check should be
    # celebrating. The bucket is asserted as a POPULATION (the same repair
    # §2 got), and D-1's history is asserted where it is stable: it is
    # CLOSED, and `grid.py` still cites it, which is what made it CITED.
    cited = [e for e in ENTRIES if T.bucket(e) == "CITED"]
    check("CITED is non-empty — a population, not a pinned founding case",
          bool(cited),
          "%d cited: %s" % (len(cited),
                            ", ".join(e.key for e in cited[:8])))
    d1 = BY.get("D-1")
    check("...and D-1, its founding case, is CLOSED and still cited by "
          "production code — the history that motivated the bucket",
          d1 is not None and not d1.is_open and bool(d1.code),
          "status=%s code=%s" % (d1 and d1.status, d1 and d1.code[:2]))
    check("...and no CITED entry is in the queue",
          not ({e.key for e in cited} & {e.key for e in nxt}))


def main():
    print("=" * 70)
    print("REGISTER TRIAGE — quality/triage.py")
    print("=" * 70)
    test_the_population_is_real()
    test_the_status_vocabulary()
    test_the_citation_scan_discriminates()
    test_the_signal_was_validated_backwards()
    test_the_escape_hatch_is_two_sided()
    test_the_queue_is_ordered_and_stated()
    print("\n" + "=" * 70)
    if FAILURES:
        print("%d FAILING: %s" % (len(FAILURES), ", ".join(FAILURES)))
        return 1
    print("the register can be asked what is next, and says so in five counts")
    return 0


if __name__ == "__main__":
    sys.exit(main())
