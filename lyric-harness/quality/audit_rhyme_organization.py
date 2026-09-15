#!/usr/bin/env python3
"""Reproduce the frozen L-1/L-2 redesign controls; no rebaselining or fitting.

Run: python3 quality/audit_rhyme_organization.py --check --out=RESULT.json
Use --synthetic-only for the population-independent controls alone.
"""

import argparse
import hashlib
import json
import math
import os
import random
import sys
from dataclasses import replace
from pathlib import Path

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from lyric_harness import Lexicon  # noqa: E402
from quality.corpus import load_sonnets  # noqa: E402
from quality.rhyme_organization import (OrganizationDeclaration, STRATA,  # noqa: E402
                                        WordGraph, analyze_graph, layout)

SEEDS = (20260915, 20260916)


def synthetic():
    """Distinct internal pairs and end couplets; no comparator-derived labels."""
    lengths = [8] * 14
    a = np.zeros((sum(lengths), sum(lengths)), dtype=np.int8)
    for i in range(14):
        x, y = i * 8, i * 8 + 1
        a[x, y] = a[y, x] = 1
    for i in range(0, 14, 2):
        x, y = i * 8 + 7, (i + 1) * 8 + 7
        a[x, y] = a[y, x] = 1
    return a, lengths


def shuffled(a, lengths, rng, positive=False):
    """Twins preserve word occurrence roles, including unknown relations."""
    _, pools = layout(lengths)
    order = np.arange(sum(lengths))
    if positive:
        # Permute whole adjacent-line couplets, then words WITHIN each line's
        # interior. Planted relations remain in the declared neighborhoods.
        blocks = list(range(len(lengths) // 2))
        rng.shuffle(blocks)
        order = np.array([i for b in blocks for i in range(b * 16, b * 16 + 16)])
        for start in range(0, len(order), 8):
            local = list(order[start:start + 7])
            rng.shuffle(local)
            order[start:start + 7] = local
    else:
        for pool in pools.values():
            draw = pool[:]
            rng.shuffle(draw)
            order[pool] = draw
    return a[np.ix_(order, order)]


def binomial_upper(k, n, p):
    """P[X >= k] with a stable log-sum; no normal approximation to rare tails."""
    if k == 0:
        return 1.0
    terms = [math.lgamma(n + 1) - math.lgamma(i + 1) - math.lgamma(n - i + 1)
             + i * math.log(p) + (n - i) * math.log1p(-p)
             for i in range(k, n + 1)]
    top = max(terms)
    return min(1.0, math.exp(top) * sum(math.exp(v - top) for v in terms))


def summarize_arm(rows):
    n = len(rows)
    hits = sum(r["any_discovery"] for r in rows)
    return dict(n=n, any_discoveries=hits, family_rate=hits / n,
                null_excess_tail=binomial_upper(hits, n, 0.05),
                strata={s: dict(
                    discoveries=sum(r["strata"][s]["discovery"] for r in rows),
                    tested=sum(r["strata"][s]["status"] == "tested" for r in rows),
                    refused=sum(r["strata"][s]["status"] != "tested" for r in rows),
                    detection_rate=sum(r["strata"][s]["discovery"] for r in rows) / n,
                ) for s in STRATA})


def run_synthetic():
    a, lengths = synthetic()
    output = []
    for seed in SEEDS:
        rng = random.Random(seed)
        arms = {}
        for label, count, positive in (("null", 1000, False), ("positive", 100, True)):
            rows = []
            for i in range(count):
                d = OrganizationDeclaration(seed=seed * 10000 + i + (2000 if positive else 0))
                rows.append(analyze_graph(shuffled(a, lengths, rng, positive), lengths, d))
            arms[label] = summarize_arm(rows)
            print(f"synthetic seed={seed} {label}: {arms[label]}", file=sys.stderr, flush=True)
        output.append(dict(seed=seed, **arms))
    return output


def run_corpus():
    graph = WordGraph(Lexicon())
    rows, real_results, twins = [], [], []
    for number, lines in sorted(load_sonnets().items()):
        if number <= 30:
            continue
        a, lengths, words = graph.build(lines)
        d = OrganizationDeclaration(seed=20260915 + number)
        real = analyze_graph(a, lengths, d)
        real_results.append(real)
        rng = random.Random(20260916 + number)
        null_rows = []
        for replicate in range(4):
            twin = analyze_graph(shuffled(a, lengths, rng), lengths,
                                 replace(d, seed=20260917 + number * 4 + replicate))
            twins.append(twin)
            null_rows.append(twin)
        rows.append(dict(sonnet=number, tokens=len(words),
                         unreadable_occurrences=sum(graph.lex.transcribe_word(w)[1] for w in words),
                         text_sha256=hashlib.sha256("\n".join(lines).encode()).hexdigest(),
                         real=real, scrambled=null_rows))
        if len(rows) % 10 == 0:
            print(f"corpus: {len(rows)} items evaluated", file=sys.stderr, flush=True)
    return dict(real=summarize_arm(real_results), scrambled=summarize_arm(twins), items=rows)


def gates(result):
    failures = []
    for row in result["synthetic"]:
        if row["null"]["null_excess_tail"] < 0.01:
            failures.append(f"synthetic false discovery rate, seed {row['seed']}")
        for s in STRATA:
            if row["positive"]["strata"][s]["detection_rate"] < 0.8:
                failures.append(f"synthetic {s} power, seed {row['seed']}")
    if "corpus" in result:
        c = result["corpus"]
        if c["scrambled"]["null_excess_tail"] < 0.01:
            failures.append("scrambled-sonnet false discovery rate")
        real = c["real"]["strata"]["end"]["detection_rate"]
        null = c["scrambled"]["strata"]["end"]["detection_rate"]
        if real < 0.5 or real - null < 0.3:
            failures.append("real-versus-scrambled end organization separation")
    return failures


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--synthetic-only", action="store_true")
    parser.add_argument("--out", type=Path)
    args = parser.parse_args(argv)
    result = dict(preregistration="RHYME_EVENTS_PREREGISTRATION.md", synthetic=run_synthetic())
    if not args.synthetic_only:
        result["corpus"] = run_corpus()
    result["failures"] = gates(result)
    result["scope"] = "organization per item/stratum; no certified individual events or timing"
    if args.out:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(json.dumps(result, sort_keys=True, indent=2) + "\n")
    print(json.dumps({k: v for k, v in result.items() if k != "corpus"}, indent=2))
    if "corpus" in result:
        print(json.dumps({k: v for k, v in result["corpus"].items() if k != "items"}, indent=2))
    return int(bool(args.check and result["failures"]))


if __name__ == "__main__":
    sys.exit(main())
