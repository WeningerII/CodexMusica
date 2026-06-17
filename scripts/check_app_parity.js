#!/usr/bin/env node
'use strict';
// check_app_parity.js — the gold-standard gate: run the BROWSER app's OWN
// importTradition + compileRecipeStack('rich') headlessly and assert the
// connector's deterministic seed+render reproduces it, byte-for-byte, across the
// whole catalog. This is the catalog-wide seed-parity gate of
// CONNECTOR_WORKSPACE_PLAN.md §6.1 — it compares the app's actual inline code to
// the shared SSOT modules the connector uses, so any drift fails CI.
//
//   node scripts/check_app_parity.js              # all traditions
//   node scripts/check_app_parity.js --limit=200  # first N (faster)
//   node scripts/check_app_parity.js --show=5     # print up to N full diffs
//
// How it runs app.js without a browser: _loader.js puts the catalog on globalThis
// (the app reads bare globals like INSTRUMENTS), and app.js's only load-time
// side-effects are addEventListener calls. We evaluate app.js as a function body
// with permissive DOM stubs injected, then call its real importTradition +
// compileRecipeStack. No re-implementation — the app's own functions run.

const fs = require('fs');
const path = require('path');

const C = require('./_loader.js'); // populates globalThis.INSTRUMENTS / TRADITIONS / …
const { seedTraditionCards, renderWorkspace } = require('./_seed_workspace.js');

const args = process.argv.slice(2);
const flag = (name, def) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.split('=')[1] : def;
};
const LIMIT = parseInt(flag('limit', '0'), 10) || 0;          // 0 = all
const SHOW = parseInt(flag('show', '3'), 10);

// ── load the app's real functions headlessly ────────────────────────────────
function loadApp() {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  // Mirror build_html.js: prepend the card-descriptor harvester (single source
  // scripts/_card_descriptors.js, @inline region) + the _cardDescriptorSet adapter
  // the app's preface dedup calls. We do NOT prepend the family-parts merge snippet:
  // _loader.js already ran mergeFamilyParts on globalThis.INSTRUMENTS, and the merge
  // is not idempotent — re-running it would corrupt the parts both sides read.
  const cdSource = fs.readFileSync(path.join(__dirname, '_card_descriptors.js'), 'utf8');
  const cdMatch = cdSource.match(/\/\* @inline-start[^\n]*\*\/\n([\s\S]*?)\n\/\* @inline-end \*\//);
  if (!cdMatch) throw new Error('could not find @inline-start/@inline-end markers in _card_descriptors.js');
  const cardDescriptorsSnippet = `
${cdMatch[1]}
function _cardDescriptorSet(card) {
  return harvestDescriptors(card, {
    inst: (id) => Inst(id),
    tuning: (id) => Tuning(id),
    room: (id) => Room(id),
    chainItem: (stageId, id) => ChainItem(stageId, id),
    signature: (tradId) => _traditionSignatureFor(tradId),
  });
}
`;
  // A self-returning proxy absorbs every DOM call (document.x.y(), addEventListener,
  // etc.) as a no-op so app.js's load-time listeners and any defensive UI calls
  // don't crash. importTradition / compileRecipeStack touch only catalog + app state.
  const sink = new Proxy(function () {}, {
    get: (_t, p) => (p === Symbol.toPrimitive || p === 'toString' ? () => '' : sink),
    apply: () => sink,
    construct: () => sink,
  });
  const factory = new Function(
    'document', 'window', 'requestAnimationFrame', 'cancelAnimationFrame',
    'localStorage', 'navigator', 'fetch',
    `${cardDescriptorsSnippet}\n${src}\n;return { importTradition, compileRecipeStack, app };`,
  );
  return factory(sink, sink, () => 0, () => {}, sink, sink, () => sink);
}

let app;
try { app = loadApp(); }
catch (e) { console.error('Could not load src/app.js headlessly:\n  ' + e.message); process.exit(2); }

function appRecipe(id) {
  app.app.cards = [];
  app.app.collapsedTraditionGroups = new Set();
  app.importTradition(id);
  return app.compileRecipeStack(app.app.cards, 'rich', { ceiling: 1000 });
}
function connectorRecipe(id) {
  return renderWorkspace(seedTraditionCards(id), { format: 'rich', ceiling: 1000 });
}

// ── compare across the catalog ──────────────────────────────────────────────
let traditions = (C.TRADITIONS || []).map((t) => t.id);
if (LIMIT > 0) traditions = traditions.slice(0, LIMIT);

let match = 0, mismatch = 0, errored = 0, shown = 0;
const firstDiff = (a, b) => { const n = Math.min(a.length, b.length); for (let i = 0; i < n; i++) if (a[i] !== b[i]) return i; return n; };

const t0 = Date.now();
for (let i = 0; i < traditions.length; i++) {
  const id = traditions[i];
  let aRec, cRec;
  try { aRec = appRecipe(id); } catch (e) { errored++; console.error(`  ! ${id}: app threw — ${e.message}`); continue; }
  try { cRec = connectorRecipe(id); } catch (e) { errored++; console.error(`  ! ${id}: connector threw — ${e.message}`); continue; }
  if (aRec === cRec) { match++; continue; }
  mismatch++;
  if (shown < SHOW) {
    shown++;
    const d = firstDiff(aRec, cRec);
    console.error(`\n  ✗ ${id} (diverges at char ${d}, app ${aRec.length} / connector ${cRec.length})`);
    console.error(`    app : …${JSON.stringify(aRec.slice(Math.max(0, d - 20), d + 40))}`);
    console.error(`    conn: …${JSON.stringify(cRec.slice(Math.max(0, d - 20), d + 40))}`);
  }
  if (process.stdout.isTTY) process.stdout.write('');
}
const secs = ((Date.now() - t0) / 1000).toFixed(1);

console.log(`\n${match}/${traditions.length} byte-identical to the app  (${mismatch} mismatch, ${errored} error, ${secs}s)`);
if (mismatch === 0 && errored === 0) { console.log('PASS — connector seed+render reproduces the app Current Recipe catalog-wide'); process.exit(0); }
console.log('FAIL');
process.exit(1);
