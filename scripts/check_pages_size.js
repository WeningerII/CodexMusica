#!/usr/bin/env node
// check_pages_size.js — the served tree stays inside GitHub Pages' limits.
//
// codexmusica.com is GitHub Pages serving main verbatim (.nojekyll), so every
// tracked file is published. Pages refuses a site over 1 GB and git refuses a
// file of 100 MB or more. The native Library tab adds static reading data under
// library/data/, so this gate holds headroom below both limits:
//   - the tracked tree totals at most 950 MB;
//   - no tracked file is 100 MB or larger.
//
// It measures the working tree's tracked files (git ls-files), which is what a
// push of this commit publishes.
//
// Usage: node scripts/check_pages_size.js [--json]
// Exit 0 within both limits; 1 otherwise.

'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const TREE_MAX = 950 * 1024 * 1024;
const FILE_MAX = 100 * 1024 * 1024;

const files = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, maxBuffer: 256 * 1024 * 1024 })
  .toString('utf8')
  .split('\0')
  .filter(Boolean);

let total = 0;
const oversized = [];
const largest = [];
for (const rel of files) {
  let size;
  try {
    size = fs.lstatSync(path.join(ROOT, rel)).size;
  } catch {
    continue; // deleted in the working tree; not part of what this commit publishes
  }
  total += size;
  if (size >= FILE_MAX) oversized.push({ rel, size });
  largest.push({ rel, size });
}
largest.sort((a, b) => b.size - a.size);

const mb = (n) => (n / 1048576).toFixed(1);
const report = {
  files: files.length,
  total_bytes: total,
  tree_max_bytes: TREE_MAX,
  file_max_bytes: FILE_MAX,
  oversized,
  largest: largest.slice(0, 5),
};
if (process.argv.includes('--json')) console.log(JSON.stringify(report, null, 2));
console.log('=== Served tree size (GitHub Pages) ===');
console.log(`  ${files.length} tracked files, ${mb(total)} MB of ${mb(TREE_MAX)} MB allowed`);
for (const f of report.largest) console.log(`  largest: ${mb(f.size)} MB  ${f.rel}`);
let failed = false;
if (total > TREE_MAX) {
  failed = true;
  console.log(`  ✗ the tree is ${mb(total)} MB, over the ${mb(TREE_MAX)} MB ceiling`);
}
for (const f of oversized) {
  failed = true;
  console.log(`  ✗ ${f.rel} is ${mb(f.size)} MB; git refuses files of 100 MB or more`);
}
console.log(failed ? 'FAIL' : 'PASS — inside both limits.');
process.exit(failed ? 1 : 0);
