// engine.js — the connector's deterministic, editable-workspace engine.
//
// Tabula-rasa rewrite (see CONNECTOR_WORKSPACE_PLAN.md): the connector is a
// headless driver of the SAME deterministic workspace the browser app edits —
// NOT a hill-climb search. It seeds a tradition's default cards (== the app's
// "Current Recipe"), then edits them (preface re-derive, variant/room/chain
// overrides, add/remove instruments, add/remove traditions), rendering the Rich
// recipe at every step. No scoring search, no auto-stapling.
//
// State-passing: every recipe op takes a `workspace` ({ cards }) in and returns
// the new `workspace` + rendered recipe; the caller (the model) threads it. The
// heavy lifting lives in the shared SSOT modules (scripts/_workspace_ops.js →
// _seed_workspace.js / _recipe_stack.js / _inverse_configure.js), so the
// connector and the app cannot drift.
//
// ESM over CommonJS engine modules via createRequire (no interop guessing).

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const C = require('../scripts/_loader.js');
const W = require('../scripts/_workspace_ops.js');
const { rank, tokensOf } = require('../scripts/_preface_match.js');

class EngineError extends Error {}

const tradById = (id) => (C.TRADITIONS || []).find((t) => t.id === id);
const instById = (id) => (C.INSTRUMENTS || []).find((i) => i.id === id);
const labelOf = (x) => (x && (x.name || x.label || x.title)) || (typeof x === 'string' ? x : null);
const round = (n) => (typeof n === 'number' ? Math.round(n * 1000) / 1000 : n);

// ─────────────────────────── workspace plumbing ───────────────────────────

// Accept { cards: [...] } (canonical) or a bare cards array (tolerant). Throws a
// guiding error when an edit/render op is called with no workspace.
function normWorkspace(ws, opName) {
  if (ws == null) {
    throw new EngineError(`${opName} needs a "workspace" — call start_recipe first and pass its workspace back.`);
  }
  if (Array.isArray(ws)) return { cards: ws };
  if (!Array.isArray(ws.cards)) throw new EngineError('"workspace" must be { cards: [...] } from a previous recipe call.');
  return { cards: ws.cards };
}

// Compact per-card view so the model can reference cards (by id) for the next
// edit and see each instrument's current (deduped) preface without re-reading
// the whole workspace.
function cardsSummary(ws) {
  // Render once on a throwaway so each card's auto-assigned preface is visible.
  const rendered = W.render(ws, { format: 'rich', ceiling: 100000 });
  void rendered;
  return ws.cards.map((c) => ({
    card: c.id,
    instrument: c.instrumentId,
    name: labelOf(instById(c.instrumentId)) || c.instrumentId,
    tradition: c.traditionId || null,
    preface: c.preface || null,
    preface_locked: !!c.prefaceLock,
  }));
}

// The standard recipe response: the deliverable string + the state to thread on.
function shape(ws, params = {}) {
  const format = params.format || 'rich';
  const ceiling = params.max_chars || 1000;
  const recipe = W.render(ws, { format, ceiling });
  return {
    recipe,
    recipe_chars: recipe.length,
    cards: cardsSummary(ws),
    workspace: ws,
  };
}

// Convert a WorkspaceError (bad id, etc.) into an actionable EngineError.
function wrap(fn) {
  try { return fn(); }
  catch (e) { if (e instanceof W.WorkspaceError) throw new EngineError(e.message); throw e; }
}

// ─────────────────────────── recipe surface ───────────────────────────

// Seed a fresh workspace from one or more traditions (deterministic defaults =
// the app's Current Recipe). The first tradition is primary; the rest are
// explicit staples (no auto-staple).
export function startRecipe(params = {}) {
  const ids = (params.traditions || []).map((s) => String(s).trim()).filter(Boolean);
  if (ids.length === 0) {
    throw new EngineError('start_recipe needs at least one tradition id — resolve names with search_catalog first.');
  }
  const ws = wrap(() => W.seed(ids));
  return { mode: ids.length > 1 ? 'blend' : 'single', ...shape(ws, params) };
}

const EDIT_ACTIONS = [
  'add_tradition', 'remove_tradition', 'add_instrument', 'remove_instrument',
  'set_variant', 'set_environment', 'set_preface',
];

function req(e, k) {
  if (e[k] == null || e[k] === '') throw new EngineError(`edit "${e.action}" requires "${k}".`);
  return e[k];
}

function applyEdit(ws, e) {
  switch (e && e.action) {
    case 'add_tradition':     return W.addTradition(ws, req(e, 'tradition'));
    case 'remove_tradition':  return W.removeTradition(ws, req(e, 'tradition'));
    case 'add_instrument':    return W.addInstrument(ws, req(e, 'instrument'), { tradition: e.tradition });
    case 'remove_instrument': return W.removeInstrument(ws, req(e, 'card'));
    case 'set_variant':       return W.setVariant(ws, req(e, 'card'), req(e, 'part'), req(e, 'variant'));
    case 'set_environment':   return W.setEnvironment(ws, req(e, 'card'), { room: e.room, tuning: e.tuning, chain: e.chain });
    case 'set_preface':       return W.setPreface(ws, req(e, 'card'), req(e, 'preface'));
    default:
      throw new EngineError(`Unknown edit action "${e && e.action}". Valid: ${EDIT_ACTIONS.join(', ')}.`);
  }
}

// Apply an ordered list of edits to a workspace, re-render. Each edit is a
// deterministic mutation mirroring a human canvas action; set_preface re-derives
// the card's settings toward the preface (verbatim label) before further edits.
export function editRecipe(params = {}) {
  let ws = normWorkspace(params.workspace, 'edit_recipe');
  const edits = params.edits;
  if (!Array.isArray(edits) || edits.length === 0) {
    throw new EngineError(`edit_recipe needs a non-empty "edits" array. Actions: ${EDIT_ACTIONS.join(', ')}.`);
  }
  for (let i = 0; i < edits.length; i++) {
    try { ws = applyEdit(ws, edits[i]); }
    catch (e) {
      const msg = (e && e.message) || String(e);
      throw new EngineError(`edit[${i}] (${(edits[i] && edits[i].action) || '?'}): ${msg}`);
    }
  }
  return shape(ws, params);
}

// Re-render an existing workspace (e.g. a different format or max_chars) without
// editing it.
export function renderRecipe(params = {}) {
  const ws = normWorkspace(params.workspace, 'render_recipe');
  return shape(ws, params);
}

// ─────────────────────────── discovery ───────────────────────────

const ALL_TYPES = ['tradition', 'instrument', 'variant', 'room', 'tuning', 'arrangement', 'aesthetic', 'preface', 'chain'];

// Free-text search across the catalog → ids to feed start_recipe / edit_recipe /
// get_instrument. Multi-term: records rank by how many query terms they match.
export function searchCatalog({ query, types, limit = 20 } = {}) {
  if (!query || !String(query).trim()) throw new EngineError('search_catalog needs a query.');
  const terms = String(query).toLowerCase().split(/\s+/).filter(Boolean);
  const want = new Set(Array.isArray(types) && types.length ? types : ALL_TYPES);
  const rows = [];
  const add = (type, id, name, hay) => {
    if (!want.has(type)) return;
    const h = (id + ' ' + (name || '') + ' ' + (hay || '')).toLowerCase();
    let score = 0; for (const t of terms) if (h.includes(t)) score++;
    if (score > 0) rows.push({ type, id, name: name || id, matched: score });
  };
  for (const t of C.TRADITIONS || []) add('tradition', t.id, t.name, `${t.lineage || ''} ${t.family || ''}`);
  for (const i of C.INSTRUMENTS || []) {
    add('instrument', i.id, i.name, i.family || '');
    if (want.has('variant')) {
      for (const p of i.parts || []) for (const v of p.variants || []) add('variant', v.id, v.name, (v.descriptors || []).join(' '));
    }
  }
  for (const r of C.ROOMS || []) add('room', r.id, r.name, (r.descriptors || []).join(' '));
  for (const t of C.TUNINGS || []) add('tuning', t.id, t.name, (t.descriptors || []).join(' '));
  for (const a of C.ARRANGEMENTS || []) add('arrangement', a.id, a.name, '');
  for (const a of C.PRODUCTION_AESTHETICS || []) add('aesthetic', a.id, a.name, '');
  for (const p of C.PREFACE_LEXICON || []) add('preface', p.id, p.name || p.id, tokensOf(p).join(' '));
  for (const sec of C.CHAIN_SECTIONS || []) for (const it of sec.items || []) add('chain', it.id, it.name, (it.descriptors || []).join(' '));
  rows.sort((a, b) => b.matched - a.matched || a.id.localeCompare(b.id));
  return { query, total: rows.length, items: rows.slice(0, Math.min(limit, 50)) };
}

// Search the 649 prefaces (named aesthetic/technique/delivery signatures) by
// mood words → preface ids for set_preface. Substring-ranked over id/name/tokens.
export function searchPrefaces({ query, limit = 15 } = {}) {
  if (!query || !String(query).trim()) throw new EngineError('search_prefaces needs mood/feel words.');
  const terms = String(query).toLowerCase().split(/\s+/).filter(Boolean);
  const rows = [];
  for (const p of C.PREFACE_LEXICON || []) {
    const toks = tokensOf(p);
    const hay = `${p.id} ${p.name || ''} ${toks.join(' ')}`.toLowerCase();
    let score = 0; for (const t of terms) if (hay.includes(t)) score++;
    if (score > 0) rows.push({ id: p.id, name: p.name || p.id, matched: score, tokens: toks.slice(0, 12) });
  }
  rows.sort((a, b) => b.matched - a.matched || a.id.localeCompare(b.id));
  return { query, total: rows.length, items: rows.slice(0, Math.min(limit, 50)) };
}

// The knob catalog for one instrument: every part + the variant ids valid for
// set_variant, with labels and which is the default.
export function getInstrument({ id } = {}) {
  const i = instById(id);
  if (!i) throw new EngineError(`Unknown instrument id: "${id}" (use search_catalog types=["instrument"]).`);
  return {
    id: i.id,
    name: labelOf(i) || i.id,
    family: i.family || null,
    parts: (i.parts || []).map((p) => ({
      id: p.id,
      name: labelOf(p) || p.id,
      variants: (p.variants || []).map((v) => ({ id: v.id, name: labelOf(v) || v.id, default: !!v.default })),
    })),
  };
}

export function getTradition({ id } = {}) {
  const t = tradById(id);
  if (!t) throw new EngineError(`Unknown tradition id: "${id}" (use search_catalog types=["tradition"]).`);
  const ext = (C.TRADITION_EXTRAS || {})[id] || {};
  return {
    id: t.id, name: labelOf(t) || t.id, family: t.family || null, lineage: t.lineage || null,
    axes: ext.axes || null, instruments: t.instruments || [], source: t,
  };
}

export function listTraditions({ query, family, limit = 50, offset = 0 } = {}) {
  let items = C.TRADITIONS || [];
  if (family) items = items.filter((t) => t.family === family);
  if (query) {
    const q = String(query).toLowerCase();
    items = items.filter((t) => t.id.includes(q) || (labelOf(t) || '').toLowerCase().includes(q));
  }
  const total = items.length;
  const page = items.slice(offset, offset + limit).map((t) => ({ id: t.id, name: labelOf(t) || t.id, family: t.family || null }));
  return { total, count: page.length, offset, items: page };
}

export function listOptions({ kind } = {}) {
  const tables = {
    rooms: C.ROOMS, tunings: C.TUNINGS, chain_sections: C.CHAIN_SECTIONS,
    archetypes: C.CHAIN_ARCHETYPES, aesthetics: C.PRODUCTION_AESTHETICS,
    arrangements: C.ARRANGEMENTS, instrument_families: C.INSTRUMENT_FAMILIES, axes: C.AXIS_DEFINITIONS,
  };
  if (kind === 'tradition_families') {
    const fams = [...new Set((C.TRADITIONS || []).map((t) => t.family).filter(Boolean))].sort();
    return { kind, count: fams.length, items: fams.map((f) => ({ id: f, name: f })) };
  }
  const table = tables[kind];
  if (table === undefined) {
    throw new EngineError(`Unknown options kind: "${kind}". Valid: ${[...Object.keys(tables), 'tradition_families'].join(', ')}`);
  }
  const items = Array.isArray(table)
    ? table.map((x) => ({ id: x.id ?? x, name: labelOf(x) || x.id || String(x) }))
    : Object.keys(table || {}).map((k) => ({ id: k, name: labelOf(table[k]) || k }));
  return { kind, count: items.length, items };
}

export function findSimilarTraditions(id, n = 8) {
  const ext = (C.TRADITION_EXTRAS || {})[id];
  if (!ext || !ext.axes) return [];
  const target = ext.axes;
  const scored = [];
  for (const tid of Object.keys(C.TRADITION_EXTRAS || {})) {
    if (tid === id) continue;
    const e = C.TRADITION_EXTRAS[tid];
    if (!e.axes) continue;
    let dist = 0, matched = 0;
    for (const k of Object.keys(target)) if (e.axes[k] !== undefined) { dist += Math.abs(e.axes[k] - target[k]); matched++; }
    if (matched === 0) continue;
    scored.push({ id: tid, name: labelOf(tradById(tid)) || tid, distance: round(dist) });
  }
  scored.sort((a, b) => a.distance - b.distance);
  return scored.slice(0, n);
}

export const counts = {
  traditions: (C.TRADITIONS || []).length,
  instruments: (C.INSTRUMENTS || []).length,
  prefaces: (C.PREFACE_LEXICON || []).length,
};

export { EngineError };
