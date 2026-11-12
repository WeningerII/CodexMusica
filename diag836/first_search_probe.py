"""Cold first Library search, timed the same way on both arms.

Runs INSIDE an arm's own image, with that arm's own scripts/ mounted at
/app/scripts, so the server is launched by that arm's own capacity harness
(ResidentRuntime: receipts, RunStore, the real server, its startup probes).
The one change: the harness's load_library() step is replaced by a timed
first `GET /library/v1/search?limit=1` -- the cold first search, including any
store load it triggers -- followed by the Node process's VmRSS and VmHWM.

Prints one line: `DIAG836 FIRST_SEARCH {json}`. Never merged; diagnostic only.
"""
import json
import os
import sys
import tempfile
import time
from pathlib import Path

sys.path.insert(0, '/app/scripts')
import lyrics_capacity_runtime as lcr  # noqa: E402


def proc_status(pid):
    out = {}
    try:
        for line in Path(f'/proc/{pid}/status').read_text().splitlines():
            if line.startswith(('VmRSS:', 'VmHWM:')):
                key, value = line.split(':', 1)
                out[key] = int(value.split()[0]) * 1024
    except OSError:
        pass
    return out


def main():
    arm, rep = sys.argv[1], int(sys.argv[2])
    row = {'arm': arm, 'rep': rep}

    def timed_first_search(self, key):
        if key != 'library':
            return
        started = time.monotonic()
        try:
            body = self.request('GET', '/library/v1/search?limit=1', timeout=lcr.LIBRARY_LOAD_SECONDS)
            row['first_search_ok'] = isinstance(body, dict)
        except Exception as error:  # recorded, never retried
            row['first_search_ok'] = False
            row['first_search_error'] = str(error)[:300]
        row['first_search_s'] = round(time.monotonic() - started, 3)
        status = proc_status(self.child.pid)
        row['node_vmrss_after_mib'] = round(status.get('VmRSS', 0) / 2**20, 1)
        row['node_vmhwm_after_mib'] = round(status.get('VmHWM', 0) / 2**20, 1)
        try:
            row['library_after'] = self.request('GET', '/health').get('library')
        except Exception as error:
            row['library_after'] = 'unavailable: ' + str(error)[:200]

    lcr.ResidentRuntime.load_library = timed_first_search
    with tempfile.TemporaryDirectory(prefix='diag836-') as tmp:
        try:
            resident = lcr.ResidentRuntime(Path(tmp) / 'server', library_mode='loaded')
        except TypeError:  # the before arm's harness predates library_mode
            resident = lcr.ResidentRuntime(Path(tmp) / 'server')
        try:
            record = resident.start()
            row['startup_s'] = round(record.get('startup_s', -1), 3)
        except Exception as error:
            row['startup_error'] = str(error)[:300]
        finally:
            try:
                resident.close()
            except Exception as error:
                row['close_error'] = str(error)[:200]
    print('DIAG836 FIRST_SEARCH ' + json.dumps(row, sort_keys=True), flush=True)
    return 0 if row.get('first_search_ok') else 1


if __name__ == '__main__':
    sys.exit(main())
