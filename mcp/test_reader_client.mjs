import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, writeFile, copyFile, rm, readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { ReaderJobStore } from './reader_job_store.js';
import {
  READER_REPLY_CAUSES_ENFORCED,
  ReaderScheduler,
  packReaderPages,
  canonicalJSON,
  createCatalogResolver,
  semanticDeclarations,
} from './reader_scheduler.js';
import { createPythonBridge } from './python_bridge.js';
import { canonicalReaderQuery, canonicalReaderSigningInput } from './reader_protocol.js';
import { createReaderRouter, publicReaderJob, signReaderRequest } from './reader_routes.js';
import { DISCOVERY_CAUSES, causeMessage } from './reader_discovery.js';

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

async function httpFixture({ scheduler = { kick() {} } } = {}) {
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
      scheduler,
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
    directory,
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
    const resolver = createCatalogResolver({
      directory,
      engineCommit: 'fixture',
      readerScheme: 'v2',
    });
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

test('the create path verifies a large reading off the event loop, with the same refusals', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'reader-large-catalog-'));
  try {
    await mkdir(path.join(directory, 'readings'));
    // About 30 MB of lines, as Kalevala's canonical reading is.
    const lines = Array.from({ length: 200_000 }, (_, i) => ({
      kind: 'lyric',
      text: `Line ${i} of a long reading, mieleni minun tekevi, aivoni ajattelevi`,
      row: i,
      ranges: [i, i + 64],
    }));
    const source = {
      reading_unit_id: 'unit_long',
      language: 'fin',
      availability: 'readable',
      source_path: 'corpus/library/long.txt',
      source_sha256: sha('original'),
      normalized_sha256: sha('long'),
      work_id: 'work_long',
      edition_id: 'edition_long',
      lines,
    };
    source.reading_revision = sha(canonicalJSON(source));
    const sourceBytes = JSON.stringify(source);
    assert.ok(sourceBytes.length > 20_000_000);
    const readingPath = 'readings/unit_long.json';
    const indexBytes = JSON.stringify({ readings: [] });
    await writeFile(path.join(directory, readingPath), sourceBytes);
    await writeFile(path.join(directory, 'index.json'), indexBytes);
    const manifest = {
      parser_version: 'fixture1',
      normalizer_version: 'fixture1',
      artifacts: { 'index.json': sha(indexBytes), [readingPath]: sha(sourceBytes) },
    };
    manifest.snapshot_id = sha(canonicalJSON(manifest));
    await writeFile(path.join(directory, 'manifest.json'), JSON.stringify(manifest));
    const resolver = createCatalogResolver({
      directory,
      engineCommit: 'fixture',
      readerScheme: 'v2',
    });
    const input = {
      contract_version: 1,
      snapshot_id: manifest.snapshot_id,
      reading_unit_id: 'unit_long',
      reading_revision: source.reading_revision,
      requested_layers: ['sound'],
    };
    await resolver.probe(); // the snapshot's index hash, outside the measurement
    // The longest gap between 5 ms ticks while each call runs.
    const lagDuring = async (fn) => {
      let last = performance.now();
      let worst = 0;
      const timer = setInterval(() => {
        const now = performance.now();
        worst = Math.max(worst, now - last);
        last = now;
      }, 5);
      const value = await fn();
      clearInterval(timer);
      return { value, worst: Math.max(worst, performance.now() - last) };
    };
    const onLoop = await lagDuring(() => resolver.resolveSource(input));
    const offLoop = await lagDuring(() => resolver.resolveIdentity(input));
    assert.equal(offLoop.value.normalized_sha256, source.normalized_sha256);
    assert.equal(offLoop.value.native_profile, 'fin');
    assert.deepEqual(await resolver.prepareRequest(input), input);
    assert.ok(
      offLoop.worst < onLoop.worst / 2 && offLoop.worst < 150,
      `create-path verification blocked the loop ${Math.round(offLoop.worst)} ms ` +
        `(the in-thread parse blocks ${Math.round(onLoop.worst)} ms)`
    );
    const { entry } = await resolver.resolveEntry(input);
    assert.equal(entry.lyric_lines, null, 'lines cross only for a pronunciation-bound reading');
    assert.equal(entry.lines, undefined);
    await assert.rejects(resolver.resolveIdentity({ ...input, reading_revision: 'changed' }), {
      code: 'STALE_READING',
    });
    await writeFile(path.join(directory, readingPath), sourceBytes.replace('Line 0', 'Line O'));
    await assert.rejects(resolver.resolveIdentity(input), { code: 'SNAPSHOT_CHANGED' });
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

// A Library job created before the reader's word-cut release and still queued
// (or paused) after it carries pronunciation numbers counted under the
// earlier cut. The scheduler recomputes the identity, engine commit included,
// before every lease: the job is refused STALE_READING and never runs those
// numbers under the current reader, and its stored request and identity
// (declaration_hash included) are not rewritten. A NEW job made from the
// rebound choices has a different declaration_hash, as any changed
// declaration set does (src/library/analysis.js savedInterpretation).
test('a job queued across the word-cut release is refused, never run, never rewritten', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'reader-cut-'));
  const line = 'Oh--oh, oh my love';
  const choice = (token) => ({
    line,
    token,
    word: 'oh',
    phones: ['AA1'],
    basis: 'declared',
    source: 'the singer',
  });
  const hash = (set) => sha(canonicalJSON(semanticDeclarations(set)));
  const legacySet = { pronunciations: [choice(2)] };
  const reboundSet = { pronunciations: [choice(3)] };
  const legacyRequest = { ...request, declaration_set: legacySet };
  const legacyIdentity = {
    ...identity,
    engine_commit: 'before-the-cut',
    declaration_hash: hash(legacySet),
  };
  const store = new ReaderJobStore({ directory });
  const created = store.create({
    viewer: 'viewer',
    idempotency_key: 'queued-before',
    identity: legacyIdentity,
    request: legacyRequest,
  });
  const before = structuredClone(store.inspect(created.record.id));
  let leases = 0;
  const scheduler = new ReaderScheduler({
    store,
    bridge: {
      capacity: () => ({ active: 0, admitted: 0, queued: 0 }),
      runReaderLease: async () => {
        leases++;
        throw new Error('must not run');
      },
    },
    resolveIdentity: async (input) => ({
      ...identity,
      engine_commit: 'after-the-cut',
      declaration_hash: hash(input.declaration_set),
    }),
    resolveSource: async () => ({ source: { text: line } }),
  });
  try {
    await scheduler.pump();
    const after = store.inspect(created.record.id);
    assert.equal(leases, 0);
    assert.equal(after.state, 'paused');
    assert.equal(after.reason.code, 'STALE_READING');
    assert.deepEqual(after.request, before.request);
    assert.deepEqual(after.identity, before.identity);
    assert.equal(after.identity.declaration_hash, hash(legacySet));
    // The rebound set is a different declaration set, so a new job has a
    // new identity; the stored one above keeps the old hash.
    assert.notEqual(hash(reboundSet), hash(legacySet));
  } finally {
    scheduler.stop();
    await rm(directory, { recursive: true, force: true });
  }
});

// DISCOVERY_V1 §2.11, admission (BB8's guard test and stored-request case).
// The fixture's bodies hold the escape `\ud800` as raw JSON text, which
// express.json turns into a lone surrogate.
const admissionCases = JSON.parse(
  await readFile(path.join(here, 'fixtures/discovery_v1/good/codec_error_mapping.json'), 'utf8')
).admission;
const NOT_WELL_FORMED = 'The declaration set contains text that is not well-formed Unicode.';
// A bridge that records every lease the scheduler hands it and runs none.
function spyBridge() {
  const leases = [];
  return {
    leases,
    capacity: () => ({ active: 0, admitted: 0, queued: 0 }),
    runReaderLease: async (req) => {
      leases.push(req);
      return { code: 1, error_code: 'READER_ERROR', stderr: 'spy bridge' };
    },
  };
}

test('admission: the Site bridge refuses a lone surrogate in a line or a key, before any job', async () => {
  const kicks = [];
  const f = await httpFixture({ scheduler: { kick: () => kicks.push(1) } });
  const bridge = spyBridge();
  const resolved = [];
  const scheduler = new ReaderScheduler({
    store: f.store,
    bridge,
    resolveIdentity: async (input) => {
      resolved.push(input);
      return { ...identity, declaration_set: input.declaration_set };
    },
    resolveSource: async () => ({ source: { text: 'Bad' } }),
  });
  try {
    assert.deepEqual(
      admissionCases.refused.map((c) => c.name),
      ['line', 'key']
    );
    for (const c of admissionCases.refused) {
      assert.match(c.body, /\\ud800/, `${c.name}: sent as the JSON escape`);
      const input = { ...request, ...JSON.parse(c.body) };
      const refused = await f.call('POST', '/internal/reader/jobs', {
        input,
        idempotency: `refused-${c.name}`,
      });
      assert.equal(refused.status, 400, c.name);
      assert.deepEqual(
        { code: refused.body.error.code, message: refused.body.error.message },
        { code: 'INVALID_DECLARATION', message: NOT_WELL_FORMED },
        c.name
      );
    }
    // No job: no record in the store or on disk, nothing kicked, nothing to
    // lease, and the bridge never asked.
    assert.equal(f.store.records.size, 0);
    const records = path.join(f.directory, 'records');
    assert.deepEqual(
      existsSync(records) ? (await readdir(records)).filter((n) => n.endsWith('.json')) : [],
      []
    );
    assert.equal(kicks.length, 0);
    await scheduler.pump();
    assert.equal(bridge.leases.length, 0);
    assert.equal(resolved.length, 0);
    // The control: a well-formed pair (an emoji) is admitted, stored as sent
    // and handed to the worker as it is.
    const [pair] = admissionCases.admitted;
    const input = { ...request, ...JSON.parse(pair.body) };
    const created = await f.call('POST', '/internal/reader/jobs', {
      input,
      idempotency: 'admitted-pair',
    });
    assert.equal(created.status, 202);
    assert.equal(kicks.length, 1);
    await scheduler.pump();
    assert.equal(bridge.leases.length, 1);
    assert.deepEqual(bridge.leases[0].declarations, input.declaration_set);
    assert.equal(bridge.leases[0].declarations.pronunciations[0].line, 'Bad \u{1F600}');
  } finally {
    scheduler.stop();
    await f.close();
  }
});

// BB8 6704382892: the walk reaches every element, not only the first. The
// first pronunciation line is well-formed and the lone surrogate is in the
// second, so a walk that stops at an array's first element admits this body.
const SECOND_LINE_BODY =
  '{"declaration_set":{"pronunciations":[{"line":"Good"},{"line":"Bad \\ud800"}]}}';

test('admission: the Site bridge refuses a lone surrogate in the second line, before any job', async () => {
  const kicks = [];
  const f = await httpFixture({ scheduler: { kick: () => kicks.push(1) } });
  try {
    assert.match(SECOND_LINE_BODY, /\\ud800/, 'sent as the JSON escape');
    const input = { ...request, ...JSON.parse(SECOND_LINE_BODY) };
    assert.equal(input.declaration_set.pronunciations[0].line.isWellFormed(), true);
    assert.equal(input.declaration_set.pronunciations[1].line.isWellFormed(), false);
    const refused = await f.call('POST', '/internal/reader/jobs', {
      input,
      idempotency: 'refused-second-line',
    });
    assert.equal(refused.status, 400);
    assert.deepEqual(
      { code: refused.body.error.code, message: refused.body.error.message },
      { code: 'INVALID_DECLARATION', message: NOT_WELL_FORMED }
    );
    // Nothing written: no record in the store or on disk, nothing kicked.
    assert.equal(f.store.records.size, 0);
    const records = path.join(f.directory, 'records');
    assert.deepEqual(
      existsSync(records) ? (await readdir(records)).filter((n) => n.endsWith('.json')) : [],
      []
    );
    assert.equal(kicks.length, 0);
  } finally {
    await f.close();
  }
});

test('admission: a stored request with a lone surrogate is leased, refused at the check and paused', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'reader-stored-'));
  const st = admissionCases.stored_request;
  assert.equal(st.written_before_the_check, true);
  const stored = { ...request, ...JSON.parse(st.request) };
  const store = new ReaderJobStore({ directory });
  // Written as an image without the check wrote it: store.create holds the
  // request to JSON, not to well-formed Unicode.
  const created = store.create({
    viewer: 'viewer',
    idempotency_key: 'written-before',
    identity,
    request: stored,
  });
  const before = store.inspect(created.record.id);
  assert.equal(before.state, 'queued');
  assert.equal(before.request.declaration_set.pronunciations[0].line, 'Bad \ud800');
  const bridge = spyBridge();
  const calls = [];
  const lease = store.lease.bind(store);
  store.lease = (...args) => {
    const record = lease(...args);
    calls.push({ lease: record && { state: record.state, attempt: record.attempt } });
    return record;
  };
  const scheduler = new ReaderScheduler({
    store,
    bridge,
    resolveIdentity: async () => {
      calls.push('resolveIdentity');
      return identity;
    },
    resolveSource: async () => {
      calls.push('resolveSource');
      return { source: { text: 'Bad' } };
    },
  });
  try {
    await scheduler.pump();
    // The store leased it first (saved running, attempt + 1); the check then
    // refused it, so identity, source and the bridge were never reached.
    assert.deepEqual(calls, [{ lease: { state: 'running', attempt: before.attempt + 1 } }]);
    assert.equal(bridge.leases.length, 0);
    const after = store.inspect(created.record.id);
    assert.equal(after.state, 'paused');
    assert.deepEqual(
      { code: after.reason.code, message: after.reason.message },
      { code: st.expect.code, message: NOT_WELL_FORMED }
    );
    assert.equal(after.attempt, before.attempt + 1);
    // The catch's pause ended the store's lease.
    assert.equal(after.fence, null);
    assert.equal(after.lease_expires_at, null);
    assert.deepEqual(after.request, before.request);
  } finally {
    scheduler.stop();
    await rm(directory, { recursive: true, force: true });
  }
});

// DISCOVERY_V1 §8 (#656 Step 4): a reason with a named cause stores no
// message; the job view renders it from the cause (default 7), and shows the
// reason's other fields as stored.
test('the job view renders a causal reason message from causeMessage', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'reader-render-'));
  try {
    const store = new ReaderJobStore({ directory });
    const show = (given) => {
      const { record } = store.create({
        viewer: `viewer-${given.code}-${given.cause ?? 'none'}`,
        idempotency_key: `render-${given.code}-${given.cause ?? 'none'}`,
        identity,
        request,
      });
      const lease = store.lease();
      assert.equal(lease.id, record.id);
      store.pause(lease.id, lease.attempt, lease.fence, { ...given, requeue: false });
      return {
        stored: store.inspect(record.id).reason,
        view: publicReaderJob(store.inspect(record.id)).reason,
      };
    };
    const resource = show({
      code: 'RESOURCE_LIMIT',
      message: 'figures',
      cause: 'resident_capacity',
    });
    assert.deepEqual(resource.stored, { code: 'RESOURCE_LIMIT', cause: 'resident_capacity' });
    assert.deepEqual(resource.view, {
      code: 'RESOURCE_LIMIT',
      cause: 'resident_capacity',
      message: causeMessage({ code: 'RESOURCE_LIMIT', cause: 'resident_capacity' }),
    });
    assert.match(resource.view.message, /needs more memory than this reader may use/);
    const unavailable = show({
      code: 'DISCOVERY_UNAVAILABLE',
      message: 'm',
      cause: 'segment_missing',
      log: 'alt_cells',
    });
    assert.deepEqual(unavailable.view, {
      code: 'DISCOVERY_UNAVAILABLE',
      cause: 'segment_missing',
      log: 'alt_cells',
      message: DISCOVERY_CAUSES.segment_missing.message,
    });
    // A reason without a cause is shown as stored.
    const plain = show({ code: 'READER_ERROR', message: 'worker text' });
    assert.deepEqual(plain.view, { code: 'READER_ERROR', message: 'worker text' });
    assert.deepEqual(plain.view, plain.stored);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

// ── DISCOVERY_V1 §8: reply and pause plumbing (#656 Step 4) ──────────────
const replyCauseInvalid = JSON.parse(
  await readFile(path.join(here, 'fixtures/discovery_v1/bad/reply_cause_invalid.json'), 'utf8')
);
const replyPauseRefused = JSON.parse(
  await readFile(path.join(here, 'fixtures/discovery_v1/bad/reply_pause_refused.json'), 'utf8')
);
const WORKER_TEXT = 'worker text';
const FALLBACK_TEXT = 'The reader reply could not be recorded: ';
const readerStep = (extra = {}) => ({
  provider_calls: 0,
  checkpoint: { phase: 'pairs', index: 1 },
  records: [{ id: 'evidence-a' }],
  summary: { progress: { candidates: 1 }, coverage },
  done: false,
  ...extra,
});
// A bridge that answers as python_bridge.js does: an error the sink throws
// kills the lease, which resolves with code -1, the error's code and its
// message, and no `reply`.
function scriptedBridge(plan) {
  return {
    capacity: () => ({ active: 0, admitted: 0, queued: 0 }),
    runReaderLease: async (_req, options) => {
      try {
        return await plan((step) => options.onReaderCheckpoint(step), options);
      } catch (thrown) {
        return { code: -1, error_code: thrown.code, stderr: thrown.message };
      }
    },
  };
}
const refusal = (code, message = `stubbed ${code}`, extra = {}) =>
  Object.assign(new Error(message), { code, status: 503, ...extra });
// One lease of job A (job B waits behind it) through the real store and
// scheduler; store.pause and store.complete are spied, and stubbed to refuse
// as `stub` names before the real store answers.
async function leaseOnce(t, { plan, enforce, stub = {}, commitError = null }) {
  const directory = await mkdtemp(path.join(tmpdir(), 'reader-pause-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  let now = Date.now();
  const store = new ReaderJobStore({ directory, now: () => now });
  const a = store.create({ viewer: 'viewer-a', idempotency_key: 'job-a', identity, request });
  const b = store.create({ viewer: 'viewer-b', idempotency_key: 'job-b', identity, request });
  const calls = [];
  const pauses = [...(stub.pause || [])];
  const pause = store.pause.bind(store);
  store.pause = (...args) => {
    const reason = args[3] || {};
    const call = {
      method: 'pause',
      code: reason.code,
      ...(String(reason.message).startsWith(FALLBACK_TEXT) ? { fallback: true } : {}),
    };
    try {
      const code = pauses.shift();
      if (code) throw refusal(code);
      const out = pause(...args);
      calls.push({ ...call, outcome: 'ok' });
      return out;
    } catch (thrown) {
      calls.push({ ...call, refused: thrown.code });
      throw thrown;
    }
  };
  const complete = store.complete.bind(store);
  store.complete = (...args) => {
    try {
      if (stub.complete) throw refusal(stub.complete.code, stub.complete.message);
      const out = complete(...args);
      calls.push({ method: 'complete', outcome: 'ok' });
      return out;
    } catch (thrown) {
      calls.push({ method: 'complete', refused: thrown.code });
      throw thrown;
    }
  };
  if (commitError)
    store.commitCheckpoint = () => {
      throw commitError();
    };
  const errors = [];
  const warnings = [];
  t.mock.method(console, 'error', (...args) => errors.push(args.map(String).join(' ')));
  t.mock.method(console, 'warn', (...args) => warnings.push(args.map(String).join(' ')));
  let leased = null;
  const scheduler = new ReaderScheduler({
    store,
    bridge: scriptedBridge(async (sink, options) => {
      leased = store.inspect(a.record.id);
      return plan(sink, options);
    }),
    resolveIdentity: async () => identity,
    resolveSource: async () => ({ source: { text: 'Bad' } }),
    ...(enforce === undefined ? {} : { enforceReplyCauses: enforce }),
  });
  t.mock.method(scheduler, 'kick', () => {});
  try {
    await scheduler.pump();
  } finally {
    scheduler.stop();
    t.mock.restoreAll();
  }
  return {
    store,
    a: a.record.id,
    b: b.record.id,
    calls,
    errors,
    warnings,
    leased,
    advance: (ms) => {
      now += ms;
    },
  };
}
// The record as the fixtures state it.
function outcome(run) {
  const after = run.store.inspect(run.a);
  if (after.state === 'running')
    return {
      state: 'running',
      discovery: Object.hasOwn(after, 'discovery') ? after.discovery : 'unchanged',
      saved: canonicalJSON(after) === canonicalJSON(run.leased) ? 'nothing' : 'changed',
    };
  return {
    state: after.state,
    deferred_requeue: after.deferred_requeue,
    fence: after.fence,
    lease_expires_at: after.lease_expires_at,
    discovery: Object.hasOwn(after, 'discovery') ? after.discovery : 'unchanged',
    reason: after.reason,
  };
}
// The lease a fixture case names, as a bridge plan.
function planOf(lease) {
  if (lease.reply) return async () => ({ ...lease.reply });
  if (lease.sink)
    return async (sink) => {
      await sink(readerStep({ provider_calls: lease.sink.provider_calls || 0 }));
      return { code: 0, reader_result: { status: 'complete' } };
    };
  if (lease.done)
    return async (sink) => {
      await sink(readerStep({ checkpoint: { phase: 'done', done: true }, done: true }));
      return { ...lease.result };
    };
  return async () => ({ ...lease.result });
}

test('reply_pause_refused.json: the fallback pause, every case under each C1 setting it names', async (t) => {
  assert.equal(replyPauseRefused.kind, 'fallback');
  for (const c of [...replyPauseRefused.cases, ...replyPauseRefused.controls])
    for (const enforce of c.c1) {
      const label = `${c.name} (C1 ${enforce ? 'on' : 'off'})`;
      // A sink error that is not a provider call is the store's commit
      // refusing, with the code, cause and log the case names.
      const commitError =
        c.lease.sink && !c.lease.sink.provider_calls
          ? () => Object.assign(new Error('stubbed refusal'), { status: 503, ...c.lease.sink })
          : null;
      const run = await leaseOnce(t, { plan: planOf(c.lease), enforce, stub: c.stub, commitError });
      assert.deepEqual(run.calls, c.expect.calls, `${label}: the store calls`);
      assert.deepEqual(outcome(run), c.expect.record, `${label}: the record`);
      assert.deepEqual(run.errors, c.expect.errors, `${label}: console.error`);
      assert.deepEqual(run.warnings, c.expect.warnings, `${label}: console.warn`);
      // A lease that ended lets the next job through; a refused fallback
      // leaves lease expiry as the backstop.
      if (c.expect.record.state === 'running') {
        assert.equal(run.store.lease(), null, `${label}: A still holds the one lease`);
        if (c.expect.after_lease_expiry) {
          run.advance(run.store.leaseMs + 1);
          const next = run.store.lease();
          assert.equal(next?.id, run.b, `${label}: B leases once A's lease expires`);
          const after = run.store.inspect(run.a);
          assert.deepEqual(
            outcome({ ...run, leased: null }),
            { ...c.expect.after_lease_expiry, reason: after.reason },
            label
          );
          assert.deepEqual(after.reason, c.expect.after_lease_expiry.reason, label);
        }
      } else assert.equal(run.store.lease()?.id, run.b, `${label}: B leases next`);
    }
});

// The C1-off outcomes bad/reply_cause_invalid.json does not state (Q3's
// reading: a reply's code, cause and log reach store.pause unchanged; where
// store.pause refuses INVALID_PAUSE, the fallback pause). Step 7's strict
// pause edits the rows it changes.
const FALLBACK_INVALID = {
  code: 'READER_PROTOCOL',
  message: 'The reader reply could not be recorded: INVALID_PAUSE.',
};
const PACKING_TEXT =
  'One evidence object exceeds the page limit; its adapter must provide identity-preserving subpages.';
const C1_OFF = {
  unavailable_without_a_cause: { code: 'DISCOVERY_UNAVAILABLE', message: WORKER_TEXT },
  unavailable_with_an_unknown_cause: FALLBACK_INVALID,
  unavailable_with_a_resource_cause: { code: 'DISCOVERY_UNAVAILABLE', message: WORKER_TEXT },
  unavailable_with_the_store_cause: {
    code: 'DISCOVERY_UNAVAILABLE',
    cause: 'segment_corrupt',
    log: 'alt_cells',
  },
  resource_limit_without_a_cause: { code: 'RESOURCE_LIMIT', message: WORKER_TEXT },
  resource_limit_with_an_unknown_cause: FALLBACK_INVALID,
  resource_limit_with_an_unavailable_cause: { code: 'RESOURCE_LIMIT', message: WORKER_TEXT },
  another_code_with_a_cause: { code: 'STALE_READING', message: WORKER_TEXT },
  a_cause_past_the_echo_bound: FALLBACK_INVALID,
  a_cause_that_is_not_a_string: FALLBACK_INVALID,
  a_log_outside_the_set: FALLBACK_INVALID,
  a_cause_without_its_log: {
    code: 'DISCOVERY_UNAVAILABLE',
    cause: 'segment_missing',
    log: null,
  },
  a_log_on_a_cause_without_one: {
    code: 'DISCOVERY_UNAVAILABLE',
    cause: 'inventory_mismatch',
    log: 'seen',
  },
  a_log_on_a_code_without_a_cause: { code: 'STALE_READING', message: WORKER_TEXT },
  unavailable_with_its_cause: {
    code: 'DISCOVERY_UNAVAILABLE',
    cause: 'segment_missing',
    log: 'alt_cells',
  },
  unavailable_with_an_optional_log_left_out: {
    code: 'DISCOVERY_UNAVAILABLE',
    cause: 'cursor_disagrees',
    log: null,
  },
  resource_limit_with_its_cause: { code: 'RESOURCE_LIMIT', cause: 'discovery_alt_seen' },
  resource_limit_with_a_log: { code: 'RESOURCE_LIMIT', cause: 'discovery_chain_segments' },
  resident_capacity: { code: 'RESOURCE_LIMIT', cause: 'resident_capacity' },
  declared_coordinate_bits: { code: 'RESOURCE_LIMIT', cause: 'declared_coordinate_bits' },
  another_code_without_a_cause: { code: 'STALE_READING', message: WORKER_TEXT },
  sink_resource_limit_from_packing: { code: 'RESOURCE_LIMIT', message: PACKING_TEXT },
  sink_record_bound: { code: 'RESOURCE_LIMIT', message: 'The record bound was passed.' },
  sink_discovery_unavailable: {
    code: 'DISCOVERY_UNAVAILABLE',
    cause: 'chain_broken',
    log: 'alt_cells',
  },
  bridge_failure_without_a_reply: { code: 'READER_PROTOCOL', message: 'bridge killed' },
};
// What a case cannot show before Step 7: a record released before the reply
// (U2), and the release a DISCOVERY_UNAVAILABLE pause makes (U1). Step 7
// removes these.
const BEFORE_STEP_7 = { skip: ['after_a_release'], release: 'released' };
// A reply_cause_invalid.json case as a lease: a worker reply, a sink error or
// a bridge failure.
function causeCase(c) {
  if (c.reply)
    return { plan: async () => ({ code: 1, ...c.reply, stderr: WORKER_TEXT }), commitError: null };
  if (c.bridge)
    return { plan: async () => ({ ...c.bridge, stderr: 'bridge killed' }), commitError: null };
  if (c.sink.code === 'RESOURCE_LIMIT' && !c.sink.status)
    return {
      plan: async (sink) => {
        await sink(readerStep({ records: [{ id: 'big', blob: 'x'.repeat(2 * 1024 * 1024) }] }));
        return { code: 0, reader_result: { status: 'complete' } };
      },
      commitError: null,
    };
  return {
    plan: async (sink) => {
      await sink(readerStep());
      return { code: 0, reader_result: { status: 'complete' } };
    },
    commitError: () =>
      Object.assign(
        new Error(
          c.sink.code === 'RESOURCE_LIMIT' ? 'The record bound was passed.' : 'stubbed refusal'
        ),
        c.sink
      ),
  };
}

test('reply_cause_invalid.json: every mutant and control under C1 off and on', async (t) => {
  const all = [...replyCauseInvalid.mutants, ...replyCauseInvalid.controls];
  assert.deepEqual(
    Object.keys(C1_OFF).sort(),
    all
      .map((c) => c.name)
      .filter((name) => !BEFORE_STEP_7.skip.includes(name))
      .sort(),
    'one C1-off row per mutant and control'
  );
  for (const c of all) {
    if (BEFORE_STEP_7.skip.includes(c.name)) continue;
    for (const enforce of [false, true]) {
      const label = `${c.name} (C1 ${enforce ? 'on' : 'off'})`;
      const run = await leaseOnce(t, { ...causeCase(c), enforce });
      const after = run.store.inspect(run.a);
      assert.equal(after.state, 'paused', label);
      assert.equal(after.deferred_requeue, false, label);
      assert.equal(after.fence, null, label);
      assert.equal(Object.hasOwn(after, 'discovery'), false, `${label}: nothing released`);
      const fallback = run.calls.some((call) => call.fallback);
      assert.equal(
        run.calls.filter((call) => call.method === 'pause').length,
        fallback ? 2 : 1,
        `${label}: one pause, or one refused and the fallback`
      );
      if (!enforce) {
        assert.deepEqual(after.reason, C1_OFF[c.name], label);
        continue;
      }
      // C1 on: the fixture's own outcome, less what Step 7 adds.
      const want = { ...c.expect.reason };
      delete want[BEFORE_STEP_7.release];
      const got = { ...after.reason };
      if (!Object.hasOwn(want, 'message')) delete got.message;
      assert.deepEqual(got, want, label);
      assert.equal(fallback, false, `${label}: no fallback`);
    }
  }
});

test('every refusal path ends the store lease, and the next job leases', async (t) => {
  const reply = (fields) => async () => ({
    reply: true,
    code: 1,
    stderr: WORKER_TEXT,
    ...fields,
  });
  const paths = [
    ['a sink READER_PROTOCOL', { plan: planOf({ sink: { provider_calls: 1 } }) }],
    [
      'a sink RESOURCE_LIMIT (413)',
      {
        plan: causeCase({ sink: { code: 'RESOURCE_LIMIT', status: 413 } }).plan,
        commitError: () =>
          refusal('RESOURCE_LIMIT', 'The record bound was passed.', { status: 413 }),
      },
    ],
    [
      'a sink DISCOVERY_UNAVAILABLE with a cause',
      {
        plan: causeCase({ sink: { code: 'DISCOVERY_UNAVAILABLE' } }).plan,
        commitError: () =>
          refusal('DISCOVERY_UNAVAILABLE', 'stubbed', {
            status: 409,
            cause: 'chain_broken',
            log: 'alt_cells',
          }),
      },
    ],
    ...[false, true].flatMap((enforce) => [
      [
        `a reply with a missing cause (C1 ${enforce})`,
        { plan: reply({ error_code: 'DISCOVERY_UNAVAILABLE' }), enforce },
      ],
      [
        `a reply with an invalid cause (C1 ${enforce})`,
        {
          plan: reply({ error_code: 'DISCOVERY_UNAVAILABLE', error_cause: 'not_a_cause' }),
          enforce,
        },
      ],
      [
        `a reply with a valid cause (C1 ${enforce})`,
        {
          plan: reply({ error_code: 'RESOURCE_LIMIT', error_cause: 'resident_capacity' }),
          enforce,
        },
      ],
    ]),
    [
      'a bridge kill',
      {
        plan: async () => {
          throw Object.assign(new Error('reader bridge killed'), { code: undefined });
        },
      },
    ],
    [
      'a stubbed store.pause that refuses once',
      { plan: reply({ error_code: 'READER_ERROR' }), stub: { pause: ['STORE_RECOUNTING'] } },
    ],
  ];
  for (const [name, given] of paths) {
    const run = await leaseOnce(t, given);
    const after = run.store.inspect(run.a);
    assert.ok(after.state !== 'running' || after.lease_expires_at === null, name);
    assert.equal(run.store.lease()?.id, run.b, `${name}: the queue does not stall`);
  }
});

test('C1 is behind one constant, off, and the service never passes the option', async () => {
  assert.equal(READER_REPLY_CAUSES_ENFORCED, false);
  const server = await readFile(path.join(here, 'server_http.js'), 'utf8');
  assert.ok(server.includes('new ReaderScheduler({'), 'the service builds the scheduler');
  assert.equal(/enforceReplyCauses/.test(server), false, 'server_http.js never passes it');
  const scheduler = new ReaderScheduler({
    store: { lease: () => null },
    bridge: { runReaderLease: async () => ({}) },
  });
  assert.equal(scheduler.enforceReplyCauses, false);
});

// The real bridge's final reader frame (python_bridge.js): error_cause and
// error_log travel beside error_code and reader_result, and `reply: true`
// marks it. A bridge failure (here, a provider call the bridge refuses)
// never sets `reply`.
test('python_bridge forwards a reply cause and log and marks a reply; a kill is no reply', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'reader-reply-bridge-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const workerPath = path.join(directory, 'reply_worker.mjs');
  await writeFile(
    workerPath,
    `import readline from 'node:readline';
const send = (o) => process.stdout.write(JSON.stringify(o) + '\\n');
readline.createInterface({ input: process.stdin }).on('line', (line) => {
  const frame = JSON.parse(line);
  if (frame.event === 'reader_ack') return;
  const scenario = frame.reader.source.scenario;
  if (scenario === 'kill')
    return send({ id: frame.id, event: 'reader_checkpoint', data: { provider_calls: 1 } });
  send({
    id: frame.id,
    code: 1,
    error_code: 'DISCOVERY_UNAVAILABLE',
    error_cause: 'segment_missing',
    error_log: 'alt_cells',
    stderr: 'worker text',
  });
});
`
  );
  const bridge = createPythonBridge({
    python: process.execPath,
    harnessDir: directory,
    workerPath,
    harnessEnv: () => ({ PATH: process.env.PATH ?? '' }),
    timeoutMs: 30_000,
    maxOutputBytes: 1024 * 1024,
  });
  t.after(() => bridge.internals.kill());
  const lease = (scenario) =>
    bridge.runReaderLease(
      { source: { scenario }, lease_ms: 1000 },
      { onReaderCheckpoint: async () => ({}), timeoutMs: 30_000 }
    );
  const reply = await lease('reply');
  assert.equal(reply.reply, true);
  assert.deepEqual(
    [reply.code, reply.error_code, reply.error_cause, reply.error_log],
    [1, 'DISCOVERY_UNAVAILABLE', 'segment_missing', 'alt_cells']
  );
  const killed = await lease('kill');
  assert.equal(killed.code, -1);
  assert.equal(killed.error_code, 'READER_PROTOCOL');
  assert.equal(Object.hasOwn(killed, 'reply'), false, 'failure() never sets reply');
});
