#!/usr/bin/env node
// Load the actual singleton RunStore before starting the actual HTTP server.
// These are synthetic retained cache records, not completed writing sessions.
// No test-only production switch, provider call or Python invocation is used.
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { queuePressure } from './lyrics_capacity_queue.mjs';
import { RUNS, LYRIC_TOOL_SCHEMAS, lyricCapacity } from '../mcp/lyric_tools.js';
import {
  WORKER_STATE_BYTES,
  CONNECTOR_DECLARATION_BYTES,
  STATE_DECODED_BYTES,
  encodeState,
  decodeState,
  assertContinuationCapacity,
} from '../mcp/state_codec.js';
import { STATE_WIRE_BYTES } from '../mcp/payload_limits.js';

const [evidencePath, preparedPath, mode] = process.argv.slice(2);
if (!evidencePath || !preparedPath || (mode && mode !== '--prepare'))
  throw new Error('Usage: lyrics_capacity_server.mjs EVIDENCE_PATH PREPARED_PATH [--prepare]');
if (RUNS.size()) throw new Error('Capacity server requires its own empty RunStore');
const bytes = (value) => Buffer.byteLength(JSON.stringify(value));
const noise = (length) =>
  crypto
    .randomBytes(Math.ceil(length * 0.75))
    .toString('base64')
    .slice(0, length);
function maximum(accepts) {
  let lo = 1,
    hi = 2;
  if (!accepts(lo)) throw new Error('Missing finite positive draft schema bound');
  while (accepts(hi)) {
    lo = hi;
    hi *= 2;
    if (hi > 65536) throw new Error('Capacity fixture cannot derive a finite schema bound');
  }
  while (lo + 1 < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (accepts(mid)) lo = mid;
    else hi = mid;
  }
  return lo;
}
const draftSchema = LYRIC_TOOL_SCHEMAS.lyric_revise.draft;
const maxLines = maximum((n) => draftSchema.safeParse(Array(n).fill('x')).success);
const maxChars = maximum((n) => draftSchema.safeParse(['x'.repeat(n)]).success);
let workerMin = Infinity,
  workerMax = 0,
  declarationMin = Infinity;
if (mode === '--prepare') {
  for (let index = 0; index < RUNS.cap; index++) {
    // Distinct non-Latin-1 strings prevent the load from being a shared ASCII
    // backing string. The schema payload envelope is conservative: it is not
    // an assertion that the writer supports the full inspection line domain.
    const draft = Array.from({ length: maxLines }, () => noise(maxChars - 1) + '\u0100');
    const replay = Array.from({ length: maxLines }, () => noise(maxChars - 1) + '\u0100');
    draftSchema.parse(draft);
    draftSchema.parse(replay);
    const decl = { writer: 'interview', title: `capacity cache ${index}`, capacity_padding: '' };
    decl.capacity_padding = noise(CONNECTOR_DECLARATION_BYTES - bytes(decl) - 1);
    declarationMin = Math.min(declarationMin, bytes(decl));
    function journal(lines) {
      const worker = {
        version: 1,
        input_draft: replay,
        accepted_lines: lines,
        answered: { propose: [], propose_group: [] },
        pending: null,
        capacity_padding: '',
      };
      const room = WORKER_STATE_BYTES - bytes(worker) - 1;
      if (room < 0) throw new Error('Schema draft no longer fits the retained worker fixture');
      worker.capacity_padding = noise(room);
      workerMin = Math.min(workerMin, bytes(worker));
      workerMax = Math.max(workerMax, bytes(worker));
      const state = { ...worker, connector_declarations: decl };
      assertContinuationCapacity(state);
      const wire = encodeState(state);
      if (bytes(wire) > STATE_WIRE_BYTES || bytes(state) > STATE_DECODED_BYTES)
        throw new Error('Synthetic retained journal exceeded actual codec limits');
      if (decodeState(wire).capacity_padding !== worker.capacity_padding)
        throw new Error('Retained codec roundtrip changed the synthetic journal');
      return wire;
    }
    // The journal-capacity branch can retain both representations. Keeping two
    // distinct maximum worker payloads is a conservative load for that branch.
    RUNS.put(`capacity:${index}`, {
      status: 'journal_capacity',
      draft,
      replay_draft: replay,
      state: journal(draft),
      checkpoint: journal(replay),
      decl,
      capacity_fixture: true,
    });
  }

  // Random/gzip fixture generation is bounded preparation, not production
  // startup. The actual server only loads these prepared bytes into RUNS.
  fs.writeFileSync(
    preparedPath,
    JSON.stringify({
      version: 1,
      maxLines,
      maxChars,
      workerMin,
      workerMax,
      declarationMin,
      records: [...RUNS.map.values()],
    }),
    { mode: 0o600 }
  );
  process.exit(0);
}
let preparedBytes = fs.readFileSync(preparedPath);
const preparedSha256 = crypto.createHash('sha256').update(preparedBytes).digest('hex');
const prepared = JSON.parse(preparedBytes);
preparedBytes = null;
if (
  prepared.version !== 1 ||
  prepared.maxLines !== maxLines ||
  prepared.maxChars !== maxChars ||
  prepared.records.length !== RUNS.cap
)
  throw new Error('Prepared RunStore load has drifted');
workerMin = Infinity;
workerMax = 0;
declarationMin = Infinity;
for (const row of prepared.records) {
  draftSchema.parse(row.draft);
  draftSchema.parse(row.replay_draft);
  declarationMin = Math.min(declarationMin, bytes(row.decl));
  for (const wire of [row.state, row.checkpoint]) {
    const state = decodeState(wire);
    assertContinuationCapacity(state);
    const worker = { ...state };
    delete worker.connector_declarations;
    delete worker.connector_semantic_identity;
    workerMin = Math.min(workerMin, bytes(worker));
    workerMax = Math.max(workerMax, bytes(worker));
  }
  RUNS.put(row.key, row);
}
// The records are held only by the actual singleton after loading. Discard
// the preparer's parsed container and raw bytes before the heavy workload.
prepared.records = null;

let probes = 0;
function snapshot() {
  const records = [...RUNS.map.values()];
  if (records.length !== RUNS.cap) throw new Error('Retained RunStore load changed');
  // Refresh through the existing put API so a long matrix cannot quietly
  // lose the fixture at the six-hour cache TTL. No extra payload is retained.
  for (const record of records) RUNS.put(record.key, record);
  const record = {
    version: 1,
    pid: process.pid,
    probes: ++probes,
    sampled_at: Date.now(),
    records: RUNS.size(),
    prepared_sha256: preparedSha256,
    max_records: RUNS.cap,
    max_lines_per_draft: maxLines,
    max_chars_per_line: maxChars,
    worker_bytes_min: workerMin,
    worker_bytes_max: workerMax,
    worker_max_bytes: WORKER_STATE_BYTES,
    declaration_bytes_min: declarationMin,
    declaration_max_bytes: CONNECTOR_DECLARATION_BYTES,
    // Count the already encoded strings without serializing tens of MiB of
    // journals again on every observation. This avoids an observer-only heap.
    state_wire_bytes: records.reduce((sum, row) => sum + Buffer.byteLength(row.state), 0),
    checkpoint_wire_bytes: records.reduce((sum, row) => sum + Buffer.byteLength(row.checkpoint), 0),
    draft_bytes: records.reduce((sum, row) => sum + bytes(row.draft) + bytes(row.replay_draft), 0),
    declaration_bytes: records.reduce((sum, row) => sum + bytes(row.decl), 0),
    all_codec_roundtrips_verified: true,
    queue: {
      ...lyricCapacity(),
      exercised: false,
      scope:
        'Idle bridge snapshot; separate queue-pressure evidence proves measured admission/retention/overflow/cancellation. No queued execution throughput claim.',
    },
    scope:
      'Actual singleton RunStore at its record cap, two distinct codec payloads per record near worker decoded capacity, schema-bounded draft/replay arrays and declarations. Synthetic cache stress; no writer success, replay or full inspection-domain production claim.',
  };
  fs.writeFileSync(evidencePath + '.tmp', JSON.stringify(record) + '\n', { mode: 0o600 });
  fs.renameSync(evidencePath + '.tmp', evidencePath);
}
snapshot();
setInterval(snapshot, 5000);
// The measurement parent requests pressure through a private artifact beside
// its evidence; no production route, configuration switch or limit is added.
const pressureRequest = path.join(path.dirname(evidencePath), 'queue-request.json');
const pressureEvidence = path.join(path.dirname(evidencePath), 'queue-pressure.json');
const pressureRows = [],
  pressureLast = new Map();
let pressureBusy = false;
setInterval(async () => {
  if (pressureBusy || !fs.existsSync(pressureRequest)) return;
  const request = JSON.parse(fs.readFileSync(pressureRequest, 'utf8'));
  if (request.active !== true) return;
  if (typeof request.id !== 'string' || !Number.isSafeInteger(request.instrument_pid))
    throw new Error('Invalid private queue-pressure request');
  const last = pressureLast.get(request.id);
  if (last != null && Date.now() - last < 20000) return;
  pressureBusy = true;
  try {
    for (const phase of last == null ? ['count', 'bytes', 'full'] : ['full']) {
      pressureRows.push(
        await queuePressure(phase, { requestId: request.id, instrumentPid: request.instrument_pid })
      );
    }
    pressureLast.set(request.id, Date.now());
    fs.writeFileSync(
      pressureEvidence + '.tmp',
      JSON.stringify({ version: 1, server_pid: process.pid, rows: pressureRows }) + '\n',
      { mode: 0o600 }
    );
    fs.renameSync(pressureEvidence + '.tmp', pressureEvidence);
  } finally {
    pressureBusy = false;
  }
}, 250);
await import('../mcp/server_http.js');
