#!/usr/bin/env python3
"""Read M-170 receipts; never treat a missing, truncated or unequal arm as proof."""
import argparse
from collections import defaultdict
import hashlib
import json
from pathlib import Path

from measure_lyric_continuations import normalise


def recorded_directory(directory):
    """Use the recorded argv so moving an evidence archive preserves the comparison."""
    path = directory / 'report.json'
    if path.exists():
        argv = json.loads(path.read_text()).get('argv', [])
        if len(argv) > 1:
            return Path(argv[1]).parent
    return directory


def output_digest(path):
    text = normalise(path.read_text(), recorded_directory(path.parent))
    return hashlib.sha256(text.encode()).hexdigest()


def summarise(root):
    reports = {}
    for directory in sorted(root.iterdir()):
        path = directory / 'report.json'
        if directory.is_dir() and path.exists() and (
                directory.name.startswith(('series-', 'bare22-', 'timed22-'))):
            report = json.loads(path.read_text())
            if report.get('source_unchanged') is not True:
                raise ValueError(f'{directory.name}: missing final unchanged-source receipt')
            reports[directory.name] = report
    result = {'version': 1, 'arms': {}, 'comparisons': {}, 'initial_attribution': [],
              'normalisation': 'Run-directory paths, memo disclosures/counters, and only finish_bp temporary filename in BLUEPRINT header; findings, coverage, lyrics and journals remain compared.'}
    for name, report in reports.items():
        rows = []
        for row in report['rows']:
            fields = ('fold', 'code', 'answers_before', 'wall', 'cli_wall', 'cli_cpu',
                      'memory', 'caches', 'partial')
            rows.append({key: row[key] for key in fields if key in row})
        result['arms'][name] = dict(head=report['head'], lines=report['lines'],
                completed_resumes=report['completed_resumes'], requested_resumes=report['requested_resumes'],
                last_exit_code=report['last_exit_code'], rows=rows,
                source_unchanged=True)
        if name.startswith('timed22-'):
            row = report['rows'][0]
            exclusive, calls = defaultdict(float), defaultdict(int)
            for key, value in row['components'].items():
                label = key.split(' > ')[-1]
                exclusive[label] += value['self_cpu']
                calls[label] += value['calls']
            group_grades = [value for key, value in row['components'].items()
                            if key.endswith('Reviser.group_merges > Reviser.grade')]
            group_builds = [value for key, value in row['components'].items()
                            if 'Reviser.group_merges > Reviser.grade >' in key
                            and key.endswith('quality.relations.build_stream')]
            result['initial_attribution'].append(dict(arm=name, wall=row['wall'],
                cli_cpu=row['cli_cpu'], exclusive_cpu=dict(exclusive), calls=dict(calls),
                group_extra_grade_cpu=sum(v['cpu'] for v in group_grades),
                group_extra_grade_calls=sum(v['calls'] for v in group_grades),
                group_extra_grade_build_stream_calls=sum(v['calls'] for v in group_builds)))
    initial = {name: output_digest(root / name / '00.stdout') for name in reports
               if name.startswith(('bare22-', 'timed22-'))}
    initial_complete = len(initial) == 6 and all(
        reports[name]['rows'][0]['code'] == 4 and reports[name]['rows'][0].get('pending')
        and (root / name / '00.stdout').stat().st_size > 0 for name in initial)
    result['initial_equality'] = dict(digests=initial, complete=initial_complete,
                                    equal=len(set(initial.values())) == 1 and initial_complete)
    for size in (22, 28):
        names = [f'series-{mode}-{size}' for mode in ('cold', 'warm')]
        if not all(name in reports for name in names):
            result['comparisons'][str(size)] = {'complete': False, 'reason': 'missing arm'}
            continue
        cold, warm = [reports[name] for name in names]
        coordinates = ('source_sha256', 'runtime_sha256', 'python', 'fixture',
                       'seed', 'lines', 'draft_sha256', 'requested_resumes')
        same_inputs = all(key in cold and key in warm and cold[key] == warm[key]
                          for key in coordinates)
        finished = all((r['completed_resumes'] >= r['requested_resumes'] or
                        r['last_exit_code'] in (0, 3)) and r['rows'] and
                       all(row['code'] in (0, 3, 4) and not row.get('partial')
                           for row in r['rows']) for r in (cold, warm))
        ordered = all([row['fold'] for row in r['rows']] == list(range(len(r['rows'])))
                      for r in (cold, warm))
        comparisons = []
        for a, b in zip(cold['rows'], warm['rows']):
            fold = a['fold']
            prefix = f'{fold:02d}'
            dirs = [root / name for name in names]
            stdout = [output_digest(d / (prefix + '.stdout')) for d in dirs]
            stderr = [normalise((d / (prefix + '.stderr')).read_text(), recorded_directory(d)) for d in dirs]
            paths = [d / (prefix + '.journal.json') for d in dirs]
            journals = [json.loads(p.read_text()) if p.exists() else None for p in paths]
            receipts = all((d / (prefix + '.stdout')).stat().st_size > 0 for d in dirs)
            receipts = receipts and all(row['code'] != 4 or journal is not None
                                        for row, journal in zip((a, b), journals))
            comparisons.append(dict(fold=fold, code_equal=a['code'] == b['code'],
                stdout_equal=stdout[0] == stdout[1], stderr_equal=stderr[0] == stderr[1],
                journal_equal=journals[0] == journals[1],
                receipts_complete=receipts,
                completed_calls=a['code'] in (0, 3, 4) and b['code'] in (0, 3, 4)))
        same_length = len(cold['rows']) == len(warm['rows'])
        equal = same_inputs and finished and same_length and ordered and bool(comparisons) and all(
            all(row[k] for k in ('code_equal', 'stdout_equal', 'stderr_equal', 'journal_equal', 'receipts_complete', 'completed_calls'))
            for row in comparisons)
        result['comparisons'][str(size)] = dict(complete=finished and same_length and ordered,
                                              same_inputs=same_inputs, equal=equal, folds=comparisons)
    return result


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('directory', type=Path)
    args = ap.parse_args()
    print(json.dumps(summarise(args.directory), indent=2, sort_keys=True))


if __name__ == '__main__':
    main()
