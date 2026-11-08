// Persisted discovery v1 (#656): the constants, tables and pure codec the
// store and the scheduler share. mcp/DISCOVERY_V1.md is the contract; every
// value here is held to its text by mcp/test_reader_discovery.mjs, and the
// fixture validator (mcp/test_discovery_v1_fixtures.mjs) stays an independent
// reading that imports nothing from this file.
//
// Nothing here touches the disk, a clock or randomness, and nothing raises a
// public code: the codec throws or returns a local error tagged with its rule
// (F1, F2, F4, INTEGER_FIELD, or a segment's content fault), and the enclosing
// operation maps the tag (§2.11).
import { Buffer } from 'node:buffer';
import crypto from 'node:crypto';

// §3. ENTRY_DEPTH and MEMBERSHIP_BYTES are provisional until the #721 author
// declares the entry shapes (§2.1, §12 item 31): a declared depth of 5 or more
// re-derives both, here and in the contract together.
export const DISCOVERY_LIMITS = Object.freeze({
  ENTRY_BYTES: 4096,
  ENTRY_DEPTH: 8,
  SEGMENT_ENTRIES: 1024,
  SEGMENT_BYTES: 16384,
  FRAME_SEALS: 8,
  CHAIN_SEGMENTS: 2048,
  MEMBERSHIP_ENTRIES: 65536,
  MEMBERSHIP_BYTES: 4194304,
  GROUP_KEYS: 32,
  GROUP_BYTES: 8192,
  WITNESS_FIELDS: 16,
  CONTINUATION_BYTES: 8192,
  REFUSAL_BYTES: 543,
  CURSOR_BYTES: 131072,
});

// §2.3: the closed set of logs, in the contract's order.
export const LOGS = Object.freeze(['seen', 'row_seen', 'variants', 'alt_cells', 'alt_seen']);
// §2.6: only row_seen restarts inside an epoch.
export const RESETTABLE = Object.freeze(['row_seen']);
// §1, §3: the four logs held together to MEMBERSHIP_ENTRIES and MEMBERSHIP_BYTES.
export const MEMBERSHIP_LOGS = Object.freeze(['seen', 'variants', 'row_seen', 'alt_seen']);
// §2.8: the terminal inputs cursor v2 keeps out of methods[*].
export const TERMINAL_INPUTS = Object.freeze(['domain_true', 'domain_undecided', 'alt_cells']);

// §2.2: the three F5 domains.
export const DOMAINS = Object.freeze({
  log: (log) => `codexmusica.reader.discovery.v1\n${log}`,
  inventory: 'codexmusica.reader.inventory.v1\n',
  witness: (method) => `codexmusica.reader.witness.v1\n${method}`,
});

// §2.5: a segment's fields, in the order its address is computed over.
export const SEGMENT_FIELDS = Object.freeze([
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
]);
export const SEGMENT_KIND = 'reader_discovery_segment';

const RESUME_MESSAGE = (what) =>
  `This analysis can no longer resume exactly: part of its saved progress ${what}. Its committed evidence stays readable. Delete it, then create a new analysis with a new key.`;
const STOPPED = (what) => `This analysis stopped: ${what} Its committed evidence stays readable.`;
const RELOAD = (what) => STOPPED(`${what} than a resume can reload in time.`);

// §8: the DISCOVERY_UNAVAILABLE causes, with the rule each names, its Log
// column (whether a reply's error_log is required, optional or none) and its
// message.
export const DISCOVERY_CAUSES = Object.freeze({
  segment_missing: Object.freeze({
    rule: 'R1',
    log: 'required',
    message: RESUME_MESSAGE('is missing'),
  }),
  segment_corrupt: Object.freeze({
    rule: 'F6 at a full read',
    log: 'required',
    message: RESUME_MESSAGE('is damaged'),
  }),
  chain_broken: Object.freeze({
    rule: 'R2, F3 at read',
    log: 'required',
    message: RESUME_MESSAGE('does not fit together'),
  }),
  digest_mismatch: Object.freeze({
    rule: 'F5 at read',
    log: 'required',
    message: RESUME_MESSAGE('does not match its record'),
  }),
  cursor_disagrees: Object.freeze({
    rule: 'R3',
    log: 'optional',
    message: RESUME_MESSAGE('does not match its record'),
  }),
  inventory_mismatch: Object.freeze({
    rule: 'R4',
    log: 'none',
    message: RESUME_MESSAGE('does not match its record'),
  }),
  retired_key_recurred: Object.freeze({
    rule: 'S1',
    log: 'none',
    message:
      'This analysis cannot continue exactly: its search met a line pair it had already finished. Its committed evidence stays readable. A new analysis of the same text would stop at the same place.',
  }),
});
// segment_corrupt is the store's alone (BB8 6681838131): a worker never names it.
export const STORE_CAUSES = Object.freeze(['segment_corrupt']);
export const WORKER_CAUSES = Object.freeze(
  Object.keys(DISCOVERY_CAUSES).filter((cause) => !STORE_CAUSES.includes(cause))
);

// §8: the RESOURCE_LIMIT causes, one for each §3 limit the worker cannot meet
// and one for each other raise the reader reaches.
export const RESOURCE_CAUSES = Object.freeze({
  discovery_entry_bytes: Object.freeze({
    log: 'required',
    message: STOPPED('one piece of its saved progress is larger than the format allows.'),
  }),
  discovery_frame_seals: Object.freeze({
    log: 'none',
    message: STOPPED(
      'one step of its search needs more saved progress than one checkpoint can carry.'
    ),
  }),
  discovery_chain_segments: Object.freeze({
    log: 'required',
    message: STOPPED("its saved progress grew past the format's limit."),
  }),
  discovery_seen: Object.freeze({
    log: 'none',
    message: RELOAD("its search of the text's own readings kept more pairs"),
  }),
  discovery_variants: Object.freeze({
    log: 'none',
    message: RELOAD('it prepared more reading variants'),
  }),
  discovery_row_seen: Object.freeze({
    log: 'none',
    message: RELOAD('its search kept more row pairs'),
  }),
  discovery_alt_seen: Object.freeze({
    log: 'none',
    message: RELOAD('its search of alternate readings kept more pairs'),
  }),
  resident_capacity: Object.freeze({
    log: 'none',
    message: STOPPED(
      'it needs more memory than this reader may use. No source or comparison was skipped.'
    ),
  }),
  declared_coordinate_bits: Object.freeze({
    log: 'none',
    message: STOPPED(
      'a declared beat or meter position is larger than the reader can compute with.'
    ),
  }),
  expansion_budget: Object.freeze({
    log: 'none',
    message: STOPPED(
      'a declared meter or beat pattern expands to more positions than the reader can compute with.'
    ),
  }),
});

// §8's message for a stored reason that names a cause, or null when the code
// or the cause is not one of §8's (the caller keeps the reason's own message).
export function causeMessage(reason) {
  const table =
    reason?.code === 'DISCOVERY_UNAVAILABLE'
      ? DISCOVERY_CAUSES
      : reason?.code === 'RESOURCE_LIMIT'
        ? RESOURCE_CAUSES
        : null;
  if (!table || typeof reason.cause !== 'string' || !Object.hasOwn(table, reason.cause))
    return null;
  return table[reason.cause].message;
}

// The codec's local error: a rule tag and, for F1, §3's <what>. Never a code.
export class DiscoveryCodecError extends Error {
  constructor(rule, what = null, detail = {}) {
    super(what ? `${rule}: ${what}` : rule);
    this.name = 'DiscoveryCodecError';
    this.rule = rule;
    this.what = what;
    Object.assign(this, detail);
  }
}

// §3's <what> for each way an entry breaks F1.
export const F1_WHAT = Object.freeze({
  float: 'a float',
  nonfinite: 'a nonfinite number',
  object: 'an object',
  integer: 'an integer past 2⁵³ − 1',
  surrogate: 'a lone surrogate',
  cyclic: 'a cyclic array',
  depth: `a nesting depth past ENTRY_DEPTH (${DISCOVERY_LIMITS.ENTRY_DEPTH})`,
  other: 'a value of another type',
});

function numberWhat(v) {
  if (!Number.isFinite(v)) return F1_WHAT.nonfinite;
  return Number.isInteger(v) ? F1_WHAT.integer : F1_WHAT.float;
}

// F1's walk (§2.1): arrays, well-formed strings, booleans, null and safe
// integers, at most ENTRY_DEPTH arrays deep. It serialises nothing, and keeps
// an explicit stack of iterators rather than recursing, so its memory follows
// the depth, not an array's width. Returns null or §3's <what>.
function f1Fault(entry) {
  const visit = (v) => {
    if (v === null || typeof v === 'boolean') return null;
    if (typeof v === 'string') return v.isWellFormed() ? null : F1_WHAT.surrogate;
    if (typeof v === 'number') return Number.isSafeInteger(v) ? null : numberWhat(v);
    if (Array.isArray(v))
      return Object.getPrototypeOf(v) === Array.prototype ? 'array' : F1_WHAT.other;
    if (typeof v === 'object') return F1_WHAT.object;
    return F1_WHAT.other;
  };
  const first = visit(entry);
  if (first !== 'array') return first;
  const open = new Set([entry]);
  const stack = [{ array: entry, i: 0 }];
  while (stack.length) {
    const top = stack.at(-1);
    if (top.i >= top.array.length) {
      open.delete(top.array);
      stack.pop();
      continue;
    }
    const i = top.i++;
    // A hole in a sparse array is no value of the subset.
    if (!Object.hasOwn(top.array, i)) return F1_WHAT.other;
    const v = top.array[i];
    const what = visit(v);
    if (what === null) continue;
    if (what !== 'array') return what;
    if (open.has(v)) return F1_WHAT.cyclic;
    if (stack.length >= DISCOVERY_LIMITS.ENTRY_DEPTH) return F1_WHAT.depth;
    open.add(v);
    stack.push({ array: v, i: 0 });
  }
  return null;
}

// F1 then F2 on one entry (§2.1, §2.11). Returns its canonical form and that
// form's UTF-8 byte length, or throws a DiscoveryCodecError tagged F1 (with
// §3's <what>) or F2. F2 is measured on the canonical form, however the entry
// was spaced on the wire. An entry breaking both is tagged F1, because the F1
// walk runs first: the order the worker's emit pins (§2.11 (d)). Node's own
// tag is not pinned (§2.11 (d)); only the worker's emit is. The store maps
// either tag to READER_PROTOCOL.
export function checkEntry(entry) {
  const what = f1Fault(entry);
  if (what) throw new DiscoveryCodecError('F1', what);
  const canonical = JSON.stringify(entry);
  const bytes = Buffer.byteLength(canonical, 'utf8');
  if (bytes > DISCOVERY_LIMITS.ENTRY_BYTES) throw new DiscoveryCodecError('F2', null, { bytes });
  return { canonical, bytes };
}

// An integer-only field outside the entries (§2.11): a frame's epoch, a
// seal's first, a cursor number, a segment's epoch, first or count. Returns
// the value, or throws INTEGER_FIELD naming the field; F1 stays the entries'.
export function requireInteger(value, field = null) {
  if (Number.isSafeInteger(value) && value >= 0) return value;
  throw new DiscoveryCodecError('INTEGER_FIELD', null, { field });
}

const HEX = /^[0-9a-f]{64}$/;
export const isDigest = (v) => typeof v === 'string' && HEX.test(v);
const sha256 = (...parts) => {
  const h = crypto.createHash('sha256');
  for (const p of parts) h.update(p);
  return h.digest('hex');
};

// F5 (§2.2): d₀(D) = sha256(UTF-8(D)), and dᵢ = sha256(dᵢ₋₁'s 32 raw bytes ‖
// canonical(entryᵢ)), lowercase hex. `canonical` is the entry's canonical
// text, as checkEntry returns it.
export function domainDigest(domain) {
  return sha256(Buffer.from(domain, 'utf8'));
}
export function digestStep(previous, canonical) {
  if (!isDigest(previous)) throw new TypeError('digestStep needs a lowercase sha256 hex digest');
  if (typeof canonical !== 'string')
    throw new TypeError("digestStep needs an entry's canonical text");
  return sha256(Buffer.from(previous, 'hex'), Buffer.from(canonical, 'utf8'));
}

// F4 (§2.4), for one seal: 1 ≤ count ≤ SEGMENT_ENTRIES, entry bytes ≤
// SEGMENT_BYTES, and complete: SEGMENT_ENTRIES entries, exactly SEGMENT_BYTES
// bytes, or a next entry of the same log in the frame (`nextEntryBytes`, its
// canonical length, or null when there is none) that does not fit. Returns
// null, or the local error tagged F4 naming what failed.
export function cutComplete({ count, bytes }, nextEntryBytes = null) {
  const { SEGMENT_ENTRIES, SEGMENT_BYTES } = DISCOVERY_LIMITS;
  if (!Number.isSafeInteger(count) || count < 1 || count > SEGMENT_ENTRIES)
    return new DiscoveryCodecError('F4', null, { fault: 'count' });
  if (!Number.isSafeInteger(bytes) || bytes < 0 || bytes > SEGMENT_BYTES)
    return new DiscoveryCodecError('F4', null, { fault: 'bytes' });
  if (count === SEGMENT_ENTRIES || bytes === SEGMENT_BYTES) return null;
  if (nextEntryBytes !== null && bytes + nextEntryBytes > SEGMENT_BYTES) return null;
  return new DiscoveryCodecError('F4', null, { fault: 'premature' });
}

// §2.5: one segment, built in the fixed field order, its plain bytes (what
// _blob hashes; JSON.stringify, never the store's sorted canonical()) and its
// address. `record` is the job record ({id, identity_hash}).
export function buildSegment(
  record,
  epoch,
  log,
  previousHash,
  first,
  entries,
  digestBefore,
  digestAfter
) {
  const segment = {
    version: 1,
    kind: SEGMENT_KIND,
    job_id: record.id,
    identity_hash: record.identity_hash,
    epoch,
    log,
    previous_hash: previousHash,
    first,
    count: entries.length,
    digest_before: digestBefore,
    digest_after: digestAfter,
    entries,
  };
  const raw = Buffer.from(JSON.stringify(segment), 'utf8');
  return { segment, raw, address: sha256(raw) };
}

const plainObject = (v) =>
  v !== null && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype;

// F3 on a stored segment that passed F6 and was decoded strictly and parsed
// (§2.5, §5.1 step 3): its fields in order; version, kind, job_id,
// identity_hash, epoch and log as `expect` gives them, and the log one of
// LOGS whether or not `expect` names it; the links' digests
// well formed; first, count and epoch integers; count the entries' length;
// and every entry passing F1 and F2. Returns every fault the scan meets, each
// a local error ({rule: 'F3', tag, field?, what?, index?}), in that order;
// none means the content passes. The links themselves are R2's, not F3's.
export function segmentContent(segment, expect = {}) {
  const faults = [];
  const fault = (tag, detail = {}) =>
    faults.push(new DiscoveryCodecError('F3', null, { tag, ...detail }));
  if (!plainObject(segment)) {
    fault('JSON', { field: null });
    return { faults, bytes: 0, canonical: [] };
  }
  const keys = Object.keys(segment);
  if (keys.length !== SEGMENT_FIELDS.length || keys.some((k, i) => k !== SEGMENT_FIELDS[i]))
    fault('FIELDS', { field: null });
  if (segment.version !== 1) fault('FIELD', { field: 'version' });
  if (segment.kind !== SEGMENT_KIND) fault('FIELD', { field: 'kind' });
  for (const field of ['job_id', 'identity_hash'])
    if (Object.hasOwn(expect, field) && segment[field] !== expect[field]) fault('FIELD', { field });
  if (!LOGS.includes(segment.log) || (Object.hasOwn(expect, 'log') && segment.log !== expect.log))
    fault('FIELD', { field: 'log' });
  for (const field of ['epoch', 'first', 'count'])
    if (!Number.isSafeInteger(segment[field]) || segment[field] < 0)
      fault('INTEGER_FIELD', { field });
  if (Object.hasOwn(expect, 'epoch') && segment.epoch !== expect.epoch)
    fault('FIELD', { field: 'epoch' });
  if (segment.previous_hash !== null && !isDigest(segment.previous_hash))
    fault('FIELD', { field: 'previous_hash' });
  for (const field of ['digest_before', 'digest_after'])
    if (!isDigest(segment[field])) fault('FIELD', { field });
  const canonical = [];
  let bytes = 0;
  if (!Array.isArray(segment.entries)) fault('FIELD', { field: 'entries' });
  else {
    if (segment.count !== segment.entries.length) fault('FIELD', { field: 'count' });
    segment.entries.forEach((entry, index) => {
      try {
        const c = checkEntry(entry);
        canonical.push(c.canonical);
        bytes += c.bytes;
      } catch (error) {
        if (!(error instanceof DiscoveryCodecError)) throw error;
        fault(error.rule, { what: error.what, index });
      }
    });
  }
  return { faults, bytes, canonical };
}

// The admission predicate (§2.11): every string and every key in the value,
// at any depth, is well-formed Unicode. An explicit stack, so a deeply nested
// request cannot exhaust the call stack. Its callers pass parsed JSON, which
// cannot be cyclic; a container met twice is walked once, so a cyclic or
// shared value still ends, and is judged by what it holds.
export function wellFormedDeep(value) {
  const stack = [value];
  const met = new Set();
  while (stack.length) {
    const v = stack.pop();
    if (typeof v === 'string') {
      if (!v.isWellFormed()) return false;
    } else if (v !== null && typeof v === 'object') {
      if (met.has(v)) continue;
      met.add(v);
      if (Array.isArray(v)) for (const x of v) stack.push(x);
      else
        for (const [k, x] of Object.entries(v)) {
          if (!k.isWellFormed()) return false;
          stack.push(x);
        }
    }
  }
  return true;
}

// ── the write path (§4) ──────────────────────────────────────────────────
// The store's plan for one commit, made under the lock after _leaseRecord,
// the exact-retry check and the unavailable refusal, and before anything is
// written. `record` is the job record: `discovery` is its live discovery
// state or null (the store passes null for a record that holds none), and
// `cursor` the cursor last committed. `input` is the commit payload.
//
// Returns null when neither the frame nor its cursor carries `discovery` and
// the record holds none: the commit is today's, byte for byte (§2.9).
// Otherwise it returns the record's new `discovery`, the segments to write in
// seal order ({log, segment, raw, address}), and what the address lists need
// once the record save returns (§5.1): `fresh` (the logs whose head before
// this frame's seals is null, after any release or reset: each starts a new
// list at []; after an epoch advance that is every log), and `appended` (each
// log's new addresses, oldest first).
//
// Every refusal is a DiscoveryCodecError tagged with the rule it broke (W1,
// F1, F2, W2, W3, F5, F4, W5, W7, W6 or W4), in §4's order; the store maps
// each to READER_PROTOCOL (400). W4 is checked last: its agreement core (the
// log names, `sealed` and `sealed_digest`, open tails, the shape the
// agreement reads, and a record holding discovery with a frame that has
// none), then its shape and bound checks (cursorShape, below). `canonical` is
// the store's sorted canonical(), by which W4 measures the byte bounds
// (§3.1): the plan never measures them by any other form.
export function planDiscovery(record, input, canonical) {
  if (typeof canonical !== 'function')
    throw new TypeError("planDiscovery needs the store's canonical()");
  const refuse = (rule, what) => {
    throw new DiscoveryCodecError(rule, what);
  };
  const rd = record.discovery ?? null;
  const frameHas = plainObject(input) && Object.hasOwn(input, 'discovery');
  const cursor = plainObject(input) ? input.cursor : undefined;
  const cursorHas = plainObject(cursor) && Object.hasOwn(cursor, 'discovery');
  if (!frameHas && !cursorHas) {
    if (rd !== null) refuse('W4', 'the record holds discovery and the frame has none');
    return null;
  }
  if (frameHas !== cursorHas)
    refuse('W1', 'the frame carries discovery exactly when its cursor does');
  // W1, the frame's shape and bounds. A null frame.discovery is no frame
  // shape (§2.9): refused, never read as absent.
  const fd = input.discovery;
  if (!plainObject(fd)) refuse('W1', 'frame.discovery is not an object');
  const { epoch, resets, seals } = fd;
  if (!Number.isSafeInteger(epoch) || epoch < 0) refuse('W1', 'epoch');
  if (!Array.isArray(resets) || new Set(resets).size !== resets.length) refuse('W1', 'resets');
  for (const log of resets) if (!RESETTABLE.includes(log)) refuse('W1', 'a reset log');
  if (!Array.isArray(seals) || seals.length > DISCOVERY_LIMITS.FRAME_SEALS)
    refuse('W1', 'the seal count');
  for (const s of seals)
    if (
      !plainObject(s) ||
      !LOGS.includes(s.log) ||
      !Number.isSafeInteger(s.first) ||
      s.first < 0 ||
      !Array.isArray(s.entries) ||
      !s.entries.length ||
      !isDigest(s.digest_before) ||
      !isDigest(s.digest_after)
    )
      refuse('W1', 'a seal');
  // The cursor's discovery as the agreement reads it. A null
  // cursor.discovery is no cursor shape (§2.8): W4.
  const cd = cursor.discovery;
  if (!plainObject(cd) || !plainObject(cd.logs)) refuse('W4', 'cursor.discovery');
  for (const [log, st] of Object.entries(cd.logs)) {
    if (!LOGS.includes(log)) refuse('W1', 'a cursor log name');
    if (
      !plainObject(st) ||
      !Number.isSafeInteger(st.sealed) ||
      st.sealed < 0 ||
      !isDigest(st.sealed_digest) ||
      !Array.isArray(st.tail)
    )
      refuse('W4', 'a cursor log');
  }
  // F1 and F2 on every entry the frame carries: the seals, the cursor tails
  // and the current group's keys. `sizes` keeps each entry's canonical form.
  const sizes = new Map();
  const check = (entry) => {
    const c = checkEntry(entry);
    sizes.set(entry, c);
    return c;
  };
  const tails = Object.fromEntries(
    Object.entries(cd.logs).map(([log, st]) => [log, st.tail.map(check)])
  );
  const current = plainObject(cd.groups) ? cd.groups.current : null;
  if (plainObject(current) && Array.isArray(current.keys)) current.keys.forEach(check);
  const sealed = seals.map((s) => s.entries.map(check));
  // W2, the epoch rule.
  if (cursor.method_index !== epoch || cd.epoch !== epoch)
    refuse('W2', 'the frame, cursor.method_index and cursor.discovery.epoch disagree');
  if (rd !== null && epoch < rd.epoch) refuse('W2', 'the epoch went backwards');
  const advanced = rd !== null && epoch > rd.epoch;
  if (advanced && resets.length) refuse('W2', 'a reset on an epoch advance');
  // W3: release on an advance, then the resets, then each seal in order,
  // with F5, F4 and W5 on each seal as it is applied.
  const empty = (log) => ({
    head: null,
    segments: 0,
    count: 0,
    bytes: 0,
    digest: domainDigest(DOMAINS.log(log)),
  });
  const sameEpoch = rd !== null && !advanced;
  const logs = sameEpoch ? structuredClone(rd.logs) : {};
  const reset = new Set();
  for (const log of resets) {
    if (!Object.hasOwn(logs, log)) refuse('W3', 'a reset of a log the record does not hold');
    logs[log] = empty(log);
    reset.add(log);
  }
  const fresh = new Set(Object.keys(logs).filter((log) => logs[log].head === null));
  const appended = {};
  const segments = [];
  const sealedEntries = {};
  seals.forEach((s, i) => {
    const log = s.log;
    if (!Object.hasOwn(logs, log)) {
      logs[log] = empty(log);
      fresh.add(log);
    }
    const st = logs[log];
    if (s.first !== st.count) refuse('W3', `seal ${i}'s first`);
    if (s.digest_before !== st.digest) refuse('W3', `seal ${i}'s digest_before`);
    let digest = st.digest;
    let bytes = 0;
    for (const c of sealed[i]) {
      digest = digestStep(digest, c.canonical);
      bytes += c.bytes;
    }
    if (digest !== s.digest_after) refuse('F5', `seal ${i}'s digest_after`);
    const later = seals.slice(i + 1).find((t) => t.log === log);
    const next = later ? sizes.get(later.entries[0]) : tails[log]?.[0];
    const cut = cutComplete({ count: s.entries.length, bytes }, next ? next.bytes : null);
    if (cut) refuse('F4', `seal ${i}: ${cut.fault}`);
    const built = buildSegment(record, epoch, log, st.head, st.count, s.entries, st.digest, digest);
    segments.push({ log, ...built });
    logs[log] = {
      head: built.address,
      segments: st.segments + 1,
      count: st.count + s.entries.length,
      bytes: st.bytes + bytes,
      digest,
    };
    if (logs[log].segments > DISCOVERY_LIMITS.CHAIN_SEGMENTS)
      refuse('W5', `${log} passes CHAIN_SEGMENTS`);
    (appended[log] ??= []).push(built.address);
    (sealedEntries[log] ??= []).push(...sealed[i]);
  });
  // A log the cursor names enters `logs` with only a tail (§2.7).
  for (const log of Object.keys(cd.logs))
    if (!Object.hasOwn(logs, log)) {
      logs[log] = empty(log);
      fresh.add(log);
    }
  // W7, the membership caps: each membership log's count and `bytes` plus
  // its new tail's length and canonical bytes, the four together.
  let held = 0;
  let heldBytes = 0;
  for (const log of MEMBERSHIP_LOGS) {
    if (Object.hasOwn(logs, log)) {
      held += logs[log].count;
      heldBytes += logs[log].bytes;
    }
    for (const c of tails[log] ?? []) {
      held += 1;
      heldBytes += c.bytes;
    }
  }
  if (held > DISCOVERY_LIMITS.MEMBERSHIP_ENTRIES) refuse('W7', 'MEMBERSHIP_ENTRIES');
  if (heldBytes > DISCOVERY_LIMITS.MEMBERSHIP_BYTES) refuse('W7', 'MEMBERSHIP_BYTES');
  // W6, append-only tails: in the same epoch, for every log the frame does
  // not reset, the previous cursor's tail is a prefix of this frame's seal
  // entries for the log followed by its new tail, entry by entry.
  const pd = plainObject(record.cursor) ? record.cursor.discovery : null;
  if (plainObject(pd) && pd.epoch === epoch && plainObject(pd.logs))
    for (const log of Object.keys(cd.logs)) {
      const old = pd.logs[log];
      if (reset.has(log) || !plainObject(old) || !Array.isArray(old.tail)) continue;
      const after = [...(sealedEntries[log] ?? []), ...tails[log]];
      if (
        old.tail.length > after.length ||
        old.tail.some((e, k) => JSON.stringify(e) !== after[k].canonical)
      )
        refuse('W6', `${log}: the previous tail is not a prefix of what follows it`);
    }
  // W4, the agreement core: the cursor names exactly the record's logs, each
  // with its count and digest, and every tail is open (§2.4).
  const names = Object.keys(logs);
  if (names.length !== Object.keys(cd.logs).length || names.some((l) => !Object.hasOwn(cd.logs, l)))
    refuse('W4', 'the cursor does not name exactly the record logs');
  for (const [log, st] of Object.entries(cd.logs)) {
    if (st.sealed !== logs[log].count) refuse('W4', `${log}: sealed`);
    if (st.sealed_digest !== logs[log].digest) refuse('W4', `${log}: sealed_digest`);
    const tailBytes = tails[log].reduce((n, c) => n + c.bytes, 0);
    if (
      tails[log].length >= DISCOVERY_LIMITS.SEGMENT_ENTRIES ||
      tailBytes >= DISCOVERY_LIMITS.SEGMENT_BYTES
    )
      refuse('W4', `${log}: the tail is not open`);
  }
  // W4, shape and bounds (§2.8, §3, §3.1, §3.2).
  cursorShape(cursor, epoch, pd, sizes, canonical, refuse);
  // §4: `verified` keeps each log's state unless the frame releases or resets
  // it; a log that is new, reset or of a new epoch starts empty. A commit
  // never advances it.
  const verified = {};
  for (const log of names)
    verified[log] =
      sameEpoch && Object.hasOwn(rd.verified, log) && !reset.has(log)
        ? structuredClone(rd.verified[log])
        : empty(log);
  return {
    discovery: { version: 1, epoch, logs, verified, unavailable: null },
    segments,
    fresh,
    appended,
  };
}

// ── W4's shape and bound checks (§2.8, §3, §3.1, §3.2; #656 Step 9) ──────
// The keys §2.8 gives each object of cursor.discovery, exactly: anything else
// would leave cursor.discovery without a bound (§3).
const CURSOR_DISCOVERY_KEYS = Object.freeze({
  discovery: Object.freeze(['epoch', 'groups', 'inventory', 'logs', 'version']),
  log: Object.freeze(['sealed', 'sealed_digest', 'tail']),
  inventory: Object.freeze(['count', 'digest']),
  groups: Object.freeze(['current', 'through']),
  current: Object.freeze(['keys', 'lines']),
  // §2.8's witness, exactly (BB8 6715584092): its six keys and no other.
  witness: Object.freeze(['count', 'digest', 'epoch', 'fields', 'method_id', 'version']),
});
// §3's WITNESS_FIELDS row: each field a dot path of lowercase names, joined by
// `.`, of at most 64 bytes.
const DOT_PATH = /^[a-z0-9_]+(?:\.[a-z0-9_]+)*$/;
const WITNESS_FIELD_BYTES = 64;
const exactKeys = (v, keys) =>
  plainObject(v) && Object.keys(v).length === keys.length && keys.every((k) => Object.hasOwn(v, k));
const count = (v) => Number.isSafeInteger(v) && v >= 0;
const pair = (v) => Array.isArray(v) && v.length === 2 && v.every(count);
// A group's line pair is two different lines, the first before the second
// (§6.4: a two-line key l₁ < l₂); a key within one line never forms a group.
const linePair = (v) => pair(v) && v[0] < v[1];
const pairOrder = (a, b) => a[0] - b[0] || a[1] - b[1];

// Where in the cursor a number is not an integer from 0 to 2^53 - 1, or null.
// The entries (each log's tail, the current group's keys), which F1 governs,
// and `continuation`, which is opaque (§2.8), are not walked. The walk itself
// keeps an explicit stack; a cursor nested past the call stack still fails
// earlier, in jsonValue, and later, in the recursive canonical().
function cursorNumberFault(cursor) {
  const stack = [];
  const members = (v, where, skip = null) => {
    for (const [k, x] of Object.entries(v)) if (k !== skip) stack.push([x, `${where}.${k}`]);
  };
  for (const [k, v] of Object.entries(cursor)) {
    if (k === 'continuation') continue;
    if (k !== 'discovery' || !plainObject(v)) {
      stack.push([v, k]);
      continue;
    }
    for (const [dk, dv] of Object.entries(v)) {
      const where = `discovery.${dk}`;
      if (dk === 'logs' && plainObject(dv))
        for (const [log, st] of Object.entries(dv))
          if (plainObject(st)) members(st, `${where}.${log}`, 'tail');
          else stack.push([st, `${where}.${log}`]);
      else if (dk === 'groups' && plainObject(dv))
        for (const [gk, gv] of Object.entries(dv))
          if (gk === 'current' && plainObject(gv)) members(gv, `${where}.current`, 'keys');
          else stack.push([gv, `${where}.${gk}`]);
      else stack.push([dv, where]);
    }
  }
  while (stack.length) {
    const [v, where] = stack.pop();
    if (typeof v === 'number') {
      if (!count(v)) return where;
    } else if (Array.isArray(v)) v.forEach((x, i) => stack.push([x, `${where}[${i}]`]));
    else if (plainObject(v)) members(v, where);
  }
  return null;
}

// W4's shape and bound checks, after its agreement core: `cursor` is the
// frame's, `epoch` the frame's, `previous` the record's cursor.discovery (or
// anything else when it has none), `sizes` each entry's canonical form from
// F1 and F2, and `canonical` the store's sorted canonical(). Throws through
// `refuse` with W4 at the first fault.
function cursorShape(cursor, epoch, previous, sizes, canonical, refuse) {
  const W4 = (what) => refuse('W4', what);
  const bytes = (v) => Buffer.byteLength(canonical(v), 'utf8');
  const cd = cursor.discovery;
  // The cursor's own version (§2.8), as the validator's W4 checks it.
  if (cursor.contract_version !== 2) W4('cursor contract_version is 2');
  // Exact keys on cursor.discovery and each of its logs.
  if (!exactKeys(cd, CURSOR_DISCOVERY_KEYS.discovery) || cd.version !== 1)
    W4('cursor.discovery holds exactly the keys of §2.8');
  for (const [log, st] of Object.entries(cd.logs))
    if (!exactKeys(st, CURSOR_DISCOVERY_KEYS.log)) W4(`cursor log ${log} holds exactly its keys`);
  // Every number outside the entries and continuation is a count, an index
  // or an epoch.
  const where = cursorNumberFault(cursor);
  if (where !== null) W4(`${where} is not an integer from 0 to 2^53 - 1`);
  // The groups: exact keys, line pairs, current after through, and the
  // current group within GROUP_KEYS and GROUP_BYTES.
  const g = cd.groups;
  if (!exactKeys(g, CURSOR_DISCOVERY_KEYS.groups)) W4('groups holds exactly its keys');
  if (g.through !== null && !linePair(g.through)) W4('groups.through is a line pair');
  if (g.current !== null) {
    const c = g.current;
    if (
      !exactKeys(c, CURSOR_DISCOVERY_KEYS.current) ||
      !linePair(c.lines) ||
      !Array.isArray(c.keys)
    )
      W4('groups.current shape');
    if (g.through !== null && pairOrder(c.lines, g.through) <= 0)
      W4('groups.current comes after through');
    if (c.keys.length > DISCOVERY_LIMITS.GROUP_KEYS) W4('groups.current passes GROUP_KEYS');
    if (c.keys.reduce((n, e) => n + sizes.get(e).bytes, 0) > DISCOVERY_LIMITS.GROUP_BYTES)
      W4('groups.current passes GROUP_BYTES');
  }
  // The inventory: null, or a count and a digest.
  const inv = cd.inventory;
  if (
    inv !== null &&
    !(exactKeys(inv, CURSOR_DISCOVERY_KEYS.inventory) && count(inv.count) && isDigest(inv.digest))
  )
    W4('inventory shape');
  // Within the epoch, against the record's cursor: `through` never moves
  // back, nor does the current group (BB8 6715584092, F-6), and an inventory
  // once non-null is fixed. F-6 is narrowed (BB8 6717719856) to frames where
  // both the record's cursor and the frame have a current group: the frame's
  // current.lines is at or after the previous one, whatever through was. A
  // group dropped without retiring, or a through behind the previous group,
  // is accepted until 3PO confirms (#721) the worker never does either; if
  // so, the check widens to the frame's through when it has no current group.
  if (plainObject(previous) && previous.epoch === epoch) {
    const pg = plainObject(previous.groups) ? previous.groups : {};
    const before = pg.through ?? null;
    if (pair(before) && !(g.through !== null && pairOrder(g.through, before) >= 0))
      W4('groups.through went backwards within its epoch');
    const was = plainObject(pg.current) ? pg.current.lines : null;
    if (pair(was) && g.current !== null && !(pairOrder(g.current.lines, was) >= 0))
      W4('groups.current went backwards within its epoch');
    const held = previous.inventory;
    if (held !== null && held !== undefined && canonical(held) !== canonical(inv))
      W4('the inventory changed within its epoch');
  }
  // The witness: null, or well formed (exactly §2.8's keys), of the frame's
  // epoch, its fields dot paths within WITNESS_FIELDS.
  const w = cursor.witness;
  if (
    !(
      w === null ||
      (exactKeys(w, CURSOR_DISCOVERY_KEYS.witness) &&
        w.version === 1 &&
        w.epoch === epoch &&
        typeof w.method_id === 'string' &&
        Array.isArray(w.fields) &&
        w.fields.length <= DISCOVERY_LIMITS.WITNESS_FIELDS &&
        w.fields.every(
          (f) =>
            typeof f === 'string' &&
            DOT_PATH.test(f) &&
            Buffer.byteLength(f, 'utf8') <= WITNESS_FIELD_BYTES
        ) &&
        count(w.count) &&
        isDigest(w.digest))
    )
  )
    W4('witness shape');
  // continuation: an object within CONTINUATION_BYTES, opaque beyond it.
  if (
    !plainObject(cursor.continuation) ||
    bytes(cursor.continuation) > DISCOVERY_LIMITS.CONTINUATION_BYTES
  )
    W4('continuation shape or CONTINUATION_BYTES');
  // methods[*]: no terminal input, and each refusal within REFUSAL_BYTES.
  // Every member is checked, as the validator does, whatever `methods` is: an
  // array's members are its entries. A member that is not an object holds
  // neither.
  for (const [mid, counts] of Object.entries(cursor.methods || {})) {
    if (!plainObject(counts)) continue;
    for (const key of TERMINAL_INPUTS)
      if (Object.hasOwn(counts, key)) W4(`methods[${mid}] holds the terminal input ${key}`);
    if (Object.hasOwn(counts, 'refusal') && bytes(counts.refusal) > DISCOVERY_LIMITS.REFUSAL_BYTES)
      W4(`methods[${mid}].refusal passes REFUSAL_BYTES`);
  }
  // CURSOR_BYTES: the cursor without discovery and continuation, witness
  // included, by the store's sorted canonical() (§3.1).
  const rest = Object.fromEntries(
    Object.entries(cursor).filter(([k]) => k !== 'discovery' && k !== 'continuation')
  );
  if (bytes(rest) > DISCOVERY_LIMITS.CURSOR_BYTES)
    W4('the cursor without discovery and continuation passes CURSOR_BYTES');
}
