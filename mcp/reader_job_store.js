// Reader jobs are separate from chat receipts. Only trusted server code obtains
// workerPayload/inspect; public reads require both viewer binding and capability.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

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
const OBJECT_KINDS = ['pages', 'indexes', 'checkpoints', 'manifests'];
const clone = (value) => JSON.parse(JSON.stringify(value));
const sha = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
function problem(code, message, status = 409) {
  return Object.assign(new Error(message), { code, status });
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
function atomicWrite(file, data, fault = () => {}, kind = 'record') {
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
function syncDirectory(dir) {
  const fd = fs.openSync(dir, 'r');
  try {
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
}

// Phase A of storage at rest: every object reader accepts plain or gzip bytes.
// Identity is always sha256 of the UNCOMPRESSED bytes, and inflation is bounded
// by the same object limit the plain format has. The writer still writes plain
// objects; gzip writes are a separate, later switch (READER_STORE_GZIP).
export function decodeStoredObject(raw) {
  if (raw.length >= 2 && raw[0] === 0x1f && raw[1] === 0x8b) {
    try {
      return zlib.gunzipSync(raw, { maxOutputLength: READER_LIMITS.objectBytes });
    } catch {
      throw problem('STORAGE_CORRUPT', 'Stored reader object failed bounded inflation.', 503);
    }
  }
  return raw;
}

export class ReaderJobStore {
  constructor({
    directory,
    maxBytes = 256 * 1024 * 1024,
    now = () => Date.now(),
    ttlMs = READER_LIMITS.retentionMs,
    leaseMs = READER_LIMITS.leaseMs,
    faultInjector = null,
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
    this.maxBytes = maxBytes;
    this.now = now;
    this.ttlMs = ttlMs;
    this.leaseMs = leaseMs;
    this.fault = faultInjector || (() => {});
    this.failure = null;
    this.records = new Map();
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
      this._timers = [];
      this._gc = null;
      this._locked(() => {
        const keyFile = path.join(this.directory, 'capability-key');
        if (!fs.existsSync(keyFile))
          atomicWrite(keyFile, crypto.randomBytes(32), this.fault, 'key');
        this.key = fs.readFileSync(keyFile);
        if (this.key.length !== 32)
          throw problem('STORAGE_CORRUPT', 'Reader capability key is invalid.', 503);
        for (const record of this.records.values()) {
          if (record.state !== 'running') continue;
          this._save(
            {
              ...record,
              state: record.cancel_requested ? 'cancelled' : 'paused',
              fence: null,
              lease_expires_at: null,
              cancel_requested: false,
              deferred_requeue: false,
              reason: {
                code: 'INTERRUPTED',
                message: 'Worker interrupted; explicitly resume the committed cursor.',
              },
            },
            true
          );
        }
        this._pruneExpired(Infinity);
        this._collectAll();
        // Startup holds the writer lock throughout, so this full scan is a
        // quiescent one by construction: usage is known before any request.
        this.usage = this._usage();
        this._recountWanted = false;
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
    const lock = path.join(this.directory, 'writer.lock');
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
      } else dead = this.now() - fs.statSync(lock).mtimeMs > READER_LIMITS.leaseMs;
      if (!dead)
        throw problem('STORE_BUSY', 'Another reader storage operation owns the writer lock.', 503);
      fs.unlinkSync(lock);
      syncDirectory(this.directory);
      fd = fs.openSync(lock, 'wx', 0o600);
    }
    const nonce = crypto.randomBytes(16).toString('hex');
    try {
      fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, nonce }));
      fs.fsyncSync(fd);
      this._enterLock();
      try {
        return run();
      } finally {
        this._leaveLock();
      }
    } finally {
      fs.closeSync(fd);
      const owner = JSON.parse(fs.readFileSync(lock, 'utf8'));
      if (owner.nonce === nonce) {
        fs.unlinkSync(lock);
        syncDirectory(this.directory);
      }
    }
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
    if (!pending && generation === this.generation) return;
    // Another writer committed, or one died mid-write: the cache and the usage
    // counter can no longer be trusted until a quiescent recount.
    this._reload();
    this.generation = generation;
    this.usage = null;
    if (pending) this._beginWrite(); // publishes a fresh generation on leave
    this._scheduleRecount();
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
    }
    this.records = records;
    this.durableExpiry = new Map([...records.values()].map((r) => [r.id, r.expires_at]));
  }

  _readFile(file) {
    if (fs.statSync(file).size > READER_LIMITS.objectBytes)
      throw problem('STORAGE_CORRUPT', 'Stored reader object exceeds its bounded format.', 503);
    return fs.readFileSync(file);
  }
  _usage() {
    let total = fs.statSync(path.join(this.directory, 'capability-key')).size;
    for (const dir of ['records', ...OBJECT_KINDS])
      for (const name of fs.readdirSync(path.join(this.directory, dir)))
        total += fs.statSync(path.join(this.directory, dir, name)).size;
    return total;
  }
  _capacity(bytes, reserve = true, extraRecords = 0) {
    if (this.usage === null) {
      // Usage is unknown until a quiescent recount: allocating or growing
      // writes fail closed. A reserved state transition that stays inside the
      // RESERVE_BYTES every record was admitted with is not a new allocation,
      // so it may proceed; cleanup (deletes, expiry) never reaches here.
      const growing = bytes > 0 || extraRecords > 0;
      const withinReservation = !reserve && extraRecords === 0 && bytes <= RESERVE_BYTES;
      if (growing && !withinReservation)
        throw problem(
          'STORE_RECOUNTING',
          'Reader storage usage is being recounted; retry shortly.',
          503
        );
      return;
    }
    if (
      this.usage + bytes + (reserve ? (this.records.size + extraRecords) * RESERVE_BYTES : 0) >
      this.maxBytes
    )
      throw problem(
        'RESOURCE_LIMIT',
        'Reader storage quota reached; committed work is retained.',
        507
      );
  }
  _save(input, reserved = false) {
    const { record_digest: _old, ...body } = input;
    body.updated_at = this.now();
    const record = { ...body, record_digest: sha(canonical(body)) };
    const bytes = encoded(record, 'Reader record');
    const file = path.join(this.directory, 'records', `${record.id}.json`);
    const previous = fs.existsSync(file) ? fs.statSync(file).size : 0;
    this._capacity(bytes.length - previous, !reserved, previous ? 0 : 1);
    this._beginWrite();
    this._inflight = true;
    atomicWrite(file, bytes, this.fault, 'record');
    if (this.usage !== null) this.usage += bytes.length - previous;
    this._inflight = false;
    this.records.set(record.id, record);
    this.durableExpiry.set(record.id, record.expires_at);
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
      this._capacity(bytes.length);
      this._beginWrite();
      this._inflight = true;
      atomicWrite(file, bytes, this.fault, kind);
      if (this.usage !== null) this.usage += bytes.length;
      this._inflight = false;
    }
    return { sha256: hash, bytes: bytes.length };
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
        this.failure = error.message;
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

  create({ viewer, idempotency_key, identity, request }) {
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
      const record = this._save({
        version: 1,
        id: `reader_${crypto.randomBytes(32).toString('hex')}`,
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

  lease(id = null) {
    return this._open(() => {
      this._expireLeases();
      this._promoteDeferred();
      if ([...this.records.values()].some((r) => r.state === 'running')) return null;
      const record = id
        ? this._require(id)
        : [...this.records.values()]
            .filter((r) => r.state === 'queued')
            .sort((a, b) => this._queueSort(a, b))[0];
      if (!record || record.state !== 'queued') return null;
      const leased = this._save(
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
      this._promoteDeferred();
      return leased;
    });
  }
  _promoteDeferred() {
    let room =
      READER_LIMITS.waiting - [...this.records.values()].filter((r) => r.state === 'queued').length;
    const deferred = [...this.records.values()]
      .filter((r) => r.state === 'paused' && r.deferred_requeue)
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
  _expireLeases() {
    for (const record of this.records.values()) {
      if (record.state === 'running' && record.lease_expires_at <= this.now())
        this._save(
          {
            ...record,
            state: record.cancel_requested ? 'cancelled' : 'paused',
            fence: null,
            lease_expires_at: null,
            cancel_requested: false,
            deferred_requeue: false,
            reason: {
              code: 'INTERRUPTED',
              message: 'Lease expired; resume the last durable checkpoint explicitly.',
            },
          },
          true
        );
    }
  }
  _leaseRecord(id, attempt, fence) {
    this._expireLeases();
    const record = this._require(id);
    if (record.state !== 'running' || record.attempt !== attempt || record.fence !== fence)
      throw problem('STALE_ATTEMPT', 'The worker no longer owns this reader lease.');
    return record;
  }
  _quotaPause(record, error) {
    const recounting = error.code === 'STORE_RECOUNTING' && error.status === 503;
    if (!recounting && (error.code !== 'RESOURCE_LIMIT' || error.status !== 507)) throw error;
    // The cursor is unchanged. Reserved metadata space makes this pause durable.
    // A recount pause returns to the queue by itself once a slot opens.
    return this._save(
      {
        ...record,
        state: record.cancel_requested ? 'cancelled' : 'paused',
        cancel_requested: false,
        deferred_requeue: recounting && !record.cancel_requested,
        fence: null,
        lease_expires_at: null,
        reason: { code: error.code, message: error.message },
      },
      true
    );
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
      const inputDigest = sha(canonical(input));
      if (record.last_checkpoint_digest === inputDigest)
        return { ...clone(record), added_page_paths: [] };
      if (
        input.previous_generation !== undefined &&
        input.previous_generation !== record.generation
      )
        throw problem('STALE_ATTEMPT', 'Checkpoint was built against an older result generation.');
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
        const checkpoint = this._blob('checkpoints', {
          version: 1,
          job_id: id,
          identity_hash: record.identity_hash,
          previous_hash: record.checkpoint_hash,
          generation,
          cursor: input.cursor,
          progress,
          coverage,
          page_index_hash: root,
          page_count,
          evidence_count,
          manifest_hash: manifest.sha256,
        });
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
        });
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
    return this._open(() => {
      const record = this._leaseRecord(id, attempt, fence);
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
        const checkpoint = this._blob('checkpoints', {
          version: 1,
          job_id: id,
          identity_hash: record.identity_hash,
          previous_hash: record.checkpoint_hash,
          generation,
          cursor: record.cursor,
          progress: record.progress,
          coverage,
          page_index_hash: record.page_index_hash,
          page_count: record.page_count,
          evidence_count: record.evidence_count,
          manifest_hash: manifest.sha256,
        });
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
        });
      } catch (error) {
        return this._quotaPause(record, error);
      }
    });
  }

  pause(
    id,
    attempt,
    fence,
    { code = 'INTERRUPTED', message = 'Explicit resume is required.', requeue = false } = {}
  ) {
    return this._open(() => {
      const record = this._leaseRecord(id, attempt, fence);
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
          reason: state === 'queued' ? null : { code, message },
        },
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
      return this._save(
        {
          ...control.record,
          state: record.state === 'running' ? 'running' : 'cancelled',
          cancel_requested: record.state === 'running',
          deferred_requeue: false,
          reason: {
            code: 'CANCELLED',
            message:
              record.state === 'running'
                ? 'Cancellation requested; worker stops at its next committed safe point.'
                : 'Cancelled; committed evidence is retained.',
          },
          ...(record.state === 'running' ? {} : { fence: null, lease_expires_at: null }),
        },
        true
      );
    });
  }
  resume(id, capability, viewer, identity, options = {}) {
    const expected = identityHash(identity);
    return this._open(() => {
      const record = this._authorized(id, capability, viewer);
      const control = this._control(record, 'resume', options, { id, identity_hash: expected });
      if (control.replay) return clone(record);
      this._expected(record, options);
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
        },
        true
      );
    });
  }
  get(id, capability, viewer) {
    const authorize = () => this._authorized(id, capability, viewer);
    return this._refresh(this._cached(authorize), authorize);
  }
  inspect(id) {
    return this._cached(() => clone(this._require(id)));
  }
  listQueued() {
    return this._open(() => {
      this._promoteDeferred();
      return [...this.records.values()]
        .filter((r) => r.state === 'queued')
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
  workerPayload(id) {
    return this._cached(() => {
      const record = this._require(id);
      if (['expired', 'deleted'].includes(record.state))
        throw problem('RESULT_EXPIRED', 'Reader work expired.', 410);
      const page_refs = [...this._refs(record.page_index_hash)];
      return {
        ...clone(record),
        directory: this.directory,
        page_refs,
        page_paths: page_refs.map((ref) =>
          path.join(this.directory, 'pages', `${ref.sha256}.json`)
        ),
        committed_page_paths: page_refs.map((ref) =>
          path.join(this.directory, 'pages', `${ref.sha256}.json`)
        ),
      };
    });
  }
  _tombstone(record, state, options = {}) {
    return this._save(
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
  _pruneExpired(limit) {
    let changed = 0;
    for (const record of [...this.records.values()]) {
      if (changed >= limit) break;
      if (['expired', 'deleted'].includes(record.state) || record.expires_at > this.now()) continue;
      this._tombstone(record, 'expired');
      changed++;
    }
    return changed;
  }
  _markRecord(record, live, budget) {
    const visitIndex = (root) => {
      for (let cursor = root; cursor && !live.indexes.has(cursor); ) {
        live.indexes.add(cursor);
        const node = this._object('indexes', cursor);
        budget.objects++;
        for (const ref of node.page_refs) live.pages.add(ref.sha256);
        cursor = node.previous_hash;
      }
    };
    for (let cursor = record.checkpoint_hash; cursor && !live.checkpoints.has(cursor); ) {
      live.checkpoints.add(cursor);
      const checkpoint = this._object('checkpoints', cursor);
      budget.objects++;
      live.manifests.add(checkpoint.manifest_hash);
      visitIndex(checkpoint.page_index_hash);
      cursor = checkpoint.previous_hash;
    }
  }
  _unlinkCounted(file) {
    const size = fs.statSync(file).size;
    this._beginWrite();
    this._inflight = true;
    fs.unlinkSync(file);
    if (this.usage !== null) this.usage -= size;
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
        this._unlinkCounted(path.join(recordsDir, file));
        removedTemporary = true;
      }
    if (removedTemporary) syncDirectory(recordsDir);
  }
  prune() {
    return this._open(() => {
      this._pruneExpired(Infinity);
      this._collectAll();
      this._gc = null;
      return { bytes: this.usage };
    });
  }
  // One bounded slice. Collection is mark-then-sweep across slices: the mark
  // reads the cached records without the lock, and the sweep deletes only
  // objects that are unmarked AND older than the mark's start, so anything
  // written or re-referenced since (its mtime is refreshed) is never swept.
  maintain(bounds = MAINTENANCE_BOUNDS) {
    const started = Date.now();
    const budget = { objects: 0, bytes: 0 };
    const spent = () =>
      budget.objects >= bounds.objects ||
      budget.bytes >= bounds.bytes ||
      Date.now() - started >= bounds.ms;
    const expired = this._open(() => this._pruneExpired(bounds.records));
    if (!this._gc) {
      this._gc = {
        phase: 'mark',
        startedAt: Date.now() - 1000,
        ids: [...this.records.keys()],
        at: 0,
        live: Object.fromEntries(OBJECT_KINDS.map((kind) => [kind, new Set()])),
        queue: null,
      };
    }
    const gc = this._gc;
    let marked = 0;
    while (gc.phase === 'mark' && !spent() && marked < bounds.records) {
      if (gc.at >= gc.ids.length) {
        gc.phase = 'sweep';
        break;
      }
      const record = this.records.get(gc.ids[gc.at++]);
      if (record) this._markRecord(record, gc.live, budget);
      marked++;
    }
    let swept = 0;
    if (gc.phase === 'sweep' && !spent()) {
      if (!gc.queue) {
        gc.queue = [];
        for (const kind of OBJECT_KINDS)
          for (const file of fs.readdirSync(path.join(this.directory, kind)))
            gc.queue.push([kind, file]);
        for (const file of fs.readdirSync(path.join(this.directory, 'records')))
          if (file.endsWith('.tmp')) gc.queue.push(['records', file]);
      }
      this._open(() => {
        while (gc.queue.length && swept < bounds.objects && Date.now() - started < bounds.ms) {
          const [kind, file] = gc.queue.pop();
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
            this._unlinkCounted(full);
            swept++;
          }
        }
      });
      if (!gc.queue.length) this._gc = null;
    }
    return { expired, marked, swept, phase: this._gc ? this._gc.phase : 'idle' };
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
      const g0 = this._readGeneration();
      let total = fs.statSync(path.join(this.directory, 'capability-key')).size;
      let n = 0;
      for (const dir of ['records', ...OBJECT_KINDS])
        for (const name of fs.readdirSync(path.join(this.directory, dir))) {
          try {
            total += fs.statSync(path.join(this.directory, dir, name)).size;
          } catch {
            // vanished mid-scan: the generation check below will discard this pass
          }
          if (++n % slice === 0) await yieldNow();
        }
      const accepted = this._locked(() => {
        if (this._hasPending() || this._readGeneration() !== g0 || this._writing) return false;
        if (this.usage !== null && this.usage !== total)
          console.warn(
            JSON.stringify({ event: 'READER_USAGE_DRIFT', counter: this.usage, scan: total })
          );
        this.usage = total;
        this.generation = g0;
        this._recountWanted = false;
        return true;
      });
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
        this.failure = error.message;
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
