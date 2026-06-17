'use strict';
// _workspace_ops.js — the connector's editable workspace (state-passing).
//
// The headless equivalent of the human app's canvas: a workspace is just
// { cards: [...] }, and every op takes a workspace in and returns a NEW workspace
// (no mutation of the input — the model threads the state). render() turns any
// workspace into the "Current Recipe" via the shared SSOT renderer.
//
// These mirror the human affordances (CONNECTOR_WORKSPACE_PLAN.md §3), all
// deterministic — no search, no auto-staple:
//   seed / add_tradition / remove_tradition   — rosters (1..n traditions, explicit)
//   add_instrument / remove_instrument        — per-instrument cards
//   set_variant / set_environment             — direct overrides (a UI dropdown)
//   set_preface                               — inverseConfigure: re-derive a card's
//                                               settings toward a preface, then lock it
//
// set_preface is the load-bearing one: changing a preface deterministically
// rewrites that card's parts/tuning/room/chain to maximize the preface's token
// overlap (identical to the browser's commitPrefaceChange→inverseConfigureForPreface),
// then locks the preface so the renderer surfaces it verbatim and dedups the rest
// around it. Further edits layer on top.

const C = require('./_loader.js');
const { inverseConfigure } = require('./_inverse_configure.js');
const { seedTraditionCards, renderWorkspace, makeCard } = require('./_seed_workspace.js');

class WorkspaceError extends Error {}

const instById = (id) => (C.INSTRUMENTS || []).find((i) => i.id === id);
const tradById = (id) => (C.TRADITIONS || []).find((t) => t.id === id);
const prefaceById = (id) => (C.PREFACE_LEXICON || []).find((p) => p.id === id);

function emptyWorkspace() { return { cards: [] }; }

// Deep-ish clone so an op never mutates the caller's workspace (state-passing).
function clone(ws) {
  return {
    cards: ((ws && ws.cards) || []).map((c) => ({
      ...c,
      parts: { ...(c.parts || {}) },
      chain: { ...(c.chain || {}), fx: [...((c.chain && c.chain.fx) || [])] },
    })),
  };
}

// Resolve a card reference: card id first, then instrument id (first match).
function findCard(ws, ref) {
  return (ws.cards.find((x) => x.id === ref) || ws.cards.find((x) => x.instrumentId === ref) || null);
}

// ── rosters ─────────────────────────────────────────────────────────────────

// Start a workspace from one or more traditions (deterministic default cards).
function seed(traditionIds) {
  const ids = Array.isArray(traditionIds) ? traditionIds : [traditionIds];
  if (ids.length === 0) throw new WorkspaceError('seed needs at least one tradition id');
  const ws = emptyWorkspace();
  for (const id of ids) {
    const cards = seedTraditionCards(id);
    if (!cards) throw new WorkspaceError(`Unknown tradition: "${id}"`);
    ws.cards.push(...cards);
  }
  return ws;
}

function addTradition(ws, traditionId) {
  const cards = seedTraditionCards(traditionId);
  if (!cards) throw new WorkspaceError(`Unknown tradition: "${traditionId}"`);
  const next = clone(ws);
  next.cards.push(...cards);
  return next;
}

function removeTradition(ws, traditionId) {
  if (!tradById(traditionId)) throw new WorkspaceError(`Unknown tradition: "${traditionId}"`);
  const next = clone(ws);
  next.cards = next.cards.filter((c) => c.traditionId !== traditionId);
  return next;
}

// ── instruments ───────────────────────────────────────────────────────────────

// Add an instrument card. With { tradition } it inherits that tradition's env +
// part overrides (a roster instrument seeds identically to import; a guest gets
// the tradition's env + applicable overrides). Without context: bare defaults.
function addInstrument(ws, instrumentId, opts = {}) {
  if (!instById(instrumentId)) throw new WorkspaceError(`Unknown instrument: "${instrumentId}"`);
  const next = clone(ws);
  let card = null;
  if (opts.tradition) {
    const trad = tradById(opts.tradition);
    if (!trad) throw new WorkspaceError(`Unknown tradition context: "${opts.tradition}"`);
    const seeded = seedTraditionCards(opts.tradition) || [];
    const match = seeded.find((c) => c.instrumentId === instrumentId);
    card = match || makeCard(instrumentId, { traditionId: opts.tradition, tuning: trad.tuning, room: trad.room });
  } else {
    card = makeCard(instrumentId, {});
  }
  if (!card) throw new WorkspaceError(`Could not build card for "${instrumentId}"`);
  next.cards.push(card);
  return next;
}

function removeInstrument(ws, cardRef) {
  const next = clone(ws);
  const c = findCard(next, cardRef);
  if (!c) throw new WorkspaceError(`No card matching "${cardRef}"`);
  next.cards = next.cards.filter((x) => x.id !== c.id);
  return next;
}

// ── per-card overrides ────────────────────────────────────────────────────────

function setVariant(ws, cardRef, partId, variantId) {
  const next = clone(ws);
  const card = findCard(next, cardRef);
  if (!card) throw new WorkspaceError(`No card matching "${cardRef}"`);
  const inst = instById(card.instrumentId);
  const part = (inst.parts || []).find((p) => p.id === partId);
  if (!part) throw new WorkspaceError(`${card.instrumentId} has no part "${partId}"`);
  if (!(part.variants || []).some((v) => v.id === variantId)) {
    throw new WorkspaceError(`${card.instrumentId}.${partId} has no variant "${variantId}"`);
  }
  card.parts[partId] = variantId;
  return next;
}

function setEnvironment(ws, cardRef, { room, tuning, chain } = {}) {
  const next = clone(ws);
  const card = findCard(next, cardRef);
  if (!card) throw new WorkspaceError(`No card matching "${cardRef}"`);
  if (room !== undefined) {
    if (room !== null && !(C.ROOMS || []).find((r) => r.id === room)) throw new WorkspaceError(`Unknown room: "${room}"`);
    card.room = room;
  }
  if (tuning !== undefined) {
    if (tuning !== null && !(C.TUNINGS || []).find((t) => t.id === tuning)) throw new WorkspaceError(`Unknown tuning: "${tuning}"`);
    card.tuning = tuning;
  }
  if (chain && typeof chain === 'object') {
    for (const [stage, id] of Object.entries(chain)) card.chain[stage] = id;
  }
  return next;
}

// set_preface — deterministic re-derive (the headline edit).
function setPreface(ws, cardRef, prefaceId) {
  if (!prefaceById(prefaceId)) throw new WorkspaceError(`Unknown preface: "${prefaceId}"`);
  const next = clone(ws);
  const card = findCard(next, cardRef);
  if (!card) throw new WorkspaceError(`No card matching "${cardRef}"`);
  const res = inverseConfigure(card, prefaceId);
  if (!res) throw new WorkspaceError(`Cannot apply preface "${prefaceId}" to "${card.instrumentId}"`);
  card.parts = { ...res.config.parts };
  card.tuning = res.config.tuning;
  card.room = res.config.room;
  card.chain = { ...res.config.chain };
  card.preface = prefaceId;
  card.prefaceLock = true;   // renderer surfaces it verbatim; others dedup around it
  card.prefaceAuto = false;
  return next;
}

// ── render ────────────────────────────────────────────────────────────────────

// Render any workspace to the recipe string. Clones first so assignDedupedPrefaces
// (which writes card.preface for auto cards) never mutates the caller's workspace.
function render(ws, opts) {
  return renderWorkspace(clone(ws).cards, opts);
}

module.exports = {
  emptyWorkspace,
  seed,
  addTradition,
  removeTradition,
  addInstrument,
  removeInstrument,
  setVariant,
  setEnvironment,
  setPreface,
  render,
  findCard,
  WorkspaceError,
};
