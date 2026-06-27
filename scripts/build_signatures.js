#!/usr/bin/env node
// build_signatures.js — single source of truth for tradition signatures.
//
// PROBLEM THIS SOLVES: tradition signatures lived in TWO places that drifted —
// `references/_tradition_signatures.json` (the agent/script copy, read by
// _card_descriptors.js / recipe.js / _matcher.js) and an inlined
// `const TRADITION_SIGNATURES = {...}` block in `src/app.js` (the browser copy).
// They forked: 208 keys differed, a tradition was renamed on one side only, and
// the JSON accumulated 13 orphan keys that aren't real tradition ids.
//
// THE FIX: make the JSON canonical and DERIVED, then inline it verbatim into
// app.js between markers (same idiom as scripts/_merge.js → build_html.js).
//
// RECONCILIATION RULES (run once via --reconcile, then the JSON is the truth):
//   - The JSON is authoritative: it is exactly what the agent scripts already
//     read via `sigs[traditionId]`. Keep every real-tradition-id key's value
//     BYTE-FOR-BYTE, and drop the keys that are NOT real tradition ids (13
//     orphans like `2tone_ska_revival`, `texas_blues`, `trip_hop` that no card
//     ever reads). The stale app.js copy is discarded, not merged — its drifted
//     tokens are exactly what this unification removes. Because every real id's
//     value is untouched, agent behavior (recipes, preface assignments) is
//     provably unchanged; only the browser's stale inline copy is corrected.
//
// DEFAULT MODE: regenerate the app.js inline block from the (already-canonical)
// JSON and verify they match. Exits non-zero on any mismatch so CI/tandem catch
// drift. Use --reconcile once to drop the orphan keys + regenerate the app block.
//
// USAGE
//   node scripts/build_signatures.js              # regen app.js block from JSON; verify
//   node scripts/build_signatures.js --reconcile  # one-time: union app.js tokens into JSON, then regen
//   node scripts/build_signatures.js --check      # verify only; no writes (for tandem/CI)

'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const JSON_PATH = path.join(ROOT, 'references/_tradition_signatures.json');
const APP_PATH = path.join(ROOT, 'src/app.js');

const flags = new Set(process.argv.slice(2).map((a) => a.replace(/^--/, '')));

function loadRealTraditionIds() {
  // Minimal loader: read references/05_traditions.js as bare const and eval.
  const src = fs.readFileSync(path.join(ROOT, 'references/05_traditions.js'), 'utf8');
  const g = {};
  new Function('globalThis', src.replace(/const TRADITIONS/, 'globalThis.TRADITIONS'))(g);
  return new Set((g.TRADITIONS || []).map((t) => t.id));
}

function extractAppBlock() {
  const app = fs.readFileSync(APP_PATH, 'utf8');
  const m = app.match(/const TRADITION_SIGNATURES = (\{[\s\S]*?\n\});/);
  if (!m) throw new Error('could not find TRADITION_SIGNATURES in src/app.js');
  return { app, obj: new Function('return ' + m[1])(), raw: m[0], rawValue: m[1] };
}

function reconcileIntoJson(realIds) {
  // Keep every real-tradition-id key's JSON value verbatim; drop orphan keys
  // (not a real tradition id). No merge with app.js — the app copy is the stale
  // side. Output key order follows the JSON's existing order, filtered to real
  // ids, so the diff is purely "orphans removed".
  const json = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
  const out = {};
  let dropped = 0;
  for (const id of Object.keys(json)) {
    if (realIds.has(id)) out[id] = json[id];
    else dropped++;
  }
  fs.writeFileSync(JSON_PATH, JSON.stringify(out, null, 2) + '\n');
  reconcileIntoJson._dropped = dropped;
  return out;
}

function canonicalJson() {
  return JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
}

// Render the app.js inline block from the canonical JSON. Single-quoted to
// satisfy the repo's prettier/eslint (singleQuote: true). One tradition per
// line keeps diffs readable and matches the historical block's density.
function renderAppBlock(sigs) {
  const q = (s) => "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
  const lines = Object.keys(sigs).map((id) => {
    const toks = sigs[id].map(q).join(', ');
    return '  ' + q(id) + ': [' + toks + '],';
  });
  return 'const TRADITION_SIGNATURES = {\n' + lines.join('\n') + '\n};';
}

function writeAppBlock(sigs) {
  const { app, raw } = extractAppBlock();
  const block = renderAppBlock(sigs);
  const next = app.replace(raw, block);
  fs.writeFileSync(APP_PATH, next);
}

function currentAppMatchesJson(sigs) {
  const { obj } = extractAppBlock();
  const a = JSON.stringify(obj);
  const b = JSON.stringify(sigs);
  return a === b;
}

function main() {
  const realIds = loadRealTraditionIds();

  if (flags.has('reconcile')) {
    const merged = reconcileIntoJson(realIds);
    writeAppBlock(merged);
    console.log(
      `reconciled: ${Object.keys(merged).length} tradition signatures (JSON now canonical), app.js block regenerated.`
    );
    return;
  }

  const sigs = canonicalJson();

  if (flags.has('check')) {
    if (currentAppMatchesJson(sigs)) {
      console.log(
        `signatures parity OK — app.js block matches JSON (${Object.keys(sigs).length} traditions).`
      );
      process.exit(0);
    }
    console.error(
      'signatures DRIFT — src/app.js TRADITION_SIGNATURES != references/_tradition_signatures.json.'
    );
    console.error('  run: node scripts/build_signatures.js   (to regenerate the app.js block)');
    process.exit(1);
  }

  // Default: regenerate app.js block from JSON, then confirm.
  writeAppBlock(sigs);
  if (!currentAppMatchesJson(sigs)) {
    console.error('regeneration failed self-check — app.js block still != JSON.');
    process.exit(1);
  }
  console.log(
    `regenerated src/app.js TRADITION_SIGNATURES from JSON (${Object.keys(sigs).length} traditions).`
  );
}

main();
