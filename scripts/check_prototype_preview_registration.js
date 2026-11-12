#!/usr/bin/env node
'use strict';
// Execute the actual shell registration contexts with store contract doubles.
// This checks wiring and mount lifetime, not engine, browser or clipboard behavior.
// The host browser gate also mounts these registrations and exercises real store
// subscriptions. The lane scenarios separately exercise their actual DOM modules.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const acorn = require('acorn');
const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const parse = (s) => acorn.parse(s, { ecmaVersion: 'latest', sourceType: 'module' });
function initializer(s, name) {
  for (const node of parse(s).body) {
    const decl = node.declaration || node;
    if (decl.type !== 'VariableDeclaration') continue;
    const d = decl.declarations.find((v) => v.id.name === name);
    if (d) return d.init;
  }
  throw new Error(`Missing ${name}`);
}
const cut = (s, n) => s.slice(n.start, n.end);
async function exercise(source) {
  const more = initializer(source, 'MORE');
  const instrument = more.properties.find((p) => p.key.name === 'instrument');
  assert.ok(instrument, 'instrument registrations exist');
  const host = read('prototype/host.js');
  const until = parse(host).body.find((n) => n.declaration?.id?.name === 'untilAborted');
  let ready = false,
    release;
  const pending = new Promise((resolve) => {
    release = resolve;
  });
  const listeners = new Set();
  const calls = [];
  const output = Object.freeze({
    copy: (...args) => calls.push(['copy', ...args]),
    setFormat: (...args) => calls.push(['setFormat', ...args]),
    snapshot: () => 'preview',
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  });
  const methods = [
    'addConfiguredInstrument',
    'resetInstrumentPreview',
    'setInstrumentDestination',
    'snapshot',
    'subscribe',
  ];
  const actions = Object.fromEntries(
    methods.map((k) => [
      k,
      k === 'subscribe' ? output.subscribe : (...args) => calls.push([k, ...args]),
    ])
  );
  const recipe = {
    start: () => pending,
    status: () => (ready ? 'ready' : 'error'),
    preview: { output },
    port(keys) {
      assert.deepEqual(Array.from(keys), methods);
      return actions;
    },
  };
  const sandbox = vm.createContext({ recipe });
  const registered = vm.runInContext(
    `${cut(host, until.declaration)}\nconst ending = ${cut(source, initializer(source, 'ending'))};\n(${cut(source, instrument.value)})`,
    sandbox
  );
  const lanes = registered.filter((lane) =>
    ['instrumentoutput', 'instrumentactions'].includes(lane.id)
  );
  assert.deepEqual(
    Array.from(lanes, (l) => l.id),
    ['instrumentoutput', 'instrumentactions']
  );
  const controllers = lanes.map(() => new AbortController());
  let settled = 0;
  const contexts = lanes.map((l, i) =>
    l.context({ signal: controllers[i].signal }).then((c) => {
      settled++;
      return c;
    })
  );
  await Promise.resolve();
  assert.equal(settled, 0, 'contexts await store startup');
  ready = true;
  release();
  const [out, act] = await Promise.all(contexts);
  assert.deepEqual(Object.keys(out), ['output']);
  assert.deepEqual(Object.keys(act), ['recipe']);
  assert.equal(out.output.snapshot(), 'preview', 'output uses preview, not workspace');
  out.output.setFormat('compact', 7);
  out.output.copy(7);
  act.recipe.addConfiguredInstrument({ revision: 9 });
  assert.deepEqual(calls, [
    ['setFormat', 'compact', 7],
    ['copy', 7],
    ['addConfiguredInstrument', { revision: 9 }],
  ]);
  let heard = 0;
  for (const view of [out.output, act.recipe]) view.subscribe(() => heard++);
  for (const fn of listeners) fn();
  assert.equal(heard, 2);
  for (const c of controllers) c.abort();
  assert.equal(listeners.size, 0, 'host ends both subscriptions');
  for (const view of [out.output, act.recipe]) view.subscribe(() => heard++);
  assert.equal(listeners.size, 0, 'late subscriptions refused');
  ready = false;
  for (const lane of lanes)
    await assert.rejects(lane.context({ signal: new AbortController().signal }), /not ready/);
}
async function check() {
  const source = read('prototype/app.js');
  await exercise(source);
  const mutants = [
    [
      'output uses wrong view',
      'output: ending(signal, recipe.preview.output)',
      'output: ending(signal, recipe)',
    ],
    [
      'output listener leaks',
      'output: ending(signal, recipe.preview.output)',
      'output: recipe.preview.output',
    ],
    [
      'actions listener leaks',
      'return { recipe: ending(signal, port) };',
      'return { recipe: port };',
    ],
    ['wrong command port', "'addConfiguredInstrument',", "'addInstrument',"],
    ['startup not awaited', 'await recipe.start();', 'recipe.start();'],
    ['failed store admitted', "if (recipe.status() !== 'ready') throw new Error('not ready');", ''],
  ];
  for (const [name, from, to] of mutants) {
    assert.ok(source.includes(from), `mutant anchor: ${name}`);
    await assert.rejects(exercise(source.replaceAll(from, to)), undefined, name);
  }
  console.log(
    `preview registration: contexts/forwarding/startup/lifetime pass; ${mutants.length} causal mutants rejected (store doubles)`
  );
}
module.exports = { check };
if (require.main === module)
  check().catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
