#!/usr/bin/env python3
"""Calibration runner: what sung English lines actually ask a bar to hold.

Measures, over every lyric line of `corpus/song/eng_*.txt`, the two
setting-free demand quantities the fit layer's density and prominence
arithmetic runs on — syllables per line and prominent syllables per line —
and derives the percentile envelope the meter BANDS are proposed from.

The method is preregistered in `quality/METER_BANDS_PREREGISTRATION.md`; the
measured tables live in `quality/RESULTS_METER_BANDS.md`. This module is why
neither document's numbers are "ones somebody remembers" (doctrine 58): run

    python3 quality/meter_bands.py

from the harness root and every number in RESULTS re-derives, byte for byte.

WHAT IS NOT MEASURED. Stress-on-head agreement rates: which prominent
syllable lands on which head depends on a placement and a setting the corpus
does not carry, and computing a rate would assume the isochrony `fit.py`
refuses with NO_SETTING. Only the pigeonhole counts are honest, so only they
are measured.

THE READER IS THE GRADER'S READER. Every line goes through
`quality.fit.read_line` on the default `eng` path — the same call, the same
WEAK_ALWAYS/WEAK_NONFINAL phrase-level demotion, the same OOV refusals the
harness grades drafts with. A private re-implementation here would calibrate
a band for a different instrument than the one that enforces it.

EXCLUSION, NOT IMPUTATION. A line with a refused token (NUMERAL,
OUT_OF_LEXICON) has a syllable count that is a LOWER BOUND (doctrine 79),
and a lower bound inside a percentile is a lie wearing a decimal. Such lines
are excluded from the envelope, tallied by cause, and the excluded fraction
is part of the result.
"""

import glob
import math
import os
from collections import Counter
from dataclasses import dataclass, field

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

#: The population, exactly as preregistered.
CORPUS_GLOB = os.path.join("corpus", "song", "eng_*.txt")

#: A lyric line is a stripped, non-empty line that is not a comment (`#`),
#: a source marker (`---`), or a structure marker (`[VERSE n]`/`[CHORUS]`).
STRUCTURAL_PREFIXES = ("#", "---", "[")

#: Preregistered percentile points, and the pair the bands are cut at.
PERCENTILE_POINTS = (1, 5, 25, 50, 75, 95, 99)
BAND_CUT = (5, 95)


class CalibrationRefused(Exception):
    """The calibration declines to produce a number it cannot stand behind."""


@dataclass(frozen=True)
class LineRecord:
    """One measured line: where it came from and what it asks for.

    `derived` counts the tokens read by a non-dictionary layer of the
    declared reader (`phon.derived`); 0 means dictionary-certain. The
    reader registration's CERTAIN/DERIVED split keys on it."""
    path: str
    lineno: int
    syllables: int
    prominent: int
    derived: int = 0


@dataclass(frozen=True)
class ExcludedLine:
    """One line the envelope refuses to count, and every reason why."""
    path: str
    lineno: int
    causes: tuple


@dataclass
class Calibration:
    """The whole sweep: what was read, what was measured, what was refused.

    `reader_mode` records WHICH declared reader produced these numbers, so
    the REPRODUCE line can never name a command that reproduces a different
    run — the defect the first fallback sweep printed before this field
    existed."""
    files: int = 0
    raw_lines: int = 0
    lyric_lines: int = 0
    reader_mode: str = "default"
    records: list = field(default_factory=list)
    excluded: list = field(default_factory=list)

    @property
    def exclusion_causes(self):
        c = Counter()
        for e in self.excluded:
            for cause in e.causes:
                c[cause] += 1
        return dict(c)

    @property
    def excluded_fraction(self):
        return len(self.excluded) / self.lyric_lines if self.lyric_lines else 0.0


def lyric_lines(path):
    """-> [(lineno, text)] for one corpus file, by the preregistered filter."""
    out = []
    with open(path, encoding="utf-8") as fh:
        for i, raw in enumerate(fh, 1):
            s = raw.strip()
            if not s or s.startswith(STRUCTURAL_PREFIXES):
                continue
            out.append((i, s))
    return out


#: The declared readers (METER_BANDS_PREREGISTRATION_READER.md). "default"
#: is run one's reader unchanged, so the bare command keeps reproducing run
#: one; "fallback-low" is the reader amendment — the eng phonology with the
#: G2P fallback at min_confidence="low", from which read_line derives the
#: matching Lexicon so refusals and syllables can never disagree.
READER_MODES = ("default", "fallback-low")
_READERS = {}


def reader(mode="default"):
    """-> the phonology for a declared reader mode, or None for default."""
    if mode not in READER_MODES:
        raise CalibrationRefused(
            f"reader {mode!r} is not declared; the modes are {READER_MODES}")
    if mode == "default":
        return None
    if mode not in _READERS:
        from quality.phonology.eng import English
        _READERS[mode] = English(fallback="low")
    return _READERS[mode]


def measure_line(text, phon=None):
    """-> (syllables, prominent, derived, causes). Empty causes = MEASURED.

    Causes, when present, name why the line is excluded from the envelope:
    the refused tokens' own causes (NUMERAL, OUT_OF_LEXICON), ZERO_UNITS for
    a line that tokenised to nothing, PROMINENCE_UNDECIDED if any unit's
    prominence resolved to None — a guess in any of these is a hidden
    coordinate, so the line is counted OUT, never counted wrong.

    `derived` counts the tokens the declared reader answered on a
    non-dictionary layer (0 under the default reader by construction) — the
    CERTAIN/DERIVED split the reader registration adjudicates with.
    """
    import quality.fit as FT
    lu = FT.read_line(text, phon=phon) if phon is not None \
        else FT.read_line(text)
    causes = sorted({r.cause for r in lu.refused})
    if not lu.units and not causes:
        causes = ["ZERO_UNITS"]
    if any(u.prominence is None for u in lu.units):
        causes.append("PROMINENCE_UNDECIDED")
    derived = len(phon.derived(text)) if phon is not None \
        and hasattr(phon, "derived") else 0
    return lu.syllables, len(lu.prominent), derived, tuple(causes)


def measure_corpus(root=None, corpus_glob=None, reader_mode="default"):
    """-> Calibration over the preregistered population.

    Conservation is checked here, not trusted: measured + excluded must equal
    the lyric-line total exactly, and every record must satisfy
    0 <= prominent <= syllables. A violation is a reader bug and the sweep
    REFUSES rather than reporting numbers built on it (prediction P2).
    """
    paths = sorted(glob.glob(os.path.join(root or ROOT,
                                          corpus_glob or CORPUS_GLOB)))
    if not paths:
        raise CalibrationRefused(
            f"no corpus files match {corpus_glob or CORPUS_GLOB!r} under "
            f"{root or ROOT!r} — an empty population has no percentiles")
    phon = reader(reader_mode)
    cal = Calibration(files=len(paths), reader_mode=reader_mode)
    for p in paths:
        with open(p, encoding="utf-8") as fh:
            cal.raw_lines += sum(1 for _ in fh)
        rel = os.path.relpath(p, root or ROOT)
        for lineno, text in lyric_lines(p):
            cal.lyric_lines += 1
            syl, prom, derived, causes = measure_line(text, phon=phon)
            if causes:
                cal.excluded.append(ExcludedLine(rel, lineno, causes))
                continue
            if not (0 <= prom <= syl):
                raise CalibrationRefused(
                    f"{rel}:{lineno}: prominent {prom} outside [0, {syl}] — "
                    f"the reader is broken and every number above it is void "
                    f"(prediction P2)")
            cal.records.append(LineRecord(rel, lineno, syl, prom, derived))
    if len(cal.records) + len(cal.excluded) != cal.lyric_lines:
        raise CalibrationRefused(
            f"conservation failed: {len(cal.records)} measured + "
            f"{len(cal.excluded)} excluded != {cal.lyric_lines} lyric lines")
    return cal


def nearest_rank(values, p):
    """The p-th percentile by nearest rank: k = ceil(p/100 * N), the k-th
    smallest, 1-indexed. No interpolation is invented — the answer is always
    a value that actually occurs. Refuses an empty population."""
    if not values:
        raise CalibrationRefused("a percentile of nothing is not a number")
    if not 0 < p <= 100:
        raise CalibrationRefused(f"percentile {p} is outside (0, 100]")
    s = sorted(values)
    k = math.ceil(p / 100 * len(s))
    return s[max(k, 1) - 1]


def percentile_table(values, points=PERCENTILE_POINTS):
    return {p: nearest_rank(values, p) for p in points}


def proposed_bands(cal, cut=BAND_CUT):
    """-> the preregistered band proposal, DERIVED from the envelope.

    [p5, p95] of each quantity — never a constant somebody copied. What
    finding codes these edges emit, and whether they join the mandatory
    regime, is the enforcement sitting's decision, not this function's.
    """
    syl = [r.syllables for r in cal.records]
    prom = [r.prominent for r in cal.records]
    lo, hi = cut
    return {
        "DENSITY": (nearest_rank(syl, lo), nearest_rank(syl, hi)),
        "PROMINENCE": (nearest_rank(prom, lo), nearest_rank(prom, hi)),
        "cut": cut,
        "population": len(cal.records),
    }


def concentration(cal, top=5):
    """-> [(path, measured_lines, share)] for the `top` largest contributors.
    Pooling is per line, so one prolific book CAN dominate; this names the
    books so the sensitivity check below is aimed, not vague."""
    c = Counter(r.path for r in cal.records)
    n = len(cal.records) or 1
    return [(p, k, k / n) for p, k in c.most_common(top)]


def sensitivity(cal, points=PERCENTILE_POINTS):
    """-> (dropped_path, tables) — the percentiles recomputed WITHOUT the
    single largest contributor (prediction P4). Reuses the sweep's records;
    no second pass, no second reading of the same corpus."""
    top = concentration(cal, top=1)
    if not top:
        raise CalibrationRefused("no records — nothing to drop")
    dropped = top[0][0]
    keep = [r for r in cal.records if r.path != dropped]
    return dropped, {
        "syllables": percentile_table([r.syllables for r in keep], points),
        "prominent": percentile_table([r.prominent for r in keep], points),
        "kept": len(keep),
    }


#: Amendment coordinates (METER_BANDS_PREREGISTRATION_AMENDMENT.md): a LOW
#: file's exclusion rate is at most this; the subset test is refused as too
#: thin unless LOW files keep at least this fraction of the measured lines.
AMENDMENT_MAX_FILE_EXCLUSION = 0.15
AMENDMENT_MIN_KEPT_FRACTION = 0.40
AMENDMENT_POINTS = (5, 50, 95)
AMENDMENT_TOLERANCE = 1


def per_file_exclusion(cal):
    """-> {path: (lyric, excluded, rate)} for every file in the sweep."""
    lyric = Counter(r.path for r in cal.records)
    for e in cal.excluded:
        lyric[e.path] += 0  # a file can be all-excluded; make the key exist
    exc = Counter(e.path for e in cal.excluded)
    out = {}
    for path in set(lyric) | set(exc):
        n = lyric.get(path, 0) + exc.get(path, 0)
        out[path] = (n, exc.get(path, 0), exc.get(path, 0) / n if n else 0.0)
    return out


def amendment(cal):
    """The registered subset test, run on the sweep's own records — the
    measurement does not move, only the aggregation.

    -> dict with the split, both envelopes at the registered points, the
    per-point deltas, and the VERDICT the adoption rule dictates. The
    meaningfulness floor refuses a too-thin subset rather than licensing
    from it (a licence issued by 12% of the data is not a licence)."""
    rates = per_file_exclusion(cal)
    low = {p for p, (_, _, r) in rates.items()
           if r <= AMENDMENT_MAX_FILE_EXCLUSION}
    keep = [r for r in cal.records if r.path in low]
    kept_fraction = len(keep) / len(cal.records) if cal.records else 0.0
    result = {
        "low_files": len(low), "high_files": len(rates) - len(low),
        "kept": len(keep), "kept_fraction": kept_fraction,
        "floor_met": kept_fraction >= AMENDMENT_MIN_KEPT_FRACTION,
        "rates": rates,
    }
    if not result["floor_met"]:
        result["verdict"] = ("REFUSED — LOW files keep "
                             f"{kept_fraction:.1%} of measured lines, under "
                             f"the {AMENDMENT_MIN_KEPT_FRACTION:.0%} floor; "
                             "too thin to license anything")
        result["adopted"] = False
        return result
    deltas, envelopes = {}, {}
    for name, get in (("syllables", lambda r: r.syllables),
                      ("prominent", lambda r: r.prominent)):
        pool = percentile_table([get(r) for r in cal.records],
                                AMENDMENT_POINTS)
        sub = percentile_table([get(r) for r in keep], AMENDMENT_POINTS)
        envelopes[name] = {"pool": pool, "subset": sub}
        deltas[name] = {p: sub[p] - pool[p] for p in AMENDMENT_POINTS}
    result["envelopes"] = envelopes
    result["deltas"] = deltas
    agreed = all(abs(d) <= AMENDMENT_TOLERANCE
                 for q in deltas.values() for d in q.values())
    result["adopted"] = agreed
    result["verdict"] = (
        "ADOPTED — the subset agrees within ±1 at every registered point, "
        "so the FULL-pool bands carry their robustness licence"
        if agreed else
        "NOT ADOPTED — the subset disagrees beyond ±1 at a registered "
        "point; the certain-line envelope is warped by what drops out")
    return result


def report_amendment(cal):
    """Print the amendment analysis — everything its RESULTS page quotes."""
    a = amendment(cal)
    print("AMENDMENT — is the certain-line envelope stable? "
          "(METER_BANDS_PREREGISTRATION_AMENDMENT.md)")
    print(f"  split at file exclusion <= {AMENDMENT_MAX_FILE_EXCLUSION:.0%}: "
          f"{a['low_files']} LOW file(s), {a['high_files']} HIGH")
    print(f"  LOW keeps {a['kept']} of {len(cal.records)} measured lines "
          f"({a['kept_fraction']:.1%}); floor "
          f"{AMENDMENT_MIN_KEPT_FRACTION:.0%} "
          f"{'MET' if a['floor_met'] else 'NOT MET'}")
    worst = sorted(a["rates"].items(), key=lambda kv: -kv[1][2])[:5]
    print("  highest per-file exclusion:")
    for path, (n, e, r) in worst:
        print(f"    {r:>7.2%}  {e:>6}/{n:<6}  {path}")
    named = ["corpus/song/eng_hall_thomas_durfey.txt",
             "corpus/song/eng_celtic_robert_burns.txt",
             "corpus/song/eng_hymn_watts.txt"]
    for path in named:
        if path in a["rates"]:
            n, e, r = a["rates"][path]
            side = "HIGH" if r > AMENDMENT_MAX_FILE_EXCLUSION else "LOW"
            print(f"  A1 names {path}: {r:.2%} -> {side}")
    if "deltas" in a:
        print(f"  registered points p{AMENDMENT_POINTS}: pool vs LOW subset")
        for name in ("syllables", "prominent"):
            env, d = a["envelopes"][name], a["deltas"][name]
            row = ", ".join(
                f"p{p} {env['pool'][p]}->{env['subset'][p]} ({d[p]:+d})"
                for p in AMENDMENT_POINTS)
            print(f"    {name:>10}: {row}")
    print(f"  VERDICT: {a['verdict']}")
    return a


#: Reader-registration coordinates (METER_BANDS_PREREGISTRATION_READER.md).
READER_GATE_MAX_EXCLUSION = 0.25
READER_POINTS = (5, 50, 95)
READER_TOLERANCE = 1


def reader_trial(cal):
    """The registered CERTAIN-vs-DERIVED trial, per quantity.

    -> dict with the hard gate, the disjoint split, both envelopes at the
    registered points, deltas, and INDEPENDENT verdicts for DENSITY and
    PROMINENCE. Partial adoption is a declared outcome. Refuses a sweep
    with no derived lines — a trial with an empty dock proves nothing."""
    out = {"exclusion": cal.excluded_fraction,
           "gate_met": cal.excluded_fraction <= READER_GATE_MAX_EXCLUSION}
    if not out["gate_met"]:
        out["verdicts"] = {}
        out["adopted"] = {}
        out["verdict"] = (f"STOPPED AT THE GATE — exclusion "
                          f"{cal.excluded_fraction:.2%} exceeds the "
                          f"{READER_GATE_MAX_EXCLUSION:.0%} ceiling; the "
                          f"reader did not restore the population and "
                          f"nothing is adopted")
        return out
    certain = [r for r in cal.records if r.derived == 0]
    derived = [r for r in cal.records if r.derived >= 1]
    out["certain"], out["derived"] = len(certain), len(derived)
    if not derived:
        raise CalibrationRefused(
            "the reader trial needs derived lines to try — this sweep has "
            "none (was it run with the default reader?)")
    out["verdicts"], out["adopted"], out["tables"] = {}, {}, {}
    pool_bands = proposed_bands(cal)
    for band_name, get in (("DENSITY", lambda r: r.syllables),
                           ("PROMINENCE", lambda r: r.prominent)):
        c = percentile_table([get(r) for r in certain], READER_POINTS)
        d = percentile_table([get(r) for r in derived], READER_POINTS)
        deltas = {p: d[p] - c[p] for p in READER_POINTS}
        agreed = all(abs(v) <= READER_TOLERANCE for v in deltas.values())
        out["tables"][band_name] = {"certain": c, "derived": d,
                                    "deltas": deltas}
        out["verdicts"][band_name] = agreed
        out["adopted"][band_name] = pool_bands[band_name] if agreed else None
    n_adopted = sum(1 for v in out["verdicts"].values() if v)
    out["verdict"] = {
        2: "ADOPTED, BOTH — certain and derived lines are one population "
           "at every registered point; the full-pool bands carry",
        1: "PARTIAL — the quantity that agreed adopts, the one that "
           "disagreed refuses and waits for a better reader (the declared "
           "partial outcome, not a failure mode)",
        0: "NOT ADOPTED — the derived lines are a different population "
           "under this reader; the next step is the other fork, "
           "registered, not a fourth reading of this one",
    }[n_adopted]
    return out


def report_reader_trial(cal):
    """Print the reader trial — everything RESULTS_METER_BANDS_READER.md
    quotes."""
    t = reader_trial(cal)
    print("READER TRIAL — certain vs derived "
          "(METER_BANDS_PREREGISTRATION_READER.md)")
    print(f"  hard gate: exclusion {t['exclusion']:.2%} vs ceiling "
          f"{READER_GATE_MAX_EXCLUSION:.0%} — "
          f"{'MET' if t['gate_met'] else 'NOT MET'}")
    if t["gate_met"]:
        print(f"  the split: {t['certain']} CERTAIN line(s) (derived=0), "
              f"{t['derived']} DERIVED (>=1 non-dictionary token)")
        for name in ("DENSITY", "PROMINENCE"):
            tab = t["tables"][name]
            row = ", ".join(
                f"p{p} {tab['certain'][p]} vs {tab['derived'][p]} "
                f"({tab['deltas'][p]:+d})" for p in READER_POINTS)
            print(f"  {name:>10}: {row} -> "
                  f"{'agree' if t['verdicts'][name] else 'DISAGREE'}")
            if t["adopted"][name]:
                print(f"  {'':>10}  ADOPTS pool band "
                      f"[{t['adopted'][name][0]}, {t['adopted'][name][1]}]")
    print(f"  VERDICT: {t['verdict']}")
    return t


def report(cal):
    """Print the whole result — everything RESULTS_METER_BANDS.md quotes."""
    print("METER BANDS CALIBRATION — corpus/song/eng_*.txt")
    print(f"  files {cal.files}, raw lines {cal.raw_lines}, "
          f"lyric lines {cal.lyric_lines}")
    print(f"  measured {len(cal.records)}, excluded {len(cal.excluded)} "
          f"({cal.excluded_fraction:.2%})")
    for cause, n in sorted(cal.exclusion_causes.items()):
        print(f"    excluded by {cause}: {n}")
    syl = [r.syllables for r in cal.records]
    prom = [r.prominent for r in cal.records]
    print("  percentiles (nearest rank):")
    print(f"    {'p':>4} {'syllables':>10} {'prominent':>10}")
    tsyl, tprom = percentile_table(syl), percentile_table(prom)
    for p in PERCENTILE_POINTS:
        print(f"    {p:>4} {tsyl[p]:>10} {tprom[p]:>10}")
    print("  top contributors (measured lines):")
    for path, n, share in concentration(cal):
        print(f"    {share:>6.2%}  {n:>6}  {path}")
    dropped, sens = sensitivity(cal)
    print(f"  sensitivity — without {dropped} ({sens['kept']} lines kept):")
    print(f"    {'p':>4} {'syllables':>10} {'prominent':>10}")
    for p in PERCENTILE_POINTS:
        print(f"    {p:>4} {sens['syllables'][p]:>10} "
              f"{sens['prominent'][p]:>10}")
    bands = proposed_bands(cal)
    print(f"  PROPOSED (cut p{bands['cut'][0]}-p{bands['cut'][1]}, "
          f"derived, not copied):")
    print(f"    DENSITY band    [{bands['DENSITY'][0]}, "
          f"{bands['DENSITY'][1]}] syllables/line")
    print(f"    PROMINENCE band [{bands['PROMINENCE'][0]}, "
          f"{bands['PROMINENCE'][1]}] prominent/line")
    flag = ("" if cal.reader_mode == "default"
            else f" --reader={cal.reader_mode}")
    print(f"  REPRODUCE: python3 quality/meter_bands.py{flag}   (from the "
          f"harness root)")


if __name__ == "__main__":
    import sys
    sys.path.insert(0, ROOT)
    sys.path.insert(0, os.path.dirname(ROOT))
    mode = "default"
    for a in sys.argv[1:]:
        if a.startswith("--reader="):
            mode = a.split("=", 1)[1]
        elif a != "--amendment":
            raise SystemExit(f"unknown flag {a!r}; declared: "
                             f"--reader={'|'.join(READER_MODES)}, "
                             f"--amendment")
    cal = measure_corpus(reader_mode=mode)
    if mode != "default":
        print(f"READER: {mode} (METER_BANDS_PREREGISTRATION_READER.md)")
    report(cal)
    if "--amendment" in sys.argv[1:]:
        print()
        report_amendment(cal)
    if mode != "default":
        print()
        report_reader_trial(cal)
