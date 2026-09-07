import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  PaidLedger,
  createOperationBudget,
  openKitchenBudget,
  requestReserveUsd,
} from './paid_budget.js';
import {
  withExecutionContext,
  childExecutionContext,
  remainingExecutionMs,
} from './execution_context.js';
import { performance } from 'node:perf_hooks';

const pricing = () => ({ input: 1, output: 1 });
const request = { model: 'fixture', inputBytes: 100, maxOutputTokens: 100 };
const usage = {
  promptTokenCount: 100,
  candidatesTokenCount: 100,
  thoughtsTokenCount: 500,
  cachedContentTokenCount: 50,
  totalTokenCount: 700,
};

test('admission is shared across operations and settles actual thinking usage once', () => {
  const ledger = new PaidLedger({ pricing });
  const reserve = requestReserveUsd(request, pricing);
  const a = createOperationBudget({ maxUsd: 1, dailyUsd: reserve * 1.5, ledger });
  const b = createOperationBudget({ maxUsd: 1, dailyUsd: reserve * 1.5, ledger });
  const first = a.reserve(request);
  assert.throws(() => b.reserve(request), { code: 'DAILY_BUDGET' });
  assert.equal(a.settle(first, { usage, status: 'success' }), 0.0007);
  assert.equal(ledger.snapshot().usd, 0.0007);
  assert.equal(a.snapshot().events[0].usage.thoughtsTokenCount, 500);
  assert.equal(a.snapshot().events[0].usage.cachedContentTokenCount, 50);
  assert.throws(() => a.settle(first, { usage, status: 'success' }), {
    code: 'ACCOUNTING_UNAVAILABLE',
  });
  const second = b.reserve(request);
  assert.throws(() => a.settle(second, { status: 'rejected' }), { code: 'ACCOUNTING_UNAVAILABLE' });
  b.settle(second, { status: 'rejected' });
  a.close();
  b.close();
});

test('an uncosted or failed model request is never admitted as free', () => {
  const ledger = new PaidLedger({ pricing });
  const reserve = requestReserveUsd(request, pricing);
  const operation = createOperationBudget({ maxUsd: reserve * 1.5, dailyUsd: 5, ledger });
  const first = operation.reserve(request);
  operation.settle(first, {
    status: 'success',
    usage: { promptTokenCount: -1, candidatesTokenCount: 0 },
  });
  assert.equal(operation.snapshot().usd, reserve);
  assert.equal(operation.snapshot().unknownUsd, reserve);
  assert.throws(() => operation.reserve(request), { code: 'MAX_TURN_COST' });
  assert.throws(() => requestReserveUsd(request, () => null), { code: 'ACCOUNTING_UNAVAILABLE' });
  operation.close();
});

test('reservations survive a process restart as unknown spend, and corrupt storage blocks admission', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lyric-budget-'));
  const file = path.join(dir, 'paid.json');
  try {
    const ledger = new PaidLedger({ file, pricing });
    const operation = createOperationBudget({ ledger, maxUsd: 1, dailyUsd: 5 });
    operation.reserve(request);
    const reserved = ledger.snapshot().reservedUsd;
    assert.ok(reserved > 0);
    assert.equal(fs.statSync(file).mode & 0o777, 0o600);
    const restarted = new PaidLedger({ file, pricing });
    assert.equal(restarted.snapshot().usd, reserved);
    assert.equal(restarted.snapshot().unknownUsd, reserved);
    assert.equal(restarted.snapshot().reservedUsd, 0);
    fs.writeFileSync(file, '{');
    const corrupt = new PaidLedger({ file, pricing });
    assert.ok(corrupt.snapshot().blocked);
    assert.throws(() => createOperationBudget({ ledger: corrupt }).reserve(request), {
      code: 'ACCOUNTING_UNAVAILABLE',
    });
    assert.equal(fs.readFileSync(file, 'utf8'), '{');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('provider envelope violations stay blocked after restart', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lyric-budget-'));
  try {
    const file = path.join(dir, 'paid.json');
    const ledger = new PaidLedger({ file, pricing });
    const operation = createOperationBudget({ ledger });
    const reservation = operation.reserve(request);
    operation.settle(reservation, {
      status: 'success',
      usage: { promptTokenCount: 1_000_000, candidatesTokenCount: 0 },
    });
    assert.ok(ledger.snapshot().blocked);
    assert.equal(ledger.snapshot().usd, 1);
    const restarted = new PaidLedger({ file, pricing });
    assert.ok(restarted.snapshot().blocked);
    assert.throws(() => createOperationBudget({ ledger: restarted }).reserve(request), {
      code: 'ACCOUNTING_UNAVAILABLE',
    });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('UTC rollover preserves active reservations and backwards clocks cannot refund spend', () => {
  let clock = new Date('2026-09-07T23:59:59Z');
  const ledger = new PaidLedger({ pricing, now: () => clock });
  const operation = createOperationBudget({ ledger });
  const reservation = operation.reserve(request);
  clock = new Date('2026-09-08T00:00:01Z');
  assert.ok(ledger.snapshot().reservedUsd > 0);
  operation.settle(reservation, { status: 'success', usage });
  assert.equal(ledger.snapshot().usd, 0.0007);
  clock = new Date('2026-09-07T23:58:59Z');
  assert.throws(() => ledger.snapshot(), { code: 'ACCOUNTING_UNAVAILABLE' });
  assert.throws(() => operation.reserve(request), { code: 'ACCOUNTING_UNAVAILABLE' });
});

test('loopback kitchen broker shares admission, isolates reservations and retains unknown work on close', async () => {
  const ledger = new PaidLedger({ pricing });
  const budget = createOperationBudget({ ledger });
  const broker = await openKitchenBudget({ budget });
  const other = await openKitchenBudget({ budget });
  const post = async (b, body, token = b.env.LYRIC_BUDGET_TOKEN) => {
    const response = await fetch(b.env.LYRIC_BUDGET_URL, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  };
  try {
    assert.equal((await post(broker, { action: 'reserve', ...request }, 'wrong')).status, 403);
    const reserved = await post(broker, { action: 'reserve', ...request });
    assert.equal(reserved.status, 200);
    assert.equal(
      (
        await post(other, {
          action: 'settle',
          reservation_id: reserved.body.reservation_id,
          status: 'rejected',
        })
      ).status,
      503
    );
    assert.equal(
      (
        await post(broker, {
          action: 'settle',
          reservation_id: reserved.body.reservation_id,
          status: 'success',
          usage,
        })
      ).status,
      200
    );
    await post(broker, { action: 'reserve', ...request });
  } finally {
    await broker.close();
    await other.close();
  }
  assert.ok(budget.snapshot().unknownUsd > 0);
  assert.equal(budget.snapshot().reservedUsd, 0);
  assert.equal(ledger.snapshot().usd, budget.snapshot().usd);
  budget.close();
});

test('expired kitchen admission and inherited cancellation prevent dispatch', async () => {
  const controller = new AbortController();
  const parent = { signal: controller.signal, deadlineAt: performance.now() + 1000 };
  const child = withExecutionContext(parent, () =>
    childExecutionContext({ deadlineMs: Date.now() + 5000 })
  );
  assert.equal(child.deadlineAt, parent.deadlineAt);
  controller.abort();
  assert.equal(remainingExecutionMs(child), 0);
  const broker = await openKitchenBudget(child);
  try {
    const response = await fetch(broker.env.LYRIC_BUDGET_URL, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${broker.env.LYRIC_BUDGET_TOKEN}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        action: 'reserve',
        model: 'gemini-3.5-flash-lite',
        inputBytes: 100,
        maxOutputTokens: 256,
      }),
    });
    assert.equal(response.status, 429);
    assert.equal((await response.json()).code, 'MAX_TURN_MS');
  } finally {
    await broker.close();
  }
});

test('settlement itself rolls UTC day before charging newly completed work', () => {
  let clock = new Date('2026-09-07T23:59:59Z');
  const ledger = new PaidLedger({ pricing, now: () => clock });
  const operation = createOperationBudget({ ledger });
  const reservation = operation.reserve(request);
  clock = new Date('2026-09-08T00:00:01Z');
  operation.settle(reservation, { status: 'success', usage });
  assert.equal(ledger.snapshot().usd, 0.0007);
  assert.equal(ledger.snapshot().usd, operation.snapshot().usd);
});

test('restart across UTC midnight retains interrupted reservations on the recovered day', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lyric-budget-'));
  try {
    const file = path.join(dir, 'paid.json');
    let clock = new Date('2026-09-07T23:59:59Z');
    const ledger = new PaidLedger({ file, pricing, now: () => clock });
    createOperationBudget({ ledger }).reserve(request);
    const held = ledger.snapshot().reservedUsd;
    clock = new Date('2026-09-08T00:00:01Z');
    const restarted = new PaidLedger({ file, pricing, now: () => clock });
    assert.equal(restarted.snapshot().unknownUsd, held);
    assert.equal(restarted.snapshot().usd, held);
    assert.equal(restarted.snapshot().day, '2026-09-08');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('inconsistent provider totals retain unknown spending rather than discard tokens', () => {
  const ledger = new PaidLedger({ pricing });
  const operation = createOperationBudget({ ledger });
  const reservation = operation.reserve(request);
  const held = ledger.snapshot().reservedUsd;
  operation.settle(reservation, { status: 'success', usage: { ...usage, totalTokenCount: 1000 } });
  assert.equal(operation.snapshot().usd, held);
  assert.equal(operation.snapshot().unknownUsd, held);
});

test('invalid persisted dates and unknown totals cannot restore paid allowance', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lyric-budget-invalid-'));
  try {
    const file = path.join(dir, 'paid.json');
    for (const data of [
      { version: 1, day: '2026-02-30', usd: 1, unknownUsd: 0, reservations: {} },
      { version: 1, day: '2026-09-07', usd: 1, unknownUsd: 2, reservations: {} },
    ]) {
      const text = JSON.stringify(data);
      fs.writeFileSync(file, text, { mode: 0o600 });
      const ledger = new PaidLedger({ file, pricing });
      assert.ok(ledger.snapshot().blocked);
      assert.throws(() => createOperationBudget({ ledger }).reserve(request), {
        code: 'ACCOUNTING_UNAVAILABLE',
      });
      assert.equal(fs.readFileSync(file, 'utf8'), text);
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('non-private, oversized and linked ledger files are refused before loading or replacing them', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lyric-budget-file-'));
  try {
    const file = path.join(dir, 'paid.json');
    const ledger = new PaidLedger({ file, pricing });
    assert.equal(ledger.snapshot().blocked, null);
    fs.chmodSync(file, 0o644);
    assert.ok(new PaidLedger({ file, pricing }).snapshot().blocked);
    assert.equal(fs.statSync(file).mode & 0o777, 0o644);
    fs.chmodSync(file, 0o600);
    fs.truncateSync(file, 2 * 1024 * 1024);
    assert.ok(new PaidLedger({ file, pricing }).snapshot().blocked);
    assert.equal(fs.statSync(file).size, 2 * 1024 * 1024);
    const linked = path.join(dir, 'linked.json');
    fs.symlinkSync(file, linked);
    assert.ok(new PaidLedger({ file: linked, pricing }).snapshot().blocked);
    assert.ok(fs.lstatSync(linked).isSymbolicLink());
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('kitchen dispatch permission waits for durable usage admission, and receipt failure returns no capability', async () => {
  const ledger = new PaidLedger({ pricing });
  const budget = createOperationBudget({ ledger });
  let called = 0;
  const broker = await openKitchenBudget({
    budget,
    onProposerUsage: (event) => {
      called++;
      assert.equal(event.in_flight, true);
      assert.ok(ledger.snapshot().reservedUsd > 0, 'paid reservation precedes job receipt');
      throw new Error('receipt disk unavailable');
    },
  });
  try {
    const response = await fetch(broker.env.LYRIC_BUDGET_URL, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${broker.env.LYRIC_BUDGET_TOKEN}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ action: 'reserve', ...request }),
    });
    assert.equal(response.status, 503);
    const body = await response.json();
    assert.equal(body.code, 'ACCOUNTING_UNAVAILABLE');
    assert.equal(body.reservation_id, undefined);
    assert.equal(called, 1);
  } finally {
    await broker.close();
  }
  assert.ok(budget.snapshot().unknownUsd > 0);
  budget.close();
});
