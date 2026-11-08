#!/usr/bin/env node
'use strict';
// Actual frame DOM and actual app async entry point, with store/load doubles.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const acorn = require('acorn');
const { JSDOM } = require('jsdom');
const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const asModule = (s) => import(`data:text/javascript;base64,${Buffer.from(s).toString('base64')}`);
async function frame(source) {
  const dom = new JSDOM(
    '<section><h1 tabindex="-1">Instruments</h1><div class="icatalog"><input type="search"><button>Inspect</button></div></section>',
    { url: 'https://prototype.example/' }
  );
  const prior = global.AbortController;
  global.AbortController = dom.window.AbortController;
  let inspector;
  try {
    const { createInspector } = await asModule(source),
      doc = dom.window.document,
      panel = doc.querySelector('section');
    let current = null,
      revision = 0,
      closed = 0;
    const listeners = new Set(),
      said = [];
    const selection = {
      current: () => current,
      set(id) {
        current = id;
        revision++;
        for (const fn of listeners) fn();
      },
      subscribe(fn) {
        listeners.add(fn);
        return () => listeners.delete(fn);
      },
    };
    inspector = createInspector({
      panel,
      selection,
      recipe: { previewIs: (id, r) => id === current && r === revision },
      select: (id) => selection.set(id),
      nameOf: (id) => ({ oud: 'Oud', udu: 'Udu', fiddle: 'Fiddle' })[id],
      announce: (s) => said.push(s),
      onClose: () => closed++,
    });
    const opener = panel.querySelector('button');
    opener.focus();
    inspector.open('oud', { returnFocus: opener });
    inspector.focus();
    assert.match(inspector.root.textContent, /Oud/);
    assert.throws(
      () =>
        inspector.open('udu', {
          similar: true,
          fromInstrumentId: 'oud',
          previewRevision: revision - 1,
        }),
      { code: 'STALE' }
    );
    assert.equal(current, 'oud');
    assert.throws(() => inspector.open('missing'), { code: 'NOT_FOUND' });
    assert.equal(current, 'oud');
    inspector.open('udu', { similar: true, fromInstrumentId: 'oud', previewRevision: revision });
    const back = () =>
      [...inspector.root.querySelectorAll('button')].find((b) => b.textContent.startsWith('Back'));
    assert.equal(back().textContent, 'Back to Oud');
    back().click();
    assert.equal(current, 'oud');
    assert.equal(doc.activeElement, inspector.root.querySelector('h2'));
    inspector.open('fiddle', { returnFocus: opener });
    assert.ok(back().hidden, 'ordinary inspect resets trail');
    const ignored = new dom.window.KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    });
    ignored.preventDefault();
    inspector.root.dispatchEvent(ignored);
    assert.equal(current, 'fiddle');
    inspector.root.dispatchEvent(
      new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    );
    assert.equal(current, null);
    assert.ok(inspector.root.hidden);
    assert.equal(doc.activeElement, opener);
    assert.equal(closed, 1);
    inspector.open('oud', { returnFocus: opener });
    opener.remove();
    [...inspector.root.querySelectorAll('button')]
      .find((b) => b.textContent === 'Close instrument preview')
      .click();
    assert.equal(doc.activeElement, panel.querySelector('input'));
    inspector.unmount();
    assert.equal(listeners.size, 0);
    assert.throws(() => inspector.open('oud'), { code: 'ENDED' });
  } finally {
    inspector?.unmount();
    global.AbortController = prior;
    dom.window.close();
  }
}
async function asyncEntry(source) {
  const ast = acorn.parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
  const fn = ast.body.find(
    (n) => n.type === 'FunctionDeclaration' && n.id.name === 'openInstrument'
  );
  assert.ok(fn);
  const show = ast.body.find((n) => n.type === 'FunctionDeclaration' && n.id.name === 'show');
  let route = 'instrument';
  const waits = [],
    opened = [],
    said = [];
  const context = vm.createContext({
    instrumentData: {
      loadInstrumentNames: () => new Promise((resolve, reject) => waits.push({ resolve, reject })),
    },
    routeFromHash: () => route,
    location: { hash: '#instrument' },
    inspector: { open: (id) => opened.push(id), focus() {} },
    announce: (s) => said.push(s),
    details: { show() {} },
    document: {
      body: { dataset: {} },
      querySelectorAll: () => [],
      querySelector: () => ({ after() {}, focus() {} }),
    },
    hosts: {},
    instrumentTabs: { root: {}, show() {} },
    instrument: { current: () => null },
    placeCount() {},
    write: () => ({ ok: true }),
    savedLine: { textContent: '' },
  });
  vm.runInContext(
    `let inspections=0, routeRevision=0, activeRoute=null;${source.slice(fn.start, fn.end)};${source.slice(show.start, show.end)}`,
    context
  );
  const open = (id) => context.openInstrument(id);
  const navigate = (next) => {
    route = next;
    context.show(next, { moveFocus: false });
  };
  navigate('instrument');
  const a = open('oud'),
    b = open('udu');
  waits[1].resolve();
  await b;
  waits[0].resolve();
  await assert.rejects(a, { code: 'ENDED' });
  assert.deepEqual(opened, ['udu']);
  const c = open('fiddle');
  navigate('library');
  waits[2].resolve();
  await assert.rejects(c, { code: 'ENDED' });
  assert.deepEqual(opened, ['udu']);
  navigate('instrument');
  const d = open('oud');
  vm.runInContext('inspections++', context);
  waits[3].resolve();
  await assert.rejects(d, { code: 'ENDED' });
  const e = open('oud');
  waits[4].reject(Error('offline'));
  await assert.rejects(e, /offline/);
  assert.deepEqual(said, ['offline']);
  const roundtrip = open('fiddle');
  navigate('library');
  navigate('instrument');
  waits[5].resolve();
  await assert.rejects(roundtrip, { code: 'ENDED' });
  assert.deepEqual(opened, ['udu']);
}
async function check() {
  const source = read('prototype/inspector.js');
  await frame(source);
  await asyncEntry(read('prototype/app.js'));
  for (const [from, to] of [
    ['!recipe.previewIs(fromInstrumentId, previewRevision)', 'false'],
    ['trail = [id];', 'trail.push(id);'],
    ['selection.set(null);', ''],
    ['stop();', ''],
  ]) {
    assert.ok(source.includes(from));
    await assert.rejects(frame(source.replace(from, to)));
  }
  const app = read('prototype/app.js');
  await assert.rejects(
    asyncEntry(
      app.replace(
        'mine !== inspections || routeRevision !== generation || routeFromHash() !== route',
        'false'
      )
    )
  );
  await assert.rejects(
    asyncEntry(app.replace('routeRevision !== generation || ', '')),
    undefined,
    'route roundtrip'
  );
  console.log(
    'inspector: actual frame/async-entry controls pass; 6 causal mutants rejected; store/load doubles, no native focus/AT claim'
  );
}
module.exports = { check };
if (require.main === module)
  check().catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
