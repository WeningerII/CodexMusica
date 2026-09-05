#!/usr/bin/env python3
"""Length-conditioned floor thresholds over the WHOLE song corpus.

    python3 quality/length_curve_calibration.py compute --out rows.tsv \\
        [--without-predictability] [--shard I/K] [--cache-path P]
    python3 quality/length_curve_calibration.py fit rows.tsv [more.tsv ...] \\
        [--seeds 200] [--checks mattr,fwr,anaphora,cv,predictability]
    python3 quality/length_curve_calibration.py merge-cache shard1.tsv ... --into P
    python3 quality/length_curve_calibration.py check [--rows rows.tsv ...]
                                # THE DRIFT DETECTOR: re-fit the shipped
                                # `lyric` row's curves from the corpus and
                                # compare to the digit; exit 0 HOLDS, 1 MOVED,
                                # 2 cannot tell. Cold: ~2 CPU-min for the four
                                # cheap checks + the predictability memo's
                                # own cost (warm after the nightly band check)

Pre-registration: quality/LENGTH_CURVE_PREREGISTRATION.md (2026-09-04).
Results: quality/RESULTS_LENGTH_CURVE.md.

THE QUESTION, AS IT STOOD WHEN THIS CELL OPENED. The lyric-sheet floor's five
human percentiles ~~are~~ WERE fixed
numbers over a token BAND (200-400 `song`, 50-150 `short`), and the band
rule refused every wider range because the percentiles drift with length.
Repinned 2026-09-05: the cell answered its own question on 2026-09-04 and the
answer shipped — the `lyric` row this file re-derives under `check`
SUPERSEDED both bands (`MISSING.md` M-239), so the floor's sheet thresholds
are curves in ln N now and the two band rows survive only for their own
drift checks.
This file measures the drift's SHAPE over all 8,667 items (4-3,245 tokens)
and asks whether a threshold that is a function of ln N can hold a nominal
5% held-out false-positive rate at EVERY length, so one profile can cover
the corpus with derived limits instead of typed edges.

EVERYTHING STATISTICAL IS BORROWED FROM `song_profile_calibration.py`
verbatim -- the items, the features, `q`, the author-held-out split --
so this cell and the two banded cells cannot disagree about what an item
or a feature is (doctrine 1). Nothing outside the standard library is
imported: the results must reproduce on a fresh clone.
"""
import argparse
import math
import os
import random
import statistics
import sys
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from quality import song_profile_calibration as C  # noqa: E402

CHECKS = C.CHECKS                       # (feature, side, percentile)
TAU = {f: (p if s == "lo" else p) for f, s, p in CHECKS}   # the quantile fit
SIDE = {f: s for f, s, _ in CHECKS}
BIN_ITEMS = 400                         # §2: declared from resolution
BIN_MIN_TAIL = 200
NOMINAL = 0.05
IRLS_EPS = 1e-6
IRLS_MAX = 200
IRLS_TOL = 1e-10
START_AGREE = 1e-6                      # §3/E4: two-start refusal
ROW_FIELDS = ["file", "author", "title", "n_lines", "n_tokens",
              "mattr", "fwr", "anaphora", "cv", "predictability"]


# ---------------------------------------------------------------------------
# compute: the rows, exactly population()'s, to a TSV (sharded for stage B)
# ---------------------------------------------------------------------------

def _shard(files, spec):
    if not spec:
        return files
    i, k = (int(t) for t in spec.split("/"))
    assert 1 <= i <= k
    return [f for n, f in enumerate(files) if n % k == i - 1]


def cmd_compute(a):
    files = _shard(C.corpus_files(), a.shard)
    t0 = time.process_time()
    w0 = time.time()
    cache = C.PredictabilityCache(
        a.cache_path, enabled=not a.without_predictability,
        why_off="disabled (--without-predictability)").open()
    cache.report()
    scorer = C.Scorer(cache)
    rows, scorer = C.population(
        scorer=scorer, with_predictability=not a.without_predictability,
        pred_max_tokens=None, files=files)
    cache.flush()
    with open(a.out, "w", encoding="utf-8") as fh:
        fh.write("\t".join(ROW_FIELDS) + "\n")
        for r in rows:
            fh.write("\t".join(
                str(r[k]) if k in ("file", "author", "title", "n_lines",
                                   "n_tokens")
                else repr(float(r[k])) for k in ROW_FIELDS) + "\n")
    print("COMPUTE  shard %s: %d files, %d rows -> %s; cache hits %d misses "
          "%d; %.0f CPU-s, %.0f wall-s"
          % (a.shard or "1/1", len(files), len(rows), a.out, cache.hits,
             cache.misses, time.process_time() - t0, time.time() - w0))


def cmd_merge_cache(a):
    """Merge shard memos into one file under the fingerprint rule: every
    shard must carry the CURRENT fingerprint or it is refused by name."""
    fp = C.comparator_fingerprint()
    entries = {}
    for p in a.shards:
        head, n = {}, 0
        with open(p, encoding="utf-8") as fh:
            for line in fh:
                if line.startswith("#"):
                    k, _, v = line[1:].rstrip("\n").partition("\t")
                    head[k] = v
                    continue
                k, _, v = line.rstrip("\n").partition("\t")
                entries[k] = v
                n += 1
        if head.get("fingerprint") != fp:
            print("REFUSED: %s carries fingerprint %s, comparator is %s"
                  % (p, head.get("fingerprint"), fp))
            sys.exit(2)
        print("MERGE  %s: %d entries" % (p, n))
    os.makedirs(os.path.dirname(a.into), exist_ok=True)
    with open(a.into, "w", encoding="utf-8") as fh:
        fh.write("#version\t%d\n#fingerprint\t%s\n#written\t%s\n"
                 % (C.CACHE_VERSION, fp, time.strftime("%Y-%m-%dT%H:%M:%S")))
        for k in sorted(entries):
            fh.write("%s\t%s\n" % (k, entries[k]))
    print("MERGE  -> %s: %d entries" % (a.into, len(entries)))


# ---------------------------------------------------------------------------
# rows in
# ---------------------------------------------------------------------------

def read_rows(paths):
    rows = []
    for p in paths:
        with open(p, encoding="utf-8") as fh:
            head = fh.readline().rstrip("\n").split("\t")
            for line in fh:
                v = line.rstrip("\n").split("\t")
                r = dict(zip(head, v))
                r["n_lines"] = int(r["n_lines"])
                r["n_tokens"] = int(r["n_tokens"])
                for k in ("mattr", "fwr", "anaphora", "cv", "predictability"):
                    r[k] = float(r[k]) if k in r else float("nan")
                r["x"] = math.log(r["n_tokens"])
                rows.append(r)
    rows.sort(key=lambda r: (r["n_tokens"], r["file"], r["title"]))
    for i, r in enumerate(rows):
        r["i"] = i
    return rows


# ---------------------------------------------------------------------------
# bins (§2): fixed on the whole corpus once
# ---------------------------------------------------------------------------

def make_bins(rows):
    n = len(rows)
    edges = list(range(0, n, BIN_ITEMS))
    if n - edges[-1] < BIN_MIN_TAIL and len(edges) > 1:
        edges.pop()
    bins = []
    for k, a in enumerate(edges):
        b = edges[k + 1] if k + 1 < len(edges) else n
        sub = rows[a:b]
        bins.append({
            "k": k, "lo_i": a, "hi_i": b, "n": len(sub),
            "n_lo": sub[0]["n_tokens"], "n_hi": sub[-1]["n_tokens"],
            "med": statistics.median(r["n_tokens"] for r in sub),
        })
        for r in sub:
            r["bin"] = k
    for bn in bins:
        bn["x_med"] = math.log(bn["med"])
    return bins


def bin_quantile(items, f):
    vals = [v for r in items if (v := r[f]) == v]
    return C.q(vals, TAU[f]) if vals else float("nan"), vals


# ---------------------------------------------------------------------------
# candidates (§3)
# ---------------------------------------------------------------------------

def _solve(A, b):
    """Gaussian elimination with partial pivoting, small dense system."""
    n = len(b)
    M = [row[:] + [b[i]] for i, row in enumerate(A)]
    for c in range(n):
        p = max(range(c, n), key=lambda r: abs(M[r][c]))
        M[c], M[p] = M[p], M[c]
        if abs(M[c][c]) < 1e-300:
            return None
        for r in range(n):
            if r != c:
                f = M[r][c] / M[c][c]
                if f:
                    for cc in range(c, n + 1):
                        M[r][cc] -= f * M[c][cc]
    return [M[i][n] / M[i][i] for i in range(n)]


def _design(x, d):
    return [x ** j for j in range(d + 1)]


def pinball(vals, xs, coef, tau):
    d = len(coef) - 1
    s = 0.0
    for v, x in zip(vals, xs):
        u = v - sum(c * x ** j for j, c in enumerate(coef)) if d else v - coef[0]
        s += tau * u if u >= 0 else (tau - 1) * u
    return s


def irls(vals, xs, tau, d, start):
    """Quantile regression by iteratively reweighted least squares on the
    smoothed pinball loss. -> (coef, loss, iterations)."""
    coef = list(start)
    X = [_design(x, d) for x in xs]
    last = pinball(vals, xs, coef, tau)
    it = 0
    for it in range(1, IRLS_MAX + 1):
        p = d + 1
        A = [[0.0] * p for _ in range(p)]
        b = [0.0] * p
        for v, row in zip(vals, X):
            u = v - sum(c * xj for c, xj in zip(coef, row))
            w = (tau if u >= 0 else 1 - tau) / max(abs(u), IRLS_EPS)
            for i in range(p):
                wi = w * row[i]
                b[i] += wi * v
                for j in range(p):
                    A[i][j] += wi * row[j]
        new = _solve(A, b)
        if new is None:
            break
        loss = pinball(vals, xs, new, tau)
        if loss > last:
            # damp: halve the step until it does not climb
            for _ in range(20):
                new = [(c + n) / 2 for c, n in zip(coef, new)]
                loss = pinball(vals, xs, new, tau)
                if loss <= last:
                    break
            if loss > last:
                break
        coef = new
        if last - loss < IRLS_TOL * max(1.0, last):
            last = loss
            break
        last = loss
    return coef, last, it


def ls_through_knots(knots, d):
    """Least squares of q_k on x_med (start 1 of §3)."""
    p = d + 1
    A = [[0.0] * p for _ in range(p)]
    b = [0.0] * p
    for x, y in knots:
        row = _design(x, d)
        for i in range(p):
            b[i] += row[i] * y
            for j in range(p):
                A[i][j] += row[i] * row[j]
    return _solve(A, b) or [0.0] * p


def fit_parametric(items, f, d, bins_knots, two_starts):
    """-> dict(coef, loss, iters, agree) for C_d on `items`."""
    vals, xs = [], []
    for r in items:
        v = r[f]
        if v == v:
            vals.append(v)
            xs.append(r["x"])
    tau = TAU[f]
    if d == 0:
        c = [C.q(vals, tau)]
        return {"coef": c, "loss": pinball(vals, xs, c, tau), "iters": 0,
                "agree": 0.0, "n": len(vals)}
    s1 = ls_through_knots(bins_knots, d)
    c1, l1, i1 = irls(vals, xs, tau, d, s1)
    out = {"coef": c1, "loss": l1, "iters": i1, "agree": 0.0, "n": len(vals)}
    if two_starts:
        c2, l2, i2 = irls(vals, xs, tau, d, [0.0] * (d + 1))
        out["agree"] = abs(l1 - l2) / max(1.0, l1)
        out["loss_zero_start"] = l2
        if l2 < l1:
            out["coef"], out["loss"], out["iters"] = c2, l2, i2
    return out


def knot_curve(knots):
    """CK: linear interpolation in x between knots, flat beyond."""
    ks = sorted(knots)

    def f(x):
        if x <= ks[0][0]:
            return ks[0][1]
        if x >= ks[-1][0]:
            return ks[-1][1]
        for (x0, y0), (x1, y1) in zip(ks, ks[1:]):
            if x0 <= x <= x1:
                return y0 if x1 == x0 else y0 + (y1 - y0) * (x - x0) / (x1 - x0)
        return ks[-1][1]
    return f


def poly_curve(coef):
    def f(x):
        return sum(c * x ** j for j, c in enumerate(coef))
    return f


def flags(items, f, curve):
    side = SIDE[f]
    hit = 0
    for r in items:
        v = r[f]
        if v != v:
            continue
        t = curve(r["x"])
        if (v < t) if side == "lo" else (v > t):
            hit += 1
    return hit


# ---------------------------------------------------------------------------
# binomial bounds (§4)
# ---------------------------------------------------------------------------

def binom_bounds(n, p=NOMINAL, lo=0.025, hi=0.975):
    """-> (L, U) as rates: the 2.5th and 97.5th percentile counts of
    Binomial(n, p), divided by n."""
    if n <= 0:
        return 0.0, 1.0
    pmf = [0.0] * (n + 1)
    lp = n * math.log(1 - p) if p < 1 else float("-inf")
    for k in range(n + 1):
        if k:
            lp += math.log(n - k + 1) - math.log(k) + math.log(p) - math.log(1 - p)
        pmf[k] = math.exp(lp)
    cum, L, U = 0.0, None, None
    for k in range(n + 1):
        cum += pmf[k]
        if L is None and cum >= lo:
            L = k
        if U is None and cum >= hi:
            U = k
            break
    return (L or 0) / n, (U if U is not None else n) / n


# ---------------------------------------------------------------------------
# fit: the whole cell
# ---------------------------------------------------------------------------

MODELS = ["C0", "C1", "C2", "CK"]


def knots_of(items_by_bin, bins, f):
    ks, extremes = [], {}
    for bn in bins:
        sub = items_by_bin.get(bn["k"], [])
        qk, vals = bin_quantile(sub, f)
        if qk == qk:
            ks.append((bn["x_med"], qk))
            ext = max(vals) if SIDE[f] == "hi" else min(vals)
            extremes[bn["k"]] = (qk == ext)
        else:
            extremes[bn["k"]] = True
    return ks, extremes


def curves_for(items, bins, f, two_starts=False):
    """Fit every candidate on `items`. -> {model: (curve, info)}."""
    by_bin = {}
    for r in items:
        by_bin.setdefault(r["bin"], []).append(r)
    knots, extremes = knots_of(by_bin, bins, f)
    out = {"CK": (knot_curve(knots), {"knots": knots})}
    for d in (0, 1, 2):
        info = fit_parametric(items, f, d, knots, two_starts)
        out["C%d" % d] = (poly_curve(info["coef"]), info)
    return out, extremes


def flagged_ids(items, f, curve):
    side = SIDE[f]
    out = set()
    for r in items:
        v = r[f]
        if v != v:
            continue
        t = curve(r["x"])
        if (v < t) if side == "lo" else (v > t):
            out.add(r["i"])
    return out


def held_out(rows, bins, checks, seeds, verbose=True, bands=()):
    """§4: 200 author (file) 50/50 splits; per seed, per check, per model,
    per bin: the held-out flag rate. -> results[f][model][k] = [rates],
    plus held counts and under-resolved marks.

    Also returns, per seed, the SET of held-out item ids each (check, model)
    flags — and the same for each shipped band's constant threshold, read
    off the calibration half INSIDE the band (`band:<name>`), so E2 can be
    a held-out union against a held-out union on the same seeds (§6 E2).
    """
    files = sorted({r["file"] for r in rows})
    res = {f: {m: {bn["k"]: [] for bn in bins} for m in MODELS} for f in checks}
    unres = {f: {bn["k"]: 0 for bn in bins} for f in checks}
    held_n = {bn["k"]: [] for bn in bins}
    flag_sets = []          # per seed: {(f, model): set(ids)}
    held_ids = []           # per seed: set of held item ids
    t0 = time.time()
    done = 0
    for s in range(seeds):
        rnd = random.Random(s)
        sh = files[:]
        rnd.shuffle(sh)
        cal = set(sh[:len(sh) // 2])
        c = [r for r in rows if r["file"] in cal]
        h = [r for r in rows if r["file"] not in cal]
        if len(c) < 50 or len(h) < 50:
            continue
        h_by_bin = {}
        for r in h:
            h_by_bin.setdefault(r["bin"], []).append(r)
        for bn in bins:
            held_n[bn["k"]].append(len(h_by_bin.get(bn["k"], [])))
        fs = {}
        for f in checks:
            cv, extremes = curves_for(c, bins, f)
            for k, e in extremes.items():
                unres[f][k] += 1 if e else 0
            for m, (curve, _info) in cv.items():
                for bn in bins:
                    sub = h_by_bin.get(bn["k"], [])
                    defined = sum(1 for r in sub if r[f] == r[f])
                    rate = flags(sub, f, curve) / defined if defined else float("nan")
                    res[f][m][bn["k"]].append(rate)
                fs[(f, m)] = flagged_ids(h, f, curve)
            for name, lo, hi in bands:
                vals = [r[f] for r in c if lo <= r["n_tokens"] <= hi and r[f] == r[f]]
                if not vals:
                    continue
                t = C.q(vals, TAU[f])
                fs[(f, "band:" + name)] = flagged_ids(h, f, lambda x, t=t: t)
        flag_sets.append(fs)
        held_ids.append({r["i"] for r in h})
        done += 1
        if verbose and (done % 10 == 0 or done == seeds):
            print("  held-out seed %d/%d  %.0f s" % (done, seeds, time.time() - t0),
                  flush=True)
    return res, held_n, unres, done, flag_sets, held_ids


def union_rate(flag_sets, held_ids, rows, bins, model_of, bin_keys):
    """-> [per-seed union rate] over held items in `bin_keys`, flagging an
    item when ANY check's chosen model (`model_of[f]`) flags it."""
    ids_in = {r["i"] for bn in bins if bn["k"] in bin_keys for r in rows[bn["lo_i"]:bn["hi_i"]]}
    out = []
    for fs, hid in zip(flag_sets, held_ids):
        held = hid & ids_in
        if not held:
            continue
        flagged = set()
        for f, m in model_of.items():
            flagged |= fs.get((f, m), set())
        out.append(len(flagged & held) / len(held))
    return out


def median_nan(v):
    v = [x for x in v if x == x]
    return statistics.median(v) if v else float("nan")


def pct(v, p):
    return C.q([x for x in v if x == x], p)


def cmd_fit(a):
    rows = read_rows(a.rows)
    checks = a.checks.split(",")
    print("ROWS  %d items, %d files, N %d..%d, median %d"
          % (len(rows), len({r["file"] for r in rows}), rows[0]["n_tokens"],
             rows[-1]["n_tokens"], statistics.median(r["n_tokens"] for r in rows)))
    for f in checks:
        nd = sum(1 for r in rows if r[f] == r[f])
        print("      %-14s defined on %d items" % (f, nd))
    bins = make_bins(rows)
    print("\nBINS  %d bins of ~%d items, fixed on the whole corpus (§2); the last three"
          " columns are DIAGNOSTIC — the share of 14-line and 4-line items and the"
          " number of files, because a form that clusters at one length is a"
          " different population inside that bin" % (len(bins), BIN_ITEMS))
    print("  %3s %5s %6s %6s %7s %6s %6s %6s" % ("k", "n", "N_lo", "N_hi", "N_med", "14ln%", "4ln%", "files"))
    for bn in bins:
        sub = rows[bn["lo_i"]:bn["hi_i"]]
        s14 = 100 * sum(1 for r in sub if r["n_lines"] == 14) / len(sub)
        s4 = 100 * sum(1 for r in sub if r["n_lines"] == 4) / len(sub)
        print("  %3d %5d %6d %6d %7.0f %6.1f %6.1f %6d"
              % (bn["k"], bn["n"], bn["n_lo"], bn["n_hi"], bn["med"], s14, s4,
                 len({r["file"] for r in sub})))

    # 1. the reference curve = the drift, exact, over the whole corpus
    print("\nREFERENCE CURVE (§5.1): per bin, each check's percentile over all items")
    hdr = "  %3s %6s %7s " % ("k", "N_lo", "N_med") + " ".join("%14s" % f for f in checks)
    print(hdr)
    by_bin = {}
    for r in rows:
        by_bin.setdefault(r["bin"], []).append(r)
    full_knots = {}
    for f in checks:
        full_knots[f], _ = knots_of(by_bin, bins, f)
    for bn in bins:
        cells = []
        for f in checks:
            qk, vals = bin_quantile(by_bin[bn["k"]], f)
            cells.append("%14s" % ("%.4f (n%d)" % (qk, len(vals)) if qk == qk else "nan"))
        print("  %3d %6d %7.0f " % (bn["k"], bn["n_lo"], bn["med"]) + " ".join(cells))

    # 2. full-corpus fits, two starts (E4)
    print("\nFULL-CORPUS FITS (§3): coefficients in x = ln N, pinball loss, two-start agreement")
    full = {}
    for f in checks:
        cv, _ = curves_for(rows, bins, f, two_starts=True)
        full[f] = cv
        for m in ("C0", "C1", "C2"):
            info = cv[m][1]
            refuse = info["agree"] > START_AGREE
            print("  %-14s %s  coef=[%s]  loss=%.4f  iters=%d  two-start |dloss|/loss=%.2e%s"
                  % (f, m, ", ".join("%.6g" % c for c in info["coef"]), info["loss"],
                     info["iters"], info["agree"], "  REFUSED (E4)" if refuse else ""))
            info["refused"] = refuse
        if "C2" in cv:
            c = cv["C2"][1]["coef"]
            if len(c) == 3 and c[2]:
                xt = -c[1] / (2 * c[2])
                inside = rows[0]["x"] <= xt <= rows[-1]["x"]
                cv["C2"][1]["turn_N"] = math.exp(xt)
                cv["C2"][1]["turn_inside"] = inside
                print("  %-14s C2 turning point at N=%.0f tokens%s"
                      % (f, math.exp(xt), " — INSIDE the corpus range (E3 watch)" if inside else ""))

    # 3. held-out (§4)
    from quality import floor as FL  # noqa: E402
    band_thr = {}
    for p in FL.PROFILES:
        # A shipped BAND is a lyric-sheet row with fixed percentiles; the
        # `lyric` row (curves, empty percentiles) is what is being judged
        # and is not a band to compare against.
        if p.n_lines == 0 and p.percentiles:
            band_thr[p.name] = (p.lo, p.hi, p.percentiles)
    print("\nHELD-OUT (§4): %d file 50/50 splits" % a.seeds, flush=True)
    res, held_n, unres, done, flag_sets, held_ids = held_out(
        rows, bins, checks, a.seeds, bands=[(n, lo, hi) for n, (lo, hi, _) in band_thr.items()])
    bounds = {}
    for bn in bins:
        nk = int(statistics.median(held_n[bn["k"]]))
        bounds[bn["k"]] = (nk,) + binom_bounds(nk)

    picks = {}
    print("\nPER-BIN HELD-OUT MEDIAN FLAG RATE, %% (pass = at or under U_k; 'u' = under-resolved; "
          "'<' = under L_k; 'X' = FAIL)")
    for f in checks:
        print("\n  %s (tail %.2f, side %s)" % (f, TAU[f], SIDE[f]))
        print("  %3s %6s %5s %5s %5s | " % ("k", "N_lo", "n_h", "L", "U")
              + " | ".join("%13s" % m for m in MODELS))
        passing = {m: [] for m in MODELS}
        for bn in bins:
            k = bn["k"]
            nk, L, U = bounds[k]
            u_frac = unres[f][k] / max(1, done)
            cells = []
            for m in MODELS:
                r = res[f][m][k]
                med = median_nan(r)
                if med != med:
                    mark, ok = "nan", False
                elif med <= U:
                    ok = True
                    if med < L:
                        mark = "u" if u_frac >= 0.5 else "<"
                    else:
                        mark = "ok"
                else:
                    mark, ok = "X", False
                passing[m].append(ok)
                cells.append("%5.2f [%4.1f-%4.1f]%-2s" % (100 * med, 100 * pct(r, 0.05),
                                                         100 * pct(r, 0.95), mark)
                             if med == med else "%13s" % "nan")
            print("  %3d %6d %5d %5.2f %5.2f | " % (k, bn["n_lo"], nk, 100 * L, 100 * U)
                  + " | ".join(cells))
        print("  bins passed: " + ", ".join("%s %d/%d" % (m, sum(passing[m]), len(bins)) for m in MODELS))
        # the pick (§4): fewest parameters passing every bin; CK fallback; else range
        pick = None
        for m in ("C0", "C1", "C2"):
            if all(passing[m]) and not full[f][m][1].get("refused"):
                pick = m
                break
        if pick is None and all(passing["CK"]):
            pick = "CK"
        if a.picks and f in a.picks:
            # A DECLARED pick, for re-running the in-sample sections (§5.4,
            # §5.5) with the picks the 200-seed run made, without paying the
            # 200 seeds again. Disclosed; never a selection.
            print("  PICK %s: rule says %s; OVERRIDDEN to %s by --picks (in-sample re-run)"
                  % (f, pick, a.picks[f]))
            pick = a.picks[f]
        if pick is None:
            ok_bins = [bn for bn, ok in zip(bins, passing["CK"]) if ok]
            holes = [bn for bn, ok in zip(bins, passing["CK"]) if not ok]
            picks[f] = {"model": "CK", "partial": True,
                        "range": (ok_bins[0]["n_lo"], ok_bins[-1]["n_hi"]) if ok_bins else None,
                        "holes": [(bn["n_lo"], bn["n_hi"]) for bn in holes]}
            print("  PICK %s: no candidate passes every bin (E1). CK passes %d/%d bins; holes at %s"
                  % (f, len(ok_bins), len(bins), picks[f]["holes"]))
        else:
            picks[f] = {"model": pick, "partial": False,
                        "range": (bins[0]["n_lo"], bins[-1]["n_hi"]), "holes": []}
            print("  PICK %s: %s passes every bin -> calibrated %d..%d tokens"
                  % (f, pick, bins[0]["n_lo"], bins[-1]["n_hi"]))
            if pick == "C2" and full[f]["C2"][1].get("turn_inside"):
                print("  E3: C2's turning point (N=%.0f) is inside the range — disclosed"
                      % full[f]["C2"][1]["turn_N"])

    # 4. the shipped bands beside the pick, on the bins they cover (§5.4)
    print("\nSHIPPED BANDS BESIDE THE PICK (§5.4): per bin inside a band — the band's shipped constant "
          "IN-SAMPLE over the bin's items, beside the picked curve's HELD-OUT median over the seeds "
          "(two kinds of rate; the like-for-like held-out comparison is the E2 block)")
    key_of = {"mattr": "mattr_min", "fwr": "function_word_ratio_max",
              "anaphora": "anaphora_max", "cv": "line_length_cv_min",
              "predictability": "predictable_pair_fraction_max"}
    for name, (lo, hi, thr) in band_thr.items():
        print("  band %s %d-%d:" % (name, lo, hi))
        for bn in bins:
            if bn["n_lo"] < lo or bn["n_hi"] > hi:
                continue
            k = bn["k"]
            sub = by_bin[k]
            cells = []
            for f in checks:
                if key_of[f] not in thr:
                    cells.append("%-14s" % ("%s: absent" % f))
                    continue
                t = thr[key_of[f]]
                defined = sum(1 for r in sub if r[f] == r[f])
                rate = flags(sub, f, lambda x, t=t: t) / defined if defined else float("nan")
                m = picks[f]["model"]
                cells.append("%s: band %.2f curve %.2f" % (f, 100 * rate, 100 * median_nan(res[f][m][k])))
            print("    bin %d (N %d-%d): " % (k, bn["n_lo"], bn["n_hi"]) + "; ".join(cells))

    # 4a. E2 AS DECLARED: held-out union vs held-out union, same seeds, on the
    # whole bins inside each band; the band's thresholds are re-read from the
    # calibration half inside the band on every seed (the band cell's own
    # protocol), the curves from the calibration half over the whole corpus.
    model_of = {f: picks[f]["model"] for f in checks}
    print("\nE2 (held-out, §6): union on the band's own bins — the band's thresholds vs the picked curves, "
          "%d seeds, median [5th-95th]" % done)
    for name, (lo, hi, _thr) in band_thr.items():
        keys = {bn["k"] for bn in bins if bn["n_lo"] >= lo and bn["n_hi"] <= hi}
        if not keys:
            continue
        ub = union_rate(flag_sets, held_ids, rows, bins, {f: "band:" + name for f in checks}, keys)
        uc = union_rate(flag_sets, held_ids, rows, bins, model_of, keys)
        print("  band %s %d-%d (bins %s): ANY band %.2f%% [%.2f-%.2f]  ANY curves %.2f%% [%.2f-%.2f]  difference %+.2f points; E2 fires over +2%s"
              % (name, lo, hi, sorted(keys), 100 * median_nan(ub), 100 * pct(ub, 0.05), 100 * pct(ub, 0.95),
                 100 * median_nan(uc), 100 * pct(uc, 0.05), 100 * pct(uc, 0.95),
                 100 * (median_nan(uc) - median_nan(ub)),
                 "  — E2 FIRES" if median_nan(uc) - median_nan(ub) > 0.02 else ""))
    # PER-CHECK OVERALL HELD-OUT RATE for the picked model — what
    # `Profile.held_out_fpr` carries (median, 5th, 95th of seeds, as %).
    print("\nHELD-OUT RATE PER CHECK, picked model, over ALL held-out items (median [5th-95th] of seeds) — "
          "the `held_out_fpr` row a profile ships:")
    all_keys = {bn["k"] for bn in bins}
    for f in checks:
        m = picks[f]["model"]
        rates = []
        for fs, hid in zip(flag_sets, held_ids):
            defined = [r for r in rows if r["i"] in hid and r[f] == r[f]]
            if not defined:
                continue
            rates.append(len(fs.get((f, m), set())) / len(defined))
        print("  %-14s %s  %.2f%% [%.2f-%.2f]  -> (%.2f, %.2f, %.2f)"
              % (f, m, 100 * median_nan(rates), 100 * pct(rates, 0.05), 100 * pct(rates, 0.95),
                 100 * median_nan(rates), 100 * pct(rates, 0.05), 100 * pct(rates, 0.95)))

    print("\nHELD-OUT UNION PER BIN (picked curves, median over seeds):")
    for bn in bins:
        u = union_rate(flag_sets, held_ids, rows, bins, model_of, {bn["k"]})
        print("  bin %2d (N %5d-%5d): ANY %.2f%% [%.2f-%.2f]" % (bn["k"], bn["n_lo"], bn["n_hi"],
              100 * median_nan(u), 100 * pct(u, 0.05), 100 * pct(u, 0.95)))
    u = union_rate(flag_sets, held_ids, rows, bins, model_of, {bn["k"] for bn in bins})
    print("  overall held-out ANY %.2f%% [%.2f-%.2f]" % (100 * median_nan(u), 100 * pct(u, 0.05), 100 * pct(u, 0.95)))

    # 4b. E2: the UNION on the bins a shipped band covers — the band's own
    # thresholds against the picked curves, both in-sample on the same items,
    # so the comparison is like for like (the band's banked union is held-out
    # and is quoted beside it in the results, not here).
    print("\nE2 — UNION ON THE BAND'S OWN BINS (in-sample, same items): band thresholds vs picked curves")
    for name, (lo, hi, thr) in band_thr.items():
        items = [r for bn in bins if bn["n_lo"] >= lo and bn["n_hi"] <= hi for r in by_bin[bn["k"]]]
        if not items:
            continue
        band_hit = curve_hit = 0
        for r in items:
            b = c = False
            for f in checks:
                v = r[f]
                if v != v:
                    continue
                if key_of[f] in thr:
                    t = thr[key_of[f]]
                    if (v < t) if SIDE[f] == "lo" else (v > t):
                        b = True
                m = picks[f]["model"]
                t2 = full[f][m][0](r["x"])
                if (v < t2) if SIDE[f] == "lo" else (v > t2):
                    c = True
            band_hit += b
            curve_hit += c
        print("  band %s %d-%d: %d items in whole bins inside it; ANY band %.2f%%  ANY curves %.2f%%  (difference %+.2f points; E2 fires over +2)"
              % (name, lo, hi, len(items), 100 * band_hit / len(items), 100 * curve_hit / len(items),
                 100 * (curve_hit - band_hit) / len(items)))

    # 5. union per bin, picked set, on the full-corpus curves (in-sample) and held-out
    print("\nUNION (§5.5): per bin, %% of items flagged by ANY picked curve (full-corpus fit, in-sample)")
    tot_hit = 0
    for bn in bins:
        sub = by_bin[bn["k"]]
        hit = 0
        for r in sub:
            fired = False
            for f in checks:
                m = picks[f]["model"]
                curve = full[f][m][0]
                v = r[f]
                if v != v:
                    continue
                t = curve(r["x"])
                if (v < t) if SIDE[f] == "lo" else (v > t):
                    fired = True
                    break
            hit += fired
        tot_hit += hit
        print("  bin %2d (N %5d-%5d): ANY %.2f%%" % (bn["k"], bn["n_lo"], bn["n_hi"], 100 * hit / len(sub)))
    print("  overall ANY %.2f%% over %d items" % (100 * tot_hit / len(rows), len(rows)))

    # derived limits (§4)
    print("\nDERIVED LIMITS (§4):")
    for f in checks:
        p = picks[f]
        print("  %-14s %s%s  range %s  holes %s"
              % (f, p["model"], " (partial)" if p["partial"] else "", p["range"], p["holes"] or "none"))
    full_pass = [f for f in checks if not picks[f]["partial"]]
    print("  every check passes every bin: %s" % ("YES" if len(full_pass) == len(checks) else "NO — " + ", ".join(f for f in checks if picks[f]["partial"])))
    print("\nSHIPPABLE PICKS (full-corpus fit):")
    for f in checks:
        m = picks[f]["model"]
        if m == "CK":
            print("  %-14s CK knots (ln N, q), FULL precision — what a profile row must carry: %s"
                  % (f, ", ".join("(%r, %r)" % k for k in full[f]["CK"][1]["knots"])))
        else:
            print("  %-14s %s coef (in ln N), FULL precision — what a profile row must carry: [%s]"
                  % (f, m, ", ".join("%r" % c for c in full[f][m][1]["coef"])))


# ---------------------------------------------------------------------------
# check: the shipped row re-derives from the corpus (the meter_bands /
# capacity / song_profile_calibration --check pattern, M-239)
# ---------------------------------------------------------------------------

SHIPPED_MODEL = {"mattr": "C1", "fwr": "C2", "anaphora": "C2", "cv": "C2",
                 "predictability": "CK"}
KEY_OF = {"mattr": "mattr_min", "fwr": "function_word_ratio_max",
          "anaphora": "anaphora_max", "cv": "line_length_cv_min",
          "predictability": "predictable_pair_fraction_max"}
REL_TOL = 1e-6


def cmd_check(a):
    from quality import floor as FL
    lyric = [p for p in FL.PROFILES if p.curves and p.n_lines == 0]
    if not lyric:
        print("CANNOT TELL: no lyric-sheet profile carries curves")
        sys.exit(2)
    prof = lyric[0]
    if a.rows:
        rows = read_rows(a.rows)
        print("ROWS  from %d file(s): %d items" % (len(a.rows), len(rows)))
    else:
        cache = C.PredictabilityCache(a.cache_path, enabled=True).open()
        cache.report()
        rs, _ = C.population(scorer=C.Scorer(cache), with_predictability=True,
                             pred_max_tokens=None)
        cache.flush()
        import tempfile
        tmp = os.path.join(tempfile.gettempdir(), "length_curve_check_rows.tsv")
        with open(tmp, "w", encoding="utf-8") as fh:
            fh.write("\t".join(ROW_FIELDS) + "\n")
            for r in rs:
                fh.write("\t".join(
                    str(r[k]) if k in ("file", "author", "title", "n_lines", "n_tokens")
                    else repr(float(r[k])) for k in ROW_FIELDS) + "\n")
        rows = read_rows([tmp])
        print("ROWS  computed: %d items (memo hits %d, misses %d)" % (len(rows), cache.hits, cache.misses))
    if len(rows) != prof.n_human:
        print("MOVED: the corpus holds %d items, the row was fit on %d — the "
              "population moved, so every curve is a different population's "
              "(doctrine 58); re-run the cell and re-adopt as a set"
              % (len(rows), prof.n_human))
        sys.exit(1)
    bins = make_bins(rows)
    moved = []
    for f, m in SHIPPED_MODEL.items():
        key = KEY_OF[f]
        shipped = prof.curves.get(key)
        # TWO STARTS, exactly as the banked run fit the shipped row (§3 of
        # the preregistration): the pinball objective is flat near its
        # optimum, so the knot start and the zero start land within 1e-7 in
        # loss and ~1e-3 apart in coefficients, and a check that ran one
        # start would report the OTHER optimum as drift.
        cv, _ = curves_for(rows, bins, f, two_starts=True)
        if m == "CK":
            got = cv["CK"][1]["knots"]
            ok = (isinstance(shipped, dict) and len(shipped["knots"]) == len(got)
                  and all(abs(x - gx) <= 1e-9 and abs(q - gq) <= 1e-9
                          for (x, q), (gx, gq) in zip(sorted(shipped["knots"]), got)))
            print("  %-14s CK  shipped %d knots, re-derived %d  -> %s"
                  % (f, len(shipped["knots"]) if isinstance(shipped, dict) else -1, len(got),
                     "HOLDS" if ok else "MOVED"))
        else:
            got = cv[m][1]["coef"]
            ok = (isinstance(shipped, tuple) and len(shipped) == len(got)
                  and all(abs(a_ - b_) <= REL_TOL * max(1.0, abs(a_)) for a_, b_ in zip(shipped, got)))
            print("  %-14s %s  shipped [%s]  re-derived [%s]  -> %s"
                  % (f, m, ", ".join("%r" % c for c in shipped) if shipped else "-",
                     ", ".join("%r" % c for c in got), "HOLDS" if ok else "MOVED"))
        if not ok:
            moved.append(f)
    if moved:
        print("RESULT: MOVED — %s. Argue it and repin as a SET; do not tune (doctrine 58)."
              % ", ".join(moved))
        sys.exit(1)
    print("RESULT: HOLDS — the lyric row's %d curves re-derive from the corpus" % len(SHIPPED_MODEL))


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    c = sub.add_parser("compute")
    c.add_argument("--out", required=True)
    c.add_argument("--shard", default=None, help="I/K: every K-th file starting at I (1-based)")
    c.add_argument("--without-predictability", action="store_true")
    c.add_argument("--cache-path", default=C.DEFAULT_CACHE)
    c.set_defaults(fn=cmd_compute)
    f = sub.add_parser("fit")
    f.add_argument("rows", nargs="+")
    f.add_argument("--seeds", type=int, default=200)
    f.add_argument("--checks", default="mattr,fwr,anaphora,cv,predictability")
    f.add_argument("--picks", default=None,
                   help="check=MODEL,... — force the picks for the in-sample sections (disclosed)")
    f.set_defaults(fn=cmd_fit)
    k = sub.add_parser("check")
    k.add_argument("--rows", nargs="*", default=None, help="saved row TSVs; omit to compute from the corpus")
    k.add_argument("--cache-path", default=C.DEFAULT_CACHE)
    k.set_defaults(fn=cmd_check)
    m = sub.add_parser("merge-cache")
    m.add_argument("shards", nargs="+")
    m.add_argument("--into", required=True)
    m.set_defaults(fn=cmd_merge_cache)
    a = ap.parse_args()
    if getattr(a, "picks", None):
        a.picks = dict(kv.split("=") for kv in a.picks.split(","))
    a.fn(a)


if __name__ == "__main__":
    main()
