// Hermetic lane scenario. Historical fixtures, not current engine parity.
// Contract: #668 comment 6665493327. No production/API reads at runtime.
// Node DOM mode: node targets.cjs; browser: node targets.cjs --browser.
// DOM mode shims layout rectangles; it does not qualify real focus/layout.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const FEATURE = path.resolve(__dirname, '../../features/genre-targets');
const fixture = {
  provenance: {
    historicalCommit: 'e736f53404b13491fbb22f1570d4e4f178faa49d',
    scenarioCommit: '1137c4ab3c3ccefe8a6f4f536d8f4a54f3dad90e',
    scenarioBlob: '4d97681ffc0ca1946d27df57e8ef2d0660902cc1',
    functions: ['browseItem', 'Catalog.bootFromIndex', 'AXIS_DEFINITIONS', 'axisLabel'],
    browseBootBlob: '80c531e657e8115c638a5026c31075c02ff1feab',
    axisBlob: '2240639fd08b0ae27b2b72c2f0fdecf68be973cd',
    genreBlob: '47078396261039a6d18e97edbe1c242d2b440f80',
    appBlob: 'c363423cee3f6c8340d2ca0a1ebcfe0f318e3a38',
  },
  definitions: [
    {
      id: 'harm',
      name: 'Harmonic logic',
      neg: 'modal / drone-tonic',
      pos: 'functional progression',
    },
    {
      id: 'pitch',
      name: 'Pitch system',
      neg: 'fixed equal-tempered',
      pos: 'flexible / microtonal',
    },
    {
      id: 'ornament',
      name: 'Melodic ornament',
      neg: 'plain',
      pos: 'heavily ornamented',
    },
    {
      id: 'meter',
      name: 'Meter',
      neg: 'free / rubato',
      pos: 'strict isochronous',
    },
    {
      id: 'density',
      name: 'Density',
      neg: 'sparse',
      pos: 'dense polyphonic',
    },
    {
      id: 'transmission',
      name: 'Transmission',
      neg: 'notated',
      pos: 'oral',
    },
    {
      id: 'improv',
      name: 'Real-time generativity',
      neg: 'fixed',
      pos: 'improvised',
    },
    {
      id: 'soundTech',
      name: 'Sound technology',
      neg: 'acoustic',
      pos: 'processed / synthesized',
    },
    {
      id: 'intensity',
      name: 'Perceptual intensity',
      neg: 'meditative',
      pos: 'cathartic',
    },
    {
      id: 'voice',
      name: 'Voice centrality',
      neg: 'instrumental',
      pos: 'vocally driven',
    },
    {
      id: 'timbre',
      name: 'Timbral grain',
      neg: 'clean / smooth',
      pos: 'rough / distorted',
    },
    {
      id: 'percussion',
      name: 'Percussion role',
      neg: 'absent',
      pos: 'foreground / metric',
    },
    {
      id: 'cyclicity',
      name: 'Formal cyclicity',
      neg: 'through-composed',
      pos: 'cyclical / strophic',
    },
  ],
  records: {
    bluegrass: {
      id: 'bluegrass',
      name: 'Bluegrass',
      values: [1, 1, 1, 2, 1, 1, 1, -2, 1, 1, 1, -1, 2],
    },
    delta_blues: {
      id: 'delta_blues',
      name: 'Delta blues',
      values: [1, 1, 1, 0, -1, 1, 1, -2, 1, 2, 2, -1, 2],
    },
    techno: {
      id: 'techno',
      name: 'Techno',
      values: [0, -1, 0, 1, 0, -1, 0, 2, 1, -2, 1, 2, 2],
    },
    bornesange: {
      id: 'bornesange',
      name: 'Bornesange',
      values: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    },
  },
};
const mutations = {
  zero: [
    'const target = applied.get(axis.id);',
    'const target = applied.get(axis.id)?.value ? applied.get(axis.id) : undefined;',
  ],
  visibility: [' || applied.has(axis.id)', ''],
  order: ['for (const axis of axes)', 'for (const axis of [...axes].reverse())'],
  clear: [
    "command(name, b._targetArgs, key, name === 'clear');",
    "command(name === 'clear' ? 'reset' : name, b._targetArgs, key, name === 'clear');",
  ],
  reset: [
    "command(name, b._targetArgs, key, name === 'clear');",
    "if (name !== 'reset') command(name, b._targetArgs, key, name === 'clear');",
  ],
  match: [
    "command(name, b._targetArgs, key, name === 'clear');",
    "command(name === 'match' ? 'reset' : name, b._targetArgs, key, name === 'clear');",
  ],
  label: [
    "target ? target.label : 'Any — not applied'",
    "target ? 'changed label' : 'Any — not applied'",
  ],
  revision: ['const revision = snapshot.revision;', 'const revision = 0;'],
  cleanup: ['unsubscribe();', '// leaked subscription'],
  focus: ['if (!restoringFocus) focusVersion++;', 'if (false) focusVersion++;'],
};
const failures = {
  zero: 'explicit-zero',
  visibility: 'applied-axis-visible',
  order: 'featured-order',
  clear: 'clear-command',
  reset: 'reset-command',
  match: 'match-command',
  label: 'canonical-label',
  revision: 'shown-revision',
  cleanup: 'cleanup',
  focus: 'internal-focus-no-steal',
};
const source = fs.readFileSync(path.join(FEATURE, 'targets.js'), 'utf8');
// Shared assertions run in JSDOM or an actual browser. Expected snapshots are
// fixture host output; the host double records commands and never ranks genres.
async function exercise(mount, fixture, document, window) {
  const verify = (ok, name) => {
    if (!ok) throw new Error('ASSERT:' + name);
  };
  const equal = (a, b, name) => verify(JSON.stringify(a) === JSON.stringify(b), name);
  const freeze = (x) => {
    if (x && typeof x === 'object') {
      Object.values(x).forEach(freeze);
      Object.freeze(x);
    }
    return x;
  };
  const featured = ['soundTech', 'density', 'voice'];
  const axes = [
    ...featured.map((id) => fixture.definitions.find((a) => a.id === id)),
    ...fixture.definitions.filter((a) => !featured.includes(a.id)),
  ];
  let state = freeze({
    status: 'ready',
    error: null,
    revision: 7,
    axes,
    allAxes: false,
    targets: [],
    applied: 0,
    results: { count: 4, best: { id: 'bornesange', name: 'Bornesange' } },
  });
  const subscriptions = new Set(),
    calls = [];
  let failure = null,
    hold = false,
    release,
    fallback = 0;
  const targets = {
    current: () => state,
    subscribe: (fn) => {
      subscriptions.add(fn);
      return () => subscriptions.delete(fn);
    },
  };
  for (const method of ['apply', 'clear', 'reset', 'toggleAll', 'match', 'useProfile'])
    targets[method] = (...args) => {
      calls.push([method, ...args]);
      if (failure) return Promise.reject({ code: failure });
      if (hold)
        return new Promise((resolve) => {
          release = resolve;
        });
      return Promise.resolve({ revision: state.revision });
    };
  const signal = new window.AbortController();
  const ctx = Object.freeze({
    targets: Object.freeze(targets),
    discovery: Object.freeze({ focusToggle: () => fallback++ }),
    signal: signal.signal,
  });
  const host = document.createElement('div');
  document.body.append(host);
  const outside = document.createElement('button');
  outside.textContent = 'Outside';
  document.body.append(outside);
  const lane = mount(host, ctx);
  const $ = (s) => host.querySelector(s),
    all = (s) => [...host.querySelectorAll(s)];
  const key = (k) => all('[data-key]').find((n) => n.dataset.key === k);
  const settle = async () => {
    await Promise.resolve();
    await Promise.resolve();
  };
  const publish = (patch) => {
    state = freeze({ ...state, ...patch, revision: state.revision + 1 });
    for (const fn of subscriptions) fn();
  };
  const setTargets = (list) => publish({ targets: list, applied: list.length });
  const event = (node, type) => node.dispatchEvent(new window.Event(type, { bubbles: true }));
  equal(
    all('input').map((n) => n.dataset.axis),
    featured,
    'featured-order'
  );
  verify(key('reset').disabled && key('match').disabled, 'empty-disabled');
  verify(
    all('input').every(
      (n) => n.value === '0' && n.getAttribute('aria-valuetext') === 'Any — not applied'
    ),
    'absence'
  );
  key('axis:density').click();
  await settle();
  equal(calls.at(-1), ['apply', 'density', 0, 7], 'shown-revision');
  setTargets([{ axis: 'density', value: 0, label: 'middle' }]);
  verify($('.is-applied')?.dataset.lean === 'mid', 'explicit-zero');
  equal(key('axis:density').getAttribute('aria-valuetext'), 'middle', 'canonical-label');
  equal(key('axis:density').title, 'middle', 'canonical-title');
  equal(key('chip:density').textContent, 'middle', 'canonical-chip');
  key('axis:density').dispatchEvent(
    new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
  );
  await settle();
  equal(calls.at(-1), ['apply', 'density', 0, state.revision], 'enter-zero');
  key('axis:density').value = '-2';
  event(key('axis:density'), 'input');
  await settle();
  equal(calls.at(-1), ['apply', 'density', -2, state.revision], 'input-apply');
  // Host accepts a target; rendering is driven solely by its next snapshot.
  setTargets([
    { axis: 'harm', value: 0, label: 'middle' },
    { axis: 'density', value: 1, label: 'leans dense polyphonic' },
  ]);
  equal(
    all('input').map((n) => n.dataset.axis),
    [...featured, 'harm'],
    'applied-axis-visible'
  );
  const before = state;
  key('clear:harm').click();
  await settle();
  equal(calls.at(-1), ['clear', 'harm', state.revision], 'clear-command');
  verify(state === before && state.targets.length === 2, 'no-independent-writer');
  key('chip:density').click();
  await settle();
  equal(calls.at(-1), ['clear', 'density', state.revision], 'chip-clear');
  key('reset').click();
  await settle();
  equal(calls.at(-1), ['reset', state.revision], 'reset-command');
  key('toggle').click();
  await settle();
  equal(calls.at(-1), ['toggleAll', state.revision], 'toggle-command');
  publish({ allAxes: true });
  equal(
    all('input').map((n) => n.dataset.axis),
    axes.map((a) => a.id),
    'all-axis-order'
  );
  // Every historical profile appears through subscription, never a lane loader.
  for (const record of Object.values(fixture.records)) {
    const ts = fixture.definitions.map((a, i) => ({
      axis: a.id,
      value: record.values[i],
      label:
        record.values[i] === 0
          ? 'middle'
          : record.values[i] === -2
            ? a.neg
            : record.values[i] === 2
              ? a.pos
              : record.values[i] < 0
                ? 'leans ' + a.neg
                : 'leans ' + a.pos,
    }));
    setTargets(ts);
    equal(all('input').length, 13, 'profile-13');
    for (const t of ts)
      equal(key('axis:' + t.axis).getAttribute('aria-valuetext'), t.label, 'profile-label');
  }
  key('match').click();
  await settle();
  equal(calls.at(-1), ['match', state.revision], 'match-command');
  publish({ results: { count: 0, best: null } });
  key('match').click();
  await settle();
  equal(calls.at(-1), ['match', state.revision], 'no-result-delegation');
  for (const code of ['STALE', 'BUSY', 'BAD_AXIS', 'BAD_VALUE']) {
    failure = code;
    const n = calls.length;
    key('reset').click();
    await settle();
    verify(calls.length === n + 1, 'no-retry-' + code);
    verify(state.applied === 13, 'rejected-no-state-write');
  }
  failure = null;
  hold = true;
  key('axis:density').focus();
  key('axis:density').dispatchEvent(
    new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
  );
  const oldRevision = state.revision,
    n = calls.length;
  key('reset').click();
  verify(calls.length === n, 'pending-no-second-command');
  publish({ targets: [], applied: 0, allAxes: false });
  outside.focus();
  release({ revision: oldRevision });
  await settle();
  verify(document.activeElement === outside, 'stale-completion-no-focus');
  verify(key('reset').disabled, 'stale-completion-no-state');
  hold = true;
  key('axis:density').focus();
  key('axis:density').dispatchEvent(
    new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
  );
  key('toggle').focus();
  release({ revision: state.revision });
  await settle();
  verify(document.activeElement === key('toggle'), 'internal-focus-no-steal');
  const retainedSlider = key('axis:density');
  setTargets([{ axis: 'density', value: 1, label: 'leans dense polyphonic' }]);
  verify(
    key('axis:density') === retainedSlider && retainedSlider.isConnected,
    'slider-node-preserved'
  );
  hold = false;
  publish({ status: 'loading' });
  verify(!all('input').length, 'loading');
  publish({ status: 'error', error: { code: 'LOAD_FAILED', message: 'Fixture load failed' } });
  verify(host.textContent.includes('Fixture load failed'), 'error');
  publish({ status: 'ready', error: null });
  verify(!host.querySelector('[aria-live],[role="status"],[role="alert"]'), 'shell-announcements');
  // Clear an applied extra axis while awaiting the shell revision; it disappears.
  setTargets([{ axis: 'harm', value: 0, label: 'middle' }]);
  hold = true;
  key('clear:harm').focus();
  key('clear:harm').click();
  setTargets([]);
  release({ revision: state.revision });
  await settle();
  verify(document.activeElement === key('toggle'), 'clear-focus-fallback');
  hold = false;
  setTargets([{ axis: 'density', value: 0, label: 'middle' }]);
  key('reset').focus();
  key('reset').click();
  await settle();
  verify(document.activeElement === key('axis:soundTech'), 'reset-focus');
  // A hidden host must delegate clear focus to Categories, not render disclosure.
  hold = true;
  key('clear:density').click();
  host.hidden = true;
  release({ revision: state.revision });
  await settle();
  verify(fallback === 1, 'discovery-focus-fallback');
  host.hidden = false;
  // Abort while a command is pending; late settlement must not recreate nodes.
  hold = true;
  key('match').click();
  signal.abort();
  release({ revision: state.revision });
  await settle();
  verify(subscriptions.size === 0 && !host.children.length, 'cleanup');
  lane.unmount();
  publish({ applied: 0, targets: [] });
  verify(!host.children.length, 'late-subscription');
  host.remove();
  outside.remove();
  return true;
}
async function domRun(code) {
  const { JSDOM } = require('jsdom');
  const dom = new JSDOM('<!doctype html><body></body>', {
    runScripts: 'outside-only',
    url: 'https://fixture.invalid/',
  });
  // Deliberately limited visibility shim; no layout/accessibility-tree claim.
  dom.window.HTMLElement.prototype.getClientRects = function () {
    return this.closest('[hidden]') ? [] : [{}];
  };
  const transformed = code
    .replace('export function mount', 'function mount')
    .replaceAll(
      'import.meta.url',
      JSON.stringify(pathToFileURL(path.join(FEATURE, 'targets.js')).href)
    );
  dom.window.eval(transformed + '\nwindow.fixtureMount=mount;');
  try {
    return await exercise(dom.window.fixtureMount, fixture, dom.window.document, dom.window);
  } finally {
    dom.window.close();
  }
}
async function browserRun() {
  const http = require('node:http');
  const { chromium } = require('playwright');
  const server = http.createServer((req, res) => {
    if (req.url === '/targets.js') {
      res.setHeader('content-type', 'text/javascript');
      res.end(source);
    } else if (req.url === '/targets.css') {
      res.setHeader('content-type', 'text/css');
      res.end(fs.readFileSync(path.join(FEATURE, 'targets.css')));
    } else {
      res.setHeader('content-type', 'text/html');
      res.end('<!doctype html><body></body>');
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({
      executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
      chromiumSandbox: true,
    });
    const page = await browser.newPage();
    await page.goto('http://127.0.0.1:' + server.address().port);
    for (const width of [280, 390, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(
        async ({ fixture, exerciseText }) => {
          const { mount } = await import('/targets.js');
          await (0, eval)('(' + exerciseText + ')')(mount, fixture, document, window);
        },
        { fixture, exerciseText: exercise.toString() }
      );
    }
    console.log('Browser contract scenarios passed at 280/390/1280px.');
  } finally {
    if (browser) await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}
(async () => {
  if (process.argv.includes('--browser')) return browserRun();
  await domRun(source);
  const killed = [];
  for (const [name, [from, to]] of Object.entries(mutations)) {
    assert.equal(source.split(from).length - 1, 1, 'unique mutation ' + name);
    let error;
    try {
      await domRun(source.replace(from, to));
    } catch (e) {
      error = e;
    }
    assert.ok(error, 'mutation survived ' + name);
    assert.equal(error.message, 'ASSERT:' + failures[name], 'wrong failure ' + name);
    killed.push({ name, assertion: failures[name] });
  }
  console.log(
    JSON.stringify(
      {
        scope: 'JSDOM contract exercise; layout shim, not browser/integration acceptance',
        baseline: 'passed',
        killed,
      },
      null,
      2
    )
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
