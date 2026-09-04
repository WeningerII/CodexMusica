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
//     [--reask=N]                        (default for one song: 2; same-message re-sends on a malformed, call-less turn)
//
// Output: DIR/song<i>.jsonl (one row per turn) and DIR/summary.json.

import { readFileSync } from 'node:fs';
import { request as httpsRequest } from 'node:https';
import { request as httpRequest } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
    return m ? [m[1], m[2] ?? 'true'] : [a, 'true'];
  })
);

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
// is all of them and for a multi-song round it is none, because a multi-song
// round's job is the survey and a single song's job is the diagnosis.
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
const REASK = Math.max(0, Number(args.reask ?? (N_SONGS === 1 ? 2 : 0)) || 0);
// M-232: how many partial turns (the connector kept the calls, the engine
// died mid-turn) one round tolerates before it is the engine being down.
const PARTIAL_CAP = Math.max(0, Number(args['partial-cap'] ?? 6) || 0);
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
const CONTINUE =
  'continue — and answer every question the revision loop asks within this ' +
  'same reply, one lyric_revise call after another, as many as it takes. ' +
  'One answer per reply is too slow; keep going until it reaches exit 0. ' +
  'Tool calls only: no prose between calls, and never retype the song — ' +
  'each answer is the one line (or the L<n>: lines) the question asked for, ' +
  'plain ASCII punctuation. If a call did not go through, make the same call again.';
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
const PARKED_CONTINUE =
  'That run parked at exit 3 with lines still flagged. Do not stop there — ' +
  'revise again until every check passes and lyric_revise reaches exit 0, ' +
  'then show me the finished version. Stay on this same song and this same ' +
  'plan: do not sweep again and do not plan a new one — starting over ' +
  'throws away everything already fixed.';

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
const TURN_DEADLINE_MS = MAX_STEPS * TOOL_TIMEOUT_MS;

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
function post(body) {
  const started = Date.now();
  return new Promise((resolve) => {
    const url = new URL('/chat', BASE);
    const data = JSON.stringify(body);
    const req = (url.protocol === 'http:' ? httpRequest : httpsRequest)(
      url,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(data) },
      },
      (res) => {
        let buf = '';
        res.setEncoding('utf8');
        res.on('data', (c) => {
          buf += c;
        });
        res.on('end', () => {
          let payload = null;
          try {
            payload = JSON.parse(buf);
          } catch {
            payload = null;
          }
          // M-223: WHICH limiter answered. Round 12's turn 1 banked 429, 502,
          // 429, 429, 502 as bare statuses; the connector names its limiter
          // in the body and its wait in Retry-After, and the row carries both.
          const ra = Number(res.headers['retry-after']);
          resolve({
            status: res.statusCode,
            payload,
            ms: Date.now() - started,
            retryAfterS: Number.isFinite(ra) && ra > 0 ? ra : null,
            error: payload && typeof payload.error === 'string' ? payload.error : null,
            // M-231: the upstream cause the connector now puts on a 502.
            detail: payload && typeof payload.detail === 'string' ? payload.detail : null,
            upstreamStatus:
              payload && Number.isFinite(payload.upstream_status) ? payload.upstream_status : null,
            hopsBeforeFailure:
              payload && Number.isFinite(payload.hopsBeforeFailure)
                ? payload.hopsBeforeFailure
                : null,
            callsBeforeFailure:
              payload && Array.isArray(payload.callsBeforeFailure)
                ? payload.callsBeforeFailure
                : null,
          });
        });
      }
    );
    req.on('socket', (s) => s.setKeepAlive(true, KEEPALIVE_PROBE_MS));
    const deadline = setTimeout(() => {
      req.destroy(
        new Error(
          `no response inside the derived turn deadline (${TURN_DEADLINE_MS} ms = maxSteps ${MAX_STEPS} x tool timeout ${TOOL_TIMEOUT_MS} ms)`
        )
      );
    }, TURN_DEADLINE_MS);
    req.on('close', () => clearTimeout(deadline));
    req.on('error', (err) =>
      resolve({
        status: 0,
        payload: null,
        transport: String((err && err.message) || err),
        ms: Date.now() - started,
      })
    );
    req.end(data);
  });
}

const { mkdirSync, appendFileSync, writeFileSync } = await import('node:fs');
mkdirSync(OUT, { recursive: true });
console.log(
  `turn deadline: ${TURN_DEADLINE_MS} ms (maxSteps ${MAX_STEPS} x CHAT_TOOL_TIMEOUT_MS ${TOOL_TIMEOUT_MS} ms, both read from source)`
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const summary = { base: BASE, started: new Date().toISOString(), songs: [] };

const only = args.brief != null ? [parseInt(args.brief, 10)] : null;
const indices = only ?? Array.from({ length: N_SONGS }, (_, i) => i % BRIEFS.length);

for (const [songNo, briefIdx] of indices.entries()) {
  const brief = BRIEFS[briefIdx];
  const file = `${OUT}/song${songNo}.jsonl`;
  const flags = [];
  let env = null; // {history, workspace, lyric?, sig}
  let sawStop = null; // lyric_revise exit 0 seen — the only "finished" (M-163)
  let parked = 0; // lyric_revise exit 3 stops — recorded, declined, continued
  let parkedLastTurn = false;
  let turns = 0;
  let retries = 0;
  const loopLadder = []; // M-169: one row per revise call that reached a stop
  let lastAnswers = -1; // M-220: the answer count the previous turn left on record
  let failedFast = false;
  let userReasks = 0; // M-222: same-message re-sends after a malformed, call-less turn
  let truncated = 0; // M-223: turns cut off by a malformed hop AFTER making calls
  let hitTurnCap = false; // M-224: the connector's CHAT_MAX_TURNS answered 429
  let hitUpstreamFinal = false; // M-231: a 502 whose upstream answered 4xx (not 429)
  let partials = 0; // M-232: turns the connector ended early on an upstream 5xx, calls kept
  let lastStatus = 200; // M-223: the last turn's HTTP status and error body
  let lastError = null;

  for (let t = 0; t < MAX_TURNS; t++) {
    const message = t === 0 ? brief : parkedLastTurn ? PARKED_CONTINUE : CONTINUE;
    const body = { message };
    if (env) {
      body.history = env.history;
      body.workspace = env.workspace;
      if (env.lyric != null) body.lyric = env.lyric;
      body.sig = env.sig;
    }
    let r = await post(body);
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
      await sleep(PACE_MS);
      r = await post(again);
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
      (retries < 4 || (paced() && rateWaitS < RATE_WAIT_CAP_S))
    ) {
      if (!paced()) retries++;
      else rateWaitS += Math.min(r.retryAfterS, RETRY_AFTER_CAP_S);
      // The wait is the server's own Retry-After when it names one (capped at
      // RETRY_AFTER_CAP_S so a quota that says "tomorrow" cannot park the job),
      // else the 60s floor. The row says which, and quotes the body's error.
      const waitS = r.retryAfterS != null ? Math.min(r.retryAfterS, RETRY_AFTER_CAP_S) : null;
      appendFileSync(
        file,
        JSON.stringify({
          turn: t,
          retry: retries,
          paced: paced(),
          rate_wait_s: rateWaitS,
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
        `::warning title=battery retry::song ${songNo} turn ${t} retry ${retries}/4: status ${r.status}` +
          (r.retryAfterS != null ? ` retry-after ${r.retryAfterS}s` : '') +
          (r.error ? ` — ${esc(r.error, 160)}` : '') +
          (r.detail
            ? ` — upstream ${r.upstreamStatus ?? '?'} after ${r.hopsBeforeFailure ?? '?'} hop(s): ${esc(r.detail, 200)}`
            : '')
      );
      await sleep(waitS != null ? waitS * 1000 : Math.max(PACE_MS, 60_000));
      r = await post(body);
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
    for (const c of reviseCalls) {
      if (c.exit_code === 0) sawStop = 0;
      if (c.exit_code === 3) {
        parked++;
        parkedThisTurn = true;
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
    const answersNow = Math.max(
      lastAnswers,
      ...tools.map((c) => (typeof c.answers_on_record === 'number' ? c.answers_on_record : -1))
    );
    console.log(
      `::notice title=battery song ${songNo} turn ${t}::status=${r.status} ms=${r.ms} ` +
        `tools=${tools.length} answers_on_record=${answersNow < 0 ? 'none' : answersNow} ` +
        `stopped=${p.stopped ?? 'none'} user_reasks=${reasks} malformed_hops=${Array.isArray(p.malformed) ? p.malformed.length : 'unrecorded'} ` +
        `draft_carried=${tools.filter((c) => c.draft_carried).length}/${tools.filter((c) => c.name === 'lyric_revise').length} ` +
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
    if (sawStop !== null) break; // exit 0 — the song is FINISHED (M-163)
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
    if (!partial && STOP_ON.has('idle') && t > 0 && answersNow >= 0 && answersNow <= lastAnswers)
      reasons.push(`no new answer folded (${answersNow} on record, was ${lastAnswers})`);
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
    lastAnswers = Math.max(lastAnswers, answersNow);
    parkedLastTurn = parkedThisTurn;
    await sleep(PACE_MS);
  }

  // THE ROUND'S VERDICT IS THE EXIT CODE (M-223). Round 12 exited 0 with no
  // song: its only red path was fail-fast, so a round whose turn 1 died on
  // 429/502 five times reported GREEN. One reason per song, never summed:
  // finished (a lyric_revise exit 0), failed_fast, server_turn_cap (M-224),
  // upstream_final (M-231: a 502 whose upstream answered 4xx), transport (the
  // last turn was a non-200 or an error body), no_stop (every turn answered and the
  // loop never reached exit 0). A single-song round is red on anything but
  // finished; a survey keeps exit 0 because its job is coverage.
  const exitReason =
    sawStop === 0
      ? 'finished'
      : failedFast
        ? 'failed_fast'
        : hitTurnCap
          ? 'server_turn_cap'
          : hitUpstreamFinal
            ? 'upstream_final'
            : lastStatus !== 200 || lastError
              ? 'transport'
              : 'no_stop';
  if (N_SONGS === 1 && exitReason !== 'finished') process.exitCode = 1;
  console.log(
    `::${exitReason === 'finished' ? 'notice' : 'error'} title=battery verdict::song ${songNo}: ${exitReason}` +
      (lastError ? ` — last error: ${esc(lastError, 160)}` : '')
  );
  summary.songs.push({
    song: songNo,
    brief: esc(brief, 80),
    turns,
    retries,
    exit_reason: exitReason,
    reached_stop: sawStop,
    parked,
    failed_fast: failedFast,
    stop_on: [...STOP_ON],
    user_reasks: userReasks,
    reask_bound: REASK,
    truncated_turns: truncated,
    loop_ladder: loopLadder,
    flags,
  });
  writeFileSync(`${OUT}/summary.json`, JSON.stringify(summary, null, 2) + '\n');
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
}

summary.finished = new Date().toISOString();
writeFileSync(`${OUT}/summary.json`, JSON.stringify(summary, null, 2) + '\n');
console.log(
  `\nrecorded to ${OUT} — the transcript is the deliverable; the leak charging happens off it.`
);
