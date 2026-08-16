#!/usr/bin/env python3
"""Regressions for the revision loop.

The load-bearing tests are the REJECTIONS. A loop that accepts everything is a
rubber stamp, and the three ways a revision goes wrong are all silent:

  - it fixes the flagged line and breaks another          (test 3)
  - it fixes the rhyme by taking the most obvious word    (test 4)
  - it rewrites lines nobody asked it to touch            (test 5)

Tests 10-17 are the MANDATE half, added when the loop was found to contradict
doctrine 2: it graded letter strings only, and letter strings are the lossy
projection that sometimes does not exist. The two that matter most there are
10 (a grader handed nothing REFUSES rather than reporting a clean draft) and
13 (the group-scoped grader reproduces `check_scheme` pair for pair, so the
generalisation did not quietly become a second comparator).

Tests 18-22 are the FIELD half, added 2026-08-11 after the loop was finally
run end to end on the song this repo wrote and the output was read rather
than counted (`quality/RESULTS_REVISION_LOOP.md`). Tests 1-17 were all
positive cases against a four-line fixture, and doctrine 94 says a
positive-case suite cannot find a rule that is too generous:

  - 18  the brief offered words `grade()` calls a non-rhyme, 17.3% of them,
        because `_field` used the scalar and the grader uses `admits()`
  - 19  `NO JOINT CANDIDATE -- the mandate, not the line, is what needs
        revising` was TRUE and WRONG on three of the song's lines, and the
        cause was a hard-coded `n=200`
  - 20  the four rejections, run against 41 real lines instead of 4 fixture
        ones, plus the accept that stops them being an always-reject
  - 21  what the loop says on the mandate the song was actually WRITTEN to,
        pinned because the answer is "nothing a writer could act on"
  - 22  what the words doctrine 9 forbids actually are, against a declared
        strict-identity reference

Tests 23-24 are the COLLISION half, added the same day after the same reading
was done on the mandate each song was actually WRITTEN to — where the loop
passes the draft outright and then emits nothing but collisions
(`quality/RESULTS_COLLISION_PARTITION.md`):

  - 23  the collision set is PARTITIONED and each part charged to a layer:
        a wholesale merge between two groups is one statement about the
        MANDATE, a near-relation is not an unintended RHYME, and the merge
        rule absorbs edges without ever inventing one
  - 24  the DECISION that a collision earns no candidate field, measured
        rather than asserted: the constraint is negative, so its satisfying
        set is 98-99% of the lexicon and doctrine 9's modal head over it is
        `you, i, the, to, a, 's`

Test 25 is the METER half, added 2026-08-11: `quality/fit.py`'s syllable-
fits-the-bar layer, folded into the SAME finding set as rhyme rather than
grafted on as a second veto. It adds NO new rejection rule of its own — the
existing "a revision may not trade one defect for another" diff (test 3)
already catches a fix that breaks the meter, the moment a meter finding is a
member of the same set that diff reads.

Test 26 is a BUG FIX, not a new feature: `grade()` decided doctrine 3's
REPEAT-is-a-violation question with one song-wide switch
(`rdecl.repeat_licence`) instead of asking the mandate's own per-pair
`repeat_is_violation(i, j)`. Consequence, verified on a real villanelle: a
CORRECT verbatim refrain was flagged as a violation under the default
setting, and `revise_loop` would have tried to "fix" a refrain that was
already right. Two changes, both required: `grade()` now asks the mandate
first and falls back to the switch only where the mandate does not decide
(a plain letter scheme or `Cover` with no `Return` objects, unaffected by
either half of this fix); `inspect()` now also emits
`Mandate.returns_check()` findings, so `verify()`'s existing net-negative
diff — the SAME mechanism test 25 reused for meter — can see a revision
that breaks a declared return, which it could not see at all before.

Tests 30-32 are THREE FINDING CODES NOTHING TESTED, added 2026-08-13 after a
repo-wide sweep found no test in any file reaching `RETURN_OUT_OF_RANGE`,
`MANDATE_EXCUSED_BY_OVERLAP` or `SCHEME_UNREADABLE`. All three fire, so none
is `grid.py`'s `SINGLE_USE_RECURRED` — a guard no input could satisfy. But an
untested code is doctrine 48's shape either way: a check nobody has ever seen
run is a principle living in prose, followed exactly as often as someone
remembers it. Two of the three were saying something other than what they
check, and that is what running them found:

  - 30  `RETURN_OUT_OF_RANGE`'s message names a LENGTH MISMATCH between
        mandate and draft — a condition `Reviser.mandate` refuses several
        frames earlier, so `inspect()` can never reach the code that way.
        What does reach it is a hand-built `Mandate` carrying a `Return`
        outside its own `1..n_lines`, the one input `_normalise_returns`
        exists to raise on. It also shipped with EMPTY evidence, because
        `OUT_OF_RANGE` is not a variation kind and `_KIND_GLOSS.get` returned
        `""` in silence.
  - 31  `MANDATE_EXCUSED_BY_OVERLAP` implemented a DIFFERENT condition from
        the one every statement of the disjunctive reading in this repo makes.
        The reading is per LINE ("answer at least one of YOUR groups"); the
        excusal fired when EITHER endpoint of the failing pair had another
        satisfied group, so a line in exactly ONE group — no other group to
        answer, no "rest" to be excused from — had its ONLY mandated
        obligation dropped because its PARTNER happened to be a pivot. That
        line then answered nothing at all and no flag said so, which is
        doctrine 20's vacuous pass at the line, inside the module written to
        close it. Second half of the same defect: `satisfied[k]`, one boolean
        per GROUP, cannot state a per-line fact — a pivot that answers every
        member of a group has answered it even when two OTHER members of that
        group fail each other.
  - 32  `SCHEME_UNREADABLE` was correct and simply untested: an unreadable end
        word makes a mandated rhyme UNKNOWN rather than absent, the pair is
        refused rather than violated, and the three counts stay three.

Test 33 is a FOURTH declared-and-unread coordinate, found the same way and
fixed 2026-08-13. `Mandate.scope` says which lines a mandate SPEAKS ABOUT, and
`Mandate.requirement` answers `UNDECLARED` — "cannot tell" — for a pair
touching a line outside it, which doctrine 28 keeps strictly apart from
`FREE`'s "nothing required here". `grade()`'s COLLISION LOOP never asked.
MEASURED on this file's own 41-line fixture scoped to its chorus: a full
`inspect()` was BYTE-IDENTICAL to the unscoped run — same 73 collisions, same
97 per-line findings, same messages — and 49 of those 73 touch a line the
mandate says it does not speak about, rendered to the writer as
`L1 (free) and L3 (free) RHYME and share no mandated group`, printing the one
word doctrine 28 exists to keep separate.

REPORTED, NOT SUPPRESSED, and that is the decision the test pins. Dropping the
49 would trade a mislabel for a silence: a scoped run emitting 24 collisions
would be indistinguishable from one where all 73 pairs were checked and 49 came
back clean — doctrine 20's collapse pointed the other way — and doctrine 24
says a rule that would delete a category must RELABEL instead. So the SET is
unchanged and the 49 come back under a fourth code, `COLLISION_UNDECLARED`
(a note, in `COLLISION_FINDINGS`, in no candidate field), plus one whole-draft
`MANDATE_SCOPE_DECLARED` stating the coordinate and the two counts separately.
Every production mandate has an empty scope, so the default path is untouched.

Test 38 is the LINE-NUMBERING seam, and it is a refusal rather than a repair.
`Mandate.pairs0()` is 0-based against the RAW list a caller hands in;
`SlopFloor.check` and `QualityFeatures.extract` both open by dropping blank
lines, which is correct for a direct floor caller (`test_floor.py` test 2, and
this fix does not touch it). Handed a draft with a blank, the two halves of
`inspect()` therefore number lines differently and neither says so. Measured
on a 5-line draft with a blank at L2 and groups 1,3;4,5, reachable through a
plain letter string:

  - the mandated pair L4/L5 is (3, 4) in `pairs0()`, out of range against the
    floor's 4-element list, and DROPPED by the guard in
    `_relation_findings` — the finding it loses is a REPEAT_IN_VERSE FLAG
  - (0, 2) is graded in its place, as raw L1/L4, a pair the mandate never
    groups
  - every floor finding's `locations` is `enumerate()`d over the STRIPPED
    list and filed as RAW line numbers: `ANAPHORA_OVERLOAD` comes back at
    [1, 2, 3, 4] on a draft whose true raw lines are [2, 3, 4, 5], so
    `brief()` briefs the EMPTY line and skips a real one

`Reviser.mandate` REFUSES such a draft with `NoMandate`, the same instrument
`quality/schemes.py` already uses for the sibling defect one coordinate over.
Stripping would have silently RENUMBERED the writer's declaration, and would
have moved two coordinates that are not this module's to move —
`verify(targeted=...)` is the caller's numbering, and a pre-built `Mandate`
carries `n_lines` from the raw draft. NOT reachable from the CLI, where
`load_lyric_lines` and `parse_lyric_sections` drop blanks; fully reachable
from the Python API on every entry.

Run: python3 quality/test_revise.py
"""

import collections
import json
import os
import shutil
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
sys.path.insert(0, os.path.join(HERE, "..", ".."))

from lyric_harness import (Declaration, NEAR_RELATIONS,  # noqa: E402
                           check_scheme, line_anchors, load_lyric_lines,
                           readability_records, rhyme_graph)
from quality import fit as FT  # noqa: E402
from quality import frequency as FREQ  # noqa: E402
from quality import readability as RD  # noqa: E402
from quality import revise as RV  # noqa: E402
from quality import schemes as SC  # noqa: E402
from quality.revise import (COLLISION_FINDINGS, SATISFACTION_FINDINGS,  # noqa: E402
                            THETA_COLLISION, Brief, NoMandate,
                            ReviseDeclaration, Reviser)

FAILURES = []
R = Reviser()

#: `CAUSE` used to be appended to every check this file left RED ON PURPOSE
#: after `Declaration.coda_agreement` moved the song's graph out from under
#: it (2026-08-11). REMOVED 2026-08-11: every one of those checks is closed
#: now -- three repointed to the real song's own CURRENT structure (tests 15
#: and 19), one moved to a constructed fixture because its real witness was
#: gone entirely (test 14, doctrine 94) -- so a "this is red on purpose"
#: string with nothing red left to attach it to would itself become the
#: stale claim doctrine 58 warns about. History: quality/RESULTS_CODA_SHAPE.md
#: and quality/RESULTS_COLLISION_PARTITION.md §9.

CLICHE = ["The candle burned and set the room on fire",
          "He said the word and then he turned to go",
          "And all night long she nursed a small desire",
          "She never asked the thing she had to know"]

#: A constructed draft (doctrine 94) and its DECLARED mandate. 41 lines whose
#: maximal cliques overlap, so no letter scheme represents its graph -- while
#: the mandate declared here is a letter string over the two choruses.
SONG = os.path.join(HERE, "fixtures", "mandate_song.txt")
SONG_SCHEME = "XXXXXXXXXXXXABCBADCDXXXXXXXXXXXXEFGFEHGHX"
#: the same chorus return `quality/test_mandate_language.py` declares, in the
#: same notation -- L33-40 ARE L13-20. Used by test 33, whose subject is the
#: OTHER coordinate on that mandate (`scope`), so the return half is held
#: fixed and spelled the way the sibling suite spells it.
SONG_RETURN = "chorus:33-40<=13-20"
SONG_BLUEPRINT = os.path.join(HERE, "fixtures", "mandate_song.blueprint.json")

#: A constructed blueprint that DECLARES section function and a hook --
#: `SONG_BLUEPRINT` above declares neither, which is exactly right for a
#: pure-meter test and useless for this file's function-report tests.
MOONLIGHT_SONG = os.path.join(HERE, "fixtures", "moonlight_fixture.txt")
MOONLIGHT_BLUEPRINT = os.path.join(HERE, "fixtures",
                                   "moonlight_fixture.blueprint.json")


def moonlight_lines():
    with open(MOONLIGHT_SONG, encoding="utf-8") as fh:
        return [l.rstrip() for l in fh.read().splitlines()
                if l.strip() and not l.strip().startswith("[")
                and not l.strip().startswith("#")]

#: A REAL villanelle -- ABA rhyme throughout, two verbatim refrains (A1 at
#: lines 1/6/12/18, A2 at 3/9/15/19) -- written for test 26, checked for
#: correctness the same way: every "a"/"b" line takes a DISTINCT rhyming
#: word, verified empirically (`grade(..., S.REFRAIN_FORMS["villanelle"])`
#: reports 0 violations over 93 mandated pairs) rather than assumed from
#: writing it by hand.
VILLANELLE = [
    "The tide comes in and takes the sand away",
    "I watch the gulls go wheeling toward the shore",
    "I count the boats that will not choose to stay",
    "The pier lights flicker at the end of day",
    "and no one walks here who has walked before",
    "The tide comes in and takes the sand away",
    "My father used to say the sea would pay",
    "for every ruined thing it dragged onto the floor",
    "I count the boats that will not choose to stay",
    "The rope goes slack, the anchor starts to sway",
    "the harbor empties like an open door",
    "The tide comes in and takes the sand away",
    "I used to think the tide had come today",
    "a permanent thing, and owed us nothing more",
    "I count the boats that will not choose to stay",
    "There's nothing left to keep, and less to delay",
    "the water met the rocks and gave a roar",
    "The tide comes in and takes the sand away",
    "I count the boats that will not choose to stay",
]


def song_lines():
    with open(SONG, encoding="utf-8") as fh:
        return [l.rstrip() for l in fh.read().splitlines()
                if l.strip() and not l.strip().startswith("[")]


def check(name, cond, detail=""):
    print(f"  {'PASS' if cond else 'FAIL'}  {name}")
    if detail:
        print(f"          {detail}")
    if not cond:
        FAILURES.append(name)


def test_the_loop_does_not_write():
    print("\n1. the loop grades, it never generates")
    for bad in ("generate", "write", "compose", "rewrite", "draft_line"):
        check(f"Reviser has no {bad!r} method", not hasattr(R, bad))
    briefs = R.brief(CLICHE, "ABAB")
    check("brief() returns instructions, not text",
          all(isinstance(b, Brief) for b in briefs) and briefs)
    check("every brief is line-scoped",
          all(b.line_no >= 1 for b in briefs),
          "the loop revises flagged lines only, never the whole draft")


def test_the_brief_excludes_the_modal_region():
    print("\n2. doctrine 9 — the brief pushes AWAY from the optimum")
    b = [x for x in R.brief(CLICHE, "ABAB") if x.line_no == 1][0]
    check("a rhyme finding earns a candidate field",
          bool(b.candidates) and bool(b.forbidden_modal),
          f"{len(b.candidates)} offered, {len(b.forbidden_modal)} forbidden")
    # WIRED 2026-08-11: the ranking is no longer `lex.freq_rank` alone. It is
    # the call-conditional table first (quality/frequency.py's `eng-song`
    # cell, scoring=UNSEEN) and `lex.freq_rank` only as backoff for a
    # candidate the conditional never observed for any of this line's calls
    # -- see `Reviser.joint_field`. Reproducing that exact key here is the
    # point: it is the contract, the same way the old test encoded the old
    # one.
    calls = tuple(dict.fromkeys(
        w for _, _, cl in b.must_answer for _, w in cl if w))
    cond = collections.Counter()
    for call in calls:
        cond.update(FREQ.LAYER.conditional("eng-song", call,
                                            scoring=FREQ.UNSEEN))

    def rank_key(w):
        return (-cond.get(w, 0), R.lex.freq_rank.get(w, 10 ** 9))

    check("the forbidden words are the MOST PREDICTABLE ones under that key",
          all(rank_key(w) <= max((rank_key(c) for c in b.candidates),
                                  default=(0, 0))
              for w in b.forbidden_modal),
          f"forbidden {b.forbidden_modal[:5]} rank ahead of offered "
          f"{b.candidates[:5]} on (conditional count desc, freq_rank asc)")
    # REPOINTED 2026-08-16. This check NAMES the incumbent rule and used to
    # evidence it with `"fire" in b.forbidden_modal` — which passed, but for
    # the OTHER rule: `fire`/`desire` is the canonical modal pair, so `fire`
    # is head[0] of its own field on its own merits and would be on that list
    # with the incumbent clause deleted entirely. That is the
    # "passes for the wrong reason" shape CLAUDE.md's Test discipline section
    # enumerates, and the two-field split is what makes it sayable.
    check("the current end word is carried as the INCUMBENT, on its own "
          "field — re-proposing what is already there is not a revision",
          b.forbidden_incumbent == "fire",
          f"forbidden_incumbent={b.forbidden_incumbent!r}")
    check("...and this fixture cannot prove that rule ALONE, which is why "
          "the field is asserted rather than list membership: 'fire' is "
          "ALSO head[0] of its own modal field, so it would sit on the "
          "modal list under doctrine 9 with the incumbent clause deleted",
          "fire" in b.forbidden_modal,
          f"overlap is real and deliberate; head={b.forbidden_modal[:3]}")
    check("nothing forbidden leaks into the offered list — neither rule",
          not (set(b.candidates) & set(b.forbidden_modal))
          and b.forbidden_incumbent not in b.candidates)
    off = ReviseDeclaration(modal_exclusion=0)
    plain = Reviser(lex=R.lex, decl=R.decl, rdecl=off, floor=R.floor)
    plain._engine = R.engine
    b0 = [x for x in plain.brief(CLICHE, "ABAB") if x.line_no == 1][0]
    check("with the rule disabled the modal words come back",
          len(b0.forbidden_modal) < len(b.forbidden_modal),
          "modal_exclusion=0 is reachable so the defect it prevents is "
          "demonstrable, and it is not the default")


def test_a_revision_may_not_trade_one_defect_for_another():
    print("\n3. REJECT — fixing the flagged line by breaking another")
    before = CLICHE
    # fixes the cliche on L1/L3 and introduces a self-rhyme with L2
    after = list(before)
    after[0] = "The candle burned and left the evening go"
    res = R.verify(before, after, "ABAB", targeted={1})
    check("the revision is rejected", not res["accepted"],
          "; ".join(res["reasons"])[:110])


def test_reject_taking_the_modal_candidate():
    print("\n4. REJECT — passing the band by taking the obvious word")
    b = [x for x in R.brief(CLICHE, "ABAB") if x.line_no == 2][0]
    modal = [w for w in b.forbidden_modal if w != "go"]
    check("there is a modal word to take", bool(modal), str(b.forbidden_modal))
    after = list(CLICHE)
    after[1] = f"He said the word and turned to face the {modal[0]}"
    res = R.verify(CLICHE, after, "ABAB", targeted={2})
    check("taking a forbidden modal candidate is rejected",
          not res["accepted"] and "modal" in " ".join(res["reasons"]),
          "; ".join(res["reasons"])[:130])
    check("the violation is reported per line",
          res.get("modal_violations"), str(res.get("modal_violations")))


def test_reject_rewriting_untargeted_lines():
    print("\n5. REJECT — revising more than was asked")
    after = list(CLICHE)
    after[0] = "A different opening entirely for the choir"
    after[3] = "and nobody remembered what they owe"
    res = R.verify(CLICHE, after, "ABAB", targeted={1})
    check("touching an untargeted line is rejected",
          not res["accepted"] and "not targeted" in " ".join(res["reasons"]),
          "; ".join(res["reasons"])[:110])


def test_reject_restructuring():
    print("\n6. REJECT — changing the shape of the draft")
    res = R.verify(CLICHE, CLICHE[:3], "ABAB", targeted={1})
    check("dropping a line is rejected", not res["accepted"],
          "; ".join(res["reasons"])[:100])


def test_reject_a_no_op():
    print("\n7. REJECT — a revision that fixes nothing")
    res = R.verify(CLICHE, list(CLICHE), "ABAB", targeted=set())
    check("an unchanged draft is not accepted", not res["accepted"],
          "; ".join(res["reasons"])[:80])


def test_accept_a_real_fix():
    print("\n8. ACCEPT — a revision that fixes and breaks nothing")
    # replace the cliche rhyme with a non-modal one from the offered field
    b = [x for x in R.brief(CLICHE, "ABAB") if x.line_no == 1][0]
    picked = None
    for w in b.candidates:
        trial = list(CLICHE)
        trial[0] = f"The candle burned and set the room to {w}"
        res = R.verify(CLICHE, trial, "ABAB", targeted={1})
        if res["accepted"]:
            picked = (w, res)
            break
    check("some offered candidate yields an accepted revision",
          picked is not None,
          f"tried {len(b.candidates)} offered words" if picked is None
          else f"{picked[0]!r}: {picked[1]['reasons'][0]}")
    if picked:
        check("the accepted word was NOT in the forbidden modal set",
              picked[0] not in b.forbidden_modal,
              "the loop accepted a rhyme that passes the band without being "
              "the obvious choice — which is the whole point")
        check("acceptance reports what it fixed",
              picked[1]["fixed"], str(picked[1]["fixed"])[:80])


def test_verify_never_returns_a_score():
    print("\n9. doctrine 6 — verification is a verdict, not a number")
    res = R.verify(CLICHE, list(CLICHE), "ABAB", targeted=set())
    for k in ("score", "quality", "rating", "grade", "total"):
        check(f"no {k!r} key", k not in res)
    check("it reports reasons a caller can act on",
          isinstance(res.get("reasons"), list) and res["reasons"])


# ---------------------------------------------------------------------------
# THE MANDATE HALF
# ---------------------------------------------------------------------------


def test_no_mandate_is_a_refusal_not_a_pass():
    print("\n10. doctrine 20 — handed nothing, the loop REFUSES")
    for fn, args in (("brief", (CLICHE,)),
                     ("inspect", (CLICHE,)),
                     ("grade", (CLICHE,)),
                     ("verify", (CLICHE, list(CLICHE)))):
        try:
            getattr(R, fn)(*args)
            check(f"{fn}() with no mandate refuses", False,
                  "it returned instead of refusing — a vacuous pass")
        except NoMandate as e:
            check(f"{fn}() with no mandate refuses", True, str(e)[:72])
    try:
        SC.mandate("XXXX")
        check("an all-free scheme refuses too", False)
    except NoMandate as e:
        check("an all-free scheme refuses too", True,
              "'XXXX' mandates no pair, so grading against it passes "
              "vacuously; " + str(e)[:40])
    try:
        R.brief(CLICHE, "ABABAB")
        check("a length mismatch refuses instead of being ignored", False,
              "the old loop dropped a wrong-length scheme in silence")
    except NoMandate:
        check("a length mismatch refuses instead of being ignored", True)


def test_every_way_of_declaring_the_same_mandate_agrees():
    print("\n11. four spellings of one requirement, one object")
    forms = {"letter string": "ABAB",
             "line groups": [[1, 3], [2, 4]],
             "RGS code": (0, 1, 0, 1),
             "Cover": SC.Cover(n_lines=4, groups=[[1, 3], [2, 4]])}
    base = None
    for name, spec in forms.items():
        m = SC.mandate(spec, n_lines=4)
        got = (m.n_lines, m.groups, m.free)
        if base is None:
            base = got
        check(f"{name} gives the same mandate", got == base, str(got))
    check("and it round-trips to the letter string it came from",
          SC.mandate("ABAB").to_letters() == "ABAB")
    m = SC.mandate(SONG_SCHEME)
    check("the song's declared 41-char scheme survives the round trip",
          m.to_letters() == SONG_SCHEME,
          f"{len(m.groups)} groups, {len(m.pairs())} mandated pairs, "
          f"{len(m.free)} free lines")
    check("X is a FREE SINGLETON and mandates nothing",
          len(m.pairs()) == 8 and len(m.free) == 25,
          "24 X lines plus L41; declaring them a rhyme class would mandate "
          "300 pairs and demand that 'mailboxes' rhyme with 'does'")


def test_an_overlapping_cover_is_gradeable():
    print("\n12. doctrine 2 — a cover with NO letter scheme, graded")
    cov = SC.Cover(n_lines=4, groups=[[1, 3], [2, 3]])
    m = SC.mandate(cov, n_lines=4)
    check("the cover has no letter representation",
          m.to_letters() is None and m.overlapping_lines() == [3],
          "L3 is in two groups; a letter is a property of a LINE")
    rep = R.grade(CLICHE, m)
    check("it is graded anyway", rep["pairs_mandated"] == 2,
          f"{rep['pairs_mandated']} mandated, "
          f"{len(rep['violations'])} violation(s)")
    check("the pivot's failure is reported AGAINST A NAMED GROUP",
          any(v["lines"] == (2, 3) and v["label"] == "B"
              for v in rep["violations"]),
          str([(v["lines"], v["label"], v["why"])
               for v in rep["violations"]]))
    b = [x for x in R.brief(CLICHE, m) if x.line_no == 3][0]
    check("the brief tells the pivot it must answer EVERY group",
          len(b.must_answer) == 2,
          "; ".join(f"{lab} {mem}" for lab, mem, _ in b.must_answer))
    check("and says so when the conjunction is unsatisfiable",
          b.joint_conflict,
          "no word in the lexicon rhymes with both 'fire' and 'go' — a "
          "sentence no letter scheme can form, because it cannot put a line "
          "in two classes to begin with")
    # verify() has to take the same object brief() took, or the loop is only
    # half converted and a caller has to keep a letter string around anyway.
    ok = SC.Cover(n_lines=4, groups=[[1, 3], [2, 4]])
    after = list(CLICHE)
    after[0] = "The candle burned and set the room to power"
    res = R.verify(CLICHE, after, ok, targeted={1})
    check("verify() accepts a Cover and reaches a verdict",
          isinstance(res.get("accepted"), bool) and res["reasons"],
          f"{'ACCEPTED' if res['accepted'] else 'REJECTED'}: "
          + "; ".join(res["reasons"])[:80])
    check("and it agrees with the letter string that means the same thing",
          res["accepted"] == R.verify(CLICHE, after, "ABAB",
                                      targeted={1})["accepted"])
    dis = Reviser(lex=R.lex, decl=R.decl, floor=R.floor,
                  rdecl=ReviseDeclaration(overlap_rule="disjunctive"))
    dis._engine = R.engine
    # REPOINTED 2026-08-13 with the excusal fix in test 31: this check's claim
    # ("reachable, and weaker") is unchanged, but the cover it was made on —
    # [[1,3],[2,3]] — no longer excuses anything, and correctly so. L2 is in
    # exactly ONE group there, so under "answering one of your groups excuses
    # the rest" it has no other group to answer and no rest to be excused
    # from; the old rule excused the pair anyway, on the strength of L3's
    # success. The cover below adds C={2,4} so BOTH endpoints of the failing
    # pair are pivots that answer another of their own groups, which is the
    # shape the disjunctive reading actually names.
    dm = SC.mandate(SC.Cover(n_lines=4, groups=[[1, 3], [2, 3], [2, 4]]),
                    n_lines=4)
    rep1 = R.grade(CLICHE, dm)
    rep2 = dis.grade(CLICHE, dm)
    check("the disjunctive reading is REACHABLE and is weaker",
          len(rep2["violations"]) < len(rep1["violations"])
          and len(rep2["excused"]) > 0,
          f"conjunctive {len(rep1['violations'])} violation(s), disjunctive "
          f"{len(rep2['violations'])} + {len(rep2['excused'])} excused — a "
          f"mandate that gets weaker the more structure you declare, which "
          f"is why it is not the default")


def test_the_group_grader_reproduces_check_scheme():
    print("\n13. the generalisation did not become a second comparator")
    from battery import EXPECTED, corpus_path, parse_sonnets
    lex, decl = R.lex, R.decl
    sonnets = parse_sonnets(corpus_path("sonnets.txt"))
    a = [0, 0, 0, 0]
    b = [0, 0, 0, 0]
    differing = 0
    for sn in sonnets:
        cs = check_scheme(lex, sn, "ABABCDCDEFEFGG", decl)
        g = R.grade(sn, "ABABCDCDEFEFGG")
        for k, key in enumerate(("pairs_mandated", "pairs_judged",
                                 "pairs_refused")):
            a[k] += cs[key]
            b[k] += g[key]
        a[3] += len(cs["violations"])
        b[3] += len(g["violations"])
        if {(i, j) for i, j, _, _ in cs["violations"]} != \
                {v["lines"] for v in g["violations"]}:
            differing += 1
    check("mandated / judged / refused / violations are identical", a == b,
          f"check_scheme {a}  grade {b}")
    # THE PIN IS READ FROM `battery.py`, NOT COPIED INTO THIS FILE. It was a
    # literal `(1064, 1014, 50, 81)` here, which made this the SECOND place
    # the oracle's state was written down -- and on 2026-08-11 the coda
    # channel moved, cell BA repinned `battery.EXPECTED` to 82 with the
    # argument and the price stated, and this file went red on a number it
    # does not own and cannot argue. Doctrine 48's shape: a roster copied into
    # two files drifts in both. What this test is FOR is the line below it --
    # that `grade()` and `check_scheme` do not disagree -- and that claim is
    # independent of wherever the oracle is currently pinned.
    want = (EXPECTED["mandated"], EXPECTED["judged"],
            EXPECTED["refused"], EXPECTED["violations"])
    check("the sonnet battery's own numbers are unmoved",
          tuple(b) == want,
          f"battery.EXPECTED {want}, measured {tuple(b)} — the pin lives in "
          f"battery.py and is repinned there, with the layer that moved named")
    check("not one sonnet's violation SET differs", differing == 0,
          f"{len(sonnets)} sonnets compared pair for pair")


def test_the_song_the_loop_could_not_grade():
    print("\n14. the song with no letter scheme — both paths")
    lines = song_lines()
    check("41 lines", len(lines) == 41, str(len(lines)))

    # -- the LETTER path, unchanged: unaffected by the graph's overlap state
    cs = check_scheme(R.lex, lines, SONG_SCHEME, R.decl)
    check("the declared letter mandate still passes 8/8, 0 violations",
          (cs["pairs_mandated"], cs["pairs_judged"], cs["pairs_refused"],
           len(cs["violations"])) == (8, 8, 0, 0),
          f"{cs['pairs_mandated']}/{cs['pairs_judged']} judged, "
          f"{len(cs['violations'])} violations, "
          f"{len(cs['collisions'])} collisions")

    # -- the PARTITION path, reproducing it
    m = SC.mandate(SONG_SCHEME)
    rep = R.grade(lines, m)
    check("the PARTITION path reproduces it exactly",
          (rep["pairs_mandated"], rep["pairs_judged"], rep["pairs_refused"],
           len(rep["violations"])) == (8, 8, 0, 0)
          and len(rep["collisions"]) == len(cs["collisions"]),
          f"{rep['pairs_mandated']}/{rep['pairs_judged']}, "
          f"{len(rep['violations'])} violations, "
          f"{len(rep['collisions'])} collisions")

    # -- the GRAPH's own structure, WAS the real song, NOT ANY MORE.
    #
    # REPOINTED 2026-08-11. This function's own name is "the song the loop
    # could not grade" and that premise is now false: cell BA's
    # coda-identity fix (RESULTS_CODA_SHAPE.md) makes THIS song's graph
    # fully DISJOINT. `rhyme_graph(R.lex, lines, R.decl)` now reports
    # `letter_representable=True`, 6 maximal cliques, ZERO overlapping
    # nodes -- L27 ("ones") no longer clears theta=0.75 with either of its
    # former clique partners at all, so it is not in the graph, not merely
    # un-pivoted (see BACKLOG.md 1.4's own amendment). Real exemplars are
    # preferred (house style), but the exemplar is gone, so the overlap half
    # of this test moves to a constructed fixture (doctrine 94) that
    # reproduces every property the real song used to supply: an
    # overlapping graph, a non-letter-representable cover, and REPEAT edges
    # a partition-style mandate would reject. The LETTER and PARTITION
    # checks above stay on the real song -- they were never about overlap.
    overlap_lines = [
        "I saw a thousand tiny lights",
        "I opened up the rusted gates",
        "I missed it by a couple bits",
        "I opened up the rusted gates",
    ]
    g = rhyme_graph(R.lex, overlap_lines, R.decl)
    check("its maximal cliques OVERLAP, so no letter scheme exists "
          "(constructed fixture)",
          not g["letter_representable"],
          f"{len(g['cliques'])} cliques, overlapping node(s) "
          f"{sorted(v + 1 for v in g['overlapping_nodes'])}")
    dm = R.mandate_from_graph(overlap_lines)
    check("the fixture's own clique cover is a mandate with no letter "
          "scheme",
          dm.to_letters() is None and len(dm.overlapping_lines()) >= 1,
          f"{len(dm.groups)} groups, pivots {dm.overlapping_lines()}")
    check("and it declares itself NOT INDEPENDENT of the grader",
          not dm.independent(),
          "doctrine 14 — every clique band-passes by construction, so a "
          "clean rhyme result against it is an identity, not a verdict")
    drep = R.grade(overlap_lines, dm)
    check("grading it is not vacuous: the graph admits REPEAT edges that a "
          "mandate rejects",
          len(drep["violations"]) == len(drep["repeats"]) > 0,
          f"{len(drep['violations'])} violation(s), all REPEAT: "
          + ", ".join(f"L{v['lines'][0]}/L{v['lines'][1]} "
                      f"{v['endwords'][0]!r}" for v in drep["violations"][:4]))
    ins = R.inspect(overlap_lines, dm)
    check("the brief carries the non-independence as a whole-draft finding",
          any(f.code == "MANDATE_NOT_INDEPENDENT" for f in ins["whole"]))


def test_a_derived_cover_is_independent_at_another_theta():
    print("\n15. doctrine 58 — a cover is a coordinate of the band that "
          "made it")
    lines = song_lines()
    # `coda_agreement="scalar"` declared EXPLICITLY, 2026-08-11: the default
    # became `identity` (cell BA), which does not consult `theta_coda` at
    # all, so `theta_coda=0.60` alone no longer builds a different graph from
    # the shipped one -- both readings produced the literally identical 7
    # groups, which silently defeated the whole point of this test (a cover
    # that is supposed to be a coordinate of a band that no longer moves).
    loose = Reviser(lex=R.lex,
                    decl=Declaration(theta_coda=0.60, coda_agreement="scalar"),
                    floor=R.floor)
    loose._engine = R.engine
    old = loose.mandate_from_graph(lines, origin="cliques at theta_coda=0.60")
    strict = R.grade(lines, SC.mandate(old.to_cover(), n_lines=41,
                                       source="declared",
                                       origin="the theta_coda=0.60 cover, "
                                              "graded at the shipped 0.80"))
    check("the structure the song had under the OLD band does not hold "
          "under the shipped one",
          len(strict["violations"]) > 0,
          f"{len(old.groups)} groups derived at theta_coda=0.60, "
          f"{strict['pairs_mandated']} mandated pairs, "
          f"{len(strict['violations'])} violation(s) at theta_coda="
          f"{R.decl.theta_coda}")
    check("so a derived cover IS independent evidence once the band moves",
          len(old.groups) != len(R.mandate_from_graph(lines).groups),
          f"{len(old.groups)} groups (loose, scalar) vs "
          f"{len(R.mandate_from_graph(lines).groups)} (shipped, identity) — "
          f"the clique count is a coordinate of theta_coda UNDER THE SCALAR "
          f"READING, not a property of the song. `coda_agreement=identity` "
          f"(the shipped default since 2026-08-11) makes theta_coda inert, "
          f"which is why `coda_agreement` has to be declared explicitly "
          f"above for this comparison to mean anything.")


def test_findings_are_not_printed_six_times():
    print("\n16. BACKLOG 1.5 — one finding, once")
    lines = song_lines()
    briefs = R.brief(lines, SONG_SCHEME)
    dupes = []
    for b in briefs:
        keys = [(f.code, f.message, f.evidence, tuple(f.locations))
                for f in b.findings]
        if len(keys) != len(set(keys)):
            dupes.append(b.line_no)
    check("no brief repeats an identical finding", not dupes,
          f"lines with duplicates: {dupes}" if dupes else
          f"{sum(len(b.findings) for b in briefs)} findings over "
          f"{len(briefs)} flagged line(s)")


def test_x_is_not_a_rhyme_class_in_the_floor_either():
    print("\n17. the fourth site of the X-is-a-class defect")
    lines = song_lines()
    m = SC.mandate(SONG_SCHEME)
    fl, pseudo = R._floor_for(m)
    check("the floor is handed the MANDATE's pairs, not the letters",
          fl._pairs(lines, pseudo) == m.pairs0() and len(m.pairs0()) == 8,
          f"{len(m.pairs0())} pairs — the 8 the mandate declares")
    from quality.features import QualityFeatures
    raw = QualityFeatures.pairs_from_scheme(SONG_SCHEME)
    check("the unowned site still has the defect, and is named not hidden",
          len(raw) == 308,
          f"features.pairs_from_scheme groups by CHARACTER, so it reads the "
          f"24 X lines as one class and returns {len(raw)} pairs for a "
          f"mandate of 8. Not fixed here (quality/features.py is not this "
          f"cell's file); routed around, and reported.")
    b = [x for x in R.brief(lines, SONG_SCHEME) if x.line_no == 5]
    check("so nothing is briefed to rhyme 'mailboxes' with 'does'",
          not b or not any(mem for _, mem, calls in b[0].must_answer
                           if 1 in mem),
          "L5 is declared free; it answers nothing")


def test_a_declared_return_is_not_slop():
    """17b. the floor charged the writer for obeying the mandate.

    NOTHING PINNED THIS, WHICH IS WHY IT SHIPPED. `_floor_for` handed the
    slop floor `m.pairs0()`, and on every path a writer actually uses the
    declared return pairs are IN pairs0 -- an A-1 mark carries a rhyme letter
    so `to_mandate` builds groups from `blocks(self.code)`, and `--returns=`
    passes one group list as both `groups` and `returns`. So the floor read a
    correct refrain as a word rhyming with itself.
    """
    print("\n17b. a declared RETURN is the requirement, not the slop")
    lines = [l.strip() for l in VILLANELLE.strip().splitlines()
             if l.strip()] if isinstance(VILLANELLE, str) else list(VILLANELLE)
    m = SC.mandate(SC.REFRAIN_FORMS["villanelle"])
    fl, pseudo = R._floor_for(m)

    rp = list(m.return_pairs())
    check("the villanelle's refrain pairs are IN pairs0 — this is the leak",
          len(rp) == 12 and len(m.pairs0()) == 93,
          f"{len(m.pairs0())} rhyme pairs, {len(rp)} of them declared returns")
    check("and the floor is handed pairs0 MINUS them",
          len(fl._pairs(lines, pseudo)) == 81,
          f"93 - 12 = {len(fl._pairs(lines, pseudo))}. Both the numerator and "
          f"the denominator: the returns were also inflating `npairs`, which "
          f"is what every real radif is licensed against.")

    found = fl.check(lines, pseudo)
    rep = [f for f in found if f.code == "REPEAT_IN_VERSE"]
    check("a formally PERFECT villanelle draws no REPEAT_IN_VERSE",
          not rep,
          f"{[(f.severity, f.evidence[:60]) for f in rep]} — before this was "
          f"subtracted the shipped code produced 1 ('carried by 6 of 93 "
          f"pairs, under the declared 50% needed to read it as a refrain'), "
          f"and before the 2026-08-14 severity split it was a FLAG."
          if rep else "0 — it was 1, reading the refrain as slop")

    check("the layer that DOES understand identity agreed all along",
          list(m.returns_check(lines)) == [],
          "returns_check() is empty on this draft: the returns are perfect. "
          "Two layers, one draft, opposite verdicts — and the one that was "
          "wrong is the one that does not know what a refrain is.")

    # THE OTHER HALF, WITHOUT WHICH THIS IS JUST A MUTED CHECK. Removing a
    # false charge is only correct if the true one survives.
    broken = list(lines)
    broken[5] = broken[5].replace("takes", "hauls")
    m2 = SC.mandate(SC.REFRAIN_FORMS["villanelle"])
    kinds = [k for _, _, _, k, _ in m2.returns_check(broken)]
    check("a DRIFTED return is still caught, by the layer that owns it",
          bool(kinds),
          f"{sorted(set(kinds))} — one interior word changed and the refrain "
          f"requirement fails, so the subtraction removed a false charge "
          f"without removing a true one.")


def test_the_field_is_the_graders_own_field():
    print("\n18. doctrine 94 — the brief and the verdict ask the same question")
    from lyric_harness import admits, best_score
    lines = song_lines()
    m = R.mandate_from_graph(lines)
    bad, tot = [], 0
    for b in R.brief(lines, m):
        calls = [w for _, _, cl in b.must_answer for _, w in cl]
        calls = [c for c in dict.fromkeys(calls) if c]
        for w in b.candidates:
            tot += 1
            for c in calls:
                ax, wa = R._word_anchors(c)
                ay, wb = R._word_anchors(w)
                if not admits(best_score(ax, ay, R.decl, wa, wb),
                              R.decl.theta_rhyme):
                    bad.append((b.line_no, c, w))
                    break
    check("no offered candidate is one the grader would reject",
          not bad,
          f"{tot} words offered across the song's flagged lines, "
          f"{len(bad)} that `grade()` calls a non-rhyme"
          + (f" -- e.g. {bad[:4]}" if bad else ""))
    # THE FAILING CASE, constructed. A positive-case suite cannot find a rule
    # that is too generous, so the pre-fix predicate is run here on purpose.
    scal = Reviser(lex=R.lex, decl=R.decl, floor=R.floor,
                   rdecl=ReviseDeclaration(field_band="scalar",
                                           field_depth=200))
    scal._engine = R.engine
    leak = 0
    for b in scal.brief(lines, m):
        calls = [w for _, _, cl in b.must_answer for _, w in cl]
        calls = [c for c in dict.fromkeys(calls) if c]
        for w in b.candidates:
            for c in calls:
                ax, wa = scal._word_anchors(c)
                ay, wb = scal._word_anchors(w)
                if not admits(best_score(ax, ay, scal.decl, wa, wb),
                              scal.decl.theta_rhyme):
                    leak += 1
                    break
    check("and the pre-fix predicate is reachable and still leaks",
          leak > 0,
          f"field_band='scalar', field_depth=200 offers {leak} words the "
          f"grader rejects -- the shipped behaviour until 2026-08-11. Kept "
          f"reachable so the defect is demonstrable rather than a sentence "
          f"nobody can check (doctrine 84)")


def test_no_joint_candidate_was_a_coordinate_of_a_literal():
    print("\n19. doctrine 58 — 'the mandate needs revising' was a constant")
    from lyric_harness import admits, best_score
    lines = song_lines()
    m = R.mandate_from_graph(lines)
    # REPOINTED 2026-08-11 after cell BA's coda-identity fix changed which
    # words band-pass: `does` was a FIFTH call word answering a cross-group
    # PIVOT at L14 that no longer exists (the song's graph is fully disjoint
    # now — see test 14's own note). L14's own group did not change, though
    # — it is still lines (14,16,26,34,36), end words five/drive/of/alive —
    # so the four words IT ACTUALLY MANDATES still reproduce the same shape
    # this test exists to show, and remain a real exemplar rather than a
    # constructed one.
    calls = ["five", "drive", "of", "alive"]              # L14's own group
    old = Reviser(lex=R.lex, decl=R.decl, floor=R.floor,
                  rdecl=ReviseDeclaration(field_band="scalar",
                                          field_depth=200))
    old._engine = R.engine
    o_old, f_old = old.joint_field(calls)
    check("at the old undeclared depth the conjunction looked unsatisfiable",
          not o_old and not f_old,
          "joint_field(['five','drive','of','alive']) was empty, and "
          "the brief printed NO JOINT CANDIDATE -- 'the mandate, not the "
          "line, is what needs revising'")
    o_new, f_new = R.joint_field(calls)
    joint = sorted(set(o_new) | set(f_new))
    check("over the complete pool it is satisfiable, and by real words",
          len(joint) >= 6,
          f"{len(joint)} words answer all four calls: {joint[:8]}")
    for w in joint:
        for c in calls:
            ax, wa = R._word_anchors(c)
            ay, wb = R._word_anchors(w)
            if not admits(best_score(ax, ay, R.decl, wa, wb),
                          R.decl.theta_rhyme):
                FAILURES.append("joint field member fails the grader")
                break
    check("every one of them passes the grader against every call",
          "joint field member fails the grader" not in FAILURES,
          "so the emptiness was a property of `n=200`, not of the lexicon")
    b = [x for x in R.brief(lines, m) if x.line_no == 14]
    check("and the brief at L14 now names a field instead of blaming the "
          "mandate",
          b and not b[0].joint_conflict and (b[0].candidates
                                             or b[0].forbidden_modal),
          f"L14 offered {b[0].candidates}, forbidden "
          f"{b[0].forbidden_modal}" if b else "L14 not flagged")
    check("every brief prints the coordinates its counts are relative to",
          all("field_depth=" in x.field_declaration
              and "field_band=" in x.field_declaration
              for x in R.brief(lines, m)),
          R.field_declaration())


def test_the_four_rejections_on_the_songs_own_shape():
    print("\n20. doctrine 47/94 — the four rejections, on 41 real lines")
    lines = song_lines()
    m = R.mandate_from_graph(lines)
    b33 = [x for x in R.brief(lines, m) if x.line_no == 33][0]

    def sub(idx, text):
        a = list(lines)
        a[idx - 1] = text
        return a

    res = R.verify(lines, [l for i, l in enumerate(lines) if i != 40],
                   m, targeted=[33])
    check("RESTRUCTURE — 41 lines in, 40 out, rejected",
          not res["accepted"] and "line count changed" in res["reasons"][0],
          res["reasons"][0][:100])

    stray = sub(33, "So say the ledger. Say it low")
    stray[40] = "The lamp is out for good"
    res = R.verify(lines, stray, m, targeted=[33])
    check("STRAY — L41 rewritten while only L33 was targeted, rejected",
          not res["accepted"] and "not targeted" in " ".join(res["reasons"]),
          res["reasons"][0][:100])

    modal = [w for w in b33.forbidden_modal
             if w != R.floor.qf._endword(lines[32])]
    check("L33 has a modal word to take", bool(modal),
          str(b33.forbidden_modal))
    res = R.verify(lines, sub(33, f"So say the ledger. Say it {modal[0]}"),
                   m, targeted=[33])
    check("MODAL — L33 takes the most frequent word in its field, rejected",
          not res["accepted"] and res.get("modal_violations"),
          res["reasons"][0][:120])

    res = R.verify(lines, sub(33, "So say the ledger. Say it kitchen"),
                   m, targeted=[33])
    # "kitchen" answers none of L33's mandated partners, so this is a
    # genuine NET-NEGATIVE: fixing the L13/L33 REPEAT this way breaks
    # SCHEME_VIOLATION on TWO separate mandated pairs at once (L33 answers
    # more than one call word) -- a real flag, not the unmandated
    # SCHEME_COLLISION note the gate no longer blocks on (doctrine 7).
    check("NET-NEGATIVE — L33 fixes its REPEAT and breaks its own rhyme "
          "group, rejected",
          not res["accepted"]
          and "new flagged finding" in " ".join(res["reasons"])
          and res.get("new_flags"),
          f"fixed {len(res.get('fixed', []))}, new_flags "
          f"{res.get('new_flags')}: " + res["reasons"][0][:110])

    # and the ACCEPT, so none of the above is an always-reject
    picked = None
    for w in b33.candidates:
        r2 = R.verify(lines, sub(33, f"So say the ledger. Say it {w}"),
                      m, targeted=[33])
        if r2["accepted"]:
            picked = (w, r2)
            break
    check("ACCEPT — an offered candidate is accepted, so the loop is not "
          "an always-reject",
          picked is not None,
          f"{picked[0]!r}: {picked[1]['reasons'][0]}" if picked
          else f"none of {len(b33.candidates)} offered words was accepted")


def test_what_the_loop_can_say_on_the_declared_mandate():
    print("\n21. the mandate the song was WRITTEN to — what comes out")
    import json
    lines = song_lines()
    rep = R.grade(lines, SONG_SCHEME)
    check("the song passes its declared mandate outright",
          rep["pairs_mandated"] == 8 and rep["pairs_judged"] == 8
          and not rep["violations"],
          f"mandated {rep['pairs_mandated']}, judged {rep['pairs_judged']}, "
          f"refused {rep['pairs_refused']}, "
          f"{len(rep['violations'])} violation(s)")
    briefs = R.brief(lines, SONG_SCHEME)
    coll = {f.code for b in briefs for f in b.findings} & COLLISION_FINDINGS
    check("every RHYME-layer finding it emits is a collision, not a defect",
          coll and not any(f.code == "SCHEME_VIOLATION"
                           for b in briefs for f in b.findings),
          f"{len(briefs)} line(s) carry findings; collision codes "
          f"{sorted(coll)}. The length-sensitive floor findings are a "
          f"separate layer and are NOT this cell's (quality/floor.py)")
    check("and NOT ONE collision earns a candidate field",
          not any(b.candidates or b.forbidden_modal or b.forbidden_incumbent
                  for b in briefs
                  if all(f.code in COLLISION_FINDINGS for f in b.findings)),
          "no collision code is in RHYME_FINDINGS, and that is a DECISION "
          "with a measurement behind it, not a gap -- see test 24")
    with open(os.path.join(HERE, "fixtures", "mandate_song.blueprint.json"),
              encoding="utf-8") as fh:
        sec = {i + 1: s["section"]
               for i, s in enumerate(json.load(fh)["lines"])}
    ret = [c for c in rep["collisions"]
           if sec[c["lines"][0]].startswith("chorus")
           and sec[c["lines"][1]].startswith("chorus")
           and sec[c["lines"][0]] != sec[c["lines"][1]]]
    # NOTE THE SHAPE OF THIS ASSERTION. Both the fraction and the exact set
    # are coordinates of the COMPARATOR (doctrine 58/91), which is why
    # neither is pinned to a specific number: a fixture with more filler
    # text around its chorus, or a comparator that moves, changes both
    # without the chorus's own return relationship changing at all. What
    # holds regardless is the DIRECTION of both checks.
    check("the chorus coming back is a substantial share of the collision "
          "set, not a stray edge",
          len(ret) >= 10,
          f"{len(ret)}/{len(rep['collisions'])} join chorus to chorus2. A "
          f"letter scheme cannot say 'these two groups are the same words', "
          f"so it gives them different letters -- and the collision detector "
          f"then reports the identity the projection was forced to hide "
          f"(doctrine 2)")
    gm_edges = {(i, j) for mg in R.group_merges(lines, SONG_SCHEME)
               for i, j, *_ in mg["edges"]}
    # NON-EMPTY, AND THE DETAIL LINE ALREADY SAID SO — 2026-08-15. This was
    # `gm_edges <= {...}` alone, and `set() <= anything` is True: a detector
    # that recovers NOTHING satisfies the containment perfectly. Measured
    # with `group_merges` returning `[]`, this check passed while three
    # sibling assertions failed -- so the suite was not blind, but the one
    # assertion naming the detector's RECALL was the one that could not see
    # it. The count is in the message below; it belongs in the condition.
    check("and every edge the merge detector recovers, from the GRAPH alone "
          "with no blueprint and no section name, is genuinely among those "
          "collisions",
          gm_edges and gm_edges <= {tuple(c["lines"]) for c in ret},
          f"{len(gm_edges)} merge edges, all present in the {len(ret)} "
          f"chorus-crossing collisions. The section labels above come from "
          f"the blueprint; `group_merges` never reads it -- it asks whether "
          f"two mandated groups would pass as ONE. (The reverse containment "
          f"does not hold here: a few OTHER end-word pairs across the two "
          f"choruses also happen to collide without belonging to the same "
          f"merged group -- a property of this fixture's incidental word "
          f"choices, not of the merge detector.)")
    check("some of them are outright REPEAT, the refrain itself",
          sum(1 for c in ret if c["relation"] == "REPEAT") >= 4,
          f"{sum(1 for c in ret if c['relation'] == 'REPEAT')} of the "
          f"chorus's returns are an IDENTICAL end word. Doctrine 3 calls "
          f"REPEAT the REQUIREMENT across chorus instances, and "
          f"`repeat_licence` defaults to 'unlicensed', so the derived-cover "
          f"run reports them as SCHEME_VIOLATIONs -- "
          f"see RESULTS_REVISION_LOOP.md §5")


def test_the_collision_set_is_partitioned_not_silenced():
    print("\n23. the collision set, partitioned — layer, not line")
    import dataclasses
    lines = song_lines()
    m = SC.mandate(SONG_SCHEME)
    rep = R.grade(lines, m)
    ins = R.inspect(lines, m)
    edges = {tuple(c["lines"]) for c in rep["collisions"]}

    # (1) ABSORBS AND NEVER ADDS. The guard that keeps the rule from
    # volunteering an opinion about a rhyme the writer did not make.
    merged = {(i, j) for mg in ins["merges"] for i, j, *_ in mg["edges"]}
    check("every edge a merge absorbs was ALREADY a collision",
          merged <= edges,
          f"{len(merged)} absorbed of {len(edges)} collisions; "
          f"{len(merged - edges)} invented")

    # (2) EXACT PARTITION. Nothing dropped, nothing double-counted.
    off = Reviser(rdecl=ReviseDeclaration(group_merge="off"))
    per_off = off.inspect(lines, m)["per_line"]
    kept = {tuple(f.locations) for fs in ins["per_line"].values() for f in fs
            if f.code in COLLISION_FINDINGS}
    allc = {tuple(f.locations) for fs in per_off.values() for f in fs
            if f.code in COLLISION_FINDINGS}
    check("merged + residual = the whole collision set, exactly",
          allc == edges and kept | merged == edges and not (kept & merged),
          f"{len(merged)} absorbed into {len(ins['merges'])} mandate "
          f"finding(s) + {len(kept)} left on lines = {len(edges)}")

    # (3) THE SET IS UNCHANGED. Typing a finding is not moving a threshold.
    cs = check_scheme(R.lex, lines, SONG_SCHEME, R.decl)
    # `check_scheme`'s own tuple carries `relation` as a 5th element since
    # 2026-08-11 (the report-layer fix cell BA's own patches file names),
    # so unpacking as 4 raises ValueError now -- unpack 5 and ignore the two
    # trailing fields, since this check is only about which PAIRS collide.
    check("and it is still exactly `check_scheme`'s set — no drift",
          {(a, b) for a, b, _, _, _ in cs["collisions"]} == edges,
          f"{len(edges)} pairs, THETA_COLLISION={THETA_COLLISION} on both "
          f"sides. What changed is what each member is CALLED, and "
          f"`group_merge='off'` reproduces the old one-code rendering")

    # (4) TYPED BY RELATION — doctrine 3, identity is not rhyme.
    by = {}
    for fs in per_off.values():
        for f in fs:
            if f.code in COLLISION_FINDINGS:
                by[f.code] = by.get(f.code, 0) + 1
    near = by.get("NEAR_COLLISION", 0)
    check("a near-relation is no longer reported as an unintended RHYME",
          near > 0 and all(
              R._collision_code(c["relation"]) == "NEAR_COLLISION"
              for c in rep["collisions"] if c["relation"] in NEAR_RELATIONS),
          f"{by} -- {near} of {len(edges)} collisions are pairs `grade()` "
          f"would call a VIOLATION if they were mandated, because the "
          f"collision cut is the scalar alone and the mandate cut is "
          f"`admits()`. RESULTS_REVISION_LOOP.md §1's defect, second site")
    check("and the draft says so ONCE, not once per pair",
          sum(1 for f in ins["whole"]
              if f.code == "COLLISION_CUT_IS_SCALAR_ONLY") == 1)

    # (5) IT DOES NOT DECIDE THAT A RETURN HAPPENED. With no declared
    # returns the merge is DERIVED and names both readings; with them it is
    # DECLARED. Same graph, different sentence — because intent is not in it.
    check("with no declared return the merge is DERIVED and asks",
          all(not mg["declared"] for mg in ins["merges"])
          and any(f.code == "MANDATE_GROUPS_INDISTINGUISHABLE"
                  for f in ins["whole"]),
          f"{len(ins['merges'])} merges, none claiming to be a refrain")
    dm = dataclasses.replace(m, returns=tuple(
        SC.Return(lines=pair) for pair in
        ((13, 33), (17, 37), (15, 35), (18, 38), (19, 39))))
    dins = R.inspect(lines, dm)
    got = [f.code for f in dins["whole"]
           if f.code.startswith(("GROUPS_DECLARED", "MANDATE_GROUPS"))]
    check("and when `Mandate.returns` states it, the SAME edges become the "
          "FORM (the sibling contract in quality/schemes.py, read not "
          "duplicated)",
          got.count("GROUPS_DECLARED_RETURN") == 3
          and got.count("MANDATE_GROUPS_INDISTINGUISHABLE") == 0,
          f"{got} -- A/E, C/G and D/H are declared; B[14,16]/F[34,36] cross-"
          f"collides with NEITHER of its counterparts at all (L14 ends "
          f"'night', L34 ends 'flame' -- not even an accidental near-rhyme), "
          f"so it never reaches `group_merges`'s gate in either reading. The "
          f"chorus's fourth line is the one that MOVES, and moves furthest")

    # (6) `verify` did not lose resolution when merges went to `whole`.
    a = list(lines)
    a[36] = "I don't get to leave"          # L37 'go' -> 'leave'
    res = R.verify(lines, a, m, targeted=[37])
    check("dissolving ONE of four merges is visible to verify()",
          any(x[1] == "MANDATE_GROUPS_INDISTINGUISHABLE"
              for x in res.get("fixed", [])),
          f"fixed {res.get('fixed')}. A whole finding used to key on "
          f"`(0, code)`, so four of a kind collapsed to one and a revision "
          f"that dissolved one would have been told 'nothing was fixed'")


def test_why_a_collision_earns_no_field():
    print("\n24. the decision: a collision earns no candidate field")
    n = len(R.engine.index)
    rows = []
    for w in ("does", "ear", "will", "floor"):
        f = R._field_one(w)
        rows.append((w, len(f), n - len(f)))
    worst = min(r[2] / n for r in rows)
    check("a collision's constraint is NEGATIVE, and its satisfying set is "
          "the dictionary",
          worst > 0.95,
          "; ".join(f"{w}: rhyme field {a}, NOT-rhyme {b} "
                    f"({100.0 * b / n:.2f}% of {n})" for w, a, b in rows)
          + ". `joint_field` intersects POSITIVE calls and gets a set a "
            "writer can read; the complement of one is a copy of the "
            "lexicon, so there is no field to hand over")
    top = sorted(R.lex.freq_rank, key=lambda w: R.lex.freq_rank[w])[:6]
    check("and doctrine 9's mechanism on top of it forbids the six commonest "
          "words in English",
          all(t in ("you", "i", "the", "to", "a", "'s") for t in top),
          f"the modal head of ~98% of the lexicon is {top} (WIRED "
          f"2026-08-11: lex.freq_rank now reads data/opensubtitles_en_50k."
          f"tsv, not the old web crawl). The modal exclusion exists to push "
          f"a writer off the predictable RHYME; over a negative constraint "
          f"it has no rhyme class to be modal IN, at ANY frequency "
          f"distribution -- and a collision has no call word, so the "
          f"call-conditional table `joint_field` now prefers has nothing to "
          f"be consulted on either. The defect is the POLARITY of the "
          f"constraint, not the ranking over it")
    lines = song_lines()
    briefs = R.brief(lines, SONG_SCHEME)
    only = [b for b in briefs
            if b.findings and all(f.code in COLLISION_FINDINGS
                                  for f in b.findings)]
    check("so a line whose only findings are collisions is briefed with no "
          "words at all — and doctrine 7 is the second reason",
          only and not any(b.candidates or b.forbidden_modal
                            or b.forbidden_incumbent for b in only),
          f"{len(only)} such line(s). The loop is a FLOOR: rejection, not "
          f"selection. A collision on a draft with zero violations is not a "
          f"rejection, so offering replacements would be ordering the "
          f"permitted region -- and would make the harness decide that an "
          f"unmandated rhyme is a defect, which is often the best thing in "
          f"a song")


def test_the_modal_set_against_a_declared_reference():
    print("\n22. doctrine 94 — what the FORBIDDEN words actually are")
    from lyric_harness import line_anchors
    lines = song_lines()
    m = R.mandate_from_graph(lines)

    def tail(w):
        a, _, _ = line_anchors(R.lex, w, promote=R._promote())
        return (a[0][-1]["nucleus"], tuple(a[0][-1]["coda"])) if a and a[0] \
            else None

    seen, tot, ident = set(), 0, 0
    for b in R.brief(lines, m):
        calls = tuple(dict.fromkeys(
            w for _, _, cl in b.must_answer for _, w in cl if w))
        if not calls or calls in seen:
            continue
        seen.add(calls)
        cur = R.floor.qf._endword(b.text)
        for w in b.forbidden_modal:
            if w == cur:
                continue
            tot += 1
            if all(tail(c) is not None and tail(c) == tail(w) for c in calls):
                ident += 1
    check("the modal set is real: it is the head of the grader's own field",
          tot >= 40, f"{tot} forbidden words over {len(seen)} distinct fields")
    # WIRED 2026-08-11: the ranking is now primarily the call-conditional
    # table, whose entries ARE realised rhyme pairs by construction (see
    # quality/build_song_frequency.py's rime_key). So the forbidden set
    # shifting from a MINORITY strict-identity share (under the old global
    # word-count ranking) to a much larger one is the fix working as
    # intended -- doctrine 9 wants the exclusion pointed at the rhyme a
    # writer actually reaches for, not merely a common word. A residual
    # share below 100% is still expected and correct (doctrine 94: the band
    # exists to admit slant rhyme, and the conditional's own backoff to
    # freq_rank for unobserved candidates keeps some non-identity words in
    # the forbidden set), so the bar here is the OLD threshold's mirror
    # image rather than a claim of near-total identity.
    check("and now AT LEAST A QUARTER of it is a strict-identity rhyme, up "
          "from the old mechanism's under-a-quarter",
          ident * 4 >= tot,
          f"{ident}/{tot} ({100.0 * ident / tot:.1f}%) of the words "
          f"doctrine 9 names as the slop direction agree with their call on "
          f"the tail-aligned nucleus AND coda by strict identity. The "
          f"reference is declared as a REFERENCE, not as truth (doctrine "
          f"94) -- the band exists to admit slant rhyme, and the fraction "
          f"is not 100% because the conditional table is sparse and falls "
          f"back to freq_rank for candidates it has no data on. What the "
          f"residual non-identity share prices, unchanged from before: on "
          f"group H six forbidden words include will/their/there/here/year/"
          f"email against 'ear' when the conditional has no data for it, "
          f"because cluster_sim(['R'],['L']) = 0.9875, so the conjunctive "
          f"coda rule cannot separate a lateral coda from a rhotic one, and "
          f"no value of theta_coda reaches it. Not this cell's file to fix")


def test_meter_folds_into_the_same_finding_set():
    print("\n25. the METER layer joins rhyme in ONE finding set, no new veto")
    lines = song_lines()
    m = R.mandate_from_graph(lines)

    check("with no blueprint, nothing changes",
          R.inspect(lines, m) == R.inspect(lines, m),
          "meter is opt-in: omitting `blueprint=` leaves brief/inspect/"
          "verify exactly as they were before this test existed")

    found_no_sub = R.inspect(lines, m, blueprint=SONG_BLUEPRINT)
    whole_codes = {w.code for w in found_no_sub["whole"]}
    check("a blueprint with NO declared subdivision reports ONCE, not "
          "per line",
          {"NO_SUBDIVISION", "NO_SETTING"} <= whole_codes,
          f"whole-draft codes: {sorted(whole_codes)}")
    settings_notes = [w for w in found_no_sub["whole"]
                      if w.code in ("NO_SUBDIVISION", "NO_SETTING")]
    check("...covering all 41 lines each, exactly once",
          all(len(w.locations) == 41 for w in settings_notes),
          [(w.code, len(w.locations)) for w in settings_notes])

    sub = FT.Subdivision(slots_per_pulse=2,
                         source="test_revise.py test 25, a declared choice "
                                "for this fixture only")
    found = R.inspect(lines, m, blueprint=SONG_BLUEPRINT, subdivision=sub)
    unsat = sorted(ln for ln, fs in found["per_line"].items()
                   for f in fs if f.code == "SLOTS_EXCEEDED")
    check("at this declared subdivision, the same 16 lines the `fit` CLI "
          "verb reports as UNSATISFIABLE come back as hard FLAGS here",
          unsat == [13, 14, 15, 16, 17, 18, 19, 20,
                    33, 34, 35, 37, 38, 39, 40, 41],
          f"got {unsat} -- cross-checked against `python3 lyric_harness.py "
          f"fit quality/fixtures/mandate_song.blueprint.json "
          f"--subdivision 2`, which prints UNSAT 8+7+1=16 over chorus/"
          f"chorus2/outro")
    check("every SLOTS_EXCEEDED lands as severity=flag, never note",
          all(f.severity == "flag" for ln, fs in found["per_line"].items()
              for f in fs if f.code == "SLOTS_EXCEEDED"),
          "fit.py's OWN satisfiable=False is what decides this -- this "
          "module keeps no second opinion about which findings are hard")
    check("the softer prominence findings land as notes, not flags",
          all(f.severity == "note" for ln, fs in found["per_line"].items()
              for f in fs if f.code in ("PROMINENCE_EXCEEDS_HEADS",
                                        "PROMINENCE_CANNOT_ALIGN",
                                        "HEADS_EXCEED_UNITS")),
          "not mathematically impossible -- a style call the loop reports "
          "and does not force")

    # doctrine 47, arriving at meter with NO new code: fix line 1's SLOTS
    # finding is absent before the edit (verified above it is not in
    # `unsat`), so lengthen it past its bar's capacity while targeting a
    # real flagged rhyme line, and the EXISTING net-negative diff must catch
    # it -- this is the whole of what "wire meter into the loop" means.
    after = list(lines)
    after[0] = (lines[0] + " today and every single morning after that as "
                "well, over and over again without end")
    res = R.verify(lines, after, m, targeted={1}, blueprint=SONG_BLUEPRINT,
                   subdivision=sub)
    check("a revision that overflows a bar is REJECTED by the SAME rule "
          "that rejects breaking a rhyme -- no meter-specific veto exists",
          not res["accepted"]
          and (1, "SLOTS_EXCEEDED") in res["new"],
          res["reasons"][0][:160])

    try:
        R._meter_findings(lines[:-1], SONG_BLUEPRINT, sub)
        ok = False
    except ValueError:
        ok = True
    check("a blueprint/draft line-count mismatch REFUSES rather than "
          "silently misaligning",
          ok, "position-based correlation with no length check would "
              "attribute every finding after the first difference to the "
              "wrong line")


def test_grade_asks_the_mandate_before_the_switch():
    print("\n26. BUG FIX — a declared verbatim return is not a REPEAT "
         "violation, and grade() now asks the mandate to find that out")
    m = SC.mandate(SC.REFRAIN_FORMS["villanelle"])
    rep = R.grade(VILLANELLE, m)
    check("the correct villanelle has ZERO violations",
          rep["violations"] == [],
          f"{len(rep['violations'])} violation(s); BEFORE this fix the "
          f"default repeat_licence='unlicensed' flagged all 12 refrain-pair "
          f"REPEATs (C(4,2)=6 pairs per 4-line return, A1 and A2) as "
          f"violations, because grade() applied one song-wide switch "
          f"instead of asking the mandate")
    check("mandated/judged agree — nothing was silently dropped, only "
          "reclassified",
          (rep["pairs_mandated"], rep["pairs_judged"]) == (93, 93))

    found = R.inspect(VILLANELLE, m)
    refrain_notes = [(ln, f) for ln, fs in found["per_line"].items()
                     for f in fs if f.code == "REFRAIN_REPEAT"]
    check("all 12 refrain-pair REPEATs (C(4,2)=6 pairs x 2 returns) are "
          "reported as licensed NOTES, sourced to the MANDATE, not to the "
          "(unset) rdecl switch",
          len(refrain_notes) == 12
          and all(f.severity == "note" and "MANDATE requires this" in
                  f.evidence for _, f in refrain_notes),
          [(ln, f.evidence[:50]) for ln, f in refrain_notes[:2]])

    drifted = list(VILLANELLE)
    drifted[17] = "The tide comes in and steals the sand away"   # was L18
    d_found = R.inspect(drifted, m)
    broken = [(ln, f) for ln, fs in d_found["per_line"].items()
             for f in fs if f.code == "RETURN_NOT_VERBATIM"]
    check("a BROKEN return is flagged — one finding per pair the drifted "
          "line was in (L18 vs its 3 A1 co-members)",
          len(broken) == 3 and all(f.severity == "flag" for _, f in broken)
          and all(ln == 18 for ln, _ in broken),
          [f.message[:70] for _, f in broken])

    res = R.verify(VILLANELLE, drifted, m, targeted={18})
    check("verify()'s EXISTING net-negative diff — the same one meter "
          "rides in test 25 — catches the broken return with NO new "
          "veto rule",
          not res["accepted"] and (18, "RETURN_NOT_VERBATIM") in res["new"],
          res["reasons"])

    check("a PLAIN letter scheme (no Return objects) is completely "
          "unaffected — the fallback to rdecl.repeat_licence still "
          "applies exactly as before this fix",
          R.grade(["a cat sat on the mat", "a cat sat on the mat",
                  "a bird flew off the sill", "a bird flew off the sill"],
                 "AABB")["violations"].__len__() == 2,
          "AABB with two identical-word pairs and NO declared mandate "
          "returns still reports both as violations under the default "
          "'unlicensed' setting")


def test_song_function_folds_into_the_same_finding_set():
    print("\n27. `quality/grid.py`'s FUNCTION layer joins rhyme and meter in "
         "ONE finding set — a blueprint section's `function` and a "
         "blueprint's `hooks` have always been readable and nothing past "
         "`fit.py` ever read them")
    lines = moonlight_lines()
    m = R.mandate_from_graph(lines)

    no_bp = {w.code for w in R.inspect(lines, m)["whole"]}
    check("with no blueprint, no song-function code appears at all",
          not (no_bp & {"HOOK_ABSENT", "HOOK_CONFINED", "HOOK_DOES_NOT_RECUR",
                       "TITLE_NOT_IN_HOOK", "RETURN_LOCKED",
                       "RETURNS_WITH_SAME_WORDS", "RETURN_LENGTH_DRIFT",
                       "BRIDGE_IS_A_VERSE", "FUNCTION_UNDECLARED"}),
          sorted(no_bp))

    found = R.inspect(lines, m, blueprint=MOONLIGHT_BLUEPRINT)
    whole = {w.code: w for w in found["whole"]}
    check("the clean draft reports RETURN_LOCKED — three verbatim choruses "
          "in an identical slot — as a NOTE, not a flag",
          "RETURN_LOCKED" in whole and whole["RETURN_LOCKED"].severity
          == "note", sorted(whole))
    check("and HOOK_CONFINED — the hook never leaves the chorus — also a "
          "NOTE: a measurement against `POPULAR_SONG`, a labelled "
          "CONVENTION, not a mandate the writer declared (doctrine 6)",
          "HOOK_CONFINED" in whole
          and whole["HOOK_CONFINED"].severity == "note")
    check("no HOOK_ABSENT on the clean draft — the declared hook is right "
          "there, three times", "HOOK_ABSENT" not in whole)

    # Break the hook: all three occurrences rewritten, nothing else touched.
    hook_line = "we counted every reason we were given to keep counting"
    changed_lines = {i + 1 for i, l in enumerate(lines) if l == hook_line}
    check("the fixture actually contains the hook 3 times, or this proves "
          "nothing", len(changed_lines) == 3, sorted(changed_lines))
    # a replacement chosen to introduce no OTHER finding (no shared opening
    # word, no forbidden modal candidate) so this exercises the net-negative
    # diff itself rather than being intercepted by an unrelated rule.
    after = [("riders crossed the bridge without a sound"
             if l == hook_line else l) for l in lines]
    broken = R.inspect(after, m, blueprint=MOONLIGHT_BLUEPRINT)
    b_whole = {w.code: w for w in broken["whole"]}
    check("HOOK_ABSENT now fires, as a FLAG — the writer supplied exact "
          "hook TEXT and it is a factual question with no convention in "
          "it, the same shape RETURN_NOT_VERBATIM already is",
          "HOOK_ABSENT" in b_whole
          and b_whole["HOOK_ABSENT"].severity == "flag", sorted(b_whole))

    res = R.verify(lines, after, m, targeted=changed_lines,
                   blueprint=MOONLIGHT_BLUEPRINT)
    check("verify()'s EXISTING net-negative diff — the same one meter (test "
          "25) and RETURN_NOT_VERBATIM (test 26) both ride — rejects "
          "erasing the hook, with NO new veto rule",
          not res["accepted"] and (0, "HOOK_ABSENT") in res["new"],
          res["reasons"])

    # THE STALENESS PROOF: `_function_findings` must grade THIS DRAFT's
    # words, never the blueprint's own stored text -- `compare_returns` and
    # `hook_occurrences` both read `Line.text`, and a stale copy would
    # silently stop reacting to every revision after the first one.
    stale_hook_obj = {
        "title": "T", "hooks": ["shine on"],
        "sections": [{"name": "v", "bars": 4, "function": "verse",
                     "meter": {"beats": 4, "unit": 4}},
                    {"name": "c", "bars": 4, "function": "chorus",
                     "meter": {"beats": 4, "unit": 4}}],
        # the BLUEPRINT's own stored text carries the hook in the verse and
        # nowhere else -- if this method ever reads THIS text instead of
        # the draft handed to `inspect`, the assertions below invert.
        "lines": [{"text": "shine on", "bar": 1, "section": "v"},
                 {"text": "shine on", "bar": 2, "section": "v"},
                 {"text": "a decoy line the blueprint stored", "bar": 5,
                  "section": "c"},
                 {"text": "another decoy the blueprint stored", "bar": 6,
                  "section": "c"}]}
    draft_with_hook_moved = [
        "a brand new verse line with no hook in it",
        "a second brand new verse line, still no hook",
        "shine on", "shine on"]
    dm = R.mandate_from_graph(draft_with_hook_moved)
    moved = {w.code for w in
             R.inspect(draft_with_hook_moved, dm,
                      blueprint=stale_hook_obj)["whole"]}
    check("the hook is found where THIS DRAFT put it, not where the "
          "blueprint's stored text put it",
          "HOOK_ABSENT" not in moved, sorted(moved))

    draft_hook_removed = [
        "a brand new verse line with no hook in it",
        "a second brand new verse line, still no hook",
        "a brand new chorus line, still no hook",
        "a second brand new chorus line, still none"]
    dr = R.mandate_from_graph(draft_hook_removed)
    removed = {w.code for w in
              R.inspect(draft_hook_removed, dr,
                       blueprint=stale_hook_obj)["whole"]}
    check("and REMOVING the hook from the draft is seen even though the "
          "blueprint's own stored text still carries it verbatim",
          "HOOK_ABSENT" in removed, sorted(removed))


def test_blueprint_declared_says_whether_meter_was_asked():
    print("\n28. `blueprint_declared` — a caller reading inspect()/verify()'s "
         "own returned dict, without the call site in view, can tell "
         "'meter is clean' from 'meter was never asked'")
    lines = song_lines()
    m = R.mandate_from_graph(lines)

    no_bp = R.inspect(lines, m)
    check("omitted blueprint: the key says so",
          no_bp["blueprint_declared"] is False)
    check("...and it is not smuggled into `whole` as a Finding — omitting "
          "an OPT-IN layer is the ordinary case, not a defect on the draft",
          not any("BLUEPRINT" in f.code for f in no_bp["whole"]))

    with_bp = R.inspect(lines, m, blueprint=SONG_BLUEPRINT)
    check("declared blueprint: the key says so",
          with_bp["blueprint_declared"] is True)
    check("...present ALONGSIDE the meter/function findings it now carries, "
          "not instead of them",
          len(with_bp["whole"]) > len(no_bp["whole"]),
          f"{len(no_bp['whole'])} -> {len(with_bp['whole'])}")

    v_no_bp = R.verify(lines, lines, m)
    check("verify() carries the same key when no blueprint is passed",
          v_no_bp["blueprint_declared"] is False)
    v_with_bp = R.verify(lines, lines, m, blueprint=SONG_BLUEPRINT)
    check("...and flips to True with one, on the SAME lines both sides",
          v_with_bp["blueprint_declared"] is True)

    # doctrine 47 in miniature: the key is metadata about the CALL, not a
    # Finding that could appear on one side of a diff and not the other, so
    # it cannot perturb `fixed`/`new` — verified directly against test 25's
    # own accepted revision rather than asserted in the abstract here.
    after = list(lines)
    after[0] = (lines[0] + " today and every single morning after that as "
                "well, over and over again without end")
    sub = FT.Subdivision(slots_per_pulse=2,
                         source="test_revise.py test 28, reusing test 25's "
                                "own rejected revision")
    res = R.verify(lines, after, m, targeted={1}, blueprint=SONG_BLUEPRINT,
                   subdivision=sub)
    check("the same rejection test 25 exercises still rejects, with the "
          "new key just along for the ride",
          not res["accepted"] and res["blueprint_declared"] is True,
          res["reasons"][0][:120])

    # brief() does NOT surface the key — it is a per-line Brief list, and
    # whether meter was asked is a whole-draft fact. Call inspect() for it
    # (see brief()'s own docstring).
    briefs = R.brief(lines, m, blueprint=SONG_BLUEPRINT)
    check("brief()'s own objects carry no such attribute — by design, not "
          "by oversight",
          bool(briefs) and not hasattr(briefs[0], "blueprint_declared"))


def test_modal_rhyme_fires_on_a_passing_pair():
    print("\n29. `MODAL_RHYME` asks doctrine 9's own question of a pair "
         "that never failed anything — FOUND MISSING by measuring two real "
         "songs' worth of rhymes that all passed grade() cleanly against "
         "modal_field() after the fact: half were the #1 or #2 ranked "
         "candidate, and nothing had ever asked")
    modal = ["he laid it down and made his claim,",
             "an old and worn and common name."]
    fresh = ["he laid it down and made his claim,",
             "a wolf that time had long since made tame."]
    m = SC.mandate([[1, 2]], n_lines=2)

    res_modal = R.inspect(modal, m)
    hits_modal = [f for fs in res_modal["per_line"].values()
                 for f in fs if f.code == "MODAL_RHYME"]
    check("claim/name -- the single most frequent realised partner for "
          "'claim' -- fires MODAL_RHYME even though the pair rhymes and "
          "the mandate is satisfied",
          bool(hits_modal), hits_modal[0].evidence if hits_modal else "")

    res_fresh = R.inspect(fresh, m)
    hits_fresh = [f for fs in res_fresh["per_line"].values()
                 for f in fs if f.code == "MODAL_RHYME"]
    check("claim/tame -- not in the top-6 forbidden set either direction, "
          "verified against modal_field('claim') directly -- stays silent",
          not hits_fresh)

    check("MODAL_RHYME is a note, not a flag -- it discloses, it does not "
          "reject: doctrine 7 is a floor, and ordering an already-"
          "satisfied mandate's permitted region is the one thing a floor "
          "may not do",
          hits_modal[0].severity == "note")

    rd0 = ReviseDeclaration(modal_exclusion=0)
    R0 = Reviser(rdecl=rd0)
    res_off = R0.inspect(modal, m)
    hits_off = [f for fs in res_off["per_line"].values()
               for f in fs if f.code == "MODAL_RHYME"]
    check("modal_exclusion=0 silences this exactly the way it silences "
          "the reactive check -- one declared coordinate, not a second "
          "switch",
          not hits_off)

    briefs = R.brief(modal, m)
    on_l2 = next((b for b in briefs if b.line_no == 2), None)
    check("the line carrying MODAL_RHYME earns a real candidate field, "
          "not just a citation -- doctrine 9's whole point is to hand "
          "back an alternative",
          on_l2 is not None and bool(on_l2.candidates),
          on_l2.candidates[:8] if on_l2 else "no Brief for L2")
    check("'name' itself -- the very word MODAL_RHYME is about -- is not "
          "offered back as its own replacement",
          on_l2 is not None and "name" not in on_l2.candidates)


#: FOUR LINES AND THREE OVERLAPPING GROUPS, built for tests 30-31. `mat` and
#: `moon` do not rhyme; `mat`/`hat` and `moon`/`spoon` do. So a mandate that
#: puts L1 and L2 in one group ALWAYS fails that group, and whether L1 and L2
#: each have another group they answer is the only thing the disjunctive
#: reading turns on — which is exactly what has to be varied to find out what
#: the excusal is testing.
OVERLAP = ["the cat sat on the mat",
           "the dog ran to the moon",
           "the rat wore a hat",
           "the pig danced with a spoon"]
#: A fails (mat/moon); L1 answers B, L2 answers C. BOTH endpoints excused.
OVERLAP_BOTH = [[1, 2], [1, 3], [2, 4]]
#: A fails; L1 answers B; L2 IS IN NO OTHER GROUP. Nothing may be excused.
OVERLAP_ONE = [[1, 2], [1, 3]]


def _find(res, code):
    """Every Finding of `code` in an inspect() result, per-line and whole."""
    return ([f for fs in res["per_line"].values() for f in fs
             if f.code == code]
            + [f for f in res["whole"] if f.code == code])


def test_return_out_of_range_names_a_case_it_cannot_be_given():
    print("\n30. `RETURN_OUT_OF_RANGE` — the code fires, and NOT on the case "
          "its message names: reached only by going around the constructor "
          "that exists to refuse it")
    import dataclasses
    from quality.schemes import Return
    base = SC.mandate([[1, 3], [2, 4]], n_lines=4)

    # THE CONSTRUCTOR REFUSES THE INPUT. `_normalise_returns` validates every
    # return line against 1..n_lines, so no mandate built the declared way can
    # carry the return this code reports on.
    try:
        SC.mandate([[1, 3], [2, 4]], n_lines=4, returns=[[1, 9]])
        refused_return = ""
    except NoMandate as e:
        refused_return = str(e)
    check("quality.schemes.mandate REFUSES an out-of-range return line "
          "rather than building a mandate that carries one",
          "outside" in refused_return, refused_return[:80])

    # AND THE CASE THE MESSAGE NAMES IS REFUSED SEVERAL FRAMES EARLIER.
    # `returns_check`'s own text is "the mandate declares N lines and M were
    # given" — a LENGTH MISMATCH between mandate and draft. `Reviser.mandate`
    # is `SC.mandate(spec, n_lines=len(lines))`, which raises on exactly that,
    # so no call to `inspect()` can ever reach this code by that route.
    five = SC.mandate([[1, 3], [2, 4]], n_lines=5)
    try:
        R.mandate(OVERLAP, five)
        refused_len = ""
    except NoMandate as e:
        refused_len = str(e)
    check("a draft shorter than its mandate — the condition the message "
          "NAMES — is a refusal in Reviser.mandate(), so inspect() never "
          "reaches RETURN_OUT_OF_RANGE that way",
          "5 lines and the draft has 4" in refused_len, refused_len[:70])

    # WHAT DOES REACH IT: a Mandate assembled by hand, around the normaliser.
    # `Mandate.return_pairs`'s own docstring documents hand-built `returns` as
    # an accepted shape, so this is a real caller path and not a contrivance.
    hand = dataclasses.replace(base, returns=(Return(lines=(1, 9), label="R1",
                                                     verbatim=True),))
    res = R.inspect(OVERLAP, hand)
    oor = _find(res, "RETURN_OUT_OF_RANGE")
    check("a hand-built Mandate whose Return names a line outside its OWN "
          "1..n_lines DOES reach the code — this is the only input that can",
          len(oor) == 1, oor[0].message if oor else "not emitted")
    check("it is a note: an unasked question is not a defect in the DRAFT",
          bool(oor) and oor[0].severity == "note")
    check("and it carries EVIDENCE — empty until 2026-08-13, because "
          "`_KIND_GLOSS` has no OUT_OF_RANGE row (it is not a variation "
          "kind at all) and the lookup silently returned ''",
          bool(oor) and "NOT CHECKED" in oor[0].evidence,
          oor[0].evidence[:90] if oor else "")
    check("the evidence names the in-range line, since the message names "
          "the wrong condition",
          bool(oor) and oor[0].locations == [1],
          str(oor[0].locations) if oor else "")

    # NEGATIVE CONTROL, on the same call: a return whose lines are both in
    # range takes the OTHER branch of the same loop.
    ok = dataclasses.replace(base, returns=(Return(lines=(1, 3), label="R1",
                                                    verbatim=True),))
    res_ok = R.inspect(OVERLAP, ok)
    check("an IN-RANGE verbatim return emits no RETURN_OUT_OF_RANGE at all",
          not _find(res_ok, "RETURN_OUT_OF_RANGE"))
    check("...and reaches the sibling branch instead, so the loop over "
          "returns_check() is exercised in both directions",
          bool(_find(res_ok, "RETURN_NOT_VERBATIM")))


def test_excused_by_overlap_is_a_per_line_condition():
    print("\n31. `MANDATE_EXCUSED_BY_OVERLAP` — the disjunctive reading is "
          "stated per LINE ('answer at least one of YOUR groups') and was "
          "implemented per PAIR, so a line in ONE group had its ONLY "
          "obligation dropped because its PARTNER was a pivot")
    dis = Reviser(lex=R.lex, decl=R.decl, floor=R.floor,
                  rdecl=ReviseDeclaration(overlap_rule="disjunctive"))
    dis._engine = R.engine
    m_both = SC.mandate(OVERLAP_BOTH, n_lines=4)
    m_one = SC.mandate(OVERLAP_ONE, n_lines=4)

    # THE DEFAULT IS UNTOUCHED. `excused` is populated only inside the
    # disjunctive branch, so a conjunctive run cannot emit this code at all.
    for name, mm in (("both-pivot", m_both), ("one-sided", m_one)):
        conj = R.inspect(OVERLAP, mm)
        check(f"conjunctive ({name}): L1/L2 is a SCHEME_VIOLATION flag and "
              f"nothing is excused",
              not _find(conj, "MANDATE_EXCUSED_BY_OVERLAP")
              and any(f.severity == "flag"
                      for f in _find(conj, "SCHEME_VIOLATION")))

    # REACHED: both endpoints answer another of their OWN groups.
    res = dis.inspect(OVERLAP, m_both)
    ex = _find(res, "MANDATE_EXCUSED_BY_OVERLAP")
    check("disjunctive, both endpoints pivots: the code fires",
          len(ex) == 1, ex[0].message if ex else "not emitted")
    check("it is a note — the mandate was relaxed by a declared coordinate, "
          "which is a disclosure and not a defect on the draft",
          bool(ex) and ex[0].severity == "note")
    check("and the flag it replaces is gone: this is the SAME pair, graded "
          "under the other reading",
          not _find(res, "SCHEME_VIOLATION"))
    check("the evidence names WHICH group excused WHICH line — the finding "
          "said neither until 2026-08-13, on the one reading where a line "
          "having more than one group is the whole subject (doctrine 2)",
          bool(ex) and "L1 answers B" in ex[0].evidence
          and "L2 answers C" in ex[0].evidence,
          ex[0].evidence[:80] if ex else "")
    rep = dis.grade(OVERLAP, m_both)
    check("grade() carries the same per-line reason in `excused_by`, so a "
          "caller reading the dict alone can see it too",
          rep["excused"] and rep["excused"][0].get("excused_by")
          == {1: ["B"], 2: ["C"]},
          str(rep["excused"][0].get("excused_by")) if rep["excused"] else "")

    # THE FIX, AND IT FAILS BEFORE IT. Drop C. L2 is now in exactly one
    # group; the pair still fails; the old rule excused it anyway because L1
    # (the pivot) answered B. L2 then answered NOTHING and no flag said so —
    # doctrine 20's vacuous pass, at the line, inside the module written to
    # close it.
    res1 = dis.inspect(OVERLAP, m_one)
    check("disjunctive, L2 in ONE group: NOTHING is excused — a line with no "
          "other group to answer has no 'rest' to be excused from",
          not _find(res1, "MANDATE_EXCUSED_BY_OVERLAP"))
    check("...and the violation stands as a FLAG, so the loop still asks for "
          "the revision L2 owes its only group",
          any(f.severity == "flag"
              for f in _find(res1, "SCHEME_VIOLATION")))
    rep1 = dis.grade(OVERLAP, m_one)
    check("grade() agrees: one violation, none excused",
          len(rep1["violations"]) == 1 and not rep1["excused"],
          f"{len(rep1['violations'])} violation(s), "
          f"{len(rep1['excused'])} excused")

    # A PARTITION HAS NO OVERLAP, so it can never reach this code however the
    # rule reads: `answers_another` searches the line's OTHER groups and a
    # line in a partition has none.
    part = SC.mandate([[1, 2], [3, 4]], n_lines=4)
    check("a mandate with no overlapping line excuses nothing under the "
          "disjunctive reading either — the code is named for the overlap "
          "and needs one",
          not dis.grade(OVERLAP, part)["excused"])

    # PER LINE, NOT PER GROUP. `satisfied[k]` — one boolean for a whole group
    # — was the other half of the same defect: a pivot that answers every
    # member of group B has ANSWERED B, and a failure between two OTHER
    # members of B is not its business.
    inner = ["the dog ran to the moon",        # 1  A={1,2}, D={1,7}
             "the cat sat on the mat",         # 2  A, B={2,5,6}
             "filler line one here",
             "filler line two here",
             "the rat wore a hat",             # 5  B
             "the bat also wore a hat",        # 6  B — REPEAT of 'hat'
             "the loon sang a tune"]           # 7  D
    m_inner = SC.mandate([[1, 2], [2, 5, 6], [1, 7]], n_lines=7)
    rep_i = dis.grade(inner, m_inner)
    ex_i = [(v["lines"], v["label"]) for v in rep_i["excused"]]
    check("L2 answers every member of B in full, so its failure in A is "
          "excused even though B carries an internal REPEAT between two "
          "lines L2 is not part of",
          ex_i == [((1, 2), "A")], str(ex_i))
    check("...and B's own internal violation is NOT excused: neither L5 nor "
          "L6 has another group to answer",
          any(v["lines"] == (5, 6) for v in rep_i["violations"]),
          str([(v["lines"], v["label"]) for v in rep_i["violations"]]))


def test_scheme_unreadable_is_not_a_violation():
    print("\n32. `SCHEME_UNREADABLE` — a mandated pair the harness could not "
          "READ is UNKNOWN, not absent, and the three counts stay three "
          "(doctrine 79)")
    oov = ["the fox went out and found a zzyzxqu",
           "the hen came home and found a blue"]
    readable = ["the fox went out and found a shoe",
                "the hen came home and found a blue"]
    m = SC.mandate([[1, 2]], n_lines=2)

    rep = R.grade(oov, m)
    check("mandated / judged / refused stay THREE counts, and the refusal "
          "is not charged to the comparator",
          (rep["pairs_mandated"], rep["pairs_judged"], rep["pairs_refused"])
          == (1, 0, 1),
          f"{rep['pairs_mandated']} / {rep['pairs_judged']} / "
          f"{rep['pairs_refused']}")
    check("a refusal is NOT a violation — the loop does not brief a writer "
          "to rewrite a line it could not read",
          not rep["violations"])

    res = R.inspect(oov, m)
    unread = _find(res, "SCHEME_UNREADABLE")
    check("the code fires, on BOTH lines of the pair: either end word being "
          "unreadable makes the RHYME unknown, and the writer needs to see "
          "that on the line they are looking at",
          len(unread) == 2 and sorted(res["per_line"])[:2] == [1, 2],
          unread[0].message if unread else "not emitted")
    check("it is a note, and it names the group the pair was mandated in",
          bool(unread) and unread[0].severity == "note"
          and "group(s) A" in unread[0].message)
    check("the evidence names the WORD that could not be read, not just the "
          "line — the refusal is a fact about the lexicon",
          bool(unread) and "zzyzxqu" in unread[0].evidence,
          unread[0].evidence[:90] if unread else "")

    briefs = R.brief(oov, m)
    b1 = next((b for b in briefs if b.line_no == 1), None)
    check("the line is briefed but gets NO candidate field: "
          "SCHEME_UNREADABLE is not in RHYME_FINDINGS, and 'the harness "
          "could not read this' is a different instruction to a writer than "
          "'this does not rhyme'",
          b1 is not None and not b1.candidates and not b1.forbidden_modal
          and not b1.forbidden_incumbent,
          f"candidates={len(b1.candidates) if b1 else '?'} "
          f"forbidden={len(b1.forbidden_modal) if b1 else '?'} "
          f"incumbent={(b1.forbidden_incumbent if b1 else '?')!r}")
    # THIS CHECK USED TO READ `not b1.must_answer` AS A SECOND PROOF OF THE
    # SENTENCE ABOVE, WHICH IS THE EXACT CONFLATION `brief()` WAS CARRYING —
    # repaired 2026-08-16 alongside it. The claim the check NAMES is about the
    # candidate FIELD; `must_answer` is the MANDATE, a different coordinate,
    # and the two were gated together. A line the mandate puts in a group is
    # in that group whether or not the harness could read its end word, so
    # the block is stated and the field is not, and BOTH halves are asserted
    # here rather than one standing in for the other.
    check("...and it IS told which group it is in, because the mandate "
          "declared one — the field is empty, the mandate is not",
          b1 is not None and len(b1.must_answer) == 1
          and b1.must_answer[0][0] == "A"
          and b1.must_rhyme_with == (2, "blue"),
          f"must_answer={b1.must_answer if b1 else '?'} "
          f"must_rhyme_with={b1.must_rhyme_with if b1 else '?'}")

    check("a readable draft under the same mandate emits none of it",
          not _find(R.inspect(readable, m), "SCHEME_UNREADABLE"))
    rep_ok = R.grade(readable, m)
    check("...and its pair is JUDGED rather than refused, so the counts "
          "move the way the two drafts differ",
          (rep_ok["pairs_judged"], rep_ok["pairs_refused"]) == (1, 0),
          f"{rep_ok['pairs_judged']} judged, {rep_ok['pairs_refused']} "
          f"refused")


def test_scope_reaches_the_collision_loop():
    print("\n33. `Mandate.scope` reaches the COLLISION LOOP — a pair the "
          "mandate does not speak about is UNDECLARED, not an unintended "
          "rhyme (doctrine 20/28), and not silence either (doctrine 24)")
    lines = song_lines()
    groups = [[13, 17], [14, 16], [15, 19], [18, 20]]
    chorus = list(range(13, 21)) + list(range(33, 41))
    plain = SC.mandate(groups, n_lines=41, returns=SONG_RETURN)
    scoped = SC.mandate(groups, n_lines=41, returns=SONG_RETURN, scope=chorus)

    rep_p, rep_s = R.grade(lines, plain), R.grade(lines, scoped)
    ins_p, ins_s = R.inspect(lines, plain), R.inspect(lines, scoped)

    # (1) THE MEASUREMENT THIS TEST EXISTS FOR. Before the fix these two runs
    # were BYTE-IDENTICAL: same 73 collisions, same 97 per-line findings, same
    # messages -- a declared coordinate changing nothing at all.
    und = [c for c in rep_s["collisions"] if c.get("undeclared")]
    check("the scoped run marks the collisions that touch a line the mandate "
          "does not speak about",
          len(rep_s["collisions"]) == 73 and len(und) == 49,
          f"{len(und)} of {len(rep_s['collisions'])} collisions are "
          f"UNDECLARED; the mandate speaks about {len(scoped.scope)} of 41 "
          f"lines. Before 2026-08-13 `grade()`'s collision loop never asked "
          f"`Mandate.scope` at all and this was 0 of 73")
    check("and the UNSCOPED mandate marks none of them — the default path is "
          "the one every production mandate takes",
          not any(c.get("undeclared") for c in rep_p["collisions"])
          and len(rep_p["collisions"]) == 73)

    # (2) RELABEL, NEVER DELETE (doctrine 24). The SET is the same set.
    check("the collision SET is unchanged by the scope — same 73 pairs",
          {c["lines"] for c in rep_p["collisions"]}
          == {c["lines"] for c in rep_s["collisions"]},
          "suppressing the 49 would make a scoped run indistinguishable from "
          "one where those pairs were checked and came back clean, which is "
          "doctrine 20's collapse pointed the other way -- and an unmandated "
          "rhyme is quite often the best thing in a song")
    by_p = collections.Counter(f.code for fs in ins_p["per_line"].values()
                               for f in fs if f.code in COLLISION_FINDINGS)
    by_s = collections.Counter(f.code for fs in ins_s["per_line"].values()
                               for f in fs if f.code in COLLISION_FINDINGS)
    check("every collision finding the scoped run drops it RE-EMITS under the "
          "fourth code — the partition is exact, nothing is silenced",
          sum(by_p.values()) == sum(by_s.values())
          and by_s["COLLISION_UNDECLARED"] == 49
          and by_p["COLLISION_UNDECLARED"] == 0,
          f"unscoped {dict(by_p)}  ->  scoped {dict(by_s)}")
    check("...and it is drawn from ALL THREE relation types, so the code is "
          "not a rename of one of them",
          (by_p["SCHEME_COLLISION"] - by_s["SCHEME_COLLISION"],
           by_p["NEAR_COLLISION"] - by_s["NEAR_COLLISION"],
           by_p["REPEAT_ACROSS_GROUPS"] - by_s["REPEAT_ACROSS_GROUPS"])
          == (25, 20, 4),
          "25 rhymes + 20 near-relations + 4 repeats = the 49")

    # (3) WHAT THE FINDING SAYS. `FREE` is the word doctrine 28 exists to keep
    # apart from UNDECLARED, and the old rendering printed exactly it: a line
    # in no group prints as `free`, and out-of-scope lines are in no group.
    uf = [f for fs in ins_s["per_line"].values() for f in fs
          if f.code == "COLLISION_UNDECLARED"]
    check("no UNDECLARED collision is described to the writer as `free` — "
          "'cannot tell' and 'nothing required here' are different answers",
          uf and not any("free" in f.message for f in uf),
          f"{len(uf)} finding(s); before the fix all 49 were rendered "
          f"`L1 (free) and L3 (free) RHYME and share no mandated group`")
    check("it names WHICH line is outside the scope, and what the pair WOULD "
          "have been called if the mandate reached it",
          bool(uf) and all("DOES NOT SPEAK" in f.message for f in uf)
          and any("would be reported as SCHEME_COLLISION" in f.evidence
                  for f in uf)
          and any("would be reported as NEAR_COLLISION" in f.evidence
                  for f in uf),
          uf[0].message if uf else "not emitted")
    check("it is a NOTE, never a flag: the mandate declined to speak here, so "
          "this cannot be a thing the loop asks a writer to change "
          "(doctrine 7)",
          bool(uf) and all(f.severity == "note" for f in uf))

    # (4) SAID ONCE, ABOUT THE MANDATE. Doctrine 1: state the assumption.
    disc = [f for f in ins_s["whole"] if f.code == "MANDATE_SCOPE_DECLARED"]
    check("the scope itself is disclosed once, with the two counts kept "
          "SEPARATE (doctrine 79)",
          len(disc) == 1 and "16 of 41" in disc[0].message
          and "24 are inside that scope" in disc[0].message
          and "49 touch a line it does not speak about" in disc[0].message,
          disc[0].message if disc else "not emitted")
    check("and an unscoped mandate discloses nothing, because it has nothing "
          "to disclose — it speaks about every line",
          not [f for f in ins_p["whole"]
               if f.code == "MANDATE_SCOPE_DECLARED"])

    # (5) THE CUT NOTE IS A STATEMENT ABOUT THE CUT, so it counts the same
    # near-relations either way -- the scope changes who is charged, never
    # which pairs the scalar-only cut let through.
    cut_p = [f for f in ins_p["whole"]
             if f.code == "COLLISION_CUT_IS_SCALAR_ONLY"]
    cut_s = [f for f in ins_s["whole"]
             if f.code == "COLLISION_CUT_IS_SCALAR_ONLY"]
    check("`COLLISION_CUT_IS_SCALAR_ONLY` reports the same 28 of 73 with the "
          "scope on and off",
          len(cut_p) == len(cut_s) == 1
          and cut_p[0].message == cut_s[0].message,
          cut_s[0].message if cut_s else "not emitted")

    # (6) A MERGE CAN NEVER BE UNDECLARED, and that is not luck:
    # `_normalise_scope` REFUSES a scope that leaves out a line the mandate's
    # own groups or returns name, so every group member is in scope.
    absorbed = {(i, j) for mg in ins_s["merges"] for i, j, *_ in mg["edges"]}
    check("no edge absorbed into a group merge is UNDECLARED — a scope that "
          "excluded a mandated line would have been REFUSED at construction",
          all(not c.get("undeclared") for c in rep_s["collisions"]
              if tuple(c["lines"]) in absorbed),
          f"{len(absorbed)} absorbed edge(s)")

    # (7) THE SMALL CASE, checkable in one step (doctrine 94's shape: a
    # constructed fixture beside the real one).
    m4 = SC.mandate([[1, 3]], n_lines=4, scope=[1, 3])
    ins4 = R.inspect(CLICHE, m4)
    got = [f.code for fs in ins4["per_line"].values() for f in fs
           if f.code in COLLISION_FINDINGS]
    plain4 = [f.code for fs in R.inspect(CLICHE, SC.mandate([[1, 3]],
                                                            n_lines=4))
              ["per_line"].values() for f in fs
              if f.code in COLLISION_FINDINGS]
    check("four lines: L2/L4 rhyme, the mandate speaks only about L1/L3, so "
          "that one collision is UNDECLARED — and is SCHEME_COLLISION under "
          "the same mandate with no scope",
          got == ["COLLISION_UNDECLARED"] and plain4 == ["SCHEME_COLLISION"],
          f"scoped {got}, unscoped {plain4}")

    # (8) A SCOPE THAT COVERS EVERY LINE IS NOT A NARROWING. It is still a
    # DECLARATION, so it is still disclosed -- but no pair can be UNDECLARED
    # under it, and every collision code is what it was.
    full = SC.mandate(groups, n_lines=41, returns=SONG_RETURN,
                      scope=list(range(1, 42)))
    ins_f = R.inspect(lines, full)
    by_f = collections.Counter(f.code for fs in ins_f["per_line"].values()
                               for f in fs if f.code in COLLISION_FINDINGS)
    check("a scope over ALL 41 lines reproduces the unscoped collision codes "
          "exactly, and discloses itself as speaking about all of them",
          by_f == by_p and not by_f["COLLISION_UNDECLARED"]
          and any("41 of 41" in f.message for f in ins_f["whole"]
                  if f.code == "MANDATE_SCOPE_DECLARED"),
          f"{dict(by_f)} -- `scope` is a claim about what the mandate "
          f"COVERS, and covering everything is the same claim the empty "
          f"tuple makes implicitly")


# The four drafts tests 34-35 discriminate on. Every one is four lines, and
# only L1/L2 are ever mandated -- L3/L4 are FREE, which is the whole point.
_RD_HEAD = ["the harbour lights came on across the bay",
            "we watched them till the colour drained away",
            "a lantern swung and marked the falling dark"]
#: DISCRIMINATING. `zzzqx` ends a line the mandate leaves FREE, so
#: `refusals_for_pairs` -- which is scoped to MANDATED pairs -- never sees it.
_RD_FREE = _RD_HEAD + ["and somewhere out beyond it sang a zzzqx"]
#: DISCRIMINATING, the OTHER cause: a line-final COMPOUND whose last piece is
#: unread. `UNREADABLE_END_WORD_PIECE`, not `UNREADABLE_END_WORD`.
_RD_PIECE = _RD_HEAD + ["the fog rolled slowly up the hill-zide"]
#: NON-DISCRIMINATING, and it is the input a reader reaches for FIRST.
_RD_MANDATED = list(_RD_FREE)
#: NON-DISCRIMINATING for a second, different reason -- see test 34.
_RD_NOTOKENS = _RD_HEAD + ["(instrumental)"]


def test_the_readability_report_joins_the_revision_loop():
    print("\n34. `quality/readability.py`'s own report REACHES `inspect()` — "
          "the records `_matrix` already computes on every run stop being "
          "thrown away (CLAUDE.md known gap 8)")
    m12 = SC.mandate([[1, 2]], n_lines=4)

    # -- THE DISCRIMINATING INPUT ------------------------------------------
    res = R.inspect(_RD_FREE, m12)
    got = _find(res, "UNREADABLE_END_WORD")
    check("an unreadable end word on a line the mandate leaves FREE is "
          "reported at all — before this join it produced NOTHING, while "
          "`readability.report` on the same lines called it a flag",
          len(got) == 1 and got[0].locations == [4],
          got[0].message if got else "not emitted")
    check("...and it is filed on the LINE it is about, so a writer reading "
          "L4's brief sees it",
          4 in res["per_line"]
          and any(f.code == "UNREADABLE_END_WORD" for f in res["per_line"][4]))
    check("the evidence names the WORD, not just the line",
          bool(got) and "zzzqx" in got[0].evidence,
          got[0].evidence[:80] if got else "")

    # -- THE SEVERITY DECISION ---------------------------------------------
    check("it is a NOTE here though `readability.report` calls it a FLAG: a "
          "refusal is not a violation (doctrine 79) and `verify()` gates "
          "acceptance on `new_flags` alone",
          bool(got) and got[0].severity == "note",
          f"severity {got[0].severity!r}" if got else "")
    src = {f.code: f.severity for f in RD.report(R.lex, _RD_FREE)["findings"]}
    check("...and the asymmetry is REAL rather than assumed — the source "
          "module really does say flag for this code",
          src.get("UNREADABLE_END_WORD") == "flag", f"readability.py: {src}")
    unread = _find(R.inspect(_RD_MANDATED, SC.mandate([[1, 2], [3, 4]],
                                                      n_lines=4)),
                   "SCHEME_UNREADABLE")
    check("INTERNAL CONSISTENCY is what forces the note: `SCHEME_UNREADABLE` "
          "— the SAME refusal on a pair the mandate DECLARED — is a note, so "
          "a flag here would fail an unmandated line HARDER than a mandated "
          "one",
          bool(unread) and all(f.severity == "note" for f in unread))
    check("the downgrade says so in its own evidence rather than silently, "
          "and names the coordinate that changes the answer",
          bool(got) and "NOTE" in got[0].evidence
          and "fallback" in got[0].evidence)

    # -- THE SECOND CAUSE, WHICH IS A SEPARATE CODE ------------------------
    piece = _find(R.inspect(_RD_PIECE, m12), "UNREADABLE_END_WORD_PIECE")
    check("the `piece` cause arrives under its OWN code — the two partition "
          "and must not be summed (doctrine 44's separation)",
          len(piece) == 1 and piece[0].locations == [4]
          and piece[0].severity == "note",
          piece[0].message if piece else "not emitted")

    # -- THE TWO INPUTS THAT CANNOT DISCRIMINATE, PINNED BESIDE THEM -------
    # (a) THE OBVIOUS ONE. Put the identical word on a MANDATED line and the
    # loop ALREADY said something about it before this join existed, because
    # `refusals_for_pairs` covers mandated pairs. A test asserting only "L4
    # carries a readability finding" is GREEN against the pre-fix code here --
    # and note that `"UNREAD" in "SCHEME_UNREADABLE"` is True, so even a
    # substring filter is fooled. Only naming the CODE discriminates.
    res_m = R.inspect(_RD_MANDATED, SC.mandate([[1, 2], [3, 4]], n_lines=4))
    loose = [f.code for f in res_m["per_line"].get(4, []) if "UNREAD" in f.code]
    check("NON-DISCRIMINATING (a): on a MANDATED line a loose 'L4 carries a "
          "readability finding' assertion is GREEN with or without this "
          "join — `SCHEME_UNREADABLE` is already there and its own name "
          "contains 'UNREAD', so even a substring filter is fooled",
          "SCHEME_UNREADABLE" in loose,
          f"L4 carries {sorted(loose)}; the pre-fix code supplies the first "
          f"on its own, so only naming the CODE discriminates")
    # (b) THE BOUNDARY THAT RETURNS EARLY. `(instrumental)` looks like the
    # perfect unreadable line -- its record says `readable: False` and its
    # reason says the harness could not anchor it -- but `readability.
    # countable` is False for it (no word tokens), so `report()` emits nothing
    # and the loop is silent BOTH before and after this change.
    rec = readability_records(R.lex, _RD_NOTOKENS)[3]
    res_n = R.inspect(_RD_NOTOKENS, m12)
    check("NON-DISCRIMINATING (b): a line with NO word tokens records "
          "`readable=False` and still yields no finding — `countable()` "
          "drops it before the changed line runs, so this fixture is green "
          "either side of the fix",
          rec["readable"] is False and rec["final_token"] is None
          and not RD.countable(_RD_NOTOKENS[3])
          and not [f for f in res_n["per_line"].get(4, [])
                   if "UNREADABLE_END" in f.code],
          f"reason: {rec['reason']}")

    # -- THE STOP CONDITIONS ARE UNMOVED -----------------------------------
    from quality.loop import revise_loop
    lr = revise_loop(R, _RD_FREE, m12)
    check("`revise_loop` still returns SUCCESS on this draft: a per-line "
          "NOTE is briefed and disclosed and starts no round, so none of the "
          "three stop conditions moved",
          lr.stop_reason == "success" and not lr.unresolved,
          f"{lr.stop_reason}, {len(lr.rounds)} round(s), "
          f"unresolved {[b.line_no for b in lr.unresolved]}")
    b4 = next((b for b in R.brief(_RD_FREE, m12) if b.line_no == 4), None)
    check("...and L4 IS briefed, with no candidate field: the code is not in "
          "RHYME_FINDINGS, so the writer is handed the fact and not a list "
          "of rhyme words the finding has no use for",
          b4 is not None and not b4.candidates,
          "briefed" if b4 else "L4 absent from the brief")

    # -- THE BLAST RADIUS AT `verify()`, WHICH IS WHERE A NEW CODE BITES ---
    # `verify()` diffs the WHOLE finding set and gates on `new_flags`, so a
    # new CODE moves two things. Both are measured here rather than argued,
    # and both move the right way.
    good = _RD_HEAD + ["and somewhere out beyond it sang a lark"]
    fix = R.verify(_RD_FREE, good, m12, targeted=[4])
    check("a revision that makes an unreadable line READABLE is now ACCEPTED "
          "— pre-fix `fixed` was empty here and the loop rejected it as "
          "'nothing was fixed', calling a real repair a no-op",
          fix["accepted"] and (4, "UNREADABLE_END_WORD") in fix["fixed"],
          f"fixed {fix['fixed']}, accepted {fix['accepted']}")
    brk = R.verify(good, _RD_FREE, m12, targeted=[4])
    check("...and the reverse is DISCLOSED and still cannot reject: a "
          "revision that makes a line unreadable lands in `new_notes`, never "
          "`new_flags`, so doctrine 7 holds — pre-fix it landed nowhere and "
          "the loop could not see the regression at all",
          (4, "UNREADABLE_END_WORD") in brk["new_notes"]
          and (4, "UNREADABLE_END_WORD") not in brk["new_flags"],
          f"new_notes {brk['new_notes']}, new_flags {brk['new_flags']}")

    # -- THE RECORDS THE TWO PATHS READ CANNOT DISAGREE --------------------
    # `report(lex, lines)` recomputes `readability_records` without the
    # anchors `_matrix` already holds. The only field these findings read is
    # `final_unreadable`, which is `not line_anchors(...)`; `promote` is the
    # one coordinate that differs between the two calls, and it is a bool.
    flips = 0
    for text in _RD_FREE + _RD_PIECE + load_lyric_lines(SONG):
        a_t, _, _ = line_anchors(R.lex, text, promote=True)
        a_f, _, _ = line_anchors(R.lex, text, promote=False)
        flips += (not a_t) != (not a_f)
    check("`promote` — the one coordinate `_matrix` passes and `report` does "
          "not — cannot flip `final_unreadable`, so recomputing the records "
          "is not a second opinion (doctrine 1)",
          flips == 0,
          f"0 flips over {len(_RD_FREE + _RD_PIECE + load_lyric_lines(SONG))} "
          f"lines, at BOTH values of the boolean")


def test_overlapping_spans_reaches_the_loop_not_only_fit():
    print("\n35. `OVERLAPPING_SPANS` reaches `Reviser._meter_findings` — one "
          "check, two surfaces (CLAUDE.md known gap 9)")
    # Two lines in ONE section that share bar-time. An overlap is a relation
    # BETWEEN lines, so `fit_line` cannot see it from inside one and this loop
    # reported nothing about it while `fit` printed it on the same file.
    bp = {"bpm": 120, "meter": "4/4",
          "sections": [{"name": "verse1", "bars": 4, "start_bar": 1,
                        "function": "verse",
                        "meter": {"beats": 4, "unit": 4, "groups": [2, 2]}}],
          "lines": [
              {"text": "the first line holds the whole bar down",
               "bar": 1, "beat": 1, "duration": 16, "section": "verse1"},
              {"text": "the second one comes in over the top",
               "bar": 1, "beat": 2, "duration": 8, "section": "verse1"},
              {"text": "a third voice waits until the count is clear",
               "bar": 3, "beat": 1, "duration": 4, "section": "verse1"},
              {"text": "and answers on a beat that stays sincere",
               "bar": 4, "beat": 1, "duration": 4, "section": "verse1"}]}
    lines = [l["text"] for l in bp["lines"]]
    m = SC.mandate([[3, 4]], n_lines=4)
    sub = FT.Subdivision(slots_per_pulse=2, source="test 35")

    res = R.inspect(lines, m, blueprint=bp, subdivision=sub)
    ov = _find(res, "OVERLAPPING_SPANS")
    check("the revision loop reports the overlap the `fit` verb reports — "
          "before the wiring `fit` printed `over 4` on this blueprint and "
          "`song` printed twelve meter findings and never mentioned it",
          len(ov) == 8, f"{len(ov)} finding(s)")
    check("BOTH members of each overlapping pair are told, not only the "
          "later one — an overlap is symmetric and a writer looking at "
          "either line needs to see it",
          sorted({l for f in ov for l in f.locations}) == [1, 2, 3, 4])
    # `ov` is asserted NON-EMPTY inside the same condition on purpose: an
    # `all()` over an empty list is vacuously true, which is precisely how a
    # pin goes on passing after the thing it guards has disappeared (this
    # repo's own commit 044b169, "the pin guarding the stale number was
    # quantifying over an empty list").
    check("it is a NOTE: `fit.py` marks an overlap satisfiable (two vocal "
          "parts sharing a pulse is legal), and `_meter_findings` keeps that "
          "module's severity rather than forming a second opinion",
          bool(ov) and all(f.severity == "note" for f in ov),
          f"{len(ov)} finding(s), all note" if ov else "VACUOUS: none emitted")

    # THE SAME ARITHMETIC, NOT A SECOND COPY. `fit_song` and `_meter_findings`
    # both call `fit.overlap_findings`, so the evidence strings must be equal
    # character for character -- that is what makes this one check rather than
    # two that happen to agree today.
    song = FT.fit_song(bp, subdivision=sub)
    from_fit = sorted(f.evidence for l in song.lines for f in l.findings
                      if f.code == "OVERLAPPING_SPANS")
    check("the evidence is byte-identical to the `fit` surface's — one "
          "function, two callers, so the two cannot drift",
          from_fit == sorted(f.evidence for f in ov),
          f"{len(from_fit)} from `fit_song`, {len(ov)} from `inspect`")

    # NON-DISCRIMINATING, and it is what every shipped fixture would give:
    # all four blueprints in `quality/fixtures/` have ZERO overlapping lines,
    # which is exactly why this wiring cost no test churn -- and exactly why
    # a test built on one of them proves nothing about it.
    clean = FT.fit_song(os.path.join(HERE, "fixtures", "song.blueprint.json"))
    check("NON-DISCRIMINATING: the shipped blueprint has NO overlapping "
          "lines, so it reports zero either side of the fix — the wiring is "
          "invisible to every fixture this suite already had",
          not [f for l in clean.lines for f in l.findings
               if f.code == "OVERLAPPING_SPANS"],
          "which is why the gap survived: no existing fixture could see it")


def test_stanza_lock_reaches_the_loop_not_only_the_grid_verb():
    print("\n36. the SHAPE layer reaches `Reviser._function_findings` — "
          "`stanza_lock` was computed by a function no grading path called")
    from quality import grid as GR

    # THE CLICHE, CONSTRUCTED, and `stanza_lock`'s own docstring names it:
    # "sixteen bars of 4/4 carrying four lines, repeated. Nothing in this repo
    # could see that before -- the rhyme checker would certify it as clean,
    # because every check it had was about words." Four 4-bar sections of 4/4,
    # four lines each, every line on beat 1 and 4 beats long.
    secs = [("verse1", "verse"), ("chorus", "chorus"),
            ("verse2", "verse"), ("chorus2", "chorus")]
    bp = {"sections": [{"name": n, "bars": 4, "start_bar": 1 + 4 * i,
                        "meter": {"beats": 4, "unit": 4}, "function": fn}
                       for i, (n, fn) in enumerate(secs)],
          "lines": [{"text": "", "bar": 1 + b, "beat": 1, "duration": 4,
                     "section": secs[b // 4][0]} for b in range(16)]}
    lines = ["the wire hums low across the yard",
             "a freight goes by and shakes the door",
             "i counted every passing car",
             "and never once got up for more"] * 4
    SHAPE = {"METER_LOCKED", "SECTION_LENGTH_LOCKED", "QUATRAIN_LOCK",
             "DOWNBEAT_LOCKED", "UNIFORM_ANACRUSIS", "PHRASE_LENGTH_LOCKED"}

    res = R.inspect(lines, "ABCDABCDABCDABCD", blueprint=bp)
    got = {f.code for f in res["whole"]} & SHAPE
    check("the shape findings reach `inspect()`'s whole-draft set at all",
          len(got) == 5, sorted(got))
    check("QUATRAIN_LOCK is among them — the check whose whole subject is "
          "'every section carries exactly four lines' can now be seen by the "
          "thing that grades a draft",
          "QUATRAIN_LOCK" in got)
    check("UNIFORM_ANACRUSIS is correctly SILENT, not missing: it is the "
          "`elif` of DOWNBEAT_LOCKED, which fired — two shapes of one defect, "
          "and doctrine 24 says the rule relabels rather than deletes",
          "UNIFORM_ANACRUSIS" not in got and "DOWNBEAT_LOCKED" in got)

    shape = [f for f in res["whole"] if f.code in SHAPE]
    check("every one is a NOTE — a convention at an uncalibrated 0.90 "
          "threshold may not be the thing that fails verify() (doctrine 6/16)",
          all(f.severity == "note" for f in shape),
          sorted((f.code, f.severity) for f in shape))
    check("each says in its own evidence that it is read off the DECLARED "
          "grid, so a reader is not left to infer that revising the words "
          "cannot move it",
          all("[SHAPE:" in f.evidence for f in shape))

    # PROVENANCE, not correlation: stub the call out and the five vanish.
    real = GR.stanza_lock
    try:
        GR.stanza_lock = lambda song, threshold=0.90: []
        rev = Reviser().inspect(lines, "ABCDABCDABCDABCD", blueprint=bp)
    finally:
        GR.stanza_lock = real
    was = {f.code for f in rev["whole"]} & SHAPE
    check("REVERTED, the same draft reports NONE of them — so they come from "
          "this call and from nothing else already in the finding set",
          not was, f"reverted {sorted(was)}, at head {sorted(got)}")
    check("and the whole-draft FLAG count is IDENTICAL either side, which is "
          "the invariant that matters: wiring this in cannot change what "
          "`verify()` is entitled to reject on",
          (sum(1 for f in rev["whole"] if f.severity == "flag")
           == sum(1 for f in res["whole"] if f.severity == "flag")))

    # WHY THE GAP SURVIVED, MEASURED RATHER THAN ASSUMED -- and the first
    # answer written here was wrong. The obvious claim is the one `test 35`
    # gets to make about OVERLAPPING_SPANS: no shipped fixture trips it, so
    # nothing could see the layer was unwired. That is FALSE here, and the
    # truth is worse. Three of the four shipped blueprints trip
    # DOWNBEAT_LOCKED right now (`song` 16 lines, `mandate_song` 41,
    # `moonlight_fixture` 20, which also trips PHRASE_LENGTH_LOCKED;
    # `function_fixture` has no lines at all). So the layer was not merely
    # untested -- it was firing on the repo's own fixtures and reporting to
    # nobody, because `stanza_lock` was reachable from the `grid` verb and
    # from no path that grades a draft.
    ship = {}
    for name in ("song", "mandate_song", "moonlight_fixture",
                 "function_fixture"):
        s, _h = GR.song_from_blueprint(
            os.path.join(HERE, "fixtures", name + ".blueprint.json"))
        ship[name] = {f.code for f in GR.stanza_lock(s)}
    tripped = set().union(*ship.values())
    check("the shipped fixtures were ALREADY tripping this layer and "
          "reporting it nowhere — not an untested check, a silent one",
          tripped == {"DOWNBEAT_LOCKED", "PHRASE_LENGTH_LOCKED"},
          "; ".join(f"{k}: {sorted(v) or '(none)'}" for k, v in ship.items()))
    check("and FOUR of the six are tripped by no shipped fixture at all, "
          "which is why this test had to construct the cliché rather than "
          "reach for one",
          not (SHAPE - tripped - {"UNIFORM_ANACRUSIS"}) & tripped
          and sorted(SHAPE - tripped) == ["METER_LOCKED", "QUATRAIN_LOCK",
                                          "SECTION_LENGTH_LOCKED",
                                          "UNIFORM_ANACRUSIS"],
          sorted(SHAPE - tripped))

    # DOCTRINE 17, FOUND ON THE WAY IN AND DELIBERATELY NOT "FIXED".
    # `uniformity`'s own docstring says this repo's 41-line song "cleared the
    # check by giving every second line a pickup of 1.5 pulses" and that
    # "downbeat_locked fell to 51%". It reads 1.00 today and all 41 lines
    # declare `beat: 1` -- the pickups are gone and the recorded figure no
    # longer reproduces. Restoring them is exactly the cheat that docstring
    # exists to condemn, so this pins the CURRENT reading instead and leaves
    # the fixture alone.
    _m, _h = GR.song_from_blueprint(
        os.path.join(HERE, "fixtures", "mandate_song.blueprint.json"))
    check("the 41-line fixture reads downbeat_locked 1.00, not the 0.51 "
          "`uniformity`'s docstring records — pinned, not repaired",
          GR.uniformity(_m)["downbeat_locked"] == 1.0,
          "restoring a constant pickup would re-commit the cheat that "
          "UNIFORM_ANACRUSIS was written to name (doctrine 24)")


#: A 4-line draft and a blueprint declaring a hook that IS NOT IN IT, plus
#: the mandate that makes both CLI verbs run rather than refuse. Small on
#: purpose: test 37 runs the CLI as a SUBPROCESS twice, and the 16-line
#: `fixtures/song.txt` costs ~16s a run against this one's ~5s.
ABSENT_HOOK = "a phrase this draft does not contain anywhere"
GAP_LINES = ["the wire hums low across the yard",
             "a freight goes by and shakes the door",
             "i counted every passing car",
             "and never once got up for more"]
GAP_SCHEME = "ABAB"
GAP_BLUEPRINT = {
    "_note": "Constructed (doctrine 94) for test 37: a blueprint whose "
             "declared hook is absent from the draft, so HOOK_ABSENT — the "
             "song-function layer's ONLY flag — is whole-draft and a FLAG.",
    "title": "The Passing Car",
    "hooks": [ABSENT_HOOK],
    "sections": [
        {"name": "verse", "bars": 2, "start_bar": 1, "function": "verse",
         "meter": {"beats": 4, "unit": 4, "groups": [2, 2]}},
        {"name": "chorus", "bars": 2, "start_bar": 3, "function": "chorus",
         "meter": {"beats": 4, "unit": 4, "groups": [2, 2]}}],
    "lines": [{"text": t, "bar": i + 1, "beat": 1, "duration": 4,
               "section": "verse" if i < 2 else "chorus"}
              for i, t in enumerate(GAP_LINES)]}


def test_the_whole_draft_half_reaches_the_report():
    print("\n37. the WHOLE-DRAFT half of the finding set reaches the REPORT "
          "— `brief()` is per_line-only by construction and the CLI printed "
          "nothing else, so five findings including a FLAG were computed and "
          "discarded on every `brief` and `song` run")

    found = R.inspect(GAP_LINES, GAP_SCHEME, blueprint=GAP_BLUEPRINT)

    # 1. THE MECHANISM, stated as an assertion rather than as prose.
    #    `_function_findings` builds its findings with `locations=[]`;
    #    `inspect`'s router (`quality/revise.py`, the `if f.locations: ...
    #    else: whole.append(f)` arm) puts anything with no locations into
    #    `whole`; `brief()` iterates `found["per_line"]` and nothing else.
    hook = [f for f in found["whole"] if f.code == "HOOK_ABSENT"]
    check("HOOK_ABSENT is in `inspect()`'s WHOLE bucket, as a FLAG",
          len(hook) == 1 and hook[0].severity == "flag",
          sorted(f.code for f in found["whole"]))
    check("it names NO line — which is why no `Brief` can carry it: a Brief "
          "is `line_no` + `candidates` + `must_answer`, and a finding with "
          "no line has no place to sit inside one",
          hook and not hook[0].locations)
    per_codes = {f.code for fs in found["per_line"].values() for f in fs}
    check("and it is in no per-line list either, so this is a REACHABILITY "
          "gap and not a duplicate",
          "HOOK_ABSENT" not in per_codes, sorted(per_codes))
    briefs = R.brief(GAP_LINES, GAP_SCHEME, blueprint=GAP_BLUEPRINT)
    check("`brief()` returns not one Brief carrying it — UNCHANGED by this "
          "fix, and deliberately so: fabricating a line number to smuggle a "
          "whole-draft finding into a per-line record is the move "
          "`quality/loop.py` declined to make when its stop conditions hit "
          "this same wall (`LoopResult.whole_flags` instead)",
          not any(f.code == "HOOK_ABSENT"
                  for b in briefs for f in b.findings))

    # 2. THE REPORT PATH, run as a user runs it. A subprocess and not an
    #    import for the reason `quality/test_verbs.py`'s own runner gives:
    #    what is under test is REACHABILITY FROM THE COMMAND LINE, and the
    #    library layer was never the thing that was broken here.
    tmp = tempfile.mkdtemp(prefix="lh_whole_")
    try:
        bp_path = os.path.join(tmp, "gap.blueprint.json")
        lyric = os.path.join(tmp, "gap.txt")
        with open(bp_path, "w", encoding="utf-8") as fh:
            json.dump(GAP_BLUEPRINT, fh)
        with open(lyric, "w", encoding="utf-8") as fh:
            fh.write("[verse]\n" + "\n".join(GAP_LINES[:2])
                     + "\n\n[chorus]\n" + "\n".join(GAP_LINES[2:]) + "\n")
        root = os.path.join(HERE, "..")

        def cli(*args):
            p = subprocess.run([sys.executable, "lyric_harness.py", *args],
                               cwd=root, capture_output=True, text=True,
                               timeout=900)
            return p.returncode, p.stdout

        rc_b, out_b = cli("brief", lyric, GAP_SCHEME, "--blueprint=" + bp_path)
        rc_s, out_s = cli("song", bp_path, lyric, GAP_SCHEME)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)

    # THE EXIT CODE IS PER-VERB SINCE `song` GAINED A THIRD ONE (2026-08-14,
    # `quality/test_verbs.py` §16): 0 answered clean, 2 REFUSED, 3 answered
    # with a FLAG standing. This draft carries TWO — a per-line
    # SCHEME_VIOLATION on L3 and the whole-draft HOOK_ABSENT this section is
    # about — so `song` is 3 here on the per-line rule alone. `rc == 0` was
    # written before that code existed and was standing in for "the verb ran
    # and produced a report"; the two `check`s below are this section's
    # actual subject and both still hold.
    #
    # SPLIT RATHER THAN WIDENED FOR BOTH, which makes it a STRONGER
    # assertion than the one it replaces: `brief` is pinned at exactly 0,
    # which is the scoping decision (the gate is on the whole-song verb, not
    # on the interactive one) and would now FAIL if `song`'s exit code ever
    # leaked into `brief`.
    for verb, rc, out in (("brief", rc_b, out_b), ("song", rc_s, out_s)):
        answered = (0,) if verb == "brief" else (0, 3)
        check(f"`{verb}` answers on this draft rather than refusing or "
              f"crashing (exit {' or '.join(map(str, answered))})",
              rc in answered, f"rc {rc}")
        check(f"`{verb}` PRINTS HOOK_ABSENT — the whole point: this verb's "
              f"own banner says song-function joins the finding set, and "
              f"until this fix that was true of the SET and false of the "
              f"report",
              "HOOK_ABSENT" in out,
              "banner said it, report did not" if "HOOK_ABSENT" not in out
              else "")
        check(f"`{verb}` marks it a FLAG rather than folding it in "
              f"unlabelled — a whole-draft NOTE and a whole-draft FLAG are "
              f"not the same news (doctrine 79)",
              "[FLAG] HOOK_ABSENT" in out)
        check(f"`{verb}` says in the report itself that a whole-draft "
              f"finding names no line and cannot be briefed, so a reader is "
              f"not left to wonder which line to revise",
              "WHOLE DRAFT" in out and "name no single line" in out)
        check(f"`{verb}` does NOT print the unqualified all-clear over a "
              f"draft carrying a whole-draft flag",
              "nothing flagged" not in out)

    # 3. THE ASYMMETRY IS UNDISTURBED, and it is the reason the fix went in
    #    the report rather than in the stop condition. `verify()`'s diff
    #    covers `whole` as well as `per_line`, so a whole-draft flag can
    #    REJECT a revision and can never ASK for one — `quality/loop.py`'s
    #    docstring argues the case and `LoopResult.disclosure()` prints it.
    #    Printing the bucket does not widen what may reject.
    with_hook = list(GAP_LINES)
    with_hook[3] = ABSENT_HOOK
    fixed = {f.code for f in
             R.inspect(with_hook, GAP_SCHEME,
                       blueprint=GAP_BLUEPRINT)["whole"]}
    check("putting the hook INTO the draft clears HOOK_ABSENT, so the "
          "finding tracks the draft and not the blueprint's stored text",
          "HOOK_ABSENT" not in fixed, sorted(fixed))
    res = R.verify(with_hook, GAP_LINES, GAP_SCHEME, targeted={4},
                   blueprint=GAP_BLUEPRINT)
    check("verify() still REJECTS a revision that erases the hook, keyed on "
          "`(0, 'HOOK_ABSENT')` — the whole bucket's own key shape, "
          "untouched by this fix",
          not res["accepted"] and (0, "HOOK_ABSENT") in res["new"],
          res["reasons"])
    check("and it reaches the ACCEPTANCE GATE, not just the disclosure: the "
          "whole-draft flag is the ONLY member of `new_flags`, so the "
          "rejection rests on the half of the finding set the report was "
          "throwing away",
          res["new_flags"] == [(0, "HOOK_ABSENT")],
          f"new_flags={res['new_flags']}, new_notes={res['new_notes']}")
    check("and it is still true that no Brief asks for the hook back: the "
          "loop can reject on it and can never brief it, which is DISCLOSED "
          "now instead of silent",
          not any(f.code == "HOOK_ABSENT" for b in
                  R.brief(GAP_LINES, GAP_SCHEME, blueprint=GAP_BLUEPRINT)
                  for f in b.findings))


#: A 5-line draft with a BLANK at L2 and the mandate a writer would declare
#: over it: L1 with L3, L4 with L5. The blank is the whole fixture — every
#: real line is ordinary, and the two halves of `inspect()` still disagree
#: about which line is which.
BLANK_DRAFT = ["we walked out into the rain",
               "",
               "the fire was burning bright",
               "the empty road was lost in rain",
               "and nothing else remained in rain"]
#: the SAME four lines and the SAME declared grouping, renumbered BY HAND —
#: which is the only party entitled to renumber it (see `Reviser.mandate`).
BLANK_DRAFT_CLEAN = [l for l in BLANK_DRAFT if l.strip()]
#: a LEADING blank, for the `locations` half: every real line opens with the
#: same word, so `ANAPHORA_OVERLOAD` names all four of them.
LEADING_BLANK = ["",
                 "and the river ran on",
                 "and the river ran cold",
                 "and the river ran wide",
                 "and the river ran old"]
#: `CLICHE` behind a leading blank, mandated 1,3;2,4 — chosen so the skew
#: puts a FLAG on the blank line rather than merely off by one. With the
#: guard disarmed, `revise_loop` on this draft stops at NO_PROGRESS with
#: `line 1 tier 1 accepted=False, "no candidates offered"`: it is trying to
#: swap the end word of ''.
BLANK_CLICHE = [""] + list(CLICHE)


def _floor_as_inspect_would(lines, spec):
    """What `inspect()` hands the floor, reconstructed AROUND the refusal.

    `SC.mandate(spec, n_lines=len(lines))` is `Reviser.mandate` minus the
    blank-line check and `_floor_for`/`SlopFloor.check` are the shipped ones,
    so this is not a model of the defect — it is the defect, one call from
    where a caller used to reach it. Keeping the measurement in the suite is
    the point: a refusal with no record of what it refuses is a rule nobody
    can re-derive.
    """
    m = SC.mandate(spec, n_lines=len(lines))
    fl, pseudo = R._floor_for(m)
    return m, fl.check(lines, pseudo)


def _refuses(fn):
    try:
        fn()
        return False
    except NoMandate:
        return True


def test_a_blank_line_is_refused_not_renumbered():
    print("\n38. one draft, TWO line-numberings, and neither half said so")

    # -- the seam ---------------------------------------------------------
    m, blank_found = _floor_as_inspect_would(BLANK_DRAFT, "AXABB")
    kept = [l for l in BLANK_DRAFT if l.strip()]
    check("the mandate is 0-based against the RAW list",
          m.n_lines == 5 and m.pairs0() == [(0, 2), (3, 4)],
          f"groups {m.groups} -> pairs0 {m.pairs0()}; the declared pair "
          f"L4/L5 is (3, 4)")
    check("the floor re-indexes underneath it — 5 lines handed in, 4 graded",
          len(kept) == 4,
          "`SlopFloor.check` opens `[l for l in lines if l.strip()]` and "
          "`QualityFeatures.extract` repeats it. BOTH ARE RIGHT for a direct "
          "floor caller — `test_floor.py` test 2 pins it, 'a stanza break "
          "must not become a datapoint' — and this fix does not touch them")
    check("so the mandated pair L4/L5 falls off the end and is DROPPED",
          m.pairs0()[1][1] >= len(kept),
          "`if i >= len(lines) or j >= len(lines): continue` in "
          "`_relation_findings` — no finding, no count, no refusal")
    check("and the pair that IS graded is one the mandate never declared",
          (kept[0], kept[2]) == (BLANK_DRAFT[0], BLANK_DRAFT[3])
          and (1, 4) not in [(i, j) for i, j, _ in m.pairs()],
          "pairs0's (0, 2) lands on stripped[0]/stripped[2] = raw L1/L4")

    # -- the counterfactual: what the drop costs --------------------------
    rep = [f for f in blank_found if f.code == "REPEAT_IN_VERSE"]
    _mc, clean_found = _floor_as_inspect_would(BLANK_DRAFT_CLEAN, "AABB")
    rep_clean = [f for f in clean_found if f.code == "REPEAT_IN_VERSE"]
    check("COUNTERFACTUAL — blank-free, the DECLARED pair earns a FLAG",
          len(rep_clean) == 1 and rep_clean[0].severity == "flag"
          and rep_clean[0].locations == [3],
          f"{[(f.severity, f.locations) for f in rep_clean]} — L3/L4 of the "
          f"clean draft are L4/L5 of the raw one, and they close on the same "
          f"word. A flag is something `verify()` can reject on")
    check("with the blank, that flag is GONE and a note about an UNDECLARED "
          "pair stands in its place",
          len(rep) == 1 and rep[0].severity == "note"
          and rep[0].locations == [1],
          f"{[(f.severity, f.locations) for f in rep]} — 'only one rhyme "
          f"pair here' is true of the pair set the floor was left holding, "
          f"and that pair set is not the mandate. Two errors, one cause, and "
          f"the writer is told about neither")

    # -- the same seam, seen in `locations` -------------------------------
    _ml, lead_found = _floor_as_inspect_would(LEADING_BLANK, [[2, 4], [3, 5]])
    ana = [f for f in lead_found if f.code == "ANAPHORA_OVERLOAD"]
    truth = [i for i, l in enumerate(LEADING_BLANK, 1)
             if l.strip().lower().startswith("and")]
    check("EVERY floor finding's locations are enumerate()d over the "
          "STRIPPED list and filed by `inspect()` as RAW line numbers",
          len(ana) == 1 and ana[0].locations == [1, 2, 3, 4]
          and truth == [2, 3, 4, 5],
          f"ANAPHORA_OVERLOAD at {ana[0].locations if ana else None}, true "
          f"raw lines {truth}. L1 is the EMPTY line, so `brief()` briefs '' "
          f"and the last real line is never named by this finding at all")

    _mb, blank_cliche = _floor_as_inspect_would(BLANK_CLICHE, [[1, 3], [2, 4]])
    cli = [f for f in blank_cliche if f.code == "CLICHE_PAIR"]
    check("and the skew is not always off-by-one into another real line: "
          "here a FLAG is filed on the BLANK itself",
          len(cli) == 1 and cli[0].severity == "flag"
          and 1 in cli[0].locations and not BLANK_CLICHE[0].strip(),
          f"CLICHE_PAIR at {cli[0].locations if cli else None}; the pairs it "
          f"measured are raw L2/L4 and L3/L5. With this guard disarmed, "
          f"`revise_loop` on this draft returns stop_reason=no_progress and "
          f"its first attempt is `line 1 tier 1 accepted=False, 'no "
          f"candidates offered'` — the loop asking for a better end word "
          f"for ''")

    # -- the refusal ------------------------------------------------------
    for fn, args in (("mandate", (BLANK_DRAFT, "AXABB")),
                     ("grade", (BLANK_DRAFT, "AXABB")),
                     ("group_merges", (BLANK_DRAFT, "AXABB")),
                     ("inspect", (BLANK_DRAFT, "AXABB")),
                     ("brief", (BLANK_DRAFT, "AXABB")),
                     ("mandate_from_graph", (BLANK_DRAFT,)),
                     ("verify", (BLANK_DRAFT, list(BLANK_DRAFT), "AXABB"))):
        check(f"{fn}() refuses a draft with a blank line",
              _refuses(lambda f=fn, a=args: getattr(R, f)(*a)),
              "NoMandate — the same instrument `SC.mandate` uses for the "
              "sibling defect one coordinate over (a length mismatch), and "
              "every CLI verb already renders it `REFUSED …`, exit 2")
    try:
        R.mandate(BLANK_DRAFT, "AXABB")
        msg = ""
    except NoMandate as e:
        msg = str(e)
    check("the refusal NAMES THE LINE and names the seam",
          "L2" in msg and "SlopFloor.check" in msg and "RENUMBER" in msg,
          "doctrine 6: locate the defect, name the layer, hand it back. A "
          "refusal a caller cannot act on is a traceback with manners")

    # verify()'s own length gate CANNOT see this one — both drafts are five
    # lines and the blank sits at the same index in each — so the check has
    # to live at the mandate or nowhere.
    same = list(BLANK_DRAFT)
    same[4] = "and nothing else remained in pain"
    check("a blank at the SAME index in before AND after passes verify's "
          "length gate, so the mandate is where it has to be caught",
          len(BLANK_DRAFT) == len(same)
          and _refuses(lambda: R.verify(BLANK_DRAFT, same, "AXABB",
                                        targeted={5})),
          "len(before) == len(after) == 5, and `targeted={5}` is the "
          "CALLER's numbering into the raw list — the second coordinate a "
          "strip-then-mandate fix would have silently moved")
    check("a Mandate built over the RAW draft is the third: it carries "
          "n_lines=5, so stripping first would make this method refuse it "
          "for a length mismatch it does not have",
          SC.mandate("AXABB").n_lines == 5
          and _refuses(lambda: R.inspect(BLANK_DRAFT, SC.mandate("AXABB"))),
          "`schemes.mandate` refuses a Mandate whose n_lines disagrees with "
          "the draft; a strip would manufacture that disagreement")

    # -- the invariant the refusal buys -----------------------------------
    for name, lines, spec in (
            ("the clean 4-line draft", BLANK_DRAFT_CLEAN, "AABB"),
            ("the cliche fixture", CLICHE, "ABAB"),
            ("the leading-blank draft, blanks removed",
             [l for l in LEADING_BLANK if l.strip()], [[1, 3], [2, 4]])):
        res = R.inspect(lines, spec)
        locs = sorted({x for f in res["whole"] for x in f.locations}
                      | {x for fs in res["per_line"].values() for f in fs
                         for x in f.locations}
                      | set(res["per_line"]))
        check(f"every finding location is a real 1-based line of {name}",
              bool(locs) and all(1 <= x <= len(lines) for x in locs),
              f"{locs} over {len(lines)} lines — the invariant `inspect()` "
              f"always assumed and never held")
        check(f"and no brief on {name} is handed an empty line",
              all(b.text.strip() for b in R.brief(lines, spec)),
              "the loop's only move is a word swap on a named line, and "
              "there is no word to swap in ''")


#: The gap-2 blueprint. A section whose declared lines leave bars 5-8 with no
#: line on them at all, plus a LINELESS section — the archetypal instrumental,
#: and the case only the `sections` argument can reach. Constructed (doctrine
#: 94) because every blueprint shipped in `quality/fixtures/` covers every bar
#: it declares, which is exactly why nothing could see this gap.
_UB_BLUEPRINT = {
    "bpm": 120, "meter": "4/4",
    "sections": [{"name": "verse1", "bars": 12, "start_bar": 1,
                  "function": "verse",
                  "meter": {"beats": 4, "unit": 4, "groups": [2, 2]}},
                 {"name": "solo", "bars": 4, "start_bar": 13,
                  "meter": {"beats": 4, "unit": 4, "groups": [2, 2]}}],
    "lines": [
        {"text": "the harbour lights came on across the bay",
         "bar": 1, "beat": 1, "duration": 8, "section": "verse1"},
        {"text": "a bell rang somewhere out beyond the pier",
         "bar": 3, "beat": 1, "duration": 8, "section": "verse1"},
        {"text": "we counted every boat that slipped away",
         "bar": 9, "beat": 1, "duration": 8, "section": "verse1"},
        {"text": "and one more sail went drifting toward the weir",
         "bar": 11, "beat": 1, "duration": 8, "section": "verse1"}]}
_UB_LINES = [l["text"] for l in _UB_BLUEPRINT["lines"]]


def test_substituted_end_word_reaches_the_loop():
    print("\n36. `readability.substitution_report` REACHES `inspect()` — the "
          "sharper half of known gap 8, which the gap-8 wiring did not take")
    m12 = SC.mandate([[1, 2]], n_lines=4)
    # DISCRIMINATING, and constructed so the substitute is the trap the
    # function's own docstring names: `sheer` is a plausible English word AND
    # it rhymes with L2's `pier`, so a path that took the last word it could
    # READ would report L4 as answering its group cleanly. `zong` is Barnes's
    # Dorset spelling and CMUdict has no entry for it.
    draft = ["the harbour lights came on across the bay",
             "a bell rang somewhere out beyond the pier",
             "we counted every boat that slipped away",
             "and one more went out sailing to the sheer zong"]
    res = R.inspect(draft, m12)
    got = _find(res, "SUBSTITUTED_END_WORD")
    check("the loop is told WHICH WORD would have been substituted — before "
          "the wiring `substitution_report`'s only callers were "
          "`readability.main()`, which prints a COUNT and never a word, and "
          "one test",
          len(got) == 1 and got[0].locations == [4]
          and "'zong'->'sheer'" in got[0].message,
          got[0].message if got else "not emitted")
    check("...and it is filed on the LINE it is about, so a writer reading "
          "L4's brief sees it",
          4 in res["per_line"]
          and any(f.code == "SUBSTITUTED_END_WORD" for f in res["per_line"][4]))
    check("it is a NOTE, and NOT a downgrade: `readability.report` already "
          "says note, so `inspect` re-decides nothing here",
          bool(got) and got[0].severity == "note"
          and RD.report(R.lex, draft)["findings"][-1].severity == "note",
          f"severity {got[0].severity!r}" if got else "")
    check("it is not a SECOND CHARGE, and it says so: this line is already "
          "flagged by UNREADABLE_END_WORD and what the note adds is the word",
          bool(_find(res, "UNREADABLE_END_WORD"))
          and "NOT A SECOND CHARGE" in got[0].evidence)

    # HOW MUCH THIS ACTUALLY BUYS, AND IT IS NARROWER THAN A NEW CODE LOOKS.
    # 8,840 of 8,842 English-corpus substitution lines are ALREADY
    # UNREADABLE_END_WORD, so on nearly all of them the LINE was never silent
    # and only the WORD was. The residue is 2, and this is one of them: a
    # final token that READS (`mm` -> ['M']) and syllabifies to nothing, so
    # `line_anchors` returns an anchor built on the PREVIOUS word,
    # `final_unreadable` is False, and every other code in either module
    # stays silent. Doctrine 79 in the other direction: do not let one code
    # take credit for a population another code already covers.
    byron = _RD_HEAD[:2] + [
        "And the foam of his gasping lay white on the turf,[mm]"]
    solo = R.inspect(byron, SC.mandate([[1, 2]], n_lines=3))
    codes = {f.code for f in solo["per_line"].get(3, [])}
    check("the RESIDUE: on a real corpus line whose end token READS and "
          "yields no syllable, this is the ONLY readability finding there "
          "is — 2 lines of 151,894, and nothing reached them before",
          codes == {"SUBSTITUTED_END_WORD"},
          f"codes on Byron's `...on the turf,[mm]`: {sorted(codes)}; "
          f"whole draft: "
          f"{sorted({f.code for fs in solo['per_line'].values() for f in fs})}")

    # -- THE STOP CONDITIONS ARE UNMOVED, the same check test 34 makes ------
    from quality.loop import revise_loop
    lr = revise_loop(R, draft, m12)
    check("`revise_loop` still returns SUCCESS: a per-line NOTE is briefed "
          "and disclosed and starts no round",
          lr.stop_reason == "success" and not lr.unresolved,
          f"{lr.stop_reason}, {len(lr.rounds)} round(s)")

    # -- NON-DISCRIMINATING, and it is the input a reader reaches for first -
    check("NON-DISCRIMINATING: a fully readable draft emits nothing, so the "
          "code cannot pass for the wrong reason",
          not _find(R.inspect(_RD_HEAD + ["and somewhere out beyond it sang "
                                          "a lark"], m12),
                    "SUBSTITUTED_END_WORD"))
    check("NON-DISCRIMINATING, second cause: the PIECE half of the same "
          "defect is NOT a substitution — `hill-zide` keeps its own token in "
          "the syllable map, so 174 of the 9,252 unreadable-final lines are "
          "correctly silent here",
          not _find(R.inspect(_RD_PIECE, m12), "SUBSTITUTED_END_WORD")
          and bool(_find(R.inspect(_RD_PIECE, m12),
                         "UNREADABLE_END_WORD_PIECE")))


def test_uncovered_bars_reaches_the_loop_not_only_fit():
    print("\n37. `UNCOVERED_BARS` reaches `Reviser._meter_findings` — a "
          "SECTION-level relation, taken off the flat list the same way "
          "`overlap_findings` was")
    sub = FT.Subdivision(slots_per_pulse=2, source="test 37")
    m = SC.mandate("ABAB", n_lines=4)

    song = FT.fit_song(_UB_BLUEPRINT, subdivision=sub)
    rows = {r["section"]: r["uncovered_bars"] for r in song.table()}
    check("the `fit` verb has always had this: its table prints 4 empty bars "
          "in `verse1` and a wholly empty `solo`",
          rows == {"verse1": (5, 6, 7, 8), "solo": (13, 14, 15, 16)},
          f"{rows}")

    res = R.inspect(_UB_LINES, m, blueprint=_UB_BLUEPRINT, subdivision=sub)
    ub = _find(res, "UNCOVERED_BARS")
    check("the revision loop now reports what the `fit` verb reports — "
          "before the wiring `inspect()` returned eleven distinct codes on a "
          "blueprint like this and NOT ONE was about a bar nobody sings",
          len(ub) == 2
          and sorted(f.message.split("section ")[1].split("'")[1]
                     for f in ub) == ["solo", "verse1"],
          f"{[f.message for f in ub]}")
    check("the LINELESS section is among them, and only the declared section "
          "list can reach it — `solo` contributes no LineFit at all",
          any("'solo'" in f.message for f in ub),
          "an instrumental break declared as bars and never written to is "
          "the archetypal case for a check named `uncovered_bars`")

    # THE SAME ARITHMETIC, NOT A SECOND COPY -- the invariant test 35 pins
    # for `overlap_findings`, applied to this one.
    check("the message and evidence are byte-identical to the `fit` "
          "surface's — one function, two callers",
          sorted((f.message, f.evidence) for f in song.section_findings)
          == sorted((f.message, f.evidence) for f in ub))

    # -- THE CHARGE, WHICH IS THE DECISION THIS WIRING MAKES ---------------
    check("WHOLE-DRAFT, and it names NO LINE: bar/beat/duration are exactly "
          "what the writer declared on every one of these lines, and no "
          "rewrite of any line's WORDS moves the answer",
          all(f.locations == [] for f in ub)
          and not any(f.code == "UNCOVERED_BARS"
                      for fs in res["per_line"].values() for f in fs),
          f"locations {[f.locations for f in ub]}")
    check("it is a NOTE, and `revise.py` forms no second opinion: `fit.py` "
          "marks it satisfiable and this method's `satisfiable`->severity "
          "rule is the one the per-line loop above it already uses",
          all(f.severity == "note" for f in ub)
          and all(f.satisfiable for f in song.section_findings),
          "an empty bar is a rest, an instrumental, or a melisma this layer "
          "declares itself unable to see (doctrine 6)")

    # THE COUNTERFACTUAL, MEASURED RATHER THAN ARGUED, and it is the reason
    # the two decisions above are not interchangeable. `revise.py`'s own
    # readability block records the price of a flag the loop has no move for:
    # "it returns NO_PROGRESS after 1 round with L4 permanently unresolved
    # ... the cost is a destroyed SUCCESS". Charged PER LINE as a flag, this
    # finding is exactly that shape -- the loop's only move is a word swap on
    # a named line, and no word swap covers a bar.
    from quality.loop import revise_loop
    shipped = revise_loop(R, _UB_LINES, m, blueprint=_UB_BLUEPRINT,
                          subdivision=sub)
    check("SHIPPED (whole-draft note): the loop returns SUCCESS in 0 rounds "
          "and carries the finding out in `LoopResult.whole`",
          shipped.stop_reason == "success" and not shipped.unresolved
          and any(f.code == "UNCOVERED_BARS" for f in shipped.whole),
          f"{shipped.stop_reason}, {len(shipped.rounds)} round(s), "
          f"whole={[f.code for f in shipped.whole]}")

    _orig = RV.Reviser._meter_findings

    def _as_per_line_flag(self, lines, blueprint, subdivision, assume=None):
        per, whole = _orig(self, lines, blueprint, subdivision, assume=assume)
        keep = []
        for f in whole:
            if f.code != "UNCOVERED_BARS":
                keep.append(f)
                continue
            sec = f.message.split("section ")[1].split("'")[1]
            _s, places = FT.from_blueprint(blueprint)
            for i, p in enumerate(places):
                if p.section == sec:
                    per.setdefault(i + 1, []).append(RV.Finding(
                        f.code, "flag", f.message, f.evidence, [i + 1]))
        return per, keep

    try:
        RV.Reviser._meter_findings = _as_per_line_flag
        counter = revise_loop(R, _UB_LINES, m, blueprint=_UB_BLUEPRINT,
                              subdivision=sub)
        briefs = R.brief(_UB_LINES, m, blueprint=_UB_BLUEPRINT,
                         subdivision=sub)
    finally:
        RV.Reviser._meter_findings = _orig
    check("COUNTERFACTUAL (per-line flag): the identical draft returns "
          "NO_PROGRESS with EVERY line permanently unresolved — SUCCESS "
          "destroyed, which is the measured price `inspect()`'s own comment "
          "records for a flag the loop has no move for",
          counter.stop_reason == "no_progress"
          and sorted(b.line_no for b in counter.unresolved) == [1, 2, 3, 4],
          f"{counter.stop_reason}, {len(counter.rounds)} round(s), "
          f"unresolved {sorted(b.line_no for b in counter.unresolved)} "
          f"— against SUCCESS in 0 rounds at head")
    check("...and the brief it produces is empty of candidates on 3 of the 4 "
          "lines: the code is in no candidate-bearing family, so each line "
          "would be briefed, attempted and never resolved",
          sum(1 for b in briefs if not b.candidates) == 3,
          f"candidate fields {[len(b.candidates) for b in briefs]}")

    # -- `verify()`, WHERE A NEW CODE BITES -------------------------------
    # Coverage is a function of the BLUEPRINT alone, so it is identical on
    # both sides of any word swap and cancels out of the multiset diff. That
    # is what makes the note safe rather than merely mild: it cannot reject,
    # and it could not reject even if it were a flag.
    broken = _UB_LINES[:3] + ["and one more sail went drifting toward the "
                              "kitchen"]
    v = R.verify(broken, _UB_LINES, m, targeted=[4],
                 blueprint=_UB_BLUEPRINT, subdivision=sub)
    check("a word swap cannot move bar coverage, so UNCOVERED_BARS lands in "
          "neither `fixed` nor `new` and can never reject a revision",
          not any(c == "UNCOVERED_BARS" for _, c in v["new"])
          and not any(c == "UNCOVERED_BARS" for _, c in v["fixed"]),
          f"new {v['new']}, fixed {v['fixed']}")

    # NON-DISCRIMINATING, and it is why the gap survived: every shipped
    # blueprint covers every bar it declares.
    clean = os.path.join(HERE, "fixtures", "mandate_song.blueprint.json")
    cres = FT.fit_song(clean, subdivision=sub)
    check("NON-DISCRIMINATING: the shipped blueprint has NO uncovered bar, "
          "so it reports zero either side of the wiring — no existing "
          "fixture could see this gap (doctrine 94, aimed at a fixture set)",
          not cres.section_findings
          and all(r["uncovered_bars"] == () for r in cres.table()))


def test_a_holding_requirement_is_not_fixed_by_breaking_it():
    """39. `verify()` paid a revision for breaking a chorus.

    `fixed` was `set(cb - ca)` over EVERY code, so a finding that named
    something RIGHT counted as repaired the moment the revision destroyed
    the thing it named. Measured before the split, on the fixture below:

        accepted : True
        fixed    : [(0, 'RETURN_LOCKED')]
        new_flags: []          new_notes: []
        reasons  : ['fixed 1, introduced 0, changed only [7]']

    THE DECLARED HALF WAS NEVER EXPOSED and this test says so in its own
    third check: a return declared with `Return(verbatim=True)` raises
    `RETURN_NOT_VERBATIM`, a FLAG, and the net-new gate rejects on it. Only
    the CONVENTION half was reachable, because `grid.py`'s only flag is
    `HOOK_ABSENT` -- so the fix DISCLOSES rather than rejects (doctrine 6),
    and the rejection comes from `fixed` being correctly empty instead.
    """
    print("\n39. a requirement that HOLDS is not repaired by ending it")
    import quality.schemes as _SC
    M = {"beats": 4, "unit": 4, "groups": [2, 2]}

    def _sec(n, fn, s):
        return {"name": n, "function": fn, "bars": 4, "start_bar": s,
                "meter": dict(M)}
    CH = ["count me out slow",
          "the river counts the stones it drags all night"]
    base = (["the dock lights stutter on the bay",
             "the kettle on the stove had caught the light"] + CH +
            ["the winter came and took the day",
             "he never taught the knot that night"] + CH)
    bp = {"sections": [_sec("v1", "verse", 1), _sec("c1", "chorus", 5),
                       _sec("v2", "verse", 9), _sec("c2", "chorus", 13)],
          "lines": [{"text": t, "bar": b, "beat": 1, "duration": 4}
                    for t, b in zip(base, [1, 2, 5, 6, 9, 10, 13, 14])]}
    m = _SC.mandate("ABXXABXX")

    found = R.inspect(list(base), m, blueprint=bp)
    check("the two chorus instances are verbatim, so RETURN_LOCKED holds",
          any(f.code == "RETURN_LOCKED" for f in found["whole"]),
          sorted({f.code for f in found["whole"]}))

    # BREAK-ONLY: the revision's entire accomplishment is ending the return.
    only = list(base)
    only[6] = "count me down slow"
    r1 = R.verify(base, only, m, targeted={7}, blueprint=bp)
    check("a revision whose ONLY effect is ending the return is REJECTED -- "
          "it was accepted before, on the strength of the record it destroyed",
          r1["accepted"] is False and r1["fixed"] == []
          and r1["broken"] == [(0, "RETURN_LOCKED")],
          f"accepted={r1['accepted']} fixed={r1['fixed']} "
          f"broken={r1['broken']}")
    check("...and the reason says which half it is, rather than 'nothing "
          "was fixed' alone",
          "regression and not a repair" in r1["reasons"][0],
          r1["reasons"][0][:120])

    # A REAL REPAIR that incidentally ends it: accepted, and DISCLOSED.
    both = list(base)
    both[1] = "the kettle on the stove had taken flight"   # offered, non-modal
    both[6] = "count me down slow"
    r2 = R.verify(base, both, m, targeted={2, 7}, blueprint=bp)
    check("a genuine repair that incidentally ends it is ACCEPTED and says "
          "so -- doctrine 6, the return is convention-measured and a writer "
          "may depart from it",
          r2["accepted"] is True and r2["broken"] == [(0, "RETURN_LOCKED")]
          and "ENDING 1 holding requirement/licence" in r2["reasons"][0],
          f"accepted={r2['accepted']} broken={r2['broken']} :: "
          f"{r2['reasons'][0][:110]}")

    # THE DECLARED HALF, which never needed this fix and must not lose its flag.
    dec = ["we counted every reason we were given",
           "the kettle on the stove had caught the light",
           "we counted every reason we were given",
           "the morning came and did not care that night"]
    dm = _SC.mandate([[1, 3], [2, 4]], n_lines=4, returns=[[1, 3]])
    broke = list(dec)
    broke[0] = "we counted every reason we were driven"
    r3 = R.verify(dec, broke, dm, targeted={1})
    check("a DECLARED verbatim return still rejects on its own FLAG, so this "
          "split changed nothing there",
          r3["accepted"] is False
          and (3, "RETURN_NOT_VERBATIM") in r3["new_flags"],
          f"accepted={r3['accepted']} new_flags={r3['new_flags']}")

    check("MANDATE_EXCUSED_BY_OVERLAP is NOT in the set -- it records a pair "
          "that FAILED and was excused, so its removal IS a repair",
          "MANDATE_EXCUSED_BY_OVERLAP" not in SATISFACTION_FINDINGS,
          sorted(SATISFACTION_FINDINGS))


def test_the_mandate_block_is_gated_on_the_mandate():
    """The brief's MANDATE block and its CANDIDATE FIELD are two gates.

    FOUND 2026-08-16 BY WRITING A SONG THROUGH `--propose=defer:`, not by
    reading the code, and it took a WRITER to find: the stub proposer never
    reads the mandate block and never reasons about a word it was offered,
    so no run before this one could see it (`quality/
    COVERAGE_PREREGISTRATION.md`, rung 1).

    `brief()` gated BOTH on `wants and groups` -- `wants` being "this line
    carries a finding in `RHYME_FINDINGS`". So a line flagged for METER
    ALONE while sitting in a mandated group got NO `must_answer`, and
    `quality/propose.py`'s `_mandate_block`, with nothing to print, fell
    through to `(no rhyme group declared for this line)`. That sentence
    states something about the MANDATE; the condition that produced it is
    about the FINDING SET. One question, two readings, and the rendered one
    is FALSE (doctrine 1).

    THE COST IS NOT THE SENTENCE. Told no group existed, the writer fixed
    the meter by shortening the line and moved its END WORD -- and
    `verify()` accepted, correctly by its own rules, so the word the other
    half of the only mandated pair has to answer changed in silence.

    THE FIELD IS STILL GATED ON `wants`, and check 4 is that half: a
    meter-only line is not handed rhyme words it has no use for, which is
    `brief()`'s own long-standing argument and is unaffected. Check 5 is the
    CONTROL that makes this a repair rather than a deletion -- a line in NO
    mandated group must still get the default sentence, or the fix would
    have been to stop saying anything.
    """
    print("\n40. the MANDATE block is gated on the MANDATE, and the "
          "CANDIDATE FIELD on the finding set -- two gates, not one")
    from quality import propose as _PR
    import quality.fit as _FT
    import quality.schemes as _SC2

    # L1/L2 are group A and do not rhyme (four ~ stairs, 0.612 NO_RELATION);
    # L3 is in NO group. All three overflow their bar at subdivision 2, so
    # every line is briefed and L1/L3 carry METER findings and no rhyme one.
    lines = ["the kitchen light is burning at half past four",
             "and nobody came back to climb the stairs",
             "a radio nobody remembered to switch off"]
    bp = {"_note": "constructed inline for this regression -- deliberately "
                   "NOT a fixture file: it is three lines built to put a "
                   "meter flag on a mandated line, not a song",
          "sections": [{"name": "V1", "bars": 3, "start_bar": 1,
                        "meter": {"beats": 4, "unit": 4, "groups": [2, 2]}}],
          "lines": [{"text": t, "bar": i + 1, "beat": 1, "duration": 4,
                     "section": "V1"} for i, t in enumerate(lines)]}
    R = Reviser()
    m = _SC2.mandate([[1, 2]], n_lines=3)
    sub = _FT.Subdivision(2, source="constructed for this regression")

    found = R.inspect(lines, m, blueprint=bp, subdivision=sub)
    codes1 = {f.code for f in found["per_line"].get(1, ())}
    check("the premise: L1 carries a METER flag and NO rhyme finding, so "
          "the old `wants` gate was False on a line the mandate speaks about",
          "SLOTS_EXCEEDED" in codes1
          and not (codes1 & RV.RHYME_FINDINGS),
          f"L1 codes {sorted(codes1)}")
    check("...and the mandate DOES speak about it -- this is the fact the "
          "brief was contradicting",
          m.groups_of(1) == [0] and m.labels[0] == "A"
          and m.requirement(1, 2) is _SC2.REQUIRE_RHYME,
          f"groups_of(1)={m.groups_of(1)} requirement={m.requirement(1, 2)}")

    briefs = {b.line_no: b for b in R.brief(lines, m, blueprint=bp,
                                            subdivision=sub)}
    b1 = briefs.get(1)
    check("L1's brief NAMES its group and the word it must answer, with no "
          "rhyme finding anywhere on the line",
          b1 is not None and b1.must_answer == [("A", [1, 2], [(2,
                                                               "stairs")])]
          and b1.must_rhyme_with == (2, "stairs"),
          f"must_answer={b1.must_answer if b1 else '?'}")
    check("...and it is handed NO candidate field and NO forbidden set: the "
          "OFFER stays gated on the finding set, so a meter-only line is "
          "never given rhyme words it has no use for",
          b1 is not None and not b1.candidates and not b1.forbidden_modal
          and not b1.forbidden_incumbent and b1.joint_conflict is False,
          f"candidates={len(b1.candidates) if b1 else '?'} "
          f"forbidden={b1.forbidden_modal if b1 else '?'}")

    p1 = _PR.render_line(b1, lines, whole=found["whole"])
    check("the TIER-1 PROMPT -- the surface a writer actually reads -- no "
          "longer claims no group was declared, and states the group instead",
          "(no rhyme group declared for this line)" not in p1
          and "group A [1, 2] — this line must rhyme with: L2 ('stairs')"
          in p1,
          [l.strip() for l in p1.splitlines()
           if "group" in l and "rhyme" in l][:2])

    b3 = briefs.get(3)
    check("CONTROL: L3 is in NO mandated group and STILL gets the default "
          "sentence -- the repair states a fact, it does not delete a line "
          "of the prompt",
          b3 is not None and not b3.must_answer
          and "(no rhyme group declared for this line)"
          in _PR.render_line(b3, lines, whole=found["whole"]),
          f"L3 must_answer={b3.must_answer if b3 else '?'}")

    b2 = briefs.get(2)
    check("CONTROL: L2 -- which carries SCHEME_VIOLATION -- is unchanged: "
          "group named, field offered, modal head forbidden, exactly as "
          "before the split",
          b2 is not None and b2.must_answer
          and b2.candidates and b2.forbidden_modal,
          f"candidates={len(b2.candidates) if b2 else '?'} "
          f"forbidden={len(b2.forbidden_modal) if b2 else '?'}")


def test_rule_three_asks_whether_a_word_was_taken():
    """`revise` and `verify` disagreed about the same before/after pair.

    FOUND 2026-08-16 BY RUNNING `verify` ON A DRAFT `revise` HAD JUST
    CONVERGED ON — the rung-1 re-run, `quality/COVERAGE_PREREGISTRATION.md`.
    The loop returned SUCCESS; the verb, handed the identical pair with the
    same mandate, blueprint and subdivision, returned `REJECTED — L2 took the
    modal candidate 'stairs'`. One question, two answers, from two surfaces of
    one module (doctrine 1).

    AND THE REJECTION'S OWN SENTENCE WAS FALSE. L2 did not TAKE 'stairs' — it
    already ended on 'stairs' and was revised elsewhere in the line, for its
    METER. `forbidden_modal` CARRIED two rules at once: the modal head
    (doctrine 9) and `brief()`'s incumbent clause, *"the word currently there
    is itself excluded"*. Check 1 measures that `stairs` was on the list ONLY
    by the second, so the message named the rule that did not fire.
    (The two rules are two fields as of the same day — see §42 — so check 4
    now reads the disclosure off `forbidden_incumbent`. This section is kept
    on the CONFLATED story it was written for because that is the history the
    fix is answering; §42 owns the split itself.)

    THE FIX IS THAT TAKING REQUIRES A CHANGE. Doctrine 9 is about REACHING for
    the obvious answer, and a byte-identical end word reached for nothing.
    Check 4 is the control that keeps the rule alive: a revision that really
    does land on a modal candidate is still rejected, in the same words.
    """
    print("\n41. RULE 3 asks whether a modal candidate was TAKEN, and "
          "`revise`/`verify` agree about one before/after pair")
    from quality import loop as _LP
    import quality.fit as _FT

    before = ["the kitchen light is burning at half past four",
              "and nobody came back to climb the stairs"]
    bp = {"_note": "constructed inline for this regression, not a fixture",
          "sections": [{"name": "V1", "bars": 2, "start_bar": 1,
                        "meter": {"beats": 4, "unit": 4, "groups": [2, 2]}}],
          "lines": [{"text": t, "bar": i + 1, "beat": 1, "duration": 4,
                     "section": "V1"} for i, t in enumerate(before)]}
    R = Reviser()
    sub = _FT.Subdivision(2, source="constructed for this regression")
    kw = dict(blueprint=bp, subdivision=sub)

    # 'four' ~ 'stairs' fails the mandate; L1 answering on 'glares' repairs
    # the pair AND its own SLOTS_EXCEEDED, so L2 then needs only its meter.
    ANSWERS = ["at four the kitchen light still glares",
               "and nobody climbed the stairs"]

    off, forb_ex = R.modal_field("four", exclude=("stairs",))
    _o2, forb_raw = R.modal_field("four")
    check("PREMISE: 'stairs' is NOT a modal candidate for 'four' under "
          "either spelling — it reaches `forbidden_modal` only as the "
          "INCUMBENT, so the old message named the rule that did not fire",
          "stairs" not in forb_ex and "stairs" not in forb_raw,
          f"excluded={forb_ex} raw={forb_raw}")

    seq = list(ANSWERS)

    def propose(brief, lines, attempt, reasons=None, whole=()):
        return seq.pop(0) if seq else None

    res = _LP.revise_loop(R, before, "AA", propose=propose, **kw)
    check("PREMISE: the loop converges on this pair",
          res.stop_reason == "success" and list(res.lines) == ANSWERS,
          f"{res.stop_reason} -> {list(res.lines)}")

    v = R.verify(before, list(res.lines), "AA", **kw)
    check("`verify` on the draft the LOOP emitted now ACCEPTS it — the two "
          "surfaces answer one question the same way",
          v["accepted"] is True,
          f"accepted={v['accepted']} reasons={v['reasons']}")
    check("...and the skip is DISCLOSED rather than swallowed: 'kept a "
          "forbidden word' and 'was never on the list' are different "
          "outcomes (doctrine 20)",
          v.get("modal_endword_unchanged") == [(2, "stairs")]
          and any("KEPT its end word" in r for r in v["reasons"])
          and not any("took the modal candidate" in r for r in v["reasons"]),
          f"{v.get('modal_endword_unchanged')}")

    # CONTROL — the rule is still load-bearing in the direction it was
    # written for: a revision that lands ON a modal candidate is refused,
    # in the same words, before anything else about the line is looked at.
    took = [before[0], "and nobody came back to open the door"]
    v2 = R.verify(before, took, "AA", **kw)
    check("CONTROL: a revision that genuinely TAKES a modal candidate is "
          "still rejected outright, and still says so",
          v2["accepted"] is False
          and v2.get("modal_violations") == [(2, "door")]
          and any("took the modal candidate 'door'" in r
                  for r in v2["reasons"]),
          f"accepted={v2['accepted']} hits={v2.get('modal_violations')}")
    check("CONTROL: and it is refused BEFORE the fixed/new accounting — "
          "rule 3 rejects on its own, so the run stops there",
          "new_flags" in v2 and not any("nothing was fixed" in r
                                        for r in v2["reasons"])
          and len(v2["reasons"]) == 1,
          f"{v2['reasons']}")

    # THE COROLLARY, AND IT CLOSES THE SECOND HALF OF THE SAME REPORT BUG.
    # `forbidden_modal` is `modal_head + [cur]`, and `cur` IS the before
    # end word, so `got == cur` now implies `got == was` and is skipped.
    # `modal_violations` is therefore a SUBSET OF THE MODAL HEAD by
    # construction — which is what makes the sentence "took the modal
    # candidate" true of every entry it can ever hold, rather than true of
    # most of them. Asserted rather than left as an argument.
    check("COROLLARY: `modal_violations` can now only ever name a word "
          "from the MODAL HEAD, never the incumbent — so the message "
          "'took the modal candidate' is true by construction",
          all(w in forb_ex for _ln, w in v2.get("modal_violations", []))
          and "door" in forb_ex,
          f"hits={v2.get('modal_violations')} head={forb_ex}")


def test_the_forbidden_list_is_two_rules_in_two_fields():
    """One list answered two questions and every renderer named only one.

    `brief()` built `forbidden_modal` as the modal head (doctrine 9 — do not
    pass the band by reaching for the most predictable word) and then APPENDED
    the incumbent (`brief()`'s own clause: re-proposing the word already there
    is not a revision). Nothing marked which entry came from which rule, so
    three renderers labelled the whole list doctrine 9 and `verify()` rejected
    an incumbent as "the modal candidate" (§41).

    THE OVERLAP IS REAL AND DELIBERATE, which is why this is a split and not a
    move: a word can be the incumbent AND genuinely modal, and check 3 proves
    that happens on this repo's own fixture. Subtracting the incumbent from
    the head would make `verify()` stop rejecting a revision that MOVES a
    DIFFERENT line onto it.

    THE SPLIT IS ALSO WHAT KEEPS `verify()` HONEST. RULE 3's two branches now
    read a field each: `modal_hits` off the head, `modal_kept` off the
    incumbent. Gating the loop on the head alone would have deleted the
    doctrine-20 disclosure outright — measured, and check 5 is that guard.
    """
    print("\n42. the FORBIDDEN list is TWO RULES, and they are two fields")
    from quality import propose as _PR
    import quality.fit as _FT

    R = Reviser()
    b = [x for x in R.brief(CLICHE, "ABAB") if x.line_no == 1][0]
    check("the modal head no longer carries the incumbent as a member "
          "APPENDED to it — the two are separate fields",
          isinstance(b.forbidden_incumbent, str) and b.forbidden_incumbent,
          f"head={b.forbidden_modal} incumbent={b.forbidden_incumbent!r}")

    # The four-line probe from §41: L1/L2 are group A and do NOT rhyme, so L2
    # carries a real field whose incumbent 'stairs' is provably NOT modal for
    # the call 'four'. This is the repo's one ready-made witness where the two
    # rules DISAGREE about a word.
    before = ["the kitchen light is burning at half past four",
              "and nobody came back to climb the stairs"]
    b2 = [x for x in R.brief(before, "AA") if x.line_no == 2][0]
    check("on a line whose end word is NOT modal for its call, the head "
          "excludes it and the incumbent field carries it — one word, one "
          "rule, and the two lists disagree",
          "stairs" not in b2.forbidden_modal
          and b2.forbidden_incumbent == "stairs",
          f"head={b2.forbidden_modal} incumbent={b2.forbidden_incumbent!r}")

    # CONTROL — the fields OVERLAP where both rules genuinely apply, and this
    # is the case that made test_verbs §22's equality pass for an unstated
    # reason. Asserted so a later lot cannot "tidy" the overlap away.
    MODAL_DRAFT = ["the bank foreclosed and boarded up the town",
                   "the freight train left the siding after four",
                   "we packed the truck and never once looked down",
                   "and drove until the county line was more"]
    b3 = [x for x in R.brief(MODAL_DRAFT, [[1, 3], [2, 4]])
          if x.line_no == 3][0]
    check("CONTROL: where the incumbent is ALSO genuinely modal the two "
          "fields OVERLAP, and that is deliberate — subtracting it from the "
          "head would stop `verify()` rejecting a DIFFERENT line that moves "
          "onto the same word",
          b3.forbidden_incumbent == "down"
          and "down" in b3.forbidden_modal,
          f"head={b3.forbidden_modal} incumbent={b3.forbidden_incumbent!r}")

    # THE PRECISION CONSTRAINT. `verify()` RULE 3 compares the incumbent
    # against `_endword(before[ln - 1])`; if the field were populated by any
    # other route the corollary that makes "took the modal candidate" true by
    # construction would stop holding. `_endword` lowercases and strips
    # boundary apostrophes and hyphens, so it is not a raw token compare.
    check("the incumbent field is EXACTLY `_endword` of the line, the same "
          "function RULE 3 compares against",
          b2.forbidden_incumbent == R.floor.qf._endword(before[1]),
          f"{b2.forbidden_incumbent!r} vs "
          f"{R.floor.qf._endword(before[1])!r}")

    # THE DISCLOSURE SURVIVES THE SPLIT — this is the one hard break a naive
    # head-only split causes, and RULE 3's gate is what prevents it.
    sub = _FT.Subdivision(2, source="constructed for this regression")
    bp = {"_note": "constructed inline for this regression, not a fixture",
          "sections": [{"name": "V1", "bars": 2, "start_bar": 1,
                        "meter": {"beats": 4, "unit": 4, "groups": [2, 2]}}],
          "lines": [{"text": t, "bar": i + 1, "beat": 1, "duration": 4,
                     "section": "V1"} for i, t in enumerate(before)]}
    after = ["at four the kitchen light still glares",
             "and nobody climbed the stairs"]
    v = R.verify(before, after, "AA", blueprint=bp, subdivision=sub)
    check("`verify()` still DISCLOSES a kept incumbent that is not modal — "
          "gating RULE 3 on the head alone would have deleted this outright",
          v["accepted"] is True
          and v.get("modal_endword_unchanged") == [(2, "stairs")],
          f"accepted={v['accepted']} kept={v.get('modal_endword_unchanged')}")
    check("...and the disclosure now NAMES the incumbent rule rather than "
          "saying 'on this line's forbidden list'",
          any("the INCUMBENT, not a modal candidate" in r
              for r in v["reasons"]),
          [r for r in v["reasons"] if "KEPT" in r][:1])

    # CONTROL — doctrine 9's own rejection is untouched by the split.
    took = [before[0], "and nobody came back to open the door"]
    v2 = R.verify(before, took, "AA", blueprint=bp, subdivision=sub)
    check("CONTROL: moving onto a modal-head word is still rejected outright",
          v2["accepted"] is False
          and v2.get("modal_violations") == [(2, "door")],
          f"accepted={v2['accepted']} hits={v2.get('modal_violations')}")

    # THE RENDERERS. Each must state the rule it is about, and the tier-1
    # prompt is the only channel that ever told a writer about rule 2 at all.
    p = _PR.render_line(b2, before, whole=())
    check("the tier-1 prompt gives each rule its OWN block, its OWN count "
          "and its OWN consequence — and no longer says 'do not END on', "
          "which is false of a word the line keeps",
          "FORBIDDEN — do not MOVE L2 TO any of these (6)" in p
          and "THE WORD ALREADY THERE — a DIFFERENT rule" in p
          and "\n  stairs\n" in p
          and "do not end L2 on any of these" not in p,
          [l for l in p.splitlines()
           if "FORBIDDEN" in l or "ALREADY THERE" in l])
    check("...and the prompt's restatement of RULE 3 no longer promises a "
          "rejection the grader does not make",
          "MOVES TO is not one of the FORBIDDEN words above" in p
          and "KEEPING the" in p and "is not a move and is not rejected" in p,
          [l.strip() for l in p.splitlines() if l.strip().startswith("3.")])
    s = str(b2)
    check("`Brief.__str__` states both rules, and no longer prints the "
          "incumbent under doctrine 9's sentence",
          "FORBIDDEN (modal" in s and "ALREADY THERE (not a modal word" in s
          and "stairs" not in s.split("ALREADY THERE")[0].split(
              "FORBIDDEN (modal")[-1].split("\n")[0],
          [l.strip() for l in s.splitlines()
           if "FORBIDDEN" in l or "ALREADY THERE" in l])


if __name__ == "__main__":
    for fn in (test_the_loop_does_not_write,
               test_the_brief_excludes_the_modal_region,
               test_a_revision_may_not_trade_one_defect_for_another,
               test_reject_taking_the_modal_candidate,
               test_reject_rewriting_untargeted_lines,
               test_reject_restructuring,
               test_reject_a_no_op,
               test_accept_a_real_fix,
               test_verify_never_returns_a_score,
               test_no_mandate_is_a_refusal_not_a_pass,
               test_every_way_of_declaring_the_same_mandate_agrees,
               test_an_overlapping_cover_is_gradeable,
               test_the_group_grader_reproduces_check_scheme,
               test_the_song_the_loop_could_not_grade,
               test_a_derived_cover_is_independent_at_another_theta,
               test_findings_are_not_printed_six_times,
               test_x_is_not_a_rhyme_class_in_the_floor_either,
               test_a_declared_return_is_not_slop,
               test_the_field_is_the_graders_own_field,
               test_no_joint_candidate_was_a_coordinate_of_a_literal,
               test_the_four_rejections_on_the_songs_own_shape,
               test_what_the_loop_can_say_on_the_declared_mandate,
               test_the_modal_set_against_a_declared_reference,
               test_the_collision_set_is_partitioned_not_silenced,
               test_why_a_collision_earns_no_field,
               test_meter_folds_into_the_same_finding_set,
               test_grade_asks_the_mandate_before_the_switch,
               test_song_function_folds_into_the_same_finding_set,
               test_blueprint_declared_says_whether_meter_was_asked,
               test_modal_rhyme_fires_on_a_passing_pair,
               test_return_out_of_range_names_a_case_it_cannot_be_given,
               test_excused_by_overlap_is_a_per_line_condition,
               test_scheme_unreadable_is_not_a_violation,
               test_scope_reaches_the_collision_loop,
               test_the_readability_report_joins_the_revision_loop,
               test_overlapping_spans_reaches_the_loop_not_only_fit,
               test_stanza_lock_reaches_the_loop_not_only_the_grid_verb,
               test_the_whole_draft_half_reaches_the_report,
               test_substituted_end_word_reaches_the_loop,
               test_uncovered_bars_reaches_the_loop_not_only_fit,
               test_a_blank_line_is_refused_not_renumbered,
               test_a_holding_requirement_is_not_fixed_by_breaking_it,
               test_the_mandate_block_is_gated_on_the_mandate,
               test_rule_three_asks_whether_a_word_was_taken,
               test_the_forbidden_list_is_two_rules_in_two_fields):
        fn()
    print("=" * 62)
    if FAILURES:
        print(f"{len(FAILURES)} FAILING: {', '.join(FAILURES)}")
        sys.exit(1)
    print("all revision-loop regressions pass")
