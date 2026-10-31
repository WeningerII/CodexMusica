#!/usr/bin/env node
'use strict';
/* global window, document, views, model, root, CMConnectionInteraction, requestAnimationFrame */
const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

// Integration seam: use the actual teammate sources, not substitute logic.
// Before their branches land, point these env vars at extracted source files.
const interactionPath =
  process.env.CONNECTION_INTERACTION_SOURCE ||
  path.join(__dirname, '../src/connection-interaction.js');
const marksPath =
  process.env.CONNECTION_MARKS_SOURCE || path.join(__dirname, '../src/library/marks.js');
const bindingsPath =
  process.env.CONNECTION_BINDINGS_SOURCE ||
  path.join(__dirname, '../src/library/connection-bindings.js');
const source = fs.readFileSync(
  process.env.CONNECTION_VIEWS_SOURCE || path.join(__dirname, '../src/library/connection-views.js'),
  'utf8'
);
function setup() {
  const dom = new JSDOM(
    '<!doctype html><html data-theme="light"><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><main id="surface-library"></main></body></html>',
    { runScripts: 'outside-only', url: 'https://example.test/library?keep=1' }
  );
  const w = dom.window;
  const theme = w.document.createElement('style');
  theme.textContent = fs.readFileSync(path.join(__dirname, '../src/theme.css'), 'utf8');
  w.document.head.append(theme);
  w.eval(fs.readFileSync(interactionPath, 'utf8'));
  const I = w.CMConnectionInteraction;
  const M = w.eval(`(function(){${fs.readFileSync(marksPath, 'utf8')}\n})()`);
  const api = w.eval(`(function(){${source}\n})()`);
  const V = api.createViews({ interaction: I, marks: M });
  const model = authoredFixture(I);
  model.poem.fixtureBoxes = true;
  return { dom, I, M, V, api, model };
}

// Authored visual fixture. No engine was run; omitted results stay not supplied.
function authoredFixture(I) {
  const occurrences = [
    ['woods1', 'woods', 1, 2, false],
    ['know', 'know', 1, 8, true],
    ['though', 'though', 2, 7, true],
    ['watch', 'watch', 4, 2, false],
    ['woods4', 'woods', 4, 4, false],
    ['snow', 'snow', 4, 8, true],
  ].map(([entity_id, text, line, token, final]) => ({ entity_id, text, line, token, final }));
  const methods = [
    {
      method_id: 'schema:alliteration@fixture',
      name: 'Alliteration',
      family: 'alliteration',
      layer: 'registered',
      ordering: 'unordered',
      matrix_projection: 'exact_token_pair',
      coverage:
        'Same-line occurrences · illustrative reading · target route Library schema analysis · no runtime search',
    },
    {
      method_id: 'schema:rhyme@fixture',
      name: 'Perfect rhyme',
      family: 'rhyme',
      layer: 'registered',
      ordering: 'unordered',
      matrix_projection: 'exact_token_pair',
      coverage:
        'Line endings · illustrative reading · target route Library schema analysis · no runtime search',
    },
    {
      method_id: 'future:interior',
      name: 'Interior assonance',
      layer: 'registered',
      disabledReason: 'Not registered yet',
    },
    {
      method_id: 'future:sound',
      name: 'Shared onset',
      layer: 'sound',
      disabledReason: 'Sound layer not implemented',
    },
  ];
  const allit = methods[0].method_id,
    rhyme = methods[1].method_id;
  const hold = (m, a, b) => ({
    selection: I.pair(m, a, b),
    inLocus: true,
    record: {
      outcome: true,
      witness: 'Authored illustrative witness only',
      quantifier: 'illustrative compatible-reading witness',
    },
  });
  const cells = [
    hold(allit, 'watch', 'woods4'),
    hold(rhyme, 'know', 'though'),
    hold(rhyme, 'know', 'snow'),
    hold(rhyme, 'though', 'snow'),
  ];
  for (const a of occurrences)
    for (const b of occurrences)
      if (a.entity_id < b.entity_id && a.line !== b.line)
        cells.push({ selection: I.pair(allit, a.entity_id, b.entity_id), inLocus: false });
  cells[0].record.witness = 'watch = W AA1 CH · woods = W UH1 D Z (illustrative)';
  return {
    title: 'Stopping by Woods on a Snowy Evening',
    fixture: true,
    provenance: 'authored fixture only · not computed',
    occurrences,
    methods,
    cells,
    checkedMethods: [allit, rhyme],
    cellMethod: allit,
    selection: I.pair(allit, 'watch', 'woods4'),
    rowOccurrence: 'watch',
    counts: { holds: 4 },
    groupCounts: {
      [allit]: { occurrences: 2, shown: 1, examined: 1 },
      [rhyme]: { occurrences: 3, shown: 3, examined: 3 },
    },
    poem: {
      width: 850,
      height: 420,
      lines: [
        { y: 70, text: 'Whose woods these are I think I know.' },
        { y: 170, text: 'His house is in the village though;' },
        { y: 270, text: 'He will not see me stopping here' },
        { y: 370, text: 'To watch his woods fill up with snow.' },
      ],
      ranges: {
        woods1: { start: 6, end: 11 },
        know: { start: 32, end: 36 },
        though: { start: 28, end: 34 },
        watch: { start: 3, end: 8 },
        woods4: { start: 13, end: 18 },
        snow: { start: 32, end: 36 },
      },
      boxes: {
        woods1: { x: 120, y: 70, width: 66 },
        know: { x: 365, y: 70, width: 60 },
        though: { x: 296, y: 170, width: 78 },
        watch: { x: 80, y: 370, width: 65 },
        woods4: { x: 183, y: 370, width: 67 },
        snow: { x: 373, y: 370, width: 60 },
      },
    },
  };
}

test('all layouts consume the same selection, coverage, six-state marks and inspector', () => {
  const { V, model, dom } = setup();
  for (const view of ['poem', 'matrix', 'network']) {
    const root = V.render(model, { view });
    assert.match(root.textContent, /Illustrative subset · not computed/);
    assert.match(root.textContent, /Whole-word witness/);
    assert.match(root.textContent, /compared syllable not reported for this reading/);
    assert.match(root.textContent, /target route Library schema analysis/);
    assert.equal(root.querySelectorAll('.lib-mk-legend-item').length, 6);
    assert.equal(root.querySelectorAll('details').length, 1);
    assert.equal(root.querySelectorAll('input:disabled').length, 2);
    assert.match(root.textContent, /Shared sound \(not a registered figure\)/);
  }
  dom.window.close();
});
test('full occurrence triangle distinguishes duplicate spellings and never makes missing records false', () => {
  const { V, I, model } = setup();
  const root = V.matrix(model);
  assert.equal(root.querySelectorAll('table button').length, 15);
  const key = I.selectionKey(I.pair(model.cellMethod, 'woods1', 'watch'));
  const cell = [...root.querySelectorAll('table button')].find((b) => b.dataset.selection === key);
  assert.match(cell.getAttribute('aria-label'), /outside this method/);
  assert.equal(root.querySelectorAll('.lib-mk-cell-does_not_hold').length, 0);
  assert.match(root.textContent, /woods · L1 w2/);
  assert.match(root.textContent, /woods · L4 w4/);
  assert.ok([...root.querySelectorAll('table button')].some((b) => b.textContent === 'NS'));
});
test('phone row exposes every other occurrence and a real Cell shows select', () => {
  const { V, model } = setup();
  const root = V.render(model, { view: 'matrix' });
  assert.equal(root.querySelectorAll('.cv-phone-row button').length, 5);
  assert.equal(root.querySelectorAll('select option').length, 2);
  assert.match(root.querySelector('.cv-phone-row').textContent, /Matrix row · watch · L4 w2/);
  assert.equal(root.querySelectorAll('.cv-phone-row .cv-selected').length, 1);
});
test('poem retains full text, independent ports and only supplied holding arcs', () => {
  const { V, model } = setup();
  const root = V.poem(model);
  assert.equal(root.querySelectorAll('.lib-mk-port').length, 6);
  assert.equal(root.querySelectorAll('.lib-mk-arc').length, 4);
  assert.match(root.textContent, /He will not see me stopping here/);
  assert.equal(root.querySelectorAll('.lib-mk-select').length, 2);
});
test('network draws exact edges, equal radii and no inferred clique or group certificate', () => {
  const { V, model } = setup();
  const root = V.network(model);
  assert.equal(root.querySelectorAll('.lib-mk-edge').length, 4);
  assert.equal(root.querySelectorAll('.lib-mk-node').length, 5);
  assert.ok(
    [...root.querySelectorAll('.lib-mk-node > circle:first-child')].every(
      (c) => c.getAttribute('r') === '37'
    )
  );
  assert.match(root.textContent, /Joint reading consistency not assessed/);
  assert.match(root.textContent, /woods · L1 w2 · No holding edge supplied/);
});
test('six explicit states come from Don, including unknown reasons and no absent false inference', () => {
  const { V, I, model } = setup();
  const selection = model.selection;
  const checks = [
    [{ inLocus: false }, 'not_examined'],
    [{ inLocus: true }, 'not_yet_computed'],
    [{ inLocus: true, jobComplete: true }, 'undecided'],
    [
      { inLocus: true, record: { coverage: 'refused', refusal: { reason: 'missing frame' } } },
      'refused',
    ],
    [{ inLocus: true, record: { outcome: false } }, 'does_not_hold'],
    [{ inLocus: true, record: { outcome: true } }, 'holds'],
  ];
  for (const [facts, state] of checks) {
    model.cells = [{ selection, ...facts }];
    assert.equal(V.matrix(model).querySelector(`[data-state="${state}"]`) !== null, true);
    assert.match(V.inspector(model).textContent, new RegExp(I.STATE_WORDS[state]));
  }
  model.cells = [
    { selection, inLocus: true, record: { outcome: 'undecided', unknown_channels: ['nucleus'] } },
  ];
  assert.match(V.inspector(model).textContent, /nucleus not settled/);
});
test('directed roles render square cells and native arrows; spans never create pair edges', () => {
  const { V, I, model } = setup();
  const m = {
    ...model.methods[0],
    method_id: 'schema:directed',
    ordering: 'directed',
    member_roles: ['end', 'head'],
  };
  model.methods.push(m);
  model.checkedMethods = [m.method_id];
  model.cellMethod = m.method_id;
  model.selection = I.binding(m.method_id, [
    { role: 'end', entity_id: 'know' },
    { role: 'head', entity_id: 'woods4' },
  ]);
  model.cells = [
    {
      selection: model.selection,
      inLocus: true,
      record: { outcome: true, compared: { anchors: [0, 1] } },
    },
  ];
  assert.equal(V.matrix(model).querySelectorAll('table button').length, 30);
  const root = V.render(model, { view: 'network' });
  assert.match(
    root.querySelector('.cv-native').textContent,
    /end: know · L1 w8 → head: woods · L4 w4/
  );
  assert.equal(root.querySelectorAll('.lib-mk-edge').length, 0);
  assert.match(V.inspector(model).textContent, /"anchors":\[0,1\]/);
  model.figures = [
    {
      evidence_id: 'span1',
      method_id: m.method_id,
      members: ['know', 'woods4', 'snow'],
      inLocus: true,
      record: { outcome: true },
    },
  ];
  model.selection = I.figure('span1');
  assert.match(V.inspector(model).textContent, /Figure \/ span · span1/);
  assert.equal(V.network(model).querySelectorAll('.lib-mk-edge').length, 0);
});
test('a/b holds preserve asked direction through every route, groups and selection', () => {
  const { V, I, M, model, api } = setup();
  const method = model.methods[1];
  method.ordering = 'role_ordered';
  method.member_roles = ['a', 'b'];
  model.checkedMethods = [method.method_id];
  const routes = [
    ['woods4', 'watch', 'same-line'],
    ['snow', 'know', 'margin'],
    ['woods4', 'woods1', 'interline'],
  ];
  model.cells = routes.map(([a, b]) => ({
    selection: I.binding(method.method_id, [
      { role: 'a', entity_id: a },
      { role: 'b', entity_id: b },
    ]),
    inLocus: true,
    record: { outcome: true },
  }));
  const seen = [];
  const views = api.createViews({
    interaction: I,
    marks: {
      ...M,
      arcGeometry(a, b, options) {
        const geometry = M.arcGeometry(a, b, options);
        seen.push({ a, b, geometry });
        return geometry;
      },
    },
  });
  const poem = views.poem(model);
  assert.equal(poem.querySelectorAll('[data-directed="true"]').length, 3);
  assert.deepEqual(
    seen.map((s) => s.geometry.route),
    routes.map((r) => r[2])
  );
  routes.forEach(([a, b], i) => {
    const port = (id) => model.poem.boxes[id];
    assert.equal(seen[i].a.x, port(a).x + port(a).width / 2);
    assert.equal(seen[i].b.x, port(b).x + port(b).width / 2);
    assert.equal(seen[i].geometry.head.x, seen[i].b.x);
    assert.equal(seen[i].geometry.head.y, seen[i].b.y);
    const arc = poem.querySelectorAll('[data-directed="true"]')[i];
    assert.equal(arc.dataset.selection, I.selectionKey(model.cells[i].selection));
    assert.match(arc.getAttribute('aria-label'), /a: .* → b:/);
  });
  const network = V.network(model);
  assert.equal(network.querySelectorAll('.lib-mk-edge[data-directed="true"]').length, 3);
  assert.equal(network.querySelectorAll('.lib-mk-node').length, 5);
  model.selection = I.occurrence('watch');
  assert.equal(V.network(model).querySelectorAll('.lib-mk-edge.lib-mk-dim').length, 2);
  for (const cell of model.cells) {
    model.selection = cell.selection;
    assert.match(V.inspector(model).textContent, /Asked roles/);
    assert.match(V.inspector(model).textContent, /a: .* → b:/);
  }
  // Roles are looked up by name, never sorted by text or rewritten in the key.
  model.cells[0].selection = I.binding(
    method.method_id,
    [...model.cells[0].selection.members].reverse()
  );
  const key = I.selectionKey(model.cells[0].selection);
  assert.equal(V.poem(model).querySelector('[data-directed="true"]').dataset.selection, key);
  model.cells.push({
    ...model.cells[0],
    selection: I.binding(method.method_id, [
      { role: 'a', entity_id: 'watch' },
      { role: 'b', entity_id: 'know' },
      { role: 'c', entity_id: 'snow' },
    ]),
  });
  assert.equal(V.network(model).querySelectorAll('.lib-mk-edge').length, 3);
  method.family = undefined;
  assert.equal(V.network(model).querySelectorAll('.lib-mk-edge').length, 0);
  assert.equal(V.poem(model).querySelectorAll('.lib-mk-arc').length, 0);
});

test('hidden binding retains selection and exposes Don recovery action only when needed', () => {
  const { V, I, model } = setup();
  const before = I.selectionKey(model.selection);
  assert.equal(V.render(model).querySelector('[data-recovery]'), null);
  model.checkedMethods = [model.methods[1].method_id];
  const root = V.render(model);
  assert.match(root.textContent, /Selected pair hidden by current methods/);
  assert.equal(
    JSON.parse(root.querySelector('[data-recovery]').dataset.recovery).type,
    'check_method'
  );
  assert.equal(I.selectionKey(model.selection), before);
});
test('text is escaped by DOM construction and source remains unmounted', () => {
  const { V, model } = setup();
  model.title = '<img src=x onerror=alert(1)>';
  assert.equal(V.render(model).querySelector('img'), null);
  assert.doesNotMatch(source, /fetch\(|addEventListener\(|syllabif\w*\(/);
});

// Optional review output of the actual components, never a production fixture.
if (process.env.CONNECTION_PREVIEW_DIR) {
  fs.mkdirSync(process.env.CONNECTION_PREVIEW_DIR, { recursive: true });
  for (const view of ['poem', 'matrix', 'network']) {
    const { V, model, dom } = setup();
    dom.window.document.querySelector('main').append(V.render(model, { view }));
    fs.writeFileSync(
      path.join(process.env.CONNECTION_PREVIEW_DIR, `${view}.html`),
      dom.serialize()
    );
    dom.window.close();
  }
}

test('mixed layers keep explicit words and one-pixel sound marks; no function-word filter', () => {
  const { V, I, model } = setup();
  const m = {
    ...model.methods[0],
    method_id: 'sound:onset@fixture',
    layer: 'sound',
    name: 'Shared onset',
  };
  model.methods.push(m);
  model.checkedMethods.push(m.method_id);
  model.occurrences.find((o) => o.entity_id === 'know').text = 'the';
  model.cells.push({
    selection: I.pair(m.method_id, 'know', 'though'),
    inLocus: true,
    record: { outcome: true },
  });
  const root = V.render(model, { view: 'network' });
  assert.match(root.textContent, /Shared sound \(not a registered figure\) · Shared onset/);
  assert.equal(root.querySelector('.lib-mk-layer-sound path').getAttribute('stroke-width'), '1');
  assert.match(root.textContent, /the/);
  assert.equal(root.querySelectorAll('.lib-mk-edge').length, 5);
  assert.match(root.textContent, /Group counts not supplied/);
});

function actualBindings(dom) {
  return dom.window.eval(`(function(){${fs.readFileSync(bindingsPath, 'utf8')}\n})()`);
}
test('Don controls deliver Cell shows and recovery callbacks without changing selection', () => {
  const { dom, I, M, api, model } = setup();
  const B = actualBindings(dom),
    changes = [],
    recoveries = [],
    spoken = [];
  const V = api.createViews({
    interaction: I,
    marks: M,
    bindings: B,
    actions: { cellMethod: (id) => changes.push(id), show: (action) => recoveries.push(action) },
    live: { say: (words) => spoken.push(words) },
  });
  const before = I.selectionKey(model.selection);
  let root = V.render(model, { view: 'matrix' });
  const select = root.querySelector('.lib-cb-cellshows select');
  select.value = model.methods[1].method_id;
  select.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  assert.deepEqual(changes, [model.methods[1].method_id]);
  model.checkedMethods = [model.methods[1].method_id];
  root = V.render(model, { view: 'matrix' });
  root.querySelector('.lib-cb-hidden button').click();
  assert.equal(recoveries[0].method_id, model.selection.method_id);
  assert.match(spoken[0], /previous method is no longer checked/);
  assert.equal(I.selectionKey(model.selection), before);
  dom.window.close();
});
test('Don sheet consumes first Escape; second Escape reaches view clear and focus returns', () => {
  const { dom, I, V, model } = setup(),
    B = actualBindings(dom);
  const root = V.render(model, { view: 'matrix' });
  dom.window.document.querySelector('main').append(root);
  let cleared = 0;
  const moves = [];
  const stop = B.bindKeys(
    root,
    I,
    { clear: () => cleared++, inspect: () => {}, move: (key) => moves.push(key) },
    { grid: root.querySelector('table') }
  );
  const origin = root.querySelector('.cv-phone-row button');
  const sheet = B.bottomSheet(root, 'Connection inspector');
  sheet.body.append(root.querySelector('.cv-inspector'));
  origin.focus();
  sheet.open(origin);
  const esc = () =>
    dom.window.document.activeElement.dispatchEvent(
      new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    );
  esc();
  assert.equal(sheet.isOpen(), false);
  assert.equal(cleared, 0);
  assert.equal(dom.window.document.activeElement, origin);
  esc();
  assert.equal(cleared, 1);
  root
    .querySelector('table button')
    .dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  assert.deepEqual(moves, ['ArrowRight']);
  stop();
  esc();
  assert.equal(cleared, 1);
  dom.window.close();
});
test('Don URL and live region accept exact rendered occurrence IDs and refuse stale revision', async () => {
  const { dom, I, V, model } = setup(),
    B = actualBindings(dom);
  const root = V.render(model, { view: 'matrix' });
  dom.window.document.querySelector('main').append(root);
  const restored = [],
    refused = [];
  const sync = B.urlSync(
    dom.window,
    I,
    {
      analysisIdentity: 'fixture-v1',
      hasEntity: (id) => model.occurrences.some((o) => o.entity_id === id),
      hasMethod: (id) => model.methods.some((m) => m.method_id === id),
      hasEvidence: () => false,
    },
    (sel) => restored.push(sel),
    (reason) => refused.push(reason)
  );
  sync.write(model.selection);
  sync.read();
  assert.equal(
    I.selectionKey(restored[0]),
    root.querySelector('table .cv-selected').dataset.selection
  );
  assert.match(dom.window.location.search, /keep=1/);
  const live = B.liveRegion(root);
  live.say(
    I.announce(model.selection, {
      occurrence: (id) => model.occurrences.find((o) => o.entity_id === id),
      method: (id) => model.methods.find((m) => m.method_id === id),
      state: I.cellState(model.cells[0]),
    })
  );
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.match(live.el.textContent, /watch L4 w2/);
  assert.match(live.el.textContent, /woods L4 w4/);
  dom.window.history.replaceState(
    null,
    '',
    '?cv=stale&sel=' + encodeURIComponent(I.selectionKey(model.selection))
  );
  dom.window.dispatchEvent(new dom.window.PopStateEvent('popstate'));
  assert.equal(refused[0].reason, 'revision');
  assert.equal(restored.length, 1);
  sync.stop();
  dom.window.close();
});

test('partial and invalid group counts remain unknown without crashing or inferred totals', () => {
  const { V, model } = setup();
  const id = model.methods[0].method_id;
  for (const counts of [
    { shown: 1 },
    { occurrences: 2, shown: 1, examined: null },
    { occurrences: 2, shown: 1, examined: -1 },
    { occurrences: 2, shown: 1, examined: '3' },
  ]) {
    model.groupCounts[id] = counts;
    const group = V.network(model).querySelector('.cv-group');
    assert.match(group.textContent, /Holds shown: 1/);
    assert.match(group.textContent, /Eligible pairs examined: not supplied/);
    assert.doesNotMatch(group.textContent, /of 0|examined: 0/);
    assert.match(group.textContent, /Joint reading consistency not assessed/);
    assert.equal(group.querySelectorAll('.lib-mk-node').length, 2);
  }
  model.groupCounts[id] = { occurrences: 2, shown: 1, examined: 3, pending: 2, hidden: 4 };
  assert.match(
    V.network(model).textContent,
    /1 of 3 eligible pairs illustrated · 2 pending · 4 hidden/
  );
  model.groupCounts[id] = { occurrences: 0, shown: 0, examined: 0 };
  assert.match(V.network(model).textContent, /0 occurrences · 0 of 0 eligible pairs illustrated/);
});
test('hiddenCount passes the exact marks contract and incomplete metadata never invents zero', () => {
  const { V, model } = setup();
  model.hiddenCount = { count: 3, by: 'declared display filter' };
  assert.match(
    V.render(model).querySelector('.lib-mk-count').textContent,
    /3 hidden by declared display filter/
  );
  model.hiddenCount = { count: 3 };
  let root = V.render(model);
  assert.match(root.textContent, /Hidden count: 3 · filter: not supplied/);
  assert.doesNotMatch(root.textContent, /hidden by undefined/);
  for (const bad of [
    3,
    {},
    { count: null, by: 'filter' },
    { count: -1, by: 'filter' },
    { count: '3', by: 'filter' },
  ]) {
    model.hiddenCount = bad;
    root = V.render(model);
    assert.match(root.textContent, /Hidden count: not supplied/);
    assert.doesNotMatch(root.querySelector('.lib-mk-count').textContent, /0 hidden|3 hidden/);
  }
  delete model.hiddenCount;
  model.hiddenByFilter = 'filter';
  assert.match(V.render(model).textContent, /Hidden count: not supplied/);
});

test('selectable marks use Jony single dashed hover/focus treatment; selection stays solid', () => {
  const { V, model } = setup();
  for (const view of ['poem', 'matrix', 'network']) {
    const root = V.render(model, { view });
    assert.ok(
      [...root.querySelectorAll('[data-selection]')].every((node) =>
        node.classList.contains('lib-mk-focus')
      )
    );
    assert.ok(root.querySelector('.lib-mk-select') || root.querySelector('.cv-selected'));
    assert.doesNotMatch(root.querySelector('style').textContent, /\.cv-root g:focus-visible/);
    assert.match(
      root.querySelector('style').textContent,
      /button:not\(\.lib-mk-focus\):focus-visible/
    );
  }
});

test('browser poem geometry follows rendered fallback-font words, not fixture boxes', async () => {
  const { chromium } = require('playwright');
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
  try {
    const page = await browser.newPage();
    await page.setContent(
      '<html data-theme="light"><body><main id="surface-library"></main></body></html>'
    );
    await page.addStyleTag({
      content: fs.readFileSync(path.join(__dirname, '../src/theme.css'), 'utf8'),
    });
    await page.addScriptTag({ content: fs.readFileSync(interactionPath, 'utf8') });
    await page.addScriptTag({
      content: `window.marks = (function(){${fs.readFileSync(marksPath, 'utf8')} })(); window.views = (function(){${source} })().createViews({interaction: CMConnectionInteraction, marks}); window.model = (${authoredFixture.toString()})(CMConnectionInteraction);`,
    });
    await page.evaluate(() => {
      window.root = views.render(model, { view: 'poem' });
      document.querySelector('main').append(root);
    });
    await page.addStyleTag({
      content:
        '.cv-poem-line{font-family:"Missing Georgia Fixture", "DejaVu Serif", serif !important}',
    });
    const checkGeometry = async () =>
      page.evaluate(() => {
        if (views.layoutPoem) views.layoutPoem(root);
        return model.occurrences.map((o) => {
          const line = root.querySelectorAll('.cv-poem-line')[o.line - 1];
          const start = line.textContent.indexOf(o.text);
          const first = line.getExtentOfChar(start),
            last = line.getExtentOfChar(start + o.text.length - 1);
          const g = [...root.querySelectorAll('g[data-selection]')].find(
            (g) =>
              g.dataset.selection ===
              CMConnectionInteraction.selectionKey(CMConnectionInteraction.occurrence(o.entity_id))
          );
          if (!g) throw new Error('Missing occurrence geometry: ' + o.entity_id);
          const rect = g.querySelector('rect'),
            port = [...root.querySelectorAll('g[data-selection]')]
              .find((n) => n.dataset.selection === g.dataset.selection && n.querySelector('circle'))
              .querySelector('circle');
          const selected = port.closest('[data-selection]').querySelector('.lib-mk-select');
          return {
            id: o.entity_id,
            x: first.x,
            width: last.x + last.width - first.x,
            y: first.y,
            height: first.height,
            actualY: +rect.getAttribute('y'),
            actualHeight: +rect.getAttribute('height'),
            portY: +port.getAttribute('cy'),
            actualX: +rect.getAttribute('x'),
            actualWidth: +rect.getAttribute('width'),
            portX: +port.getAttribute('cx'),
            selectionX: selected && +selected.getAttribute('x'),
            selectionWidth: selected && +selected.getAttribute('width'),
          };
        });
      });
    await page.evaluate(() => document.fonts.ready);
    for (const font of ['"Missing Georgia Fixture", "DejaVu Serif", serif', 'monospace']) {
      await page.addStyleTag({ content: `.cv-poem-line{font-family:${font} !important}` });
      const geometry = await checkGeometry();
      for (const g of geometry) {
        assert.ok(
          Math.abs(g.actualX - g.x) < 0.1,
          `${font} ${g.id}: box x ${g.actualX}, text x ${g.x}`
        );
        assert.ok(Math.abs(g.actualWidth - g.width) < 0.1, `${font} ${g.id}: width`);
        assert.ok(
          Math.abs(g.actualY - g.y) < 0.1 && Math.abs(g.actualHeight - g.height) < 0.1,
          `${font} ${g.id}: vertical bounds`
        );
        assert.ok(Math.abs(g.portY - (g.y - 1)) < 0.1, `${font} ${g.id}: port height`);
        assert.ok(Math.abs(g.portX - g.x - g.width / 2) < 0.1, `${font} ${g.id}: port`);
        if (g.selectionX !== null) {
          assert.ok(Math.abs(g.selectionX - (g.x - 2)) < 0.1, `${font} ${g.id}: selection`);
          assert.ok(
            Math.abs(g.selectionWidth - (g.width + 4)) < 0.1,
            `${font} ${g.id}: selection width`
          );
        }
        const paths = await page
          .locator('.lib-mk-arc path')
          .evaluateAll((nodes) => nodes.map((n) => n.getAttribute('d')));
        assert.ok(
          paths.some(
            (d) => d.includes(`M${g.portX},${g.portY}`) || d.endsWith(`${g.portX},${g.portY}`)
          ) || g.id === 'woods1',
          `${font} ${g.id}: arc meets port`
        );
      }
    }
    const ready = await page.evaluate(() => views.layoutPoem(root));
    assert.equal(ready.poems[0].status, 'ready');
    assert.equal(ready.poems[0].measured.length, 6);
    assert.deepEqual(ready.poems[0].fixture, []);
    assert.deepEqual(ready.poems[0].issues, []);
    assert.equal(await page.locator('.cv-geometry-notice').isVisible(), false);
    await page.locator('svg.cv-poem').evaluate((svg) => {
      svg.style.width = '425px';
      svg.style.height = '210px';
    });
    for (const g of await checkGeometry())
      assert.ok(
        Math.abs(g.actualX - g.x) < 0.1 && Math.abs(g.actualWidth - g.width) < 0.1,
        `${g.id}: scaled SVG`
      );
    await page.locator('svg.cv-poem').evaluate((svg) => {
      svg.style.width = '';
      svg.style.height = '';
    });
    if (process.env.CONNECTION_PREVIEW_DIR) {
      await page.addStyleTag({
        content:
          '.cv-poem-line{font-family:"Missing Georgia Fixture", "DejaVu Serif", serif !important}',
      });
      await checkGeometry();
      await page.screenshot({
        path: path.join(process.env.CONNECTION_PREVIEW_DIR, 'poem-measured.png'),
        fullPage: true,
      });
    }
    const partial = await page.evaluate(() => {
      delete model.poem.ranges.watch;
      model.poem.ranges.woods4 = { start: 0, end: 5 };
      window.root.replaceWith((window.root = views.render(model, { view: 'poem' })));
      return views.layoutPoem(root);
    });
    assert.equal(partial.poems[0].status, 'partial');
    assert.equal(partial.poems[0].measured.length, 4);
    assert.deepEqual(partial.poems[0].issues, [
      { entity_id: 'watch', reason: 'missing_range' },
      { entity_id: 'woods4', reason: 'invalid_range' },
    ]);
    const notice = page.locator('.cv-geometry-notice');
    assert.equal(await notice.getAttribute('role'), 'note');
    assert.equal(await notice.isVisible(), true);
    assert.match(await notice.textContent(), /watch.*missing range.*woods4.*invalid range/);
    assert.equal(await page.locator('.lib-mk-port').count(), 4);
    assert.equal(await page.locator('.lib-mk-select').count(), 0);
    const repeated = await page.evaluate(() => {
      model.poem.lines[3].text = '😀  watch watch';
      model.occurrences.find((o) => o.entity_id === 'woods4').text = 'watch';
      model.poem.ranges.watch = { start: 4, end: 9 };
      model.poem.ranges.woods4 = { start: 10, end: 15 };
      window.root.replaceWith((window.root = views.render(model, { view: 'poem' })));
      views.layoutPoem(root);
      const line = root.querySelectorAll('.cv-poem-line')[3];
      return ['watch', 'woods4'].map((id, i) => {
        const key = CMConnectionInteraction.selectionKey(CMConnectionInteraction.occurrence(id));
        const g = [...root.querySelectorAll('g[data-selection]')].find(
          (g) => g.dataset.selection === key
        );
        return {
          actual: +g.querySelector('rect').getAttribute('x'),
          expected: line.getExtentOfChar(i ? 10 : 4).x,
        };
      });
    });
    assert.notEqual(repeated[0].actual, repeated[1].actual);
    for (const r of repeated) assert.ok(Math.abs(r.actual - r.expected) < 0.1);
  } finally {
    await browser.close();
  }
});

test('poem boxes require an explicit authored-fixture override; detached geometry is omitted', () => {
  const { V, model, dom } = setup();
  delete model.poem.fixtureBoxes;
  let root = V.poem(model);
  const detached = V.layoutPoem(root).poems[0];
  assert.equal(detached.status, 'unavailable');
  assert.equal(detached.issues.length, 6);
  assert.ok(detached.issues.every((i) => i.reason === 'detached'));
  assert.equal(root.querySelector('.cv-geometry-notice').hidden, false);
  assert.equal(root.querySelectorAll('.lib-mk-port').length, 0);
  dom.window.document.querySelector('main').append(root);
  const unsupported = V.layoutPoem(root).poems[0];
  assert.ok(unsupported.issues.every((i) => i.reason === 'measurement_unavailable'));
  assert.deepEqual(Array.from(V.layoutPoem(dom.window.document.createElement('div')).poems), []);

  model.poem.fixtureBoxes = true;
  model.fixture = false;
  assert.equal(V.poem(model).querySelectorAll('.lib-mk-port').length, 0);
  model.fixture = true;
  const fixtureRoot = V.poem(model);
  assert.equal(fixtureRoot.querySelectorAll('.lib-mk-port').length, 6);
  const fixtureStatus = V.layoutPoem(fixtureRoot).poems[0];
  assert.equal(fixtureStatus.status, 'ready');
  assert.equal(fixtureStatus.fixture.length, 6);
  assert.equal(fixtureStatus.measured.length, 0);

  dom.window.close();
});

test('throwing whole-line measurement reports unavailable without aborting detached render', () => {
  const { V, model, dom } = setup();
  delete model.poem.fixtureBoxes;
  let reads = 0;
  dom.window.SVGElement.prototype.getBBox = () => {
    reads++;
    throw new Error('Geometry unavailable');
  };
  const root = V.poem(model);
  assert.equal(reads, 0, 'detached text must not be measured');
  assert.equal(V.layoutPoem(root).poems[0].status, 'unavailable');
  dom.window.document.querySelector('main').append(root);
  const report = V.layoutPoem(root).poems[0];
  assert.ok(reads > 0);
  assert.equal(report.status, 'unavailable');
  assert.ok(report.issues.every((i) => i.reason === 'measurement_unavailable'));
  assert.equal(root.querySelectorAll('.lib-mk-port').length, 0);
  assert.equal(root.querySelector('.cv-geometry-notice').hidden, false);
  dom.window.close();
});

test('phone matrix with no selection offers occurrences and reaches a pair through real bindings', async () => {
  const { chromium } = require('playwright');
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 800 } });
    await page.route('https://connection.test/', (route) =>
      route.fulfill({ contentType: 'text/html', body: '<main id="surface-library"></main>' })
    );
    await page.goto('https://connection.test/');
    await page.addScriptTag({ content: fs.readFileSync(interactionPath, 'utf8') });
    await page.addScriptTag({
      content: `window.marks=(function(){${fs.readFileSync(marksPath, 'utf8')} })(); window.views=(function(){${source} })(); window.bindings=(function(){${fs.readFileSync(bindingsPath, 'utf8')} })(); window.model=(${authoredFixture.toString()})(CMConnectionInteraction);`,
    });
    await page.evaluate(() => {
      window.model.selection = null;
      window.model.rowOccurrence = null;
      window.m = window.bindings.mount(document.querySelector('main'), {
        ci: window.CMConnectionInteraction,
        marks: window.marks,
        createViews: window.views.createViews,
        model: window.model,
        current: {
          analysisIdentity: 'fixture',
          hasEntity: () => true,
          hasMethod: () => true,
          hasEvidence: () => false,
        },
        view: 'matrix',
      });
    });
    const choices = page.locator('.cv-phone-row button:visible');
    assert.equal(await choices.count(), 6, 'empty phone matrix must offer selectable occurrences');
    await choices.filter({ hasText: 'watch' }).click();
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.cv-phone-row button:visible').count(), 5);
    await page.locator('.cv-phone-row button:visible').filter({ hasText: 'woods · L4 w4' }).click();
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => window.m.model().selection.kind), 'pair');
    assert.equal(
      await page.evaluate(() => !!document.activeElement.closest('.cv-phone-row')),
      true
    );
    await page.evaluate(() => window.m.select(null));
    assert.equal(await choices.count(), 6, 'clearing selection restores the entry path');
    await page.setViewportSize({ width: 1280, height: 900 });
    assert.equal(await choices.count(), 0, 'phone choices stay hidden on desktop');
    assert.equal(await page.locator('.cv-desktop-matrix button:visible').count(), 15);
    await page.evaluate(() => window.m.destroy());
  } finally {
    await browser.close();
  }
});

test('poem natural Tab order follows readingOrder before accessible arcs', async () => {
  const { chromium } = require('playwright');
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
  try {
    const page = await browser.newPage();
    await page.route('https://connection.test/', (r) =>
      r.fulfill({ contentType: 'text/html', body: '<main id="surface-library"></main>' })
    );
    await page.goto('https://connection.test/');
    await page.addStyleTag({
      content: fs.readFileSync(path.join(__dirname, '../src/theme.css'), 'utf8'),
    });
    await page.addScriptTag({ content: fs.readFileSync(interactionPath, 'utf8') });
    await page.addScriptTag({
      content: `window.marks=(function(){${fs.readFileSync(marksPath, 'utf8')}})();window.views=(function(){${source}})();window.bindings=(function(){${fs.readFileSync(bindingsPath, 'utf8')}})();window.model=(${authoredFixture.toString()})(CMConnectionInteraction);`,
    });
    await page.evaluate(async () => {
      window.model.occurrences.reverse();
      window.m = window.bindings.mount(document.querySelector('main'), {
        ci: window.CMConnectionInteraction,
        marks: window.marks,
        createViews: window.views.createViews,
        model: window.model,
        current: {
          analysisIdentity: 'fixture',
          hasEntity: () => true,
          hasMethod: () => true,
          hasEvidence: () => false,
        },
        view: 'poem',
        narrow: () => false,
      });
      await document.fonts.ready;
      document.querySelector('svg.cv-poem [tabindex="0"]').focus();
    });
    const expected = await page.evaluate(() =>
      window.CMConnectionInteraction.readingOrder(window.model.occurrences).map((o) =>
        window.CMConnectionInteraction.selectionKey(
          window.CMConnectionInteraction.occurrence(o.entity_id)
        )
      )
    );
    const order = [];
    for (let i = 0; i < 10; i++) {
      order.push(await page.evaluate(() => document.activeElement.dataset.selection));
      if (i < 9) await page.keyboard.press('Tab');
    }
    assert.deepEqual(order.slice(0, 6), expected);
    assert.ok(order.slice(6).every((k) => k.startsWith('p:')));
    assert.equal(new Set(order.slice(6)).size, 4);
    assert.equal(
      await page
        .locator('svg.cv-poem [tabindex]')
        .evaluateAll((ns) => ns.some((n) => +n.getAttribute('tabindex') > 0)),
      false
    );
    await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(() => window.m.model().selection.kind), 'pair');
    assert.equal(await page.evaluate(() => document.activeElement.dataset.selection), order[9]);
    assert.match(await page.locator('.cv-inspector').textContent(), /Whole-word witness/);
    await page.evaluate(() => window.m.select(window.CMConnectionInteraction.occurrence('woods1')));
    assert.equal(await page.evaluate(() => document.activeElement.dataset.selection), expected[0]);
    await page.evaluate(() => window.m.destroy());
  } finally {
    await browser.close();
  }
});

test('browser directed holds point into b, keep selection across views and follow words in Tab order', async () => {
  const { chromium } = require('playwright');
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.route('https://connection.test/', (r) =>
      r.fulfill({ contentType: 'text/html', body: '<main id="surface-library"></main>' })
    );
    await page.goto('https://connection.test/');
    await page.addStyleTag({
      content: fs.readFileSync(path.join(__dirname, '../src/theme.css'), 'utf8'),
    });
    await page.addScriptTag({ content: fs.readFileSync(interactionPath, 'utf8') });
    await page.addScriptTag({
      content: `window.marks=(function(){${fs.readFileSync(marksPath, 'utf8')}})();window.views=(function(){${source}})();window.bindings=(function(){${fs.readFileSync(bindingsPath, 'utf8')}})();window.model=(${authoredFixture.toString()})(CMConnectionInteraction);`,
    });
    await page.evaluate(async () => {
      const I = window.CMConnectionInteraction,
        model = window.model;
      delete model.poem.fixtureBoxes;
      model.occurrences.reverse();
      const method = model.methods[1];
      method.ordering = 'role_ordered';
      method.member_roles = ['a', 'b'];
      model.checkedMethods = [method.method_id];
      model.cellMethod = method.method_id;
      model.selection = null;
      model.cells = [
        ['woods4', 'watch'],
        ['snow', 'know'],
        ['woods4', 'woods1'],
      ].map(([a, b]) => ({
        selection: I.binding(method.method_id, [
          { role: 'a', entity_id: a },
          { role: 'b', entity_id: b },
        ]),
        inLocus: true,
        record: { outcome: true },
      }));
      window.m = window.bindings.mount(document.querySelector('main'), {
        ci: I,
        marks: window.marks,
        createViews: window.views.createViews,
        model,
        current: {
          analysisIdentity: 'directed-fixture',
          hasEntity: () => true,
          hasMethod: () => true,
          hasEvidence: () => false,
        },
        view: 'poem',
        narrow: () => false,
      });
      await document.fonts.ready;
    });
    await page.waitForSelector('.cv-poem [data-directed="true"]');
    const geometry = await page.evaluate(() => {
      const I = window.CMConnectionInteraction;
      const find = (selector, key) =>
        [...document.querySelectorAll(selector)].find((n) => n.dataset.selection === key);
      return window.model.cells.map((cell, i) => {
        const b = cell.selection.members.find((m) => m.role === 'b').entity_id;
        const rect = find('.cv-poem g[tabindex]', I.selectionKey(I.occurrence(b))).querySelector(
          'rect'
        );
        const x = +rect.getAttribute('x') + +rect.getAttribute('width') / 2,
          y = +rect.getAttribute('y') - 1;
        const arc = find('.cv-poem [data-directed]', I.selectionKey(cell.selection));
        const [hx, hy] = arc
          .querySelector('.lib-mk-head')
          .getAttribute('d')
          .slice(1)
          .split(' ')[0]
          .split(',')
          .map(Number);
        return {
          hx,
          hy,
          x: x + (i === 1 ? 5 : i === 2 ? -5 : 0),
          y: y - (i === 0 ? 5 : 0),
          label: arc.getAttribute('aria-label'),
        };
      });
    });
    for (const g of geometry) {
      assert.ok(Math.hypot(g.hx - g.x, g.hy - g.y) < 0.02, JSON.stringify(g));
      assert.match(g.label, /a: .* → b:/);
    }
    const expected = await page.evaluate(() =>
      window.CMConnectionInteraction.readingOrder(window.model.occurrences).map((o) =>
        window.CMConnectionInteraction.selectionKey(
          window.CMConnectionInteraction.occurrence(o.entity_id)
        )
      )
    );
    await page.locator('.cv-poem g[tabindex]').first().focus();
    for (const key of expected) {
      assert.equal(await page.evaluate(() => document.activeElement.dataset.selection), key);
      await page.keyboard.press('Tab');
    }
    const key = await page.evaluate(() => document.activeElement.dataset.selection);
    assert.ok(key.startsWith('b:'));
    await page.keyboard.press('Enter');
    const selectedUrl = page.url();
    assert.match(await page.locator('.cv-inspector').textContent(), /Asked roles/);
    for (const view of ['matrix', 'network', 'poem']) {
      await page.click(`[data-view="${view}"]`);
      assert.equal(
        await page.evaluate(() =>
          window.CMConnectionInteraction.selectionKey(window.m.model().selection)
        ),
        key
      );
      assert.equal(page.url(), selectedUrl);
      const matching = await page.locator('[data-selection]').evaluateAll(
        (ns, key) =>
          ns
            .filter((n) => n.dataset.selection === key)
            .map((n) => ({
              selected: n.classList.contains('cv-selected'),
              directed: n.dataset.directed,
            })),
        key
      );
      assert.ok(matching.some((n) => (view === 'matrix' ? n.selected : n.directed === 'true')));
      if (view === 'network') {
        const rims = await page.evaluate(() => {
          const I = window.CMConnectionInteraction,
            root = document.querySelector('.cv-network');
          return window.model.cells.map((cell) => {
            const b = cell.selection.members.find((m) => m.role === 'b').entity_id;
            const node = [...root.querySelectorAll('.lib-mk-node')]
              .find((n) => n.dataset.selection === I.selectionKey(I.occurrence(b)))
              .querySelector('circle');
            const edge = [...root.querySelectorAll('.lib-mk-edge')].find(
              (n) => n.dataset.selection === I.selectionKey(cell.selection)
            );
            const [x, y] = edge
              .querySelector('.lib-mk-head')
              .getAttribute('d')
              .slice(1)
              .split(' ')[0]
              .split(',')
              .map(Number);
            return Math.hypot(x - +node.getAttribute('cx'), y - +node.getAttribute('cy'));
          });
        });
        rims.forEach((r) => assert.ok(Math.abs(r - 37) < 0.02));
      }
    }
    // The compact affine bounds calculation must equal the original four-corner
    // transform, including rotation, skew and reflection (not only plain scale).
    for (const transform of ['rotate(7deg)', 'skew(12deg, -5deg)', 'scale(-0.8, 1.2)']) {
      const errors = await page.evaluate(async (transform) => {
        const canvas = document.querySelector('.cv-poem');
        canvas.style.transform = transform;
        document.fonts.dispatchEvent(new Event('loadingdone'));
        await new Promise(requestAnimationFrame);
        const I = window.CMConnectionInteraction;
        return window.model.occurrences
          .map((o) => {
            const line = canvas.querySelectorAll('.cv-poem-line')[o.line - 1];
            const offsets = window.model.poem.ranges[o.entity_id];
            const range = document.createRange();
            range.setStart(line.firstChild, offsets.start);
            range.setEnd(line.firstChild, offsets.end);
            const rect = range.getBoundingClientRect(),
              inverse = canvas.getScreenCTM().inverse();
            const corners = [
              [rect.left, rect.top],
              [rect.right, rect.top],
              [rect.right, rect.bottom],
              [rect.left, rect.bottom],
            ].map(([x, y]) => {
              const p = canvas.createSVGPoint();
              p.x = x;
              p.y = y;
              return p.matrixTransform(inverse);
            });
            const x = Math.min(...corners.map((p) => p.x)),
              y = Math.min(...corners.map((p) => p.y));
            const expected = [
              x,
              y,
              Math.max(...corners.map((p) => p.x)) - x,
              Math.max(...corners.map((p) => p.y)) - y,
            ];
            const box = [...canvas.querySelectorAll('g[tabindex]')]
              .find((n) => n.dataset.selection === I.selectionKey(I.occurrence(o.entity_id)))
              .querySelector('rect');
            return ['x', 'y', 'width', 'height'].map((key, i) =>
              Math.abs(+box.getAttribute(key) - expected[i])
            );
          })
          .flat();
      }, transform);
      assert.ok(
        errors.every((e) => e < 0.02),
        `${transform}: ${errors}`
      );
    }
    await page.evaluate(() => window.m.destroy());
  } finally {
    await browser.close();
  }
});

test('unordered poem, network and matrix output remains byte-identical to d2fea651f', () => {
  // Captured from the actual d2fea651f views + marks with the authored fixture.
  const hashes = {
    poem: 'a95047a27a30d0e8aa3cd474b22bf9442d609ad0d59a430347e7701cbbff12b6',
    network: '3d2a656e9225a52cfab4d0fe29f9c51786802129ae5dff1a3c7553420c353e0c',
    matrix: '4b9ceef819f725ad766581a006d5d7b2655ab8c3ea929bb875ed95be30e5f51c',
  };
  const { V, model, dom } = setup();
  for (const [view, hash] of Object.entries(hashes)) {
    const root = V[view](model);
    assert.equal(root.querySelectorAll('.lib-mk-head,[data-directed]').length, 0);
    assert.equal(
      require('node:crypto').createHash('sha256').update(root.outerHTML).digest('hex'),
      hash,
      view
    );
  }
  dom.window.close();
});
