import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, writeFile, copyFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { ReaderJobStore } from './reader_job_store.js';
import {
  ReaderScheduler,
  packReaderPages,
  canonicalJSON,
  createCatalogResolver,
} from './reader_scheduler.js';
import { createPythonBridge } from './python_bridge.js';
import { canonicalReaderQuery, canonicalReaderSigningInput } from './reader_protocol.js';
import { createReaderRouter, signReaderRequest } from './reader_routes.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const secret = 'test-reader-private-secret-32bytes-only';
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const identity = {
  snapshot_id: 'a'.repeat(64),
  reading_unit_id: 'unit_one',
  reading_revision: 'revision_one',
  engine_commit: 'fixture',
};
const request = {
  contract_version: 1,
  snapshot_id: identity.snapshot_id,
  reading_unit_id: identity.reading_unit_id,
  reading_revision: identity.reading_revision,
  declaration_set: {},
  requested_layers: ['sound'],
};
const coverage = {
  certified: true,
  partial: false,
  requested_methods: 1,
  answered_methods: 1,
  refused_methods: 0,
  pending_methods: 0,
  not_requested_methods: 0,
  refused_obligations: [],
};

async function httpFixture() {
  const directory = await mkdtemp(path.join(tmpdir(), 'reader-http-'));
  const store = new ReaderJobStore({ directory });
  const app = express();
  app.use(
    express.json({
      verify: (req, _res, bytes) => {
        req.readerRawBody = Buffer.from(bytes);
      },
    })
  );
  app.use(
    createReaderRouter({
      store,
      scheduler: { kick() {} },
      secret,
      site: 'library-test',
      resolveIdentity: async (input) => ({ ...identity, declaration_set: input.declaration_set }),
    })
  );
  const server = await new Promise((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const call = async (
    method,
    route,
    {
      input,
      viewer = 'viewer-one',
      idempotency = 'request-one',
      job = '',
      capability = '',
      attempt = '',
      generation = '',
      headers: changes = {},
      signedBody,
    } = {}
  ) => {
    const body = input === undefined ? '' : JSON.stringify(input);
    const headers = signReaderRequest({
      secret,
      method,
      path: route,
      body: signedBody ?? body,
      site: 'library-test',
      viewer,
      job,
      capability,
      attempt,
      generation,
      idempotency: ['POST', 'DELETE'].includes(method) ? idempotency : '',
    });
    const response = await fetch(origin + route, {
      method,
      headers: { ...headers, ...changes, ...(body ? { 'content-type': 'application/json' } : {}) },
      ...(body ? { body } : {}),
    });
    const bytes = await response.text();
    return { status: response.status, body: JSON.parse(bytes), bytes, headers: response.headers };
  };
  return {
    store,
    call,
    close: async () => {
      await new Promise((resolve) => server.close(resolve));
      await rm(directory, { recursive: true, force: true });
    },
  };
}

test('portable signing input binds exact body, query, viewer and capability', () => {
  assert.equal(canonicalReaderQuery('?z=last&a=hello%20world'), 'a=hello+world&z=last');
  assert.throws(() => canonicalReaderQuery('?a=one&a=two'), /Repeated/);
  const bytes = canonicalReaderSigningInput({
    method: 'get',
    path: '/internal/reader/jobs/job?z=2&a=1',
    body_sha256: sha(''),
    capability_sha256: sha('cap'),
    site: 'site',
    viewer: 'viewer',
    time: 1770000000,
    nonce: '1'.repeat(32),
  });
  assert.equal(bytes.split('\n').length, 14);
  assert.equal(bytes.split('\n')[3], 'a=1&z=2');
  assert.equal(bytes.endsWith('\n'), false);
});

test('private route create is durable/idempotent and changed bodies or other viewers refuse', async () => {
  const f = await httpFixture();
  try {
    const created = await f.call('POST', '/internal/reader/jobs', { input: request });
    assert.equal(created.status, 202);
    assert.ok(created.body.capability);
    assert.equal('fence' in created.body.job, false);
    assert.equal('viewer' in created.body.job, false);
    const repeated = await f.call('POST', '/internal/reader/jobs', { input: request });
    assert.equal(repeated.status, 200);
    assert.equal(repeated.body.job.id, created.body.job.id);
    assert.equal(repeated.body.capability, created.body.capability);
    const changed = await f.call('POST', '/internal/reader/jobs', {
      input: { ...request, declaration_set: { voice: 'other' } },
    });
    assert.equal(changed.status, 409);
    const tampered = await f.call('POST', '/internal/reader/jobs', {
      input: request,
      signedBody: '{}',
    });
    assert.equal(tampered.status, 401);
    const privateRead = await f.call('GET', `/internal/reader/jobs/${created.body.job.id}`, {
      job: created.body.job.id,
      capability: created.body.capability,
      viewer: 'another-viewer',
    });
    assert.equal(privateRead.status, 404);
  } finally {
    await f.close();
  }
});

test('signed pull returns exact fixed-manifest hashes and refuses unreferenced pages', async () => {
  const f = await httpFixture();
  try {
    const created = await f.call('POST', '/internal/reader/jobs', { input: request });
    const { id } = created.body.job;
    const capability = created.body.capability;
    const lease = f.store.lease(id);
    const checkpoint = f.store.commitCheckpoint(id, lease.attempt, lease.fence, {
      cursor: { done: true },
      pages: [{ instances: [{ id: 'evidence_one', verdict: 'true' }] }],
      progress: {},
      coverage,
    });
    const partialHash = checkpoint.manifest_hash;
    const complete = f.store.complete(id, lease.attempt, lease.fence, {
      exhausted: true,
      census_reconciled: true,
      coverage,
      provider_calls: 0,
    });
    const binding = { job: id, capability };
    const manifest = await f.call(
      'GET',
      `/internal/reader/jobs/${id}/manifests/${complete.manifest_hash}`,
      binding
    );
    assert.equal(manifest.status, 200);
    assert.equal(sha(manifest.bytes), complete.manifest_hash);
    const refs = await f.call(
      'GET',
      `/internal/reader/jobs/${id}/manifests/${complete.manifest_hash}/pages?limit=250&offset=0`,
      binding
    );
    assert.equal(refs.status, 200);
    const ref = refs.body.page_refs[0];
    const page = await f.call(
      'GET',
      `/internal/reader/jobs/${id}/pages/${ref.sha256}?manifest=${complete.manifest_hash}`,
      binding
    );
    assert.equal(page.status, 200);
    assert.equal(sha(page.bytes), ref.sha256);
    assert.equal(page.body.instances[0].id, 'evidence_one');
    assert.equal(
      (await f.call('GET', `/internal/reader/jobs/${id}/manifests/${partialHash}`, binding)).status,
      200
    );
    assert.equal(
      (
        await f.call(
          'GET',
          `/internal/reader/jobs/${id}/pages/${'0'.repeat(64)}?manifest=${complete.manifest_hash}`,
          binding
        )
      ).status,
      404
    );
    assert.equal(
      (await f.call('GET', `/internal/reader/jobs/${id}/pages/${ref.sha256}`, binding)).status,
      400
    );
  } finally {
    await f.close();
  }
});

test('signed controls accept numeric bindings, reject stale new actions and replay deletion safely', async () => {
  const f = await httpFixture();
  try {
    const created = await f.call('POST', '/internal/reader/jobs', { input: request });
    const { id } = created.body.job;
    const binding = { job: id, capability: created.body.capability, attempt: 0, generation: 0 };
    assert.equal(
      (
        await f.call('POST', `/internal/reader/jobs/${id}/cancel`, {
          ...binding,
          idempotency: 'cancel-first',
        })
      ).status,
      200
    );
    assert.equal(
      (
        await f.call('POST', `/internal/reader/jobs/${id}/resume`, {
          ...binding,
          idempotency: 'resume-first',
        })
      ).status,
      202
    );
    const lease = f.store.lease(id);
    const repeat = await f.call('POST', `/internal/reader/jobs/${id}/resume`, {
      ...binding,
      idempotency: 'resume-first',
    });
    assert.equal(repeat.status, 202);
    assert.equal(repeat.body.job.attempt, lease.attempt);
    const stale = await f.call('POST', `/internal/reader/jobs/${id}/cancel`, {
      ...binding,
      idempotency: 'cancel-stale',
    });
    assert.equal(stale.status, 409);
    assert.equal(stale.body.error.code, 'STALE_ATTEMPT');
    const current = { ...binding, attempt: lease.attempt };
    assert.equal(
      (
        await f.call('POST', `/internal/reader/jobs/${id}/cancel`, {
          ...current,
          idempotency: 'cancel-current',
        })
      ).status,
      200
    );
    assert.equal(f.store.inspect(id).cancel_requested, true);
    f.store.pause(id, lease.attempt, lease.fence, {
      code: 'CANCELLED',
      message: 'Stopped at safe point.',
    });
    const deletion = { ...current, idempotency: 'delete-current' };
    assert.equal((await f.call('DELETE', `/internal/reader/jobs/${id}`, deletion)).status, 200);
    assert.equal((await f.call('DELETE', `/internal/reader/jobs/${id}`, deletion)).status, 200);
    const changed = await f.call('DELETE', `/internal/reader/jobs/${id}`, {
      ...deletion,
      input: { changed: true },
    });
    assert.equal(changed.status, 409);
  } finally {
    await f.close();
  }
});

test('page packing respects encoded UTF-8 bytes and 250 records', () => {
  const pages = packReaderPages(
    Array.from({ length: 501 }, (_, index) => ({ id: index, text: 'é' }))
  );
  assert.deepEqual(
    pages.map((page) => page.instances.length),
    [250, 250, 1]
  );
  assert.throws(() => packReaderPages([{ text: 'é'.repeat(2 * 1024 * 1024) }]), {
    code: 'RESOURCE_LIMIT',
  });
});

test('local catalog resolution verifies snapshot, registered paths, full revision and artifact bytes', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'reader-pinned-catalog-'));
  try {
    await mkdir(path.join(directory, 'readings'));
    const source = {
      reading_unit_id: 'unit_one',
      language: 'fin',
      availability: 'readable',
      source_sha256: sha('original'),
      normalized_sha256: sha('Vaka vanha'),
      work_id: 'work_one',
      edition_id: 'edition_one',
      normalized_text: 'Vaka vanha',
      lines: [],
    };
    source.reading_revision = sha(canonicalJSON(source));
    const entry = {
      reading_unit_id: source.reading_unit_id,
      reading_revision: source.reading_revision,
      language: 'fin',
      availability: 'readable',
      path: 'readings/unit_one.json',
      source_sha256: sha('original'),
      normalized_sha256: sha(source.normalized_text),
      work_id: 'work_one',
      edition_id: 'edition_one',
    };
    const sourceBytes = JSON.stringify(source);
    const indexBytes = JSON.stringify({ readings: [entry] });
    await writeFile(path.join(directory, entry.path), sourceBytes);
    await writeFile(path.join(directory, 'index.json'), indexBytes);
    const manifest = {
      parser_version: 'fixture1',
      normalizer_version: 'fixture1',
      artifacts: {
        'index.json': sha(indexBytes),
        [entry.path]: sha(sourceBytes),
      },
    };
    manifest.snapshot_id = sha(canonicalJSON(manifest));
    await writeFile(path.join(directory, 'manifest.json'), JSON.stringify(manifest));
    const resolver = createCatalogResolver({ directory, engineCommit: 'fixture' });
    const input = {
      ...request,
      snapshot_id: manifest.snapshot_id,
      reading_revision: source.reading_revision,
    };
    assert.equal((await resolver.resolveSource(input)).source.normalized_text, 'Vaka vanha');
    assert.equal(
      (await resolver.resolveIdentity(input)).normalized_sha256,
      entry.normalized_sha256
    );
    await assert.rejects(resolver.resolveSource({ ...input, reading_revision: 'changed' }), {
      code: 'STALE_READING',
    });
    await writeFile(
      path.join(directory, entry.path),
      JSON.stringify({ ...source, normalized_text: 'tampered' })
    );
    await assert.rejects(resolver.resolveSource(input), { code: 'SNAPSHOT_CHANGED' });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

async function bridgeFixture() {
  const directory = await mkdtemp(path.join(tmpdir(), 'reader-shared-worker-'));
  const harnessDir = path.join(directory, 'lyric-harness');
  const mcpDir = path.join(directory, 'mcp');
  await mkdir(path.join(harnessDir, 'library'), { recursive: true });
  await mkdir(mcpDir);
  await copyFile(path.join(here, 'worker.py'), path.join(mcpDir, 'worker.py'));
  await writeFile(
    path.join(harnessDir, 'lyric_harness.py'),
    'import sys\ndef cli():\n print("writer answered", flush=True)\n return 0\n'
  );
  await writeFile(
    path.join(harnessDir, 'library', 'analysis.py'),
    `import time
class AnalysisSession:
 def __init__(self, source, declarations=None, requested=None, checkpoint=None, **kwargs):
  self.at = (checkpoint or {}).get('at',0)
 def step(self, **kwargs):
  self.at += 1
  time.sleep(.01)
  done = self.at >= 4
  coverage = {'certified':done,'partial':not done,'requested_methods':1,'answered_methods':int(done),'refused_methods':0,'pending_methods':int(not done),'not_requested_methods':0,'refused_obligations':[]}
  return {'checkpoint':{'at':self.at,'done':done},'records':[{'id':'evidence_'+str(self.at)}],'done':done,'provider_calls':0,'summary':{'coverage':coverage,'counters':{'candidates':self.at,'evidence_records':self.at}}}
`
  );
  const bridge = createPythonBridge({
    python: 'python3',
    harnessDir,
    workerPath: path.join(mcpDir, 'worker.py'),
    harnessEnv: () => ({ ...process.env, PYTHONDONTWRITEBYTECODE: '1' }),
    timeoutMs: 1000,
    maxOutputBytes: 1024 * 1024,
  });
  return {
    bridge,
    directory,
    close: async () => {
      await bridge.internals.kill();
      await rm(directory, { recursive: true, force: true });
    },
  };
}

test('reader fsync acknowledgement precedes yield and writing uses the same worker', async () => {
  const f = await bridgeFixture();
  try {
    let release;
    let reached;
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    const checkpointReached = new Promise((resolve) => {
      reached = resolve;
    });
    const reader = f.bridge.runReaderLease(
      { source: { text: 'first\nsecond' }, lease_ms: 1000 },
      {
        onReaderCheckpoint: async () => {
          reached();
          await gate;
          return {};
        },
      }
    );
    await checkpointReached;
    const pid = f.bridge.internals.pid();
    const writer = f.bridge.runVerb(['grade']);
    release();
    const read = await reader;
    assert.equal(read.code, 0);
    assert.equal(read.reader_result.reason, 'YIELD');
    assert.equal((await writer).stdout.trim(), 'writer answered');
    assert.equal(f.bridge.internals.pid(), pid);
    assert.equal(f.bridge.capacity().admitted, 0);
  } finally {
    await f.close();
  }
});

test('durable scheduler completes without an open browser and preserves immutable pages', async () => {
  const f = await bridgeFixture();
  const store = new ReaderJobStore({ directory: path.join(f.directory, 'data') });
  const created = store.create({ viewer: 'viewer', idempotency_key: 'analyze', identity, request });
  const scheduler = new ReaderScheduler({
    store,
    bridge: f.bridge,
    resolveIdentity: async () => identity,
    resolveSource: async () => ({ source: { text: 'first\nsecond' } }),
  });
  try {
    await scheduler.pump();
    const complete = store.get(created.record.id, created.capability, 'viewer');
    assert.equal(complete.state, 'completed');
    const manifest = store.readManifest(complete.id, created.capability, 'viewer');
    assert.equal(manifest.provider_calls, 0);
    const refs = store.readManifestPage(complete.id, created.capability, 'viewer').page_refs;
    const evidence = refs.flatMap(
      (ref) => store.readPage(complete.id, ref.sha256, created.capability, 'viewer').instances
    );
    assert.deepEqual(
      evidence.map((row) => row.id),
      ['evidence_1', 'evidence_2', 'evidence_3', 'evidence_4']
    );
  } finally {
    scheduler.stop();
    await f.close();
  }
});

test('successful bounded leases requeue automatically until the whole traversal completes', async () => {
  const f = await bridgeFixture();
  const store = new ReaderJobStore({ directory: path.join(f.directory, 'data') });
  const created = store.create({ viewer: 'viewer', idempotency_key: 'analyze', identity, request });
  const scheduler = new ReaderScheduler({
    store,
    bridge: f.bridge,
    leaseMs: 5,
    resolveIdentity: async () => identity,
    resolveSource: async () => ({ source: { text: 'first\nsecond' } }),
  });
  try {
    scheduler.kick();
    const deadline = Date.now() + 5000;
    let complete;
    do {
      await new Promise((resolve) => setTimeout(resolve, 10));
      complete = store.get(created.record.id, created.capability, 'viewer');
    } while (complete.state !== 'completed' && Date.now() < deadline);
    assert.equal(complete.state, 'completed');
    assert.equal(complete.attempt, 4);
    assert.equal(complete.evidence_count, 4);
  } finally {
    scheduler.stop();
    await f.close();
  }
});
