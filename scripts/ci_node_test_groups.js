'use strict';
// One dependency-free declaration is shared by registration and CI inventory.
// Unselected callbacks are not registered; every declaration is still checked.
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const ROOT = path.join(__dirname, '..');
const CONFIG = 'scripts/ci_node_test_groups.json';
const HELPER = 'scripts/ci_node_test_groups.js';
const hash = (text) => createHash('sha256').update(text).digest('hex');
const refuse = (message) => {
  throw new Error(`CI node test groups: ${message}`);
};

function loadRegistry(root = ROOT) {
  const bytes = fs.readFileSync(path.join(root, CONFIG));
  const declaration = JSON.parse(bytes);
  if (declaration.version !== 1 || !Array.isArray(declaration.files) || !declaration.files.length)
    refuse('invalid registry version or files');
  const inventoryDigests = {
    [CONFIG]: hash(bytes),
    [HELPER]: hash(fs.readFileSync(path.join(root, HELPER))),
  };
  const sources = new Set();
  const environments = new Set();
  const files = declaration.files.map((file) => {
    if (!file || typeof file !== 'object') refuse('invalid file declaration');
    const { source, environment, groups, tests } = file;
    if (
      typeof source !== 'string' ||
      !/^mcp\/test_[\w-]+\.mjs$/.test(source) ||
      sources.has(source)
    )
      refuse('invalid or duplicate source');
    if (
      typeof environment !== 'string' ||
      !/^TEST_[A-Z_]+$/.test(environment) ||
      environments.has(environment)
    )
      refuse('invalid or duplicate environment');
    sources.add(source);
    environments.add(environment);
    if (
      !Array.isArray(groups) ||
      !groups.length ||
      new Set(groups).size !== groups.length ||
      groups.some((group) => typeof group !== 'string' || !/^[a-z][a-z-]*$/.test(group))
    )
      refuse('invalid or duplicate groups');
    if (!Array.isArray(tests) || !tests.length) refuse('missing test declarations');
    const names = new Set();
    for (const test of tests) {
      if (
        !test ||
        typeof test.name !== 'string' ||
        !test.name.trim() ||
        names.has(test.name) ||
        !groups.includes(test.group)
      )
        refuse('invalid, duplicate, or unowned test declaration');
      names.add(test.name);
    }
    if (groups.some((group) => !tests.some((test) => test.group === group))) refuse('empty group');
    const sourceSha256 = hash(fs.readFileSync(path.join(root, source)));
    inventoryDigests[source] = sourceSha256;
    const fingerprint = hash(
      JSON.stringify({
        sourceSha256,
        config: inventoryDigests[CONFIG],
        helper: inventoryDigests[HELPER],
      })
    );
    return { ...file, sourceSha256, fingerprint };
  });
  return { files, inventoryDigests };
}

function createRegistrar(
  nativeTest,
  source,
  { root = ROOT, env = process.env, write = console.log } = {}
) {
  const file = loadRegistry(root).files.find((entry) => entry.source === source);
  if (!file) refuse(`undeclared source ${source}`);
  const hasSelection = Object.prototype.hasOwnProperty.call(env, file.environment);
  const selected = hasSelection ? env[file.environment] : null;
  if (hasSelection && !file.groups.includes(selected))
    refuse(`invalid ${file.environment}=${selected}`);
  if (typeof nativeTest !== 'function' || typeof nativeTest.after !== 'function')
    refuse('native test/after API required');
  let completed = false;
  let declared = 0;
  const selectedNames = [];
  nativeTest.after(() => {
    if (!completed) refuse(`registration was not completed for ${source}`);
  });
  return {
    test(...args) {
      if (completed) refuse('test registered after complete');
      const expected = file.tests[declared];
      if (!expected || args[0] !== expected.name)
        refuse(`unexpected test declaration at ${declared + 1}: ${args[0]}`);
      declared++;
      if (selected === null || expected.group === selected) {
        selectedNames.push(expected.name);
        return nativeTest(...args);
      }
    },
    complete() {
      if (completed) refuse('registration completed twice');
      if (declared !== file.tests.length)
        refuse(`missing test declarations: ${declared}/${file.tests.length}`);
      const expected = file.tests
        .filter((entry) => selected === null || entry.group === selected)
        .map((entry) => entry.name);
      if (JSON.stringify(selectedNames) !== JSON.stringify(expected))
        refuse('selected inventory mismatch');
      completed = true;
      if (selected !== null)
        write(
          'CI_NODE_TEST_GROUP ' +
            JSON.stringify({
              source,
              group: selected,
              source_sha256: file.sourceSha256,
              fingerprint: file.fingerprint,
              declared_count: declared,
              selected_names: selectedNames,
            })
        );
      return selectedNames;
    },
  };
}

module.exports = { loadRegistry, createRegistrar };
