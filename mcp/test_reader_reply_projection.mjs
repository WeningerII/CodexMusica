// Real worker dispatch/error parser and real bridge. AnalysisSession is the
// controlled error/checkpoint producer; this is not discovery-producer acceptance.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPythonBridge } from './python_bridge.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
async function fixture(t, { head = '', raw = null } = {}) {
  const dir = await mkdtemp(path.join(tmpdir(), 'reader-projection-'));
  const launcher = path.join(dir, 'reader_producer.py');
  await writeFile(
    launcher,
    raw === null
      ? `import os,runpy
worker=runpy.run_path(os.environ['REAL_WORKER'])
from library import analysis
class Session:
 def __init__(self,*args,**kwargs):
  if os.environ['READER_HEAD']:raise ValueError(os.environ['READER_HEAD'])
  self.refresh=args[0].get('refresh',False)
  self.discovery=kwargs.get('discovery')
  self.original=self.discovery
  self.n=0
 def step(self,**kwargs):
  self.n+=1
  if self.refresh:
   if self.n==1:return {'done':False,'provider_calls':0,'records':[]}
   assert self.discovery is self.original
   return {'done':True,'provider_calls':0,'records':[], 'probe':self.discovery}
  return {'done':True,'provider_calls':0}
analysis.AnalysisSession=Session
worker['main']()
`
      : `import sys,json
for line in sys.stdin:
 r=json.loads(line);answer=json.loads(${JSON.stringify(JSON.stringify(raw))});answer['id']=r['id'];print(json.dumps(answer),flush=True)
`
  );
  const bridge = createPythonBridge({
    python: process.env.PYTHON || 'python3',
    harnessDir: dir,
    workerPath: launcher,
    harnessEnv: () => ({
      ...process.env,
      REAL_WORKER: path.join(root, 'mcp/worker.py'),
      READER_HEAD: head,
      PYTHONDONTWRITEBYTECODE: '1',
    }),
    timeoutMs: 5000,
    maxOutputBytes: 1024 * 1024,
  });
  t.after(async () => {
    await bridge.internals.kill();
    await rm(dir, { recursive: true, force: true });
  });
  return bridge;
}

for (const [head, code, cause, log] of [
  ['DISCOVERY_UNAVAILABLE[chain_broken]: detail', 'DISCOVERY_UNAVAILABLE', 'chain_broken', null],
  [
    'STORAGE_CORRUPT[segment_corrupt,reader_log]: detail',
    'STORAGE_CORRUPT',
    'segment_corrupt',
    'reader_log',
  ],
  ['INVARIANT_FAILURE', 'INVARIANT_FAILURE', null, null],
  ['STORAGE_CORRUPT[future_cause,future_log]', 'STORAGE_CORRUPT', 'future_cause', 'future_log'],
  ['UNKNOWN[chain_broken,reader_log]', 'READER_ERROR', null, null],
]) {
  test(`actual worker reader reply preserves cause/log: ${head}`, async (t) => {
    const bridge = await fixture(t, { head });
    const result = await bridge.runReaderLease(
      { source: {} },
      {
        onReaderCheckpoint: () => {
          throw new Error('unexpected checkpoint');
        },
      }
    );
    assert.equal(result.code, 1);
    assert.equal(result.error_code, code);
    assert.equal(result.error_cause, cause);
    assert.equal(result.error_log, log);
    assert.equal(result.reply, true);
    assert.equal(result.path, 'warm-reader');
  });
}

test('actual worker successful final response is marked as a reply', async (t) => {
  const bridge = await fixture(t);
  const result = await bridge.runReaderLease({ source: {} }, { onReaderCheckpoint: () => ({}) });
  assert.equal(result.code, 0);
  assert.equal(result.reply, true);
  assert.equal(result.reader_result.status, 'complete');
  assert.equal(result.error_cause, undefined);
  assert.equal(result.error_log, undefined);
});

test('same-code sink failure is not mislabeled as a worker reply', async (t) => {
  const bridge = await fixture(t);
  let checkpoints = 0;
  const result = await bridge.runReaderLease(
    { source: {} },
    {
      onReaderCheckpoint: () => {
        checkpoints++;
        throw Object.assign(new Error('sink failure'), {
          code: 'STORAGE_CORRUPT',
          error_cause: 'sink_cause',
          error_log: 'sink_log',
          reply: true,
        });
      },
    }
  );
  assert.equal(checkpoints, 1);
  assert.equal(result.code, -1);
  assert.equal(result.error_code, 'STORAGE_CORRUPT');
  assert.equal(result.path, 'killed');
  assert.equal(result.reply, undefined);
  assert.equal(result.reader_result, undefined);
  assert.equal(result.error_cause, undefined);
  assert.equal(result.error_log, undefined);
});

test('protocol-only control: projection does not coerce or semantically filter values', async (t) => {
  const cause = { future: ['opaque', 7] },
    log = false;
  const bridge = await fixture(t, {
    raw: {
      code: 1,
      stdout: '',
      stderr: '',
      error_code: 'STORAGE_CORRUPT',
      error_cause: cause,
      error_log: log,
      reader_result: { status: 'paused' },
    },
  });
  const result = await bridge.runReaderLease({ source: {} }, { onReaderCheckpoint: () => ({}) });
  assert.deepEqual(result.error_cause, cause);
  assert.equal(result.error_log, log);
  assert.equal(result.reply, true);
});

test('actual bridge ACK refreshes the retained discovery object after an empty frame', async (t) => {
  const bridge = await fixture(t);
  const refreshed = {
    version: 1,
    summary: { epoch: 2, logs: {} },
    paths: { seen: ['/second', '/first'] },
  };
  let checkpoints = 0;
  const result = await bridge.runReaderLease(
    {
      source: { refresh: true },
      discovery: { version: 1, summary: { epoch: 1, logs: {} }, paths: {}, obsolete: true },
      discovery_job_id: 'persisted-job',
    },
    {
      onReaderCheckpoint: (step) => {
        checkpoints++;
        assert.deepEqual(step.records, []);
        if (checkpoints === 2) assert.deepEqual(step.probe, refreshed);
        return { discovery: refreshed };
      },
    }
  );
  assert.equal(checkpoints, 2);
  assert.equal(result.code, 0);
});
