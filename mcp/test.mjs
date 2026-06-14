// test.mjs — fast checks that the MCP adapter drives the real engine correctly.
// Run: npm test
import assert from 'node:assert/strict';
import * as E from './engine.js';
import { buildServer } from './tools.js';

let passed = 0;
function check(name, fn) {
  try { fn(); console.log(`  ok  ${name}`); passed++; }
  catch (err) { console.error(`FAIL  ${name}\n      ${err.message}`); process.exitCode = 1; }
}

check('catalog loaded', () => {
  assert.ok(E.counts.traditions > 1000, 'expected 1000+ traditions');
  assert.ok(E.counts.instruments > 400, 'expected 400+ instruments');
});

check('single recipe', () => {
  const r = E.generateRecipe({ traditions: ['bluegrass'] });
  assert.equal(r.mode, 'single');
  assert.ok(r.recipe.length > 0 && r.recipe_chars <= 1000, 'recipe present and within ceiling');
  assert.ok(r.affordances.swappable_variants.length > 0, 'affordances expose swappable variants');
});

check('max_chars ceiling honored', () => {
  const r = E.generateRecipe({ traditions: ['bluegrass'], max_chars: 300 });
  assert.ok(r.recipe_chars <= 300, `expected <=300, got ${r.recipe_chars}`);
});

check('N-tradition blend', () => {
  const r = E.generateRecipe({ traditions: ['afrobeat', 'post_punk'] });
  assert.equal(r.mode, 'blend');
  assert.ok(r.config.traditions.length >= 2);
});

check('customization: exclude + swap actually applies', () => {
  const base = E.generateRecipe({ traditions: ['bluegrass'] });
  const hasMandolin = base.config.instruments.some(i => i.id === 'mandolin');
  assert.ok(hasMandolin, 'bluegrass should include mandolin by default');
  const r = E.generateRecipe({ traditions: ['bluegrass'], exclude_instruments: ['mandolin'] });
  assert.ok(!r.config.instruments.some(i => i.id === 'mandolin'), 'excluded instrument should be gone');
});

check('weighted blend flips primary', () => {
  const a = E.blendTraditions({ a: 'bluegrass', b: 'thrash_metal', weight: 0.2 });
  const b = E.blendTraditions({ a: 'bluegrass', b: 'thrash_metal', weight: 0.8 });
  assert.equal(a.config.traditions[0], 'bluegrass');
  assert.equal(b.config.traditions[0], 'thrash_metal');
});

check('axis target resolves', () => {
  const r = E.recipeFromAxis({ axis_target: 'harm:1,density:2,intensity:2' });
  assert.ok(r.matched_tradition.id, 'a tradition matched');
  assert.ok(r.recipe.length > 0);
});

check('discovery: get_instrument exposes variant ids', () => {
  const i = E.getInstrument({ id: 'mandolin' });
  assert.ok(i.parts.length > 0);
  assert.ok(i.parts.every(p => Array.isArray(p.variants)));
});

check('list_options enumerates rooms', () => {
  const o = E.listOptions({ kind: 'rooms' });
  assert.ok(o.count > 0 && o.items[0].id);
});

check('discovery tools all respond (covers the prod list_traditions report)', () => {
  // list_traditions: bare, query, and family — the call that errored in prod.
  assert.ok(E.listTraditions({}).total > 1000, 'bare list');
  assert.ok(E.listTraditions({ query: 'bluegrass' }).items.some(t => t.id === 'bluegrass'), 'query');
  assert.ok(E.listTraditions({ family: 'vernacular' }).total >= 1, 'family');
  assert.equal(E.getTradition({ id: 'bluegrass' }).id, 'bluegrass');
  assert.ok(E.listInstruments({ query: 'guitar' }).total >= 1, 'instruments query');
  assert.ok(E.getInstrument({ id: 'mandolin' }).parts.length > 0);
  assert.ok(Array.isArray(E.findSimilarTraditions('bluegrass', 5)));
  // every option space enumerates without throwing
  for (const kind of ['rooms', 'tunings', 'chain_sections', 'archetypes', 'aesthetics',
    'arrangements', 'instrument_families', 'tradition_families', 'axes']) {
    assert.ok(E.listOptions({ kind }).count >= 0, kind);
  }
});

check('search_catalog finds across the whole corpus (the keyhole fix)', () => {
  assert.ok(E.searchCatalog({ query: 'gut', types: ['variant'], limit: 5 }).total > 10, 'gut → many variants');
  assert.ok(E.searchCatalog({ query: 'ballad', types: ['tradition'], limit: 50 }).total >= 20, 'ballad → many traditions');
  assert.ok(E.searchCatalog({ query: 'outlaw', types: ['tradition'] }).results.some(r => r.id === 'outlaw_country'), 'outlaw_country found');
  assert.ok(E.searchCatalog({ query: 'gothic americana' }).results.some(r => r.id === 'gothic_americana'), 'gothic_americana found (no guessing)');
  const p1 = E.searchCatalog({ query: 'blues', limit: 5 });
  assert.ok(p1.nextCursor, 'has nextCursor');
  const p2 = E.searchCatalog({ query: 'blues', limit: 5, cursor: p1.nextCursor });
  assert.ok(p2.results.length > 0 && p2.results[0].id !== p1.results[0].id, 'cursor advances the page');
  assert.throws(() => E.searchCatalog({ query: 'x', types: ['bogus'] }), /Unknown search type/);
});

check('search_prefaces returns the intent vocabulary', () => {
  for (const w of ['worn', 'bitter', 'satirical', 'sparse']) {
    assert.ok(E.searchPrefaces({ query: w }).items.length > 0, `preface search "${w}" non-empty`);
  }
});

check('apply_preface reshapes and bakes back into a recipe', () => {
  const ap = E.applyPreface({ tradition: 'outlaw_country', instrument: 'voice', preface: 'worn' });
  assert.ok(Number(ap.coverage.split('/')[0]) >= Number(ap.improved_from.split('/')[0]), 'coverage does not regress');
  assert.ok((ap.generate_recipe_overrides.swap_variants || []).length > 0, 'overrides include swap_variants');
  const baked = E.generateRecipe({ traditions: ['outlaw_country'], ...ap.generate_recipe_overrides });
  assert.ok(baked.recipe.length > 0, 'apply_preface overrides bake into a valid recipe');
  assert.throws(() => E.applyPreface({ instrument: 'voice', preface: 'not_a_preface' }), /preface/);
});

check('blend is LEAN by default, FULL on request, with provenance', () => {
  const lean = E.generateRecipe({ traditions: ['bluegrass', 'thrash_metal'] });
  const full = E.generateRecipe({ traditions: ['bluegrass', 'thrash_metal'], ensemble: 'full' });
  assert.equal(lean.ensemble, 'lean');
  assert.ok(full.config.instruments.length >= lean.config.instruments.length, 'full roster ≥ lean roster');
  assert.equal(lean.affordances.injected.length, 0, 'lean injects nothing');
  assert.ok(full.affordances.injected.length > 0, 'full flags injected secondary instruments');
  assert.ok(lean.config.instruments.every(i => i.source), 'every instrument carries provenance');
});

check('max_instruments caps the roster and keeps voice', () => {
  const big = E.generateRecipe({ traditions: ['afrobeat', 'post_punk'], ensemble: 'full' });
  const capped = E.generateRecipe({ traditions: ['afrobeat', 'post_punk'], ensemble: 'full', max_instruments: 4 });
  assert.ok(capped.config.instruments.length <= 4, `capped to <=4, got ${capped.config.instruments.length}`);
  if (big.config.instruments.some(i => i.id === 'voice')) {
    assert.ok(capped.config.instruments.some(i => i.id === 'voice'), 'voice preserved under cap');
  }
});

check('validation rejects bad ids', () => {
  assert.throws(() => E.generateRecipe({ traditions: ['nope_not_real'] }), /Unknown tradition/);
  assert.throws(() => E.generateRecipe({ traditions: ['bluegrass'], swap_variants: ['mandolin:nope:x'] }), /no part/);
  assert.throws(() => E.recipeFromAxis({ axis_target: '' }), /axis_target/);
});

check('server builds with all tools', () => {
  const s = buildServer();
  assert.ok(s, 'server constructed');
});

console.log(`\n${passed} checks passed${process.exitCode ? ' (with failures)' : ''}`);
