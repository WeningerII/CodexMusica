#!/usr/bin/env node
'use strict';
// Check authored pins across the three production paths, rather than blessing
// recipe snapshots that merely repeat the current renderer's output.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const C = require('./_loader.js');
const docs = path.join(__dirname, '..', 'docs');
const manifestFiles = [
  'everynoise-pilot.json',
  ...fs
    .readdirSync(docs)
    .filter((name) => /^everynoise-batch-\d+\.json$/.test(name))
    .sort(),
];
const manifests = manifestFiles.map((name) =>
  JSON.parse(fs.readFileSync(path.join(docs, name), 'utf8'))
);
const signatures = require('../references/_tradition_signatures.json');
const vocabulary = require('../references/_soundword_vocab.json').tokens;
const geo = require('../data/geo.json');
const { validateEntry } = require('./_atlas_regions.js');
const { seedFromTradition, search } = require('./search.js');
const { seedTraditionCards, renderWorkspace } = require('./_seed_workspace.js');
const { loadApp } = require('./_load_app.js');
const app = loadApp();
const traditions = new Map(C.TRADITIONS.map((t) => [t.id, t]));
const instruments = new Map(C.INSTRUMENTS.map((i) => [i.id, i]));
for (const manifest of manifests) {
  assert.equal(manifest.batch_size, 25);
  assert.equal(manifest.parallel_lanes, 5);
  assert.equal(manifest.genres_per_lane, 5);
  assert.equal(manifest.entries.length, 25);
  const lanes = new Set(manifest.entries.map((entry) => entry.lane));
  assert.equal(lanes.size, 5);
  for (const lane of lanes)
    assert.equal(manifest.entries.filter((entry) => entry.lane === lane).length, 5);
}
const rows = manifests.flatMap((manifest) => manifest.entries);
assert.equal(new Set(rows.map((entry) => entry.id)).size, rows.length);
assert.equal(new Set(rows.map((entry) => entry.source_label)).size, rows.length);
const ledgers = new Map();
let renders = 0;
const merged = [];
const recipes = new Set();
for (const entry of rows) {
  const { id } = entry;
  assert.equal(entry.baseline_status, 'missing');
  assert(entry.source_url.startsWith('https://everynoise.com/'));
  if (!ledgers.has(entry.ledger))
    ledgers.set(
      entry.ledger,
      JSON.parse(fs.readFileSync(path.join(__dirname, '..', entry.ledger), 'utf8'))
    );
  const ledger = ledgers.get(entry.ledger);
  const evidence = ledger.entries.find((row) => row.id === id);
  assert(evidence, `${id}: source ledger entry missing`);
  assert.equal(evidence.source_label, entry.source_label);
  if (evidence.comparison_status !== undefined) assert.equal(evidence.comparison_status, 'missing');
  // Merged into a duplicate since it was added (references/_tradition_aliases.json):
  // its evidence stays on file, and its id must keep resolving to the survivor.
  const alias = C.TRADITION_ALIASES[id];
  if (alias) {
    assert(traditions.has(alias.of), `${id}: merged into ${alias.of}, which is not in the catalog`);
    assert.deepEqual(
      seedTraditionCards(id).map((c) => c.traditionId),
      traditions.get(alias.of).instruments.map(() => alias.of),
      `${id}: does not seed its surviving tradition ${alias.of}`
    );
    merged.push(id);
    continue;
  }
  if (entry.ledger.startsWith('docs/everynoise-batch-')) {
    assert.equal(evidence.comparison_status, 'missing');
    assert(evidence.sources.length > 0, `${id}: no supporting sources`);
    for (const source of evidence.sources) {
      assert.equal(new URL(source.url).protocol, 'https:');
      assert(source.title && source.support_notes, `${id}: incomplete source evidence`);
    }
    assert(evidence.signature_tokens.length > 0, `${id}: no reviewed signature`);
    assert.deepEqual(signatures[id], evidence.signature_tokens, `${id}: signature ledger drift`);
    for (const token of evidence.signature_tokens)
      assert(
        ['sonic', 'style'].includes(vocabulary[token]?.class),
        `${id}: unclassified or unreviewed cultural signature ${token}`
      );
  }
  const tradition = traditions.get(id);
  assert(tradition && tradition.pin_parts, `${id}: missing pinned definition`);
  assert(Object.keys(tradition.parts || {}).length, `${id}: missing authored part settings`);
  assert(C.TRADITION_EXTRAS[id].exemplars.length, `${id}: missing exemplars`);
  assert.equal(validateEntry(id, geo[id]).length, 0, `${id}: invalid atlas anchor`);
  for (const [part, variant] of Object.entries(tradition.parts)) {
    assert(
      tradition.instruments.some((inst) =>
        instruments
          .get(inst)
          .parts.some((p) => p.id === part && p.variants.some((v) => v.id === variant))
      ),
      `${id}: unresolvable authored part ${part}:${variant}`
    );
  }
  const cards = seedTraditionCards(id);
  const optimized = search(seedFromTradition(id), { maxIters: 100 }).config;
  assert.deepEqual(
    cards.map((c) => c.instrumentId),
    tradition.instruments
  );
  assert.deepEqual(
    optimized.instruments.map((i) => i.id),
    tradition.instruments
  );
  for (const card of cards) {
    const inst = instruments.get(card.instrumentId);
    const optimizedCard = optimized.instruments.find((i) => i.id === card.instrumentId);
    for (const [part, variant] of Object.entries(tradition.parts)) {
      // Flat tradition overrides apply only to instruments that expose the
      // variant, as well as the part (synth and sampler parts share an id).
      if (!inst.parts.some((p) => p.id === part && p.variants.some((v) => v.id === variant)))
        continue;
      assert.equal(card.parts[part], variant, `${id}: seed lost ${part}`);
      assert.equal(optimizedCard.slots[part], variant, `${id}: search lost ${part}`);
    }
  }
  app.app.cards = [];
  app.app.collapsedTraditionGroups = new Set();
  app.importTradition(id);
  for (const format of ['rich', 'prose', 'tags', 'compact']) {
    const recipe = renderWorkspace(cards, { format });
    assert.equal(
      recipe,
      app.compileRecipeStack(app.app.cards, format, {}),
      `${id}/${format}: drift`
    );
    assert(recipe.length > 0 && recipe.length <= 1000, `${id}/${format}: recipe ceiling`);
    // These automatic matches appeared during authoring but their named
    // cultural practices are unsupported by the batch entries' sources.
    assert(
      !/samul-percussive|kora-cascading|\berhuang\b/i.test(recipe),
      `${id}/${format}: unrelated cultural preface`
    );
    if (id === 'armenian_pop')
      assert(!/\bshringara\b/i.test(recipe), `${id}/${format}: unsupported rasa attribution`);
    if (id === 'ambient_pop')
      assert(
        !/spoken-flowing|street-pulsing/i.test(recipe),
        `${id}/${format}: subdued sung band model lost`
      );
    if (format === 'rich') {
      // Compare the body as well as the distinct genre heading.
      const body = recipe.slice(recipe.indexOf(',') + 1);
      assert(!recipes.has(body), `${id}: duplicate rendered recipe body`);
      recipes.add(body);
    }
    renders++;
  }
}
console.log(
  `EVERYNOISE BATCHES: PASS — ${manifests.length} batches, ${rows.length} genres (${merged.length} since merged: ${merged.join(', ') || 'none'}), ${renders} browser/connector renders; CLI pins retained.`
);
