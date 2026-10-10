// The image gate's readiness polling against local servers that fail the way
// a cold or broken service can: hung headers, a body that stalls after its
// headers, a server that never turns healthy, and one that turns healthy late.
// Run: node --test scripts/test_lyrics_image_readiness.mjs
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import http from 'node:http';
import test from 'node:test';
import { ATTEMPT_MS, READY_MS, getJson, waitForHealth } from './lyrics_image_readiness.mjs';

const serve = async (handler) => {
  const server = http.createServer(handler);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}/health`;
  const close = async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  };
  return { url, close };
};
const hangHeaders = () => {};
const stallBody = (_req, res) => {
  res.writeHead(200, { 'content-type': 'application/json', 'content-length': '100' });
  res.flushHeaders();
  res.write('{"ok":');
};
const unhealthy = (_req, res) => {
  res.writeHead(503, { 'content-type': 'application/json' });
  res.end('{"ok":false}');
};
const timers = () => process.getActiveResourcesInfo().filter((r) => r === 'Timeout').length;

const withinWindow = async (handler, windowMs, attemptMs) => {
  const { url, close } = await serve(handler);
  try {
    const before = timers();
    const started = Date.now();
    const health = await waitForHealth(url, windowMs, attemptMs);
    const took = Date.now() - started;
    assert.equal(health, null);
    assert.ok(took >= windowMs - 5, `returned early: ${took} ms`);
    assert.ok(took < windowMs + 150, `overran its ${windowMs} ms window: ${took} ms`);
    assert.equal(timers(), before, 'a timer outlived the poll');
  } finally {
    await close();
  }
};

test('the gate allows 60 s for readiness, 5 s per attempt', () => {
  assert.equal(READY_MS, 60_000);
  assert.equal(ATTEMPT_MS, 5_000);
});

test('hung headers: no health inside the window', () => withinWindow(hangHeaders, 1200, 400));

test('body stalls after its headers: no health inside the window', () =>
  withinWindow(stallBody, 1200, 400));

test('permanently unhealthy: no health inside the window', () =>
  withinWindow(unhealthy, 1200, 400));

test('the last attempt is clamped to the window, not the attempt limit', () =>
  withinWindow(stallBody, 700, 5000));

test('a single attempt settles within its budget and leaves no timer', async () => {
  const { url, close } = await serve(stallBody);
  try {
    const before = timers();
    const started = Date.now();
    await assert.rejects(getJson(url, 300), /no complete response within 300 ms/);
    assert.ok(Date.now() - started < 800);
    assert.equal(timers(), before);
  } finally {
    await close();
  }
});

test('healthy after failures: returns the body, leaves no timer', async () => {
  let calls = 0;
  const { url, close } = await serve((req, res) => {
    calls += 1;
    if (calls < 3) return unhealthy(req, res);
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end('{"ok":true,"commit":"abc"}');
  });
  try {
    const before = timers();
    assert.deepEqual(await waitForHealth(url, 5000, 1000), { ok: true, commit: 'abc' });
    assert.equal(calls, 3);
    assert.equal(timers(), before);
  } finally {
    await close();
  }
});

test('the status read reports the status and parses only a success body', async () => {
  const { url, close } = await serve(unhealthy);
  try {
    assert.deepEqual(await getJson(url, 1000), { ok: false, status: 503, body: null });
  } finally {
    await close();
  }
});

// The probe runs as a module whose top-level await holds this poll. Against a
// stalled body in another process it must still settle and exit normally,
// never 13 ("unsettled top-level await").
test('as a top-level-await module, a stalled body still settles and exits 0', async () => {
  const { url, close } = await serve(stallBody);
  try {
    const source =
      `${getJson}\n${waitForHealth}\n` +
      `const health = await waitForHealth(${JSON.stringify(url)}, 1200, 400);\n` +
      `console.log(JSON.stringify(health));`;
    const child = spawn(process.execPath, ['--input-type=module', '-e', source], {
      stdio: ['ignore', 'pipe', 'pipe'],
      // Watchdog: a child that hangs fails this test in 10 s, not at the job timeout.
      timeout: 10_000,
    });
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (out += d));
    const code = await new Promise((resolve) => child.once('close', resolve));
    assert.equal(code, 0, out);
    assert.equal(out.trim(), 'null');
  } finally {
    await close();
  }
});
