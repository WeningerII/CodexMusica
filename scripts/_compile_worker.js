#!/usr/bin/env node
// _compile_worker.js — worker-thread half of the static API build.
//
// Why this exists: profiling the 2,503-tradition build showed ~93% of its 30
// minutes inside the search/score engine (buildContext 24%, scoreVariant 18%,
// sumLookupWeight 11%, structuredClone 10%, lookupDescriptor 8%). File writing
// did not appear in the profile at all. The build is not I/O-bound — it is one
// `search(seed, {maxIters:100})` hill-climb per tradition, and those are fully
// independent of each other.
//
// So the work is split across worker threads. Each worker loads its own copy of
// the catalog and compiles a disjoint subset of traditions.
//
// DETERMINISM — the point the freshness gate cares about:
//   * Workers only ever READ the catalog. Nothing here mutates shared state.
//   * Traditions are assigned by index, so the partition is a pure function of
//     catalog order, not of scheduling.
//   * Results are returned tagged with their original index and reassembled in
//     catalog order by the parent, so output ordering never depends on which
//     worker finished first.
//   * compileTradition returns plain JSON data. Verified byte-identical through
//     both a JSON round-trip and structuredClone (the postMessage transport),
//     so crossing a thread boundary cannot alter a single byte of the artifact.
// If any of that were wrong, check_artifact_fresh would fail immediately — it
// byte-compares every one of the ~3,900 committed files against a fresh build.

const { parentPort, workerData } = require('worker_threads');

const C = require('./_loader.js');
const { search, seedFromTradition } = require('./search.js');
const { translate } = require('./translate.js');
const { traditionSource, RECIPE_CHAR_CEILING } = require('./_api_contract.js');

// Must stay identical to the parent's EMPTY_OPTS — a divergence here would
// silently compile different recipes in parallel mode than in serial mode.
const EMPTY_OPTS = {
  exclude: new Set(),
  add: new Set(),
  swap: {},
  stapleMode: 'full',
  arrangement: null,
};

function compileTradition(t) {
  const seed = seedFromTradition(t.id, [], EMPTY_OPTS);
  if (!seed) return null;
  const result = search(seed, { maxIters: 100 });
  const recipe = translate(result.config, { ceiling: RECIPE_CHAR_CEILING });
  return {
    id: t.id,
    name: t.name,
    family: t.family,
    lineage: t.lineage || null,
    recipe,
    recipe_chars: recipe.length,
    score: Number(result.score.toFixed(3)),
    config: result.config,
    source: traditionSource(t),
  };
}

const { indices } = workerData;
const out = [];
for (const i of indices) {
  const t = C.TRADITIONS[i];
  try {
    out.push({ i, rec: compileTradition(t) });
  } catch (e) {
    // Carry the failure back rather than killing the worker: the parent is
    // fail-closed and reports every broken record at once, which is far more
    // useful than dying on the first one.
    out.push({ i, rec: null, err: e.message });
  }
}
parentPort.postMessage(out);
