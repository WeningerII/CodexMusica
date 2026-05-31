// _preface_match.js — canonical preface match-and-score primitives.
//
// SINGLE SOURCE OF TRUTH for the v2 preface-matching algorithm. There are
// TWO places where this logic lives in the codex:
//   1. src/app.js:_matchSurvivors — production
//      runtime, shipped inside codex.html. Computes scores against
//      PREFACE_LEXICON entries when the user assembles a card in the browser.
//   2. scripts/regression_prefaces.js — gated regression test. Calls these
//      primitives directly to compute its `suggest()` for each fixture.
//
// The HTML embed (#1) CANNOT import this module — it ships as a self-
// contained HTML page with no Node runtime. So the embedded version is
// duplicated by design; the tandem-check `preface-matcher alignment` (in
// tandem.js) detects silent drift between the embed and this module
// textually by extracting the embed's algorithm and comparing the
// scoring expression and tiebreak.
//
// Anytime you edit the algorithm here, ALSO edit `_matchSurvivors` in
// `src/app.js` to match. The tandem check will
// fail loudly until both are aligned.
//
// History note: a `scripts/_matcher_v2.js` thin-adapter file existed as a
// Node-side reference until the audit tools that consumed it were archived
// (`_renderer_v2.js`, `audit_distribution.js`, `compare_v1_v2.js` — all in
// `_one_off/`). The adapter is archived alongside them.
//
// The model is precision-normalized: score = |shared tokens| / |preface tokens|.
// Bounded [0, 1]. No gates. No filters. No negation. Tiebreaks deterministic
// by alphabetical preface id.

// Derive the v2 token profile from a preface lexicon entry.
// If the entry already has a flat `tokens` array, use it.
// Otherwise, fall back to the v1 habitat representation by merging
// mustHave + mustHaveAny + register into one Set.
function tokensOf(preface) {
  if (Array.isArray(preface.tokens) && preface.tokens.length > 0) return preface.tokens;
  const h = preface.habitat || {};
  const seen = new Set();
  for (const t of (h.mustHave || [])) seen.add(t);
  for (const t of (h.mustHaveAny || [])) seen.add(t);
  for (const t of (h.register || [])) seen.add(t);
  return Array.from(seen);
}

// Compute the precision-normalized score for a single preface against a
// card-descriptor Set. Returns 0 if either side is empty or no overlap.
function score(prefaceTokens, cardDescriptorSet) {
  if (!prefaceTokens || prefaceTokens.length === 0) return 0;
  let shared = 0;
  for (const t of prefaceTokens) if (cardDescriptorSet.has(t)) shared++;
  if (shared === 0) return 0;
  return shared / prefaceTokens.length;
}

// Rank every preface in `lexicon` against `cardDescriptorSet`. Returns a
// descending-sorted array of { entry, i, score }, skipping zero-scoring
// entries. Tiebreaks alphabetically by entry.id (deterministic).
function rank(cardDescriptorSet, lexicon) {
  if (cardDescriptorSet.size === 0) return [];
  const out = [];
  for (let i = 0; i < lexicon.length; i++) {
    const entry = lexicon[i];
    const tokens = tokensOf(entry);
    const s = score(tokens, cardDescriptorSet);
    if (s === 0) continue;
    out.push({ entry, i, score: s });
  }
  out.sort((a, b) => b.score - a.score || a.entry.id.localeCompare(b.entry.id));
  return out;
}

// Pick the single best-scoring preface id for a card, or null if none score.
// Convenience wrapper for callers that don't need the full ranked list.
function suggest(cardDescriptorSet, lexicon) {
  const r = rank(cardDescriptorSet, lexicon);
  return r.length > 0 ? r[0].entry.id : null;
}

module.exports = { tokensOf, rank, suggest };
