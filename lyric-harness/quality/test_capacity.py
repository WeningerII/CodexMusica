#!/usr/bin/env python3
"""Regressions for the capacity layer (quality/capacity.py).

THE ONE CLAIM THAT MATTERS is NO DRIFT FROM THE GRADER: capacity's
families must be the grader's own perfect-rhyme classes, its tier-1
classes the grader's own homeoteleuton classes, and every committed
witness a group the REAL Reviser still accepts — because a capacity
table that disagrees with the judge is a rumor with a checksum. The
second claim is the doctrine boundary: this layer states ceilings and
never grades a draft (stage 2 is deliberately unbuilt).

Sections:
  1  the anchor mirrors the grader — same-family pairs grade as perfect
     rhymes, the feminine-anchor cases split exactly as _spelled_rime's
     record says, and different families do not rhyme
  2  tier 1 is the grader's tier 1 — a same-class pair carries
     HOMEOTELEUTON in a real grade; different classes of one family
     do not
  3  THE CROWN — the committed artifact's sample witnesses re-grade
     clean through Reviser.inspect, and the ADOPTED constants re-derive
     from the committed table
  4  determinism and the population's declared bounds
  5  the verb — dispatch, WORD lookup, --top, refusals

Run: python3 quality/test_capacity.py
"""

import io
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
sys.path.insert(0, ROOT)

from quality import capacity as CAP  # noqa: E402
from quality.revise import Reviser  # noqa: E402
from lyric_harness import Declaration  # noqa: E402
import quality.schemes as SC  # noqa: E402

FAILURES = []
R = Reviser()


def check(name, cond, detail=""):
    print(f"  {'PASS' if cond else 'FAIL'}  {name}")
    if detail:
        print(f"          {detail}")
    if not cond:
        FAILURES.append(name)


def fam(word):
    phones, oov = R.lex.transcribe_word(word)
    assert not oov, word
    return CAP._rime_key(phones)


def pair_verdict(a, b):
    found = R.inspect([f"we carry the evening to the {a}",
                       f"and no one had to tell us about {b}"],
                      SC.mandate([[1, 2]], n_lines=2))
    v = found["grade"]["verdicts"]
    codes = {f.code for fs in found["per_line"].values() for f in fs}
    return (v[0] if v else None), codes


def test_the_anchor():
    print("\n1. the family key mirrors the COMPARATOR's anchor (last "
          "prominent, secondary included)")
    # gasoline/tambourine is the pair that caught the first draft of
    # this file conflating the two anchors: the primary-first key split
    # them while the judge heard the final -ine.
    same = [("hair", "chair"), ("bone", "sown"), ("night", "quite"),
            ("gasoline", "tambourine")]
    ok = True
    for a, b in same:
        v, _ = pair_verdict(a, b)
        if fam(a) != fam(b) or v is None or v["why"] is not None:
            ok = False
    check("pairs in one family GRADE as satisfied rhymes — the key is "
          "the judge's own equivalence, not a lookalike", ok)
    # SPLIT 2026-08-23, because the two halves stopped having one answer
    # (doctrine 17). This asserted `fam(a) != fam(b) AND the pair does not
    # grade as satisfied` over both pairs at once, under the DEFAULT door.
    # When the default widened to every admittable relation on 2026-08-22,
    # `hair`/`hire` began SATISFYING as CONSONANCE 0.792 — correctly: the
    # band types it, and doctrine 24 says a rule that would delete a category
    # relabels instead. The family half never moved.
    #
    # The two pairs also fail for DIFFERENT reasons, which the merged check
    # could not say: `bone`/`bin` fails on the SCALAR at 0.671 under every
    # door, `hair`/`hire` fails only on the RELATION and only under a
    # narrowed one. That distinction is the whole of `admits`'s two clauses.
    ok = all(fam(a) != fam(b) for a, b in [("hair", "hire"), ("bone", "bin")])
    check("clearly unrelated pairs sit in different FAMILIES — the key is "
          "the judge's own equivalence and it does not depend on any "
          "declared door",
          ok,
          f"hair={fam('hair')} hire={fam('hire')}; "
          f"bone={fam('bone')} bin={fam('bin')}")
    # REPINNED 2026-08-25 (M-116): under the whole-vocabulary DEFAULT the
    # pair now SATISFIES — bone/bin stand in the consonance schema (coda N
    # agrees) and the schema route is categorical, so the scalar 0.671 no
    # longer decides at the bare door. The scalar claim is still true and
    # is measured where admit sets exist: a DECLARED door (any narrowing,
    # here one that still admits CONSONANCE so the relation clause cannot
    # answer first) is not overridden by the rescue
    # (`lyric_harness.admit_is_default`), and the pair then refuses on
    # theta. The family half never moved: satisfied-by-schema does not put
    # the two words in one family.
    v_bin, _ = pair_verdict("bone", "bin")
    check("under the whole-vocabulary DEFAULT `bone`/`bin` SATISFIES by "
          "schema, and the rescue DISCLOSES which schemas answered — an "
          "uncalibrated pass stays tellable from a scalar pass",
          v_bin is not None and v_bin["why"] is None
          and "consonance" in (v_bin.get("satisfied_by") or []),
          str(v_bin and (v_bin["why"], v_bin.get("satisfied_by"))))
    nr3 = Reviser(decl=Declaration(admit=("CONSONANCE", "RHYME",
                                          "RIME_RICHE")))
    f_bin = nr3.inspect(["we carry the evening to the bone",
                         "and no one had to tell us about bin"],
                        SC.mandate([[1, 2]], n_lines=2))
    v_bin_n = (f_bin["grade"]["verdicts"] or [None])[0]
    check("`bone`/`bin` does not grade as a satisfied rhyme under any "
          "DECLARED door — it fails on the SCALAR, which no admit set can "
          "widen past, and a declared narrowing is not overridden by the "
          "whole-vocabulary default (doctrine 1)",
          v_bin_n is not None
          and "theta_rhyme" in (v_bin_n["why"] or ""),
          str(v_bin_n and v_bin_n["why"]))
    v_hair, _ = pair_verdict("hair", "hire")
    narrow = Reviser(decl=Declaration(admit=("RHYME", "RIME_RICHE")))
    f_n = narrow.inspect(["we carry the evening to the hair",
                          "and no one had to tell us about hire"],
                         SC.mandate([[1, 2]], n_lines=2))
    v_narrow = (f_n["grade"]["verdicts"] or [None])[0]
    check("`hair`/`hire` clears the scalar as CONSONANCE, so whether it "
          "SATISFIES is entirely the declared door: the default admits it, "
          "a rhyme-only declaration refuses it BY RELATION",
          (v_hair is not None and v_hair["why"] is None
           and v_narrow is not None
           and "admit set" in (v_narrow["why"] or "")),
          f"default: {v_hair and (v_hair['relation'], v_hair['score'], v_hair['why'])}; "
          f"narrowed: {v_narrow and v_narrow['why']}")
    # Families are strictly FINER than the graded band: silver/deliver
    # sit in different perfect classes (the feminine anchors SIL vs LIV)
    # while the band may still admit them — capacity states what a
    # PERFECT chain sustains, and this pin keeps that scope honest.
    check("silver/deliver: different families — perfect classes, finer "
          "than the admitted band",
          fam("silver") != fam("deliver"))


def test_tier1():
    print("\n2. tier 1 is the grader's tier 1, not a re-implementation")
    _, codes = pair_verdict("hair", "chair")
    check("a same-class pair carries HOMEOTELEUTON in a REAL grade",
          "HOMEOTELEUTON" in codes)
    _, codes = pair_verdict("bone", "sown")
    check("different classes of one family do not (bone -one / sown "
          "-own)", "HOMEOTELEUTON" not in codes)
    fams = CAP.families(R)
    _, codes_tb = pair_verdict("taught", "thought")
    check("capacity's classes ARE _spelled_rime values — hair/chair share "
          "a class; bone's family splits -one from -own; and "
          "taught/thought (-aught/-ought, an earned pair the grader "
          "leaves unbanned) sit in DIFFERENT classes even though their "
          "last letters agree, which is what separates the real spelled "
          "rime from any suffix lookalike",
          any("hair" in ws and "chair" in ws
              for ws in fams[fam("hair")].values())
          and "one" in fams[fam("bone")] and "own" in fams[fam("bone")]
          and "HOMEOTELEUTON" not in codes_tb
          and not any("taught" in ws and "thought" in ws
                      for ws in fams[fam("taught")].values()))


#: THE CROWN'S SIX FAMILIES RUN IN PARALLEL, and the body lives here rather
#: than inside the section so a worker process can reach it. MEASURED
#: 2026-09-01: `test_capacity.py` is 678s over seven sections and
#: `test_the_crown` alone is 628s (92.6%) -- six witnesses, each re-graded
#: through the real `Reviser`, strictly serial inside one process. That made
#: this file the SECOND largest item in the whole cheap pool behind
#: `test_plan.py`, and after the two giants were given a runner each it was
#: the pool's wall outright. The six are independent by construction: each
#: reads its own row and returns a string.
#:
#: THE SIX ARE UNEVEN AND THAT IS THE CEILING, not the worker count --
#: measured 156.0 / 105.0 / 104.3 / 92.6 / 90.2 / 78.5s. Packed into four
#: lanes that is ~183s, a 3.4x cut; a fifth worker would change nothing,
#: because two of the six have to share a lane whatever the width.
#:
#: FORK IS PINNED rather than left to the default. Under `spawn` a worker
#: re-imports this module, which builds a `Reviser` at import; under `fork`
#: it inherits the one already built. Both are correct and only one is
#: predictable, and the default has moved between Python versions, so it is
#: named here instead of being inherited (doctrine 66).
#:
#: DETERMINISM IS UNTOUCHED. Each family is a pure function of its own row,
#: no worker reads what another writes, and the driver consumes results in
#: CHECK_SAMPLE order, so `bad` is assembled exactly as the serial loop
#: assembled it and no verdict depends on which worker finished first.
def _crown_one(item):
    """-> `(name, complaint or None)` for one family's witness, re-graded
    through the real Reviser."""
    name, certified, witness, chain_lo = item
    if not certified:
        return name, f"{name}: missing/uncertified"
    words = witness.split()
    if len(words) != chain_lo:
        return name, f"{name}: witness length != chain_lo"
    pairs, drift = CAP._grade_group(R, words)
    if pairs or drift:
        return name, (f"{name}: {len(pairs)} banned pair(s), "
                      f"{len(drift)} drift")
    return name, None


def test_the_crown():
    print("\n3. THE CROWN — the committed artifact against the judge")
    rows = CAP.read_table()
    by_fam = {r["family"]: r for r in rows}
    items = []
    for name in CAP.CHECK_SAMPLE:
        r = by_fam.get(name)
        items.append((name, bool(r and r["certified"]),
                      r["witness"] if r else "", r["chain_lo"] if r else 0))
    # `CAPACITY_WORKERS=1` runs the six serially, byte-identical to the
    # pre-parallel section, so the coordinate is a SHAPE one and never a
    # semantics one.
    _w = int(os.environ.get("CAPACITY_WORKERS", "0") or 0) or min(
        4, os.cpu_count() or 1)
    if _w > 1:
        import concurrent.futures as _cf                # noqa: PLC0415
        import multiprocessing as _mp                   # noqa: PLC0415
        with _cf.ProcessPoolExecutor(
                max_workers=_w,
                mp_context=_mp.get_context("fork")) as _ex:
            _graded = list(_ex.map(_crown_one, items))
    else:
        _graded = [_crown_one(_it) for _it in items]
    # CHECK_SAMPLE order, explicitly. `map` already preserves it; naming it
    # says the reduction does not depend on completion order.
    _by_name = dict(_graded)
    bad = [_by_name[name] for name in CAP.CHECK_SAMPLE if _by_name[name]]
    check(f"every sample witness ({len(CAP.CHECK_SAMPLE)} families, "
          f"including the deepest) re-grades CLEAN through the real "
          f"Reviser — chain_lo is what the judge accepted, by "
          f"construction and still",
          not bad, bad or "all clean")
    summary = CAP.summarize(rows)
    check("the ADOPTED constants re-derive from the committed table — a "
          "committed number nothing re-measures is a rumor",
          summary == CAP.ADOPTED,
          {k: (summary.get(k), CAP.ADOPTED.get(k))
           for k in CAP.ADOPTED if summary.get(k) != CAP.ADOPTED.get(k)})
    check("chain_lo never exceeds chain_hi, and certification covers "
          "exactly the declared floor",
          all((r["chain_lo"] or 0) <= r["chain_hi"] for r in rows)
          and all(bool(r["certified"])
                  == (r["classes"] >= CAP.CERTIFY_MIN_CLASSES)
                  for r in rows))


def test_determinism_and_bounds():
    print("\n4. determinism, and the population's declared bounds")
    f1 = CAP.families(R)
    f2 = CAP.families(R)
    check("the tier-1 derivation is deterministic",
          {CAP.fam_label(k): sorted(map(sorted, v.values()))
           for k, v in f1.items()}
          == {CAP.fam_label(k): sorted(map(sorted, v.values()))
              for k, v in f2.items()})
    pop = CAP.population(R.lex)
    check("the population is the DECLARED one: frequency-lexicon words, "
          "alphabetic, two letters up, readable — nothing else",
          all(w.isalpha() and len(w) >= 2 and w in R.lex.freq_rank
              for w in pop))


def run(*argv):
    p = subprocess.run([sys.executable, "lyric_harness.py", *argv],
                       capture_output=True, text=True, cwd=ROOT)
    return p.returncode, p.stdout, p.stderr


def test_the_verb():
    print("\n5. the capacity verb")
    rc, out, _ = run("capacity", "fire")
    check("`capacity fire` answers: family AY-ER, its class named as "
          "tier-1 banned, and the certified witness shown",
          rc == 0 and "AY-ER" in out and "HOMEOTELEUTON" in out
          and "chain_lo" in out, f"rc {rc}")
    rc, out, _ = run("capacity", "--top=5")
    check("`capacity --top=5` renders the deepest families with the "
          "ceiling sentence",
          rc == 0 and out.count("chain_hi") >= 5
          and "switches families" in out)
    rc, out, err = run("capacity")
    check("no argument refuses at exit 2", rc == 2, f"rc {rc}")
    rc, out, err = run("capacity", "fire", "--nope")
    check("an unknown flag refuses at exit 2 (doctrine 20)", rc == 2)
    rc, out, err = run("capacity", "xzqwv")
    check("an unreadable word refuses naming CMUdict — UNKNOWN is not "
          "absent", rc == 2)


def test_the_judge_is_recorded():
    print("\n6. the artifact records the judge it was certified against")
    import tempfile
    # THE DEFECT THIS PINS. `chain_lo` is certified THROUGH the grader, whose
    # tier-2 ban reads two CORPUS-DERIVED tables. On 2026-08-20 `66eb44e`
    # rebuilt both over the loaded corpus and every committed witness had been
    # certified against the old ranking: §3 went red with six families
    # carrying banned pairs and 0 drift, and no instrument could say why. The
    # cause took a before/after re-grade under both tables to establish. With
    # the md5s in the artifact it is one line of output.
    fp = CAP.judge_fingerprint()
    check("the fingerprint covers exactly the declared eng-song tables",
          tuple(sorted(fp)) == tuple(sorted(CAP.judge_files())),
          f"{sorted(fp)} vs {sorted(CAP.judge_files())}")
    check("...and the file list is READ from that declaration, not re-listed "
          "here (doctrine 1)",
          "song_endword_en.tsv" in " ".join(CAP.judge_files()))
    check("every entry is an md5 or the ABSENT sentinel",
          all(v == "ABSENT" or (len(v) == 32 and all(c in "0123456789abcdef"
                                                     for c in v))
              for v in fp.values()), str(fp))

    rows = [{"relation": CAP.ADOPTED_RELATION, "family": "AY", "words": 2,
             "classes": 2, "chain_hi": 2,
             "certified": 0, "chain_lo": "", "witness": "", "examples": "sky"}]
    with tempfile.TemporaryDirectory() as d:
        path = os.path.join(d, "t.tsv")
        CAP.emit_table(rows, path)
        check("emit -> read_judge round-trips the fingerprint",
              CAP.read_judge(path) == fp, str(CAP.read_judge(path)))
        check("...and the rows still read back past the comment line",
              len(CAP.read_table(path)) == 1)

        # A MOVED judge must be DETECTABLE and must NAME the table.
        txt = io.open(path, encoding="utf-8").read()
        moved = txt.replace(fp[CAP.judge_files()[1]], "0" * 32, 1)
        io.open(path, "w", encoding="utf-8").write(moved)
        rec = CAP.read_judge(path)
        diff = sorted(k for k in set(rec) | set(fp) if rec.get(k) != fp.get(k))
        check("a moved table is detected, and only that one",
              diff == [CAP.judge_files()[1]], str(diff))

        # NO judge line is a THIRD state, not an empty one (doctrine 20).
        io.open(path, "w", encoding="utf-8").write(
            "\t".join(CAP.COLUMNS) + "\n")
        check("an artifact with no judge line reads None, not {} — "
              "'records no judge' and 'certified against nothing' are "
              "different statements",
              CAP.read_judge(path) is None, repr(CAP.read_judge(path)))


def test_the_relation_is_a_coordinate():
    """§7 — M-41 (2026-08-28): the family count is a function of a relation
    the headline used to drop. Every capacity number now names its
    relation: the artifact rows carry it, `read_table` refuses a table
    without the column, `families()` takes it as a declared coordinate,
    and the entry's own comparison table re-derives as a command."""
    print("\n7. the relation is a coordinate of every capacity number "
          "(M-41, 2026-08-28)")
    import tempfile

    from lyric_harness import ADMITTABLE_RELATIONS
    check("the relation vocabulary IS the mandate door's — one definition, "
          "checked at import (a capacity under a relation no mandate can "
          "admit would be a number about nothing a writer can declare)",
          set(CAP.RELATION_KEYS) == set(ADMITTABLE_RELATIONS),
          f"{sorted(CAP.RELATION_KEYS)}")

    try:
        CAP.relation_key("SLANT")
        refused = False
    except ValueError as e:
        refused = "SLANT" in str(e) and "RHYME" in str(e)
    check("an undeclared relation REFUSES naming itself and the vocabulary",
          refused)

    # M-41's OWN COMPARISON TABLE, re-derived over the identical
    # population — the measurement that carried the entry is a command
    # now (`--families=RELATION`) and these are its pinned rows.
    for rel, want in (
            ("RHYME", (12387, 8131, 399, 1)),
            ("ASSONANCE", (15, 0, 5269, 2382)),
            ("CONSONANCE", (3527, 1905, 2002, 1)),
            ("RIME_RICHE", (37462, 35471, 7, 1))):
        s = CAP.family_summary(R, rel)
        got = (s["families"], s["singletons"], s["max"], s["median"])
        check(f"{rel}: families/singletons/max/median pin at {want} — "
              + ("the shipped partition" if rel == "RHYME" else
                 "the object the narrowness sentence is about, two orders "
                 "of magnitude away" if rel == "ASSONANCE" else
                 "declared key, measured here"),
              got == want, f"{got}")
    check("fifteen assonance families is about the stressed vowel "
          "inventory of English — the sanity check that the key is the "
          "right one rather than an artefact (M-41's own words)",
          CAP.family_summary(R, "ASSONANCE")["families"] == 15)

    check("the default partition IS the adopted relation's — "
          "families() with nothing declared reproduces families("
          "relation='RHYME') family-for-family",
          len(CAP.families(R)) == 12387)

    # THE ARTIFACT CARRIES THE COORDINATE ON EVERY ROW, and a table
    # WITHOUT the column is unreadable rather than silently read as
    # RHYME (the mutation: yesterday's schema).
    rows = CAP.read_table()
    check("every committed row names the adopted relation",
          all(r["relation"] == CAP.ADOPTED_RELATION for r in rows),
          f"{sorted({r['relation'] for r in rows})}")
    with tempfile.TemporaryDirectory() as d:
        path = os.path.join(d, "old_schema.tsv")
        old_cols = tuple(c for c in CAP.COLUMNS if c != "relation")
        with io.open(path, "w", encoding="utf-8") as fh:
            fh.write("\t".join(old_cols) + "\n")
            fh.write("AY\t2\t2\t2\t0\t\t\tsky\n")
        try:
            CAP.read_table(path)
            unreadable = False
        except AssertionError:
            unreadable = True
        check("MUTATION: a relation-less table (yesterday's schema) is "
              "REFUSED at read — the coordinate cannot be dropped by "
              "shipping an old file",
              unreadable)


if __name__ == "__main__":
    for fn in (test_the_anchor, test_tier1, test_the_crown,
               test_determinism_and_bounds, test_the_verb,
               test_the_judge_is_recorded, test_the_relation_is_a_coordinate):
        fn()
    print("=" * 62)
    if FAILURES:
        print(f"{len(FAILURES)} FAILING: {', '.join(FAILURES)}")
        sys.exit(1)
    print("capacity states what the language holds, in the judge's own "
          "units — and grades nothing")
