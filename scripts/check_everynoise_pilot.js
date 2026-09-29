#!/usr/bin/env node
'use strict';
// Check authored pins across the three production paths, rather than blessing
// recipe snapshots that merely repeat the current renderer's output.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const C = require('./_loader.js');
const manifest = require('../docs/everynoise-pilot.json');
const geo = require('../data/geo.json');
const { validateEntry } = require('./_atlas_regions.js');
const { seedFromTradition, search } = require('./search.js');
const { seedTraditionCards, renderWorkspace } = require('./_seed_workspace.js');
const { loadApp } = require('./_load_app.js');
const app = loadApp();
const traditions = new Map(C.TRADITIONS.map((t) => [t.id, t]));
const instruments = new Map(C.INSTRUMENTS.map((i) => [i.id, i]));
const rows = manifest.entries;
assert.equal(rows.length, 25);
assert.equal(new Set(rows.map((e) => e.id)).size, 25);
const lanes = new Set(rows.map((e) => e.lane));
assert.equal(lanes.size, 5);
for (const lane of lanes) assert.equal(rows.filter((e) => e.lane === lane).length, 5);
let renders = 0;
const recipes = new Set();
for (const entry of rows) {
  const { id } = entry;
  assert.equal(entry.baseline_status, 'missing');
  assert(entry.source_url.startsWith('https://everynoise.com/'));
  const ledger = JSON.parse(fs.readFileSync(path.join(__dirname, '..', entry.ledger), 'utf8'));
  assert(
    ledger.entries.some((e) => e.id === id),
    `${id}: source ledger entry missing`
  );
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
    // cultural practices are unsupported by every pilot entry's sources.
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
  `EVERYNOISE PILOT: PASS — 5 lanes, 25 genres, ${renders} browser/connector renders; CLI pins retained.`
);
