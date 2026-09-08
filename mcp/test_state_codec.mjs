import assert from 'node:assert/strict';
import { randomBytes, createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import {
  encodeState,
  decodeState,
  recoverState,
  STATE_DECODED_BYTES,
  WORKER_STATE_BYTES,
  CONNECTOR_DECLARATION_BYTES,
  RECOVERY_RESULT_BYTES,
  assertContinuationCapacity,
} from './state_codec.js';
import { continuationSemanticIdentity } from './state_codec.js';
import { jsonBytes, STATE_WIRE_BYTES } from './payload_limits.js';
import { CONNECTOR_CONTRACT_VERSION } from './contract_version.js';

const checkpoint = {
  version: 1,
  input_draft: ['I hold your hand', '我爱你'],
  accepted_lines: ['I hold your hand', 'I love you'],
  proposals: [{ kind: 'propose', question_sha256: 'a'.repeat(64), answer: 'I love you' }],
  answered: { propose: [{ line: 2, text: 'I love you' }], propose_group: [] },
  connector_declarations: { seed: 3, wants: ['lines<=24'] },
};
const wire = encodeState(checkpoint);
assert.deepEqual(decodeState(wire), checkpoint);
const oldWire = JSON.stringify({
  ...JSON.parse(wire),
  connector_contract: 1,
  semantic_identity: '0'.repeat(64),
});
const recovered = recoverState(oldWire);
assert.deepEqual(recovered.journal, checkpoint);
assert.deepEqual(recovered.final_draft, checkpoint.accepted_lines);
assert.deepEqual(recovered.replay_draft, checkpoint.input_draft);
assert.equal(recovered.original_wire_sha256, createHash('sha256').update(oldWire).digest('hex'));
assert.equal(recovered.certified, false);
assert.equal(recovered.resumable, false);
assert.equal(recovered.new_run_required, true);
assert.equal(recovered.checksum_verified, true);
assert.equal(recovered.source_semantic_identity, '0'.repeat(64));
assert.throws(() => decodeState(oldWire), {
  code: 'CONTINUATION_MIGRATION_REQUIRED',
});
const oldJournal = { ...checkpoint, connector_semantic_identity: '0'.repeat(64) };
const oldBytes = Buffer.from(JSON.stringify(oldJournal));
const oldBodyWire = JSON.stringify({
  ...JSON.parse(oldWire),
  decoded_bytes: oldBytes.length,
  sha256: createHash('sha256').update(oldBytes).digest('hex'),
  payload: gzipSync(oldBytes).toString('base64'),
});
assert.deepEqual(recoverState(oldBodyWire).journal, oldJournal);
assert.throws(() => encodeState(recoverState(oldBodyWire).journal), {
  code: 'CONTINUATION_MIGRATION_REQUIRED',
});
const legacyRecovery = recoverState(JSON.stringify(checkpoint));
assert.deepEqual(legacyRecovery.journal, checkpoint);
assert.equal(legacyRecovery.checksum_verified, false);
assert.equal(
  recoverState('{}').final_draft,
  null,
  'missing accepted work is not invented as an empty draft'
);
assert.throws(() => recoverState(JSON.stringify({ data: 'x'.repeat(STATE_DECODED_BYTES) })), {
  code: 'CONTINUATION_INVALID',
});
assert.throws(
  () => encodeState({ ...checkpoint, connector_semantic_identity: '0'.repeat(64) }),
  { code: 'CONTINUATION_MIGRATION_REQUIRED' },
  'old authenticated progress cannot be restamped as current'
);
assert.equal(JSON.parse(wire).connector_contract, CONNECTOR_CONTRACT_VERSION);
assert.equal(JSON.parse(wire).semantic_identity, continuationSemanticIdentity());
assert.equal(decodeState(wire).version, 1, 'worker journal version is separate');
assert.ok(jsonBytes(wire) <= STATE_WIRE_BYTES);
// Worst legal decoded size with high-entropy material and Unicode; all entries
// survive. This exercises incompressible-like content, not a repeating fixture.
const content = randomBytes(STATE_DECODED_BYTES).toString('base64');
const large = { answered: content.slice(0, STATE_DECODED_BYTES - 50), last: '💞我' };
while (Buffer.byteLength(JSON.stringify(large)) < STATE_DECODED_BYTES) large.answered += 'x';
assert.equal(Buffer.byteLength(JSON.stringify(large)), STATE_DECODED_BYTES);
const largeWire = encodeState(large);
assert.ok(jsonBytes(largeWire) <= STATE_WIRE_BYTES);
assert.deepEqual(decodeState(largeWire), large);
assert.deepEqual(recoverState(largeWire).journal, large);
// A decoded journal at the exact bound, with the most expensive JSON
// escaping and almost all bytes in duplicated draft fields. The exact MCP
// result (not merely the inner object) must fit, including the fallback.
const escaped = { version: 1, input_draft: [''], accepted_lines: [''], padding: '' };
const overhead = Buffer.byteLength(JSON.stringify(escaped));
const copies = Math.floor((STATE_DECODED_BYTES - overhead) / 4);
escaped.input_draft[0] = '\\'.repeat(copies);
escaped.accepted_lines[0] = '"'.repeat(copies);
escaped.padding = 'x'.repeat(STATE_DECODED_BYTES - Buffer.byteLength(JSON.stringify(escaped)));
assert.equal(Buffer.byteLength(JSON.stringify(escaped)), STATE_DECODED_BYTES);
const mcpBytes = (value) =>
  Buffer.byteLength(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(value) }] }));
for (const boundedWire of [JSON.stringify(escaped), encodeState(escaped)]) {
  const firstPart = recoverState(boundedWire);
  assert.equal(
    firstPart.journal_included,
    false,
    'the pathological escaped draft exercises the separate-journal path'
  );
  assert.ok(mcpBytes(firstPart) <= RECOVERY_RESULT_BYTES);
  assert.deepEqual(firstPart.final_draft, escaped.accepted_lines);
  assert.deepEqual(firstPart.replay_draft, escaped.input_draft);
  const journalPart = firstPart.journal_included
    ? firstPart
    : recoverState(boundedWire, { part: firstPart.next_recovery_part });
  assert.ok(mcpBytes(journalPart) <= RECOVERY_RESULT_BYTES);
  assert.deepEqual(journalPart.journal, escaped);
  assert.equal(journalPart.original_wire_sha256, firstPart.original_wire_sha256);
  assert.equal(journalPart.resumable, false);
  console.log(
    `recovery boundary: ${firstPart.source_format} drafts=${mcpBytes(firstPart)} journal=${mcpBytes(journalPart)} bytes; exact artifacts preserved`
  );
}
large.answered += 'x';
assert.throws(() => encodeState(large), { code: 'CONTINUATION_CAPACITY' });
for (const value of [JSON.stringify(checkpoint), '{}', JSON.stringify({ connector_contract: 1 })])
  assert.throws(() => decodeState(value), { code: 'CONTINUATION_MIGRATION_REQUIRED' });
for (const identity of [undefined, '0'.repeat(64)]) {
  const old = { ...JSON.parse(wire), semantic_identity: identity };
  assert.throws(() => decodeState(JSON.stringify(old)), {
    code: 'CONTINUATION_MIGRATION_REQUIRED',
  });
}
for (const mutate of [
  (e) => {
    e.sha256 = 'f'.repeat(64);
  },
  (e) => {
    e.payload = '!bad';
  },
  (e) => {
    e.payload = Buffer.from('not gzip').toString('base64');
  },
  (e) => {
    e.decoded_bytes -= 1;
  },
  (e) => {
    e.decoded_bytes = STATE_DECODED_BYTES + 1;
  },
  (e) => {
    e.codec = 99;
  },
]) {
  const envelope = JSON.parse(wire);
  mutate(envelope);
  assert.throws(() => decodeState(JSON.stringify(envelope)), { code: 'CONTINUATION_INVALID' });
  assert.throws(() => recoverState(JSON.stringify(envelope)), { code: 'CONTINUATION_INVALID' });
}
// A small compressed bomb lies about its length. gunzip must refuse while
// enforcing maxOutputLength, before it can materialize the claimed journal.
const bomb = Buffer.from('x'.repeat(STATE_DECODED_BYTES * 16));
const malicious = {
  ...JSON.parse(wire),
  decoded_bytes: STATE_DECODED_BYTES,
  payload: gzipSync(bomb).toString('base64'),
  sha256: createHash('sha256').update(bomb).digest('hex'),
};
assert.throws(() => decodeState(JSON.stringify(malicious)), { code: 'CONTINUATION_INVALID' });
assert.throws(() => recoverState(JSON.stringify(malicious)), { code: 'CONTINUATION_INVALID' });
assert.throws(() => decodeState('x'.repeat(STATE_WIRE_BYTES + 1)));
assertContinuationCapacity(checkpoint);
const boundaryWorker = {
  data: 'x'.repeat(WORKER_STATE_BYTES - 11),
  connector_declarations: { data: 'x'.repeat(CONNECTOR_DECLARATION_BYTES - 11) },
  connector_semantic_identity: continuationSemanticIdentity(),
};
assertContinuationCapacity(boundaryWorker);
assert.deepEqual(
  decodeState(encodeState(boundaryWorker)),
  boundaryWorker,
  'separately reserved connector metadata does not consume the worker journal budget'
);
assert.throws(() => assertContinuationCapacity({ answered: 'x'.repeat(WORKER_STATE_BYTES) }), {
  code: 'CONTINUATION_CAPACITY',
});
assert.throws(
  () =>
    assertContinuationCapacity({
      connector_declarations: { blueprint: 'x'.repeat(CONNECTOR_DECLARATION_BYTES) },
    }),
  { code: 'DECLARATION_CAPACITY' }
);
console.log(
  'state codec: lossless journal, UTF-8 wire bound, migration and bounded decompression passed'
);
