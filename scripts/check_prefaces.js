#!/usr/bin/env node
// check_prefaces.js — preface-lexicon hygiene gate, in PRODUCTION semantics.
//
// This is the `_card_descriptors`-based dead-token gate prescribed by the
// verification audit (AUDIT_REPORT §3.2 M-DATA-1 / §5.5). It answers the
// question that matters to the shipped app:
//
//   "Will every token in every preface actually be able to score against a
//    card, AS THE app RENDERS preface suggestions?"
//
// Production preface matching pools a card's `descriptors` only (see
// _card_descriptors.js). A preface token that lives only in variant
// `match_tokens` can never enter `|shared|`, yet it still inflates the
// `|shared| / tokens.length` denominator — so it silently deflates that
// preface's max score (the same hazard as a duplicate token).
//
// DELIBERATE COMPLEMENT, NOT a replacement for audit_dead_tokens.js: that gate
// asks the broader authoring question ("does this token exist anywhere in the
// catalog, match_tokens included?") and is intentionally lenient — see its
// header + the tandem `card-descriptor semantics aligned` check. The two gates
// answer the two questions the author articulated; both are worth having.
//
// Fails (exit 1) on any of: a production-dead token, a duplicate token, an
// empty token list, or a duplicate preface id. Clean ⇒ exit 0.

'use strict';
const C = require('./_loader.js');

// Production-reachable descriptor universe — the union of the descriptor
// SOURCES that _card_descriptors.js:harvestDescriptors pools in the shipped
// app: variant `descriptors`, tuning, room, chain-stage items, and tradition
// signatures. NOT `match_tokens`. If you ever add a descriptor source to
// _card_descriptors.harvestDescriptors, add it here too (and vice-versa) — the
// two must agree on what "a card can surface" means.
function productionDescriptorUniverse() {
  const live = new Set();
  for (const i of (C.INSTRUMENTS || [])) {
    for (const p of (i.parts || [])) {
      for (const v of (p.variants || [])) {
        for (const d of (v.descriptors || [])) live.add(d);
      }
    }
  }
  for (const t of (C.TUNINGS || [])) for (const d of (t.descriptors || [])) live.add(d);
  for (const r of (C.ROOMS || [])) for (const d of (r.descriptors || [])) live.add(d);
  for (const s of (C.CHAIN_SECTIONS || [])) {
    for (const it of (s.items || [])) for (const d of (it.descriptors || [])) live.add(d);
  }
  let sigs = {};
  try { sigs = require('../references/_tradition_signatures.json'); } catch (e) { /* optional */ }
  for (const k of Object.keys(sigs)) for (const d of (sigs[k] || [])) live.add(d);
  return live;
}

const lexicon = C.PREFACE_LEXICON || [];

// Non-vacuity guard (the check_doc_commands lesson): an empty lexicon must FAIL,
// not pass silently — otherwise a load regression looks "clean".
if (lexicon.length === 0) {
  console.log('PREFACE LEXICON CHECK: FAIL — PREFACE_LEXICON is empty (nothing loaded).');
  process.exit(1);
}

const universe = productionDescriptorUniverse();
const issues = [];
const idCounts = new Map();
let tokenTotal = 0;

for (const e of lexicon) {
  idCounts.set(e.id, (idCounts.get(e.id) || 0) + 1);
  const toks = Array.isArray(e.tokens) ? e.tokens : [];
  tokenTotal += toks.length;

  if (toks.length === 0) { issues.push({ kind: 'empty', id: e.id, detail: 'no tokens — will never match' }); continue; }

  const seen = new Set();
  const dups = new Set();
  for (const t of toks) { if (seen.has(t)) dups.add(t); else seen.add(t); }
  if (dups.size) issues.push({ kind: 'dup-token', id: e.id, detail: [...dups].join(', ') + ' (repeated — deflates score)' });

  const dead = [...seen].filter((t) => !universe.has(t));
  if (dead.length) issues.push({ kind: 'dead-token', id: e.id, detail: dead.join(', ') + ' (no card produces this in production — never scores)' });
}

for (const [id, n] of idCounts) if (n > 1) issues.push({ kind: 'dup-id', id, detail: n + ' entries share this id' });

if (issues.length === 0) {
  console.log(`PREFACE LEXICON CHECK: PASS — ${lexicon.length} prefaces, ${tokenTotal} tokens, ${universe.size} production descriptors; 0 issues (no dup ids, no dup/empty/production-dead tokens).`);
  process.exit(0);
}

const byKind = {};
for (const i of issues) (byKind[i.kind] ||= []).push(i);
console.log(`PREFACE LEXICON CHECK: FAIL — ${issues.length} issue(s) across ${Object.keys(byKind).length} kind(s):\n`);
for (const kind of ['dup-id', 'empty', 'dup-token', 'dead-token']) {
  for (const i of (byKind[kind] || [])) console.log(`  [${kind}] ${i.id}: ${i.detail}`);
}
process.exit(1);
