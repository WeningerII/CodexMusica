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

Run: python3 quality/test_revise.py
"""

import collections
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
sys.path.insert(0, os.path.join(HERE, "..", ".."))

from lyric_harness import (Declaration, NEAR_RELATIONS,  # noqa: E402
                           check_scheme, rhyme_graph)
from quality import frequency as FREQ  # noqa: E402
from quality import schemes as SC  # noqa: E402
from quality.revise import (COLLISION_FINDINGS, THETA_COLLISION,  # noqa: E402
                            Brief, NoMandate, ReviseDeclaration, Reviser)

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

#: The song this repo wrote, and its DECLARED mandate. 41 lines whose maximal
#: cliques overlap, so no letter scheme represents its graph -- while the
#: mandate its author declared is a letter string over the two choruses.
SONG = os.path.join(HERE, "..", "examples", "never_been_to_a_scene.txt")
SONG_SCHEME = "XXXXXXXXXXXXABCBADCDXXXXXXXXXXXXEFGFEHGHX"


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
    check("the current end word is itself forbidden",
          "fire" in b.forbidden_modal,
          "re-proposing what was flagged is not a revision")
    check("nothing forbidden leaks into the offered list",
          not (set(b.candidates) & set(b.forbidden_modal)))
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
    rep2 = dis.grade(CLICHE, m)
    check("the disjunctive reading is REACHABLE and is weaker",
          len(rep2["violations"]) < len(rep["violations"])
          and len(rep2["excused"]) > 0,
          f"conjunctive {len(rep['violations'])} violation(s), disjunctive "
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

    stray = sub(33, "So say the road. Say it low")
    stray[40] = "The pot is down to soot"
    res = R.verify(lines, stray, m, targeted=[33])
    check("STRAY — L41 rewritten while only L33 was targeted, rejected",
          not res["accepted"] and "not targeted" in " ".join(res["reasons"]),
          res["reasons"][0][:100])

    modal = [w for w in b33.forbidden_modal
             if w != R.floor.qf._endword(lines[32])]
    check("L33 has a modal word to take", bool(modal),
          str(b33.forbidden_modal))
    res = R.verify(lines, sub(33, f"So say the road. Say it {modal[0]}"),
                   m, targeted=[33])
    check("MODAL — L33 takes the most frequent word in its field, rejected",
          not res["accepted"] and res.get("modal_violations"),
          res["reasons"][0][:120])

    res = R.verify(lines, sub(33, "So say the road. Say it clear"),
                   m, targeted=[33])
    check("NET-NEGATIVE — L33 fixes its REPEAT and breaks group G, rejected",
          not res["accepted"] and "new finding" in " ".join(res["reasons"]),
          f"fixed {len(res.get('fixed', []))}, new {len(res.get('new', []))}: "
          + res["reasons"][0][:110])

    # and the ACCEPT, so none of the above is an always-reject
    picked = None
    for w in b33.candidates:
        r2 = R.verify(lines, sub(33, f"So say the road. Say it {w}"),
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
          not any(b.candidates or b.forbidden_modal for b in briefs
                  if all(f.code in COLLISION_FINDINGS for f in b.findings)),
          "no collision code is in RHYME_FINDINGS, and that is a DECISION "
          "with a measurement behind it, not a gap -- see test 24")
    with open(os.path.join(HERE, "..", "examples",
                           "never_been_to_a_scene.blueprint.json"),
              encoding="utf-8") as fh:
        sec = {i + 1: s["section"]
               for i, s in enumerate(json.load(fh)["lines"])}
    ret = [c for c in rep["collisions"]
           if sec[c["lines"][0]].startswith("chorus")
           and sec[c["lines"][1]].startswith("chorus")
           and sec[c["lines"][0]] != sec[c["lines"][1]]]
    # NOTE THE SHAPE OF THIS ASSERTION. It used to pin `== 26` and `== 16`.
    # Both are coordinates of the COMPARATOR (doctrine 58/91) and the coda
    # channel moved under this suite on 2026-08-11 while it was being written;
    # `wall`/`floor` and `ear`/`will` went from RHYME to ASSONANCE in one
    # afternoon. What is a property of the SONG rather than of the cut is that
    # the chorus's returns are a MAJORITY of the collision set and that the
    # merge detector recovers exactly them, so that is what is pinned.
    check("the chorus coming back is the MAJORITY of the collision set",
          len(ret) * 2 > len(rep["collisions"]),
          f"{len(ret)}/{len(rep['collisions'])} join chorus to chorus2. A "
          f"letter scheme cannot say 'these two groups are the same words', "
          f"so it gives them different letters -- and the collision detector "
          f"then reports the identity the projection was forced to hide "
          f"(doctrine 2)")
    check("and the merge detector recovers exactly those, from the GRAPH "
          "alone, with no blueprint and no section name",
          {tuple(c["lines"]) for c in ret}
          == {(i, j) for mg in R.group_merges(lines, SONG_SCHEME)
              for i, j, *_ in mg["edges"]},
          f"{len(R.group_merges(lines, SONG_SCHEME))} merges. The section "
          f"labels above come from the blueprint; `group_merges` never reads "
          f"it -- it asks whether two mandated groups would pass as ONE")
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
    dm = dataclasses.replace(m, returns=((13, 33), (17, 37), (15, 35),
                                         (18, 38), (19, 39)))
    dins = R.inspect(lines, dm)
    got = [f.code for f in dins["whole"]
           if f.code.startswith(("GROUPS_DECLARED", "MANDATE_GROUPS"))]
    check("and when `Mandate.returns` states it, the SAME edges become the "
          "FORM (the sibling contract in quality/schemes.py, read not "
          "duplicated)",
          got.count("GROUPS_DECLARED_RETURN") == 3
          and got.count("MANDATE_GROUPS_INDISTINGUISHABLE") == 1,
          f"{got} -- B[14,16]/F[34,36] stays DERIVED and that is correct: "
          f"L16 ends 'drive' and L36 ends 'alive', so they are NOT the same "
          f"line and no return class links them. The chorus's fourth line "
          f"is the one that MOVES, and the hook can tell")

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
          only and not any(b.candidates or b.forbidden_modal for b in only),
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
               test_the_field_is_the_graders_own_field,
               test_no_joint_candidate_was_a_coordinate_of_a_literal,
               test_the_four_rejections_on_the_songs_own_shape,
               test_what_the_loop_can_say_on_the_declared_mandate,
               test_the_modal_set_against_a_declared_reference,
               test_the_collision_set_is_partitioned_not_silenced,
               test_why_a_collision_earns_no_field):
        fn()
    print("=" * 62)
    if FAILURES:
        print(f"{len(FAILURES)} FAILING: {', '.join(FAILURES)}")
        sys.exit(1)
    print("all revision-loop regressions pass")
