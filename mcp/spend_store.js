// spend_store.js — make the daily spend cap survive a restart, IF the deployment
// has anywhere to put it.
//
// THE PROBLEM (audit F128). The counter behind CHAT_DAILY_USD lived in a plain
// object in the request handler's closure. render.yaml sets autoDeploy: true, so
// every push to main restarts the service and zeroed it: "$2 per UTC day" was
// really "$2 per uptime period", and nothing anywhere said so.
//
// WHAT IS AND IS NOT AVAILABLE. render.yaml declares no `disk:` and the
// Dockerfile declares no VOLUME, so this deployment has no persistent storage
// today. Writing to the container filesystem anyway would be theatre: Render
// rebuilds the container on deploy, which is the reset vector that matters. So
// persistence is OPT-IN and off by default, and the service says which mode it
// is in rather than implying the stronger one.
//
//   CHAT_SPEND_FILE unset (today)  → in-memory. Cap resets on restart. Reported.
//   CHAT_SPEND_FILE=/data/spend.json, with a Render disk mounted at /data
//                                  → survives restart and deploy. Reported.
//
// This is deliberately not a "best effort, might work" design. A cap either
// survives a restart or it does not, and the caller is told which — an operator
// reading /chat/status should not have to guess whether the number in front of
// them is the day's total or this process's share of it.
//
// FAIL OPEN, ON PURPOSE. Every failure here — unreadable file, malformed JSON,
// unwritable directory — degrades to in-memory and logs once. The alternative is
// a chat endpoint that 500s because a disk is full, which trades a money risk
// for an availability risk without being asked to. The money risk is already
// bounded by CHAT_MAX_TURN_USD and the per-IP limiters, neither of which depends
// on this file.
import fs from 'node:fs';
import path from 'node:path';

const EMPTY = { day: null, usd: 0, turns: 0 };

export class SpendStore {
  // `file` is the resolved CHAT_SPEND_FILE, or null/'' for in-memory.
  constructor(file, { log = console.error } = {}) {
    this.file = file || null;
    this.log = log;
    this.durable = false;
    this.state = { ...EMPTY };
    this.startedAt = null; // set by the caller's clock; see note in load()
    if (!this.file) return;
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      // Read the previous process's counters HERE, not on a later load() call.
      // Leaving `state` empty until someone remembers to call load() is a trap:
      // it reads as a working store whose numbers happen to be zero, which is
      // indistinguishable from the bug this file exists to fix. (Caught by the
      // restart test, which saw 0/0/null where it had just written 1.75/9.)
      this.state = this.readOrEmpty();
      // Prove writability NOW rather than discovering it on the first turn that
      // needed recording. A store that reports durable and then silently stops
      // writing is worse than one that never claimed it.
      fs.writeFileSync(this.file, JSON.stringify(this.state));
      this.durable = true;
    } catch (err) {
      this.log(
        `[chat] spend file "${this.file}" is not usable (${err.code || err.message}); ` +
          'falling back to an in-memory counter. The daily cap will reset on restart.'
      );
      this.file = null;
    }
  }

  readOrEmpty() {
    try {
      const raw = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      // Validate rather than trust: this file is the only input that can RAISE
      // the remaining budget, so a malformed or hostile value must not widen the
      // cap. Anything that is not a finite non-negative number resets to zero,
      // which is the safe direction.
      const num = (v) => (Number.isFinite(v) && v >= 0 ? v : 0);
      return {
        day: typeof raw.day === 'string' ? raw.day : null,
        usd: num(raw.usd),
        turns: num(raw.turns),
      };
    } catch {
      return { ...EMPTY };
    }
  }

  // The constructor has already read the file; this just hands back the object
  // the caller should mutate in place, so `spend` and `store.state` stay the
  // same reference and a save() cannot silently persist a stale copy.
  load() {
    return this.state;
  }

  // Called after every accounted turn. Synchronous on purpose: the write is a
  // few dozen bytes, and an async write is a window in which a crash loses the
  // turn that just spent money.
  save() {
    if (!this.file) return;
    try {
      fs.writeFileSync(this.file, JSON.stringify(this.state));
    } catch (err) {
      this.log(
        `[chat] could not persist spend to "${this.file}" (${err.code || err.message}); ` +
          'the cap is in-memory from here.'
      );
      this.file = null;
      this.durable = false;
    }
  }

  // Zero the counters when the UTC date changes. Returns true if it rolled.
  rollDay(today) {
    if (this.state.day === today) return false;
    this.state.day = today;
    this.state.usd = 0;
    this.state.turns = 0;
    this.save();
    return true;
  }
}

export function createSpendStore(env = process.env, opts = {}) {
  return new SpendStore(env.CHAT_SPEND_FILE || null, opts);
}
