// run_store.js — THE RUN RECORD, KEPT BY THE TOOLS (M-237).
//
// The Gemini wrapper (gemini_agent.js) carried a lyric_revise run between
// turns — its state, its draft, its declarations, whether it was parked —
// and refused calls that wandered off it (M-183, M-221, M-229, M-232). That
// layer sits between the battery and Gemini and no other client reaches it:
// a Claude session through the connector, or a person, saw the tool with no
// memory of the last call. This module is the same record, one layer down,
// so the tool itself remembers the run. A run is a bearer capability, not
// a seed: two callers choosing the same musical declaration own independent
// records. Only the opaque run_id can retrieve a cached record.
//
// THE RECORD IS A CACHE of a file the tool already returns verbatim in
// `state`: a restart, the TTL or the cap forgets it, and a client that
// passes `state` back loses nothing. Losing it is disclosed (`run_carried`
// false on a fresh stamp), never silently restarted.

import { createHash, randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const RUN_TTL_MS = 6 * 60 * 60 * 1000;
export const RUN_CAP = 64;

// The fields that are a call's ANSWER to a run, never its declaration —
// the wrapper's RUN_ANSWER_FIELDS plus the tool-only ones.
export const RUN_ANSWER_FIELDS = new Set([
  'draft',
  'draft_text',
  'answer',
  // M-249 (round 24): `answers` (M-248) is an ANSWER, not a declaration, and
  // it was missing here — so the tool stored one call's answers as the run's
  // declarations and M-237's moved-declaration guard refused the NEXT answer
  // by name ("the run says [...], this call says [...]"). Measured on round
  // 24 turn 0: two calls burned on a guard firing at the thing it exists to
  // let through.
  'answers',
  'state',
  'checkpoint',
  'run_id',
  'run_revision',
  'new_run',
]);

// Musical declaration identity, retained as metadata for mismatch checks.
// It is deliberately NOT the cache key: independent runs can share it.
export function runKeyOf(args) {
  if (typeof args?.seed === 'number') return `seed:${args.seed}`;
  const hasMandate =
    (args?.scheme != null && args.scheme !== '') ||
    (args?.groups != null && args.groups !== '') ||
    (args?.returns != null && args.returns !== '');
  if (!hasMandate) return null;
  return (
    'mandate:' +
    JSON.stringify([
      args.scheme ?? null,
      args.groups ?? null,
      args.returns ?? null,
      args.relation ?? null,
      args.structures ?? null,
    ])
  );
}

export function declarationsOf(args) {
  const out = {
    writer: args?.writer ?? 'interview',
    form: args?.form ?? 'verse-chorus',
    voices: args?.voices ?? false,
  };
  for (const [k, v] of Object.entries(args || {}))
    if (!RUN_ANSWER_FIELDS.has(k) && v !== undefined) out[k] = v;
  return out;
}

export function newRunId(_key, rand = () => randomBytes(32).toString('hex')) {
  return `run_${rand()}`;
}

// THE RUN LEDGER: every run's latest revision, and whether it finished,
// kept past the record itself. The record above is a cache that a clean
// finish deletes and a restart loses; with nothing left to compare, a stale
// continuation (an older signed /chat envelope sent with a fresh request_id)
// passed as a fork and the website writer was paid again for prompts the run
// had already answered (BB8, #519 6391205136). The ledger keeps only a digest
// of each run_id, its revision and a finished flag, so it can refuse a
// revision that is behind, or a run that finished, before any work starts —
// LYRICS_RUNTIME.md's "a stale revision refuses before work starts". It is
// durable when LYRIC_RUNTIME_DIR names a disk (RUN_LEDGER_FILE overrides),
// and otherwise covers the life of the process.
//
// It also keeps a digest of every continuation wire (a state or checkpoint)
// a run has moved past, or finished on. A call that carries such a wire is
// refused whether or not it names its run_id (Jony's review: a stale state
// sent without run_id still ran as a new run, and the /chat checkpoint
// recovery carries no run_id at all). A wire the run is still on (a repeated
// question) is not moved past, so it stays usable.
export const LEDGER_RETAIN_MS = 30 * 24 * 60 * 60 * 1000;
export const LEDGER_CAP = 5000;
// Runs on the paid writer (the website chat's kitchen) are kept apart: free
// calls cannot push them out of the cap (BB8's R3), and they do not age out,
// because a signed /chat envelope does not expire. Their cap is count only.
export const LEDGER_PAID_CAP = 20000;
const digest = (runId) => createHash('sha256').update(String(runId)).digest('hex').slice(0, 32);
const RUN_ENTRY = (v) =>
  Array.isArray(v) &&
  Number.isSafeInteger(v[0]) &&
  v[0] > 0 &&
  (v[1] === 0 || v[1] === 1) &&
  Number.isFinite(v[2]);

export class RunLedger {
  constructor(file = null, { now = () => Date.now(), log = console.error } = {}) {
    this.file = file;
    this.now = now;
    this.log = log;
    // digest -> [revision, finished 0|1, updated_at]; free and paid apart.
    this.runs = new Map();
    this.paidRuns = new Map();
    // wire digest -> updated_at; free and paid apart.
    this.used = new Map();
    this.paidUsed = new Map();
    // Fails closed (3PO, BB8 N3): a ledger that cannot be read or saved
    // cannot tell a stale continuation from a live one, so while it is
    // unhealthy every continuation is refused (lyric_tools) — as unreadable
    // spend persistence closes paid chat. A fresh run is unaffected.
    this.healthy = true;
    this.error = null;
    // A file that failed to load is never written over (BB8's R1): saving the
    // empty in-memory ledger would replace the unreadable history with a
    // readable empty one, and after a restart every older continuation it
    // covered would pass.
    this.loadFailed = false;
    if (!file) return;
    // A temp file left by a kill between write and rename is never read.
    try {
      const base = path.basename(file) + '.';
      for (const name of fs.readdirSync(path.dirname(file)))
        if (name.startsWith(base) && name.endsWith('.tmp'))
          fs.rmSync(path.join(path.dirname(file), name), { force: true });
    } catch {}
    try {
      const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (!raw || typeof raw !== 'object') throw new Error('ledger is not an object');
      for (const [key, map] of [
        ['used', this.used],
        ['paid_used', this.paidUsed],
      ])
        for (const [k, t] of Object.entries(raw[key] || {}))
          if (/^[0-9a-f]{32}$/.test(k) && Number.isFinite(t)) map.set(k, t);
      for (const [key, map] of [
        ['runs', this.runs],
        ['paid_runs', this.paidRuns],
      ])
        for (const [k, v] of Object.entries(raw[key] || {}))
          if (/^[0-9a-f]{32}$/.test(k) && RUN_ENTRY(v)) map.set(k, v);
    } catch (err) {
      if (err.code !== 'ENOENT') {
        this.loadFailed = true;
        this.fail(err, 'unreadable');
      }
    }
  }
  // While a save is failing nothing new is written (every continuation is
  // refused before work), so the check itself retries one durable save of
  // the in-memory ledger; only that write's success makes it healthy again.
  recover() {
    if (!this.healthy && this.file && !this.loadFailed) this.save();
    return this.healthy;
  }
  fail(err, what) {
    this.healthy = false;
    this.error = err.code || err.message;
    this.log(
      `[runs] ledger ${what} (${this.error}); continuations are refused until it is repaired.`
    );
  }
  // The furthest a run has got in either partition (BB8's N4: a run's paid
  // and free entries can both exist; the larger revision is its latest).
  entry(k) {
    const a = this.paidRuns.get(k),
      b = this.runs.get(k);
    if (!a || !b) return a || b;
    return [Math.max(a[0], b[0]), a[1] === 1 || b[1] === 1 ? 1 : 0, Math.max(a[2], b[2])];
  }
  get(runId) {
    const v = this.entry(digest(runId));
    return v ? { revision: v[0], finished: v[1] === 1 } : null;
  }
  // True when any of these wire keys is one a run has already moved past.
  isUsed(keys) {
    return keys.some(
      (w) => typeof w === 'string' && (this.paidUsed.has(digest(w)) || this.used.has(digest(w)))
    );
  }
  // runId may be null: a call with no run record still uses up its wires.
  mark(runId, revision, finished = false, usedKeys = [], { paid = false } = {}) {
    const t = this.now();
    const runs = paid ? this.paidRuns : this.runs;
    const used = paid ? this.paidUsed : this.used;
    if (runId) {
      const k = digest(runId);
      const was = this.entry(k);
      // A revision only moves forward, and a finished run stays finished.
      const v = [Math.max(revision, was?.[0] ?? 0), finished || was?.[1] === 1 ? 1 : 0, t];
      runs.delete(k);
      runs.set(k, v);
    }
    for (const w of usedKeys)
      if (typeof w === 'string') {
        used.delete(digest(w));
        used.set(digest(w), t);
      }
    const cutoff = t - LEDGER_RETAIN_MS;
    for (const map of [this.runs, this.used])
      for (const [key, val] of map) {
        if ((Array.isArray(val) ? val[2] : val) >= cutoff && map.size <= LEDGER_CAP) break;
        map.delete(key);
      }
    for (const map of [this.paidRuns, this.paidUsed])
      for (const key of map.keys()) {
        if (map.size <= LEDGER_PAID_CAP) break;
        map.delete(key);
      }
    this.save();
  }
  save() {
    if (!this.file || this.loadFailed) return;
    const temp = `${this.file}.${randomBytes(8).toString('hex')}.tmp`;
    const dir = path.dirname(this.file);
    try {
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
      const body = JSON.stringify({
        version: 2,
        runs: Object.fromEntries(this.runs),
        used: Object.fromEntries(this.used),
        paid_runs: Object.fromEntries(this.paidRuns),
        paid_used: Object.fromEntries(this.paidUsed),
      });
      // Replaced atomically after a file and a directory fsync, as the other
      // runtime files are (LYRICS_RUNTIME.md): the guard is only as good as
      // the newest ledger that survives a power loss.
      const fd = fs.openSync(temp, 'wx', 0o600);
      try {
        fs.writeFileSync(fd, body);
        fs.fsyncSync(fd);
      } finally {
        fs.closeSync(fd);
      }
      fs.renameSync(temp, this.file);
      const dfd = fs.openSync(dir, 'r');
      try {
        fs.fsyncSync(dfd);
      } finally {
        fs.closeSync(dfd);
      }
      // RECOVERED BY A DURABLE WRITE (BB8 A2, #519). A save that failed (a
      // full disk, an I/O error) left the ledger unhealthy for the life of
      // the process, though the in-memory ledger was intact and the next
      // write could succeed: every continuation was refused until a restart.
      // The whole ledger just reached the disk, file and directory both
      // synced, so it is current again. A file that failed to LOAD never
      // gets here (the guard above): it stays refused until repaired.
      if (!this.healthy) {
        this.healthy = true;
        this.error = null;
        this.log('[runs] ledger saved again; continuations are checked against it once more.');
      }
    } catch (err) {
      try {
        fs.rmSync(temp, { force: true });
      } catch {}
      this.fail(err, 'not saved');
    }
  }
}

export function createRunLedger(env = process.env, opts = {}) {
  const file =
    env.RUN_LEDGER_FILE ||
    (env.LYRIC_RUNTIME_DIR && path.join(env.LYRIC_RUNTIME_DIR, 'run-ledger.json'));
  return new RunLedger(file || null, opts);
}

export class RunStore {
  constructor({
    ttlMs = RUN_TTL_MS,
    cap = RUN_CAP,
    now = () => Date.now(),
    ledger = new RunLedger(null, { now }),
    // How a continuation wire is identified in the ledger: by its content,
    // not its bytes, so a re-spaced or re-encoded copy of a moved-past wire
    // is still that wire (BB8's R2). lyric_tools passes the decoder.
    wireKey = (w) => w,
  } = {}) {
    this.ttlMs = ttlMs;
    this.cap = cap;
    this.now = now;
    this.ledger = ledger;
    this.wireKey = (w) => (typeof w === 'string' ? wireKey(w) : null);
    this.locks = new Set();
    this.map = new Map(); // opaque run_id -> record, insertion order = recency
  }
  // What the ledger knows of a run this store no longer holds (or null).
  mark(runId) {
    return runId ? this.ledger.get(runId) : null;
  }
  // True when a continuation wire this call carries was already moved past.
  used(wires) {
    return this.ledger.isUsed(wires.map(this.wireKey));
  }
  get ledgerHealthy() {
    if (this.ledger.healthy === false && typeof this.ledger.recover === 'function')
      return this.ledger.recover();
    return this.ledger.healthy !== false;
  }
  acquire(runId) {
    if (!runId) return () => {};
    if (this.locks.has(runId)) return null;
    this.locks.add(runId);
    let released = false;
    return () => {
      if (!released) {
        released = true;
        this.locks.delete(runId);
      }
    };
  }
  _sweep() {
    const t = this.now();
    // An active operation owns both the record and its revision until its
    // final write. Evicting that record mid-call makes put() reset the
    // revision to 1, allowing a stale revision to name a different state.
    for (const [k, r] of this.map)
      if (!this.locks.has(k) && t - r.updated_at > this.ttlMs) this.map.delete(k);
    for (const k of this.map.keys()) {
      if (this.map.size <= this.cap) break;
      if (!this.locks.has(k)) this.map.delete(k);
    }
  }
  get(runId) {
    this._sweep();
    const r = this.map.get(runId);
    if (!r) return null;
    // touch: re-insert so the least recently used is first out
    this.map.delete(runId);
    this.map.set(runId, r);
    return r;
  }
  byId(runId) {
    return this.get(runId);
  }
  // The run whose LATEST state is exactly this wire. The connector writes a
  // digest of the run's id into every state it encodes, so two runs never
  // share a state and an exact match names one run; an older state (a retry
  // or a fork) matches none. Holding the latest state is already the whole
  // continuation, so this grants its holder nothing the state did not.
  byState(wire) {
    this._sweep();
    if (typeof wire !== 'string') return null;
    for (const r of this.map.values()) if (r.state === wire) return this.get(r.run_id);
    return null;
  }
  // `inputs`: the state/checkpoint wires the call continued from; each one
  // this record moves past is recorded as used.
  put(key, rec, inputs = [], { paid = false } = {}) {
    const previous = rec.run_id ? this.map.get(rec.run_id) : null;
    const r = {
      ...rec,
      key,
      run_id: rec.run_id || newRunId(),
      // After a restart or an eviction the record is gone but the ledger is
      // not: the revision continues from it, never back to 1.
      revision:
        Math.max(
          previous?.revision ?? 0,
          rec.run_id ? (this.ledger.get(rec.run_id)?.revision ?? 0) : 0
        ) + 1,
      updated_at: this.now(),
    };
    this.map.delete(r.run_id);
    this.map.set(r.run_id, r);
    const held = new Set([r.state, r.checkpoint].map(this.wireKey));
    this.ledger.mark(
      r.run_id,
      r.revision,
      false,
      inputs.map(this.wireKey).filter((k) => k != null && !held.has(k)),
      { paid }
    );
    this._sweep();
    return r;
  }
  // A clean finish: the record goes, the ledger remembers it finished and
  // that the wires it finished on are used. runId may be null (no record).
  finish(runId, inputs = [], { paid = false } = {}) {
    const revision = runId
      ? (this.map.get(runId)?.revision ?? this.ledger.get(runId)?.revision)
      : null;
    this.ledger.mark(revision ? runId : null, revision ?? 0, true, inputs.map(this.wireKey), {
      paid,
    });
    if (runId) this.map.delete(runId);
  }
  del(runId) {
    this.map.delete(runId);
  }
  size() {
    this._sweep();
    return this.map.size;
  }
}

// A run_id this store no longer holds, judged by the ledger. Unknown to the
// ledger too (never seen, or past its retention), the call proceeds as before
// on the state it carries.
function ledgerRefusal(mark, args) {
  if (!mark || args.new_run) return null;
  if (mark.finished)
    return `REFUSED: run ${args.run_id} already finished at revision ${mark.revision}; nothing was run. Its final_draft is the finished song. To revise that song again, send new_run: true with its draft — an independent run.`;
  if (args.run_revision == null)
    return `REFUSED: run_revision is required when continuing run_id; current revision is ${mark.revision}. Pass the revision returned with this run.`;
  if (args.run_revision !== mark.revision)
    return `REFUSED: stale run revision ${args.run_revision}; current revision is ${mark.revision}. Nothing was run. ${USED_TAIL}`;
  return null;
}

// What to do when the continuation held is not the run's latest. "Behind"
// and "never delivered" look the same from here: a call interrupted after
// the run advanced but before its result was recorded leaves the caller
// holding the older one, and recover_only reads its accepted lyrics.
const USED_TAIL =
  'Continue from the latest result of this run. If that result never reached you (an interrupted call), lyric_revise with recover_only returns the accepted lyrics from what you hold; then send new_run: true with that draft to go on as an independent run.';
export const LEDGER_UNAVAILABLE_REFUSAL =
  'RUN_LEDGER_UNAVAILABLE: the run ledger cannot be read or saved on this server, so a continuation cannot be checked against what its run already did. Nothing was run, and nothing this call can send repairs it: the server operator must restore a readable ledger. Meanwhile lyric_revise with recover_only still returns the accepted lyrics from what you hold, and new_run: true with a draft starts an independent run.';
export const USED_WIRE_REFUSAL = `REFUSED: this state or checkpoint was already continued — its run moved past it or finished. Nothing was run. ${USED_TAIL}`;

function sameDraft(a, b) {
  return (
    Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((l, i) => l === b[i])
  );
}

// THE TOOL'S OWN REFUSALS FOR A RUN IT REMEMBERS (M-237) — the wrapper's
// `parkedRefusal` conditions, worded for any client. `null` means the call
// may proceed. `args` is the call AFTER `draft_text` became `draft` and
// BEFORE anything is carried in.
export function runRefusal(rec, args, mark = null) {
  if (!rec) return ledgerRefusal(mark, args);
  if (args.run_revision == null)
    return `REFUSED: run_revision is required when continuing run_id; current revision is ${rec.revision}. Pass the revision returned with this run.`;
  if (args.run_revision !== rec.revision)
    return `REFUSED: stale run revision ${args.run_revision}; current revision is ${rec.revision}. Recover the current record before continuing.`;
  for (const field of ['state', 'checkpoint'])
    if (
      ['suspended', 'interrupted', 'uncertain_proposal'].includes(rec.status) &&
      args[field] != null &&
      args[field] !== rec[field]
    )
      return `REFUSED: continuation mismatch: ${field} does not belong to run revision ${rec.revision}. Pass the state/checkpoint returned with that revision verbatim, or omit it to carry the cached continuation. Standalone state recovery remains available without run_id.`;
  if (
    ['suspended', 'interrupted', 'uncertain_proposal'].includes(rec.status) &&
    Array.isArray(args.draft) &&
    !sameDraft(args.draft, rec.replay_draft ?? rec.draft)
  )
    return 'REFUSED: a continuation cannot replace the original replay draft. Omit draft to carry it, or use new_run with the new draft.';
  const who = typeof rec.seed === 'number' ? `seed ${rec.seed}` : 'the declared mandate';
  if (rec.status === 'uncertified')
    return `REFUSED by the tool: the lyric_revise run for ${who} is UNCERTIFIED at exit 2 (no question pending). Coverage remains unresolved: ${(rec.refused_obligations || []).join(', ') || 'see the returned coverage record'}. Keep the returned final_draft. Inspect lyric_grade pronunciation options and explicitly declare any pronunciation you can establish, regrade, then send new_run:true with that draft and those declarations. Do not guess a reading to obtain certification.`;
  if (rec.status === 'parked') {
    const open = Array.isArray(rec.open) && rec.open.length ? rec.open.join(', ') : 'none';
    const tail = ` Continue it: rewrite the open line(s) (${open}) and call lyric_revise with \`run_id\`, \`run_revision\` ${rec.revision} and \`draft_text\` (the full song as ONE newline-separated string) — no \`answer\`, no \`state\`. Or send \`new_run: true\` to start an independent run on the draft you hold. (run ${rec.run_id})`;
    const head = `REFUSED by the tool: the lyric_revise run for ${who} is PARKED at exit 3 (no question pending)`;
    if (
      args.answer != null ||
      args.answers != null ||
      args.state != null ||
      args.checkpoint != null
    )
      return `${head}, and this call sends \`answer\`/\`state\` — there is no question to answer.${tail}`;
    if (!Array.isArray(args.draft))
      return `${head}, and this call omits the draft — a parked run is continued by a REWRITTEN draft, which only you can write.${tail}`;
    if (sameDraft(args.draft, rec.draft))
      return `${head}, and this call re-sends the SAME draft that parked — the loop is deterministic and would park again on the same lines.${tail}`;
  }
  return null;
}

// A DECLARATION THAT MOVED MID-RUN IS REFUSED, NOT REPLACED (M-237; the
// wrapper replaces for Gemini, M-229). A person who typed it meant it; the
// tool names both values and the two ways out. An OMITTED declaration is
// carried from the record (the plan is a function of all of them).
export function movedDeclarations(recDecl, args) {
  const moved = [];
  for (const [k, value] of Object.entries(args || {})) {
    if (RUN_ANSWER_FIELDS.has(k) || value === undefined) continue;
    const v = recDecl?.[k];
    if (JSON.stringify(value) !== JSON.stringify(v))
      moved.push({ field: k, run: v ?? null, call: value });
  }
  return moved;
}

export function movedRefusal(rec, moved) {
  const who = typeof rec.seed === 'number' ? `seed ${rec.seed}` : 'the declared mandate';
  const list = moved
    .map(
      (m) =>
        `${m.field}: the run says ${JSON.stringify(m.run)}, this call says ${JSON.stringify(m.call)}`
    )
    .join('; ');
  return (
    `REFUSED by the tool: the lyric_revise run for ${who} (run ${rec.run_id}) was opened under declarations this call moves — ${list}. ` +
    "A plan is a function of every declaration, so a moved one is a different song the run's draft and answers cannot be graded against. " +
    "Send the run's declarations (or omit them — they are carried), or send `new_run: true` to open a fresh run on the draft you hold."
  );
}
