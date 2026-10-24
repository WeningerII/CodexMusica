const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { stripTypeScriptTypes } = require('node:module');
const { runInNewContext } = require('node:vm');
const test = require('node:test');

// Execute the component's actual handlers; transport and React setters are
// controlled boundaries so request completion order is deterministic.
const source = readFileSync(join(__dirname, '../components/library/reader.tsx'), 'utf8');
function handler(name, next) {
  const start = source.indexOf(`  async function ${name}(`);
  assert.notEqual(start, -1, `Reader owns ${name}`);
  const end = source.indexOf(`  async function ${next}(`, start);
  assert.notEqual(end, -1);
  return source.slice(start, end);
}
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function fixture() {
  const calls = [],
    writes = [];
  const state = {
    job: { id: 'A', state: 'complete' },
    report: { manifest_hash: 'old' },
    records: ['old'],
    previous: [{ id: 'A' }, { id: 'B' }],
    busy: false,
    error: '',
  };
  const context = {
    job: state.job,
    jobId: state.job.id,
    live: true,
    polling: false,
    previous: state.previous,
    declarations: {},
    storageKey: 'interpretation',
    reading: { reading_revision: 'revision' },
    snapshot: 'snapshot',
    id: 'reading',
    jobRequest: { current: 0 },
    jobMutation: { current: false },
    currentJob: { current: state.job },
    currentReport: { current: state.report },
    evidenceEpoch: { current: 0 },
    evidenceLoaded: { current: new Set(['old']) },
    randomHex: () => 'random',
    failMessage: (e) => e.message,
    api: (path, options) => {
      const d = deferred();
      calls.push({ path, options, ...d });
      return d.promise;
    },
    writeDevice: (key, value) => {
      const d = deferred();
      writes.push({ key, value, ...d });
      return d.promise;
    },
  };
  for (const key of ['job', 'report', 'records', 'previous', 'busy', 'error', 'unsaved']) {
    context[`set${key[0].toUpperCase()}${key.slice(1)}`] = (v) => {
      state[key] = v;
    };
  }
  const code =
    handler('openAnalysis', 'analyze') +
    handler('analyze', 'control') +
    handler('control', 'changeSourcePage');
  runInNewContext(stripTypeScriptTypes(code), context);
  const tickStart = source.indexOf('    const tick = async () => {');
  const tickEnd = source.indexOf('    const initial = currentJob.current;', tickStart);
  const tick = source.slice(tickStart, tickEnd).replace('const tick =', 'globalThis.tick =');
  runInNewContext(stripTypeScriptTypes(tick), context);
  return { state, context, calls, writes };
}
const flush = () => new Promise(setImmediate);

test('later Open owns results and failures regardless of response order', async () => {
  for (const staleFails of [false, true]) {
    const f = fixture();
    const a = f.context.openAnalysis('A'),
      b = f.context.openAnalysis('B');
    f.calls[1].resolve({ job: { id: 'B' } });
    await b;
    if (staleFails) f.calls[0].reject(Error('old request failed'));
    else f.calls[0].resolve({ job: { id: 'A' } });
    await a;
    assert.equal(f.state.job.id, 'B');
    assert.equal(f.context.currentJob.current.id, 'B');
    assert.equal(f.state.error, '');
  }
});

test('Delete invalidates pending Open and blocks new job actions until storage settles', async () => {
  const f = fixture();
  const opened = f.context.openAnalysis('A');
  const deleted = f.context.control('delete');
  await f.context.openAnalysis('B');
  await f.context.control('delete');
  await f.context.analyze();
  assert.equal(f.calls.length, 2);
  assert.equal(f.state.busy, true);
  f.calls[1].resolve({});
  await flush();
  assert.equal(f.state.job, null);
  assert.equal(f.state.previous.length, 1);
  assert.equal(f.state.previous[0].id, 'B');
  assert.equal(f.state.busy, true);
  f.calls[0].resolve({ job: { id: 'A' } });
  await opened;
  assert.equal(f.state.job, null);
  f.writes[0].resolve();
  await deleted;
  assert.equal(f.state.busy, false);
  assert.equal(f.context.jobMutation.current, false);
  const next = f.context.openAnalysis('B');
  f.calls[2].resolve({ job: { id: 'B' } });
  await next;
  assert.equal(f.state.job.id, 'B');
});

test('failed mutation unlocks and preserves the existing analysis', async () => {
  const f = fixture();
  const deleted = f.context.control('delete');
  f.calls[0].reject(Error('delete failed'));
  await deleted;
  assert.equal(f.state.job.id, 'A');
  assert.equal(f.state.error, 'delete failed');
  assert.equal(f.state.busy, false);
  assert.equal(f.context.jobMutation.current, false);
  const opened = f.context.openAnalysis('B');
  f.calls[1].resolve({ job: { id: 'B' } });
  await opened;
  assert.equal(f.state.job.id, 'B');
});

test('analyze supersedes an Open and holds ownership through persistence', async () => {
  const f = fixture();
  const opened = f.context.openAnalysis('B'),
    analyzed = f.context.analyze();
  f.calls[1].resolve({ job: { id: 'C' } });
  await flush();
  f.calls[0].resolve({ job: { id: 'B' } });
  await opened;
  assert.equal(f.state.job.id, 'C');
  await f.context.openAnalysis('A');
  assert.equal(f.calls.length, 2);
  f.writes[0].reject(Error('storage full'));
  await analyzed;
  assert.equal(f.state.unsaved, true);
  assert.equal(f.state.busy, false);
  assert.equal(f.context.jobMutation.current, false);
});

test('source replacement invalidates old mutation results and lock release', async () => {
  const f = fixture();
  const cancelled = f.context.control('cancel');
  // The reading effect cleanup invalidates requests before the next reading.
  f.context.jobRequest.current++;
  f.context.jobMutation.current = false;
  const next = f.context.control('resume');
  f.calls[0].resolve({ job: { id: 'A', state: 'cancelled' } });
  await cancelled;
  assert.equal(f.state.job.state, 'complete');
  assert.equal(f.state.busy, true);
  assert.equal(f.context.jobMutation.current, true);
  f.calls[1].resolve({ job: { id: 'A', state: 'running' } });
  await next;
  assert.equal(f.state.job.state, 'running');
  assert.equal(f.state.busy, false);
});

test('poll started before cancel cannot replace the completed control response', async () => {
  const f = fixture();
  const polled = f.context.tick(),
    cancelled = f.context.control('cancel');
  f.calls[1].resolve({ job: { id: 'A', state: 'cancelled' } });
  await cancelled;
  f.calls[0].resolve({ job: { id: 'A', state: 'running' } });
  await polled;
  assert.equal(f.state.job.state, 'cancelled');
});

test('interval ticks stay single-flight and can retry after a failed poll', async () => {
  const f = fixture();
  const first = f.context.tick();
  await f.context.tick();
  assert.equal(f.calls.length, 1);
  f.calls[0].reject(Error('poll failed'));
  await first;
  const next = f.context.tick();
  assert.equal(f.calls.length, 2);
  f.calls[1].resolve({ job: { id: 'A', state: 'complete' } });
  await next;
  assert.equal(f.context.polling, false);
  assert.equal(f.state.job.state, 'complete');
});
