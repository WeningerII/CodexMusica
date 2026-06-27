// _matcher.js — card factory + audit-enriched card descriptors.
//
// Two responsibilities, both card-shaped:
//   1. CARD CONSTRUCTION — `defaultCard(traditionId, instrumentId)` builds
//      the canonical default-variant card for a (tradition, instrument)
//      pair; `cardFromConfig(config, instrumentId)` builds a card from a
//      search-output config (used by `recipe.js` to feed the
//      --why-prefaces diagnostic and the live recipe stack).
//   2. AUDIT-ENRICHED DESCRIPTORS — `cardDescriptors(card)` produces the
//      ENRICHED descriptor set (pools `variant.descriptors` AND
//      `variant.match_tokens`). This is the AUTHORING / AUDIT semantic:
//      "what tokens exist anywhere in the catalog associated with this
//      card?" — DIFFERENT from the PRODUCTION semantic in
//      `_card_descriptors.js`, which pools descriptors only (matching
//      the HTML embed's `_cardDescriptorSet`).
//
// The divergence is intentional and locked in by the tandem check
// `card-descriptor semantics aligned (production vs audit)`. The audit
// harvester here is consumed by `audit_dead_tokens.js` and
// `build_variants.js`; the production harvester is consumed by
// `regression_prefaces.js` and (via the HTML embed) by every user
// session in the browser. See the tandem check's comment for the
// rationale.
//
// History note: this file once owned the v1 habitat-based preface matcher
// (`survivors`, `topSurvivors`). Those functions were dead under v2 data
// (every preface had migrated to `.tokens`, leaving `if (!h) continue` to
// short-circuit every iteration). Both were deleted; the v2 algorithm now
// lives in `_preface_match.js`.

const fs = require('fs');
const path = require('path');
const C = require('./_loader.js');

const SIGS_PATH = path.join(__dirname, '..', 'references', '_tradition_signatures.json');
let sigsCache = null;
function getSigs() {
  if (sigsCache === null) sigsCache = JSON.parse(fs.readFileSync(SIGS_PATH, 'utf8'));
  return sigsCache;
}

function Inst(id) {
  return C.INSTRUMENTS.find((x) => x.id === id);
}
function Tuning(id) {
  return (C.TUNINGS || []).find((x) => x.id === id);
}
function Room(id) {
  return (C.ROOMS || []).find((x) => x.id === id);
}
function ChainItem(stage, itemId) {
  for (const sec of C.CHAIN_SECTIONS) {
    if (sec.stage === stage || sec.id === stage) {
      const it = (sec.items || []).find((x) => x.id === itemId);
      if (it) return it;
    }
  }
  return null;
}

// Build the descriptor set for a card. The shape of `card`:
//   { traditionId, instrumentId, parts: { partId: variantId, ... },
//     tuning, room, chain: { mic, pre, medium, console } }
function cardDescriptors(card) {
  const inst = Inst(card.instrumentId);
  if (!inst) return new Set();
  const s = new Set();
  for (const p of inst.parts || []) {
    const v = (p.variants || []).find((x) => x.id === card.parts[p.id]);
    if (v) {
      for (const d of v.descriptors || []) s.add(d);
      // match_tokens: matcher-only enrichment (dictionary-derived, systematic).
      // Pooled into card descriptors for preface scoring but NOT consumed by the
      // recipe renderer — keeps matching signal decoupled from rendering surface.
      for (const d of v.match_tokens || []) s.add(d);
    }
  }
  if (card.tuning) {
    const t = Tuning(card.tuning);
    if (t) for (const d of t.descriptors || []) s.add(d);
  }
  if (card.room) {
    const r = Room(card.room);
    if (r) for (const d of r.descriptors || []) s.add(d);
  }
  if (card.chain) {
    for (const sid of ['mic', 'pre', 'medium', 'console']) {
      const iid = card.chain[sid];
      if (!iid) continue;
      const it = ChainItem(sid, iid);
      if (it) for (const d of it.descriptors || []) s.add(d);
    }
  }
  const sigs = getSigs();
  for (const d of sigs[card.traditionId] || []) s.add(d);
  return s;
}

// Build a default card from a tradition+instrument: takes the default variant
// of every part (or first variant if no default), plus the tradition's tuning,
// room, and chain inline. Used by the reach probe and tie audit.
function defaultCard(traditionId, instrumentId) {
  const t = C.TRADITIONS.find((x) => x.id === traditionId);
  const inst = Inst(instrumentId);
  if (!t || !inst) return null;
  const parts = {};
  for (const p of inst.parts || []) {
    const def = (p.variants || []).find((v) => v.default);
    if (def) parts[p.id] = def.id;
    else if (p.variants.length > 0) parts[p.id] = p.variants[0].id;
  }
  return {
    traditionId,
    instrumentId,
    parts,
    tuning: t.tuning,
    room: t.room,
    chain: {
      mic: t.chain_mic,
      pre: t.chain_pre,
      medium: t.chain_medium,
      console: t.chain_console,
    },
  };
}

// Build a card from a recipe.js search config — uses the SEARCH-PICKED variants
// (not defaults). Honors per-instrument slot overrides from result.config.
function cardFromConfig(config, instrumentId) {
  const primaryTradId = config.traditions[0];
  const instEntry = config.instruments.find((x) => x.id === instrumentId);
  if (!instEntry) return null;
  return {
    traditionId: primaryTradId,
    instrumentId,
    parts: { ...(instEntry.slots || {}) },
    tuning: config.tuning,
    room: config.room,
    chain: {
      mic: config.inline_chain && config.inline_chain.mic,
      pre: config.inline_chain && config.inline_chain.pre,
      medium: config.inline_chain && config.inline_chain.medium,
      console: config.inline_chain && config.inline_chain.console,
    },
  };
}

module.exports = {
  cardDescriptors,
  defaultCard,
  cardFromConfig,
};
