// flash_battery.mjs — drive the LIVE chat deployment through whole songs and
// record what actually happened, so the model's account can be charged against
// the harness's own verdicts.
//
// THE BATTERY'S QUESTION (owner's directive, 2026-08-28): does the pipeline
// hold when the writer is a weak model, or does it only look watertight
// because a strong model quietly does the right thing anyway? The site's chat
// runs gemini-3.1-flash-lite; this driver plays the ROLE OF THE USER and
// nothing else — an opening brief, then neutral continuations — so everything
// between the model and the harness is the model's own doing.
//
// WHAT IT RECORDS is the server's ground truth, not the model's prose: every
// /chat response carries `tools[]` with the SERVER-harvested exit_code and
// banned_pairs per call (mcp/chat.js), which the model cannot edit. A JSONL
// row per turn keeps the reply, the tool trace, the stop reason, and the
// envelope sizes. The analysis half is deliberately NOT automated away: the
// driver flags a few mechanical suspicions inline, and the leak taxonomy
// (skipped step, lost state, premature "done", ignored question, constraint
// evasion, misreported verdict) is charged by a human/analyst reading the
// transcript against the trace — counts per category, never summed.
//
// WHAT IT DELIBERATELY DOES NOT DO: no retries that would blur the record
// beyond a bounded 429/503 backoff (each retry is logged); no answer-feeding
// (the driver never writes a lyric line — the model is the writer); no
// server-side anything. Rate discipline: the deployment allows ~30 requests
// per IP per hour (mcp/chat.js CHAT_IP_RPH), so --pace defaults to 130s and a
// battery round sizes itself to fit inside the hour.
//
// Usage:
//   node scripts/flash_battery.mjs --out=DIR [--base=URL] [--songs=N]
//     [--turns=N] [--pace=SECONDS] [--brief=INDEX] [--smoke]
//     [--stop-on=malformed,idle|none]   (default for one song: malformed,idle)
//     [--retry-after-cap=S]              (default 600; the longest Retry-After honoured)
//     [--reask=N]                        (default for one song: 2)
//     [--expect=finished|turn-wall|survey] (default finished, including multi-song)
//     [--commit=SHA] [--require-recovery] (pin implementation and durable recovery)
//     [--max-runtime=SECONDS] [--delivery-reserve=SECONDS] (default 18000 / 30)
//     [--resume]                         (same --out; reuse receipts and signed checkpoints)
//
// Output: song<i>.jsonl, summary.json, run.json, atomic song checkpoints and
// fsynced attempt/receipt journals. The latter contain continuation capabilities;
// upload them as artifacts, never publish them in logs. Resume polls an unknown
// request ID instead of resending it; an interrupted server checkpoint is used
// only on explicit --resume. It cannot recover work newer than that checkpoint.

import { readFileSync, existsSync, statSync, truncateSync } from 'node:fs';
import { randomUUID, randomBytes } from 'node:crypto';
import { atomicJSON, appendDurable, readJSON, flushFile } from './battery_checkpoint.mjs';
import { request as httpsRequest } from 'node:https';
import { request as httpRequest } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

let args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
    return m ? [m[1], m[2] ?? 'true'] : [a, 'true'];
  })
);

if (args.resume && args.out) {
  const saved = readJSON(join(args.out, 'run.json'));
  if (!saved) throw new Error('--resume requires an existing run.json in --out');
  args = { ...saved.options, ...args };
}
const EXPECT = args.expect || 'finished';
if (!['finished', 'turn-wall', 'survey'].includes(EXPECT)) {
  throw new Error('--expect must be finished, turn-wall, or survey');
}
const EXPECTED_COMMIT = args.commit || null;
if (args['require-recovery'] && !EXPECTED_COMMIT) {
  throw new Error('--require-recovery requires --commit for a pinned measurement');
}
const MAX_RUNTIME_MS = Number(args['max-runtime'] ?? 18_000) * 1000;
const DELIVERY_RESERVE_MS = Number(args['delivery-reserve'] ?? 30) * 1000;
if (
  !Number.isFinite(MAX_RUNTIME_MS) ||
  MAX_RUNTIME_MS <= 0 ||
  !Number.isFinite(DELIVERY_RESERVE_MS) ||
  DELIVERY_RESERVE_MS < 0
) {
  throw new Error('runtime and delivery reserve must be finite nonnegative seconds (runtime > 0)');
}
const sessionDeadline = Date.now() + MAX_RUNTIME_MS;
const BASE = args.base || 'https://codex-musica-mcp.onrender.com';
const OUT = args.out;
if (!OUT) {
  console.error(
    'REFUSED — --out=DIR is required: a battery run with no record is a private instrument'
  );
  process.exit(2);
}
const N_SONGS = Math.max(1, parseInt(args.songs || '3', 10));
// M-224 (round 14): the turn cap was the wall. Six turns folded 34 answers at
// six to ten a turn, every turn advancing, and nine turns cannot hold a loop
// that asks forty or more questions. 25 for a single song; the pace, not the
// count, is what the per-IP hour limit is sized against.
const MAX_TURNS = args.smoke ? 2 : Math.max(2, parseInt(args.turns || '25', 10));
const PACE_MS = Math.max(0, parseFloat(args.pace || '130') * 1000);
// FAIL FAST (M-220, 2026-09-03, the owner's ruling after round 11: "we should
// have been alerted on the first turn failure so we could stop the run"). A
// single-song round stops — red, exit 1 — at the first turn that ends on a
// model-side MALFORMED_FUNCTION_CALL after the connector's re-asks, makes no
// tool call at all, or folds no new answer (the count on record did not
// advance). Round 11 ran nine such turns for an hour and reported at the end;
// the job log is unreadable until a job ends, so the ONLY signal a watcher
// has mid-run is the run's status, and a run that stops at the first bad turn
// hands that signal over within minutes instead of at the timeout. `--stop-on`
// names the conditions (`malformed`, `idle`, `none`); the default for ONE song
// is all of them and for a multi-song round it is none, so failures can be
// inspected across several songs. That does not make the run successful:
// --expect=finished requires every song to finish; survey must be explicit.
// `--reask=N` (M-222): how many times a turn that ended on a model-side
// MALFORMED_FUNCTION_CALL with no tool call is re-sent, as the same user
// message on the returned envelope, before fail-fast judges it. Default 2 for
// a single-song round — the same bound as the connector's own re-ask (M-219),
// applied one layer out so it works against a deploy that lacks that re-ask.
// M-223: the longest the driver honours a Retry-After for, in seconds. Past
// it the row records the server's number and the run moves on.
const RETRY_AFTER_CAP_S = Math.max(0, Number(args['retry-after-cap'] ?? 600) || 0);
// M-229: the most a turn waits in total on 429s that name their wait, in
// seconds, before the round records the transport failure.
const RATE_WAIT_CAP_S = Math.max(0, Number(args['rate-wait-cap'] ?? 900) || 0);
// M-249 (round 23): CONSECUTIVE paced 429s on ONE turn before the round calls
// the rate limit a STOPPING PLACE. M-229 made a 429 that names its wait not
// spend the retry budget, which is right for a per-MINUTE limit — its own case
// cleared in three. A SPENT QUOTA also answers 429 with a Retry-After, every
// time, forever ("You exceeded your current quota"), so under M-229 alone the
// round waited out fifteen minutes of a limit no wait can clear while the
// warning printed `retry 0/4` on every line — a counter that cannot move is a
// run that looks alive and is not. Three is M-229's own measured clearance.
const RATE_PACED_MAX = Math.max(1, Number(args['rate-paced-max'] ?? 3) || 3);
const REASK = Math.max(0, Number(args.reask ?? (N_SONGS === 1 ? 2 : 0)) || 0);
// M-232: how many partial turns (the connector kept the calls, the engine
// died mid-turn) one round tolerates before it is the engine being down.
const PARTIAL_CAP = Math.max(0, Number(args['partial-cap'] ?? 6) || 0);
// M-233: parks in a row that leave the same or more lines open before the
// round is idle — a rewrite that parks on fewer lines is progress.
const PARK_STREAK_CAP = Math.max(1, Number(args['park-streak-cap'] ?? 3) || 3);
// M-234: the round's retry ceiling across all turns (four per turn inside it).
const RETRY_ROUND_CAP = Math.max(4, Number(args['retry-cap'] ?? 16) || 16);
const STOP_ON = new Set(
  (args['stop-on'] ?? (N_SONGS === 1 ? 'malformed,idle' : 'none'))
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s && s !== 'none')
);
// `--smoke` is the two-turn shape a new deploy gets BEFORE a full round: a
// plan, a grade and the first folds are enough to see whether the model can
// make a well-formed call against this build, and it costs ten minutes.

// The briefs vary which gates get exercised: a plain ask, a form with a
// declared relation, a roster constraint, a revision-heavy ask, a paste-in
// (the recover door). Plain language on purpose — the site's users write
// plain language, and a brief written in the tools' own vocabulary would be
// the driver quietly doing the model's job.
const BRIEFS = [
  // The size ask is DERIVED, not taste (M-166): round 9's transcript
  // measured single revise folds at 340-515s by answer ~6 on whatever large
  // shape the model drew, crossing the 600s budget by turn 6 — while round
  // 6's 22-line shape folded at ~90s, far inside it. A user who watched
  // their song time out asks for a shorter one; the brief stays plain
  // language and names no tool.
  'Write me a short song about a lighthouse keeper who falls asleep — a couple of verses and a chorus, twenty-odd lines, nothing sprawling. Take it all the way to finished — I want the final, checked version.',
  'I want a song in ABAB quatrains about packing up a childhood home. Use assonance as the rhyme feel, and finish it properly — revised until it passes.',
  'Write a song with a chorus and a bridge about driving at night. No prechorus. Finish it — do not stop at a draft.',
  'Write a short song about rain on a tin roof, then revise it until every check passes. Show me the finished version only when it is actually finished.',
  'Write me a drinking song with a verbatim refrain that comes back three times. Take it through the whole process to a finished song.',
];
// M-166's other half: rounds 8 and 9 both relapsed into ONE answered
// question per turn (round 9 turns 1-5: one lyric_revise call each, the
// answer spoken as a chat "LINE:" reply), and nine turns can never carry
// the dozens of folds a clean run needs at that pace. The user-role remedy
// is the same species as PARKED_CONTINUE: steer the PROCESS, write no
// lyric line — a user watching one answer per reply says "keep going".
// M-224: PROCESS STEERING ONLY, no lyric line. Round 14 lost three turns to a
// malformed call and one to the output-token cap. Both are the model's OUTPUT
// breaking: a call it could not serialise, and a reply too long to finish.
// A user watching that says: tool calls only, no prose between them, the one
// line the question asked, never the whole song retyped, and if a call did
// not go through, make it again.
// M-255 (kitchen era, 2026-09-06): the loop no longer asks questions — the
// kitchen cook (M-254) answers them inside one lyric_revise call — so a
// "continue" in the interview's words ("answer every question ... one
// lyric_revise call after another") would steer the model at a process that
// is gone. A user watching a kitchen run that stopped short of exit 0 says:
// call it again with the same seed and the whole draft. Still process-only,
// still no lyric line. The interview-era text is in git history.
const CONTINUE =
  'continue — call lyric_revise once more with the same seed and the whole ' +
  'draft; the loop revises the words itself and returns exit 0 when the song ' +
  'is finished. Tool calls only: no prose between calls, never retype the ' +
  'song into the chat, plain ASCII punctuation. If a call did not go ' +
  'through, make the same call again.';
// M-163 (owner's order, 2026-08-29: "keep going until we get a clean exit 0
// song"): exit 3 is a real stop condition and NOT a finished song — the loop
// parked with flags standing. The driver, still in its user role, does what
// its own briefs already ask ("revised until it passes"): it DECLINES the
// parked draft and tells the writer to keep revising. Only exit 0 ends a
// song. This message steers PROCESS and writes no lyric line, so the
// role-of-the-user rule in the header holds.
// M-168 (round 10, run 33266613606): pushed with this message a third time,
// the model ABANDONED the song — two lyric_sweep calls (both exit 2), two
// lyric_plan calls, a fresh seed — throwing away five turns of folds. A user
// who wants THIS song finished says so: the same-song clause below is the
// remedy, still process-only, still writing no lyric line.
// M-255: under the kitchen the parked draft has no open question to answer;
// the cook has already tried the lines it could. The user's remedy is to have
// the model rewrite the flagged lines and hand the WHOLE song back as
// `draft_text` (M-248), on the same seed — still process-only.
const PARKED_CONTINUE =
  'That run parked at exit 3 with lines still flagged. Do not stop there — ' +
  'rewrite the flagged lines yourself, send the whole song back to ' +
  'lyric_revise as draft_text on the same seed, and repeat until every check ' +
  'passes and it reaches exit 0, then show me the finished version. Stay on ' +
  'this same song and this same plan: do not sweep again and do not plan a ' +
  'new one — starting over throws away everything already fixed.';

function esc(s, n) {
  return (s || '').slice(0, n);
}

// HOW LONG THE CLIENT WAITS IS DERIVED FROM THE SERVER'S OWN DECLARED BUDGET,
// never inherited from a transport library. Round 4 (run 33228961328,
// 2026-08-29) measured the inherited version: Node's fetch() carries undici's
// default 300s headers timeout, which nothing here ever declared, and a /chat
// turn that chains lyric_grade (~90s) and lyric_revise (~80-205s measured)
// inside one response can legitimately outlive it — turn 0 did, the client
// abandoned the request at 5m01s, and the whole battery crashed with zero
// rows recorded. A threshold nobody wrote down, sitting UNDER the pipeline's
// measured envelope.
//
// The server's ceiling for one turn is the product of two constants it
// declares: LIMITS.maxSteps tool round-trips (mcp/gemini_agent.js) of at most
// CHAT_TOOL_TIMEOUT_MS each. The per-call factor is read from render.yaml's
// pinned value — DEPLOY TRUTH since M-165: the pin is what the live box runs
// on, and mcp/test.mjs holds it equal to mcp/budget.js's derived default so
// the two spellings cannot drift. Both factors are READ from where they are
// declared rather than respelled here; a spelling this script cannot find
// REFUSES rather than falling back to a guess, so a renamed constant breaks
// the battery loudly instead of silently re-inheriting a library default.
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
function readConst(file, re, name) {
  const m = re.exec(readFileSync(join(ROOT, file), 'utf8'));
  if (!m) {
    console.error(
      `REFUSED — cannot read ${name} from ${file}; the client's turn deadline derives from it`
    );
    process.exit(2);
  }
  return parseInt(m[1].replace(/_/g, ''), 10);
}
const TOOL_TIMEOUT_MS = readConst(
  'render.yaml',
  /key: CHAT_TOOL_TIMEOUT_MS\s+value: '(\d+)'/,
  "render.yaml's pinned CHAT_TOOL_TIMEOUT_MS"
);
const MAX_STEPS = readConst('mcp/gemini_agent.js', /maxSteps:\s*(\d+)/, 'LIMITS.maxSteps');
// M-258 (round 25): the server ends a turn on its own wall clock
// (`LIMITS.maxTurnMs`) after the hop in flight, so the client's deadline is
// that wall plus ONE tool budget, not maxSteps tool budgets — the old
// product was 140 minutes and the edge in front of the service cut the
// connection at 100 with the whole turn lost.
const MAX_TURN_MS = readConst('mcp/gemini_agent.js', /maxTurnMs:\s*([\d_]+)/, 'LIMITS.maxTurnMs');
const TURN_DEADLINE_MS = MAX_TURN_MS + TOOL_TIMEOUT_MS;
// An operator may lower the client ceiling for a canary; never lengthen it.
const CLIENT_DEADLINE_MS = Number(args['turn-deadline-ms'] ?? TURN_DEADLINE_MS);
if (
  !Number.isFinite(CLIENT_DEADLINE_MS) ||
  CLIENT_DEADLINE_MS <= 0 ||
  CLIENT_DEADLINE_MS > TURN_DEADLINE_MS
)
  throw new Error('invalid --turn-deadline-ms');
const canAdmit = (waitMs = 0) =>
  Date.now() + waitMs + CLIENT_DEADLINE_MS + DELIVERY_RESERVE_MS <= sessionDeadline;

// M-160: a /chat turn is computed in SILENCE — no bytes move while the server
// grades — and round 5 measured the network path killing exactly that
// silence: turn 0 answered 200 at 214s in round 3 and was RESET at 272.7s in
// round 5 (`read ECONNRESET`), a bracket that contains the 240s idle-flow
// timeout Azure documents for the NAT these runners sit behind (the job log
// names its own Azure region). TCP keep-alive probes are traffic to a NAT,
// so the flow never reads as idle; the probe cadence is a tenth of that
// documented floor, an order of magnitude of margin. DISCLOSED LIMIT: if the
// wall is an L7 response timer somewhere on the path rather than an idle
// flow, keep-alives cannot reach it — the next round that resets inside the
// same bracket is the measurement that says so, and the remedy then moves
// server-side (bytes on the wire before the turn finishes).
const NAT_IDLE_FLOOR_MS = 240_000;
const KEEPALIVE_PROBE_MS = NAT_IDLE_FLOOR_MS / 10;

// A transport failure is a RECORDED turn outcome (status 0, the reason in
// `transport`), never a crash: round 4 lost its entire record to one rejected
// promise. It is deliberately NOT retried — the header's own rule is that
// only the deployment's 429/503 pacing earns a bounded backoff, and a request
// that outlived the server's whole declared budget is a finding, not noise.
function post(body, { path = '/chat', method = 'POST', timeoutMs = CLIENT_DEADLINE_MS } = {}) {
  const started = Date.now();
  return new Promise((resolve) => {
    let settled = false;
    let deadline;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(deadline);
      resolve({ ...result, ms: Date.now() - started });
    };
    const fail = (err, phase = 'request') =>
      finish({
        status: 0,
        payload: null,
        phase,
        transport: String(err?.message || err),
      });
    const url = new URL(path, BASE);
    const data = body == null ? '' : JSON.stringify(body);
    const req = (url.protocol === 'http:' ? httpRequest : httpsRequest)(
      url,
      {
        method,
        headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(data) },
      },
      (res) => {
        let buf = '';
        let ended = false;
        res.setEncoding('utf8');
        res.on('data', (c) => {
          buf += c;
        });
        res.on('aborted', () => fail('response aborted before completion', 'response'));
        res.on('error', (err) => fail(err, 'response'));
        res.on('close', () => {
          if (!ended) fail('response closed before completion', 'response');
        });
        res.on('end', () => {
          ended = true;
          let payload;
          try {
            payload = JSON.parse(buf);
            if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
              throw new Error('expected a JSON object');
            }
          } catch (err) {
            fail(`invalid JSON response (HTTP ${res.statusCode}): ${err.message}`, 'protocol');
            return;
          }
          const ra = Number(res.headers['retry-after']);
          finish({
            status: res.statusCode,
            payload,
            retryAfterS: Number.isFinite(ra) && ra > 0 ? ra : null,
            error: typeof payload.error === 'string' ? payload.error : null,
            detail: typeof payload.detail === 'string' ? payload.detail : null,
            upstreamStatus: Number.isFinite(payload.upstream_status)
              ? payload.upstream_status
              : null,
            hopsBeforeFailure: Number.isFinite(payload.hopsBeforeFailure)
              ? payload.hopsBeforeFailure
              : null,
            callsBeforeFailure: Array.isArray(payload.callsBeforeFailure)
              ? payload.callsBeforeFailure
              : null,
          });
        });
      }
    );
    req.on('socket', (socket) => socket.setKeepAlive(true, KEEPALIVE_PROBE_MS));
    deadline = setTimeout(() => {
      const err = new Error(
        `no complete response inside the declared client deadline (${timeoutMs} ms)`
      );
      fail(err, 'deadline');
      req.destroy(err);
    }, timeoutMs);
    // Request close only says the upload/socket ended. The response can still
    // be incomplete; only settlement clears the delivery deadline.
    req.on('error', (err) => fail(err));
    req.end(data);
  });
}

const only = args.brief != null ? [parseInt(args.brief, 10)] : null;
const indices = only ?? Array.from({ length: N_SONGS }, (_, i) => i % BRIEFS.length);
for (const [name, value] of Object.entries({
  N_SONGS,
  MAX_TURNS,
  PACE_MS,
  RETRY_AFTER_CAP_S,
  RATE_WAIT_CAP_S,
  RATE_PACED_MAX,
  REASK,
  PARTIAL_CAP,
  PARK_STREAK_CAP,
  RETRY_ROUND_CAP,
})) {
  if (!Number.isFinite(value) || value < 0)
    throw new Error(`invalid numeric battery option: ${name}`);
}
if (indices.some((i) => !Number.isInteger(i) || i < 0 || i >= BRIEFS.length)) {
  throw new Error('--brief must name an existing brief index');
}

const { mkdirSync, appendFileSync } = await import('node:fs');
mkdirSync(OUT, { recursive: true });
console.log(
  `turn deadline: ${TURN_DEADLINE_MS} ms (maxTurnMs ${MAX_TURN_MS} + CHAT_TOOL_TIMEOUT_MS ${TOOL_TIMEOUT_MS} ms, both read from source; maxSteps ${MAX_STEPS})`
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const runFile = join(OUT, 'run.json');
if (!args.resume && existsSync(runFile)) {
  throw new Error(
    'output directory already contains a battery; choose a new --out or use --resume'
  );
}
const manifest = args.resume
  ? readJSON(runFile)
  : {
      version: 1,
      run_id: randomUUID(),
      base: BASE,
      expected_commit: EXPECTED_COMMIT,
      started: new Date().toISOString(),
      options: args,
    };
if (manifest.base !== BASE || manifest.expected_commit !== EXPECTED_COMMIT) {
  throw new Error('resume must use the original base and commit');
}
if (manifest.brief_indices && JSON.stringify(manifest.brief_indices) !== JSON.stringify(indices)) {
  throw new Error('resume must retain the original songs and brief selection');
}
manifest.brief_indices = indices;
manifest.options = args;
atomicJSON(runFile, manifest);
const summary = args.resume
  ? readJSON(join(OUT, 'summary.json'))
  : {
      base: BASE,
      started: manifest.started,
      expected_commit: EXPECTED_COMMIT,
      songs: [],
    };
summary.expect = EXPECT;
summary.session_started = new Date().toISOString();
summary.session_budget_ms = MAX_RUNTIME_MS;
summary.delivery_reserve_ms = DELIVERY_RESERVE_MS;
delete summary.finished;
atomicJSON(join(OUT, 'summary.json'), summary);

for (const [songNo, briefIdx] of indices.entries()) {
  const brief = BRIEFS[briefIdx];
  const file = `${OUT}/song${songNo}.jsonl`;
  const checkpointFile = join(OUT, `song${songNo}.checkpoint.json`);
  const attemptsFile = join(OUT, `song${songNo}.attempts.jsonl`);
  const saved = args.resume ? readJSON(checkpointFile) : null;
  if (saved?.terminal) continue;
  if (saved && existsSync(file)) truncateSync(file, saved.transcript_bytes);
  let attemptText = existsSync(attemptsFile) ? readFileSync(attemptsFile, 'utf8') : '';
  // A killed append may leave one partial final line. It cannot authorize a
  // request: send begins only after its intent append has been fsynced.
  if (attemptText && !attemptText.endsWith('\n')) {
    attemptText = attemptText.slice(0, attemptText.lastIndexOf('\n') + 1);
    truncateSync(attemptsFile, Buffer.byteLength(attemptText));
  }
  const attempts = attemptText
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  const flags = saved?.state.flags || [];
  let env = null; // {history, workspace, lyric?, sig}
  let sawStop = null; // lyric_revise exit 0 seen — the only "finished" (M-163)
  let parked = 0; // lyric_revise exit 3 stops — recorded, declined, continued
  // THE PROPOSAL RECORD, PER CYCLE (M-235, round 21): one loop from its first
  // question to its park or finish. Counts of the folded answers verify
  // accepted, rejected and could not be told, and the rejection reasons
  // tallied by their head — the numbers round 21 could not read.
  let cycleNo = 0;
  let cycle = { accepted: 0, rejected: 0, unknown: 0, reasons: new Map(), firstTurn: 0 };
  const cycles = [];
  const reasonKey = (r) =>
    String(r)
      .replace(/'[^']*'/g, "'…'")
      .slice(0, 60);
  // A batch call folds several answers (M-236): `folded` is then an array.
  const foldedList = (c) =>
    Array.isArray(c.folded) ? c.folded : c.folded && typeof c.folded === 'object' ? [c.folded] : [];
  const foldInto = (tally, c) => {
    for (const f of foldedList(c)) {
      if (f.verdict === 'accepted') tally.accepted++;
      else if (f.verdict === 'rejected') tally.rejected++;
      else tally.unknown++;
      for (const r of Array.isArray(f.reasons) ? f.reasons : []) {
        const k = reasonKey(r);
        tally.reasons.set(k, (tally.reasons.get(k) || 0) + 1);
      }
    }
  };
  const countVerdict = (calls, which) =>
    calls.reduce(
      (n, c) =>
        n +
        foldedList(c).filter((f) =>
          which === 'unknown'
            ? f.verdict !== 'accepted' && f.verdict !== 'rejected'
            : f.verdict === which
        ).length,
      0
    );
  const topReasons = (tally, n = 4) =>
    [...tally.reasons.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([k, v]) => `${v}× ${k}`)
      .join(' | ');
  let parkedLastTurn = false;
  let turns = 0;
  let retries = 0; // the round's total, for the summary
  // M-234 (round 20): the four-retry budget was a SONG's, and five separate
  // Gemini 503 spikes over fifty minutes spent it — the last one ended a
  // round that had folded 28 answers. The budget is a TURN's now (a turn
  // that fails four times in a row is a broken turn); RETRY_ROUND_CAP bounds
  // the round so a dead engine still ends it.
  let turnRetries = 0;
  const loopLadder = []; // M-169: one row per revise call that reached a stop
  let lastAnswers = -1; // M-220: the answer count the previous turn left on record
  let parkStreak = 0; // M-233: parks in a row that did not reduce the open lines
  let lastOpen = null; // M-233: the open-line count at the last park
  let failedFast = false;
  let userReasks = 0; // M-222: same-message re-sends after a malformed, call-less turn
  let truncated = 0; // M-223: turns cut off by a malformed hop AFTER making calls
  let hitTurnCap = false; // M-224: the connector's CHAT_MAX_TURNS answered 429
  let hitUpstreamFinal = false; // M-231: a 502 whose upstream answered 4xx (not 429)
  let rateLimited = false; // M-249: the engine's quota is spent and no wait clears it
  let partials = 0; // M-232: turns the connector ended early on an upstream 5xx, calls kept
  let lastStatus = 200; // M-223: the last turn's HTTP status and error body
  let lastError = null;

  let aggregateStopped = false;
  let wallCanary = false;
  let uncertainProposal = false;
  let nextTurn = saved?.next_turn || 0;
  let attemptNo = 0;
  if (saved) {
    ({
      env,
      sawStop,
      parked,
      cycleNo,
      parkedLastTurn,
      turns,
      retries,
      lastAnswers,
      parkStreak,
      lastOpen,
      failedFast,
      userReasks,
      truncated,
      hitTurnCap,
      hitUpstreamFinal,
      rateLimited,
      partials,
      lastStatus,
      lastError,
    } = saved.state);
    cycle = { ...saved.state.cycle, reasons: new Map(saved.state.cycle.reasons) };
    cycles.push(...saved.state.cycles);
    loopLadder.push(...saved.state.loopLadder);
  }
  const checkpoint = (terminal = false) => {
    // The checkpoint's transcript offset must never outrun durable bytes.
    if (existsSync(file)) flushFile(file);
    atomicJSON(checkpointFile, {
      version: 1,
      song: songNo,
      next_turn: nextTurn,
      terminal,
      transcript_bytes: existsSync(file) ? statSync(file).size : 0,
      state: {
        env,
        sawStop,
        parked,
        cycleNo,
        cycle: { ...cycle, reasons: [...cycle.reasons] },
        cycles,
        parkedLastTurn,
        turns,
        retries,
        loopLadder,
        lastAnswers,
        parkStreak,
        lastOpen,
        failedFast,
        userReasks,
        truncated,
        hitTurnCap,
        hitUpstreamFinal,
        rateLimited,
        partials,
        lastStatus,
        lastError,
        flags,
      },
    });
  };
  const recover = async (requestId, initial = null) => {
    const until = Math.min(Date.now() + CLIENT_DEADLINE_MS, sessionDeadline - DELIVERY_RESERVE_MS);
    const pollMs = Math.max(10, Number(args['poll-ms'] ?? 5_000));
    while (Date.now() + 5 < until) {
      const read = await post(null, {
        path: `/chat/jobs/${requestId}`,
        method: 'GET',
        timeoutMs: Math.max(1, Math.min(10_000, Math.floor((until - Date.now()) / 2))),
      });
      const job = read.payload;
      if (read.status !== 200)
        return (
          initial || {
            status: 0,
            payload: null,
            ms: read.ms,
            transport: `unresolved request: recovery lookup returned ${read.status}; refusing automatic replay`,
          }
        );
      appendDurable(attemptsFile, {
        event: 'recovery_observed',
        request_id: requestId,
        at: new Date().toISOString(),
        state: job.state,
        checkpoint: job.checkpoint ?? null,
        build: job.build ?? null,
        progress: job.progress ?? null,
        uncertain_proposal: job.uncertain_proposal ?? false,
        persistence_error: job.persistence_error ?? null,
        proposer_usage: job.proposer_usage ?? null,
      });
      if (
        EXPECTED_COMMIT &&
        (job.build?.commit !== EXPECTED_COMMIT ||
          (manifest.live_build &&
            (job.build?.source_sha256 !== manifest.live_build.source_sha256 ||
              job.build?.config_sha256 !== manifest.live_build.config_sha256)))
      ) {
        return {
          status: 0,
          payload: null,
          ms: read.ms,
          checkpoint: job.checkpoint ?? null,
          transport:
            'retained job belongs to a different build or configuration; refusing to attribute this response to the measured revision',
        };
      }
      if (job.uncertain_proposal || job.progress?.uncertain_proposal) {
        return {
          status: 0,
          payload: null,
          ms: read.ms,
          recovery_state: job.state,
          uncertain_proposal: true,
          checkpoint: job.checkpoint ?? null,
          transport:
            'a proposal may have executed beyond the checkpoint; automatic resume is stopped until an explicit new_run decision',
        };
      }
      if (job.persistence_error && job.state !== 'completed') {
        return {
          status: 0,
          payload: null,
          ms: read.ms,
          recovery_state: job.state,
          persistence_error: job.persistence_error,
          checkpoint: job.checkpoint ?? null,
          transport:
            'server recovery persistence failed; checkpoint retained, no new work may be started until repaired',
        };
      }
      if (job.state === 'completed' && job.response) {
        const p = job.response.body;
        return {
          status: job.response.status,
          payload: p,
          recovered: true,
          ms: read.ms,
          error: p?.error ?? null,
          detail: p?.detail ?? null,
          retryAfterS:
            Number(job.response.headers?.['retry-after']) > 0
              ? Number(job.response.headers['retry-after'])
              : null,
          upstreamStatus: p?.upstream_status ?? null,
          hopsBeforeFailure: p?.hopsBeforeFailure ?? null,
          callsBeforeFailure: p?.callsBeforeFailure ?? null,
        };
      }
      if (job.state !== 'pending') {
        return {
          status: 0,
          payload: null,
          ms: read.ms,
          recovery_state: job.state,
          checkpoint: job.checkpoint ?? null,
          transport: `request is ${job.state}; its checkpoint is recorded, the interrupted request is not replayed`,
        };
      }
      if (Date.now() + pollMs + 5 >= until) break;
      await sleep(pollMs);
    }
    return (
      initial || {
        status: 0,
        payload: null,
        ms: 0,
        transport: `request is still unresolved at the delivery reserve; resume polls the same request ID`,
      }
    );
  };
  const send = async (body, turn) => {
    const ordinal = attemptNo++;
    const existing = attempts.find(
      (a) => a.event === 'request_started' && a.turn === turn && a.ordinal === ordinal
    );
    if (existing && JSON.stringify(existing.body) !== JSON.stringify(body)) {
      throw new Error(
        'checkpoint replay diverged from the recorded request; refusing a new paid request'
      );
    }
    if (existing) {
      if (
        !attempts.some(
          (a) => a.event === 'request_dispatched' && a.request_id === existing.request_id
        )
      ) {
        // No dispatch marker means the prior process stopped before sending.
        // The marker is fsynced before the socket can be opened.
        return send(body, turn);
      }
      const received = attempts.findLast(
        (a) => a.event === 'response_received' && a.request_id === existing.request_id
      );
      if (received && received.response.status !== 0 && received.response.status !== 202)
        return received.response;
      const response = await recover(existing.request_id);
      const receipt = {
        event: 'response_received',
        at: new Date().toISOString(),
        request_id: existing.request_id,
        turn,
        ordinal,
        response,
      };
      appendDurable(attemptsFile, receipt);
      attempts.push(receipt);
      const cp = response.checkpoint;
      if (
        args.resume &&
        response.recovery_state === 'interrupted' &&
        !response.persistence_error &&
        !response.uncertain_proposal &&
        Array.isArray(cp?.history) &&
        typeof cp.sig === 'string' &&
        cp.sig
      ) {
        const continuation = {
          message: CONTINUE,
          history: cp.history,
          workspace: cp.workspace,
          sig: cp.sig,
        };
        if (cp.lyric != null) continuation.lyric = cp.lyric;
        appendDurable(attemptsFile, {
          event: 'interrupted_resume',
          request_id: existing.request_id,
          at: new Date().toISOString(),
          uncertainty:
            'resuming only the last signed checkpoint; later unfinished work is not claimed as recovered',
        });
        const resumed = await send(continuation, turn);
        return { ...resumed, resume_body: continuation };
      }
      return response;
    }
    if (!canAdmit()) {
      aggregateStopped = true;
      return {
        status: 0,
        payload: null,
        transport: 'aggregate budget cannot admit a complete request plus delivery reserve',
        ms: 0,
      };
    }
    const intent = {
      event: 'request_started',
      at: new Date().toISOString(),
      request_id: randomBytes(32).toString('hex'),
      turn,
      ordinal,
      body,
    };
    appendDurable(attemptsFile, intent);
    attempts.push(intent);
    let response;
    let dispatched = false;
    if (EXPECTED_COMMIT) {
      const identity = await post(null, { path: '/health', method: 'GET', timeoutMs: 10_000 });
      if (identity.status !== 200 || identity.payload?.commit !== EXPECTED_COMMIT) {
        response = {
          status: 0,
          payload: null,
          transport: 'live commit changed or cannot be verified before request',
          ms: identity.ms,
          observed_commit: identity.payload?.commit ?? null,
        };
      }
      appendDurable(attemptsFile, {
        event: 'identity_checked',
        request_id: intent.request_id,
        at: new Date().toISOString(),
        commit: identity.payload?.commit ?? null,
        build: identity.payload?.build ?? null,
        recovery: identity.payload?.recovery ?? null,
      });
      if (
        !response &&
        args['require-recovery'] &&
        (identity.payload?.recovery?.durable !== true ||
          identity.payload?.recovery?.healthy !== true)
      ) {
        response = {
          status: 0,
          payload: null,
          transport: 'healthy durable server recovery is required for this measurement',
          ms: identity.ms,
        };
      }
      const build = identity.payload?.build;
      if (
        !response &&
        args['require-recovery'] &&
        (![build?.source_sha256, build?.config_sha256].every((value) =>
          /^[a-f0-9]{64}$/.test(value || '')
        ) ||
          build?.commit !== EXPECTED_COMMIT)
      ) {
        response = {
          status: 0,
          payload: null,
          transport: 'complete source/configuration identity is required for this measurement',
          ms: identity.ms,
        };
      }
      if (
        !response &&
        manifest.live_build &&
        (build?.source_sha256 !== manifest.live_build.source_sha256 ||
          build?.config_sha256 !== manifest.live_build.config_sha256)
      ) {
        response = {
          status: 0,
          payload: null,
          transport: 'live source or configuration changed during the battery',
          ms: identity.ms,
        };
      }
      if (!response && build && !manifest.live_build) {
        manifest.live_build = build;
        atomicJSON(runFile, manifest);
      }
    }
    if (!response) {
      const dispatch = {
        event: 'request_dispatched',
        at: new Date().toISOString(),
        request_id: intent.request_id,
        turn,
        ordinal,
      };
      appendDurable(attemptsFile, dispatch);
      attempts.push(dispatch);
      dispatched = true;
      response = await post({ ...body, request_id: intent.request_id });
      appendDurable(attemptsFile, {
        event: 'http_response_received',
        at: new Date().toISOString(),
        request_id: intent.request_id,
        turn,
        ordinal,
        response,
      });
    }
    if (
      dispatched &&
      (response.status === 0 ||
        (response.status === 202 && response.payload?.state === 'pending') ||
        (response.payload?.request_id === intent.request_id &&
          ['pending', 'interrupted', 'retired'].includes(response.payload?.state)))
    ) {
      response = await recover(intent.request_id, response.status === 0 ? response : null);
    } else if (args['require-recovery'] && response.status === 200) {
      // The pre-send health probe cannot identify a process deployed between
      // the probe and POST. The retained job names the process that did work.
      const original = response;
      response = await recover(intent.request_id);
      if (response.status === 0) response.original_response = original;
    }
    const receipt = {
      event: 'response_received',
      at: new Date().toISOString(),
      request_id: intent.request_id,
      turn,
      ordinal,
      response,
    };
    appendDurable(attemptsFile, receipt);
    attempts.push(receipt);
    return response;
  };
  checkpoint();
  for (let t = nextTurn; t < MAX_TURNS; t++) {
    nextTurn = t;
    attemptNo = 0;
    checkpoint();
    const message = t === 0 ? brief : parkedLastTurn ? PARKED_CONTINUE : CONTINUE;
    let body = { message };
    if (env) {
      body.history = env.history;
      body.workspace = env.workspace;
      if (env.lyric != null) body.lyric = env.lyric;
      body.sig = env.sig;
    }
    let r = await send(body, t);
    if (r.resume_body) body = r.resume_body;
    // THE USER-LEVEL RE-ASK (M-222). The connector's own re-ask (M-219)
    // reaches the model only once it is deployed; until then a turn that ends
    // on MALFORMED_FUNCTION_CALL with no tool call is exactly what a person at
    // the page does next: press send again on the same message with the
    // envelope the server handed back. Bounded (--reask, default 2 for one
    // song), every re-ask a row, and the fail-fast rule below judges the LAST
    // attempt — a turn that recovers on the re-ask is a recovered turn, and a
    // turn that fails three times is the failure the round stops on.
    let reasks = 0;
    let reasks_user = 0;
    while (
      r.status === 200 &&
      (r.payload?.stopped ?? null) === 'MALFORMED_FUNCTION_CALL' &&
      !(Array.isArray(r.payload?.tools) && r.payload.tools.length) &&
      reasks < REASK
    ) {
      reasks++;
      reasks_user = reasks;
      appendFileSync(
        file,
        JSON.stringify({
          turn: t,
          reask: reasks,
          stopped: r.payload.stopped,
          stopped_detail: r.payload.stopped_detail ?? null,
          ms: r.ms,
        }) + '\n'
      );
      console.log(
        `::warning title=battery user re-ask::song ${songNo} turn ${t} re-ask ${reasks}/${REASK}: the turn ended on MALFORMED_FUNCTION_CALL with no call; sending the same message again`
      );
      const again = { ...body };
      if (r.payload.history) {
        again.history = r.payload.history;
        again.workspace = r.payload.workspace;
        if (r.payload.lyric != null) again.lyric = r.payload.lyric;
        again.sig = r.payload.sig;
      }
      if (!canAdmit(PACE_MS)) {
        aggregateStopped = true;
        break;
      }
      await sleep(PACE_MS);
      body = again;
      r = await send(body, t);
    }
    // Bounded, logged backoff: a 429/503 is the deployment's own pacing and
    // is part of the record, never silently absorbed. 502 joined at M-164
    // (round 7, 2026-08-29): chat.js answers 502 from its catch-all when a
    // turn's upstream dies past the server's own single 5xx retry — the
    // turn's work is thrown away but the carried envelope is intact, so a
    // logged retry is the user pressing send again, not record-blurring.
    // THE CONNECTOR'S OWN CONVERSATION CAP IS TERMINAL (M-224): `CHAT_MAX_TURNS`
    // (12 by default, counted over the user turns the pruned history still
    // holds) answers 429 with "start a new recipe", and no retry changes it.
    // Four sixty-second waits on it would be four minutes of nothing; the row
    // names it and the round ends with its own reason.
    const turnCapped = () => r.status === 429 && /start a new recipe/.test(r.error || '');
    // A 429 THAT NAMES ITS WAIT IS PACING, NOT A FAILURE (M-229, round 16):
    // Gemini's per-minute limit answered turn 1 three times with Retry-After
    // 53s/25s/59s and the four-retry budget — sized for 5xx — gave the round
    // up on it. Such a 429 is waited out on the server's own number and does
    // not spend the retry budget; RATE_WAIT_CAP_S bounds the total.
    let rateWaitS = 0;
    let pacedRetries = 0;
    turnRetries = 0;
    const paced = () => r.status === 429 && r.retryAfterS != null && !turnCapped();
    // A 502 WHOSE UPSTREAM SAID 4xx IS FINAL (M-231, round 17): the connector
    // answers 502 for every throw, and a Gemini 400 on the request body does
    // not change on the fourth try. The upstream status rides on the body
    // now; a 4xx that is not 429 ends the turn on the first answer, with the
    // detail on the row. A 5xx upstream, or a body that does not say, keeps
    // the bounded retry — transient is still the default reading.
    const upstreamFinal = () =>
      r.status === 502 &&
      Number.isFinite(r.upstreamStatus) &&
      r.upstreamStatus >= 400 &&
      r.upstreamStatus < 500 &&
      r.upstreamStatus !== 429;
    while (
      (r.status === 429 || r.status === 502 || r.status === 503) &&
      !turnCapped() &&
      !upstreamFinal() &&
      !aggregateStopped &&
      (paced()
        ? rateWaitS < RATE_WAIT_CAP_S &&
          pacedRetries < RATE_PACED_MAX &&
          rateWaitS + Math.min(r.retryAfterS, RETRY_AFTER_CAP_S) <= RATE_WAIT_CAP_S
        : turnRetries < 4 && retries < RETRY_ROUND_CAP)
    ) {
      const waitMs =
        r.retryAfterS != null
          ? Math.min(r.retryAfterS, RETRY_AFTER_CAP_S) * 1000
          : Math.max(PACE_MS, 60_000);
      if (!canAdmit(waitMs)) {
        aggregateStopped = true;
        break;
      }
      if (!paced()) {
        retries++;
        turnRetries++;
      } else {
        // M-249: a paced 429 still does not spend the RETRY budget (M-229), and
        // it is counted, so the bound above can fire and the row can say so.
        pacedRetries++;
        rateWaitS += Math.min(r.retryAfterS, RETRY_AFTER_CAP_S);
      }
      // The wait is the server's own Retry-After when it names one (capped at
      // RETRY_AFTER_CAP_S so a quota that says "tomorrow" cannot park the job),
      // else the 60s floor. The row says which, and quotes the body's error.
      const waitS = r.retryAfterS != null ? Math.min(r.retryAfterS, RETRY_AFTER_CAP_S) : null;
      appendFileSync(
        file,
        JSON.stringify({
          turn: t,
          retry: turnRetries,
          retries_total: retries,
          paced: paced(),
          paced_retry: pacedRetries,
          paced_max: RATE_PACED_MAX,
          rate_wait_s: rateWaitS,
          rate_wait_cap_s: RATE_WAIT_CAP_S,
          status: r.status,
          error: r.error ?? null,
          // M-231: the upstream cause, when the connector says it.
          detail: r.detail ?? null,
          upstream_status: r.upstreamStatus ?? null,
          hops_before_failure: r.hopsBeforeFailure ?? null,
          calls_before_failure: r.callsBeforeFailure ?? null,
          retry_after_s: r.retryAfterS ?? null,
          waited_s: waitS ?? Math.max(PACE_MS, 60_000) / 1000,
        }) + '\n'
      );
      console.log(
        `::warning title=battery retry::song ${songNo} turn ${t} ` +
          (paced()
            ? `paced ${pacedRetries}/${RATE_PACED_MAX} (waited ${rateWaitS}s/${RATE_WAIT_CAP_S}s)`
            : `retry ${turnRetries}/4 (${retries}/${RETRY_ROUND_CAP} this round)`) +
          `: status ${r.status}` +
          (r.retryAfterS != null ? ` retry-after ${r.retryAfterS}s` : '') +
          (r.error ? ` — ${esc(r.error, 160)}` : '') +
          (r.detail
            ? ` — upstream ${r.upstreamStatus ?? '?'} after ${r.hopsBeforeFailure ?? '?'} hop(s): ${esc(r.detail, 200)}`
            : '')
      );
      await sleep(waitS != null ? waitS * 1000 : Math.max(PACE_MS, 60_000));
      r = await send(body, t);
    }
    if (aggregateStopped) break;
    if (r.uncertain_proposal) {
      uncertainProposal = true;
      flags.push({ turn: t, flag: 'uncertain_proposal', detail: r.transport });
      break;
    }
    const p = r.payload || {};
    lastStatus = r.status;
    lastError = r.error ?? r.transport ?? null;
    if (upstreamFinal()) {
      hitUpstreamFinal = true;
      flags.push({
        turn: t,
        flag: 'upstream_final',
        upstream_status: r.upstreamStatus,
        detail: r.detail,
      });
      appendFileSync(
        file,
        JSON.stringify({
          turn: t,
          upstream_final: r.upstreamStatus,
          detail: r.detail ?? null,
          hops_before_failure: r.hopsBeforeFailure ?? null,
          calls_before_failure: r.callsBeforeFailure ?? null,
        }) + '\n'
      );
      console.log(
        `::error title=battery upstream final::song ${songNo} turn ${t}: the engine answered ${r.upstreamStatus} after ${r.hopsBeforeFailure ?? '?'} hop(s) — ${esc(r.detail ?? '', 200)}`
      );
      break;
    }
    // THE SPENT RATE LIMIT IS A STOPPING PLACE (M-249, round 23). The engine
    // answering 429 with a Retry-After it will answer again is not a failure of
    // this harness and it is not pacing either — it is the round being unable
    // to proceed, which is a RESULT and belongs in the record under its own
    // name. Waiting past the bound buys nothing: the quota resets on the
    // provider's clock, not on ours.
    if (
      r.status === 429 &&
      !turnCapped() &&
      (pacedRetries >= RATE_PACED_MAX ||
        rateWaitS >= RATE_WAIT_CAP_S ||
        (paced() && rateWaitS + Math.min(r.retryAfterS, RETRY_AFTER_CAP_S) > RATE_WAIT_CAP_S))
    ) {
      rateLimited = true;
      flags.push({
        turn: t,
        flag: 'rate_limited',
        paced_retry: pacedRetries,
        rate_wait_s: rateWaitS,
        retry_after_s: r.retryAfterS ?? null,
        error: r.error ?? null,
      });
      appendFileSync(
        file,
        JSON.stringify({
          turn: t,
          rate_limited: true,
          paced_retry: pacedRetries,
          paced_max: RATE_PACED_MAX,
          rate_wait_s: rateWaitS,
          rate_wait_cap_s: RATE_WAIT_CAP_S,
          retry_after_s: r.retryAfterS ?? null,
          error: r.error ?? null,
        }) + '\n'
      );
      console.log(
        `::error title=battery rate limited::song ${songNo} turn ${t}: the engine's rate limit is SPENT — ` +
          `${pacedRetries} paced 429(s), ${rateWaitS}s waited, and it still answers 429` +
          (r.retryAfterS != null ? ` retry-after ${r.retryAfterS}s` : '') +
          `. No wait this round can afford will clear it; the round stops here.` +
          (r.error ? ` — ${esc(r.error, 200)}` : '')
      );
      break;
    }
    if (turnCapped()) {
      hitTurnCap = true;
      flags.push({ turn: t, flag: 'server_turn_cap', error: r.error });
      appendFileSync(file, JSON.stringify({ turn: t, server_turn_cap: r.error }) + '\n');
      console.log(
        `::error title=battery server turn cap::song ${songNo} turn ${t}: ${esc(r.error, 160)}`
      );
      break;
    }
    if (r.status === 0) {
      flags.push({ turn: t, flag: 'transport_failure', detail: r.transport });
    }
    const tools = Array.isArray(p.tools) ? p.tools : [];
    const reviseCalls = tools.filter((c) => c.name === 'lyric_revise');
    let parkedThisTurn = false;
    // THE KITCHEN'S SPENT 429 IS THE SAME STOPPING PLACE (M-255). Under the
    // kitchen (M-254) the rate limit that used to hit the chat model's turn
    // now hits the cook inside lyric_revise, which refuses at exit 2 once its
    // wait budget is spent ("the declared proposer could not answer: Gemini
    // 429 ..."). That is M-249's result under a new name, not a refusal to
    // steer past: a CONTINUE would only spend the next turn's budget on the
    // same wall. One row, the flag, the verdict `rate_limited`, and the
    // round stops here.
    const kitchenSpent = reviseCalls.find(
      (c) =>
        c.exit_code === 2 &&
        typeof c.refusal === 'string' &&
        /could not answer/.test(c.refusal) &&
        /\b429\b/.test(c.refusal)
    );
    for (const c of reviseCalls) {
      foldInto(cycle, c);
      if (c.exit_code === 0) sawStop = 0;
      if (c.exit_code === 3) {
        parked++;
        parkedThisTurn = true;
      }
      if (c.exit_code === 0 || c.exit_code === 3) {
        // The cycle closes on the stop row (M-235): say what it bought.
        cycleNo++;
        const rec = {
          cycle: cycleNo,
          turns: [cycle.firstTurn, t],
          stop: c.loop_stop_reason ?? null,
          rounds: c.loop_rounds ?? null,
          open: c.loop_unresolved ?? null,
          whole_flags: c.loop_whole_flag_codes ?? null,
          answers: c.answers_on_record ?? null,
          accepted: cycle.accepted,
          rejected: cycle.rejected,
          unknown: cycle.unknown,
          top_reasons: topReasons(cycle, 8),
          draft_fp: c.draft_fp ?? null,
          // WHY it stopped where it did (round 24's smoke run, 2026-09-07):
          // six kitchen runs parked on L5 and L6 and no row could say what
          // those lines still carried. The findings standing at the stop,
          // in the report's own spelling, from the verdict (M-232).
          standing: Array.isArray(c.standing) ? c.standing : null,
        };
        cycles.push(rec);
        appendFileSync(file, JSON.stringify({ turn: t, cycle: rec }) + '\n');
        console.log(
          `::notice title=battery cycle::song ${songNo} cycle ${cycleNo} (turns ${rec.turns[0]}-${t}): ` +
            `stop=${rec.stop} rounds=${rec.rounds} open=${rec.open} whole=${(rec.whole_flags || []).join(',') || 'none'} ` +
            `answers=${rec.answers} accepted=${rec.accepted} rejected=${rec.rejected} unknown=${rec.unknown}` +
            (rec.top_reasons ? ` reasons: ${esc(rec.top_reasons, 700)}` : '') +
            (rec.standing ? ` standing: ${esc(rec.standing.join(' | '), 900)}` : '')
        );
        cycle = { accepted: 0, rejected: 0, unknown: 0, reasons: new Map(), firstTurn: t + 1 };
      }
      // THE LADDER (M-169): what each stopped run actually bought. `reached_stop`
      // and `parked` say WHETHER the loop stopped; they cannot say whether eight
      // rounds closed nineteen lines or none, which is the difference between a
      // run that is slow and a run that is stuck. Round 10 needed exactly this
      // and the only copy of it in the record was one the model had retyped into
      // its chat reply. One row per call that reached a stop condition; a
      // suspended call has no stop reason and contributes no row (absent is not
      // zero — doctrine 20).
      if (typeof c.loop_rounds === 'number' && c.loop_stop_reason) {
        loopLadder.push({
          turn: t,
          stop: c.loop_stop_reason,
          rounds: c.loop_rounds,
          unresolved: c.loop_unresolved ?? null,
          whole_flags: c.loop_whole_flag_codes ?? null,
          answers: c.answers_on_record ?? null,
          standing: Array.isArray(c.standing) ? c.standing : null,
        });
      }
    }
    // Mechanical suspicion, not a verdict: a reply that LOOKS like a
    // delivered multi-section song while no revise call ever reached a stop
    // condition. The analyst confirms or discharges it from the transcript.
    const looksDelivered =
      /\[[A-Z][A-Z0-9 ]*(—|-)[^\]]*\]/.test(p.reply || '') || /\[FINISHED/.test(p.reply || '');
    if (looksDelivered && sawStop === null && parked === 0) {
      flags.push({ turn: t, flag: 'possible_premature_done' });
    }
    const banned = tools.filter((c) => typeof c.banned_pairs === 'number' && c.banned_pairs > 0);
    if (
      banned.length &&
      /finish|final|done|complete/i.test(p.reply || '') &&
      sawStop === null &&
      parked === 0
    ) {
      flags.push({
        turn: t,
        flag: 'claims_progress_over_standing_ban',
        banned: banned.map((c) => c.banned_pairs),
      });
    }
    appendFileSync(
      file,
      JSON.stringify({
        turn: t,
        message: esc(message, 200),
        status: r.status,
        ms: r.ms,
        transport: r.transport ?? null,
        reply: p.reply ?? null,
        tools,
        stopped: p.stopped ?? null,
        // M-221: WHY it stopped and WHAT the malformed hops contained. Round
        // 11 banked nine malformed turns and could quote none of them.
        stopped_detail: p.stopped_detail ?? null,
        malformed: Array.isArray(p.malformed) ? p.malformed : null,
        user_reasks: reasks,
        error: p.error ?? null,
        // M-231: on a non-200, the upstream cause and the hops it had bought.
        detail: p.detail ?? null,
        upstream_status: p.upstream_status ?? null,
        hops_before_failure: p.hopsBeforeFailure ?? null,
        calls_before_failure: p.callsBeforeFailure ?? null,
        sizes: {
          history: p.history ? JSON.stringify(p.history).length : 0,
          lyric: p.lyric ? JSON.stringify(p.lyric).length : 0,
        },
      }) + '\n'
    );
    turns++;
    userReasks += reasks;
    // THE ROW, AS A WORKFLOW ANNOTATION THE MOMENT IT LANDS (M-220): the job
    // log is served only after the job ends, and an annotation is the one
    // channel a runner has that a reader can see mid-run.
    // THE TURN'S OWN COUNT, not the running maximum (M-233, round 19): a
    // parked run is continued by a FRESH run whose answers start at 0 again,
    // and a count folded into the previous run's maximum read the fresh
    // run's ten answers as "no new answer folded (13 on record, was 13)".
    const answersNow = Math.max(
      -1,
      ...tools.map((c) => (typeof c.answers_on_record === 'number' ? c.answers_on_record : -1))
    );
    const parkedRows = reviseCalls.filter((c) => c.exit_code === 3);
    console.log(
      `::notice title=battery song ${songNo} turn ${t}::status=${r.status} ms=${r.ms} ` +
        `tools=${tools.length} answers_on_record=${answersNow < 0 ? 'none' : answersNow} ` +
        `stopped=${p.stopped ?? 'none'} user_reasks=${reasks} malformed_hops=${Array.isArray(p.malformed) ? p.malformed.length : 'unrecorded'} ` +
        `draft_carried=${tools.filter((c) => c.draft_carried).length}/${tools.filter((c) => c.name === 'lyric_revise').length} ` +
        `proposals=${countVerdict(reviseCalls, 'accepted')}/${countVerdict(reviseCalls, 'rejected')}/${countVerdict(reviseCalls, 'unknown')} ` +
        `paths=${[...new Set(tools.map((c) => c.path).filter(Boolean))].join('/') || 'unrecorded'}`
    );
    // The malformed call text is the evidence (M-221): print its head the
    // moment it lands, one notice per hop, so a red run says what the model
    // tried to call rather than only that it failed.
    for (const m of Array.isArray(p.malformed) ? p.malformed : []) {
      console.log(
        `::notice title=battery malformed hop::song ${songNo} turn ${t} hop ${m.hop} ` +
          `${m.reasked ? 're-asked' : 'not re-asked'}: ${m.finishMessage == null ? '(finishMessage absent)' : esc(m.finishMessage, 600)}`
      );
    }
    if (r.status !== 200) break;
    env = { history: p.history, workspace: p.workspace, lyric: p.lyric, sig: p.sig };
    nextTurn = t + 1;
    if (p.stopped === 'UNCERTAIN_PROPOSAL') {
      uncertainProposal = true;
      flags.push({
        turn: t,
        flag: 'uncertain_proposal',
        detail:
          'a proposal may have been paid for; automatic continuation is stopped until the operator explicitly chooses new_run from the last accepted draft',
      });
      checkpoint(true);
      break;
    }
    if (
      EXPECT === 'turn-wall' &&
      p.stopped === 'MAX_TURN_MS' &&
      Array.isArray(p.history) &&
      typeof p.sig === 'string' &&
      p.sig.length > 0
    ) {
      wallCanary = true;
      checkpoint();
      break;
    }
    if (sawStop !== null) break; // exit 0 — the song is FINISHED (M-163)
    if (kitchenSpent) {
      rateLimited = true;
      flags.push({
        turn: t,
        flag: 'rate_limited',
        kitchen: true,
        proposer_wait_s: kitchenSpent.proposer_wait_s ?? null,
        proposer_retries: kitchenSpent.proposer_retries ?? null,
        refusal: kitchenSpent.refusal,
      });
      appendFileSync(
        file,
        JSON.stringify({
          turn: t,
          rate_limited: true,
          kitchen: true,
          proposer_wait_s: kitchenSpent.proposer_wait_s ?? null,
          proposer_retries: kitchenSpent.proposer_retries ?? null,
          refusal: kitchenSpent.refusal,
        }) + '\n'
      );
      console.log(
        `::error title=battery rate limited::song ${songNo} turn ${t}: the kitchen's rate limit is SPENT — ` +
          `${kitchenSpent.proposer_wait_s ?? '?'}s waited over ${kitchenSpent.proposer_retries ?? '?'} paced 429(s) ` +
          `and Gemini still answers 429. No wait this round can afford will clear it; the round stops here. — ` +
          esc(kitchenSpent.refusal, 300)
      );
      break;
    }
    if (p.error) break;
    // FAIL FAST (M-220). Three conditions, named separately in the row.
    const reasons = [];
    // A MALFORMED END AFTER CALLS IS A TRUNCATED TURN, NOT A DEAD ONE (M-223,
    // round 13): the turn planned, checked and was cut off by the model's
    // broken hop — round 11's malformed turns folded 6, 2, 4 and 5 answers
    // each before ending the same way. Those turns continue on the next
    // message; the idle rule below is what catches a run that stops
    // advancing. Only a malformed turn with NO call, after the user re-asks
    // (M-222) are spent, is the failure this rule names.
    if (STOP_ON.has('malformed') && p.stopped === 'MALFORMED_FUNCTION_CALL' && tools.length === 0) {
      // Say what the deploy actually did (M-221): the smoke run's row read
      // "after the connector re-asks" against a deploy that had no re-ask.
      const reasks = p.stopped_detail?.malformedRetries;
      reasons.push(
        reasks == null
          ? `turn ended on MALFORMED_FUNCTION_CALL with no call (this deploy records no re-ask; ${reasks_user} user re-ask(s) spent)`
          : `turn ended on MALFORMED_FUNCTION_CALL with no call after ${reasks} connector re-ask(s) and ${reasks_user} user re-ask(s)`
      );
    }
    if (p.stopped === 'MALFORMED_FUNCTION_CALL' && tools.length > 0) truncated++;
    // A PARTIAL TURN IS NOT AN IDLE ONE (M-232): the connector ended the turn
    // on an upstream 5xx after calls were made and kept them; the model was
    // not idle, the engine was. The next turn continues from the kept calls.
    // Bounded: more than PARTIAL_CAP such turns in one round is the engine
    // being down, and the round says so as transport.
    const partial = typeof p.stopped === 'string' && p.stopped.startsWith('UPSTREAM_');
    if (partial) {
      partials++;
      flags.push({
        turn: t,
        flag: 'upstream_partial',
        stopped: p.stopped,
        detail: p.stopped_detail ?? null,
      });
      console.log(
        `::warning title=battery partial turn::song ${songNo} turn ${t}: the engine died mid-turn (${p.stopped}) after ${tools.length} call(s); the calls are kept and the next turn continues`
      );
      if (partials > PARTIAL_CAP) {
        lastStatus = 502;
        lastError = `${partials} partial turns on upstream failures (cap ${PARTIAL_CAP})`;
        break;
      }
    }
    if (!partial && STOP_ON.has('idle') && tools.length === 0)
      reasons.push('turn made no tool call');
    // A park is a result, not idleness; the baseline resets after it so the
    // continuing run's first folds count. What IS idleness after a park: the
    // same or more lines open on three parks in a row (M-233).
    if (
      !partial &&
      STOP_ON.has('idle') &&
      t > 0 &&
      answersNow >= 0 &&
      answersNow <= lastAnswers &&
      !parkedRows.length
    )
      reasons.push(`no new answer folded (${answersNow} on record, was ${lastAnswers})`);
    if (parkedRows.length) {
      const open = Math.min(
        ...parkedRows.map((c) => (typeof c.loop_unresolved === 'number' ? c.loop_unresolved : 0))
      );
      parkStreak = lastOpen != null && open >= lastOpen ? parkStreak + 1 : 1;
      lastOpen = open;
      if (STOP_ON.has('idle') && parkStreak >= PARK_STREAK_CAP)
        reasons.push(`parked ${parkStreak} times in a row without fewer open lines (${open} open)`);
    } else if (answersNow > lastAnswers) {
      parkStreak = 0;
    }
    if (reasons.length) {
      flags.push({ turn: t, flag: 'fail_fast', reasons });
      appendFileSync(file, JSON.stringify({ turn: t, fail_fast: reasons }) + '\n');
      console.log(
        `::error title=battery fail-fast::song ${songNo} turn ${t}: ${reasons.join('; ')}`
      );
      process.exitCode = 1;
      failedFast = true;
      break;
    }
    lastAnswers = parkedRows.length ? -1 : Math.max(lastAnswers, answersNow);
    parkedLastTurn = parkedThisTurn;
    checkpoint();
    const partialWaitMs =
      p.stopped === 'UPSTREAM_429' && Number.isFinite(p.stopped_detail?.retry_after_ms)
        ? Math.min(RETRY_AFTER_CAP_S * 1000, Math.max(0, p.stopped_detail.retry_after_ms))
        : 0;
    const nextWaitMs = Math.max(PACE_MS, partialWaitMs);
    if (t + 1 < MAX_TURNS && !canAdmit(nextWaitMs)) {
      aggregateStopped = true;
      break;
    }
    if (t + 1 < MAX_TURNS) {
      if (partialWaitMs)
        appendFileSync(
          file,
          JSON.stringify({
            turn: t,
            partial_pacing: true,
            retry_after_ms: p.stopped_detail.retry_after_ms,
            waited_s: nextWaitMs / 1000,
          }) + '\n'
        );
      await sleep(nextWaitMs);
    }
  }

  // THE ROUND'S VERDICT IS THE EXIT CODE (M-223). Round 12 exited 0 with no
  // song: its only red path was fail-fast, so a round whose turn 1 died on
  // 429/502 five times reported GREEN. One reason per song, never summed:
  // finished (a lyric_revise exit 0), failed_fast, server_turn_cap (M-224),
  // upstream_final (M-231: a 502 whose upstream answered 4xx), rate_limited
  // (M-249: the engine's quota is spent — a stopping place, not a transport
  // failure, and not something a longer wait fixes), transport (the
  // last turn was a non-200 or an error body), no_stop (every turn answered and the
  // loop never reached exit 0). A single-song round is red on anything but
  // finished; a survey keeps exit 0 because its job is coverage.
  const exitReason = uncertainProposal
    ? 'uncertain_proposal'
    : aggregateStopped
      ? 'aggregate_deadline'
      : wallCanary
        ? 'turn_wall_checkpoint'
        : sawStop === 0
          ? 'finished'
          : failedFast
            ? 'failed_fast'
            : hitTurnCap
              ? 'server_turn_cap'
              : hitUpstreamFinal
                ? 'upstream_final'
                : rateLimited
                  ? 'rate_limited'
                  : lastStatus !== 200 || lastError
                    ? 'transport'
                    : 'no_stop';
  const expected =
    EXPECT === 'survey' ||
    (EXPECT === 'finished' && exitReason === 'finished') ||
    (EXPECT === 'turn-wall' && exitReason === 'turn_wall_checkpoint');
  if (!expected) process.exitCode = 1;
  checkpoint(
    !['aggregate_deadline', 'turn_wall_checkpoint', 'no_stop', 'transport'].includes(exitReason)
  );
  console.log(
    `::${expected ? 'notice' : 'error'} title=battery verdict::song ${songNo}: ${exitReason}` +
      (lastError ? ` — last error: ${esc(lastError, 160)}` : '')
  );
  summary.songs[songNo] = {
    song: songNo,
    brief: esc(brief, 80),
    turns,
    retries,
    exit_reason: exitReason,
    reached_stop: sawStop,
    cycles,
    parked,
    failed_fast: failedFast,
    stop_on: [...STOP_ON],
    user_reasks: userReasks,
    reask_bound: REASK,
    truncated_turns: truncated,
    loop_ladder: loopLadder,
    flags,
    expected,
    checkpoint: `song${songNo}.checkpoint.json`,
  };
  atomicJSON(join(OUT, 'summary.json'), summary);
  // The ladder prints too, because the log is what an analyst reads first and
  // a field that exists only in an uploaded artifact is a field nobody reads.
  const ladder = loopLadder
    .map((l) => `t${l.turn}:${l.stop}/${l.rounds}r/${l.unresolved ?? '?'}open`)
    .join(' ');
  console.log(
    `song ${songNo}: ${turns} turn(s), stop=${sawStop === null ? (parked ? `NEVER (parked x${parked})` : 'NEVER') : `exit ${sawStop}`}, flags=${flags.length}${failedFast ? ', FAILED FAST' : ''}` +
      (ladder
        ? `\n  loop ladder: ${ladder}`
        : '\n  loop ladder: (no call reached a stop condition)')
  );
  if (aggregateStopped) break;
}

summary.expected =
  summary.songs.length === indices.length &&
  summary.songs.every(
    (song) =>
      EXPECT === 'survey' ||
      (EXPECT === 'finished'
        ? song.exit_reason === 'finished'
        : song.exit_reason === 'turn_wall_checkpoint')
  );
process.exitCode = summary.expected ? 0 : 1;
summary.finished = new Date().toISOString();
atomicJSON(join(OUT, 'summary.json'), summary);
console.log(
  `\nrecorded to ${OUT} — the transcript is the deliverable; the leak charging happens off it.`
);
