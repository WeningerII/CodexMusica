#!/usr/bin/env python3
"""Discover the standing unittest suite, then deal its test IDs across CI.

No test name is maintained here. Discovery/loadTestsFromName is the same stdlib
loader used by `python -m unittest`; a shard selects a residue of its complete,
sorted ID inventory. The optional digest binds execution to the inventory the
outer CI fan-in expands. Module/class fixtures retain unittest's normal lifecycle
within each selected suite. No assertion or test body is changed.
"""
import argparse
import hashlib
import json
import sys
import time
import unittest
from pathlib import Path


def flatten(suite):
    for test in suite:
        if isinstance(test, unittest.TestSuite):
            yield from flatten(test)
        else:
            yield test


def inventory(args):
    # Imports must work when called either from the repo or lyric-harness/.
    root = Path(__file__).resolve().parents[1]
    sys.path.insert(0, str(root / 'lyric-harness'))
    loader = unittest.TestLoader()
    if args.module:
        suite = loader.loadTestsFromName(args.module)
    else:
        suite = loader.discover(args.start_directory, pattern=args.pattern)
    if loader.errors:
        raise ValueError('unittest discovery failed:\n' + '\n'.join(loader.errors))
    tests = sorted(flatten(suite), key=lambda test: test.id())
    ids = [test.id() for test in tests]
    if not ids or len(ids) != len(set(ids)):
        raise ValueError('unittest inventory is empty or contains duplicate test IDs')
    digest = hashlib.sha256(json.dumps(ids, separators=(',', ':')).encode()).hexdigest()
    return tests, ids, digest


class TimedResult(unittest.TextTestResult):
    def startTest(self, test):
        self._started = time.monotonic()
        super().startTest(test)

    def stopTest(self, test):
        self.stream.writeln(f'TEST COST {time.monotonic() - self._started:.3f}s {test.id()}')
        super().stopTest(test)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument('--start-directory')
    source.add_argument('--module')
    parser.add_argument('--pattern', default='test_*.py')
    parser.add_argument('--shard')
    parser.add_argument('--expect')
    parser.add_argument('--list-json', action='store_true')
    args = parser.parse_args(argv)
    try:
        tests, ids, digest = inventory(args)
        if args.expect and args.expect != digest:
            raise ValueError(f'unittest inventory differs: expected {args.expect}, found {digest}')
        k, n = 1, 1
        if args.shard:
            try:
                k, n = (int(x) for x in args.shard.split('/'))
            except ValueError:
                raise ValueError('--shard must be K/N with 1 <= K <= N') from None
            if not 1 <= k <= n:
                raise ValueError('--shard must be K/N with 1 <= K <= N')
        chosen = [test for i, test in enumerate(tests) if i % n == k - 1]
        if not chosen:
            raise ValueError(f'unittest shard {k}/{n} owns no test')
        if args.list_json:
            print(json.dumps({'ids': ids, 'sha256': digest, 'selected': [test.id() for test in chosen]}))
            return 0
        print(f'UNITTEST INVENTORY {digest}: {len(ids)} tests; shard {k}/{n} owns {len(chosen)}', flush=True)
        for test in chosen:
            print(f'  RUN {test.id()}', flush=True)
        result = unittest.TextTestRunner(verbosity=2, resultclass=TimedResult).run(unittest.TestSuite(chosen))
        if result.testsRun != len(chosen):
            print(f'ERROR: ran {result.testsRun} tests, expected {len(chosen)}', file=sys.stderr)
            return 1
        return 0 if result.wasSuccessful() else 1
    except (ImportError, OSError, ValueError) as error:
        print(f'run_unittest: {error}', file=sys.stderr)
        return 2


if __name__ == '__main__':
    sys.exit(main())
