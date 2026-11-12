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
// SHARDS. --split-tests expands the package chain into independent commands: each file
// of a Node test-runner batch (retaining its flags), 24 partitions of the
// actual discovered unittest IDs, and the connector's declared integration
// parts. The default unsharded serial commands remain available unchanged.
// --costs=FILE schedules longest estimated leaves first across N*workers lanes;
// without that flag the original snake deal remains. The timing file records
// its measurement source and labels inherited estimates. New leaves are still
// mandatory and use a conservative 120-second estimate until measured.
//
// --record=FILE writes the entire inventory, assigned commands, successful or
// failed outcomes, source commit, and configuration digest. The fan-in rebuilds
// the same inventory from its checkout, then refuses missing/extra/duplicate
// commands or records, failed outcomes, and different source/configuration.
// A Python partition also checks its discovered test-ID digest at execution.
//
// Usage: node scripts/run_parallel.js <script-name> [--workers=N] [--shard=K/N]
//          [--split-tests] [--costs=FILE] [--record=FILE] [--list|--list-json]
//        node scripts/run_parallel.js <script-name> --verify-shards=DIR --shards=N
//          [--split-tests] [--costs=FILE] [--workers=N]
// Exit 0 if every leaf succeeded, 1 otherwise, 2 on a bad chain or flag.

'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, execFileSync } = require('child_process');
const { createHash } = require('crypto');

const ROOT = path.join(__dirname, '..');
const PKG = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const SCRIPTS = PKG.scripts || {};

const argv = process.argv.slice(2);
const NAME = argv.find((a) => !a.startsWith('--'));
const WORKERS = (() => {
  const flag = argv.find((a) => a.startsWith('--workers='));
  const env = process.env.PARALLEL_WORKERS;
  const n = Number((flag && flag.split('=')[1]) || env || 0);
  if ((flag || env) && (!Number.isInteger(n) || n < 1)) {
    console.error('run_parallel: --workers/PARALLEL_WORKERS must be a positive integer');
    process.exit(2);
  }
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
if (flag('split-tests') !== undefined && flag('split-tests') !== true) {
  console.error('run_parallel: --split-tests is a boolean flag with no value');
  process.exit(2);
}

if (!NAME) {
  console.error('run_parallel: name a script to expand, e.g. `test:serial`');
  process.exit(2);
}

// Expand only command forms whose independent test ownership is explicit.
// The serial package chain remains the definition: adding a test file or a
// discovered unittest adds it here without maintaining a second list.
const parents = new Map();
const inventoryDigests = {};
let nodeTestGroups;
function expandCommand(command) {
  // No flag preserves npm test's standing process boundaries and optional
  // local SDK behavior. CI explicitly requests independently audited pieces.
  if (!flag('split-tests')) {
    parents.set(command, command);
    return [command];
  }
  let expanded = [command];
  const tokens = command.split(/\s+/);
  if (
    tokens[0] === 'node' &&
    tokens[1] === '--test' &&
    tokens
      .slice(2)
      .every((token) => /^--[\w-]+(?:=[\w.-]+)?$/.test(token) || /^[\w./-]+\.m?js$/.test(token))
  ) {
    const files = tokens.slice(2).filter((token) => !token.startsWith('--'));
    const options = tokens.slice(2).filter((token) => token.startsWith('--'));
    if (files.length) {
      nodeTestGroups ||= require('./ci_node_test_groups.js').loadRegistry(ROOT);
      Object.assign(inventoryDigests, nodeTestGroups.inventoryDigests);
      expanded = files.flatMap((file) => {
        const leaf = ['node', '--test', ...options, file].join(' ');
        const grouped = nodeTestGroups.files.find((entry) => entry.source === file);
        return grouped
          ? grouped.groups.map((group) => `${grouped.environment}=${group} ${leaf}`)
          : [leaf];
      });
    }
  }
  const discovery =
    /^((?:[A-Z_]+=\S+\s+)*)python3 -m unittest discover -s ([\w./-]+) -p ([\w.*-]+)$/.exec(command);
  if (discovery) {
    const [, environment, directory, pattern] = discovery;
    const inventory = JSON.parse(
      execFileSync(
        'python3',
        [
          path.join(ROOT, 'scripts/run_unittest.py'),
          `--start-directory=${directory}`,
          `--pattern=${pattern}`,
          '--list-json',
        ],
        { cwd: ROOT, encoding: 'utf8' }
      )
    );
    const count = Math.min(24, inventory.ids.length);
    expanded = Array.from(
      { length: count },
      (_, i) =>
        `${environment}python3 scripts/run_unittest.py --start-directory=${directory} --pattern=${pattern} --shard=${i + 1}/${count} --expect=${inventory.sha256}`
    );
  }
  if (command === 'node scripts/regression_recipes.js') {
    const inventory = JSON.parse(
      execFileSync(
        process.execPath,
        [path.join(ROOT, 'scripts/regression_recipes.js'), '--list-shards=4'],
        { cwd: ROOT, encoding: 'utf8' }
      )
    );
    const owned = Array.isArray(inventory.shards)
      ? inventory.shards.flatMap((part) => part.fixtures)
      : [];
    if (
      inventory.version !== 1 ||
      !/^[a-f0-9]{64}$/.test(inventory.sha256) ||
      !Array.isArray(inventory.fixtures) ||
      !inventory.fixtures.length ||
      new Set(inventory.fixtures).size !== inventory.fixtures.length ||
      new Set(owned).size !== owned.length ||
      JSON.stringify([...owned].sort()) !== JSON.stringify([...inventory.fixtures].sort()) ||
      JSON.stringify(inventory.shards.map((part) => part.shard)) !==
        JSON.stringify(['1/4', '2/4', '3/4', '4/4'])
    )
      throw new Error(
        'run_parallel: recipe shards are not one complete disjoint fixture inventory'
      );
    expanded = inventory.shards.map(
      // The outer pool already owns four CPU lanes. Keep each recipe hand
      // on one lane instead of nesting another one-Worker-per-core pool.
      (part) => `REGRESSION_SERIAL=1 ${command} --shard=${part.shard} --expect=${inventory.sha256}`
    );
  }
  if (command === 'node mcp/test.mjs') {
    // Inventory must not import the connector: the fan-in intentionally has
    // no installed SDK/express tree. The suite reads this same declaration.
    const inventoryPath = 'scripts/ci_mcp_test_parts.json';
    const inventoryText = fs.readFileSync(path.join(ROOT, inventoryPath), 'utf8');
    const parts = JSON.parse(inventoryText);
    inventoryDigests[inventoryPath] = createHash('sha256').update(inventoryText).digest('hex');
    if (
      !Array.isArray(parts) ||
      parts.length === 0 ||
      new Set(parts).size !== parts.length ||
      parts.some((part) => typeof part !== 'string' || !/^[a-z-]+$/.test(part))
    )
      throw new Error('run_parallel: invalid connector part inventory');
    expanded = parts.map((part) => `${command} --part=${part}`);
  }
  expanded.forEach((leaf) => parents.set(leaf, command));
  return expanded;
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
    else out.push(...expandCommand(link));
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
if (new Set(ALL).size !== ALL.length) {
  console.error('run_parallel: the expanded chain contains duplicate leaf commands');
  process.exit(2);
}
const hash = (value) => createHash('sha256').update(value).digest('hex');
const costsPath = flag('costs');
let costText = '';
let weights = {};
try {
  if (costsPath !== undefined) {
    costText = fs.readFileSync(path.resolve(String(costsPath)), 'utf8');
    weights = JSON.parse(costText).seconds;
    if (
      !weights ||
      typeof weights !== 'object' ||
      Array.isArray(weights) ||
      Object.values(weights).some((value) => !Number.isFinite(value) || value <= 0)
    )
      throw new Error('costs must contain a seconds object with positive finite values');
  }
} catch (error) {
  console.error(`run_parallel: invalid --costs: ${error.message}`);
  process.exit(2);
}
const siblingCounts = new Map();
for (const parent of parents.values())
  siblingCounts.set(parent, (siblingCounts.get(parent) || 0) + 1);
const estimate = (command) =>
  weights[command] ||
  (weights[parents.get(command)]
    ? weights[parents.get(command)] / siblingCounts.get(parents.get(command))
    : 120);
const MANIFEST = hash(
  JSON.stringify({
    name: NAME,
    leaves: ALL,
    costs: hash(costText),
    workers: WORKERS,
    splitTests: flag('split-tests') === true,
    inventoryDigests,
  })
);
const SOURCE = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
// Without a timing file the standing snake deal is unchanged. With measured
// costs, LPT deals to N*workers lanes, interleaved across N runners so their
// largest leaves start together. New/unmeasured commands get a conservative
// two-minute estimate and are still part of the exact inventory.
function owners(n) {
  if (!costText)
    return ALL.map((_, i) => {
      const position = i % n;
      return Math.floor(i / n) % 2 === 0 ? position + 1 : n - position;
    });
  const loads = Array(n * WORKERS).fill(0);
  const assigned = new Array(ALL.length);
  const ordered = ALL.map((command, index) => ({
    command,
    index,
    seconds: estimate(command),
  })).sort((a, b) => b.seconds - a.seconds || a.index - b.index);
  for (const leaf of ordered) {
    let lane = 0;
    for (let i = 1; i < loads.length; i++) if (loads[i] < loads[lane]) lane = i;
    loads[lane] += leaf.seconds;
    assigned[leaf.index] = (lane % n) + 1;
  }
  return assigned;
}
const assignments = new Map();
const assignment = (n) => {
  if (!assignments.has(n)) assignments.set(n, owners(n));
  return assignments.get(n);
};
function selected(k, n) {
  const chosen = ALL.filter((_, i) => assignment(n)[i] === k);
  return costText
    ? chosen.sort((a, b) => estimate(b) - estimate(a) || ALL.indexOf(a) - ALL.indexOf(b))
    : chosen;
}

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
  const owner = new Map();
  for (const r of recs) {
    if (r.version !== 2 || r.manifest !== MANIFEST || r.source !== SOURCE)
      problems.push(
        `${r.shard} has a different source, manifest, worker count, or timing configuration`
      );
    if (r.name !== NAME) problems.push(`${r.shard} expanded '${r.name}', not '${NAME}'`);
    if (JSON.stringify(r.leaves) !== JSON.stringify(ALL))
      problems.push(`${r.shard} saw a different leaf list from this checkout's '${NAME}'`);
    const coordinate = /^(\d+)\/(\d+)$/.exec(String(r.shard));
    const expected =
      coordinate &&
      Number(coordinate[2]) === n &&
      Number(coordinate[1]) >= 1 &&
      Number(coordinate[1]) <= n
        ? selected(Number(coordinate[1]), n)
        : null;
    if (!expected || JSON.stringify(r.ran) !== JSON.stringify(expected))
      problems.push(`${r.shard} did not execute its exact assigned leaf list`);
    if (
      !Array.isArray(r.outcomes) ||
      JSON.stringify(r.outcomes.map((outcome) => outcome.cmd)) !== JSON.stringify(r.ran) ||
      r.outcomes.some((outcome) => outcome.code !== 0)
    )
      problems.push(`${r.shard} has missing, unexpected, or failed leaf outcomes`);
    for (const command of Array.isArray(r.ran) ? r.ran : []) {
      if (!ALL.includes(command)) problems.push(`${r.shard} ran unexpected leaf '${command}'`);
      if (owner.has(command))
        problems.push(`'${command}' ran on both ${owner.get(command)} and ${r.shard}`);
      else owner.set(command, r.shard);
    }
  }
  const unrun = ALL.filter((command) => !owner.has(command));
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

if (flag('list-json')) {
  console.log(
    JSON.stringify({
      name: NAME,
      manifest: MANIFEST,
      source: SOURCE,
      inventoryDigests,
      leaves: ALL.map((command, i) => ({
        command,
        parent: parents.get(command),
        seconds: estimate(command),
        shard: SHARD ? assignment(SHARD.n)[i] : null,
      })),
    })
  );
  // Returning from this CommonJS module prevents execution below while Node
  // naturally drains a large inventory through an asynchronous stdout pipe.
  return;
}
if (flag('list')) {
  ALL.forEach((c, i) => console.log(SHARD ? `${assignment(SHARD.n)[i]}/${SHARD.n}\t${c}` : c));
  return;
}

leaves = SHARD
  ? selected(SHARD.k, SHARD.n)
  : costText
    ? [...ALL].sort((a, b) => estimate(b) - estimate(a))
    : ALL;
if (costText) {
  const unknown = ALL.filter((command) => !weights[command] && !weights[parents.get(command)]);
  console.log(
    `run_parallel: measured LPT schedule (${unknown.length} new leaves estimated at 120s each)`
  );
}
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
        {
          version: 2,
          name: NAME,
          source: SOURCE,
          manifest: MANIFEST,
          shard: SHARD ? `${SHARD.k}/${SHARD.n}` : null,
          leaves: ALL,
          ran: leaves,
          outcomes: results.map(({ cmd, code, seconds }) => ({ cmd, code, seconds })),
        },
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
