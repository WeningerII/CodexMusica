import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import express from 'express';
import { libraryPublicRouter } from './library_routes.js';
import { analysisTail } from './library_exports.js';
import {
  ReaderJobStore,
  READER_LIMITS,
  decodeStoredObject,
  withReaderWriterLock,
  readerStoreFormat,
} from './reader_job_store.js';
import { inflateReaderStore } from './reader_store_inflate.mjs';
const identity = { snapshot: 's', revision: 'r', engine: 'e' };
const sha = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const page = (id = 'one') => ({
  instances: [{ id, schema_id: 'sound', text: 'repeated evidence '.repeat(4000) }],
});
const marker = (store) => path.join(store.directory, 'store-format.json');
function fixture(t, options = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'reader-gzip-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const store = new ReaderJobStore({ directory, ...options });
  const job = store.create({ viewer: 'v', idempotency_key: 'k', identity, request: {} });
  const lease = store.lease(job.record.id);
  return { directory, store, job, lease };
}
function checkpoint(f, pages = [page()]) {
  return f.store.commitCheckpoint(f.lease.id, f.lease.attempt, f.lease.fence, {
    cursor: { phase: 'schemas', index: 1 },
    pages,
  });
}
function physical(store) {
  let n = fs.statSync(path.join(store.directory, 'capability-key')).size;
  if (fs.existsSync(marker(store))) n += fs.statSync(marker(store)).size;
  for (const kind of ['records', 'pages', 'indexes', 'checkpoints', 'manifests', 'definitions'])
    for (const file of fs.readdirSync(path.join(store.directory, kind)))
      n += fs.statSync(path.join(store.directory, kind, file)).size;
  return n;
}
function recount(store) {
  store._locked(() => {
    store.usage = store._usage();
  });
}

test('default stays plain; Phase B hashes logical bytes and charges physical bytes plus marker', (t) => {
  for (const gzip of [false, true]) {
    const f = fixture(t, { gzip });
    const r = checkpoint(f);
    const raw = fs.readFileSync(r.added_page_paths[0]);
    const plain = Buffer.from(JSON.stringify(page()));
    assert.equal(raw[0] === 0x1f, gzip);
    assert.equal(path.basename(r.added_page_paths[0]), `${sha(plain)}.json`);
    assert.deepEqual(decodeStoredObject(raw), plain);
    assert.equal(r.page_refs[0].bytes, plain.length);
    assert.equal(f.store.usage, physical(f.store));
    assert.equal(f.store.maxBytes, 256 * 1024 * 1024);
    assert.equal(fs.existsSync(marker(f.store)), gzip);
    if (gzip) assert.deepEqual(JSON.parse(fs.readFileSync(marker(f.store))), { min_reader: 'A' });
    for (const kind of ['indexes', 'checkpoints', 'manifests'])
      for (const file of fs.readdirSync(path.join(f.store.directory, kind)))
        assert.notEqual(fs.readFileSync(path.join(f.store.directory, kind, file))[0], 0x1f);
  }
});

test('mixed formats, restart, flag changes, dedup and actual Python reader preserve committed evidence', (t) => {
  const f = fixture(t);
  checkpoint(f, [page('plain')]);
  f.store.gzip = true;
  const saved = checkpoint(f, [page('compressed')]);
  const before = f.store.workerPayload(f.lease.id).page_paths.map((p) => fs.readFileSync(p));
  const restarted = new ReaderJobStore({ directory: f.directory }); // Phase A / B off
  restarted.resume(f.job.record.id, f.job.capability, 'v', identity);
  f.lease = restarted.lease(f.job.record.id);
  f.store = restarted;
  checkpoint(f, [page('compressed')]);
  const payload = restarted.workerPayload(f.lease.id);
  assert.equal(fs.readdirSync(path.join(restarted.directory, 'pages')).length, 2);
  assert.deepEqual(
    payload.page_paths.slice(0, 2).map((p) => fs.readFileSync(p)),
    before
  );
  assert.deepEqual(
    restarted.readPage(f.lease.id, saved.page_refs[1].sha256, f.job.capability, 'v'),
    page('compressed')
  );
  const worker = fileURLToPath(new URL('./worker.py', import.meta.url));
  const result = spawnSync(
    'python3',
    [
      '-c',
      `import importlib.util,json,sys
spec=importlib.util.spec_from_file_location('worker',sys.argv[1]); w=importlib.util.module_from_spec(spec); spec.loader.exec_module(w)
print(json.dumps([w.read_page_object(p) for p in json.loads(sys.argv[2])]))`,
      worker,
      JSON.stringify(payload.committed_page_paths),
    ],
    { encoding: 'utf8', maxBuffer: 2 * 1024 * 1024 }
  );
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), [page('plain'), page('compressed')]);
  assert.equal(restarted.usage, physical(restarted));
  assert.ok(fs.existsSync(marker(restarted)), 'turning gzip off does not remove the floor');
});

test('compressed quota boundary counts marker and preserves unknown-usage admission and other writers', (t) => {
  const f = fixture(t, { gzip: true });
  const body = Buffer.from(JSON.stringify(page()));
  const cost = zlib.gzipSync(body).length + Buffer.byteLength('{"min_reader":"A"}');
  const current = f.store.usage + f.store.records.size * 16 * 1024;
  f.store.maxBytes = current + cost - 1;
  assert.throws(() => f.store._open(() => f.store._blob('pages', page())), {
    code: 'RESOURCE_LIMIT',
  });
  assert.equal(fs.existsSync(marker(f.store)), false);
  f.store.maxBytes++;
  f.store._open(() => f.store._blob('pages', page()));
  assert.equal(f.store.usage + f.store.records.size * 16 * 1024, f.store.maxBytes);
  assert.equal(f.store.usage, physical(f.store));
  f.store.usage = null;
  assert.throws(() => f.store._open(() => f.store._blob('pages', page('another'))), {
    code: 'STORE_RECOUNTING',
  });
  recount(f.store);
  // Open a second writer before a new commit; it must observe the generation change.
  f.store.maxBytes = 256 * 1024 * 1024;
  const second = new ReaderJobStore({ directory: f.directory, gzip: true });
  recount(f.store);
  f.store._open(() => f.store._blob('pages', page('cross-writer')));
  assert.throws(() => second._open(() => second._blob('pages', page('second'))), {
    code: 'STORE_RECOUNTING',
  });
  recount(second);
  second._open(() => second._blob('pages', page('second')));
  assert.equal(second.usage, physical(second));
});

test('small/incompressible pages stay plain; oversize logical objects still refuse', (t) => {
  const f = fixture(t, { gzip: true });
  f.store._open(() => f.store._blob('pages', {}));
  assert.equal(fs.existsSync(marker(f.store)), false);
  assert.throws(
    () => f.store._open(() => f.store._blob('pages', { x: 'a'.repeat(READER_LIMITS.objectBytes) })),
    { code: 'RESOURCE_LIMIT' }
  );
});

test('marker precedes page durability; interrupted marker/page/record publication recovers safely', (t) => {
  for (const kind of ['store-format', 'pages', 'record']) {
    const f = fixture(t, { gzip: true });
    f.store.fault = (event, info) => {
      if (info.kind === 'pages') assert.ok(fs.existsSync(marker(f.store)));
      if (event === 'renamed' && info.kind === kind) throw new Error('simulated interruption');
    };
    assert.throws(() => checkpoint(f), { code: 'STORAGE_UNAVAILABLE' });
    const fresh = new ReaderJobStore({ directory: f.directory });
    assert.ok(fs.existsSync(marker(fresh)), 'even an orphan gzip leaves the compatibility floor');
    assert.equal(fresh.usage, physical(fresh));
    const payload = fresh.workerPayload(f.job.record.id);
    for (const file of payload.page_paths)
      assert.doesNotThrow(() => decodeStoredObject(fs.readFileSync(file)));
  }
});

test('offline inflate requires exclusive lock and sufficient free space, without modifying objects on refusal', (t) => {
  const f = fixture(t, { gzip: true });
  const r = checkpoint(f);
  const file = r.added_page_paths[0],
    before = fs.readFileSync(file);
  withReaderWriterLock(f.store.directory, () => {
    assert.throws(() => inflateReaderStore(f.store.directory), { code: 'STORE_BUSY' });
  });
  assert.throws(() => inflateReaderStore(f.store.directory, { freeBytes: () => 0n }), {
    code: 'INFLATE_REFUSED',
  });
  assert.deepEqual(fs.readFileSync(file), before);
  assert.ok(fs.existsSync(marker(f.store)));
});

test('offline conversion resumes after staging/replacement/finalization interruptions and retains checksums', (t) => {
  for (const point of ['staged', 'replaced', 'before_marker_removal']) {
    const f = fixture(t, { gzip: true });
    checkpoint(f, [page('a'), page('b')]);
    const files = f.store.workerPayload(f.job.record.id).page_paths;
    assert.throws(
      () =>
        inflateReaderStore(f.store.directory, {
          fault: (event) => {
            if (event === point) throw new Error('interrupted conversion');
          },
        }),
      /interrupted conversion/
    );
    assert.ok(fs.existsSync(marker(f.store)));
    const result = inflateReaderStore(f.store.directory);
    assert.equal(fs.existsSync(marker(f.store)), false);
    const manifest = JSON.parse(fs.readFileSync(result.manifest));
    assert.equal(manifest.complete, true);
    for (const file of files) {
      const bytes = fs.readFileSync(file);
      assert.notEqual(bytes[0], 0x1f);
      assert.equal(sha(bytes), path.basename(file, '.json'));
      assert.ok(manifest.objects.some((o) => o.sha256 === sha(bytes) && o.bytes === bytes.length));
    }
    const reopened = new ReaderJobStore({ directory: f.directory });
    assert.equal(reopened.usage, physical(reopened));
    assert.equal(inflateReaderStore(f.store.directory).converted, 0);
  }
});

test('conversion validates all hashes before replacing anything and refuses unknown formats', (t) => {
  const f = fixture(t, { gzip: true });
  const r = checkpoint(f, [page('a'), page('b')]);
  const before = fs.readFileSync(r.added_page_paths[0]);
  fs.writeFileSync(r.added_page_paths[1], zlib.gzipSync(Buffer.from('{}')));
  assert.throws(() => inflateReaderStore(f.store.directory), /hash mismatch/);
  assert.deepEqual(fs.readFileSync(r.added_page_paths[0]), before);
  fs.writeFileSync(marker(f.store), '{"min_reader":"C"}');
  assert.throws(() => inflateReaderStore(f.store.directory), /Unknown store format/);
});

test('health passively reports absence, A and malformed/unreadable markers even while locked', async (t) => {
  const f = fixture(t);
  const app = express();
  app.use(
    '/library/v1',
    libraryPublicRouter({
      search: null,
      readerStoreRequirement: () => readerStoreFormat(f.store.directory),
    })
  );
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const health = async () =>
    (await fetch(`http://127.0.0.1:${server.address().port}/library/v1/health`)).json();
  assert.equal((await health()).reader_store.min_reader, null);
  for (const [raw, expected] of [
    ['{"min_reader":"A"}', 'A'],
    ['{', 'unknown'],
    ['{}', 'unknown'],
    ['null', 'unknown'],
    ['{"min_reader":"Z"}', 'unknown'],
    [' '.repeat(1025), 'unknown'],
  ]) {
    fs.writeFileSync(marker(f.store), raw);
    const generation = fs.readFileSync(path.join(f.store.directory, 'generation'));
    fs.writeFileSync(
      path.join(f.store.directory, 'writer.lock'),
      JSON.stringify({ pid: process.pid })
    );
    try {
      assert.equal((await health()).reader_store.min_reader, expected);
    } finally {
      fs.unlinkSync(path.join(f.store.directory, 'writer.lock'));
    }
    assert.deepEqual(fs.readFileSync(path.join(f.store.directory, 'generation')), generation);
    assert.equal(fs.readFileSync(marker(f.store), 'utf8'), raw);
  }
  fs.unlinkSync(marker(f.store));
  fs.mkdirSync(marker(f.store));
  assert.equal((await health()).reader_store.min_reader, 'unknown');
});

test('compressed pages retain byte-identical analysis ZIP entries and quiescent recount', async (t) => {
  const f = fixture(t, { gzip: true });
  const saved = checkpoint(f);
  const ref = saved.page_refs[0];
  const plain = Buffer.from(JSON.stringify(page()));
  const layout = () => {
    const entry = { kind: 'page', index: 0, name: 'page.json', size: plain.length, offset: 0 };
    return { analysis: [entry], entries: [entry], centralSize: 0, centralOffset: 0 };
  };
  const expected = Buffer.concat([...analysisTail(layout(), () => plain)]);
  const actual = Buffer.concat([
    ...analysisTail(layout(), () => f.store._rawObject('pages', ref.sha256)),
  ]);
  assert.deepEqual(actual, expected);
  f.store.usage = null;
  assert.equal(await f.store.recount(), true);
  assert.equal(f.store.usage, physical(f.store));
});

test('actual Python run_reader loads gzip committed records on resume (stub analysis, real worker protocol)', (t) => {
  const f = fixture(t, { gzip: true });
  checkpoint(f);
  const reopened = new ReaderJobStore({ directory: f.directory });
  reopened.resume(f.job.record.id, f.job.capability, 'v', identity);
  const payload = reopened.workerPayload(f.job.record.id);
  const worker = fileURLToPath(new URL('./worker.py', import.meta.url));
  const result = spawnSync(
    'python3',
    [
      '-c',
      `import importlib.util,json,sys,types,io
spec=importlib.util.spec_from_file_location('worker',sys.argv[1]); w=importlib.util.module_from_spec(spec); spec.loader.exec_module(w)
payload=json.loads(sys.argv[2]); expected=json.loads(sys.argv[3])
class Session:
 def __init__(self, source, declarations, requested, checkpoint, **kw):
  assert checkpoint=={'phase':'schemas','index':1}
  assert list(kw['load_records']('sound'))==expected['instances']
 def step(self, **kw): return {'provider_calls':0,'done':True}
sys.modules['library.analysis']=types.SimpleNamespace(AnalysisSession=Session)
sys.stdin=io.StringIO(json.dumps({'id':'resume','event':'reader_ack','continue':False})+'\\n')
assert w.run_reader(payload,'resume')=={'status':'complete','reason':'COMPLETE','provider_calls':0}`,
      worker,
      JSON.stringify({
        source: {},
        checkpoint: payload.cursor,
        committed_pages: payload.committed_page_paths,
      }),
      JSON.stringify(page()),
    ],
    { encoding: 'utf8', maxBuffer: 2 * 1024 * 1024 }
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).event, 'reader_checkpoint');
});

test('process death after gzip publication leaves a marker and startup safely collects uncommitted pages', (t) => {
  const f = fixture(t);
  const module = new URL('./reader_job_store.js', import.meta.url).href;
  const child = spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `import { ReaderJobStore } from ${JSON.stringify(module)};
const s = new ReaderJobStore({directory:process.argv[1],gzip:true});
s.fault=(event,info)=>{if(event==='directory_synced'&&info.kind==='pages')process.exit(73)};
s._open(()=>s._blob('pages',{instances:[{id:'orphan',text:'x'.repeat(50000)}]}));`,
      f.directory,
    ],
    { encoding: 'utf8' }
  );
  assert.equal(child.status, 73, child.stderr);
  assert.ok(fs.existsSync(marker(f.store)));
  assert.ok(fs.existsSync(path.join(f.store.directory, 'pending')));
  const reopened = new ReaderJobStore({ directory: f.directory });
  assert.equal(fs.readdirSync(path.join(reopened.directory, 'pages')).length, 0);
  assert.equal(reopened.usage, physical(reopened));
  assert.ok(fs.existsSync(marker(reopened)));
});
