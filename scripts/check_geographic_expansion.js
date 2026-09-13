#!/usr/bin/env node
'use strict';
// Source-backed acceptance checks for the geographic expansion. These test the
// audible distinctions at risk during import and optimization, not snapshots
// regenerated from whichever result the engine currently happens to produce.
const assert = require('node:assert/strict');
const C = require('./_loader.js');
const manifest = require('../docs/geographic-catalog-expansion.json');
const geo = require('../data/geo.json');
const { seedFromTradition, search } = require('./search.js');
const { seedTraditionCards, renderWorkspace } = require('./_seed_workspace.js');
const { loadApp } = require('./_load_app.js');
const { traditionSource } = require('./_api_contract.js');
const app = loadApp();
const rows = manifest.entries.filter((e) => e.kind !== 'instrument');
const byId = new Map(C.TRADITIONS.map((t) => [t.id, t]));
const instById = new Map(C.INSTRUMENTS.map((i) => [i.id, i]));
const candidates = manifest.entries.filter((e) => /^[TI]\d{3}$/.test(e.candidate));
assert.equal(candidates.length, 96);
assert.equal(new Set(candidates.map((e) => e.candidate)).size, 96);
assert.equal(rows.length, 63);
assert.equal(manifest.entries.filter((e) => e.kind === 'instrument').length, 51);
for (const entry of manifest.entries) {
  assert(entry.sources.length, `${entry.id}: no provenance`);
  for (const id of entry.sources) assert(manifest.sources.some((s) => s.id === id));
  assert(entry.kind === 'instrument' ? instById.has(entry.id) : byId.has(entry.id));
}
let renders = 0;
for (const { id } of rows) {
  const t = byId.get(id);
  assert(t.pin_parts, `${id}: reviewed choices must be pinned`);
  assert.equal(traditionSource(t).pin_parts, true);
  assert(geo[id], `${id}: missing atlas entry`);
  assert(C.TRADITION_EXTRAS[id].exemplars.length, `${id}: no listening/documentation reference`);
  const cards = seedTraditionCards(id);
  assert.deepEqual(
    cards.map((c) => c.instrumentId),
    t.instruments
  );
  const seed = seedFromTradition(id);
  const optimized = search(seed, { maxIters: 100 }).config;
  assert.deepEqual(
    optimized.instruments.map((i) => i.id),
    t.instruments
  );
  for (const card of cards) {
    const inst = instById.get(card.instrumentId);
    const cfg = optimized.instruments.find((i) => i.id === card.instrumentId);
    for (const [pid, vid] of Object.entries(t.parts)) {
      if (!inst.parts.find((p) => p.id === pid)?.variants.some((v) => v.id === vid)) continue;
      assert.equal(card.parts[pid], vid, `${id}: connector ignored ${pid}`);
      assert.equal(cfg.slots[pid], vid, `${id}: optimization erased ${pid}`);
      assert(optimized.pinned[card.instrumentId].includes(pid));
    }
  }
  app.app.cards = [];
  app.app.collapsedTraditionGroups = new Set();
  app.importTradition(id);
  const browserCards = app.app.cards;
  assert.deepEqual(
    JSON.parse(JSON.stringify(browserCards.map((c) => c.parts))),
    cards.map((c) => c.parts),
    `${id}: browser seed mismatch`
  );
  for (const format of ['rich', 'prose', 'tags', 'compact']) {
    const actual = renderWorkspace(cards, { format });
    const expected = app.compileRecipeStack(browserCards, format, {});
    assert.equal(actual, expected, `${id}/${format}: browser/connector drift`);
    assert(actual.length > 0 && actual.length <= 1000);
    renders++;
  }
}
const roster = (id) => byId.get(id).instruments;
assert.deepEqual(roster('mwinoghe'), ['ingina', 'twana_perekete']);
assert.deepEqual(roster('vanuatu_water_drumming'), ['water_percussion']);
assert.deepEqual(roster('bosavi_ilib_kuwo'), ['kundu']);
for (const id of ['djanba', 'junba_balga']) assert(!roster(id).includes('didgeridoo'));
for (const id of ['wangga', 'lirrga']) assert(roster(id).includes('didgeridoo'));
assert(!roster('khanty_mansi_bear_festival').includes('nyn_yukh'));
assert.equal(byId.get('katta_ashula').parts.voice_ensemble_config, 'voice_ensemble_live_duet');
assert.equal(
  byId.get('himmi').parts.voice_ensemble_config,
  'voice_ensemble_call_response_leader_group'
);
assert.equal(
  byId.get('dobana_terkiya').parts.voice_ensemble_config,
  'voice_ensemble_solo_unaccompanied'
);
assert.equal(
  byId.get('tongan_lakalaka').parts.voice_ensemble_config,
  'voice_ensemble_polyphonic_chorus'
);
assert.equal(
  byId.get('banda_dakpa_polyphony').parts.ongo_regional_form,
  'ongo_regional_form_dakpa'
);
assert.equal(byId.get('turkmen_bagshy').parts.dutar_tradition, 'dutar_tradition_turkmen_bagshy');
// User edits retain precedence over a researched default and survive search.
const swapped = seedFromTradition('katta_ashula', [], {
  swap: { voice: { voice_ensemble_config: 'voice_ensemble_solo_unaccompanied' } },
});
assert.equal(
  search(swapped, { maxIters: 100 }).config.instruments[0].slots.voice_ensemble_config,
  'voice_ensemble_solo_unaccompanied'
);
// An excluded instrument must not leave a phantom pin map behind.
const excluded = seedFromTradition('parixara', [], { exclude: ['ruwe'] });
assert(!excluded.instruments.some((i) => i.id === 'ruwe'));
assert(!excluded.pinned.ruwe);
console.log(
  `GEOGRAPHIC EXPANSION: PASS — 96 candidates, 51 instruments, 63 tradition configurations, ${renders} browser/connector renders.`
);
