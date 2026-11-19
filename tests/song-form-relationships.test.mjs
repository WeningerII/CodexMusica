import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { mountSongForms } from '../src/pages/song-forms-view.mjs';

const read = (relative) => readFileSync(new URL(relative, import.meta.url), 'utf8');
const catalog = JSON.parse(read('../data/song-forms.json'));
const file = 'song-form-relationships.json';
const edges = JSON.parse(read('../data/' + file));
const names = new Map(catalog.map(({ id, name }) => [id, name]));

test('public relationships contain only known endpoints, reviewed kinds and evidence levels', () => {
  assert.equal(read('../api/' + file), read('../data/' + file));
  const seen = new Set();
  for (const edge of edges) {
    assert.deepEqual(Object.keys(edge).sort(), ['confidence', 'kind', 'source', 'target']);
    assert.ok(names.has(edge.source) && names.has(edge.target));
    assert.notEqual(edge.source, edge.target);
    assert.ok(['variant', 'contains', 'shares-feature', 'comparison', 'other'].includes(edge.kind));
    assert.ok(['catalog', 'reference', 'passage'].includes(edge.confidence));
    const pair = [edge.source, edge.target];
    if (['comparison', 'shares-feature'].includes(edge.kind)) pair.sort();
    const key = JSON.stringify([edge.kind, ...pair]);
    assert.ok(!seen.has(key), 'Duplicate relationship: ' + key);
    seen.add(key);
  }
});

test('native explorer preserves forms on a graph failure and navigates audited directions in place', async (t) => {
  const dom = new JSDOM('<main></main>', { pretendToBeVisual: true });
  const { window } = dom;
  const root = window.document.querySelector('main');
  for (const key of ['document', 'Option']) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, value: window[key] });
    t.after(() =>
      previous ? Object.defineProperty(globalThis, key, previous) : delete globalThis[key]
    );
  }
  t.after(() => window.close());
  let graphRequests = 0;
  t.mock.method(globalThis, 'fetch', async (url) => {
    if (url.pathname.endsWith('/api/song-forms.json')) return Response.json(catalog);
    assert.ok(url.pathname.endsWith('/api/' + file));
    graphRequests++;
    return graphRequests === 1 ? new Response(null, { status: 503 }) : Response.json(edges);
  });
  await mountSongForms(root);
  assert.equal(graphRequests, 0);
  const picker = root.querySelector('select');
  function select(id) {
    picker.value = id;
    picker.dispatchEvent(new window.Event('change', { bubbles: true }));
  }
  const panel = root.querySelector('details');
  const summary = panel.querySelector('summary');
  select('strophic-with-refrain');
  await new Promise(setImmediate);
  assert.equal(summary.textContent, 'Related forms unavailable');
  assert.ok(root.querySelector('h3'), 'The symbolic model still displays');
  panel.open = true;
  panel.querySelector('button').click();
  await new Promise(setImmediate);

  function row(neighbor) {
    const button = [...panel.querySelectorAll('button')].find(
      (node) => node.textContent === names.get(neighbor)
    );
    assert.ok(button, 'Missing ' + neighbor + ' on ' + picker.value);
    return button.parentElement;
  }
  assert.match(row('strophic').textContent, /Variant of · Reference recorded, passage unverified/);
  row('strophic').querySelector('button').click();
  assert.equal(picker.value, 'strophic');
  assert.equal(window.document.activeElement, summary);
  assert.match(row('strophic-with-refrain').textContent, /Has variant/);
  select('couplet');
  assert.match(
    row('strophic-with-refrain').textContent,
    /Can occur within · Catalog evidence only/
  );
  row('strophic-with-refrain').querySelector('button').click();
  assert.match(row('couplet').textContent, /Can contain/);

  const direct = edges.find((e) => e.confidence === 'passage');
  select(direct.source);
  assert.match(row(direct.target).textContent, /Source passage checked/);
  for (const kind of ['comparison', 'shares-feature']) {
    const { source, target } = edges.find((e) => e.kind === kind);
    select(source);
    const outward = row(target).querySelector('small').textContent;
    row(target).querySelector('button').click();
    assert.equal(row(source).querySelector('small').textContent, outward);
  }
  for (const { id } of catalog) {
    select(id);
    const expected = new Set(
      edges
        .filter((e) => e.source === id || e.target === id)
        .map((e) => (e.source === id ? e.target : e.source))
    );
    assert.equal(summary.textContent, 'Related forms · ' + expected.size);
    assert.deepEqual(
      new Set([...panel.querySelectorAll('button')].map((b) => b.textContent)),
      new Set([...expected].map((n) => names.get(n)))
    );
    if (!expected.size) assert.match(panel.textContent, /No reviewed connections/);
  }
  assert.equal(graphRequests, 2, 'The reader caches the successful graph');
});
