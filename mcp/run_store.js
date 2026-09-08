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

import { randomBytes } from 'node:crypto';

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

export class RunStore {
  constructor({ ttlMs = RUN_TTL_MS, cap = RUN_CAP, now = () => Date.now() } = {}) {
    this.ttlMs = ttlMs;
    this.cap = cap;
    this.now = now;
    this.locks = new Set();
    this.map = new Map(); // opaque run_id -> record, insertion order = recency
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
    // revision to1, allowing a stale revision to name a different state.
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
  put(key, rec) {
    const previous = rec.run_id ? this.map.get(rec.run_id) : null;
    const r = {
      ...rec,
      key,
      run_id: rec.run_id || newRunId(),
      revision: (previous?.revision ?? 0) + 1,
      updated_at: this.now(),
    };
    this.map.delete(r.run_id);
    this.map.set(r.run_id, r);
    this._sweep();
    return r;
  }
  del(runId) {
    this.map.delete(runId);
  }
  size() {
    this._sweep();
    return this.map.size;
  }
}

function sameDraft(a, b) {
  return (
    Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((l, i) => l === b[i])
  );
}

// THE TOOL'S OWN REFUSALS FOR A RUN IT REMEMBERS (M-237) — the wrapper's
// `parkedRefusal` conditions, worded for any client. `null` means the call
// may proceed. `args` is the call AFTER `draft_text` became `draft` and
// BEFORE anything is carried in.
export function runRefusal(rec, args) {
  if (!rec) return null;
  if (args.run_revision == null)
    return `REFUSED: run_revision is required when continuing run_id; current revision is ${rec.revision}. Pass the revision returned with this run.`;
  if (args.run_revision !== rec.revision)
    return `REFUSED: stale run revision ${args.run_revision}; current revision is ${rec.revision}. Recover the current record before continuing.`;
  if (
    ['suspended', 'interrupted', 'uncertain_proposal'].includes(rec.status) &&
    Array.isArray(args.draft) &&
    !sameDraft(args.draft, rec.replay_draft ?? rec.draft)
  )
    return 'REFUSED: a continuation cannot replace the original replay draft. Omit draft to carry it, or use new_run with the new draft.';
  const who = typeof rec.seed === 'number' ? `seed ${rec.seed}` : 'the declared mandate';
  if (rec.status === 'parked') {
    const open = Array.isArray(rec.open) && rec.open.length ? rec.open.join(', ') : 'none';
    const tail = ` Continue it: rewrite the open line(s) (${open}) and call lyric_revise with \`run_id\` and \`draft_text\` (the full song as ONE newline-separated string) — no \`answer\`, no \`state\`. Or send \`new_run: true\` to start an independent run on the draft you hold. (run ${rec.run_id})`;
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
