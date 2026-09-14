#!/usr/bin/env node
'use strict';
// Protect the source-backed distinctions most likely to disappear during import,
// optimization, or atlas publication. This is independent of recipe snapshots.
const assert = require('node:assert/strict');
const C = require('./_loader.js');
const manifest = require('../docs/geographic-expansion-round-2.json');
const geo = require('../data/geo.json');
const { seedFromTradition, search } = require('./search.js');
const { seedTraditionCards, renderWorkspace } = require('./_seed_workspace.js');
const { loadApp } = require('./_load_app.js');
const app = loadApp();
const traditions = new Map(C.TRADITIONS.map((t) => [t.id, t]));
const instruments = new Map(C.INSTRUMENTS.map((i) => [i.id, i]));
const rows = manifest.entries.filter((e) => e.kind === 'tradition');
assert.equal(rows.length, 24);
assert.equal(manifest.entries.filter((e) => e.kind === 'instrument').length, 10);
assert.equal(new Set(manifest.entries.map((e) => e.id)).size, manifest.entries.length);
const regions = new Set([
  'Africa',
  'Mongolia & Siberia',
  'Oceania & Pacific',
  'Europe',
  'North America',
  'Latin America & Caribbean',
  'Middle East',
]);
for (const entry of manifest.entries) {
  assert(entry.sources.length, `${entry.id}: missing sources`);
  for (const source of entry.sources) {
    assert(manifest.sources.some((s) => s.id === source && s.url.startsWith('https://')));
  }
  assert((entry.kind === 'tradition' ? traditions : instruments).has(entry.id));
}
let renders = 0;
for (const { id, anchor } of rows) {
  const tradition = traditions.get(id);
  assert(tradition.pin_parts, `${id}: reviewed settings must be pinned`);
  assert.deepEqual(geo[id], [anchor.latitude, anchor.longitude, anchor.label, anchor.region]);
  assert(regions.has(anchor.region), `${id}: unknown atlas region`);
  assert(C.TRADITION_EXTRAS[id].exemplars.length);
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
      if (!inst.parts.some((p) => p.id === part)) continue;
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
const roster = (id) => traditions.get(id).instruments;
const parts = (id) => traditions.get(id).parts;
assert.deepEqual(roster('moutya'), ['voice', 'moutya_drum_trio']);
assert.deepEqual(roster('tchiloli_music'), [
  'tchiloli_bamboo_flute',
  'acoustic_membrane_drum',
  'sucalo',
]);
assert(roster('bigwala_music').includes('bigwala_trumpets'));
assert.deepEqual(roster('madi_bowl_lyre_music'), ['voice', 'madi_odi']);
assert(roster('terchova_music').includes('terchova_two_string_bass'));
assert.equal(parts('chopi_timbila_music').timbila_register, 'timbila_orchestra_registers');
assert.equal(parts('chopi_timbila_music').timbila_resonator, 'timbila_mirliton');
for (const id of ['nenets_syudbabc', 'nenets_yarabc']) {
  assert.equal(parts(id).voice_ensemble_config, 'voice_ensemble_nenets_narrator_assistant');
}
for (const id of ['nenets_personal_song', 'nganasan_personal_song', 'palauan_chesols']) {
  assert.deepEqual(roster(id), ['voice']);
  assert.equal(parts(id).voice_ensemble_config, 'voice_ensemble_solo_unaccompanied');
}
assert.equal(parts('nganasan_keingeirsya').voice_ensemble_config, 'voice_ensemble_live_duet');
assert.equal(
  parts('horehronie_multipart_singing').voice_ensemble_config,
  'voice_ensemble_polyphonic_chorus'
);
// New options must not enter existing configurations by automatic variant selection.
for (const [inst, part, variant] of [
  ['voice', 'voice_tradition', 'voice_tradition_source_unspecified'],
  ['voice', 'voice_ensemble_config', 'voice_ensemble_nenets_narrator_assistant'],
  ['timbila', 'timbila_register', 'timbila_orchestra_registers'],
]) {
  assert.equal(
    instruments
      .get(inst)
      .parts.find((p) => p.id === part)
      .variants.find((v) => v.id === variant).auto,
    false
  );
}
console.log(
  `GEOGRAPHIC ROUND 2: PASS — 24 traditions, 10 instruments, ${renders} browser/connector renders.`
);
