#!/usr/bin/env node
// test_capacity_children.mjs — the child sampler against a REAL dying process.
//
// WHY THIS EXISTS (`MISSING.md` M-290). instrumentChildren() reads three /proc
// files per child and they are not atomic. Nothing in this repository drove it:
// it ran only inside a live capacity shard, so its one defect — a single ENOENT
// anywhere in the loop, caught OUTSIDE the loop, nulling the ENTIRE inventory —
// could be found only by a red capacity matrix, and that is how it was found.
//
// THE FIXTURE IS A REAL ZOMBIE, not a stub. A process is forked and exits with
// nobody wait()ing for it, beside a live sibling. Measured on this box: such a
// process is still listed in /proc/<pid>/task/<pid>/children, its cmdline reads
// empty, the cwd readlink throws ENOENT, and its status exists with no VmRSS.
// Node reaps its OWN children too fast to hold that window open, which is why
// the fixture is a separate process that declines to reap.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';
import { childRow, instrumentChildren } from './lyrics_capacity_queue.mjs';

const problems = [];
const check = (label, fn) => {
  try {
    fn();
    console.error(`  PASS  ${label}`);
  } catch (e) {
    problems.push(`${label}: ${e.message}`);
    console.error(`  FAIL  ${label}  — ${e.message}`);
  }
};

check('a pid that cannot exist samples as UNKNOWN, never as an empty inventory', () => {
  assert.equal(instrumentChildren(0), null);
  assert.equal(instrumentChildren(-1), null);
  assert.equal(instrumentChildren(2 ** 53), null);
});

// One zombie child and one live child, under a parent that reaps neither.
const FIXTURE = `
import os, time
if os.fork() == 0: os._exit(0)          # exits at once, never reaped -> zombie
if os.fork() == 0: time.sleep(30)       # stays alive and resident
time.sleep(30)
`;
const parent = spawn('python3', ['-c', FIXTURE], { stdio: 'ignore' });
await sleep(700);

let rows;
check('one child dying mid-sample does not null the WHOLE inventory', () => {
  rows = instrumentChildren(parent.pid);
  assert.notEqual(rows, null, 'a dying child erased every sibling — the M-290 defect');
  assert.ok(Array.isArray(rows), 'the inventory must be a list');
  assert.equal(rows.length, 2, `expected a zombie and a live sibling, got ${JSON.stringify(rows)}`);
});

check('the dying child is PRESENT AND UNIDENTIFIED — no invented kind, no inferred memory', () => {
  const dying = (rows || []).filter((row) => row.kind === null);
  assert.equal(dying.length, 1, `expected exactly one unidentified child: ${JSON.stringify(rows)}`);
  assert.equal(dying[0].rss, null, 'memory must never be inferred for an unsampleable child');
  assert.ok(Number.isSafeInteger(dying[0].pid) && dying[0].pid >= 1, 'its pid is still evidence');
});

check('the LIVE sibling keeps its real measurement — the evidence the proof needs', () => {
  const live = (rows || []).filter((row) => row.kind !== null);
  assert.equal(live.length, 1, `expected exactly one identified child: ${JSON.stringify(rows)}`);
  assert.ok(
    ['cli-song', 'cli-finish', 'worker', 'other'].includes(live[0].kind),
    `unknown kind: ${live[0].kind}`
  );
  assert.ok(
    typeof live[0].rss === 'number' && live[0].rss > 0,
    `a live child must carry real resident bytes, got ${live[0].rss}`
  );
});

check('every row is either identified with real bytes, or declared unknown — never half', () => {
  for (const row of rows || []) {
    const identified = ['cli-song', 'cli-finish', 'worker', 'other'].includes(row.kind);
    assert.ok(
      (identified && typeof row.rss === 'number' && row.rss > 0) ||
        (row.kind === null && row.rss === null),
      `neither identified nor declared-unknown: ${JSON.stringify(row)}`
    );
    assert.notEqual(row.rss, 0, 'a zero resident set must be recorded as unknown, not as zero');
  }
});

parent.kill('SIGKILL');

// THE STATES THE REAL ZOMBIE NEVER REACHES (`MISSING.md` M-290, amended
// 2026-10-05). A zombie's `cwd` readlink throws, so the fixture above only ever
// exercises the catch. Two states reach the row builder with every read
// succeeding and no resident set: a child in exit teardown (its memory already
// released, its `cwd` still held, so `cmdline` reads empty, the readlink
// resolves and `status` has no `VmRSS`), and a child that dies between its
// `cwd` and `status` reads. One that has released every page reads
// `VmRSS: 0 kB`. On 2026-10-05 a row of this kind reached a capacity cell as
// `{'pid': 41, 'kind': 'other', 'rss': None}` and the validator refused it;
// its empty command line fits teardown. These drive the row builder with the
// reads themselves, and the fixture after them catches a real teardown.
const ZOMBIE_STATUS = 'Name:\tpython3\nState:\tZ (zombie)\nPid:\t41\n';
const ZERO_STATUS = 'Name:\tpython3\nState:\tS (sleeping)\nVmRSS:\t       0 kB\n';
const LIVE_STATUS = 'Name:\tpython3\nState:\tS (sleeping)\nVmRSS:\t   12345 kB\n';
const WORKER = fileURLToPath(new URL('../mcp/worker.py', import.meta.url));

check('a child with no VmRSS is declared UNKNOWN whole — never a kind beside a null rss', () => {
  assert.deepEqual(childRow(41, [''], '/app', ZOMBIE_STATUS), { pid: 41, kind: null, rss: null });
  assert.deepEqual(childRow(42, ['python3', WORKER], '/', ZOMBIE_STATUS), {
    pid: 42,
    kind: null,
    rss: null,
  });
});

check('a zero resident set is declared UNKNOWN whole, never 0 and never half', () => {
  assert.deepEqual(childRow(43, ['python3', WORKER], '/', ZERO_STATUS), {
    pid: 43,
    kind: null,
    rss: null,
  });
});

check('a child with real bytes keeps its kind and its measurement', () => {
  assert.deepEqual(childRow(44, ['python3', WORKER], '/', LIVE_STATUS), {
    pid: 44,
    kind: 'worker',
    rss: 12345 * 1024,
  });
  assert.deepEqual(childRow(45, ['sleep', '30'], '/', LIVE_STATUS), {
    pid: 45,
    kind: 'other',
    rss: 12345 * 1024,
  });
});

// A REAL EXIT, sampled through `instrumentChildren` itself. A child holding
// 300 MB is told to exit under a parent that never reaps it, and the inventory
// is sampled in a tight loop until the child is a zombie, for up to five exits.
// Measured on a 6.18 kernel with 500 MB: about 1,300 to 2,300 samples per exit
// caught the teardown state, against one sample in one trial of a child between
// reads. But the window is milliseconds long, and on a CI runner executing
// every regression leaf at once the sampler can be descheduled through all of
// it: on 2026-10-05 a 100 MB exit there took 2,093 samples and none of them
// landed in teardown. So two claims, kept apart. Every row sampled must be
// identified with real bytes or declared unknown whole -- that is a FAIL when
// broken, on every run. Whether teardown was observed at all is reported as a
// count, and a run that never saw it says NOT OBSERVED rather than PASS,
// because it proved nothing about that state (the `childRow` checks above are
// the deterministic guard for it).
const EXITING = `
import os, time
r, w = os.pipe()
if os.fork() == 0:
    b = bytearray(300 * 1024 * 1024)
    for i in range(0, len(b), 4096): b[i] = 1
    os.write(w, b'x')
    time.sleep(0.3)
    os._exit(0)
os.read(r, 1)
print('ready', flush=True)
time.sleep(30)
`;
let samples = 0;
let teardown = 0;
let exits = 0;
const half = [];
while (exits < 5 && teardown === 0) {
  exits += 1;
  const exiting = spawn('python3', ['-c', EXITING], { stdio: ['ignore', 'pipe', 'ignore'] });
  await new Promise((resolve) => exiting.stdout.once('data', resolve));
  const until = Date.now() + 5000;
  while (Date.now() < until) {
    const sampled = instrumentChildren(exiting.pid) || [];
    if (!sampled.length) continue;
    samples += 1;
    const row = sampled[0];
    const identified = ['cli-song', 'cli-finish', 'worker', 'other'].includes(row.kind);
    if (!((identified && row.rss > 0) || (row.kind === null && row.rss === null))) half.push(row);
    let state = '';
    try {
      state = /^State:\s+(\S)/m.exec(fs.readFileSync(`/proc/${row.pid}/status`, 'utf8'))?.[1] || '';
    } catch {
      state = 'gone';
    }
    if (row.kind === null && state !== 'Z' && state !== 'gone') teardown += 1;
    if (state === 'Z' || state === 'gone') break;
  }
  exiting.kill('SIGKILL');
}

check('a real exiting child is never sampled half-declared', () => {
  assert.deepEqual(half.slice(0, 3), [], `half-declared rows: ${JSON.stringify(half.slice(0, 3))}`);
});
if (teardown > 0) {
  console.error(
    `  PASS  its teardown was sampled (${teardown} of ${samples} samples, ${exits} exit(s))`
  );
} else {
  console.error(
    `  NOT OBSERVED  teardown, in ${samples} samples over ${exits} exits — the window was shorter than ` +
      'the sampling gaps here, so the real-exit check proved nothing about that state on this run'
  );
}

if (problems.length) {
  console.error(`\nCAPACITY CHILD SAMPLER: FAIL — ${problems.length} problem(s):`);
  for (const problem of problems) console.error('  ✗ ' + problem);
  process.exit(1);
}
console.error('\nCAPACITY CHILD SAMPLER: PASS — a child dying mid-sample is recorded as present');
console.error('and unidentified, and cannot erase the live sibling the RSS proof depends on.');
