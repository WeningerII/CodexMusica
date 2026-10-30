#!/usr/bin/env node
'use strict';
// src/library/marks.js: the connection views' visual system. Each rule below
// is one of the spec's conditions (docs/design/connection-views/spec.md).
const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

function load() {
  const dom = new JSDOM('<div id="surface-library"></div>', { runScripts: 'outside-only' });
  const api = dom.window.eval(
    `(function () {${fs.readFileSync(path.join(__dirname, '../src/library/marks.js'), 'utf8')}\n})()`
  );
  return { api, document: dom.window.document };
}
const { api: M } = load();
const watch = { line: 4, token: 2, text: 'watch' };
const woods = { line: 4, token: 4, text: 'woods' };
const woods1 = { line: 1, token: 2, text: 'woods' };

test('an occurrence is named by its coordinate, so repeated spellings stay apart', () => {
  assert.equal(M.occurrenceTag(watch), 'watch · L4 w2');
  assert.notEqual(M.occurrenceTag(woods), M.occurrenceTag(woods1));
});

test('every family has a glyph, and no two families share a glyph or a stroke', () => {
  const glyphs = new Set(),
    strokes = new Set();
  for (const f of Object.values(M.FAMILIES)) {
    assert.ok(f.glyph);
    glyphs.add(f.glyph);
    strokes.add(f.dash + (f.double ? '|double' : ''));
  }
  assert.equal(glyphs.size, Object.keys(M.FAMILIES).length);
  assert.equal(strokes.size, Object.keys(M.FAMILIES).length);
});

test('the six states differ without colour: glyph, dash or fill', () => {
  const seen = new Set();
  for (const state of M.STATE_ORDER) {
    const g = M.stateCell({ state, family: 'alliteration' });
    const glyph = g.querySelector('text')?.textContent || '';
    const dash = g.querySelector('rect').getAttribute('stroke-dasharray') || '';
    const key = `${glyph}|${dash}|${state === 'outside' ? 'flat' : 'cell'}`;
    assert.ok(!seen.has(key), `${state} looks like another state`);
    seen.add(key);
  }
  assert.equal(M.STATE_ORDER.length, 6);
});

test('outside locus is a flat cell with no glyph; holds carries its family glyph', () => {
  assert.equal(M.stateCell({ state: 'outside' }).querySelector('text'), null);
  const h = M.stateCell({ state: 'holds', family: 'rhyme' });
  assert.equal(h.querySelector('text').textContent, 'R');
  assert.equal(h.getAttribute('data-family'), 'rhyme');
  assert.throws(() => M.stateCell({ state: 'holds' }), /Unknown relation family/);
});

test('selection is the same ink ring in cells and nodes, never a family class', () => {
  const cell = M.stateCell({ state: 'holds', family: 'alliteration', selected: true });
  const n = M.node(watch, { cx: 100, cy: 100, selected: true });
  for (const el of [cell, n]) {
    const ring = el.querySelector('.lib-mk-select');
    assert.ok(ring, 'selection ring present');
    assert.ok(![...ring.classList].some((c) => c.startsWith('lib-mk-fam-')));
  }
});

test('network nodes share one radius and carry no hue; selection adds a ring outside', () => {
  const a = M.node(watch, { cx: 0, cy: 0, selected: true });
  const b = M.node(woods1, { cx: 0, cy: 0 });
  const r = (el) => Number(el.querySelector('circle').getAttribute('r'));
  assert.equal(r(a), r(b));
  assert.equal(Number(a.querySelector('.lib-mk-select').getAttribute('r')), r(a) + 4);
  assert.ok(![...a.classList, ...b.classList].some((c) => c.startsWith('lib-mk-fam-')));
});

test('layer is named in words, registered first', () => {
  assert.equal(
    M.methodLabel({ name: 'alliteration', layer: 'registered' }),
    'Registered figure · Alliteration'
  );
  assert.equal(
    M.methodLabel({ name: 'vowel', layer: 'sound' }),
    'Shared sound (not a registered figure) · Vowel'
  );
});

test('shared-sound arcs are 1 px, registered 2 px, same family pattern', () => {
  const geo = M.arcGeometry({ x: 0, y: 0, line: 4 }, { x: 40, y: 0, line: 4 });
  const reg = M.arc(geo, { family: 'alliteration', layer: 'registered' }).querySelector('path');
  const snd = M.arc(geo, { family: 'alliteration', layer: 'sound' }).querySelector('path');
  assert.equal(reg.getAttribute('stroke-width'), '2');
  assert.equal(snd.getAttribute('stroke-width'), '1');
  assert.equal(reg.getAttribute('stroke-dasharray'), snd.getAttribute('stroke-dasharray'));
});

test('arc routes: same line above, end↔end to the margin, interior through the gutter', () => {
  const geo = (a, b) => M.arcGeometry(a, b, { margin: 900, gutter: 40 });
  assert.equal(geo({ x: 10, y: 50, line: 4 }, { x: 90, y: 50, line: 4 }).route, 'same-line');
  const m = geo({ x: 500, y: 50, line: 1, final: true }, { x: 480, y: 350, line: 4, final: true });
  assert.equal(m.route, 'margin');
  assert.equal(m.stems.length, 2);
  assert.equal(
    geo({ x: 300, y: 50, line: 1 }, { x: 480, y: 350, line: 4, final: true }).route,
    'interline'
  );
  assert.throws(
    () => M.arcGeometry({ x: 0, y: 0, line: 1, final: true }, { x: 0, y: 9, line: 2, final: true }),
    /margin/
  );
});

test('ports never collapse: close ports spread to the minimum gap, in order', () => {
  const xs = M.fanPorts([100, 102, 101, 300], 6);
  assert.deepEqual([...xs], [100, 112, 106, 300]);
});

test('count strip prints only supplied counts and says which were not supplied', () => {
  const s = M.countStrip({ holds: 4 }, { provenance: 'fixture only' });
  assert.match(s.textContent, /4 holds shown · fixture only/);
  assert.match(
    s.textContent,
    /Undecided \/ Not yet computed \/ Refused \/ Does not hold: not supplied/
  );
  assert.doesNotMatch(s.textContent, /\b0 /);
  const t = M.countStrip(
    { holds: 25, fails: 3 },
    { provenance: 'run', emptyOnset: 14, hidden: { count: 2, by: 'display filter' } }
  );
  assert.match(t.textContent, /14 only empty onsets compared/);
  assert.match(t.textContent, /2 hidden by display filter/);
  assert.match(t.textContent, /3 does not hold/);
  assert.throws(() => M.countStrip({ holds: 1 }), /provenance/);
});

test('hull label states counts and always says joint consistency is not assessed', () => {
  const h = M.hullLabel({ family: 'rhyme', occurrences: 3, shown: 3, examined: 3, fixture: true });
  assert.match(h.textContent, /3 occurrences · 3 of 3 eligible pairs illustrated/);
  assert.match(h.textContent, /Joint reading consistency not assessed/);
  assert.doesNotMatch(h.textContent, /pending|hidden/);
  const p = M.hullLabel({ family: 'rhyme', occurrences: 4, shown: 4, examined: 6, pending: 1 });
  assert.match(p.textContent, /4 of 6 eligible pairs hold · 1 pending/);
  assert.throws(() => M.hullLabel({ family: 'rhyme', occurrences: 3, shown: 3 }), /examined/);
});

test('verdict wording reads from the evidence record', () => {
  assert.equal(
    M.stateLabel({ state: 'holds', informative_channels: [] }),
    'Holds · only empty onsets compared'
  );
  assert.equal(M.stateLabel({ state: 'holds', informative_channels: ['onset'] }), 'Holds');
  assert.equal(
    M.stateLabel({ state: 'undecided', unknown_channels: [[0, 'nucleus']] }),
    'Undecided · nucleus not settled'
  );
  assert.equal(M.stateLabel({ state: 'undecided' }), 'Undecided · reason not reported');
  assert.doesNotMatch(M.stateLabel({ state: 'undecided' }), /search cap/);
});

test('legend shows all six states and both layers in words', () => {
  const l = M.legendRow();
  for (const id of M.STATE_ORDER) assert.match(l.textContent, new RegExp(M.STATES[id].label));
  assert.match(l.textContent, /Registered figure/);
  assert.match(l.textContent, /Shared sound/);
  assert.match(l.textContent, /Selection uses ink, never hue/);
});

test('styles load once with the chunk, scoped to the Library surface', () => {
  const { document } = load();
  const style = document.getElementById('lib-mk-style');
  assert.ok(style);
  for (const rule of style.textContent.split('\n').filter((l) => l.includes('.lib-mk-')))
    assert.ok(rule.startsWith('#surface-library '), rule);
  assert.match(style.textContent, /:root\[data-theme='dark'\]/);
});
