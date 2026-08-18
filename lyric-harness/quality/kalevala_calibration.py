#!/usr/bin/env python3
"""The Kalevala alliteration calibration — phase 2, run 1.

Protocol: quality/KALEVALA_ALLITERATION_PREREGISTRATION.md, committed
before any number below existed. Measures, over the CONSTRAINED Finnish
corpus (Kalevala + both Kanteletar volumes), which alliterating choices
are the cheap reflexes — against TWO nulls (seeded within-item random
pairing; the nine later-Finnish rhymed-verse files), with the tier-1
same-stem candidate read off the shared-prefix distribution and the
tier-2 conditional built under split-half discipline.

ONE READER: quality.structures.judge("kalevala-alliteration", a, b,
phon=fin) — the grader's own routing on the language's own phonology
(doctrines 45/48). Three verdict counts per arm, never summed
(doctrine 79).

Run:  python3 quality/kalevala_calibration.py            (the measurement)
      python3 quality/kalevala_calibration.py --check    (re-derive E1)
"""

import collections
import glob
import os
import random
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
sys.path.insert(0, ROOT)
sys.path.insert(0, os.path.join(ROOT, ".."))

import lyric_harness as LH                              # noqa: E402
from quality import structures as ST                    # noqa: E402
from quality import phonology as PH                     # noqa: E402
from quality.structure_census import items_of           # noqa: E402
from quality.phonology.fin import _tokens as fin_tokens  # noqa: E402

ROW = "kalevala-alliteration"
SEED = 20260818
RESAMPLES = 200


def arms():
    con = [os.path.join(ROOT, "corpus", "fin_kalevala.txt"),
           os.path.join(ROOT, "corpus", "song", "fin_kanteletar.txt"),
           os.path.join(ROOT, "corpus", "song",
                        "fin_kanteletar_uudempia.txt")]
    inc = sorted(f for f in glob.glob(
        os.path.join(ROOT, "corpus", "song", "fin_*.txt"))
        if "kanteletar" not in os.path.basename(f))
    return con, inc


class Judge:
    def __init__(self):
        self.phon = PH.get("fin")
        self.memo = {}

    def __call__(self, a, b):
        key = (a, b) if a <= b else (b, a)
        if key not in self.memo:
            self.memo[key] = ST.judge(ROW, key[0], key[1], phon=self.phon)
        return self.memo[key]


def item_words(item):
    """-> per-line lowercased token lists for one item.

    THE TOKENIZER IS THE FIN PHONOLOGY'S OWN `_tokens` — the definition
    `kalevala_rate.py` already imports. The first run of this instrument
    used `lyric_harness.line_tokens`, whose ASCII `[A-Za-z'-]+` class the
    record already documents SPLITTING accented words (`ceäre` -> `re`) —
    and Finnish is full of ä/ö, so the tier-2 table's own head convicted
    it: `inen`, `isen`, `in` at the top are suffix FRAGMENTS, not words.
    Doctrine 1 in its purest form: the right definition existed, one
    module respelled it. That run's numbers are VOID working notes; only
    post-fix numbers are quotable."""
    out = []
    for line in item:
        toks = [t.lower() for t in fin_tokens(line)]
        if toks:
            out.append(toks)
    return out


def measure_arm(paths, judge):
    """Observed within-line rate over an arm. -> (counts, items_data)
    counts = [n_pairs, n_true, n_false, n_refused]; items_data keeps each
    item's lines for the null and the conditional."""
    counts = [0, 0, 0, 0]
    items_data = []
    for p in paths:
        for item in items_of(p):
            lines = item_words(item)
            if not lines:
                continue
            items_data.append((os.path.basename(p), lines))
            for toks in lines:
                for i in range(len(toks)):
                    for j in range(i + 1, len(toks)):
                        v = judge(toks[i], toks[j])
                        counts[0] += 1
                        counts[1 if v else (3 if v is None else 2)] += 1
    return counts, items_data


def rate(counts):
    judged = counts[1] + counts[2]
    return counts[1] / judged if judged else None


def null_a(items_data, judge, resamples=RESAMPLES, seed=SEED):
    """Seeded within-item random pairing, count-matched per item. The
    judge's verdict depends only on the two words, so random cross-line
    pairing from the item's own vocabulary estimates the permutation
    null's pair-level rate; memoised verdicts are shared across
    resamples (the registration's stated estimator)."""
    rng = random.Random(seed)
    rates = []
    for _ in range(resamples):
        t = f = 0
        for _, lines in items_data:
            words = [w for toks in lines for w in toks]
            if len(words) < 2:
                continue
            n_obs = sum(len(toks) * (len(toks) - 1) // 2 for toks in lines)
            for _ in range(n_obs):
                a, b = rng.sample(words, 2)
                v = judge(a, b)
                if v is True:
                    t += 1
                elif v is False:
                    f += 1
        rates.append(t / (t + f) if (t + f) else 0.0)
    rates.sort()
    return rates


def true_pairs(items_data, judge):
    """Every TRUE within-line pair of an arm, with its item index — the
    tier-1 and tier-2 populations."""
    out = []
    for idx, (_, lines) in enumerate(items_data):
        for toks in lines:
            for i in range(len(toks)):
                for j in range(i + 1, len(toks)):
                    if judge(toks[i], toks[j]) is True:
                        out.append((idx, toks[i], toks[j]))
    return out


def shared_prefix_len(a, b):
    n = 0
    for ca, cb in zip(a, b):
        if ca != cb:
            break
        n += 1
    return n


def tier1_distribution(pairs):
    """Shared-prefix length distribution over TRUE pairs — the same-stem
    free ride is separable mass at high k, or tier 1 is REFUSED (E3)."""
    dist = collections.Counter(shared_prefix_len(a, b) for _, a, b in pairs)
    return dict(sorted(dist.items()))


def tier2_conditional(pairs, n_items, seed=SEED):
    """Split-half: the conditional P(partner | call) derived on one seeded
    half of the ITEMS, blocked-mass measured on the other half at k=6
    (and the largest k the table supports where 6 lacks support)."""
    rng = random.Random(seed)
    idxs = list(range(n_items))
    rng.shuffle(idxs)
    half = set(idxs[:n_items // 2])
    table = collections.defaultdict(collections.Counter)
    held = collections.defaultdict(collections.Counter)
    for idx, a, b in pairs:
        (table if idx in half else held)[a][b] += 1
        (table if idx in half else held)[b][a] += 1
    blocked = total = 0
    covered_types = 0
    for call, partners in held.items():
        top = {w for w, _ in table[call].most_common(6)}
        if table[call]:
            covered_types += 1
        for w, n in partners.items():
            total += n
            if w in top:
                blocked += n
    return {
        "derive_items": len(half), "held_items": n_items - len(half),
        "held_call_types": len(held), "covered_call_types": covered_types,
        "blocked": blocked, "total": total,
        "blocked_mass": blocked / total if total else None,
        "head": {call: table[call].most_common(3)
                 for call in list(sorted(
                     table, key=lambda c: -sum(table[c].values())))[:5]},
    }


def main(check=False):
    judge = Judge()
    con_paths, inc_paths = arms()
    con, con_items = measure_arm(con_paths, judge)
    inc, inc_items = measure_arm(inc_paths, judge)
    r_con, r_inc = rate(con), rate(inc)
    print(f"CONSTRAINED  pairs {con[0]:,}  true {con[1]:,}  false "
          f"{con[2]:,}  refused {con[3]:,}  rate {r_con:.4f}")
    print(f"INCIDENTAL   pairs {inc[0]:,}  true {inc[1]:,}  false "
          f"{inc[2]:,}  refused {inc[3]:,}  rate {r_inc:.4f}")
    nulls = null_a(con_items, judge)
    ge = sum(1 for x in nulls if x >= r_con)
    print(f"NULL A (within-item random pairing, {RESAMPLES} resamples, "
          f"seed {SEED}): median {nulls[len(nulls)//2]:.4f}  "
          f"max {nulls[-1]:.4f}  p = {(ge + 1)/(RESAMPLES + 1):.4f}")
    e1 = (r_con > nulls[-1]) and (r_con > r_inc)
    print(f"E1: constrained {r_con:.4f} vs null-A max {nulls[-1]:.4f} "
          f"and incidental {r_inc:.4f} -> {'PASS' if e1 else 'FAIL'}")
    if check:
        return 0 if e1 else 1
    pairs = true_pairs(con_items, judge)
    print(f"\nTRUE constrained pairs: {len(pairs):,}")
    dist = tier1_distribution(pairs)
    n = sum(dist.values())
    print("TIER 1 — shared-prefix length over TRUE pairs "
          "(k : count : cumulative-from-top):")
    cum = 0
    for k in sorted(dist, reverse=True):
        cum += dist[k]
        if dist[k] and (k <= 2 or dist[k] / n > 0.001 or k > 5):
            print(f"  k={k:2d}  {dist[k]:8,}  {dist[k]/n:7.2%}  "
                  f"cum>={k}: {cum/n:7.2%}")
    t2 = tier2_conditional(pairs, len(con_items))
    print(f"\nTIER 2 — split-half conditional (derive {t2['derive_items']} "
          f"items, hold {t2['held_items']}):")
    print(f"  held call types {t2['held_call_types']:,}, with table "
          f"support {t2['covered_call_types']:,}")
    print(f"  blocked mass at k=6: {t2['blocked']:,}/{t2['total']:,} = "
          f"{t2['blocked_mass']:.1%}")
    print("  table head (call: top partners):")
    for call, tops in t2["head"].items():
        print(f"    {call}: {tops}")
    return 0


if __name__ == "__main__":
    sys.exit(main(check="--check" in sys.argv[1:]))
