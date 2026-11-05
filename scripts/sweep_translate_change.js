#!/usr/bin/env node
'use strict';
// sweep_translate_change.js — every tradition's committed arrangement,
// translated by a base revision's translate.js and by the working tree's,
// with each changed recipe's gained and lost words. The receipt behind #725.
//
//   node scripts/sweep_translate_change.js BASE_REF [OUT.json]
//
// It checks first that the base reproduces every committed recipe, so a
// difference it reports is the change under review and nothing older.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const base = process.argv[2];
if (!base) {
  console.error('usage: node scripts/sweep_translate_change.js BASE_REF [OUT.json]');
  process.exit(2);
}
// The base translate.js beside the working tree's other modules, so it loads
// the same catalog and helpers the working tree does.
const tmp = path.join(root, 'scripts', `.translate_base_${process.pid}.js`);
fs.writeFileSync(
  tmp,
  execFileSync('git', ['show', `${base}:scripts/translate.js`], { cwd: root, encoding: 'utf8' })
);
let report;
try {
  const before = require(tmp).translate;
  const after = require('./translate.js').translate;
  const { RECIPE_CHAR_CEILING } = require('./_api_contract.js');
  // The changed stretches of a recipe, word by word (an LCS over words), so
  // a phrase that displaces another at the same slot shows as both sides.
  const diff = (a, b) => {
    const x = a.split(' ');
    const y = b.split(' ');
    const L = Array.from({ length: x.length + 1 }, () => new Array(y.length + 1).fill(0));
    for (let i = x.length - 1; i >= 0; i--)
      for (let j = y.length - 1; j >= 0; j--)
        L[i][j] = x[i] === y[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    const out = [];
    let i = 0;
    let j = 0;
    let lost = [];
    let gained = [];
    const flush = () => {
      if (lost.length || gained.length)
        out.push({ lost: lost.join(' '), gained: gained.join(' ') });
      lost = [];
      gained = [];
    };
    while (i < x.length || j < y.length) {
      if (i < x.length && j < y.length && x[i] === y[j]) {
        flush();
        i++;
        j++;
      } else if (j < y.length && (i === x.length || L[i][j + 1] >= L[i + 1][j]))
        gained.push(y[j++]);
      else lost.push(x[i++]);
    }
    flush();
    return out;
  };
  const dir = path.join(root, 'api', 'traditions');
  let traditions = 0;
  let reproduced = 0;
  const changed = [];
  for (const f of fs.readdirSync(dir).sort()) {
    if (f === 'index.json' || !f.endsWith('.json')) continue;
    const rec = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    if (rec.merged_from || !rec.config) continue;
    traditions++;
    const a = before(rec.config, { ceiling: RECIPE_CHAR_CEILING });
    const b = after(rec.config, { ceiling: RECIPE_CHAR_CEILING });
    if (a === rec.recipe || b === rec.recipe) reproduced++;
    if (a !== b) {
      changed.push({ id: rec.id, edits: diff(a, b) });
    }
  }
  report = { base, traditions, reproduced, changed: changed.length, recipes: changed };
} finally {
  fs.unlinkSync(tmp);
}
if (process.argv[3]) fs.writeFileSync(process.argv[3], JSON.stringify(report, null, 1) + os.EOL);
console.log(
  `${report.traditions} traditions; ${report.reproduced} committed recipes reproduced; ${report.changed} changed`
);
for (const c of report.recipes) {
  for (const e of c.edits) console.log(`  ${c.id}: "${e.lost}" -> "${e.gained}"`);
}
