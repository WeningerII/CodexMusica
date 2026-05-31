#!/usr/bin/env node
// preface_configure.js — node-side port of the browser's inverse-configure.
//
// THE GAP THIS CLOSES: the shipped HTML (src/app.js:inverseConfigureForPreface)
// lets a user pick a TARGET preface and have the card reshape itself — its
// part-variants, tuning, room, and chain stages re-pick to maximize overlap
// with the target preface's token signature. The agent/script path had only the
// FORWARD direction (suggest a preface for a fixed card, via _preface_match.js).
// This script provides the inverse for agents, in lockstep with the browser.
//
// ALGORITHM (identical to src/app.js): coordinate-ascent over axes. Each axis is
// one slot — a part with ≥2 variants, tuning, room, or a contributing chain
// stage (mic/pre/medium/console). Hold all other axes fixed, swap this axis to
// the option that most increases |TARGET ∩ descriptorSet|, iterate to a fixed
// point. Tradition signature is a fixed baseline. Ties keep the current pick
// (smallest change). Forward scoring/descriptor harvesting reuse the canonical
// node primitives so the two directions never drift.
//
// USAGE
//   node scripts/preface_configure.js --instrument <id> --preface <id> [opts]
//   node scripts/preface_configure.js --tradition <trad> --instrument <id> --preface <id>
//   node scripts/preface_configure.js ... --json
//
//   --instrument <id>   (required) instrument to configure
//   --preface <id>      (required) target preface from the lexicon
//   --tradition <id>    seed the card's starting variants/tuning/room/chain from
//                       this tradition (so the inverse refines a real recipe card
//                       rather than a bare default). Optional.
//   --json              emit machine-readable {start,final,target,changes,config}
//
// OUTPUT: the per-axis changes (from→to with the target tokens each swap adds),
// the score delta (startScore → finalScore out of |target tokens|), and the
// resulting card configuration.

'use strict';
const C = require('./_loader.js');
const { cardDescriptors } = require('./_card_descriptors.js');
const { tokensOf } = require('./_preface_match.js');

const SIGS = (() => {
  try { return require('../references/_tradition_signatures.json'); }
  catch { return {}; }
})();

function parseArgs(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const eq = a.indexOf('=');
    if (eq > 0) { flags[a.slice(2, eq)] = a.slice(eq + 1); continue; }
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) { flags[a.slice(2)] = next; i++; }
    else flags[a.slice(2)] = true;
  }
  return flags;
}

// Build a starting card. If a tradition is given, seed variants/tuning/room/chain
// from it (mirrors how the browser imports a tradition); otherwise use each
// part's default variant and leave env/chain unset.
function seedCard(instrumentId, traditionId) {
  const inst = C.INSTRUMENTS.find((x) => x.id === instrumentId);
  if (!inst) return null;
  const trad = traditionId ? C.TRADITIONS.find((t) => t.id === traditionId) : null;

  const parts = {};
  for (const part of (inst.parts || [])) {
    const variants = part.variants || [];
    if (!variants.length) continue;
    const def = variants.find((v) => v.default) || variants[0];
    parts[part.id] = def.id;
  }
  const chain = {};
  if (trad) {
    chain.mic = trad.chain_mic || null;
    chain.pre = trad.chain_pre || null;
    chain.console = trad.chain_console || null;
    chain.medium = trad.chain_medium || null;
  }
  return {
    instrumentId,
    traditionId: traditionId || null,
    parts,
    tuning: trad ? trad.tuning : null,
    room: trad ? trad.room : null,
    chain,
  };
}

// Port of src/app.js:inverseConfigureForPreface. Returns null if the target or
// instrument is unknown; otherwise { targetId, startScore, finalScore,
// targetTokenCount, changes[], config }.
function inverseConfigure(card, targetId) {
  const target = (C.PREFACE_LEXICON || []).find((p) => p.id === targetId);
  if (!target) return null;
  const TARGET = new Set(tokensOf(target));
  if (TARGET.size === 0) return null;
  const inst = C.INSTRUMENTS.find((x) => x.id === card.instrumentId);
  if (!inst) return null;

  const baseline = new Set(SIGS[card.traditionId] || []);

  // Axes: each part with ≥2 variants, plus tuning, room, contributing chain stages.
  const axes = [];
  for (const part of (inst.parts || [])) {
    const variants = part.variants || [];
    if (variants.length < 2) continue;
    axes.push({
      kind: 'part', id: part.id, label: part.name || part.id,
      options: variants.map((v) => ({ id: v.id, label: v.name || v.id, contrib: new Set(v.descriptors || []) })),
      current: (card.parts || {})[part.id] || null,
    });
  }
  axes.push({
    kind: 'tuning', id: '__tuning__', label: 'Tuning',
    options: (C.TUNINGS || []).map((t) => ({ id: t.id, label: t.name || t.id, contrib: new Set(t.descriptors || []) })),
    current: card.tuning || null,
  });
  axes.push({
    kind: 'room', id: '__room__', label: 'Room',
    options: (C.ROOMS || []).map((r) => ({ id: r.id, label: r.name || r.id, contrib: new Set(r.descriptors || []) })),
    current: card.room || null,
  });
  for (const stageId of ['mic', 'pre', 'medium', 'console']) {
    const sec = (C.CHAIN_SECTIONS || []).find((s) => s.stage === stageId || s.id === stageId);
    if (!sec || !(sec.items || []).length) continue;
    axes.push({
      kind: 'chain', id: stageId, label: 'Chain · ' + stageId,
      options: sec.items.map((it) => ({ id: it.id, label: it.name || it.id, contrib: new Set(it.descriptors || []) })),
      current: (card.chain || {})[stageId] || null,
    });
  }

  const descriptorsFor = (chosenMap) => {
    const D = new Set(baseline);
    for (const ax of axes) {
      const pick = chosenMap[ax.id];
      if (!pick) continue;
      const opt = ax.options.find((o) => o.id === pick);
      if (opt) for (const t of opt.contrib) D.add(t);
    }
    return D;
  };
  const targetHits = (D) => { let n = 0; for (const t of TARGET) if (D.has(t)) n++; return n; };

  const chosen = {};
  for (const ax of axes) chosen[ax.id] = ax.current || null;
  let bestScore = targetHits(descriptorsFor(chosen));
  const startScore = bestScore;

  let changed = true, iters = 0;
  while (changed && iters < 12) {
    changed = false; iters++;
    for (const ax of axes) {
      let bestId = chosen[ax.id];
      let bestForAxis = bestScore;
      for (const opt of ax.options) {
        if (opt.id === chosen[ax.id]) continue;
        const trial = Object.assign({}, chosen);
        trial[ax.id] = opt.id;
        const s = targetHits(descriptorsFor(trial));
        if (s > bestForAxis) { bestForAxis = s; bestId = opt.id; }
      }
      if (bestId !== chosen[ax.id]) { chosen[ax.id] = bestId; bestScore = bestForAxis; changed = true; }
    }
  }
  const finalScore = bestScore;

  const counterfactualForAxis = (skipId) => {
    const D = new Set(baseline);
    for (const ax of axes) {
      const pick = ax.id === skipId ? ax.current : chosen[ax.id];
      if (!pick) continue;
      const opt = ax.options.find((o) => o.id === pick);
      if (opt) for (const t of opt.contrib) D.add(t);
    }
    return D;
  };

  const changes = [];
  for (const ax of axes) {
    if (chosen[ax.id] === ax.current) continue;
    const fromOpt = ax.options.find((o) => o.id === ax.current);
    const toOpt = ax.options.find((o) => o.id === chosen[ax.id]);
    const cf = counterfactualForAxis(ax.id);
    const targetTokensAdded = [];
    if (toOpt) for (const t of toOpt.contrib) if (TARGET.has(t) && !cf.has(t)) targetTokensAdded.push(t);
    changes.push({
      kind: ax.kind, axisLabel: ax.label,
      fromLabel: fromOpt ? fromOpt.label : (ax.current || '(none)'),
      toLabel: toOpt ? toOpt.label : (chosen[ax.id] || '(none)'),
      targetTokensAdded,
    });
  }

  // Materialize the resulting config.
  const config = { instrumentId: card.instrumentId, traditionId: card.traditionId, parts: Object.assign({}, card.parts), tuning: card.tuning, room: card.room, chain: Object.assign({}, card.chain) };
  for (const ax of axes) {
    const pick = chosen[ax.id];
    if (ax.kind === 'part') config.parts[ax.id] = pick;
    else if (ax.kind === 'tuning') config.tuning = pick;
    else if (ax.kind === 'room') config.room = pick;
    else if (ax.kind === 'chain') config.chain[ax.id] = pick;
  }
  config.preface = targetId;

  return { targetId, startScore, finalScore, targetTokenCount: TARGET.size, changes, config };
}

function main() {
  const flags = parseArgs(process.argv.slice(2));
  const instrumentId = flags.instrument;
  const targetId = flags.preface;
  if (!instrumentId || !targetId) {
    console.error('usage: node scripts/preface_configure.js --instrument <id> --preface <id> [--tradition <id>] [--json]');
    process.exit(2);
  }
  if (!C.INSTRUMENTS.find((x) => x.id === instrumentId)) {
    console.error('Unknown instrument id: ' + instrumentId);
    process.exit(2);
  }
  if (!(C.PREFACE_LEXICON || []).find((p) => p.id === targetId)) {
    console.error('Unknown preface id: ' + targetId);
    process.exit(2);
  }
  const card = seedCard(instrumentId, flags.tradition || null);
  const result = inverseConfigure(card, targetId);
  if (!result) { console.error('inverse-configure failed (no target tokens or unknown instrument).'); process.exit(1); }

  if (flags.json) {
    // Include the realized descriptor set + achieved forward score for callers.
    const D = cardDescriptors(result.config, C, SIGS);
    const achieved = (() => { let n = 0; for (const t of tokensOf(C.PREFACE_LEXICON.find((p) => p.id === targetId))) if (D.has(t)) n++; return n; })();
    console.log(JSON.stringify({ ...result, achievedForwardHits: achieved }, null, 2));
    return;
  }

  console.log(`inverse-configure: ${instrumentId} → preface "${targetId}"`);
  console.log(`  target coverage: ${result.startScore}/${result.targetTokenCount} → ${result.finalScore}/${result.targetTokenCount} tokens`);
  if (result.changes.length === 0) {
    console.log('  (already optimal — no axis changes; preface label set)');
  } else {
    console.log(`  ${result.changes.length} axis change(s):`);
    for (const c of result.changes) {
      const add = c.targetTokensAdded.length ? '  [+' + c.targetTokensAdded.join(', ') + ']' : '';
      console.log(`    ${c.axisLabel}: ${c.fromLabel} → ${c.toLabel}${add}`);
    }
  }
}

main();
