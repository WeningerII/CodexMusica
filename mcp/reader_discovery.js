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
// was spaced on the wire. Which tag an entry breaking both gets is not pinned.
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
// identity_hash, epoch and log as `expect` gives them; the links' digests
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
  for (const field of ['job_id', 'identity_hash', 'log'])
    if (Object.hasOwn(expect, field) && segment[field] !== expect[field]) fault('FIELD', { field });
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
// request cannot exhaust the call stack.
export function wellFormedDeep(value) {
  const stack = [value];
  while (stack.length) {
    const v = stack.pop();
    if (typeof v === 'string') {
      if (!v.isWellFormed()) return false;
    } else if (Array.isArray(v)) {
      for (const x of v) stack.push(x);
    } else if (v !== null && typeof v === 'object') {
      for (const [k, x] of Object.entries(v)) {
        if (!k.isWellFormed()) return false;
        stack.push(x);
      }
    }
  }
  return true;
}
