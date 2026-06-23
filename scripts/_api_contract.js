'use strict';
// _api_contract.js — the static-API promise contract, authored ONCE.
//
// The agent-facing docs (AGENTS.md, llms.txt, README) make hard, machine-checkable
// promises about the published static API. This module is the single place those
// promises live as code:
//   • "all <N> traditions … in one fetch"   → completeness (asserted by callers)
//   • "recipe (string, <=1000 chars)"        → RECIPE_CHAR_CEILING
//   • "every id resolvable against the catalog" → configIdProblems()
//   • recipe_chars is the recipe's true length  → recordProblems() (no drift)
//
// Both the builder (build_static_api.js — self-verify in memory before publish) and
// the gate (check_api.js — verify the published files) assert against THIS module,
// so the published API can never silently break a documented promise. If the promise
// text in the docs changes, change it here and update both callers together.

const RECIPE_CHAR_CEILING = 1000; // AGENTS.md / llms.txt: "recipe (string, <=1000 chars)"

// The raw catalog-row fields the BROWSER app needs to IMPORT a tradition into
// its workspace: tuning/room/part-overrides plus the recording chain. The
// lazy-loaded app boots from the light browse index (api/browse.json) and
// fetches traditions/{id}.json only on import — `source` is where these row
// fields ride along in that file. Builder and gate both use THIS list, so the
// published `source` can never silently drift from references/.
const TRADITION_SOURCE_KEYS = [
  'tuning', 'room', 'parts',
  'chain_mic', 'chain_pre', 'chain_comp', 'chain_eq', 'chain_medium',
  'chain_console', 'chain_fx', 'chain_amp', 'chain_amp_guitar', 'chain_amp_bass',
];

// Project a catalog tradition row down to its `source` payload (only the keys
// actually present on the row — absent keys are omitted, not nulled).
function traditionSource(row) {
  const out = {};
  for (const k of TRADITION_SOURCE_KEYS) if (row[k] !== undefined) out[k] = row[k];
  return out;
}

// Build an id-resolution index from a loaded catalog (`C` = scripts/_loader.js exports).
// Mirrors how validate.js resolves refs: per-section chain ids, and per-instrument
// MERGED parts (the loader has already run mergeFamilyParts), so slot variants resolve
// against exactly what the engine sees.
function buildResolver(C) {
  const idSet = (table) => new Set((C[table] || []).map((x) => x.id));
  const sets = {
    tradition: idSet('TRADITIONS'),
    instrument: idSet('INSTRUMENTS'),
    room: idSet('ROOMS'),
    archetype: idSet('CHAIN_ARCHETYPES'),
    tuning: idSet('TUNINGS'),
    aesthetic: idSet('PRODUCTION_AESTHETICS'),
    arrangement: idSet('ARRANGEMENTS'),
  };
  const chain = {};
  for (const sec of C.CHAIN_SECTIONS || []) {
    chain[sec.id] = new Set((sec.items || []).map((i) => i.id));
  }
  // instId -> Map(partId -> Set(variantId)), from the merged parts view.
  const instParts = new Map();
  for (const inst of C.INSTRUMENTS || []) {
    const m = new Map();
    for (const p of inst.parts || []) m.set(p.id, new Set((p.variants || []).map((v) => v.id)));
    instParts.set(inst.id, m);
  }
  return { sets, chain, instParts };
}

// Return an array of human-readable problem strings for one config object.
// An empty array means every id in the config resolves against the catalog.
function configIdProblems(config, R) {
  const out = [];
  if (!config || typeof config !== 'object') {
    out.push('config: missing or not an object');
    return out;
  }
  const need = (kind, id) => {
    if (id == null) return;
    if (!R.sets[kind].has(id)) out.push(`${kind} not in catalog: ${id}`);
  };

  for (const tid of config.traditions || []) need('tradition', tid);
  need('room', config.room);
  need('archetype', config.archetype);
  need('tuning', config.tuning);

  // aesthetic: null | id-string | { id }
  if (config.aesthetic != null) {
    const aid = typeof config.aesthetic === 'string' ? config.aesthetic : config.aesthetic.id;
    if (aid) need('aesthetic', aid);
  }
  // arrangement: a structured object; resolve its id only if it carries one.
  if (config.arrangement && typeof config.arrangement === 'object' && config.arrangement.id) {
    need('arrangement', config.arrangement.id);
  }

  // inline_chain: { mic, pre, comp, eq, medium, console, amp } — each → its section.
  const ic = config.inline_chain || {};
  for (const sec of Object.keys(ic)) {
    const v = ic[sec];
    if (v == null) continue;
    if (!R.chain[sec]) {
      out.push(`inline_chain has unknown section "${sec}"`);
      continue;
    }
    if (!R.chain[sec].has(v)) out.push(`chain.${sec} not in catalog: ${v}`);
  }
  // fx_extras → the fx section (additive fx beyond the archetype).
  for (const fx of config.fx_extras || []) {
    const id = typeof fx === 'string' ? fx : fx && fx.id;
    if (id != null && R.chain.fx && !R.chain.fx.has(id)) out.push(`fx_extra not in catalog: ${id}`);
  }

  // instruments + their slots (partId -> variantId).
  for (const inst of config.instruments || []) {
    if (!inst || inst.id == null) {
      out.push('instrument entry without an id');
      continue;
    }
    if (!R.sets.instrument.has(inst.id)) {
      out.push(`instrument not in catalog: ${inst.id}`);
      continue;
    }
    const pm = R.instParts.get(inst.id) || new Map();
    for (const [pid, vid] of Object.entries(inst.slots || {})) {
      if (!pm.has(pid)) out.push(`${inst.id}: unknown part slot "${pid}"`);
      else if (!pm.get(pid).has(vid)) out.push(`${inst.id}.${pid}: variant not in catalog: ${vid}`);
    }
  }
  return out;
}

// Validate one record that carries a `recipe` (+ `recipe_chars`, + optional `config`):
// the per-tradition file shape and the all.json item shape. Empty array === clean.
function recordProblems(rec, R, { requireConfig = true } = {}) {
  const out = [];
  if (!rec || typeof rec !== 'object') {
    out.push('record: missing or not an object');
    return out;
  }
  if (typeof rec.recipe !== 'string') {
    out.push('recipe: missing or not a string');
  } else {
    if (rec.recipe.length > RECIPE_CHAR_CEILING) {
      out.push(`recipe over ${RECIPE_CHAR_CEILING}-char ceiling: ${rec.recipe.length}`);
    }
    if (typeof rec.recipe_chars === 'number' && rec.recipe_chars !== rec.recipe.length) {
      out.push(`recipe_chars (${rec.recipe_chars}) != recipe.length (${rec.recipe.length})`);
    }
  }
  if (rec.config) out.push(...configIdProblems(rec.config, R));
  else if (requireConfig) out.push('config: missing');
  return out;
}

// Return a shallow copy of an instrument with `expanded` (the universal
// cross-instrument string materials injected at load by _merge.js) removed from
// every part's variants. These are a live-only presentation layer — the static
// published API carries each instrument's CURATED list, so the build writes the
// stripped form and check_api compares against the stripped catalog instrument.
// Single source so the two never drift.
function stripExpandedVariants(inst) {
  if (!inst || !Array.isArray(inst.parts)) return inst;
  return {
    ...inst,
    parts: inst.parts.map((p) =>
      Array.isArray(p.variants) ? { ...p, variants: p.variants.filter((v) => !v.expanded) } : p
    ),
  };
}

module.exports = { RECIPE_CHAR_CEILING, TRADITION_SOURCE_KEYS, traditionSource, buildResolver, configIdProblems, recordProblems, stripExpandedVariants };
