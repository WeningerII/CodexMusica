// The discovery_v1 fixtures, recomputed from mcp/DISCOVERY_V1.md (#656).
//
// The fixtures under mcp/fixtures/discovery_v1/ are the one wire interface
// both sides of persisted discovery implement against: the store and scheduler
// (Node) and the worker (analysis.py). This file is a reference reading of the
// contract, independent of either implementation. It:
//   - rebuilds every segment from the seals and recomputes every digest and
//     address in the good fixtures with the contract's canonical form and
//     ordered-digest rule;
//   - evaluates every rule independently on each bad fixture and asserts that
//     exactly the rule it is named for fails, with the refusal the contract
//     names for that rule;
//   - models the store's incremental walk over its verified heads and its full
//     read from the heads (§5.1), a byte mismatch at a full read
//     (segment_corrupt), a thrown save, the release and the saves after it
//     (U1, U2), the cause check at the reply boundary (C1), and a release
//     under a live lease, and recomputes the MEMBERSHIP_ENTRIES and
//     MEMBERSHIP_BYTES derivations from the contract's own figures and the
//     worker's byte cap with its per-log causes (§6.11);
//   - builds the largest cursor §3.1's inputs allow, and the largest
//     cursor.discovery and whole cursor (§3), checks those inputs against the
//     registry and the source; walks every refusal construction in the
//     adapter's call closure and every place it names a refusal, builds the
//     largest independently and per schema, and shows the dispatch never
//     builds it (§3.2); holds the release-size property over every
//     combination of logs (§7.4), and checks that every RESOURCE_LIMIT raise
//     the reader reaches names a cause (§8);
//   - checks Python's canonical_json (lyric-harness/library/contracts.py) and
//     json.dumps against Node's bytes, so "identical for this subset" is run,
//     not asserted;
//   - holds the contract's constants, logs, causes and cross-reference rows to
//     what this file checks, so the document and the fixtures cannot drift.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import vm from 'node:vm';
import {
  cursorCase as buildCursorCase,
  largestCursor,
  padTo,
} from './fixtures/discovery_v1/builders.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const DIR = path.join(HERE, 'fixtures', 'discovery_v1');
const CONTRACT = fs.readFileSync(path.join(HERE, 'DISCOVERY_V1.md'), 'utf8');
const README = fs.readFileSync(path.join(DIR, 'README.md'), 'utf8');

// §3 of the contract. The document must state the same values (checked below).
const LIMITS = Object.freeze({
  ENTRY_BYTES: 4096,
  // F1's depth bound (BB8 6693502369, item 31): provisional until the #721
  // author declares the entry shapes (§2.1, §12 item 31).
  ENTRY_DEPTH: 8,
  SEGMENT_ENTRIES: 1024,
  SEGMENT_BYTES: 16384,
  FRAME_SEALS: 8,
  CHAIN_SEGMENTS: 2048,
  GROUP_KEYS: 32,
  GROUP_BYTES: 8192,
  WITNESS_FIELDS: 16,
  CONTINUATION_BYTES: 8192,
  CURSOR_BYTES: 131072,
  REFUSAL_BYTES: 543,
  MEMBERSHIP_ENTRIES: 65536,
  MEMBERSHIP_BYTES: 4194304,
});
// §8, C1: a bad cause or log is echoed in the reason, cut to this many bytes.
const ECHO_BYTES = 64;
// §3.1: the largest integer a cursor field holds, and so its widest.
const INTEGER = 2 ** 53 - 1;
const LOGS = ['seen', 'row_seen', 'variants', 'alt_cells', 'alt_seen'];
// §1, §3: the logs the worker loads on every lease, under one combined cap.
const MEMBERSHIP_LOGS = ['seen', 'variants', 'row_seen', 'alt_seen'];
const RESETTABLE = new Set(['row_seen']);
const SEGMENT_FIELDS = [
  'version',
  'kind',
  'job_id',
  'identity_hash',
  'epoch',
  'log',
  'previous_hash',
  'first',
  'count',
  'digest_before',
  'digest_after',
  'entries',
];
const CAUSES = [
  'segment_missing',
  'segment_corrupt',
  'chain_broken',
  'digest_mismatch',
  'cursor_disagrees',
  'inventory_mismatch',
  'retired_key_recurred',
];
// segment_corrupt is the store's alone (BB8 6681838131): a worker never names it.
const STORE_CAUSES = ['segment_corrupt'];
const WORKER_CAUSES = CAUSES.filter((c) => !STORE_CAUSES.includes(c));
// §8: the RESOURCE_LIMIT causes, one for every raise the reader reaches.
const RESOURCE_CAUSES = [
  'discovery_entry_bytes',
  'discovery_frame_seals',
  'discovery_chain_segments',
  ...MEMBERSHIP_LOGS.map((log) => `discovery_${log}`),
  'resident_capacity',
  'declared_coordinate_bits',
  'expansion_budget',
];
// §8's Log column: whether a reply's error_log is required, optional or absent
// for each cause (§2.7: a cause about one log names it).
const CAUSE_LOG = {
  segment_missing: 'required',
  segment_corrupt: 'required',
  chain_broken: 'required',
  digest_mismatch: 'required',
  cursor_disagrees: 'optional',
  inventory_mismatch: 'none',
  retired_key_recurred: 'none',
  discovery_entry_bytes: 'required',
  discovery_frame_seals: 'none',
  discovery_chain_segments: 'required',
  discovery_seen: 'none',
  discovery_variants: 'none',
  discovery_row_seen: 'none',
  discovery_alt_seen: 'none',
  resident_capacity: 'none',
  declared_coordinate_bits: 'none',
  expansion_budget: 'none',
};
// §8: every RESOURCE_LIMIT raise in the modules the reader reaches, by module
// and enclosing function, and the cause it names (null: not on the reader's path).
const RAISE_SITES = [
  ['library/analysis.py', '_resource_guard', 'resident_capacity'],
  ['quality/meter.py', 'exact_number', 'declared_coordinate_bits'],
  ['quality/meter.py', 'guard_expansion', 'expansion_budget'],
  ['lyric_harness.py', 'main', null],
];
// §2.8: cursor v2 keeps none of a method's terminal inputs (analysis.py:AnalysisSession._TERMINAL_INPUTS).
const TERMINAL_INPUTS = ['domain_true', 'domain_undecided', 'alt_cells'];
const DOMAIN = Object.freeze({
  log: (log) => `codexmusica.reader.discovery.v1\n${log}`,
  inventory: 'codexmusica.reader.inventory.v1\n',
  witness: (method) => `codexmusica.reader.witness.v1\n${method}`,
});
const WITNESS_FIELDS_V1 = ['method_id', 'id', 'verdict', 'a.token_ids', 'b.token_ids'];
// §8: the refusal each rule raises, on the side a fixture of that kind models.
const PROTOCOL = { code: 'READER_PROTOCOL', status: 400 };
const CORRUPT = { code: 'STORAGE_CORRUPT', status: 503 };
const unavailable = (cause) => ({ code: 'DISCOVERY_UNAVAILABLE', status: 409, cause });
const REFUSAL = {
  write: Object.fromEntries(
    ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7'].map((r) => [
      r,
      PROTOCOL,
    ])
  ),
  // The frame a worker must not emit: it refuses first, naming the log whose
  // append passes the cap (§3).
  limit: { W7: { code: 'RESOURCE_LIMIT' } },
  // A lease's walk (§5.1), under the lock and after reconciliation. It reads
  // only segments this process listed itself, so any mismatch is the store's
  // own defect: it releases nothing, and resume()'s full read decides.
  walk: { R2: CORRUPT, R5: CORRUPT, F3: CORRUPT, F6: CORRUPT },
  // A full read (reconciliation, resume()) from the record's heads. A byte
  // mismatch is corruption, never breakage (BB8 6681838131).
  full: {
    R2: unavailable('chain_broken'),
    F3: unavailable('chain_broken'),
    F6: unavailable('segment_corrupt'),
  },
  resume: {
    R1: unavailable('segment_missing'),
    R2: unavailable('chain_broken'),
    R3: unavailable('cursor_disagrees'),
    R4: unavailable('inventory_mismatch'),
    F3: unavailable('chain_broken'),
    F5: unavailable('digest_mismatch'),
    F6: { code: 'STORAGE_CORRUPT', status: 503 },
  },
  groups: { S1: unavailable('retired_key_recurred') },
  witness: { S2: { code: 'RESULT_EXPIRED', status: 410 } },
  // A cursor over CURSOR_BYTES (§3.1) or a refusal over REFUSAL_BYTES (§3.2):
  // the store refuses the frame; the worker never emits it.
  cursor: { W4: PROTOCOL },
  // An entry past ENTRY_DEPTH (BB8 6693502369, item 31): the store's F1 on a
  // submitted frame; the fixture also holds the worker's emit and the read-back.
  depth: { F1: PROTOCOL },
  // A failed worker reply whose cause or log is outside its set (§8, C1): the
  // job pauses with this code; there is no HTTP status.
  reply: { C1: { code: 'READER_PROTOCOL' } },
  // The reply boundary's fallback pause (§8; BB8 6700200435, condition 3):
  // a pause store.pause refuses ends in one READER_PROTOCOL pause.
  fallback: { C1: { code: 'READER_PROTOCOL' } },
  // A malformed record.discovery (§2.7, M1; BB8 6709891376, ruling 3):
  // reconciliation releases it with chain_broken and log null.
  malformed: { M1: unavailable('chain_broken') },
};
const HEX = /^[a-f0-9]{64}$/;
// A witness field is a dot path of lowercase names (§3), so its canonical form
// is its bytes and two quotes.
const DOT_PATH = /^[a-z0-9_]+(\.[a-z0-9_]+)*$/;

// ---------------------------------------------------------------- primitives
const sha = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const entryBytes = (entry) => Buffer.from(JSON.stringify(entry), 'utf8');
const size = (entry) => entryBytes(entry).length;
const d0 = (domain) => sha(Buffer.from(domain, 'utf8'));
const digestStep = (digest, entry) =>
  crypto
    .createHash('sha256')
    .update(Buffer.from(digest, 'hex'))
    .update(entryBytes(entry))
    .digest('hex');
const fold = (digest, entries) => entries.reduce(digestStep, digest);
const clone = (value) => JSON.parse(JSON.stringify(value));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
// The store's canonical() (reader_job_store.js:canonical): sorted keys, no whitespace.
function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
    .join(',')}}`;
}
const plainObject = (v) =>
  v !== null &&
  typeof v === 'object' &&
  !Array.isArray(v) &&
  Object.getPrototypeOf(v) === Object.prototype;
// F1: arrays, well-formed strings, booleans, null and safe integers, nested at
// most ENTRY_DEPTH arrays deep (a scalar is 0, [["a"]] is 2); nothing else.
function isEntry(v, depth = 0) {
  if (v === null || typeof v === 'boolean') return true;
  if (typeof v === 'string') return v.isWellFormed();
  if (typeof v === 'number') return Number.isSafeInteger(v);
  if (Array.isArray(v)) return depth < LIMITS.ENTRY_DEPTH && v.every((x) => isEntry(x, depth + 1));
  return false;
}
// §3's <what> for an entry past ENTRY_DEPTH (BB8 6693502369, item 31).
const DEPTH_WHAT = `a nesting depth past ENTRY_DEPTH (${LIMITS.ENTRY_DEPTH})`;
// §2.1: the count of nested arrays, so a scalar is 0 and [["a"]] is 2.
const entryDepth = (v) => (Array.isArray(v) ? 1 + Math.max(0, ...v.map(entryDepth)) : 0);
const isPair = (v) => Array.isArray(v) && v.length === 2 && v.every(Number.isSafeInteger);
// A group's line pair is two different lines: a key within one line never forms a group.
const isLinePair = (v) => isPair(v) && v[0] < v[1];
const cmpPair = (a, b) => a[0] - b[0] || a[1] - b[1];
// §2.7: a log's state; `bytes` is the sum of |canonical(e)| over its sealed
// entries (BB8 6693502369, item 30).
const emptyLog = (log) => ({
  head: null,
  segments: 0,
  count: 0,
  bytes: 0,
  digest: d0(DOMAIN.log(log)),
});
const sumBytes = (entries) => entries.reduce((n, e) => n + size(e), 0);
const segmentBytes = (segment) => Buffer.from(JSON.stringify(segment), 'utf8');
// F3 holds a stored segment's content too (§2.5; BB8, #721 item 2 (c)): bytes
// that passed F6 but do not parse, an entry failing F1 or F2, or an integer
// field that is not an integer. Each is F3 wherever the segment is read; the
// walk, the full read and the load map F3 by their own tables. The faults are
// the codec's tags (§2.11), listed in the order the scan meets them. The bytes
// are decoded as the store is required to decode them, with a fatal UTF-8
// decoder (§2.11); `{ fatal: false }` is the store's decode today, which reads
// invalid UTF-8 as U+FFFD (`JSON.parse` on the buffer, reader_job_store.js:_object).
function segmentContent(raw, { fatal = true } = {}) {
  let seg;
  try {
    seg = JSON.parse(new TextDecoder('utf-8', { fatal }).decode(Buffer.from(raw)));
  } catch {
    return { seg: null, faults: ['JSON'] };
  }
  if (!plainObject(seg)) return { seg: null, faults: ['JSON'] };
  const faults = [];
  for (const f of ['epoch', 'first', 'count'])
    if (!Number.isSafeInteger(seg[f]) || seg[f] < 0) faults.push('INTEGER_FIELD');
  for (const e of Array.isArray(seg.entries) ? seg.entries : []) {
    if (!isEntry(e)) faults.push('F1');
    else if (size(e) > LIMITS.ENTRY_BYTES) faults.push('F2');
  }
  return { seg, faults };
}

// §2.4: the greedy, content-only cut over entry byte lengths.
function cut(lengths) {
  const segments = [];
  let start = 0;
  for (;;) {
    let end = start;
    let bytes = 0;
    while (
      end < lengths.length &&
      end - start < LIMITS.SEGMENT_ENTRIES &&
      bytes + lengths[end] <= LIMITS.SEGMENT_BYTES
    )
      bytes += lengths[end++];
    const complete =
      end > start &&
      (end - start === LIMITS.SEGMENT_ENTRIES ||
        bytes === LIMITS.SEGMENT_BYTES ||
        end < lengths.length);
    if (!complete) break;
    segments.push([start, end]);
    start = end;
  }
  return { segments, tail: [start, lengths.length] };
}

// ---------------------------------------------------------------- fixtures
function load(rel) {
  return JSON.parse(fs.readFileSync(path.join(DIR, rel), 'utf8'));
}
function fixtureFiles() {
  const out = [];
  for (const side of ['good', 'bad'])
    for (const name of fs.readdirSync(path.join(DIR, side)).sort())
      if (name.endsWith('.json')) out.push(`${side}/${name}`);
  return out;
}
function readmeRows() {
  const rows = new Map();
  for (const line of README.split('\n')) {
    const m = /^\| `((?:good|bad)\/[a-z0-9_]+\.json)` \| ([^|]+) \| ([^|]+) \| ([^|]+) \|$/.exec(
      line
    );
    if (m)
      rows.set(m[1], {
        rules: m[2].trim().split(/\s+/),
        refusal: m[3].trim(),
        exercises: m[4].trim(),
      });
  }
  return rows;
}
// A worker's RESOURCE_LIMIT has no HTTP status: the job pauses (§8).
const refusalText = (r) => [r.code, r.status, r.cause].filter((x) => x != null).join(' ');

// ---------------------------------------------------------------- the cursor (§2.8)
// Shape and bound checks Node makes on cursor.discovery, witness and
// continuation; pushed as W4 (the agreement rule carries them).
// The keys §2.8 gives each object of cursor.discovery, exactly: anything else
// would leave cursor.discovery without a bound (§3).
const DISCOVERY_KEYS = {
  discovery: ['epoch', 'groups', 'inventory', 'logs', 'version'],
  log: ['sealed', 'sealed_digest', 'tail'],
  inventory: ['count', 'digest'],
  groups: ['current', 'through'],
  current: ['keys', 'lines'],
  // §2.8's witness, exactly (BB8 6715584092).
  witness: ['count', 'digest', 'epoch', 'fields', 'method_id', 'version'],
};
const keysAre = (v, which) => same(Object.keys(v).sort(), DISCOVERY_KEYS[which]);
// Every number in the cursor outside its entries (the tails and the group's
// keys, which F1 governs) and continuation (opaque) is a count, an index or an
// epoch: an integer from 0 to 2^53 - 1 (§2.8, W4).
function cursorNumbers(cursor) {
  const bad = [];
  const walk = (v, where) => {
    if (typeof v === 'number') {
      if (!Number.isSafeInteger(v) || v < 0) bad.push(where);
    } else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${where}[${i}]`));
    else if (plainObject(v)) for (const [k, x] of Object.entries(v)) walk(x, `${where}.${k}`);
  };
  for (const [k, v] of Object.entries(cursor)) {
    if (k === 'continuation') continue;
    if (k !== 'discovery' || !plainObject(v)) {
      walk(v, k);
      continue;
    }
    for (const [dk, dv] of Object.entries(v)) {
      if (dk === 'logs' && plainObject(dv))
        for (const [log, st] of Object.entries(dv))
          if (plainObject(st))
            for (const [sk, sv] of Object.entries(st))
              if (sk !== 'tail') walk(sv, `discovery.logs.${log}.${sk}`);
      if (dk === 'groups' && plainObject(dv)) {
        walk(dv.through, 'discovery.groups.through');
        if (plainObject(dv.current)) walk(dv.current.lines, 'discovery.groups.current.lines');
      }
      if (dk !== 'logs' && dk !== 'groups') walk(dv, `discovery.${dk}`);
    }
  }
  return bad;
}
function cursorShape(cursor, epoch, bad) {
  const cd = cursor.discovery;
  if (cursor.contract_version !== 2) bad('W4', 'cursor contract_version is 2');
  for (const where of cursorNumbers(cursor))
    bad('W4', `${where} is not an integer from 0 to 2^53 - 1`);
  if (!plainObject(cd) || cd.version !== 1 || !plainObject(cd.logs)) {
    bad('W4', 'cursor.discovery shape');
    return;
  }
  if (!keysAre(cd, 'discovery')) bad('W4', 'cursor.discovery holds exactly the keys of §2.8');
  for (const [log, st] of Object.entries(cd.logs)) {
    if (!LOGS.includes(log)) bad('W1', `unknown log ${log}`);
    if (plainObject(st) && !keysAre(st, 'log'))
      bad('W4', `cursor log ${log} holds exactly its keys`);
    if (
      !plainObject(st) ||
      !Number.isSafeInteger(st.sealed) ||
      st.sealed < 0 ||
      !HEX.test(st.sealed_digest || '') ||
      !Array.isArray(st.tail)
    )
      bad('W4', `cursor log ${log} shape`);
    else if (
      st.tail.length >= LIMITS.SEGMENT_ENTRIES ||
      sumBytes(st.tail.filter(isEntry)) >= LIMITS.SEGMENT_BYTES
    )
      bad('W4', `cursor tail of ${log} is not open`);
  }
  const g = cd.groups;
  if (!plainObject(g) || !keysAre(g, 'groups') || !(g.through === null || isLinePair(g.through)))
    bad('W4', 'groups shape');
  else if (g.current !== null) {
    if (
      !plainObject(g.current) ||
      !keysAre(g.current, 'current') ||
      !isLinePair(g.current.lines) ||
      !Array.isArray(g.current.keys)
    )
      bad('W4', 'current group shape');
    else {
      if (g.through !== null && cmpPair(g.current.lines, g.through) <= 0)
        bad('W4', 'the current group comes after through');
      if (
        g.current.keys.length > LIMITS.GROUP_KEYS ||
        sumBytes(g.current.keys.filter(isEntry)) > LIMITS.GROUP_BYTES
      )
        bad('W4', 'current group over its bound');
    }
  }
  const inv = cd.inventory;
  if (
    !(
      inv === null ||
      (plainObject(inv) &&
        keysAre(inv, 'inventory') &&
        Number.isSafeInteger(inv.count) &&
        HEX.test(inv.digest || ''))
    )
  )
    bad('W4', 'inventory shape');
  const w = cursor.witness;
  if (
    !(
      w === null ||
      (plainObject(w) &&
        keysAre(w, 'witness') &&
        w.version === 1 &&
        w.epoch === epoch &&
        typeof w.method_id === 'string' &&
        Array.isArray(w.fields) &&
        w.fields.length <= LIMITS.WITNESS_FIELDS &&
        w.fields.every((f) => typeof f === 'string' && DOT_PATH.test(f) && f.length <= 64) &&
        Number.isSafeInteger(w.count) &&
        HEX.test(w.digest || ''))
    )
  )
    bad('W4', 'witness shape');
  if (
    !plainObject(cursor.continuation) ||
    Buffer.byteLength(canonical(cursor.continuation)) > LIMITS.CONTINUATION_BYTES
  )
    bad('W4', 'continuation shape or bound');
  // CURSOR_BYTES: the cursor outside discovery and continuation, witness included.
  const rest = Object.fromEntries(
    Object.entries(cursor).filter(([k]) => k !== 'discovery' && k !== 'continuation')
  );
  if (Buffer.byteLength(canonical(rest)) > LIMITS.CURSOR_BYTES)
    bad('W4', 'the cursor outside discovery and continuation is over CURSOR_BYTES');
  for (const [mid, counts] of Object.entries(cursor.methods || {})) {
    for (const key of TERMINAL_INPUTS)
      if (plainObject(counts) && Object.hasOwn(counts, key))
        bad('W4', `methods[${mid}] holds the terminal input ${key}`);
    // REFUSAL_BYTES (§3.2): derived from how the adapter builds a refusal.
    if (
      plainObject(counts) &&
      Object.hasOwn(counts, 'refusal') &&
      Buffer.byteLength(canonical(counts.refusal)) > LIMITS.REFUSAL_BYTES
    )
      bad('W4', `methods[${mid}].refusal is over REFUSAL_BYTES`);
  }
}
function cursorEntries(cursor) {
  const out = [];
  for (const [log, st] of Object.entries(cursor.discovery?.logs || {}))
    for (const e of st?.tail || []) out.push([`cursor tail ${log}`, e]);
  for (const e of cursor.discovery?.groups?.current?.keys || []) out.push(['group key', e]);
  return out;
}

// ---------------------------------------------------------------- write path (§4)
// Every rule is evaluated; the frame is applied with store-authoritative values
// (recomputed digests), so one broken rule does not cascade into another.
function evaluateFrame(job, record, frame) {
  const violations = [];
  const bad = (rule, detail) => violations.push({ rule, detail });
  const fd = frame.discovery;
  const cursor = frame.cursor;
  const rd = record.discovery;
  const pc = record.cursor;
  const cd = cursor?.discovery;
  const none = { violations, discovery: rd, segments: [], released: [] };
  if (fd === undefined && cd === undefined) {
    if (rd) bad('W4', 'the record holds discovery and the cursor has none');
    return none;
  }
  if ((fd === undefined) !== (cd === undefined)) {
    bad('W1', 'frame discovery is present exactly when the cursor has discovery');
    return none;
  }
  // W1, the frame's shape and bounds
  const epoch = fd.epoch;
  if (!Number.isSafeInteger(epoch) || epoch < 0) bad('W1', 'epoch');
  if (!Array.isArray(fd.resets) || new Set(fd.resets).size !== fd.resets.length)
    bad('W1', 'resets');
  for (const log of fd.resets || [])
    if (!RESETTABLE.has(log)) bad('W1', `${log} is not resettable`);
  if (!Array.isArray(fd.seals) || fd.seals.length > LIMITS.FRAME_SEALS) bad('W1', 'seal count');
  for (const s of fd.seals || [])
    if (
      !LOGS.includes(s.log) ||
      !Number.isSafeInteger(s.first) ||
      s.first < 0 ||
      !Array.isArray(s.entries) ||
      !s.entries.length ||
      !HEX.test(s.digest_before || '') ||
      !HEX.test(s.digest_after || '')
    )
      bad('W1', 'seal shape');
  // F1, F2 on every entry the frame carries
  const entries = [
    ...(fd.seals || []).flatMap((s, i) => (s.entries || []).map((e) => [`seal ${i}`, e])),
    ...cursorEntries(cursor),
  ];
  for (const [where, e] of entries) {
    if (!isEntry(e)) bad('F1', where);
    else if (size(e) > LIMITS.ENTRY_BYTES) bad('F2', where);
  }
  // W2, the epoch rule
  if (cursor.method_index !== epoch || cd.epoch !== epoch)
    bad('W2', 'the frame, cursor.method_index and cursor.discovery.epoch agree');
  if (rd && epoch < rd.epoch) bad('W2', 'the epoch went backwards');
  if (rd && epoch > rd.epoch && fd.resets.length) bad('W2', 'a reset on an epoch advance');
  // Apply: release, resets, seals (W3, F5, F4, W5)
  const sameEpoch = rd && rd.epoch === epoch;
  const logs = sameEpoch ? clone(rd.logs) : {};
  const released = [];
  if (rd && !sameEpoch)
    for (const st of Object.values(rd.logs)) if (st.head) released.push(st.head);
  const reset = new Set();
  for (const log of fd.resets || []) {
    if (!sameEpoch || !logs[log]) bad('W3', `reset of ${log}, which the record does not hold`);
    else if (logs[log].head) released.push(logs[log].head);
    logs[log] = emptyLog(log);
    reset.add(log);
  }
  const segments = [];
  const sealed = {};
  // A log whose seal fails F5 has no store digest for the cursor to agree with.
  const tainted = new Set();
  (fd.seals || []).forEach((s, i) => {
    if (!LOGS.includes(s.log) || !Array.isArray(s.entries)) return;
    const log = s.log;
    const st = (logs[log] ??= emptyLog(log));
    if (s.first !== st.count) bad('W3', `seal ${i} first ${s.first} against count ${st.count}`);
    if (s.digest_before !== st.digest) bad('W3', `seal ${i} digest_before`);
    if (HEX.test(s.digest_before || '') && fold(s.digest_before, s.entries) !== s.digest_after) {
      bad('F5', `seal ${i} digest_after does not recompute`);
      tainted.add(log);
    }
    const n = s.entries.length;
    const bytes = sumBytes(s.entries.filter(isEntry));
    if (n > LIMITS.SEGMENT_ENTRIES || bytes > LIMITS.SEGMENT_BYTES)
      bad('F4', `seal ${i} over bound`);
    else {
      const later = fd.seals.slice(i + 1).find((t) => t.log === log);
      const next = later ? later.entries[0] : cd.logs[log]?.tail?.[0];
      const complete =
        n === LIMITS.SEGMENT_ENTRIES ||
        bytes === LIMITS.SEGMENT_BYTES ||
        (next !== undefined && bytes + size(next) > LIMITS.SEGMENT_BYTES);
      if (!complete) bad('F4', `seal ${i} is premature`);
    }
    const after = fold(st.digest, s.entries);
    const segment = {
      version: 1,
      kind: 'reader_discovery_segment',
      job_id: job.job_id,
      identity_hash: job.identity_hash,
      epoch,
      log,
      previous_hash: st.head,
      first: st.count,
      count: n,
      digest_before: st.digest,
      digest_after: after,
      entries: s.entries,
    };
    const raw = segmentBytes(segment);
    const address = sha(raw);
    segments.push({ log, address, bytes: raw.length, raw, segment });
    logs[log] = {
      head: address,
      segments: st.segments + 1,
      count: st.count + n,
      bytes: st.bytes + bytes,
      digest: after,
    };
    if (logs[log].segments > LIMITS.CHAIN_SEGMENTS) bad('W5', `${log} chain over CHAIN_SEGMENTS`);
    (sealed[log] ??= []).push(...s.entries);
  });
  for (const log of Object.keys(cd.logs)) logs[log] ??= emptyLog(log);
  // §4: a commit keeps each log's verified state unless the frame releases or
  // resets the log, and a new log starts empty. Only the walk advances it (§5.1).
  const verified = {};
  for (const log of Object.keys(logs))
    verified[log] =
      sameEpoch && rd.verified?.[log] && !reset.has(log) ? clone(rd.verified[log]) : emptyLog(log);
  // W7, the membership cap: the four membership logs together, each its count
  // plus its new tail (§3, derived in §6.11)
  const held = membershipHeld(logs, cd);
  if (held > LIMITS.MEMBERSHIP_ENTRIES) bad('W7', `the membership logs would hold ${held} entries`);
  // and their entry bytes, each log's `bytes` plus its new tail's (BB8 6693502369, item 30)
  const heldBytes = membershipBytes(logs, cd);
  if (heldBytes > LIMITS.MEMBERSHIP_BYTES)
    bad('W7', `the membership logs would hold ${heldBytes} entry bytes`);
  // W6, append-only tails
  if (pc?.discovery && pc.discovery.epoch === epoch)
    for (const [log, st] of Object.entries(cd.logs)) {
      const old = pc.discovery.logs?.[log];
      if (!old || reset.has(log)) continue;
      const after = [...(sealed[log] || []), ...(st.tail || [])];
      if (
        old.tail.length > after.length ||
        old.tail.some((e, k) => canonical(e) !== canonical(after[k]))
      )
        bad('W6', `${log}: the previous tail is not a prefix of what follows it`);
    }
  // W4, agreement and cursor shape
  cursorShape(cursor, epoch, bad);
  if (!same(Object.keys(cd.logs).sort(), Object.keys(logs).sort()))
    bad('W4', 'the cursor names exactly the record logs');
  for (const [log, st] of Object.entries(cd.logs)) {
    if (!logs[log]) continue;
    if (st.sealed !== logs[log].count)
      bad('W4', `${log} sealed ${st.sealed} against ${logs[log].count}`);
    if (st.sealed_digest !== logs[log].digest && !tainted.has(log))
      bad('W4', `${log} sealed_digest`);
  }
  if (
    pc?.discovery &&
    pc.discovery.epoch === epoch &&
    pc.discovery.inventory != null &&
    canonical(pc.discovery.inventory) !== canonical(cd.inventory)
  )
    bad('W4', 'the inventory changed within its epoch');
  const pg = pc?.discovery?.epoch === epoch ? pc.discovery.groups : null;
  const g = cd.groups;
  if (
    isPair(pg?.through) &&
    plainObject(g) &&
    !(isPair(g.through) && cmpPair(g.through, pg.through) >= 0)
  )
    bad('W4', 'groups.through went backwards within its epoch');
  // Nor does the current group (BB8 6715584092, F-6), narrowed (BB8
  // 6717719856) to frames where both the record's cursor and the frame have
  // a current group: the frame's current.lines is at or after the previous
  // one. A group dropped without retiring, or a through behind the previous
  // group, is accepted until 3PO confirms (#721) the worker never does either.
  const was = plainObject(pg?.current) ? pg.current.lines : null;
  const now = plainObject(g?.current) ? g.current.lines : null;
  if (isPair(was) && now !== null && !(isPair(now) && cmpPair(now, was) >= 0))
    bad('W4', 'groups.current went backwards within its epoch');
  return {
    violations,
    discovery: { version: 1, epoch, logs, verified, unavailable: null },
    segments,
    released,
  };
}
const WRITE_RULES = ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7'];
// The membership logs' entries after a frame: each log's sealed count plus its
// cursor tail (W7).
function membershipHeld(logs, cd) {
  let held = 0;
  for (const log of MEMBERSHIP_LOGS) {
    const tail = cd.logs?.[log]?.tail;
    if (logs[log]) held += logs[log].count;
    if (Array.isArray(tail)) held += tail.length;
  }
  return held;
}
// The membership logs' entry bytes after a frame: each log's `bytes` plus its
// cursor tail's canonical bytes (W7, BB8 6693502369, item 30).
function membershipBytes(logs, cd) {
  let held = 0;
  for (const log of MEMBERSHIP_LOGS) {
    const tail = cd.logs?.[log]?.tail;
    if (logs[log]) held += logs[log].bytes;
    if (Array.isArray(tail)) held += sumBytes(tail.filter((e) => isEntry(e)));
  }
  return held;
}
// The worker, before it emits a frame that passes either cap: it names the log
// whose append passes it. A fixture frame grows exactly one membership log.
function workerMembershipRefusal(record, frame) {
  const tail = (c, log) => c.discovery.logs[log]?.tail ?? [];
  const sealed = (log) => record.discovery.logs[log] ?? { count: 0, bytes: 0 };
  const before = (log) => sealed(log).count + tail(record.cursor, log).length;
  const after = (log) => sealed(log).count + tail(frame.cursor, log).length;
  const afterBytes = (log) => sealed(log).bytes + sumBytes(tail(frame.cursor, log));
  const grew = MEMBERSHIP_LOGS.filter((log) => after(log) > before(log));
  assert.equal(grew.length, 1, 'a membership fixture frame grows one log');
  const total = MEMBERSHIP_LOGS.reduce((n, log) => n + after(log), 0);
  const totalBytes = MEMBERSHIP_LOGS.reduce((n, log) => n + afterBytes(log), 0);
  return total > LIMITS.MEMBERSHIP_ENTRIES || totalBytes > LIMITS.MEMBERSHIP_BYTES
    ? { code: 'RESOURCE_LIMIT', cause: `discovery_${grew[0]}` }
    : null;
}
// Replays a write fixture's frames; returns the violations of every frame.
function replay(fx) {
  let record = clone(fx.record);
  const results = [];
  for (const frame of fx.frames) {
    const result = evaluateFrame(fx, record, frame);
    results.push(result);
    record = { discovery: result.discovery, cursor: frame.cursor };
  }
  return results;
}
// Every segment the seal sequence builds, by address. `corrupt` changes one
// stored byte of a segment ({address, at, byte}), so its bytes no longer match
// its address. `extra` are segments a fixture stores as they are, such as one
// no store would have written (an entry past ENTRY_DEPTH, §2.1), or, as
// `{hex}`, bytes no JSON value spells (invalid UTF-8, §2.11). `oversized`
// replaces a segment by a file of `bytes` bytes ({address, bytes}), which the
// store stats and never reads when it passes READER_LIMITS.objectBytes (§2.5,
// F6 by size; BB8 6700200435, condition 7): its content is never looked at.
function storeOf(rel, omit = [], corrupt = [], extra = [], oversized = []) {
  const store = new Map();
  if (rel)
    for (const result of replay(load(rel)))
      for (const s of result.segments) if (!omit.includes(s.address)) store.set(s.address, s.raw);
  for (const seg of extra) {
    const raw = typeof seg.hex === 'string' ? Buffer.from(seg.hex, 'hex') : segmentBytes(seg);
    store.set(sha(raw), raw);
  }
  for (const { address, at, byte } of corrupt) {
    const raw = Buffer.from(store.get(address));
    assert.notEqual(raw[at], byte, 'a corruption changes the byte');
    raw[at] = byte;
    store.set(address, raw);
  }
  for (const { address, bytes } of oversized) {
    assert.ok(store.has(address), 'an oversized file replaces a segment the store holds');
    store.set(address, { stored: bytes });
  }
  return store;
}

// ---------------------------------------------------------------- resume path (§5)
function evaluateResume(fx) {
  const violations = [];
  const skipped = [];
  const bad = (rule, detail) => violations.push({ rule, detail });
  const store = storeOf(fx.store.segments_from, fx.store.omit, [], fx.store.segments);
  const { record } = fx;
  const p = fx.payload.discovery;
  const rd = record.discovery;
  const cd = record.cursor.discovery;
  const read = {};
  for (const [log, list] of Object.entries(p.paths)) {
    read[log] = list.map((file) => {
      const stem = path.basename(file, '.json');
      if (path.dirname(file) !== path.join(fx.directory, 'pages'))
        bad('R1', `${file} is outside the store`);
      const raw = store.get(stem);
      if (!raw) {
        bad('R1', `${log}: ${stem} does not resolve`);
        return null;
      }
      // F6, F3 (its content included, §2.5), F4 bounds, F5 on every segment that resolves
      if (sha(raw) !== stem) bad('F6', `${stem} does not match its address`);
      const { seg, faults } = segmentContent(raw, { fatal: !fx.replacing });
      if (faults.length) bad('F3', `${stem} content: ${faults.join(', ')}`);
      if (!seg) return null;
      if (
        !same(Object.keys(seg), SEGMENT_FIELDS) ||
        seg.version !== 1 ||
        seg.kind !== 'reader_discovery_segment' ||
        seg.job_id !== record.id ||
        seg.identity_hash !== record.identity_hash ||
        seg.epoch !== p.summary.epoch ||
        seg.log !== log ||
        seg.count !== seg.entries.length
      )
        bad('F3', `${stem} schema`);
      if (seg.count > LIMITS.SEGMENT_ENTRIES || sumBytes(seg.entries) > LIMITS.SEGMENT_BYTES)
        bad('F4', `${stem} over bound`);
      if (fold(seg.digest_before, seg.entries) !== seg.digest_after) bad('F5', `${stem} digest`);
      return { stem, seg };
    });
  }
  // R2, one chain per log, oldest first, totals equal the summary and record
  if (!same(Object.keys(p.paths).sort(), Object.keys(p.summary.logs).sort()))
    bad('R2', 'paths and summary name the same logs');
  if (canonical(p.summary) !== canonical({ epoch: rd.epoch, logs: rd.logs }))
    bad('R2', 'the summary equals record.discovery');
  for (const [log, st] of Object.entries(p.summary.logs)) {
    const list = read[log] || [];
    if (list.includes(null)) {
      skipped.push(`R2 ${log}: chain incomplete`);
      continue;
    }
    if (list.length !== st.segments) bad('R2', `${log} segment count`);
    if (!list.length) {
      if (st.head !== null || st.count !== 0 || st.digest !== d0(DOMAIN.log(log)))
        bad('R2', `${log} empty chain`);
      continue;
    }
    const oldest = list[0].seg;
    if (
      oldest.previous_hash !== null ||
      oldest.first !== 0 ||
      oldest.digest_before !== d0(DOMAIN.log(log))
    )
      bad('R2', `${log}: the first path is not the chain's oldest segment`);
    for (let k = 1; k < list.length; k++) {
      const prev = list[k - 1];
      const seg = list[k].seg;
      if (
        seg.previous_hash !== prev.stem ||
        seg.first !== prev.seg.first + prev.seg.count ||
        seg.digest_before !== prev.seg.digest_after
      )
        bad('R2', `${log}: path ${k} does not link to path ${k - 1}`);
    }
    const head = list[list.length - 1];
    if (
      head.stem !== st.head ||
      head.seg.first + head.seg.count !== st.count ||
      head.seg.digest_after !== st.digest
    )
      bad('R2', `${log}: the last path is not the head`);
  }
  // R3, the walked totals equal cursor.discovery
  if (p.summary.epoch !== cd.epoch) bad('R3', 'epoch');
  if (!same(Object.keys(p.summary.logs).sort(), Object.keys(cd.logs).sort()))
    bad('R3', 'log names');
  for (const [log, st] of Object.entries(p.summary.logs)) {
    const c = cd.logs[log];
    if (c && (c.sealed !== st.count || c.sealed_digest !== st.digest)) bad('R3', `${log} totals`);
    // The summary's bytes against the worker's own sum over what it loaded,
    // the bytes it computed once for F5 (BB8 6693502369, item 30).
    const list = read[log] || [];
    if (!list.includes(null)) {
      const own = list.reduce((n, x) => n + sumBytes(x.seg.entries), 0);
      if (own !== st.bytes) bad('R3', `${log}: bytes ${st.bytes} against the loaded ${own}`);
    }
  }
  // R4, the recomputed inventory matches its witness
  if (cd.inventory) {
    if (
      fx.inventory.length !== cd.inventory.count ||
      fold(d0(DOMAIN.inventory), fx.inventory) !== cd.inventory.digest
    )
      bad('R4', 'inventory');
  }
  return { violations, skipped };
}
const RESUME_RULES = ['R1', 'R2', 'R3', 'R4', 'F3', 'F4', 'F5', 'F6'];

// ---------------------------------------------------------------- the store's walk (§5.1)
// `addresses` is the store's in-memory address list: each live chain's
// segments, oldest first. A lease checks the list and the verified prefix
// against the record before it reads anything (R5), stats the verified prefix
// and reads only the segments appended since. A full read uses neither: it
// starts at the record's head and follows previous_hash back, and rebuilds the
// list from what it read.
function evaluateWalk(fx, discovery, mode) {
  const violations = [];
  const bad = (rule, detail, log = null) => violations.push({ rule, detail, log });
  const store = storeOf(
    fx.store.segments_from,
    fx.store.omit,
    fx.store.corrupt,
    fx.store.segments,
    fx.store.oversized
  );
  const rd = discovery;
  const stat = [];
  const read = [];
  const verified = {};
  const paths = {};
  const addresses = {};
  // One segment read by address: F6, then F3. Null when it is missing, or
  // when its stat finds it over the bound (F6, never read).
  const get = (log, address) => {
    const raw = store.get(address);
    if (!raw) {
      bad('missing', `${log}: ${address} is missing`, log);
      return null;
    }
    if (!Buffer.isBuffer(raw)) {
      if (raw.stored > codecBounds().storeBytes) {
        bad('F6', `${address} is stored as ${raw.stored} bytes, over the bound: never read`, log);
        return null;
      }
      assert.fail(`${address}: an oversized file within the bound is not a fixture's case`);
    }
    read.push(address);
    if (sha(raw) !== address) bad('F6', `${address} does not match its address`, log);
    const { seg, faults } = segmentContent(raw, { fatal: !fx.replacing });
    if (faults.length) bad('F3', `${address} content: ${faults.join(', ')}`, log);
    if (!seg) return null;
    if (
      !same(Object.keys(seg), SEGMENT_FIELDS) ||
      seg.version !== 1 ||
      seg.kind !== 'reader_discovery_segment' ||
      seg.job_id !== fx.record.id ||
      seg.identity_hash !== fx.record.identity_hash ||
      seg.epoch !== rd.epoch ||
      seg.log !== log ||
      seg.count !== seg.entries.length
    )
      bad('F3', `${address} schema`, log);
    return seg;
  };
  const next = (at, address, seg) => ({
    head: address,
    segments: at.segments + 1,
    count: seg.first + seg.count,
    bytes: at.bytes + sumBytes(seg.entries),
    digest: seg.digest_after,
  });
  const withoutBytes = (st) =>
    Object.fromEntries(Object.entries(st).filter(([k]) => k !== 'bytes'));
  const links = (at, seg) =>
    seg.previous_hash === at.head && seg.first === at.count && seg.digest_before === at.digest;
  if (mode === 'full') {
    for (const [log, st] of Object.entries(rd.logs)) {
      // From the head back, at most the record's segments: never the list.
      const chain = [];
      let address = st.head;
      let missing = false;
      while (address !== null && chain.length < st.segments) {
        const seg = get(log, address);
        if (!seg) {
          missing = true;
          break;
        }
        chain.unshift({ address, seg });
        address = seg.previous_hash;
      }
      if (missing) continue;
      if (address !== null || chain.length !== st.segments)
        bad('R2', `${log}: the chain from the head does not hold the record's segments`, log);
      let at = emptyLog(log);
      for (const { address: a, seg } of chain) {
        if (!links(at, seg)) bad('R2', `${log}: ${a} does not continue ${at.head}`, log);
        at = next(at, a, seg);
      }
      if (canonical(at) !== canonical(st))
        bad('R2', `${log}: the chain does not end at the record's head`, log);
      addresses[log] = chain.map((c) => c.address);
      verified[log] = clone(st);
    }
    return { violations, read, addresses, verified };
  }
  // R5, the store's own bookkeeping, from the record and the list alone and for
  // every log before anything is read.
  if (
    !plainObject(rd.verified) ||
    !same(Object.keys(rd.verified).sort(), Object.keys(rd.logs).sort())
  )
    bad('R5', 'verified names exactly the logs the record holds');
  else
    for (const [log, st] of Object.entries(rd.logs)) {
      const list = fx.addresses[log] || [];
      const v = rd.verified[log];
      if (list.length !== st.segments || (list.at(-1) ?? null) !== st.head)
        bad('R5', `${log}: the address list does not end at the record's head`, log);
      const prefix =
        plainObject(v) &&
        Number.isSafeInteger(v.segments) &&
        v.segments >= 0 &&
        v.segments <= st.segments &&
        Number.isSafeInteger(v.count) &&
        v.count <= st.count &&
        Number.isSafeInteger(v.bytes) &&
        v.bytes <= st.bytes &&
        (v.segments !== 0 || canonical(v) === canonical(emptyLog(log))) &&
        (v.segments !== st.segments || canonical(v) === canonical(st)) &&
        (v.segments === 0 || list[v.segments - 1] === v.head);
      if (!prefix) bad('R5', `${log}: the verified state is not a prefix of its chain`, log);
    }
  if (violations.length) return { violations, stat, read, verified: {}, saved: false };
  for (const [log, st] of Object.entries(rd.logs)) {
    const list = fx.addresses[log];
    const v = rd.verified[log];
    stat.push(...list.slice(0, v.segments));
    // The first segment read continues the verified head: the junction (R5).
    let at = v;
    let junction = v.segments > 0;
    // A segment missing or unreadable ends the walk of its log; its refusal
    // is already recorded, and nothing after it is linked.
    let ended = false;
    for (const address of list.slice(v.segments)) {
      const seg = get(log, address);
      if (!seg) {
        ended = true;
        break;
      }
      if (!links(at, seg))
        bad(junction ? 'R5' : 'R2', `${log}: ${address} does not continue ${at.head}`, log);
      junction = false;
      at = next(at, address, seg);
    }
    // R2 links the last segment read to the head, its count and its digest; R5's
    // junction holds the bytes: the segments read, added to v.bytes, end at the
    // head's bytes (BB8 6693502369, item 30).
    if (ended) continue;
    if (canonical(withoutBytes(at)) !== canonical(withoutBytes(st)))
      bad('R2', `${log}: the walk does not end at the head`, log);
    else if (at.bytes !== st.bytes)
      bad('R5', `${log}: the bytes read from v.bytes do not end at the head's bytes`, log);
    verified[log] = clone(st);
    paths[log] = list.map((a) => path.join(fx.directory, 'pages', `${a}.json`));
  }
  if (violations.length) return { violations, stat, read, verified: {}, saved: false };
  return {
    violations,
    stat,
    read,
    verified,
    saved: canonical(verified) !== canonical(rd.verified),
    payload: { version: 1, summary: { epoch: rd.epoch, logs: clone(rd.logs) }, paths },
  };
}
const WALK_RULES = ['R2', 'R5', 'F3', 'F6'];

// ---------------------------------------------------------------- releases (§2.7, U1)
// One save empties logs and verified and records each released log's head.
const releaseOf = (rd, cause, log) => ({
  version: 1,
  epoch: rd.epoch,
  logs: {},
  verified: {},
  unavailable: {
    cause,
    log,
    released: Object.fromEntries(Object.entries(rd.logs).map(([l, st]) => [l, st.head])),
  },
});
// §8's message for each DISCOVERY_UNAVAILABLE cause, as the contract states it.
function causeMessages() {
  const rows = tableRows(
    section('8. Refusals').split('The causes:')[1].split('The `RESOURCE_LIMIT` causes')[0]
  );
  const text = Object.fromEntries(rows.map((r) => [r[0].replace(/`/g, ''), r[4]]));
  return Object.fromEntries(
    Object.entries(text).map(([cause, m]) => {
      const ref = /^the `([a-z_]+)` message$/.exec(m);
      return [cause, ref ? text[ref[1]] : m];
    })
  );
}
// A job's saves around a release (§7.4, §8): store.pause from the scheduler,
// with a worker reply's error_cause and error_log or a sink error's cause and
// log, reconciliation, a lease expiry (startup's INTERRUPTED pause has its
// shape) and cancel(). U1: a release of a record whose unavailable is already set
// releases nothing, so the first trace wins. U2: while unavailable is set,
// every save that writes the job's reason writes it copied from unavailable,
// with no stored message, and a pause never requeues.
// ---------------------------------------------------------------- M1 (§2.7)
// A record.discovery that is present, not null, and not of §2.7's shape is
// malformed (BB8 6709891376, ruling 3). Its faults, by kind: 'keys' (a key
// missing or extra, or a log name outside §2.3), 'type' (a value of the wrong
// type or range) and 'verified' (verified does not name exactly the logs logs
// names; BB8 6709891376, ruling 1). Empty when the value is of the shape.
// Null and an absent key are not M1: they hold no discovery state.
const RECORD_DISCOVERY_KEYS = ['epoch', 'logs', 'unavailable', 'verified', 'version'];
const LOG_STATE_KEYS = ['bytes', 'count', 'digest', 'head', 'segments'];
function m1Faults(value) {
  const faults = new Set();
  const nat = (v) => Number.isSafeInteger(v) && v >= 0;
  const hex = (v) => typeof v === 'string' && HEX.test(v);
  const has = (v, k) => Object.hasOwn(v, k);
  const keys = (v, want) => same(Object.keys(v).sort(), want) || faults.add('keys');
  if (!plainObject(value)) return ['type'];
  keys(value, RECORD_DISCOVERY_KEYS);
  if (has(value, 'version') && value.version !== 1) faults.add('type');
  if (has(value, 'epoch') && !nat(value.epoch)) faults.add('type');
  for (const which of ['logs', 'verified']) {
    if (!has(value, which)) continue;
    const states = value[which];
    if (!plainObject(states)) {
      faults.add('type');
      continue;
    }
    for (const [log, st] of Object.entries(states)) {
      if (!LOGS.includes(log)) faults.add('keys');
      if (!plainObject(st)) {
        faults.add('type');
        continue;
      }
      keys(st, LOG_STATE_KEYS);
      if (has(st, 'head') && st.head !== null && !hex(st.head)) faults.add('type');
      for (const k of ['segments', 'count', 'bytes'])
        if (has(st, k) && !nat(st[k])) faults.add('type');
      if (has(st, 'digest') && !hex(st.digest)) faults.add('type');
    }
  }
  if (
    plainObject(value.logs) &&
    plainObject(value.verified) &&
    !same(Object.keys(value.logs).sort(), Object.keys(value.verified).sort())
  )
    faults.add('verified');
  const u = value.unavailable;
  if (has(value, 'unavailable') && u !== null) {
    if (!plainObject(u)) faults.add('type');
    else {
      keys(u, ['cause', 'log', 'released']);
      if (has(u, 'cause') && !CAUSES.includes(u.cause)) faults.add('type');
      if (has(u, 'log') && u.log !== null && !LOGS.includes(u.log)) faults.add('type');
      if (has(u, 'released'))
        if (!plainObject(u.released)) faults.add('type');
        else
          for (const [log, head] of Object.entries(u.released)) {
            if (!LOGS.includes(log)) faults.add('keys');
            if (head !== null && !hex(head)) faults.add('type');
          }
    }
  }
  return [...faults].sort();
}
// §7.4's release of a malformed value, from the job as it was (`start`): cause
// chain_broken, log null; `released` names each log name of §2.3 the value's
// logs holds, with its head if that is 64-hex and null otherwise; `epoch` is the
// value's own if it is an integer from 0 to 2^53 - 1, else 0. A queued job is
// paused with a null fence; every job leaves deferred_requeue false; a running
// job keeps its state, fence and reason, and every other takes the U2 reason.
function m1Release(start, value) {
  const logs = plainObject(value) && plainObject(value.logs) ? value.logs : {};
  const released = Object.fromEntries(
    Object.entries(logs)
      .filter(([log]) => LOGS.includes(log))
      .map(([log, st]) => [
        log,
        plainObject(st) && typeof st.head === 'string' && HEX.test(st.head) ? st.head : null,
      ])
  );
  const epoch =
    plainObject(value) && Number.isSafeInteger(value.epoch) && value.epoch >= 0 ? value.epoch : 0;
  const running = start.state === 'running';
  return {
    state: start.state === 'queued' ? 'paused' : start.state,
    deferred_requeue: false,
    fence: start.state === 'queued' ? null : start.fence,
    discovery: {
      version: 1,
      epoch,
      logs: {},
      verified: {},
      unavailable: { cause: 'chain_broken', log: null, released },
    },
    reason: running
      ? start.reason
      : {
          code: 'DISCOVERY_UNAVAILABLE',
          cause: 'chain_broken',
          log: null,
          released: clone(released),
        },
  };
}
// A value's leaves by dot path; an empty object or array is a leaf.
function flatten(v, at = '', out = {}) {
  const entries = plainObject(v) || Array.isArray(v) ? Object.entries(v) : [];
  if (!entries.length) out[at] = v;
  for (const [k, x] of entries) flatten(x, at ? `${at}.${k}` : k, out);
  return out;
}
const MALFORMED_CASES = [
  'verified_mismatch',
  'wrong_type_key',
  'extra_key',
  'extra_state_key',
  'empty_object',
];
// The fields a release changes, as their JSON bytes: every other field of the
// record is saved as it was, so a release grows the record exactly when these
// grow.
const RELEASE_FIELDS = ['state', 'deferred_requeue', 'fence', 'discovery', 'reason'];
const fieldBytes = (r) =>
  Buffer.byteLength(JSON.stringify(Object.fromEntries(RELEASE_FIELDS.map((k) => [k, r[k]]))));

function pauseCase(record, kase) {
  let discovery = clone(record.discovery);
  let state = kase.state;
  let reason = kase.reason ?? null;
  const extra = {};
  const release = (cause, log) => {
    if (discovery.unavailable) return;
    assert.ok(
      CAUSES.includes(cause),
      `a first release names a cause from the closed set: ${cause}`
    );
    discovery = releaseOf(discovery, cause, LOGS.includes(log) ? log : null);
  };
  const copy = () => {
    const { cause, log, released } = discovery.unavailable;
    return { code: 'DISCOVERY_UNAVAILABLE', cause, log, released: clone(released) };
  };
  for (const ev of kase.events) {
    if (ev.by === 'store.pause') {
      assert.equal(state, 'running', 'store.pause ends a lease');
      if (ev.code === 'DISCOVERY_UNAVAILABLE')
        release(ev.error_cause ?? ev.cause, ev.error_log ?? ev.log);
      if (discovery.unavailable) [state, reason] = ['paused', copy()];
      else [state, reason] = ev.requeue ? ['queued', null] : ['paused', { code: ev.code }];
    } else if (ev.by === 'reconciliation') {
      release(ev.cause, ev.log);
      if (state === 'queued') Object.assign(extra, { deferred_requeue: false, fence: null });
      if (state === 'queued') state = 'paused';
      // A running job's lease writes its reason: its next refusal pauses it.
      if (state !== 'running') reason = copy();
    } else if (ev.by === 'lease_expiry') {
      assert.equal(state, 'running', 'a lease expires on a running job');
      [state, reason] = ['paused', discovery.unavailable ? copy() : { code: 'INTERRUPTED' }];
    } else if (ev.by === 'cancel') {
      state = state === 'running' ? 'running' : 'cancelled';
      reason = discovery.unavailable ? copy() : { code: 'CANCELLED' };
    } else assert.fail(`unknown event ${ev.by}`);
  }
  return { state, ...extra, discovery, reason };
}
// §7.4 (BB8 6678702125, ruling 5): a release is never larger than the record
// it replaces. A property over generated records at the bounds: each log
// absent, with only a tail, or with a head at the smallest or the largest count
// a chain holds; at least one with a head (reconciliation releases a chain it
// read); the verified heads lagging or not; the three causes a full read
// releases with; every job state, with the attempt counter, the fence and the
// queue fields at their widest. It returns every delta.
function releaseDeltas() {
  const out = [];
  // `bytes` at its smallest (one byte an entry) or its largest (every segment full).
  const withHead = (log, count) => ({
    head: sha(`head ${log}`),
    segments: Math.max(1, Math.ceil(count / LIMITS.SEGMENT_ENTRIES)),
    count,
    bytes: count === 4 ? 4 : LIMITS.CHAIN_SEGMENTS * LIMITS.SEGMENT_BYTES,
    digest: sha(`digest ${log}`),
  });
  const kinds = ['absent', 'tail', 'smallest', 'largest'];
  const count = { smallest: 4, largest: LIMITS.CHAIN_SEGMENTS * LIMITS.SEGMENT_ENTRIES };
  for (let code = 0; code < kinds.length ** LOGS.length; code++) {
    const pick = LOGS.map((_, i) => kinds[Math.floor(code / kinds.length ** i) % kinds.length]);
    const headed = LOGS.filter((_, i) => count[pick[i]]);
    if (!headed.length) continue;
    const logs = {};
    LOGS.forEach((log, i) => {
      if (pick[i] === 'tail') logs[log] = emptyLog(log);
      else if (count[pick[i]]) logs[log] = withHead(log, count[pick[i]]);
    });
    for (const lag of [true, false])
      for (const cause of ['segment_missing', 'segment_corrupt', 'chain_broken'])
        for (const state of ['queued', 'paused', 'cancelled', 'running']) {
          const rd = {
            version: 1,
            epoch: INTEGER,
            logs,
            verified: Object.fromEntries(
              Object.entries(logs).map(([l, st]) => [l, lag ? emptyLog(l) : clone(st)])
            ),
            unavailable: null,
          };
          const running = state === 'running';
          // The smallest reason a job in that state holds: none (a paused or
          // cancelled job always holds one, so null is below every real case).
          const before = {
            state,
            attempt: INTEGER,
            fence: running ? 'f'.repeat(64) : null,
            lease_expires_at: running ? INTEGER : null,
            deferred_requeue: false,
            // The release keeps the queue fields (§7.4): store.pause would rewrite them.
            queued_at: INTEGER,
            queue_order: INTEGER,
            cancel_requested: false,
            reason: null,
            discovery: rd,
          };
          const got = pauseCase(
            { discovery: rd },
            { state, events: [{ by: 'reconciliation', cause, log: headed[0] }] }
          );
          const after = { ...before, ...got };
          out.push({
            pick,
            lag,
            cause,
            state,
            before,
            after,
            delta: canonical(after).length - canonical(before).length,
          });
        }
  }
  return out;
}

// ---------------------------------------------------------------- groups (§6.4, S1)
// Membership is equality of canonical bytes (§2.3), never value equality: in
// Python 1 == True and a JSON list is not the tuple the worker held.
const member = (list, key) => list.some((k) => canonical(k) === canonical(key));
function runGroups(fx) {
  const violations = [];
  const bad = (rule, detail, extra = {}) => violations.push({ rule, detail, ...extra });
  let state = clone(fx.state);
  const alt = () => state.discovery.logs.alt_seen;
  assert.ok(Array.isArray(fx.seen_members), 'a groups fixture names its primary seen members');
  assert.equal(
    typeof fx.mirror,
    'boolean',
    'a groups fixture says whether the schema is same-rule'
  );
  assert.equal(alt().sealed, 0, 'a groups fixture starts with alt_seen wholly in its tail');
  const outcomes = [];
  // A key already met: in the primary seen log, the current group or alt_seen,
  // or reversed for a same-rule schema (analysis.py:_new_pairs).
  const known = (key) => {
    const sets = [fx.seen_members, state.discovery.groups.current?.keys || [], alt().tail];
    const one = (k) => sets.some((set) => member(set, k));
    return (
      one(key) || (fx.mirror && Array.isArray(key) && key.length === 2 && one([key[1], key[0]]))
    );
  };
  const retire = () => {
    const g = state.discovery.groups;
    assert.equal(
      state.continuation.pending,
      null,
      'a group is retired only after its pending emission'
    );
    g.through = g.current.lines;
    g.current = null;
  };
  for (const [i, ev] of fx.events.entries()) {
    if (ev.op === 'key') {
      if (!isEntry(ev.key)) bad('F1', `event ${i}`);
      else if (size(ev.key) > LIMITS.ENTRY_BYTES) bad('F2', `event ${i}`);
      assert.equal(
        state.continuation.pending,
        null,
        `event ${i}: a key arrives only between bindings`
      );
      const L = ev.lines;
      assert.ok(isPair(L) && L[0] <= L[1], `event ${i}: lines is the key's sorted line pair`);
      if (L[0] !== L[1]) {
        // A two-line key: its line pair is the current group's, a later one
        // (the boundary), or one the sort has already passed (refused).
        const g = state.discovery.groups;
        const passed = g.current
          ? cmpPair(L, g.current.lines) < 0
          : g.through !== null && cmpPair(L, g.through) <= 0;
        if (passed) {
          const position = g.current ? g.current.lines : g.through;
          bad('S1', `event ${i}: line pair ${L} passed at ${position}`, {
            cause: 'retired_key_recurred',
            at_event: i,
          });
          outcomes.push('refused');
          assert.equal('refused', ev.expect, `event ${i} is the expected refusal`);
          break;
        }
        if (g.current && cmpPair(L, g.current.lines) > 0) retire();
        state.discovery.groups.current ??= { lines: L, keys: [] };
      }
      // A key within one line never retires or opens a group: it always goes
      // to alt_seen, because other groups' targets cover its line too.
      const cur = state.discovery.groups.current;
      let result = 'new';
      if (known(ev.key)) result = 'duplicate';
      else if (
        L[0] !== L[1] &&
        cur.keys.length < LIMITS.GROUP_KEYS &&
        sumBytes(cur.keys) + size(ev.key) <= LIMITS.GROUP_BYTES
      )
        cur.keys.push(ev.key);
      else alt().tail.push(ev.key);
      if (result === 'new') {
        state.continuation.pending = { binding: ev.key };
        state.emission = 0;
      }
      outcomes.push(result);
      assert.equal(result, ev.expect, `event ${i} (${JSON.stringify(ev.key)})`);
    } else if (ev.op === 'fragment') {
      assert.ok(state.continuation.pending, `event ${i}: a fragment of a pending binding`);
      state.emission += 1;
    } else if (ev.op === 'done') {
      assert.ok(state.continuation.pending, `event ${i}: the pending binding completes`);
      state.continuation.pending = null;
      state.emission = 0;
    } else if (ev.op === 'checkpoint') {
      assert.deepEqual(state, ev.expect, `event ${i}: the checkpoint carries this state`);
    } else if (ev.op === 'resume') {
      // The pending binding wins: membership is restored, not re-added.
      assert.deepEqual(ev.state, state, `event ${i}: resume restores exactly the checkpoint`);
      state = clone(ev.state);
    } else assert.fail(`event ${i}: unknown op ${ev.op}`);
  }
  return { violations, state, outcomes };
}

// ---------------------------------------------------------------- witness (§6.9, S2)
const field = (record, name) =>
  name
    .split('.')
    .reduce(
      (v, k) => (v !== null && typeof v === 'object' && Object.hasOwn(v, k) ? v[k] : null),
      record
    );
const tuplesOf = (records, fields) => records.map((r) => fields.map((f) => field(r, f)));
const witnessOf = (method, fields, records) => {
  const tuples = tuplesOf(records, fields);
  return { count: tuples.length, digest: fold(d0(DOMAIN.witness(method)), tuples) };
};
// One record and its detail parts, resolved as resolve_detail_records
// (analysis.py:resolve_detail_records) resolves them; any defect is an error.
function resolveOne(stream, i) {
  const record = stream[i];
  if (!plainObject(record) || record.kind === 'detail_part')
    return { error: `record ${i}: a detail part has no pending parent` };
  const refs = Object.entries(record).filter(
    ([, v]) => plainObject(v) && Object.hasOwn(v, '$detail_ref')
  );
  if (!refs.length) return { record, next: i + 1 };
  const out = { ...record };
  const buffers = new Map(refs.map(([name, ref]) => [ref.$detail_ref, { name, ref, parts: [] }]));
  let j = i + 1;
  while (buffers.size) {
    const part = stream[j];
    if (part?.kind !== 'detail_part') return { error: `record ${i}: its detail is incomplete` };
    const buffer = buffers.get(part.detail_id);
    if (!buffer || part.parent_id !== record.id || part.part !== buffer.parts.length)
      return { error: `record ${j}: detail parts are out of order` };
    if (part.total !== buffer.ref.parts) return { error: `record ${j}: detail part count` };
    buffer.parts.push(part.json_fragment);
    if (buffer.parts.length === buffer.ref.parts) {
      const raw = Buffer.from(buffer.parts.join(''), 'utf8');
      if (raw.length !== buffer.ref.byte_length || sha(raw) !== buffer.ref.sha256)
        return { error: `record ${i}: detail bytes do not match` };
      out[buffer.name] = JSON.parse(raw.toString('utf8'));
      buffers.delete(part.detail_id);
    }
    j++;
  }
  return { record: out, next: j };
}
// §6.9: fold exactly the first witness.count resolved records; every later
// record is the method's terminal suffix, filtered before resolving.
function reconstruct(method, witness, stream) {
  const violations = [];
  const bad = (rule, detail) => violations.push({ rule, detail });
  if (witness === null) {
    bad('S2', 'a null witness on a qualified method');
    return { violations, folded: [], suffix: 0 };
  }
  if (witness.method_id !== method) bad('S2', 'the witness names another method');
  const terminal = (r) => r?.kind === 'method_result' && r.method_id === method;
  const folded = [];
  let i = 0;
  while (folded.length < witness.count && i < stream.length && !terminal(stream[i])) {
    const got = resolveOne(stream, i);
    if (got.error) {
      bad('S2', got.error);
      return { violations, folded, suffix: 0 };
    }
    folded.push(got.record);
    i = got.next;
  }
  // The suffix runs contiguously to the end and is this method's alone (BB8
  // 6678599629): its terminal records, each followed by its own detail parts
  // exactly as resolve_detail_records requires them. Every terminal record but
  // the last is complete; only the last may be partial, because the stream may
  // end inside its emission.
  let j = i;
  suffix: while (j < stream.length) {
    const parent = stream[j];
    if (!terminal(parent)) {
      bad('S2', `${parent?.id} is an inserted record: it follows the boundary outside the suffix`);
      break;
    }
    const buffers = new Map(
      Object.values(parent)
        .filter((v) => plainObject(v) && Object.hasOwn(v, '$detail_ref'))
        .map((ref) => [ref.$detail_ref, { ref, parts: [] }])
    );
    j++;
    while (buffers.size && j < stream.length) {
      const part = stream[j];
      const buffer =
        part?.kind === 'detail_part' && part.method_id === method
          ? buffers.get(part.detail_id)
          : undefined;
      if (
        !buffer ||
        part.parent_id !== parent.id ||
        part.part !== buffer.parts.length ||
        part.total !== buffer.ref.parts
      ) {
        bad('S2', `${part?.id}: ${parent.id}'s detail is not complete, in order, before it`);
        break suffix;
      }
      buffer.parts.push(part.json_fragment);
      if (buffer.parts.length === buffer.ref.parts) {
        const raw = Buffer.from(buffer.parts.join(''), 'utf8');
        if (raw.length !== buffer.ref.byte_length || sha(raw) !== buffer.ref.sha256) {
          bad('S2', `${parent.id}: its detail bytes do not match`);
          break suffix;
        }
        buffers.delete(part.detail_id);
      }
      j++;
    }
  }
  for (const t of tuplesOf(folded, witness.fields)) if (!isEntry(t)) bad('F1', 'witness tuple');
  const got = witnessOf(method, witness.fields, folded);
  if (got.count !== witness.count || got.digest !== witness.digest)
    bad('S2', 'the count or digest disagrees with durable history');
  return { violations, folded, suffix: stream.length - i };
}
// A mutant's record is an index into the base's durable_records, a name from
// the fixture's own `named` records, a patched copy of one ({of, set}), or a
// whole record.
const mutantStream = (base, mutant, fx = {}) =>
  mutant.records.map((r) => {
    if (typeof r === 'number') return base.durable_records[r];
    if (typeof r === 'string') return fx.named[r];
    if (plainObject(r) && Object.hasOwn(r, 'of')) return { ...fx.named[r.of], ...r.set };
    return r;
  });

// §6.9 (review M2): a resume case's records, derived from its split point's
// durable prefix: the contributions, the terminal parent and the parts written
// before the split. `{of, field}` is a named record with that one field changed.
const SPLIT_PARTS = { after_parent: 0, after_part_0: 1, after_part_1: 2 };
const TERMINAL_PARTS = ['d0', 'd1', 'd2', 'd3'];
const PATCHED = {
  stale_part: 'detail_id',
  changed_part: 'json_fragment',
  wrong_parent_id: 'parent_id',
  wrong_method_part: 'method_id',
  schema_name_only: 'schema_name',
};
function resumeCaseRecords(fx, m) {
  const head = Array.from({ length: fx.boundary }, (_, i) => i);
  if (m.name === 'complete') return { records: [...head, 'P', ...TERMINAL_PARTS] };
  const k = SPLIT_PARTS[m.split];
  assert.ok(k !== undefined, `${m.name}: a split point`);
  const durable = TERMINAL_PARTS.slice(0, k);
  const rest = TERMINAL_PARTS.slice(k);
  if (m.name === `${m.split}_durable`) return { records: [...head, 'P', ...durable] };
  const fault = m.fault ?? m.name.slice(m.split.length + 1);
  if (fault === 'wrong_method_parent')
    return { read: 'resume', records: [...head, { of: 'P', field: 'method_id' }, ...durable] };
  if (fault === 'inserted_record')
    return { read: 'resume', records: [...head, 'x', 'P', ...durable] };
  const later = (parts) => ({ read: 'later_read', records: [...head, 'P', ...durable, ...parts] });
  if (fault === 'missing_part') return later(rest.slice(1));
  if (fault === 'reordered_parts') return later([rest[1], rest[0], ...rest.slice(2)]);
  assert.ok(PATCHED[fault], `${m.name}: a known fault`);
  return later([{ of: rest[0], field: PATCHED[fault] }, ...rest.slice(1)]);
}

// ---------------------------------------------------------------- the cursor bound (§3.1)
// The fields of a method's counts §3.1 counts (analysis.py's delta and counts
// writes, terminal inputs apart).
const METHOD_FIELDS = [
  'candidates',
  'coverage',
  'false',
  'figure_counts',
  'first_reading_only',
  'refusal',
  'refused_questions',
  'true',
  'undecided',
  'unreadable_tokens',
];
// The three incomplete-search reasons (analysis.py:_any_reading, :_alternate_edges), as
// source fragments; the longest is built from the constants they print.
const INCOMPLETE_TEMPLATES = [
  `f"a pair's words take more than {self.EDGE_COMBOS} combinations of readings"`,
  `f"a line's words take more than {self.EDGE_COMBOS} "`,
  `f"its disputed words' readings collide on more than "`,
  `f"{self.MINI_CAP} line pairs"`,
];
const longestReason = (edge, mini) =>
  [
    `a pair's words take more than ${edge} combinations of readings`,
    `a line's words take more than ${edge} combinations of readings`,
    `its disputed words' readings collide on more than ${mini} line pairs`,
  ].reduce((a, b) => (Buffer.byteLength(b) > Buffer.byteLength(a) ? b : a));
const cbytes = (v) => Buffer.byteLength(canonical(v));
// One entry of exactly ENTRY_BYTES per load shape §10 measures (§6.11): long
// strings, value-dense arrays, and arrays nested to the deepest an entry holds,
// each shape's depth capped at ENTRY_DEPTH (BB8 6693502369, item 31): an
// array nested d deep sits inside the entry's own array, so it is capped at
// ENTRY_DEPTH - 1. Each pads its first string to the exact size.
const mib = (bytes) => `${bytes / 2 ** 20} MiB`;
const LOAD_SHAPES = (() => {
  const fit = (e) => {
    e[0] += 'x'.repeat(LIMITS.ENTRY_BYTES - cbytes(e));
    assert.equal(cbytes(e), LIMITS.ENTRY_BYTES);
    return e;
  };
  const fill = (unit) => {
    const e = ['0'];
    while (cbytes([...e, unit]) <= LIMITS.ENTRY_BYTES) e.push(unit);
    return fit(e);
  };
  const nest = (asked, leaf) => {
    const depth = Math.min(asked, LIMITS.ENTRY_DEPTH - 1);
    let u = leaf === null ? [] : [leaf];
    for (let i = 1; i < depth; i++) u = [u];
    return u;
  };
  return [
    fit(['0', '']),
    fit(['0', '\u3042'.repeat(1300)]),
    fill(7),
    fill([7]),
    fill([]),
    fill(''),
    fill('\u0001'),
    ...[2, 4, 8, 16, 64, 256, 1024].map((d) => fill(nest(d, null))),
    fill(nest(2, 0)),
    fill(nest(8, 0)),
    fit(['0', nest(2040, null)]),
  ];
})();
// §3.1's cursor cases, built by the shared builders against this file's bound.
const cursorCase = (inp, name) => buildCursorCase(inp, name, LIMITS.CURSOR_BYTES);
// A frame that carries the cursor, with an empty discovery and continuation.
const cursorFrame = (rest) => ({
  discovery: { epoch: rest.method_index, resets: [], seals: [] },
  cursor: {
    ...rest,
    discovery: {
      version: 1,
      epoch: rest.method_index,
      logs: {},
      inventory: null,
      groups: { through: null, current: null },
    },
    continuation: {},
  },
});
// §3 lists the INVARIANT_FAILURE messages, one per bound (BB8 6688972927).
// The worker model below builds its messages from those templates, so the
// messages bad/cursor_over_bound.json pins hold the templates themselves.
const INVARIANT_MESSAGES = (() => {
  const s3 = CONTRACT.slice(CONTRACT.indexOf('\n## 3. Hard limits'), CONTRACT.indexOf('\n### 3.1'));
  const out = {};
  for (const m of s3.matchAll(/^- `(INVARIANT_FAILURE: [^`]+)`/gm)) {
    const bound =
      m[1].match(/\b(REFUSAL_BYTES|CURSOR_BYTES|CONTINUATION_BYTES|WITNESS_FIELDS) \(/) ||
      m[1].match(/\bbreaks (F1): /);
    if (bound) out[bound[1]] = m[1];
  }
  return Object.freeze(out);
})();
const invariantMessage = (bound, fill) =>
  Object.entries(fill).reduce(
    (text, [slot, value]) => text.split(`<${slot}>`).join(String(value)),
    INVARIANT_MESSAGES[bound]
  );
// The worker, before it emits: a refusal past REFUSAL_BYTES, then a cursor
// past CURSOR_BYTES. Both are engine defects (§3.1, §3.2): no input can
// lengthen a refusal, and only content no constant allows gets either there.
// The message names the bound it passed and its value (§3; BB8 6688972927).
function workerCursorRefusal(rest) {
  for (const [method, counts] of Object.entries(rest.methods))
    if (counts.refusal && cbytes(counts.refusal) > LIMITS.REFUSAL_BYTES)
      return {
        code: 'INVARIANT_FAILURE',
        message: invariantMessage('REFUSAL_BYTES', { method, n: cbytes(counts.refusal) }),
      };
  if (cbytes(rest) > LIMITS.CURSOR_BYTES)
    return {
      code: 'INVARIANT_FAILURE',
      message: invariantMessage('CURSOR_BYTES', { n: cbytes(rest) }),
    };
  return null;
}

// ---------------------------------------------------------------- the reply boundary (§8, C1)
function echo(v) {
  if (v === undefined || v === null) return null;
  let text = typeof v === 'string' ? v : JSON.stringify(v);
  if (text.length > ECHO_BYTES) text = text.slice(0, ECHO_BYTES);
  while (Buffer.byteLength(text) > ECHO_BYTES) text = [...text].slice(0, -1).join('');
  return text;
}
// C1 checks a reply: the bridge's result for the worker's own final frame,
// marked reply: true. A sink error or a bridge failure is not a reply.
function checkReply(r) {
  assert.equal(r.reply, true, 'C1 checks replies only');
  const code = r.error_code;
  const set =
    code === 'DISCOVERY_UNAVAILABLE'
      ? WORKER_CAUSES
      : code === 'RESOURCE_LIMIT'
        ? RESOURCE_CAUSES
        : [];
  const cause = r.error_cause ?? null;
  if (set.length ? !set.includes(cause) : cause !== null) {
    const value = echo(cause);
    return {
      field: 'error_cause',
      value,
      message:
        value === null
          ? `The reader worker replied ${code} with no cause.`
          : `The reader worker replied ${code} with the cause ${JSON.stringify(value)}, which ${code} does not take.`,
    };
  }
  const log = r.error_log ?? null;
  if (log !== null && !LOGS.includes(log)) {
    const value = echo(log);
    return {
      field: 'error_log',
      value,
      message: `The reader worker replied ${code} with the log ${JSON.stringify(value)}, which is not a discovery log.`,
    };
  }
  // §8's Log column: a cause about one log names it; a code or cause about none takes none.
  const need = cause === null ? 'none' : CAUSE_LOG[cause];
  if (need === 'required' && log === null)
    return {
      field: 'error_log',
      value: null,
      message: `The reader worker replied ${code} with the cause ${JSON.stringify(cause)} and no log.`,
    };
  if (need === 'none' && log !== null)
    return {
      field: 'error_log',
      value: log,
      message: `The reader worker replied ${code} with the log ${JSON.stringify(log)}, which ${cause ?? code} does not take.`,
    };
  return null;
}
// One failed lease on a running job, and the pause it leads to. A reply is
// checked by C1. A sink error (thrown inside onReaderCheckpoint, kept and
// rethrown as it was) and a bridge failure with no reply are not: they pause as
// today, a sink's DISCOVERY_UNAVAILABLE carrying its own cause and log.
function replyCase(discovery, c) {
  const start = clone(discovery);
  let rd = clone(discovery);
  const out = { state: 'paused', deferred_requeue: false };
  const sources = ['reply', 'sink', 'bridge'].filter((k) => Object.hasOwn(c, k));
  assert.equal(sources.length, 1, `${c.name}: one reply, sink error or bridge failure`);
  if (c.reply) {
    const r = c.reply;
    const bad = checkReply(r);
    if (bad && rd.unavailable)
      Object.assign(out, {
        reason: { code: 'DISCOVERY_UNAVAILABLE', ...clone(rd.unavailable) },
        logged: { reply_code: r.error_code, field: bad.field, value: bad.value },
      });
    else if (bad) out.reason = { code: 'READER_PROTOCOL', reply_code: r.error_code, ...bad };
    else if (r.error_code === 'DISCOVERY_UNAVAILABLE' || rd.unavailable) {
      if (!rd.unavailable) rd = releaseOf(rd, r.error_cause, r.error_log ?? null);
      out.reason = { code: 'DISCOVERY_UNAVAILABLE', ...clone(rd.unavailable) };
    } else if (r.error_code === 'RESOURCE_LIMIT')
      out.reason = { code: 'RESOURCE_LIMIT', cause: r.error_cause };
    else out.reason = { code: r.error_code };
  } else {
    assert.ok(!Object.hasOwn(c.sink ?? c.bridge, 'reply'), `${c.name} is not a reply`);
    const code = c.sink ? c.sink.code : c.bridge.error_code;
    if (code === 'DISCOVERY_UNAVAILABLE' || rd.unavailable) {
      if (!rd.unavailable) rd = releaseOf(rd, c.sink.cause, c.sink.log ?? null);
      out.reason = { code: 'DISCOVERY_UNAVAILABLE', ...clone(rd.unavailable) };
    } else out.reason = { code };
  }
  const { reason, logged, ...rest } = out;
  return {
    ...rest,
    discovery: canonical(rd) === canonical(start) ? 'unchanged' : rd,
    reason,
    ...(logged ? { logged } : {}),
  };
}

// ---------------------------------------------------------------- the fallback pause (§8)
// BB8 6700200435, condition 3: when store.pause refuses the pause it was given
// with any code but STALE_ATTEMPT, the scheduler logs it and makes exactly one
// more store.pause, READER_PROTOCOL with no cause, log or release; a refused
// fallback is logged and lease expiry ends the lease. A refused end-of-lease
// pause or complete() reaches the catch, whose pause carries its code.
const fallbackMessage = (code) => `The reader reply could not be recorded: ${code}.`;
// store.pause refuses an argument outside every set with INVALID_PAUSE (§8),
// and a cause of the wrong family: a resource cause on DISCOVERY_UNAVAILABLE, a
// discovery cause on RESOURCE_LIMIT, any cause on another code (BB8
// 6705927389), and, since the strict pause (#656 Step 7), a
// DISCOVERY_UNAVAILABLE that names no cause.
function pauseRefusal(reason) {
  const named = (v) => v !== undefined && v !== null;
  if (reason.code === 'DISCOVERY_UNAVAILABLE' && !named(reason.cause)) return 'INVALID_PAUSE';
  if (
    named(reason.cause) &&
    !(typeof reason.cause === 'string' && [...CAUSES, ...RESOURCE_CAUSES].includes(reason.cause))
  )
    return 'INVALID_PAUSE';
  if (named(reason.log) && !LOGS.includes(reason.log)) return 'INVALID_PAUSE';
  if (
    named(reason.cause) &&
    !(
      reason.code === 'RESOURCE_LIMIT'
        ? RESOURCE_CAUSES
        : reason.code === 'DISCOVERY_UNAVAILABLE'
          ? CAUSES
          : []
    ).includes(reason.cause)
  )
    return 'INVALID_PAUSE';
  return null;
}
// The reason store.pause stores: a named cause stores no message.
function storedReason(r) {
  if (r.code === 'RESOURCE_LIMIT' && RESOURCE_CAUSES.includes(r.cause))
    return { code: r.code, cause: r.cause };
  if (r.code === 'DISCOVERY_UNAVAILABLE' && CAUSES.includes(r.cause))
    return { code: r.code, cause: r.cause, log: r.log ?? null };
  if (r.code === 'READER_PROTOCOL' && r.reply_code !== undefined)
    return {
      code: r.code,
      reply_code: r.reply_code,
      field: r.field,
      value: r.value,
      message: r.message,
    };
  return { code: r.code, message: r.message };
}
function fallbackCase(c, c1) {
  const stubs = [...c.stub.pause];
  const calls = [];
  const errors = [];
  const warnings = [];
  let saved = null;
  const pause = (reason, fallback = false) => {
    const call = { method: 'pause', code: reason.code, ...(fallback ? { fallback: true } : {}) };
    const refused = stubs.shift() ?? pauseRefusal(reason);
    calls.push(refused ? { ...call, refused } : { ...call, outcome: 'ok' });
    if (!refused) saved = storedReason(reason);
    return refused;
  };
  const lease = c.lease;
  let failure = null;
  if (lease.reply) {
    const bad = c1 ? checkReply(lease.reply) : null;
    failure = bad
      ? { code: 'READER_PROTOCOL', reply_code: lease.reply.error_code, ...bad }
      : {
          code: lease.reply.error_code,
          message: lease.reply.stderr,
          cause: lease.reply.error_cause,
          log: lease.reply.error_log,
          reply: true,
        };
  } else if (lease.sink)
    // A sink error is rethrown as it was, with its cause and log (§8).
    failure = lease.sink.provider_calls
      ? { code: lease.sink.code, message: 'Reader analysis attempted a provider call.' }
      : {
          code: lease.sink.code,
          message: 'stubbed refusal',
          cause: lease.sink.cause,
          log: lease.sink.log,
        };
  else if (lease.done) {
    if (c.stub.complete) {
      calls.push({ method: 'complete', refused: c.stub.complete.code });
      failure = { ...c.stub.complete };
    } else calls.push({ method: 'complete', outcome: 'ok' });
  } else {
    const refused = pause({ code: lease.result.reader_result.reason, message: 'yield' });
    if (refused) failure = { code: refused, message: `stubbed ${refused}` };
  }
  if (failure) {
    // The pause's code and cause, as the warn and the recovery line name them:
    // a refused reply's own code is never lost (BB8 6705927389).
    const caused = failure.cause !== undefined && failure.cause !== null;
    const named = `${echo(failure.code)}${caused ? `[${echo(failure.cause)}]` : ''}`;
    // A reply refused STALE_ATTEMPT is warned as stale (BB8 6707363590).
    const warn = (stale) =>
      warnings.push(
        `[reader] worker reply ${named}${stale ? ' (stale: STALE_ATTEMPT)' : ''}: ${failure.message}`
      );
    const refused = pause(failure);
    if (failure.reply && (caused || refused)) warn(refused === 'STALE_ATTEMPT');
    if (refused && refused !== 'STALE_ATTEMPT') {
      errors.push(`[reader] checkpoint recovery failed: ${refused} refusing ${named}`);
      const again = pause({ code: 'READER_PROTOCOL', message: fallbackMessage(refused) }, true);
      if (again) errors.push(`[reader] fallback pause failed: ${again}`);
    }
  }
  const paused = (reason) => ({
    state: 'paused',
    deferred_requeue: false,
    fence: null,
    lease_expires_at: null,
    discovery: 'unchanged',
    reason,
  });
  const fellBack = calls.some((x) => x.fallback);
  return {
    calls,
    record: saved ? paused(saved) : { state: 'running', discovery: 'unchanged', saved: 'nothing' },
    ...(!saved && fellBack
      ? {
          after_lease_expiry: paused({
            code: 'INTERRUPTED',
            message: 'Lease expired; resume the last durable checkpoint explicitly.',
          }),
        }
      : {}),
    errors,
    warnings,
  };
}
// The fallback fixture's cases, exactly.
const FALLBACK_CASES = [
  'cause_outside_every_set',
  'cause_not_a_string',
  'cause_of_the_wrong_family',
  'no_cause_and_a_log_outside_the_set',
  'unavailable_without_a_cause',
  'stale_attempt',
  'fallback_refused',
  'c1_on_safety_net',
  'end_of_lease_pause_refused',
  'end_of_lease_stale',
  'complete_refused',
];
const FALLBACK_CONTROLS = [
  'valid_reply',
  'sink_reader_protocol',
  'reply_with_a_log',
  'sink_with_a_cause',
];

// ---------------------------------------------------------------- a release under a live lease (§7.4)
// Reconciliation on one instance, a commit and a pause from the instance that
// holds the lease. The release is a normal record save: it never touches a
// running job's attempt, fence or lease, so that lease's next commit is refused
// and writes nothing; a queued job becomes paused with a null fence and keeps
// its attempt counter.
function fenceCase(record, kase) {
  let job = { ...clone(kase.job), discovery: clone(record.discovery) };
  return kase.events.map((ev) => {
    let result;
    const holds = () =>
      job.state === 'running' && job.attempt === ev.attempt && job.fence === ev.fence;
    if (ev.by === 'reconciliation') {
      const before = clone(job);
      const got = pauseCase(
        { discovery: job.discovery },
        {
          state: job.state,
          reason: job.reason,
          events: [{ by: ev.by, cause: ev.cause, log: ev.log }],
        }
      );
      job = { ...job, ...got };
      assert.equal(job.attempt, before.attempt, `${kase.name}: the attempt counter is kept`);
      if (before.state === 'running')
        assert.deepEqual(
          [job.state, job.fence, job.lease_expires_at, job.reason],
          [before.state, before.fence, before.lease_expires_at, before.reason],
          `${kase.name}: a lease some instance holds is untouched`
        );
      result = { saved: true };
    } else if (ev.by === 'commitCheckpoint') {
      if (!holds()) result = { refused: { code: 'STALE_ATTEMPT' }, written: 'nothing' };
      else if (job.discovery.unavailable)
        result = {
          refused: {
            code: 'DISCOVERY_UNAVAILABLE',
            status: 409,
            cause: job.discovery.unavailable.cause,
            log: job.discovery.unavailable.log,
          },
          written: 'nothing',
        };
      else assert.fail(`${kase.name}: a commit lands on a released record`);
    } else if (ev.by === 'store.pause') {
      if (!holds()) result = { refused: { code: 'STALE_ATTEMPT' } };
      else {
        const got = pauseCase(
          { discovery: job.discovery },
          {
            state: 'running',
            events: [
              {
                by: 'store.pause',
                code: ev.code,
                requeue: false,
                error_cause: ev.error_cause,
                error_log: ev.error_log,
                cause: ev.cause,
                log: ev.log,
              },
            ],
          }
        );
        job = { ...job, ...got, fence: null, lease_expires_at: null, deferred_requeue: false };
        result = { saved: true };
      }
    } else assert.fail(`unknown event ${ev.by}`);
    return { ...result, job: clone(job) };
  });
}

// ---------------------------------------------------------------- row_seen compaction (§6.2)
const range = ([a, b]) => Array.from({ length: b - a }, (_, i) => a + i);
// A seal may be written as `entries_range` [a, b): the integers a ... b - 1.
function expandFrame(frame) {
  const f = clone(frame);
  for (const s of f.discovery.seals)
    if (s.entries_range) {
      s.entries = range(s.entries_range);
      delete s.entries_range;
    }
  return f;
}
// BB8 6678702125, ruling 1: a frame that resets row_seen for a compaction holds
// all of it, its reset and every live key, sealed or in the new tail.
function compactionWhole(frame, live) {
  if (!frame.discovery.resets.includes('row_seen')) return true;
  const sealed = frame.discovery.seals
    .filter((s) => s.log === 'row_seen')
    .flatMap((s) => s.entries);
  const chain = [...sealed, ...frame.cursor.discovery.logs.row_seen.tail];
  return chain.length >= live.length && live.every((k, i) => canonical(k) === canonical(chain[i]));
}

// ---------------------------------------------------------------- Python
// One Python run checks every byte claim this file makes about Python.
function python(input) {
  const program = `
import hashlib, json, sys
sys.path.insert(0, sys.argv[1])
from library.contracts import canonical_json
data = json.loads(sys.stdin.buffer.read().decode("utf-8"))
def fold(d, entries):
    for e in entries:
        d = hashlib.sha256(bytes.fromhex(d) + canonical_json(e).encode("utf-8")).hexdigest()
    return d
out = {"vectors": [], "segments": []}
for e in data["vectors"]:
    out["vectors"].append([canonical_json(e),
        json.dumps(e, ensure_ascii=False, separators=(",", ":"), allow_nan=False)])
out["chain"] = fold(hashlib.sha256(data["domain"].encode("utf-8")).hexdigest(), data["vectors"])
# §2.1, §5.2: the worker's single pass keys by the bytes it hashes for F5; they
# must equal canonical_json's for every entry it can load.
one_pass = lambda e: json.dumps(e, ensure_ascii=False, separators=(",", ":"), allow_nan=False)
out["single_pass"] = [one_pass(e) == canonical_json(e)
                      for e in data["vectors"]
                      + [e for t in data["segments"] for e in json.loads(t)["entries"]]]
# On the load shapes canonical_json may not complete: json_safe recurses per
# level, past Python's recursion limit on an entry nested about 1,000 deep.
# The single pass runs outside the try, so a RecursionError of its own fails
# the run instead of reading as canonical_json's (BB8 6693638249).
def shape_pass(e):
    one = one_pass(e)
    try:
        return [one, one == canonical_json(e)]
    except RecursionError:
        return [one, None]
out["shape_pass"] = [shape_pass(e) for e in data["shapes"]]
for text in data["segments"]:
    seg = json.loads(text)
    again = json.dumps(seg, ensure_ascii=False, separators=(",", ":"))
    out["segments"].append([again == text, hashlib.sha256(again.encode("utf-8")).hexdigest(),
                            fold(seg["digest_before"], seg["entries"])])
# Option 2's witness: filter the terminal suffix, resolve, fold (contract §6.9).
# The suffix runs contiguously to the end: this method's terminal records and
# their detail parts, which resolve_detail_records itself checks; the only
# defect it may leave is the last terminal record still partial.
from library.analysis import resolve_detail_records
w = data["witness"]
stream, method, wit = w["stream"], w["method"], w["witness"]
def split(stream):
    term = lambda r: r.get("kind") == "method_result" and r.get("method_id") == method
    k = next((i for i, r in enumerate(stream) if term(r)), len(stream))
    suffix = stream[k:]
    if not all(term(r) or (r.get("kind") == "detail_part" and r.get("method_id") == method)
               for r in suffix):
        return k, False
    try:
        for _ in resolve_detail_records(suffix):
            pass
    except ValueError as exc:
        if str(exc) != "RESULT_EXPIRED: final detail record is incomplete":
            return k, False
    return k, True
def get(r, name):
    for part in name.split("."):
        r = r.get(part) if isinstance(r, dict) else None
    return r
def witness_of(stream):
    k, ok = split(stream)
    records = list(resolve_detail_records(stream[:k]))
    tuples = [[get(r, f) for f in wit["fields"]] for r in records]
    return ok, [len(tuples), fold(hashlib.sha256(w["domain"].encode("utf-8")).hexdigest(), tuples)]
out["suffix_ok"], out["witness"] = witness_of(stream)
try:
    list(resolve_detail_records(stream))
    out["whole_stream"] = "resolved"
except ValueError as exc:
    out["whole_stream"] = str(exc).split(":", 1)[0]
# The terminal suffix's mutants refuse; its controls are accepted, and resolve whole.
out["suffix_cases"] = []
for case in data["suffix_cases"]:
    try:
        ok, got = witness_of(case["stream"])
        accepted = ok and got == [wit["count"], wit["digest"]]
    except ValueError:
        accepted = False
    resolves = None
    if accepted:
        try:
            list(resolve_detail_records(case["stream"]))
            resolves = True
        except ValueError:
            resolves = False
    out["suffix_cases"].append([case["name"], accepted, resolves])
# The terminal suffix after a resume (BB8 6678702125, ruling 3; 3PO 6678848728):
# the worker's reading, and the generic resolver alone over everything after the
# boundary, which may leave only the last terminal record partial.
out["resume_cases"] = []
for case in data["resume_cases"]:
    try:
        ok, got = witness_of(case["stream"])
        accepted = ok and got == [wit["count"], wit["digest"]]
    except ValueError:
        accepted = False
    try:
        list(resolve_detail_records(case["stream"][case["boundary"]:]))
        generic = "accepts"
    except ValueError as exc:
        generic = "accepts" if str(exc) == "RESULT_EXPIRED: final detail record is incomplete" else "refuses"
    out["resume_cases"].append([case["name"], accepted, generic])
# §3.1's inputs, read from the registry and the source at this head.
import re
from quality import relations as RL
from library import analysis as A
from library.contracts import method_id
def methods_of(lang):
    out_ = ["coordinates", "form", "language"]
    out_ += [method_id("native", lang + "." + n) for n in A.NATIVE_WORK_METHODS[lang]]
    out_.append(method_id("native", lang + ".relations"))
    out_ += [method_id("schema", n) for n in RL.REGISTRY]
    out_ += [method_id("shared_sound", A.shared_sound_name(k)) for k in A.SHARED_SOUND_METHODS]
    return set(out_)
per = [methods_of(lang) for lang in A.NATIVE_WORK_METHODS]
src = open(A.__file__, encoding="utf-8").read()
keys = set(re.findall(r'counts\\["(\\w+)"\\]\\s*=', src)) | set(re.findall(r'delta\\["(\\w+)"\\]', src))
keys |= set(re.findall(r'"(\\w+)": 0', re.search(r"delta = \\{(.*?)\\}", src, re.S).group(1)))
keys |= set(re.findall(r'key = "(\\w+)" if .* else "(\\w+)"', src)[0])
out["registry"] = {
    "methods": max(len(m) for m in per),
    "method_id_bytes": max(len(x.encode("utf-8")) for m in per for x in m),
    "schemas": len(RL.REGISTRY),
    "schema_name_bytes": max(len(n.encode("utf-8")) for n in RL.REGISTRY),
    "edge_combos": A.AnalysisSession.EDGE_COMBOS,
    "mini_cap": A.AnalysisSession.MINI_CAP,
    "count_keys": sorted(keys),
    "incomplete_writers": len(re.findall(r"self\\._incomplete\\[name\\] =|self\\._incomplete\\.setdefault\\(name,", src)),
    "templates": [t in src for t in data["incomplete_templates"]],
    # The phases a cursor names: each task's phase, and "complete" (analysis.py:_advance).
    "phases": sorted(set(re.findall(r'self\\.tasks\\.append\\(\\("(\\w+)",', src))
                     | set(re.findall(r'self\\.tasks = \\[\\("(\\w+)",', src))
                     | set(re.findall(r'if i < len\\(self\\.tasks\\) else "(\\w+)"', src))),
    # The values a method's coverage takes.
    "coverage": sorted(set(re.findall(r'counts\\["coverage"\\] = "(\\w+)"', src))
                       | set(re.findall(r'counts\\.get\\("coverage", "(\\w+)"\\)', src))),
    # The cursor's counters (analysis.py:AnalysisSession.__init__).
    "counters": re.findall(r'"(\\w+)": 0', re.search(r'"counters": \\{(.*?)\\}', src, re.S).group(1)),
}
# The fields the domain reducer reads (analysis.py:_domain_tally): the witness
# holds them, beside the method and record ids.
import inspect
tally = inspect.getsource(A.AnalysisSession._domain_tally)
fields = set(re.findall(r'record\\.get\\("(\\w+)"\\)', tally))
roles = re.search(r'for k in \\(("\\w+"), ("\\w+")\\)', tally)
sub = re.search(r'\\.get\\("(\\w+)"\\) or \\(\\)', tally)
if roles and sub:
    fields |= {json.loads(r) + "." + sub.group(1) for r in roles.groups()}
out["registry"]["tally_fields"] = sorted(fields)
# §8: every RESOURCE_LIMIT raise in the modules the reader reaches, statically
# (function-local imports included), by module and enclosing function.
import ast, os
root = sys.argv[1]
def module_file(name):
    for cand in (os.path.join(root, *name.split(".")) + ".py",
                 os.path.join(root, *name.split("."), "__init__.py")):
        if os.path.isfile(cand):
            return cand
    return None
seen_mods, stack = {}, ["library.analysis"]
while stack:
    name = stack.pop()
    f = module_file(name)
    if not f or f in seen_mods:
        continue
    seen_mods[f] = name
    tree = ast.parse(open(f, encoding="utf-8").read())
    pkg = name if f.endswith("__init__.py") else name.rpartition(".")[0]
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            stack += [a.name for a in node.names]
        elif isinstance(node, ast.ImportFrom):
            base = node.module or ""
            if node.level:
                parts = pkg.split(".") if pkg else []
                parts = parts[:len(parts) - node.level + 1]
                base = ".".join([p for p in parts if p] + ([base] if base else []))
            stack.append(base)
            stack += [base + "." + a.name if base else a.name for a in node.names]
sites = []
for f, name in seen_mods.items():
    tree = ast.parse(open(f, encoding="utf-8").read())
    funcs = [n for n in ast.walk(tree) if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef))]
    for node in ast.walk(tree):
        text = None
        if isinstance(node, ast.Constant) and isinstance(node.value, str):
            text = node.value
        elif isinstance(node, ast.JoinedStr) and node.values and isinstance(node.values[0], ast.Constant):
            text = node.values[0].value
        if text is None or not text.startswith("RESOURCE_LIMIT"):
            continue
        inner = [fn for fn in funcs if fn.lineno <= node.lineno <= fn.end_lineno]
        fn = max(inner, key=lambda fn: fn.lineno).name if inner else None
        cause = re.match(r"RESOURCE_LIMIT\\[([a-z0-9_]+)(?:,[a-z_]+)?\\]:", text)
        sites.append([os.path.relpath(f, root).replace(os.sep, "/"), fn, cause.group(1) if cause else None])
out["raise_sites"] = sorted(sites)
out["reached_modules"] = len(seen_mods)
out["cursor"] = [canonical_json(c) == t for c, t in data["cursors"]]
# The float fixture as a Python worker reads it: 1.0 is a float, not an entry.
with open(data["float_fixture"], encoding="utf-8") as f:
    seal = json.load(f)["frames"][0]["discovery"]["seals"][0]
e = seal["entries"][1]
out["float"] = [type(e).__name__, canonical_json(e),
                fold(seal["digest_before"], seal["entries"]) == seal["digest_after"]]
sys.stdout.buffer.write(json.dumps(out).encode("ascii"))
`;
  const run = spawnSync('python3', ['-I', '-c', program, path.join(ROOT, 'lyric-harness')], {
    input: Buffer.from(JSON.stringify(input), 'utf8'),
    maxBuffer: 16 * 1024 * 1024,
  });
  assert.equal(run.error, undefined, `python3 runs (${run.error?.message})`);
  assert.equal(run.status, 0, run.stderr?.toString());
  return JSON.parse(run.stdout.toString('ascii'));
}

// §3.2 (BB8 6684866461): every refusal the adapter can put in a cursor, read
// from the source without the dictionary. The program walks analysis.py's
// writes of a "refusal" key and its _Refused raises, follows each raise that
// passes on an engine-built refusal to its relations.py function and walks the
// call closure there for every Refusal and NoReferent it can build; bounds every
// variable part by evaluating it over the registry (counts at sys.maxsize);
// builds the largest refusal of each construction; and runs the real
// _candidates, _full_shape and _stub_resolved_stream on a stream whose frames
// carry a source label of each size in input.labels.
const REFUSAL_PROGRAM = String.raw`import ast, builtins, dataclasses, itertools, json, os, sys
sys.path.insert(0, sys.argv[1])
from quality import relations as RL
from library import analysis as A
from library.contracts import canonical_json, json_safe
from library.registry import REMEDIES, SHARED_SOUND_METHODS, shared_sound_name
data = json.loads(sys.stdin.buffer.read().decode("utf-8"))
MODULES = {"library/analysis.py": A, "quality/relations.py": RL}
TREES = {m: ast.parse(open(mod.__file__, encoding="utf-8").read()) for m, mod in MODULES.items()}
def functions(tree):
    out = {}
    for n in ast.walk(tree):
        if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef)):
            out.setdefault(n.name, n)
    return out
AF, RF = functions(TREES["library/analysis.py"]), functions(TREES["quality/relations.py"])
for tree in TREES.values():
    for n in ast.walk(tree):
        for c in ast.iter_child_nodes(n):
            c._parent = n
def statement(n):
    while not isinstance(n, ast.stmt):
        n = n._parent
    return n
def in_target(n, st):
    targets = st.targets if isinstance(st, ast.Assign) else \
        [st.target] if isinstance(st, (ast.AugAssign, ast.AnnAssign)) else []
    return any(n is x for t in targets for x in ast.walk(t))
def named(f, name):
    return (isinstance(f, ast.Name) and f.id == name) or (isinstance(f, ast.Attribute) and f.attr == name)
def within(fn_nodes, node):
    best = None
    for n in fn_nodes:
        if n.lineno <= node.lineno <= n.end_lineno and (best is None or n.lineno > best.lineno):
            best = n
    return best.name if best else None
def either(v):
    if isinstance(v, ast.IfExp) and isinstance(v.body, ast.Constant) and isinstance(v.orelse, ast.Constant):
        return ["either", [v.body.value, v.orelse.value], ast.unparse(v.test)]
    return None
def piece(x):
    if isinstance(x, ast.Constant):
        return ["text", x.value]
    if isinstance(x, ast.FormattedValue):
        e = either(x.value)
        if e and x.conversion == -1:
            return e
        return ["value", ast.unparse(x.value) + ("!r" if x.conversion == 114 else "")]
    return ["value", ast.unparse(x)]
def part(v):
    if isinstance(v, ast.Constant):
        return ["const", v.value]
    if isinstance(v, (ast.Tuple, ast.List)) and all(isinstance(e, ast.Constant) for e in v.elts):
        return ["const", [e.value for e in v.elts]]
    if either(v):
        return either(v)
    if isinstance(v, ast.JoinedStr):
        return ["text", [piece(x) for x in v.values]]
    if isinstance(v, ast.BinOp) and isinstance(v.op, ast.Add):
        seq = []
        def flat(n):
            if isinstance(n, ast.BinOp) and isinstance(n.op, ast.Add):
                flat(n.left)
                flat(n.right)
            elif isinstance(n, ast.JoinedStr):
                seq.extend(piece(x) for x in n.values)
            else:
                seq.append(piece(n))
        flat(v)
        return ["text", seq]
    return ["expr", ast.unparse(v)]
FIELDS = dataclasses.fields(RL.Refusal)
def refusal(call):
    got = {}
    for f, a in zip(FIELDS, call.args):
        got[f.name] = part(a)
    for k in call.keywords:
        got[k.arg] = part(k.value)
    for f in FIELDS:
        if f.name not in got:
            got[f.name] = ["const", json_safe(f.default)]
    return got
# 1. Where a cursor's refusal comes from: every write of a "refusal" key and
# every _Refused raise in the adapter.
sites, raised = [], []
afn = [n for n in ast.walk(TREES["library/analysis.py"]) if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef))]
for node in ast.walk(TREES["library/analysis.py"]):
    if isinstance(node, (ast.Call, ast.Assign)):
        where = {"module": "library/analysis.py", "function": within(afn, node)}
    if isinstance(node, ast.Call) and named(node.func, "_Refused"):
        arg = node.args[0]
        if isinstance(arg, ast.Call) and named(arg.func, "Refusal"):
            sites.append({**where, "construction": "refusal", "parts": refusal(arg)})
        else:
            raised.append({**where, "value": ast.unparse(arg)})
    if isinstance(node, ast.Assign):
        for t in node.targets:
            if isinstance(t, ast.Subscript) and isinstance(t.slice, ast.Constant) and t.slice.value == "refusal":
                v = node.value
                if isinstance(v, ast.Dict):
                    sites.append({**where, "construction": "literal",
                                  "parts": {k.value: part(x) for k, x in zip(v.keys, v.values)}})
                else:
                    raised.append({**where, "value": ast.unparse(v), "stores": True})
# What each raise of an engine-built refusal passes on: the relations.py
# function whose result it is, followed through one adapter method.
def source_of(fn, name):
    for n in ast.walk(AF[fn]):
        if isinstance(n, ast.Assign) and any(isinstance(t, ast.Name) and t.id == name for t in n.targets) \
                and isinstance(n.value, ast.Call):
            f = n.value.func
            if isinstance(f, ast.Attribute) and ast.unparse(f.value) == "RL":
                return f.attr
            if isinstance(f, ast.Attribute) and ast.unparse(f.value) == "self" and f.attr in AF:
                rets = [r for r in ast.walk(AF[f.attr]) if isinstance(r, ast.Return) and isinstance(r.value, ast.Call)]
                if len(rets) == 1 and ast.unparse(rets[0].value.func).startswith("RL."):
                    return ast.unparse(rets[0].value.func)[3:]
    return None
for r in raised:
    if not r.get("stores"):
        r["from"] = source_of(r["function"], r["value"])
# The span refusal's detail is str() of a NoReferent from the try it is raised in.
def no_referent_sources():
    out = []
    for t in ast.walk(AF["_candidates"]):
        if isinstance(t, ast.Try) and any(h.type is not None and ast.unparse(h.type) == "RL.NoReferent" for h in t.handlers):
            for n in ast.walk(ast.Module(body=t.body, type_ignores=[])):
                if isinstance(n, ast.Attribute) and isinstance(n.value, ast.Name) and n.value.id == "RL" \
                        and n.attr in RF:
                    out.append(n.attr)
    return sorted(set(out))
spans_from = no_referent_sources()
def closure(roots):
    seen, stack = set(), list(roots)
    while stack:
        x = stack.pop()
        if x in seen or x not in RF:
            continue
        seen.add(x)
        stack += [n.id for n in ast.walk(RF[x])
                  if isinstance(n, ast.Name) and isinstance(n.ctx, ast.Load) and n.id in RF]
    return seen
builders = closure([r["from"] for r in raised if r.get("from")])
for name in sorted(builders):
    for node in ast.walk(RF[name]):
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id == "Refusal":
            sites.append({"module": "quality/relations.py", "function": name, "construction": "refusal",
                          "parts": refusal(node)})
messages = []
for name in sorted(closure(spans_from)):
    for node in ast.walk(RF[name]):
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id == "NoReferent":
            messages.append({"module": "quality/relations.py", "function": name, "message": part(node.args[0])})
order = lambda s: json.dumps(s, sort_keys=True, ensure_ascii=False)
sites.sort(key=order)
messages.sort(key=order)
raised.sort(key=order)
# Every other place the adapter names a refusal, in any form: the key
# "refusal" (a subscript, a dict key, a call's argument), a keyword refusal=,
# an attribute .refusal. Each is listed with the statement it sits in, so a
# write in a form the walk above does not read (setdefault, update, +=, a
# second statement) is a new entry, and the validator fails on it.
A_TREE = TREES["library/analysis.py"]
names = []
for n in ast.walk(A_TREE):
    form = text = ctx = None
    if isinstance(n, ast.Constant) and n.value == "refusal":
        p = n._parent
        if isinstance(p, ast.Subscript) and p.slice is n:
            form, text, ctx = "subscript", ast.unparse(p), type(p.ctx).__name__
        elif isinstance(p, ast.Dict) and any(k is n for k in p.keys):
            form, text = "dict_key", ast.unparse(p)
        elif isinstance(p, ast.Call) and any(a is n for a in p.args):
            form, text = "call_argument", ast.unparse(p)
        else:
            form, text = "other", ast.unparse(p)
    elif isinstance(n, ast.keyword) and n.arg == "refusal":
        form, text = "keyword", ast.unparse(n._parent.func) + "(refusal=" + ast.unparse(n.value) + ")"
    elif isinstance(n, ast.Attribute) and n.attr == "refusal":
        form, text, ctx = "attribute", ast.unparse(n), type(n.ctx).__name__
    if form:
        st = statement(n)
        names.append({"function": within(afn, n), "form": form, "context": ctx, "statement": type(st).__name__,
                      "target": in_target(n, st), "text": text})
names.sort(key=order)
# _Refused is raised, caught and defined, and used in no other way: an alias,
# a subclass or a stored instance would raise a refusal the walk cannot see.
refused_uses, refused_misuse = {"raise": 0, "except": 0}, []
for n in ast.walk(A_TREE):
    if isinstance(n, ast.Name) and n.id == "_Refused":
        p = n._parent
        if isinstance(p, ast.Call) and p.func is n and isinstance(p._parent, ast.Raise) and p._parent.exc is p:
            refused_uses["raise"] += 1
            continue
        h = p if isinstance(p, ast.ExceptHandler) else \
            p._parent if isinstance(p, ast.Tuple) and isinstance(p._parent, ast.ExceptHandler) else None
        if h is not None and (h.type is n or h.type is p):
            refused_uses["except"] += 1
            continue
        refused_misuse.append({"module": "library/analysis.py", "function": within(afn, n),
                               "text": ast.unparse(statement(n))})
    elif isinstance(n, ast.Attribute) and n.attr == "_Refused":
        refused_misuse.append({"module": "library/analysis.py", "function": within(afn, n),
                               "text": ast.unparse(statement(n))})
classes = [n for n in ast.walk(A_TREE) if isinstance(n, ast.ClassDef) and n.name == "_Refused"]
refused_uses["class"] = len(classes)
# No other module under library/ or quality/ names it.
for sub in ("library", "quality"):
    for dirpath, dirs, files in os.walk(os.path.join(sys.argv[1], sub)):
        dirs.sort()
        for f in sorted(files):
            path = os.path.join(dirpath, f)
            rel = os.path.relpath(path, sys.argv[1]).replace(os.sep, "/")
            if not f.endswith(".py") or rel == "library/analysis.py":
                continue
            src = open(path, encoding="utf-8").read()
            if "_Refused" in src:
                refused_misuse.append({"module": rel, "function": None, "text": "_Refused"})
# Every call in the engine functions that could copy a refusal with a field
# changed, or set one: replace, setattr, __replace__, __setattr__.
mutators = []
for name in sorted(builders | closure(spans_from)):
    for n in ast.walk(RF[name]):
        if isinstance(n, ast.Call):
            f = n.func
            if (isinstance(f, ast.Name) and f.id in ("replace", "setattr")) or \
                    (isinstance(f, ast.Attribute) and f.attr in ("replace", "__replace__", "__setattr__")):
                a0 = n.args[0] if n.args else None
                first = None if a0 is None else ast.unparse(a0) if isinstance(a0, (ast.Name, ast.Attribute, ast.Constant)) \
                    else ast.unparse(a0.func) + "(...)" if isinstance(a0, ast.Call) else type(a0).__name__
                mutators.append({"function": name, "call": ast.unparse(f), "first": first})
mutators.sort(key=order)
# 2. The bound of every variable part: each expression evaluated over the
# domain of its one free name, from the registry; integers by sys.maxsize.
schemas = list(RL.REGISTRY.values())
# A capability refusal is built only when something is missing (if missing:),
# and what is missing is any subsequence of a schema's capabilities, in their
# order; what is empty is any subsequence of that.
def subsequences(xs, least):
    return [c for r in range(least, len(xs) + 1) for c in itertools.combinations(xs, r)]
missing_any = [m for s in schemas for m in subsequences(tuple(s.capabilities()), 1)]
vacuous_any = [v for s in schemas for v in subsequences(tuple(s.capabilities()), 0)]
rules = [r for s in schemas for r in s.spans]
DOMAINS = {
    "name": [s.name for s in schemas], "schema": schemas,
    "missing": missing_any, "miss": missing_any, "vacuous": vacuous_any, "vac": vacuous_any,
    "key": list(SHARED_SOUND_METHODS), "rule": rules, "a": [r.anchor for r in rules],
    "self": [A.AnalysisSession],
}
GLOBALS = {"REMEDIES": REMEDIES, "shared_sound_name": shared_sound_name}
N = 2 * sys.maxsize
INTEGERS = {
    "len(toks) + len(missing)": N, "total": N * (N - 1) // 2,
    "rep['stubs']": sys.maxsize, "len(rep['ambiguous'])": sys.maxsize,
    "len(rep['unmatched'])": sys.maxsize, "len(rep['no_incipit'])": sys.maxsize,
    "skipped": sys.maxsize,
}
INPUTS = {"self._incomplete[name]": data["incomplete_reason"]}
size = lambda v: len(canonical_json(v).encode("utf-8"))
def longest(xs):
    return max(xs, key=lambda x: (size(x), canonical_json(x)))
unbounded = []
def bound(k):
    if k in INTEGERS:
        return str(INTEGERS[k])
    if k in INPUTS:
        return INPUTS[k]
    text, conv = (k[:-2], repr) if k.endswith("!r") else (k, None)
    tree = ast.parse(text, mode="eval")
    stored = {n.id for n in ast.walk(tree) if isinstance(n, ast.Name) and isinstance(n.ctx, ast.Store)}
    free = {n.id for n in ast.walk(tree) if isinstance(n, ast.Name) and isinstance(n.ctx, ast.Load)} \
        - stored - set(GLOBALS) - set(dir(builtins))
    if len(free) != 1 or not free <= set(DOMAINS):
        unbounded.append(k)
        return None
    var = free.pop()
    code = compile(tree, k, "eval")
    try:
        vals = [eval(code, dict(GLOBALS), {var: v}) for v in DOMAINS[var]]
        vals = [conv(v) if conv else json_safe(v) for v in vals]
    except Exception:
        # A part the registry cannot evaluate reads something else: no bound.
        unbounded.append(k)
        return None
    return longest(vals)
keys = set()
def collect(p):
    if p[0] == "expr":
        keys.add(p[1])
    if p[0] == "text":
        keys.update(x[1] for x in p[1] if x[0] == "value")
for s in sites:
    for p in s["parts"].values():
        collect(p)
for m in messages:
    collect(m["message"])
keys.discard("str(exc)")
bounds = {k: bound(k) for k in sorted(keys)}
def value(p, bounds):
    if p[0] == "const":
        return p[1]
    if p[0] == "either":
        return max(p[1], key=lambda s: (len(s.encode("utf-8")), s))
    if p[0] == "expr":
        return bounds[p[1]]
    out = ""
    for x in p[1]:
        if x[0] == "text":
            out += x[1]
        elif x[0] == "either":
            out += value(x, bounds)
        else:
            v = bounds[x[1]]
            out += v if isinstance(v, str) else str(v)
    return out
if not unbounded:
    bounds["str(exc)"] = longest([value(m["message"], bounds) for m in messages])
    built = [{f: value(p, bounds) for f, p in s["parts"].items()} for s in sites]
    sizes = [size(r) for r in built]
    largest = longest(built)
else:
    sizes, largest = [], None
# 2b. The same constructions built schema by schema: every part from one
# schema's own name, capabilities and span rules, with every non-empty
# subsequence of its capabilities missing and every subsequence of those empty,
# over the schemas whose guard (the condition before the construction in the
# source) selects it. Still an upper bound per schema; it is how 3PO and the
# review measured, and why their figures are smaller than the column above,
# which takes each part's longest value over the whole registry independently.
SCHEMA_NAMES = {"name", "schema", "missing", "miss", "vacuous", "vac", "rule", "a"}
JUDGES = RL.TOKEN_MEMBER_JUDGES + RL.TEMPLATE_JUDGES
GUARDS = {
    ("library/analysis.py", "_candidates", "beat"):
        ("'beat' in schema.capabilities()", lambda s: "beat" in s.capabilities()),
    ("library/analysis.py", "_candidates", "missing[0]"):
        ("if missing:", lambda s: bool(s.capabilities())),
    ("library/analysis.py", "_candidates", "span"):
        ("if name in RL.FULL_SHAPES:", lambda s: s.name not in RL.FULL_SHAPES),
    ("quality/relations.py", "_full_shape", "miss[0]"):
        ("if schema.judge in TOKEN_MEMBER_JUDGES + TEMPLATE_JUDGES:",
         lambda s: s.judge in RL.FULL_JUDGES and s.judge in JUDGES),
    ("quality/relations.py", "_full_shape", "figure"):
        ("if schema.judge not in FULL_JUDGES:", lambda s: s.judge not in RL.FULL_JUDGES),
    ("quality/relations.py", "_full_shape", "stanza"):
        ("if schema.figure.frame == 'stanza' and (not stream.provides('stanza')):",
         lambda s: s.judge in RL.FULL_JUDGES and s.judge not in JUDGES and s.figure.frame == "stanza"),
}
def free_of(text):
    tree = ast.parse(text[:-2] if text.endswith("!r") else text, mode="eval")
    stored = {n.id for n in ast.walk(tree) if isinstance(n, ast.Name) and isinstance(n.ctx, ast.Store)}
    return {n.id for n in ast.walk(tree) if isinstance(n, ast.Name) and isinstance(n.ctx, ast.Load)} \
        - stored - set(GLOBALS) - set(dir(builtins))
def exprs(p):
    if p[0] == "expr":
        return [p[1]]
    if p[0] == "either":
        return [p[2]]
    if p[0] == "text":
        return [x[1] if x[0] == "value" else x[2] for x in p[1] if x[0] in ("value", "either")]
    return []
def jeval(k, env):
    if k in INTEGERS:
        return str(INTEGERS[k])
    if k in INPUTS:
        return INPUTS[k]
    if not free_of(k) <= set(env):
        return bounds[k]
    text, conv = (k[:-2], repr) if k.endswith("!r") else (k, None)
    v = eval(compile(text, k, "eval"), dict(GLOBALS), dict(env))
    return conv(v) if conv else json_safe(v)
def jvalue(p, env):
    if p[0] == "const":
        return p[1]
    if p[0] == "either":
        return p[1][0] if eval(p[2], dict(GLOBALS), dict(env)) else p[1][1]
    if p[0] == "expr":
        return env["str(exc)"] if p[1] == "str(exc)" else jeval(p[1], env)
    out = ""
    for x in p[1]:
        if x[0] == "text":
            out += x[1]
        elif x[0] == "either":
            out += jvalue(x, env)
        else:
            v = jeval(x[1], env)
            out += v if isinstance(v, str) else str(v)
    return out
def envs(s, free):
    caps = tuple(s.capabilities())
    for m in (subsequences(caps, 1) if free & {"missing", "miss"} else [None]):
        for v in (subsequences(m, 0) if m is not None and free & {"vacuous", "vac"} else [None]):
            env = {"name": s.name, "schema": s}
            if m is not None:
                env.update(missing=m, miss=m)
            if v is not None:
                env.update(vacuous=v, vac=v)
            if "str(exc)" in free:
                # The span refusal's message, from this schema's own rules.
                msgs = [jvalue(mm["message"], {"rule": r, "a": r.anchor})
                        for r in s.spans for mm in messages]
                env["str(exc)"] = longest(msgs)
            yield env
unguarded, per_schema = [], []
for s_ in (sites if not unbounded else []):
    free = set()
    for p in s_["parts"].values():
        for k in exprs(p):
            # A count is at sys.maxsize and the incomplete reason is the input,
            # whatever the schema; neither is a schema's own part.
            if k not in INTEGERS and k not in INPUTS:
                free |= {"str(exc)"} if k == "str(exc)" else free_of(k)
    if not free & (SCHEMA_NAMES | {"str(exc)"}):
        per_schema.append(None)
        continue
    cap = s_["parts"]["capability"]
    key = (s_["module"], s_["function"], cap[1])
    if key not in GUARDS or GUARDS[key][0] not in ast.unparse(
            (AF if s_["module"] == "library/analysis.py" else RF)[s_["function"]]):
        unguarded.append(list(key))
        per_schema.append(None)
        continue
    best = None
    for sch in schemas:
        if not GUARDS[key][1](sch):
            continue
        for env in envs(sch, free):
            r = {f: jvalue(p, env) for f, p in s_["parts"].items()}
            if best is None or size(r) > best[0]:
                best = (size(r), sch.name)
    per_schema.append({"bytes": best[0], "schema": best[1]})
# 3. The declared label never reaches a refusal: the frame sources the adapter
# sets, and every refusal it builds with a frame source of each label size.
frame_sources, source_reads = [], []
for n in ast.walk(AF["_apply_declarations"]):
    if isinstance(n, ast.Assign):
        for t in n.targets:
            targets = t.elts if isinstance(t, ast.Tuple) else [t]
            values = n.value.elts if isinstance(n.value, ast.Tuple) and isinstance(t, ast.Tuple) else [n.value]
            for tt, vv in zip(targets, values):
                if isinstance(tt, ast.Attribute) and tt.attr.endswith("_source"):
                    frame_sources.append([tt.attr, vv.value if isinstance(vv, ast.Constant) else ast.unparse(vv)])
    if isinstance(n, ast.UnaryOp) and isinstance(n.op, ast.Not):
        for c in ast.walk(n.operand):
            c.parent_not = True
# Every read of a declaration's source, by .get("source"), ["source"] or
# .source: under not (only to require one), or passed on, with where it goes.
for n in ast.walk(AF["_apply_declarations"]):
    read = None
    if isinstance(n, ast.Call) and isinstance(n.func, ast.Attribute) and n.func.attr == "get" \
            and n.args and isinstance(n.args[0], ast.Constant) and n.args[0].value == "source":
        read = "get"
    elif isinstance(n, ast.Subscript) and isinstance(n.slice, ast.Constant) and n.slice.value == "source":
        read = "subscript"
    elif isinstance(n, ast.Attribute) and n.attr == "source" and isinstance(n.ctx, ast.Load):
        read = "attribute"
    if read:
        p_ = n._parent
        use = "not" if getattr(n, "parent_not", False) else \
            ast.unparse(p_._parent.func) + "(" + p_.arg + "=)" if isinstance(p_, ast.keyword) else ast.unparse(statement(n))
        source_reads.append([read, ast.unparse(n), use])
source_reads.sort()
# The beatgrid's source goes into BeatGrid.source and on to declare_beat; what
# declare_beat reads of it, through _beat_from_grid: never its source.
beat_source_reads = [[name, ast.unparse(n)] for name in ("declare_beat", "_beat_from_grid")
                     for n in ast.walk(RF[name])
                     if (isinstance(n, ast.Attribute) and n.attr == "source")
                     or (isinstance(n, ast.Call) and isinstance(n.func, ast.Name) and n.func.id == "getattr"
                         and len(n.args) > 1 and isinstance(n.args[1], ast.Constant) and n.args[1].value == "source")]
class Stream:
    def __init__(self, label, state):
        self.label, self.state = label, state
        self.lines, self.lexical_tokens, self.line_stanzas, self.line_status = [], (), (), ()
        self.units, self.tokens, self.text_lines = [], {}, []
    def supply(self, c):
        return RL.Supply(c, self.state, 0, self.label, self.label)
    def provides(self, c):
        return False
class LineStream:
    """A stream whose line_status is read by the real Stream.supply, so the
    state it reports is the one a real stream with that line_status reports."""
    frames = None
    _frame_supply = RL.Stream._frame_supply
    def __init__(self, line_status):
        self.line_status = line_status
        self.lines, self.units, self.tokens, self.text_lines = [], [], {}, []
    def supply(self, c):
        return RL.Stream.supply(self, c)
class Session:
    RL = RL
    _beat_placed = None
def canon(r):
    return canonical_json(json_safe(r))
runs, run_errors = {}, []
def attempt(family, fn):
    # A builder that raises on the stand-in reads more than this section
    # lists: the validator reports it, rather than a traceback.
    try:
        return fn()
    except A._Refused:
        raise
    except Exception as exc:
        run_errors.append([family, type(exc).__name__, str(exc)[:200]])
        return None
for n in data["labels"]:
    label = "x" * n
    got = {"candidates": [], "full_shape": [], "stub_resolution": []}
    for name, schema in RL.REGISTRY.items():
        if schema.capabilities():
            s = Session()
            s.stream = Stream(label, "empty")
            try:
                attempt("candidates", lambda: next(A.AnalysisSession._candidates(s, name)))
            except A._Refused as exc:
                got["candidates"].append(canon(exc.refusal))
        r = attempt("full_shape", lambda: RL._full_shape(schema, Stream(label, "empty")))
        if isinstance(r, RL.Refusal):
            got["full_shape"].append(canon(r))
    # Declared line statuses: none, one empty, one that is the label.
    for status in ((), ("",), (label,)):
        r = attempt("stub_resolution", lambda: RL._stub_resolved_stream(LineStream(status)))
        if isinstance(r, RL.Refusal):
            got["stub_resolution"].append(canon(r))
    runs[str(n)] = got
# search_stub_resolution builds its line_status refusal only when no line_status
# is declared and no is_stub is passed; _stub_resolved_stream calls it only when
# supply("line_status") is present, which a real stream reports only for a
# non-empty line_status with a non-empty label. Called directly it builds it;
# through the dispatch, from any line_status, it never does.
reach = {"direct": canon(RL.search_stub_resolution(LineStream(()))),
         "line_status": {"[]": RL.Stream.supply(LineStream(()), "line_status").state,
                         "['']": RL.Stream.supply(LineStream(("",)), "line_status").state,
                         "['x']": RL.Stream.supply(LineStream(("x",)), "line_status").state},
         "guard": [ast.unparse(n.test) for n in ast.walk(RF["_stub_resolved_stream"]) if isinstance(n, ast.If)]}
out = {"sites": sites, "raised": raised, "spans_from": spans_from, "messages": messages,
       "bounds": bounds, "unbounded": unbounded, "sizes": sizes, "largest": largest,
       "frame_sources": sorted(frame_sources), "source_reads": source_reads, "runs": runs,
       "maxsize": str(sys.maxsize), "names": names, "refused_uses": refused_uses,
       "refused_misuse": refused_misuse, "mutators": mutators, "per_schema": per_schema,
       "unguarded": unguarded, "beat_source_reads": beat_source_reads, "reach": reach,
       "run_errors": run_errors}
sys.stdout.buffer.write(json.dumps(out, ensure_ascii=True).encode("ascii"))
`;
function refusalPython(input) {
  const run = spawnSync(
    'python3',
    ['-I', '-c', REFUSAL_PROGRAM, path.join(ROOT, 'lyric-harness')],
    {
      input: Buffer.from(JSON.stringify(input), 'utf8'),
      maxBuffer: 64 * 1024 * 1024,
    }
  );
  assert.equal(run.error, undefined, `python3 runs (${run.error?.message})`);
  assert.equal(run.status, 0, run.stderr?.toString());
  return JSON.parse(run.stdout.toString('ascii'));
}
// One part of a refusal construction, at its bound: a constant; the longer of
// two constants; a variable part, from the bounds; or text joined from those.
function partValue(p, bounds) {
  if (p[0] === 'const') return p[1];
  if (p[0] === 'either')
    return p[1].reduce((a, b) => (Buffer.byteLength(b) > Buffer.byteLength(a) ? b : a));
  if (p[0] === 'expr') {
    assert.ok(Object.hasOwn(bounds, p[1]), `${p[1]} has a bound (§3.2)`);
    return bounds[p[1]];
  }
  assert.equal(p[0], 'text', `a part is const, either, expr or text: ${p[0]}`);
  return p[1]
    .map((x) => {
      if (x[0] === 'text') return x[1];
      if (x[0] === 'either') return partValue(x, bounds);
      assert.ok(Object.hasOwn(bounds, x[1]), `${x[1]} has a bound (§3.2)`);
      return String(bounds[x[1]]);
    })
    .join('');
}
const buildRefusal = (site, bounds) =>
  Object.fromEntries(Object.entries(site.parts).map(([f, p]) => [f, partValue(p, bounds)]));

// ---------------------------------------------------------------- the document
function section(heading) {
  const start = CONTRACT.indexOf(`\n## ${heading}`);
  assert.ok(start >= 0, `the contract has a "${heading}" section`);
  const end = CONTRACT.indexOf('\n## ', start + 4);
  return CONTRACT.slice(start, end < 0 ? undefined : end);
}
const tableRows = (text) =>
  text
    .split('\n')
    .filter((l) => l.startsWith('| ') && !/^\| -/.test(l))
    .slice(1)
    .map((l) => l.slice(2, -2).split(' | '));

// ================================================================ tests
const GOOD_WRITE = [
  'good/seal_sequence_two_logs.json',
  'good/epoch_jump.json',
  'good/seal_completeness.json',
];
const GOOD_GROUPS = [
  'good/retired_group_then_within_line.json',
  'good/within_line_inside_group.json',
];
const REQUIRED_MUTANTS = {
  'bad/witness_mismatch.json': [
    'deletion',
    'duplicate_insertion',
    'reorder',
    'same_count_replacement',
    'endpoint_role_swap',
    ...WITNESS_FIELDS_V1.map((f) => `field_${f.replace('.', '_')}`),
    'null_witness',
  ],
  // BB8 6678599629: the suffix is contiguous and belongs to its method alone.
  'bad/terminal_suffix_not_contiguous.json': [
    'contribution_between_parent_and_part',
    'contribution_after_suffix',
    'other_method_terminal',
    'other_method_part',
    'contribution_part_after_boundary',
    'part_before_its_parent',
    'part_after_next_terminal',
    // The parts inside the suffix, as resolve_detail_records holds them.
    'part_cut_off_by_next_terminal',
    'duplicate_part',
    'part_index_wrong',
    'part_total_wrong',
    'part_foreign_detail_id',
    'part_bytes_changed',
  ],
  // BB8 6678702125, ruling 3, and 3PO 6678848728: at each split point inside
  // a terminal emission that spans frames, five faults resolve_detail_records
  // refuses itself and three only the worker's suffix-membership check refuses.
  'bad/terminal_suffix_resume_faults.json': [
    'after_parent',
    'after_part_0',
    'after_part_1',
  ].flatMap((split) =>
    [
      'missing_part',
      'reordered_parts',
      'stale_part',
      'changed_part',
      'wrong_parent_id',
      'wrong_method_part',
      'wrong_method_parent',
      'inserted_record',
    ].map((fault) => `${split}_${fault}`)
  ),
};
// The nine 3PO found the generic resolver accepts (6678848728): the worker's
// suffix-membership check is their only refusal.
const MEMBERSHIP_ONLY = ['wrong_method_part', 'wrong_method_parent', 'inserted_record'];
// The cursor fixture's cases, exactly (the review of 2a610d053): a case left
// out would go unnoticed, since the cases are built by name.
const CURSOR_CONTROLS = ['largest', 'at_the_bound'];
const CURSOR_MUTANTS = [
  'one_byte_over',
  'refusal_one_byte_over',
  'integer_past_the_safe_range',
  'integer_below_zero',
  'number_not_an_integer',
];
REQUIRED_MUTANTS['bad/reply_cause_invalid.json'] = [
  'unavailable_without_a_cause',
  'unavailable_with_an_unknown_cause',
  'unavailable_with_a_resource_cause',
  'unavailable_with_the_store_cause',
  'resource_limit_without_a_cause',
  'resource_limit_with_an_unknown_cause',
  'resource_limit_with_an_unavailable_cause',
  'another_code_with_a_cause',
  'a_cause_past_the_echo_bound',
  'a_cause_that_is_not_a_string',
  'a_log_outside_the_set',
  'a_cause_without_its_log',
  'a_log_on_a_cause_without_one',
  'a_log_on_a_code_without_a_cause',
  'after_a_release',
];
const REQUIRED_CONTROLS = {
  'bad/reply_cause_invalid.json': [
    'unavailable_with_its_cause',
    'resource_limit_with_its_cause',
    'resident_capacity',
    'declared_coordinate_bits',
    'another_code_without_a_cause',
    'sink_resource_limit_from_packing',
    'sink_record_bound',
    'sink_discovery_unavailable',
    'bridge_failure_without_a_reply',
  ],
  // The durable prefix at each split point and the complete suffix are
  // accepted, and so is a part whose schema_name alone changes: membership is
  // method_id alone (§6.9).
  'bad/terminal_suffix_resume_faults.json': [
    'after_parent_durable',
    'after_part_0_durable',
    'after_part_1_durable',
    'complete',
    'after_part_0_schema_name_only',
  ],
};
const BAD = {
  changed_digest_after: 'F5',
  entry_over_depth: 'F1',
  head_bytes_disagree: 'R2',
  summary_bytes_disagree: 'R3',
  verified_bytes_disagree: 'R5',
  verified_bytes_ahead: 'R5',
  cursor_over_bound: 'W4',
  cursor_record_disagreement: 'W4',
  current_moved_back: 'W4',
  cursor_summary_disagreement: 'R3',
  epoch_backwards: 'W2',
  float_entry: 'F1',
  inventory_mismatch: 'R4',
  membership_over_cap: 'W7',
  missing_segment: 'R1',
  over_bound_seal: 'F4',
  premature_seal: 'F4',
  reordered_segment: 'R2',
  reply_cause_invalid: 'C1',
  reply_pause_refused: 'C1',
  reset_unheld_log: 'W3',
  retired_key_recurring: 'S1',
  segment_corrupt_at_reconciliation: 'F6',
  segment_oversized: 'F6',
  malformed_record_discovery: 'M1',
  tail_rewritten: 'W6',
  terminal_suffix_not_contiguous: 'S2',
  terminal_suffix_resume_faults: 'S2',
  verified_ahead_of_head: 'R5',
  witness_mismatch: 'S2',
};
// Per epoch and log: every sealed entry in order, then the last cursor tail of that epoch.
function chainsOf(fx, results) {
  const chains = new Map();
  fx.frames.forEach((frame, i) => {
    assert.deepEqual(frame.discovery.resets, [], 'a good write fixture resets no log');
    const epoch = frame.discovery.epoch;
    for (const s of results[i].segments) {
      const key = `${epoch}/${s.log}`;
      const chain = chains.get(key) || { sealed: [], ranges: [], tail: [] };
      chain.ranges.push([s.segment.first, s.segment.first + s.segment.count]);
      chain.sealed.push(...s.segment.entries);
      chains.set(key, chain);
    }
    for (const [log, st] of Object.entries(frame.cursor.discovery.logs)) {
      const key = `${epoch}/${log}`;
      const chain = chains.get(key) || { sealed: [], ranges: [], tail: [] };
      chain.tail = st.tail;
      chains.set(key, chain);
    }
  });
  return chains;
}

test('the README lists every fixture once, with its rule and refusal', () => {
  const rows = readmeRows();
  const files = fixtureFiles();
  assert.deepEqual(
    [...rows.keys()].sort(),
    [...files].sort(),
    'README rows and fixture files are the same set'
  );
  for (const rel of files) {
    const fx = load(rel);
    const row = rows.get(rel);
    assert.equal(fx.fixture, rel, `${rel} names itself`);
    assert.equal(fx.contract, 'mcp/DISCOVERY_V1.md');
    assert.ok(CONTRACT.includes(`\`${rel}\``), `the contract names ${rel}`);
    if (rel.startsWith('good/')) {
      assert.deepEqual(fx.expect.accepted, true, `${rel} is accepted`);
      assert.equal(row.refusal, 'none', `${rel}: README says no refusal`);
    } else {
      assert.equal(fx.expect.accepted, false, `${rel} is refused`);
      assert.deepEqual(row.rules, [fx.expect.rule], `${rel}: README names its one rule`);
      assert.equal(row.refusal, refusalText(fx.expect), `${rel}: README names its refusal`);
      const expected = REFUSAL[fx.kind][fx.expect.rule];
      assert.ok(expected, `${rel}: rule ${fx.expect.rule} is a ${fx.kind} rule`);
      for (const key of ['code', 'status', 'cause'])
        assert.equal(
          fx.expect[key],
          expected[key],
          `${rel}: ${key} is the contract's for ${fx.expect.rule}`
        );
    }
  }
});

// The README's opening list of rule IDs (BB8 6709891376 ruling 3: M1 sits in it
// next to R1-R5) is exactly the set its table and the refusal model name.
test('the README lists every rule ID its table and the refusal model name, and no other', () => {
  const m = /the rule IDs below \(([^)]+)\) are its rules/.exec(README.replace(/\s+/g, ' '));
  assert.ok(m, 'the README opens with its list of rule IDs');
  const listed = [];
  for (const item of m[1].split(/,\s*/)) {
    const range = /^([A-Z])(\d+)–\1(\d+)$/.exec(item);
    if (range) for (let n = +range[2]; n <= +range[3]; n++) listed.push(`${range[1]}${n}`);
    else {
      assert.match(item, /^[A-Z]\d+$/, `${item} is a rule ID or a range of them`);
      listed.push(item);
    }
  }
  assert.equal(new Set(listed).size, listed.length, 'the list names each rule once');
  const named = new Set();
  for (const row of readmeRows().values()) for (const rule of row.rules) named.add(rule);
  for (const kind of Object.values(REFUSAL)) for (const rule of Object.keys(kind)) named.add(rule);
  for (const rule of Object.values(BAD)) named.add(rule);
  assert.deepEqual([...listed].sort(), [...named].sort(), 'the list is the rules named');
});
test('canonical form and ordered digest: the vectors, recomputed in Node and in Python', () => {
  const fx = load('good/seal_sequence_two_logs.json');
  const entries = fx.canonical_vectors.map((v) => v.entry);
  for (const v of fx.canonical_vectors) {
    assert.ok(isEntry(v.entry), `${v.canonical} is an F1 entry`);
    assert.equal(JSON.stringify(v.entry), v.canonical);
    assert.equal(canonical(v.entry), v.canonical, "the store's canonical() agrees for this subset");
    assert.equal(entryBytes(v.entry).length, v.bytes);
  }
  // The escapes the contract pins (§2.1).
  const text = Object.fromEntries(fx.canonical_vectors.map((v) => [String(v.entry), v.canonical]));
  assert.equal(text['\b\f\n\r\t'], '"\\b\\f\\n\\r\\t"');
  assert.equal(text['\u0000\u001f\u007f'], '"\\u0000\\u001f\u007f"');
  assert.equal(text['\u2028\u2029'], '"\u2028\u2029"');
  assert.equal(text['naïve café'], '"naïve café"');
  assert.equal(fx.vector_chain.domain, DOMAIN.log('variants'));
  let d = d0(fx.vector_chain.domain);
  assert.equal(fx.vector_chain.digests[0], d, 'an empty sequence digests to d0');
  entries.forEach((e, i) => assert.equal(fx.vector_chain.digests[i + 1], (d = digestStep(d, e))));
  // Splitting a sequence never changes its digest.
  assert.equal(fold(fold(d0(fx.vector_chain.domain), entries.slice(0, 5)), entries.slice(5)), d);
  // Outside the subset.
  for (const bad of [1.5, { a: 1 }, 2 ** 53, '\ud800', [Number.NaN]])
    assert.equal(isEntry(bad), false);

  // A segment with every vector as an entry, plus every segment the fixtures build.
  const seg = {
    version: 1,
    kind: 'reader_discovery_segment',
    job_id: fx.job_id,
    identity_hash: fx.identity_hash,
    epoch: 0,
    log: 'variants',
    previous_hash: null,
    first: 0,
    count: entries.length,
    digest_before: d0(DOMAIN.log('variants')),
    digest_after: d,
    entries,
  };
  const segments = [segmentBytes(seg)];
  for (const rel of GOOD_WRITE)
    for (const r of replay(load(rel))) for (const s of r.segments) segments.push(s.raw);
  const wfx = load('good/witness_cursor_option2.json');
  const sfx = load('bad/terminal_suffix_not_contiguous.json');
  const suffixCases = [
    ...sfx.mutants.map((m) => ({ ...m, accepted: false })),
    ...sfx.controls.map((m) => ({ ...m, accepted: true })),
  ];
  const rfx = load('bad/terminal_suffix_resume_faults.json');
  const resumeCases = [
    ...rfx.mutants.map((m) => ({ ...m, accepted: false })),
    ...rfx.controls.map((m) => ({ ...m, accepted: true, resolver: 'accepts' })),
  ];
  const cfx = load('bad/cursor_over_bound.json');
  const cursors = [...cfx.controls, ...cfx.mutants].map((c) => cursorCase(cfx.inputs, c.name));
  const py = python({
    vectors: entries,
    shapes: LOAD_SHAPES,
    domain: fx.vector_chain.domain,
    segments: segments.map((b) => b.toString('utf8')),
    witness: {
      stream: wfx.durable_records,
      method: wfx.cursor.witness.method_id,
      witness: wfx.cursor.witness,
      domain: DOMAIN.witness(wfx.cursor.witness.method_id),
    },
    suffix_cases: suffixCases.map((m) => ({ name: m.name, stream: mutantStream(wfx, m) })),
    resume_cases: resumeCases.map((m) => ({
      name: m.name,
      stream: mutantStream(wfx, m, rfx),
      boundary: rfx.boundary,
    })),
    incomplete_templates: INCOMPLETE_TEMPLATES,
    cursors: cursors.map((c) => [c, canonical(c)]),
    float_fixture: path.join(DIR, 'bad', 'float_entry.json'),
  });
  py.vectors.forEach(([viaContracts, viaDumps], i) => {
    assert.equal(viaContracts, fx.canonical_vectors[i].canonical, "Python's canonical_json");
    assert.equal(viaDumps, fx.canonical_vectors[i].canonical, "Python's json.dumps");
  });
  assert.equal(py.chain, d, 'Python folds the same digest');
  // §2.1, §5.2: the single pass's bytes are canonical_json's, on every vector,
  // every load shape §10 measures and every entry of every good fixture's segments.
  assert.ok(py.single_pass.length > entries.length);
  assert.ok(
    py.single_pass.every(Boolean),
    "the worker's single-pass key equals canonical_json(entry)"
  );
  // On the load shapes, each capped at ENTRY_DEPTH, canonical_json completes
  // and the single pass equals it (§2.1; BB8 6693502369). The single pass runs
  // outside the try, so its own failure fails the run (BB8 6693638249).
  LOAD_SHAPES.forEach((e, i) => {
    assert.equal(py.shape_pass[i][0], JSON.stringify(e), `load shape ${i}: the single pass`);
    assert.equal(py.shape_pass[i][1], true, `load shape ${i} (depth ${entryDepth(e)})`);
    assert.ok(isEntry(e), `load shape ${i} is an entry`);
  });
  assert.equal(
    Math.max(...LOAD_SHAPES.map(entryDepth)),
    LIMITS.ENTRY_DEPTH,
    'the deepest shape sits at the bound'
  );
  py.segments.forEach(([sameBytes, address, after], i) => {
    const node = JSON.parse(segments[i].toString('utf8'));
    assert.ok(sameBytes, `segment ${i}: json.dumps without sort_keys reproduces the bytes`);
    assert.equal(address, sha(segments[i]), `segment ${i}: the same address`);
    assert.equal(after, node.digest_after, `segment ${i}: the same digest_after`);
  });
  // Option 2: resolve_detail_records over the filtered stream gives the same witness.
  assert.ok(py.suffix_ok, 'Python finds the same terminal suffix');
  assert.deepEqual(py.witness, [wfx.cursor.witness.count, wfx.cursor.witness.digest]);
  assert.equal(py.whole_stream, 'RESULT_EXPIRED', 'resolving the unfiltered stream refuses');
  // The terminal suffix: Python's reading refuses every mutant and accepts every
  // control, as Node's does, and the controls' detail bytes resolve in Python.
  assert.deepEqual(
    py.suffix_cases,
    suffixCases.map((m) => [m.name, m.accepted, m.accepted ? true : null])
  );
  for (const m of suffixCases)
    assert.equal(
      reconstruct(wfx.cursor.witness.method_id, wfx.cursor.witness, mutantStream(wfx, m)).violations
        .length === 0,
      m.accepted,
      `Node agrees on ${m.name}`
    );
  // After a resume inside a terminal emission that spans frames: Python's
  // reading and Node's refuse all twenty-four faults and accept the controls;
  // the generic resolver alone refuses fifteen and accepts the nine the
  // worker's suffix-membership check must refuse (3PO 6678848728).
  assert.deepEqual(
    py.resume_cases,
    resumeCases.map((m) => [m.name, m.accepted, m.resolver])
  );
  for (const m of resumeCases)
    assert.equal(
      reconstruct(wfx.cursor.witness.method_id, wfx.cursor.witness, mutantStream(wfx, m, rfx))
        .violations.length === 0,
      m.accepted,
      `Node agrees on ${m.name}`
    );
  // §3.1: the registry and the source are within the derivation's inputs, and
  // Python writes the same bytes for every cursor the cursor fixture builds.
  const reg = py.registry;
  for (const key of ['methods', 'method_id_bytes', 'schemas', 'schema_name_bytes'])
    assert.ok(reg[key] <= cfx.inputs[key], `the registry's ${key} (${reg[key]}) is within §3.1`);
  assert.deepEqual(
    reg.count_keys.filter((k) => !METHOD_FIELDS.includes(k) && !TERMINAL_INPUTS.includes(k)),
    [],
    "every field a method's counts can hold is one §3.1 counts"
  );
  assert.equal(
    reg.incomplete_writers,
    INCOMPLETE_TEMPLATES.length - 1,
    'three writers of incomplete'
  );
  assert.deepEqual(
    reg.templates,
    INCOMPLETE_TEMPLATES.map(() => true),
    "the reasons' templates"
  );
  assert.equal(
    longestReason(reg.edge_combos, reg.mini_cap),
    cfx.inputs.incomplete_reason,
    'the longest incomplete reason'
  );
  // Review M5: the rest of §3.1's inputs, read from the source too.
  const longest = (xs) => Math.max(...xs.map((x) => Buffer.byteLength(x)));
  assert.ok(reg.phases.includes('complete') && reg.phases.includes(cfx.inputs.phase));
  assert.equal(longest(reg.phases), Buffer.byteLength(cfx.inputs.phase), 'the longest phase');
  assert.deepEqual(reg.coverage, ['answered', 'refused'], "a method's coverage values");
  assert.equal(longest(reg.coverage), Buffer.byteLength('answered'));
  assert.deepEqual(
    [...reg.counters].sort(),
    Object.keys(largestCursor(cfx.inputs).counters).sort(),
    "the cursor's counters"
  );
  assert.deepEqual(
    reg.tally_fields,
    WITNESS_FIELDS_V1.filter((f) => !['method_id', 'id'].includes(f)).sort(),
    'the witness holds every field the domain reducer reads'
  );
  assert.ok(WITNESS_FIELDS_V1.length <= cfx.inputs.witness_fields);
  // §8 (review H2): every RESOURCE_LIMIT raise the reader reaches is a site §8
  // lists with its cause, or names a cause of its own from the set.
  assert.ok(py.reached_modules > 10, `${py.reached_modules} modules reached`);
  for (const [module, fn, named] of py.raise_sites) {
    const listed = RAISE_SITES.find(([m, f]) => m === module && f === fn);
    assert.ok(
      listed || RESOURCE_CAUSES.includes(named),
      `${module} ${fn}: a RESOURCE_LIMIT raise §8 does not list`
    );
    if (named) assert.ok(RESOURCE_CAUSES.includes(named), `${module} ${fn}: ${named} is a cause`);
  }
  for (const [module, fn] of RAISE_SITES)
    assert.ok(
      py.raise_sites.some(([m, f]) => m === module && f === fn),
      `§8 lists ${module} ${fn}, which raises RESOURCE_LIMIT`
    );
  assert.deepEqual(
    py.cursor,
    cursors.map(() => true),
    "Python's canonical_json agrees"
  );
  // The float: Python reads 1.0, writes "1.0", and its digest is the fixture's; Node's is not.
  assert.deepEqual(py.float, ['float', '1.0', true]);
  const floatSeal = load('bad/float_entry.json').frames[0].discovery.seals[0];
  assert.equal(floatSeal.entries[1], 1, 'Node parses 1.0 as the integer 1');
  assert.notEqual(fold(floatSeal.digest_before, floatSeal.entries), floatSeal.digest_after);
});

test('the cut rule: boundaries depend only on entry sizes', () => {
  const fx = load('good/seal_sequence_two_logs.json');
  for (const v of fx.cut_vectors) {
    const lengths = v.runs.flatMap(([bytes, times]) => Array(times).fill(bytes));
    assert.ok(lengths.every((b) => b >= 1 && b <= LIMITS.ENTRY_BYTES));
    assert.deepEqual(cut(lengths), { segments: v.segments, tail: v.tail }, JSON.stringify(v.runs));
  }
});

for (const rel of GOOD_WRITE)
  test(`${rel}: every frame is accepted and every segment and digest recomputes`, () => {
    const fx = load(rel);
    const results = replay(fx);
    const row = readmeRows().get(rel);
    for (const rule of row.rules) assert.ok(WRITE_RULES.includes(rule), `${rule} is evaluated`);
    results.forEach((r, i) => {
      const frame = fx.frames[i];
      assert.deepEqual(r.violations, [], `frame ${i}`);
      assert.deepEqual(r.discovery, frame.expect.record_discovery, `frame ${i}: record.discovery`);
      assert.deepEqual(
        r.segments.map(({ log, address, bytes }) => ({ log, address, bytes })),
        frame.expect.segments,
        `frame ${i}: segment addresses and byte lengths`
      );
      assert.deepEqual(r.released, frame.expect.released, `frame ${i}: released heads`);
      for (const s of r.segments) {
        assert.deepEqual(Object.keys(s.segment), SEGMENT_FIELDS, 'F3: the fixed field order');
        assert.notEqual(
          sha(Buffer.from(canonical(s.segment))),
          s.address,
          'F6: not canonical() of the segment'
        );
      }
    });
    // F4: the seals are exactly the greedy cut of each chain, tail included.
    for (const [key, chain] of chainsOf(fx, results)) {
      const lengths = [...chain.sealed, ...chain.tail].map(size);
      assert.deepEqual(
        cut(lengths),
        { segments: chain.ranges, tail: [chain.sealed.length, lengths.length] },
        `F4: ${key} is sealed exactly at its greedy cut`
      );
    }
    // A re-seal after a crash: the same seals give the same bytes and addresses.
    const again = replay(fx);
    assert.deepEqual(
      again.flatMap((r) => r.segments.map((s) => s.address)),
      results.flatMap((r) => r.segments.map((s) => s.address))
    );
    if (rel === 'good/epoch_jump.json') {
      const [a, b] = results;
      assert.equal(b.discovery.epoch - a.discovery.epoch, 3, 'the epoch jumps by more than one');
      assert.deepEqual(b.released, [a.segments[0].address], 'the advance releases the old head');
      assert.deepEqual(Object.keys(b.discovery.logs), ['seen'], 'and keeps none of the old chains');
    }
    if (rel === 'good/seal_completeness.json') {
      const [first, second] = fx.frames[0].discovery.seals;
      const bytes = (s) => sumBytes(s.entries);
      assert.ok(
        first.entries.length < LIMITS.SEGMENT_ENTRIES && bytes(first) < LIMITS.SEGMENT_BYTES
      );
      assert.ok(
        bytes(first) + size(second.entries[0]) > LIMITS.SEGMENT_BYTES,
        'the first seal is complete only because the next entry would not fit'
      );
      assert.ok(second.entries.length < LIMITS.SEGMENT_ENTRIES);
      assert.equal(bytes(second), LIMITS.SEGMENT_BYTES, 'the second is complete by its bytes');
    }
  });

test('good/seal_sequence_two_logs.json: the chain links across frames', () => {
  const results = replay(load('good/seal_sequence_two_logs.json'));
  const alt = results.flatMap((r) => r.segments).filter((s) => s.log === 'alt_cells');
  assert.equal(alt.length, 2);
  assert.equal(alt[0].segment.previous_hash, null);
  assert.equal(alt[1].segment.previous_hash, alt[0].address);
  assert.equal(alt[1].segment.first, 1024);
  assert.equal(alt[1].segment.digest_before, alt[0].segment.digest_after);
  assert.equal(results[1].segments.length, 2, 'two logs sealed in one frame');
});

test('W4 holds the group positions: through never moves back, current comes after it', () => {
  const fx = load('good/seal_sequence_two_logs.json');
  const record = { discovery: replay(fx).at(-1).discovery, cursor: fx.frames.at(-1).cursor };
  const next = (groups) => {
    const cursor = clone(record.cursor);
    cursor.discovery.groups = groups;
    return { discovery: { epoch: 0, resets: [], seals: [] }, cursor };
  };
  const rules = (rec, frame) => [
    ...new Set(evaluateFrame(fx, rec, frame).violations.map((v) => v.rule)),
  ];
  const advanced = next({ through: [3, 7], current: { lines: [4, 8], keys: [['4:1', '8:2']] } });
  assert.deepEqual(rules(record, advanced), [], 'the group boundary moves both forward');
  const after = { discovery: record.discovery, cursor: advanced.cursor };
  for (const groups of [
    { through: null, current: { lines: [4, 8], keys: [] } },
    { through: [2, 5], current: null },
  ])
    assert.deepEqual(
      rules(after, next(groups)),
      ['W4'],
      `through moved back: ${JSON.stringify(groups)}`
    );
  for (const groups of [
    { through: [4, 8], current: { lines: [3, 7], keys: [] } },
    { through: null, current: { lines: [7, 7], keys: [] } },
  ])
    assert.deepEqual(
      rules(record, next(groups)),
      ['W4'],
      `not a valid position: ${JSON.stringify(groups)}`
    );
});

// F-6 (BB8 6715584092): the current group never moves back within an epoch,
// even with through null on both sides. bad/current_moved_back.json's frame
// is refused by W4 alone (the generic bad-fixture test); its controls are
// accepted on the same record; a new epoch starts again. Narrowed (BB8
// 6717719856): only a frame with a current group is held to the previous
// one. The wider cases, a group dropped without retiring and a through behind
// the previous group, are accepted controls for now, PENDING 3PO's #721
// confirmation that the worker never makes either: widen if confirmed, and
// these become refusals again.
test('bad/current_moved_back.json: the current group never moves back; its controls are accepted', () => {
  const fx = load('bad/current_moved_back.json');
  const rules = (frame, record = fx.record) => [
    ...new Set(evaluateFrame(fx, record, frame).violations.map((v) => v.rule)),
  ];
  assert.deepEqual(fx.record.cursor.discovery.groups, {
    through: null,
    current: { lines: [3, 4], keys: [] },
  });
  assert.equal(fx.frames[0].cursor.discovery.groups.through, null);
  assert.deepEqual(rules(fx.frames[0]), ['W4']);
  assert.deepEqual(
    fx.controls.map((c) => c.name),
    ['current_held', 'current_later', 'retired', 'retired_next_open']
  );
  for (const c of fx.controls) assert.deepEqual(rules(c.frame), [], c.name);
  const groups = (g) => {
    const frame = clone(fx.frames[0]);
    frame.cursor.discovery.groups = g;
    return frame;
  };
  for (const [name, g] of [
    ['an earlier first line', { through: null, current: { lines: [2, 9], keys: [] } }],
    [
      'retired before the group, the next open',
      { through: [1, 2], current: { lines: [2, 3], keys: [] } },
    ],
  ])
    assert.deepEqual(rules(groups(g)), ['W4'], name);
  // PENDING 3PO's #721 confirmation (BB8 6717719856): accepted while F-6 is
  // narrowed; refused W4 if it widens.
  for (const [name, g] of [
    ['the group dropped, nothing retired', { through: null, current: null }],
    ['retired behind the previous group', { through: [2, 5], current: null }],
  ])
    assert.deepEqual(rules(groups(g)), [], `pending #721: ${name}`);
  // The same first line: the second line decides.
  const at35 = clone(fx.record);
  at35.cursor.discovery.groups.current.lines = [3, 5];
  assert.deepEqual(
    rules(groups({ through: null, current: { lines: [3, 4], keys: [] } }), at35),
    ['W4'],
    'behind [3,5]'
  );
  assert.deepEqual(
    rules(groups({ through: [3, 4], current: null }), at35),
    [],
    'pending #721: retired behind [3,5]'
  );
  // The previous current.lines bounds the frame whatever the previous
  // through was, not only when it was null (Step 10 review, F1): a record
  // cursor with a retired group [1,2] and the current group [5,6].
  const at56 = clone(fx.record);
  at56.cursor.discovery.groups = { through: [1, 2], current: { lines: [5, 6], keys: [] } };
  assert.deepEqual(
    rules(groups({ through: [1, 2], current: { lines: [3, 4], keys: [] } }), at56),
    ['W4'],
    'behind [5,6], through held'
  );
  assert.deepEqual(
    rules(groups({ through: [3, 4], current: null }), at56),
    [],
    'pending #721: retired behind [5,6]'
  );
  for (const g of [
    { through: [1, 2], current: { lines: [5, 7], keys: [] } },
    { through: [5, 6], current: null },
  ])
    assert.deepEqual(rules(groups(g), at56), [], `at or after [5,6]: ${JSON.stringify(g)}`);
  // A new epoch starts again: the record's epoch is behind the frame's.
  const advanced = clone(fx.frames[0]);
  advanced.discovery.epoch = 1;
  advanced.cursor.method_index = 1;
  advanced.cursor.discovery.epoch = 1;
  assert.deepEqual(rules(advanced), [], 'a new epoch, an earlier group');
});

// The witness holds exactly §2.8's six keys (BB8 6715584092), as Node's W4
// checks it: each key missing in turn and one key more are refused by W4
// alone; the six keys, in either order, are accepted.
test('W4 holds the witness to exactly its keys', () => {
  const fx = load('good/seal_sequence_two_logs.json');
  const record = { discovery: replay(fx).at(-1).discovery, cursor: fx.frames.at(-1).cursor };
  const epoch = record.cursor.discovery.epoch;
  const W = {
    version: 1,
    epoch,
    method_id: 'schema:end_rhyme',
    fields: ['method_id', 'id', 'verdict', 'a.token_ids', 'b.token_ids'],
    count: 4,
    digest: 'f'.repeat(64),
  };
  const rules = (witness) => {
    const cursor = clone(record.cursor);
    cursor.witness = witness;
    const frame = { discovery: { epoch, resets: [], seals: [] }, cursor };
    return [...new Set(evaluateFrame(fx, record, frame).violations.map((v) => v.rule))];
  };
  assert.deepEqual(rules(W), [], 'the six keys');
  assert.deepEqual(rules(Object.fromEntries(Object.entries(W).reverse())), [], 'in another order');
  assert.deepEqual(rules(null), [], 'a null witness');
  for (const key of Object.keys(W)) {
    const { [key]: _, ...rest } = W;
    assert.deepEqual(rules(rest), ['W4'], `without ${key}`);
  }
  for (const [name, extra] of [
    ['a key more', { extra: 0 }],
    ['a null key more', { extra: null }],
    ['an object key more', { detail: {} }],
    ['a key more that differs by case', { Count: 4 }],
  ])
    assert.deepEqual(rules({ ...W, ...extra }), ['W4'], name);
});

test('good/lease_payload_summary_paths.json: the walk, the load and the inventory witness', () => {
  const fx = load('good/lease_payload_summary_paths.json');
  const { violations, skipped } = evaluateResume(fx);
  assert.deepEqual(violations, []);
  assert.deepEqual(skipped, []);
  for (const rule of readmeRows().get(fx.fixture).rules) assert.ok(RESUME_RULES.includes(rule));
  // The record and cursor are the seal sequence's last state.
  const seq = load('good/seal_sequence_two_logs.json');
  const last = replay(seq).at(-1);
  assert.deepEqual(fx.record.discovery, last.discovery);
  assert.deepEqual(fx.record.cursor.discovery, seq.frames.at(-1).cursor.discovery);
  assert.equal(fx.record.id, seq.job_id);
  // A full cursor v2: today's fields stay, the flags are in `incomplete` (BB8 6),
  // and methods[*] holds no terminal input.
  const c = fx.record.cursor;
  for (const key of [
    'identity_hash',
    'phase',
    'method_index',
    'candidate',
    'emission',
    'sequence',
    'counters',
    'methods',
    'done',
    'incomplete',
  ])
    assert.ok(Object.hasOwn(c, key), `cursor v2 keeps ${key}`);
  assert.ok(Object.keys(c.incomplete).length >= 1, 'an incomplete-search flag rides the cursor');
  const bad = [];
  cursorShape(c, c.method_index, (rule, detail) => bad.push({ rule, detail }));
  assert.deepEqual(bad, []);
  // And the shape check catches a terminal input or an oversized cursor.
  for (const mutate of [
    (m) => (m.methods['schema:end_rhyme'] = { candidates: 1, alt_cells: [] }),
    (m) => (m.incomplete.x = 'y'.repeat(LIMITS.CURSOR_BYTES)),
  ]) {
    const m = clone(c);
    mutate(m);
    const found = [];
    cursorShape(m, m.method_index, (rule) => found.push(rule));
    assert.deepEqual(found, ['W4']);
  }
});

const pick = (r, keys) => Object.fromEntries(keys.map((k) => [k, r[k]]));
const rulesOf = (got) => [...new Set(got.violations.map((v) => v.rule))];

test('good/lease_incremental_walk.json: a lease reads only what was appended since its verified head', () => {
  const fx = load('good/lease_incremental_walk.json');
  for (const rule of readmeRows().get(fx.fixture).rules) assert.ok(WALK_RULES.includes(rule));
  // The record is the seal sequence's last, with verified heads a walk saved after frame 2.
  const seq = load('good/seal_sequence_two_logs.json');
  const results = replay(seq);
  assert.deepEqual(fx.record.discovery.logs, results.at(-1).discovery.logs);
  assert.equal(fx.record.id, seq.job_id);
  for (const [log, v] of Object.entries(fx.record.discovery.verified))
    assert.deepEqual(
      v,
      results[1].discovery.logs[log] ?? emptyLog(log),
      `${log} verified at frame 2`
    );
  // The address list is the chain: every segment the commits wrote, oldest first.
  for (const [log, list] of Object.entries(fx.addresses))
    assert.deepEqual(
      list,
      results.flatMap((r) => r.segments.filter((s) => s.log === log).map((s) => s.address))
    );
  // A lease: stat the verified prefix, read only the appended segment, advance.
  const lease = evaluateWalk(fx, fx.record.discovery, 'lease');
  assert.deepEqual(lease.violations, []);
  assert.deepEqual(pick(lease, ['stat', 'read', 'verified', 'saved', 'payload']), fx.expect.lease);
  assert.deepEqual(lease.read, [fx.addresses.alt_cells[1]], 'only alt_cells#1 is read');
  assert.deepEqual(
    [...lease.stat, ...lease.read].sort(),
    Object.values(fx.addresses).flat().sort(),
    'every segment is statted or read'
  );
  assert.deepEqual(
    Object.keys(lease.verified).filter(
      (l) => canonical(lease.verified[l]) !== canonical(fx.record.discovery.verified[l])
    ),
    ['alt_cells'],
    "only alt_cells' verified head moves"
  );
  // The worker sees the same payload as the full lease fixture's.
  assert.deepEqual(lease.payload, load('good/lease_payload_summary_paths.json').payload.discovery);
  // The next lease: nothing appended, nothing read, nothing saved.
  const next = evaluateWalk(fx, { ...fx.record.discovery, verified: lease.verified }, 'lease');
  assert.deepEqual(next.violations, []);
  assert.deepEqual(pick(next, ['stat', 'read', 'saved']), fx.expect.next_lease);
  // A full read (resume(), or reconciliation after a foreign generation) starts
  // at each head, reads all, newest first, and rebuilds the list without it.
  const full = evaluateWalk(fx, fx.record.discovery, 'full');
  assert.deepEqual(full.violations, []);
  assert.deepEqual(pick(full, ['read', 'addresses', 'verified']), fx.expect.full);
  assert.deepEqual(full.addresses, fx.addresses);
  const blind = evaluateWalk({ ...fx, addresses: {} }, fx.record.discovery, 'full');
  assert.deepEqual(
    pick(blind, ['violations', 'read', 'addresses']),
    pick(full, ['violations', 'read', 'addresses'])
  );
});

// Review finding 5: each clause of R5 refuses on its own, before any read where
// the record alone shows it, and the junction is R5, never R2.
test('R5: every clause of the verified prefix and the junction refuses, as STORAGE_CORRUPT', () => {
  const fx = load('good/lease_incremental_walk.json');
  const rd = fx.record.discovery;
  const alt0 = load('good/seal_sequence_two_logs.json').frames[1].expect.record_discovery.logs
    .alt_cells;
  const withAlt = (v) => ({ ...rd, verified: { ...rd.verified, alt_cells: v } });
  const cases = [
    // The record alone shows it: refused before anything is read.
    [
      'a log missing from verified',
      { ...rd, verified: pick(rd.verified, ['seen', 'alt_cells']) },
      [],
    ],
    [
      'a log verified that the record does not hold',
      { ...rd, verified: { ...rd.verified, row_seen: emptyLog('row_seen') } },
      [],
    ],
    ['count ahead of the head', withAlt({ ...alt0, count: rd.logs.alt_cells.count + 1 }), []],
    ['segments ahead of the head', withAlt({ ...rd.logs.alt_cells, segments: 3 }), []],
    ['at the head with another digest', withAlt({ ...rd.logs.alt_cells, digest: alt0.digest }), []],
    ['empty but not the empty state', withAlt({ ...emptyLog('alt_cells'), count: 1 }), []],
    ['a head the list does not hold there', withAlt({ ...alt0, head: rd.logs.seen.head }), []],
    // Only the first segment read shows it: the junction.
    ['the junction count', withAlt({ ...alt0, count: 1000 }), [fx.addresses.alt_cells[1]]],
    [
      'the junction digest',
      withAlt({ ...alt0, digest: rd.logs.seen.digest }),
      [fx.addresses.alt_cells[1]],
    ],
  ];
  for (const [name, discovery, read] of cases) {
    const got = evaluateWalk(fx, discovery, 'lease');
    assert.deepEqual(rulesOf(got), ['R5'], `${name}: ${JSON.stringify(got.violations)}`);
    assert.deepEqual(got.read, read, `${name}: what was read before the refusal`);
    assert.equal(got.saved, false, `${name}: nothing is saved`);
    assert.deepEqual(REFUSAL.walk.R5, CORRUPT, 'and nothing is released');
    // resume()'s full read uses neither verified nor the list, and passes.
    assert.deepEqual(evaluateWalk(fx, discovery, 'full').violations, [], `${name}: full read`);
  }
  // A list that skips the verified head disagrees with the record: R5, before reading.
  const skewed = { ...fx, addresses: { ...fx.addresses, alt_cells: [fx.addresses.alt_cells[1]] } };
  const got = evaluateWalk(skewed, rd, 'lease');
  assert.deepEqual([rulesOf(got), got.read], [['R5'], []]);
});

// Review finding 1: the address list changes only after the record save returns.
test('good/lease_after_refused_commit.json: a refused commit leaves the list, so its orphan is never read', () => {
  const fx = load('good/lease_after_refused_commit.json');
  for (const rule of readmeRows().get(fx.fixture).rules) assert.ok(WALK_RULES.includes(rule));
  const seq = load('good/seal_sequence_two_logs.json');
  const results = replay(seq);
  // The record is frame 2's, verified at its heads; frame 3 wrote the orphan.
  assert.deepEqual(fx.record.discovery.logs, results[1].discovery.logs);
  assert.deepEqual(fx.record.discovery.verified, results[1].discovery.logs);
  assert.deepEqual(
    fx.orphans,
    results[2].segments.map((s) => s.address)
  );
  assert.ok(storeOf(fx.store.segments_from).has(fx.orphans[0]), 'the orphan is in the store');
  const lease = evaluateWalk(fx, fx.record.discovery, 'lease');
  assert.deepEqual(lease.violations, []);
  assert.deepEqual(pick(lease, ['stat', 'read', 'verified', 'saved', 'payload']), fx.expect.lease);
  assert.deepEqual([lease.read, lease.saved], [[], false]);
  assert.ok(!JSON.stringify(lease.payload).includes(fx.orphans[0]), 'the payload leaves it out');
  const full = evaluateWalk(fx, fx.record.discovery, 'full');
  assert.deepEqual(full.violations, []);
  assert.deepEqual(pick(full, ['read', 'addresses', 'verified']), fx.expect.full);
  // Had the commit appended the orphan's address before its save returned, the
  // list would run past the record's head: this image's own defect, R5,
  // STORAGE_CORRUPT, nothing read or released. resume()'s full read rebuilds it.
  const ahead = {
    ...fx,
    addresses: { ...fx.addresses, alt_cells: [...fx.addresses.alt_cells, ...fx.orphans] },
  };
  const refused = evaluateWalk(ahead, fx.record.discovery, 'lease');
  assert.deepEqual([rulesOf(refused), refused.read], [['R5'], []]);
  const rebuilt = evaluateWalk(ahead, fx.record.discovery, 'full');
  assert.deepEqual([rebuilt.violations, rebuilt.addresses], [[], fx.addresses]);
});

// BB8 6681838131, 3PO 6681823180 (a): a save that throws without a status may
// have landed after its rename. The outcome is unknown, so the instance uses no
// list again until the restart's reconciliation rebuilds them from the durable
// heads; a throw with a status came before the write, and only orphans changed.
test('good/thrown_save_outcome_unknown.json: a thrown save rebuilds the lists from the durable heads', () => {
  const fx = load('good/thrown_save_outcome_unknown.json');
  const refused = load('good/lease_after_refused_commit.json');
  assert.deepEqual(fx.record, refused.record);
  assert.deepEqual(fx.commit.wrote, refused.orphans);
  const outcomes = new Set();
  for (const kase of fx.cases) {
    const durable = kase.durable;
    // Either outcome is the record before the commit or the record it saves:
    // the commit moves the head and never verified (§4).
    assert.deepEqual(durable.verified, fx.record.discovery.verified, `${kase.name}: verified`);
    if (kase.throws.status) {
      // encoded's 413 and _capacity's 507 or 503 throw before the record write.
      assert.ok([413, 503, 507].includes(kase.throws.status));
      assert.deepEqual(durable, fx.record.discovery, `${kase.name}: nothing landed`);
      assert.equal(kase.expect.instance, 'serving');
      assert.deepEqual(kase.expect.addresses, fx.addresses, 'the lists are as they were');
      const lease = evaluateWalk({ ...fx, addresses: kase.expect.addresses }, durable, 'lease');
      assert.deepEqual(lease.violations, []);
      assert.deepEqual({ read: lease.read, saved: lease.saved }, kase.expect.next_lease);
      outcomes.add('before the write');
    } else {
      assert.equal(kase.throws.after, 'rename');
      assert.equal(kase.expect.instance, 'failed');
      assert.deepEqual(kase.expect.refused_until_restart, {
        code: 'STORAGE_UNAVAILABLE',
        status: 503,
      });
      // The restart holds generation -1, so its first lock entry reconciles:
      // a full read from the durable heads. It saves no verified head.
      const full = evaluateWalk(fx, durable, 'full');
      assert.deepEqual(full.violations, []);
      assert.deepEqual(
        { read: full.read, addresses: full.addresses, saved: false },
        kase.expect.restart,
        kase.name
      );
      const landed = durable.logs.alt_cells.head === fx.commit.wrote[0];
      outcomes.add(landed ? 'landed' : 'lost');
      assert.equal(full.addresses.alt_cells.includes(fx.commit.wrote[0]), landed);
    }
    const listed = new Set(
      Object.values(kase.expect.restart?.addresses ?? kase.expect.addresses).flat()
    );
    assert.deepEqual(
      kase.expect.orphans,
      fx.commit.wrote.filter((a) => !listed.has(a)),
      `${kase.name}: the orphans are the written segments no list holds`
    );
  }
  assert.deepEqual([...outcomes].sort(), ['before the write', 'landed', 'lost']);
});

// A full read is the one walk that releases: the chain itself is broken, a
// segment is missing, or its bytes do not match its address.
test('a full read refuses chain_broken, segment_missing or segment_corrupt; a lease never releases', () => {
  const fx = load('good/lease_incremental_walk.json');
  const rd = fx.record.discovery;
  const short = { ...rd, logs: { ...rd.logs, alt_cells: { ...rd.logs.alt_cells, count: 2000 } } };
  const got = evaluateWalk(fx, short, 'full');
  assert.deepEqual(rulesOf(got), ['R2']);
  assert.equal(REFUSAL.full.R2.cause, 'chain_broken');
  assert.equal(got.violations[0].log, 'alt_cells');
  const longer = { ...rd, logs: { ...rd.logs, alt_cells: { ...rd.logs.alt_cells, segments: 1 } } };
  assert.deepEqual(
    rulesOf(evaluateWalk(fx, longer, 'full')),
    ['R2'],
    'more segments than the record'
  );
  const gone = { ...fx, store: { ...fx.store, omit: [fx.addresses.alt_cells[0]] } };
  assert.deepEqual(
    rulesOf(evaluateWalk(gone, rd, 'full')),
    ['missing'],
    'segment_missing in reconciliation'
  );
  for (const refusal of Object.values(REFUSAL.walk)) assert.deepEqual(refusal, CORRUPT);
  // BB8 6681838131: a byte mismatch is corruption, not breakage; chain_broken
  // stays structural (a link, a count or first).
  assert.equal(REFUSAL.full.F6.cause, 'segment_corrupt');
  const head = rd.logs.alt_cells.head;
  const raw = storeOf(fx.store.segments_from).get(head);
  const at = raw.indexOf('"entries":[') + '"entries":['.length;
  const corrupt = { ...fx, store: { ...fx.store, corrupt: [{ address: head, at, byte: 0x39 }] } };
  const damaged = evaluateWalk(corrupt, rd, 'full');
  assert.deepEqual(rulesOf(damaged), ['F6']);
  assert.equal(damaged.violations[0].log, 'alt_cells');
});

test('§4: a commit keeps verified, never advances it; a release or reset empties it', () => {
  const fx = load('good/lease_incremental_walk.json');
  const job = { job_id: fx.record.id, identity_hash: fx.record.identity_hash };
  const record = {
    discovery: { ...fx.record.discovery, verified: fx.expect.lease.verified },
    cursor: fx.record.cursor,
  };
  // A frame with no seals keeps every verified state.
  const quiet = { discovery: { epoch: 0, resets: [], seals: [] }, cursor: clone(fx.record.cursor) };
  const kept = evaluateFrame(job, record, quiet);
  assert.deepEqual(kept.violations, []);
  assert.deepEqual(kept.discovery.verified, record.discovery.verified);
  // A seal moves the head; alt_cells' verified head stays behind it.
  const st = record.discovery.logs.alt_cells;
  const entries = Array.from({ length: 1024 }, (_, k) => (2048 + k) % 10);
  const cursor = clone(fx.record.cursor);
  cursor.discovery.logs.alt_cells = {
    sealed: 3072,
    sealed_digest: fold(st.digest, entries),
    tail: [2],
  };
  const sealed = evaluateFrame(job, record, {
    discovery: {
      epoch: 0,
      resets: [],
      seals: [
        {
          log: 'alt_cells',
          first: 2048,
          entries,
          digest_before: st.digest,
          digest_after: fold(st.digest, entries),
        },
      ],
    },
    cursor,
  });
  assert.deepEqual(sealed.violations, []);
  assert.equal(sealed.discovery.logs.alt_cells.segments, 3);
  assert.deepEqual(
    sealed.discovery.verified,
    record.discovery.verified,
    'the commit moved no verified head'
  );
  // An epoch advance releases every chain, and its verified state with it.
  const next = clone(fx.record.cursor);
  next.method_index = 1;
  next.discovery = {
    version: 1,
    epoch: 1,
    logs: { seen: { sealed: 0, sealed_digest: d0(DOMAIN.log('seen')), tail: [7] } },
    inventory: null,
    groups: { through: null, current: null },
  };
  const advanced = evaluateFrame(job, record, {
    discovery: { epoch: 1, resets: [], seals: [] },
    cursor: next,
  });
  assert.deepEqual(advanced.violations, []);
  assert.deepEqual(advanced.discovery.verified, { seen: emptyLog('seen') });
  assert.deepEqual(advanced.released.sort(), [st.head, record.discovery.logs.seen.head].sort());
  // row_seen (review finding 5): a reset, and a compaction (a reset, then the
  // live keys sealed again in the same frame), each restart its verified state
  // empty, even with the head the compaction seals.
  const d = d0(DOMAIN.log('row_seen'));
  const rowKeys = Array.from({ length: 1024 }, (_, k) => [`r:${k}`, k % 7]);
  const withRow = (logs) => ({
    contract_version: 2,
    method_index: 0,
    witness: null,
    continuation: {},
    discovery: {
      version: 1,
      epoch: 0,
      logs,
      inventory: null,
      groups: { through: null, current: null },
    },
  });
  const seal = (entries, before) => ({
    log: 'row_seen',
    first: 0,
    entries,
    digest_before: before,
    digest_after: fold(before, entries),
  });
  const first = evaluateFrame(
    job,
    { discovery: null, cursor: null },
    {
      discovery: { epoch: 0, resets: [], seals: [seal(rowKeys, d)] },
      cursor: withRow({ row_seen: { sealed: 1024, sealed_digest: fold(d, rowKeys), tail: [] } }),
    }
  );
  assert.deepEqual(first.violations, []);
  const rowRecord = {
    discovery: { ...first.discovery, verified: clone(first.discovery.logs) },
    cursor: withRow({ row_seen: { sealed: 1024, sealed_digest: fold(d, rowKeys), tail: [] } }),
  };
  const reset = evaluateFrame(job, rowRecord, {
    discovery: { epoch: 0, resets: ['row_seen'], seals: [] },
    cursor: withRow({ row_seen: { sealed: 0, sealed_digest: d, tail: [['r:9', 2]] } }),
  });
  assert.deepEqual(reset.violations, []);
  assert.deepEqual(reset.discovery.verified, { row_seen: emptyLog('row_seen') }, 'a reset');
  assert.deepEqual(reset.released, [first.discovery.logs.row_seen.head]);
  const live = rowKeys.map(([k, n]) => [k, n + 1]);
  const compacted = evaluateFrame(job, rowRecord, {
    discovery: { epoch: 0, resets: ['row_seen'], seals: [seal(live, d)] },
    cursor: withRow({
      row_seen: { sealed: 1024, sealed_digest: fold(d, live), tail: [['r:9', 2]] },
    }),
  });
  assert.deepEqual(compacted.violations, []);
  assert.equal(compacted.discovery.logs.row_seen.segments, 1);
  assert.deepEqual(
    compacted.discovery.verified,
    { row_seen: emptyLog('row_seen') },
    'a compaction'
  );
});

test('good/unavailable_pause_reason.json: one release, its trace kept by every save that follows', () => {
  const fx = load('good/unavailable_pause_reason.json');
  const walk = load('good/lease_incremental_walk.json');
  assert.deepEqual(fx.record.discovery, walk.record.discovery);
  const heads = Object.fromEntries(
    Object.entries(fx.record.discovery.logs).map(([log, st]) => [log, st.head])
  );
  assert.ok(Object.values(heads).includes(null), 'a log with only a tail is released as null');
  const lag = fx.record.discovery.verified.alt_cells;
  assert.notEqual(lag.head, heads.alt_cells, "alt_cells' verified head lags its head");
  const by = new Set(fx.cases.flatMap((c) => c.events.map((e) => e.by)));
  assert.deepEqual([...by].sort(), ['cancel', 'lease_expiry', 'reconciliation', 'store.pause']);
  assert.ok(
    fx.cases.some(
      (c) => c.events.filter((e) => ['store.pause', 'reconciliation'].includes(e.by)).length > 1
    ),
    'a release of a record already released (U1)'
  );
  const messages = causeMessages();
  for (const kase of fx.cases) {
    const got = pauseCase(fx.record, kase);
    assert.deepEqual(got, kase.expect, kase.name);
    assert.deepEqual(got.reason.released, heads, `${kase.name}: every released log and its head`);
    assert.deepEqual(got.discovery.unavailable.released, heads);
    assert.deepEqual([got.discovery.logs, got.discovery.verified], [{}, {}]);
    assert.ok(!Object.hasOwn(got.reason, 'message'), `${kase.name}: the view renders the message`);
    assert.ok(messages[got.reason.cause].includes('Its committed evidence stays readable.'));
    const first = kase.events.find((e) => ['store.pause', 'reconciliation'].includes(e.by));
    assert.equal(
      got.reason.cause,
      first.error_cause ?? first.cause,
      `${kase.name}: the first trace wins`
    );
    assert.notEqual(got.state, 'queued', `${kase.name}: a released job is never requeued`);
  }
});

// Review finding 8, and BB8 6678702125 ruling 5: reconciliation's release
// commits before usage is known, so it must never grow a record. A property over
// every combination of logs; its worst case is one log at its smallest count.
test('§7.4: a release is never larger than the record it replaces, for every combination of logs', () => {
  const deltas = releaseDeltas();
  assert.ok(deltas.length > 20000, `${deltas.length} generated records`);
  assert.deepEqual(
    [...new Set(deltas.map((d) => d.cause))].sort(),
    Object.entries(REFUSAL.full)
      .map(([, r]) => r.cause)
      .concat('segment_missing')
      .filter((c, i, a) => a.indexOf(c) === i)
      .sort(),
    'every cause a full read releases with'
  );
  const worst = Math.max(...deltas.map((d) => d.delta));
  const at = deltas.filter((d) => d.delta === worst);
  assert.ok(worst <= 0, JSON.stringify(at[0]?.pick));
  assert.ok(
    at.every(
      (d) => d.pick.filter((k) => k !== 'absent').length === 1 && d.pick.includes('smallest')
    ),
    'the worst case holds one log, at its smallest count'
  );
  for (const d of deltas) {
    // Each released log's entry collapses to its name and head.
    assert.deepEqual(
      d.after.discovery.unavailable.released,
      Object.fromEntries(Object.entries(d.before.discovery.logs).map(([l, st]) => [l, st.head]))
    );
    assert.equal(d.after.attempt, d.before.attempt, 'the attempt counter is kept');
    assert.deepEqual(
      [d.after.queued_at, d.after.queue_order, d.after.cancel_requested],
      [d.before.queued_at, d.before.queue_order, d.before.cancel_requested],
      'the queue fields are kept'
    );
    if (d.state === 'running')
      assert.deepEqual(
        [d.after.state, d.after.fence, d.after.lease_expires_at],
        [d.before.state, d.before.fence, d.before.lease_expires_at],
        "a running job's lease and fence are untouched"
      );
    else assert.equal(d.after.fence, null);
  }
  // U1: a second release of a released record saves the same bytes.
  const again = deltas[0];
  const twice = pauseCase(
    { discovery: again.after.discovery },
    {
      state: again.after.state,
      reason: again.after.reason,
      events: [{ by: 'reconciliation', cause: 'chain_broken', log: 'seen' }],
    }
  );
  assert.deepEqual({ ...again.after, ...twice }, again.after);
  const text = section('7. Retention, GC roots and crash ordering');
  assert.ok(text.includes(`shrinks by ${-worst} bytes`), `§7.4 states the ${-worst}-byte margin`);
});

test('good/release_fencing.json: a release under a live lease never lets that lease commit', () => {
  const fx = load('good/release_fencing.json');
  for (const kase of fx.cases) assert.deepEqual(fenceCase(fx.record, kase), kase.expect, kase.name);
  const live = fx.cases.find((c) => c.name === 'live_lease_on_another_instance');
  const instances = new Set(live.events.map((e) => e.instance));
  assert.equal(instances.size, 2, 'the release and the lease are on two instances');
  const [, commit] = live.expect;
  assert.equal(
    commit.refused.code,
    'DISCOVERY_UNAVAILABLE',
    'the holder of the fence cannot commit'
  );
  assert.equal(commit.job.fence, live.job.fence, 'and its fence is unchanged');
  // The real path (review H1): the commit's refusal is thrown inside the sink,
  // kept and rethrown, so the pause carries that refusal's own cause and log;
  // it is not a worker reply, so C1 does not check it.
  const pause = live.events[2];
  assert.equal(pause.from, 'sink');
  assert.ok(!Object.hasOwn(pause, 'error_cause') && !Object.hasOwn(pause, 'error_log'));
  assert.deepEqual(
    { code: pause.code, cause: pause.cause, log: pause.log },
    { code: commit.refused.code, cause: commit.refused.cause, log: commit.refused.log }
  );
  // A queued job keeps its queue fields: the release is not store.pause (M6).
  const queued = fx.cases.find((c) => c.job.state === 'queued');
  for (const key of ['queued_at', 'queue_order', 'cancel_requested']) {
    assert.ok(Object.hasOwn(queued.job, key), `the queued job has ${key}`);
    assert.equal(queued.expect.at(-1).job[key], queued.job[key], `${key} is kept`);
  }
  assert.ok(
    fx.cases.some((c) => c.job.state === 'queued' && c.expect.at(-1).job.attempt === c.job.attempt),
    'a queued job keeps its attempt counter'
  );
});

test('good/row_seen_compaction_next_frame.json: a compaction lands whole in one frame, or waits for the next', () => {
  const fx = load('good/row_seen_compaction_next_frame.json');
  for (const rule of readmeRows().get(fx.fixture).rules) assert.ok(WRITE_RULES.includes(rule));
  const frames = fx.frames.map(expandFrame);
  let record = clone(fx.record);
  const results = frames.map((frame, i) => {
    const r = evaluateFrame(fx, record, frame);
    assert.deepEqual(r.violations, [], `frame ${i}`);
    assert.deepEqual(
      {
        record_discovery: r.discovery,
        segments: r.segments.map(({ log, address, bytes }) => ({ log, address, bytes })),
        released: r.released,
      },
      frame.expect,
      `frame ${i}`
    );
    record = { discovery: r.discovery, cursor: frame.cursor };
    return r;
  });
  const b = fx.boundary;
  const live = range(b.live_range);
  assert.ok(b.log_count > 2 * live.length, 'the log holds more than twice its live keys');
  const cutLive = cut(live.map(size));
  assert.equal(cutLive.segments.length, b.seals_needed, 'the live keys need two seals');
  // Frame 1 already carries seals; the compaction would pass FRAME_SEALS, so
  // the step ended before the boundary with no part of it in the frame.
  const [f1, f2] = frames;
  assert.equal(f1.discovery.seals.length, b.frame_seals_before);
  assert.ok(b.frame_seals_before + b.seals_needed > LIMITS.FRAME_SEALS);
  assert.deepEqual(f1.discovery.resets, []);
  assert.ok(!f1.discovery.seals.some((s) => s.log === 'row_seen'));
  // Frame 2 runs it first, and whole: the reset, both seals, the last live key.
  assert.deepEqual(f2.discovery.resets, ['row_seen']);
  assert.ok(f2.discovery.seals.slice(0, b.seals_needed).every((s) => s.log === 'row_seen'));
  assert.ok(compactionWhole(f2, live));
  assert.deepEqual(
    f2.discovery.seals.slice(0, b.seals_needed).map((s) => [s.first, s.first + s.entries.length]),
    cutLive.segments,
    "the compaction's seals are the content cut of the live keys"
  );
  // A restart at the boundary resumes from frame 1's cursor; the compaction's
  // segments depend only on the live keys, so it seals the same bytes.
  const after1 = { discovery: results[0].discovery, cursor: frames[0].cursor };
  const d = d0(DOMAIN.log('row_seen'));
  let digest = d;
  const reseal = cutLive.segments.map(([a, z]) => {
    const entries = live.slice(a, z);
    const s = {
      log: 'row_seen',
      first: a,
      entries,
      digest_before: digest,
      digest_after: fold(digest, entries),
    };
    digest = s.digest_after;
    return s;
  });
  const restart = evaluateFrame(fx, after1, {
    discovery: { epoch: 0, resets: ['row_seen'], seals: reseal },
    cursor: {
      ...f2.cursor,
      discovery: {
        ...f2.cursor.discovery,
        logs: { ...f2.cursor.discovery.logs, seen: f1.cursor.discovery.logs.seen },
      },
    },
  });
  assert.deepEqual(restart.violations, []);
  assert.deepEqual(
    restart.segments.map((s) => s.address),
    results[1].segments.filter((s) => s.log === 'row_seen').map((s) => s.address),
    'the restart seals the same bytes'
  );
  // The split the worker must never emit: a store accepts both frames, but the
  // first holds only part of the compaction, so the log has lost live keys.
  assert.ok(fx.worker_must_not_emit.length >= 1, 'at least one split the worker never emits');
  // Store-only (review L3): its entries and positions are synthetic, so the
  // worker's half of ruling 1 is §6.2's third test, not this file.
  assert.equal(fx.side, 'store');
  assert.ok(
    section('13. Fixtures and validator').includes(
      '`good/row_seen_compaction_next_frame.json` is store-only'
    ),
    '§13 says the compaction fixture is store-only'
  );
  for (const w of fx.worker_must_not_emit) {
    let rec = clone(fx.record);
    const split = w.frames.map(expandFrame);
    for (const frame of split) {
      const r = evaluateFrame(fx, rec, frame);
      assert.deepEqual(r.violations, [], `${w.name}: the store accepts it`);
      rec = { discovery: r.discovery, cursor: frame.cursor };
    }
    assert.equal(w.expect.store, 'accepted');
    assert.equal(
      split.findIndex((frame) => !compactionWhole(frame, live)),
      w.expect.at_frame,
      `${w.name}: a frame holds part of a compaction`
    );
  }
});

for (const rel of GOOD_GROUPS)
  test(`${rel}: retirement only at a two-line boundary, within-line keys and a pending binding`, () => {
    const fx = load(rel);
    const { violations, state } = runGroups(fx);
    assert.deepEqual(violations, []);
    assert.deepEqual(state, fx.expect.state);
    assert.equal(state.discovery.logs.alt_seen.sealed_digest, d0(DOMAIN.log('alt_seen')));
    if (rel === 'good/within_line_inside_group.json') {
      // (3,7), then (7,7) on its higher line, then (3,7) again, accepted: a rule
      // that let a within-line key retire the group would refuse event 4.
      const keys = fx.events.filter((e) => e.op === 'key');
      assert.deepEqual(
        keys.slice(0, 3).map((e) => [e.lines, e.expect]),
        [
          [[3, 7], 'new'],
          [[7, 7], 'new'],
          [[3, 7], 'new'],
        ]
      );
      assert.ok(
        fx.mirror && fx.seen_members.length,
        'the reversed key and primary seen are checked'
      );
      assert.notEqual(canonical(['9:2', 1]), canonical(['9:2', true]));
    }
  });

test('good/witness_cursor_option2.json: the witness sits in cursor v2 and recomputes', () => {
  const fx = load('good/witness_cursor_option2.json');
  const c = fx.cursor;
  const w = c.witness;
  const { violations, folded, suffix } = reconstruct(w.method_id, w, fx.durable_records);
  assert.deepEqual(violations, []);
  assert.equal(folded.length, fx.expect.count);
  assert.equal(suffix, fx.expect.terminal_suffix, 'a partial terminal suffix follows the boundary');
  assert.deepEqual(w.fields, WITNESS_FIELDS_V1, 'the v1 fields');
  assert.equal(w.epoch, c.method_index, 'the witness belongs to the current epoch');
  const bad = [];
  cursorShape(c, c.method_index, (rule, detail) => bad.push({ rule, detail }));
  assert.deepEqual(bad, []);
  for (const key of ['stage', 'position', 'row', 'pending', 'shared_sound'])
    assert.ok(Object.hasOwn(c.continuation, key), `continuation names ${key}`);
  for (const r of fx.durable_records)
    assert.equal(r.method_id, w.method_id, 'durable_records is one method stream');
  // Filtering before resolving matters: the partial terminal parent cannot resolve.
  const tail = fx.durable_records.findIndex((r) => r.kind === 'method_result');
  assert.ok(resolveOne(fx.durable_records, tail).error, 'the terminal parent is incomplete');
  // Resolving matters: reading a detached endpoint unresolved changes the witness.
  const raw = fx.durable_records.filter((r) => r.kind !== 'detail_part').slice(0, w.count);
  assert.notEqual(witnessOf(w.method_id, w.fields, raw).digest, w.digest);
  // Multiplicity: deduplicating by id gives a different witness.
  const ids = new Set();
  const dedup = folded.filter((r) => !ids.has(r.id) && ids.add(r.id));
  assert.ok(dedup.length < folded.length, 'the stream repeats an id');
  assert.notEqual(witnessOf(w.method_id, w.fields, dedup).digest, w.digest);
  // Durable history only: folding in the local tail changes it.
  const overlap = fx.local_records.filter((r) => folded.some((d) => canonical(d) === canonical(r)));
  assert.ok(overlap.length >= 1, 'the local tail overlaps durable history');
  assert.notEqual(
    witnessOf(w.method_id, w.fields, [...folded, ...fx.local_records]).digest,
    w.digest
  );
  // Roles: swapping one record's endpoints changes it.
  const swapped = clone(folded);
  [swapped[0].a, swapped[0].b] = [swapped[0].b, swapped[0].a];
  assert.notEqual(witnessOf(w.method_id, w.fields, swapped).digest, w.digest);
  // Ineligible records are still covered: dropping the multi-token one changes it.
  const multi = folded.findIndex((r) => r.a.token_ids.length > 1);
  assert.ok(multi >= 0);
  assert.notEqual(
    witnessOf(
      w.method_id,
      w.fields,
      folded.filter((_, k) => k !== multi)
    ).digest,
    w.digest
  );
});

for (const rel of fixtureFiles().filter((f) => f.startsWith('bad/')))
  test(`${rel}: violates exactly its rule`, () => {
    const fx = load(rel);
    // Node parses a float such as 1.0 as an integer, so it meets F1 there as F5 (§2.1).
    let expected = [fx.expect.node_detects ?? fx.expect.rule];
    let violations;
    if (fx.kind === 'write') {
      assert.equal(fx.frames.length, 1, 'a bad write fixture is one frame');
      const before = clone(fx.record);
      violations = evaluateFrame(fx, fx.record, fx.frames[0]).violations;
      assert.deepEqual(fx.record, before, 'nothing is written');
      assert.equal(fx.expect.written, 'nothing');
    } else if (fx.kind === 'limit') {
      // The worker refuses first, naming the log whose append passes the cap;
      // a store sent the frame refuses it as a write rule (BB8 6681838131).
      assert.deepEqual(fx.expect.store, REFUSAL.write[fx.expect.rule]);
      assert.equal(fx.expect.written, 'nothing');
      const held = (c) => {
        const r = evaluateFrame(fx, c.record, c.frame);
        return { r, n: membershipHeld(r.discovery.logs, c.frame.cursor.discovery) };
      };
      violations = [];
      // Each case is at one cap: the entries, or the entry bytes, which the
      // store totals from each log's `bytes` (BB8 6693502369, item 30).
      const totals = (c, r) => ({
        entries: membershipHeld(r.discovery.logs, c.frame.cursor.discovery),
        bytes: membershipBytes(r.discovery.logs, c.frame.cursor.discovery),
      });
      const cap = { entries: LIMITS.MEMBERSHIP_ENTRIES, bytes: LIMITS.MEMBERSHIP_BYTES };
      const other = { entries: 'bytes', bytes: 'entries' };
      for (const m of fx.mutants) {
        const before = clone(m.record);
        const { r } = held(m);
        const at = m.cap ?? 'entries';
        const n = totals(m, r);
        assert.deepEqual(m.record, before, `${m.name}: nothing is written`);
        assert.equal(n[at], cap[at] + 1, `${m.name} is one past the ${at} cap`);
        assert.ok(n[other[at]] <= cap[other[at]], `${m.name} is within the other cap`);
        assert.deepEqual(workerMembershipRefusal(m.record, m.frame), m.worker, m.name);
        assert.equal(m.worker.cause, `discovery_${m.log}`);
        violations.push(...r.violations);
      }
      // Each control reaches its cap exactly, and is accepted.
      for (const c of fx.controls) {
        const { r } = held(c);
        const at = c.cap ?? 'entries';
        const n = totals(c, r);
        assert.deepEqual(r.violations, [], `control ${c.name}`);
        assert.equal(n[at], cap[at], `${c.name} is at the ${at} cap`);
        assert.ok(n[other[at]] <= cap[other[at]], `${c.name} is within the other cap`);
        assert.equal(workerMembershipRefusal(c.record, c.frame), null, `${c.name}: emitted`);
      }
      for (const at of ['entries', 'bytes']) {
        const of = (list) => list.filter((c) => (c.cap ?? 'entries') === at).map((c) => c.log);
        assert.deepEqual(
          of(fx.mutants).sort(),
          [...MEMBERSHIP_LOGS].sort(),
          `${at}: a cause per log`
        );
        assert.deepEqual(
          of(fx.controls).sort(),
          [...MEMBERSHIP_LOGS].sort(),
          `${at}: a control per log`
        );
      }
    } else if (fx.kind === 'full') {
      // A full read (reconciliation, resume()) on a store holding a segment
      // whose bytes do not match its address: the job is released with
      // segment_corrupt, logged at error level, and the store does not fail
      // (BB8 6681838131). A lease's walk on the same store refuses
      // STORAGE_CORRUPT and releases nothing.
      const full = evaluateWalk(fx, fx.record.discovery, 'full');
      violations = full.violations.map(({ rule, detail }) => ({ rule, detail }));
      const first = full.violations[0];
      assert.deepEqual(
        { ...REFUSAL.full[first.rule], log: first.log },
        {
          code: fx.expect.code,
          status: fx.expect.status,
          cause: fx.expect.cause,
          log: fx.expect.log,
        },
        'reconciliation names the cause and the log'
      );
      // segment_corrupt is logged at error level (BB8 6681838131).
      if (first.rule === 'F6') assert.equal(fx.expect.logged, 'error');
      else assert.equal(fx.expect.logged, undefined);
      assert.equal(fx.expect.store_fails, false);
      const released = pauseCase(fx.record, {
        state: fx.job_state,
        events: [{ by: 'reconciliation', cause: fx.expect.cause, log: first.log }],
      });
      assert.deepEqual(released, fx.expect.reconciliation);
      const lease = evaluateWalk(fx, fx.record.discovery, 'lease');
      assert.deepEqual(
        {
          rule: rulesOf(lease).join(),
          ...REFUSAL.walk[rulesOf(lease)[0]],
          read: lease.read,
          released: null,
          saved: lease.saved,
        },
        fx.expect.lease
      );
      assert.deepEqual(
        { ...REFUSAL.full[first.rule], log: first.log },
        fx.expect.resume,
        "resume()'s full read releases it the same way"
      );
      // F6 by size (§2.5; BB8 6700200435, condition 7): a file one byte over
      // READER_LIMITS.objectBytes, plain and gzip-marked, is stat'ed and never
      // opened, by the full read or the lease's walk; without it the same
      // store's full read passes.
      if (fx.store.oversized) {
        const bound = codecBounds().storeBytes;
        for (const { address, bytes } of fx.store.oversized) {
          assert.equal(bytes, bound + 1, 'one byte over the bound');
          assert.ok(!full.read.includes(address) && !lease.read.includes(address), 'never read');
        }
        assert.deepEqual(fx.store.forms, ['plain', 'gzip'], 'stored plain and gzip-marked');
        assert.deepEqual(fx.expect.opened, [], 'the file is never opened');
        assert.equal(first.rule, 'F6');
        const { oversized: _o, ...written } = fx.store;
        assert.deepEqual(
          evaluateWalk({ ...fx, store: written }, fx.record.discovery, 'full').violations,
          [],
          'as written, the full read passes'
        );
      } else assert.equal(fx.expect.opened, undefined);
      for (const c of fx.controls ?? []) {
        const got = evaluateWalk({ ...fx, store: c.store }, c.discovery, 'full');
        const v = got.violations[0];
        assert.deepEqual(
          { rule: v.rule, cause: REFUSAL.full[v.rule].cause, log: v.log },
          c.expect,
          c.name
        );
      }
    } else if (fx.kind === 'walk') {
      const got = evaluateWalk(fx, fx.record.discovery, 'lease');
      violations = got.violations;
      // R5's record and list clauses refuse before any read; its junction, on
      // the bytes, once the segments appended since are read (BB8 6693502369).
      assert.deepEqual(
        [got.read, got.saved],
        [fx.expect.lease?.read ?? [], false],
        'refused at R5; nothing saved'
      );
      if (fx.expect.lease) assert.equal(fx.expect.lease.saved, false);
      // A lease's walk never releases (§5.1): the job keeps its chains, and
      // resume()'s full read, which uses neither verified nor the list, decides.
      assert.equal(fx.expect.released, null, 'nothing is released');
      const full = evaluateWalk(fx, fx.record.discovery, 'full');
      assert.deepEqual(full.violations, [], "resume()'s full read passes");
      assert.deepEqual(
        Object.fromEntries(['read', 'addresses', 'verified'].map((k) => [k, full[k]])),
        fx.expect.resume
      );
      assert.deepEqual(
        full.verified,
        fx.record.discovery.logs,
        'it saves the corrected verified heads'
      );
    } else if (fx.kind === 'depth') {
      // BB8 6693502369, item 31: an entry one level past ENTRY_DEPTH, met on a
      // submitted frame, on the worker's emit and read back from a segment.
      assert.equal(entryDepth(fx.entry), LIMITS.ENTRY_DEPTH + 1, 'one level past the bound');
      assert.equal(entryDepth(fx.control), LIMITS.ENTRY_DEPTH, 'the control is at the bound');
      assert.ok(!isEntry(fx.entry) && isEntry(fx.control));
      assert.deepEqual(fx.frame.cursor.discovery.logs[fx.log].tail, [fx.entry]);
      assert.deepEqual(fx.control_frame.cursor.discovery.logs[fx.log].tail, [fx.control]);
      // The store: F1, READER_PROTOCOL, nothing written; the control is accepted.
      const before = clone(fx.record);
      violations = evaluateFrame(fx, fx.record, fx.frame).violations;
      assert.deepEqual(fx.record, before, 'nothing is written');
      assert.deepEqual(fx.expect.store, { ...REFUSAL.write.F1, written: 'nothing' });
      assert.deepEqual(evaluateFrame(fx, clone(fx.record), fx.control_frame).violations, []);
      // The worker's emit: INVARIANT_FAILURE with §3's F1 message (§2.11 (b)).
      const message = INVARIANT_MESSAGES.F1.replace('<log>', fx.log).replace('<what>', DEPTH_WHAT);
      assert.deepEqual(fx.expect.worker_emit, {
        code: 'INVARIANT_FAILURE',
        message,
        emitted: 'nothing',
      });
      const segs = [fx.read_back, fx.read_back_control].map((rb) => rb.store.segments[0]);
      for (const [seg, e] of [
        [segs[0], fx.entry],
        [segs[1], fx.control],
      ])
        assert.deepEqual(seg.entries.at(-1), e, 'the segment holds the entry');
      const py = codecPython({
        emit: [fx.entry, fx.control].map((e) => JSON.stringify(e)),
        segments: segs.map((s) => segmentBytes(s).toString('utf8')),
      });
      assert.deepEqual([py.emit[0].tag, py.emit[0].what], ['F1', DEPTH_WHAT], 'Python: F1');
      assert.equal(py.emit[1].tag, 'passes', 'Python: the control encodes');
      assert.deepEqual(py.segments[0], { rule: 'F3', tag: 'F1' }, 'Python: read back, F3');
      assert.deepEqual(py.segments[1], { rule: null }, 'Python: the control reads back');
      // Read back: F3 on a full read, a lease's walk and the worker's load.
      const rb = fx.read_back;
      const want = fx.expect.read_back;
      assert.equal(want.rule, 'F3');
      assert.deepEqual(rulesOf(evaluateWalk(rb, rb.record.discovery, 'full')), ['F3']);
      assert.deepEqual(want.full_read, { ...REFUSAL.full.F3, released: true });
      assert.deepEqual(rulesOf(evaluateWalk(rb, rb.record.discovery, 'lease')), ['F3']);
      const walkCode = { code: REFUSAL.walk.F3.code, status: REFUSAL.walk.F3.status };
      assert.deepEqual(want.lease_walk, { ...walkCode, released: false });
      assert.deepEqual(rulesOf(evaluateResume(rb)), ['F3']);
      assert.deepEqual(want.worker_load, REFUSAL.resume.F3);
      const rc = fx.read_back_control;
      for (const mode of ['full', 'lease'])
        assert.deepEqual(evaluateWalk(rc, rc.record.discovery, mode).violations, [], mode);
      assert.deepEqual(evaluateResume(rc).violations, [], 'the control loads');
    } else if (fx.kind === 'resume') {
      violations = evaluateResume(fx).violations;
      if (fx.expect.store_outside_reconciliation)
        assert.deepEqual(fx.expect.store_outside_reconciliation, {
          code: 'STORAGE_CORRUPT',
          status: 503,
        });
    } else if (fx.kind === 'cursor') {
      // §3.1: the cursor is built from the fixture's inputs; both sides agree
      // on its bytes. The controls are accepted, each mutant breaks W4 alone.
      assert.deepEqual(
        fx.controls.map((c) => c.name),
        CURSOR_CONTROLS,
        'the controls, exactly'
      );
      assert.deepEqual(
        fx.mutants.map((m) => m.name),
        CURSOR_MUTANTS,
        'the mutants, exactly'
      );
      const run = (c) => {
        const rest = cursorCase(fx.inputs, c.name);
        assert.equal(cbytes(rest), c.bytes, `${c.name}: its canonical bytes`);
        assert.equal(sha(canonical(rest)), c.sha256, `${c.name}: its digest`);
        return {
          rest,
          got: evaluateFrame(fx, { discovery: null, cursor: null }, cursorFrame(rest)),
        };
      };
      for (const c of fx.controls) {
        const { rest, got } = run(c);
        assert.deepEqual(got.violations, [], `control ${c.name}`);
        assert.equal(workerCursorRefusal(rest), null, `${c.name}: the worker emits it`);
      }
      const largest = fx.controls.find((c) => c.name === 'largest');
      assert.ok(
        largest.bytes <= LIMITS.CURSOR_BYTES,
        'the largest cursor the constants allow fits'
      );
      assert.equal(fx.controls.find((c) => c.name === 'at_the_bound').bytes, LIMITS.CURSOR_BYTES);
      violations = [];
      for (const m of fx.mutants) {
        const { rest, got } = run(m);
        assert.deepEqual(rulesOf(got), ['W4'], m.name);
        assert.deepEqual(workerCursorRefusal(rest), m.worker, `${m.name}: the worker's refusal`);
        violations.push(...got.violations);
      }
      assert.equal(
        fx.mutants.find((m) => m.name === 'one_byte_over').bytes,
        LIMITS.CURSOR_BYTES + 1
      );
      const refusalOver = cursorCase(fx.inputs, 'refusal_one_byte_over');
      assert.equal(
        cbytes(Object.values(refusalOver.methods)[0].refusal),
        LIMITS.REFUSAL_BYTES + 1,
        'one refusal one byte past REFUSAL_BYTES'
      );
      // The worker refuses past either byte bound; a number past W4's range
      // names no worker code, because the engine never builds one.
      for (const m of fx.mutants)
        assert.deepEqual(
          m.worker?.code,
          m.name.startsWith('integer_') || m.name.startsWith('number_')
            ? undefined
            : 'INVARIANT_FAILURE',
          `${m.name}: the worker's code`
        );
      // Each INVARIANT_FAILURE names the bound it passed, with its value
      // (BB8 6688972927): REFUSAL_BYTES (543) or CURSOR_BYTES (131072).
      const named = {
        one_byte_over: `CURSOR_BYTES (${LIMITS.CURSOR_BYTES})`,
        refusal_one_byte_over: `REFUSAL_BYTES (${LIMITS.REFUSAL_BYTES})`,
      };
      for (const m of fx.mutants.filter((x) => x.worker))
        assert.ok(m.worker.message.endsWith(`past ${named[m.name]}`), `${m.name} names its bound`);
    } else if (fx.kind === 'reply') {
      // §8, C1: each mutant is a reply that is a protocol failure, releases
      // nothing and names the bad value; each control pauses as before, and the
      // sink errors and the bridge failure are never checked as replies.
      const start = (c) =>
        c.released
          ? releaseOf(fx.record.discovery, c.released.cause, c.released.log)
          : fx.record.discovery;
      for (const c of fx.controls) {
        if (c.reply) assert.equal(checkReply(c.reply), null, `control ${c.name}`);
        assert.deepEqual(replyCase(start(c), c), c.expect, `control ${c.name}`);
        assert.ok(!Object.hasOwn(c.expect, 'logged'), `${c.name}: no bad value is logged`);
      }
      violations = [];
      for (const m of fx.mutants) {
        const bad = checkReply(m.reply);
        assert.ok(bad, `${m.name} is a protocol failure`);
        const got = replyCase(start(m), m);
        assert.deepEqual(got, m.expect, m.name);
        assert.equal(got.discovery, 'unchanged', `${m.name}: nothing is released`);
        assert.ok(
          !Object.hasOwn(got.reason, 'cause') || got.reason.code === 'DISCOVERY_UNAVAILABLE'
        );
        if (bad.value !== null) assert.ok(Buffer.byteLength(bad.value) <= ECHO_BYTES);
        violations.push({ rule: 'C1', detail: bad.message });
      }
      const names = fx.mutants.map((m) => m.name);
      for (const name of REQUIRED_MUTANTS[rel])
        assert.ok(names.includes(name), `the mutants include ${name}`);
      // BB8 6678702125, ruling 4: for each code, a missing, an unknown and a
      // cross-code cause, each a protocol failure.
      const other = { DISCOVERY_UNAVAILABLE: RESOURCE_CAUSES, RESOURCE_LIMIT: WORKER_CAUSES };
      for (const code of Object.keys(other)) {
        const of = fx.mutants.filter((m) => m.reply.error_code === code && !m.released);
        const kinds = new Set(
          of.map((m) => {
            const cause = m.reply.error_cause;
            if (cause === undefined) return 'missing';
            if (other[code].includes(cause)) return 'cross-code';
            if (![...CAUSES, ...RESOURCE_CAUSES].includes(cause)) return 'unknown';
            return 'other';
          })
        );
        for (const kind of ['missing', 'unknown', 'cross-code'])
          assert.ok(kinds.has(kind), `${code}: a ${kind} cause`);
      }
      assert.ok(
        fx.mutants.some((m) => m.reply.error_cause && STORE_CAUSES.includes(m.reply.error_cause)),
        "a worker naming the store's own cause"
      );
      // H1: the errors a Node sink throws, and a bridge failure, are not replies.
      for (const name of REQUIRED_CONTROLS[rel])
        assert.ok(
          fx.controls.some((c) => c.name === name),
          `the controls include ${name}`
        );
      const sinkRL = fx.controls.filter((c) => c.sink?.code === 'RESOURCE_LIMIT');
      assert.ok(sinkRL.some((c) => c.sink.status === 413) && sinkRL.some((c) => !c.sink.status));
      for (const c of sinkRL)
        assert.deepEqual(c.expect.reason, { code: 'RESOURCE_LIMIT' }, `${c.name}: as today`);
      const sinkDU = fx.controls.find((c) => c.sink?.code === 'DISCOVERY_UNAVAILABLE');
      assert.ok(sinkDU.sink.cause && sinkDU.sink.log, 'a sink refusal carries its cause and log');
      assert.equal(sinkDU.expect.reason.cause, sinkDU.sink.cause);
      const echoes = fx.mutants.map((m) => checkReply(m.reply).value);
      assert.ok(echoes.includes(null), 'a missing cause');
      assert.ok(
        fx.mutants.some((m) => {
          const raw = m.reply.error_cause;
          return typeof raw === 'string' && Buffer.byteLength(raw) > ECHO_BYTES;
        }),
        'a cause past the echo bound'
      );
    } else if (fx.kind === 'malformed') {
      // M1 (§2.7; BB8 6709891376, ruling 3): every case but {} is one change
      // to the record of good/lease_incremental_walk.json, which is of the
      // shape. At least the verified mismatch, a wrong-type key and an extra
      // key, over every §7.1 state. Each has exactly its own fault, and
      // reconciliation releases it, as §7.4 gives, into a value that is of the
      // shape. Past the reservation a release that grows is pending, and one
      // that does not is saved at once: at least one of each.
      assert.deepEqual(
        fx.cases.map((c) => c.name),
        MALFORMED_CASES,
        'the cases, exactly'
      );
      for (const fault of ['verified', 'type', 'keys'])
        assert.ok(
          fx.cases.some((c) => c.fault === fault),
          `a case whose fault is ${fault}`
        );
      assert.deepEqual(
        [...new Set(fx.cases.map((c) => c.start.state))].sort(),
        ['cancelled', 'paused', 'queued', 'running'],
        'every state whose discovery §7.1 keeps live'
      );
      assert.deepEqual(
        [...new Set(fx.cases.map((c) => c.past_reservation))].sort(),
        ['pending', 'saved'],
        'a release that grows, and one that does not'
      );
      const walk = load('good/lease_incremental_walk.json');
      assert.deepEqual(fx.record, pick(walk.record, ['id', 'identity_hash']), 'the walk record');
      assert.deepEqual(m1Faults(walk.record.discovery), [], 'the walk record is of the shape');
      violations = [];
      for (const c of fx.cases) {
        const faults = m1Faults(c.discovery);
        assert.deepEqual(faults, [c.fault], `${c.name}: exactly its own fault`);
        violations.push({ rule: 'M1', detail: `${c.name}: ${faults.join()}` });
        // One change from the walk record, or the value {}.
        if (c.name === 'empty_object') assert.deepEqual(c.discovery, {});
        const changed = Object.entries(flatten(c.discovery))
          .filter(([k, v]) => !same(flatten(walk.record.discovery)[k], v))
          .map(([k]) => k);
        const dropped = Object.keys(flatten(walk.record.discovery)).filter(
          (k) => !Object.hasOwn(flatten(c.discovery), k)
        );
        assert.ok(changed.length + dropped.length >= 1, `${c.name}: changed`);
        if (c.name !== 'empty_object')
          assert.ok(
            new Set([...changed, ...dropped].map((k) => k.split('.').slice(0, 2).join('.')))
              .size === 1,
            `${c.name}: one change`
          );
        assert.deepEqual(m1Release(c.start, c.discovery), c.expect, `${c.name}: its release`);
        assert.deepEqual(
          m1Faults(c.expect.discovery),
          [],
          `${c.name}: the release is of the shape`
        );
        const grows = fieldBytes(c.expect) > fieldBytes({ ...c.start, discovery: c.discovery });
        assert.equal(c.past_reservation, grows ? 'pending' : 'saved', `${c.name}: past it`);
      }
      assert.equal(fx.expect.log, null, 'log null');
      assert.equal(fx.expect.logged, 'error', 'logged at error level');
      assert.equal(fx.expect.store_fails, false);
      assert.equal(fx.expect.dispatched, false, 'never dispatched');
      assert.deepEqual(fx.expect.roots, [], 'never a GC root');
      // Null and an absent key hold no discovery state: not M1, never touched.
      assert.deepEqual(
        fx.controls.map((c) => [c.name, Object.hasOwn(c, 'discovery') ? c.discovery : 'absent']),
        [
          ['null', null],
          ['absent', 'absent'],
        ]
      );
      for (const c of fx.controls) assert.equal(c.expect, 'untouched', c.name);
    } else if (fx.kind === 'fallback') {
      // §8, the fallback pause: each case and control under each C1 setting it
      // names; at most one fallback, never after STALE_ATTEMPT, at most three
      // store.pause calls, and the fallback carries no cause, log or release.
      assert.deepEqual(
        fx.cases.map((c) => c.name),
        FALLBACK_CASES,
        'the cases, exactly'
      );
      assert.deepEqual(
        fx.controls.map((c) => c.name),
        FALLBACK_CONTROLS,
        'the controls, exactly'
      );
      assert.equal(fx.fallback_message, fallbackMessage('<code>'));
      violations = [];
      for (const c of [...fx.cases, ...fx.controls]) {
        assert.ok(c.c1.length >= 1, `${c.name}: a C1 setting`);
        for (const c1 of c.c1) {
          const got = fallbackCase(c, c1);
          assert.deepEqual(got, c.expect, `${c.name} (C1 ${c1 ? 'on' : 'off'})`);
          const pauses = got.calls.filter((x) => x.method === 'pause');
          const fell = got.calls.filter((x) => x.fallback);
          assert.ok(fell.length <= 1, `${c.name}: never a second fallback`);
          assert.ok(pauses.length <= 3, `${c.name}: at most three pause calls`);
          for (const [i, x] of got.calls.entries())
            if (x.fallback) assert.notEqual(got.calls[i - 1].refused, 'STALE_ATTEMPT', c.name);
          if (fell.length && got.record.state === 'paused')
            assert.deepEqual(Object.keys(got.record.reason).sort(), ['code', 'message'], c.name);
          if (fell.length && fx.cases.includes(c)) violations.push({ rule: 'C1', detail: c.name });
          if (fx.controls.includes(c))
            assert.equal(pauses.length, 1, `control ${c.name}: one call`);
        }
      }
      // A refused reply's own code is recoverable: the warn and the recovery
      // line name it, with its cause when it has one (BB8 6705927389).
      for (const c of fx.cases) {
        const reply = c.lease.reply;
        if (!reply || !c.expect.calls[0].refused) continue;
        const named = `${reply.error_code}${reply.error_cause !== undefined ? `[${echo(reply.error_cause)}]` : ''}`;
        // A reply refused STALE_ATTEMPT says so, and no other warn does, so
        // a stale reply never reads as a defect (BB8 6707363590).
        const stale =
          c.expect.calls[0].refused === 'STALE_ATTEMPT' ? ' (stale: STALE_ATTEMPT)' : '';
        assert.ok(
          c.expect.warnings.some((w) => w.startsWith(`[reader] worker reply ${named}${stale}: `)),
          `${c.name}: the warn names ${named}${stale}`
        );
        if (!stale)
          assert.ok(
            c.expect.warnings.every((w) => !w.includes('stale')),
            `${c.name}: a reply refused otherwise is not called stale`
          );
        if (c.expect.calls.some((x) => x.fallback) && c.c1.includes(false))
          assert.ok(
            c.expect.errors[0].endsWith(` refusing ${named}`),
            `${c.name}: the recovery line names ${named}`
          );
      }
      // The INVALID_PAUSE cases run with C1 off; the safety net with C1 on.
      for (const name of [
        'cause_outside_every_set',
        'cause_not_a_string',
        'cause_of_the_wrong_family',
        'no_cause_and_a_log_outside_the_set',
        'unavailable_without_a_cause',
      ])
        assert.deepEqual(fx.cases.find((c) => c.name === name).c1, [false], name);
      assert.deepEqual(fx.cases.find((c) => c.name === 'c1_on_safety_net').c1, [true]);
    } else if (fx.kind === 'groups') {
      violations = runGroups(fx).violations;
      assert.equal(violations.at(-1)?.at_event, fx.expect.at_event, 'refused at the named event');
      assert.equal(violations.at(-1)?.cause, fx.expect.cause);
    } else if (fx.kind === 'witness') {
      const base = load(fx.base);
      const w = base.cursor.witness;
      const names = fx.mutants.map((m) => m.name);
      for (const name of REQUIRED_MUTANTS[rel])
        assert.ok(names.includes(name), `the mutants include ${name}`);
      // Controls keep the rule the mutants break, and are accepted.
      for (const m of fx.controls || [])
        assert.deepEqual(
          reconstruct(w.method_id, w, mutantStream(base, m, fx)).violations,
          [],
          `control ${m.name}`
        );
      if (rel === 'bad/terminal_suffix_resume_faults.json') {
        const only = fx.mutants.filter((m) => m.resolver === 'accepts');
        assert.equal(only.length, 9, 'the nine the generic resolver accepts');
        assert.deepEqual(
          [...new Set(only.map((m) => m.fault))].sort(),
          [...MEMBERSHIP_ONLY].sort()
        );
        assert.equal(fx.mutants.filter((m) => m.resolver === 'refuses').length, 15);
        for (const m of fx.mutants)
          assert.equal(m.resolver === 'accepts', MEMBERSHIP_ONLY.includes(m.fault), m.name);
        // Each case is derived from its split point's durable prefix (review
        // M2): read at the resume, the prefix with one fault or one inserted
        // record; read later, the prefix and then the remaining parts, with one
        // fault at the first part the resumed lease writes.
        for (const c of REQUIRED_CONTROLS[rel])
          assert.ok(
            fx.controls.some((k) => k.name === c),
            `the controls include ${c}`
          );
        for (const m of [...fx.mutants, ...fx.controls]) {
          const want = resumeCaseRecords(fx, m);
          assert.deepEqual(
            m.records.map((r) => (plainObject(r) && r.of ? { of: r.of } : r)),
            want.records.map((r) => (plainObject(r) && r.of ? { of: r.of } : r)),
            `${m.name}: derived from its split's durable prefix`
          );
          const got = m.records.find((r) => plainObject(r) && r.of);
          const exp = want.records.find((r) => plainObject(r) && r.of);
          if (exp) {
            assert.deepEqual(Object.keys(got.set), [exp.field], `${m.name}: one field changes`);
            assert.notEqual(got.set[exp.field], fx.named[got.of][exp.field], m.name);
          }
          if (Object.hasOwn(m, 'read'))
            assert.equal(m.read, want.read, `${m.name}: when it is read`);
        }
        assert.deepEqual([...new Set(fx.mutants.map((m) => m.read))].sort(), [
          'later_read',
          'resume',
        ]);
      }
      violations = [];
      for (const m of fx.mutants) {
        const got = reconstruct(
          w.method_id,
          Object.hasOwn(m, 'witness') ? m.witness : w,
          mutantStream(base, m, fx)
        ).violations;
        assert.deepEqual(
          [...new Set(got.map((v) => v.rule))],
          ['S2'],
          `${m.name}: ${JSON.stringify(got)}`
        );
        violations.push(...got);
      }
      expected = [fx.expect.rule];
    } else assert.fail(`unknown kind ${fx.kind}`);
    assert.deepEqual(
      [...new Set(violations.map((v) => v.rule))],
      expected,
      JSON.stringify(violations)
    );
  });

test('the bad fixtures are the named set, and together they cover every rule they name', () => {
  const bad = fixtureFiles().filter((f) => f.startsWith('bad/'));
  assert.deepEqual(bad.map((f) => path.basename(f, '.json')).sort(), Object.keys(BAD).sort());
  for (const f of bad) assert.equal(load(f).expect.rule, BAD[path.basename(f, '.json')], f);
  assert.deepEqual([...new Set(Object.values(BAD))].sort(), [
    'C1',
    'F1',
    'F4',
    'F5',
    'F6',
    'M1',
    'R1',
    'R2',
    'R3',
    'R4',
    'R5',
    'S1',
    'S2',
    'W2',
    'W3',
    'W4',
    'W6',
    'W7',
  ]);
});

test('the contract states the constants, logs, schema, domains and causes this file checks', () => {
  const limits = tableRows(section('3. Hard limits'));
  for (const [name, value] of Object.entries(LIMITS)) {
    const row = limits.find((r) => r[0].includes(`\`${name}\``));
    assert.ok(row, `§3 has a row for ${name}`);
    assert.ok(new RegExp(`\\b${value}\\b`).test(row[1]), `§3 gives ${name} = ${value}`);
  }
  assert.ok(CONTRACT.includes(`\`ENTRY_BYTES = ${LIMITS.ENTRY_BYTES}\``));
  assert.ok(CONTRACT.includes(`\`SEGMENT_ENTRIES = ${LIMITS.SEGMENT_ENTRIES}\``));
  assert.ok(CONTRACT.includes(`\`SEGMENT_BYTES = ${LIMITS.SEGMENT_BYTES}\``));
  const logs = tableRows(section('2. Format').split('### 2.3')[1].split('### 2.4')[0]);
  assert.deepEqual(
    logs.map((r) => r[0].replace(/`/g, '')),
    LOGS,
    '§2.3 lists the closed set of logs'
  );
  assert.deepEqual(
    logs.filter((r) => r[3] === 'yes').map((r) => r[0].replace(/`/g, '')),
    [...RESETTABLE]
  );
  // §2.7's <state> holds the keys the model's states hold, `bytes` among them
  // (BB8 6693502369, item 30), and §2.10's summary the same.
  const stateLine = section('2. Format').match(/^<state> = \{(.*)\}$/m)[1];
  assert.deepEqual(
    [...stateLine.matchAll(/"([a-z_]+)":/g)].map((m) => m[1]),
    Object.keys(emptyLog('seen')),
    '§2.7: <state> holds head, segments, count, bytes and digest'
  );
  const summaryKeys = section('2. Format').match(/"logs":\{"<log>":\{([^}]*)\}\}\}/)[1];
  assert.deepEqual(summaryKeys.replace(/"/g, '').split(','), Object.keys(emptyLog('seen')));
  const schema = section('2. Format').split('### 2.5')[1].split('```')[1];
  assert.deepEqual(
    [...schema.matchAll(/"([a-z_]+)":/g)].map((m) => m[1]),
    SEGMENT_FIELDS
  );
  for (const domain of [DOMAIN.log(''), DOMAIN.inventory, DOMAIN.witness('')])
    assert.ok(
      CONTRACT.includes(`"${domain.replace('\n', '\\n')}"`),
      `the contract names ${JSON.stringify(domain)}`
    );
  const refusals = section('8. Refusals');
  const causes = tableRows(
    refusals.split('The causes:')[1].split('The `RESOURCE_LIMIT` causes')[0]
  );
  assert.deepEqual(
    causes.map((r) => r[0].replace(/`/g, '')),
    CAUSES
  );
  const resource = tableRows(
    refusals.split('The `RESOURCE_LIMIT` causes')[1].split('Every `RESOURCE_LIMIT` raise')[0]
  );
  assert.deepEqual(
    resource.map((r) => r[0].replace(/`/g, '')),
    RESOURCE_CAUSES
  );
  // §8's Log column, for both cause sets, is the one C1 checks. One row says
  // more, and only that one (BB8 6709891376, ruling 2): chain_broken is also
  // a malformed record.discovery's cause, which the store releases with log
  // null (§2.7, §7.4). That release is never a reply, so C1 reads `required`.
  const LOG_EXCEPTIONS = {
    chain_broken: {
      log: 'required, except null for a malformed record (§2.7, §7.4)',
      rule: 'R2, F3 at read; §2.7 shape (malformed record)',
    },
  };
  assert.deepEqual(Object.keys(LOG_EXCEPTIONS), ['chain_broken'], 'one exception, closed');
  for (const [rows, col] of [
    [causes, 3],
    [resource, 2],
  ])
    for (const r of rows) {
      const cause = r[0].replace(/`/g, '');
      const exception = rows === causes ? LOG_EXCEPTIONS[cause] : undefined;
      if (exception) {
        assert.deepEqual([r[1], r[col]], [exception.rule, exception.log], `§8's ${cause} row`);
        assert.equal(CAUSE_LOG[cause], 'required', `C1 holds a ${cause} reply to a log`);
      } else assert.equal(r[col], CAUSE_LOG[cause], `§8's log rule for ${r[0]}`);
    }
  // The store's own cause: raised by the store's full read alone.
  for (const cause of STORE_CAUSES)
    assert.ok(
      /only/.test(causes.find((r) => r[0] === `\`${cause}\``)[2]),
      `§8: ${cause} is the store's alone`
    );
  // §8 lists every RESOURCE_LIMIT raise site the reader reaches (checked
  // against the source in Python, below).
  const sites = tableRows(refusals.split('Every `RESOURCE_LIMIT` raise')[1].split('Plumbing')[0]);
  assert.deepEqual(
    sites.map((r) => [r[0], r[1], r[2]].map((x) => x.replace(/`/g, '').split(':')[0])),
    RAISE_SITES.map(([m, f, c]) => [m, f, c ?? 'none'])
  );
  for (const cause of RESOURCE_CAUSES)
    assert.ok(section('3. Hard limits').includes(`\`${cause}\``), `§3 names ${cause}`);
  // record.discovery.unavailable takes exactly the DISCOVERY_UNAVAILABLE causes (§2.7).
  const unavailable = section('2. Format').split('### 2.7')[1].split('### 2.8')[0];
  for (const cause of CAUSES) assert.ok(unavailable.includes(`"${cause}"`), `§2.7 allows ${cause}`);
  for (const field of ['"verified"', '"released"'])
    assert.ok(unavailable.includes(field), `§2.7's record.discovery has ${field}`);
  for (const table of [REFUSAL.resume, REFUSAL.groups, REFUSAL.full])
    for (const [rule, refusal] of Object.entries(table))
      if (refusal.cause)
        assert.ok(
          causes.some((r) => r[0] === `\`${refusal.cause}\`` && r[1].split(/[ ,]+/).includes(rule)),
          `§8 maps ${rule} to ${refusal.cause}`
        );
  // A lease's walk raises STORAGE_CORRUPT for every rule it checks (§5.1, §8).
  const corrupt = tableRows(refusals).find((r) => r[0] === '`STORAGE_CORRUPT`');
  for (const rule of Object.keys(REFUSAL.walk))
    assert.ok(corrupt[3].includes(rule), `§8's STORAGE_CORRUPT row names ${rule}`);
  assert.ok(!causes.find((r) => r[0] === '`chain_broken`')[1].includes('R5'), 'R5 never releases');
  assert.ok(CONTRACT.includes(`\`MEMBERSHIP_ENTRIES = ${LIMITS.MEMBERSHIP_ENTRIES}\``));
  assert.ok(section('4. Write path').includes('**W7, the membership caps.**'), '§4 states W7');
  assert.ok(
    section('1. Terms').includes(
      `**Membership logs.** ${MEMBERSHIP_LOGS.map((l) => `\`${l}\``)
        .join(', ')
        .replace(/, ([^,]*)$/, ' and $1')}`
    ),
    '§1 names the membership logs'
  );
  assert.ok(
    section('5. Resume path').includes("**R5, the store's own bookkeeping"),
    '§5.1 states R5'
  );
  assert.ok(section('8. Refusals').includes('**U1, the release record.**'), '§8 states U1');
  assert.ok(
    section('8. Refusals').includes('**C1, the cause sets at the reply boundary.**'),
    '§8 states C1'
  );
  assert.ok(
    section('8. Refusals').includes(`at most ${ECHO_BYTES} bytes`),
    '§8 states the echo bound'
  );
  assert.ok(!section('8. Refusals').includes('is dropped'), 'nothing in a reply is dropped');
  assert.ok(
    section('8. Refusals').includes('**U2, the reason follows `unavailable`.**'),
    '§8 states U2'
  );
  for (const text of [
    'only after the record save that sets its new head returns',
    'leaves every list as it was',
    'the outcome is unknown',
  ])
    assert.ok(section('4. Write path').replace(/\s+/g, ' ').includes(text), `§4: ${text}`);
  // Reconciliation follows any foreign writer (3PO 6681823180 (b)).
  assert.ok(!CONTRACT.includes('older image writes'), 'no "after an older image writes"');
  assert.ok(CONTRACT.replace(/\s+/g, ' ').includes('any foreign writer'));
  // row_seen is not assumed empty in the alternate phase (BB8 6681838131).
  assert.ok(!/row_seen`? (is|stays) empty/.test(CONTRACT.replace(/\s+/g, ' ')));
  assert.ok(section('8. Refusals').includes('`reply: true`'), '§8 marks a reply');
  assert.ok(section('8. Refusals').includes('`INVARIANT_FAILURE`'), "§8's whitelist names it");
  assert.ok(
    CONTRACT.includes(JSON.stringify(WITNESS_FIELDS_V1).replace(/,/g, ', ')),
    'the v1 witness fields'
  );
  for (const key of TERMINAL_INPUTS)
    assert.ok(section('2. Format').includes(`\`${key}\``), `§2.8 names the terminal input ${key}`);
});

// BB8 6678599629 (a), 6681838131 and 6682942783 (option (b)): the cap is
// derived from the 30 s first-commit budget with only the per-entry load rate
// scaled, and it bounds the four membership logs together. The arithmetic and
// the document agree.
test('§6.11: MEMBERSHIP_ENTRIES fits the first-commit budget by the contract figures', () => {
  const measured = section('10. Measured on #656, not bounds');
  for (const figure of [
    'walk about 10 ms',
    '20,045 entries × 30.4 µs = 0.6 / 1.5 s',
    'recompute 0.9 / 2.4 s',
    'construct 6.4 / 15.2 s',
    '12,105 entries',
  ])
    assert.ok(measured.includes(figure), `§10 measures ${figure}`);
  const light = { load: 0.6 };
  const loaded = { construct: 15.2, load: 1.5, recompute: 2.4 };
  // The factor is the load's own measured loaded/light ratio, rounded up to a
  // whole factor, and it scales the per-entry load rate only. Construct and
  // recompute enter at their loaded-host measurements (BB8 6682942783); the
  // walk's one figure, not split by host, enters at 3x, as in 8732918312.
  const ratio = loaded.load / light.load;
  const factor = Math.ceil(ratio);
  assert.equal(factor, 3);
  const rate = 30.4e-6 * factor;
  const perSegment = (0.01 / 99) * factor;
  const walk = 5 * LIMITS.CHAIN_SEGMENTS * perSegment;
  const construct = loaded.construct;
  const recompute = loaded.recompute;
  const fixed = construct + recompute + walk;
  const room = Math.floor((30 - fixed) / rate);
  const withMargin = Math.floor((29 - fixed) / rate);
  // BB8 6688972927: 90,975 with the margin, rounded down to 65,536. #656's own
  // entries count inside the cap, so no #656 measurement is a term in it.
  const own = 20045;
  assert.equal(withMargin, 90975, '90,975 with the margin');
  assert.equal(room, 101940);
  const pow2 = (x) => 2 ** Math.floor(Math.log2(x));
  assert.equal(pow2(withMargin), LIMITS.MEMBERSHIP_ENTRIES, '90,975 rounded down to 65,536');
  assert.equal(pow2(room), LIMITS.MEMBERSHIP_ENTRIES, `${room} rounds down to the same power`);
  const atCap = LIMITS.MEMBERSHIP_ENTRIES * rate;
  assert.ok(fixed + atCap <= 29, "the margin holds the first step's 1 s deadline");
  // MEMBERSHIP_BYTES (BB8 6688972927): the per-byte rate measured at
  // 4,096-byte entries (§10), scaled by the same factor, fitted into what the
  // margin leaves beside the per-entry term at its cap. The two terms
  // overcount each other's share, so their sum bounds any mix of entry sizes.
  // The rate §10 measured over the 17 shapes capped at ENTRY_DEPTH (BB8 6693502369).
  const perByteRow = tableRows(measured).find((r) => r[0] === 'load per byte')[1];
  const median = Number(perByteRow.match(/^([\d.]+) ns per entry byte at 4,096-byte entries/)[1]);
  const byteRate = median * 1e-9 * factor;
  const byteRoom = Math.floor((29 - fixed - atCap) / byteRate);
  assert.equal(pow2(byteRoom), LIMITS.MEMBERSHIP_BYTES, 'rounded down to a power of two');
  // The cap stops fitting past this measured rate; twice the cap does not fit.
  const stopsFitting = ((29 - fixed - atCap) / (LIMITS.MEMBERSHIP_BYTES * factor)) * 1e9;
  assert.ok(median <= stopsFitting && fixed + atCap + 2 * LIMITS.MEMBERSHIP_BYTES * byteRate > 29);
  const atBytes = LIMITS.MEMBERSHIP_BYTES * byteRate;
  const both = fixed + atCap + atBytes;
  assert.ok(both <= 29, 'both caps together hold the margin');
  // #656's measured seen and variants entry bytes fit under it.
  const ownBytes = Math.round(19880 * 65.3 + 165 * 240);
  assert.equal(ownBytes, 1337764);
  assert.ok(ownBytes < LIMITS.MEMBERSHIP_BYTES);
  // #656's measured seen and variants are 20,045 entries; the 45,491 left are
  // headroom under the cap, not a measured margin (BB8 6683944548). 16,384, the
  // retracted every-term figure, would not hold them.
  assert.ok(own <= LIMITS.MEMBERSHIP_ENTRIES);
  assert.ok(own > 16384, "16,384 would refuse #656's own primary phase");
  // What the bound leaves out (§12, item 18, ruled): a membership log alone at
  // CHAIN_SEGMENTS, the finish lease's full alt_cells load, and reconciliation
  // inside a lease's lock entry at the default 256 MiB quota, all of it segments.
  const chain = LIMITS.CHAIN_SEGMENTS * LIMITS.SEGMENT_ENTRIES;
  const quotaSegments = Math.floor((256 * 2 ** 20) / (17.5 * 1024));
  const reconcile = quotaSegments * perSegment;
  assert.ok(reconcile > 30 - fixed - atCap, 'reconciliation alone passes the margin');
  const text = section('6. Worker semantics').split('### 6.11')[1];
  const s1 = (x) => `${x.toFixed(1)} s`;
  const s = (x) => `${x.toFixed(2)} s`;
  // An unrounded term, printed to five places: every count is computed from
  // these, so a reader recomputing from the text gets the same counts (nit 3).
  const u = (x) => `${x.toFixed(5)} s`;
  const n = (x) => x.toLocaleString('en-US');
  for (const stated of [
    '6682942783',
    '91.2 µs',
    `| construct | ${s1(construct)} | measured on #656, loaded host (§10), not scaled |`,
    `| recompute | ${s1(recompute)} | measured on #656, loaded host (§10), not scaled |`,
    u(walk),
    u(fixed),
    u(30 - fixed),
    n(room),
    n(withMargin),
    '90,975 with the margin, rounded down to 65,536',
    u(atCap),
    s(fixed + atCap),
    s(30 - fixed - atCap),
    `${(median * factor).toFixed(1)} ns`,
    u(29 - fixed - atCap),
    n(byteRoom),
    'Every count in this section is computed from the unrounded terms',
    `29 − ${u(fixed).slice(0, -2)} − ${u(atCap).slice(0, -2)} = ${u(29 - fixed - atCap)}`,
    `stops fitting only past ${stopsFitting.toFixed(1)} ns per byte`,
    "No #656 entry count is a term in it: #656's own entries count inside the cap.",
    '251.4 ns per byte, the 17 shapes measured up to 2,040 levels deep, which F1 no longer admits',
    'about 2.3-fold the 107.3 ns the five shapes of `465582a78` peaked at on the same host',
    `\`MEMBERSHIP_BYTES = ${LIMITS.MEMBERSHIP_BYTES}\``,
    s(atBytes),
    s(both),
    s(30 - both),
    n(ownBytes),
    n(LIMITS.MEMBERSHIP_BYTES - ownBytes),
    'are a derivation, not a bound',
    'measured, not bounded',
    'bounded by `CHAIN_SEGMENTS`',
    'bounded by `FRAME_SEALS`',
    `\`MEMBERSHIP_ENTRIES = ${LIMITS.MEMBERSHIP_ENTRIES}\``,
    n(LIMITS.MEMBERSHIP_ENTRIES),
    n(own),
    n(LIMITS.MEMBERSHIP_ENTRIES - own),
    'It is never waived',
    n(chain),
    s(chain * rate),
    s(12105 * rate),
    n(quotaSegments),
    s(reconcile),
    'DOMAIN_CAP',
    'never a qualification of a whole lease',
  ])
    assert.ok(text.replace(/\s+/g, ' ').includes(stated), `§6.11 states ${stated}`);
  // The retracted rule survives only as history (BB8 6682942783), and the
  // 81,895 figure is gone everywhere (BB8 6688972927).
  assert.ok(!CONTRACT.includes('81,895') && !CONTRACT.includes('81895'));
  assert.ok(!text.includes('bounded by a constant'), 'the first-commit claim is scoped');
  // Every statement of either cap gives its one value, and the figures at
  // both caps are stated together (BB8 6688972927).
  for (const [name, value] of [
    ['MEMBERSHIP_ENTRIES', LIMITS.MEMBERSHIP_ENTRIES],
    ['MEMBERSHIP_BYTES', LIMITS.MEMBERSHIP_BYTES],
  ])
    for (const m of CONTRACT.matchAll(new RegExp(`\`${name} = (\\d+)\``, 'g')))
      assert.equal(Number(m[1]), value, `every \`${name} = …\` gives ${value}`);
  const flatText = text.replace(/\s+/g, ' ');
  assert.ok(
    flatText.includes(
      `rounded down to a power of two: \`MEMBERSHIP_BYTES = ${LIMITS.MEMBERSHIP_BYTES}\` (${mib(LIMITS.MEMBERSHIP_BYTES)})`
    )
  );
  assert.ok(flatText.includes(`${s(both)}, ${s(30 - both)} under it`), 'both caps: sum and margin');
  assert.ok(
    flatText.includes(`the sum is ${s(fixed + atCap)}, ${s(30 - fixed - atCap)} under the budget`),
    'the entry cap alone: sum and margin'
  );
  assert.ok(text.includes(`${s(30 - both)} margin above`), 'reconciliation against the new margin');
  assert.ok(!text.includes('Every term is at the loaded-host factor'));
  assert.ok(!text.includes('× 3 = 19.2 s') && !text.includes('× 3 = 2.7 s'));
});

// BB8 6688972927, item 2: MEMBERSHIP_BYTES is the worker's byte cap over the
// four membership logs, sealed and tail. An append that passes it refuses with
// the cause of the log it appends to, as MEMBERSHIP_ENTRIES does; the store
// keeps no byte count, so no store rule holds it (§3, §6.11).
function workerMembershipBytesRefusal(held, log, appended) {
  const before = MEMBERSHIP_LOGS.reduce(
    (n, l) => n + (held[l] || []).reduce((m, e) => m + cbytes(e), 0),
    0
  );
  const after = before + appended.reduce((m, e) => m + cbytes(e), 0);
  return after > LIMITS.MEMBERSHIP_BYTES
    ? { code: 'RESOURCE_LIMIT', cause: `discovery_${log}` }
    : null;
}
// The README: a synthetic chain, named by its totals, names its `bytes` too:
// 16 an entry in the membership fixture's entry cases and the compaction
// fixture's record; the byte cases' figure is the cap less three 4,096-byte
// entries (BB8 6693502369, item 30).
test('synthetic chains name their bytes as the README states', () => {
  const states = [];
  const walkStates = (v) => {
    if (Array.isArray(v)) v.forEach(walkStates);
    else if (plainObject(v)) {
      if (same(Object.keys(v), ['head', 'segments', 'count', 'bytes', 'digest'])) states.push(v);
      else Object.values(v).forEach(walkStates);
    }
  };
  const mo = load('bad/membership_over_cap.json');
  for (const c of [...mo.mutants, ...mo.controls]) {
    const before = states.length;
    walkStates(c.record.discovery);
    for (const st of states.slice(before))
      assert.equal(
        st.bytes,
        c.cap === 'bytes' ? LIMITS.MEMBERSHIP_BYTES - 3 * LIMITS.ENTRY_BYTES : 16 * st.count,
        c.name
      );
  }
  const rs = load('good/row_seen_compaction_next_frame.json');
  const row = rs.record.discovery.logs.row_seen;
  assert.equal(row.bytes, 16 * row.count, 'the compaction fixture names 16 an entry');
  assert.ok(README.replace(/\s+/g, ' ').includes('16 an entry in `bad/membership_over_cap.json`'));
});

// BB8 6693502369, item 31: §10's rate is over the 17 shapes capped at
// ENTRY_DEPTH, the ratios it states are its own figures', and the rates at
// the deeper bounds the formula allows leave the cap where it is.
test('§10: the per-byte rate over the capped shapes, and at the deeper bounds', () => {
  const rows = tableRows(section('10. Measured on #656, not bounds'));
  const row = rows.find((r) => r[0] === 'load per byte')[1].replace(/\s+/g, ' ');
  const num = (re) => Number(row.match(re)[1]);
  const median = num(/^([\d.]+) ns per entry byte/);
  const five = num(/peak at ([\d.]+) ns in the same passes/);
  assert.ok(
    row.includes(`over 17 entry shapes, each capped at \`ENTRY_DEPTH\` (${LIMITS.ENTRY_DEPTH})`)
  );
  assert.ok(row.includes(`about ${(median / five).toFixed(1)}-fold`), 'the capped ratio');
  assert.ok(row.includes(`capped at ${LIMITS.ENTRY_DEPTH - 1} inside the entry's own array`));
  assert.ok(row.includes('about 2.3-fold the 107.3 ns'), 'nit 4: the 2.3-fold is against 107.3 ns');
  assert.ok((251.4 / 107.3).toFixed(1) === '2.3' && (251.4 / 102.4).toFixed(1) !== '2.3');
  assert.equal(LOAD_SHAPES.length, 17);
  const factor = 3;
  const walk = 5 * LIMITS.CHAIN_SEGMENTS * (0.01 / 99) * factor;
  const left = 29 - 15.2 - 2.4 - walk - LIMITS.MEMBERSHIP_ENTRIES * 30.4e-6 * factor;
  const stops = (left / (LIMITS.MEMBERSHIP_BYTES * factor)) * 1e9;
  const deeper = rows.find((r) => r[0] === 'load per byte, deeper bounds')[1].replace(/\s+/g, ' ');
  const [, at16, at64] = deeper.match(/worst medians ([\d.]+) and ([\d.]+) ns/).map(Number);
  assert.ok(
    deeper.includes(`capped at ${depthFor(5)} and at 64 instead`),
    'the next bound and the last'
  );
  assert.ok(deeper.includes(`under the ${stops.toFixed(1)} ns at which it stops fitting`));
  // The conclusion the row draws is the derivation's at both deeper rates.
  const keep = [at16, at64].map((r) =>
    mib(2 ** Math.floor(Math.log2(Math.floor(left / (r * 1e-9 * factor)))))
  );
  assert.equal(new Set(keep).size, 1, 'one cap at both deeper bounds');
  assert.ok(
    deeper.includes(
      `so on these measurements a re-derivation at either would keep the cap at ${keep[0]}, under`
    ),
    `§10: a re-derivation at either keeps ${keep[0]}`
  );
  for (const r of [median, at16, at64]) {
    assert.ok(r <= stops, `${r} ns keeps ${LIMITS.MEMBERSHIP_BYTES}`);
    const room = Math.floor(left / (r * 1e-9 * factor));
    assert.equal(2 ** Math.floor(Math.log2(room)), LIMITS.MEMBERSHIP_BYTES, `${r} ns`);
  }
  assert.ok(median < at16 && at16 < at64, 'the rate rises with the bound');
});

// The review of the item 30-31 fold, finding 2: §10's per-byte figures are
// computed here from the committed rows of the measurement, so the text cannot
// drift from what was measured. A measurement, not a bound.
const MEASUREMENT = 'good/membership_load_measurement.json';
test(`${MEASUREMENT}: §10's per-byte figures are the rows' own`, () => {
  const fx = load(MEASUREMENT);
  const m = fx.method;
  const kinds = [...new Set(fx.shapes.map((x) => x.kind))];
  assert.equal(fx.shapes.length, LOAD_SHAPES.length, 'the 17 shapes the validator keys');
  // Every run is five loads of 8 MiB of 4,096-byte entries, four to a segment.
  assert.equal(m.loads_per_run, 5);
  assert.equal(m.entry_bytes, LIMITS.ENTRY_BYTES);
  assert.equal(m.key, 'once', 'keyed by the single pass §2.1 requires');
  for (const r of fx.runs) {
    assert.deepEqual(
      [r.bytes, r.entries, r.segments],
      [m.total_bytes, m.total_bytes / LIMITS.ENTRY_BYTES, m.total_bytes / LIMITS.ENTRY_BYTES / 4]
    );
    assert.ok(r.ns_per_byte_med <= r.ns_per_byte_max, `${r.kind}: the median is at most the max`);
    // The rates are the times per byte, to within the times' last place.
    const tol = (1e-4 * 1e9) / r.bytes;
    assert.ok(Math.abs(r.ns_per_byte_med - (r.median_s * 1e9) / r.bytes) <= tol, r.kind);
    assert.ok(Math.abs(r.ns_per_byte_max - (r.max_s * 1e9) / r.bytes) <= tol, r.kind);
    // A nested kind is capped one level under its bound, inside the entry's own array.
    const d = /^(?:deep|single)_(\d+)_/.exec(r.kind);
    if (d) assert.ok(Number(d[1]) <= r.cap - 1, `${r.kind} within ${r.cap}`);
  }
  const at = (cap) => fx.runs.filter((r) => r.cap === cap);
  const main = at(LIMITS.ENTRY_DEPTH);
  // Every shape, plain and gzipped, in each of two passes.
  const passes = [...new Set(main.map((r) => r.pass))].sort();
  assert.deepEqual(passes, [1, 2]);
  for (const p of passes)
    for (const k of kinds)
      assert.deepEqual(
        main
          .filter((r) => r.pass === p && r.kind === k)
          .map((r) => r.gz)
          .sort(),
        [false, true],
        `pass ${p}: ${k} plain and gzipped`
      );
  assert.equal(main.length, 2 * 2 * kinds.length);
  const top = (rows, f) => rows.reduce((a, r) => (r[f] > a[f] ? r : a));
  const worst = top(main, 'ns_per_byte_med');
  const single = top(main, 'ns_per_byte_max');
  const five = top(
    main.filter((r) => fx.five_shapes.includes(r.kind)),
    'ns_per_byte_med'
  );
  assert.equal(fx.five_shapes.length, 5);
  const sens = [depthFor(5), 64].map((cap) => {
    const rows = at(cap);
    assert.deepEqual([...new Set(rows.map((r) => r.pass))], [1], `capped at ${cap}: one pass`);
    return top(rows, 'ns_per_byte_med').ns_per_byte_med;
  });
  const f1 = (x) => x.toFixed(1);
  // The host's load averages are printed to two places, and rounded half up.
  const up1 = (x) => (Math.round(Math.round(x * 100) / 10) / 10).toFixed(1);
  const rows = tableRows(section('10. Measured on #656, not bounds'));
  const row = rows.find((r) => r[0] === 'load per byte')[1].replace(/\s+/g, ' ');
  const deeper = rows.find((r) => r[0] === 'load per byte, deeper bounds')[1].replace(/\s+/g, ' ');
  // The worst shape, by the name the row gives it.
  const shapeName = /^deep_(\d+)_z$/.exec(worst.kind);
  assert.ok(shapeName, `the worst median is a nested 0: ${worst.kind}`);
  const la = fx.host.load_average_1m;
  for (const stated of [
    `${f1(worst.ns_per_byte_med)} ns per entry byte at 4,096-byte entries: the worst median of five loads of 8 MiB`,
    `over ${fx.shapes.length} entry shapes`,
    'each stored plain and gzipped, in two passes.',
    `The worst median is \`0\` nested ${shapeName[1]} deep, ${worst.gz ? 'gzipped' : 'plain'};`,
    `the worst single load ${f1(single.ns_per_byte_max)} ns.`,
    `peak at ${f1(five.ns_per_byte_med)} ns in the same passes`,
    `about ${f1(worst.ns_per_byte_med / five.ns_per_byte_med)}-fold`,
    `Measured on a ${fx.host.cpus}-CPU Xeon at 2.1 GHz under Python ${fx.host.python.split('.').slice(0, 2).join('.')}`,
    `at one-minute load averages of ${up1(Math.min(...la))} to ${up1(Math.max(...la))}`,
  ])
    assert.ok(row.includes(stated), `§10 states ${stated}`);
  assert.ok(fx.host.cpu.includes('Xeon') && fx.host.cpu.includes('2.10GHz'));
  // The row's list of shapes is the fixture's names, in order, with the runs
  // of one kind of name folded into one phrase.
  const names = fx.shapes.map((x) => x.name);
  const and = (xs) =>
    xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`;
  const plainNest = names.filter((x) => /^empty arrays nested [\d,]+ deep$/.test(x));
  const cappedNest = names.filter((x) => /^empty arrays nested [\d,]+ deep, capped at 7$/.test(x));
  const zeros = names.filter((x) => x.startsWith('`0` nested'));
  const singles = names.filter((x) => x.startsWith('one array nested'));
  const flat = names.filter(
    (x) => ![plainNest, cappedNest, zeros, singles].some((g) => g.includes(x))
  );
  assert.equal(
    flat.length + plainNest.length + cappedNest.length + zeros.length + singles.length,
    names.length
  );
  assert.equal(singles.length, 1);
  const depths = (xs) => xs.map((x) => /nested ([\d,]+) deep/.exec(x)[1]);
  const list = [
    ...flat,
    `empty arrays nested ${and(depths(plainNest))} deep`,
    `empty arrays nested ${and(depths(cappedNest))} deep, each capped at ${LIMITS.ENTRY_DEPTH - 1} inside the entry's own array`,
    and(zeros),
    `and ${singles[0]}`,
  ].join(', ');
  assert.ok(
    row.includes(`(BB8 6693502369): ${list}, each stored plain and gzipped`),
    `§10 lists the shapes: ${list}`
  );
  const longest = depths(singles)[0];
  assert.ok(
    row.includes(`The previous revision's 251.4 ns came from the ${longest}-deep array, gzipped`),
    `the previous worst is the ${longest}-deep array`
  );
  // §6.11 states the passes as the rows give them.
  const passWord = { 1: 'one pass', 2: 'two passes' }[passes.length];
  assert.ok(
    section('6. Worker semantics')
      .replace(/\s+/g, ' ')
      .includes(`each stored plain and gzipped, in ${passWord} (§10; BB8 6693502369)`),
    `§6.11 states ${passWord}`
  );
  assert.ok(
    deeper.includes(
      `the same load, in one pass, with the nested shapes capped at ${depthFor(5)} and at 64 instead: worst medians ${f1(sens[0])} and ${f1(sens[1])} ns`
    )
  );
  assert.ok(
    rows
      .find((r) => r[0] === 'load per byte')[2]
      .includes('the rows are `good/membership_load_measurement.json`')
  );
  // §6.11's rate is §10's worst median as printed, scaled by 3; the exception
  // to the unrounded terms says so, with the unrounded median.
  const s611 = section('6. Worker semantics').split('### 6.11')[1].replace(/\s+/g, ' ');
  const printed = Number(f1(worst.ns_per_byte_med));
  assert.ok(
    s611.includes(
      `| load rate per byte | ${printed} ns per entry byte × 3 = ${f1(printed * 3)} ns |`
    )
  );
  assert.ok(
    s611.includes(
      `with one exception: the per-byte rate enters as printed, §10's worst median of ${worst.ns_per_byte_med} ns rounded to ${printed} ns and scaled to ${f1(printed * 3)} ns, so the byte room below is the unrounded time over ${f1(printed * 3)} ns.`
    )
  );
  assert.notEqual(f1(worst.ns_per_byte_med * 3), f1(printed * 3), 'the rounding moves the rate');
});

test("§6.11: MEMBERSHIP_BYTES refuses one byte past the cap with the appending log's cause", () => {
  // MEMBERSHIP_BYTES / ENTRY_BYTES - 1 entries of exactly ENTRY_BYTES (1,023
  // at 4 MiB) spread over the four logs, the cap less one entry; each log then
  // appends the last 4,096 bytes (accepted, at the cap), or 4,096 and one byte
  // more (refused). Far under MEMBERSHIP_ENTRIES.
  const big = (i) => ['k' + i, 'x'.repeat(LIMITS.ENTRY_BYTES - cbytes(['k' + i, '']))];
  assert.equal(cbytes(big(7)), LIMITS.ENTRY_BYTES);
  const per = LIMITS.MEMBERSHIP_BYTES / LIMITS.ENTRY_BYTES;
  assert.ok(Number.isInteger(per));
  assert.equal(per - 1, 1023, 'the count the comment above gives');
  const held = { seen: [], variants: [], row_seen: [], alt_seen: [] };
  for (let i = 0; i < per - 1; i++) held[MEMBERSHIP_LOGS[i % 4]].push(big(i));
  for (const log of MEMBERSHIP_LOGS) {
    assert.equal(workerMembershipBytesRefusal(held, log, [big(per)]), null, `${log}: at the cap`);
    assert.deepEqual(
      workerMembershipBytesRefusal(held, log, [big(per), 0]),
      { code: 'RESOURCE_LIMIT', cause: `discovery_${log}` },
      `${log}: one byte past the cap`
    );
  }
  const total = MEMBERSHIP_LOGS.reduce((n, l) => n + held[l].length, 0) + 2;
  assert.ok(total < LIMITS.MEMBERSHIP_ENTRIES, 'the byte cap binds first');
  // The same cap at the store, W7, from each log's `bytes` (BB8 6693502369,
  // item 30): the held entries as sealed chains, the append as the new tail.
  const storeCase = (log, appended) => {
    const logs = {};
    const cursorLogs = {};
    for (const l of MEMBERSHIP_LOGS) {
      const st = {
        head: sha(`held ${l}`),
        segments: Math.ceil(held[l].length / 4),
        count: held[l].length,
        bytes: sumBytes(held[l]),
        digest: fold(d0(DOMAIN.log(l)), held[l]),
      };
      logs[l] = st;
      cursorLogs[l] = {
        sealed: st.count,
        sealed_digest: st.digest,
        tail: l === log ? appended : [],
      };
    }
    const cursor = (tails) => ({
      contract_version: 2,
      method_index: 3,
      discovery: {
        version: 1,
        epoch: 3,
        logs: tails,
        inventory: null,
        groups: { through: null, current: null },
      },
      witness: null,
      continuation: {},
    });
    const empty = Object.fromEntries(
      Object.entries(cursorLogs).map(([l, c]) => [l, { ...c, tail: [] }])
    );
    const record = {
      discovery: { version: 1, epoch: 3, logs, verified: clone(logs), unavailable: null },
      cursor: cursor(empty),
    };
    const frame = { discovery: { epoch: 3, resets: [], seals: [] }, cursor: cursor(cursorLogs) };
    return [
      ...new Set(
        evaluateFrame({ job_id: 'j', identity_hash: 'h' }, record, frame).violations.map(
          (v) => v.rule
        )
      ),
    ];
  };
  for (const log of MEMBERSHIP_LOGS) {
    assert.deepEqual(storeCase(log, [big(per)]), [], `${log}: the store accepts the cap`);
    assert.deepEqual(storeCase(log, [big(per), 0]), ['W7'], `${log}: W7 one byte past it`);
  }
  // The document: §3's row, §8's causes and the store's side.
  const limits = tableRows(section('3. Hard limits'));
  const row = limits.find((r) => r[0] === '`MEMBERSHIP_BYTES`');
  assert.ok(row[2].includes('the same cause for each log'), "§3: the worker's causes");
  assert.ok(row[3].startsWith('`READER_PROTOCOL` (W7)'), "§3: the store's W7, from `bytes`");
  const causes = tableRows(section('8. Refusals'));
  for (const log of MEMBERSHIP_LOGS)
    assert.ok(
      causes.find((r) => r[0] === `\`discovery_${log}\``)[1].includes('`MEMBERSHIP_BYTES`'),
      `§8: discovery_${log} is raised by either cap`
    );
});

// BB8 6688972927, items 3–10: the document states each fold.
test('§1, §5, §6.2, §7.2, §8, §12: the completeness ruling is folded (BB8 6688972927)', () => {
  const flat = (t) => t.replace(/\s+/g, ' ');
  const terms = flat(section('1. Terms'));
  assert.ok(terms.includes('Only the store makes one, in reconciliation and in `resume()`'));
  assert.ok(terms.includes('**Complete verified load.**'), '§1 defines the complete verified load');
  const resume = flat(section('5. Resume path'));
  assert.ok(resume.includes('read in full in exactly two places by the store'), '§5.1: two places');
  assert.ok(!/in exactly three places/.test(resume));
  assert.ok(resume.includes('That is a **complete verified load**'), '§5.2 names it');
  assert.ok(resume.includes('On F6 it raises `STORAGE_CORRUPT` and releases nothing'));
  // Item 3: an oversized compaction defers, and §3's FRAME_SEALS row says so.
  const frameSeals = tableRows(section('3. Hard limits')).find((r) => r[0] === '`FRAME_SEALS`');
  assert.ok(
    frameSeals[2].includes('a unit that must be emitted'),
    '§3: units that must be emitted'
  );
  assert.ok(frameSeals[2].includes('compaction is not such a unit'));
  assert.ok(
    flat(section('6. Worker semantics')).includes('it never raises `discovery_frame_seals`')
  );
  // Item 6: a pause releases on the worker's chain_broken too.
  assert.ok(
    flat(section('8. Refusals')).includes('(R1, `chain_broken` from F3 or R2 at its load,')
  );
  // Item 7: an epoch advance's garbage.
  assert.ok(
    flat(section('7. Retention, GC roots and crash ordering')).includes(
      'at an epoch advance, every segment of the logs the advance releases'
    )
  );
  // Item 8: four §6.2 tests everywhere.
  assert.ok(!/\bboth (§6\.2 )?tests\b/i.test(flat(CONTRACT)), 'no "both tests"');
  assert.ok(!CONTRACT.includes('both §6.2 tests'));
  // Item 9: discovery_row_seen's message.
  const rowSeen = tableRows(section('8. Refusals')).find((r) => r[0] === '`discovery_row_seen`');
  assert.ok(rowSeen[3].includes('kept more row pairs than a resume can reload in time'));
  assert.ok(!CONTRACT.includes('pairs of one row'));
  // Item 10: item 25 is ruled in 6682942783 and confirmed in 6684866461.
  const rows = tableRows(section('11. Cross-reference'));
  const r41 = rows.find((r) => r[0] === '41');
  assert.ok(!/25 confirmed as folded \(also/.test(r41[2]), 'row 41 does not claim item 25');
  assert.ok(rows.find((r) => r[0] === '40')[2].includes('confirmed as folded in 6684866461'));
  assert.ok(
    rows.find((r) => r[0] === '46'),
    'row 46 records 6688972927'
  );
  // INVARIANT_FAILURE names its bound.
  // The messages are listed in §3 itself, before §3.1.
  const limits = flat(section('3. Hard limits').split('### 3.1')[0]);
  for (const named of [
    'past REFUSAL_BYTES (543)',
    'past CURSOR_BYTES (131072)',
    'past CONTINUATION_BYTES (8192)',
    'breaks WITNESS_FIELDS (16)',
  ])
    assert.ok(limits.includes(named), `§3: the message names ${named}`);
  // Item 29 stays open.
  assert.ok(
    flat(section('12. Rulings on the items added for confirmation')).includes('29. **Open**')
  );
});

// The review of 465582a78: every statement the completeness ruling folded in
// is pinned where it is made, with its figures computed rather than copied, so
// an edit to any one of them fails here (BB8 6688972927).
test('BB8 6688972927: each fold is pinned where it is stated, with computed figures', () => {
  const flat = (t) => t.replace(/\s+/g, ' ');
  const n = (x) => x.toLocaleString('en-US');
  const s = (x) => `${x.toFixed(2)} s`;
  const item = (k) => {
    const all = section('12. Rulings on the items added for confirmation');
    const m = all.match(new RegExp(`\\n${k}\\. [\\s\\S]*?(?=\\n${k + 1}\\. |\\n### |$)`));
    assert.ok(m, `§12 has item ${k}`);
    return flat(m[0]);
  };
  // The INVARIANT_FAILURE templates: one per bound, each naming the bound and
  // its value, with its slots; §3.2 quotes §3's refusal template exactly.
  assert.deepEqual(Object.keys(INVARIANT_MESSAGES).sort(), [
    'CONTINUATION_BYTES',
    'CURSOR_BYTES',
    'F1',
    'REFUSAL_BYTES',
    'WITNESS_FIELDS',
  ]);
  const slots = {
    REFUSAL_BYTES: ['<method>', '<n>'],
    CURSOR_BYTES: ['<n>'],
    CONTINUATION_BYTES: ['<n>'],
    WITNESS_FIELDS: ['<what>'],
    F1: ['<log>', '<what>'],
  };
  for (const [bound, template] of Object.entries(INVARIANT_MESSAGES)) {
    if (bound === 'F1') {
      // A rule, not a bound: the message names the rule it broke (§2.11 (b)).
      for (const slot of slots.F1) assert.ok(template.includes(slot), `F1: ${slot}`);
      continue;
    }
    assert.ok(template.includes(`${bound} (${LIMITS[bound]})`), `${bound}: names its value`);
    for (const slot of slots[bound]) assert.ok(template.includes(slot), `${bound}: ${slot}`);
    if (bound !== 'WITNESS_FIELDS')
      assert.ok(template.includes(' canonical bytes, past '), `${bound}: the size found`);
  }
  const s32 = CONTRACT.slice(CONTRACT.indexOf('\n### 3.2'), CONTRACT.indexOf('\n## 4.'));
  const quoted = [...s32.matchAll(/`(INVARIANT_FAILURE: [^`]+)`/g)].map((m) => m[1]);
  assert.deepEqual(quoted, [INVARIANT_MESSAGES.REFUSAL_BYTES], '§3.2 quotes §3 exactly');
  // Item 4: a full read is the store's; the finish-time load is a complete
  // verified load, which releases nothing on F6.
  const terms = flat(section('1. Terms'));
  assert.ok(
    terms.includes(
      'It is not a full read: on F6 it raises `STORAGE_CORRUPT` and releases nothing, like a lease-time load'
    )
  );
  assert.ok(!/It is a full read/.test(terms));
  const resume = flat(section('5. Resume path'));
  const places = resume.slice(
    resume.indexOf('1. reconciliation after'),
    resume.indexOf('3. the worker')
  );
  assert.ok(
    places.includes(
      '1. reconciliation after any foreign writer, which includes startup (§7.4): a full read;'
    )
  );
  assert.ok(places.includes('2. `resume()` of a paused or cancelled job: a full read.'));
  assert.ok(
    !places.includes('complete verified load'),
    "§5.1: the store's two places are full reads"
  );
  assert.ok(
    resume.includes(
      "3. the worker's load of `alt_cells` when it builds the terminal record (§5.2), by its paths: a complete verified load, not a full read (§1). It releases nothing on F6"
    )
  );
  const refusals = tableRows(section('8. Refusals'));
  const row = (name) => refusals.find((r) => r[0] === name);
  assert.ok(
    flat(row('`STORAGE_CORRUPT`')[3]).includes(
      "on a lease's walk or the worker's load, the finish-time complete verified load of `alt_cells` included (§5.2), which releases nothing"
    )
  );
  assert.equal(row('`segment_corrupt`')[1], 'F6 at a full read');
  assert.ok(
    flat(row('`segment_corrupt`')[2]).includes(
      "the store's full read only (reconciliation, `resume()`), logged at error level; never a worker, whose loads, the complete verified load of `alt_cells` included, raise `STORAGE_CORRUPT` on F6"
    )
  );
  // §12 item 16 no longer counts a third or fourth full-read place, and the
  // worker's chain_broken releases through the pause.
  const i16 = item(16);
  assert.ok(!i16.includes('Only a full read releases with `chain_broken`.'));
  assert.ok(!/fourth/.test(i16), 'item 16 counts no fourth place');
  assert.ok(
    i16.includes(
      "the worker's `chain_broken` at its load (F3 or R2) is a refusal whose `DISCOVERY_UNAVAILABLE` pause releases"
    )
  );
  assert.ok(i16.includes("no further full-read place (the store's two, as item 14 amends them)"));
  // Item 2, as item 30 amends it: W7 holds both caps, the bytes from each
  // log's `bytes` (BB8 6693502369).
  const write = flat(section('4. Write path'));
  assert.ok(
    write.includes(
      'at most `MEMBERSHIP_ENTRIES` entries and at most `MEMBERSHIP_BYTES` entry bytes together'
    )
  );
  assert.ok(!/W7 does not hold `MEMBERSHIP_BYTES`/.test(flat(CONTRACT)));
  assert.ok(!/the worker's refusal is the bound/.test(flat(CONTRACT)), 'no store-less byte cap');
  for (const log of MEMBERSHIP_LOGS)
    assert.equal(
      row(`\`discovery_${log}\``)[1],
      `\`MEMBERSHIP_ENTRIES\` or \`MEMBERSHIP_BYTES\`, by an append to \`${log}\``,
      `§8: discovery_${log} is raised by an append to ${log}`
    );
  const worker = flat(section('6. Worker semantics'));
  assert.ok(
    worker.includes(
      'until `MEMBERSHIP_ENTRIES` or `MEMBERSHIP_BYTES` stops it with `discovery_row_seen` (§3)'
    ),
    '§6.2: either cap stops a deferred compaction'
  );
  // The derivation's figures, computed (as the §6.11 test computes them).
  const factor = 3;
  const walk = 5 * LIMITS.CHAIN_SEGMENTS * (0.01 / 99) * factor;
  const fixed = 15.2 + 2.4 + walk;
  const rate = 30.4e-6 * factor;
  const withMargin = Math.floor((29 - fixed) / rate);
  const room = Math.floor((30 - fixed) / rate);
  const atCap = LIMITS.MEMBERSHIP_ENTRIES * rate;
  const measured = tableRows(section('10. Measured on #656, not bounds'));
  const perByte = measured.find((r) => r[0] === 'load per byte')[1];
  const median = Number(perByte.match(/^([\d.]+) ns per entry byte at 4,096-byte entries/)[1]);
  const worst = Number(perByte.match(/the worst single load ([\d.]+) ns/)[1]);
  assert.ok(worst >= median && worst <= factor * median, '§10: the factor covers the worst load');
  const shapes = perByte.match(/over (\S+) entry shapes/)[1];
  assert.equal(Number(shapes), LOAD_SHAPES.length, '§10 measures the shapes the validator keys');
  for (const m of CONTRACT.matchAll(/worst of (\S+) (?:entry )?shapes/g))
    if (!/five/.test(m[1]))
      assert.equal(Number(m[1]), LOAD_SHAPES.length, `every "worst of ${m[1]} shapes"`);
  assert.ok(/five loads of 8 MiB \(2,048 entries, 512 segments\)/.test(perByte));
  assert.equal((8 * 2 ** 20) / LIMITS.ENTRY_BYTES, 2048);
  const byteRate = median * 1e-9 * factor;
  const byteRoom = Math.floor((29 - fixed - atCap) / byteRate);
  const MB = LIMITS.MEMBERSHIP_BYTES;
  const atBytes = MB * byteRate;
  const both = fixed + atCap + atBytes;
  const ownBytes = Math.round(19880 * 65.3 + 165 * 240);
  const s611 = flat(section('6. Worker semantics').split('### 6.11')[1]);
  for (const stated of [
    `| load rate per byte | ${median} ns per entry byte × ${factor} = ${(median * factor).toFixed(1)} ns |`,
    `b entry bytes × ${(median * factor).toFixed(1)} ns`,
    `At ${(median * factor).toFixed(1)} ns per byte that is ${n(byteRoom)} bytes`,
    `\`MEMBERSHIP_BYTES = ${MB}\` (${mib(MB)}), combined over the same four logs. Its term is ${s(atBytes)}.`,
    `At 4,096-byte entries it holds ${n(MB / LIMITS.ENTRY_BYTES)} of them, ${n(MB / LIMITS.ENTRY_BYTES / 4)} segments.`,
    `so the cap leaves ${n(MB - ownBytes)} bytes of headroom for the alternate phase, not a measured margin.`,
    `${n(withMargin)} once the first step's 1 s deadline`,
    `or ${n(room)} entries, and`,
    'so on one path the per-entry term plus the per-byte term bounds a load of any mix of entry sizes',
    "and the sum is a derivation over two paths, not a bound on the worker's load",
    'nothing here explains the 8.7-fold gap',
  ])
    assert.ok(s611.includes(stated), `§6.11 states ${stated}`);
  assert.ok(!/so their sum bounds|the per-byte term alone bounds|conservative here/.test(s611));
  // §3's rows state the same derivation.
  const limits = tableRows(section('3. Hard limits'));
  const entriesRow = flat(limits.find((r) => r[0] === '`MEMBERSHIP_ENTRIES`')[1]);
  assert.ok(
    entriesRow.includes(
      `${n(withMargin)} with the margin, rounded down to ${n(LIMITS.MEMBERSHIP_ENTRIES)}`
    )
  );
  assert.ok(!entriesRow.includes(`${n(room)} with the margin`));
  const bytesRow = flat(limits.find((r) => r[0] === '`MEMBERSHIP_BYTES`')[1]);
  assert.ok(bytesRow.startsWith(`${MB} canonical entry bytes (${mib(MB)}) in the same four logs`));
  // §12 items 13 and 25 and §11 row 40 carry the same figures.
  const i13 = item(13);
  assert.ok(i13.includes(`\`MEMBERSHIP_BYTES\` (${mib(MB)}, item 31)`));
  assert.ok(i13.includes(`The ${s(fixed + atCap)} and ${s(both)} at the caps are derivations`));
  const i25 = item(25);
  assert.ok(
    i25.includes(`${n(withMargin)} entries fit in 29 s, the 30 s budget less the 1 s margin`)
  );
  assert.ok(i25.includes(`the sum ${s(fixed + atCap)}, a derivation`));
  assert.ok(i25.includes(`\`MEMBERSHIP_BYTES = ${MB}\``));
  assert.ok(i25.includes(`(${median} ns, the worst of ${LOAD_SHAPES.length} shapes, §10)`));
  assert.ok(i25.includes(`both caps reached the sum is ${s(both)} (§6.11)`));
  const rows = tableRows(section('11. Cross-reference'));
  assert.ok(
    flat(rows.find((r) => r[0] === '40')[2]).includes(
      `${n(withMargin)} entries with the margin, rounded down to \`MEMBERSHIP_ENTRIES = ${LIMITS.MEMBERSHIP_ENTRIES}\``
    )
  );
  assert.ok(flat(rows.find((r) => r[0] === '48')[2]).includes(`\`MEMBERSHIP_BYTES = ${MB}\``));
  assert.ok(
    flat(rows.find((r) => r[0] === '46')[2]).includes('(2 MiB then; re-derived by row 48)')
  );
  // Finding 1: the single-pass key is required, in §2.1 and §5.2.
  const format = flat(section('2. Format'));
  assert.ok(
    format.includes(
      "A Python implementation **must** key its sets by each entry's canonical form as the Python line above writes it, computed once per entry and shared with F5's digest (§5.2)."
    )
  );
  assert.ok(
    format.includes('It **must not** compute a key by calling `canonical_json` on an entry')
  );
  assert.ok(!format.includes('keys its sets by `canonical_json(entry)`'));
  // F1's depth bound keeps every entry under the recursion limit, so
  // canonical_json completes on every entry; the 2,048-level text and the
  // RecursionError caveat are gone (BB8 6693502369, item 31).
  assert.ok(
    format.includes(
      "For this subset its output is identical to `canonical_json`'s (`contracts.py:canonical_json`). `json_safe` recurses once per level, and F1's depth bound keeps every entry far under Python's recursion limit, so both complete on every entry"
    )
  );
  assert.ok(
    !/RecursionError|2,048 levels|wherever `canonical_json` completes|wherever that completes/.test(
      format
    )
  );
  assert.ok(
    resume.includes(
      "**Required** (§2.1): the worker computes each loaded entry's canonical form once, hashes those bytes for F5, and keys its sets by the same bytes"
    )
  );
  assert.ok(resume.includes('It never calls `canonical_json` on a loaded entry.'));
  // Finding 5: the worker half measures its own load before the proof run.
  assert.ok(
    flat(section('9. Compatibility and release')).includes(
      "the worker half measures its own load's per-entry and per-byte rates, and the caps are re-derived if either, scaled by 3, is above §6.11's"
    )
  );
});

// BB8 6678702125, ruling 2: CURSOR_BYTES is INVARIANT_FAILURE only because it
// is derived. The largest cursor §3.1's inputs allow fits it, and §3.1 states
// the figures this builds.
test('§3.1: the largest cursor the constants allow fits CURSOR_BYTES, by the stated figures', () => {
  const inp = load('bad/cursor_over_bound.json').inputs;
  const largest = largestCursor(inp);
  const total = cbytes(largest);
  assert.ok(total <= LIMITS.CURSOR_BYTES, `${total} bytes fit`);
  const [key, entry] = Object.entries(largest.methods)[0];
  const perMethod = cbytes({ [key]: entry }) - 2;
  assert.equal(cbytes(entry.refusal), LIMITS.REFUSAL_BYTES, 'each refusal at its bound');
  // A real refusal's text, not padding: the largest construction in the call
  // closure (§3.2), so this derivation moves with REFUSAL_BYTES.
  const rfx = load('good/refusal_construction.json');
  assert.deepEqual(entry.refusal, rfx.largest.refusal);
  assert.equal(inp.refusal_bytes, LIMITS.REFUSAL_BYTES);
  assert.equal(Buffer.byteLength(canonical(inp.incomplete_reason)), 70);
  assert.ok(largest.witness.fields.every((f) => DOT_PATH.test(f) && f.length === 64));
  // W4 holds a witness field to a dot path of at most 64 bytes, so its
  // canonical form is bounded; anything else is refused.
  const shapeOf = (rest) => {
    const found = [];
    cursorShape(cursorFrame(rest).cursor, rest.method_index, (rule) => found.push(rule));
    return found;
  };
  assert.deepEqual(shapeOf(largest), []);
  for (const f of ['A.b', 'a..b', '.a', 'a"b', 'a'.repeat(65), 'a.é']) {
    const m = clone(largest);
    m.witness.fields = [f];
    assert.deepEqual(shapeOf(m), ['W4'], `witness field ${JSON.stringify(f)}`);
  }
  const parts = {
    methods: cbytes(largest.methods),
    incomplete: cbytes(largest.incomplete),
    refused: cbytes(largest.refused_schemas),
    witness: cbytes(largest.witness),
  };
  const envelope = total - Object.values(parts).reduce((a, b) => a + b, 0);
  const margin = LIMITS.CURSOR_BYTES - total;
  const n = (x) => x.toLocaleString('en-US');
  const text = section('3. Hard limits').split('### 3.1')[1].split('### 3.2')[0];
  const flat = text.replace(/\s+/g, ' ');
  // Each more method costs its entry and a separator.
  const room = Math.floor(margin / (perMethod + 1));
  assert.ok(room * (perMethod + 1) <= margin && (room + 1) * (perMethod + 1) > margin);
  const smaller = LIMITS.REFUSAL_BYTES - rfx.largest_dispatched.bytes;
  for (const stated of [
    `${n(parts.methods)}: ${inp.methods} entries of ${n(perMethod)} bytes each`,
    `| \`incomplete\` | ${n(parts.incomplete)} |`,
    `| \`refused_schemas\` | ${n(parts.refused)} |`,
    `| \`witness\` | ${n(parts.witness)} |`,
    `| the envelope and its separators | ${envelope} |`,
    `| the largest cursor | ${n(total)} |`,
    `\`CURSOR_BYTES = ${LIMITS.CURSOR_BYTES}\``,
    `the largest cursor, ${n(total)} bytes, plus an allowance of ${n(margin)} bytes`,
    `room for ${room} more methods at their fullest (${perMethod + 1} bytes each with its separator)`,
    'holding a refusal of exactly `REFUSAL_BYTES`',
    `${rfx.largest_dispatched.bytes} bytes, each method would be ${smaller} bytes smaller`,
    'the cursor object with its `discovery` and `continuation` members removed',
    `methods ${n(parts.methods)}, incomplete ${n(parts.incomplete)}, refused schemas ${n(parts.refused)}, witness ${n(parts.witness)}, envelope ${envelope}`,
    '6684968306',
    `at most ${inp.methods}, each key at most ${inp.method_id_bytes} bytes`,
    `the ${inp.schemas} schema names, each at most ${inp.schema_name_bytes} bytes`,
    `the longest is ${Buffer.byteLength(inp.incomplete_reason)} bytes (${Buffer.byteLength(canonical(inp.incomplete_reason))} canonical): "${inp.incomplete_reason}"`,
  ])
    assert.ok(text.includes(stated) || flat.includes(stated), `§3.1 states ${stated}`);
  const limits = section('3. Hard limits').replace(/\s+/g, ' ');
  for (const stated of [
    `the largest cursor the constants allow is ${n(total)} bytes`,
    `the largest such cursor, ${n(total)} bytes, plus an allowance of ${n(margin)} bytes`,
    `the largest refusal the dispatch can build is ${rfx.largest_dispatched.bytes} bytes`,
  ])
    assert.ok(limits.includes(stated), `§3's table states ${stated}`);
  // W4 holds every number outside the entries and continuation to an
  // integer from 0 to 2^53 - 1 (§2.8): a count, an index or an epoch.
  for (const [where, v] of [
    ['sequence', 2 ** 53],
    ['method_index', -1],
    ['counters.true', 1.5],
  ]) {
    const m = clone(largest);
    const [a, b] = where.split('.');
    if (b) m[a][b] = v;
    else m[a] = v;
    const found = shapeOf(m).filter((r) => r === 'W4');
    assert.ok(found.length > 0, `${where} = ${v} is refused by W4`);
  }
});

// The review of 2a610d053: CURSOR_BYTES measures the cursor object without its
// discovery and continuation members, and the whole cursor's bound is that,
// plus the largest cursor.discovery W4 accepts, plus CONTINUATION_BYTES, plus
// the two members' keys and separators. W4 holds cursor.discovery to §2.8's
// keys, so that figure is a bound.
test('§3: cursor.discovery has a bound, and the whole cursor is the sum of its parts', () => {
  const inp = load('bad/cursor_over_bound.json').inputs;
  const I = INTEGER;
  // n string entries whose canonical bytes total `bytes`.
  const entriesOf = (count, bytes, tag) =>
    Array.from({ length: count }, (_, i) => {
      const want =
        i < count - 1 ? Math.floor(bytes / count) : bytes - (count - 1) * Math.floor(bytes / count);
      const head = `${tag}${i}:`;
      return head + 'x'.repeat(want - 2 - head.length);
    });
  const discovery = {
    version: 1,
    epoch: I,
    logs: Object.fromEntries(
      LOGS.map((log) => [
        log,
        {
          sealed: I,
          sealed_digest: 'f'.repeat(64),
          tail: entriesOf(LIMITS.SEGMENT_ENTRIES - 1, LIMITS.SEGMENT_BYTES - 1, log),
        },
      ])
    ),
    inventory: { count: I, digest: 'f'.repeat(64) },
    groups: {
      through: [I - 3, I - 2],
      current: { lines: [I - 1, I], keys: entriesOf(LIMITS.GROUP_KEYS, LIMITS.GROUP_BYTES, 'g') },
    },
  };
  for (const log of LOGS) {
    const tail = discovery.logs[log].tail;
    assert.equal(tail.length, LIMITS.SEGMENT_ENTRIES - 1);
    assert.equal(sumBytes(tail), LIMITS.SEGMENT_BYTES - 1, `${log}: the fullest open tail`);
  }
  assert.equal(sumBytes(discovery.groups.current.keys), LIMITS.GROUP_BYTES);
  const continuation = { x: '' };
  continuation.x = 'c'.repeat(LIMITS.CONTINUATION_BYTES - cbytes(continuation));
  assert.equal(cbytes(continuation), LIMITS.CONTINUATION_BYTES);
  const rest = padTo(largestCursor(inp), LIMITS.CURSOR_BYTES);
  const whole = { ...rest, discovery, continuation };
  const found = [];
  cursorShape(whole, I, (rule, why) => found.push([rule, why]));
  assert.deepEqual(found, [], 'W4 accepts the largest whole cursor');
  const D = cbytes(discovery);
  const keys = Buffer.byteLength(',"discovery":') + Buffer.byteLength(',"continuation":');
  assert.equal(keys, 29);
  const W = LIMITS.CURSOR_BYTES + D + LIMITS.CONTINUATION_BYTES + keys;
  assert.equal(cbytes(whole), W, 'the whole cursor is the sum of its parts');
  // Anything larger is refused: a fuller tail, a fuller group, or a key §2.8
  // does not give, at any level of cursor.discovery.
  for (const [what, edit] of [
    ['a tail past SEGMENT_BYTES', (d) => (d.logs.seen.tail[0] += 'x')],
    ['a tail at SEGMENT_ENTRIES', (d) => d.logs.alt_cells.tail.push(0)],
    ['a group past GROUP_KEYS', (d) => d.groups.current.keys.push(0)],
    ['a group past GROUP_BYTES', (d) => (d.groups.current.keys[0] += 'x')],
    ['a key on discovery', (d) => (d.extra = 0)],
    ['a key on a log', (d) => (d.logs.row_seen.extra = [])],
    ['a key on the inventory', (d) => (d.inventory.extra = null)],
    ['a key on groups', (d) => (d.groups.extra = null)],
    ['a key on the current group', (d) => (d.groups.current.extra = null)],
    ['a negative epoch', (d) => (d.epoch = -1)],
    ['a count past the safe range', (d) => (d.logs.seen.sealed = 2 ** 53)],
  ]) {
    const m = clone(whole);
    edit(m.discovery);
    const got = [];
    cursorShape(m, I, (rule) => got.push(rule));
    assert.ok(got.includes('W4'), `${what}: W4`);
  }
  // A number inside an entry is F1's, not W4's: an entry may hold -1.
  const negative = clone(whole);
  negative.discovery.logs.seen.tail[0] = [-1];
  const got = [];
  cursorShape(negative, I, (rule) => got.push(rule));
  assert.deepEqual(got, [], 'an entry holding -1 is not a cursor number');
  const n = (x) => x.toLocaleString('en-US');
  const limits = section('3. Hard limits').replace(/\s+/g, ' ');
  for (const stated of [
    `**\`cursor.discovery\`** is at most ${n(D)} canonical bytes`,
    `a tail of ${n(LIMITS.SEGMENT_ENTRIES - 1)} entries in ${n(LIMITS.SEGMENT_BYTES - 1)} entry bytes with their ${n(LIMITS.SEGMENT_ENTRIES - 2)} separators`,
    `a current group of ${LIMITS.GROUP_KEYS} keys in ${n(LIMITS.GROUP_BYTES)} entry bytes`,
    `${n(LIMITS.CURSOR_BYTES)} + ${n(D)} + ${n(LIMITS.CONTINUATION_BYTES)} + ${keys} = ${n(W)} bytes`,
    '(`,"discovery":` is 13 bytes and `,"continuation":` 16)',
    `the cursor (at most ${n(W)} bytes)`,
  ])
    assert.ok(limits.includes(stated), `§3 states ${stated}`);
  assert.ok(!/about 232 KiB/.test(CONTRACT), 'no "about 232 KiB"');
  assert.ok(
    section('4. Write path').replace(/\s+/g, ' ').includes('hold exactly the keys §2.8 gives'),
    'W4 holds cursor.discovery to its keys'
  );
  assert.ok(
    section('4. Write path')
      .replace(/\s+/g, ' ')
      .includes(
        'every number in the cursor outside its entries and `continuation` is an integer from 0 to 2⁵³ − 1'
      ),
    'W4 holds the cursor numbers'
  );
});

// BB8 6684866461 (§12, item 27): the refusal stays in the cursor, and
// REFUSAL_BYTES is derived from how the adapter builds one. The validator
// walks the source without the dictionary, holds every construction, every
// variable part and every place analysis.py names a refusal to
// good/refusal_construction.json, builds the largest refusal with every
// variable part at its maximum, both independently over the registry and
// schema by schema, and shows the largest of all is REFUSAL_BYTES. That one,
// search_stub_resolution's, is in the call closure but never built by the
// dispatch (the review of 2a610d053; 3PO 6684968306), and the largest the
// dispatch can build is 336 bytes. A declared label of any size reaches no
// refusal: the walk would find a part with no bound, and the labelled runs
// would differ.
test("good/refusal_construction.json: REFUSAL_BYTES is the largest refusal in the adapter's call closure (§3.2)", () => {
  const fx = load('good/refusal_construction.json');
  const cfx = load('bad/cursor_over_bound.json');
  assert.equal(fx.kind, 'refusal');
  assert.deepEqual(fx.expect, { accepted: true });
  const py = refusalPython({ labels: fx.labels, incomplete_reason: cfx.inputs.incomplete_reason });
  // The walk: every construction, and every variable part, is one §3.2 lists.
  assert.deepEqual(py.unbounded, [], 'every variable part of a refusal has a bound (§3.2)');
  assert.deepEqual(py.raised, fx.sources, 'what each raise passes on, and the one store');
  assert.deepEqual(py.spans_from, fx.spans_from, "the span refusal's NoReferent comes from");
  assert.deepEqual(
    py.sites,
    fx.sites.map(({ bytes: _bytes, per_schema: _perSchema, ...site }) => site),
    'the refusal constructions are the ones §3.2 lists; on any change REFUSAL_BYTES is derived again'
  );
  assert.deepEqual(py.messages, fx.messages, 'the NoReferent messages a span refusal can carry');
  assert.deepEqual(py.bounds, fx.bounds, 'each bound, evaluated over the registry');
  // The list is closed (the review of 2a610d053): every place analysis.py
  // names a refusal, in any form, with the statement it sits in, so a write by
  // setdefault, update, += or a second statement is a new entry; _Refused is
  // raised, caught and defined, and used in no other way, here or in any other
  // module; and every call in the engine functions that could copy a refusal
  // with a field changed is listed.
  assert.deepEqual(py.names, fx.names, 'every place analysis.py names a refusal (§3.2)');
  assert.deepEqual(
    fx.names
      .filter((n) => n.target)
      .map((n) => `${n.function} ${n.text}`)
      .sort(),
    [
      '__init__ self.refusal',
      "_finish counts['refusal']",
      "_finish counts['refusal']",
      "_prepare_event counts['refusal']",
      "_sound_result counts['refusal']",
    ],
    "the four writes of counts['refusal'], and _Refused's own field"
  );
  assert.ok(
    fx.names.every((n) => ['subscript', 'call_argument', 'keyword', 'attribute'].includes(n.form)),
    'no dict literal holds a refusal key'
  );
  assert.ok(
    fx.names
      .filter((n) => n.form === 'call_argument')
      .every((n) => n.text === "counts.get('refusal')"),
    'a call names the key only to read it'
  );
  assert.deepEqual(py.refused_uses, fx.refused_uses);
  assert.deepEqual(fx.refused_uses, { raise: 7, except: 1, class: 1 }, 'seven raises (§3.2)');
  assert.deepEqual(py.refused_misuse, [], '_Refused is raised, caught and defined, nothing else');
  assert.deepEqual(py.mutators, fx.mutators, 'every replace or setattr in the engine functions');
  assert.ok(
    fx.mutators.every((m) => !String(m.first).startsWith('Refusal')),
    'none copies a refusal'
  );
  // Every count is a len() of a CPython container, or a counter moving once per
  // element of one: at most sys.maxsize. The word count is two such lengths,
  // the pair count n(n - 1)/2 of it (analysis.py:_sound_candidates).
  const M = 2n ** 63n - 1n;
  const N = 2n * M;
  assert.equal(fx.integer_bound.value, String(M));
  assert.equal(py.maxsize, String(M), 'the reader runs on a 64-bit build');
  for (const k of [
    'skipped',
    "rep['stubs']",
    "len(rep['ambiguous'])",
    "len(rep['unmatched'])",
    "len(rep['no_incipit'])",
  ])
    assert.equal(fx.bounds[k], String(M), `${k} is at most sys.maxsize`);
  assert.equal(fx.bounds['len(toks) + len(missing)'], String(N));
  assert.equal(fx.bounds.total, String((N * (N - 1n)) / 2n));
  // Built again in Node, from the parts and the bounds: the same bytes.
  const longer = (a, b) => (Buffer.byteLength(b) > Buffer.byteLength(a) ? b : a);
  const { 'str(exc)': message, ...rest } = fx.bounds;
  assert.equal(message, fx.messages.map((m) => partValue(m.message, rest)).reduce(longer));
  const built = fx.sites.map((site) => buildRefusal(site, fx.bounds));
  built.forEach((r, i) => {
    assert.equal(cbytes(r), fx.sites[i].bytes, `${fx.sites[i].function}: its largest refusal`);
    assert.equal(cbytes(r), py.sizes[i], `${fx.sites[i].function}: Python builds the same`);
    assert.ok(cbytes(r) <= LIMITS.REFUSAL_BYTES, `${fx.sites[i].function} fits REFUSAL_BYTES`);
  });
  const largest = built.reduce((a, b) => (cbytes(b) > cbytes(a) ? b : a));
  assert.deepEqual(largest, fx.largest.refusal);
  assert.deepEqual(py.largest, fx.largest.refusal);
  assert.equal(cbytes(largest), fx.largest.bytes);
  assert.equal(sha(canonical(largest)), fx.largest.sha256);
  assert.equal(
    fx.largest.bytes,
    LIMITS.REFUSAL_BYTES,
    'REFUSAL_BYTES is the largest refusal itself'
  );
  assert.equal(fx.refusal_bytes, LIMITS.REFUSAL_BYTES);
  const at = fx.sites.filter((site) => site.bytes === fx.largest.bytes);
  assert.equal(at.length, 1, 'one construction is the largest');
  assert.deepEqual([at[0].module, at[0].function], [fx.largest.module, fx.largest.function]);
  assert.deepEqual(cfx.inputs.refusal, fx.largest.refusal, 'the largest cursor holds it (§3.1)');
  // Schema by schema: each construction from one schema's own name,
  // capabilities and span rules, over the schemas its guard selects. Never more
  // than the independent bound; where nothing depends on the schema, the same.
  assert.deepEqual(py.unguarded, [], 'every construction that reads a schema has its guard');
  assert.deepEqual(
    py.per_schema,
    fx.sites.map((site) => site.per_schema)
  );
  const perSchema = (site) => (site.per_schema ? site.per_schema.bytes : site.bytes);
  for (const site of fx.sites)
    assert.ok(perSchema(site) <= site.bytes, `${site.function}: per schema, within its bound`);
  // The largest is in the call closure, and the dispatch never builds it:
  // _stub_resolved_stream returns before search_stub_resolution unless
  // line_status is present, and a real stream is present only for a
  // non-empty line_status with a non-empty label, which search_stub_resolution
  // then reads. Called directly, with no line_status, it builds it.
  assert.equal(fx.largest.function, 'search_stub_resolution');
  assert.deepEqual(JSON.parse(py.reach.direct), fx.largest.refusal, 'built when called directly');
  assert.equal(Buffer.byteLength(py.reach.direct), fx.reach.direct_bytes);
  assert.equal(fx.reach.direct_bytes, LIMITS.REFUSAL_BYTES);
  assert.deepEqual(py.reach.line_status, fx.reach.line_status);
  assert.deepEqual(fx.reach.line_status, { '[]': 'absent', "['']": 'empty', "['x']": 'present' });
  assert.deepEqual(py.reach.guard.slice(0, 2), fx.reach.guards);
  assert.deepEqual(fx.reach.guards, ["sup.state == 'absent'", "sup.state == 'empty'"]);
  for (const n of fx.labels)
    assert.ok(
      !py.runs[String(n)].stub_resolution.includes(py.reach.direct),
      'the dispatch never builds it'
    );
  // The largest the dispatch can build, schema by schema: 3PO's 336.
  const dispatched = fx.sites.filter((site) => site.function !== fx.largest.function);
  assert.equal(dispatched.length, fx.sites.length - 1);
  const top = dispatched.reduce((a, b) => (perSchema(b) > perSchema(a) ? b : a));
  assert.equal(dispatched.filter((site) => perSchema(site) === perSchema(top)).length, 1);
  assert.deepEqual(
    { module: top.module, function: top.function, bytes: perSchema(top) },
    fx.largest_dispatched
  );
  assert.equal(fx.largest_dispatched.bytes, 336, "3PO's 336 (6684968306)");
  // One byte more is refused: by W4 on the store, as INVARIANT_FAILURE by the worker.
  const over = clone(largestCursor(cfx.inputs));
  over.methods[Object.keys(over.methods)[0]].refusal.detail += 'x';
  assert.equal(workerCursorRefusal(over).code, 'INVARIANT_FAILURE');
  assert.ok(workerCursorRefusal(over).message.includes(`REFUSAL_BYTES (${LIMITS.REFUSAL_BYTES})`));
  // The declared label never reaches a refusal: _apply_declarations sets a
  // frame's source only to a constant, reads a declaration's own source only
  // to require one, or hands the beatgrid's to declare_beat, which reads none.
  assert.deepEqual(py.frame_sources, fx.frame_sources);
  for (const [attr, value] of fx.frame_sources)
    assert.ok(['declared', 'none'].includes(value), `${attr} is set to "declared" or "none"`);
  assert.deepEqual(
    py.source_reads,
    fx.source_reads,
    'every read of a source in _apply_declarations'
  );
  for (const [form, text, use] of fx.source_reads)
    assert.ok(
      use === 'not' ||
        (form === 'attribute' && text === 'grid.source' && use === 'BeatGrid(source=)') ||
        (form === 'attribute' &&
          text === 'self.source' &&
          use.startsWith('grid = decode_beatgrid(self.source,')),
      `${text}: read to require one, or the beatgrid's passed to declare_beat, or the reading`
    );
  assert.equal(fx.source_reads.filter((r) => r[2] === 'not').length, 3);
  assert.deepEqual(py.beat_source_reads, [], 'declare_beat and _beat_from_grid read no source');
  // The real _candidates, _full_shape and _stub_resolved_stream, on streams
  // whose every frame carries a source label of 1, 4,096 and 65,536 bytes (and
  // whose line_status is empty, blank or that label).
  assert.deepEqual(fx.labels, [1, 4096, 65536]);
  assert.deepEqual(py.run_errors, [], 'every builder runs on the stand-in streams');
  const first = py.runs[String(fx.labels[0])];
  for (const n of fx.labels)
    assert.deepEqual(py.runs[String(n)], first, `a ${n}-byte label builds the same refusals`);
  for (const [family, want] of Object.entries(fx.label_runs)) {
    const sizes = first[family].map((t) => Buffer.byteLength(t));
    assert.equal(sizes.length, want.refusals, `${family}: its refusals`);
    assert.equal(Math.max(...sizes), want.largest, `${family}: its largest`);
    assert.ok(Math.max(...sizes) <= LIMITS.REFUSAL_BYTES, `${family} fits REFUSAL_BYTES`);
  }
  // §3.2 states the derivation this builds.
  const text = section('3. Hard limits').split('### 3.2')[1];
  const flat = text.replace(/\s+/g, ' ');
  for (const stated of [
    '6684866461',
    '6684968306',
    `\`REFUSAL_BYTES = ${LIMITS.REFUSAL_BYTES}\``,
    String(M),
    'INVARIANT_FAILURE',
    '187 bytes',
    '4,607',
    'not an adapter regression',
    '`good/refusal_construction.json`',
    'never builds',
    'conservative',
    `${fx.largest_dispatched.bytes} bytes`,
    '`beatgrid`',
    '`stub_resolution`',
    '`stanzas`',
  ])
    assert.ok(flat.includes(stated), `§3.2 states ${stated}`);
  const rows = tableRows(text.split('**The largest refusal.**')[1].split('- **The bound.**')[0]);
  const key = (fn, bytes, per) => `${fn} ${bytes} ${per}`;
  assert.deepEqual(
    rows.map((r) => key(r[0].match(/^`(\w+)`/)[1], r[2], r[3].match(/^\d+/)[0])).sort(),
    fx.sites.map((site) => key(site.function, site.bytes, perSchema(site))).sort(),
    "§3.2's table gives every construction's largest refusal, both ways"
  );
  for (const site of fx.sites.filter((s) => s.per_schema && s.per_schema.bytes < s.bytes))
    assert.ok(
      rows.some((r) => r[3].includes(site.per_schema.schema)),
      `§3.2 names ${site.per_schema.schema}`
    );
  for (const r of fx.sources)
    assert.ok(flat.includes(`\`${r.function}\``), `§3.2 names ${r.function}`);
  // 3PO's 6684847656: the lower-level RL.realise detail is context only, and
  // cursor_refusal_bytes is gone with the RESOURCE_LIMIT classification.
  assert.ok(!CONTRACT.includes('`cursor_refusal_bytes`') || /retired|gone/.test(flat));
  assert.ok(!RESOURCE_CAUSES.includes('cursor_refusal_bytes'));
  // Nowhere does the contract call 543 a refusal the adapter builds.
  const all = CONTRACT.replace(/\s+/g, ' ');
  for (const claim of [
    'the largest refusal the adapter can construct',
    'the actual refusal, not padding',
    'the actual refusal,',
  ])
    assert.ok(!all.includes(claim), `no "${claim}"`);
});

// 3PO's item 24, kept by BB8 6683944548: a non-terminal record inserted after
// the terminal suffix is a test of its own, separate from the contribution
// inserted before the terminal parent at each split point.
test('§6.9: the post-terminal insertion test stays separate from the prefix case (item 24)', () => {
  const wfx = load('good/witness_cursor_option2.json');
  const sfx = load('bad/terminal_suffix_not_contiguous.json');
  const rfx = load('bad/terminal_suffix_resume_faults.json');
  const method = wfx.cursor.witness.method_id;
  const witness = wfx.cursor.witness;
  const terminalRecord = (r) =>
    (r.kind === 'method_result' || r.kind === 'detail_part') && r.method_id === method;
  // After the suffix: the complete suffix, then one contribution.
  const post = mutantStream(
    wfx,
    sfx.mutants.find((m) => m.name === 'contribution_after_suffix')
  );
  const complete = mutantStream(
    wfx,
    sfx.controls.find((c) => c.name === 'complete_suffix')
  );
  assert.deepEqual(post.slice(0, -1), complete, 'the complete suffix comes first');
  assert.ok(!terminalRecord(post.at(-1)), 'then a non-terminal record');
  assert.ok(reconstruct(method, witness, post).violations.length > 0, 'refused, RESULT_EXPIRED');
  assert.equal(reconstruct(method, witness, complete).violations.length, 0);
  // Before the terminal parent: the contribution-prefix case at each split point.
  const prefix = rfx.mutants.filter((m) => m.fault === 'inserted_record');
  assert.deepEqual(
    prefix.map((m) => m.split),
    ['after_parent', 'after_part_0', 'after_part_1']
  );
  for (const m of prefix) {
    const stream = mutantStream(wfx, m, rfx);
    const parent = stream.findIndex((r, i) => i >= rfx.boundary && r.kind === 'method_result');
    assert.ok(parent > rfx.boundary, `${m.name}: a record sits before the terminal parent`);
    assert.ok(
      stream.slice(rfx.boundary, parent).every((r) => !terminalRecord(r)),
      `${m.name}: the inserted record is a contribution`
    );
    assert.ok(stream.slice(parent).every(terminalRecord), `${m.name}: nothing after the suffix`);
  }
  const text = section('6. Worker semantics')
    .split('### 6.9')[1]
    .split('### 6.10')[0]
    .replace(/\s+/g, ' ');
  for (const name of ['contribution_after_suffix', 'inserted_record', 'a test of its own'])
    assert.ok(text.includes(name), `§6.9 names ${name}`);
});

// BB8 6683944548's correction: "row_seen live at 6 of 42 boundaries" is 3PO's
// two-line synthetic fixture, not Whitman, and the 45,491 entries left under the
// cap for Whitman's alternate phase are headroom, not a measured margin.
test('the attribution of the row_seen figure and the headroom (BB8 6683944548)', () => {
  const flat = CONTRACT.replace(/\s+/g, ' ');
  for (const m of flat.matchAll(/6 of 42 boundaries/g)) {
    const around = flat.slice(Math.max(0, m.index - 300), m.index + 300);
    assert.ok(/synthetic/.test(around), 'the 6-of-42 figure is named as the synthetic fixture');
  }
  for (const m of flat.matchAll(/45,491/g)) {
    const around = flat.slice(Math.max(0, m.index - 300), m.index + 300);
    assert.ok(/headroom/.test(around), '45,491 is named as headroom');
  }
  assert.ok(!/about 45k left/.test(flat), 'no "about 45k left"');
  assert.ok(!/an expectation, not a guarantee/.test(flat));
});

// §12: every item BB8 ruled is marked with its ruling; only item 29 is open.
test('§12: items 21-28 carry their rulings, 30-32 are ruled and folded, and only 29 is open', () => {
  const text = section('12. Rulings on the items added for confirmation');
  const item = (n) => {
    const m = new RegExp(`\\n${n}\\. \\*\\*([^*]+)\\*\\*`).exec(text);
    assert.ok(m, `§12 has item ${n}`);
    return m[1];
  };
  for (const n of [21, 22, 23, 25, 26, 27, 28])
    assert.match(item(n), /^Ruled/, `item ${n} is ruled`);
  assert.match(item(24), /^3PO's/, "item 24 is 3PO's");
  assert.match(item(29), /^Open/, 'item 29 stays open');
  // R2's two questions of 6693449409: BB8 ruled both yes (6693502369), and
  // this revision folds both; item 31's value waits on the declared shapes.
  assert.equal(item(30), 'Ruled: yes, folded');
  assert.equal(item(31), 'Ruled: yes, folded; its value is open');
  const body = (n) =>
    text.match(new RegExp(`\\n${n}\\. [\\s\\S]*?(?=\\n\\d+\\. |\\n#|$)`))[0].replace(/\s+/g, ' ');
  for (const n of [30, 31]) assert.ok(body(n).includes('(BB8 6693502369; asked in 6693449409)'));
  assert.ok(!/not yet folded|Until the next revision folds/.test(text), 'nothing waits on a fold');
  assert.ok(body(31).includes('**Open for BB8:**'), "item 31's value is open for BB8");
  assert.ok(/ENTRY_DEPTH/.test(section('2. Format')), '§2.1 carries ENTRY_DEPTH');
  // BB8 6700200435 on R2's seven questions of the Node-side plan: item 32,
  // which names condition (3) and its fixture from Step 4 on.
  assert.equal(item(32), 'Ruled: accepted, with conditions');
  assert.ok(body(32).includes('(BB8 6700200435,'), 'item 32 names its ruling');
  assert.ok(body(32).includes('`bad/reply_pause_refused.json`'), 'item 32 names its fixture');
  assert.ok(text.replace(/\s+/g, ' ').includes('Item 32 is ruled by 6700200435.'));
  assert.ok(!/\n33\. /.test(text), 'no item 33');
  assert.ok(text.replace(/\s+/g, ' ').includes('Only item 29 is open, for the proof run.'));
  assert.ok(!/Items 29, 30 and 31 are open/.test(text));
  assert.ok(text.includes('6684866461') && text.includes('6683944548'));
  assert.ok(!/Items 21–2\d and 26–29 are open/.test(text));
});

test('the cross-reference covers 3PO 1-6 and BB8 1-9, each with a contract section', () => {
  const rows = tableRows(section('11. Cross-reference'));
  const sections = new Set(
    [...CONTRACT.matchAll(/^#{2,3} (\d+(?:\.\d+)?)\.? /gm)].map((m) => m[1])
  );
  const sources = rows.map((r) => r[1].replace(/ \(.*\)$/, ''));
  for (let n = 1; n <= 6; n++) assert.ok(sources.includes(`3PO ${n}`), `3PO ${n}`);
  for (let n = 1; n <= 9; n++) assert.ok(sources.includes(`BB8 ${n}`), `BB8 ${n}`);
  rows.forEach((r, i) => {
    assert.equal(r[0], String(i + 1), 'numbered rows');
    const cited = [...r[3].matchAll(/§(\d+(?:\.\d+)?)/g)].map((m) => m[1]);
    for (const s of cited) assert.ok(sections.has(s), `row ${r[0]} cites §${s}, which exists`);
    for (const f of r[4].matchAll(/`((?:good|bad)\/[a-z0-9_]+\.json)`/g))
      assert.ok(fs.existsSync(path.join(DIR, f[1])), `row ${r[0]} names ${f[1]}, which exists`);
  });
});

// ================================================================ §2.11: codec errors (BB8, #721 items 2-3)
// The codec raises a local error with a rule tag and the enclosing operation
// maps it; the codec never picks a public code. good/codec_error_mapping.json
// pins each tag in Node and in Python and each operation's mapping.
const CODEC = 'good/codec_error_mapping.json';
const WHITESPACE = ' \t\r\n';
// An input of the codec fixture, as bytes' text (README: the build forms).
function codecText(input) {
  if (typeof input.text === 'string') return input.text;
  const b = input.build;
  const a = (n) => 'a'.repeat(n);
  if (Object.hasOwn(b, 'string')) return JSON.stringify(a(b.string));
  if (Object.hasOwn(b, 'object_string')) return `[{"a":"${a(b.object_string)}"}]`;
  if (Object.hasOwn(b, 'surrogate_string')) return `["\\ud800${a(b.surrogate_string)}"]`;
  const pad = Array.from({ length: b.pad }, (_, i) => WHITESPACE[i % 4]).join('');
  const tokens = [...(b.lead === null ? [] : [String(b.lead)]), ...Array(b.zeros).fill('0')];
  return `[${pad}${tokens.join(`${pad},${pad}`)}${pad}]`;
}
// Node's reader of one entry's text: the tag it meets, or 'passes'.
function nodeTag(text) {
  let v;
  try {
    v = JSON.parse(text);
  } catch {
    return { tag: 'JSON' };
  }
  if (!isEntry(v)) return { tag: 'F1' };
  if (size(v) > LIMITS.ENTRY_BYTES) return { tag: 'F2' };
  return { tag: 'passes', canonical: JSON.stringify(v) };
}
// The validator's model of the Python codec: tags only, never a code (§2.11).
// Its decoder is json.loads with the subset's hooks; its encoder makes §2.11
// (d)'s two passes, the F1 walk and then the encoder with its F2 bound. The
// reference for the worker half is the #721 author's codec, which its own tests
// hold to this fixture and to §9's required calls.
const CODEC_PROGRAM = String.raw`import json, re, sys, tracemalloc
MAX = (1 << 53) - 1
DEPTH = ${LIMITS.ENTRY_DEPTH}
DEEP = "${DEPTH_WHAT}"
PAST = "an integer past 2⁵³ − 1"
SURROGATE = re.compile("[\ud800-\udfff]")
class Tag(Exception):
    def __init__(self, rule, what=None):
        self.rule = rule
        self.what = what
def _float(_):
    raise Tag("F1", "a float")
def _constant(_):
    raise Tag("F1", "a nonfinite number")
def _object(_):
    raise Tag("F1", "an object")
def _int(text):
    if len(text.lstrip("-")) > 16:
        raise Tag("F1", PAST)
    v = int(text)
    if not -MAX <= v <= MAX:
        raise Tag("F1", PAST)
    return v
# Pass 1: the F1 walk. It serialises nothing and holds one iterator per open
# array, so it allocates with the depth, not the width.
def f1_walk(value):
    active, path, stack = set(), [], [iter((value,))]
    while stack:
        for x in stack[-1]:
            t = type(x)
            if t is list:
                if id(x) in active:
                    raise Tag("F1", "a cyclic array")
                # The depth bound: one iterator per open array, so its depth
                # is the stack's (BB8 6693502369, item 31).
                if len(stack) > DEPTH:
                    raise Tag("F1", DEEP)
                active.add(id(x))
                path.append(id(x))
                stack.append(iter(x))
                break
            if t is str:
                if SURROGATE.search(x):
                    raise Tag("F1", "a lone surrogate")
            elif t is int:
                if not -MAX <= x <= MAX:
                    raise Tag("F1", PAST)
            elif t is float:
                raise Tag("F1", "a float" if x - x == 0 else "a nonfinite number")
            elif t is dict:
                raise Tag("F1", "an object")
            elif not (x is None or t is bool):
                raise Tag("F1", "a value of another type")
        else:
            stack.pop()
            if path:
                active.discard(path.pop())
# Pass 2, only for an entry pass 1 found clean: the encoder and its F2 bound.
def canonical_bytes(value):
    f1_walk(value)
    out = json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    if len(out) > 4096:
        raise Tag("F2")
    return out
def decode_entry(data):
    if isinstance(data, str):
        data = data.encode("utf-8", "surrogatepass")
    try:
        text = data.decode("utf-8", "strict")
    except UnicodeDecodeError:
        raise Tag("JSON")
    try:
        v = json.loads(text, parse_float=_float, parse_constant=_constant, parse_int=_int,
                       object_pairs_hook=_object)
    except Tag:
        raise
    except (ValueError, RecursionError):
        raise Tag("JSON")
    return canonical_bytes(v)
def require_integer(v, nonnegative=False):
    if type(v) is not int or not -MAX <= v <= MAX or (nonnegative and v < 0):
        raise Tag("INTEGER_FIELD")
    return v
def tag_of(fn, *a):
    try:
        out = fn(*a)
        return {"tag": "passes", "what": None,
                "canonical": out.decode("utf-8") if isinstance(out, bytes) else None}
    except Tag as t:
        return {"tag": t.rule, "what": t.what}
# A persisted segment, F6 passed: any tag on its content is F3 (§2.5).
def segment(data):
    try:
        try:
            text = data.decode("utf-8", "strict")
        except UnicodeDecodeError:
            raise Tag("JSON")
        seg = json.loads(text, parse_float=_float, parse_constant=_constant)
        for f in ("epoch", "first", "count"):
            require_integer(seg[f], nonnegative=True)
        for e in seg["entries"]:
            canonical_bytes(e)
    except Tag as t:
        return {"rule": "F3", "tag": t.rule}
    except (ValueError, KeyError, TypeError):
        return {"rule": "F3", "tag": "JSON"}
    return {"rule": None}
# One call as §9 writes it: its arguments are built before tracing starts, so
# the peak is the codec's own work.
NAMES = {"require_integer": require_integer, "decode_entry": decode_entry,
         "canonical_bytes": canonical_bytes}
def call(expr):
    name, args = re.fullmatch(r"(\w+)\((.*)\)", expr, re.S).groups()
    a, k = eval("(lambda *a, **k: (a, k))(" + args + ")", {"__builtins__": {}})
    tracemalloc.start()
    try:
        NAMES[name](*a, **k)
        got = {"rule": None, "what": None}
    except Tag as t:
        got = {"rule": t.rule, "what": t.what}
    got["peak"] = tracemalloc.get_traced_memory()[1]
    tracemalloc.stop()
    return got
data = json.loads(sys.stdin.buffer.read().decode("utf-8"))
enc = lambda s: s.encode("utf-8", "surrogatepass")
out = {"entries": [tag_of(decode_entry, enc(t)) for t in data["entries"]],
       "emit": [tag_of(canonical_bytes, json.loads(t)) for t in data["emit"]],
       "integers": [tag_of(require_integer, v) for v in data["integers"]],
       "segments": [segment(enc(s)) for s in data["segments"]]
                   + [segment(bytes.fromhex(h)) for h in data["segments_hex"]],
       "calls": [call(c) for c in data["calls"]]}
deep = []
for _ in range(data["deep"] - 1):
    deep = [deep]
out["deep"] = canonical_bytes(deep).decode("utf-8") if data["deep"] else None
# Item 3: the padded entry passes within the bound, its peak memory measured.
raw = data["padded"].encode("utf-8")
tracemalloc.start()
got = tag_of(decode_entry, raw)
out["padded"] = {"raw_bytes": len(raw), "peak": tracemalloc.get_traced_memory()[1], **got}
tracemalloc.stop()
sys.stdout.buffer.write(json.dumps(out).encode("ascii"))
`;
function codecPython(input) {
  const run = spawnSync('python3', ['-I', '-c', CODEC_PROGRAM], {
    input: Buffer.from(
      JSON.stringify({
        entries: [],
        emit: [],
        integers: [],
        segments: [],
        segments_hex: [],
        calls: [],
        deep: 0,
        padded: '[]',
        ...input,
      }),
      'utf8'
    ),
    maxBuffer: 16 * 1024 * 1024,
  });
  assert.equal(run.error, undefined, `python3 runs (${run.error?.message})`);
  assert.equal(run.status, 0, run.stderr?.toString());
  return JSON.parse(run.stdout.toString('ascii'));
}
// A minimal frame on a record with no discovery: one `seen` tail. The
// control is accepted, so a case's violations are its own.
function codecFrame(tail) {
  const frame = cursorFrame({ contract_version: 2, method_index: 0, witness: null, methods: {} });
  frame.cursor.discovery.logs.seen = { sealed: 0, sealed_digest: d0(DOMAIN.log('seen')), tail };
  return frame;
}
const CODEC_JOB = { job_id: 'reader_codec', identity_hash: 'f'.repeat(64) };
const codecStore = (frame) => {
  const record = { discovery: null, cursor: null };
  const got = evaluateFrame(CODEC_JOB, record, frame);
  assert.deepEqual(record, { discovery: null, cursor: null }, 'nothing is written');
  return got.violations.map((v) => v.rule);
};
// A stored segment's bytes with one entry spliced in as its bytes (so `1.0`,
// the escape and invalid UTF-8 keep their bytes), digests as a Python writer
// computes them.
function codecSegmentBytes(entryBytes, fields = {}) {
  const head = {
    version: 1,
    kind: 'reader_discovery_segment',
    job_id: CODEC_JOB.job_id,
    identity_hash: CODEC_JOB.identity_hash,
    epoch: 0,
    log: 'seen',
    previous_hash: null,
    first: 0,
    count: 1,
    digest_before: d0(DOMAIN.log('seen')),
    ...fields,
  };
  const after = crypto
    .createHash('sha256')
    .update(Buffer.from(head.digest_before, 'hex'))
    .update(entryBytes)
    .digest('hex');
  const [pre, post] = JSON.stringify({ ...head, digest_after: after, entries: [] }).split(
    '"entries":[]'
  );
  return Buffer.concat([Buffer.from(`${pre}"entries":[`), entryBytes, Buffer.from(`]${post}`)]);
}
const codecSegment = (entryText, fields = {}) =>
  codecSegmentBytes(Buffer.from(entryText, 'utf8'), fields).toString('utf8');

test(`${CODEC}: each single-fault case's tag and what, in Node and in Python (§2.11)`, () => {
  const fx = load(CODEC);
  assert.equal(fx.kind, 'codec');
  assert.deepEqual(fx.tags, ['F1', 'F2', 'JSON', 'INTEGER_FIELD']);
  const texts = [...fx.single_fault, ...fx.controls].map(codecText);
  const py = codecPython({ entries: texts });
  const whats = new Set();
  fx.single_fault.forEach((c, i) => {
    assert.equal(py.entries[i].tag, c.tag, `${c.name}: Python's tag`);
    // The F1 message's <what> is the reason the codec met, not a label.
    assert.equal(py.entries[i].what, c.what ?? null, `${c.name}: Python's what`);
    assert.equal(nodeTag(texts[i]).tag, c.node, `${c.name}: Node's tag`);
    if (c.tag === 'F1') whats.add(c.what);
    else assert.equal(c.what, undefined, `${c.name}: only an F1 case names a what`);
    if (c.canonical_bytes) {
      const v = JSON.parse(texts[i]);
      assert.equal(size(v), c.canonical_bytes, `${c.name}: canonical bytes`);
    }
  });
  // Every single-fault tag but INTEGER_FIELD, which is not an entry's (below).
  assert.deepEqual([...new Set(fx.single_fault.map((c) => c.tag))].sort(), ['F1', 'F2', 'JSON']);
  // The <what> each F1 case names is one §3's message lists.
  const s3 = section('3. Hard limits').split('### 3.1')[0].replace(/\s+/g, ' ');
  const listed = s3.slice(s3.indexOf('breaks F1: <what>'));
  for (const w of whats) assert.ok(listed.includes(`\`${w}\``), `§3 lists <what> "${w}"`);
  fx.controls.forEach((c, k) => {
    const i = fx.single_fault.length + k;
    assert.equal(py.entries[i].tag, 'passes', `${c.name} passes in Python`);
    const node = nodeTag(texts[i]);
    assert.equal(node.tag, 'passes', `${c.name} passes in Node`);
    assert.equal(py.entries[i].canonical, node.canonical, `${c.name}: one canonical form`);
    if (c.canonical !== undefined) assert.equal(node.canonical, c.canonical, c.name);
    if (c.canonical_bytes !== undefined)
      assert.equal(Buffer.byteLength(node.canonical), c.canonical_bytes, c.name);
  });
  assert.equal(
    Buffer.byteLength(nodeTag(codecText(fx.controls[0])).canonical),
    LIMITS.ENTRY_BYTES,
    'the control sits at the bound'
  );
});

test(`${CODEC}: each operation maps the tag, and only the operation (§2.11 (a)-(c))`, () => {
  const fx = load(CODEC);
  const m = fx.mapping;
  // (a) the store, on a submitted frame: the write table's code for F1 and F2.
  for (const tag of ['F1', 'F2']) {
    const { rule, code, status, written } = m.store_frame[tag];
    assert.equal(rule, tag);
    assert.deepEqual({ code, status }, REFUSAL.write[tag]);
    assert.equal(written, 'nothing');
  }
  for (const [field, r] of Object.entries(m.store_frame.INTEGER_FIELD)) {
    assert.ok(WRITE_RULES.includes(r.rule) && r.rule !== 'F1', `${field}: its frame rule`);
    assert.deepEqual({ code: r.code, status: r.status }, REFUSAL.write[r.rule]);
    assert.equal(r.written, 'nothing');
  }
  assert.deepEqual(m.store_frame.JSON, { step_channel: 'bridge_failure', code: null });
  // Each single-fault entry in a frame's tail, where Node sees its tag, fails
  // exactly that rule and writes nothing; the control is accepted.
  assert.deepEqual(codecStore(codecFrame([['control']])), []);
  for (const c of fx.single_fault) {
    const node = nodeTag(codecText(c)).tag;
    if (!['F1', 'F2'].includes(node)) continue; // JSON never reaches the store; 1.0 is bad/float_entry.json's
    assert.deepEqual(codecStore(codecFrame([JSON.parse(codecText(c))])), [node], c.name);
  }
  // (b) the worker, on an entry it generated: F2 RESOURCE_LIMIT with its
  // cause, F1 INVARIANT_FAILURE with §3's message; nothing is emitted; F1
  // first (§2.11 (d)).
  assert.deepEqual(m.worker_emit.F2, {
    code: 'RESOURCE_LIMIT',
    cause: 'discovery_entry_bytes',
    emitted: 'nothing',
  });
  assert.ok(RESOURCE_CAUSES.includes('discovery_entry_bytes'));
  assert.equal(CAUSE_LOG.discovery_entry_bytes, 'required', 'it names the log');
  assert.deepEqual(m.worker_emit.F1, {
    code: 'INVARIANT_FAILURE',
    template: INVARIANT_MESSAGES.F1,
    emitted: 'nothing',
  });
  assert.deepEqual(m.worker_emit.precedence, ['F1', 'F2']);
  // (c) a persisted segment that passed F6: every content fault is F3, with
  // F3's mapping on the walk, the full read and the load; inflation is F6.
  assert.equal(m.persisted.rule, 'F3');
  const lease = { code: REFUSAL.walk.F3.code, status: REFUSAL.walk.F3.status, released: false };
  assert.deepEqual(m.persisted.lease_walk, lease);
  assert.deepEqual(m.persisted.full_read, { ...REFUSAL.full.F3, released: true });
  assert.deepEqual(m.persisted.worker_load, REFUSAL.resume.F3);
  assert.equal(m.persisted.inflation.rule, 'F6');
  assert.deepEqual(m.persisted.inflation.lease_walk, {
    code: REFUSAL.walk.F6.code,
    status: REFUSAL.walk.F6.status,
    released: false,
  });
  assert.deepEqual(m.persisted.inflation.full_read, { ...REFUSAL.full.F6, released: true });
  assert.deepEqual(m.persisted.inflation.worker_load, {
    ...REFUSAL.resume.F6,
    released: false,
  });
  // segment_corrupt is F6's alone, and the store's alone.
  assert.deepEqual(STORE_CAUSES, ['segment_corrupt']);
  assert.ok(!WORKER_CAUSES.includes('segment_corrupt'));
  const segs = fx.single_fault.filter((c) => c.node !== 'passes').map((c) => codecText(c));
  const py = codecPython({ segments: segs.map((t) => codecSegment(t)) });
  segs.forEach((text, i) => {
    const node = segmentContent(Buffer.from(codecSegment(text), 'utf8'));
    assert.ok(node.faults.length, `Node: ${text.slice(0, 20)} is a content fault`);
    assert.equal(py.segments[i].rule, 'F3', `Python: ${text.slice(0, 20)} is F3`);
  });
  const ok = codecSegment('["control"]');
  assert.deepEqual(segmentContent(Buffer.from(ok, 'utf8')).faults, []);
});

test(`${CODEC}: an integer-only field is INTEGER_FIELD, under its operation's rule, never F1`, () => {
  const fx = load(CODEC);
  const py = codecPython({ integers: fx.integer_fields.map((c) => c.value) });
  fx.integer_fields.forEach((c, i) => {
    assert.equal(c.tag, 'INTEGER_FIELD');
    assert.equal(py.integers[i].tag, 'INTEGER_FIELD', `${c.where}.${c.field}: the tag`);
    let rules;
    if (c.where === 'frame') {
      const frame = codecFrame([]);
      frame.discovery.epoch = c.value;
      rules = codecStore(frame);
    } else if (c.where === 'seal') {
      const frame = codecFrame([]);
      frame.discovery.seals = [
        {
          log: 'seen',
          first: c.value,
          entries: [['x']],
          digest_before: d0(DOMAIN.log('seen')),
          digest_after: fold(d0(DOMAIN.log('seen')), [['x']]),
        },
      ];
      rules = codecStore(frame);
    } else if (c.where === 'cursor') {
      const frame = codecFrame([]);
      frame.cursor.methods = { m: { candidates: c.value } };
      rules = codecStore(frame);
    } else {
      const raw = Buffer.from(codecSegment('["x"]', { [c.field]: c.value }), 'utf8');
      const { faults } = segmentContent(raw);
      assert.deepEqual(faults, ['INTEGER_FIELD'], `${c.field}: the content fault`);
      rules = ['F3'];
    }
    // §4's listed order puts the field's own rule first; every rule the frame
    // breaks is READER_PROTOCOL, and nothing is written (codecStore).
    assert.equal(rules[0], c.rule, `${c.where}.${c.field}: ${c.rule} first`);
    assert.ok(!rules.includes('F1'), `${c.where}.${c.field}: never F1`);
  });
  // An integer inside an entry stays F1 (single_fault's integer cases).
  const inEntry = fx.single_fault.filter((c) => c.name.startsWith('integer_'));
  assert.ok(inEntry.length === 2 && inEntry.every((c) => c.tag === 'F1'));
});

test(`${CODEC}: a multi-fault input pins the code and nothing written; the emit pins F1 first (§2.11 (d))`, () => {
  const fx = load(CODEC);
  for (const c of fx.multi_fault) {
    assert.equal(c.tag, null, `${c.name}: no tag is pinned on a decode`);
    assert.ok(c.faults.length >= 2, `${c.name}: more than one fault`);
  }
  const entries = fx.multi_fault.filter((c) => c.build);
  const segCase = fx.multi_fault.find((c) => c.where === 'segment');
  const py = codecPython({
    entries: entries.map(codecText),
    emit: entries.map(codecText),
    segments: [codecSegment(segCase.text, { [segCase.field]: segCase.value })],
  });
  entries.forEach((c, i) => {
    // Python's decode raises one of the faults' tags, whichever its scan meets first.
    assert.ok(c.faults.includes(py.entries[i].tag), `${c.name}: one of its faults`);
    // The store: READER_PROTOCOL whatever the first, and nothing written.
    const rules = codecStore(codecFrame([JSON.parse(codecText(c))]));
    assert.ok(rules.length >= 1);
    for (const r of rules) assert.deepEqual(REFUSAL.write[r], PROTOCOL, `${c.name}: ${r}`);
    // The worker, before it emits: F1 first, so INVARIANT_FAILURE (BB8, 19:40Z).
    assert.deepEqual(c.faults, fx.mapping.worker_emit.precedence, c.name);
    assert.equal(py.emit[i].tag, c.emit.tag, `${c.name}: the emit's tag`);
    assert.equal(fx.mapping.worker_emit[c.emit.tag].code, c.emit.code, c.name);
    assert.equal(c.emit.code, 'INVARIANT_FAILURE');
  });
  const seal = fx.multi_fault.find((c) => c.where === 'seal');
  assert.equal(seal.emit, undefined, 'a frame field is not an emitted entry');
  const frame = codecFrame([]);
  const e = JSON.parse(seal.text);
  frame.discovery.seals = [
    {
      log: 'seen',
      first: seal.value,
      entries: e,
      digest_before: d0(DOMAIN.log('seen')),
      digest_after: d0(DOMAIN.log('seen')),
    },
  ];
  for (const r of codecStore(frame)) assert.deepEqual(REFUSAL.write[r], PROTOCOL, `seal: ${r}`);
  // A segment with several content faults is F3, whichever comes first.
  assert.equal(py.segments[0].rule, 'F3');
  assert.ok(segCase.faults.includes(py.segments[0].tag));
  const node = segmentContent(
    Buffer.from(codecSegment(segCase.text, { [segCase.field]: segCase.value }), 'utf8')
  );
  assert.deepEqual([...new Set(node.faults)].sort(), [...segCase.faults].sort());
});

test(`${CODEC}: the worker's emit makes two passes, F1 before F2, with BB8's cases (§2.11 (d))`, () => {
  const fx = load(CODEC);
  const ep = fx.emit_precedence;
  const py = codecPython({ calls: ep.cases.map((c) => c.call), deep: ep.deep_valid.depth });
  ep.cases.forEach((c, i) => {
    assert.equal(py.calls[i].rule, c.rule, `${c.call}: the rule`);
    const mapped = fx.mapping.worker_emit[c.rule];
    assert.equal(mapped.code, c.code, `${c.call}: the code`);
    if (c.rule === 'F2') assert.equal(mapped.cause, c.cause);
    else assert.equal(c.cause, undefined);
    if (c.peak_under !== undefined)
      assert.ok(py.calls[i].peak < c.peak_under, `${c.call}: peak ${py.calls[i].peak}`);
  });
  // Each F1 case would be F2 to a one-pass encoder that bounds first: it holds
  // more than ENTRY_BYTES of string or members besides its F1 fault.
  assert.deepEqual(
    ep.cases.map((c) => c.rule),
    ['F1', 'F1', 'F1', 'F2']
  );
  // A deep entry that F1 and F2 both admit encodes unchanged, to Node's bytes:
  // nested exactly ENTRY_DEPTH deep, so one more level breaks F1 (item 31).
  let deep = [];
  for (let k = 1; k < ep.deep_valid.depth; k++) deep = [deep];
  assert.equal(py.deep, JSON.stringify(deep));
  assert.equal(entryDepth(deep), LIMITS.ENTRY_DEPTH, 'the deep entry sits at the bound');
  assert.equal(nodeTag(JSON.stringify([deep])).tag, 'F1', 'one level more breaks F1 in Node');
  assert.equal(codecPython({ entries: [JSON.stringify([deep])] }).entries[0].what, DEPTH_WHAT);
  assert.equal(Buffer.byteLength(py.deep), ep.deep_valid.canonical_bytes);
  assert.ok(ep.deep_valid.canonical_bytes <= LIMITS.ENTRY_BYTES);
  assert.equal(nodeTag(py.deep).tag, 'passes');
});

// §9's required calls, as the contract writes them: `name(args)` in backticks,
// each followed by the rule it must raise.
function requiredCalls(text) {
  const out = [];
  const re =
    /`((?:require_integer|decode_entry|canonical_bytes)\([^`]*\))`|rule == '([A-Z0-9_]+)'/g;
  let pending = [];
  for (const m of text.matchAll(re)) {
    if (m[1]) pending.push(m[1]);
    else {
      for (const call of pending) out.push({ call, rule: m[2] });
      pending = [];
    }
  }
  assert.deepEqual(pending, [], 'every call is followed by its rule');
  return out;
}
const s9codec = () => {
  const s9 = section('9. Compatibility and release');
  const a = s9.indexOf("- **The entry codec (the #721 author's;");
  return s9.slice(a, s9.indexOf('\n- **', a + 5));
};

test(`${CODEC}: §9's required calls are the fixture's, and the model raises each rule`, () => {
  const fx = load(CODEC);
  const text = s9codec();
  const [integers, rest] = text.split("- `canonical_bytes` makes §2.11 (d)'s two passes");
  assert.ok(rest, '§9 states the two-pass requirement');
  const [emit, depth] = rest.split('- the codec counts the depth');
  assert.ok(depth, '§9 states the depth requirement (BB8 6693502369, item 31)');
  const stripped = (cases) => cases.map(({ call, rule }) => ({ call, rule }));
  assert.deepEqual(requiredCalls(integers), fx.codec_requirement.calls);
  assert.deepEqual(requiredCalls(emit), stripped(fx.emit_precedence.cases));
  assert.deepEqual(requiredCalls(depth), fx.codec_requirement.depth_calls);
  // Each depth call's entry is one level past the bound (§2.1).
  for (const c of fx.codec_requirement.depth_calls) {
    const arg = c.call.match(/^\w+\((.*)\)$/)[1].replace(/^'(.*)'$/, '$1');
    assert.equal(entryDepth(JSON.parse(arg)), LIMITS.ENTRY_DEPTH + 1, c.call);
  }
  const all = [
    ...fx.codec_requirement.calls,
    ...fx.emit_precedence.cases,
    ...fx.codec_requirement.depth_calls,
  ];
  const py = codecPython({ calls: all.map((c) => c.call) });
  all.forEach((c, i) => assert.equal(py.calls[i].rule, c.rule, c.call));
  // INTEGER_FIELD is require_integer's alone; an integer inside an entry is F1
  // on the decode and the encode paths alike (BB8's review).
  for (const c of fx.codec_requirement.calls)
    assert.equal(c.rule === 'INTEGER_FIELD', c.call.startsWith('require_integer('), c.call);
  const paths = new Set(
    fx.codec_requirement.calls.filter((c) => c.rule === 'F1').map((c) => c.call.split('(')[0])
  );
  assert.deepEqual([...paths].sort(), ['canonical_bytes', 'decode_entry']);
  // The 128,000-byte threshold and the deep entry are stated as the fixture holds them.
  const flat = text.replace(/\s+/g, ' ');
  const peak = fx.emit_precedence.cases.find((c) => c.peak_under).peak_under;
  assert.ok(flat.includes(`a traced peak under ${peak.toLocaleString('en-US')} bytes`));
  const dv = fx.emit_precedence.deep_valid;
  assert.ok(
    flat.includes(
      `an empty array nested ${dv.depth.toLocaleString('en-US')} deep encodes, unchanged, to its ${dv.canonical_bytes.toLocaleString('en-US')} canonical bytes`
    )
  );
});

test(`${CODEC}: the integral float 1.0 diverges, with one pin per side (§2.11)`, () => {
  const fx = load(CODEC);
  const x = fx.cross_language;
  const raw = codecSegment(x.text);
  const py = codecPython({ entries: [x.text], segments: [raw] });
  // Python: a float, F1, so F3 on the load, chain_broken.
  assert.equal(py.entries[0].tag, x.python.tag);
  assert.equal(py.segments[0].rule, x.python.rule);
  assert.deepEqual(REFUSAL.resume[x.python.rule], unavailable(x.python.cause));
  // Node: the integer 1 passes F1 and F3; the digest over `1.0` does not recompute: F5.
  const { seg, faults } = segmentContent(Buffer.from(raw, 'utf8'));
  assert.deepEqual(faults, []);
  assert.equal(JSON.stringify(seg.entries[0]), x.node.parsed);
  assert.notEqual(fold(seg.digest_before, seg.entries), seg.digest_after);
  assert.equal(x.node.rule, 'F5');
  assert.deepEqual(REFUSAL.resume[x.node.rule], unavailable(x.node.cause));
  // Each side pins its own; the two causes differ, and neither is asserted for the other.
  assert.notEqual(x.python.cause, x.node.cause);
  // On a submitted frame the same divergence is bad/float_entry.json's.
  const fl = load('bad/float_entry.json').expect;
  assert.deepEqual([fl.rule, fl.node_detects, fl.code], ['F1', 'F5', 'READER_PROTOCOL']);
});

test(`${CODEC}: invalid UTF-8 in a segment is F3 in both languages once the store decodes strictly (§2.11)`, () => {
  const fx = load(CODEC);
  for (const c of fx.persisted_bytes) {
    const raw = codecSegmentBytes(Buffer.from(c.entry_hex, 'hex'));
    assert.throws(() => new TextDecoder('utf-8', { fatal: true }).decode(raw), TypeError);
    const py = codecPython({ segments_hex: [raw.toString('hex')] });
    assert.deepEqual(py.segments[0], c.python, `${c.name}: Python's load`);
    // The store as §2.11 requires it: the fatal decode refuses, so F3 (JSON).
    assert.deepEqual(segmentContent(raw).faults, [c.store_required.tag], `${c.name}: required`);
    assert.equal(c.store_required.rule, m3(fx));
    // The store today: Buffer.toString reads U+FFFD, so the content passes.
    assert.equal(c.store_today, 'passes');
    const today = segmentContent(raw, { fatal: false });
    assert.deepEqual(today.faults, [], `${c.name}: today's decode passes the bytes`);
    assert.ok(today.seg.entries[0].includes('�'));
    // And the store's read at Base is JSON.parse on the buffer, not a fatal
    // decode, until STORE_HALF.fatal_decode says otherwise.
    checkFatalDecode(STORE_HALF, readSource);
    // BB8 21:31Z: the read-back is an address-valid segment holding a string
    // with a lone 0xFF byte, F3 on a full read, a lease's walk and the
    // worker's load; a replacing decode passes the content and meets F5.
    const rb = c.read_back;
    const [stored] = rb.store.segments;
    const bytes = Buffer.from(stored.hex, 'hex');
    assert.deepEqual(bytes, raw, 'the read-back stores these bytes');
    assert.equal(sha(bytes), rb.addresses.seen[0], 'address-valid');
    assert.ok(bytes.includes(Buffer.from('"\xff"', 'latin1')), 'a lone 0xFF inside a string');
    assert.equal(Buffer.from(c.entry_hex, 'hex').filter((x) => x === 0xff).length, 1);
    assert.deepEqual(rulesOf(evaluateWalk(rb, rb.record.discovery, 'full')), ['F3']);
    assert.deepEqual(c.expect.full_read, { ...REFUSAL.full.F3, released: true });
    assert.deepEqual(rulesOf(evaluateWalk(rb, rb.record.discovery, 'lease')), ['F3']);
    assert.deepEqual(c.expect.lease_walk, {
      code: REFUSAL.walk.F3.code,
      status: REFUSAL.walk.F3.status,
      released: false,
    });
    assert.deepEqual(rulesOf(evaluateResume(rb)), ['F3']);
    assert.deepEqual(c.expect.worker_load, REFUSAL.resume.F3);
    assert.equal(c.expect.rule, m3(fx));
    // The test §2.11 requires fails against a replacing decode: no F3 there.
    const replacing = { ...rb, replacing: true };
    for (const mode of ['full', 'lease'])
      assert.ok(!rulesOf(evaluateWalk(replacing, rb.record.discovery, mode)).includes('F3'), mode);
    const load = rulesOf(evaluateResume(replacing));
    assert.ok(!load.includes('F3') && load[0] === c.replacing_decode.rule, load.join());
    assert.deepEqual(c.replacing_decode.worker_load, REFUSAL.resume[c.replacing_decode.rule]);
    // Buffer.toString is such a decode.
    assert.ok(bytes.toString('utf8').includes('\ufffd'));
  }
});
const m3 = (fx) => fx.mapping.persisted.rule;

test(`${CODEC}: F2 is on the canonical form; the raw input only within the enclosing reader's bound (item 3)`, () => {
  const fx = load(CODEC);
  const rt = fx.raw_transport;
  const bounds = codecBounds();
  // The bound is the enclosing reader's, by the names §2.11 gives them.
  assert.ok(rt.bound.startsWith("the enclosing reader's: "), rt.bound);
  for (const name of ['READER_FRAME_CAP', 'READER_OBJECT_BYTES', 'READER_LIMITS.objectBytes']) {
    assert.ok(rt.bound.includes(name), `raw_transport.bound names ${name}`);
    assert.ok(s211text().includes(`\`${name}\``), `§2.11 names ${name}`);
  }
  // No raw-input constant: LIMITS holds none, and §2.11 says the contract adds none.
  assert.ok(!Object.keys(LIMITS).some((k) => /RAW/.test(k)));
  assert.ok(s211text().includes('this contract adds no raw-input constant'));
  const padded = codecText(rt.valid_padded);
  const bytes = Buffer.byteLength(padded);
  assert.equal(bytes, rt.valid_padded.raw_bytes);
  assert.ok(bytes <= bounds.objectBytes && bytes > 1000 * 1024, 'about 1 MiB, within the bound');
  assert.equal(size(JSON.parse(padded)), rt.valid_padded.canonical_bytes);
  assert.equal(rt.valid_padded.canonical_bytes, LIMITS.ENTRY_BYTES);
  assert.equal(nodeTag(padded).tag, 'passes');
  const over = rt.over_spaced.map(codecText);
  const py = codecPython({ entries: over, padded });
  assert.equal(py.padded.tag, 'passes', 'the padded entry passes F2 in Python');
  assert.equal(py.padded.raw_bytes, bytes);
  // Peak memory measured: the decoder's peak is proportional to the raw bytes.
  assert.ok(py.padded.peak > 0 && py.padded.peak < 2 * bytes + 65536, `peak ${py.padded.peak}`);
  rt.over_spaced.forEach((c, i) => {
    assert.equal(Buffer.byteLength(over[i]), c.raw_bytes);
    assert.equal(size(JSON.parse(over[i])), c.canonical_bytes);
    assert.equal(c.canonical_bytes, LIMITS.ENTRY_BYTES + 1);
    assert.equal(py.entries[i].tag, 'F2', `pad ${c.build.pad}: F2 in Python`);
    assert.equal(nodeTag(over[i]).tag, 'F2', `pad ${c.build.pad}: F2 in Node`);
  });
  assert.deepEqual(
    rt.over_spaced.map((c) => c.build.pad),
    [0, 1, 256],
    'however it is spaced: none, one and the padded run'
  );
});

// The enclosing readers' existing bounds, read from the source as arithmetic.
function codecBounds() {
  const src = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
  const constant = (file, re) => {
    const m = re.exec(src(file));
    assert.ok(m, `${file}: ${re}`);
    assert.match(m[1], /^[0-9 *+]+$/);
    return Function(`return (${m[1]});`)();
  };
  return {
    frameCap: constant('mcp/python_bridge.js', /^const READER_FRAME_CAP = ([0-9 *+]+);$/m),
    workerFrame: constant('mcp/worker.py', /if len\(frame\.encode\("utf-8"\)\) > ([0-9 *+]+):/),
    objectBytes: constant('mcp/worker.py', /^READER_OBJECT_BYTES = ([0-9 *+]+?)\s+#/m),
    storeBytes: constant('mcp/reader_job_store.js', /^ {2}objectBytes: ([0-9 *+]+),$/m),
  };
}
const mibKib = (n) => {
  const whole = Math.floor(n / 1048576);
  const rest = n - whole * 1048576;
  assert.equal(rest % 1024, 0);
  return rest ? `${whole} MiB plus ${rest / 1024} KiB` : `${whole} MiB`;
};

// §2.11: where caller text enters the analysis. A lone surrogate the caller
// sends as an escape reaches the worker as a lone surrogate, and only a lyrics
// argv is cleaned, so admission must refuse one (BB8's condition).
//
// The contract cites code as `file:symbol`, never by line (§2.11's grammar,
// stated under the Base note), and the pinned statements live here as
// anchors. An anchor is a statement found by its text inside one symbol's
// span, so a line shift anywhere never fails this file; a renamed symbol, a
// second definition, or a changed pinned statement always does.
//
// STORE_HALF says which parts of the store half are implemented. Each key is
// flipped only by the commit that implements it; either mismatch fails, so the
// switch cannot drift from the code. A row with `when` must resolve while its
// key is true and must not resolve while it is false.
const STORE_HALF = Object.freeze({ admission: true, fatal_decode: true });

// Each row: `id`; `file`; `symbol` (a function, a method, a top-level constant
// or class, `Outer.inner` for a method of a class, or `module` for a file's
// top-level statements); `starts`, the pinned statement's trimmed first text;
// `ends`, the first later line of its range, or `whole` for the symbol's own
// span; `nth: [k, of]` where exactly `of` lines in the span start `starts`;
// `cite` for a range §2.11 cites (every other row lies inside one, and inside
// the row `within` names where it gives one); `when`. A cited row's code is
// also held to its digest in CITED_CODE, below, so a claim §2.11 makes inside
// a cited range cannot go false while the anchors still resolve; the uncited
// rows name the statements those claims rest on, so a failure says which.
const ANCHORS = [
  // How the caller's body is parsed, and validateRequest's two callers.
  {
    id: 'http.json',
    file: 'mcp/server_http.js',
    symbol: 'module',
    starts: 'express.json({',
    head: 'app.use(',
    ends: '})',
    cite: true,
  },
  {
    id: 'routes.valid_binding',
    file: 'mcp/reader_routes.js',
    symbol: 'validBinding',
    starts: 'const validBinding = (value) => /^[A-Za-z0-9_.:-]{1,200}$/.test(value);',
    cite: true,
  },
  {
    id: 'routes.validate',
    file: 'mcp/reader_routes.js',
    symbol: 'validateRequest',
    starts: 'export function validateRequest(input) {',
    whole: true,
    cite: true,
  },
  {
    id: 'routes.validate.bindings',
    file: 'mcp/reader_routes.js',
    symbol: 'validateRequest',
    starts: "for (const field of ['snapshot_id', 'reading_unit_id', 'reading_revision'])",
    ends: "if (!validBinding(input[field])) throw fail('BAD_REQUEST', `A valid ${field} is required.`);",
    cite: true,
  },
  {
    id: 'routes.validate.object_check',
    file: 'mcp/reader_routes.js',
    symbol: 'validateRequest',
    starts: 'input.declaration_set !== undefined &&',
    head: 'if (',
    ends: "throw fail('INVALID_DECLARATION', 'The declaration set must be a JSON object.');",
    cite: true,
  },
  {
    id: 'routes.validate.object_refusal',
    file: 'mcp/reader_routes.js',
    symbol: 'validateRequest',
    starts: "throw fail('INVALID_DECLARATION', 'The declaration set must be a JSON object.');",
    cite: true,
  },
  {
    id: 'routes.validate.array',
    file: 'mcp/reader_routes.js',
    symbol: 'validateRequest',
    starts: 'Array.isArray(input.declaration_set))',
  },
  {
    id: 'routes.validate.layers',
    file: 'mcp/reader_routes.js',
    symbol: 'validateRequest',
    starts: "const requested = input.requested_layers ?? ['sound', 'form', 'rhythm', 'language'];",
    ends: ');',
    cite: true,
  },
  {
    id: 'routes.validate.idempotency_key',
    file: 'mcp/reader_routes.js',
    symbol: 'validateRequest',
    starts: "'idempotency_key',",
    cite: true,
  },
  {
    id: 'routes.create_job',
    file: 'mcp/reader_routes.js',
    symbol: 'createAnalysisJob',
    starts: 'export async function createAnalysisJob({',
    whole: true,
    cite: true,
  },
  {
    id: 'routes.create_job.request',
    file: 'mcp/reader_routes.js',
    symbol: 'createAnalysisJob',
    starts: 'request: prepared,',
  },
  {
    id: 'routes.router.validate_call',
    file: 'mcp/reader_routes.js',
    symbol: 'createReaderRouter',
    starts: 'let request = validateRequest(req.body);',
    cite: true,
  },
  {
    id: 'viewer.router.key',
    file: 'mcp/library_viewer_routes.js',
    symbol: 'libraryViewerRouter',
    starts: 'const key = body.idempotency_key;',
    ends: "throw fail('BAD_REQUEST', 'An idempotency_key (at most 200 characters) is required.');",
    cite: true,
  },
  {
    id: 'viewer.router.key_bound',
    file: 'mcp/library_viewer_routes.js',
    symbol: 'libraryViewerRouter',
    starts: "if (typeof key !== 'string' || !key || key.length > 200)",
  },
  {
    id: 'viewer.router.validate_call',
    file: 'mcp/library_viewer_routes.js',
    symbol: 'libraryViewerRouter',
    starts: 'const request = validateRequest({ ...body, snapshot_id: snapshotId() });',
    cite: true,
  },
  // The scheduler: the stored request, its identity, and the lease.
  {
    id: 'sched.verify_reading',
    file: 'mcp/reader_scheduler.js',
    symbol: 'verifyReading',
    starts: 'export function verifyReading(bytes, expected, request) {',
    whole: true,
    cite: true,
  },
  {
    id: 'sched.verify_reading.parse',
    file: 'mcp/reader_scheduler.js',
    symbol: 'verifyReading',
    starts: 'const source = JSON.parse(bytes);',
  },
  {
    id: 'sched.verify_reading.hash',
    file: 'mcp/reader_scheduler.js',
    symbol: 'verifyReading',
    starts: 'if (!expected || sha256(bytes) !== expected)',
  },
  {
    id: 'sched.prepare',
    file: 'mcp/reader_scheduler.js',
    symbol: 'prepareRequest',
    starts: 'const prepareRequest = async (request) => {',
    whole: true,
    cite: true,
  },
  {
    id: 'sched.prepare.declarations',
    file: 'mcp/reader_scheduler.js',
    symbol: 'prepareRequest',
    starts: 'const declarations = request.declaration_set;',
  },
  {
    id: 'sched.prepare.defaults',
    file: 'mcp/reader_scheduler.js',
    symbol: 'prepareRequest',
    starts: 'declaration_set: { ...declarations, pronunciations: structuredClone(defaults) },',
    cite: true,
  },
  {
    id: 'sched.identity.return',
    file: 'mcp/reader_scheduler.js',
    symbol: 'resolveIdentity',
    starts: 'return {',
    ends: 'requested_methods: request.requested_methods ?? null,',
    cite: true,
  },
  {
    id: 'sched.identity.declaration_hash',
    file: 'mcp/reader_scheduler.js',
    symbol: 'resolveIdentity',
    starts:
      'declaration_hash: sha256(canonicalJSON(semanticDeclarations(request.declaration_set || {}))),',
  },
  {
    id: 'sched.pump.store_lease',
    file: 'mcp/reader_scheduler.js',
    symbol: 'pump',
    starts: 'record = this.store.lease();',
    cite: true,
  },
  // Step 3 added this statement and flipped STORE_HALF.admission in one commit.
  {
    id: 'sched.pump.stored_check',
    file: 'mcp/reader_scheduler.js',
    symbol: 'pump',
    starts: 'if (!wellFormedDeep(record.request',
    when: 'admission',
    cite: true,
  },
  {
    id: 'sched.pump.identity_check',
    file: 'mcp/reader_scheduler.js',
    symbol: 'pump',
    starts: 'const identity = await this.resolveIdentity(record.request);',
    ends: 'const trusted = this.store.workerPayload(record.id);',
    cite: true,
  },
  {
    id: 'sched.pump.stale',
    file: 'mcp/reader_scheduler.js',
    symbol: 'pump',
    starts:
      "throw error('STALE_READING', 'Source or engine identity changed; create a new reader job.');",
  },
  {
    id: 'sched.pump.worker_payload',
    file: 'mcp/reader_scheduler.js',
    symbol: 'pump',
    starts: 'const trusted = this.store.workerPayload(record.id);',
  },
  {
    id: 'sched.pump.run_reader_lease',
    file: 'mcp/reader_scheduler.js',
    symbol: 'pump',
    starts: 'const result = await this.bridge.runReaderLease(',
    ends: '},',
    cite: true,
  },
  {
    id: 'sched.pump.declarations',
    file: 'mcp/reader_scheduler.js',
    symbol: 'pump',
    starts: 'declarations: record.request.declaration_set,',
    cite: true,
  },
  {
    id: 'sched.pump.catch_pause',
    file: 'mcp/reader_scheduler.js',
    symbol: 'pump',
    starts: '} catch (failure) {',
    // The second: the first is dispatch's, around listQueued() and lease().
    nth: [2, 2],
    ends: '});',
    cite: true,
  },
  {
    id: 'sched.pump.catch_code',
    file: 'mcp/reader_scheduler.js',
    symbol: 'pump',
    starts: "code: failure.code || 'INTERRUPTED',",
  },
  {
    id: 'sched.pump.catch_requeue',
    file: 'mcp/reader_scheduler.js',
    symbol: 'pump',
    starts: 'requeue: false,',
  },
  {
    id: 'source_worker.verify',
    file: 'mcp/reader_source_worker.js',
    symbol: 'module',
    starts: 'const source = verifyReading(await readFile(file), expected, request);',
    cite: true,
  },
  // The bridge.
  {
    id: 'bridge.frame_cap',
    file: 'mcp/python_bridge.js',
    symbol: 'READER_FRAME_CAP',
    starts: 'const READER_FRAME_CAP = 2 * 1024 * 1024 + 16384;',
    cite: true,
  },
  {
    id: 'bridge.spawn.parse',
    file: 'mcp/python_bridge.js',
    symbol: 'spawnWorker',
    starts: 'const reply = JSON.parse(line);',
    cite: true,
  },
  {
    id: 'bridge.spawn.reader_line_cap',
    file: 'mcp/python_bridge.js',
    symbol: 'spawnWorker',
    starts: 'Buffer.byteLength(line) > READER_FRAME_CAP ||',
    head: 'if (',
    ends: "throw interrupted('unreadable reader checkpoint', { code: 'READER_PROTOCOL' });",
    cite: true,
  },
  {
    id: 'bridge.spawn.unreadable',
    file: 'mcp/python_bridge.js',
    symbol: 'spawnWorker',
    starts: "throw interrupted('unreadable reader checkpoint', { code: 'READER_PROTOCOL' });",
  },
  {
    id: 'bridge.spawn.catch_kill',
    file: 'mcp/python_bridge.js',
    symbol: 'spawnWorker',
    starts: '} catch (error) {',
    ends: 'return;',
    cite: true,
  },
  {
    id: 'bridge.spawn.kill',
    file: 'mcp/python_bridge.js',
    symbol: 'spawnWorker',
    starts: 'kill(error);',
    nth: [1, 2],
    within: 'bridge.spawn.catch_kill',
  },
  {
    id: 'bridge.spawn.protocol_cap',
    file: 'mcp/python_bridge.js',
    symbol: 'spawnWorker',
    starts:
      "Buffer.byteLength(protocol) > (waiter?.family === 'reader' ? READER_FRAME_CAP : 1024 * 1024)",
    head: 'if (',
    ends: "kill(interrupted('worker protocol frame exceeds cap', { protocolError: true }));",
    cite: true,
  },
  {
    id: 'bridge.warm.write',
    file: 'mcp/python_bridge.js',
    symbol: 'warm',
    starts: 'child.stdin.write(',
    ends: "}) + '\\n'",
    cite: true,
  },
  {
    id: 'bridge.warm.stringify',
    file: 'mcp/python_bridge.js',
    symbol: 'warm',
    starts: 'JSON.stringify({',
  },
  {
    id: 'bridge.warm.reader_payload',
    file: 'mcp/python_bridge.js',
    symbol: 'warm',
    starts: "...(options.family === 'reader' ? { reader: options.readerPayload } : {}),",
  },
  // The worker.
  {
    id: 'worker.lone_surrogate',
    file: 'mcp/worker.py',
    symbol: '_LONE_SURROGATE',
    starts: '_LONE_SURROGATE = re.compile("[\\ud800-\\udfff]")',
    cite: true,
  },
  {
    id: 'worker.object_bytes',
    file: 'mcp/worker.py',
    symbol: 'READER_OBJECT_BYTES',
    starts:
      'READER_OBJECT_BYTES = 2 * 1024 * 1024  # READER_LIMITS.objectBytes in reader_job_store.js',
    cite: true,
  },
  {
    id: 'worker.read_page_object',
    file: 'mcp/worker.py',
    symbol: 'read_page_object',
    starts: 'def read_page_object(page_path):',
    whole: true,
    cite: true,
  },
  {
    id: 'worker.read_page_object.bound',
    file: 'mcp/worker.py',
    symbol: 'read_page_object',
    starts: 'with open(page_path, "rb") as source_file:',
    ends: 'raise ValueError("reader page object exceeds its bound")',
    cite: true,
  },
  {
    id: 'worker.read_page_object.raw',
    file: 'mcp/worker.py',
    symbol: 'read_page_object',
    starts: 'raw = source_file.read(READER_OBJECT_BYTES + 1)',
  },
  {
    id: 'worker.read_page_object.inflate',
    file: 'mcp/worker.py',
    symbol: 'read_page_object',
    starts: 'if raw[:2] == b"\\x1f\\x8b":',
    ends: 'raise ValueError("reader page object exceeds its bound, is truncated or ',
    cite: true,
  },
  {
    id: 'worker.read_page_object.inflated',
    file: 'mcp/worker.py',
    symbol: 'read_page_object',
    starts: 'body = inflater.decompress(raw, READER_OBJECT_BYTES + 1)',
  },
  {
    id: 'worker.read_page_object.decode',
    file: 'mcp/worker.py',
    symbol: 'read_page_object',
    starts: 'return json.loads(body.decode("utf-8"))',
    cite: true,
  },
  {
    id: 'worker.run_reader.session',
    file: 'mcp/worker.py',
    symbol: 'run_reader',
    starts: 'session = AnalysisSession(payload["source"], payload.get("declarations"), requested,',
    cite: true,
  },
  {
    id: 'worker.run_reader.frame',
    file: 'mcp/worker.py',
    symbol: 'run_reader',
    starts: 'frame = json.dumps({"id": request_id, "event": "reader_checkpoint", "data": step},',
    ends: 'ensure_ascii=False, separators=(",", ":"))',
    cite: true,
  },
  {
    id: 'worker.run_reader.frame_cap',
    file: 'mcp/worker.py',
    symbol: 'run_reader',
    starts: 'frame = json.dumps({"id": request_id, "event": "reader_checkpoint", "data": step},',
    ends: 'raise ValueError("reader checkpoint frame exceeds byte limit")',
    cite: true,
  },
  {
    id: 'worker.run_reader.size_check',
    file: 'mcp/worker.py',
    symbol: 'run_reader',
    starts: 'if len(frame.encode("utf-8")) > 2 * 1024 * 1024:',
    cite: true,
  },
  {
    id: 'worker.run_reader.print',
    file: 'mcp/worker.py',
    symbol: 'run_reader',
    starts: 'print(frame, flush=True)',
    cite: true,
  },
  {
    id: 'worker.main.parse',
    file: 'mcp/worker.py',
    symbol: 'main',
    starts: 'req = json.loads(line)',
    cite: true,
  },
  {
    id: 'worker.main.argv_clean',
    file: 'mcp/worker.py',
    symbol: 'main',
    starts: 'argv = [_LONE_SURROGATE.sub("\\ufffd", a) for a in argv]',
    cite: true,
  },
  {
    id: 'worker.main.except',
    file: 'mcp/worker.py',
    symbol: 'main',
    starts: 'except Exception as exc:',
    ends: '"provider_calls": 0}}), flush=True)',
    cite: true,
  },
  {
    id: 'worker.main.reader_error',
    file: 'mcp/worker.py',
    symbol: 'main',
    starts: 'reason = "READER_ERROR"',
  },
  // The store.
  {
    id: 'store.limits.object_bytes',
    file: 'mcp/reader_job_store.js',
    symbol: 'READER_LIMITS',
    starts: 'objectBytes: 2 * 1024 * 1024,',
    cite: true,
  },
  {
    id: 'store.decode_stored_object',
    file: 'mcp/reader_job_store.js',
    symbol: 'decodeStoredObject',
    starts: 'export function decodeStoredObject(raw) {',
    whole: true,
    cite: true,
  },
  {
    id: 'store.decode_stored_object.inflate_bound',
    file: 'mcp/reader_job_store.js',
    symbol: 'decodeStoredObject',
    starts: 'maxOutputLength: READER_LIMITS.objectBytes,',
  },
  {
    id: 'store.decode_stored_object.raw_bound',
    file: 'mcp/reader_job_store.js',
    symbol: 'decodeStoredObject',
    starts: 'if (raw.length > READER_LIMITS.objectBytes)',
  },
  {
    id: 'store.read_file',
    file: 'mcp/reader_job_store.js',
    symbol: '_readFile',
    starts: '_readFile(file) {',
    whole: true,
    cite: true,
  },
  {
    id: 'store.read_file.bound',
    file: 'mcp/reader_job_store.js',
    symbol: '_readFile',
    starts: 'if (fs.statSync(file).size > READER_LIMITS.objectBytes)',
  },
  // The segment reader (Step 5, BB8 6700200435 condition 7): the stat's
  // bound comes before any read, then _readFile, the bounded decode, and the
  // one strict parse.
  {
    id: 'store.segment',
    file: 'mcp/reader_job_store.js',
    symbol: '_segment',
    starts: '_segment(hash, expect, size = null) {',
    whole: true,
    cite: true,
    when: 'fatal_decode',
  },
  {
    id: 'store.segment.stat',
    file: 'mcp/reader_job_store.js',
    symbol: '_segment',
    starts: 'stat = fs.statSync(file);',
    when: 'fatal_decode',
  },
  // A stat that is not a regular file is F6 unread (BB8 6707363590).
  {
    id: 'store.segment.not_file',
    file: 'mcp/reader_job_store.js',
    symbol: '_segment',
    starts: 'if (!stat.isFile()) return { f6: true };',
    when: 'fatal_decode',
  },
  {
    id: 'store.segment.stat_bound',
    file: 'mcp/reader_job_store.js',
    symbol: '_segment',
    starts: 'if (size > READER_LIMITS.objectBytes) return { f6: true };',
    when: 'fatal_decode',
  },
  {
    id: 'store.segment.read',
    file: 'mcp/reader_job_store.js',
    symbol: '_segment',
    starts: 'bytes = this._readFile(file);',
    when: 'fatal_decode',
  },
  // _readFile's size refusal (a file replaced after the stat) and EISDIR
  // are F6 of the one segment, never a store-wide refusal (BB8 6707363590).
  {
    id: 'store.segment.read_refused',
    file: 'mcp/reader_job_store.js',
    symbol: '_segment',
    starts: "if (error.code === 'STORAGE_CORRUPT' || error.code === 'EISDIR') return { f6: true };",
    when: 'fatal_decode',
  },
  {
    id: 'store.segment.decode',
    file: 'mcp/reader_job_store.js',
    symbol: '_segment',
    starts: 'bytes = decodeStoredObject(bytes);',
    when: 'fatal_decode',
  },
  {
    id: 'store.segment.parse',
    file: 'mcp/reader_job_store.js',
    symbol: '_segment',
    starts: 'segment = this._segmentJSON(bytes);',
    when: 'fatal_decode',
  },
  {
    id: 'store.object',
    file: 'mcp/reader_job_store.js',
    symbol: '_object',
    starts: '_object(kind, hash) {',
    whole: true,
    cite: true,
  },
  {
    id: 'store.object.parse',
    file: 'mcp/reader_job_store.js',
    symbol: '_object',
    starts: 'return JSON.parse(bytes);',
    cite: true,
  },
  {
    id: 'store.object.verify',
    file: 'mcp/reader_job_store.js',
    symbol: '_object',
    starts: 'if (sha(bytes) !== hash)',
  },
  {
    id: 'store.create',
    file: 'mcp/reader_job_store.js',
    symbol: 'create',
    starts: 'create({ viewer, idempotency_key, identity, request, definitions = null }) {',
    ends: 'const request_digest = sha(canonical({ identity, request: intent }));',
    cite: true,
  },
  {
    id: 'store.create.idempotency_hash',
    file: 'mcp/reader_job_store.js',
    symbol: 'create',
    starts: 'const idempotency_hash = sha(`${viewer}\\0${idempotency_key}`);',
  },
  {
    id: 'store.create.intent',
    file: 'mcp/reader_job_store.js',
    symbol: 'create',
    starts: "const intent = jsonValue(request, 'Reader request');",
  },
  {
    id: 'store.lease',
    file: 'mcp/reader_job_store.js',
    symbol: 'lease',
    starts: 'lease(id = null) {',
    whole: true,
    cite: true,
  },
  {
    id: 'store.lease.fence',
    file: 'mcp/reader_job_store.js',
    symbol: 'lease',
    starts: "fence: crypto.randomBytes(32).toString('hex'),",
  },
  // The analysis.
  {
    id: 'analysis.public_declarations',
    file: 'lyric-harness/library/analysis.py',
    symbol: '_public_declarations',
    starts: 'def _public_declarations(value):',
    whole: true,
    cite: true,
  },
  {
    id: 'analysis.session.stale_reading',
    file: 'lyric-harness/library/analysis.py',
    symbol: 'AnalysisSession.__init__',
    starts: 'if any(choice["line"] not in lines for choice in lex.pronunciations):',
    ends: 'raise ValueError("STALE_READING: an exact pronunciation line is absent from this registered reading")',
    cite: true,
  },
  {
    id: 'pronunciation.validate_choices.line',
    file: 'lyric-harness/quality/pronunciation.py',
    symbol: 'validate_choices',
    starts:
      "if not isinstance(line, str) or not line.strip() or len(line) > 4000 or any(c in line for c in '\\r\\n",
    cite: true,
  },
];
// §2.1's basis for ENTRY_DEPTH (item 31): the statements that build the
// deepest entries at this head, cited by §2.1 as `analysis.py:symbol`. The
// set is closed: every statement in a depth symbol that DEPTH_WATCH selects
// (one that builds or reshapes a cell, a span key, a key or an alt_cells
// pair) must be one of these, whole, so a statement added or changed there
// fails even where the pinned ones still resolve; each depth symbol's whole
// code is pinned (DEPTH_CODE); and the set is closed over its callees: every
// call in a depth symbol is to a depth symbol, to a helper DEPTH_HELPERS or a
// callee DEPTH_CALLS names, with the reason its result builds no entry, or to
// a listed builtin (BB8 6701778607, item 3, and his D5-D6). `stmt` is the
// whole statement where it runs past its first line.
const DEPTH_ANCHORS = [
  // The span key's locus: a string, the origin with a unit number replaced
  // by that unit's cell, formatted.
  ['analysis.origin.def', '_origin', 'def _origin(self, span, st):'],
  ['analysis.origin.split', '_origin', 'head, at, unit = span.origin.rpartition("@")'],
  ['analysis.origin.unit', '_origin', 'if at and unit.isdigit() and int(unit) < len(st.units):'],
  ['analysis.origin.cell', '_origin', 'return f"{head}@{self._cell(st.units[int(unit)])}"'],
  ['analysis.origin.plain', '_origin', 'return span.origin'],
  ['analysis.cell.def', '_cell', 'def _cell(self, u):'],
  ['analysis.cell.tok', '_cell', 'tok = (u.line, u.token)'],
  [
    'analysis.cell.return',
    '_cell',
    'return tok if tok in self._disputed else (u.line, u.token, u.tok_syl)',
  ],
  ['analysis.span_key.def', '_span_key', 'def _span_key(self, span, st):'],
  ['analysis.span_key.cells', '_span_key', 'cells = []'],
  ['analysis.span_key.loop', '_span_key', 'for i in span.idx:'],
  ['analysis.span_key.cell', '_span_key', 'cell = self._cell(st.units[i])'],
  ['analysis.span_key.dedupe', '_span_key', 'if not cells or cells[-1] != cell:'],
  ['analysis.span_key.append', '_span_key', 'cells.append(cell)'],
  [
    'analysis.span_key.return',
    '_span_key',
    'return (self._origin(span, st), span.direction, tuple(cells))',
  ],
  ['analysis.candidates.seen', '_candidates', 'seen = set()'],
  [
    'analysis.candidates.seen_add',
    '_candidates',
    'seen.add((self._span_key(a, st), self._span_key(b, st)))',
  ],
  [
    'analysis.candidates.alternate',
    '_candidates',
    'yield from self._alternate_edges(name, schema, seen)',
  ],
  ['analysis.new_pairs.def', '_new_pairs', 'def _new_pairs(self, schema, alt, aa, bb, seen):'],
  [
    'analysis.new_pairs.key',
    '_new_pairs',
    'key = (self._span_key(x, alt), self._span_key(y, alt))',
  ],
  ['analysis.new_pairs.met', '_new_pairs', 'if key in seen or mirror and key[::-1] in seen:'],
  ['analysis.new_pairs.seen_add', '_new_pairs', 'seen.add(key)'],
  [
    'analysis.prepare_event.pair_cells',
    '_prepare_event',
    'cells = [sorted({(found.units[i].line, found.units[i].token) for i in m.idx})',
    'cells = [sorted({(found.units[i].line, found.units[i].token) for i in m.idx}) for m in (a, b)]',
  ],
  [
    'analysis.prepare_event.pair_single',
    '_prepare_event',
    'if all(len(c) == 1 for c in cells) and cells[0] != cells[1]:',
  ],
  [
    'analysis.prepare_event.pair_append',
    '_prepare_event',
    'delta["alt_cells"] = delta.get("alt_cells", []) + [[list(cells[0][0]), list(cells[1][0])]]',
  ],
  // The shared-sound build of the same entry: a pair of cells, each a
  // binding's (line, token).
  ['analysis.prepare_event.shared_sound', '_prepare_event', 'elif phase == "shared_sound":'],
  [
    'analysis.prepare_event.shared_append',
    '_prepare_event',
    'delta["alt_cells"] = delta.get("alt_cells", []) + [[list(binding[1]), list(binding[2])]]',
  ],
  // The binding that build copies: `("alt", ta, tb)`, two words, each the
  // stream's `(line, token)`, from the words with a span and those without.
  ['analysis.sound_candidates.toks', '_sound_candidates', 'toks = sorted(spans)'],
  [
    'analysis.sound_candidates.missing',
    '_sound_candidates',
    'missing = [] if self._any_reading_off else self._sound_unspanned(spans)',
  ],
  ['analysis.sound_candidates.ta', '_sound_candidates', 'for i, ta in enumerate(toks):'],
  ['analysis.sound_candidates.tb', '_sound_candidates', 'for tb in toks[i + 1:]:'],
  ['analysis.sound_candidates.pair', '_sound_candidates', 'yield a, b'],
  ['analysis.sound_candidates.alt_ta', '_sound_candidates', 'for ta in missing:'],
  [
    'analysis.sound_candidates.alt_tb',
    '_sound_candidates',
    'for tb in sorted(set(toks) | set(missing)):',
  ],
  [
    'analysis.sound_candidates.alt',
    '_sound_candidates',
    'yield ("alt",) + tuple(sorted((ta, tb)))',
  ],
  // The words ta and tb are those keys: the family's spans by word, each key
  // a stream's `(line, token)`, and the varying words with no span (BB8
  // 6701778607, his D6).
  ['analysis.sound_spans.def', '_sound_spans', 'def _sound_spans(self, family, st):'],
  ['analysis.sound_spans.none', '_sound_spans', 'return {}'],
  ['analysis.sound_spans.out', '_sound_spans', 'out = {}'],
  ['analysis.sound_spans.loop', '_sound_spans', 'for span in spans:'],
  [
    'analysis.sound_spans.cells',
    '_sound_spans',
    'cells = {(st.units[i].line, st.units[i].token) for i in span.idx}',
  ],
  ['analysis.sound_spans.single', '_sound_spans', 'if len(cells) == 1:'],
  [
    'analysis.sound_spans.key',
    '_sound_spans',
    'out.setdefault(next(iter(cells)), []).append(span)',
  ],
  ['analysis.sound_spans.return', '_sound_spans', 'return out'],
  ['analysis.sound_unspanned.def', '_sound_unspanned', 'def _sound_unspanned(self, spans):'],
  [
    'analysis.sound_unspanned.return',
    '_sound_unspanned',
    'return sorted(t for t in self.stream.tokens if t in self._varying and t not in spans)',
  ],
].map(([id, symbol, starts, stmt]) => ({
  id,
  file: 'lyric-harness/library/analysis.py',
  symbol,
  starts,
  ...(stmt ? { stmt } : {}),
}));
// Which statements of each depth symbol build or reshape an entry: every one
// in `_cell` and `_span_key`, and those naming the set, the key or the cells
// in the other three.
const DEPTH_WATCH = {
  _cell: /./,
  _origin: /./,
  _span_key: /./,
  _sound_candidates: /^(?:toks|missing) =|^for (?:i, )?(?:ta|tb) in |^yield\b/,
  _sound_spans: /^def |^return\b|\b(?:out|cells)\b|^for span in /,
  _sound_unspanned: /./,
  _candidates: /\bseen\b|_span_key\(|_cell\(/,
  _new_pairs: /\b(?:key|seen)\b|_span_key\(|_cell\(/,
  _prepare_event: /\bcells\b|alt_cells|_span_key\(|_cell\(/,
};
// The helpers a depth symbol calls that are not depth symbols, each with why
// its result never reaches a cell, a span key, a key or an alt_cells pair. A
// call to any other `self.*` helper fails, and so does an entry here that no
// depth symbol calls, so the list cannot go stale.
const DEPTH_HELPERS = {
  // _candidates
  _alternate_edges:
    "yields alt_edge bindings and passes `seen` on to _discover, then _new_pairs (a depth symbol), which adds the keys; the keys it compares are _span_key's, and it adds none itself",
  _touched: 'a set of words, used only as the condition for keeping a key',
  // _prepare_event
  _task_generator:
    "dispatches the phase's candidate generator: the one binding an entry copies is shared_sound's `(\"alt\", ta, tb)`, from _sound_candidates (a depth symbol); the schema phase's are _candidates' (a depth symbol), whose alt_cells cells read `.line` and `.token` from a stream's units",
  _any_reading:
    'the judged instance, stream, witness and flags; the alt_cells cells are read from the binding, not from these',
  _coordinate: 'a coordinates record, emitted, never logged',
  _native_pair: 'a native pair record, emitted, never logged',
  _native_measure: 'a native measure record, emitted, never logged',
  _edge_record: 'an edge record, emitted; _domain_tally reads it',
  _domain_tally:
    "adds token pairs to delta's domain_true and domain_undecided, terminal inputs that are not logs",
  _shape: 'the figure frames a shape binding yields, each made a record by _figure_record',
  _shape_first_only: 'a bool, counted',
  _figure_record: 'a figure record, emitted, never logged',
  _sound_alt_pair:
    "the value, the record and a bool that says whether the pair is a cell: the pair appended is the binding's",
  _sound_pair: 'the value, the record and a count',
  _finish: "the method's terminal records, emitted",
  _sound_refusal: 'a refusal record, emitted',
  _refusal: 'a refusal record, emitted',
  _bounded_records: 'the records, with large fields detached, emitted',
  _task_mid: 'a method id string',
};
// The builtins a depth symbol may call, and the methods of builtin values
// (a list's, a dict's, a set's, a string's) it may call on any value: none
// builds an entry's shape that its own statement does not show.
const DEPTH_BUILTINS = new Set([
  'all',
  'any',
  'enumerate',
  'int',
  'isinstance',
  'iter',
  'len',
  'list',
  'next',
  'range',
  'set',
  'sorted',
  'str',
  'sum',
  'tuple',
  'ValueError',
]);
const DEPTH_METHODS = new Set([
  'add',
  'append',
  'extend',
  'get',
  'isdigit',
  'items',
  'join',
  'rpartition',
  'setdefault',
]);
// Every other callee a depth symbol calls, by the dotted name it is called
// by (a module function bare, a module or object's attribute dotted), each
// with what it returns and why that is no entry, or where an entry reads it.
// A call by any other name fails (his D5), and so does one whose callee is
// computed (`getattr(…)(…)`, `fs[0](…)`); an entry here no depth symbol calls
// fails too.
const DEPTH_CALLS = {
  'RL.enumerate_spans':
    "a rule's spans: _span_key reads each one's idx, origin and direction, and _sound_spans its idx",
  'RL._candidate_pairs':
    'pairs of those spans, which _candidates and _new_pairs key by _span_key, a depth symbol',
  'RL._frame_key': 'a frame key that indexes spans for the pair search, never logged',
  'RL._bucket_key': 'a bucket key that indexes spans for the pair search, never logged',
  'RL._cand_buckets': "a span's candidate buckets for the pair search, never logged",
  'RL.Refusal': 'a refusal, raised',
  'self.RL.Refusal': 'a refusal, raised',
  _Refused: 'the exception a refusal is raised in',
  'RL.Span': "a line's span, whose frame key groups lines for a shape, never logged",
  'RL._stub_resolved_stream':
    "the stream with stubs resolved, or a refusal: _cell reads its units, as it does the work's",
  'RL.pair_scope_representable': 'a bool',
  'itertools.combinations': 'the line or token tuples a shape binding yields, made figure records',
  'schema.capabilities': 'capability names, a condition',
  'st.supply': 'a supply record, a condition',
  _resource_guard: 'raises past the memory envelope, and returns nothing',
  json_safe: 'the refusal or values a record carries, emitted, never logged',
  verdict: "a record's verdict tag, counted",
  shared_sound_name: "the shared-sound method's name, in a refusal",
};
// Calls that read a callee by name at run time: never allowed.
const DEPTH_REFUSED = new Set([
  'getattr',
  'setattr',
  'eval',
  'exec',
  'globals',
  'locals',
  'vars',
  '__import__',
]);
const ANCHOR = new Map([...ANCHORS, ...DEPTH_ANCHORS].map((r) => [r.id, r]));

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const indentOf = (s) => /^\s*/.exec(s)[0].length;
// The lines of [from, to] that define `name`: a JS function, method, const or
// class (a call statement `name(x);` or argument `name(x),` is not one), or a
// Python def, class or top-level assignment.
function definitionLines(lines, name, py, from, to) {
  const n = escapeRe(name);
  const res = py
    ? [
        new RegExp(`^\\s*(?:async\\s+)?def ${n}\\(`),
        new RegExp(`^\\s*class ${n}\\b`),
        new RegExp(`^${n}\\s*=`),
      ]
    : [
        new RegExp(`^\\s*(?:export\\s+)?(?:async\\s+)?(?:function\\s+)?${n}\\s*\\(`),
        new RegExp(`^\\s*(?:export\\s+)?const ${n}\\s*=`),
        new RegExp(`^\\s*(?:export\\s+)?class ${n}\\b`),
      ];
  const out = [];
  for (let i = from; i <= to; i++) {
    const s = lines[i];
    if (!res.some((re) => re.test(s))) continue;
    if (!py && /[;,]$/.test(s.trimEnd()) && !/^\s*(?:export\s+)?const /.test(s)) continue;
    // A method-shaped line (`name(` with no keyword) defines only when its
    // parameter list is followed by a body: a call that runs over lines,
    // `name(\n  args\n);`, is not a definition.
    if (
      !py &&
      !/^\s*(?:export\s+|async\s+|function\s+|const |class )/.test(s) &&
      !bodyFollows(lines, i, to)
    )
      continue;
    out.push(i);
  }
  return out;
}
// Whether the parenthesis a JS line opens first is followed by `{` once it
// closes (comments and strings aside).
function bodyFollows(lines, i, to) {
  const code = stripComments(lines.slice(i, to + 1).join('\n'), false).map((t) =>
    t.replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`/g, '""')
  );
  let depth = 0;
  let opened = false;
  for (let j = 0; j < code.length; j++)
    for (let k = 0; k < code[j].length; k++) {
      const c = code[j][k];
      if (c === '(') {
        depth++;
        opened = true;
      } else if (c === ')' && --depth === 0 && opened) {
        const rest = `${code[j].slice(k + 1)} ${code.slice(j + 1).join(' ')}`.trimStart();
        return rest.startsWith('{');
      }
    }
  return false;
}
// The last line of the definition at `start`. JS: the first later line at or
// left of its indentation that is closers alone (`}`, `});`), or else the line
// before the first later line there that is not a closer; a one-line const is
// its own span, and `}) {` (the end of a parameter list) stays inside. Python:
// the line before the first later line at or left of the def's indentation
// that is not blank, not a comment and not inside a triple-quoted string.
function spanEnd(lines, start, py, to) {
  const ind = indentOf(lines[start]);
  let last = start;
  let quote = null;
  for (let i = start + 1; i <= to; i++) {
    const s = lines[i];
    const t = s.trim();
    if (py) {
      const inString = quote;
      for (const q of ['"""', "'''"]) {
        const odd = (s.split(q).length - 1) % 2;
        if (odd && !quote) quote = q;
        else if (odd && quote === q) quote = null;
      }
      if (inString) {
        last = i;
        continue;
      }
      if (!t || t.startsWith('#')) continue;
      // A closer alone at the definition's indentation ends a top-level
      // bracketed assignment, and is part of it.
      if (indentOf(s) <= ind) return /^[}\])]+,?$/.test(t) ? i : last;
      last = i;
    } else {
      if (!t) continue;
      if (indentOf(s) <= ind) {
        if (/^[}\])]+[;,]?$/.test(t)) return i;
        if (!/^[}\])]/.test(t)) return last;
      }
      last = i;
    }
  }
  return last;
}
function symbolSpan(lines, symbol, py, id) {
  let from = 0;
  let to = lines.length - 1;
  if (symbol === 'module') return { from, to };
  for (const name of symbol.split('.')) {
    let defs = definitionLines(lines, name, py, from, to);
    // A Python class attribute: an assignment at the class body's indentation.
    if (py && !defs.length && /^\s*class\s/.test(lines[from])) {
      const body = lines.slice(from + 1, to + 1).find((s) => s.trim() && !s.trim().startsWith('#'));
      const at = body === undefined ? -1 : indentOf(body);
      const re = new RegExp(`^\\s*${escapeRe(name)}\\s*(?::[^=]*)?=(?!=)`);
      defs = [];
      for (let i = from + 1; i <= to; i++)
        if (indentOf(lines[i]) === at && re.test(lines[i])) defs.push(i);
    }
    if (defs.length !== 1)
      throw new Error(`${id}: ${defs.length ? 'a second definition' : 'no definition'} of ${name}`);
    to = spanEnd(lines, defs[0], py, to);
    from = defs[0];
  }
  return { from, to };
}
// The last line of the statement that starts on line `start` (0-based), at
// most `to`: its lines run on while a bracket it opened is open (comments and
// strings aside), while a Python line ends in a backslash, and while a JS line
// ends in an operator or the next one starts with one (`.`, `?`, `:`, `&&`,
// `||`, `??`). A compound header takes its body: a Python line ending in `:`
// takes its indented suite and any `elif`, `else`, `except` or `finally` after
// it, and a JS `if`, `for`, `while` or `else` with no brace takes the next
// statement. A line that closes a bracket it did not open (an element or the
// end of an argument list) is its own statement.
function statementEnd(lines, start, py, to) {
  const code = stripComments(lines.slice(start, to + 1).join('\n'), py).map((t) =>
    t
      .replace(
        py
          ? /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g
          : /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`/g,
        '""'
      )
      .trim()
  );
  const next = (k) => {
    for (let j = k + 1; j < code.length; j++) if (code[j]) return j;
    return -1;
  };
  let depth = 0;
  let k = 0;
  let joined = '';
  for (;;) {
    const t = code[k];
    joined += ` ${t}`;
    // A JS clause that opens on the brace closing the block before it,
    // `} catch (e) {` or `} else {`, runs to the end of its own block.
    const own = !py && k === 0 && /^\}\s*(?:else\b|catch\b|finally\b)/.test(t) ? t.slice(1) : t;
    for (const c of own) depth += '([{'.includes(c) ? 1 : ')]}'.includes(c) ? -1 : 0;
    if (depth < 0) return start + k;
    const n = next(k);
    const more =
      depth > 0 ||
      (py
        ? t.endsWith('\\')
        : /(?:&&|\|\||\?\?|[=+\-*/%<>?:]|=>)$/.test(t) ||
          (n >= 0 && /^(?:\.|\?|:|&&|\|\||\?\?)/.test(code[n])));
    if (more) {
      if (n < 0) throw new Error(`the statement at line ${start + 1} does not end in its symbol`);
      k = n;
      continue;
    }
    if (py && t.endsWith(':')) {
      // The suite: every later line indented past the header, then a clause
      // that continues the statement.
      const ind = indentOf(lines[start]);
      let last = start + k;
      for (let j = k + 1; j < code.length; j++) {
        if (!code[j]) continue;
        const own = indentOf(lines[start + j]);
        if (own > ind) last = start + j;
        else if (own === ind && /^(?:elif\b|else\b|except\b|finally\b)/.test(code[j]))
          last = start + j;
        else break;
      }
      return last;
    }
    if (
      !py &&
      /^(?:\}\s*)?(?:(?:else\s+)?if|for|while)\s*\(.*\)$|^(?:\}\s*)?else$/s.test(joined.trim())
    ) {
      if (n < 0) throw new Error(`the statement at line ${start + 1} has no body in its symbol`);
      return statementEnd(lines, start + n, py, to);
    }
    return start + k;
  }
}
// One anchor row against its file's text: the 1-based line whose trimmed text
// starts with `starts`, inside the symbol's span, and the last line of its
// range. A missing symbol, a second definition, a missing or ambiguous anchor
// or a missing end throws, naming the row. Pure: the mutation tests below
// feed it altered text.
function resolveAnchor(sourceText, row) {
  const lines = sourceText.split('\n');
  const py = row.file.endsWith('.py');
  const { from, to } = symbolSpan(lines, row.symbol, py, row.id);
  const hits = [];
  for (let i = from; i <= to; i++) if (lines[i].trim().startsWith(row.starts)) hits.push(i);
  const [nth, of] = row.nth ?? [1, 1];
  const what = `${row.symbol} start ${JSON.stringify(row.starts)}`;
  if (!hits.length) throw new Error(`${row.id}: no line in ${what}`);
  if (hits.length !== of) throw new Error(`${row.id}: ${hits.length} lines in ${what}, not ${of}`);
  const at = hits[nth - 1];
  let line = at;
  // A row whose anchor is inside its statement (a condition's line) names
  // the line the statement opens with, `head`: the nearest at or above it.
  if (row.head) {
    while (line >= from && !lines[line].trim().startsWith(row.head)) line--;
    if (line < from)
      throw new Error(`${row.id}: no line at or above ${what} starts ${JSON.stringify(row.head)}`);
  }
  let endLine = line;
  if (row.whole) {
    if (line !== from) throw new Error(`${row.id}: not the definition of ${row.symbol}`);
    endLine = to;
    // A Python definition starts at its first decorator (his D3).
    if (py) line = decoratorStart(lines, line);
  } else if (row.ends) {
    // The first later line that starts `ends`, or the endsNth-th where the
    // first is not the range's last; then on through the statement that line
    // is in, and every statement the range starts, whole (his D4).
    let k = row.endsNth ?? 1;
    endLine = lines.findIndex(
      (s, i) => i >= at && i <= to && s.trim().startsWith(row.ends) && --k === 0
    );
    if (endLine < 0)
      throw new Error(
        `${row.id}: no later line in ${row.symbol} starts ${JSON.stringify(row.ends)}`
      );
    endLine = coverEnd(lines, line, endLine, py, to);
  } else endLine = statementEnd(lines, line, py, to);
  return { line: line + 1, endLine: endLine + 1, text: lines.slice(line, endLine + 1).join('\n') };
}
// The first line of the Python definition on line `def`: the topmost of the
// decorators directly above it (blank lines and comments between allowed),
// each a whole statement ending on the line above the next.
function decoratorStart(lines, def) {
  const ind = indentOf(lines[def]);
  let first = def;
  for (;;) {
    let k = first - 1;
    while (k >= 0 && (!lines[k].trim() || /^\s*#/.test(lines[k]))) k--;
    if (k < 0) return first;
    let d = k;
    // A decorator's own lines above its last are indented past it.
    while (d >= 0 && !(indentOf(lines[d]) === ind && lines[d].trim().startsWith('@'))) {
      if (d < k && lines[d].trim() && indentOf(lines[d]) <= ind) return first;
      d--;
    }
    if (d < 0) return first;
    let end;
    try {
      end = statementEnd(lines, d, true, k);
    } catch {
      return first;
    }
    if (end !== k) return first;
    first = d;
  }
}
// The last line of the statements from line `start` that reach line `end`:
// statement after statement, each whole (a compound one with its body), until
// one ends at or past `end`.
function coverEnd(lines, start, end, py, to) {
  let i = start;
  for (;;) {
    const j = statementEnd(lines, i, py, to);
    if (j >= end) return j;
    const rest = stripComments(lines.slice(j + 1, to + 1).join('\n'), py);
    const off = rest.findIndex((t) => t.trim());
    if (off < 0) throw new Error(`the statements at line ${start + 1} end before line ${end + 1}`);
    i = j + 1 + off;
  }
}
const spanText = (sourceText, row, symbol = row.symbol) => {
  const lines = sourceText.split('\n');
  const { from, to } = symbolSpan(lines, symbol, row.file.endsWith('.py'), row.id);
  return lines.slice(from, to + 1).join('\n');
};
const readSource = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
// A text, line by line, with its comments and (Python) its docstrings cut out
// and the rest of each line kept: a JS `//` or `/* … */` comment, a Python `#`
// comment, or a docstring: a bare triple-quoted string, with no prefix, that
// starts the first statement of a def or class body, or of the text itself at
// column 0, outside every bracket (BB8 6701778607, item 2; his D1). A prefixed
// string (an f-string runs its expressions), one inside brackets (implicit
// concatenation) and one anywhere else are code. Strings, template literals
// and regex literals are read as code, so a comment marker inside one is not a
// comment. Lines are not joined: line i of the result is line i of the text,
// possibly empty.
function stripComments(text, py) {
  const out = [];
  let state = null; // null, a quote, '*/' (a block comment) or 'doc' + a quote
  let prev = ''; // the last code character before the scan point, for regexes
  // Python: bracket depth, a line continued by a backslash, the logical line
  // so far, whether the last one was a def or class header, and whether any
  // code came before.
  let depth = 0;
  let cont = false;
  let logical = '';
  let afterHeader = false;
  let seenCode = false;
  for (const s of text.split('\n')) {
    let kept = '';
    let i = 0;
    const put = (c) => {
      kept += c;
      if (!/\s/.test(c)) prev = c;
    };
    while (i < s.length) {
      const c = s[i];
      const two = s.slice(i, i + 2);
      const three = s.slice(i, i + 3);
      if (state === '*/' || state?.startsWith('doc')) {
        const close = state === '*/' ? '*/' : state.slice(3);
        const at = s.indexOf(close, i);
        if (at < 0) {
          i = s.length;
          break;
        }
        i = at + close.length;
        // Code after a docstring on its line (`"""x""".strip()`) keeps a
        // stand-in for the string, so the expression it starts stays whole.
        if (state !== '*/' && s.slice(i).trim() && !/^\s*[;#]/.test(s.slice(i))) put('""');
        state = null;
        continue;
      }
      if (state) {
        // Inside a string: a backslash escapes the next character.
        if (c === '\\') {
          put(s.slice(i, i + 2));
          i += 2;
          continue;
        }
        if (s.startsWith(state, i)) {
          put(state);
          i += state.length;
          state = null;
          continue;
        }
        put(c);
        i++;
        continue;
      }
      if (py) {
        if (c === '#') break;
        const q = /^("""|''')/.exec(s.slice(i));
        if (
          q &&
          !kept.trim() &&
          depth === 0 &&
          !cont &&
          (afterHeader || (!seenCode && indentOf(s) === 0))
        ) {
          state = `doc${q[1]}`;
          afterHeader = false;
          seenCode = true;
          i += 3;
          continue;
        }
        if (three === '"""' || three === "'''") {
          state = three;
          put(three);
          i += 3;
          continue;
        }
        if (c === '"' || c === "'") {
          state = c;
          put(c);
          i++;
          continue;
        }
      } else {
        if (two === '//') break;
        if (two === '/*') {
          state = '*/';
          i += 2;
          continue;
        }
        if (c === '"' || c === "'" || c === '`') {
          state = c;
          put(c);
          i++;
          continue;
        }
        if (c === '/' && (prev === '' || '(,=:[!&|?{};+-*%<>~^'.includes(prev))) {
          // A regex literal: to the next unescaped `/` outside a class.
          let j = i + 1;
          let cls = false;
          while (j < s.length && (s[j] !== '/' || cls)) {
            if (s[j] === '\\') j++;
            else if (s[j] === '[') cls = true;
            else if (s[j] === ']') cls = false;
            j++;
          }
          put(s.slice(i, j + 1));
          i = j + 1;
          continue;
        }
      }
      if (py) depth += '([{'.includes(c) ? 1 : ')]}'.includes(c) ? -1 : 0;
      put(c);
      i++;
    }
    if (py && state === null) {
      // The logical line ends where no bracket is open and no backslash
      // continues it: a def or class header makes the next statement the
      // first of a body.
      cont = kept.trimEnd().endsWith('\\');
      logical += ` ${kept}`;
      if (depth <= 0 && !cont && logical.trim()) {
        afterHeader = /^(?:async\s+)?(?:def|class)\b[\s\S]*:$/.test(logical.trim());
        seenCode = true;
        logical = '';
        depth = 0;
      }
    }
    // A JS string other than a template literal, or a Python one other than a
    // triple-quoted one, ends at its line.
    if (
      state &&
      !(
        state === '`' ||
        state === '"""' ||
        state === "'''" ||
        state === '*/' ||
        state.startsWith('doc')
      )
    )
      state = null;
    out.push(kept);
  }
  return out;
}
// The code of a text: each line with its comments cut out (stripComments),
// trimmed, and the lines left empty dropped, so a comment or a line shift
// never moves it, and code beside a comment is still code. A Python line keeps
// its indentation relative to the text's first line (BB8 6701778607, his D2):
// a statement moved into or out of a block changes the digest. One indented
// less than the first line, as inside a string, is marked by how much less.
const codeLines = (text, py) => {
  const raw = text.split('\n');
  const base = py ? indentOf(raw[0]) : 0;
  return stripComments(text, py)
    .map((t, i) => {
      const code = t.trim();
      if (!py || !code) return code;
      const rel = indentOf(raw[i]) - base;
      return `${rel >= 0 ? ' '.repeat(rel) : `<${-rel}>`}${code}`;
    })
    .filter(Boolean);
};
const digestOf = (text, py) =>
  crypto.createHash('sha256').update(codeLines(text, py).join('\n')).digest('hex').slice(0, 16);
// A Python span's statements, each a logical line (its physical lines joined
// while a bracket is open or a line ends in a backslash), with blank lines,
// comments and string statements dropped.
function pyStatements(text) {
  const out = [];
  let cur = null;
  let depth = 0;
  for (const t of stripComments(text, true)
    .map((x) => x.trim())
    .filter(Boolean)) {
    cur = cur === null ? t : `${cur} ${t}`;
    const bare = t.replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, '').replace(/#.*$/, '');
    for (const c of bare) depth += '([{'.includes(c) ? 1 : ')]}'.includes(c) ? -1 : 0;
    if (depth <= 0 && !t.endsWith('\\')) {
      out.push(cur);
      cur = null;
      depth = 0;
    }
  }
  if (cur !== null) out.push(cur);
  return out;
}
// Resolves every row a STORE_HALF state allows, and holds each gated row to
// not resolving while its key is false. `src(file)` gives a file's text.
function resolveAnchors(rows, half, src) {
  const out = new Map();
  for (const row of rows) {
    if (row.when && !half[row.when]) {
      assert.throws(
        () => resolveAnchor(src(row.file), row),
        /no line in|: no definition of /,
        `${row.id} must not resolve while STORE_HALF.${row.when} is false`
      );
      continue;
    }
    out.set(row.id, resolveAnchor(src(row.file), row));
  }
  return out;
}
// A row's citation as the contract writes it.
const citeOf = (row) =>
  `${row.file.replace(/^(?:mcp|lyric-harness\/library|lyric-harness)\//, '')}:${row.symbol}`;

const CITE_ROOTS = ['mcp/', 'lyric-harness/library/', 'lyric-harness/quality/', 'lyric-harness/'];
const citeFile = (f) => {
  const hit = ['', ...CITE_ROOTS].map((r) => r + f).find((p) => fs.existsSync(path.join(ROOT, p)));
  assert.ok(hit, `${f} resolves to a file`);
  return hit;
};
// Every `file:symbol` citation a text makes: a bare `:symbol` names the file
// of the nearest file-qualified citation before it in the same bullet, table
// row or paragraph.
function citesOf(text) {
  const out = [];
  let file = null;
  for (const line of text.split('\n')) {
    if (/^\s*(?:- |\d+\. |\|)/.test(line) || !line.trim()) file = null;
    for (const m of line.matchAll(/`(?:([a-z_./-]+\.(?:js|py|mjs)))?:([A-Za-z_]\w*(?:\.\w+)*)`/g)) {
      if (m[1]) file = m[1];
      assert.ok(file, `the bare citation :${m[2]} follows a named file in its bullet`);
      out.push(`${citeFile(file)}:${m[2]}`);
    }
  }
  return out;
}
// A citation by line number, in a text the validator checks.
const lineCites = (text) =>
  [
    ...text.matchAll(
      /`(?:[\w./-]+\.(?:js|py|mjs))?:\d+(?:-\d+)?`|(?<![\w`])[\w./-]+\.(?:js|py|mjs):\d+/g
    ),
  ].map((m) => m[0]);
const s211raw = () => CONTRACT.slice(CONTRACT.indexOf('\n### 2.11'), CONTRACT.indexOf('\n## 3.'));
const s211text = () => s211raw().replace(/\s+/g, ' ');

// The §2.11 trace, as one function of the sources, the section's text and the
// STORE_HALF state, so the mutation tests can run it on altered inputs.
function check211(half, src, section) {
  const at = resolveAnchors(ANCHORS, half, src);
  // §2.11 cites exactly the symbols the anchors pin, and nothing by line.
  assert.deepEqual(lineCites(section), [], '§2.11 cites no line number');
  const cited = [...new Set(citesOf(section))].sort();
  const pinned = [...new Set(ANCHORS.map((r) => `${r.file}:${r.symbol}`))].sort();
  assert.deepEqual(cited, pinned, '§2.11 cites exactly the symbols the anchors pin');
  // Every pinned statement lies inside a range §2.11 cites.
  for (const row of ANCHORS.filter((r) => !r.cite && at.has(r.id))) {
    const { line } = at.get(row.id);
    assert.ok(
      ANCHORS.some((c) => {
        const r = c.cite && c.file === row.file && at.get(c.id);
        return r && line >= r.line && line <= r.endLine;
      }),
      `${row.id} lies in a cited range`
    );
    if (row.within) {
      const w = at.get(row.within);
      assert.ok(line >= w.line && line <= w.endLine, `${row.id} lies in ${row.within}`);
    }
  }
  // The order inside pump: the store's lease, the stored-request check once
  // it exists, the bridge lease, and the catch's pause.
  const order = [
    'sched.pump.store_lease',
    'sched.pump.stored_check',
    'sched.pump.run_reader_lease',
    'sched.pump.catch_pause',
  ].filter((id) => at.has(id));
  assert.equal(order.length, half.admission ? 4 : 3);
  for (let i = 1; i < order.length; i++)
    assert.ok(
      at.get(order[i - 1]).endLine < at.get(order[i]).line,
      `${order[i - 1]} comes before ${order[i]}`
    );
  // The segment reader (Step 5): the stat, its regular-file check and its
  // bound come before the read, the read and its refusals before the bounded
  // decode, and that before the one strict parse, so an oversized or
  // non-regular segment is F6 without being opened.
  const segment = [
    'store.segment.stat',
    'store.segment.not_file',
    'store.segment.stat_bound',
    'store.segment.read',
    'store.segment.read_refused',
    'store.segment.decode',
    'store.segment.parse',
  ].filter((id) => at.has(id));
  assert.equal(segment.length, half.fatal_decode ? 7 : 0);
  for (let i = 1; i < segment.length; i++)
    assert.ok(
      at.get(segment[i - 1]).endLine < at.get(segment[i]).line,
      `${segment[i - 1]} comes before ${segment[i]}`
    );
  // At Base the declaration set is held only to being an object; admission
  // (Step 3) adds the walk. The bindings are ASCII either way.
  // While the key is false, neither validateRequest nor pump may hold any
  // Unicode check, under any name, nor pump any INVALID_DECLARATION refusal:
  // the false branch forbids what the true branch requires, and more, so a
  // check landed under other text still fails until the key is flipped.
  const validate = spanText(src('mcp/reader_routes.js'), ANCHOR.get('routes.validate'));
  const pump = spanText(src('mcp/reader_scheduler.js'), ANCHOR.get('sched.pump.store_lease'));
  const unicode = /wellformed|surrogate|normalize\(/i;
  if (half.admission) {
    // Exactly the two checks the contract names, and no other: one walk in
    // validateRequest, and in pump one walk and one refusal, the stored
    // check, as the first statement of the try the catch pauses from.
    assert.equal(validate.match(/wellFormedDeep\(/g)?.length, 1, 'validateRequest walks the set');
    assert.equal(pump.match(new RegExp(unicode, 'gi'))?.length, 1, 'pump has one Unicode check');
    assert.equal(pump.match(/INVALID_DECLARATION/g)?.length, 1, 'pump has one such refusal');
    const sched = src('mcp/reader_scheduler.js').split('\n');
    let k = at.get('sched.pump.stored_check').line - 2;
    while (k >= 0 && (!sched[k].trim() || sched[k].trim().startsWith('//'))) k--;
    assert.equal(sched[k].trim(), 'try {', 'the stored check opens the try');
  } else {
    assert.ok(!unicode.test(validate), 'validateRequest has no Unicode check yet');
    assert.ok(
      !unicode.test(pump) && !/INVALID_DECLARATION/.test(pump),
      'pump has no stored-request check yet'
    );
  }
  // idempotency_key is allowed and unchecked there; the lease payload omits it.
  assert.equal(validate.match(/idempotency_key/g).length, 1);
  const payload = at.get('sched.pump.run_reader_lease').text;
  assert.ok(
    !/idempotency/.test(payload) && /declarations: record\.request\.declaration_set/.test(payload)
  );
  assert.ok(!/idempotency/.test(at.get('sched.identity.return').text), 'the identity holds no key');
  // The worker cleans lone surrogates in a lyrics argv only.
  assert.equal(src('mcp/worker.py').match(/_LONE_SURROGATE\.sub/g).length, 1);
  // No sentence states the code's present state: a state claim names Base.
  assert.ok(!/\btoday\b/i.test(section), '§2.11 says "at Base", never "today"');
  return at;
}
// The code of each range §2.11 cites, by row id: the first 16 hex digits of
// the sha256 of its code lines (codeLines: blank lines, comments and
// docstrings dropped, a Python line's relative indentation kept). An anchor pins one statement; this pins all of them, so a line
// added, deleted or changed anywhere in a cited range fails, with the digest
// it now has. Read the §2.11 claim the range backs again before pinning that
// digest here; a commit that flips a STORE_HALF key pins its new code too.
const CITED_CODE = {
  'http.json': 'ba0efe192b57e7cc',
  'routes.valid_binding': 'ffcf0160378f1057',
  'routes.validate': '3b347e194be1dfcc',
  'routes.validate.bindings': '3b2ccfc18609d366',
  'routes.validate.object_check': 'ee3f1076a197f408',
  'routes.validate.object_refusal': '82f6cdb879d66b07',
  'routes.validate.layers': 'e27cb0f554b9eea2',
  'routes.validate.idempotency_key': '395c0c67a67563b5',
  'routes.create_job': '28b038bf72982a7b',
  'routes.router.validate_call': 'dfb6986394734699',
  'viewer.router.key': '6d1009ee7657a946',
  'viewer.router.validate_call': '5163e29c3d275aa6',
  'sched.verify_reading': '64967a499472686b',
  'sched.prepare': '77017df34b5986f5',
  'sched.prepare.defaults': '88b1b94374432c46',
  'sched.identity.return': '0418225a3a80651b',
  'sched.pump.store_lease': '5af198b4587bd30f',
  'sched.pump.stored_check': '5bb62c97312dc525',
  'sched.pump.identity_check': '1b9b173f92ea262f',
  'sched.pump.run_reader_lease': 'd5136c6a9fca28f8',
  'sched.pump.declarations': '9c0b44cf7533f1fd',
  'sched.pump.catch_pause': 'a0cbd73603202e8b',
  'source_worker.verify': 'c70ad56857c8151f',
  'bridge.frame_cap': '9984ca2e1f63dc5b',
  'bridge.spawn.parse': 'a78dbdf6483e4415',
  'bridge.spawn.reader_line_cap': '73841462e84e955c',
  'bridge.spawn.catch_kill': '047774059ac7c5c0',
  'bridge.spawn.protocol_cap': '08dd20939cc411fa',
  'bridge.warm.write': '0300e4c0152bc3ad',
  'worker.lone_surrogate': 'd0457298ed2dc3bb',
  'worker.object_bytes': '822de74937f3c593',
  'worker.read_page_object': 'f5a484490ac5b142',
  'worker.read_page_object.bound': '9c2c06cd22c3e3ba',
  'worker.read_page_object.inflate': 'ccaa4dbeae98caa8',
  'worker.read_page_object.decode': '74f569f6c35d7905',
  'worker.run_reader.session': '77e6a0f11dfee03d',
  'worker.run_reader.frame': 'aee399b05f7234bd',
  'worker.run_reader.frame_cap': '357c253da799527d',
  'worker.run_reader.size_check': '1831a83f8b74ab86',
  'worker.run_reader.print': '3e5cecfe2d544074',
  'worker.main.parse': 'f08047d623f14bbe',
  'worker.main.argv_clean': '7a471f0acaf403e7',
  'worker.main.except': '79bfea4cfce670d7',
  'store.limits.object_bytes': 'b6d127b7a0a393da',
  'store.decode_stored_object': 'cde659ed88e5a273',
  'store.read_file': 'c9801821b51ad00f',
  'store.segment': '7fc478d3c0c12f65',
  'store.object': '84c4231531c0b173',
  'store.object.parse': 'c191f67de6b2a935',
  'store.create': '8a859865d99b9fae',
  'store.lease': '52963e123b8ecebb',
  'analysis.public_declarations': '55d5ea2e67aa1639',
  'analysis.session.stale_reading': '5c5f4526cdb1c440',
  'pronunciation.validate_choices.line': 'da9c46227f11509e',
};
function checkDigests(half, src) {
  const rows = ANCHORS.filter((r) => r.cite);
  const at = resolveAnchors(rows, half, src);
  const off = rows
    .filter((r) => at.has(r.id))
    .map((r) => [r.id, digestOf(at.get(r.id).text, r.file.endsWith('.py'))])
    .filter(([id, d]) => CITED_CODE[id] !== d);
  assert.deepEqual(
    off.map(([id]) => id),
    [],
    `the code §2.11 cites changed: read each claim again, then pin ${JSON.stringify(Object.fromEntries(off))}`
  );
  // No digest is pinned for a row that does not exist or does not resolve.
  assert.deepEqual(
    Object.keys(CITED_CODE).filter((id) => !at.has(id)),
    [],
    'every pinned digest is a resolved cited row'
  );
}
// Every other code citation in the contract (§2.1's other bullets, §2.3, §3
// and the sections after them; BB8 6701778607), as `file:symbol`: each row is
// one cited range, found as ANCHORS' rows are, and `code` is its digest
// (codeLines'; a `prose` row, which cites a comment or a docstring, digests its
// trimmed lines as they stand). The rows were made from the line citations at
// Base and resolve there. A change anywhere in a range fails with the digest
// it now has: read the claim that cites it again before pinning that digest.
const CONTRACT_CITES = [
  {
    id: 'c.reader_job_store.canonical',
    at: '2.1',
    file: 'mcp/reader_job_store.js',
    symbol: 'canonical',
    starts: 'function canonical(value) {',
    whole: true,
    code: 'b017252caaf66d96',
  },
  {
    id: 'c.contracts.canonical_json',
    at: '2.1',
    file: 'lyric-harness/library/contracts.py',
    symbol: 'canonical_json',
    starts: 'def canonical_json(value: Any) -> str:',
    whole: true,
    code: '809178918b3a3f4a',
  },
  {
    id: 'c.analysis._candidates.1',
    at: ['2.3', '2.6'],
    file: 'lyric-harness/library/analysis.py',
    symbol: '_candidates',
    starts: 'seen = set()',
    ends: 'seen.add((self._span_key(a, st), self._span_key(b, st)))',
    code: 'df98d72a704ea332',
  },
  {
    id: 'c.relations._candidate_pairs',
    at: ['2.3', '6.2'],
    file: 'lyric-harness/quality/relations.py',
    symbol: '_candidate_pairs',
    starts: 'remaining = {}',
    ends: 'seen = {}',
    code: 'faaa1a3eb7bbdb38',
  },
  {
    id: 'c.analysis._prepare_event.1',
    at: ['2.3', '6.3'],
    file: 'lyric-harness/library/analysis.py',
    symbol: '_prepare_event',
    starts: 'cells = [sorted({(found.units[i].line, found.units[i].token) for i in m.idx})',
    ends: 'delta["alt_cells"] = delta.get("alt_cells", []) + [[list(cells[0][0]), list(cells[1][0])]]',
    code: '9edee98a6b480951',
  },
  {
    id: 'c.analysis._prepare_event.2',
    at: ['2.3', '6.8'],
    file: 'lyric-harness/library/analysis.py',
    symbol: '_prepare_event',
    starts: 'new.append(self._figure_record(name, frame, edges, v))',
    ends: 'else:',
    code: '76b77ef5aef5ddbb',
  },
  {
    id: 'c.reader_job_store._blob.1',
    at: '2.5',
    file: 'mcp/reader_job_store.js',
    symbol: '_blob',
    starts: '_blob(kind, value) {',
    whole: true,
    code: '8d39a853847c9f10',
  },
  {
    id: 'c.reader_job_store._blob.2',
    at: '2.5',
    file: 'mcp/reader_job_store.js',
    symbol: '_blob',
    starts: 'let stored = bytes;',
    ends: 'if (compressed.length < bytes.length) stored = compressed;',
    code: '977969a8d5665f8a',
  },
  {
    id: 'c.reader_job_store.readPage',
    at: '2.5',
    file: 'mcp/reader_job_store.js',
    symbol: 'readPage',
    starts: 'readPage(id, pageSha, capability, viewer, manifestHash = null) {',
    whole: true,
    code: '6ff37474cf39b0e7',
  },
  {
    id: 'c.analysis.step.1',
    at: '2.6',
    file: 'lyric-harness/library/analysis.py',
    symbol: 'step',
    starts: 'while cp["method_index"] < len(self.tasks) and used < budget_candidates:',
    ends: 'if size > 32768:',
    code: '1ba4d4bd6110c497',
  },
  {
    id: 'c.analysis._candidates.2',
    at: ['2.3', '2.6'],
    file: 'lyric-harness/library/analysis.py',
    symbol: '_candidates',
    starts: 'seen = set()',
    code: 'c8124e676ebd4d90',
  },
  {
    id: 'c.analysis._advance.1',
    at: ['2.6', '2.8'],
    file: 'lyric-harness/library/analysis.py',
    symbol: '_advance',
    starts: 'def _advance(self):',
    whole: true,
    code: '270225a8f5c49946',
  },
  {
    id: 'c.reader_job_store._save.1',
    at: '2.7',
    file: 'mcp/reader_job_store.js',
    symbol: '_save',
    starts: '_save(input, reserved = false, transition = false) {',
    ends: 'const record = { ...body, record_digest: sha(canonical(body)) };',
    code: '0663bfda69cf3a3a',
  },
  {
    id: 'c.analysis._prepare_event.3',
    at: '2.8',
    file: 'lyric-harness/library/analysis.py',
    symbol: '_prepare_event',
    starts: 'if phase == "schema" and name not in cp.setdefault("refused_schemas", []):',
    ends: 'cp["refused_schemas"].append(name)',
    code: '3d704ae9c7cc1e21',
  },
  {
    id: 'c.contracts.CONTRACT_VERSION',
    at: '2.8',
    file: 'lyric-harness/library/contracts.py',
    symbol: 'CONTRACT_VERSION',
    starts: 'CONTRACT_VERSION = 1',
    whole: true,
    code: 'b9fb29224e9f02b0',
  },
  {
    id: 'c.contracts.semantic_identity',
    at: ['2.8', '9'],
    file: 'lyric-harness/library/contracts.py',
    symbol: 'semantic_identity',
    starts: 'identity = {"contract_version": CONTRACT_VERSION,',
    code: '124cd8faf887e8ae',
  },
  {
    id: 'c.analysis.AnalysisSession._TERMINAL_INPUTS',
    at: '2.8',
    file: 'lyric-harness/library/analysis.py',
    symbol: 'AnalysisSession._TERMINAL_INPUTS',
    starts: '_TERMINAL_INPUTS = ("domain_true", "domain_undecided", "alt_cells")',
    code: 'd349458045c4b759',
  },
  {
    id: 'c.analysis.step.2',
    at: ['2.8', '6.3'],
    file: 'lyric-harness/library/analysis.py',
    symbol: 'step',
    starts: 'except StopIteration:',
    ends: 'cp["counters"][key] += value',
    code: 'b2a5c2385474699d',
  },
  {
    id: 'c.analysis.step.3',
    at: '2.9',
    file: 'lyric-harness/library/analysis.py',
    symbol: 'step',
    starts: 'done = cp["method_index"] >= len(self.tasks)',
    ends: '"records": records, "done": done, "summary": self.summary(), "provider_calls": 0}',
    code: '18888ed530d5c2de',
  },
  {
    id: 'c.reader_scheduler.pump.1',
    at: '2.9',
    file: 'mcp/reader_scheduler.js',
    symbol: 'pump',
    starts:
      'const committed = this.store.commitCheckpoint(record.id, record.attempt, record.fence, {',
    ends: '});',
    code: '46d73878a769bb6e',
  },
  {
    id: 'c.reader_job_store.workerPayload',
    at: '2.10',
    file: 'mcp/reader_job_store.js',
    symbol: 'workerPayload',
    starts: 'workerPayload(id) {',
    whole: true,
    code: 'facb908c2d6fdeb2',
  },
  {
    id: 'c.reader_scheduler.pump.2',
    at: ['2.10', '5.1'],
    file: 'mcp/reader_scheduler.js',
    symbol: 'pump',
    starts: 'const trusted = this.store.workerPayload(record.id);',
    ends: 'committed_pages: trusted.page_paths || trusted.pages || [],',
    code: '9af3e210572093e3',
  },
  {
    id: 'c.worker.run_reader.1',
    at: '3',
    file: 'mcp/worker.py',
    symbol: 'run_reader',
    starts: 'if len(frame.encode("utf-8")) > 2 * 1024 * 1024:',
    code: '1831a83f8b74ab86',
  },
  {
    id: 'c.python_bridge.READER_FRAME_CAP',
    at: '3',
    file: 'mcp/python_bridge.js',
    symbol: 'READER_FRAME_CAP',
    starts: 'const READER_FRAME_CAP = 2 * 1024 * 1024 + 16384;',
    whole: true,
    code: '9984ca2e1f63dc5b',
  },
  {
    id: 'c.reader_job_store.encoded',
    at: ['3', '8'],
    file: 'mcp/reader_job_store.js',
    symbol: 'encoded',
    starts: 'function encoded(value, label, limit = READER_LIMITS.objectBytes) {',
    whole: true,
    code: 'c25c510edd5ee386',
  },
  {
    id: 'c.reader_scheduler.pump.3',
    at: ['3', '5.1'],
    file: 'mcp/reader_scheduler.js',
    symbol: 'pump',
    starts: '} catch (failure) {',
    // The second: the first is dispatch's, around listQueued() and lease().
    nth: [2, 2],
    ends: "if (stale.code !== 'STALE_ATTEMPT')",
    code: 'a0cbd73603202e8b',
  },
  {
    id: 'c.analysis._resource_guard',
    at: ['3', '8'],
    file: 'lyric-harness/library/analysis.py',
    symbol: '_resource_guard',
    starts: 'def _resource_guard(phase, extra_bytes=0):',
    ends: 'f"observed={resident}, reserved={extra_bytes}, envelope={ceiling}. "',
    code: 'e7da25dce7e5cdbb',
  },
  {
    id: 'c.meter.exact_number',
    at: ['3', '8'],
    file: 'lyric-harness/quality/meter.py',
    symbol: 'exact_number',
    starts: 'if max(out.numerator.bit_length(), out.denominator.bit_length()) > 256:',
    ends: 'raise ValueError(f"RESOURCE_LIMIT: {field} exceeds the 256-bit coordinate budget")',
    code: '2f6323d5218557b0',
  },
  {
    id: 'c.meter.guard_expansion',
    at: ['3', '8'],
    file: 'lyric-harness/quality/meter.py',
    symbol: 'guard_expansion',
    starts: 'def guard_expansion(count, field, limit=MAX_EXPANDED_POSITIONS):',
    whole: true,
    code: '59152f1779ca62fb',
  },
  {
    id: 'c.form.decode_beatgrid.1',
    at: '3',
    file: 'lyric-harness/library/form.py',
    symbol: 'decode_beatgrid',
    starts: 'from quality.meter import Cycle, exact_integer, exact_number',
    ends: 'positions[locus] = exact_number(pos.get("pulse"), "beatgrid pulse")',
    code: '03e248bae0ec8456',
  },
  {
    id: 'c.reader_job_store.jsonValue',
    at: ['3', '9'],
    file: 'mcp/reader_job_store.js',
    symbol: 'jsonValue',
    starts: 'function jsonValue(value, label) {',
    whole: true,
    code: '47f86f4b6d70ab22',
  },
  {
    id: 'c.worker.run_reader.2',
    at: '3',
    file: 'mcp/worker.py',
    symbol: 'run_reader',
    starts:
      'step = session.step(budget_candidates=256, deadline=min(deadline, time.monotonic() + 1),',
    code: '0f55e6f869369cc9',
  },
  {
    id: 'c.reader_job_store.commitCheckpoint.1',
    at: '3',
    file: 'mcp/reader_job_store.js',
    symbol: 'commitCheckpoint',
    starts: 'const inline = page_count <= 250 ? [...this._refs(root)] : [];',
    code: '09f81548b2b3fe3f',
  },
  {
    id: 'c.analysis.AnalysisSession.__init__.1',
    at: '3.1',
    file: 'lyric-harness/library/analysis.py',
    symbol: 'AnalysisSession.__init__',
    starts: 'self.checkpoint = copy.deepcopy(checkpoint)',
    ends: 'self._incomplete.update(self.checkpoint.get("incomplete", {}))',
    code: '3ff37f4f8daeb8f0',
  },
  {
    id: 'c.analysis.AnalysisSession.__init__.2',
    at: '3.1',
    file: 'lyric-harness/library/analysis.py',
    symbol: 'AnalysisSession.__init__',
    starts: 'self.tasks = [("coordinates", "coordinates")]',
    ends: 'self.tasks.append(("shared_sound", key))',
    code: 'fdf69a80e13a90b0',
  },
  {
    id: 'c.analysis._advance.2',
    at: '3.1',
    file: 'lyric-harness/library/analysis.py',
    symbol: '_advance',
    starts: 'self.checkpoint["phase"] = self.tasks[i][0] if i < len(self.tasks) else "complete"',
    code: '184ba7bbb8163d06',
  },
  {
    id: 'c.analysis._prepare_event.4',
    at: '3.1',
    file: 'lyric-harness/library/analysis.py',
    symbol: '_prepare_event',
    starts:
      'delta = {"candidates": 0, "true": 0, "false": 0, "undecided": 0, "refused_questions": 0,',
    ends: 'try:',
    code: 'bcbbe5e16a755c32',
  },
  {
    id: 'c.analysis._prepare_event.5',
    at: ['3.1', '6.8'],
    file: 'lyric-harness/library/analysis.py',
    symbol: '_prepare_event',
    starts: 'delta["candidates"] = 1',
    ends: 'return {"records": emitted, "delta": delta, "action": action, "method_id": self._task_mid(phase, name)}',
    code: 'c16b4154a0289665',
  },
  {
    id: 'c.analysis.step.4',
    at: ['2.6', '2.8', '3.1', '6.11', '6.3'],
    file: 'lyric-harness/library/analysis.py',
    symbol: 'step',
    starts: 'def step(self, budget_candidates: int = 256, deadline: float | None = None,',
    ends: 'cp["counters"][key] += value',
    code: 'c5c4f2c7273fa544',
  },
  {
    id: 'c.analysis._assembly_records.1',
    at: '3.1',
    file: 'lyric-harness/library/analysis.py',
    symbol: '_assembly_records',
    starts: 'counts["figure_counts"] = {tag: sum(verdict(v) == tag for _, _, v in assembled)',
    code: '4959643aad3c6bac',
  },
  {
    id: 'c.analysis._finish.1',
    at: '3.1',
    file: 'lyric-harness/library/analysis.py',
    symbol: '_finish',
    starts:
      'counts["coverage"] = "refused" if counts.get("refused_questions") else counts.get("coverage", "answered")',
    ends: 'counts["refusal"] = {"kind": "reading_combinations", "capability": "any_reading", "missing": [], "vacuous": [],',
    code: '3b429985bbabe87f',
  },
  {
    id: 'c.analysis._sound_result.1',
    at: ['3.1', '3.2', '5.2'],
    file: 'lyric-harness/library/analysis.py',
    symbol: '_sound_result',
    starts: 'if self.stream.unreadable and counts["coverage"] == "answered":',
    ends: 'return self._record("method_result", mid, "result", namespace="shared_sound",',
    code: '8dcb0e1d40231ff3',
  },
  {
    id: 'c.analysis._any_reading.1',
    at: '3.1',
    file: 'lyric-harness/library/analysis.py',
    symbol: '_any_reading',
    starts:
      'reason = f"a pair\'s words take more than {self.EDGE_COMBOS} combinations of readings"',
    code: 'df2c45f63ab73e1f',
  },
  {
    id: 'c.analysis._alternate_edges.1',
    at: ['3.1', '6.6'],
    file: 'lyric-harness/library/analysis.py',
    symbol: '_alternate_edges',
    starts:
      'self._incomplete.setdefault(name, f"a line\'s words take more than {self.EDGE_COMBOS} "',
    code: '6a89a93855b0890b',
  },
  {
    id: 'c.analysis._alternate_edges.2',
    at: ['3.1', '6.6'],
    file: 'lyric-harness/library/analysis.py',
    symbol: '_alternate_edges',
    starts: 'self._incomplete[name] = (f"its disputed words\' readings collide on more than "',
    code: 'a340b6d239afe0ab',
  },
  {
    id: 'c.analysis._domain_tally',
    at: ['3.1', '6.9'],
    file: 'lyric-harness/library/analysis.py',
    symbol: '_domain_tally',
    starts: 'def _domain_tally(delta, record):',
    whole: true,
    code: 'e19f26a69df95c4d',
  },
  {
    id: 'c.relations.realise',
    at: ['3.1', '3.2'],
    file: 'lyric-harness/quality/relations.py',
    symbol: 'realise',
    starts: 'why = "; ".join(',
    ends: 'f"— 0 {sup[c].detail}" for c in vac)',
    code: '3b7286f366a0d35e',
  },
  {
    id: 'c.analysis.AnalysisSession.__init__.3',
    at: '3.1',
    file: 'lyric-harness/library/analysis.py',
    symbol: 'AnalysisSession.__init__',
    starts:
      'self.checkpoint = {"contract_version": CONTRACT_VERSION, "identity_hash": self.identity["hash"],',
    code: 'c29fe9a6b563beb9',
  },
  {
    id: 'c.analysis._sound_result.2',
    at: ['3.1', '3.2'],
    file: 'lyric-harness/library/analysis.py',
    symbol: '_sound_result',
    starts:
      'counts["refusal"] = {"kind": "unknown_members", "capability": "native_reading", "missing": [], "vacuous": [],',
    ends: '"detail": "Unread lexical members remain in the source census. Findings over readable members do not answer those obligations."}',
    code: '1d03f1e2ff6a8a45',
  },
  {
    id: 'c.analysis._finish.2',
    at: '3.2',
    file: 'lyric-harness/library/analysis.py',
    symbol: '_finish',
    starts:
      'counts["refusal"] = {"kind": "unknown_members", "capability": "native_reading", "missing": [], "vacuous": [],',
    ends: '"detail": "Unread lexical members remain in the source census. Findings over readable members do not answer those obligations."}',
    code: '1d03f1e2ff6a8a45',
  },
  {
    id: 'c.analysis._finish.3',
    at: ['3.2', '6.6'],
    file: 'lyric-harness/library/analysis.py',
    symbol: '_finish',
    starts:
      'counts["refusal"] = {"kind": "reading_combinations", "capability": "any_reading", "missing": [], "vacuous": [],',
    ends: '+ ". Findings over the combinations searched do not answer the rest."}',
    code: 'c96d4bbcccf75e4b',
  },
  {
    id: 'c.analysis._prepare_event.6',
    at: '3.1',
    file: 'lyric-harness/library/analysis.py',
    symbol: '_prepare_event',
    starts: 'except _Refused as exc:',
    ends: 'counts["refusal"] = json_safe(exc.refusal)',
    code: '21a790f2b22768d2',
  },
  {
    id: 'c.analysis._Refused',
    at: '3.2',
    file: 'lyric-harness/library/analysis.py',
    symbol: '_Refused',
    starts: 'class _Refused(Exception):',
    whole: true,
    code: 'e54740ce2913e213',
  },
  {
    id: 'c.relations.Refusal',
    at: '3.2',
    file: 'lyric-harness/quality/relations.py',
    symbol: 'Refusal',
    starts: 'class Refusal:',
    ends: 'vacuous: tuple = ()',
    code: '4f0e67547ed35a65',
  },
  {
    id: 'c.contracts.json_safe',
    at: '3.2',
    file: 'lyric-harness/library/contracts.py',
    symbol: 'json_safe',
    starts: 'def json_safe(value: Any) -> Any:',
    whole: true,
    code: 'cf04cad816fad6f3',
  },
  {
    id: 'c.analysis._prepare_event.7',
    at: '3.1',
    file: 'lyric-harness/library/analysis.py',
    symbol: '_prepare_event',
    starts: 'except _Refused as exc:',
    ends: 'counts["coverage"] = "refused"',
    code: '21a790f2b22768d2',
  },
  {
    id: 'c.analysis._sound_candidates.1',
    at: '3.2',
    file: 'lyric-harness/library/analysis.py',
    symbol: '_sound_candidates',
    starts: 'if total > self.SOUND_PAIR_CAP:',
    ends: '"shared sound is not answered over the pairs it would reach before the cap", kind="capability"))',
    code: '94cac6addb849d67',
  },
  {
    id: 'c.registry.shared_sound_name',
    at: '3.2',
    file: 'lyric-harness/library/registry.py',
    symbol: 'shared_sound_name',
    starts: 'def shared_sound_name(key: str) -> str:',
    whole: true,
    code: '67da0c2881841dda',
  },
  {
    id: 'c.analysis.AnalysisSession.SOUND_PAIR_CAP',
    at: '3.2',
    file: 'lyric-harness/library/analysis.py',
    symbol: 'AnalysisSession.SOUND_PAIR_CAP',
    starts: 'SOUND_PAIR_CAP = 124322796',
    code: '47b50dad9aa2eaa8',
  },
  {
    id: 'c.analysis._candidates.3',
    at: '3.2',
    file: 'lyric-harness/library/analysis.py',
    symbol: '_candidates',
    starts:
      'if "beat" in schema.capabilities() and self._beat_placed is not None and self._beat_placed != {u.i for u in st.units}:',
    ends: 'missing=("beatgrid_complete",), kind="capability"))',
    code: 'd43c781ede98f0b3',
  },
  {
    id: 'c.analysis._candidates.4',
    at: '3.2',
    file: 'lyric-harness/library/analysis.py',
    symbol: '_candidates',
    starts: 'supply = {c: st.supply(c) for c in schema.capabilities()}',
    ends: 'kind="vacuous_frame" if len(vacuous) == len(missing) else "capability"))',
    code: '25682dbdc6f04831',
  },
  {
    id: 'c.registry.REMEDIES',
    at: '3.2',
    file: 'lyric-harness/library/registry.py',
    symbol: 'REMEDIES',
    starts: 'REMEDIES = {',
    whole: true,
    code: 'a1e081e6de0d5653',
  },
  {
    id: 'c.analysis._candidates.5',
    at: '3.2',
    file: 'lyric-harness/library/analysis.py',
    symbol: '_candidates',
    starts: 'try:',
    ends: 'raise _Refused(RL.Refusal(name, "span", str(exc), kind="span")) from exc',
    code: '15811fc26c22f615',
  },
  {
    id: 'c.relations.enumerate_spans',
    at: '3.2',
    file: 'lyric-harness/quality/relations.py',
    symbol: 'enumerate_spans',
    starts: 'raise NoReferent(',
    ends: 'f"any of the {skipped} loci in this declaration")',
    code: 'e7de5dc61819aea5',
  },
  {
    id: 'c.relations._loci',
    at: '3.2',
    file: 'lyric-harness/quality/relations.py',
    symbol: '_loci',
    starts: 'raise NoReferent(f"unknown locus {rule.locus!r}")',
    code: '9e501c1b84315eaa',
  },
  {
    id: 'c.relations._anchor_pos',
    at: '3.2',
    file: 'lyric-harness/quality/relations.py',
    symbol: '_anchor_pos',
    starts: 'def _anchor_pos(rule, stream, ids):',
    whole: true,
    code: 'c51e9270057171a0',
  },
  {
    id: 'c.analysis._candidates.6',
    at: '3.2',
    file: 'lyric-harness/library/analysis.py',
    symbol: '_candidates',
    starts:
      'if "stub_resolution" in schema.capabilities() and st.supply("stub_resolution").state == "absent":',
    ends: 'raise _Refused(derived)',
    code: '32081df0c4c4daf6',
  },
  {
    id: 'c.relations._stub_resolved_stream.1',
    at: '3.2',
    file: 'lyric-harness/quality/relations.py',
    symbol: '_stub_resolved_stream',
    starts: 'def _stub_resolved_stream(stream):',
    whole: true,
    code: 'ae0e18567bd768ea',
  },
  {
    id: 'c.relations._stub_resolved_stream.2',
    at: '3.2',
    file: 'lyric-harness/quality/relations.py',
    symbol: '_stub_resolved_stream',
    starts: 'return Refusal("refrain by reference", "stub_resolution",',
    nth: [1, 2],
    ends: 'kind="capability")',
    code: '90409d6fdbf708d9',
  },
  {
    id: 'c.relations._stub_resolved_stream.3',
    at: '3.2',
    file: 'lyric-harness/quality/relations.py',
    symbol: '_stub_resolved_stream',
    starts: 'if not rep["resolved"]:',
    ends: 'missing=("stub_resolution",), kind="capability")',
    code: 'ed0cba36024d029c',
  },
  {
    id: 'c.relations.search_stub_resolution.1',
    at: '3.2',
    file: 'lyric-harness/quality/relations.py',
    symbol: 'search_stub_resolution',
    starts: 'return Refusal(',
    ends: 'missing=("line_status",), kind="capability")',
    code: '26984ceecbdad2d1',
  },
  {
    id: 'c.relations._stub_resolved_stream.4',
    at: '3.2',
    file: 'lyric-harness/quality/relations.py',
    symbol: '_stub_resolved_stream',
    starts: 'rep = search_stub_resolution(stream)',
    ends: 'return rep',
    code: 'bcbcce587e8d733c',
  },
  {
    id: 'c.analysis._assembly_records.2',
    at: '3.2',
    file: 'lyric-harness/library/analysis.py',
    symbol: '_assembly_records',
    starts: 'assembled = RL.assemble(RL.REGISTRY[name], edges, self.stream)',
    ends: 'raise _Refused(assembled)',
    code: 'ce9ef095b687734a',
  },
  {
    id: 'c.relations.assemble.1',
    at: '3.2',
    file: 'lyric-harness/quality/relations.py',
    symbol: 'assemble',
    starts: 'def assemble(schema, edges, stream):',
    whole: true,
    code: 'f083d17596a7fbb7',
  },
  {
    id: 'c.relations.assemble.2',
    at: '3.2',
    file: 'lyric-harness/quality/relations.py',
    symbol: 'assemble',
    starts: 'if not figure_pair_representable(schema):',
    ends: 'return _full_shape(schema, stream)',
    code: '451809ae6d2b82b0',
  },
  {
    id: 'c.relations._full_shape.1',
    at: '3.2',
    file: 'lyric-harness/quality/relations.py',
    symbol: '_full_shape',
    starts: 'if schema.judge not in FULL_JUDGES:',
    ends: '"declared stanza frame.", missing=("stanza",))',
    code: 'de090c7a1b21eb66',
  },
  {
    id: 'c.analysis._prepare_event.8',
    at: '3.2',
    file: 'lyric-harness/library/analysis.py',
    symbol: '_prepare_event',
    starts: 'shapes = self._shape(name, kind, value)',
    ends: 'raise _Refused(shapes)',
    code: '7abdab5aba466070',
  },
  {
    id: 'c.analysis._shape',
    at: '3.2',
    file: 'lyric-harness/library/analysis.py',
    symbol: '_shape',
    starts: 'return RL._full_shape(RL.REGISTRY[name], view)',
    code: 'ffe31bd3031b98c3',
  },
  {
    id: 'c.relations.assemble.3',
    at: '3.2',
    file: 'lyric-harness/quality/relations.py',
    symbol: 'assemble',
    starts: 'if isinstance(edges, Refusal):',
    ends: 'return edges',
    code: '1588a0788cbdb7b0',
  },
  {
    id: 'c.analysis._assembly_records.3',
    at: '3.2',
    file: 'lyric-harness/library/analysis.py',
    symbol: '_assembly_records',
    starts: 'seen, edges = set(), []',
    ends: 'assembled = RL.assemble(RL.REGISTRY[name], edges, self.stream)',
    code: 'cb6beb63cafb6919',
  },
  {
    id: 'c.analysis._apply_declarations.1',
    at: '3.2',
    file: 'lyric-harness/library/analysis.py',
    symbol: '_apply_declarations',
    starts:
      'if not isinstance(declaration, dict) or not declaration.get("source") or not isinstance(declaration.get("positions"), dict):',
    code: 'b555bc9c6cc0d2d2',
  },
  {
    id: 'c.analysis._apply_declarations.2',
    at: '3.2',
    file: 'lyric-harness/library/analysis.py',
    symbol: '_apply_declarations',
    starts:
      'if not isinstance(declaration, dict) or not declaration.get("source") or not isinstance(declaration.get("groups"), list):',
    code: '11a063a7b7f6b392',
  },
  {
    id: 'c.analysis._apply_declarations.3',
    at: '3.2',
    file: 'lyric-harness/library/analysis.py',
    symbol: '_apply_declarations',
    starts: 'if not isinstance(declaration, dict) or not declaration.get("source"):',
    code: '44d28a8941656250',
  },
  {
    id: 'c.form.decode_beatgrid.2',
    at: '3.2',
    file: 'lyric-harness/library/form.py',
    symbol: 'decode_beatgrid',
    starts: '_source_basis(declaration, "beatgrid")',
    code: '213478803dec37d0',
  },
  {
    id: 'c.form._source_basis',
    at: '3.2',
    file: 'lyric-harness/library/form.py',
    symbol: '_source_basis',
    starts: 'def _source_basis(value, field):',
    whole: true,
    code: 'b40b8f1439a888c5',
  },
  {
    id: 'c.form.decode_beatgrid.3',
    at: '3.2',
    file: 'lyric-harness/library/form.py',
    symbol: 'decode_beatgrid',
    starts:
      'return BeatGrid(cycle=cycle, positions=positions, derived_from=declaration["derived_from"], source=declaration["source"])',
    code: '614f6b25eb4ae3a9',
  },
  {
    id: 'c.analysis._apply_declarations.4',
    at: '3.2',
    file: 'lyric-harness/library/analysis.py',
    symbol: '_apply_declarations',
    starts: 'projected = BeatGrid(cycle=grid.cycle, positions=positions,',
    ends: 'RL.declare_beat(st, projected)',
    code: 'b1813077c36395f7',
  },
  {
    id: 'c.relations.declare_beat',
    at: '3.2',
    file: 'lyric-harness/quality/relations.py',
    symbol: 'declare_beat',
    starts: 'def declare_beat(stream, mapping):',
    whole: true,
    code: 'df3c18cf22e5c0e4',
  },
  {
    id: 'c.relations._beat_from_grid',
    at: '3.2',
    file: 'lyric-harness/quality/relations.py',
    symbol: '_beat_from_grid',
    starts: 'def _beat_from_grid(stream, grid):',
    whole: true,
    code: '0ed03446e1999a68',
  },
  {
    id: 'c.analysis._apply_declarations.5',
    at: '3.2',
    file: 'lyric-harness/library/analysis.py',
    symbol: '_apply_declarations',
    starts: 'grid = decode_beatgrid(self.source, self.declarations["beatgrid"])',
    code: '8d268bc970082ef7',
  },
  {
    id: 'c.analysis._apply_declarations.6',
    at: '3.2',
    file: 'lyric-harness/library/analysis.py',
    symbol: '_apply_declarations',
    starts: 'st.frames.tonal_source = "declared"',
    code: '35ba701f0e63ce1b',
  },
  {
    id: 'c.analysis._apply_declarations.7',
    at: '3.2',
    file: 'lyric-harness/library/analysis.py',
    symbol: '_apply_declarations',
    starts: 'st.frames.lift_source = "declared"',
    code: '40572d8595570af8',
  },
  {
    id: 'c.analysis._apply_declarations.8',
    at: '3.2',
    file: 'lyric-harness/library/analysis.py',
    symbol: '_apply_declarations',
    starts: 'st.frames.beat_source = "declared"',
    nth: [1, 2],
    code: 'd71a914ad5a20668',
  },
  {
    id: 'c.analysis._apply_declarations.9',
    at: ['12', '3.2'],
    file: 'lyric-harness/library/analysis.py',
    symbol: '_apply_declarations',
    starts: 'st.frames.caesura, st.frames.caesura_source = mapping, "declared"',
    code: 'adff77431c9416b4',
  },
  {
    id: 'c.analysis._apply_declarations.10',
    at: '3.2',
    file: 'lyric-harness/library/analysis.py',
    symbol: '_apply_declarations',
    starts: 'st.frames.refrain_tail, st.frames.refrain_source = mapping, "declared"',
    code: '3d0acd1569e78210',
  },
  {
    id: 'c.analysis._apply_declarations.11',
    at: '3.2',
    file: 'lyric-harness/library/analysis.py',
    symbol: '_apply_declarations',
    starts: 'st.frames.stanza_source = "declared"',
    code: 'd3567a6a6c0b38c0',
  },
  {
    id: 'c.analysis._apply_declarations.12',
    at: '3.2',
    file: 'lyric-harness/library/analysis.py',
    symbol: '_apply_declarations',
    starts: 'st.frames.stub_source = "declared"',
    code: 'bad819beba7f1c30',
  },
  {
    id: 'c.analysis._apply_declarations.13',
    at: '3.2',
    file: 'lyric-harness/library/analysis.py',
    symbol: '_apply_declarations',
    starts: 'st.frames.beat_source = "declared"',
    nth: [2, 2],
    code: 'd71a914ad5a20668',
  },
  {
    id: 'c.analysis._apply_declarations.14',
    at: '3.2',
    file: 'lyric-harness/library/analysis.py',
    symbol: '_apply_declarations',
    starts: 'st.frames.stanza_source = "none"',
    code: '2049cfc4c388b452',
  },
  {
    id: 'c.analysis._sound_candidates.2',
    at: '3.2',
    file: 'lyric-harness/library/analysis.py',
    symbol: '_sound_candidates',
    starts: 'total = (len(toks) * (len(toks) - 1) // 2 + len(missing) * len(toks)',
    ends: '+ len(missing) * (len(missing) - 1) // 2)',
    code: 'fa54cf1e52ca699e',
  },
  {
    id: 'c.analysis._candidates.7',
    at: '3.2',
    file: 'lyric-harness/library/analysis.py',
    symbol: '_candidates',
    starts:
      'raise _Refused(RL.Refusal(name, missing[0], "; ".join(REMEDIES.get(c, "Supply " + c) for c in missing),',
    ends: 'kind="vacuous_frame" if len(vacuous) == len(missing) else "capability"))',
    code: 'ae168763751dd039',
  },
  {
    id: 'c.relations._full_shape.2',
    at: '3.2',
    file: 'lyric-harness/quality/relations.py',
    symbol: '_full_shape',
    starts: 'return Refusal(schema.name, miss[0],',
    ends: 'else "capability"))',
    code: 'c3ac8a47c88c6c46',
  },
  {
    id: 'c.analysis._sound_candidates.3',
    at: '3.2',
    file: 'lyric-harness/library/analysis.py',
    symbol: '_sound_candidates',
    starts: 'raise _Refused(self.RL.Refusal(',
    ends: '"shared sound is not answered over the pairs it would reach before the cap", kind="capability"))',
    code: 'cb8c279e33d8b56d',
  },
  {
    id: 'c.relations._full_shape.3',
    at: '3.2',
    file: 'lyric-harness/quality/relations.py',
    symbol: '_full_shape',
    starts: 'return Refusal(schema.name, "figure",',
    ends: '"certify the full figure.", kind="unsupported_shape")',
    code: '27a6003e63dc8e3b',
  },
  {
    id: 'c.analysis._candidates.8',
    at: '3.2',
    file: 'lyric-harness/library/analysis.py',
    symbol: '_candidates',
    starts: 'raise _Refused(RL.Refusal(name, "span", str(exc), kind="span")) from exc',
    code: '564f17fc80543fd3',
  },
  {
    id: 'c.analysis._candidates.9',
    at: '3.2',
    file: 'lyric-harness/library/analysis.py',
    symbol: '_candidates',
    starts:
      'raise _Refused(RL.Refusal(name, "beat", "The sourced BeatGrid does not place every native unit. Unplaced units are not off beat.",',
    ends: 'missing=("beatgrid_complete",), kind="capability"))',
    code: 'c2a511f416390fae',
  },
  {
    id: 'c.relations._full_shape.4',
    at: '3.2',
    file: 'lyric-harness/quality/relations.py',
    symbol: '_full_shape',
    starts: 'return Refusal(schema.name, "stanza", "A full figure requires a "',
    ends: '"declared stanza frame.", missing=("stanza",))',
    code: '8e52b4de8541f5df',
  },
  {
    id: 'c.relations._stub_resolved_stream.5',
    at: '3.2',
    file: 'lyric-harness/quality/relations.py',
    symbol: '_stub_resolved_stream',
    starts: 'sup = stream.supply("line_status")',
    ends: 'return []',
    code: 'd91644f8811ba953',
  },
  {
    id: 'c.relations.supply',
    at: '3.2',
    file: 'lyric-harness/quality/relations.py',
    symbol: 'supply',
    starts: 'if cap == "line_status":',
    ends: '"lines carrying a non-empty declared status")',
    code: '75e922a93c7aa893',
  },
  {
    id: 'c.relations._frame_supply',
    at: '3.2',
    file: 'lyric-harness/quality/relations.py',
    symbol: '_frame_supply',
    starts: 'def _frame_supply(self, cap, source, n, detail):',
    whole: true,
    code: '34c30bf33087e339',
  },
  {
    id: 'c.relations.search_stub_resolution.2',
    at: '3.2',
    file: 'lyric-harness/quality/relations.py',
    symbol: 'search_stub_resolution',
    starts: 'status = tuple(getattr(stream, "line_status", ()) or ())',
    ends: 'if status:',
    code: '311acc536a30d837',
  },
  {
    id: 'c.relations.search_stub_resolution.3',
    at: '3.2',
    file: 'lyric-harness/quality/relations.py',
    symbol: 'search_stub_resolution',
    starts: 'else:',
    nth: [2, 2],
    ends: 'missing=("line_status",), kind="capability")',
    code: 'bb11e58b72f8f235',
  },
  {
    id: 'c.reader_job_store.commitCheckpoint.2',
    at: '4',
    file: 'mcp/reader_job_store.js',
    symbol: 'commitCheckpoint',
    starts: 'const record = this._leaseRecord(id, attempt, fence);',
    ends: 'return { ...clone(record), added_page_paths: [] };',
    code: '7a9ab60095766687',
  },
  {
    id: 'c.reader_job_store.commitCheckpoint.3',
    at: '4',
    file: 'mcp/reader_job_store.js',
    symbol: 'commitCheckpoint',
    starts: 'try {',
    ends: '});',
    endsNth: 2,
    code: '0d4a770d84d79f7f',
  },
  {
    id: 'c.reader_job_store.commitCheckpoint.4',
    at: '4',
    file: 'mcp/reader_job_store.js',
    symbol: 'commitCheckpoint',
    starts: 'const saved = this._save({',
    ends: '});',
    code: '021b6f24b09e6fe0',
  },
  {
    id: 'c.reader_job_store._save.2',
    at: '4',
    file: 'mcp/reader_job_store.js',
    symbol: '_save',
    starts: "const bytes = encoded(record, 'Reader record');",
    ends: 'const slackDelta = reserveGap(bytes.length) - (previous ? reserveGap(previous) : 0);',
    code: 'bc19f624c70215ef',
  },
  {
    id: 'c.reader_job_store.commitCheckpoint.5',
    at: '4',
    file: 'mcp/reader_job_store.js',
    symbol: 'commitCheckpoint',
    starts: '} catch (error) {',
    ends: 'return this._quotaPause(record, error);',
    code: '4c0052e56f687ed6',
  },
  {
    id: 'c.reader_job_store.atomicWrite',
    at: '4',
    file: 'mcp/reader_job_store.js',
    symbol: 'atomicWrite',
    starts: 'fs.renameSync(temp, file);',
    ends: "fault('directory_synced', { kind, file });",
    code: '883940969e21b2e3',
  },
  {
    id: 'c.reader_job_store.resume.1',
    at: '5.1',
    file: 'mcp/reader_job_store.js',
    symbol: 'resume',
    starts: 'resume(id, capability, viewer, identity, options = {}) {',
    whole: true,
    code: 'b23da10780114c12',
  },
  {
    id: 'c.reader_job_store._open.1',
    at: '5.1',
    file: 'mcp/reader_job_store.js',
    symbol: '_open',
    starts: '_open(run) {',
    code: '42758a87a46c6dcb',
  },
  {
    id: 'c.reader_job_store._cached',
    at: '5.1',
    file: 'mcp/reader_job_store.js',
    symbol: '_cached',
    starts: '_cached(run) {',
    whole: true,
    code: 'c8e75ccc53921376',
  },
  {
    id: 'c.reader_job_store._enterLock.1',
    at: ['5.1', '6.11', '7.4'],
    file: 'mcp/reader_job_store.js',
    symbol: '_enterLock',
    starts: '_enterLock() {',
    whole: true,
    code: 'b64a642608b18e8f',
  },
  {
    id: 'c.reader_scheduler.pump.4',
    at: ['2.10', '5.1'],
    file: 'mcp/reader_scheduler.js',
    symbol: 'pump',
    starts: 'const trusted = this.store.workerPayload(record.id);',
    code: '312ce3c7d0da2e1c',
  },
  {
    id: 'c.reader_job_store._open.2',
    at: '5.1',
    file: 'mcp/reader_job_store.js',
    symbol: '_open',
    starts: '_open(run) {',
    whole: true,
    code: '42758a87a46c6dcb',
  },
  {
    id: 'c.reader_job_store._locked',
    at: '5.1',
    file: 'mcp/reader_job_store.js',
    symbol: '_locked',
    starts: '_locked(run) {',
    ends: ');',
    code: '29dc6dc66e18f9e0',
  },
  {
    id: 'c.test_reader_job_store.module',
    at: '5.1',
    file: 'mcp/test_reader_job_store.mjs',
    symbol: 'module',
    starts:
      "test('crash after pointer rename recovers exactly the newly committed generation', (t) => {",
    ends: ');',
    code: '3b48736fa9c1c6f6',
  },
  {
    id: 'c.reader_job_store.constructor.1',
    at: ['5.1', '7.4'],
    file: 'mcp/reader_job_store.js',
    symbol: 'constructor',
    starts: 'this.generation = -1;',
    code: '3f5972ad5a22309d',
  },
  {
    id: 'c.reader_job_store._capacity',
    at: '5.1',
    file: 'mcp/reader_job_store.js',
    symbol: '_capacity',
    starts: '_capacity(bytes, reserve = true, extraRecords = 0, slackDelta = 0) {',
    whole: true,
    code: '3aca650705c6d646',
  },
  {
    id: 'c.reader_job_store._object.1',
    at: '5.1',
    file: 'mcp/reader_job_store.js',
    symbol: '_object',
    starts: 'if (sha(bytes) !== hash)',
    ends: "throw problem('STORAGE_CORRUPT', 'Immutable reader object failed hash verification.', 503);",
    code: 'ffd1522d8a275771',
  },
  {
    id: 'c.reader_job_store.decodeStoredObject',
    at: '5.1',
    file: 'mcp/reader_job_store.js',
    symbol: 'decodeStoredObject',
    starts: 'export function decodeStoredObject(raw) {',
    whole: true,
    code: 'cde659ed88e5a273',
  },
  {
    id: 'c.reader_job_store._object.2',
    at: '5.1',
    file: 'mcp/reader_job_store.js',
    symbol: '_object',
    starts: 'return JSON.parse(bytes);',
    code: 'c191f67de6b2a935',
  },
  {
    id: 'c.reader_job_store._object.3',
    at: ['5.1', '7.4'],
    file: 'mcp/reader_job_store.js',
    symbol: '_object',
    starts: '_object(kind, hash) {',
    whole: true,
    code: '84c4231531c0b173',
  },
  {
    id: 'c.reader_job_store.resume.2',
    at: '5.1',
    file: 'mcp/reader_job_store.js',
    symbol: 'resume',
    starts: 'return this._save(',
    ends: ');',
    code: '7996ebbb2ae6274b',
  },
  {
    id: 'c.worker.read_page_object.1',
    at: '5.2',
    file: 'mcp/worker.py',
    symbol: 'read_page_object',
    starts: 'def read_page_object(page_path):',
    whole: true,
    code: 'f5a484490ac5b142',
  },
  {
    id: 'c.worker.read_page_object.2',
    at: '5.2',
    file: 'mcp/worker.py',
    symbol: 'read_page_object',
    starts: 'return json.loads(body.decode("utf-8"))',
    code: '74f569f6c35d7905',
  },
  {
    id: 'c.worker.read_page_object.3',
    at: '5.2',
    file: 'mcp/worker.py',
    symbol: 'read_page_object',
    starts: 'if raw[:2] == b"\\x1f\\x8b":',
    ends: 'raise ValueError("reader page object exceeds its bound, is truncated or has trailing data")',
    code: 'ccaa4dbeae98caa8',
  },
  {
    id: 'c.analysis._finish.4',
    at: '5.2',
    file: 'lyric-harness/library/analysis.py',
    symbol: '_finish',
    starts: 'tally = (counts.get("domain_true", []), counts.get("domain_undecided", []))',
    ends: 'domain=self._outcomes(self._domain(name, counts.get("alt_cells", [])), tally,',
    code: 'eba6b75c2676b6bd',
  },
  {
    id: 'c.analysis._sound_result.3',
    at: ['3.1', '5.2'],
    file: 'lyric-harness/library/analysis.py',
    symbol: '_sound_result',
    starts: 'tally = (counts.get("domain_true", []), counts.get("domain_undecided", []))',
    ends: 'domain=self._outcomes(self._sound_domain(key, counts.get("alt_cells", [])), tally)',
    code: '74522f7514177441',
  },
  {
    id: 'c.analysis.target.1',
    at: '6.1',
    file: 'lyric-harness/library/analysis.py',
    symbol: 'target',
    starts: 'if kx == ky or (kx, ky) in seen or same_rule and (ky, kx) in seen:',
    code: 'ea0e6996c6b17f2d',
  },
  {
    id: 'c.analysis._new_pairs.1',
    at: ['6.1', '6.4'],
    file: 'lyric-harness/library/analysis.py',
    symbol: '_new_pairs',
    starts: 'if key in seen or mirror and key[::-1] in seen:',
    code: '1e8a3d724119eecc',
  },
  {
    id: 'c.analysis._new_pairs.2',
    at: '6.2',
    file: 'lyric-harness/library/analysis.py',
    symbol: '_new_pairs',
    starts: 'def _new_pairs(self, schema, alt, aa, bb, seen):',
    whole: true,
    code: '626779a0551c8888',
  },
  {
    id: 'c.analysis._line_stream',
    at: '6.4',
    file: 'lyric-harness/library/analysis.py',
    symbol: '_line_stream',
    starts: 'raw = [text if i in keep else "" for i, text in enumerate(self._raw_lines)]',
    code: '9d62a0861839c45c',
  },
  {
    id: 'c.analysis._cell',
    at: '6.4',
    file: 'lyric-harness/library/analysis.py',
    symbol: '_cell',
    starts: 'def _cell(self, u):',
    whole: true,
    code: 'd2a058bf79855c67',
  },
  {
    id: 'c.analysis._span_key',
    at: '6.4',
    file: 'lyric-harness/library/analysis.py',
    symbol: '_span_key',
    starts: 'def _span_key(self, span, st):',
    whole: true,
    code: '09b3d3ce427ea176',
  },
  {
    id: 'c.analysis.target.2',
    at: '6.4',
    file: 'lyric-harness/library/analysis.py',
    symbol: 'target',
    starts: 'targets.setdefault((lines, self._combo_key(union)), (lines, union))',
    code: 'b28e2e40451d6401',
  },
  {
    id: 'c.analysis._alternate_edges.3',
    at: '6.4',
    file: 'lyric-harness/library/analysis.py',
    symbol: '_alternate_edges',
    starts: 'for key in sorted(targets):',
    code: '74c09aa2b0e4d9c3',
  },
  {
    id: 'c.analysis.target.3',
    at: '6.4',
    file: 'lyric-harness/library/analysis.py',
    symbol: 'target',
    starts: 'union, lines = cx or cy, (lx,)',
    ends: 'union, lines = {**(cx or {}), **(cy or {})}, tuple(sorted((lx, ly)))',
    code: 'd4ea479f24ea5337',
  },
  {
    id: 'c.analysis._discover',
    at: '6.4',
    file: 'lyric-harness/library/analysis.py',
    symbol: '_discover',
    starts: 'except RL.NoReferent:',
    ends: 'yield from self._new_pairs(schema, alt, left, right, seen)',
    code: '756fa7bceb22f8e8',
  },
  {
    id: 'c.analysis.AnalysisSession.__init__.4',
    at: '6.6',
    file: 'lyric-harness/library/analysis.py',
    symbol: 'AnalysisSession.__init__',
    starts: 'self._incomplete.update(self.checkpoint.get("incomplete", {}))',
    code: '339ac5d66ccda8bd',
  },
  {
    id: 'c.analysis._finish.5',
    at: ['3.2', '6.6'],
    file: 'lyric-harness/library/analysis.py',
    symbol: '_finish',
    starts: 'elif name in self._incomplete:',
    ends: 'rows.append(self._record("method_result", mid, "result", namespace="schema", schema_name=name,',
    code: 'a3882c54bf6d8e3c',
  },
  {
    id: 'c.analysis._any_reading.2',
    at: '6.6',
    file: 'lyric-harness/library/analysis.py',
    symbol: '_any_reading',
    starts: 'self._incomplete[name] = self.checkpoint.setdefault("incomplete", {})[name] = reason',
    code: '40214733eddf505e',
  },
  {
    id: 'c.analysis._prepare_event.9',
    at: ['3.1', '6.7', '6.8'],
    file: 'lyric-harness/library/analysis.py',
    symbol: '_prepare_event',
    starts: 'delta["candidates"] = 1',
    code: 'feeef2a4e5a7e6b7',
  },
  {
    id: 'c.analysis.step.5',
    at: ['2.6', '6.7'],
    file: 'lyric-harness/library/analysis.py',
    symbol: 'step',
    starts: 'if records and (time.monotonic() >= deadline or bytes_used >= max_bytes - 32768):',
    code: '46fc2358168b7ac1',
  },
  {
    id: 'c.reader_scheduler.pump.5',
    at: '6.7',
    file: 'mcp/reader_scheduler.js',
    symbol: 'pump',
    starts: 'lease_ms: Math.max(',
    ends: '),',
    code: '4b019c926658eabf',
  },
  {
    id: 'c.reader_job_store._expireLeases',
    at: ['6.7', '7.1', '8'],
    file: 'mcp/reader_job_store.js',
    symbol: '_expireLeases',
    starts: '_expireLeases() {',
    whole: true,
    code: '496018cd675463ae',
  },
  {
    id: 'c.analysis.resolve_detail_records.1',
    at: '6.9',
    file: 'lyric-harness/library/analysis.py',
    symbol: 'resolve_detail_records',
    starts: 'def resolve_detail_records(records):',
    ends: 'yield record',
    code: '610795d11fd2c11d',
  },
  {
    id: 'c.analysis._finish.6',
    at: '6.9',
    file: 'lyric-harness/library/analysis.py',
    symbol: '_finish',
    starts:
      'rows.append(self._record("method_result", mid, "result", namespace="schema", schema_name=name,',
    code: 'b0b4d03e6db1da89',
  },
  {
    id: 'c.analysis.resolve_detail_records.2',
    at: '6.9',
    file: 'lyric-harness/library/analysis.py',
    symbol: 'resolve_detail_records',
    starts: 'Parts are written immediately after their parent. A missing, duplicate,',
    prose: true,
    code: '2fa89104589809b7',
  },
  {
    id: 'c.worker.load_records',
    at: '6.9',
    file: 'mcp/worker.py',
    symbol: 'load_records',
    starts: 'def load_records(schema_id):',
    whole: true,
    code: '376e40c8957cc9dc',
  },
  {
    id: 'c.analysis._assembly_records.4',
    at: '6.9',
    file: 'lyric-harness/library/analysis.py',
    symbol: '_assembly_records',
    starts: 'def _assembly_records(self, name):',
    ends: '_resource_guard("whole-figure assembly", extra_bytes=len(edges) * 256)',
    code: '6997213bb9b32a5e',
  },
  {
    id: 'c.analysis.step.6',
    at: '6.11',
    file: 'lyric-harness/library/analysis.py',
    symbol: 'step',
    starts: 'deadline = min(deadline, start + 1) if deadline is not None else start + 1',
    code: '77f9bc04b1ce632b',
  },
  {
    id: 'c.analysis._domain',
    at: '6.11',
    file: 'lyric-harness/library/analysis.py',
    symbol: '_domain',
    starts: 'if any(token(s) is None for s in aa) or any(token(s) is None for s in bb):',
    ends: 'for n, (a, b, _) in enumerate(RL._candidate_pairs(schema, layout, st, {s.idx for s in aa},',
    code: '42ef3daf4ae9af82',
  },
  {
    id: 'c.payload_limits.HTTP_REQUEST_BYTES',
    at: '3',
    file: 'mcp/payload_limits.js',
    symbol: 'HTTP_REQUEST_BYTES',
    starts: 'export const HTTP_REQUEST_BYTES = (4 * 1024 + 512) * 1024;',
    whole: true,
    code: '23b9456915c14066',
  },
  {
    id: 'c.server_http.module.3',
    at: '3',
    file: 'mcp/server_http.js',
    symbol: 'module',
    starts: 'express.json({',
    head: 'app.use(',
    ends: '})',
    code: 'ba0efe192b57e7cc',
  },
  {
    id: 'c.server_http.module',
    at: '6.11',
    file: 'mcp/server_http.js',
    symbol: 'module',
    starts: 'maxBytes: Number(process.env.READER_STORAGE_MAX_BYTES) || 256 * 1024 * 1024,',
    code: '4ee9ded51c07ac3a',
  },
  {
    id: 'c.reader_job_store.resume.3',
    at: '7.1',
    file: 'mcp/reader_job_store.js',
    symbol: 'resume',
    starts: "if (!['paused', 'cancelled'].includes(record.state))",
    ends: ');',
    code: 'd73804b46e544536',
  },
  {
    id: 'c.reader_job_store._quotaPause',
    at: ['7.1', '8'],
    file: 'mcp/reader_job_store.js',
    symbol: '_quotaPause',
    starts: '_quotaPause(record, error) {',
    whole: true,
    code: 'cdcbc292f9fa23c9',
  },
  {
    id: 'c.reader_job_store.complete',
    at: '7.2',
    file: 'mcp/reader_job_store.js',
    symbol: 'complete',
    starts: 'return this._save({',
    ends: '});',
    code: '69147edd70231a3f',
  },
  {
    id: 'c.reader_job_store._tombstone',
    at: '7.2',
    file: 'mcp/reader_job_store.js',
    symbol: '_tombstone',
    starts: '_tombstone(record, state, options = {}) {',
    whole: true,
    code: '7ad2c31202c5ce4e',
  },
  {
    id: 'c.reader_job_store._markRecord',
    at: '7.2',
    file: 'mcp/reader_job_store.js',
    symbol: '_markRecord',
    starts: '_markRecord(record, live, budget) {',
    whole: true,
    code: '0479237ce7a58378',
  },
  {
    id: 'c.reader_job_store.maintain.1',
    at: '7.2',
    file: 'mcp/reader_job_store.js',
    symbol: 'maintain',
    starts: "gc.stack.push(['checkpoints', record.checkpoint_hash]);",
    ends: 'gc.stack.push(...this._discoveryRoots(record));',
    nth: [1, 2],
    code: '201a3975283f8864',
  },
  {
    id: 'c.reader_job_store.maintain.2',
    at: '7.2',
    file: 'mcp/reader_job_store.js',
    symbol: 'maintain',
    starts: "gc.stack.push(['checkpoints', record.checkpoint_hash]);",
    ends: 'gc.stack.push(...this._discoveryRoots(record));',
    nth: [2, 2],
    code: '201a3975283f8864',
  },
  {
    id: 'c.reader_job_store._markStep',
    at: '7.2',
    file: 'mcp/reader_job_store.js',
    symbol: '_markStep',
    starts: '_markStep(stack, live, budget, bounds = null) {',
    whole: true,
    code: '8612e7fcab48a1a3',
  },
  {
    id: 'c.reader_job_store.OBJECT_KINDS',
    at: '7.2',
    file: 'mcp/reader_job_store.js',
    symbol: 'OBJECT_KINDS',
    starts: "const OBJECT_KINDS = ['pages', 'indexes', 'checkpoints', 'manifests', 'definitions'];",
    whole: true,
    code: '028a6b425cd44a1b',
  },
  {
    id: 'c.reader_job_store._blob.3',
    at: ['2.5', '7.3'],
    file: 'mcp/reader_job_store.js',
    symbol: '_blob',
    starts: 'const now = new Date();',
    ends: 'fs.utimesSync(file, now, now);',
    code: 'e981943d84bb3d80',
  },
  {
    id: 'c.reader_job_store.constructor.2',
    at: '7.4',
    file: 'mcp/reader_job_store.js',
    symbol: 'constructor',
    starts: 'this._locked(() => {',
    ends: '});',
    code: 'b091ee548ec2f732',
  },
  {
    id: 'c.reader_job_store._enterLock.2',
    at: ['6.11', '7.4'],
    file: 'mcp/reader_job_store.js',
    symbol: '_enterLock',
    starts: 'this.usage = null;',
    ends: 'this._scheduleRecount();',
    code: '9ca9e639ce74cbcc',
  },
  {
    id: 'c.reader_job_store.pause',
    at: '7.4',
    file: 'mcp/reader_job_store.js',
    symbol: 'pause',
    starts: 'pause(',
    whole: true,
    code: '604090edc73d2010',
  },
  {
    id: 'c.reader_scheduler.pump.6',
    at: '7.4',
    file: 'mcp/reader_scheduler.js',
    symbol: 'pump',
    starts: 'record = this.store.lease();',
    code: '5af198b4587bd30f',
  },
  {
    id: 'c.reader_job_store.lease',
    at: '7.4',
    file: 'mcp/reader_job_store.js',
    symbol: 'lease',
    starts: 'const queued = this._dispatchable();',
    ends: "if (this._discoveryShape(record) === 'released') return null; // a repair to come (§7.4)",
    code: '42cd18a3b94097d8',
  },
  {
    id: 'c.reader_job_store._dispatchable',
    at: '7.4',
    file: 'mcp/reader_job_store.js',
    symbol: '_dispatchable',
    starts: '_dispatchable() {',
    whole: true,
    code: 'cc7934e2cf333441',
  },
  {
    id: 'c.reader_job_store.constructor.3',
    at: '7.4',
    file: 'mcp/reader_job_store.js',
    symbol: 'constructor',
    starts: 'this._pruneExpired(Infinity);',
    ends: 'this._collectAll();',
    code: 'a14aa5402a4ce0fe',
  },
  {
    id: 'c.analysis.AnalysisSession.__init__.5',
    at: ['8', '9'],
    file: 'lyric-harness/library/analysis.py',
    symbol: 'AnalysisSession.__init__',
    starts:
      'if checkpoint.get("contract_version") != CONTRACT_VERSION or checkpoint.get("identity_hash") != self.identity["hash"]:',
    code: '72636e11af7d107c',
  },
  {
    id: 'c.lyric_harness.main',
    at: '8',
    file: 'lyric-harness/lyric_harness.py',
    symbol: 'main',
    starts: 'if any(len(line) > 200 for line in lines):',
    ends: '"text capacity; no writer was started.")',
    code: '21123fd9c380474c',
  },
  {
    id: 'c.worker.main.1',
    at: '8',
    file: 'mcp/worker.py',
    symbol: 'main',
    starts: 'if reason not in ("INVALID_DECLARATION", "UNSUPPORTED_METHOD", "STALE_READING",',
    ends: '"RESOURCE_LIMIT", "RESULT_EXPIRED", "SNAPSHOT_CHANGED"):',
    code: 'bf6e52eaca2befee',
  },
  {
    id: 'c.worker.main.2',
    at: '8',
    file: 'mcp/worker.py',
    symbol: 'main',
    starts: 'reason = str(exc).split(":", 1)[0]',
    ends: '"RESOURCE_LIMIT", "RESULT_EXPIRED", "SNAPSHOT_CHANGED"):',
    code: '0be93d26ddbc232d',
  },
  {
    id: 'c.python_bridge.spawnWorker.1',
    at: '8',
    file: 'mcp/python_bridge.js',
    symbol: 'spawnWorker',
    starts: "else if (typeof reply.code === 'number') {",
    ends: ': {}),',
    code: '5d4c41bc8ef07386',
  },
  {
    id: 'c.python_bridge.spawnWorker.2',
    at: '8',
    file: 'mcp/python_bridge.js',
    symbol: 'spawnWorker',
    starts: "...(current.family === 'reader'",
    code: 'ee49ccf6fd8012a3',
  },
  {
    id: 'c.reader_scheduler.pump.7',
    at: '8',
    file: 'mcp/reader_scheduler.js',
    symbol: 'pump',
    starts: 'const checkpoint = async (step) => {',
    code: '340731351f144631',
  },
  // Step 4: the sink's own error is kept before the bridge sees it.
  {
    id: 'c.reader_scheduler.pump.10',
    at: '8',
    file: 'mcp/reader_scheduler.js',
    symbol: 'pump',
    starts: 'onReaderCheckpoint: (step) =>',
    ends: '}),',
    code: 'ce2c50c860af3fc8',
  },
  {
    id: 'c.reader_scheduler.packReaderPages',
    at: '8',
    file: 'mcp/reader_scheduler.js',
    symbol: 'packReaderPages',
    starts: 'if (size + 16 > 2 * 1024 * 1024)',
    ends: ');',
    code: '80a9aaebc5a18882',
  },
  {
    id: 'c.python_bridge.spawnWorker.3',
    at: '8',
    file: 'mcp/python_bridge.js',
    symbol: 'spawnWorker',
    starts: '})',
    nth: [5, 13],
    head: 'Promise.resolve()',
    ends: 'if (waiter === current) kill(error);',
    code: 'cf2bd022359bc025',
  },
  {
    id: 'c.python_bridge.execute',
    at: '8',
    file: 'mcp/python_bridge.js',
    symbol: 'execute',
    starts: "result = stamp(failure(['reader'], error), 'killed');",
    code: '441269f81e8a8861',
  },
  {
    id: 'c.python_bridge.createPythonBridge.failure',
    at: '8',
    file: 'mcp/python_bridge.js',
    symbol: 'createPythonBridge.failure',
    starts: 'const failure = (args, error) => {',
    ends: "result.stderr += `${result.stderr ? '\\n' : ''}${error.message}`;",
    code: 'dcca497dd06301db',
  },
  {
    id: 'c.reader_scheduler.pump.8',
    at: '8',
    file: 'mcp/reader_scheduler.js',
    symbol: 'pump',
    starts: 'if (result.code !== 0) {',
    code: '090dc9419698911c',
  },
  {
    id: 'c.reader_job_store.constructor.4',
    at: '8',
    file: 'mcp/reader_job_store.js',
    symbol: 'constructor',
    starts: 'this.usage = this._usage();',
    ends: '}),',
    code: '8415a9422a8791a4',
  },
  {
    id: 'c.reader_job_store.cancel',
    at: '8',
    file: 'mcp/reader_job_store.js',
    symbol: 'cancel',
    starts: 'cancel(id, capability, viewer, options = {}) {',
    ends: "? 'Cancellation requested; worker stops at its next committed safe point.'",
    code: 'cfc89d30ea3a963d',
  },
  {
    id: 'c.reader_job_store._reload',
    at: '8',
    file: 'mcp/reader_job_store.js',
    symbol: '_reload',
    starts: 'record.version !== 1 ||',
    head: 'if (',
    ends: "'Reader record failed identity or digest validation.',",
    code: '40ccaab20fe3663c',
  },
  {
    id: 'c.reader_job_store.READER_LIMITS',
    at: '8',
    file: 'mcp/reader_job_store.js',
    symbol: 'READER_LIMITS',
    starts: 'outstandingPerViewer: 2,',
    code: '3c2db6058caae103',
  },
  {
    id: 'c.reader_job_store.create',
    at: '8',
    file: 'mcp/reader_job_store.js',
    symbol: 'create',
    starts: 'if (this._outstanding(viewer) >= READER_LIMITS.outstandingPerViewer)',
    code: '139ed860eb728af2',
  },
  {
    id: 'c.reader_job_store.resume.4',
    at: ['5.1', '8'],
    file: 'mcp/reader_job_store.js',
    symbol: 'resume',
    starts: 'this._outstanding(viewer) >= READER_LIMITS.outstandingPerViewer',
    head: 'if (',
    code: '3e99fcd1eed9f418',
  },
  {
    id: 'c.build_identity.releaseIdentity',
    at: '9',
    file: 'mcp/build_identity.js',
    symbol: 'releaseIdentity',
    starts: 'commit: baked?.commit || env.BUILD_GIT_COMMIT || env.RENDER_GIT_COMMIT || null,',
    code: '1978042906bca492',
  },
  {
    id: 'c.server_http.readerResourceFingerprint',
    at: '9',
    file: 'mcp/server_http.js',
    symbol: 'readerResourceFingerprint',
    starts: 'const readerResourceFingerprint = () =>',
    whole: true,
    code: '3b358ef0e2659d13',
  },
  {
    id: 'c.reader_scheduler.createCatalogResolver',
    at: '9',
    file: 'mcp/reader_scheduler.js',
    symbol: 'createCatalogResolver',
    starts: "// The running reader's word-cut scheme (probeReaderScheme). Every identity",
    ends: '// STALE_READING at its lease even where both sides have no engine commit.',
    prose: true,
    code: '88db9f76a0502f70',
  },
  {
    id: 'c.reader_scheduler.pump.9',
    at: '9',
    file: 'mcp/reader_scheduler.js',
    symbol: 'pump',
    starts: 'const identity = await this.resolveIdentity(record.request);',
    ends: "throw error('STALE_READING', 'Source or engine identity changed; create a new reader job.');",
    code: 'f9cf73fa0810f1b2',
  },
];
// A row's digest: codeLines' for code, the trimmed lines for prose.
const citeDigest = (row, text) =>
  row.prose
    ? crypto
        .createHash('sha256')
        .update(
          text
            .split('\n')
            .map((t) => t.trim())
            .join('\n')
        )
        .digest('hex')
        .slice(0, 16)
    : digestOf(text, row.file.endsWith('.py'));
// The contract without the Base note, whose `file:symbol` and `:symbol` are
// the form's description, not citations.
const withoutBase = (text) => {
  const at = text.indexOf('**Base.**');
  return at < 0 ? text : text.slice(0, at) + text.slice(text.indexOf('\n\n', at));
};
// Every citation the contract makes, checked: none by line number; each names
// a symbol a row pins (ANCHORS, DEPTH_ANCHORS or CONTRACT_CITES), and each
// CONTRACT_CITES symbol is cited; and every row resolves to its digest.
function checkContractCites(src, contract = CONTRACT) {
  assert.equal(new Set(CONTRACT_CITES.map((r) => r.id)).size, CONTRACT_CITES.length);
  const at = resolveAnchors(CONTRACT_CITES, STORE_HALF, src);
  const off = CONTRACT_CITES.map((r) => [r.id, citeDigest(r, at.get(r.id).text)]).filter(
    ([id, d]) => CONTRACT_CITES.find((r) => r.id === id).code !== d
  );
  assert.deepEqual(
    off.map(([id]) => id),
    [],
    `the code the contract cites changed: read each claim again, then pin ${JSON.stringify(Object.fromEntries(off))}`
  );
  const text = withoutBase(contract);
  assert.deepEqual(lineCites(text), [], 'the contract cites no line number');
  const cited = new Set(citesOf(text));
  const key = (r) => `${r.file}:${r.symbol}`;
  const pinned = new Set([...ANCHORS, ...DEPTH_ANCHORS, ...CONTRACT_CITES].map(key));
  assert.deepEqual(
    [...cited].filter((c) => !pinned.has(c)).sort(),
    [],
    'every citation names a pinned symbol'
  );
  assert.deepEqual(
    [...new Set(CONTRACT_CITES.map(key))].filter((c) => !cited.has(c)).sort(),
    [],
    'every pinned symbol is cited'
  );
  // Each row backs a citation in the sections it names (`at`), and each
  // citation of a row's symbol, in each section, has a row there (his D8): a
  // row deleted, or a citation added where no row stands, fails. §2.11's
  // citations are the anchors' and §2.1's depth basis is DEPTH_ANCHORS'.
  const bySec = citesBySection(text);
  const rowAt = (r) => [].concat(r.at);
  assert.deepEqual(
    CONTRACT_CITES.flatMap((r) =>
      rowAt(r)
        .filter((sec) => !bySec.get(sec)?.has(key(r)))
        .map((sec) => `${r.id} in §${sec}`)
    ),
    [],
    'every row backs a citation in its section'
  );
  const anchored = new Set(ANCHORS.map(key));
  const depth = new Set(DEPTH_ANCHORS.map(key));
  const rowKeys = new Set(CONTRACT_CITES.map(key));
  const unbacked = [];
  for (const [sec, keys] of bySec)
    for (const k of keys) {
      if ((sec === '2.11' && anchored.has(k)) || (sec === '2.1' && depth.has(k))) continue;
      if (!rowKeys.has(k)) continue;
      if (!CONTRACT_CITES.some((r) => key(r) === k && rowAt(r).includes(sec)))
        unbacked.push(`§${sec} ${k}`);
    }
  assert.deepEqual(unbacked, [], 'every citation has a row in its section');
  // The rows' ranges, their digests aside, are held to the digest the Base
  // note states, so a row deleted, narrowed or moved changes the contract.
  const table = citesTableDigest();
  assert.ok(
    contract.includes(`held to the digest \`${table}\``),
    `the Base note states the rows' digest, ${table}`
  );
}
// The digest of CONTRACT_CITES' ranges: each row's fields other than `code`.
const citesTableDigest = (rows = CONTRACT_CITES) =>
  sha(
    Buffer.from(
      JSON.stringify(
        rows.map((r) => Object.fromEntries(Object.entries(r).filter(([k]) => k !== 'code')))
      )
    )
  ).slice(0, 16);
// The citations of each numbered section (`## 3.`, `### 6.11`; text before
// the first is `0`), by section.
function citesBySection(text) {
  const out = new Map();
  let sec = '0';
  let chunk = [];
  const flush = () => {
    if (!out.has(sec)) out.set(sec, new Set());
    for (const c of citesOf(chunk.join('\n'))) out.get(sec).add(c);
    chunk = [];
  };
  for (const line of text.split('\n')) {
    const m = /^#{2,4} (\d+(?:\.\d+)?)[. ]/.exec(line);
    if (!m) {
      chunk.push(line);
      continue;
    }
    flush();
    sec = m[1];
  }
  flush();
  return out;
}

test('the contract: every citation is a pinned file:symbol, never a line, and holds its digest', () => {
  checkContractCites(readSource);
  // A line citation anywhere in the contract fails, by line.
  assert.throws(
    () =>
      checkContractCites(
        readSource,
        CONTRACT.replace('(`analysis.py:_candidates`)', '(`analysis.py:2038`)')
      ),
    /cites no line number/
  );
  // So does a citation of a symbol no row pins.
  assert.throws(
    () => checkContractCites(readSource, `${CONTRACT}\nSee \`analysis.py:_cell_shape\`.\n`),
    /every citation names a pinned symbol/
  );
  // His D8: a pinned symbol cited in a section where no row backs it fails,
  // and so does a row deleted or narrowed, even where another row pins the
  // same symbol in the same section: the rows' digest in the Base note moves.
  assert.throws(
    () => checkContractCites(readSource, `${CONTRACT}\nSee \`reader_job_store.js:pause\`.\n`),
    /every citation has a row in its section/
  );
  for (const [id, change] of [
    ['c.reader_scheduler.pump.5', null],
    ['c.analysis._prepare_event.9', null],
    ['c.analysis._candidates.1', (r) => ({ ...r, ends: 'seen = set()' })],
  ]) {
    const i = CONTRACT_CITES.findIndex((r) => r.id === id);
    const row = CONTRACT_CITES[i];
    const rows = change ? CONTRACT_CITES.with(i, change(row)) : CONTRACT_CITES.toSpliced(i, 1);
    assert.notEqual(citesTableDigest(rows), citesTableDigest(), `${id}: the rows' digest moves`);
  }
  assert.ok(CONTRACT.includes(`held to the digest \`${citesTableDigest()}\``));
});

test('the contract: a line shift or a comment above a cited range never fails; a change inside one does', () => {
  // Above each row in turn, as for the anchors: the row resolves one line
  // lower and its digest stands.
  for (const row of CONTRACT_CITES) {
    const text = readSource(row.file);
    const { line } = resolveAnchor(text, row);
    const own = /^\s*/.exec(text.split('\n')[line - 1])[0];
    const py = row.file.endsWith('.py');
    for (const what of ['', `${own}${py ? '# moved' : '// moved'}`]) {
      const got = resolveAnchor(insertAbove(text, line, what), row);
      assert.equal(got.line, line + 1, `${row.id} follows ${JSON.stringify(what)}`);
      assert.equal(citeDigest(row, got.text), row.code, `${row.id}: its digest stands`);
    }
  }
  // A change inside a range, in each language and in a file §2.11 does not
  // cite, fails by the row's id.
  for (const [file, old, now, id] of [
    [
      'lyric-harness/library/analysis.py',
      '        seen = set()\n',
      '        seen = {}\n',
      'c.analysis._candidates.1',
    ],
    [
      'lyric-harness/quality/relations.py',
      '    remaining = {}\n',
      '    remaining = dict()\n',
      'c.relations._candidate_pairs',
    ],
    [
      'mcp/reader_job_store.js',
      '      this.generation = -1;\n',
      '      this.generation = 0;\n',
      'c.reader_job_store.constructor.1',
    ],
  ]) {
    const text = readSource(file);
    assert.equal(text.split(old).length, 2, `${id}: its text occurs once`);
    assert.throws(
      () =>
        checkContractCites(
          withFile(
            file,
            text.replace(old, () => now)
          )
        ),
      (e) => new RegExp(escapeRe(id)).test(e.message),
      `${id} fails`
    );
  }
});

// The fatal decode the store half implements (§2.11, Step 5): until then the
// store has no fatal decoder at all; once it lands, the only parse of segment
// bytes is a one-statement helper that decodes fatally first.
function checkFatalDecode(half, src) {
  const store = src('mcp/reader_job_store.js');
  if (!half.fatal_decode) {
    assert.ok(!/fatal: true/.test(store), 'the requirement is not met yet, so it is stated');
    return;
  }
  const row = (symbol) => ({ id: `store.${symbol}`, file: 'mcp/reader_job_store.js', symbol });
  const body = (symbol) =>
    spanText(store, row(symbol))
      .split('\n')
      .slice(1, -1)
      .map((s) => s.trim())
      .filter(Boolean);
  const text = body('_segmentText');
  assert.equal(text.length, 1, '_segmentText is one statement');
  assert.ok(text[0].startsWith("return new TextDecoder('utf-8', { fatal: true }).decode("));
  const json = body('_segmentJSON');
  assert.equal(json.length, 1, '_segmentJSON is one statement');
  assert.ok(json[0].startsWith('return JSON.parse(this._segmentText('));
  const segment = spanText(store, row('_segment'));
  assert.ok(
    !/JSON\.parse\(|\.toString\(|TextDecoder/.test(segment),
    '_segment parses nothing itself'
  );
  assert.ok(segment.includes('this._segmentJSON('), '_segment reads through _segmentJSON');
}

test('§2.11: every citation resolves to a pinned symbol, and the trace runs end to end', () => {
  check211(STORE_HALF, readSource, s211raw());
  checkDigests(STORE_HALF, readSource);
  // The round trip, run: JSON.parse makes the escape a lone surrogate,
  // JSON.stringify writes it back as the escape, Python's json.loads makes it
  // a lone surrogate again, and the frame's strict encode refuses it.
  const parsed = JSON.parse('{"declaration_set":{"pronunciations":[{"line":"Bad \\ud800"}]}}');
  const line = parsed.declaration_set.pronunciations[0].line;
  assert.equal(line.isWellFormed(), false);
  const wire = JSON.stringify({ reader: { declarations: parsed.declaration_set } });
  assert.ok(wire.includes('Bad \\ud800'), 'the bridge writes the escape');
  const run = spawnSync(
    'python3',
    [
      '-I',
      '-c',
      [
        'import json,sys',
        'v=json.loads(sys.stdin.read())["reader"]["declarations"]["pronunciations"][0]["line"]',
        'frame=json.dumps({"data":v},ensure_ascii=False,separators=(",",":"))',
        'try:',
        '    frame.encode("utf-8"); print("encodes")',
        'except UnicodeEncodeError:',
        '    print("the size check refuses", hex(ord(v[-1])))',
      ].join('\n'),
    ],
    { input: wire }
  );
  assert.equal(run.status, 0, run.stderr?.toString());
  assert.equal(run.stdout.toString().trim(), 'the size check refuses 0xd800');
});

// The admission refusal: a declaration set holding a string or key, at any
// depth, that is not well-formed Unicode. This is the predicate §2.11 requires.
const wellFormedDeep = (v) =>
  typeof v === 'string'
    ? v.isWellFormed()
    : Array.isArray(v)
      ? v.every(wellFormedDeep)
      : v && typeof v === 'object'
        ? Object.entries(v).every(([k, x]) => k.isWellFormed() && wellFormedDeep(x))
        : true;

// The stored-request case's anchors and their order (§2.11), as a function
// of the fixture's block, the STORE_HALF state and the sources.
function checkStoredRequest(st, half, src) {
  const ids = [st.store_leased_at, st.store_lease, st.checked_at, st.paused_at];
  assert.deepEqual(ids, [
    'sched.pump.store_lease',
    'store.lease',
    'sched.pump.stored_check',
    'sched.pump.catch_pause',
  ]);
  for (const id of ids) assert.ok(ANCHOR.get(id)?.cite, `${id} is a cited anchor`);
  const at = resolveAnchors(
    ids.map((id) => ANCHOR.get(id)).concat(ANCHOR.get('sched.pump.run_reader_lease')),
    half,
    src
  );
  // The order the record meets them in: the store's lease, the check, then the
  // bridge lease the check keeps it from, and the catch's pause.
  assert.ok(at.get(st.store_leased_at).text.includes('this.store.lease()'));
  const bridge = at.get('sched.pump.run_reader_lease');
  if (half.admission) {
    assert.ok(
      at.get(st.store_leased_at).line < at.get(st.checked_at).line,
      'the store leases before the check'
    );
    assert.ok(at.get(st.checked_at).endLine < bridge.line, 'the check comes before it');
  } else assert.ok(!at.has(st.checked_at), 'the check is not implemented yet');
  assert.ok(at.get(st.store_leased_at).line < bridge.line, 'the store leases before the bridge');
  assert.ok(bridge.endLine < at.get(st.paused_at).line, 'the catch follows the bridge lease');
  assert.ok(at.get(st.store_lease).text.includes("state: 'running'"), 'lease() saves it running');
}

test(`${CODEC}: the admission guard's cases, paths and refusal (§2.11, §9)`, () => {
  const fx = load(CODEC);
  const ad = fx.admission;
  for (const c of ad.refused) {
    const body = JSON.parse(c.body);
    assert.equal(wellFormedDeep(body.declaration_set), false, `${c.name}: refused`);
  }
  for (const c of ad.admitted) {
    const body = JSON.parse(c.body);
    assert.equal(wellFormedDeep(body.declaration_set), true, `${c.name}: admitted`);
  }
  assert.deepEqual(
    ad.refused.map((c) => c.name),
    ['line', 'key']
  );
  assert.ok(Object.keys(JSON.parse(ad.refused[1].body).declaration_set)[0].includes('\ud800'));
  // The two create paths are the two validateRequest callers the trace pins.
  assert.deepEqual(
    ad.paths.map((p) => p.cite),
    ['routes.router.validate_call', 'viewer.router.validate_call']
  );
  for (const p of ad.paths) {
    const row = ANCHOR.get(p.cite);
    assert.ok(row?.cite, p.cite);
    assert.match(resolveAnchor(readSource(row.file), row).text, /validateRequest\(/);
  }
  assert.deepEqual(
    { code: ad.code, status: ad.status },
    { code: 'INVALID_DECLARATION', status: 400 }
  );
  // BB8 21:31Z: a record written before the check is leased by the store
  // (store.lease() runs before the check and saves it running), refused at the
  // scheduler's check before workerPayload, and paused with the code by the
  // catch; the bridge's runReaderLease is never reached.
  const st = ad.stored_request;
  const stored = JSON.parse(st.request);
  assert.equal(wellFormedDeep(stored.declaration_set), false, 'the stored request is refused');
  assert.deepEqual(stored, JSON.parse(ad.refused[0].body), "the guard test's line, stored");
  assert.equal(st.written_before_the_check, true);
  assert.deepEqual(st.expect, {
    code: ad.code,
    store_leased: true,
    paused: true,
    run_reader_lease: 'never called',
  });
  checkStoredRequest(st, STORE_HALF, readSource);
});

// The anchors, mutated in memory: no repo copy, no ROOT override, nothing
// written. A line shift or an inserted comment never fails; a changed pinned
// statement, a renamed symbol, a second definition, an ambiguous anchor or a
// flipped STORE_HALF key always does.
const ANCHOR_FILES = [...new Set([...ANCHORS, ...DEPTH_ANCHORS].map((r) => r.file))];
const insertAbove = (text, line, what) => {
  const lines = text.split('\n');
  lines.splice(line - 1, 0, what);
  return lines.join('\n');
};
const withFile = (file, text) => (f) => (f === file ? text : readSource(f));

test('anchors: a line shift or a comment above any anchor never fails, on unchanged contract text', () => {
  const contract211 = s211raw();
  // A blank line at the top of every cited file at once.
  const blankTop = (f) => `\n${readSource(f)}`;
  check211(STORE_HALF, blankTop, contract211);
  checkDigests(STORE_HALF, blankTop);
  checkStoredRequest(load(CODEC).admission.stored_request, STORE_HALF, blankTop);
  checkFatalDecode(STORE_HALF, blankTop);
  declaredDepths(blankTop);
  checkContractCites(blankTop);
  // Above each anchor in turn: a blank line, then a comment at the anchor's
  // own indentation, then (Python) a comment at column 0.
  for (const row of [...ANCHORS, ...DEPTH_ANCHORS]) {
    if (row.when && !STORE_HALF[row.when]) continue;
    const text = readSource(row.file);
    const { line } = resolveAnchor(text, row);
    const own = /^\s*/.exec(text.split('\n')[line - 1])[0];
    const py = row.file.endsWith('.py');
    const mutants = ['', `${own}${py ? '# moved' : '// moved'}`, ...(py ? ['# moved'] : [])];
    for (const what of mutants) {
      const moved = insertAbove(text, line, what);
      const got = resolveAnchor(moved, row);
      assert.equal(got.line, line + 1, `${row.id} follows ${JSON.stringify(what)}`);
      if (ANCHORS.includes(row)) {
        check211(STORE_HALF, withFile(row.file, moved), contract211);
        checkDigests(STORE_HALF, withFile(row.file, moved));
      } else declaredDepths(withFile(row.file, moved));
    }
  }
});

test('codeLines: a comment is cut out of its line, and the code beside it kept (BB8 6701778607, item 2)', () => {
  const js = (t) => codeLines(t, false);
  const py = (t) => codeLines(t, true);
  assert.deepEqual(js('/* noop */ return null;'), ['return null;']);
  assert.deepEqual(js('a(); // note\n// line\n/* one\ntwo */ b();'), ['a();', 'b();']);
  assert.deepEqual(js("const u = 'http://x/*y*/'; /* c */"), ["const u = 'http://x/*y*/';"]);
  assert.deepEqual(js('const r = /\\/\\//; // c'), ['const r = /\\/\\//;']);
  assert.deepEqual(js('const t = `a\n// in a template\n`;'), [
    'const t = `a',
    '// in a template',
    '`;',
  ]);
  assert.deepEqual(py('"""x"""; return {}'), ['; return {}']);
  assert.deepEqual(py('"""doc\nmore\n"""\nx = 1  # c\n# line'), ['x = 1']);
  assert.deepEqual(py("s = '#not a comment'  # a comment"), ["s = '#not a comment'"]);
  assert.deepEqual(py('x = """kept\n# kept too\n"""'), ['x = """kept', '# kept too', '"""']);
  // A change beside a comment moves the digest; the comment alone does not.
  assert.notEqual(digestOf('/* noop */ return null;', false), digestOf('', false));
  assert.equal(digestOf('a(); // one', false), digestOf('a(); // two', false));
  // His D1: a docstring is a bare string opening a def or class body, or
  // the text at column 0. A prefixed one, one inside brackets, one after
  // other code and one followed by code stay code.
  assert.deepEqual(py('def f(x):\n    """doc\n    more"""\n    return x'), [
    'def f(x):',
    '    return x',
  ]);
  assert.deepEqual(py('class C:\n    """doc"""\n    n = 1'), ['class C:', '    n = 1']);
  assert.deepEqual(py('def f(x):\n    f"""{x.pop()}"""'), ['def f(x):', '    f"""{x.pop()}"""']);
  assert.deepEqual(py('raise E(f"a; "\n      """b""")'), ['raise E(f"a; "', '      """b""")']);
  assert.deepEqual(py('x = 1\n"""not a docstring"""'), ['x = 1', '"""not a docstring"""']);
  assert.deepEqual(py('def f():\n    """d""".strip()'), ['def f():', '    "".strip()']);
  assert.deepEqual(py('    """indented, not at column 0"""'), ['"""indented, not at column 0"""']);
  // His D2: a Python line keeps its indentation relative to the first, so
  // a statement moved into or out of a block moves the digest; a JS one
  // does not.
  assert.deepEqual(py('    if a:\n        b\n    c'), ['if a:', '    b', 'c']);
  assert.notEqual(digestOf('if a:\n    b\nc', true), digestOf('if a:\n    b\n    c', true));
  assert.equal(digestOf('if (a) {\n  b();\n}', false), digestOf('if (a) {\nb();\n}', false));
  assert.deepEqual(py('    x = """\nat column 0\n"""'), ['x = """', '<4>at column 0', '<4>"""']);
});

test('anchors: a Python definition cited whole starts at its first decorator (his D3)', () => {
  const text = readSource('lyric-harness/library/analysis.py');
  const row = ANCHOR.get('analysis.public_declarations');
  const plain = resolveAnchor(text, row);
  const def = 'def _public_declarations(value):\n';
  for (const deco of ['@(lambda f: lambda value: value)\n', '@a\n# between\n\n@b(\n    1,\n)\n']) {
    const got = resolveAnchor(
      text.replace(def, () => deco + def),
      row
    );
    assert.equal(got.line, plain.line, 'the range starts at the first decorator');
    assert.ok(got.text.startsWith(deco.split('\n')[0]), got.text.split('\n')[0]);
    assert.notEqual(digestOf(got.text, true), digestOf(plain.text, true));
  }
  // A comment or a blank line above an undecorated definition is not part
  // of it, and the function before it ends where it did.
  const got = resolveAnchor(
    text.replace(def, () => `# note\n\n${def}`),
    row
  );
  assert.equal(got.line, plain.line + 2);
  assert.equal(got.text, plain.text);
});

// Whether each text is one whole statement, parsed by the language itself and
// never run. Python: its ast, on the dedented text, holds exactly one
// statement. JS: it compiles as the one statement of an `if (0) … else ;` in an
// async generator body (a `const` or `let` read as `var`, which that position
// allows), so a cut-off statement fails and so do two; or, for an array
// element or an object property, inside `[…]` or `({…})`, where a cut-off one
// fails.
function wholeStatements(texts, py) {
  if (!py)
    return texts.map((t) =>
      [
        `(async function* () {\nif (0) ${t.replace(/^(\s*)(?:const|let)\b/, '$1var')}\nelse;\n});`,
        `[\n${t}\n];`,
        `({\n${t}\n});`,
      ].some((w) => {
        try {
          new vm.Script(w);
          return true;
        } catch {
          return false;
        }
      })
    );
  const run = spawnSync(
    'python3',
    [
      '-I',
      '-c',
      [
        'import ast, json, sys, textwrap',
        'out = []',
        'for t in json.load(sys.stdin):',
        '    try:',
        '        out.append(len(ast.parse(textwrap.dedent(t)).body) == 1)',
        '    except SyntaxError:',
        '        out.append(False)',
        'print(json.dumps(out))',
      ].join('\n'),
    ],
    { input: JSON.stringify(texts) }
  );
  assert.equal(run.status, 0, run.stderr?.toString());
  return JSON.parse(run.stdout.toString());
}

test('anchors: a cited row with neither whole nor ends covers its whole statement, and only it', () => {
  // BB8 6701778607, item 1: such a row runs to the end of its statement, so
  // its digest holds every line of it; and each one, one line or more, is
  // checked to be exactly one statement by the language's own parser.
  const rows = [...ANCHORS.filter((r) => r.cite), ...CONTRACT_CITES].filter(
    (r) => !r.whole && !r.ends && !r.prose
  );
  const at = resolveAnchors(rows, STORE_HALF, readSource);
  const broken = [false, true].flatMap((py) => {
    const mine = rows.filter((r) => at.has(r.id) && r.file.endsWith('.py') === py);
    const ok = wholeStatements(
      mine.map((r) => at.get(r.id).text),
      py
    );
    return mine.filter((_, i) => !ok[i]).map((r) => r.id);
  });
  assert.deepEqual(broken, [], 'each is one whole statement');
  // The multi-line call BB8 named: its first line alone is not a statement,
  // and the row now runs to the call's close.
  const session = at.get('worker.run_reader.session');
  assert.ok(session.endLine > session.line, 'the AnalysisSession call runs past its first line');
  assert.match(session.text, /identity=payload\.get\("identity"\)/);
  assert.deepEqual(wholeStatements([session.text.split('\n')[0]], true), [false]);
  // A braceless JS if takes its body; an element is its own statement.
  const bound = resolveAnchor(
    readSource('mcp/reader_job_store.js'),
    ANCHOR.get('store.read_file.bound')
  );
  assert.equal(bound.endLine, bound.line + 1);
  const key = at.get('routes.validate.idempotency_key');
  assert.equal(key.endLine, key.line);
});

// Whether each Python range, `[file, first, last]` (1-based), is made of whole
// statements, by the file's own ast: its first line opens a statement (or an
// except, else or finally clause), its last line ends a statement that starts
// in it, and no statement that starts in it ends past it. `files` gives each
// file's text.
function pyRangesWhole(ranges, files) {
  const run = spawnSync(
    'python3',
    [
      '-I',
      '-c',
      [
        'import ast, json, sys',
        'data = json.load(sys.stdin)',
        'cache, out = {}, []',
        'for f, s, e in data["ranges"]:',
        '    if f not in cache:',
        '        text = data["files"][f]',
        '        lines = text.split("\\n")',
        '        starts, spans = set(), []',
        '        for n in ast.walk(ast.parse(text)):',
        '            if isinstance(n, (ast.stmt, ast.ExceptHandler)):',
        '                starts.add(n.lineno)',
        '                spans.append((n.lineno, n.end_lineno))',
        '        for i, l in enumerate(lines):',
        '            if l.strip() in ("else:", "finally:"):',
        '                starts.add(i + 1)',
        '        cache[f] = (starts, spans)',
        '    starts, spans = cache[f]',
        '    out.append(s in starts and any(a >= s and b == e for a, b in spans)',
        '               and not any(s <= a <= e and b > e for a, b in spans))',
        'print(json.dumps(out))',
      ].join('\n'),
    ],
    { input: JSON.stringify({ ranges, files }) }
  );
  assert.equal(run.status, 0, run.stderr?.toString());
  return JSON.parse(run.stdout.toString());
}
// Whether each JS text is a run of whole statements, class members, object
// properties or array elements: it compiles in one of those places, never
// run. A text that opens on the brace closing the block before it (`} catch`,
// `} else`), or on an `else`, is read after the statement it continues.
function jsWholeRun(texts) {
  return texts.map((t) => {
    const pre = /^\s*\}\s*(?:catch|finally)\b/.test(t)
      ? 'try {\n'
      : /^\s*\}\s*else\b/.test(t)
        ? 'if (0) {\n'
        : /^\s*else\b/.test(t)
          ? 'if (0) {}\n'
          : '';
    return [
      `(async function* () {\nfor (;;) {\n${pre}${t}\n}\n});`,
      `(class {\n${t}\n});`,
      `({\n${t}\n});`,
      `[\n${t}\n];`,
    ].some((w) => {
      try {
        new vm.Script(w);
        return true;
      } catch {
        return false;
      }
    });
  });
}
// The rows of a list whose range is not whole statements, by id.
function partialRows(rows, src = readSource) {
  const at = resolveAnchors(rows, STORE_HALF, src);
  const mine = rows.filter((r) => at.has(r.id) && !r.whole && !r.prose);
  const py = mine.filter((r) => r.file.endsWith('.py'));
  const js = mine.filter((r) => !r.file.endsWith('.py'));
  const files = Object.fromEntries([...new Set(py.map((r) => r.file))].map((f) => [f, src(f)]));
  const okPy = pyRangesWhole(
    py.map((r) => [r.file, at.get(r.id).line, at.get(r.id).endLine]),
    files
  );
  const okJs = jsWholeRun(js.map((r) => at.get(r.id).text));
  return [...py.filter((_, i) => !okPy[i]), ...js.filter((_, i) => !okJs[i])].map((r) => r.id);
}

test('anchors: a cited row with ends runs through whole statements, from the start of one', () => {
  // BB8 6701778607, his D4: the line `ends` names is a floor. The range runs
  // on through the statement that line is in, and through every statement
  // the range starts (a compound one with its body), so no cited range stops
  // partway; each is checked by the language's own parser.
  const rows = [...ANCHORS.filter((r) => r.cite), ...CONTRACT_CITES];
  assert.deepEqual(partialRows(rows), [], 'every cited range is whole statements');
  // His rows, each of which stopped mid-statement: each now runs on to the
  // statement's end, so the line after the old end is inside it.
  const ends = new Map([
    ['c.analysis._sound_result.1', 'availability="available" if counts["coverage"] == "answered"'],
    ['c.analysis._resource_guard', '"No source or comparison was dropped'],
    ['c.analysis._domain', 'if n % 4096 == 4095:'],
    ['c.analysis.step.1', 'raise ValueError("INVARIANT_FAILURE'],
    ['c.relations.search_stub_resolution.2', 'return bool(_i is not None'],
    ['c.reader_scheduler.pump.3', 'console.error('],
    ['sched.pump.run_reader_lease', 'timeoutMs: this.leaseMs + 5000'],
    ['c.reader_job_store.cancel', ": 'Cancelled; committed evidence is retained.'"],
  ]);
  for (const [id, inside] of ends) {
    const row = [...ANCHORS, ...CONTRACT_CITES].find((r) => r.id === id);
    assert.ok(row, id);
    assert.ok(
      resolveAnchor(readSource(row.file), row).text.includes(inside),
      `${id} holds ${inside}`
    );
  }
  // A range cut off inside a statement, or one whose statement runs past
  // it, fails the check in both languages.
  const cut = [
    [
      'lyric-harness/library/analysis.py',
      'def f(x):\n    y = g(x,\n          1)\n    return y\n',
      2,
      2,
    ],
    [
      'lyric-harness/library/analysis.py',
      'def f(x):\n    for a in x:\n        b(a)\n        c(a)\n',
      2,
      3,
    ],
  ];
  assert.deepEqual(
    pyRangesWhole(
      cut.map(([f, , s, e], i) => [`${f}#${i}`, s, e]),
      Object.fromEntries(cut.map(([f, t], i) => [`${f}#${i}`, t]))
    ),
    [false, false]
  );
  assert.deepEqual(jsWholeRun(['if (\n  a &&', 'x = f(a,', 'for (const a of b) {\n  c(a);']), [
    false,
    false,
    false,
  ]);
  assert.deepEqual(jsWholeRun(['} catch (e) {\n  f(e);\n}', 'a: 1,\nb: 2,', 'x();\ny();']), [
    true,
    true,
    true,
  ]);
});

test('anchors: a call is not a definition, and a changed statement, rename, second definition or duplicate fails', () => {
  const routes = readSource('mcp/reader_routes.js');
  const row = ANCHOR.get('routes.validate.object_refusal');
  // A call statement at the start of a line elsewhere still resolves.
  assert.ok(resolveAnchor(`validateRequest(x);\n${routes}`, row));
  assert.ok(resolveAnchor(`${routes}\nvalidateRequest(x);\n`, row));
  // A second definition fails, with the row's id.
  assert.throws(
    () => resolveAnchor(`${routes}\nfunction validateRequest(x) {\n  return x;\n}\n`, row),
    /routes\.validate\.object_refusal: a second definition of validateRequest/
  );
  // So does one in Python.
  const worker = readSource('mcp/worker.py');
  const py = ANCHOR.get('worker.read_page_object.decode');
  assert.throws(
    () => resolveAnchor(`${worker}\ndef read_page_object(p):\n    return p\n`, py),
    /a second definition of read_page_object/
  );
  // A changed pinned statement fails.
  assert.throws(
    () => resolveAnchor(routes.replace('must be a JSON object.', 'must be an object.'), row),
    /no line in validateRequest/
  );
  // A renamed symbol fails.
  assert.throws(
    () => resolveAnchor(routes.replaceAll('validateRequest', 'checkRequest'), row),
    /no definition of validateRequest/
  );
  // A duplicated anchor line inside the span, with no nth, fails as ambiguous.
  const { line } = resolveAnchor(routes, row);
  const dup = insertAbove(routes, line, routes.split('\n')[line - 1]);
  assert.throws(() => resolveAnchor(dup, row), /2 lines in validateRequest/);
  // The same anchor text outside the span is not a duplicate.
  assert.ok(resolveAnchor(`${routes}\n${routes.split('\n')[line - 1]}\n`, row));
  // A Python span is not ended by a column-0 comment or a docstring inside it.
  const r = ANCHOR.get('worker.read_page_object.decode');
  const { line: dl } = resolveAnchor(worker, r);
  const doc = insertAbove(worker, dl, '    """\nnot code\n    """');
  assert.equal(resolveAnchor(doc, r).line, dl + 3);
  // Every file the anchors name is read; none is missing.
  for (const f of ANCHOR_FILES) assert.ok(fs.existsSync(path.join(ROOT, f)), f);
});

test('anchors: each STORE_HALF key, flipped against the unchanged code, fails', () => {
  const st = load(CODEC).admission.stored_request;
  const flip = (k) => ({ ...STORE_HALF, [k]: !STORE_HALF[k] });
  assert.throws(() => check211(flip('admission'), readSource, s211raw()));
  assert.throws(() => checkStoredRequest(st, flip('admission'), readSource));
  assert.throws(() => checkFatalDecode(flip('fatal_decode'), readSource));
  // The gated row, false, against the code: Step 3 added the statement it
  // names, so it resolves, and a false key says it must not.
  assert.throws(
    () => resolveAnchors([ANCHOR.get('sched.pump.stored_check')], flip('admission'), readSource),
    /sched\.pump\.stored_check must not resolve while STORE_HALF\.admission is false/
  );
  // And each branch accepts the code its key describes: the false branch, the
  // code with both checks taken out (Base's), and the true branch refuses it.
  const sched = readSource('mcp/reader_scheduler.js');
  const check = resolveAnchor(sched, ANCHOR.get('sched.pump.stored_check'));
  const lines = sched.split('\n');
  let first = check.line - 1;
  while (lines[first - 1].trim().startsWith('//')) first--;
  lines.splice(first - 1, check.endLine - first + 1);
  const unchecked = lines.join('\n');
  const refusal = /\n {2}\/\/ Caller text reaches the worker[^]*?well-formed Unicode\.'\n {4}\);\n/;
  const routesNow = readSource('mcp/reader_routes.js');
  assert.match(routesNow, refusal);
  const routes = routesNow.replace(refusal, '\n');
  const based = (f) =>
    f === 'mcp/reader_scheduler.js'
      ? unchecked
      : f === 'mcp/reader_routes.js'
        ? routes
        : readSource(f);
  check211(flip('admission'), based, s211raw());
  checkStoredRequest(st, flip('admission'), based);
  assert.throws(() => check211(STORE_HALF, based, s211raw()), /stored_check: no line in pump/);
  // Step 5 added the segment reader and flipped STORE_HALF.fatal_decode in
  // one commit. The false branch accepts the store with the three helpers
  // taken out (Base's: no fatal decoder, no _segment), and the true branch
  // refuses that store.
  const storeNow = readSource('mcp/reader_job_store.js');
  const helpers =
    /\n {2}\/\/ A segment's bytes are decoded fatally[^]*?(?=\n {2}_object\(kind, hash\) \{)/;
  assert.match(storeNow, helpers);
  const baseStore = storeNow.replace(helpers, '');
  assert.ok(
    !/_segmentText|_segmentJSON|_segment\(hash/.test(baseStore.replace(/this\._segment\(/g, ''))
  );
  const undecoded = (f) => (f === 'mcp/reader_job_store.js' ? baseStore : readSource(f));
  checkFatalDecode(flip('fatal_decode'), undecoded);
  assert.throws(() => checkFatalDecode(STORE_HALF, undecoded), /no definition of _segmentText/);
  const segmentRows = ANCHORS.filter((r) => r.when === 'fatal_decode');
  assert.ok(segmentRows.length >= 2 && segmentRows.some((r) => r.cite));
  resolveAnchors(segmentRows, flip('fatal_decode'), undecoded);
  assert.throws(
    () => resolveAnchors(segmentRows, STORE_HALF, undecoded),
    /no definition of _segment/
  );
  assert.throws(
    () => resolveAnchors(segmentRows, flip('fatal_decode'), readSource),
    /must not resolve while STORE_HALF\.fatal_decode is false/
  );
  // _segment parsing on its own, around the strict helper, fails.
  const parsing = (f) =>
    f === 'mcp/reader_job_store.js'
      ? storeNow.replace(
          'segment = this._segmentJSON(bytes);',
          'segment = JSON.parse(bytes.toString());'
        )
      : readSource(f);
  assert.throws(() => checkFatalDecode(STORE_HALF, parsing), /parses nothing itself/);
  // And a helper that decodes by replacement, or parses the buffer, fails.
  const replacing = (f) =>
    f === 'mcp/reader_job_store.js'
      ? storeNow.replace(
          "return new TextDecoder('utf-8', { fatal: true }).decode(buf);",
          "return buf.toString('utf8');"
        )
      : readSource(f);
  assert.throws(() => checkFatalDecode(STORE_HALF, replacing));
  const bufferParse = (f) =>
    f === 'mcp/reader_job_store.js'
      ? storeNow.replace('return JSON.parse(this._segmentText(buf));', 'return JSON.parse(buf);')
      : readSource(f);
  assert.throws(() => checkFatalDecode(STORE_HALF, bufferParse));
});

// The mutants the review of the Step 0 re-anchor ran (#656): each
// changes code a §2.11 claim or §2.1's depth basis rests on, most keeping
// the line count, and each must fail. In memory, as the anchor mutants are.
// An optional fifth element is the failure message it must give.
const REVIEW_MUTANTS = [
  [
    'X01',
    'mcp/server_http.js',
    '    limit: HTTP_REQUEST_BYTES,\n',
    "    limit: HTTP_REQUEST_BYTES, reviver: (k, v) => (typeof v === 'string' ? v.toWellFormed() : v),\n",
  ],
  [
    'X02',
    'lyric-harness/library/analysis.py',
    '        return [_public_declarations(v) for v in value]\n    return value\n',
    "        return [_public_declarations(v) for v in value]\n    return value.encode('utf-8', 'replace').decode() if isinstance(value, str) else value\n",
  ],
  [
    'X03',
    'lyric-harness/library/analysis.py',
    '                cells.append(cell)\n',
    '                cells.append([cell])\n',
  ],
  [
    'X04',
    'mcp/reader_routes.js',
    '    request: prepared,\n',
    '    request: { ...prepared, declaration_set: {} },\n',
  ],
  [
    'X05',
    'mcp/reader_scheduler.js',
    '    const declarations = request.declaration_set;\n',
    '    const declarations = request.declaration_set && {};\n',
  ],
  [
    'X06',
    'mcp/reader_scheduler.js',
    '  if (!expected || sha256(bytes) !== expected)\n',
    '  if (!expected)\n',
  ],
  [
    'X07',
    'mcp/reader_job_store.js',
    '        maxOutputLength: READER_LIMITS.objectBytes,\n',
    '        maxOutputLength: 2 * READER_LIMITS.objectBytes,\n',
  ],
  [
    'X08',
    'mcp/reader_job_store.js',
    '    if (fs.statSync(file).size > READER_LIMITS.objectBytes)\n',
    '    if (false)\n',
  ],
  [
    'X09',
    'mcp/reader_job_store.js',
    '    bytes = decodeStoredObject(bytes);\n    if (sha(bytes) !== hash)\n',
    '    bytes = decodeStoredObject(bytes);\n    if (false)\n',
  ],
  [
    'X10',
    'mcp/reader_scheduler.js',
    "          code: failure.code || 'INTERRUPTED',\n",
    "          code: 'INTERRUPTED',\n",
  ],
  [
    'X11',
    'mcp/reader_scheduler.js',
    '          message: failure.message,\n          requeue: false,\n',
    '          message: failure.message,\n          requeue: true,\n',
  ],
  [
    'X12',
    'mcp/reader_job_store.js',
    "    const intent = jsonValue(request, 'Reader request');\n",
    "    const intent = jsonValue({}, 'Reader request');\n",
  ],
  [
    'X13',
    'mcp/reader_job_store.js',
    "          fence: crypto.randomBytes(32).toString('hex'),\n",
    '          fence: record.fence,\n',
  ],
  [
    'X14',
    'mcp/reader_scheduler.js',
    '      record = this.store.lease();\n',
    "      record = this.store.lease();\n      if (record && !isWellFormedRequest(record.request)) throw error('INVALID_DECLARATION', 'x');\n",
    /pump has one Unicode check/,
  ],
  [
    'X14b',
    'mcp/reader_scheduler.js',
    '    let lastStep;\n    try {\n',
    '    let lastStep;\n    if (!wellFormedDeep(record.request)) return;\n    try {\n',
    /stored_check: 2 lines in pump/,
  ],
  [
    'X14c',
    'mcp/reader_scheduler.js',
    '    let lastStep;\n    try {\n',
    '    let lastStep;\n    try {\n      await Promise.resolve();\n',
    /the stored check opens the try/,
  ],
  [
    'X15',
    'mcp/reader_job_store.js',
    '    return JSON.parse(bytes);\n  }\n  _require(id) {',
    "    return JSON.parse(new TextDecoder('utf-8', {fatal:true}).decode(bytes));\n  }\n  _require(id) {",
  ],
  [
    'X16',
    'lyric-harness/library/analysis.py',
    '            seen.add(key)\n            yield "alt_edge", (x, y, alt)\n',
    '            seen.add((key,))\n            yield "alt_edge", (x, y, alt)\n',
  ],
  [
    'X17',
    'lyric-harness/library/analysis.py',
    '                                 for m in (a, b)]\n',
    '                                 for m in (a, b)]; cells = [[c] for c in cells]\n',
  ],
  [
    'X18',
    'mcp/python_bridge.js',
    '        } catch (error) {\n          kill(error);\n          return;\n',
    '        } catch (error) {\n          return;\n          kill(error);\n',
  ],
  [
    'X19',
    'mcp/reader_routes.js',
    '      Array.isArray(input.declaration_set))\n',
    '      false)\n',
  ],
  [
    'Y1',
    'mcp/reader_job_store.js',
    "    if (fs.statSync(file).size > READER_LIMITS.objectBytes)\n      throw problem('STORAGE_CORRUPT', 'Stored reader object exceeds its bounded format.', 503);\n",
    '',
  ],
  [
    'Y2',
    'mcp/reader_scheduler.js',
    "      try {\n        this.store.pause(record.id, record.attempt, record.fence, {\n          code: failure.code || 'INTERRUPTED',\n          message: failure.message,\n          requeue: false,\n          ...fields,\n        });\n        recorded = true;\n      } catch (stale) {",
    '      try {\n        void failure;\n        recorded = true;\n      } catch (stale) {',
  ],
  [
    'Z1',
    'mcp/reader_routes.js',
    "    throw fail('INVALID_DECLARATION', 'The declaration set must be a JSON object.');\n",
    "    throw fail('INVALID_DECLARATION', 'The declaration set must be a JSON object.');\n  if (input.declaration_set && !wellFormedDeep(input.declaration_set)) throw fail('INVALID_DECLARATION', 'The declaration set contains text that is not well-formed Unicode.');\n",
  ],
  // BB8 6701778607, items 1-3: each passed the validator at c20feb79f.
  // (1) A multi-line call pinned by its first line only.
  [
    'B1',
    'mcp/worker.py',
    '                              identity=payload.get("identity"),\n',
    '                              identity=None,\n',
    /worker\.run_reader\.session/,
  ],
  // (2) A closed comment, then code, on one line: lease() made a no-op.
  [
    'B2',
    'mcp/reader_job_store.js',
    '  lease(id = null) {\n    return this._open(() => {\n',
    '  lease(id = null) {\n    return this._open(() => {\n      /* noop */ return null;\n',
    /store\.lease/,
  ],
  // (2) The same in Python: a closed triple-quoted string, then a statement.
  [
    'B2py',
    'lyric-harness/library/analysis.py',
    'def _public_declarations(value):\n',
    'def _public_declarations(value):\n    """x"""; return {}\n',
    /analysis\.public_declarations/,
  ],
  // (3) A helper a pinned depth statement calls, deepened: every span key
  // gains two arrays.
  [
    'B3',
    'lyric-harness/library/analysis.py',
    '            return f"{head}@{self._cell(st.units[int(unit)])}"\n',
    '            return (head, (self._cell(st.units[int(unit)]),))\n',
    /analysis\.origin\.cell: no line in _origin/,
  ],
  // (3) A new helper call in a depth symbol, in a statement DEPTH_WATCH does
  // not select: the binding alt_cells copies, reshaped by an unlisted helper.
  [
    'B3b',
    'lyric-harness/library/analysis.py',
    '            binding = next(self._generator)\n',
    '            binding = self._rebind(next(self._generator))\n',
    /_prepare_event calls self\._rebind, which is neither a depth symbol nor a listed helper/,
  ],
  // BB8's review of 3f4b74c40, D1-D6: each passed the validator there.
  // (D1) An f-string "docstring" runs its expression; so does one in a depth
  // symbol, and one hiding a helper call; and a string inside brackets is
  // implicit concatenation.
  [
    'D1a',
    'lyric-harness/library/analysis.py',
    'def _public_declarations(value):\n',
    'def _public_declarations(value):\n    f"""{value.pop(\'source\', None) if isinstance(value, dict) else \'\'}"""\n',
    /analysis\.public_declarations/,
  ],
  [
    'D1b',
    'lyric-harness/library/analysis.py',
    '        cells = []\n        for i in span.idx:\n',
    '        cells = []\n        f"""{cells.append(((None,),))}"""\n        for i in span.idx:\n',
    /every statement in _span_key that builds or reshapes an entry is a depth anchor/,
  ],
  [
    'D1c',
    'lyric-harness/library/analysis.py',
    '            binding = next(self._generator)\n',
    '            binding = next(self._generator)\n            f"""{self._rebind(binding)}"""\n',
    /_prepare_event calls self\._rebind, which is neither a depth symbol nor a listed helper/,
  ],
  [
    'D1d',
    'lyric-harness/library/analysis.py',
    '        raise ValueError(f"RESOURCE_LIMIT: {phase} requires more resident capacity; "\n',
    '        raise ValueError(f"RESOURCE_LIMIT: {phase} requires more resident capacity; "\n                         """some sources were dropped; """\n',
    /c\.analysis\._resource_guard/,
  ],
  // (D2) A statement moved into or out of a block.
  [
    'D2a',
    'lyric-harness/library/analysis.py',
    '        return [_public_declarations(v) for v in value]\n    return value\n',
    '        return [_public_declarations(v) for v in value]\n        return value\n',
    /analysis\.public_declarations/,
  ],
  [
    'D2b',
    'lyric-harness/library/analysis.py',
    '                cells.append(cell)\n        return (self._origin(span, st), span.direction, tuple(cells))\n',
    '                cells.append(cell)\n            return (self._origin(span, st), span.direction, tuple(cells))\n',
    /a depth symbol changed: read §2\.1's basis again, then pin \{"_span_key"/,
  ],
  // (D3) A decorator above a definition cited whole.
  [
    'D3',
    'lyric-harness/library/analysis.py',
    'def _public_declarations(value):\n',
    '@(lambda f: lambda value: value)\ndef _public_declarations(value):\n',
    /analysis\.public_declarations/,
  ],
  // (D4) A line past where an `ends` row used to stop, inside its statement.
  [
    'D4a',
    'lyric-harness/library/analysis.py',
    '                            availability="available" if counts["coverage"] == "answered" else "unknown_members")\n',
    '                            availability="available")\n',
    /c\.analysis\._sound_result\.1/,
  ],
  [
    'D4b',
    'lyric-harness/library/analysis.py',
    '"No source or comparison was dropped. Resume requires increased capacity.")',
    '"Some sources were dropped.")',
    /c\.analysis\._resource_guard/,
  ],
  [
    'D4c',
    'lyric-harness/library/analysis.py',
    '            if n % 4096 == 4095:\n',
    '            if False:\n',
    /c\.analysis\._domain/,
  ],
  [
    'D4d',
    'lyric-harness/library/analysis.py',
    '                raise ValueError("INVARIANT_FAILURE: detail record exceeded its fixed wire budget")\n',
    '                pass\n',
    /c\.analysis\.step\.1/,
  ],
  [
    'D4e',
    'lyric-harness/quality/relations.py',
    '            return bool(_i is not None and _i < len(status) and status[_i])\n',
    '            return False\n',
    /c\.relations\.search_stub_resolution\.2/,
  ],
  // Step 5's segment reader: the size bound dropped from the stat, the read
  // moved ahead of the stat's bound, and the read made unbounded.
  [
    'S5a',
    'mcp/reader_job_store.js',
    '    if (size > READER_LIMITS.objectBytes) return { f6: true };\n',
    '',
    /store\.segment/,
  ],
  [
    'S5b',
    'mcp/reader_job_store.js',
    '    if (size > READER_LIMITS.objectBytes) return { f6: true };\n    let bytes;\n    try {\n      bytes = this._readFile(file);\n',
    '    let bytes;\n    try {\n      bytes = this._readFile(file);\n      if (size > READER_LIMITS.objectBytes) return { f6: true };\n',
    /store\.segment/,
  ],
  [
    'S5c',
    'mcp/reader_job_store.js',
    '      bytes = this._readFile(file);\n',
    '      bytes = fs.readFileSync(file);\n',
    /store\.segment/,
  ],
  [
    'D4f',
    'mcp/reader_scheduler.js',
    "            '[reader] checkpoint recovery failed:',\n",
    "            '[reader] checkpoint recovery:',\n",
    /sched\.pump\.catch_pause/,
  ],
  [
    'D4g',
    'mcp/reader_scheduler.js',
    'timeoutMs: this.leaseMs + 5000',
    'timeoutMs: 1e9',
    /sched\.pump\.run_reader_lease/,
  ],
  [
    'D4h',
    'mcp/reader_job_store.js',
    ": 'Cancelled; committed evidence is retained.',",
    ": 'Cancelled; committed evidence is deleted.',",
    /c\.reader_job_store\.cancel/,
  ],
  // (D5) A call that is not `self.*`: a module function, and a callee read
  // by name.
  [
    'D5a',
    'lyric-harness/library/analysis.py',
    '            binding = next(self._generator)\n',
    '            binding = _rebind(next(self._generator))\n',
    /_prepare_event calls _rebind, which is neither a depth symbol, a listed helper, a listed builtin nor a listed callee/,
  ],
  [
    'D5b',
    'lyric-harness/library/analysis.py',
    '            binding = next(self._generator)\n',
    '            binding = getattr(self, "_rebind")(next(self._generator))\n',
    /_prepare_event calls (?:Call: a computed callee|getattr: a callee read by name) is refused/,
  ],
  // (D6) The two helpers whose keys are the words ta and tb, deepened.
  [
    'D6a',
    'lyric-harness/library/analysis.py',
    'sorted(t for t in self.stream.tokens',
    'sorted((t,) for t in self.stream.tokens',
    /analysis\.sound_unspanned\.return: no line in _sound_unspanned/,
  ],
  [
    'D6b',
    'lyric-harness/library/analysis.py',
    'out.setdefault(next(iter(cells)), []).append(span)',
    'out.setdefault((next(iter(cells)),), []).append(span)',
    /_sound_spans/,
  ],
];
// Every check the validator makes of the sources, at the STORE_HALF state.
function traceAll(src) {
  check211(STORE_HALF, src, s211raw());
  checkDigests(STORE_HALF, src);
  checkStoredRequest(load(CODEC).admission.stored_request, STORE_HALF, src);
  checkFatalDecode(STORE_HALF, src);
  declaredDepths(src);
  checkContractCites(src);
}

test('anchors: each review mutant of a cited symbol or a depth symbol fails', () => {
  traceAll(readSource);
  for (const [tag, file, old, now, why] of REVIEW_MUTANTS) {
    const text = readSource(file);
    assert.equal(text.split(old).length, 2, `${tag}: its text occurs once in ${file}`);
    let failed = null;
    try {
      traceAll(
        withFile(
          file,
          text.replace(old, () => now)
        )
      );
    } catch (error) {
      failed = error;
    }
    assert.ok(failed, `${tag} fails the validator`);
    // Where the row names it, the failure says which check caught it.
    if (why) assert.match(String(failed.message), why, `${tag} fails by name`);
  }
});

// Every statement this fold adds, as the contract must read once the facts
// are filled in from the fixture, the refusal tables, LIMITS and the source.
// §2.11 must be exactly its claim; each other claim must appear in its
// section. A fact changed in the text, or in the data it is read from, fails
// here; a fact changed in the data alone also fails the model tests above.
const CLAIMS = [
  {
    where: '2.11',
    whole: true,
    text: [
      "### 2.11 Codec errors and where they are mapped (BB8, #721 items 2–3) This is BB8's",
      "proposal for the #721 handoff's items 2 and 3, which R2 accepted, with BB8's review of",
      "the #721 entry codec (should-fix 1) and BB8's ruling on the worker's emit precedence",
      '(his 19:40Z DM of 2026-11-06). `good/codec_error_mapping.json` pins each byte and',
      'mapping claim below, and the validator checks it in Node and in Python and builds this',
      "section's text from it (§13). - **The principle.** The codec raises a local error with a",
      'rule tag; the enclosing operation maps it; the codec never chooses a public code. The',
      "codec is whatever decodes, checks or encodes entries: the #721 author's entry codec in",
      "the worker, and the store's entry checks (§4). Its tags: - `F1`: a value inside an entry",
      "that is outside §2.1's subset: a float (`1.0` included), a nonfinite number, an object,",
      'an integer past ±(2⁵³ − 1), a lone surrogate, a cyclic array, an array past',
      '`ENTRY_DEPTH` or a value of another type; - `F2`: an entry whose canonical form is',
      'longer than `ENTRY_BYTES`; - `JSON`: input that is not one JSON value: invalid UTF-8, a',
      'truncated value or trailing content; - `INTEGER_FIELD`: an integer-only field outside',
      "the entries that is not an integer in its range: a frame's `epoch`, a seal's `first`, a",
      "cursor number, or a segment's `epoch`, `first` or `count`. `F1` stays for integers",
      "inside entries, on the decode and the encode paths alike (BB8's review; required of the",
      'codec, §9). - **(a) The store, on a submitted frame** (§4 step 3). `F1` or `F2` on any',
      'entry in the seals, the cursor tails or the group keys is `{{A_CODE}}` ({{A_STATUS}}),',
      "and nothing is written. `INTEGER_FIELD` is the same code under the frame's own rule, not",
      "F1: {{W1}} for `epoch` and a seal's `first`, {{W4}} for a cursor number. Same code,",
      'different tag. A frame whose `discovery` is not JSON never reaches the store, because',
      "the frame is one JSON line: it is the step channel's existing failure for a malformed",
      'step, and there is no new code. The bridge parses each line',
      '(`python_bridge.js:spawnWorker`) inside the try whose catch kills the worker, a bridge',
      'failure with no reply that pauses as it does at Base (§8), and refuses a reader line',
      'past `READER_FRAME_CAP` (`:READER_FRAME_CAP`) as `{{A_CODE}}`. - **(b) The worker, on an',
      'entry it generated, before it emits.** `F2` is `{{B_F2_CODE}}`, cause `{{B_F2_CAUSE}}`,',
      'naming the log (§3, §8). `F1` (a float, a lone surrogate, an object, an integer out of',
      'range, a depth past `ENTRY_DEPTH`) is `{{B_F1_CODE}}`, an engine defect, with a message',
      'that names the rule, like the other `{{B_F1_CODE}}` messages (§3, §8). The worker never',
      'truncates or skips the entry. It refuses before it builds the frame. Without that',
      'refusal a lone surrogate would fail later, still before the write: `worker.py` builds',
      "each frame with `ensure_ascii=False` (`worker.py:run_reader`), and the size check's",
      'strict encode raises `UnicodeEncodeError` before the frame is printed, so the lease',
      'would end as `READER_ERROR` (`:main`). - **(c) A persisted segment that passed F6.**',
      'Bytes that do not parse, an entry failing F1 or F2, and a `first`, `count` or `epoch`',
      "that is not an integer are F3, not corruption (§2.5). The mapping is F3's, unchanged: a",
      "lease's walk refuses `{{C_WALK_CODE}}` ({{C_WALK_STATUS}}) and releases nothing (§5.1);",
      'a full read (reconciliation, `resume()`) releases with `{{C_FULL_CODE}}`, cause',
      "`{{C_CAUSE}}` (§5.1); the worker's load refuses with `{{C_CAUSE}}` (§5.2).",
      "`{{STORE_CAUSE}}` stays F6's alone, and the store's alone, and a failed gzip inflation",
      'and a stored size over `READER_LIMITS.objectBytes` stay F6 (§2.5). - **Invalid UTF-8 in',
      'a segment, in both languages** (BB8, 21:31Z). The',
      "worker's load decodes strictly (`worker.py:read_page_object`), so bytes that are not",
      'UTF-8 are `{{U_TAG}}`, and F3. At Base the store parses the verified bytes with',
      '`JSON.parse` on the buffer (`reader_job_store.js:_object`), which decodes invalid UTF-8',
      'as U+FFFD instead of refusing it, so the same bytes would pass or meet F5. **Required**',
      "(R2's, in the store half): the store decodes a segment's verified bytes with a fatal",
      "UTF-8 decoder (`new TextDecoder('utf-8', { fatal: true })`) before it parses them, never",
      'with `Buffer.toString` or `JSON.parse` on the buffer, which replace bytes that are not',
      'UTF-8, and a failure is F3, so both languages refuse the same bytes for the same rule: a',
      "full read releases with `{{U_FULL_CAUSE}}`, a lease's walk refuses `{{U_WALK_CODE}}`,",
      "and the worker's load refuses with `{{U_LOAD_CAUSE}}`. A failed gzip inflation comes",
      'before the decode and stays F6. Only a writer other than the store can produce such',
      "bytes. `persisted_bytes` in `good/codec_error_mapping.json` pins it: Python's load and",
      "the required store are F3 (`JSON`), and a non-fatal decode, as the store's is at Base,",
      'passes the bytes. Its `read_back` is an address-valid segment holding a string with a',
      "lone {{U_BYTE}} byte. **Required test** (R2's store tests): a full read and a lease's",
      'walk of that segment each refuse it as F3, and the same test run against a replacing',
      'decode fails, because that decode passes the content and meets {{U_REPLACING}} instead,',
      'so the test shows the store does not use one. - **The integral float `1.0`, across',
      'languages.** Take a persisted segment whose digests a Python writer computed over the',
      "bytes `1.0`. Python's load meets a float: F1, so F3, cause `{{C_CAUSE}}`. Node parses it",
      'as the integer 1, so the entry passes F1 and its recomputed digest does not match:',
      '{{X_NODE_RULE}}, cause `{{X_NODE_CAUSE}}`. The divergence is accepted: both refuse, with',
      'different causes. Each side pins its own cause in `good/codec_error_mapping.json`:',
      "`cross_language.python` for the worker's codec, `cross_language.node` for a Node reader",
      "and this validator's model of the load. Neither side's tests assert the other side's",
      "cause. On a submitted frame the same divergence is `bad/float_entry.json`'s (F1 in",
      'Python, F5 in Node), where both are `{{A_CODE}}`. - **(d) Precedence is pinned on the',
      "worker's emit path only** (BB8, 19:40Z). An entry the worker generated that breaks F1 is",
      '`{{B_F1_CODE}}` whatever else it breaks, {{P1}} included: `{{B_F1_CODE}}` reports an',
      'engine defect, and `{{B_F2_CODE}}` would blame the input and hide the defect. The',
      "worker's encoder makes two passes. The first is the F1 walk: §2.1's types with no",
      'subclasses, integers within ±(2⁵³ − 1), cycles, the depth, and lone surrogates found by',
      'a scan that encodes nothing. It serialises nothing, holds iterators rather than a stack',
      "proportional to an array's width, allocates in proportion to the depth and takes time in",
      'proportion to the nodes. Only an entry that passes it reaches the second pass, the',
      "worker's encoder at Base with its early F2 guards unchanged. `emit_precedence` in",
      "`good/codec_error_mapping.json` holds BB8's cases. - **Elsewhere precedence is not",
      'pinned.** On a submitted frame and on a persisted segment, an input that breaks more',
      "than one rule carries the tag of its first failure in §4's listed order, and within one",
      'entry whichever check the bounded scan reaches first. No test depends on which. A test',
      'of such an input asserts the code and that nothing was written; it never asserts the tag',
      'or the rule. Only a single-fault case asserts its tag. The same holds for (c): a segment',
      'with several content faults is F3, whichever comes first. - **F2 is measured on the',
      "canonical form, not on the raw input** (BB8, #721 item 3). The decoder's time and peak",
      'memory grow with the raw bytes it is given, whitespace included. F2 bounds only the',
      'canonical form: an entry passes F2 when its canonical form is at most {{ENTRY_BYTES}}',
      "bytes, however it was spaced. The raw input is bounded only by the enclosing reader's",
      'existing limit, and this contract adds no raw-input constant: - a submitted frame is one',
      'step line of at most `READER_FRAME_CAP`, {{FRAME_CAP}}, which the bridge holds each line',
      'to (`python_bridge.js:READER_FRAME_CAP`, `:spawnWorker`) and its unterminated buffer',
      'too; the worker holds its own frames to {{WORKER_FRAME}} before it writes them',
      '(`worker.py:run_reader`); - a segment the worker reads goes through the bounded page',
      'reader, `read_page_object` (`worker.py:read_page_object`): it reads at most',
      '`READER_OBJECT_BYTES`, {{OBJ}} (`:READER_OBJECT_BYTES`), and inflates at most as much,',
      "before it parses; - a segment the store reads is stat'ed first, and a stored size over",
      '`READER_LIMITS.objectBytes`, {{STORE_OBJ}} (`reader_job_store.js:READER_LIMITS`), is F6',
      'without a read (`:_segment`), and so is a stat that is not a regular file; within the',
      'bound `_readFile` reads it (`:_readFile`), its own size refusal (a file replaced after the',
      'stat) and `EISDIR` are F6 of that segment too (§2.5), and `decodeStoredObject` holds the',
      'inflated bytes to the same bound (`:decodeStoredObject`).',
      "Required acceptance tests, of the worker half's codec (the validator runs both against",
      'its own model): a valid entry whose canonical form is {{ENTRY_BYTES}} bytes, padded with',
      'whitespace to {{PADDED}}, decodes and passes F2 within those bounds, with its peak',
      'memory measured; and an entry whose canonical form is {{ENTRY_BYTES1}} bytes fails F2',
      'however it is spaced. `raw_transport` in `good/codec_error_mapping.json` builds both. -',
      '**A lone surrogate is refused where caller text is admitted.** (b) calls a lone',
      'surrogate in a generated entry an engine defect. That holds only if no caller text can',
      'carry one into the analysis, and at Base caller text can: 1. Both create paths parse the',
      'body with `express.json` (`server_http.js:module`), whose `JSON.parse` turns the escape',
      '`\\ud800` into a lone surrogate, and both call `validateRequest`',
      '(`reader_routes.js:validateRequest`): the Site bridge (`:createReaderRouter`) and',
      '`/library/v1` (`library_viewer_routes.js:libraryViewerRouter`). At Base it holds',
      '`declaration_set` only to being an object (`reader_routes.js:validateRequest`). The',
      'three bindings are ASCII by `validBinding` (`:validBinding`), and the layers and methods',
      'are a closed set or ASCII by `validBinding`. `idempotency_key` is on the allow-list and',
      'nothing in `validateRequest` checks it; `/library/v1` holds it only to a string of at',
      'most 200 characters (`library_viewer_routes.js:libraryViewerRouter`), and the store',
      'keeps it with the request (`reader_job_store.js:create`). It never reaches the worker:',
      'the lease payload carries the declarations, the layers and the methods, not the key',
      '(`reader_scheduler.js:pump`), and the identity holds only hashes of the request',
      '(`:resolveIdentity`). 2. `createAnalysisJob` (`reader_routes.js:createAnalysisJob`)',
      'stores the request as it is: `prepareRequest` (`reader_scheduler.js:prepareRequest`)',
      "keeps a caller's declaration set, and only adds a collection's default pronunciations to",
      'a set that has none. 3. Each lease passes `record.request.declaration_set` to the worker',
      '(`reader_scheduler.js:pump`). The bridge writes it with `JSON.stringify`',
      '(`python_bridge.js:warm`), which writes a lone surrogate as the escape `\\ud800`, and',
      '`worker.py` reads it with `json.loads` (`worker.py:main`), which makes it a lone',
      "surrogate again. `worker.py` replaces lone surrogates only in a lyrics request's `argv`",
      '(`:_LONE_SURROGATE`, `:main`); the reader family hands `declarations` to',
      '`AnalysisSession` as they are (`:run_reader`). 4. In the analysis,',
      '`_public_declarations` (`analysis.py:_public_declarations`) redacts only `source`,',
      '`provenance` and `citation`, and no check on the way holds a string to well-formed',
      "Unicode: a pronunciation's `line` is held to 4,000 characters",
      '(`quality/pronunciation.py:validate_choices`) and refused later only because no',
      'registered line matches it (`analysis.py:AnalysisSession.__init__`). The registered',
      'reading is not caller text: it comes from the approved snapshot, checked against its',
      'pinned hash (`reader_scheduler.js:verifyReading`, read off the event loop by',
      "`reader_source_worker.js:module`). **Required** (R2's, in the store half's runtime",
      "train, which is the worker half's, §9): `validateRequest` refuses a request whose",
      '`declaration_set` holds a string or a key, at any depth, that is not well-formed Unicode',
      '(`String.prototype.isWellFormed`), as `{{ADM_CODE}}` ({{ADM_STATUS}}),',
      '"{{ADM_MESSAGE}}", in the style of its other declaration refusal',
      '(`reader_routes.js:validateRequest`). It runs before the store creates a job, so no',
      'lease is ever offered. Because the job identity does not always change between images',
      '(§9), the scheduler holds a stored request to the same check before `workerPayload`',
      '(`reader_scheduler.js:pump`) and pauses a job that fails it with that code, so a job',
      'admitted by an image without the check never reaches the worker either. **Guard test**',
      "(BB8's; R2's store and route tests): a create whose declaration set holds a",
      'lone-surrogate pronunciation `line` (`"{{ADM_LINE}}"`, sent as the JSON escape), and one',
      'whose declaration key holds one, are each refused `{{ADM_CODE}}` ({{ADM_STATUS}}) on',
      'both create paths, {{ADM_PATHS}}, before any lease: no job record is written and the',
      "bridge's `runReaderLease` is never called. The same text with a well-formed pair",
      "(`{{ADM_PAIR}}`) is admitted. **Stored-request case** (BB8's, 21:31Z; R2's scheduler",
      'test): a job record written before the check, whose stored declaration set holds the',
      'same lone-surrogate `line`, is leased by the store first (`this.store.lease()`,',
      '`{{ADM_LEASED_AT}}`, saves it `running` with a lease, `{{ADM_STORE_LEASE}}`). It is then',
      'refused at the check before `workerPayload` (`{{ADM_STORED_AT}}`) with `{{ADM_CODE}}`,',
      "and the scheduler's catch pauses it with that code (`:{{ADM_PAUSED_AT}}`), which ends",
      "the store's lease. The bridge lease is never taken: `runReaderLease` is never called,",
      'and the worker never sees the request. `admission.stored_request` in',
      "`good/codec_error_mapping.json` is that record's request. The check stays there, not in",
      '`this.store.lease()` (BB8 6699352254, ruling 2): "refused before hand-out" means before',
      'the worker, and a refusal inside `lease()` would add a queued → paused transition with',
      'no fence, a new state edge for a case that exists only for records written before the',
      "check. **A deliberate change** (BB8's ruling): a keyed replay of a body an older image",
      'admitted, whose declaration set holds a lone surrogate, got 200 with the job that create',
      'made, and now gets `{{ADM_CODE}}` ({{ADM_STATUS}}) on both create paths, because the check',
      "runs before either path looks up the key's job. For a job still queued the two agree: when",
      'next leased, it pauses at the stored-request check with the same code. A job no longer',
      'queued (paused, completed, failed or cancelled) is not leased by a replay, so nothing',
      'pauses: the replay gets the same {{ADM_STATUS}} and the job itself is not touched.',
    ],
  },
  {
    where: '0',
    whole: false,
    text: [
      "It folds BB8's proposal for the #721 handoff's items 2 and 3, which R2 accepted, BB8's",
      "review of the #721 entry codec (should-fix 1), and BB8's emit-precedence ruling: the",
      "codec raises a tagged local error and the enclosing operation maps it; a worker's F1 is",
      '`{{B_F1_CODE}}`; persisted content is F3, and the store decodes it strictly; precedence',
      "is pinned F1 before F2 on the worker's emit and unpinned elsewhere; F2 is measured on",
      'the canonical form; integer-only fields get their own tag; and a lone surrogate is',
      'refused where caller text is admitted (§2.5, §2.11, §3, §4, §5, §8, §9, §12, §13).',
    ],
  },
  {
    where: '2',
    whole: false,
    text: [
      '- **F3 holds the content too** (BB8, #721 item 2 (c)): every entry passes F1 and F2, and',
      'every integer field is an integer. So a segment whose bytes match its address (F6',
      'passed) but do not parse (invalid UTF-8 included, which the store decodes strictly,',
      '§2.11), hold an entry that fails F1 or F2, or hold a `first`, `count` or `epoch` that is',
      "not an integer fails F3: bad content, not corruption. F3's mapping does not change: on a",
      "lease's walk `{{C_WALK_CODE}}` with nothing released (§5.1), at a full read",
      '(reconciliation, `resume()`) `{{C_FULL_CODE}}`, cause `{{C_CAUSE}}` (§5.1), and at the',
      "worker's load `{{C_CAUSE}}` (§5.2). `{{STORE_CAUSE}}` stays F6's alone, and the store's",
      'alone; a failed gzip inflation stays F6 (§2.11).',
    ],
  },
  {
    where: '3',
    whole: false,
    text: [
      '| `ENTRY_BYTES` | {{ENTRY_BYTES_RAW}} per entry, measured on the canonical form, not the',
      'raw input (§2.11) | `{{B_F2_CODE}}` (cause `{{B_F2_CAUSE}}`); an entry it generated that',
      'breaks F1 is `{{B_F1_CODE}}` (§2.11) | `{{A_CODE}}` (F2) |',
    ],
  },
  {
    where: '3',
    whole: false,
    text: [
      'An entry the worker generates that breaks F1 takes it too (§2.11; BB8, #721 item 2 (b)).',
      "That is BB8's classification: the engine builds the entries, and the caller text known",
      "to reach the analysis, a declaration's strings, is held to well-formed Unicode at",
      'admission (§2.11). That no caller number reaches an entry is not traced here:',
      '`declaration_set` admits any finite JSON number (`reader_job_store.js:jsonValue`), and the',
      '#721 author shows it from the declared entry shapes (§9). None of the five names a cause',
      "(§8), and each one's message names the bound it passed, with the bound's value and the",
      'size found, or the rule it broke, so an engine-defect report says which invariant broke',
      '(BB8 6688972927):',
    ],
  },
  {
    where: '3',
    whole: false,
    text: [
      '- `INVARIANT_FAILURE: a generated entry of <log> breaks F1: <what>`, where `<log>` is',
      'the log the entry was for and `<what>` is `a float`, `a nonfinite number`, `an object`,',
      '`an integer past 2⁵³ − 1`, `a lone surrogate`, `a cyclic array`, `{{DEPTH_WHAT}}` or `a',
      'value of another type`.',
    ],
  },
  {
    where: '4',
    whole: false,
    text: [
      '- **F1, F2** on every entry in the seals, in the cursor tails and in the group keys,',
      "F1's depth bound included (§2.1). They hold entries only: a frame field that must be an",
      'integer and is not is W1 (`epoch`,',
      "a seal's `first`), and a cursor number W4 (§2.11).",
    ],
  },
  {
    where: '5',
    whole: false,
    text: [
      'and its content (§2.5): every entry passes F1 and F2, and every integer field is an',
      'integer.',
    ],
  },
  {
    where: '5',
    whole: false,
    text: [
      'Bytes that match the address but do not parse (`JSON.parse`, `:_object`), or are not UTF-8',
      'under the required fatal decode (§2.11), are F3, so `{{C_CAUSE}}` (§2.5); any other',
      'error keeps its own code.',
    ],
  },
  {
    where: '5',
    whole: false,
    text: [
      '- **F3 and R2** as in §5.1, with cause `{{C_CAUSE}}`. F3 includes the content (§2.5):',
      'bytes that do not parse (`json.loads`, `worker.py:read_page_object`), an entry the codec refuses as',
      'F1 or F2, and a `first`, `count` or `epoch` that is not an integer are `{{C_CAUSE}}`,',
      'never `{{C_WALK_CODE}}`. A failed inflation in the page reader (`:read_page_object`) stays F6',
      '(§2.11).',
    ],
  },
  {
    where: '8',
    whole: false,
    text: [
      '| `{{B_F1_CODE}}` | — (the job pauses) | worker | `CURSOR_BYTES`, `CONTINUATION_BYTES`,',
      '`REFUSAL_BYTES` or `WITNESS_FIELDS` passed, or an entry the worker generated breaks F1',
      '(a float, a lone surrogate, an object, an integer out of range or a depth past',
      '`ENTRY_DEPTH`; §2.11): an engine',
      'defect, naming no cause, never a truncation or a skip; its message names the bound and',
      'its value, such as `REFUSAL_BYTES (543)`, or the rule, `breaks F1: <what>` (§3, §3.1,',
      '§3.2) |',
    ],
  },
  {
    where: '9',
    whole: false,
    text: [
      "- **The entry codec (the #721 author's; BB8's review, should-fix 1; BB8's emit ruling,",
      '19:40Z).** The codec raises a local error with a rule tag and never a public code; the',
      'enclosing operation maps it (§2.11). Before the worker half enters a train, the #721',
      "author changes the handoff's codec so that: - `require_integer` raises `EntryError` with",
      "`rule == 'INTEGER_FIELD'` for an integer-only field outside the entries, never `'F1'`.",
      "The entry paths (`decode_entry`, `canonical_bytes`) keep `'F1'` for an integer inside an",
      "entry, so they hold an entry's integers to their own F1 range check, not to",
      '`require_integer`. Required test: `require_integer(1.5)`, `require_integer(True)`,',
      '`require_integer(2 ** 53)` and `require_integer(-1, nonnegative=True)` each raise with',
      "`rule == 'INTEGER_FIELD'`; `decode_entry('[9007199254740992]')`, `canonical_bytes([2 **",
      "53])` and `canonical_bytes([-(2 ** 53)])` each still raise with `rule == 'F1'`; -",
      "`canonical_bytes` makes §2.11 (d)'s two passes, F1 before F2. Required test:",
      "`canonical_bytes('\\ud800' + 'x' * 5000)`, `canonical_bytes(['x' * 5000, 1.5])` and",
      "`canonical_bytes([0] * 100000 + [1.5])` each raise with `rule == 'F1'`, the last with a",
      "traced peak under {{PEAK}} bytes (the codec's early-encoder threshold), its input built",
      "before tracing; and `canonical_bytes(['x' * 5000])` raises with `rule == 'F2'`;",
    ],
  },
  {
    where: '9',
    whole: false,
    text: [
      "- the codec's tests pin every `single_fault` case of `good/codec_error_mapping.json` to",
      'its tag and its `what`, its `cross_language.python` cause, its `persisted_bytes` case,',
      'and both `raw_transport` tests, peak memory measured; its multi-fault decode tests',
      'assert the code and that nothing is written, never the tag, and on the emit path the',
      'code is `{{B_F1_CODE}}` (§2.11 (d)); - the worker maps the tags as §2.11 (b) and (c)',
      'give: F2 on a generated entry is `{{B_F2_CODE}}` (`{{B_F2_CAUSE}}`), F1 is',
      "`{{B_F1_CODE}}` with §3's message, and any tag on a loaded segment is F3, `{{C_CAUSE}}`;",
      "- the #721 author declares each log's entry shape and its largest depth (BB8 6693502369,",
      'item 31): `ENTRY_DEPTH` is derived from that declaration (§2.1) and `MEMBERSHIP_BYTES`',
      'from the 17 shapes capped at it (§6.11). Both are provisional until it exists,',
      '`ENTRY_DEPTH = {{ED}}` and `MEMBERSHIP_BYTES = {{MB}}`, and a declared depth of',
      "{{DECL_NEXT}} or more re-derives both before the worker half joins a release train; - the declared entry shapes show that no caller number reaches an entry, which §3's",
      'classification of a generated F1 as an engine defect assumes and this contract has not',
      'traced (`declaration_set` admits any finite JSON number, `reader_job_store.js:jsonValue`).',
    ],
  },
  {
    where: '9',
    whole: false,
    text: [
      "- **The store's segment decode (R2).** The store decodes a segment's verified bytes with",
      'a fatal UTF-8 decoder before it parses them, so invalid UTF-8 is F3 in Node as in Python',
      "(§2.11), in the store half's runtime train. It never decodes them with `Buffer.toString`",
      "or `JSON.parse` on the buffer, and its tests include §2.11's read-back of a lone {{U_BYTE}}",
      'byte, which a replacing decode',
      'fails (BB8, 21:31Z).',
    ],
  },
  {
    where: '9',
    whole: false,
    text: [
      "- **Admission refuses a lone surrogate (R2).** `validateRequest` and the scheduler's",
      'check before `workerPayload` refuse a declaration set holding text that is not',
      "well-formed Unicode, as `{{ADM_CODE}}` ({{ADM_STATUS}}), in the store half's runtime",
      "train, which carries the worker half (§2.11). BB8's guard test and his stored-request",
      "case (21:31Z) are R2's.",
    ],
  },
  {
    where: '11',
    whole: false,
    text: [
      "| 47 | BB8, #721 items 2–3 (accepted by R2); BB8's #721 codec review, should-fix 1;",
      "BB8's emit-precedence ruling (19:40Z) | the codec raises a local error with a rule tag",
      "and the enclosing operation maps it, never the codec; (a) a submitted frame's F1 or F2",
      'is `{{A_CODE}}`, its integer fields W1 and W4, and a frame that is not JSON is the step',
      "channel's failure; (b) a generated entry's F2 is `{{B_F2_CODE}}` (`{{B_F2_CAUSE}}`) and",
      "its F1 `{{B_F1_CODE}}`, its message naming the rule; (c) a persisted segment's bad",
      "content is F3, `{{STORE_CAUSE}}` stays F6's and the store's, a failed inflation F6; the",
      '`1.0` divergence, one pin per side; invalid UTF-8 in a segment F3 in both languages;',
      "precedence F1 before F2 on the worker's emit, unpinned elsewhere; F2 on the canonical",
      'form, the raw input bounded by the enclosing reader; `INTEGER_FIELD`; a lone surrogate',
      'refused at admission, before any lease | §2.5, §2.11, §3, §4, §5.1, §5.2, §8, §9, §13 |',
      '`good/codec_error_mapping.json`, `bad/float_entry.json`; the §2.11 tests |',
    ],
  },
  {
    where: '13',
    whole: false,
    text: [
      "- `good/codec_error_mapping.json`: the codec's tags and where each is mapped (§2.11):",
      'single-fault entries with their tag and `what` in Python and their tag in Node, controls',
      'at the bounds, the integer-only fields and the rule each maps to, multi-fault inputs',
      "that pin only the code, the worker's emit precedence (F1 before F2) with BB8's cases,",
      'the `1.0` divergence with one pin per side, invalid UTF-8 in a segment, F3 in both',
      'languages once the store decodes strictly, with its address-valid read-back of a lone',
      "{{U_BYTE}} byte, the codec requirement's calls (§9), the admission guard's cases and its",
      'stored-request case, and the raw-transport pair: a whitespace-padded entry of 4,096',
      'canonical bytes that passes and one of 4,097 that fails F2 however it is spaced.',
    ],
  },
  {
    where: '13',
    whole: false,
    text: [
      'refuse each bad one with the same rule, code, status and cause, but for',
      '`bad/float_entry.json`, whose `1.0` each operation refuses by its own rule (§2.11): the',
      "worker's emit refuses it as `{{B_F1_CODE}}` (F1), the worker's load of a segment holding",
      "it as F3, `{{C_CAUSE}}`, and the store's check of a frame holding it as F5,",
      '`{{A_CODE}}`, because Node parses `1.0` as the integer 1.',
    ],
  },
  {
    where: '13',
    whole: false,
    text: [
      "`good/codec_error_mapping.json` is the codec's statement (§2.11, §9): its tests pin each",
      "`single_fault` case's `tag` and `what`, the `cross_language.python` cause, the",
      '`persisted_bytes` case, every `codec_requirement` call and both `raw_transport` cases,',
      'and the worker maps each tag as `mapping` gives; its `multi_fault` cases pin no tag, and',
      'its `emit_precedence` cases pin `{{B_F1_CODE}}` before `{{B_F2_CODE}}`.',
    ],
  },
];
const FOLD48_CLAIMS = [
  {
    where: '0',
    whole: false,
    text: [
      "It folds BB8's two rulings of 6693502369 and the nits of his review 6693638249: each",
      "log's state carries a verified `bytes` member, so W7 holds `MEMBERSHIP_BYTES` and R2, R5",
      "and R3 check the member where it is read (§2.7, §2.10, §3, §4, §5); F1 bounds an entry's",
      'nesting depth by `ENTRY_DEPTH`, provisional until the #721 author declares the entry',
      'shapes, and `MEMBERSHIP_BYTES` is re-derived over the 17 shapes capped at it,',
      'provisional with it (§2.1, §2.11, §3, §6.11, §8, §9, §10, §12, §13).',
    ],
  },
  {
    where: '0',
    whole: false,
    text: [
      "It folds BB8's confirmations of 21:31Z: segment bytes that are not UTF-8 are F3 in both",
      'languages, decoded in Node by a fatal `TextDecoder`, never `Buffer.toString`; and',
      "admission's lone-surrogate refusal has a guard test on both create paths and a",
      'stored-request case at `workerPayload` (§2.11, §9, §13).',
    ],
  },
  {
    where: '0',
    whole: false,
    text: [
      'shapes, which halved `MEMBERSHIP_BYTES` to {{MIB_HALF}} (restored to {{MIB}} under',
      '`ENTRY_DEPTH`, below),',
    ],
  },
  {
    where: '1',
    whole: false,
    text: [
      '- **Depth.** The count of nested arrays in an entry: a scalar is 0, `["a"]` is 1 and',
      '`[["a"]]` is 2. F1 holds it to `ENTRY_DEPTH` (§2.1).',
    ],
  },
  {
    where: '2',
    whole: false,
    // Its citations are the depth anchors' symbols (checked below).
    cites: 'depth',
    text: [
      '- **F1, the subset.** An entry is built only from arrays, strings, booleans, `null` and',
      'integers n with |n| ≤ 2⁵³ − 1, and its depth is at most `ENTRY_DEPTH`. Objects and',
      'non-integers are not entries. Strings are well-formed Unicode with no lone surrogate',
      '(Node `String.prototype.isWellFormed`; in Python, strict UTF-8 encoding succeeds). -',
      '**The depth bound** (BB8 6693502369, item 31). `ENTRY_DEPTH` is derived from the #721',
      "author's declared entry shapes: the smallest power of two at least twice the largest",
      'depth they declare, and at least 8. It is never above 64, well under any recursion',
      'limit, so `canonical_json` completes on every entry. Nothing in v1 needs deep entries:',
      "§2.3's logs hold fixed-shape keys and descriptors that `analysis.py` declares, and",
      "caller text cannot deepen them. **Required** (§9): the #721 author declares each log's",
      'entry shape and its largest depth. That declaration does not exist yet, so `ENTRY_DEPTH',
      '= {{ED}}` is provisional, and open for BB8 (§12, item 31). Its basis is the deepest',
      'shape the source builds at this head: a `seen` or `alt_seen` key is a pair of span keys',
      '(`analysis.py:_candidates`, `:_new_pairs`), each span key the locus, a string',
      '(`:_origin`), the direction and the cells (`:_span_key`), and each cell a line and a',
      'token, with its syllable outside a disputed word (`:_cell`), so depth {{DECL}}; an',
      '`alt_cells` entry is a pair of cells, at the pair build and at the shared-sound build',
      "(`:_prepare_event`), the latter a pair of the stream's words (`:_sound_candidates`),",
      'each a word with a span (`:_sound_spans`) or a varying word with none',
      '(`:_sound_unspanned`), depth {{DECL_CELLS}}.',
      "`variants`' descriptor and `row_seen`'s keys are not built yet. Twice {{DECL}} is",
      '{{ED}}, which is also the floor. If the declared largest depth is {{DECL_NEXT}} or more,',
      '`ENTRY_DEPTH` becomes {{ED_NEXT}} or more, and `MEMBERSHIP_BYTES` is derived again with',
      'it (§6.11). So `MEMBERSHIP_BYTES = {{MB}}`, derived at `ENTRY_DEPTH = {{ED}}`, is',
      'provisional with it, until the #721 author (3PO) declares the entry shapes (§3, §9, §12,',
      'item 31).',
    ],
  },
  {
    where: '2',
    whole: false,
    text: [
      "`json_safe` recurses once per level, and F1's depth bound keeps every entry far under",
      "Python's recursion limit, so both complete on every entry (BB8 6693502369).",
    ],
  },
  {
    where: '2',
    whole: false,
    text: [
      'single pass (§6.11). That rule is about the rate, not recursion, so the depth bound',
      'leaves it as it was (BB8 6693502369). The validator checks the byte equality on every',
      'vector and fixture entry through Python itself, and on every §10 load shape, each capped',
      'at `ENTRY_DEPTH`.',
    ],
  },
  {
    where: '2',
    whole: false,
    text: [
      'most `MEMBERSHIP_ENTRIES` entries and `MEMBERSHIP_BYTES` entry bytes, sealed and tail',
      '(§3).',
    ],
  },
  {
    where: '2',
    whole: false,
    text: [
      "- **`bytes`** (BB8 6693502369, item 30) is the sum of `|canonical(e)|` over the state's",
      'sealed entries, separators not counted, so 0 for the empty state. A commit adds each',
      "seal's entry bytes (§4), the bytes F2, F4 and F5 already compute, and W7 holds the",
      'membership logs to `MEMBERSHIP_BYTES` with it. It is verified wherever it is read: R2 at',
      "a full read and R5 at a lease's walk (§5.1), and R3 at the worker's load (§5.2). An",
      'unverified count would be worse than none. `record.discovery` has not shipped, so the',
      'member costs no format break now.',
    ],
  },
  {
    where: '2',
    whole: false,
    text: [
      'It is never ahead of the head. Its `segments`, `count` and `bytes` are at most the',
      "head's; it is the empty state (head `null`, segments 0, count 0, bytes 0, digest `d₀`)",
    ],
  },
  {
    where: '2',
    whole: false,
    text: ['"logs":{"<log>":{"head","segments","count","bytes","digest"}'],
  },
  {
    where: '2',
    whole: false,
    text: [
      "Resets are listed in `frame.discovery.resets`. They are applied before the frame's",
      'seals, and the log restarts empty (head `{{RESET_HEAD}}`, count {{RESET_COUNT}}, bytes',
      '{{RESET_BYTES}}, digest `d₀`). Its old chain is released.',
    ],
  },
  {
    where: '3',
    whole: false,
    text: [
      '| `ENTRY_DEPTH` | {{ED}} nested arrays per entry (a scalar is 0, `[["a"]]` is 2):',
      'provisional until the #721 author (3PO) declares the entry shapes, then derived from them',
      'as the smallest power of two at least twice their largest depth, at least 8 and at most 64 (§2.1, BB8',
      '6693502369) | `{{B_F1_CODE}}`: an entry it generated past the bound breaks F1, an engine',
      'defect, since no input can deepen an entry (§2.11) | `{{A_CODE}}` (F1) |',
    ],
  },
  {
    where: '3',
    whole: false,
    text: [
      '| `MEMBERSHIP_BYTES` | {{MB}} canonical entry bytes ({{MIB}}) in the same four logs',
      'together, each sealed and tail: provisional with `ENTRY_DEPTH`, until the #721 author',
      '(3PO) declares the entry shapes (§2.1); derived from',
    ],
  },
  {
    where: '3',
    whole: false,
    text: [
      '| `RESOURCE_LIMIT`, with the same cause for each log as `MEMBERSHIP_ENTRIES` |',
      "`{{A_CODE}}` (W7), totalled from each log's `bytes` (§2.7; BB8 6693502369) |",
    ],
  },
  {
    where: '4',
    whole: false,
    text: [
      '- **W7, the membership caps.** After the frame, the four membership logs hold at most',
      '`MEMBERSHIP_ENTRIES` entries and at most `MEMBERSHIP_BYTES` entry bytes together: for',
      "each of `seen`, `variants`, `row_seen` and `alt_seen`, its count plus its new tail's",
      "length, and its `bytes` plus its new tail's canonical bytes (§2.7, §3, §6.11; BB8",
      '6693502369).',
    ],
  },
  {
    where: '4',
    whole: false,
    text: ['`count`, adds its entry bytes to `bytes` and sets `digest`'],
  },
  {
    where: '4',
    whole: false,
    text: ['depth bound included (§2.1).'],
  },
  {
    where: '5',
    whole: false,
    text: [
      '`null`). `v` is never ahead of the head (§2.7): its `segments`, `count` and `bytes` are',
      "at most the head's,",
    ],
  },
  {
    where: '5',
    whole: false,
    text: [
      "`v.digest`; and the walk's bytes start from `v.bytes` and, with each segment read's",
      "entry bytes added, end at the head's `bytes` (BB8 6693502369).",
    ],
  },
  {
    where: '5',
    whole: false,
    text: [
      "`count`, `bytes` and `digest` (R2): its summed entry bytes equal the head's `bytes`, and",
      'a mismatch is structural (BB8 6693502369).',
    ],
  },
  {
    where: '5',
    whole: false,
    text: [
      "- **R3, cursor agreement.** The summary's epoch and log names equal",
      "`cursor.discovery`'s. For each log, `count` equals `sealed` and `digest` equals",
      "`sealed_digest`, and for each log it loads, the summary's `bytes` equals the worker's",
      "own sum of its loaded entries' canonical bytes, the bytes it computes once for F5 (§2.1;",
      'BB8 6693502369). A mismatch is cause `{{R3_CAUSE}}`.',
    ],
  },
  {
    where: '6',
    whole: false,
    text: [
      'its meaning; the order only makes the bytes canonical. It counts toward',
      '`MEMBERSHIP_ENTRIES` and `MEMBERSHIP_BYTES` (§3): an append that would pass either cap',
      "refuses with `RESOURCE_LIMIT`, cause `discovery_seen`, and so does `variants`' with",
      '`discovery_variants`.',
    ],
  },
  {
    where: '6',
    whole: false,
    text: [
      'empty: it counts toward `MEMBERSHIP_ENTRIES` and `MEMBERSHIP_BYTES` with the other',
      'membership logs (§3), and an append that would pass either cap refuses with',
      '`RESOURCE_LIMIT`, cause `discovery_row_seen`.',
    ],
  },
  {
    where: '6',
    whole: false,
    text: [
      '- **The membership caps.** `alt_seen` counts toward `MEMBERSHIP_ENTRIES` and',
      '`MEMBERSHIP_BYTES` with the other membership logs (§3, derived in §6.11). A new key that',
      'would take them past either is refused with `RESOURCE_LIMIT`, cause',
      '`discovery_alt_seen`, before the frame is emitted.',
    ],
  },
  {
    where: '6',
    whole: false,
    text: [
      "either cap refuses it as `{{A_CODE}}` (W7): each log's state carries its `bytes` (§2.7;",
      'BB8 6693502369), so the store totals the entry bytes as it totals the counts.',
    ],
  },
  {
    where: '7',
    whole: false,
    text: [
      "In `unavailable.released`, each released log's state, `{{STATE_SHAPE}}`, collapses to its",
      'name and its head, `{"<log>": <head>}`, as the previous revision (`2e8ae0239`) already',
      'defined it, and the reason copies the same map (U2).',
      'For each released log the save drops its two states, in `logs` and in `verified` (about',
      '{{STATE_HEAD}} bytes with a head, about {{STATE_EMPTY}} for an empty state), and adds its head',
      'twice',
    ],
  },
  {
    where: '9',
    whole: false,
    text: [
      "- the codec counts the depth in its iterative parse and in its encoder's F1 walk, and an",
      "entry past `ENTRY_DEPTH` raises with `rule == 'F1'` and `what` `{{DEPTH_WHAT}}` (BB8",
      '6693502369, item 31). Required test, in Node and in Python:',
      "`decode_entry('[[[[[[[[[0]]]]]]]]]')` and `canonical_bytes([[[[[[[[[0]]]]]]]]])` each",
      "raise with `rule == 'F1'`; and an empty array nested {{DEEP}} deep encodes, unchanged,",
      'to its {{DEEP_BYTES}} canonical bytes;',
    ],
  },
  {
    where: '9',
    whole: false,
    text: [
      "- the #721 author declares each log's entry shape and its largest depth (BB8 6693502369,",
      'item 31): `ENTRY_DEPTH` is derived from that declaration (§2.1) and `MEMBERSHIP_BYTES`',
      'from the 17 shapes capped at it (§6.11). Both are provisional until it exists,',
      '`ENTRY_DEPTH = {{ED}}` and `MEMBERSHIP_BYTES = {{MB}}`, and a declared depth of',
      '{{DECL_NEXT}} or more re-derives both before the worker half joins a release train;',
    ],
  },
  {
    where: '9',
    whole: false,
    text: [
      "- **The store's byte count (R2).** Each log's state carries `bytes`, a commit adds its",
      "seals' entry bytes, and W7 holds `MEMBERSHIP_BYTES` from it; R2 checks it at a full read",
      "and R5 at a lease's walk, and the worker's R3 at its load, in the store half's runtime",
      'train (§2.7, §4, §5; BB8 6693502369). `record.discovery` has not shipped, so the member',
      'is no format break.',
    ],
  },
  {
    where: '11',
    whole: false,
    text: [
      "| 48 | BB8 6693502369 (items 30 and 31, R2's questions of 6693449409); BB8's review",
      "6693638249, nits 1–4 | (30) each log's head and verified state carry `bytes`, the sum of",
      "its sealed entries' canonical bytes, added to by each seal; W7 holds `MEMBERSHIP_BYTES`",
      'from it; it is verified where it is read: R2 at a full read (`{{C_CAUSE}}`), R5 at a',
      "lease's walk (`{{C_WALK_CODE}}`), R3 at the worker's load (`{{R3_CAUSE}}`); (31) F1",
      'bounds the depth by `ENTRY_DEPTH`, the smallest power of two at least twice the largest',
      'declared depth, at least 8 and at most 64, provisionally 8 until the #721 author',
      "declares the entry shapes; past it `{{B_F1_CODE}}` on the worker's emit, `{{A_CODE}}` at",
      'the store, F3 on read-back; `MEMBERSHIP_BYTES = {{MB}}` re-derived over the 17 shapes',
      "capped at it, provisional with it; the nits: no #656 entry count is a term, each log's",
      'section names both caps, the counts use the unrounded terms but for the per-byte rate,',
      "as printed, and 2.3-fold is against 107.3 ns; BB8's 21:31Z confirmations: invalid UTF-8",
      "in a segment F3 in both languages, never `Buffer.toString`, and admission's",
      'stored-request case | §1, §2.1, §2.3, §2.7, §2.10, §2.11, §3, §4, §5.1, §5.2, §6.1,',
      '§6.2, §6.4, §6.11, §8, §9, §10, §12, §13 | `bad/entry_over_depth.json`,',
      '`bad/head_bytes_disagree.json`, `bad/verified_bytes_disagree.json`,',
      '`bad/summary_bytes_disagree.json`, `bad/membership_over_cap.json`,',
      '`bad/verified_bytes_ahead.json`, `good/codec_error_mapping.json`,',
      '`good/membership_load_measurement.json`; the §6.11 derivation and byte tests |',
    ],
  },
  {
    where: '12',
    whole: false,
    text: [
      "are ruled (BB8 6693502369: yes to both) and folded; item 31's `ENTRY_DEPTH`, and",
      '`MEMBERSHIP_BYTES` with it, are provisional until the #721 author declares the entry',
      'shapes, and those values are open for BB8.',
    ],
  },
  {
    where: '12',
    whole: false,
    text: ['6693449409; BB8 ruled both yes (6693502369), and this text folds both rulings.'],
  },
  {
    where: '12',
    whole: false,
    text: [
      '30. **Ruled: yes, folded** (BB8 6693502369; asked in 6693449409). W7 holds',
      "`MEMBERSHIP_BYTES` through a `bytes` member in each log's head and verified state: the",
      'sum of `|canonical(e)|` over its sealed entries, which a commit adds to with each seal',
      '(§2.7, §4). It is verified wherever it is read: R2 at a full read, `{{C_CAUSE}}`; R5 at',
      "a lease's walk, the junction, `{{C_WALK_CODE}}`; and R3 at the worker's load,",
      '`{{R3_CAUSE}}` (§5.1, §5.2). A frame one byte past the cap is refused by W7 and one at',
      'it passes (`bad/membership_over_cap.json`); a head, a verified state and a summary whose',
      '`bytes` disagrees with the chain are `bad/head_bytes_disagree.json`,',
      '`bad/verified_bytes_disagree.json` and `bad/summary_bytes_disagree.json`; a verified',
      "`bytes` past its head's is refused by R5 before anything is read",
      '(`bad/verified_bytes_ahead.json`).',
    ],
  },
  {
    where: '12',
    whole: false,
    text: [
      '31. **Ruled: yes, folded; its value is open** (BB8 6693502369; asked in 6693449409). F1',
      "bounds an entry's nesting depth with `ENTRY_DEPTH`: the smallest power of two at least",
      "twice the largest depth among the #721 author's declared entry shapes, at least 8 and at",
      "most 64 (§2.1). Past it a generated entry is `{{B_F1_CODE}}` on the worker's emit, a",
      'submitted frame `{{A_CODE}}` at the store (F1), and a persisted segment F3 on read-back',
      "(`bad/entry_over_depth.json`). §2.1's 2,048-level text and its `RecursionError` caveat",
      'are gone; the single-pass key stays, for the rate. **Open for BB8:** no declaration of',
      'the entry shapes exists yet, so the #721 author is required to make one (§9), and',
      '`ENTRY_DEPTH = {{ED}}` is provisional, from the deepest shape the source builds at this',
      'head, a `seen` or `alt_seen` key of depth {{DECL}} (§2.1). `MEMBERSHIP_BYTES` is',
      're-derived over the 17 shapes capped at it (§6.11, §10), and `MEMBERSHIP_BYTES = {{MB}}`',
      "is provisional with `ENTRY_DEPTH = {{ED}}`: both wait on the #721 author's (3PO's)",
      'declared entry shapes, and a declared depth of {{DECL_NEXT}} or more re-derives both.',
    ],
  },
  {
    where: '13',
    whole: false,
    text: [
      '- depth: `bad/entry_over_depth.json` (F1). An entry one level past `ENTRY_DEPTH`: a',
      "store sent it in a frame refuses `{{A_CODE}}` 400 and writes nothing; the worker's emit",
      "refuses it as `{{B_F1_CODE}}` with §3's F1 message; read back from an address-valid",
      "segment it is F3, so a full read releases with `{{C_CAUSE}}`, a lease's walk refuses",
      "`{{C_WALK_CODE}}` 503 and the worker's load refuses `{{C_CAUSE}}`. The same cases at",
      'exactly `ENTRY_DEPTH` pass (BB8 6693502369, item 31);',
    ],
  },
  {
    where: '13',
    whole: false,
    text: [
      '`bad/head_bytes_disagree.json` (R2, cause `{{C_CAUSE}}`): a head whose `bytes` disagrees',
      "with its chain, which a lease's walk meets at R5's junction as `{{C_WALK_CODE}}`;",
    ],
  },
  {
    where: '13',
    whole: false,
    text: [
      "`bad/summary_bytes_disagree.json` (R3: the summary's `bytes` against the worker's own",
      'sum),',
    ],
  },
  {
    where: '13',
    whole: false,
    text: [
      "`bad/verified_bytes_disagree.json` (R5's junction: the bytes read from the verified",
      "state's `bytes` do not end at the head's), refused once the appended segment is read,",
      'releasing and saving nothing, its full read likewise passing;',
      "`bad/verified_bytes_ahead.json` (R5: a verified `bytes` past its head's, every other",
      "field a valid prefix), refused by R5's prefix check before anything is read, its full",
      'read likewise passing;',
    ],
  },
  {
    where: '13',
    whole: false,
    text: [
      "`bad/entry_over_depth.json`'s entry is likewise one that each operation refuses by its",
      "own rule: the worker's emit as `{{B_F1_CODE}}`, its load as F3, and the store's frame",
      'check as F1.',
    ],
  },
  {
    where: '13',
    whole: false,
    text: [
      "- `good/membership_load_measurement.json`: the raw rows behind §10's per-byte load rate",
      '(BB8 6693502369), a measurement, not a bound: the {{SHAPES}} shapes capped at',
      '`ENTRY_DEPTH`, plain and gzipped, in two passes, and the nested shapes capped at {{SENS16}}',
      "and at {{SENS64}}, in one pass. The validator computes §10's figures from the rows and",
      "checks §10's text and §6.11's rate against them.",
    ],
  },
  // The review of 04495c233: §2's state size, and §6.11's provisional bounds.
  {
    where: '3',
    whole: false,
    text: [
      '`record.discovery` (five logs, each about {{STATE_HEAD}} bytes in `logs` and as much',
      'again in `verified`)',
    ],
  },
  {
    where: '6',
    whole: false,
    text: [
      '`MEMBERSHIP_ENTRIES = 65536` and `MEMBERSHIP_BYTES = {{MB}}`, are the bounds, and',
      '`MEMBERSHIP_BYTES` is provisional with `ENTRY_DEPTH = {{ED}}` (§2.1).',
    ],
  },
  {
    where: '6',
    whole: false,
    text: [
      'not a measured margin. The byte bound is provisional: its rate is the worst of {{SHAPES}} shapes',
      'capped at `ENTRY_DEPTH = {{ED}}`, itself provisional until the #721 author declares the',
      'entry shapes, and a declared depth of {{DECL_NEXT}} or more re-derives both (§2.1, §12,',
      'item 31).',
    ],
  },
];
// Item 31's basis (§2.1): the deepest entries the source builds at this head,
// read from the lines §2.1 cites, and ENTRY_DEPTH from the formula BB8 ruled
// (6693502369): the smallest power of two at least twice the largest declared
// depth, at least 8 and at most 64.
// The calls in each depth symbol's text, by Python's ast: `[kind, name]`,
// where kind is `self` (`self.x(…)`), `name` (a bare name), `local` (a
// function the symbol defines), `method` (an attribute of anything else,
// dotted where the chain is names) or `computed` (any other callee). Cached
// by text, since the line-shift tests ask again for unchanged code.
const DEPTH_CALL_CACHE = new Map();
function depthCalls(spans) {
  const key = JSON.stringify(spans);
  if (DEPTH_CALL_CACHE.has(key)) return DEPTH_CALL_CACHE.get(key);
  const run = spawnSync(
    'python3',
    [
      '-I',
      '-c',
      [
        'import ast, json, sys',
        'def dotted(f):',
        '    parts = []',
        '    while isinstance(f, ast.Attribute):',
        '        parts.append(f.attr)',
        '        f = f.value',
        '    if isinstance(f, ast.Name):',
        '        return ".".join([f.id] + parts[::-1])',
        '    return "<" + type(f).__name__ + ">." + ".".join(parts[::-1])',
        'out = {}',
        'for symbol, text in json.load(sys.stdin).items():',
        '    lines = text.split("\\n")',
        '    ind = len(lines[0]) - len(lines[0].lstrip())',
        '    tree = ast.parse("\\n".join(l[ind:] if not l[:ind].strip() else l for l in lines))',
        '    local = {n.name for n in ast.walk(tree) if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef))',
        '             and n is not tree.body[0]}',
        '    calls = set()',
        '    for n in ast.walk(tree):',
        '        if not isinstance(n, ast.Call):',
        '            continue',
        '        f = n.func',
        '        if isinstance(f, ast.Name):',
        '            calls.add(("local" if f.id in local else "name", f.id))',
        '        elif isinstance(f, ast.Attribute):',
        '            d = dotted(f)',
        '            calls.add(("self" if d.count(".") == 1 and d.startswith("self.") else "method", d))',
        '        else:',
        '            calls.add(("computed", type(f).__name__))',
        '    out[symbol] = sorted(calls)',
        'print(json.dumps(out))',
      ].join('\n'),
    ],
    { input: JSON.stringify(spans) }
  );
  assert.equal(run.status, 0, run.stderr?.toString());
  const got = JSON.parse(run.stdout.toString());
  DEPTH_CALL_CACHE.set(key, got);
  return got;
}
// Each depth symbol's code, digested as a cited range's is (codeLines).
const DEPTH_CODE = {
  _cell: 'd2a058bf79855c67',
  _origin: '306e50ae6c192a7e',
  _span_key: '09b3d3ce427ea176',
  _sound_candidates: '7dfe94ca1b51cb5a',
  _sound_spans: '3494bbfc27cdc369',
  _sound_unspanned: '0eb5db715ee809a0',
  _candidates: 'eaff783ea58c8caf',
  _new_pairs: '626779a0551c8888',
  _prepare_event: '566b6e34aae72473',
};
const depthFor = (declared) => Math.min(64, Math.max(8, 2 ** Math.ceil(Math.log2(2 * declared))));
function declaredDepths(src = readSource) {
  const text = src('lyric-harness/library/analysis.py');
  for (const row of DEPTH_ANCHORS) resolveAnchor(text, row);
  const called = new Set();
  // The set is closed: each symbol's watched statements are exactly the
  // pinned ones, whole.
  assert.deepEqual(
    Object.keys(DEPTH_WATCH).sort(),
    [...new Set(DEPTH_ANCHORS.map((r) => r.symbol))].sort()
  );
  for (const [symbol, watch] of Object.entries(DEPTH_WATCH)) {
    const id = `analysis.${symbol}`;
    const stmts = pyStatements(spanText(text, { id, file: 'x.py', symbol }));
    const pinned = DEPTH_ANCHORS.filter((r) => r.symbol === symbol).map((r) => r.stmt ?? r.starts);
    assert.deepEqual(
      stmts.filter((st) => watch.test(st) && !pinned.includes(st)),
      [],
      `every statement in ${symbol} that builds or reshapes an entry is a depth anchor`
    );
    for (const p of pinned) assert.ok(stmts.includes(p), `${symbol} holds the statement ${p}`);
  }
  const spans = Object.fromEntries(
    Object.keys(DEPTH_WATCH).map((symbol) => [
      symbol,
      spanText(text, { id: `analysis.${symbol}`, file: 'x.py', symbol }),
    ])
  );
  // Closed over its callees (BB8 6701778607, item 3, and his D5): every call
  // in a depth symbol, read by Python's own ast (inside f-strings and nested
  // functions too), is to a depth symbol or a listed helper (`self.*`), a
  // builtin or a builtin value's method on the lists, a function the symbol
  // defines itself, or a callee DEPTH_CALLS names. A computed callee, or one
  // read by name at run time, fails.
  for (const [symbol, calls] of Object.entries(depthCalls(spans)))
    for (const [kind, name] of calls) {
      const what = `${symbol} calls ${name}`;
      assert.ok(kind !== 'computed', `${what}: a computed callee is refused`);
      assert.ok(!DEPTH_REFUSED.has(name), `${what}: a callee read by name is refused`);
      if (kind === 'self') {
        const callee = name.slice('self.'.length);
        assert.ok(
          callee in DEPTH_WATCH || Object.hasOwn(DEPTH_HELPERS, callee),
          `${symbol} calls self.${callee}, which is neither a depth symbol nor a listed helper`
        );
        called.add(callee);
      } else if (kind === 'local' || (kind === 'name' && DEPTH_BUILTINS.has(name))) continue;
      else if (Object.hasOwn(DEPTH_CALLS, name)) called.add(name);
      else
        assert.ok(
          kind === 'method' && DEPTH_METHODS.has(name.split('.').pop()),
          `${what}, which is neither a depth symbol, a listed helper, a listed builtin nor a listed callee`
        );
    }
  assert.deepEqual(
    [...Object.keys(DEPTH_HELPERS), ...Object.keys(DEPTH_CALLS)].filter((h) => !called.has(h)),
    [],
    'every listed helper and callee is called by a depth symbol'
  );
  // Each depth symbol's whole code, indentation kept, is pinned: a change
  // anywhere in one fails until the basis is read again.
  const off = Object.entries(spans)
    .map(([symbol, t]) => [symbol, digestOf(t, true)])
    .filter(([symbol, d]) => DEPTH_CODE[symbol] !== d);
  assert.deepEqual(
    off.map(([symbol]) => symbol),
    [],
    `a depth symbol changed: read §2.1's basis again, then pin ${JSON.stringify(Object.fromEntries(off))}`
  );
  // The shapes those lines build, as JSON: a cell is a line and a token (and
  // a syllable), a span key its origin, direction and cells, a key two span keys.
  const cell = [12, 3, 0];
  const spanKey = ['origin@12:3', 'forward', [cell, [12, 4]]];
  const key = [spanKey, spanKey];
  const altCell = [
    [12, 3],
    [14, 1],
  ];
  return { key: entryDepth(key), alt_cells: entryDepth(altCell) };
}
function releaseStateSizes() {
  const hex = 'a'.repeat(64);
  const sized = (log, st) => cbytes(log) + 1 + Buffer.byteLength(canonical(st)) + 1;
  const widths = [
    [1, 1, 1],
    [LIMITS.CHAIN_SEGMENTS, LIMITS.MEMBERSHIP_ENTRIES, LIMITS.MEMBERSHIP_BYTES],
  ];
  const head = [];
  const empty = [];
  for (const log of LOGS) {
    for (const [segments, count, bytes] of widths)
      head.push(sized(log, { head: hex, segments, count, bytes, digest: hex }));
    empty.push(sized(log, emptyLog(log)));
  }
  const about = (xs) => Math.round(xs.reduce((a, x) => a + x, 0) / xs.length / 10) * 10;
  const out = { head: about(head), empty: about(empty) };
  for (const [k, xs] of Object.entries({ head, empty }))
    for (const x of xs) assert.ok(Math.abs(x - out[k]) <= 10, `${k}: ${x} is about ${out[k]}`);
  return out;
}
// BB8's review of a12c35b4d (6699352254): ruling 1 on MEMBERSHIP_BYTES, with
// its two conditions; ruling 2, the stored-request check stays where §2.11 has
// it; and the 17 named shapes counted as the distinct loads behind the rate.
const FOLD49_CLAIMS = [
  {
    where: '0',
    whole: false,
    text: [
      "BB8's review of `a12c35b4d` (6699352254) accepts `MEMBERSHIP_BYTES` at {{MIB}},",
      'provisional with `ENTRY_DEPTH`, on two conditions (§6.11, §12, item 31), keeps the',
      "stored-request check where §2.11 has it, not in the store's lease (§2.11), and counts",
      'the {{SHAPES}} named shapes as {{B8_DISTINCT}} distinct loads at this cap (§10).',
    ],
  },
  {
    where: '6',
    whole: false,
    text: [
      "- **BB8's acceptance, and its two conditions** (BB8 6699352254, ruling 1).",
      '`MEMBERSHIP_BYTES = {{MB}}` stands, provisional with `ENTRY_DEPTH`. Rounding it down to',
      'a power of two is accepted: it gives up {{B8_GIVEN_UP}} bytes of room ({{B8_ROOM}} less',
      '{{B8_MB}}) and keeps the two caps alike. (a) The per-byte rate is re-measured on a quiet',
      "host before the proof run. The worst median's two passes differ by {{B8_SPREAD}}%, and",
      'the worst single load with the nested shapes capped at {{SENS64}}, {{B8_SINGLE64}} ns, is',
      'past the {{B8_STOPS}} ns at which the cap stops fitting, so the medians carry the claim',
      'and a noisy run could flip it. (b) If the declared entry shapes put `ENTRY_DEPTH` at',
      '{{SENS64}}, `MEMBERSHIP_BYTES` is re-derived, not inherited: the median at that cap,',
      '{{B8_AT64}} ns, is within {{B8_GAP64}}% of {{B8_STOPS}} ns.',
    ],
  },
  {
    where: '10',
    whole: false,
    text: [
      'These are {{SHAPES}} named shapes, {{B8_DISTINCT}} distinct at this cap: capped at',
      '{{B8_CAPPED}}, the empty arrays nested {{B8_SAME}} deep build the same entry, so',
      '{{B8_DISTINCT}} distinct loads stand behind the rate (BB8 6699352254).',
    ],
  },
  {
    where: '11',
    whole: false,
    text: [
      '| 49 | BB8 6699352254 (review of `a12c35b4d`, rulings 1–2) | (1) `MEMBERSHIP_BYTES =',
      '{{MB}}` stands, provisional with `ENTRY_DEPTH`; power-of-two rounding is accepted; the',
      'per-byte rate is re-measured on a quiet host before the proof run, and the cap is',
      're-derived, not inherited, if `ENTRY_DEPTH` reaches {{SENS64}}; (2) the stored-request',
      'check stays where §2.11 has it, before `workerPayload`, never in `this.store.lease()`;',
      'and the {{SHAPES}} named shapes are {{B8_DISTINCT}} distinct loads at this cap |',
    ],
  },
  {
    where: '12',
    whole: false,
    text: [
      'those values are open for BB8. BB8 accepts `MEMBERSHIP_BYTES` at {{MIB}}, provisional',
      'with `ENTRY_DEPTH`, on two conditions (6699352254, ruling 1; item 31).',
    ],
  },
  {
    where: '12',
    whole: false,
    text: [
      'declared depth of {{DECL_NEXT}} or more re-derives both. BB8 accepts `MEMBERSHIP_BYTES =',
      '{{MB}}` on these terms (6699352254, ruling 1): the power-of-two rounding stands; the',
      'per-byte rate is re-measured on a quiet host before the proof run; and if the declared',
      'shapes put `ENTRY_DEPTH` at {{SENS64}}, the cap is re-derived, not inherited (§6.11). The',
      '{{SHAPES}} shapes are {{SHAPES}} named shapes, {{B8_DISTINCT}} distinct at this cap (§10).',
    ],
  },
];
// The figures FOLD49_CLAIMS states, computed from the measurement's rows and
// §6.11's terms (BB8 6699352254).
function fold49Facts(meas) {
  const n = (v) => v.toLocaleString('en-US');
  const f1 = (x) => x.toFixed(1);
  const factor = 3;
  const walk = 5 * LIMITS.CHAIN_SEGMENTS * (0.01 / 99) * factor;
  const left = 29 - 15.2 - 2.4 - walk - LIMITS.MEMBERSHIP_ENTRIES * 30.4e-6 * factor;
  const MB = LIMITS.MEMBERSHIP_BYTES;
  const top = (rows, f) => rows.reduce((a, r) => (r[f] > a[f] ? r : a));
  const main = meas.runs.filter((r) => r.cap === LIMITS.ENTRY_DEPTH);
  const worst = top(main, 'ns_per_byte_med');
  // The per-byte rate enters as printed (§6.11), so the room is over 416.4 ns.
  const printed = Number(f1(worst.ns_per_byte_med));
  const room = Math.floor(left / (printed * 1e-9 * factor));
  assert.equal(2 ** Math.floor(Math.log2(room)), MB, 'the room rounds down to the cap');
  const stops = (left / (MB * factor)) * 1e9;
  // (a) The worst median's other pass, the same shape stored the same way.
  const other = main.find(
    (r) => r.kind === worst.kind && r.gz === worst.gz && r.pass !== worst.pass
  );
  const spread =
    (Math.abs(worst.ns_per_byte_med - other.ns_per_byte_med) / other.ns_per_byte_med) * 100;
  const deep = meas.runs.filter((r) => r.cap === 64);
  const single64 = top(deep, 'ns_per_byte_max').ns_per_byte_max;
  const at64 = top(deep, 'ns_per_byte_med').ns_per_byte_med;
  assert.ok(single64 > stops, 'the worst single load at 64 is past the breakpoint');
  assert.ok(at64 < stops, 'the median at 64 is under it');
  // (b) Within this many percent of the breakpoint, rounded up.
  const gap64 = Math.ceil(((stops - at64) / stops) * 100);
  assert.ok(gap64 <= 8, 'within 8%');
  // The named shapes and the distinct loads: the fixture's kinds, and the
  // validator's own entries by their canonical bytes.
  const kinds = new Set(meas.shapes.map((x) => x.kind));
  assert.equal(new Set(LOAD_SHAPES.map(canonical)).size, kinds.size, 'distinct entries are kinds');
  assert.equal(new Set(main.map((r) => r.kind)).size, kinds.size, 'one load per distinct kind');
  const shared = meas.shapes.filter((x) => meas.shapes.filter((y) => y.kind === x.kind).length > 1);
  assert.equal(new Set(shared.map((x) => x.kind)).size, 1, 'one kind is shared');
  assert.equal(meas.shapes.length - kinds.size, shared.length - 1);
  const idx = shared.map((x) => meas.shapes.indexOf(x));
  assert.equal(new Set(idx.map((i) => canonical(LOAD_SHAPES[i]))).size, 1, 'the same entry');
  const depths = shared.map((x) => /^empty arrays nested ([\d,]+) deep, capped at/.exec(x.name)[1]);
  const and = (xs) => `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`;
  return {
    B8_DISTINCT: String(kinds.size),
    B8_CAPPED: String(LIMITS.ENTRY_DEPTH - 1),
    B8_SAME: and(depths),
    B8_GIVEN_UP: n(room - MB),
    B8_ROOM: n(room),
    B8_MB: n(MB),
    B8_SPREAD: f1(spread),
    B8_SINGLE64: f1(single64),
    B8_STOPS: f1(stops),
    B8_AT64: f1(at64),
    B8_GAP64: String(gap64),
  };
}
function codecFacts() {
  const fx = load(CODEC);
  const m = fx.mapping;
  const n = (v) => v.toLocaleString('en-US');
  // One fact per name: where the text states it twice, the data must agree.
  assert.deepEqual(m.store_frame.F1, { ...m.store_frame.F2, rule: 'F1' });
  const ints = m.store_frame.INTEGER_FIELD;
  assert.equal(ints['frame.epoch'].rule, ints['seal.first'].rule);
  assert.equal(m.persisted.full_read.cause, m.persisted.worker_load.cause);
  assert.equal(m.persisted.lease_walk.code, m.persisted.inflation.lease_walk.code);
  const [pb] = fx.persisted_bytes;
  assert.deepEqual(pb.store_required, pb.python);
  const ad = fx.admission;
  const line = /"line":"([^"]*)"/.exec(ad.refused[0].body)[1];
  const pair = /"line":"Bad ([^"]*)"/.exec(ad.admitted[0].body)[1];
  const peak = fx.emit_precedence.cases.find((c) => c.peak_under).peak_under;
  const b = codecBounds();
  const decl = declaredDepths();
  // A reset restarts the log as the empty state (§2.6).
  const reset = emptyLog('row_seen');
  // §7.4's release sizes: a log's state with its key and separator, by the
  // canonical form, at the smallest and largest counts with a head, and empty;
  // each "about" figure is the mean rounded to ten bytes, and every case is
  // within ten bytes of it.
  const states = releaseStateSizes();
  const meas = load(MEASUREMENT);
  const facts = {
    A_CODE: m.store_frame.F1.code,
    A_STATUS: String(m.store_frame.F1.status),
    W1: ints['frame.epoch'].rule,
    W4: ints.cursor_number.rule,
    B_F1_CODE: m.worker_emit.F1.code,
    B_F2_CODE: m.worker_emit.F2.code,
    B_F2_CAUSE: m.worker_emit.F2.cause,
    P1: m.worker_emit.precedence[1],
    C_WALK_CODE: m.persisted.lease_walk.code,
    C_WALK_STATUS: String(m.persisted.lease_walk.status),
    C_FULL_CODE: m.persisted.full_read.code,
    C_CAUSE: m.persisted.full_read.cause,
    STORE_CAUSE: m.persisted.inflation.full_read.cause,
    U_TAG: pb.python.tag,
    X_NODE_RULE: fx.cross_language.node.rule,
    X_NODE_CAUSE: fx.cross_language.node.cause,
    ENTRY_BYTES: n(LIMITS.ENTRY_BYTES),
    ENTRY_BYTES_RAW: String(LIMITS.ENTRY_BYTES),
    ENTRY_BYTES1: n(fx.raw_transport.over_spaced[0].canonical_bytes),
    PADDED: `about ${Math.round(fx.raw_transport.valid_padded.raw_bytes / 1048576)} MiB`,
    FRAME_CAP: mibKib(b.frameCap),
    WORKER_FRAME: mibKib(b.workerFrame),
    OBJ: mibKib(b.objectBytes),
    STORE_OBJ: mibKib(b.storeBytes),
    ADM_CODE: ad.code,
    ADM_STATUS: String(ad.status),
    ADM_MESSAGE: ad.message,
    ADM_PATHS: ad.paths.map((p) => p.name).join(' and '),
    ADM_LINE: line,
    ADM_PAIR: pair,
    PEAK: n(peak),
    DEEP: n(fx.emit_precedence.deep_valid.depth),
    DEEP_BYTES: n(fx.emit_precedence.deep_valid.canonical_bytes),
    // Items 30 and 31 (BB8 6693502369).
    DEPTH_WHAT,
    ED: String(LIMITS.ENTRY_DEPTH),
    DECL: String(decl.key),
    DECL_CELLS: String(decl.alt_cells),
    DECL_NEXT: String(decl.key + 1),
    ED_NEXT: String(depthFor(decl.key + 1)),
    MB: String(LIMITS.MEMBERSHIP_BYTES),
    R3_CAUSE: REFUSAL.resume.R3.cause,
    // The review of the item 30-31 fold, and BB8's 21:31Z confirmations.
    MIB: mib(LIMITS.MEMBERSHIP_BYTES),
    MIB_HALF: mib(LIMITS.MEMBERSHIP_BYTES / 2),
    RESET_HEAD: String(reset.head),
    RESET_COUNT: String(reset.count),
    RESET_BYTES: String(reset.bytes),
    STATE_HEAD: String(states.head),
    STATE_EMPTY: String(states.empty),
    STATE_SHAPE: `{${Object.keys(reset).join(', ')}}`,
    U_FULL_CAUSE: pb.expect.full_read.cause,
    U_WALK_CODE: pb.expect.lease_walk.code,
    U_LOAD_CAUSE: pb.expect.worker_load.cause,
    U_BYTE: `0x${pb.entry_hex.slice(2, -2).toUpperCase()}`,
    U_REPLACING: pb.replacing_decode.rule,
    // The stored-request case's anchors, as the contract cites them.
    ADM_STORED_AT: citeOf(ANCHOR.get(ad.stored_request.checked_at)),
    ADM_LEASED_AT: citeOf(ANCHOR.get(ad.stored_request.store_leased_at)),
    ADM_STORE_LEASE: citeOf(ANCHOR.get(ad.stored_request.store_lease)),
    ADM_PAUSED_AT: ANCHOR.get(ad.stored_request.paused_at).symbol,
    SHAPES: String(meas.shapes.length),
    SENS16: String(depthFor(5)),
    SENS64: String(64),
    ...fold49Facts(meas),
  };
  // ENTRY_DEPTH is the formula's value at the deepest shape the source builds.
  assert.equal(depthFor(Math.max(decl.key, decl.alt_cells)), LIMITS.ENTRY_DEPTH);
  assert.equal(fx.emit_precedence.deep_valid.depth, LIMITS.ENTRY_DEPTH);
  // The codes the facts name are the tables' own.
  assert.deepEqual({ code: facts.A_CODE, status: +facts.A_STATUS }, REFUSAL.write.F1);
  assert.deepEqual(REFUSAL.full.F3, unavailable(facts.C_CAUSE));
  assert.deepEqual(REFUSAL.full.F6, unavailable(facts.STORE_CAUSE));
  assert.deepEqual(REFUSAL.walk.F3, { code: facts.C_WALK_CODE, status: +facts.C_WALK_STATUS });
  return facts;
}
const fillClaim = (text, facts) =>
  text.replace(/\{\{([A-Z0-9_]+)\}\}/g, (_, k) => {
    assert.ok(Object.hasOwn(facts, k), `the fact ${k}`);
    return facts[k];
  });
const CLAIM_SECTIONS = {
  0: () => CONTRACT.slice(0, CONTRACT.indexOf('\n## 1.')),
  1: () => section('1. Terms'),
  6: () => section('6. Worker semantics'),
  7: () => section('7. Retention, GC roots and crash ordering'),
  2: () => section('2. Format'),
  3: () => section('3. Hard limits'),
  4: () => section('4. Write path'),
  5: () => section('5. Resume path'),
  8: () => section('8. Refusals'),
  9: () => section('9. Compatibility and release'),
  10: () => section('10. Measured on #656, not bounds'),
  11: () => section('11. Cross-reference'),
  12: () => section('12. Rulings on the items added for confirmation'),
  13: () => section('13. Fixtures and validator'),
};
// Where two flattened texts first differ, with some context, for the message.
const firstDifference = (a, b) => {
  let i = 0;
  while (i < a.length && a[i] === b[i]) i++;
  return `at ${i}: the contract has ${JSON.stringify(a.slice(i - 40, i + 60))}, the facts give ${JSON.stringify(b.slice(i - 40, i + 60))}`;
};

test('§2.11 and every statement of this fold read as the fixture, the tables and the source give them', () => {
  const facts = codecFacts();
  const flat = (t) => t.replace(/\s+/g, ' ').trim();
  assert.equal(CLAIMS.filter((c) => c.whole).length, 1);
  for (const c of [...CLAIMS, ...FOLD48_CLAIMS, ...FOLD49_CLAIMS]) {
    const want = flat(fillClaim(c.text.join(' '), facts));
    if (c.whole) {
      const have = flat(s211raw());
      assert.ok(have === want, `§2.11 is exactly its claim, ${firstDifference(have, want)}`);
    } else {
      const have = flat(CLAIM_SECTIONS[c.where]());
      assert.ok(have.includes(want), `§${c.where} states: ${want.slice(0, 120)}`);
    }
  }
  // §2.1's depth basis cites exactly the depth anchors' symbols, by name.
  const depth = FOLD48_CLAIMS.filter((c) => c.cites === 'depth');
  assert.equal(depth.length, 1);
  const depthText = fillClaim(depth[0].text.join('\n'), facts);
  assert.deepEqual(lineCites(depthText), [], "§2.1's depth basis cites no line number");
  assert.deepEqual(
    [...new Set(citesOf(depthText))].sort(),
    [...new Set(DEPTH_ANCHORS.map((r) => `${r.file}:${r.symbol}`))].sort()
  );
  // Every fact is used, so none is checked against nothing.
  const used = new Set(
    [...CLAIMS, ...FOLD48_CLAIMS, ...FOLD49_CLAIMS].flatMap((c) =>
      [...c.text.join(' ').matchAll(/\{\{([A-Z0-9_]+)\}\}/g)].map((x) => x[1])
    )
  );
  assert.deepEqual([...used].sort(), Object.keys(facts).sort());
});
