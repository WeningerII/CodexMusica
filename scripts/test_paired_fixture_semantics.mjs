// Bounded source-level control, not image qualification. Real codec code with
// identical modelled assets and injected source identities isolates its guard.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import vm from 'node:vm';
import { generate, encode, compareEncoded } from './paired_fixture_core.mjs';

const [before, after] = process.argv.slice(2);
if (!before || !after) throw new Error('Supply baseline and candidate checkout roots');
async function codec(root, source) {
  const context = vm.createContext({ Buffer, process, TextDecoder });
  const module = new vm.SourceTextModule(
    fs.readFileSync(path.join(root, 'mcp/state_codec.js'), 'utf8'),
    { context }
  );
  await module.link(async (name) => {
    let values;
    if (name === './build_identity.js') values = { runtimeSourceFingerprint: () => source };
    else if (name === './runtime_assets.js') {
      const assets = {
        ok: true,
        assets_sha256: 'a'.repeat(64),
        manifest_sha256: 'b'.repeat(64),
        python: 'fixed',
        nltk: 'fixed',
      };
      values = { runtimeAssets: () => assets };
    } else if (name === './job_store.js') {
      values = {
        loadChatSecret: () => {
          throw new Error('No secret access in this control');
        },
      };
    } else
      values = await import(
        name.startsWith('node:') ? name : pathToFileURL(path.join(root, 'mcp', name)).href
      );
    return new vm.SyntheticModule(
      Object.keys(values),
      function () {
        for (const [key, value] of Object.entries(values)) this.setExport(key, value);
      },
      { context }
    );
  });
  await module.evaluate();
  return module.namespace;
}
async function fingerprint(root) {
  const code = await import(pathToFileURL(path.join(root, 'mcp/build_identity.js')).href);
  return code.runtimeSourceFingerprint(root);
}
const beforeSource = await fingerprint(before),
  afterSource = await fingerprint(after);
assert.notEqual(beforeSource, afterSource);
const a = await codec(before, beforeSource);
const matching = await codec(after, beforeSource);
const b = await codec(after, afterSource);
const state = { version: 1, input_draft: ['fixed fixture'], accepted_lines: ['same bytes'] };
const wire = a.encodeState(state);
assert.equal(JSON.stringify(a.decodeState(wire)), JSON.stringify(state));
assert.equal(JSON.stringify(matching.decodeState(wire)), JSON.stringify(state));
assert.throws(
  () => b.decodeState(wire),
  (error) => error.code === 'CONTINUATION_MIGRATION_REQUIRED'
);
// Exercise the revised preparation core against both real codec implementations.
// Count/schema are small synthetic controls; actual image/schema checks stay open.
const schema = {
  safeParse: (v) => ({
    success:
      Array.isArray(v) &&
      v.length > 0 &&
      v.length <= 2 &&
      v.every((s) => typeof s === 'string' && s.length <= 10),
  }),
  parse(v) {
    assert(this.safeParse(v).success);
  },
};
const deps = (code) => ({
  count: 1,
  schema,
  worker: code.WORKER_STATE_BYTES,
  declaration: code.CONNECTOR_DECLARATION_BYTES,
  decoded: code.STATE_DECODED_BYTES,
  wire: (2 * 1024 + 256) * 1024,
  capacity: code.assertContinuationCapacity,
  encode: code.encodeState,
  decode: code.decodeState,
  identity: code.continuationSemanticIdentity,
});
const common = generate(deps(a));
const first = encode(common, deps(a)),
  second = encode(common, deps(b));
compareEncoded(first, second);
console.log(
  JSON.stringify(
    {
      status: 'source-control-passed',
      before_source: beforeSource,
      after_source: afterSource,
      same_identity_decode: 'passed',
      differing_identity_decode: 'refused',
      revised_genuine_encoders: 'decoded equality and envelope/length comparison passed',
      scope:
        'real codec; modelled equal assets; checkout source fingerprints, not image inventories',
      consequence:
        'unchanged shared encoded fixtures cannot pass decodeState across distinct semantic identities',
    },
    null,
    2
  )
);
