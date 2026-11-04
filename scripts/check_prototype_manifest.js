#!/usr/bin/env node
'use strict';
// check_prototype_manifest.js — the #670 prototype's preservation checklist
// cannot be quietly shortened, and cannot drift from what the app has.
//
// prototype/manifest.json holds one row per feature the prototype must
// preserve (#670 spec §1: "no features dropped"). This gate fails when:
//
//   1. ROWS. The rows are not numbered 1..N without gaps, an id repeats, or a
//      row is missing a field.
//   2. INVENTORY. Rows 1–220 are not exactly the `status: reachable` entries
//      of tests/ui_capability_inventory.md, each with the scenario kind its
//      inventory kind implies. A surface added to the inventory needs a
//      ledger row; one retired from it needs an explicit decision, not a
//      silent removal.
//   3. LIBRARY. The `library#k` rows are not exactly the rows of the Library
//      feature matrix (docs/library-native-design.md), or a row's gate is not
//      a test that matrix row names.
//   4. TREATMENT. A row's treatment is not one of the spec's four (Keep, Move,
//      Merge, Defer — Drop is not a treatment), or lacks what it requires:
//      Merge a known merge group with at least two rows, Move its old route,
//      Defer its reason.
//   5. STATUS. A row is marked done without naming a scenario file that
//      exists.
//   6. GATES. A row's named gate is not a file in the repo — except the
//      tests listed in KNOWN_MISSING, which the feature matrix names but the
//      repo does not have. That list must match exactly: a test that appears
//      must leave it, and a newly missing one fails.
//
//   node scripts/check_prototype_manifest.js

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { parseInventory } = require('./_inventory_parser.js');

const root = path.resolve(__dirname, '..');
const MANIFEST = path.join(root, 'prototype', 'manifest.json');
const INVENTORY = path.join(root, 'tests', 'ui_capability_inventory.md');
const MATRIX_DOC = path.join(root, 'docs', 'library-native-design.md');

const KIND = {
  widget: 'W',
  'data-action': 'D',
  modal: 'M',
  'keyboard-shortcut': 'K',
  'drag-drop': 'DD',
};
const MERGE_GROUPS = ['tabs', 'parts', 'environment', 'signal-chain', 'character', 'output'];
const GATE_FILES = { reach: 'scripts/ui_reachability_check.js' };
// Named by the Library feature matrix, absent from the repo (#670 P1 finding).
const KNOWN_MISSING = {
  test_library_routes: 'matrix rows 9, 11, 32–37 and 50 name mcp/test_library_routes',
  test_library_import_inpage: 'matrix rows 53 and 54 name test_library_import_inpage.js',
};

const problems = [];
let checks = 0;
const expect = (ok, what) => {
  checks++;
  if (!ok) problems.push(what);
};

const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
const rows = manifest.rows || [];

// 1. rows
expect(rows.length > 0, 'manifest has no rows');
rows.forEach((r, i) => {
  expect(r.n === i + 1, `row ${i + 1}: numbered ${r.n}`);
  for (const f of ['id', 'treatment', 'kind', 'gate', 'status']) {
    expect(typeof r[f] === 'string' && r[f], `row ${r.n}: no ${f}`);
  }
});
const seen = new Set();
for (const r of rows) {
  expect(!seen.has(r.id), `row ${r.n}: id ${r.id} repeats`);
  seen.add(r.id);
}

// 2. inventory
const parsed = parseInventory(INVENTORY);
expect(!parsed.errors || !parsed.errors.length, `inventory parse errors: ${parsed.errors}`);
const entries = parsed.entries;
const reachable = new Map(entries.filter((e) => e.status === 'reachable').map((e) => [e.name, e]));
const uiRows = rows.filter((r) => !r.id.startsWith('library#'));
for (const r of uiRows) {
  const e = reachable.get(r.id);
  expect(!!e, `row ${r.n} (${r.id}): not a reachable inventory entry (retired or renamed?)`);
  if (e) {
    expect(
      KIND[e.kind] === r.kind,
      `row ${r.n} (${r.id}): kind ${r.kind}, inventory says ${e.kind}`
    );
  }
}
const inLedger = new Set(uiRows.map((r) => r.id));
for (const name of reachable.keys()) {
  expect(
    inLedger.has(name),
    `inventory entry ${name} is reachable but has no ledger row; add one to prototype/manifest.json`
  );
}

// 3. library
const lines = fs.readFileSync(MATRIX_DOC, 'utf8').split('\n');
const start = lines.indexOf('## Feature matrix');
const matrix = new Map();
for (let i = start + 1; i < lines.length && !/^## /.test(lines[i]); i++) {
  const m = lines[i].match(/^\| (\d+) \|/);
  if (m) matrix.set(Number(m[1]), lines[i].split(' | ')[5] || '');
}
expect(start >= 0 && matrix.size > 0, 'docs/library-native-design.md: no feature matrix found');
const libRows = rows.filter((r) => r.id.startsWith('library#'));
for (const r of libRows) {
  const k = Number(r.id.slice('library#'.length));
  const test = matrix.get(k);
  expect(test !== undefined, `row ${r.n} (${r.id}): no such feature-matrix row`);
  expect(r.kind === 'L', `row ${r.n} (${r.id}): kind ${r.kind}, expected L`);
  if (test !== undefined) {
    const named = new RegExp(`(^|[^\\w])${r.gate}([^\\w]|$)`).test(test);
    expect(named, `row ${r.n} (${r.id}): gate ${r.gate} is not named in the matrix row's tests`);
  }
}
const libIds = new Set(libRows.map((r) => r.id));
for (const k of matrix.keys()) {
  expect(libIds.has(`library#${k}`), `feature-matrix row ${k} has no ledger row`);
}

// 4. treatment
const groups = {};
for (const r of rows) {
  const t = r.treatment;
  expect(
    ['Keep', 'Move', 'Merge', 'Defer'].includes(t),
    `row ${r.n} (${r.id}): treatment "${t}" is not Keep, Move, Merge or Defer`
  );
  if (t === 'Merge') {
    expect(
      MERGE_GROUPS.includes(r.merge_group),
      `row ${r.n} (${r.id}): Merge without a known merge_group (${r.merge_group})`
    );
    (groups[r.merge_group] = groups[r.merge_group] || []).push(r.n);
  } else {
    expect(!('merge_group' in r), `row ${r.n} (${r.id}): merge_group on a ${t} row`);
  }
  if (t === 'Move') expect(!!r.old_route, `row ${r.n} (${r.id}): Move without old_route`);
  if (t === 'Defer') expect(!!r.reason, `row ${r.n} (${r.id}): Defer without reason`);
}
for (const [g, ns] of Object.entries(groups)) {
  expect(ns.length >= 2, `merge group ${g} has one row (${ns}); a merge needs two or more`);
}

// 5. status
for (const r of rows) {
  expect(
    r.status === 'pending' || r.status === 'done',
    `row ${r.n} (${r.id}): status "${r.status}" is not pending or done`
  );
  if (r.status === 'done') {
    expect(
      typeof r.scenario === 'string' && fs.existsSync(path.join(root, r.scenario)),
      `row ${r.n} (${r.id}): done without an existing scenario file (${r.scenario})`
    );
  }
}

// 6. gates
const tracked = execFileSync(
  'git',
  [
    'ls-files',
    '--cached',
    '--others',
    '--exclude-standard',
    '--',
    'scripts',
    'mcp',
    'lyric-harness',
  ],
  {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  }
).split('\n');
const byBase = new Set(tracked.map((f) => path.basename(f).replace(/\.(js|mjs|py)$/, '')));
const missing = new Set();
for (const g of new Set(rows.map((r) => r.gate))) {
  const exists = GATE_FILES[g] ? tracked.includes(GATE_FILES[g]) : byBase.has(g);
  if (!exists) missing.add(g);
}
for (const g of missing) {
  expect(g in KNOWN_MISSING, `gate ${g} is not a file in the repo`);
}
for (const g of Object.keys(KNOWN_MISSING)) {
  expect(
    missing.has(g),
    `gate ${g} is listed as missing but is now present (or unused); remove it from KNOWN_MISSING`
  );
}

if (problems.length) {
  console.error(`check_prototype_manifest: FAIL — ${problems.length} of ${checks} checks`);
  for (const p of problems) console.error(`  ✗ ${p}`);
  process.exit(1);
}
const count = (t) => rows.filter((r) => r.treatment === t).length;
console.log(
  `check_prototype_manifest: ${checks}/${checks} checks pass — ${rows.length} rows ` +
    `(${count('Keep')} Keep, ${count('Merge')} Merge, ${count('Move')} Move, ${count('Defer')} Defer; ` +
    `${rows.filter((r) => r.status === 'done').length} done); ` +
    `${missing.size} named gate(s) absent from the repo: ${[...missing].join(', ')}`
);
