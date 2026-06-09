#!/usr/bin/env node
// faults.js — Goal 2: prove every gate is TWO-SIDED.
//
// @covers: gates-two-sided
//
// A check you've never seen go red is worthless. For each gate-class this plants
// ONE known defect into an ISOLATED temp copy of the source (the real tree is
// never mutated) and asserts the owning gate exits non-zero. 0 escapes required:
// a gate that stays green on a planted defect fails this suite.
//
// Gate-classes (each maps to the gate that owns it):
//   broken ref          -> validate.js
//   >1000-char recipe   -> check_api.js
//   dropped tradition   -> check_api.js
//   app<->node desync   -> equivalence.js
//   stale api/          -> check_artifact_fresh.js   (needs --fresh-api/--fresh-html)
//   silent blend-drop   -> recipe.js  (input validation)
//   orphan promise      -> check_promises.js  (documented but unregistered/ungated)
//   lazy != embedded    -> check_lazy_app.js  (shipped shell drifts from embedded build)
//
// Usage:
//   node scripts/faults.js [--fresh-api=DIR --fresh-html=FILE] [--verbose]
// Exit 0 if every defect was caught, 1 if any gate escaped.

'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const flags = {};
for (const a of process.argv.slice(2)) {
  if (a.startsWith('--')) {
    const i = a.indexOf('=');
    if (i > 0) flags[a.slice(2, i)] = a.slice(i + 1);
    else flags[a.slice(2)] = true;
  }
}
const VERBOSE = !!flags.verbose;
const FRESH_API = flags['fresh-api'] ? path.resolve(ROOT, flags['fresh-api']) : null;
const FRESH_HTML = flags['fresh-html'] ? path.resolve(ROOT, flags['fresh-html']) : null;
const q = (s) => JSON.stringify(s);

// Isolated temp copy of just the items a gate needs; node_modules is symlinked.
function mkenv(items) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-fault-'));
  for (const it of items) execSync(`cp -a ${q(path.join(ROOT, it))} ${q(path.join(d, it))}`);
  fs.symlinkSync(path.join(ROOT, 'node_modules'), path.join(d, 'node_modules'));
  return d;
}
// Run a gate; return its exit code (never throws). 0 = passed (BAD here), !=0 = caught.
function gate(dir, args) {
  try {
    execFileSync('node', args, { cwd: dir, stdio: VERBOSE ? 'inherit' : 'ignore', timeout: 300000 });
    return 0;
  } catch (e) {
    return e.status == null ? -1 : e.status;
  }
}

const results = [];
function record(cls, code) {
  const caught = code !== 0;
  results.push({ cls, caught, code });
  process.stderr.write(`  ${caught ? '✓ caught ' : '✗ ESCAPED'}  ${cls}  (exit ${code})\n`);
}

process.stderr.write('Injecting one defect per gate-class (isolated temp copies; real tree untouched)…\n');

// 1. broken ref -> validate.js
{
  const d = mkenv(['scripts', 'references']);
  const f = path.join(d, 'references/05_traditions.js');
  fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace("room: '", "room: 'zzz_fault_"));
  record('broken-ref -> validate.js', gate(d, ['scripts/validate.js']));
}

// 2. >1000-char recipe -> check_api.js
{
  const d = mkenv(['scripts', 'references', 'api']);
  const f = path.join(d, 'api/traditions/bluegrass.json');
  const j = JSON.parse(fs.readFileSync(f, 'utf8'));
  j.recipe = 'x'.repeat(1001);
  j.recipe_chars = 1001;
  fs.writeFileSync(f, JSON.stringify(j, null, 2));
  record('over-ceiling-recipe -> check_api.js', gate(d, ['scripts/check_api.js']));
}

// 3. dropped tradition -> check_api.js
{
  const d = mkenv(['scripts', 'references', 'api']);
  fs.unlinkSync(path.join(d, 'api/traditions/zydeco.json'));
  record('dropped-tradition -> check_api.js', gate(d, ['scripts/check_api.js']));
}

// 4. unresolvable config id (stale snapshot vs catalog) -> check_api.js
{
  const d = mkenv(['scripts', 'references', 'api']);
  const f = path.join(d, 'api/traditions/bluegrass.json');
  const j = JSON.parse(fs.readFileSync(f, 'utf8'));
  j.config.room = 'BOGUS_ROOM_FAULT';
  fs.writeFileSync(f, JSON.stringify(j, null, 2));
  record('unresolvable-id -> check_api.js', gate(d, ['scripts/check_api.js']));
}

// 5. app<->node desync -> equivalence.js  (mutate the NODE adapter only; the
//    browser inlines the @inline core, so this forces the two sides to disagree)
{
  const d = mkenv(['scripts', 'references', 'src']);
  const f = path.join(d, 'scripts/_card_descriptors.js');
  const s = fs.readFileSync(f, 'utf8').replace(
    '  return harvestDescriptors(card, lookups);',
    "  const _s = harvestDescriptors(card, lookups); _s.add('__FAULT__'); return _s;"
  );
  fs.writeFileSync(f, s);
  record('app-node-desync -> equivalence.js', gate(d, ['scripts/equivalence.js']));
}

// 6. stale api/ (committed != fresh build) -> check_artifact_fresh.js
if (FRESH_API && FRESH_HTML) {
  const d = mkenv(['scripts', 'references', 'api']);
  const f = path.join(d, 'api/traditions/bluegrass.json');
  const j = JSON.parse(fs.readFileSync(f, 'utf8'));
  j.recipe = j.recipe + ' STALE_DRIFT';
  fs.writeFileSync(f, JSON.stringify(j, null, 2));
  const code = gate(d, [
    'scripts/check_artifact_fresh.js',
    `--committed-api=${path.join(d, 'api')}`,
    `--prebuilt-api=${FRESH_API}`,
    `--prebuilt-html=${FRESH_HTML}`,
    `--committed-html=${FRESH_HTML}`,
  ]);
  record('stale-api -> check_artifact_fresh.js', code);
} else {
  process.stderr.write('  - skipped stale-api fault (pass --fresh-api=DIR --fresh-html=FILE to enable)\n');
}

// 7. silent blend-drop -> recipe.js  (read-only on the real tree)
record('silent-blend-drop -> recipe.js', gate(ROOT, ['scripts/recipe.js', '--traditions', 'afrobeat,__bogus_fault__']));

// 8. orphan promise (documented but unregistered/ungated) -> check_promises.js
{
  const d = mkenv(['scripts', 'AGENTS.md', 'llms.txt', 'README.md', 'SKILL.md']);
  fs.appendFileSync(path.join(d, 'AGENTS.md'), '\n<!-- @promise: __orphan_fault__ -->\n');
  record('orphan-promise -> check_promises.js', gate(d, ['scripts/check_promises.js']));
}

// 9. lazy shell drifts from embedded build -> check_lazy_app.js
//    The gate boots BOTH builds; the embedded one reads references/ while the
//    lazy one reads api/browse.json through the fetch shim. Corrupting one
//    tradition's name in the isolated browse.json forces the two builds to
//    disagree on the catalog projection, which the parity gate must catch.
{
  const d = mkenv(['scripts', 'references', 'src', 'api']);
  const f = path.join(d, 'api/browse.json');
  const j = JSON.parse(fs.readFileSync(f, 'utf8'));
  j.items[0].name = (j.items[0].name || '') + ' __FAULT__';
  fs.writeFileSync(f, JSON.stringify(j, null, 2));
  record('lazy-shell-desync -> check_lazy_app.js', gate(d, ['scripts/check_lazy_app.js']));
}

const escaped = results.filter((r) => !r.caught);
console.log(`\n=== Fault injection: ${results.length} gate-class(es) tested, ${escaped.length} escape(s) ===`);
if (escaped.length === 0) {
  console.log('PASS — every injected defect was caught. All gates are two-sided.');
  process.exit(0);
}
console.error('FAIL — these gates stayed GREEN on a planted defect (one-sided, untrustworthy):');
for (const e of escaped) console.error(`  ✗ ${e.cls}`);
process.exit(1);
