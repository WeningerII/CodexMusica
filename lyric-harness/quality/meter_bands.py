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
    """One measured line: where it came from and what it asks for."""
    path: str
    lineno: int
    syllables: int
    prominent: int


@dataclass(frozen=True)
class ExcludedLine:
    """One line the envelope refuses to count, and every reason why."""
    path: str
    lineno: int
    causes: tuple


@dataclass
class Calibration:
    """The whole sweep: what was read, what was measured, what was refused."""
    files: int = 0
    raw_lines: int = 0
    lyric_lines: int = 0
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


def measure_line(text):
    """-> (syllables, prominent, causes). Empty causes means MEASURED.

    Causes, when present, name why the line is excluded from the envelope:
    the refused tokens' own causes (NUMERAL, OUT_OF_LEXICON), ZERO_UNITS for
    a line that tokenised to nothing, PROMINENCE_UNDECIDED if any unit's
    prominence resolved to None — a guess in any of these is a hidden
    coordinate, so the line is counted OUT, never counted wrong.
    """
    import quality.fit as FT
    lu = FT.read_line(text)
    causes = sorted({r.cause for r in lu.refused})
    if not lu.units and not causes:
        causes = ["ZERO_UNITS"]
    if any(u.prominence is None for u in lu.units):
        causes.append("PROMINENCE_UNDECIDED")
    return lu.syllables, len(lu.prominent), tuple(causes)


def measure_corpus(root=None, corpus_glob=None):
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
    cal = Calibration(files=len(paths))
    for p in paths:
        with open(p, encoding="utf-8") as fh:
            cal.raw_lines += sum(1 for _ in fh)
        rel = os.path.relpath(p, root or ROOT)
        for lineno, text in lyric_lines(p):
            cal.lyric_lines += 1
            syl, prom, causes = measure_line(text)
            if causes:
                cal.excluded.append(ExcludedLine(rel, lineno, causes))
                continue
            if not (0 <= prom <= syl):
                raise CalibrationRefused(
                    f"{rel}:{lineno}: prominent {prom} outside [0, {syl}] — "
                    f"the reader is broken and every number above it is void "
                    f"(prediction P2)")
            cal.records.append(LineRecord(rel, lineno, syl, prom))
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
    print("  REPRODUCE: python3 quality/meter_bands.py   (from the harness "
          "root)")


if __name__ == "__main__":
    import sys
    sys.path.insert(0, ROOT)
    sys.path.insert(0, os.path.dirname(ROOT))
    report(measure_corpus())
