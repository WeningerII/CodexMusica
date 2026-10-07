// The connector envelope versions interpretation; worker journal.version stays 1.
// Bound the decoded representation as well as its wire encoding. For this bound,
// even an incompressible gzip member + base64 envelope fits STATE_WIRE_BYTES.
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';
import { CONNECTOR_CONTRACT_VERSION } from './contract_version.js';
import { assertStateFits, HTTP_REQUEST_BYTES } from './payload_limits.js';
import { runtimeSourceFingerprint } from './build_identity.js';
import { runtimeAssets } from './runtime_assets.js';
import { loadChatSecret } from './job_store.js';

// RAISED 2026-10-04 with the harness's JOURNAL_BYTES (owner's ruling), from
// 512 * 1024 and 448 * 1024: the worker journal limit equals the harness's
// JOURNAL_BYTES and the decoded limit keeps its 64 KiB of room for the
// connector's declarations.
export const WORKER_STATE_BYTES = (1024 + 64) * 1024;
export const STATE_DECODED_BYTES = (1024 + 128) * 1024;
export const CONNECTOR_DECLARATION_BYTES = 32 * 1024;
export const STATE_CODEC_VERSION = 1;
export const RECOVERY_RESULT_BYTES = HTTP_REQUEST_BYTES - 1024;

export class StateCodecError extends Error {
  constructor(code, message) {
    super(`${code}: ${message}`);
    this.name = 'StateCodecError';
    this.code = code;
    this.isRefusal = true;
  }
}

const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const invalid = (message) => new StateCodecError('CONTINUATION_INVALID', message);
const object = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
let cachedSemanticIdentity;

export function continuationSemanticIdentity() {
  if (cachedSemanticIdentity) return cachedSemanticIdentity;
  const assets = runtimeAssets();
  // Image sources and dependencies are immutable for a running service.
  // The release label is deliberately absent: identical rebuilt bytes have
  // identical semantics, while source, scoring data or runtime changes do not.
  cachedSemanticIdentity = digest(
    JSON.stringify({
      source_sha256: runtimeSourceFingerprint(),
      assets_sha256: assets.assets_sha256,
      manifest_sha256: assets.manifest_sha256,
      python: assets.python,
      nltk: assets.nltk,
      node: process.version,
    })
  );
  return cachedSemanticIdentity;
}

export function assertContinuationSemantics(identity) {
  if (identity !== continuationSemanticIdentity())
    throw new StateCodecError(
      'CONTINUATION_MIGRATION_REQUIRED',
      'The scorer source, lexical data or runtime differs from this continuation. Keep the original state/checkpoint and accepted lyrics as recovery artifacts; automatic replay under changed semantics is refused. To extract the stored lyrics and journal without replay, call lyric_revise with recover_only:true and only that original state or checkpoint.'
    );
}

// State keys measured OUTSIDE the worker journal's capacity, exactly as the
// harness's JOURNAL_OUTSIDE_KEYS (lyric_harness.py): `dispositions` records
// batch answers the walk passed by without judging (LOOP_REDESIGN.md §2.2
// option B, §2.8 C), `cursor` is the saved position, and `stalls` is the
// connector's no-progress count (§2.8 E). Counting them here would refuse a continuation the harness
// admitted. The decoded-state bound in encodeState below still covers it.
export const WORKER_OUTSIDE_KEYS = Object.freeze([
  'dispositions',
  'cursor',
  'cursor_seal',
  'cursor_strip',
  'stalls',
]);

export function assertContinuationCapacity(state) {
  const { connector_declarations, ...worker } = state;
  delete worker.connector_semantic_identity;
  for (const k of WORKER_OUTSIDE_KEYS) delete worker[k];
  if (Buffer.byteLength(JSON.stringify(worker), 'utf8') > WORKER_STATE_BYTES)
    throw new StateCodecError(
      'CONTINUATION_CAPACITY',
      `Worker journal exceeds ${WORKER_STATE_BYTES} bytes. Keep the original continuation unchanged; recover accepted lyrics before starting an independent new run.`
    );
  if (
    connector_declarations != null &&
    Buffer.byteLength(JSON.stringify(connector_declarations), 'utf8') > CONNECTOR_DECLARATION_BYTES
  )
    throw new StateCodecError(
      'DECLARATION_CAPACITY',
      `Writer declarations exceed ${CONNECTOR_DECLARATION_BYTES} bytes; no writer was started.`
    );
}

export function encodeState(state) {
  if (!object(state)) throw invalid('The worker state must be an object.');
  if (state.connector_semantic_identity != null)
    assertContinuationSemantics(state.connector_semantic_identity);
  const bytes = Buffer.from(JSON.stringify(state), 'utf8');
  if (bytes.length > STATE_DECODED_BYTES)
    throw new StateCodecError(
      'CONTINUATION_CAPACITY',
      `The exact continuation is ${bytes.length} decoded bytes; the declared capacity is ${STATE_DECODED_BYTES}. No journal entry may be discarded to fit it.`
    );
  const wire = JSON.stringify({
    connector_contract: CONNECTOR_CONTRACT_VERSION,
    semantic_identity: continuationSemanticIdentity(),
    codec: STATE_CODEC_VERSION,
    encoding: 'gzip+base64',
    decoded_bytes: bytes.length,
    sha256: digest(bytes),
    payload: gzipSync(bytes, { level: 6 }).toString('base64'),
  });
  assertStateFits(wire, 'continuation');
  return wire;
}

function readWire(wire) {
  if (typeof wire !== 'string') throw invalid('Pass the returned continuation string verbatim.');
  assertStateFits(wire, 'continuation');
  let envelope;
  try {
    envelope = JSON.parse(wire);
  } catch {
    throw invalid('The envelope is not valid JSON.');
  }
  return envelope;
}

export function decodeState(wire) {
  const envelope = readWire(wire);
  if (!object(envelope) || envelope.connector_contract !== CONNECTOR_CONTRACT_VERSION)
    throw new StateCodecError(
      'CONTINUATION_MIGRATION_REQUIRED',
      `This continuation predates connector contract ${CONNECTOR_CONTRACT_VERSION} or belongs to another contract. Keep the original state/checkpoint unchanged as a recovery artifact. Call lyric_revise with recover_only:true and only that original state or checkpoint to extract its accepted lyrics and journal; automatic replay under changed planner or grading semantics is refused.`
    );
  if (envelope.codec !== STATE_CODEC_VERSION || envelope.encoding !== 'gzip+base64')
    throw invalid('Unknown continuation codec; keep the original recovery artifact.');
  assertContinuationSemantics(envelope.semantic_identity);
  const state = decodePayload(envelope);
  if (state.connector_semantic_identity != null)
    assertContinuationSemantics(state.connector_semantic_identity);
  return state;
}

function decodePayload(envelope) {
  if (
    !object(envelope) ||
    envelope.codec !== STATE_CODEC_VERSION ||
    envelope.encoding !== 'gzip+base64'
  )
    throw invalid('Unknown continuation codec; keep the original recovery artifact.');
  if (
    !Number.isSafeInteger(envelope.decoded_bytes) ||
    envelope.decoded_bytes < 2 ||
    envelope.decoded_bytes > STATE_DECODED_BYTES
  )
    throw invalid(`Decoded size must be between 2 and ${STATE_DECODED_BYTES} bytes.`);
  if (
    typeof envelope.sha256 !== 'string' ||
    !/^[a-f0-9]{64}$/.test(envelope.sha256) ||
    typeof envelope.payload !== 'string' ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(envelope.payload)
  )
    throw invalid('Malformed checksum or base64 payload.');
  let bytes;
  try {
    bytes = gunzipSync(Buffer.from(envelope.payload, 'base64'), {
      maxOutputLength: Math.min(envelope.decoded_bytes, STATE_DECODED_BYTES),
    });
  } catch {
    throw invalid('Compressed state is corrupt or exceeds its decoded bound.');
  }
  if (bytes.length !== envelope.decoded_bytes || digest(bytes) !== envelope.sha256)
    throw invalid('Decoded length or checksum differs; preserve the original recovery artifact.');
  let state;
  try {
    state = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    throw invalid('Decoded state is not valid UTF-8 JSON.');
  }
  if (!object(state)) throw invalid('Decoded worker state must be an object.');
  return state;
}

// Export stored work without executing or reinterpreting its old journal.
// This deliberately does not call encodeState or compute a current identity.
export function recoverState(wire, { part = 'all' } = {}) {
  if (!['all', 'journal'].includes(part)) throw invalid('Unknown recovery export part.');
  const envelope = readWire(wire);
  if (!object(envelope)) throw invalid('Recovery requires a stored JSON object.');
  const compressed = [
    'codec',
    'encoding',
    'payload',
    'decoded_bytes',
    'sha256',
    'connector_contract',
  ].some((key) => Object.hasOwn(envelope, key));
  let journal;
  if (compressed) {
    journal = decodePayload(envelope);
  } else {
    if (Buffer.byteLength(wire, 'utf8') > STATE_DECODED_BYTES)
      throw invalid(`Legacy recovery exceeds the ${STATE_DECODED_BYTES}-byte decoded bound.`);
    journal = envelope;
  }
  const draft = (field) =>
    Array.isArray(journal[field]) && journal[field].every((line) => typeof line === 'string')
      ? journal[field].slice()
      : null;
  const result = {
    status: 'recovered_artifact',
    recovery_part: part,
    source_format: compressed ? 'gzip+base64' : 'legacy-json',
    source_connector_contract:
      compressed && Number.isSafeInteger(envelope.connector_contract)
        ? envelope.connector_contract
        : null,
    source_semantic_identity:
      compressed &&
      typeof envelope.semantic_identity === 'string' &&
      /^[a-f0-9]{64}$/.test(envelope.semantic_identity)
        ? envelope.semantic_identity
        : null,
    checksum_verified: compressed,
    ...(part === 'all'
      ? { final_draft: draft('accepted_lines'), replay_draft: draft('input_draft') }
      : {}),
    journal,
    journal_included: true,
    original_wire_sha256: digest(wire),
    original_wire_bytes: Buffer.byteLength(wire, 'utf8'),
    certified: false,
    resumable: false,
    new_run_required: true,
    meaning:
      'Stored work exported without replay or grading. Drafts are copied verbatim; null means that draft was not stored and has not been inferred from answers. The journal and original wire retain their original identity. Start independent work from recovered lyrics; do not submit this recovery response as a continuation.',
  };
  // Count the actual MCP text wrapping, including its second JSON escaping.
  // The caller already has the original wire; repeating it here can quadruple
  // a legacy escaped journal and consume space needed for accepted work.
  const resultBytes = (value) =>
    Buffer.byteLength(
      JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(value) }] }),
      'utf8'
    );
  if (part === 'all' && resultBytes(result) > RECOVERY_RESULT_BYTES) {
    delete result.journal;
    result.journal_included = false;
    result.next_recovery_part = 'journal';
    result.meaning +=
      ' The full journal requires a separate bounded export: call recover_only:true, recovery_part:"journal" with the SAME original state/checkpoint. Its original_wire_sha256 must match this response.';
  }
  if (resultBytes(result) > RECOVERY_RESULT_BYTES)
    throw invalid(
      'Recovery export exceeds its serialized result bound; keep the original wire unchanged.'
    );
  return result;
}

// ---------------------------------------------------------------------------
// THE SEAL ON A SAVED POSITION (LOOP_REDESIGN.md §2.0.1 and §2.8 F; 2026-10-02)
// ---------------------------------------------------------------------------
// A run's state may carry `cursor`, the loop's saved position, so a
// continuation resumes instead of replaying every answer. Replay was the only
// authority over what was accepted; a cursor is trusted, so in a state a
// caller holds it must be unforgeable. Every interview state this connector
// returns is sealed with an HMAC over its WHOLE worker state except
// `pending.answer` (the one field a caller legitimately fills in), under a key
// derived from the server secret and used for nothing else. An incoming state
// whose seal does not verify keeps its journal and loses only its cursor: the
// run replays, slower and never wrong, and says why (`cursor_stripped`).

let cursorKeyCache;
function cursorKey() {
  if (cursorKeyCache !== undefined) return cursorKeyCache;
  try {
    cursorKeyCache = createHmac('sha256', loadChatSecret()).update('lyric-cursor-v1').digest();
  } catch {
    // A damaged key file disables sealing for this process; every state then
    // replays (`cursor_stripped: key_unavailable`). lyric_revise does not fail.
    cursorKeyCache = null;
  }
  return cursorKeyCache;
}

function canonical(v) {
  if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']';
  if (v && typeof v === 'object')
    return (
      '{' +
      Object.keys(v)
        .filter((k) => v[k] !== undefined)
        .sort()
        .map((k) => JSON.stringify(k) + ':' + canonical(v[k]))
        .join(',') +
      '}'
    );
  return JSON.stringify(v === undefined ? null : v);
}

function sealOf(state, key) {
  const c = { ...state };
  delete c.cursor_seal;
  delete c.cursor_strip;
  if (c.pending && typeof c.pending === 'object') c.pending = { ...c.pending, answer: null };
  return createHmac('sha256', key).update(canonical(c)).digest('hex');
}

/** Encode an INTERVIEW state for the wire, sealing its cursor. The one
 * function every interview mint calls (lyric_revise's branches, a session's
 * resume snapshot, the chat's checkpoint recovery). A cursor is never what
 * ends a run: a sealed state that would not fit is re-encoded without it. */
export function encodeInterviewWire(state) {
  const key = cursorKey();
  const s = { ...state };
  delete s.cursor_seal;
  delete s.cursor_strip;
  if (s.cursor != null && key) s.cursor_seal = sealOf(s, key);
  else delete s.cursor;
  try {
    return encodeState(s);
  } catch (error) {
    if (error.code !== 'CONTINUATION_CAPACITY' || s.cursor == null) throw error;
    const t = { ...s };
    delete t.cursor;
    delete t.cursor_seal;
    return encodeState(t);
  }
}

/** Check a decoded interview state's seal BEFORE any connector field is
 * removed. Mutates it: the seal is removed; an untrusted cursor is removed
 * and `cursor_strip` names why, for the harness to report. -> the reason, or
 * null when the cursor (if any) is trusted. */
export function verifyInterviewCursor(decoded) {
  const seal = decoded.cursor_seal;
  delete decoded.cursor_seal;
  delete decoded.cursor_strip;
  if (decoded.cursor == null) return null;
  const key = cursorKey();
  let reason = null;
  if (!key) reason = 'key_unavailable';
  else {
    const want = Buffer.from(sealOf(decoded, key), 'hex');
    const got =
      typeof seal === 'string' && /^[0-9a-f]{64}$/.test(seal) ? Buffer.from(seal, 'hex') : null;
    if (!got || !timingSafeEqual(want, got)) reason = 'seal';
  }
  if (reason) {
    delete decoded.cursor;
    decoded.cursor_strip = reason;
  }
  return reason;
}
