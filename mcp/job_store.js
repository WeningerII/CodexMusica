// Durable, capability-addressed receipts for long /chat requests. A receipt is
// written before dispatch; an unfinished receipt never authorizes redispatch.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { runtimeAssets } from './runtime_assets.js';
import { releaseIdentity, runtimeSourceFingerprint } from './build_identity.js';
import { requestContext, withExecutionContext } from './execution_context.js';

const ID = /^[a-f0-9]{64}$/;
const STATES = new Set(['pending', 'completed', 'interrupted', 'retired']);
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_RECORD_BYTES = 8 * 1024 * 1024;
const INTENT_BYTES = 2 * 1024 * 1024;
const CHECKPOINT_BYTES = 3 * 1024 * 1024;
const PROGRESS_BYTES = 2 * 1024 * 1024;
const RESPONSE_BYTES = 4 * 1024 * 1024;
function boundedPayload(value, limit, label) {
  if (Buffer.byteLength(JSON.stringify(value)) > limit)
    throw Object.assign(new Error(`${label} exceeds the durable wire-byte limit (${limit}).`), {
      code: 'JOB_PAYLOAD_TOO_LARGE',
      status: 413,
    });
}
const DEFAULT_MAX_BYTES = 256 * 1024 * 1024;

export function atomicPrivateWrite(file, data) {
  const dir = path.dirname(file);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
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
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = undefined;
    fs.renameSync(temp, file);
    const directoryFd = fs.openSync(dir, 'r');
    try {
      fs.fsyncSync(directoryFd);
    } finally {
      fs.closeSync(directoryFd);
    }
  } catch (error) {
    failure = error;
  } finally {
    try {
      if (fd !== undefined) fs.closeSync(fd);
    } catch (error) {
      failure ||= error;
    }
    try {
      fs.unlinkSync(temp);
    } catch (error) {
      if (error.code !== 'ENOENT') failure ||= error;
    }
  }
  if (failure) throw failure;
}

function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
    .join(',')}}`;
}

export function redactJobCapability(value) {
  return String(value).replace(/(\/chat\/jobs\/)[^\s?#]+(?:[?#][^\s]*)?/gi, '$1[capability]');
}

export function requestDigest(body) {
  return crypto.createHash('sha256').update(canonical(body)).digest('hex');
}

function copy(value) {
  return JSON.parse(JSON.stringify(value));
}

function interruptedRecord(record, reason, now) {
  // 'proposing' also covers a billed response whose answer has not reached the
  // proposal journal. Settled usage alone is not permission to repeat it.
  const uncertain =
    record.progress?.status === 'proposing' || record.proposer_usage?.in_flight === true;
  return {
    ...record,
    state: 'interrupted',
    updated_at: now,
    interruption: reason,
    uncertain_proposal: uncertain,
    progress:
      uncertain && record.progress
        ? { ...record.progress, uncertain_proposal: true }
        : record.progress,
  };
}

export function loadChatSecret(env = process.env) {
  if (env.CHAT_SECRET) return env.CHAT_SECRET;
  const file =
    env.CHAT_SECRET_FILE ||
    (env.LYRIC_RUNTIME_DIR && path.join(env.LYRIC_RUNTIME_DIR, 'chat-secret.key'));
  if (!file) return crypto.randomBytes(32).toString('hex');
  try {
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.mode & 0o077)
      throw new Error('signing key must be a private regular file');
    const secret = fs.readFileSync(file, 'utf8').trim();
    if (!ID.test(secret)) throw new Error('invalid persisted signing key');
    return secret;
  } catch (err) {
    if (err.code !== 'ENOENT')
      throw new Error(`Cannot load durable chat signing key: ${err.message}`);
  }
  const secret = crypto.randomBytes(32).toString('hex');
  atomicPrivateWrite(file, secret + '\n');
  return secret;
}

export class JobStore {
  constructor(
    directory = null,
    {
      ttlMs = DEFAULT_TTL_MS,
      maxRecords = 8192,
      maxPayloadRecords = 128,
      maxBytes = DEFAULT_MAX_BYTES,
      maxRecordBytes = MAX_RECORD_BYTES,
      now = Date.now,
    } = {}
  ) {
    if (
      ![ttlMs, maxRecords, maxPayloadRecords, maxBytes, maxRecordBytes].every(
        (x) => Number.isSafeInteger(x) && x > 0
      )
    ) {
      throw new Error('Job store limits must be positive safe integers');
    }
    this.directory = directory ? path.resolve(directory) : null;
    this.durable = !!this.directory;
    this.ttlMs = ttlMs;
    this.maxRecords = maxRecords;
    this.maxPayloadRecords = Math.min(maxPayloadRecords, maxRecords);
    this.maxBytes = maxBytes;
    this.maxRecordBytes = maxRecordBytes;
    this.now = now;
    this.records = new Map();
    this.bytes = 0;
    this.failure = null;
    if (!this.directory) return;
    fs.mkdirSync(this.directory, { recursive: true, mode: 0o700 });
    const stat = fs.lstatSync(this.directory);
    if (!stat.isDirectory() || stat.mode & 0o077)
      throw new Error('Job directory must be private (0700)');
    const files = fs.readdirSync(this.directory);
    if (files.length > maxRecords * 2 + 16)
      throw new Error('Job directory exceeds the configured record limit');
    for (const name of files) {
      const file = path.join(this.directory, name);
      if (/^[a-f0-9]{64}\.json\.[a-f0-9]{24}\.tmp$/.test(name)) {
        fs.unlinkSync(file); // an uncommitted atomic replacement
        continue;
      }
      if (!/^[a-f0-9]{64}\.json$/.test(name)) throw new Error('Unexpected file in job directory');
      const info = fs.lstatSync(file);
      if (!info.isFile() || info.mode & 0o077 || info.size > this.maxRecordBytes)
        throw new Error('Invalid job record file');
      const record = JSON.parse(fs.readFileSync(file, 'utf8'));
      this.validate(record);
      if (name !== `${record.request_id}.json`) throw new Error('Job record identity mismatch');
      this.records.set(record.request_id, record);
      this.bytes += Buffer.byteLength(JSON.stringify(record));
    }
    // The process cannot know which upstream work completed before its crash.
    // Persist that uncertainty, retaining both the intent and last checkpoint.
    for (const record of this.records.values()) {
      if (record.state === 'pending') {
        this.write(interruptedRecord(record, 'process_restarted', this.now()));
      }
    }
    this.prune();
    if (this.records.size > maxRecords || this.bytes > maxBytes)
      throw new Error('Job store exceeds configured capacity');
  }

  validate(record) {
    if (
      !record ||
      record.version !== 1 ||
      !ID.test(record.request_id) ||
      !ID.test(record.digest) ||
      !STATES.has(record.state) ||
      !Number.isFinite(record.created_at) ||
      !Number.isFinite(record.updated_at) ||
      (record.state !== 'retired' &&
        (!record.intent ||
          typeof record.intent !== 'object' ||
          record.intent.request_id !== record.request_id ||
          requestDigest(record.intent) !== record.digest)) ||
      !record.build ||
      typeof record.build !== 'object' ||
      (record.state === 'completed' &&
        (!record.response ||
          !Number.isInteger(record.response.status) ||
          record.response.status < 100 ||
          record.response.status > 599))
    ) {
      throw new Error('Corrupt job record; recovery is disabled until repaired');
    }
  }

  assertHealthy() {
    if (this.failure) throw new Error(`Job persistence unavailable: ${this.failure}`);
  }

  write(record, { reclaim = true } = {}) {
    this.assertHealthy();
    this.validate(record);
    const text = JSON.stringify(record);
    const bytes = Buffer.byteLength(text);
    const old = this.records.get(record.request_id);
    const oldBytes = old ? Buffer.byteLength(JSON.stringify(old)) : 0;
    // Reserve the complete record allowance for every active request. A later
    // receipt must not fail because another job consumed its completion space.
    let reserve = record.state === 'pending' ? Math.max(0, this.maxRecordBytes - bytes) : 0;
    for (const [id, pending] of this.records)
      if (id !== record.request_id && pending.state === 'pending')
        reserve += Math.max(0, this.maxRecordBytes - Buffer.byteLength(JSON.stringify(pending)));
    if (reclaim && bytes <= this.maxRecordBytes)
      this.reclaim(record.request_id, bytes - oldBytes + reserve, !old);
    if (bytes > this.maxRecordBytes || this.bytes - oldBytes + bytes + reserve > this.maxBytes) {
      throw Object.assign(
        new Error('Job storage capacity exceeded; no additional work may be admitted'),
        { code: 'JOB_CAPACITY', status: 503 }
      );
    }
    try {
      if (this.directory)
        atomicPrivateWrite(path.join(this.directory, `${record.request_id}.json`), text);
    } catch (err) {
      this.failure = err.message;
      throw err;
    }
    this.records.set(record.request_id, record);
    this.bytes += bytes - oldBytes;
    return record;
  }

  reclaim(protectedId, additionalBytes = 0, newPayload = false) {
    const payloads = () => [...this.records.values()].filter((r) => r.state !== 'retired').length;
    const terminal = [...this.records.values()]
      .filter((r) => r.request_id !== protectedId && ['completed', 'interrupted'].includes(r.state))
      .sort((a, b) => a.updated_at - b.updated_at);
    while (
      this.bytes + additionalBytes > this.maxBytes ||
      payloads() + Number(newPayload) > this.maxPayloadRecords
    ) {
      const record = terminal.shift();
      if (!record)
        throw Object.assign(
          new Error('Job storage capacity exceeded; active work cannot be evicted'),
          { code: 'JOB_CAPACITY', status: 503 }
        );
      // Retain the id/digest until the metadata TTL expires. Payload eviction
      // must never make the same capability look like permission to execute.
      this.write(
        {
          ...record,
          state: 'retired',
          intent: null,
          checkpoint: null,
          progress: null,
          proposer_usage: null,
          response: null,
          interruption: 'receipt_payload_retired',
          retired_at: this.now(),
        },
        { reclaim: false }
      );
    }
  }

  prune() {
    this.assertHealthy();
    const now = this.now();
    for (const [id, record] of this.records) {
      // Never expire active work: expiration must not become permission to replay.
      if (record.state === 'pending' || now - record.updated_at < this.ttlMs) continue;
      if (this.directory) {
        try {
          fs.unlinkSync(path.join(this.directory, `${id}.json`));
          const fd = fs.openSync(this.directory, 'r');
          try {
            fs.fsyncSync(fd);
          } finally {
            fs.closeSync(fd);
          }
        } catch (err) {
          this.failure = err.message;
          throw err;
        }
      }
      this.records.delete(id);
      this.bytes -= Buffer.byteLength(JSON.stringify(record));
    }
  }

  get(id) {
    if (!ID.test(id)) return null;
    if (!this.failure) this.prune();
    const record = this.records.get(id);
    return record ? copy(record) : null;
  }

  begin(id, body, build = {}, inheritedCheckpoint = null) {
    this.assertHealthy();
    if (!ID.test(id))
      throw Object.assign(
        new Error(
          'request_id must be 64 lowercase hexadecimal characters generated from 32 random bytes'
        ),
        { status: 400 }
      );
    boundedPayload(body, INTENT_BYTES, 'Request intent');
    const digest = requestDigest(body);
    const previous = this.get(id);
    if (previous) {
      if (previous.digest !== digest)
        throw Object.assign(new Error('request_id already belongs to different input'), {
          status: 409,
        });
      return { created: false, record: previous };
    }
    if (this.records.size >= this.maxRecords)
      throw Object.assign(
        new Error('Recovery store is full; retry after existing receipts expire'),
        { status: 503 }
      );
    const parent = body.continuation_id == null ? null : this.get(body.continuation_id);
    if (
      body.continuation_id != null &&
      (!parent || !['completed', 'interrupted'].includes(parent.state))
    )
      throw Object.assign(
        new Error('The continuation receipt is unavailable; no work was started.'),
        { status: 409, code: 'CONTINUATION_UNAVAILABLE' }
      );
    if (parent?.successor_id && parent.successor_id !== id)
      throw Object.assign(
        new Error(
          'This continuation has already advanced; recover its successor before continuing.'
        ),
        { status: 409, code: 'STALE_CONTINUATION', successor_id: parent.successor_id }
      );
    const record = {
      version: 1,
      request_id: id,
      digest,
      state: 'pending',
      created_at: this.now(),
      updated_at: this.now(),
      intent: copy(body),
      build: copy(build),
      checkpoint: null,
      progress: null,
      proposer_usage: null,
      response: null,
    };
    if (inheritedCheckpoint) {
      boundedPayload(inheritedCheckpoint, CHECKPOINT_BYTES, 'Inherited continuation');
      record.checkpoint = copy(inheritedCheckpoint);
    }
    const saved = this.write(record);
    // Persist a single successor before dispatch. If either disk write fails,
    // admission fails closed; concurrent IDs cannot branch a paid turn.
    if (parent) this.write({ ...this.records.get(parent.request_id), successor_id: id });
    return { created: true, record: copy(saved) };
  }

  checkpoint(id, payload) {
    boundedPayload(
      payload,
      Array.isArray(payload?.history) && typeof payload?.sig === 'string'
        ? CHECKPOINT_BYTES
        : PROGRESS_BYTES,
      'Checkpoint'
    );
    const record = this.records.get(id);
    if (!record || record.state !== 'pending') throw new Error('Cannot checkpoint an inactive job');
    const safe = payload && Array.isArray(payload.history) && typeof payload.sig === 'string';
    // Keep the last complete, signed model exchange separately from worker
    // progress. A proposal receipt is evidence, not a resumable chat history.
    return this.write({
      ...record,
      updated_at: this.now(),
      [safe ? 'checkpoint' : 'progress']: copy(payload),
    });
  }

  proposerUsage(id, payload) {
    const record = this.records.get(id);
    if (!record || record.state !== 'pending')
      throw new Error('Cannot record usage for an inactive job');
    return this.write({ ...record, updated_at: this.now(), proposer_usage: copy(payload) });
  }

  interrupt(id, reason) {
    const record = this.records.get(id);
    if (!record || record.state !== 'pending') return;
    return this.write(interruptedRecord(record, reason, this.now()));
  }

  complete(id, status, body, headers = {}) {
    boundedPayload(body, RESPONSE_BYTES, 'Response');
    const record = this.records.get(id);
    if (!record || record.state !== 'pending') throw new Error('Cannot complete an inactive job');
    return this.write({
      ...record,
      state: 'completed',
      checkpoint: null,
      progress: null,
      updated_at: this.now(),
      response: {
        status,
        body: copy(body),
        ...(Object.keys(headers).length ? { headers: copy(headers) } : {}),
      },
    });
  }

  failedCompletion(id, error) {
    const record = this.records.get(id);
    if (['JOB_CAPACITY', 'JOB_PAYLOAD_TOO_LARGE'].includes(error?.code)) {
      // Expected input/capacity refusals are local to this capability. Keep the
      // last durable checkpoint and the no-replay marker; they are not evidence
      // that the disk or every other conversation is corrupt.
      if (record?.state === 'pending') this.interrupt(id, error.code);
      return;
    }
    this.failure ||= error.message || 'Response persistence failed';
    if (record?.state === 'pending') {
      // The old disk receipt remains pending and becomes interrupted on boot.
      // In this process expose uncertainty immediately, retaining its last
      // successful checkpoint. The failure latch prevents new paid work.
      this.records.set(id, interruptedRecord(record, 'response_persistence_failed', this.now()));
    }
  }

  publicRecord(record) {
    return {
      request_id: record.request_id,
      state: record.state,
      created_at: record.created_at,
      updated_at: record.updated_at,
      checkpoint: record.checkpoint,
      progress: record.progress,
      proposer_usage: record.proposer_usage ?? null,
      uncertain_proposal: record.uncertain_proposal ?? false,
      response: record.response,
      build: record.build,
      interruption: record.interruption ?? null,
      successor_id: record.successor_id ?? null,
      durable: this.durable,
      retention_ms: this.ttlMs,
      persistence_error: this.failure ? 'Persistence failed; no new work is admitted.' : null,
    };
  }
}

export function createJobRouter({ store, build = {}, recoverCheckpoint = null }) {
  const router = express.Router();
  const publicRecord = (record) => {
    const visible = store.publicRecord(record);
    if (record.state === 'interrupted' && recoverCheckpoint) {
      const continuation = recoverCheckpoint(record);
      if (continuation) visible.continuation = continuation;
    }
    return visible;
  };
  router.get('/chat/jobs/:id', (req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
      const record = store.get(req.params.id);
      if (!record && store.failure)
        return res
          .status(503)
          .json({ error: 'Job persistence is unavailable; do not resubmit uncertain work.' });
      if (!record)
        return res.status(404).json({
          error:
            'No retained receipt for this request_id; absence does not establish that work was never executed.',
        });
      return res.json(publicRecord(record));
    } catch {
      return res
        .status(503)
        .json({ error: 'Job persistence is unavailable; do not resubmit uncertain work.' });
    }
  });
  router.post('/chat', (req, res, next) => {
    req.chatRecovery = {
      resolve: (id) => {
        if (typeof id !== 'string' || !ID.test(id))
          throw Object.assign(new Error('Invalid continuation_id.'), { status: 400 });
        const record = store.get(id);
        if (record?.successor_id && record.successor_id !== req.body?.request_id)
          throw Object.assign(
            new Error(
              'This continuation has already advanced; recover its successor before continuing.'
            ),
            { status: 409, code: 'STALE_CONTINUATION', successor_id: record.successor_id }
          );
        if (!record || !['completed', 'interrupted'].includes(record.state))
          throw Object.assign(
            new Error('The continuation receipt is unavailable; no work was started.'),
            { status: 409, code: 'CONTINUATION_UNAVAILABLE' }
          );
        const envelope =
          record.state === 'completed' ? record.response?.body : recoverCheckpoint?.(record);
        if (!envelope?.sig || envelope.lyric?.uncertain_proposal)
          throw Object.assign(
            new Error(
              'This receipt cannot safely resume; recover its accepted draft and uncertainty.'
            ),
            { status: 409, code: 'CONTINUATION_UNCERTAIN' }
          );
        req.chatInheritedCheckpoint = {
          history: envelope.history,
          workspace: envelope.workspace ?? null,
          ...(envelope.lyric != null ? { lyric: envelope.lyric } : {}),
          ...(envelope.task != null ? { task: envelope.task } : {}),
          sig: envelope.sig,
        };
        return envelope;
      },
    };
    const id = req.body?.request_id;
    const originalJson = res.json.bind(res);
    let admitted = false;
    let completed = false;
    const existingReply = (record) => {
      if (record.state === 'completed') {
        if (record.response.headers?.['retry-after'])
          res.set('Retry-After', record.response.headers['retry-after']);
        return res.status(record.response.status).json(record.response.body);
      }
      return res.status(record.state === 'pending' ? 202 : 409).json(publicRecord(record));
    };
    if (id !== undefined) {
      res.set('Cache-Control', 'no-store');
      if (typeof id !== 'string' || !ID.test(id))
        return res.status(400).json({
          error:
            'request_id must be 64 lowercase hexadecimal characters generated from 32 random bytes',
        });
      try {
        const existing = store.get(id);
        if (existing) {
          if (existing.digest !== requestDigest(req.body))
            return res.status(409).json({ error: 'request_id already belongs to different input' });
          return existingReply(existing);
        }
      } catch {
        return res
          .status(503)
          .json({ error: 'Job persistence is unavailable; no work was started.' });
      }
    }
    if (store.failure)
      return res
        .status(503)
        .json({ error: 'Job persistence is unavailable; paid chat is disabled until repaired.' });
    if (id === undefined) return next();

    // The chat route calls begin AFTER validation and admission. Malformed,
    // rate-limited and unsigned requests must not consume receipt capacity.
    // Recheck identity here to close the race between two newly arrived IDs.
    const begin = () => {
      if (admitted) return true;
      try {
        const { created, record } = store.begin(id, req.body, build, req.chatInheritedCheckpoint);
        if (!created) {
          existingReply(record);
          return false;
        }
        admitted = true;
        return true;
      } catch (err) {
        res.status(err.status || 503).json({
          code: err.code ?? null,
          successor_id: err.successor_id ?? null,
          error: err.status
            ? err.message
            : 'Job intent could not be persisted; no work was started.',
        });
        return false;
      }
    };
    const checkpoint = (payload) => {
      if (!admitted) throw new Error('A request must be admitted before checkpointing');
      return store.checkpoint(id, payload);
    };
    req.chatJob = { id, begin, checkpoint };
    res.on('finish', () => {
      if (admitted && !completed) {
        try {
          store.interrupt(id, 'response_without_durable_payload');
        } catch (err) {
          store.failedCompletion(id, err);
        }
      }
    });
    res.json = (body) => {
      if (!admitted) return originalJson(body);
      if (completed) return res;
      try {
        const retryAfter = res.getHeader('Retry-After');
        store.complete(
          id,
          res.statusCode,
          body,
          retryAfter === undefined ? {} : { 'retry-after': String(retryAfter) }
        );
        completed = true;
      } catch (err) {
        completed = true;
        store.failedCompletion(id, err);
        res.status(503);
        return originalJson({
          error:
            'The response could not be persisted. Recover this request_id before starting more work.',
          request_id: id,
          state: 'interrupted',
        });
      }
      return originalJson(body);
    };
    return withExecutionContext(
      {
        ...requestContext(),
        jobId: id,
        onCheckpoint: checkpoint,
        onProposerUsage: (payload) => store.proposerUsage(id, payload),
      },
      next
    );
  });
  return router;
}

export { runtimeSourceFingerprint } from './build_identity.js';

export function runtimeBuildIdentity(env = process.env) {
  const release = releaseIdentity(env);
  const config = {};
  for (const key of Object.keys(env).sort()) {
    if (
      /^(CHAT_|LYRIC_|MODEL_|GEMINI_MODEL$|TRUSTED_PROXY_HOPS$)/.test(key) &&
      !/(?:_KEY|_SECRET|_TOKEN|_SECRET_FILE)$/.test(key)
    )
      config[key] = env[key];
  }
  const assets = runtimeAssets();
  return Object.freeze({
    ...release,
    source_sha256: runtimeSourceFingerprint(),
    config_sha256: crypto.createHash('sha256').update(canonical(config)).digest('hex'),
    node: process.version,
    assets_sha256: assets.assets_sha256,
    asset_manifest_sha256: assets.manifest_sha256,
    python: assets.python,
    nltk: assets.nltk,
  });
}
