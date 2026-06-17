// test.mjs — checks the MCP engine drives the deterministic workspace correctly.
// Engine tests need no SDK; the server-build check is skipped if the SDK isn't
// installed (npm ci in mcp/). Run: npm test
import assert from 'node:assert/strict';
import * as E from './engine.js';

let passed = 0;
function check(name, fn) {
  try { fn(); console.log(`  ok  ${name}`); passed++; }
  catch (err) { console.error(`FAIL  ${name}\n      ${err.message}`); process.exitCode = 1; }
}
// Simulate the model threading state: round-trip the workspace through JSON.
const thread = (ws) => JSON.parse(JSON.stringify(ws));

check('catalog loaded', () => {
  assert.ok(E.counts.traditions > 1000 && E.counts.instruments > 400 && E.counts.prefaces > 500);
});

check('start_recipe = the Current Recipe (deterministic, primary-only header)', () => {
  const r = E.startRecipe({ traditions: ['garage_rock'] });
  assert.equal(r.mode, 'single');
  assert.ok(r.recipe.startsWith('Garage rock, '), `header: ${r.recipe.slice(0, 30)}`);
  assert.ok(!/Garage rock \+/.test(r.recipe), 'no auto-staple in header');
  assert.ok(r.recipe.length <= 1000 && r.recipe.length > 900);
  assert.equal(r.cards.length, 5);
  assert.ok(r.workspace && Array.isArray(r.workspace.cards));
});

check('max_chars ceiling honored', () => {
  const r = E.startRecipe({ traditions: ['garage_rock'], max_chars: 300 });
  assert.ok(r.recipe_chars <= 300, `got ${r.recipe_chars}`);
});

check('edit_recipe set_preface re-derives + labels verbatim (state threaded)', () => {
  const s = E.startRecipe({ traditions: ['garage_rock'] });
  const r = E.editRecipe({ workspace: thread(s.workspace), edits: [{ action: 'set_preface', card: 'voice', preface: 'satirical' }] });
  assert.ok(/(^|,\s*)satirical voice:/.test(r.recipe), 'preface labeled verbatim');
  const voice = r.workspace.cards.find((c) => c.instrumentId === 'voice');
  assert.ok(voice.prefaceLock === true && voice.preface === 'satirical', 'preface locked on the card');
  assert.notDeepEqual(voice.parts, s.workspace.cards[0].parts, 'voice settings re-derived');
});

check('edit_recipe add_tradition reflects in the header (explicit staple)', () => {
  const s = E.startRecipe({ traditions: ['garage_rock'] });
  const r = E.editRecipe({ workspace: thread(s.workspace), edits: [{ action: 'add_tradition', tradition: 'punk' }] });
  assert.ok(r.recipe.startsWith('Garage rock + Punk, '), `header: ${r.recipe.slice(0, 40)}`);
  assert.ok(r.cards.length > s.cards.length);
});

check('edit_recipe set_variant applies + chains multiple edits', () => {
  const s = E.startRecipe({ traditions: ['garage_rock'] });
  const r = E.editRecipe({
    workspace: thread(s.workspace),
    edits: [
      { action: 'set_variant', card: 'electric_guitar_single_coil', part: 'body_wood', variant: 'mahogany' },
      { action: 'remove_instrument', card: 'tonewheel_organ' },
    ],
  });
  assert.ok(/mahogany/.test(r.recipe));
  assert.equal(r.cards.length, 4);
  assert.ok(!r.cards.some((c) => c.instrument === 'tonewheel_organ'));
});

check('render_recipe re-renders threaded state', () => {
  const s = E.startRecipe({ traditions: ['bluegrass'] });
  const r = E.renderRecipe({ workspace: thread(s.workspace), max_chars: 250 });
  assert.ok(r.recipe_chars <= 250 && r.recipe.length > 0);
});

check('search_catalog resolves words → ids', () => {
  const r = E.searchCatalog({ query: 'garage rock', types: ['tradition'] });
  assert.ok(r.items.some((x) => x.id === 'garage_rock'));
});

check('search_prefaces returns preface ids', () => {
  const r = E.searchPrefaces({ query: 'satirical' });
  assert.ok(r.items.some((x) => x.id === 'satirical'));
});

check('get_instrument exposes variant ids for set_variant', () => {
  const i = E.getInstrument({ id: 'electric_guitar_single_coil' });
  const bw = i.parts.find((p) => p.id === 'body_wood');
  assert.ok(bw && bw.variants.some((v) => v.id === 'mahogany'));
});

check('list_options enumerates rooms', () => {
  const o = E.listOptions({ kind: 'rooms' });
  assert.ok(o.count > 0 && o.items[0].id);
});

check('validation: actionable errors', () => {
  assert.throws(() => E.startRecipe({ traditions: ['nope_not_real'] }), /Unknown tradition/);
  assert.throws(() => E.editRecipe({ edits: [{ action: 'set_preface', card: 'voice', preface: 'x' }] }), /needs a "workspace"/);
  const s = E.startRecipe({ traditions: ['garage_rock'] });
  assert.throws(() => E.editRecipe({ workspace: thread(s.workspace), edits: [{ action: 'bogus' }] }), /Unknown edit action/);
  assert.throws(() => E.editRecipe({ workspace: thread(s.workspace), edits: [{ action: 'set_variant', card: 'voice', part: 'nope', variant: 'x' }] }), /no part/);
});

// SDK-dependent: only runs if @modelcontextprotocol/sdk is installed.
try {
  const { buildServer } = await import('./tools.js');
  assert.ok(buildServer(), 'server constructed');
  console.log('  ok  server builds with all tools'); passed++;
} catch (err) {
  if (/Cannot find package|Cannot find module/.test(err.message)) {
    console.log('  --  server build skipped (SDK not installed in-container)');
  } else {
    console.error(`FAIL  server builds with all tools\n      ${err.message}`); process.exitCode = 1;
  }
}

console.log(`\n${passed} checks passed${process.exitCode ? ' (with failures)' : ''}`);
