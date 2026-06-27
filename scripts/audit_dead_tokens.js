#!/usr/bin/env node
// audit_dead_tokens.js — fail if any preface profile references a token
// that no card descriptor produces.
//
// Dead tokens are silent: they don't error, they just never match. Over time
// they accumulate as aspirational vocabulary that does no work. This check
// catches them at gate time.
//
// IMPORTANT: This audit consumes the AUDIT-ENRICHED card-descriptor
// extractor (`_matcher.js:cardDescriptors`, which pools both
// `variant.descriptors` AND `variant.match_tokens`). This is a deliberate
// divergence from production: the HTML embed and the regression gate use
// the leaner `_card_descriptors.js:cardDescriptors` (descriptors only).
// The two semantics answer different questions:
//   - Production (`_card_descriptors`): "what tokens does this card surface
//     to the user in the rendered preface assignment?"
//   - Audit (`_matcher`): "what tokens exist anywhere in the authoring
//     catalog associated with this card?"
//
// The audit asks the second question on purpose. A token that's only
// reachable via match_tokens enrichment isn't dead — it's part of the
// authored catalog vocabulary, even if production doesn't surface it.
// The tandem check `card-descriptor semantics aligned (production vs
// audit)` locks in this distinction. See that check's comment for the
// design rationale.

const C = require('./_loader.js');
const M = require('./_matcher.js');

// Build a tradition-aware card: start from defaultCard (part defaults),
// then overlay any tradition.parts assignments. This makes the audit
// reflect actual catalog state — tokens reachable via tradition-customized
// variants count, not just tokens reachable via the strip-down baseline.
function traditionCard(traditionId, instrumentId) {
  const card = M.defaultCard(traditionId, instrumentId);
  if (!card) return null;
  const t = C.TRADITIONS.find((x) => x.id === traditionId);
  if (t && t.parts) {
    for (const [partId, variantId] of Object.entries(t.parts)) {
      if (card.parts && card.parts[partId] !== undefined) card.parts[partId] = variantId;
    }
  }
  return card;
}

const allCard = new Set();
for (const t of C.TRADITIONS)
  for (const iid of t.instruments || []) {
    for (const tok of M.cardDescriptors(traditionCard(t.id, iid))) allCard.add(tok);
  }

const issues = [];
for (const e of C.PREFACE_LEXICON) {
  const tokens = Array.isArray(e.tokens) ? e.tokens : [];
  const dead = tokens.filter((t) => !allCard.has(t));
  if (dead.length > 0) issues.push({ id: e.id, dead });
}

if (issues.length === 0) {
  console.log('DEAD-TOKEN AUDIT: CLEAN — all profile tokens match at least one card descriptor.');
  process.exit(0);
}
console.log(
  'DEAD-TOKEN AUDIT: FAIL — ' + issues.length + ' preface(s) reference tokens no card produces.'
);
console.log("Dead tokens fire on nothing; they're aspirational vocabulary doing no work.\n");
for (const i of issues) console.log('  ' + i.id + ': ' + i.dead.join(', '));
process.exit(1);
