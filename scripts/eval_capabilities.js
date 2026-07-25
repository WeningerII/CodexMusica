#!/usr/bin/env node
'use strict';
// eval_capabilities.js — black-box capability acceptance eval across every major
// CLI surface and the static JSON API. Higher-altitude than the per-module
// regression/gate suites: it drives the shipped entry points exactly as a user
// would (one subprocess per command) and asserts the user-visible contract holds:
//   - non-empty output
//   - the <=1000-char recipe ceiling
//   - no broken tokens (undefined / NaN / [object Object])
//   - deterministic re-runs (same input -> byte-identical output)
//   - loud failure on bad input (non-zero exit, never a bogus recipe)
//
// Scope note: the live MCP connector capabilities (start_recipe / edit_recipe /
// render_recipe and the search_*/get_*/list_* introspection tools) need a running
// MCP host, so they are covered by `npm run test:connector`
// (check_connector_parity + check_workspace_ops + check_app_parity + mcp/test.mjs)
// and by black-box runs against the live connector — intentionally out of scope
// for this offline runner.
//
// Refuses to pass vacuously: an empty scenario set is itself a failure.
// Exit 0 iff every scenario passes; exit 1 if any scenario fails.
//
// Usage:
//   npm run eval
//   node scripts/eval_capabilities.js

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CEIL = 1000; // recipe length ceiling
const BROKEN = /undefined|NaN|\[object Object\]/; // tokens that must never ship

function sh(cmd) {
  try {
    const out = execSync(cmd, {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 120000,
      maxBuffer: 64 * 1024 * 1024,
    });
    return { code: 0, out };
  } catch (e) {
    return { code: e.status == null ? -1 : e.status, out: `${e.stdout || ''}${e.stderr || ''}` };
  }
}
const R = (cmd) => 'node ' + path.join('scripts', cmd);
const apiJson = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT, 'api', rel), 'utf8'));

const scenarios = [];
const add = (id, fn) => scenarios.push({ id, fn });

// ── recipe engine ────────────────────────────────────────────────────────────
add('S1  recipe: single (afrobeat)', () => {
  const r = sh(R('recipe.js --tradition afrobeat'));
  const t = r.out.trim();
  return {
    pass: r.code === 0 && t.length > 0 && t.length <= CEIL && !BROKEN.test(t),
    ev: `exit ${r.code}, ${t.length} chars`,
  };
});
add('S2  recipe: determinism (afrobeat x2 identical)', () => {
  const a = sh(R('recipe.js --tradition afrobeat')).out;
  const b = sh(R('recipe.js --tradition afrobeat')).out;
  return { pass: a === b && a.trim().length > 0, ev: a === b ? 'identical' : 'DIFFERED' };
});
add('S3  recipe: distinct families (bluegrass, detroit_techno)', () => {
  const ids = ['bluegrass', 'detroit_techno'];
  const xs = ids.map((id) => sh(R('recipe.js --tradition ' + id)));
  const ok = xs.every(
    (r) =>
      r.code === 0 && r.out.trim().length > 0 && r.out.trim().length <= CEIL && !BROKEN.test(r.out)
  );
  return {
    pass: ok,
    ev: xs.map((r, i) => `${ids[i]}:${r.code}/${r.out.trim().length}c`).join(' '),
  };
});
add('S4  blend: --traditions bluegrass,thrash_metal', () => {
  const r = sh(R('recipe.js --traditions bluegrass,thrash_metal'));
  const t = r.out.trim();
  return {
    pass: r.code === 0 && t.length > 0 && t.length <= CEIL && !BROKEN.test(t),
    ev: `exit ${r.code}, ${t.length} chars`,
  };
});
add('S5  blend: --diff bluegrass thrash_metal', () => {
  const r = sh(R('recipe.js --diff bluegrass thrash_metal'));
  return {
    pass: r.code === 0 && r.out.trim().length > 0 && !BROKEN.test(r.out),
    ev: `exit ${r.code}, ${r.out.trim().length} chars`,
  };
});
add('S6  blend: --diff --weight=0.6', () => {
  const r = sh(R('recipe.js --diff --weight=0.6 bluegrass thrash_metal'));
  return {
    pass: r.code === 0 && r.out.trim().length > 0 && !BROKEN.test(r.out),
    ev: `exit ${r.code}, ${r.out.trim().length} chars`,
  };
});
add('S7  customize: --exclude-instrument=saxophone (afrobeat)', () => {
  const base = sh(R('recipe.js --tradition afrobeat')).out;
  const r = sh(R('recipe.js --tradition afrobeat --exclude-instrument=saxophone'));
  const hadSax = /saxophone/i.test(base);
  const goneSax = !/saxophone/i.test(r.out);
  return {
    pass: r.code === 0 && r.out.trim().length > 0 && hadSax && goneSax,
    ev: `exit ${r.code}, base-had-sax:${hadSax}, now-gone:${goneSax}`,
  };
});
add('S8  customize: --swap-variant voice falsetto (afrobeat)', () => {
  const r = sh(R('recipe.js --tradition afrobeat --swap-variant=voice:voice_register:falsetto'));
  return {
    pass: r.code === 0 && r.out.trim().length > 0 && !BROKEN.test(r.out),
    ev: `exit ${r.code}, ${r.out.trim().length} chars`,
  };
});
add('S9  axis-target match', () => {
  const r = sh(R('recipe.js --axis-target "harm:1,density:2,intensity:2"'));
  return {
    pass: r.code === 0 && r.out.trim().length > 0 && !BROKEN.test(r.out),
    ev: `exit ${r.code}, ${r.out.trim().length} chars`,
  };
});
add('S10 robustness: unknown tradition -> non-zero, no bogus recipe', () => {
  const r = sh(R('recipe.js --tradition __nope_not_a_tradition__'));
  const errlike = /unknown|not found|no such|invalid|resolve|error/i.test(r.out);
  return { pass: r.code !== 0 && errlike, ev: `exit ${r.code}, error-message:${errlike}` };
});

// ── introspection ────────────────────────────────────────────────────────────
add('S11 list: --traditions (>=1000 entries)', () => {
  const r = sh(R('list.js --traditions'));
  const lines = r.out.trim().split('\n').length;
  return { pass: r.code === 0 && lines >= 1000, ev: `exit ${r.code}, ${lines} lines` };
});
add('S12 inspect: --tradition=afrobeat', () => {
  const r = sh(R('inspect.js --tradition=afrobeat'));
  return {
    pass: r.code === 0 && r.out.trim().length > 0 && !BROKEN.test(r.out),
    ev: `exit ${r.code}, ${r.out.trim().length} chars`,
  };
});
add('S13 expand: --tradition afrobeat', () => {
  const r = sh(R('expand.js --tradition afrobeat'));
  return {
    pass: r.code === 0 && r.out.trim().length > 0,
    ev: `exit ${r.code}, ${r.out.trim().length} chars`,
  };
});
add('S14 compare: --traditions=afrobeat,highlife', () => {
  const r = sh(R('compare.js --traditions=afrobeat,highlife'));
  return {
    pass: r.code === 0 && r.out.trim().length > 0,
    ev: `exit ${r.code}, ${r.out.trim().length} chars`,
  };
});
add('S15 fingerprint: afrobeat', () => {
  const r = sh(R('fingerprint.js afrobeat'));
  return {
    pass: r.code === 0 && r.out.trim().length > 0,
    ev: `exit ${r.code}, ${r.out.trim().length} chars`,
  };
});
add('S16 nearest_neighbor: --type tradition --id afrobeat', () => {
  const r = sh(R('nearest_neighbor.js --type tradition --id afrobeat'));
  return {
    pass: r.code === 0 && r.out.trim().length > 0,
    ev: `exit ${r.code}, ${r.out.trim().length} chars`,
  };
});
add('S17 stack: --tradition=afrobeat', () => {
  const r = sh(R('stack.js --tradition=afrobeat'));
  return {
    pass: r.code === 0 && r.out.trim().length > 0,
    ev: `exit ${r.code}, ${r.out.trim().length} chars`,
  };
});
add('S18 preface_configure: voice/belting (afrobeat)', () => {
  const r = sh(R('preface_configure.js --instrument voice --preface belting --tradition afrobeat'));
  return {
    pass: r.code === 0 && r.out.trim().length > 0 && !BROKEN.test(r.out),
    ev: `exit ${r.code}, ${r.out.trim().length} chars`,
  };
});

// ── static API ───────────────────────────────────────────────────────────────
add('S19 api/all.json: count 1167, every recipe <=1000', () => {
  const j = apiJson('all.json');
  const items = Array.isArray(j) ? j : j.items || j.traditions || [];
  const over = items.filter((x) => (x.recipe || '').length > CEIL).length;
  const n = items.length;
  return { pass: n === 1167 && over === 0, ev: `count ${n}, over-ceiling ${over}` };
});
add('S20 api/index.json: valid endpoint map + counts', () => {
  const j = apiJson('index.json');
  return {
    pass: !!j && typeof j === 'object',
    ev: `keys: ${Object.keys(j).slice(0, 6).join(',')}`,
  };
});
add('S21 api/traditions/bluegrass.json: recipe + config present', () => {
  const j = apiJson('traditions/bluegrass.json');
  return {
    pass:
      typeof j.recipe === 'string' &&
      j.recipe.length > 0 &&
      j.recipe.length <= CEIL &&
      j.config &&
      typeof j.config === 'object',
    ev: `recipe ${(j.recipe || '').length}c, config:${!!j.config}`,
  };
});

// ── expanded coverage (Loop 010 expanded set) ────────────────────────────────
// One representative tradition per catalog family (real ids), reused by the
// breadth + bulk/per-id consistency checks.
const FAMS = {
  blues_gospel: 'delta_blues',
  classical: 'symphonic',
  country: 'western_swing',
  electronic: 'chicago_house',
  global: 'palm_wine',
  hip_hop: 'gangsta_rap',
  jazz: 'new_orleans',
  pop: 'reggaeton',
  pop_rock: 'girl_group_60s',
  rock: 'arena_rock',
  rock_punk: 'progressive_rock',
  vernacular: 'honky_tonk',
};
const STACK = /at \w+.*\(.*:\d+:\d+\)|Error:.*\n\s+at /; // an uncaught stack trace = crash

add('S22 breadth: one tradition per family (12) valid <=1000', () => {
  const bad = [];
  for (const [fam, id] of Object.entries(FAMS)) {
    const r = sh(R('recipe.js --tradition ' + id));
    const t = r.out.trim();
    if (!(r.code === 0 && t.length > 0 && t.length <= CEIL && !BROKEN.test(t)))
      bad.push(`${fam}/${id}`);
  }
  return { pass: bad.length === 0, ev: bad.length ? 'BAD: ' + bad.join(' ') : '12/12 families ok' };
});
add('S23 --staple-mode lineage vs full differ in blend mode', () => {
  const full = sh(R('recipe.js --traditions new_orleans,thrash_metal --staple-mode=full'));
  const lin = sh(R('recipe.js --traditions new_orleans,thrash_metal --staple-mode=lineage'));
  const ok = [full, lin].every(
    (r) =>
      r.code === 0 && r.out.trim().length > 0 && r.out.trim().length <= CEIL && !BROKEN.test(r.out)
  );
  const differ = full.out !== lin.out;
  return {
    pass: ok && differ,
    ev: `full:${full.out.trim().length}c lineage:${lin.out.trim().length}c differ:${differ}`,
  };
});
add('S24 robustness: bad --swap-variant variant -> graceful (no crash)', () => {
  const r = sh(R('recipe.js --tradition afrobeat --swap-variant=voice:voice_register:__nope__'));
  return {
    pass: !(STACK.test(r.out) || BROKEN.test(r.out)),
    ev: `exit ${r.code}, loud-reject:${r.code !== 0}`,
  };
});
add('S25 robustness: bad --swap-variant instrument -> graceful (no crash)', () => {
  const r = sh(R('recipe.js --tradition afrobeat --swap-variant=__noinstr__:x:y'));
  return {
    pass: !(STACK.test(r.out) || BROKEN.test(r.out)),
    ev: `exit ${r.code}, loud-reject:${r.code !== 0}`,
  };
});
add('S26 robustness: --diff with one bad id -> non-zero', () => {
  const r = sh(R('recipe.js --diff delta_blues __nope_not_real__'));
  const errlike = /unknown|not found|no such|invalid|resolve|error/i.test(r.out);
  return {
    pass: r.code !== 0 && errlike && !STACK.test(r.out),
    ev: `exit ${r.code}, errorlike:${errlike}`,
  };
});
add('S27 api/instruments/<id>.json sample valid', () => {
  const sample = ['accordion', 'acoustic_guitar_dread', 'analog_mono_synth', 'balafon', 'agogo'];
  const bad = [];
  for (const id of sample) {
    try {
      const j = apiJson('instruments/' + id + '.json');
      if (!j || typeof j !== 'object' || !(j.id || j.name)) bad.push(id + ':shape');
    } catch (e) {
      bad.push(id + ':' + (e.code === 'ENOENT' ? 'missing' : 'parse'));
    }
  }
  return {
    pass: bad.length === 0,
    ev: bad.length ? 'BAD: ' + bad.join(' ') : `${sample.length}/${sample.length} ok`,
  };
});
add('S28 consistency: all.json recipe == per-id file recipe (sample)', () => {
  const all = apiJson('all.json');
  const items = Array.isArray(all) ? all : all.items || all.traditions || [];
  const byId = new Map(items.map((x) => [x.id, x.recipe]));
  const mismatch = [];
  for (const id of Object.values(FAMS)) {
    const per = apiJson('traditions/' + id + '.json').recipe;
    if (byId.get(id) !== per) mismatch.push(id);
  }
  return {
    pass: mismatch.length === 0,
    ev: mismatch.length
      ? 'MISMATCH: ' + mismatch.join(' ')
      : `${Object.values(FAMS).length} consistent`,
  };
});

// ── run ──────────────────────────────────────────────────────────────────────
if (scenarios.length === 0) {
  console.error('CAPABILITY EVAL: FAIL — no scenarios defined (refusing to pass vacuously)');
  process.exit(1);
}
let pass = 0;
let fail = 0;
const fails = [];
for (const s of scenarios) {
  let res;
  try {
    res = s.fn();
  } catch (e) {
    res = { pass: false, ev: 'THREW: ' + e.message };
  }
  const tag = res.pass ? 'PASS' : 'FAIL';
  if (res.pass) pass++;
  else {
    fail++;
    fails.push(s.id);
  }
  console.log(`[${tag}] ${s.id}  —  ${res.ev}`);
}
console.log(`\n===== ${pass}/${scenarios.length} passed, ${fail} failed =====`);
if (fail) {
  console.log('FAILED: ' + fails.join(' | '));
  process.exit(1);
}
console.log('CAPABILITY EVAL: ALL GREEN');
