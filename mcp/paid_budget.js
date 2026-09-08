// One admission ledger for both the chat model and Python kitchen model.
// Reservations are persisted BEFORE dispatch. Missing usage is held as unknown,
// never erased or billed as zero. This is a single-process service ledger;
// deploying several instances requires a transactional shared ledger instead.
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { priceFor } from './gemini_agent.js';
import { requestContext, remainingExecutionMs } from './execution_context.js';

const positive = (v, fallback) =>
  Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : fallback;
const amount = (v) => Number.isFinite(v) && v >= 0;
const tokenCount = (v) => Number.isSafeInteger(v) && v >= 0;
const validDay = (day) =>
  typeof day === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(day) &&
  Number.isFinite(Date.parse(day)) &&
  new Date(day).toISOString().slice(0, 10) === day;
const MAX_LEDGER_BYTES = 1024 * 1024;
const fail = (code, message) => Object.assign(new Error(message), { code });
const id = () => randomBytes(32).toString('hex');

// Text bytes conservatively overestimate ordinary input tokens; include protocol
// overhead. Reserve a separate full thinking allowance even when the provider
// includes thinking in maxOutputTokens. It is deliberately not a price estimate.
// Actual settlement uses all returned usage and preserves cache/total metadata.
export function requestReserveUsd({ model, inputBytes, maxOutputTokens }, pricing = priceFor) {
  const price = pricing(model);
  if (!price || !amount(price.input) || !amount(price.output)) {
    throw fail('ACCOUNTING_UNAVAILABLE', `No declared price for model ${model}.`);
  }
  if (!tokenCount(inputBytes) || !tokenCount(maxOutputTokens) || maxOutputTokens < 1) {
    throw fail(
      'ACCOUNTING_UNAVAILABLE',
      'A model request needs bounded input bytes and output tokens.'
    );
  }
  const thinking = positive(process.env.MODEL_THINKING_RESERVE_TOKENS, 65_536);
  return ((inputBytes + 1024) * price.input + (maxOutputTokens + thinking) * price.output) / 1e6;
}

export function usageUsd(usage, model, pricing = priceFor) {
  const price = pricing(model);
  if (
    !price ||
    !usage ||
    !tokenCount(usage.promptTokenCount) ||
    !tokenCount(usage.candidatesTokenCount) ||
    (usage.thoughtsTokenCount != null && !tokenCount(usage.thoughtsTokenCount)) ||
    (usage.toolUsePromptTokenCount != null && !tokenCount(usage.toolUsePromptTokenCount)) ||
    (usage.cachedContentTokenCount != null &&
      (!tokenCount(usage.cachedContentTokenCount) ||
        usage.cachedContentTokenCount > usage.promptTokenCount))
  )
    return null;
  const input = usage.promptTokenCount + (usage.toolUsePromptTokenCount || 0);
  const total = input + usage.candidatesTokenCount + (usage.thoughtsTokenCount || 0);
  // A total inconsistent with the known categories means a token population is
  // missing or the provider metadata is malformed. Keep its reservation unknown.
  if (
    usage.totalTokenCount != null &&
    (!tokenCount(usage.totalTokenCount) || usage.totalTokenCount !== total)
  )
    return null;
  return (
    (input * price.input +
      (usage.candidatesTokenCount + (usage.thoughtsTokenCount || 0)) * price.output) /
    1e6
  );
}

function atomicWrite(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const temporary = `${file}.${id()}.tmp`;
  let fd;
  let failure;
  try {
    fd = fs.openSync(temporary, 'wx', 0o600);
    fs.writeFileSync(fd, JSON.stringify(value));
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = undefined;
    fs.renameSync(temporary, file);
    const directory = fs.openSync(path.dirname(file), 'r');
    try {
      fs.fsyncSync(directory);
    } finally {
      fs.closeSync(directory);
    }
  } catch (error) {
    failure = error;
  } finally {
    try {
      if (fd !== undefined) fs.closeSync(fd);
    } catch (error) {
      failure ||= error;
    }
    try {
      fs.unlinkSync(temporary);
    } catch (error) {
      if (error.code !== 'ENOENT') failure ||= error;
    }
  }
  if (failure) throw failure;
}

export class PaidLedger {
  constructor({ file = null, now = () => new Date(), pricing = priceFor } = {}) {
    this.file = file;
    this.now = now;
    this.pricing = pricing;
    this.blocked = null;
    this.state = { version: 1, day: this.today(), usd: 0, unknownUsd: 0, reservations: {} };
    if (file) {
      try {
        let existing;
        try {
          existing = fs.lstatSync(file);
        } catch (error) {
          if (error.code !== 'ENOENT') throw error;
        }
        if (existing) {
          if (!existing.isFile() || existing.size > MAX_LEDGER_BYTES || existing.mode & 0o077) {
            throw new Error('Paid-call ledger must be a private regular file no larger than 1 MiB');
          }
          const state = JSON.parse(fs.readFileSync(file, 'utf8'));
          if (
            state.version !== 1 ||
            !validDay(state.day) ||
            !amount(state.usd) ||
            !amount(state.unknownUsd) ||
            state.unknownUsd > state.usd + 1e-12 ||
            !state.reservations ||
            typeof state.reservations !== 'object' ||
            Array.isArray(state.reservations) ||
            Object.entries(state.reservations).some(
              ([k, r]) =>
                !/^[0-9a-f]{64}$/.test(k) ||
                !amount(r.usd) ||
                typeof r.operation !== 'string' ||
                typeof r.model !== 'string'
            )
          ) {
            throw new Error('Invalid paid-call ledger');
          }
          this.state = state;
          if (state.accountingIncident) throw new Error(String(state.accountingIncident));
          // Roll before converting interrupted reservations, otherwise a
          // restart after midnight would immediately erase recovered spend.
          this.rollDay();
          // The former process cannot prove how far an admitted request got.
          // Retain the reservation as unknown spend instead of replaying it.
          const unknown = Object.values(state.reservations).reduce((sum, r) => sum + r.usd, 0);
          state.usd += unknown;
          state.unknownUsd += unknown;
          state.reservations = {};
        }
        this.rollDay();
        this.persist();
      } catch (error) {
        this.blocked = error.message;
      }
    }
  }

  today() {
    return this.now().toISOString().slice(0, 10);
  }
  persist() {
    if (!this.file) return;
    try {
      atomicWrite(this.file, this.state);
    } catch (error) {
      this.blocked = error.message;
      throw fail('ACCOUNTING_UNAVAILABLE', 'Paid-call accounting cannot be persisted.');
    }
  }
  rollDay() {
    const today = this.today();
    if (today === this.state.day) return;
    if (today < this.state.day) {
      this.blocked = 'The accounting clock moved behind its persisted day.';
      throw fail('ACCOUNTING_UNAVAILABLE', this.blocked);
    }
    // Keep outstanding reservations across midnight; the eventual request may
    // have consumed tokens on either side of that boundary.
    this.state.day = today;
    this.state.usd = 0;
    this.state.unknownUsd = 0;
    this.persist();
  }
  snapshot() {
    if (!this.blocked) this.rollDay();
    return {
      day: this.state.day,
      usd: this.state.usd,
      unknownUsd: this.state.unknownUsd,
      reservedUsd: Object.values(this.state.reservations).reduce((sum, r) => sum + r.usd, 0),
      durable: Boolean(this.file && !this.blocked),
      blocked: this.blocked,
    };
  }
  reserve(operation, request) {
    if (this.blocked)
      throw fail(
        'ACCOUNTING_UNAVAILABLE',
        'Paid-call accounting is unavailable; repair its persisted ledger before spending.'
      );
    this.rollDay();
    const usd = requestReserveUsd(request, this.pricing);
    const current = this.snapshot();
    if (operation.usd + operation.reservedUsd + usd > operation.maxUsd + 1e-12) {
      throw fail(
        'MAX_TURN_COST',
        'The remaining operation budget cannot admit another model request.'
      );
    }
    if (current.usd + current.reservedUsd + usd > operation.dailyUsd + 1e-12) {
      throw fail('DAILY_BUDGET', 'The remaining daily budget cannot admit another model request.');
    }
    const reservation = id();
    this.state.reservations[reservation] = { operation: operation.id, model: request.model, usd };
    operation.reservedUsd += usd;
    operation.pending.add(reservation);
    // Persistence failure leaves admission blocked. The caller has not sent.
    this.persist();
    return reservation;
  }
  settle(operation, reservation, { usage = null, status = 'unknown' } = {}) {
    this.rollDay();
    const held = this.state.reservations[reservation];
    if (!held || held.operation !== operation.id) {
      throw fail('ACCOUNTING_UNAVAILABLE', 'Unknown model reservation for this operation.');
    }
    if (!['success', 'rejected', 'unknown'].includes(status)) {
      throw fail('ACCOUNTING_UNAVAILABLE', 'Unknown model settlement status.');
    }
    const actual = status === 'rejected' ? 0 : usageUsd(usage, held.model, this.pricing);
    const unknown = actual === null;
    const charged = unknown ? held.usd : actual;
    delete this.state.reservations[reservation];
    operation.pending.delete(reservation);
    operation.reservedUsd = Math.max(0, operation.reservedUsd - held.usd);
    operation.usd += charged;
    this.state.usd += charged;
    if (unknown) {
      operation.unknownUsd += charged;
      this.state.unknownUsd += charged;
    }
    operation.events.push({
      reservation_id: reservation,
      model: held.model,
      status: unknown ? 'unknown' : status,
      usd: charged,
      reservedUsd: held.usd,
      usage: usage ? { ...usage } : null,
    });
    // A provider reporting beyond our conservative admission envelope is an
    // accounting incident: preserve the true cost and close further admission.
    if (!unknown && charged > held.usd + 1e-12) {
      this.blocked = 'Provider usage exceeded the reserved request envelope.';
      this.state.accountingIncident = this.blocked;
    }
    this.persist();
    return charged;
  }
}

const defaultFile =
  process.env.MODEL_SPEND_FILE ||
  (process.env.LYRIC_RUNTIME_DIR
    ? path.join(process.env.LYRIC_RUNTIME_DIR, 'model-spend.json')
    : null);
export const paidLedger = new PaidLedger({ file: defaultFile });

export function createOperationBudget({
  maxUsd = positive(process.env.CHAT_MAX_TURN_USD, 2.5),
  dailyUsd = positive(process.env.CHAT_DAILY_USD, 25),
  ledger = paidLedger,
  id: operationId = id(),
} = {}) {
  const operation = {
    id: operationId,
    maxUsd,
    dailyUsd,
    usd: 0,
    reservedUsd: 0,
    unknownUsd: 0,
    pending: new Set(),
    events: [],
  };
  if (!amount(maxUsd) || maxUsd === 0 || !amount(dailyUsd) || dailyUsd === 0) {
    throw fail('ACCOUNTING_UNAVAILABLE', 'Model budgets must be finite positive dollar values.');
  }
  let closed = false;
  return {
    id: operation.id,
    reserve(request) {
      if (closed) throw fail('ACCOUNTING_UNAVAILABLE', 'This model operation is closed.');
      return ledger.reserve(operation, request);
    },
    settle(reservation, result) {
      return ledger.settle(operation, reservation, result);
    },
    snapshot() {
      return {
        id: operation.id,
        usd: operation.usd,
        reservedUsd: operation.reservedUsd,
        unknownUsd: operation.unknownUsd,
        maxUsd,
        events: operation.events.map((e) => ({ ...e })),
      };
    },
    close() {
      if (closed) return;
      for (const reservation of [...operation.pending])
        ledger.settle(operation, reservation, { status: 'unknown' });
      closed = true;
    },
  };
}

// A Python proposer must receive admission BEFORE it sends an upstream request.
// This loopback broker uses a per-tool secret and shares the outer operation's
// ledger. It carries only counts/usage, never the lyric prompt or provider key.
export async function openKitchenBudget(context = requestContext()) {
  const budget = context.budget || createOperationBudget();
  const token = id();
  const pending = new Set();
  const reservations = new Set();
  const heldAmounts = new Map();
  const accounting = () => {
    const events = budget
      .snapshot()
      .events.filter((event) => reservations.has(event.reservation_id));
    return {
      usd: events.reduce((sum, event) => sum + event.usd, 0),
      unknownUsd: events.reduce(
        (sum, event) => sum + (event.status === 'unknown' ? event.usd : 0),
        0
      ),
      reservedUsd: [...pending].reduce((sum, reservation) => sum + heldAmounts.get(reservation), 0),
      events,
      accounting_unknown: pending.size > 0 || events.some((event) => event.status === 'unknown'),
    };
  };
  let closed = false;
  const server = createServer(async (req, res) => {
    const reply = (status, value) => {
      res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      res.end(JSON.stringify(value));
    };
    if (
      req.method !== 'POST' ||
      req.url !== '/budget' ||
      req.headers.authorization !== `Bearer ${token}`
    ) {
      req.resume();
      return reply(403, { error: 'Invalid model budget capability.' });
    }
    try {
      const chunks = [];
      let bytes = 0;
      for await (const chunk of req) {
        bytes += chunk.length;
        if (bytes > 16384) return reply(413, { error: 'Budget message too large.' });
        chunks.push(chunk);
      }
      const message = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if (message.action === 'reserve') {
        if (closed || remainingExecutionMs(context) <= 0)
          throw fail('MAX_TURN_MS', 'The kitchen deadline has expired.');
        const before = budget.snapshot().reservedUsd;
        const reservation = budget.reserve(message);
        heldAmounts.set(reservation, Math.max(0, budget.snapshot().reservedUsd - before));
        pending.add(reservation);
        reservations.add(reservation);
        // This callback is synchronous durable receipt storage. Python cannot
        // dispatch until this broker returns its reservation capability, so a
        // process death cannot hide admission in an unread stdout pipe.
        try {
          context.onProposerUsage?.({
            source: 'budget_broker',
            status: 'admitted',
            in_flight: true,
            reservation_id: reservation,
            model: message.model,
          });
        } catch {
          throw fail('ACCOUNTING_UNAVAILABLE', 'Kitchen admission receipt cannot be persisted.');
        }
        reply(200, { reservation_id: reservation });
      } else if (message.action === 'settle') {
        if (!pending.has(message.reservation_id))
          throw fail('ACCOUNTING_UNAVAILABLE', 'Reservation does not belong to this kitchen call.');
        const usd = budget.settle(message.reservation_id, message);
        pending.delete(message.reservation_id);
        const settlement = accounting().events.find(
          (event) => event.reservation_id === message.reservation_id
        );
        try {
          context.onProposerUsage?.({
            source: 'budget_broker',
            status: 'settled',
            in_flight: false,
            reservation_id: message.reservation_id,
            settlement: settlement.status,
            accounting_unknown: settlement.status === 'unknown',
            usd,
            usage: message.usage ?? null,
          });
        } catch {
          throw fail('ACCOUNTING_UNAVAILABLE', 'Kitchen settlement receipt cannot be persisted.');
        }
        reply(200, {
          usd,
          status: settlement.status,
          accounting_unknown: settlement.status === 'unknown',
        });
      } else reply(400, { error: 'Unknown budget action.' });
    } catch (error) {
      reply(error.code === 'ACCOUNTING_UNAVAILABLE' ? 503 : 429, {
        error: error.message,
        code: error.code || 'BAD_REQUEST',
      });
    }
  });
  server.requestTimeout = 5000;
  server.headersTimeout = 5000;
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  server.unref();
  return {
    env: {
      LYRIC_BUDGET_URL: `http://127.0.0.1:${server.address().port}/budget`,
      LYRIC_BUDGET_TOKEN: token,
    },
    budget,
    accounting,
    async close() {
      if (closed) return;
      closed = true;
      try {
        for (const reservation of pending) budget.settle(reservation, { status: 'unknown' });
        pending.clear();
        if (!context.budget) budget.close();
      } finally {
        server.closeAllConnections();
        await new Promise((resolve) => server.close(resolve));
      }
    },
  };
}
