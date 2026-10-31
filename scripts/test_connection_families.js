'use strict';
// The display family of each connection method is read by stable id
// (src/connection-families.js, #637 item 7). These guards pin that the table
// names only real methods and agreed families, that it reproduces the
// classification the views showed before it existed (84/84 on today's
// registry), and that a rename cannot move a method's family. The adapter's
// reading of the table, and its keeping of a method with no family as native
// bindings, belong to the integration and are checked there.
const test = require('node:test');
const assert = require('node:assert/strict');
const { CONNECTION_FAMILIES } = require('../src/connection-families');
const registry = require('../library/data/methods.json');
const I = require('../src/connection-interaction');
const FAMILIES = new Set(['rhyme', 'assonance', 'consonance', 'alliteration']);
const visual = registry.methods.filter((m) => I.layerOfNamespace(m.namespace));
// The name rule the adapter used before the table (connection-adapter.js at
// 7586c8e48, lines 39-49), kept here only as the parity reference.
const byName = (name) =>
  name.includes('assonance') || name === 'vowel@v1'
    ? 'assonance'
    : name.includes('consonance') || name === 'coda@v1'
      ? 'consonance'
      : name === 'alliteration' || /^(stressed_)?onset@/.test(name)
        ? 'alliteration'
        : name.includes('rhyme')
          ? 'rhyme'
          : undefined;

test('every entry names a registered visual method and an agreed family', () => {
  const ids = new Set(visual.map((m) => m.id));
  for (const [id, family] of Object.entries(CONNECTION_FAMILIES)) {
    assert.ok(ids.has(id), `${id} is not a registered schema or shared_sound method`);
    assert.ok(FAMILIES.has(family), `${id}: ${family} is not an agreed family`);
  }
});

test('the table reproduces the classification the views showed before it', () => {
  assert.equal(visual.length, 84, 'the registry baseline this parity pins');
  const moved = visual
    .filter((m) => CONNECTION_FAMILIES[m.id] !== byName(m.name))
    .map((m) => `${m.name}: ${byName(m.name)} -> ${CONNECTION_FAMILIES[m.id]}`);
  assert.deepEqual(moved, []);
});

test('a renamed method keeps its family; a name alone moves nothing', () => {
  const m = visual.find((x) => CONNECTION_FAMILIES[x.id] === 'rhyme');
  const renamed = { ...m, name: 'consonance of renamed things' };
  assert.equal(byName(renamed.name), 'consonance', 'the mutant would move under the name rule');
  assert.equal(CONNECTION_FAMILIES[renamed.id], 'rhyme');
});
