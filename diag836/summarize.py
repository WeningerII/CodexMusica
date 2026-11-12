"""Print one capacity report's per-execution numbers as log lines.

Artifacts cannot be downloaded by the reviewing sessions, so every number the
comparison needs is printed to the job log: `DIAG836 CELL {json}` per
execution and `DIAG836 RUN {json}` per report. Never merged; diagnostic only.
"""
import json
import sys

MIB = 2 ** 20


def mib(value):
    return round(value / MIB, 1) if type(value) is int else value


def main():
    path, arm, rnd, rc = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4])
    try:
        with open(path) as handle:
            report = json.load(handle)
    except (OSError, ValueError) as error:
        print('DIAG836 RUN ' + json.dumps({'arm': arm, 'round': rnd, 'rc': rc, 'error': str(error)[:300]}), flush=True)
        return
    for row in report.get('memory_trace', []):
        peak = (row.get('instrumentation') or {}).get('peak_sample')
        peak = peak if isinstance(peak, dict) else {}
        node = peak.get('node_rss') if isinstance(peak.get('node_rss'), dict) else {}
        heap = peak.get('node_memory') if isinstance(peak.get('node_memory'), dict) else {}
        print('DIAG836 CELL ' + json.dumps({
            'arm': arm, 'round': rnd, 'cell': f"{row.get('lines')}/{row.get('seed')}/{row.get('mode')}",
            'peak_mib': mib(row.get('peak_bytes')),
            'anon_mib': mib((peak.get('memory_stat') or {}).get('anon')),
            'node_rss_mib': mib(node.get('bytes')),
            'node_heap_used_mib': mib(heap.get('heapUsed')),
            'node_external_mib': mib(heap.get('external')),
            'library_before': (row.get('library_before') or {}).get('state'),
            'samples': row.get('samples')}, sort_keys=True), flush=True)
    runtime = report.get('resident_runtime') or {}
    lib = runtime.get('library') if isinstance(runtime.get('library'), dict) else {}
    print('DIAG836 RUN ' + json.dumps({
        'arm': arm, 'round': rnd, 'rc': rc, 'status': report.get('status'),
        'library_mode': report.get('library_mode', 'n/a (before arm)'),
        'failures': report.get('failures'), 'source_sha256': report.get('source_sha256'),
        'startup_s': runtime.get('startup_s'), 'library_load_s': lib.get('load_s'),
        'first_search_s': lib.get('first_search_s'), 'library_state': lib.get('state'),
        'first_load_peaks_mib': [mib(r.get('peak_bytes')) for r in report.get('library_load_memory_trace', [])],
        'cgroup_peak_mib': mib(report.get('cgroup_peak_bytes'))}, sort_keys=True), flush=True)


if __name__ == '__main__':
    main()
