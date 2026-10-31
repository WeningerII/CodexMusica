#!/usr/bin/env node
// run_parallel.js — run an `&&` chain of npm scripts CONCURRENTLY instead of
// in a queue, without the chain being written down a second time.
//
// NO `@covers:` TAG, DELIBERATELY. That tag is for a GATE that enforces a
// documented promise, and `check_promises.js` holds it to a bijection: a
// registry row in `_promises.js`, a `<!-- @promise: id -->` doc marker, and
// the tag. This file enforces nothing about the product — it RUNS the checks
// that do, and claiming coverage it does not provide is exactly the shape
// that bijection exists to refuse. (It refused this file on first push, which
// is the check working.)
//
// WHY: `npm run test` was eleven npm scripts joined by `&&`, one of which
// (`test:connector`) was twelve more `node` processes joined the same way —
// about twenty-five independent processes run strictly one after another on a
// four-vCPU runner. MEASURED 2026-09-01: the step is 1153s, and it is two
// items that carry it (`mcp/test.mjs` and `test:recipes`) with a queue of
// near-free checks stuck behind them. Every leaf is a `--check` or a
// regression that reads the tree and writes nothing shared, so the queue was
// buying nothing but wall clock.
//
// ONE DEFINITION (doctrine 1). The chain is NOT copied into this file or into
// `ci.yml`. This runner is handed the NAME of a script and reads that script's
// own text out of `package.json`, splitting it on `&&` and following every
// `npm run X` link recursively down to leaf commands. So the serial chain
// stays the single source of truth, stays runnable on its own, and adding a
// check to it adds the check here with no second edit.
//
// THE GATE NAMES WHAT FAILED, and each leaf's output is buffered and printed
// WHOLE when that leaf finishes rather than streamed — concurrent streams
// interleave line by line, and a failure whose reason is scattered through a
// four-way mix is a failure a reader cannot act on.
//
// EVERY LEAF IS TIMED AND THE TIMINGS PRINT ON GREEN RUNS TOO. A cost that is
// only visible when something fails is a cost nobody sees, and the slowest
// leaf is the floor no worker count can beat.
//
// SHARDS (2026-10-30). CI's `verify` step was this runner over 89 leaves:
// 6,310 leaf-seconds, 29.4 min of wall on one four-vCPU machine (run
// 41118387628), the second-longest job in PR CI. --shard=K/N deals the
// flattened chain to N machines in a SNAKE (1,2,…,N,N,…,2,1,1,2,…) and keeps
// the Kth hand. Not round-robin: the chain's costly leaves cluster, and on that
// run's leaf costs a plain 1,2,1,2 deal gave 14.0 and 19.4 simulated minutes
// where the snake gives 15.3 and 15.2 (the 748 s mcp/test.mjs is the floor).
// The chain is still read from package.json, so a leaf added there lands on
// exactly one shard with no second edit. --record=FILE writes the whole leaf
// list and the ones this shard ran; `--verify-shards=DIR --shards=N` reads N
// such records and fails unless the N lists are identical and every leaf ran
// on exactly one shard, the same claim one unsharded run makes by itself.
// --list prints the leaves (with --shard, each with its shard) and runs none.
//
// Usage: node scripts/run_parallel.js <script-name> [--workers=N] [--shard=K/N]
//                                     [--record=FILE] [--list]
//        node scripts/run_parallel.js <script-name> --verify-shards=DIR --shards=N
// Exit 0 if every leaf succeeded, 1 otherwise, 2 on a bad chain or flag.

'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const PKG = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const SCRIPTS = PKG.scripts || {};

const argv = process.argv.slice(2);
const NAME = argv.find((a) => !a.startsWith('--'));
const WORKERS = (() => {
  const flag = argv.find((a) => a.startsWith('--workers='));
  const env = process.env.PARALLEL_WORKERS;
  const n = Number((flag && flag.split('=')[1]) || env || 0);
  return n > 0 ? n : Math.min(4, os.cpus().length || 1);
})();

const flag = (k) => {
  const a = argv.find((x) => x === `--${k}` || x.startsWith(`--${k}=`));
  return a === undefined ? undefined : a.includes('=') ? a.slice(a.indexOf('=') + 1) : true;
};
const SHARD = (() => {
  const v = flag('shard');
  if (v === undefined) return null;
  const m = /^(\d+)\/(\d+)$/.exec(String(v));
  const k = m && Number(m[1]),
    n = m && Number(m[2]);
  if (!m || n < 1 || k < 1 || k > n) {
    console.error(`run_parallel: --shard=${v} is not K/N with 1 <= K <= N`);
    process.exit(2);
  }
  return { k, n };
})();
const RECORD = typeof flag('record') === 'string' ? path.resolve(flag('record')) : null;

if (!NAME) {
  console.error('run_parallel: name a script to expand, e.g. `test:serial`');
  process.exit(2);
}

// Flatten a script into leaf commands. A link of the form `npm run X` (with or
// without --silent) is followed; anything else is a leaf. A cycle or a missing
// script is a hard error rather than a silently short list — a runner that
// quietly runs fewer checks than the chain names is the worst failure it has.
function flatten(name, seen) {
  if (seen.has(name)) {
    throw new Error(`run_parallel: '${name}' is reached from itself — the chain is a cycle`);
  }
  if (!(name in SCRIPTS)) {
    throw new Error(`run_parallel: package.json has no script '${name}'`);
  }
  const here = new Set(seen).add(name);
  const out = [];
  for (const raw of SCRIPTS[name].split('&&')) {
    const link = raw.trim();
    if (!link) continue;
    const m = link.match(/^npm\s+run\s+(?:--silent\s+)?([\w:.-]+)$/);
    if (m) out.push(...flatten(m[1], here));
    else out.push(link);
  }
  return out;
}

let leaves;
try {
  leaves = flatten(NAME, new Set());
} catch (err) {
  console.error(String(err.message));
  process.exit(2);
}

const ALL = leaves;
// The hand leaf i is dealt to, 1-based: a snake over rows of N.
const hand = (i, n) => {
  const p = i % n;
  return Math.floor(i / n) % 2 === 0 ? p + 1 : n - p;
};
const dealt = (i) => !SHARD || hand(i, SHARD.n) === SHARD.k;

if (flag('verify-shards') !== undefined) {
  const dir = String(flag('verify-shards'));
  const n = Number(flag('shards'));
  if (!Number.isInteger(n) || n < 1) {
    console.error('run_parallel: --verify-shards needs --shards=N, the count the workflow dealt');
    process.exit(2);
  }
  const recs = (fs.existsSync(dir) ? fs.readdirSync(dir, { recursive: true }) : [])
    .filter((f) => String(f).endsWith('.json'))
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, String(f)), 'utf8')));
  const problems = [];
  const got = recs.map((r) => r.shard).sort();
  const want = Array.from({ length: n }, (_, i) => `${i + 1}/${n}`).sort();
  if (JSON.stringify(got) !== JSON.stringify(want))
    problems.push(`records are for shards [${got.join(', ')}], expected [${want.join(', ')}]`);
  for (const r of recs) {
    if (r.name !== NAME) problems.push(`${r.shard} expanded '${r.name}', not '${NAME}'`);
    if (JSON.stringify(r.leaves) !== JSON.stringify(ALL))
      problems.push(`${r.shard} saw a different leaf list from this checkout's '${NAME}'`);
  }
  const owner = new Map();
  for (const r of recs)
    for (const c of r.ran) {
      if (owner.has(c)) problems.push(`'${c}' ran on both ${owner.get(c)} and ${r.shard}`);
      else owner.set(c, r.shard);
    }
  const unrun = ALL.filter((c) => !owner.has(c));
  if (unrun.length) problems.push(`no shard ran: ${unrun.join(' | ')}`);
  for (const r of recs) console.log(`  shard ${r.shard}: ran ${r.ran.length} of ${ALL.length}`);
  for (const p of problems) console.error(`  ✗ ${p}`);
  if (problems.length) {
    console.error(`run_parallel: the ${n} shards of '${NAME}' are not one complete run`);
    process.exit(1);
  }
  console.log(
    `run_parallel: every one of ${ALL.length} leaves of '${NAME}' ran on exactly one of ${n} shards`
  );
  process.exit(0);
}

if (flag('list')) {
  ALL.forEach((c, i) => console.log(SHARD ? `${hand(i, SHARD.n)}/${SHARD.n}\t${c}` : c));
  process.exit(0);
}

leaves = ALL.filter((_, i) => dealt(i));
if (SHARD && leaves.length === 0) {
  console.error(`run_parallel: shard ${SHARD.k}/${SHARD.n} of '${NAME}' was dealt no leaf`);
  process.exit(2);
}

console.log(
  `run_parallel: ${leaves.length} leaf command(s) from '${NAME}'` +
    (SHARD ? ` (shard ${SHARD.k}/${SHARD.n} of ${ALL.length})` : '') +
    `, ${WORKERS} at a time`
);

const results = new Array(leaves.length);
let next = 0;
let running = 0;

function launch() {
  while (running < WORKERS && next < leaves.length) {
    const i = next++;
    const cmd = leaves[i];
    const started = Date.now();
    running += 1;
    const child = spawn(cmd, { cwd: ROOT, shell: true });
    const chunks = [];
    child.stdout.on('data', (d) => chunks.push(d));
    child.stderr.on('data', (d) => chunks.push(d));
    child.on('error', (err) => chunks.push(Buffer.from(String(err.message))));
    child.on('close', (code) => {
      const seconds = (Date.now() - started) / 1000;
      results[i] = { cmd, code: code === null ? 1 : code, seconds };
      if (results[i].code !== 0)
        results[i].tail = Buffer.concat(chunks).toString().split('\n').slice(-60).join('\n');
      // Printed WHOLE, as one write, so a concurrent leaf cannot land inside it.
      process.stdout.write(
        `\n── ${cmd}  (${seconds.toFixed(1)}s, exit ${results[i].code})\n` +
          Buffer.concat(chunks).toString()
      );
      running -= 1;
      if (next < leaves.length) launch();
      else if (running === 0) finish();
    });
  }
}

function finish() {
  if (RECORD)
    fs.writeFileSync(
      RECORD,
      JSON.stringify(
        { name: NAME, shard: SHARD ? `${SHARD.k}/${SHARD.n}` : null, leaves: ALL, ran: leaves },
        null,
        1
      ) + '\n'
    );
  const failed = results.filter((r) => r && r.code !== 0);
  console.log('\n' + '='.repeat(62));
  console.log('LEAF COST, slowest first — the top line is the floor a worker count cannot beat:');
  for (const r of [...results].sort((a, b) => b.seconds - a.seconds)) {
    console.log(`  ${r.seconds.toFixed(1).padStart(8)}s  ${r.cmd}`);
  }
  const cpu = results.reduce((s, r) => s + r.seconds, 0);
  console.log(
    `  ${cpu.toFixed(1).padStart(8)}s  TOTAL across ${results.length} leaves, ${WORKERS} at a time`
  );
  console.log('='.repeat(62));
  if (failed.length) {
    console.log(`${failed.length} FAILING:`);
    for (const r of failed) console.log(`  ${r.cmd}  (exit ${r.code})`);
    // Each failing leaf's last lines again, at the end: a CI log viewer that
    // shows only the tail still shows why.
    for (const r of failed) console.log(`\n── tail of ${r.cmd}\n${r.tail || ''}`);
    process.exit(1);
  }
  console.log(`every leaf of '${NAME}' passed`);
}

if (leaves.length === 0) {
  console.error(`run_parallel: '${NAME}' expanded to nothing`);
  process.exit(2);
}
launch();
