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
from dataclasses import asdict, dataclass
from itertools import combinations

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from lyric_harness import (Declaration, Lexicon,  # noqa: E402
                           fold_apostrophes, line_tokens)
from quality.rhyme_types import coarse_relation_consensus  # noqa: E402

STRATA = ("internal", "end")


@dataclass(frozen=True)
class OrganizationDeclaration:
    alpha: float = 0.05
    n_perm: int = 999
    seed: int = 20260915
    end_window: int = 4
    end_statistic: str = "lag_max"

    def __post_init__(self):
        if self.end_statistic not in ("edge_count", "lag_max"):
            raise ValueError("end_statistic must be edge_count or lag_max")
        v = self.alpha
        if isinstance(v, bool) or not isinstance(v, (int, float)) or not math.isfinite(v):
            raise ValueError("alpha must be finite")
        if not 0 < self.alpha < 1:
            raise ValueError("alpha must be in (0,1)")
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


def summarize(observed, null, opportunities, unknown, declaration, raw_edges=None):
    """Keep descriptive edges, stratum discoveries and refusals distinct."""
    family = len(STRATA)  # never shrink this after seeing/refusing a stratum
    mean = sum(null) / len(null) if null else None
    out = dict(opportunities=opportunities, observed_statistic=observed,
               affirmed_edges=observed if raw_edges is None else raw_edges,
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
        lag_masks = []
        if name == "end" and d.end_statistic == "lag_max":
            final_line = {pos: i for i, pos in enumerate(pools["end"])}
            distances = np.array([final_line[y] - final_line[x] for x, y in edge])
            lag_masks = [distances == lag for lag in range(1, d.end_window + 1)]

        def statistic(values):
            # The identical search is inside every permutation. A maximum
            # compared to the null for ONE lag would manufacture discoveries.
            return (max(int(values[mask].sum()) for mask in lag_masks)
                    if lag_masks else int(values.sum()))

        raw_edges = int(affirmed[left, right].sum())
        observed = statistic(affirmed[left, right])
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
                null.append(statistic(affirmed[order[left], order[right]]))
        results[name] = summarize(observed, null, len(edge), unknown, d, raw_edges)
        results[name]["statistic"] = "max_edges_at_one_line_distance" if lag_masks else "edge_count"
    return {
        "method": "conditional-rhyme-organization-v2" if d.end_statistic == "lag_max" else "conditional-rhyme-organization-v1",
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
    """Token pairs typed by EVERY coarse relation they stand in.

    An edge may carry several relations at once (a perfect rhyme is also
    assonance and consonance). Each relation is decided at its own declared
    cut (`Declaration.theta_by_relation`) and must hold under every
    pronunciation reading (unanimity; a split is unresolved, never a guess).
    `relation()` is the "stands in any" view the organisation test reads;
    `relations()` and `build(relation=...)` give each relation its own graph.
    """

    def __init__(self, lex, declaration=None, relations=None):
        self.lex = lex
        self.declaration = declaration or Declaration()
        self.admitted = tuple(sorted(relations or self.declaration.admit))
        self.cache = {}

    def relations(self, a, b):
        """-> (held, unresolved): frozensets of the admitted relations the
        pair stands in under every reading, and those the readings split on
        or cannot read. A repeated word is typed as no sound relation."""
        if a == b:
            return frozenset(), frozenset()
        key = tuple(sorted((a, b)))
        if key not in self.cache:
            got = coarse_relation_consensus(
                self.lex, *key, self.declaration, per_relation=True)
            got = got if isinstance(got, dict) else {
                n: got for n in self.admitted}
            held = {n for n in self.admitted if got.get(n) is True}
            open_ = {n for n in self.admitted if got.get(n) is None}
            self.cache[key] = (frozenset(held), frozenset(open_))
        return self.cache[key]

    def relation(self, a, b, relation=None):
        """-> 1 when the pair stands in `relation` (default: ANY admitted
        relation), 0 when it does not, -1 when that cannot be told."""
        held, open_ = self.relations(a, b)
        if relation is not None:
            return 1 if relation in held else -1 if relation in open_ else 0
        return 1 if held else -1 if open_ else 0

    def build(self, lines, relation=None):
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
            a[i, j] = a[j, i] = self.relation(tokens[i], tokens[j], relation)
        return a, lengths, tokens

    def analyze(self, lines, declaration=None, relation=None):
        d = declaration or OrganizationDeclaration()
        a, lengths, tokens = self.build(lines, relation)
        result = analyze_graph(a, lengths, d)
        result["phonology"] = {
            "language": "eng", "pronunciations": "unanimous lexical-reading verdict",
            "scope": "affirmed relations only; unresolved pairs are not negative relations",
            "edge": (f"stands in {relation}" if relation else
                     "stands in ANY of " + ", ".join(self.admitted)),
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
    parser.add_argument("--end-statistic", choices=("edge_count", "lag_max"), default="lag_max")
    parser.add_argument("--voices", action="store_true", help="retain parenthetical sung words")
    args = parser.parse_args(argv)
    try:
        d = OrganizationDeclaration(n_perm=args.permutations, seed=args.seed, alpha=args.alpha,
                                    end_statistic=args.end_statistic)
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
