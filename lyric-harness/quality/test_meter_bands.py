#!/usr/bin/env python3
"""Regressions for the calibration runner (quality/meter_bands.py).

THE ONE CLAIM THAT MATTERS: the envelope is computed over exactly the lines
the preregistration declares — the grader's own reader, exclusion instead of
imputation, nearest-rank percentiles — so the numbers in
RESULTS_METER_BANDS.md are re-derivable and not remembered (doctrine 58).

Sections:
  1  nearest rank — the declared percentile method against hand-computed
     cases, including the edges where an off-by-one would hide
  2  the lyric-line filter — comments, source markers, structure markers and
     blanks are OUT; the words are IN
  3  exclusion, not imputation — a numeral and an OOV token each put the
     line OUT with the cause named; conservation holds exactly
  4  determinism — the same file measures identically twice
  5  a real corpus file — every record obeys 0 <= prominent <= syllables
  6  the proposal is DERIVED — bands equal the named percentiles of the
     measured values, never a copied constant

Run: python3 quality/test_meter_bands.py
"""

import os
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
sys.path.insert(0, os.path.join(HERE, "..", ".."))

from quality.meter_bands import (CalibrationRefused, lyric_lines,  # noqa: E402
                                 measure_corpus, measure_line, nearest_rank,
                                 percentile_table, proposed_bands)

FAILURES = []


def check(name, cond, detail=""):
    print(f"  {'PASS' if cond else 'FAIL'}  {name}")
    if detail:
        print(f"          {detail}")
    if not cond:
        FAILURES.append(name)


def test_nearest_rank():
    print("\n1. nearest rank, the declared method — hand-computed cases")
    v = [15, 20, 35, 40, 50]
    check("p30 of [15,20,35,40,50] is 20 — ceil(0.30*5)=2, the 2nd smallest "
          "(the textbook nearest-rank case)", nearest_rank(v, 30) == 20,
          nearest_rank(v, 30))
    check("p50 of five values is the 3rd — ceil(2.5)=3, where a floor would "
          "give the 2nd", nearest_rank(v, 50) == 35)
    check("p100 is the maximum", nearest_rank(v, 100) == 50)
    check("p1 of N=5 is the minimum — ceil(0.05)=1",
          nearest_rank(v, 1) == 15)
    check("N=1: every percentile is the one value",
          all(nearest_rank([7], p) == 7 for p in (1, 50, 99, 100)))
    check("the answer is always a value that OCCURS — no interpolation "
          "invented", nearest_rank([1, 2], 50) in (1, 2))
    for bad_args, why in ((([], 50), "a percentile of nothing"),
                          (([1], 0), "p=0 is outside (0, 100]"),
                          (([1], 101), "p=101 is outside (0, 100]")):
        try:
            nearest_rank(*bad_args)
            check(f"refuses {bad_args} — {why}", False, "no refusal raised")
        except CalibrationRefused:
            check(f"refuses {bad_args} — {why}", True)


SYNTH = """# author: nobody
# source: fabricated for test_meter_bands section 2
--- TITLE: A TEST
[VERSE 1]
the cat sat on the mat
kiss me though you make believe

[CHORUS]
somebody leave the open sign on
"""


def test_lyric_filter():
    print("\n2. the lyric-line filter — structure OUT, words IN")
    with tempfile.TemporaryDirectory() as td:
        p = os.path.join(td, "eng_synth.txt")
        with open(p, "w", encoding="utf-8") as fh:
            fh.write(SYNTH)
        got = lyric_lines(p)
    texts = [t for _, t in got]
    check("exactly the 3 word-lines survive — comments, ---, [markers] and "
          "blanks are all structural", len(got) == 3, texts)
    check("...and they are the right 3, in file order with real line numbers",
          texts == ["the cat sat on the mat",
                    "kiss me though you make believe",
                    "somebody leave the open sign on"]
          and [n for n, _ in got] == [5, 6, 9], got)


def test_exclusion_not_imputation():
    print("\n3. exclusion, not imputation (doctrine 79)")
    syl, prom, causes = measure_line("kiss me though you make believe")
    check("a clean line is MEASURED — no causes, plausible counts",
          causes == () and syl == 7 and 0 < prom <= syl,
          f"{syl} syllables, {prom} prominent, causes {causes}")
    _, _, causes = measure_line("we drove out on route 66 tonight")
    check("a numeral puts the line OUT with the cause NAMED — its count is a "
          "lower bound, and a lower bound in a percentile is a lie",
          "NUMERAL" in causes, causes)
    _, _, causes = measure_line("the florgleblat sang zzyxxqj at dawn")
    check("an out-of-lexicon token puts the line OUT with the cause NAMED",
          "OUT_OF_LEXICON" in causes, causes)

    with tempfile.TemporaryDirectory() as td:
        with open(os.path.join(td, "eng_synth.txt"), "w",
                  encoding="utf-8") as fh:
            fh.write(SYNTH + "we drove out on route 66 tonight\n")
        cal = measure_corpus(root=td, corpus_glob="eng_*.txt")
    check("conservation holds EXACTLY — measured + excluded == lyric lines "
          "(4 lyric, 3 measured, 1 excluded)",
          cal.lyric_lines == 4 and len(cal.records) == 3
          and len(cal.excluded) == 1,
          f"lyric {cal.lyric_lines}, measured {len(cal.records)}, "
          f"excluded {len(cal.excluded)}")
    check("...and the excluded fraction and cause tally say so",
          cal.excluded_fraction == 0.25
          and cal.exclusion_causes.get("NUMERAL") == 1,
          cal.exclusion_causes)
    try:
        measure_corpus(root="/nonexistent-dir-xyz", corpus_glob="eng_*.txt")
        check("an empty population is REFUSED, not an empty table", False)
    except CalibrationRefused as e:
        check("an empty population is REFUSED, not an empty table",
              "no corpus files" in str(e), str(e)[:70])


def test_determinism():
    print("\n4. determinism — the sweep is a function of the corpus")
    with tempfile.TemporaryDirectory() as td:
        with open(os.path.join(td, "eng_synth.txt"), "w",
                  encoding="utf-8") as fh:
            fh.write(SYNTH)
        a = measure_corpus(root=td, corpus_glob="eng_*.txt")
        b = measure_corpus(root=td, corpus_glob="eng_*.txt")
    check("the same corpus measures identically twice",
          a.records == b.records and a.excluded == b.excluded
          and a.lyric_lines == b.lyric_lines)


def test_real_file():
    print("\n5. one real corpus file — the reader's arithmetic holds")
    root = os.path.dirname(HERE)
    cal = measure_corpus(root=root,
                         corpus_glob=os.path.join(
                             "corpus", "song", "eng_american_alice_cary.txt"))
    check("the file yields records, and every one obeys "
          "0 <= prominent <= syllables (prediction P2's per-line half)",
          len(cal.records) > 0
          and all(0 <= r.prominent <= r.syllables for r in cal.records),
          f"{len(cal.records)} measured, {len(cal.excluded)} excluded "
          f"of {cal.lyric_lines}")
    check("conservation holds on real data too",
          len(cal.records) + len(cal.excluded) == cal.lyric_lines)


def test_proposal_is_derived():
    print("\n6. the proposal is DERIVED from the envelope, not remembered")
    with tempfile.TemporaryDirectory() as td:
        with open(os.path.join(td, "eng_synth.txt"), "w",
                  encoding="utf-8") as fh:
            fh.write(SYNTH)
        cal = measure_corpus(root=td, corpus_glob="eng_*.txt")
    bands = proposed_bands(cal)
    syl = [r.syllables for r in cal.records]
    prom = [r.prominent for r in cal.records]
    check("DENSITY == (p5, p95) of the measured syllables, recomputed here "
          "independently",
          bands["DENSITY"] == (nearest_rank(syl, 5), nearest_rank(syl, 95)),
          bands["DENSITY"])
    check("PROMINENCE == (p5, p95) of the measured prominents",
          bands["PROMINENCE"] == (nearest_rank(prom, 5),
                                  nearest_rank(prom, 95)),
          bands["PROMINENCE"])
    check("the proposal DISCLOSES its cut and population beside the numbers",
          bands["cut"] == (5, 95) and bands["population"] == len(cal.records))
    t = percentile_table(syl)
    check("the table serves every preregistered point",
          set(t) == {1, 5, 25, 50, 75, 95, 99})


if __name__ == "__main__":
    for fn in (test_nearest_rank, test_lyric_filter,
               test_exclusion_not_imputation, test_determinism,
               test_real_file, test_proposal_is_derived):
        fn()
    print("=" * 62)
    if FAILURES:
        print(f"{len(FAILURES)} FAILING: {', '.join(FAILURES)}")
        sys.exit(1)
    print("the envelope is measured the way the registration says it is")
