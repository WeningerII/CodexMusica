'use strict';
// _promises.js — the registry of machine-verifiable promises this project makes
// to agents, each bound to the gate that proves it.
//
// check_promises.js enforces a BIJECTION across three sets:
//   • doc markers   — `<!-- @promise: <id> -->` next to the claim in a doc
//   • this registry — the {id, doc, gate, claim} rows below
//   • gate covers   — `// @covers: <id>` in the gate script that verifies it
// All three must be equal: a documented promise with no gate fails CI, and a
// gate covering an unregistered/undocumented promise fails CI. No orphans.
//
// To add a promise: add a row here, drop the `@promise` marker in its doc, and
// add (or extend) the `@covers` tag in its gate. All three or it won't pass.

module.exports = [
  { id: 'recipe-char-ceiling',      doc: 'AGENTS.md', gate: 'check_api.js',            claim: 'every recipe string is <= 1000 chars' },
  { id: 'all-traditions-one-fetch', doc: 'AGENTS.md', gate: 'check_api.js',            claim: 'the whole catalog is fetchable in bulk without per-id requests (today: api/all.json)' },
  { id: 'every-id-resolves',        doc: 'AGENTS.md', gate: 'check_api.js',            claim: 'every config id resolves against the catalog' },
  { id: 'catalog-counts',           doc: 'SKILL.md',  gate: 'check_docs.js',           claim: 'documented catalog counts match the live data' },
  { id: 'documented-commands-run',  doc: 'AGENTS.md', gate: 'check_doc_commands.js',   claim: 'every documented CLI command exits 0' },
  { id: 'documented-behaviors',     doc: 'SKILL.md',  gate: 'check_doc_behaviors.js',  claim: 'the cited "Verified" outputs still hold' },
  { id: 'browser-node-parity',      doc: 'SKILL.md',  gate: 'equivalence.js',          claim: 'browser and node agree on descriptors + preface picks' },
  { id: 'artifact-reproducible',    doc: 'README.md', gate: 'check_artifact_fresh.js', claim: 'published api/ + codex.html are a pure function of the source' },
  { id: 'gates-two-sided',          doc: 'README.md', gate: 'faults.js',               claim: 'every gate is proven to fail on a planted defect' },
  { id: 'lazy-shell-parity',        doc: 'README.md', gate: 'check_lazy_app.js',       claim: 'the shipped lazy shell behaves identically to the embedded build' },
];
