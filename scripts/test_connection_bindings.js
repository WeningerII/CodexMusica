#!/usr/bin/env node
'use strict';
// src/library/connection-bindings.js: the DOM layer of the connection views'
// interaction model, checked in jsdom against the r5 fixture. Each test is one
// behaviour the named team's r5 consent left as an implementation test.
const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const CI = require('../src/connection-interaction.js');

function load(url) {
  const dom = new JSDOM('<main id="surface-library"></main>', {
    runScripts: 'outside-only',
    url: url || 'https://codexmusica.test/codex.html?tab=library',
  });
  const api = dom.window.eval(
    `(function () {${fs.readFileSync(path.join(__dirname, '../src/library/connection-bindings.js'), 'utf8')}\n})()`
  );
  return { B: api, win: dom.window, doc: dom.window.document };
}

const ALLIT = 'schema:alliteration';
const RHYME = 'schema:perfect_rhyme';
const IDS = new Set([
  'e-woods-1-2',
  'e-know-1-8',
  'e-though-2-7',
  'e-watch-4-2',
  'e-woods-4-4',
  'e-snow-4-8',
]);
const current = {
  analysisIdentity: 'analysis-rev-1',
  hasEntity: (id) => IDS.has(id),
  hasMethod: (id) => id === ALLIT || id === RHYME,
  hasEvidence: () => false,
};
const tick = (win) => new Promise((r) => win.setTimeout(r, 0));
const key = (win, target, k) =>
  target.dispatchEvent(
    new win.KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true })
  );

test('the live region is polite, atomic, hidden from sight, and re-announces repeated words', async () => {
  const { B, win, doc } = load();
  win.requestAnimationFrame = (f) => win.setTimeout(f, 0);
  const live = B.liveRegion(doc.getElementById('surface-library'));
  assert.equal(live.el.getAttribute('role'), 'status');
  assert.equal(live.el.getAttribute('aria-live'), 'polite');
  assert.equal(live.el.getAttribute('aria-atomic'), 'true');
  assert.equal(live.el.style.width, '1px');
  assert.equal(live.el.style.overflow, 'hidden');
  live.say('watch L4 w2 – woods L4 w4: Registered figure · Alliteration holds');
  assert.equal(live.el.textContent, '', 'emptied first so a repeat is heard');
  await tick(win);
  assert.equal(
    live.el.textContent,
    'watch L4 w2 – woods L4 w4: Registered figure · Alliteration holds'
  );
  live.say('watch L4 w2 – woods L4 w4: Registered figure · Alliteration holds');
  assert.equal(live.el.textContent, '');
  await tick(win);
  assert.match(live.el.textContent, /holds$/);
});

test('Esc clears, Enter inspects, arrows move only inside the matrix grid', () => {
  const { B, win, doc } = load();
  const root = doc.getElementById('surface-library');
  root.innerHTML =
    '<div id="grid"><button id="cell">A</button></div><span id="word" tabindex="0">watch</span>';
  const calls = [];
  const unbind = B.bindKeys(
    root,
    CI,
    {
      clear: () => calls.push('clear'),
      inspect: () => calls.push('inspect'),
      move: (k) => calls.push(k),
    },
    { grid: doc.getElementById('grid') }
  );
  const word = doc.getElementById('word');
  key(win, word, 'Escape');
  key(win, word, 'Enter');
  key(win, word, 'ArrowUp'); // outside the grid: left to the page
  key(win, doc.getElementById('cell'), 'ArrowRight');
  key(win, doc.getElementById('cell'), 'Enter'); // a button activates itself
  assert.deepEqual(calls, ['clear', 'inspect', 'ArrowRight']);
  unbind();
  key(win, word, 'Escape');
  assert.equal(calls.length, 3);
});

test('typing in a field is never taken, except Esc', () => {
  const { B, win, doc } = load();
  const root = doc.getElementById('surface-library');
  root.innerHTML = '<div id="grid"><input id="q"></div>';
  const calls = [];
  B.bindKeys(
    root,
    CI,
    {
      clear: () => calls.push('clear'),
      inspect: () => calls.push('inspect'),
      move: (k) => calls.push(k),
    },
    { grid: doc.getElementById('grid') }
  );
  const q = doc.getElementById('q');
  key(win, q, 'Enter');
  key(win, q, 'ArrowLeft');
  key(win, q, 'Escape');
  assert.deepEqual(calls, ['clear']);
});

test('a selection is written to the URL, other parameters kept, and Back restores it', async () => {
  const { B, win } = load();
  const restored = [];
  const sync = B.urlSync(
    win,
    CI,
    current,
    (s) => restored.push(s && CI.selectionKey(s)),
    () => {}
  );
  const sel = CI.pair(ALLIT, 'e-watch-4-2', 'e-woods-4-4');
  sync.write(sel);
  assert.equal(new URLSearchParams(win.location.search).get('tab'), 'library');
  assert.equal(new URLSearchParams(win.location.search).get('cv'), 'analysis-rev-1');
  sync.write(CI.occurrence('e-woods-1-2'));
  sync.write(null);
  assert.equal(new URLSearchParams(win.location.search).get('sel'), null);
  win.history.back();
  await new Promise((r) => win.addEventListener('popstate', () => r(), { once: true }));
  assert.equal(restored.at(-1), CI.selectionKey(CI.occurrence('e-woods-1-2')));
  win.history.back();
  await new Promise((r) => win.addEventListener('popstate', () => r(), { once: true }));
  assert.equal(restored.at(-1), CI.selectionKey(sel));
  sync.stop();
});

test('a stale link is refused with its reason and never restored as another selection', () => {
  const qs = CI.encodeSelection('analysis-rev-0', CI.pair(ALLIT, 'e-watch-4-2', 'e-woods-4-4'));
  const { B, win } = load(`https://codexmusica.test/codex.html?tab=library&${qs}`);
  const restored = [];
  const refused = [];
  B.urlSync(
    win,
    CI,
    current,
    (s) => restored.push(s),
    (r) => refused.push(r)
  ).read();
  assert.deepEqual(restored, []);
  assert.equal(refused.length, 1);
  assert.equal(refused[0].message, 'This pair no longer exists in the current revision.');
});

test('writing the same selection twice adds one history entry', () => {
  const { B, win } = load();
  const sync = B.urlSync(
    win,
    CI,
    current,
    () => {},
    () => {}
  );
  const before = win.history.length;
  sync.write(CI.occurrence('e-know-1-8'));
  sync.write(CI.occurrence('e-know-1-8'));
  assert.equal(win.history.length, before + 1);
});

test('the hidden notice shows the model’s words and its Show action', () => {
  const { B, doc } = load();
  const notice = CI.hiddenNotice(CI.pair(ALLIT, 'e-watch-4-2', 'e-woods-4-4'), {
    checkedMethods: new Set([RHYME]),
    methodName: () => 'Alliteration',
  });
  const shown = [];
  const el = B.hiddenNotice(doc, notice, (a) => shown.push(a.method_id));
  assert.match(el.textContent, /^Selected pair hidden by current methods · Show Alliteration$/);
  el.querySelector('button').click();
  assert.deepEqual(shown, [ALLIT]);
  assert.equal(
    B.hiddenNotice(doc, null, () => {}),
    null
  );
});

test('Cell shows lists only checked methods with their layer, and announces a forced change', () => {
  const { B, doc } = load();
  const checked = [
    { method_id: ALLIT, name: 'Alliteration', layer: 'registered' },
    { method_id: RHYME, name: 'Perfect rhyme', layer: 'registered' },
  ];
  const changes = [];
  const said = [];
  const c = B.cellShowsControl(doc, CI, checked, ALLIT, (v) => changes.push(v), {
    say: (t) => said.push(t),
  });
  const select = c.el.querySelector('select');
  assert.equal(c.el.textContent.startsWith('Cell shows'), true);
  assert.deepEqual(
    [...select.options].map((o) => o.textContent),
    ['Registered: Alliteration', 'Registered: Perfect rhyme']
  );
  assert.equal(select.value, ALLIT);
  select.value = RHYME;
  select.dispatchEvent(new doc.defaultView.Event('change'));
  assert.deepEqual(changes, [RHYME]);
  assert.deepEqual(said, []);
  B.cellShowsControl(doc, CI, [checked[1]], ALLIT, () => {}, { say: (t) => said.push(t) });
  assert.equal(said.length, 1);
  assert.match(said[0], /no longer checked/);
});

test('the phone sheet opens to its heading, Esc closes it, and focus returns', () => {
  const { B, win, doc } = load();
  const root = doc.getElementById('surface-library');
  root.innerHTML = '<button id="row">woods · L4 w4</button>';
  const row = doc.getElementById('row');
  const sheet = B.bottomSheet(root, 'Pair inspector');
  assert.equal(sheet.isOpen(), false);
  assert.equal(
    sheet.el.querySelector('.lib-cb-sheet-handle').getAttribute('aria-expanded'),
    'false'
  );
  row.focus();
  sheet.open(row);
  assert.equal(sheet.isOpen(), true);
  assert.equal(doc.activeElement.tagName, 'H2');
  assert.equal(
    sheet.el.querySelector('.lib-cb-sheet-handle').getAttribute('aria-expanded'),
    'true'
  );
  const outer = [];
  B.bindKeys(root, CI, { clear: () => outer.push('clear'), inspect: () => {}, move: () => {} });
  key(win, doc.activeElement, 'Escape');
  assert.equal(sheet.isOpen(), false);
  assert.equal(doc.activeElement, row);
  assert.deepEqual(outer, [], 'the first Esc closes the sheet and keeps the selection');
  key(win, row, 'Escape');
  assert.deepEqual(outer, ['clear']);
});

// ---- mount: the owner that wires all of the above to the views ----------

const OCC6 = [
  ['e-woods-1-2', 'woods', 1, 2],
  ['e-know-1-8', 'know', 1, 8],
  ['e-though-2-7', 'though', 2, 7],
  ['e-watch-4-2', 'watch', 4, 2],
  ['e-woods-4-4', 'woods', 4, 4],
  ['e-snow-4-8', 'snow', 4, 8],
].map(([entity_id, text, line, token]) => ({ entity_id, text, line, token }));

function fixtureModel() {
  return {
    occurrences: OCC6,
    methods: [
      { method_id: ALLIT, name: 'Alliteration', layer: 'registered', ordering: 'unordered' },
      { method_id: RHYME, name: 'Perfect rhyme', layer: 'registered', ordering: 'unordered' },
    ],
    checkedMethods: [ALLIT, RHYME],
    cellMethod: ALLIT,
    cells: [
      {
        selection: CI.pair(ALLIT, 'e-watch-4-2', 'e-woods-4-4'),
        inLocus: true,
        record: { outcome: true, informative_channels: ['onset'] },
      },
      { selection: CI.pair(ALLIT, 'e-woods-1-2', 'e-watch-4-2'), inLocus: false },
    ],
    selection: null,
  };
}

// A stand-in for the views (#644): it draws only the hooks the owner reads.
function fakeCreateViews(doc) {
  return ({ interaction: I }) => ({
    render(model, { view }) {
      const root = doc.createElement('section');
      for (const id of ['poem', 'matrix', 'network']) {
        const tab = doc.createElement('button');
        tab.dataset.view = id;
        tab.textContent = id;
        root.append(tab);
      }
      for (const o of model.occurrences) {
        const b = doc.createElement('button');
        b.dataset.selection = I.selectionKey(I.occurrence(o.entity_id));
        b.textContent = o.text;
        root.append(b);
      }
      const box = doc.createElement('input');
      box.type = 'checkbox';
      box.dataset.method = ALLIT;
      box.checked = model.checkedMethods.includes(ALLIT);
      root.append(box);
      const table = doc.createElement('table');
      table.append(doc.createElement('tr'));
      model.occurrences.forEach((a, row) => {
        const tr = doc.createElement('tr');
        model.occurrences.forEach((b, col) => {
          const td = doc.createElement('td');
          if (row < col) {
            const btn = doc.createElement('button');
            btn.dataset.selection = I.selectionKey(
              I.pair(model.cellMethod, a.entity_id, b.entity_id)
            );
            btn.dataset.row = row;
            btn.dataset.col = col;
            td.append(btn);
          }
          tr.append(td);
        });
        table.append(tr);
      });
      const pane = doc.createElement('aside');
      pane.className = 'cv-inspector';
      pane.textContent = `view=${view} selected=${model.selection ? I.selectionKey(model.selection) : ''}`;
      root.append(table, pane);
      return root;
    },
  });
}

function mounted(url, narrow) {
  const { B, win, doc } = load(url);
  win.requestAnimationFrame = (f) => win.setTimeout(f, 0);
  const host = doc.getElementById('surface-library');
  const m = B.mount(host, {
    ci: CI,
    marks: {},
    createViews: fakeCreateViews(doc),
    model: fixtureModel(),
    current,
    narrow: () => !!narrow,
  });
  const live = host.querySelector('.lib-cb-live');
  return { B, win, doc, host, m, live };
}
const keyOf = (sel) => CI.selectionKey(sel);
const find = (host, key) =>
  [...host.querySelectorAll('[data-selection]')].find((n) => n.dataset.selection === key);

test('mount: clicking a cell selects it, writes the URL and announces it in words', async () => {
  const { win, host, m, live } = mounted();
  const sel = CI.pair(ALLIT, 'e-watch-4-2', 'e-woods-4-4');
  find(host, keyOf(sel)).click();
  assert.equal(CI.sameSelection(m.model().selection, sel), true);
  assert.equal(new URLSearchParams(win.location.search).get('sel'), keyOf(sel));
  await tick(win);
  assert.equal(
    live.textContent,
    'watch L4 w2 – woods L4 w4: Registered figure · Alliteration holds'
  );
  assert.equal(
    host.ownerDocument.activeElement.dataset.selection,
    keyOf(sel),
    'focus survives the redraw'
  );
});

test('mount: an occurrence announces its counts; an unsupplied pair says so', async () => {
  const { win, host, live } = mounted();
  find(host, keyOf(CI.occurrence('e-woods-1-2'))).click();
  await tick(win);
  assert.equal(live.textContent, 'woods L1 w2 selected: 1 outside this method’s locus');
  find(host, keyOf(CI.pair(ALLIT, 'e-know-1-8', 'e-snow-4-8'))).click();
  await tick(win);
  assert.equal(live.textContent, 'know L1 w8 – snow L4 w8: not supplied');
});

test('mount: unchecking the method keeps the selection and announces it hidden', async () => {
  const { win, doc, host, m, live } = mounted();
  const sel = CI.pair(ALLIT, 'e-watch-4-2', 'e-woods-4-4');
  find(host, keyOf(sel)).click();
  const box = host.querySelector('input[data-method]');
  box.checked = false;
  box.dispatchEvent(new win.Event('change', { bubbles: true }));
  assert.equal(CI.sameSelection(m.model().selection, sel), true);
  assert.deepEqual(m.model().checkedMethods, [RHYME]);
  m.select(sel);
  await tick(win);
  assert.match(live.textContent, /; hidden by current methods$/);
  assert.ok(doc);
});

test('mount: arrows walk the matrix, activating a cell selects it, Esc clears', async () => {
  const { win, doc, host, m } = mounted();
  const start = host.querySelector('[data-row="3"][data-col="4"]');
  start.focus();
  key(win, start, 'ArrowRight');
  assert.equal(doc.activeElement.dataset.col, '5');
  key(win, doc.activeElement, 'ArrowUp');
  assert.deepEqual([doc.activeElement.dataset.row, doc.activeElement.dataset.col], ['2', '5']);
  doc.activeElement.click(); // what Enter on a button does
  assert.equal(
    CI.sameSelection(m.model().selection, CI.pair(ALLIT, 'e-though-2-7', 'e-snow-4-8')),
    true
  );
  key(win, doc.activeElement, 'Escape');
  assert.equal(m.model().selection, null);
  assert.equal(new URLSearchParams(win.location.search).get('sel'), null);
});

test('mount: a link restores its selection, Back walks history, a stale link is refused', async () => {
  const sel = CI.pair(ALLIT, 'e-watch-4-2', 'e-woods-4-4');
  const good = mounted(
    `https://codexmusica.test/codex.html?tab=library&${CI.encodeSelection('analysis-rev-1', sel)}`
  );
  assert.equal(CI.sameSelection(good.m.model().selection, sel), true);
  find(good.host, keyOf(CI.occurrence('e-snow-4-8'))).click();
  good.win.history.back();
  await new Promise((r) => good.win.addEventListener('popstate', () => r(), { once: true }));
  await tick(good.win);
  assert.equal(CI.sameSelection(good.m.model().selection, sel), true);
  const stale = mounted(
    `https://codexmusica.test/codex.html?${CI.encodeSelection('analysis-rev-0', sel)}`
  );
  assert.equal(stale.m.model().selection, null);
  assert.equal(stale.m.model().notice, 'This pair no longer exists in the current revision.');
});

test('mount: tabs switch the view and keep the selection', () => {
  const { host, m } = mounted();
  const sel = CI.pair(ALLIT, 'e-watch-4-2', 'e-woods-4-4');
  find(host, keyOf(sel)).click();
  host.querySelector('[data-view="matrix"]').click();
  assert.equal(m.view(), 'matrix');
  assert.match(host.querySelector('.cv-inspector').textContent, /^view=matrix selected=p:/);
  assert.equal(host.ownerDocument.activeElement.dataset.view, 'matrix');
});

test('mount: at phone width the inspector sits in the sheet, and Enter on a mark opens it', () => {
  const { win, doc, host } = mounted(undefined, true);
  const sheet = host.querySelector('.lib-cb-sheet');
  assert.ok(sheet.querySelector('.cv-inspector'), 'the inspector moved into the sheet');
  // A focusable non-button mark (the poem's SVG groups) takes Enter itself.
  const mark = doc.createElement('span');
  mark.tabIndex = 0;
  mark.dataset.selection = keyOf(CI.pair(ALLIT, 'e-watch-4-2', 'e-woods-4-4'));
  host.querySelector('section').append(mark);
  mark.focus();
  key(win, mark, 'Enter');
  const reopened = host.querySelector('.lib-cb-sheet');
  assert.equal(reopened.querySelector('.lib-cb-sheet-body').hidden, false);
  assert.equal(doc.activeElement.tagName, 'H2');
});

test('mount: destroy removes its listeners and nodes', () => {
  const { win, host, m } = mounted();
  m.destroy();
  assert.equal(host.querySelector('.lib-cb-live'), null);
  assert.equal(host.children.length, 0);
  win.history.pushState(null, '', '?sel=o:e-know-1-8&cv=analysis-rev-1');
  win.dispatchEvent(new win.PopStateEvent('popstate'));
  assert.equal(m.model().selection, null);
});

test('Space and Enter both activate an SVG mark with role="button"', () => {
  const { B, win, doc } = load();
  const root = doc.getElementById('surface-library');
  root.innerHTML =
    '<svg><g id="mark" role="button" tabindex="0"></g></svg><button id="real">x</button>';
  const calls = [];
  B.bindKeys(root, CI, { clear: () => {}, inspect: () => calls.push('inspect'), move: () => {} });
  const mark = doc.getElementById('mark');
  key(win, mark, ' ');
  key(win, mark, 'Enter');
  key(win, doc.getElementById('real'), ' '); // a real button activates itself
  assert.deepEqual(calls, ['inspect', 'inspect']);
});

// ─── Poem geometry lifecycle (views.layoutPoem, 3PO's contract) ──────────
// A font set the test settles by hand, and views whose layoutPoem replaces
// the occurrence marks, as the real one does, and reports a chosen status.
function fakeFonts(win) {
  const listeners = new Set();
  const fonts = { status: 'loading', addEventListener: (t, f) => listeners.add(f) };
  fonts.removeEventListener = (t, f) => listeners.delete(f);
  fonts.ready = new Promise((r) => (fonts.settle = () => ((fonts.status = 'loaded'), r(fonts))));
  fonts.loadingdone = () => listeners.forEach((f) => f(new win.Event('loadingdone')));
  fonts.listeners = listeners;
  return fonts;
}
function laidOut({ loaded, status = 'ready' } = {}) {
  const { B, win, doc } = load();
  win.requestAnimationFrame = (f) => win.setTimeout(f, 0);
  const fonts = fakeFonts(win);
  if (loaded) fonts.settle();
  Object.defineProperty(doc, 'fonts', { value: fonts });
  const calls = [];
  const report = { status };
  const base = fakeCreateViews(doc);
  const createViews = (opts) => {
    const views = base(opts);
    views.layoutPoem = (root) => {
      calls.push({ root, connected: root.isConnected });
      for (const b of [...root.querySelectorAll('button[data-selection]')]) {
        if (b.closest('table')) continue;
        const copy = b.cloneNode(true);
        b.replaceWith(copy);
      }
      const ids = fixtureModel().occurrences.map((o) => o.entity_id);
      const poem =
        report.status === 'ready'
          ? { status: 'ready', measured: ids, fixture: [], issues: [] }
          : report.status === 'partial'
            ? {
                status: 'partial',
                measured: ids.slice(2),
                fixture: [],
                issues: ids
                  .slice(0, 2)
                  .map((entity_id) => ({ entity_id, reason: 'invalid_range' })),
              }
            : {
                status: 'unavailable',
                measured: [],
                fixture: [],
                issues: ids.map((entity_id) => ({ entity_id, reason: 'measurement_unavailable' })),
              };
      return { poems: [poem] };
    };
    return views;
  };
  const host = doc.getElementById('surface-library');
  const m = B.mount(host, {
    ci: CI,
    marks: {},
    createViews,
    model: fixtureModel(),
    current,
    narrow: () => false,
  });
  return { win, doc, host, m, fonts, calls, report, live: host.querySelector('.lib-cb-live') };
}

test('layout: waits for fonts, then lays out the mounted tree once', async () => {
  const { win, fonts, calls, host } = laidOut();
  assert.equal(calls.length, 0, 'nothing is measured before the fonts are in');
  fonts.settle();
  await tick(win);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].connected, true);
  assert.equal(calls[0].root, host.querySelector('section'));
});

test('layout: with fonts already in, it lays out before focus is restored', async () => {
  const { win, doc, host, calls } = laidOut({ loaded: true });
  const occ = keyOf(CI.occurrence('e-woods-1-2'));
  find(host, occ).click();
  assert.equal(calls.length, 2, 'mount and the redraw each lay out at once');
  assert.equal(doc.activeElement.dataset.selection, occ, 'focus lands on the replaced mark');
  assert.equal(doc.activeElement.isConnected, true);
  await tick(win);
});

test('layout: a newer render cancels the older one before the fonts settle', async () => {
  const { win, host, fonts, calls } = laidOut();
  find(host, keyOf(CI.occurrence('e-woods-1-2'))).click();
  find(host, keyOf(CI.occurrence('e-watch-4-2'))).click();
  fonts.settle();
  await tick(win);
  assert.equal(calls.length, 1, 'only the newest render is laid out');
  assert.equal(calls[0].root, host.querySelector('section'));
});

test('layout: destroy before the fonts settle measures nothing and stops listening', async () => {
  const { win, m, fonts, calls } = laidOut();
  m.destroy();
  fonts.settle();
  fonts.loadingdone();
  await tick(win);
  await tick(win);
  assert.equal(calls.length, 0);
  assert.equal(fonts.listeners.size, 0);
});

test('layout: focus on a poem mark survives a late layout that replaces it', async () => {
  const { win, doc, host, fonts } = laidOut();
  const occ = keyOf(CI.occurrence('e-woods-1-2'));
  find(host, occ).click();
  const before = doc.activeElement;
  assert.equal(before.dataset.selection, occ, 'focus is not held back for the fonts');
  fonts.settle();
  await tick(win);
  assert.notEqual(doc.activeElement, before, 'the mark was replaced');
  assert.equal(doc.activeElement.dataset.selection, occ);
});

test('layout: a later font load lays the current tree out again, once per frame', async () => {
  const { win, doc, host, fonts, calls } = laidOut({ loaded: true });
  const occ = keyOf(CI.occurrence('e-watch-4-2'));
  find(host, occ).click();
  const n = calls.length;
  fonts.loadingdone();
  fonts.loadingdone();
  await tick(win);
  assert.equal(calls.length, n + 1);
  assert.equal(doc.activeElement.dataset.selection, occ);
});

test('layout: partial and unavailable are said once, after the selection; ready is silent', async () => {
  const ready = laidOut({ loaded: true });
  await tick(ready.win);
  assert.equal(ready.live.textContent, '', 'a ready poem says nothing');

  const { win, host, fonts, live, report } = laidOut({ loaded: true, status: 'partial' });
  await tick(win);
  assert.equal(
    live.textContent,
    'Poem: 2 of 6 words could not be placed, so their connections are not drawn..'
  );
  find(host, keyOf(CI.occurrence('e-woods-1-2'))).click();
  await tick(win);
  assert.equal(
    live.textContent,
    'woods L1 w2 selected: 1 outside this method’s locus',
    'the same partial poem is not said again on every redraw'
  );
  report.status = 'unavailable';
  fonts.loadingdone();
  await tick(win);
  await tick(win);
  assert.equal(
    live.textContent,
    'Poem: word positions could not be measured, so no connections are drawn on it..',
    'getting worse is said'
  );
  report.status = 'partial';
  find(host, keyOf(CI.pair(ALLIT, 'e-watch-4-2', 'e-woods-4-4'))).click();
  await tick(win);
  assert.equal(
    live.textContent,
    'watch L4 w2 – woods L4 w4: Registered figure · Alliteration holds',
    'getting better is not announced as a problem'
  );
});
