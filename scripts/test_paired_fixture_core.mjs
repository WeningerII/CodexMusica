import assert from 'node:assert/strict';
import { gzipSync, gunzipSync } from 'node:zlib';
import { generate, encode, compareEncoded, validateCommon, sha } from './paired_fixture_core.mjs';

// Small synthetic schemas/codecs isolate causal fixture controls; not image proof.
const schema = { safeParse: x => ({ success: Array.isArray(x) && x.length > 0 && x.length <= 2 && x.every(s => typeof s === 'string' && s.length <= 10) }),
  parse(x) { assert(this.safeParse(x).success); } };
const deps = semantic => ({ count: 2, schema, worker: 1024, declaration: 256, decoded: 2048, wire: 4096,
  capacity(s) { const {connector_declarations, ...w} = s; assert(Buffer.byteLength(JSON.stringify(w)) <= 1024); },
  identity: () => semantic,
  encode(s) { const b = Buffer.from(JSON.stringify(s)); return JSON.stringify({ connector_contract:3,
    semantic_identity:semantic, codec:1, encoding:'gzip+base64', decoded_bytes:b.length,
    sha256:sha(b), payload:gzipSync(b).toString('base64') }); },
  decode(w) { const e = JSON.parse(w); assert.equal(e.semantic_identity, semantic); return JSON.parse(gunzipSync(Buffer.from(e.payload,'base64'))); } });
const a = deps('a'.repeat(64)), b = deps('b'.repeat(64));
const common = generate(a), before = encode(common, a), after = encode(common, b);
compareEncoded(before, after);
assert.equal(before.proof.common_sha256, after.proof.common_sha256);
assert.notEqual(before.prepared.records[0].state, after.prepared.records[0].state);
const clone = v => JSON.parse(JSON.stringify(v));
for (const mutate of [
  c => c.records.pop(),
  c => { c.records[1].run_id = c.records[0].run_id; },
  c => { c.records[0].draft[0] = 'short'; },
  c => { c.records[0].state.accepted_lines[0] = 'different'; },
  c => { c.records[0].decl.capacity_padding = ''; },
  c => { c.records[0].state.capacity_padding = ''; },
  c => { c.records[0].state.capacity_padding += 'x'.repeat(2048); },
  c => { c.bounds.maxLines++; },
  c => { c.records[0].state.connector_semantic_identity = 'x'; },
]) { const c = clone(common); mutate(c); assert.throws(() => validateCommon(c,a)); }
for (const mutate of [
  r => { r.prepared.records[0].state = before.prepared.records[0].state; },
  r => { const e=JSON.parse(r.prepared.records[0].state); e.payload+='A'; r.prepared.records[0].state=JSON.stringify(e); },
  r => { const e=JSON.parse(r.prepared.records[0].state); e.codec=2; r.prepared.records[0].state=JSON.stringify(e); },
  r => { r.prepared.records[0].updated_at++; },
  r => { r.proof.common_sha256='0'.repeat(64); },
]) { const r=clone(after); mutate(r); assert.throws(() => compareEncoded(before,r)); }
assert.throws(() => encode(common,{...a,decode:() => ({ changed:true })}));
console.log('paired fixture core: positive pair and 15 causal refusal controls passed');
