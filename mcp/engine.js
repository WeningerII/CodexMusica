// engine.js — in-process adapter over the CodexMusica recipe engine.
//
// The whole point of this MCP server: an AI gets the SAME reach a human has in
// the browser app, not a read-only lookup of precomputed defaults. So every
// function here drives the live engine (scripts/*.js) at call time — search the
// whole catalog, blend traditions, add/remove instruments, swap part variants,
// target an axis profile, bend an instrument toward a descriptive "preface" —
// and returns a fresh recipe plus the "knobs still available" + provenance.
//
// The engine modules are CommonJS; this file is ESM. createRequire bridges them.

import { createRequire } from 'node:module';
import { searchCorpus, TYPES as CORPUS_TYPES } from './corpus.js';
const require = createRequire(import.meta.url);

const C = require('../scripts/_loader.js');
const { search, seedFromTradition, findClosestTraditionByAxis } = require('../scripts/search.js');
const { translate } = require('../scripts/translate.js');
const { tokensOf, rank } = require('../scripts/_preface_match.js');
const { seedCard, inverseConfigure, SIGS } = require('../scripts/_inverse_configure.js');
const { cardFromConfig } = require('../scripts/_matcher.js');
const { cardDescriptors } = require('../scripts/_card_descriptors.js');

// ─────────────────────────── catalog lookups ───────────────────────────

const tradById = id => C.TRADITIONS.find(t => t.id === id);
const instById = id => C.INSTRUMENTS.find(i => i.id === id);
const TRAD_IDS = new Set(C.TRADITIONS.map(t => t.id));

const labelOf = x => (x && (x.name || x.label || x.title)) || (typeof x === 'string' ? x : null);

const CHAIN_STAGES = ['mic', 'pre', 'console', 'comp', 'eq', 'amp', 'medium'];
const ALL_CHAIN_ITEM_IDS = (() => {
  const s = new Set();
  for (const sec of C.CHAIN_SECTIONS || []) for (const it of sec.items || []) s.add(it.id);
  return s;
})();
const STAGE_ITEM_IDS = (() => {
  const m = {};
  for (const sec of C.CHAIN_SECTIONS || []) m[sec.id] = new Set((sec.items || []).map(i => i.id));
  return m;
})();

class EngineError extends Error {}

// Build the customization opts bundle that seedFromTradition expects, validating
// every id against the live catalog so a typo'd instrument/variant fails loudly.
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

  const stapleMode = staple_mode === 'full' ? 'full' : 'lineage';
  return { exclude, add, swap, arrangement: arr, stapleMode };
}

// Blends default to a LEAN ensemble (primary tradition's instruments only =
// staple_mode 'lineage') to prevent roster "detonation". ensemble:'full' merges
// every tradition's roster; an explicit staple_mode is an advanced override.
function resolveStapleMode(params) {
  const ens = params.ensemble || 'lean';
  if (!['lean', 'full'].includes(ens)) {
    throw new EngineError(`Unknown ensemble: "${ens}" (use "lean" for the primary's instruments only, or "full" to merge every tradition's roster).`);
  }
  if (params.staple_mode) {
    if (!['lineage', 'full'].includes(params.staple_mode)) {
      throw new EngineError(`Unknown staple_mode: "${params.staple_mode}" (use "lineage" or "full").`);
    }
    return params.staple_mode;
  }
  return ens === 'full' ? 'full' : 'lineage';
}

// Post-search config overrides the browser exposes per card; translate() reads
// these straight off the config. Used both by direct params and by baking an
// apply_preface result into a recipe.
function applyConfigOverrides(config, { room, tuning, chain } = {}) {
  if (room != null) {
    if (!C.ROOMS.find(r => r.id === room)) throw new EngineError(`Unknown room id: "${room}"`);
    config.room = room;
  }
  if (tuning != null) {
    if (!C.TUNINGS.find(t => t.id === tuning)) throw new EngineError(`Unknown tuning id: "${tuning}"`);
    config.tuning = tuning;
  }
  if (chain && typeof chain === 'object') {
    const overrides = {};
    for (const [stage, val] of Object.entries(chain)) {
      if (!CHAIN_STAGES.includes(stage)) throw new EngineError(`Unknown chain stage: "${stage}" (use ${CHAIN_STAGES.join('/')}).`);
      if (val == null) continue;
      const stageSet = STAGE_ITEM_IDS[stage];
      const ok = stageSet ? stageSet.has(val) : ALL_CHAIN_ITEM_IDS.has(val);
      if (!ok) throw new EngineError(`Unknown chain item "${val}" for stage "${stage}" (search_catalog types=["chain"]).`);
      overrides[stage] = val;
    }
    if (Object.keys(overrides).length) {
      // translate() lets archetype components WIN over inline_chain, so an override
      // alone won't appear in the recipe string. Materialize the full chain
      // (archetype defaults + overrides) into inline_chain and drop the archetype
      // so the prose reflects what was actually set.
      const arch = (C.CHAIN_ARCHETYPES || []).find(a => a.id === config.archetype);
      const merged = {};
      // Base = exactly what translate WAS rendering (archetype components if there's
      // an archetype, else the inline chain) so ONLY the overridden stage changes.
      const base = (arch && arch.components) ? arch.components : (config.inline_chain || {});
      for (const st of CHAIN_STAGES) if (base[st]) merged[st] = base[st];
      for (const [st, v] of Object.entries(overrides)) merged[st] = v;
      if (arch && Array.isArray(arch.components.fx)) {
        const fxset = new Set(config.fx_extras || []);
        for (const f of arch.components.fx) fxset.add(f);
        config.fx_extras = [...fxset];
      }
      config.inline_chain = merged;
      config.archetype = null;
    }
  }
  return config;
}

// Trim the roster to at most `max` instruments: drop secondary-sourced, then
// lowest-scoring, never removing `voice`. Keeps a blend from ballooning.
function trimRoster(config, max, primaryTradId) {
  const m = parseInt(max, 10);
  if (!Number.isInteger(m) || m < 1) return;
  const insts = config.instruments || [];
  if (insts.length <= m) return;
  const primarySet = new Set((tradById(primaryTradId) || {}).instruments || []);
  const scoreOf = i => Object.values(i.scores || {}).reduce((a, b) => a + (Number(b) || 0), 0);
  const removable = insts.filter(i => i.id !== 'voice');
  // remove non-primary first, then lowest total slot score
  removable.sort((a, b) => (primarySet.has(a.id) - primarySet.has(b.id)) || (scoreOf(a) - scoreOf(b)));
  const toRemove = new Set();
  let n = insts.length;
  for (const i of removable) { if (n <= m) break; toRemove.add(i.id); n--; }
  config.instruments = insts.filter(i => !toRemove.has(i.id));
}

// Attribute each instrument's origin (primary tradition / a stapled secondary /
// user-added) and flag the "injected" ones a secondary tradition pulled in.
function provenanceFor(config) {
  const trads = config.traditions || [];
  const primary = trads[0];
  const tradSets = trads.map(tid => ({ tid, set: new Set((tradById(tid) || {}).instruments || []) }));
  const sourceById = {};
  for (const inst of config.instruments || []) {
    let src = 'added';
    for (const { tid, set } of tradSets) { if (set.has(inst.id)) { src = tid; break; } }
    sourceById[inst.id] = src;
  }
  const injected = (config.instruments || [])
    .filter(inst => { const s = sourceById[inst.id]; return s !== primary && s !== 'added'; })
    .map(inst => ({
      instrument: inst.id,
      name: labelOf(instById(inst.id)) || inst.id,
      source: sourceById[inst.id],
      hint: 'a secondary tradition added this; exclude_instruments to drop it, or set ensemble:"lean".',
    }));
  return { sourceById, injected };
}

// The engine's forward preface math: the descriptive preface each instrument's
// card matches (id + score + alternates) — the label the browser shows on every
// card and that recipe.js --why-prefaces reports. Surfaced so this integral
// layer is visible in the recipe; reshape a card toward a different one with
// apply_preface.
function prefacesForConfig(config) {
  const out = {};
  for (const inst of config.instruments || []) {
    try {
      const ranked = rank(cardDescriptors(cardFromConfig(config, inst.id), C, SIGS), C.PREFACE_LEXICON);
      out[inst.id] = ranked.length
        ? { top: ranked[0].entry.id, score: round(ranked[0].score), alts: ranked.slice(1, 3).map(r => r.entry.id) }
        : null;
    } catch { out[inst.id] = null; }
  }
  return out;
}

// ─────────────────────────── response shaping ───────────────────────────

function cleanConfig(config, sourceById = {}, prefaceById = {}) {
  return {
    traditions: config.traditions,
    instruments: (config.instruments || []).map(i => ({
      id: i.id,
      name: labelOf(instById(i.id)) || i.id,
      slots: i.slots || {},
      source: sourceById[i.id] || null,
      preface: prefaceById[i.id] ? prefaceById[i.id].top : null,
      preface_alts: prefaceById[i.id] ? prefaceById[i.id].alts : [],
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

// The anti-lookup-table payload: knobs still available + leak flags.
function affordances(config, injected = []) {
  const swappable = [];
  for (const inst of config.instruments || []) {
    const cat = instById(inst.id);
    if (!cat) continue;
    for (const part of cat.parts || []) {
      const options = (part.variants || []).filter(v => v.auto !== false).map(v => v.id);
      if (options.length <= 1) continue;
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
    injected,
    similar_traditions: findSimilarTraditions(config.traditions[0], 6).map(s => s.id),
    hint: 'Each instrument in config carries its auto-matched `preface` (+ preface_alts) — the engine\'s descriptive read of that card; reshape it toward a different mood with apply_preface. Refine by re-calling with swap_variants, exclude_instruments, add_instruments, room/tuning/chain, ensemble:"full" for a bigger band, or max_instruments to cap.',
  };
}

function finishRecipe(config, { maxChars = 1000, includeAffordances = true } = {}) {
  const recipe = translate(config, { ceiling: maxChars });
  const prov = provenanceFor(config);
  const prefaceById = prefacesForConfig(config);
  const out = {
    recipe,
    recipe_chars: recipe.length,
    config: cleanConfig(config, prov.sourceById, prefaceById),
  };
  if (includeAffordances) out.affordances = affordances(config, prov.injected);
  return out;
}

// ─────────────────────────── recipe generation ───────────────────────────

export function generateRecipe(params = {}) {
  const ids = (params.traditions || []).map(s => String(s).trim()).filter(Boolean);
  if (ids.length === 0) throw new EngineError('generate_recipe needs at least one tradition id (use search_catalog to find ids — do not guess).');
  const unknown = ids.filter(id => !TRAD_IDS.has(id));
  if (unknown.length) throw new EngineError(`Unknown tradition id(s): ${unknown.join(', ')} (search_catalog with types=["tradition"]).`);

  const opts = buildOpts({ ...params, staple_mode: resolveStapleMode(params) });
  const seed = seedFromTradition(ids[0], ids.slice(1), opts);
  if (!seed) throw new EngineError(`Could not seed from "${ids[0]}"`);
  const result = search(seed, { maxIters: 100 });
  if (params.max_instruments != null) trimRoster(result.config, params.max_instruments, ids[0]);
  applyConfigOverrides(result.config, params);

  return {
    mode: ids.length > 1 ? 'blend' : 'single',
    ensemble: resolveStapleMode(params) === 'full' ? 'full' : 'lean',
    score: round(result.score),
    ...finishRecipe(result.config, { maxChars: params.max_chars, includeAffordances: params.include_affordances !== false }),
    ...(params.include_why ? { why: whyBreakdown(result) } : {}),
  };
}

// Weighted A→B blend. weight is B's share: 0 = pure A, 0.5 = max blend, 1 = pure B.
export function blendTraditions(params = {}) {
  const { a, b } = params;
  let weight = Number(params.weight);
  if (!Number.isFinite(weight)) weight = 0.5;
  weight = Math.max(0, Math.min(1, weight));
  for (const id of [a, b]) {
    if (!id || !TRAD_IDS.has(id)) throw new EngineError(`Unknown tradition id: "${id}" (search_catalog with types=["tradition"]).`);
  }
  const opts = buildOpts({ ...params, staple_mode: resolveStapleMode(params) });

  let seed;
  let primaryId = a;
  if (weight === 0) seed = seedFromTradition(a, [], opts);
  else if (weight === 1) { seed = seedFromTradition(b, [], opts); primaryId = b; }
  else {
    primaryId = weight <= 0.5 ? a : b;
    const secondary = weight <= 0.5 ? b : a;
    const stapleWeight = Math.min(weight, 1 - weight) * 2;
    seed = seedFromTradition(primaryId, [secondary], { ...opts, stapleWeight });
  }
  const result = search(seed, { maxIters: 100 });
  if (params.max_instruments != null) trimRoster(result.config, params.max_instruments, primaryId);
  applyConfigOverrides(result.config, params);

  return {
    mode: 'weighted-blend',
    weight,
    ensemble: resolveStapleMode(params) === 'full' ? 'full' : 'lean',
    score: round(result.score),
    ...finishRecipe(result.config, { maxChars: params.max_chars, includeAffordances: params.include_affordances !== false }),
  };
}

// Find the best-fit tradition for an axis profile, then emit its recipe.
export function recipeFromAxis(params = {}) {
  const target = parseAxisTarget(params.axis_target);
  if (Object.keys(target).length === 0) {
    throw new EngineError('axis_target must be an object like {"harm":1,"density":2} or a string "harm:1,density:2". See list_options kind="axes".');
  }
  const tid = findClosestTraditionByAxis(target);
  if (!tid) throw new EngineError('No tradition matches that axis target.');
  const opts = buildOpts({ ...params, staple_mode: resolveStapleMode(params) });
  const seed = seedFromTradition(tid, [], opts);
  const result = search(seed, { maxIters: 100 });
  if (params.max_instruments != null) trimRoster(result.config, params.max_instruments, tid);
  applyConfigOverrides(result.config, params);

  return {
    mode: 'axis-target',
    axis_target: target,
    matched_tradition: { id: tid, name: labelOf(tradById(tid)) || tid },
    score: round(result.score),
    ...finishRecipe(result.config, { maxChars: params.max_chars, includeAffordances: params.include_affordances !== false }),
  };
}

// ─────────────────────────── search & prefaces ───────────────────────────

// Unified free-text search across the WHOLE catalog (traditions incl. lineage,
// instruments, every part-variant, rooms, tunings, arrangements, aesthetics,
// prefaces). Turn request words into real ids — don't guess.
export function searchCatalog(params = {}) {
  if (!params.query || !String(params.query).trim()) throw new EngineError('search_catalog needs a non-empty query.');
  if (params.types) {
    const bad = (params.types || []).filter(t => !CORPUS_TYPES.includes(t));
    if (bad.length) throw new EngineError(`Unknown search type(s): ${bad.join(', ')}. Valid: ${CORPUS_TYPES.join(', ')}.`);
  }
  let offset = 0;
  if (params.cursor) {
    try { offset = parseInt(Buffer.from(String(params.cursor), 'base64').toString('utf8'), 10) || 0; } catch { offset = 0; }
  }
  const limit = Math.min(Math.max(parseInt(params.limit, 10) || 20, 1), 50);
  return searchCorpus({ query: params.query, types: params.types, limit, offset });
}

// Search the 649 descriptive prefaces (mood/quality/delivery words) by free text.
export function searchPrefaces({ query, limit = 15 } = {}) {
  if (!query || !String(query).trim()) throw new EngineError('search_prefaces needs a non-empty query (a mood/quality, e.g. "worn bitter").');
  const qTerms = String(query).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const lim = Math.min(Math.max(parseInt(limit, 10) || 15, 1), 50);
  const scored = [];
  for (const e of C.PREFACE_LEXICON || []) {
    const toks = tokensOf(e) || [];
    const hay = `${e.id} ${toks.join(' ')} ${e.note || ''}`.toLowerCase();
    let hits = 0;
    for (const qt of qTerms) if (hay.includes(qt)) hits++;
    if (hits === 0) continue;
    const idExact = qTerms.includes(e.id.toLowerCase()) ? 1 : 0;
    scored.push({ id: e.id, tokens: toks, note: e.note || null, score: hits + idExact });
  }
  scored.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  return { query, total: scored.length, count: Math.min(scored.length, lim), items: scored.slice(0, lim) };
}

// Bend ONE instrument toward a descriptive preface (intent → physical settings):
// re-pick its part-variants, tuning, room, and signal chain to match the
// preface's token signature. Returns a ready-to-bake set of overrides.
export function applyPreface({ tradition, instrument, preface } = {}) {
  if (!instrument || !instById(instrument)) {
    throw new EngineError(`Unknown or missing instrument id: "${instrument}" (search_catalog types=["instrument"]).`);
  }
  if (!preface || !(C.PREFACE_LEXICON || []).find(p => p.id === preface)) {
    throw new EngineError(`Unknown or missing preface id: "${preface}" (use search_prefaces).`);
  }
  if (tradition && !TRAD_IDS.has(tradition)) throw new EngineError(`Unknown tradition id: "${tradition}".`);

  const card = seedCard(instrument, tradition || null);
  if (!card) throw new EngineError(`Could not seed a card for instrument "${instrument}".`);
  const res = inverseConfigure(card, preface);
  if (!res) throw new EngineError(`Preface "${preface}" has no tokens to target.`);

  // DELTA ONLY: emit just the slots this preface actually changed from the seed,
  // so baking it is additive and never resets unrelated parts to defaults. A
  // preface that doesn't map to this instrument yields an empty override set.
  const baseParts = card.parts || {};
  const swap_variants = Object.entries(res.config.parts || {})
    .filter(([pid, vid]) => vid && vid !== baseParts[pid])
    .map(([pid, vid]) => `${instrument}:${pid}:${vid}`);
  const chainDelta = {};
  for (const stage of CHAIN_STAGES) {
    const v = res.config.chain && res.config.chain[stage];
    if (v && v !== (card.chain && card.chain[stage])) chainDelta[stage] = v;
  }
  const overrides = { swap_variants };
  if (res.config.room && res.config.room !== card.room) overrides.room = res.config.room;
  if (res.config.tuning && res.config.tuning !== card.tuning) overrides.tuning = res.config.tuning;
  if (Object.keys(chainDelta).length) overrides.chain = chainDelta;

  const applied = res.changes.length > 0;
  return {
    instrument,
    preface,
    tradition: tradition || null,
    applied,
    coverage: `${res.finalScore}/${res.targetTokenCount}`,
    improved_from: `${res.startScore}/${res.targetTokenCount}`,
    changes: res.changes,
    // Spread into a generate_recipe call to bake the mood in (only the changed slots):
    generate_recipe_overrides: overrides,
    apply_hint: applied
      ? 'Spread generate_recipe_overrides (only the slots this mood changed) into generate_recipe, alongside your traditions, to bake the mood in.'
      : `"${preface}" doesn't map to ${instrument}'s parameters (no changes). Try another instrument/preface, or set a variant manually via get_instrument + swap_variants.`,
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
  if (!t) throw new EngineError(`Unknown tradition id: "${id}" (search_catalog with types=["tradition"]).`);
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
  if (!i) throw new EngineError(`Unknown instrument id: "${id}" (search_catalog with types=["instrument"]).`);
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
  prefaces: (C.PREFACE_LEXICON || []).length,
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
