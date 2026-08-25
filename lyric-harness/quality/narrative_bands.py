"""Narrative proxy calibration runner — P1 and P2 of
quality/NARRATIVE_BANDS_PREREGISTRATION.md, built AFTER that registration
and bound by it.

WHAT THIS MEASURES (and nothing else):
  P1  cross-seam content continuity over adjacent declared sections of
      human songs, against a within-song section-shuffle null.
  P2  room between returning-mark instances: intervening-section rates
      and the back-to-back rate.
P3 (person/tense frame) is registered and DEFERRED; it is deliberately
not implemented here so a later run cannot look like scope creep.

DISCIPLINE CARRIED FROM THE REGISTRATION:
  - Population: `corpus/song/eng_*` songs whose own marks declare at
    least one section function, read by `grid.read_marked_songs` — the
    one existing reader. A song with no marked block is REFUSED from the
    population and counted, never auto-sectioned (the recover.py rule).
  - The banked songs live under `songs/` and are structurally outside
    the walk — the failure log calibrates nothing (doctrine 13/14).
  - Content partition, spelled once: a type whose in-context POS tag
    falls outside `features.FUNCTION_TAGS`, over `line_tokens` — the
    spelling recorded because panel run 5 caught it drifting.
  - The null is a within-song permutation of block order (matched by
    construction: same vocabulary, same lengths), seeded and drawn
    NULL_DRAWS times; the excess is reported as a series (doctrine 89).
  - Three counts, never summed: songs measured, songs refused (no
    marks), blocks skipped (no content types).
  - Nothing here fires on any draft and no threshold is adopted in this
    module; `--check` re-derives the PINNED counts of the first recorded
    run so drift fails loud (exit 3), which is a pin on the MEASUREMENT,
    not an enforcement of anything.

Determinism: iteration is over sorted paths and sorted block indices;
the only randomness is `random.Random(NULL_SEED)` (doctrine 66).
"""

import glob
import os
import random
import statistics
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

import lyric_harness as LH  # noqa: E402
from quality import grid as G  # noqa: E402
from quality.features import FUNCTION_TAGS, _tagger  # noqa: E402

NULL_SEED = 20260825
NULL_DRAWS = 10

#: P2's HEADLINE population — the marks whose TEXT returns, which is the
#: population the reframe question (`NARRATIVE_DESIGN.md` §D) is about.
#: `verse` is excluded by its own gloss — "returns with NEW WORDS on the
#: same tune" — its instances are not the same card, so room between
#: them answers nothing about reframing an invariant. Per-function rows
#: are still reported for every function, so the exclusion hides nothing.
P2_INVARIANT_RETURNS = ("burden", "chorus", "hook", "refrain", "tag")

#: PINNED 2026-08-25 from the first recorded run
#: (quality/RESULTS_NARRATIVE_BANDS.md). Measured facts, not thresholds —
#: the registration forbids adopting a threshold the sitting it is first
#: measured. `--check` re-derives these exactly and exits 3 on drift.
PINNED = {
    "songs_measured": 8667,
    "songs_refused_unmarked": 0,
    "seams": 40970,
    "p1_nonzero_rate": 0.5902,
    "p1_null_median_rate": 0.5824,
    "p2_pairs": 1676,
    "p2_back_to_back_rate": 0.0048,
}


def _content_types(lines, tag):
    """The declared content partition over a block's sung lines."""
    out = set()
    for l in lines:
        if LH.is_apparatus_line(l):
            continue
        toks = LH.line_tokens(l)
        if not toks:
            continue
        for w, t in tag(toks):
            if t not in FUNCTION_TAGS:
                out.add(w.lower())
    return out


def measure(root="corpus/song", verbose=True):
    tag = _tagger()
    paths = sorted(glob.glob(os.path.join(root, "eng_*")))
    songs_in = songs_refused = blocks_skipped = 0
    # per measured song: (ordered list of content-type sets,
    #                     ordered list of functions, path)
    kept = []
    for p in paths:
        try:
            marked = G.read_marked_songs(p)
        except Exception:
            continue
        for s in marked:
            fns = [b.function or "" for b in s.blocks]
            if not any(fns):
                songs_refused += 1
                continue
            sets_, funcs = [], []
            for b in s.blocks:
                cs = _content_types(b.lines, tag)
                if not cs:
                    blocks_skipped += 1
                sets_.append(cs)
                funcs.append(b.function or "")
            songs_in += 1
            kept.append((sets_, funcs))

    # ---- P1: adjacent seams over the ORIGINAL order --------------------
    def seams_of(order, sets_):
        out = []
        for i in range(len(order) - 1):
            a, b = sets_[order[i]], sets_[order[i + 1]]
            if not a or not b:
                continue
            out.append((len(a & b), min(len(a), len(b))))
        return out

    obs = []
    by_pair = {}
    for sets_, funcs in kept:
        order = list(range(len(sets_)))
        for i in range(len(order) - 1):
            a, b = sets_[i], sets_[i + 1]
            if not a or not b:
                continue
            shared = len(a & b)
            obs.append((shared, min(len(a), len(b))))
            fa, fb = funcs[i], funcs[i + 1]
            if fa and fb:
                key = (fa, fb)
                r = by_pair.setdefault(key, [0, 0])
                r[0] += 1
                r[1] += (shared > 0)
    n_seams = len(obs)
    nonzero = sum(1 for s, _ in obs if s) / n_seams if n_seams else 0.0
    ratios = [s / m for s, m in obs if m]
    med_ratio = statistics.median(ratios) if ratios else 0.0

    # ---- P1 null: within-song block-order shuffles ---------------------
    rng = random.Random(NULL_SEED)
    null_rates = []
    for _ in range(NULL_DRAWS):
        tot = hit = 0
        for sets_, _funcs in kept:
            if len(sets_) < 3:
                continue
            order = list(range(len(sets_)))
            rng.shuffle(order)
            for shared, m in seams_of(order, sets_):
                tot += 1
                hit += (shared > 0)
        null_rates.append(hit / tot if tot else 0.0)
    null_sorted = sorted(null_rates)

    # ---- P2: room between returning-mark instances ---------------------
    p2_pairs = p2_b2b = 0
    p2_by_fn = {}
    for sets_, funcs in kept:
        for fn in sorted(set(f for f in funcs if f)):
            idx = [i for i, f in enumerate(funcs) if f == fn]
            for a, b in zip(idx, idx[1:]):
                b2b = (b - a == 1)
                r = p2_by_fn.setdefault(fn, [0, 0])
                r[0] += 1
                r[1] += b2b
                if fn in P2_INVARIANT_RETURNS:
                    p2_pairs += 1
                    p2_b2b += b2b

    res = {
        "songs_measured": songs_in,
        "songs_refused_unmarked": songs_refused,
        "blocks_skipped": blocks_skipped,
        "seams": n_seams,
        "p1_nonzero_rate": round(nonzero, 4),
        "p1_median_overlap_ratio": round(med_ratio, 4),
        "p1_null_rates": [round(r, 4) for r in null_sorted],
        "p1_null_median_rate": round(statistics.median(null_sorted), 4)
        if null_sorted else 0.0,
        "p1_by_function_pair": {
            f"{a}->{b}": (n, round(k / n, 4))
            for (a, b), (n, k) in sorted(
                by_pair.items(), key=lambda kv: -kv[1][0])[:12]},
        "p2_pairs": p2_pairs,
        "p2_back_to_back_rate": round(p2_b2b / p2_pairs, 4)
        if p2_pairs else 0.0,
        "p2_by_function": {
            fn: (n, round(k / n, 4))
            for fn, (n, k) in sorted(p2_by_fn.items(),
                                     key=lambda kv: -kv[1][0])[:8]},
    }
    if verbose:
        print("narrative proxy calibration — P1/P2 "
              "(quality/NARRATIVE_BANDS_PREREGISTRATION.md)")
        print(f"  songs measured {res['songs_measured']}   "
              f"refused (no marks) {res['songs_refused_unmarked']}   "
              f"blocks skipped {res['blocks_skipped']}   "
              "— three counts, never summed")
        print(f"  P1 seams {res['seams']}   nonzero-continuity rate "
              f"{res['p1_nonzero_rate']}   median overlap ratio "
              f"{res['p1_median_overlap_ratio']}")
        print(f"  P1 null (within-song shuffle, seed {NULL_SEED}, "
              f"{NULL_DRAWS} draws): {res['p1_null_rates']}   "
              f"median {res['p1_null_median_rate']}")
        print(f"  P1 excess over null median: "
              f"{round(res['p1_nonzero_rate'] - res['p1_null_median_rate'], 4)}")
        print("  P1 by function pair (n, nonzero rate):")
        for k, v in res["p1_by_function_pair"].items():
            print(f"    {k:24s} {v[0]:6d}  {v[1]}")
        print(f"  P2 consecutive INVARIANT-RETURN pairs "
              f"({', '.join(P2_INVARIANT_RETURNS)}) {res['p2_pairs']}   "
              f"back-to-back rate {res['p2_back_to_back_rate']}")
        print("  P2 by function (n, back-to-back rate):")
        for k, v in res["p2_by_function"].items():
            print(f"    {k:12s} {v[0]:6d}  {v[1]}")
    return res


def main(argv):
    if "--check" in argv and not PINNED:
        print("REFUSED — no run has been banked into PINNED yet; a check "
              "against nothing would pass vacuously (doctrine 20)")
        return 2
    res = measure()
    if "--check" in argv:
        drift = {k: (v, res[k]) for k, v in PINNED.items()
                 if res.get(k) != v}
        if drift:
            print("MOVED:", drift)
            return 3
        print("PINNED counts re-derive exactly")
        return 0
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
