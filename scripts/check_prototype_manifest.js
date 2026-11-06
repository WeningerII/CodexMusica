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
//   5. STATUS. A row is marked done without naming a scenario (a file
//      prototype/scenarios/<lane>/<name>.cjs or .mjs, its name not starting
//      with a dot, as _prototype_scenarios.js discovers them for the runner
//      too) that declares it, or a scenario's declaration is malformed. A scenario declares the rows it
//      proves in one line of its header, before its first line of code:
//      `// rows: 163, 164`, rows of this manifest, none twice (#665
//      6675529176). A file that merely exists proves nothing.
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
// AFTER THE RUN. A declaration says what a scenario claims; only a run shows
// it passing. run_prototype_scenarios.js, the last step of test:prototype,
// writes what it ran to a results file under the OS temp dir (never
// committed) and then runs this check on it, in its own process:
//
//   node scripts/check_prototype_manifest.js --after-run=<file> --run-id=<id>
//
// which reads that file and nothing else of the static checks above, and
// fails when the file isn't that run's (another run id, an unfinished run,
// another tree); a scenario that ran changed while it ran or has changed
// since (its git blob is not the one that ran, so the results are stale); a
// declaration is malformed; a row marked done names a scenario that doesn't
// declare it, didn't run in this run, or didn't pass; or a lane app.js
// registers has no module in this build or no scenario of it that passed in
// this run. KNOWN_UNBUILT is the one stated exception, #760's instrument
// detail, and must leave once its files arrive.
//
//   node scripts/check_prototype_manifest.js

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { parseInventory } = require('./_inventory_parser.js');
const { discoverScenarios } = require('./_prototype_scenarios.js');

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

// The scenarios, discovered as run_prototype_scenarios.js discovers them (one
// module, so a file one of them counts as a scenario the other can't skip),
// and the rows each declares. The declaration is one header line, before the
// first line of code (a shebang, 'use strict', blank lines and comments come
// first).
const SCENARIOS_DIR = path.join(root, 'prototype', 'scenarios');
const scenarioFiles = () => discoverScenarios(root).scenarios;
const ROWS_LINE = /^\s*\/\/\s*rows\b/i;
const ROWS_DECL = /^\/\/ rows: (\d+(?:, \d+)*)$/;
function headerEnd(lines) {
  let comment = false;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim();
    if (comment) {
      comment = !l.includes('*/');
    } else if (l.startsWith('/*')) {
      comment = !l.includes('*/');
    } else if (
      !(l === '' || l.startsWith('//') || l.startsWith('#!') || /^['"]use strict['"];?$/.test(l))
    ) {
      return i;
    }
  }
  return lines.length;
}
function declaredRows(rel, known) {
  const lines = fs.readFileSync(path.join(root, rel), 'utf8').split('\n');
  const end = headerEnd(lines);
  const at = lines.map((line, i) => ({ line, i })).filter(({ line }) => ROWS_LINE.test(line));
  const out = [];
  const bad = [];
  if (at.length > 1)
    bad.push(
      `${rel}: ${at.length} rows declarations (lines ${at.map(({ i }) => i + 1).join(', ')}); a scenario has one`
    );
  for (const { line, i } of at) {
    if (i >= end)
      bad.push(
        `${rel}:${i + 1}: the rows declaration is below the header; it goes before the first line of code`
      );
    const m = ROWS_DECL.exec(line.trimEnd());
    if (!m) {
      bad.push(
        `${rel}:${i + 1}: malformed rows declaration "${line.trim()}"; it reads "// rows: N, N"`
      );
      continue;
    }
    for (const n of m[1].split(', ').map(Number)) {
      if (out.includes(n)) bad.push(`${rel}: declares row ${n} twice`);
      else out.push(n);
      if (!known.has(n)) bad.push(`${rel}: declares row ${n}, but the manifest has no row ${n}`);
    }
  }
  return { rows: out, bad };
}
// Every scenario's declared rows; a malformed declaration is a problem.
function declarations() {
  const known = new Set(rows.map((r) => r.n));
  const declares = new Map();
  for (const rel of scenarioFiles()) {
    const d = declaredRows(rel, known);
    declares.set(rel, d.rows);
    expect(!d.bad.length, d.bad.join('; '));
  }
  return declares;
}

// The lanes prototype/app.js registers: each literal
// import('./features/<lane>/<file>.js') in its registry.
const REGISTERED = /import\('\.\/features\/([a-z0-9-]+)\/([^']+\.js)'\)/g;
function registeredLanes() {
  const app = fs.readFileSync(path.join(root, 'prototype', 'app.js'), 'utf8');
  return [...app.matchAll(REGISTERED)].map((m) => ({
    lane: m[1],
    module: `prototype/features/${m[1]}/${m[2]}`,
  }));
}
// Registered lanes whose module and scenario are not in this build. Each
// entry must leave once either arrives.
const KNOWN_UNBUILT = {
  'instrument-detail':
    '#760: registered on main; its detail.js and scenario arrive with a head that passes isolation rule 1',
};

const arg = (k) => {
  const a = process.argv.find((x) => x.startsWith(`--${k}=`));
  return a === undefined ? null : a.slice(k.length + 3);
};
const AFTER_RUN = arg('after-run');
if (AFTER_RUN !== null) process.exit(afterRun(AFTER_RUN, arg('run-id')));

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
const declared = declarations();
for (const r of rows) {
  expect(
    r.status === 'pending' || r.status === 'done',
    `row ${r.n} (${r.id}): status "${r.status}" is not pending or done`
  );
  if (r.status === 'done') {
    expect(
      declared.has(r.scenario),
      `row ${r.n} (${r.id}): done without naming a scenario under prototype/scenarios/<lane>/ (${r.scenario})`
    );
    expect(
      (declared.get(r.scenario) || []).includes(r.n),
      `row ${r.n} (${r.id}): done, but ${r.scenario} does not declare it ("// rows: ${r.n}" in its header)`
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

// ── --after-run ──────────────────────────────────────────────────────────
// The run's own results: what ran, at which bytes, and how it ended.
function afterRun(file, runId) {
  let results = null;
  try {
    results = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    expect(false, `${file} is not a results file the runner wrote (${e.message})`);
  }
  if (results) {
    expect(!!runId, 'no --run-id: name the run these results are from, as the runner does');
    expect(
      results.run_id === runId,
      `${file} is from another run (${results.run_id}), not run ${runId}`
    );
    expect(results.complete === true, `${file} is not a finished run`);
    expect(results.root === root, `${file} is a run of another tree (${results.root})`);
  }
  const ran = new Map(((results && results.scenarios) || []).map((s) => [s.path, s]));
  // What passed is what is here: the bytes that ran, unchanged since.
  for (const s of ran.values()) {
    expect(
      s.blob === s.blob_after,
      `${s.path} changed while it ran (blob ${s.blob}, then ${s.blob_after}), so the run proves neither`
    );
    const abs = path.join(root, s.path);
    const now = fs.existsSync(abs) ? blobOf(fs.readFileSync(abs)) : 'no file';
    expect(
      now === s.blob,
      `${s.path} has changed since it ran (blob ${s.blob} ran; ${now} is here)`
    );
  }
  const declares = declarations();
  // A done row: its scenario declares it, ran, and passed, in this run.
  const done = rows.filter((r) => r.status === 'done');
  for (const r of done) {
    const s = ran.get(r.scenario);
    expect(
      (declares.get(r.scenario) || []).includes(r.n),
      `row ${r.n} (${r.id}): done, but ${r.scenario} does not declare row ${r.n}`
    );
    expect(!!s, `row ${r.n} (${r.id}): done, but ${r.scenario} did not run in this run`);
    if (s)
      expect(
        s.status === 'pass',
        `row ${r.n} (${r.id}): done, but ${r.scenario} did not pass in this run (${s.status})`
      );
  }
  // A registered lane: its module is in this build, and a scenario of it
  // passed in this run.
  const lanes = registeredLanes();
  const passed = (lane) =>
    [...ran.values()].some(
      (s) => s.status === 'pass' && s.path.startsWith(`prototype/scenarios/${lane}/`)
    );
  for (const { lane, module } of lanes) {
    if (Object.hasOwn(KNOWN_UNBUILT, lane)) continue;
    expect(
      fs.existsSync(path.join(root, module)),
      `${lane} is registered in prototype/app.js, but its module ${module} is not in this build`
    );
    expect(
      passed(lane),
      `${lane} is registered in prototype/app.js, but no scenario of it passed in this run (prototype/scenarios/${lane}/)`
    );
  }
  for (const [lane, reason] of Object.entries(KNOWN_UNBUILT)) {
    const entry = lanes.find((l) => l.lane === lane);
    expect(
      !!entry,
      `KNOWN_UNBUILT names ${lane}, which prototype/app.js does not register; remove it`
    );
    const arrived =
      (entry && fs.existsSync(path.join(root, entry.module))) ||
      fs.existsSync(path.join(SCENARIOS_DIR, lane));
    expect(!arrived, `${lane} is in this build now; remove it from KNOWN_UNBUILT (${reason})`);
  }
  if (problems.length) {
    console.error(
      `check_prototype_manifest --after-run: FAIL — ${problems.length} of ${checks} checks`
    );
    for (const p of problems) console.error(`  ✗ ${p}`);
    return 1;
  }
  const unbuilt = Object.keys(KNOWN_UNBUILT);
  console.log(
    `check_prototype_manifest --after-run: ${checks}/${checks} checks pass — run ${runId}: ` +
      `${ran.size} scenario(s) ran; ${done.length} done row(s) proven by this run; ` +
      `${lanes.length - unbuilt.length} registered lane(s), each with a passing scenario; ` +
      `not in this build: ${unbuilt.map((l) => `${l} (${KNOWN_UNBUILT[l]})`).join(', ')}`
  );
  return 0;
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
