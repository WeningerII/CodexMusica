#!/usr/bin/env node
// smoke.js — fail-fast catalog-wide health check.
//
// Different from regression_prefaces.js: regression locks specific fixtures
// against stored expectations (correctness for verified subset). Smoke runs
// every tradition, every blend canary, every axis-target path through the
// live pipeline and asserts the BROAD property "doesn't break" — rc=0, output
// non-empty, output ≤ ceiling, search converges. Catches catastrophic
// regressions in the search/score/translate pipeline that affect traditions
// outside the regression fixture set.
//
// Runs in-process so it can share the catalog load + buildContext cache
// across all 1090 traditions. End-to-end runtime ~16 minutes after the
// 2026-05 perf work (parse cache + skip-signals + sumLookupWeight neighbor-
// bias memoization in score.js). Profile if it regresses.
//
// Usage:
//   node scripts/smoke.js
//   node scripts/smoke.js --verbose       (per-tradition status)
//   node scripts/smoke.js --max-chars=1000  (ceiling override; default 1000)

const C = require('./_loader.js');
const { search, seedFromTradition, findClosestTraditionByAxis } = require('./search.js');
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
const VERBOSE = !!flags.verbose;
const CEILING = parseInt(flags['max-chars']) || 1000;

const failures = [];
const stats = { traditions: 0, blends: 0, axisTargets: 0, total: 0, ok: 0 };

function fail(scope, msg) {
  failures.push({ scope, msg });
  if (VERBOSE) console.error(`  ✗ ${scope}: ${msg}`);
}

function ok(scope) {
  stats.ok++;
  if (VERBOSE) console.error(`  ✓ ${scope}`);
}

function smokeOne(scope, seedFn) {
  stats.total++;
  let seed;
  try {
    seed = seedFn();
  } catch (e) {
    fail(scope, `seed threw: ${e.message}`);
    return;
  }
  if (!seed) {
    fail(scope, 'seed returned null');
    return;
  }
  let result;
  try {
    result = search(seed, { maxIters: 100 });
  } catch (e) {
    fail(scope, `search threw: ${e.message}`);
    return;
  }
  if (!result || !result.config) {
    fail(scope, 'search returned no config');
    return;
  }
  let out;
  try {
    out = translate(result.config, { ceiling: CEILING });
  } catch (e) {
    fail(scope, `translate threw: ${e.message}`);
    return;
  }
  if (!out || typeof out !== 'string') {
    fail(scope, `translate returned ${out === null ? 'null' : typeof out}`);
    return;
  }
  if (out.length === 0) {
    fail(scope, 'empty recipe');
    return;
  }
  if (out.length > CEILING) {
    fail(scope, `recipe ${out.length} chars > ceiling ${CEILING}`);
    return;
  }
  ok(scope);
}

console.error(`smoke: ${C.TRADITIONS.length} traditions, ceiling ${CEILING}`);

// === 1. Every tradition produces a recipe ===
console.error('\n[1] All single-tradition recipes:');
for (const t of C.TRADITIONS) {
  stats.traditions++;
  smokeOne(`tradition:${t.id}`, () => seedFromTradition(t.id));
}

// === 2. Multi-tradition blends — sample stratified pairs ===
// Cover within-branch (similar) + cross-branch (dissimilar) pair behavior.
// Cross-branch blends exercise staple-dedupe and axes-similarity selection
// more aggressively than single-tradition recipes do.
const BLEND_PAIRS = [
  // Within-branch — similar primaries, light blend
  ['delta_blues', 'chicago_blues'],
  ['bossa_nova', 'samba'],
  ['outlaw_country', 'bakersfield'],
  ['british_invasion_rb', 'hard_rock'],
  ['carnatic_vocal', 'carnatic_instrumental'],
  // Cross-branch — distant primaries, heavy blend exercises staple selection
  ['afrobeat', 'fusion'],
  ['qawwali', 'mongolian_long_song'],
  ['synthwave', 'baroque_period'],
  ['post_punk', 'dub'],
  ['fado', 'chanson_classique'],
  ['detroit_techno', 'industrial'],
  ['klezmer', 'sevdalinka'],
  ['gypsy_jazz', 'outlaw_country'],
  // Three-tradition blends — exercise the staple-cap path
  ['afrobeat', 'detroit_techno', 'minimalist'],
  ['fado', 'chanson_classique', 'angloSingerSong_cancion_iberica'],
];
console.error('\n[2] Multi-tradition blends:');
for (const ids of BLEND_PAIRS) {
  stats.blends++;
  // Skip blends referencing unknown traditions (keeps test resilient as catalog evolves)
  const unknown = ids.find((id) => !C.TRADITION_EXTRAS[id]);
  if (unknown) {
    if (VERBOSE) console.error(`  - skip blend [${ids.join(', ')}]: unknown tradition ${unknown}`);
    stats.total++;
    stats.ok++;
    continue;
  }
  smokeOne(`blend:${ids.join('+')}`, () => seedFromTradition(ids[0], ids.slice(1)));
}

// === 3. Axis-target seeding (different code path) ===
// Hits seedFromAxisTarget logic in recipe.js. We replicate that here so smoke
// is self-contained and doesn't shell out.
function seedFromAxisTarget(target) {
  const best = findClosestTraditionByAxis(target);
  return best ? seedFromTradition(best) : null;
}
const AXIS_TARGETS = [
  { harm: 0, density: 0, intensity: 0 }, // anodyne mid
  { harm: 2, density: 2, intensity: 2 }, // dense maximalist
  { harm: -2, density: -2, intensity: -2 }, // sparse minimalist
  { harm: 0, pitch: 2, ornament: 2, meter: 1 }, // pitch-elaborate / ornamental
  { harm: 1, density: 1, transmission: -2 }, // notated tradition
  { harm: -1, voice: 2, density: -2 }, // unaccompanied vocal
  { harm: 2, percussion: 2, intensity: 2, density: 2 }, // dense percussive max
  { meter: -2, cyclicity: 2 }, // free-meter cyclic
];
console.error('\n[3] Axis-target seeding:');
for (const target of AXIS_TARGETS) {
  stats.axisTargets++;
  const desc = Object.entries(target)
    .map(([k, v]) => `${k}:${v}`)
    .join(',');
  smokeOne(`axis:${desc}`, () => seedFromAxisTarget(target));
}

// === 4. HTML output: parseable JS ===
// The build_html step concatenates ~2300 lines of JS into the embedded data
// block. Verify the output is parseable — catches stray syntax or broken
// concatenation introduced by template edits.
console.error('\n[4] HTML JS parseability:');
const fs = require('fs');
const path = require('path');
const { HTML_OUT } = require('./_paths.js');
// Two candidate locations: (a) ../../codex.html — historical sibling-of-repo
// location preserved for backward compatibility; (b) the sandbox blessed
// output path from _paths.js. Whichever exists first wins.
const HTML_PATH_LEGACY = path.join(__dirname, '..', '..', 'codex.html');
let htmlPath = null;
for (const p of [HTML_PATH_LEGACY, HTML_OUT]) {
  if (fs.existsSync(p)) {
    htmlPath = p;
    break;
  }
}
stats.total++;
if (!htmlPath) {
  if (VERBOSE) console.error('  - skip: codex.html not built yet (run build_html first)');
  stats.ok++; // Not a failure if HTML not built — smoke runs before build_html in pipeline
} else {
  const html = fs.readFileSync(htmlPath, 'utf8');
  // Extract scripts and try parsing each via vm.Script
  const vm = require('vm');
  const scriptRe = /<script[^>]*>([\s\S]*?)<\/script>/g;
  let m,
    idx = 0;
  let allOk = true;
  while ((m = scriptRe.exec(html)) !== null) {
    idx++;
    const body = m[1];
    if (!body.trim()) continue;
    try {
      new vm.Script(body, { filename: `script-${idx}` });
    } catch (e) {
      fail(`html:script-${idx}`, `parse error: ${e.message.split('\n')[0]}`);
      allOk = false;
    }
  }
  if (allOk) ok('html:js-parseable');
}

// === 5. Recipe-stack ceiling enforcement ===
// Every tradition × {prose, tags, compact} format × default-canonical config
// must produce output ≤ 1000 chars. This is a Node-side reimplementation of
// the algorithm in src/app.js (search for
// "compileRecipeStack"). The duplication is deliberate — the browser version
// can't be invoked from Node, so if the two implementations drift, this check
// catches it via catalog-wide assertion failure.
//
// Algorithm (prose format):
//   Phase A — tight render: collapse shared env (tuning + room + chain) to
//             one summary line when all cards share env. Handles 53% of catalog.
//   Phase B — + drop T2 descriptors (single-card, frequency=1). Cumulative 94%.
//   Phase C — + drop T1 from longest-line tail with notice. Cumulative 100%.
//
// Tier classification is pure frequency-counting:
//   T1 Signature   = descriptor appears in 2+ cards
//   T2 Single-card = descriptor appears in exactly one card

console.error('\n[5] Recipe-stack ceiling:');

const STACK_CEILING = 1000;

// Recipe-stack renderer — the Node SSOT now lives in scripts/_recipe_stack.js
// (shared with the MCP connector via mcp/engine.js). compileStack(cards, format,
// ceiling) is the no-header dispatcher; aliased to the former local name so the
// section-5 budget call sites below are unchanged.
const { compileStack: compileRecipeStackNode } = require('./_recipe_stack.js');

function buildDefaultCardsForTradition(t) {
  if (!t || !t.instruments) return [];
  return t.instruments
    .map((iid) => {
      const inst = C.INSTRUMENTS.find((i) => i.id === iid);
      if (!inst) return null;
      const parts = {};
      for (const p of inst.parts || []) {
        const def = (p.variants || []).find((v) => v.default === true);
        if (def) parts[p.id] = def.id;
        else if (p.variants && p.variants.length) parts[p.id] = p.variants[0].id;
      }
      // Build a card with shared env from the tradition's tuning/room. Chain
      // is omitted (matches default-canonical state in UI before user edits).
      return {
        id: 'c_' + iid,
        instrumentId: iid,
        parts,
        tuning: t.tuning || null,
        room: t.room || null,
        chain: {
          fx: [],
          amp: null,
          mic: null,
          pre: null,
          comp: null,
          eq: null,
          medium: null,
          console: null,
        },
      };
    })
    .filter(Boolean);
}

const FORMATS = ['prose', 'tags', 'rich', 'compact'];
for (const t of C.TRADITIONS) {
  const cards = buildDefaultCardsForTradition(t);
  if (cards.length === 0) continue;
  for (const fmt of FORMATS) {
    stats.total++;
    let out;
    try {
      out = compileRecipeStackNode(cards, fmt, STACK_CEILING);
    } catch (e) {
      fail(`stack:${t.id}:${fmt}`, `threw: ${e.message}`);
      continue;
    }
    if (out.length > STACK_CEILING) {
      fail(`stack:${t.id}:${fmt}`, `${out.length} chars > ${STACK_CEILING}`);
      continue;
    }
    ok(`stack:${t.id}:${fmt}`);
  }
}

// === 5b. Multi-tradition stack ceiling enforcement ===
// Single-tradition stacks (section 5) tend to be small (5-15 cards). Real
// users compose stacks across multiple traditions and sometimes duplicate
// cards — these grow to 30-60+ cards and strain the ceiling enforcement
// differently. Section 5 caught a bug here in section 5b: tags-mode
// descriptor-trim was exhausting but the function returned the bare
// per-card labels concatenated, which at 39+ cards exceeded 1000 chars
// with no defensive fallback (Phase B env-drop / Phase C instrument-drop
// with notice / final truncate). This section asserts the ceiling holds
// at the realistic upper end of multi-tradition composition.

console.error('\n[5b] Multi-tradition stack ceiling:');

// Canonical scenarios — each composes cards across several traditions.
// The reported case is the first; the others bracket it.
const MULTI_TRAD_SCENARIOS = [
  {
    name: 'freak-folk + hindustani + honky-tonk + gnawa (~31 cards)',
    traditions: ['freak_folk_2000s', 'hindustani', 'honky_tonk', 'gnawa'],
  },
  {
    name: 'gospel × 4 (~30 cards)',
    traditions: [
      'pentecostal_gospel',
      'southern_gospel_quartet',
      'sacred_steel',
      'bluegrass_gospel',
    ],
  },
  {
    name: 'classical × 5 cross-region (~30 cards)',
    traditions: ['hindustani', 'persian_dastgah', 'turkish_makam', 'beijing_opera', 'wenrenyue'],
  },
  {
    name: 'rock-canon × 6 (~40 cards)',
    traditions: [
      'shoegaze',
      'post_punk',
      'hardcore_punk',
      'arena_rock',
      'krautrock',
      'noise_music',
    ],
  },
];

for (const scenario of MULTI_TRAD_SCENARIOS) {
  const cards = [];
  for (const tid of scenario.traditions) {
    const t = C.TRADITIONS.find((x) => x.id === tid);
    if (!t) continue;
    const built = buildDefaultCardsForTradition(t);
    for (const c of built) {
      c.id = `c_${tid}_${c.instrumentId}`;
      c.traditionId = tid;
      cards.push(c);
    }
  }
  if (cards.length === 0) continue;
  const scope = `multi:${scenario.traditions.join('+')}`;
  for (const fmt of FORMATS) {
    stats.total++;
    let out;
    try {
      out = compileRecipeStackNode(cards, fmt, STACK_CEILING);
    } catch (e) {
      fail(`${scope}:${fmt}`, `threw: ${e.message}`);
      continue;
    }
    if (out.length > STACK_CEILING) {
      fail(`${scope}:${fmt}`, `${out.length} chars > ${STACK_CEILING} (${cards.length} cards)`);
      continue;
    }
    ok(`${scope}:${fmt}`);
  }
}

// Pathological stress — every card duplicated. Verifies Phase C +
// defensive truncate hold under loads no real user would compose.
{
  const t1 = C.TRADITIONS.find((x) => x.id === 'freak_folk_2000s');
  const t2 = C.TRADITIONS.find((x) => x.id === 'hindustani');
  if (t1 && t2) {
    const base = [...buildDefaultCardsForTradition(t1), ...buildDefaultCardsForTradition(t2)];
    const stress = [
      ...base,
      ...base.map((c) => ({ ...c, id: c.id + '_dup', parts: { ...c.parts } })),
    ];
    stress.forEach((c, i) => {
      c.id = `stress_${i}`;
    });
    const scope = `stress:${stress.length}-cards`;
    for (const fmt of FORMATS) {
      stats.total++;
      let out;
      try {
        out = compileRecipeStackNode(stress, fmt, STACK_CEILING);
      } catch (e) {
        fail(`${scope}:${fmt}`, `threw: ${e.message}`);
        continue;
      }
      if (out.length > STACK_CEILING) {
        fail(`${scope}:${fmt}`, `${out.length} chars > ${STACK_CEILING}`);
        continue;
      }
      ok(`${scope}:${fmt}`);
    }
  }
}

// === Report ===
console.error('');
console.error(`smoke summary:`);
console.error(`  traditions:   ${stats.traditions}`);
console.error(`  blends:       ${stats.blends}`);
console.error(`  axis-targets: ${stats.axisTargets}`);
console.error(`  total:        ${stats.total}`);
console.error(`  ok:           ${stats.ok}`);
console.error(`  failed:       ${failures.length}`);

if (failures.length > 0) {
  console.error('\nFailures:');
  for (const f of failures.slice(0, 30)) {
    console.error(`  ✗ ${f.scope}: ${f.msg}`);
  }
  if (failures.length > 30) {
    console.error(`  ... +${failures.length - 30} more`);
  }
  process.exit(1);
}

console.error(`\nSMOKE: ${stats.ok}/${stats.total} pass.`);
process.exit(0);
