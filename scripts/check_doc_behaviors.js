#!/usr/bin/env node
// check_doc_behaviors.js — assert the documented BEHAVIORS and OUTPUTS of the
// agent-facing docs, not merely that the commands exit 0.
//
// @covers: documented-behaviors
//
// WHY: the doc gate had a layered blind spot.
//   • check_docs.js          proves the catalog COUNTS in the docs match the data.
//   • check_doc_commands.js  proves every documented command RUNS (exit 0).
//   • regression_recipes.js  snapshots the recipe STRINGS a tradition compiles to.
// None of them checks a documented *argument-parsing contract* or a documented
// *diagnostic-tool output*. That gap let SKILL.md §3f keep warning, as "verified",
// that a bare `--diff <a> <b>` "swallows <a> and dies" long after recipe.js's
// BOOLEAN_FLAGS made every ordering work — a stale dogfooding note no existing gate
// could catch. This closes it: each assertion below pins one documented behavior to
// the SKILL.md section that states it, and fails loudly when reality drifts from the
// prose. Keep the SKILL.md claim and its assertion here updated together.
//
// Usage: node scripts/check_doc_behaviors.js [--verbose]   (exit 0 = all hold)

'use strict';
const path = require('path');
const { execFileSync } = require('child_process');
const C = require('./_loader.js'); // shipped loader → tradition names without the q.js shim

const ROOT = path.join(__dirname, '..');
const RECIPE = path.join('scripts', 'recipe.js');
const NN = path.join('scripts', 'nearest_neighbor.js');
const PREF = path.join('scripts', 'preface_configure.js');
const VERBOSE = process.argv.includes('--verbose');

// Run a node script; return { code, out }. Never throws on non-zero exit.
function run(args) {
  try {
    const out = execFileSync('node', args, {
      cwd: ROOT,
      encoding: 'utf8',
      timeout: 60000,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { code: 0, out };
  } catch (e) {
    return { code: e.status == null ? -1 : e.status, out: (e.stdout || '') + (e.stderr || '') };
  }
}

const tradName = (id) => (C.TRADITIONS.find((t) => t.id === id) || {}).name || id;
const allEqual = (arr) => arr.length > 0 && arr.every((x) => x.length > 0 && x === arr[0]);

const checks = [];
const assert = (section, claim, fn) => checks.push({ section, claim, fn });

// ── §3f — the `--diff` argument-parsing contract (the note that actually rotted) ──
assert(
  '§3f',
  '--diff: every argument ordering is byte-identical, and bare form == default --weight=0.5',
  () => {
    const A = 'delta_blues',
      B = 'detroit_techno';
    const w07 = [
      run([RECIPE, '--diff', '--weight=0.7', A, B]).out, // documented "safe" form
      run([RECIPE, '--diff', A, B, '--weight=0.7']).out, // bare form, weight after
      run([RECIPE, '--diff', A, '--weight=0.7', B]).out, // weight wedged between the ids
    ];
    const w05 = [
      run([RECIPE, '--diff', '--weight=0.5', A, B]).out, // explicit default
      run([RECIPE, '--diff', A, B]).out, // bare, no weight → default 0.5
    ];
    const ok = allEqual(w07) && allEqual(w05) && w07[0] !== w05[0];
    return {
      ok,
      detail: ok
        ? `0.7 group identical (${w07[0].length}b), 0.5 group identical (${w05[0].length}b, bare==explicit-0.5)`
        : `diverged: 0.7 distinct=${new Set(w07).size}/3, 0.5 distinct=${new Set(w05).size}/2, weightMatters=${w07[0] !== w05[0]}`,
    };
  }
);

assert('§3f', '--swap-variant with an unknown variant id is rejected with exit 2', () => {
  const r = run([
    RECIPE,
    '--tradition',
    'delta_blues',
    '--swap-variant=voice:voice_register:__bogus__',
  ]);
  return { ok: r.code === 2, detail: `exit ${r.code}` };
});

assert(
  '§3f',
  'stapling order sets the lead: `a,b` vs `b,a` differ and each leads with its first id',
  () => {
    const A = 'delta_blues',
      B = 'detroit_techno',
      nA = tradName(A),
      nB = tradName(B);
    const oab = run([RECIPE, '--traditions', `${A},${B}`]).out;
    const oba = run([RECIPE, '--traditions', `${B},${A}`]).out;
    const leadsWith = (out, lead, other) => {
      const i = out.toLowerCase().indexOf(lead.toLowerCase());
      const j = out.toLowerCase().indexOf(other.toLowerCase());
      return i >= 0 && (j < 0 || i < j);
    };
    const ok = oab !== oba && leadsWith(oab, nA, nB) && leadsWith(oba, nB, nA);
    return {
      ok,
      detail: ok ? `"${A},${B}"→leads ${nA}; reversed→leads ${nB}` : 'order did not move the lead',
    };
  }
);

// ── §8 — nearest-neighbor top hits the docs cite as "Verified" ──
assert(
  '§8',
  'nearest_neighbor top neighbor: instrument voice→griot_voice, tradition delta_blues→jug_band',
  () => {
    const firstNeighbor = (out) => {
      const m = out.match(/^\s+([a-z0-9_]+)\s+score=/m);
      return m ? m[1] : null;
    };
    const a = firstNeighbor(run([NN, '--type', 'instrument', '--id', 'voice']).out);
    const b = firstNeighbor(run([NN, '--type', 'tradition', '--id', 'delta_blues']).out);
    return {
      ok: a === 'griot_voice' && b === 'jug_band',
      detail: `instrument→${a}, tradition→${b}`,
    };
  }
);

// ── §3g — the preface inverse outputs the docs cite as "Verified" ──
assert(
  '§3g',
  'preface_configure: voice+liturgical covers 0/13→4/13; voice+caressing moves Room→Front parlor',
  () => {
    const lit = run([PREF, '--instrument', 'voice', '--preface', 'liturgical']).out;
    const car = run([PREF, '--instrument', 'voice', '--preface', 'caressing']).out;
    const litOk = /0\/13\s*→\s*4\/13/.test(lit),
      carOk = /Front parlor/.test(car);
    return {
      ok: litOk && carOk,
      detail: `liturgical(0/13→4/13)=${litOk}, caressing(Room→Front parlor)=${carOk}`,
    };
  }
);

// ── §9.1 — arrangement is CLI-only and injects a clause the default recipe lacks ──
assert(
  '§9.1',
  'recipe.js --arrangement injects a clause the default recipe lacks (arrangement is CLI-only)',
  () => {
    const withArr = run([
      RECIPE,
      '--tradition',
      'delta_blues',
      '--arrangement=twelve_bar_blues_repeated',
    ]).out;
    const without = run([RECIPE, '--tradition', 'delta_blues']).out;
    const hasClause = (s) => /twelve.bar/i.test(s);
    return {
      ok: hasClause(withArr) && !hasClause(without),
      detail: `with=${hasClause(withArr)}, without=${hasClause(without)}`,
    };
  }
);

// ── §9.2 — fx_extras ARE a rendered chain stage. Regression guard for the
//    `fx_`-prefix bug: 18 traditions carried `chain_fx: ['fx_spring_reverb', …]`
//    that didn't resolve to the fx section (real id `spring_reverb`) and were
//    silently dropped at render. surf rock without its spring reverb is wrong. ──
assert(
  '§9.2',
  'fx_extras render into the recipe: surf_rock shows its spring reverb + tremolo',
  () => {
    const out = run([RECIPE, '--tradition', 'surf_rock']).out;
    const spring = /spring reverb/i.test(out),
      trem = /tremolo/i.test(out);
    return { ok: spring && trem, detail: `spring reverb=${spring}, tremolo=${trem}` };
  }
);

// ── §3d — the voice/preface lexicon tokens the docs print verbatim ──
assert('§3d', 'PREFACE_LEXICON "belting" → the 8 tokens documented in §3d', () => {
  const b = C.PREFACE_LEXICON.find((p) => p.id === 'belting');
  const expected =
    'projecting, chest-resonance-low-mid, vibrato-rich, late-Romantic-onward, ringing, blues-shouter, characteristic-cry, choir-blendable';
  const got = b ? (b.tokens || []).slice(0, 8).join(', ') : '(belting not found)';
  return { ok: got === expected, detail: got === expected ? '8 tokens match' : `got: ${got}` };
});

let fail = 0;
const results = [];
for (const c of checks) {
  let res;
  try {
    res = c.fn();
  } catch (e) {
    res = { ok: false, detail: 'threw: ' + e.message };
  }
  if (res.ok) results.push(`  ✓ ${c.section}  ${c.claim}`);
  else {
    fail++;
    results.push(`  ✗ ${c.section}  ${c.claim}\n      → ${res.detail}`);
  }
}

console.log(`=== Documented behavior assertions (${checks.length}) ===`);
if (VERBOSE || fail) for (const r of results) console.log(r);
if (fail === 0) {
  console.log(`PASS — all ${checks.length} documented behaviors hold.`);
  process.exit(0);
}
console.error(
  `FAIL — ${fail} documented behavior(s) drifted from the docs. Fix the code or update the SKILL.md claim + its assertion together.`
);
process.exit(1);
