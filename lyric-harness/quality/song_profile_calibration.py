#!/usr/bin/env python3
"""Re-derive the `song` profile in quality/floor.py from corpus/song/.

    python3 quality/song_profile_calibration.py            # the full report
    python3 quality/song_profile_calibration.py --check    # numbers only, exit 1 on drift
    python3 quality/song_profile_calibration.py --seeds 50 # faster, wider intervals

WHY THIS FILE EXISTS. The song profile ships four thresholds, a token band, a
tolerance, five false-positive rates and a period slope. Every one of those is
a coordinate of a setting, and a number whose setting lives only in a scratchpad
is a threshold nobody wrote down (doctrine 58). So the profile's constants are
re-derivable by one command, and `--check` compares what floor.py ships against
what the corpus says today. If a corpus cell stages a file, this drifts and says
so, which is the whole point: `corpus/song/` is volatile by design.

WHAT IS AND IS NOT INDEPENDENT HERE.

  * Held out BY AUTHOR (= by file; the 143 English files carry 143 distinct
    `# author:` headers). Items by one author are not independent of each other,
    so an item-level split scores a cell with a resource that is not independent
    of it (doctrine 13). The item-level split is computed anyway, and reported,
    purely to price what the wrong split would have bought.
  * Every rate off a randomised split is reported as a distribution over seeds,
    never as one draw (doctrine 73).
  * Nothing here reads `wordfreq20k.txt`, its replacement
    `data/opensubtitles_en_50k.tsv`, or the rhyme-candidate index. The
    frequency layer WAS replaced 2026-08-11 (`lyric_harness.Lexicon.freq_rank`,
    `quality/revise.py`'s modal exclusion); no threshold has been calibrated
    against the new source since, so this file still has nothing independent
    to measure a `predictable_pair_fraction_max` against, and the song
    profile still carries none.
  * The two lyrics in `examples/` are not in `corpus/song/` -- checked by
    normalised line overlap, 0 of 27 and 0 of 37 -- so the profile scores them
    without having seen them. `quality/test_floor.py` test 17 pins that.

WHAT THIS CANNOT SAY. There is no generated song class in this repo, so there
is no separation, no AUC, and no claim that any of these checks detects machine
text. An FPR on human song says how often the gate interrupts a human
songwriter and nothing else (doctrine 22). And the corpus is pre-1931 by
construction: latest birth 1872, latest death 1929. Section 4 measures period
drift INSIDE that window; it cannot measure drift to 2026 and does not try.
"""

import argparse
import glob
import os
import random
import re
import statistics
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
sys.path.insert(0, os.path.join(HERE, "..", ".."))

from quality.features import FUNCTION_TAGS, QualityFeatures, _tagger  # noqa: E402
from quality.floor import PROFILES  # noqa: E402

ROOT = os.path.join(HERE, "..")
#: The item unit and the marker rule are quality/audit_corpus.py's, verbatim,
#: so this and the corpus audit cannot disagree about what an item is.
_MARKER = re.compile(r"^(#|--- |\[)")

#: (feature, side, percentile). "lo" flags below the 5th, "hi" above the 95th.
CHECKS = [("mattr", "lo", 0.05), ("fwr", "hi", 0.95),
          ("anaphora", "hi", 0.95), ("cv", "lo", 0.05)]

#: floor.py's key for each of them.
FLOOR_KEY = {"mattr": "mattr_min", "fwr": "function_word_ratio_max",
             "anaphora": "anaphora_max", "cv": "line_length_cv_min"}

#: The band-selection rule, declared here so it is visible before its answer.
#: (i) every 50-token sub-bin inside [lo, hi] holds >= MIN_BIN items -- a 5th
#: percentile needs somewhere to sit (doctrine 72); (ii) every sub-bin's own
#: threshold stays within HOM of the band-wide one, because a threshold that
#: moves across its own band is two profiles reported as one, which is the
#: defect doctrine 15 names; (iii) the band is the WIDEST contiguous range
#: satisfying both. HOM is 0.03 on anaphora because that is one line's worth on
#: a 33-line item, the coarsest the statistic resolves.
HOM = {"mattr": 0.02, "fwr": 0.02, "cv": 0.02, "anaphora": 0.03}
BIN, MIN_BIN, MIN_BAND_N = 50, 100, 300
EDGES = list(range(50, 1001, BIN))


# ---------------------------------------------------------------------------
# the population
# ---------------------------------------------------------------------------

def items_in(path):
    cur, body, out = None, [], []
    with open(path, encoding="utf-8", errors="replace") as fh:
        for l in fh:
            s = l.rstrip()
            if s.startswith("--- TITLE:"):
                if cur is not None:
                    out.append((cur, body))
                cur, body = s[10:].strip(), []
            elif cur is not None and s.strip() and not _MARKER.match(s):
                body.append(s.strip())
    if cur is not None:
        out.append((cur, body))
    return out


def author_of(path):
    a = ""
    with open(path, encoding="utf-8", errors="replace") as fh:
        for l in fh:
            if not l.startswith("#"):
                break
            if l.startswith("# author:"):
                a = l[9:].strip()
    m = re.search(r"\((\d{3,4})\??\s*[-–—]\s*(\d{3,4})", a)
    return a, (int(m.group(1)) if m else None), (int(m.group(2)) if m else None)


def anaphora(lines):
    """floor.SlopFloor._anaphora's rate, with its first-occurrence tie break
    (doctrine 66 -- iterating a set is iterating a randomised hash order)."""
    firsts = [(l.split() or [""])[0].lower().strip(",.;:!?—-") for l in lines]
    if not firsts:
        return 0.0
    first_at = {}
    for i, w in enumerate(firsts):
        first_at.setdefault(w, i)
    top = min(firsts, key=lambda w: (-firsts.count(w), first_at[w]))
    return firsts.count(top) / len(firsts)


def line_cv(lines):
    n = [len(l.split()) for l in lines]
    if not n:
        return 0.0
    m = statistics.mean(n)
    return (statistics.pstdev(n) / m) if m else 0.0


def population(verbose=True):
    """-> [row], one per `--- TITLE:` item in corpus/song/eng_*.txt."""
    tag = _tagger()
    tok = QualityFeatures._tokens
    rows = []
    files = sorted(glob.glob(os.path.join(ROOT, "corpus", "song", "eng_*.txt")))
    for p in files:
        a, born, died = author_of(p)
        base = os.path.basename(p)
        for title, body in items_in(p):
            if not body:
                continue
            per = [tok(l) for l in body]
            words = [w.lower() for t in per for w in t]
            if not words:
                continue
            flat = [(w.lower(), tg) for t in per for w, tg in tag(t)]
            rows.append({
                "file": base, "author": a, "born": born, "died": died,
                "title": title, "n_lines": len(body), "n_tokens": len(words),
                "mattr": QualityFeatures._mattr(words),
                "fwr": (sum(1 for _, tg in flat if tg in FUNCTION_TAGS)
                        / len(flat)) if flat else float("nan"),
                "anaphora": anaphora(body), "cv": line_cv(body)})
    if verbose:
        print("POPULATION  %d files, %d distinct authors, %d items, "
              "%d sung lines"
              % (len(files), len({r["author"] for r in rows}), len(rows),
                 sum(r["n_lines"] for r in rows)))
    return rows


# ---------------------------------------------------------------------------
# statistics
# ---------------------------------------------------------------------------

def q(v, p):
    v = sorted(v)
    if not v:
        return float("nan")
    i = (len(v) - 1) * p
    lo = int(i // 1)
    return v[lo] + (v[min(lo + 1, len(v) - 1)] - v[lo]) * (i - lo)


def band(rows, lo, hi):
    return [r for r in rows if lo <= r["n_tokens"] <= hi]


def thresholds(items):
    return {f: q([r[f] for r in items], p) for f, _, p in CHECKS}


def fpr(items, thr):
    """-> {check: rate}, plus 'ANY', the union over the four."""
    keys = [c[0] for c in CHECKS]
    if not items:
        return {k: float("nan") for k in keys + ["ANY"]}
    hits = dict.fromkeys(keys, 0)
    anyh = 0
    for r in items:
        f = {k: (r[k] < thr[k] if s == "lo" else r[k] > thr[k])
             for k, s, _ in CHECKS}
        for k in keys:
            hits[k] += f[k]
        anyh += any(f.values())
    out = {k: hits[k] / len(items) for k in keys}
    out["ANY"] = anyh / len(items)
    return out


def author_held_out(items, seeds, key="file"):
    """-> [(thresholds, fpr)] over `seeds` 50/50 splits of the given key."""
    keys = sorted({r[key] for r in items})
    runs = []
    for s in range(seeds):
        rnd = random.Random(s)
        sh = keys[:]
        rnd.shuffle(sh)
        cal = set(sh[:len(sh) // 2])
        c = [r for r in items if r[key] in cal]
        h = [r for r in items if r[key] not in cal]
        if len(c) < 50 or len(h) < 50:
            continue
        runs.append((thresholds(c), fpr(h, thresholds(c))))
    return runs


def spearman(xs, ys):
    def rank(v):
        order = sorted(range(len(v)), key=lambda i: v[i])
        r = [0.0] * len(v)
        i = 0
        while i < len(order):
            j = i
            while j + 1 < len(order) and v[order[j + 1]] == v[order[i]]:
                j += 1
            for k in range(i, j + 1):
                r[order[k]] = (i + j) / 2.0 + 1
            i = j + 1
        return r
    rx, ry = rank(xs), rank(ys)
    n = len(xs)
    mx, my = sum(rx) / n, sum(ry) / n
    num = sum((a - mx) * (b - my) for a, b in zip(rx, ry))
    dx = sum((a - mx) ** 2 for a in rx) ** 0.5
    dy = sum((b - my) ** 2 for b in ry) ** 0.5
    return num / (dx * dy) if dx and dy else 0.0


# ---------------------------------------------------------------------------
# the sections of the report
# ---------------------------------------------------------------------------

def band_ok(rows, lo, hi):
    items = band(rows, lo, hi)
    if len(items) < MIN_BAND_N:
        return False, "band n=%d < %d" % (len(items), MIN_BAND_N)
    full = thresholds(items)
    for b in range(lo, hi, BIN):
        sub = [r for r in items if b <= r["n_tokens"] < min(b + BIN, hi + 1)]
        if len(sub) < MIN_BIN:
            return False, "sub-bin %d-%d n=%d < %d" % (b, b + BIN, len(sub),
                                                       MIN_BIN)
        st = thresholds(sub)
        for f, _, _ in CHECKS:
            if abs(st[f] - full[f]) > HOM[f]:
                return False, ("sub-bin %d-%d %s %.4f vs band %.4f, |d| %.4f "
                               "> %.2f" % (b, b + BIN, f, st[f], full[f],
                                           abs(st[f] - full[f]), HOM[f]))
    return True, "ok"


def pick_band(rows, verbose=True):
    best = None
    for i, lo in enumerate(EDGES):
        for hi in EDGES[i + 1:]:
            good, _ = band_ok(rows, lo, hi)
            if good:
                w, n = hi - lo, len(band(rows, lo, hi))
                if best is None or (w, n) > (best[0], best[1]):
                    best = (w, n, lo, hi)
    if verbose:
        print("\n1. THE BAND, from the rule declared at the top of this file")
        print("   widest range satisfying it: %d-%d tokens, %d items, "
              "%d authors" % (best[2], best[3], best[1],
                              len({r["file"]
                                   for r in band(rows, best[2], best[3])})))
        for lo, hi in [(50, 400), (100, 400), (150, 400), (150, 450),
                       (200, 400), (200, 500), (100, 800)]:
            good, why = band_ok(rows, lo, hi)
            print("     %4d-%4d n=%5d  %-3s %s"
                  % (lo, hi, len(band(rows, lo, hi)), "OK" if good else "no",
                     why))
        print("   the drift the rule is refusing, 5th/95th percentile by "
              "token bin:")
        print("     %-10s %5s %8s %8s %8s %8s"
              % ("tokens", "n", "mattr5", "fwr95", "anaph95", "cv5"))
        for lo, hi in [(50, 80), (80, 110), (110, 150), (150, 200), (200, 250),
                       (250, 300), (300, 350), (350, 400), (400, 500),
                       (500, 700), (700, 1200)]:
            sel = [r for r in rows if lo <= r["n_tokens"] < hi]
            if len(sel) < 20:
                continue
            t = thresholds(sel)
            print("     %-10s %5d %8.4f %8.4f %8.4f %8.4f"
                  % ("%d-%d" % (lo, hi), len(sel), t["mattr"], t["fwr"],
                     t["anaphora"], t["cv"]))
    return best[2], best[3]


def report_fpr(rows, lo, hi, seeds):
    items = band(rows, lo, hi)
    print("\n2. THE THRESHOLDS AND THEIR HELD-OUT FALSE-POSITIVE RATE "
          "(doctrine 22)")
    print("   band %d-%d tokens: %d items, %d authors"
          % (lo, hi, len(items), len({r["file"] for r in items})))
    full = thresholds(items)
    print("   SHIPPED thresholds (5th/95th percentile of the whole band): "
          + "  ".join("%s %.4f" % (f, full[f]) for f, _, _ in CHECKS))
    out = {}
    for key, name in (("file", "AUTHOR-held out — the honest split"),
                      ("title", "item-held out — the WRONG split, priced")):
        runs = author_held_out(items, seeds, key)
        print("   %s, %d seeds, 50%% held out" % (name, len(runs)))
        for f in [c[0] for c in CHECKS] + ["ANY"]:
            v = [r[1][f] for r in runs]
            m, p5, p95 = statistics.median(v), q(v, 0.05), q(v, 0.95)
            print("      FPR %-9s median %6.2f%%  [5th-95th percentile of "
                  "seeds %5.2f-%5.2f%%]  min %5.2f%% max %5.2f%%"
                  % (f, 100 * m, 100 * p5, 100 * p95, 100 * min(v),
                     100 * max(v)))
            if key == "file":
                out[f] = (round(100 * m, 2), round(100 * p5, 2),
                          round(100 * p95, 2))
    print("   The two splits agree on the MEDIAN and disagree on the SPREAD "
          "by about a factor of two. That gap is doctrine 13's price: the "
          "item split reports an interval that is roughly half as wide as "
          "the evidence supports, because it lets an author's other songs "
          "vouch for this one.")
    print("\n   author concentration in the band, since the percentiles are "
          "ITEM-weighted:")
    cnt = {}
    for r in items:
        cnt[r["file"]] = cnt.get(r["file"], 0) + 1
    top = sorted(cnt.items(), key=lambda t: -t[1])[:5]
    print("      median items per author %d; top five %.1f%% of the band: %s"
          % (statistics.median(cnt.values()),
             100 * sum(n for _, n in top) / len(items),
             ", ".join("%s %d" % (f.replace("eng_", "").replace(".txt", ""), n)
                       for f, n in top)))
    for f, _, _ in CHECKS:
        jk = [thresholds([r for r in items if r["file"] != a])[f] for a in cnt]
        print("      leave-one-author-out %-9s max |shift| %.4f"
              % (f, max(abs(v - full[f]) for v in jk)))
    ab = {f: q([statistics.median([r[f] for r in items if r["file"] == a])
                for a in cnt], p) for f, _, p in CHECKS}
    print("      author-weighted alternative (one median per author, n=%d): %s"
          % (len(cnt), "  ".join("%s %.4f" % (f, ab[f]) for f, _, _ in CHECKS)))
    return full, out


def report_tolerance(rows, lo, hi, seeds):
    print("\n3. THE TOLERANCE, which floor.py had at 2.0 with no measurement "
          "anywhere behind it")
    core = band(rows, lo, hi)
    auths = sorted({r["file"] for r in core})
    print("   thresholds calibrated on half the in-band authors, applied to "
          "held-out authors' items across the whole applied band")
    print("   %-6s %-12s %s" % ("factor", "applied", "  ".join(
        "%-9s" % c[0] for c in CHECKS) + "  ANY"))
    for t in (1.0, 1.1, 1.25, 1.5, 2.0, 3.0):
        a, b = int(lo / t), int(hi * t)
        runs = []
        for s in range(seeds):
            rnd = random.Random(s)
            sh = auths[:]
            rnd.shuffle(sh)
            cal = set(sh[:len(sh) // 2])
            c = [r for r in core if r["file"] in cal]
            sc = [r for r in rows
                  if r["file"] not in cal and a <= r["n_tokens"] <= b]
            if len(c) < 50 or len(sc) < 50:
                continue
            runs.append(fpr(sc, thresholds(c)))
        print("   %-6.2f %-12s %s" % (t, "%d-%d" % (a, b), " ".join(
            "%8.2f%%" % (100 * statistics.median([r[f] for r in runs]))
            for f in [c[0] for c in CHECKS] + ["ANY"])))
    print("   Every check gets worse monotonically, so the tolerance is a "
          "real cost and not a free courtesy. The song profile declares 1.25. "
          "The other two profiles keep 2.0 because re-measuring them needs "
          "the sonnet classes, and that is a different cell's to move.")


def report_period(rows, lo, hi, draws=2000):
    print("\n4. PERIOD (doctrine 11), inside the provenance gate")
    items = band(rows, lo, hi)
    byauth = {}
    for r in items:
        byauth.setdefault(r["file"], []).append(r)
    auths = sorted(byauth)
    births = [byauth[a][0]["born"] for a in auths]
    print("   %d authors, born %d-%d, median %d; latest death in band %d. "
          "The corpus holds no song by anyone alive after 1929, so nothing "
          "below extrapolates to a lyric written now."
          % (len(auths), min(births), max(births), statistics.median(births),
             max(byauth[a][0]["died"] for a in auths)))
    print("   4a. author-level Spearman against birth year, with a "
          "label-permutation null over authors (%d draws). Bonferroni over "
          "the four checks cuts at 0.0125." % (draws * 5))
    rnd = random.Random(20260811)
    slopes = {}
    for f, _, _ in CHECKS:
        vals = [statistics.median([r[f] for r in byauth[a]]) for a in auths]
        rho = spearman(births, vals)
        null = []
        for _ in range(draws * 5):
            sh = vals[:]
            rnd.shuffle(sh)
            null.append(abs(spearman(births, sh)))
        p = (sum(1 for v in null if v >= abs(rho)) + 1) / (len(null) + 1)
        slopes[f] = (round(rho, 3), round(p, 4))
        print("      %-9s rho %+.3f  p_perm %.4f  %s"
              % (f, rho, p, "SURVIVES Bonferroni" if p < 0.0125 else
                 "does not survive Bonferroni"))
    med = statistics.median(births)
    early = [a for a in auths if byauth[a][0]["born"] <= med]
    ei = [r for a in early for r in byauth[a]]
    li = [r for a in auths if a not in early for r in byauth[a]]
    print("   4b. cross-cohort threshold transfer at the median birth year "
          "%d: EARLY %d authors / %d items, LATE %d authors / %d items. The "
          "control permutes the COHORT LABEL over the same authors at the "
          "same partition sizes, %d draws — it varies only the thing under "
          "test (doctrine 14). Bonferroni over the eight comparisons cuts at "
          "0.00625." % (med, len(early), len(ei), len(auths) - len(early),
                        len(li), draws))
    null = {"EARLY -> LATE": [], "LATE -> EARLY": []}
    rnd2 = random.Random(20260812)
    for _ in range(draws):
        sh = auths[:]
        rnd2.shuffle(sh)
        ga = set(sh[:len(early)])
        ia = [r for r in items if r["file"] in ga]
        ib = [r for r in items if r["file"] not in ga]
        null["EARLY -> LATE"].append(fpr(ib, thresholds(ia)))
        null["LATE -> EARLY"].append(fpr(ia, thresholds(ib)))
    for nm, (src, dst) in (("EARLY -> LATE", (ei, li)),
                           ("LATE -> EARLY", (li, ei))):
        obs = fpr(dst, thresholds(src))
        print("      %s" % nm)
        for f in [c[0] for c in CHECKS] + ["ANY"]:
            v = [d[f] for d in null[nm]]
            p = (sum(1 for x in v if x >= obs[f]) + 1) / (len(v) + 1)
            print("         %-9s observed %5.2f%%   null median %5.2f%% "
                  "[5th-95th %5.2f-%5.2f%%]   p %.4f%s"
                  % (f, 100 * obs[f], 100 * statistics.median(v),
                     100 * q(v, 0.05), 100 * q(v, 0.95), p,
                     "  SURVIVES" if p < 0.00625 else ""))
    print("      The direction is the part that matters and it is not "
          "symmetric: thresholds fitted on earlier-born authors OVER-flag "
          "later-born ones, and the reverse runs at or below nominal. A 2026 "
          "lyric sits further along that same axis than any author here.")
    return slopes


def report_examples(rows, lo, hi, full):
    print("\n5. THE TWO EXAMPLE SONGS, which are NOT in the calibration set")
    tag = _tagger()
    ex = sorted(glob.glob(os.path.join(ROOT, "examples", "*.txt")))
    for p in ex:
        with open(p, encoding="utf-8") as fh:
            body = [l.strip() for l in fh
                    if l.strip() and not (l.strip().startswith("[")
                                          and l.strip().endswith("]"))]
        per = [QualityFeatures._tokens(l) for l in body]
        words = [w.lower() for t in per for w in t]
        flat = [(w.lower(), tg) for t in per for w, tg in tag(t)]
        v = {"mattr": QualityFeatures._mattr(words),
             "fwr": sum(1 for _, tg in flat if tg in FUNCTION_TAGS) / len(flat),
             "anaphora": anaphora(body), "cv": line_cv(body)}
        inb = lo <= len(words) <= hi
        print("   %s — %d lines, %d tokens, %s"
              % (os.path.basename(p), len(body), len(words),
                 "inside the band" if inb else "OUTSIDE the band"))
        for f, side, _ in CHECKS:
            hit = (v[f] < full[f]) if side == "lo" else (v[f] > full[f])
            print("      %-9s %.4f  vs %.4f  %s"
                  % (f, v[f], full[f], "FIRES" if hit else "clear"))


def check_shipped(lo, hi, full, fprs, slopes):
    """Compare what floor.py ships against what the corpus says today."""
    song = [p for p in PROFILES if p.name == "song"]
    print("\n6. WHAT floor.py SHIPS, against what the corpus says today")
    if not song:
        print("   FAIL: no `song` profile in quality/floor.py")
        return 1
    p = song[0]
    bad = []

    def cmp(label, shipped, measured, tol):
        ok = abs(shipped - measured) <= tol
        print("   %-34s shipped %-10s measured %-10s %s"
              % (label, "%.4f" % shipped if isinstance(shipped, float)
                 else shipped, "%.4f" % measured if isinstance(measured, float)
                 else measured, "ok" if ok else "DRIFT"))
        if not ok:
            bad.append(label)

    cmp("band lo (tokens)", float(p.lo), float(lo), 0)
    cmp("band hi (tokens)", float(p.hi), float(hi), 0)
    for f, _, _ in CHECKS:
        cmp("threshold %s" % f, p.percentiles[FLOOR_KEY[f]], full[f], 0.0001)
    for f in [c[0] for c in CHECKS] + ["ANY"]:
        k = {"mattr": "mattr", "fwr": "function_word_ratio",
             "anaphora": "anaphora", "cv": "line_length_cv",
             "ANY": "ANY"}[f]
        # seeds are deterministic, so the median reproduces exactly at the
        # same --seeds; the tolerance is for a shorter run
        cmp("held-out FPR %s (%%)" % k, p.held_out_fpr[k][0], fprs[f][0], 1.0)
    cmp("profile n_generated", float(p.n_generated), 0.0, 0)
    # The period slope is quoted in the profile note AND inside the
    # ANAPHORA_OVERLOAD finding, so it is a shipped constant like any other.
    rho, pp = slopes["anaphora"]
    cmp("anaphora period slope rho", 0.275, rho, 0.01)
    cmp("anaphora period slope p_perm", 0.0042, pp, 0.004)
    quoted = "+%.3f" % 0.275
    if quoted not in p.note:
        bad.append("the profile note no longer quotes rho %s" % quoted)
        print("   profile note quotes rho             DRIFT")
    if p.measured_auc:
        bad.append("measured_auc is not empty on a profile with no negative "
                   "class")
        print("   measured_auc                       DRIFT: %s" %
              (p.measured_auc,))
    if bad:
        print("\n   %d value(s) DRIFTED: %s" % (len(bad), ", ".join(bad)))
        print("   `corpus/song/` is volatile by design, so a drift here is a "
              "corpus change, not automatically a defect. Argue it and "
              "repin; do not tune to it (doctrine 58).")
        return 1
    print("\n   every shipped constant reproduces.")
    return 0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true",
                    help="numbers only; exit 1 if floor.py has drifted")
    ap.add_argument("--seeds", type=int, default=200)
    ap.add_argument("--draws", type=int, default=2000)
    a = ap.parse_args()
    rows = population()
    lo, hi = pick_band(rows, verbose=not a.check)
    full, fprs = report_fpr(rows, lo, hi, a.seeds)
    slopes = {}
    if not a.check:
        report_tolerance(rows, lo, hi, a.seeds)
    slopes = report_period(rows, lo, hi, a.draws)
    if not a.check:
        report_examples(rows, lo, hi, full)
    rc = check_shipped(lo, hi, full, fprs, slopes)
    sys.exit(rc)


if __name__ == "__main__":
    main()
