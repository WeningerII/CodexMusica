#!/usr/bin/env node
'use strict';
// Exercise the actual recipe runner with a tiny deterministic engine. The
// production fixture list and its snapshot remain untouched by these controls.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'recipe-shards-'));
const fixtures = [
  { id: 'a', traditions: ['alpha'] },
  { id: 'b', traditions: ['beta'] },
  { id: 'a', traditions: ['alpha'] },
  { id: 'c', traditions: ['gamma'] },
  { id: 'd', traditions: ['delta'] },
];
let checks = 0;
function check(condition, message) {
  assert.ok(condition, message);
  checks++;
}
try {
  fs.mkdirSync(path.join(temp, 'scripts'));
  fs.mkdirSync(path.join(temp, 'tests'));
  const source = fs.readFileSync(path.join(__dirname, 'regression_recipes.js'), 'utf8');
  const start = source.indexOf('const FIXTURES = [');
  const end = source.indexOf('\n];\n\n// Compute', start) + 3;
  assert.ok(start >= 0 && end > start);
  fs.writeFileSync(
    path.join(temp, 'scripts/regression_recipes.js'),
    source.slice(0, start) + `const FIXTURES = ${JSON.stringify(fixtures)};` + source.slice(end)
  );
  fs.writeFileSync(
    path.join(temp, 'scripts/search.js'),
    `
const fs = require('fs');
exports.seedFromTradition = (primary, staples) => ({ primary, staples });
exports.search = (config) => {
  fs.appendFileSync(process.env.RECIPE_AUDIT, config.primary + '\\n');
  return { config };
};
`
  );
  fs.writeFileSync(
    path.join(temp, 'scripts/translate.js'),
    'exports.translate = (config) => JSON.stringify(config);\n'
  );
  const snapshotPath = path.join(temp, 'tests/regression_snapshot.json');
  const audit = path.join(temp, 'audit.txt');
  const baseline = Object.fromEntries(
    fixtures.map((fixture) => [
      fixture.id,
      {
        output: JSON.stringify({ primary: fixture.traditions[0], staples: [] }),
        traditions: fixture.traditions,
      },
    ])
  );
  const save = (snapshot) => fs.writeFileSync(snapshotPath, JSON.stringify(snapshot));
  save(baseline);
  const run = (args) =>
    spawnSync(process.execPath, ['scripts/regression_recipes.js', ...args], {
      cwd: temp,
      env: { ...process.env, RECIPE_AUDIT: audit },
      encoding: 'utf8',
    });
  const list = run(['--list-shards=4']);
  check(list.status === 0, list.stderr);
  check(!fs.existsSync(audit), 'listing computes no fixtures');
  const inventory = JSON.parse(list.stdout);
  const union = inventory.shards.flatMap((shard) => shard.fixtures);
  check(
    union.length === 4 &&
      new Set(union).size === 4 &&
      [...union].sort().join() === [...inventory.fixtures].sort().join(),
    'four-part inventory is complete and disjoint'
  );
  check(
    inventory.shards.every((shard) => shard.fixtures.length === 1),
    'duplicate fixture IDs share one shard'
  );

  check(run([]).status === 0, 'default full run still passes');
  const fullCalls = fs.readFileSync(audit, 'utf8').trim().split('\n').sort();
  fs.unlinkSync(audit);
  for (const shard of inventory.shards) {
    const result = run([`--shard=${shard.shard}`, `--expect=${inventory.sha256}`]);
    check(result.status === 0, result.stdout + result.stderr);
  }
  const shardCalls = fs.readFileSync(audit, 'utf8').trim().split('\n').sort();
  check(
    JSON.stringify(fullCalls) === JSON.stringify(shardCalls) &&
      shardCalls.filter((word) => word === 'alpha').length === 2,
    'shards preserve every original fixture-row computation, duplicates included'
  );

  for (const value of ['0/4', '5/4', '1/0', '1/x', '1.5/4', '1/5']) {
    check(run([`--shard=${value}`]).status === 2, `invalid shard ${value} refuses`);
  }
  check(
    run(['--shard=1/4', '--update']).status === 2,
    'sharded update cannot create a partial baseline'
  );
  check(
    run(['--shard=1/4', '--fixture=a']).status === 2,
    'fixture filter cannot silently narrow a shard'
  );
  check(run(['--list-shards=0']).status === 2, 'invalid inventory count refuses');
  check(run(['--fixture=missing']).status === 2, 'unknown fixture refuses');
  check(run(['--shard=1/4', '--expect=stale']).status === 2, 'stale fixture identity refuses');

  save({ ...baseline, orphan: baseline.a });
  const removed = run(['--shard=1/4']);
  check(
    removed.status === 1 && removed.stdout.includes('REMOVED FIXTURES'),
    'shard 1 retains removed-snapshot-entry assertion'
  );
  check(
    run(['--shard=2/4']).status === 0,
    'another shard does not call a legitimately unowned fixture removed'
  );
  const added = { ...baseline };
  delete added.c;
  save(added);
  const newlyAdded = run(['--shard=3/4']);
  check(
    newlyAdded.status === 1 && newlyAdded.stdout.includes('NEW FIXTURES'),
    'owner retains new-unsnapshotted-fixture assertion'
  );
  save({ ...baseline, c: { ...baseline.c, output: 'changed' } });
  check(run(['--shard=3/4']).status === 1, 'owner retains output mismatch assertion');
  check(
    run(['--shard=3/4', `--expect=${inventory.sha256}`]).status === 2,
    'snapshot-byte change invalidates the listed identity'
  );
  save(baseline);
  check(run(['--fixture=a']).status === 0, 'existing fixture mode still passes');
  check(
    fs.readFileSync(snapshotPath, 'utf8') === JSON.stringify(baseline),
    'validation and denied partial-update controls leave baseline untouched'
  );
  console.log(`test_regression_shards: ${checks} partition and negative controls passed`);
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
