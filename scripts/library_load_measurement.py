"""Sample the existing resident metric across first load, not after it.

This helper performs no HTTP or workload itself. The caller supplies the real
load and the gate's MeasurementProgress, so there is one accounting definition.
"""
import threading


def load_trace_failures(rows, ceiling):
    if not isinstance(rows, list) or len(rows) != 2:
        return ['first-load samples must cover startup and recovery']
    if (any(not isinstance(row, dict) or not isinstance(row.get('phase'), str) for row in rows) or
            sorted(row['phase'] for row in rows) != ['library', 'library_recovery']):
        return ['first-load samples have missing or duplicate phases']
    failures = []
    for row in rows:
        details = row.get('instrumentation')
        peak = details.get('peak_sample') if isinstance(details, dict) else None
        count = details.get('sample_count') if isinstance(details, dict) else None
        value = row.get('peak_bytes')
        if (row.get('metric') != 'sampled_resident_first_load' or
                type(value) is not int or not 0 < value <= ceiling or
                not isinstance(peak, dict) or peak.get('resident_bytes') != value or
                type(count) is not int or count < 2):
            failures.append('missing, inconsistent or excessive first-load resident sample: ' + row['phase'])
    return failures


def sample_during_load(load, progress, interval=.05):
    if interval <= 0:
        raise ValueError('a positive sampling interval is required')
    stopped = threading.Event()
    errors = []

    def sample():
        try:
            progress.sample()
        except Exception as error:
            errors.append(error)

    def observe():
        while not stopped.wait(interval):
            sample()
            if errors:
                return

    # This reading precedes even the request that starts loading.
    progress.sample()
    observer = threading.Thread(target=observe, name='library-load-sampler')
    observer.start()
    try:
        return load()
    finally:
        stopped.set()
        observer.join()
        sample()
        if errors:
            raise RuntimeError('Library first-load sampling failed') from errors[0]
