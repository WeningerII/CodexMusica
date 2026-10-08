'use strict';
// _seed_workspace.js — deterministic, import-faithful workspace seeding + render.
//
// This is the Node side of the connector⇄"Current Recipe" parity work
// It mirrors the browser's deterministic
// pipeline — NOT the engine's hill-climb search:
//
//   src/app.js importTradition() → makeCard()/defaultParts()/_voicePartsForTradition()
//
// so a freshly-seeded recipe reproduces the app's "Current Recipe" byte-for-byte
// (verified by scripts/check_connector_parity.js). It deliberately does NOT call
// search.js / seedFromTradition — no scoring, no auto-stapling. A tradition's
// roster is exactly its `instruments`, and the genre header is exactly the
// traditions whose cards are present (primary roster), which is why the header
// reads "Garage rock," and not the search seed's "Garage rock + Punk + Hardcore".
//
// Rendering reuses the shared SSOT renderer (_recipe_stack.js): assignDedupedPrefaces
// then compileStack('rich'). The only addition is a cards-based header (the app's
// _recipeHeader(cards)); a config's stapled-tradition list
// is the wrong source for the workspace model.

const C = require('./_loader.js');
const { assignDedupedPrefaces, compileStack } = require('./_recipe_stack.js');
const { TUNING_TO_VOICE_PARTS, TRADITION_VOICE_OVERRIDES } = require('./_voice_parts_data.js');

const instById = (id) => (C.INSTRUMENTS || []).find((i) => i.id === id);
// A retired (merged) tradition id resolves to the tradition it was merged into,
// so seeded cards carry the surviving id.
const tradById = (id) => {
  const live = C.resolveTraditionId(id);
  return (C.TRADITIONS || []).find((t) => t.id === live);
};

// CARD IDS COME FROM THE WORKSPACE THEY JOIN, never from process state.
//
// A card id is how a caller names a card in its next edit, and the workspace
// that holds it outlives the process that minted it: a caller-managed workspace
// is threaded across calls, and a session stores one durably across deploys. A
// module-level counter restarted at card_1 on every boot, so the first card
// added after a restart took an id the workspace already held — and one
// remove_instrument {card:"card_1"} then deleted two cards. Numbering past the
// highest id already present is a pure function of the workspace, so it cannot
// collide with anything in it, and a fresh seed numbers card_1..card_n every
// time (start_recipe is idempotent in its ids as well as its recipe).
const CARD_ID = /^card_(\d+)$/;
function nextCardIds(existing, count) {
  let max = 0;
  for (const c of existing || []) {
    const m = CARD_ID.exec((c && c.id) || '');
    if (m) max = Math.max(max, Number(m[1]));
  }
  return Array.from({ length: count }, (_, i) => `card_${max + 1 + i}`);
}

// ── card construction (mirrors src/app.js) ──────────────────────────────────

// defaultParts: pick the variant marked `default: true` per part; parts with no
// default stay unselected (matches src/app.js defaultParts exactly — NOT "first").
function defaultParts(inst) {
  const out = {};
  for (const p of inst.parts || []) {
    if (!p.variants || !p.variants.length) continue;
    const def = p.variants.find((v) => v.default === true);
    if (def) out[p.id] = def.id;
  }
  return out;
}

function emptyChain() {
  return {
    fx: [],
    amp: null,
    mic: null,
    pre: null,
    comp: null,
    eq: null,
    medium: null,
    console: null,
  };
}

// _voicePartsForTradition: TUNING_TO_VOICE_PARTS[tuning] < TRADITION_VOICE_OVERRIDES[id]
// < trad.parts (later layers win). Mirrors src/app.js:_voicePartsForTradition.
function voicePartsForTradition(trad) {
  if (!trad) return {};
  const out = {};
  Object.assign(out, (trad.tuning && TUNING_TO_VOICE_PARTS[trad.tuning]) || {});
  Object.assign(out, (trad.id && TRADITION_VOICE_OVERRIDES[trad.id]) || {});
  if (trad.parts) Object.assign(out, trad.parts);
  return out;
}

// makeCard: defaultParts(inst) with partsOverride merged in, filtered to part_ids
// that exist on this instrument and variant_ids valid for that part. Mirrors
// src/app.js:makeCard (UI-transient fields omitted; preface left for the renderer
// to auto-assign via assignDedupedPrefaces, matching the app's prefaceAuto cards).
function makeCard(instrumentId, opts = {}) {
  const inst = instById(instrumentId);
  if (!inst) return null;
  const parts = defaultParts(inst);
  if (opts.partsOverride) {
    const byId = new Map((inst.parts || []).map((p) => [p.id, p]));
    for (const [pid, vid] of Object.entries(opts.partsOverride)) {
      const part = byId.get(pid);
      if (!part) continue;
      if ((part.variants || []).some((v) => v.id === vid)) parts[pid] = vid;
    }
  }
  return {
    id: opts.id || nextCardIds([], 1)[0],
    instrumentId,
    parts,
    tuning: opts.tuning || null,
    room: opts.room || null,
    chain: opts.chain || emptyChain(),
    traditionId: opts.traditionId || null,
    preface: null,
    prefaceAuto: true,
  };
}

// Resolve the amp_make variant per instrument class (bass vs guitar) from the
// tradition's chain_amp_bass / chain_amp_guitar / chain_amp, against the
// instrument's amp_make variants. Mirrors src/app.js:importTradition.
function resolveAmpVariant(inst, trad) {
  const ampPart = inst ? (inst.parts || []).find((p) => p.id === 'amp_make') : null;
  if (!ampPart) return null;
  const valid = new Set(ampPart.variants.map((v) => v.id));
  const isBass = inst.id.includes('bass') || inst.id.includes('contrabass');
  const candidates = [];
  if (isBass) {
    if (trad.chain_amp_bass) candidates.push(trad.chain_amp_bass);
  } else {
    if (trad.chain_amp_guitar) candidates.push(trad.chain_amp_guitar);
  }
  const general = trad.chain_amp;
  if (Array.isArray(general)) candidates.push(...general);
  else if (typeof general === 'string') candidates.push(general);
  return candidates.find((a) => valid.has(a)) || null;
}

// The makeCard options for `instrumentId` joining `trad`: the tradition's tuning,
// room and recording chain, its voice-part overrides and the amp that suits this
// instrument. Mirrors src/app.js:traditionCardOpts, which is the single
// derivation both of the app's paths run through — a tradition's own import, and
// "add instrument to this tradition" for an instrument off its roster — so the
// two cannot configure the same pairing differently. The connector used to build
// the second path by hand from tuning and room alone, so a guest card had no
// signal chain, and moved to the front it rendered a recipe with none.
//
// The chain is a fresh object per call: cards own their chain, and ops clone
// before they write, but nothing should rely on that to keep siblings apart.
function traditionCardOpts(trad, instrumentId) {
  const inst = instById(instrumentId);
  const partsOverride = voicePartsForTradition(trad);
  const ampVariant = inst ? resolveAmpVariant(inst, trad) : null;
  return {
    traditionId: trad.id,
    tuning: trad.tuning,
    room: trad.room,
    chain: {
      fx: Array.isArray(trad.chain_fx) ? trad.chain_fx.slice() : [],
      amp: null,
      mic: trad.chain_mic || null,
      pre: trad.chain_pre || null,
      comp: trad.chain_comp || null,
      eq: trad.chain_eq || null,
      medium: trad.chain_medium || null,
      console: trad.chain_console || null,
    },
    partsOverride: ampVariant
      ? Object.assign({}, partsOverride, { amp_make: ampVariant })
      : partsOverride,
  };
}

// ── public: seed a tradition's deterministic default cards ───────────────────

// Equivalent of src/app.js:importTradition(tradId) — the deterministic default
// workspace for a tradition. Returns an array of cards (recipe order = the
// tradition's `instruments` order), or null for an unknown tradition. `existing`
// is the workspace the cards will join; their ids continue past its highest.
function seedTraditionCards(traditionId, existing = []) {
  const trad = tradById(traditionId);
  if (!trad) return null;
  const cards = [];
  for (const iid of trad.instruments || []) {
    const card = makeCard(iid, traditionCardOpts(trad, iid));
    if (card) cards.push(card);
  }
  const ids = nextCardIds(existing, cards.length);
  cards.forEach((c, i) => (c.id = ids[i]));
  return cards;
}

// ── public: render the workspace (the "Current Recipe") ──────────────────────

// Genre header from the cards' OWN traditions, in first-appearance order
// (mirrors src/app.js:_recipeHeader(cards)). Primary roster — no search staples.
function recipeHeaderFromCards(cards) {
  const seen = new Set();
  const names = [];
  for (const c of cards || []) {
    if (!c || !c.traditionId || seen.has(c.traditionId)) continue;
    seen.add(c.traditionId);
    const t = tradById(c.traditionId);
    if (t && t.name) names.push(t.name);
  }
  return names.length ? names.join(' + ') + ', ' : '';
}

// Render a workspace (array of cards) to the recipe string. Default format
// 'rich' = the app's "Current Recipe". Header + body within `ceiling`, prefaces
// auto-assigned (deduped) unless a card's preface is pinned (prefaceAuto === false).
function renderWorkspace(cards, { format = 'rich', ceiling } = {}) {
  if (!cards || cards.length === 0) return '';
  assignDedupedPrefaces(cards);
  // Hard recipe ceiling (RECIPE_CHAR_CEILING): clamp the total budget before
  // the header is subtracted so header+body can never exceed the cap.
  const { RECIPE_CHAR_CEILING } = require('./_api_contract.js');
  const cap = Math.min(ceiling || RECIPE_CHAR_CEILING, RECIPE_CHAR_CEILING);
  const header = recipeHeaderFromCards(cards);
  if (header.length >= cap) return header.slice(0, Math.max(0, cap - 1)) + '…';
  const body = compileStack(cards, format, Math.max(1, cap - header.length));
  const rendered = header + body;
  return rendered.length <= cap ? rendered : rendered.slice(0, Math.max(0, cap - 1)) + '…';
}

// Only what another module actually imports. recipeHeaderFromCards,
// voicePartsForTradition and resolveAmpVariant were exported "for the op layer +
// tests" but no caller ever took them — each is used exactly once, inside this
// file. An export nobody imports is not an API, it is a claim that this file's
// internals are someone else's business.
module.exports = {
  seedTraditionCards,
  renderWorkspace,
  // building blocks (imported by the op layer)
  makeCard,
  defaultParts,
  traditionCardOpts,
  nextCardIds,
};
