#!/usr/bin/env node
// Exercise the actual bridge's synchronous admission/retention boundary.
// Cancellation precedes the first execution microtask: no grading throughput
// or completed queued-work claim is made, and no Python child may be spawned.
import fs from 'node:fs';
import crypto from 'node:crypto';
import childProcess from 'node:child_process';
import path from 'node:path';
import { syncBuiltinESMExports } from 'node:module';
import { performance } from 'node:perf_hooks';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { _workerInternals, lyricCapacity } from '../mcp/lyric_tools.js';

function cgroupBytes(name) {
  try {
    const raw = fs.readFileSync('/sys/fs/cgroup/' + name, 'utf8').trim();
    return /^\d+$/.test(raw) ? Number(raw) : null;
  } catch {
    return null;
  }
}
function memory() {
  return {
    ...process.memoryUsage(),
    cgroup_current: cgroupBytes('memory.current'),
    cgroup_peak: cgroupBytes('memory.peak'),
  };
}
function alive(pid) {
  if (!Number.isSafeInteger(pid) || pid < 1) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
function instrumentChildren(pid) {
  if (!Number.isSafeInteger(pid) || pid < 1) return null;
  try {
    const ids = fs.readFileSync(`/proc/${pid}/task/${pid}/children`, 'utf8').trim();
    return (ids ? ids.split(/\s+/).map(Number) : []).map((child) => {
      const argv = fs.readFileSync(`/proc/${child}/cmdline`, 'utf8').split('\0');
      const cwd = fs.readlinkSync(`/proc/${child}/cwd`);
      const status = fs.readFileSync(`/proc/${child}/status`, 'utf8');
      const rss = /^VmRSS:\s+(\d+)\s+kB$/m.exec(status);
      const cli = fileURLToPath(new URL('../lyric-harness/lyric_harness.py', import.meta.url));
      const worker = fileURLToPath(new URL('../mcp/worker.py', import.meta.url));
      const slot = argv.findIndex((arg, index) => index > 0 && path.resolve(cwd, arg) === cli);
      const kind =
        slot > 0 && ['song', 'finish'].includes(argv[slot + 1])
          ? 'cli-' + argv[slot + 1]
          : argv.some((arg, index) => index > 0 && path.resolve(cwd, arg) === worker)
            ? 'worker'
            : 'other';
      return { pid: child, kind, rss: rss ? Number(rss[1]) * 1024 : null };
    });
  } catch {
    // Missing proc evidence must remain missing, never infer child memory.
    return null;
  }
}
function payload(bytes, index) {
  const overhead = Buffer.byteLength(JSON.stringify(['--help', '']));
  const length = bytes - overhead;
  if (length < 32) throw new Error('Declared queue budget cannot carry the synthetic probe');
  const raw = Buffer.alloc(length, 120);
  raw.write(String(index), 0, 'ascii');
  raw.write('\u0100', length - 2, 'utf8');
  const args = ['--help', raw.toString('utf8')];
  if (Buffer.byteLength(JSON.stringify(args)) !== bytes)
    throw new Error('Queue probe bytes do not match the actual admission charge');
  return args;
}

export async function queuePressure(phase, { requestId, instrumentPid = null } = {}) {
  const initial = lyricCapacity();
  if (initial.admitted || initial.queued || initial.active || _workerInternals.pid() !== null)
    throw new Error('Queue pressure requires the actual idle, unstarted server bridge');
  if (initial.maxAdmitted < 2 || initial.maxInputBytes < initial.maxAdmitted * 128)
    throw new Error('Queue configuration cannot support independent count/byte probes');
  if (!['count', 'bytes', 'full'].includes(phase)) throw new Error('Unknown queue pressure phase');
  const n = initial.maxAdmitted - (phase === 'bytes' ? 1 : 0);
  const total =
    phase === 'count' ? Math.min(initial.maxInputBytes - 16, n * 1024) : initial.maxInputBytes;
  const base = Math.floor(total / n),
    extra = total % n;
  const controllers = [],
    pending = [],
    fingerprints = [];
  let spawnCalls = 0;
  const originalSpawn = childProcess.spawn;
  childProcess.spawn = function (...args) {
    spawnCalls++;
    return originalSpawn.apply(this, args);
  };
  // The production bridge imports this actual builtin by name. Observe its
  // spawn calls, forwarding unchanged; restore the builtin after settlement.
  syncBuiltinESMExports();
  const started = performance.now(),
    beforeMemory = memory();
  let held,
    retainedMemory,
    overflow,
    after,
    settled,
    afterMemory,
    instrumentAliveAtLoad,
    childrenAtLoad;
  try {
    for (let index = 0; index < n; index++) {
      const args = payload(base + (index < extra ? 1 : 0), index);
      fingerprints.push(crypto.createHash('sha256').update(args[1]).digest('hex'));
      const controller = new AbortController();
      controllers.push(controller);
      pending.push(
        _workerInternals.runVerb(args, {
          signal: controller.signal,
          deadlineAt: performance.now() + 5000,
        })
      );
    }
    held = lyricCapacity();
    retainedMemory = memory();
    instrumentAliveAtLoad = alive(instrumentPid);
    childrenAtLoad = instrumentChildren(instrumentPid);
    const beforeOverflow = JSON.stringify(held);
    const overflowPromise = _workerInternals.runVerb(['--help'], {
      deadlineAt: performance.now() + 5000,
    });
    if (JSON.stringify(lyricCapacity()) !== beforeOverflow)
      throw new Error('Overflow request changed admitted queue state');
    // No await, event-loop yield or child execution occurs before cancellation.
    for (const controller of controllers) controller.abort();
    overflow = await overflowPromise;
    settled = await Promise.all(pending);
    after = lyricCapacity();
    afterMemory = memory();
  } finally {
    for (const controller of controllers) controller.abort();
    await Promise.allSettled(pending);
    childProcess.spawn = originalSpawn;
    syncBuiltinESMExports();
  }
  const result = {
    version: 1,
    phase,
    request_id: requestId || 'isolated',
    server_pid: process.pid,
    instrument_pid: instrumentPid,
    instrument_alive: instrumentAliveAtLoad,
    instrument_children: childrenAtLoad,
    wall_ms: performance.now() - started,
    initial,
    retained: held,
    after,
    payload_bytes: total,
    payload_count: n,
    distinct_payloads: new Set(fingerprints).size,
    overflow_input_bytes: Buffer.byteLength(JSON.stringify(['--help'])),
    overflow: {
      code: overflow.error_code,
      path: overflow.path,
      busy: overflow.busy,
      retryable: overflow.retryable,
    },
    settled: settled.length,
    cancelled: settled.filter((row) => row.cancelled === true && row.path === 'killed').length,
    spawn_calls: spawnCalls,
    worker_pid_after: _workerInternals.pid(),
    memory_before: beforeMemory,
    memory_retained: retainedMemory,
    memory_after: afterMemory,
    scope:
      'Actual bridge admission, retained payloads, overflow refusal and cancellation cleanup. No queued execution throughput; no additional Python process.',
  };
  if (
    spawnCalls ||
    result.worker_pid_after !== null ||
    after.admitted ||
    after.admittedBytes ||
    after.queued ||
    after.active ||
    result.cancelled !== n ||
    overflow.error_code !== 'PYTHON_BUSY'
  )
    throw new Error('Actual queue pressure did not cancel cleanly without spawning');
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const path = process.argv[2];
  if (!path) throw new Error('Usage: lyrics_capacity_queue.mjs OUTPUT_JSON');
  const rows = [];
  for (const phase of ['count', 'bytes', 'full']) rows.push(await queuePressure(phase));
  fs.writeFileSync(
    path,
    JSON.stringify(
      {
        version: 1,
        scope: 'Isolated queue component; no resident-cache or active-grader overlap claim',
        rows,
      },
      null,
      2
    ) + '\n'
  );
}
