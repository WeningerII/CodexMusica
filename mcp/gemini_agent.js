// gemini_agent.js — one conversational turn of Gemini driving the real MCP tools.
//
// STATELESS BY CONSTRUCTION. runTurn() takes the prior `history` and `workspace`
// and returns the new ones; it stores nothing. That is not a style preference —
// AGENTS.md promises callers that "nothing is stored server-side… there is no
// session to resume and no handle to hold" (`connector-tools-read-only`, gated
// by check_connector_contract.js). The chat bar keeps its transcript in the
// browser and posts it back each turn, so the server holding state would make
// that sentence false.
//
// The workspace rides in the ENVELOPE, never in the model's context: it goes
// browser → server → engine and back, and the model neither sees nor writes it.
// See WORKSPACE_PROPERTY in gemini_tools.js for why it cannot be a parameter.

import { toGeminiDeclarations, WORKSPACE_PROPERTY, STATE_PROPERTY } from './gemini_tools.js';

export const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

// Published list price, USD per 1M tokens, so a run can report what it cost
// instead of how many tokens it moved. `thoughts` bills as output — that is the
// whole reason thinking is pinned off below.
export const PRICING = {
  'gemini-3.1-flash-lite': { input: 0.25, output: 1.5 },
  'gemini-3.5-flash-lite': { input: 0.3, output: 2.5 },
};

export const DEFAULT_MODEL = 'gemini-3.1-flash-lite';

// Thinking LOW, and it is the cheaper setting — which is the opposite of what
// the token price says, so it is worth writing down why.
//
// Thought tokens bill at the OUTPUT rate (6x input on 3.1 Flash-Lite), so
// `thinkingBudget: 0` looks strictly cheaper per hop and is. But a hop is not
// the unit that costs money here: a CONVERSATION is, and every hop re-sends the
// whole transcript, so one extra tool call costs far more than the few hundred
// thought tokens that would have avoided it. Thinking off recovers badly from a
// tool error — it re-emits the call that just failed — and each retry pays for
// the entire history again.
//
// Measured over the full 11-prompt probe suite, same code, same catalog:
//
//                        pass   mean cost   mean tokens   WORST prompt
//   thinkingBudget: 0    10/11   $0.01148     42,773      126,766 tok / $0.0330
//   thinkingLevel low     9/11   $0.00928     31,935       39,718 tok / $0.0122
//
// Low is 19% cheaper on the mean and 3.2x cheaper on the tail, took zero guessed
// ids across all eleven (off guessed three on the hardest one), and made fewer
// requests per conversation — which on a 15-requests-per-minute free tier is
// the number that decides how many people can use the chat bar at once. The
// tail is what blows a spend cap and triggers 429 storms, so it is weighted
// accordingly.
//
// Off wins one prompt (the deliberately awkward one) and loses another; neither
// setting passes both, so the pass column is a wash and the cost column is not.
// Re-measure with `--thinking=low` / default before changing this.
export const DEFAULT_THINKING = { thinkingLevel: 'low' };

// Ceilings. Each one is the difference between a bad turn costing cents and a
// bad turn costing a bill, and every one of them is reachable by an ordinary
// user with no ill intent — a model that loops on search_catalog hits MAX_STEPS
// without anybody attacking anything.
export const LIMITS = {
  maxSteps: 14, // tool round-trips per user turn (baseline observed: 6-9)
  maxOutputTokens: 2048,
  temperature: 0,
  // A ceiling in DOLLARS on one turn, checked between hops.
  //
  // maxSteps already bounds the hop count, but hops are not the unit that
  // costs money: every hop re-sends the whole transcript, so cost grows with
  // the SQUARE of the conversation rather than with the step counter. The
  // measured worst prompt in the probe suite ran $0.033; ~~ten cents is three
  // times that, so an ordinary bad turn never sees this and a pathological
  // one stops before it matters.~~ RAISED TO $2.50 BY THE OWNER 2026-09-02,
  // and the reason the old figure had to go is `turnBudget()` below: at the
  // pruning ceiling ten cents bought SIX hops of a declared FOURTEEN, so the
  // dollar cap was the operative step limit and `maxSteps` was decoration —
  // a turn legal by the step counter died on the dollar counter and reported
  // MAX_TURN_COST for it. $2.50 sits an order of magnitude above the worst
  // LEGAL turn ($0.2180 at the ceiling), which is what makes this a
  // PATHOLOGY bound again rather than a step limit wearing a dollar sign.
  // Without it the only per-request bound is step count, and a turn that
  // grew a large workspace could spend far more inside fourteen legal hops
  // than fourteen ordinary hops ever would.
  //
  // IT NOW SITS ABOVE `chat.js`'s DAILY CEILING ($2 by default), AND THAT IS
  // A CONSEQUENCE RATHER THAN AN OVERSIGHT. The daily check admits a turn
  // BEFORE it runs and never interrupts one in flight, so a single turn may
  // carry the day past its own ceiling. `chatCeilings()` in `chat.js` says
  // which of the three binds and `/chat/status` reports it; `CHAT_DAILY_USD`
  // is the other knob and was NOT moved here, being a separate decision.
  maxTurnUsd: Number(process.env.CHAT_MAX_TURN_USD) || 2.5,
  // WHICH OF THOSE TWO CEILINGS ACTUALLY BINDS IS `turnBudget()` BELOW, AND
  // IT IS DISCLOSED RATHER THAN LEFT TO WHICHEVER IS SMALLER (2026-09-02,
  // triage C11). `maxSteps` and `maxTurnUsd` are two answers to ONE question
  // — how many hops may a turn take — and the smaller one wins in silence,
  // so a turn that stopped at hop 8 of a legal 14 reported MAX_TURN_COST
  // with no number beside it. That is the reading problem M-169 exists for,
  // one coordinate over.
  // STALE-BRIEF PRUNING (M-197's open half). Every hop re-sends the whole
  // transcript, and the transcript is mostly FOLDED LYRIC RESULTS the model
  // has already acted on: a lyric_revise brief is ~20 KB on the record (a
  // filler draft's is 117 KB), a lyric_grade verdict carries its full report
  // (~45 KB on the record, 182 KB measured on a filler draft), and a
  // lyric_plan brief is 21 KB (seed 16). The battery's rows grew ~40 KB a
  // turn and read 395 KB by turn 4, where the turn cap THEN IN FORCE ($0.10;
  // it is $2.50 since 2026-09-02) ended a turn after four hops (~100k tokens
  // x $0.25/M ~ $0.025 a hop). Those bytes are why pruning exists and they do
  // not move with the cap. See
  // pruneHistory below for the rule; `CHAT_PRUNE_FOLDED=0` disables it.
  pruneFolded: process.env.CHAT_PRUNE_FOLDED !== '0',
  // The newest N prior turns are never touched (the model's own last hop
  // of context, intact). One is enough because the pending question is
  // ALSO kept by the newest-per-tool rule wherever it sits.
  pruneKeepTurns: Number(process.env.CHAT_PRUNE_KEEP_TURNS) || 1,
  // A byte ceiling on the pruned transcript, newest kept. 200 KB is ~50k
  // tokens at the measured ~4 bytes/token, i.e. ~$0.0125 a hop, so a late
  // turn kept at least eight hops under the $0.10 cap instead of four, which
  // is the arithmetic that sized this ceiling; at the $2.50 cap in force now
  // `maxSteps` binds first and this is a pure byte bound. On
  // the record's shape stubbing alone lands well under it (~150 KB at
  // turn 9), so this only ever bites a pathological transcript.
  pruneMaxBytes: Number(process.env.CHAT_PRUNE_MAX_BYTES) || 200_000,
};

// A 429 ON THE CHAT PATH, RETRIED AT MOST TWICE AND NEVER LONGER THAN THIS
// (2026-09-02, `MISSING.md` M-168's untouched rung). The chat bar reported
// every 429 as "busy" on the argument that Google's retry hint is routinely
// tens of seconds; round 10 ended on exactly that answer — turn 4 burned the
// battery's four retries and turn 5 died on a hard 429 — while the key's own
// limiter is 15 requests a MINUTE, which refills one request every 4 s. A wait
// of 2 s then 4 s covers one refill slot and no more: a hop that lost a race
// against a sibling conversation recovers, and a genuinely exhausted window is
// still reported inside eight seconds, far under the 38 s stall the old
// comment refused. `Retry-After` (the header, or Google's RetryInfo / "retry
// in Ns" in the body) is HONOURED when it fits the budget and REFUSED when it
// does not: a hint past `maxTotalWaitMs` throws at once with `retryAfterMs`
// on the error rather than sleeping into the tool timeout. Every retried
// request is counted in `usage.requests` and `usage.retries`, so M-197's
// accounting sees the quota it spent; the final throw is not a retry and is
// not counted, which keeps the M-197 pin's "one hop billed before the throw"
// exact. Callers that put 429 in `retryStatuses` (the probe) keep the old
// unbounded wait; this budget applies only where 429 is NOT waited out.
export const RATE_LIMIT_RETRY = {
  retries: 2,
  backoffMs: [2000, 4000],
  maxTotalWaitMs: 8000,
};

// The price for a model, or null if we do not know it.
//
// `null` is the whole point of this function: it is what lets the caller REFUSE
// to run rather than run uncosted. The spend cap used to be computed as
// `cost || 0`, so an unpriced model contributed nothing to the day's total and
// the cap never tripped — the ceiling silently became infinite at exactly the
// moment someone pointed the service at a model this table had not heard of.
// That is also the guaranteed operator response to a model retirement, so the
// failure was scheduled rather than hypothetical.
//
// A new model is therefore a DELIBERATE act: add it to PRICING above, or state
// its rates in the environment. Both are explicit; neither is a shrug.
export function priceFor(model) {
  const listed = PRICING[model];
  if (listed) return listed;
  const input = Number(process.env.CHAT_PRICE_INPUT_PER_1M);
  const output = Number(process.env.CHAT_PRICE_OUTPUT_PER_1M);
  if (Number.isFinite(input) && Number.isFinite(output) && input >= 0 && output >= 0) {
    return { input, output, declared: true };
  }
  return null;
}

// THE BYTES-PER-TOKEN RATIO THE PRUNING CEILING IS STATED IN. Measured at
// ~4 bytes a token over this connector's own JSON transcripts (M-197's
// pruning measurement states the ceiling in BYTES and the cap in DOLLARS,
// and this is the one place the two units meet). Declared, so the arithmetic
// below reads a coordinate rather than a magic number.
export const BYTES_PER_TOKEN = Number(process.env.CHAT_BYTES_PER_TOKEN) || 4;

/**
 * What a turn's two ceilings actually buy, derived from the declared
 * coordinates and the model's own price. No number is invented here: every
 * input is `LIMITS` or `PRICING`, so a repin anywhere moves this.
 *
 * `worstLegalTurnUsd` is what a turn costs if it uses EVERY one of its
 * `maxSteps` hops with a prompt at the pruning ceiling and a full output
 * budget on each. Read it against `maxTurnUsd`: if the cap is BELOW it, the
 * cap is the operative step limit and `maxSteps` is decoration — a turn that
 * is legal by the step counter is killed by the dollar counter, and the user
 * is told MAX_TURN_COST when what bound them was the hop budget. That is a
 * fact about the two coordinates, not a defect in either, and it is the
 * arithmetic the `CHAT_MAX_TURN_USD` ruling wants (triage C11).
 *
 * THE CEILING IS NOT THE WHOLE STORY AND THIS SAYS SO: `pruneHistory` runs
 * ONCE A TURN, on the PRIOR transcript, so a turn's own tool results append
 * on top of the pruned prior without being pruned again. A hop that folds a
 * `lyric_grade` report (~45 KB on the record) pushes the prompt past the
 * ceiling inside the turn, so `hopsAffordable` is an UPPER bound on a
 * grading turn and an accurate one on a conversational turn.
 *
 * @returns {{perHopUsd:number, worstLegalTurnUsd:number,
 *            hopsAffordable:number, capBinds:boolean}|null} null when the
 *          model is unpriced — the same refusal `costOf` makes.
 */
export function turnBudget(limits = LIMITS, model = DEFAULT_MODEL) {
  const price = priceFor(model);
  if (!price) return null;
  const promptTokens = limits.pruneMaxBytes / BYTES_PER_TOKEN;
  const perHopUsd = (promptTokens * price.input + limits.maxOutputTokens * price.output) / 1e6;
  const worstLegalTurnUsd = perHopUsd * limits.maxSteps;
  const hopsAffordable = Math.floor(limits.maxTurnUsd / perHopUsd);
  return {
    perHopUsd,
    worstLegalTurnUsd,
    hopsAffordable,
    capBinds: hopsAffordable < limits.maxSteps,
  };
}

export function costOf(usage, model) {
  const price = priceFor(model);
  if (!price) return null;
  const input = usage.promptTokens || 0;
  // Thoughts are billed as output and are NOT included in candidatesTokenCount.
  const output = (usage.candidatesTokens || 0) + (usage.thoughtsTokens || 0);
  return (input * price.input + output * price.output) / 1e6;
}

function addUsage(into, meta) {
  if (!meta) return into;
  into.promptTokens += meta.promptTokenCount || 0;
  into.candidatesTokens += meta.candidatesTokenCount || 0;
  into.thoughtsTokens += meta.thoughtsTokenCount || 0;
  into.requests += 1;
  return into;
}

// The tool result is an MCP content block: `[{type:'text', text:'<json>'}]`, and
// tools.js has already caught engine throws and re-emitted them as isError with
// a human-readable message. Both shapes have to reach the model — an error the
// model cannot read is an error it cannot recover from, and recovering (looking
// an id up instead of guessing again) is exactly the behaviour under test.
function toFunctionResponse(name, id, result) {
  const blocks = (result?.content ?? []).map((c) => c?.text ?? '');
  const text = blocks[0] ?? '';
  if (result?.isError) return { name, ...(id ? { id } : {}), response: { error: text } };
  // A multi-block result leads with a PRESENTATION block (plain text the
  // model must reproduce verbatim — lyric_grade's rendered song) followed
  // by a JSON verdict. Both must reach the model, named so the
  // presentation block cannot be mistaken for reformatting material.
  if (blocks.length > 1) {
    let verdict;
    try {
      verdict = JSON.parse(blocks[1]);
    } catch {
      verdict = blocks[1];
    }
    // The revise state comes back out here, exactly as the workspace does
    // below: `lyric_revise`'s verdict block carries the deferred-run record
    // (~262KB measured), the adapter has already harvested it, and every
    // later hop would re-send it. The model reads the question and the
    // verdict, never the blob.
    if (verdict && typeof verdict === 'object' && !Array.isArray(verdict)) {
      const { [STATE_PROPERTY]: _state, ...visible } = verdict;
      verdict = visible;
    }
    return { name, ...(id ? { id } : {}), response: { presentation: text, verdict } };
  }
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { name, ...(id ? { id } : {}), response: { text } };
  }
  // Gemini requires `response` to be an object.
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { name, ...(id ? { id } : {}), response: { parsed } };
  }
  // THE WORKSPACE COMES BACK OUT HERE TOO.
  //
  // Removing it from the declarations stops the model WRITING one. It did
  // nothing about the model READING one, because every recipe tool returns the
  // workspace in its result and this function passed the parsed payload straight
  // through — so the object the whole design exists to keep out of the model's
  // context was being handed to it on every start_recipe and edit_recipe.
  //
  // Measured on a 2-tradition, 11-card seed: 8,153 of the 11,271-character
  // response, or 72%. And it compounds — Gemini is stateless, so every later hop
  // re-sends the entire transcript, and a conversation with four recipe calls
  // pays for four copies of it on every subsequent request.
  //
  // Nothing needs it here. The adapter has already harvested `workspace` into
  // its own variable by the time this runs, and injects it on the way back out.
  // The model was reading a value it cannot act on and cannot address.
  const { workspace: _workspace, [STATE_PROPERTY]: _state, ...visible } = parsed;
  return { name, ...(id ? { id } : {}), response: visible };
}

// Google puts the wait it wants in the error body ("Please retry in 28.6s") and
// sometimes in RetryInfo. Prefer what it asked for; fall back to exponential.
function bodyHintMs(json) {
  const info = (json?.error?.details || []).find((d) => /RetryInfo/.test(d['@type'] || ''));
  const fromInfo = info?.retryDelay && /^([\d.]+)s$/.exec(info.retryDelay);
  if (fromInfo) return Math.ceil(parseFloat(fromInfo[1]) * 1000) + 250;
  const fromText = /retry in ([\d.]+)s/i.exec(json?.error?.message || '');
  if (fromText) return Math.ceil(parseFloat(fromText[1]) * 1000) + 250;
  return null;
}

function retryDelayMs(json, attempt) {
  return bodyHintMs(json) ?? Math.min(32000, 1000 * 2 ** attempt);
}

// What a 429 ASKED us to wait, or null when it asked nothing: the standard
// `Retry-After` header first (seconds, or an HTTP date), then the body's own
// hint. Null is the answer that lets RATE_LIMIT_RETRY's own backoff apply.
function rateLimitHintMs(res, json) {
  const header = typeof res?.headers?.get === 'function' ? res.headers.get('retry-after') : null;
  if (header != null && header !== '') {
    if (/^\d+$/.test(header.trim())) return Number(header.trim()) * 1000;
    const at = Date.parse(header);
    if (Number.isFinite(at)) return Math.max(0, at - Date.now());
  }
  return bodyHintMs(json);
}

// 429 is not an error here, it is a QUEUE. The key this was built against is on
// the free tier (15 requests/minute), and a tool loop makes one request per hop
// — so a single 9-hop conversation can hit the ceiling by itself, and two users
// at once certainly will. Retrying is what makes the probe's results about the
// MODEL rather than about the quota. The server surfaces exhaustion to the user
// instead (see the retry budget it passes), because a chat bar that silently
// waits 30s reads as broken.
// Which statuses are worth waiting out is CALLER-SPECIFIC, so it is a parameter
// rather than a constant. The probe wants 429 retried — it is measuring the
// model, not Google's meter, and it can afford to sleep 38 seconds. A user
// staring at the chat bar cannot, so the server retries only the transient 5xx
// (where the backoff is ~1s and the next attempt usually works) and reports a
// 429 immediately as "busy".
// A MALFORMED FUNCTION CALL IS RE-ASKED, BOUNDED (M-219, round 11, 2026-09-03).
// Gemini ends a hop with finishReason MALFORMED_FUNCTION_CALL when the call
// it generated does not parse; the turn used to END there — the hop's parts
// were appended and the loop broke — so the loop's next question waited a
// whole battery pace (130 s) for the next user turn. Round 11: 8 of 9 turns
// ended this way, two of them before any call was made. The malformed parts
// are NOT appended (they would be re-read as context), the same request is
// sent again, and each re-ask spends a hop of `maxSteps` and a request of the
// quota like any other. Two re-asks, because the third failure in a row is a
// model that is not going to call this hop, and the turn should say so.
export const MALFORMED_CALL_RETRY = { retries: 2 };
// The head of the malformed call text that is kept per hop. Gemini's
// `finishMessage` on a MALFORMED_FUNCTION_CALL carries the call it could
// not parse; the whole thing can be a draft's worth of quoted lines, and the
// first two thousand characters name the tool, the first arguments and the
// point where the quoting went wrong.
export const MALFORMED_TEXT_HEAD = 2000;
export function malformedText(candidate) {
  const msg = candidate?.finishMessage;
  if (typeof msg !== 'string' || !msg) return null;
  return msg.length > MALFORMED_TEXT_HEAD ? msg.slice(0, MALFORMED_TEXT_HEAD) + '…' : msg;
}

export const RETRY_TRANSIENT = [500, 502, 503, 504];
export const RETRY_ALL = [429, ...RETRY_TRANSIENT];

// Test seam (the `_workerInternals` precedent): what the model is SHOWN is a
// verdict this function computes, and a suite that cannot reach it can only
// grep for the strip instead of proving it.
// THE LOOP'S OWN RECORD OF A CALL, one pure function (M-169; extracted
// 2026-09-02 so it can be pinned by VALUE rather than by grepping the
// source). The verdict rides beside the exit code for the reason
// banned_pairs does — a verdict only the model ever saw protects nobody,
// and a transcript that cannot say how many rounds bought how many lines
// cannot tell a slow run from a stuck one. `answers_on_record` joins them:
// it is computed on both the suspended and the finished branch of
// lyric_revise and was once dropped here, which is how round 10's "turn 0's
// work was thrown away" reading survived long enough to need refuting from
// a byte count. `loop_whole_flag_codes` joined 2026-09-02 (M-186): a
// whole-only exit 3 carried `loop_unresolved` 0 and no cause.
function loopFields(v) {
  return {
    exit_code: typeof v?.exit_code === 'number' ? v.exit_code : null,
    banned_pairs: typeof v?.banned_pairs === 'number' ? v.banned_pairs : null,
    loop_stop_reason: typeof v?.loop_stop_reason === 'string' ? v.loop_stop_reason : null,
    loop_rounds: typeof v?.loop_rounds === 'number' ? v.loop_rounds : null,
    loop_unresolved: typeof v?.loop_unresolved === 'number' ? v.loop_unresolved : null,
    loop_whole_flag_codes: Array.isArray(v?.loop_whole_flag_codes) ? v.loop_whole_flag_codes : null,
    answers_on_record: typeof v?.answers_on_record === 'number' ? v.answers_on_record : null,
    // WHY AN EXIT 2 REFUSED (2026-09-02, M-168's swerve): round 10's record
    // holds two lyric_sweep calls and one lyric_plan call at exit 2 with
    // `error: null` and nothing else — the harness's own `REFUSED — …`
    // headline was in the report the model read and in no record, so no
    // later reader can say whether the window held no seed, a predicate was
    // misspelled or the declaration was unbuildable. Extraction, as M-169.
    refusal: typeof v?.refusal === 'string' ? v.refusal : null,
    // THE PATH, THE CLOCK, THE MEMO, THE STALE COUNT, THE SHAPE (M-216):
    // the four numbers ten battery rounds could not read. `path` says
    // whether the deployed box answered warm or cold; `ms` separates
    // harness time from model time within a turn; `memo_*` is the replay
    // memo's own tally; `stale_answers` is M-183's clause; `plan_lines` the
    // drawn shape. Null where the verb printed no such line.
    path: typeof v?.path === 'string' ? v.path : null,
    ms: typeof v?.ms === 'number' ? v.ms : null,
    memo_state: typeof v?.memo_state === 'string' ? v.memo_state : null,
    memo_hit: typeof v?.memo_hit === 'number' ? v.memo_hit : null,
    memo_asked: typeof v?.memo_asked === 'number' ? v.memo_asked : null,
    stale_answers: typeof v?.stale_answers === 'number' ? v.stale_answers : null,
    plan_lines: typeof v?.plan_lines === 'number' ? v.plan_lines : null,
  };
}

export const _agentInternals = {
  loopFields,
  toFunctionResponse,
  suspendedSeed,
  buildSystemInstruction,
  carryState,
  stateKey,
  carriedKey,
  pruneHistory,
};

async function generate({
  apiKey,
  model,
  body,
  signal,
  retries = 0,
  retryStatuses = RETRY_ALL,
  rateLimit = null,
  onRetry,
}) {
  let rateLimited = 0;
  let waited = 0;
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${API_BASE}/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify(body),
      signal,
    });
    const json = await res.json().catch(() => null);
    if (res.ok) return json;
    // THE BOUNDED 429 PATH (RATE_LIMIT_RETRY, M-168): only where the caller
    // declared a budget AND is not already waiting 429 out unbounded.
    if (res.status === 429 && rateLimit && !retryStatuses.includes(429)) {
      const hint = rateLimitHintMs(res, json);
      const wait = hint ?? rateLimit.backoffMs[rateLimited] ?? rateLimit.backoffMs.at(-1);
      if (rateLimited < rateLimit.retries && waited + wait <= rateLimit.maxTotalWaitMs) {
        rateLimited += 1;
        waited += wait;
        if (onRetry) onRetry({ status: 429, waitMs: wait, attempt, rateLimited: true });
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      const err = new Error(`Gemini 429: ${json?.error?.message || 'rate limited'}`);
      err.status = 429;
      err.retryAfterMs = hint;
      err.rateLimitRetries = rateLimited;
      throw err;
    }
    const retriable = retryStatuses.includes(res.status);
    if (retriable && attempt < retries) {
      const wait = retryDelayMs(json, attempt);
      if (onRetry) onRetry({ status: res.status, waitMs: wait, attempt });
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    const detail = json?.error?.message || `HTTP ${res.status}`;
    const err = new Error(`Gemini ${res.status}: ${detail}`);
    err.status = res.status;
    throw err;
  }
}

/**
 * Build the model-facing surface from a live MCP handshake.
 * @param {{listTools:Function, getInstructions?:Function}} client connected MCP client
 */
export async function buildSurface(client) {
  const { tools } = await client.listTools();
  const { declarations, workspaceTools, stateTools } = toGeminiDeclarations(tools);
  // The server's own instructions, not a paraphrase kept in sync by hand. They
  // are the text every other MCP client already receives, so the chat bar and a
  // Claude connector are driving the engine off one description.
  const instructions =
    typeof client.getInstructions === 'function' ? client.getInstructions() : undefined;
  return {
    declarations,
    workspaceTools: new Set(workspaceTools),
    stateTools: new Set(stateTools),
    instructions,
    tools,
  };
}

// ── THE SUSPENDED-RUN REMINDER (M-158) ────────────────────────────────────
// The flash battery's first MODEL-level finding (single-song run,
// 2026-08-29 00:37Z, transcript in the run's own job log): the model answers
// the revise loop's question INTO THE CHAT. The loop asks for one line in
// the shape `LINE: <text>`; the model authored well-formed answers and posted
// them as its REPLY TO THE PERSON, ending five consecutive turns (3-7 of 9)
// with zero tool calls while the suspended run's state sat frozen — one
// candidate line repeated verbatim, the harness's question unanswered in the
// only channel that reaches it, the turn budget spent, no stop condition.
// The cure is the conservative one of the two designs put to the owner: a
// MECHANICAL REMINDER, present exactly while a suspended run is carried, so
// the model stays the writer and the decider and the battery can measure
// whether the nudge cures the stall. The reminder is REBUILT EVERY HOP from
// the live carried state, so it appears the moment a mid-turn call suspends
// and disappears the moment a run reaches a stop condition — never a stale
// sentence about a run that is over.
// M-226 (round 14, turn 7, the first malformed call ever recorded): the call
// broke INSIDE the draft array the model re-sent, and this note used to say
// "with the same arguments plus answer" — an instruction to re-send it. The
// draft is carried with the record; the continuing call is seed + answer.
const SUSPENDED_RUN_NOTE = (seed) =>
  `A lyric_revise run for ${typeof seed === 'number' ? `seed ${seed}` : seed} is SUSPENDED, awaiting one answer. ` +
  'Nothing you write in chat reaches the harness: the run advances ONLY ' +
  'when you call lyric_revise again with `seed` and `answer` — NOTHING ELSE. ' +
  'Do NOT send `draft`: the draft and the state are carried for you, and a ' +
  're-sent draft is where the call has broken before. Put the line in the ' +
  "tool call's `answer` field — do not print it as your reply. The song " +
  'cannot finish until the loop reaches a stop condition through that tool.';

// THE DECLARATION THE MODEL SEES WHILE A RUN IS SUSPENDED HAS NO `draft`
// (M-226). Prose asks; a schema decides. With a record carried for a seed,
// the continuing lyric_revise call is filled from it, so the parameter is
// removed from the declaration for that request and the model has nothing to
// re-emit. The first call of a song, with no record, sees the full schema.
export function declarationsFor(surface, lyr) {
  if (!lyr || typeof lyr.state !== 'string' || !Array.isArray(lyr.draft))
    return surface.declarations;
  return surface.declarations.map((d) => {
    if (!surface.stateTools?.has(d.name) || !d.parameters?.properties?.draft) return d;
    const { draft: _draft, ...properties } = d.parameters.properties;
    const required = Array.isArray(d.parameters.required)
      ? d.parameters.required.filter((n) => n !== 'draft')
      : d.parameters.required;
    return {
      ...d,
      parameters: { ...d.parameters, properties, ...(required ? { required } : {}) },
    };
  });
}

function suspendedSeed(lyr) {
  if (!lyr || typeof lyr.state !== 'string') return null;
  try {
    const st = JSON.parse(lyr.state);
    if (!(st && st.pending)) return null;
    if (typeof lyr.seed === 'number') return lyr.seed;
    // A pasted song's run (M-195) has no seed; the reminder names the run
    // by its mandate instead of staying silent.
    return typeof lyr.key === 'string' && lyr.key.startsWith('mandate:')
      ? 'the declared mandate'
      : null;
  } catch {
    return null;
  }
}

// The ONE builder of the request's systemInstruction — base instructions
// plus the reminder when (and only when) a suspended run is carried.
// mcp/test.mjs pins both directions on this helper and pins that the
// `systemInstruction:` key is spelled nowhere else in this file, so the
// request cannot grow a second, reminder-less path to the model.
// THE CARRIED RECORD AFTER A STATE-BEARING TOOL ANSWERED (M-183). Only a
// SUSPENDED verdict (exit 4) carries a run forward. A run that reached a stop
// condition (exit 0 or 3) is COMPLETE: its record used to be harvested and
// re-injected on the next call for the seed, and the harness replayed every
// answer in it and stopped exactly where it had stopped — which is why round
// 10's parked-continue pushes never asked the writer a second question about
// any line. The record still rides the verdict for provenance (the tool
// returns it; the CLI's own stamp says the state is complete); what changes
// is that the NEXT call starts a fresh loop from whatever draft the model
// hands in. A refusal (exit 2) leaves whatever was carried in place: the
// question it refused an answer to is still pending. A verdict about a
// different seed never touches the carried record of this one.
// WHAT A RUN IS KEYED ON (M-195): the seed when there is one, and otherwise
// the declared mandate — a pasted song has no seed, and a record carried
// for it must still go back to the same song and no other.
function stateKey(args) {
  if (typeof args?.seed === 'number') return `seed:${args.seed}`;
  const hasMandate =
    (args?.scheme != null && args.scheme !== '') || (args?.groups != null && args.groups !== '');
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

function carryState(prev, toolName, args, verdict, surface) {
  if (!surface.stateTools?.has(toolName)) return prev;
  const key = stateKey(args);
  if (key == null) return prev;
  const code = verdict && typeof verdict.exit_code === 'number' ? verdict.exit_code : null;
  if (code === 4 && typeof verdict[STATE_PROPERTY] === 'string') {
    return {
      key,
      seed: typeof args.seed === 'number' ? args.seed : null,
      state: verdict[STATE_PROPERTY],
      // THE DRAFT RIDES WITH THE RECORD (M-221). A deferred run replays its
      // answers onto ONE draft, so the draft is constant across a run's
      // calls by the harness's own contract — and the model was re-emitting
      // every line of it, quoted, on every fold. Carried here so a
      // continuing call may omit it; the tool refuses an omitted draft that
      // nothing carries, in its own words.
      // Present only when a draft is known — a record with none is
      // byte-identical to the pre-M-221 shape, so nothing that read it moves.
      ...(Array.isArray(args.draft)
        ? { draft: args.draft }
        : Array.isArray(prev?.draft)
          ? { draft: prev.draft }
          : {}),
    };
  }
  if ((code === 0 || code === 3) && prev && carriedKey(prev) === key) return null;
  return prev;
}

// A record written before M-195 carries `seed` and no `key`; read it as its
// seed's key so a browser holding an older envelope keeps its run.
function carriedKey(lyr) {
  if (!lyr) return null;
  if (typeof lyr.key === 'string') return lyr.key;
  return typeof lyr.seed === 'number' ? `seed:${lyr.seed}` : null;
}

function buildSystemInstruction(surface, lyr) {
  const seed = suspendedSeed(lyr);
  const text = [surface.instructions, seed == null ? null : SUSPENDED_RUN_NOTE(seed)]
    .filter(Boolean)
    .join('\n\n');
  return text ? { parts: [{ text }] } : null;
}

// ── STALE-BRIEF PRUNING (M-197's open half) ──────────────────────────────
// A pure function over the transcript. INVARIANT: the pruned history is the
// original with some lyric_* functionResponse bodies replaced by a verdict
// stub, and possibly the OLDEST whole turns dropped — never a turn among the
// newest `keepTurns`, never the newest result of any lyric tool (that is
// where the pending question, the latest grade and the brief being written
// to live), never a recipe/workspace result (standing rule 1: the two
// families do not touch), never a user message, a model part or a
// functionCall of a surviving turn, and every functionCall keeps its
// functionResponse (Gemini rejects an orphan on the next request).
//
// The verdict fields survive in the stub so the model can still read what
// an earlier fold DECIDED (exit code, stop reason, answers on record); what
// goes is the presentation block and the report — the brief for a question
// the model already answered, the rendered song a later result superseded.
const PRUNED_FAMILY = /^lyric_/;
const STUB_FIELDS = [
  'exit_code',
  'status',
  'kind',
  'meaning',
  'banned_pairs',
  'loop_stop_reason',
  'loop_rounds',
  'loop_unresolved',
  // M-186: a whole-only exit 3 carries loop_unresolved 0 and its cause here;
  // a stub that dropped it would be the fifth carrier that lost the cause.
  'loop_whole_flag_codes',
  'answers_on_record',
];
const PRUNED_NOTE =
  'folded result pruned from the transcript: a later result of this tool superseded it; ' +
  'the verdict fields are kept, the brief and report are not';

function isUserText(entry) {
  return entry?.role === 'user' && (entry.parts || []).some((p) => typeof p?.text === 'string');
}

function stubResponse(fr) {
  const src =
    fr.response && typeof fr.response === 'object' && !Array.isArray(fr.response)
      ? fr.response
      : {};
  // A two-block result keeps its verdict under `verdict`; a one-block
  // result IS the verdict. An error result is short and stays as it is.
  if ('error' in src) return null;
  const from = src.verdict && typeof src.verdict === 'object' ? src.verdict : src;
  const stub = { pruned: PRUNED_NOTE };
  for (const k of STUB_FIELDS) if (from[k] !== undefined) stub[k] = from[k];
  return { ...fr, response: stub };
}

/**
 * Prune folded lyric results the model has already acted on.
 * @param {Array} contents the prior transcript (Gemini contents[])
 * @param {{keepTurns?:number, maxBytes?:number}} opts
 * @returns {Array} a new array; entries are shared where untouched
 */
function pruneHistory(contents, { keepTurns = 1, maxBytes = 200_000 } = {}) {
  if (!Array.isArray(contents) || !contents.length) return contents;
  // Turns: each user TEXT entry opens one; tool responses ride on `user`
  // entries too but carry no text, so they stay inside the turn they answer.
  const turns = [];
  for (const entry of contents) {
    if (isUserText(entry) || !turns.length) turns.push([]);
    turns[turns.length - 1].push(entry);
  }
  const firstKept = Math.max(0, turns.length - Math.max(0, keepTurns));
  // The newest result per lyric tool, by position, is kept verbatim.
  const newest = new Map();
  contents.forEach((entry, i) => {
    for (const p of entry?.parts || []) {
      const name = p?.functionResponse?.name;
      if (typeof name === 'string' && PRUNED_FAMILY.test(name)) newest.set(name, i);
    }
  });
  let index = 0;
  const pruned = turns.map((turn, t) =>
    turn.map((entry) => {
      const i = index++;
      if (t >= firstKept || entry?.role !== 'user') return entry;
      let changed = false;
      const parts = (entry.parts || []).map((p) => {
        const fr = p?.functionResponse;
        if (!fr || !PRUNED_FAMILY.test(fr.name || '') || newest.get(fr.name) === i) return p;
        if (fr.response && fr.response.pruned === PRUNED_NOTE) return p;
        const stubbed = stubResponse(fr);
        if (!stubbed) return p;
        changed = true;
        return { ...p, functionResponse: stubbed };
      });
      return changed ? { ...entry, parts } : entry;
    })
  );
  // The byte ceiling: drop the OLDEST whole turns, never the newest keepTurns.
  let start = 0;
  const bytes = (from) => JSON.stringify(pruned.slice(from).flat()).length;
  while (start < firstKept && bytes(start) > maxBytes) start++;
  return pruned.slice(start).flat();
}

/**
 * Run one user turn to completion: the model calls tools until it answers.
 *
 * @returns {{reply:string, history:Array, workspace:object|null,
 *            lyric:{seed:number,state:string}|null, calls:Array,
 *            usage:object, cost:number|null, stopped:string|null}}
 *   `history` is the full contents[] to hand back on the next turn — model parts
 *   are appended VERBATIM, which is what preserves Gemini 3's thoughtSignatures
 *   across hops (dropping them degrades multi-step tool use).
 *   `lyric` is the carried revise state: the record the last state-bearing tool
 *   result returned, keyed on the seed it was returned FOR, so a call about a
 *   different seed starts a fresh run instead of inheriting a stale record.
 */
export async function runTurn({
  apiKey,
  model = DEFAULT_MODEL,
  surface,
  callTool,
  history = [],
  workspace = null,
  lyric = null,
  userText,
  thinking = DEFAULT_THINKING,
  limits = LIMITS,
  retries = 0,
  retryStatuses = RETRY_ALL,
  rateLimit = null,
  signal,
  onEvent,
}) {
  // THE ONE ASSEMBLY SITE. The prior transcript is pruned here and the
  // pruned transcript is what goes back in the envelope, so a fold is
  // stubbed once and stays stubbed — pruneHistory is idempotent.
  const prior = limits.pruneFolded
    ? pruneHistory(history, { keepTurns: limits.pruneKeepTurns, maxBytes: limits.pruneMaxBytes })
    : history;
  const contents = [...prior, { role: 'user', parts: [{ text: userText }] }];
  const usage = {
    promptTokens: 0,
    candidatesTokens: 0,
    thoughtsTokens: 0,
    requests: 0,
    retries: 0,
    malformedRetries: 0,
  };
  const calls = [];
  let malformed = 0;
  // WHAT THE MALFORMED HOP CONTAINED (M-221). Gemini puts the text of a call
  // it could not parse in the candidate's `finishMessage`; the re-ask (M-219)
  // threw the whole hop away, so nine malformed turns were banked in round
  // 11 and not one row could say WHAT was malformed. One entry per malformed
  // hop, head-truncated, whether or not the re-ask then landed a call.
  const malformedHops = [];
  let ws = workspace;
  let lyr = lyric && typeof lyric.state === 'string' ? lyric : null;
  let stopped = null;
  let stoppedDetail = null;
  let reply = '';

  const body = {
    contents,
    tools: [{ functionDeclarations: surface.declarations }],
    toolConfig: { functionCallingConfig: { mode: 'AUTO' } },
    generationConfig: {
      temperature: limits.temperature,
      maxOutputTokens: limits.maxOutputTokens,
      ...(thinking ? { thinkingConfig: thinking } : {}),
    },
  };

  // A THROW MID-TURN CARRIES WHAT WAS SPENT (2026-09-01, triage finding
  // C28 / `MISSING.md` M-197): only 5xx is retried, so a 429 on hop N
  // threw hops 1..N-1 away and the spend counter never saw them — every
  // billed hop before the throw was uncounted. The error now carries the
  // partial `usage` and the calls made, and `chat.js` charges it in its
  // catch before replying.
  try {
    for (let step = 0; step < limits.maxSteps; step++) {
      body.contents = contents;
      // Rebuilt per hop from the LIVE carried state (M-158): `lyr` moves when
      // a harvest lands mid-turn, and the reminder must move with it.
      const si = buildSystemInstruction(surface, lyr);
      if (si) body.systemInstruction = si;
      else delete body.systemInstruction;
      // Per hop, like the reminder: the record can appear mid-turn (M-226).
      body.tools = [{ functionDeclarations: declarationsFor(surface, lyr) }];
      const json = await generate({
        apiKey,
        model,
        body,
        signal,
        retries,
        retryStatuses,
        rateLimit,
        // A retried request spent a slot of the key's quota whether or not it
        // was billed tokens; the count is the record (M-197, M-168).
        onRetry: (r) => {
          usage.requests += 1;
          usage.retries += 1;
          if (onEvent) onEvent({ type: 'retry', ...r });
        },
      });
      addUsage(usage, json.usageMetadata);
      const candidate = json.candidates?.[0];
      const parts = candidate?.content?.parts || [];
      const functionCalls = parts.filter((p) => p.functionCall).map((p) => p.functionCall);

      // THE MALFORMED-CALL RE-ASK (MALFORMED_CALL_RETRY, M-219). Nothing of
      // this hop is kept: the parts are the broken call, and appending them
      // would hand the model its own mistake as context. The re-ask is the
      // identical request, counted as a hop and a request.
      if (
        candidate?.finishReason === 'MALFORMED_FUNCTION_CALL' &&
        !functionCalls.length &&
        malformed < MALFORMED_CALL_RETRY.retries
      ) {
        malformed += 1;
        usage.malformedRetries += 1;
        const finishMessage = malformedText(candidate);
        malformedHops.push({ hop: step + 1, attempt: malformed, reasked: true, finishMessage });
        if (onEvent) onEvent({ type: 'malformed', attempt: malformed, finishMessage });
        if (step === limits.maxSteps - 1) stopped = 'MAX_STEPS';
        continue;
      }

      // Verbatim, including thoughtSignature.
      contents.push({ role: 'model', parts });

      if (!functionCalls.length) {
        reply = parts
          .filter((p) => typeof p.text === 'string' && !p.thought)
          .map((p) => p.text)
          .join('');
        // MAX_TOKENS with no text is a truncated answer, not an answer.
        if (candidate?.finishReason && candidate.finishReason !== 'STOP') {
          stopped = candidate.finishReason;
          if (stopped === 'MALFORMED_FUNCTION_CALL') {
            // The re-asks were spent and the model still could not call: say
            // how many, so a transcript row reads as "re-asked twice, then
            // gave up" and not as a bare label (M-219; C11's rule) — and
            // say WHAT it tried to call (M-221), which is the only evidence
            // a malformed turn leaves.
            const finishMessage = malformedText(candidate);
            malformedHops.push({
              hop: step + 1,
              attempt: malformed + 1,
              reasked: false,
              finishMessage,
            });
            stoppedDetail = {
              malformedRetries: malformed,
              retriesAllowed: MALFORMED_CALL_RETRY.retries,
              hops: step + 1,
              maxSteps: limits.maxSteps,
              finishMessage,
            };
          }
        }
        break;
      }

      const responses = [];
      for (const fc of functionCalls) {
        const args = { ...(fc.args || {}) };
        let result;
        if (surface.workspaceTools.has(fc.name)) {
          if (!ws) {
            // Not an exception: the model can fix this itself by seeding first,
            // and telling it so costs one short string.
            result = {
              isError: true,
              content: [
                {
                  type: 'text',
                  text: 'Error: no recipe yet — call start_recipe first, then edit it.',
                },
              ],
            };
            calls.push({ name: fc.name, args, isError: true, injectedWorkspace: false });
            responses.push({ functionResponse: toFunctionResponse(fc.name, fc.id, result) });
            continue;
          }
          args[WORKSPACE_PROPERTY] = ws;
        }
        // Inject the carried revise state, KEYED ON THE SEED: a call about the
        // seed the record belongs to continues that run; any other seed is a
        // different song and starts clean. No carried state is not an error the
        // way an absent workspace is — the FIRST lyric_revise call of a song
        // legitimately has none, and the tool itself refuses an `answer` with
        // no state, in its own words.
        let injectedState = false;
        let injectedDraft = false;
        if (surface.stateTools?.has(fc.name)) {
          if (lyr && stateKey(args) != null && stateKey(args) === carriedKey(lyr)) {
            args[STATE_PROPERTY] = lyr.state;
            injectedState = true;
            // The carried draft fills an OMITTED draft only (M-221): a draft
            // the model did send is the model's own statement and stands.
            if (args.draft == null && Array.isArray(lyr.draft)) {
              args.draft = lyr.draft;
              injectedDraft = true;
            }
          } else {
            // The declaration does not expose `state`, so anything here is
            // model-fabricated; the harness would replay it through verify()
            // and refuse honestly, but a clean first call is the better run.
            delete args[STATE_PROPERTY];
          }
        }
        // A tool that fails — a timeout, a dropped transport — becomes an
        // ERROR RESULT the model can see and react to, never an exception
        // that kills the whole turn: under the old shape one slow call
        // turned the entire conversation into a bare 502 with the record
        // of every earlier call discarded (flash battery finding #1).
        try {
          result = await callTool(fc.name, args);
        } catch (err) {
          result = {
            isError: true,
            content: [{ type: 'text', text: `Error: ${err?.message || 'tool call failed'}` }],
          };
        }
        const isError = !!result?.isError;
        // Harvest the workspace on the way past. The model is never shown it, so
        // this is the only place it can be captured.
        let payload = null;
        let lyricVerdict = null;
        if (!isError) {
          try {
            payload = JSON.parse(result?.content?.[0]?.text ?? '');
          } catch {
            payload = null;
          }
          if (payload && payload.workspace) ws = payload.workspace;
          // Harvest a lyric verdict the same way: a two-block lyric result
          // carries it in the SECOND block (block 0 is the deliverable,
          // deliberately not JSON); a one-block lyric result IS the verdict.
          // Captured so the page can show the exit code and the banned-pair
          // count on the tool chip whether or not the model relays either —
          // the 2026-08-19 site transcript relayed neither.
          const second = result?.content?.[1]?.text;
          if (second != null) {
            try {
              lyricVerdict = JSON.parse(second);
            } catch {
              lyricVerdict = null;
            }
          }
          if (!lyricVerdict && payload && typeof payload.exit_code === 'number') {
            lyricVerdict = payload;
          }
          // Harvest the revise state the way the workspace is harvested above:
          // the verdict block is the only place it rides, the model is never
          // shown it, and the envelope carries it to the next turn — but ONLY
          // a suspended run is carried; see `carryState`.
          lyr = carryState(lyr, fc.name, args, lyricVerdict, surface);
        }
        calls.push({
          name: fc.name,
          // The workspace is the bulk of an edit call and is not the model's
          // output; logging it would bury the argument that IS. The injected
          // revise state is the same bulk one family over.
          args: surface.workspaceTools.has(fc.name)
            ? { ...args, [WORKSPACE_PROPERTY]: '<injected>' }
            : injectedState
              ? {
                  ...args,
                  [STATE_PROPERTY]: '<injected>',
                  ...(injectedDraft ? { draft: '<carried>' } : {}),
                }
              : args,
          isError,
          // M-221: whether this call's draft came from the model or from the
          // carried record — the row that says how much the model had to emit.
          draft_carried: injectedDraft,
          error: isError ? (result?.content?.[0]?.text ?? '') : null,
          cards: payload?.cards ?? null,
          recipe: payload?.recipe ?? null,
          ...loopFields(lyricVerdict),
        });
        if (onEvent) onEvent({ type: 'tool', name: fc.name, isError });
        responses.push({ functionResponse: toFunctionResponse(fc.name, fc.id, result) });
      }
      // Gemini takes tool output back on the `user` turn.
      contents.push({ role: 'user', parts: responses });

      // Stop between hops once this turn has spent its allowance. Checked HERE,
      // after the tool responses are appended, so the transcript handed back is
      // still coherent and the next user message can continue from it — an abort
      // mid-hop would strand a functionCall with no functionResponse, which
      // Gemini rejects on the following turn.
      //
      // A null cost means the model is unpriced, which the caller is supposed to
      // have refused before getting here; if one reaches this loop anyway, stop
      // rather than run on unmetered.
      const soFar = costOf(usage, model);
      if (limits.maxTurnUsd > 0 && (soFar === null || soFar >= limits.maxTurnUsd)) {
        stopped = soFar === null ? 'UNPRICED_MODEL' : 'MAX_TURN_COST';
        // WITH THE NUMBERS, NOT AS A BARE LABEL (2026-09-02, triage C11).
        // `MAX_TURN_COST` alone cannot be told from `MAX_STEPS` by anyone
        // reading a transcript, and round 10's rows are the evidence: a turn
        // that stopped at hop 8 of 14 looks exactly like a turn that ran out
        // of hops. What it spent, what the cap is, how many hops it bought
        // and how many it was allowed all ride out with it.
        stoppedDetail = {
          usd: soFar,
          cap: limits.maxTurnUsd,
          hops: step + 1,
          maxSteps: limits.maxSteps,
          budget: turnBudget(limits, model),
        };
        if (onEvent) onEvent({ type: 'stopped', reason: stopped, usd: soFar });
        break;
      }
      if (step === limits.maxSteps - 1) stopped = 'MAX_STEPS';
    }
  } catch (err) {
    if (err && typeof err === 'object') {
      err.usage = usage;
      err.calls = calls;
    }
    throw err;
  }

  return {
    reply,
    history: contents,
    workspace: ws,
    lyric: lyr,
    calls,
    usage,
    cost: costOf(usage, model),
    stoppedDetail,
    stopped,
    malformed: malformedHops,
  };
}
