// lyric_tools.js — the lyric harness as MCP tools: a DISJOINT family.
//
// STANDING RULE 1 OF lyric-harness/CLAUDE.md, HONORED IN THE ARCHITECTURE:
// the recipe engine and the lyrics do not touch. This module imports nothing
// from engine.js or schemas.js, shares no state with the workspace, and runs
// every call through the persistent or cold Python CLI entrance —
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
// OPERATIONAL SHAPE. A plan is a pure function of its seed; revision state
// is separately capability-addressed and checkpointed. The process-wide queue
// runs ONE Python request at a time to bound lexical/grading memory. Its
// deadline includes queue wait, and cancellation removes pending work or kills
// its active process. Kitchen calls are never transparently replayed after a
// crash. Bounded: every input has a
// ceiling (the same DoS arithmetic schemas.js records for the recipe side).
// Argv-safe: word-like inputs are charset-validated and may not begin with
// "-"; line text never reaches argv — it travels by temp file, deleted in
// finally.

import { createPythonBridge } from './python_bridge.js';
import { requestContext } from './execution_context.js';
import { draftFromText, normalizeDraftLines } from './lyric_text.js';
export { draftFromText } from './lyric_text.js';
import { assessmentCoverageValid, PLAN_FIELDS, READING_FIELDS } from './lyric_workflow.js';
import { openKitchenBudget } from './paid_budget.js';
import { createHash } from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { TOOL_BUDGET_MS, TOOL_DELIVERY_MARGIN_MS } from './budget.js';
import { STATE_MAX_CHARS } from './payload_limits.js';
import {
  encodeState,
  decodeState,
  recoverState,
  assertContinuationCapacity,
  continuationSemanticIdentity,
  CONNECTOR_DECLARATION_BYTES,
  encodeInterviewWire,
  verifyInterviewCursor,
} from './state_codec.js';
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
const EXECUTION_CONTRACT =
  `Computation has a shared ${TOOL_BUDGET_MS / 1000}-second deadline, including queue time, ` +
  `with up to ${TOOL_DELIVERY_MARGIN_MS / 1000} seconds for bounded cleanup and delivery. ` +
  'These are limits, not completion estimates or proof that the full admitted capacity finishes within them. ' +
  'Read the typed status and requested-layer coverage; admission alone does not certify a result.';

// ── ceilings (every one refused loudly, none silently clamped) ─────────────
const MAX_WORDS = 12;
const MAX_WORD_CHARS = 40;
// REPINNED 2026-09-04 from ~~64~~ (M-239): the planner's envelope is derived
// from the floor's calibrated token range, and the length-curve profile
// covers 4-3,245 tokens, so `ENVELOPE["total_lines"]` reads (12, 447). The
// ceiling here is that number and nothing else; a 448-line draft is refused
// loudly, as a 65-line one was.
// Exported planner admission, checked against plan.ENVELOPE by test_high_report.
// ~~Executable creation has its separate registry-derived bound~~ (the 31-line
// writable capacity, `EXECUTABLE_MAX_LINES`) — DELETED 2026-09-28 by owner
// ruling: every plan the planner draws can be written, graded and revised.
const MAX_LINES = 463;
const MAX_LINE_CHARS = 200;
// Two closed vocabularies the schemas enumerate, checked the same way:
// `quality/plan.py` PLAN_FORMS and `quality/rhyme_types.py` POSITION.
export const PLAN_FORMS = ['verse-chorus'];
export const TYPE_POSITIONS = ['end', 'internal', 'leonine', 'cross', 'head', 'holorhyme'];
// The plan declarations lyric_grade and lyric_revise must repeat, and the
// reading declarations a revision carries from its grade — named from the
// receipts' own lists so the text and the checks cannot part.
const PLAN_DECLARATIONS = PLAN_FIELDS.filter((f) => f !== 'seed').join(', ');
const READING_DECLARATIONS = READING_FIELDS.join(', ');
// THE MANDATE CEILING IS SIZED TO THE RECOVER DOOR'S OWN OUTPUT (M-195,
// repinned 2026-09-02 from ~~400~~). A pasted song's mandate is what
// `lyric_recover` hands back, and that cover is every admitted pair over
// every searched place, so it grows with the SQUARE of the line count:
// MEASURED at the default four places, 4,132 chars over 19 lines, 5,299
// over 25, 10,009 over 32 (670 pair-groups) — every one of them refused by
// the old 400, so the prescribed route recover -> check -> revise could not
// chain past a few lines. Extrapolated to ~~MAX_LINES (64) that is ~40k~~
// 64 lines that is ~40k; the kernel's per-argument ceiling is 128 KiB. Half
// of that is the bound, and it is still a bound (a runaway is refused, never
// clamped). REPINNED 2026-09-04 (M-239): MAX_LINES is 447 now, and the same
// square law puts a recovered cover over 447 lines near 2 MB — so the
// recover -> check -> revise route reaches about 80 lines under this bound
// (sqrt(65536 / 10009) * 32), and a longer pasted song's cover is refused
// here with the count in the message. A ceiling stated, not a clamp.
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
// deploy target (~10s) = 50s of planning. ~~MEASURED here, warm: 128 seeds in
// 4.2s and 512 in 15.1s, i.e. ~1.5s fixed and ~28.5ms marginal per seed. 512
// seeds is 14.6s of planning, which absorbs a deploy box ~3.4x slower than
// this one before the client's clock runs out.~~
//
// RE-MEASURED AND REPINNED 2026-09-05 (`MISSING.md` M-239). A SWEEP PLANS
// EVERY SEED IN ITS WINDOW, so the window's cost is the PLANNER'S cost, and
// the planner's envelope moved from 12..55 lines to 12..447 (median drawn
// total 201 lines against ~35 before). The old constant was derived against
// the old envelope and nothing re-derived it when the envelope moved -- a
// derived number that outlives its derivation is a hand number wearing one.
// MEASURED here 2026-09-05, same box, same verb: `plan --sweep=1-128` 81.3s
// and `--sweep=1-512` 277.1s, i.e. ~16.0s fixed (interpreter + lexicon) and
// ~510ms marginal per seed -- 18x the old marginal. Against 50s of planning
// and the SAME ~3.4x deploy-box margin the old derivation declared, the
// window is 50 / 3.4 / 0.510 = 28 seeds, which costs 14.3s here: the same
// wall clock the 512-seed window used to buy, for 28 seeds instead of 512.
//
// AND THE BOUND IS PAGINATION, NOT TRUNCATION, because a plan is a pure
// function of its seed: sweep(1..900) is exactly sweep(1..28) union
// sweep(29..900) and the three counts add. WHAT THE MOVE COSTS A SEARCH,
// SAID OUT LOUD: the two acceptance rates this repo has banked are 23/899
// (stay_awake) and 6/699 (carry_it_over); at the HARDER of those, 0.86%,
// ~~a 512-seed window holds at least one acceptance 98.8% of the time, so
// one call usually answers~~ -- a 28-seed window holds one 21.5% of the
// time, so a search now takes SEVERAL calls where it used to take one. That
// is the envelope's price on this verb, not a defect of the bound; a sweep
// that scales with the envelope is the schema-door scaling item's neighbour
// (`MISSING.md` M-240, open).
const MAX_SWEEP_SEEDS = 28;
const MAX_WANTS = 13; // Per-request predicate budget, not the vocabulary size.
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
const MAX_STATE_CHARS = STATE_MAX_CHARS;

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
// ~~4 MiB~~ -> 9 MiB 2026-10-04: the report carries checkpoint lines, which
// grew x2.25 with STATE_DECODED_BYTES (owner's ruling).
const MAX_OUTPUT_BYTES = 9 * 1024 * 1024;

// A word that reaches argv: letters, apostrophes, internal hyphens. The
// leading character is constrained separately so no input can grow into a
// flag; there is no shell (execFile), so this is belt on top of braces.
const WORD_RE = /^[A-Za-z][A-Za-z'’‘ʼ-]*$/;
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
// Function-specific coordinates contain a dot (e.g. sections.verse). The
// schema bounds the whole declaration with MAX_WANT_CHARS; a second name
// length cap would silently exclude longer names from the harness vocabulary.
const WANT_RE = /^[a-z][a-z_.]*(<=|>=|=)[A-Za-z0-9_.,-]+$/;
const STRUCTURES_RE =
  /^[A-Za-z0-9]{1,3}:[A-Za-z0-9()',. /-]{1,64}(,[A-Za-z0-9]{1,3}:[A-Za-z0-9()',. /-]{1,64})*$/;
const RETURNS_RE = MANDATE_RE;
// A SCHEME IS ONE LETTER PER LINE, so its bound IS the line ceiling and
// nothing else. REPINNED 2026-09-05 (M-239): ~~{1,64}~~, a hand copy of
// the old MAX_LINES that the 447 repin left behind — a 65..447-line draft
// passed checkLines and was then refused here, at a bound that named no
// reason. Built from MAX_LINES so the two cannot part again.
const SCHEME_RE = new RegExp(`^[A-Za-z]{1,${MAX_LINES}}$`);

// The bridge owns serial admission, deadlines, cancellation and streamed
// checkpoints. Kitchen calls are side effects and are never replayed after a
// worker crash; deterministic fallback shares the original request deadline.
const MCP_DIR = path.dirname(fileURLToPath(import.meta.url));
const WORKER_PATH = path.join(MCP_DIR, 'worker.py');
const KITCHEN_WAIT_SHARE = 0.4;
function harnessEnv() {
  const prior = process.env.PYTHONPATH;
  return {
    ...process.env,
    PYTHONDONTWRITEBYTECODE: '1',
    PYTHONPATH: prior ? `${MCP_DIR}${path.delimiter}${prior}` : MCP_DIR,
    LYRIC_PROPOSER_WAIT_BUDGET_S: String(Math.floor((TOOL_BUDGET_MS / 1000) * KITCHEN_WAIT_SHARE)),
  };
}
const WRITERS = ['interview', 'kitchen'];
const KITCHEN_PROPOSE = 'call:gemini_proposer:make';
const WORKER_ENABLED = process.env.LYRIC_WORKER !== '0';
const bridge = createPythonBridge({
  python: PYTHON,
  harnessDir: HARNESS_DIR,
  workerPath: WORKER_PATH,
  harnessEnv,
  timeoutMs: SUBPROCESS_TIMEOUT_MS,
  maxOutputBytes: MAX_OUTPUT_BYTES,
  workerEnabled: WORKER_ENABLED,
  getContext: requestContext,
  openKitchenBudget,
});
// A lookup does not wait behind a grade. In the song runs of 2026-09-30,
// twelve `lyric_types` calls passed the caller's 60 s limit while a grade
// or revise held the one serial queue, though the lookup itself takes about
// 2.5 s. Lookups get their own queue and a one-shot process (no warm
// worker): measured at about 2.5 s and 283 MB peak a call, so one at a time
// fits beside the warm worker in the service's 2 GB.
const LOOKUP_MAX_ADMITTED = 8;
const lookupBridge = createPythonBridge({
  python: PYTHON,
  harnessDir: HARNESS_DIR,
  workerPath: WORKER_PATH,
  harnessEnv,
  timeoutMs: SUBPROCESS_TIMEOUT_MS,
  maxOutputBytes: MAX_OUTPUT_BYTES,
  workerEnabled: false,
  getContext: requestContext,
  maxAdmitted: LOOKUP_MAX_ADMITTED,
});
const admissionScope = new AsyncLocalStorage();
const runVerb = (args, options = {}) =>
  bridge.runVerb(args, {
    ...options,
    admission: options.admission || admissionScope.getStore(),
  });
export const lyricCapacity = () => bridge.capacity();
// M-187(a): whether the warm worker exists and whether it is warm in the sense
// that matters — it has answered at least one request in this process, so its
// replay memo is populated. Read straight off the bridge; see workerState().
export const lyricWorkerState = () => bridge.workerState();
export const _workerInternals = bridge.internals;

const EXIT_MEANING = {
  0: 'answered — no flag stands',
  // 1 is Python's own uncaught exception: the harness DIED, it did not
  // answer, and a death read as a verdict is the worst reading a caller can
  // make of it (M-186; M-188 turned the one known cause, a missing staged
  // resource, into a refusal at 2 — anything still reaching 1 is a crash).
  1: 'CRASHED — not an answer; the harness died before reaching a verdict, stderr follows',
  2: 'REFUSED — the harness did not answer; the report names why',
  // ~~or banned pair~~ dropped 2026-10-04 (owner's ruling): banned pairs are
  // reported as notes and no longer move an exit code.
  3: 'answered — at least one FLAG stands; the report names the lines',
  4: "SUSPENDED — the loop is waiting for a writer's answer; neither a verdict nor a failure",
  // A call nearing its deadline stops itself between steps instead of being
  // killed (LOOP_REDESIGN.md §2.3b; owner ruling Q3, 2026-10-02). It asks
  // nothing, so it is not a 4: an answer sent to it would be refused.
  5: 'STOPPED at a safe point — resumable; continue with no answer',
};

// Every count, finding and loop record in a verdict is read off the
// harness's authenticated machine record (`verdictOf`), never parsed out of
// report prose: the report can quote lyrics that look exactly like a stamp.
//
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
// Cache only by unguessable run capability; a seed never identifies an owner.
export const RUNS = new RunStore();

export const CONNECTOR_ATTEMPTS = 1;
// THE KITCHEN'S OWN ATTEMPTS (M-257, round 24). One attempt per line was
// M-236's budget for a CHAT model answering one question per hop, where a
// re-ask at once cost a whole hop of history. The cook answers a question
// in one call with nothing waiting on it, so a rejected line is re-asked
// at once with its rejection quoted — the CLI's own default — instead of
// waiting a round. Round 24 measured the cook holding two places of a
// three-place line and dropping the third; the immediate re-ask is where
// that line gets its second try. A caller's own `attempts` still wins.
export const KITCHEN_ATTEMPTS = 3;
// ON SINCE 2026-09-05 (lyric-harness/MISSING.md M-247, owner: "turn the
// connector's backtrack default on"). Width 1, not the CLI's 5: the walk is
// width² group questions per stuck line per round (each a suspension on
// this path), and M-236's budget is one question per line per round — so
// one group rewrite is opened after tier 1 fails on a line, and a rejected
// one is re-briefed next round. `backtrack: 0` from the caller shuts it.
export const CONNECTOR_BACKTRACK = 1;

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
      attempt: typeof rec.attempt === 'number' ? rec.attempt : null,
      question_sha256: typeof rec.question_sha256 === 'string' ? rec.question_sha256 : null,
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

// THE VERDICT, OFF THE RECORD WHEN THE RECORD HAS IT (M-236). The harness
// now writes what verify made of every candidate into the state file
// (`outcomes`, keyed line/attempt/round) as the loop replays, so the verdict
// is READ there — exact for every attempt, the last one and a batch member
// included. A folded answer may still await the linear verification walk;
// no next-question shape or unused attempt budget can prove its acceptance.
function outcomeAt(st, line, attempt, round) {
  const outs = st && Array.isArray(st.outcomes) ? st.outcomes : [];
  for (let i = outs.length - 1; i >= 0; i--) {
    const o = outs[i];
    if (!o || typeof o !== 'object') continue;
    if (o.line === line && o.attempt === attempt && (o.round ?? null) === (round ?? null)) return o;
  }
  return null;
}

// THE GROUP VERDICT, OFF ITS OWN RECORD (M-253, 2026-09-06). The harness
// writes what verify made of every joint rewrite to `group_outcomes`, keyed
// (members, round) — its own list, because every reader of `outcomes` keys
// on `line`. Before this a tier-2 answer folded as `unknown` with no
// reasons, always, so a writer whose group rewrite was rejected three
// rounds running saw three silences.
function groupOutcomeAt(st, members, round, attempt = null, question = null) {
  const outs = st && Array.isArray(st.group_outcomes) ? st.group_outcomes : [];
  const want = Array.isArray(members) ? members.map(Number).join(',') : null;
  if (want == null) return null;
  for (let i = outs.length - 1; i >= 0; i--) {
    const o = outs[i];
    if (!o || typeof o !== 'object' || !Array.isArray(o.members)) continue;
    if (
      o.members.map(Number).join(',') === want &&
      (o.round ?? null) === (round ?? null) &&
      (o.attempt ?? null) === attempt &&
      (o.question_sha256 ?? null) === question
    )
      return o;
  }
  return null;
}

// THE FOLD, BY JOURNAL DIFF (LOOP_REDESIGN.md §2.2 option B and §2.8 D;
// owner's ruling 2026-10-02). It used to read only the incoming
// `pending.answer`, so a batch member the walk had not reached yet came back
// `unknown` / `unverified`, and its eventual verdict was never published at
// all (defect 2, reproduced in Phase 1). Now every call compares the records
// in the state it RETURNS with those in the state it was handed:
//   - every new or changed outcome, group outcome or pass-by disposition is
//     published, by the call that wrote it, as `accepted`, `rejected` or
//     `not_applied` (source `outcome`);
//   - every answer on record with no record yet is published as `pending`,
//     waiting on the question now asked, or on the next call when the run
//     stopped before reaching it (source `waiting`).
// One row is an object, as a single answer's fold always was; several are an
// array, as a batch's always was. `unknown` remains only for a row this cannot
// match, which no state minted by this connector produces.
const _lineKey = (o) => `${o.line}|${o.attempt ?? 0}|${o.round ?? ''}`;
const _groupKey = (o) =>
  `${(o.members || []).map(Number).join(',')}|${o.round ?? ''}|${o.attempt ?? ''}|${o.question_sha256 ?? ''}`;
const _lines = (ns) => (ns && ns.length ? ns.map((n) => `L${n}`).join(', ') : 'an earlier line');
const WHY_NOT_APPLIED = {
  closed: (by) =>
    `not judged: its finding was already closed by the accepted rewrite of ${_lines(by)}`,
  rewritten: (by) => `not judged: this line was rewritten by the accepted rewrite of ${_lines(by)}`,
  no_finding: () => 'not judged: no finding stands on this line in the current draft',
};

// WHERE A RUN STANDS, for the no-progress count (LOOP_REDESIGN.md §2.8 E;
// owner ruling Q4, 2026-10-02). Two states are at the same position when the
// saved position (phase, round, place in the pass, and the menus already built
// for a question under construction), the number of verdict and pass-by
// records, and the question pending are all the same. The count itself and
// the seal are left out, so carrying the count never reads as progress.
function positionOf(st) {
  if (!st || typeof st !== 'object') return null;
  const loop = st.cursor?.loop || {};
  return JSON.stringify([
    loop.phase ?? null,
    loop.round ?? null,
    loop.at ?? null,
    Array.isArray(loop.menus) ? loop.menus.length : 0,
    (st.outcomes || []).length,
    (st.group_outcomes || []).length,
    (st.dispositions || []).length,
    st.pending ? { kind: st.pending.kind, record: st.pending.record } : null,
  ]);
}

// -> the count of consecutive calls that ended without an answer and without
// moving the run, carried in the state this call returns. Only an exit-5 stop
// or a killed call is compared; any advance resets it to 0. Reported, never
// refused: no call is ever turned away for it.
function stallsOf(prevStateText, st) {
  let prev;
  try {
    prev = typeof prevStateText === 'string' ? JSON.parse(prevStateText) : prevStateText;
  } catch {
    return 0;
  }
  if (!prev || typeof prev !== 'object') return 0;
  const before = positionOf(prev);
  return before !== null && before === positionOf(st)
    ? (Number.isInteger(prev.stalls) && prev.stalls > 0 ? prev.stalls : 0) + 1
    : 0;
}

const NO_PROGRESS_AT = 2;
const noProgressNote = (n, st) =>
  ` NO PROGRESS: ${n} calls in a row ended at the same position (` +
  `${st?.cursor?.loop?.phase ?? 'the start'}, round ${st?.cursor?.loop?.round ?? '?'}, on a ` +
  `${(st?.accepted_lines || []).length}-line draft). This draft does not fit one call on this ` +
  'server; the run is kept and a further call is not refused.';

function foldedOf(prevStateText, st) {
  let prev;
  try {
    prev = typeof prevStateText === 'string' ? JSON.parse(prevStateText) : prevStateText;
  } catch {
    return null;
  }
  if (!prev || typeof prev !== 'object' || !st || typeof st !== 'object') return null;
  const list = (x, k) => (x && Array.isArray(x[k]) ? x[k].filter((o) => o && typeof o === 'object') : []);
  const before = (k, keyOf) => new Map(list(prev, k).map((o) => [keyOf(o), JSON.stringify(o)]));
  const answers = new Map(list(st.answered, 'propose').map((r) => [_lineKey(r), r]));
  const groupAnswers = new Map(list(st.answered, 'propose_group').map((r) => [_groupKey(r), r]));
  const rows = [];
  const clip = (t) => (typeof t === 'string' ? t : JSON.stringify(t ?? '')).slice(0, 300);
  const reasonsOf = (o) => (Array.isArray(o.reasons) ? o.reasons.map((r) => String(r).slice(0, 300)) : []);
  const seenOut = before('outcomes', _lineKey);
  const recorded = new Set();
  for (const o of list(st, 'outcomes')) {
    const k = _lineKey(o);
    recorded.add(k);
    if (seenOut.get(k) === JSON.stringify(o)) continue;
    rows.push({
      kind: 'propose',
      line: o.line,
      attempt: o.attempt ?? 0,
      round: o.round ?? null,
      answer: clip(o.text ?? answers.get(k)?.text),
      verdict: o.accepted === true ? 'accepted' : o.accepted === false ? 'rejected' : 'unknown',
      reasons: reasonsOf(o),
      source: 'outcome',
    });
  }
  const seenGroup = before('group_outcomes', _groupKey);
  const groupRecorded = new Set();
  for (const o of list(st, 'group_outcomes')) {
    const k = _groupKey(o);
    groupRecorded.add(k);
    if (seenGroup.get(k) === JSON.stringify(o)) continue;
    rows.push({
      kind: 'propose_group',
      members: (o.members || []).map(Number),
      attempt: o.attempt ?? null,
      round: o.round ?? null,
      question_sha256: o.question_sha256 ?? null,
      answer: clip(o.text),
      verdict: o.accepted === true ? 'accepted' : o.accepted === false ? 'rejected' : 'unknown',
      reasons: reasonsOf(o),
      source: 'outcome',
    });
  }
  const seenDisp = before('dispositions', _lineKey);
  for (const d of list(st, 'dispositions')) {
    const k = _lineKey(d);
    recorded.add(k);
    if (seenDisp.get(k) === JSON.stringify(d)) continue;
    const why = WHY_NOT_APPLIED[d.why] || (() => 'not judged');
    rows.push({
      kind: 'propose',
      line: d.line,
      attempt: d.attempt ?? 0,
      round: d.round ?? null,
      answer: clip(answers.get(k)?.text),
      verdict: 'not_applied',
      reasons: [why(Array.isArray(d.by) ? d.by : [])],
      by: Array.isArray(d.by) ? d.by.map(Number) : [],
      source: 'outcome',
    });
  }
  const asked = st.pending && typeof st.pending === 'object' ? askedOf(st.pending) : null;
  const waitingOn = asked ? asked.members || asked.lines || (asked.line != null ? [asked.line] : []) : [];
  const waiting = waitingOn.length
    ? `pending: waiting on ${_lines(waitingOn)}, the question asked now`
    : 'pending: the run stopped before reaching it; continue with no answer';
  for (const [k, r] of answers) {
    if (recorded.has(k)) continue;
    rows.push({
      kind: 'propose',
      line: r.line,
      attempt: r.attempt ?? 0,
      round: r.round ?? null,
      answer: clip(r.text),
      verdict: 'pending',
      reasons: [waiting],
      waiting_on: waitingOn.map(Number),
      source: 'waiting',
    });
  }
  for (const [k, r] of groupAnswers) {
    if (groupRecorded.has(k)) continue;
    rows.push({
      kind: 'propose_group',
      members: (r.members || []).map(Number),
      attempt: r.attempt ?? null,
      round: r.round ?? null,
      question_sha256: r.question_sha256 ?? null,
      answer: clip(Array.isArray(r.new) ? r.new.join('\n') : r.text),
      verdict: 'pending',
      reasons: [waiting],
      waiting_on: waitingOn.map(Number),
      source: 'waiting',
    });
  }
  if (!rows.length) return null;
  return rows.length === 1 ? rows[0] : rows;
}

// A short fingerprint of the draft a call carried, so the cycles of one song
// (draft, park, rewrite, draft) can be told apart in the rows.
function draftFp(draft) {
  if (!Array.isArray(draft)) return null;
  return createHash('sha1').update(draft.join('\n'), 'utf8').digest('hex').slice(0, 10);
}

// THE STOP'S STATUS, IN THREE WORDS RATHER THAN TWO (M-186, 2026-09-02): a
// whole-only exit 3 — no line open, a WHOLE-DRAFT FLAG standing — was
// labelled `stopped_with_open_lines` with `loop_unresolved` 0, which names
// a cause the verdict itself contradicts. Read off the verdict's own loop
// record, never re-derived from the report.
function loopStatusOf(code, verdict) {
  if (code === 0)
    // The final allowed repair can clear the draft before another loop-start
    // success check. Preserve ROUND_LIMIT as the walk's actual stop reason;
    // the authenticated final grade decides whether the resulting song passed.
    return verdict.measurement_status === 'finished' &&
      verdict.findings_measured === true &&
      verdict.certified === true &&
      assessmentCoverageValid(verdict.coverage) &&
      verdict.coverage.certified === true &&
      verdict.flags === 0 &&
      verdict.whole_flags === 0 &&
      verdict.loop_unresolved === 0 &&
      verdict.loop_whole_flags === 0 &&
      // ~~verdict.banned_pairs === 0 &&~~ dropped 2026-10-04 (owner's ruling):
      // banned pairs are reported, not a condition of finishing.
      Array.isArray(verdict.final_draft) &&
      verdict.final_draft.length > 0
      ? 'finished_clean'
      : 'uncertified';
  const open = typeof verdict.loop_unresolved === 'number' ? verdict.loop_unresolved : 0;
  const whole = Array.isArray(verdict.loop_whole_flag_codes)
    ? verdict.loop_whole_flag_codes.length
    : 0;
  if (open === 0 && whole > 0) return 'stopped_with_whole_draft_flags';
  return 'stopped_with_open_lines';
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

// AND NOTHING CALLED IT (M-279, repair 4). `extractRefusal` has read the
// headline since M-168 and no caller ever existed: `verdictOf` set
// `v.refusal` only from the authenticated record, and only where that record
// is version 1 AND its status is `refused`. Every exit-2 result that fails
// either test therefore banked `refusal: null` — the connector's OWN
// output-cap refusal (`failure` below prints a headline and stamps no
// record), a control frame lost to the kill that raised the exit, a record
// under another status, a build that stamped none. Run 34626453606's
// TWENTY-FOUR `lyric_grade` refusals are that hole: all exit 2, all
// `refusal: null`, and the two questions that run owes cannot be asked of it
// at all. The printed headline first, else the last line the harness wrote
// to stderr, bounded. The authenticated refusal still wins where there is
// one. RETAINED, NEVER PUBLISHED: a refusal can quote a private title, a
// lyric or a capability, so `scripts/battery_inspect.mjs` classifies this
// string into its closed vocabulary and prints no headline of its own.
const REFUSAL_HEADLINE_MAX = 400;
function refusalHeadlineOf(r) {
  const printed = extractRefusal(r.stdout);
  if (printed) return printed.slice(0, REFUSAL_HEADLINE_MAX);
  const lines = String(r.stderr || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.length ? lines[lines.length - 1].slice(0, REFUSAL_HEADLINE_MAX) : null;
}

// THE KITCHEN'S BILL (M-254), read off the proposer's own per-call lines —
// the LAST line carries the running totals, so a run the budget killed
// mid-loop still reports what it spent. Absent lines → zero calls, said as
// such (`proposer_calls: 0`), never as missing keys.
function extractProposerRecord(stdout, record = null) {
  if (record && typeof record === 'object') {
    const fields = [
      'model',
      'calls',
      'attempts',
      'ms',
      'tokens_in',
      'tokens_out',
      'tokens_thoughts',
      'tokens_cached',
      'tokens_total',
      'empty',
      'retries',
      'wait_s',
      'status',
      'in_flight',
      'usage_unknown',
      'finish_reason',
      'failure_code',
      'prompt_feedback',
    ];
    return Object.fromEntries(
      fields.filter((k) => record[k] !== undefined).map((k) => [`proposer_${k}`, record[k]])
    );
  }
  const lines = [
    ...stdout.matchAll(
      /PROPOSER CALL (\d+): (\S+) (\d+) ms in=(\d+) out=(\d+)(?: finish=(\S+))? \| kitchen model=(\S+) calls=(\d+) ms=(\d+) in=(\d+) out=(\d+) empty=(\d+) retries=(\d+)(?: wait=(\d+))?/g
    ),
  ];
  if (!lines.length) return { proposer_calls: 0 };
  const last = lines[lines.length - 1];
  return {
    proposer_model: last[7],
    proposer_calls: Number(last[8]),
    proposer_ms: Number(last[9]),
    proposer_tokens_in: Number(last[10]),
    proposer_tokens_out: Number(last[11]),
    proposer_empty: Number(last[12]),
    proposer_retries: Number(last[13]),
    proposer_wait_s: last[14] != null ? Number(last[14]) : 0,
    proposer_ms_max: Math.max(...lines.map((m) => Number(m[3]))),
  };
}

const SHA256_RE = /^[0-9a-f]{64}$/;
const JOURNAL_ID_RE = /^[0-9a-f]{32}$/;
const sha256 = (value) => createHash('sha256').update(value, 'utf8').digest('hex');

// These are verifier receipts, not a count inferred from proposals, changed
// words, or an unused attempt budget. Native journals retain the full reasons;
// repeated chat rows carry the compact identity and exact application proof.
function verificationEvidenceOf(r) {
  const record = r.lyric_result?.version === 1 ? r.lyric_result : null;
  const checkpoint = r.checkpoint?.version === 1 ? r.checkpoint : null;
  const source =
    record && Object.hasOwn(record, 'verified_outcomes')
      ? record
      : checkpoint && Object.hasOwn(checkpoint, 'verified_outcomes')
        ? checkpoint
        : null;
  const unavailable = (error) => ({
    verified_outcomes: null,
    verified_outcomes_error: error,
    verified_outcomes_draft_sha256: null,
    journal_id: null,
  });
  if (!source) return unavailable('No authenticated verifier outcome inventory is available.');
  const journal = source.journal_id ?? source.resume_proof?.journal_id;
  const draft = source.final_draft ?? source.accepted_lines ?? record?.final_draft;
  if (
    !JOURNAL_ID_RE.test(journal) ||
    !Array.isArray(source.verified_outcomes) ||
    !Array.isArray(draft) ||
    !draft.every((line) => typeof line === 'string')
  )
    return unavailable('Malformed authenticated verifier inventory or accepted artifact.');
  const projected = new Map();
  const natural = (n) => Number.isSafeInteger(n) && n >= 0;
  for (const entry of source.verified_outcomes) {
    if (
      !entry ||
      !SHA256_RE.test(entry.outcome_id) ||
      !SHA256_RE.test(entry.question_sha256) ||
      !['propose', 'propose_group'].includes(entry.kind) ||
      !natural(entry.proposal_index) ||
      !(entry.round === null || natural(entry.round)) ||
      !(entry.attempt === null || natural(entry.attempt)) ||
      !Array.isArray(entry.members) ||
      !entry.members.length ||
      new Set(entry.members).size !== entry.members.length ||
      !entry.members.every((n) => Number.isSafeInteger(n) && n >= 1 && n <= draft.length) ||
      typeof entry.accepted !== 'boolean' ||
      typeof entry.applied !== 'boolean' ||
      !SHA256_RE.test(entry.before_draft_sha256) ||
      !SHA256_RE.test(entry.after_draft_sha256) ||
      (entry.applied &&
        (!entry.accepted || entry.applied_draft_sha256 !== entry.after_draft_sha256)) ||
      (!entry.applied && entry.applied_draft_sha256 != null)
    )
      return unavailable('Malformed authenticated verifier outcome; no outcome count is proven.');
    const compact = Object.fromEntries(
      [
        'outcome_id',
        'kind',
        'proposal_index',
        'question_sha256',
        'round',
        'attempt',
        'members',
        'accepted',
        'applied',
        'before_draft_sha256',
        'after_draft_sha256',
        'applied_draft_sha256',
      ]
        .filter((key) => entry[key] !== undefined)
        .map((key) => [key, entry[key]])
    );
    if (
      projected.has(entry.outcome_id) &&
      JSON.stringify(projected.get(entry.outcome_id)) !== JSON.stringify(compact)
    )
      return unavailable('Conflicting authenticated verifier outcome identities.');
    projected.set(entry.outcome_id, compact);
  }
  return {
    verified_outcomes: [...projected.values()],
    verified_outcomes_error: null,
    verified_outcomes_draft_sha256: sha256(JSON.stringify(draft)),
    journal_id: journal,
  };
}

function resumeEvidenceOf(r) {
  const record = r.lyric_result?.version === 1 ? r.lyric_result : null;
  const checkpoint = r.checkpoint?.version === 1 ? r.checkpoint : null;
  const proof = record?.resume_proof ?? checkpoint?.resume_proof;
  const unavailable = (error) => ({ resume_proof: null, resume_proof_error: error });
  if (!proof) return unavailable('No authenticated checkpoint replay receipt is available.');
  if (
    proof.version !== 1 ||
    !JOURNAL_ID_RE.test(proof.journal_id) ||
    typeof proof.checkpoint_loaded !== 'boolean' ||
    typeof proof.replay_prefix_consumed !== 'boolean' ||
    !SHA256_RE.test(proof.input_draft_sha256) ||
    !SHA256_RE.test(proof.accepted_draft_sha256_at_start) ||
    !Array.isArray(proof.applied_outcome_ids_at_start) ||
    !proof.applied_outcome_ids_at_start.every((id) => SHA256_RE.test(id)) ||
    new Set(proof.applied_outcome_ids_at_start).size !==
      proof.applied_outcome_ids_at_start.length ||
    ![
      'completed_proposals_at_start',
      'completed_proposals_replayed',
      'new_proposer_dispatches',
      'completed_proposal_redispatches',
    ].every((key) => Number.isSafeInteger(proof[key]) && proof[key] >= 0) ||
    proof.completed_proposals_replayed > proof.completed_proposals_at_start ||
    (proof.checkpoint_loaded
      ? !SHA256_RE.test(proof.input_checkpoint_sha256)
      : proof.input_checkpoint_sha256 !== null)
  )
    return unavailable('Malformed authenticated checkpoint replay receipt.');
  const compact = Object.fromEntries(
    [
      'version',
      'journal_id',
      'checkpoint_loaded',
      'input_checkpoint_sha256',
      'input_draft_sha256',
      'accepted_draft_sha256_at_start',
      'applied_outcome_ids_at_start',
      'completed_proposals_at_start',
      'completed_proposals_replayed',
      'new_proposer_dispatches',
      'completed_proposal_redispatches',
      'replay_prefix_consumed',
    ].map((key) => [key, proof[key]])
  );
  if (proof.checkpoint_loaded) {
    if (
      !r.checkpoint_input_sha256 ||
      proof.input_checkpoint_sha256 !== r.checkpoint_input_sha256 ||
      !SHA256_RE.test(r.checkpoint_wire_sha256)
    )
      return unavailable('Checkpoint replay receipt does not bind the exact supplied checkpoint.');
    compact.wire_checkpoint_sha256 = r.checkpoint_wire_sha256;
  } else if (r.checkpoint_input_sha256)
    return unavailable('Checkpoint replay receipt did not acknowledge the supplied checkpoint.');
  return { resume_proof: compact, resume_proof_error: null };
}

// The harness writes its report for a person at its command line. A connector
// caller cannot run `python3 lyric_harness.py …`, and the worker's temporary
// files mean nothing outside this process, so the published report names the
// connector tool instead and hides the paths. Ticket references (M-123) are the
// harness's internal bookkeeping and are dropped; its doctrine citations point
// at published rules (lyric-harness/CLAUDE.md) and stay.
const HARNESS_VERB_TOOL = {
  plan: 'lyric_plan',
  song: 'lyric_grade',
  brief: 'lyric_check',
  finish: 'lyric_revise',
  revise: 'lyric_revise',
  screen: 'lyric_screen',
  sweep: 'lyric_sweep',
  recover: 'lyric_recover',
  verify: 'lyric_verify',
  types: 'lyric_types',
};
function publishedReport(text) {
  if (typeof text !== 'string') return text;
  return (
    text
      .replace(/python3 lyric_harness\.py (\w+)([^\n]*)/g, (_all, verb, rest) => {
        const tool = HARNESS_VERB_TOOL[verb];
        if (!tool) return 'the matching lyric_* tool';
        const seed = /--seed[= ](-?\d+)/.exec(rest);
        return seed ? `${tool} with seed ${seed[1]}` : tool;
      })
      .replace(/(?:defer:|replay:)?\/tmp\/[^\s"'—,;)]+/g, '[server temporary file]')
      // A PARENTHESISED TICKET, in the three shapes the harness writes it: bare
      // (`(M-184)`, `(M-191; M-192)`), with the register named (`` (`MISSING.md`
      // M-81(B)) ``) and with a sub-part (`M-81(B)`). Only the first shape was
      // matched until a live sweep published "since `MISSING.md` M-84 means" to a
      // caller — and that one is NOT removable here, because striking the words
      // out of the middle of a sentence leaves "which since  means". A bare
      // reference is fixed where it is WRITTEN (`SWEEP_MEASURES`, gated by
      // `quality/test_plan.py` §21); this is the net for the removable shape.
      .replace(
        / ?\((?:(?:`?MISSING\.md`? )?[MG]-\d+[a-z]?(?:\([A-Z]\))?)(?:[,;/] ?(?:`?MISSING\.md`? )?[MG]-\d+[a-z]?(?:\([A-Z]\))?)*\)/g,
        ''
      )
  );
}

// WHAT STANDS: a flag. One definition, read by the verdict's own `standing`
// field and by the session's short verdict (verdict_view.js), so the two
// cannot differ. ~~or a mandated pair on the two-tier ban~~ — dropped
// 2026-10-04 (owner's ruling): banned pairs are still counted in
// `banned_pairs` and named in `banned`, but they do not stand.
export const BAN_CODES = ['HOMEOTELEUTON', 'MODAL_RHYME'];
export const isStanding = (f) => f.severity === 'flag';

function verdictOf(r) {
  // Only the per-process authenticated record carries machine truth. The report
  // can quote arbitrary lyrics, including text that looks exactly like a stamp.
  const record = r.lyric_result;
  const v = {
    exit_code: r.code,
    meaning:
      EXIT_MEANING[r.code] || `subprocess failure (${r.code}): ${(r.stderr || '').slice(0, 400)}`,
    report: publishedReport(r.stdout),
    ...verificationEvidenceOf(r),
    ...resumeEvidenceOf(r),
  };
  if (r.code === 1 && r.stderr) {
    v.stderr = String(r.stderr).slice(-8000);
    v.stderr_truncated = String(r.stderr).length > 8000;
  }
  if (typeof r.path === 'string') v.path = r.path;
  if (typeof r.ms === 'number') v.ms = r.ms;
  if (r.proposer_record) Object.assign(v, extractProposerRecord('', r.proposer_record));
  if (r.accounting) {
    v.accounting = r.accounting;
    // A broker with no admitted/settled request proves replay made no paid
    // call. Missing Python prose alone cannot prove that zero.
    if (
      !r.proposer_record &&
      Array.isArray(r.accounting.events) &&
      r.accounting.events.length === 0 &&
      r.accounting.reservedUsd === 0 &&
      r.accounting.unknownUsd === 0
    )
      v.proposer_calls = 0;
  }
  if (r.accounting_unknown) v.proposer_usage_unknown = true;
  if (r.timed_out) v.timed_out = true;
  if (r.cancelled) v.cancelled = true;
  // M-279, ABOVE THE EARLY RETURN ON PURPOSE. A killed call has no
  // authenticated record, so everything below this point is unreachable for
  // exactly the thirteen rows that needed it most. The bridge stamps the
  // wall that bound the call (repair 2), the coarse stage it was in when it
  // ended (repair 3) and whatever progress its own control records had
  // already shown (repair 1); all three ride the verdict from here.
  if (r.tool_deadline) v.tool_deadline = r.tool_deadline;
  if (r.retained) v.retained = r.retained;
  // Repair 4: the reason an exit 2 refused. Overwritten below by the
  // authenticated headline where the record carries one.
  if (r.code === 2) {
    const headline = refusalHeadlineOf(r);
    if (headline) v.refusal = headline;
  }
  const coverage = record?.coverage || r.checkpoint?.coverage;
  if (coverage) {
    v.coverage = coverage;
    v.certified = coverage.certified === true;
  }
  if (!record || record.version !== 1) {
    v.certified = false;
    v.measurement_status = 'no_authenticated_verdict';
    if (r.code === 0)
      v.meaning = 'answered — no authenticated grading verdict; whole-draft findings are unknown';
    return v;
  }
  v.measurement_status = record.status;
  if (Array.isArray(record.pronunciations)) v.pronunciations = record.pronunciations;
  if (record.pronunciation_options) v.pronunciation_options = record.pronunciation_options;
  if (r.code === 2 && ['graded', 'finished'].includes(record.status))
    v.meaning =
      'measured — coverage incomplete; this is an uncertified draft, not a successful song';
  if (r.code === 2 && record.status === 'refused' && typeof record.refusal === 'string')
    v.refusal = record.refusal;
  if (typeof record.memo_state === 'string') v.memo_state = record.memo_state;
  // Why a saved position could not be used, when one existed (owner's ruling
  // 2026-10-02, Q5; LOOP_REDESIGN.md §2.0). `replayed_answers` and
  // `cursor_resumed` stay in the harness's own record, unpublished.
  if (typeof record.cursor_stripped === 'string') v.cursor_stripped = record.cursor_stripped;
  for (const key of ['memo_hit', 'memo_asked', 'stale_answers', 'plan_lines'])
    if (Number.isInteger(record[key]) && record[key] >= 0) v[key] = record[key];
  const findings = Array.isArray(record.findings)
    ? [...new Map(record.findings.map((f) => [JSON.stringify(f), f])).values()]
    : [];
  // A comparison, plan, recovery, suspension or refusal has no final
  // findings census. Empty defaults on those paths would claim zero bans or
  // flags in work that was never fully measured. Only an authenticated
  // grading/finish inventory supports these counts; coverage remains separate.
  const measuredFindings =
    ['graded', 'finished'].includes(record.status) && Array.isArray(record.findings);
  v.findings_measured = measuredFindings;
  if (!measuredFindings) v.certified = false;
  if (measuredFindings) {
    v.findings = findings;
    v.flags = findings.filter((f) => f.severity === 'flag' && f.locations?.length).length;
    v.whole_flags = findings.filter((f) => f.severity === 'flag' && !f.locations?.length).length;
    v.notes = findings.filter((f) => f.severity === 'note').length;
    const banned = findings.filter((f) => BAN_CODES.includes(f.code));
    v.banned_pairs = banned.length;
    // `binding` is the grade's own record of WHERE each ban sits: the bound
    // word and the mandate's place for it on each line. A placed group bans
    // a first word or a word 3, not the end word the line happens to end on.
    v.banned = banned.map((f) => ({
      code: f.code,
      lines: f.locations || [],
      finding: f.message,
      ...(Array.isArray(f.binding) ? { binding: f.binding } : {}),
    }));
    // THE BAN IS NOT ASKED of a pair judged under a declared non-default
    // structure (its tables are end-rhyme instruments). Those pairs are
    // named, and a count over no asked pair is null, never a clean zero.
    const scope = record.ban_scope;
    if (scope && Array.isArray(scope.not_asked) && scope.not_asked.length) {
      v.ban_not_asked = scope.not_asked;
      if (scope.asked === 0) {
        v.banned_pairs = null;
        v.banned_pairs_reason =
          'not asked: every mandated pair is judged under a declared non-default structure, and the two-tier ban is an end-rhyme instrument';
      }
    }
    v.unreadable_findings = findings.filter((f) => /UNREADABLE|UNJUDGED|REFUSED/.test(f.code));
    v.unreadable = v.unreadable_findings.length;
    const uncalibrated = findings.filter((f) => f.code === 'STRUCTURE_UNCALIBRATED');
    if (uncalibrated.length)
      v.structures_uncalibrated = uncalibrated.map((f) => f.message).join('; ');
    v.standing = findings
      .filter(isStanding)
      .map(
        (f) =>
          `${f.locations?.length ? f.locations.map((n) => 'L' + n).join('/') : 'WHOLE-DRAFT'}: ` +
          `FINDING [${String(f.severity).toUpperCase()}] ${f.code}: ${f.message}`
      );
  } else if (['graded', 'finished'].includes(record.status)) {
    v.certified = false;
    v.meaning = 'uncertified — the authenticated grading inventory is missing';
  } else if (r.code === 0) {
    v.meaning = `answered — ${record.status} response; whole-draft findings were not measured`;
  }
  if (record.status === 'finished') {
    v.loop_stop_reason = record.stop_reason;
    v.loop_rounds = record.rounds;
    v.loop_unresolved_lines = record.unresolved_lines || [];
    v.loop_unresolved = v.loop_unresolved_lines.length;
    v.loop_whole_flag_codes = record.whole_flags || [];
    v.loop_whole_flags = v.loop_whole_flag_codes.length;
    v.presentation_text = record.presentation_text;
    v.shape_status = record.shape_status;
  }
  if (record.final_draft) {
    v.final_draft = record.final_draft;
    v.final_draft_sha256 = createHash('sha256')
      .update(JSON.stringify(record.final_draft))
      .digest('hex');
  }
  if (r.code === 0 && (v.flags || v.whole_flags))
    v.meaning = `answered — ${v.flags} per-line and ${v.whole_flags} whole-draft flag(s) stand`;
  // A verb whose exit gates are not song's (brief) answers 0 with coverage
  // incomplete; the meaning says so rather than leaving it to the code.
  if (r.code === 0 && v.findings_measured && v.certified === false)
    v.meaning +=
      '; coverage INCOMPLETE — uncertified (coverage.refused_obligations names what was not judged)';
  return v;
}

// THE GRADE'S STAMP, SPELLED FROM ITS VERDICT. `song`'s exit 2 is shared by a
// refusal (nothing measured) and a measured draft whose coverage is
// incomplete, and a stamp read off the code alone called both "refused". The
// stamp reads the verdict's own fields instead, and keeps the shape
// `quality/check_render_form.py` accepts: the banned count last.
function gradeStamp(seed, v) {
  const nBanned = typeof v.banned_pairs === 'number' ? v.banned_pairs : 0;
  let state;
  if (v.measurement_status !== 'graded') state = 'refused, nothing measured';
  else {
    const parts = [];
    if (v.certified !== true) parts.push('coverage INCOMPLETE, uncertified');
    const flags = v.flags || 0;
    const whole = v.whole_flags || 0;
    parts.push(
      flags || whole
        ? `${flags} per-line and ${whole} whole-draft FLAG(S) standing`
        : 'no FLAG stands'
    );
    if (v.banned_pairs === null) parts.push('two-tier ban not asked');
    // ~~if (nBanned) parts.push('banned pairs UNSKIPPABLE, not finished');~~
    // dropped 2026-10-04 (owner's ruling): the count below still reports them.
    state = parts.join(', ');
  }
  return `[GRADED — seed ${seed} — exit ${v.exit_code}, ${state} — ${nBanned} banned pair(s)]`;
}

// `verify` needs its own verdict. Its authenticated record contains the diff,
// not a complete finding inventory. Deriving counters from an empty default
// previously fabricated banned_pairs:0 even when a ban survived unchanged.
// Those counters are now absent, with findings_measured:false, certified:false
// and an explicit scope. Also, verify exits 0 for both ACCEPTED and REJECTED;
// the authenticated accepted field, not the exit code, answers that question.
//
// AND WHAT verify CANNOT SAY IS PART OF THE ANSWER. It is a DIFF: it speaks
// about what this change FIXED and what it INTRODUCED, never about what
// survived. A pair that was banned before and is still banned after appears
// in neither list, correctly, because nothing about it changed.
function verifyVerdictOf(r) {
  const record = r.lyric_result?.status === 'verified' ? r.lyric_result : null;
  const v = verdictOf(r);
  v.accepted = record ? record.accepted === true : null;
  v.verdict = record ? (v.accepted ? 'ACCEPTED' : 'REJECTED') : null;
  if (record) {
    for (const key of [
      'reasons',
      'coverage',
      'coverage_before',
      'coverage_regressions',
      'layer_coverage_regressions',
      'fixed',
      'new',
      'new_flags',
    ])
      v[key] = record[key];
    v.fixed_count = record.fixed?.length || 0;
    v.introduced_count = record.new?.length || 0;
    v.meaning =
      v.verdict + ' — read accepted and reasons; exit zero means the comparison answered.';
  }
  v.scope =
    'A revision comparison, not whole-song completion. A banned pair the change introduces is in `new`; one that survived the change untouched is not reported. Read accepted and reasons; lyric_grade (planned) or lyric_check (pasted) assesses the complete draft, and a song is finished only at a lyric_revise stop condition.';
  return v;
}

// A declaration counts as made when it carries a value: an empty string or
// an empty list is what NOBODY DECLARED already means everywhere else here.
const declared = (value) =>
  value !== undefined &&
  value !== null &&
  value !== '' &&
  !(Array.isArray(value) && value.length === 0);
// The declarations a PLAN is drawn from, which a pasted song's run has none of.
const PLAN_ONLY_FIELDS = PLAN_FIELDS.filter((f) => !['seed', 'relation'].includes(f));
// The lines an interview answer carries, labels stripped (`L3: …`, `LINE: …`).
function answeredLines(answer) {
  return String(answer)
    .split(/\r?\n/)
    .map((row) => row.trim())
    .filter(Boolean)
    .map((row) => row.replace(/^(?:L\s*\d+\s*[:.]|LINE\s*:)\s*/i, ''));
}
// A digest of a run's capability, carried in its states: it names the run
// without being the capability, so a state never grants more than it did.
const runRef = (runId) => sha256(String(runId));

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
    if (typeof l !== 'string') throw refuse('every draft line must be a string');
    else if (/[\r\n\u2028\u2029]/.test(l))
      throw refuse(
        'each array item must be exactly one lyric line; use the newline text field for multiple rows'
      );
    else if (l.length > MAX_LINE_CHARS) throw refuse(`line over ${MAX_LINE_CHARS} chars`);
}

async function withTempDir(fn) {
  const token = bridge.admit({
    bytes: requestContext().inputBytes || 0,
    context: requestContext(),
  });
  let dir;
  try {
    dir = await mkdtemp(path.join(tmpdir(), 'lyric-'));
    return await admissionScope.run(token, () => fn(dir));
  } finally {
    try {
      if (dir) await bridge.cleanup(() => rm(dir, { recursive: true, force: true }));
    } finally {
      token.release();
    }
  }
}

async function withRunLock(args, fn) {
  const release = RUNS.acquire(args.new_run ? null : args.run_id);
  if (!release)
    throw refuse(
      'RUN_BUSY: this run already has a continuation in progress; recover its latest revision before retrying.'
    );
  try {
    return await fn();
  } finally {
    release();
  }
}

function recoverContinuationOnly(args) {
  const fields = ['state', 'checkpoint'].filter((field) => args[field] != null);
  const extra = Object.keys(args).filter(
    (key) =>
      args[key] !== undefined &&
      !['recover_only', 'recovery_part', 'state', 'checkpoint'].includes(key)
  );
  if (fields.length !== 1 || extra.length)
    throw refuse(
      'Recovery requires recover_only:true and exactly one original state or checkpoint; omit writer, answers, draft, run_id and all execution declarations.'
    );
  return recoverState(args[fields[0]], { part: args.recovery_part || 'all' });
}

// THE GLOBALS, AHEAD OF THE VERB (M-189): `--voices` is bare-presence and
// `--fallback=` takes a value, and the CLI reads both before dispatch, so
// they cannot ride `planArgs` (which lands after the verb). Every handler
// that grades a draft spreads this in front of its verb.
function globalsFor(a) {
  const out = [];
  if (a && a.voices === true) out.push('--voices');
  if (a && (a.fallback === 'high' || a.fallback === 'low')) out.push(`--fallback=${a.fallback}`);
  if (a?.pronunciations !== undefined)
    out.push(`--pronunciations=${JSON.stringify(a.pronunciations)}`);
  return out;
}

function planArgs(a) {
  const args = [`--seed=${a.seed}`];
  if (a.form) args.push(`--form=${a.form}`);
  if (a.lines != null) args.push(`--lines=${a.lines}`);
  // THE WRITER'S DECLARATION (MISSING.md M-55). Neither FIELD is sampled
  // here: this flag is a CARRY of what the caller declared.
  // The planner never picks a relation, it carries the one that was
  // declared. (It DREW one schema per group from 2026-08-25 (M-117) until
  // 2026-09-22; the N-relation model removed the draw, so `plan.relations`
  // is empty unless declared and every group is judged against every
  // relation.)
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
  if (a.melody !== undefined) args.push(`--melody=${a.melody}`);
  if (a.narrative) args.push(`--narrative=${a.narrative}`);
  if (a.wants?.length) args.push(`--want=${a.wants.join(';')}`);
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
  const shown = listed?.[1]?.trim()
    ? listed[1]
        .split(',')
        .map((x) => Number(x.trim()))
        .filter((x) => Number.isSafeInteger(x) && x >= 0)
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
    "REQUIRED declared seed — any integer. Same seed and same declarations, same plan, byte for byte; a different seed is a different song shape. Pick one and keep it for the whole song. A new song's seed comes from lyric_sweep's accepted list, which sweeps non-negative seeds; a creation session plans only such a seed."
  );

const formField = z
  .enum(PLAN_FORMS)
  .optional()
  .describe(`The song form: ${PLAN_FORMS.join(', ')} (the planner's forms; default verse-chorus).`);

const linesField = z
  .number()
  .int()
  // THE FLOOR IS THE ENVELOPE'S, NOT A HAND NUMBER. REPINNED 2026-09-05
  // (M-239): ~~.min(4)~~ admitted 4..11, and the harness refused every one of
  // them by name (MEASURED: `--lines=4`, `=8`, `=11` all answer "outside the
  // planner's envelope [12, 447]"). 4 was reachable when the volunteered set
  // still carried the {4, 5} island; the derived envelope has no island now.
  .min(12)
  .max(MAX_LINES)
  .optional()
  .describe(
    `Exact total line count to request, at least 12 and at most ${MAX_LINES} (the planner's envelope). Every plan can be written, graded and revised. Omit to let the planner choose.`
  );

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
// WHAT "NOBODY SAID" MEANS TODAY (2026-09-22, the N-relation model): every
// mandated pair is judged against EVERY relation -- each coarse relation
// (RHYME, RIME_RICHE, PROMOTED_RHYME, ASSONANCE, CONSONANCE) at its own cut
// and every registry schema (`relations.whole_vocabulary_pairs`) -- and a
// pair stands in all of them its sound supports at once. A group is satisfied
// when its pairs stand in at least one. ~~the PLANNER DRAWS a relation per
// group (M-117)~~ -- STRUCK: the planner draws none; `plan.relations` is empty
// unless the writer declared one.
const relationField = z
  .string()
  // 64 CHARS IS THE RELATION NAME'S OWN BOUND, not a line count: the longest
  // name in the vocabulary is well under it, and it is unrelated to
  // MAX_LINES (checked 2026-09-05 under M-239's ceiling repin).
  .max(64)
  .optional()
  .describe(
    'Declare ONE rhyme relation every mandated group must stand in, e.g. "type:rime riche", "type:pararhyme", "class:ASSONANCE", "schema:perfect rhyme". Namespace it (type: / class: / schema:); overlapping bare names refuse. class: is a coarse relation (membership: a perfect rhyme stands in class:RHYME and class:ASSONANCE, and in class:CONSONANCE only when it closes on a consonant — heart/start does, sky/fly does not), type: is the named-cell engine, and schema: is a registry schema, which requires the complete declared figure and its placement. An intra-line figure cannot stand in for a pair of lines; missing topology or placement refuses instead of accepting partial edges. With no declaration, every pair is judged against EVERY relation — each coarse relation at its own cut and every registry schema — and a group is satisfied when, for each pair, the two words the group binds stand in at least one (another word in the line relating does not count); each pair\'s relations are all reported, and unresolved obligations are disclosed; an unsupported shape never counts as success. Planning draws no relation. Declaring one narrows the requirement to that relation. An unknown name refuses and the refusal lists the declarable names by namespace; for one pair, lyric_types reports its type names, coarse relations and registry schemas.'
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
    'The song\'s title, CARRIED into the blueprint and never inferred. Declaring one answers "is the title in the hook?" instead of leaving it refused as TITLE_UNDECLARED — and the answer can be NO: TITLE_NOT_IN_HOOK is a whole-draft FLAG (counted in whole_flags), so a title whose words are not a contiguous run inside the hook line (or the hook inside the title) keeps the draft from grading clean — lyric_grade exits 3 on it, or 2 when coverage is also incomplete. Containment is a normalised WORD-subsequence test in either direction, not a substring match. A title with more words than the hook can never be answered YES by any draft and is refused as TITLE_LONGER_THAN_HOOK rather than charged. Omit it and the question is reported as TITLE_UNDECLARED, not answered.'
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
    "How far the pronunciation fallback may reach for a word the lexicon (CMUdict) lacks. Omit: dictionary only — an unknown end word REFUSES the pair (UNREADABLE_END_WORD / SCHEME_UNREADABLE: not judged, never passed). 'high': dictionary-derived readings (morphology, elision, compounds) — the confident layer. 'low': also the letter-to-sound guess, which the harness's own measurement finds net harmful on the refusals only it can read; use it to get an ANSWER on a coinage and read the answer with that in mind."
  );
const pronunciationField = z
  .array(
    z
      .object({
        line: z
          .string()
          .min(1)
          .max(4000)
          .describe(
            'Exact complete lyric line. Applies to every verbatim occurrence, including repeated choruses; any changed wording invalidates the binding.'
          ),
        token: z
          .number()
          .int()
          .min(1)
          .max(4000)
          .describe(
            'One-based sung-token position from pronunciation_options. Parentheses follow voices.'
          ),
        word: z
          .string()
          .min(1)
          .max(4000)
          .describe('Exact token at that position; mismatch refuses.'),
        phones: z
          .array(z.string().min(1).max(4))
          .min(1)
          .max(128)
          .describe(
            'One selected ARPABET pronunciation, including vowel stress digits. Copy a dictionary_readings phones array or explicitly supply a reading.'
          ),
        basis: z
          .enum(['dictionary', 'declared'])
          .describe(
            'dictionary verifies phones against CMUdict. declared accepts a supplied reading; its source is a caller declaration, not independently verified evidence.'
          ),
        source: z
          .string()
          .min(1)
          .max(1000)
          .describe(
            'Who chose this reading and why (e.g. writer: record means the disc), or the supplied pronunciation source. Never silently guess.'
          ),
      })
      .strict()
  )
  .max(128)
  .optional()
  .describe(
    'Explicit occurrence pronunciations, selected from pronunciation_options returned by grade/check, or supplied with a stated source. Rerun grade after choosing; the choice resolves a reading, not a pass. Carry unchanged through a revision run; regrade and start a new run to change declarations.'
  );

const melodyField = z
  .string()
  .max(65536)
  .optional()
  .describe(
    'Declared repeating monophonic phrase as JSON text, e.g. {"meter":{"beats":4,"unit":4,"groups":[2,2]},"bars":2,"subdivision":1,"notes":[{"pitch_hz":440,"ticks":8}]}. Repeat once per lyric line. Hz permits any tuning; null pitch is a rest. It is a plan declaration: the same seed can draw a different shape with a melody than without, so carry it unchanged to grade and revise. Underlay and pitch performance are not certified.'
  );

const narrativeField = z
  .string()
  .max(200)
  .optional()
  .describe(
    "The story plan. Omit: the planner DRAWS one job per sung section (ESTABLISH, COMPLICATE, TURN, DWELL, ANCHOR, JUDGE, RESOLVE, DEPART) and the junction each enters by. 'off' silences the layer. Or declare it: 'ATOM,ATOM/JUNCTION,ATOM/JUNCTION' — one atom per sung section, a junction (THEREFORE, BUT, AND_THEN, MEANWHILE, ELABORATE, JUXTAPOSE) before every atom after the first. A RECORD, not a gate: nothing grades a draft against its story plan; lyric_plan's brief prints it."
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
    'For a PASTED song only (a seeded run takes its blueprint off the plan and refuses this field): a DECLARED blueprint as JSON text — the bar grid the graders read: {"sections":[{"name","function","bars","start_bar","meter":{"beats","unit","groups":[…]}}],"lines":[{"text","bar","beat","duration"}], optional "title", "hooks"}. With it the meter, song-function, hook and title layers are ASKED of the paste; without it only rhyme and the slop floor are (blueprint_declared says which). A meter written as a signature STRING ("4/4") is refused, not parsed. Pass `subdivision` with it.'
  );
const subdivisionField = z
  .number()
  .int()
  .min(1)
  .max(8)
  .optional()
  .describe(
    'For a PASTED song only, with `blueprint`: the slot grid under the declared blueprint — units per beat (2 = eighths in x/4). REQUIRED with `blueprint` for the slot questions (SLOTS_EXCEEDED, the syllable ceiling); without it they REFUSE rather than assume a sixteenth-note grid.'
  );

// ONE READING FOR BOTH SPELLINGS: `draft` and `draft_text` drop the same
// rows (blank, or only a bracketed [SECTION] marker) — `lyric_text.js`.
const SUNG_ROWS =
  'Blank rows and rows that are only a bracketed [SECTION] marker are dropped; every other row is a sung line exactly as written.';
const draftField = z
  .array(z.string().max(MAX_LINE_CHARS))
  .min(1)
  .max(MAX_LINES)
  .describe(
    `The song lines in performance order, one string per line, repeated sections written out in full. ${SUNG_ROWS}`
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
    `The song lines as ONE string, one line per row (newline-separated), performance order, repeated sections written out in full — the same content as \`draft\`, read the same way, for a caller whose array calls break. ${SUNG_ROWS} Send one of the two.`
  );

// EVERY TOOL THAT TAKES LINES TAKES THEM AS ONE STRING TOO (M-248, round
// 22). Round 22's turn 0 broke `lyric_grade{draft:[ …` twice — M-226's
// array shape on a tool M-234 had not reached — and reached for
// `lyric_check` next. The string twin of each array field is accepted
// beside it and split by `draftFromText`; a handler reads the array, and
// `takeLines` fills it from the twin when only the twin was sent.
const textTwinOf = (arrayName) =>
  z
    .string()
    .max(MAX_LINES * (MAX_LINE_CHARS + 1))
    .describe(
      `The same lines as \`${arrayName}\` as ONE newline-separated string, one line per row, performance order, read the same way — for a caller whose array calls break. Send one of the two.`
    );
export function takeLines(a, arrayName, textName, { preserveStructure = false } = {}) {
  if (!preserveStructure && Array.isArray(a[arrayName]))
    a[arrayName] = normalizeDraftLines(a[arrayName]);
  if (typeof a[textName] === 'string') {
    const lines = preserveStructure
      ? String(a[textName]).replace(/\r\n?/g, '\n').split('\n')
      : draftFromText(a[textName]);
    if (Array.isArray(a[arrayName]) && JSON.stringify(a[arrayName]) !== JSON.stringify(lines))
      throw refuse(
        `Conflicting ${arrayName} and ${textName}: send one exact draft representation.`
      );
    a[arrayName] = lines;
  }
  if (!Array.isArray(a[arrayName]))
    throw refuse(`\`${arrayName}\` (or \`${textName}\`, the same lines as one string) is required`);
}

// THE BATCH ANSWER AS STRUCTURE, NOT AS MARKED ROWS (M-248, round 22).
// M-236's batch asks several lines at once and its answer was one string of
// `L<n>: <line>` rows. Round 22 was the first round on that shape and the
// model could not emit it as a call — MALFORMED_FUNCTION_CALL nine times of
// nine, every one `lyric_revise{answer: L1: …\nL3: …` — where round 21's 190
// single-line answers all went through and the newline-joined `draft_text`
// goes through: the marker's colon inside an unquoted value is the one
// thing the failing shape has that the passing ones lack. `answers` is one
// object per asked line, {line, text}; the connector joins it into the
// harness's own row format here, so `parse_batch` / `parse_group` and the
// replay file's shape do not move. A single-line question takes the one
// row's text bare (the harness would strip an echoed label anyway).
const answersField = z
  .array(
    z.object({
      line: z.number().int().min(1).max(MAX_LINES).describe('The asked line number, 1-based.'),
      text: z.string().max(MAX_LINE_CHARS).describe('The new line, bare — no label, no quotes.'),
    })
  )
  .min(1)
  .max(MAX_LINES)
  .describe(
    "The writer's answer as STRUCTURE: one {line, text} per asked line, every asked line present, nothing else — the shape to use for a BATCH or a group question (and fine for a single line). Replaces `answer` for those; send one of the two."
  );
export function answerFromRows(rows, pending) {
  const list = Array.isArray(rows) ? rows : [];
  const kind = pending?.kind;
  const asked = askedOf(pending);
  const members = kind === 'propose' ? [asked?.line] : asked?.lines || asked?.members || [];
  if (
    !members.length ||
    list.length !== members.length ||
    new Set(list.map((r) => r.line)).size !== list.length ||
    list.some((r) => !members.includes(r.line))
  )
    throw refuse(
      'Structured answers must name every asked line exactly once and no others: ' +
        members.join(', ')
    );
  if (kind === 'propose' && list.length === 1) return String(list[0].text).trim();
  return list.map((r) => `L${r.line}: ${String(r.text).trim()}`).join('\n');
}

// THE VERDICT'S EXTRACTORS, exported for mcp/test.mjs to drive on synthetic
// reports (M-186): a live check proves one draft; the unit cases prove the
// regexes against every spelling the harness prints.
export const _argvInternals = { globalsFor, planArgs };

export const _verdictInternals = {
  publishedReport,
  verificationEvidenceOf,
  resumeEvidenceOf,
  extractProposerRecord,
  WRITERS,
  KITCHEN_PROPOSE,
  KITCHEN_WAIT_SHARE,
  harnessEnv,
  groupOutcomeAt,
  askedOf,
  foldedOf,
  positionOf,
  stallsOf,
  outcomeAt,
  draftFp,
  draftFromText,
  verdictOf,
  extractRefusal,
  refusalHeadlineOf,
  EXIT_MEANING,
  loopStatusOf,
  gradeStamp,
};

// A plan declaration as lyric_revise publishes it: it shapes a seeded run's
// plan, and a pasted song's run refuses it.
const seededOnly = (field) =>
  field.describe(`Seeded runs only (refused without a seed). ${field.description}`);

// lyric_revise's `writer` exists only where the service's own writer may run
// (the website chat — buildServer({ kitchen: true })). Every outside surface
// publishes LYRIC_TOOL_SCHEMAS.lyric_revise without it, and keeps `checkpoint`
// only as an export door for runs that writer made before 2026-09-27.
const KITCHEN_ONLY_FIELDS = ['writer'];
export const LYRIC_TOOL_SCHEMAS = {
  lyric_screen: {
    words: z
      .array(z.string().max(MAX_WORD_CHARS))
      .min(2)
      .max(MAX_WORDS)
      .describe('2-12 bare words; every unordered pair among them is screened.'),
    // THE SCREEN CAN ASK THE GRADE'S QUESTION (M-189): a mandate that
    // DECLARES a relation is graded under that relation's own judge, so the
    // screen asks it through the same field, judge and coordinate. Without
    // one, every pair is listed with every relation it stands in.
    relation: relationField,
    fallback: fallbackField,
  },
  lyric_plan: {
    wants: z
      .array(z.string().max(MAX_WANT_CHARS))
      .max(MAX_WANTS)
      .optional()
      .describe(
        'Declared structural predicates that CONDITION the planner\'s draw — the same NAME<=N / NAME>=N / NAME=VALUE vocabulary as lyric_sweep\'s `want`, in a different role: the planner draws until they hold, so a seed planned with wants can be a different shape from the same seed planned without them. Carry unchanged to grade and revise; the plan discloses selection. In a creation session, pass the accepted sweep\'s `want` list here unchanged. Example: ["lines<=30", "group<=4"].'
      ),
    seed: seedField,
    form: formField,
    lines: linesField,
    relation: relationField,
    functions: functionsField,
    title: titleField,
    narrative: narrativeField,
    melody: melodyField,
  },
  lyric_grade: {
    wants: z
      .array(z.string().max(MAX_WANT_CHARS))
      .max(MAX_WANTS)
      .optional()
      .describe(
        'The exact wants used to construct this plan: they condition the draw, so a dropped want grades a different plan.'
      ),
    seed: seedField,
    form: formField,
    lines: linesField,
    relation: relationField,
    functions: functionsField,
    title: titleField,
    narrative: narrativeField,
    melody: melodyField,
    draft: draftField.optional(),
    draft_text: textTwinOf('draft').optional(),
    voices: voicesField,
    fallback: fallbackField,
    pronunciations: pronunciationField,
  },
  lyric_revise: {
    wants: z
      .array(z.string().max(MAX_WANT_CHARS))
      .max(MAX_WANTS)
      .optional()
      .describe(
        'Seeded runs only: the exact wants used to construct this plan; immutable through continuations.'
      ),
    // OPTIONAL SINCE M-195: a pasted song has no seed. Declare EITHER a seed
    // (the plan is the mandate) OR a mandate (`scheme` or `groups`, with
    // `returns`/`relation`/`structures`/`blueprint`/`subdivision` as
    // lyric_check takes them); exactly one, never both.
    seed: seedField
      .optional()
      .describe(
        "A PLANNED song's declared seed (the plan is the mandate); omit it to revise a pasted song under a declared mandate. Same seed and same declarations, same plan, byte for byte."
      ),
    scheme: z
      .string()
      // ONE LETTER PER LINE (see SCHEME_RE): REPINNED 2026-09-05 (M-239)
      // from ~~64~~, the old MAX_LINES, which capped a mandate at 64 lines
      // on a route whose draft ceiling is 447.
      .max(MAX_LINES)
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
    // Plan declarations: a seeded run's only, refused without a seed.
    form: seededOnly(formField),
    lines: seededOnly(linesField),
    relation: relationField,
    functions: seededOnly(functionsField),
    title: seededOnly(titleField),
    narrative: seededOnly(narrativeField),
    melody: seededOnly(melodyField),
    // OPTIONAL ON A CONTINUING CALL (M-221): the chat connector carries the
    // draft of the previous call beside the state, so a fold need not re-emit
    // every quoted line. A first call, or any client that carries nothing,
    // must still send it — the handler refuses an absent draft by name.
    draft: draftField.optional(),
    draft_text: draftTextField.optional(),
    voices: voicesField,
    fallback: fallbackField,
    pronunciations: pronunciationField,
    state: z
      .string()
      .max(MAX_STATE_CHARS)
      .optional()
      .describe(
        'The opaque, versioned interview state returned previously, VERBATIM. It carries the original replay input and the exact declarations even after the run cache expires, so passing it back with answer/answers continues the run with no other field; when it is the latest state of a run this tool still holds, that run continues and keeps its run_id. Never edit the envelope. Old contract states require explicit recovery rather than replay under changed semantics. Omit on the first call.'
      ),
    checkpoint: z
      .string()
      .max(MAX_STATE_CHARS)
      .optional()
      .describe(
        "The service writer's checkpoint returned by an interrupted call, VERBATIM. It includes original input, accepted lines, and completed answers; resume under the SAME declarations. Completed answers are verified again without another paid proposal. Never substitute the displayed final_draft for its original replay_draft."
      ),
    recover_only: z
      .boolean()
      .optional()
      .describe(
        'true exports accepted/input lyrics and the exact stored journal of one run, from the run envelope you pass (its `state` or `checkpoint`, whichever this surface declares), including after a semantic migration refusal. No replay, grading, writer call or run mutation occurs. Omit every other argument except that envelope and optional recovery_part. Recovery is bounded to 512 KiB decoded data and 2 MiB serialized result; if journal_included is false, repeat with recovery_part:journal and the same original wire. The artifact is uncertified and nonresumable; legacy JSON has no checksum proof.'
      ),
    recovery_part: z
      .enum(['all', 'journal'])
      .optional()
      .describe(
        'Only with recover_only:true. all (default) exports drafts and journal together when they fit; journal exports the exact full journal separately with the same original_wire_sha256, without replay or restamping.'
      ),
    run_id: z
      .string()
      .max(80)
      .optional()
      .describe(
        'The opaque run capability returned by a previous call. Send it with run_revision to continue that run: the run carries its state, its draft and its declarations, so the continuing call sends only the answer (or, for a parked run, the rewritten draft). A seed alone NEVER selects another run. Keep it private. Without it, pass the returned state verbatim, or open an independent run.'
      ),
    run_revision: z
      .number()
      .int()
      .positive()
      .optional()
      .describe(
        'Required with run_id: the exact revision returned by the last accepted continuation. Stale revisions refuse.'
      ),
    new_run: z
      .boolean()
      .optional()
      .describe(
        'true to open a fresh independent run on the draft you send; any run in progress is set aside intact. Send only the draft and the declarations with it.'
      ),
    writer: z
      .enum(WRITERS)
      .optional()
      .describe(
        "Who writes the lines. 'kitchen': the service's own writer answers every question and one call runs the loop to a stop; an interrupted call returns a checkpoint for explicit continuation. 'interview': the loop suspends at each question and the caller answers with answer/answers."
      ),
    answer: z
      .string()
      .max(MAX_ANSWER_CHARS)
      .optional()
      .describe(
        `The writer's answer to the pending question as ONE STRING — exactly one line of song text for a single-line question. For a BATCH (several independent lines asked at once, the common case) or a group question use \`answers\` instead: one {line, text} per asked line. (A string of \`L<n>: <line>\` rows is still read here, but that shape breaks as a function call in some clients.) It is parsed strictly and a malformed answer REFUSES rather than guessing which line goes where; an answered line over ${MAX_LINE_CHARS} characters is refused before the loop runs. Omit on the first call (there is no question yet).`
      ),
    answers: answersField.optional(),
    max_rounds: z
      .number()
      .int()
      .min(1)
      .optional()
      .describe(
        'Optional round budget (ReviseDeclaration.max_rounds). Omit it and there is no round limit: the loop keeps going while rounds fix something, and stops when the song is clean or a round fixes nothing. Declared once per run: a continuing call that moves it is refused, because the run replays its record under the budget it opened with.'
      ),
    attempts: z
      .number()
      .int()
      .min(0)
      .max(6)
      .optional()
      .describe(
        'Tier-1 attempts per flagged line (default 1: a rejected line is re-briefed fresh next round with its rejection quoted, rather than re-asked at once). Declared once per run, like max_rounds.'
      ),
    backtrack: z
      .number()
      .int()
      .min(0)
      .max(8)
      .optional()
      .describe(
        "Tier-2 backtrack width (this connector's default is 1: when tier 1 fails on a line, ONE group rewrite is asked of you that round — the whole rhyme group at once, which is the only move when every single-word answer is banned; 0 shuts it). Declared once per run, like max_rounds."
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
        `How many consecutive seeds to plan (1-${MAX_SWEEP_SEEDS}); every seed in the window is planned, which is why the window is bounded. Sweeps COMPOSE exactly — under the same declarations each seed plans one fixed shape, so calling again with seed_from = next_seed_from continues the search and the counts add. This is pagination, not truncation.`
      ),
    want: z
      .array(z.string().max(MAX_WANT_CHARS))
      .max(MAX_WANTS)
      .optional()
      .describe(
        "What you want the shape to be, as predicates: NAME<=N, NAME>=N, or NAME=VALUE. A FILTER over each seed's plan as drawn without these predicates — not lyric_plan's `wants`, which conditions the draw itself. The vocabulary is CLOSED and an undeclared name refuses BY NAME, printing the whole table. Function-specific counts: sections.verse=5, min_lines.verse=4, max_lines.verse=4 (replace verse with any declared section function; absence reads zero). Counts (answer <=, >=, =): lines, sections, lines_per_section (smallest SUNG section), group (deepest rhyme group), n_sounds (how many DISTINCT rhyme sounds the drawn scheme asks the song to find), adjacencies (how many adjacent line pairs the scheme asks to share a sound), crossings (how many pairs INTERLEAVE — ABAB rather than the nested ABBA), bars_per_line, beats_per_line, slots_per_line, hook (line number, 0 if none), returns (how many verbatim-return classes), pins_per_line (most words any line is bound at), bound_words_per_line (the MEAN words bound per line, over every line — the DENSITY coordinate, and the one that answers a fraction: `pins_per_line` is a per-line CAP, so it asks whether EVERY line is under k and at song length nearly every draw puts some line at the ceiling), story_lineups (how many legal story line-ups the shape admits — story_lineups>=1 filters for shapes that can carry a story at all). Function-valued (answer '=' only, comma-separated names): uses=verse,chorus means BOTH were drawn; before=verse,chorus means the first verse precedes the first chorus, and is FALSE rather than an error if either is absent. Omit entirely and every seed that plans is accepted, which is honest and useless — there is no default, because a sweep does not decide what you want."
      ),
    form: formField,
    lines: linesField,
    functions: functionsField,
    melody: melodyField,
  },
  lyric_verify: {
    before: draftField
      .optional()
      .describe(
        'The draft BEFORE the revision: lines in performance order, one string per line, repeated sections written out in full. No [SECTION] markers.'
      ),
    before_text: textTwinOf('before').optional(),
    after: draftField
      .optional()
      .describe(
        'The draft AFTER the revision, line for line against `before` under the same mandate: lines in performance order, repeated sections written out in full. No [SECTION] markers.'
      ),
    after_text: textTwinOf('after').optional(),
    blueprint: blueprintField,
    subdivision: subdivisionField,
    scheme: z
      .string()
      // ONE LETTER PER LINE (see SCHEME_RE): REPINNED 2026-09-05 (M-239)
      // from ~~64~~, the old MAX_LINES, which capped a mandate at 64 lines
      // on a route whose draft ceiling is 447.
      .max(MAX_LINES)
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
      .describe(
        "Verbatim returns: whole lines '5,13;6,14' or word identity at placements '1.head,3.head'. Optional."
      ),
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
    pronunciations: pronunciationField,
    targeted: z
      .array(z.number().int().min(1).max(MAX_LINES))
      .max(MAX_LINES)
      .optional()
      .describe(
        'The 1-based lines this revision was ASKED to change. Declaring it turns on the "you quietly rewrote lines nobody asked about" rejection — one of the three silent ways a revision goes wrong. Omit and that check does not run, which is a REFUSAL on it, not evidence the revision stayed in scope.'
      ),
  },
  lyric_recover: {
    // A paste AS PRINTED: unlike every other draft field, the rows that mark
    // structure are kept and read as structure, not dropped.
    lines: z
      .array(z.string().max(MAX_LINE_CHARS))
      .min(1)
      .max(MAX_LINES)
      .optional()
      .describe(
        "The pasted song as printed, one string per row: a row that is only a bracketed [SECTION] marker declares a section, an EMPTY entry is a stanza break, and a row the harness's source reader treats as apparatus (beginning '[', '#' or '---') is set aside and listed in `set_aside`. Every other row is a sung line."
      ),
    lines_text: z
      .string()
      .max(MAX_LINES * (MAX_LINE_CHARS + 1))
      .optional()
      .describe(
        'The same paste as ONE newline-separated string, rows exactly as printed (blank rows and [SECTION] rows included) — for a caller whose array calls break. Send one of the two.'
      ),
    placements: z
      .string()
      .max(200)
      .optional()
      .describe(
        "Which places in a line the recovered web searches, comma-separated (end, endword, head, headrime, T<n>); omit for the module's default set, which the report names."
      ),
    fallback: fallbackField,
    pronunciations: pronunciationField,
    voices: voicesField,
  },
  lyric_check: {
    lines: draftField.optional(),
    lines_text: textTwinOf('lines').optional(),
    scheme: z
      .string()
      // ONE LETTER PER LINE (see SCHEME_RE): REPINNED 2026-09-05 (M-239)
      // from ~~64~~, the old MAX_LINES, which capped a mandate at 64 lines
      // on a route whose draft ceiling is 447.
      .max(MAX_LINES)
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
        "Declare a catalog STRUCTURE per group, e.g. 'B:kalevala-alliteration' — the group's pairs are then judged by that row's own judge at its own anchors, not by the end-rhyme comparator. Comma-separated for several: 'A:pararhyme,B:skothending'. An unknown name refuses, and the refusal lists the catalog's rows and aliases. TWO CONSEQUENCES a caller must expect: the two-tier ban is NOT ASKED of a pair judged under a non-default structure (the ban's tables are end-rhyme instruments) — the verdict lists those pairs in ban_not_asked, and banned_pairs is null when no pair was asked; and a row with no laziness calibration for the draft's language is named in structures_uncalibrated — correctness is judged, laziness is not. Cannot be combined with a song-wide `relation`: both judge the same pairs and the relation would win on every group, so the harness refuses rather than letting a declared structure grade nothing."
      ),
    voices: voicesField,
    fallback: fallbackField,
    pronunciations: pronunciationField,
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
    // WITHOUT A POSITION THE COORDINATE IS INCOMPLETE: most traditional
    // names are defined at a position in the line, so the harness names
    // nothing (UNNAMED) until one is declared. Two words handed to this tool
    // are most often two line ends, which is also what a mandate's groups
    // are, so that is the default.
    position: z
      .enum(TYPE_POSITIONS)
      .optional()
      .describe(
        "Where in a line the two words sit (default end: two line-final words, as a mandate group's members are). Traditional names are judged at this position, and many exist only at one, so the names returned depend on it."
      ),
  },
};
// The website chat's full revise shape. Stored run declarations are parsed with
// it too, so a record that names its writer keeps it. Two budget fields say
// who is asked, and there the service writer is, with its own attempt default.
export const KITCHEN_REVISE_SCHEMA = Object.freeze({
  ...LYRIC_TOOL_SCHEMAS.lyric_revise,
  attempts: LYRIC_TOOL_SCHEMAS.lyric_revise.attempts.describe(
    `Tier-1 attempts per flagged line. When the service writer answers, the default is ${KITCHEN_ATTEMPTS}: a rejected line is re-asked at once with its rejection quoted. Declared once per run, like max_rounds.`
  ),
  backtrack: LYRIC_TOOL_SCHEMAS.lyric_revise.backtrack.describe(
    "Tier-2 backtrack width (this connector's default is 1: when tier 1 fails on a line, ONE group rewrite is asked of the service writer that round — the whole rhyme group at once; 0 shuts it). Declared once per run, like max_rounds."
  ),
});
for (const key of KITCHEN_ONLY_FIELDS) delete LYRIC_TOOL_SCHEMAS.lyric_revise[key];
LYRIC_TOOL_SCHEMAS.lyric_revise.checkpoint = z
  .string()
  .max(MAX_STATE_CHARS)
  .optional()
  .describe(
    'Only with recover_only:true: a checkpoint that an earlier server-written run returned, VERBATIM, to export its accepted lyrics and journal. It cannot resume a run here — you write every line.'
  );

const kitchenChatOnly = () =>
  refuse(
    "KITCHEN_CHAT_ONLY: the service's own writer runs only inside the website chat. Here you write every line: send the draft without writer/checkpoint and answer each question the loop asks. A checkpoint from an earlier server-written run can still be exported with recover_only:true."
  );

// ── lyric_revise's description ────────────────────────────────────────────
// One text per surface. Outside surfaces (no kitchen) never mention a writer
// choice: the caller writes every line. The website chat's surface adds the
// service writer, which it drives on the chat model's behalf.
function reviseDescription({ kitchen = false } = {}) {
  // True on every surface this text is published on: a session carries the
  // run for its caller, a raw call names it by run_id/state, and how is
  // described with the session and on those fields, not here.
  const common =
    "THE WORKING ORDER'S LAST STEP, and the only tool whose output contains a FINISHED song. It drives the " +
    "harness's revise loop over the draft against the SAME plan lyric_plan drew — same seed, same plan " +
    `declarations (${PLAN_DECLARATIONS}), or a DIFFERENT plan is revised — under the reading declarations ` +
    `(${READING_DECLARATIONS}) lyric_grade used; or, for a pasted song, against the same mandate lyric_check ` +
    'graded (no seed; scheme or groups, optional returns/relation/structures, blueprint with subdivision) — the ' +
    'plan declarations belong to a seeded run and are refused without a seed. The loop grades, holds every ' +
    'flagged and banned line open, and keeps going until a stop condition. THERE IS NO SONG IN ANY RESPONSE ' +
    "UNTIL THE LOOP REACHES A STOP CONDITION. At a stop condition the tool result's first text block is the " +
    'rendered song in performance order under its bracket headers with a [FINISHED — seed N — exit E — ' +
    'STOP_REASON — ...] stamp. The stamp marks a stop, not a finished song: ONLY exit 0 with certified ' +
    'coverage is finished. Exit 3 names the lines still open, or — with no line open — the WHOLE-DRAFT ' +
    'FLAG(S) standing: a PARKED song either way; `status` says which of the two, and `loop_whole_flag_codes` ' +
    'names the flags. Exit 2 means coverage was not certified (`coverage` and `certified` say which pairs ' +
    'went unjudged); when its stamp also names UNRESOLVED lines, the song is parked as well. Present an exit ' +
    '2 or 3 stop as parked or uncertified, never as finished — its note says what to do next. ' +
    'Banned pairs (the two-tier ban) are reported as notes and hold no line open. Budget fields (max_rounds, attempts, backtrack) are declared once per run; a ' +
    `moved declaration is refused. Writer execution enforces ${MAX_LINE_CHARS} characters per sung line. ` +
    'A journal_capacity stop preserves ' +
    'the exact journal and accepted draft and cannot resume; reduce the requested scope before independent ' +
    'new_run work. ';
  const interview =
    "YOU WRITE EVERY LINE. A suspended call returns [AWAITING PROPOSAL] and the writer's brief for ONE " +
    'question as its first text block — which lines, what they must answer, which words are FORBIDDEN as ' +
    'too predictable — and no song. Answer by calling lyric_revise again with only `answer` (exactly one ' +
    'line of song text) or `answers` (one {line, text} per asked line — the shape for a batch or a group ' +
    'question): the run keeps its declarations and the draft it opened on, and the call names the run the ' +
    'way this connection carries it. Each call resumes from its saved, sealed position, or replays its ' +
    'record when that position cannot be trusted; the same questions arrive in the same order either way. ' +
    'A call that nears its time limit stops between steps (exit 5) and the next call with no answer ' +
    'continues it. To start again on a different draft, grade that draft first, then ' +
    'send it with `new_run: true`. ';
  const chat =
    'ON THIS SURFACE THE SERVICE WRITER ANSWERS: send the draft and the declarations; one call runs the ' +
    'loop to a stop condition, the writer answering each question (a group question asks for every line of ' +
    'the group at once). An interrupted call records a checkpoint that the next lyric_revise call for the ' +
    'same song resumes (the chat carries it for you), with `final_draft` as the exact accepted lines and ' +
    '`replay_draft` as the original input; never replay answers against final_draft, and never resume an ' +
    'unknown provider completion. After a migration refusal, `recover_only: true` with only the original ' +
    'checkpoint exports its accepted lyrics and journal without replay or restamping. ';
  return common + (kitchen ? chat : interview);
}

// ── registration ───────────────────────────────────────────────────────────

export function registerLyricTools(server, tool) {
  tool(
    server,
    'lyric_screen',
    {
      title: 'Screen rhyme pairs before writing',
      description:
        'Is this rhyme pair USABLE? Every unordered pair among the words is listed with EVERY relation it stands in — ' +
        'each coarse relation (RHYME, RIME_RICHE, PROMOTED_RHYME, ASSONANCE, CONSONANCE) at its own cut and every registry ' +
        'schema judged at the two end words (a perfect rhyme is also assonance, and consonance when it closes on a ' +
        'consonant — heart/start, not sky/fly; rain/reign is RHYME and RIME_RICHE) — plus the schemas that could not ' +
        "decide at the pair, and the song grader's bans on a minimal mandated " +
        'pair: BANNED (HOMEOTELEUTON — same spelled ending, the laziest true rhyme; MODAL_RHYME — the most predictable ' +
        "partner), or the grader's own refusal for an unreadable word. A banned pair is an ANSWER, not an error. A pair " +
        'standing in no relation is reported as standing in none. USE THIS BEFORE WRITING to check proposed pairs against ' +
        'the declared requirements. Pass `relation` to ask the question a mandate declaring it will ask (SATISFIES / ' +
        'VIOLATES / REFUSED per pair), reported independently beside the relation list. ' +
        'Scope: this screens bare candidate words on fixed carrier lines, not the eventual lyric lines; coarse relations ' +
        'search anchor spans and may differ in full-line context. ' +
        'Only lyric_grade on the exact planned draft establishes whether its actual bindings satisfy the mandate. ' +
        'In a creation session one successful lyric_screen after lyric_sweep is a required step before lyric_plan; ' +
        'the session records that the step ran, not which words — screen the pairs you mean to write. ' +
        EXECUTION_CONTRACT,
      inputSchema: LYRIC_TOOL_SCHEMAS.lyric_screen,
    },
    async (a) => {
      checkWords(a.words);
      const sargs = [...globalsFor(a), 'screen', ...a.words];
      if (a.relation) sargs.push(`--relation=${a.relation}`);
      const r = await runVerb(sargs);
      const v = verdictOf(r);
      // EVERY RELATION EACH PAIR STANDS IN, off the harness's authenticated
      // record rather than parsed out of the table: `relations` is the
      // admitted coarse relations plus every registry schema true at the
      // two end words, `undecided` the schemas that could not decide.
      if (r.lyric_result?.status === 'screened' && Array.isArray(r.lyric_result.pairs))
        v.pairs = r.lyric_result.pairs;
      return v;
    }
  );

  tool(
    server,
    'lyric_plan',
    {
      title: 'Plan a song shape (seeded, reproducible)',
      description:
        'The PLANNING phase: seed in, a complete song shape out — sections with bars/meter/pickup, a rhyme plan, verbatim-return ' +
        `rules, a hook slot, and a writer brief to write to. Deterministic: the same seed and the same declarations (${PLAN_DECLARATIONS}) ` +
        'always return the same plan, and every free choice is disclosed beside the space it was drawn from (meters come from a ' +
        'derived cycle grammar and are often not 4/4). It writes NO WORDS: the writer (model or human) writes to the brief, then ' +
        'lyric_grade checks the draft against this same plan. CHOOSE THE SEED WITH lyric_sweep, not by trying a few: declare what ' +
        "the shape must be and take one of the seeds that hold (the working order's step 0). In a creation session the plan " +
        "must repeat the accepted sweep's form, lines, functions and melody and pass the sweep's `want` list as `wants`; " +
        '`wants` conditions the draw (the planner draws until they hold), so the planned shape satisfies them and can differ ' +
        "from the shape the sweep tested. Declaring a `title` answers 'is the title in the hook?' instead of leaving it " +
        "refused — and the answer can be NO, which is a FLAG, so write the hook line to contain the title's words as a " +
        "contiguous run. The tool result's first text block is the plan report and writer brief: when showing the shape, " +
        'keep the bracket header rows exactly as written (they carry lines/bars/meter/pickup). The second block is the ' +
        'verdict.',
      inputSchema: LYRIC_TOOL_SCHEMAS.lyric_plan,
    },
    (a) =>
      withTempDir(async (dir) => {
        const r = await runVerb(['plan', ...planArgs(a), `--out=${path.join(dir, 'plan.json')}`]);
        const verdict = verdictOf(r);
        // Same presentation-first shape as lyric_grade: the report (plan
        // rows + writer brief, headers intact) leads as plain text.
        if (r.code === 0) {
          // The report ends with the CLI's own apparatus — the path the plan
          // was written to on this server and the python commands that
          // would grade it — which is neither the plan nor anything a caller
          // runs; lyric_grade is the grading step here.
          const wrote = r.stdout.search(/^[ \t]*WROTE plan\b/m);
          const report = wrote >= 0 ? r.stdout.slice(0, wrote).trimEnd() + '\n' : r.stdout;
          const plan = JSON.parse(await readFile(path.join(dir, 'plan.json'), 'utf8'));
          verdict.plan = plan;
          verdict.plan_sha256 = createHash('sha256').update(JSON.stringify(plan)).digest('hex');
          verdict.plan_request = plan.request;
          // The verdict block carries everything verdictOf stamped — path,
          // ms, plan_lines (M-216) — and not the report, which is block 0.
          // This block used to re-spell the verdict as {exit_code, meaning}
          // by hand, so a plan row never said which path answered or how
          // many lines the plan drew: round 9's "large drawn shape" stayed
          // an inference through round 11 for this reason (M-219).
          const { report: _report, ...stamped } = verdict;
          return {
            content: [
              { type: 'text', text: report },
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
        'The whole-song verdict: re-derives the plan from the SAME seed and the same plan declarations given to ' +
        `lyric_plan (${PLAN_DECLARATIONS} — every one that was declared there must be declared here, or a DIFFERENT ` +
        'plan is graded), fills it with the draft, and grades — rhyme mandate, verbatim returns, meter fit, section ' +
        `functions, the slop floor — under the reading declarations (${READING_DECLARATIONS}), which lyric_revise then ` +
        "carries unchanged. THE TOOL RESULT'S FIRST TEXT BLOCK IS THE GRADED DRAFT rendered in performance order — an " +
        'INTERIM artifact, never a finished song (finishing is lyric_revise, whose [FINISHED …] stamp only exists past a ' +
        'stop condition of the revise loop): when presenting it, reproduce that block CHARACTER FOR CHARACTER, exactly ' +
        "as you present a recipe string — the bracket headers carry each section's lines, bars, meter and pickup, and " +
        'restyling them to bare [SECTION] deletes the measurements the format exists to carry, and the [GRADED — seed …] ' +
        'stamp line under the song is part of the block. The second block is the verdict — READ IT, NOT THE EXIT CODE: ' +
        'measurement_status "graded" means the draft was measured; certified and coverage say whether every mandated ' +
        'pair and requested layer was judged (coverage.refused_obligations names what was not); flags and whole_flags ' +
        'count the FLAGS standing (defects); banned_pairs counts mandated pairs on the two-tier ban (HOMEOTELEUTON / ' +
        'MODAL_RHYME), and banned[] names each pair by its lines and, in binding, the bound word and its place on each ' +
        'line — often not the end word. The code follows from those: 0 is measured and certified with no flag; ' +
        '3 is measured and certified with a flag or a whole-draft flag standing; 2 is either ' +
        'measured with coverage incomplete (flags may stand too) or refused with nothing measured (refusal names why). ' +
        'The stamp says which. Banned pairs are notes: rewrite one only if you want to. Other NOTES are ' +
        'measurements, not defects. Revise the flagged lines only and call again. ' +
        EXECUTION_CONTRACT,
      inputSchema: LYRIC_TOOL_SCHEMAS.lyric_grade,
    },
    (a) =>
      withTempDir(async (dir) => {
        takeLines(a, 'draft', 'draft_text');
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
        // PER-GROUP RELATIONS, ONLY WHEN THE PLAN CARRIES DECLARED ONES.
        // The planner draws none (the N-relation model, 2026-09-22), so a
        // plan with no declaration emits no `--relations=` and the grade
        // judges every group against every relation. When the plan DOES
        // carry them they go through byte-identical to `quality/plan.py`'s
        // `grading_command()` spelling, sorted by label (doctrine 1).
        // `execFile` passes ONE argv token and there is no shell, so a name's
        // parentheses and apostrophes need no quoting here.
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
        verdict.plan_sha256 = createHash('sha256').update(JSON.stringify(plan)).digest('hex');
        verdict.plan_request = plan.request;
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
          const stamp = gradeStamp(a.seed, verdict);
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
      description: reviseDescription({ kitchen: server.kitchen }) + EXECUTION_CONTRACT,
      inputSchema: server.kitchen ? KITCHEN_REVISE_SCHEMA : LYRIC_TOOL_SCHEMAS.lyric_revise,
      // Only the website chat's writer calls out to a model provider.
      annotations: { readOnlyHint: false, idempotentHint: false, openWorldHint: server.kitchen },
    },
    (a) => {
      if (a.recovery_part != null && !a.recover_only)
        throw refuse(
          'recovery_part requires recover_only:true; it cannot request a writer continuation.'
        );
      if (!server.kitchen && !a.recover_only && a.checkpoint != null) throw kitchenChatOnly();
      // What the CALLER declared, before anything is carried in from a run
      // record or a state: only a declaration the caller made can be refused
      // as not belonging to the kind of run it opens.
      const sent = new Set(Object.keys(a).filter((k) => declared(a[k])));
      // A STATE THAT IS ITS RUN'S LATEST RECORD CONTINUES THAT RUN. The state
      // carries a digest of its run's capability, so an exact match names one
      // run: continuing by state then keeps the run_id and advances its
      // revision, where it used to mint a new cached record on every call —
      // one song, one record per answer, in a cache all callers share. A
      // state that is not its run's latest (a retry, a fork) still opens an
      // independent run, as before.
      if (!a.recover_only && a.run_id == null && !a.new_run && typeof a.state === 'string') {
        const held = RUNS.byState(a.state);
        if (held) {
          a.run_id = held.run_id;
          a.run_revision = held.revision;
        }
      }
      return a.recover_only
        ? recoverContinuationOnly(a)
        : withRunLock(a, () =>
            withTempDir(async (dir) => {
              // M-234: the draft may arrive as one string.
              if (a.draft_text != null || a.draft != null) takeLines(a, 'draft', 'draft_text');
              // A seed is a musical declaration, never an ownership key. Knowing
              // another caller's seed cannot discover, modify, or erase their run.
              if (
                a.new_run &&
                (a.state != null || a.checkpoint != null || a.answer != null || a.answers != null)
              )
                throw refuse(
                  '`new_run` starts on a draft: omit state, checkpoint, answer and answers'
                );
              let runKey = runKeyOf(a);
              const runRec = a.new_run ? null : a.run_id ? RUNS.byId(a.run_id) : null;
              // Minted before the verb runs so every state this call encodes
              // names the run it belongs to (see RUNS.byState).
              const runId = runRec?.run_id ?? newRunId();
              if (runRec?.status === 'journal_capacity')
                throw refuse(
                  'JOURNAL_CAPACITY: this run reached its journal capacity. Keep its returned state/checkpoint and final_draft. This run cannot resume; an identical restart may hit the same limit. Reduce the requested scope explicitly before independent new_run work.'
                );
              if (a.run_id && !a.new_run && !runRec && a.state == null && a.checkpoint == null)
                throw refuse(
                  `\`run_id\` ${a.run_id} names no run this tool remembers — it may have finished, expired (${Math.round(RUNS.ttlMs / 3600000)} h idle) or been forgotten by a restart; pass \`state\` back, or omit \`run_id\` and send the draft to open a fresh run`
                );
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
                  (runRec.status === 'suspended' ||
                    (runRec.status === 'interrupted' && runRec.decl?.writer === 'interview')) &&
                  a.state == null &&
                  typeof runRec.state === 'string'
                ) {
                  a.state = runRec.state;
                  carried.state = true;
                }
                if (
                  ['suspended', 'interrupted'].includes(runRec.status) &&
                  a.draft == null &&
                  Array.isArray(runRec.draft)
                ) {
                  a.draft = runRec.replay_draft || runRec.draft;
                  carried.draft = true;
                }
                if (
                  ['interrupted', 'uncertain_proposal'].includes(runRec.status) &&
                  a.checkpoint == null &&
                  runRec.checkpoint
                ) {
                  a.checkpoint = runRec.checkpoint;
                  carried.state = true;
                }
              }
              // Only the outer connector contract changes here. The worker reads
              // its original journal schema, and foldedOf/askedOf see raw state.
              const checkpointWire = a.checkpoint;
              for (const field of ['state', 'checkpoint'])
                if (a[field] != null) {
                  const decoded = decodeState(a[field]);
                  assertContinuationCapacity(decoded);
                  if (decoded.new_run_required || decoded.status === 'journal_capacity')
                    throw refuse(
                      'JOURNAL_CAPACITY: this journal is a recovery artifact and cannot resume. Keep it and its final_draft or accepted_lines. An identical restart may hit the same limit; reduce the requested scope explicitly before independent new_run work.'
                    );
                  if (field === 'state') {
                    // The seal is checked first, over the state exactly as it
                    // was returned (LOOP_REDESIGN.md §2.0.1).
                    verifyInterviewCursor(decoded);
                    if (!decoded.connector_declarations || !Array.isArray(decoded.input_draft))
                      throw refuse(
                        'CONTINUATION_INVALID: interview state lacks original input and declarations; preserve it as a recovery artifact.'
                      );
                    const decl = declarationsOf(
                      z.object(KITCHEN_REVISE_SCHEMA).parse(decoded.connector_declarations)
                    );
                    const moved = movedDeclarations(decl, a);
                    if (moved.length)
                      throw refuse(
                        'state declarations moved: ' + moved.map((x) => x.field).join(', ')
                      );
                    for (const [key, value] of Object.entries(decl))
                      if (a[key] === undefined) {
                        a[key] = value;
                        carried.decl = true;
                      }
                    checkLines(decoded.input_draft);
                    if (a.draft == null) {
                      a.draft = decoded.input_draft;
                      carried.draft = true;
                    }
                    if (JSON.stringify(a.draft) !== JSON.stringify(decoded.input_draft))
                      throw refuse(
                        'state resume requires its original replay_draft; accepted lyrics cannot replace replay input.'
                      );
                    // Connector metadata is carried outside the worker's journal budget.
                    delete decoded.connector_declarations;
                    delete decoded.connector_semantic_identity;
                    delete decoded.connector_run_ref;
                  }
                  a[field] = JSON.stringify(decoded);
                }
              let checkpoint = null;
              if (a.checkpoint != null) {
                try {
                  checkpoint = JSON.parse(a.checkpoint);
                } catch {
                  throw refuse(
                    '`checkpoint` is not the JSON this tool returned — pass it back VERBATIM'
                  );
                }
                if (
                  checkpoint?.version !== 1 ||
                  !Array.isArray(checkpoint.input_draft) ||
                  !Array.isArray(checkpoint.accepted_lines) ||
                  !checkpoint.answered
                )
                  throw refuse(
                    '`checkpoint` lacks its version, original input, accepted lines or completed answer journal'
                  );
                if (checkpoint.uncertain_proposal)
                  throw refuse(
                    'The last provider request may have completed, but its answer was not recorded. This checkpoint cannot safely resume that request. The returned final_draft contains every accepted edit and replay_draft preserves the original input. To start independent work from those accepted lines, use new_run with that draft and omit checkpoint/state; another provider request may incur additional cost.'
                  );
                checkLines(checkpoint.input_draft);
                checkLines(checkpoint.accepted_lines);
                if (checkpoint.connector_declarations) {
                  const decl = declarationsOf(
                    z.object(KITCHEN_REVISE_SCHEMA).parse(checkpoint.connector_declarations)
                  );
                  const moved = movedDeclarations(decl, a);
                  if (moved.length)
                    throw refuse(
                      'checkpoint declarations moved: ' + moved.map((x) => x.field).join(', ')
                    );
                  for (const [k, v] of Object.entries(decl))
                    if (a[k] === undefined) {
                      a[k] = v;
                      carried.decl = true;
                    }
                }
                if (a.draft == null) {
                  a.draft = checkpoint.input_draft;
                  carried.draft = true;
                }
                if (JSON.stringify(a.draft) !== JSON.stringify(checkpoint.input_draft))
                  throw refuse(
                    'checkpoint resume needs its original replay_draft as draft; accepted lines are presentation/recovery data, not the replay input'
                  );
                // Metadata has been validated and carried into a; the worker's
                // 448 KiB journal budget excludes this separately bounded envelope.
                delete checkpoint.connector_declarations;
                delete checkpoint.connector_semantic_identity;
              }
              runKey = runKeyOf(a);
              if (!Array.isArray(a.draft))
                throw refuse(
                  '`draft` omitted and no draft is carried for this run — pass the song lines (the SAME draft on every call of one run; the tool carries it for you after a suspended call)'
                );
              checkLines(a.draft);
              const draftPath = path.join(dir, 'draft.txt');
              const statePath = path.join(dir, 'state.json');
              const checkpointPath = path.join(dir, 'checkpoint.json');
              await writeFile(draftPath, a.draft.join('\n') + '\n', 'utf8');
              const checkpointInput = checkpoint ? JSON.stringify(checkpoint) + '\n' : null;
              if (checkpointInput) await writeFile(checkpointPath, checkpointInput, 'utf8');
              // The caller can carry the record independently of the run cache. The blob
              // is the harness's OWN deferred-run state (its `answered` block is a
              // valid --propose=replay: file), so the revision is reproducible by
              // anyone holding the conversation — and it cannot be forged into a
              // finished song. A verdict is trusted only under this server's
              // seal: an edited outcome, journal or saved position fails the
              // seal, the position is dropped, and every answer is REPLAYED
              // through verify() on this call (LOOP_REDESIGN.md §2.0.1). The
              // render below only ever comes from the verb's own run past a
              // stop condition.
              if (a.state != null) {
                let st;
                try {
                  st = JSON.parse(a.state);
                } catch {
                  throw refuse(
                    '`state` is not the JSON this tool returned — pass it back VERBATIM'
                  );
                }
                if ((a.answer != null || a.answers != null) && !st?.pending)
                  throw refuse(
                    '`answer`/`answers` was given and `state` holds no pending question — there is nothing it answers'
                  );
                // M-248: the structured answer becomes the harness's own row
                // format here, keyed on the question's kind.
                if (Array.isArray(a.answers)) {
                  const answer = answerFromRows(a.answers, st?.pending);
                  if (a.answer != null && a.answer !== answer)
                    throw refuse(
                      'Conflicting answer and answers: send one exact proposal representation.'
                    );
                  a.answer = answer;
                }
                if (a.answer != null) {
                  if (!st || !st.pending)
                    throw refuse(
                      '`answer`/`answers` was given and `state` holds no pending question — there is nothing it answers'
                    );
                  // The same bound `answers` states in its schema and the
                  // service writer's brief states, refused here before the
                  // loop runs rather than after it has spent an attempt.
                  const long = answeredLines(a.answer).find((t) => t.length > MAX_LINE_CHARS);
                  if (long != null)
                    throw refuse(
                      `ANSWER_TOO_LONG: an answered line is at most ${MAX_LINE_CHARS} characters and this one has ${long.length}. Nothing was run and the same question is still pending — answer it again with a shorter line.`
                    );
                  st.pending.answer = a.answer;
                }
                // The newly supplied answer counts too. Reject before the worker
                // can consume it if an externally supplied near-limit journal
                // leaves insufficient room; the caller retains both exact inputs.
                assertContinuationCapacity(st);
                // The fold receipt must read the submitted answer too, whether
                // it arrived embedded in state or through answer/answers beside
                // a run capability. This string is request-local; the cached
                // predecessor remains immutable until the accepted successor.
                a.state = JSON.stringify(st);
                // The no-progress count is the connector's, read off `a.state`
                // when this call ends; the harness never sees or returns it.
                const { stalls: _stalls, ...forHarness } = st;
                await writeFile(statePath, JSON.stringify(forHarness, null, 2) + '\n', 'utf8');
              } else if (a.answer != null || a.answers != null) {
                throw refuse(
                  '`answer`/`answers` without `state` — the first call has no question to answer'
                );
              }
              // SEEDED: `finish` reads the mandate off the plan. UNSEEDED (M-195):
              // `revise` under the declared mandate, with the same deferred state,
              // the same stop conditions and — since M-195 — the same render and
              // [FINISHED — …] stamp, so a pasted song has the same door to a
              // finished song a planned one has.
              const seeded = a.seed != null;
              const hasScheme = a.scheme != null && a.scheme !== '';
              const hasGroups = a.groups != null && a.groups !== '';
              if (
                seeded &&
                (hasScheme ||
                  hasGroups ||
                  a.returns ||
                  a.structures ||
                  a.blueprint ||
                  a.subdivision != null)
              )
                throw refuse(
                  'a seeded run takes its mandate and its blueprint OFF THE PLAN — drop scheme/groups/returns/structures/blueprint/subdivision, or drop the seed to revise a pasted song'
                );
              // A pasted song has no plan for these to shape; they used to be
              // accepted, stored as the run's declarations and never read.
              const planOnly = PLAN_ONLY_FIELDS.filter((k) => sent.has(k));
              if (!seeded && planOnly.length)
                throw refuse(
                  `${planOnly.join(', ')} ${planOnly.length === 1 ? 'is a plan declaration and applies' : 'are plan declarations and apply'} only to a seeded run. A pasted song's run is declared by its mandate — scheme or groups, with returns, relation, structures and blueprint as lyric_check took them. Drop ${planOnly.length === 1 ? 'it' : 'them'}, or revise a planned song with its seed.`
                );
              if (!seeded && ((hasScheme && hasGroups) || (!hasScheme && !hasGroups && !a.returns)))
                throw refuse(
                  "without a seed, declare one of 'scheme' or 'groups', or a returns-only mandate — a pasted song's mandate is a declaration, not a default"
                );
              if (!seeded && hasScheme && !SCHEME_RE.test(a.scheme))
                throw refuse("scheme must be letters only, e.g. 'ABAB'");
              if (!seeded && hasGroups && !MANDATE_RE.test(a.groups))
                throw refuse(
                  "groups must be line numbers like '1,3;2,4', optionally naming a place"
                );
              if (!seeded && a.returns && !RETURNS_RE.test(a.returns))
                throw refuse("returns must be members like '5,13;6,14' or '1.head,3.head'");
              if (!seeded && a.structures && !STRUCTURES_RE.test(a.structures))
                throw refuse(
                  "structures must be 'LABEL:name' pairs, comma-separated, e.g. 'A:pararhyme'"
                );
              if (a.blueprint != null && a.subdivision == null)
                throw refuse(
                  '`blueprint` needs `subdivision` — the slot questions refuse rather than assume a grid'
                );
              const writer = a.writer || 'interview';
              // Belt and braces: outside surfaces publish neither field, but a
              // carried record could still name them.
              if (!server.kitchen && (writer === 'kitchen' || checkpoint)) throw kitchenChatOnly();
              if (checkpoint && writer !== 'kitchen')
                throw refuse('`checkpoint` resumes writer kitchen; interview resumes with state');
              if (
                writer === 'kitchen' &&
                (a.state != null || a.answer != null || a.answers != null)
              )
                throw refuse(
                  "writer 'kitchen' takes no `state`, `answer` or `answers` — the server's own writer answers every question; send the draft (or rewrite a parked one with `draft_text`)"
                );
              if (writer === 'kitchen' && !process.env.GEMINI_API_KEY)
                throw refuse(
                  "writer 'kitchen' needs the service's GEMINI_API_KEY and it is unset here — use writer 'interview' and answer the questions yourself"
                );
              const proposeSpec = writer === 'kitchen' ? KITCHEN_PROPOSE : `defer:${statePath}`;
              let args;
              if (seeded) {
                args = [
                  ...globalsFor(a),
                  'finish',
                  draftPath,
                  ...planArgs(a),
                  `--propose=${proposeSpec}`,
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
                args.push(`--propose=${proposeSpec}`);
              }
              // THE CONNECTOR'S BUDGET (M-236): one attempt per line, ONE group
              // rewrite per stuck line (backtrack width 1 — on since M-247, off
              // under M-236), eight rounds. The re-ask inside a round is where a
              // model-driven run spent most of its hops (round 21: 103 answers for
              // four rounds); under one attempt a rejected line is re-briefed
              // fresh next round with its rejection quoted, the batch door asks
              // the round's independent lines together, and the rounds are cheap
              // enough to have more of. Tier 2's backtrack WAS off on this path
              // for the same reason — with one attempt every rejection would open
              // a group rewrite at once — and is on at width 1 since M-247: a
              // line whose every single-word answer the ban refuses (M-246) has
              // no tier-1 move at all, and the one group question a width of 1
              // opens is the budget's own shape. A model that declares its own values
              // keeps them; the carried declarations (M-229) hold whichever
              // applied for the run's whole life, so the budget never moves
              // mid-run.
              const budget = {
                max_rounds: a.max_rounds,
                attempts:
                  a.attempts ?? (writer === 'kitchen' ? KITCHEN_ATTEMPTS : CONNECTOR_ATTEMPTS),
                backtrack: a.backtrack ?? CONNECTOR_BACKTRACK,
              };
              Object.assign(a, budget, { writer });
              if (
                Buffer.byteLength(JSON.stringify(declarationsOf(a)), 'utf8') >
                CONNECTOR_DECLARATION_BYTES
              )
                throw refuse(
                  `DECLARATION_CAPACITY: writer declarations exceed ${CONNECTOR_DECLARATION_BYTES} UTF-8 bytes. Measurement tools still accept their documented payload limits; no writer was started.`
                );
              const encodeInterview = (state) =>
                encodeInterviewWire({
                  ...state,
                  input_draft: a.draft,
                  connector_declarations: declarationsOf(a),
                  connector_semantic_identity: continuationSemanticIdentity(),
                  connector_run_ref: runRef(runId),
                });
              if (budget.max_rounds !== undefined) args.push(`--max-rounds=${budget.max_rounds}`);
              args.push(`--attempts=${budget.attempts}`);
              args.push(`--backtrack=${budget.backtrack}`);
              const execution = requestContext();
              const r = await runVerb(args, {
                checkpointPath,
                context: {
                  ...execution,
                  onCheckpoint: (record) =>
                    execution.onCheckpoint?.({
                      ...record,
                      connector_declarations: declarationsOf(a),
                      connector_semantic_identity: continuationSemanticIdentity(),
                    }),
                },
              });
              // Bind the native replay receipt to both the exact file bytes it
              // consumed and the original signed connector wire supplied here.
              if (checkpointInput) {
                r.checkpoint_input_sha256 = sha256(checkpointInput);
                r.checkpoint_wire_sha256 = sha256(checkpointWire);
              }
              const currentCheckpoint =
                r.checkpoint && Array.isArray(r.checkpoint.accepted_lines)
                  ? {
                      ...r.checkpoint,
                      connector_declarations: declarationsOf(a),
                      connector_semantic_identity: continuationSemanticIdentity(),
                    }
                  : null;
              const uncertainProposal = Boolean(
                currentCheckpoint &&
                (r.uncertain_proposal ||
                  (r.accounting_unknown && currentCheckpoint.status === 'proposing'))
              );
              if (uncertainProposal) currentCheckpoint.uncertain_proposal = true;
              const exactDraft =
                r.lyric_result?.final_draft ||
                currentCheckpoint?.final_draft ||
                currentCheckpoint?.accepted_lines ||
                null;
              if (r.lyric_result?.status === 'journal_capacity') {
                const oversizedProposal = r.lyric_result.code === 'PROVIDER_PROPOSAL_TOO_LARGE';
                const result = {
                  ...verdictOf(r),
                  status: 'journal_capacity',
                  writer,
                  certified: false,
                  resumable: false,
                  new_run_required: true,
                  final_draft: exactDraft,
                  replay_draft: a.draft,
                  meaning:
                    (oversizedProposal
                      ? 'The provider returned a proposal outside the declared response capacity; that proposal was not accepted and its call may have incurred a charge. '
                      : 'The journal reached its declared capacity; no further writer request was started. ') +
                    'All accepted lyrics and the recorded proposal history are preserved below. Keep this recovery artifact and final_draft. This run cannot resume; an identical restart may hit the same limit. Reduce the requested scope explicitly before independent new_run work.',
                };
                if (currentCheckpoint)
                  if (writer === 'interview') result.state = encodeInterview(currentCheckpoint);
                  else result.checkpoint = encodeState(currentCheckpoint);
                let capacityState = writer === 'interview' ? currentCheckpoint : null;
                try {
                  capacityState = JSON.parse(await readFile(statePath, 'utf8'));
                  result.state = encodeInterview(capacityState);
                } catch (error) {
                  if (error.code !== 'ENOENT') throw error;
                }
                // Every verdict this call wrote is published, on every branch
                // that returns a state (LOOP_REDESIGN.md §2.8 D).
                if (writer === 'interview' && capacityState)
                  result.folded = foldedOf(a.state, capacityState);
                const saved = RUNS.put(runKey, {
                  status: 'journal_capacity',
                  draft: exactDraft,
                  replay_draft: a.draft,
                  state: result.state,
                  checkpoint: result.checkpoint,
                  decl: declarationsOf(a),
                  run_id: runId,
                });
                result.run_id = saved.run_id;
                result.run_revision = saved.revision;
                return result;
              }
              if (r.code === 4) {
                // Suspended: the verb wrote the state (question folded in) and
                // printed the brief. NO RENDER EXISTS in this output — the verb's
                // render call sits after the loop's return — so this branch has
                // nothing to leak even if it tried.
                const st = JSON.parse(await readFile(statePath, 'utf8'));
                const suspendedVerdict = verdictOf(r);
                const stateWire = encodeInterview(st);
                const onRecord = st.answered.propose.length + st.answered.propose_group.length;
                const askedNow = askedOf(st.pending);
                const batchNote =
                  askedNow &&
                  askedNow.kind === 'propose_batch' &&
                  Array.isArray(askedNow.lines) &&
                  askedNow.lines.length
                    ? ` BATCH: answer ${askedNow.lines.map((n) => `L${n}`).join(', ')} with \`answers\` — one {line, text} per asked line, every one required, nothing else.`
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
                      state: stateWire,
                      draft: a.draft,
                      replay_draft: a.draft,
                      decl: declarationsOf(a),
                      answers: onRecord,
                      run_id: runId,
                    })
                  : null;
                const answerField =
                  askedNow && askedNow.kind === 'propose_batch'
                    ? '`answers` (one {line, text} per asked line)'
                    : '`answer`';
                const continueNote = runNow
                  ? `\n\nCONTINUE: call lyric_revise with \`run_id\`, \`run_revision\` ${runNow.revision} and ${answerField} — the state and the draft are carried for you (run ${runNow.run_id}); \`state\` passed back verbatim with ${answerField} also works.`
                  : `\n\nCONTINUE: call lyric_revise with \`state\` passed back verbatim and ${answerField}.`;
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
                        writer,
                        ...verificationEvidenceOf(r),
                        ...resumeEvidenceOf(r),
                        kind: st.pending ? st.pending.kind : null,
                        answers_on_record: onRecord,
                        // M-235: the question this call left open, the question its
                        // `answer` folded and what verify made of that answer.
                        asked: askedNow,
                        folded: foldedOf(a.state, st, budget.attempts),
                        run_id: runNow ? runNow.run_id : null,
                        run_revision: runNow?.revision ?? null,
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
                        ...Object.fromEntries(
                          ['memo_state', 'memo_hit', 'memo_asked', 'stale_answers', 'plan_lines', 'cursor_stripped']
                            .filter((key) => suspendedVerdict[key] !== undefined)
                            .map((key) => [key, suspendedVerdict[key]])
                        ),
                        certified: false,
                        state: stateWire,
                        replay_draft: a.draft,
                        final_draft: exactDraft || st.accepted_lines || null,
                      }),
                    },
                  ],
                };
              }
              if (
                r.code === 0 ||
                r.code === 3 ||
                r.lyric_result?.status === 'finished' ||
                currentCheckpoint?.status === 'finished'
              ) {
                const verdict = verdictOf(r);
                verdict.status = loopStatusOf(r.code, verdict);
                verdict.writer = writer;

                verdict.final_draft = exactDraft;
                verdict.replay_draft = a.draft;
                if (currentCheckpoint)
                  if (writer === 'interview') verdict.state = encodeInterview(currentCheckpoint);
                  else verdict.checkpoint = encodeState(currentCheckpoint);
                if (verdict.certified === false && r.code === 2) verdict.status = 'uncertified';
                // M-235: the last answer's verdict and the draft this stop was
                // reached on ride with the stop row, so a cycle is readable from
                // the rows alone.
                verdict.draft_fp = exactDraft ? draftFp(exactDraft) : null;
                verdict.replay_draft_fp = draftFp(a.draft);
                // M-237: exit 3 PARKS the record (no state — no question pending);
                // exit 0 forgets it.
                verdict.run_state_carried = carried.state;
                verdict.run_draft_carried = carried.draft;
                verdict.run_decl_carried = carried.decl;
                if (runKey && r.code !== 0 && exactDraft) {
                  const parkedRec = RUNS.put(runKey, {
                    seed: typeof a.seed === 'number' ? a.seed : null,
                    status: r.code === 2 ? 'uncertified' : 'parked',
                    exit_code: r.code,
                    refused_obligations: verdict.coverage?.refused_obligations || [],
                    draft: exactDraft,
                    replay_draft: a.draft,
                    decl: declarationsOf(a),
                    stop: verdict.loop_stop_reason ?? null,
                    open: Array.isArray(verdict.loop_unresolved_lines)
                      ? verdict.loop_unresolved_lines
                      : [],
                    whole: Array.isArray(verdict.loop_whole_flag_codes)
                      ? verdict.loop_whole_flag_codes
                      : [],
                    standing: Array.isArray(verdict.standing) ? verdict.standing.slice(0, 24) : [],
                    run_id: runId,
                  });
                  verdict.run_id = parkedRec.run_id;
                  verdict.run_revision = parkedRec.revision;
                } else if (runKey && r.code === 0) {
                  if (runRec) RUNS.del(runRec.run_id);
                  verdict.run_id = runRec?.run_id ?? null;
                  verdict.run_revision = runRec?.revision ?? null;
                }
                verdict.song_at_stop = exactDraft ? exactDraft.join('\n') : null;
                try {
                  const st = JSON.parse(await readFile(statePath, 'utf8'));
                  verdict.answers_on_record =
                    st.answered.propose.length + st.answered.propose_group.length;
                  verdict.folded = foldedOf(a.state, st, budget.attempts);
                  // A finished deferred run is a RECORDED run: hand the record
                  // back so the song's provenance travels with the conversation.
                  verdict.state = encodeInterview(st);
                } catch (error) {
                  if (error.code !== 'ENOENT') throw error;
                  /* Kitchen has no deferred state file; its checkpoint carries the journal. */
                }
                const render =
                  typeof r.lyric_result?.presentation_text === 'string'
                    ? r.lyric_result.presentation_text
                    : null;
                if (render) {
                  // M-232: the standing findings ride with the render, so a
                  // parked song names what each open line still carries.
                  const standingText =
                    Array.isArray(verdict.standing) && verdict.standing.length
                      ? '\n\nSTANDING AT THE STOP — what the open lines and the whole draft still carry:\n' +
                        verdict.standing.map((x) => `  ${x}`).join('\n')
                      : '';
                  // Exit 2 outranks 3 in the harness, so an uncertified stop can
                  // still have lines open: it is parked too, and gets the same
                  // next step. An exit 2 with nothing open is uncertified only.
                  const linesOpen =
                    (typeof verdict.loop_unresolved === 'number' && verdict.loop_unresolved > 0) ||
                    (Array.isArray(verdict.loop_whole_flag_codes) &&
                      verdict.loop_whole_flag_codes.length > 0);
                  const rewriteNote = `\n\nCONTINUE: no question is pending. Rewrite the open line(s) and call lyric_revise with \`run_id\`, \`run_revision\`${verdict.run_revision != null ? ` ${verdict.run_revision}` : ''} and \`draft_text\` (the full song as ONE newline-separated string) — no \`answer\`, no \`state\`${verdict.run_id ? ` (run ${verdict.run_id}; \`new_run: true\` starts independently)` : ''}.`;
                  const parkNote =
                    r.code === 3
                      ? rewriteNote
                      : r.code === 2 && linesOpen
                        ? '\n\nNOT FINISHED: this stop left lines open and its coverage uncertified — present it as parked.' +
                          rewriteNote
                        : r.code === 2
                          ? '\n\nNOT CERTIFIED: no line is open, but coverage is incomplete (see `coverage`) — present it as uncertified, not finished. Resolve the unread words with `pronunciations` (lyric_grade lists the options; never guess a reading), grade again, and start a new run with `new_run: true`.'
                          : '';
                  return {
                    content: [
                      { type: 'text', text: render + standingText + parkNote },
                      { type: 'text', text: JSON.stringify(verdict) },
                    ],
                  };
                }
                return verdict;
              }
              const other = verdictOf(r);
              other.writer = writer;

              if (currentCheckpoint) {
                const resumable =
                  r.code !== 2 ||
                  currentCheckpoint.proposals?.length > 0 ||
                  ['proposing', 'proposal_completed', 'accepted'].includes(
                    currentCheckpoint.status
                  );
                other.status = uncertainProposal
                  ? 'uncertain_proposal'
                  : resumable
                    ? 'interrupted'
                    : 'refused';
                if (uncertainProposal) other.uncertain_proposal = true;
                // THE NO-PROGRESS COUNT (§2.8 E). Compared only on a safe-point
                // stop and a killed call; it rides in the sealed state.
                if (writer === 'interview') {
                  delete currentCheckpoint.stalls;
                  if (r.code === 5 || r.timed_out || r.cancelled) {
                    const stalls = stallsOf(a.state, currentCheckpoint);
                    if (stalls > 0) currentCheckpoint.stalls = stalls;
                    if (stalls >= NO_PROGRESS_AT) other.no_progress_calls = stalls;
                  }
                }
                if (writer === 'interview') other.state = encodeInterview(currentCheckpoint);
                else other.checkpoint = encodeState(currentCheckpoint);
                // A call that ends without a question (a kill, or a safe-point
                // stop) still publishes the verdicts it wrote, and every answer
                // it did not reach as pending (LOOP_REDESIGN.md §2.8 D).
                if (writer === 'interview') other.folded = foldedOf(a.state, currentCheckpoint);
                other.final_draft = exactDraft;
                other.replay_draft = a.draft;
                if (resumable) {
                  const saved = RUNS.put(runKey, {
                    seed: a.seed ?? null,
                    status: other.status,
                    checkpoint: other.checkpoint,
                    state: other.state,
                    draft: exactDraft,
                    replay_draft: a.draft,
                    decl: declarationsOf(a),
                    run_id: runId,
                  });
                  other.run_id = saved.run_id;
                  other.run_revision = saved.revision;
                  if (other.no_progress_calls)
                    other.meaning += noProgressNote(other.no_progress_calls, currentCheckpoint);
                  other.meaning += uncertainProposal
                    ? ' The provider request may have completed but no answer was recorded. Automatic continuation is stopped. final_draft preserves accepted edits; replay_draft and checkpoint preserve the evidence. Existing new_run can start independent work from final_draft, with a possible additional provider charge.'
                    : ` Resume explicitly with run_id or ${writer === 'interview' ? 'state' : 'checkpoint'} under the same declarations; completed proposals are in that journal.`;
                }
              }
              return other;
            })
          );
    }
  );

  tool(
    server,
    'lyric_sweep',
    {
      title: 'Find seeds whose shape matches what you want',
      description:
        'Under the same declarations (form, lines, functions, melody) a plan is a function of its seed, so choosing a ' +
        'seed is choosing a shape — and guessing one is how a writer ends up accepting whatever the first seed drew. ' +
        'Declare what you want (predicates over coordinates the plan already discloses) and this plans a WINDOW of ' +
        "consecutive seeds and returns the ones that hold. `want` is a FILTER over each seed's plan as drawn without " +
        "it; lyric_plan's `wants` is a different thing — it conditions the draw. IT DOES NOT RANK: the accepted seeds " +
        'come back in seed order and carry no score, because a floor enforces and does not order the region it ' +
        'already passed, and an argmax over a swept parameter is biased toward whichever end has more freedom. Pick ' +
        'from the list on taste, then call lyric_plan with that seed and the same form, lines, functions and melody; ' +
        "a creation session requires them, and requires this `want` list as lyric_plan's `wants`. FOUR COUNTS, NEVER " +
        'SUMMED: swept, planned, planner_refused and accepted_count (accepted_shown lists the accepted seeds) — ' +
        'planner_refused is the planner turning a request down (an unbuildable roster, an unattainable length) and ' +
        'is NOT a predicate rejecting a shape, so `planned 0` means the DECLARATION is unbuildable and the ' +
        `predicates never ran. The window is bounded at ${MAX_SWEEP_SEEDS} seeds per call and sweeps compose ` +
        'exactly — continue from next_seed_from and add the counts. Selective wants may require more windows. ' +
        EXECUTION_CONTRACT,
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
      if (a.melody !== undefined) args.push(`--melody=${a.melody}`);
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
        'NOT A GRADE — it reports what this change fixed and what it introduced (a banned pair the change creates ' +
        'is in `new`), and says nothing about a defect that survived it untouched, so a banned pair that was ' +
        "already there is not reported. Whether a whole draft is clean is lyric_grade's question (planned) or " +
        "lyric_check's (pasted); a song is finished only at a lyric_revise stop condition. " +
        EXECUTION_CONTRACT,
      inputSchema: LYRIC_TOOL_SCHEMAS.lyric_verify,
    },
    (a) =>
      withTempDir(async (dir) => {
        takeLines(a, 'before', 'before_text');
        takeLines(a, 'after', 'after_text');
        checkLines(a.before);
        checkLines(a.after);
        const hasScheme = a.scheme != null && a.scheme !== '';
        const hasGroups = a.groups != null && a.groups !== '';
        if ((hasScheme && hasGroups) || (!hasScheme && !hasGroups && !a.returns))
          throw refuse(
            "declare one of 'scheme' or 'groups', or a returns-only mandate — a verify with no mandate has nothing to judge the change against"
          );
        if (hasScheme && !SCHEME_RE.test(a.scheme))
          throw refuse("scheme must be letters only, e.g. 'ABAB'");
        if (hasGroups && !MANDATE_RE.test(a.groups))
          throw refuse("groups must be line numbers like '1,3;2,4', optionally naming a place");
        if (a.returns && !RETURNS_RE.test(a.returns))
          throw refuse("returns must be members like '5,13;6,14' or '1.head,3.head'");
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
        if (a.blueprint != null && a.subdivision == null)
          throw refuse('`blueprint` needs `subdivision` — verify must use the declared grid');
        if (a.blueprint != null) {
          try {
            JSON.parse(a.blueprint);
          } catch {
            throw refuse('`blueprint` is not JSON text');
          }
          const blueprintPath = path.join(dir, 'blueprint.json');
          await writeFile(blueprintPath, a.blueprint, 'utf8');
          args.push(`--blueprint=${blueprintPath}`, `--subdivision=${a.subdivision}`);
        }
        if (a.targeted !== undefined) {
          if (!a.targeted.length || a.targeted.some((n) => n > a.before.length))
            throw refuse('targeted must name existing lines and cannot be empty');
          args.push(a.targeted.join(','));
        }
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
        'THE FIRST STEP FOR LYRICS A HUMAN PASTES, before lyric_check: a pasted song goes through every step a ' +
        'planned one does, and the first is to STRUCTURE it. The harness reads the paste as printed: a row that is ' +
        'only a [SECTION] marker declares a section, a blank row is a stanza break (as an empty entry in `lines`, ' +
        'or a blank row in `lines_text`; with neither marks nor breaks the sectioning is refused), and a row the ' +
        "source reader treats as apparatus (beginning '[', '#' or '---') is set aside and listed in `set_aside`. It " +
        'counts the sung lines and the syllables per line and RECOVERS the rhyme web as a cover over places in each ' +
        'line — every coordinate stamped with how it was obtained (counted / declared / derived / REFUSED). The ' +
        'verdict carries `lines`, the sung lines every line number in the cover refers to, and `mandate`, the ' +
        '`groups` and `returns` strings numbered over those lines: hand `lines` with that mandate to lyric_check and ' +
        'lyric_revise, so they grade the lines the mandate names. `refusals` lists each refused coordinate with its ' +
        'reason — a work order, never a guess. The meter is always refused (counting gives syllables, not a bar ' +
        'grid — declare one with a blueprint), so exit 3 is the ordinary result; a REPEAT edge that binds at a ' +
        'placement is refused with the reason the cover does not spell it — declare the placed returns you mean in ' +
        "`returns` ('1.head,3.head'). Derived coordinates are NOT independent of the grader: a recovered web graded " +
        'at the same cut cannot fail on rhyme, and the report says so. `placements` narrows the cover: the default ' +
        "placement set's cover grows with the square of the line count and grading it can take much of the shared " +
        "deadline, so `placements: 'end'` is the practical cover for anything longer than a few lines. " +
        EXECUTION_CONTRACT,
      inputSchema: LYRIC_TOOL_SCHEMAS.lyric_recover,
    },
    (a) =>
      withTempDir(async (dir) => {
        takeLines(a, 'lines', 'lines_text', { preserveStructure: true });
        checkLines(a.lines);
        if (a.placements != null && !/^[A-Za-z0-9]+(,[A-Za-z0-9]+)*$/.test(a.placements))
          throw refuse("placements must be names like 'end,head,T4', comma-separated");
        const draftPath = path.join(dir, 'draft.txt');
        await writeFile(draftPath, a.lines.join('\n') + '\n', 'utf8');
        // THE PASTE IS READ AS SOURCE: its [SECTION] rows are structure, not
        // sung lines, and every line number the cover spells counts the sung
        // lines only. The harness's default reading is literal (every nonblank
        // row a line), under which the markers were counted as lines and the
        // mandate handed to check/revise named the wrong lines.
        const args = [...globalsFor(a), '--input-format=source', 'recover', draftPath];
        if (a.placements) args.push(`--placements=${a.placements}`);
        const r = await runVerb(args);
        const v = verdictOf(r);
        // Everything below is the verb's authenticated record, never the
        // report's prose: the sung lines, what was set aside, the mandate and
        // each refusal with its reason.
        const rec = r.lyric_result?.status === 'recovered' ? r.lyric_result : null;
        if (rec && (r.code === 0 || r.code === 3)) {
          v.meaning =
            r.code === 0
              ? 'recovered — every coordinate obtained; none refused. Hand `lines` with `mandate` to lyric_check and lyric_revise.'
              : 'recovered with REFUSALS — each coordinate under `refusals` carries its reason and must be DECLARED by the caller before the graders can ask about it (the meter always: counting gives syllables, not a grid). Hand `lines` with `mandate` to lyric_check and lyric_revise.';
          v.lines = rec.lines;
          v.set_aside = rec.set_aside;
          v.sections = rec.sections;
          v.mandate = rec.mandate;
          v.refusals = rec.refusals;
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
        'and get the same rhyme grading and slop floor the full pipeline runs. After lyric_recover, pass its `lines` ' +
        'with its mandate, so the line numbers name the same lines. A declaration is REQUIRED: nothing declared means ' +
        'nothing mandated, and "nothing flagged" about that would be a vacuous pass. FLAGS are defects with line ' +
        'numbers; banned_pairs counts declared pairs on the two-tier ban (HOMEOTELEUTON / MODAL_RHYME), reported as ' +
        'notes, and banned[] names each pair by its lines and, in binding, the bound word and its place on ' +
        'each line — rewrite that word; other NOTES are measurements. THE EXIT CODE IS NOT THE VERDICT: this verb ' +
        'exits 0 whenever it answers, with flags standing or coverage incomplete. Read `flags` and `whole_flags` for ' +
        'what stands, `certified` and `coverage` for whether every declared pair and requested layer was judged ' +
        '(coverage.refused_obligations names what was not), and `unreadable` (a count) with `unreadable_findings` ' +
        '(the findings) for what the lexicon could not read. ' +
        EXECUTION_CONTRACT,
      inputSchema: LYRIC_TOOL_SCHEMAS.lyric_check,
    },
    (a) =>
      withTempDir(async (dir) => {
        takeLines(a, 'lines', 'lines_text');
        checkLines(a.lines);
        const hasScheme = a.scheme != null && a.scheme !== '';
        const hasGroups = a.groups != null && a.groups !== '';
        if ((hasScheme && hasGroups) || (!hasScheme && !hasGroups && !a.returns))
          throw refuse(
            "declare one of 'scheme' or 'groups', or a returns-only mandate — the mandate is a choice, not a default"
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
          throw refuse("returns must be members like '5,13;6,14' or '1.head,3.head'");
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
              'catalog row or world alias (an unknown name is refused with the catalog listed)'
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
        'EVERY traditional name the pair satisfies at the declared `position` (default end: two line-final words; ' +
        'names are judged at their own coordinate there, and a pair has many), every relation it answers side by ' +
        'side, and — in English — every coarse relation and registry schema the two words stand in as line ends. ' +
        'Taxonomy, not judgement — for bans use lyric_screen. ' +
        EXECUTION_CONTRACT,
      inputSchema: LYRIC_TOOL_SCHEMAS.lyric_types,
    },
    async (a) => {
      checkWords([a.word_a, a.word_b]);
      // The position completes the coordinate; without one the harness names
      // nothing, because most names are defined at a place in the line.
      // Its own queue: see `lookupBridge`.
      const r = await lookupBridge.runVerb([
        'types',
        a.word_a,
        '--',
        a.word_b,
        `--position=${a.position || 'end'}`,
      ]);
      return verdictOf(r);
    }
  );
}

//: The paragraph buildServer appends to the server instructions — the same
//: text the Gemini chat receives as its system prompt (buildSurface reads
//: the live instructions), so the two surfaces stay one description.
export function lyricInstructions({ kitchen = false } = {}) {
  return (
    ' BESIDE THE RECIPES, AND NEVER TOUCHING THEM, the lyric_* family is a songwriting ' +
    'system. The program plans and grades; ' +
    (kitchen
      ? "on this chat surface the service's own writer answers the revise loop's questions. "
      : 'you write every line — the service never writes lyrics for an outside caller. ') +
    'A pair stands in EVERY relation its sound supports (a perfect rhyme is also assonance, and consonance when ' +
    'it closes on a consonant; rime riche is also rhyme): the default judges every pair against every coarse ' +
    'relation and every registry schema, and a group is satisfied when the words it binds stand in at least ' +
    'one (another word in the line relating does not count); planning ' +
    'draws none. Full figures and refused obligations remain explicit. The working order that produces ' +
    'one-draft songs: (0) lyric_sweep to CHOOSE the seed rather than guess it — declare what you want the shape ' +
    'to be (`want`, a filter) and it returns the seeds that hold, in seed order, unranked; (1) lyric_screen ' +
    'candidate end-word pairs BEFORE writing — a banned pair (HOMEOTELEUTON/MODAL_RHYME) is an answer, pick ' +
    "different words; (2) lyric_plan with an accepted seed and the sweep's form, lines, functions and melody " +
    '(and its `want` list as `wants`, which conditions the draw) for a complete shape (sections, meter — often ' +
    'not 4/4, rhyme plan, hook slot) and write to its brief, honoring the verbatim returns — declare the `title` ' +
    'here if the song has one, because an undeclared title leaves "is the title in the hook?" REFUSED and a ' +
    'declared one that is not a run of words inside the hook line is a FLAG; (3) lyric_grade with the SAME seed ' +
    `AND THE SAME PLAN DECLARATIONS (${PLAN_DECLARATIONS} — without a session, a declaration dropped here grades a different plan; a session restores the ones its plan recorded) ` +
    `and the draft, under the reading declarations (${READING_DECLARATIONS}) — its render is the INTERIM graded ` +
    'draft, and the [GRADED — seed …] stamp under it is a grade, not a finish; (4) lyric_revise with the SAME ' +
    'seed and declarations — it drives the revise loop and returns a song ONLY past a stop condition, under a ' +
    '[FINISHED — seed … — exit …] stamp, ' +
    (kitchen
      ? "the service's writer answering every question, so ONE call returns the stop condition. "
      : 'the loop asks one question per suspended call and you answer it (`answer`, or `answers` for a batch or group), called repeatedly until it stops. ') +
    'THE FINISHED SONG COMES FROM lyric_revise AND NOWHERE ELSE, and only at exit 0 with certified coverage: ' +
    'a song presented without its [FINISHED …] stamp is an interim draft and must be presented as one, a stop ' +
    'at exit 2 or 3 is parked or uncertified (its note says what to do next), and stopping at step (3) ' +
    'because the draft "looks done" is the exact hand-wash the loop exists to end — the loop, not you, ' +
    'says when revision is over. Banned pairs (banned_pairs, banned[]) are reported as notes: they hold no ' +
    'line open and do not stop a song from finishing. ' +
    'PRESENTATION IS PART OF THE CONTRACT: the first text block of a lyric_grade result, and of a lyric_revise ' +
    'result at a stop condition, is the song under its bracket headers and stamp — reproduce the song and its ' +
    'stamp character for character, exactly as you reproduce a recipe string; the bracket headers ([CHORUS — 3 ' +
    'lines — 6 bars of 6/8, half-beat pickup]) are measurements, restyling them to bare [CHORUS] deletes what the ' +
    "format exists to carry, and the stamp line under the song reaches the user with it. lyric_plan's first block " +
    'is its plan report and brief: keep its bracket header rows exactly as written when you show the shape. For ' +
    'lyrics a user pastes, the SAME steps as a planned song: lyric_recover FIRST to structure them (blank stanza ' +
    "breaks as empty entries, [SECTION] rows as they are; `placements: 'end'` for anything longer than a few " +
    'lines) — it hands back the sung `lines`, the `mandate` (groups/returns) numbered over them, and the ' +
    'coordinates it REFUSED with their reasons (the meter, always) for the user to declare — then lyric_check ' +
    'with those lines and that mandate (and a declared blueprint + subdivision when the user gives the grid), ' +
    'then lyric_revise WITHOUT a seed, with the same lines and mandate, to drive the loop to a stop condition; a ' +
    'bare lyric_check on a paste is the rhyme and floor layers only, and its verdict says so. lyric_verify ' +
    'judges a CHANGE to one, which is the other half of a revision round: read its `accepted`, not its exit ' +
    'code, and remember it is a DIFF that cannot report banned pairs surviving untouched. FLAGS are defects; ' +
    'banned pairs and other NOTES are measurements and are not to be ' +
    '"fixed". A verdict carrying structures_uncalibrated is the third thing to read: correctness IS graded for ' +
    'that declared structure and laziness is NOT; the two-tier ban is not asked of pairs judged under a declared ' +
    'structure — ban_not_asked lists them, and banned_pairs is null when no pair was asked. For unresolved ' +
    'pronunciation, read pronunciation_options from grade/check (it lists the lines a refused obligation names; ' +
    'total counts every ambiguous word), select the intended dictionary reading or ' +
    'supply ARPABET with an honest source in pronunciations, then regrade. Choices bind exact line text and ' +
    'token position, including every verbatim chorus return. Never choose phones just to pass a check. A ' +
    'revision can remove an original occurrence; its reading is retained as retired and never applied to ' +
    'changed text. New text is graded independently. Supplying new readings during revision requires regrading ' +
    'and a new run. Recipes describe the SOUND, lyric tools govern the WORDS; the conversation is the only place ' +
    'they meet.'
  );
}
