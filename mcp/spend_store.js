// Durable legacy chat turn counters. Configured persistence fails closed:
// unreadable/corrupt state never restores a fresh day's allowance. The shared
// paid ledger separately meters chat and kitchen dollars across both surfaces.
import fs from 'node:fs';
import path from 'node:path';
import { atomicPrivateWrite } from './job_store.js';

const EMPTY = { day: null, usd: 0, turns: 0 };
const validDay = (day) =>
  typeof day === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(day) &&
  Number.isFinite(Date.parse(day)) &&
  new Date(day).toISOString().slice(0, 10) === day;

export class SpendStore {
  constructor(file, { log = console.error } = {}) {
    this.file = file || null;
    this.log = log;
    this.durable = false;
    this.healthy = true;
    this.error = null;
    this.state = { ...EMPTY };
    this.startedAt = null;
    if (!this.file) return;
    try {
      this.state = this.readOrEmpty();
      atomicPrivateWrite(this.file, JSON.stringify(this.state));
      this.durable = true;
    } catch (err) {
      this.fail(err);
      // Keep the paid surface closed even for a caller that still reads only
      // the historic counters rather than the explicit health flag.
      this.state = { day: null, usd: Infinity, turns: Number.MAX_SAFE_INTEGER };
    }
  }

  fail(err) {
    this.healthy = false;
    this.durable = false;
    this.error = err.code || err.message;
    this.log(
      `[chat] spend persistence unavailable (${this.error}); paid chat is disabled until repaired.`
    );
  }

  assertHealthy() {
    if (!this.healthy)
      throw Object.assign(
        new Error('Chat spend persistence is unavailable; paid chat is disabled.'),
        { status: 503 }
      );
  }

  readOrEmpty() {
    let text;
    try {
      const stat = fs.lstatSync(this.file);
      if (!stat.isFile() || stat.size > 4096)
        throw new Error('spend state must be a bounded regular file');
      text = fs.readFileSync(this.file, 'utf8');
    } catch (err) {
      if (err.code === 'ENOENT') return { ...EMPTY };
      throw err;
    }
    const raw = JSON.parse(text);
    if (
      !raw ||
      (raw.day !== null && !validDay(raw.day)) ||
      !Number.isFinite(raw.usd) ||
      raw.usd < 0 ||
      !Number.isSafeInteger(raw.turns) ||
      raw.turns < 0 ||
      (raw.day === null && (raw.usd !== 0 || raw.turns !== 0))
    ) {
      throw new Error('invalid spend counters');
    }
    return { day: raw.day, usd: raw.usd, turns: raw.turns };
  }

  load() {
    return this.state;
  }

  save() {
    this.assertHealthy();
    if (!this.file) return;
    try {
      atomicPrivateWrite(this.file, JSON.stringify(this.state));
    } catch (err) {
      this.fail(err);
      this.assertHealthy();
    }
  }

  rollDay(today) {
    this.assertHealthy();
    if (this.state.day === today) return false;
    if (!validDay(today)) throw new Error('Invalid UTC date');
    // Do not refund a day because the wall clock temporarily stepped backward.
    if (this.state.day !== null && today < this.state.day) return false;
    this.state.day = today;
    this.state.usd = 0;
    this.state.turns = 0;
    this.save();
    return true;
  }
}

export function createSpendStore(env = process.env, opts = {}) {
  const file =
    env.CHAT_SPEND_FILE ||
    (env.LYRIC_RUNTIME_DIR && path.join(env.LYRIC_RUNTIME_DIR, 'chat-spend.json'));
  return new SpendStore(file || null, opts);
}
