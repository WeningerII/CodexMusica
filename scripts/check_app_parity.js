#!/usr/bin/env node
'use strict';
// check_app_parity.js — the gold-standard gate: run the BROWSER app's OWN
// importTradition + compileRecipeStack headlessly and assert the connector's
// deterministic seed+render reproduces it, byte-for-byte, across the whole
// catalog and across EVERY format render_recipe offers. It compares the app's
// actual inline code to the shared SSOT modules the connector uses, so any drift
// fails CI.
//
// @covers: connector-render-parity
//
//   node scripts/check_app_parity.js                 # all traditions, all formats
//   node scripts/check_app_parity.js --limit=200     # first N traditions (faster)
//   node scripts/check_app_parity.js --format=prose  # one format (debugging)
//   node scripts/check_app_parity.js --show=5        # print up to N full diffs
//
// How it runs app.js without a browser: _loader.js puts the catalog on globalThis
// (the app reads bare globals like INSTRUMENTS), and app.js's only load-time
// side-effects are addEventListener calls. We evaluate app.js as a function body
// with permissive DOM stubs injected, then call its real importTradition +
// compileRecipeStack. No re-implementation — the app's own functions run.

const C = require('./_loader.js'); // populates globalThis.INSTRUMENTS / TRADITIONS / …
const { seedTraditionCards, renderWorkspace } = require('./_seed_workspace.js');

const args = process.argv.slice(2);
const flag = (name, def) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.split('=')[1] : def;
};
const LIMIT = parseInt(flag('limit', '0'), 10) || 0; // 0 = all
const SHOW = parseInt(flag('show', '3'), 10);

// ── load the app's real functions headlessly ────────────────────────────────
// The loader lives in _load_app.js so this gate and check_edit_parity.js share
// exactly one way of running src/app.js. Two copies would be free to drift, and
// a parity gate whose loader has drifted is a parity gate that proves nothing.
const { loadApp } = require('./_load_app.js');

let app;
try {
  app = loadApp();
} catch (e) {
  console.error('Could not load src/app.js headlessly:\n  ' + e.message);
  process.exit(2);
}

// EVERY format the connector advertises, not just the default. mcp/tools.js
// offers render_recipe(format: 'rich'|'tags'|'prose'|'compact') and the server
// instructions promise the result is "identical to what a human sees in the
// app". This gate checked 'rich' alone, so prose/tags/compact drifted from
// src/app.js on every tradition without a single gate going red. The scope of a
// parity gate has to be the scope of the promise.
const FORMATS = ['rich', 'prose', 'tags', 'compact'];
const ONLY = flag('format', '');
const formats = ONLY ? ONLY.split(',').filter((f) => FORMATS.includes(f)) : FORMATS;
if (formats.length === 0) {
  console.error(`FAIL — --format=${ONLY} matches none of: ${FORMATS.join(', ')}`);
  process.exit(2);
}

function appRecipe(id, format) {
  app.app.cards = [];
  app.app.collapsedTraditionGroups = new Set();
  app.importTradition(id);
  return app.compileRecipeStack(app.app.cards, format, { ceiling: 1000 });
}
function connectorRecipe(id, format) {
  return renderWorkspace(seedTraditionCards(id), { format, ceiling: 1000 });
}

// ── compare across the catalog ──────────────────────────────────────────────
let traditions = (C.TRADITIONS || []).map((t) => t.id);
if (LIMIT > 0) traditions = traditions.slice(0, LIMIT);
// Refuse to pass vacuously: with 0 traditions the `mismatch === 0 && errored === 0`
// success test below is trivially true, so an empty catalog would mint a green
// parity result that proves nothing. Fail (exit 1, matching check_prefaces.js's
// empty-loaded-data guard; exit 2 is reserved for a missing input file).
if (traditions.length === 0) {
  console.error('FAIL — no traditions loaded (catalog empty); refusing to pass vacuously');
  process.exit(1);
}

const firstDiff = (a, b) => {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) return i;
  return n;
};

const t0 = Date.now();
const results = [];
let shown = 0;

for (const format of formats) {
  let match = 0,
    mismatch = 0,
    errored = 0;
  for (let i = 0; i < traditions.length; i++) {
    const id = traditions[i];
    let aRec, cRec;
    try {
      aRec = appRecipe(id, format);
    } catch (e) {
      errored++;
      console.error(`  ! [${format}] ${id}: app threw — ${e.message}`);
      continue;
    }
    try {
      cRec = connectorRecipe(id, format);
    } catch (e) {
      errored++;
      console.error(`  ! [${format}] ${id}: connector threw — ${e.message}`);
      continue;
    }
    if (aRec === cRec) {
      match++;
      continue;
    }
    mismatch++;
    if (shown < SHOW) {
      shown++;
      const d = firstDiff(aRec, cRec);
      console.error(
        `\n  ✗ [${format}] ${id} (diverges at char ${d}, app ${aRec.length} / connector ${cRec.length})`
      );
      console.error(`    app : …${JSON.stringify(aRec.slice(Math.max(0, d - 20), d + 40))}`);
      console.error(`    conn: …${JSON.stringify(cRec.slice(Math.max(0, d - 20), d + 40))}`);
    }
  }
  results.push({ format, match, mismatch, errored });
}
const secs = ((Date.now() - t0) / 1000).toFixed(1);

console.log(
  `\n=== app ≡ connector, ${traditions.length} traditions × ${formats.length} format(s) ===`
);
for (const r of results) {
  const verdict = r.mismatch === 0 && r.errored === 0 ? 'ok  ' : 'FAIL';
  console.log(
    `  ${verdict} ${r.format.padEnd(8)} ${r.match}/${traditions.length} byte-identical` +
      (r.mismatch || r.errored ? `  (${r.mismatch} mismatch, ${r.errored} error)` : '')
  );
}
const bad = results.filter((r) => r.mismatch > 0 || r.errored > 0);
if (bad.length === 0) {
  console.log(
    `PASS — every advertised format reproduces the app Current Recipe catalog-wide (${secs}s)`
  );
  process.exit(0);
}
console.log(`FAIL — ${bad.map((r) => r.format).join(', ')} diverge from the app (${secs}s)`);
process.exit(1);
