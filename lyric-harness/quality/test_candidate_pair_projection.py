"""Exact enumeration controls for pushing requested line pairs before span products."""
import dataclasses
import inspect
import os
import sys
import unittest
from unittest.mock import patch
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from quality import relations as R


@dataclasses.dataclass(frozen=True)
class Span:
    idx: tuple
    line: object

    def head(self):
        return self.idx[0]


def prior_enumerator(schema, layout, stream, a_keys, b_keys,
                     skip_line_pairs, tally=None, requested_line_pairs=None):
    """Frozen pre-pushdown enumerator, including its ordering and counters."""
    bucket_meta = {}
    need_line = bool(skip_line_pairs) or requested_line_pairs is not None
    for _, buckets in layout:
        for values in buckets:
            if id(values) not in bucket_meta:
                bucket_meta[id(values)] = [(b, b.head(),
                    R._span_line(b, stream) if need_line else None) for b in values]
    mirror_complete = a_keys == b_keys
    seen = set()
    for a, buckets in layout:
        a_head = a.head()
        la = R._span_line(a, stream) if need_line else None
        for v in buckets:
            for b, b_head, lb in bucket_meta[id(v)]:
                if requested_line_pairs is not None:
                    if (la is None or lb is None or la == lb or
                            (min(la, lb), max(la, lb)) not in requested_line_pairs):
                        continue
                if a.idx == b.idx or (a.idx, b.idx) in seen:
                    continue
                seen.add((a.idx, b.idx))
                reversed_pair = a_head > b_head
                if reversed_pair and (mirror_complete or R.mirrored(a, b, a_keys, b_keys)):
                    if tally is not None:
                        tally['deduplicated_candidates'] = tally.get('deduplicated_candidates', 0) + 1
                    continue
                if skip_line_pairs:
                    if (la != lb and la is not None and lb is not None
                            and (min(la, lb), max(la, lb)) in skip_line_pairs):
                        continue
                yield a, b, reversed_pair


def visited_pairs(function, *args, **kwargs):
    """Count real visits to the inner pair body without changing its behavior."""
    source, first = inspect.getsourcelines(function)
    body_line = first + next(i for i, line in enumerate(source)
                             if line.lstrip().startswith('for b, b_head, lb in ')) + 1
    visits = 0

    def trace(frame, event, _arg):
        nonlocal visits
        if frame.f_code is function.__code__ and event == 'line' and frame.f_lineno == body_line:
            visits += 1
        return trace

    original = sys.gettrace()
    sys.settrace(trace)
    try:
        result = list(function(*args, **kwargs))
    finally:
        sys.settrace(original)
    return result, visits


class RequestedPairPushdown(unittest.TestCase):
    def test_exact_sequence_tally_mirror_and_skip_parity(self):
        spans = [Span((i,), i // 2 if i != 7 else None) for i in range(8)]
        even, odd = spans[::2], spans[1::2]
        layout = [(a, [spans, even, spans, odd]) for a in spans]
        all_keys = {s.idx for s in spans}
        key_cases = [(all_keys, all_keys), (all_keys, {s.idx for s in even}),
                     ({s.idx for s in odd}, {s.idx for s in even})]
        requests = [None, set(), {(0, 1)}, {(0, 2), (1, 2)}, {(1, 0), (1, 1)}]
        skips = [None, {(0, 1)}, {(1, 2)}]
        with patch.object(R, '_span_line', side_effect=lambda s, _st: s.line):
            for a_keys, b_keys in key_cases:
                for request in requests:
                    for skip in skips:
                        before, after = {}, {}
                        args = (None, layout, None, a_keys, b_keys, skip)
                        expected = list(prior_enumerator(*args, tally=before, requested_line_pairs=request))
                        got = list(R._candidate_pairs(*args, tally=after, requested_line_pairs=request))
                        self.assertEqual(got, expected, (request, skip, a_keys, b_keys))
                        self.assertEqual(after, before)
                        self.assertEqual(list(R._candidate_pairs(*args, requested_line_pairs=request)), expected)

    def test_projected_query_avoids_unrequested_cartesian_visits(self):
        spans = [Span((i,), i // 4) for i in range(96)]
        layout = [(a, [spans]) for a in spans]
        keys = {s.idx for s in spans}
        args = (None, layout, None, keys, keys, None)
        with patch.object(R, '_span_line', side_effect=lambda s, _st: s.line):
            expected, old_visits = visited_pairs(prior_enumerator, *args, requested_line_pairs={(3, 14)})
            got, new_visits = visited_pairs(R._candidate_pairs, *args, requested_line_pairs={(3, 14)})
            self.assertEqual(got, expected)
            self.assertEqual(old_visits, 96 * 96)
            self.assertEqual(new_visits, 2 * 4 * 4)
            full_old, old_full_visits = visited_pairs(prior_enumerator, *args)
            full_new, new_full_visits = visited_pairs(R._candidate_pairs, *args)
            self.assertEqual(full_new, full_old)
            self.assertEqual(old_full_visits, new_full_visits)
        print(f'Projected inner-pair visits: {old_visits} -> {new_visits}; full-query visits unchanged.')


if __name__ == '__main__':
    unittest.main()
