#!/usr/bin/env node
// _apply_trad_edits.js — surgical, id-scoped field edits to references/05_traditions.js.
//
// Each tradition is exactly one line beginning `  { id: '<id>',`. We edit only
// that line, replacing `<delim><field>: '<old>'` with the new value, where
// <delim> is `, ` or `{ ` (so top-level `tuning` never matches `string_tuning`,
// and a parts key never matches a top-level key). Every edit asserts the
// current value matches `from` and that the pattern occurs exactly once on the
// line — otherwise it refuses and reports, so an ambiguous edit can never
// silently corrupt a neighbouring field.
//
// Edits file format (JSON): { "<trad_id>": [ {field, from, to, parts?:true}, ... ], ... }
//   - field: top-level field name (e.g. "chain_archetype") OR, with parts:true,
//     a parts-map key (e.g. "voice_tradition").
//   - from: the exact current value (string). to: new value (string).
//
// USAGE
//   node scripts/_apply_trad_edits.js edits.json            # apply
//   node scripts/_apply_trad_edits.js edits.json --dry-run  # report only
'use strict';
const fs = require('fs');
const path = require('path');

const editsPath = process.argv[2];
const dryRun = process.argv.includes('--dry-run');
if (!editsPath) {
  console.error('usage: _apply_trad_edits.js edits.json [--dry-run]');
  process.exit(2);
}

const FILE = path.join(__dirname, '..', 'references', '05_traditions.js');
const edits = JSON.parse(fs.readFileSync(editsPath, 'utf8'));
const lines = fs.readFileSync(FILE, 'utf8').split('\n');

// index each tradition id → line number
const lineOf = {};
lines.forEach((ln, i) => {
  const m = ln.match(/^ {2}\{ id: '([a-z0-9_]+)',/);
  if (m) lineOf[m[1]] = i;
});

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
let applied = 0;
const report = [];
const errors = [];

for (const [tid, ops] of Object.entries(edits)) {
  const li = lineOf[tid];
  if (li === undefined) {
    errors.push(`NO_SUCH_TRADITION ${tid}`);
    continue;
  }
  let line = lines[li];
  for (const op of ops) {
    const { field, from, to } = op;
    if (from === to) {
      report.push(`${tid}.${field}: noop (from==to)`);
      continue;
    }
    // delim-anchored, value-asserted, must be unique
    const pat = new RegExp(`([,{] )${esc(field)}: '${esc(from)}'`, 'g');
    const matches = line.match(pat);
    if (!matches) {
      errors.push(`NO_MATCH ${tid}.${field}=='${from}' (current line has different value)`);
      continue;
    }
    if (matches.length > 1) {
      errors.push(`AMBIGUOUS ${tid}.${field} matched ${matches.length}×`);
      continue;
    }
    line = line.replace(pat, `$1${field}: '${to}'`);
    report.push(`${tid}.${field}: '${from}' -> '${to}'`);
    applied++;
  }
  lines[li] = line;
}

console.log(report.join('\n'));
if (errors.length) {
  console.error('\nERRORS:\n' + errors.join('\n'));
}
console.log(
  `\n${dryRun ? 'DRY-RUN ' : ''}${applied} edit(s) across ${Object.keys(edits).length} tradition(s); ${errors.length} error(s).`
);
if (errors.length && !dryRun) {
  console.error('Refusing to write due to errors. Fix the edits file.');
  process.exit(1);
}
if (!dryRun && applied) {
  fs.writeFileSync(FILE, lines.join('\n'));
  console.log('WROTE ' + FILE);
}
