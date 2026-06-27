// _card_descriptors.js — production-aligned card-descriptor harvester, authored ONCE.
//
// Given a card, return the Set of descriptors that contribute to preface
// scoring AS IT RUNS IN THE SHIPPED HTML. This pools:
//   - Each picked variant's `descriptors` array
//   - The card's tuning's `descriptors` array (if any)
//   - The card's room's `descriptors` array (if any)
//   - Each picked chain stage's item's `descriptors` array (mic/pre/medium/console)
//   - The tradition's signature descriptors from `_tradition_signatures.json`
//
// DOES NOT pool `match_tokens` from variants. This is the production behavior.
//
// SINGLE SOURCE OF TRUTH for both front-ends. The core `harvestDescriptors`
// (between the @inline markers) takes its catalog lookups as an injected
// `lookups` object, so it has NO dependency on how either side stores the
// catalog. Both consumers pass a tiny adapter built from what they already have:
//   - Node    : `cardDescriptors(card, C, sigs)` below adapts the loaded tables.
//   - Browser : scripts/build_html.js inlines the marked core into codex.html,
//     where a thin `_cardDescriptorSet(card)` adapter feeds it the app's index
//     maps (Inst/Tuning/Room/ChainItem/_traditionSignatureFor).
// This replaces the former hand-duplicated copy in src/app.js. The
// `equivalence.js` test asserts both sides still produce identical sets, and
// the `card-descriptor semantics aligned` tandem check guards the divergence
// from the audit-side harvester (`_matcher.js`, which DOES pool match_tokens).
//
// DIVERGENCE NOTE — `_matcher.js:cardDescriptors` IS NOT the same function.
// It pools both `descriptors` AND `match_tokens` for offline audit tools
// (audit_dead_tokens.js, build_variants.js). Intentional; locked by tandem.
'use strict';

/* @inline-start — the region between the markers is inlined verbatim into codex.html */
// harvestDescriptors(card, lookups) — the one true production harvester.
// lookups = {
//   inst(id)            -> instrument record (with merged .parts) or null
//   tuning(id)          -> tuning record or null
//   room(id)            -> room record or null
//   chainItem(stage,id) -> chain-section item record or null   (stage ∈ mic|pre|medium|console)
//   signature(tradId)   -> array of tradition signature descriptors (or [])
// }
function harvestDescriptors(card, lookups) {
  const set = new Set();
  if (!card) return set;
  const inst = lookups.inst(card.instrumentId);
  if (!inst) return set;

  // Variant descriptors (descriptors only — NOT match_tokens).
  for (const partDef of inst.parts || []) {
    const variantId = card.parts && card.parts[partDef.id];
    if (!variantId) continue;
    const variant = (partDef.variants || []).find((v) => v.id === variantId);
    if (variant) for (const d of variant.descriptors || []) set.add(d);
  }

  // Tuning descriptors.
  if (card.tuning) {
    const t = lookups.tuning(card.tuning);
    if (t) for (const d of t.descriptors || []) set.add(d);
  }

  // Room descriptors.
  if (card.room) {
    const r = lookups.room(card.room);
    if (r) for (const d of r.descriptors || []) set.add(d);
  }

  // Chain-stage item descriptors.
  if (card.chain) {
    for (const stageId of ['mic', 'pre', 'medium', 'console']) {
      const itemId = card.chain[stageId];
      if (!itemId) continue;
      const item = lookups.chainItem(stageId, itemId);
      if (item) for (const d of item.descriptors || []) set.add(d);
    }
  }

  // Tradition signature.
  if (card.traditionId) {
    for (const d of lookups.signature(card.traditionId) || []) set.add(d);
  }

  return set;
}
/* @inline-end */

// Node adapter: build the lookups object from the loaded catalog + signatures.
// Signature unchanged — cardDescriptors(card, C, sigs) — so every existing
// Node consumer (regression_prefaces.js, equivalence.js, preface_configure.js)
// keeps working without edits.
function cardDescriptors(card, C, sigs) {
  const lookups = {
    inst: (id) => (C.INSTRUMENTS || []).find((x) => x.id === id) || null,
    tuning: (id) => (C.TUNINGS || []).find((x) => x.id === id) || null,
    room: (id) => (C.ROOMS || []).find((x) => x.id === id) || null,
    chainItem: (stageId, id) => {
      const stage = (C.CHAIN_SECTIONS || []).find((s) => s.stage === stageId || s.id === stageId);
      if (!stage) return null;
      return (stage.items || []).find((x) => x.id === id) || null;
    },
    signature: (tradId) => (sigs && sigs[tradId]) || [],
  };
  return harvestDescriptors(card, lookups);
}

module.exports = { cardDescriptors, harvestDescriptors };
