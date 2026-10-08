// Durable ingress is separate from the bridge's bounded in-memory admissions.
import { createHash } from 'node:crypto';
import { readFile, realpath } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const error = (code, message) => Object.assign(new Error(message), { code });
export function canonicalJSON(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJSON).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJSON(value[key])}`)
      .join(',')}}`;
  return JSON.stringify(value);
}

// Keep this recursive semantic shape in sync with library.contracts. Private
// citation prose lives in the caller's declaration sidecar, not a cache key.
export function semanticDeclarations(value) {
  if (Array.isArray(value)) return value.map(semanticDeclarations);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => key !== 'viewer_id' && key !== 'user_id')
        .map(([key, item]) => [
          key,
          ['source', 'provenance', 'citation'].includes(key)
            ? pythonTruthy(item)
            : semanticDeclarations(item),
        ])
    );
  return value;
}
function pythonTruthy(value) {
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === 'object') return Object.keys(value).length > 0;
  return Boolean(value);
}

export function createCatalogResolver({
  directory,
  engineCommit,
  resourceFingerprint = 'reader-v1',
  methodsPath = fileURLToPath(new URL('../lyric-harness/library/methods.json', import.meta.url)),
}) {
  const snapshots = new Map();
  const load = async (snapshotId) => {
    if (!directory)
      throw error('READER_UNAVAILABLE', 'A pinned local reader catalog is not configured.');
    if (!/^[a-f0-9]{64}$/.test(snapshotId))
      throw error('SNAPSHOT_CHANGED', 'The snapshot identity is invalid.');
    if (snapshots.has(snapshotId)) return snapshots.get(snapshotId);
    let root = path.resolve(directory);
    let manifest;
    try {
      manifest = JSON.parse(await readFile(path.join(root, 'manifest.json'), 'utf8'));
    } catch {
      root = path.join(root, snapshotId);
    }
    if (manifest?.snapshot_id !== snapshotId) {
      root = path.resolve(directory, snapshotId);
      try {
        manifest = JSON.parse(await readFile(path.join(root, 'manifest.json'), 'utf8'));
      } catch {
        throw error('SNAPSHOT_CHANGED', 'The pinned snapshot is not installed on this backend.');
      }
    }
    if (manifest.snapshot_id !== snapshotId)
      throw error('SNAPSHOT_CHANGED', 'The pinned snapshot is not installed.');
    if (
      sha256(
        canonicalJSON(
          Object.fromEntries(Object.entries(manifest).filter(([key]) => key !== 'snapshot_id'))
        )
      ) !== snapshotId
    )
      throw error('SNAPSHOT_CHANGED', 'The pinned snapshot manifest hash does not match.');
    root = await realpath(root);
    const readArtifact = async (registeredPath) => {
      if (
        typeof registeredPath !== 'string' ||
        path.isAbsolute(registeredPath) ||
        registeredPath.split(/[\\/]/).includes('..')
      )
        throw error('SNAPSHOT_CHANGED', 'An artifact path is invalid.');
      const file = await realpath(path.join(root, registeredPath));
      if (!file.startsWith(`${root}${path.sep}`))
        throw error('SNAPSHOT_CHANGED', 'An artifact escaped its snapshot.');
      const bytes = await readFile(file);
      const declared = manifest.artifacts?.[registeredPath];
      const expected = typeof declared === 'string' ? declared : declared?.sha256;
      if (!expected || sha256(bytes) !== expected)
        throw error('SNAPSHOT_CHANGED', 'A pinned artifact hash does not match.');
      return bytes;
    };
    // Verify the ~101 MiB index without retaining its entire parsed tree.
    // Publication reconciles joins; each registered complete reading is hashed.
    const indexPath = await realpath(path.join(root, 'index.json'));
    if (!indexPath.startsWith(`${root}${path.sep}`))
      throw error('SNAPSHOT_CHANGED', 'The catalog index escaped its snapshot.');
    const indexHash = createHash('sha256');
    for await (const chunk of createReadStream(indexPath)) indexHash.update(chunk);
    const expectedIndex = manifest.artifacts?.['index.json'];
    if (
      indexHash.digest('hex') !==
      (typeof expectedIndex === 'string' ? expectedIndex : expectedIndex?.sha256)
    )
      throw error('SNAPSHOT_CHANGED', 'The pinned catalog index hash does not match.');
    const loaded = { manifest, readArtifact };
    snapshots.set(snapshotId, loaded);
    while (snapshots.size > 2) snapshots.delete(snapshots.keys().next().value);
    return loaded;
  };
  const resolveSource = async (request) => {
    const { manifest, readArtifact } = await load(request.snapshot_id);
    const expectedPath = `readings/${request.reading_unit_id}.json`;
    if (!Object.hasOwn(manifest.artifacts || {}, expectedPath))
      throw error('STALE_READING', 'The reading unit is absent from the pinned snapshot.');
    let source;
    try {
      source = JSON.parse(await readArtifact(expectedPath));
    } catch (failure) {
      if (failure.code === 'ENOENT')
        throw error(
          'SOURCE_UNAVAILABLE',
          'The registered reading is not installed in the approved snapshot.'
        );
      throw failure;
    }
    if (
      source.reading_unit_id !== request.reading_unit_id ||
      source.reading_revision !== request.reading_revision ||
      sha256(
        canonicalJSON(
          Object.fromEntries(Object.entries(source).filter(([key]) => key !== 'reading_revision'))
        )
      ) !== request.reading_revision
    )
      throw error(
        'STALE_READING',
        'The complete reading identity or revision hash does not match.'
      );
    if (source.availability !== 'readable')
      throw error('SOURCE_UNAVAILABLE', 'This source is not available for reading.');
    const entry = source;
    source.snapshot_id = request.snapshot_id;
    return { source, entry, manifest };
  };
  const resolveIdentity = async (request) => {
    const { entry, manifest } = await resolveSource(request);
    if (request.requested_methods !== undefined) {
      let registry;
      try {
        registry = JSON.parse(await readFile(methodsPath, 'utf8'));
      } catch {
        throw error('READER_UNAVAILABLE', 'The generated method registry is unavailable.');
      }
      const methods = new Map((registry.methods || []).map((method) => [method.id, method]));
      if (request.requested_methods.some((method) => !methods.has(method)))
        throw error(
          'UNSUPPORTED_METHOD',
          'An explicit method identity is not in the generated registry.'
        );
      if (request.requested_methods.some((id) => !methods.get(id).reader_requestable))
        throw error(
          'UNSUPPORTED_METHOD',
          'An explicit method is not implemented for reader requests.'
        );
      if (
        request.requested_methods.some(
          (id) => methods.get(id).language && methods.get(id).language !== entry.language
        )
      )
        throw error(
          'UNSUPPORTED_METHOD',
          'An explicit native method belongs to another source language.'
        );
      if (request.requested_methods.length && !request.requested_layers.includes('sound'))
        throw error('UNSUPPORTED_METHOD', 'Explicit sound methods require the sound layer.');
    }
    return {
      contract_version: 1,
      snapshot_id: request.snapshot_id,
      reading_unit_id: request.reading_unit_id,
      reading_revision: request.reading_revision,
      work_id: entry.work_id,
      edition_id: entry.edition_id,
      source_sha256: entry.source_sha256,
      normalized_sha256: entry.normalized_sha256,
      native_profile: entry.language,
      engine_commit: engineCommit,
      parser_version: manifest.parser_version,
      normalizer_version: manifest.normalizer_version,
      resource_fingerprint: resourceFingerprint,
      declaration_hash: sha256(canonicalJSON(semanticDeclarations(request.declaration_set || {}))),
      requested_layers: request.requested_layers,
      requested_methods: request.requested_methods ?? null,
    };
  };
  const probe = async () => {
    const manifest = JSON.parse(
      await readFile(path.join(path.resolve(directory), 'manifest.json'), 'utf8')
    );
    const loaded = await load(manifest.snapshot_id);
    return {
      snapshot_id: manifest.snapshot_id,
      counts: loaded.manifest.counts,
      readings:
        loaded.manifest.counts?.reading_units ||
        Object.keys(loaded.manifest.artifacts || {}).filter((key) => key.startsWith('readings/'))
          .length,
    };
  };
  return { resolveSource, resolveIdentity, probe };
}

export function packReaderPages(records) {
  if (!Array.isArray(records))
    throw error('READER_PROTOCOL', 'A reader checkpoint must contain a record array.');
  const pages = [];
  let instances = [];
  let bytes = 16;
  for (const record of records) {
    const size = Buffer.byteLength(JSON.stringify(record)) + 1;
    if (size + 16 > 2 * 1024 * 1024)
      throw error(
        'RESOURCE_LIMIT',
        'One evidence object exceeds the page limit; its adapter must provide identity-preserving subpages.'
      );
    if (instances.length && (instances.length >= 250 || bytes + size > 2 * 1024 * 1024)) {
      pages.push({ instances });
      instances = [];
      bytes = 16;
    }
    instances.push(record);
    bytes += size;
  }
  if (instances.length) pages.push({ instances });
  return pages;
}

export class ReaderScheduler {
  constructor({ store, bridge, resolveSource, resolveIdentity, leaseMs = 600000, pollMs = 100 }) {
    if (!store || !bridge?.runReaderLease)
      throw new TypeError('Reader scheduler requires its durable store and shared bridge.');
    Object.assign(this, {
      store,
      bridge,
      resolveSource,
      resolveIdentity,
      leaseMs: Math.min(600000, leaseMs),
      pollMs,
    });
    this.active = false;
    this.stopped = false;
    this.timer = null;
  }
  kick() {
    if (this.stopped || this.active || this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.pump();
    }, 0);
    this.timer.unref?.();
  }
  async pump() {
    if (this.stopped || this.active) return;
    if (!this.store.listQueued().length) return;
    const capacity = this.bridge.capacity();
    if (capacity.active || capacity.admitted || capacity.queued) {
      this.timer = setTimeout(() => {
        this.timer = null;
        void this.pump();
      }, this.pollMs);
      this.timer.unref?.();
      return;
    }
    const record = this.store.lease();
    if (!record) return;
    this.active = true;
    let lastStep;
    try {
      const identity = await this.resolveIdentity(record.request);
      if (canonicalJSON(identity) !== canonicalJSON(record.identity))
        throw error('STALE_READING', 'Source or engine identity changed; create a new reader job.');
      const { source } = await this.resolveSource(record.request);
      const trusted = this.store.workerPayload(record.id);
      const result = await this.bridge.runReaderLease(
        {
          source,
          identity,
          declarations: record.request.declaration_set,
          requested: record.request.requested_layers,
          requested_methods: record.request.requested_methods,
          checkpoint: record.cursor || null,
          committed_pages: trusted.page_paths || trusted.pages || [],
          lease_ms: Math.max(
            1,
            Math.min(
              this.leaseMs,
              (record.lease_expires_at || Date.now() + this.leaseMs + 1000) - Date.now() - 1000
            )
          ),
        },
        {
          timeoutMs: this.leaseMs + 5000,
          shouldStop: () =>
            this.stopped
              ? 'INTERRUPTED'
              : this.store.inspect(record.id)?.cancel_requested
                ? 'CANCELLED'
                : null,
          onReaderCheckpoint: async (step) => {
            if (step.provider_calls !== 0)
              throw error('READER_PROTOCOL', 'Reader analysis attempted a provider call.');
            lastStep = step;
            const committed = this.store.commitCheckpoint(record.id, record.attempt, record.fence, {
              cursor: step.checkpoint,
              pages: packReaderPages(step.records),
              progress: step.summary?.progress || step.summary?.counters || {},
              coverage: step.summary?.coverage || {},
            });
            return {
              added_page_paths: committed.added_page_paths || [],
              ...(committed.state !== 'running'
                ? { stop_reason: committed.reason?.code || 'INTERRUPTED' }
                : {}),
            };
          },
        }
      );
      if (result.code !== 0)
        throw error(
          result.error_code || 'INTERRUPTED',
          result.stderr || 'The reader worker was interrupted.'
        );
      if (lastStep?.done && result.reader_result?.status === 'complete') {
        this.store.complete(record.id, record.attempt, record.fence, {
          summary: lastStep.summary,
          coverage: lastStep.summary?.coverage || {},
          provider_calls: 0,
          exhausted: true,
          census_reconciled: true,
        });
      } else {
        const reason = result.reader_result?.reason || 'LEASE_EXHAUSTED';
        this.store.pause(record.id, record.attempt, record.fence, {
          code: reason,
          message:
            reason === 'CANCELLED'
              ? 'Cancelled at a durable checkpoint.'
              : 'Reader lease yielded at a durable checkpoint.',
          requeue: ['YIELD', 'LEASE_EXHAUSTED'].includes(reason),
        });
      }
    } catch (failure) {
      try {
        this.store.pause(record.id, record.attempt, record.fence, {
          code: failure.code || 'INTERRUPTED',
          message: failure.message,
          requeue: false,
        });
      } catch (stale) {
        if (stale.code !== 'STALE_ATTEMPT')
          console.error('[reader] checkpoint recovery failed:', stale.code || 'READER_ERROR');
      }
    } finally {
      this.active = false;
      this.kick();
    }
  }
  stop() {
    this.stopped = true;
    clearTimeout(this.timer);
    this.timer = null;
  }
  readiness() {
    return {
      ...this.store.readiness(),
      ready: !this.stopped,
      enabled: true,
      ...(this.catalog ? { catalog: this.catalog } : {}),
      active: this.active,
      lease_ms: this.leaseMs,
      provider_calls: 0,
    };
  }
}
