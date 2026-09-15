#!/usr/bin/env python3
"""Test rhyme organization, not the significance of individual rhyme edges.

Run: python3 quality/rhyme_organization.py FILE [--permutations=999]
The preregistration fixes the two hypotheses, their nulls and acceptance gates.
This is an offline research instrument; the songwriting path does not run it.
"""

import argparse
import json
import math
import os
import random
import sys
from dataclasses import asdict, dataclass, replace
from itertools import combinations

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from lyric_harness import (Declaration, Lexicon, RHYME_RELATIONS,  # noqa: E402
                           fold_apostrophes, line_tokens)
from quality.rhyme_types import coarse_relation_consensus  # noqa: E402

STRATA = ("internal", "end")


@dataclass(frozen=True)
class OrganizationDeclaration:
    alpha: float = 0.05
    n_perm: int = 999
    seed: int = 20260915
    end_window: int = 4
    theta: float = 0.80

    def __post_init__(self):
        for name in ("alpha", "theta"):
            v = getattr(self, name)
            if isinstance(v, bool) or not isinstance(v, (int, float)) or not math.isfinite(v):
                raise ValueError(f"{name} must be finite")
        if not 0 < self.alpha < 1 or not 0 <= self.theta <= 1:
            raise ValueError("alpha must be in (0,1) and theta in [0,1]")
        for name, minimum in (("n_perm", 1), ("end_window", 1), ("seed", 0)):
            v = getattr(self, name)
            if type(v) is not int or v < minimum:
                raise ValueError(f"{name} must be an integer >= {minimum}")


def layout(lengths, end_window=4):
    """Fixed slot comparisons and exchangeability pools; no phonology read."""
    if any(type(n) is not int or n < 1 for n in lengths):
        raise ValueError("line lengths must be positive integers")
    lines, start = [], 0
    for n in lengths:
        lines.append(list(range(start, start + n)))
        start += n
    finals = [line[-1] for line in lines]
    internal = [i for line in lines for i in line[:-1]]
    # Each within-line pair has at least one internal member, since a line
    # has only one final slot. No end/end link enters the internal statistic.
    pairs = {
        "internal": [p for line in lines for p in combinations(line, 2)],
        "end": [(finals[i], finals[j]) for i in range(len(lines))
                for j in range(i + 1, min(len(lines), i + end_window + 1))],
    }
    return pairs, {"internal": internal, "end": finals}


def tail_p(observed, null):
    """Monte Carlo rank including the observation and ALL inclusive ties."""
    return (1 + sum(v >= observed for v in null)) / (len(null) + 1)


def summarize(observed, null, opportunities, unknown, declaration):
    """Keep descriptive edges, stratum discoveries and refusals distinct."""
    family = len(STRATA)  # never shrink this after seeing/refusing a stratum
    mean = sum(null) / len(null) if null else None
    out = dict(opportunities=opportunities, affirmed_edges=observed,
               unresolved_pairs=unknown, null_mean=mean,
               excess=observed - mean if mean is not None else None,
               null_min=min(null) if null else None,
               null_max=max(null) if null else None,
               p=None, p_adjusted=None, discovery=False, status="tested")
    reason = None
    if not opportunities:
        reason = "no comparison opportunities"
    elif family / (declaration.n_perm + 1) > declaration.alpha:
        reason = "insufficient permutation resolution for the full family"
    elif not null or min([observed, *null]) == max([observed, *null]):
        reason = "no statistic variation observed in this permutation sample"
    if reason:
        out.update(status="cannot_tell", refusal=reason)
        return out
    p = tail_p(observed, null)
    adjusted = min(1.0, family * p)
    out.update(p=p, p_adjusted=adjusted,
               discovery=adjusted <= declaration.alpha)
    return out


def analyze_graph(matrix, lengths, declaration=None):
    """Conditional randomization of an affirmed/absent/unresolved word graph.

    matrix[i,j] = 1 / 0 / -1. Unresolved is NOT a negative relation: its
    count is disclosed, it retains its position, and only affirmed edges
    enter the statistic. This API cannot return certified word positions.
    """
    d = declaration or OrganizationDeclaration()
    pairs, pools = layout(lengths, d.end_window)
    n = sum(lengths)
    a = np.asarray(matrix)
    if (a.shape != (n, n) or not np.isin(a, (-1, 0, 1)).all()
            or not np.array_equal(a, a.T) or np.any(np.diag(a) != 0)):
        raise ValueError("relation matrix must be symmetric -1/0/1 with a zero diagonal")
    affirmed = a == 1
    results = {}
    for index, name in enumerate(STRATA):
        edge = np.asarray(pairs[name], dtype=int).reshape((-1, 2))
        left, right = edge[:, 0], edge[:, 1]
        observed = int(affirmed[left, right].sum())
        unknown = int((a[left, right] == -1).sum())
        null = []
        if len(edge) and len(STRATA) / (d.n_perm + 1) <= d.alpha:
            rng = random.Random(2 * d.seed + index)
            pool = pools[name]
            for _ in range(d.n_perm):
                draw = pool[:]
                rng.shuffle(draw)  # independent uniform permutation; identity allowed
                order = np.arange(n)
                order[pool] = draw
                null.append(int(affirmed[order[left], order[right]].sum()))
        results[name] = summarize(observed, null, len(edge), unknown, d)
    return {
        "method": "conditional-rhyme-organization-v1",
        "unit": "item/stratum; individual rhyme edges are descriptive only",
        "error_control": "Bonferroni FWER per item under the declared exchangeability nulls",
        "family_size": len(STRATA), "declaration": asdict(d),
        "line_token_counts": list(lengths), "strata": results,
        "any_discovery": any(r["discovery"] for r in results.values()),
        "certified_positions": None,
        "temporal_inference": "unsupported; no timing or period is tested",
        "nulls": {
            "internal": "permute nonfinal occurrences; final words and line token counts fixed",
            "end": "permute final occurrences; nonfinal words and line token counts fixed",
        },
    }


class WordGraph:
    """Cache unordered token verdicts without choosing a favorable reading."""

    def __init__(self, lex, declaration=None, theta=0.80):
        self.lex = lex
        self.declaration = replace(declaration or Declaration(),
                                   admit=tuple(sorted(RHYME_RELATIONS)))
        self.theta = theta
        self.cache = {}

    def relation(self, a, b):
        if a == b:
            return 0  # repetitions stay present but cannot be a rhyme edge
        key = tuple(sorted((a, b)))
        if key not in self.cache:
            value = coarse_relation_consensus(
                self.lex, *key, self.declaration, min_score=self.theta)
            self.cache[key] = -1 if value is None else int(value)
        return self.cache[key]

    def build(self, lines):
        tokens, lengths = [], []
        for line in lines:
            words = [fold_apostrophes(w).lower() for w in
                     line_tokens(line, strip_parens=self.lex.strip_parens)]
            if not words:
                raise ValueError("each lyric line must contain at least one word")
            tokens.extend(words)
            lengths.append(len(words))
        a = np.zeros((len(tokens), len(tokens)), dtype=np.int8)
        for i, j in combinations(range(len(tokens)), 2):
            a[i, j] = a[j, i] = self.relation(tokens[i], tokens[j])
        return a, lengths, tokens

    def analyze(self, lines, declaration=None):
        d = declaration or OrganizationDeclaration(theta=self.theta)
        if d.theta != self.theta:
            raise ValueError("graph and test must use the same declared threshold")
        a, lengths, tokens = self.build(lines)
        result = analyze_graph(a, lengths, d)
        result["phonology"] = {
            "language": "eng", "pronunciations": "unanimous lexical-reading verdict",
            "scope": "affirmed relations only; unresolved pairs are not negative relations",
            "declaration": asdict(self.declaration),
            "strip_parens": self.lex.strip_parens,
        }
        result["tokens"] = tokens
        result["unreadable_occurrences"] = [
            i for i, word in enumerate(tokens) if self.lex.transcribe_word(word)[1]]
        return result


def main(argv=None):
    from quality.lyric_reader import lyric_items
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("file", help="one lyric item; collections must be separated first")
    parser.add_argument("--permutations", type=int, default=999)
    parser.add_argument("--seed", type=int, default=20260915)
    parser.add_argument("--alpha", type=float, default=0.05)
    parser.add_argument("--voices", action="store_true", help="retain parenthetical sung words")
    args = parser.parse_args(argv)
    try:
        d = OrganizationDeclaration(n_perm=args.permutations, seed=args.seed, alpha=args.alpha)
        items = list(lyric_items(args.file))
        if len(items) != 1:
            raise ValueError("supply exactly one lyric item; family control is per item")
        title, _, rows = items[0]
        result = WordGraph(Lexicon(strip_parens=not args.voices)).analyze(
            [row.text for row in rows], d)
        result["title"] = title
        print(json.dumps(result, ensure_ascii=False, sort_keys=True, indent=2))
        return 2 if all(r["status"] == "cannot_tell" for r in result["strata"].values()) else 0
    except (ValueError, OSError) as exc:
        print(json.dumps({"status": "cannot_tell", "refusal": str(exc)}))
        return 2


if __name__ == "__main__":
    sys.exit(main())
