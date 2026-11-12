#!/usr/bin/env node
'use strict';
// These controls use no connector dependencies or live tests. The registrar must
// keep the default Node declarations intact and make every CI group auditable.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { loadRegistry, createRegistrar } = require('./ci_node_test_groups.js');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ci-node-groups-'));
const source = 'mcp/test_fixture.mjs';
const sourcePath = path.join(root, source);
const registryPath = path.join(root, 'scripts/ci_node_test_groups.json');
const helperPath = path.join(root, 'scripts/ci_node_test_groups.js');
const helperBytes = fs.readFileSync(path.join(__dirname, 'ci_node_test_groups.js'));
const sourceText = '// Inventory fixture: deliberately imports no SDK or model.\n';
const declarations = [
  { name: 'first case', group: 'first' },
  { name: 'second case', group: 'second' },
  { name: 'rest alpha', group: 'rest' },
  { name: 'rest beta', group: 'rest' },
];
const baseRegistry = {
  version: 1,
  files: [
    {
      source,
      environment: 'TEST_FIXTURE_GROUP',
      groups: ['first', 'second', 'rest'],
      tests: declarations,
    },
  ],
};
const clone = (value) => JSON.parse(JSON.stringify(value));
const writeRegistry = (registry = baseRegistry) =>
  fs.writeFileSync(registryPath, `${JSON.stringify(registry)}\n`);
const reset = () => {
  fs.writeFileSync(sourcePath, sourceText);
  writeRegistry();
};
let checks = 0;
const check = (label, callback) => {
  try {
    callback();
    checks++;
  } catch (error) {
    error.message = `${label}: ${error.message}`;
    throw error;
  }
};
const refuse = (label, callback) => check(label, () => assert.throws(callback));
const spy = () => {
  const calls = [];
  const hooks = [];
  const result = {};
  const nativeTest = (...args) => {
    calls.push(args);
    return result;
  };
  nativeTest.after = (hook) => hooks.push(hook);
  nativeTest.skip = () => {
    throw new Error('partitioning must not call native test.skip');
  };
  return { nativeTest, calls, hooks, result };
};
const setup = (env = {}) => {
  const native = spy();
  const output = [];
  const registrar = createRegistrar(native.nativeTest, source, {
    root,
    env,
    write: (line) => output.push(String(line)),
  });
  return { ...native, ...registrar, output };
};
const callbacks = declarations.map(() => () => {});
const options = { concurrency: false, timeout: 1234 };
const registerAll = (registrar) =>
  declarations.map((entry, index) =>
    index % 2 === 0
      ? registrar.test(entry.name, options, callbacks[index])
      : registrar.test(entry.name, callbacks[index])
  );

try {
  fs.mkdirSync(path.dirname(registryPath), { recursive: true });
  fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
  fs.writeFileSync(helperPath, helperBytes);
  reset();

  check('default declarations retain order, options, callbacks and return values', () => {
    const registrar = setup();
    assert.deepEqual(
      registerAll(registrar),
      declarations.map(() => registrar.result)
    );
    registrar.complete();
    assert.deepEqual(
      registrar.calls.map((args) => args[0]),
      declarations.map((entry) => entry.name)
    );
    registrar.calls.forEach((args, index) => {
      assert.equal(args.at(-1), callbacks[index]);
      if (index % 2 === 0) {
        assert.equal(args.length, 3);
        assert.equal(args[1], options);
      } else {
        assert.equal(args.length, 2);
      }
    });
    assert.equal(registrar.output.length, 0);
    assert.equal(registrar.hooks.length, 1);
    registrar.hooks[0]();
  });

  check('selected groups form the complete disjoint declaration inventory', () => {
    const allNames = [];
    const inventory = loadRegistry(root).files[0];
    for (const group of baseRegistry.files[0].groups) {
      const registrar = setup({ TEST_FIXTURE_GROUP: group });
      const returned = registerAll(registrar);
      assert.deepEqual(
        returned,
        declarations.map((entry) => (entry.group === group ? registrar.result : undefined))
      );
      const selected = registrar.complete();
      registrar.hooks[0]();
      const expected = declarations
        .filter((entry) => entry.group === group)
        .map((entry) => entry.name);
      const actual = registrar.calls.map((args) => args[0]);
      assert.deepEqual(actual, expected);
      assert.deepEqual(selected, expected);
      for (const args of registrar.calls) {
        const index = declarations.findIndex((entry) => entry.name === args[0]);
        assert.equal(args.at(-1), callbacks[index]);
        if (index % 2 === 0) assert.equal(args[1], options);
      }
      assert.equal(registrar.output.length, 1);
      const prefix = 'CI_NODE_TEST_GROUP ';
      assert.ok(registrar.output[0].startsWith(prefix));
      assert.deepEqual(JSON.parse(registrar.output[0].slice(prefix.length)), {
        source,
        group,
        source_sha256: inventory.sourceSha256,
        fingerprint: inventory.fingerprint,
        declared_count: declarations.length,
        selected_names: expected,
      });
      allNames.push(...actual);
    }
    assert.equal(new Set(allNames).size, declarations.length);
    assert.deepEqual([...allNames].sort(), declarations.map((entry) => entry.name).sort());
  });

  for (const value of ['', 'FIRST', 'first/second', ' first', 'first ', 'missing', 1, null]) {
    refuse(`selector ${JSON.stringify(value)} is refused`, () =>
      setup({ TEST_FIXTURE_GROUP: value })
    );
  }
  refuse('unlisted source cannot register', () =>
    createRegistrar(spy().nativeTest, 'mcp/other.mjs', { root, env: {} })
  );
  refuse('native test function is required', () => createRegistrar({}, source, { root, env: {} }));
  refuse('native after guard API is required', () =>
    createRegistrar(() => {}, source, { root, env: {} })
  );
  refuse('missing declaration prevents completion', () => {
    const registrar = setup();
    registrar.test(declarations[0].name, callbacks[0]);
    registrar.complete();
  });
  refuse('incorrect declaration order is refused', () => {
    const registrar = setup();
    registrar.test(declarations[1].name, callbacks[1]);
  });
  refuse('duplicate declaration is refused', () => {
    const registrar = setup();
    registrar.test(declarations[0].name, callbacks[0]);
    registrar.test(declarations[0].name, callbacks[0]);
  });
  refuse('extra declaration is refused', () => {
    const registrar = setup();
    registerAll(registrar);
    registrar.test('extra', () => {});
  });
  refuse('completion cannot be repeated', () => {
    const registrar = setup();
    registerAll(registrar);
    registrar.complete();
    registrar.complete();
  });
  refuse('declarations after completion are refused', () => {
    const registrar = setup();
    registerAll(registrar);
    registrar.complete();
    registrar.test('extra', () => {});
  });
  refuse('native after hook refuses an omitted explicit completion', () => {
    const registrar = setup();
    registerAll(registrar);
    registrar.hooks[0]();
  });

  const metadataMutations = [
    ['unsupported version', (r) => (r.version = 2)],
    ['missing files', (r) => delete r.files],
    ['empty files', (r) => (r.files = [])],
    ['duplicate source', (r) => r.files.push(clone(r.files[0]))],
    [
      'duplicate environment',
      (r) => r.files.push({ ...clone(r.files[0]), source: 'mcp/test_other.mjs' }),
    ],
    ['absolute source path', (r) => (r.files[0].source = sourcePath)],
    ['traversing source path', (r) => (r.files[0].source = '../outside.mjs')],
    ['missing source path', (r) => delete r.files[0].source],
    ['invalid environment name', (r) => (r.files[0].environment = 'bad=name')],
    ['missing environment name', (r) => delete r.files[0].environment],
    ['missing groups', (r) => delete r.files[0].groups],
    ['empty groups', (r) => (r.files[0].groups = [])],
    ['duplicate group', (r) => r.files[0].groups.push('first')],
    ['empty group name', (r) => (r.files[0].groups[0] = '')],
    ['group with no tests', (r) => r.files[0].groups.push('unused')],
    ['missing tests', (r) => delete r.files[0].tests],
    ['empty tests', (r) => (r.files[0].tests = [])],
    ['duplicate test name', (r) => r.files[0].tests.push(clone(r.files[0].tests[0]))],
    ['empty test name', (r) => (r.files[0].tests[0].name = '')],
    ['missing test name', (r) => delete r.files[0].tests[0].name],
    ['unknown test group', (r) => (r.files[0].tests[0].group = 'unknown')],
    ['missing test group', (r) => delete r.files[0].tests[0].group],
  ];
  for (const [label, mutate] of metadataMutations) {
    const registry = clone(baseRegistry);
    mutate(registry);
    writeRegistry(registry);
    refuse(label, () => loadRegistry(root));
  }
  reset();
  fs.writeFileSync(registryPath, '{');
  refuse('malformed JSON is refused', () => loadRegistry(root));
  fs.rmSync(registryPath);
  refuse('missing registry is refused', () => loadRegistry(root));
  reset();
  fs.rmSync(sourcePath);
  refuse('missing registered source is refused', () => loadRegistry(root));
  reset();

  check('inventory fingerprints are stable and source bound', () => {
    const before = loadRegistry(root);
    assert.deepEqual(loadRegistry(root), before);
    assert.equal(
      before.files[0].sourceSha256,
      crypto.createHash('sha256').update(sourceText).digest('hex')
    );
    assert.match(before.files[0].fingerprint, /^[a-f0-9]{64}$/);
    fs.appendFileSync(sourcePath, '// changed source\n');
    const after = loadRegistry(root);
    assert.notEqual(after.files[0].sourceSha256, before.files[0].sourceSha256);
    assert.notEqual(after.files[0].fingerprint, before.files[0].fingerprint);
    assert.notDeepEqual(after.inventoryDigests, before.inventoryDigests);
  });
  reset();
  check('metadata changes invalidate the inventory fingerprint', () => {
    const before = loadRegistry(root);
    const changed = clone(baseRegistry);
    changed.files[0].tests[2].group = 'second';
    writeRegistry(changed);
    const after = loadRegistry(root);
    assert.equal(after.files[0].sourceSha256, before.files[0].sourceSha256);
    assert.notEqual(after.files[0].fingerprint, before.files[0].fingerprint);
    assert.notDeepEqual(after.inventoryDigests, before.inventoryDigests);
  });
  reset();
  check('helper source changes invalidate the inventory fingerprint', () => {
    const before = loadRegistry(root);
    fs.appendFileSync(helperPath, '// changed helper source\n');
    const after = loadRegistry(root);
    assert.equal(after.files[0].sourceSha256, before.files[0].sourceSha256);
    assert.notEqual(after.files[0].fingerprint, before.files[0].fingerprint);
    assert.notDeepEqual(after.inventoryDigests, before.inventoryDigests);
    fs.writeFileSync(helperPath, helperBytes);
  });
  check('inventory loading needs only Node built-ins in an empty fixture checkout', () => {
    assert.equal(fs.existsSync(path.join(root, 'node_modules')), false);
    assert.equal(fs.existsSync(path.join(root, 'mcp/node_modules')), false);
    const helper = path.join(__dirname, 'ci_node_test_groups.js');
    const child = spawnSync(
      process.execPath,
      [
        '-e',
        `const Module = require('node:module');
const original = Module._load;
Module._load = function (request, ...rest) {
  if (request !== process.argv[1] && !Module.isBuiltin(request)) {
    throw new Error('unexpected non-built-in dependency: ' + request);
  }
  return original.call(this, request, ...rest);
};
const { loadRegistry } = require(process.argv[1]);
const inventory = loadRegistry(process.argv[2]);
if (inventory.files.length !== 1) throw new Error('fixture inventory was not loaded');`,
        helper,
        root,
      ],
      { cwd: root, encoding: 'utf8' }
    );
    assert.equal(child.status, 0, child.stderr);
  });
  console.log(`CI Node test-group controls: ${checks} passed`);
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
