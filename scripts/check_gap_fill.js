#!/usr/bin/env node
'use strict';
// Acceptance checks for the traditions added from the geographic attribution
// audit's verified gap list (docs/geographic-gap-fill.json). Like the round-2
// check, this protects what is most likely to be lost on import, optimization
// or atlas publication, independently of the recipe snapshots: every ledger
// row is a real, pinned catalog entry; its map anchor is the one the ledger
// records; its authored part settings resolve and survive seeding and search;
// and the browser and connector render it identically within the ceiling.
const assert = require('node:assert/strict');
const C = require('./_loader.js');
const manifest = require('../docs/geographic-gap-fill.json');
const geo = require('../data/geo.json');
const signatures = require('../references/_tradition_signatures.json');
const vocabulary = require('../references/_soundword_vocab.json').tokens;
const { validateEntry } = require('./_atlas_regions.js');
const { seedFromTradition, search } = require('./search.js');
const { seedTraditionCards, renderWorkspace } = require('./_seed_workspace.js');
const { loadApp } = require('./_load_app.js');

const app = loadApp();
const traditions = new Map(C.TRADITIONS.map((t) => [t.id, t]));
const instruments = new Map(C.INSTRUMENTS.map((i) => [i.id, i]));
const rows = manifest.entries;
assert(rows.length > 0, 'empty ledger');
assert.equal(new Set(rows.map((e) => e.id)).size, rows.length, 'duplicate ledger id');

let renders = 0;
for (const row of rows) {
  const { id, anchor } = row;
  const tradition = traditions.get(id);
  assert(tradition, `${id}: not in the catalog`);
  assert(row.gap && row.gap.region && row.gap.name, `${id}: no link to the audit's gap list`);
  assert(tradition.pin_parts, `${id}: authored settings must be pinned`);
  assert.deepEqual(geo[id], [anchor.latitude, anchor.longitude, anchor.label, anchor.region]);
  assert.equal(validateEntry(id, geo[id]).length, 0, `${id}: invalid atlas anchor`);
  assert(C.TRADITION_EXTRAS[id].exemplars.length, `${id}: missing exemplars`);
  // Signatures here carry sound-words only: a cultural token would need a
  // per-pair ruling (check_signature_tokens.js), which this ledger does not make.
  for (const token of signatures[id] || [])
    assert(
      ['sonic', 'style'].includes(vocabulary[token]?.class),
      `${id}: signature token ${token} is not a classed sound-word`
    );
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
      // A flat override applies only to instruments that expose the variant.
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
    renders++;
  }
}
console.log(
  `GEOGRAPHIC GAP FILL: PASS — ${rows.length} traditions, ${renders} browser/connector renders.`
);
