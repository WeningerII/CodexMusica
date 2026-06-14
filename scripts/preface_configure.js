#!/usr/bin/env node
// preface_configure.js — CLI for the inverse-configure engine.
//
// THE GAP THIS CLOSES: the shipped HTML (src/app.js:inverseConfigureForPreface)
// lets a user pick a TARGET preface and have the card reshape itself — its
// part-variants, tuning, room, and chain stages re-pick to maximize overlap
// with the target preface's token signature. The agent/script path had only the
// FORWARD direction (suggest a preface for a fixed card, via _preface_match.js).
// This provides the inverse for agents, in lockstep with the browser.
//
// The algorithm now lives in scripts/_inverse_configure.js (shared with the MCP
// server); this file is the thin CLI wrapper around it.
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
const { seedCard, inverseConfigure, SIGS } = require('./_inverse_configure.js');

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
