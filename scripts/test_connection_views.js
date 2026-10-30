#!/usr/bin/env node
'use strict';
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
const source = fs.readFileSync(path.join(__dirname, '../src/library/connection-views.js'), 'utf8');
function setup() {
  const dom = new JSDOM(
    '<!doctype html><html data-theme="light"><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><main id="surface-library"></main></body></html>',
    { runScripts: 'outside-only' }
  );
  const w = dom.window;
  const theme = w.document.createElement('style');
  theme.textContent = fs.readFileSync(path.join(__dirname, '../src/theme.css'), 'utf8');
  w.document.head.append(theme);
  w.eval(fs.readFileSync(interactionPath, 'utf8'));
  const I = w.CMConnectionInteraction;
  const M = w.eval(`(function(){${fs.readFileSync(marksPath, 'utf8')}\n})()`);
  const V = w.eval(`(function(){${source}\n})()`).createViews({ interaction: I, marks: M });
  return { dom, I, M, V, model: authoredFixture(I) };
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
