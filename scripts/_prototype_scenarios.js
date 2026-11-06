'use strict';
// _prototype_scenarios.js — which files under prototype/scenarios/ are lane
// scenarios. run_prototype_scenarios.js runs them and
// check_prototype_manifest.js reads their rows declarations; both discover
// them here, so the two can't disagree about what a scenario is.
//
// Discovery walks every file under prototype/scenarios/, at any depth,
// dotfiles included. A scenario is prototype/scenarios/<lane>/<name>.cjs or
// .mjs, where the lane folder is lower-case letters, digits and hyphens and
// the name doesn't start with a dot. Every other file is a stray, which the
// runner fails by name, since nothing would run it. A name starting with a
// dot is a stray, not a file to skip: skipping it was a way to drop a
// scenario from the run without a word (#810 review of 03d848acf).

const fs = require('fs');
const path = require('path');

const SCENARIO = /^[a-z0-9-]+\/[^./][^/]*\.(cjs|mjs)$/;

// Every file under dir, as /-separated paths relative to it.
function walk(dir, rel = '') {
  return fs.readdirSync(path.join(dir, rel), { withFileTypes: true }).flatMap((d) => {
    const r = rel ? `${rel}/${d.name}` : d.name;
    return d.isDirectory() ? walk(dir, r) : [r];
  });
}

// { scenarios, strays }: repo-relative, /-separated and sorted.
function discoverScenarios(root) {
  const dir = path.join(root, 'prototype', 'scenarios');
  const found = fs.existsSync(dir) ? walk(dir).sort() : [];
  const rel = (f) => `prototype/scenarios/${f}`;
  return {
    scenarios: found.filter((f) => SCENARIO.test(f)).map(rel),
    strays: found.filter((f) => !SCENARIO.test(f)).map(rel),
  };
}

module.exports = { discoverScenarios };
