import assert from 'node:assert/strict';
import { readBakedBuildIdentity } from './build_identity.js';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { once } from 'node:events';
import http from 'node:http';
import { test } from 'node:test';
import express from 'express';
import {
  JobStore,
  createJobRouter,
  liveBuildIdentity,
  loadChatSecret,
  runtimeBuildIdentity,
  redactJobCapability,
  requestDigest,
} from './job_store.js';
import { SpendStore } from './spend_store.js';
import { requestContext } from './execution_context.js';
import { createContinuationIdentity } from './state_codec.js';

const id = () => crypto.randomBytes(32).toString('hex');
const temp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'lyrics-job-'));
test('non-ASCII receipts fit a bounded heap and preserve exact independent replay values', () => {
  const script = `
    import assert from 'node:assert/strict';
    import { JobStore } from './mcp/job_store.js';
    const store = new JobStore();
    const payload = 'x'.repeat(1024 * 1024 - 2) + '\\u0100';
    for (let i = 0; i < 36; i++) {
      const request_id = i.toString(16).padStart(64, '0');
      store.begin(request_id, { request_id, message: payload }, {});
      store.complete(request_id, 200, { text: payload, index: i });
    }
    assert(store.bytes > 70 * 1024 * 1024);
    for (let i = 0; i < 36; i++) {
      const request_id = i.toString(16).padStart(64, '0');
      const record = store.get(request_id);
      assert.equal(record.intent.message, payload);
      assert.deepEqual(record.response.body, { text: payload, index: i });
      record.response.body.text = 'caller mutation';
      assert.equal(store.get(request_id).response.body.text, payload);
    }
    console.log('bounded heap receipt replay passed');
  `;
  const result = spawnSync(
    process.execPath,
    ['--max-old-space-size=80', '--input-type=module', '-e', script],
    {
      cwd: path.resolve(import.meta.dirname, '..'),
      encoding: 'utf8',
      timeout: 30000,
    }
  );
  assert.equal(result.status, 0, result.error?.message || result.stderr);
  assert.match(result.stdout, /bounded heap receipt replay passed/);
});

function signed(secret, lyric = null) {
  const envelope = {
    history: [{ role: 'user', parts: [{ text: 'continue' }] }],
    workspace: null,
    lyric,
  };
  return {
    ...envelope,
    sig: crypto.createHmac('sha256', secret).update(JSON.stringify(envelope)).digest('hex'),
  };
}
async function serve(store, handler, { exposes } = {}) {
  const app = express();
  app.use(express.json());
  app.use(
    createJobRouter({
      store,
      build: { commit: 'fixture-build', source_sha256: 'fixture-source' },
      ...(exposes ? { exposes } : {}),
    })
  );
  app.post('/chat', (req, res, next) => {
    if (typeof req.body?.message !== 'string' || !req.body.message.trim())
      return res.status(400).json({ error: 'missing message' });
    if (req.chatJob && !req.chatJob.begin()) return;
    return handler(req, res, next);
  });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    close: async () => {
      const closed = once(server, 'close');
      server.close();
      server.closeAllConnections();
      await closed;
    },
  };
}
const post = (url, body) =>
  fetch(`${url}/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

test('receipt precedes execution; pending/different-input duplicates cannot dispatch; final payload is replayed', async () => {
  const dir = temp();
  const store = new JobStore(dir);
  const request_id = id();
  const body = { request_id, message: 'write lyrics' };
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  let entered;
  const started = new Promise((resolve) => {
    entered = resolve;
  });
  let executions = 0;
  const host = await serve(store, async (req, res) => {
    executions++;
    const disk = JSON.parse(fs.readFileSync(path.join(dir, `${request_id}.json`), 'utf8'));
    assert.equal(disk.state, 'pending');
    assert.deepEqual(disk.intent, body);
    assert.equal(requestContext().jobId, request_id);
    req.chatJob.checkpoint(signed('fixture-secret'));
    requestContext().onCheckpoint({ kind: 'proposal', proposal: 'already accepted line' });
    entered();
    await gate;
    res.status(201).json({ reply: 'finished', ...signed('fixture-secret') });
  });
  try {
    const first = post(host.url, body);
    await started;
    const duplicate = await post(host.url, body);
    assert.equal(duplicate.status, 202);
    const pending = await duplicate.json();
    assert.equal(pending.state, 'pending');
    assert.equal(pending.checkpoint.sig, signed('fixture-secret').sig);
    assert.equal(pending.progress.kind, 'proposal');
    assert.equal(pending.intent, undefined, 'status does not expose the original request body');
    assert.equal((await post(host.url, { ...body, message: 'different request' })).status, 409);
    assert.equal(executions, 1);
    release();
    const original = await first;
    const reply = await original.json();
    assert.equal(original.status, 201);
    assert.equal((await post(host.url, body)).status, 201);
    assert.equal(executions, 1);
    const status = await (await fetch(`${host.url}/chat/jobs/${request_id}`)).json();
    assert.deepEqual(status.response, { status: 201, body: reply });
    assert.equal(status.state, 'completed');
    assert.equal(status.build.commit, 'fixture-build');
    assert.equal((await fetch(`${host.url}/chat/jobs/${id()}`)).status, 404);
    const restarted = new JobStore(dir);
    assert.deepEqual(restarted.get(request_id).response.body, reply);
    assert.equal(fs.statSync(path.join(dir, `${request_id}.json`)).mode & 0o077, 0);
  } finally {
    release();
    await host.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('a killed process leaves an interrupted receipt and preserved signed checkpoint, never permission to replay', async () => {
  const dir = temp();
  const request_id = id();
  const body = { request_id, message: 'long lyrics' };
  const checkpoint = signed('fixture-secret');
  const child = spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `
    import { JobStore } from ${JSON.stringify(new URL('./job_store.js', import.meta.url).href)};
    const store = new JobStore(${JSON.stringify(dir)});
    store.begin(${JSON.stringify(request_id)}, ${JSON.stringify(body)}, {commit:'child-build'});
    store.checkpoint(${JSON.stringify(request_id)}, ${JSON.stringify(checkpoint)});
    process.kill(process.pid, 'SIGKILL');
  `,
    ],
    { encoding: 'utf8' }
  );
  assert.equal(child.signal, 'SIGKILL');
  const store = new JobStore(dir);
  let executions = 0;
  const host = await serve(store, (_req, res) => {
    executions++;
    res.json({ unexpected: true });
  });
  try {
    const reply = await post(host.url, body);
    assert.equal(reply.status, 409);
    const receipt = await reply.json();
    assert.equal(receipt.state, 'interrupted');
    assert.equal(receipt.interruption, 'process_restarted');
    assert.deepEqual(receipt.checkpoint, checkpoint);
    assert.equal(executions, 0);
  } finally {
    await host.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('receipts another surface keeps in the same store are never served by the chat routes', async () => {
  // Connector sessions written before they had their own store live beside
  // /chat's receipts until they expire. Their stored body holds private
  // continuation state the connector never shows; knowing a session id, and
  // the intent it was opened with, must not read it back through /chat.
  const dir = temp();
  const store = new JobStore(dir);
  const session = id();
  const intent = { request_id: session, integration: 'chatgpt-v1', action: 'open' };
  store.begin(session, intent, {}, { session: { workspace: 'private' } });
  store.complete(session, 200, { session: { native: { continuation: { state: 'secret' } } } });
  const hidden = (record) => record.intent?.integration !== 'chatgpt-v1';
  const unfiltered = await serve(store, (_req, res) => res.json({ reply: 'chat' }));
  const host = await serve(store, (_req, res) => res.json({ reply: 'chat' }), { exposes: hidden });
  try {
    // The counterexample: without the filter the stored body comes back.
    const leaked = await post(unfiltered.url, intent);
    assert.match(await leaked.text(), /secret/);
    const read = await fetch(`${host.url}/chat/jobs/${session}`);
    assert.equal(read.status, 404);
    const replay = await post(host.url, intent);
    assert.equal(replay.status, 409);
    assert.doesNotMatch(await replay.text(), /secret|private/);
  } finally {
    await unfiltered.close();
    await host.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('an intent carrying undefined fields digests as its JSON and is admitted', () => {
  const store = new JobStore();
  const request_id = id();
  const intent = { request_id, action: { tool: 'x', arguments: { a: undefined, b: [undefined] } } };
  const { record } = store.begin(request_id, intent, {}, null);
  assert.equal(record.digest, requestDigest(JSON.parse(JSON.stringify(intent))));
  assert.equal(store.get(request_id).state, 'pending');
});

test('adopting a finished receipt copies it unchanged and keeps one already held', () => {
  const source = new JobStore();
  const target = new JobStore();
  const request_id = id();
  source.begin(request_id, { request_id }, {}, null);
  source.complete(request_id, 200, { ok: true });
  const adopted = target.adopt(source.get(request_id));
  assert.deepEqual(adopted, source.get(request_id));
  assert.deepEqual(target.adopt({ ...source.get(request_id), state: 'pending' }), adopted);
  const pending = id();
  source.begin(pending, { request_id: pending }, {}, null);
  assert.throws(() => target.adopt(source.get(pending)), /Only a finished receipt/);
});

test('final receipt survives a lost response and is available to a second HTTP connection', async () => {
  const dir = temp();
  const store = new JobStore(dir);
  const request_id = id();
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  let entered;
  const started = new Promise((resolve) => {
    entered = resolve;
  });
  let settled;
  const completed = new Promise((resolve) => {
    settled = resolve;
  });
  const host = await serve(store, async (_req, res) => {
    entered();
    await gate;
    res.json({ reply: 'retained despite closed socket' });
    settled();
  });
  try {
    const request = http.request(`${host.url}/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
    });
    request.on('error', () => {});
    request.end(JSON.stringify({ request_id, message: 'lyrics' }));
    await started;
    request.destroy();
    release();
    await completed;
    const receipt = await (await fetch(`${host.url}/chat/jobs/${request_id}`)).json();
    assert.equal(receipt.state, 'completed');
    assert.equal(receipt.response.body.reply, 'retained despite closed socket');
  } finally {
    release();
    await host.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('corrupt receipts, key files and spend counters fail closed without overwriting evidence', () => {
  const dir = temp();
  try {
    const jobs = path.join(dir, 'jobs');
    const store = new JobStore(jobs);
    const request_id = id();
    store.begin(request_id, { request_id, message: 'lyrics' }, {});
    const file = path.join(jobs, `${request_id}.json`);
    fs.writeFileSync(file, '{truncated');
    assert.throws(() => new JobStore(jobs));
    assert.equal(fs.readFileSync(file, 'utf8'), '{truncated');
    const keyFile = path.join(dir, 'chat-secret.key');
    const key = loadChatSecret({ LYRIC_RUNTIME_DIR: dir });
    assert.equal(loadChatSecret({ LYRIC_RUNTIME_DIR: dir }), key);
    assert.equal(fs.statSync(keyFile).mode & 0o077, 0);
    fs.writeFileSync(keyFile, 'corrupted');
    assert.throws(() => loadChatSecret({ LYRIC_RUNTIME_DIR: dir }));
    assert.equal(fs.readFileSync(keyFile, 'utf8'), 'corrupted');
    const spendFile = path.join(dir, 'spend.json');
    fs.writeFileSync(spendFile, '{broken');
    const spend = new SpendStore(spendFile, { log: () => {} });
    assert.equal(spend.healthy, false);
    assert.equal(spend.state.usd, Infinity);
    assert.throws(() => spend.rollDay('2026-09-07'), /disabled/);
    assert.throws(() => spend.save(), /disabled/);
    assert.equal(fs.readFileSync(spendFile, 'utf8'), '{broken');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('storage failure before dispatch blocks execution and final persistence failure never claims a completed receipt', async () => {
  const dir = temp();
  const jobs = path.join(dir, 'jobs');
  const store = new JobStore(jobs);
  let executions = 0;
  const host = await serve(store, (_req, res) => {
    executions++;
    fs.renameSync(jobs, `${jobs}-saved`);
    fs.writeFileSync(jobs, 'not a directory');
    res.json({ reply: 'cannot persist this response' });
  });
  try {
    const request_id = id();
    const response = await post(host.url, { request_id, message: 'lyrics' });
    assert.equal(response.status, 503);
    assert.equal((await response.json()).state, 'interrupted');
    assert.equal(executions, 1);
    assert.equal((await post(host.url, { request_id: id(), message: 'more lyrics' })).status, 503);
    assert.equal(executions, 1);
    const uncertain = await (await fetch(`${host.url}/chat/jobs/${request_id}`)).json();
    assert.equal(uncertain.state, 'interrupted');
    assert.ok(uncertain.persistence_error);
    const retained = new JobStore(`${jobs}-saved`);
    assert.equal(retained.get(request_id).state, 'interrupted');
    assert.equal(retained.get(request_id).response, null);
  } finally {
    await host.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('receipt capacity is bounded, active jobs cannot expire, and expiry is explicit', () => {
  let now = 10;
  const store = new JobStore(null, { maxRecords: 1, ttlMs: 100, now: () => now });
  const request_id = id();
  const input = { request_id, message: 'lyrics' };
  store.begin(request_id, input, {});
  now = 1_000;
  assert.equal(store.get(request_id).state, 'pending');
  assert.throws(() => store.begin(id(), { message: 'other' }, {}), /full/);
  store.complete(request_id, 200, { reply: 'done' });
  now += 101;
  assert.equal(store.get(request_id), null);
  assert.equal(store.records.size, 0);
  assert.equal(store.bytes, 0);
  const tiny = new JobStore(null, { maxRecordBytes: 100 });
  assert.throws(() => tiny.begin(request_id, input, {}), /capacity/);
  assert.equal(tiny.records.size, 0);
});

test('build fingerprints change with declared runtime config and never contain credentials', () => {
  const base = runtimeBuildIdentity({
    RENDER_GIT_COMMIT: 'test-commit',
    GEMINI_API_KEY: 'private-secret',
    CHAT_DAILY_USD: '25',
  });
  const changed = runtimeBuildIdentity({
    RENDER_GIT_COMMIT: 'test-commit',
    GEMINI_API_KEY: 'different-secret',
    CHAT_DAILY_USD: '24',
  });
  assert.match(base.source_sha256, /^[a-f0-9]{64}$/);
  assert.equal(base.source_sha256, changed.source_sha256);
  assert.notEqual(base.config_sha256, changed.config_sha256);
  assert.ok(!JSON.stringify(base).includes('private-secret'));
  const baked = readBakedBuildIdentity();
  assert.equal(base.commit, baked?.commit || 'test-commit');
  assert.equal(base.release_id, baked?.release_id ?? null);
});

test('recovered error receipts preserve Retry-After pacing', async () => {
  const store = new JobStore();
  const request_id = id();
  let executions = 0;
  const host = await serve(store, (_req, res) => {
    executions++;
    res.set('Retry-After', '41').status(429).json({ error: 'rate limited' });
  });
  try {
    const body = { request_id, message: 'lyrics' };
    assert.equal((await post(host.url, body)).headers.get('retry-after'), '41');
    const duplicate = await post(host.url, body);
    assert.equal(duplicate.status, 429);
    assert.equal(duplicate.headers.get('retry-after'), '41');
    const receipt = await (await fetch(`${host.url}/chat/jobs/${request_id}`)).json();
    assert.equal(receipt.response.headers['retry-after'], '41');
    assert.equal(executions, 1);
  } finally {
    await host.close();
  }
});

test('capability redaction covers case-insensitive routes, query strings and referrers', () => {
  const capability = id();
  for (const url of [
    `/chat/jobs/${capability}`,
    `/CHAT/JOBS/${capability}?again=${capability}`,
    `https://example.test/chat/jobs/${capability}?token=${capability}`,
  ]) {
    const redacted = redactJobCapability(url);
    assert.ok(!redacted.includes(capability));
    assert.ok(redacted.includes('[capability]'));
  }
});

test('rejected requests cannot consume recovery capacity before chat admission', async () => {
  const store = new JobStore(null, { maxRecords: 1 });
  let executions = 0;
  const host = await serve(store, (_req, res) => {
    executions++;
    res.json({ reply: 'accepted' });
  });
  try {
    for (let i = 0; i < 5; i++)
      assert.equal((await post(host.url, { request_id: id(), message: '' })).status, 400);
    assert.equal(store.records.size, 0);
    assert.equal(executions, 0);
    assert.equal(
      (await post(host.url, { request_id: id(), message: 'valid lyrics request' })).status,
      200
    );
    assert.equal(executions, 1);
  } finally {
    await host.close();
  }
});

test('terminal payload eviction retains a durable tombstone so its identifier cannot execute again', async () => {
  const dir = temp();
  const store = new JobStore(dir, { maxPayloadRecords: 1, maxRecords: 4 });
  const first = id();
  const second = id();
  const input = { request_id: first, message: 'first song' };
  store.begin(first, input, { commit: 'fixture' });
  store.complete(first, 200, { reply: 'first result' });
  store.begin(second, { request_id: second, message: 'second song' }, {});
  assert.equal(store.get(first).state, 'retired');
  assert.equal(store.get(first).intent, null);
  assert.equal(store.get(first).response, null);
  assert.equal(store.begin(first, input, {}).created, false);
  const restarted = new JobStore(dir, { maxPayloadRecords: 1, maxRecords: 4 });
  let executions = 0;
  const host = await serve(restarted, (_req, res) => {
    executions++;
    res.json({ unexpected: true });
  });
  try {
    const duplicate = await post(host.url, input);
    assert.equal(duplicate.status, 409);
    assert.equal((await duplicate.json()).state, 'retired');
    assert.equal(executions, 0);
  } finally {
    await host.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('payload eviction retires superseded, then completed receipts, and never an interrupted receipt holding accepted lines', () => {
  const dir = temp();
  try {
    const store = new JobStore(dir, { maxPayloadRecords: 3, maxRecords: 16 });
    const held = id();
    store.begin(held, { request_id: held, message: 'held' }, {});
    store.checkpoint(held, { version: 1, status: 'accepted', accepted_lines: ['kept'] });
    store.interrupt(held, 'operation_interrupted');
    const superseded = id();
    store.begin(superseded, { request_id: superseded, message: 'a' }, {});
    store.complete(superseded, 200, { ok: 1 });
    const head = id();
    store.begin(head, { request_id: head, continuation_id: superseded, message: 'b' }, {});
    store.complete(head, 200, { ok: 2 });
    assert.equal(store.get(superseded).successor_id, head);
    // The oldest receipt is the interrupted one; the superseded one goes first.
    const next = id();
    store.begin(next, { request_id: next, message: 'c' }, {});
    assert.equal(store.get(superseded).state, 'retired');
    assert.equal(store.get(held).state, 'interrupted');
    assert.equal(store.get(head).state, 'completed');
    // Then the remaining completed receipt, still never the held one.
    const more = id();
    store.begin(more, { request_id: more, message: 'd' }, {});
    assert.equal(store.get(head).state, 'retired');
    assert.equal(store.get(held).state, 'interrupted');
    // With only pending work and the held receipt left, admission refuses
    // rather than retiring accepted lines.
    const last = id();
    assert.throws(
      () => store.begin(last, { request_id: last, message: 'e' }, {}),
      (e) => e.code === 'JOB_CAPACITY'
    );
    assert.deepEqual(store.get(held).progress.accepted_lines, ['kept']);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('SIGKILL after a budgeted provider dispatch retains uncertainty and cannot replay the request', async () => {
  const dir = temp();
  const jobs = path.join(dir, 'jobs');
  const request_id = id();
  const body = { request_id, message: 'lyrics proposal' };
  const child = spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `
    import { JobStore } from ${JSON.stringify(new URL('./job_store.js', import.meta.url).href)};
    import { PaidLedger, createOperationBudget, openKitchenBudget } from ${JSON.stringify(new URL('./paid_budget.js', import.meta.url).href)};
    import { createServer } from 'node:http';
    import fs from 'node:fs';
    const store = new JobStore(${JSON.stringify(jobs)});
    const requestId = ${JSON.stringify(request_id)};
    store.begin(requestId, ${JSON.stringify(body)}, {});
    store.checkpoint(requestId, ${JSON.stringify(signed('fixture-secret'))});
    store.checkpoint(requestId, {status:'proposing', accepted_lines:['retained lyric'], proposals:[]});
    const ledger = new PaidLedger({file:${JSON.stringify(path.join(dir, 'paid.json'))}, pricing:()=>({input:1,output:1})});
    const broker = await openKitchenBudget({budget:createOperationBudget({ledger}),
      onProposerUsage: event => store.proposerUsage(requestId, event)});
    const reservation = await fetch(broker.env.LYRIC_BUDGET_URL, {method:'POST',headers:{
      authorization:'Bearer '+broker.env.LYRIC_BUDGET_TOKEN,'content-type':'application/json'},
      body:JSON.stringify({action:'reserve',model:'fixture',inputBytes:100,maxOutputTokens:100})});
    if (reservation.status !== 200) process.exit(2);
    const provider = createServer(() => {
      fs.writeFileSync(${JSON.stringify(path.join(dir, 'provider-dispatched'))}, '1');
      process.kill(process.pid, 'SIGKILL');
    });
    await new Promise(resolve => provider.listen(0, '127.0.0.1', resolve));
    await fetch('http://127.0.0.1:'+provider.address().port, {method:'POST',body:'fixture proposal'});
  `,
    ],
    { encoding: 'utf8', timeout: 10_000 }
  );
  assert.equal(child.signal, 'SIGKILL', child.stderr);
  assert.equal(fs.readFileSync(path.join(dir, 'provider-dispatched'), 'utf8'), '1');
  const store = new JobStore(jobs);
  let executions = 0;
  const host = await serve(store, (_req, res) => {
    executions++;
    res.json({ unexpected: true });
  });
  try {
    const receipt = await (await fetch(`${host.url}/chat/jobs/${request_id}`)).json();
    assert.equal(receipt.state, 'interrupted');
    assert.equal(receipt.uncertain_proposal, true);
    assert.equal(receipt.progress.uncertain_proposal, true);
    assert.equal(receipt.proposer_usage.in_flight, true);
    assert.deepEqual(receipt.progress.accepted_lines, ['retained lyric']);
    assert.equal((await post(host.url, body)).status, 409);
    assert.equal(executions, 0);
  } finally {
    await host.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('after a timed-out, then a failed, then a passing asset check, identities match a healthy boot', () => {
  // 3PO's sequence: a check that did not complete, a completed failure, then an
  // epoch/proof change and a check that passes, all in one process.
  const blank = { assets_sha256: null, manifest_sha256: null, python: null, nltk: null };
  const healthy = {
    ok: true,
    assets_sha256: 'a'.repeat(64),
    manifest_sha256: 'b'.repeat(64),
    python: '3.11.2',
    nltk: '3.10.3',
  };
  const sequence = [
    { ok: false, incomplete: true, ...blank },
    { ok: false, ...blank, errors: ['digest mismatch'] },
    healthy,
  ];
  let reads = 0;
  const assets = () => sequence[Math.min(reads++, sequence.length - 1)];
  const env = { RENDER_GIT_COMMIT: 'test-commit' };
  const identity = liveBuildIdentity(env, assets);
  assert.equal(identity().assets_sha256, null);
  // A default set in the environment after boot (chat.js sets
  // LYRIC_PROPOSER_MODEL) is not in the boot identity, so not in this one.
  env.LYRIC_PROPOSER_MODEL = 'set-after-boot';
  assert.equal(identity().assets_sha256, null); // a completed failure is not kept either
  const later = identity();
  assert.equal(later.assets_sha256, 'a'.repeat(64));
  assert.equal(identity(), later);
  assert.equal(reads, 3); // kept once the check passed
  delete env.LYRIC_PROPOSER_MODEL;
  assert.deepEqual(later, runtimeBuildIdentity(env, healthy));
  // The reader fingerprint is this identity's assets_sha256 (server_http.js).
  assert.equal(later.assets_sha256, healthy.assets_sha256);
  reads = 0;
  const continuation = createContinuationIdentity(assets);
  const early = continuation();
  continuation();
  const recovered = continuation();
  assert.notEqual(early, recovered);
  assert.equal(recovered, createContinuationIdentity(() => healthy)());
  assert.equal(continuation(), recovered);
  assert.equal(reads, 3);
  const store = new JobStore(null);
  const request_id = crypto.randomBytes(32).toString('hex');
  const { record } = store.begin(request_id, { request_id, action: 'x' }, identity);
  assert.equal(record.build.assets_sha256, 'a'.repeat(64));
});

// P8 (#519, Don 6349649672 with Jony 6349672118 and 3PO 6349681842): a store
// that cannot admit a call decides so before it writes, and retires nothing.
const states = (store) =>
  [...store.records.values()].map((r) => [r.request_id, r.state, r.successor_id ?? null]);
const held = (store) => ({ states: states(store), bytes: store.bytes, size: store.records.size });

test('P8: a refused admission retires nothing, on the byte cap and on the payload cap', async () => {
  const { SESSION_STORE_LIMITS } = await import('./workflow_sessions.js');
  // The real session limits: 30 completed 376 KB receipts, then 3 pending calls
  // reserving 18 MiB each. A 4th cannot fit even if every receipt were retired.
  const store = new JobStore(null, { ...SESSION_STORE_LIMITS });
  const body = 'x'.repeat(376 * 1024);
  for (let i = 0; i < 30; i++) {
    const r = id();
    store.begin(r, { request_id: r });
    store.complete(r, 200, { body });
  }
  for (let i = 0; i < 3; i++) {
    const r = id();
    store.begin(r, { request_id: r });
  }
  const kept = states(store).filter(([, s]) => s === 'completed').length;
  assert.ok(kept > 0, 'some saved receipts survive three pending calls');
  const before = held(store);
  const r = id();
  assert.throws(() => store.begin(r, { request_id: r }), { code: 'JOB_CAPACITY', status: 503 });
  assert.deepEqual(held(store), before);

  // The payload-record cap binds with bytes to spare (Jony): admission retires
  // exactly the one receipt it needs, oldest first; a refusal retires none.
  const capped = new JobStore(null, { maxPayloadRecords: 4, maxRecords: 64 });
  const [a, b, c, d, e, f, g] = Array.from({ length: 7 }, id);
  for (const done of [a, b]) {
    capped.begin(done, { request_id: done });
    capped.complete(done, 200, { ok: done });
  }
  for (const running of [c, d]) capped.begin(running, { request_id: running });
  capped.begin(e, { request_id: e });
  assert.equal(capped.get(a).state, 'retired');
  assert.equal(capped.get(b).state, 'completed');
  capped.begin(f, { request_id: f });
  assert.equal(capped.get(b).state, 'retired');
  const full = held(capped);
  assert.throws(() => capped.begin(g, { request_id: g }), { code: 'JOB_CAPACITY' });
  assert.deepEqual(held(capped), full);
});

test('P8: interrupted receipts holding accepted lines are kept with no pending work at all', () => {
  // 3PO: JOB_CAPACITY is not only running work. Two protected receipts, zero
  // pending: the refusal retires neither.
  const store = new JobStore(null, { maxPayloadRecords: 2, maxRecords: 64 });
  for (let i = 0; i < 2; i++) {
    const r = id();
    store.begin(r, { request_id: r });
    store.checkpoint(r, { version: 1, status: 'accepted', accepted_lines: [`kept ${i}`] });
    store.interrupt(r, 'operation_interrupted');
  }
  const before = held(store);
  const r = id();
  assert.throws(() => store.begin(r, { request_id: r }), { code: 'JOB_CAPACITY' });
  assert.deepEqual(held(store), before);
  for (const record of store.records.values())
    assert.equal(record.progress.accepted_lines.length, 1);
});

test('P8: running out of ids has its own code, and retry_at only when a receipt can expire', () => {
  let now = 1000;
  const store = new JobStore(null, { maxRecords: 4, ttlMs: 100, now: () => now });
  for (const at of [1000, 1010]) {
    now = at;
    const r = id();
    store.begin(r, { request_id: r });
    store.complete(r, 200, { ok: 1 });
  }
  for (let i = 0; i < 2; i++) {
    const r = id();
    store.begin(r, { request_id: r });
  }
  const before = held(store);
  const r = id();
  assert.throws(
    () => store.begin(r, { request_id: r }),
    (error) =>
      error.code === 'JOB_RECORDS_FULL' &&
      error.status === 503 &&
      error.retry_at === 1100 &&
      /full/.test(error.message)
  );
  assert.deepEqual(held(store), before);
  // With only running work there is no expiry to name.
  const running = new JobStore(null, { maxRecords: 2 });
  for (let i = 0; i < 2; i++) {
    const p = id();
    running.begin(p, { request_id: p });
  }
  assert.throws(
    () => running.begin(id(), { message: 'x' }),
    (error) => error.code === 'JOB_RECORDS_FULL' && !('retry_at' in error)
  );
});

test('P8: adoption, the new record and the successor link are admitted together or not at all', () => {
  const finished = () => {
    const other = new JobStore();
    const p = id();
    other.begin(p, { request_id: p, message: 'from an earlier release' });
    other.complete(p, 200, { ok: 'parent' });
    return other.get(p);
  };
  const continuing = (store, parent, options) => {
    const child = id();
    return () =>
      store.begin(
        child,
        { request_id: child, continuation_id: parent.request_id },
        {},
        null,
        options
      );
  };

  // Two ids needed, one slot left: nothing is adopted or written.
  const ids = new JobStore(null, { maxRecords: 3 });
  for (let i = 0; i < 2; i++) {
    const r = id();
    ids.begin(r, { request_id: r });
    ids.complete(r, 200, { ok: i });
  }
  const legacy = finished();
  let before = held(ids);
  assert.throws(continuing(ids, legacy, { adopt: legacy }), { code: 'JOB_RECORDS_FULL' });
  assert.deepEqual(held(ids), before);

  // Adoption fits on its own, by retiring a receipt; adoption plus the child
  // does not. Neither the adoption nor the retirement happens.
  const small = { maxRecordBytes: 4096, maxRecords: 64 };
  const filler = 'y'.repeat(2500);
  const probe = new JobStore(null, small);
  const spare = id();
  probe.begin(spare, { request_id: spare });
  probe.complete(spare, 200, { filler });
  const bigParent = (() => {
    const other = new JobStore(null, small);
    const p = id();
    other.begin(p, { request_id: p });
    other.complete(p, 200, { filler });
    return other.get(p);
  })();
  const maxBytes = probe.bytes + Buffer.byteLength(JSON.stringify(bigParent)) - 1;
  assert.ok(maxBytes >= small.maxRecordBytes, 'a single admission still fits');
  const bytes = new JobStore(null, { ...small, maxBytes });
  bytes.begin(spare, { request_id: spare });
  bytes.complete(spare, 200, { filler });
  before = held(bytes);
  assert.throws(continuing(bytes, bigParent, { adopt: bigParent }), { code: 'JOB_CAPACITY' });
  assert.deepEqual(held(bytes), before);
  assert.equal(bytes.get(bigParent.request_id), null);
  assert.equal(bytes.get(spare).state, 'completed');

  // The child fits; the parent's successor link does not. Before P8 the child
  // was written and left unlinked. Now nothing is written, and one byte more
  // admits both.
  const link = (maxBytes) => {
    const store = new JobStore(null, { ...small, maxBytes });
    const p = id();
    store.begin(p, { request_id: p, message: 'parent' });
    store.complete(p, 200, { ok: 'parent' });
    return { store, parent: store.get(p) };
  };
  const { store: sizing, parent: sized } = link(1 << 30);
  const childId = 'c'.repeat(64);
  const growth =
    Buffer.byteLength(JSON.stringify({ ...sized, successor_id: childId })) -
    Buffer.byteLength(JSON.stringify(sized));
  const exact = sizing.bytes + small.maxRecordBytes + growth;
  const tight = link(exact - 1);
  before = held(tight.store);
  assert.throws(
    () =>
      tight.store.begin(childId, { request_id: childId, continuation_id: tight.parent.request_id }),
    { code: 'JOB_CAPACITY' }
  );
  assert.deepEqual(held(tight.store), before);
  const roomy = link(exact);
  roomy.store.begin(childId, { request_id: childId, continuation_id: roomy.parent.request_id });
  assert.equal(roomy.store.get(roomy.parent.request_id).successor_id, childId);

  // And the parent being linked is never the receipt retired to make room.
  const order = new JobStore(null, { maxPayloadRecords: 2, maxRecords: 64 });
  const [older, newer, next] = [id(), id(), id()];
  for (const r of [older, newer]) {
    order.begin(r, { request_id: r });
    order.complete(r, 200, { ok: r });
  }
  order.begin(next, { request_id: next, continuation_id: older });
  assert.equal(order.get(older).state, 'completed');
  assert.equal(order.get(older).successor_id, next);
  assert.equal(order.get(newer).state, 'retired');
});
