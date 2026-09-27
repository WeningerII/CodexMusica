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
// Tags alone let a doc claim more than its gate checks while every set stays
// equal. A row that lists `doc_terms` also binds wording: each term must appear
// in the registry claim and in the doc paragraph its marker closes.
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

// The claim a marker stands for is the paragraph (or list item) it closes:
// from the nearest blank line or list bullet before the marker up to it.
function paragraphBefore(text, index) {
  const start = Math.max(
    text.lastIndexOf('\n\n', index),
    text.lastIndexOf('\n- ', index),
    text.lastIndexOf('\n* ', index)
  );
  return text.slice(start < 0 ? 0 : start, index);
}
// Wording is compared without case, code ticks or line wrapping.
const plain = (text) => text.toLowerCase().replaceAll('`', '').replace(/\s+/g, ' ');

// ── collect DOC markers: id -> [files], and id@file -> the paragraph it closes ──
const docMarkers = new Map();
const docParagraphs = new Map();
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
    docParagraphs.set(`${id}@${rel}`, paragraphBefore(text, m.index));
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
    for (const id of m[1]
      .split(/[ ,]+/)
      .map((s) => s.trim())
      .filter(Boolean)) {
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
  if (!inDocs.length)
    problems.push(
      `promise "${r.id}" has NO doc marker (add <!-- @promise: ${r.id} --> to ${r.doc})`
    );
  else if (!inDocs.includes(r.doc))
    problems.push(`promise "${r.id}" marker is in ${inDocs.join(',')} but registry says ${r.doc}`);

  // The words, not only the tags: each bound term appears in the registry claim
  // (which the gate is written against) and in the doc paragraph readers see.
  if (r.doc_terms !== undefined) {
    const paragraph = docParagraphs.get(`${r.id}@${r.doc}`);
    if (!Array.isArray(r.doc_terms) || !r.doc_terms.length)
      problems.push(`promise "${r.id}" has an empty or malformed doc_terms list`);
    for (const term of r.doc_terms || []) {
      if (!plain(r.claim).includes(plain(term)))
        problems.push(`promise "${r.id}" binds the term "${term}", which its registry claim lacks`);
      if (paragraph !== undefined && !plain(paragraph).includes(plain(term)))
        problems.push(
          `promise "${r.id}": ${r.doc} no longer says "${term}" in the paragraph its marker closes`
        );
    }
  }

  const inGates = gateCovers.get(r.id) || [];
  if (!inGates.length)
    problems.push(`promise "${r.id}" has NO gate (add // @covers: ${r.id} to ${r.gate})`);
  else if (!inGates.includes(r.gate))
    problems.push(
      `promise "${r.id}" is covered by ${inGates.join(',')} but registry says ${r.gate}`
    );
}
// DOC -> REG (no documented promise without a registry row).
for (const id of docMarkers.keys())
  if (!regIds.has(id))
    problems.push(
      `doc marker @promise:${id} (${docMarkers.get(id).join(',')}) has no row in _promises.js`
    );
// GATE -> REG (no gate verifying an unregistered promise).
for (const id of gateCovers.keys())
  if (!regIds.has(id))
    problems.push(
      `gate @covers:${id} (${gateCovers.get(id).join(',')}) has no row in _promises.js`
    );

// ── report ──
console.log(`=== Promise->gate coverage (bijection across docs / registry / gates) ===`);
if (VERBOSE && problems.length === 0) {
  for (const r of REGISTRY) console.log(`  ✓ ${r.id.padEnd(24)} ${r.doc} <-> ${r.gate}`);
}
if (problems.length === 0) {
  console.log(
    `PASS — all ${REGISTRY.length} promises are documented AND gated; 0 orphans on any side; ` +
      `${REGISTRY.filter((r) => r.doc_terms).length} bind their wording to the doc.`
  );
  process.exit(0);
}
console.error(`FAIL — ${problems.length} coverage gap(s):`);
for (const p of problems) console.error(`  ✗ ${p}`);
console.error(
  `\nEvery promise needs all three: a registry row, a <!-- @promise: id --> doc marker, and a // @covers: id gate tag.` +
    `\nA row with doc_terms also needs each term in its claim and in the doc paragraph its marker closes.`
);
process.exit(1);
