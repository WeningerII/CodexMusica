// _card_descriptors.js — production-aligned card-descriptor harvester.
//
// Given a card, return the Set of descriptors that contribute to preface
// scoring AS IT RUNS IN THE SHIPPED HTML. This pools:
//   - Each picked variant's `descriptors` array
//   - The card's tuning's `descriptors` array (if any)
//   - The card's room's `descriptors` array (if any)
//   - Each picked chain stage's item's `descriptors` array (mic/pre/medium/console)
//   - The tradition's signature descriptors from `_tradition_signatures.json`
//
// DOES NOT pool `match_tokens` from variants. This is the production
// behavior, mirroring `src/app.js:_cardDescriptorSet`
// (the embedded matcher that shipped users see).
//
// DIVERGENCE NOTE — `_matcher.js:cardDescriptors` IS NOT the same function.
// It pools both `descriptors` AND `match_tokens`, producing a richer set.
// That version is used by the two remaining offline authoring/audit tools
// (`audit_dead_tokens.js`, `build_variants.js`) for analyses that benefit
// from the enriched dictionary signal — they ask "what tokens exist
// anywhere in the authoring catalog?" rather than "what tokens surface
// to the user?"
//
// The divergence is intentional and locked in by the tandem check
// `card-descriptor semantics aligned (production vs audit)`. Each side
// answers a different question; both questions are valid.
//
// Consumers:
//   - regression_prefaces.js (gate test for preface assignments) — the only
//     active Node consumer. The HTML embed's `_cardDescriptorSet` mirrors
//     this function's logic but cannot import it (ships standalone); the
//     `preface-matcher alignment` tandem check enforces algorithmic parity
//     between the two.
//
// Signature: cardDescriptors(card, C, sigs) where:
//   - card  is { instrumentId, parts, tuning, room, chain, traditionId }
//   - C     is the loaded catalog (./_loader.js)
//   - sigs  is the tradition-signatures object (references/_tradition_signatures.json)

function cardDescriptors(card, C, sigs) {
  const inst = C.INSTRUMENTS.find(x => x.id === card.instrumentId);
  if (!inst) return new Set();
  const set = new Set();

  // Variant descriptors (descriptors only — NOT match_tokens).
  for (const partDef of (inst.parts || [])) {
    const variantId = card.parts && card.parts[partDef.id];
    if (!variantId) continue;
    const variant = (partDef.variants || []).find(v => v.id === variantId);
    if (variant) {
      for (const d of (variant.descriptors || [])) set.add(d);
    }
  }

  // Tuning descriptors.
  if (card.tuning) {
    const t = (C.TUNINGS || []).find(x => x.id === card.tuning);
    if (t) for (const d of (t.descriptors || [])) set.add(d);
  }

  // Room descriptors.
  if (card.room) {
    const r = (C.ROOMS || []).find(x => x.id === card.room);
    if (r) for (const d of (r.descriptors || [])) set.add(d);
  }

  // Chain-stage item descriptors.
  if (card.chain) {
    for (const stageId of ['mic', 'pre', 'medium', 'console']) {
      const itemId = card.chain[stageId];
      if (!itemId) continue;
      const stage = (C.CHAIN_SECTIONS || []).find(s => s.stage === stageId || s.id === stageId);
      if (!stage) continue;
      const item = (stage.items || []).find(x => x.id === itemId);
      if (item) for (const d of (item.descriptors || [])) set.add(d);
    }
  }

  // Tradition signature.
  if (card.traditionId && sigs) {
    for (const d of (sigs[card.traditionId] || [])) set.add(d);
  }

  return set;
}

module.exports = { cardDescriptors };
