#!/usr/bin/env node
'use strict';
// CI's fan-in is a required gate. Exercise its refusal paths with fabricated
// artifacts; an omitted/duplicated/failed test must never paint it green.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.join(__dirname, '..');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ci-leaves-'));
const run = (args) =>
  spawnSync(process.execPath, ['scripts/run_parallel.js', ...args], {
    cwd: root,
    encoding: 'utf8',
  });
const parse = (args) => {
  const result = run([...args, '--list-json']);
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
};
let checks = 0;
try {
  // Use a small real chain so artifact validation is tested independently of
  // expensive product tests, while the full-chain inventory proves the splits.
  const name = 'test:geography';
  const args = [name, '--split-tests', '--costs=scripts/ci_verify_costs.json'];
  const inventory = parse([...args, '--shard=1/2']);
  const records = [1, 2].map((k) => {
    const selected = inventory.leaves
      .filter((leaf) => leaf.shard === k)
      .sort(
        (a, b) => b.seconds - a.seconds || inventory.leaves.indexOf(a) - inventory.leaves.indexOf(b)
      );
    return {
      version: 2,
      name,
      source: inventory.source,
      manifest: inventory.manifest,
      shard: `${k}/2`,
      leaves: inventory.leaves.map((leaf) => leaf.command),
      ran: selected.map((leaf) => leaf.command),
      outcomes: selected.map((leaf) => ({ cmd: leaf.command, code: 0, seconds: 1 })),
    };
  });
  const verify = (recs) => {
    fs.rmSync(path.join(temp, 'records'), { recursive: true, force: true });
    fs.mkdirSync(path.join(temp, 'records'));
    recs.forEach((record, i) =>
      fs.writeFileSync(path.join(temp, 'records', `${i}.json`), JSON.stringify(record))
    );
    return run([...args, `--verify-shards=${path.join(temp, 'records')}`, '--shards=2']);
  };
  assert.equal(verify(records).status, 0, 'complete successful artifacts pass');
  checks++;
  const changedConfiguration = run([
    name,
    '--costs=scripts/ci_verify_costs.json',
    `--verify-shards=${path.join(temp, 'records')}`,
    '--shards=2',
  ]);
  assert.notEqual(
    changedConfiguration.status,
    0,
    'split-tests configuration mismatch must fail even for a chain with unchanged leaves'
  );
  checks++;
  const clone = () => JSON.parse(JSON.stringify(records));
  const mutations = [
    ['missing shard', () => records.slice(1)],
    ['duplicate shard', () => [...records, records[0]]],
    [
      'source mismatch',
      () => {
        const r = clone();
        r[0].source = '0'.repeat(40);
        return r;
      },
    ],
    [
      'manifest mismatch',
      () => {
        const r = clone();
        r[0].manifest = '0'.repeat(64);
        return r;
      },
    ],
    [
      'missing leaf',
      () => {
        const r = clone();
        r[0].ran.pop();
        r[0].outcomes.pop();
        return r;
      },
    ],
    [
      'extra leaf',
      () => {
        const r = clone();
        r[0].ran.push('node nonexistent-test.js');
        r[0].outcomes.push({ cmd: 'node nonexistent-test.js', code: 0 });
        return r;
      },
    ],
    [
      'duplicate leaf',
      () => {
        const r = clone();
        r[0].ran.push(r[0].ran[0]);
        r[0].outcomes.push(r[0].outcomes[0]);
        return r;
      },
    ],
    [
      'failed leaf',
      () => {
        const r = clone();
        r[0].outcomes[0].code = 1;
        return r;
      },
    ],
    [
      'missing outcome',
      () => {
        const r = clone();
        r[0].outcomes.pop();
        return r;
      },
    ],
    [
      'old evidence shape',
      () => {
        const r = clone();
        delete r[0].version;
        return r;
      },
    ],
  ];
  for (const [label, mutate] of mutations) {
    const result = verify(mutate());
    assert.notEqual(result.status, 0, `${label} must fail`);
    checks++;
  }
  const full = parse(['test:ci:serial', '--split-tests']);
  const ordinary = parse(['test:ci:serial']).leaves.map((leaf) => leaf.command);
  assert.ok(ordinary.includes('node mcp/test.mjs'));
  assert.ok(ordinary.includes('node scripts/regression_recipes.js'));
  assert.ok(ordinary.some((command) => command.includes('python3 -m unittest discover')));
  assert.ok(!ordinary.some((command) => command.includes('scripts/run_unittest.py')));
  checks++;
  const commands = full.leaves.map((leaf) => leaf.command);
  assert.equal(new Set(commands).size, commands.length);
  const connector = commands.filter((command) => command.startsWith('node mcp/test.mjs --part='));
  assert.deepEqual(
    connector.map((command) => command.split('=').at(-1)),
    ['offline', 'live-revision', 'live-title', 'live-lookups']
  );
  checks++;
  assert.equal(
    commands.filter((command) => command.includes('scripts/run_unittest.py ')).length,
    12
  );
  checks++;
  const recipes = commands.filter((command) =>
    command.startsWith('node scripts/regression_recipes.js --shard=')
  );
  assert.equal(recipes.length, 4);
  assert.deepEqual(
    recipes.map((command) => /--shard=(\S+)/.exec(command)[1]),
    ['1/4', '2/4', '3/4', '4/4']
  );
  assert.ok(recipes.every((command) => /--expect=[a-f0-9]{64}$/.test(command)));
  checks++;
  const offline = commands.filter((command) => command.includes('--test-timeout=120000'));
  const productionCommand = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
    .scripts['test:production:offline'].split('&&')[0]
    .trim();
  const productionFiles = productionCommand.split(/\s+/).filter((token) => token.endsWith('.mjs'));
  assert.deepEqual(
    offline.map((command) => command.split(' ').at(-1)),
    productionFiles
  );
  assert.ok(
    offline.every((command) =>
      command.startsWith('node --test --test-concurrency=1 --test-timeout=120000 ')
    )
  );
  assert.ok(
    offline.every(
      (command) => command.split(' ').filter((token) => token.endsWith('.mjs')).length === 1
    )
  );
  checks++;

  // The fan-in enumerates the shared declaration without importing SDK code.
  // A clean fixture tree intentionally has neither mcp/ nor node_modules/.
  const sharedParts = JSON.parse(
    fs.readFileSync(path.join(root, 'scripts/ci_mcp_test_parts.json'), 'utf8')
  );
  const listedParts = spawnSync(process.execPath, ['mcp/test.mjs', '--list-parts'], {
    cwd: root,
    encoding: 'utf8',
  });
  assert.equal(listedParts.status, 0, listedParts.stderr);
  assert.deepEqual(JSON.parse(listedParts.stdout), sharedParts);
  checks++;
  const cleanRoot = path.join(temp, 'dependency-free');
  fs.mkdirSync(path.join(cleanRoot, 'scripts'), { recursive: true });
  fs.copyFileSync(
    path.join(root, 'scripts/run_parallel.js'),
    path.join(cleanRoot, 'scripts/run_parallel.js')
  );
  fs.writeFileSync(
    path.join(cleanRoot, 'package.json'),
    JSON.stringify({ scripts: { inventory: 'node mcp/test.mjs' } })
  );
  const gitDirectory = spawnSync('git', ['rev-parse', '--absolute-git-dir'], {
    cwd: root,
    encoding: 'utf8',
  });
  assert.equal(gitDirectory.status, 0, gitDirectory.stderr);
  const sharedPath = path.join(cleanRoot, 'scripts/ci_mcp_test_parts.json');
  const cleanList = () =>
    spawnSync(
      process.execPath,
      ['scripts/run_parallel.js', 'inventory', '--split-tests', '--list-json'],
      {
        cwd: cleanRoot,
        env: { ...process.env, GIT_DIR: gitDirectory.stdout.trim() },
        encoding: 'utf8',
      }
    );
  fs.writeFileSync(sharedPath, JSON.stringify(sharedParts));
  const cleanInventory = cleanList();
  assert.equal(cleanInventory.status, 0, cleanInventory.stderr);
  const cleanRecord = JSON.parse(cleanInventory.stdout);
  assert.deepEqual(
    cleanRecord.leaves.map((leaf) => leaf.command),
    sharedParts.map((part) => `node mcp/test.mjs --part=${part}`)
  );
  assert.ok(cleanRecord.inventoryDigests['scripts/ci_mcp_test_parts.json']);
  assert.ok(
    !fs.existsSync(path.join(cleanRoot, 'node_modules')) &&
      !fs.existsSync(path.join(cleanRoot, 'mcp'))
  );
  checks++;
  for (const invalid of [
    [],
    ['offline', 'offline'],
    ['invalid!'],
    [1],
    [true],
    [['offline']],
    {},
    null,
  ]) {
    fs.writeFileSync(sharedPath, JSON.stringify(invalid));
    assert.equal(
      cleanList().status,
      2,
      `malformed shared part inventory ${JSON.stringify(invalid)} must fail closed`
    );
    checks++;
  }
  fs.writeFileSync(sharedPath, '{invalid JSON');
  assert.equal(cleanList().status, 2);
  checks++;
  fs.rmSync(sharedPath);
  assert.equal(cleanList().status, 2, 'missing shared inventory must fail closed');
  checks++;
  fs.writeFileSync(sharedPath, JSON.stringify(sharedParts) + '\n');
  const reformatted = cleanList();
  assert.equal(reformatted.status, 0, reformatted.stderr);
  const reformattedRecord = JSON.parse(reformatted.stdout);
  assert.deepEqual(reformattedRecord.leaves, cleanRecord.leaves);
  assert.notEqual(reformattedRecord.manifest, cleanRecord.manifest);
  assert.notEqual(
    reformattedRecord.inventoryDigests['scripts/ci_mcp_test_parts.json'],
    cleanRecord.inventoryDigests['scripts/ci_mcp_test_parts.json']
  );
  checks++;
  fs.writeFileSync(sharedPath, JSON.stringify([...sharedParts].reverse()));
  const reordered = cleanList();
  assert.equal(reordered.status, 0, reordered.stderr);
  const reorderedRecord = JSON.parse(reordered.stdout);
  assert.notEqual(reorderedRecord.manifest, cleanRecord.manifest);
  assert.notEqual(
    reorderedRecord.inventoryDigests['scripts/ci_mcp_test_parts.json'],
    cleanRecord.inventoryDigests['scripts/ci_mcp_test_parts.json']
  );
  checks++;

  // A tiny suite proves real execution, import errors, fixture lifecycles and
  // method ownership without reproducing the discovery implementation.
  const fixture = path.join(temp, 'tests');
  fs.mkdirSync(fixture);
  fs.writeFileSync(
    path.join(fixture, 'test_fixture.py'),
    `import unittest\nclass A(unittest.TestCase):\n @classmethod\n def setUpClass(cls): cls.ready=True\n def test_a(self): self.assertTrue(self.ready)\n def test_b(self): self.assertEqual(1+1,2)\nclass B(unittest.TestCase):\n def test_c(self): self.assertEqual('x'.upper(),'X')\n def test_d(self): self.assertTrue(True)\n`
  );
  const python = (extra) =>
    spawnSync('python3', ['scripts/run_unittest.py', `--start-directory=${fixture}`, ...extra], {
      cwd: root,
      encoding: 'utf8',
    });
  const listed = python(['--list-json']);
  assert.equal(listed.status, 0, listed.stderr);
  const whole = JSON.parse(listed.stdout);
  const owned = [];
  for (const k of [1, 2]) {
    const listedPart = python([`--shard=${k}/2`, '--list-json', `--expect=${whole.sha256}`]);
    assert.equal(listedPart.status, 0, listedPart.stderr);
    owned.push(...JSON.parse(listedPart.stdout).selected);
    const result = python([`--shard=${k}/2`, `--expect=${whole.sha256}`]);
    assert.equal(result.status, 0, result.stderr);
    checks++;
  }
  assert.deepEqual(owned.sort(), whole.ids);
  checks++;
  assert.equal(python(['--shard=0/2']).status, 2);
  checks++;
  assert.equal(python(['--expect=wrong']).status, 2);
  checks++;
  fs.writeFileSync(
    path.join(fixture, 'test_broken.py'),
    'raise RuntimeError("discovery must fail closed")\n'
  );
  assert.equal(python(['--list-json']).status, 2);
  checks++;
  fs.unlinkSync(path.join(fixture, 'test_broken.py'));
  fs.writeFileSync(
    path.join(fixture, 'test_failure.py'),
    'import unittest\nclass Failure(unittest.TestCase):\n def test_assertion(self): self.assertEqual(1,2)\n'
  );
  assert.equal(python([]).status, 1);
  checks++;
  console.log(
    `test_run_parallel: ${checks} ownership, fixture, and negative-control checks passed`
  );
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
