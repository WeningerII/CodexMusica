// DOM contract doubles only, not production-engine or browser evidence.
// Run with jsdom installed: node prototype/scenarios/instrument-actions/actions.cjs
// Optional first argument is an alternate module for mutation tests.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const file =
  process.argv[2] || path.resolve(__dirname, '../../features/instrument-actions/actions.js');
const freeze = (x) => {
  if (x && typeof x === 'object') {
    Object.values(x).forEach(freeze);
    Object.freeze(x);
  }
  return x;
};
let checks = 0;
const check = (x, label) => {
  assert.ok(x, label);
  checks++;
};
const tick = () => new Promise((resolve) => setImmediate(resolve));
function model({ stale = true, busy = true, invalidate = true } = {}) {
  let state = freeze({
    status: 'ready',
    busy: false,
    revision: 3,
    groups: [{ genreId: 'bluegrass', name: 'Bluegrass', count: 2 }],
    instrumentActions: {
      status: 'ready',
      error: null,
      instrumentId: 'oud',
      previewRevision: 7,
      destination: null,
      destinations: [
        { genreId: null, name: 'Independent instrument' },
        { genreId: 'bluegrass', name: 'Bluegrass' },
      ],
      changedCount: 2,
      canReset: true,
    },
  });
  const listeners = new Set(),
    calls = [],
    waits = [];
  const set = (fn, notify = true) => {
    const next = JSON.parse(JSON.stringify(state));
    fn(next);
    state = freeze(next);
    if (notify) listeners.forEach((fn) => fn());
    return state;
  };
  const recipe = {
    snapshot: () => state,
    subscribe: (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
  for (const kind of [
    'setInstrumentDestination',
    'addConfiguredInstrument',
    'resetInstrumentPreview',
  ])
    recipe[kind] = (args) => {
      const a = state.instrumentActions;
      if (
        stale &&
        (args.revision !== state.revision ||
          args.previewRevision !== a.previewRevision ||
          args.instrumentId !== a.instrumentId)
      )
        throw Object.assign(Error('stale'), { code: 'STALE' });
      if (busy && (state.busy || a.status !== 'ready'))
        throw Object.assign(Error('busy'), { code: 'BUSY' });
      calls.push({ kind, args });
      if (kind !== 'addConfiguredInstrument' && invalidate)
        set((s) => {
          s.instrumentActions.previewRevision++;
          s.instrumentActions.status = 'loading';
        });
      else
        set((s) => {
          s.busy = true;
        });
      return new Promise((resolve, reject) => waits.push({ resolve, reject, kind, args }));
    };
  function finish({ error, receipt, placed = 'grouped' } = {}) {
    const w = waits.shift();
    assert.ok(w);
    if (error) {
      set((s) => {
        s.busy = false;
        s.instrumentActions.status = 'ready';
      });
      w.reject(error);
      return;
    }
    const snapshot =
      receipt ||
      set((s) => {
        s.busy = false;
        s.revision++;
        s.instrumentActions.status = 'ready';
        if (w.kind === 'setInstrumentDestination')
          s.instrumentActions.destination = w.args.destination;
        if (w.kind === 'resetInstrumentPreview') {
          s.instrumentActions.changedCount = 0;
          s.instrumentActions.canReset = false;
        }
      });
    w.resolve({ snapshot, placed });
  }
  return { recipe, set, calls, listeners, finish };
}
(async () => {
  const { mount } = await import(
    'data:text/javascript;base64,' + fs.readFileSync(file).toString('base64')
  );
  function setup() {
    const dom = new JSDOM(
      '<main><div data-feature-host="instrument-actions"></div><button id="outside">Outside</button></main>'
    );
    const doc = dom.window.document,
      host = doc.querySelector('div'),
      m = model(),
      controller = new AbortController();
    // Simulate native focus loss on disabling a focused button; jsdom alone
    // does not implement it. This is explicitly not real-browser evidence.
    const proto = dom.window.HTMLButtonElement.prototype,
      desc = Object.getOwnPropertyDescriptor(proto, 'disabled');
    Object.defineProperty(proto, 'disabled', {
      ...desc,
      set(value) {
        if (value && doc.activeElement === this) this.blur();
        desc.set.call(this, value);
      },
    });
    let announcements = 0;
    const lane = mount(
      host,
      Object.freeze({
        recipe: m.recipe,
        signal: controller.signal,
        announce: () => announcements++,
        storage: {
          get() {
            throw Error('storage forbidden');
          },
          set() {
            throw Error('storage forbidden');
          },
        },
      })
    );
    return {
      dom,
      doc,
      host,
      m,
      controller,
      lane,
      add: host.querySelector('[data-action="add"]'),
      reset: host.querySelector('[data-action="reset"]'),
      select: host.querySelector('select'),
      announcements: () => announcements,
    };
  }
  let t = setup();
  check(
    [...t.select.options].map((o) => o.textContent).join('|') ===
      'Independent instrument|Bluegrass' && t.select.value === '',
    'destination projection'
  );
  check(t.add.textContent === 'Add configured instrument' && !t.reset.disabled, 'configured state');
  t.add.click();
  assert.deepEqual(t.m.calls[0], {
    kind: 'addConfiguredInstrument',
    args: { instrumentId: 'oud', revision: 3, previewRevision: 7, destination: null },
  });
  checks++;
  check(t.add.disabled && t.select.disabled, 'pending disables');
  t.add.dispatchEvent(new t.dom.window.Event('click'));
  check(t.m.calls.length === 1, 'double click blocked');
  t.doc.querySelector('#outside').focus();
  t.m.finish({ placed: 'independent' });
  await tick();
  check(
    t.doc.activeElement.id === 'outside' && t.announcements() === 0,
    'add never moves focus or announces'
  );
  t.add.focus();
  t.add.click();
  check(
    t.add.getAttribute('aria-disabled') === 'true' && t.doc.activeElement === t.add,
    'pending Add preserves native focus'
  );
  t.m.finish();
  await tick();
  check(
    t.m.calls.length === 2 && t.doc.activeElement === t.add,
    'duplicates allowed and Add focus retained'
  );
  t.select.value = 'bluegrass';
  t.select.dispatchEvent(new t.dom.window.Event('change'));
  assert.deepEqual(t.m.calls.at(-1).args, {
    instrumentId: 'oud',
    revision: 5,
    previewRevision: 7,
    destination: 'bluegrass',
  });
  checks++;
  t.add.click();
  check(
    t.m.calls.length === 3 && t.add.getAttribute('aria-disabled') === 'true',
    'rebuild blocks add'
  );
  t.m.finish();
  await tick();
  check(t.select.value === 'bluegrass', 'host destination');
  check(t.select === t.host.querySelector('select'), 'stable selector node');
  t.reset.focus();
  t.reset.click();
  check(
    t.reset.getAttribute('aria-disabled') === 'true' && t.doc.activeElement === t.reset,
    'pending reset retains focus'
  );
  assert.deepEqual(t.m.calls.at(-1).args, { instrumentId: 'oud', revision: 6, previewRevision: 8 });
  checks++;
  t.reset.click();
  check(t.m.calls.length === 4, 'aria-disabled reset refuses repeat');
  t.m.finish();
  await tick();
  check(
    t.doc.activeElement === t.add && t.reset.disabled && t.add.textContent === 'Add instrument',
    'reset success focuses add despite native-disable blur'
  );
  const resetCalls = t.m.calls.length;
  t.reset.dispatchEvent(new t.dom.window.Event('click'));
  check(t.m.calls.length === resetCalls, 'no reset without canReset');
  t.m.set((s) => {
    s.instrumentActions.destination = null;
    s.instrumentActions.destinations = [{ genreId: null, name: 'Independent instrument' }];
  });
  check(t.select.value === '' && t.select.options.length === 1, 'removed destination fallback');
  t.m.set((s) => {
    s.instrumentActions.destinations.push({ genreId: 'bluegrass', name: '<img src=x>' });
    s.instrumentActions.destination = 'bluegrass';
  });
  check(
    t.select.value === 'bluegrass' && !t.host.querySelector('img'),
    'external context and safe labels'
  );
  t.lane.unmount();
  check(t.host.children.length === 0 && t.m.listeners.size === 0, 'cleanup');
  t.add.click();
  check(t.m.calls.length === 4, 'removed listener');
  t.lane.unmount();
  for (const variant of ['busy', 'loading', 'error', 'empty', 'recipe-loading', 'recipe-error']) {
    t = setup();
    t.m.set((s) => {
      if (variant === 'busy') s.busy = true;
      else if (variant === 'empty') s.instrumentActions.instrumentId = null;
      else if (variant.startsWith('recipe-')) s.status = variant.slice(7);
      else s.instrumentActions.status = variant;
    });
    check(t.add.disabled && t.select.disabled && t.reset.disabled, variant + ' disables');
    t.add.dispatchEvent(new t.dom.window.Event('click'));
    check(t.m.calls.length === 0, variant + ' guarded');
    if (variant === 'error')
      check(
        t.host.querySelector('p').textContent.includes('unavailable'),
        'message-less preview error fallback'
      );
    t.lane.unmount();
  }
  for (const variant of [
    'moved-focus',
    'new-preview',
    'preview-revision',
    'instrument-only',
    'detached',
    'new-revision',
    'hidden',
    'unmount',
    'abort',
    'reject',
  ]) {
    t = setup();
    t.reset.focus();
    t.reset.click();
    const receipt = JSON.parse(JSON.stringify(t.m.recipe.snapshot()));
    receipt.instrumentActions.status = 'ready';
    if (variant === 'moved-focus') t.doc.querySelector('#outside').focus();
    if (variant === 'new-preview')
      t.m.set((s) => {
        s.instrumentActions.instrumentId = 'banjo';
        s.instrumentActions.previewRevision++;
      });
    if (variant === 'new-revision')
      t.m.set((s) => {
        s.revision++;
      });
    if (variant === 'preview-revision')
      t.m.set((s) => {
        s.instrumentActions.previewRevision++;
      });
    if (variant === 'instrument-only')
      t.m.set((s) => {
        s.instrumentActions.instrumentId = 'banjo';
      });
    if (variant === 'detached') t.host.remove();
    if (variant === 'hidden') t.host.hidden = true;
    if (variant === 'unmount') t.lane.unmount();
    if (variant === 'abort') t.controller.abort();
    t.m.set((s) => {
      s.instrumentActions.status = 'ready';
    });
    t.m.finish(
      variant === 'reject'
        ? { error: Object.assign(Error('stale'), { code: 'STALE' }) }
        : { receipt: freeze(receipt) }
    );
    await tick();
    check(t.doc.activeElement !== t.add, variant + ' cannot steal reset focus');
    if (['unmount', 'abort'].includes(variant))
      check(t.host.children.length === 0 && t.m.listeners.size === 0, variant + ' cleanup');
    t.lane.unmount();
  }
  t = setup();
  t.m.set((s) => {
    s.revision++;
  }, false);
  t.add.click();
  await tick();
  check(t.m.calls.length === 0 && !t.add.disabled, 'stale shown version refused');
  t.m.recipe.addConfiguredInstrument = () => {
    throw Error('sync failure');
  };
  t.add.click();
  await tick();
  check(!t.add.disabled && !t.announcements(), 'synchronous failure recovers');
  t.lane.unmount();
  const aborted = new AbortController();
  aborted.abort();
  const isolated = new JSDOM('<div></div>'),
    abortedModel = model();
  mount(isolated.window.document.querySelector('div'), {
    signal: aborted.signal,
    recipe: abortedModel.recipe,
  });
  check(
    !isolated.window.document.querySelector('div').children.length && !abortedModel.listeners.size,
    'pre-aborted mount inert'
  );
  function raceProbe(options) {
    const m = model(options),
      args = { instrumentId: 'oud', revision: 3, previewRevision: 7, destination: null };
    m.recipe.setInstrumentDestination(args);
    assert.equal(m.recipe.snapshot().instrumentActions.status, 'loading');
    assert.notEqual(m.recipe.snapshot().instrumentActions.previewRevision, 7);
    assert.throws(() => m.recipe.addConfiguredInstrument(args), { code: 'STALE' });
  }
  raceProbe({});
  checks++;
  assert.throws(() => raceProbe({ invalidate: false }));
  checks++;
  assert.throws(() => raceProbe({ stale: false }));
  checks++;
  const busyProbe = (busy) => {
    const m = model({ busy });
    m.set((s) => {
      s.busy = true;
    });
    assert.throws(
      () =>
        m.recipe.addConfiguredInstrument({ instrumentId: 'oud', revision: 3, previewRevision: 7 }),
      { code: 'BUSY' }
    );
  };
  busyProbe(true);
  assert.throws(() => busyProbe(false));
  checks += 2;
  console.log(
    JSON.stringify({
      checks,
      evidence:
        'DOM contract doubles; native-blur simulation; three rejected host mutations; no browser/integration claim',
    })
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
