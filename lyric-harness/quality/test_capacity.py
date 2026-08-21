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
    ok = True
    for a, b in [("hair", "hire"), ("bone", "bin")]:
        v, _ = pair_verdict(a, b)
        if fam(a) == fam(b) or (v is not None and v["why"] is None):
            ok = False
    check("clearly unrelated pairs sit in different families and do not "
          "grade as rhymes", ok)
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


def test_the_crown():
    print("\n3. THE CROWN — the committed artifact against the judge")
    rows = CAP.read_table()
    by_fam = {r["family"]: r for r in rows}
    bad = []
    for name in CAP.CHECK_SAMPLE:
        r = by_fam.get(name)
        if not r or not r["certified"]:
            bad.append(f"{name}: missing/uncertified")
            continue
        words = r["witness"].split()
        if len(words) != r["chain_lo"]:
            bad.append(f"{name}: witness length != chain_lo")
            continue
        pairs, drift = CAP._grade_group(R, words)
        if pairs or drift:
            bad.append(f"{name}: {len(pairs)} banned pair(s), "
                       f"{len(drift)} drift")
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

    rows = [{"family": "AY", "words": 2, "classes": 2, "chain_hi": 2,
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


if __name__ == "__main__":
    for fn in (test_the_anchor, test_tier1, test_the_crown,
               test_determinism_and_bounds, test_the_verb,
               test_the_judge_is_recorded):
        fn()
    print("=" * 62)
    if FAILURES:
        print(f"{len(FAILURES)} FAILING: {', '.join(FAILURES)}")
        sys.exit(1)
    print("capacity states what the language holds, in the judge's own "
          "units — and grades nothing")
