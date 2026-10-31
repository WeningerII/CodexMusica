#!/usr/bin/env node
// faults_shards.js — the fan-in for `faults.js --shard=K/N --record=FILE`.
//
// WHY THIS EXISTS. A full fault-injection run was one 30-minute process on the
// `freshness` runner, the longest step in PR CI (run 41118387628: build 11.7
// min + injection 29.8 min = the run's wall). Dealt across N runners it is
// N shorter processes — but a sharded run is PARTIAL, exactly as --only is,
// and a partial run asserts neither of the two things that make "every gate is
// two-sided" true. This script asserts both, over the N records together:
//
//   1. EVERY CLASS RAN EXACTLY ONCE. Each record lists the classes its run
//      opened, in order, and the ones it ran. The N lists must be identical
//      (the same tree dealt the same way), the N ran-sets disjoint, and their
//      union the whole list. A shard that silently ran nothing, a class two
//      shards both claimed, or one no shard claimed, each fails here.
//   2. EVERY PROMISE-BOUND GATE HAS A FAULT CLASS — the completeness check
//      faults.js makes on a full run, over the union of the N runs' verdicts.
//
// And it restates the verdicts: any class that escaped fails the fan-in too,
// so a reader of this one job's log sees every escape without opening shards.
//
// Usage: node scripts/faults_shards.js DIR N
//   DIR holds the N record files (any *.json beneath it); N is the shard count
//   the workflow dealt, so a missing record is a failure, not a smaller N.
// Exit 0 when both hold and nothing escaped, 1 otherwise, 2 on bad usage.

'use strict';
const fs = require('fs');
const path = require('path');

const [DIR, N_RAW] = process.argv.slice(2);
const N = Number(N_RAW);
if (!DIR || !Number.isInteger(N) || N < 1) {
  console.error('usage: node scripts/faults_shards.js DIR N');
  process.exit(2);
}

function records(dir) {
  const out = [];
  const walk = (p) => {
    for (const e of fs.readdirSync(p, { withFileTypes: true })) {
      const f = path.join(p, e.name);
      if (e.isDirectory()) walk(f);
      else if (e.name.endsWith('.json')) out.push(f);
    }
  };
  walk(dir);
  return out.map((f) => ({ file: f, ...JSON.parse(fs.readFileSync(f, 'utf8')) }));
}

const problems = [];
const recs = fs.existsSync(DIR) ? records(DIR) : [];
const shards = recs.map((r) => r.shard).sort();
const want = Array.from({ length: N }, (_, i) => `${i + 1}/${N}`).sort();
if (JSON.stringify(shards) !== JSON.stringify(want))
  problems.push(`records are for shards [${shards.join(', ')}], expected [${want.join(', ')}]`);
for (const r of recs) {
  if (r.only) problems.push(`${r.shard}: was also run with --only, so it is not a shard`);
  if (!r.fresh) problems.push(`${r.shard}: ran without --fresh-api/--fresh-html`);
}

const lists = new Set(recs.map((r) => JSON.stringify(r.classes)));
if (lists.size > 1) problems.push('the shards opened different class lists, so the deal differs');
const classes = recs.length ? recs[0].classes : [];
const owner = new Map();
for (const r of recs)
  for (const c of r.ran) {
    if (owner.has(c)) problems.push(`class ${c} ran on both ${owner.get(c)} and ${r.shard}`);
    else owner.set(c, r.shard);
  }
const unrun = classes.filter((c) => !owner.has(c));
if (unrun.length) problems.push(`no shard ran: ${unrun.join(', ')}`);
const stray = [...owner.keys()].filter((c) => !classes.includes(c));
if (stray.length) problems.push(`ran but not in the class list: ${stray.join(', ')}`);

const results = recs.flatMap((r) => r.results);
const escaped = results.filter((r) => !r.caught);
const PROMISES = require('./_promises.js');
const faulted = new Set(results.map((r) => r.cls.split('->').pop().trim()));
const uncovered = [...new Set(PROMISES.map((p) => p.gate))].filter(
  (g) => g !== 'faults.js' && !faulted.has(g)
);

console.log(
  `=== Fault-injection shards: ${recs.length}/${N} records, ${classes.length} classes, ` +
    `${results.length} gate-class(es) tested, ${escaped.length} escape(s) ===`
);
for (const r of recs.sort((a, b) => (a.shard < b.shard ? -1 : a.shard > b.shard ? 1 : 0)))
  console.log(`  shard ${r.shard}: ran ${r.ran.length}, ${r.results.length} verdict(s)`);
for (const p of problems) console.error(`  ✗ partition: ${p}`);
for (const e of escaped) console.error(`  ✗ ${e.cls}  [${e.reason}]`);
for (const g of uncovered) console.error(`  ✗ ${g}  (a promise-bound gate with NO fault class)`);
if (problems.length || escaped.length || uncovered.length) {
  console.error('FAIL — the shards together are not a full, two-sided fault-injection run.');
  process.exit(1);
}
console.log(
  'PASS — every class ran on exactly one shard, every injected defect was caught, and every promise-bound gate has a fault class. All gates are two-sided.'
);
