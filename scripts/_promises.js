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
  {
    id: 'recipe-char-ceiling',
    doc: 'AGENTS.md',
    gate: 'check_api.js',
    claim: 'every recipe string is <= 1000 chars',
  },
  {
    id: 'all-traditions-one-fetch',
    doc: 'AGENTS.md',
    gate: 'check_api.js',
    claim: 'the whole catalog is fetchable in bulk without per-id requests (today: api/all.json)',
  },
  {
    id: 'every-id-resolves',
    doc: 'AGENTS.md',
    gate: 'check_api.js',
    claim: 'every config id resolves against the catalog',
  },
  {
    id: 'no-duplicate-entities',
    doc: 'SKILL.md',
    gate: 'check_duplicates.js',
    claim:
      'no two entities of one kind share a display label once case, accents and punctuation are stripped (unruled collisions fail the gate)',
  },
  {
    id: 'catalog-counts',
    doc: 'SKILL.md',
    gate: 'check_docs.js',
    claim: 'documented catalog counts match the live data',
  },
  {
    id: 'documented-commands-run',
    doc: 'AGENTS.md',
    gate: 'check_doc_commands.js',
    claim: 'every documented CLI command exits 0',
  },
  {
    id: 'documented-behaviors',
    doc: 'SKILL.md',
    gate: 'check_doc_behaviors.js',
    claim: 'the cited "Verified" outputs still hold',
  },
  {
    id: 'browser-node-parity',
    doc: 'SKILL.md',
    gate: 'equivalence.js',
    claim: 'browser and node agree on descriptors + preface picks',
  },
  {
    id: 'artifact-reproducible',
    doc: 'README.md',
    gate: 'check_artifact_fresh.js',
    claim: 'published api/, codex.html and the discovery files are a pure function of the source',
  },
  {
    id: 'gates-two-sided',
    doc: 'README.md',
    gate: 'faults.js',
    claim: 'every gate is proven to fail on a planted defect',
  },
  {
    id: 'lazy-shell-parity',
    doc: 'README.md',
    gate: 'check_lazy_app.js',
    claim: 'the shipped lazy shell behaves identically to the embedded build',
  },
  {
    id: 'chain-stage-validated',
    doc: 'AGENTS.md',
    gate: 'check_workspace_ops.js',
    claim:
      'a chain override is validated for SHAPE as well as id, so a multi-select stage can never be corrupted into characters',
  },
  {
    id: 'connector-tools-read-only',
    doc: 'AGENTS.md',
    gate: 'check_connector_contract.js',
    claim: 'every advertised MCP tool is read-only, idempotent and closed-world',
  },
  {
    id: 'connector-schema-subset',
    doc: 'AGENTS.md',
    gate: 'check_connector_contract.js',
    claim:
      'published tool schemas carry no structural keyword a restricted client cannot represent, beyond an enumerated exemption list',
  },
  {
    id: 'connector-edit-visible',
    doc: 'AGENTS.md',
    gate: 'check_connector_contract.js',
    claim: 'every edit a recipe call applies is visible in the response that reports it',
  },
  {
    id: 'connector-gemini-legal',
    doc: 'AGENTS.md',
    gate: 'check_connector_contract.js',
    claim:
      'the function declarations derived from the live tool list are accepted by a restricted function-calling client (no keyword it rejects, and no workspace parameter)',
  },
  {
    id: 'chain-id-stage-known',
    doc: 'AGENTS.md',
    gate: 'check_connector_contract.js',
    claim:
      'a chain id is usable without guessing: search returns the stage that accepts it, and a real id offered to the wrong stage is refused with the stage that would take it',
  },
  {
    id: 'connector-edit-parity',
    doc: 'AGENTS.md',
    gate: 'check_edit_parity.js',
    claim:
      'a part edit reshapes the card identically in the connector and the app — the same inverse cascade, pinning the edited part',
  },
  {
    id: 'connector-render-parity',
    doc: 'AGENTS.md',
    gate: 'check_app_parity.js',
    claim: 'every format render_recipe offers returns exactly what the app shows',
  },
  {
    id: 'name-isolation',
    doc: 'AGENTS.md',
    gate: 'check_name_isolation.js',
    claim:
      "a tradition's compiled configuration never depends on what any OTHER tradition is called",
  },
  {
    id: 'mobile-layout-usable',
    doc: 'README.md',
    gate: 'check_mobile_layout.js',
    claim: 'the shipped page fits the device width on a phone, with every header control tappable',
  },
];
