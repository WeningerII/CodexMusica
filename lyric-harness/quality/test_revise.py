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

Run: python3 quality/test_revise.py
"""

import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
sys.path.insert(0, os.path.join(HERE, "..", ".."))

from lyric_harness import Declaration, check_scheme, rhyme_graph  # noqa: E402
from quality import schemes as SC  # noqa: E402
from quality.revise import (Brief, NoMandate, ReviseDeclaration,  # noqa: E402
                            Reviser)

FAILURES = []
R = Reviser()

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
    check("the forbidden words are the FREQUENT ones",
          all(R.lex.freq_rank.get(w, 10 ** 9)
              < max(R.lex.freq_rank.get(c, 10 ** 9) for c in b.candidates)
              for w in b.forbidden_modal if w in R.lex.freq_rank),
          f"forbidden {b.forbidden_modal[:5]} are commoner than the offered")
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
    from battery import corpus_path, parse_sonnets
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
    check("the sonnet battery's own numbers are unmoved",
          tuple(b) == (1064, 1014, 50, 81),
          "mandated 1064, judged 1014, refused 50, violations 81 (8.0%)")
    check("not one sonnet's violation SET differs", differing == 0,
          f"{len(sonnets)} sonnets compared pair for pair")


def test_the_song_the_loop_could_not_grade():
    print("\n14. the song with no letter scheme — both paths")
    lines = song_lines()
    check("41 lines", len(lines) == 41, str(len(lines)))
    g = rhyme_graph(R.lex, lines, R.decl)
    check("its maximal cliques OVERLAP, so no letter scheme exists",
          not g["letter_representable"],
          f"{len(g['cliques'])} cliques, overlapping node(s) "
          f"{sorted(v + 1 for v in g['overlapping_nodes'])}")

    # -- the LETTER path, unchanged
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

    # -- the GRAPH's own structure, which nothing had ever graded
    dm = R.mandate_from_graph(lines)
    check("the song's own clique cover is a mandate with no letter scheme",
          dm.to_letters() is None and len(dm.overlapping_lines()) >= 1,
          f"{len(dm.groups)} groups, pivots {dm.overlapping_lines()}")
    check("and it declares itself NOT INDEPENDENT of the grader",
          not dm.independent(),
          "doctrine 14 — every clique band-passes by construction, so a "
          "clean rhyme result against it is an identity, not a verdict")
    drep = R.grade(lines, dm)
    check("grading it is not vacuous: the graph admits REPEAT edges that a "
          "mandate rejects",
          len(drep["violations"]) == len(drep["repeats"]) > 0,
          f"{len(drep['violations'])} violation(s), all REPEAT: "
          + ", ".join(f"L{v['lines'][0]}/L{v['lines'][1]} "
                      f"{v['endwords'][0]!r}" for v in drep["violations"][:4]))
    ins = R.inspect(lines, dm)
    check("the brief carries the non-independence as a whole-draft finding",
          any(f.code == "MANDATE_NOT_INDEPENDENT" for f in ins["whole"]))


def test_a_derived_cover_is_independent_at_another_theta():
    print("\n15. doctrine 58 — a cover is a coordinate of the band that "
          "made it")
    lines = song_lines()
    loose = Reviser(lex=R.lex, decl=Declaration(theta_coda=0.60),
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
          "the clique count is a coordinate of theta_coda, not a property "
          "of the song")


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
               test_x_is_not_a_rhyme_class_in_the_floor_either):
        fn()
    print("=" * 62)
    if FAILURES:
        print(f"{len(FAILURES)} FAILING: {', '.join(FAILURES)}")
        sys.exit(1)
    print("all revision-loop regressions pass")
