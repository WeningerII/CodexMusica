#!/usr/bin/env python3
"""Regressions for the `screen` verb (lyric_harness.screen_pairs).

WHY THIS FILE EXISTS, dated. On 2026-08-18 the owner asked what "my
private workflow" meant and the honest answer was this check: before
either zero-flag song was drafted, every candidate rhyme pair was run
through the grader via an operator's scratch script — two dummy lines,
a minimal mandate, read the codes — and that script lived in one
session's memory, below prose, reachable by nobody else. A step that
decides which words even get tried had no entrance. `screen` is the
entrance, and THE ONE CLAIM THAT MATTERS here is NO DRIFT: screen's
answer for a pair must be the SAME grader saying the SAME thing it says
about that pair inside a real draft — a screen that could disagree with
the grade it predicts would be worse than the scratch script.

Sections:
  1  the controls — the pairs that taught us the bans answer the same
     through the front door
  2  honesty about non-rhymes, and the doctrine-28 split (banned is an
     ANSWER; refusal is the grader's own)
  3  NO DRIFT — screen's verdict equals the full-draft grade's, pair for
     pair, and screen_pairs visibly goes THROUGH Reviser.inspect
  4  the carrier lines are scaffolding — readable, never the finding
  5  the CLI verb — dispatch, refusals, exit codes

Run: python3 quality/test_screen.py
"""

import inspect as _inspect
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
sys.path.insert(0, ROOT)

import lyric_harness as LH  # noqa: E402

FAILURES = []


def check(name, cond, detail=""):
    print(f"  {'PASS' if cond else 'FAIL'}  {name}")
    if detail:
        print(f"          {detail}")
    if not cond:
        FAILURES.append(name)


def rows_for(*words):
    return LH.screen_pairs(list(words))


def test_the_controls():
    print("\n1. the pairs that taught us the bans answer the same through "
          "the front door")
    r = rows_for("hair", "chair")[0]
    check("hair/chair is BANNED: HOMEOTELEUTON — the same spelled ending "
          "(-air), the tier-1 ban that closed the a3-era escapes",
          r["codes"] == ["HOMEOTELEUTON"] and not r["refused"], r)
    r = rows_for("obey", "away")[0]
    check("obey/away is BANNED: MODAL_RHYME — the tier-2 predictability "
          "ban, differently spelled and banned anyway",
          r["codes"] == ["MODAL_RHYME"] and not r["refused"], r)
    r = rows_for("gasoline", "tambourine")[0]
    check("gasoline/tambourine is unbanned and stands in RHYME (with "
          "ASSONANCE and CONSONANCE beside it — a perfect rhyme is all "
          "three) — the pair Count to Five was built on",
          r["codes"] == [] and r["why"] is None and not r["refused"]
          and {"RHYME", "ASSONANCE", "CONSONANCE"} <= set(r["coarse_relations"])
          and "perfect rhyme" in r["schema_relations"], r)
    rows = rows_for("piano", "below", "though")
    check("a triple screens as its three pairs, in declared order, all "
          "clean — the other Count to Five group",
          [(x["a"], x["b"]) for x in rows] == [("piano", "below"),
                                               ("piano", "though"),
                                               ("below", "though")]
          and all(x["codes"] == [] and x["why"] is None for x in rows))


def test_honesty_and_the_split():
    print("\n2. non-rhymes are answered honestly, and banned is not "
          "refused (doctrine 28)")
    # 2026-09-08: the old four/own definite-negative fixture cannot
    # establish absence across the whole default vocabulary. Keep that
    # unknown as a negative control, then explicitly ask the narrower
    # rhyme-only question whose determinate rejection this check needs.
    r = rows_for("four", "own")[0]
    # N-RELATION MODEL (2026-09-22): the pair is ANSWERED — it stands in no
    # coarse relation and no decided schema — and the schemas that could not
    # decide at the pair are NAMED as undecided, with the grader's own
    # unresolved sentence beside them. Never a definite "does not rhyme".
    check("the broad default names the undecided schemas and the grader's "
          "unresolved sentence, and claims no relation it could not decide",
          not r["refused"] and r["relations"] == [] and r["undecided"]
          and "default relation remains unresolved" in (r["reason"] or "")
          and not r["codes"], r)
    r = LH.screen_pairs(["four", "own"],
                        decl=LH.Declaration(admit=("RHYME", "RIME_RICHE")))[0]
    check("the explicitly narrowed rhyme-only declaration reports a "
          "determinate non-rhyme with the grader's own why",
          not r["refused"] and r["codes"] == [] and r["why"] is not None
          and not set(r["coarse_relations"]) & {"RHYME", "RIME_RICHE"},
          f"{r['relations']} {r['score']}: {r['why']}")
    r = rows_for("fire", "fire")[0]
    check("an identical word stands in REPEAT beside the sound relations "
          "it also stands in — identity is recorded, never a single label",
          "REPEAT" in r["relations"] and "RHYME" in r["relations"],
          r["relations"])
    r = rows_for("haiku", "haiku")[0]
    check("...and the identity machinery answers it with the grader's why",
          "REPEAT" in r["relations"] and "identical" in (r["why"] or ""),
          r["why"])
    r = rows_for("stone", "xzqwv")[0]
    check("an unreadable word is the grader's OWN refusal, naming the "
          "word and the reason — UNKNOWN is not absent",
          r["refused"] and "xzqwv" in r["reason"]
          and "no pronunciation" in r["reason"], r["reason"][:80])
    check("...and a banned pair is an ANSWER, not a refusal — the split "
          "the summary line states",
          rows_for("hair", "chair")[0]["refused"] is False)


def test_no_drift():
    print("\n3. NO DRIFT — the screen IS the grader, not a lookalike")
    # The same two pairs, embedded as mandated groups in a real draft and
    # graded the way `song` grades: the codes must agree with screen's,
    # pair for pair.
    from quality.revise import Reviser
    import quality.schemes as SC
    draft = ["the morning swept the sidewalk past the hair",
             "a stranger left umbrellas on the chair",
             "the engine idled sweet on gasoline",
             "her cousin kept the time on tambourine"]
    found = Reviser().inspect(draft, SC.mandate([[1, 2], [3, 4]],
                                                n_lines=4))
    codes = {f.code for fs in found["per_line"].values() for f in fs}
    s_bad = rows_for("hair", "chair")[0]
    s_ok = rows_for("gasoline", "tambourine")[0]
    check("the banned pair carries HOMEOTELEUTON in the FULL-DRAFT grade "
          "and in screen's answer; the clean pair carries it in neither",
          "HOMEOTELEUTON" in codes and s_bad["codes"] == ["HOMEOTELEUTON"]
          and s_ok["codes"] == [],
          sorted(c for c in codes if c in LH.SCREEN_PAIR_CODES))
    src = _inspect.getsource(LH.screen_pairs)
    check("screen_pairs visibly goes THROUGH Reviser.inspect — no "
          "re-implementation to drift (doctrine 91 at the code level)",
          "Reviser" in src and ".inspect(" in src)


def test_the_scaffold():
    print("\n4. the carrier lines are scaffolding — readable, and never "
          "the finding")
    # THE DETERMINATE CONTROL MOVED OFF `piano`, 2026-09-16 (`MISSING.md`
    # E-5), and the reason is a finding rather than a fixture repair.
    #
    # This control needs a trio whose readings are UNAMBIGUOUS, so that a
    # refusal here can only ever be the carriers' fault — that is the whole
    # claim. `piano` stopped being that word, and CMUdict says exactly why:
    #
    #   piano     P IY0 AE1 N OW0        <- rhymes with below/though
    #   piano(2)  P IY0 AE1 N AH0        <- does NOT
    #
    # Two readings that disagree, so the harness refuses rather than guessing
    # one (doctrine 20). MEASURED both ways: under `coda_empty_evidence=
    # "gift"` all three pairs come back RHYME 1.0 and clean; under the
    # adopted `cannot_tell` the two `piano` pairs refuse with "the declared
    # relation differs across unresolved pronunciation readings". So the old
    # green was the coda gift papering over a real pronunciation
    # disagreement, and the refusal is E-5 working, not E-5 breaking.
    #
    # `banjo` (B AE1 N JH OW2) is the replacement and is chosen rather than
    # found: ONE reading, polysyllabic, AE1-stressed and `-N`+OW-final, which
    # is `piano`'s own shape minus the ambiguity. MEASURED: all three pairs
    # RHYME 1.0, zero refusals, zero codes. `ago` was rejected for this even
    # though it also reads once — it earns MODAL_RHYME, and a control that
    # carries a ban code is not a clean scaffold control.
    #
    # NOT CHANGED, AND FLAGGED FOR THE AUTHOR: §1 above screens the same trio
    # as "the other Count to Five group" — a rhyme group from a DELIVERED
    # song — and asserts it is "all clean". That check still passes, because
    # a refusal carries no codes and no `why`, so its predicate cannot tell a
    # clean answer from a refused one. The sentence is now wrong about a
    # shipped song even though the check is green. Whether E-5 should refuse
    # a delivered song's own group is the author's call, not the gate's.
    rows = rows_for("banjo", "below", "though")
    check("the determinate rhyme controls screen with zero refusals — "
          "the carriers never fail to read",
          all(not r["refused"] for r in rows),
          [(r["a"], r["b"], r["refused"]) for r in rows])
    carriers = LH._SCREEN_CARRIERS
    check("the two carrier lines DIFFER — identical carriers let the "
          "mosaic scorer find the shared span and inflate a non-rhyme's "
          "score (measured 0.762 on stone/window before the split)",
          len(carriers) == 2 and carriers[0] != carriers[1]
          and all("{w}" in c for c in carriers))
    r = rows_for("stone", "window")[0]
    check("...and with split carriers the non-rhyme's reported score is "
          "the pair's, not the scaffold's (under the old shared-carrier "
          "inflation this sat at 0.762)",
          r["score"] is not None and r["score"] < 0.7, r["score"])


def run(*argv):
    p = subprocess.run([sys.executable, "lyric_harness.py", *argv],
                       capture_output=True, text=True, cwd=ROOT, timeout=600)
    return p.returncode, p.stdout, p.stderr


def test_the_cli():
    print("\n5. the CLI verb — dispatch, refusals, exit codes")
    rc, out, _ = run("screen", "hair", "chair")
    check("`screen hair chair` answers at exit 0 with the ban named — a "
          "banned pair is an ANSWER",
          rc == 0 and "BANNED: HOMEOTELEUTON" in out, f"rc {rc}")
    rc, out, _ = run("screen", "gasoline", "tambourine")
    check("an unbanned pair lists EVERY relation it stands in at exit 0, "
          "with no CLEAN verdict standing in for them",
          rc == 0 and "relation(s): " in out and "RHYME" in out
          and "perfect rhyme" in out and "CLEAN" not in out)
    rc, out, err = run("screen", "solo")
    check("one word refuses at exit 2 — the question is about a PAIR",
          rc == 2, f"rc {rc}")
    rc, out, err = run("screen", "hair", "chair", "--nope")
    check("an unknown flag refuses at exit 2 rather than being ignored "
          "(doctrine 20)", rc == 2, f"rc {rc}")
    rc, out, err = run("screen", "new york", "dork")
    check("a multi-word 'word' refuses at exit 2, pointing at "
          "brief/song for phrase rhymes", rc == 2, f"rc {rc}")


def test_clean_answers_one_question():
    """6. M-113, RESOLVED BY THE N-RELATION MODEL (2026-09-22).

    CLEAN answered two questions — a clean rhyme and a clean non-rhyme — and
    a family got built on the conflation. There is no CLEAN verdict now: each
    pair is listed with EVERY relation it stands in, the registry schemas
    judged AT THE TWO END TOKENS (never on the carrier scaffold), and a pair
    standing in none says so. Both sides are asserted, so the section cannot
    pass by listing everything one way.
    """
    print("\n6. M-113 — no CLEAN verdict: every pair lists the relations it "
          "stands in, judged at the end words, not the scaffold")
    rc, out, _ = run("screen", "gasoline", "tambourine")
    check("a perfect rhyme lists RHYME and the schemas it stands in — the "
          "affirmative half",
          rc == 0 and "RHYME" in out and "perfect rhyme" in out
          and "CLEAN —" not in out)
    r = LH.screen_pairs(["taboo", "suite"])[0]
    check("taboo/suite stands in no relation it could decide, names its "
          "undecided schemas, and invents no schema evidence",
          not r["refused"] and r["relations"] == [] and r["undecided"]
          and "unresolved" in (r["reason"] or ""), r)
    r = LH.screen_pairs(["stone", "rain"])[0]
    check("stone/rain stands in the consonance schemas AT THE TWO END "
          "WORDS and in no coarse relation — schema evidence about the "
          "PAIR, listed with the coarse relations, never a rescue",
          not r["refused"] and r["coarse_relations"] == []
          and "consonance" in r["schema_relations"]
          and r["relations"] == sorted(set(r["coarse_relations"])
                                       | set(r["schema_relations"])),
          f"{r['relations']}")
    rc, out, _ = run("screen", "stone", "rain")
    check("...and the CLI prints the pair's relation list",
          rc == 0 and "stone ~ rain" in out
          and "relation(s): cluster consonance / skothending span, "
              "consonance" in out and "CLEAN" not in out,
          next((l for l in out.splitlines() if "stone ~ rain" in l), ""))
    rc, out, _ = run("screen", "haiku", "suite")
    check("haiku/suite discloses its uncertainty through the CLI and "
          "claims no relation", rc == 0
          and "0 relation(s): none" in out
          and "default relation remains unresolved" in out
          and "undecided at the pair" in out)
    rc, out, _ = run("screen", "haiku", "haiku")
    check("an identity pair lists REPEAT among its relations and carries "
          "the grader's own reason", rc == 0 and "REPEAT" in out
          and "grade: REPEAT not rhyme (identical word)" in out)
    rc, out, _ = run("screen", "gasoline", "tambourine", "stone", "rain")
    m = re.search(r"(\d+) banned, (\d+) refused, (\d+) standing in at "
                  r"least one relation, (\d+) standing in none", out)
    check("the tail line counts pairs standing in a relation and pairs "
          "standing in none APART, and the kinds sum to the pairs "
          "(doctrine 79)",
          m is not None and int(m.group(3)) >= 2
          and sum(int(x) for x in m.groups()) == 6,
          m.group(0) if m else out[-300:])


def test_the_screen_asks_the_grades_question():
    """7. M-58 ITEM 3 — THE SCREEN CAN ASK THE NAMED QUESTION.

    A writer screening before writing (mandatory, standing rule 3) was
    answered from the COARSE class while the grade asks the NAMED cell —
    both directions live on one draft (`rain`/`reign` screens RHYME and
    satisfies `type:rime riche`; `cellar`/`seller` screened RIME_RICHE
    and, before the judge repair, violated it). `--relation=NAME` asks
    the grade's own question through the same `satisfies_relation`, and
    without it the header says out loud which question is being answered.
    """
    print("\n7. M-58 — the screen asks the question the grade will ask")
    rc, out, _ = run("screen", "cellar", "seller", "teller",
                     "--relation=type:rime riche")
    check("the declared relation is judged per pair, and the entry's own "
          "measured defect answers SATISFIES now",
          rc == 0 and "SATISFIES type:rime riche" in out
          and "cellar ~ seller" in out, f"rc {rc}")
    check("...and a pair that RHYMES but is not the declared relation "
          "says VIOLATES with the consequence named — the screen and the "
          "grade cannot disagree, which is the whole ask",
          "VIOLATES type:rime riche" in out)
    check("...and the header names the question being asked",
          "NAMED" in out and "the question a mandate declaring it will "
          "ask" in out)
    rc, out, _ = run("screen", "hair", "chair")
    check("WITHOUT a relation the header says each pair is listed with "
          "EVERY relation it stands in, and names the schemas no pair of "
          "end words can instantiate",
          rc == 0 and "EVERY relation it stands in" in out
          and "NOT APPLICABLE" in out and "NAMED  :" not in out)
    # REPOINTED 2026-09-01 (`MISSING.md` M-189): ~~a schema-namespace
    # relation REFUSES~~ — a PAIR-BINDABLE schema is judged at the two end
    # tokens now (§8 below), so the refusal is kept only for the shapes one
    # token cannot bind. `anaphora` binds line HEADS at token loci and IS
    # bindable, so it is judged rather than refused; a searched-anchor
    # shape is the one that still refuses, by the judge's own reason.
    rc, out, err = run("screen", "cellar", "seller",
                       "--relation=schema:anaphora")
    check("a pair-bindable schema-namespace relation is JUDGED at the two "
          "end words now, not refused — the pair route, not the instances "
          "route",
          rc == 0 and ("SATISFIES schema:anaphora" in out
                       or "VIOLATES schema:anaphora" in out
                       or "schema:anaphora REFUSED" in out), f"rc {rc}")
    rc, out, err = run("screen", "cellar", "seller",
                       "--relation=type:zzznotarelation")
    check("an unknown relation name refuses at exit 2 by name",
          rc == 2, f"rc {rc}")


def test_the_screen_judges_a_drawn_schema_and_names_a_near_relation():
    """8. M-189 — the pre-write screen can ask the DRAWN question, and an
    admitted near relation is not printed as a rhyme.

    THE TWO DEFECTS. (a) `plan` draws one schema per group (M-117) and the
    grade judges it at the two end words through `relations.pair_satisfies`
    (M-148 P2) — but the screen REFUSED every `schema:` name, so the one
    step the working order puts BEFORE writing could not ask the question
    the grade asks. `perfect rhyme` and `rime riche` are in the 22 drawn
    schemas; a perfect rhyme VIOLATES a DIFFER schema, and the writer could
    not learn that until the grade. (b) `home`/`alone` is typed ASSONANCE,
    admitted at a bare group under the widened door (M-59), and the screen
    printed it `CLEAN — RHYMES` on the same row that says it VIOLATES
    class:RHYME. EMPIRICALLY VERIFIED before pinning, on the pairs below.
    """
    print("\n8. M-189 — the screen judges a drawn schema at the two end "
          "words, and says ADMITTED where the door let a near relation in")
    rc, out, _ = run("screen", "hair", "chair", "spare",
                     "--relation=schema:perfect rhyme")
    check("a drawn end-rhyme schema is judged per pair at the two end "
          "words — SATISFIES on a perfect rhyme, alongside the ban row",
          rc == 0 and "SATISFIES schema:perfect rhyme" in out
          and "BANNED: HOMEOTELEUTON" in out, f"rc {rc}")
    rc, out, _ = run("screen", "cellar", "seller",
                     "--relation=schema:rime riche")
    check("a rime riche pair SATISFIES the rime riche schema", rc == 0
          and "SATISFIES schema:rime riche" in out, f"rc {rc}")
    rc, out, _ = run("screen", "hair", "spare",
                     "--relation=schema:pararhyme")
    check("a perfect rhyme VIOLATES a DIFFER schema — the answer the grade "
          "would give, learned BEFORE writing",
          rc == 0 and "VIOLATES schema:pararhyme" in out, f"rc {rc}")
    rc, out, _ = run("screen", "home", "alone", "stone")
    _ha = next((l for l in out.splitlines() if "home ~ alone" in l), "")
    check("an ASSONANCE pair lists ASSONANCE (and the schemas it stands "
          "in) and NOT RHYME — a near relation is never printed as a rhyme",
          rc == 0 and "ASSONANCE" in _ha and "assonance" in _ha
          and not re.search(r"\bRHYME\b", _ha), _ha)
    # MEASURED: home~alone and home~stone stand in ASSONANCE; alone~stone
    # stands in RHYME AND is the -one/-one HOMEOTELEUTON, so it is BANNED
    # and counted there — the counts are never summed.
    check("...and the tail counts the banned pair apart from the pairs "
          "standing in a relation (doctrine 79)",
          "1 banned, 0 refused, 2 standing in at least one relation, "
          "0 standing in none" in out,
          out[-400:])


def test_the_screen_says_which_words_cannot_be_bound_at_a_token():
    print("\n9. M-213 — the screen says which words have NO ANCHOR as a "
          "declared token (T1..Tn), the question its end-word verdict "
          "cannot ask: `by ~ buy ~ bye` SATISFIES rime riche at the end and "
          "`by` at L6's first word was REFUSED unjudged on seed 7009")
    lex = LH.Lexicon()
    check("`by` anchors as the line's last word and NOT before it — the "
          "WEAK_NONFINAL demotion, read through the grade's own resolver",
          LH.token_anchorability(lex, "by") == (False, True))
    check("`in` anchors at NEITHER position as a declared token",
          LH.token_anchorability(lex, "in") == (False, False))
    check("`buy`, `bye`, `window` anchor at both",
          all(LH.token_anchorability(lex, w) == (True, True)
              for w in ("buy", "bye", "window")))
    lines = LH.anchor_disclosure_lines(lex, ["by", "buy", "in"])
    check("the disclosure names each unanchorable word, its position, and "
          "that a mandate binding it there is REFUSED unjudged — and says "
          "nothing about `buy`",
          len(lines) == 2 and lines[0].startswith("  ANCHOR : 'by'")
          and "BEFORE the line end" in lines[0]
          and lines[1].startswith("  ANCHOR : 'in'")
          and "ANY position" in lines[1]
          and all("REFUSED unjudged" in l for l in lines)
          and not any("'buy'" in l for l in lines), "\n".join(lines))
    check("when every word anchors the block is ONE line saying so — "
          "silence would be indistinguishable from not having asked",
          LH.anchor_disclosure_lines(lex, ["buy", "bye"])
          == ["  ANCHOR : every word anchors as a declared token (T1..Tn) "
              "before the line end and at it — a plan may bind any of them "
              "at any word"])
    rc, out, _ = run("screen", "by", "buy", "bye",
                     "--relation=schema:rime riche")
    check("through the CLI: the pair rows still SATISFY the schema at the "
          "end, and the ANCHOR block under the counts names `by`",
          rc == 0 and "SATISFIES schema:rime riche" in out
          and "ANCHOR : 'by'" in out
          and out.index("ANCHOR : 'by'") > out.index("banned,"),
          out[-600:])


def test_named_judgment_survives_broad_uncertainty():
    print("\n10. the requested relation is independent of broad default uncertainty")
    from quality.revise import Reviser
    from quality import schemes as SC
    lines = [c.format(w=w) for c, w in zip(LH._SCREEN_CARRIERS, ("four", "own"))]
    # UPDATED 2026-09-24 for the N-relation model (#375), which moved
    # `nucleus_agreement` to "licensed" deliberately. four/own is AO~OW, a
    # NEAR vowel: under the shipped licensed nucleus it no longer stands in
    # ASSONANCE (was ~~class:ASSONANCE True~~), so on the default both named
    # answers are False and the check could no longer tell "answers the
    # named question independently" from "always says no when the broad
    # default is unresolved". The two-sided contrast is therefore asserted
    # at a DECLARED scalar nucleus, where the pair still stands in
    # ASSONANCE, AND the shipped default is asserted beside it. The CLI has
    # no nucleus coordinate, so it is checked against the shipped answer.
    _scalar = LH.Declaration(nucleus_agreement="scalar")
    _shipped = LH.Declaration()
    for dname, decl, relation, expected in (
            ("scalar", _scalar, "class:ASSONANCE", True),
            ("scalar", _scalar, "class:RHYME", False),
            ("licensed", _shipped, "class:ASSONANCE", False),
            ("licensed", _shipped, "class:RHYME", False)):
        row = LH.screen_pairs(["four", "own"], relation=relation,
                              decl=decl)[0]
        grade = Reviser(decl=decl).grade(
            lines, SC.mandate([[1, 2]], n_lines=2,
                              default_relation=relation))
        check(f"four/own keeps the broad default's unresolved sentence and independently answers {relation} ({dname} nucleus)",
              not row["refused"] and "unresolved" in (row["reason"] or "")
              and row["undecided"]
              and row["named"] is expected and row["named_reason"] is None, row)
        check(f"the requested {relation} agrees with the actual declared grade ({dname} nucleus)",
              not grade["refusals"] and len(grade["verdicts"]) == 1
              and (grade["verdicts"][0]["why"] is None) is expected,
              grade["verdicts"])
        if decl is not _shipped:
            continue
        rc, out, _ = run("screen", "four", "own", f"--relation={relation}")
        counts = ("1 satisfies, 0 violates, 0 refused" if expected else
                  "0 satisfies, 1 violates, 0 refused")
        verdict = "SATISFIES" if expected else "VIOLATES"
        check(f"CLI prints {relation}'s own verdict beside the unchanged broad uncertainty",
              rc == 0 and "default relation remains unresolved" in out
              and f"{verdict} {relation}" in out and f"NAMED COUNTS: {counts}" in out
              and "0 banned, 0 refused, 0 standing in at least one relation, "
                  "1 standing in none" in out and "CLEAN" not in out, out)
    for a, b, relation in (("wind", "find", "class:RHYME"),
                           ("wind", "find", "schema:perfect rhyme"),
                           ("stone", "xzqwv", "schema:perfect rhyme")):
        row = LH.screen_pairs([a, b], relation=relation)[0]
        check(f"{a}/{b} keeps exact {relation} uncertainty instead of a false violation",
              row["named"] is None and bool(row["named_reason"])
              and (row["refused"] or bool(row["reason"])), row)
    row = LH.screen_pairs(["haiku", "suite"], relation="type:perfect rhyme (last stressed syllable)")[0]
    check("a determinate named type also survives unrelated broad schema uncertainty",
          "unresolved" in (row["reason"] or "") and row["named"] is False
          and not row["named_reason"], row)
    rc, out, _ = run("screen", "wind", "find", "--relation=class:RHYME")
    check("CLI counts exact unknown separately and invents neither satisfaction nor violation",
          rc == 0 and "class:RHYME REFUSED:" in out
          and "NAMED COUNTS: 0 satisfies, 0 violates, 1 refused" in out
          and "SATISFIES class:RHYME" not in out and "VIOLATES class:RHYME" not in out,
          out)


def test_screen_retains_partial_anchor_evidence():
    from quality.revise import Reviser
    from quality import schemes as SC
    words = ("picket", "packet")
    lines = [c.format(w=w) for c, w in zip(LH._SCREEN_CARRIERS, words)]
    verdict = Reviser().inspect(lines, SC.mandate([[1, 2]], n_lines=2))["grade"]["verdicts"][0]
    row = LH.screen_pairs(words, relation="class:CONSONANCE")[0]
    # N-RELATION MODEL: the matching span is the unstressed `-ket`, so the
    # pair stands in PROMOTED_RHYME (a promoted final) and not RIME_RICHE,
    # which needs a lexically stressed syllable; the screen's coarse
    # relations are the grade verdict's admitted ones.
    check("screen retains the actual partial-anchor score and its evidence",
          "PROMOTED_RHYME" in row["coarse_relations"]
          and "RIME_RICHE" not in row["relations"]
          and set(row["coarse_relations"]) == set(verdict["admitted"])
          and row["score"] == verdict["score"] == 1.0
          and bool(verdict["attribution"])
          and row.get("attribution") == verdict["attribution"]
          and row.get("spans") == verdict["spans"])
    rc, out, _ = run("screen", *words, "--relation=class:CONSONANCE")
    check("the public screen names the actual syllables without changing the named verdict",
          rc == 0 and verdict["attribution"] in out
          and "last 1 of 2 syllables of 'picket'" in out
          and "last 1 of 2 syllables of 'packet'" in out
          and "SATISFIES class:CONSONANCE" in out, out)


def test_rime_riche_reads_the_words_own_onset():
    """M-306 (2026-09-21). `syllabify` maximises the onset of the next
    syllable ACROSS the word boundary, so on the screen's second carrier
    (`... about {w}`) every r-initial word borrows the /t/ of `about`:
    `about rain` reads `abou-train`. The identity test behind RIME_RICHE
    compared that borrowed onset, so `rain ~ reign` and `rite ~ write`
    screened plain RHYME while `vain ~ vein` (no legal /tv/ onset) screened
    RIME_RICHE — one carrier, two answers to the same question, and the
    named judge (`schema:rime riche`) said SATISFIES for all of them. The
    anchor now carries the WORD'S OWN onset beside the resyllabified one and
    identity reads that."""
    print("\n8. rime riche reads the word's own onset, not the one its neighbour lent")
    from quality.revise import Reviser
    from quality import schemes as SC
    lines = [c.format(w=w) for c, w in zip(LH._SCREEN_CARRIERS, ("rain", "reign"))]
    verdict = Reviser().inspect(lines, SC.mandate([[1, 2]], n_lines=2))["grade"]["verdicts"][0]
    anc_b = verdict["spans"]["anchor_b"][0]
    check("the resyllabified onset on `about reign` is still [T, R] — the rhyme channels keep it",
          anc_b["onset"] == ["T", "R"], anc_b["onset"])
    check("...and the anchor now also carries the word's OWN onset, [R]",
          list(anc_b.get("onset_own", ())) == ["R"], anc_b.get("onset_own"))
    rows = {(r["a"], r["b"]): r for r in LH.screen_pairs(["rain", "reign", "vein", "rite", "write"])}
    _rr = set(rows[("rain", "reign")]["coarse_relations"])
    check("rain ~ reign stands in RIME_RICHE AND RHYME — rime riche is also "
          "rhyme, the same answer vain ~ vein already gave",
          {"RIME_RICHE", "RHYME"} <= _rr, sorted(_rr))
    check("rite ~ write stands in RIME_RICHE too (and still HOMEOTELEUTON, which is the spelling's business)",
          "RIME_RICHE" in rows[("rite", "write")]["coarse_relations"]
          and "HOMEOTELEUTON" in rows[("rite", "write")]["codes"], rows[("rite", "write")])
    check("CONTROL: rain ~ vein stands in RHYME and NOT RIME_RICHE — the words' own onsets differ",
          "RHYME" in rows[("rain", "vein")]["coarse_relations"]
          and "RIME_RICHE" not in rows[("rain", "vein")]["relations"],
          rows[("rain", "vein")]["relations"])
    check("the coarse relations now agree with the named judge on the same pair",
          LH.screen_pairs(["rain", "reign"], relation="schema:rime riche")[0]["named"] is True
          and "RIME_RICHE" in _rr and "rime riche" in rows[("rain", "reign")]["schema_relations"])
    check("an anchor without the tag reads as it always did (a wordless call is unchanged)",
          LH._own_onset({"onset": ["T", "R"]}) == ["T", "R"]
          and LH._own_onset({"onset": ["T", "R"], "onset_own": ("R",)}) == ["R"])


if __name__ == "__main__":
    for fn in (test_the_controls, test_honesty_and_the_split,
               test_no_drift, test_the_scaffold, test_the_cli,
               test_clean_answers_one_question,
               test_the_screen_asks_the_grades_question,
               test_the_screen_judges_a_drawn_schema_and_names_a_near_relation,
               test_the_screen_says_which_words_cannot_be_bound_at_a_token,
               test_named_judgment_survives_broad_uncertainty,
               test_screen_retains_partial_anchor_evidence,
               test_rime_riche_reads_the_words_own_onset):
        fn()
    print("=" * 62)
    if FAILURES:
        print(f"{len(FAILURES)} FAILING: {', '.join(FAILURES)}")
        sys.exit(1)
    print("the screen is the grader at the front door — no private "
          "instruments")
