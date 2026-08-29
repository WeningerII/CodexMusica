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
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { TOOL_BUDGET_MS } from './budget.js';

const HARNESS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'lyric-harness');
const PYTHON = process.env.LYRIC_PYTHON || 'python3';

// ── ceilings (every one refused loudly, none silently clamped) ─────────────
const MAX_WORDS = 12;
const MAX_WORD_CHARS = 40;
const MAX_LINES = 64; // the planner envelope's own total_lines ceiling
const MAX_LINE_CHARS = 200;
const MAX_MANDATE_CHARS = 400;
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
  w.on('exit', () => {
    if (_worker === w) _killWorker();
  });
  w.on('error', () => {
    if (_worker === w) _killWorker();
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
  return enqueue(() =>
    WORKER_ENABLED
      ? _runVerbWarm(args).catch((e) =>
          e && e.timedOut ? { code: -1, stdout: '', stderr: String(e.message) } : _runVerbCold(args)
        )
      : _runVerbCold(args)
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
function extractLoopRecord(report) {
  const m =
    /\[FINISHED\s*—\s*seed\s*(-?\d+)\s*—\s*exit\s*(\d+)\s*—\s*([A-Z_]+)\s+after\s+(\d+)\s+round\(s\)\s*—\s*(?:UNRESOLVED:\s*([^\]]*)|no flag stands)\]/.exec(
      report
    );
  if (!m) return null;
  const lines = (m[5] || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return {
    seed: Number(m[1]),
    stop_reason: m[3],
    rounds: Number(m[4]),
    unresolved: lines.length,
    unresolved_lines: lines,
  };
}

function verdictOf(r) {
  const banned = extractBannedPairs(r.stdout);
  const uncalibrated = extractUncalibrated(r.stdout);
  const loop = extractLoopRecord(r.stdout);
  const v = {
    exit_code: r.code,
    meaning: EXIT_MEANING[r.code] || `subprocess failure (${r.code}): ${r.stderr.slice(0, 400)}`,
  };
  if (loop) {
    // THREE COUNTS, NEVER SUMMED (doctrine 79): rounds spent, lines still open
    // and answers on record answer different questions. `stop_reason` is the
    // loop's own vocabulary (SUCCESS / NO_PROGRESS / ROUND_LIMIT) and is not
    // re-spelled here.
    v.loop_stop_reason = loop.stop_reason;
    v.loop_rounds = loop.rounds;
    v.loop_unresolved = loop.unresolved;
    v.loop_unresolved_lines = loop.unresolved_lines;
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

const draftField = z
  .array(z.string().max(MAX_LINE_CHARS))
  .min(1)
  .max(MAX_LINES)
  .describe(
    'The song lines in performance order, one string per line, repeated sections written out in full. No [SECTION] markers.'
  );

export const LYRIC_TOOL_SCHEMAS = {
  lyric_screen: {
    words: z
      .array(z.string().max(MAX_WORD_CHARS))
      .min(2)
      .max(MAX_WORDS)
      .describe('2-12 bare words; every unordered pair among them is screened.'),
  },
  lyric_plan: {
    seed: seedField,
    form: formField,
    lines: linesField,
    relation: relationField,
    functions: functionsField,
    title: titleField,
  },
  lyric_grade: {
    seed: seedField,
    form: formField,
    lines: linesField,
    relation: relationField,
    functions: functionsField,
    title: titleField,
    draft: draftField,
  },
  lyric_revise: {
    seed: seedField,
    form: formField,
    lines: linesField,
    relation: relationField,
    functions: functionsField,
    title: titleField,
    draft: draftField,
    state: z
      .string()
      .max(MAX_STATE_CHARS)
      .optional()
      .describe(
        "The `state` string returned by this tool's previous call on this song, VERBATIM. It is the harness's own deferred-run record (every answer already given, replayable by anyone); the server keeps nothing between calls, so dropping it restarts the revision from zero answers. Omit on the first call."
      ),
    answer: z
      .string()
      .max(MAX_ANSWER_CHARS)
      .optional()
      .describe(
        "The writer's answer to the pending question in `state` — exactly one line of song text for a single-line question, or one `L<n>: <line>` per member for a group question, markers required. It is parsed strictly and a malformed answer REFUSES rather than guessing which line goes where. Omit on the first call (there is no question yet)."
      ),
    max_rounds: z
      .number()
      .int()
      .min(1)
      .max(8)
      .optional()
      .describe(
        "The loop's round budget (ReviseDeclaration.max_rounds, default 4). Keep it CONSTANT across one song's calls — the run replays from zero each call, and a moved budget re-derives which questions arise."
      ),
    attempts: z
      .number()
      .int()
      .min(0)
      .max(6)
      .optional()
      .describe('Tier-1 attempts per flagged line (default 3). Same constancy rule as max_rounds.'),
    backtrack: z
      .number()
      .int()
      .min(0)
      .max(8)
      .optional()
      .describe('Tier-2 backtrack width (default 5). Same constancy rule as max_rounds.'),
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
        "What you want the shape to be, as predicates: NAME<=N, NAME>=N, or NAME=VALUE. The vocabulary is CLOSED and an undeclared name refuses BY NAME, printing the whole table. Counts (answer <=, >=, =): lines, sections, lines_per_section (smallest SUNG section), group (deepest rhyme group), bars_per_line, beats_per_line, slots_per_line, hook (line number, 0 if none), returns (how many verbatim-return classes), pins_per_line (most words any line is bound at), story_lineups (how many legal story line-ups the shape admits — story_lineups>=1 filters for shapes that can carry a story at all). Function-valued (answer '=' only, comma-separated names): uses=verse,chorus means BOTH were drawn; before=verse,chorus means the first verse precedes the first chorus, and is FALSE rather than an error if either is absent. Omit entirely and every seed that plans is accepted, which is honest and useless — there is no default, because a sweep does not decide what you want."
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
    targeted: z
      .array(z.number().int().min(1).max(MAX_LINES))
      .max(MAX_LINES)
      .optional()
      .describe(
        'The 1-based lines this revision was ASKED to change. Declaring it turns on the "you quietly rewrote lines nobody asked about" rejection — one of the three silent ways a revision goes wrong. Omit and that check does not run, which is a REFUSAL on it, not evidence the revision stayed in scope.'
      ),
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
        'draft. ~10s per call (the pronunciation lexicon loads per process).',
      inputSchema: LYRIC_TOOL_SCHEMAS.lyric_screen,
    },
    async (a) => {
      checkWords(a.words);
      const r = await runVerb(['screen', ...a.words]);
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
        'checks the draft against this same seed. Try a few seeds and pick the shape that sings — the choice of seed is the ' +
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
          return {
            content: [
              { type: 'text', text: r.stdout },
              { type: 'text', text: JSON.stringify({ exit_code: 0, meaning: verdict.meaning }) },
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
        const songArgs = ['song', bpPath, draftPath];
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
        'arguments plus `state` (returned verbatim by every call — the server keeps nothing) and `answer` (the new ' +
        'line, or `L<n>:` lines for a group). THERE IS NO SONG IN ANY RESPONSE UNTIL THE LOOP REACHES A STOP ' +
        'CONDITION: a suspended call returns [AWAITING PROPOSAL] and the question, structurally without a render, ' +
        'so a song cannot be presented that the loop never certified. At a stop condition the first block is the ' +
        'rendered song in performance order under its bracket headers with a [FINISHED — seed N — exit E — ' +
        'STOP_REASON — ...] stamp: exit 0 is converged clean; exit 3 names the lines still open (a PARKED song — ' +
        'present it only as parked, never as finished). The two-tier ban is enforced by the loop itself ' +
        '(MANDATORY_PURSUE), not by a stamp: banned pairs hold their lines open and the loop keeps asking for ' +
        'replacements. Each call re-runs the loop from its record (deterministic, so the same questions arrive in ' +
        'the same order) — expect ~60-120s early, growing ~15s per answer on record (a late call in a long ' +
        'run can legitimately take several minutes); keep any budget fields ' +
        "constant across one song's calls.",
      inputSchema: LYRIC_TOOL_SCHEMAS.lyric_revise,
    },
    (a) =>
      withTempDir(async (dir) => {
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
        const args = ['finish', draftPath, ...planArgs(a), `--propose=defer:${statePath}`];
        if (a.max_rounds != null) args.push(`--max-rounds=${a.max_rounds}`);
        if (a.attempts != null) args.push(`--attempts=${a.attempts}`);
        if (a.backtrack != null) args.push(`--backtrack=${a.backtrack}`);
        const r = await runVerb(args);
        if (r.code === 4) {
          // Suspended: the verb wrote the state (question folded in) and
          // printed the brief. NO RENDER EXISTS in this output — the verb's
          // render call sits after the loop's return — so this branch has
          // nothing to leak even if it tried.
          const st = JSON.parse(await readFile(statePath, 'utf8'));
          const onRecord = st.answered.propose.length + st.answered.propose_group.length;
          const head = `[AWAITING PROPOSAL — seed ${a.seed} — ${onRecord} answer(s) on record — NO SONG YET]`;
          return {
            content: [
              { type: 'text', text: `${head}\n\n${(st.pending && st.pending.prompt) || r.stdout}` },
              {
                type: 'text',
                text: JSON.stringify({
                  exit_code: 4,
                  status: 'awaiting_proposal',
                  kind: st.pending ? st.pending.kind : null,
                  answers_on_record: onRecord,
                  state: JSON.stringify(st),
                }),
              },
            ],
          };
        }
        if (r.code === 0 || r.code === 3) {
          const m = r.stdout.match(/THE SONG, PERFORMANCE ORDER:\n\n([\s\S]*?\[FINISHED[^\]]*\])/);
          const verdict = verdictOf(r);
          verdict.status = r.code === 0 ? 'finished_clean' : 'stopped_with_open_lines';
          try {
            const st = JSON.parse(await readFile(statePath, 'utf8'));
            verdict.answers_on_record =
              st.answered.propose.length + st.answered.propose_group.length;
            // A finished deferred run is a RECORDED run: hand the record
            // back so the song's provenance travels with the conversation.
            verdict.state = JSON.stringify(st);
          } catch {
            /* state unreadable: the verdict still stands on the verb's own run */
          }
          if (m) {
            return {
              content: [
                { type: 'text', text: m[1] },
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
        const args = ['verify', bPath, aPath];
        if (hasScheme) args.push(a.scheme);
        if (hasGroups) args.push(`--groups=${a.groups}`);
        if (a.returns) args.push(`--returns=${a.returns}`);
        if (a.relation) args.push(`--relation=${a.relation}`);
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
    'lyric_check',
    {
      title: 'Check pasted lyrics against a declared rhyme plan',
      description:
        'For lyrics that were NOT written to a lyric_plan (a human pasting their own song): declare what the lyrics claim — a ' +
        "letter scheme ('ABAB', X = free) OR rhyme groups by line number ('1,3;2,4'), optionally verbatim-return classes — " +
        'and get the same rhyme grading and slop floor the full pipeline runs. A declaration is REQUIRED: nothing declared ' +
        'means nothing mandated, and "nothing flagged" about that would be a vacuous pass. FLAGS are defects with line ' +
        'numbers; banned_pairs counts declared pairs on the two-tier ban (HOMEOTELEUTON / MODAL_RHYME), unskippable at ' +
        'any exit code; other NOTES are measurements. ~10s.',
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
        const args = ['brief', draftPath];
        if (hasScheme) args.push(a.scheme);
        if (hasGroups) args.push(`--groups=${a.groups}`);
        if (a.returns) args.push(`--returns=${a.returns}`);
        if (a.relation) args.push(`--relation=${a.relation}`);
        // The relation/structures collision is REFUSED BY THE HARNESS
        // (`MISSING.md` M-102), not re-decided here: a second copy of that
        // rule in JS is a second place for it to drift, and the harness's
        // refusal names both coordinates and the spelling that works.
        if (a.structures) args.push(`--structures=${a.structures}`);
        const r = await runVerb(args);
        return verdictOf(r);
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
        'lyric_screen. ~10s.',
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
  'pastes, lyric_check with their declared scheme or groups — and lyric_verify to judge a CHANGE to one, ' +
  'which is the other half of a revision round: read its `accepted`, not its exit code, and remember it is a ' +
  'DIFF that cannot report banned pairs surviving untouched. FLAGS are defects; banned pairs are ' +
  'unskippable whatever their severity; other NOTES are measurements and are not to be "fixed". A verdict ' +
  'carrying structures_uncalibrated is the third thing to read: correctness IS graded for that declared ' +
  'structure and laziness is NOT, the two-tier ban is skipped on its pairs, and an absent banned_pairs ' +
  'there means the question was not asked rather than answered clean. Recipes ' +
  'describe the SOUND, lyric tools govern the WORDS; the conversation is the only place they meet.';
