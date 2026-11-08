// Reader jobs are separate from chat receipts. Only trusted server code obtains
// workerPayload/inspect; public reads require both viewer binding and capability.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import {
  DISCOVERY_CAUSES,
  DISCOVERY_LIMITS,
  DiscoveryCodecError,
  DOMAINS,
  LOGS,
  RESOURCE_CAUSES,
  domainDigest,
  isDigest,
  planDiscovery,
  segmentContent,
} from './reader_discovery.js';

export const READER_LIMITS = Object.freeze({
  pageInstances: 250,
  objectBytes: 2 * 1024 * 1024,
  waiting: 16,
  outstandingPerViewer: 2,
  leaseMs: 600_000,
  retentionMs: 30 * 24 * 60 * 60 * 1000,
});
const HASH = /^[a-f0-9]{64}$/;
const ID = /^reader_[a-f0-9]{64}$/;
const STATES = new Set([
  'queued',
  'running',
  'paused',
  'completed',
  'completed_with_refusals',
  'cancelled',
  'expired',
  'deleted',
]);
const OUTSTANDING = new Set(['queued', 'running', 'paused']);
const RESERVE_BYTES = 16 * 1024;
// A read slides a job's retention in memory; the slide is persisted at most
// once an hour, so polling never writes a record per request. A crash loses at
// most this much sliding retention (mcp/READER_RUNTIME.md).
const TOUCH_INTERVAL_MS = 60 * 60 * 1000;
// One maintenance slice (expiry, collection, usage verification) does at most
// this much work, then yields: it never holds the event loop for long.
export const MAINTENANCE_BOUNDS = Object.freeze({
  records: 100,
  objects: 500,
  bytes: 64 * 1024 * 1024,
  ms: 50,
});
// `definitions` are the exact methods and result-schema bytes a job was created
// under (retained definitions): its analysis export emits these, never the
// current image's.
const OBJECT_KINDS = ['pages', 'indexes', 'checkpoints', 'manifests', 'definitions'];
const clone = (value) => JSON.parse(JSON.stringify(value));
const pick = (value, keys) =>
  Object.fromEntries(
    keys.filter((key) => Object.hasOwn(value, key)).map((key) => [key, value[key]])
  );
const sha = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const reserveGap = (size) => Math.max(0, RESERVE_BYTES - size);
// A write refused for room: the quota (RESOURCE_LIMIT), or usage unknown until
// a recount (STORE_RECOUNTING). Both are thrown before that write's first byte.
const roomRefusal = (error) =>
  (error?.code === 'RESOURCE_LIMIT' && error.status === 507) ||
  (error?.code === 'STORE_RECOUNTING' && error.status === 503);
function problem(code, message, status = 409) {
  return Object.assign(new Error(message), { code, status });
}
// §2.7's exact keys and types of `record.discovery` (the store's
// _discoveryShape and _liveDiscovery read them), including §2.7's rule that
// `verified` names exactly the logs `logs` names: a value that breaks it is
// malformed, so the §7.4 property, which assumes it, never meets one (#656
// Step 6 review, D1). R5 (§5.1) still checks it on a lease's walk.
const plainObject = (v) =>
  v !== null && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype;
const exactKeys = (v, keys) =>
  plainObject(v) &&
  Object.keys(v).length === keys.length &&
  keys.every((key) => Object.hasOwn(v, key));
const nonNegative = (v) => Number.isSafeInteger(v) && v >= 0;
const headOf = (v) => v === null || isDigest(v);
const LOG_STATE_KEYS = ['head', 'segments', 'count', 'bytes', 'digest'];
const logStates = (v) =>
  plainObject(v) &&
  Object.entries(v).every(
    ([log, state]) =>
      LOGS.includes(log) &&
      exactKeys(state, LOG_STATE_KEYS) &&
      headOf(state.head) &&
      nonNegative(state.segments) &&
      nonNegative(state.count) &&
      nonNegative(state.bytes) &&
      isDigest(state.digest)
  );
const sameKeys = (a, b) =>
  Object.keys(a).length === Object.keys(b).length &&
  Object.keys(a).every((key) => Object.hasOwn(b, key));
const unavailableShape = (v) =>
  v === null ||
  (exactKeys(v, ['cause', 'log', 'released']) &&
    Object.hasOwn(DISCOVERY_CAUSES, v.cause) &&
    (v.log === null || LOGS.includes(v.log)) &&
    plainObject(v.released) &&
    Object.entries(v.released).every(([log, head]) => LOGS.includes(log) && headOf(head)));
const discoveryStateShape = (value) =>
  exactKeys(value, ['version', 'epoch', 'logs', 'verified', 'unavailable']) &&
  value.version === 1 &&
  nonNegative(value.epoch) &&
  logStates(value.logs) &&
  logStates(value.verified) &&
  sameKeys(value.logs, value.verified) &&
  unavailableShape(value.unavailable);
// U1 (§8): a well-formed `record.discovery` released with `cause` and `log`.
// `logs` and `verified` are emptied, and `unavailable.released` names each log
// `logs` held, with its head then (never its verified head).
function releasedDiscovery(discovery, cause, log) {
  const released = Object.fromEntries(
    Object.entries(discovery.logs).map(([name, state]) => [name, state.head])
  );
  const unavailable = { cause, log, released };
  return { version: 1, epoch: discovery.epoch, logs: {}, verified: {}, unavailable };
}
// U2 (§8): the reason copied from `unavailable`, with no message; the job view
// renders the message from the cause.
const unavailableReason = ({ cause, log, released }) => ({
  code: 'DISCOVERY_UNAVAILABLE',
  cause,
  log,
  released: clone(released),
});
// The refusal `unavailable` gives (§2.7, §8): its cause and its log.
const unavailableRefusal = ({ cause, log }) =>
  Object.assign(
    problem(
      'DISCOVERY_UNAVAILABLE',
      `Reader discovery state is unavailable for this job: ${cause}.`,
      409
    ),
    { cause, log }
  );
// §7.1: the states whose discovery chains stay live, and so root the GC.
const DISCOVERY_LIVE_STATES = new Set(['queued', 'running', 'paused', 'cancelled']);
// The reason a pause stores (DISCOVERY_V1 §8, the pause). A RESOURCE_LIMIT
// with one of its ten causes is `{code, cause}`, and a DISCOVERY_UNAVAILABLE
// with one of §8's causes `{code, cause, log}`: a reason with a named cause
// stores no message, which the job view renders from the cause. C1's reason
// is `{code, reply_code, field, value, message}`. Anything else is
// `{code, message}`, as before. An argument outside every set (a cause or a
// log that is not one, reply_code or field not a string, value neither a
// string nor null), and a cause of the wrong family (a resource cause on
// DISCOVERY_UNAVAILABLE, a discovery cause on RESOURCE_LIMIT, any cause on
// another code), is refused INVALID_PAUSE, an internal code that is never a
// job's reason. A DISCOVERY_UNAVAILABLE without a cause is refused the same
// way (#656 Step 7, the strict pause): it can never be stored, because U1's
// release and U2's reason both name the cause.
function pauseReason(code, message, { cause, log, reply_code, field, value }) {
  const invalid = (what) =>
    problem('INVALID_PAUSE', `A reader pause names ${what} outside its sets.`, 500);
  const named = (v) => v !== undefined && v !== null;
  if (
    named(cause) &&
    (typeof cause !== 'string' ||
      !(Object.hasOwn(DISCOVERY_CAUSES, cause) || Object.hasOwn(RESOURCE_CAUSES, cause)))
  )
    throw invalid('a cause');
  if (named(log) && (typeof log !== 'string' || !LOGS.includes(log))) throw invalid('a log');
  if (reply_code !== undefined && typeof reply_code !== 'string') throw invalid('a reply code');
  if (field !== undefined && typeof field !== 'string') throw invalid('a field');
  if (named(value) && typeof value !== 'string') throw invalid('a value');
  if (code === 'DISCOVERY_UNAVAILABLE' && !named(cause))
    throw problem('INVALID_PAUSE', 'A reader DISCOVERY_UNAVAILABLE pause names no cause.', 500);
  if (named(cause)) {
    if (code === 'RESOURCE_LIMIT' && Object.hasOwn(RESOURCE_CAUSES, cause)) return { code, cause };
    if (code === 'DISCOVERY_UNAVAILABLE' && Object.hasOwn(DISCOVERY_CAUSES, cause))
      return { code, cause, log: log ?? null };
    // A cause of the other code's set, or any cause on a code that takes
    // none (BB8 6705927389): refused, never dropped to {code, message}.
    throw invalid('a cause for its code');
  }
  if (code === 'READER_PROTOCOL' && reply_code !== undefined)
    return { code, reply_code, field: field ?? null, value: value ?? null, message };
  return { code, message };
}
function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
    .join(',')}}`;
}
function jsonValue(value, label) {
  // Do not let JSON silently discard declarations or coerce unknown values.
  const visit = (v) => {
    if (v === null || typeof v === 'string' || typeof v === 'boolean') return;
    if (typeof v === 'number' && Number.isFinite(v)) return;
    if (Array.isArray(v)) {
      v.forEach(visit);
      return;
    }
    if (v && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype) {
      Object.values(v).forEach(visit);
      return;
    }
    throw problem('INVALID_DECLARATION', `${label} must be finite JSON data.`, 400);
  };
  visit(value);
  return clone(value);
}
function encoded(value, label, limit = READER_LIMITS.objectBytes) {
  const bytes = Buffer.from(JSON.stringify(value));
  if (bytes.length > limit)
    throw problem('RESOURCE_LIMIT', `${label} exceeds ${limit} encoded bytes.`, 413);
  return bytes;
}
function text(value, label) {
  if (typeof value !== 'string' || !value.trim() || Buffer.byteLength(value) > 256)
    throw problem(
      'INVALID_DECLARATION',
      `${label} must be a nonempty string of at most 256 bytes.`,
      400
    );
  return value;
}
function identityHash(identity) {
  const data = jsonValue(identity, 'Analysis identity');
  if (
    (typeof data !== 'object' || data === null || Array.isArray(data)) &&
    (typeof data !== 'string' || !data)
  )
    throw problem('INVALID_DECLARATION', 'An exact analysis identity is required.', 400);
  if (typeof data === 'object' && !Object.keys(data).length)
    throw problem('INVALID_DECLARATION', 'Analysis identity cannot be empty.', 400);
  encoded(data, 'Analysis identity');
  return sha(canonical(data));
}

// Same-volume atomicPrivateWrite algorithm from job_store.js, isolated here to
// avoid loading chat/Express/provider dependencies into the reader namespace.
export function atomicWrite(file, data, fault = () => {}, kind = 'record') {
  const dir = path.dirname(file);
  const temp = `${file}.${crypto.randomBytes(12).toString('hex')}.tmp`;
  let fd;
  let failure;
  try {
    fd = fs.openSync(
      temp,
      fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY,
      0o600
    );
    fs.writeFileSync(fd, data);
    fault('temporary_written', { kind, file });
    fs.fsyncSync(fd);
    fault('file_synced', { kind, file });
    fs.closeSync(fd);
    fd = undefined;
    fs.renameSync(temp, file);
    fault('renamed', { kind, file });
    syncDirectory(dir);
    fault('directory_synced', { kind, file });
  } catch (error) {
    failure = error;
  } finally {
    if (fd !== undefined) {
      try {
        fs.closeSync(fd);
      } catch (error) {
        failure ??= error;
      }
    }
    try {
      fs.unlinkSync(temp);
    } catch (error) {
      if (error.code !== 'ENOENT') failure ??= error;
    }
  }
  if (failure) throw failure;
}
export function syncDirectory(dir) {
  const fd = fs.openSync(dir, 'r');
  try {
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
}

// Phase A of storage at rest: every object reader accepts plain or gzip bytes.
// Identity is always sha256 of the UNCOMPRESSED bytes, and inflation is bounded
// by the same object limit the plain format has. Phase B optionally compresses
// new pages; all other objects and existing page representations stay unchanged.
//
// A gzip object is exactly one member with no trailing bytes. gunzip would
// concatenate further members and Python's reader stops after the first, so
// both refuse anything else rather than disagree about what an object holds.
export function decodeStoredObject(raw) {
  if (raw.length >= 2 && raw[0] === 0x1f && raw[1] === 0x8b) {
    const corrupt = () =>
      problem('STORAGE_CORRUPT', 'Stored reader object failed bounded inflation.', 503);
    if (raw.length < 18 || raw[2] !== 8 || raw[3] & 0xe0) throw corrupt();
    const flags = raw[3];
    let at = 10;
    const trailer = raw.length - 8;
    if (flags & 4) {
      if (at + 2 > trailer) throw corrupt();
      at += 2 + raw.readUInt16LE(at);
      if (at > trailer) throw corrupt();
    }
    for (const bit of [8, 16])
      if (flags & bit) {
        const end = raw.indexOf(0, at);
        if (end < 0 || end >= trailer) throw corrupt();
        at = end + 1;
      }
    if (flags & 2) {
      // RFC 1952 FHCRC is the low 16 bits of CRC32 over every header byte
      // preceding this field, including optional extra/name/comment fields.
      // Python's zlib reader validates it too; accepting a bad header here
      // would let Node read a checkpoint that the worker refuses.
      if (at + 2 > trailer || (zlib.crc32(raw.subarray(0, at)) & 0xffff) !== raw.readUInt16LE(at))
        throw corrupt();
      at += 2;
    }
    if (at > trailer) throw corrupt();
    let out;
    try {
      const result = zlib.inflateRawSync(raw.subarray(at, trailer), {
        maxOutputLength: READER_LIMITS.objectBytes,
        info: true,
      });
      if (result.engine.bytesWritten !== trailer - at) throw corrupt();
      out = result.buffer;
    } catch {
      throw corrupt();
    }
    if (
      zlib.crc32(out) !== raw.readUInt32LE(trailer) ||
      out.length !== raw.readUInt32LE(trailer + 4)
    )
      throw corrupt();
    return out;
  }
  if (raw.length > READER_LIMITS.objectBytes)
    throw problem('STORAGE_CORRUPT', 'Stored reader object exceeds its bound.', 503);
  return raw;
}

// Passive deployment signal: never take the writer lock or create directories.
// Only ENOENT means absence. Preserve well-formed future tokens so an older
// external gate refuses an unknown requirement instead of assuming format A.
export function readerStoreFormat(directory) {
  let fd;
  try {
    fd = fs.openSync(path.join(directory, 'store-format.json'), 'r');
    const raw = Buffer.alloc(1025);
    const size = fs.readSync(fd, raw, 0, raw.length, 0);
    if (size > 1024) return { min_reader: 'unknown' };
    const value = JSON.parse(raw.subarray(0, size));
    return {
      min_reader:
        typeof value?.min_reader === 'string' && /^[A-Z]$/.test(value.min_reader)
          ? value.min_reader
          : 'unknown',
    };
  } catch (error) {
    return { min_reader: error.code === 'ENOENT' ? null : 'unknown' };
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

// Shared with the offline inflate tool; never substitute a second lock name.
export function withReaderWriterLock(directory, run, now = () => Date.now()) {
  const lock = path.join(directory, 'writer.lock');
  let fd;
  try {
    fd = fs.openSync(lock, 'wx', 0o600);
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    let owner;
    try {
      owner = JSON.parse(fs.readFileSync(lock, 'utf8'));
    } catch {}
    let dead = false;
    if (Number.isInteger(owner?.pid)) {
      try {
        process.kill(owner.pid, 0);
      } catch (e) {
        dead = e.code === 'ESRCH';
      }
    } else dead = now() - fs.statSync(lock).mtimeMs > READER_LIMITS.leaseMs;
    if (!dead)
      throw problem('STORE_BUSY', 'Another reader storage operation owns the writer lock.', 503);
    fs.unlinkSync(lock);
    syncDirectory(directory);
    fd = fs.openSync(lock, 'wx', 0o600);
  }
  const nonce = crypto.randomBytes(16).toString('hex');
  try {
    fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, nonce }));
    fs.fsyncSync(fd);
    return run();
  } finally {
    fs.closeSync(fd);
    const owner = JSON.parse(fs.readFileSync(lock, 'utf8'));
    if (owner.nonce === nonce) {
      fs.unlinkSync(lock);
      syncDirectory(directory);
    }
  }
}

export class ReaderJobStore {
  constructor({
    directory,
    maxBytes = 256 * 1024 * 1024,
    now = () => Date.now(),
    // Maintenance's time budget only (a slice stops after bounds.ms). The
    // mark-and-sweep's start stays on the wall clock, which file mtimes share.
    clock = () => Date.now(),
    ttlMs = READER_LIMITS.retentionMs,
    leaseMs = READER_LIMITS.leaseMs,
    faultInjector = null,
    gzip = false,
  } = {}) {
    if (typeof directory !== 'string' || !directory.trim())
      throw problem(
        'DURABILITY_REQUIRED',
        'Reader analysis requires a configured durable data directory.',
        503
      );
    if (
      !Number.isSafeInteger(maxBytes) ||
      maxBytes <= RESERVE_BYTES ||
      !Number.isSafeInteger(ttlMs) ||
      ttlMs <= 0 ||
      !Number.isSafeInteger(leaseMs) ||
      leaseMs <= 0 ||
      leaseMs > READER_LIMITS.leaseMs
    )
      throw problem(
        'INVALID_CONFIGURATION',
        'Invalid reader storage, retention or lease limit.',
        500
      );
    this.directory = path.join(path.resolve(directory), 'reader-jobs-v1');
    if (typeof gzip !== 'boolean')
      throw problem('INVALID_CONFIGURATION', 'Reader gzip setting must be boolean.', 500);
    this.gzip = gzip;
    this.maxBytes = maxBytes;
    this.now = now;
    this.clock = clock;
    this.ttlMs = ttlMs;
    this.leaseMs = leaseMs;
    this.fault = faultInjector || (() => {});
    this.failure = null;
    this.records = new Map();
    // Each live chain's segment addresses, oldest first, by job id and log
    // (DISCOVERY_V1 §5.1). Only a full read (_fullRead, from reconciliation)
    // builds a job's lists; _reload and a job's release, tombstone or
    // completion drop them. Never persisted.
    this.chains = new Map();
    // A malformed record.discovery's release that _capacity refused (§7.4,
    // BB8 6700200435 condition 4): job ids, in memory only. _reload clears
    // it and the reconciliation after it rebuilds it. While an id is here
    // the job view shows the release, nothing dispatches the job, and its
    // refusals are the saved release's; it is saved at the first point usage
    // is known (_savePending).
    this.pendingRelease = new Map();
    this._malformedLogged = new Set();
    try {
      fs.mkdirSync(this.directory, { recursive: true, mode: 0o700 });
      for (const dir of ['records', ...OBJECT_KINDS])
        fs.mkdirSync(path.join(this.directory, dir), { recursive: true, mode: 0o700 });
      syncDirectory(this.directory);
      this.generation = -1;
      this.usage = null;
      this.durableExpiry = new Map();
      this._writing = false;
      this._inflight = false;
      this._recountWanted = false;
      // records/*.tmp names the last accepted full scan counted (see _usage).
      this._countedTemporaries = new Set();
      this._timers = [];
      this._gc = null;
      this._expiryScan = null;
      this.recordBytes = new Map();
      this.slack = 0;
      this._locked(() => {
        const keyFile = path.join(this.directory, 'capability-key');
        if (!fs.existsSync(keyFile))
          atomicWrite(keyFile, crypto.randomBytes(32), this.fault, 'key');
        this.key = fs.readFileSync(keyFile);
        if (this.key.length !== 32)
          throw problem('STORAGE_CORRUPT', 'Reader capability key is invalid.', 503);
        // Collect first: an interrupted write can leave a temporary or an
        // unlinked object that no quota check ever counted.
        this._pruneExpired(Infinity);
        this._collectAll();
        // Startup holds the writer lock throughout, so this full scan is a
        // quiescent one by construction: usage is known before any request,
        // and before the pauses below, which add their exact deltas to it.
        this.usage = this._usage();
        this._recountWanted = false;
        // Each pause always commits, whatever the quota: a store that cannot
        // record its own interruption cannot start, and every request then
        // fails until someone frees space. It is one of the transitions out of
        // running that are never refused for quota (see _save).
        this._savePending();
        this._repairReleased();
        for (const record of [...this.records.values()]) {
          if (record.state !== 'running') continue;
          this._saveReason(
            record,
            (base, reason) => ({
              ...base,
              state: record.cancel_requested ? 'cancelled' : 'paused',
              fence: null,
              lease_expires_at: null,
              cancel_requested: false,
              deferred_requeue: false,
              reason: reason ?? {
                code: 'INTERRUPTED',
                message: 'Worker interrupted; explicitly resume the committed cursor.',
              },
            }),
            true
          );
        }
        this._probe();
      });
      this.durable = true;
    } catch (error) {
      this.failure = error.message;
      throw error.status
        ? error
        : problem('STORAGE_UNAVAILABLE', 'Durable reader storage is unavailable.', 503);
    }
  }

  _locked(run) {
    if (this.failure)
      throw problem(
        'STORAGE_UNAVAILABLE',
        'Reader persistence failed; no new work is admitted.',
        503
      );
    return withReaderWriterLock(
      this.directory,
      () => {
        const reloaded = this._enterLock();
        // Reconciliation (§7.4) runs in the guarded region, before `run`, on
        // every entry that reloaded. _enterLock has already taken the new
        // generation, so a reconciliation that throws part way leaves
        // this.generation at -1, which no generation file holds: the next
        // _locked and the next _cached reload and reconcile again. That is
        // set only after _leaveLock has published the releases that landed.
        let unreconciled = false;
        try {
          if (reloaded) {
            try {
              this._reconcile();
            } catch (error) {
              unreconciled = true;
              throw error;
            }
          }
          return run();
        } finally {
          try {
            this._leaveLock();
          } finally {
            if (unreconciled) this.generation = -1;
          }
        }
      },
      this.now
    );
  }

  // ── generation and write intent ────────────────────────────────────────
  // Every mutation (record writes, object writes, object deletes) happens under
  // the writer lock and is bracketed: `pending` is written before its first
  // byte, and `generation` is advanced and `pending` removed after it. Another
  // instance that finds the generation moved knows its cache is stale; a
  // `pending` found on taking the lock means the last writer died mid-write.
  _genFile() {
    return path.join(this.directory, 'generation');
  }
  _pendingFile() {
    return path.join(this.directory, 'pending');
  }
  _readGeneration() {
    try {
      const value = JSON.parse(fs.readFileSync(this._genFile(), 'utf8')).generation;
      if (!Number.isSafeInteger(value) || value < 0) throw new Error('bad generation');
      return value;
    } catch (error) {
      if (error.code === 'ENOENT') return 0;
      throw problem('STORAGE_CORRUPT', 'Reader store generation marker is invalid.', 503);
    }
  }
  _hasPending() {
    return fs.existsSync(this._pendingFile());
  }
  _enterLock() {
    this._writing = false;
    const pending = this._hasPending();
    const generation = this._readGeneration();
    if (!pending && generation === this.generation) return false;
    // Another writer committed, or one died mid-write: the cache and the usage
    // counter can no longer be trusted until a quiescent recount.
    this._reload();
    this.generation = generation;
    this.usage = null;
    this._abandonGc(); // a collection marked against records another writer changed
    if (pending) this._beginWrite(); // publishes a fresh generation on leave
    this._scheduleRecount();
    return true;
  }
  _beginWrite() {
    if (this._writing) return;
    atomicWrite(
      this._pendingFile(),
      Buffer.from(JSON.stringify({ generation: this.generation + 1 })),
      this.fault,
      'pending'
    );
    this._writing = true;
  }
  _leaveLock() {
    // Only a write that did not finish leaves the counter in doubt. A refusal
    // thrown after completed writes is not a failure: each delta was applied.
    if (this._inflight) {
      this._inflight = false;
      this.usage = null;
      this._scheduleRecount();
    }
    if (!this._writing) return;
    this.generation += 1;
    atomicWrite(
      this._genFile(),
      Buffer.from(JSON.stringify({ generation: this.generation })),
      this.fault,
      'generation'
    );
    fs.unlinkSync(this._pendingFile());
    syncDirectory(this.directory);
    this._writing = false;
  }

  _reload() {
    const records = new Map();
    const sizes = new Map();
    for (const file of fs.readdirSync(path.join(this.directory, 'records'))) {
      if (!file.endsWith('.json')) continue;
      const id = file.slice(0, -5);
      if (!ID.test(id)) throw problem('STORAGE_CORRUPT', 'Unexpected reader record filename.', 503);
      const raw = this._readFile(path.join(this.directory, 'records', file));
      const record = JSON.parse(raw);
      const { record_digest, ...body } = record;
      if (
        record.version !== 1 ||
        record.id !== id ||
        !STATES.has(record.state) ||
        record_digest !== sha(canonical(body))
      )
        throw problem(
          'STORAGE_CORRUPT',
          'Reader record failed identity or digest validation.',
          503
        );
      records.set(id, record);
      sizes.set(id, raw.length);
    }
    this.records = records;
    this.chains = new Map(); // the reconciliation that follows rebuilds them
    this.pendingRelease = new Map();
    this.durableExpiry = new Map([...records.values()].map((r) => [r.id, r.expires_at]));
    this.recordBytes = sizes;
    this.slack = 0;
    for (const size of sizes.values()) this.slack += reserveGap(size);
  }

  _readFile(file) {
    if (fs.statSync(file).size > READER_LIMITS.objectBytes)
      throw problem('STORAGE_CORRUPT', 'Stored reader object exceeds its bounded format.', 503);
    return fs.readFileSync(file);
  }
  _metadataBytes() {
    let total = fs.statSync(path.join(this.directory, 'capability-key')).size;
    const marker = path.join(this.directory, 'store-format.json');
    if (fs.existsSync(marker)) total += fs.statSync(marker).size;
    return total;
  }
  // A full scan, quiescent under the writer lock. It also records which
  // records/*.tmp files it counted: a writer adds only the renamed file to the
  // counter, never its temporary, so a temporary is in the counter only if
  // the full scan that set it saw that name (see _unlinkTemporary).
  _usage() {
    let total = this._metadataBytes();
    const temporaries = new Set();
    for (const dir of ['records', ...OBJECT_KINDS])
      for (const name of fs.readdirSync(path.join(this.directory, dir))) {
        total += fs.statSync(path.join(this.directory, dir, name)).size;
        if (dir === 'records' && name.endsWith('.tmp')) temporaries.add(name);
      }
    this._countedTemporaries = temporaries;
    return total;
  }
  // Every record holds a RESERVE_BYTES reservation: the quota invariant is
  //   usage + slack <= maxBytes, slack = sum over records of max(0, RESERVE - size)
  // so any record can grow to RESERVE_BYTES whatever the others do. A record
  // growing inside its reservation moves bytes from slack to usage and leaves
  // the sum unchanged; that is the only growth allowed while usage is unknown.
  // One exception: a transition out of running (see _save) may put
  // usage + slack over maxBytes. While its bytes stand they come out of other
  // records' reservations, so even a transition inside a reservation can be
  // refused until expiry, collection or a delete frees room.
  _capacity(bytes, reserve = true, extraRecords = 0, slackDelta = 0) {
    const growth = bytes + slackDelta;
    if (this.usage === null) {
      // Unknown until a quiescent recount: anything that raises usage + slack
      // fails closed. Cleanup (deletes, expiry) never reaches here.
      if (growth > 0 || extraRecords > 0)
        throw problem(
          'STORE_RECOUNTING',
          'Reader storage usage is being recounted; retry shortly.',
          503
        );
      return;
    }
    if (!reserve && growth > 0 && this.usage + this.slack + growth > this.maxBytes)
      throw problem(
        'RESOURCE_LIMIT',
        'Reader storage quota reached; committed work is retained.',
        507
      );
    if (
      bytes > 0 &&
      this.usage + bytes + (reserve ? (this.records.size + extraRecords) * RESERVE_BYTES : 0) >
        this.maxBytes
    )
      throw problem(
        'RESOURCE_LIMIT',
        'Reader storage quota reached; committed work is retained.',
        507
      );
  }
  // `transition` marks a write that takes a record out of running, the only
  // writes exempt from the quota limit: the startup pause (the constructor),
  // a lease's expiry (_expireLeases) and a commit's quota pause (_quotaPause).
  // Refused, the store could not record that its job stopped: startup would
  // fail every restart, lease() and every lease check would throw for every
  // job, and a commit would leave its job running. Each is one write per
  // record leaving running, and it grows that record by at most the reason it
  // gains; its bytes are still counted in usage and slack. Any later growth of
  // the record is checked, and it leaves running again only after a resume
  // (which clears the reason) and a lease, so repeated cycles add nothing
  // more. Only the RESOURCE_LIMIT refusal of an existing running record with
  // known usage is skipped; an unknown usage, a new record or any other write
  // takes the full check. A lease is growth back into running and is never
  // exempt (see lease()); the running guards below keep it checked even if a
  // caller passed `transition`.
  _save(input, reserved = false, transition = false) {
    const { record_digest: _old, ...body } = input;
    body.updated_at = this.now();
    const record = { ...body, record_digest: sha(canonical(body)) };
    const bytes = encoded(record, 'Reader record');
    const file = path.join(this.directory, 'records', `${record.id}.json`);
    const previous = fs.existsSync(file) ? fs.statSync(file).size : 0;
    const slackDelta = reserveGap(bytes.length) - (previous ? reserveGap(previous) : 0);
    const leaving =
      transition &&
      this.usage !== null &&
      previous > 0 &&
      this.records.get(record.id)?.state === 'running' &&
      record.state !== 'running';
    if (!leaving) this._capacity(bytes.length - previous, !reserved, previous ? 0 : 1, slackDelta);
    this._beginWrite();
    this._inflight = true;
    atomicWrite(file, bytes, this.fault, 'record');
    if (this.usage !== null) this.usage += bytes.length - previous;
    this._inflight = false;
    this.slack += slackDelta;
    this.recordBytes.set(record.id, bytes.length);
    this.records.set(record.id, record);
    this.durableExpiry.set(record.id, record.expires_at);
    this._gc?.dirty.add(record.id);
    return clone(record);
  }
  _blob(kind, value) {
    const bytes = encoded(value, `${kind} object`);
    const hash = sha(bytes);
    const file = path.join(this.directory, kind, `${hash}.json`);
    if (fs.existsSync(file)) {
      if (!decodeStoredObject(this._readFile(file)).equals(bytes))
        throw problem('STORAGE_CORRUPT', 'Immutable object hash collision.', 503);
      // Re-referenced: refresh its mtime so a collection that began earlier
      // cannot sweep it (the sweep only deletes objects older than its mark).
      const now = new Date();
      fs.utimesSync(file, now, now);
    } else {
      let stored = bytes;
      if (kind === 'pages' && this.gzip) {
        const compressed = zlib.gzipSync(bytes);
        // Keep both stored and expanded sizes bounded, even for random input.
        if (compressed.length < bytes.length) stored = compressed;
      }
      const marker = path.join(this.directory, 'store-format.json');
      const format = Buffer.from(JSON.stringify({ min_reader: 'A' }));
      const compressed = stored !== bytes;
      const needsMarker = compressed && !fs.existsSync(marker);
      if (compressed && !needsMarker) {
        if (JSON.parse(this._readFile(marker)).min_reader !== 'A')
          throw problem('STORAGE_CORRUPT', 'Unknown reader store format.', 503);
      }
      this._capacity(stored.length + (needsMarker ? format.length : 0));
      this._beginWrite();
      this._inflight = true;
      // The compatibility floor becomes durable BEFORE any gzip page exists.
      if (needsMarker) {
        atomicWrite(marker, format, this.fault, 'store-format');
        if (this.usage !== null) this.usage += format.length;
      }
      atomicWrite(file, stored, this.fault, kind);
      if (this.usage !== null) this.usage += stored.length;
      this._inflight = false;
    }
    return { sha256: hash, bytes: bytes.length };
  }
  // Raw bytes, content-addressed (retained definitions keep their exact bytes).
  _rawBlob(kind, bytes) {
    const hash = sha(bytes);
    const file = path.join(this.directory, kind, `${hash}.json`);
    if (fs.existsSync(file)) {
      if (!decodeStoredObject(this._readFile(file)).equals(bytes))
        throw problem('STORAGE_CORRUPT', 'Immutable object hash collision.', 503);
      const now = new Date();
      fs.utimesSync(file, now, now);
    } else {
      this._capacity(bytes.length);
      this._beginWrite();
      this._inflight = true;
      atomicWrite(file, bytes, this.fault, kind);
      if (this.usage !== null) this.usage += bytes.length;
      this._inflight = false;
    }
    return hash;
  }
  _rawObject(kind, hash) {
    if (!HASH.test(hash || ''))
      throw problem('INVALID_DECLARATION', 'Invalid immutable object hash.', 400);
    let bytes;
    try {
      bytes = decodeStoredObject(this._readFile(path.join(this.directory, kind, `${hash}.json`)));
    } catch (error) {
      if (error.code === 'ENOENT')
        throw problem('STORAGE_CORRUPT', 'Committed reader object is missing.', 503);
      throw error;
    }
    if (sha(bytes) !== hash)
      throw problem('STORAGE_CORRUPT', 'Immutable reader object failed hash verification.', 503);
    return bytes;
  }
  /** A job's retained definition ('methods' | 'result_schema'), or null if it has none. */
  readDefinition(id, capability, viewer, which) {
    return this._cached(() => {
      const record = this._authorized(id, capability, viewer);
      const hash = record.definitions?.[`${which}_sha256`];
      return hash ? this._rawObject('definitions', hash) : null;
    });
  }
  // ── persisted discovery (DISCOVERY_V1, #656): predicates and segment reads ──
  // Single-sourced here for every later step. 'none' when `discovery` is
  // absent or null (every record on main lacks it, and complete() saves null,
  // so neither is malformed); 'malformed' when it is present, non-null and
  // fails §2.7's exact keys and types; 'released' when it passes and
  // `unavailable` is set; 'live' when it passes and `unavailable` is null.
  _discoveryShape(record) {
    const value = record?.discovery;
    if (value === undefined || value === null) return 'none';
    if (!discoveryStateShape(value)) return 'malformed';
    return value.unavailable === null ? 'live' : 'released';
  }
  // §7.1: a queued, running, paused or cancelled record with a live discovery.
  // Only these root the GC (§7.2). A completed record or a tombstone is never
  // read for discovery, and a malformed one roots nothing.
  _liveDiscovery(record) {
    return DISCOVERY_LIVE_STATES.has(record?.state) && this._discoveryShape(record) === 'live';
  }
  // One ['discovery', head] GC root per non-null head of a live record's logs.
  _discoveryRoots(record) {
    if (!this._liveDiscovery(record)) return [];
    return Object.values(record.discovery.logs)
      .filter((state) => state.head !== null)
      .map((state) => ['discovery', state.head]);
  }
  // A segment's bytes are decoded fatally, never with Buffer.toString or
  // JSON.parse on the buffer, which replace bytes that are not UTF-8 (§2.11).
  _segmentText(buf) {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf);
  }
  _segmentJSON(buf) {
    return JSON.parse(this._segmentText(buf));
  }
  // Reads one discovery segment (§2.5) and returns {missing}, {f6}, {f3: tag}
  // or {segment, bytes}; it never refuses with a public code itself. The file
  // is stat'ed first (BB8 6700200435, condition 7): ENOENT is {missing}, and
  // a stored size over READER_LIMITS.objectBytes, or a stat that is not a
  // regular file, is {f6} WITHOUT reading the file. A caller that has
  // stat'ed it already passes the size, and _segment does not stat it again
  // itself; _readFile, which every stored read goes through, makes its own
  // second stat. Only then is it read through _readFile and
  // decodeStoredObject: a failed bounded inflation, or bytes that do not
  // match the address, are {f6}. So is _readFile's own size refusal, met
  // only if the file is replaced by a larger one between the stat and the
  // read (segments are content-addressed and written once, so only a
  // foreign writer or damage can), and EISDIR from the read (a directory at
  // the address, or put there after the stat): one damaged segment releases
  // only its job, never the store (BB8 6707363590, condition 7).
  // `expect` null is a mark read: past F6, the strict decode, the parse and
  // `previous_hash`'s shape only (a malformed link is {f3}, never
  // INVALID_DECLARATION). Otherwise F3 runs in full against `expect`
  // ({job_id, identity_hash, epoch, log}). An address that is not 64-hex
  // names no file and is {f3}, so no caller's link reaches the filesystem.
  _segment(hash, expect, size = null) {
    if (!HASH.test(hash)) return { f3: 'FIELD' };
    const file = path.join(this.directory, 'pages', `${hash}.json`);
    if (size === null) {
      let stat;
      try {
        stat = fs.statSync(file);
      } catch (error) {
        if (error.code === 'ENOENT') return { missing: true };
        throw error;
      }
      if (!stat.isFile()) return { f6: true };
      size = stat.size;
    }
    if (size > READER_LIMITS.objectBytes) return { f6: true };
    let bytes;
    try {
      bytes = this._readFile(file);
    } catch (error) {
      if (error.code === 'ENOENT') return { missing: true };
      if (error.code === 'STORAGE_CORRUPT' || error.code === 'EISDIR') return { f6: true };
      throw error;
    }
    try {
      bytes = decodeStoredObject(bytes);
    } catch (error) {
      if (error.code === 'STORAGE_CORRUPT') return { f6: true };
      throw error;
    }
    if (sha(bytes) !== hash) return { f6: true };
    let segment;
    try {
      segment = this._segmentJSON(bytes);
    } catch {
      return { f3: 'JSON' };
    }
    if (expect === null) {
      if (!plainObject(segment)) return { f3: 'JSON' };
      if (segment.previous_hash !== null && !isDigest(segment.previous_hash))
        return { f3: 'FIELD' };
      return { segment, bytes };
    }
    const content = segmentContent(segment, expect);
    const [fault] = content.faults;
    // `entryBytes` is the sum of its entries' canonical bytes, for R2.
    return fault ? { f3: fault.tag } : { segment, bytes, entryBytes: content.bytes };
  }
  // ── the full read and reconciliation (§5.1, §7.4) ──────────────────────
  // A full read of one log of a live record: from the record's head, back
  // along previous_hash, at most the head's `segments` reads (a head past
  // CHAIN_SEGMENTS is R2 with nothing read), never the address list. Every read is _segment's, which stats first and returns a
  // fault rather than refusing: {missing} is segment_missing, {f6} (bytes
  // that do not match the address, a failed bounded inflation, a stored size
  // over the bound never read, or a file that is not regular) is
  // segment_corrupt, and {f3} is chain_broken. Then R2, oldest first: the
  // oldest has previous_hash null, first 0 and digest_before d0; each links
  // to the one before; and the chain ends at exactly the head's state,
  // `bytes` included. Returns {addresses} (oldest first), or {cause, rule}
  // with the rule that failed ('missing', 'F6', 'F3' or 'R2'; tests read it,
  // nothing stores it). Any other error keeps its own code.
  _fullRead(record, log) {
    const discovery = record.discovery;
    const head = discovery.logs[log];
    const expect = {
      job_id: record.id,
      identity_hash: record.identity_hash,
      epoch: discovery.epoch,
      log,
    };
    const broken = { cause: 'chain_broken', rule: 'R2' };
    // W5 holds every chain to CHAIN_SEGMENTS, so a head past it is R2 before
    // any read: the stored value never bounds the loop by itself (§5.1).
    if (head.segments > DISCOVERY_LIMITS.CHAIN_SEGMENTS) return broken;
    const chain = [];
    let address = head.head;
    while (address !== null && chain.length < head.segments) {
      const read = this._segment(address, expect);
      if (read.missing) return { cause: 'segment_missing', rule: 'missing' };
      if (read.f6) return { cause: 'segment_corrupt', rule: 'F6' };
      if (!read.segment) return { cause: 'chain_broken', rule: 'F3' };
      chain.push({ address, segment: read.segment, entryBytes: read.entryBytes });
      address = read.segment.previous_hash;
    }
    chain.reverse(); // read newest first; R2 runs oldest first
    if (address !== null || chain.length !== head.segments) return broken;
    let at = {
      head: null,
      segments: 0,
      count: 0,
      bytes: 0,
      digest: domainDigest(DOMAINS.log(log)),
    };
    for (const { address: a, segment, entryBytes } of chain) {
      if (
        segment.previous_hash !== at.head ||
        segment.first !== at.count ||
        segment.digest_before !== at.digest
      )
        return broken;
      at = {
        head: a,
        segments: at.segments + 1,
        count: segment.first + segment.count,
        bytes: at.bytes + entryBytes,
        digest: segment.digest_after,
      };
    }
    if (canonical(at) !== canonical(head)) return broken;
    return { addresses: chain.map((c) => c.address) };
  }
  // A release (U1, §7.4): one save that empties `logs` and `verified` and
  // sets `unavailable`, naming each released log with its head. A queued job
  // is paused with a null fence, keeping its attempt and queue fields; a
  // running job keeps its state, lease, fence and reason (its next refusal
  // pauses it); a paused, cancelled or queued job's reason is copied from
  // `unavailable` with no message (U2). `deferred_requeue` is cleared in
  // every state, so no later _promoteDeferred requeues a released job. A
  // no-op when `unavailable` is set: the first trace wins. The release of a
  // well-formed record is never larger than the record it replaces (§7.4):
  // a growth is this image's defect, thrown without a status, never saved.
  _release(record, { cause, log }) {
    if (record.discovery.unavailable !== null) return record;
    const discovery = releasedDiscovery(record.discovery, cause, log);
    const queued = record.state === 'queued';
    const release = {
      ...record,
      ...(queued ? { state: 'paused', fence: null } : {}),
      deferred_requeue: false,
      ...(record.state === 'running' ? {} : { reason: unavailableReason(discovery.unavailable) }),
      discovery,
    };
    // Asserted before the save, at its widest: _save stamps updated_at, which
    // is never past 2^53 - 1, and a 64-hex record_digest.
    const widest = encoded(
      { ...release, updated_at: Number.MAX_SAFE_INTEGER, record_digest: '0'.repeat(64) },
      'Reader record'
    ).length;
    const before = this.recordBytes.get(record.id);
    if (widest > before)
      throw new Error(`A reader release would grow its record from ${before} to ${widest} bytes.`);
    const saved = this._save(release, true);
    this.chains.delete(record.id);
    this._logRelease(record.id, cause, log);
    return saved;
  }
  // One log line per release: error level for segment_corrupt (BB8 6681838131).
  _logRelease(job, cause, log) {
    const line = JSON.stringify({ event: 'READER_DISCOVERY_RELEASED', job, cause, log });
    if (cause === 'segment_corrupt') console.error(line);
    else console.warn(line);
  }
  // One log line when complete() erases a saved release's trace (Q5): its
  // cause, its log and the heads it released, all of the record's validated
  // unavailable (§2.7), so nothing else is named. `outcome` is `saved` when
  // the erasing save returned, `unknown` when it threw without a status and
  // may have landed (§4). Its level follows the cause, as _logRelease's
  // does: error for segment_corrupt, warn otherwise (BB8 6715584092).
  _logTraceErased(job, { cause, log, released }, outcome) {
    const line = JSON.stringify({
      event: 'READER_DISCOVERY_TRACE_ERASED',
      job,
      outcome,
      cause,
      log,
      released,
    });
    if (cause === 'segment_corrupt') console.error(line);
    else console.warn(line);
  }
  // The release §7.4 gives a malformed record.discovery (§2.7; BB8
  // 6700200435, condition 4): the per-state rules of _release, with the
  // well-formed released shape, cause chain_broken and log null. `epoch` is
  // the value's own when it is an integer from 0 to 2^53 - 1, else 0;
  // `released` names each well-formed log name with its head when that is
  // 64-hex, else null ({} when none is readable). Built from the record as
  // it is now, so a view or a later save never shows stale fields.
  _malformedRelease(record) {
    const value = record.discovery;
    const epoch = plainObject(value) && nonNegative(value.epoch) ? value.epoch : 0;
    const logs = plainObject(value) && plainObject(value.logs) ? value.logs : {};
    const released = Object.fromEntries(
      Object.entries(logs)
        .filter(([name]) => LOGS.includes(name))
        .map(([name, state]) => [
          name,
          plainObject(state) && isDigest(state.head) ? state.head : null,
        ])
    );
    const unavailable = { cause: 'chain_broken', log: null, released };
    const queued = record.state === 'queued';
    return {
      ...record,
      ...(queued ? { state: 'paused', fence: null } : {}),
      deferred_requeue: false,
      ...(record.state === 'running'
        ? {}
        : {
            reason: {
              code: 'DISCOVERY_UNAVAILABLE',
              cause: 'chain_broken',
              log: null,
              released: clone(released),
            },
          }),
      discovery: { version: 1, epoch, logs: {}, verified: {}, unavailable },
    };
  }
  // Saves a malformed record's release when _capacity admits it; a refusal
  // with a status (STORE_RECOUNTING while usage is unknown, RESOURCE_LIMIT
  // at full quota) leaves it pending and is logged, never thrown. Logged
  // once at error level when first found, and its release once when its save
  // lands, as every release is (here, or in a U2 save that carries it:
  // _saveReason). An error without a status fails the store, as any write
  // does.
  _releaseMalformed(record) {
    if (!this._malformedLogged.has(record.id)) {
      this._malformedLogged.add(record.id);
      console.error(JSON.stringify({ event: 'READER_DISCOVERY_MALFORMED', job: record.id }));
    }
    try {
      this._save(this._malformedRelease(record), true);
      this.pendingRelease.delete(record.id);
      this.chains.delete(record.id);
      this._logRelease(record.id, 'chain_broken', null);
      return true;
    } catch (error) {
      if (!error.status) throw error;
      this.pendingRelease.set(record.id, true);
      console.warn(
        JSON.stringify({ event: 'READER_REPAIR_DEFERRED', job: record.id, code: error.code })
      );
      return false;
    }
  }
  // The first points usage is known: startup after the usage scan, a
  // recount's acceptance, and lease() with usage known. Each pending release
  // still malformed is saved, or stays pending.
  _savePending() {
    for (const id of [...this.pendingRelease.keys()]) {
      const record = this.records.get(id);
      if (
        !record ||
        !DISCOVERY_LIVE_STATES.has(record.state) ||
        this._discoveryShape(record) !== 'malformed'
      ) {
        this.pendingRelease.delete(id);
        continue;
      }
      this._releaseMalformed(record);
    }
  }
  // The job view of a record (get, inspect): a pending release, and the
  // repair of a queued record whose unavailable is set, are shown as the save
  // the store has decided and is waiting to make, so no record that is not
  // dispatched is ever shown queued (§7.4).
  _shown(record) {
    const live = record && this.records.get(record.id);
    if (!live) return record;
    const kept = pick(record, ['accessed_at', 'expires_at']);
    if (this.pendingRelease.has(record.id))
      return { ...clone(this._malformedRelease(live)), ...kept };
    // A queued record whose unavailable is set shows as its repair (§7.4).
    if (live.state === 'queued' && this._discoveryShape(live) === 'released')
      return { ...clone(this._repaired(live)), ...kept };
    return record;
  }
  // The refusal of a pending release, exactly as after its save (§8).
  _refusePending(id) {
    if (this.pendingRelease.has(id)) throw unavailableRefusal({ cause: 'chain_broken', log: null });
  }
  // The refusal from a saved `unavailable` (§2.7, §8), with its cause and log.
  _refuseUnavailable(record) {
    if (this._discoveryShape(record) === 'released')
      throw unavailableRefusal(record.discovery.unavailable);
  }
  // U2 (§8), from the record's `unavailable`, or from its pending release
  // (§7.4, Step 6), so a save of a pending job writes that release too: the
  // save, when it lands, is the durable release. Returns {base, reason}, the
  // record the save starts from and the reason it writes, or null when the
  // job holds no `unavailable` and no pending release.
  _u2(record) {
    const base = this.pendingRelease.has(record.id) ? this._malformedRelease(record) : record;
    if (this._discoveryShape(base) !== 'released') return null;
    return { base, reason: unavailableReason(base.discovery.unavailable) };
  }
  // Every save that writes a job's reason (§8, U2): `build(base, reason)` is
  // the record it saves, `reason` the U2 reason or null when U2 does not
  // apply. A save that carries a pending release and is refused with a status
  // (STORE_RECOUNTING while usage is unknown, RESOURCE_LIMIT at full quota) is
  // logged and made again from the record as it is, with the reason it
  // would hold without U2; the release stays pending and shown. So none of
  // these saves fails where it did not before (§7.4, "No refusal at lease
  // time"). A saved release drops the job's lists, and a pending one that
  // lands is logged as its release, once: the fallback leaves it pending, so
  // the next save that carries it, or the next point usage is known
  // (_savePending), completes it. `transition` is _save's: the three
  // transitions out of running that are never refused for quota pass it.
  // A save that carries a pending release is not exempt, since it grows the
  // record by the release as well as the reason; its fallback, which grows
  // it by the reason alone, is. So the transition always commits, and at a
  // full quota the release stays pending, as before.
  _saveReason(record, build, transition = false) {
    const u2 = this._u2(record);
    const pending = u2 !== null && u2.base !== record;
    let saved;
    try {
      saved = this._save(
        build(u2?.base ?? record, u2?.reason ?? null),
        true,
        transition && !pending
      );
    } catch (error) {
      if (!pending || !error.status) throw error;
      console.warn(
        JSON.stringify({ event: 'READER_REPAIR_DEFERRED', job: record.id, code: error.code })
      );
      return this._save(build(record, null), true, transition);
    }
    if (pending) {
      this.pendingRelease.delete(record.id);
      this._logRelease(record.id, 'chain_broken', null);
    }
    if (this._discoveryShape(saved) === 'released') this.chains.delete(record.id);
    return saved;
  }
  // The repair of a queued record whose `unavailable` is set, as an older
  // image's resume() or _promoteDeferred can leave it (§7.4; BB8 6700200435,
  // on R2's question 6): paused with the U2 reason, deferred_requeue false and
  // a null fence, its queue fields and attempt kept.
  _repaired(record) {
    return {
      ...record,
      state: 'paused',
      fence: null,
      deferred_requeue: false,
      reason: unavailableReason(record.discovery.unavailable),
    };
  }
  // Each repair is saved where usage is known (startup after the usage scan,
  // lease() with usage known). A refusal with a status is logged and the
  // record skipped, to be retried at the next such point: a repair never
  // throws from lease() or startup. An error without a status still fails
  // the store, as any write does.
  _repairReleased() {
    for (const record of [...this.records.values()]) {
      if (record.state !== 'queued' || this._discoveryShape(record) !== 'released') continue;
      try {
        this._save(this._repaired(record), true);
      } catch (error) {
        if (!error.status) throw error;
        console.warn(
          JSON.stringify({ event: 'READER_REPAIR_DEFERRED', job: record.id, code: error.code })
        );
      }
    }
  }
  // Reconciliation (§7.4), on every lock entry that reloaded, startup's
  // first included: a full read of every chain of each record
  // _liveDiscovery accepts (the GC's roots, §7.1). A chain that reads
  // installs its address lists and saves nothing; one that does not releases
  // its job in one save and the store goes on to the next. A record with no
  // discovery is never read.
  _reconcile() {
    for (const record of [...this.records.values()]) {
      if (DISCOVERY_LIVE_STATES.has(record.state) && this._discoveryShape(record) === 'malformed') {
        this._releaseMalformed(record);
        continue;
      }
      if (!this._liveDiscovery(record)) continue;
      const lists = new Map();
      let failed = null;
      for (const log of Object.keys(record.discovery.logs)) {
        const read = this._fullRead(record, log);
        if (read.cause) {
          failed = { cause: read.cause, log };
          break;
        }
        lists.set(log, read.addresses);
      }
      if (failed) this._release(record, failed);
      else this.chains.set(record.id, lists);
    }
  }
  _object(kind, hash) {
    if (!HASH.test(hash || ''))
      throw problem('INVALID_DECLARATION', 'Invalid immutable object hash.', 400);
    let bytes;
    try {
      bytes = this._readFile(path.join(this.directory, kind, `${hash}.json`));
    } catch (error) {
      if (error.code === 'ENOENT')
        throw problem('STORAGE_CORRUPT', 'Committed reader object is missing.', 503);
      throw error;
    }
    bytes = decodeStoredObject(bytes);
    if (sha(bytes) !== hash)
      throw problem('STORAGE_CORRUPT', 'Immutable reader object failed hash verification.', 503);
    return JSON.parse(bytes);
  }
  _require(id) {
    const record = ID.test(id || '') ? this.records.get(id) : null;
    if (!record) throw problem('NOT_FOUND', 'Reader job does not exist.', 404);
    return record;
  }
  _capability(record) {
    return crypto
      .createHmac('sha256', this.key)
      .update(`reader-v1\0${record.id}\0${record.viewer}`)
      .digest('hex');
  }
  // Trusted, in-process only: the /library/v1 router derives the capability
  // for a cookie's viewer on every call. It is never serialised anywhere.
  capabilityFor(id, viewer) {
    if (!ID.test(id || '') || typeof viewer !== 'string' || !viewer)
      throw problem('NOT_FOUND', 'Reader job does not exist.', 404);
    return this._capability({ id, viewer });
  }
  _expiredUnswept(record) {
    return !['expired', 'deleted'].includes(record.state) && record.expires_at <= this.now();
  }
  _authorized(id, capability, viewer) {
    const record = this._require(id);
    if (
      typeof viewer !== 'string' ||
      viewer !== record.viewer ||
      !HASH.test(capability || '') ||
      !crypto.timingSafeEqual(
        Buffer.from(capability, 'hex'),
        Buffer.from(this._capability(record), 'hex')
      )
    )
      throw problem('NOT_FOUND', 'Reader job does not exist.', 404);
    // Expiry binds at read time, whether or not the sweep has run yet.
    if (['expired', 'deleted'].includes(record.state) || this._expiredUnswept(record))
      throw problem(
        'RESULT_EXPIRED',
        'Reader result expired or was deleted; explicitly create a new analysis with a new key.',
        410
      );
    return record;
  }
  _touch(record) {
    return this._save(
      { ...record, accessed_at: this.now(), expires_at: this.now() + this.ttlMs },
      true
    );
  }
  // A read against the cached records, without the writer lock. Only when the
  // generation moved (another writer) or a write is pending does it take the
  // lock, which reloads the cache.
  _cached(run) {
    if (this.failure)
      throw problem(
        'STORAGE_UNAVAILABLE',
        'Reader persistence failed; committed work is retained.',
        503
      );
    if (this._hasPending() || this._readGeneration() !== this.generation) return this._open(run);
    return run();
  }
  // Slide retention after an authorised read: in memory every time, durably
  // only when the persisted expiry is more than TOUCH_INTERVAL_MS stale.
  _refresh(record, authorize) {
    const now = this.now();
    const durable = this.durableExpiry.get(record.id) ?? record.expires_at;
    if (now + this.ttlMs - durable <= TOUCH_INTERVAL_MS) {
      const live = this.records.get(record.id);
      if (live) {
        live.accessed_at = now;
        live.expires_at = now + this.ttlMs;
      }
      return clone(live || record);
    }
    return this._open(() => this._touch(authorize()));
  }
  _open(run) {
    try {
      return this._locked(run);
    } catch (error) {
      if (!error.status) {
        // A write that throws without a status may have landed (§4): the
        // outcome is unknown, so no list is used again until a restart's
        // reconciliation rebuilds them from the durable heads (§5.1).
        this.failure = error.message;
        this.chains = new Map();
        throw problem(
          'STORAGE_UNAVAILABLE',
          'Reader persistence failed; committed work is retained.',
          503
        );
      }
      throw error;
    }
  }
  _outstanding(viewer) {
    return [...this.records.values()].filter(
      (r) => r.viewer === viewer && OUTSTANDING.has(r.state) && !this._expiredUnswept(r)
    ).length;
  }
  _queueRoom() {
    if (
      [...this.records.values()].filter((r) => r.state === 'queued' && !this._expiredUnswept(r))
        .length >= READER_LIMITS.waiting
    )
      throw problem(
        'QUEUE_FULL',
        'The durable reader queue has 16 waiting jobs; retry after a job is dispatched.',
        429
      );
  }
  _tailOrder() {
    return Math.max(0, ...[...this.records.values()].map((r) => r.queue_order || 0)) + 1;
  }
  _queueSort(a, b) {
    return (
      (a.queue_order ?? a.queued_at) - (b.queue_order ?? b.queued_at) ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
    );
  }

  /** Whether a create with this viewer and key would replay (or refuse as
   * expired) an earlier one, rather than queue a new job. */
  hasCreate(viewer, idempotency_key) {
    const idempotency_hash = sha(`${viewer}\0${idempotency_key}`);
    return [...this.records.values()].some((r) => r.idempotency_hash === idempotency_hash);
  }
  create({ viewer, idempotency_key, identity, request, definitions = null }) {
    text(viewer, 'Viewer');
    text(idempotency_key, 'Idempotency key');
    const identity_hash = identityHash(identity);
    const intent = jsonValue(request, 'Reader request');
    encoded(intent, 'Reader request');
    const idempotency_hash = sha(`${viewer}\0${idempotency_key}`);
    const request_digest = sha(canonical({ identity, request: intent }));
    return this._open(() => {
      const prior = [...this.records.values()].find((r) => r.idempotency_hash === idempotency_hash);
      if (prior) {
        if (prior.request_digest !== request_digest)
          throw problem(
            'IDEMPOTENCY_CONFLICT',
            'Idempotency key already belongs to changed input.'
          );
        if (['expired', 'deleted'].includes(prior.state) || this._expiredUnswept(prior))
          throw problem(
            'RESULT_EXPIRED',
            'This analysis expired or was deleted; a new analysis needs a new key.',
            410
          );
        const record = this._touch(prior);
        return { created: false, record, capability: this._capability(record) };
      }
      this._queueRoom();
      if (this._outstanding(viewer) >= READER_LIMITS.outstandingPerViewer)
        throw problem('QUEUE_FULL', 'This viewer already has two outstanding reader jobs.', 429);
      const now = this.now();
      // Retained definitions: the exact bytes in force at creation.
      const retained = definitions
        ? {
            methods_sha256: this._rawBlob('definitions', Buffer.from(definitions.methods)),
            result_schema_sha256: this._rawBlob(
              'definitions',
              Buffer.from(definitions.result_schema)
            ),
          }
        : null;
      const record = this._save({
        version: 1,
        id: `reader_${crypto.randomBytes(32).toString('hex')}`,
        ...(retained ? { definitions: retained } : {}),
        viewer,
        identity: jsonValue(identity, 'Analysis identity'),
        identity_hash,
        request: intent,
        request_digest,
        idempotency_hash,
        state: 'queued',
        attempt: 0,
        fence: null,
        cursor: null,
        progress: null,
        coverage: null,
        page_refs: [],
        page_index_hash: null,
        page_count: 0,
        evidence_count: 0,
        generation: 0,
        checkpoint_hash: null,
        manifest_hash: null,
        cancel_requested: false,
        lease_expires_at: null,
        reason: null,
        deferred_requeue: false,
        control_receipts: [],
        created_at: now,
        queued_at: now,
        queue_order: this._tailOrder(),
        accessed_at: now,
        updated_at: now,
        expires_at: now + this.ttlMs,
      });
      return { created: true, record, capability: this._capability(record) };
    });
  }

  // With no id, the first queued job whose lease fits is leased. A lease grows
  // its record back into running and always takes the quota check: a job it
  // does not fit (RESOURCE_LIMIT, or STORE_RECOUNTING while usage is unknown)
  // stays queued with nothing written and the next one is tried, so one job
  // that has outgrown the room left never stops the queue behind it. null
  // when none fits. lease(id) still refuses.
  lease(id = null) {
    return this._open(() => {
      if (this.usage !== null) {
        this._savePending();
        this._repairReleased();
      }
      this._expireLeases();
      this._promoteDeferred();
      if ([...this.records.values()].some((r) => r.state === 'running')) return null;
      const queued = this._dispatchable();
      const candidates = id ? [this._require(id)] : queued.sort((a, b) => this._queueSort(a, b));
      for (const record of candidates) {
        if (record.state !== 'queued') return null;
        if (this.pendingRelease.has(record.id)) return null; // a pending release (§7.4)
        if (this._discoveryShape(record) === 'released') return null; // a repair to come (§7.4)
        let leased;
        try {
          leased = this._save(
            {
              ...record,
              state: 'running',
              attempt: record.attempt + 1,
              fence: crypto.randomBytes(32).toString('hex'),
              lease_expires_at: this.now() + this.leaseMs,
              cancel_requested: false,
              deferred_requeue: false,
              reason: null,
            },
            true
          );
        } catch (error) {
          if (id || !roomRefusal(error)) throw error;
          continue;
        }
        this._promoteDeferred();
        return leased;
      }
      return null;
    });
  }
  _promoteDeferred() {
    let room =
      READER_LIMITS.waiting - [...this.records.values()].filter((r) => r.state === 'queued').length;
    const deferred = [...this.records.values()]
      .filter(
        (r) =>
          r.state === 'paused' &&
          r.deferred_requeue &&
          !this.pendingRelease.has(r.id) &&
          this._discoveryShape(r) !== 'released' && // an older image's flag (§7.4)
          !this._expireIfDue(r)
      )
      .sort((a, b) => this._queueSort(a, b));
    for (const record of deferred) {
      if (room-- <= 0) break;
      this._save(
        {
          ...record,
          state: 'queued',
          deferred_requeue: false,
          queued_at: this.now(),
          queue_order: this._tailOrder(),
          reason: null,
        },
        true
      );
    }
  }
  // An expired lease always records its pause, whatever the quota (see
  // _save): refused, lease() and every lease check would throw for every job.
  _expireLeases() {
    for (const record of [...this.records.values()]) {
      if (record.state === 'running' && record.lease_expires_at <= this.now())
        this._saveReason(
          record,
          (base, reason) => ({
            ...base,
            state: record.cancel_requested ? 'cancelled' : 'paused',
            fence: null,
            lease_expires_at: null,
            cancel_requested: false,
            deferred_requeue: false,
            reason: reason ?? {
              code: 'INTERRUPTED',
              message: 'Lease expired; resume the last durable checkpoint explicitly.',
            },
          }),
          true
        );
    }
  }
  // Expiry binds before any sweep: a job past its expiry is tombstoned the
  // moment dispatch or a lease would touch it, so no expired work runs.
  _expireIfDue(record) {
    if (!this._expiredUnswept(record)) return false;
    this._tombstone(record, 'expired');
    return true;
  }
  _dispatchable() {
    const queued = [];
    for (const record of [...this.records.values()])
      if (
        record.state === 'queued' &&
        !this._expireIfDue(record) &&
        !this.pendingRelease.has(record.id) &&
        this._discoveryShape(record) !== 'released' // until its repair lands (§7.4)
      )
        queued.push(record);
    return queued;
  }
  _leaseRecord(id, attempt, fence) {
    this._expireLeases();
    if (this._expireIfDue(this._require(id)))
      throw problem('STALE_ATTEMPT', 'The reader job expired; its lease ended.');
    const record = this._require(id);
    if (record.state !== 'running' || record.attempt !== attempt || record.fence !== fence)
      throw problem('STALE_ATTEMPT', 'The worker no longer owns this reader lease.');
    return record;
  }
  _quotaPause(record, error) {
    if (!roomRefusal(error)) throw error;
    const recounting = error.code === 'STORE_RECOUNTING';
    // The cursor is unchanged. This pause is durable whatever the quota (see
    // _save): refused, the job would stay running. While usage is unknown it
    // takes the full check, and a recount pause returns to the queue by
    // itself once a slot opens, unless U2 holds the reason: a released job is
    // never requeued (§8).
    return this._saveReason(
      record,
      (base, reason) => ({
        ...base,
        state: record.cancel_requested ? 'cancelled' : 'paused',
        cancel_requested: false,
        deferred_requeue: reason === null && recounting && !record.cancel_requested,
        fence: null,
        lease_expires_at: null,
        reason: reason ?? { code: error.code, message: error.message },
      }),
      true
    );
  }
  // §4 step 3, under the lock: the commit's discovery plan, or null for a
  // commit whose frame, cursor and record carry none. A rule's refusal is
  // READER_PROTOCOL (400), naming the rule; nothing has been written.
  _planDiscovery(record, input) {
    const live = this._discoveryShape(record) === 'live';
    try {
      return planDiscovery(
        { ...record, discovery: live ? record.discovery : null },
        input,
        canonical
      );
    } catch (error) {
      if (!(error instanceof DiscoveryCodecError)) throw error;
      const rule = { INTEGER_FIELD: 'W1' }[error.rule] ?? error.rule;
      throw Object.assign(
        problem('READER_PROTOCOL', `Reader discovery frame refused: ${rule}.`, 400),
        { rule }
      );
    }
  }
  // After a commit's record save returns (§5.1): each seal's address is
  // appended to the list of its (job, log), or to a new list started at []
  // when the log's head before the seal was null (a new log, or one this
  // frame released or reset). A log whose head was not null and that has no
  // list is left without one: a lease's R5 refuses it and resume()'s full
  // read rebuilds it. Only the record's logs keep a list, so an epoch
  // advance, whose logs are all fresh, drops every list of the old epoch.
  _commitLists(id, plan) {
    const old = this.chains.get(id) ?? new Map();
    const next = new Map();
    for (const log of Object.keys(plan.discovery.logs)) {
      const base = plan.fresh.has(log) ? [] : old.get(log);
      if (base === undefined) continue;
      next.set(log, [...base, ...(plan.appended[log] ?? [])]);
    }
    if (next.size) this.chains.set(id, next);
    else this.chains.delete(id);
  }
  _page(value) {
    if (
      value &&
      typeof value === 'object' &&
      typeof value.sha256 === 'string' &&
      !('instances' in value)
    ) {
      const page = this._object('pages', value.sha256);
      const count = page.instances?.length;
      if (!Array.isArray(page.instances) || count > READER_LIMITS.pageInstances)
        throw problem('STORAGE_CORRUPT', 'Referenced evidence page has invalid instances.', 503);
      // Re-referenced by hash: refresh its mtime, as _blob does, so a
      // collection that began earlier cannot sweep it.
      const now = new Date();
      fs.utimesSync(path.join(this.directory, 'pages', `${value.sha256}.json`), now, now);
      return { sha256: value.sha256, count, bytes: encoded(page, 'Evidence page').length };
    }
    const page = jsonValue(value, 'Evidence page');
    if (
      !page ||
      !Array.isArray(page.instances) ||
      page.instances.length > READER_LIMITS.pageInstances
    )
      throw problem('RESOURCE_LIMIT', 'An evidence page requires at most 250 instances.', 413);
    const ref = this._blob('pages', page);
    return { ...ref, count: page.instances.length };
  }
  *_refs(root) {
    const nodes = [],
      seen = new Set();
    for (let hash = root; hash; ) {
      if (seen.has(hash))
        throw problem('STORAGE_CORRUPT', 'Reader page index contains a cycle.', 503);
      seen.add(hash);
      const index = this._object('indexes', hash);
      if (!Array.isArray(index.page_refs) || index.page_refs.length > 250)
        throw problem('STORAGE_CORRUPT', 'Reader index page is invalid.', 503);
      nodes.push(index);
      hash = index.previous_hash;
    }
    for (let i = nodes.length - 1; i >= 0; i--) yield* nodes[i].page_refs;
  }
  commitCheckpoint(id, attempt, fence, payload) {
    const input = jsonValue(payload, 'Checkpoint');
    encoded(input, 'Checkpoint control');
    if (!input || !('cursor' in input) || !Array.isArray(input.pages || []))
      throw problem(
        'INVALID_DECLARATION',
        'Checkpoint requires a cursor and optional evidence pages.',
        400
      );
    return this._open(() => {
      const record = this._leaseRecord(id, attempt, fence);
      this._refusePending(id);
      const inputDigest = sha(canonical(input));
      if (record.last_checkpoint_digest === inputDigest)
        return { ...clone(record), added_page_paths: [] };
      if (
        input.previous_generation !== undefined &&
        input.previous_generation !== record.generation
      )
        throw problem('STALE_ATTEMPT', 'Checkpoint was built against an older result generation.');
      // §4 step 3: a released job's commit is refused before any rule runs,
      // and writes nothing; its holder's pause then carries the cause (§7.4).
      this._refuseUnavailable(record);
      // §4 step 3: every rule runs before anything is written, outside the
      // try, so a refusal never reaches _quotaPause.
      const plan = this._planDiscovery(record, input);
      try {
        const refs = (input.pages || []).map((page) => this._page(page));
        let root = record.page_index_hash;
        for (let offset = 0; offset < refs.length; offset += 250)
          root = this._blob('indexes', {
            version: 1,
            previous_hash: root,
            page_refs: refs.slice(offset, offset + 250),
          }).sha256;
        const page_count = record.page_count + refs.length;
        const evidence_count = record.evidence_count + refs.reduce((n, r) => n + r.count, 0);
        const inline = page_count <= 250 ? [...this._refs(root)] : [];
        const coverage = input.coverage ?? record.coverage;
        const progress = input.progress ?? record.progress;
        const generation = record.generation + 1;
        const manifest = this._blob('manifests', {
          version: 1,
          job_id: id,
          identity: record.identity,
          identity_hash: record.identity_hash,
          generation,
          partial: true,
          page_index_hash: root,
          page_refs: inline,
          page_count,
          evidence_count,
          coverage,
          progress,
        });
        // A checkpoint object is history: it links this generation's manifest
        // and page index to the one before, and carries no cursor. The record
        // is the head and holds the one cursor resume reads (#656: a cursor
        // copy in every generation filled the quota). Checkpoints written
        // before this change still carry one; nothing reads it.
        const checkpoint = this._blob('checkpoints', {
          version: 1,
          job_id: id,
          identity_hash: record.identity_hash,
          previous_hash: record.checkpoint_hash,
          generation,
          progress,
          coverage,
          page_index_hash: root,
          page_count,
          evidence_count,
          manifest_hash: manifest.sha256,
        });
        // §4 step 4: one segment per seal, in seal order, then the record.
        for (const { address, segment } of plan?.segments ?? [])
          if (this._blob('pages', segment).sha256 !== address)
            throw new Error('A reader discovery segment was stored at another address.');
        const saved = this._save({
          ...record,
          cursor: input.cursor,
          progress,
          coverage,
          page_refs: inline,
          page_index_hash: root,
          page_count,
          evidence_count,
          generation,
          checkpoint_hash: checkpoint.sha256,
          manifest_hash: manifest.sha256,
          last_checkpoint_digest: inputDigest,
          ...(plan ? { discovery: plan.discovery } : {}),
        });
        // The lists change only once the record save has returned (§5.1).
        if (plan) this._commitLists(id, plan);
        return {
          ...saved,
          added_page_paths: refs.map((ref) =>
            path.join(this.directory, 'pages', `${ref.sha256}.json`)
          ),
        };
      } catch (error) {
        return this._quotaPause(record, error);
      }
    });
  }

  complete(id, attempt, fence, payload) {
    const final = jsonValue(payload, 'Final manifest');
    encoded(final, 'Final manifest');
    if (final?.exhausted !== true || final?.census_reconciled !== true)
      throw problem(
        'INCOMPLETE_TRAVERSAL',
        'Completion requires exhausted traversals and a reconciled full census.'
      );
    const coverage = final.coverage ?? final.summary?.coverage;
    if (!coverage || typeof coverage !== 'object' || coverage.partial === true)
      throw problem(
        'INVALID_DECLARATION',
        'Completion requires an explicit complete coverage census.',
        400
      );
    const count = (value) =>
      Array.isArray(value)
        ? value.length
        : Number.isSafeInteger(value) && value >= 0
          ? value
          : null;
    const requested = count(coverage.requested_methods),
      answered = count(coverage.answered_methods);
    const refused = count(coverage.refused_methods);
    const hasCensus = requested !== null && answered !== null && refused !== null;
    const obligations = Array.isArray(coverage.refused_obligations)
      ? coverage.refused_obligations.length
      : null;
    if (hasCensus && (coverage.partial !== false || requested !== answered + refused))
      throw problem(
        'CENSUS_MISMATCH',
        'Requested methods do not reconcile with answered and refused methods.'
      );
    if (hasCensus && coverage.pending_methods !== undefined && coverage.pending_methods !== 0)
      throw problem('CENSUS_MISMATCH', 'Requested methods still await traversal.');
    if (hasCensus && obligations !== null && obligations !== refused)
      throw problem(
        'CENSUS_MISMATCH',
        'Refused methods disagree with their named obligation census.'
      );
    if (!hasCensus && (typeof coverage.certified !== 'boolean' || obligations === null))
      throw problem(
        'INVALID_DECLARATION',
        'Completion needs a reconciled methods or obligation coverage census.',
        400
      );
    const certified = hasCensus ? refused === 0 : obligations === 0;
    if (typeof coverage.certified === 'boolean' && coverage.certified !== certified)
      throw problem('CENSUS_MISMATCH', 'Certification disagrees with the refusal census.');
    if (final.provider_calls !== undefined && final.provider_calls !== 0)
      throw problem('INVALID_READER_RESULT', 'Reader analysis may not invoke a model provider.');
    const methods = final.summary?.methods;
    if (hasCensus && Array.isArray(methods)) {
      const ids = methods.map((method) => method.method_id);
      if (
        new Set(ids).size !== ids.length ||
        ids.some((id) => typeof id !== 'string' || !id) ||
        methods.filter((method) => method.coverage === 'answered').length !== answered ||
        methods.filter((method) => method.coverage === 'refused').length !== refused ||
        methods.length !== requested
      )
        throw problem(
          'CENSUS_MISMATCH',
          'Method rows do not reconcile with the complete coverage census.'
        );
    }
    // Q5 (BB8 23:20Z, on Step 8): a release already saved holds its trace in
    // `unavailable`, which the completing save's null erases. It is read here,
    // under the lock, before that save, and logged once the save lands. A save
    // that throws without a status may have landed (§4): the trace is logged
    // then too, as of unknown outcome, since nothing could log it later.
    let trace = null;
    let unknown = false;
    let saving = false;
    const completing = () => {
      const record = this._leaseRecord(id, attempt, fence);
      trace = this._discoveryShape(record) === 'released' ? record.discovery.unavailable : null;
      if (record.cancel_requested)
        throw problem(
          'CANCEL_REQUESTED',
          'Cancellation is pending; checkpoint and cancel rather than complete.'
        );
      if (record.cursor?.done !== true && record.cursor?.phase !== 'done')
        throw problem('INCOMPLETE_TRAVERSAL', 'The committed traversal cursor is not exhausted.');
      if (
        (final.page_count !== undefined && final.page_count !== record.page_count) ||
        (final.evidence_count !== undefined && final.evidence_count !== record.evidence_count) ||
        (final.summary?.counters?.evidence_records !== undefined &&
          final.summary.counters.evidence_records !== record.evidence_count)
      )
        throw problem('CENSUS_MISMATCH', 'Manifest counts do not match committed evidence pages.');
      try {
        const generation = record.generation + 1;
        const manifest = this._blob('manifests', {
          ...final,
          version: 1,
          job_id: id,
          identity: record.identity,
          identity_hash: record.identity_hash,
          generation,
          partial: false,
          page_index_hash: record.page_index_hash,
          page_refs: record.page_refs,
          page_count: record.page_count,
          evidence_count: record.evidence_count,
          coverage,
        });
        // No cursor here either: the record keeps it (see commitCheckpoint).
        const checkpoint = this._blob('checkpoints', {
          version: 1,
          job_id: id,
          identity_hash: record.identity_hash,
          previous_hash: record.checkpoint_hash,
          generation,
          progress: record.progress,
          coverage,
          page_index_hash: record.page_index_hash,
          page_count: record.page_count,
          evidence_count: record.evidence_count,
          manifest_hash: manifest.sha256,
        });
        saving = true;
        return this._save({
          ...record,
          state: certified ? 'completed' : 'completed_with_refusals',
          generation,
          coverage,
          manifest_hash: manifest.sha256,
          checkpoint_hash: checkpoint.sha256,
          fence: null,
          lease_expires_at: null,
          reason: null,
          // §7.2: completion releases the job's discovery in this save.
          ...(Object.hasOwn(record, 'discovery') ? { discovery: null } : {}),
        });
      } catch (error) {
        if (saving && !error.status) unknown = true;
        return this._quotaPause(record, error);
      }
    };
    let done;
    try {
      done = this._open(completing);
    } catch (error) {
      if (unknown && trace) this._logTraceErased(id, trace, 'unknown');
      throw error;
    }
    // A completed job's lists go once its save has returned (§5.1); a quota
    // pause keeps them. A pending malformed release (§7.4) is completed by
    // that save, which releases the whole of `discovery` (null): it is no
    // longer pending, and is logged once, as every release is. A quota pause
    // carries it through _saveReason instead.
    // A saved release's trace (Q5) is logged once its erasing save has
    // returned: a refused save erased nothing, and the trace stays in the
    // record for the completion that lands.
    if (['completed', 'completed_with_refusals'].includes(done.state)) {
      this.chains.delete(id);
      if (this.pendingRelease.delete(id)) this._logRelease(id, 'chain_broken', null);
      if (trace) this._logTraceErased(id, trace, 'saved');
    }
    return done;
  }

  pause(
    id,
    attempt,
    fence,
    {
      code = 'INTERRUPTED',
      message = 'Explicit resume is required.',
      requeue = false,
      cause,
      log,
      reply_code,
      field,
      value,
    } = {}
  ) {
    return this._open(() => {
      const leased = this._leaseRecord(id, attempt, fence);
      // Refused before anything is saved; the scheduler's fallback pause
      // (§8) then ends the lease.
      pauseReason(code, message, { cause, log, reply_code, field, value });
      // U1: a DISCOVERY_UNAVAILABLE pause of a job that holds live discovery
      // state releases it in this same save. A job already released (or
      // pending its release) releases nothing: the first trace wins. A job
      // that holds none has nothing to release.
      const releasing =
        code === 'DISCOVERY_UNAVAILABLE' &&
        this._discoveryShape(leased) === 'live' &&
        !this.pendingRelease.has(id);
      const record = releasing
        ? { ...leased, discovery: releasedDiscovery(leased.discovery, cause, log ?? null) }
        : leased;
      if (this._u2(record)) {
        // U2: the reason is copied from unavailable, and the job is never
        // requeued. A C1 reason it replaces is logged instead (§8, C1).
        if (reply_code !== undefined)
          console.warn(
            JSON.stringify({ event: 'READER_REPLY_UNRECORDED', job: id, reply_code, field, value })
          );
        const saved = this._saveReason(record, (base, reason) => ({
          ...base,
          state: record.cancel_requested ? 'cancelled' : 'paused',
          fence: null,
          lease_expires_at: null,
          cancel_requested: false,
          deferred_requeue: false,
          queued_at: this.now(),
          queue_order: this._tailOrder(),
          reason: reason ?? pauseReason(code, message, { cause, log, reply_code, field, value }),
        }));
        if (releasing) this._logRelease(id, cause, log ?? null);
        return saved;
      }
      let state = record.cancel_requested ? 'cancelled' : requeue ? 'queued' : 'paused';
      let deferred_requeue = false;
      if (state === 'queued') {
        try {
          this._queueRoom();
        } catch {
          state = 'paused';
          deferred_requeue = ['YIELD', 'LEASE_EXHAUSTED'].includes(code);
          if (deferred_requeue)
            message =
              'Scheduling boundary; committed work will return to the queue when its next slot opens.';
          else {
            code = 'QUEUE_FULL';
            message = 'Queue is full; committed work is retained.';
            // The store's own reason takes no cause or log: as before, a
            // requeue's cause is not stored under QUEUE_FULL.
            cause = undefined;
            log = undefined;
          }
        }
      }
      return this._save(
        {
          ...record,
          state,
          fence: null,
          lease_expires_at: null,
          cancel_requested: false,
          deferred_requeue,
          queued_at: this.now(),
          queue_order: this._tailOrder(),
          reason:
            state === 'queued'
              ? null
              : pauseReason(code, message, { cause, log, reply_code, field, value }),
        },
        true
      );
    });
  }

  // A lease whose payload was refused STORE_BUSY (BB8 6717719856, F5) ends as
  // if it had never been taken: lock contention is transient and nobody did
  // anything wrong, so the job never waits for a resume. It goes back to
  // `queued` in the place it held (its queue fields were never changed by the
  // lease), with its attempt counter restored and no reason. Three cases keep
  // what a pause would do instead: a cancel asked for meanwhile lands as
  // `cancelled` with reason CANCELLED, as cancel() writes it, on every path
  // but U2's, which holds the reason as it does in cancel() (BB8 6719406992,
  // call 2); a job released meanwhile (U2) is paused with the release's
  // reason and never requeued (§8); and with no queue room it is paused to
  // return by itself when a slot opens (deferred_requeue), never QUEUE_FULL.
  // The attempt is uncounted in each, so the next lease carries the same
  // attempt number again: a control signed with that expected_attempt during
  // this lease is accepted against the next, which is benign, since this
  // lease never started a worker. A lease that expired first is not returned
  // (STALE_ATTEMPT): its expiry paused it INTERRUPTED, counted. Like any write
  // it takes the lock, so while the lock stays busy it is refused STORE_BUSY
  // too, and the scheduler retries it at its own cadence.
  returnLease(id, attempt, fence) {
    return this._open(() => {
      const record = this._leaseRecord(id, attempt, fence);
      const ended = {
        attempt: record.attempt - 1,
        fence: null,
        lease_expires_at: null,
        cancel_requested: false,
      };
      let room = true;
      try {
        this._queueRoom();
      } catch {
        room = false;
      }
      if (record.cancel_requested || !room || this._u2(record))
        return this._saveReason(record, (base, reason) => ({
          ...base,
          ...ended,
          state: record.cancel_requested ? 'cancelled' : 'paused',
          deferred_requeue: reason === null && !record.cancel_requested,
          reason:
            reason ??
            (record.cancel_requested
              ? { code: 'CANCELLED', message: 'Cancelled; committed evidence is retained.' }
              : {
                  code: 'STORE_BUSY',
                  message:
                    'Scheduling boundary; committed work will return to the queue when its next slot opens.',
                }),
        }));
      return this._save(
        { ...record, ...ended, state: 'queued', deferred_requeue: false, reason: null },
        true
      );
    });
  }

  _control(record, action, options, payload) {
    if (!options?.idempotency_key) return { record, replay: false };
    text(options.idempotency_key, 'Control idempotency key');
    if (options.digest !== undefined && !HASH.test(options.digest))
      throw problem('INVALID_DECLARATION', 'Control digest must be SHA-256.', 400);
    const key = sha(`${action}\0${options.idempotency_key}`);
    const payload_hash = sha(
      canonical({
        ...payload,
        expected_attempt: options.expected_attempt ?? null,
        expected_generation: options.expected_generation ?? null,
      })
    );
    const digest = options.digest ?? payload_hash;
    const previous = record.control_receipts.find((receipt) => receipt.key === key);
    if (previous) {
      if (previous.digest !== digest || previous.payload_hash !== payload_hash)
        throw problem('IDEMPOTENCY_CONFLICT', 'Control key belongs to changed input.');
      return { record, replay: true };
    }
    // Receipt and resulting state are committed together in the same record.
    return {
      record: {
        ...record,
        control_receipts: [
          ...record.control_receipts,
          { key, action, digest, payload_hash, at: this.now() },
        ],
      },
      replay: false,
    };
  }
  _expected(record, options) {
    for (const [key, actual] of [
      ['expected_attempt', record.attempt],
      ['expected_generation', record.generation],
    ]) {
      if (
        options[key] !== undefined &&
        (!Number.isSafeInteger(options[key]) || options[key] !== actual)
      )
        throw problem(
          'STALE_ATTEMPT',
          'Reader control belongs to an older attempt or committed generation.'
        );
    }
  }
  cancel(id, capability, viewer, options = {}) {
    return this._open(() => {
      const record = this._authorized(id, capability, viewer);
      const control = this._control(record, 'cancel', options, { id });
      if (control.replay) return clone(record);
      this._expected(record, options);
      if (['completed', 'completed_with_refusals'].includes(record.state))
        return this._save(control.record, true);
      return this._saveReason(control.record, (base, reason) => ({
        ...base,
        state: record.state === 'running' ? 'running' : 'cancelled',
        cancel_requested: record.state === 'running',
        deferred_requeue: false,
        reason: reason ?? {
          code: 'CANCELLED',
          message:
            record.state === 'running'
              ? 'Cancellation requested; worker stops at its next committed safe point.'
              : 'Cancelled; committed evidence is retained.',
        },
        ...(record.state === 'running' ? {} : { fence: null, lease_expires_at: null }),
      }));
    });
  }
  // A resume of a paused or cancelled job (§5.1). A pending release and a
  // saved `unavailable` refuse first, with nothing read. A live discovery is
  // then read in full, every log from its head, the address lists and
  // `verified` unused (_fullRead): a failure releases the job, from `record`
  // and not `control.record`, so the refused control writes no receipt, and
  // refuses DISCOVERY_UNAVAILABLE with the cause and the log. A pass
  // replaces the job's address lists with the ones read, and resume's own
  // save carries `verified` at the heads. A record with no discovery resumes
  // exactly as before: nothing is read and its save gains no key.
  resume(id, capability, viewer, identity, options = {}) {
    const expected = identityHash(identity);
    return this._open(() => {
      const record = this._authorized(id, capability, viewer);
      const control = this._control(record, 'resume', options, { id, identity_hash: expected });
      if (control.replay) return clone(record);
      this._expected(record, options);
      this._refusePending(id);
      this._refuseUnavailable(record);
      if (expected !== record.identity_hash)
        throw problem(
          'STALE_READING',
          'Source, declarations or engine/resource identity changed; start a separate analysis.'
        );
      if (!['paused', 'cancelled'].includes(record.state))
        throw problem(
          'INVALID_JOB_STATE',
          'Only paused or cancelled reader jobs can explicitly resume.'
        );
      const full = this._liveDiscovery(record) && this._resumeRead(record);
      this._queueRoom();
      if (
        !OUTSTANDING.has(record.state) &&
        this._outstanding(viewer) >= READER_LIMITS.outstandingPerViewer
      )
        throw problem('QUEUE_FULL', 'This viewer already has two outstanding reader jobs.', 429);
      return this._save(
        {
          ...control.record,
          state: 'queued',
          reason: null,
          fence: null,
          lease_expires_at: null,
          cancel_requested: false,
          deferred_requeue: false,
          queued_at: this.now(),
          queue_order: this._tailOrder(),
          accessed_at: this.now(),
          expires_at: this.now() + this.ttlMs,
          ...(full
            ? { discovery: { ...record.discovery, verified: clone(record.discovery.logs) } }
            : {}),
        },
        true
      );
    });
  }
  // resume()'s full read (§5.1): every log, in the order `logs` holds them,
  // stopping at the first that fails. A pass installs the lists read, as
  // reconciliation's does: they are read from the durable heads, which
  // resume's save leaves as they are, so they hold whether or not that save
  // is made (a QUEUE_FULL after the read), and a save that throws without a
  // status drops every list through _open. A failure releases the job in
  // one save (U1) and refuses DISCOVERY_UNAVAILABLE, naming its cause and log.
  // Only the faults _fullRead returns release; any other error, a stat or a
  // read that fails for a reason that is not a verdict on the segment
  // (EACCES, EIO, ENOTDIR), keeps its own code, so one without a status
  // stops the store through _open and releases nothing.
  _resumeRead(record) {
    const lists = new Map();
    for (const log of Object.keys(record.discovery.logs)) {
      const read = this._fullRead(record, log);
      if (read.cause) {
        this._release(record, { cause: read.cause, log });
        throw unavailableRefusal({ cause: read.cause, log });
      }
      lists.set(log, read.addresses);
    }
    this.chains.set(record.id, lists);
    return true;
  }
  get(id, capability, viewer) {
    const authorize = () => this._authorized(id, capability, viewer);
    return this._shown(this._refresh(this._cached(authorize), authorize));
  }
  inspect(id) {
    return this._cached(() => this._shown(clone(this._require(id))));
  }
  listQueued() {
    return this._open(() => {
      this._promoteDeferred();
      return this._dispatchable()
        .sort((a, b) => this._queueSort(a, b))
        .map(clone);
    });
  }
  _committedManifest(record, hash) {
    hash ||= record.manifest_hash;
    if (!HASH.test(hash || ''))
      throw problem('NOT_FOUND', 'No committed reader manifest is available.', 404);
    for (let cursor = record.checkpoint_hash; cursor; ) {
      const checkpoint = this._object('checkpoints', cursor);
      if (checkpoint.job_id !== record.id || checkpoint.identity_hash !== record.identity_hash)
        throw problem('STORAGE_CORRUPT', 'Checkpoint belongs to a different reader identity.', 503);
      if (checkpoint.manifest_hash === hash) {
        const manifest = this._object('manifests', hash);
        if (manifest.job_id !== record.id || manifest.identity_hash !== record.identity_hash)
          throw problem('STORAGE_CORRUPT', 'Manifest belongs to a different reader identity.', 503);
        return manifest;
      }
      cursor = checkpoint.previous_hash;
    }
    throw problem('NOT_FOUND', 'Manifest is not a committed generation of this reader job.', 404);
  }
  readManifest(id, capability, viewer, manifestHash = null) {
    const authorize = () => this._authorized(id, capability, viewer);
    const { record, manifest } = this._cached(() => {
      const record = authorize();
      return { record, manifest: this._committedManifest(record, manifestHash) };
    });
    this._refresh(record, authorize);
    return clone(manifest);
  }
  readManifestPage(id, capability, viewer, manifestHash = null, { offset = 0, limit = 100 } = {}) {
    if (
      !Number.isSafeInteger(offset) ||
      offset < 0 ||
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      limit > 250
    )
      throw problem(
        'INVALID_DECLARATION',
        'Manifest pagination requires nonnegative offset and limit 1–250.',
        400
      );
    const authorize = () => this._authorized(id, capability, viewer);
    const { record, result } = this._cached(() => {
      const record = authorize();
      const hash = manifestHash || record.manifest_hash;
      const manifest = this._committedManifest(record, hash);
      const refs = [];
      let at = 0;
      for (const ref of this._refs(manifest.page_index_hash)) {
        if (at >= offset && refs.length < limit) refs.push(ref);
        at++;
        if (refs.length === limit) break;
      }
      return {
        record,
        result: {
          manifest_hash: hash,
          page_refs: refs,
          total: manifest.page_count,
          offset,
          next_offset: offset + refs.length < manifest.page_count ? offset + refs.length : null,
        },
      };
    });
    this._refresh(record, authorize);
    return result;
  }
  readPage(id, pageSha, capability, viewer, manifestHash = null) {
    const authorize = () => this._authorized(id, capability, viewer);
    const { record, page } = this._cached(() => {
      const record = authorize();
      const manifest = this._committedManifest(record, manifestHash);
      let member = false;
      for (const ref of this._refs(manifest.page_index_hash))
        if (ref.sha256 === pageSha) {
          member = true;
          break;
        }
      if (!member)
        throw problem(
          'NOT_FOUND',
          'Evidence page is not part of the requested committed manifest.',
          404
        );
      return { record, page: this._object('pages', pageSha) };
    });
    this._refresh(record, authorize);
    return clone(page);
  }
  // ── the lease's walk (§5.1) ─────────────────────────────────────────────
  // One lease's walk of a live record, under the writer lock and so after
  // any reconciliation (§7.4). R5 first, for every log and before anything
  // is read: the log's address list (a log with no list has the empty one,
  // so a non-null head without a list is R5) holds exactly the head's
  // `segments` addresses and ends at the head, and `verified` is a prefix of
  // it. (`verified` naming exactly the logs `logs` names is the record's
  // shape, M1: a record without it is never 'live'.) Then, log by log, a
  // stat of each verified segment, and a read through _segment of each one
  // appended since: F6, F3, R2, and R5's junction (the first segment read
  // continues the verified head, and the bytes read from v.bytes end at the
  // head's). Every failure is this image's own bookkeeping disagreeing with
  // the record or the stored segments, never evidence of a broken chain:
  // STORAGE_CORRUPT 503 with a non-enumerable `rule` (tests read it, the
  // routes never serialise it), nothing released or saved. Returns the
  // verified heads to save, null when nothing was read, and each log's
  // absolute paths, oldest first (§2.10).
  _walk(record) {
    const { epoch, logs, verified } = record.discovery;
    const lists = this.chains.get(record.id);
    const listOf = (log) => lists?.get(log) ?? [];
    const corrupt = (rule) =>
      Object.defineProperty(
        problem('STORAGE_CORRUPT', 'Reader discovery state failed its lease walk.', 503),
        'rule',
        { value: rule, enumerable: false }
      );
    for (const [log, st] of Object.entries(logs)) {
      const list = listOf(log);
      const v = verified[log];
      const empty = {
        head: null,
        segments: 0,
        count: 0,
        bytes: 0,
        digest: domainDigest(DOMAINS.log(log)),
      };
      if (
        list.length !== st.segments ||
        (list.at(-1) ?? null) !== st.head ||
        v.segments > st.segments ||
        v.count > st.count ||
        v.bytes > st.bytes ||
        (v.segments === 0 && canonical(v) !== canonical(empty)) ||
        (v.segments === st.segments && canonical(v) !== canonical(st)) ||
        (v.segments > 0 && list[v.segments - 1] !== v.head)
      )
        throw corrupt('R5');
    }
    let read = 0;
    const paths = {};
    for (const [log, st] of Object.entries(logs)) {
      const list = listOf(log);
      const v = verified[log];
      // A verified segment is stat'ed, not read, and held as _segment's own
      // stat holds it: gone is missing; a name that is not a regular file (a
      // directory, say) or a size over the object bound is F6; any other
      // stat error is thrown as it is.
      for (const address of list.slice(0, v.segments)) {
        let stat;
        try {
          stat = fs.statSync(path.join(this.directory, 'pages', `${address}.json`));
        } catch (error) {
          if (error.code === 'ENOENT') throw corrupt('missing');
          throw error;
        }
        if (!stat.isFile() || stat.size > READER_LIMITS.objectBytes) throw corrupt('F6');
      }
      const expect = { job_id: record.id, identity_hash: record.identity_hash, epoch, log };
      let at = v;
      let junction = v.segments > 0;
      for (const address of list.slice(v.segments)) {
        const got = this._segment(address, expect);
        read++;
        if (got.missing) throw corrupt('missing');
        if (got.f6) throw corrupt('F6');
        if (!got.segment) throw corrupt('F3');
        const { segment } = got;
        if (
          segment.previous_hash !== at.head ||
          segment.first !== at.count ||
          segment.digest_before !== at.digest
        )
          throw corrupt(junction ? 'R5' : 'R2');
        junction = false;
        at = {
          head: address,
          segments: at.segments + 1,
          count: segment.first + segment.count,
          bytes: at.bytes + got.entryBytes,
          digest: segment.digest_after,
        };
      }
      if (at.head !== st.head || at.count !== st.count || at.digest !== st.digest)
        throw corrupt('R2');
      if (at.bytes !== st.bytes) throw corrupt('R5');
      paths[log] = list.map((a) => path.join(this.directory, 'pages', `${a}.json`));
    }
    return { verified: read ? clone(logs) : null, paths };
  }
  // The lease payload (§2.10), under the writer lock (§5.1): a pending
  // release and a saved `unavailable` refuse first, with no walk; then a
  // live record's walk, and its one verified save, skipped when nothing was
  // read or when _capacity cannot grant it (STORE_RECOUNTING, RESOURCE_LIMIT:
  // the next walk reads from the older verified heads; the advance never
  // refuses the lease). The payload is the record without its `discovery`,
  // whose `verified` and `unavailable` are the store's own (c14), and with
  // `discovery` built from the record's heads and the address lists. A record
  // with no `discovery` key gains none, so a payload today is byte for byte
  // what it was.
  workerPayload(id) {
    return this._open(() => {
      let record = this._require(id);
      if (['expired', 'deleted'].includes(record.state) || this._expiredUnswept(record))
        throw problem('RESULT_EXPIRED', 'Reader work expired.', 410);
      this._refusePending(id);
      this._refuseUnavailable(record);
      let built = null;
      if (this._liveDiscovery(record)) {
        const walk = this._walk(record);
        if (walk.verified)
          try {
            record = this._save(
              { ...record, discovery: { ...record.discovery, verified: walk.verified } },
              true
            );
          } catch (error) {
            const recounting = error.code === 'STORE_RECOUNTING' && error.status === 503;
            if (!recounting && (error.code !== 'RESOURCE_LIMIT' || error.status !== 507))
              throw error;
          }
        const { epoch, logs } = record.discovery;
        built = { version: 1, summary: { epoch, logs: clone(logs) }, paths: walk.paths };
      }
      const page_refs = [...this._refs(record.page_index_hash)];
      const { discovery: _held, ...rest } = clone(record);
      return {
        ...rest,
        directory: this.directory,
        page_refs,
        page_paths: page_refs.map((ref) =>
          path.join(this.directory, 'pages', `${ref.sha256}.json`)
        ),
        committed_page_paths: page_refs.map((ref) =>
          path.join(this.directory, 'pages', `${ref.sha256}.json`)
        ),
        ...(Object.hasOwn(record, 'discovery') ? { discovery: built } : {}),
      };
    });
  }
  _tombstone(record, state, options = {}) {
    const saved = this._save(
      {
        version: 1,
        id: record.id,
        viewer: record.viewer,
        state,
        idempotency_hash: record.idempotency_hash,
        request_digest: record.request_digest,
        identity_hash: record.identity_hash,
        attempt: record.attempt,
        fence: null,
        cursor: null,
        progress: null,
        coverage: null,
        page_refs: [],
        page_index_hash: null,
        page_count: 0,
        evidence_count: 0,
        generation: record.generation,
        checkpoint_hash: null,
        manifest_hash: null,
        cancel_requested: false,
        control_receipts: options.control_receipts || record.control_receipts,
        created_at: record.created_at,
        accessed_at: record.accessed_at,
        expires_at: record.expires_at,
        reason: {
          code: 'RESULT_EXPIRED',
          message: 'Private analysis was removed; no automatic redispatch is permitted.',
        },
      },
      true
    );
    this.chains.delete(record.id); // after the save returns (§5.1)
    this.pendingRelease.delete(record.id); // a tombstone holds no discovery (§2.7)
    return saved;
  }
  delete(id, capability, viewer, options = {}) {
    return this._open(() => {
      const raw = this._require(id);
      if (raw.state === 'deleted') {
        if (viewer !== raw.viewer || capability !== this._capability(raw))
          throw problem('NOT_FOUND', 'Reader job does not exist.', 404);
        const control = this._control(raw, 'delete', options, { id });
        if (control.replay) return clone(raw);
        this._expected(raw, options);
        return this._save(control.record, true);
      }
      const record = this._authorized(id, capability, viewer);
      const control = this._control(record, 'delete', options, { id });
      if (control.replay) return clone(record);
      this._expected(record, options);
      // The deleted job's objects become garbage; maintenance reclaims them.
      return this._tombstone(control.record, 'deleted');
    });
  }
  // ── maintenance: expiry, collection, usage verification ─────────────────
  // None of it runs on a request. A timer (startMaintenance) runs one bounded
  // slice at a time; prune() runs everything to completion for operators and
  // tests. Expiry still binds at read time (_authorized), so correctness never
  // depends on a sweep having run.
  // Tombstones at most `limit` due records. A finite `examine` looks at that
  // many records per call, resuming where the last call stopped.
  _pruneExpired(limit, examine = Infinity, deadline = Infinity) {
    let changed = 0;
    const due = (record) =>
      record && !['expired', 'deleted'].includes(record.state) && record.expires_at <= this.now();
    if (examine === Infinity) {
      for (const record of [...this.records.values()]) {
        if (changed >= limit) break;
        if (!due(record)) continue;
        this._tombstone(record, 'expired');
        changed++;
      }
      this.lastExpiryExamined = this.records.size;
      return changed;
    }
    let looked = 0;
    for (; looked < examine && changed < limit; looked++) {
      // The time bound is checked between operations; the position is kept.
      if (this.clock() >= deadline) break;
      if (!this._expiryScan || this._expiryScan.at >= this._expiryScan.ids.length) {
        if (this._expiryScan) {
          this._expiryScan = null;
          break; // one full pass per cycle; the next call starts a new one
        }
        this._expiryScan = { ids: [...this.records.keys()], at: 0 };
      }
      const record = this.records.get(this._expiryScan.ids[this._expiryScan.at++]);
      if (!due(record)) continue;
      this._tombstone(record, 'expired');
      changed++;
    }
    this.lastExpiryExamined = looked;
    return changed;
  }
  // One object of the mark: read it, mark what it references, and queue the
  // chains it continues. An object is marked live only after it has been
  // read, so a failure never leaves a node marked whose references were not.
  // With `bounds`, the object's size is checked BEFORE it is read: an object
  // that would take the slice past its object or byte bound stays on the
  // stack for the next slice, and false is returned.
  //
  // A `discovery` entry is a segment (§7.2): it lives in pages/, so it is
  // marked in live.pages (`live` holds only OBJECT_KINDS), read by _segment as
  // a mark read, and continues at its previous_hash. A segment that is
  // missing, over the size bound (never read, and never deferred by the byte
  // bound: it could never fit), changed, not strictly UTF-8 JSON, or whose
  // link is malformed is STORAGE_CORRUPT, which abandons the collection
  // (§7.4); the error's non-enumerable `rule` says which.
  _markStep(stack, live, budget, bounds = null) {
    const [kind, hash] = stack[stack.length - 1];
    const liveKind = kind === 'discovery' ? 'pages' : kind;
    if (!hash || live[liveKind].has(hash)) {
      stack.pop();
      return true;
    }
    const file = path.join(this.directory, liveKind, `${hash}.json`);
    let size;
    try {
      size = fs.statSync(file).size;
    } catch (error) {
      if (error.code === 'ENOENT')
        throw problem('STORAGE_CORRUPT', 'Committed reader object is missing.', 503);
      throw error;
    }
    const oversized = kind === 'discovery' && size > READER_LIMITS.objectBytes;
    if (
      bounds &&
      !oversized &&
      (budget.objects + 1 > bounds.objects || budget.bytes + size > bounds.bytes)
    )
      return false;
    stack.pop();
    if (kind === 'discovery') {
      const read = this._segment(hash, null, size);
      if (!read.segment) {
        const rule = read.missing ? 'missing' : read.f6 ? 'F6' : 'F3';
        throw Object.defineProperty(
          problem('STORAGE_CORRUPT', 'A live discovery segment failed its mark read.', 503),
          'rule',
          { value: rule, enumerable: false }
        );
      }
      budget.objects++;
      budget.bytes += size;
      stack.push(['discovery', read.segment.previous_hash]);
      live.pages.add(hash);
      return true;
    }
    const node = this._object(kind, hash);
    budget.objects++;
    budget.bytes += size;
    if (kind === 'checkpoints') {
      live.manifests.add(node.manifest_hash);
      stack.push(['checkpoints', node.previous_hash], ['indexes', node.page_index_hash]);
    } else {
      for (const ref of node.page_refs) live.pages.add(ref.sha256);
      stack.push(['indexes', node.previous_hash]);
    }
    live[kind].add(hash);
    return true;
  }
  // Retained definitions are leaves the record names directly: no read needed.
  _markDefinitions(record, live) {
    for (const hash of Object.values(record.definitions || {})) live.definitions.add(hash);
  }
  _markRecord(record, live, budget) {
    this._markDefinitions(record, live);
    const stack = [['checkpoints', record.checkpoint_hash], ...this._discoveryRoots(record)];
    while (stack.length) this._markStep(stack, live, budget);
  }
  _unlinkCounted(file) {
    const size = fs.statSync(file).size;
    this._beginWrite();
    this._inflight = true;
    fs.unlinkSync(file);
    if (this.usage !== null) this.usage -= size;
    this._inflight = false;
  }
  // A records/*.tmp file comes off a known counter only if the scan that set
  // the counter counted it. One no scan saw (a temporary that appeared with
  // no pending marker, so no lock holder recounted) was never added. Both
  // sweeps remove temporaries this way: _collectAll and maintain().
  _unlinkTemporary(file) {
    const name = path.basename(file);
    const size = fs.statSync(file).size;
    this._beginWrite();
    this._inflight = true;
    fs.unlinkSync(file);
    if (this.usage !== null && this._countedTemporaries.has(name)) this.usage -= size;
    this._countedTemporaries.delete(name);
    this._inflight = false;
  }
  // Under the lock, all at once: startup and prune() only.
  _collectAll() {
    const live = Object.fromEntries(OBJECT_KINDS.map((kind) => [kind, new Set()]));
    const budget = { objects: 0 };
    for (const record of this.records.values()) this._markRecord(record, live, budget);
    for (const kind of OBJECT_KINDS) {
      let removed = false;
      for (const file of fs.readdirSync(path.join(this.directory, kind))) {
        if (!file.endsWith('.json') || !live[kind].has(file.slice(0, -5))) {
          this._unlinkCounted(path.join(this.directory, kind, file));
          removed = true;
        }
      }
      if (removed) syncDirectory(path.join(this.directory, kind));
    }
    let removedTemporary = false;
    const recordsDir = path.join(this.directory, 'records');
    for (const file of fs.readdirSync(recordsDir))
      if (file.endsWith('.tmp')) {
        this._unlinkTemporary(path.join(recordsDir, file));
        removedTemporary = true;
      }
    if (removedTemporary) syncDirectory(recordsDir);
  }
  prune() {
    return this._open(() => {
      this._pruneExpired(Infinity);
      this._collectAll();
      this._abandonGc();
      return { bytes: this.usage };
    });
  }
  _abandonGc() {
    try {
      this._gc?.dir?.closeSync();
    } catch {
      // already closed
    }
    this._gc = null;
  }
  // One bounded slice. Collection is mark-then-sweep across slices: the mark
  // reads the cached records without the lock, and the sweep deletes only
  // objects that are unmarked AND older than the mark's start, so anything
  // written or re-referenced since (its mtime is refreshed) is never swept.
  //
  // Bounds: a slice reads at most `objects` objects or `bytes` bytes, starts
  // at most `records` records, and stops at `ms`; the mark resumes mid-chain.
  // There is no exception: before each sweep slice, under the lock, records
  // saved since the collection began are re-marked within the same budget,
  // and the sweep waits until that re-mark is complete. A failed read
  // abandons the whole collection, so a partial mark never sweeps.
  maintain(bounds = MAINTENANCE_BOUNDS) {
    // Every stored object is at most objectBytes, so a slice whose byte bound
    // is at least that can always make progress while never exceeding it.
    if (
      !(bounds.bytes >= READER_LIMITS.objectBytes) ||
      !(bounds.objects >= 1) ||
      !(bounds.records >= 0) ||
      !(bounds.ms > 0)
    )
      throw new RangeError(
        `maintenance bounds need bytes >= ${READER_LIMITS.objectBytes}, objects >= 1, records >= 0, ms > 0`
      );
    const started = this.clock();
    const budget = { objects: 0, bytes: 0 };
    const spent = () =>
      budget.objects >= bounds.objects ||
      budget.bytes >= bounds.bytes ||
      this.clock() - started >= bounds.ms;
    const expired = this._open(() =>
      this._pruneExpired(bounds.records, bounds.records, started + bounds.ms)
    );
    if (!this._gc) {
      this._gc = {
        phase: 'mark',
        startedAt: Date.now() - 1000,
        ids: [...this.records.keys()],
        at: 0,
        stack: [],
        dirty: new Set(),
        live: Object.fromEntries(OBJECT_KINDS.map((kind) => [kind, new Set()])),
        kinds: [...OBJECT_KINDS, 'records'],
        kind: null,
        dir: null,
        pending: null,
      };
    }
    const gc = this._gc;
    let marked = 0;
    try {
      while (gc.phase === 'mark' && !spent()) {
        if (gc.stack.length) {
          if (!this._markStep(gc.stack, gc.live, budget, bounds)) break;
          continue;
        }
        if (gc.at >= gc.ids.length) {
          gc.phase = 'sweep';
          break;
        }
        if (marked >= bounds.records) break;
        const record = this.records.get(gc.ids[gc.at++]);
        if (record) {
          this._markDefinitions(record, gc.live);
          gc.stack.push(['checkpoints', record.checkpoint_hash]);
          gc.stack.push(...this._discoveryRoots(record));
        }
        marked++;
      }
    } catch (error) {
      this._abandonGc();
      throw error;
    }
    let swept = 0;
    if (gc.phase === 'sweep' && !spent()) {
      this._open(() => {
        if (this._gc !== gc) return; // abandoned on entering the lock
        // Records saved since the collection began are re-marked within this
        // slice's budget. The sweep is withheld until that traversal is
        // complete inside one hold of the lock (no save can interleave), so
        // under sustained writes reclamation waits rather than the bound.
        try {
          for (const id of gc.dirty) {
            const record = this.records.get(id);
            if (record) {
              this._markDefinitions(record, gc.live);
              gc.stack.push(['checkpoints', record.checkpoint_hash]);
              gc.stack.push(...this._discoveryRoots(record));
            }
          }
          gc.dirty.clear();
          while (gc.stack.length && !spent())
            if (!this._markStep(gc.stack, gc.live, budget, bounds)) break;
        } catch (error) {
          this._abandonGc();
          throw error;
        }
        if (gc.stack.length) return;
        // Every directory entry examined counts against the object bound.
        while (!spent()) {
          if (!gc.dir) {
            if (!gc.kinds.length) {
              gc.phase = 'done';
              break;
            }
            gc.kind = gc.kinds.shift();
            gc.dir = fs.opendirSync(path.join(this.directory, gc.kind));
          }
          // An entry deferred by the byte bound is retried first, uncounted.
          let file = gc.pending;
          gc.pending = null;
          if (file == null) {
            const entry = gc.dir.readSync();
            if (!entry) {
              gc.dir.closeSync();
              gc.dir = null;
              continue;
            }
            budget.objects++;
            file = entry.name;
          }
          const { kind } = gc;
          if (kind === 'records' && !file.endsWith('.tmp')) continue;
          const full = path.join(this.directory, kind, file);
          let stat;
          try {
            stat = fs.statSync(full);
          } catch {
            continue;
          }
          const unreferenced =
            kind === 'records' || !file.endsWith('.json') || !gc.live[kind].has(file.slice(0, -5));
          if (unreferenced && stat.mtimeMs < gc.startedAt) {
            if (budget.bytes + stat.size > bounds.bytes) {
              gc.pending = file; // deleting it would pass the byte bound
              break;
            }
            if (kind === 'records') this._unlinkTemporary(full);
            else this._unlinkCounted(full);
            budget.bytes += stat.size;
            swept++;
          }
        }
      });
      if (this._gc === gc && gc.phase === 'done') this._gc = null;
    }
    return {
      expired,
      marked,
      swept,
      read: budget.objects,
      bytes: budget.bytes,
      examined: this.lastExpiryExamined,
      phase: this._gc ? this._gc.phase : 'idle',
    };
  }
  // A quiescent recount: the scan runs in small slices off the request path
  // and is accepted only if no mutation or pending write happened across it,
  // checked and published under the writer lock. There is no delta journal.
  async recount({ attempts = 3, slice = 200 } = {}) {
    const yieldNow = () => new Promise((resolve) => setImmediate(resolve));
    for (let attempt = 0; attempt < attempts; attempt++) {
      if (this._hasPending()) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        continue;
      }
      let g0, total;
      const temporaries = new Set();
      try {
        g0 = this._readGeneration();
        total = this._metadataBytes();
        let n = 0;
        for (const dir of ['records', ...OBJECT_KINDS])
          for (const name of fs.readdirSync(path.join(this.directory, dir))) {
            // Any failed measurement (even ENOENT) invalidates the whole pass;
            // the generation fence cannot vouch for a stat that did not happen.
            total += fs.statSync(path.join(this.directory, dir, name)).size;
            if (dir === 'records' && name.endsWith('.tmp')) temporaries.add(name);
            if (++n % slice === 0) await yieldNow();
          }
      } catch (error) {
        console.warn(JSON.stringify({ event: 'READER_RECOUNT_FAILED', message: error.message }));
        continue; // usage stays unknown: growth keeps failing closed
      }
      let accepted = false;
      try {
        accepted = this._locked(() => {
          if (this._hasPending() || this._readGeneration() !== g0 || this._writing) return false;
          if (this.usage !== null && this.usage !== total)
            console.warn(
              JSON.stringify({ event: 'READER_USAGE_DRIFT', counter: this.usage, scan: total })
            );
          this.usage = total;
          this._countedTemporaries = temporaries;
          this.generation = g0;
          this._recountWanted = false;
          this._savePending();
          return true;
        });
      } catch (error) {
        // STORE_BUSY (another live writer) or a transient read: retry, never fail.
        console.warn(JSON.stringify({ event: 'READER_RECOUNT_FAILED', message: error.message }));
      }
      if (accepted) return true;
    }
    this._scheduleRecount(1000);
    return false;
  }
  _scheduleRecount(delayMs = 0) {
    this._recountWanted = true;
    if (!this._timers.length) return; // tests and tools call recount() themselves
    const timer = setTimeout(() => {
      this.recount().catch((error) => {
        // Never this.failure: unknown usage already fails growth closed, and
        // reads and cleanup must keep working while the scan is retried.
        console.warn(JSON.stringify({ event: 'READER_RECOUNT_FAILED', message: error.message }));
        this._scheduleRecount(Math.min(60_000, Math.max(1000, delayMs * 2)));
      });
    }, delayMs);
    timer.unref?.();
  }
  startMaintenance({ intervalMs = 60_000, verifyMs = 15 * 60_000 } = {}) {
    if (this._timers.length) return;
    const run = (fn) => () => {
      try {
        const out = fn();
        if (out && typeof out.catch === 'function') out.catch(() => {});
      } catch {
        // a failed slice is retried on the next tick; persistence failures mark this.failure
      }
    };
    this._timers.push(
      setInterval(
        run(() => this.maintain()),
        intervalMs
      )
    );
    this._timers.push(
      setInterval(
        run(() => this.recount()),
        verifyMs
      )
    );
    for (const timer of this._timers) timer.unref?.();
    if (this._recountWanted) this._scheduleRecount();
  }
  stopMaintenance() {
    for (const timer of this._timers) clearInterval(timer);
    this._timers = [];
  }
  _probe() {
    const file = path.join(this.directory, 'readiness-probe');
    const bytes = crypto.randomBytes(32);
    atomicWrite(file, bytes, this.fault, 'probe');
    if (!fs.readFileSync(file).equals(bytes))
      throw problem('STORAGE_UNAVAILABLE', 'Reader atomic-write readiness probe failed.', 503);
    fs.unlinkSync(file);
    syncDirectory(this.directory);
  }
  readiness() {
    return this._open(() => {
      this._probe();
      return {
        durable: true,
        namespace: 'reader-jobs-v1',
        bytes: this.usage,
        usage_known: this.usage !== null,
        max_bytes: this.maxBytes,
        lease_ms: this.leaseMs,
        retention_ms: this.ttlMs,
      };
    });
  }
}
