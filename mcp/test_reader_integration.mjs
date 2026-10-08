// Actual pinned catalog + actual native judges; no provider HTTP or writer calls.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { ReaderJobStore } from './reader_job_store.js';
import { createCatalogResolver, packReaderPages } from './reader_scheduler.js';
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
