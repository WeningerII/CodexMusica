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
//      inventory kind implies and the reachability gate (`reach`). A surface
//      added to the inventory needs a ledger row; one retired from it needs an
//      explicit decision, not a silent removal.
//   3. LIBRARY. The `library#k` rows are not exactly the rows of the Library
//      feature matrix (docs/library-native-design.md), or a row's gate is not
//      a test that matrix row names.
//   4. TREATMENT. A row's treatment is not one of the spec's four (Keep, Move,
//      Merge, Defer — Drop is not a treatment), or lacks what it requires:
//      Merge a known merge group with at least two rows, Move its old route,
//      Defer its reason.
//   5. STATUS. A row is marked done without naming a scenario file that
//      exists.
//   6. GATES. A row's named gate is not a file the repo tracks (an untracked
//      local file does not count, so a local run agrees with CI) — except the
//      tests listed in KNOWN_MISSING, which the feature matrix names but the
//      repo does not have. That list must match exactly: a test that appears
//      must leave it, and a newly missing one fails.
//   7. DEVIATION. A row's `deviation` (a deliberate, disclosed difference from
//      production that a lane keeps, such as #767's note under row 170) is not
//      exactly { pin, file, blob, text, decision }: a 40-hex pinned head, a
//      lane file under prototype/features/, the 40-hex git blob of that file
//      at the pin, the deviation's exact text and the decision that kept it.
//      It also fails when the file's bytes are no longer that blob, or the
//      text is no longer in it, so an accepted deviation can't drift.
//
//   node scripts/check_prototype_manifest.js

const crypto = require('node:crypto');
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
const KNOWN_MISSING = {};

const problems = [];
let checks = 0;
const expect = (ok, what) => {
  checks++;
  if (!ok) problems.push(what);
};
// A file's git blob id, as `git hash-object` gives it.
const blobOf = (bytes) =>
  crypto.createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');

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
  // An inventory row's existing gate is the reachability check (BB8, #720).
  expect(r.gate === 'reach', `row ${r.n} (${r.id}): gate ${r.gate}, an inventory row's is reach`);
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
  ['ls-files', '--cached', '--', 'scripts', 'mcp', 'lyric-harness'],
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

// 7. deviation
const DEVIATION_KEYS = ['blob', 'decision', 'file', 'pin', 'text'];
const HEX40 = /^[0-9a-f]{40}$/;
const deviations = rows.filter((r) => 'deviation' in r);
for (const r of deviations) {
  const d = r.deviation;
  const what = `row ${r.n} (${r.id}): deviation`;
  const ok = d && typeof d === 'object' && !Array.isArray(d);
  expect(
    ok && JSON.stringify(Object.keys(d).sort()) === JSON.stringify(DEVIATION_KEYS),
    `${what} is not exactly { ${DEVIATION_KEYS.join(', ')} }`
  );
  if (!ok) continue;
  expect(HEX40.test(d.pin), `${what}: pin "${d.pin}" is not a 40-hex commit`);
  expect(HEX40.test(d.blob), `${what}: blob "${d.blob}" is not a 40-hex blob id`);
  for (const f of ['text', 'decision']) {
    expect(typeof d[f] === 'string' && d[f].trim().length > 0, `${what}: no ${f}`);
  }
  const file = typeof d.file === 'string' && /^prototype\/features\/[a-z0-9-]+\//.test(d.file);
  expect(file, `${what}: file "${d.file}" is not a lane file under prototype/features/`);
  if (!file) continue;
  const abs = path.join(root, d.file);
  if (!fs.existsSync(abs)) {
    expect(false, `${what}: ${d.file} does not exist`);
    continue;
  }
  const bytes = fs.readFileSync(abs);
  expect(
    blobOf(bytes) === d.blob,
    `${what}: ${d.file} is now blob ${blobOf(bytes)}, not the ${d.blob} the deviation was accepted at; re-confirm it with the lane's author and update the row`
  );
  expect(
    typeof d.text === 'string' && bytes.toString('utf8').includes(d.text),
    `${what}: its text is no longer in ${d.file}`
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
    `${rows.filter((r) => r.status === 'done').length} done; ` +
    `${deviations.length} disclosed deviation(s)${deviations.length ? `, row ${deviations.map((r) => r.n).join(', ')}` : ''}); ` +
    `${missing.size} named gate(s) absent from the repo: ${[...missing].join(', ')}`
);
