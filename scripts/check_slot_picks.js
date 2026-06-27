#!/usr/bin/env node
// check_slot_picks.js — verify each (tradition, instrument, part) → expected_variant
// from tests/slot_pick_lock_ins.json. Used to lock in slot picks that aren't
// visible in rendered recipe text (isolated_parts wins on cymbal/shell), and
// to lock in voice_isolated wins at the seed-config level.
//
// Runs in tandem [1/4] source pipeline. Fails loudly if any slot pick drifts.
//
// Usage:
//   node scripts/check_slot_picks.js                 # all tests
//   node scripts/check_slot_picks.js --json          # machine-readable

const fs = require('fs');
const path = require('path');
const { seedFromTradition, search } = require('./search.js');

const args = process.argv.slice(2);
const flags = {};
for (const a of args) {
  if (a.startsWith('--')) flags[a.slice(2)] = true;
}

// Refuse to pass vacuously (exit 2 = missing input file, exit 1 = ran but found a
// problem): a missing fixture must FAIL loudly, not crash with an uncaught
// readFileSync; an empty test set must FAIL, not mint "0/0 pass".
const docPath = path.join(__dirname, '..', 'tests', 'slot_pick_lock_ins.json');
if (!fs.existsSync(docPath)) {
  console.error(
    `Slot-pick lock-ins: FAIL — fixture missing at ${docPath} (refusing to pass vacuously)`
  );
  process.exit(2);
}
const doc = JSON.parse(fs.readFileSync(docPath, 'utf8'));
const tests = doc.tests || [];
if (tests.length === 0) {
  console.error('Slot-pick lock-ins: FAIL — no tests in fixture (refusing to pass vacuously)');
  process.exit(1);
}

const results = [];
for (const t of tests) {
  const seed = seedFromTradition(t.tradition);
  if (!seed) {
    results.push({ ...t, ok: false, actual: null, error: `seedFromTradition returned null` });
    continue;
  }
  const r = search(seed, { maxIters: 100 });
  const card = r.config.instruments.find((i) => i.id === t.instrument);
  if (!card) {
    results.push({
      ...t,
      ok: false,
      actual: null,
      error: `instrument '${t.instrument}' not in config`,
    });
    continue;
  }
  const actual = (card.slots || {})[t.part];
  results.push({ ...t, ok: actual === t.expected_variant, actual });
}

const passed = results.filter((r) => r.ok).length;
const failed = results.filter((r) => !r.ok);

if (flags.json) {
  process.stdout.write(
    JSON.stringify({ passed, failed: failed.length, total: tests.length, results }, null, 2)
  );
  process.exit(failed.length > 0 ? 1 : 0);
}

console.log(`Slot-pick lock-ins: ${passed}/${tests.length} pass.`);
if (failed.length === 0) {
  process.exit(0);
}
console.log('');
console.log('FAILURES:');
for (const f of failed) {
  console.log(`  ${f.tradition} / ${f.instrument} / ${f.part}`);
  console.log(`    expected: ${f.expected_variant}`);
  console.log(`    actual:   ${f.actual}${f.error ? '  (' + f.error + ')' : ''}`);
  console.log(`    rationale: ${f.rationale}`);
}
process.exit(1);
