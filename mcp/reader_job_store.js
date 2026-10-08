// Reader jobs are separate from chat receipts. Only trusted server code obtains
// workerPayload/inspect; public reads require both viewer binding and capability.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

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
      this._locked(() => {
        const keyFile = path.join(this.directory, 'capability-key');
        if (!fs.existsSync(keyFile))
          atomicWrite(keyFile, crypto.randomBytes(32), this.fault, 'key');
        this.key = fs.readFileSync(keyFile);
        if (this.key.length !== 32)
          throw problem('STORAGE_CORRUPT', 'Reader capability key is invalid.', 503);
        this._reload();
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
        this._prune();
        this._collect();
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
      return run();
    } finally {
      fs.closeSync(fd);
      const owner = JSON.parse(fs.readFileSync(lock, 'utf8'));
      if (owner.nonce === nonce) {
        fs.unlinkSync(lock);
        syncDirectory(this.directory);
      }
    }
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
    if (
      this._usage() + bytes + (reserve ? (this.records.size + extraRecords) * RESERVE_BYTES : 0) >
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
    atomicWrite(file, bytes, this.fault, 'record');
    this.records.set(record.id, record);
    return clone(record);
  }
  _blob(kind, value) {
    const bytes = encoded(value, `${kind} object`);
    const hash = sha(bytes);
    const file = path.join(this.directory, kind, `${hash}.json`);
    if (fs.existsSync(file)) {
      if (!this._readFile(file).equals(bytes))
        throw problem('STORAGE_CORRUPT', 'Immutable object hash collision.', 503);
    } else {
      this._capacity(bytes.length);
      atomicWrite(file, bytes, this.fault, kind);
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
    if (['expired', 'deleted'].includes(record.state))
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
  _open(run) {
    try {
      return this._locked(() => {
        this._reload();
        if (this._prune()) this._collect();
        return run();
      });
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
    return [...this.records.values()].filter((r) => r.viewer === viewer && OUTSTANDING.has(r.state))
      .length;
  }
  _queueRoom() {
    if (
      [...this.records.values()].filter((r) => r.state === 'queued').length >= READER_LIMITS.waiting
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
        if (['expired', 'deleted'].includes(prior.state))
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
    if (error.code !== 'RESOURCE_LIMIT' || error.status !== 507) throw error;
    // The cursor is unchanged. Reserved metadata space makes this pause durable.
    return this._save(
      {
        ...record,
        state: record.cancel_requested ? 'cancelled' : 'paused',
        cancel_requested: false,
        deferred_requeue: false,
        fence: null,
        lease_expires_at: null,
        reason: { code: 'RESOURCE_LIMIT', message: error.message },
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
    return this._open(() => this._touch(this._authorized(id, capability, viewer)));
  }
  inspect(id) {
    return this._open(() => clone(this._require(id)));
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
    return this._open(() => {
      const record = this._authorized(id, capability, viewer);
      const manifest = this._committedManifest(record, manifestHash);
      this._touch(record);
      return clone(manifest);
    });
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
    return this._open(() => {
      const record = this._authorized(id, capability, viewer);
      const hash = manifestHash || record.manifest_hash;
      const manifest = this._committedManifest(record, hash);
      const refs = [];
      let at = 0;
      for (const ref of this._refs(manifest.page_index_hash)) {
        if (at >= offset && refs.length < limit) refs.push(ref);
        at++;
        if (refs.length === limit) break;
      }
      this._touch(record);
      return {
        manifest_hash: hash,
        page_refs: refs,
        total: manifest.page_count,
        offset,
        next_offset: offset + refs.length < manifest.page_count ? offset + refs.length : null,
      };
    });
  }
  readPage(id, pageSha, capability, viewer, manifestHash = null) {
    return this._open(() => {
      const record = this._authorized(id, capability, viewer);
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
      const page = this._object('pages', pageSha);
      this._touch(record);
      return clone(page);
    });
  }
  workerPayload(id) {
    return this._open(() => {
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
      const result = this._tombstone(control.record, 'deleted');
      this._collect();
      return result;
    });
  }
  _prune() {
    let changed = false;
    for (const record of this.records.values()) {
      if (['expired', 'deleted'].includes(record.state) || record.expires_at > this.now()) continue;
      this._tombstone(record, 'expired');
      changed = true;
    }
    return changed;
  }
  prune() {
    return this._open(() => {
      this._collect();
      return { bytes: this._usage() };
    });
  }
  _collect() {
    const live = Object.fromEntries(OBJECT_KINDS.map((kind) => [kind, new Set()]));
    const visitIndex = (root) => {
      for (let cursor = root; cursor && !live.indexes.has(cursor); ) {
        live.indexes.add(cursor);
        const node = this._object('indexes', cursor);
        for (const ref of node.page_refs) live.pages.add(ref.sha256);
        cursor = node.previous_hash;
      }
    };
    for (const record of this.records.values()) {
      for (let cursor = record.checkpoint_hash; cursor && !live.checkpoints.has(cursor); ) {
        live.checkpoints.add(cursor);
        const checkpoint = this._object('checkpoints', cursor);
        live.manifests.add(checkpoint.manifest_hash);
        visitIndex(checkpoint.page_index_hash);
        cursor = checkpoint.previous_hash;
      }
    }
    for (const kind of OBJECT_KINDS) {
      let removed = false;
      for (const file of fs.readdirSync(path.join(this.directory, kind))) {
        if (!file.endsWith('.json') || !live[kind].has(file.slice(0, -5))) {
          fs.unlinkSync(path.join(this.directory, kind, file));
          removed = true;
        }
      }
      if (removed) syncDirectory(path.join(this.directory, kind));
    }
    let removedTemporary = false;
    const recordsDir = path.join(this.directory, 'records');
    for (const file of fs.readdirSync(recordsDir))
      if (file.endsWith('.tmp')) {
        fs.unlinkSync(path.join(recordsDir, file));
        removedTemporary = true;
      }
    if (removedTemporary) syncDirectory(recordsDir);
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
        bytes: this._usage(),
        max_bytes: this.maxBytes,
        lease_ms: this.leaseMs,
        retention_ms: this.ttlMs,
      };
    });
  }
}
