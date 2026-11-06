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
});
const LOGS = ['seen', 'row_seen', 'variants', 'alt_cells', 'alt_seen'];
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
  'chain_broken',
  'digest_mismatch',
  'cursor_disagrees',
  'inventory_mismatch',
  'retired_key_recurred',
];
const DOMAIN = Object.freeze({
  log: (log) => `codexmusica.reader.discovery.v1\n${log}`,
  inventory: 'codexmusica.reader.inventory.v1\n',
  witness: (method) => `codexmusica.reader.witness.v1\n${method}`,
});
const WITNESS_FIELDS_V1 = ['method_id', 'id', 'verdict', 'a.token_ids', 'b.token_ids'];
// §8: the refusal each rule raises, on the side a fixture of that kind models.
const PROTOCOL = { code: 'READER_PROTOCOL', status: 400 };
const unavailable = (cause) => ({ code: 'DISCOVERY_UNAVAILABLE', status: 409, cause });
const REFUSAL = {
  write: Object.fromEntries(
    ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'W1', 'W2', 'W3', 'W4', 'W5', 'W6'].map((r) => [
      r,
      PROTOCOL,
    ])
  ),
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
};
const HEX = /^[a-f0-9]{64}$/;

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
const refusalText = (r) => `${r.code} ${r.status}${r.cause ? ` ${r.cause}` : ''}`;

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
  if (!plainObject(g) || !(g.through === null || isPair(g.through))) bad('W4', 'groups shape');
  else if (g.current !== null) {
    if (!plainObject(g.current) || !isPair(g.current.lines) || !Array.isArray(g.current.keys))
      bad('W4', 'current group shape');
    else if (
      g.current.keys.length > LIMITS.GROUP_KEYS ||
      sumBytes(g.current.keys.filter(isEntry)) > LIMITS.GROUP_BYTES
    )
      bad('W4', 'current group over its bound');
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
        w.fields.every((f) => typeof f === 'string' && Buffer.byteLength(f) <= 64) &&
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
  (fd.seals || []).forEach((s, i) => {
    if (!LOGS.includes(s.log) || !Array.isArray(s.entries)) return;
    const log = s.log;
    const st = (logs[log] ??= emptyLog(log));
    if (s.first !== st.count) bad('W3', `seal ${i} first ${s.first} against count ${st.count}`);
    if (s.digest_before !== st.digest) bad('W3', `seal ${i} digest_before`);
    if (HEX.test(s.digest_before || '') && fold(s.digest_before, s.entries) !== s.digest_after)
      bad('F5', `seal ${i} digest_after does not recompute`);
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
    if (st.sealed_digest !== logs[log].digest) bad('W4', `${log} sealed_digest`);
  }
  if (
    pc?.discovery &&
    pc.discovery.epoch === epoch &&
    pc.discovery.inventory != null &&
    canonical(pc.discovery.inventory) !== canonical(cd.inventory)
  )
    bad('W4', 'the inventory changed within its epoch');
  return {
    violations,
    discovery: { version: 1, epoch, logs, unavailable: null },
    segments,
    released,
  };
}
const WRITE_RULES = ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'W1', 'W2', 'W3', 'W4', 'W5', 'W6'];

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
// Every segment the seal sequence builds, by address.
function storeOf(rel, omit = []) {
  const store = new Map();
  for (const result of replay(load(rel)))
    for (const s of result.segments) if (!omit.includes(s.address)) store.set(s.address, s.raw);
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

// ---------------------------------------------------------------- groups (§6.4, S1)
function runGroups(fx) {
  const violations = [];
  const bad = (rule, detail, extra = {}) => violations.push({ rule, detail, ...extra });
  let state = clone(fx.state);
  const alt = () => state.discovery.logs.alt_seen;
  const member = (list, key) => list.some((k) => canonical(k) === canonical(key));
  assert.equal(alt().sealed, 0, 'a groups fixture starts with alt_seen wholly in its tail');
  const outcomes = [];
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
    const g = state.discovery.groups;
    if (ev.op === 'key') {
      if (!isEntry(ev.key)) bad('F1', `event ${i}`);
      else if (size(ev.key) > LIMITS.ENTRY_BYTES) bad('F2', `event ${i}`);
      assert.equal(
        state.continuation.pending,
        null,
        `event ${i}: a key arrives only between bindings`
      );
      const L = ev.lines;
      let result;
      if (L[0] === L[1]) {
        if (g.current && cmpPair(L, g.current.lines) > 0) retire();
        if (member(alt().tail, ev.key)) result = 'duplicate';
        else {
          alt().tail.push(ev.key);
          result = 'new';
        }
      } else if (g.current && cmpPair(L, g.current.lines) === 0) {
        if (member(g.current.keys, ev.key) || member(alt().tail, ev.key)) result = 'duplicate';
        else if (
          g.current.keys.length < LIMITS.GROUP_KEYS &&
          sumBytes(g.current.keys) + size(ev.key) <= LIMITS.GROUP_BYTES
        ) {
          g.current.keys.push(ev.key);
          result = 'new';
        } else {
          alt().tail.push(ev.key);
          result = 'new';
        }
      } else {
        const position = g.current ? g.current.lines : g.through;
        if (position && cmpPair(L, position) <= 0) {
          bad('S1', `event ${i}: line pair ${L} at or before ${position}`, {
            cause: 'retired_key_recurred',
            at_event: i,
          });
          outcomes.push('refused');
          assert.equal('refused', ev.expect, `event ${i} is the expected refusal`);
          break;
        }
        if (g.current) retire();
        state.discovery.groups.current = { lines: L, keys: [ev.key] };
        result = 'new';
      }
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
function evaluateWitness(fx) {
  const violations = [];
  const bad = (rule, detail) => violations.push({ rule, detail });
  const w = fx.cursor.witness;
  for (const r of fx.durable_records)
    assert.equal(r.method_id, w.method_id, 'durable_records is one method stream');
  for (const t of tuplesOf(fx.durable_records, w.fields))
    if (!isEntry(t)) bad('F1', 'witness tuple');
  const got = witnessOf(w.method_id, w.fields, fx.durable_records);
  if (got.count !== w.count || got.digest !== w.digest) bad('S2', 'witness');
  return { violations, got };
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
  assert.equal(text['  '], '"  "');
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
  for (const rel of ['good/seal_sequence_two_logs.json', 'good/epoch_jump.json'])
    for (const r of replay(load(rel))) for (const s of r.segments) segments.push(s.raw);
  const py = python({
    vectors: entries,
    domain: fx.vector_chain.domain,
    segments: segments.map((b) => b.toString('utf8')),
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
});

test('the cut rule: boundaries depend only on entry sizes', () => {
  const fx = load('good/seal_sequence_two_logs.json');
  for (const v of fx.cut_vectors) {
    const lengths = v.runs.flatMap(([bytes, times]) => Array(times).fill(bytes));
    assert.ok(lengths.every((b) => b >= 1 && b <= LIMITS.ENTRY_BYTES));
    assert.deepEqual(cut(lengths), { segments: v.segments, tail: v.tail }, JSON.stringify(v.runs));
  }
});

for (const rel of ['good/seal_sequence_two_logs.json', 'good/epoch_jump.json'])
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
        const lengths = s.segment.entries.map(size);
        assert.deepEqual(
          cut(lengths).segments[0],
          [0, s.segment.count],
          'F4: the seal is one greedy segment'
        );
      }
    });
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
  // A full cursor v2: today's fields stay, the flags are in `incomplete` (BB8 6).
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
});

test('good/retired_group_then_within_line.json: retirement, within-line keys and a pending binding', () => {
  const fx = load('good/retired_group_then_within_line.json');
  const { violations, state } = runGroups(fx);
  assert.deepEqual(violations, []);
  assert.deepEqual(state, fx.expect.state);
  assert.equal(state.discovery.logs.alt_seen.sealed_digest, d0(DOMAIN.log('alt_seen')));
});

test('good/witness_cursor_option2.json: the witness sits in cursor v2 and recomputes', () => {
  const fx = load('good/witness_cursor_option2.json');
  const { violations, got } = evaluateWitness(fx);
  assert.deepEqual(violations, []);
  assert.equal(got.count, fx.expect.count);
  const c = fx.cursor;
  const w = c.witness;
  assert.deepEqual(w.fields, WITNESS_FIELDS_V1, 'the v1 fields');
  assert.equal(w.epoch, c.method_index, 'the witness belongs to the current epoch');
  const bad = [];
  cursorShape(c, c.method_index, (rule, detail) => bad.push({ rule, detail }));
  assert.deepEqual(bad, []);
  for (const key of ['stage', 'position', 'row', 'pending', 'shared_sound'])
    assert.ok(Object.hasOwn(c.continuation, key), `continuation names ${key}`);
  // Multiplicity: deduplicating by id gives a different witness.
  const ids = new Set();
  const dedup = fx.durable_records.filter((r) => !ids.has(r.id) && ids.add(r.id));
  assert.ok(dedup.length < fx.durable_records.length, 'the stream repeats an id');
  assert.notEqual(witnessOf(w.method_id, w.fields, dedup).digest, w.digest);
  // Durable history only: folding in the local tail changes it.
  const overlap = fx.local_records.filter((r) =>
    fx.durable_records.some((d) => canonical(d) === canonical(r))
  );
  assert.ok(overlap.length >= 1, 'the local tail overlaps durable history');
  assert.notEqual(
    witnessOf(w.method_id, w.fields, [...fx.durable_records, ...fx.local_records]).digest,
    w.digest
  );
  // Roles: swapping one record's endpoints changes it.
  const swapped = clone(fx.durable_records);
  [swapped[0].a, swapped[0].b] = [swapped[0].b, swapped[0].a];
  assert.notEqual(witnessOf(w.method_id, w.fields, swapped).digest, w.digest);
  // Ineligible records are still covered: dropping one changes it.
  assert.notEqual(
    witnessOf(w.method_id, w.fields, fx.durable_records.slice(0, -1)).digest,
    w.digest
  );
});

for (const rel of fixtureFiles().filter((f) => f.startsWith('bad/')))
  test(`${rel}: violates exactly its rule`, () => {
    const fx = load(rel);
    let violations;
    if (fx.kind === 'write') {
      assert.equal(fx.frames.length, 1, 'a bad write fixture is one frame');
      const before = clone(fx.record);
      violations = evaluateFrame(fx, fx.record, fx.frames[0]).violations;
      assert.deepEqual(fx.record, before, 'nothing is written');
      assert.equal(fx.expect.written, 'nothing');
    } else if (fx.kind === 'resume') {
      violations = evaluateResume(fx).violations;
      if (fx.expect.store_outside_reconciliation)
        assert.deepEqual(fx.expect.store_outside_reconciliation, {
          code: 'STORAGE_CORRUPT',
          status: 503,
        });
    } else if (fx.kind === 'groups') {
      violations = runGroups(fx).violations;
      assert.equal(violations.at(-1)?.at_event, fx.expect.at_event, 'refused at the named event');
      assert.equal(violations.at(-1)?.cause, fx.expect.cause);
    } else assert.fail(`unknown kind ${fx.kind}`);
    assert.deepEqual(
      [...new Set(violations.map((v) => v.rule))],
      [fx.expect.rule],
      JSON.stringify(violations)
    );
  });

test('the bad fixtures each name a different rule, and the named ones are all present', () => {
  const bad = fixtureFiles().filter((f) => f.startsWith('bad/'));
  const rules = bad.map((f) => load(f).expect.rule);
  assert.equal(new Set(rules).size, rules.length);
  assert.deepEqual(bad.map((f) => path.basename(f, '.json')).sort(), [
    'changed_digest_after',
    'cursor_record_disagreement',
    'epoch_backwards',
    'missing_segment',
    'over_bound_seal',
    'reordered_segment',
    'retired_key_recurring',
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
  const causes = tableRows(section('8. Refusals').split('The causes:')[1].split('Plumbing')[0]);
  assert.deepEqual(
    causes.map((r) => r[0].replace(/`/g, '')),
    CAUSES
  );
  for (const [rule, refusal] of Object.entries({ ...REFUSAL.resume, ...REFUSAL.groups }))
    if (refusal.cause)
      assert.ok(
        causes.some((r) => r[0] === `\`${refusal.cause}\`` && r[1].split(/[ ,]+/).includes(rule)),
        `§8 maps ${rule} to ${refusal.cause}`
      );
  assert.ok(
    CONTRACT.includes(JSON.stringify(WITNESS_FIELDS_V1).replace(/,/g, ', ')),
    'the v1 witness fields'
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
