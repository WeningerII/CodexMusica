#!/usr/bin/env node
// Coherence scoring for the search engine.
//
// Two modes:
//
// 1. Score a variant against a tradition's structural context:
//    node scripts/score.js --variant <variant_id> --instrument <instrument_id> --tradition <tradition_id>
//
// 2. Score a full configuration JSON (used by search.js internally):
//    cat config.json | node scripts/score.js --config
//
// Configuration shape:
//   { traditions: ['afrobeat'], instruments: [{ id, slots: { part_id: variant_id } }], room, archetype, tuning, aesthetic, fx_extras }
//
// Output: numeric score plus breakdown of contributing signals.
//
// Scoring signals:
//   + descriptor overlap (weighted by canonical-suffix matches)
//   + era coherence (variant era ↔ archetype era, no time-machine conflicts)
//   + region coherence
//   (room.genre_tags / arch.genre_tags removed — rooms/archetypes are physical, not genre)
//   + neighbor-bias (do nearest-neighbor traditions also use this variant)
//   - conflict penalties (descriptor contradictions: "vintage analog" vs "digital high-resolution")
//   - era contradictions (1965 room with 2010 plugin)

const C = require('./_loader.js');

// Scoring weights. Hand-tuned in the layered scoring work; documented here
// rather than inline so a calibration pass touches one place.
const CANONICAL_CONFLICT_PENALTY = -0.05;  // sentence 1/2: bare canonical token contradicts variant — descriptor like "british" on an instrument tagged "american" gets this per token
const NEIGHBOR_WEIGHT_FACTOR     = 0.15;   // nearest-neighbor traditions contribute this fraction of their own scoring signal to the focal variant
const NEIGHBOR_BONUS_CAP_RATIO   = 0.30;   // neighbor bonus can never exceed this fraction of direct-scoring magnitude; prevents neighbors from dominating thin direct signals

// Build the structural-context vocabulary for a tradition: the union of all
// descriptor-relevant tokens we'd want a variant to overlap with.
//
// Memoized — the catalog is immutable per process so context is cacheable by tradId.
// Earlier this was being rebuilt thousands of times per recipe via the neighbor-bias
// path inside scoreVariant; the cache makes it O(unique-tradition-references) instead.
const _buildContextCache = new Map();
function buildContext(tradId) {
  const cached = _buildContextCache.get(tradId);
  if (cached !== undefined) return cached;
  const result = _buildContextUncached(tradId);
  _buildContextCache.set(tradId, result);
  return result;
}
function _buildContextUncached(tradId) {
  const t = C.TRADITIONS.find(x => x.id === tradId);
  const e = C.TRADITION_EXTRAS[tradId] || {};
  if (!t) return null;

  // NOTE — sibling token-harvester: `translate.js:buildTraditionContextTokens()`
  // enumerates a SUBSET of these same sources (name/lineage/family/parent/
  // crossRefs/description, plus room.descriptors for `all`) for the trust-
  // filter Set in sentence rendering. The two harvesters intentionally use
  // different tokenizers — score.js decomposes camelCase paths and weights
  // by source; translate.js uses a uniform splitter with length>2 filter.
  // If you add a new prose source here, audit translate.js's parallel
  // enumeration to decide whether the trust filter should see it too.

  // Three type-separated token spaces. Prose holds decomposable
  // natural-language words from name/lineage/family/parent/crossref/desc.
  // Compounds hold full-string formal hyphenated/spaced descriptors that
  // must match as units — their subtokens never escape. Singles hold
  // single-token formal descriptors (region, era, single-word room
  // descriptors). The split is load-bearing: it makes grammatical-suffix
  // bleed (e.g. `hall-like` → `organ-like` via shared subtoken `like`)
  // structurally impossible because the offending subtokens never enter
  // any space the variant can subtoken-match against.
  const prose = new Map();
  const compounds = new Map();
  const singles = new Map();

  const addProse = (tok, w) => {
    if (!tok) return;
    prose.set(tok, (prose.get(tok) || 0) + w);
  };
  const addSingle = (tok, w) => {
    if (!tok) return;
    singles.set(tok, (singles.get(tok) || 0) + w);
  };
  const addCompound = (s, w) => {
    if (!s) return;
    compounds.set(s, (compounds.get(s) || 0) + w);
  };
  const routeFormal = (s, w) => {
    if (!s) return;
    const norm = s.toLowerCase();
    if (norm.includes('-') || /\s/.test(norm)) addCompound(norm, w);
    else addSingle(norm, w);
  };

  // Source 1: tradition name + lineage → prose @ 1.0
  for (const w of (t.name + ' ' + (t.lineage || '')).toLowerCase().split(/\W+/).filter(Boolean)) {
    addProse(w, 1.0);
  }
  // Source 2: family → prose @ 1.0 (verbatim, no lowercase — matches old behavior)
  if (t.family) addProse(t.family, 1.0);
  // Source 3: parent path → prose @ 1.5 (dot-split + camelCase-split)
  if (e.parent) {
    const parts = e.parent.split('.').flatMap(s => s.replace(/([A-Z])/g, ' $1').toLowerCase().split(/\s+/)).filter(Boolean);
    for (const w of parts) addProse(w, 1.5);
  }
  // Source 4: crossRefs → prose @ 0.7
  for (const cr of (e.crossRefs || [])) {
    const ref = typeof cr === 'string' ? cr : (cr && cr.ref);
    if (!ref) continue;
    const parts = ref.split('.').flatMap(s => s.replace(/([A-Z])/g, ' $1').toLowerCase().split(/\s+/)).filter(Boolean);
    for (const w of parts) addProse(w, 0.7);
  }
  // Source 5: description → prose @ 0.3
  for (const w of (e.description || '').toLowerCase().split(/\W+/).filter(Boolean)) {
    addProse(w, 0.3);
  }

  // Sources 6-9: room. Rooms are physical/acoustic spaces, not genre
  // classifiers — genre comes from the tradition itself.
  const room = t.room ? C.ROOMS.find(r => r.id === t.room) : null;
  if (room) {
    if (room.region) addSingle(room.region.toLowerCase(), 1.0);
    if (room.era) addSingle(room.era, 0.8);  // case preserved
    if (room.scale_tier) routeFormal(room.scale_tier, 0.8);
    for (const d of (room.descriptors || [])) routeFormal(d, 0.7);
  }
  // Sources 10-11: archetype.
  const arch = t.chain_archetype ? C.CHAIN_ARCHETYPES.find(a => a.id === t.chain_archetype) : null;
  if (arch) {
    if (arch.region) addSingle(arch.region.toLowerCase(), 1.0);
    if (arch.era) addSingle(arch.era, 0.8);
  }

  return {
    tradition: t,
    extras: e,
    room,
    arch,
    prose,
    compounds,
    singles,
    eraRange: arch ? parseEra(arch.era) : (room ? parseEra(room.era) : null),
    region: arch ? arch.region : (room ? room.region : null),
  };
}

// Build a merged context from multiple traditions: primary at full weight, staples
// at the given weight (default 0.5). The result is a single context object whose
// `weights` map is the weighted sum of the per-tradition token weights.
//
// Memoized — the same tradition stack is requested many times across hill-climb
// iterations (each scoreConfig call with the same traditions but varying slots
// rebuilds context unnecessarily). Cache by (traditions | stapleWeight | excludes).
//
// Options:
//   excludeStaples: Set<string> of tradition ids to drop from the merged context.
//     Used by voice-isolated scoring: the primary tradition's `voice_isolated`
//     crossRefs identify staples that share production aesthetics (so they
//     belong in instrument/chain/room context) but NOT vocal aesthetics (so they
//     should not influence voice_quality scoring). The primary tradition itself
//     is never excluded — it's the anchor.
const _buildMergedContextCache = new Map();
function buildMergedContext(tradIds, stapleWeight = 0.5, options = {}) {
  if (!Array.isArray(tradIds) || tradIds.length === 0) return null;
  const exclude = options.excludeStaples instanceof Set ? options.excludeStaples : new Set();
  // Cache key: tradition stack ORDER MATTERS (primary at position 0) | weight | sorted exclude
  const excludeKey = exclude.size === 0 ? '' : [...exclude].sort().join(',');
  const key = tradIds.join('|') + '#' + stapleWeight + '#' + excludeKey;
  const cached = _buildMergedContextCache.get(key);
  if (cached !== undefined) return cached;
  const result = _buildMergedContextUncached(tradIds, stapleWeight, exclude);
  _buildMergedContextCache.set(key, result);
  return result;
}
function _buildMergedContextUncached(tradIds, stapleWeight, exclude) {
  const primaryCtx = buildContext(tradIds[0]);
  if (!primaryCtx) return null;
  if (tradIds.length === 1) return primaryCtx;

  // Clone primary's three Maps for mutation. Each space merges independently.
  const prose = new Map(primaryCtx.prose);
  const compounds = new Map(primaryCtx.compounds);
  const singles = new Map(primaryCtx.singles);

  const merged = {
    tradition: primaryCtx.tradition,
    extras: primaryCtx.extras,
    room: primaryCtx.room,
    arch: primaryCtx.arch,
    prose,
    compounds,
    singles,
    eraRange: primaryCtx.eraRange,
    region: primaryCtx.region,
    stapledTraditions: [],
  };

  for (let i = 1; i < tradIds.length; i++) {
    if (exclude.has(tradIds[i])) continue; // voice-isolated: skip this staple
    const stapleCtx = buildContext(tradIds[i]);
    if (!stapleCtx) continue;
    merged.stapledTraditions.push(stapleCtx.tradition);
    for (const [tok, w] of stapleCtx.prose) {
      prose.set(tok, (prose.get(tok) || 0) + w * stapleWeight);
    }
    for (const [s, w] of stapleCtx.compounds) {
      compounds.set(s, (compounds.get(s) || 0) + w * stapleWeight);
    }
    for (const [tok, w] of stapleCtx.singles) {
      singles.set(tok, (singles.get(tok) || 0) + w * stapleWeight);
    }
  }
  return merged;
}


// Identify which stapled traditions in `allTradIds` came in via a crossRef on
// the primary marked as isolated for the given part. These are the tradition
// ids that should be excluded from the merged context when scoring that part.
//
// crossRefs schema:
//   ['parent.path']                                              — string form, full merge (default)
//   [{ ref: 'parent.path', voice_isolated: true }]               — legacy: alias for isolated_parts: ['voice_quality']
//   [{ ref: 'parent.path', isolated_parts: ['part_id', ...] }]   — generalized: list of slot-ids to isolate
//
// Mixed-form arrays are supported; each crossRef is independently string or object.
function isolatedStaplesForPart(primaryTid, allTradIds, partId) {
  const e = (typeof C !== 'undefined') && C.TRADITION_EXTRAS && C.TRADITION_EXTRAS[primaryTid];
  if (!e || !Array.isArray(e.crossRefs)) return new Set();
  const isolatedRefs = new Set();
  for (const cr of e.crossRefs) {
    if (cr && typeof cr === 'object' && cr.ref) {
      // Backward-compat: voice_isolated: true ≡ isolated_parts: ['voice_quality']
      let parts = Array.isArray(cr.isolated_parts) ? cr.isolated_parts : null;
      if (!parts && cr.voice_isolated) parts = ['voice_quality'];
      if (parts && parts.includes(partId)) isolatedRefs.add(cr.ref);
    }
  }
  if (isolatedRefs.size === 0) return new Set();
  const exclude = new Set();
  for (const tid of allTradIds) {
    if (tid === primaryTid) continue;
    const te = C.TRADITION_EXTRAS[tid];
    if (!te) continue;
    for (const ref of isolatedRefs) {
      if (te.parent === ref || (te.parent || '').startsWith(ref + '.')) {
        exclude.add(tid);
        break;
      }
    }
  }
  return exclude;
}


function parseEra(eraStr) {
  if (!eraStr) return null;
  const m = String(eraStr).match(/(\d{4})\s*[–-]\s*(\d{4}|present)/);
  if (m) {
    return { start: parseInt(m[1]), end: m[2] === 'present' ? 2099 : parseInt(m[2]) };
  }
  const single = String(eraStr).match(/(\d{4})/);
  if (single) return { start: parseInt(single[1]), end: parseInt(single[1]) };
  return null;
}

// Find nearest neighbors of a tradition: axis-distance + tree-parent siblings + crossRefs
// Memoized for the same reason as buildContext — pure on tradId given immutable catalog.
const _getNeighborsCache = new Map();
function getNeighbors(tradId, n = 5) {
  const cacheKey = `${tradId}:${n}`;
  const cached = _getNeighborsCache.get(cacheKey);
  if (cached !== undefined) return cached;
  const result = _getNeighborsUncached(tradId, n);
  _getNeighborsCache.set(cacheKey, result);
  return result;
}
function _getNeighborsUncached(tradId, n = 5) {
  const t = C.TRADITIONS.find(x => x.id === tradId);
  const e = C.TRADITION_EXTRAS[tradId];
  if (!t || !e || !e.axes) return [];

  const candidates = [];
  // CrossRef targets — expand each crossRef tree-node to its traditions
  for (const cr of (e.crossRefs || [])) {
    const ref = typeof cr === 'string' ? cr : (cr && cr.ref);
    if (!ref) continue;
    for (const otherTid of Object.keys(C.TRADITION_EXTRAS)) {
      const oe = C.TRADITION_EXTRAS[otherTid];
      if (oe.parent === ref || (oe.parent || '').startsWith(ref + '.')) {
        candidates.push({ id: otherTid, src: 'crossref', weight: 1.0 });
      }
    }
  }
  // Parent siblings
  for (const otherTid of Object.keys(C.TRADITION_EXTRAS)) {
    if (otherTid === tradId) continue;
    const oe = C.TRADITION_EXTRAS[otherTid];
    if (oe.parent === e.parent) {
      candidates.push({ id: otherTid, src: 'sibling', weight: 0.7 });
    }
  }
  // Axis-distance neighbors (within global pool)
  const axisDistances = [];
  for (const otherTid of Object.keys(C.TRADITION_EXTRAS)) {
    if (otherTid === tradId) continue;
    const oe = C.TRADITION_EXTRAS[otherTid];
    if (!oe.axes) continue;
    let d = 0;
    for (const k of Object.keys(e.axes)) {
      if (oe.axes[k] !== undefined) d += Math.abs(e.axes[k] - oe.axes[k]);
    }
    axisDistances.push({ id: otherTid, dist: d });
  }
  axisDistances.sort((a, b) => a.dist - b.dist);
  for (const ax of axisDistances.slice(0, n)) {
    candidates.push({ id: ax.id, src: 'axis', weight: 0.5 / (1 + ax.dist) });
  }

  // Dedupe with weight aggregation
  const dedup = {};
  for (const c of candidates) {
    if (!dedup[c.id]) dedup[c.id] = { id: c.id, weight: 0, srcs: [] };
    dedup[c.id].weight += c.weight;
    dedup[c.id].srcs.push(c.src);
  }
  const out = Object.values(dedup).sort((a, b) => b.weight - a.weight);
  return out.slice(0, n * 2);
}

// Score a variant against a built context. Returns { score, signals[] }.
//
// Performance: descriptor tokens, canonical-prefix, and era-regex parse are
// cached per-descriptor since the same descriptor string is scored against
// many contexts during search hill-climbing (saves ~9183 descriptors × N
// scoring calls × tokenize cost).
const _descTokenCache = new Map();
const _descEraYearCache = new Map();
const _descEraMarkerCache = new Map();
// Parse cache: lookupDescriptor's per-call work — lowercase, compound check,
// subtoken split — depends only on the descriptor string, not on context.
// The hot path (search → scoreConfig → scoreVariant → lookupDescriptor) hits
// the same descriptor many times across iterations and across the descriptor's
// presence in multiple variants; caching the parsed form drops the inner-loop
// to a single Map lookup + the actual context probes.
const _descParseCache = new Map();
const SPLIT_RE = /[-\s]/;
const WHITESPACE_RE = /\s/;
const ERA_MODERN_RE = /modern|digital|daw|in-the-box|streaming|2020|2010/i;
const ERA_VINTAGE_RE = /vintage|tube|tape|analog|1950|1960|1970/i;
// Era-year extraction is bounded to plausible calendar years. A bare 4-digit
// run is NOT necessarily a year: gear model numbers (ARP 2600, Mellotron
// M4000D) and frequencies ("3000hz") collide with the pattern and were being
// misread as the years 2600/4000/3000 → spurious era-conflict penalties on
// what are often modern descriptors. Scan every 4-digit run and take the first
// inside [ERA_YEAR_MIN, ERA_YEAR_MAX]; this rejects model numbers/frequencies
// AND recovers the real year when it sits alongside one (e.g.
// "...-2600-1971-..." → 1971, "...m4000d-...-post-2007" → 2007).
const ERA_YEAR_RE = /\d{4}/g;
const ERA_YEAR_MIN = 1400;
const ERA_YEAR_MAX = 2099;
function _getDescTokens(desc) {
  let toks = _descTokenCache.get(desc);
  if (!toks) {
    toks = desc.toLowerCase().split(SPLIT_RE);
    _descTokenCache.set(desc, toks);
  }
  return toks;
}
// Returns { norm, isCompound, subtokens } for a descriptor. subtokens is
// populated only when isCompound is true (the only path that needs them).
function _getDescParse(desc) {
  let p = _descParseCache.get(desc);
  if (!p) {
    const norm = desc.toLowerCase();
    const isCompound = norm.indexOf('-') >= 0 || WHITESPACE_RE.test(norm);
    p = { norm, isCompound, subtokens: isCompound ? _getDescTokens(norm) : null };
    _descParseCache.set(desc, p);
  }
  return p;
}
function _getEraYear(desc) {
  if (_descEraYearCache.has(desc)) return _descEraYearCache.get(desc);
  let y = null;
  const matches = desc.match(ERA_YEAR_RE);
  if (matches) {
    for (const ystr of matches) {
      const n = parseInt(ystr, 10);
      if (n >= ERA_YEAR_MIN && n <= ERA_YEAR_MAX) { y = n; break; }
    }
  }
  _descEraYearCache.set(desc, y);
  return y;
}
function _getEraMarkers(desc) {
  let m = _descEraMarkerCache.get(desc);
  if (!m) {
    m = { isModern: ERA_MODERN_RE.test(desc), isVintage: ERA_VINTAGE_RE.test(desc) };
    _descEraMarkerCache.set(desc, m);
  }
  return m;
}

// Variant descriptor lookup against a type-separated context. Routes by
// descriptor shape:
//   - Multi-word (contains hyphen or whitespace): full-string match against
//     compounds (primary path); subtoken match against prose only (fallback).
//     NEVER subtoken-matches against compounds or singles — that's the
//     architectural cut that closes the grammatical-suffix bleed pathway.
//   - Single-token: exact match against singles AND prose, summed (matches
//     the magnitude single-token descriptors received under the pre-split
//     unified weights map). NEVER matches against compounds.
//
// dedupSet semantics:
//   - Set<string>: consult and mutate. Tokens already in the set are
//     skipped. Used by Pass 1 (descriptors) and Pass 2 (single-token
//     canonical overlap path) to prevent the same token from double-
//     scoring within one variant's evaluation.
//   - null: no dedup. Used by neighbor-bias inner loop, where every match
//     contributes independently (matches pre-split behavior — old neighbor-
//     bias never consulted seenOverlapTokens).
function lookupDescriptor(desc, ctx, dedupSet) {
  const out = [];
  if (!desc) return out;
  const p = _getDescParse(desc);
  const norm = p.norm;

  if (p.isCompound) {
    // Full-string match against compounds (deduped by full string).
    if (ctx.compounds.has(norm)) {
      if (!dedupSet || !dedupSet.has(norm)) {
        out.push({ tok: norm, w: ctx.compounds.get(norm), src: 'compound-full' });
        if (dedupSet) dedupSet.add(norm);
      }
    }
    // Subtoken match against prose ONLY (architectural cut: subtokens never
    // escape compounds, never match singles).
    const subtokens = p.subtokens;
    for (const tok of subtokens) {
      if (dedupSet && dedupSet.has(tok)) continue;
      if (ctx.prose.has(tok)) {
        out.push({ tok, w: ctx.prose.get(tok), src: 'prose-subtoken' });
        if (dedupSet) dedupSet.add(tok);
      }
    }
  } else {
    // Single-token: sum singles + prose contributions, dedup once.
    if (dedupSet && dedupSet.has(norm)) return out;
    const wSingles = ctx.singles.has(norm) ? ctx.singles.get(norm) : 0;
    const wProse = ctx.prose.has(norm) ? ctx.prose.get(norm) : 0;
    if (wSingles > 0 || wProse > 0) {
      let src;
      if (wSingles > 0 && wProse > 0) src = 'singles-and-prose';
      else if (wSingles > 0) src = 'singles-exact';
      else src = 'prose-exact';
      out.push({ tok: norm, w: wSingles + wProse, src });
      if (dedupSet) dedupSet.add(norm);
    }
  }
  return out;
}

// Fast-path: returns just the sum of weights that lookupDescriptor(desc, ctx, null)
// would produce. The neighbor-bias inner loop is the hottest call site by far
// (5 neighbors × N descriptors per scoreVariant call) and it only sums the
// weights — it doesn't iterate the contribution metadata. By memoizing the
// final number on the ctx (which is stable, cached per-tradition by
// buildContext), repeat scoring of the same variant across the search hot
// loop becomes a single Map.get.
//
// Behavior MUST match `lookupDescriptor(desc, ctx, null).reduce((s, c) => s + c.w, 0)`
// exactly. Validated by the regression suite (any drift trips fixture scores).
function sumLookupWeight(desc, ctx) {
  if (!desc) return 0;
  // Lazily attach a per-ctx cache. WeakMap not used because ctx is in a long-
  // lived Map (_buildContextCache) so a regular Map property is fine.
  let cache = ctx._sumLookupCache;
  if (!cache) {
    cache = new Map();
    ctx._sumLookupCache = cache;
  }
  const cached = cache.get(desc);
  if (cached !== undefined) return cached;

  const p = _getDescParse(desc);
  const norm = p.norm;
  let sum = 0;

  if (p.isCompound) {
    if (ctx.compounds.has(norm)) sum += ctx.compounds.get(norm);
    const subtokens = p.subtokens;
    for (const tok of subtokens) {
      if (ctx.prose.has(tok)) sum += ctx.prose.get(tok);
    }
  } else {
    const wSingles = ctx.singles.has(norm) ? ctx.singles.get(norm) : 0;
    const wProse = ctx.prose.has(norm) ? ctx.prose.get(norm) : 0;
    if (wSingles > 0 || wProse > 0) sum = wSingles + wProse;
  }
  cache.set(desc, sum);
  return sum;
}

function scoreVariant(variant, context, options = {}) {
  if (!variant || !context) return { score: 0, signals: [] };
  // The hot path (search → scoreConfig → scoreVariant, called thousands of
  // times per tradition × maxIters iterations) only reads .score, never
  // .signals. signals.push allocations were a measurable fraction of search
  // runtime. Callers that need signals (the `score` CLI command) leave the
  // default; scoreConfig passes skipSignals to drop the allocations entirely.
  const collectSignals = !options.skipSignals;
  let score = 0;
  const signals = collectSignals ? [] : null;
  const descriptors = variant.descriptors || [];
  const canonicalTags = variant.canonical_tags || [];

  // Descriptor overlap with weighted context tokens.
  //
  // Token-dedup per variant: each token can contribute to overlap at most ONCE
  // per variant scoring. Without this, a variant with multiple descriptors
  // sharing a subtoken would multi-credit that subtoken (the bleed risk that
  // historically required keeping canonical-suffix descriptors out of subtoken
  // overlap entirely — see the data-layer refactor comment below).
  // Pass 1 + Pass 2 dedup. Shared across the descriptor-overlap path and
  // the single-token canonical overlap path, matching the pre-split behavior
  // where one `seenOverlapTokens` Set spanned both passes. Neighbor-bias
  // does NOT consult this set (passes null to lookupDescriptor).
  //
  // Type-separated lookup discipline (full spec in lookupDescriptor):
  //   - Multi-word descriptor: full-string match against compounds, plus
  //     subtoken match against prose only. Subtokens never escape the
  //     compound space.
  //   - Single-token descriptor: exact match against singles + prose, summed.
  //     Never matches compounds.
  // The architectural cut closes the grammatical-suffix bleed pathway.
  const seenOverlapTokens = new Set();

  // Pass 1 — descriptor overlap via type-separated lookup.
  for (const desc of descriptors) {
    for (const contrib of lookupDescriptor(desc, context, seenOverlapTokens)) {
      score += contrib.w;
      if (collectSignals) signals.push({ desc, ...contrib });
    }
    // Era conflict
    const variantYear = _getEraYear(desc);
    if (variantYear !== null && context.eraRange) {
      if (variantYear < context.eraRange.start - 5 || variantYear > context.eraRange.end + 5) {
        score -= 2.0;
        if (collectSignals) signals.push({ desc, w: -2.0, src: 'era-conflict' });
      }
    }
    if (context.eraRange) {
      const eraMarkers = _getEraMarkers(desc);
      if (eraMarkers.isModern && context.eraRange.end < 1990) {
        score -= 1.5;
        if (collectSignals) signals.push({ desc, w: -1.5, src: 'modern-in-vintage' });
      }
      if (eraMarkers.isVintage && context.eraRange.start > 2000) {
        score -= 0.5;
        if (collectSignals) signals.push({ desc, w: -0.5, src: 'vintage-in-modern' });
      }
    }
  }

  // Pass 2 — canonical tag claims (single + compound).
  for (const ctag of canonicalTags) {
    const norm = ctag.toLowerCase();
    const subtokens = norm.split('-').filter(Boolean);
    if (subtokens.length > 1) {
      // Compound canonical: full-string match against compounds first, then
      // all-subtokens-in-prose fallback. Mismatch → CANONICAL_CONFLICT_PENALTY.
      if (context.compounds.has(norm)) {
        const w = context.compounds.get(norm);
        const bonus = w * 1.5;
        score += bonus;
        if (collectSignals) signals.push({ desc: ctag, tok: norm, w: bonus, src: 'canonical-compound-bonus' });
      } else {
        let minWeight = Infinity;
        let allPresent = true;
        for (const sub of subtokens) {
          if (!context.prose.has(sub)) { allPresent = false; break; }
          const w = context.prose.get(sub);
          if (w < minWeight) minWeight = w;
        }
        if (allPresent) {
          const bonus = minWeight * 1.5;
          score += bonus;
          if (collectSignals) signals.push({ desc: ctag, tok: norm, w: bonus, src: 'canonical-compound-bonus' });
        } else {
          score += CANONICAL_CONFLICT_PENALTY;
          if (collectSignals) signals.push({ desc: ctag, tok: norm, w: CANONICAL_CONFLICT_PENALTY, src: 'canonical-conflict' });
        }
      }
    } else {
      // Single-token canonical: overlap (deduped via seenOverlapTokens) + 1.5× bonus.
      const tok = subtokens[0];
      if (!tok) continue;
      // Overlap path: matches descriptor lookup semantics. Deduped.
      for (const contrib of lookupDescriptor(tok, context, seenOverlapTokens)) {
        score += contrib.w;
        if (collectSignals) signals.push({ desc: ctag, ...contrib });
      }
      // Bonus path: fires whenever the token is in either space, independent of dedup.
      const wSingles = context.singles.has(tok) ? context.singles.get(tok) : 0;
      const wProse = context.prose.has(tok) ? context.prose.get(tok) : 0;
      const wTotal = wSingles + wProse;
      if (wTotal > 0) {
        const bonus = wTotal * 1.5;
        score += bonus;
        if (collectSignals) signals.push({ desc: ctag, tok, w: bonus, src: 'canonical-bonus' });
      } else {
        score += CANONICAL_CONFLICT_PENALTY;
        if (collectSignals) signals.push({ desc: ctag, tok, w: CANONICAL_CONFLICT_PENALTY, src: 'canonical-conflict' });
      }
    }
  }

  // Neighbor-bias: see if nearest-neighbor traditions' contexts also like this variant.
  // Capped at NEIGHBOR_BONUS_CAP_RATIO of the direct score so a strongly-anchored direct match can't be
  // overridden by sum-of-weak-neighbors. The `cap > 0` guard preserves legitimate
  // adjacency-based surfacing: a variant whose descriptors don't match the primary
  // tradition's prose/compounds/singles can still surface if multiple neighbors
  // anchor it. Empirical: removing this guard breaks 46 of 199 regression
  // fixtures, so the adjacency pathway is load-bearing across the catalog.
  if (options.useNeighbors && context.tradition) {
    const directScore = score;  // capture before neighbor-bias is added
    const neighbors = getNeighbors(context.tradition.id, 5);
    let neighborBonus = 0;
    for (const n of neighbors) {
      const nctx = buildContext(n.id);
      if (!nctx) continue;
      // Lightweight neighbor scoring — descriptor overlap only, no recursion.
      // canonical_tags are NOT consulted in neighbor-bias (preserved behavior).
      // dedupSet = null: every match contributes independently across neighbors.
      // Uses sumLookupWeight for the inner loop — equivalent to the sum of
      // lookupDescriptor(desc, nctx, null) weights, memoized per (desc, ctx).
      const factor = n.weight * NEIGHBOR_WEIGHT_FACTOR;
      for (const desc of descriptors) {
        neighborBonus += sumLookupWeight(desc, nctx) * factor;
      }
    }
    if (neighborBonus !== 0) {
      const cap = Math.abs(directScore) * NEIGHBOR_BONUS_CAP_RATIO;
      if (cap > 0 && Math.abs(neighborBonus) > cap) {
        neighborBonus = Math.sign(neighborBonus) * cap;
      }
      score += neighborBonus;
      if (collectSignals) signals.push({ w: neighborBonus, src: 'neighbor-bias' });
    }
  }

  return { score, signals: collectSignals ? signals : [] };
}

// CLI
const args = process.argv.slice(2);
const flags = {};
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a.startsWith('--')) {
    const eq = a.indexOf('=');
    if (eq > 0) flags[a.slice(2, eq)] = a.slice(eq + 1);
    else {
      const next = args[i + 1];
      if (next && !next.startsWith('--')) { flags[a.slice(2)] = next; i++; }
      else flags[a.slice(2)] = true;
    }
  }
}

if (flags.variant && flags.instrument && flags.tradition) {
  const inst = C.INSTRUMENTS.find(i => i.id === flags.instrument);
  if (!inst) { console.error('Unknown instrument'); process.exit(2); }
  let variant = null;
  for (const p of inst.parts || []) {
    const v = p.variants.find(x => x.id === flags.variant);
    if (v) { variant = v; break; }
  }
  if (!variant) { console.error('Unknown variant for that instrument'); process.exit(2); }
  const ctx = buildContext(flags.tradition);
  if (!ctx) { console.error('Unknown tradition'); process.exit(2); }
  const result = scoreVariant(variant, ctx);
  console.log(JSON.stringify({ variant: variant.id, descriptors: variant.descriptors, ...result }, null, 2));
  process.exit(0);
}

// --rank-variants: for an instrument's part within a tradition, rank all variants by score
if (flags['rank-variants'] && flags.instrument && flags.part && flags.tradition) {
  const inst = C.INSTRUMENTS.find(i => i.id === flags.instrument);
  if (!inst) { console.error('Unknown instrument'); process.exit(2); }
  const part = (inst.parts || []).find(p => p.id === flags.part);
  if (!part) { console.error('Unknown part'); process.exit(2); }
  const ctx = buildContext(flags.tradition);
  if (!ctx) { console.error('Unknown tradition'); process.exit(2); }

  const ranked = part.variants.map(v => {
    const r = scoreVariant(v, ctx, { useNeighbors: !flags['no-neighbors'] });
    return { id: v.id, name: v.name, descriptors: v.descriptors, score: r.score, signals: r.signals };
  }).sort((a, b) => b.score - a.score);

  if (flags.json) console.log(JSON.stringify(ranked, null, 2));
  else {
    console.log(`Ranked variants for ${flags.instrument}.${flags.part} in tradition ${flags.tradition}:`);
    for (const r of ranked) {
      console.log(`  ${r.score.toFixed(2).padStart(6)}  ${r.id}  [${r.descriptors.join(', ')}]`);
    }
  }
  process.exit(0);
}

// Export functions for use by search.js
module.exports = { buildContext, buildMergedContext, isolatedStaplesForPart, scoreVariant, lookupDescriptor, parseEra };

if (require.main === module) {
  console.error('Usage:');
  console.error('  --variant <id> --instrument <id> --tradition <id>');
  console.error('  --rank-variants --instrument <id> --part <id> --tradition <id>');
  process.exit(2);
}
