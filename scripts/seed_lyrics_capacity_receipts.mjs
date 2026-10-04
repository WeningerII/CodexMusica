#!/usr/bin/env node
// Seed real JobStore receipts for the retained-payload capacity workload.
// No provider or harness call occurs. The receiving server reads these through
// its ordinary startup and exact-replay routes; this is not a chat convergence test.
import fs from 'node:fs';
import crypto from 'node:crypto';
import { JobStore } from '../mcp/job_store.js';

const [directory, manifest] = process.argv.slice(2);
if (!directory || !manifest)
  throw new Error('Usage: seed_lyrics_capacity_receipts.mjs DIRECTORY MANIFEST');
const store = new JobStore(directory);
if (store.records.size) throw new Error('Capacity seed requires a fresh private store');
const payloadBytes = Math.floor(store.maxBytes / store.maxPayloadRecords) - 4096;
// A non-Latin-1 suffix exercises the two-byte V8 string representation that
// ordinary non-ASCII lyric receipts can require, rather than ASCII-only RSS.
const payload = 'x'.repeat(payloadBytes - 2) + '\u0100';
let last;
for (let i = 0; i < store.maxPayloadRecords; i++) {
  const id = crypto.randomBytes(32).toString('hex');
  const intent = { request_id: id, message: `capacity receipt ${i}`, capacity_padding: payload };
  store.begin(id, intent, { capacity_fixture: true });
  const body = { capacity_receipt: i, text: payload };
  store.complete(id, 200, body);
  last = {
    id,
    intent,
    response_sha256: crypto.createHash('sha256').update(JSON.stringify(body)).digest('hex'),
  };
}
const live = [...store.records.values()].filter((record) => record.state !== 'retired');
// A store holds one whole record allowance (`maxRecordBytes`) free for the
// next admission, so what it can retain while still admitting work is
// `maxBytes - maxRecordBytes`. ~~95% of `maxBytes`~~ until 2026-10-04, when
// MAX_RECORD_BYTES rose from 8 to 18 MiB (mcp/job_store.js) and this fill
// reached 93.6% of the whole ceiling: all a store that admits work can hold.
const reachable = store.maxBytes - store.maxRecordBytes;
if (store.bytes < 0.95 * reachable)
  throw new Error(
    'Retained workload did not reach 95% of the byte ceiling a store can hold while admitting work'
  );
fs.writeFileSync(
  manifest,
  JSON.stringify({
    version: 1,
    ...last,
    bytes: store.bytes,
    max_bytes: store.maxBytes,
    max_record_bytes: store.maxRecordBytes,
    records: store.records.size,
    payload_records: live.length,
    max_records: store.maxRecords,
    max_payload_records: store.maxPayloadRecords,
    payload_wire_bytes: Buffer.byteLength(JSON.stringify({ text: payload })),
    request_wire_bytes: Buffer.byteLength(JSON.stringify(last.intent)),
    scope:
      'Retained payload bytes near their ceiling; metadata record-count ceiling is reported separately, not claimed as tested.',
  }) + '\n',
  { mode: 0o600 }
);
