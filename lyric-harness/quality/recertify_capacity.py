#!/usr/bin/env python3
"""Rebuild all adopted RHYME witnesses with bounded parallel workers.

Uses capacity.certify unchanged in each worker. Completed families use the
same source/data-bound parts namespace as capacity --derive. No sampling,
provider calls, or relaxation of the relation or two-tier ban occurs.
"""
import argparse
from concurrent.futures import ProcessPoolExecutor, as_completed
import json
import os
from pathlib import Path
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from quality import capacity as C
from quality.revise import Reviser

_REVISER = None


def _init_worker():
    global _REVISER
    _REVISER = Reviser()


def _one(job):
    family, classes, previous = job
    started = time.monotonic()
    mode = 'constructed'
    words = None
    if previous is not None:
        # A changed source namespace never imports an old proof. Ask the
        # current oracle again, including its actual two-tier ban.
        choices = {word: spelling for spelling, members in classes.items() for word in members}
        inside = (len(previous) <= C.CERTIFY_ATTEMPT_CAP
                  and all(word in choices for word in previous)
                  and len({choices[word] for word in previous if word in choices}) == len(previous))
        if inside:
            banned, drift = C._grade_group(_REVISER, previous)
            if not banned and not drift:
                words, rounds, mode = previous, 0, 'reverified'
    if words is None:
        words, rounds = C.certify(_REVISER, classes)
    bad, drift = C._grade_group(_REVISER, words)
    if bad or drift:
        raise RuntimeError(f'{family}: completed witness does not certify')
    return family, words, rounds, time.monotonic() - started, mode


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--parts', required=True)
    parser.add_argument('--workers', type=int, default=1)
    parser.add_argument('--report', required=True)
    parser.add_argument('--output', default=C.TABLE_PATH)
    parser.add_argument('--reverify-from', help='old identity directory; every previous witness is re-graded under the current judge')
    args = parser.parse_args(argv)
    if not 1 <= args.workers <= 4:
        parser.error('--workers must be between 1 and 4')
    reviser = Reviser()
    identity = C.certification_identity(reviser)
    partdir = Path(args.parts).resolve() / identity
    partdir.mkdir(parents=True, exist_ok=True)
    families = C.families(reviser)
    todo = [(C.fam_label(key), classes) for key, classes in families.items()
            if len(classes) >= C.CERTIFY_MIN_CLASSES]
    todo.sort(key=lambda item: (-len(item[1]), item[0]))
    cached = []
    pending = []
    for family, classes in todo:
        part = partdir / (family + '.tsv')
        if part.exists():
            size, witness = part.read_text().rstrip('\n').split('\t')
            if int(size) != len(witness.split()):
                raise RuntimeError(f'{family}: corrupt checkpoint witness length')
            cached.append(family)
        else:
            previous = None
            if args.reverify_from:
                old = Path(args.reverify_from) / (family + '.tsv')
                if old.exists():
                    size, text = old.read_text().rstrip('\n').split('\t')
                    previous = text.split()
                    if int(size) != len(previous):
                        raise RuntimeError(f'{family}: corrupt old witness length')
            pending.append((family, classes, previous))
    report = {'version': 1, 'relation': C.ADOPTED_RELATION,
              'identity': identity, 'judge': C.judge_fingerprint(),
              'construction_attempt_cap': C.CERTIFY_ATTEMPT_CAP,
              'max_repair_rounds': C.MAX_REPAIR_ROUNDS,
              'workers': args.workers, 'total': len(todo),
              'cached': cached, 'completed': [], 'status': 'running',
              'reverify_from': str(Path(args.reverify_from).resolve()) if args.reverify_from else None}
    report_path = Path(args.report)
    report_path.parent.mkdir(parents=True, exist_ok=True)
    started = time.monotonic()
    with ProcessPoolExecutor(max_workers=args.workers, initializer=_init_worker) as pool:
        jobs = {pool.submit(_one, job): job[0] for job in pending}
        for future in as_completed(jobs):
            family, words, rounds, elapsed, mode = future.result()
            part = partdir / (family + '.tsv')
            temp = part.with_suffix('.part')
            temp.write_text(f'{len(words)}\t{" ".join(words)}\n')
            os.replace(temp, part)
            report['completed'].append({'family': family, 'chain_lo': len(words),
                                        'witness': words, 'rounds': rounds,
                                        'elapsed_s': elapsed, 'mode': mode})
            report_path.write_text(json.dumps(report, indent=2) + '\n')
            print(f'{len(cached)+len(report["completed"])}/{len(todo)} {family}: '
                  f'{len(words)} certified words, {rounds} rounds, {elapsed:.2f}s', flush=True)
    if C.certification_identity(reviser) != identity:
        report['status'] = 'source_changed'
        report_path.write_text(json.dumps(report, indent=2) + '\n')
        raise RuntimeError('capacity source/data changed during certification; no artifact emitted')
    rows = C.derive(reviser, parts_dir=args.parts)
    C.emit_table(rows, path=args.output)
    report.update(status='complete', elapsed_s=time.monotonic()-started,
                  summary=C.summarize(rows), output=str(Path(args.output).resolve()))
    report_path.write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report['summary'], sort_keys=True))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
