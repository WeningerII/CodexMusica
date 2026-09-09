#!/usr/bin/env node
// build_atlas_tree.js — derive the atlas's taxonomy sidecars from the catalog.
//
// WHY THIS EXISTS
// data/tree-nodes.json and data/tree-map.json were hand-derived from
// references/04_tree.js + references/06_extras.js when the atlas was designed,
// and committed as static snapshots. They had already rotted by the time they
// landed: tree-map.json was missing 74 traditions, so the atlas painted 74 pins
// grey and captioned them "Awaiting tree placement" when the catalog had in
// fact placed every one of them. A hand-derived file with no generator behind it
// is a fact that stops being true silently — this script is the generator, and
// its --check mode is the gate that makes the drift loud.
//
// WHAT IT WRITES
//   data/tree-nodes.json  { nodeId: { n: <display name>, p: <parent id|null> } }
//   data/tree-map.json    { traditionId: <dotted TREE_NODES id> }
//
// Both are emitted MINIFIED, in the catalog's own authored order. That order is
// deliberate: it keeps a diff to the lines the catalog actually changed when
// traditions are added. These two are machine-read by src/atlas.js and never
// reviewed by eye — unlike data/geo.json, which is written one entry per line
// precisely because a human does read it.
//
// WHAT IT DELIBERATELY DOES NOT DO
// It does not decide placements. extras.parent in references/06_extras.js is the
// single source of truth for where a tradition sits, and re-parenting is an
// editorial change to the catalog with real cost — the branch name is compiled
// into the recipe string ("art Music, east Asian branch"), so moving a tradition
// rewrites its recipe and every artifact derived from it. This script only
// mirrors what the catalog already says.
//
// Reads:  references/04_tree.js, references/06_extras.js (via scripts/_loader.js),
//         api/traditions/index.json
// Writes: data/tree-nodes.json, data/tree-map.json
//
// Usage:
//   node scripts/build_atlas_tree.js            # regenerate
//   node scripts/build_atlas_tree.js --check    # fail if either file is stale
//   node scripts/build_atlas_tree.js --stats    # regenerate and report the shape

'use strict';

const fs = require('fs');
const path = require('path');
const C = require('./_loader.js');

const ROOT = path.join(__dirname, '..');
const INDEX_FILE = path.join(ROOT, 'api', 'traditions', 'index.json');
const NODES_OUT = path.join(ROOT, 'data', 'tree-nodes.json');
const MAP_OUT = path.join(ROOT, 'data', 'tree-map.json');

function build() {
  const nodes = {};
  for (const n of C.TREE_NODES) {
    nodes[n.id] = { n: n.name, p: n.parent === undefined ? null : n.parent };
  }

  const map = {};
  const unplaced = [];
  for (const id of Object.keys(C.TRADITION_EXTRAS)) {
    const parent = C.TRADITION_EXTRAS[id].parent;
    if (!parent) {
      unplaced.push(id);
      continue;
    }
    map[id] = parent;
  }

  return { nodes, map, unplaced };
}

// Every referenced id must resolve, and every node must climb to a root. A
// dangling parent would render as an uncoloured pin with a truncated branch
// line rather than as an error, which is exactly the failure mode this whole
// file is a response to.
function validate(nodes, map, unplaced, index) {
  const errs = [];

  for (const id of Object.keys(nodes)) {
    const p = nodes[id].p;
    if (p !== null && !nodes[p]) errs.push(['NODE_PARENT_MISSING', id, String(p)]);
    if (!nodes[id].n) errs.push(['NODE_NAME_EMPTY', id]);
  }

  // No cycles, and every node reaches a root within the tree's declared depth.
  for (const id of Object.keys(nodes)) {
    let cur = id;
    let hops = 0;
    while (cur !== null && nodes[cur] && hops <= Object.keys(nodes).length) {
      cur = nodes[cur].p;
      hops++;
    }
    if (cur !== null) errs.push(['NODE_UNROOTED', id]);
  }

  const known = new Set(index.items.map((t) => t.id));
  for (const id of Object.keys(map)) {
    if (!nodes[map[id]]) errs.push(['PARENT_NOT_A_NODE', id, map[id]]);
    if (!known.has(id)) errs.push(['ORPHAN_TRADITION', id]);
  }
  for (const t of index.items) {
    if (!map[t.id] && unplaced.indexOf(t.id) < 0) errs.push(['TRADITION_UNCOVERED', t.id]);
  }

  return errs;
}

// Minified, source order, one trailing newline.
function render(obj) {
  return JSON.stringify(obj) + '\n';
}

function main() {
  const check = process.argv.includes('--check');
  const wantStats = process.argv.includes('--stats');

  const index = JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'));
  const { nodes, map, unplaced } = build();

  const errs = validate(nodes, map, unplaced, index);
  if (errs.length) {
    console.error('build_atlas_tree: FAIL — ' + errs.length + ' taxonomy error(s)');
    errs.slice(0, 25).forEach((e) => console.error('  ' + e.join(' ')));
    process.exit(1);
  }

  const nodesBody = render(nodes);
  const mapBody = render(map);

  if (check) {
    const stale = [];
    const cmp = (file, body, label) => {
      const current = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
      if (current !== body) stale.push(label);
    };
    cmp(NODES_OUT, nodesBody, 'data/tree-nodes.json');
    cmp(MAP_OUT, mapBody, 'data/tree-map.json');
    if (stale.length) {
      console.error('build_atlas_tree: FAIL — stale: ' + stale.join(', '));
      console.error('  run: node scripts/build_atlas_tree.js');
      process.exit(1);
    }
    console.log(
      'build_atlas_tree: OK — ' +
        Object.keys(nodes).length +
        ' nodes, ' +
        Object.keys(map).length +
        ' placed traditions, ' +
        unplaced.length +
        ' unplaced'
    );
    return;
  }

  fs.writeFileSync(NODES_OUT, nodesBody);
  fs.writeFileSync(MAP_OUT, mapBody);

  const roots = Object.keys(nodes).filter((id) => nodes[id].p === null);
  console.log(
    'build_atlas_tree: wrote data/tree-nodes.json (' +
      Object.keys(nodes).length +
      ' nodes, ' +
      roots.length +
      ' roots) and data/tree-map.json (' +
      Object.keys(map).length +
      ' of ' +
      index.items.length +
      ' traditions placed, ' +
      unplaced.length +
      ' unplaced)'
  );
  if (wantStats) {
    const perRoot = {};
    for (const id of Object.keys(map)) {
      const r = map[id].split('.')[0];
      perRoot[r] = (perRoot[r] || 0) + 1;
    }
    Object.keys(perRoot)
      .sort((a, b) => perRoot[b] - perRoot[a])
      .forEach((r) => console.log('  ' + (nodes[r] ? nodes[r].n : r).padEnd(42) + perRoot[r]));
    if (unplaced.length) console.log('  unplaced: ' + unplaced.join(', '));
  }
}

main();
