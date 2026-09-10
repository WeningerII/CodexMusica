#!/usr/bin/env python3
"""Reduce the sharded production capacity matrix to one complete record.

WHY THIS EXISTS. `check_lyrics_capacity.py` measures a container pinned to
1 CPU and 2 GiB -- the deployed service's envelope -- across 3 workloads x
3 seeds x 2 modes. Run as ONE container that is 18 executions in series, and
it was the largest single step in CI: 35.6 minutes of a 54.5-minute run,
measured on run 34358366237, with the whole `lyrics-image` job (53.2 min)
being the critical path by itself.

`--cpus=1` DECLARES AN ENVELOPE; IT DOES NOT REQUIRE A QUEUE. Three
containers each pinned to 1 CPU on a 4-vCPU runner each still get the whole
CPU they declare, and each still reads `cpus == 1` out of its own cgroup --
which is the thing `isolation()` verifies. What sharding must not do is lose
the completeness the single process got for free: one process could not
finish without covering every declared size, and three can, by one of them
silently not running. So this file exists to say that out loud.

WHAT IT REFUSES. Every requirement below is a named failure, because a merge
that quietly accepts two shards where three were declared is worth less than
no merge at all:
  * the shards must cover the declared CELLS exactly -- every (lines, seed)
    of SIZES x SEEDS, once each. ~~the declared sizes~~ The coordinate moved
    from the size to the cell on 2026-09-10 (M-268): the cost of the matrix
    is not a function of the size, and a deal by size could not put the wall
    below the one size that held half of it.
  * every shard must have measured at least TWO cells: the leak signature in
    `check_lyrics_capacity.py` needs four boundaries before it says anything,
    so a one-cell shard is a shard in which that check could not run -- and
    CANNOT RUN is not PASS
  * every shard must have PASSED with an empty failure list
  * no shard may be a `--local` supplement
  * every shard must have verified the real 1 CPU / 2 GiB cgroup limits
  * every shard must have measured the SAME runtime source, before and after,
    as every other shard -- three shards that measured three trees are three
    answers to three questions
  * the executions must add up to the declared total

`production_qualified` is not copied from a shard. No shard can be qualified
on its own -- each one measured a part of the matrix, and the script sets
that field False whenever its cells are not the whole of CELLS, for exactly
that reason. It is re-derived here, from all of the above, or it is False.

Usage:
  python3 scripts/merge_lyrics_capacity.py shard1.json shard2.json ... --out=capacity.json
"""
import argparse
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))

# The declared population, read from the ONE place that declares it (doctrine 1).
# Retyping 18/24/31 here is how a merger and a matrix come to disagree about
# what "complete" means.
from check_lyrics_capacity import (CELLS, LEAK_MIN_BOUNDARIES, LIMITS, MODES,  # noqa: E402
                                   SEEDS, SIZES, summarize_measurements)

EXPECTED_EXECUTIONS = len(CELLS) * len(MODES)
#: Fewer boundaries than this and the leak signature never ran (doctrine 20).
MIN_TRACE_PER_SHARD = LEAK_MIN_BOUNDARIES

#: Fields every shard must agree on. `source_sha256` is the load-bearing one:
#: it is what makes three separate measurements evidence about ONE runtime.
SHARED = ('source_sha256', 'source_sha256_after', 'limits', 'seeds',
          'published_execution_limits', 'scope', 'version')


def load(path):
    try:
        return json.loads(Path(path).read_text())
    except (OSError, ValueError) as error:
        raise ValueError(f'{path}: unreadable capacity shard: {error}') from None


def merge(shards):
    """-> (report, failures). A non-empty `failures` means NOT qualified."""
    failures = []
    if not shards:
        return {}, ['no capacity shards were supplied']

    covered = []
    cells_of = {}
    for name, shard in shards:
        raw = shard.get('cells')
        cells = [tuple(c) for c in raw if isinstance(c, list) and len(c) == 2] \
            if isinstance(raw, list) else []
        if not cells or len(cells) != len(raw):
            failures.append(f'{name}: shard declares no cells')
            continue
        undeclared = [c for c in cells if c not in CELLS]
        if undeclared:
            failures.append(f'{name}: {undeclared} are not cells of the declared matrix')
        if len(cells) * len(MODES) < MIN_TRACE_PER_SHARD:
            failures.append(f'{name}: measured {len(cells)} cell(s); the leak signature needs '
                            f'{MIN_TRACE_PER_SHARD} boundaries and could not have run')
        if shard.get('seeds') != list(SEEDS):
            failures.append(f"{name}: seeds {shard.get('seeds')} are not the declared {list(SEEDS)}")
        if shard.get('sizes') != sorted({size for size, _ in cells}):
            failures.append(f"{name}: sizes {shard.get('sizes')} do not describe its cells")
        cells_of[name] = cells
        covered.extend(cells)
    if sorted(covered) != sorted(CELLS):
        failures.append(f'shards cover {sorted(covered)}; the declared matrix is '
                        f'{sorted(CELLS)}, each exactly once')

    for name, shard in shards:
        if shard.get('status') != 'passed':
            failures.append(f"{name}: status is {shard.get('status')!r}, not 'passed'")
        for failure in shard.get('failures') or []:
            failures.append(f'{name}: {failure}')
        if shard.get('local_supplement') is not False:
            failures.append(f'{name}: a --local supplement cannot qualify production')
        if not (shard.get('isolation') or {}).get('production_limits_verified'):
            failures.append(f'{name}: did not verify the real 1 CPU / 2 GiB cgroup limits')
        if shard.get('source_sha256') != shard.get('source_sha256_after'):
            failures.append(f'{name}: the measured runtime source changed during the shard')

    first_name, first = shards[0]
    for name, shard in shards[1:]:
        for field in SHARED:
            if shard.get(field) != first.get(field):
                failures.append(f'{name}: {field} differs from {first_name}; '
                                f'the shards did not measure one runtime')

    for name, shard in shards:
        cells = cells_of.get(name)
        if cells is None:
            continue
        own = shard.get('measurements') or []
        if len(own) != len(cells) * len(MODES):
            failures.append(f'{name}: {len(own)} executions for {len(cells)} cell(s); '
                            f'each cell is {len(MODES)} executions')
        stray = [(m.get('lines'), m.get('seed'), m.get('mode')) for m in own
                 if (m.get('lines'), m.get('seed')) not in cells or m.get('mode') not in MODES]
        if stray:
            failures.append(f'{name}: measured {stray}, outside the cells it declares')
    measurements = [m for _, shard in shards for m in (shard.get('measurements') or [])]
    if len(measurements) != EXPECTED_EXECUTIONS:
        failures.append(f'{len(measurements)} executions across the shards; '
                        f'the declared matrix is {EXPECTED_EXECUTIONS}')
    seen = {(m.get('lines'), m.get('seed'), m.get('mode')) for m in measurements}
    if len(seen) != len(measurements):
        failures.append('two shards measured the same size/seed/mode')

    # THE EVIDENCE SHARDING WOULD OTHERWISE HAVE COST. A single container read
    # /sys/fs/cgroup/memory.peak once, at the end, over all 18 executions -- one
    # number that bounded the peak AND, by being a max over the whole span,
    # stood in for "the runtime does not accumulate". Split across containers,
    # the second half of that would have quietly become unmeasured. The matrix
    # samples every boundary instead (`memory_trace`), so this merger requires
    # the trace to be COMPLETE: a shard that reported measurements without them
    # is a shard that skipped the check.
    trace = [t for _, shard in shards for t in (shard.get('memory_trace') or [])]
    if len(trace) != EXPECTED_EXECUTIONS:
        failures.append(f'{len(trace)} memory-trace boundaries across the shards; '
                        f'the declared matrix is {EXPECTED_EXECUTIONS}')
    for name, shard in shards:
        if len(shard.get('memory_trace') or []) != len(shard.get('measurements') or []):
            failures.append(f'{name}: memory trace does not cover its own executions')

    # THE LEAK SIGNATURE IS JUDGED HERE, OVER EVERY SHARD (M-272). The rule --
    # resident memory rising at every boundary without once falling -- was
    # written for one container's 18 boundaries. A shard has as few as four,
    # and a working set that is only warming up rises through four before it
    # first falls: run 34518177848 showed that climb in two shards of three,
    # one of which then fell at its fifth and sixth boundaries. A leak is a
    # property of the runtime, and every shard runs the runtime, so a leak
    # shows in every shard; a climb in one shard and a fall in another is a
    # working set moving around. A shard that did not record a signature over
    # at least the minimum boundaries did not run the check (doctrine 20).
    rising = []
    for name, shard in shards:
        signature = shard.get('leak_signature')
        if not isinstance(signature, dict) \
                or not isinstance(signature.get('rose_at_every_boundary'), bool) \
                or not isinstance(signature.get('boundaries'), int) \
                or signature['boundaries'] < MIN_TRACE_PER_SHARD:
            failures.append(f'{name}: did not evaluate the leak signature over at least '
                            f'{MIN_TRACE_PER_SHARD} boundaries')
            continue
        if signature['rose_at_every_boundary']:
            rising.append(name)
    if rising and len(rising) == len(shards):
        failures.append('resident memory rose at every execution boundary in every shard; '
                        'the runtime accumulates across a long run')

    report = {
        'version': 1,
        'scope': first.get('scope'),
        'sharded': True,
        'shards': [{'file': name, 'cells': shard.get('cells'), 'sizes': shard.get('sizes')}
                   for name, shard in shards],
        'cells': [list(cell) for cell in CELLS],
        'sizes': list(SIZES),
        'seeds': list(SEEDS),
        'limits': LIMITS,
        'source_sha256': first.get('source_sha256'),
        'source_sha256_after': first.get('source_sha256_after'),
        'published_execution_limits': first.get('published_execution_limits'),
        'isolation': {name: shard.get('isolation') for name, shard in shards},
        'measurements': measurements,
        'memory_trace': trace,
        # Re-derived over the union, by the one function that derives them: a
        # size whose seeds were dealt to two containers gets one row here.
        'summaries': summarize_measurements(measurements),
        'cgroup_peak_bytes': {name: shard.get('cgroup_peak_bytes') for name, shard in shards},
        'whole_runtime_peak_bytes': {name: shard.get('whole_runtime_peak_bytes')
                                     for name, shard in shards},
        'leak_signature': {name: shard.get('leak_signature') for name, shard in shards},
        'leak_signature_rising_in': rising,
        'failures': failures,
    }
    report['status'] = 'failed' if failures else 'passed'
    report['production_qualified'] = not failures
    return report, failures


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('shards', nargs='+')
    ap.add_argument('--out', required=True)
    args = ap.parse_args(argv)

    try:
        shards = [(Path(p).name, load(p)) for p in args.shards]
    except ValueError as error:
        print(f'REFUSED — {error}', file=sys.stderr)
        return 2

    report, failures = merge(shards)
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    temp = out.with_suffix(out.suffix + '.tmp')
    temp.write_text(json.dumps(report, indent=2, sort_keys=True) + '\n')
    temp.replace(out)

    print(json.dumps({k: report.get(k) for k in
                      ('status', 'production_qualified', 'failures')}, sort_keys=True))
    return 1 if failures else 0


if __name__ == '__main__':
    raise SystemExit(main())
