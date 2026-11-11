// Bounded source-level control, not image qualification. Real codec code with
// identical modelled assets and injected source identities isolates its guard.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import vm from 'node:vm';

const [before, after] = process.argv.slice(2);
if (!before || !after) throw new Error('Supply baseline and candidate checkout roots');
async function codec(root, source) {
  const context = vm.createContext({ Buffer, process, TextDecoder });
  const module = new vm.SourceTextModule(fs.readFileSync(path.join(root, 'mcp/state_codec.js'), 'utf8'), { context });
  await module.link(async (name) => {
    let values;
    if (name === './build_identity.js') values = { runtimeSourceFingerprint: () => source };
    else if (name === './runtime_assets.js') {
      const assets = { ok: true, assets_sha256: 'a'.repeat(64), manifest_sha256: 'b'.repeat(64), python: 'fixed', nltk: 'fixed' };
      values = { runtimeAssets: () => assets };
    } else if (name === './job_store.js') {
      values = { loadChatSecret: () => { throw new Error('No secret access in this control'); } };
    } else values = await import(name.startsWith('node:') ? name : pathToFileURL(path.join(root, 'mcp', name)).href);
    return new vm.SyntheticModule(Object.keys(values), function () {
      for (const [key, value] of Object.entries(values)) this.setExport(key, value);
    }, { context });
  });
  await module.evaluate();
  return module.namespace;
}
async function fingerprint(root) {
  const code = await import(pathToFileURL(path.join(root, 'mcp/build_identity.js')).href);
  return code.runtimeSourceFingerprint(root);
}
const beforeSource = await fingerprint(before), afterSource = await fingerprint(after);
assert.notEqual(beforeSource, afterSource);
const a = await codec(before, beforeSource);
const matching = await codec(after, beforeSource);
const b = await codec(after, afterSource);
const state = { version: 1, input_draft: ['fixed fixture'], accepted_lines: ['same bytes'] };
const wire = a.encodeState(state);
assert.equal(JSON.stringify(a.decodeState(wire)), JSON.stringify(state));
assert.equal(JSON.stringify(matching.decodeState(wire)), JSON.stringify(state));
assert.throws(() => b.decodeState(wire), error => error.code === 'CONTINUATION_MIGRATION_REQUIRED');
console.log(JSON.stringify({ status: 'source-control-passed', before_source: beforeSource,
  after_source: afterSource, same_identity_decode: 'passed', differing_identity_decode: 'refused',
  scope: 'real codec; modelled equal assets; checkout source fingerprints, not image inventories',
  consequence: 'unchanged shared encoded fixtures cannot pass decodeState across distinct semantic identities' }, null, 2));
