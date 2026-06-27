#!/usr/bin/env node
// stack.js — compilation viewer for a compiled configuration.
//
// Two modes show the full descriptor material that a recipe was distilled from:
//
//   --mode=stack  (default) — Layered dump. Every descriptor from every layer
//     (tradition, room, archetype, aesthetic, each picked instrument variant,
//     each chain item, each fx item) shown grouped by its source. Use this
//     when authoring or auditing — you see exactly what's contributing where.
//
//   --mode=cloud — Merged weighted bag. All descriptors collapsed into a single
//     map (token → accumulated weight + source list), sorted by weight. Shows
//     the gravity centers of the configuration: which descriptors dominate,
//     which appear in only one layer, which span many. Use this to ask "is
//     this configuration coherent?"
//
// This is uncapped — the 1000-character recipe ceiling does NOT apply.
//
// USAGE
//   node scripts/stack.js --tradition=<id>
//   node scripts/stack.js --tradition=<id> --staples=<id1>,<id2>
//   node scripts/stack.js --tradition=<id> --mode=cloud
//   node scripts/stack.js --tradition=<id> --mode=cloud --top=50
//   node scripts/stack.js --tradition=<id> --mode=stack --no-instruments  # skip per-variant dump
//
// EXIT
//   0 — clean
//   2 — bad arguments

const C = require('./_loader.js');
const { seedFromTradition } = require('./search.js');

const args = process.argv.slice(2);
const flags = {};
// Accept both --flag=value and --flag value (the latter previously became
// flags.flag === true, then failed downstream as "Unknown tradition: true").
// BOOLEAN_FLAGS never consume the next token.
const BOOLEAN_FLAGS = new Set(['no-instruments']);
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (!a.startsWith('--')) continue;
  const eq = a.indexOf('=');
  if (eq > 0) {
    flags[a.slice(2, eq)] = a.slice(eq + 1);
    continue;
  }
  const name = a.slice(2);
  const next = args[i + 1];
  if (!BOOLEAN_FLAGS.has(name) && next !== undefined && !next.startsWith('--')) {
    flags[name] = next;
    i++;
  } else flags[name] = true;
}

if (!flags.tradition) {
  console.error(
    'Usage: stack.js --tradition=<id> [--staples=id1,id2] [--mode=stack|cloud] [--top=N] [--no-instruments]'
  );
  process.exit(2);
}

const tid = flags.tradition;
const staples = flags.staples
  ? flags.staples
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  : [];
// Validate staple ids up front — seedFromTradition silently drops an unknown
// staple, so a typo would otherwise vanish while the header still claims it.
const _tradIds = new Set(C.TRADITIONS.map((t) => t.id));
const _badStaples = staples.filter((s) => !_tradIds.has(s));
if (_badStaples.length) {
  console.error(`Unknown staple tradition id(s): ${_badStaples.join(', ')}`);
  process.exit(2);
}
const mode = flags.mode || 'stack';
const topN = parseInt(flags.top) || 50;
const showInstruments = !flags['no-instruments'];

if (!['stack', 'cloud'].includes(mode)) {
  console.error(`Unknown --mode='${mode}'. Use 'stack' or 'cloud'.`);
  process.exit(2);
}

const seed = seedFromTradition(tid, staples);
if (!seed) {
  console.error(`Unknown tradition: ${tid}`);
  process.exit(2);
}

// ─────────────── Harvesters ───────────────
// Each harvester returns a list of {token, weight, source} contributions.
// `token` is a single lowercase word; multi-word descriptors are split AND
// also kept as a hyphenated full form (so both 'lo-fi' and 'lo' + 'fi' surface).

function tokenize(s) {
  if (!s) return [];
  // Keep hyphenated compound as ONE token AND split components for cloud aggregation.
  // Post canonical-suffix → canonical_tags refactor, descriptors no longer contain
  // '-canonical' suffixes — that filtering moved into the data layer. canonical_tags
  // are harvested separately by callers; this function operates on regular descriptors.
  const result = new Set();
  const lc = String(s).toLowerCase();
  for (const tok of lc.split(/[\s,.()/]+/)) {
    if (tok && tok.length > 2) result.add(tok);
  }
  for (const tok of lc.split(/[\s\-_,.()/]+/)) {
    if (tok && tok.length > 2) result.add(tok);
  }
  return [...result];
}

function harvestTradition(tradId, weightScale = 1.0) {
  const t = C.TRADITIONS.find((x) => x.id === tradId);
  if (!t) return [];
  const e = C.TRADITION_EXTRAS[tradId] || {};
  const out = [];
  const layer = `tradition:${tradId}`;
  // name + lineage at weight 1.0
  for (const tok of tokenize(t.name + ' ' + (t.lineage || ''))) {
    out.push({ token: tok, weight: 1.0 * weightScale, source: `${layer}.name` });
  }
  // family at 1.0
  if (t.family) {
    for (const tok of tokenize(t.family)) {
      out.push({ token: tok, weight: 1.0 * weightScale, source: `${layer}.family` });
    }
  }
  // parent at 1.5 — split camelCase too (groovePercussion → groove + percussion)
  if (e.parent) {
    const parts = e.parent.split('.').flatMap((s) =>
      s
        .replace(/([A-Z])/g, ' $1')
        .toLowerCase()
        .split(/\s+/)
    );
    for (const tok of parts) {
      if (tok && tok.length > 2)
        out.push({ token: tok, weight: 1.5 * weightScale, source: `${layer}.parent` });
    }
  }
  // crossRefs at 0.7 (entries are strings OR {ref,...} objects — normalize first)
  for (const cr of e.crossRefs || []) {
    const ref = cr && typeof cr === 'object' ? cr.ref : cr;
    if (!ref) continue;
    const parts = ref.split('.').flatMap((s) =>
      s
        .replace(/([A-Z])/g, ' $1')
        .toLowerCase()
        .split(/\s+/)
    );
    for (const tok of parts) {
      if (tok && tok.length > 2)
        out.push({ token: tok, weight: 0.7 * weightScale, source: `${layer}.crossref` });
    }
  }
  // description at 0.3
  for (const tok of tokenize(e.description || '')) {
    out.push({ token: tok, weight: 0.3 * weightScale, source: `${layer}.desc` });
  }
  return out;
}

function harvestRoom(roomId) {
  if (!roomId) return [];
  const r = C.ROOMS.find((x) => x.id === roomId);
  if (!r) return [];
  const out = [];
  const layer = `room:${roomId}`;
  // Rooms contribute region/era/scale/descriptors only — genre comes from
  // the tradition itself, not the recording room.
  if (r.region)
    for (const tok of tokenize(r.region))
      out.push({ token: tok, weight: 1.0, source: `${layer}.region` });
  if (r.era)
    for (const tok of tokenize(r.era))
      out.push({ token: tok, weight: 0.8, source: `${layer}.era` });
  if (r.scale_tier)
    for (const tok of tokenize(r.scale_tier))
      out.push({ token: tok, weight: 0.8, source: `${layer}.scale_tier` });
  for (const d of r.descriptors || []) {
    for (const tok of tokenize(d))
      out.push({ token: tok, weight: 0.7, source: `${layer}.descriptor` });
  }
  for (const ct of r.canonical_tags || []) {
    for (const tok of tokenize(ct))
      out.push({ token: tok, weight: 0.7, source: `${layer}.canonical` });
  }
  return out;
}

function harvestArchetype(archId) {
  if (!archId) return [];
  const a = C.CHAIN_ARCHETYPES.find((x) => x.id === archId);
  if (!a) return [];
  const out = [];
  const layer = `archetype:${archId}`;
  // Archetypes contribute region/era/scale only — they are gear-and-workflow
  // patterns, not genre classifiers.
  if (a.region)
    for (const tok of tokenize(a.region))
      out.push({ token: tok, weight: 1.0, source: `${layer}.region` });
  if (a.era)
    for (const tok of tokenize(a.era))
      out.push({ token: tok, weight: 0.8, source: `${layer}.era` });
  if (a.scale_tier)
    for (const tok of tokenize(a.scale_tier))
      out.push({ token: tok, weight: 0.8, source: `${layer}.scale_tier` });
  return out;
}

function harvestAesthetic(aestheticId) {
  if (!aestheticId) return [];
  const ae = (C.PRODUCTION_AESTHETICS || []).find((x) => x.id === aestheticId);
  if (!ae) return [];
  const out = [];
  const layer = `aesthetic:${aestheticId}`;
  for (const tk of ae.characteristic_techniques || []) {
    for (const tok of tokenize(tk))
      out.push({ token: tok, weight: 1.0, source: `${layer}.technique` });
  }
  if (ae.production_locus) {
    for (const tok of tokenize(ae.production_locus))
      out.push({ token: tok, weight: 0.7, source: `${layer}.locus` });
  }
  return out;
}

function harvestChainItem(sectionId, itemId) {
  if (!itemId) return [];
  const sec = C.CHAIN_SECTIONS.find((x) => x.id === sectionId);
  if (!sec) return [];
  const item = (sec.items || []).find((x) => x.id === itemId);
  if (!item) return [];
  const out = [];
  const layer = `chain:${sectionId}:${itemId}`;
  for (const d of item.descriptors || []) {
    for (const tok of tokenize(d))
      out.push({ token: tok, weight: 1.0, source: `${layer}.descriptor` });
  }
  for (const ct of item.canonical_tags || []) {
    for (const tok of tokenize(ct))
      out.push({ token: tok, weight: 1.0, source: `${layer}.canonical` });
  }
  return out;
}

function harvestInstrument(instSlot) {
  // instSlot = { id, slots: { part_id: variant_id, ... }, scores: { ... } }
  const inst = C.INSTRUMENTS.find((x) => x.id === instSlot.id);
  if (!inst) return [];
  const out = [];
  const layer = `instrument:${instSlot.id}`;
  for (const partId of Object.keys(instSlot.slots || {})) {
    const variantId = instSlot.slots[partId];
    if (!variantId) continue;
    const part = (inst.parts || []).find((p) => p.id === partId);
    if (!part) continue;
    const variant = (part.variants || []).find((v) => v.id === variantId);
    if (!variant) continue;
    const fromFamily = part._fromFamily ? '.family' : '.own';
    for (const d of variant.descriptors || []) {
      for (const tok of tokenize(d)) {
        out.push({
          token: tok,
          weight: 1.0,
          source: `${layer}${fromFamily}.${partId}=${variantId}`,
        });
      }
    }
    // canonical_tags: structural genre claims (post-refactor; replaces the old
    // '-canonical' suffix in descriptors). Tokenized identically.
    for (const ct of variant.canonical_tags || []) {
      for (const tok of tokenize(ct)) {
        out.push({
          token: tok,
          weight: 1.0,
          source: `${layer}${fromFamily}.${partId}=${variantId}.canonical`,
        });
      }
    }
  }
  return out;
}

// ─────────────── Build the full bag ───────────────

function buildBag(seed) {
  const bag = [];
  // Tradition layer (primary at 1.0, staples at 0.5)
  bag.push(...harvestTradition(seed.traditions[0], 1.0));
  for (let i = 1; i < (seed.traditions || []).length; i++) {
    bag.push(...harvestTradition(seed.traditions[i], 0.5));
  }
  // Room
  bag.push(...harvestRoom(seed.room));
  // Archetype (when present)
  if (seed.archetype) bag.push(...harvestArchetype(seed.archetype));
  // Aesthetic (when present)
  if (seed.aesthetic) bag.push(...harvestAesthetic(seed.aesthetic));
  // Chain components — match the ENGINE (translate.js / scoreConfig): when an
  // archetype is set, ITS components are used wholesale and inline_chain is
  // ignored; inline_chain only applies as the fallback for traditions WITHOUT an
  // archetype. (The old inline-overrides-archetype merge here disagreed with the
  // compiled recipe, so this viewer attributed the wrong gear for any tradition
  // that carries both.)
  const arch = seed.archetype && C.CHAIN_ARCHETYPES.find((a) => a.id === seed.archetype);
  const archComponents = (arch && arch.components) || {};
  const chain = arch ? archComponents : seed.inline_chain || {};
  for (const sectionId of ['mic', 'pre', 'console', 'comp', 'eq', 'medium', 'amp']) {
    const itemId = chain[sectionId];
    if (itemId) bag.push(...harvestChainItem(sectionId, itemId));
  }
  // FX — archetype components.fx is canonical; seed.fx_extras is additive
  const fxList = [...(chain.fx || []), ...(seed.fx_extras || [])];
  for (const fxId of fxList) {
    bag.push(...harvestChainItem('fx', fxId));
  }
  // Instruments
  for (const instSlot of seed.instruments || []) {
    bag.push(...harvestInstrument(instSlot));
  }
  return { bag, chain, arch };
}

const { bag, chain } = buildBag(seed);

// ─────────────── HEADER ───────────────

const t = C.TRADITIONS.find((x) => x.id === tid);
const e = C.TRADITION_EXTRAS[tid] || {};

console.log(`╔════════════════════════════════════════════════════════════════════════════`);
console.log(`║ STACK: ${t.name} (${tid})  [mode=${mode}]`);
if (staples.length) console.log(`║ STAPLED: ${staples.join(', ')}`);
console.log(`║ parent: ${e.parent || '(none)'}`);
console.log(
  `║ crossRefs: ${(e.crossRefs || []).map((cr) => (cr && typeof cr === 'object' ? cr.ref : cr)).join(', ') || '(none)'}`
);
console.log(
  `║ room: ${seed.room || '(none)'}    archetype: ${seed.archetype || '(inline)'}    aesthetic: ${seed.aesthetic || '(none)'}`
);
const chainStr = ['mic', 'pre', 'console', 'comp', 'eq', 'medium']
  .filter((k) => chain[k])
  .map((k) => `${k}=${chain[k]}`)
  .join(' ');
console.log(`║ chain: ${chainStr || '(none)'}`);
const fxStr = (chain.fx || seed.fx_extras || []).join(', ');
if (fxStr) console.log(`║ fx: ${fxStr}`);
console.log(`║ instruments: ${(seed.instruments || []).map((i) => i.id).join(', ')}`);
console.log(`╚════════════════════════════════════════════════════════════════════════════\n`);

// ─────────────── STACK MODE ───────────────

if (mode === 'stack') {
  // Group bag by source layer (everything before the first colon's tail)
  const byLayer = {};
  for (const c of bag) {
    // Layer key = first segment (e.g. "tradition:afrobeat", "room:live_room")
    const layerKey = c.source.split('.')[0];
    if (!byLayer[layerKey]) byLayer[layerKey] = [];
    byLayer[layerKey].push(c);
  }

  // Layer-print order
  const layerOrder = Object.keys(byLayer).sort((a, b) => {
    const order = ['tradition:', 'room:', 'archetype:', 'aesthetic:', 'chain:', 'instrument:'];
    const ai = order.findIndex((p) => a.startsWith(p));
    const bi = order.findIndex((p) => b.startsWith(p));
    return ai - bi || a.localeCompare(b);
  });

  for (const layerKey of layerOrder) {
    if (!showInstruments && layerKey.startsWith('instrument:')) continue;
    const contribs = byLayer[layerKey];
    console.log(`── ${layerKey}  (${contribs.length} contributions)`);

    // Group within layer by source-suffix
    const bySource = {};
    for (const c of contribs) {
      if (!bySource[c.source]) bySource[c.source] = [];
      bySource[c.source].push(c);
    }
    for (const src of Object.keys(bySource).sort()) {
      const items = bySource[src];
      // Show source label without redundant layerKey prefix
      const srcLabel = src.replace(layerKey + '.', '').replace(layerKey, '');
      const tokens = items.map((i) => i.token);
      const weight = items[0].weight;
      // Dedupe tokens for display
      const uniq = [...new Set(tokens)];
      console.log(`    [${weight.toFixed(2)}] ${srcLabel}`);
      console.log(`         ${uniq.join(', ')}`);
    }
    console.log('');
  }

  // Summary stats
  console.log(`── SUMMARY ──`);
  const uniqueTokens = new Set(bag.map((c) => c.token));
  console.log(`  ${bag.length} total contributions, ${uniqueTokens.size} unique tokens`);
  // Total weight per layer
  const layerWeights = {};
  for (const c of bag) {
    const layerKey = c.source.split('.')[0];
    layerWeights[layerKey] = (layerWeights[layerKey] || 0) + c.weight;
  }
  for (const [k, w] of Object.entries(layerWeights).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${w.toFixed(1).padStart(7)}  ${k}`);
  }
}

// ─────────────── CLOUD MODE ───────────────

if (mode === 'cloud') {
  // Aggregate by token
  const tokenMap = {};
  for (const c of bag) {
    if (!tokenMap[c.token])
      tokenMap[c.token] = { weight: 0, sources: new Set(), layers: new Set() };
    tokenMap[c.token].weight += c.weight;
    tokenMap[c.token].sources.add(c.source);
    tokenMap[c.token].layers.add(c.source.split('.')[0]);
  }

  // Sorted by weight
  const sorted = Object.entries(tokenMap).sort((a, b) => b[1].weight - a[1].weight);

  console.log(
    `── DESCRIPTOR CLOUD (top ${Math.min(topN, sorted.length)} of ${sorted.length}) ──\n`
  );
  console.log(`  ${'WEIGHT'.padStart(7)}  ${'LAYERS'.padEnd(3)}  TOKEN`);
  console.log(`  ${'─'.repeat(7)}  ${'─'.repeat(3)}  ${'─'.repeat(40)}`);
  for (const [tok, info] of sorted.slice(0, topN)) {
    const layerCount = info.layers.size;
    console.log(
      `  ${info.weight.toFixed(2).padStart(7)}  ${String(layerCount).padStart(3)}  ${tok}`
    );
  }

  // Layer-attribution view: show how many unique tokens come from each layer
  console.log(`\n── BY LAYER ──\n`);
  const layerStats = {};
  for (const [tok, info] of Object.entries(tokenMap)) {
    for (const layer of info.layers) {
      if (!layerStats[layer]) layerStats[layer] = { unique: new Set(), totalWeight: 0 };
      layerStats[layer].unique.add(tok);
    }
  }
  for (const c of bag) {
    const layerKey = c.source.split('.')[0];
    if (!layerStats[layerKey]) layerStats[layerKey] = { unique: new Set(), totalWeight: 0 };
    layerStats[layerKey].totalWeight += c.weight;
  }
  for (const [layer, stats] of Object.entries(layerStats).sort(
    (a, b) => b[1].totalWeight - a[1].totalWeight
  )) {
    console.log(
      `  ${stats.totalWeight.toFixed(1).padStart(7)} weight  ${String(stats.unique.size).padStart(3)} unique  ${layer}`
    );
  }

  // Spread analysis
  console.log(`\n── TOKEN SPREAD ──\n`);
  const buckets = { 1: 0, 2: 0, 3: 0, '4+': 0 };
  for (const info of Object.values(tokenMap)) {
    const n = info.layers.size;
    if (n >= 4) buckets['4+']++;
    else buckets[n]++;
  }
  console.log(
    `  Tokens appearing in 1 layer only:    ${buckets[1]}  (likely contributing only there)`
  );
  console.log(`  Tokens appearing in 2 layers:        ${buckets[2]}`);
  console.log(`  Tokens appearing in 3 layers:        ${buckets[3]}`);
  console.log(`  Tokens appearing in 4+ layers:       ${buckets['4+']}  (gravity centers)`);

  // Show the gravity centers (4+ layers) explicitly
  if (buckets['4+'] > 0) {
    console.log(`\n  Gravity centers (4+ layers, top 20 by weight):`);
    const gravity = sorted.filter(([_, info]) => info.layers.size >= 4).slice(0, 20);
    for (const [tok, info] of gravity) {
      console.log(
        `    ${info.weight.toFixed(2).padStart(7)}  ${[...info.layers].sort().join(' + ')}  →  ${tok}`
      );
    }
  }
}

console.log('');
