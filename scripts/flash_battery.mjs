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
  'Write me a song about a lighthouse keeper who falls asleep. Take it all the way to finished — I want the final, checked version.',
  'I want a song in ABAB quatrains about packing up a childhood home. Use assonance as the rhyme feel, and finish it properly — revised until it passes.',
  'Write a song with a chorus and a bridge about driving at night. No prechorus. Finish it — do not stop at a draft.',
  'Write a short song about rain on a tin roof, then revise it until every check passes. Show me the finished version only when it is actually finished.',
  'Write me a drinking song with a verbatim refrain that comes back three times. Take it through the whole process to a finished song.',
];
const CONTINUE = 'continue';

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
// CHAT_TOOL_TIMEOUT_MS each (mcp/chat.js — the repo default is what deploys,
// render.yaml sets no override). Both factors are READ from the modules that
// own them rather than respelled here; a spelling this script cannot find
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
  'mcp/chat.js',
  /num\('CHAT_TOOL_TIMEOUT_MS',\s*([\d_]+)\)/,
  "CHAT_TOOL_TIMEOUT_MS's declared default"
);
const MAX_STEPS = readConst('mcp/gemini_agent.js', /maxSteps:\s*(\d+)/, 'LIMITS.maxSteps');
const TURN_DEADLINE_MS = MAX_STEPS * TOOL_TIMEOUT_MS;

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
  let sawStop = null; // last lyric_revise exit 0/3 seen
  let turns = 0;
  let retries = 0;

  for (let t = 0; t < MAX_TURNS; t++) {
    const message = t === 0 ? brief : CONTINUE;
    const body = { message };
    if (env) {
      body.history = env.history;
      body.workspace = env.workspace;
      if (env.lyric != null) body.lyric = env.lyric;
      body.sig = env.sig;
    }
    let r = await post(body);
    // Bounded, logged backoff: a 429/503 is the deployment's own pacing and
    // is part of the record, never silently absorbed.
    while ((r.status === 429 || r.status === 503) && retries < 4) {
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
    for (const c of reviseCalls) {
      if (c.exit_code === 0 || c.exit_code === 3) sawStop = c.exit_code;
    }
    // Mechanical suspicion, not a verdict: a reply that LOOKS like a
    // delivered multi-section song while no revise call ever reached a stop
    // condition. The analyst confirms or discharges it from the transcript.
    const looksDelivered =
      /\[[A-Z][A-Z0-9 ]*(—|-)[^\]]*\]/.test(p.reply || '') || /\[FINISHED/.test(p.reply || '');
    if (looksDelivered && sawStop === null) {
      flags.push({ turn: t, flag: 'possible_premature_done' });
    }
    const banned = tools.filter((c) => typeof c.banned_pairs === 'number' && c.banned_pairs > 0);
    if (banned.length && /finish|final|done|complete/i.test(p.reply || '') && sawStop === null) {
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
    if (sawStop !== null) break; // the loop certified a stop condition — the song is over
    if (p.error) break;
    await sleep(PACE_MS);
  }

  summary.songs.push({
    song: songNo,
    brief: esc(brief, 80),
    turns,
    retries,
    reached_stop: sawStop,
    flags,
  });
  writeFileSync(`${OUT}/summary.json`, JSON.stringify(summary, null, 2) + '\n');
  console.log(
    `song ${songNo}: ${turns} turn(s), stop=${sawStop === null ? 'NEVER' : `exit ${sawStop}`}, flags=${flags.length}`
  );
}

summary.finished = new Date().toISOString();
writeFileSync(`${OUT}/summary.json`, JSON.stringify(summary, null, 2) + '\n');
console.log(
  `\nrecorded to ${OUT} — the transcript is the deliverable; the leak charging happens off it.`
);
