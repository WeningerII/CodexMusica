#!/usr/bin/env python3
"""Actually verify every reviewed capacity witness in this installed runtime.

The deterministic receipt binds unchanged table bytes, the consumed judge,
data, declarations and full Python runtime. No construction, sampling,
provider calls, timestamps or renewal from a previous receipt occurs.
"""
import argparse
from concurrent.futures import ProcessPoolExecutor
import hashlib
import json
import os
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from quality import capacity as C
from quality.revise import Reviser

_REVISER = None


def _init_worker():
    global _REVISER
    _REVISER = Reviser()


def verify_witness(reviser, row):
    """One actual full-clique verdict, including the unchanged grader ban."""
    words = row['witness'].split()
    found, banned, incompatible = C._group_measurement(reviser, words)
    pairs = len(words) * (len(words) - 1) // 2
    if (row['chain_lo'] != len(words) or found['pairs_mandated'] != pairs
            or found['pairs_judged'] != pairs or found['pairs_refused']
            or found['violations'] or found['refusals'] or banned or incompatible):
        raise ValueError(f"CAPACITY_UNVERIFIED: {row['family']} did not answer every "
                         f"declared pair cleanly (judged={found['pairs_judged']}/{pairs}, "
                         f"refused={found['pairs_refused']}, banned={len(banned)}, "
                         f"violated={len(found['violations'])})")
    return {'family': row['family'], 'chain_lo': len(words),
            'pairs_judged': found['pairs_judged'], 'refused_pairs': found['pairs_refused'],
            'violated_pairs': len(found['violations']), 'banned_pairs': len(banned)}


def _worker(row):
    return verify_witness(_REVISER, row)


def verify_all(path=C.TABLE_PATH, *, workers=1):
    """Return an attestation only after the complete current table passes."""
    reviser = Reviser()
    identity = C.certification_identity(reviser)
    table_hash = hashlib.sha256(Path(path).read_bytes()).hexdigest()
    rows = C.read_table(path, verify_runtime=False)
    errors, summary = C.validate_rows(reviser, rows, path=path)
    if errors:
        raise ValueError('CAPACITY_UNVERIFIED: ' + '; '.join(errors))
    required = sorted((r for r in rows if r['certified']), key=lambda r: r['family'])
    if not required or len(required) != C.ADOPTED['certified']:
        raise ValueError('CAPACITY_UNVERIFIED: the complete adopted witness population is required')
    if workers == 1:
        records = []
        for row in required:
            records.append(verify_witness(reviser, row))
            print(f"verified {len(records)}/{len(required)} {row['family']}", flush=True)
    else:
        with ProcessPoolExecutor(max_workers=workers, initializer=_init_worker) as pool:
            records = []
            for record in pool.map(_worker, required):
                records.append(record)
                print(f"verified {len(records)}/{len(required)} {record['family']}", flush=True)
    if (summary != C.ADOPTED or summary["max_chain_lo"] != C.ADOPTED_MAX_GROUP
            or C.certification_identity(reviser) != identity
            or hashlib.sha256(Path(path).read_bytes()).hexdigest() != table_hash):
        raise ValueError('CAPACITY_UNVERIFIED: inputs changed during all-family verification')
    receipt = {'version': 1, 'status': 'verified',
               'scope': 'all_certified_capacity_witnesses', 'relation': C.ADOPTED_RELATION,
               'python': sys.version, 'source_identity': identity, 'table_sha256': table_hash,
               'families_total': len(rows), 'witnesses_required': len(required),
               'witnesses_verified': len(records), 'construction_attempt_cap': C.CERTIFY_ATTEMPT_CAP,
               'summary': json.loads(json.dumps(summary)), 'witnesses': records}
    return C.validate_receipt(receipt, rows, table_sha256=table_hash,
                              source_identity=identity, python_version=sys.version)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', required=True)
    parser.add_argument('--table', default=C.TABLE_PATH)
    parser.add_argument('--check', action='store_true', help='cheap strict validation of an existing actual all-family receipt')
    parser.add_argument('--workers', type=int, default=1, choices=range(1, 5))
    args = parser.parse_args(argv)
    output = Path(args.output)
    if output.resolve() == Path(args.table).resolve():
        parser.error("the receipt output must not replace the reviewed capacity table")
    if args.check:
        try:
            receipt = C.require_current_proof(path=args.table, receipt_path=str(output))
        except (ValueError, OSError) as exc:
            print(f'REFUSED — {exc}', file=sys.stderr)
            return 2
        print(f"CAPACITY RECEIPT VALID: {receipt['witnesses_verified']}/{receipt['witnesses_required']} "
              f"for actual runtime {sys.version.split()[0]}")
        return 0
    # A failed renewal must not leave an older successful receipt at this path.
    output.unlink(missing_ok=True)
    try:
        receipt = verify_all(args.table, workers=args.workers)
    except (ValueError, OSError) as exc:
        print(f'REFUSED — {exc}', file=sys.stderr)
        return 2
    output.parent.mkdir(parents=True, exist_ok=True)
    temp = output.with_name(output.name + '.part')
    temp.write_text(json.dumps(receipt, sort_keys=True, indent=2) + '\n')
    os.replace(temp, output)
    print(f"CAPACITY VERIFIED: {receipt['witnesses_verified']}/{receipt['witnesses_required']} "
          f"in {sys.version.split()[0]}; receipt {output}")
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
