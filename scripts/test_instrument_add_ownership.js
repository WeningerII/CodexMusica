'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const appSource = fs.readFileSync(path.join(__dirname, '../src/app.js'), 'utf8');
const uiSource = fs.readFileSync(path.join(__dirname, '../src/workbench.js'), 'utf8');
const addSource = appSource.slice(
  appSource.indexOf('async function addInstrumentFromPicker('),
  appSource.indexOf('// ---- TREE STATE ----')
);
const uiAddSource = uiSource.slice(
  uiSource.indexOf('async function uiAddInstrument('),
  uiSource.indexOf('// ── Session ──')
);
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function harness({ engine = true } = {}) {
  const full = deferred(),
    ready = deferred(),
    histories = [],
    toasts = [],
    editors = [];
  let configured = 0;
  const context = vm.createContext({
    app: {
      cards: [],
      _addToTradition: 'bluegrass',
      collapsedTraditionGroups: new Set(['bluegrass']),
    },
    UI: { busy: false },
    _engineLive: engine,
    engineReady: async () => {
      await ready.promise;
      context._engineLive = true;
      return true;
    },
    Catalog: { ensureFull: () => full.promise },
    traditionCardOpts: (traditionId) => ({ traditionId }),
    addCard: (instrumentId, opts = {}) => {
      const card = { id: instrumentId, instrumentId, ...opts };
      context.app.cards.push(card);
      if (!opts.skipHistory) context.pushHistory();
      return card;
    },
    // The real placement helper replaces the array: ownership must not use
    // array identity or the second of two same-session adds would be lost.
    _placeCardAfterTraditionRun: () => {
      context.app.cards = [...context.app.cards];
    },
    pushHistory: () => histories.push(JSON.parse(JSON.stringify(context.app.cards))),
    renderAll() {},
    uiOpenEditor: (id) => editors.push(id),
    showToast: (...args) => toasts.push(args),
    _addedInstrumentMessage: (id) => `Added ${id}`,
  });
  vm.runInContext(addSource + '\n' + uiAddSource, context);
  return {
    context,
    full,
    ready,
    histories,
    toasts,
    editors,
    configure: (card) => {
      configured++;
      card.configured = true;
    },
    configured: () => configured,
    open: () => {
      context.app._workspaceGeneration = (context.app._workspaceGeneration || 0) + 1;
      context.app.cards = [];
    },
  };
}

for (const outcome of ['resolve', 'reject']) {
  test(`a delayed tradition ${outcome} cannot add/configure/history/toast in a replacement session`, async () => {
    const h = harness();
    const pending = h.context.uiAddInstrument('aburukuwa', {
      destination: 'bluegrass',
      configure: h.configure,
    });
    h.open();
    h.full[outcome](outcome === 'reject' ? Error('offline') : undefined);
    assert.equal(await pending, null);
    assert.equal(h.context.app.cards.length, 0);
    assert.equal(h.configured(), 0);
    assert.deepEqual(h.histories, []);
    assert.deepEqual(h.toasts, []);
    assert.deepEqual(h.editors, []);
    assert.equal(h.context.UI.busy, false);
  });
}

test('engine readiness cannot add a loose instrument after another open intent', async () => {
  const h = harness({ engine: false });
  h.context.app._addToTradition = null;
  const pending = h.context.addInstrumentFromPicker('aburukuwa', { configure: h.configure });
  h.open();
  h.ready.resolve();
  assert.equal(await pending, null);
  assert.equal(h.context.app.cards.length, 0);
  assert.equal(h.configured(), 0);
  assert.deepEqual(h.histories, []);
});

test('a newer open intent cancels an add even before replacement cards arrive', async () => {
  const h = harness();
  const pending = h.context.addInstrumentFromPicker('aburukuwa');
  h.context.app._workspaceGeneration = 1;
  h.full.resolve();
  assert.equal(await pending, null);
  assert.equal(h.context.app.cards.length, 0);
});

test('normal configured add records its final configuration once and opens its editor', async () => {
  const h = harness();
  const pending = h.context.uiAddInstrument('aburukuwa', {
    destination: 'bluegrass',
    configure: h.configure,
  });
  h.full.resolve();
  const card = await pending;
  assert.equal(card.traditionId, 'bluegrass');
  assert.equal(card.configured, true);
  assert.equal(h.histories.length, 1);
  assert.equal(h.histories[0][0].configured, true);
  assert.deepEqual(h.editors, ['aburukuwa']);
  assert.equal(h.toasts.length, 1);
  assert.equal(h.context.app.collapsedTraditionGroups.has('bluegrass'), false);
});

test('two pending adds in the same workspace both survive card-array replacement', async () => {
  const h = harness();
  const first = h.context.addInstrumentFromPicker('aburukuwa');
  h.context.app._addToTradition = 'bluegrass';
  const second = h.context.addInstrumentFromPicker('banjo');
  h.full.resolve();
  assert.ok(await first);
  assert.ok(await second);
  assert.equal(h.context.app.cards.length, 2);
  assert.equal(h.histories.length, 2);
});

test('a same-session full-row failure preserves the existing loose-add fallback', async () => {
  const h = harness();
  h.context.traditionCardOpts = () => null;
  const pending = h.context.addInstrumentFromPicker('aburukuwa', { configure: h.configure });
  h.full.reject(Error('offline'));
  const card = await pending;
  assert.equal(card.traditionId, undefined);
  assert.equal(card.configured, true);
  assert.equal(h.histories.length, 1);
});
