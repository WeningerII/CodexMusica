#!/usr/bin/env node
// recipe.js — generate a song recipe as a descriptor stack.
//
// The headline operation. Given a song specification, produce ≤1,000 characters of
// catalog-derived descriptor stack. No prose, no axes, no artist/band names, no defaults.
//
// THREE INPUT MODES:
//
// 1. Bare tradition (the canonical case):
//      node scripts/recipe.js --tradition <id>
//      node scripts/recipe.js --tradition afrobeat
//
// 2. Stapled traditions (multiple traditions combined):
//      node scripts/recipe.js --traditions afrobeat,post_punk
//
// 3. Diff/blend between two traditions:
//      node scripts/recipe.js --diff <id_a> <id_b> --weight=0.7
//      (weight 0.0 = full A, 1.0 = full B; default 0.5)
//
// 4. Axis target (find best-fit tradition then emit recipe):
//      node scripts/recipe.js --axis-target "harm:1,density:2,intensity:2"
//
// Common flags:
//   --max-chars=<n>     ceiling override (default 1000)
//   --json              emit configuration JSON instead of descriptor stack
//   --trace             emit search trace to stderr
//
// Diagnostic flags (explain why a recipe came out the way it did):
//   --why               per-slot variant selection breakdown + search trace
//   --why-json          same as --why but machine-readable JSON
//   --why-prefaces      explain preface assignment for each instrument card
//                       (shows top-3 preface candidates, scores, token matches)
//   --why-prefaces-json same as --why-prefaces but machine-readable JSON
//
// All modes pipeline through:
//   parse spec → seedFromTradition / seedFromAxes → search hill-climb → translate

const C = require('./_loader.js');
const { search, seedFromTradition, findClosestTraditionByAxis } = require('./search.js');
const { translate } = require('./translate.js');

const args = process.argv.slice(2);
const flags = {};
const positional = [];
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
  } else {
    positional.push(a);
  }
}

const maxChars = parseInt(flags['max-chars']) || 1000;

// === Customization opts: --exclude-instrument / --swap-variant / --staple-mode ===
//
// --exclude-instrument=<id>[,<id>...]
//   Drop one or more instruments from the seed. Useful for trimming a stapled ensemble
//   ("afrobeat without saxophone"), or for asking "what does X sound like without Y?"
//
// --swap-variant=<inst>:<part>:<variant>[;<inst>:<part>:<variant>...]
//   Override the auto-picked variant for a specific instrument's part. Multiple swaps
//   separated by semicolons. Example: --swap-variant=voice:voice_register:falsetto
//
// --staple-mode=lineage|full
//   When --traditions has multiple ids, controls whether the secondary traditions'
//   instruments merge into the ensemble (full, default) or contribute only context/
//   aesthetic influence to the primary tradition's instruments (lineage).

function parseOpts(flags, _primaryTradId, _stapleIds) {
  const exclude = new Set();
  const add = new Set();
  const swap = {};
  const errors = [];

  if (flags['exclude-instrument']) {
    const ids = String(flags['exclude-instrument']).split(',').map(s => s.trim()).filter(Boolean);
    for (const iid of ids) {
      if (!C.INSTRUMENTS.find(x => x.id === iid)) {
        errors.push(`Unknown instrument id: ${iid}`);
        continue;
      }
      exclude.add(iid);
    }
  }

  // --add-instrument=<id>[,<id>...]
  //   Add one or more instruments to the seed beyond the staple's canonical roster.
  //   Useful for guest performers, hybrid ensembles, or extending a tradition's
  //   default lineup with cross-tradition instruments (e.g. accordion on a
  //   blues-rock recipe to express a Tom-Waits-style cabaret guest).
  if (flags['add-instrument']) {
    const ids = String(flags['add-instrument']).split(',').map(s => s.trim()).filter(Boolean);
    for (const iid of ids) {
      if (!C.INSTRUMENTS.find(x => x.id === iid)) {
        errors.push(`Unknown instrument id (add): ${iid}`);
        continue;
      }
      add.add(iid);
    }
  }

  // --arrangement=<id>
  //   Override the arrangement archetype for this recipe. By default the
  //   arrangement comes from the primary tradition's `arrangement` field
  //   (if set); this flag lets a user pin a specific arrangement onto a
  //   recipe whose primary tradition doesn't define one, or override the
  //   default when a specific song calls for a different structure.
  let arrangement = null;
  if (flags['arrangement']) {
    const aid = String(flags['arrangement']).trim();
    const found = (C.ARRANGEMENTS || []).find(a => a.id === aid);
    if (!found) {
      errors.push(`Unknown arrangement id: ${aid}`);
    } else {
      arrangement = aid;
    }
  }

  if (flags['swap-variant']) {
    const triples = String(flags['swap-variant']).split(';').map(s => s.trim()).filter(Boolean);
    for (const triple of triples) {
      const parts = triple.split(':');
      if (parts.length !== 3) {
        errors.push(`Bad --swap-variant triple (need inst:part:variant): ${triple}`);
        continue;
      }
      const [iid, pid, vid] = parts.map(s => s.trim());
      const inst = C.INSTRUMENTS.find(x => x.id === iid);
      if (!inst) { errors.push(`Unknown instrument: ${iid}`); continue; }
      const part = (inst.parts || []).find(p => p.id === pid);
      if (!part) { errors.push(`Instrument ${iid} has no part ${pid}`); continue; }
      const variant = (part.variants || []).find(v => v.id === vid);
      if (!variant) { errors.push(`${iid}.${pid} has no variant ${vid}`); continue; }
      swap[iid] = swap[iid] || {};
      swap[iid][pid] = vid;
    }
  }

  const stapleMode = flags['staple-mode'] === 'lineage' ? 'lineage' : 'full';
  if (flags['staple-mode'] && !['lineage', 'full'].includes(flags['staple-mode'])) {
    errors.push(`Unknown --staple-mode value: ${flags['staple-mode']} (use lineage or full)`);
  }

  if (errors.length > 0) {
    for (const e of errors) console.error(e);
    process.exit(2);
  }

  return { exclude, add, swap, stapleMode, arrangement };
}

// === Seed generation by mode ===

function seedFromAxisTarget(axisStr, opts) {
  // Parse axis target like "harm:1,density:2"
  const target = {};
  for (const pair of axisStr.split(',')) {
    const [k, v] = pair.split(':');
    if (k && v !== undefined) target[k.trim()] = parseInt(v);
  }
  const best = findClosestTraditionByAxis(target);
  return best ? seedFromTradition(best, [], opts) : null;
}

function seedDiff(idA, idB, weight, opts) {
  // Weighted blend of two traditions. `weight` ∈ [0, 1] is the share of B in
  // the result:
  //   0.0  → pure A (no B influence; equivalent to seedFromTradition(idA))
  //   0.5  → balanced blend: A primary, B stapled at full equal weight
  //   1.0  → pure B (no A influence; equivalent to seedFromTradition(idB))
  //
  // The midpoint is the maximum-blend point. Moving toward either end reduces
  // the secondary's contribution linearly to zero. Primary tradition switches
  // from A to B above 0.5; primary owns room, archetype, tuning, and the
  // genre-header position.
  //
  // The staple weight (how much the secondary's tokens count in the scoring
  // context) is min(weight, 1-weight) * 2 — peaks at 1.0 at the midpoint,
  // falls linearly to 0 at the extremes. Instrument rosters merge from both
  // traditions when stapleMode is 'full' (the default); 'lineage' keeps the
  // primary's roster only.
  weight = Math.max(0, Math.min(1, Number(weight)));
  if (!Number.isFinite(weight)) weight = 0.5;
  if (weight === 0) return seedFromTradition(idA, [], opts);
  if (weight === 1) return seedFromTradition(idB, [], opts);
  const primaryId   = weight <= 0.5 ? idA : idB;
  const secondaryId = weight <= 0.5 ? idB : idA;
  const stapleWeight = Math.min(weight, 1 - weight) * 2;
  return seedFromTradition(primaryId, [secondaryId], { ...opts, stapleWeight });
}

// === Run the pipeline ===

let seed = null;
const trace = flags.trace;

// Determine primary + staple ids so parseOpts can resolve --exclude-instrument
// against the actual instrument universe of this run.
let primaryTradId = null;
let stapleIds = [];
if (flags.tradition) {
  primaryTradId = flags.tradition;
} else if (flags.traditions) {
  const ids = String(flags.traditions).split(',').map(s => s.trim()).filter(Boolean);
  primaryTradId = ids[0]; stapleIds = ids.slice(1);
} else if (flags.diff) {
  [primaryTradId] = positional;
} else if (flags['axis-target']) {
  // primary is resolved inside seedFromAxisTarget; opts validation runs against catalog universe
}
const opts = parseOpts(flags, primaryTradId, stapleIds);

if (flags.tradition) {
  seed = seedFromTradition(flags.tradition, [], opts);
  if (!seed) { console.error(`Unknown tradition: ${flags.tradition}`); process.exit(2); }
} else if (flags.traditions) {
  const ids = String(flags.traditions).split(',').map(s => s.trim()).filter(Boolean);
  if (ids.length === 0) { console.error('No tradition ids provided'); process.exit(2); }
  seed = seedFromTradition(ids[0], ids.slice(1), opts);
  if (!seed) { console.error(`Unknown tradition: ${ids[0]}`); process.exit(2); }
} else if (flags.diff) {
  const [idA, idB] = positional;
  if (!idA || !idB) { console.error('--diff requires two tradition ids'); process.exit(2); }
  const weight = flags.weight !== undefined ? parseFloat(flags.weight) : 0.5;
  seed = seedDiff(idA, idB, weight, opts);
  if (!seed) { console.error('Unknown tradition'); process.exit(2); }
} else if (flags['axis-target']) {
  seed = seedFromAxisTarget(flags['axis-target'], opts);
  if (!seed) { console.error('No tradition matches axis target'); process.exit(2); }
  if (trace) console.error(`Seed tradition for axis target: ${seed.traditions[0]}`);
} else {
  console.error('Usage:');
  console.error('  recipe.js --tradition <id>');
  console.error('  recipe.js --traditions <id1>,<id2>[,<id3>]');
  console.error('  recipe.js --diff <id_a> <id_b> [--weight=0.7]');
  console.error('  recipe.js --axis-target "harm:1,density:2,..."');
  console.error('');
  console.error('Customization (any mode):');
  console.error('  --exclude-instrument=<id>[,<id>...]');
  console.error('  --swap-variant=<inst>:<part>:<variant>[;<inst>:<part>:<variant>...]');
  console.error('  --staple-mode=lineage|full   (default: full)');
  process.exit(2);
}

const result = search(seed, { maxIters: 100 });
if (trace) {
  console.error('=== search trace ===');
  for (const t of result.trace) console.error(`  ${t.score.toFixed(2).padStart(7)}  ${t.desc}`);
  console.error('');
}

// ─────────────────────── --why / --why-json diagnostic ───────────────────────
// For each instrument slot in the final config, show top 3 variant candidates
// with their scores and the delta-from-winner. Plus search trace summary, plus
// any pinned slots from --swap-variant. Output is stderr so it never pollutes
// the recipe stdout. --why-json emits the same data as JSON for machine parse.

if (flags.why || flags['why-json']) {
  const { buildMergedContext, scoreVariant } = require('./score.js');
  const ctx = buildMergedContext(result.config.traditions, 0.5);

  const slotDetails = []; // [{instId, partId, winner, runnerUp, third, pinned}]
  for (const inst of result.config.instruments) {
    const cataInst = C.INSTRUMENTS.find(x => x.id === inst.id);
    if (!cataInst) continue;
    for (const part of (cataInst.parts || [])) {
      const currentId = (inst.slots || {})[part.id];
      if (!currentId) continue;
      const scored = [];
      for (const v of (part.variants || [])) {
        const r = scoreVariant(v, ctx, { useNeighbors: true });
        scored.push({ id: v.id, score: r.score, isDefault: !!v.default });
      }
      scored.sort((a, b) => b.score - a.score);
      const winnerIdx = scored.findIndex(s => s.id === currentId);
      const winner = scored[winnerIdx] || { id: currentId, score: 0, isDefault: false };
      const pinned = !!(result.config.pinned && result.config.pinned[inst.id] &&
                       result.config.pinned[inst.id].includes(part.id));
      // Top 3 by score (regardless of whether winner is in top 3 — usually it is)
      const top3 = scored.slice(0, 3);
      slotDetails.push({
        instId: inst.id,
        partId: part.id,
        winner: winner.id,
        winnerScore: winner.score,
        winnerIsDefault: winner.isDefault,
        winnerRank: winnerIdx + 1,
        pinned,
        topCandidates: top3,
        totalCandidates: scored.length,
      });
    }
  }

  if (flags['why-json']) {
    console.error(JSON.stringify({
      traditions: result.config.traditions,
      finalScore: result.score,
      breakdown: result.breakdown,
      trace: result.trace,
      slots: slotDetails,
    }, null, 2));
  } else {
    console.error('=== --why: per-slot variant selection ===');
    for (const sd of slotDetails) {
      const pinMark = sd.pinned ? ' [PINNED]' : '';
      console.error(`  ${sd.instId}.${sd.partId}${pinMark}`);
      for (const c of sd.topCandidates) {
        const isWinner = c.id === sd.winner;
        const delta = isWinner ? '' : ` (Δ ${(c.score - sd.winnerScore).toFixed(2)})`;
        const mark = isWinner ? '▸' : ' ';
        const defaultTag = c.isDefault ? ' [d]' : '';
        console.error(`    ${mark} ${c.id.padEnd(36)} ${c.score.toFixed(2).padStart(7)}${defaultTag}${delta}`);
      }
      if (sd.winnerRank > 3) {
        console.error(`    (winner ranked ${sd.winnerRank} of ${sd.totalCandidates} — likely pinned)`);
      }
    }
    console.error('');
    console.error('=== --why: search trace ===');
    for (const t of result.trace) console.error(`  ${t.score.toFixed(2).padStart(7)}  ${t.desc}`);
    console.error('');
    console.error(`final score: ${result.score.toFixed(2)}`);
  }
}

// ─────────────────────── --why-prefaces diagnostic ───────────────────────
// For each instrument card in the final config, run the v2 preface matcher
// and show the winner plus top 3 candidates with scores and shared-token
// counts. Helps explain why a preface surfaces on a card in the HTML.
//
// Uses the same canonical primitive (`_preface_match.js`) that the gate
// (`regression_prefaces.js`) uses, and that the HTML embed mirrors. The
// `_card_descriptors.js` extractor matches the HTML embed's
// `_cardDescriptorSet` (descriptors only, NO match_tokens enrichment) so
// the diagnostic reports on what the user actually sees in production.

if (flags['why-prefaces'] || flags['why-prefaces-json']) {
  const fs = require('fs');
  const path = require('path');
  const M = require('./_matcher.js');
  const CD = require('./_card_descriptors.js');
  const PM = require('./_preface_match.js');
  const sigs = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'references', '_tradition_signatures.json'), 'utf8'));
  const prefaceDetails = [];
  for (const inst of result.config.instruments) {
    const card = M.cardFromConfig(result.config, inst.id);
    if (!card) continue;
    const descSet = CD.cardDescriptors(card, C, sigs);
    const ranked = PM.rank(descSet, C.PREFACE_LEXICON);
    prefaceDetails.push({
      instId: inst.id,
      candidates: ranked.slice(0, 3).map(r => ({
        id: r.entry.id,
        score: r.score,
        sharedCount: PM.tokensOf(r.entry).filter(t => descSet.has(t)).length,
        tokenCount: PM.tokensOf(r.entry).length,
      })),
      total: ranked.length,
    });
  }
  if (flags['why-prefaces-json']) {
    console.error(JSON.stringify({
      tradition: result.config.traditions[0],
      prefaces: prefaceDetails,
    }, null, 2));
  } else {
    console.error('=== --why-prefaces: per-card preface winners (v2 precision-normalized scoring) ===');
    for (const pd of prefaceDetails) {
      if (pd.candidates.length === 0) {
        console.error(`  ${pd.instId.padEnd(36)} (no preface scores > 0)`);
        continue;
      }
      const winner = pd.candidates[0];
      console.error(`  ${pd.instId.padEnd(36)} ▸ ${winner.id.padEnd(20)} score=${winner.score.toFixed(3)} (${winner.sharedCount}/${winner.tokenCount} tokens)`);
      for (let i = 1; i < pd.candidates.length; i++) {
        const r = pd.candidates[i];
        const tieMark = r.score === winner.score ? ' [TIE — alphabetical tiebreak]' : '';
        console.error(`  ${' '.repeat(38)}  ${r.id.padEnd(20)} score=${r.score.toFixed(3)} (${r.sharedCount}/${r.tokenCount} tokens)${tieMark}`);
      }
      if (pd.total > pd.candidates.length) {
        console.error(`  ${' '.repeat(38)}  (+${pd.total - pd.candidates.length} more scoring > 0)`);
      }
    }
    console.error('');
  }
}

if (flags.json) {
  console.log(JSON.stringify({ config: result.config, score: result.score, breakdown: result.breakdown }, null, 2));
  process.exit(0);
}

const out = translate(result.config, { ceiling: maxChars });
console.log(out);
if (!flags['why-json'] && !flags['why-prefaces-json']) console.error(`(${out.length} chars)`);
