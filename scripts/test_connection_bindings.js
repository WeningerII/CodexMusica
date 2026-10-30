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
