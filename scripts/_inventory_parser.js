// scripts/_inventory_parser.js
// Parses tests/ui_capability_inventory.md into a structured entry list.
//
// Each entry is a fenced ```yaml ... ``` block in the doc. The parser is
// intentionally minimal — the inventory's YAML uses only flat `key: value`
// pairs, no nested structures, no anchors, no multi-line strings. Anything
// fancier than that and we'd reach for a real YAML library; for the current
// schema this is unnecessary.
//
// Returns: [{ name, kind, selector, surface, implementation, status,
//             precondition, notes? }, ...]

'use strict';

const fs = require('fs');
const path = require('path');

const REQUIRED = ['name', 'kind', 'selector', 'surface', 'implementation', 'status', 'precondition'];
const OPTIONAL = ['notes'];
const VALID_KINDS = ['data-action', 'widget', 'modal', 'keyboard-shortcut', 'drag-drop'];
const VALID_STATUSES = ['reachable', 'pending', 'retired'];

function parseEntry(blockText, _blockIndex) {
  const entry = {};
  const lines = blockText.split('\n');
  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '');
    if (!line || line.startsWith('#')) continue;  // skip blanks + YAML-style comments
    const colon = line.indexOf(':');
    if (colon < 0) continue;
    const key = line.slice(0, colon).trim();
    let value = line.slice(colon + 1).trim();
    // Strip surrounding single or double quotes (YAML quoted-scalar style).
    if ((value.startsWith("'") && value.endsWith("'")) ||
        (value.startsWith('"') && value.endsWith('"'))) {
      value = value.slice(1, -1);
    }
    entry[key] = value;
  }
  return entry;
}

function validateEntry(entry, blockIndex) {
  const errs = [];
  for (const field of REQUIRED) {
    if (!(field in entry) || !entry[field]) {
      errs.push(`block #${blockIndex} (${entry.name || '<unnamed>'}): missing required field "${field}"`);
    }
  }
  if (entry.kind && !VALID_KINDS.includes(entry.kind)) {
    errs.push(`block #${blockIndex} (${entry.name}): invalid kind "${entry.kind}" — expected one of ${VALID_KINDS.join(', ')}`);
  }
  if (entry.status && !VALID_STATUSES.includes(entry.status)) {
    errs.push(`block #${blockIndex} (${entry.name}): invalid status "${entry.status}" — expected one of ${VALID_STATUSES.join(', ')}`);
  }
  return errs;
}

function parseInventory(docPath) {
  const absPath = path.isAbsolute(docPath)
    ? docPath
    : path.join(__dirname, '..', docPath);
  const doc = fs.readFileSync(absPath, 'utf8');
  const blockRegex = /```yaml\n([\s\S]*?)```/g;
  const entries = [];
  const errors = [];
  let m;
  let idx = 0;
  while ((m = blockRegex.exec(doc)) !== null) {
    idx++;
    const entry = parseEntry(m[1], idx);
    const entryErrs = validateEntry(entry, idx);
    if (entryErrs.length) errors.push(...entryErrs);
    entries.push(entry);
  }

  // Uniqueness check on `name`
  const seen = new Set();
  for (const e of entries) {
    if (e.name && seen.has(e.name)) {
      errors.push(`duplicate entry name: "${e.name}"`);
    }
    if (e.name) seen.add(e.name);
  }

  return { entries, errors };
}

function summarize(entries) {
  const byStatus = { reachable: 0, pending: 0, retired: 0 };
  const byKind = {};
  for (const e of entries) {
    byStatus[e.status] = (byStatus[e.status] || 0) + 1;
    byKind[e.kind] = (byKind[e.kind] || 0) + 1;
  }
  return { total: entries.length, byStatus, byKind };
}

module.exports = { parseInventory, summarize, REQUIRED, OPTIONAL, VALID_KINDS, VALID_STATUSES };

// Self-test when invoked directly: `node scripts/_inventory_parser.js`
if (require.main === module) {
  const { entries, errors } = parseInventory('tests/ui_capability_inventory.md');
  const summary = summarize(entries);
  console.log(`Parsed ${entries.length} entries`);
  console.log(`  Reachable: ${summary.byStatus.reachable}`);
  console.log(`  Pending:   ${summary.byStatus.pending}`);
  console.log(`  Retired:   ${summary.byStatus.retired}`);
  console.log(`  By kind:   ${JSON.stringify(summary.byKind)}`);
  if (errors.length) {
    console.error(`\nErrors: ${errors.length}`);
    for (const e of errors) console.error('  ' + e);
    process.exit(1);
  } else {
    console.log('  All entries valid.');
  }
}
