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

// Locale-invariant ordering: localeCompare with no locale argument collates by
// the machine's ICU locale, which made this ordering depend on where it ran.
// Mirrors `_cmp` in scripts/_recipe_stack.js.
const _cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

// Derive the v2 token profile from a preface lexicon entry.
// If the entry already has a flat `tokens` array, use it.
// Otherwise, fall back to the v1 habitat representation by merging
// mustHave + mustHaveAny + register into one Set.
function tokensOf(preface) {
  if (Array.isArray(preface.tokens) && preface.tokens.length > 0) return preface.tokens;
  const h = preface.habitat || {};
  const seen = new Set();
  for (const t of h.mustHave || []) seen.add(t);
  for (const t of h.mustHaveAny || []) seen.add(t);
  for (const t of h.register || []) seen.add(t);
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
    // `shared` is carried because the app's tiebreak needs it and recomputing it
    // downstream means re-walking every token of every surviving preface. It was
    // already being recomputed that way in _recipe_stack.js; see byAppRanking.
    out.push({
      entry,
      i,
      score: s,
      shared: tokens.filter((t) => cardDescriptorSet.has(t)).length,
    });
  }
  out.sort((a, b) => b.score - a.score || _cmp(a.entry.id, b.entry.id));
  return out;
}

// The app's ranking order, exactly: score desc, then raw SHARED-TOKEN COUNT
// desc, then id. src/app.js:suggestPrefaceForCard documents why the middle key
// exists — "prefers more-specific cultural matches" — and without it two
// prefaces at equal precision are separated alphabetically instead, which is a
// different answer, not a cosmetically different one.
//
// rank()'s own sort is deliberately left as score→id. It is consumed by
// _recipe_stack.js's dedup, whose output is gated byte-for-byte against the
// browser across all 2503 traditions and 4 formats (check_app_parity.js), and
// re-ordering underneath a passing catalog-wide gate to fix a different caller
// is how you trade a known bug for an unknown one. Callers that need the app's
// order ask for it.
function byAppRanking(a, b) {
  return b.score - a.score || b.shared - a.shared || _cmp(a.entry.id, b.entry.id);
}

// Pick the single best-scoring preface id for a card, or null if none score.
// The Node twin of src/app.js:suggestPrefaceForCard, and equivalence.js gates
// that they agree — so it has to use the app's THREE-key tiebreak. It used to
// take rank()'s first row (score→id), which silently disagreed with the browser
// whenever the top two tied on precision: on a cimbalova_muzika fiddle, the app
// answers `erhuang` and this answered `elementary`, both at 0.5. Nothing caught
// it because a tie needs an edited card to surface and the fixtures are all
// freshly-seeded ones.
function suggest(cardDescriptorSet, lexicon) {
  const r = rank(cardDescriptorSet, lexicon);
  if (r.length === 0) return null;
  return r.slice().sort(byAppRanking)[0].entry.id;
}

module.exports = { tokensOf, rank, suggest, byAppRanking };
