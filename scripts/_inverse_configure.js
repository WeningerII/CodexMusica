'use strict';
// _inverse_configure.js — shared inverse-configure engine.
//
// Extracted verbatim from preface_configure.js (behavior-preserving) so BOTH the
// CLI (scripts/preface_configure.js) and the MCP server (mcp/) can call
// seedCard()/inverseConfigure() in-process. The algorithm — coordinate-ascent
// over axes (parts with ≥2 variants, tuning, room, mic/pre/medium/console),
// maximizing |TARGET preface tokens ∩ descriptor set| — is identical to the
// browser's inverseConfigureForPreface and to the prior CLI output.

const C = require('./_loader.js');
const { tokensOf } = require('./_preface_match.js');

const SIGS = (() => {
  try {
    return require('../references/_tradition_signatures.json');
  } catch {
    return {};
  }
})();

// Build a starting card. If a tradition is given, seed variants/tuning/room/chain
// from it (mirrors how the browser imports a tradition); otherwise use each
// part's default variant and leave env/chain unset.
function seedCard(instrumentId, traditionId) {
  const inst = C.INSTRUMENTS.find((x) => x.id === instrumentId);
  if (!inst) return null;
  const trad = traditionId ? C.TRADITIONS.find((t) => t.id === traditionId) : null;

  const parts = {};
  for (const part of inst.parts || []) {
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
function inverseConfigure(card, targetId, opts) {
  // opts.pin: axis ids held FIXED during coordinate-ascent — a pinned axis still
  // contributes its descriptors to the score but is never reshaped. Kept in
  // lockstep with src/app.js:inverseConfigureForPreface (the browser passes pin
  // when a material edit triggers the cascade; the connector/CLI don't pin today).
  const pinned = opts && Array.isArray(opts.pin) ? new Set(opts.pin) : null;
  const target = (C.PREFACE_LEXICON || []).find((p) => p.id === targetId);
  if (!target) return null;
  const TARGET = new Set(tokensOf(target));
  if (TARGET.size === 0) return null;
  const inst = C.INSTRUMENTS.find((x) => x.id === card.instrumentId);
  if (!inst) return null;

  const baseline = new Set(SIGS[card.traditionId] || []);

  // Axes: each part with ≥2 variants, plus tuning, room, contributing chain stages.
  const axes = [];
  for (const part of inst.parts || []) {
    const variants = part.variants || [];
    if (variants.length < 2) continue;
    // The universal cross-instrument materials are auto:false — the optimizer must
    // never AUTO-select a borrowed material (only a human picks one). Offer only the
    // curated variants as reshape targets, but KEEP the current pick even if it is a
    // borrowed material so an earlier human choice is preserved, not dropped.
    const curVid = (card.parts || {})[part.id] || null;
    const choosable = variants.filter((v) => !v.expanded || v.id === curVid);
    axes.push({
      kind: 'part',
      id: part.id,
      label: part.name || part.id,
      options: choosable.map((v) => ({
        id: v.id,
        label: v.name || v.id,
        contrib: new Set(v.descriptors || []),
      })),
      current: curVid,
    });
  }
  axes.push({
    kind: 'tuning',
    id: '__tuning__',
    label: 'Tuning',
    options: (C.TUNINGS || []).map((t) => ({
      id: t.id,
      label: t.name || t.id,
      contrib: new Set(t.descriptors || []),
    })),
    current: card.tuning || null,
  });
  axes.push({
    kind: 'room',
    id: '__room__',
    label: 'Room',
    options: (C.ROOMS || []).map((r) => ({
      id: r.id,
      label: r.name || r.id,
      contrib: new Set(r.descriptors || []),
    })),
    current: card.room || null,
  });
  for (const stageId of ['mic', 'pre', 'medium', 'console']) {
    const sec = (C.CHAIN_SECTIONS || []).find((s) => s.stage === stageId || s.id === stageId);
    if (!sec || !(sec.items || []).length) continue;
    axes.push({
      kind: 'chain',
      id: stageId,
      label: 'Chain · ' + stageId,
      options: sec.items.map((it) => ({
        id: it.id,
        label: it.name || it.id,
        contrib: new Set(it.descriptors || []),
      })),
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
  const targetHits = (D) => {
    let n = 0;
    for (const t of TARGET) if (D.has(t)) n++;
    return n;
  };

  const chosen = {};
  for (const ax of axes) chosen[ax.id] = ax.current || null;
  let bestScore = targetHits(descriptorsFor(chosen));
  const startScore = bestScore;

  let changed = true,
    iters = 0;
  while (changed && iters < 12) {
    changed = false;
    iters++;
    for (const ax of axes) {
      if (pinned && pinned.has(ax.id)) continue; // user-fixed axis — preserve the manual pick
      let bestId = chosen[ax.id];
      let bestForAxis = bestScore;
      for (const opt of ax.options) {
        if (opt.id === chosen[ax.id]) continue;
        const trial = Object.assign({}, chosen);
        trial[ax.id] = opt.id;
        const s = targetHits(descriptorsFor(trial));
        if (s > bestForAxis) {
          bestForAxis = s;
          bestId = opt.id;
        }
      }
      if (bestId !== chosen[ax.id]) {
        chosen[ax.id] = bestId;
        bestScore = bestForAxis;
        changed = true;
      }
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
    if (toOpt)
      for (const t of toOpt.contrib) if (TARGET.has(t) && !cf.has(t)) targetTokensAdded.push(t);
    changes.push({
      kind: ax.kind,
      axisLabel: ax.label,
      fromLabel: fromOpt ? fromOpt.label : ax.current || '(none)',
      toLabel: toOpt ? toOpt.label : chosen[ax.id] || '(none)',
      targetTokensAdded,
    });
  }

  // Materialize the resulting config.
  const config = {
    instrumentId: card.instrumentId,
    traditionId: card.traditionId,
    parts: Object.assign({}, card.parts),
    tuning: card.tuning,
    room: card.room,
    chain: Object.assign({}, card.chain),
  };
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

module.exports = { seedCard, inverseConfigure, SIGS };
