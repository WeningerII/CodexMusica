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
  loadChatSecret,
  runtimeBuildIdentity,
  redactJobCapability,
} from './job_store.js';
import { SpendStore } from './spend_store.js';
import { requestContext } from './execution_context.js';

const id = () => crypto.randomBytes(32).toString('hex');
const temp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'lyrics-job-'));
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
async function serve(store, handler) {
  const app = express();
  app.use(express.json());
  app.use(
    createJobRouter({ store, build: { commit: 'fixture-build', source_sha256: 'fixture-source' } })
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
