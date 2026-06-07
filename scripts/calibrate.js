#!/usr/bin/env node
// calibrate.js — periodic quality-review tool. Iterates calibration fixtures,
// runs the codex with the expected tradition framing for each, and presents
// side-by-side: gold-standard ← actual output. Mechanically asserts that key
// descriptors appear; the rest is for human (Claude or curator) judgment using
// the four-bin discrepancy taxonomy in SKILL.md.
//
// Unlike regression_recipes.js (output-stability check, runs in build pipeline) and
// smoke.js (crash-resistance check, runs in build pipeline), calibrate.js is
// an on-demand quality-review tool. NOT in the build pipeline. Run when:
//   - You suspect catalog drift after a major edit
//   - You want to verify a specific subset of traditions
//   - You're investigating whether codex output matches conventional wisdom
//
// Usage:
//   node scripts/calibrate.js                         # all fixtures
//   node scripts/calibrate.js --fixture=dylan_in_my_time_of_dyin   # single fixture
//   node scripts/calibrate.js --json                  # machine-readable output

const fs = require('fs');
const path = require('path');
const { search, seedFromTradition } = require('./search.js');
const { translate } = require('./translate.js');

const args = process.argv.slice(2);
const flags = {};
for (const a of args) {
  if (a.startsWith('--')) {
    const eq = a.indexOf('=');
    if (eq > 0) flags[a.slice(2, eq)] = a.slice(eq + 1);
    else flags[a.slice(2)] = true;
  }
}

const fixtures = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'tests', 'calibration_fixtures.json'), 'utf8')
).fixtures;

const targets = flags.fixture
  ? fixtures.filter(f => f.id === flags.fixture)
  : fixtures;

if (flags.fixture && targets.length === 0) {
  console.error(`No fixture with id "${flags.fixture}". Available:`);
  for (const f of fixtures) console.error(`  ${f.id}`);
  process.exit(2);
}

const results = [];

function generateRecipe(traditions) {
  const seed = seedFromTradition(traditions[0], traditions.slice(1));
  if (!seed) return null;
  const r = search(seed, { maxIters: 100 });
  return translate(r.config, { ceiling: 1000 });
}

function checkKeyDescriptors(actual, keyDescriptors) {
  const lc = actual.toLowerCase();
  const missing = [];
  const found = [];
  for (const d of keyDescriptors) {
    if (lc.includes(d.toLowerCase())) found.push(d);
    else missing.push(d);
  }
  return { found, missing };
}

for (const fixture of targets) {
  let actual = null;
  let error = null;
  try {
    actual = generateRecipe(fixture.traditions);
  } catch (e) {
    error = e.message;
  }
  const check = actual ? checkKeyDescriptors(actual, fixture.key_descriptors) : null;
  results.push({
    fixture,
    actual,
    error,
    check,
    pass: check ? check.missing.length === 0 : false
  });
}

if (flags.json) {
  console.log(JSON.stringify(results, null, 2));
  process.exit(results.some(r => !r.pass) ? 1 : 0);
}

// Human-readable side-by-side output
const sep = '─'.repeat(78);
const halfSep = '·'.repeat(78);

let passCount = 0;
let failCount = 0;

for (const r of results) {
  console.log('\n' + sep);
  console.log(`  ${r.fixture.id}`);
  console.log(`  ${r.fixture.user_query}`);
  console.log(`  framing: ${r.fixture.traditions.join(' + ')}`);
  if (r.fixture.framing_note) console.log(`  note: ${r.fixture.framing_note}`);
  console.log(sep);

  if (r.error) {
    console.log(`  ✗ ERROR: ${r.error}`);
    failCount++;
    continue;
  }

  console.log('  GOLD-STANDARD:');
  console.log('    ' + r.fixture.gold_standard);
  console.log(halfSep);
  console.log('  ACTUAL:');
  console.log('    ' + r.actual);
  console.log(halfSep);
  console.log(`  KEY DESCRIPTORS (${r.check.found.length}/${r.fixture.key_descriptors.length}):`);
  for (const d of r.check.found) console.log(`    ✓ ${d}`);
  for (const d of r.check.missing) console.log(`    ✗ ${d}  [MISSING]`);

  if (r.pass) {
    console.log('  → PASS (mechanical check; review side-by-side for quality)');
    passCount++;
  } else {
    console.log(`  → FAIL: ${r.check.missing.length} key descriptor(s) missing`);
    failCount++;
  }
}

console.log('\n' + sep);
console.log(`  Calibration: ${passCount}/${results.length} pass mechanical check`);
console.log(`  ${failCount > 0 ? 'Review failures + side-by-side comparisons above.' : 'Mechanical checks clean. Review side-by-side comparisons for quality.'}`);
console.log(sep);
console.log('  Discrepancy taxonomy when reviewing differences (see SKILL.md):');
console.log('    1. Catalog issue   — fix the data');
console.log('    2. Algorithm issue — fix the search/score/translate code');
console.log('    3. Genuine ambiguity — both recipes are defensible; document and move on');
console.log('    4. Curator misconception — gold-standard was wrong; update the fixture');
console.log(sep);

process.exit(failCount > 0 ? 1 : 0);
