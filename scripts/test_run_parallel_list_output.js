#!/usr/bin/env node
'use strict';
// Inventory is a required gate's input. A successful listing must survive pipe
// backpressure, and listing must never start any of its executable leaves.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ci-list-output-'));
const scripts = path.join(root, 'scripts');
const sentinel = path.join(root, 'executed');
const runnerPath = path.join(scripts, 'run_parallel.js');
const mutantPath = path.join(scripts, 'run_parallel_immediate_exit.js');
const deferredPath = path.join(root, 'deferred-stdout.cjs');
const errorPath = path.join(root, 'failed-stdout.cjs');
const runner = fs.readFileSync(path.join(__dirname, 'run_parallel.js'), 'utf8');
const commands = Array.from(
  { length: 217 },
  (_, index) =>
    `node -e "require('node:fs').appendFileSync('executed','ran')" ${index} ${'x'.repeat(320)}`
);
let checks = 0;
const run = (flag, preload, file = runnerPath) =>
  spawnSync(process.execPath, [...(preload ? ['--require', preload] : []), file, 'fixture', flag], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, NODE_OPTIONS: '' },
    maxBuffer: 4 * 1024 * 1024,
    timeout: 10000,
  });
const assertJson = (result) => {
  assert.equal(result.status, 0, result.stderr || String(result.error || ''));
  assert.ok(
    Buffer.byteLength(result.stdout) > 65536,
    'fixture exceeds the observed truncation size'
  );
  const inventory = JSON.parse(result.stdout);
  assert.equal(inventory.name, 'fixture');
  assert.equal(inventory.leaves.length, 217);
  assert.deepEqual(
    inventory.leaves.map((leaf) => leaf.command),
    commands
  );
  assert.equal(inventory.leaves.at(-1).command, commands.at(-1));
  assert.equal(fs.existsSync(sentinel), false, 'listing must not execute a leaf');
};
const assertList = (result) => {
  assert.equal(result.status, 0, result.stderr || String(result.error || ''));
  assert.ok(Buffer.byteLength(result.stdout) > 65536, 'text fixture also exceeds the pipe limit');
  assert.equal(result.stdout, `${commands.join('\n')}\n`);
  assert.equal(result.stdout.trimEnd().split('\n').at(-1), commands.at(-1));
  assert.equal(fs.existsSync(sentinel), false, 'listing must not execute a leaf');
};

try {
  fs.mkdirSync(scripts);
  fs.writeFileSync(runnerPath, runner);
  fs.writeFileSync(
    path.join(root, 'package.json'),
    JSON.stringify({ scripts: { fixture: commands.join(' && ') } })
  );
  for (const args of [
    ['init', '--quiet'],
    [
      '-c',
      'user.name=CI fixture',
      '-c',
      'user.email=ci-fixture@example.invalid',
      'commit',
      '--quiet',
      '--allow-empty',
      '-m',
      'Fixture source identity',
    ],
  ]) {
    const git = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
    assert.equal(git.status, 0, git.stderr);
  }
  // A real pipe is used in every run. Deferring writes by one event-loop turn
  // makes pending output deterministic without relying on OS capacity/timing.
  fs.writeFileSync(
    deferredPath,
    `const write = process.stdout.write.bind(process.stdout);
process.stdout.write = (...args) => {
  setImmediate(() => write(...args));
  return false;
};
`
  );
  fs.writeFileSync(
    errorPath,
    `process.stdout.write = () => {
  setImmediate(() => process.stdout.emit('error', new Error('forced inventory output failure')));
  return false;
};
`
  );

  assertJson(run('--list-json'));
  checks++;
  assertJson(run('--list-json', deferredPath));
  checks++;
  assertList(run('--list'));
  checks++;
  assertList(run('--list', deferredPath));
  checks++;

  const listStart = runner.indexOf("if (flag('list-json')) {");
  const executionStart = runner.indexOf('\nleaves = SHARD', listStart);
  assert.ok(listStart >= 0 && executionStart > listStart);
  const listing = runner.slice(listStart, executionStart);
  assert.equal((listing.match(/\breturn;/g) || []).length, 2);
  fs.writeFileSync(
    mutantPath,
    runner.slice(0, listStart) +
      listing.replace(/\breturn;/g, 'process.exit(0);') +
      runner.slice(executionStart)
  );
  const truncatedJson = run('--list-json', deferredPath, mutantPath);
  assert.equal(truncatedJson.status, 0, truncatedJson.stderr);
  assert.throws(() => assertJson(truncatedJson), 'immediate-exit JSON mutation must be detected');
  checks++;
  const truncatedList = run('--list', deferredPath, mutantPath);
  assert.equal(truncatedList.status, 0, truncatedList.stderr);
  assert.throws(() => assertList(truncatedList), 'immediate-exit text mutation must be detected');
  checks++;

  for (const flag of ['--list-json', '--list']) {
    const failed = run(flag, errorPath);
    assert.notEqual(failed.status, 0, 'an asynchronous inventory write error must not succeed');
    assert.match(failed.stderr, /forced inventory output failure/);
    checks++;
  }
  assert.equal(
    fs.existsSync(sentinel),
    false,
    'no positive, negative or error control ran any leaf'
  );
  console.log(`run_parallel list-output controls: ${checks} passed`);
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
