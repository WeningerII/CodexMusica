#!/usr/bin/env node
// Hill-climbing search engine for song configurations.
//
// Input: a seed configuration (JSON via stdin or via --seed=<file>) plus options.
// Output: the highest-scoring configuration found, with score breakdown.
//
// Configuration shape:
//   {
//     traditions: ['afrobeat'],            // tradition stack — primary first
//     instruments: [                       // ordered slot list
//       { id: 'voice', slots: { ...part_id: variant_id... } },
//       { id: 'electric_guitar_single_coil', slots: {...} },
//       ...
//     ],
//     room: 'studio_emi_lagos_african',
//     archetype: 'arch_emi_lagos_african_70s',
//     tuning: 'twelve_tet',
//     aesthetic: null,                     // optional aesthetic id
//     fx_extras: []                        // additional fx beyond what's in archetype
//   }
//
// Move set (each iteration of the hill climb):
//   - variant swap (try every variant for every part on every instrument)
//   - slot variant-swap on chain components (mic, pre, console, comp, eq, medium)
//   - tradition swap (try replacing primary tradition with a nearest neighbor)
//   - aesthetic toggle (try adding or removing each aesthetic)
//
// The score function aggregates per-slot scores using score.js.

const C = require('./_loader.js');
const { buildMergedContext, isolatedStaplesForPart, scoreVariant, lookupDescriptor, parseEra } = require('./score.js');

// Generalized per-slot context provider. crossRefs may flag any part for
// isolation via `isolated_parts: ['part_id', ...]`. Legacy `voice_isolated: true`
// remains valid as alias for `isolated_parts: ['voice_quality']`.
function makeContextProvider(traditions, weight = 0.5) {
  const fullCtx = buildMergedContext(traditions, weight);
  const cache = new Map(); // partId → ctx
  const primaryTid = traditions[0];
  return function getCtxForPart(partId) {
    if (cache.has(partId)) return cache.get(partId);
    const exclude = isolatedStaplesForPart(primaryTid, traditions, partId);
    const ctx = exclude.size === 0
      ? fullCtx
      : buildMergedContext(traditions, weight, { excludeStaples: exclude });
    cache.set(partId, ctx);
    return ctx;
  };
}

// === Score a full configuration ===
function scoreConfig(config) {
  let total = 0;
  const breakdown = {};

  // Build merged context from all stapled traditions (primary at full weight, staples at 0.5)
  const ctx = buildMergedContext(config.traditions, 0.5);
  if (!ctx) return { total: -Infinity, breakdown: { error: 'invalid primary tradition' } };

  // Per-part context provider. Returns the full ctx for parts not flagged on
  // any crossRef; returns an excluded-staples context for isolated parts.
  const getCtxForPart = makeContextProvider(config.traditions, 0.5);

  // Score each instrument slot's variant choices
  let instrumentScore = 0;
  for (const inst of config.instruments) {
    const i = C.INSTRUMENTS.find(x => x.id === inst.id);
    if (!i) continue;
    let instSum = 0;
    for (const part of (i.parts || [])) {
      const variantId = (inst.slots || {})[part.id];
      if (!variantId) continue;
      const variant = part.variants.find(v => v.id === variantId);
      if (!variant) continue;
      const scoringCtx = getCtxForPart(part.id);
      const r = scoreVariant(variant, scoringCtx, { useNeighbors: true, skipSignals: true });
      instSum += r.score;
    }
    instrumentScore += instSum;
  }
  breakdown.instruments = instrumentScore;
  total += instrumentScore;

  // Score chain components — mic, pre, console, comp, eq, medium
  // We treat each as a "variant" for scoring purposes — use its descriptors against context
  let chainScore = 0;
  if (config.archetype) {
    const arch = C.CHAIN_ARCHETYPES.find(a => a.id === config.archetype);
    if (arch) {
      for (const [secId, itemId] of Object.entries(arch.components)) {
        if (Array.isArray(itemId)) continue; // fx handled below
        const sec = C.CHAIN_SECTIONS.find(s => s.id === secId);
        if (!sec) continue;
        const item = sec.items.find(x => x.id === itemId);
        if (!item) continue;
        const r = scoreVariant(item, ctx, { useNeighbors: false, skipSignals: true });
        chainScore += r.score * 0.5; // chain weight slightly lower than instruments
      }
    }
  }
  breakdown.chain = chainScore;
  total += chainScore;

  // Tradition coherence: every tradition in the stack should fit
  if (config.traditions.length > 1) {
    let stackCoherence = 0;
    for (let i = 1; i < config.traditions.length; i++) {
      const tA = C.TRADITION_EXTRAS[config.traditions[0]];
      const tB = C.TRADITION_EXTRAS[config.traditions[i]];
      if (!tA || !tB || !tA.axes || !tB.axes) continue;
      // Closer in axis space = more coherent
      let dist = 0;
      for (const k of Object.keys(tA.axes)) {
        if (tB.axes[k] !== undefined) dist += Math.abs(tA.axes[k] - tB.axes[k]);
      }
      stackCoherence += -dist * 0.3; // stapling distant traditions costs score
    }
    breakdown.stack_coherence = stackCoherence;
    total += stackCoherence;
  }

  // Aesthetic application: era overlap AND region/genre compatibility
  if (config.aesthetic) {
    const aesthetic = (C.PRODUCTION_AESTHETICS || []).find(p => p.id === config.aesthetic);
    if (aesthetic && ctx.eraRange) {
      const aRange = parseEra(aesthetic.era);
      let aestheticScore = 0;
      if (aRange) {
        const overlapStart = Math.max(aRange.start, ctx.eraRange.start);
        const overlapEnd = Math.min(aRange.end, ctx.eraRange.end);
        if (overlapStart > overlapEnd) {
          // Era doesn't overlap at all — strong penalty
          aestheticScore -= 5.0;
        } else {
          // Check technique overlap with tradition context via type-separated lookup
          const techMatches = (aesthetic.characteristic_techniques || []).filter(tech => {
            return lookupDescriptor(tech, ctx, null).length > 0;
          });
          if (techMatches.length === 0) {
            // Era overlaps but no technique resonance — moderate penalty
            aestheticScore -= 2.0;
          } else {
            // Real overlap — bonus proportional to technique matches
            aestheticScore += techMatches.length * 0.5;
          }
        }
      }
      breakdown.aesthetic = aestheticScore;
      total += aestheticScore;
    }
  }

  return { total, breakdown };
}

// === Move generators ===

// For each instrument's each part, generate every variant-swap as a candidate move
function* variantSwapMoves(config) {
  // Pinned slots — entries in config.pinned shaped like { instId: [partId, ...] } — are
  // exempt from variant-swap move generation. This is how --swap-variant user fiat
  // survives hill-climbing: search can still climb on every OTHER slot, just not on
  // slots the caller explicitly pinned. Array form (rather than Set) for clean JSON
  // serialization through the regression-snapshot and --json output paths.
  const pinned = config.pinned || null;
  for (let i = 0; i < config.instruments.length; i++) {
    const inst = config.instruments[i];
    const cataInst = C.INSTRUMENTS.find(x => x.id === inst.id);
    if (!cataInst) continue;
    const pinnedParts = pinned && Array.isArray(pinned[inst.id]) ? pinned[inst.id] : null;
    for (const part of (cataInst.parts || [])) {
      if (pinnedParts && pinnedParts.includes(part.id)) continue;
      for (const variant of part.variants) {
        const currentVariant = (inst.slots || {})[part.id];
        if (currentVariant === variant.id) continue;
        // `auto: false` variants are explicit-only: the hill-climb never proposes
        // them. This lets an optional dimension (e.g. the voice effort/vocal-tract
        // parts) stay at its neutral default for every tradition unless a caller
        // pins it in by an explicit slot choice — so adding the dimension perturbs
        // no existing recipe.
        if (variant.auto === false) continue;
        const newConfig = structuredClone(config);
        newConfig.instruments[i].slots[part.id] = variant.id;
        yield {
          config: newConfig,
          desc: `swap ${inst.id}.${part.id}: ${currentVariant} → ${variant.id}`,
        };
      }
    }
  }
}

// Swap chain components against alternatives — only era/region/scale-compatible archetypes
function* chainSwapMoves(config) {
  if (!config.archetype) return;
  const arch = C.CHAIN_ARCHETYPES.find(a => a.id === config.archetype);
  if (!arch) return;
  const room = config.room ? C.ROOMS.find(r => r.id === config.room) : null;
  // The new archetype must match the ROOM's era/region (room is primary anchor).
  // When the room lacks an era — many domestic/parlor/cathedral rooms have no era —
  // fall back to the CURRENT archetype's era as the anchor. Without this fallback,
  // a 1925-1948 Tin Pan Alley archetype in a parlor room can hill-climb into a
  // 1965-1972 archetype because parlor.era is undefined.
  for (const otherArch of C.CHAIN_ARCHETYPES) {
    if (otherArch.id === config.archetype) continue;
    if (room) {
      const eraAnchor = room.era || arch.era;
      if (eraAnchor && otherArch.era && eraAnchor !== otherArch.era) continue;
      if (room.region && otherArch.region && room.region !== otherArch.region) continue;
      if (room.scale_tier && otherArch.scale_tier && room.scale_tier !== otherArch.scale_tier) continue;
    } else {
      // No room — fall back to era/region match against current archetype
      if (otherArch.era !== arch.era || otherArch.region !== arch.region) continue;
    }
    const newConfig = structuredClone(config);
    newConfig.archetype = otherArch.id;
    yield {
      config: newConfig,
      desc: `swap archetype: ${config.archetype} → ${otherArch.id}`,
    };
  }
}

// Try stapling additional traditions (not replacing primary)
function* traditionStapleMoves(config) {
  if (config.traditions.length >= 3) return; // cap at 3 stapled traditions
  const primaryId = config.traditions[0];
  const e = C.TRADITION_EXTRAS[primaryId];
  if (!e) return;
  // Get crossref targets — those are the canonical staples
  const candidates = new Set();
  for (const cr of (e.crossRefs || [])) {
    const ref = typeof cr === 'string' ? cr : (cr && cr.ref);
    if (!ref) continue;
    for (const otherTid of Object.keys(C.TRADITION_EXTRAS)) {
      const oe = C.TRADITION_EXTRAS[otherTid];
      // Umbrella genres (e.g. `rock`, `metal`) are query endpoints, not real
      // recording lineages — never auto-staple them into another tradition, or
      // they'd homogenize the specific sub-genres they sit beside.
      if (oe.umbrella) continue;
      if (oe.parent === ref || (oe.parent || '').startsWith(ref + '.')) {
        candidates.add(otherTid);
      }
    }
  }
  // Dedupe candidates by parent path — when multiple sibling traditions share the
  // exact same parent path (e.g. tango + tango_traditional both at
  // balladPoetry.latinAmTroubadour, or british_invasion_rb + hard_rock + garage_rock
  // all at distortedRock.classic), the pair tends to BOTH get stapled by the
  // hill-climber because they score nearly identically. The result reads as
  // "tango tango traditional" in sentence 1 — redundant and over-represents the
  // crossRef branch. Picking one representative per parent path forces the
  // staple-set to spread across distinct branches rather than cluster.
  // Selection: pick by axes-similarity to primary tradition (closest sibling
  // to primary's axis profile). Falls back to lex-first when axes unavailable.
  const AXIS_KEYS = ['harm','pitch','ornament','meter','density','transmission','improv','soundTech','intensity','voice','timbre','percussion','cyclicity'];
  const primaryAxes = (e.axes || {});
  const axisDistance = (otherTid) => {
    const oa = (C.TRADITION_EXTRAS[otherTid] || {}).axes || {};
    let d = 0;
    for (const k of AXIS_KEYS) {
      const pv = primaryAxes[k];
      const ov = oa[k];
      if (pv === undefined || ov === undefined) continue;
      d += Math.abs(pv - ov);
    }
    return d;
  };
  const byParent = new Map();
  for (const cand of candidates) {
    if (config.traditions.includes(cand)) continue;
    const cp = (C.TRADITION_EXTRAS[cand] || {}).parent || '';
    const existing = byParent.get(cp);
    if (!existing) { byParent.set(cp, cand); continue; }
    const ed = axisDistance(existing);
    const cd = axisDistance(cand);
    if (cd < ed || (cd === ed && cand < existing)) byParent.set(cp, cand);
  }
  for (const cand of byParent.values()) {
    const newConfig = structuredClone(config);
    newConfig.traditions.push(cand);
    yield {
      config: newConfig,
      desc: `staple tradition: + ${cand}`,
    };
  }
}

// Try toggling production aesthetics — but ONLY aesthetics the primary tradition
// explicitly references. Speculative aesthetic-application is too noisy.
function* aestheticToggleMoves(config) {
  const primaryId = config.traditions[0];
  const t = C.TRADITIONS.find(x => x.id === primaryId);
  if (!t) return;
  const allowed = new Set();
  if (t.production_aesthetic) {
    if (Array.isArray(t.production_aesthetic)) {
      for (const a of t.production_aesthetic) allowed.add(a);
    } else {
      allowed.add(t.production_aesthetic);
    }
  }
  if (allowed.size === 0) return; // tradition has no aesthetic — search can't add one
  // Toggle each allowed aesthetic on/off
  for (const aId of allowed) {
    if (config.aesthetic === aId) {
      const newConfig = structuredClone(config);
      newConfig.aesthetic = null;
      yield { config: newConfig, desc: `remove aesthetic: ${aId}` };
    } else {
      const newConfig = structuredClone(config);
      newConfig.aesthetic = aId;
      yield { config: newConfig, desc: `add aesthetic: ${aId}` };
    }
  }
}

// Combine all move generators
function* allMoves(config) {
  yield* variantSwapMoves(config);
  yield* chainSwapMoves(config);
  yield* traditionStapleMoves(config);
  yield* aestheticToggleMoves(config);
}

// === Hill-climbing search ===
function search(seed, options = {}) {
  const maxIters = options.maxIters || 100;
  let current = seed;
  let currentScore = scoreConfig(current).total;
  const trace = [{ score: currentScore, desc: 'seed' }];

  for (let iter = 0; iter < maxIters; iter++) {
    let best = null;
    let bestScore = currentScore;
    let bestDesc = null;

    for (const move of allMoves(current)) {
      const moveScore = scoreConfig(move.config).total;
      if (moveScore > bestScore) {
        best = move.config;
        bestScore = moveScore;
        bestDesc = move.desc;
      }
    }

    if (!best) break; // no improving move found — local optimum
    current = best;
    currentScore = bestScore;
    trace.push({ score: currentScore, desc: bestDesc });
  }

  // Refresh per-slot score bookkeeping under the FINAL config. The hill-climb
  // swaps variants (and auto-staple grows the tradition stack), but `scores`
  // was written once at seed time — so translate's surfacing gates were reading
  // the REPLACED variant's score under the SEED stack and silently dropped
  // descriptors the final pick actually earns (afrobeat's Ampeg B-15 amp and
  // conga-skin descriptors were the proving case). Context convention mirrors
  // scoreConfig exactly: per-part isolated provider at weight 0.5, neighbors on.
  const getFinalCtx = makeContextProvider(current.traditions, 0.5);
  for (const inst of current.instruments || []) {
    const cataInst = C.INSTRUMENTS.find((x) => x.id === inst.id);
    if (!cataInst) continue;
    inst.scores = inst.scores || {};
    for (const part of cataInst.parts || []) {
      const vid = (inst.slots || {})[part.id];
      if (!vid) continue;
      const variant = (part.variants || []).find((v) => v.id === vid);
      if (!variant) continue;
      inst.scores[part.id] = scoreVariant(variant, getFinalCtx(part.id), { useNeighbors: true, skipSignals: true }).score;
    }
  }

  return { config: current, score: currentScore, trace, breakdown: scoreConfig(current).breakdown };
}

// === Multi-start hill-climbing search ===
// Runs `restarts` independent climbs with different randomized variant
// initializations, returns the best. The motivation is to escape local optima
// caused by seed-dependent initialization. The returned `multistart` field
// reports (a) per-restart final scores and (b) whether scores diverged
// (signal of multimodal search space — auditable).
function searchMultiStart(seed, options = {}) {
  const restarts = options.restarts || 3;
  const maxIters = options.maxIters || 100;
  const results = [];
  // Restart 0: original seed (greedy default-best initialization)
  results.push({ ...search(seed, { maxIters }), startKind: 'seeded' });
  // Restarts 1..N: randomized variant initialization
  for (let r = 1; r < restarts; r++) {
    const randomSeed = randomizeVariants(seed, r);
    results.push({ ...search(randomSeed, { maxIters }), startKind: `random-${r}` });
  }
  // Sort by score, best first
  results.sort((a, b) => b.score - a.score);
  const best = results[0];
  const scores = results.map(r => r.score);
  const scoreSpread = Math.max(...scores) - Math.min(...scores);
  return {
    ...best,
    multistart: {
      restarts: results.length,
      scores,
      spread: scoreSpread,
      multimodal: scoreSpread > 1.0, // threshold: ≥1 score-unit spread = multimodal signal
    }
  };
}

// Helper: produce a variant-randomized version of seed (deterministic by seedNum)
function randomizeVariants(seed, seedNum) {
  function pseudoRandom(n) {
    // Simple deterministic LCG seeded with the seedNum input
    let state = (seedNum * 2654435761) >>> 0;
    state = (state ^ n * 0x9e3779b9) >>> 0;
    return (state * 16807) % 2147483647 / 2147483647;
  }
  const newConfig = structuredClone(seed);
  let counter = 0;
  for (const inst of newConfig.instruments) {
    const cataInst = C.INSTRUMENTS.find(i => i.id === inst.id);
    if (!cataInst) continue;
    for (const part of (cataInst.parts || [])) {
      const variants = (part.variants || []).filter(v => v.auto !== false); // skip explicit-only variants
      if (variants.length <= 1) continue;
      const idx = Math.floor(pseudoRandom(counter++) * variants.length);
      inst.slots[part.id] = variants[idx].id;
    }
  }
  return newConfig;
}

// === Build a seed configuration from a tradition id ===

// Find the tradition whose axis-profile is closest (L1 distance) to a target.
// `target` is an object like { harm: 1, density: 2 }. Returns the tradition id
// or null if no tradition has axes that match any key in the target.
// Used by recipe.js (parses `--axis k:v,k:v` CLI flag into target) and by
// smoke.js (precomputed targets); centralized here so the two callers can't
// drift apart in lookup semantics.
function findClosestTraditionByAxis(target) {
  let best = null;
  let bestDist = Infinity;
  for (const tid of Object.keys(C.TRADITION_EXTRAS)) {
    const e = C.TRADITION_EXTRAS[tid];
    if (!e.axes) continue;
    let dist = 0;
    let matched = 0;
    for (const k of Object.keys(target)) {
      if (e.axes[k] !== undefined) {
        dist += Math.abs(e.axes[k] - target[k]);
        matched++;
      }
    }
    if (matched === 0) continue;
    if (dist < bestDist) { bestDist = dist; best = tid; }
  }
  return best;
}

function seedFromTradition(tradId, stapleIds = [], opts = {}) {
  const t = C.TRADITIONS.find(x => x.id === tradId);
  if (!t) return null;
  // opts:
  //   exclude:      Set<instrumentId> — instruments to drop from the seed
  //   swap:         { instrumentId: { partId: variantId, ... } } — variant overrides
  //   stapleMode:   'lineage' | 'full' (default 'full')
  //                   'full'    — stapled traditions contribute both context AND instruments (current behavior)
  //                   'lineage' — stapled traditions contribute context only; primary owns the instrument list
  //   stapleWeight: number in [0, 1] — how much each stapled tradition's tokens
  //                 weigh in the merged scoring context. Default 0.5 (staple
  //                 tokens count for half of primary tokens). seedDiff drives
  //                 this from its --weight flag to produce continuous A-to-B
  //                 blending.
  const exclude = opts.exclude instanceof Set ? opts.exclude : new Set(opts.exclude || []);
  const add = opts.add instanceof Set ? opts.add : new Set(opts.add || []);
  const swap = opts.swap || {};
  const arrangementOverride = opts.arrangement || null;
  const stapleMode = opts.stapleMode === 'lineage' ? 'lineage' : 'full';
  const stapleWeight = typeof opts.stapleWeight === 'number' ? opts.stapleWeight : 0.5;
  // Initial slot assignments: pick best-scoring variant for each part of each instrument.
  // Use merged context if staples are provided so the scoring respects all combined traditions.
  const allTradIds = [tradId, ...stapleIds];
  // Per-part isolation context: identical to ctx unless the primary tradition
  // has crossRefs flagging specific parts (isolated_parts: ['part_id', ...] or
  // legacy voice_isolated: true ≡ isolated_parts: ['voice_quality']). Used so
  // cross-aesthetic-amplification staples don't pull picks toward the wrong
  // mechanism (e.g. hip-hop staples on neo-soul-era R&B vocal_quality, or
  // jazz staples on Chicago-blues cymbal_alloy).
  const getCtxForPart = makeContextProvider(allTradIds, stapleWeight);
  // Instrument set assembly. In 'full' mode (default), stapled traditions' instruments
  // merge into the primary's. In 'lineage' mode, only the primary tradition contributes
  // instruments — staples still influence scoring/context but the ensemble stays anchored
  // to the primary tradition's actual instrumentation.
  const allInstrumentIds = new Set(t.instruments || []);
  if (stapleMode === 'full') {
    for (const sid of stapleIds) {
      const sTrad = C.TRADITIONS.find(x => x.id === sid);
      if (sTrad && Array.isArray(sTrad.instruments)) {
        for (const iid of sTrad.instruments) allInstrumentIds.add(iid);
      }
    }
  }
  // Apply ad-hoc adds: instruments not in any tradition's canonical roster but
  // requested explicitly by the user (e.g. guest performers, hybrid ensembles).
  // Added BEFORE exclude so a user could in principle add-then-exclude in a
  // pipeline, though that would be unusual.
  for (const iid of add) allInstrumentIds.add(iid);
  // Apply excludes after assembly (so the user can drop instruments contributed by
  // either the primary or a staple)
  for (const iid of exclude) allInstrumentIds.delete(iid);
  const instruments = [...allInstrumentIds].map(iid => {
    const i = C.INSTRUMENTS.find(x => x.id === iid);
    if (!i) return { id: iid, slots: {}, scores: {} };
    const slots = {};
    const scores = {};
    for (const part of (i.parts || [])) {
      let best = null;
      let bestScore = -Infinity;
      let bestIsDefault = false;
      const scoringCtx = getCtxForPart(part.id);
      for (const v of part.variants) {
        if (v.auto === false) continue; // explicit-only variant: never auto-seeded (see variantSwapMoves)
        const r = scoreVariant(v, scoringCtx, { useNeighbors: true, skipSignals: true });
        const isDefault = v.default === true;
        // Strict win: better score
        if (r.score > bestScore) {
          best = v.id; bestScore = r.score; bestIsDefault = isDefault;
          continue;
        }
        // Tie-break by default flag — prefer the canonical default when scores match.
        // Without this, ties are won by whichever variant comes first in the array,
        // which is incidental author-ordering rather than canonical preference.
        if (r.score === bestScore && isDefault && !bestIsDefault) {
          best = v.id; bestIsDefault = true;
        }
      }
      if (best) {
        slots[part.id] = best;
        scores[part.id] = bestScore;
      }
    }
    return { id: iid, slots, scores };
  });
  // Apply --swap-variant overrides: for each (instrument, part, variant) triple,
  // override the auto-picked slot AND record (instId → [partId, ...]) in pinned so
  // the hill-climb search exempts these slots from its variantSwapMoves. Without
  // pinning, search would climb back to the higher-scoring canonical variant.
  const pinned = {};
  for (const iid of Object.keys(swap)) {
    const instEntry = instruments.find(x => x.id === iid);
    if (!instEntry) continue;
    for (const partId of Object.keys(swap[iid])) {
      instEntry.slots[partId] = swap[iid][partId];
      pinned[iid] = pinned[iid] || [];
      if (!pinned[iid].includes(partId)) pinned[iid].push(partId);
    }
  }
  return {
    traditions: allTradIds,
    instruments,
    pinned: Object.keys(pinned).length > 0 ? pinned : undefined,
    room: t.room,
    archetype: t.chain_archetype,
    inline_chain: {
      mic: t.chain_mic || null,
      pre: t.chain_pre || null,
      console: t.chain_console || null,
      comp: t.chain_comp || null,
      eq: t.chain_eq || null,
      amp: t.chain_amp || null,
      medium: t.chain_medium || null,
    },
    tuning: t.tuning,
    aesthetic: Array.isArray(t.production_aesthetic) ? t.production_aesthetic[0] : t.production_aesthetic || null,
    arrangement: arrangementOverride || t.arrangement || null,
    fx_extras: Array.isArray(t.chain_fx) ? [...t.chain_fx] : [],
  };
}

// === CLI ===
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

if (require.main === module) {
  let seed = null;
  if (flags.tradition) {
    seed = seedFromTradition(flags.tradition);
    if (!seed) { console.error(`Unknown tradition: ${flags.tradition}`); process.exit(2); }
  } else if (flags.seed) {
    seed = JSON.parse(require('fs').readFileSync(flags.seed, 'utf8'));
  } else {
    console.error('Usage: search.js --tradition <id> [--max-iters=N] [--trace]');
    console.error('   or: search.js --seed <config.json>');
    process.exit(2);
  }
  const result = search(seed, { maxIters: parseInt(flags['max-iters']) || 100 });
  if (flags.trace) {
    console.error('=== trace ===');
    for (const t of result.trace) console.error(`  ${t.score.toFixed(2).padStart(7)}  ${t.desc}`);
    console.error('');
  }
  console.log(JSON.stringify({ config: result.config, score: result.score, breakdown: result.breakdown }, null, 2));
}

module.exports = { search, searchMultiStart, seedFromTradition, findClosestTraditionByAxis };
