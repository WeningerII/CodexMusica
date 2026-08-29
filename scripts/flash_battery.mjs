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
//     [--turns=N] [--pace=SECONDS] [--brief=INDEX]
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
const MAX_TURNS = Math.max(2, parseInt(args.turns || '9', 10));
const PACE_MS = Math.max(0, parseFloat(args.pace || '130') * 1000);

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
const CONTINUE =
  'continue — and answer every question the revision loop asks within this ' +
  'same reply, one lyric_revise call after another, as many as it takes. ' +
  'One answer per reply is too slow; keep going until it reaches exit 0.';
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
          resolve({ status: res.statusCode, payload, ms: Date.now() - started });
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
    // Bounded, logged backoff: a 429/503 is the deployment's own pacing and
    // is part of the record, never silently absorbed. 502 joined at M-164
    // (round 7, 2026-08-29): chat.js answers 502 from its catch-all when a
    // turn's upstream dies past the server's own single 5xx retry — the
    // turn's work is thrown away but the carried envelope is intact, so a
    // logged retry is the user pressing send again, not record-blurring.
    while ((r.status === 429 || r.status === 502 || r.status === 503) && retries < 4) {
      retries++;
      appendFileSync(file, JSON.stringify({ turn: t, retry: retries, status: r.status }) + '\n');
      await sleep(Math.max(PACE_MS, 60_000));
      r = await post(body);
    }
    const p = r.payload || {};
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
        error: p.error ?? null,
        sizes: {
          history: p.history ? JSON.stringify(p.history).length : 0,
          lyric: p.lyric ? JSON.stringify(p.lyric).length : 0,
        },
      }) + '\n'
    );
    turns++;
    if (r.status !== 200) break;
    env = { history: p.history, workspace: p.workspace, lyric: p.lyric, sig: p.sig };
    if (sawStop !== null) break; // exit 0 — the song is FINISHED (M-163)
    if (p.error) break;
    parkedLastTurn = parkedThisTurn;
    await sleep(PACE_MS);
  }

  summary.songs.push({
    song: songNo,
    brief: esc(brief, 80),
    turns,
    retries,
    reached_stop: sawStop,
    parked,
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
    `song ${songNo}: ${turns} turn(s), stop=${sawStop === null ? (parked ? `NEVER (parked x${parked})` : 'NEVER') : `exit ${sawStop}`}, flags=${flags.length}` +
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
