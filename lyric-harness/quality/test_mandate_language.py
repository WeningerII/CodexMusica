#!/usr/bin/env python3
"""The mandate language: RHYME, RETURN, and the repeat licence per PAIR.

WHAT THIS SUITE IS FOR, AND THE TRAP IT IS BUILT AROUND

This work CREATES A ZERO. Measured on `examples/never_been_to_a_scene.txt`
against this repo's own mandate (`SONG_SCHEME`, `quality/test_revise.py:63`),
16 of the reported findings were the chorus coming back — and after the return
is declared, that number is 0. Doctrine 94: a positive-case suite cannot find a
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

`python3 quality/test_mandate_language.py`
"""

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
EX = os.path.join(os.path.dirname(HERE), "examples")


def song(name):
    with open(os.path.join(EX, name)) as fh:
        return [l.rstrip() for l in fh.read().splitlines()
                if l.strip() and not l.strip().startswith("[")]


#: the letter mandate this repo already grades this song against
SONG_SCHEME = "XXXXXXXXXXXXABCBADCDXXXXXXXXXXXXEFGFEHGHX"
#: the same song, with the one thing a letter scheme cannot say
SONG_RETURN = "chorus:33-40<=13-20"


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
    lines = song("never_been_to_a_scene.txt")
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
    drifted[32] = "So say the highway. Say it slow"          # L33 was L13
    found2 = m.returns_check(drifted)
    ok("a refrain that drifts by one word is caught",
       (13, 33) in [(i, j) for _, i, j, _, _ in found2]
       and len(found2) == len(found) + 1,
       f"{len(found)} -> {len(found2)}")

    print("\n    cherokee_bill's refrain returns VERBATIM, and that is a "
          "measured pass and not an absent check")
    cl = song("cherokee_bill.txt")
    cm = S.mandate([[i, i + 1] for i in range(1, 28, 2)], n_lines=28,
                   returns="refrain:4,28")
    ok("L4/L28 return verbatim -> no finding", cm.returns_check(cl) == [])
    broken = list(cl)
    broken[27] = broken[27].replace("ever will", "always will")
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
    print("\n§10  examples/never_been_to_a_scene.txt, in the language")
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

    print("\n    cherokee_bill: the refrain costs it its letter scheme")
    cm = S.mandate([[i, i + 1] for i in range(1, 28, 2)], n_lines=28,
                   returns="refrain:4,28")
    ok("the COUPLET declaration is a partition", cm.is_partition())
    ok("declaring the return makes it a COVER (doctrine 2)",
       cm.expanded_overlapping_lines() == [4, 28]
       and cm.to_rhyme_letters() is None,
       "-- L4 must answer L3 and L27, because L28 IS L4")


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
    print(f"\n{len(PASS)} passed, {len(FAIL)} failed")
    if FAIL:
        for f in FAIL:
            print(f"  FAILED: {f}")
    return 1 if FAIL else 0


if __name__ == "__main__":
    sys.exit(main())
