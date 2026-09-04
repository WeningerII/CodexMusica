// lyric_tools.js — the lyric harness as MCP tools: a DISJOINT family.
//
// STANDING RULE 1 OF lyric-harness/CLAUDE.md, HONORED IN THE ARCHITECTURE:
// the recipe engine and the lyrics do not touch. This module imports nothing
// from engine.js or schemas.js, shares no state with the workspace, and runs
// every call as its own short-lived python3 subprocess over the CLI —
// `lyric_harness.py` is the tested entrance (50-suite CI pool), and the
// connector exposes ONLY real entrances (standing rule 3, 2026-08-18: no
// private instruments). No re-implementation of any judgement lives here; a
// tool's answer is the verb's own report, verbatim.
//
// The intended order is PLAN -> WRITE -> REVISE and the writer is OUTSIDE
// the harness: these tools plan shapes and grade words; they never write
// words. Both chat postures land on the same calls — a model writing to a
// brief, or a human pasting lyrics — because the graders do not care where
// a draft came from.
//
// OPERATIONAL SHAPE. Stateless: a plan is a pure function of its seed, so
// grading re-derives it (seed + draft in, verdict out) and nothing is held
// server-side — the same no-handle promise the recipe tools keep. Serial: a
// module-level queue runs ONE python at a time, because each call loads the
// pronunciation lexicon (~10s, a few hundred MB) and the deploy target is a
// small instance; a burst must queue, not OOM. Bounded: every input has a
// ceiling (the same DoS arithmetic schemas.js records for the recipe side).
// Argv-safe: word-like inputs are charset-validated and may not begin with
// "-"; line text never reaches argv — it travels by temp file, deleted in
// finally.

import { execFile, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { TOOL_BUDGET_MS } from './budget.js';
import {
  RunStore,
  runKeyOf,
  declarationsOf,
  newRunId,
  runRefusal,
  movedDeclarations,
  movedRefusal,
} from './run_store.js';

const HARNESS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'lyric-harness');
const PYTHON = process.env.LYRIC_PYTHON || 'python3';

// ── ceilings (every one refused loudly, none silently clamped) ─────────────
const MAX_WORDS = 12;
const MAX_WORD_CHARS = 40;
const MAX_LINES = 64; // the planner envelope's own total_lines ceiling
const MAX_LINE_CHARS = 200;
// THE MANDATE CEILING IS SIZED TO THE RECOVER DOOR'S OWN OUTPUT (M-195,
// repinned 2026-09-02 from ~~400~~). A pasted song's mandate is what
// `lyric_recover` hands back, and that cover is every admitted pair over
// every searched place, so it grows with the SQUARE of the line count:
// MEASURED at the default four places, 4,132 chars over 19 lines, 5,299
// over 25, 10,009 over 32 (670 pair-groups) — every one of them refused by
// the old 400, so the prescribed route recover -> check -> revise could not
// chain past a few lines. Extrapolated to MAX_LINES (64) that is ~40k; the
// kernel's per-argument ceiling is 128 KiB. Half of that is the bound, and
// it is still a bound (a runaway is refused, never clamped).
const MAX_MANDATE_CHARS = 65536;
// THE SWEEP WINDOW, DERIVED AGAINST THE TIGHTER OF THE TWO CLOCKS. This
// connector kills a subprocess at SUBPROCESS_TIMEOUT_MS but the MCP
// SDK's own DEFAULT_REQUEST_TIMEOUT_MSEC is 60_000, nothing here emits the
// progress notifications that would reset it, and a cancelled request does
// NOT free the serial python queue -- so the client gives up first and the
// box stays blocked. 60s is the budget, not the subprocess kill's; deriving
// against the looser clock is the flattering direction.
//
// Budget = 60s minus the lexicon load this connector already declares on the
// deploy target (~10s) = 50s of planning. MEASURED here, warm: 128 seeds in
// 4.2s and 512 in 15.1s, i.e. ~1.5s fixed and ~28.5ms marginal per seed. 512
// seeds is 14.6s of planning, which absorbs a deploy box ~3.4x slower than
// this one before the client's clock runs out.
//
// AND THE BOUND IS PAGINATION, NOT TRUNCATION, because a plan is a pure
// function of its seed: sweep(1..900) is exactly sweep(1..512) union
// sweep(512..900) and the three counts add. The two acceptance rates this
// repo has actually banked are 23/899 (stay_awake) and 6/699
// (carry_it_over); at the HARDER of those, 0.86%, a 512-seed window holds at
// least one acceptance 98.8% of the time, so one call usually answers.
const MAX_SWEEP_SEEDS = 512;
const MAX_WANTS = 13; // = |SWEEP_MEASURES| + |SWEEP_SETS| + |SWEEP_ORDERS|
const MAX_WANT_CHARS = 80;
// lyric_revise: one answer may carry a whole tier-2 group (one `L<n>:` line
// per member), so its ceiling is a group's worth of MAX_LINE_CHARS lines
// with markers, not one line's. The state blob is the harness's own
// deferred-run record; its bulk is `pending.prompt` — the writer's FULL
// brief, whole-draft findings included — MEASURED at 262KB on a 23-line
// filler draft's first question, so the cap is 2 MiB: an order of
// magnitude over the measured case, still bounding what a client can make
// this server re-parse. The answered records themselves are small (the
// fold keeps the record, never the prompt).
const MAX_ANSWER_CHARS = 4000;
const MAX_STATE_CHARS = 2097152;

// RAISED 90s -> 180s 2026-08-26: the whole-vocabulary default (M-116) made
// a full plan->fill->grade round trip measurably slower — ~61s wall on a CI
// runner — so a runner half again as slow was one kill away from turning a
// real answer into a refusal. ~~180_000~~ BOUND TO THE SHARED BUDGET
// 2026-08-29 (M-165): 180s was a SECOND clock under the chat layer's 240s,
// so a subprocess died for work its own caller was still waiting for, and
// lyric_revise's deferred replay — which grows ~15s per folded answer —
// crossed it by roughly answer 10 of the ~35-40 a clean 22-line run needs
// (round 8: eight consecutive exit -1 in one turn). One definition now;
// mcp/budget.js carries the derivation. The serial-queue argument in the
// sweep-window note is unchanged: a 60s client still gives up first, and
// this cap's only job is to eventually free the box, which a ten-minute
// bound still does.
const SUBPROCESS_TIMEOUT_MS = TOOL_BUDGET_MS;
const MAX_OUTPUT_BYTES = 4 * 1024 * 1024;

// A word that reaches argv: letters, apostrophes, internal hyphens. The
// leading character is constrained separately so no input can grow into a
// flag; there is no shell (execFile), so this is belt on top of braces.
const WORD_RE = /^[A-Za-z][A-Za-z''-]*$/;
// Mandate strings (--groups=/--returns=). A member is a LINE NUMBER, or a
// line and a PLACE IN IT since 2026-08-23 — `3.head`, `3.T2`, `3.end`,
// `3.endword`, `3.line`, `3.headrime` (`quality/slots.py`). The owner's
// ruling that closed the end-rhyme-only architecture is the reason this
// spelling exists, and it reaches the connector IN THE SAME COMMIT as the
// coordinate: a declared coordinate the outermost layer cannot spell is this
// repository's single most-repeated defect (CLAUDE.md's `--structures`
// paragraph, M-55, and doctrine 48 at the connector).
// ~~`--structures` is the standing example of that defect~~ -- STRUCK
// 2026-08-24: it is a `lyric_check` field now, and specifying the wiring
// turned up two live harness defects on the way (M-102, M-103).
//
// The place is matched as a BOUNDED alternation rather than `\w+` so nothing
// input-shaped can grow into a flag; the harness refuses an unknown place by
// name anyway, and this is the belt on top of that.
const SLOT_PLACE = '(?:end|endword|head|headrime|line|T[0-9]{1,3})';
const MEMBER_RE = `[0-9]+(?:\\.${SLOT_PLACE})?`;
const MANDATE_RE = new RegExp(`^${MEMBER_RE}(,${MEMBER_RE})*(;${MEMBER_RE}(,${MEMBER_RE})*)*$`);
// `--returns=` names LINES that are the same line, so a place has no meaning
// there — a return is a whole line repeated, not a span inside one.
// A structures entry is LABEL:NAME. The NAME charset is wide on purpose —
// catalog rows are spelled `Kalevala-alliteration-(strong,-closed-syllable)`
// — and the leading character of the whole string is pinned to a label so
// nothing input-shaped can grow into a flag.
// A predicate is NAME<=N / NAME>=N / NAME=VALUE. The NAME vocabulary is
// CLOSED and lives in quality/plan.py; it is deliberately NOT restated here,
// because the harness refuses an undeclared name BY NAME and prints the whole
// table, and a second copy of a closed vocabulary in JS is the copy that goes
// stale (doctrine 1). This is charset only, and the first character is pinned
// to a letter so nothing input-shaped can grow into a flag.
const WANT_RE = /^[a-z][a-z_]{0,23}(<=|>=|=)[A-Za-z0-9_,-]{1,48}$/;
const STRUCTURES_RE =
  /^[A-Za-z0-9]{1,3}:[A-Za-z0-9()',. /-]{1,64}(,[A-Za-z0-9]{1,3}:[A-Za-z0-9()',. /-]{1,64})*$/;
const RETURNS_RE = /^[0-9]+(,[0-9]+)*(;[0-9]+(,[0-9]+)*)*$/;
const SCHEME_RE = /^[A-Za-z]{1,64}$/;

// One python at a time (see OPERATIONAL SHAPE above). A rejected run must
// not wedge the chain, so the tail always settles.
let queueTail = Promise.resolve();
function enqueue(fn) {
  const run = queueTail.then(fn, fn);
  queueTail = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

// ── THE WARM WORKER (`MISSING.md` M-155) ──────────────────────────────────
// One persistent `worker.py` serves verb requests over line-JSON, so the
// interpreter and the harness's declared memos live between calls — the
// lever that matters is `relations._WVP_MEMO`, which makes lyric_revise's
// replay stop re-paying streams for drafts the process already judged.
// STATELESSNESS IS UNCHANGED AT THE REQUEST BOUNDARY: every request is a
// full `main()` on its own argv, and the memo answers only IDENTICAL calls
// (declared-coordinate keys; quality/relations.py owns the argument).
// FAILURE IS ALWAYS A FALLBACK, NEVER A WRONG ANSWER: a timeout, a dead
// worker, or an unreadable reply kills the worker and re-runs THAT request
// on the cold execFile path — one slow answer, byte-identical semantics.
// `LYRIC_WORKER=0` disables the warm path entirely.
const WORKER_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), 'worker.py');
const WORKER_ENABLED = process.env.LYRIC_WORKER !== '0';
let _worker = null;
let _workerBuf = '';
let _workerNextId = 1;
let _workerWaiter = null; // {id, resolve, reject} — the queue is serial, so at most one

function _killWorker() {
  if (_worker) {
    try {
      _worker.kill('SIGKILL');
    } catch {
      /* already gone */
    }
  }
  _worker = null;
  _workerBuf = '';
  if (_workerWaiter) {
    const w = _workerWaiter;
    _workerWaiter = null;
    w.reject(new Error('worker died'));
  }
}

function _spawnWorker() {
  const w = spawn(PYTHON, [WORKER_PATH], {
    cwd: HARNESS_DIR,
    stdio: ['pipe', 'pipe', 'ignore'],
    env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' },
  });
  // UNREF'd so the worker never holds the parent open: node exits when its
  // own work is done, the worker's stdin sees EOF, and worker.py's read
  // loop ends — the shutdown ordering is the pipe's, not a signal's.
  w.unref();
  if (w.stdin.unref) w.stdin.unref();
  if (w.stdout.unref) w.stdout.unref();
  w.stdout.setEncoding('utf8');
  w.stdout.on('data', (chunk) => {
    _workerBuf += chunk;
    if (_workerBuf.length > MAX_OUTPUT_BYTES) return _killWorker();
    let nl;
    while ((nl = _workerBuf.indexOf('\n')) >= 0) {
      const line = _workerBuf.slice(0, nl);
      _workerBuf = _workerBuf.slice(nl + 1);
      if (!line.trim() || !_workerWaiter) continue;
      let reply;
      try {
        reply = JSON.parse(line);
      } catch {
        return _killWorker(); // protocol corruption: cold path takes over
      }
      if (reply.id !== _workerWaiter.id) continue; // stale reply from a killed request
      const wtr = _workerWaiter;
      _workerWaiter = null;
      wtr.resolve({
        code: typeof reply.code === 'number' ? reply.code : -1,
        stdout: reply.stdout || '',
        stderr: reply.stderr || '',
      });
    }
  });
  w.on('exit', (code, signal) => {
    // A WORKER THAT DIES IS A LOGGED EVENT, NOT A QUIET SLOWDOWN (M-216):
    // from M-155 to 2026-09-01 the deployed image had no worker.py, every
    // spawn failed, every call answered cold with byte-identical bytes, and
    // nothing said so for three days. The fallback stays; its silence goes.
    if (_worker === w) {
      console.error(
        `[lyric] warm worker exited (code=${code} signal=${signal}) — later calls answer COLD until it respawns`
      );
      _killWorker();
    }
  });
  w.on('error', (e) => {
    if (_worker === w) {
      console.error(`[lyric] warm worker could not be spawned: ${e && e.message} — answering COLD`);
      _killWorker();
    }
  });
  _worker = w;
  return w;
}

function _runVerbWarm(args) {
  return new Promise((resolve, reject) => {
    const w = _worker || _spawnWorker();
    const id = _workerNextId++;
    const timer = setTimeout(() => {
      // A wedged request wedges the worker (it is serial), so the worker
      // goes with it. The rejection is TAGGED so runVerb can tell a
      // timed-out call from a dead worker: a crash falls back cold with
      // byte-identical semantics, but a call that outlived the WHOLE
      // shared budget once must not re-run cold — that blocks the serial
      // queue for a second whole budget to earn the same kill (M-165;
      // round 8's turn 8 spent 25.6 minutes this way).
      if (_workerWaiter && _workerWaiter.id === id) {
        const wtr = _workerWaiter;
        _workerWaiter = null;
        const e = new Error(`verb killed at the shared tool budget (${SUBPROCESS_TIMEOUT_MS}ms)`);
        e.timedOut = true;
        wtr.reject(e);
      }
      _killWorker();
    }, SUBPROCESS_TIMEOUT_MS);
    _workerWaiter = {
      id,
      resolve: (r) => {
        clearTimeout(timer);
        resolve(r);
      },
      reject: (e) => {
        clearTimeout(timer);
        reject(e);
      },
    };
    try {
      w.stdin.write(JSON.stringify({ id, argv: args }) + '\n');
    } catch (e) {
      _killWorker();
      reject(e);
    }
  });
}

function _runVerbCold(args) {
  return new Promise((resolve) => {
    execFile(
      PYTHON,
      ['lyric_harness.py', ...args],
      {
        cwd: HARNESS_DIR,
        timeout: SUBPROCESS_TIMEOUT_MS,
        maxBuffer: MAX_OUTPUT_BYTES,
        env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' },
      },
      (err, stdout, stderr) => {
        // The CLI's exit codes are the contract: 0 answered clean,
        // 2 REFUSED (the harness did not answer), 3 answered with a
        // FLAG standing, 4 SUSPENDED. execFile treats any nonzero as
        // `err`, so the codes are read back off the error object.
        const code = err ? (typeof err.code === 'number' ? err.code : -1) : 0;
        resolve({ code, stdout: stdout || '', stderr: stderr || '' });
      }
    );
  });
}

function runVerb(args) {
  // The cold fallback exists for a DEAD worker (spawn failure, protocol
  // corruption, crash) — one slow answer, same semantics. A TIMED-OUT
  // worker is a different verdict: the call itself outlived the shared
  // budget, and re-running it cold would hold the serial queue for a
  // second whole budget to reach the same -1. The tagged rejection is
  // surfaced as the kill it is (M-165).
  //
  // THE PATH TAKEN AND THE TIME IT TOOK RIDE THE RESULT (M-216): `path` is
  // one of warm / cold / cold-fallback / killed and `ms` the wall clock of
  // this call. Ten battery rounds could not say which path the deployed box
  // paid, and the harness/model split of a turn was never separable
  // (M-170). A fallback is also LOGGED, because a silent one already cost
  // three days of cold production (M-187).
  const t0 = Date.now();
  const stamp = (r, path) => ({ ...r, path, ms: Date.now() - t0 });
  // The tail of a killed call, kept apart so the ternary below stays the
  // one-line shape the M-165 pin reads (`e && e.timedOut ? { code: -1`).
  const killed = (e, t) => ({
    stdout: '',
    stderr: String(e.message),
    path: 'killed',
    ms: Date.now() - t,
  });
  return enqueue(() =>
    WORKER_ENABLED
      ? _runVerbWarm(args).then(
          (r) => stamp(r, 'warm'),
          (e) =>
            e && e.timedOut
              ? { code: -1, ...killed(e, t0) }
              : (console.error(
                  `[lyric] warm worker unavailable (${e && e.message}); answering '${args[0]}' on the COLD path`
                ),
                _runVerbCold(args).then((r) => stamp(r, 'cold-fallback')))
        )
      : _runVerbCold(args).then((r) => stamp(r, 'cold'))
  );
}

// TEST SEAM (M-155): mcp/test.mjs drives the two paths directly for its
// byte-equality battery — the claim that the warm worker answers with the
// COLD PATH'S EXACT BYTES is only checkable by running both on one argv.
// Production code reaches both only through `runVerb`'s fallback.
export const _workerInternals = {
  runWarm: _runVerbWarm,
  runCold: _runVerbCold,
  kill: _killWorker,
  pid: () => (_worker ? _worker.pid : null),
  enabled: WORKER_ENABLED,
};

const EXIT_MEANING = {
  0: 'answered — no flag stands',
  // 1 is Python's own uncaught exception: the harness DIED, it did not
  // answer, and a death read as a verdict is the worst reading a caller can
  // make of it (M-186; M-188 turned the one known cause, a missing staged
  // resource, into a refusal at 2 — anything still reaching 1 is a crash).
  1: 'CRASHED — not an answer; the harness died before reaching a verdict, stderr follows',
  2: 'REFUSED — the harness did not answer; the report names why',
  3: 'answered — at least one FLAG stands; the report names the lines',
  4: "SUSPENDED — the loop is waiting for a writer's answer; neither a verdict nor a failure",
};

// Pull the two-tier ban's pair findings out of a grade report by their own
// codes. Extraction, not re-implementation: HOMEOTELEUTON and MODAL_RHYME are
// the grader's own pair-scoped findings on MANDATED pairs — the same two
// `screen` relays, and the CLI loop's own MANDATORY_PURSUE set — printed one
// per line as "FINDING [NOTE] CODE: L{i}/L{j} ..." (the L{i}/L{j} spelling
// quality/capacity.py's _grade_group parses identically). WHY THIS SURFACES
// AT ALL: on the CLI the revise loop is FORCED to pursue these notes; the
// connector deliberately wraps no loop, so without this field the enforcement
// half of the two-tier ban does not exist on the chat surface — the
// 2026-08-19 site transcript graded a song whose every rhyme was banned at
// exit 0 and the model presented it as finished.
function extractBannedPairs(report) {
  const out = [];
  const seen = new Set();
  const re = /FINDING \[[A-Z]+\] (HOMEOTELEUTON|MODAL_RHYME): (L(\d+)\/L(\d+)[^\n]*)/g;
  for (let m; (m = re.exec(report)); ) {
    const key = `${m[1]} ${m[3]} ${m[4]}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ code: m[1], lines: [Number(m[3]), Number(m[4])], finding: m[2] });
  }
  return out;
}

// THE UNCALIBRATED-STRUCTURE DISCLOSURE, and it rides beside banned_pairs
// for the same reason banned_pairs exists. Declaring any catalog row makes
// `grade()` judge that group by the row's own judge AND makes the proactive
// two-tier ban SKIP those pairs — the spelled-rime class and the eng-song
// modal table are end-rhyme instruments and charging them to a coda-only
// hending would grade the wrong axis. Exactly two of the 58 rows carry a
// measured laziness regime, `english-end-rhyme` for eng (whose judge refuses,
// so it cannot be declared) and `kalevala-alliteration` for fin — so on an
// English draft EVERY declarable row is uncalibrated, the ban is skipped, and
// `banned_pairs` is absent because the question was never asked. Absent reads
// as clean. That is the 2026-08-19 site failure exactly, one coordinate over.
function extractUncalibrated(report) {
  const m = report.match(
    /FINDING \[NOTE\] STRUCTURE_UNCALIBRATED: declared structure\(s\) ([^\n]*?) have no measured laziness tier[^\n]*/
  );
  return m ? m[1].trim() : null;
}

// THE LOOP'S OWN RECORD OF ITS RUN, extracted from the stamp the verb already
// prints (M-169). `revise_loop` returns a LoopResult carrying the stop reason,
// the rounds it spent and the lines still open, and `lyric_harness.py`'s finish
// verb prints all three inside the `[FINISHED — …]` stamp M-150 requires. Every
// layer above that then threw them away: the verdict carried `exit_code` and
// `banned_pairs` and nothing else, so the flash battery's transcript — this
// project's ONLY record of a production run — could say a call exited 3 and
// could not say whether it spent 4 rounds fixing nineteen lines or 8 rounds
// fixing none. Round 10 was diagnosed by reading a stamp the MODEL happened to
// quote back in its chat reply, which is a record the model can edit, omit or
// paraphrase (doctrine 14: a measurement that depends on the thing being
// measured is not a measurement). This is extraction, not re-implementation:
// the harness computes and spells all three, and nothing here re-derives them.
//
// ABSENT MEANS NOT ASKED, never zero — the `banned_pairs` rule one family over.
// A suspended call (exit 4) has reached no stop condition, so it HAS no stop
// reason, and a `loop_rounds: 0` there would read as a run that did nothing
// rather than a run still going (doctrine 20).
// THE FINDINGS STANDING AT THE STOP (M-232, round 18). `revise`/`finish`
// print them under "STANDING AT THE STOP" (M-186) — one line per open line
// in the report's own `FINDING [SEV] CODE: …` spelling, and one per
// whole-draft flag — and the tool returned only the render and the stamp,
// so the model read "UNRESOLVED: L3, L5" and never WHY. Parsed here into
// the verdict and appended to the first block, so a parked run says what
// each open line still carries.
function extractStanding(stdout) {
  const i = stdout.indexOf('STANDING AT THE STOP');
  if (i < 0) return [];
  const block = stdout.slice(i);
  const out = [];
  for (const line of block.split('\n').slice(1)) {
    const m = /^\s+((?:L\d+|WHOLE-DRAFT): FINDING .*)$/.exec(line);
    if (m) out.push(m[1].trim());
    else if (out.length && /^\s{6,}\S/.test(line))
      // A finding's detail line (deeper indent) rides with its finding —
      // "title 'x' vs hook 'y'" is what the writer needs to fix it.
      out[out.length - 1] = `${out[out.length - 1]} — ${line.trim()}`.slice(0, 400);
    else if (out.length && !/^\s+/.test(line)) break;
    else if (out.length && /^\s*$/.test(line)) break;
  }
  return out;
}

// THE PROPOSAL RECORD (M-235, round 21). Round 21 spent 190 answers over
// three loops and the record could not say which line any of them answered,
// what the model sent, or whether verify took it — the rows carried only the
// running count. The state file the verb writes already holds all of it: the
// pending question (kind, line, attempt, round) and, on the way in, the
// question the model's `answer` folds. What verify said about that answer
// is DERIVED from the loop's own control flow rather than printed by it: a
// rejected tier-1 proposal is re-asked AT ONCE as the same line, same round,
// attempt+1 (`quality/loop.py` `_try_tier1`, the `for attempt` loop), so the
// next pending question names the verdict. Exact below the attempt budget;
// the budget's LAST attempt is `unknown` here (rejected-and-exhausted and
// accepted both move to another line) and is left so, never guessed.
// THE RUN RECORD THE TOOL KEEPS (M-237): one per run key, a cache of the
// state the tool returns verbatim. See run_store.js.
export const RUNS = new RunStore();
// A plan on a seed with an open run is NOT refused by the tool (a person may
// plan again on purpose; the Gemini wrapper keeps its stricter refusal) —
// the result says a run is open and names the move (M-237).
function openRunNote(a) {
  const key = runKeyOf(a);
  const rec = key ? RUNS.get(key) : null;
  if (!rec) return '';
  return (
    `\n\nNOTE: a lyric_revise run is OPEN on ${key} (run ${rec.run_id}, ${rec.status}` +
    (rec.status === 'suspended'
      ? `, ${rec.answers ?? 0} answer(s) on record`
      : `, ${(rec.open || []).length} line(s) open`) +
    `). This plan does not touch it: continue it with lyric_revise, or send \`new_run: true\` there to start over.`
  );
}

export const CONNECTOR_MAX_ROUNDS = 8;
export const CONNECTOR_ATTEMPTS = 1;
export const CONNECTOR_BACKTRACK = 0;

function askedOf(pending) {
  if (!pending || typeof pending !== 'object') return null;
  const rec = pending.record || {};
  if (pending.kind === 'propose') {
    return {
      kind: 'propose',
      line: typeof rec.line === 'number' ? rec.line : null,
      attempt: typeof rec.attempt === 'number' ? rec.attempt : null,
      round: typeof rec.round === 'number' ? rec.round : null,
    };
  }
  if (pending.kind === 'propose_group') {
    return {
      kind: 'propose_group',
      members: Array.isArray(rec.members) ? rec.members : null,
      attempt: null,
      round: typeof rec.round === 'number' ? rec.round : null,
    };
  }
  if (pending.kind === 'propose_batch') {
    // M-236: several independent tier-1 questions asked as one.
    const recs = Array.isArray(rec.records) ? rec.records : [];
    return {
      kind: 'propose_batch',
      lines: recs.map((r) => r && r.line).filter((n) => typeof n === 'number'),
      attempt: 0,
      round: typeof rec.round === 'number' ? rec.round : null,
    };
  }
  return { kind: String(pending.kind ?? 'unknown'), line: null, attempt: null, round: null };
}

// The grader's verbatim reasons for the previous attempt, as `render_line`'s
// ATTEMPT block prints them ("  - reason" rows under the REJECTED sentence).
function priorReasons(prompt) {
  if (typeof prompt !== 'string') return [];
  const i = prompt.indexOf('The PREVIOUS attempt was REJECTED.');
  if (i < 0) return [];
  const out = [];
  let started = false;
  for (const line of prompt.slice(i).split('\n').slice(1)) {
    const m = /^\s+-\s+(.*\S)\s*$/.exec(line);
    if (m) {
      started = true;
      out.push(m[1].slice(0, 300));
    } else if (started) break;
  }
  return out;
}

// THE VERDICT, OFF THE RECORD WHEN THE RECORD HAS IT (M-236). The harness
// now writes what verify made of every candidate into the state file
// (`outcomes`, keyed line/attempt/round) as the loop replays, so the verdict
// is READ there first — exact for every attempt, the last one and a batch
// member included. The M-235 derivation below stays as the fallback for a
// state an older harness wrote.
function outcomeAt(st, line, attempt, round) {
  const outs = st && Array.isArray(st.outcomes) ? st.outcomes : [];
  for (let i = outs.length - 1; i >= 0; i--) {
    const o = outs[i];
    if (!o || typeof o !== 'object') continue;
    if (o.line === line && o.attempt === attempt && (o.round ?? null) === (round ?? null)) return o;
  }
  return null;
}

function foldedOne(asked, answer, st, budget) {
  const next = st && typeof st === 'object' ? st.pending : null;
  const nextAsked = askedOf(next);
  let verdict = 'unknown';
  let reasons = [];
  let source = 'derived';
  const o =
    asked.kind === 'propose' && typeof asked.attempt === 'number'
      ? outcomeAt(st, asked.line, asked.attempt, asked.round)
      : null;
  if (o) {
    verdict = o.accepted === true ? 'accepted' : o.accepted === false ? 'rejected' : 'unknown';
    reasons = Array.isArray(o.reasons) ? o.reasons.map((r) => String(r).slice(0, 300)) : [];
    source = 'outcome';
  } else if (asked.kind === 'propose' && typeof asked.attempt === 'number') {
    const reasked =
      nextAsked &&
      nextAsked.kind === 'propose' &&
      nextAsked.line === asked.line &&
      nextAsked.round === asked.round &&
      nextAsked.attempt === asked.attempt + 1;
    if (reasked) {
      verdict = 'rejected';
      reasons = priorReasons(next.prompt);
    } else if (asked.attempt + 1 < budget) {
      verdict = 'accepted';
    }
  }
  return {
    ...asked,
    answer:
      typeof answer === 'string' ? answer.slice(0, 300) : JSON.stringify(answer).slice(0, 300),
    verdict,
    reasons,
    source,
  };
}

function foldedOf(prevStateText, st, attempts) {
  let prev;
  try {
    prev = typeof prevStateText === 'string' ? JSON.parse(prevStateText) : prevStateText;
  } catch {
    return null;
  }
  const pend = prev && typeof prev === 'object' ? prev.pending : null;
  if (!pend || typeof pend !== 'object') return null;
  if (pend.answer == null || pend.answer === '') return null;
  const asked = askedOf(pend);
  if (!asked) return null;
  const budget = typeof attempts === 'number' && attempts >= 0 ? attempts : 3;
  if (asked.kind === 'propose_batch') {
    // One record per member (M-236); the member's own answer is the row the
    // harness folded, read back off the replay file.
    const recs = Array.isArray(pend.record?.records) ? pend.record.records : [];
    const folded = Array.isArray(st?.answered?.propose) ? st.answered.propose : [];
    return recs.map((r) => {
      const one = {
        kind: 'propose',
        line: r.line,
        attempt: r.attempt ?? 0,
        round: r.round ?? null,
      };
      const rec = folded.find(
        (f) =>
          f &&
          f.line === one.line &&
          (f.attempt ?? 0) === one.attempt &&
          (f.round ?? null) === one.round
      );
      return foldedOne(
        one,
        rec && typeof rec.text === 'string' ? rec.text : pend.answer,
        st,
        budget
      );
    });
  }
  return foldedOne(asked, pend.answer, st, budget);
}

// A short fingerprint of the draft a call carried, so the cycles of one song
// (draft, park, rewrite, draft) can be told apart in the rows.
function draftFp(draft) {
  if (!Array.isArray(draft)) return null;
  return createHash('sha1').update(draft.join('\n'), 'utf8').digest('hex').slice(0, 10);
}

function extractLoopRecord(report) {
  // THE WHOLE-DRAFT HALF (M-186): the stamp names the whole-draft FLAGS
  // standing at the stop — codes that name no line (STACKED_DRAFT,
  // TITLE_NOT_IN_HOOK, HOOK_ABSENT…) — as its own clause, and they are a
  // separate count from the open lines (doctrine 79): a song with no open
  // line and one whole-draft flag is NOT finished, and used to be stamped so.
  const m =
    /\[FINISHED\s*—\s*(?:seed\s*(-?\d+)|declared mandate)\s*—\s*exit\s*(\d+)\s*—\s*([A-Z_]+)\s+after\s+(\d+)\s+round\(s\)\s*—\s*(?:UNRESOLVED:\s*([^\]—]*)|no flag stands)(?:\s*—\s*WHOLE-DRAFT FLAG:\s*([^\]]*))?\]/.exec(
      report
    );
  if (!m) return null;
  const lines = (m[5] || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const whole = (m[6] || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return {
    // `seed` is null for a pasted song's run (M-195), never 0: the stamp
    // then reads `declared mandate` and the record says so.
    seed: m[1] == null ? null : Number(m[1]),
    stop_reason: m[3],
    rounds: Number(m[4]),
    unresolved: lines.length,
    unresolved_lines: lines,
    whole_flags: whole.length,
    whole_flag_codes: whole,
  };
}

// THE STOP'S STATUS, IN THREE WORDS RATHER THAN TWO (M-186, 2026-09-02): a
// whole-only exit 3 — no line open, a WHOLE-DRAFT FLAG standing — was
// labelled `stopped_with_open_lines` with `loop_unresolved` 0, which names
// a cause the verdict itself contradicts. Read off the verdict's own loop
// record, never re-derived from the report.
function loopStatusOf(code, verdict) {
  if (code === 0) return 'finished_clean';
  const open = typeof verdict.loop_unresolved === 'number' ? verdict.loop_unresolved : 0;
  const whole = Array.isArray(verdict.loop_whole_flag_codes)
    ? verdict.loop_whole_flag_codes.length
    : 0;
  if (open === 0 && whole > 0) return 'stopped_with_whole_draft_flags';
  return 'stopped_with_open_lines';
}

// THE RECOVERED MANDATE, read off the `recover` verb's own MANDATE SPELLING
// block (M-195) — the two CLI flags the cover splits into, so a caller can
// hand them to lyric_check / lyric_revise verbatim. Extraction, not
// re-derivation: `quality/recover.py` spells them and nothing here rebuilds
// the cover.
function extractRecoveredMandate(report) {
  const g = /^\s*--groups=(\S*)\s*$/m.exec(report);
  const r = /^\s*--returns=(\S*)\s*$/m.exec(report);
  if (!g && !r) return null;
  return { groups: g ? g[1] : '', returns: r ? r[1] : '' };
}

// The coordinates `recover` REFUSED — the work order. REPAIRED 2026-09-02:
// the first extractor read `  <key>: REFUSED — <why>`, a line the harness
// never prints, so `refusals` was `[]` on every real render while its pin
// passed on a synthetic stdout (M-142's self-grep species; found by the
// tier-A verification of M-195). The render actually prints a refused
// coordinate as `  <key>  [REFUSED] <value>` with the reason on the next
// line, indented six spaces, and closes with `  N REFUSED coordinate(s)`
// followed by one indented key per line — that second list carries the
// refusals the per-key loop never renders (`repeats_at_a_placement`). Read
// both; a key in both is ONE refusal.
function extractRecoverRefusals(report) {
  const out = new Map();
  const re = /^ {2}([a-z_]+) +\[REFUSED\] *([^\n]*)(?:\n {6}([^\n]*))?/gm;
  let m;
  while ((m = re.exec(report))) out.set(m[1], (m[3] || m[2] || '').trim());
  const tail = /^ {2}\d+ REFUSED coordinate\(s\)[^\n]*\n((?: {6}[a-z_]+\n?)+)/m.exec(report);
  if (tail) for (const k of tail[1].trim().split(/\s+/)) if (!out.has(k)) out.set(k, '');
  return [...out].map(([coordinate, why]) => ({ coordinate, why }));
}

// THE REPORT'S OWN COUNTS, extracted the way `extractBannedPairs` extracts
// the ban (M-186). `brief`'s exit gates are song-only: a FLAGGED draft
// graded through `lyric_check` returned exit 0 with the meaning "no flag
// stands", because the flag stood in the report and the code never carried
// it. Two counts, never summed: the per-line FLAGs on briefed lines, and the
// WHOLE-DRAFT flags that name no line. The line the harness prints is
//   REPORT: N line(s) briefed — K FLAG, M NOTE (…); W WHOLE-DRAFT finding(s), F of them FLAG(S), below
// and only the harness spells it; nothing here re-derives a count.
function extractReportCounts(report) {
  const m = /REPORT: (\d+) line\(s\) briefed — (\d+) FLAG, (\d+) NOTE([^\n]*)/.exec(report);
  if (!m) return null;
  // The whole-draft clause is read off the SAME line, separately: a lazy
  // `[^\n]*?` in front of an optional group matches the empty string first
  // and the optional group is then skipped — the first spelling of this
  // function read every whole-draft count as 0, and the unit case caught it.
  const w = /; (\d+) WHOLE-DRAFT finding\(s\), (\d+) of them FLAG\(S\)/.exec(m[4]);
  return {
    briefed: Number(m[1]),
    flags: Number(m[2]),
    notes: Number(m[3]),
    whole: w ? Number(w[1]) : 0,
    whole_flags: w ? Number(w[2]) : 0,
  };
}

// REFUSALS ARE NOT VERDICTS (doctrine 28; M-186). An end word the lexicon
// cannot read is a pair the grader did NOT judge — `UNREADABLE_END_WORD` on
// the line, `SCHEME_UNREADABLE` on the mandated pair — and it surfaced only
// as report prose under exit 0, where a caller reads "no flag stands" as
// "every pair passed". Extracted by code, with the lines named.
function extractUnreadable(report) {
  const out = [];
  const seen = new Set();
  const re = /FINDING \[[A-Z]+ *\] (UNREADABLE_END_WORD(?:_PIECE)?|SCHEME_UNREADABLE): ([^\n]*)/g;
  let m;
  while ((m = re.exec(report))) {
    const lines = [];
    const lm = /\(lines ([^)]*)\)/.exec(m[2]);
    if (lm)
      lines.push(
        ...lm[1]
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      );
    const lre = /\bL(\d+)\b/g;
    let x;
    while ((x = lre.exec(m[2]))) lines.push(x[1]);
    const key = `${m[1]}|${m[2]}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ code: m[1], lines: [...new Set(lines)], text: m[2].trim() });
  }
  return out;
}

// THE HARNESS'S OWN REFUSAL HEADLINE (2026-09-02, `MISSING.md` M-168's
// swerve). `_refuse` prints `  REFUSED — {msg}` and exits 2, and the CLI's
// other exit-2 prints (the candidates and mandate refusals) spell the same
// headline. Round 10 banked two lyric_sweep calls and a lyric_plan call at
// exit 2 with `error: null` and NOTHING else on the record, so nobody can now
// say whether the window held no seed, a predicate was misspelled or the
// declaration was unbuildable — three different remedies. The first headline
// is the reason; extraction, never re-derivation (the M-169 pattern), and
// pinned against the harness's own print statement rather than a fixture
// this file wrote.
function extractRefusal(report) {
  const m = /^\s*REFUSED — ([^\n]+)/m.exec(report || '');
  return m ? m[1].trim() : null;
}

// THE RUN'S OWN THREE DISCLOSURES, READ OUT OF THE REPORT (M-216): which
// path answered and how long it took (stamped on the result by `runVerb`),
// the replay memo's warm/cold tally (`REPLAY MEMO: warm — 14 of 28 grading
// call(s) …`), the count of recorded answers replayed onto a DIFFERENT draft
// (M-183's stale clause), and — on a plan — how many lines the shape drew,
// so a later reader never has to infer "a large drawn shape" (M-166) again.
// Extraction of printed lines, never a second computation (doctrine 1).
function extractRunRecord(stdout) {
  const out = {};
  const memo =
    /REPLAY MEMO: (warm|cold|off|no run key)(?: — (\d+) of (\d+) grading call\(s\))?/.exec(stdout);
  if (memo) {
    out.memo_state = memo[1];
    if (memo[2] != null) {
      out.memo_hit = Number(memo[2]);
      out.memo_asked = Number(memo[3]);
    }
  }
  const stale = /(\d+) of those answer\(s\) were recorded against a DIFFERENT draft/.exec(stdout);
  out.stale_answers = stale ? Number(stale[1]) : 0;
  const plan = /PLAN: form=\S+ seed=-?\d+ -> (\d+) line\(s\)/.exec(stdout);
  if (plan) out.plan_lines = Number(plan[1]);
  return out;
}

function verdictOf(r) {
  const banned = extractBannedPairs(r.stdout);
  const uncalibrated = extractUncalibrated(r.stdout);
  const loop = extractLoopRecord(r.stdout);
  const v = {
    exit_code: r.code,
    meaning: EXIT_MEANING[r.code] || `subprocess failure (${r.code}): ${r.stderr.slice(0, 400)}`,
  };
  if (typeof r.path === 'string') v.path = r.path;
  if (typeof r.ms === 'number') v.ms = r.ms;
  Object.assign(v, extractRunRecord(r.stdout));
  if (r.code === 2) {
    const why = extractRefusal(r.stdout);
    if (why) v.refusal = why;
  }
  // THE REPORT'S COUNTS AND THE REFUSALS (M-186), on every verb that prints
  // them. `brief`/`lyric_check` exit 0 with flags standing because their exit
  // gates are `song`'s alone; the verdict says so instead of "no flag stands".
  const counts = extractReportCounts(r.stdout);
  if (counts) {
    v.flags = counts.flags;
    v.notes = counts.notes;
    v.whole_flags = counts.whole_flags;
    if (r.code === 0 && (counts.flags > 0 || counts.whole_flags > 0)) {
      v.meaning =
        `answered — ${counts.flags} per-line FLAG(s) and ${counts.whole_flags} whole-draft ` +
        "FLAG(s) STAND (two counts, never summed); the exit code is brief's, whose gates are " +
        'song\'s alone, so 0 here means "answered", not "clean" — read the report';
    }
  }
  const unreadable = extractUnreadable(r.stdout);
  if (unreadable.length) {
    v.unreadable = unreadable.length;
    v.unreadable_findings = unreadable;
    v.unreadable_meaning =
      'These pairs were NOT judged: an end word the lexicon cannot read is a refusal, not a ' +
      'pass (doctrine 28). A clean exit code says nothing about them — read the words, or ' +
      'pass --fallback=low through `fallback` where a tool offers it.';
  }
  const standing = extractStanding(r.stdout);
  if (standing.length) v.standing = standing;
  if (loop) {
    // THREE COUNTS, NEVER SUMMED (doctrine 79): rounds spent, lines still open
    // and answers on record answer different questions. `stop_reason` is the
    // loop's own vocabulary (SUCCESS / NO_PROGRESS / ROUND_LIMIT) and is not
    // re-spelled here.
    v.loop_stop_reason = loop.stop_reason;
    v.loop_rounds = loop.rounds;
    v.loop_unresolved = loop.unresolved;
    v.loop_unresolved_lines = loop.unresolved_lines;
    v.loop_whole_flags = loop.whole_flags;
    v.loop_whole_flag_codes = loop.whole_flag_codes;
    v.loop_record_meaning =
      'The revision loop’s own account of the run it just finished: which stop condition ended ' +
      'it, how many rounds it spent, and which lines still carry something. ROUND_LIMIT or ' +
      'NO_PROGRESS with lines still open means the loop STOPPED TRYING — the song is not ' +
      'finished and more rounds of the same kind will not finish it.';
  }
  // Before `report`, deliberately: a count buried under a long report is a
  // count a reader in a hurry never reaches.
  if (banned.length) {
    v.banned_pairs = banned.length;
    v.banned_pairs_meaning =
      'UNSKIPPABLE, even at exit 0: these mandated pairs land on the two-tier ban ' +
      '(HOMEOTELEUTON — same spelled ending; MODAL_RHYME — the most predictable partner). ' +
      'A song presented with banned pairs standing is NOT finished: replace the end words ' +
      'on the named lines (screen replacements with lyric_screen first) and grade again.';
    v.banned = banned;
  }
  if (uncalibrated) {
    v.structures_uncalibrated = uncalibrated;
    v.structures_uncalibrated_meaning =
      'CORRECTNESS is graded for these declared structure(s) — the catalog row judges the ' +
      'pair at its own anchors — but LAZINESS is NOT, because no preregistered calibration ' +
      "has adopted a predictability table for them in this draft's language. The two-tier " +
      'ban (HOMEOTELEUTON / MODAL_RHYME) is SKIPPED on those pairs and nothing stands in for ' +
      'it, so an absent banned_pairs here means the question was NOT ASKED, not that the ' +
      'answer was clean. Screen those pairs with lyric_screen yourself.';
  }
  v.report = r.stdout;
  return v;
}

// `verify` NEEDS ITS OWN VERDICT, and reusing verdictOf would be the trap.
// Two measured reasons. (1) The verify report emits ZERO `FINDING` lines —
// it prints only the diff block — so `extractBannedPairs` returns [] on every
// call and `banned_pairs` would be ABSENT on a draft full of banned pairs.
// Absent reads as clean: the 2026-08-19 failure, third time. (2) `verify`
// exits 0 for ACCEPTED *and* REJECTED — the verdict is in the text — so a
// caller reading only exit_code would hear "no flag stands" about a revision
// the harness just refused.
//
// AND WHAT verify CANNOT SAY IS PART OF THE ANSWER. It is a DIFF: it speaks
// about what this change FIXED and what it INTRODUCED, never about what
// survived. A pair that was banned before and is still banned after appears
// in neither list, correctly, because nothing about it changed.
function verifyVerdictOf(r) {
  const out = r.stdout;
  const m = out.match(/VERDICT: (ACCEPTED|REJECTED)/);
  const v = {
    exit_code: r.code,
    accepted: m ? m[1] === 'ACCEPTED' : null,
    verdict: m ? m[1] : null,
  };
  if (!m)
    v.meaning = EXIT_MEANING[r.code] || `subprocess failure (${r.code}): ${r.stderr.slice(0, 400)}`;
  else
    v.meaning =
      (v.accepted
        ? 'ACCEPTED — this revision earned it: it fixed something and introduced no flag, and touched only lines that were targeted.'
        : 'REJECTED — the harness refused this revision. The reason is in the report: it fixed nothing, or it introduced a flag, or it took a forbidden modal candidate, or it changed lines nobody targeted.') +
      ' NOTE THE EXIT CODE IS 0 EITHER WAY — read `accepted`, not `exit_code`.';
  const grab = (label) => {
    const g = out.match(new RegExp(`${label}: (\\[[^\\n]*\\])`));
    return g ? g[1] : null;
  };
  for (const k of ['fixed', 'new_flags', 'new_notes']) {
    const got = grab(k);
    if (got) v[k] = got;
  }
  const counts = out.match(/fixed (\d+), introduced (\d+)/);
  if (counts) {
    v.fixed_count = Number(counts[1]);
    v.introduced_count = Number(counts[2]);
  }
  v.scope =
    'A DIFF, NOT A GRADE. verify answers "did this change earn it" — what it fixed and what ' +
    'it introduced. It says NOTHING about defects that survived the change unaltered, and it ' +
    'does not report banned pairs: a pair banned before and still banned after appears in ' +
    'neither list because nothing about it moved. For "is this song finished", grade the ' +
    'whole draft with lyric_grade or lyric_check.';
  v.report = out;
  return v;
}

function refuse(msg) {
  const e = new Error(msg);
  e.isRefusal = true;
  return e;
}

function checkWords(words) {
  if (words.length < 2 || words.length > MAX_WORDS)
    throw refuse(`between 2 and ${MAX_WORDS} words — got ${words.length}`);
  for (const w of words) {
    if (w.length > MAX_WORD_CHARS) throw refuse(`word too long: ${w.slice(0, 20)}…`);
    if (!WORD_RE.test(w))
      throw refuse(
        `'${w}' is not a single bare word (letters/apostrophes/hyphens, no leading '-')`
      );
  }
}

function checkLines(lines) {
  if (lines.length < 1 || lines.length > MAX_LINES)
    throw refuse(`between 1 and ${MAX_LINES} lines — got ${lines.length}`);
  for (const l of lines)
    if (l.length > MAX_LINE_CHARS) throw refuse(`line over ${MAX_LINE_CHARS} chars`);
}

async function withTempDir(fn) {
  const dir = await mkdtemp(path.join(tmpdir(), 'lyric-'));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

// THE GLOBALS, AHEAD OF THE VERB (M-189): `--voices` is bare-presence and
// `--fallback=` takes a value, and the CLI reads both before dispatch, so
// they cannot ride `planArgs` (which lands after the verb). Every handler
// that grades a draft spreads this in front of its verb.
function globalsFor(a) {
  const out = [];
  if (a && a.voices === true) out.push('--voices');
  if (a && (a.fallback === 'high' || a.fallback === 'low')) out.push(`--fallback=${a.fallback}`);
  return out;
}

function planArgs(a) {
  const args = [`--seed=${a.seed}`];
  if (a.form) args.push(`--form=${a.form}`);
  if (a.lines != null) args.push(`--lines=${a.lines}`);
  // THE WRITER'S DECLARATION (MISSING.md M-55). Neither FIELD is sampled
  // here: this flag is a CARRY of what the caller declared.
  // ~~the planner never picks a relation, it carries the one that was
  // declared~~ -- STRUCK 2026-08-26. True when written (2026-08-22 21:50,
  // `9de8031b`) and false since `b0070e1` (2026-08-25 16:12, M-117): with no
  // `--relation=` the planner DRAWS one schema per group from the certified
  // pool and records the draw in `plan.relations` -- MEASURED at 28, 25 and
  // 32 relations on seeds 1, 2 and 5. A declared `--relation=` still silences
  // the draw entirely (`plan.relations` comes back `{}`), which is why this
  // flag is still a carry; what changed is that the PLAN now has a relation
  // coordinate of its own, and `lyric_grade` has to read it.
  // Without these two lines every relation and every roster the CLI accepts
  // is unreachable from this connector -- which is what `--structures` was
  // from the day it shipped, and what makes a coordinate built-and-tested
  // but not reachable.
  //
  // `--structures` IS REACHABLE SINCE 2026-08-24, and NOT from here: it is a
  // field on `lyric_check`, because the `plan` verb does not accept the flag
  // and the planner emits no top-level `structures` key for `lyric_grade` to
  // read it off. Wiring it through planArgs would mean taking a mandate
  // coordinate off the tool call while groups and returns come off the plan
  // artifact -- a second statement of the mandate (doctrine 1).
  if (a.relation) args.push(`--relation=${a.relation}`);
  if (a.functions) args.push(`--functions=${a.functions}`);
  // The `=` spelling is mandatory here and not a style choice: the harness's
  // `--title X` form takes exactly ONE argv token, so a multi-word title is
  // only reachable through `--title=`. Guarded on truthiness like its two
  // neighbours -- an empty string must not emit a bare `--title=`, which the
  // harness reads back as `""`, which is what NOBODY DECLARED already means.
  if (a.title) args.push(`--title=${a.title}`);
  // `--narrative=` mirrors `--title=`: guarded on truthiness, and `off` is
  // a legal value the CLI reads as "silence the layer" (M-189).
  if (a.narrative) args.push(`--narrative=${a.narrative}`);
  return args;
}

// Pull the rendered song out of `plan --fill`'s report by its own banner.
// Extraction, not re-implementation: the text between the banner and the
// WROTE line is render_song's output byte for byte (pinned in test.mjs).
// THE SWEEP'S THREE COUNTS, READ OUT OF THE VERB'S OWN LINE. Extraction, not
// re-implementation — this file re-derives no judgement. The ACCEPTED list
// the report prints is TRUNCATED AT 40 by the harness, so a field called
// `accepted` parsed from it would be silently incomplete: the count and the
// shown list are separate keys and the truncation is disclosed.
function extractSweep(stdout) {
  const c = stdout.match(
    /swept (\d+)\s+planned (\d+)\s+REFUSED by the planner (\d+)\s+accepted (\d+)/
  );
  if (!c) return null;
  const listed = stdout.match(/own bias\):\n\s*([0-9, ]*)/);
  const shown = listed
    ? listed[1]
        .split(',')
        .map((x) => Number(x.trim()))
        .filter((x) => Number.isFinite(x))
    : [];
  return {
    swept: Number(c[1]),
    planned: Number(c[2]),
    planner_refused: Number(c[3]),
    accepted_count: Number(c[4]),
    accepted_shown: shown,
    accepted_truncated: /\.\.\. and \d+ more/.test(stdout),
  };
}

function extractRender(stdout) {
  const m = stdout.match(/THE SONG, PERFORMANCE ORDER:\n\n([\s\S]*?)\n\s*WROTE /);
  return m ? m[1].trimEnd() : null;
}

// ── the schemas (plain shapes: no unions, no refs — the contract gate's
//    STRUCTURAL scan and Gemini's key allowlist both stay clean) ───────────

const seedField = z
  .number()
  .int()
  .min(-2147483648)
  .max(2147483647)
  .describe(
    'REQUIRED declared seed — any integer. Same seed, same plan, byte for byte; a different seed is a different song shape. Pick one and keep it for the whole song.'
  );

const formField = z
  .enum(['verse-chorus'])
  .optional()
  .describe('Declared form (default verse-chorus; unknown forms refuse by name).');

const linesField = z
  .number()
  .int()
  .min(4)
  .max(MAX_LINES)
  .optional()
  .describe('Exact total line count to request (4-64). Omit to let the planner choose.');

// THE WRITER'S DECLARATION (MISSING.md M-55). Neither field is sampled here
// and neither has a default: an omitted field means NOBODY SAID.
// ~~and the harness then grades under the coarse two-name admit set exactly
// as it always has~~ -- STRUCK 2026-08-26, AND THE DATES ARE THE WHOLE POINT.
// This comment was written 2026-08-22 21:50:42 (`9de8031b`) and was TRUE.
// It was false 2 HOURS 18 MINUTES LATER: `d0b3a5d1` (2026-08-23 00:08:19) is
// M-59's commit, "Open every gate: default admits all four" -- and its ONLY
// change to this file was 1 insertion and 1 deletion, the `describe` string
// THREE LINES BELOW. One sentence, two copies, three lines apart; the commit
// that moved the door edited the copy it could see and left this one
// standing. It is struck rather than rewritten because the interesting fact
// is not what the door is, it is that a commit which KNEW the door had moved
// updated one copy (doctrine 17 -- deleting the sentence deletes the
// evidence).
// WHAT "NOBODY SAID" MEANS TODAY IS THREE THINGS AND NONE OF THEM IS THE
// TWO-NAME SET: the coarse band admits all FOUR classes (M-59); a pair with
// no declared relation is ALSO satisfied by ANY of the 77 schemas the
// vocabulary names (M-116, 2026-08-25, judged by
// `relations.whole_vocabulary_pairs`); and on lyric_plan / lyric_grade the
// PLANNER DRAWS a relation per group (M-117), so an omitted field selects the
// dice rather than the bare door.
const relationField = z
  .string()
  .max(64)
  .optional()
  .describe(
    'Declare ONE rhyme relation every mandated group is judged under, e.g. "type:rime riche", "type:pararhyme", "class:ASSONANCE", "schema:perfect rhyme". Namespace it (type: / class: / schema:) — 26 names live in two namespaces and a bare one refuses by name. All three namespaces are judged: class: is the coarse band, type: is the named-cell engine, schema: is realised over the whole draft (29 of the 77 schemas are end-rhyme and fit a group directly; an INTRA-LINE figure like schema:alliteration REFUSES and names its placement, because it is a property of one line and no pair of lines can stand in it). Omit and the COMPLETE default applies, and it is TWO doors and not one: the coarse band admits ALL FOUR classes (since 2026-08-22, so a near relation the band typed is no longer charged as a violation) OR the two lines stand in ANY of the 77 named schemas (since 2026-08-25) — laziness at the 77 is UNCALIBRATED and every pair rescued that way is named on the report\'s SCHEMA DEFAULT line. This description carried only the first half from 2026-08-25 to 2026-08-26. AND ON lyric_plan / lyric_grade AN OMITTED RELATION IS NOT "NO RELATION": the planner DRAWS one schema per group and the grade judges the draw — the plan report names each group\'s relation. Declaring one NARROWS, everywhere. Ask lyric_types for the vocabulary.'
  );

const functionsField = z
  .string()
  .max(200)
  .optional()
  .describe(
    'Comma-separated ALLOW-LIST of section functions this song may use, e.g. "verse,chorus,bridge,outro". Checked against each function\'s own definition BEFORE any shape is drawn: asking for a prechorus without a chorus REFUSES, because the word means before-the-chorus. A roster permits, it does not compel — functions the draw did not use are reported. Omit to let the planner use its whole roster.'
  );

// THE TITLE IS THE THIRD OF THAT FAMILY (MISSING.md M-93), and it is the one
// with TEETH. `grid.hook_findings` asks "is the title in the hook?" and
// `fill_plan` wrote `"title": ""` into every blueprint the planner has ever
// built, so the question could only be ANSWERED by editing the planner's own
// output by hand -- a step in producing a delivered song with no entrance the
// system owns (standing rule 3). Declaring one moves TWO codes in opposite
// directions: the `TITLE_UNDECLARED` refusal goes away, and `TITLE_NOT_IN_HOOK`
// becomes reachable, which has been a FLAG since 2026-08-23 (M-86). So this
// field can take a grade from exit 0 to exit 3, and the description has to say
// what containment means or a caller cannot tell why.
const titleField = z
  .string()
  .max(MAX_LINE_CHARS)
  .optional()
  .describe(
    'The song\'s title, CARRIED into the blueprint and never inferred. Declaring one answers "is the title in the hook?" instead of leaving it refused as TITLE_UNDECLARED — and the answer can be NO: TITLE_NOT_IN_HOOK is a FLAG, so a title whose words are not a contiguous run inside the hook line (or the hook inside the title) takes the grade to exit 3. Containment is a normalised WORD-subsequence test in either direction, not a substring match. A title with more words than the hook can never be answered YES by any draft and is refused as TITLE_LONGER_THAN_HOOK rather than charged. Omit and the harness reads exactly as it did before this field existed.'
  );

// THE CLI GLOBALS THE CHAT SURFACE COULD NOT SPELL (M-189, 2026-09-01).
// `--voices` and `--fallback=high|low` stand BEFORE the verb on the command
// line; no lyric_* tool carried them, so a chat writer could neither declare
// a sung parenthetical (a whole-line `(…)` reads as an EMPTY end word and the
// pair goes unjudged) nor reach the letter-to-sound layer for an end word the
// lexicon lacks. Both are prepended ahead of the verb by `globalsFor`; the
// worker runs the full `main()`, so nothing else moves.
const voicesField = z
  .boolean()
  .optional()
  .describe(
    'Declare that parenthesised text is SUNG (a second voice, a call-and-response line) rather than a stage aside. Default off: a parenthetical is read as unsung, so a line that is ONLY a parenthetical has NO end word and its rhyme is refused, not judged. Set true when the parentheses are part of the lyric.'
  );
const fallbackField = z
  .enum(['high', 'low'])
  .optional()
  .describe(
    "How far the pronunciation fallback may reach for a word the lexicon lacks (CMUdict, ~130k entries). Omit: dictionary only — an unknown end word REFUSES the pair (UNREADABLE_END_WORD / SCHEME_UNREADABLE: not judged, never passed). 'high': dictionary-derived readings (morphology, elision, compounds) — the confident layer. 'low': also the letter-to-sound guess, which the harness's own measurement calls net harmful (wrong on 50% of the refusals only it can read); use it to get an ANSWER on a coinage and read the answer with that in mind."
  );
const narrativeField = z
  .string()
  .max(200)
  .optional()
  .describe(
    "The story plan. Omit: the planner DRAWS one job per sung section (ESTABLISH, COMPLICATE, TURN, DWELL, ANCHOR, JUDGE, RESOLVE, DEPART) and the junction each enters by. 'off' silences the layer. Or declare it: 'ATOM,ATOM/JUNCTION,ATOM/JUNCTION' — one atom per sung section, a junction (THEREFORE, BUT, AND_THEN, MEANWHILE, ELABORATE, JUXTAPOSE) before every atom after the first. A RECORD, not a gate: nothing grades a draft against its story plan today; the brief prints it and the grade repeats it."
  );

// THE PASTED-SONG DOOR (M-195, 2026-09-01). A song a human pastes reached
// the graders with no blueprint (so meter, hook and title were never asked),
// no loop (lyric_revise needed a seed) and no structurer (quality/recover.py
// had no verb and no tool). These fields are the declaration a paste can
// carry: a blueprint the caller DECLARES (or one lyric_recover handed back
// with its refusals still in it) and the subdivision every slot question
// needs.
const blueprintField = z
  .string()
  .max(MAX_STATE_CHARS)
  .optional()
  .describe(
    'A DECLARED blueprint as JSON text — the bar grid `song` grades against: {"sections":[{"name","function","bars","start_bar","meter":{"beats","unit","groups":[…]}}],"lines":[{"text","bar","beat","duration"}], optional "title", "hooks"}. With it the meter, song-function, hook and title layers are ASKED; without it only rhyme and the slop floor are (the verdict says which). A meter written as a signature STRING ("4/4") is refused, not parsed. Pass `subdivision` with it.'
  );
const subdivisionField = z
  .number()
  .int()
  .min(1)
  .max(8)
  .optional()
  .describe(
    'The slot grid under a declared blueprint — units per beat (2 = eighths in x/4). REQUIRED with `blueprint` for the slot questions (SLOTS_EXCEEDED, the syllable ceiling); without it they REFUSE rather than assume a sixteenth-note grid.'
  );

const draftField = z
  .array(z.string().max(MAX_LINE_CHARS))
  .min(1)
  .max(MAX_LINES)
  .describe(
    'The song lines in performance order, one string per line, repeated sections written out in full. No [SECTION] markers.'
  );

// THE DRAFT AS ONE STRING (M-234, round 20). Gemini's own serialisation of
// a long array of comma-bearing lines is where a call breaks (M-226's
// finding, and round 20's six malformed rewrite attempts in two turns);
// a single newline-separated string is one token stream with nothing to
// balance. `draft_text` is accepted beside `draft` and split here; blank
// rows and bracketed [SECTION] markers are dropped, the rest trimmed.
const draftTextField = z
  .string()
  .max(MAX_LINES * (MAX_LINE_CHARS + 1))
  .describe(
    'The song lines as ONE string, one line per row (newline-separated), performance order, repeated sections written out in full — the same content as `draft`, for a caller whose array calls break. Send one of the two.'
  );
export function draftFromText(text) {
  return String(text)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !/^\[[^\]]*\]$/.test(l));
}

// THE VERDICT'S EXTRACTORS, exported for mcp/test.mjs to drive on synthetic
// reports (M-186): a live check proves one draft; the unit cases prove the
// regexes against every spelling the harness prints.
export const _argvInternals = { globalsFor, planArgs };

export const _verdictInternals = {
  extractStanding,
  askedOf,
  priorReasons,
  foldedOf,
  outcomeAt,
  draftFp,
  draftFromText,
  verdictOf,
  extractRefusal,
  extractRecoveredMandate,
  extractRecoverRefusals,
  extractReportCounts,
  extractUnreadable,
  extractLoopRecord,
  extractRunRecord,
  extractBannedPairs,
  EXIT_MEANING,
  loopStatusOf,
};

export const LYRIC_TOOL_SCHEMAS = {
  lyric_screen: {
    words: z
      .array(z.string().max(MAX_WORD_CHARS))
      .min(2)
      .max(MAX_WORDS)
      .describe('2-12 bare words; every unordered pair among them is screened.'),
    // THE SCREEN CAN ASK THE GRADE'S QUESTION (M-189): a plan draws a
    // named relation per group (M-117), and a screen that could only ask
    // the coarse class was screening for a different mandate than the one
    // the draft is graded under. Same field, same judge, same coordinate.
    relation: relationField,
    fallback: fallbackField,
  },
  lyric_plan: {
    seed: seedField,
    form: formField,
    lines: linesField,
    relation: relationField,
    functions: functionsField,
    title: titleField,
    narrative: narrativeField,
  },
  lyric_grade: {
    seed: seedField,
    form: formField,
    lines: linesField,
    relation: relationField,
    functions: functionsField,
    title: titleField,
    narrative: narrativeField,
    draft: draftField,
    voices: voicesField,
    fallback: fallbackField,
  },
  lyric_revise: {
    // OPTIONAL SINCE M-195: a pasted song has no seed. Declare EITHER a seed
    // (the plan is the mandate) OR a mandate (`scheme` or `groups`, with
    // `returns`/`relation`/`structures`/`blueprint`/`subdivision` as
    // lyric_check takes them); exactly one, never both.
    seed: seedField.optional(),
    scheme: z
      .string()
      .max(64)
      .optional()
      .describe(
        "For a pasted song (no seed): the letter rhyme scheme over the lines, e.g. 'ABAB' (X = free)."
      ),
    groups: z
      .string()
      .max(MAX_MANDATE_CHARS)
      .optional()
      .describe(
        "For a pasted song (no seed): rhyme groups by 1-based line number, e.g. '1,3;2,4', a member optionally naming its place ('1,3.head'). The mandate lyric_check graded under — pass the SAME one here, so the loop revises against what was checked."
      ),
    returns: z
      .string()
      .max(MAX_MANDATE_CHARS)
      .optional()
      .describe("For a pasted song: verbatim-return classes by line number, e.g. '5,13;6,14'."),
    structures: z
      .string()
      .max(MAX_MANDATE_CHARS)
      .optional()
      .describe(
        'For a pasted song: catalog structures per group, exactly as lyric_check takes them.'
      ),
    blueprint: blueprintField,
    subdivision: subdivisionField,
    form: formField,
    lines: linesField,
    relation: relationField,
    functions: functionsField,
    title: titleField,
    narrative: narrativeField,
    // OPTIONAL ON A CONTINUING CALL (M-221): the chat connector carries the
    // draft of the previous call beside the state, so a fold need not re-emit
    // every quoted line. A first call, or any client that carries nothing,
    // must still send it — the handler refuses an absent draft by name.
    draft: draftField.optional(),
    draft_text: draftTextField.optional(),
    voices: voicesField,
    fallback: fallbackField,
    state: z
      .string()
      .max(MAX_STATE_CHARS)
      .optional()
      .describe(
        "The `state` string returned by this tool's previous call on this song, VERBATIM. It is the harness's own deferred-run record (every answer already given, replayable by anyone); the server keeps nothing between calls, so dropping it restarts the revision from zero answers. Omit on the first call."
      ),
    run_id: z
      .string()
      .max(80)
      .optional()
      .describe(
        'The `run_id` a previous call on this song returned. Optional: without it the newest run on this seed (or mandate) is the run. Names one run when two are open on one seed.'
      ),
    new_run: z
      .boolean()
      .optional()
      .describe(
        'true to DROP the run the tool remembers for this seed and open a fresh one on the draft you send. The only way past a parked run without rewriting it, and the only way to move a declaration mid-song.'
      ),
    answer: z
      .string()
      .max(MAX_ANSWER_CHARS)
      .optional()
      .describe(
        "The writer's answer to the pending question in `state` — exactly one line of song text for a single-line question, or one `L<n>: <line>` row per line for a BATCH (several independent lines asked at once, the common case) or a group question, every marker required. It is parsed strictly and a malformed answer REFUSES rather than guessing which line goes where. Omit on the first call (there is no question yet)."
      ),
    max_rounds: z
      .number()
      .int()
      .min(1)
      .max(8)
      .optional()
      .describe(
        "The loop's round budget (ReviseDeclaration.max_rounds; this connector's default is 8). Keep it CONSTANT across one song's calls — the run replays from zero each call, and a moved budget re-derives which questions arise."
      ),
    attempts: z
      .number()
      .int()
      .min(0)
      .max(6)
      .optional()
      .describe(
        "Tier-1 attempts per flagged line (this connector's default is 1: a rejected line is re-briefed fresh next round with its rejection quoted, rather than re-asked at once). Same constancy rule as max_rounds."
      ),
    backtrack: z
      .number()
      .int()
      .min(0)
      .max(8)
      .optional()
      .describe(
        "Tier-2 backtrack width (this connector's default is 0: no group rewrite is opened on a single rejection). Same constancy rule as max_rounds."
      ),
  },
  lyric_sweep: {
    seed_from: z
      .number()
      .int()
      .min(0)
      .max(2147483000)
      .describe(
        'First seed of the window, inclusive. Non-negative: a sweep range is spelled LO-HI and a negative LO cannot be spelled.'
      ),
    count: z
      .number()
      .int()
      .min(1)
      .max(MAX_SWEEP_SEEDS)
      .describe(
        `How many consecutive seeds to plan (1-${MAX_SWEEP_SEEDS}). The window is BOUNDED so one call answers inside the client's request timeout; sweeps COMPOSE exactly — a plan is a pure function of its seed, so calling again with seed_from = next_seed_from continues the search and the counts add. This is pagination, not truncation.`
      ),
    want: z
      .array(z.string().max(MAX_WANT_CHARS))
      .max(MAX_WANTS)
      .optional()
      .describe(
        "What you want the shape to be, as predicates: NAME<=N, NAME>=N, or NAME=VALUE. The vocabulary is CLOSED and an undeclared name refuses BY NAME, printing the whole table. Counts (answer <=, >=, =): lines, sections, lines_per_section (smallest SUNG section), group (deepest rhyme group), bars_per_line, beats_per_line, slots_per_line, hook (line number, 0 if none), returns (how many verbatim-return classes), pins_per_line (most words any line is bound at), bound_words_per_line (the MEAN words bound per line, over every line — the DENSITY coordinate, and the one that answers a fraction: `pins_per_line` is a per-line CAP, so it asks whether EVERY line is under k and at song length nearly every draw puts some line at the ceiling), binding_cap (the plan's own DENSITY coordinate: the most web bindings any line was ASKED to draw, drawn per plan uniform over 1..the line-binding ceiling — binding_cap<=1 is the classic end-rhyme song with one web binding a line, and bound_words_per_line is what that draw then measured), story_lineups (how many legal story line-ups the shape admits — story_lineups>=1 filters for shapes that can carry a story at all). Function-valued (answer '=' only, comma-separated names): uses=verse,chorus means BOTH were drawn; before=verse,chorus means the first verse precedes the first chorus, and is FALSE rather than an error if either is absent. Omit entirely and every seed that plans is accepted, which is honest and useless — there is no default, because a sweep does not decide what you want."
      ),
    form: formField,
    lines: linesField,
    functions: functionsField,
  },
  lyric_verify: {
    before: draftField,
    after: draftField,
    scheme: z
      .string()
      .max(64)
      .optional()
      .describe("Letter rhyme scheme over the lines, e.g. 'ABAB' (X = free line)."),
    groups: z
      .string()
      .max(MAX_MANDATE_CHARS)
      .optional()
      .describe(
        "Rhyme groups by 1-based line numbers, e.g. '1,3;2,4'. A member may name WHERE in its line the rhyme binds: '1,3.head'. Places: end (default), endword, head, headrime, line, T<n>."
      ),
    returns: z
      .string()
      .max(MAX_MANDATE_CHARS)
      .optional()
      .describe("Verbatim-return classes by line numbers, e.g. '5,13;6,14'. Optional."),
    relation: relationField,
    // THE SAME MANDATE lyric_check GRADES UNDER (M-189): `verify` accepted
    // `--structures=` on the CLI while this schema had no field for it, so
    // a structured round was verified under a DIFFERENT mandate from the
    // one it was checked under (the M-103 §39 shape).
    structures: z
      .string()
      .max(MAX_MANDATE_CHARS)
      .optional()
      .describe(
        "Declare a catalog STRUCTURE per group, e.g. 'B:kalevala-alliteration' — exactly the field lyric_check takes, so a structured draft is VERIFIED under the mandate it was CHECKED under. Comma-separated for several: 'A:pararhyme,B:skothending'. An unknown name refuses BY NAME; cannot be combined with a song-wide `relation`."
      ),
    voices: voicesField,
    fallback: fallbackField,
    targeted: z
      .array(z.number().int().min(1).max(MAX_LINES))
      .max(MAX_LINES)
      .optional()
      .describe(
        'The 1-based lines this revision was ASKED to change. Declaring it turns on the "you quietly rewrote lines nobody asked about" rejection — one of the three silent ways a revision goes wrong. Omit and that check does not run, which is a REFUSAL on it, not evidence the revision stayed in scope.'
      ),
  },
  lyric_recover: {
    lines: draftField,
    placements: z
      .string()
      .max(200)
      .optional()
      .describe(
        "Which places in a line the recovered web searches, comma-separated (end, endword, head, headrime, T<n>); omit for the module's default set, which the report names."
      ),
    fallback: fallbackField,
  },
  lyric_check: {
    lines: draftField,
    scheme: z
      .string()
      .max(64)
      .optional()
      .describe("Letter rhyme scheme over the lines, e.g. 'ABAB' (X = free line)."),
    groups: z
      .string()
      .max(MAX_MANDATE_CHARS)
      .optional()
      .describe(
        "Rhyme groups by 1-based line numbers, e.g. '1,3;2,4' — lines 1&3 rhyme and 2&4 rhyme. Alternative to scheme. A member may also name WHERE in its line the rhyme binds: '1,3.head' asks line 3's first word to answer line 1's last; places are end (default), endword, head, headrime, line, or T<n> for the n-th word."
      ),
    // `lyric_check` builds its own mandate rather than reading a plan, so
    // the relation is a DIRECT parameter here where `lyric_grade` takes it
    // off the plan artifact. Same coordinate, and the difference is which
    // object is the mandate (doctrine 1).
    relation: relationField,
    // `--structures` WAS THE ARCHETYPE THIS FILE NAMES (see planArgs's
    // comment): a coordinate built, tested, and reachable from the outermost
    // layer by nothing. It lands HERE and not on lyric_plan/lyric_grade
    // because the `plan` verb does not accept it and the planner emits no
    // top-level `structures` key — taking it off the tool call while groups
    // and returns come off the plan artifact would be a second statement of
    // the mandate (doctrine 1). `lyric_check` builds its own mandate, so
    // there is no artifact to disagree with.
    structures: z
      .string()
      .max(MAX_MANDATE_CHARS)
      .optional()
      .describe(
        "Declare a catalog STRUCTURE per group, e.g. 'B:kalevala-alliteration' — the group's pairs are then judged by that row's own judge at its own anchors, not by the end-rhyme comparator. Comma-separated for several: 'A:pararhyme,B:skothending'. 58 rows and 33 world aliases; an unknown name refuses BY NAME. TWO CONSEQUENCES a caller must expect: the two-tier ban is SKIPPED on a structured group (the ban's tables are end-rhyme instruments), and on an English draft every declarable row is UNCALIBRATED, which the verdict says out loud in structures_uncalibrated — correctness is judged, laziness is not. Cannot be combined with a song-wide `relation`: both judge the same pairs and the relation would win on every group, so the harness refuses rather than letting a declared structure grade nothing."
      ),
    voices: voicesField,
    fallback: fallbackField,
    blueprint: blueprintField,
    subdivision: subdivisionField,
    returns: z
      .string()
      .max(MAX_MANDATE_CHARS)
      .optional()
      .describe(
        "Verbatim-return classes by line numbers, e.g. '5,13;6,14' — line 13 must repeat line 5 word for word. Optional, joins groups."
      ),
  },
  lyric_types: {
    word_a: z.string().max(MAX_WORD_CHARS).describe('First word of the pair.'),
    word_b: z.string().max(MAX_WORD_CHARS).describe('Second word of the pair.'),
  },
};

// ── registration ───────────────────────────────────────────────────────────

export function registerLyricTools(server, tool) {
  tool(
    server,
    'lyric_screen',
    {
      title: 'Screen rhyme pairs before writing',
      description:
        'Is this rhyme pair USABLE? Judged by the song grader itself on a minimal mandated pair — every unordered pair among ' +
        'the words gets a verdict: CLEAN — RHYMES, CLEAN — DOES NOT RHYME (clean means not banned; whether it rhymes is its ' +
        'own answer), BANNED (HOMEOTELEUTON — same spelled ending, the laziest true rhyme; MODAL_RHYME — ' +
        "the most predictable partner), or the grader's own refusal for an unreadable word. A banned " +
        'pair is an ANSWER, not an error. USE THIS BEFORE WRITING: screening end words first is how songs pass grading in one ' +
        "draft. Pass `relation` to ask the question a plan's drawn relation will ask (SATISFIES / VIOLATES per pair). " +
        'MEASURED 2026-09-01: ~20 s for four words cold (each pair is a full grade on a carrier pair; the lexicon loads per ' +
        'call on a cold path) — not the ~10 s this text used to promise.',
      inputSchema: LYRIC_TOOL_SCHEMAS.lyric_screen,
    },
    async (a) => {
      checkWords(a.words);
      const sargs = [...globalsFor(a), 'screen', ...a.words];
      if (a.relation) sargs.push(`--relation=${a.relation}`);
      const r = await runVerb(sargs);
      return verdictOf(r);
    }
  );

  tool(
    server,
    'lyric_plan',
    {
      title: 'Plan a song shape (seeded, reproducible)',
      description:
        'The PLANNING phase: seed in, a complete song shape out — sections with bars/meter/pickup, a rhyme plan, verbatim-return ' +
        'rules, a hook slot, and a writer brief to write to. Deterministic: the same seed always returns the same plan, and ' +
        'every free choice is disclosed beside the space it was drawn from (meters from a derived cycle grammar — expect 5/8, ' +
        '7/8, 20/8, not always 4/4). It writes NO WORDS: the writer (model or human) writes to the brief, then lyric_grade ' +
        'checks the draft against this same seed. CHOOSE THE SEED WITH lyric_sweep, not by trying a few: declare what the ' +
        "shape must be and take one of the seeds that hold (the working order's step 0) — the choice of seed is the " +
        "writer's taste and the plan's own record. Declaring a `title` answers 'is the title in the hook?' instead of " +
        'leaving it refused — and the answer can be NO, which is a FLAG, so screen the title against the hook line ' +
        'the way you screen a rhyme pair. The FIRST content block is the plan report and writer brief: when ' +
        'showing the shape, keep the bracket header rows exactly as written (they carry lines/bars/meter/pickup). The ' +
        'second block is the verdict.',
      inputSchema: LYRIC_TOOL_SCHEMAS.lyric_plan,
    },
    (a) =>
      withTempDir(async (dir) => {
        const r = await runVerb(['plan', ...planArgs(a), `--out=${path.join(dir, 'plan.json')}`]);
        const verdict = verdictOf(r);
        // Same presentation-first shape as lyric_grade: the report (plan
        // rows + writer brief, headers intact) leads as plain text.
        if (r.code === 0) {
          // The verdict block carries everything verdictOf stamped — path,
          // ms, plan_lines (M-216) — and not the report, which is block 0.
          // This block used to re-spell the verdict as {exit_code, meaning}
          // by hand, so a plan row never said which path answered or how
          // many lines the plan drew: round 9's "large drawn shape" stayed
          // an inference through round 11 for this reason (M-219).
          const { report: _report, ...stamped } = verdict;
          return {
            content: [
              { type: 'text', text: r.stdout + openRunNote(a) },
              { type: 'text', text: JSON.stringify({ ...stamped, exit_code: 0 }) },
            ],
          };
        }
        return verdict;
      })
  );

  tool(
    server,
    'lyric_grade',
    {
      title: 'Grade a draft against its plan',
      description:
        'The whole-song verdict: re-derives the plan from the SAME seed and the same declarations given to lyric_plan ' +
        '(form, lines, relation, functions, title — every one that was declared there must be declared here, or a ' +
        'DIFFERENT plan is graded), fills it with ' +
        'the draft, and grades — rhyme mandate, verbatim returns, meter fit, section functions, the slop floor. THE FIRST ' +
        'CONTENT BLOCK OF THE RESULT IS THE GRADED DRAFT rendered in performance order — an INTERIM artifact, never a ' +
        'finished song (finishing is lyric_revise, whose [FINISHED …] stamp only exists past a stop condition of the ' +
        'revise loop): when presenting it, reproduce that block ' +
        "CHARACTER FOR CHARACTER, exactly as you present a recipe string — the bracket headers carry each section's " +
        'lines, bars, meter and pickup, and restyling them to bare [SECTION] deletes the measurements the format exists ' +
        'to carry, and the [GRADED — seed …] stamp line under the song is part of the block. The second block is the ' +
        'grade verdict: FLAGS are defects with line numbers; banned_pairs counts mandated pairs on the two-tier ban ' +
        '(HOMEOTELEUTON / MODAL_RHYME) and is UNSKIPPABLE AT ANY EXIT CODE — banned_pairs above zero means the song is ' +
        'NOT finished, whatever exit_code says: replace those end words (screen replacements with lyric_screen) and ' +
        'grade again; other NOTES are measurements, not defects. Exit 0 clean, 2 refused (e.g. wrong line count), 3 ' +
        'flags standing. Revise the flagged and banned lines only and call again. ~15s.',
      inputSchema: LYRIC_TOOL_SCHEMAS.lyric_grade,
    },
    (a) =>
      withTempDir(async (dir) => {
        checkLines(a.draft);
        const draftPath = path.join(dir, 'draft.txt');
        const bpPath = path.join(dir, 'bp.json');
        const planPath = path.join(dir, 'plan.json');
        await writeFile(draftPath, a.draft.join('\n') + '\n', 'utf8');

        // 1. The plan's own mandate halves, from the plan artifact itself.
        const p1 = await runVerb(['plan', ...planArgs(a), `--out=${planPath}`]);
        if (p1.code !== 0) return verdictOf(p1);
        const plan = JSON.parse(await readFile(planPath, 'utf8'));

        // 2. Fill -> completed blueprint + the rendered song.
        const p2 = await runVerb([
          'plan',
          ...planArgs(a),
          `--fill=${draftPath}`,
          `--out=${bpPath}`,
        ]);
        if (p2.code !== 0) return verdictOf(p2);

        // 3. The grade, exactly as the plan's own GRADE IT line spells it.
        // THAT SENTENCE WAS FALSE FROM 2026-08-25 TO 2026-08-26 and the two
        // lines are worth it: `b0070e1` added `--relations=` to that line
        // (M-117) and this block went on picking THREE coordinates off the
        // artifact, so the comment kept asserting a correspondence that had
        // stopped holding. It is an EQUALITY, not a description, and
        // `mcp/test.mjs` pins it now rather than trusting it (doctrine 48).
        const songArgs = [...globalsFor(a), 'song', bpPath, draftPath];
        if (plan.groups) songArgs.push(`--groups=${plan.groups}`);
        if (plan.returns) songArgs.push(`--returns=${plan.returns}`);
        // The relation comes off the PLAN, not off the tool call, for the
        // same reason groups and returns do: the plan is the one artifact
        // that records what was asked for, and grading against anything else
        // would be a second statement of the mandate (doctrine 1).
        if (plan.relation) songArgs.push(`--relation=${plan.relation}`);
        // AND SO DOES THE PER-GROUP DRAW (M-117, shipped 2026-08-25). With no
        // `--relation=` the planner DRAWS one schema per group and records it
        // in `plan.relations`. From that day until 2026-08-26 the draw reached
        // the writer's BRIEF -- `lyric_plan` prints "... stand in X, a NAMED
        // relation, judged as itself, not as plain rhyme", 27 rows on seed 31
        // -- and reached the GRADE through NOTHING, so a plan graded here was
        // graded against a mandate the plan does not state. That is
        // `Reviser._field`'s own capitalised promise broken one layer out:
        // THE BRIEF AND THE VERDICT HAVE TO ASK THE SAME QUESTION.
        //
        // MEASURED over three fresh seeds against filler drafts, unpatched
        // against patched: 226 FLAG findings SUPPRESSED and 1 MANUFACTURED.
        // THE DROP WAS NEVER ONE-SIGNED, and the exception is the instructive
        // half: seed 1's group O is `schema:anaphora`, where token identity at
        // the head is the REQUIREMENT, and a bare `--groups=` defaults every
        // pair to REQUIRE_RHYME, where REPEAT is a violation (doctrine 3's
        // inverting band). So the connector was not grading a LOOSER mandate,
        // it was grading a DIFFERENT one.
        //
        // Sorted by label, byte-identical to `quality/plan.py`'s
        // `grading_command()` spelling (doctrine 66, and doctrine 1 -- one
        // definition of the mandate, read twice, never restated). `execFile`
        // passes ONE argv token and there is no shell, so the parentheses and
        // the apostrophe in `Scots vowel-length rhyme (Aitken's Law)` need no
        // quoting here -- unlike the printed GRADE IT line, which they broke
        // on 48 of 100 seeds until it was given `shlex.quote` the same day.
        if (plan.relations && Object.keys(plan.relations).length)
          songArgs.push(
            `--relations=${Object.keys(plan.relations)
              .sort()
              .map((k) => `${k}:${plan.relations[k]}`)
              .join(',')}`
          );
        songArgs.push('--subdivision', String(plan.subdivision));
        const p3 = await runVerb(songArgs);
        const render = extractRender(p2.stdout);
        const verdict = verdictOf(p3);
        // The SONG leads as its own plain-text block so a client presents
        // it instead of reformatting escaped JSON — the Wide Room
        // screenshot (2026-08-19) showed a Claude client rewriting the
        // bracket headers to bare [SECTION] when the render arrived as a
        // JSON field. What arrives presentation-ready gets presented.
        //
        // The stamp under the song is SERVER-written so the seed and the
        // verdict reach the user even through a client that reproduces
        // block 0 verbatim and relays nothing else (the 2026-08-19 site
        // transcript: a real plan, a real grade, and the user shown
        // neither). A bracket line is apparatus by the harness's own
        // loader rule, never song text.
        if (render) {
          const nBanned = verdict.banned_pairs || 0;
          const flagsBit =
            verdict.exit_code === 0
              ? 'no FLAG stands'
              : verdict.exit_code === 3
                ? 'FLAGS STANDING'
                : 'refused';
          const stamp =
            `[GRADED — seed ${a.seed} — exit ${verdict.exit_code}, ${flagsBit} — ` +
            `${nBanned} banned pair(s)${nBanned ? ', UNSKIPPABLE — not finished' : ''}]`;
          return {
            content: [
              { type: 'text', text: `${render}\n\n${stamp}` },
              { type: 'text', text: JSON.stringify(verdict) },
            ],
          };
        }
        return { rendered_song: null, ...verdict };
      })
  );

  tool(
    server,
    'lyric_revise',
    {
      title: 'Drive the revise loop to a stop condition (the finishing step)',
      description:
        "THE WORKING ORDER'S LAST STEP, and the only tool whose output contains a FINISHED song. It drives the " +
        "harness's revise loop over the draft against the SAME plan lyric_plan drew (same seed, same declarations, " +
        'or a DIFFERENT plan is revised): the loop grades, holds every flagged and banned line open, and ASKS — the ' +
        "first content block of a suspended call is the writer's brief for ONE question (which lines, what they " +
        'must answer, which words are FORBIDDEN as too predictable). Answer it by calling again with the SAME ' +
        'declarations (seed and the rest) plus `state` (returned verbatim by every call — the server keeps ' +
        'nothing) and `answer` (the new line, or `L<n>:` lines for a group); on such a continuing call OMIT ' +
        '`draft` where the caller carries it (the chat connector does) — the draft is one draft for the whole ' +
        'run and never changes between its calls, and re-sending it is where calls have broken. THERE IS NO SONG IN ANY RESPONSE UNTIL THE LOOP REACHES A STOP ' +
        'CONDITION: a suspended call returns [AWAITING PROPOSAL] and the question, structurally without a render, ' +
        'so a song cannot be presented that the loop never certified. At a stop condition the first block is the ' +
        'rendered song in performance order under its bracket headers with a [FINISHED — seed N — exit E — ' +
        'STOP_REASON — ...] stamp: exit 0 is converged clean; exit 3 names the lines still open, or — with no line open — ' +
        'the WHOLE-DRAFT FLAG(S) standing (a PARKED song either way — present it only as parked, never as finished; ' +
        '`status` says which of the two, and `loop_whole_flag_codes` names the flags). The two-tier ban is enforced by the loop itself ' +
        '(MANDATORY_PURSUE), not by a stamp: banned pairs hold their lines open and the loop keeps asking for ' +
        'replacements. Each call re-runs the loop from its record (deterministic, so the same questions arrive in ' +
        'the same order) — expect ~60-120s early, growing ~15s per answer on record (a late call in a long ' +
        'run can legitimately take several minutes); keep any budget fields ' +
        "constant across one song's calls.",
      inputSchema: LYRIC_TOOL_SCHEMAS.lyric_revise,
    },
    (a) =>
      withTempDir(async (dir) => {
        // M-234: the draft may arrive as one string.
        if (typeof a.draft_text === 'string' && !Array.isArray(a.draft))
          a.draft = draftFromText(a.draft_text);
        // THE RUN THE TOOL REMEMBERS (M-237). Resolved by `run_id` when the
        // call names one, else the newest run on this key. `new_run` drops
        // it. Then the tool's own refusals for a parked run, the moved
        // declaration guard, and the carry: an omitted `state`, `draft` or
        // declaration is filled from the record and SAID so on the verdict;
        // an explicit value always wins and refreshes the record.
        const runKey = runKeyOf(a);
        let runRec = a.run_id ? RUNS.byId(a.run_id) : runKey ? RUNS.get(runKey) : null;
        if (a.run_id && !runRec)
          throw refuse(
            `\`run_id\` ${a.run_id} names no run this tool remembers — it may have finished, expired (${Math.round(RUNS.ttlMs / 3600000)} h idle) or been forgotten by a restart; pass \`state\` back, or omit \`run_id\` and send the draft to open a fresh run`
          );
        if (runRec && runKey && runRec.key !== runKey)
          throw refuse(
            `\`run_id\` ${a.run_id} belongs to ${runRec.key}, and this call names ${runKey}`
          );
        if (a.new_run === true && runRec) {
          RUNS.del(runRec.key);
          runRec = null;
        }
        const runWander = runRefusal(runRec, a);
        if (runWander) throw refuse(runWander);
        const carried = { state: false, draft: false, decl: false };
        if (runRec) {
          const moved = movedDeclarations(runRec.decl, a);
          if (moved.length) throw refuse(movedRefusal(runRec, moved));
          for (const [k, v] of Object.entries(runRec.decl || {}))
            if (a[k] === undefined) {
              a[k] = v;
              carried.decl = true;
            }
          if (
            runRec.status === 'suspended' &&
            a.state == null &&
            typeof runRec.state === 'string'
          ) {
            a.state = runRec.state;
            carried.state = true;
          }
          if (runRec.status === 'suspended' && a.draft == null && Array.isArray(runRec.draft)) {
            a.draft = runRec.draft;
            carried.draft = true;
          }
        }
        if (!Array.isArray(a.draft))
          throw refuse(
            '`draft` omitted and no draft is carried for this run — pass the song lines (the SAME draft on every call of one run; the tool carries it for you after a suspended call)'
          );
        checkLines(a.draft);
        const draftPath = path.join(dir, 'draft.txt');
        const statePath = path.join(dir, 'state.json');
        await writeFile(draftPath, a.draft.join('\n') + '\n', 'utf8');
        // The caller carries the record; the server keeps nothing. The blob
        // is the harness's OWN deferred-run state (its `answered` block is a
        // valid --propose=replay: file), so the revision is reproducible by
        // anyone holding the conversation — and it cannot be forged into a
        // finished song, because every answer in it is REPLAYED through
        // verify() on this call and the render below only ever comes from
        // the verb's own run past a stop condition.
        if (a.state != null) {
          let st;
          try {
            st = JSON.parse(a.state);
          } catch {
            throw refuse('`state` is not the JSON this tool returned — pass it back VERBATIM');
          }
          if (a.answer != null) {
            if (!st || !st.pending)
              throw refuse(
                '`answer` was given and `state` holds no pending question — there is nothing it answers'
              );
            st.pending.answer = a.answer;
          }
          await writeFile(statePath, JSON.stringify(st, null, 2) + '\n', 'utf8');
        } else if (a.answer != null) {
          throw refuse('`answer` without `state` — the first call has no question to answer');
        }
        // SEEDED: `finish` reads the mandate off the plan. UNSEEDED (M-195):
        // `revise` under the declared mandate, with the same deferred state,
        // the same stop conditions and — since M-195 — the same render and
        // [FINISHED — …] stamp, so a pasted song has the same door to a
        // finished song a planned one has.
        const seeded = a.seed != null;
        const hasScheme = a.scheme != null && a.scheme !== '';
        const hasGroups = a.groups != null && a.groups !== '';
        if (seeded && (hasScheme || hasGroups || a.returns || a.structures || a.blueprint))
          throw refuse(
            'a seeded run takes its mandate and its blueprint OFF THE PLAN — drop scheme/groups/returns/structures/blueprint, or drop the seed to revise a pasted song'
          );
        if (!seeded && hasScheme === hasGroups)
          throw refuse(
            "without a seed, declare exactly one of 'scheme' or 'groups' — a pasted song's mandate is a declaration, not a default"
          );
        if (!seeded && hasScheme && !SCHEME_RE.test(a.scheme))
          throw refuse("scheme must be letters only, e.g. 'ABAB'");
        if (!seeded && hasGroups && !MANDATE_RE.test(a.groups))
          throw refuse("groups must be line numbers like '1,3;2,4', optionally naming a place");
        if (!seeded && a.returns && !RETURNS_RE.test(a.returns))
          throw refuse("returns must be line numbers like '5,13;6,14'");
        if (!seeded && a.structures && !STRUCTURES_RE.test(a.structures))
          throw refuse(
            "structures must be 'LABEL:name' pairs, comma-separated, e.g. 'A:pararhyme'"
          );
        if (a.blueprint != null && a.subdivision == null)
          throw refuse(
            '`blueprint` needs `subdivision` — the slot questions refuse rather than assume a grid'
          );
        let args;
        if (seeded) {
          args = [
            ...globalsFor(a),
            'finish',
            draftPath,
            ...planArgs(a),
            `--propose=defer:${statePath}`,
          ];
        } else {
          args = [...globalsFor(a), 'revise', draftPath];
          if (hasScheme) args.push(a.scheme);
          if (hasGroups) args.push(`--groups=${a.groups}`);
          if (a.returns) args.push(`--returns=${a.returns}`);
          if (a.relation) args.push(`--relation=${a.relation}`);
          if (a.structures) args.push(`--structures=${a.structures}`);
          if (a.blueprint != null) {
            const bpPath = path.join(dir, 'blueprint.json');
            try {
              JSON.parse(a.blueprint);
            } catch {
              throw refuse('`blueprint` is not JSON text');
            }
            await writeFile(bpPath, a.blueprint, 'utf8');
            args.push(`--blueprint=${bpPath}`, '--subdivision', String(a.subdivision));
          }
          args.push(`--propose=defer:${statePath}`);
        }
        // THE CONNECTOR'S BUDGET (M-236): one attempt per line, no
        // backtrack, eight rounds. The re-ask inside a round is where a
        // model-driven run spent most of its hops (round 21: 103 answers for
        // four rounds); under one attempt a rejected line is re-briefed
        // fresh next round with its rejection quoted, the batch door asks
        // the round's independent lines together, and the rounds are cheap
        // enough to have more of. Tier 2's backtrack is off on this path
        // for the same reason: with one attempt every rejection would open
        // a group rewrite at once. A model that declares its own values
        // keeps them; the carried declarations (M-229) hold whichever
        // applied for the run's whole life, so the budget never moves
        // mid-run.
        const budget = {
          max_rounds: a.max_rounds ?? CONNECTOR_MAX_ROUNDS,
          attempts: a.attempts ?? CONNECTOR_ATTEMPTS,
          backtrack: a.backtrack ?? CONNECTOR_BACKTRACK,
        };
        args.push(`--max-rounds=${budget.max_rounds}`);
        args.push(`--attempts=${budget.attempts}`);
        args.push(`--backtrack=${budget.backtrack}`);
        const r = await runVerb(args);
        if (r.code === 4) {
          // Suspended: the verb wrote the state (question folded in) and
          // printed the brief. NO RENDER EXISTS in this output — the verb's
          // render call sits after the loop's return — so this branch has
          // nothing to leak even if it tried.
          const st = JSON.parse(await readFile(statePath, 'utf8'));
          const onRecord = st.answered.propose.length + st.answered.propose_group.length;
          const askedNow = askedOf(st.pending);
          const batchNote =
            askedNow &&
            askedNow.kind === 'propose_batch' &&
            Array.isArray(askedNow.lines) &&
            askedNow.lines.length
              ? ` BATCH: answer ${askedNow.lines.map((n) => `L${n}`).join(', ')} as one \`L<n>: <line>\` row each, every one required.`
              : '';
          // The bracketed stamp keeps its shape (readers pin on it); the
          // batch note follows it on the same line (M-236).
          const head = `[AWAITING PROPOSAL — ${a.seed != null ? `seed ${a.seed}` : 'declared mandate'} — ${onRecord} answer(s) on record — NO SONG YET]${batchNote}`;
          // M-237: the tool remembers the run; the client may omit `state`
          // and `draft` on the next call.
          const runNow = runKey
            ? RUNS.put(runKey, {
                seed: typeof a.seed === 'number' ? a.seed : null,
                status: 'suspended',
                state: JSON.stringify(st),
                draft: a.draft,
                decl: declarationsOf(a),
                answers: onRecord,
                run_id: runRec?.run_id ?? newRunId(runKey),
              })
            : null;
          const continueNote =
            `\n\nCONTINUE: call lyric_revise with \`seed\` and \`answer\`` +
            (askedNow && askedNow.kind === 'propose_batch'
              ? ' (one `L<n>: <line>` row per asked line)'
              : '') +
            (runNow
              ? ` — the state and the draft are carried for you (run ${runNow.run_id}); \`state\` passed back verbatim also works.`
              : '.');
          return {
            content: [
              {
                type: 'text',
                text: `${head}\n\n${(st.pending && st.pending.prompt) || r.stdout}${continueNote}`,
              },
              {
                type: 'text',
                text: JSON.stringify({
                  exit_code: 4,
                  status: 'awaiting_proposal',
                  kind: st.pending ? st.pending.kind : null,
                  answers_on_record: onRecord,
                  // M-235: the question this call left open, the question its
                  // `answer` folded and what verify made of that answer.
                  asked: askedNow,
                  folded: foldedOf(a.state, st, budget.attempts),
                  run_id: runNow ? runNow.run_id : null,
                  run_state_carried: carried.state,
                  run_draft_carried: carried.draft,
                  run_decl_carried: carried.decl,
                  answer_sent: typeof a.answer === 'string' ? a.answer.slice(0, 300) : null,
                  draft_fp: draftFp(a.draft),
                  // THE SUSPENDED VERDICT IS THE COMMON ROW OF A REAL RUN — 32
                  // of round 11's 33 rows — and it was built here by hand,
                  // without the path and time `verdictOf` stamps (M-216), so
                  // the one row that could have said warm or cold never did
                  // (M-219's second finding, the third spelling of it).
                  path: typeof r.path === 'string' ? r.path : null,
                  ms: typeof r.ms === 'number' ? r.ms : null,
                  ...extractRunRecord(r.stdout),
                  state: JSON.stringify(st),
                }),
              },
            ],
          };
        }
        if (r.code === 0 || r.code === 3) {
          const m = r.stdout.match(/THE SONG, PERFORMANCE ORDER:\n\n([\s\S]*?\[FINISHED[^\]]*\])/);
          const verdict = verdictOf(r);
          verdict.status = loopStatusOf(r.code, verdict);
          // M-235: the last answer's verdict and the draft this stop was
          // reached on ride with the stop row, so a cycle is readable from
          // the rows alone.
          verdict.draft_fp = draftFp(a.draft);
          // M-237: exit 3 PARKS the record (no state — no question pending);
          // exit 0 forgets it.
          verdict.run_state_carried = carried.state;
          verdict.run_draft_carried = carried.draft;
          verdict.run_decl_carried = carried.decl;
          if (runKey && r.code === 3) {
            const parkedRec = RUNS.put(runKey, {
              seed: typeof a.seed === 'number' ? a.seed : null,
              status: 'parked',
              draft: a.draft,
              decl: declarationsOf(a),
              stop: verdict.loop_stop_reason ?? null,
              open: Array.isArray(verdict.loop_unresolved_lines)
                ? verdict.loop_unresolved_lines
                : [],
              whole: Array.isArray(verdict.loop_whole_flag_codes)
                ? verdict.loop_whole_flag_codes
                : [],
              standing: Array.isArray(verdict.standing) ? verdict.standing.slice(0, 24) : [],
              run_id: runRec?.run_id ?? newRunId(runKey),
            });
            verdict.run_id = parkedRec.run_id;
          } else if (runKey && r.code === 0) {
            RUNS.del(runKey);
            verdict.run_id = runRec?.run_id ?? null;
          }
          verdict.song_at_stop = m
            ? m[1].replace(/\n\n\[FINISHED[\s\S]*$/, '').slice(0, 4000)
            : null;
          try {
            const st = JSON.parse(await readFile(statePath, 'utf8'));
            verdict.answers_on_record =
              st.answered.propose.length + st.answered.propose_group.length;
            verdict.folded = foldedOf(a.state, st, budget.attempts);
            // A finished deferred run is a RECORDED run: hand the record
            // back so the song's provenance travels with the conversation.
            verdict.state = JSON.stringify(st);
          } catch {
            /* state unreadable: the verdict still stands on the verb's own run */
          }
          if (m) {
            // M-232: the standing findings ride with the render, so a
            // parked song names what each open line still carries.
            const standingText =
              Array.isArray(verdict.standing) && verdict.standing.length
                ? '\n\nSTANDING AT THE STOP — what the open lines and the whole draft still carry:\n' +
                  verdict.standing.map((x) => `  ${x}`).join('\n')
                : '';
            const parkNote =
              r.code === 3
                ? `\n\nCONTINUE: no question is pending. Rewrite the open line(s) and call lyric_revise with \`seed\` and \`draft_text\` (the full song as ONE newline-separated string) — no \`answer\`, no \`state\`${verdict.run_id ? ` (run ${verdict.run_id}; \`new_run: true\` starts over instead)` : ''}.`
                : '';
            return {
              content: [
                { type: 'text', text: m[1] + standingText + parkNote },
                { type: 'text', text: JSON.stringify(verdict) },
              ],
            };
          }
          return verdict;
        }
        return verdictOf(r);
      })
  );

  tool(
    server,
    'lyric_sweep',
    {
      title: 'Find seeds whose shape matches what you want',
      description:
        'A plan is a pure function of its seed, so choosing a seed is choosing a shape — and guessing one is how a ' +
        'writer ends up accepting whatever the first seed drew. Declare what you want (predicates over coordinates ' +
        'the plan already discloses) and this plans a WINDOW of consecutive seeds and returns the ones that hold. ' +
        'IT DOES NOT RANK: the accepted seeds come back in seed order and carry no score, because a floor enforces ' +
        'and does not order the region it already passed, and an argmax over a swept parameter is biased toward ' +
        'whichever end has more freedom. Pick from the list on taste, then call lyric_plan with that seed. THREE ' +
        'COUNTS, NEVER SUMMED: swept, planned, planner_refused, and accepted — planner_refused is the planner ' +
        'turning a request down (an unbuildable roster, an unattainable length) and is NOT a predicate rejecting a ' +
        'shape, so `planned 0` means the DECLARATION is unbuildable and the predicates never ran. The window is ' +
        `bounded at ${MAX_SWEEP_SEEDS} seeds per call and sweeps compose exactly — continue from next_seed_from ` +
        'and add the counts. ~15s at the full window.',
      inputSchema: LYRIC_TOOL_SCHEMAS.lyric_sweep,
    },
    async (a) => {
      const from = a.seed_from;
      const n = a.count;
      const wants = (a.want || []).map((w) => String(w).trim()).filter(Boolean);
      for (const w of wants)
        if (!WANT_RE.test(w))
          throw refuse(
            `'${w}' is not a predicate — write NAME<=N, NAME>=N or NAME=VALUE ` +
              "(the names are listed in this tool's `want` description, and an " +
              'undeclared one refuses by name with the whole table)'
          );
      // HI IS EXCLUSIVE in the harness (`range(lo, hi)`), so composing the
      // range HERE from a count rather than asking the caller for an endpoint
      // removes the off-by-one from the caller entirely — and makes the
      // CLI's lenient spellings (`5--10`, `1-2-3`, a negative LO) unreachable
      // by construction rather than by validation.
      const args = ['plan', `--sweep=${from}-${from + n}`];
      if (wants.length) args.push(`--want=${wants.join(';')}`);
      if (a.form) args.push(`--form=${a.form}`);
      if (a.lines != null) args.push(`--lines=${a.lines}`);
      if (a.functions) args.push(`--functions=${a.functions}`);
      const r = await runVerb(args);
      const v = verdictOf(r);
      const counts = extractSweep(r.stdout);
      if (counts) {
        Object.assign(v, counts);
        v.window = { seed_from: from, count: n, next_seed_from: from + n };
        // TWO MEANINGS THE CONNECTOR OWNS, both derived from the printed
        // counts and neither invented. The harness's own headline on an
        // empty accepted set blames the PREDICATES — which is wrong when the
        // planner refused every seed, a case reachable with no predicate
        // declared at all.
        if (counts.planned === 0)
          v.window_meaning =
            'the planner refused EVERY seed in this window, so the DECLARATION ' +
            '(form / lines / functions) is unbuildable — the predicates never ran, ' +
            'and this says nothing about them.';
        else if (r.code === 2)
          v.window_meaning =
            'no seed in THIS WINDOW satisfies every predicate. That is a statement ' +
            'about these seeds, not about the declaration: continue from ' +
            'next_seed_from, or drop a predicate — the acceptance rate above is the ' +
            'measurement that says which.';
      }
      return v;
    }
  );

  tool(
    server,
    'lyric_verify',
    {
      title: 'Did this revision earn it?',
      description:
        'The other half of a revision round. lyric_check briefs a draft; this judges a CHANGE to one — hand it the ' +
        'lines BEFORE and AFTER under the same mandate and it answers whether the revision earned its place. Three ' +
        'ways a revision goes wrong and all three are silent: it fixes the flagged line and breaks another, it ' +
        'fixes the rhyme by taking the most predictable word in the field, or it quietly rewrites lines nobody ' +
        'asked about. Declare `targeted` to turn the third one on. READ `accepted`, NOT `exit_code`: this verb ' +
        'exits 0 for ACCEPTED and REJECTED alike, because the verdict is an answer and not an error. IT IS A DIFF, ' +
        'NOT A GRADE — it reports what this change fixed and introduced, and says nothing about defects that ' +
        'survived it untouched, so it does not and cannot report banned pairs. For "is the song finished", use ' +
        'lyric_grade or lyric_check. ~25s.',
      inputSchema: LYRIC_TOOL_SCHEMAS.lyric_verify,
    },
    (a) =>
      withTempDir(async (dir) => {
        checkLines(a.before);
        checkLines(a.after);
        const hasScheme = a.scheme != null && a.scheme !== '';
        const hasGroups = a.groups != null && a.groups !== '';
        if (hasScheme === hasGroups)
          throw refuse(
            "declare exactly one of 'scheme' or 'groups' — a verify with no mandate has nothing to judge the change against"
          );
        if (hasScheme && !SCHEME_RE.test(a.scheme))
          throw refuse("scheme must be letters only, e.g. 'ABAB'");
        if (hasGroups && !MANDATE_RE.test(a.groups))
          throw refuse("groups must be line numbers like '1,3;2,4', optionally naming a place");
        if (a.returns && !RETURNS_RE.test(a.returns))
          throw refuse("returns must be line numbers like '5,13;6,14'");
        const bPath = path.join(dir, 'before.txt');
        const aPath = path.join(dir, 'after.txt');
        await writeFile(bPath, a.before.join('\n') + '\n', 'utf8');
        await writeFile(aPath, a.after.join('\n') + '\n', 'utf8');
        if (a.structures && !STRUCTURES_RE.test(a.structures))
          throw refuse(
            "structures must be 'LABEL:name' pairs, comma-separated, e.g. 'A:pararhyme'"
          );
        const args = [...globalsFor(a), 'verify', bPath, aPath];
        if (hasScheme) args.push(a.scheme);
        if (hasGroups) args.push(`--groups=${a.groups}`);
        if (a.returns) args.push(`--returns=${a.returns}`);
        if (a.relation) args.push(`--relation=${a.relation}`);
        if (a.structures) args.push(`--structures=${a.structures}`);
        // TARGETED IS A TRAILING POSITIONAL, and it is the sole gate on the
        // untargeted-rewrite rejection. This repo has already recorded what
        // happens when it is parsed and not read: `targeted = None` left the
        // whole verb suite green.
        if (a.targeted && a.targeted.length) args.push(...a.targeted.map(String));
        const r = await runVerb(args);
        return verifyVerdictOf(r);
      })
  );

  tool(
    server,
    'lyric_recover',
    {
      title: 'Structure a pasted song (the second door into the pipeline)',
      description:
        "THE FIRST STEP FOR LYRICS A HUMAN PASTES, before lyric_check: the owner's rule is that a pasted song " +
        'goes through every step a planned one does, and the first step is to STRUCTURE it. The harness counts the ' +
        'lines and the syllables per line, reads [SECTION] marks (or blank lines) into sections, and RECOVERS the ' +
        'rhyme web as a cover over places in each line — every coordinate stamped with how it was obtained (counted / ' +
        'declared / derived / REFUSED). A REFUSED coordinate is a work order, never a guess: the meter is refused ' +
        '(counting gives syllables, not a bar grid — declare one), and a REPEAT edge that binds inside a line has no ' +
        'mandate spelling and is named. The verdict carries `mandate` — the `groups` and `returns` strings to pass to ' +
        'lyric_check / lyric_revise so the graders judge the cover the text actually carries — and `refusals`, the ' +
        'coordinates the caller must declare. Exit 3 means at least one coordinate was refused (the ordinary case: ' +
        'meter); exit 0 means every coordinate was recovered. Derived coordinates are NOT independent of the grader ' +
        '(doctrine 14): a recovered web graded at the same theta cannot fail on rhyme, and the report says so. ' +
        'TWO THINGS THE CALLER DECIDES (2026-09-02): pass blank stanza breaks as EMPTY entries in `lines` — they ' +
        'are how sections derive when the text carries no [SECTION] marks, and a list with the blanks stripped has ' +
        'its sectioning REFUSED; and `placements` narrows the cover — the default four places over a 32-line song ' +
        "recover ~670 pair-groups (10k characters), which the graders accept and judge far outside this connector's " +
        "clock (a `brief` on that cover measured 398 s against a 60 s client default), so `placements: 'end'` is the connector-sized cover for anything longer than a few lines.",
      inputSchema: LYRIC_TOOL_SCHEMAS.lyric_recover,
    },
    (a) =>
      withTempDir(async (dir) => {
        checkLines(a.lines);
        if (a.placements != null && !/^[A-Za-z0-9]+(,[A-Za-z0-9]+)*$/.test(a.placements))
          throw refuse("placements must be names like 'end,head,T4', comma-separated");
        const draftPath = path.join(dir, 'draft.txt');
        await writeFile(draftPath, a.lines.join('\n') + '\n', 'utf8');
        const args = [...globalsFor(a), 'recover', draftPath];
        if (a.placements) args.push(`--placements=${a.placements}`);
        const r = await runVerb(args);
        const v = verdictOf(r);
        if (r.code === 0 || r.code === 3) {
          v.meaning =
            r.code === 0
              ? 'recovered — every coordinate obtained; none refused'
              : 'recovered with REFUSALS — the coordinates named under `refusals` must be DECLARED by the caller before the graders can ask about them (the meter, always: counting gives syllables, not a grid)';
          const m = extractRecoveredMandate(r.stdout);
          if (m) v.mandate = m;
          v.refusals = extractRecoverRefusals(r.stdout);
        }
        return v;
      })
  );

  tool(
    server,
    'lyric_check',
    {
      title: 'Check pasted lyrics against a declared rhyme plan',
      description:
        'For lyrics that were NOT written to a lyric_plan (a human pasting their own song): declare what the lyrics claim — a ' +
        "letter scheme ('ABAB', X = free) OR rhyme groups by line number ('1,3;2,4'), optionally verbatim-return classes — " +
        'and get the same rhyme grading and slop floor the full pipeline runs. A declaration is REQUIRED: nothing declared ' +
        'means nothing mandated, and "nothing flagged" about that would be a vacuous pass. FLAGS are defects with line ' +
        'numbers; banned_pairs counts declared pairs on the two-tier ban (HOMEOTELEUTON / MODAL_RHYME), unskippable at ' +
        "any exit code; other NOTES are measurements. THE EXIT CODE IS brief's, whose gates are song's alone: `flags` " +
        'and `whole_flags` in the verdict say what STANDS at exit 0, and `unreadable` names the pairs that were NOT judged. ' +
        'MEASURED 2026-09-01: ~20 s for a four-line draft cold, and it grows with the line count (a 16-line song grades in ' +
        '~90-170 s) — not the ~10 s this text used to promise. A client with a 60 s default timeout must raise it.',
      inputSchema: LYRIC_TOOL_SCHEMAS.lyric_check,
    },
    (a) =>
      withTempDir(async (dir) => {
        checkLines(a.lines);
        const hasScheme = a.scheme != null && a.scheme !== '';
        const hasGroups = a.groups != null && a.groups !== '';
        if (hasScheme === hasGroups)
          throw refuse(
            "declare exactly one of 'scheme' or 'groups' — the mandate is a choice, not a default"
          );
        if (hasScheme && !SCHEME_RE.test(a.scheme))
          throw refuse("scheme must be letters only, e.g. 'ABAB'");
        if (hasGroups && !MANDATE_RE.test(a.groups))
          throw refuse(
            "groups must be line numbers like '1,3;2,4', each optionally " +
              "naming a place in its line — '1,3.head;2,4' binds line 3's " +
              "FIRST word to line 1's last. Places: end (the default), " +
              'endword, head, headrime, line, or T<n> for the n-th word'
          );
        if (a.returns && !RETURNS_RE.test(a.returns))
          throw refuse("returns must be line numbers like '5,13;6,14'");
        // CHARSET ONLY, and the vocabulary is deliberately NOT restated here.
        // The catalog is 58 rows and 33 aliases whose names carry '(', ')',
        // ',' and '-'; a second copy of a closed vocabulary in JS is the copy
        // that goes stale (doctrine 1), and the harness already refuses an
        // unknown name BY NAME and prints the catalog's size. This guard is
        // argv safety: a leading '-' would become a flag.
        if (a.structures && !STRUCTURES_RE.test(a.structures))
          throw refuse(
            'structures must be LABEL:NAME entries, e.g. ' +
              "'B:kalevala-alliteration' or 'A:pararhyme,B:skothending' — a " +
              'label is a group letter or a 1-based index, and a name is a ' +
              'catalog row or world alias (ask lyric_types for the vocabulary)'
          );
        const draftPath = path.join(dir, 'draft.txt');
        await writeFile(draftPath, a.lines.join('\n') + '\n', 'utf8');
        if (a.blueprint != null && a.subdivision == null)
          throw refuse(
            '`blueprint` needs `subdivision` — the slot questions refuse rather than assume a grid'
          );
        const args = [...globalsFor(a), 'brief', draftPath];
        if (hasScheme) args.push(a.scheme);
        if (hasGroups) args.push(`--groups=${a.groups}`);
        if (a.returns) args.push(`--returns=${a.returns}`);
        if (a.relation) args.push(`--relation=${a.relation}`);
        // The relation/structures collision is REFUSED BY THE HARNESS
        // (`MISSING.md` M-102), not re-decided here: a second copy of that
        // rule in JS is a second place for it to drift, and the harness's
        // refusal names both coordinates and the spelling that works.
        if (a.structures) args.push(`--structures=${a.structures}`);
        // THE BLUEPRINT (M-195): with it `brief` asks meter, song-function,
        // hook and title of a pasted song, exactly as `song` asks them of a
        // planned one; the verdict's `blueprint_declared` says which ran.
        if (a.blueprint != null) {
          const bpPath = path.join(dir, 'blueprint.json');
          try {
            JSON.parse(a.blueprint);
          } catch {
            throw refuse('`blueprint` is not JSON text');
          }
          await writeFile(bpPath, a.blueprint, 'utf8');
          args.push(`--blueprint=${bpPath}`, '--subdivision', String(a.subdivision));
        }
        const r = await runVerb(args);
        const v = verdictOf(r);
        v.blueprint_declared = a.blueprint != null;
        return v;
      })
  );

  tool(
    server,
    'lyric_types',
    {
      title: 'Classify one rhyme pair (the 9-axis coordinate)',
      description:
        'The full rhyme-type coordinate for one word pair: per-syllable agreement, anchor, identity, stress, boundary, ' +
        'traditional names where the coordinate has one. Taxonomy, not judgement — for the usable-or-banned verdict use ' +
        'lyric_screen. MEASURED 2026-09-01: ~1 s.',
      inputSchema: LYRIC_TOOL_SCHEMAS.lyric_types,
    },
    async (a) => {
      checkWords([a.word_a, a.word_b]);
      const r = await runVerb(['types', a.word_a, '--', a.word_b]);
      return verdictOf(r);
    }
  );
}

//: The paragraph buildServer appends to the server instructions — the same
//: text the Gemini chat receives as its system prompt (buildSurface reads
//: the live instructions), so the two surfaces stay one description.
export const LYRIC_INSTRUCTIONS =
  ' BESIDE THE RECIPES, AND NEVER TOUCHING THEM, the lyric_* family is a songwriting ' +
  'harness (plan and grade; it writes no words — the writer is you or the user). The working order that ' +
  'produces one-draft songs: (0) lyric_sweep to CHOOSE the seed rather than guess it — declare what you ' +
  'want the shape to be and it returns the seeds that hold, in seed order, unranked; ' +
  '(1) lyric_screen candidate end-word pairs BEFORE writing — a banned pair ' +
  '(HOMEOTELEUTON/MODAL_RHYME) is an answer, pick different words; (2) lyric_plan with a declared integer ' +
  'seed for a complete shape (sections, meter — often not 4/4, rhyme plan, hook slot) and write to its ' +
  'brief, honoring the verbatim returns — declare the `title` here if the song has one, because an ' +
  'undeclared title leaves "is the title in the hook?" REFUSED and a declared one that is not a run of ' +
  'words inside the hook line is a FLAG; (3) lyric_grade with the SAME seed AND THE SAME DECLARATIONS ' +
  '(form, lines, relation, functions, title — a declaration dropped here grades a different plan) and ' +
  'the draft — its render is the INTERIM graded draft, and the [GRADED — seed …] stamp under it is a ' +
  'grade, not a finish; (4) lyric_revise with the SAME seed and declarations, called repeatedly — it ' +
  'drives the revise loop, asks one question per suspended call (answer with `state` passed back ' +
  'verbatim plus `answer`), and returns a song ONLY past a stop condition, under a [FINISHED — seed … — ' +
  'exit …] stamp. THE FINISHED SONG COMES FROM lyric_revise AND NOWHERE ELSE: a song presented without ' +
  'its [FINISHED …] stamp is an interim draft and must be presented as one, and stopping at step (3) ' +
  'because the draft "looks done" is the exact hand-wash the loop exists to end — the loop, not you, ' +
  'says when revision is over. THE BAN IS UNSKIPPABLE: a grade verdict with banned_pairs above zero is ' +
  'the harness answering ' +
  'NO — the song is not finished even at exit 0, and inside lyric_revise those pairs hold their lines ' +
  'open mechanically (MANDATORY_PURSUE). Replace the banned end words (screen the replacements ' +
  'with lyric_screen) and keep answering; never present a song as finished while banned pairs stand. ' +
  'PRESENTATION IS PART OF THE CONTRACT: the first content block returned by lyric_grade and lyric_plan ' +
  'is the deliverable — reproduce it character for character, exactly as you reproduce a recipe string; ' +
  'the bracket headers ([CHORUS — 3 lines — 6 bars of 6/8, half-beat pickup]) are measurements, ' +
  'restyling them to bare [CHORUS] deletes what the format exists to carry, and the [GRADED — seed …] ' +
  'stamp line under the song is part of the block and reaches the user with it. For lyrics a user ' +
  "pastes, the SAME steps as a planned song (the owner's rule): lyric_recover FIRST to structure them (blank " +
  "stanza breaks as empty entries; `placements: 'end'` for anything longer than a few lines) — it hands " +
  'back the `mandate` (groups/returns) the text actually carries and the coordinates it REFUSED (the meter, ' +
  'always) for the user to declare — then lyric_check with that mandate (and a declared blueprint + subdivision ' +
  'when the user gives the grid), then lyric_revise WITHOUT a seed and with the same mandate to drive the loop ' +
  'to a stop condition; a bare lyric_check on a paste is the rhyme and floor layers only, and its verdict says ' +
  'so. lyric_verify judges a CHANGE to one, ' +
  'which is the other half of a revision round: read its `accepted`, not its exit code, and remember it is a ' +
  'DIFF that cannot report banned pairs surviving untouched. FLAGS are defects; banned pairs are ' +
  'unskippable whatever their severity; other NOTES are measurements and are not to be "fixed". A verdict ' +
  'carrying structures_uncalibrated is the third thing to read: correctness IS graded for that declared ' +
  'structure and laziness is NOT, the two-tier ban is skipped on its pairs, and an absent banned_pairs ' +
  'there means the question was not asked rather than answered clean. Recipes ' +
  'describe the SOUND, lyric tools govern the WORDS; the conversation is the only place they meet.';
