#!/usr/bin/env node
// check_promises.js — Goal 1: 100% promise->gate coverage.
//
// Enforces a bijection between the promises the docs make and the gates that
// verify them: nothing documented goes unverified, nothing verified goes
// undocumented. Three sets must be equal —
//   DOC   : `<!-- @promise: <id> -->` markers in the agent-facing docs
//   REG   : the rows in scripts/_promises.js
//   GATE  : `// @covers: <id>` tags in scripts/*.js
// Any id present in one set but missing from another is an orphan and fails CI.
//
// Usage: node scripts/check_promises.js [--verbose]   (exit 0 = bijection holds)

'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SCRIPTS = __dirname;
const VERBOSE = process.argv.includes('--verbose');
const REGISTRY = require('./_promises.js');

const DOCS = ['AGENTS.md', 'llms.txt', 'README.md', 'SKILL.md'];
// Allow `_` as well as `-` so a malformed/underscore orphan id is still caught,
// not silently skipped (registry ids are hyphenated, but the gate must flag ANY
// marker that has no registry row).
const PROMISE_RE = /@promise:\s*([a-z0-9_-]+)/gi;
const COVERS_RE = /@covers:\s*([a-z0-9 ,_-]+)/gi;

// ── collect DOC markers: id -> [files] ──
const docMarkers = new Map();
for (const rel of DOCS) {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) continue;
  const text = fs.readFileSync(p, 'utf8');
  let m;
  PROMISE_RE.lastIndex = 0;
  while ((m = PROMISE_RE.exec(text)) !== null) {
    const id = m[1];
    if (!docMarkers.has(id)) docMarkers.set(id, []);
    docMarkers.get(id).push(rel);
  }
}

// ── collect GATE covers: id -> [scriptFiles] ──
const gateCovers = new Map();
for (const f of fs.readdirSync(SCRIPTS)) {
  if (!f.endsWith('.js') || f === 'check_promises.js' || f === '_promises.js') continue;
  const text = fs.readFileSync(path.join(SCRIPTS, f), 'utf8');
  let m;
  COVERS_RE.lastIndex = 0;
  while ((m = COVERS_RE.exec(text)) !== null) {
    for (const id of m[1].split(/[ ,]+/).map((s) => s.trim()).filter(Boolean)) {
      if (!gateCovers.has(id)) gateCovers.set(id, []);
      gateCovers.get(id).push(f);
    }
  }
}

const regIds = new Set(REGISTRY.map((r) => r.id));
const problems = [];

// REG -> DOC + GATE (and that the doc marker is in the declared file, and the
// declared gate actually carries the @covers tag).
for (const r of REGISTRY) {
  const inDocs = docMarkers.get(r.id) || [];
  if (!inDocs.length) problems.push(`promise "${r.id}" has NO doc marker (add <!-- @promise: ${r.id} --> to ${r.doc})`);
  else if (!inDocs.includes(r.doc)) problems.push(`promise "${r.id}" marker is in ${inDocs.join(',')} but registry says ${r.doc}`);

  const inGates = gateCovers.get(r.id) || [];
  if (!inGates.length) problems.push(`promise "${r.id}" has NO gate (add // @covers: ${r.id} to ${r.gate})`);
  else if (!inGates.includes(r.gate)) problems.push(`promise "${r.id}" is covered by ${inGates.join(',')} but registry says ${r.gate}`);
}
// DOC -> REG (no documented promise without a registry row).
for (const id of docMarkers.keys()) if (!regIds.has(id)) problems.push(`doc marker @promise:${id} (${docMarkers.get(id).join(',')}) has no row in _promises.js`);
// GATE -> REG (no gate verifying an unregistered promise).
for (const id of gateCovers.keys()) if (!regIds.has(id)) problems.push(`gate @covers:${id} (${gateCovers.get(id).join(',')}) has no row in _promises.js`);

// ── report ──
console.log(`=== Promise->gate coverage (bijection across docs / registry / gates) ===`);
if (VERBOSE && problems.length === 0) {
  for (const r of REGISTRY) console.log(`  ✓ ${r.id.padEnd(24)} ${r.doc} <-> ${r.gate}`);
}
if (problems.length === 0) {
  console.log(`PASS — all ${REGISTRY.length} promises are documented AND gated; 0 orphans on any side.`);
  process.exit(0);
}
console.error(`FAIL — ${problems.length} coverage gap(s):`);
for (const p of problems) console.error(`  ✗ ${p}`);
console.error(`\nEvery promise needs all three: a registry row, a <!-- @promise: id --> doc marker, and a // @covers: id gate tag.`);
process.exit(1);
