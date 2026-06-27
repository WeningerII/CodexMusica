#!/usr/bin/env node
'use strict';
// check_connector_parity.js — gate: the deterministic seed reproduces the app's
// "Current Recipe". Asserts the invariants that distinguish the workspace model
// from the old search engine, then renders a sample for eyeballing.
//
//   node scripts/check_connector_parity.js            # gate (exit non-zero on fail)
//   node scripts/check_connector_parity.js <tradId>   # also print that recipe
//
// The full seed-parity assertion
// (seed+render === src/app.js importTradition+compileRecipeStack, catalog-wide)
// lands once the browser pipeline is reachable from Node; for now it locks the
// structural invariants the search path violated (auto-staple, wrong header).

const C = require('./_loader.js');
const { seedTraditionCards, renderWorkspace } = require('./_seed_workspace.js');

let failures = 0;
const fail = (msg) => {
  console.error('  ✗ ' + msg);
  failures++;
};
const ok = (msg) => console.log('  ✓ ' + msg);

function check(name, cond, detail) {
  if (cond) ok(name);
  else fail(`${name}${detail ? ' — ' + detail : ''}`);
}

// ── 1. garage_rock: the worked example from the plan ────────────────────────
console.log('garage_rock:');
const cards = seedTraditionCards('garage_rock');
check('seeds 5 cards', cards && cards.length === 5, cards ? `got ${cards.length}` : 'null');
check(
  'roster = tradition.instruments order',
  cards &&
    cards.map((c) => c.instrumentId).join(',') ===
      'voice,electric_guitar_single_coil,electric_bass,drum_kit,tonewheel_organ',
  cards && cards.map((c) => c.instrumentId).join(',')
);
check(
  'every card traditionId = garage_rock (no auto-staple)',
  cards && cards.every((c) => c.traditionId === 'garage_rock')
);

const recipe = renderWorkspace(cards, { format: 'rich', ceiling: 1000 });
check(
  'header is primary-only "Garage rock, "',
  recipe.startsWith('Garage rock, '),
  JSON.stringify(recipe.slice(0, 40))
);
check('NO search staples in header', !/\bGarage rock \+/.test(recipe));
check('within 1000-char ceiling', recipe.length <= 1000, `${recipe.length} chars`);
check(
  'voice carries the tradition voice (belt / mid-1960s double-tracking)',
  /double-tracking|belt/.test(recipe)
);
check(
  'names a preface on the anchor (voice)',
  /,\s*[a-z-]+ voice:|^[A-Za-z ]+,\s*[a-z-]+ voice:/.test(recipe) || / voice:/.test(recipe)
);

console.log('\n  recipe (' + recipe.length + ' chars):');
console.log('  ' + recipe + '\n');

// ── 2. robustness: a spread of traditions must seed + render without throwing ─
const SAMPLE = ['afrobeat', 'outlaw_country', 'detroit_techno', 'bebop', 'reggae_roots', 'gqom'];
console.log('robustness sample:');
for (const id of SAMPLE) {
  if (!C.TRADITIONS.find((t) => t.id === id)) {
    console.log(`  – ${id} (absent, skipped)`);
    continue;
  }
  try {
    const cs = seedTraditionCards(id);
    const r = renderWorkspace(cs, { format: 'rich', ceiling: 1000 });
    const head = (C.TRADITIONS.find((t) => t.id === id) || {}).name;
    check(
      `${id}: header "${head}, ", ${r.length}≤1000, ${cs.length} cards`,
      r.startsWith(head + ', ') && r.length <= 1000 && cs.length > 0
    );
  } catch (e) {
    fail(`${id} threw: ${e.message}`);
  }
}

// ── optional: print a requested tradition's recipe ──────────────────────────
const arg = process.argv[2];
if (arg) {
  console.log(`\n${arg}:`);
  const cs = seedTraditionCards(arg);
  if (!cs) {
    fail(`unknown tradition "${arg}"`);
  } else console.log('  ' + renderWorkspace(cs, { format: 'rich', ceiling: 1000 }));
}

console.log(failures === 0 ? '\nPASS' : `\nFAIL (${failures})`);
process.exit(failures === 0 ? 0 : 1);
