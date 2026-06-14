// engine.js — in-process adapter over the CodexMusica recipe engine.
//
// The whole point of this MCP server: an AI gets the SAME reach a human has in
// the browser app, not a read-only lookup of precomputed defaults. So every
// function here drives the live engine (scripts/*.js) at call time — blend
// traditions, add/remove instruments, swap part variants, target an axis
// profile, override room/arrangement — and returns a fresh recipe plus the
// "knobs still available" so the caller is pulled deeper into customization.
//
// The engine modules are CommonJS; this file is ESM. createRequire bridges them
// cleanly (no interop guessing about named exports).

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const C = require('../scripts/_loader.js');
const { search, seedFromTradition, findClosestTraditionByAxis } = require('../scripts/search.js');
const { translate } = require('../scripts/translate.js');

// ─────────────────────────── catalog lookups ───────────────────────────

const tradById = id => C.TRADITIONS.find(t => t.id === id);
const instById = id => C.INSTRUMENTS.find(i => i.id === id);
const TRAD_IDS = new Set(C.TRADITIONS.map(t => t.id));

const labelOf = x => (x && (x.name || x.label || x.title)) || (typeof x === 'string' ? x : null);

class EngineError extends Error {}

// Build the customization opts bundle that seedFromTradition expects, validating
// every id against the live catalog so a typo'd instrument/variant fails loudly
// (with a helpful message) instead of silently vanishing from the recipe.
function buildOpts({ exclude_instruments, add_instruments, swap_variants, arrangement, staple_mode } = {}) {
  const exclude = new Set();
  const add = new Set();
  const swap = {};

  for (const iid of exclude_instruments || []) {
    if (!instById(iid)) throw new EngineError(`Unknown instrument id (exclude): "${iid}"`);
    exclude.add(iid);
  }
  for (const iid of add_instruments || []) {
    if (!instById(iid)) throw new EngineError(`Unknown instrument id (add): "${iid}"`);
    add.add(iid);
  }
  for (const raw of swap_variants || []) {
    // Accept "inst:part:variant" strings or {instrument, part, variant} objects.
    const triple = typeof raw === 'string'
      ? raw.split(':').map(s => s.trim())
      : [raw.instrument, raw.part, raw.variant];
    const [iid, pid, vid] = triple;
    if (!iid || !pid || !vid) throw new EngineError(`Bad swap_variant (need instrument:part:variant): ${JSON.stringify(raw)}`);
    const inst = instById(iid);
    if (!inst) throw new EngineError(`Unknown instrument in swap: "${iid}"`);
    const part = (inst.parts || []).find(p => p.id === pid);
    if (!part) throw new EngineError(`Instrument "${iid}" has no part "${pid}"`);
    const variant = (part.variants || []).find(v => v.id === vid);
    if (!variant) throw new EngineError(`"${iid}.${pid}" has no variant "${vid}"`);
    swap[iid] = swap[iid] || {};
    swap[iid][pid] = vid;
  }

  let arr = null;
  if (arrangement) {
    if (!(C.ARRANGEMENTS || []).find(a => a.id === arrangement)) {
      throw new EngineError(`Unknown arrangement id: "${arrangement}"`);
    }
    arr = arrangement;
  }

  const stapleMode = staple_mode === 'lineage' ? 'lineage' : 'full';
  if (staple_mode && !['lineage', 'full'].includes(staple_mode)) {
    throw new EngineError(`Unknown staple_mode: "${staple_mode}" (use "full" or "lineage")`);
  }

  return { exclude, add, swap, arrangement: arr, stapleMode };
}

// Apply post-search config overrides that the browser app exposes per card but
// the seed pipeline doesn't take as flags. translate() reads these straight off
// the config, so overriding here is faithful to what the UI does.
function applyConfigOverrides(config, { room } = {}) {
  if (room !== undefined && room !== null) {
    if (!C.ROOMS.find(r => r.id === room)) throw new EngineError(`Unknown room id: "${room}"`);
    config.room = room;
  }
  return config;
}

// ─────────────────────────── response shaping ───────────────────────────

// Strip the heavy per-slot `scores` noise; keep everything a caller needs to
// understand and re-drive the arrangement.
function cleanConfig(config) {
  return {
    traditions: config.traditions,
    instruments: (config.instruments || []).map(i => ({
      id: i.id,
      name: labelOf(instById(i.id)) || i.id,
      slots: i.slots || {},
    })),
    room: config.room,
    archetype: config.archetype,
    inline_chain: config.inline_chain,
    tuning: config.tuning,
    aesthetic: config.aesthetic,
    arrangement: config.arrangement,
    fx_extras: config.fx_extras || [],
  };
}

// The anti-lookup-table payload: every knob the caller could still turn on THIS
// recipe — which variants each part could swap to, and which traditions are
// nearby to blend in next. This is what turns a one-shot answer into an
// explorable instrument.
function affordances(config) {
  const swappable = [];
  for (const inst of config.instruments || []) {
    const cat = instById(inst.id);
    if (!cat) continue;
    for (const part of cat.parts || []) {
      const options = (part.variants || []).filter(v => v.auto !== false).map(v => v.id);
      if (options.length <= 1) continue; // no real choice
      swappable.push({
        instrument: inst.id,
        part: part.id,
        current: (inst.slots || {})[part.id] ?? null,
        options,
      });
    }
  }
  return {
    instruments_in_recipe: (config.instruments || []).map(i => ({ id: i.id, name: labelOf(instById(i.id)) || i.id })),
    swappable_variants: swappable,
    similar_traditions: findSimilarTraditions(config.traditions[0], 6).map(s => s.id),
    hint: 'Re-call generate_recipe/blend_traditions with swap_variants, add_instruments, exclude_instruments, room, or more traditions to refine. Use get_instrument for a part\'s full variant labels.',
  };
}

function finishRecipe(config, { maxChars = 1000, includeAffordances = true } = {}) {
  const recipe = translate(config, { ceiling: maxChars });
  const out = {
    recipe,
    recipe_chars: recipe.length,
    config: cleanConfig(config),
  };
  if (includeAffordances) out.affordances = affordances(config);
  return out;
}

// ─────────────────────────── recipe generation ───────────────────────────

// N-tradition recipe (first = primary, rest stapled in) with full customization.
export function generateRecipe(params = {}) {
  const ids = (params.traditions || []).map(s => String(s).trim()).filter(Boolean);
  if (ids.length === 0) throw new EngineError('generate_recipe needs at least one tradition id (see list_traditions).');
  const unknown = ids.filter(id => !TRAD_IDS.has(id));
  if (unknown.length) throw new EngineError(`Unknown tradition id(s): ${unknown.join(', ')}`);

  const opts = buildOpts(params);
  const seed = seedFromTradition(ids[0], ids.slice(1), opts);
  if (!seed) throw new EngineError(`Could not seed from "${ids[0]}"`);
  const result = search(seed, { maxIters: 100 });
  applyConfigOverrides(result.config, params);

  return {
    mode: ids.length > 1 ? 'blend' : 'single',
    score: round(result.score),
    ...finishRecipe(result.config, { maxChars: params.max_chars, includeAffordances: params.include_affordances !== false }),
    ...(params.include_why ? { why: whyBreakdown(result) } : {}),
  };
}

// Weighted A→B blend (mirrors recipe.js --diff). weight is B's share: 0 = pure
// A, 0.5 = max blend, 1 = pure B.
export function blendTraditions(params = {}) {
  const { a, b } = params;
  let weight = Number(params.weight);
  if (!Number.isFinite(weight)) weight = 0.5;
  weight = Math.max(0, Math.min(1, weight));
  for (const id of [a, b]) {
    if (!id || !TRAD_IDS.has(id)) throw new EngineError(`Unknown tradition id: "${id}"`);
  }
  const opts = buildOpts(params);

  let seed;
  if (weight === 0) seed = seedFromTradition(a, [], opts);
  else if (weight === 1) seed = seedFromTradition(b, [], opts);
  else {
    const primary = weight <= 0.5 ? a : b;
    const secondary = weight <= 0.5 ? b : a;
    const stapleWeight = Math.min(weight, 1 - weight) * 2;
    seed = seedFromTradition(primary, [secondary], { ...opts, stapleWeight });
  }
  const result = search(seed, { maxIters: 100 });
  applyConfigOverrides(result.config, params);

  return {
    mode: 'weighted-blend',
    weight,
    score: round(result.score),
    ...finishRecipe(result.config, { maxChars: params.max_chars, includeAffordances: params.include_affordances !== false }),
  };
}

// Find the best-fit tradition for an axis profile, then emit its recipe.
export function recipeFromAxis(params = {}) {
  const target = parseAxisTarget(params.axis_target);
  if (Object.keys(target).length === 0) {
    throw new EngineError('axis_target must be an object like {"harm":1,"density":2} or a string "harm:1,density:2".');
  }
  const tid = findClosestTraditionByAxis(target);
  if (!tid) throw new EngineError('No tradition matches that axis target.');
  const opts = buildOpts(params);
  const seed = seedFromTradition(tid, [], opts);
  const result = search(seed, { maxIters: 100 });
  applyConfigOverrides(result.config, params);

  return {
    mode: 'axis-target',
    axis_target: target,
    matched_tradition: { id: tid, name: labelOf(tradById(tid)) || tid },
    score: round(result.score),
    ...finishRecipe(result.config, { maxChars: params.max_chars, includeAffordances: params.include_affordances !== false }),
  };
}

// ─────────────────────────── discovery / catalog ───────────────────────────

export function listTraditions({ query, family, limit = 50, offset = 0 } = {}) {
  let items = C.TRADITIONS;
  if (family) items = items.filter(t => t.family === family);
  if (query) {
    const q = query.toLowerCase();
    items = items.filter(t => t.id.includes(q) || (labelOf(t) || '').toLowerCase().includes(q));
  }
  const total = items.length;
  const page = items.slice(offset, offset + limit).map(t => ({ id: t.id, name: labelOf(t) || t.id, family: t.family || null }));
  return { total, count: page.length, offset, items: page };
}

export function getTradition({ id } = {}) {
  const t = tradById(id);
  if (!t) throw new EngineError(`Unknown tradition id: "${id}" (see list_traditions).`);
  const ext = (C.TRADITION_EXTRAS || {})[id] || {};
  return {
    id: t.id,
    name: labelOf(t) || t.id,
    family: t.family || null,
    lineage: t.lineage || null,
    axes: ext.axes || null,
    source: t,
  };
}

export function listInstruments({ query, family, limit = 50, offset = 0 } = {}) {
  let items = C.INSTRUMENTS;
  if (family) items = items.filter(i => i.family === family);
  if (query) {
    const q = query.toLowerCase();
    items = items.filter(i => i.id.includes(q) || (labelOf(i) || '').toLowerCase().includes(q));
  }
  const total = items.length;
  const page = items.slice(offset, offset + limit).map(i => ({ id: i.id, name: labelOf(i) || i.id, family: i.family || null }));
  return { total, count: page.length, offset, items: page };
}

// The knob catalog for one instrument: every part and the variant ids you can
// pass to swap_variants, with labels.
export function getInstrument({ id } = {}) {
  const i = instById(id);
  if (!i) throw new EngineError(`Unknown instrument id: "${id}" (see list_instruments).`);
  return {
    id: i.id,
    name: labelOf(i) || i.id,
    family: i.family || null,
    parts: (i.parts || []).map(p => ({
      id: p.id,
      name: labelOf(p) || p.id,
      variants: (p.variants || []).map(v => ({
        id: v.id,
        name: labelOf(v) || v.id,
        default: !!v.default,
        auto: v.auto !== false,
      })),
    })),
  };
}

export function findSimilarTraditions(id, n = 8) {
  const ext = (C.TRADITION_EXTRAS || {})[id];
  if (!ext || !ext.axes) return [];
  const target = ext.axes;
  const scored = [];
  for (const tid of Object.keys(C.TRADITION_EXTRAS)) {
    if (tid === id) continue;
    const e = C.TRADITION_EXTRAS[tid];
    if (!e.axes) continue;
    let dist = 0, matched = 0;
    for (const k of Object.keys(target)) {
      if (e.axes[k] !== undefined) { dist += Math.abs(e.axes[k] - target[k]); matched++; }
    }
    if (matched === 0) continue;
    scored.push({ id: tid, name: labelOf(tradById(tid)) || tid, distance: round(dist) });
  }
  scored.sort((a, b) => a.distance - b.distance);
  return scored.slice(0, n);
}

// Enumerate an option space (rooms, tunings, signal-chain items, arrangements …)
// so the caller can discover valid override values.
export function listOptions({ kind } = {}) {
  const tables = {
    rooms: C.ROOMS,
    tunings: C.TUNINGS,
    chain_sections: C.CHAIN_SECTIONS,
    archetypes: C.CHAIN_ARCHETYPES,
    aesthetics: C.PRODUCTION_AESTHETICS,
    arrangements: C.ARRANGEMENTS,
    instrument_families: C.INSTRUMENT_FAMILIES,
    axes: C.AXIS_DEFINITIONS,
  };
  if (kind === 'tradition_families') {
    const fams = [...new Set(C.TRADITIONS.map(t => t.family).filter(Boolean))].sort();
    return { kind, count: fams.length, items: fams.map(f => ({ id: f, name: f })) };
  }
  const table = tables[kind];
  if (table === undefined) {
    throw new EngineError(`Unknown options kind: "${kind}". Valid: ${[...Object.keys(tables), 'tradition_families'].join(', ')}`);
  }
  const items = enumerate(table);
  return { kind, count: items.length, items };
}

export const counts = {
  traditions: C.TRADITIONS.length,
  instruments: C.INSTRUMENTS.length,
  rooms: (C.ROOMS || []).length,
  tunings: (C.TUNINGS || []).length,
  arrangements: (C.ARRANGEMENTS || []).length,
};

// ─────────────────────────── helpers ───────────────────────────

function enumerate(table) {
  if (Array.isArray(table)) return table.map(x => ({ id: x.id ?? x, name: labelOf(x) || x.id || String(x) }));
  if (table && typeof table === 'object') return Object.keys(table).map(k => ({ id: k, name: labelOf(table[k]) || k }));
  return [];
}

function parseAxisTarget(axis) {
  if (!axis) return {};
  if (typeof axis === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(axis)) { const n = Number(v); if (k && Number.isFinite(n)) out[k.trim()] = n; }
    return out;
  }
  const out = {};
  for (const pair of String(axis).split(',')) {
    const [k, v] = pair.split(':');
    const n = Number(v);
    if (k && Number.isFinite(n)) out[k.trim()] = n;
  }
  return out;
}

function whyBreakdown(result) {
  return {
    final_score: round(result.score),
    breakdown: result.breakdown,
    trace: (result.trace || []).map(t => ({ score: round(t.score), desc: t.desc })),
  };
}

function round(n) { return typeof n === 'number' ? Math.round(n * 1000) / 1000 : n; }

export { EngineError };
