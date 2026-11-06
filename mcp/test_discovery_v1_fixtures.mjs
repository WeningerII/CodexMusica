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
//     under a live lease, and recomputes the MEMBERSHIP_ENTRIES derivation
//     from the contract's own figures (§6.11);
//   - builds the largest cursor §3.1's inputs allow, checks those inputs
//     against the registry and the source, holds the release-size property
//     over every combination of logs (§7.4), and checks that every
//     RESOURCE_LIMIT raise the reader reaches names a cause (§8);
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

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const DIR = path.join(HERE, 'fixtures', 'discovery_v1');
const CONTRACT = fs.readFileSync(path.join(HERE, 'DISCOVERY_V1.md'), 'utf8');
const README = fs.readFileSync(path.join(DIR, 'README.md'), 'utf8');

// §3 of the contract. The document must state the same values (checked below).
const LIMITS = Object.freeze({
  ENTRY_BYTES: 4096,
  SEGMENT_ENTRIES: 1024,
  SEGMENT_BYTES: 16384,
  FRAME_SEALS: 8,
  CHAIN_SEGMENTS: 2048,
  GROUP_KEYS: 32,
  GROUP_BYTES: 8192,
  WITNESS_FIELDS: 16,
  CONTINUATION_BYTES: 8192,
  CURSOR_BYTES: 163840,
  REFUSAL_BYTES: 1024,
  MEMBERSHIP_ENTRIES: 65536,
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
  'cursor_refusal_bytes',
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
  cursor_refusal_bytes: 'none',
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
// §2.8: cursor v2 keeps none of a method's terminal inputs (analysis.py:2439).
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
  // A cursor over CURSOR_BYTES or a refusal over REFUSAL_BYTES (§3.1): the
  // store refuses the frame; the worker never emits it.
  cursor: { W4: PROTOCOL },
  // A failed worker reply whose cause or log is outside its set (§8, C1): the
  // job pauses with this code; there is no HTTP status.
  reply: { C1: { code: 'READER_PROTOCOL' } },
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
// The store's canonical() (reader_job_store.js:52-59): sorted keys, no whitespace.
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
// F1: arrays, well-formed strings, booleans, null and safe integers; nothing else.
function isEntry(v) {
  if (v === null || typeof v === 'boolean') return true;
  if (typeof v === 'string') return v.isWellFormed();
  if (typeof v === 'number') return Number.isSafeInteger(v);
  if (Array.isArray(v)) return v.every(isEntry);
  return false;
}
const isPair = (v) => Array.isArray(v) && v.length === 2 && v.every(Number.isSafeInteger);
// A group's line pair is two different lines: a key within one line never forms a group.
const isLinePair = (v) => isPair(v) && v[0] < v[1];
const cmpPair = (a, b) => a[0] - b[0] || a[1] - b[1];
const emptyLog = (log) => ({ head: null, segments: 0, count: 0, digest: d0(DOMAIN.log(log)) });
const sumBytes = (entries) => entries.reduce((n, e) => n + size(e), 0);
const segmentBytes = (segment) => Buffer.from(JSON.stringify(segment), 'utf8');

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
function cursorShape(cursor, epoch, bad) {
  const cd = cursor.discovery;
  if (cursor.contract_version !== 2) bad('W4', 'cursor contract_version is 2');
  if (!plainObject(cd) || cd.version !== 1 || !plainObject(cd.logs)) {
    bad('W4', 'cursor.discovery shape');
    return;
  }
  for (const [log, st] of Object.entries(cd.logs)) {
    if (!LOGS.includes(log)) bad('W1', `unknown log ${log}`);
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
  if (!plainObject(g) || !(g.through === null || isLinePair(g.through))) bad('W4', 'groups shape');
  else if (g.current !== null) {
    if (!plainObject(g.current) || !isLinePair(g.current.lines) || !Array.isArray(g.current.keys))
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
      (plainObject(inv) && Number.isSafeInteger(inv.count) && HEX.test(inv.digest || ''))
    )
  )
    bad('W4', 'inventory shape');
  const w = cursor.witness;
  if (
    !(
      w === null ||
      (plainObject(w) &&
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
    // REFUSAL_BYTES (§3.1): a refusal's detail can grow with the input.
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
    logs[log] = { head: address, segments: st.segments + 1, count: st.count + n, digest: after };
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
// The worker, before it emits a frame that passes the cap: it names the log
// whose append passes it. A fixture frame grows exactly one membership log.
function workerMembershipRefusal(record, frame) {
  const before = (log) =>
    (record.discovery.logs[log]?.count ?? 0) +
    (record.cursor.discovery.logs[log]?.tail.length ?? 0);
  const after = (log) =>
    (record.discovery.logs[log]?.count ?? 0) + (frame.cursor.discovery.logs[log]?.tail.length ?? 0);
  const grew = MEMBERSHIP_LOGS.filter((log) => after(log) > before(log));
  assert.equal(grew.length, 1, 'a membership fixture frame grows one log');
  const total = MEMBERSHIP_LOGS.reduce((n, log) => n + after(log), 0);
  return total > LIMITS.MEMBERSHIP_ENTRIES
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
// its address.
function storeOf(rel, omit = [], corrupt = []) {
  const store = new Map();
  for (const result of replay(load(rel)))
    for (const s of result.segments) if (!omit.includes(s.address)) store.set(s.address, s.raw);
  for (const { address, at, byte } of corrupt) {
    const raw = Buffer.from(store.get(address));
    assert.notEqual(raw[at], byte, 'a corruption changes the byte');
    raw[at] = byte;
    store.set(address, raw);
  }
  return store;
}

// ---------------------------------------------------------------- resume path (§5)
function evaluateResume(fx) {
  const violations = [];
  const skipped = [];
  const bad = (rule, detail) => violations.push({ rule, detail });
  const store = storeOf(fx.store.segments_from, fx.store.omit);
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
      // F6, F3, F1/F2, F4 bounds, F5 on every segment that resolves
      if (sha(raw) !== stem) bad('F6', `${stem} does not match its address`);
      const seg = JSON.parse(raw.toString('utf8'));
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
      for (const e of seg.entries) {
        if (!isEntry(e)) bad('F1', stem);
        else if (size(e) > LIMITS.ENTRY_BYTES) bad('F2', stem);
      }
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
const RESUME_RULES = ['R1', 'R2', 'R3', 'R4', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6'];

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
  const store = storeOf(fx.store.segments_from, fx.store.omit, fx.store.corrupt);
  const rd = discovery;
  const stat = [];
  const read = [];
  const verified = {};
  const paths = {};
  const addresses = {};
  // One segment read by address: F6, then F3. Null when it is missing.
  const get = (log, address) => {
    const raw = store.get(address);
    if (!raw) {
      bad('missing', `${log}: ${address} is missing`, log);
      return null;
    }
    read.push(address);
    if (sha(raw) !== address) bad('F6', `${address} does not match its address`, log);
    const seg = JSON.parse(raw.toString('utf8'));
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
    digest: seg.digest_after,
  });
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
    for (const address of list.slice(v.segments)) {
      const seg = get(log, address);
      if (!seg) break;
      if (!links(at, seg))
        bad(junction ? 'R5' : 'R2', `${log}: ${address} does not continue ${at.head}`, log);
      junction = false;
      at = next(at, address, seg);
    }
    if (canonical(at) !== canonical(st))
      bad('R2', `${log}: the walk does not end at the head`, log);
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
  const withHead = (log, count) => ({
    head: sha(`head ${log}`),
    segments: Math.max(1, Math.ceil(count / LIMITS.SEGMENT_ENTRIES)),
    count,
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
  // or reversed for a same-rule schema (analysis.py:1079).
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
// (analysis.py:218-256) resolves them; any defect is an error.
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
// The three incomplete-search reasons (analysis.py:716, :958, :1036), as
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
// The largest cursor outside discovery and continuation that §3.1's inputs
// allow: every integer at 2^53 - 1, every method at its fullest with a refusal
// of exactly REFUSAL_BYTES, an incomplete reason for every schema, every schema
// refused, and the widest witness.
function largestCursor(inp) {
  const id = (i) => `shared_sound:${sha(`method ${i}`)}`.slice(0, inp.method_id_bytes);
  const name = (i) =>
    `schema_${i}_${'n'.repeat(inp.schema_name_bytes)}`.slice(0, inp.schema_name_bytes);
  const refusal = { capability: '', detail: '', kind: '', missing: [], schema: '', vacuous: [] };
  refusal.detail = 'x'.repeat(inp.refusal_bytes - cbytes(refusal));
  const I = inp.integer;
  const entry = {
    candidates: I,
    coverage: 'answered',
    false: I,
    figure_counts: { false: I, true: I, undecided: I },
    first_reading_only: I,
    refusal,
    refused_questions: I,
    true: I,
    undecided: I,
    unreadable_tokens: I,
  };
  const names = Array.from({ length: inp.schemas }, (_, i) => name(i));
  return {
    contract_version: 2,
    identity_hash: 'f'.repeat(64),
    phase: inp.phase,
    method_index: I,
    candidate: I,
    emission: I,
    sequence: I,
    counters: { candidates: I, evidence_records: I, true: I, false: I, undecided: I },
    methods: Object.fromEntries(
      Array.from({ length: inp.methods }, (_, i) => [id(i), clone(entry)])
    ),
    done: false,
    incomplete: Object.fromEntries(names.map((n) => [n, inp.incomplete_reason])),
    refused_schemas: names,
    witness: {
      version: 1,
      epoch: I,
      method_id: id(0),
      fields: Array.from({ length: inp.witness_fields }, () => 'a'.repeat(inp.witness_field_bytes)),
      count: I,
      digest: 'f'.repeat(64),
    },
  };
}
// Padding past the largest cursor: methods the registry does not have,
// `pad:<k>` holding {candidates: 0}, then one whose name is cut to make the
// size exact.
function padTo(cursor, target) {
  const c = clone(cursor);
  let k = 0;
  while (target - cbytes(c) >= 64) c.methods[`pad:${k++}`] = { candidates: 0 };
  const key = (n) => `pad:${'z'.repeat(n)}`;
  c.methods[key(0)] = { candidates: 0 };
  const n = target - cbytes(c);
  delete c.methods[key(0)];
  c.methods[key(n)] = { candidates: 0 };
  return c;
}
function cursorCase(inp, name) {
  const largest = largestCursor(inp);
  if (name === 'largest') return largest;
  if (name === 'at_the_bound') return padTo(largest, LIMITS.CURSOR_BYTES);
  if (name === 'one_byte_over') return padTo(largest, LIMITS.CURSOR_BYTES + 1);
  if (name === 'refusal_one_byte_over') {
    const c = clone(largest);
    c.methods[Object.keys(c.methods)[0]].refusal.detail += 'x';
    return c;
  }
  assert.fail(`unknown cursor case ${name}`);
}
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
// The worker, before it emits: a refusal past REFUSAL_BYTES is RESOURCE_LIMIT
// (its detail can grow with the input); a cursor past CURSOR_BYTES is then an
// engine defect, because only content no constant allows gets it there.
function workerCursorRefusal(rest) {
  for (const counts of Object.values(rest.methods))
    if (counts.refusal && cbytes(counts.refusal) > LIMITS.REFUSAL_BYTES)
      return { code: 'RESOURCE_LIMIT', cause: 'cursor_refusal_bytes' };
  if (cbytes(rest) > LIMITS.CURSOR_BYTES) return { code: 'INVARIANT_FAILURE' };
  return null;
}

// ---------------------------------------------------------------- the reply boundary (§8, C1)
function echo(v) {
  if (v === undefined || v === null) return null;
  let text = typeof v === 'string' ? v : JSON.stringify(v);
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
    # The phases a cursor names: each task's phase, and "complete" (analysis.py:2457).
    "phases": sorted(set(re.findall(r'self\\.tasks\\.append\\(\\("(\\w+)",', src))
                     | set(re.findall(r'self\\.tasks = \\[\\("(\\w+)",', src))
                     | set(re.findall(r'if i < len\\(self\\.tasks\\) else "(\\w+)"', src))),
    # The values a method's coverage takes.
    "coverage": sorted(set(re.findall(r'counts\\["coverage"\\] = "(\\w+)"', src))
                       | set(re.findall(r'counts\\.get\\("coverage", "(\\w+)"\\)', src))),
    # The cursor's counters (analysis.py:470).
    "counters": re.findall(r'"(\\w+)": 0', re.search(r'"counters": \\{(.*?)\\}', src, re.S).group(1)),
}
# The fields the domain reducer reads (analysis.py:1466-1479): the witness
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
  cursor_over_bound: 'W4',
  cursor_record_disagreement: 'W4',
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
  reset_unheld_log: 'W3',
  retired_key_recurring: 'S1',
  segment_corrupt_at_reconciliation: 'F6',
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
      for (const m of fx.mutants) {
        const before = clone(m.record);
        const { r, n } = held(m);
        assert.deepEqual(m.record, before, `${m.name}: nothing is written`);
        assert.equal(n, LIMITS.MEMBERSHIP_ENTRIES + 1, `${m.name} is one past the cap`);
        assert.deepEqual(workerMembershipRefusal(m.record, m.frame), m.worker, m.name);
        assert.equal(m.worker.cause, `discovery_${m.log}`);
        violations.push(...r.violations);
      }
      assert.deepEqual(
        fx.mutants.map((m) => m.log).sort(),
        [...MEMBERSHIP_LOGS].sort(),
        'a cause for each membership log'
      );
      // Each control reaches the cap exactly, and is accepted.
      for (const c of fx.controls) {
        const { r, n } = held(c);
        assert.deepEqual(r.violations, [], `control ${c.name}`);
        assert.equal(n, LIMITS.MEMBERSHIP_ENTRIES, `${c.name} is at the cap`);
        assert.equal(workerMembershipRefusal(c.record, c.frame), null, `${c.name}: emitted`);
      }
      assert.deepEqual(
        fx.controls.map((c) => c.log).sort(),
        [...MEMBERSHIP_LOGS].sort(),
        'an at-cap control for each membership log'
      );
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
      assert.equal(fx.expect.logged, 'error');
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
      for (const c of fx.controls) {
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
      assert.deepEqual(
        [got.read, got.saved],
        [[], false],
        'refused before any read; nothing saved'
      );
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
  // §8's Log column, for both cause sets, is the one C1 checks.
  for (const [rows, col] of [
    [causes, 3],
    [resource, 2],
  ])
    for (const r of rows)
      assert.equal(r[col], CAUSE_LOG[r[0].replace(/`/g, '')], `§8's log rule for ${r[0]}`);
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
  assert.ok(section('4. Write path').includes('**W7, the membership cap.**'), '§4 states W7');
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
  // BB8's figure: the room left with #656's own seen and variants loaded as a
  // further fixed term, as 8732918312 computed it.
  const own = 20045;
  const bb8 = Math.floor((30 - fixed - own * rate) / rate);
  assert.equal(bb8, 81895, "BB8's about 81,895 entries");
  const pow2 = (x) => 2 ** Math.floor(Math.log2(x));
  assert.equal(pow2(bb8), LIMITS.MEMBERSHIP_ENTRIES, '81,895 rounded down to a power of two');
  for (const x of [room, withMargin])
    assert.equal(pow2(x), LIMITS.MEMBERSHIP_ENTRIES, `${x} rounds down to the same power`);
  const atCap = LIMITS.MEMBERSHIP_ENTRIES * rate;
  assert.ok(fixed + atCap <= 29, "the margin holds the first step's 1 s deadline");
  // #656 is expected to fit: its seen and variants are 20,045 entries, with
  // about 45k left. 16,384, the retracted every-term figure, would not hold them.
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
  const n = (x) => x.toLocaleString('en-US');
  for (const stated of [
    '6682942783',
    '91.2 µs',
    `| construct | ${s1(construct)} | measured on #656, loaded host (§10), not scaled |`,
    `| recompute | ${s1(recompute)} | measured on #656, loaded host (§10), not scaled |`,
    s(walk),
    s(fixed),
    s(own * rate),
    s(fixed + own * rate),
    s(30 - fixed - own * rate),
    n(bb8),
    s(30 - fixed),
    n(room),
    n(withMargin),
    s(atCap),
    s(fixed + atCap),
    s(30 - fixed - atCap),
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
    assert.ok(text.includes(stated), `§6.11 states ${stated}`);
  // The retracted rule survives only as history (BB8 6682942783).
  assert.ok(!text.includes('Every term is at the loaded-host factor'));
  assert.ok(!text.includes('× 3 = 19.2 s') && !text.includes('× 3 = 2.7 s'));
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
  const text = section('3. Hard limits').split('### 3.1')[1];
  for (const stated of [
    `${n(parts.methods)}: ${inp.methods} entries of ${n(perMethod)} bytes each`,
    `| \`incomplete\` | ${n(parts.incomplete)} |`,
    `| \`refused_schemas\` | ${n(parts.refused)} |`,
    `| \`witness\` | ${n(parts.witness)} |`,
    `| the envelope and its separators | ${envelope} |`,
    `| the largest cursor | ${n(total)} |`,
    `\`CURSOR_BYTES = ${LIMITS.CURSOR_BYTES}\``,
    `${n(margin)} bytes above the largest cursor`,
    `room\n  for ${Math.floor(margin / perMethod)} more methods`,
    `\`REFUSAL_BYTES = ${LIMITS.REFUSAL_BYTES}\``,
    `at most ${inp.methods}, each key at most ${inp.method_id_bytes} bytes`,
    `the ${inp.schemas} schema names, each at most ${inp.schema_name_bytes} bytes`,
    `the longest is ${Buffer.byteLength(inp.incomplete_reason)} bytes (${Buffer.byteLength(canonical(inp.incomplete_reason))} canonical): "${inp.incomplete_reason}"`,
  ])
    assert.ok(text.includes(stated), `§3.1 states ${stated}`);
  assert.ok(
    section('3. Hard limits').includes(
      `the largest cursor the constants allow is ${n(total)} bytes`
    ),
    "§3's table cites the largest cursor"
  );
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
