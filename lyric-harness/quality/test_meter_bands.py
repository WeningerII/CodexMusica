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

from quality.meter_bands import (AMENDMENT_MIN_KEPT_FRACTION,  # noqa: E402
                                 Calibration, CalibrationRefused,
                                 ExcludedLine, LineRecord, amendment,
                                 lyric_lines, measure_corpus, measure_line,
                                 nearest_rank, per_file_exclusion,
                                 percentile_table, proposed_bands, reader,
                                 reader_trial)

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
    syl, prom, derived, causes = measure_line(
        "kiss me though you make believe")
    check("a clean line is MEASURED — no causes, plausible counts, and "
          "derived 0 under the default reader by construction",
          causes == () and syl == 7 and 0 < prom <= syl and derived == 0,
          f"{syl} syllables, {prom} prominent, causes {causes}")
    _, _, _, causes = measure_line("we drove out on route 66 tonight")
    check("a numeral puts the line OUT with the cause NAMED — its count is a "
          "lower bound, and a lower bound in a percentile is a lie",
          "NUMERAL" in causes, causes)
    _, _, _, causes = measure_line("the florgleblat sang zzyxxqj at dawn")
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
    check("...and the sweep RECORDS which declared reader produced it, so "
          "the REPRODUCE line can never name a different run's command",
          a.reader_mode == "default", a.reader_mode)


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


def _cal(records, excluded):
    """A hand-built Calibration — the amendment is aggregation over the
    sweep's records, so its logic is testable without a corpus or a
    lexicon."""
    c = Calibration(files=len({r.path for r in records}
                              | {e.path for e in excluded}),
                    raw_lines=0, lyric_lines=len(records) + len(excluded))
    c.records = list(records)
    c.excluded = list(excluded)
    return c


def test_the_amendment():
    print("\n7. the amendment — the registered subset test "
          "(METER_BANDS_PREREGISTRATION_AMENDMENT.md)")
    # File A: 10 lines, all read. File B: 10 lines, 6 excluded — 60% is
    # over the declared 15%, so B is HIGH and A is LOW.
    a_recs = [LineRecord("A", i, 8, 4) for i in range(1, 11)]
    b_recs = [LineRecord("B", i, 8, 4) for i in range(1, 5)]
    b_excl = [ExcludedLine("B", i, ("OUT_OF_LEXICON",))
              for i in range(5, 11)]
    rates = per_file_exclusion(_cal(a_recs + b_recs, b_excl))
    check("per-file rates are the file's OWN conservation — A 0/10, B 6/10",
          rates["A"] == (10, 0, 0.0) and rates["B"] == (10, 6, 0.6), rates)

    res = amendment(_cal(a_recs + b_recs, b_excl))
    check("the split lands as declared — A LOW, B HIGH",
          res["low_files"] == 1 and res["high_files"] == 1)
    check("the floor is measured against MEASURED lines — LOW keeps 10/14",
          res["floor_met"] and abs(res["kept_fraction"] - 10 / 14) < 1e-9,
          f"{res['kept_fraction']:.3f}")
    check("identical distributions agree at every registered point and the "
          "verdict is ADOPTED",
          res["adopted"] and all(d == 0 for q in res["deltas"].values()
                                 for d in q.values()), res["verdict"][:60])

    # B's CERTAIN lines are longer (10 syllables) and numerous enough to
    # drag the pool's p50 exactly TWO away from the LOW subset's — the
    # smallest warp past the registered ±1, chosen so that a tolerance
    # quietly widened to ±5 would wrongly ADOPT and go red here (mutation
    # M4's first draft used a delta of 6, which even the widened mutant
    # refused — a check that cannot fail is decoration, doctrine 48).
    b_long = [LineRecord("B", i, 10, 5) for i in range(1, 12)]
    b_excl2 = [ExcludedLine("B", i, ("OUT_OF_LEXICON",))
               for i in range(12, 15)]
    res = amendment(_cal(a_recs + b_long, b_excl2))
    check("a warped pool is caught — deltas exceed ±1 and the verdict is "
          "NOT ADOPTED (the licence is the agreement, not the wish)",
          not res["adopted"]
          and any(abs(d) > 1 for q in res["deltas"].values()
                  for d in q.values()),
          res["deltas"])

    # LOW keeps 3 of 13 measured — under the 40% floor: REFUSED, and no
    # envelope is even computed from the thin subset.
    a_thin = [LineRecord("A", i, 8, 4) for i in range(1, 4)]
    b_many = [LineRecord("B", i, 8, 4) for i in range(1, 11)]
    b_excl3 = [ExcludedLine("B", i, ("OUT_OF_LEXICON",))
               for i in range(11, 15)]
    res = amendment(_cal(a_thin + b_many, b_excl3))
    check("a too-thin subset is REFUSED, not licensed from — "
          f"{AMENDMENT_MIN_KEPT_FRACTION:.0%} floor",
          not res["floor_met"] and not res["adopted"]
          and "REFUSED" in res["verdict"] and "deltas" not in res,
          res["verdict"][:70])


def test_the_reader_trial():
    print("\n8. the reader trial — certain vs derived "
          "(METER_BANDS_PREREGISTRATION_READER.md)")
    # THE SEAM. The dialect word the default reader refuses is READ by the
    # declared fallback reader, counted, and TAGGED as derived — refusals
    # and syllables from one source of truth (the phonology), so the two
    # can never disagree about which words were read.
    ph = reader("fallback-low")
    syl, prom, derived, causes = measure_line(
        "gie me a canty hour at hame", phon=ph)
    check("the dialect line the default reader refuses is READ under "
          "fallback-low, with the derived tokens COUNTED, not hidden",
          causes == () and derived >= 2 and syl >= 7 and 0 <= prom <= syl,
          f"{syl} syllables, {prom} prominent, {derived} derived")
    _, _, derived0, causes0 = measure_line("gie me a canty hour at hame")
    check("...and the same line under the DEFAULT reader is still refused — "
          "run one stays reproducible, byte for byte",
          "OUT_OF_LEXICON" in causes0 and derived0 == 0,
          f"causes {causes0}")
    try:
        reader("cmudict-plus-vibes")
        check("an undeclared reader mode is refused by name", False)
    except CalibrationRefused as e:
        check("an undeclared reader mode is refused by name",
              "not declared" in str(e), str(e)[:60])

    # The trial's verdicts, on hand-built records. CERTAIN: forty lines of
    # (8,4). DERIVED: twenty of (8,5) — syllables agree exactly, prominent
    # differs by exactly +1 at every point: BOTH within tolerance -> both
    # adopt.
    cert = [LineRecord("A", i, 8, 4, 0) for i in range(1, 41)]
    der = [LineRecord("B", i, 8, 5, 2) for i in range(1, 21)]
    t = reader_trial(_cal(cert + der, []))
    check("agreement within ±1 on both quantities adopts BOTH pool bands",
          t["gate_met"] and t["verdicts"]["DENSITY"]
          and t["verdicts"]["PROMINENCE"]
          and t["adopted"]["DENSITY"] is not None
          and t["adopted"]["PROMINENCE"] is not None
          and "BOTH" in t["verdict"], t["verdict"][:50])

    # DERIVED prominent runs 2 hotter — the smallest disagreement past the
    # registered ±1 (a tolerance quietly widened would wrongly adopt here,
    # the same minimal-warp lesson mutation M4 taught section 7). Syllables
    # still agree: the declared PARTIAL outcome, DENSITY adopts alone.
    der_hot = [LineRecord("B", i, 8, 6, 2) for i in range(1, 21)]
    t = reader_trial(_cal(cert + der_hot, []))
    check("a stress channel running 2 hot refuses PROMINENCE while DENSITY "
          "still adopts — the declared PARTIAL outcome",
          t["verdicts"]["DENSITY"] and not t["verdicts"]["PROMINENCE"]
          and t["adopted"]["DENSITY"] is not None
          and t["adopted"]["PROMINENCE"] is None
          and "PARTIAL" in t["verdict"],
          t["tables"]["PROMINENCE"]["deltas"])

    # The hard gate: 30 measured (20 certain + 10 derived, so a mutant that
    # opens the gate proceeds to a verdict and fails THIS check by name
    # instead of crashing on an unrelated refusal), 11 excluded = 26.8% >
    # 25% — STOPPED, and no split, no tables, no adoption computed past it.
    excl = [ExcludedLine("A", i, ("OUT_OF_LEXICON",)) for i in range(50, 61)]
    t = reader_trial(_cal(cert[:20] + der[:10], excl))
    check("past the exclusion ceiling the trial STOPS AT THE GATE — "
          "nothing adopts and no table is computed to be tempted by",
          not t["gate_met"] and t["adopted"] == {}
          and "STOPPED" in t["verdict"] and "tables" not in t,
          f"exclusion {t['exclusion']:.3f}")

    # A sweep with no derived lines has nothing on trial.
    try:
        reader_trial(_cal(cert, []))
        check("a trial with no derived lines is REFUSED, not vacuously "
              "passed", False)
    except CalibrationRefused as e:
        check("a trial with no derived lines is REFUSED, not vacuously "
              "passed", "derived" in str(e), str(e)[:60])


def test_the_adoption_check():
    print("\n9. the drift instrument — shipped constants vs a re-derived "
          "trial")
    from quality.meter_bands import (ADOPTED, ADOPTED_READER,
                                     adoption_check)
    check("the shipped constants are the adopted ones — DENSITY [5,12], "
          "PROMINENCE [2,7], at the registered reader",
          ADOPTED == {"DENSITY": (5, 12), "PROMINENCE": (2, 7)}
          and ADOPTED_READER == "fallback-low")
    # The comparison logic, on synthetic sweeps via `expected` — the
    # production default (expected=None -> ADOPTED) is exercised by the CI
    # step `python3 quality/meter_bands.py --check`, which runs the real
    # 49-second derivation.
    cert = [LineRecord("A", i, 8, 4, 0) for i in range(1, 41)]
    der = [LineRecord("B", i, 8, 4, 2) for i in range(1, 21)]
    cal = _cal(cert + der, [])
    cal.reader_mode = "fallback-low"
    ok, msg = adoption_check(cal, expected={"DENSITY": (8, 8),
                                            "PROMINENCE": (4, 4)})
    check("matching constants PASS with the derivation quoted",
          ok and "re-derive exactly" in msg, msg[:70])
    ok, msg = adoption_check(cal, expected={"DENSITY": (5, 12),
                                            "PROMINENCE": (4, 4)})
    check("a drifted band FAILS with both values NAMED — shipped and "
          "re-derived", not ok and "DENSITY" in msg and "[5, 12]" in msg
          and "[8, 8]" in msg, msg[:90])
    cal_wrong = _cal(cert + der, [])
    cal_wrong.reader_mode = "default"
    ok, msg = adoption_check(cal_wrong, expected={"DENSITY": (8, 8)})
    check("a sweep read with the WRONG reader is refused before any "
          "comparison — checking against the wrong instrument checks "
          "nothing", not ok and "wrong instrument" in msg, msg[:70])
    hot = [LineRecord("B", i, 8, 6, 2) for i in range(1, 21)]
    cal_hot = _cal(cert + hot, [])
    cal_hot.reader_mode = "fallback-low"
    ok, msg = adoption_check(cal_hot, expected={"DENSITY": (8, 8),
                                                "PROMINENCE": (4, 6)})
    check("a trial that no longer adopts a shipped band FAILS naming the "
          "verdict, not just the numbers",
          not ok and "no longer adopts" in msg, msg[:90])


def test_the_enforcement():
    print("\n10. THE ENFORCEMENT — the adopted bands are per-line FLAGS in "
          "the grader (the second sitting's deliverable)")
    from quality.revise import Reviser
    R = Reviser()
    lines = [
        # 1: in band both ways (8 syllables) — must carry NO band finding.
        "the bells ring out across the empty town",
        # 2: 3 syllables — under the density floor.
        "burn it down",
        # 3: long — over both ceilings.
        "counting every lit-up letter in the window of the shuttered "
        "five and dime tonight",
        # 4: in band, rhymes with 2 in the mandate so the rhyme layer has
        # its say too — the band layer must not disturb it.
        "the river carries every crown",
    ]
    found = R.inspect(lines, mandate="AXXA")
    per = found["per_line"]

    def band_codes(ln):
        return sorted(f.code for f in per.get(ln, [])
                      if f.code in ("DENSITY_OUT_OF_BAND",
                                    "PROMINENCE_OUT_OF_BAND",
                                    "BAND_UNJUDGED"))
    check("an in-band line carries NO band finding — silence means clean, "
          "because the check runs unconditionally",
          band_codes(1) == [] and band_codes(4) == [], band_codes(1))
    check("too FEW syllables is a FLAG — under the floor is refused, not "
          "nudged",
          band_codes(2) == ["DENSITY_OUT_OF_BAND"]
          and all(f.severity == "flag" for f in per[2]
                  if f.code == "DENSITY_OUT_OF_BAND"), band_codes(2))
    check("too MANY syllables and too many prominents are BOTH flags on "
          "the long line — a band, not a direction",
          band_codes(3) == ["DENSITY_OUT_OF_BAND",
                            "PROMINENCE_OUT_OF_BAND"], band_codes(3))
    check("...and every band violation is severity FLAG — the loop holds "
          "the line open until it is fixed, nothing to opt into",
          all(f.severity == "flag" for ln in (2, 3) for f in per[ln]
              if f.code.endswith("OUT_OF_BAND")))

    # The lower-bound asymmetry (doctrine 79). `wi'` refuses even at
    # fallback-low: a short line with it gets NO density flag (the floor
    # cannot be proven) and a BAND_UNJUDGED note instead; a line already
    # over the ceiling on readable tokens alone flags DESPITE the refusal.
    found = R.inspect(
        ["dance wi' me", "counting every lit-up letter in the window of "
         "the shuttered five and dime wi' thee"], mandate="AA")
    per = found["per_line"]
    c1 = sorted(f.code for f in per.get(1, []) if "BAND" in f.code
                or "OUT_OF" in f.code)
    c2 = sorted(f.code for f in per.get(2, []) if "BAND" in f.code
                or "OUT_OF" in f.code)
    check("a refused token makes UNDER-the-floor unjudgeable: no flag, a "
          "BAND_UNJUDGED note names the token instead",
          "DENSITY_OUT_OF_BAND" not in c1 and "BAND_UNJUDGED" in c1, c1)
    check("...but OVER-the-ceiling flags anyway — a lower bound above 12 "
          "is a violation no missing token can undo",
          "DENSITY_OUT_OF_BAND" in c2 and "BAND_UNJUDGED" in c2, c2)

    # THE INSTRUMENT MATCH, FALSIFIABLE. This dialect line reads COMPLETE
    # and in-band only under the calibration's own reader (section 8 proved
    # the default refuses it) — so an enforcement quietly reading with the
    # default reader would stamp BAND_UNJUDGED here, and this check is what
    # goes red. The registered adoption condition, as a regression rather
    # than prose.
    found = R.inspect(["gie me a canty hour at hame",
                       "the bells ring out across the empty town"],
                      mandate="AA")
    c1 = sorted(f.code for f in found["per_line"].get(1, [])
                if "BAND" in f.code or "OUT_OF" in f.code)
    check("a dialect line the fallback reads clean carries NO band finding "
          "— enforcement reads with the CALIBRATION'S reader (the "
          "registered instrument-match condition)", c1 == [], c1)


if __name__ == "__main__":
    for fn in (test_nearest_rank, test_lyric_filter,
               test_exclusion_not_imputation, test_determinism,
               test_real_file, test_proposal_is_derived,
               test_the_amendment, test_the_reader_trial,
               test_the_adoption_check, test_the_enforcement):
        fn()
    print("=" * 62)
    if FAILURES:
        print(f"{len(FAILURES)} FAILING: {', '.join(FAILURES)}")
        sys.exit(1)
    print("the envelope is measured the way the registration says it is")
