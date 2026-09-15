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
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { instrumentChildren } from './lyrics_capacity_queue.mjs';

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

if (problems.length) {
  console.error(`\nCAPACITY CHILD SAMPLER: FAIL — ${problems.length} problem(s):`);
  for (const problem of problems) console.error('  ✗ ' + problem);
  process.exit(1);
}
console.error('\nCAPACITY CHILD SAMPLER: PASS — a child dying mid-sample is recorded as present');
console.error('and unidentified, and cannot erase the live sibling the RSS proof depends on.');
