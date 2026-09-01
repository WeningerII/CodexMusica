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
// Usage: node scripts/run_parallel.js <script-name> [--workers=N]
// Exit 0 if every leaf succeeded, 1 otherwise.

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

console.log(`run_parallel: ${leaves.length} leaf command(s) from '${NAME}', ${WORKERS} at a time`);

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
    process.exit(1);
  }
  console.log(`every leaf of '${NAME}' passed`);
}

if (leaves.length === 0) {
  console.error(`run_parallel: '${NAME}' expanded to nothing`);
  process.exit(2);
}
launch();
