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
//   • "configs honor authored tradition.parts"  → authoredPartsProblems()
//
// Both the builder (build_static_api.js — self-verify in memory before publish) and
// the gate (check_api.js — verify the published files) assert against THIS module,
// so the published API can never silently break a documented promise. If the promise
// text in the docs changes, change it here and update both callers together.

const RECIPE_CHAR_CEILING = 1000; // AGENTS.md / llms.txt: "recipe (string, <=1000 chars)"

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
  // tradition records by id — authoredPartsProblems needs .parts/.instruments.
  const traditionById = new Map((C.TRADITIONS || []).map((t) => [t.id, t]));
  return { sets, chain, instParts, traditionById };
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

// Return problem strings when a config contradicts its PRIMARY tradition's
// authored `parts` map (partId → variantId). seedFromTradition applies those
// assignments as pinned slots — the same semantics the browser app uses at
// tradition import — so a published config that disagrees means the artifact
// predates the assignment (stale) or the pin was broken. Scope mirrors the
// engine exactly: only instruments on the primary's own roster, and only
// pairs whose part AND variant exist on that instrument (the makeCard filter
// validate.js codifies).
function authoredPartsProblems(config, R) {
  const out = [];
  if (!config || typeof config !== 'object') return out;
  const tid = (config.traditions || [])[0];
  const t = tid != null ? R.traditionById.get(tid) : null;
  if (!t || !t.parts || typeof t.parts !== 'object') return out;
  const roster = new Set(t.instruments || []);
  for (const inst of config.instruments || []) {
    if (!inst || !roster.has(inst.id)) continue;
    const pm = R.instParts.get(inst.id);
    if (!pm) continue;
    for (const [pid, vid] of Object.entries(t.parts)) {
      const variants = pm.get(pid);
      if (!variants || !variants.has(vid)) continue; // pair targets a different roster instrument
      const got = (inst.slots || {})[pid];
      if (got !== vid) {
        out.push(`${inst.id}.${pid}: authored tradition.parts says ${vid}, config has ${got == null ? 'nothing' : got}`);
      }
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
  if (rec.config) {
    out.push(...configIdProblems(rec.config, R));
    out.push(...authoredPartsProblems(rec.config, R));
  } else if (requireConfig) {
    out.push('config: missing');
  }
  return out;
}

module.exports = { RECIPE_CHAR_CEILING, buildResolver, configIdProblems, authoredPartsProblems, recordProblems };
