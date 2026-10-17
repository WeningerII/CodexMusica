// Actual pinned catalog + actual native judges; no provider HTTP or writer calls.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { ReaderJobStore } from './reader_job_store.js';
import {
  ReaderScheduler,
  canonicalJSON,
  createCatalogResolver,
  packReaderPages,
  probeReaderScheme,
} from './reader_scheduler.js';
import { createPythonBridge } from './python_bridge.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const catalog =
  process.env.READER_TEST_CATALOG_DIR || path.join(root, 'lyric-harness/library/snapshot');
const installed =
  existsSync(path.join(catalog, 'manifest.json')) &&
  existsSync(path.join(root, 'lyric-harness/cmudict.dict'));

test(
  'actual catalog reader interruption/resume matches an uninterrupted complete analysis',
  { skip: !installed, timeout: 120000 },
  async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'reader-actual-integration-'));
    const resolver = createCatalogResolver({
      directory: catalog,
      engineCommit: 'reader-integration',
      resourceFingerprint: 'installed-assets',
      readerScheme: await probeReaderScheme({
        python: process.env.LYRIC_PYTHON || 'python3',
        harnessDir: path.join(root, 'lyric-harness'),
      }),
    });
    const { snapshot_id } = await resolver.probe();
    const request = {
      contract_version: 1,
      snapshot_id,
      reading_unit_id: 'reading_17250bdd-17d0-5cc0-a6b9-65d7b08bf7ca',
      reading_revision: 'c87834414a515cb18750e03225287ea78b179c196e5d6d6dbf62a34fed9e8882',
      declaration_set: {},
      requested_layers: ['sound', 'form', 'rhythm', 'language'],
    };
    const identity = await resolver.resolveIdentity(request);
    const { source } = await resolver.resolveSource(request);
    const bridge = createPythonBridge({
      python: process.env.LYRIC_PYTHON || 'python3',
      harnessDir: path.join(root, 'lyric-harness'),
      workerPath: path.join(here, 'worker.py'),
      harnessEnv: () => ({ ...process.env, PYTHONDONTWRITEBYTECODE: '1' }),
      timeoutMs: 600000,
      maxOutputBytes: 1024 * 1024,
    });
    let store = new ReaderJobStore({ directory });
    const created = store.create({
      viewer: 'reader-fixture',
      idempotency_key: 'interrupted',
      identity,
      request,
    });
    const run = async (job, stopAfterCheckpoint = false) => {
      const lease = store.lease(job.id);
      let summary;
      const result = await bridge.runReaderLease(
        {
          source,
          identity,
          declarations: {},
          requested: request.requested_layers,
          checkpoint: lease.cursor,
          committed_pages: store.workerPayload(job.id).page_paths,
          lease_ms: 600000,
        },
        {
          shouldStop: () => (stopAfterCheckpoint ? 'YIELD' : null),
          onReaderCheckpoint: (step) => {
            assert.equal(step.provider_calls, 0);
            summary = step.summary;
            const committed = store.commitCheckpoint(job.id, lease.attempt, lease.fence, {
              cursor: step.checkpoint,
              pages: packReaderPages(step.records),
              progress: summary.counters,
              coverage: summary.coverage,
            });
            return { added_page_paths: committed.added_page_paths };
          },
        }
      );
      assert.equal(result.code, 0, result.stderr);
      if (result.reader_result.status === 'complete')
        return store.complete(job.id, lease.attempt, lease.fence, {
          summary,
          coverage: summary.coverage,
          exhausted: true,
          census_reconciled: true,
          provider_calls: 0,
        });
      store.pause(job.id, lease.attempt, lease.fence, {
        code: 'INTERRUPTED',
        message: 'Explicit fixture interruption.',
        requeue: false,
      });
      return store.inspect(job.id);
    };
    const rows = (job, capability) => {
      const records = [];
      let offset = 0;
      do {
        const page = store.readManifestPage(
          job.id,
          capability,
          'reader-fixture',
          job.manifest_hash,
          { offset, limit: 250 }
        );
        for (const ref of page.page_refs)
          records.push(
            ...store.readPage(job.id, ref.sha256, capability, 'reader-fixture', job.manifest_hash)
              .instances
          );
        offset = page.next_offset;
      } while (offset !== null);
      return records;
    };
    try {
      const interrupted = await run(created.record, true);
      assert.equal(interrupted.state, 'paused');
      assert.ok(interrupted.checkpoint_hash);
      await bridge.internals.kill();
      store = new ReaderJobStore({ directory });
      const resumed = store.resume(interrupted.id, created.capability, 'reader-fixture', identity, {
        idempotency_key: 'resume-once',
      });
      const complete = await run(resumed);
      assert.ok(['completed', 'completed_with_refusals'].includes(complete.state));
      const final = store.readManifest(complete.id, created.capability, 'reader-fixture');
      assert.equal(final.partial, false);
      assert.equal(final.summary.coverage.pending_methods, 0);
      assert.equal(
        final.summary.coverage.requested_methods,
        final.summary.coverage.answered_methods + final.summary.coverage.refused_methods
      );
      assert.equal(final.summary.counters.evidence_records, complete.evidence_count);
      assert.equal(final.provider_calls, 0);
      const restartedRows = rows(complete, created.capability);
      const uninterrupted = store.create({
        viewer: 'reader-fixture',
        idempotency_key: 'uninterrupted',
        identity,
        request,
      });
      const other = await run(uninterrupted.record);
      assert.deepEqual(rows(other, uninterrupted.capability), restartedRows);
      assert.deepEqual(
        store.readManifest(other.id, uninterrupted.capability, 'reader-fixture').summary,
        final.summary
      );
      assert.equal(complete.attempt, 2);
    } finally {
      await bridge.internals.kill();
      await rm(directory, { recursive: true, force: true });
    }
  }
);

// B2: the job identity records the reader's word-cut scheme, read from the
// running Python reader (probeReaderScheme), never from a literal here. With
// no commit identity on either side (engine_commit null) and the same
// resources, a job queued before identities carried the scheme still differs
// from the identity the service now computes, so its lease refuses it
// STALE_READING before any reading; a job whose scheme matches runs.
test('a queued job without the reader scheme is refused at lease even with null commits; a matching one runs', async () => {
  const python = process.env.LYRIC_PYTHON || 'python3';
  const harnessDir = path.join(root, 'lyric-harness');
  const scheme = await probeReaderScheme({ python, harnessDir });
  // The probe asks the reader itself: the same answer its own module gives.
  const { execFileSync } = await import('node:child_process');
  assert.equal(
    scheme,
    execFileSync(
      python,
      ['-c', 'import lyric_harness as LH; print(LH.resolve_reader_scheme(None))'],
      {
        cwd: harnessDir,
      }
    )
      .toString()
      .trim()
  );
  await assert.rejects(probeReaderScheme({ python, harnessDir: tmpdir() }), {
    code: 'READER_UNAVAILABLE',
  });
  assert.throws(
    () => createCatalogResolver({ directory: tmpdir(), engineCommit: null }),
    TypeError
  );

  const directory = await mkdtemp(path.join(tmpdir(), 'reader-scheme-'));
  const sha = (value) => createHash('sha256').update(value).digest('hex');
  try {
    const catalogDir = path.join(directory, 'catalog');
    await mkdir(path.join(catalogDir, 'readings'), { recursive: true });
    const source = {
      reading_unit_id: 'unit_scheme',
      language: 'eng',
      availability: 'readable',
      source_path: 'corpus/library/scheme.txt',
      source_sha256: sha('original'),
      normalized_text: 'Oh--oh, oh my love',
      normalized_sha256: sha('Oh--oh, oh my love'),
      work_id: 'work_scheme',
      edition_id: 'edition_scheme',
    };
    source.reading_revision = sha(canonicalJSON(source));
    const entry = {
      reading_unit_id: source.reading_unit_id,
      reading_revision: source.reading_revision,
      language: 'eng',
      availability: 'readable',
      path: 'readings/unit_scheme.json',
      source_sha256: source.source_sha256,
      normalized_sha256: source.normalized_sha256,
      work_id: source.work_id,
      edition_id: source.edition_id,
    };
    const sourceBytes = JSON.stringify(source);
    const indexBytes = JSON.stringify({ readings: [entry] });
    await writeFile(path.join(catalogDir, entry.path), sourceBytes);
    await writeFile(path.join(catalogDir, 'index.json'), indexBytes);
    const manifest = {
      parser_version: 'fixture1',
      normalizer_version: 'fixture1',
      artifacts: { 'index.json': sha(indexBytes), [entry.path]: sha(sourceBytes) },
    };
    manifest.snapshot_id = sha(canonicalJSON(manifest));
    await writeFile(path.join(catalogDir, 'manifest.json'), JSON.stringify(manifest));
    // Null commits on both sides: only the scheme can tell the jobs apart.
    const resolver = createCatalogResolver({
      directory: catalogDir,
      engineCommit: null,
      resourceFingerprint: 'same-resources',
      readerScheme: scheme,
    });
    const request = {
      contract_version: 1,
      snapshot_id: manifest.snapshot_id,
      reading_unit_id: source.reading_unit_id,
      reading_revision: source.reading_revision,
      declaration_set: {},
      requested_layers: ['sound'],
    };
    const current = await resolver.resolveIdentity(request);
    assert.equal(current.engine_commit, null);
    assert.equal(current.reader_scheme, scheme);
    const { reader_scheme: _dropped, ...before } = current;
    const store = new ReaderJobStore({ directory: path.join(directory, 'jobs') });
    const earlier = store.create({
      viewer: 'viewer',
      idempotency_key: 'queued-before-the-scheme',
      identity: before,
      request,
    });
    const other = store.create({
      viewer: 'viewer-two',
      idempotency_key: 'queued-under-another-scheme',
      identity: { ...current, reader_scheme: scheme === 'v2' ? 'v1' : 'v2' },
      request,
    });
    const leases = [];
    const bridge = {
      capacity: () => ({ active: 0, admitted: 0, queued: 0 }),
      runReaderLease: async (payload, { onReaderCheckpoint }) => {
        leases.push(payload.identity);
        await onReaderCheckpoint({
          provider_calls: 0,
          checkpoint: { done: true },
          records: [{ id: 'evidence_1' }],
          done: true,
          summary: {
            coverage: {
              certified: true,
              partial: false,
              requested_methods: 1,
              answered_methods: 1,
              refused_methods: 0,
              pending_methods: 0,
              not_requested_methods: 0,
              refused_obligations: [],
            },
            counters: { candidates: 1, evidence_records: 1 },
          },
        });
        return { code: 0, reader_result: { status: 'complete' } };
      },
    };
    const scheduler = new ReaderScheduler({ store, bridge, ...resolver });
    try {
      await scheduler.pump();
      await scheduler.pump();
      for (const job of [earlier, other]) {
        const after = store.inspect(job.record.id);
        assert.equal(after.state, 'paused');
        assert.equal(after.reason.code, 'STALE_READING');
      }
      assert.equal(leases.length, 0, 'neither job was read');
      const matching = store.create({
        viewer: 'viewer-three',
        idempotency_key: 'queued-under-this-scheme',
        identity: current,
        request,
      });
      await scheduler.pump();
      assert.equal(leases.length, 1);
      assert.equal(leases[0].reader_scheme, scheme);
      const ran = store.inspect(matching.record.id);
      assert.ok(['completed', 'completed_with_refusals'].includes(ran.state), JSON.stringify(ran));
    } finally {
      scheduler.stop();
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
