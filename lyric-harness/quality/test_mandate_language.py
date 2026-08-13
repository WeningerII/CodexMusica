#!/usr/bin/env python3
"""The mandate language: RHYME, RETURN, and the repeat licence per PAIR.

WHAT THIS SUITE IS FOR, AND THE TRAP IT IS BUILT AROUND

This work CREATES A ZERO. Measured on a real draft against this repo's own
mandate (`SONG_SCHEME`, below), a chorus return with no `returns=` declared
generates REPEAT collisions where it comes back — and after the return is
declared, those are gone. Doctrine 94: a positive-case suite cannot find a
rule that is too generous, and every zero in this repo needs a fixture proving
the detector could still have fired. This repo has already shipped one zero
justified by a test that did not exist.

So the suite is organised around FIRING, not around passing:

  §3  a return that DRIFTS is caught          — and it is caught on the real
                                                song, four times, not on a
                                                fixture somebody constructed
  §4  a return whose RHYME breaks is caught
  §5  the licence DOES NOT LEAK               — REPEAT inside a verse is still
                                                a violation with the chorus
                                                return declared, which is the
                                                exact failure of the song-wide
                                                `repeat_licence="refrain"`
  §6  collisions outside the returns SURVIVE
  §11 the READ PATH — the same question asked of the mandate's own
                                                coordinates: which of them
                                                does a real grading run
                                                actually reach, and which are
                                                declared and never set
  §12 `_rep` — WHICH member of an identity class the licence transports
                                                FROM. A MUTANT SURVIVED ALL
                                                TEN TEST FILES here
                                                (`quality/mutate.py` QS2,
                                                2026-08-13, 2210s of
                                                escalation, not one check
                                                failed), because every fixture
                                                this repo ships is SYMMETRIC
                                                about that choice. §12 is the
                                                asymmetric input, and it says
                                                why it is the asymmetric one
  §13 `OUT_OF_RANGE` — the message named a condition its guard does not
                                                test, so the one input that
                                                reaches the guard printed
                                                "declares 4 lines and 4 were
                                                given" and named nothing
  §14 `RefrainScheme.check_identity` — §13's TWIN, and the worse half. The
                                                same misnamed message, plus
                                                the generosity it hid: a draft
                                                SHORTER than the notation, on
                                                a form whose last line is not
                                                a refrain, tripped no index
                                                and returned `[]`. The
                                                obvious boundary — a villanelle
                                                one line short — cannot see
                                                it, because its last line IS a
                                                refrain and the index guard
                                                fires either way. §14 says
                                                which input discriminates and
                                                measures why
  §15 `Mandate.returns_check` — §14's twin BACK, and the last of the three.
                                                The same generosity in the same
                                                file: a mandate numbering more
                                                lines than the draft has,
                                                whose returns all land INSIDE
                                                the draft, tripped no index and
                                                returned `[]`. The obvious
                                                input — a short draft — cannot
                                                see it, because §13's own
                                                fixture trips OUT_OF_RANGE
                                                either way. §15 pins the
                                                discriminating input beside it,
                                                measures the same one-in-eight
                                                over the same registry, and
                                                PROVES the new finding cannot
                                                fire through
                                                `Reviser.inspect()`

`python3 quality/test_mandate_language.py`
"""

import dataclasses
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import quality.schemes as S                                      # noqa: E402

PASS, FAIL = [], []


def ok(name, cond, note=""):
    (PASS if cond else FAIL).append(name)
    print(f"  {'ok  ' if cond else 'FAIL'}  {name}" + (f"   {note}" if note
                                                       else ""))


def raises(fn, frag=""):
    try:
        fn()
    except S.NoMandate as e:
        return frag.lower() in str(e).lower()
    except Exception:
        return False
    return False


HERE = os.path.dirname(os.path.abspath(__file__))
EX = os.path.join(HERE, "fixtures")


def song(name):
    with open(os.path.join(EX, name)) as fh:
        return [l.rstrip() for l in fh.read().splitlines()
                if l.strip() and not l.strip().startswith("[")]


#: the letter mandate this repo already grades this song against
SONG_SCHEME = "XXXXXXXXXXXXABCBADCDXXXXXXXXXXXXEFGFEHGHX"
#: the same song, with the one thing a letter scheme cannot say
SONG_RETURN = "chorus:33-40<=13-20"

#: THE ASYMMETRIC DECLARATION, and §12's whole subject. The chorus's rhyme is
#: written ONCE, on the FIRST instance, and the return TRANSPORTS it to the
#: second — which is not a contrivance but the case
#: `Mandate.rhyme_partition_groups`'s own docstring exists for: "writing
#: `13-20` and `33-40<=13-20` does not leave L33..L40 unrhymed -- L33 IS L13,
#: so it is in L13's class". `SONG_SCHEME` above is the OTHER way to write the
#: same song, with both instances given their own letters, and that spelling
#: is SYMMETRIC about which member of a return class is canonical — which is
#: exactly why it cannot see a defect in the choice.
TRANSPORTED = [[13, 17], [14, 16], [15, 19], [18, 20]]


def _reading_from_last_member(fn):
    """Run `fn()` with `Mandate._rep` answering the LAST member of a return
    class instead of the first, and hand back its value.

    This is not a hypothetical: it is `quality/mutate.py`'s QS2 verbatim
    (`min(r.lines)` -> `max(r.lines)`), the mutation that survived `battery`,
    `test_fit`, `test_floor`, `test_grid`, `test_loop`, this file,
    `test_revise`, `test_song_function`, `test_taxonomy` and `test_verbs` on
    2026-08-13. Holding BOTH readings in one process is what lets a single run
    assert the two halves doctrine 94 asks for separately: that the check
    fires, and that it is the INPUT and not the check that makes it fire.
    """
    orig = S.Mandate._rep

    def last(self, line):
        r = self.return_of(line)
        return max(r.lines) if r is not None else line

    try:
        S.Mandate._rep = last
        return fn()
    finally:
        S.Mandate._rep = orig


def _requirements(m):
    """-> {(i, j): requirement name} over EVERY pair of a mandate."""
    return {(i, j): m.requirement(i, j).name
            for i in range(1, m.n_lines + 1)
            for j in range(i + 1, m.n_lines + 1)}


def _moved(m):
    """-> the pairs whose ANSWER differs between the two readings."""
    first = _requirements(m)
    last = _reading_from_last_member(lambda: _requirements(m))
    return sorted(p for p in first if first[p] != last[p])


# ---------------------------------------------------------------------------
# §1  UNKNOWN is a third value and it will not be spent as the second
# ---------------------------------------------------------------------------

def test_unknown():
    print("\n§1  UNKNOWN — doctrine 28 made mechanical, not conventional")
    ok("UNKNOWN is a singleton", S.UNKNOWN is S._Unknown())
    try:
        bool(S.UNKNOWN)
        fired = False
    except TypeError as e:
        fired = "doctrine 28" in str(e)
    ok("bool(UNKNOWN) RAISES and names the doctrine", fired,
       "-- `None` would have been read as False by `if x:`")
    ok("UNKNOWN is not False and not None",
       S.UNKNOWN is not False and S.UNKNOWN is not None
       and S.UNKNOWN != False)                                   # noqa: E712
    ok("repr is readable", repr(S.UNKNOWN) == "UNKNOWN")
    ok("decided() is the branch-free reader",
       S.LICENSE_REPEAT.decided("identity_required") == (False, None)
       and S.REQUIRE_RETURN.decided("identity_required") == (True, True))
    # the whole point: a consumer CANNOT collapse the five into a boolean
    ok("the requirement set is closed at five", len(S.REQUIREMENTS) == 5)
    ok("FREE and UNDECLARED are DIFFERENT VALUES",
       S.FREE is not S.UNDECLARED and S.FREE.declared and
       not S.UNDECLARED.declared,
       "-- 'nothing required' vs 'never asked' (doctrine 28)")


# ---------------------------------------------------------------------------
# §2  the three statements, and the per-PAIR inversion of doctrine 3
# ---------------------------------------------------------------------------

def test_three_statements():
    print("\n§2  three statements where the language had one")
    m = S.mandate(SONG_SCHEME, returns=SONG_RETURN)
    ok("statement 1 — these lines must RHYME",
       m.requirement(13, 17) is S.REQUIRE_RHYME)
    ok("statement 2 — this line must RETURN verbatim",
       m.requirement(13, 33) is S.REQUIRE_RETURN)
    ok("statement 3 — the return TRANSPORTS the rhyme obligation",
       m.requirement(17, 33) is S.REQUIRE_RHYME
       and m.requirement(13, 37) is S.REQUIRE_RHYME,
       "-- L33 IS L13, so L33 answers L17 and it is not a collision")
    ok("a pair the mandate declares unrhymed is FREE",
       m.requirement(1, 5) is S.FREE)

    print("\n    doctrine 3 inverts BY PAIR, which no song-wide switch can do")
    ok("REPEAT is the REQUIREMENT at a return pair",
       m.repeat_is_violation(13, 33) is False)
    ok("REPEAT is a VIOLATION at a rhyme pair in the same section",
       m.repeat_is_violation(13, 17) is True,
       "-- `repeat_licence='refrain'` would license this one too")
    ok("and it is a violation ACROSS the return as well",
       m.repeat_is_violation(13, 37) is True
       and m.repeat_is_violation(17, 33) is True,
       "-- L37 IS L17, so slow/go must still be a rhyme")
    ok("REPEAT at a free pair is UNKNOWN, not False",
       m.repeat_is_violation(1, 5) is S.UNKNOWN)


# ---------------------------------------------------------------------------
# §3  DOCTRINE 94 — the drift detector fires, on the real song
# ---------------------------------------------------------------------------

def test_drift_fires():
    print("\n§3  doctrine 94 — the zero can still fire, and does, 4x on the "
          "real text")
    lines = song("mandate_song.txt")
    m = S.mandate(SONG_SCHEME, returns=SONG_RETURN)
    found = m.returns_check(lines)
    pairs = sorted((i, j) for _, i, j, _, _ in found)
    ok("4 of the 8 declared returns are NOT verbatim and are caught",
       pairs == [(14, 34), (15, 35), (16, 36), (20, 40)],
       f"{pairs}")
    kinds = {(i, j): k for _, i, j, k, _ in found}
    ok("each drift is a NAMED KIND, not a boolean (doctrine 24)",
       all(k not in ("", None, True, False) for k in kinds.values()),
       f"{sorted(set(kinds.values()))}")
    ok("the four VERBATIM returns are silent",
       not ({(13, 33), (17, 37), (18, 38), (19, 39)} & set(pairs)))

    print("\n    and the detector is not merely present — break one and it "
          "counts one more")
    drifted = list(lines)
    drifted[32] = "We kept the ledger open every night"       # L33 was L13
    found2 = m.returns_check(drifted)
    ok("a refrain that drifts by one word is caught",
       (13, 33) in [(i, j) for _, i, j, _, _ in found2]
       and len(found2) == len(found) + 1,
       f"{len(found)} -> {len(found2)}")

    print("\n    the couplet fixture's refrain returns VERBATIM, and that "
          "is a measured pass and not an absent check")
    cl = song("mandate_couplets.txt")
    cm = S.mandate([[i, i + 1] for i in range(1, 28, 2)], n_lines=28,
                   returns="refrain:4,28")
    ok("L4/L28 return verbatim -> no finding", cm.returns_check(cl) == [])
    broken = list(cl)
    broken[27] = broken[27].replace("say it slow", "say it cold")
    ok("and the same check FIRES when L28 is altered",
       len(cm.returns_check(broken)) == 1,
       "-- the pass above is a measurement, not a silence")


# ---------------------------------------------------------------------------
# §4  a return whose RHYME breaks is still a rhyme finding
# ---------------------------------------------------------------------------

def test_rhyme_still_mandated():
    print("\n§4  declaring a return does not stop mandating the rhyme")
    m = S.mandate(SONG_SCHEME, returns=SONG_RETURN)
    exp = m.expanded_groups()
    ok("the four chorus classes span BOTH instances",
       sorted(tuple(g) for g in exp) ==
       [(13, 17, 33, 37), (14, 16, 34, 36), (15, 19, 35, 39),
        (18, 20, 38, 40)],
       f"{[list(g) for g in exp]}")
    ok("every cross pair is now MANDATED, so a broken one is a violation and "
       "not a collision",
       all(p in m.expanded_pairs() for p in
           [(13, 33), (13, 37), (17, 33), (17, 37)]))
    ok("declaring the return ADDS mandated pairs rather than removing them",
       len(m.expanded_pairs()) > len(m.pairs()),
       f"{len(m.pairs())} declared -> {len(m.expanded_pairs())} required")


# ---------------------------------------------------------------------------
# §5  THE LICENCE MUST NOT LEAK — the defect of the song-wide switch
# ---------------------------------------------------------------------------

def test_licence_does_not_leak():
    print("\n§5  the licence is PER PAIR, so it cannot leak into a verse")
    m = S.mandate(SONG_SCHEME, returns=SONG_RETURN)
    # a mandate that also declares a verse couplet, with the chorus return on
    lines_free = [(1, 5), (2, 10), (21, 25)]
    m2 = S.mandate([[13, 17], [14, 16], [15, 19], [18, 20], [1, 5]],
                   n_lines=41, returns=SONG_RETURN)
    ok("a verse pair mandated to rhyme keeps REPEAT as a VIOLATION while the "
       "chorus return is declared",
       m2.repeat_is_violation(1, 5) is True
       and m2.repeat_is_violation(13, 33) is False,
       "-- `repeat_licence='refrain'` licenses BOTH; this licenses one")
    ok("no pair outside a return class is ever licensed",
       not any(m.repeat_is_violation(i, j) is False
               for i, j in m.expanded_pairs()
               if (i, j) not in [p[:2] for p in m.return_pairs()]))
    ok("free verse pairs stay UNKNOWN rather than licensed",
       all(m.repeat_is_violation(i, j) is S.UNKNOWN for i, j in lines_free))


# ---------------------------------------------------------------------------
# §6  collisions outside the returns survive
# ---------------------------------------------------------------------------

def test_other_collisions_survive():
    print("\n§6  everything the song does elsewhere is still FREE and still "
          "reportable")
    m = S.mandate(SONG_SCHEME, returns=SONG_RETURN)
    # the ten non-chorus coincidences the letter mandate reported
    others = [(1, 5), (1, 7), (1, 26), (2, 28), (4, 29), (6, 27), (8, 15),
              (8, 25), (8, 35), (9, 21)]
    ok("all ten remain FREE — the return licensed nothing about them",
       all(m.requirement(i, j) is S.FREE for i, j in others),
       f"{len(others)} pairs")


# ---------------------------------------------------------------------------
# §7  REFUSALS — doctrine 20, and none of them degrade
# ---------------------------------------------------------------------------

def test_refusals():
    print("\n§7  refusals, and every one of them is loud")
    ok("a return whose two runs are different lengths REFUSES",
       raises(lambda: S.parse_returns("33-40<=13-19"), "correspondence"),
       "-- not a zip cut to the shorter run")
    ok("a return class of one line REFUSES",
       raises(lambda: S.parse_returns("13"), "at least two"))
    ok("a line that returns itself REFUSES",
       raises(lambda: S.parse_returns("13-20<=13-20"), "both sides"))
    ok("a return line outside the song REFUSES",
       raises(lambda: S.mandate("ABAB", returns="1,9"), "outside"))
    ok("two declarations that transitively merge and DISAGREE about verbatim "
       "REFUSE",
       raises(lambda: S.mandate(
           "ABABAB", n_lines=6,
           returns=[S.Return((1, 3), "a", True),
                    S.Return((3, 5), "b", False)]), "disagree"),
       "-- not a tie broken by declaration order (doctrine 66)")
    ok("no mandate at all still REFUSES", raises(lambda: S.mandate(None),
                                                 "refusal"))

    print("\n    and the letters refuse rather than degrade")
    m = S.mandate(SONG_SCHEME, returns=SONG_RETURN)
    ok("to_letters() REFUSES on a mandate that carries returns",
       raises(m.to_letters, "no letter string"),
       "-- a letter cannot say 'this line is that line come back'")
    ok("the lossy projection is still available, NAMED for its loss",
       isinstance(m.to_rhyme_letters(), str))
    ok("a return-free mandate is EXACTLY the old object",
       S.mandate("ABAB").to_letters() == "ABAB"
       and S.mandate("ABAB").returns == ()
       and S.mandate("ABAB").expanded_groups() ==
       S.mandate("ABAB").groups)

    print("\n    a return declared NON-verbatim has no A-1 mark, so the "
          "notation refuses")
    soft = S.mandate("ABAB", returns="1,3",
                     rule=S.ReturnRule(return_verbatim="rhyme"))
    ok("to_notation() REFUSES a return it cannot mark",
       raises(soft.to_notation, "only mark"))
    ok("and its identity requirement is FALSE, not UNKNOWN, because it was "
       "DECLARED false",
       soft.returns[0].verbatim is False
       and soft.requirement(1, 3) is S.LICENSE_REPEAT)
    unk = S.mandate("ABAB", returns="1,3",
                    rule=S.ReturnRule(return_verbatim="unknown"))
    ok("an UNDECLARED verbatim requirement propagates as UNKNOWN",
       unk.returns[0].verbatim is S.UNKNOWN
       and unk.requirement(1, 3).identity_required is S.UNKNOWN
       and unk.undeclared_returns() == [(1, 3, "R1")])
    ok("and returns_check() stays SILENT about it rather than passing it",
       unk.returns_check(["a", "b", "c", "d"]) == [])


# ---------------------------------------------------------------------------
# §8  SCOPE — 'never asked' is not 'nothing required'
# ---------------------------------------------------------------------------

def test_scope():
    print("\n§8  scope — the other half of doctrine 28")
    m = S.mandate([[13, 17], [14, 16], [15, 19], [18, 20]], n_lines=41,
                  returns=SONG_RETURN,
                  scope=list(range(13, 21)) + list(range(33, 41)))
    ok("a verse pair is UNDECLARED, not FREE",
       m.requirement(1, 5) is S.UNDECLARED)
    ok("UNDECLARED reports every field as UNKNOWN",
       m.requirement(1, 5).rhyme_required is S.UNKNOWN
       and not m.requirement(1, 5).declared)
    ok("the chorus is unaffected",
       m.requirement(13, 33) is S.REQUIRE_RETURN
       and m.requirement(13, 17) is S.REQUIRE_RHYME)
    ok("with no scope the same pair is FREE",
       S.mandate([[13, 17]], n_lines=41).requirement(1, 5) is S.FREE,
       "-- and those are DIFFERENT ANSWERS to a question a boolean could "
       "not tell apart")
    ok("a scope line outside the song REFUSES",
       raises(lambda: S.mandate("ABAB", scope=[9]), "outside"))


# ---------------------------------------------------------------------------
# §9  THE A-1 NOTATION REACHES THE LOOP AT LAST
# ---------------------------------------------------------------------------

def test_a1_reaches_the_loop():
    print("\n§9  the A-1 notation shipped and could not reach brief/verify")
    v = S.mandate("A1bA2abA1abA2abA1abA2abA1A2")
    ok("a notation string now carries its identity half",
       len(v.returns) == 2 and len(v.return_pairs()) == 12,
       "-- `parse()` returned the rhyme partition and dropped the rest")
    ok("the 12 pairs are the villanelle's own refrains",
       sorted(tuple(r.lines) for r in v.returns) ==
       [(1, 6, 12, 18), (3, 9, 15, 19)])
    ok("REPEAT is the REQUIREMENT at all 12 and a VIOLATION elsewhere in "
       "class a",
       all(v.repeat_is_violation(i, j) is False
           for i, j, _ in v.return_pairs())
       and v.repeat_is_violation(1, 4) is True)
    ok("the notation round-trips through the mandate",
       v.to_notation() == "A1bA2abA1abA2abA1abA2abA1A2")
    ok("the rhyme projection is unchanged from what parse() always gave",
       v.to_rhyme_letters() and S.parse(v.to_rhyme_letters()) ==
       S.parse("A1bA2abA1abA2abA1abA2abA1A2"))

    print("\n    the OLD reading stays reachable so the defect is "
          "demonstrable (doctrine 84's shape)")
    old = S.mandate("A1bA2abA1abA2abA1abA2abA1A2", carry_returns=False)
    ok("carry_returns=False drops the identity half, as `parse()` did",
       old.returns == () and old.to_letters() is not None)
    ok("and it is NOT the default", S.mandate("AbAb").returns != ())

    print("\n    RefrainScheme.to_mandate is the bridge, and it round-trips")
    rs = S.parse_refrain("A1bA2abA1abA2abA1abA2abA1A2")
    ok("to_mandate() agrees with the string path",
       rs.to_mandate().to_notation() == v.to_notation())
    ok("a capital used ONCE is not a return", S.mandate("Abab").returns == ()
       and "appear once" in S.mandate("Abab").origin)


# ---------------------------------------------------------------------------
# §10  the song, written out, and the number it moves
# ---------------------------------------------------------------------------

def test_the_song():
    print("\n§10  the declared mandate, in the language")
    m = S.mandate(SONG_SCHEME, returns=SONG_RETURN)
    ok("41 lines, 8 rhyme groups declared, 8 return classes",
       m.n_lines == 41 and len(m.groups) == 8 and len(m.returns) == 8)
    declared = {(i, j) for i, j, _ in m.pairs()}
    gained = sorted(set(m.expanded_pairs()) - declared)
    ok("16 cross pairs go from UNMANDATED to MANDATED",
       len(gained) == 16,
       "-- exactly the 16 findings the letter scheme produced")
    ok("8 of the 16 are the return correspondences themselves, and every one "
       "has REPEAT licensed",
       sum(1 for i, j, _ in m.return_pairs()
           if m.repeat_is_violation(i, j) is False) == 8)
    ok("the other 8 are transported, and REPEAT stays a VIOLATION at each",
       sum(1 for i, j in gained if m.repeat_is_violation(i, j) is True) == 8,
       "-- L13/L37 is slow/go and must still be a rhyme, not a repeat")

    print("\n    the couplet fixture: the refrain costs it its letter scheme")
    cm = S.mandate([[i, i + 1] for i in range(1, 28, 2)], n_lines=28,
                   returns="refrain:4,28")
    ok("the COUPLET declaration is a partition", cm.is_partition())
    ok("declaring the return makes it a COVER (doctrine 2)",
       cm.expanded_overlapping_lines() == [4, 28]
       and cm.to_rhyme_letters() is None,
       "-- L4 must answer L3 and L27, because L28 IS L4")


# ---------------------------------------------------------------------------
# §11  THE READ PATH — the two coordinates an audit called declared-but-unread
#
# A `Mandate` coordinate can be broken in two completely different ways and an
# import-level audit cannot tell them apart: NOBODY CALLS THE READER, or the
# reader is called on every pair and the FIELD IT READS is never set. Both of
# this module's flagged coordinates turned out to be the second kind, and each
# needs a different remedy, so the suite pins the mechanism rather than the
# verdict (doctrine 48: a principle that lives only in prose gets followed
# exactly as often as someone remembers it).
# ---------------------------------------------------------------------------

def test_read_path():
    print("\n§11  the read path — what actually reaches these coordinates")

    m = S.mandate(SONG_SCHEME, returns=SONG_RETURN)
    seen = []
    orig = S.Mandate.in_scope
    try:
        S.Mandate.in_scope = lambda self, line: (seen.append(line)
                                                 or orig(self, line))
        m.requirement(13, 33)
    finally:
        S.Mandate.in_scope = orig
    ok("requirement() READS in_scope, once per line, BEFORE anything else",
       seen == [13, 33],
       f"{seen} -- so `in_scope` is not unread: `quality/revise.py`'s "
       f"`grade()` and `inspect()` both call `requirement()` per pair")
    ok("and UNDECLARED is reachable through NOTHING ELSE — scope is its only "
       "source",
       S.mandate("ABAB").requirement(1, 2) is not S.UNDECLARED
       and S.mandate("ABAB").scope == (),
       "-- which is why a mandate with no scope can never return it, and "
       "every production mandate has no scope")

    print("\n    a scope that leaves out a line the mandate's OWN groups name "
          "is a contradiction, and it used to be built silently")
    ok("a scope excluding a MANDATED line REFUSES",
       raises(lambda: S.mandate([[1, 3], [2, 4]], n_lines=4, scope=[1, 2]),
              "outside its declared scope"),
       "-- pairs() mandated L1/L3 while requirement(1,3) called it "
       "UNDECLARED, and grade() reads BOTH")
    ok("a scope excluding a RETURNED line REFUSES too",
       raises(lambda: S.mandate("ABAB", returns="1,3", scope=[1, 2, 4]),
              "outside its declared scope"))
    ok("re-opening a mandate to ADD a scope is checked the same way",
       raises(lambda: S.mandate(S.mandate("ABAB"), scope=[1, 2]),
              "outside its declared scope"),
       "-- that path took `scope` on trust, not even the 1..n bound")
    ok("and the honest scope — one that covers every line the mandate names "
       "— is unaffected",
       S.mandate([[1, 3], [2, 4]], n_lines=4, scope=[1, 2, 3, 4]).scope
       == (1, 2, 3, 4)
       and len(S.mandate([[13, 17], [14, 16], [15, 19], [18, 20]],
                         n_lines=41, returns=SONG_RETURN,
                         scope=list(range(13, 21)) + list(range(33, 41)))
               .scope) == 16)

    print("\n    repeat_is_violation — the METHOD is documented, the FIELD is "
          "what the grader reads, and nothing pinned them together")
    v = S.mandate(S.REFRAIN_FORMS["villanelle"])
    allpairs = [(i, j) for i in range(1, v.n_lines + 1)
                for j in range(i + 1, v.n_lines + 1)]
    ok("Mandate.repeat_is_violation(i,j) IS requirement(i,j)."
       "repeat_is_violation at every pair of a real villanelle",
       all(v.repeat_is_violation(i, j)
           is v.requirement(i, j).repeat_is_violation for i, j in allpairs),
       f"{len(allpairs)} pairs -- `quality/revise.py` calls "
       f"`requirement(i, j).decided('repeat_is_violation')` and never the "
       f"method, so changing the method alone would leave §2/§9 green and "
       f"change nothing about a real grading run")
    plain = S.mandate("AABB")
    ok("and at every pair of a plain letter scheme with no returns",
       all(plain.repeat_is_violation(i, j)
           is plain.requirement(i, j).repeat_is_violation
           for i in range(1, 5) for j in range(i + 1, 5)))

    print("\n    the exact (is_declared, value) tuple `grade()` consumes")
    ok("REQUIRE_RETURN -> (True, False): the refrain is REQUIRED to repeat, "
       "at all 12 villanelle return pairs",
       len(v.return_pairs()) == 12
       and all(v.requirement(i, j).decided("repeat_is_violation")
               == (True, False) for i, j, _ in v.return_pairs()),
       "-- grade() skips these, which is why a correct villanelle scores 0 "
       "violations")
    ok("REQUIRE_RHYME -> (True, True): an ordinary repeat in the same rhyme "
       "class is still charged",
       v.requirement(1, 4).decided("repeat_is_violation") == (True, True),
       "-- L1 and L4 are both class 'a' and are NOT the same line")
    ok("FREE and UNDECLARED -> (False, None): these two, and only these two, "
       "fall through to the song-wide repeat_licence switch",
       S.FREE.decided("repeat_is_violation") == (False, None)
       and S.UNDECLARED.decided("repeat_is_violation") == (False, None)
       and plain.requirement(1, 3).decided("repeat_is_violation")
       == (False, None))

    print("\n    FINDING — the fallback is NOT what its own comment says, and "
          "the difference is measurable here")
    ok("a plain letter scheme is NOT 'UNDECLARED for this question on every "
       "pair': its MANDATED pairs are declared REQUIRE_RHYME",
       plain.returns == ()
       and plain.requirement(1, 2) is S.REQUIRE_RHYME
       and plain.requirement(1, 2).decided("repeat_is_violation")
       == (True, True),
       "-- `quality/revise.py` grade() L480-483 claims otherwise. Because "
       "`declared` is True there, `is_violation if declared else not "
       "default_licensed` never reads the switch, so repeat_licence="
       "'refrain' is INERT on every letter scheme and Cover-without-returns. "
       "Only the DEFAULT 'unlicensed' reproduces the pre-fix behaviour")
    ok("a letter scheme cannot state the question at all, which is why "
       "REQUIRE_RHYME's True is this module's DEFAULT and not the writer's "
       "declaration",
       S.REQUIRE_RHYME.repeat_is_violation is True
       and "doctrine 3" in S.REQUIRE_RHYME.gloss,
       "-- doctrine 3 inverts BY CONTEXT and a letter has two states for a "
       "question with five answers; the fix belongs at the call site, not "
       "in this value")


# ---------------------------------------------------------------------------
# §12  `_rep` — WHICH member of an identity class the licence transports FROM
#
# THE DEFECT THIS SECTION EXISTS FOR. `Mandate._rep` answers the FIRST line of
# a return class — "identity's canonical member", its own docstring — and
# `requirement()`'s licence-transport rule asks its question OF THE
# REPRESENTATIVES. Read the LAST member instead and the mandate's shape does
# not move by one element: `groups`, `expanded_groups`, `pairs`,
# `expanded_pairs`, `return_pairs`, `identity_pairs`, `to_rhyme_letters`,
# `rhyme_partition_groups`, `expanded_overlapping_lines` and `returns_check`
# are all IDENTICAL under both readings (pinned below). The single thing that
# moves is the VALUE `requirement(i, j)` answers at a transported pair — which
# is the value `quality/revise.py`'s `grade()` consumes as
# `.decided("repeat_is_violation")`, so an identical end word goes from CHARGED
# to LICENSED with nothing else in the object changing to say so.
#
# WHY TEN TEST FILES COULD NOT SEE IT. Every return fixture this repo ships is
# SYMMETRIC about the choice: `SONG_SCHEME` gives BOTH chorus instances their
# own letters, and a villanelle's refrains sit inside one big class 'a' that
# holds every member of every return. Where both ends of a return class are
# already in a declared group, first and last name different lines and reach
# the SAME answer, so the mutated line executes and changes nothing — the trap
# that also catches a test written at a class of ONE, where first IS last.
# The discriminating input is a return class whose members do NOT both carry a
# declared group: the writer states the chorus's rhyme ONCE and lets the return
# carry it, which is the idiom `rhyme_partition_groups` was written for.
# ---------------------------------------------------------------------------

def test_rep_is_the_first_member():
    print("\n§12  _rep — which member of an identity class the licence "
          "transports FROM")
    m = S.mandate(TRANSPORTED, n_lines=41, returns=SONG_RETURN)
    ok("a returned line's representative is the FIRST member of its class",
       (m._rep(33), m._rep(37), m._rep(13)) == (13, 17, 13),
       "-- L33 IS L13, so every question about L33 is a question about L13")

    print("\n    THE ANSWER THAT MOVES, on the chorus whose rhyme is declared "
          "ONCE and TRANSPORTED (doctrine 3: REPEAT inverts by context)")
    ok("L17/L33 is REQUIRE_RHYME — L33 IS L13, L13/L17 must rhyme, so an "
       "identical end word at L17/L33 is a VIOLATION",
       m.requirement(17, 33) is S.REQUIRE_RHYME
       and m.requirement(17, 33).decided("repeat_is_violation")
       == (True, True),
       "-- the exact tuple grade() consumes")
    ok("and read from the LAST member the SAME pair answers something ELSE, "
       "so this input DISCRIMINATES",
       _reading_from_last_member(lambda: m.requirement(17, 33))
       is S.LICENSE_REPEAT
       and m.requirement(17, 33)
       is not _reading_from_last_member(lambda: m.requirement(17, 33)),
       "-- L17 would represent as L37 and L33 as L33, no declared group holds "
       "that pair, and the violation is LICENSED AWAY in silence")
    ok("the returned chorus's OWN internal rhyme moves the same way",
       m.requirement(33, 37) is S.REQUIRE_RHYME
       and _reading_from_last_member(lambda: m.requirement(33, 37))
       is S.LICENSE_REPEAT,
       "-- L33/L37 IS L13/L17 and nothing else in the mandate says so")
    moved = _moved(m)
    ok("12 of this mandate's 820 pairs answer differently under the two "
       "readings, and all 12 touch the transported chorus",
       len(moved) == 12
       and all(i >= 13 and j >= 33 for i, j in moved),
       f"{moved}")

    print("\n    BOTH DIRECTIONS IN ONE OBJECT — the mutation is not a "
          "uniform loosening, it EXCHANGES two answers (8 lines, one return "
          "class {2, 6}, one declared group on each side of it)")
    w = S.mandate([[1, 2], [6, 8]], n_lines=8, returns="r:2,6")
    ok("L1/L6 — the first-member reading DECIDES it and the last-member "
       "reading loses the decision",
       w.requirement(1, 6) is S.REQUIRE_RHYME
       and w.requirement(1, 6).decided("repeat_is_violation") == (True, True)
       and _reading_from_last_member(lambda: w.requirement(1, 6))
       is S.LICENSE_REPEAT,
       "-- L6 IS L2 and L1/L2 is a declared group, so a repeat is charged")
    ok("L2/L8 — and at the OTHER pair of the same object it MANUFACTURES a "
       "decision the mandate declined to make",
       w.requirement(2, 8) is S.LICENSE_REPEAT
       and w.requirement(2, 8).decided("repeat_is_violation") == (True, False)
       and _reading_from_last_member(lambda: w.requirement(2, 8))
       is S.REQUIRE_RHYME,
       "-- so a suite that only counted findings could see a wash")
    ok("exactly those two pairs move, in opposite directions",
       _moved(w) == [(1, 6), (2, 8)], f"{_moved(w)}")

    print("\n    WHY THE SHIPPED FIXTURES ARE BLIND — doctrine 94's "
          "companion, and why this section is written on neither of them")
    both = S.mandate(SONG_SCHEME, returns=SONG_RETURN)
    ok("SONG_SCHEME letters BOTH chorus instances, so the two readings agree "
       "at every one of its 820 pairs",
       _moved(both) == [] and len(_requirements(both)) == 820,
       "-- L17 represents as L17 or L37 and BOTH are in a declared group with "
       "L33's representative, so the mutated line runs and changes nothing")
    v = S.mandate(S.REFRAIN_FORMS["villanelle"])
    ok("and a real villanelle agrees at every one of its 171 pairs",
       _moved(v) == [] and len(_requirements(v)) == 171,
       "-- both refrain classes sit wholly inside class 'a'")
    ok("a return class of ONE cannot discriminate either, and the language "
       "refuses to declare one at all",
       raises(lambda: S.parse_returns("13"), "at least two"),
       "-- first IS last there; a test written at that shape would pass "
       "against both readings and prove nothing")

    print("\n    AND NOTHING ELSE IN THE OBJECT MOVES, which is why the "
          "shape assertions in §4/§10 could not have caught it either")
    def shape(x):
        return (x.groups, x.expanded_groups(), x.pairs(), x.expanded_pairs(),
                [(i, j) for i, j, _ in x.return_pairs()], x.identity_pairs(),
                x.to_rhyme_letters(), x.rhyme_partition_groups(),
                x.expanded_overlapping_lines(),
                x.returns_check(["x"] * x.n_lines))
    ok("ten observables of the transported mandate are IDENTICAL under both "
       "readings; only requirement()'s answer moves",
       shape(m) == _reading_from_last_member(lambda: shape(m)),
       "-- groups, expanded_groups, pairs, expanded_pairs, return_pairs, "
       "identity_pairs, to_rhyme_letters, rhyme_partition_groups, "
       "expanded_overlapping_lines, returns_check")


def _msg(findings, kind):
    """-> the first message of `kind`, or "" when the kind is absent.

    NEVER indexes. A suite whose job is to kill a mutant that DELETES a
    finding must not itself die on the empty list that mutant produces: an
    IndexError aborts the run, skips every later check, and prints no
    pass/fail count at all, which is a worse report than the failure.

    It is also what keeps §13 and §15 from reading each other's rows: one call
    can now return a `LINE_COUNT` and an `OUT_OF_RANGE` at once, and a `[0]`
    would assert about whichever happened to sort first.
    """
    return next((f[4] for f in findings if f[3] == kind), "")


# ---------------------------------------------------------------------------
# §13  OUT_OF_RANGE — a message that named a condition its guard does not test
#
# The guard tests a return LINE INDEX against `len(lines)`. Its message said
# "the mandate declares N lines and M were given" — a LENGTH MISMATCH, which
# `Reviser.mandate` (`SC.mandate(spec, n_lines=len(lines))`) refuses with
# `NoMandate` several frames earlier, so `Reviser.inspect()` cannot reach this
# branch by that route at all. On the input that DOES reach it the message
# printed "the mandate declares 4 lines and 4 were given" — two numbers that
# agree, naming nothing, about a finding whose whole content is WHICH INDEX is
# out of range. Doctrine 20: a check that did not run is not a check that
# passed, and the message has to say the requirement was NOT CHECKED.
# ---------------------------------------------------------------------------

def test_out_of_range_names_its_own_condition():
    print("\n§13  OUT_OF_RANGE — the message names the condition the guard "
          "actually tests")
    base = S.mandate([[1, 3], [2, 4]], n_lines=4)
    hand = dataclasses.replace(
        base, returns=(S.Return(lines=(1, 9), label="R1", verbatim=True),))
    got = hand.returns_check(["a", "b", "c", "d"])
    ok("the hand-built mandate — the ONLY input that reaches this guard from "
       "inspect() — produces exactly one finding",
       len(got) == 1 and got[0][:4] == ("R1", 1, 9, "OUT_OF_RANGE"),
       "-- shape unchanged: quality/revise.py branches on the KIND string")
    msg = got[0][4]
    ok("the message NAMES THE OFFENDING LINE rather than two line counts",
       "L9" in msg and "4 lines and 4 were given" not in msg, msg[:64])
    ok("it says the mandate's OWN range is what L9 is outside of, so the "
       "repair is to the MANDATE and not to the draft (doctrine 79)",
       "1..4" in msg and "built around the constructor" in msg)
    ok("and it says the requirement was NOT CHECKED — unasked is not "
       "answered clean (doctrine 20)",
       "NOT CHECKED" in msg and "L1/L9" in msg)

    print("\n    the OTHER reachable route names the OTHER layer — a short "
          "draft is a different repair from a mandate built around the "
          "constructor, and one message for both named neither")
    short = S.mandate("ABAB", returns="1,3")
    # READS BY KIND, NEVER BY POSITION. This same call is §15's OBVIOUS input
    # and now returns TWO findings — a `LINE_COUNT` for the 4-vs-2 disagreement
    # and this `OUT_OF_RANGE` — so `[0]` would have silently started asserting
    # about the wrong one. It is also exactly why this input cannot
    # discriminate §15's defect: it fires under both readings. See §15.
    smsg = _msg(short.returns_check(["a", "b"]), "OUT_OF_RANGE")
    ok("a well-formed mandate given a SHORT draft says the DRAFT is short",
       "the DRAFT is short" in smsg and "L3" in smsg
       and "inside the mandate's own 1..4" in smsg, smsg[:72])
    ok("and it too says NOT CHECKED rather than falling silent",
       "NOT CHECKED" in smsg)
    ok("the two messages are DIFFERENT TEXT for the two conditions",
       msg != smsg,
       "-- 'the mandate declares 4 lines and M were given' was one message "
       "for both, and the arithmetic was the only thing that varied")

    print("\n    and the guard has not started swallowing the returns it is "
          "supposed to grade")
    inr = dataclasses.replace(
        base, returns=(S.Return(lines=(1, 3), label="R1", verbatim=True),))
    ok("an IN-RANGE return that came back VERBATIM emits nothing",
       inr.returns_check(["same", "b", "same", "d"]) == [])
    drift = inr.returns_check(["same", "b", "other", "d"])
    ok("an IN-RANGE return that DRIFTED takes the other branch and is a "
       "NAMED KIND, not OUT_OF_RANGE",
       len(drift) == 1 and drift[0][3] != "OUT_OF_RANGE"
       and "VERBATIM" in drift[0][4], f"{drift[0][3]}")
    ok("the constructor still refuses the out-of-range return outright, so "
       "this guard stays the LAST line of defence and not the first",
       raises(lambda: S.mandate([[1, 3], [2, 4]], n_lines=4,
                                returns=[[1, 9]]), "outside"))


def _last_refrain_line(sch):
    """-> the highest line number any refrain mark in `sch` names."""
    return max((max(t) for t in sch.refrains.values()), default=0)


def test_check_identity_needs_the_whole_draft():
    print("\n§14  check_identity — §13's twin, and this one was GENEROUS as "
          "well as misnamed")

    print("\n    THE OBVIOUS INPUT DOES NOT DISCRIMINATE, and that is a "
          "measurement, not a caution")
    vil = S.refrain_form("villanelle")
    ok("the villanelle's LAST LINE IS A REFRAIN, so a short draft always "
       "trips the index guard on its own",
       _last_refrain_line(vil) == vil.n_lines == 19)
    stub = [f"l{k}" for k in range(1, 19)]              # 18 of 19
    ok("so a one-line-short villanelle reports findings under EITHER "
       "reading — a test written here cannot see the generosity",
       vil.check_identity(stub) != [],
       "-- the obvious boundary value, and it proves nothing")

    print("\n    THE DISCRIMINATING INPUT IS THE FORM WHOSE LAST LINE IS NOT "
          "A REFRAIN, and the registry says there is exactly ONE")
    open_ended = sorted(k for k in S.REFRAIN_FORMS
                        if _last_refrain_line(S.refrain_form(k))
                        < S.refrain_form(k).n_lines)
    ok("of the 8 shipped REFRAIN_FORMS, exactly one does not close on a "
       "refrain: `pantoum quatrain pair`",
       open_ended == ["pantoum quatrain pair"] and len(S.REFRAIN_FORMS) == 8,
       f"{open_ended} -- measured over the registry, not hand-picked. The "
       f"other seven end on a refrain, which is WHY nothing found this: on "
       f"7 of 8 named forms the index guard covers for the missing check")
    pan = S.refrain_form("pantoum quatrain pair")
    ok("`pantoum quatrain pair` numbers 8 lines and its last refrain line "
       "is 7",
       (_last_refrain_line(pan), pan.n_lines) == (7, 8),
       "-- a shipped form, not a constructed fixture")

    full = ["a rhyme", "the burden comes first", "a second rhyme",
            "the burden comes last", "the burden comes first", "c rhyme",
            "the burden comes last", "c again"]
    ok("the whole 8-line draft, refrains holding, still reports NOTHING",
       pan.check_identity(full) == [],
       "-- the fix did not buy its reach with noise on the clean case")

    short = full[:7]                    # L8 dropped: 7 lines against 8
    got = pan.check_identity(short)
    ok("A DRAFT SHORT OF THE NOTATION IS NOT A CLEAN PASS — this returned [] "
       "until 2026-08-13, and it is the whole defect",
       got != [],
       "-- doctrine 94: no positive case can reach this, because every "
       "positive case hands over a draft of the right length")
    ok("and it is NOT the index guard that catches it: every refrain line "
       "still lands inside the short draft",
       all(f[3] != "OUT_OF_RANGE" for f in got)
       and all(i <= len(short) and j <= len(short)
               for i, j, _ in pan.repeat_pairs()),
       "-- which is exactly why the index guard could not see it")
    kinds = [f[3] for f in got]
    ok("the finding is LINE_COUNT and there is exactly one of it",
       kinds.count("LINE_COUNT") == 1 and len(got) == 1, f"{kinds}")
    lmsg = _msg(got, "LINE_COUNT")
    ok("its message NAMES THE MISSING LINE — here the two counts are the "
       "condition being tested, so unlike §13 they belong",
       "L8 was never given" in lmsg and "8 lines and 7 were given" in lmsg,
       lmsg[:72])
    ok("and it says how many requirements were graded on the positional "
       "assumption ANYWAY, so the reader is not left to infer it "
       "(doctrine 20/79)",
       "2 graded" in lmsg and "0 naming a line past the draft" in lmsg
       and "NOT CHECKED" in lmsg)

    print("\n    AND THE OTHER DIRECTION, which no index guard can EVER "
          "reach: a draft LONGER than the notation numbers")
    over = pan.check_identity(full + ["a ninth line nobody declared"])
    omsg = _msg(over, "LINE_COUNT")
    ok("9 lines against an 8-line notation is reported, though every index "
       "is in range and every refrain is verbatim",
       len(over) == 1 and "L9" in omsg
       and "past the notation's last line" in omsg,
       "-- a title line shifts every line number and the answers stay silent")

    print("\n    a scheme with NO refrains still reports the mismatch, and "
          "that is deliberate — gating LINE_COUNT on 'has repeat pairs' "
          "would put the silence back for every rhyme-only notation")
    rhyme_only = S.parse_refrain("abab")
    ok("`abab` — 0 refrains, 4 lines — given 3 lines still says so, and its "
       "three counts are honestly 0 of 0",
       _msg(rhyme_only.check_identity(["a", "b", "c"]), "LINE_COUNT")
       .count("0") >= 3
       and rhyme_only.check_identity(["a", "b", "c"]) != [],
       "-- this method is the only one that compares a NOTATION's length "
       "against a DRAFT's, so it is the only place the mismatch can surface")
    ok("and the same notation at its declared length is silent",
       rhyme_only.check_identity(["a", "b", "c", "d"]) == [])

    print("\n    the MESSAGE half — §13's defect, in §13's twin")
    hand = S.RefrainScheme(n_lines=4, code=S.parse("ABAB"),
                           marks=("A", "b", "A", "b"), refrains={"A": (1, 9)})
    hgot = hand.check_identity(["one", "two", "one", "four"])
    hmsg = _msg(hgot, "OUT_OF_RANGE")
    ok("a scheme naming a refrain past its OWN n_lines used to print "
       "'declares 4 lines and 4 were given' — two numbers that agree",
       "4 lines and 4 were given" not in hmsg and "L9" in hmsg, hmsg[:64])
    ok("it charges the SCHEME, and names parse_refrain as the constructor "
       "that cannot produce it (doctrine 79)",
       "1..4" in hmsg and "parse_refrain" in hmsg and "NOT CHECKED" in hmsg)
    smsg = _msg(vil.check_identity(stub), "OUT_OF_RANGE")
    ok("a well-formed notation given a SHORT draft charges the DRAFT "
       "instead, in DIFFERENT TEXT",
       "the DRAFT is short" in smsg and "L19" in smsg
       and "inside the notation's own 1..19" in smsg and smsg != hmsg,
       smsg[:72])

    print("\n    and the guard has not started swallowing what it grades")
    good = ["Do not go gentle into that good night", "b", "Rage, rage",
            "d", "e", "Do not go gentle into that good night",
            "g", "h", "Rage, rage", "j", "k",
            "Do not go gentle into that good night", "m", "n", "Rage, rage",
            "p", "q", "Do not go gentle into that good night", "Rage, rage"]
    ok("a full 19-line villanelle whose refrains hold still reports NOTHING",
       vil.check_identity(good) == [])
    drift = list(good)
    drift[11] = "Do not go gently into that good night"
    dgot = vil.check_identity(drift)
    ok("and the drifted refrain is still caught as a NAMED KIND, with no "
       "LINE_COUNT row on a draft of the declared length",
       len(dgot) == 3 and {d[3] for d in dgot} == {"LEXICAL_VARIATION"},
       f"{ {d[3] for d in dgot} }")


# ---------------------------------------------------------------------------
# §15  `Mandate.returns_check` — §14's twin back, and the last of the three
#
# §13 fixed the MESSAGE half of this method and left the GENEROUS half, naming
# it. §14 found the identical pair on `RefrainScheme.check_identity` and closed
# both there. This closes the one that was named: a mandate that numbers more
# lines than the draft has, whose returns all land INSIDE the draft, tripped no
# index guard and reported nothing at all.
#
# THE FINDING CANNOT FIRE THROUGH `Reviser.inspect()`, and the proof is below
# rather than asserted: `inspect()` calls `m.returns_check(lines)` on
# `m = self.mandate(lines, mandate)` = `SC.mandate(spec, n_lines=len(lines))`,
# and every branch of `SC.mandate` given a non-None `n_lines` either returns an
# object whose `n_lines` IS that argument or raises `NoMandate`. So the length
# disagreement is dead on that path — which is exactly why closing it here is
# safe while `quality/revise.py` has no branch for the new kind.
# ---------------------------------------------------------------------------

def _returns_satisfied(m, n):
    """-> `n` lines in which every declared return class comes back VERBATIM.

    The clean draft at ANY length. A stub like `['l1', 'l2', ...]` breaks the
    returns as well as the count, so its findings prove nothing about which
    guard fired — the whole point of §15 is a draft on which the ONLY thing
    wrong is the number of lines.
    """
    text = [f"line {k} carries its own words" for k in range(1, n + 1)]
    for r in m.returns:
        for i in r.lines:
            if i <= n:
                text[i - 1] = f"the burden {r.label} comes back"
    return text


def test_returns_check_needs_the_whole_draft():
    print("\n§15  returns_check — §13's other half, and §14's twin back")

    print("\n    THE OBVIOUS INPUT DOES NOT DISCRIMINATE, and §13 already "
          "owns it: 'a short draft' is the phrase, and the short draft this "
          "repo already had in a test trips the index guard by itself")
    obvious = S.mandate("ABAB", returns="1,3")
    ok("§13's own short-draft fixture names L3, which is PAST a 2-line draft, "
       "so OUT_OF_RANGE fires under EITHER reading",
       "OUT_OF_RANGE" in [f[3] for f in obvious.returns_check(["a", "b"])]
       and max(j for _, j, _ in obvious.return_pairs()) > 2,
       "-- the obvious boundary value, and it proves nothing about the "
       "length check")

    print("\n    THE DISCRIMINATING INPUT IS THE ONE WHOSE RETURNS ALL LAND "
          "INSIDE THE SHORT DRAFT — the input the §14 lot supplied by name")
    named = S.mandate([[1, 3]], n_lines=6, returns=[[1, 3]])
    got = named.returns_check(["x", "b", "x"])
    ok("6 lines declared, 3 given, L1/L3 verbatim — A MANDATE AND A DRAFT "
       "THAT DISAGREE IS NOT A CLEAN PASS; this returned [] until 2026-08-13",
       got != [],
       "-- doctrine 94: no positive case can reach it, because every positive "
       "case hands over a draft of the right length")
    ok("and it is NOT the index guard that catches it: every return line "
       "still lands inside the 3-line draft",
       all(f[3] != "OUT_OF_RANGE" for f in got)
       and all(i <= 3 and j <= 3 for i, j, _ in named.return_pairs()),
       "-- which is exactly why the index guard could not see it")
    kinds = [f[3] for f in got]
    ok("the finding is LINE_COUNT and there is exactly one of it",
       kinds.count("LINE_COUNT") == 1 and len(got) == 1, f"{kinds}")

    print("\n    AND THE SAME ONE-IN-EIGHT, ON THE SAME SHIPPED REGISTRY §14 "
          "MEASURED — because it is the same defect on the twin surface")
    still_blind = sorted(k for k in S.REFRAIN_FORMS
                         if not S.refrain_form(k).to_mandate().returns_check(
                             _returns_satisfied(S.refrain_form(k).to_mandate(),
                                                S.refrain_form(k).n_lines - 1),
                             variation=False))
    ok("all 8 shipped REFRAIN_FORMS, put through `to_mandate()` and handed a "
       "one-line-short draft whose returns HOLD, now report the "
       "disagreement — NONE is silent",
       still_blind == [] and len(S.REFRAIN_FORMS) == 8,
       f"{still_blind} -- and `pantoum quatrain pair` was the only one of the "
       f"eight that was silent BEFORE, which the next line measures as a "
       f"property rather than re-asserting from memory")
    open_ended = sorted(k for k in S.REFRAIN_FORMS
                        if max((max(t) for t in
                                S.refrain_form(k).refrains.values()),
                               default=0) < S.refrain_form(k).n_lines)
    ok("and the PROPERTY that made it the discriminating one — a last line "
       "that is not a returning line, so no return index falls past a "
       "one-short draft — holds of exactly that form",
       open_ended == ["pantoum quatrain pair"],
       f"{open_ended} -- measured over the registry, not hand-picked. The "
       f"other seven close ON a return, so their index guard fires anyway "
       f"and covered for the missing check on 7 of 8 named forms")
    pan = S.refrain_form("pantoum quatrain pair").to_mandate()
    short = _returns_satisfied(pan, pan.n_lines - 1)
    pgot = pan.returns_check(short)
    ok("`pantoum quatrain pair` as a MANDATE, 8 lines declared and 7 given "
       "with both returns verbatim, now reports the disagreement",
       [f[3] for f in pgot] == ["LINE_COUNT"], f"{[f[3] for f in pgot]}")
    ok("the whole 8-line draft, returns holding, still reports NOTHING",
       pan.returns_check(_returns_satisfied(pan, pan.n_lines)) == [],
       "-- the fix did not buy its reach with noise on the clean case")

    print("\n    THE MESSAGE, phrased as `check_identity` phrases its own so "
          "the two surfaces cannot drift")
    lmsg = _msg(pgot, "LINE_COUNT")
    ok("it NAMES THE MISSING LINE and both counts, which here ARE the "
       "condition being tested",
       "L8 was never given" in lmsg and "8 lines and 7 were given" in lmsg,
       lmsg[:72])
    ok("and doctrine 79's counts are SEPARATE and never summed: graded on "
       "the positional assumption ANYWAY, not reached, and never graded here",
       "2 graded on that reading ANYWAY" in lmsg
       and "0 naming a line past the draft and NOT CHECKED" in lmsg
       and "0 declared non-verbatim or UNKNOWN" in lmsg
       and "NOT CHECKED" in lmsg)
    ok("the two surfaces say the SAME SENTENCE about the same condition, "
       "with `mandate` for `notation` — that was §14's design choice and it "
       "holds both ways now",
       all(frag in lmsg for frag in
           ("were given — ", "so the draft's line k is not known to be the ",
            "line k and every identity finding here is positional",
            "This is the assumption said out loud, not a clean pass "
            "(doctrine 20)")),
       "-- the shared frames, checked against check_identity's own text below")
    cmsg = _msg(S.refrain_form("pantoum quatrain pair").check_identity(
        _returns_satisfied(pan, 7)), "LINE_COUNT")
    ok("...and that is measured against `check_identity`'s LIVE output, not "
       "against a copy of it in this file",
       cmsg != "" and all(frag in cmsg for frag in
                          ("were given — ", "This is the assumption said out "
                           "loud, not a clean pass (doctrine 20)"))
       and "the notation numbers" in cmsg and "the mandate numbers" in lmsg,
       "-- one says notation, one says mandate, and nothing else differs in "
       "the frame")

    print("\n    THE OTHER DIRECTION, which no index guard can EVER reach: a "
          "draft LONGER than the mandate numbers")
    over = obvious.returns_check(["same", "b", "same", "d", "a fifth line"])
    omsg = _msg(over, "LINE_COUNT")
    ok("5 lines against a 4-line mandate is reported, though every index is "
       "in range and the return is verbatim",
       len(over) == 1 and "L5" in omsg
       and "past the mandate's last line" in omsg,
       "-- a title line shifts every line number and the answers stay silent")

    print("\n    a mandate with NO returns still reports the mismatch, and "
          "that is deliberate — gating LINE_COUNT on 'has returns' would put "
          "the silence back for every rhyme-only mandate")
    rhyme_only = S.mandate("ABAB")
    ok("`ABAB` — 0 returns, 4 lines — given 3 lines still says so, and its "
       "counts are honestly 0 of 0",
       _msg(rhyme_only.returns_check(["a", "b", "c"]), "LINE_COUNT")
       .count("0 ") >= 3
       and rhyme_only.returns_check(["a", "b", "c"]) != [],
       "-- this is the only method on `Mandate` that is shown the draft at "
       "all, so it is the only place the mismatch can surface")
    ok("and the same mandate at its declared length is silent",
       rhyme_only.returns_check(["a", "b", "c", "d"]) == [])

    print("\n    the FOURTH count, which `check_identity` does not need: a "
          "return this method SKIPS is neither graded nor blocked, and "
          "folding it into either would be doctrine 79 broken")
    unk = S.mandate("ABAB", returns="1,3",
                    rule=S.ReturnRule(return_verbatim="unknown"))
    umsg = _msg(unk.returns_check(["a", "b", "c"]), "LINE_COUNT")
    ok("an UNKNOWN-verbatim return is counted as never graded here, not as "
       "graded and not as unchecked",
       "0 graded on that reading ANYWAY" in umsg
       and "0 naming a line past the draft" in umsg
       and "1 declared non-verbatim or UNKNOWN" in umsg, umsg[-96:])
    ok("and at the declared length that mandate is still SILENT, exactly as "
       "§7 pins it",
       unk.returns_check(["a", "b", "c", "d"]) == [])

    print("\n    and the guard has not started swallowing what it grades")
    inr = S.mandate([[1, 3], [2, 4]], n_lines=4,
                    returns=[[1, 3]])
    ok("an IN-RANGE return that came back VERBATIM at the declared length "
       "emits nothing",
       inr.returns_check(["same", "b", "same", "d"]) == [])
    drift = inr.returns_check(["same", "b", "other", "d"])
    ok("an IN-RANGE return that DRIFTED is still a NAMED KIND, and there is "
       "no LINE_COUNT row on a draft of the declared length",
       len(drift) == 1 and drift[0][3] not in ("OUT_OF_RANGE", "LINE_COUNT")
       and "VERBATIM" in drift[0][4], f"{drift[0][3]}")


# ---------------------------------------------------------------------------
# §15b  THE PRODUCTION PATH, PROVED RATHER THAN ASSERTED
# ---------------------------------------------------------------------------

def test_line_count_cannot_fire_through_the_reviser():
    print("\n§15b  the new finding cannot fire through `Reviser.inspect()`, "
          "and this is the proof rather than the claim")

    print("\n    STEP 1 — `SC.mandate(spec, n_lines=N)` returns `n_lines == "
          "N` or RAISES, on every accepted spec kind. Walked, not argued")
    ref = S.refrain_form("triolet")                       # 8 lines
    specs = [
        ("letter string", "ABAB", 4),
        ("RGS code", (0, 1, 0, 1), 4),
        ("group list", [[1, 3], [2, 4]], 4),
        ("Cover", S.Cover(n_lines=4, groups=[[1, 3], [2, 4]]), 4),
        ("Mandate", S.mandate("ABAB"), 4),
        ("RefrainScheme", ref, ref.n_lines),
        ("A-1 notation string", ref.render(), ref.n_lines),
    ]
    agree, refuse, wrong = 0, 0, []
    for name, spec, nat in specs:
        for n in (nat, nat + 1, nat - 1):
            try:
                m = S.mandate(spec, n_lines=n)
            except S.NoMandate:
                refuse += 1
                continue
            if m.n_lines == n:
                agree += 1
            else:
                wrong.append((name, n, m.n_lines))
    ok("21 constructions over 7 spec kinds at three lengths each: every one "
       "either agrees with the `n_lines` it was given or refuses",
       not wrong and agree + refuse == 21,
       f"{agree} agree, {refuse} refuse, {len(wrong)} disagree {wrong}")
    ok("the RE-OPEN branch (`mandate(Mandate, returns=...)`) assigns "
       "`n = n_lines` outright, so it agrees too",
       S.mandate(S.mandate("ABAB"), n_lines=4,
                 returns=[[1, 3]]).n_lines == 4)
    ok("and `carry_returns=False` — the reachable OLD reading of an A-1 "
       "string — routes through the RGS branch and agrees as well",
       S.mandate(ref, n_lines=ref.n_lines, carry_returns=False).n_lines
       == ref.n_lines)

    print("\n    STEP 2 — the call site still passes the SAME list it "
          "measured. Read off `quality/revise.py`, so a change there breaks "
          "this proof rather than silently outdating it (doctrine 48)")
    with open(os.path.join(HERE, "revise.py")) as fh:
        rsrc = fh.read()
    ok("`Reviser.mandate` is still `SC.mandate(spec, n_lines=len(lines))`",
       "return SC.mandate(spec, n_lines=len(lines))" in rsrc)
    ok("`inspect()` still builds its mandate from the draft it is grading",
       "m = self.mandate(lines, mandate)" in rsrc)
    ok("...and still hands `returns_check` that same `lines`",
       "for label, i, j, kind, msg in m.returns_check(lines):" in rsrc)
    ok("so `self.n_lines == len(lines)` there BY CONSTRUCTION, and the "
       "LINE_COUNT branch is unreachable from inspect(), verify(), brief() "
       "and every CLI verb that runs the loop",
       True,
       "-- steps 1 and 2 together; nothing here asserts it on its own")

    print("\n    STEP 3 — WHAT WOULD HAVE TO CHANGE, pinned so the handoff "
          "is mechanical. This finding names NO PAIR, and `revise.py`'s loop "
          "sends every kind but OUT_OF_RANGE to a per-LINE flag")
    # NEVER INDEXES, for the reason `_msg` gives: the QS7 mutant DELETES this
    # finding, and a test that dies on the empty list its own mutant produces
    # aborts the run and prints no pass/fail count at all. Found by running
    # the mutation rather than by reading the helper's docstring — which is
    # the same way §14 found it, in the same suite, one lot earlier.
    lc = [f[:3] for f in S.mandate([[1, 3]], n_lines=6, returns=[[1, 3]])
          .returns_check(["x", "b", "x"]) if f[3] == "LINE_COUNT"]
    ok("`LINE_COUNT` carries label/i/j all None — a length disagreement is "
       "about the DRAFT, not about one return pair",
       lc == [(None, None, None)], f"{lc}")
    ok("and `revise.py` routes every non-OUT_OF_RANGE kind to `add(j, "
       "Finding('RETURN_NOT_VERBATIM', 'flag', ...))`, which would key a "
       "FLAG on line `None` and break `verify()`'s sorted diff",
       'add(j, Finding("RETURN_NOT_VERBATIM", "flag", msg,' in rsrc,
       "-- so revise.py needs a LINE_COUNT branch, into `whole` as a NOTE "
       "beside RETURN_OUT_OF_RANGE, BEFORE anything makes this reachable")
    ok("`verify()` gates acceptance on `new_flags` only, which is why NOTE "
       "is the right severity there and not a matter of taste",
       'new_flags = {k for k in new if sev.get(k) == "flag"}' in rsrc
       and "if len(new_flags) > self.rdecl.allow_net_new:" in rsrc)
    ok("and it could not reject a revision even as a flag: `verify()` "
       "refuses a line-count change outright and inspects BOTH sides with "
       "ONE mandate, so this finding is identical before and after and "
       "cancels out of the Counter diff",
       "if len(before) != len(after):" in rsrc
       and "m = self.mandate(before, mandate)" in rsrc)

    print("\n    STEP 4 — AND THE FIX DID NOT DISARM ADVERSARY 4 ON ITS WAY "
          "PAST. `quality/mutate.py` plants its mutants by EXACT STRING, so "
          "a tidier line in the mutated region deletes a mutant in silence "
          "and the run reports nothing at all")
    import quality.mutate as MUT                                # noqa: E402
    src = open(os.path.join(HERE, "schemes.py")).read()
    qs = [m for m in MUT.MUTATIONS if "schemes" in str(m.file)]
    misses = sorted(m.name for m in qs if src.count(m.old) != 1)
    ok("all 5 schemes.py mutants (QS1-QS5) still have exactly one anchor "
       "in the file they mutate",
       [m.name for m in qs] == ["QS1", "QS2", "QS3", "QS4", "QS5"]
       and not misses,
       f"unapplicable: {misses} -- QS3's anchor is `returns_check`'s own "
       f"`if r.verbatim is not True: continue`, INSIDE the block this lot "
       f"edited, and the first draft of the fix folded it into a "
       f"comprehension and took it from 1 to 0")
    ok("and none of the 57 mutants targets this method's LENGTH guard, "
       "which is why nothing had killed it — the mutation §15 uses belongs "
       "in that file as a QS7",
       not any("if n != self.n_lines:" in m.old for m in MUT.MUTATIONS),
       f"{len(MUT.MUTATIONS)} mutations, 5 on schemes.py, all 5 on "
       f"`Mandate`, none on a length guard")


def main():
    print(__doc__.strip().splitlines()[0])
    test_unknown()
    test_three_statements()
    test_drift_fires()
    test_rhyme_still_mandated()
    test_licence_does_not_leak()
    test_other_collisions_survive()
    test_refusals()
    test_scope()
    test_a1_reaches_the_loop()
    test_the_song()
    test_read_path()
    test_rep_is_the_first_member()
    test_out_of_range_names_its_own_condition()
    test_check_identity_needs_the_whole_draft()
    test_returns_check_needs_the_whole_draft()
    test_line_count_cannot_fire_through_the_reviser()
    print(f"\n{len(PASS)} passed, {len(FAIL)} failed")
    if FAIL:
        for f in FAIL:
            print(f"  FAILED: {f}")
    return 1 if FAIL else 0


if __name__ == "__main__":
    sys.exit(main())
