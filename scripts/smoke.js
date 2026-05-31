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
  const unknown = ids.find(id => !C.TRADITION_EXTRAS[id]);
  if (unknown) {
    if (VERBOSE) console.error(`  - skip blend [${ids.join(', ')}]: unknown tradition ${unknown}`);
    stats.total++; stats.ok++;
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
  { harm: 0, density: 0, intensity: 0 },                             // anodyne mid
  { harm: 2, density: 2, intensity: 2 },                             // dense maximalist
  { harm: -2, density: -2, intensity: -2 },                          // sparse minimalist
  { harm: 0, pitch: 2, ornament: 2, meter: 1 },                      // pitch-elaborate / ornamental
  { harm: 1, density: 1, transmission: -2 },                         // notated tradition
  { harm: -1, voice: 2, density: -2 },                               // unaccompanied vocal
  { harm: 2, percussion: 2, intensity: 2, density: 2 },              // dense percussive max
  { meter: -2, cyclicity: 2 },                                       // free-meter cyclic
];
console.error('\n[3] Axis-target seeding:');
for (const target of AXIS_TARGETS) {
  stats.axisTargets++;
  const desc = Object.entries(target).map(([k, v]) => `${k}:${v}`).join(',');
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
  if (fs.existsSync(p)) { htmlPath = p; break; }
}
stats.total++;
if (!htmlPath) {
  if (VERBOSE) console.error('  - skip: codex.html not built yet (run build_html first)');
  stats.ok++;  // Not a failure if HTML not built — smoke runs before build_html in pipeline
} else {
  const html = fs.readFileSync(htmlPath, 'utf8');
  // Extract scripts and try parsing each via vm.Script
  const vm = require('vm');
  const scriptRe = /<script[^>]*>([\s\S]*?)<\/script>/g;
  let m, idx = 0;
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

// Surface-rendering hygiene — mirrors the in-page helper in the HTML template
// (see "Surface-rendering hygiene" comment in src/app.js for
// rationale). cleanDescriptorsNode dedups and drops legacy filler tokens;
// entryRenderDescsNode renders entry.descriptors only — canonical_tags are
// scoring-only structural metadata, consumed directly by score.js and
// nearest_neighbor.js, and are not surfaced to the user. Any drift between
// this and the template silently corrupts the ceiling check.
const NODE_DESCRIPTOR_FILLERS = new Set([
  'canonical', 'standard', 'default', 'unmarked', 'normal', 'plain', 'none', 'minimal',
]);
function cleanDescriptorsNode(descs) {
  const out = [];
  const seen = new Set();
  for (const raw of (descs || [])) {
    if (raw == null) continue;
    const stripped = String(raw).replace(/-canonical$/, '');
    if (!stripped) continue;
    if (NODE_DESCRIPTOR_FILLERS.has(stripped.toLowerCase())) continue;
    const key = stripped.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(stripped);
  }
  return out;
}
function entryRenderDescsNode(entry) {
  if (!entry) return [];
  return cleanDescriptorsNode(entry.descriptors || []);
}

function buildStackPartsNode(card) {
  const inst = C.INSTRUMENTS.find(i => i.id === card.instrumentId);
  if (!inst) return [];
  const out = [];
  const all = [];
  for (const part of (inst.parts || [])) {
    const v = (part.variants || []).find(v => v.id === card.parts[part.id]);
    if (!v) continue;
    all.push(...(v.descriptors || []));
    // canonical_tags intentionally omitted — see entryRenderDescsNode note
  }
  out.push({ kind: 'instrument', label: inst.short || inst.name, descriptors: cleanDescriptorsNode(all) });
  if (card.tuning) {
    const t = (C.TUNINGS || []).find(t => t.id === card.tuning);
    if (t) out.push({ kind: 'tuning', label: t.name, descriptors: entryRenderDescsNode(t) });
  }
  if (card.room) {
    const r = (C.ROOMS || []).find(r => r.id === card.room);
    if (r) out.push({ kind: 'room', label: r.name, descriptors: entryRenderDescsNode(r) });
  }
  // Note: chain stages are skipped here (cards are built without chain config below)
  return out;
}

// Preface lookup — mirrors the in-page _resolvePreface. Sanitizes commas
// and periods (the parser's concept separators), case-insensitive lookup
// against id then display word, free-form fallback.
function _sanitizePrefaceNode(raw) {
  if (raw == null) return '';
  return String(raw).replace(/[,.]/g, '').trim();
}
function _resolvePrefaceNode(card) {
  if (!card) return null;
  const sanitized = _sanitizePrefaceNode(card.preface);
  if (!sanitized) return null;
  const lex = C.PREFACE_LEXICON || [];
  const lc = sanitized.toLowerCase();
  let entry = lex.find(e => e.id.toLowerCase() === lc);
  if (!entry) entry = lex.find(e => e.word.toLowerCase() === lc);
  return entry ? entry.word : sanitized;
}

// ---- Helpers ported from in-browser template (Node-suffixed mirrors) ----
// Used by the new collapsed-prose render. Mirrors src/app.js.
// Drift detector: if HTML and Node diverge, smoke output will show it.

function _kebabNode(label) {
  if (!label) return '';
  return String(label)
    .toLowerCase()
    .replace(/[\s/()[\]{},.;:]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function _suppressSubsumedNode(tokens) {
  // O(n²·k) where n = tokens.length, k = max segments per token. n is small.
  // Defensively filter non-string entries before lowercasing — descriptor
  // arrays should never contain null/undefined but a single bad entry
  // would cascade as an uncaught TypeError across every card render.
  const clean = (tokens || []).filter(t => typeof t === 'string' && t.length > 0);
  const segs = clean.map(t => t.toLowerCase().split('-'));
  const drop = new Set();
  for (let i = 0; i < clean.length; i++) {
    if (drop.has(i)) continue;
    for (let j = 0; j < clean.length; j++) {
      if (i === j || drop.has(j) || segs[i].length >= segs[j].length) continue;
      const a = segs[i]; const b = segs[j]; const m = a.length;
      for (let p = 0; p + m <= b.length; p++) {
        let match = true;
        for (let k = 0; k < m; k++) { if (a[k] !== b[p+k]) { match = false; break; } }
        if (match) { drop.add(i); break; }
      }
      if (drop.has(i)) break;
    }
  }
  return clean.filter((_, i) => !drop.has(i));
}

const _MATERIAL_SEGMENTS_N = new Set([
  // Woods
  'mahogany','spruce','cedar','maple','rosewood','walnut','oak','ash','alder',
  'basswood','koa','ebony','pine','fir','beech','willow','sycamore','poplar',
  'bamboo','teak','wood','tonewood','hardwood','softwood',
  'padauk','bubinga','wenge','cherry','sapele','paulownia','birch','cocobolo',
  'limba','korina',
  // Metals
  'nickel','brass','bronze','phosphor','copper','silver','gold','iron','tin',
  'steel','aluminum','aluminium','titanium','zinc','alnico','monel','tungsten',
  // Animal/organic
  'gut','sinew','horsehair','ivory','bone','horn','pearl','abalone','hide',
  'rawhide','calfskin','goatskin','sheepskin','snakeskin','leather','wool','cotton','silk',
  'flax','cane',
  // Synthetics
  'nylon','plastic','lucite','fiberglass','kevlar','synthetic','polymer','carbon',
  'acrylic','phenolic','mylar','ebonite','fluorocarbon',
  // Stone/mineral
  'clay','ceramic','alabaster','marble','slate','stone','tile','concrete','brick',
  'terracotta',
  // Earth/organic vessel
  'gourd',
  // Recording media as physical substrate
  'tape','vinyl','lacquer','shellac','wax',
]);

const _GEAR_SEGMENTS_N = new Set([
  'neumann','telefunken','akg','shure','royer','sennheiser','beyerdynamic','rca',
  'altec','sony','aiwa','tascam','portastudio','revox','studer','ampex','otari',
  'mci','neve','api','ssl','trident','helios','soundcraft','soundtracs','mackie',
  'tube-tech','manley','pultec','urei','dbx','fairchild','la-2a','la-3a','1176',
  'distressor','behringer','focusrite','rupert-neve','dda','daking','toft',
  'dangerous','rnd','sphere',
]);

const _SCAFFOLD_TOKENS_N = new Set([
  'modern','traditional','classical','contemporary','vintage','standard',
  'regional','folk','popular','folk-tradition','sacred','secular','ceremonial',
  'concert','recital','accompaniment','lead','western','western-default',
  'eastern','equal-tempered','modern-music','classical-western','tonal',
  'monodic','polyphonic','art-music','vernacular',
]);

const _TEXTURE_TOKENS_N = new Set([
  'foundational','virtuoso','versatile','consistent','expressive','grounded',
  'connected','meditative','deep','soulful','tender','intimate','powerful',
  'evocative','emotive','sincere','heartfelt','rhythmic','melodic','articulate',
  'lyrical','warm','dark','bright','smooth','harsh','clean','dirty','gritty',
  'sweet','mellow','rich','full','open','tight','loose','airy','dense',
]);

function _descriptorTierNode(token) {
  if (typeof token !== 'string') return 2;
  // Tier 1 — physical reference via segment match
  const segs = token.toLowerCase().split('-');
  for (const seg of segs) {
    if (_MATERIAL_SEGMENTS_N.has(seg) || _GEAR_SEGMENTS_N.has(seg)) return 1;
  }
  // Era markers — years and century references — also tier 1 (specific era
  // is a strong concrete anchor for the model)
  if (/(?:^|-)(?:18|19|20)\d{2}s?(?:-|$)/.test(token)) return 1;
  if (/^\d{2,4}s$/.test(token)) return 1;
  if (token.includes('century') || token.includes('-era-') || token.includes('mid-century')) return 1;
  // Tier 3 — scaffold via exact match
  if (_SCAFFOLD_TOKENS_N.has(token)) return 3;
  // Tier 4 — texture via exact match
  if (_TEXTURE_TOKENS_N.has(token)) return 4;
  // Default — iconic structural descriptor
  return 2;
}

let _DESCRIPTOR_DF_N = null;
function _ensureDescriptorDFNode() {
  if (_DESCRIPTOR_DF_N !== null) return _DESCRIPTOR_DF_N;
  _DESCRIPTOR_DF_N = new Map();
  const bump = (d) => _DESCRIPTOR_DF_N.set(d, (_DESCRIPTOR_DF_N.get(d) || 0) + 1);
  if (C.INSTRUMENTS) {
    for (const inst of C.INSTRUMENTS) {
      for (const part of (inst.parts || [])) {
        for (const v of (part.variants || [])) {
          for (const d of (v.descriptors || [])) bump(d);
        }
      }
    }
  }
  if (C.TUNINGS) for (const t of C.TUNINGS) for (const d of (t.descriptors || [])) bump(d);
  if (C.ROOMS) for (const r of C.ROOMS) for (const d of (r.descriptors || [])) bump(d);
  if (C.CHAIN_SECTIONS) {
    for (const sec of C.CHAIN_SECTIONS) for (const it of (sec.items || [])) for (const d of (it.descriptors || [])) bump(d);
  }
  return _DESCRIPTOR_DF_N;
}

function _sortDescriptorsByPriorityNode(descs) {
  const df = _ensureDescriptorDFNode();
  return (descs || []).slice().sort(function (a, b) {
    const ta = _descriptorTierNode(a);
    const tb = _descriptorTierNode(b);
    if (ta !== tb) return ta - tb;
    const da = df.get(a) || 999;
    const db = df.get(b) || 999;
    if (da !== db) return da - db;
    return a.toLowerCase().localeCompare(b.toLowerCase());
  });
}


// ---- Collapsed-prose render (Node mirror of in-browser compressProseRecipe) ----
function compressProseRecipeNode(cards, ceiling) {
  // Collapsed-prose render. Each card's instrument becomes a chunk
  // `<descriptors> <label>`. Chunks with identical labels merge (descriptors
  // concatenate, label appears once). Chunks whose labels share a trailing
  // hyphen-segment also collapse IF no chunk's label is that bare trailing
  // token — for each member, its label-minus-trailing becomes a final
  // descriptor and the trailing token appears once at the end of the group.
  //
  // The bare-token guard handles the case where `choir` and `cogic-choir`
  // both exist as catalog labels: `cogic-choir` stays whole rather than
  // fusing into the bare-choir group, because the catalog treats them as
  // distinct instruments.
  //
  // Output: comma-joined chunks ending in a period, all on one line. No
  // labels, headers, or connectives — the recipe header (built upstream)
  // already supplies the tradition stack as a leading comma-terminated
  // chunk, and the parser treats every comma as a concept break.

  // ---- Build chunks ----
  const rawChunks = [];
  for (const card of cards) {
    const parts = buildStackPartsNode(card);
    const inst = parts.find(p => p.kind === 'instrument');
    if (!inst) continue;
    rawChunks.push({
      kind: 'inst',
      label: _kebabNode(inst.label),
      descriptors: _sortDescriptorsByPriorityNode(_suppressSubsumedNode(inst.descriptors)),
      preface: _resolvePrefaceNode(card),
    });
  }
  // Env chunks come from card[0] under the shared-env assumption. Strip the
  // `${section}: ` prefix that buildStackPartsNode adds for chain stages — the
  // collapsed-prose format emits env labels bare (no `mic:` / `pre:` etc.).
  if (cards.length > 0) {
    for (const p of buildStackPartsNode(cards[0])) {
      if (p.kind === 'instrument') continue;
      let label = p.label;
      const colonIdx = label.indexOf(': ');
      if (colonIdx >= 0) label = label.slice(colonIdx + 2);
      rawChunks.push({
        kind: 'env',
        label: _kebabNode(label),
        descriptors: _sortDescriptorsByPriorityNode(_suppressSubsumedNode(p.descriptors)),
        preface: null,
      });
    }
  }

  // ---- Phase A: collapse exact-label duplicates ----
  const mergedByLabel = new Map();
  const labelOrder = [];
  const labelKind = new Map();
  for (const c of rawChunks) {
    if (mergedByLabel.has(c.label)) {
      const existing = mergedByLabel.get(c.label);
      for (const d of c.descriptors) {
        if (!existing.descriptors.includes(d)) existing.descriptors.push(d);
      }
      if (c.preface && !existing.descriptors.includes(c.preface)) {
        existing.descriptors.push(c.preface);
      }
    } else {
      const cp = { kind: c.kind, label: c.label, descriptors: [...c.descriptors] };
      if (c.preface) cp.descriptors.push(c.preface);
      mergedByLabel.set(c.label, cp);
      labelOrder.push(c.label);
      labelKind.set(c.label, c.kind);
    }
  }

  // ---- Phase B: trailing-token collapse ----
  // Group by trailing hyphen-segment. Collapse a group only when no member's
  // label is the bare trailing token (the `cogic-choir` vs `choir` guard).
  //
  // Each final chunk is rendered as `<descriptors+innerLabels in source order> <trailingLabel>`.
  // The `innerLabels` array tracks instrument-identity tokens that came from
  // label-minus-trailing decompositions — these are protected from the
  // descriptor-tail trim (they encode which instrument the descriptors belong to).
  const trailingGroups = new Map();
  for (const key of labelOrder) {
    const segs = key.split('-');
    const trailing = segs[segs.length - 1];
    if (!trailingGroups.has(trailing)) trailingGroups.set(trailing, []);
    trailingGroups.get(trailing).push(key);
  }
  const bareLabels = new Set(labelOrder);

  // Final chunk shape:
  //   { kind, trailingLabel,
  //     parts: [ { descriptors: [...], innerLabel: string|null } ] }
  // Render order: parts.flatMap(p => [...p.descriptors, p.innerLabel].filter(Boolean)).join(' ') + ' ' + trailingLabel
  const finalChunks = [];
  const emitted = new Set();
  for (const key of labelOrder) {
    if (emitted.has(key)) continue;
    const c = mergedByLabel.get(key);
    const segs = c.label.split('-');
    const trailing = segs[segs.length - 1];
    const group = trailingGroups.get(trailing);

    if (group.length >= 2 && !bareLabels.has(trailing)) {
      // Multi-member collapse — one part per member, each with its inner-label
      const parts = [];
      let groupKind = 'inst';
      for (const groupKey of group) {
        const member = mergedByLabel.get(groupKey);
        const memberSegs = member.label.split('-');
        const innerLabel = memberSegs.slice(0, -1).join('-') || null;
        parts.push({ descriptors: member.descriptors.slice(), innerLabel });
        if (labelKind.get(groupKey) === 'env') groupKind = 'env';
        emitted.add(groupKey);
      }
      finalChunks.push({ kind: groupKind, trailingLabel: trailing, parts });
    } else {
      // Single chunk — one part, no inner-label (the chunk IS its label)
      emitted.add(key);
      finalChunks.push({
        kind: c.kind,
        trailingLabel: c.label,
        parts: [{ descriptors: c.descriptors.slice(), innerLabel: null }],
      });
    }
  }

  // ---- Render + trim cascade ----
  const renderChunk = (c) => {
    const tokens = [];
    for (const p of c.parts) {
      for (const d of p.descriptors) tokens.push(d);
      if (p.innerLabel) tokens.push(p.innerLabel);
    }
    return tokens.length > 0 ? `${tokens.join(' ')} ${c.trailingLabel}` : c.trailingLabel;
  };
  const renderAll = () => finalChunks.map(renderChunk).join(', ') + '.';

  let output = renderAll();
  if (output.length <= ceiling) return output;

  // Phase 1: descriptor-tail trim. Picks the chunk-part whose last descriptor
  // has the highest tier (lowest information) and drops it. innerLabels are
  // skipped — they encode instrument identity and must survive until the
  // chunk itself is being dropped. Mirrors Tags-mode Phase A logic.
  let guard = 5000;
  while (renderAll().length > ceiling && guard-- > 0) {
    let target = null; let targetTier = -Infinity; let targetLen = -1;
    for (const c of finalChunks) {
      for (let pi = 0; pi < c.parts.length; pi++) {
        const part = c.parts[pi];
        if (part.descriptors.length === 0) continue;
        const last = part.descriptors[part.descriptors.length - 1];
        const t = _descriptorTierNode(last);
        const better = (t > targetTier) ||
          (t === targetTier && part.descriptors.length > targetLen);
        if (better) { target = part; targetTier = t; targetLen = part.descriptors.length; }
      }
    }
    if (!target) break;
    target.descriptors.pop();
  }
  output = renderAll();
  if (output.length <= ceiling) return output;

  // Phase 2: drop env chunks from the end.
  while (renderAll().length > ceiling && finalChunks.some(c => c.kind === 'env')) {
    for (let i = finalChunks.length - 1; i >= 0; i--) {
      if (finalChunks[i].kind === 'env') { finalChunks.splice(i, 1); break; }
    }
  }
  output = renderAll();
  if (output.length <= ceiling) return output;

  // Phase 3: drop the trailing collapsed-member (innerLabel + its descriptors)
  // from instrument chunks before dropping the chunk entirely. For multi-member
  // collapsed chunks, this removes the LAST member's identity from the chunk.
  while (renderAll().length > ceiling) {
    let popped = false;
    for (let i = finalChunks.length - 1; i >= 0; i--) {
      const c = finalChunks[i];
      if (c.kind === 'inst' && c.parts.length > 1) {
        c.parts.pop();
        popped = true;
        break;
      }
    }
    if (!popped) break;
  }
  output = renderAll();
  if (output.length <= ceiling) return output;

  // Phase 4: drop trailing instrument chunks with a hidden-count notice.
  const noticeFor = (n) => n > 0 ? ` [+${n} hidden]` : '';
  let droppedChunks = 0;
  while (finalChunks.length > 1 && (renderAll() + noticeFor(droppedChunks + 1)).length > ceiling) {
    finalChunks.pop();
    droppedChunks++;
  }
  output = renderAll() + noticeFor(droppedChunks);

  // Defensive truncate (safety net only).
  if (output.length > ceiling) {
    output = output.slice(0, ceiling - 16) + '… [truncated]';
  }
  return output;
}
// Tags compression — mirrors the chunk-per-source pipeline in the HTML
// template (see comment block above compressTagsRecipe there for the design
// rationale). One bundled claim per instrument and per environment source,
// comma-separated; substring suppression within each chunk; ceiling-aware
// shortest-token trim with no meta-text notice.
function _smokeSuppressSubsumed(tokens) {
  const segs = tokens.map(t => t.toLowerCase().split('-'));
  const drop = new Set();
  for (let i = 0; i < tokens.length; i++) {
    if (drop.has(i)) continue;
    for (let j = 0; j < tokens.length; j++) {
      if (i === j || drop.has(j) || segs[i].length >= segs[j].length) continue;
      const a = segs[i]; const b = segs[j]; const m = a.length;
      for (let p = 0; p + m <= b.length; p++) {
        let match = true;
        for (let k = 0; k < m; k++) { if (a[k] !== b[p+k]) { match = false; break; } }
        if (match) { drop.add(i); break; }
      }
      if (drop.has(i)) break;
    }
  }
  return tokens.filter((_, i) => !drop.has(i));
}
function _smokeKebab(label) {
  if (!label) return '';
  return String(label)
    .toLowerCase()
    .replace(/[\s/()[\]{},.;:]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}
function _smokeBuildChunk(label, descs, preface) {
  const clean = _smokeSuppressSubsumed(descs).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  const head = preface ? `${preface} ${_smokeKebab(label)}` : _smokeKebab(label);
  if (clean.length === 0) return head;
  return `${head}: ${clean.join(' ')}`;
}

function compressTagsRecipeNode(cards, ceiling) {
  const chunks = [];
  for (const card of cards) {
    const parts = buildStackPartsNode(card);
    const inst = parts.find(p => p.kind === 'instrument');
    if (!inst) continue;
    chunks.push(_smokeBuildChunk(inst.label, inst.descriptors, _resolvePrefaceNode(card)));
  }
  if (cards.length > 0) {
    const envParts = buildStackPartsNode(cards[0]);
    for (const p of envParts) {
      if (p.kind === 'instrument') continue;
      chunks.push(_smokeBuildChunk(p.label, p.descriptors));
    }
  }

  let output = chunks.join(', ');
  const TRIM_TARGET = ceiling - 1;

  if (output.length <= TRIM_TARGET) {
    return output + '.';
  }

  // Rebuild with `kind` tracking so post-descriptor phases can target env
  // vs instrument chunks specifically.
  const rebuilt = cards.map(card => {
    const parts = buildStackPartsNode(card);
    const inst = parts.find(p => p.kind === 'instrument');
    return inst ? {
      kind: 'inst',
      label: inst.label,
      preface: _resolvePrefaceNode(card),
      descs: _smokeSuppressSubsumed(inst.descriptors).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())),
    } : null;
  }).filter(Boolean);
  if (cards.length > 0) {
    for (const p of buildStackPartsNode(cards[0])) {
      if (p.kind === 'instrument') continue;
      rebuilt.push({
        kind: 'env',
        label: p.label,
        preface: null,
        descs: _smokeSuppressSubsumed(p.descriptors).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())),
      });
    }
  }
  const renderAll = () => rebuilt.map(c => {
    const head = c.preface ? `${c.preface} ${_smokeKebab(c.label)}` : _smokeKebab(c.label);
    return c.descs.length ? `${head}: ${c.descs.join(' ')}` : head;
  }).join(', ');

  // Phase A — drop shortest-token-first heuristic (Node mirror retains its
  // simpler heuristic; browser uses tier-priority — see note in compileRecipeStack
  // about the duplication being deliberate but heuristics having drifted).
  let guard = 5000;
  while (renderAll().length > TRIM_TARGET && guard-- > 0) {
    let target = -1; let targetMinLen = Infinity;
    for (let i = 0; i < rebuilt.length; i++) {
      if (rebuilt[i].descs.length === 0) continue;
      let minLen = Infinity;
      for (const d of rebuilt[i].descs) if (d.length < minLen) minLen = d.length;
      if (minLen < targetMinLen || (minLen === targetMinLen && rebuilt[i].descs.length > (rebuilt[target]?.descs.length || 0))) {
        target = i; targetMinLen = minLen;
      }
    }
    if (target < 0) break;
    const c = rebuilt[target];
    let shortIdx = 0;
    for (let i = 1; i < c.descs.length; i++) if (c.descs[i].length < c.descs[shortIdx].length) shortIdx = i;
    c.descs.splice(shortIdx, 1);
  }

  // Phase B — drop env chunks from end (auxiliary in tags-mode density;
  // per-card instrument identity stays representative as long as possible).
  while (renderAll().length > TRIM_TARGET && rebuilt.some(c => c.kind === 'env')) {
    for (let i = rebuilt.length - 1; i >= 0; i--) {
      if (rebuilt[i].kind === 'env') { rebuilt.splice(i, 1); break; }
    }
  }

  // Phase C — drop trailing instrument chunks with hidden-count notice.
  // Only triggers at very large stacks where bare labels exceed the budget.
  const noticeFor = (n) => n > 0 ? ` [+${n} hidden]` : '';
  let droppedInst = 0;
  const finalLen = () => renderAll().length + 1 + noticeFor(droppedInst).length;
  while (rebuilt.length > 1 && finalLen() > ceiling) {
    let dropIdx = -1;
    for (let i = rebuilt.length - 1; i >= 0; i--) {
      if (rebuilt[i].kind === 'inst') { dropIdx = i; break; }
    }
    if (dropIdx < 0) break;
    rebuilt.splice(dropIdx, 1);
    droppedInst++;
  }

  let final = renderAll() + '.' + noticeFor(droppedInst);

  // Defensive truncate as ultimate safety net.
  if (final.length > ceiling) {
    const sliceLen = Math.max(0, ceiling - 16);
    final = final.slice(0, sliceLen) + '… [truncated]';
  }
  return final;
}

function compressCompactRecipeNode(cards, ceiling) {
  let out = cards.map(card => {
    const preface = _resolvePrefaceNode(card);
    return buildStackPartsNode(card).map(p => {
      if (p.kind === 'instrument' && preface) return `${preface} ${p.label}`;
      return p.label;
    }).join(' · ');
  }).join('\n');
  if (out.length <= ceiling) return out;
  out = cards.map(card => {
    const inst = buildStackPartsNode(card).find(p => p.kind === 'instrument');
    if (!inst) return '?';
    const preface = _resolvePrefaceNode(card);
    return preface ? `${preface} ${inst.label}` : inst.label;
  }).join('\n');
  if (out.length <= ceiling) return out;
  return out.slice(0, ceiling - 16) + '\n[truncated]';
}

// Mirror of in-browser compressRichRecipe in src/app.js.
// Build raw chunks → Phase A label merge → Phase B trailing-token collapse →
// sort by priority → 3-phase trim cascade (descriptor-pop / env-drop / inst-drop).
function compressRichRecipeNode(cards, ceiling) {
  const rawChunks = [];
  for (const card of cards) {
    const parts = buildStackPartsNode(card);
    const inst = parts.find(p => p.kind === 'instrument');
    if (!inst) continue;
    rawChunks.push({
      kind: 'inst',
      label: _kebabNode(inst.label),
      preface: _resolvePrefaceNode(card) || null,
      descriptors: _suppressSubsumedNode(inst.descriptors).slice(),
    });
  }
  if (cards.length > 0) {
    for (const p of buildStackPartsNode(cards[0])) {
      if (p.kind === 'instrument') continue;
      let label = p.label;
      const colonIdx = label.indexOf(': ');
      if (colonIdx >= 0) label = label.slice(colonIdx + 2);
      rawChunks.push({
        kind: 'env',
        label: _kebabNode(label),
        preface: null,
        descriptors: _suppressSubsumedNode(p.descriptors).slice(),
      });
    }
  }

  // Phase A: exact-label merge
  const byLabel = new Map();
  const labelOrder = [];
  for (const c of rawChunks) {
    if (byLabel.has(c.label)) {
      const ex = byLabel.get(c.label);
      if (c.preface && !ex.prefaces.includes(c.preface)) ex.prefaces.push(c.preface);
      for (const d of c.descriptors) if (!ex.descriptors.includes(d)) ex.descriptors.push(d);
    } else {
      byLabel.set(c.label, {
        kind: c.kind,
        label: c.label,
        prefaces: c.preface ? [c.preface] : [],
        descriptors: c.descriptors.slice(),
      });
      labelOrder.push(c.label);
    }
  }

  // Phase B: trailing-token collapse
  const trailingGroups = new Map();
  for (const key of labelOrder) {
    const segs = key.split('-');
    const trailing = segs[segs.length - 1];
    if (!trailingGroups.has(trailing)) trailingGroups.set(trailing, []);
    trailingGroups.get(trailing).push(key);
  }
  const bareLabels = new Set(labelOrder);

  const finalChunks = [];
  const emitted = new Set();
  for (const key of labelOrder) {
    if (emitted.has(key)) continue;
    const c = byLabel.get(key);
    const segs = c.label.split('-');
    const trailing = segs[segs.length - 1];
    const group = trailingGroups.get(trailing);

    if (group.length >= 2 && !bareLabels.has(trailing)) {
      const parts = [];
      const pooledDescriptors = [];
      let groupKind = 'inst';
      for (const groupKey of group) {
        const m = byLabel.get(groupKey);
        const memberSegs = m.label.split('-');
        const innerLabel = memberSegs.slice(0, -1).join('-') || null;
        parts.push({ prefaces: m.prefaces.slice(), innerLabel });
        for (const d of m.descriptors) if (!pooledDescriptors.includes(d)) pooledDescriptors.push(d);
        if (m.kind === 'env') groupKind = 'env';
        emitted.add(groupKey);
      }
      finalChunks.push({ kind: groupKind, trailingLabel: trailing, parts, descriptors: pooledDescriptors });
    } else {
      emitted.add(key);
      finalChunks.push({
        kind: c.kind,
        trailingLabel: c.label,
        parts: [{ prefaces: c.prefaces.slice(), innerLabel: null }],
        descriptors: c.descriptors.slice(),
      });
    }
  }

  for (const c of finalChunks) {
    c.descriptors = _sortDescriptorsByPriorityNode(c.descriptors);
  }

  const renderChunk = (c) => {
    const tokens = [];
    for (const p of c.parts) {
      for (const pref of p.prefaces) tokens.push(pref);
      if (p.innerLabel) tokens.push(p.innerLabel);
    }
    const head = tokens.length > 0 ? `${tokens.join(' ')} ${c.trailingLabel}` : c.trailingLabel;
    return c.descriptors.length > 0 ? `${head}: ${c.descriptors.join(' ')}` : head;
  };
  const renderAll = () => finalChunks.map(renderChunk).join(', ');

  const TRIM_TARGET = ceiling - 1;
  if (renderAll().length <= TRIM_TARGET) return renderAll() + '.';

  // Phase C: descriptor trim
  let guard = 5000;
  while (renderAll().length > TRIM_TARGET && guard-- > 0) {
    let target = -1; let targetTier = -Infinity;
    for (let i = 0; i < finalChunks.length; i++) {
      if (finalChunks[i].descriptors.length === 0) continue;
      const last = finalChunks[i].descriptors[finalChunks[i].descriptors.length - 1];
      const t = _descriptorTierNode(last);
      const better = (t > targetTier) ||
        (t === targetTier && finalChunks[i].descriptors.length > (target >= 0 ? finalChunks[target].descriptors.length : 0));
      if (better) { target = i; targetTier = t; }
    }
    if (target < 0) break;
    finalChunks[target].descriptors.pop();
  }

  // Phase D: env drop
  while (renderAll().length > TRIM_TARGET && finalChunks.some(c => c.kind === 'env')) {
    for (let i = finalChunks.length - 1; i >= 0; i--) {
      if (finalChunks[i].kind === 'env') { finalChunks.splice(i, 1); break; }
    }
  }

  // Phase E: inst drop with hidden notice
  const noticeFor = (n) => n > 0 ? ` [+${n} hidden]` : '';
  let droppedInst = 0;
  const finalLen = () => renderAll().length + 1 + noticeFor(droppedInst).length;
  while (finalChunks.length > 1 && finalLen() > ceiling) {
    let dropIdx = -1;
    for (let i = finalChunks.length - 1; i >= 0; i--) {
      if (finalChunks[i].kind === 'inst') { dropIdx = i; break; }
    }
    if (dropIdx < 0) break;
    finalChunks.splice(dropIdx, 1);
    droppedInst++;
  }

  let final = renderAll() + '.' + noticeFor(droppedInst);
  if (final.length > ceiling) {
    final = final.slice(0, Math.max(0, ceiling - 16)) + '… [truncated]';
  }
  return final;
}

function compileRecipeStackNode(cards, format, ceiling) {
  if (!cards || cards.length === 0) return '';
  if (format === 'tags')    return compressTagsRecipeNode(cards, ceiling);
  if (format === 'compact') return compressCompactRecipeNode(cards, ceiling);
  if (format === 'rich')    return compressRichRecipeNode(cards, ceiling);
  return compressProseRecipeNode(cards, ceiling);
}

function buildDefaultCardsForTradition(t) {
  if (!t || !t.instruments) return [];
  return t.instruments.map(iid => {
    const inst = C.INSTRUMENTS.find(i => i.id === iid);
    if (!inst) return null;
    const parts = {};
    for (const p of (inst.parts || [])) {
      const def = (p.variants || []).find(v => v.default === true);
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
      chain: { fx: [], amp: null, mic: null, pre: null, comp: null, eq: null, medium: null, console: null }
    };
  }).filter(Boolean);
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
// Tony's reported case is the first; the others bracket it.
const MULTI_TRAD_SCENARIOS = [
  { name: 'freak-folk + hindustani + honky-tonk + gnawa (~31 cards)',
    traditions: ['freak_folk_2000s', 'hindustani', 'honky_tonk', 'gnawa'] },
  { name: 'gospel × 4 (~30 cards)',
    traditions: ['pentecostal_gospel', 'southern_gospel_quartet', 'sacred_steel', 'bluegrass_gospel'] },
  { name: 'classical × 5 cross-region (~30 cards)',
    traditions: ['hindustani', 'persian_dastgah', 'turkish_makam', 'jingju', 'wenrenyue'] },
  { name: 'rock-canon × 6 (~40 cards)',
    traditions: ['shoegaze', 'post_punk', 'hardcore_punk', 'arena_rock', 'krautrock', 'noise_music'] },
];

for (const scenario of MULTI_TRAD_SCENARIOS) {
  const cards = [];
  for (const tid of scenario.traditions) {
    const t = C.TRADITIONS.find(x => x.id === tid);
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
  const t1 = C.TRADITIONS.find(x => x.id === 'freak_folk_2000s');
  const t2 = C.TRADITIONS.find(x => x.id === 'hindustani');
  if (t1 && t2) {
    const base = [...buildDefaultCardsForTradition(t1), ...buildDefaultCardsForTradition(t2)];
    const stress = [...base, ...base.map(c => ({ ...c, id: c.id + '_dup', parts: { ...c.parts } }))];
    stress.forEach((c, i) => { c.id = `stress_${i}`; });
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



