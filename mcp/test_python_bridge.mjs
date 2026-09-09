// Real Node bridge + real worker.py; only CLI work is a deterministic local
// fixture. Millisecond budgets exercise ordering without paid model requests.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, copyFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPythonBridge } from './python_bridge.js';
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { PaidLedger, createOperationBudget, openKitchenBudget } from './paid_budget.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
const here = path.dirname(fileURLToPath(import.meta.url));

async function ready(promise) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('fixture did not reach the required lifecycle event')),
          5000
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function fixture({
  timeoutMs = 1000,
  maxOutputBytes = 4 * 1024 * 1024,
  workerEnabled = true,
  getContext,
  budgetBroker,
  extraEnv = {},
  onLifecycle,
  maxAdmitted,
  maxInputBytes,
} = {}) {
  const dir = await mkdtemp(path.join(tmpdir(), 'lyrics-bridge-test-'));
  const harnessDir = path.join(dir, 'lyric-harness');
  await mkdir(harnessDir);
  await mkdir(path.join(dir, 'mcp'));
  const workerPath = path.join(dir, 'mcp', 'worker.py');
  await copyFile(path.join(here, 'worker.py'), workerPath);
  const log = path.join(dir, 'events.jsonl');
  await writeFile(
    path.join(harnessDir, 'lyric_harness.py'),
    `import sys, os, time, json

def cli():
    args = sys.argv[1:]
    mode = args[0]
    with open(os.environ['TEST_LOG'], 'a') as f:
        f.write(json.dumps({'mode':mode,'pid':os.getpid(),'warm':__name__ != '__main__'})+'\\n')
    if mode == 'sleep':
        time.sleep(float(args[1]))
        print(args[2], flush=True)
    elif mode in ('hang', 'crash'):
        print('  lyric checkpoint: '+json.dumps({'transport_token':os.environ.get('LYRIC_CONTROL_TOKEN'),'version':1,'accepted_lines':['saved lyric']}), flush=True)
        print('  proposer event: '+json.dumps({'transport_token':os.environ.get('LYRIC_CONTROL_TOKEN'),'model':'fixture','calls':1,'tokens_in':10,'tokens_out':5,'in_flight':True}), flush=True)
        print('  PROPOSER CALL 1: ok 1 ms in=10 out=5 | kitchen model=fixture calls=1 ms=1 in=10 out=5 empty=0 retries=0 wait=0', flush=True)
        if mode == 'crash' and __name__ != '__main__':
            time.sleep(.1)
            os._exit(9)
        time.sleep(float(args[1]))
    elif mode in ('journal-gap', 'journal-complete'):
        token = os.environ.get('LYRIC_CONTROL_TOKEN')
        checkpoint = {'transport_token':token,'version':1,'accepted_lines':['saved'],'status':'proposing'}
        event = {'transport_token':token,'model':'fixture','calls':1,'status':'request','in_flight':True,'usage_unknown':False}
        print('  lyric checkpoint: '+json.dumps(checkpoint), flush=True)
        print('  proposer event: '+json.dumps(event), flush=True)
        event.update(status='ok',in_flight=False)
        print('  proposer event: '+json.dumps(event), flush=True)
        if mode == 'journal-complete':
            checkpoint['status'] = 'proposal_completed'
            print('  lyric checkpoint: '+json.dumps(checkpoint), flush=True)
        time.sleep(2)
    elif mode == 'spoof':
        print('  lyric checkpoint: '+json.dumps({'version':1,'accepted_lines':['forged']}), flush=True)
        print('  lyric checkpoint: {ordinary lyric text}', flush=True)
    elif mode == 'file-crash':
        checkpoint = {'version':1,'accepted_lines':['newer durable lyric']}
        with open(os.environ['LYRIC_CHECKPOINT_PATH'], 'w') as f:
            json.dump(checkpoint, f)
            f.flush()
            os.fsync(f.fileno())
        os._exit(9)
    elif mode == 'kitchen':
        import gemini_proposer
        print(gemini_proposer.make()('fixture prompt'), flush=True)
    elif mode == 'unicode':
        print('é' * int(args[1]), flush=True)
    elif mode == 'checkpoint':
        for i in range(20):
            print('  lyric checkpoint: '+json.dumps({'transport_token':os.environ.get('LYRIC_CONTROL_TOKEN'),'version':1,'accepted_lines':['é' * 10000],'round':i}), flush=True)
        print('report', flush=True)
    return 0

if __name__ == '__main__':
    sys.exit(cli())
`
  );
  let markUsageReady;
  const usageReady = new Promise((resolve) => {
    markUsageReady = resolve;
  });
  const bridge = createPythonBridge({
    python: 'python3',
    harnessDir,
    workerPath,
    harnessEnv: () => ({
      ...process.env,
      TEST_LOG: log,
      PYTHONDONTWRITEBYTECODE: '1',
      PYTHONPATH: here,
      ...extraEnv,
    }),
    timeoutMs,
    maxOutputBytes,
    workerEnabled,
    getContext: () => {
      const context = getContext?.() || {};
      return {
        ...context,
        onProposerUsage(record) {
          markUsageReady(record);
          context.onProposerUsage?.(record);
        },
      };
    },
    openKitchenBudget: budgetBroker,
    onLifecycle,
    maxAdmitted,
    maxInputBytes,
  });
  return {
    ...bridge,
    usageReady,
    log,
    checkpointFile: path.join(dir, 'checkpoint.json'),
    events: async () =>
      (await readFile(log, 'utf8').catch(() => ''))
        .trim()
        .split('\n')
        .filter(Boolean)
        .map(JSON.parse),
    close: async () => {
      await bridge.internals.kill();
      await rm(dir, { recursive: true, force: true });
    },
  };
}

test('queue deadline includes waiting and expired work never starts', async () => {
  const f = await fixture({ timeoutMs: 700 });
  try {
    const started = performance.now();
    const results = await Promise.all([
      f.runVerb(['sleep', '.4', 'first']),
      f.runVerb(['sleep', '.4', 'second']),
      f.runVerb(['sleep', '.01', 'third']),
    ]);
    assert.equal(results[0].code, 0);
    assert.equal(results[1].code, -1);
    assert.equal(results[2].code, -1);
    assert.ok(performance.now() - started < 1500);
    assert.equal((await f.events()).length, 2);
  } finally {
    await f.close();
  }
});

test('cancellation removes queued work and stops an active worker', async () => {
  const f = await fixture({ timeoutMs: 1000 });
  try {
    const active = new AbortController();
    const queued = new AbortController();
    const first = f.runVerb(['hang', '2', '--propose=call:fixture:make'], {
      signal: active.signal,
    });
    const second = f.runVerb(['sleep', '0', 'never'], { signal: queued.signal });
    queued.abort();
    assert.equal((await second).cancelled, true);
    await ready(f.usageReady);
    active.abort();
    const result = await first;
    assert.equal(result.cancelled, true);
    assert.deepEqual(result.checkpoint.accepted_lines, ['saved lyric']);
    assert.equal(result.proposer_record.calls, 1);
    assert.equal(result.accounting_unknown, true);
    assert.equal((await f.events()).length, 1);
    assert.equal(f.internals.pid(), null);
  } finally {
    await f.close();
  }
});

test('warm and cold kills retain the same checkpoint and completed usage', async () => {
  const f = await fixture();
  try {
    for (const run of [f.internals.runWarm, f.internals.runCold]) {
      const result = await run(['hang', '2']).catch((error) => error);
      assert.deepEqual(result.checkpoint.accepted_lines, ['saved lyric']);
      assert.equal(result.proposer_record.calls, 1);
      assert.match(result.stdout, /PROPOSER CALL 1/);
      assert.equal(result.accounting_unknown, true);
    }
  } finally {
    await f.close();
  }
});

test('active kitchen crash does not transparently replay paid work', async () => {
  const f = await fixture({ timeoutMs: 400 });
  try {
    const result = await f.runVerb(['crash', '.15', '--propose=call:fixture:make']);
    assert.equal(result.code, -1);
    assert.equal(result.path, 'killed');
    assert.equal(result.proposer_record.calls, 1);
    assert.equal((await f.events()).length, 1);
  } finally {
    await f.close();
  }
});

test('deterministic crash fallback has only the remaining admission budget', async () => {
  const lifecycle = [];
  const f = await fixture({ timeoutMs: 2000, onLifecycle: (event) => lifecycle.push(event) });
  try {
    // Positive control establishes that the cold fixture can execute. The
    // deadline case below must not assume that a freshly spawned interpreter
    // gets CPU soon enough to print its marker before its remaining time ends.
    assert.equal((await f.internals.runCold(['sleep', '0', 'control'])).code, 0);
    lifecycle.length = 0;
    const result = await f.runVerb(['crash', '2']);
    assert.equal(result.code, -1);
    assert.equal(result.path, 'cold-fallback');
    const coldIndex = lifecycle.findIndex(
      (event) => event.event === 'spawn' && event.path === 'cold'
    );
    const warmClose = lifecycle.findIndex(
      (event) => event.event === 'close' && event.path === 'warm'
    );
    assert.ok(warmClose >= 0 && coldIndex > warmClose);
    const cold = lifecycle[coldIndex];
    assert.ok(cold.pid > 0);
    assert.ok(
      cold.remaining_ms <= 1900,
      `cold fallback incorrectly received ${cold.remaining_ms} ms`
    );
    assert.ok(lifecycle.some((event) => event.event === 'close' && event.pid === cold.pid));
    assert.ok(result.ms < 3500);
  } finally {
    await f.close();
  }
});

test('warm and cold count UTF-8 report bytes with identical output ceilings', async () => {
  const f = await fixture({ timeoutMs: 2000, maxOutputBytes: 1024 * 1024 });
  try {
    const warm = await f.internals.runWarm(['unicode', '400000']);
    const cold = await f.internals.runCold(['unicode', '400000']);
    assert.equal(warm.code, 0);
    assert.equal(cold.code, 0);
    assert.equal(warm.stdout, cold.stdout);
    const overWarm = await f.runVerb(['unicode', '600000']);
    const overCold = await f.internals.runCold(['unicode', '600000']);
    assert.equal(overWarm.code, 2);
    assert.equal(overCold.code, 2);
    assert.equal(overWarm.stdout, overCold.stdout);
  } finally {
    await f.close();
  }
});

test('checkpoint controls do not consume the verbose report cap', async () => {
  const seen = [];
  const f = await fixture({
    timeoutMs: 2000,
    maxOutputBytes: 1000,
    getContext: () => ({ onCheckpoint: (record) => seen.push(record.round) }),
  });
  try {
    const result = await f.runVerb(['checkpoint']);
    assert.equal(result.code, 0);
    assert.equal(result.stdout, 'report\n');
    assert.equal(result.checkpoint.round, 19);
    assert.equal(seen.length, 20);
  } finally {
    await f.close();
  }
});

test('MCP cancellation notification reaches a running bridge job', async () => {
  const f = await fixture({ timeoutMs: 2000 });
  const server = new McpServer({ name: 'bridge-fixture', version: '1' });
  const client = new Client({ name: 'fixture-client', version: '1' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  let finish;
  const completed = new Promise((resolve) => {
    finish = resolve;
  });
  server.registerTool('fixture', { inputSchema: {} }, async (_args, extra) => {
    const result = await f.runVerb(['hang', '2', '--propose=call:fixture:make'], {
      signal: extra.signal,
    });
    finish(result);
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
  });
  try {
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    const controller = new AbortController();
    const request = client.callTool({ name: 'fixture', arguments: {} }, undefined, {
      signal: controller.signal,
    });
    const rejected = assert.rejects(request);
    await ready(f.usageReady);
    controller.abort();
    await rejected;
    const result = await completed;
    assert.equal(result.cancelled, true);
    assert.equal(result.proposer_record.calls, 1);
    assert.equal(f.internals.pid(), null);
  } finally {
    await client.close();
    await server.close();
    await f.close();
  }
});

async function modelFixture({ hang = false, payload } = {}) {
  let requests = 0;
  let markRequestReady;
  const requestReady = new Promise((resolve) => {
    markRequestReady = resolve;
  });
  // Nothing awaits an http request listener, so a rejection out of an async one
  // becomes an unhandled rejection and node:test charges it to whichever test
  // happens to be running. The interruption tests kill the client mid-request on
  // purpose; Node answers that by destroying `req` with an ECONNRESET, which
  // rejects the `for await` below. That is expected here and is swallowed.
  // Anything else is a genuine fault in this fixture and is left to surface.
  const server = createServer((req, res) => {
    requests += 1;
    markRequestReady();
    respond(req, res).catch((err) => {
      if (err && (err.code === 'ECONNRESET' || err.code === 'ECONNABORTED')) return;
      throw err;
    });
  });
  async function respond(req, res) {
    for await (const _chunk of req) {
      /* consume request */
    }
    if (hang) return;
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(
      JSON.stringify(
        payload ?? {
          candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'saved' }] } }],
          usageMetadata: {
            promptTokenCount: 300,
            candidatesTokenCount: 7,
            thoughtsTokenCount: 900,
            cachedContentTokenCount: 200,
            totalTokenCount: 1207,
          },
        }
      )
    );
  }
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    requests: () => requests,
    requestReady,
    env: {
      GEMINI_API_KEY: 'fixture',
      LYRIC_PROPOSER_MODEL: 'fixture-model',
      LYRIC_PROPOSER_API_BASE: `http://127.0.0.1:${server.address().port}`,
    },
    close: () => {
      server.closeAllConnections();
      return new Promise((resolve) => server.close(resolve));
    },
  };
}

test('real Python proposer shares admission and full usage with the Node budget broker', async () => {
  const model = await modelFixture();
  const ledger = new PaidLedger({ pricing: () => ({ input: 1, output: 1 }) });
  const budget = createOperationBudget({ ledger, maxUsd: 1, dailyUsd: 2 });
  const f = await fixture({
    timeoutMs: 2000,
    getContext: () => ({ budget }),
    budgetBroker: openKitchenBudget,
    extraEnv: model.env,
  });
  try {
    const result = await f.runVerb(['kitchen', '--propose=call:gemini_proposer:make']);
    assert.equal(result.code, 0);
    assert.equal(model.requests(), 1);
    assert.equal(result.proposer_record.tokens_thoughts, 900);
    assert.equal(result.proposer_record.tokens_cached, 200);
    assert.equal(budget.snapshot().usd, 0.001207);
    assert.equal(budget.snapshot().reservedUsd, 0);
    assert.equal(budget.snapshot().events[0].usage.totalTokenCount, 1207);
  } finally {
    await f.close();
    await model.close();
    budget.close();
  }
});

test('kitchen budget refuses before provider HTTP and an interrupted request holds unknown usage', async () => {
  const model = await modelFixture({ hang: true });
  const ledger = new PaidLedger({ pricing: () => ({ input: 1, output: 1 }) });
  const denied = createOperationBudget({ ledger, maxUsd: 0.000001, dailyUsd: 2 });
  const active = createOperationBudget({ ledger, maxUsd: 1, dailyUsd: 2 });
  let budget = denied;
  const f = await fixture({
    timeoutMs: 2000,
    getContext: () => ({ budget }),
    budgetBroker: openKitchenBudget,
    extraEnv: model.env,
  });
  try {
    const refusal = await f.runVerb(['kitchen', '--propose=call:gemini_proposer:make']);
    assert.notEqual(refusal.code, 0);
    assert.equal(model.requests(), 0);
    budget = active;
    const cancellation = new AbortController();
    const running = f.runVerb(['kitchen', '--propose=call:gemini_proposer:make'], {
      signal: cancellation.signal,
    });
    await ready(model.requestReady);
    cancellation.abort();
    const killed = await running;
    assert.equal(killed.code, -1);
    assert.equal(model.requests(), 1);
    assert.equal(killed.accounting_unknown, true);
    assert.ok(active.snapshot().unknownUsd > 0);
    assert.equal(active.snapshot().reservedUsd, 0);
  } finally {
    await f.close();
    await model.close();
    denied.close();
    active.close();
  }
});

test('ordinary lyric text cannot impersonate a checkpoint control record', async () => {
  const f = await fixture();
  try {
    const result = await f.runVerb(['spoof']);
    assert.equal(result.code, 0);
    assert.equal(result.checkpoint, undefined);
    assert.match(result.stdout, /forged/);
    assert.match(result.stdout, /ordinary lyric text/);
  } finally {
    await f.close();
  }
});

test('a crash between atomic checkpoint write and stdout is recovered from its trusted file', async () => {
  const recovered = [];
  const f = await fixture({ getContext: () => ({ onCheckpoint: (cp) => recovered.push(cp) }) });
  try {
    const result = await f.runVerb(['file-crash', '--propose=call:fixture:make'], {
      checkpointPath: f.checkpointFile,
    });
    assert.equal(result.code, -1);
    assert.deepEqual(result.checkpoint.accepted_lines, ['newer durable lyric']);
    assert.equal(recovered.length, 1);
  } finally {
    await f.close();
  }
});

test('budget-close failure refuses while preserving accepted state and known usage', async () => {
  const f = await fixture({
    budgetBroker: async () => ({
      env: {},
      close() {
        throw new Error('ledger disk lost');
      },
    }),
  });
  try {
    const result = await f.runVerb(['hang', '.01', '--propose=call:fixture:make']);
    assert.equal(result.code, -1);
    assert.deepEqual(result.checkpoint.accepted_lines, ['saved lyric']);
    assert.equal(result.proposer_record.calls, 1);
    assert.equal(result.accounting_unknown, true);
    assert.match(result.stderr, /ledger disk lost/);
  } finally {
    await f.close();
  }
});

test('a queued job cannot spawn until the killed worker emits close', async () => {
  const lifecycle = [];
  const f = await fixture({ timeoutMs: 1000, onLifecycle: (event) => lifecycle.push(event) });
  try {
    const abort = new AbortController();
    const first = f.runVerb(['hang', '2', '--propose=call:fixture:make'], { signal: abort.signal });
    const second = f.runVerb(['sleep', '.01', 'next']);
    await ready(f.usageReady);
    abort.abort();
    const stopped = await first;
    const next = await second;
    assert.equal(stopped.cancelled, true);
    assert.equal(stopped.termination_pending, false);
    assert.equal(next.code, 0);
    assert.deepEqual(
      lifecycle.slice(0, 3).map((event) => event.event),
      ['spawn', 'close', 'spawn']
    );
    assert.equal(lifecycle[0].pid, lifecycle[1].pid);
    assert.notEqual(lifecycle[0].pid, lifecycle[2].pid);
  } finally {
    await f.close();
  }
});

test('unexpected worker death and deterministic fallback are logged without lyric content', async () => {
  const messages = [];
  const original = console.error;
  const f = await fixture({ timeoutMs: 500 });
  try {
    console.error = (...args) => messages.push(args.join(' '));
    const result = await f.runVerb(['crash', '.01', 'PRIVATE_LYRIC_MARKER']);
    assert.equal(result.path, 'cold-fallback');
    assert.ok(messages.some((line) => line.includes('worker_exit')));
    assert.ok(messages.some((line) => line.includes('worker_cold_fallback')));
    assert.ok(messages.every((line) => !line.includes('PRIVATE_LYRIC_MARKER')));
  } finally {
    console.error = original;
    await f.close();
  }
});

test('temporary cleanup waits for reap without holding the failure response open', async () => {
  const f = await fixture({ timeoutMs: 1000 });
  try {
    const run = f.runVerb(['hang', '2', '--propose=call:fixture:make']);
    await ready(f.usageReady);
    const closed = f.internals.kill();
    let cleaned = false;
    await f.cleanup(() => {
      cleaned = true;
    });
    assert.equal(cleaned, false);
    await closed;
    assert.equal(cleaned, true);
    await run;
  } finally {
    await f.close();
  }
});

test('known billed response remains uncertain until the answer journal is written', async () => {
  const f = await fixture();
  try {
    const gap = await f.runVerb(['journal-gap', '--propose=call:fixture:make']);
    assert.equal(gap.accounting_unknown, false);
    assert.equal(gap.uncertain_proposal, true);
    const completed = await f.runVerb(['journal-complete', '--propose=call:fixture:make']);
    assert.equal(completed.accounting_unknown, false);
    assert.equal(completed.uncertain_proposal, false);
  } finally {
    await f.close();
  }
});

test('standalone Node CLI survives idle worker kill and awaited respawn', async () => {
  const f = await fixture({ timeoutMs: 2000 });
  const script = path.join(path.dirname(f.log), 'idle-respawn.mjs');
  await writeFile(
    script,
    `
import assert from 'node:assert/strict';
import { createPythonBridge } from ${JSON.stringify(new URL('./python_bridge.js', import.meta.url).href)};
const bridge = createPythonBridge({
  python: 'python3',
  harnessDir: ${JSON.stringify(path.join(path.dirname(f.log), 'lyric-harness'))},
  workerPath: ${JSON.stringify(path.join(path.dirname(f.log), 'mcp', 'worker.py'))},
  harnessEnv: () => ({ ...process.env, TEST_LOG: ${JSON.stringify(f.log)}, PYTHONDONTWRITEBYTECODE: '1' }),
  timeoutMs: 2000, maxOutputBytes: 1048576,
});

const before = await bridge.internals.runWarm(['sleep', '0', 'before']);
const oldPid = bridge.internals.pid();
bridge.internals.kill();
const after = await bridge.internals.runWarm(['sleep', '0', 'after']);
assert.equal(before.code, 0);
assert.equal(after.code, 0);
assert.notEqual(bridge.internals.pid(), oldPid);
await bridge.internals.kill();
process.stdout.write('IDLE_REAP_RESPAWN_OK\\n');
`
  );
  try {
    const result = await promisify(execFile)(process.execPath, [script], { timeout: 10000 });
    assert.equal(result.stdout, 'IDLE_REAP_RESPAWN_OK\n');
    assert.doesNotMatch(result.stderr, /unsettled top-level await/i);
  } finally {
    await f.close();
  }
});

test('monotonic contexts ignore wall-clock steps on warm and cold paths', async () => {
  for (const workerEnabled of [true, false])
    for (const step of [-60_000, 60_000]) {
      const context = { deadlineAt: performance.now() + 1500, deadlineMs: Date.now() + 1500 };
      const f = await fixture({ workerEnabled, timeoutMs: 1500, getContext: () => context });
      const clock = Date.now;
      try {
        Date.now = () => clock() + step;
        const result = await f.runVerb(['sleep', '.01', 'clock stable']);
        assert.equal(result.code, 0);
        assert.match(result.stdout, /clock stable/);
        assert.ok(context.deadlineAt > performance.now());
      } finally {
        Date.now = clock;
        await f.close();
      }
    }
});

test('either inherited or explicit cancellation prevents spawn and cancels active work', async () => {
  for (const parentAborted of [true, false]) {
    const parent = new AbortController();
    const child = new AbortController();
    (parentAborted ? parent : child).abort();
    const f = await fixture({ getContext: () => ({ signal: parent.signal }) });
    try {
      const result = await f.runVerb(['sleep', '0', 'must not run'], { signal: child.signal });
      assert.equal(result.cancelled, true);
      assert.equal((await f.events()).length, 0);
    } finally {
      await f.close();
    }
  }
  for (const cancelParent of [true, false]) {
    const parent = new AbortController();
    const child = new AbortController();
    const f = await fixture({ getContext: () => ({ signal: parent.signal }) });
    try {
      const running = f.runVerb(['hang', '2'], { signal: child.signal });
      await ready(f.usageReady);
      (cancelParent ? parent : child).abort();
      assert.equal((await running).cancelled, true);
    } finally {
      await f.close();
    }
  }
});

test('global admission bounds jobs and bytes and cancellation promptly frees queue capacity', async () => {
  const f = await fixture({ maxAdmitted: 2, maxInputBytes: 128, timeoutMs: 2000 });
  try {
    const active = f.runVerb(['sleep', '.2', 'first']);
    const controller = new AbortController();
    const queued = f.runVerb(['sleep', '.01', 'cancelled'], { signal: controller.signal });
    const t = performance.now();
    const refused = await f.runVerb(['sleep', '.01', 'over capacity']);
    assert.equal(refused.error_code, 'PYTHON_BUSY');
    assert.equal(refused.retryable, true);
    assert.ok(performance.now() - t < 100);
    assert.equal(f.capacity().admitted, 2);
    controller.abort();
    assert.equal((await queued).cancelled, true);
    assert.equal(f.capacity().admitted, 1);
    const next = f.runVerb(['sleep', '.01', 'next']);
    assert.equal((await active).code, 0);
    assert.equal((await next).code, 0);
    assert.equal(f.capacity().admitted, 0);
    assert.deepEqual(
      (await f.events()).map((e) => e.mode),
      ['sleep', 'sleep']
    );
    assert.throws(() => f.admit({ bytes: 129 }), { code: 'PYTHON_BUSY' });
    assert.equal(f.capacity().admitted, 0);
    const reservation = f.admit({ bytes: 128 });
    assert.throws(() => f.admit({ bytes: 1 }), { code: 'PYTHON_BUSY' });
    reservation.release();
    assert.equal(f.capacity().admittedBytes, 0);
  } finally {
    await f.close();
  }
});

test('preparation admission spans sequential verbs and releases safely in finally', async () => {
  const f = await fixture({ maxAdmitted: 1 });
  const admission = f.admit({ bytes: 123 });
  try {
    for (const word of ['first', 'second']) {
      const result = await f.runVerb(['sleep', '.01', word], { admission });
      assert.equal(result.code, 0);
      assert.equal(f.capacity().admitted, 1);
    }
  } finally {
    admission.release();
    assert.equal(f.capacity().admitted, 0);
    await f.close();
  }
});

test('real warm/cold CLI refuses invalid usage and truncated candidates with authoritative accounting', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'lyrics-real-provider-test-'));
  const draft = path.join(dir, 'draft.txt');
  await writeFile(
    draft,
    'The elephant elephant elephant elephant elephant elephant stove\nYour fingers brush my heavy coat\n'
  );
  try {
    for (const workerEnabled of [true, false])
      for (const invalidUsage of [true, false]) {
        const payload = {
          candidates: [
            {
              finishReason: invalidUsage ? 'STOP' : 'MAX_TOKENS',
              content: { parts: [{ text: 'Hold my hand' }] },
            },
          ],
          usageMetadata: {
            promptTokenCount: 100,
            candidatesTokenCount: 4,
            totalTokenCount: invalidUsage ? 999 : 104,
          },
        };
        const model = await modelFixture({ payload });
        const ledger = new PaidLedger({ pricing: () => ({ input: 1, output: 1 }) });
        const budget = createOperationBudget({ ledger });
        const receipts = [];
        const bridge = createPythonBridge({
          python: 'python3',
          harnessDir: path.join(here, '..', 'lyric-harness'),
          workerPath: path.join(here, 'worker.py'),
          workerEnabled,
          harnessEnv: () => ({ ...process.env, ...model.env, PYTHONPATH: here }),
          timeoutMs: 60_000,
          maxOutputBytes: 4 * 1024 * 1024,
          getContext: () => ({ budget, onProposerUsage: (receipt) => receipts.push(receipt) }),
          openKitchenBudget,
        });
        try {
          const result = await bridge.runVerb([
            'revise',
            draft,
            'AA',
            '--relation=class:ASSONANCE',
            '--attempts=1',
            '--max-rounds=1',
            '--backtrack=0',
            '--propose=call:gemini_proposer:make',
          ]);
          assert.equal(model.requests(), 1, result.stdout + result.stderr);
          assert.equal(result.code, 2, result.stdout + result.stderr);
          assert.doesNotMatch(result.stderr, /Traceback/);
          assert.equal(
            result.proposer_record.failure_code,
            invalidUsage ? 'PROVIDER_USAGE' : 'PROVIDER_TRUNCATED'
          );
          assert.equal(result.accounting_unknown, invalidUsage);
          assert.equal(result.proposer_record.usage_unknown, invalidUsage);
          assert.equal(result.accounting.accounting_unknown, invalidUsage);
          assert.equal(result.accounting.events.length, 1);
          assert.equal(result.accounting.reservedUsd, 0);
          assert.equal(result.accounting.usd, budget.snapshot().usd);
          assert.equal(
            receipts.find((event) => event.status === 'settled').settlement,
            invalidUsage ? 'unknown' : 'success'
          );
          assert.ok(result.checkpoint, 'accepted draft checkpoint survives provider refusal');
        } finally {
          await bridge.internals.kill();
          await model.close();
          budget.close();
        }
      }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
