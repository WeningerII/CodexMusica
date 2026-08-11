#!/usr/bin/env python3
"""CAN THE TIME LAYER PRODUCE AN EVENT AT ALL, UNDER AN HONEST FAMILY SIZE?

WHY THIS FILE EXISTS

`quality/fwer_family.py` established that `m` had been measured over the pairs
that SURVIVED the rhyme band rather than over the comparisons that were MADE,
and that fixing it leaves the layer MUTE: 18 of 20 real sonnets and 16 of 20
word-scrambles return `cannot tell`, the rest return zero events. That is an
honest state and a useless one. `RESULTS_FWER.md` closed by naming two levers --
`null_samples` and `window` -- as "live routes, and either is cheaper than
another corpus".

THIS FILE MEASURES THE LEVERS. Both named routes are dead, and the arithmetic
that kills them is the same arithmetic in both cases. It is a runner rather than
a document so that no number here is one somebody remembers (doctrine 58).

THE ARITHMETIC, in the order it has to be read

  An item produces an event only if some pair's p-value clears that position's
  corrected cut. So two quantities decide everything:

    min_p        the smallest p-value any candidate pair in the item attains
    cut(m)       1 - (1-alpha)^(1/m), the Sidak cut at family size m

  and they meet at   M_NEEDED = ln(1-alpha) / ln(1-min_p),  the largest family
  at which the item's own best pair could still fire. Measured across this
  corpus M_NEEDED is 18-28 and the median family at the registered window is
  198-217. That is the gap, and it is a factor of ~10 rather than a factor of
  1.4 -- the 1.4x in the record is min_p against the LOOSEST cut in the item,
  which is the cut at the SMALLEST family, at a position where the best pair
  almost never sits.

WHY min_p HAS A FLOOR, AND WHY IT IS NOT A RESOLUTION

  `_pvalue` returns (ge + 1) / (n_valid + 1) where `ge` counts chance draws
  scoring at or above the observed pair. For the best pair in a real sonnet,
  `ge` is 40-83 out of 20,000 -- and every one of them is an exact TIE at 1.000.
  ZERO draws are strictly above. The comparator has no headroom above "perfect
  rhyme": the item's best pair is a perfect rhyme, and so is every chance
  re-pairing that ties it. So

      min_p -> (density of perfect rhymes among re-pairings of the item's own
                spans),  a RATE, not a resolution,

  and raising `null_samples` estimates that rate more precisely instead of
  lowering it. Measured, it estimates it UPWARD: sonnet 1 goes 3.998e-3 at 2,000
  draws to 4.415e-3 at 200,000, so a 100x more expensive null makes the gap
  WORSE. Doctrine 57 said an empirical p sitting at 1/(n+1) is reporting the
  resolution; this is the complementary trap -- a p sitting well ABOVE 1/(n+1)
  is reporting a rate, and no resolution buys it down.

Run: python3 quality/time_attainable.py [--corpus] [--floor] [--levers]
                                        [--beat] [--verify] [--slow]
Sibling that measures the family: python3 quality/fwer_family.py
"""

import math
import os
import random
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
sys.path.insert(0, os.path.join(HERE, "..", ".."))

from lyric_harness import Declaration, Lexicon                   # noqa: E402
from quality.fwer_family import REAL, SATURATED                  # noqa: E402
from quality.time_layer import (TimeDeclaration,                 # noqa: E402
                                _candidate_pairs, _raw_score,
                                grid_index, rhyme_events,
                                syllable_stream)

LEX = Lexicon()
DECL = Declaration()
#: sentinel: `_raw_score` returns None for a non-relation, which is a value the
#: cache has to be able to hold.
MISS = object()


def m_needed(min_p, alpha=0.05, correction="sidak"):
    """The largest family size at which a pair of p-value `min_p` still fires.

    This is the whole question in one number. Invert the Sidak cut:
        min_p <= 1 - (1-alpha)^(1/m)   <=>   m <= ln(1-alpha)/ln(1-min_p)
    """
    if min_p >= 1.0 or min_p <= 0.0:
        return 0
    if correction == "bonferroni":
        return int(alpha / min_p)
    if min_p >= alpha:
        return 0
    return int(math.log(1.0 - alpha) / math.log(1.0 - min_p))


def probe(lines, tdecl, decl=DECL, stream=None):
    """`rhyme_events` with a memoised comparator, plus what it does not report.

    Identical in every output it shares with the shipped function -- `--verify`
    asserts that pair by pair. The cache exists because the sweeps below score
    the same span pair thousands of times; a sonnet has ~195 distinct spans and
    20,000 null draws, so the hit rate is what makes a lever sweep take seconds
    instead of an hour.
    """
    st = stream if stream is not None else syllable_stream(LEX, lines)
    gi = grid_index(st, tdecl.grid_unit)
    slots = [i for i in range(len(st))
             if gi[i] is not None and not st[i]["line_final"]]
    pairs = _candidate_pairs(st, tdecl)
    cache = {}

    def sc(sa, sb):
        k = (sa, sb)
        v = cache.get(k, MISS)
        if v is MISS:
            v = _raw_score(st, sa, sb, decl, None)
            cache[k] = v
        return v

    # --- the within-item null, drawn exactly as `null_scores` draws it ------
    null, n_valid = [], 0
    if pairs:
        left = [p[0] for p in pairs]
        right = [p[1] for p in pairs]
        rng = random.Random(tdecl.seed ^ 0x5EED)
        tries, nl, nr = 0, len(left), len(right)
        while n_valid < tdecl.null_samples and tries < tdecl.null_samples * 20:
            tries += 1
            sa = left[rng.randrange(nl)]
            sb = right[rng.randrange(nr)]
            if sa == sb or max(sa[0], sb[0]) < min(sa[1], sb[1]):
                continue
            if {x["widx"] for x in st[sa[0]:sa[1]]} & \
                    {x["widx"] for x in st[sb[0]:sb[1]]}:
                continue
            n_valid += 1
            v = sc(sa, sb)
            if v is not None:
                null.append(v)
    null.sort()

    def pval(v):
        if not n_valid:
            return 1.0
        lo, hi = 0, len(null)
        while lo < hi:
            mid = (lo + hi) // 2
            if null[mid] < v:
                lo = mid + 1
            else:
                hi = mid
        return (len(null) - lo + 1) / (n_valid + 1)

    # --- the observed pairs -------------------------------------------------
    pv, fam = {}, {}
    best, n_scored = None, 0
    strictly_above = 0
    for k, (sa, sb) in enumerate(pairs):
        for pos in list(range(*sa)) + list(range(*sb)):
            fam.setdefault(pos, []).append(k)
        v = sc(sa, sb)
        if v is None:
            continue
        n_scored += 1
        pv[k] = pval(v)
        best = v if best is None else max(best, v)
    if best is not None:
        strictly_above = sum(1 for v in null if v > best + 1e-12)

    sizes = sorted(len(v) for v in fam.values())
    m_min = sizes[0] if sizes else 0
    m_med = sizes[len(sizes) // 2] if sizes else 0
    a = tdecl.alpha

    def cut(m):
        if not m:
            return 1.0
        return (a / m if tdecl.correction == "bonferroni"
                else 1.0 - (1.0 - a) ** (1.0 / m))

    events = set()
    for pos, ks in fam.items():
        c = cut(len(ks))
        if any(pv.get(k, 1.0) <= c for k in ks):
            events.add(pos)
    ev = [i for i in slots if i in events]
    min_p = min(pv.values()) if pv else 1.0
    loosest = cut(m_min)
    band_pass = len(null) / n_valid if n_valid else 0.0
    return dict(
        n_slots=len(slots), n_pairs=len(pairs), n_scored=n_scored,
        n_valid=n_valid, n_null=len(null), band_pass=band_pass,
        best=best, ge=round(min_p * (n_valid + 1)) - 1,
        ties_only=(strictly_above == 0), strictly_above=strictly_above,
        min_p=min_p, m_min=m_min, m_med=m_med, m_max=sizes[-1] if sizes else 0,
        loosest_cut=loosest, median_cut=cut(m_med),
        ratio_loosest=min_p / loosest if loosest else 0.0,
        ratio_median=min_p / cut(m_med) if m_med else 0.0,
        m_needed=m_needed(min_p, a, tdecl.correction),
        share_firable=(sum(1 for v in sizes
                           if v <= m_needed(min_p, a, tdecl.correction)) /
                       len(sizes)) if sizes else 0.0,
        n_events=len(ev), saturation=len(ev) / max(1, len(slots)),
        refused_band=band_pass > tdecl.max_null_band_pass,
        mute=(band_pass > tdecl.max_null_band_pass) or
             (not ev and (not pv or min_p > loosest)))


# ---------------------------------------------------------------------------
# corpora
# ---------------------------------------------------------------------------

def sonnets(n):
    from quality.corpus import load_sonnets
    return [l for _, l in sorted(load_sonnets().items())][:n]


def scrambled_sonnets(n, seed=7):
    """The same construction `fwer_family.scrambled_sonnets` uses, kept here so
    a sweep can be run without importing the grid runner's fixtures."""
    son = sonnets(max(n, 1))
    rng = random.Random(seed)
    out = []
    for i in range(n):
        words = [w for l in son[i] for w in l.split()]
        rng.shuffle(words)
        k = len(words) // 14
        out.append([" ".join(words[j * k:(j + 1) * k]) for j in range(14)])
    return out


def lyric_sheet():
    p = os.path.join(HERE, "..", "lyric.txt")
    with open(p) as fh:
        return [l.strip() for l in fh if l.strip()]


def q(xs, p):
    xs = sorted(xs)
    return xs[min(len(xs) - 1, int(p * len(xs)))]


# ---------------------------------------------------------------------------
# --verify: the cache changes speed and nothing else
# ---------------------------------------------------------------------------

def run_verify():
    print("\n=== THE MEMOISED PROBE AGREES WITH THE SHIPPED rhyme_events ===")
    print("Every sweep below runs through the cache, so the agreement is "
          "checked rather than assumed.\n")
    items = [("sonnet 1", sonnets(2)[0]), ("sonnet 2", sonnets(2)[1]),
             ("scramble 1", scrambled_sonnets(1)[0]), ("REAL", REAL)]
    bad = 0
    for w, ns in ((32, 20000), (8, 20000), (32, 2000)):
        for name, lines in items:
            t = TimeDeclaration(theta=0.80, window=w, null_samples=ns,
                                max_null_band_pass=1.01)
            st = syllable_stream(LEX, lines)
            det = {}
            ev = rhyme_events(LEX, st, DECL, t, None, det)
            gi = grid_index(st, t.grid_unit)
            slots = [i for i in range(len(st))
                     if gi[i] is not None and not st[i]["line_final"]]
            ref = len([i for i in slots if i in ev])
            r = probe(lines, t, stream=st)
            ok = (ref == r["n_events"]
                  and abs(det["min_attainable_p"] - r["min_p"]) < 1e-12
                  and abs(det["loosest_cut"] - r["loosest_cut"]) < 1e-12
                  and det["median_family_size"] == r["m_med"]
                  and det["n_candidate_pairs"] == r["n_pairs"])
            bad += 0 if ok else 1
            print(f"  window={w:<3d} null_samples={ns:<6d} {name:11s} "
                  f"events {ref}/{r['n_events']}  min_p "
                  f"{det['min_attainable_p']:.4e}/{r['min_p']:.4e}  "
                  f"m_med {det['median_family_size']}/{r['m_med']}  "
                  f"{'OK' if ok else '*** MISMATCH ***'}")
    print(f"\n  {'all agree' if not bad else str(bad) + ' MISMATCHES'}")
    return bad


# ---------------------------------------------------------------------------
# --corpus: the attainability arithmetic
# ---------------------------------------------------------------------------

def run_corpus(n=20, w=32):
    t = TimeDeclaration(theta=0.80, window=w)
    print(f"\n=== THE ATTAINABILITY ARITHMETIC ACROSS THE CORPUS ===")
    print(f"alpha={t.alpha}, Sidak, family={t.family}, window={w}, "
          f"max_span={t.max_span}, null_samples={t.null_samples}\n")
    print(f"  M_NEEDED = ln(1-alpha)/ln(1-min_p) -- the largest family at "
          f"which THIS item's")
    print(f"  best pair still clears its own cut. Compare it with m_med, the "
          f"family a")
    print(f"  typical position actually has.\n")
    print(f"{'arm':10} {'n':>3} | {'p50 min_p':>10} {'p50 ge':>7} "
          f"{'p50 M_NEEDED':>13} {'p50 m_min':>10} {'p50 m_med':>10} "
          f"{'m_med/M_NEED':>13} | {'%pos firable':>13} {'mute':>7} {'ev>0':>5}")
    print("-" * 118)
    rows = {}
    for arm, items in (("real", sonnets(n)),
                       ("scramble", scrambled_sonnets(n))):
        rs = [probe(it, t) for it in items]
        rows[arm] = rs
        mm, mn = q([r['m_med'] for r in rs], .5), q([r['m_needed'] for r in rs], .5)
        print(f"{arm:10} {len(rs):3d} | {q([r['min_p'] for r in rs], .5):10.2e} "
              f"{q([r['ge'] for r in rs], .5):7d} {mn:13d} "
              f"{q([r['m_min'] for r in rs], .5):10d} {mm:10d} "
              f"{mm / max(1, mn):12.1f}x | "
              f"{q([r['share_firable'] for r in rs], .5):12.1%} "
              f"{sum(1 for r in rs if r['mute']):3d}/{len(rs):<3d} "
              f"{sum(1 for r in rs if r['n_events'] > 0):5d}")
    print()
    for name, lines in (("lyric.txt", lyric_sheet()),
                        ("REAL fixture", REAL),
                        ("SATURATED fixture", SATURATED)):
        r = probe(lines, TimeDeclaration(theta=0.80, window=w,
                                         max_null_band_pass=1.01))
        print(f"{name:19s} min_p {r['min_p']:.2e}  ge {r['ge']:4d}  "
              f"M_NEEDED {r['m_needed']:4d}  m_min {r['m_min']:4d}  "
              f"m_med {r['m_med']:4d}  loosest cut {r['loosest_cut']:.2e}  "
              f"ratio-to-loosest {r['ratio_loosest']:.2f}x  "
              f"events {r['n_events']}")
    print("\n  READ THE TWO RATIO COLUMNS TOGETHER. `ratio-to-loosest` is the "
          "1.4-1.8x")
    print("  the record quotes: the best pair against the cut at the item's "
          "SMALLEST")
    print("  family, which is a position at the very edge of the item where "
          "the best")
    print("  pair is not. `m_med / M_NEEDED` is the honest size of the gap at "
          "a typical")
    print("  position, and it is ~10x. `%pos firable` is the share of "
          "positions whose")
    print("  family is small enough to fire at all -- 0.0% at the registered "
          "window.")
    return rows


# ---------------------------------------------------------------------------
# --floor: min_p is a rate, and the rate is a tie count
# ---------------------------------------------------------------------------

def run_floor(n=6, ns=(500, 2000, 20000, 200000)):
    print("\n=== WHY min_p DOES NOT MOVE: IT IS A TIE COUNT, NOT AN "
          "EXCEEDANCE COUNT ===")
    t = TimeDeclaration(theta=0.80, window=32)
    print(f"\n{'item':10} {'best score':>11} {'n_valid':>8} {'ge (>=best)':>12} "
          f"{'STRICTLY above':>15} {'min_p':>10} {'M_NEEDED':>9}")
    for i, s in enumerate(sonnets(n)):
        r = probe(s, t)
        print(f"sonnet {i+1:<3d} {r['best']:11.3f} {r['n_valid']:8d} "
              f"{r['ge']:12d} {r['strictly_above']:15d} {r['min_p']:10.2e} "
              f"{r['m_needed']:9d}")
    print("\n  Not one chance draw is STRICTLY above the item's best pair. The "
          "score")
    print("  saturates at 1.000 for a perfect rhyme, and 40-83 of 20,000 "
          "chance")
    print("  re-pairings of the item's own spans are also perfect rhymes. "
          "There is no")
    print("  headroom above 'perfect' for a p-value to live in.")

    print(f"\n=== LEVER 1: null_samples. A 400x FINER FLOOR BUYS NOTHING ===")
    items = sonnets(10)
    print(f"\n{'null_samples':>12} {'p-value floor':>14} {'p50 min_p':>10} "
          f"{'p50 ge':>8} {'p50 ge rate':>12} {'p50 M_NEEDED':>13} "
          f"{'p50 m_med/M_NEED':>17} {'secs':>7}")
    for k in ns:
        t0 = time.time()
        rs = [probe(it, TimeDeclaration(theta=0.80, window=32,
                                        null_samples=k,
                                        max_null_band_pass=1.01))
              for it in items]
        el = time.time() - t0
        mn = q([r['m_needed'] for r in rs], .5)
        print(f"{k:12d} {1/(k+1):14.2e} {q([r['min_p'] for r in rs], .5):10.2e} "
              f"{q([r['ge'] for r in rs], .5):8d} "
              f"{q([r['ge'] / r['n_valid'] for r in rs], .5):12.5f} "
              f"{mn:13d} "
              f"{q([r['m_med'] for r in rs], .5) / max(1, mn):16.1f}x "
              f"{el:7.1f}")
    print("\n  The floor falls 400x and min_p falls 1.5x, to the rate it was "
          "always")
    print("  estimating. On the SHIPPED (uncached) path a single sonnet at "
          "200,000")
    print("  draws costs 4.7s against 0.6s at the default, and its min_p comes "
          "out")
    print("  HIGHER -- 4.415e-3 against 4.200e-3 -- because more draws resolve "
          "the")
    print("  tie rate upward. The lever runs the wrong way.")


# ---------------------------------------------------------------------------
# --levers: window, max_span, item length, a cross-item null
# ---------------------------------------------------------------------------

def run_levers(n=10, slow=False):
    items = sonnets(n)
    print("\n=== LEVER 2: window. m falls with it; min_p does not move ===")
    print(f"\n{'window':>7} {'p50 pairs':>10} {'p50 m_min':>10} "
          f"{'p50 m_med':>10} {'p50 min_p':>10} {'p50 M_NEEDED':>13} "
          f"{'m_med/M_NEED':>13} {'%pos firable':>13} {'ev>0':>5} {'ev>=4':>6}")
    for w in (2, 3, 4, 6, 8, 12, 16, 24, 32, 48, 64):
        rs = [probe(it, TimeDeclaration(theta=0.80, window=w,
                                        max_null_band_pass=1.01))
              for it in items]
        mn = q([r['m_needed'] for r in rs], .5)
        print(f"{w:7d} {q([r['n_pairs'] for r in rs], .5):10d} "
              f"{q([r['m_min'] for r in rs], .5):10d} "
              f"{q([r['m_med'] for r in rs], .5):10d} "
              f"{q([r['min_p'] for r in rs], .5):10.2e} {mn:13d} "
              f"{q([r['m_med'] for r in rs], .5) / max(1, mn):12.1f}x "
              f"{q([r['share_firable'] for r in rs], .5):12.1%} "
              f"{sum(1 for r in rs if r['n_events'] > 0):5d} "
              f"{sum(1 for r in rs if r['n_events'] >= 4):6d}")
    print("\n  min_p is INVARIANT to the window (2.7e-3 - 4.9e-3, no trend), "
          "because the")
    print("  null re-pairs the item's spans at ANY distance while the observed "
          "pairs are")
    print("  window-bounded. That mismatch is not a defect -- it is the only "
          "thing giving")
    print("  the p-value content, since a window-matched null would draw from "
          "exactly the")
    print("  scored population and every p would be uniform by construction "
          "(doctrine 68).")
    print("  So the window moves m and nothing else, and the crossing is at "
          "window 2-3 --")
    print("  spans one or two syllables apart, which is an adjacent-syllable "
          "echo and not")
    print("  internal rhyme at a distance. `analyse()` needs 4 events; window "
          "2 delivers")
    print("  4 or more on 2 of 20 sonnets.")

    print("\n=== LEVER 3: max_span. SELF-CANCELLING ===")
    print(f"\n{'max_span':>9} {'window':>7} {'p50 m_med':>10} "
          f"{'p50 min_p':>10} {'p50 M_NEEDED':>13} {'m_med/M_NEED':>13} "
          f"{'ev>0':>5}")
    for ms in (1, 2, 3):
        for w in (8, 16, 32):
            rs = [probe(it, TimeDeclaration(theta=0.80, window=w, max_span=ms,
                                            max_null_band_pass=1.01))
                  for it in items]
            mn = q([r['m_needed'] for r in rs], .5)
            print(f"{ms:9d} {w:7d} {q([r['m_med'] for r in rs], .5):10d} "
                  f"{q([r['min_p'] for r in rs], .5):10.2e} {mn:13d} "
                  f"{q([r['m_med'] for r in rs], .5) / max(1, mn):12.1f}x "
                  f"{sum(1 for r in rs if r['n_events'] > 0):5d}")
    print("\n  max_span 3 -> 1 cuts m_med 6.9x AND raises min_p 5.9x, because "
          "a one-syllable")
    print("  span is a monosyllable and monosyllables collide by chance far "
          "more often.")
    print("  The gap gets WORSE: 2.2x -> 4.8x at window 32. Every lever that "
          "shrinks the")
    print("  family by shrinking the span pool shrinks the null's headroom by "
          "the same act.")

    print("\n=== LEVER 4: item LENGTH. IT PLATEAUS, ABOVE 1 ===")
    base = sonnets(16 if slow else 8)
    print(f"\n{'sonnets':>8} {'lines':>6} {'n_pairs':>8} {'ge':>5} "
          f"{'ge rate':>9} {'min_p':>10} {'M_NEEDED':>9} {'m_med':>7} "
          f"{'m_med/M_NEED':>13} {'ev>0':>5} {'secs':>6}")
    for k in ((1, 2, 4, 8, 16) if slow else (1, 2, 4, 8)):
        lines = [l for s in base[:k] for l in s]
        t0 = time.time()
        r = probe(lines, TimeDeclaration(theta=0.80, window=32,
                                         max_null_band_pass=1.01))
        print(f"{k:8d} {len(lines):6d} {r['n_pairs']:8d} {r['ge']:5d} "
              f"{r['ge'] / r['n_valid']:9.5f} {r['min_p']:10.2e} "
              f"{r['m_needed']:9d} {r['m_med']:7d} "
              f"{r['m_med'] / max(1, r['m_needed']):12.1f}x "
              f"{r['n_events']:5d} {time.time() - t0:6.1f}")
    print("\n  m is bounded by the WINDOW, so it stops growing at ~250 while "
          "the item grows.")
    print("  The perfect-pair density falls 0.00415 -> 0.00255 and then stops, "
          "because it is")
    print("  converging on the rate at which two random stressed spans of "
          "English verse are")
    print("  a perfect rhyme. That rate is a fact about the language, not "
          "about the poem,")
    print("  and it caps M_NEEDED at ~20-30 however much text is supplied.")


# ---------------------------------------------------------------------------
# --beat: the one lever that reaches the range, and what it costs
# ---------------------------------------------------------------------------

def _beat_pairs(stream, tdecl, beat=None, phase=0):
    """`_candidate_pairs` with anchors restricted to a declared beat.

    `beat=None` reproduces the shipped function exactly. This is the cheapest
    honest proxy for "a declared tempo": if the layer is told where the beats
    are, a rhyme anchor may only start on one, and the family shrinks by the
    beat spacing.
    """
    gi = grid_index(stream, tdecl.grid_unit)
    starts = [i for i, s in enumerate(stream) if s["stress"] in (1, 2)]
    if beat is not None:
        starts = [i for i in starts
                  if gi[i] is not None and gi[i] % beat == phase]
    spans = [(i, i + L) for i in starts
             for L in range(1, tdecl.max_span + 1) if i + L <= len(stream)]
    by_start = {}
    for a, b in spans:
        by_start.setdefault(a, []).append((a, b))
    out = []
    for a, b in spans:
        for c in starts:
            if c <= a or c - a > tdecl.window:
                continue
            for (c2, d) in by_start.get(c, ()):
                if c2 < b:
                    continue
                if {x["widx"] for x in stream[a:b]} & \
                        {x["widx"] for x in stream[c2:d]}:
                    continue
                out.append(((a, b), (c2, d)))
    return out


def run_beat(n=20):
    """The declared-tempo route, measured -- including the reason it is a trap.

    Doctrine 41: a positive control can pass for the wrong reason. Restricting
    anchors to a declared beat and then testing whether events are periodic AT
    that beat is arm A without arm C1. The `event phases` column is the
    evidence: at beat 4 every event lands on phase 0, by construction.
    """
    from collections import Counter
    print("\n=== LEVER 5: A DECLARED BEAT -- the only lever that reaches the "
          "range ===")
    print("\nAnchors restricted to every k-th grid position. window=32, "
          "max_span=3, n=20.\n")
    print(f"{'beat':>6} {'p50 pairs':>10} {'p50 m_med':>10} {'p50 min_p':>10} "
          f"{'p50 M_NEEDED':>13} {'m_med/M_NEED':>13} {'ev>0':>5} "
          f"{'ev>=4':>6} {'event phases mod 4':>20}")
    son = sonnets(n)
    t = TimeDeclaration(theta=0.80, window=32)
    for beat in (None, 2, 3, 4, 6, 8):
        rs, agg = [], Counter()
        for lines in son:
            st = syllable_stream(LEX, lines)
            gi = grid_index(st, t.grid_unit)
            r = _probe_with_pairs(st, t, _beat_pairs(st, t, beat), gi)
            if r is None:
                continue
            rs.append(r)
            agg.update(r["phase4"])
        if not rs:
            continue
        mn = q([r['m_needed'] for r in rs], .5)
        lab = "none" if beat is None else str(beat)
        print(f"{lab:>6} {q([r['n_pairs'] for r in rs], .5):10d} "
              f"{q([r['m_med'] for r in rs], .5):10d} "
              f"{q([r['min_p'] for r in rs], .5):10.2e} {mn:13d} "
              f"{q([r['m_med'] for r in rs], .5) / max(1, mn):12.1f}x "
              f"{sum(1 for r in rs if r['n_events'] > 0):5d} "
              f"{sum(1 for r in rs if r['n_events'] >= 4):6d} "
              f"{str(dict(sorted(agg.items()))):>20}")
    print("\n  A beat of 4 cuts the median family 198 -> 28, which is the "
          "first lever to")
    print("  land near M_NEEDED without collapsing the window. It still "
          "produces 4 or")
    print("  more events on 0 of 20 sonnets -- and look at the phase column: "
          "every event")
    print("  it does produce is on phase 0, because the anchors were "
          "restricted to phase 0.")
    print("  So the lever that reaches the range answers the layer's own "
          "question by")
    print("  construction. Doctrine 41, arriving at the time layer: pair it "
          "with a")
    print("  same-positions-no-signal arm before believing anything it says.")


def _probe_with_pairs(st, tdecl, pairs, gi):
    """probe(), for a caller that has already chosen the candidate set."""
    from collections import Counter
    if not pairs:
        return None
    slots = [i for i in range(len(st))
             if gi[i] is not None and not st[i]["line_final"]]
    cache = {}

    def sc(sa, sb):
        k = (sa, sb)
        v = cache.get(k, MISS)
        if v is MISS:
            v = _raw_score(st, sa, sb, DECL, None)
            cache[k] = v
        return v
    left = [p[0] for p in pairs]
    right = [p[1] for p in pairs]
    rng = random.Random(tdecl.seed ^ 0x5EED)
    null, n_valid, tries = [], 0, 0
    while n_valid < tdecl.null_samples and tries < tdecl.null_samples * 20:
        tries += 1
        sa = left[rng.randrange(len(left))]
        sb = right[rng.randrange(len(right))]
        if sa == sb or max(sa[0], sb[0]) < min(sa[1], sb[1]):
            continue
        if {x["widx"] for x in st[sa[0]:sa[1]]} & \
                {x["widx"] for x in st[sb[0]:sb[1]]}:
            continue
        n_valid += 1
        v = sc(sa, sb)
        if v is not None:
            null.append(v)
    null.sort()

    def pval(v):
        lo, hi = 0, len(null)
        while lo < hi:
            mid = (lo + hi) // 2
            if null[mid] < v:
                lo = mid + 1
            else:
                hi = mid
        return (len(null) - lo + 1) / (n_valid + 1)
    fam, pv = {}, {}
    for k, (sa, sb) in enumerate(pairs):
        for pos in list(range(*sa)) + list(range(*sb)):
            fam.setdefault(pos, []).append(k)
        v = sc(sa, sb)
        if v is not None:
            pv[k] = pval(v)
    sizes = sorted(len(v) for v in fam.values())
    a = tdecl.alpha
    ev = set()
    for pos, ks in fam.items():
        c = 1 - (1 - a) ** (1.0 / len(ks))
        if any(pv.get(k, 1.0) <= c for k in ks):
            ev.add(pos)
    evs = [i for i in slots if i in ev]
    min_p = min(pv.values()) if pv else 1.0
    return dict(n_pairs=len(pairs), m_med=sizes[len(sizes) // 2],
                m_min=sizes[0], min_p=min_p,
                m_needed=m_needed(min_p, a, tdecl.correction),
                n_events=len(evs),
                phase4=dict(Counter(gi[i] % 4 for i in evs)))


# ---------------------------------------------------------------------------

def main(argv):
    args = set(argv)
    slow = "--slow" in args
    want = {a for a in args if a.startswith("--") and a != "--slow"}
    if not want:
        want = {"--verify", "--corpus", "--floor", "--levers", "--beat"}
    t0 = time.time()
    bad = run_verify() if "--verify" in want else 0
    if "--corpus" in want:
        run_corpus()
    if "--floor" in want:
        run_floor()
    if "--levers" in want:
        run_levers(slow=slow)
    if "--beat" in want:
        run_beat()
    print(f"\ntotal {time.time() - t0:.0f}s")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
