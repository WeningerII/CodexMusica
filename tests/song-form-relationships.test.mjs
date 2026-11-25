import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { relationshipsFor } from '../src/pages/song-form-relations.mjs';

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

test('all explorer neighbors preserve direction and evidence', () => {
  for (const { id } of catalog) {
    const { related, evidence } = relationshipsFor(edges, names, id);
    const touching = edges.filter((e) => e.source === id || e.target === id);
    assert.deepEqual(
      new Set([...related.values()].flatMap((ids) => [...ids])),
      new Set(touching.map((e) => (e.source === id ? e.target : e.source)))
    );
    for (const edge of touching) {
      const outward = edge.source === id;
      const neighbor = outward ? edge.target : edge.source;
      const kind = {
        variant: outward ? 'Variant of' : 'Has variant',
        contains: outward ? 'Can contain' : 'Can occur within',
        comparison: 'Compare with',
        'shares-feature': 'Shares a feature with',
        other: outward ? 'Documented link to' : 'Documented link from',
      }[edge.kind];
      assert.ok(related.get(kind)?.has(neighbor));
      assert.ok(
        evidence
          .get(kind + '|' + neighbor)
          ?.has(
            {
              catalog: 'Catalog evidence only',
              reference: 'Reference recorded, passage unverified',
              passage: 'Source passage checked',
            }[edge.confidence]
          )
      );
    }
  }
});
