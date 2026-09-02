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
    check("gasoline/tambourine is CLEAN — a true rhyme outside both "
          "tiers, the pair Count to Five was built on",
          r["codes"] == [] and r["why"] is None
          and r["relation"] == "RHYME" and not r["refused"], r)
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
    # PAIR REPINNED 2026-08-25 (M-116) from ~~stone/window~~: under the
    # whole-vocabulary default that pair SATISFIES — its line-final spans
    # stand in the assonance schema — so the screen (which IS the song
    # grader, §3's NO DRIFT) now answers it CLEAN with no why, correctly.
    # four/own is typed ASSONANCE by the k-span comparator but its
    # line-final nuclei DIFFER (AO against OW), so no schema answers and
    # the why survives — which is the shape this check needs: an honest
    # non-rhyme, not a ban and not a refusal.
    r = rows_for("four", "own")[0]
    check("a non-rhyme reports the grader's own relation and why — never "
          "a ban, never a refusal",
          not r["refused"] and r["codes"] == [] and r["why"] is not None,
          f"{r['relation']} {r['score']}: {r['why']}")
    r = rows_for("fire", "fire")[0]
    check("an identical word is answered as the identity machinery "
          "answers it — REPEAT, with the grader's why",
          r["relation"] == "REPEAT" and "identical" in (r["why"] or ""),
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
    rows = rows_for("stone", "rain", "door")
    check("ordinary readable words screen with zero refusals — the "
          "carriers never fail to read",
          all(not r["refused"] for r in rows))
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
                       capture_output=True, text=True, cwd=ROOT)
    return p.returncode, p.stdout, p.stderr


def test_the_cli():
    print("\n5. the CLI verb — dispatch, refusals, exit codes")
    rc, out, _ = run("screen", "hair", "chair")
    check("`screen hair chair` answers at exit 0 with the ban named — a "
          "banned pair is an ANSWER",
          rc == 0 and "BANNED: HOMEOTELEUTON" in out, f"rc {rc}")
    rc, out, _ = run("screen", "gasoline", "tambourine")
    check("a clean pair says CLEAN at exit 0",
          rc == 0 and "CLEAN" in out)
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
    """6. M-113 — CLEAN CONFLATED A CLEAN RHYME WITH A CLEAN NON-RHYME.

    `matinee.txt`'s family was built on the conflation: the screen said
    CLEAN, the mandate charged three violations 116 pairs later. The
    status names which CLEAN it is now, and the 77-schema default's
    rescue — whose evidence on carrier lines is the SCAFFOLD, not the
    pair — is rendered as a non-rhyme with the schema names disclosed.
    Both sides are asserted, so the section cannot pass by relabelling
    everything one way.
    """
    print("\n6. M-113 — CLEAN says WHICH clean, and the scaffold cannot "
          "answer for the pair")
    rc, out, _ = run("screen", "gasoline", "tambourine")
    check("a true rhyme reads `CLEAN — RHYMES` — the affirmative half, "
          "so the split cannot pass by calling everything a non-rhyme",
          rc == 0 and "CLEAN — RHYMES" in out)
    # taboo/suite is the MEASURED conflation: NO_RELATION 0.389, door
    # failed, and three window-searching schemas fire on the carrier
    # scaffold ("we carry the evening to the ..."), so the old rendering
    # said bare CLEAN with the same word a 1.0 rhyme got.
    r = LH.screen_pairs(["taboo", "suite"])[0]
    check("the scaffold-rescued pair carries `schema_scaffold` in the API "
          "row — the rescue is TELLABLE, not folded into why=None",
          r["why"] is None and len(r["schema_scaffold"]) > 0,
          f"scaffold={r['schema_scaffold']}")
    rc, out, _ = run("screen", "taboo", "suite")
    check("...and the CLI renders it DOES NOT RHYME with the schema names "
          "— the scaffold's evidence is disclosed, never CLEAN's",
          rc == 0 and "DOES NOT RHYME as a pair" in out
          and "SCAFFOLD" in out, out.strip().splitlines()[1]
          if out.strip() else "")
    rc, out, _ = run("screen", "haiku", "suite")
    check("a door-failed pair reads `CLEAN — DOES NOT RHYME` with the "
          "grader's own why carried through",
          rc == 0 and "CLEAN — DOES NOT RHYME (" in out)
    rc, out, _ = run("screen", "gasoline", "tambourine", "taboo", "suite")
    check("the tail line counts the two kinds APART, never summed "
          "(doctrine 79): `clean and rhyming` and `clean but not a rhyme` "
          "are both named",
          "clean and rhyming" in out and "clean but not a rhyme" in out)


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
    check("WITHOUT a relation the header says the verdict column is the "
          "COARSE class and points at --relation — disclosure, so the "
          "two questions stop wearing one word",
          rc == 0 and "COARSE class" in out and "--relation=NAME" in out)
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
    check("an ASSONANCE pair the door admits is printed ADMITTED, not "
          "RHYMES, with the consequence named", rc == 0
          and "home ~ alone" in out
          and "CLEAN — ADMITTED as ASSONANCE" in out
          and "CLEAN — RHYMES" not in out.split("home ~ alone")[1]
          .split("\n")[0], out[:600])
    # MEASURED: home~alone and home~stone are both ASSONANCE and admitted;
    # alone~stone is a true rhyme AND the -one/-one HOMEOTELEUTON, so it is
    # BANNED and counted there, not under "clean and rhyming" — three
    # counts, none summed.
    check("...and the tail counts it apart from the rhyming pairs "
          "(doctrine 79)",
          "2 clean and ADMITTED as a near relation" in out
          and "0 clean and rhyming" in out and "1 banned" in out,
          out[-400:])


if __name__ == "__main__":
    for fn in (test_the_controls, test_honesty_and_the_split,
               test_no_drift, test_the_scaffold, test_the_cli,
               test_clean_answers_one_question,
               test_the_screen_asks_the_grades_question,
               test_the_screen_judges_a_drawn_schema_and_names_a_near_relation):
        fn()
    print("=" * 62)
    if FAILURES:
        print(f"{len(FAILURES)} FAILING: {', '.join(FAILURES)}")
        sys.exit(1)
    print("the screen is the grader at the front door — no private "
          "instruments")
